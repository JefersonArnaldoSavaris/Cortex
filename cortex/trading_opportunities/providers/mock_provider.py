"""Deterministic mock OHLCV provider used by default and in tests."""

from __future__ import annotations

import math
from datetime import datetime, timedelta, timezone
from typing import Sequence

from cortex.trading_opportunities.schemas import OHLCVBar, Timeframe

from .base import MarketDataProvider


_TIMEFRAME_MINUTES = {
    Timeframe.M1: 1,
    Timeframe.M5: 5,
    Timeframe.M15: 15,
    Timeframe.M30: 30,
    Timeframe.H1: 60,
    Timeframe.H4: 240,
    Timeframe.D1: 1440,
}


class MockMarketDataProvider(MarketDataProvider):
    """Generate repeatable price action with trend, pullbacks and volume variation."""

    def get_ohlcv(self, symbol: str, timeframe: Timeframe, limit: int) -> Sequence[OHLCVBar]:
        base = 80 + (sum(ord(char) for char in symbol.upper()) % 70)
        minutes = _TIMEFRAME_MINUTES[timeframe]
        start = datetime.now(timezone.utc) - timedelta(minutes=minutes * limit)
        bars: list[OHLCVBar] = []

        for index in range(limit):
            drift = index * 0.08
            wave = math.sin(index / 6) * 1.4
            pullback = -2.2 if limit - 18 <= index <= limit - 12 else 0
            breakout_push = max(0, index - (limit - 8)) * 0.25
            close = base + drift + wave + pullback + breakout_push
            open_price = close - 0.25 + math.sin(index / 3) * 0.18
            high = max(open_price, close) + 0.5 + abs(math.sin(index)) * 0.25
            low = min(open_price, close) - 0.5 - abs(math.cos(index)) * 0.2
            volume = 100_000 + (index % 13) * 4_000 + (45_000 if index > limit - 8 else 0)
            bars.append(
                OHLCVBar(
                    timestamp=start + timedelta(minutes=minutes * index),
                    open=round(open_price, 4),
                    high=round(high, 4),
                    low=round(low, 4),
                    close=round(close, 4),
                    volume=float(volume),
                )
            )
        return bars
