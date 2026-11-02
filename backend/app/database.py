from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, mapped_column, Mapped
from sqlalchemy import ForeignKey, Integer, String, Float, DateTime, JSON
from sqlalchemy.pool import NullPool
from datetime import datetime, timezone
from app.config import settings


engine = create_async_engine(
    settings.database_url, echo=False, **({"poolclass": NullPool} if settings.db_null_pool else {}),
)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id:            Mapped[int]      = mapped_column(Integer, primary_key=True)
    email:         Mapped[str]      = mapped_column(String(254), unique=True, index=True)
    password_hash: Mapped[str]      = mapped_column(String(255))
    created_at:    Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class AuthToken(Base):
    __tablename__ = "auth_tokens"

    token_hash: Mapped[str]      = mapped_column(String(64), primary_key=True)   # SHA-256 of the cookie value
    user_id:    Mapped[int]      = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class SessionRecord(Base):
    __tablename__ = "sessions"

    id:          Mapped[int]      = mapped_column(Integer, primary_key=True, index=True)
    session_uid: Mapped[str]      = mapped_column(String(64), unique=True, index=True)
    # Null only for sessions saved before accounts existed
    user_id:     Mapped[int]      = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    role:        Mapped[str]      = mapped_column(String(100))
    level:       Mapped[str]      = mapped_column(String(50))
    interview_type: Mapped[str]   = mapped_column(String(50))
    difficulty:  Mapped[str]      = mapped_column(String(20))
    company:     Mapped[str]      = mapped_column(String(100), nullable=True)
    num_questions: Mapped[int]    = mapped_column(Integer)
    overall_score: Mapped[float]  = mapped_column(Float, nullable=True)
    grade:       Mapped[str]      = mapped_column(String(5), nullable=True)
    duration_min: Mapped[int]     = mapped_column(Integer, nullable=True)
    answers_count: Mapped[int]    = mapped_column(Integer, default=0)
    qa_data:     Mapped[dict]     = mapped_column(JSON, nullable=True)   # full Q&A + evals
    feedback_data: Mapped[dict]   = mapped_column(JSON, nullable=True)   # full feedback report
    created_at:  Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
