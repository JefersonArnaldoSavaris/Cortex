"""Breakout setup scoring."""

from __future__ import annotations

from cortex.trading_opportunities.schemas import Direction, SetupCandidate, TechnicalSnapshot


def breakout_candidate(snapshot: TechnicalSnapshot) -> SetupCandidate:
    reasons: list[str] = []
    score = 0.25
    direction = Direction.WAIT

    if snapshot.breakout == "upside":
        direction = Direction.BUY
        score += 0.45
        reasons.append("Price closed above recent resistance with volume expansion.")
    elif snapshot.breakout == "downside":
        direction = Direction.SELL
        score += 0.45
        reasons.append("Price closed below recent support with volume expansion.")
    else:
        reasons.append("No confirmed support or resistance breakout.")

    if snapshot.latest_volume > snapshot.average_volume * 1.2:
        score += 0.1
        reasons.append("Latest volume is above the 20-bar average.")

    return SetupCandidate(name="breakout", direction=direction, score=min(score, 1), technical_reasons=reasons)
