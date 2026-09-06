import asyncio
import os
import json
import tempfile
import httpx
import websockets
from pathlib import Path

BASE_URL = "http://127.0.0.1:8000"
WS_URL = "ws://127.0.0.1:8000/ws"

async def test_full_system():
    async with httpx.AsyncClient(base_url=BASE_URL) as client:
        # 1. Test Login with user1
        resp = await client.post("/login", json={"username": "user1", "passcode": "1234"})
        assert resp.status_code == 200, f"Login failed: {resp.text}"
        data = resp.json()
        assert data["username"] == "user1"
        assert "display_name" in data
        user1_id = data["user_id"]
        print("✓ Login endpoint verified")

        # 2. Test Invalid Login
        resp = await client.post("/login", json={"username": "user1", "passcode": "wrong"})
        assert resp.status_code == 401
        print("✓ Invalid login rejected correctly")

        # 3. Test Send OTP Endpoint
        test_email = f"user_{int(asyncio.get_event_loop().time())}@zoho.com"
        resp = await client.post("/send-otp", json={"email": test_email})
        assert resp.status_code == 200, f"Send OTP failed: {resp.text}"
        print(f"✓ Send OTP endpoint verified for {test_email}")

        # 4. Test Profile Registration with Email and OTP
        reg_payload = {
            "username": f"charlie_{int(asyncio.get_event_loop().time())}",
            "email": test_email,
            "otp": "123456",
            "passcode": "pass123",
            "display_name": "Charlie Brown",
            "bio": "Testing profile creation 🚀",
        }
        resp = await client.post("/register", json=reg_payload)
        assert resp.status_code == 200, f"Register failed: {resp.text}"
        reg_data = resp.json()
        assert reg_data["display_name"] == "Charlie Brown"
        assert reg_data["email"] == test_email
        charlie_id = reg_data["user_id"]
        print("✓ Profile registration with Zoho Mail Email & OTP verified")

        # 5. Test Profile Update with Username change
        new_uname = f"charlie_new_{int(asyncio.get_event_loop().time())}"
        update_payload = {
            "user_id": charlie_id,
            "username": new_uname,
            "display_name": "Charlie B. Updated",
            "bio": "Updated bio info!",
        }
        resp = await client.put("/profile", json=update_payload)
        assert resp.status_code == 200
        assert resp.json()["username"] == new_uname
        assert resp.json()["display_name"] == "Charlie B. Updated"
        print("✓ Profile update with username change verified")

        # Test Duplicate Username Rejection
        dup_payload = {
            "user_id": charlie_id,
            "username": "user1",
        }
        resp = await client.put("/profile", json=dup_payload)
        assert resp.status_code == 400
        print("✓ Duplicate username update rejected correctly")

        # 6. Test Upload
        test_file_content = b"fake image bytes content"
        files = {"file": ("test_image.png", test_file_content, "image/png")}
        resp = await client.post("/upload", files=files)
        assert resp.status_code == 200
        upload_data = resp.json()
        media_url = upload_data["media_url"]
        assert media_url.startswith("/uploads/")
        print(f"✓ Upload endpoint verified: {media_url}")

        # Verify static file serving
        resp = await client.get(media_url)
        assert resp.status_code == 200
        assert resp.content == test_file_content
        print("✓ Static file serving verified")

        # 7. Test WebSocket Chat, Reactions and Signaling
        ws_url1 = f"{WS_URL}/client_user1"
        ws_url2 = f"{WS_URL}/client_user2"

        async with websockets.connect(ws_url1) as ws1, websockets.connect(ws_url2) as ws2:
            print("✓ WebSockets connected for client1 and client2")

            # Client 1 sends chat message
            chat_payload = {
                "type": "chat",
                "sender_id": user1_id,
                "text_content": "Instagram DM aesthetic message!",
                "media_url": media_url,
                "temp_id": "temp_test_123"
            }
            await ws1.send(json.dumps(chat_payload))

            # Client 1 gets ACK confirmation
            ack_msg_raw = await ws1.recv()
            ack_data = json.loads(ack_msg_raw)
            assert ack_data["type"] == "chat"
            assert ack_data["text_content"] == "Instagram DM aesthetic message!"
            assert ack_data["media_url"] == media_url
            msg_id = ack_data["id"]
            print("✓ Sender received saved chat confirmation with DB id")

            # Client 2 receives broadcast chat message
            broadcast_raw = await ws2.recv()
            broadcast_data = json.loads(broadcast_raw)
            assert broadcast_data["type"] == "chat"
            assert broadcast_data["text_content"] == "Instagram DM aesthetic message!"
            print("✓ Recipient received broadcast chat message")

            # Client 2 reacts with Heart ❤️
            reaction_payload = {
                "type": "reaction",
                "message_id": msg_id,
                "user_id": 2,
                "emoji": "❤️"
            }
            await ws2.send(json.dumps(reaction_payload))

            # Client 1 & 2 receive reaction broadcast
            rx_raw1 = await ws1.recv()
            rx_data1 = json.loads(rx_raw1)
            assert rx_data1["type"] == "reaction"
            assert rx_data1["emoji"] == "❤️"

            rx_raw2 = await ws2.recv()
            rx_data2 = json.loads(rx_raw2)
            assert rx_data2["type"] == "reaction"
            assert rx_data2["emoji"] == "❤️"
            print("✓ Live message reaction (Heart ❤️) broadcast verified on all clients")

            # Client 1 sends WebRTC signal (offer)
            signal_payload = {
                "type": "signal",
                "signal_type": "offer",
                "data": {"sdp": "fake_sdp_offer", "type": "offer"},
                "sender_id": user1_id
            }
            await ws1.send(json.dumps(signal_payload))

            # Client 2 receives WebRTC signal immediately
            signal_raw = await ws2.recv()
            recv_signal = json.loads(signal_raw)
            assert recv_signal["type"] == "signal"
            assert recv_signal["signal_type"] == "offer"
            assert recv_signal["data"]["sdp"] == "fake_sdp_offer"
            assert recv_signal["from_client_id"] == "client_user1"
            print("✓ WebRTC signal successfully forwarded without DB overhead")

        # 8. Test REST /messages history
        resp = await client.get("/messages")
        assert resp.status_code == 200
        messages = resp.json()
        assert len(messages) >= 1
        last_msg = messages[-1]
        assert last_msg["text_content"] == "Instagram DM aesthetic message!"
        print(f"✓ REST /messages returned {len(messages)} messages in history")

        # 9. Test REST /gallery
        resp = await client.get("/gallery")
        assert resp.status_code == 200
        gallery = resp.json()
        assert len(gallery) >= 1
        assert gallery[0]["media_url"] == media_url
        print(f"✓ REST /gallery returned {len(gallery)} media items")

        # 10. Test DELETE /messages clear endpoint
        resp = await client.delete("/messages")
        assert resp.status_code == 200
        assert resp.json()["status"] == "success"

        # Verify messages list is now empty
        resp = await client.get("/messages")
        assert resp.status_code == 200
        assert len(resp.json()) == 0
        print("✓ DELETE /messages successfully cleared chat history")

    print("\nALL SYSTEM TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    asyncio.run(test_full_system())

