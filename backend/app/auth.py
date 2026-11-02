"""
auth.py
Email + password accounts. Passwords are hashed with Argon2. Signing in sets an
httpOnly cookie holding a random token; only its SHA-256 hash is stored, so a
leaked database can't be used to sign in, and signing out really ends the session.
"""
import asyncio
import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from fastapi import HTTPException, Request, Response
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import AsyncSessionLocal, AuthToken, User

COOKIE_NAME = "iai_session"
SESSION_LIFETIME = timedelta(days=30)

_hasher = PasswordHasher()
# Verified when the email is unknown, so response time doesn't reveal which emails exist
_DUMMY_HASH = _hasher.hash("not-a-real-password")


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


async def hash_password(password: str) -> str:
    return await asyncio.to_thread(_hasher.hash, password)


async def verify_password(password: str, password_hash: str | None) -> bool:
    try:
        await asyncio.to_thread(_hasher.verify, password_hash or _DUMMY_HASH, password)
    except (VerificationError, InvalidHashError):
        return False
    return password_hash is not None


async def start_session(db: AsyncSession, user: User, response: Response) -> None:
    now = datetime.now(timezone.utc)
    token = secrets.token_urlsafe(32)
    await db.execute(delete(AuthToken).where(AuthToken.user_id == user.id, AuthToken.expires_at <= now))
    db.add(AuthToken(token_hash=_token_hash(token), user_id=user.id, expires_at=now + SESSION_LIFETIME))
    await db.commit()
    response.set_cookie(
        COOKIE_NAME, token,
        max_age=int(SESSION_LIFETIME.total_seconds()),
        httponly=True, samesite="lax", secure=settings.cookie_secure,
    )


async def end_session(db: AsyncSession, request: Request, response: Response) -> None:
    token = request.cookies.get(COOKIE_NAME)
    if token:
        await db.execute(delete(AuthToken).where(AuthToken.token_hash == _token_hash(token)))
        await db.commit()
    response.delete_cookie(COOKIE_NAME)


async def current_user(request: Request) -> User:
    """Dependency for routes that need a signed-in user."""
    token = request.cookies.get(COOKIE_NAME)
    if token:
        # Own short-lived connection: streaming responses shouldn't hold one open
        async with AsyncSessionLocal() as db:
            user = await db.scalar(
                select(User).join(AuthToken).where(
                    AuthToken.token_hash == _token_hash(token),
                    AuthToken.expires_at > datetime.now(timezone.utc),
                )
            )
        if user:
            return user
    raise HTTPException(status_code=401, detail="Please sign in.")
