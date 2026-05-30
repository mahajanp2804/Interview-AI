import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.database import get_db, SessionRecord
from app.schemas import SaveSessionRequest, SessionSummary, SessionDetail

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.post("/save")
async def save_session(body: SaveSessionRequest, db: AsyncSession = Depends(get_db)):
    fb = body.feedback
    record = SessionRecord(
        session_uid=body.session_uid or str(uuid.uuid4()),
        role=body.config.role,
        level=body.config.level,
        interview_type=body.config.interview_type,
        difficulty=body.config.difficulty,
        company=body.config.company,
        num_questions=body.config.num_questions,
        overall_score=fb.get("overall_score"),
        grade=fb.get("grade"),
        duration_min=body.duration_min,
        answers_count=len([qa for qa in body.qa_pairs if qa.get("a") and qa["a"] != "[SKIPPED]"]),
        qa_data=body.qa_pairs,
        feedback_data=body.feedback,
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return {"id": record.id, "session_uid": record.session_uid}


@router.get("/", response_model=list[SessionSummary])
async def list_sessions(skip: int = 0, limit: int = 50, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(SessionRecord).order_by(desc(SessionRecord.created_at)).offset(skip).limit(limit)
    )
    return result.scalars().all()


@router.get("/{session_uid}", response_model=SessionDetail)
async def get_session(session_uid: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(SessionRecord).where(SessionRecord.session_uid == session_uid)
    )
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Session not found")
    return record


@router.delete("/{session_uid}")
async def delete_session(session_uid: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(SessionRecord).where(SessionRecord.session_uid == session_uid)
    )
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Session not found")
    await db.delete(record)
    await db.commit()
    return {"deleted": True}


@router.get("/stats/summary")
async def get_stats(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SessionRecord))
    records = result.scalars().all()
    scores = [r.overall_score for r in records if r.overall_score is not None]
    return {
        "total_sessions": len(records),
        "avg_score": round(sum(scores) / len(scores), 1) if scores else None,
        "best_score": max(scores) if scores else None,
        "streak": min(len(records), 7),
    }
