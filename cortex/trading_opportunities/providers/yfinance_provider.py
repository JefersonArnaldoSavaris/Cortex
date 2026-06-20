"""yFinance-backed provider for symbols supported by Yahoo Finance."""

from __future__ import annotations

from typing import Sequence

from cortex.trading_opportunities.config import TIMEFRAME_TO_YFINANCE_INTERVAL
from cortex.trading_opportunities.schemas import OHLCVBar, Timeframe

from .base import MarketDataProvider


class YFinanceMarketDataProvider(MarketDataProvider):
    """Read OHLCV bars with yFinance.

    Intraday availability depends on Yahoo Finance limits and may not exist for
    every asset or exchange. Callers should treat provider errors as data
    availability issues, not trading signals.
    """

    def get_ohlcv(self, symbol: str, timeframe: Timeframe, limit: int) -> Sequence[OHLCVBar]:
        import yfinance as yf

        interval = TIMEFRAME_TO_YFINANCE_INTERVAL[timeframe.value]
        period = "7d" if timeframe in {Timeframe.M1, Timeframe.M5, Timeframe.M15, Timeframe.M30} else "1y"
        frame = yf.Ticker(symbol).history(period=period, interval=interval, auto_adjust=False)
        if frame.empty:
            raise ValueError(f"No OHLCV data returned by yFinance for {symbol}")

        bars: list[OHLCVBar] = []
        for timestamp, row in frame.tail(limit).iterrows():
            bars.append(
                OHLCVBar(
                    timestamp=timestamp.to_pydatetime(),
                    open=float(row["Open"]),
                    high=float(row["High"]),
                    low=float(row["Low"]),
                    close=float(row["Close"]),
                    volume=float(row.get("Volume", 0) or 0),
                )
            )
        return bars
