from contextlib import contextmanager
from types import SimpleNamespace

import pytest

from cortex.trading_opportunities.providers.mt5_provider import MT5Credentials, MT5MarketDataProvider


class Record(SimpleNamespace):
    def _asdict(self):
        return vars(self)


class FakeMT5:
    ORDER_TYPE_BUY = 0
    ORDER_TYPE_SELL = 1
    ORDER_TYPE_BUY_LIMIT = 2
    ORDER_TYPE_SELL_LIMIT = 3
    ORDER_TYPE_BUY_STOP = 4
    ORDER_TYPE_SELL_STOP = 5
    ORDER_FILLING_FOK = 0
    ORDER_FILLING_IOC = 1
    ORDER_FILLING_RETURN = 2
    ORDER_TIME_GTC = 0
    TRADE_ACTION_DEAL = 1
    TRADE_ACTION_PENDING = 5
    TRADE_ACTION_REMOVE = 8
    TRADE_RETCODE_PLACED = 10008
    TRADE_RETCODE_DONE = 10009
    POSITION_TYPE_BUY = 0

    def symbol_select(self, symbol, selected):
        return True

    def symbol_info(self, symbol):
        return Record(
            volume_step=0.01,
            volume_min=0.01,
            volume_max=10.0,
            filling_mode=2,
            digits=2,
        )

    def symbol_info_tick(self, symbol):
        return Record(ask=100.0, bid=99.9)

    def account_info(self):
        return Record(currency="USD", balance=5000.0, equity=5001.0)

    def order_calc_profit(self, order_type, symbol, volume, entry, close):
        multiplier = 100 * volume
        return (close - entry) * multiplier if order_type == self.ORDER_TYPE_BUY else (entry - close) * multiplier

    def order_calc_margin(self, order_type, symbol, volume, entry):
        return entry * volume * 10

    def order_check(self, request):
        return Record(retcode=0, comment="Done")

    def order_send(self, request):
        return Record(
            retcode=self.TRADE_RETCODE_DONE,
            comment="Done",
            order=456,
            deal=789,
            price=request.get("price", 0),
            volume=request.get("volume", 0.03),
        )

    def last_error(self):
        return (0, "OK")

    def positions_get(self, symbol=None, ticket=None):
        return (
            Record(
                ticket=123,
                symbol="TEST",
                type=0,
                volume=0.01,
                price_open=100.0,
                price_current=101.0,
                sl=95.0,
                tp=110.0,
                profit=1.0,
                swap=0.0,
                time=1_700_000_000,
                time_msc=1_700_000_000_000,
                magic=260724,
            ),
        )

    def orders_get(self, ticket=None):
        orders = (
            Record(
                ticket=456,
                symbol="TEST",
                type=self.ORDER_TYPE_BUY_LIMIT,
                volume_initial=0.03,
                volume_current=0.03,
                price_open=98.0,
                sl=95.0,
                tp=110.0,
                time_setup=1_700_000_000,
                magic=260724,
            ),
        )
        return tuple(order for order in orders if ticket is None or order.ticket == ticket)


def _provider(monkeypatch):
    provider = MT5MarketDataProvider(MT5Credentials(login=1, password="x", server="demo"))
    fake = FakeMT5()

    @contextmanager
    def connected():
        yield fake

    monkeypatch.setattr(provider, "_connected", connected)
    return provider


def test_preview_order_normalizes_volume_and_calculates_account_values(monkeypatch):
    monkeypatch.delenv("CORTEX_LIVE_TRADING_ENABLED", raising=False)
    preview = _provider(monkeypatch).preview_order("TEST", "BUY", 0.037, 95.0, 110.0)

    assert preview["volume"] == 0.03
    assert preview["estimated_loss"] == 15.0
    assert preview["estimated_profit"] == 30.0
    assert preview["estimated_margin"] == 30.0
    assert preview["currency"] == "USD"
    assert preview["execution_enabled"] is False


def test_execute_order_is_blocked_by_default(monkeypatch):
    monkeypatch.delenv("CORTEX_LIVE_TRADING_ENABLED", raising=False)

    with pytest.raises(PermissionError, match="Execução real desabilitada"):
        _provider(monkeypatch).execute_order("TEST", "BUY", 0.01, 95.0, 110.0)


def test_preview_rejects_invalid_buy_levels(monkeypatch):
    with pytest.raises(ValueError, match="stop deve ficar abaixo"):
        _provider(monkeypatch).preview_order("TEST", "BUY", 0.01, 105.0, 110.0)


def test_get_order_status_returns_live_position(monkeypatch):
    status = _provider(monkeypatch).get_order_status("TEST", 123)

    assert status["status"] == "open"
    assert status["position_ticket"] == 123
    assert status["direction"] == "BUY"
    assert status["current_price"] == 101.0
    assert status["profit"] == 1.0


def test_close_position_sends_opposite_order_for_cortex_ticket(monkeypatch):
    monkeypatch.setenv("CORTEX_LIVE_TRADING_ENABLED", "true")
    result = _provider(monkeypatch).close_position(123)

    assert result["position_ticket"] == 123
    assert result["deal_ticket"] == 789
    assert result["executed_price"] == 99.9


def test_preview_pending_buy_below_market_uses_buy_limit(monkeypatch):
    preview = _provider(monkeypatch).preview_pending_order("TEST", "BUY", 0.037, 98.0, 95.0, 110.0)

    assert preview["order_kind"] == "pending"
    assert preview["pending_type"] == "BUY_LIMIT"
    assert preview["volume"] == 0.03
    assert preview["entry_price"] == 98.0
    assert preview["estimated_loss"] == 9.0
    assert preview["estimated_profit"] == 36.0


def test_execute_pending_order_requires_live_trading(monkeypatch):
    monkeypatch.delenv("CORTEX_LIVE_TRADING_ENABLED", raising=False)

    with pytest.raises(PermissionError, match="real desabilitada"):
        _provider(monkeypatch).execute_pending_order("TEST", "BUY", 0.01, 98.0, 95.0, 110.0)


def test_list_and_cancel_cortex_pending_order(monkeypatch):
    provider = _provider(monkeypatch)
    pending = provider.list_pending_orders()

    assert len(pending) == 1
    assert pending[0]["pending_type"] == "BUY_LIMIT"
    assert pending[0]["entry_price"] == 98.0

    monkeypatch.setenv("CORTEX_LIVE_TRADING_ENABLED", "true")
    cancelled = provider.cancel_pending_order(456)
    assert cancelled["order_ticket"] == 456
    assert cancelled["message"] == "Done"
