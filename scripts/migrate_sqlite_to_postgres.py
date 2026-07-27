from __future__ import annotations

import argparse
import os
from pathlib import Path
import sys

from sqlalchemy import MetaData, create_engine, func, select, text
from sqlalchemy.dialects.postgresql import insert as postgres_insert

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from apps.api.cortex_api.orm import Base


TABLE_ORDER = ("users", "analyses", "broker_connections", "analysis_events")
SEQUENCE_TABLES = ("broker_connections", "analysis_events")


def normalize_postgres_url(url: str) -> str:
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+psycopg://", 1)
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+psycopg://", 1)
    return url


def migrate(source_path: Path, target_url: str, *, dry_run: bool = False) -> dict[str, tuple[int, int]]:
    if not source_path.exists():
        raise FileNotFoundError(f"SQLite source not found: {source_path}")

    source_engine = create_engine(f"sqlite:///{source_path.resolve()}", future=True)
    target_engine = create_engine(
        normalize_postgres_url(target_url),
        future=True,
        pool_pre_ping=True,
        connect_args={"prepare_threshold": None},
    )

    Base.metadata.create_all(target_engine)
    source_metadata = MetaData()
    source_metadata.reflect(source_engine, only=list(TABLE_ORDER))
    target_metadata = MetaData()
    target_metadata.reflect(target_engine, only=list(TABLE_ORDER))

    source_rows: dict[str, list[dict]] = {}
    with source_engine.connect() as connection:
        for table_name in TABLE_ORDER:
            table = source_metadata.tables[table_name]
            source_rows[table_name] = [dict(row) for row in connection.execute(select(table)).mappings()]

    if dry_run:
        return {name: (len(rows), 0) for name, rows in source_rows.items()}

    with target_engine.begin() as connection:
        for table_name in TABLE_ORDER:
            rows = source_rows[table_name]
            if not rows:
                continue
            statement = postgres_insert(target_metadata.tables[table_name]).values(rows).on_conflict_do_nothing()
            connection.execute(statement)

        for table_name in SEQUENCE_TABLES:
            connection.execute(
                text(
                    f"SELECT setval(pg_get_serial_sequence('{table_name}', 'id'), "
                    f"COALESCE((SELECT MAX(id) FROM {table_name}), 1), true)"
                )
            )

    result: dict[str, tuple[int, int]] = {}
    with target_engine.connect() as connection:
        for table_name in TABLE_ORDER:
            target_count = connection.scalar(select(func.count()).select_from(target_metadata.tables[table_name])) or 0
            result[table_name] = (len(source_rows[table_name]), int(target_count))
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description="Migrate Cortex SQLite data to Supabase/PostgreSQL.")
    parser.add_argument("--source", default="cortex_app.db", type=Path)
    parser.add_argument("--target-url", default=os.getenv("CORTEX_SUPABASE_DATABASE_URL"))
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    if not args.target_url and not args.dry_run:
        parser.error("Provide --target-url or CORTEX_SUPABASE_DATABASE_URL.")

    if args.dry_run and not args.target_url:
        source_engine = create_engine(f"sqlite:///{args.source.resolve()}", future=True)
        metadata = MetaData()
        metadata.reflect(source_engine, only=list(TABLE_ORDER))
        with source_engine.connect() as connection:
            for table_name in TABLE_ORDER:
                count = connection.scalar(select(func.count()).select_from(metadata.tables[table_name])) or 0
                print(f"{table_name}: source={count}")
        return

    results = migrate(args.source, args.target_url, dry_run=args.dry_run)
    for table_name, (source_count, target_count) in results.items():
        state = "OK" if target_count >= source_count else "MISMATCH"
        print(f"{table_name}: source={source_count} target={target_count} {state}")


if __name__ == "__main__":
    main()
