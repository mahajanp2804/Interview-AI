import logging
import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded

from app.ai_service import AIServiceError
from app.config import settings
from app.limits import limiter, rate_limit_exceeded
from app.logs import setup_logging
from app.resume import MAX_BYTES as MAX_RESUME_BYTES
from app.routers import auth, interview, sessions

setup_logging()
logger = logging.getLogger("app.requests")

MAX_BODY_BYTES = 2 * 1024 * 1024
UPLOAD_OVERHEAD = 64 * 1024   # multipart boundaries and headers around the file

app = FastAPI(
    title="InterviewAI Simulator API",
    version="1.0.0",
)
app.state.limiter = limiter

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def limit_and_log(request: Request, call_next):
    path = request.url.path
    limit = MAX_RESUME_BYTES + UPLOAD_OVERHEAD if path == "/api/interview/resume" else MAX_BODY_BYTES
    length = request.headers.get("content-length", "0")
    if length.isdigit() and int(length) > limit:
        return JSONResponse(status_code=413, content={"detail": "That request is too large."})

    started = time.perf_counter()
    response = await call_next(request)
    if path != "/health":
        logger.info("request", extra={"fields": {
            "method": request.method,
            "path": path,
            "status": response.status_code,
            "duration_ms": round((time.perf_counter() - started) * 1000),
        }})
    return response


@app.exception_handler(AIServiceError)
async def ai_service_error(request: Request, exc: AIServiceError):
    return JSONResponse(status_code=503, content={"detail": str(exc)})


app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded)

app.include_router(auth.router, prefix="/api")
app.include_router(interview.router, prefix="/api")
app.include_router(sessions.router, prefix="/api")


@app.get("/")
async def root():
    return {"status": "ok", "service": "InterviewAI Simulator API"}


@app.get("/health")
async def health():
    return {"status": "healthy"}
