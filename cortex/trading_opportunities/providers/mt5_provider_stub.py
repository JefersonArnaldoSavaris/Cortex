"""Safe MT5 provider stub for a future commercial integration."""

from __future__ import annotations

import os
from typing import Sequence

from cortex.trading_opportunities.config import ENABLE_LIVE_TRADING
from cortex.trading_opportunities.schemas import OHLCVBar, Timeframe

from .base import MarketDataProvider


class MT5ProviderStub(MarketDataProvider):
    """MT5 interface placeholder.

    This class intentionally blocks live trading. The environment flag exists
    for future configuration discovery but does not enable order execution in
    this implementation stage.
    """

    def __init__(self) -> None:
        self.enabled = ENABLE_LIVE_TRADING
        self.login = os.getenv("MT5_LOGIN")
        self.server = os.getenv("MT5_SERVER")

    def connect(self) -> bool:
        raise NotImplementedError("MT5 connection is not implemented in this educational preview.")

    def get_account_info(self) -> dict:
        raise NotImplementedError("MT5 account access is not implemented.")

    def get_symbols(self) -> list[str]:
        raise NotImplementedError("MT5 symbol discovery is not implemented.")

    def get_ohlcv(self, symbol: str, timeframe: Timeframe, limit: int) -> Sequence[OHLCVBar]:
        raise NotImplementedError("MT5 OHLCV retrieval is not implemented.")

    def get_current_price(self, symbol: str) -> float:
        raise NotImplementedError("MT5 current-price retrieval is not implemented.")

    def place_order(self, *args, **kwargs) -> None:
        raise NotImplementedError("Live order execution is blocked. ENABLE_LIVE_TRADING cannot override this stage.")
