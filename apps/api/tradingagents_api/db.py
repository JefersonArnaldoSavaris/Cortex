from __future__ import annotations

import os
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker


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


DATABASE_URL = _normalize_sqlite_url(
    os.getenv("TRADINGAGENTS_DATABASE_URL")
    or os.getenv("DATABASE_URL")
    or "sqlite:///./tradingagents_app.db"
)

ENGINE_KWARGS = {"future": True}
if DATABASE_URL.startswith("sqlite"):
    ENGINE_KWARGS["connect_args"] = {"check_same_thread": False}

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
