"""Runs migrations against settings.database_url (SQLite or Postgres)."""
import asyncio

from alembic import context
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import NullPool

from app.config import settings
from app.database import Base


def run(connection):
    # Batch mode lets SQLite alter tables, which it otherwise can't
    context.configure(connection=connection, target_metadata=Base.metadata, render_as_batch=True, compare_type=True)
    with context.begin_transaction():
        context.run_migrations()


async def main():
    engine = create_async_engine(settings.database_url, poolclass=NullPool)
    async with engine.begin() as connection:
        await connection.run_sync(run)
    await engine.dispose()


if context.is_offline_mode():
    raise SystemExit("Offline migrations aren't supported.")
asyncio.run(main())
