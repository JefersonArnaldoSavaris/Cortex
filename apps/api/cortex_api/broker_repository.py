from __future__ import annotations

from datetime import datetime

from sqlalchemy import select

from .db import session_scope
from .orm import BrokerConnectionORM


def save_broker_connection(
    *,
    user_id: str,
    login: int,
    server: str,
    encrypted_password: str,
    terminal_path: str | None,
    account: dict,
) -> None:
    now = datetime.now()
    with session_scope() as session:
        row = session.scalar(select(BrokerConnectionORM).where(BrokerConnectionORM.user_id == user_id))
        if row is None:
            row = BrokerConnectionORM(user_id=user_id, created_at=now)
            session.add(row)
        row.provider = "mt5"
        row.login = login
        row.server = server
        row.encrypted_password = encrypted_password
        row.terminal_path = terminal_path
        row.active = True
        row.connection_status = "connected"
        row.account_name = _string_or_none(account.get("name"))
        row.company = _string_or_none(account.get("company"))
        row.currency = _string_or_none(account.get("currency"))
        row.balance = _float_or_none(account.get("balance"))
        row.equity = _float_or_none(account.get("equity"))
        row.margin = _float_or_none(account.get("margin"))
        row.trade_allowed = _bool_or_none(account.get("trade_allowed"))
        row.last_connected_at = now
        row.last_error = None
        row.updated_at = now


def get_active_broker_connection(user_id: str) -> dict | None:
    with session_scope() as session:
        row = session.scalar(
            select(BrokerConnectionORM).where(
                BrokerConnectionORM.user_id == user_id,
                BrokerConnectionORM.active.is_(True),
            )
        )
        return None if row is None else _to_dict(row)


def deactivate_broker_connection(user_id: str) -> None:
    with session_scope() as session:
        row = session.scalar(select(BrokerConnectionORM).where(BrokerConnectionORM.user_id == user_id))
        if row is not None:
            row.active = False
            row.connection_status = "disconnected"
            row.updated_at = datetime.now()


def record_broker_error(user_id: str, message: str) -> None:
    with session_scope() as session:
        row = session.scalar(select(BrokerConnectionORM).where(BrokerConnectionORM.user_id == user_id))
        if row is not None:
            row.connection_status = "error"
            row.last_error = message[:2000]
            row.updated_at = datetime.now()


def _to_dict(row: BrokerConnectionORM) -> dict:
    return {
        "login": row.login,
        "server": row.server,
        "encrypted_password": row.encrypted_password,
        "terminal_path": row.terminal_path,
        "account": {
            "login": row.login,
            "server": row.server,
            "name": row.account_name,
            "company": row.company,
            "currency": row.currency,
            "balance": row.balance,
            "equity": row.equity,
            "margin": row.margin,
            "trade_allowed": row.trade_allowed,
        },
    }


def _string_or_none(value) -> str | None:
    return None if value is None else str(value)


def _float_or_none(value) -> float | None:
    return None if value is None else float(value)


def _bool_or_none(value) -> bool | None:
    return None if value is None else bool(value)
