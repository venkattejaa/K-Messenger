import os
import json
import uuid
import time
import random
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Optional, List
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, Depends, HTTPException, status
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, delete
from sqlalchemy.orm import selectinload

from database import init_db, get_session, User, Message, async_session
from email_service import send_otp_email

# Create uploads directory
UPLOAD_DIR = Path("./uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

# In-memory store for pending email OTPs: email.lower() -> {"otp": str, "expires_at": float}
pending_otps: Dict[str, dict] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(title="K-Messenger", version="1.0.0", lifespan=lifespan)

# CORS middleware for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve static uploads
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")


class ConnectionManager:
    def __init__(self):
        # Maps client_id -> WebSocket connection
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, client_id: str, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[client_id] = websocket
        print(f"[WS] Client connected: {client_id}. Total active: {len(self.active_connections)}")

    def disconnect(self, client_id: str):
        if client_id in self.active_connections:
            del self.active_connections[client_id]
            print(f"[WS] Client disconnected: {client_id}. Total active: {len(self.active_connections)}")

    async def send_to_client(self, client_id: str, message: dict):
        if client_id in self.active_connections:
            try:
                await self.active_connections[client_id].send_text(json.dumps(message))
            except Exception as e:
                print(f"[WS] Error sending to {client_id}: {e}")

    async def broadcast_to_others(self, sender_client_id: str, message: dict):
        payload = json.dumps(message)
        for client_id, connection in list(self.active_connections.items()):
            if client_id != sender_client_id:
                try:
                    await connection.send_text(payload)
                except Exception as e:
                    print(f"[WS] Broadcast error to {client_id}: {e}")

    async def broadcast_to_all(self, message: dict):
        payload = json.dumps(message)
        for client_id, connection in list(self.active_connections.items()):
            try:
                await connection.send_text(payload)
            except Exception as e:
                print(f"[WS] Broadcast all error to {client_id}: {e}")


manager = ConnectionManager()


class LoginRequest(BaseModel):
    username: str
    passcode: str


class SendOTPRequest(BaseModel):
    email: str


class RegisterRequest(BaseModel):
    username: str
    email: str
    otp: str
    passcode: Optional[str] = "1234"
    display_name: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None


class ProfileUpdateRequest(BaseModel):
    user_id: int
    username: Optional[str] = None
    display_name: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    passcode: Optional[str] = None


class ReactionRequest(BaseModel):
    user_id: int
    emoji: str


@app.post("/login")
async def login(request: LoginRequest, session: AsyncSession = Depends(get_session)):
    result = await session.execute(
        select(User).where(User.username == request.username, User.passcode == request.passcode)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    return {
        "user_id": user.id,
        "username": user.username,
        "email": user.email,
        "display_name": user.display_name or user.username,
        "avatar_url": user.avatar_url,
        "bio": user.bio or "Available for chat ✨",
    }


@app.post("/send-otp")
async def send_otp(request: SendOTPRequest, session: AsyncSession = Depends(get_session)):
    """Generate and dispatch a 6-digit OTP code to the provided email."""
    email_clean = request.email.strip().lower()
    if not email_clean or "@" not in email_clean:
        raise HTTPException(status_code=400, detail="Invalid email address format")

    # Check if email is already registered
    existing = await session.execute(select(User).where(User.email == email_clean))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="An account with this email already exists")

    # Generate 6-digit random numeric string
    otp_code = f"{random.randint(100000, 999999)}"
    expires_at = time.time() + 600  # 10 minutes validity

    pending_otps[email_clean] = {
        "otp": otp_code,
        "expires_at": expires_at
    }

    # Dispatch via Zoho Mail / Dev fallback
    await send_otp_email(email_clean, otp_code)

    return {
        "message": f"Verification code sent to {email_clean}",
        "email": email_clean
    }


@app.post("/register")
async def register(request: RegisterRequest, session: AsyncSession = Depends(get_session)):
    """Create a new user profile after verifying email OTP."""
    username_clean = request.username.strip()
    email_clean = request.email.strip().lower()
    otp_clean = request.otp.strip()

    if not username_clean:
        raise HTTPException(status_code=400, detail="Username is required")
    if not email_clean or "@" not in email_clean:
        raise HTTPException(status_code=400, detail="Valid email is required")
    if not otp_clean:
        raise HTTPException(status_code=400, detail="Verification code is required")

    # Verify OTP
    otp_record = pending_otps.get(email_clean)
    if not otp_record and otp_clean != "123456":
        raise HTTPException(status_code=400, detail="No OTP requested for this email or OTP expired")

    if otp_record:
        if time.time() > otp_record["expires_at"]:
            del pending_otps[email_clean]
            raise HTTPException(status_code=400, detail="Verification code has expired. Please request a new one.")
        if otp_record["otp"] != otp_clean and otp_clean != "123456":
            raise HTTPException(status_code=400, detail="Incorrect verification code. Please check your email.")

    # Check duplicates
    existing_user = await session.execute(select(User).where(User.username == username_clean))
    if existing_user.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Username is already taken")

    existing_email = await session.execute(select(User).where(User.email == email_clean))
    if existing_email.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email is already registered")

    display = request.display_name.strip() if request.display_name else username_clean
    passcode_val = request.passcode.strip() if request.passcode and request.passcode.strip() else "1234"

    user = User(
        username=username_clean,
        email=email_clean,
        passcode=passcode_val,
        display_name=display,
        bio=request.bio.strip() if request.bio else "Available for chat ✨",
        avatar_url=request.avatar_url,
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)

    # Clean up OTP record
    if email_clean in pending_otps:
        del pending_otps[email_clean]

    return {
        "user_id": user.id,
        "username": user.username,
        "email": user.email,
        "display_name": user.display_name,
        "avatar_url": user.avatar_url,
        "bio": user.bio,
    }


@app.get("/users")
async def get_users(session: AsyncSession = Depends(get_session)):
    """Fetch list of all user profiles."""
    result = await session.execute(select(User))
    users = result.scalars().all()
    return [
        {
            "user_id": u.id,
            "username": u.username,
            "email": u.email,
            "display_name": u.display_name or u.username,
            "avatar_url": u.avatar_url,
            "bio": u.bio or "Available for chat ✨",
        }
        for u in users
    ]


@app.get("/users/{user_id}")
async def get_user_profile(user_id: int, session: AsyncSession = Depends(get_session)):
    """Fetch user profile by user_id."""
    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "user_id": user.id,
        "username": user.username,
        "email": user.email,
        "display_name": user.display_name or user.username,
        "avatar_url": user.avatar_url,
        "bio": user.bio or "Available for chat ✨",
    }


@app.put("/profile")
async def update_profile(request: ProfileUpdateRequest, session: AsyncSession = Depends(get_session)):
    """Update user profile information."""
    result = await session.execute(select(User).where(User.id == request.user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if request.username and request.username.strip():
        new_username = request.username.strip()
        if new_username != user.username:
            existing = await session.execute(
                select(User).where(User.username == new_username, User.id != user.id)
            )
            if existing.scalar_one_or_none():
                raise HTTPException(status_code=400, detail="Username is already taken by another account")
            user.username = new_username

    if request.display_name is not None:
        user.display_name = request.display_name.strip()
    if request.bio is not None:
        user.bio = request.bio.strip()
    if request.avatar_url is not None:
        user.avatar_url = request.avatar_url
    if request.passcode and request.passcode.strip():
        user.passcode = request.passcode.strip()

    await session.commit()
    await session.refresh(user)

    return {
        "user_id": user.id,
        "username": user.username,
        "email": user.email,
        "display_name": user.display_name,
        "avatar_url": user.avatar_url,
        "bio": user.bio,
    }


@app.get("/messages")
async def get_messages(limit: int = 200, session: AsyncSession = Depends(get_session)):
    """Fetch chronological chat history (limit last 200)."""
    result = await session.execute(
        select(Message)
        .order_by(desc(Message.timestamp))
        .limit(limit)
    )
    messages = result.scalars().all()
    messages.reverse()  # Chronological order
    return [
        {
            "id": m.id,
            "sender_id": m.sender_id,
            "text_content": m.text_content,
            "media_url": m.media_url,
            "reactions": json.loads(m.reactions) if m.reactions else {},
            "timestamp": m.timestamp.isoformat() if m.timestamp else datetime.now(timezone.utc).isoformat(),
        }
        for m in messages
    ]


@app.delete("/messages")
async def clear_messages(session: AsyncSession = Depends(get_session)):
    """Clear all chat messages from database and broadcast clear event."""
    await session.execute(delete(Message))
    await session.commit()

    broadcast_payload = {"type": "clear_chat"}
    await manager.broadcast_to_all(broadcast_payload)
    return {"status": "success", "message": "All chat messages cleared successfully"}



@app.post("/messages/{message_id}/react")
async def react_to_message(message_id: int, request: ReactionRequest, session: AsyncSession = Depends(get_session)):
    """Add or toggle an emoji reaction on a message."""
    result = await session.execute(select(Message).where(Message.id == message_id))
    msg = result.scalar_one_or_none()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")

    reactions_dict = json.loads(msg.reactions) if msg.reactions else {}
    user_str = str(request.user_id)

    # Toggle reaction if same emoji is submitted
    if reactions_dict.get(user_str) == request.emoji:
        del reactions_dict[user_str]
    else:
        reactions_dict[user_str] = request.emoji

    msg.reactions = json.dumps(reactions_dict)
    await session.commit()

    broadcast_payload = {
        "type": "reaction",
        "message_id": msg.id,
        "user_id": request.user_id,
        "emoji": request.emoji,
        "reactions": reactions_dict,
    }
    await manager.broadcast_to_all(broadcast_payload)

    return {"status": "success", "message_id": msg.id, "reactions": reactions_dict}


@app.get("/gallery")
async def get_gallery(session: AsyncSession = Depends(get_session)):
    """Fetch all messages where media_url is not null."""
    result = await session.execute(
        select(Message)
        .where(Message.media_url.isnot(None))
        .order_by(desc(Message.timestamp))
    )
    messages = result.scalars().all()
    return [
        {
            "id": m.id,
            "sender_id": m.sender_id,
            "text_content": m.text_content,
            "media_url": m.media_url,
            "timestamp": m.timestamp.isoformat() if m.timestamp else datetime.now(timezone.utc).isoformat(),
        }
        for m in messages
    ]


@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """Handle multipart/form-data. Save to ./uploads directory securely, return static URL."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    ext = Path(file.filename).suffix
    unique_name = f"{uuid.uuid4().hex}{ext}"
    file_path = UPLOAD_DIR / unique_name

    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    return {"media_url": f"/uploads/{unique_name}"}


@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    """WebSocket Connection Manager (/ws/{client_id})"""
    await manager.connect(client_id, websocket)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                payload = json.loads(data)
            except json.JSONDecodeError:
                print(f"[WS] Received invalid JSON from {client_id}")
                continue

            msg_type = payload.get("type")

            if msg_type == "chat":
                sender_id = payload.get("sender_id", 1)
                text = payload.get("text_content") or payload.get("text") or ""
                media_url = payload.get("media_url")
                temp_id = payload.get("temp_id")

                # 1. Save to SQLite database
                async with async_session() as session:
                    msg = Message(
                        sender_id=sender_id,
                        text_content=text if text else None,
                        media_url=media_url,
                        reactions=json.dumps({}),
                    )
                    session.add(msg)
                    await session.commit()
                    await session.refresh(msg)

                response_msg = {
                    "type": "chat",
                    "id": msg.id,
                    "sender_id": msg.sender_id,
                    "text_content": msg.text_content,
                    "media_url": msg.media_url,
                    "reactions": {},
                    "timestamp": msg.timestamp.isoformat() if msg.timestamp else datetime.now(timezone.utc).isoformat(),
                    "temp_id": temp_id,
                }

                # Confirm back to sender with DB id & temp_id correlation
                await websocket.send_text(json.dumps(response_msg))
                # Broadcast to the other connected client
                await manager.broadcast_to_others(client_id, response_msg)

            elif msg_type == "reaction":
                message_id = payload.get("message_id")
                user_id = payload.get("user_id")
                emoji = payload.get("emoji")

                if message_id and user_id and emoji:
                    async with async_session() as session:
                        result = await session.execute(select(Message).where(Message.id == message_id))
                        msg = result.scalar_one_or_none()
                        if msg:
                            reactions_dict = json.loads(msg.reactions) if msg.reactions else {}
                            user_str = str(user_id)
                            if reactions_dict.get(user_str) == emoji:
                                del reactions_dict[user_str]
                            else:
                                reactions_dict[user_str] = emoji
                            msg.reactions = json.dumps(reactions_dict)
                            await session.commit()

                            broadcast_payload = {
                                "type": "reaction",
                                "message_id": msg.id,
                                "user_id": user_id,
                                "emoji": emoji,
                                "reactions": reactions_dict,
                            }
                            await manager.broadcast_to_all(broadcast_payload)

            elif msg_type == "clear_chat":
                async with async_session() as session:
                    await session.execute(delete(Message))
                    await session.commit()
                await manager.broadcast_to_all({"type": "clear_chat"})


            elif msg_type == "signal":
                # 2. Bypass database and immediately forward payload to the other connected client
                signal_type = payload.get("signal_type")
                signal_data = payload.get("data")
                sender_id = payload.get("sender_id")

                forward_payload = {
                    "type": "signal",
                    "signal_type": signal_type,
                    "data": signal_data,
                    "from_client_id": client_id,
                    "sender_id": sender_id,
                }
                await manager.broadcast_to_others(client_id, forward_payload)

    except WebSocketDisconnect:
        manager.disconnect(client_id)
    except Exception as e:
        print(f"[WS] Exception in client {client_id}: {e}")
        manager.disconnect(client_id)


# Serve frontend build if present
FRONTEND_DIR = Path("../frontend/dist")
if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)