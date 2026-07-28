from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy import select

from .db import session_scope
from .orm import PaperPositionORM


DEMO_CURRENCY = "USD"
DEMO_BALANCE = 10_000.0


def _profit(direction: str, entry: float, current: float, volume: float) -> float:
    movement = current - entry if direction == "BUY" else entry - current
    return round(movement * volume, 2)


def preview_order(*, symbol: str, direction: str, volume: float, stop_loss: float, take_profit: float, price: float) -> dict:
    if direction == "BUY" and not (stop_loss < price < take_profit):
        raise ValueError("Na compra demo, o stop deve ficar abaixo da entrada e o alvo acima.")
    if direction == "SELL" and not (take_profit < price < stop_loss):
        raise ValueError("Na venda demo, o alvo deve ficar abaixo da entrada e o stop acima.")
    return {
        "symbol": symbol,
        "direction": direction,
        "volume": volume,
        "requested_volume": volume,
        "entry_price": price,
        "stop_loss": stop_loss,
        "take_profit": take_profit,
        "estimated_loss": round(abs(price - stop_loss) * volume, 2),
        "estimated_profit": round(abs(take_profit - price) * volume, 2),
        "estimated_margin": round(price * volume * 0.1, 2),
        "currency": DEMO_CURRENCY,
        "volume_min": 0.0001,
        "volume_max": 1_000_000,
        "volume_step": 0.0001,
        "execution_enabled": True,
        "check_message": "Ordem validada na conta demo Cortex.",
        "order_kind": "market",
        "pending_type": None,
    }


def execute_order(user_id: str, *, symbol: str, direction: str, volume: float, stop_loss: float, take_profit: float, price: float) -> dict:
    preview_order(
        symbol=symbol, direction=direction, volume=volume,
        stop_loss=stop_loss, take_profit=take_profit, price=price,
    )
    with session_scope() as session:
        row = PaperPositionORM(
            user_id=user_id,
            symbol=symbol.upper(),
            direction=direction,
            volume=volume,
            entry_price=price,
            stop_loss=stop_loss,
            take_profit=take_profit,
        )
        session.add(row)
        session.flush()
        return {
            "order_ticket": row.id,
            "deal_ticket": row.id,
            "retcode": 10009,
            "message": "Operação aberta na conta demo Cortex.",
            "executed_price": price,
            "volume": volume,
            "position_ticket": row.id,
        }


def list_open(user_id: str, prices: dict[str, float]) -> list[dict]:
    with session_scope() as session:
        rows = session.scalars(
            select(PaperPositionORM)
            .where(PaperPositionORM.user_id == user_id, PaperPositionORM.status == "open")
            .order_by(PaperPositionORM.opened_at.desc())
        ).all()
        return [
            {
                "status": "open",
                "symbol": row.symbol,
                "position_ticket": row.id,
                "direction": row.direction,
                "volume": row.volume,
                "entry_price": row.entry_price,
                "current_price": prices.get(row.symbol, row.entry_price),
                "stop_loss": row.stop_loss,
                "take_profit": row.take_profit,
                "profit": _profit(row.direction, row.entry_price, prices.get(row.symbol, row.entry_price), row.volume),
                "swap": 0,
                "currency": DEMO_CURRENCY,
                "account_balance": DEMO_BALANCE,
                "account_equity": DEMO_BALANCE,
                "opened_at": row.opened_at,
            }
            for row in rows
        ]


def close_position(user_id: str, position_ticket: int, price: float) -> dict:
    with session_scope() as session:
        row = session.get(PaperPositionORM, position_ticket)
        if row is None or row.user_id != user_id or row.status != "open":
            raise ValueError("Posição demo não encontrada ou já encerrada.")
        row.exit_price = price
        row.profit = _profit(row.direction, row.entry_price, price, row.volume)
        row.status = "closed"
        row.closed_at = datetime.now()
        return {
            "order_ticket": row.id,
            "deal_ticket": row.id,
            "retcode": 10009,
            "message": "Operação demo encerrada.",
            "executed_price": price,
            "volume": row.volume,
            "position_ticket": row.id,
        }


def get_position(user_id: str, position_ticket: int) -> PaperPositionORM | None:
    with session_scope() as session:
        row = session.get(PaperPositionORM, position_ticket)
        if row is None or row.user_id != user_id:
            return None
        session.expunge(row)
        return row


def history(user_id: str, days: int, limit: int, prices: dict[str, float]) -> list[dict]:
    cutoff = datetime.now() - timedelta(days=days)
    with session_scope() as session:
        rows = session.scalars(
            select(PaperPositionORM)
            .where(PaperPositionORM.user_id == user_id, PaperPositionORM.opened_at >= cutoff)
            .order_by(PaperPositionORM.opened_at.desc())
            .limit(limit)
        ).all()
        return [
            {
                "position_ticket": row.id,
                "symbol": row.symbol,
                "direction": row.direction,
                "volume": row.volume,
                "entry_price": row.entry_price,
                "exit_price": row.exit_price if row.status == "closed" else prices.get(row.symbol, row.entry_price),
                "stop_loss": row.stop_loss,
                "take_profit": row.take_profit,
                "profit": row.profit if row.status == "closed" else _profit(
                    row.direction, row.entry_price, prices.get(row.symbol, row.entry_price), row.volume
                ),
                "swap": 0,
                "commission": 0,
                "currency": DEMO_CURRENCY,
                "status": row.status,
                "opened_at": row.opened_at,
                "closed_at": row.closed_at,
            }
            for row in rows
        ]
