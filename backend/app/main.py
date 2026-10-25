import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.ai_service import AIServiceError
from app.database import init_db
from app.config import settings
from app.routers import interview, sessions

logging.basicConfig(level=logging.INFO, format="%(levelname)s [%(name)s] %(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title="InterviewAI Simulator API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(AIServiceError)
async def ai_service_error(request: Request, exc: AIServiceError):
    return JSONResponse(status_code=503, content={"detail": str(exc)})


app.include_router(interview.router, prefix="/api")
app.include_router(sessions.router, prefix="/api")


@app.get("/")
async def root():
    return {"status": "ok", "service": "InterviewAI Simulator API"}


@app.get("/health")
async def health():
    return {"status": "healthy"}
