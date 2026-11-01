from collections import defaultdict
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import SessionRecord, get_db
from app.schemas import SaveSessionRequest, SessionSummary, SessionDetail

router = APIRouter(prefix="/sessions", tags=["sessions"])


def _to_summary(row: SessionRecord) -> SessionSummary:
    return SessionSummary(
        id=row.id,
        session_uid=row.session_uid,
        role=row.role,
        level=row.level,
        interview_type=row.interview_type,
        difficulty=row.difficulty,
        company=row.company,
        num_questions=row.num_questions,
        overall_score=row.overall_score,
        grade=row.grade,
        answers_count=row.answers_count,
        duration_min=row.duration_min,
        created_at=row.created_at,
    )


@router.post("/save")
async def save_session(body: SaveSessionRequest, db: AsyncSession = Depends(get_db)):
    cfg = body.config
    fb = body.feedback
    answered = [qa for qa in body.qa_pairs if qa.get("a") and qa["a"] != "[SKIPPED]"]

    result = await db.execute(
        select(SessionRecord).where(SessionRecord.session_uid == body.session_uid)
    )
    row = result.scalar_one_or_none()

    if row is None:
        row = SessionRecord(
            session_uid=body.session_uid,
            role=cfg.role,
            level=cfg.level,
            interview_type=cfg.interview_type,
            difficulty=cfg.difficulty,
            company=cfg.company,
            num_questions=cfg.num_questions,
        )
        db.add(row)

    row.overall_score = float(fb.get("overall_score", 0))
    row.grade = fb.get("grade")
    row.duration_min = body.duration_min
    row.answers_count = len(answered)
    row.qa_data = body.qa_pairs
    row.feedback_data = body.feedback

    await db.commit()
    await db.refresh(row)
    return {"ok": True, "session_uid": row.session_uid, "id": row.id}


@router.get("/", response_model=list[SessionSummary])
async def list_sessions(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(SessionRecord).order_by(SessionRecord.created_at.desc())
    )
    rows = result.scalars().all()
    return [_to_summary(r) for r in rows]


@router.get("/stats/summary")
async def session_stats(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SessionRecord))
    rows = result.scalars().all()

    if not rows:
        return {
            "total_sessions": 0,
            "avg_score": None,
            "best_score": None,
            "streak": 0,
        }

    scores = [r.overall_score for r in rows if r.overall_score is not None]
    avg_score = round(sum(scores) / len(scores)) if scores else None
    best_score = round(max(scores)) if scores else None

    return {
        "total_sessions": len(rows),
        "avg_score": avg_score,
        "best_score": best_score,
        "streak": day_streak(
            {r.created_at.date() for r in rows if r.created_at},
            datetime.now(timezone.utc).date(),
        ),
    }


METRICS = ("technical", "communication", "clarity", "confidence", "problem_solving")
TREND_SESSIONS = 30
METRIC_SESSIONS = 10   # skill averages reflect recent form, not all history
WEAK_CATEGORIES = 5


@router.get("/stats/progress")
async def session_progress(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SessionRecord).order_by(SessionRecord.created_at))
    rows = result.scalars().all()

    if not rows:
        return {"trend": [], "metrics": {}, "weak_categories": [], "last_config": None}

    metrics = {}
    for metric in METRICS:
        values = [r.feedback_data[metric] for r in rows[-METRIC_SESSIONS:]
                  if r.feedback_data and r.feedback_data.get(metric) is not None]
        if values:
            metrics[metric] = round(sum(values) / len(values))

    return {
        "trend": [
            {
                "session_uid": r.session_uid,
                "date": r.created_at.replace(tzinfo=timezone.utc).isoformat(),
                "score": round(r.overall_score),
                "role": r.role,
            }
            for r in rows[-TREND_SESSIONS:] if r.overall_score is not None
        ],
        "metrics": metrics,
        "weak_categories": weak_categories(rows),
        "last_config": {"role": rows[-1].role, "level": rows[-1].level, "difficulty": rows[-1].difficulty},
    }


def weak_categories(rows: list[SessionRecord]) -> list[dict]:
    """Lowest-scoring question categories across answered questions."""
    scores = defaultdict(list)
    for row in rows:
        for qa in row.qa_data or []:
            score = (qa.get("eval") or {}).get("score")
            if qa.get("category") and qa.get("a") != "[SKIPPED]" and score is not None:
                scores[qa["category"]].append(score)

    categories = [
        {"category": name, "avg_score": round(sum(values) / len(values)), "count": len(values)}
        for name, values in scores.items()
    ]
    return sorted(categories, key=lambda c: c["avg_score"])[:WEAK_CATEGORIES]


def day_streak(days_with_sessions: set[date], today: date) -> int:
    """Consecutive calendar days (UTC) with at least one session, ending today."""
    streak = 0
    day = today
    while day in days_with_sessions:
        streak += 1
        day -= timedelta(days=1)
    return streak


@router.get("/{session_uid}", response_model=SessionDetail)
async def get_session(session_uid: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(SessionRecord).where(SessionRecord.session_uid == session_uid)
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return SessionDetail(
        **_to_summary(row).model_dump(),
        qa_data=row.qa_data,
        feedback_data=row.feedback_data,
    )


@router.delete("/{session_uid}")
async def delete_session(session_uid: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        delete(SessionRecord).where(SessionRecord.session_uid == session_uid)
    )
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Session not found")
    await db.commit()
    return {"ok": True}
