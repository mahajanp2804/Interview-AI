from pydantic import BaseModel, ConfigDict, field_validator
from typing import Optional, List, Any
from datetime import datetime, timezone


# ── Request Bodies ───────────────────────────────────────────────

class InterviewConfig(BaseModel):
    role: str
    level: str
    interview_type: str
    difficulty: str
    company: Optional[str] = None
    num_questions: int = 5


class GenerateQuestionsRequest(BaseModel):
    config: InterviewConfig


class EvaluateAnswerRequest(BaseModel):
    session_uid: str
    question: str
    question_type: str
    question_hint: str
    answer: str
    config: InterviewConfig
    hints_used: int = 0
    parent_question: Optional[str] = None   # set when this answers a follow-up
    parent_answer: Optional[str] = None


class GenerateFeedbackRequest(BaseModel):
    session_uid: str
    config: InterviewConfig
    qa_pairs: List[dict]   # [{q, a, eval, type}]


class HintRequest(BaseModel):
    question: str


class SaveSessionRequest(BaseModel):
    session_uid: str
    config: InterviewConfig
    qa_pairs: List[dict]
    feedback: dict
    duration_min: Optional[int] = None


# ── Response Bodies ──────────────────────────────────────────────

class QuestionItem(BaseModel):
    q: str
    type: str
    hint: str
    category: str
    followup: str


class QuestionsResponse(BaseModel):
    questions: List[QuestionItem]
    fallback: bool = False   # True when Gemini failed and the built-in bank was used


class EvalResponse(BaseModel):
    score: int
    technical: int
    communication: int
    clarity: int
    confidence: int
    problem_solving: int
    feedback: str
    strengths: List[str]
    improvements: List[str]
    followup_comment: str
    followup_question: str
    model_answer: str
    hint_penalty: int = 0


class FeedbackResponse(BaseModel):
    overall_score: int
    grade: str
    summary: str
    technical: int
    communication: int
    clarity: int
    confidence: int
    problem_solving: int
    top_strengths: List[str]
    weak_areas: List[str]
    recommendations: List[dict]
    q_feedback: List[dict]
    next_role: str


class SessionSummary(BaseModel):
    id: int
    session_uid: str
    role: str
    level: str
    interview_type: str
    difficulty: str
    company: Optional[str]
    overall_score: Optional[float]
    grade: Optional[str]
    answers_count: int
    duration_min: Optional[int]
    created_at: datetime

    @field_validator("created_at")
    @classmethod
    def _assume_utc(cls, v: datetime) -> datetime:
        # SQLite drops tzinfo; stored values are UTC
        return v if v.tzinfo else v.replace(tzinfo=timezone.utc)

    model_config = ConfigDict(from_attributes=True)


class SessionDetail(SessionSummary):
    qa_data: Optional[Any]
    feedback_data: Optional[Any]
