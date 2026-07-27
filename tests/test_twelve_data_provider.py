from datetime import timezone

from cortex.trading_opportunities.providers.twelve_data_provider import (
    TwelveDataMarketDataProvider,
    cortex_symbol,
    twelve_data_symbol,
)
from cortex.trading_opportunities.schemas import Timeframe


def test_twelve_data_symbol_aliases():
    assert twelve_data_symbol("XAUUSD") == "XAU/USD"
    assert twelve_data_symbol("EUR/USD") == "EUR/USD"
    assert cortex_symbol("XAU/USD") == "XAUUSD"


def test_twelve_data_provider_maps_candles_oldest_to_newest(monkeypatch):
    provider = TwelveDataMarketDataProvider(api_key="test")
    monkeypatch.setattr(
        provider,
        "_get",
        lambda path, params: {
            "values": [
                {
                    "datetime": "2026-07-24 12:00:00",
                    "open": "2400.0",
                    "high": "2401.0",
                    "low": "2399.0",
                    "close": "2400.5",
                    "volume": "10",
                },
                {
                    "datetime": "2026-07-24 12:01:00",
                    "open": "2400.5",
                    "high": "2402.0",
                    "low": "2400.0",
                    "close": "2401.5",
                    "volume": "12",
                },
            ]
        },
    )

    bars = provider.get_ohlcv("XAUUSD", Timeframe.M1, 2)

    assert len(bars) == 2
    assert bars[0].close == 2400.5
    assert bars[1].close == 2401.5
    assert bars[0].timestamp.tzinfo == timezone.utc


def test_twelve_data_provider_maps_symbol_search(monkeypatch):
    provider = TwelveDataMarketDataProvider(api_key="test")
    monkeypatch.setattr(
        provider,
        "_get",
        lambda path, params: {
            "data": [
                {
                    "symbol": "XAU/USD",
                    "instrument_name": "Gold Spot / US Dollar",
                    "instrument_type": "Commodity",
                }
            ]
        },
    )

    results = provider.search_symbols("gold")

    assert results == [
        {
            "symbol": "XAUUSD",
            "provider_symbol": "XAU/USD",
            "name": "Gold Spot / US Dollar",
            "category": "Commodity",
        }
    ]
