"""Mean-reversion setup scoring."""

from __future__ import annotations

from cortex.trading_opportunities.schemas import Direction, SetupCandidate, TechnicalSnapshot


def mean_reversion_candidate(snapshot: TechnicalSnapshot) -> SetupCandidate:
    reasons: list[str] = []
    score = 0.25
    direction = Direction.WAIT

    if snapshot.rsi <= 30:
        direction = Direction.BUY
        score += 0.35
        reasons.append("O RSI está sobrevendido, sugerindo uma possível recuperação por reversão à média.")
    elif snapshot.rsi >= 70:
        direction = Direction.SELL
        score += 0.35
        reasons.append("O RSI está sobrecomprado, sugerindo uma possível correção por reversão à média.")
    else:
        reasons.append("O RSI não está em um extremo favorável à reversão à média.")

    if snapshot.trend == "sideways" and direction != Direction.WAIT:
        score += 0.1
        reasons.append("A tendência lateral favorece o contexto de reversão à média.")

    return SetupCandidate(name="mean_reversion", direction=direction, score=min(score, 1), technical_reasons=reasons)
