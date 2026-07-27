from __future__ import annotations

from sqlalchemy import delete, func, select

from .db import session_scope
from .models import AssetOption
from .orm import BrokerFavoriteAssetORM, FavoriteAssetORM, UserORM


DEFAULT_FAVORITES = [
    AssetOption(symbol="XAUUSD", name="Ouro / Dólar", category="Metal", default_provider_symbol="XAU/USD"),
    AssetOption(symbol="BTCUSD", name="Bitcoin / Dólar", category="Cripto", default_provider_symbol="BTC/USD"),
    AssetOption(symbol="EURUSD", name="Euro / Dólar", category="Forex", default_provider_symbol="EUR/USD"),
]


def add_default_favorites(session, user_id: str) -> None:
    for asset in DEFAULT_FAVORITES:
        session.add(_favorite_row(user_id, asset))


def backfill_default_favorites() -> int:
    """Seed defaults once for users created before favorites existed."""
    seeded_users = 0
    with session_scope() as session:
        user_ids = session.scalars(select(UserORM.id)).all()
        for user_id in user_ids:
            favorite_count = session.scalar(
                select(func.count(FavoriteAssetORM.id)).where(FavoriteAssetORM.user_id == user_id)
            )
            if favorite_count:
                continue
            add_default_favorites(session, user_id)
            seeded_users += 1
    return seeded_users


def list_favorites(user_id: str) -> list[AssetOption]:
    with session_scope() as session:
        rows = session.scalars(
            select(FavoriteAssetORM)
            .where(FavoriteAssetORM.user_id == user_id)
            .order_by(FavoriteAssetORM.created_at, FavoriteAssetORM.id)
        ).all()
        return [_to_asset(row) for row in rows]


def save_favorite(user_id: str, asset: AssetOption) -> AssetOption:
    normalized = asset.model_copy(
        update={
            "symbol": asset.symbol.strip().upper(),
            "default_provider_symbol": asset.default_provider_symbol.strip(),
        }
    )
    with session_scope() as session:
        existing = session.scalar(
            select(FavoriteAssetORM).where(
                FavoriteAssetORM.user_id == user_id,
                FavoriteAssetORM.symbol == normalized.symbol,
            )
        )
        if existing is None:
            session.add(_favorite_row(user_id, normalized))
        else:
            existing.name = normalized.name
            existing.category = normalized.category
            existing.provider_symbol = normalized.default_provider_symbol
    return normalized


def delete_favorite(user_id: str, symbol: str) -> None:
    with session_scope() as session:
        session.execute(
            delete(FavoriteAssetORM).where(
                FavoriteAssetORM.user_id == user_id,
                FavoriteAssetORM.symbol == symbol.strip().upper(),
            )
        )


def list_broker_favorites(user_id: str) -> list[AssetOption]:
    with session_scope() as session:
        rows = session.scalars(
            select(BrokerFavoriteAssetORM)
            .where(BrokerFavoriteAssetORM.user_id == user_id)
            .order_by(BrokerFavoriteAssetORM.created_at, BrokerFavoriteAssetORM.id)
        ).all()
        return [_to_broker_asset(row) for row in rows]


def save_broker_favorite(user_id: str, asset: AssetOption) -> AssetOption:
    normalized = asset.model_copy(update={
        "symbol": asset.symbol.strip(),
        "default_provider_symbol": asset.symbol.strip(),
    })
    with session_scope() as session:
        existing = session.scalar(
            select(BrokerFavoriteAssetORM).where(
                BrokerFavoriteAssetORM.user_id == user_id,
                BrokerFavoriteAssetORM.symbol == normalized.symbol,
            )
        )
        if existing is None:
            session.add(BrokerFavoriteAssetORM(
                user_id=user_id,
                symbol=normalized.symbol,
                name=normalized.name,
                category=normalized.category,
                provider_symbol=normalized.symbol,
            ))
        else:
            existing.name = normalized.name
            existing.category = normalized.category
    return normalized


def delete_broker_favorite(user_id: str, symbol: str) -> None:
    with session_scope() as session:
        session.execute(
            delete(BrokerFavoriteAssetORM).where(
                BrokerFavoriteAssetORM.user_id == user_id,
                BrokerFavoriteAssetORM.symbol == symbol.strip(),
            )
        )


def _favorite_row(user_id: str, asset: AssetOption) -> FavoriteAssetORM:
    return FavoriteAssetORM(
        user_id=user_id,
        symbol=asset.symbol,
        name=asset.name,
        category=asset.category,
        provider_symbol=asset.default_provider_symbol,
    )


def _to_asset(row: FavoriteAssetORM) -> AssetOption:
    return AssetOption(
        symbol=row.symbol,
        name=row.name,
        category=row.category,
        default_provider_symbol=row.provider_symbol,
    )


def _to_broker_asset(row: BrokerFavoriteAssetORM) -> AssetOption:
    return AssetOption(
        symbol=row.symbol,
        name=row.name,
        category=row.category,
        default_provider_symbol=row.provider_symbol,
    )
