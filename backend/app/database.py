from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, mapped_column, Mapped
from sqlalchemy import Integer, String, Float, DateTime, Text, JSON
from datetime import datetime
from app.config import settings


engine = create_async_engine(settings.database_url, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


class SessionRecord(Base):
    __tablename__ = "sessions"

    id:          Mapped[int]      = mapped_column(Integer, primary_key=True, index=True)
    session_uid: Mapped[str]      = mapped_column(String(64), unique=True, index=True)
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
    created_at:  Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
