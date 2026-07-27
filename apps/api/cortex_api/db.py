from __future__ import annotations

import os
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

load_dotenv()


def _normalize_sqlite_url(database_url: str) -> str:
    prefix = "sqlite:///"
    if not database_url.startswith(prefix):
        return database_url

    raw_path = database_url[len(prefix) :]
    if raw_path.startswith("/"):
        return database_url

    repo_root = Path(__file__).resolve().parents[3]
    absolute_path = (repo_root / raw_path).resolve()
    return f"{prefix}{absolute_path}"


def _normalize_database_url(database_url: str) -> str:
    normalized = _normalize_sqlite_url(database_url)
    if normalized.startswith("postgres://"):
        return normalized.replace("postgres://", "postgresql+psycopg://", 1)
    if normalized.startswith("postgresql://"):
        return normalized.replace("postgresql://", "postgresql+psycopg://", 1)
    return normalized


DATABASE_URL = _normalize_database_url(
    os.getenv("CORTEX_DATABASE_URL")
    or os.getenv("DATABASE_URL")
    or "sqlite:///./cortex_app.db"
)

ENGINE_KWARGS = {"future": True}
if DATABASE_URL.startswith("sqlite"):
    ENGINE_KWARGS["connect_args"] = {"check_same_thread": False}
else:
    ENGINE_KWARGS.update(
        {
            "pool_pre_ping": True,
            "pool_size": int(os.getenv("CORTEX_DB_POOL_SIZE", "5")),
            "max_overflow": int(os.getenv("CORTEX_DB_MAX_OVERFLOW", "5")),
            "pool_recycle": int(os.getenv("CORTEX_DB_POOL_RECYCLE_SECONDS", "300")),
            "connect_args": {
                "prepare_threshold": None,
                "options": "-csearch_path=cortex,public",
            },
        }
    )

engine = create_engine(DATABASE_URL, **ENGINE_KWARGS)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False, class_=Session)


@contextmanager
def session_scope() -> Iterator[Session]:
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
