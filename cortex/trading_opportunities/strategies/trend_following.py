"""Trend-following setup scoring."""

from __future__ import annotations

from cortex.trading_opportunities.schemas import Direction, SetupCandidate, TechnicalSnapshot


def trend_following_candidate(snapshot: TechnicalSnapshot) -> SetupCandidate:
    reasons: list[str] = []
    score = 0.35
    direction = Direction.WAIT

    if snapshot.trend == "bullish":
        direction = Direction.BUY
        score += 0.25
        reasons.append("Fast moving average is above slow average and price is aligned with bullish trend.")
    elif snapshot.trend == "bearish":
        direction = Direction.SELL
        score += 0.25
        reasons.append("Fast moving average is below slow average and price is aligned with bearish trend.")
    else:
        reasons.append("Trend is sideways, reducing directional edge.")

    if direction == Direction.BUY and snapshot.macd > snapshot.macd_signal:
        score += 0.15
        reasons.append("MACD is above signal line.")
    elif direction == Direction.SELL and snapshot.macd < snapshot.macd_signal:
        score += 0.15
        reasons.append("MACD is below signal line.")

    if 40 <= snapshot.rsi <= 68:
        score += 0.1
        reasons.append("RSI is not stretched for trend continuation.")

    return SetupCandidate(name="trend_following", direction=direction, score=min(score, 1), technical_reasons=reasons)
