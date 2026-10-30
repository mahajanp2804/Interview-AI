import asyncio
import json

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app import ai_service
from app.ai_service import AIServiceError
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


@router.post("/questions", response_model=QuestionsResponse)
async def create_questions(body: GenerateQuestionsRequest):
    cfg = body.config
    questions, fallback = await asyncio.to_thread(
        ai_service.generate_questions,
        cfg.role,
        cfg.level,
        cfg.interview_type,
        cfg.difficulty,
        cfg.company,
        cfg.num_questions,
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
