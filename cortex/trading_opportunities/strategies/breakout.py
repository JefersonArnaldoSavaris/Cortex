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
        reasons.append("O preço fechou acima da resistência recente com expansão de volume.")
    elif snapshot.breakout == "downside":
        direction = Direction.SELL
        score += 0.45
        reasons.append("O preço fechou abaixo do suporte recente com expansão de volume.")
    else:
        reasons.append("Não houve rompimento confirmado de suporte ou resistência.")

    if snapshot.latest_volume > snapshot.average_volume * 1.2:
        score += 0.1
        reasons.append("O volume mais recente está acima da média dos últimos 20 candles.")

    return SetupCandidate(name="breakout", direction=direction, score=min(score, 1), technical_reasons=reasons)
