"""Extensible catalog for opportunity-analysis strategies."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class StrategyDefinition:
    id: str
    name: str
    description: str
    supported_timeframes: tuple[str, ...]
    context_timeframes: tuple[str, ...] = ()

    def as_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "supported_timeframes": list(self.supported_timeframes),
            "context_timeframes": list(self.context_timeframes),
        }


STRATEGY_CATALOG = {
    "classic_auto": StrategyDefinition(
        id="classic_auto",
        name="Automático clássico",
        description="Ranking automático de rompimento, pullback, tendência e reversão à média.",
        supported_timeframes=("M1", "M5", "M15", "M30", "H1", "H4", "D1"),
    ),
    "smc": StrategyDefinition(
        id="smc",
        name="SMC",
        description="Estrutura, liquidez, BOS/CHoCH, FVG, order block e premium/discount.",
        supported_timeframes=("M1", "M5", "M15", "M30", "H1", "H4", "D1"),
        context_timeframes=("M15", "H1", "H4", "D1"),
    ),
}


def list_strategies() -> list[dict]:
    return [definition.as_dict() for definition in STRATEGY_CATALOG.values()]


def get_strategy(strategy_id: str) -> StrategyDefinition:
    try:
        return STRATEGY_CATALOG[strategy_id]
    except KeyError as exc:
        raise ValueError(f"Estratégia não suportada: {strategy_id}") from exc
