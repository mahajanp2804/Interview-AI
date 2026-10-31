import asyncio
import json

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import ai_service, resume
from app.ai_service import AIServiceError
from app.database import SessionRecord, get_db
from app.schemas import (
    GenerateQuestionsRequest,
    EvaluateAnswerRequest,
    GenerateFeedbackRequest,
    HintRequest,
    QuestionsResponse,
    EvalResponse,
    FeedbackResponse,
)

router = APIRouter(prefix="/interview", tags=["interview"])


RECENT_SESSIONS = 10   # how far back to look for questions not to repeat


async def _recent_questions(db: AsyncSession, role: str) -> list[str]:
    result = await db.execute(
        select(SessionRecord.qa_data)
        .where(SessionRecord.role == role)
        .order_by(SessionRecord.created_at.desc())
        .limit(RECENT_SESSIONS)
    )
    return [qa["q"] for qa_data in result.scalars() for qa in qa_data or [] if qa.get("q")]


@router.post("/resume")
def upload_resume(file: UploadFile = File(...)):
    """Extract a PDF resume's text. The file isn't kept."""
    try:
        text, truncated = resume.extract_text(file.file.read(resume.MAX_BYTES + 1))
    except resume.ResumeError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    return {"text": text, "truncated": truncated}


@router.post("/questions", response_model=QuestionsResponse)
async def create_questions(body: GenerateQuestionsRequest, db: AsyncSession = Depends(get_db)):
    cfg = body.config
    seen = await _recent_questions(db, cfg.role)
    questions, fallback = await asyncio.to_thread(
        ai_service.generate_questions,
        cfg.role,
        cfg.level,
        cfg.interview_type,
        cfg.difficulty,
        cfg.company,
        cfg.num_questions,
        resume_text=body.resume_text,
        job_description=body.job_description,
        focus_areas=body.focus_areas,
        seen=seen,
    )
    return QuestionsResponse(questions=questions, fallback=fallback)


def _sse(event: str, data) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


@router.post("/evaluate")
def evaluate(body: EvaluateAnswerRequest):
    """Server-sent events: `delta` (next piece of the feedback text), then `result` or `error`."""
    cfg = body.config

    def events():
        try:
            for kind, payload in ai_service.stream_evaluation(
                body.question,
                body.question_type,
                body.answer,
                cfg.level,
                cfg.role,
                hints_used=body.hints_used,
                parent_question=body.parent_question,
                parent_answer=body.parent_answer,
            ):
                if kind == "result":
                    payload = EvalResponse(**payload).model_dump()
                yield _sse(kind, payload)
        except AIServiceError as e:
            yield _sse("error", {"detail": str(e)})

    return StreamingResponse(events(), media_type="text/event-stream")


@router.post("/feedback", response_model=FeedbackResponse)
async def feedback(body: GenerateFeedbackRequest):
    cfg = body.config
    result = await asyncio.to_thread(
        ai_service.generate_feedback,
        cfg.role,
        cfg.level,
        cfg.model_dump(),
        body.qa_pairs,
    )
    return FeedbackResponse(**result)


@router.post("/hint")
async def hint(body: HintRequest):
    text = await asyncio.to_thread(ai_service.generate_hint, body.question)
    return {"hint": text}
