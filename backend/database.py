from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy import Integer, String, DateTime, ForeignKey, select, text
from datetime import datetime, timezone
from typing import Optional, List


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    email: Mapped[Optional[str]] = mapped_column(String(100), unique=True, nullable=True)
    passcode: Mapped[str] = mapped_column(String(100), nullable=False)
    display_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    avatar_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    bio: Mapped[Optional[str]] = mapped_column(String(250), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    messages: Mapped[List["Message"]] = relationship("Message", back_populates="sender")


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sender_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    text_content: Mapped[Optional[str]] = mapped_column(String(5000), nullable=True)
    media_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    reactions: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)  # JSON string of reactions {user_id: emoji}
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)

    sender: Mapped["User"] = relationship("User", back_populates="messages")


# Database engine and session
DATABASE_URL = "sqlite+aiosqlite:///./chat.db"
engine = create_async_engine(DATABASE_URL, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Execute column additions if missing (SQLite migration helper)
        for col_def in [
            "ALTER TABLE users ADD COLUMN display_name VARCHAR(100);",
            "ALTER TABLE users ADD COLUMN avatar_url VARCHAR(500);",
            "ALTER TABLE users ADD COLUMN bio VARCHAR(250);",
            "ALTER TABLE users ADD COLUMN email VARCHAR(100);",
            "ALTER TABLE messages ADD COLUMN reactions VARCHAR(500);",
        ]:
            try:
                await conn.execute(text(col_def))
            except Exception:
                pass  # column already exists
    
    # Create default users (user1 / 1234, user2 / 1234) if they don't exist
    async with async_session() as session:
        for username, passcode, dname, bio in [
            ("user1", "1234", "Alice Johnson", "Hey there! Ready for encrypted calls ✨"),
            ("user2", "1234", "Bob Smith", "Available for real-time messaging 🚀")
        ]:
            result = await session.execute(select(User).where(User.username == username))
            user = result.scalar_one_or_none()
            if not user:
                session.add(User(username=username, passcode=passcode, display_name=dname, bio=bio))
            else:
                if not user.display_name:
                    user.display_name = dname
                if not user.bio:
                    user.bio = bio
        await session.commit()


async def get_session() -> AsyncSession:
    async with async_session() as session:
        yield session