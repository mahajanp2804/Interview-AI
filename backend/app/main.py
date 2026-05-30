from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import init_db
from app.config import settings
from app.routers import interview, sessions


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

app.include_router(interview.router, prefix="/api")
app.include_router(sessions.router, prefix="/api")


@app.get("/")
async def root():
    return {"status": "ok", "service": "InterviewAI Simulator API"}


@app.get("/health")
async def health():
    return {"status": "healthy"}
