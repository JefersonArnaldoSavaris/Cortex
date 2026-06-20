"""Provider interfaces for short-term market data."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Sequence

from cortex.trading_opportunities.schemas import OHLCVBar, Timeframe


class MarketDataProvider(ABC):
    """Read-only market-data provider.

    Implementations must not place orders. Trade execution belongs to a future,
    explicitly separated integration layer.
    """

    @abstractmethod
    def get_ohlcv(self, symbol: str, timeframe: Timeframe, limit: int) -> Sequence[OHLCVBar]:
        """Return OHLCV bars ordered oldest to newest."""

    def get_current_price(self, symbol: str) -> float:
        bars = self.get_ohlcv(symbol, Timeframe.M15, 1)
        if not bars:
            raise ValueError(f"No price data available for {symbol}")
        return bars[-1].close
