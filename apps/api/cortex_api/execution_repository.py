from __future__ import annotations

import json

from sqlalchemy import select

from .db import session_scope
from .orm import ExecutedOpportunityORM


def save_execution_context(
    user_id: str,
    position_ticket: int,
    symbol: str,
    direction: str,
    technical_reasons: list[str],
    risk_reasons: list[str],
    analysis_generated_at: str | None,
) -> None:
    with session_scope() as session:
        existing = session.scalar(
            select(ExecutedOpportunityORM).where(
                ExecutedOpportunityORM.user_id == user_id,
                ExecutedOpportunityORM.position_ticket == position_ticket,
            )
        )
        values = {
            "symbol": symbol,
            "direction": direction,
            "technical_reasons_json": json.dumps(technical_reasons, ensure_ascii=False),
            "risk_reasons_json": json.dumps(risk_reasons, ensure_ascii=False),
            "analysis_generated_at": analysis_generated_at,
        }
        if existing is None:
            session.add(ExecutedOpportunityORM(
                user_id=user_id,
                position_ticket=position_ticket,
                **values,
            ))
        else:
            for key, value in values.items():
                setattr(existing, key, value)


def execution_contexts_by_ticket(user_id: str, tickets: list[int]) -> dict[int, dict]:
    if not tickets:
        return {}
    with session_scope() as session:
        rows = session.scalars(
            select(ExecutedOpportunityORM).where(
                ExecutedOpportunityORM.user_id == user_id,
                ExecutedOpportunityORM.position_ticket.in_(tickets),
            )
        ).all()
        return {
            row.position_ticket: {
                "technical_reasons": json.loads(row.technical_reasons_json or "[]"),
                "risk_reasons": json.loads(row.risk_reasons_json or "[]"),
                "analysis_generated_at": row.analysis_generated_at,
            }
            for row in rows
        }
