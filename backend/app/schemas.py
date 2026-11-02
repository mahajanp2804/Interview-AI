from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from typing import Optional, List, Any
from datetime import datetime, timezone


MAX_QUESTION = 2000
MAX_ANSWER = 20000
MAX_QA_PAIRS = 30


# ── Request Bodies ───────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(max_length=128)


class InterviewConfig(BaseModel):
    role: str
    level: str
    interview_type: str
    difficulty: str
    company: Optional[str] = None
    num_questions: int = 5


class GenerateQuestionsRequest(BaseModel):
    config: InterviewConfig
    resume_text: Optional[str] = Field(None, max_length=20000)
    job_description: Optional[str] = Field(None, max_length=10000)
    focus_areas: List[str] = Field(default_factory=list, max_length=5)


class EvaluateAnswerRequest(BaseModel):
    session_uid: str
    question: str = Field(max_length=MAX_QUESTION)
    question_type: str
    question_hint: str
    answer: str = Field(max_length=MAX_ANSWER)
    config: InterviewConfig
    hints_used: int = 0
    parent_question: Optional[str] = Field(None, max_length=MAX_QUESTION)   # set when this answers a follow-up
    parent_answer: Optional[str] = Field(None, max_length=MAX_ANSWER)


class GenerateFeedbackRequest(BaseModel):
    session_uid: str
    config: InterviewConfig
    qa_pairs: List[dict] = Field(max_length=MAX_QA_PAIRS)   # [{q, a, eval, type}]


class HintRequest(BaseModel):
    question: str = Field(max_length=MAX_QUESTION)


class SaveSessionRequest(BaseModel):
    session_uid: str
    config: InterviewConfig
    qa_pairs: List[dict] = Field(max_length=MAX_QA_PAIRS)
    feedback: dict
    duration_min: Optional[int] = None


# ── Response Bodies ──────────────────────────────────────────────

class UserResponse(BaseModel):
    id: int
    email: str

    model_config = ConfigDict(from_attributes=True)


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
    num_questions: int
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
