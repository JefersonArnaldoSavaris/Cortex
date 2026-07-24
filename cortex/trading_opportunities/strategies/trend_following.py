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
        reasons.append("A média móvel rápida está acima da lenta e o preço está alinhado à tendência de alta.")
    elif snapshot.trend == "bearish":
        direction = Direction.SELL
        score += 0.25
        reasons.append("A média móvel rápida está abaixo da lenta e o preço está alinhado à tendência de baixa.")
    else:
        reasons.append("A tendência está lateral, reduzindo a vantagem direcional.")

    if direction == Direction.BUY and snapshot.macd > snapshot.macd_signal:
        score += 0.15
        reasons.append("O MACD está acima da linha de sinal.")
    elif direction == Direction.SELL and snapshot.macd < snapshot.macd_signal:
        score += 0.15
        reasons.append("O MACD está abaixo da linha de sinal.")

    if 40 <= snapshot.rsi <= 68:
        score += 0.1
        reasons.append("O RSI não está estendido e favorece a continuidade da tendência.")

    return SetupCandidate(name="trend_following", direction=direction, score=min(score, 1), technical_reasons=reasons)
