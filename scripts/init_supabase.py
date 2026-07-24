"""Initialize and verify the Cortex schema in the configured PostgreSQL database."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import text

from apps.api.cortex_api.db import engine
from apps.api.cortex_api.repository import init_db


def main() -> None:
    if engine.dialect.name != "postgresql":
        raise RuntimeError("CORTEX_DATABASE_URL não aponta para um banco PostgreSQL.")

    init_db()

    with engine.connect() as connection:
        tables = connection.execute(
            text(
                """
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'cortex'
                ORDER BY table_name
                """
            )
        ).scalars().all()

        print("SCHEMA=cortex")
        print(f"TABLES={','.join(tables)}")
        for table_name in tables:
            count = connection.execute(
                text(f'SELECT COUNT(*) FROM cortex."{table_name}"')
            ).scalar_one()
            print(f"{table_name}_COUNT={count}")

        connection.commit()
        transaction = connection.begin()
        try:
            connection.execute(
                text(
                    """
                    INSERT INTO cortex.usuarios (
                        id, name, email, password_hash, role, plan, status,
                        created_at, updated_at
                    ) VALUES (
                        :id, :name, :email, :password_hash, :role, :plan,
                        :status, :created_at, :updated_at
                    )
                    """
                ),
                {
                    "id": "__cortex_write_probe__",
                    "name": "Validação Cortex",
                    "email": "__probe__@cortex.local",
                    "password_hash": "probe",
                    "role": "user",
                    "plan": "free",
                    "status": "inactive",
                    "created_at": datetime.now(),
                    "updated_at": datetime.now(),
                },
            )
            persisted = connection.execute(
                text(
                    "SELECT COUNT(*) FROM cortex.usuarios "
                    "WHERE id = '__cortex_write_probe__'"
                )
            ).scalar_one()
            if persisted != 1:
                raise RuntimeError("A validação de escrita não foi persistida na transação.")
            print("WRITE_PROBE=ok")
        finally:
            transaction.rollback()


if __name__ == "__main__":
    main()
