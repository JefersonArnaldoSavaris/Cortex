"""Risk calculations for short-term opportunity signals."""

from __future__ import annotations

from .config import RISK_PROFILE_MULTIPLIERS
from .schemas import Direction, RiskAssessment, RiskProfile, TechnicalSnapshot


def calculate_risk_assessment(
    *,
    direction: Direction,
    latest_price: float,
    snapshot: TechnicalSnapshot,
    capital: float,
    max_risk_per_trade: float,
    risk_profile: RiskProfile,
) -> RiskAssessment:
    """Calculate entry, stop, target and position size.

    Sizing is derived from the maximum monetary risk and price distance to the
    stop. It is a simulation aid only and does not account for broker-specific
    lot sizes, margin, commissions or slippage.
    """

    if direction in {Direction.WAIT, Direction.AVOID}:
        return RiskAssessment(
            risk_reasons=["Não há tamanho de posição operacional porque a decisão não é direcional."],
            invalidation_criteria=["Execute uma nova análise quando a estrutura de preços mudar."],
        )

    atr = max(snapshot.atr, latest_price * 0.002)
    profile_multiplier = RISK_PROFILE_MULTIPLIERS[risk_profile.value]
    stop_distance = atr * profile_multiplier
    reward_distance = stop_distance * 2
    risk_budget = capital * max_risk_per_trade

    if direction == Direction.BUY:
        stop_loss = latest_price - stop_distance
        take_profit = latest_price + reward_distance
        invalidation = [
            f"Fechamento abaixo do stop loss em {stop_loss:.4f}.",
            f"Rompimento abaixo do suporte em {snapshot.support:.4f} com aumento de volume.",
        ]
    else:
        stop_loss = latest_price + stop_distance
        take_profit = latest_price - reward_distance
        invalidation = [
            f"Fechamento acima do stop loss em {stop_loss:.4f}.",
            f"Rompimento acima da resistência em {snapshot.resistance:.4f} com aumento de volume.",
        ]

    per_unit_risk = abs(latest_price - stop_loss)
    position_size = risk_budget / per_unit_risk if per_unit_risk else 0
    max_loss = position_size * per_unit_risk
    risk_reward = abs(take_profit - latest_price) / per_unit_risk if per_unit_risk else None

    return RiskAssessment(
        entry_price=round(latest_price, 4),
        stop_loss=round(stop_loss, 4),
        take_profit=round(take_profit, 4),
        risk_reward_ratio=round(risk_reward, 2) if risk_reward is not None else None,
        position_size=round(position_size, 4),
        max_loss=round(max_loss, 2),
        risk_reasons=[
            f"O orçamento de risco está limitado a {max_risk_per_trade:.2%} do capital estimado.",
            f"A distância do stop usa o ATR ajustado ao perfil {risk_profile.value}.",
            "O tamanho da posição é teórico e desconsidera slippage, taxas, margem e restrições de lote.",
        ],
        invalidation_criteria=invalidation,
    )
