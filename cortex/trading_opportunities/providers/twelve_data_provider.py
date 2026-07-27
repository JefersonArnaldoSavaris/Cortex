"""Twelve Data market-data provider and symbol normalization."""

from __future__ import annotations

import os
import json
from datetime import datetime, timezone
from typing import Sequence
from urllib.parse import quote

import requests
from websockets.asyncio.client import connect

from cortex.trading_opportunities.schemas import OHLCVBar, Timeframe

from .base import MarketDataProvider


TWELVE_DATA_INTERVALS = {
    Timeframe.M1: "1min",
    Timeframe.M5: "5min",
    Timeframe.M15: "15min",
    Timeframe.M30: "30min",
    Timeframe.H1: "1h",
    Timeframe.H4: "4h",
    Timeframe.D1: "1day",
}

TWELVE_DATA_ALIASES = {
    "BTC": "BTC/USD",
    "BTCUSD": "BTC/USD",
    "XAUUSD": "XAU/USD",
    "XAGUSD": "XAG/USD",
    "EURUSD": "EUR/USD",
    "USDJPY": "USD/JPY",
    "USDBRL": "USD/BRL",
}


def twelve_data_symbol(symbol: str) -> str:
    normalized = symbol.strip().upper()
    return TWELVE_DATA_ALIASES.get(normalized, normalized)


def cortex_symbol(symbol: str) -> str:
    normalized = symbol.strip().upper()
    reverse_aliases = {value: key for key, value in TWELVE_DATA_ALIASES.items()}
    return reverse_aliases.get(normalized, normalized.replace("/", ""))


def twelve_data_configured() -> bool:
    return bool((os.getenv("TWELVE_DATA_API_KEY") or "").strip())


async def stream_twelve_data_ticks(symbol: str):
    api_key = (os.getenv("TWELVE_DATA_API_KEY") or "").strip()
    if not api_key:
        raise ValueError("Configure TWELVE_DATA_API_KEY para ativar o stream da Twelve Data.")

    provider_symbol = twelve_data_symbol(symbol)
    url = f"wss://ws.twelvedata.com/v1/quotes/price?apikey={quote(api_key)}"
    async with connect(url, ping_interval=20, ping_timeout=20, close_timeout=5) as upstream:
        await upstream.send(json.dumps({"action": "subscribe", "params": {"symbols": provider_symbol}}))
        async for raw_message in upstream:
            message = json.loads(raw_message)
            if message.get("event") != "price":
                if message.get("status") == "error":
                    raise ValueError(str(message.get("message") or "Erro no stream da Twelve Data."))
                continue
            price = float(message["price"])
            timestamp = int(float(message.get("timestamp") or datetime.now().timestamp()) * 1000)
            yield {
                "type": "tick",
                "symbol": cortex_symbol(str(message.get("symbol") or symbol)),
                "timestamp": timestamp,
                "bid": price,
                "ask": price,
                "last": price,
                "volume": float(message.get("day_volume") or 0),
            }


class TwelveDataMarketDataProvider(MarketDataProvider):
    def __init__(self, api_key: str | None = None, timeout: float = 12.0) -> None:
        self.api_key = (api_key or os.getenv("TWELVE_DATA_API_KEY") or "").strip()
        self.timeout = timeout
        if not self.api_key:
            raise ValueError("Configure TWELVE_DATA_API_KEY para usar dados em tempo real da Twelve Data.")

    def get_ohlcv(self, symbol: str, timeframe: Timeframe, limit: int) -> Sequence[OHLCVBar]:
        payload = self._get(
            "/time_series",
            {
                "symbol": twelve_data_symbol(symbol),
                "interval": TWELVE_DATA_INTERVALS[timeframe],
                "outputsize": min(max(limit, 1), 5000),
                "order": "ASC",
                "timezone": "UTC",
            },
        )
        values = payload.get("values") or []
        if not values:
            raise ValueError(f"Nenhum candle retornado pela Twelve Data para {symbol}.")
        return [
            OHLCVBar(
                timestamp=_parse_twelve_data_datetime(str(item["datetime"])),
                open=float(item["open"]),
                high=float(item["high"]),
                low=float(item["low"]),
                close=float(item["close"]),
                volume=float(item.get("volume") or 0),
            )
            for item in values
        ]

    def search_symbols(self, query: str, limit: int = 15) -> list[dict[str, str]]:
        payload = self._get("/symbol_search", {"symbol": query, "outputsize": min(max(limit, 1), 120)})
        results: list[dict[str, str]] = []
        for item in payload.get("data") or []:
            instrument_type = str(item.get("instrument_type") or "Ativo")
            results.append(
                {
                    "symbol": cortex_symbol(str(item.get("symbol") or "")),
                    "provider_symbol": str(item.get("symbol") or ""),
                    "name": str(item.get("instrument_name") or item.get("symbol") or ""),
                    "category": instrument_type,
                }
            )
        return results[:limit]

    def get_current_tick(self, symbol: str) -> dict[str, str | int | float]:
        payload = self._get("/price", {"symbol": twelve_data_symbol(symbol)})
        price = float(payload["price"])
        return {
            "type": "tick",
            "symbol": cortex_symbol(symbol),
            "timestamp": int(datetime.now().timestamp() * 1000),
            "bid": price,
            "ask": price,
            "last": price,
            "volume": 0.0,
        }

    def _get(self, path: str, params: dict) -> dict:
        try:
            response = requests.get(
                f"https://api.twelvedata.com{path}",
                params={**params, "apikey": self.api_key},
                timeout=self.timeout,
            )
            response.raise_for_status()
            payload = response.json()
        except (requests.RequestException, ValueError) as exc:
            raise ConnectionError(f"Falha ao consultar Twelve Data: {exc}") from exc
        if payload.get("status") == "error" or payload.get("code"):
            raise ValueError(str(payload.get("message") or "Erro retornado pela Twelve Data."))
        return payload


def _parse_twelve_data_datetime(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)
