"""Restore one legacy SQLite user into the configured Cortex database."""

from __future__ import annotations

import os
import sqlite3
from datetime import datetime
from pathlib import Path

from sqlalchemy import select

from apps.api.cortex_api.auth import authenticate_user, hash_password
from apps.api.cortex_api.db import session_scope
from apps.api.cortex_api.models import LoginRequest
from apps.api.cortex_api.orm import UserORM


def _parse_datetime(value: str | None) -> datetime | None:
    return datetime.fromisoformat(value) if value else None


def main() -> None:
    email = os.environ["CORTEX_RESTORE_EMAIL"].strip().lower()
    password = os.environ["CORTEX_RESTORE_PASSWORD"]
    sqlite_path = Path(
        os.getenv("CORTEX_LEGACY_SQLITE_PATH", "cortex_app.db")
    ).resolve()

    with sqlite3.connect(sqlite_path) as legacy:
        legacy.row_factory = sqlite3.Row
        row = legacy.execute(
            """
            SELECT id, name, email, role, plan, status,
                   created_at, updated_at, last_login_at
            FROM users
            WHERE lower(email) = ?
            """,
            (email,),
        ).fetchone()

    if row is None:
        raise RuntimeError(f"Usuário legado não encontrado: {email}")

    with session_scope() as session:
        existing = session.scalar(select(UserORM).where(UserORM.email == email))
        if existing is None:
            session.add(
                UserORM(
                    id=row["id"],
                    name=row["name"],
                    email=email,
                    password_hash=hash_password(password),
                    role=row["role"],
                    plan=row["plan"],
                    status=row["status"],
                    created_at=_parse_datetime(row["created_at"]),
                    updated_at=_parse_datetime(row["updated_at"]),
                    last_login_at=_parse_datetime(row["last_login_at"]),
                )
            )
            action = "restaurado"
        else:
            existing.password_hash = hash_password(password)
            existing.name = row["name"]
            existing.role = row["role"]
            existing.plan = row["plan"]
            existing.status = row["status"]
            action = "atualizado"

    user, _ = authenticate_user(LoginRequest(email=email, password=password))
    print(f"USER={user.email}")
    print(f"ACTION={action}")
    print(f"ROLE={user.role.value}")
    print(f"PLAN={user.plan.value}")
    print(f"STATUS={user.status.value}")
    print("LOGIN_VALIDATION=ok")


if __name__ == "__main__":
    main()
