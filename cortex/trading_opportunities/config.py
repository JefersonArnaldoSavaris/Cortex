"""Configuration defaults for short-term trading opportunity analysis."""

from __future__ import annotations

import os
from pathlib import Path


TIMEFRAME_TO_YFINANCE_INTERVAL = {
    "M1": "1m",
    "M5": "5m",
    "M15": "15m",
    "M30": "30m",
    "H1": "60m",
    "H4": "1h",
    "D1": "1d",
}

DEFAULT_LIMIT = 160
DEFAULT_PROVIDER = "mock"
ENABLE_LIVE_TRADING = os.getenv("ENABLE_LIVE_TRADING", "false").lower() == "true"

DEFAULT_OPPORTUNITY_LOG_PATH = os.getenv(
    "CORTEX_OPPORTUNITY_LOG_PATH",
    str(Path.home() / ".cortex" / "memory" / "trading_opportunities.md"),
)

RISK_PROFILE_MULTIPLIERS = {
    "conservador": 0.75,
    "moderado": 1.0,
    "agressivo": 1.25,
}

STRATEGY_TIME_HORIZONS = {
    "daytrade": "intraday; signal should be revalidated frequently",
    "swingtrade": "multi-session; signal should be revalidated at each new candle",
}
