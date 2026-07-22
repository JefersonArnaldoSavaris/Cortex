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
        reasons.append("RSI is oversold, suggesting a possible mean-reversion bounce.")
    elif snapshot.rsi >= 70:
        direction = Direction.SELL
        score += 0.35
        reasons.append("RSI is overbought, suggesting a possible mean-reversion fade.")
    else:
        reasons.append("RSI is not at a mean-reversion extreme.")

    if snapshot.trend == "sideways" and direction != Direction.WAIT:
        score += 0.1
        reasons.append("Sideways trend improves mean-reversion context.")

    return SetupCandidate(name="mean_reversion", direction=direction, score=min(score, 1), technical_reasons=reasons)
