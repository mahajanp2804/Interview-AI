"""Rate limits. Counters live in memory, so they're per process: fine for one backend instance."""
import hashlib

from fastapi import Request
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.auth import COOKIE_NAME
from app.config import settings


def per_user(request: Request) -> str:
    token = request.cookies.get(COOKIE_NAME)
    return hashlib.sha256(token.encode()).hexdigest() if token else get_remote_address(request)


limiter = Limiter(key_func=per_user, enabled=settings.rate_limits_enabled)


def rate_limit_exceeded(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    return JSONResponse(status_code=429, content={"detail": "Too many requests. Wait a minute and try again."})
