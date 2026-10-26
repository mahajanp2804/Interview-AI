import asyncio
from fastapi import APIRouter

from app import ai_service
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


@router.post("/evaluate", response_model=EvalResponse)
async def evaluate(body: EvaluateAnswerRequest):
    cfg = body.config
    result = await asyncio.to_thread(
        ai_service.evaluate_answer,
        body.question,
        body.question_type,
        body.answer,
        cfg.level,
        cfg.role,
    )
    return EvalResponse(**result)


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
