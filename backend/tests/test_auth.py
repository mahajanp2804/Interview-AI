from datetime import datetime, timedelta, timezone
import asyncio

import pytest
from alembic import command
from sqlalchemy import select, update

from app.auth import COOKIE_NAME, _token_hash
from app.database import AsyncSessionLocal, AuthToken, SessionRecord, User
from app.limits import limiter

from conftest import ALEMBIC, make_client, sign_up

CONFIG = {"role": "Software Engineer", "level": "Junior", "interview_type": "Mixed", "difficulty": "Easy", "num_questions": 3}
PASSWORD = "correct horse"


def _save(client, uid):
    return client.post("/api/sessions/save", json={
        "session_uid": uid, "config": CONFIG, "qa_pairs": [{"q": "Secret question?", "a": "an answer"}],
        "feedback": {"overall_score": 70, "grade": "B+"},
    })


def test_register_signs_you_in_with_a_protected_cookie(anon):
    r = anon.post("/api/auth/register", json={"email": "New.Person@Example.com", "password": PASSWORD})
    assert r.status_code == 201
    assert r.json()["email"] == "new.person@example.com"
    assert "password" not in r.text

    cookie = r.headers["set-cookie"]
    assert cookie.startswith(f"{COOKIE_NAME}=")
    assert "HttpOnly" in cookie
    assert "SameSite=lax" in cookie
    assert anon.get("/api/auth/me").json()["email"] == "new.person@example.com"


def test_passwords_and_tokens_are_not_stored_in_the_clear(anon):
    email = sign_up(anon)
    token = anon.cookies[COOKIE_NAME]

    async def load():
        async with AsyncSessionLocal() as db:
            user = await db.scalar(select(User).where(User.email == email))
            stored = await db.scalar(select(AuthToken).where(AuthToken.user_id == user.id))
            return user, stored

    user, stored = asyncio.run(load())
    assert user.password_hash.startswith("$argon2")
    assert PASSWORD not in user.password_hash
    assert stored.token_hash == _token_hash(token)
    assert stored.token_hash != token


def test_duplicate_email_is_rejected_whatever_the_case(anon):
    email = sign_up(anon)
    r = anon.post("/api/auth/register", json={"email": email.upper(), "password": PASSWORD})
    assert r.status_code == 409


@pytest.mark.parametrize("body", [
    {"email": "not-an-email", "password": PASSWORD},
    {"email": "a@example.com", "password": "short"},
    {"email": "a@example.com", "password": "x" * 129},
])
def test_invalid_registrations_are_rejected(anon, body):
    assert anon.post("/api/auth/register", json=body).status_code == 422


def test_login_works_and_failures_look_the_same(anon):
    email = sign_up(anon)
    anon.post("/api/auth/logout")

    wrong_password = anon.post("/api/auth/login", json={"email": email, "password": "wrong password"})
    unknown_email = anon.post("/api/auth/login", json={"email": "nobody@example.com", "password": PASSWORD})
    assert wrong_password.status_code == unknown_email.status_code == 401
    assert wrong_password.json() == unknown_email.json()

    assert anon.post("/api/auth/login", json={"email": email.upper(), "password": PASSWORD}).status_code == 200
    assert anon.get("/api/auth/me").status_code == 200


def test_logout_ends_the_session_on_the_server(anon):
    sign_up(anon)
    token = anon.cookies[COOKIE_NAME]
    assert anon.post("/api/auth/logout").status_code == 204
    assert anon.get("/api/auth/me").status_code == 401

    # The old cookie is useless even if someone kept a copy
    anon.cookies.set(COOKIE_NAME, token)
    assert anon.get("/api/auth/me").status_code == 401


def test_expired_session_is_rejected(anon):
    sign_up(anon)
    token_hash = _token_hash(anon.cookies[COOKIE_NAME])

    async def expire():
        async with AsyncSessionLocal() as db:
            await db.execute(update(AuthToken).where(AuthToken.token_hash == token_hash)
                             .values(expires_at=datetime.now(timezone.utc) - timedelta(minutes=1)))
            await db.commit()

    asyncio.run(expire())
    assert anon.get("/api/auth/me").status_code == 401


@pytest.mark.parametrize("method,path", [
    ("get", "/api/sessions/"), ("get", "/api/sessions/stats/summary"), ("get", "/api/sessions/stats/progress"),
    ("get", "/api/sessions/some-uid"), ("delete", "/api/sessions/some-uid"), ("post", "/api/sessions/save"),
    ("post", "/api/interview/questions"), ("post", "/api/interview/evaluate"), ("post", "/api/interview/feedback"),
    ("post", "/api/interview/hint"), ("post", "/api/interview/resume"),
])
def test_data_and_ai_routes_need_sign_in(anon, method, path):
    assert getattr(anon, method)(path).status_code == 401


def test_people_only_see_their_own_sessions(client):
    with make_client() as other:
        sign_up(other)
        assert _save(client, "mine").status_code == 200

        assert other.get("/api/sessions/").json() == []
        assert other.get("/api/sessions/stats/summary").json()["total_sessions"] == 0
        assert other.get("/api/sessions/stats/progress").json()["trend"] == []
        assert other.get("/api/sessions/mine").status_code == 404
        assert other.delete("/api/sessions/mine").status_code == 404
        assert _save(other, "mine").status_code == 404   # can't overwrite it either

    assert client.get("/api/sessions/mine").status_code == 200


def test_seen_questions_are_per_person(client, monkeypatch):
    from app import ai_service

    _save(client, "mine")
    seen = []

    def fake(*args, **kwargs):
        seen.append(kwargs["seen"])
        return [], False

    monkeypatch.setattr(ai_service, "generate_questions", fake)
    client.post("/api/interview/questions", json={"config": CONFIG})
    with make_client() as other:
        sign_up(other)
        other.post("/api/interview/questions", json={"config": CONFIG})

    assert seen == [["Secret question?"], []]


def test_first_account_adopts_sessions_from_before_accounts_existed(anon, monkeypatch):
    async def add_legacy():
        async with AsyncSessionLocal() as db:
            db.add(SessionRecord(session_uid="legacy", role="r", level="l", interview_type="t", difficulty="d", num_questions=1))
            await db.commit()

    async def users():
        async with AsyncSessionLocal() as db:
            return (await db.scalars(select(User))).all()

    async def wipe():
        async with AsyncSessionLocal() as db:
            for u in await db.scalars(select(User)):
                await db.delete(u)
            await db.commit()

    asyncio.run(wipe())
    asyncio.run(add_legacy())
    sign_up(anon)
    assert anon.get("/api/sessions/legacy").status_code == 200
    anon.delete("/api/sessions/legacy")

    asyncio.run(add_legacy())
    with make_client() as second:
        sign_up(second)
        assert second.get("/api/sessions/legacy").status_code == 404
    assert len(asyncio.run(users())) == 2


def test_migrations_match_the_models():
    command.check(ALEMBIC)


def test_rate_limit_blocks_repeated_sign_in_attempts(anon, monkeypatch):
    limiter.reset()
    monkeypatch.setattr(limiter, "enabled", True)
    body = {"email": "nobody@example.com", "password": "wrong password"}
    statuses = [anon.post("/api/auth/login", json=body).status_code for _ in range(12)]
    assert statuses[:10] == [401] * 10
    assert statuses[10:] == [429, 429]
    assert anon.post("/api/auth/login", json=body).json() == {"detail": "Too many requests. Wait a minute and try again."}


def test_oversized_requests_are_refused(client):
    r = client.post("/api/interview/hint", content=b"x" * (2 * 1024 * 1024 + 1),
                    headers={"Content-Type": "application/json"})
    assert r.status_code == 413


def test_answers_have_a_length_limit(client):
    r = client.post("/api/interview/evaluate", json={
        "session_uid": "u", "question": "Q", "question_type": "technical", "question_hint": "h",
        "answer": "x" * 20001, "config": CONFIG,
    })
    assert r.status_code == 422
