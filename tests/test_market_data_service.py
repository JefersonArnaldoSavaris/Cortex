from types import SimpleNamespace

import pandas as pd
import pytest

from apps.api.cortex_api import service


@pytest.fixture(autouse=True)
def disable_twelve_data_for_yfinance_service_tests(monkeypatch):
    monkeypatch.delenv("TWELVE_DATA_API_KEY", raising=False)


def test_search_assets_maps_yahoo_quotes(monkeypatch):
    quotes = [
        {
            "symbol": "PETR4.SA",
            "longname": "Petróleo Brasileiro S.A. - Petrobras",
            "quoteType": "EQUITY",
        },
        {"symbol": "INVALID SYMBOL", "shortname": "Invalid", "quoteType": "EQUITY"},
    ]
    monkeypatch.setattr(service, "yfinance", SimpleNamespace(Search=lambda *args, **kwargs: None), raising=False)

    import yfinance

    monkeypatch.setattr(yfinance, "Search", lambda *args, **kwargs: SimpleNamespace(quotes=quotes))

    assets = service.search_assets("petrobras")

    assert [asset.symbol for asset in assets] == ["PETR4.SA"]
    assert assets[0].name.startswith("Petróleo Brasileiro")
    assert assets[0].default_provider_symbol == "PETR4.SA"


def test_search_assets_resolves_xauusd_alias_without_remote_search(monkeypatch):
    import yfinance

    def unexpected_search(*args, **kwargs):
        raise AssertionError("exact aliases should not call Yahoo search")

    monkeypatch.setattr(yfinance, "Search", unexpected_search)

    assets = service.search_assets("XAU/USD")

    assert [asset.symbol for asset in assets] == ["XAUUSD"]
    assert assets[0].default_provider_symbol == "GC=F"


def test_search_assets_filters_unsupported_instruments(monkeypatch):
    import yfinance

    quotes = [
        {"symbol": "AAPL", "shortname": "Apple Inc.", "quoteType": "EQUITY"},
        {"symbol": "AAPL-WT", "shortname": "Apple Warrant", "quoteType": "WARRANT"},
        {"symbol": "ODDOPT", "shortname": "Odd option", "quoteType": "OPTION"},
    ]
    monkeypatch.setattr(yfinance, "Search", lambda *args, **kwargs: SimpleNamespace(quotes=quotes))

    assets = service.search_assets("apple")

    assert [asset.symbol for asset in assets] == ["AAPL"]


def test_history_accepts_safe_symbol_outside_curated_catalog(monkeypatch):
    index = pd.DatetimeIndex(["2026-07-23", "2026-07-24"])
    frame = pd.DataFrame(
        {
            "Open": [10.0, 10.5],
            "High": [11.0, 11.5],
            "Low": [9.5, 10.0],
            "Close": [10.5, 11.0],
            "Volume": [1000, 1200],
        },
        index=index,
    )

    import yfinance

    ticker = SimpleNamespace(history=lambda **kwargs: frame)
    monkeypatch.setattr(yfinance, "Ticker", lambda symbol: ticker)

    result = service.get_asset_history("PETR4.SA", period="6mo", interval="1d")

    assert result.symbol == "PETR4.SA"
    assert result.name == "PETR4.SA"
    assert len(result.points) == 2


def test_history_rejects_unsafe_symbol_before_calling_provider():
    try:
        service.get_asset_history("../secret", period="6mo", interval="1d")
    except ValueError as exc:
        assert "Unsupported asset" in str(exc)
    else:
        raise AssertionError("unsafe market symbol should be rejected")


def test_free_market_tick_uses_latest_minute_quote(monkeypatch):
    index = pd.DatetimeIndex(["2026-07-24T12:00:00Z", "2026-07-24T12:01:00Z"])
    frame = pd.DataFrame(
        {"Close": [42.0, 42.5], "Volume": [100, 125]},
        index=index,
    )

    import yfinance

    ticker = SimpleNamespace(history=lambda **kwargs: frame)
    monkeypatch.setattr(yfinance, "Ticker", lambda symbol: ticker)

    tick = service.get_free_market_tick("TEST")

    assert tick["type"] == "tick"
    assert tick["symbol"] == "TEST"
    assert tick["last"] == 42.5
    assert tick["volume"] == 125


def test_free_market_tick_prefers_fast_last_price(monkeypatch):
    import yfinance

    ticker = SimpleNamespace(
        fast_info={"last_price": 2375.25, "last_volume": 42},
        history=lambda **kwargs: (_ for _ in ()).throw(AssertionError("history fallback should not run")),
    )
    monkeypatch.setattr(yfinance, "Ticker", lambda symbol: ticker)

    tick = service.get_free_market_tick("XAUUSD")

    assert tick["symbol"] == "XAUUSD"
    assert tick["last"] == 2375.25
    assert tick["volume"] == 42
