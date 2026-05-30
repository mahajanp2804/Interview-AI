from fastapi import APIRouter, HTTPException
from app.schemas import (
    GenerateQuestionsRequest, QuestionsResponse,
    EvaluateAnswerRequest, EvalResponse,
    GenerateFeedbackRequest, FeedbackResponse,
    HintRequest,
)
from app import ai_service

router = APIRouter(prefix="/interview", tags=["interview"])


@router.post("/questions", response_model=QuestionsResponse)
async def get_questions(body: GenerateQuestionsRequest):
    cfg = body.config
    questions = ai_service.generate_questions(
        role=cfg.role,
        level=cfg.level,
        interview_type=cfg.interview_type,
        difficulty=cfg.difficulty,
        company=cfg.company,
        num_questions=cfg.num_questions,
    )
    return {"questions": questions}


@router.post("/evaluate")
async def evaluate_answer(body: EvaluateAnswerRequest):
    result = ai_service.evaluate_answer(
        question=body.question,
        question_type=body.question_type,
        answer=body.answer,
        level=body.config.level,
        role=body.config.role,
    )
    return result


@router.post("/feedback")
async def get_feedback(body: GenerateFeedbackRequest):
    result = ai_service.generate_feedback(
        role=body.config.role,
        level=body.config.level,
        config=body.config.model_dump(),
        qa_pairs=body.qa_pairs,
    )
    return result


@router.post("/hint")
async def get_hint(body: HintRequest):
    hint = ai_service.generate_hint(body.question)
    return {"hint": hint}
