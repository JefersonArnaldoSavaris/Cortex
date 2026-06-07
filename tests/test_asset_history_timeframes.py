from pathlib import Path
import sys

import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from apps.api.tradingagents_api.service import _resample_ohlc, _validate_history_request


@pytest.mark.unit
def test_validate_history_request_rejects_invalid_period_for_interval():
    with pytest.raises(ValueError):
        _validate_history_request("1y", "1m")


@pytest.mark.unit
def test_resample_ohlc_builds_4h_candles():
    index = pd.date_range("2026-05-02 10:00:00", periods=4, freq="h")
    frame = pd.DataFrame(
        {
            "Open": [100.0, 101.0, 102.0, 103.0],
            "High": [102.0, 103.0, 104.0, 105.0],
            "Low": [99.0, 100.0, 101.0, 102.0],
            "Close": [101.0, 102.0, 103.0, 104.0],
            "Volume": [10.0, 15.0, 20.0, 25.0],
        },
        index=index,
    )

    result = _resample_ohlc(frame, "4h")

    assert len(result) == 2

    first_candle = result.iloc[0]
    assert first_candle["Open"] == 100.0
    assert first_candle["High"] == 103.0
    assert first_candle["Low"] == 99.0
    assert first_candle["Close"] == 102.0
    assert first_candle["Volume"] == 25.0

    second_candle = result.iloc[1]
    assert second_candle["Open"] == 102.0
    assert second_candle["High"] == 105.0
    assert second_candle["Low"] == 101.0
    assert second_candle["Close"] == 104.0
    assert second_candle["Volume"] == 45.0
