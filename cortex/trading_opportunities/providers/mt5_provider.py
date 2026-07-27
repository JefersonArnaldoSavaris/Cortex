"""Read-only MetaTrader 5 market-data provider."""

from __future__ import annotations

from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
import platform
import math
import os
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

    def preview_order(
        self,
        symbol: str,
        direction: str,
        volume: float,
        stop_loss: float,
        take_profit: float,
    ) -> dict:
        with self._connected() as mt5:
            request, details = self._build_order_request(
                mt5, symbol, direction, volume, stop_loss, take_profit
            )
            check = mt5.order_check(request)
            if check is None:
                code, message = mt5.last_error()
                raise ValueError(f"MT5 não conseguiu validar a ordem ({code}): {message}")
            check_data = check._asdict()
            if int(check_data.get("retcode") or 0) != 0:
                raise ValueError(str(check_data.get("comment") or "Ordem rejeitada na pré-validação do MT5."))
            return {
                **details,
                "execution_enabled": os.getenv("CORTEX_LIVE_TRADING_ENABLED", "false").lower() == "true",
                "check_message": str(check_data.get("comment") or "Pré-validação concluída."),
            }

    def execute_order(
        self,
        symbol: str,
        direction: str,
        volume: float,
        stop_loss: float,
        take_profit: float,
    ) -> dict:
        if os.getenv("CORTEX_LIVE_TRADING_ENABLED", "false").lower() != "true":
            raise PermissionError(
                "Execução real desabilitada. Defina CORTEX_LIVE_TRADING_ENABLED=true após revisar os controles de risco."
            )
        with self._connected() as mt5:
            request, details = self._build_order_request(
                mt5, symbol, direction, volume, stop_loss, take_profit
            )
            check = mt5.order_check(request)
            if check is None or int(check._asdict().get("retcode") or 0) != 0:
                raise ValueError(str(check._asdict().get("comment") if check else "Falha ao validar a ordem."))
            result = mt5.order_send(request)
            if result is None:
                code, message = mt5.last_error()
                raise ValueError(f"MT5 não retornou o resultado da ordem ({code}): {message}")
            data = result._asdict()
            accepted = {mt5.TRADE_RETCODE_DONE, mt5.TRADE_RETCODE_DONE_PARTIAL}
            if int(data.get("retcode") or 0) not in accepted:
                raise ValueError(str(data.get("comment") or f"Ordem rejeitada: {data.get('retcode')}"))
            positions = mt5.positions_get(symbol=symbol) or ()
            cortex_positions = [
                position for position in positions
                if int(position._asdict().get("magic") or 0) == 260724
            ]
            position = max(
                cortex_positions or list(positions),
                key=lambda item: int(item._asdict().get("time_msc") or item._asdict().get("time") or 0),
                default=None,
            )
            return {
                "order_ticket": int(data.get("order") or 0) or None,
                "deal_ticket": int(data.get("deal") or 0) or None,
                "retcode": int(data["retcode"]),
                "message": str(data.get("comment") or "Ordem enviada."),
                "executed_price": float(data.get("price") or details["entry_price"]),
                "volume": float(data.get("volume") or details["volume"]),
                "position_ticket": None if position is None else int(position._asdict().get("ticket") or 0) or None,
            }

    def get_order_status(self, symbol: str, position_ticket: int | None = None) -> dict:
        with self._connected() as mt5:
            positions = mt5.positions_get(symbol=symbol) or ()
            candidates = [
                position for position in positions
                if (
                    int(position._asdict().get("ticket") or 0) == position_ticket
                    if position_ticket is not None
                    else int(position._asdict().get("magic") or 0) == 260724
                )
            ]
            if candidates:
                position = max(
                    candidates,
                    key=lambda item: int(item._asdict().get("time_msc") or item._asdict().get("time") or 0),
                )
                data = position._asdict()
                account = mt5.account_info()
                position_type = int(data.get("type") or 0)
                symbol_name = str(data.get("symbol") or symbol)
                volume = float(data.get("volume") or 0)
                entry_price = float(data.get("price_open") or 0)
                stop_loss = float(data.get("sl") or 0)
                take_profit = float(data.get("tp") or 0)
                return {
                    "status": "open",
                    "symbol": symbol,
                    "position_ticket": int(data.get("ticket") or 0) or None,
                    "direction": "BUY" if position_type == mt5.POSITION_TYPE_BUY else "SELL",
                    "volume": volume,
                    "entry_price": entry_price,
                    "current_price": float(data.get("price_current") or 0),
                    "stop_loss": stop_loss or None,
                    "take_profit": take_profit or None,
                    "profit": float(data.get("profit") or 0),
                    "stop_result": mt5.order_calc_profit(position_type, symbol_name, volume, entry_price, stop_loss) if stop_loss else None,
                    "target_result": mt5.order_calc_profit(position_type, symbol_name, volume, entry_price, take_profit) if take_profit else None,
                    "swap": float(data.get("swap") or 0),
                    "currency": str(account.currency if account else ""),
                    "account_balance": float(account.balance) if account and hasattr(account, "balance") else None,
                    "account_equity": float(account.equity) if account and hasattr(account, "equity") else None,
                    "opened_at": datetime.fromtimestamp(int(data.get("time") or 0), tz=timezone.utc),
                }
            account = mt5.account_info()
            if position_ticket is not None:
                deals = mt5.history_deals_get(position=position_ticket) or ()
                if deals:
                    deal_data = [deal._asdict() for deal in deals]
                    first = min(deal_data, key=lambda item: int(item.get("time_msc") or item.get("time") or 0))
                    last = max(deal_data, key=lambda item: int(item.get("time_msc") or item.get("time") or 0))
                    result = sum(
                        float(item.get("profit") or 0)
                        + float(item.get("commission") or 0)
                        + float(item.get("swap") or 0)
                        + float(item.get("fee") or 0)
                        for item in deal_data
                    )
                    return {
                        "status": "closed",
                        "symbol": symbol,
                        "position_ticket": position_ticket,
                        "direction": "BUY" if int(first.get("type") or 0) == mt5.DEAL_TYPE_BUY else "SELL",
                        "volume": float(first.get("volume") or 0),
                        "entry_price": float(first.get("price") or 0),
                        "current_price": float(last.get("price") or 0),
                        "profit": result,
                        "swap": sum(float(item.get("swap") or 0) for item in deal_data),
                        "currency": str(account.currency if account else ""),
                        "opened_at": datetime.fromtimestamp(int(first.get("time") or 0), tz=timezone.utc),
                    }
            return {
                "status": "not_found",
                "symbol": symbol,
                "position_ticket": position_ticket,
                "currency": str(account.currency if account else ""),
            }

    def get_open_order_statuses(self) -> list[dict]:
        with self._connected() as mt5:
            positions = mt5.positions_get() or ()
            account = mt5.account_info()
            currency = str(account.currency if account else "")
            statuses = []
            for position in positions:
                data = position._asdict()
                if int(data.get("magic") or 0) != 260724:
                    continue
                position_type = int(data.get("type") or 0)
                symbol = str(data.get("symbol") or "")
                volume = float(data.get("volume") or 0)
                entry_price = float(data.get("price_open") or 0)
                stop_loss = float(data.get("sl") or 0)
                take_profit = float(data.get("tp") or 0)
                statuses.append({
                    "status": "open",
                    "symbol": symbol,
                    "position_ticket": int(data.get("ticket") or 0) or None,
                    "direction": "BUY" if position_type == mt5.POSITION_TYPE_BUY else "SELL",
                    "volume": volume,
                    "entry_price": entry_price,
                    "current_price": float(data.get("price_current") or 0),
                    "stop_loss": stop_loss or None,
                    "take_profit": take_profit or None,
                    "profit": float(data.get("profit") or 0),
                    "stop_result": mt5.order_calc_profit(position_type, symbol, volume, entry_price, stop_loss) if stop_loss else None,
                    "target_result": mt5.order_calc_profit(position_type, symbol, volume, entry_price, take_profit) if take_profit else None,
                    "swap": float(data.get("swap") or 0),
                    "currency": currency,
                    "account_balance": float(account.balance) if account and hasattr(account, "balance") else None,
                    "account_equity": float(account.equity) if account and hasattr(account, "equity") else None,
                    "opened_at": datetime.fromtimestamp(int(data.get("time") or 0), tz=timezone.utc),
                })
            return sorted(
                statuses,
                key=lambda item: item["opened_at"] or datetime.min.replace(tzinfo=timezone.utc),
                reverse=True,
            )

    def close_position(self, position_ticket: int) -> dict:
        if os.getenv("CORTEX_LIVE_TRADING_ENABLED", "false").lower() != "true":
            raise PermissionError("Execução real desabilitada no servidor.")
        with self._connected() as mt5:
            positions = mt5.positions_get(ticket=position_ticket) or ()
            if not positions:
                raise ValueError("Posição não encontrada ou já encerrada.")
            position = positions[0]
            data = position._asdict()
            if int(data.get("magic") or 0) != 260724:
                raise PermissionError("Somente posições criadas pelo Cortex podem ser fechadas aqui.")
            symbol = str(data.get("symbol") or "")
            volume = float(data.get("volume") or 0)
            position_type = int(data.get("type") or 0)
            if not mt5.symbol_select(symbol, True):
                raise ValueError(f"Símbolo não disponível no MT5: {symbol}")
            tick = mt5.symbol_info_tick(symbol)
            info = mt5.symbol_info(symbol)
            if tick is None or info is None:
                raise ValueError("Não foi possível consultar o preço atual para fechar a posição.")
            is_buy = position_type == mt5.POSITION_TYPE_BUY
            order_type = mt5.ORDER_TYPE_SELL if is_buy else mt5.ORDER_TYPE_BUY
            price = float(tick.bid if is_buy else tick.ask)
            info_data = info._asdict()
            filling_flags = int(info_data.get("filling_mode") or 0)
            filling = mt5.ORDER_FILLING_IOC if filling_flags & 2 else (
                mt5.ORDER_FILLING_FOK if filling_flags & 1 else mt5.ORDER_FILLING_RETURN
            )
            request = {
                "action": mt5.TRADE_ACTION_DEAL,
                "position": position_ticket,
                "symbol": symbol,
                "volume": volume,
                "type": order_type,
                "price": price,
                "deviation": 20,
                "magic": 260724,
                "comment": "Cortex position close",
                "type_time": mt5.ORDER_TIME_GTC,
                "type_filling": filling,
            }
            check = mt5.order_check(request)
            if check is None:
                raise ValueError(f"MT5 não validou o fechamento: {mt5.last_error()}")
            check_data = check._asdict()
            if int(check_data.get("retcode") or 0) not in {0, mt5.TRADE_RETCODE_DONE}:
                raise ValueError(str(check_data.get("comment") or "A corretora rejeitou o fechamento."))
            result = mt5.order_send(request)
            if result is None:
                raise ValueError(f"MT5 não respondeu ao fechamento: {mt5.last_error()}")
            result_data = result._asdict()
            if int(result_data.get("retcode") or 0) != mt5.TRADE_RETCODE_DONE:
                raise ValueError(str(result_data.get("comment") or "A corretora rejeitou o fechamento."))
            return {
                "order_ticket": int(result_data.get("order") or 0) or None,
                "deal_ticket": int(result_data.get("deal") or 0) or None,
                "retcode": int(result_data["retcode"]),
                "message": str(result_data.get("comment") or "Posição encerrada."),
                "executed_price": float(result_data.get("price") or price),
                "volume": float(result_data.get("volume") or volume),
                "position_ticket": position_ticket,
            }

    def preview_pending_order(
        self,
        symbol: str,
        direction: str,
        volume: float,
        entry_price: float,
        stop_loss: float,
        take_profit: float,
    ) -> dict:
        with self._connected() as mt5:
            request, details = self._build_pending_request(
                mt5, symbol, direction, volume, entry_price, stop_loss, take_profit
            )
            check = mt5.order_check(request)
            if check is None:
                raise ValueError(f"MT5 não validou a ordem pendente: {mt5.last_error()}")
            check_data = check._asdict()
            if int(check_data.get("retcode") or 0) != 0:
                raise ValueError(str(check_data.get("comment") or "Ordem pendente rejeitada na pré-validação."))
            return {
                **details,
                "execution_enabled": os.getenv("CORTEX_LIVE_TRADING_ENABLED", "false").lower() == "true",
                "check_message": str(check_data.get("comment") or "Ordem pendente validada."),
                "order_kind": "pending",
                "pending_type": details["pending_type"],
            }

    def execute_pending_order(
        self,
        symbol: str,
        direction: str,
        volume: float,
        entry_price: float,
        stop_loss: float,
        take_profit: float,
    ) -> dict:
        if os.getenv("CORTEX_LIVE_TRADING_ENABLED", "false").lower() != "true":
            raise PermissionError("Execução real desabilitada no servidor.")
        with self._connected() as mt5:
            request, details = self._build_pending_request(
                mt5, symbol, direction, volume, entry_price, stop_loss, take_profit
            )
            check = mt5.order_check(request)
            if check is None or int(check._asdict().get("retcode") or 0) != 0:
                raise ValueError(str(check._asdict().get("comment") if check else mt5.last_error()))
            result = mt5.order_send(request)
            if result is None:
                raise ValueError(f"MT5 não respondeu ao envio da ordem pendente: {mt5.last_error()}")
            data = result._asdict()
            if int(data.get("retcode") or 0) not in {mt5.TRADE_RETCODE_DONE, getattr(mt5, "TRADE_RETCODE_PLACED", 10008)}:
                raise ValueError(str(data.get("comment") or "A corretora rejeitou a ordem pendente."))
            return {
                "order_ticket": int(data.get("order") or 0) or None,
                "deal_ticket": int(data.get("deal") or 0) or None,
                "retcode": int(data["retcode"]),
                "message": str(data.get("comment") or "Ordem pendente apregoada."),
                "executed_price": float(data.get("price") or entry_price),
                "volume": float(data.get("volume") or details["volume"]),
                "position_ticket": None,
            }

    def list_pending_orders(self) -> list[dict]:
        with self._connected() as mt5:
            orders = mt5.orders_get() or ()
            type_names = {
                mt5.ORDER_TYPE_BUY_LIMIT: ("BUY", "BUY_LIMIT"),
                mt5.ORDER_TYPE_BUY_STOP: ("BUY", "BUY_STOP"),
                mt5.ORDER_TYPE_SELL_LIMIT: ("SELL", "SELL_LIMIT"),
                mt5.ORDER_TYPE_SELL_STOP: ("SELL", "SELL_STOP"),
            }
            pending = []
            for order in orders:
                data = order._asdict()
                if int(data.get("magic") or 0) != 260724 or int(data.get("type") or -1) not in type_names:
                    continue
                direction, pending_type = type_names[int(data["type"])]
                pending.append({
                    "order_ticket": int(data.get("ticket") or 0),
                    "symbol": str(data.get("symbol") or ""),
                    "direction": direction,
                    "pending_type": pending_type,
                    "volume": float(data.get("volume_initial") or data.get("volume_current") or 0),
                    "entry_price": float(data.get("price_open") or 0),
                    "stop_loss": float(data.get("sl") or 0) or None,
                    "take_profit": float(data.get("tp") or 0) or None,
                    "created_at": datetime.fromtimestamp(int(data.get("time_setup") or 0), tz=timezone.utc),
                })
            return pending

    def cancel_pending_order(self, order_ticket: int) -> dict:
        if os.getenv("CORTEX_LIVE_TRADING_ENABLED", "false").lower() != "true":
            raise PermissionError("Execução real desabilitada no servidor.")
        with self._connected() as mt5:
            orders = mt5.orders_get(ticket=order_ticket) or ()
            if not orders:
                raise ValueError("Ordem pendente não encontrada ou já executada.")
            data = orders[0]._asdict()
            if int(data.get("magic") or 0) != 260724:
                raise PermissionError("Somente ordens criadas pelo Cortex podem ser canceladas aqui.")
            result = mt5.order_send({"action": mt5.TRADE_ACTION_REMOVE, "order": order_ticket})
            if result is None:
                raise ValueError(f"MT5 não respondeu ao cancelamento: {mt5.last_error()}")
            result_data = result._asdict()
            if int(result_data.get("retcode") or 0) != mt5.TRADE_RETCODE_DONE:
                raise ValueError(str(result_data.get("comment") or "A corretora rejeitou o cancelamento."))
            return {
                "order_ticket": order_ticket,
                "deal_ticket": None,
                "retcode": int(result_data["retcode"]),
                "message": str(result_data.get("comment") or "Ordem pendente cancelada."),
                "executed_price": None,
                "volume": float(data.get("volume_current") or data.get("volume_initial") or 0),
                "position_ticket": None,
            }

    @staticmethod
    def _build_pending_request(mt5, symbol, direction, volume, entry_price, stop_loss, take_profit):
        if direction not in {"BUY", "SELL"}:
            raise ValueError("Direção inválida para ordem pendente.")
        if not mt5.symbol_select(symbol, True):
            raise ValueError(f"Símbolo não disponível no MT5: {symbol}")
        info = mt5.symbol_info(symbol)
        tick = mt5.symbol_info_tick(symbol)
        account = mt5.account_info()
        if info is None or tick is None or account is None:
            raise ValueError("Não foi possível consultar símbolo, preço ou conta no MT5.")
        data = info._asdict()
        step = float(data.get("volume_step") or 0.01)
        minimum = float(data.get("volume_min") or step)
        maximum = float(data.get("volume_max") or volume)
        normalized_volume = min(maximum, max(minimum, math.floor((volume + 1e-12) / step) * step))
        decimals = max(0, len(f"{step:.10f}".rstrip("0").split(".")[-1]))
        normalized_volume = round(normalized_volume, decimals)
        is_buy = direction == "BUY"
        if is_buy and not (stop_loss < entry_price < take_profit):
            raise ValueError("Para compra pendente, stop < entrada < alvo.")
        if not is_buy and not (take_profit < entry_price < stop_loss):
            raise ValueError("Para venda pendente, alvo < entrada < stop.")
        market_price = float(tick.ask if is_buy else tick.bid)
        if is_buy:
            order_type = mt5.ORDER_TYPE_BUY_LIMIT if entry_price < market_price else mt5.ORDER_TYPE_BUY_STOP
            pending_type = "BUY_LIMIT" if entry_price < market_price else "BUY_STOP"
            calc_type = mt5.ORDER_TYPE_BUY
        else:
            order_type = mt5.ORDER_TYPE_SELL_LIMIT if entry_price > market_price else mt5.ORDER_TYPE_SELL_STOP
            pending_type = "SELL_LIMIT" if entry_price > market_price else "SELL_STOP"
            calc_type = mt5.ORDER_TYPE_SELL
        loss = mt5.order_calc_profit(calc_type, symbol, normalized_volume, entry_price, stop_loss)
        profit = mt5.order_calc_profit(calc_type, symbol, normalized_volume, entry_price, take_profit)
        margin = mt5.order_calc_margin(calc_type, symbol, normalized_volume, entry_price)
        if loss is None or profit is None:
            raise ValueError("A corretora não calculou os valores da ordem pendente.")
        digits = int(data.get("digits") or 5)
        request = {
            "action": mt5.TRADE_ACTION_PENDING,
            "symbol": symbol,
            "volume": normalized_volume,
            "type": order_type,
            "price": round(entry_price, digits),
            "sl": round(stop_loss, digits),
            "tp": round(take_profit, digits),
            "deviation": 20,
            "magic": 260724,
            "comment": "Cortex SMC pending",
            "type_time": mt5.ORDER_TIME_GTC,
            "type_filling": mt5.ORDER_FILLING_RETURN,
        }
        return request, {
            "symbol": symbol,
            "direction": direction,
            "volume": normalized_volume,
            "requested_volume": volume,
            "entry_price": round(entry_price, digits),
            "stop_loss": round(stop_loss, digits),
            "take_profit": round(take_profit, digits),
            "estimated_loss": abs(float(loss)),
            "estimated_profit": abs(float(profit)),
            "estimated_margin": None if margin is None else float(margin),
            "currency": str(account.currency),
            "volume_min": minimum,
            "volume_max": maximum,
            "volume_step": step,
            "pending_type": pending_type,
        }

    @staticmethod
    def _build_order_request(mt5, symbol, direction, volume, stop_loss, take_profit):
        if direction not in {"BUY", "SELL"}:
            raise ValueError("Somente sinais BUY ou SELL podem gerar ordens.")
        if not mt5.symbol_select(symbol, True):
            raise ValueError(f"Símbolo não disponível no MT5: {symbol}")
        info = mt5.symbol_info(symbol)
        tick = mt5.symbol_info_tick(symbol)
        account = mt5.account_info()
        if info is None or tick is None or account is None:
            raise ValueError("Não foi possível consultar símbolo, preço ou conta no MT5.")
        data = info._asdict()
        step = float(data.get("volume_step") or 0.01)
        minimum = float(data.get("volume_min") or step)
        maximum = float(data.get("volume_max") or volume)
        normalized_volume = min(maximum, max(minimum, math.floor((volume + 1e-12) / step) * step))
        decimals = max(0, len(f"{step:.10f}".rstrip("0").split(".")[-1]))
        normalized_volume = round(normalized_volume, decimals)
        is_buy = direction == "BUY"
        entry = float(tick.ask if is_buy else tick.bid)
        if is_buy and not (stop_loss < entry < take_profit):
            raise ValueError("Para compra, o stop deve ficar abaixo da entrada e o gain acima.")
        if not is_buy and not (take_profit < entry < stop_loss):
            raise ValueError("Para venda, o gain deve ficar abaixo da entrada e o stop acima.")
        order_type = mt5.ORDER_TYPE_BUY if is_buy else mt5.ORDER_TYPE_SELL
        loss = mt5.order_calc_profit(order_type, symbol, normalized_volume, entry, stop_loss)
        profit = mt5.order_calc_profit(order_type, symbol, normalized_volume, entry, take_profit)
        margin = mt5.order_calc_margin(order_type, symbol, normalized_volume, entry)
        if loss is None or profit is None:
            raise ValueError("A corretora não conseguiu calcular perda e ganho estimados.")
        filling_flags = int(data.get("filling_mode") or 0)
        filling = mt5.ORDER_FILLING_IOC if filling_flags & 2 else (
            mt5.ORDER_FILLING_FOK if filling_flags & 1 else mt5.ORDER_FILLING_RETURN
        )
        request = {
            "action": mt5.TRADE_ACTION_DEAL,
            "symbol": symbol,
            "volume": normalized_volume,
            "type": order_type,
            "price": entry,
            "sl": round(stop_loss, int(data.get("digits") or 5)),
            "tp": round(take_profit, int(data.get("digits") or 5)),
            "deviation": 20,
            "magic": 260724,
            "comment": "Cortex AI confirmed",
            "type_time": mt5.ORDER_TIME_GTC,
            "type_filling": filling,
        }
        details = {
            "symbol": symbol,
            "direction": direction,
            "volume": normalized_volume,
            "requested_volume": volume,
            "entry_price": entry,
            "stop_loss": request["sl"],
            "take_profit": request["tp"],
            "estimated_loss": abs(float(loss)),
            "estimated_profit": abs(float(profit)),
            "estimated_margin": None if margin is None else abs(float(margin)),
            "currency": str(account.currency),
            "volume_min": minimum,
            "volume_max": maximum,
            "volume_step": step,
        }
        return request, details

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
