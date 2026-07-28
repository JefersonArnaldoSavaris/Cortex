"""HTTP bridge provider for a Windows-hosted MetaTrader 5 service."""

from __future__ import annotations

from datetime import datetime
from typing import Sequence

import requests

from cortex.trading_opportunities.schemas import OHLCVBar, Timeframe

from .base import MarketDataProvider


class MT5BridgeMarketDataProvider(MarketDataProvider):
    """Read MT5 data through a small Windows bridge service."""

    def __init__(self, base_url: str, timeout: float = 20.0) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

    def connect(self, payload: dict) -> dict:
        return self._request("POST", "/connect", json=payload)

    def disconnect(self) -> dict:
        return self._request("POST", "/disconnect")

    def status(self) -> dict:
        return self._request("GET", "/status")

    def list_symbols(self, query: str = "", limit: int = 500) -> list[dict]:
        body = self._request("GET", "/symbols", params={"query": query, "limit": limit})
        return list(body.get("symbols", []))

    def get_ohlcv(self, symbol: str, timeframe: Timeframe, limit: int) -> Sequence[OHLCVBar]:
        body = self._request(
            "GET",
            "/ohlcv",
            params={"symbol": symbol, "timeframe": timeframe.value, "limit": limit},
        )
        return [
            OHLCVBar(
                timestamp=datetime.fromisoformat(item["timestamp"].replace("Z", "+00:00")),
                open=float(item["open"]),
                high=float(item["high"]),
                low=float(item["low"]),
                close=float(item["close"]),
                volume=float(item["volume"]),
            )
            for item in body.get("bars", [])
        ]

    def get_current_price(self, symbol: str) -> float:
        body = self._request("GET", "/price", params={"symbol": symbol})
        return float(body["price"])

    def get_market_tick(self, symbol: str) -> dict:
        return self._request("GET", "/tick", params={"symbol": symbol})

    def get_operation_history(self, days: int = 90, limit: int = 500) -> list[dict]:
        body = self._request("GET", "/orders/history", params={"days": days, "limit": limit})
        return list(body.get("operations", []))

    def _request(self, method: str, path: str, **kwargs) -> dict:
        try:
            response = requests.request(method, f"{self.base_url}{path}", timeout=self.timeout, **kwargs)
        except requests.RequestException as exc:
            raise ConnectionError(f"MT5 bridge indisponível em {self.base_url}: {exc}") from exc

        if response.status_code >= 400:
            detail = response.json().get("detail") if response.headers.get("content-type", "").startswith("application/json") else response.text
            raise ValueError(str(detail or "Erro ao consultar MT5 bridge."))
        return response.json()
