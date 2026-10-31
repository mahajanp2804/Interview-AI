import json
from datetime import date

from app import ai_service
from app.ai_service import AIServiceError
from app.routers.sessions import day_streak

CONFIG = {"role": "Software Engineer", "level": "Junior (1-2 yrs)", "interview_type": "Mixed",
          "difficulty": "Easy", "num_questions": 3}


def _save(client, uid, score=70, grade="B+", qa_pairs=None):
    qa_pairs = qa_pairs if qa_pairs is not None else [{"q": "Q1", "a": "an answer"}, {"q": "Q2", "a": "[SKIPPED]"}]
    return client.post("/api/sessions/save", json={
        "session_uid": uid, "config": CONFIG, "qa_pairs": qa_pairs,
        "feedback": {"overall_score": score, "grade": grade}, "duration_min": 4,
    })


# ── Interview endpoints ──────────────────────────────────────────

def test_questions_endpoint_reports_fallback(client, monkeypatch):
    q = {"q": "Q?", "type": "technical", "hint": "h", "category": "c", "followup": "f"}
    monkeypatch.setattr(ai_service, "generate_questions", lambda *args: ([q], True))
    r = client.post("/api/interview/questions", json={"config": CONFIG})
    assert r.status_code == 200
    assert r.json() == {"questions": [q], "fallback": True}


EVAL_REQUEST = {"session_uid": "u", "question": "Q", "question_type": "technical", "question_hint": "h",
                "answer": "A", "config": CONFIG}


def _events(response):
    """Parse a server-sent-events body into [(event, data), ...]."""
    events = []
    for block in response.text.strip().split("\n\n"):
        name, data = block.split("\n")
        events.append((name.removeprefix("event: "), json.loads(data.removeprefix("data: "))))
    return events


def test_evaluate_streams_deltas_then_result(client, monkeypatch):
    result = {"score": 70, "technical": 70, "communication": 70, "clarity": 70, "confidence": 70,
              "problem_solving": 70, "feedback": "Good work", "strengths": [], "improvements": [],
              "followup_comment": "Next.", "followup_question": "Why?", "model_answer": "Key points."}

    def fake_stream(*args, **kwargs):
        assert kwargs == {"hints_used": 1, "parent_question": "Parent?", "parent_answer": "Earlier"}
        yield "delta", "Good "
        yield "delta", "work"
        yield "result", result

    monkeypatch.setattr(ai_service, "stream_evaluation", fake_stream)
    r = client.post("/api/interview/evaluate", json={
        **EVAL_REQUEST, "hints_used": 1, "parent_question": "Parent?", "parent_answer": "Earlier",
    })
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/event-stream")
    assert _events(r) == [("delta", "Good "), ("delta", "work"), ("result", {**result, "hint_penalty": 0})]


def test_ai_failure_is_sent_as_error_event(client, monkeypatch):
    def fail(*args, **kwargs):
        yield "delta", "Par"
        raise AIServiceError("Gemini rate limit reached. Wait a minute and try again.")

    monkeypatch.setattr(ai_service, "stream_evaluation", fail)
    r = client.post("/api/interview/evaluate", json=EVAL_REQUEST)
    assert _events(r) == [
        ("delta", "Par"),
        ("error", {"detail": "Gemini rate limit reached. Wait a minute and try again."}),
    ]


def test_hint_failure_returns_503(client, monkeypatch):
    monkeypatch.setattr(ai_service, "generate_hint", lambda q: (_ for _ in ()).throw(AIServiceError("down")))
    r = client.post("/api/interview/hint", json={"question": "Q"})
    assert r.status_code == 503


# ── Sessions ─────────────────────────────────────────────────────

def test_save_counts_only_answered_questions_and_lists_with_utc_time(client):
    assert _save(client, "s1").status_code == 200
    [row] = client.get("/api/sessions/").json()
    assert row["session_uid"] == "s1"
    assert row["answers_count"] == 1
    assert row["overall_score"] == 70
    assert row["created_at"].endswith("Z")


def test_saving_same_uid_updates_instead_of_duplicating(client):
    _save(client, "s1", score=50, grade="C")
    _save(client, "s1", score=82, grade="A")
    rows = client.get("/api/sessions/").json()
    assert len(rows) == 1
    assert rows[0]["overall_score"] == 82
    assert rows[0]["grade"] == "A"


def test_get_and_delete_session(client):
    _save(client, "s1")
    detail = client.get("/api/sessions/s1").json()
    assert detail["feedback_data"] == {"overall_score": 70, "grade": "B+"}
    assert len(detail["qa_data"]) == 2

    assert client.delete("/api/sessions/s1").status_code == 200
    assert client.get("/api/sessions/s1").status_code == 404
    assert client.delete("/api/sessions/s1").status_code == 404


def test_stats_summary(client):
    assert client.get("/api/sessions/stats/summary").json() == {
        "total_sessions": 0, "avg_score": None, "best_score": None, "streak": 0,
    }
    _save(client, "s1", score=60)
    _save(client, "s2", score=91)
    stats = client.get("/api/sessions/stats/summary").json()
    assert stats == {"total_sessions": 2, "avg_score": 76, "best_score": 91, "streak": 1}


def test_day_streak():
    today = date(2026, 10, 28)
    assert day_streak(set(), today) == 0
    assert day_streak({date(2026, 10, 27)}, today) == 0          # nothing today
    assert day_streak({date(2026, 10, 28), date(2026, 10, 27), date(2026, 10, 26)}, today) == 3
    assert day_streak({date(2026, 10, 28), date(2026, 10, 26)}, today) == 1   # gap breaks it
    assert day_streak({date(2026, 3, 1), date(2026, 2, 28)}, date(2026, 3, 1)) == 2  # month boundary
