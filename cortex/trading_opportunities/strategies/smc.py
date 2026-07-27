"""Rule-based Smart Money Concepts analysis with closed-candle data only."""

from __future__ import annotations

from typing import Sequence

import pandas as pd

from ..indicators import bars_to_frame
from ..schemas import Direction, OHLCVBar, OpportunityRequest, OpportunitySignal


def _atr(frame: pd.DataFrame, period: int = 14) -> float:
    previous = frame["close"].shift(1)
    ranges = pd.concat(
        [
            frame["high"] - frame["low"],
            (frame["high"] - previous).abs(),
            (frame["low"] - previous).abs(),
        ],
        axis=1,
    ).max(axis=1)
    return float(ranges.rolling(period).mean().iloc[-1])


def _swings(frame: pd.DataFrame, width: int = 2) -> tuple[list[tuple[int, float]], list[tuple[int, float]]]:
    highs: list[tuple[int, float]] = []
    lows: list[tuple[int, float]] = []
    for index in range(width, len(frame) - width):
        window = frame.iloc[index - width:index + width + 1]
        high = float(frame.iloc[index]["high"])
        low = float(frame.iloc[index]["low"])
        if high == float(window["high"].max()):
            highs.append((index, high))
        if low == float(window["low"].min()):
            lows.append((index, low))
    return highs, lows


def _bias(frame: pd.DataFrame) -> str:
    highs, lows = _swings(frame)
    if len(highs) >= 2 and len(lows) >= 2:
        higher = highs[-1][1] > highs[-2][1] and lows[-1][1] > lows[-2][1]
        lower = highs[-1][1] < highs[-2][1] and lows[-1][1] < lows[-2][1]
        if higher:
            return "bullish"
        if lower:
            return "bearish"
    midpoint = (float(frame["high"].tail(40).max()) + float(frame["low"].tail(40).min())) / 2
    return "bullish" if float(frame.iloc[-1]["close"]) >= midpoint else "bearish"


def _latest_fvg(frame: pd.DataFrame, direction: Direction, current: float) -> tuple[float, float] | None:
    for index in range(len(frame) - 1, max(2, len(frame) - 40), -1):
        first = frame.iloc[index - 2]
        third = frame.iloc[index]
        if direction == Direction.BUY and float(third["low"]) > float(first["high"]):
            zone = (float(first["high"]), float(third["low"]))
            if current >= zone[0]:
                return zone
        if direction == Direction.SELL and float(third["high"]) < float(first["low"]):
            zone = (float(third["high"]), float(first["low"]))
            if current <= zone[1]:
                return zone
    return None


def _latest_order_block(frame: pd.DataFrame, direction: Direction, atr: float, current: float) -> tuple[float, float] | None:
    for index in range(len(frame) - 2, max(1, len(frame) - 35), -1):
        candle = frame.iloc[index]
        impulse = frame.iloc[index + 1]
        impulse_body = abs(float(impulse["close"]) - float(impulse["open"]))
        if impulse_body < atr * 0.8:
            continue
        bearish = float(candle["close"]) < float(candle["open"])
        bullish = float(candle["close"]) > float(candle["open"])
        if direction == Direction.BUY and bearish and float(impulse["close"]) > float(candle["high"]):
            zone = (float(candle["low"]), float(candle["high"]))
            if current >= zone[0]:
                return zone
        if direction == Direction.SELL and bullish and float(impulse["close"]) < float(candle["low"]):
            zone = (float(candle["low"]), float(candle["high"]))
            if current <= zone[1]:
                return zone
    return None


def analyze_smc(
    request: OpportunityRequest,
    execution_bars: Sequence[OHLCVBar],
    context_bars: Sequence[OHLCVBar],
) -> OpportunitySignal:
    frame = bars_to_frame(execution_bars)
    context = bars_to_frame(context_bars)
    if len(frame) < 80 or len(context) < 60:
        raise ValueError("SMC requer ao menos 80 candles operacionais e 60 candles de contexto.")

    atr = _atr(frame)
    current = float(frame.iloc[-1]["close"])
    highs, lows = _swings(frame)
    if not highs or not lows:
        raise ValueError("Não foi possível identificar swings suficientes para SMC.")

    last_high = highs[-1][1]
    last_low = lows[-1][1]
    htf_bias = _bias(context)
    recent = frame.tail(8)
    bullish_sweep = float(recent["low"].min()) < last_low and current > last_low
    bearish_sweep = float(recent["high"].max()) > last_high and current < last_high
    bullish_bos = current > last_high
    bearish_bos = current < last_low

    if htf_bias == "bullish":
        direction = Direction.BUY
        structure_confirmed = bullish_bos or bullish_sweep
    else:
        direction = Direction.SELL
        structure_confirmed = bearish_bos or bearish_sweep

    fvg = _latest_fvg(frame, direction, current)
    order_block = _latest_order_block(frame, direction, atr, current)
    dealing_low = float(frame["low"].tail(60).min())
    dealing_high = float(frame["high"].tail(60).max())
    equilibrium = (dealing_low + dealing_high) / 2
    zone = fvg or order_block
    if zone is None:
        zone = (
            (max(dealing_low, current - atr), current)
            if direction == Direction.BUY
            else (current, min(dealing_high, current + atr))
        )
    zone_low, zone_high = sorted(zone)
    entry = (zone_low + zone_high) / 2
    if direction == Direction.BUY:
        entry = min(entry, current)
    else:
        entry = max(entry, current)
    stop = min(last_low, zone_low) - atr * 0.2 if direction == Direction.BUY else max(last_high, zone_high) + atr * 0.2
    target = last_high if direction == Direction.BUY else last_low
    risk = abs(entry - stop)
    if direction == Direction.BUY and target <= entry:
        target = entry + risk * 2
    if direction == Direction.SELL and target >= entry:
        target = entry - risk * 2
    reward = abs(target - entry)
    risk_reward = reward / risk if risk > 0 else 0
    in_zone = zone_low - atr * 0.15 <= current <= zone_high + atr * 0.15

    score = 0.30
    reasons = [f"Viés {htf_bias} confirmado no contexto superior."]
    if structure_confirmed:
        score += 0.25
        reasons.append("Estrutura operacional confirmou BOS ou varredura de liquidez.")
    else:
        reasons.append("Ainda não houve BOS/CHoCH ou sweep suficiente no timeframe operacional.")
    if bullish_sweep or bearish_sweep:
        score += 0.15
        reasons.append("Foi detectada captura de liquidez além de um swing recente.")
    if fvg:
        score += 0.12
        reasons.append(f"FVG ativo entre {zone_low:.5f} e {zone_high:.5f}.")
    if order_block:
        score += 0.10
        reasons.append("Order block recente coincide com a região de interesse.")
    correct_half = entry <= equilibrium if direction == Direction.BUY else entry >= equilibrium
    if correct_half:
        score += 0.08
        reasons.append("Entrada projetada está na região de desconto/premium coerente com a direção.")

    actionable = structure_confirmed and in_zone and risk_reward >= 1.5 and score >= 0.65
    final_direction = direction if actionable else Direction.WAIT
    risk_amount = request.capital * request.max_risk_per_trade
    position_size = risk_amount / risk if risk > 0 and actionable else 0
    invalidation = (
        f"Fechamento abaixo de {stop:.5f} invalida a leitura compradora."
        if direction == Direction.BUY
        else f"Fechamento acima de {stop:.5f} invalida a leitura vendedora."
    )
    risk_reasons = [
        f"Risco/retorno projetado: {risk_reward:.2f}.",
        f"Risco máximo configurado: {risk_amount:.2f}.",
    ]
    if not in_zone:
        risk_reasons.append("Preço ainda fora da zona de entrada; aguardar mitigação evita perseguir o movimento.")
    if not structure_confirmed:
        risk_reasons.append("Estrutura ainda não confirmou a execução.")

    return OpportunitySignal(
        symbol=request.symbol,
        strategy_type=request.strategy_type,
        strategy_id=request.strategy_id,
        timeframe=request.timeframe,
        direction=final_direction,
        planned_direction=direction,
        confidence_score=round(min(score, 1), 2),
        setup_name="smc_liquidity_structure",
        entry_price=round(entry, 5),
        stop_loss=round(stop, 5),
        take_profit=round(target, 5),
        entry_zone_low=round(zone_low, 5),
        entry_zone_high=round(zone_high, 5),
        execution_ready=actionable,
        risk_reward_ratio=round(risk_reward, 2),
        position_size=round(position_size, 4),
        max_loss=round(risk_amount if actionable else 0, 2),
        technical_reasons=reasons,
        risk_reasons=risk_reasons,
        invalidation_criteria=[invalidation],
        warnings=[
            "SMC é uma heurística codificada e deve ser validada por backtest no ativo e timeframe.",
            "Somente candles fechados foram usados; o sinal não antecipa candles futuros.",
        ],
    )
