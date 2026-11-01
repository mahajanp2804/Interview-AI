from fastapi import APIRouter, Depends, HTTPException, Request, Response
from slowapi.util import get_remote_address
from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app import auth
from app.config import settings
from app.database import SessionRecord, User, get_db
from app.limits import limiter
from app.schemas import LoginRequest, RegisterRequest, UserResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserResponse, status_code=201)
@limiter.limit(settings.auth_rate_limit, key_func=get_remote_address)
async def register(request: Request, response: Response, body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    user = User(email=body.email.lower(), password_hash=await auth.hash_password(body.password))
    db.add(user)
    try:
        await db.flush()
    except IntegrityError as e:
        raise HTTPException(status_code=409, detail="An account with that email already exists.") from e

    # Sessions from before accounts existed belong to whoever set this install up
    if await db.scalar(select(func.count()).select_from(User)) == 1:
        await db.execute(update(SessionRecord).where(SessionRecord.user_id.is_(None)).values(user_id=user.id))

    await db.commit()
    await auth.start_session(db, user, response)
    return user


@router.post("/login", response_model=UserResponse)
@limiter.limit(settings.auth_rate_limit, key_func=get_remote_address)
async def login(request: Request, response: Response, body: LoginRequest, db: AsyncSession = Depends(get_db)):
    user = await db.scalar(select(User).where(User.email == body.email.lower()))
    if not await auth.verify_password(body.password, user.password_hash if user else None):
        raise HTTPException(status_code=401, detail="Incorrect email or password.")
    await auth.start_session(db, user, response)
    return user


@router.post("/logout", status_code=204)
async def logout(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    await auth.end_session(db, request, response)


@router.get("/me", response_model=UserResponse)
async def me(user: User = Depends(auth.current_user)):
    return user
