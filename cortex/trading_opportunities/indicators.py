"""Technical indicator calculations for trading opportunities."""

from __future__ import annotations

from typing import Sequence

import pandas as pd

from .schemas import OHLCVBar, TechnicalSnapshot


def bars_to_frame(bars: Sequence[OHLCVBar]) -> pd.DataFrame:
    if not bars:
        raise ValueError("At least one OHLCV bar is required")
    frame = pd.DataFrame([bar.model_dump() for bar in bars]).set_index("timestamp")
    return frame.sort_index()


def _rsi(close: pd.Series, period: int = 14) -> pd.Series:
    delta = close.diff()
    gain = delta.clip(lower=0).rolling(period).mean()
    loss = (-delta.clip(upper=0)).rolling(period).mean()
    rs = gain / loss.replace(0, pd.NA)
    return (100 - (100 / (1 + rs))).fillna(50)


def _atr(frame: pd.DataFrame, period: int = 14) -> pd.Series:
    prev_close = frame["close"].shift(1)
    true_range = pd.concat(
        [
            frame["high"] - frame["low"],
            (frame["high"] - prev_close).abs(),
            (frame["low"] - prev_close).abs(),
        ],
        axis=1,
    ).max(axis=1)
    return true_range.rolling(period).mean().bfill()


def compute_technical_snapshot(bars: Sequence[OHLCVBar]) -> TechnicalSnapshot:
    frame = bars_to_frame(bars)
    if len(frame) < 50:
        raise ValueError("At least 50 OHLCV bars are required for opportunity analysis")

    close = frame["close"]
    sma_fast = close.rolling(9).mean()
    sma_slow = close.rolling(21).mean()
    ema_12 = close.ewm(span=12, adjust=False).mean()
    ema_26 = close.ewm(span=26, adjust=False).mean()
    macd = ema_12 - ema_26
    macd_signal = macd.ewm(span=9, adjust=False).mean()
    rsi = _rsi(close)
    atr = _atr(frame)

    recent = frame.tail(30)
    support = float(recent["low"].min())
    resistance = float(recent["high"].max())
    latest = frame.iloc[-1]
    previous = frame.iloc[-2]
    avg_volume = float(frame["volume"].tail(20).mean())
    volatility_pct = float((atr.iloc[-1] / latest["close"]) * 100)

    if sma_fast.iloc[-1] > sma_slow.iloc[-1] and close.iloc[-1] > sma_fast.iloc[-1]:
        trend = "bullish"
    elif sma_fast.iloc[-1] < sma_slow.iloc[-1] and close.iloc[-1] < sma_fast.iloc[-1]:
        trend = "bearish"
    else:
        trend = "sideways"

    breakout = None
    prior_resistance = float(frame.iloc[:-1].tail(30)["high"].max())
    prior_support = float(frame.iloc[:-1].tail(30)["low"].min())
    if latest["close"] > prior_resistance and latest["volume"] > avg_volume * 1.2:
        breakout = "upside"
    elif latest["close"] < prior_support and latest["volume"] > avg_volume * 1.2:
        breakout = "downside"

    pullback = None
    if trend == "bullish" and latest["low"] <= sma_fast.iloc[-1] <= latest["high"]:
        pullback = "bullish_sma_retest"
    elif trend == "bearish" and latest["low"] <= sma_fast.iloc[-1] <= latest["high"]:
        pullback = "bearish_sma_retest"

    candle_pattern = None
    body = abs(latest["close"] - latest["open"])
    lower_wick = min(latest["open"], latest["close"]) - latest["low"]
    upper_wick = latest["high"] - max(latest["open"], latest["close"])
    if lower_wick > body * 2 and latest["close"] > latest["open"]:
        candle_pattern = "bullish_pin_bar"
    elif upper_wick > body * 2 and latest["close"] < latest["open"]:
        candle_pattern = "bearish_pin_bar"
    elif latest["close"] > previous["open"] and latest["open"] < previous["close"]:
        candle_pattern = "bullish_engulfing"
    elif latest["close"] < previous["open"] and latest["open"] > previous["close"]:
        candle_pattern = "bearish_engulfing"

    return TechnicalSnapshot(
        trend=trend,
        support=round(support, 4),
        resistance=round(resistance, 4),
        sma_fast=round(float(sma_fast.iloc[-1]), 4),
        sma_slow=round(float(sma_slow.iloc[-1]), 4),
        rsi=round(float(rsi.iloc[-1]), 2),
        macd=round(float(macd.iloc[-1]), 4),
        macd_signal=round(float(macd_signal.iloc[-1]), 4),
        atr=round(float(atr.iloc[-1]), 4),
        average_volume=round(avg_volume, 2),
        latest_volume=round(float(latest["volume"]), 2),
        volatility_pct=round(volatility_pct, 2),
        breakout=breakout,
        pullback=pullback,
        candle_pattern=candle_pattern,
    )
