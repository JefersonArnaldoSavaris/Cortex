"""Read-only MetaTrader 5 market-data provider."""

from __future__ import annotations

from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
import platform
from threading import Lock
from typing import Iterator, Sequence

from cortex.trading_opportunities.schemas import OHLCVBar, Timeframe

from .base import MarketDataProvider


MT5_TIMEFRAMES = {
    Timeframe.M1: "TIMEFRAME_M1",
    Timeframe.M5: "TIMEFRAME_M5",
    Timeframe.M15: "TIMEFRAME_M15",
    Timeframe.M30: "TIMEFRAME_M30",
    Timeframe.H1: "TIMEFRAME_H1",
    Timeframe.H4: "TIMEFRAME_H4",
    Timeframe.D1: "TIMEFRAME_D1",
}

_MT5_LOCK = Lock()


@dataclass(frozen=True)
class MT5Credentials:
    login: int
    password: str
    server: str
    terminal_path: str | None = None


class MT5MarketDataProvider(MarketDataProvider):
    """Read OHLCV data from a user's MetaTrader 5 broker server.

    The official MetaTrader5 Python package controls a local terminal process
    and behaves like a process-wide singleton. Calls are serialized so one
    request cannot leak into another request's login context.
    """

    def __init__(self, credentials: MT5Credentials) -> None:
        self.credentials = credentials

    def get_ohlcv(self, symbol: str, timeframe: Timeframe, limit: int) -> Sequence[OHLCVBar]:
        with self._connected() as mt5:
            if not mt5.symbol_select(symbol, True):
                code, message = mt5.last_error()
                raise ValueError(f"Símbolo não disponível no servidor MT5: {symbol} ({code}: {message})")

            mt5_timeframe = getattr(mt5, MT5_TIMEFRAMES[timeframe])
            rates = mt5.copy_rates_from_pos(symbol, mt5_timeframe, 0, limit)
            if rates is None or len(rates) == 0:
                raise ValueError(f"Nenhum candle retornado pelo MT5 para {symbol}")

            bars: list[OHLCVBar] = []
            for rate in rates:
                bars.append(
                    OHLCVBar(
                        timestamp=datetime.fromtimestamp(int(rate["time"]), tz=timezone.utc),
                        open=float(rate["open"]),
                        high=float(rate["high"]),
                        low=float(rate["low"]),
                        close=float(rate["close"]),
                        volume=float(rate["tick_volume"]),
                    )
                )
            return bars

    def get_current_price(self, symbol: str) -> float:
        tick = self.get_market_tick(symbol)
        return float(tick["last"] or tick["bid"] or tick["ask"])

    def get_market_tick(self, symbol: str) -> dict[str, str | int | float]:
        with self._connected() as mt5:
            if not mt5.symbol_select(symbol, True):
                raise ValueError(f"Símbolo não disponível no servidor MT5: {symbol}")
            tick = mt5.symbol_info_tick(symbol)
            if tick is None:
                raise ValueError(f"Preço atual indisponível no MT5 para {symbol}")
            data = tick._asdict()
            return {
                "symbol": symbol,
                "timestamp": int(data.get("time_msc") or int(data.get("time", 0)) * 1000),
                "bid": float(data.get("bid") or 0),
                "ask": float(data.get("ask") or 0),
                "last": float(data.get("last") or data.get("bid") or data.get("ask") or 0),
                "volume": float(data.get("volume_real") or data.get("volume") or 0),
            }

    def get_account_info(self) -> dict[str, str | int | float | bool | None]:
        with self._connected() as mt5:
            account = mt5.account_info()
            if account is None:
                raise ValueError("MT5 conectado, mas informações da conta não foram retornadas.")
            data = account._asdict()
            return {
                "login": data.get("login"),
                "server": data.get("server"),
                "name": data.get("name"),
                "company": data.get("company"),
                "currency": data.get("currency"),
                "balance": data.get("balance"),
                "equity": data.get("equity"),
                "margin": data.get("margin"),
                "trade_allowed": data.get("trade_allowed"),
            }

    def list_symbols(self, query: str = "", limit: int = 500) -> list[dict[str, str | bool | None]]:
        """Return symbols exposed by the connected broker account."""
        normalized_query = query.strip().lower()
        with self._connected() as mt5:
            symbols = mt5.symbols_get()
            if symbols is None:
                code, message = mt5.last_error()
                raise ConnectionError(f"Falha ao listar símbolos do MT5 ({code}): {message}")

            results: list[dict[str, str | bool | None]] = []
            for symbol in symbols:
                data = symbol._asdict()
                name = str(data.get("name") or "")
                description = str(data.get("description") or name)
                path = str(data.get("path") or "")
                haystack = f"{name} {description} {path}".lower()
                if normalized_query and normalized_query not in haystack:
                    continue
                results.append(
                    {
                        "symbol": name,
                        "name": description,
                        "category": path.split("\\")[0] if path else "Corretora",
                        "path": path or None,
                        "currency_base": data.get("currency_base") or None,
                        "currency_profit": data.get("currency_profit") or None,
                        "visible": bool(data.get("visible")),
                    }
                )
                if len(results) >= limit:
                    break
            return results

    @contextmanager
    def _connected(self) -> Iterator[object]:
        if platform.system() != "Windows":
            raise RuntimeError(
                "A integração oficial MetaTrader5 exige o terminal MetaTrader 5 e o pacote Python "
                "MetaTrader5 em Windows x86-64. A API Cortex está rodando em "
                f"{platform.system()} {platform.machine()}. Execute o backend em uma máquina/VM Windows "
                "com o terminal MT5 instalado, ou use uma ponte remota Windows para fornecer os candles à API."
            )

        try:
            import MetaTrader5 as mt5
        except ImportError as exc:
            raise RuntimeError(
                "O pacote Python MetaTrader5 não está instalado no ambiente Windows do backend. "
                "Instale com `python -m pip install MetaTrader5` e mantenha o terminal MetaTrader 5 "
                "instalado/acessível para usar dados da corretora."
            ) from exc

        with _MT5_LOCK:
            kwargs: dict[str, str | int] = {
                "login": self.credentials.login,
                "password": self.credentials.password,
                "server": self.credentials.server,
            }
            if self.credentials.terminal_path:
                kwargs["path"] = self.credentials.terminal_path

            if not mt5.initialize(**kwargs):
                code, message = mt5.last_error()
                raise ConnectionError(f"Falha ao conectar no MT5 ({code}): {message}")

            try:
                yield mt5
            finally:
                mt5.shutdown()
