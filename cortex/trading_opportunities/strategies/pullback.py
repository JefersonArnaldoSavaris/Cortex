"""Pullback setup scoring."""

from __future__ import annotations

from cortex.trading_opportunities.schemas import Direction, SetupCandidate, TechnicalSnapshot


def pullback_candidate(snapshot: TechnicalSnapshot) -> SetupCandidate:
    reasons: list[str] = []
    score = 0.3
    direction = Direction.WAIT

    if snapshot.pullback == "bullish_sma_retest":
        direction = Direction.BUY
        score += 0.35
        reasons.append("Bullish trend retested the fast moving average.")
    elif snapshot.pullback == "bearish_sma_retest":
        direction = Direction.SELL
        score += 0.35
        reasons.append("Bearish trend retested the fast moving average.")
    else:
        reasons.append("No clean moving-average pullback was detected.")

    if snapshot.candle_pattern and direction != Direction.WAIT:
        score += 0.1
        reasons.append(f"Price action pattern detected: {snapshot.candle_pattern}.")

    return SetupCandidate(name="pullback", direction=direction, score=min(score, 1), technical_reasons=reasons)
