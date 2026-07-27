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
        reasons.append("A tendência de alta voltou a testar a média móvel rápida.")
    elif snapshot.pullback == "bearish_sma_retest":
        direction = Direction.SELL
        score += 0.35
        reasons.append("A tendência de baixa voltou a testar a média móvel rápida.")
    else:
        reasons.append("Nenhum pullback claro na média móvel foi detectado.")

    if snapshot.candle_pattern and direction != Direction.WAIT:
        score += 0.1
        reasons.append(f"Padrão de ação do preço detectado: {snapshot.candle_pattern}.")

    return SetupCandidate(name="pullback", direction=direction, score=min(score, 1), technical_reasons=reasons)
