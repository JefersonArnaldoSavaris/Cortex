from __future__ import annotations

import os
import re
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv

from cortex.default_config import DEFAULT_CONFIG
from cortex.graph.trading_graph import CortexGraph
from cortex.llm_clients.model_catalog import MODEL_OPTIONS

from .models import (
    AnalysisCreateResponse,
    AnalysisListResponse,
    AnalysisRecord,
    AnalysisRequest,
    AnalysisStatus,
    AssetHistoryResponse,
    AssetOption,
    ConfigOptionsResponse,
    ModelOption,
    PricePoint,
    ProviderOptions,
)
from .repository import (
    append_event,
    create_analysis_record,
    get_analysis_record,
    get_report_markdown,
    list_analysis_records,
    set_analysis_status,
)
from .reporting import save_analysis_report


class AnalysisService:
    """Development analysis runner.

    This is intentionally shaped like a job service so it can be replaced by
    Celery/PostgreSQL without changing the frontend contract.
    """

    def __init__(self, reports_dir: Path | None = None):
        load_dotenv()
        load_dotenv(".env.enterprise", override=False)
        self._executor = ThreadPoolExecutor(max_workers=int(os.getenv("CORTEX_API_WORKERS", "1")))
        self.reports_dir = reports_dir or Path(os.getenv("CORTEX_REPORTS_DIR", "reports"))

    def list_records(self) -> AnalysisListResponse:
        return AnalysisListResponse(analyses=list_analysis_records())

    def get_record(self, analysis_id: str) -> AnalysisRecord | None:
        return get_analysis_record(analysis_id)

    def read_report(self, analysis_id: str) -> str | None:
        markdown = get_report_markdown(analysis_id)
        if markdown:
            return markdown

        record = self.get_record(analysis_id)
        if not record or not record.report_path:
            return None
        path = Path(record.report_path)
        if not path.exists():
            return None
        return path.read_text(encoding="utf-8")

    def create_analysis(self, request: AnalysisRequest) -> AnalysisCreateResponse:
        analysis_id = uuid.uuid4().hex
        record = create_analysis_record(analysis_id, request)
        self._executor.submit(self._run_analysis, analysis_id)
        return AnalysisCreateResponse(analysis=record)

    def config_options(self) -> ConfigOptionsResponse:
        providers = {
            provider: ProviderOptions(
                quick=[ModelOption(label=label, value=value) for label, value in modes["quick"]],
                deep=[ModelOption(label=label, value=value) for label, value in modes["deep"]],
            )
            for provider, modes in MODEL_OPTIONS.items()
            if provider not in {"azure"}
        }
        return ConfigOptionsResponse(
            providers=providers,
            assets=get_assets(),
            default_request=AnalysisRequest(),
        )

    def _append_event(self, analysis_id: str, message: str, level: str = "info") -> None:
        append_event(analysis_id, message, level)

    def _set_status(
        self,
        analysis_id: str,
        status: AnalysisStatus,
        *,
        decision: str | None = None,
        report_path: str | None = None,
        report_markdown: str | None = None,
        error: str | None = None,
    ) -> None:
        set_analysis_status(
            analysis_id,
            status,
            decision=decision,
            report_path=report_path,
            report_markdown=report_markdown,
            error=error,
        )

    def _run_analysis(self, analysis_id: str) -> None:
        record = self.get_record(analysis_id)
        if record is None:
            return

        request = record.request
        self._set_status(analysis_id, AnalysisStatus.RUNNING)
        self._append_event(analysis_id, "Worker started")

        try:
            config = DEFAULT_CONFIG.copy()
            config["llm_provider"] = request.provider
            config["quick_think_llm"] = request.quick_model
            config["deep_think_llm"] = request.deep_model
            config["max_debate_rounds"] = request.research_depth
            config["max_risk_discuss_rounds"] = request.research_depth
            config["output_language"] = request.output_language
            config["checkpoint_enabled"] = request.checkpoint
            config["analysis_mode"] = request.mode.value

            if request.provider == "google":
                config["google_thinking_level"] = "minimal"

            self._append_event(analysis_id, "Building Cortex graph")
            graph = CortexGraph(
                selected_analysts=request.analysts,
                debug=False,
                config=config,
            )

            self._append_event(analysis_id, f"Running {request.mode.value} analysis for {request.ticker.upper()}")
            final_state, decision = graph.propagate(request.ticker.upper(), request.analysis_date)

            output_dir = self.reports_dir / f"{request.ticker.upper()}_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{analysis_id[:8]}"
            report_path = save_analysis_report(final_state, request.ticker, output_dir)
            report_markdown = report_path.read_text(encoding="utf-8")
            self._append_event(analysis_id, "Report saved")
            self._set_status(
                analysis_id,
                AnalysisStatus.COMPLETED,
                decision=str(decision) if decision is not None else None,
                report_path=str(report_path),
                report_markdown=report_markdown,
            )
        except Exception as exc:
            self._append_event(analysis_id, str(exc), level="error")
            self._set_status(analysis_id, AnalysisStatus.FAILED, error=str(exc))


analysis_service = AnalysisService()


ASSET_OPTIONS = [
    AssetOption(
        symbol="SPY",
        name="SPDR S&P 500 ETF",
        category="ETF",
        default_provider_symbol="SPY",
    ),
    AssetOption(
        symbol="BTC",
        name="Bitcoin",
        category="Cripto",
        default_provider_symbol="BTC-USD",
    ),
    AssetOption(
        symbol="BTCUSD",
        name="Bitcoin / Dólar",
        category="Cripto",
        default_provider_symbol="BTC-USD",
    ),
    AssetOption(
        symbol="XAUUSD",
        name="Ouro spot / Dólar",
        category="Metal",
        default_provider_symbol="GC=F",
    ),
    AssetOption(
        symbol="XAGUSD",
        name="Prata / Dólar",
        category="Metal",
        default_provider_symbol="SI=F",
    ),
    AssetOption(
        symbol="EURUSD",
        name="Euro / Dólar",
        category="Forex",
        default_provider_symbol="EURUSD=X",
    ),
    AssetOption(
        symbol="USDJPY",
        name="Dólar / Iene",
        category="Forex",
        default_provider_symbol="JPY=X",
    ),
    AssetOption(
        symbol="USDBRL",
        name="Dólar / Real",
        category="Forex",
        default_provider_symbol="BRL=X",
    ),
]

SUPPORTED_HISTORY_PERIODS: dict[str, list[str]] = {
    "1m": ["1d", "7d"],
    "5m": ["1d", "5d", "60d"],
    "15m": ["1d", "5d", "1mo", "60d"],
    "1h": ["5d", "1mo", "3mo", "2y"],
    "4h": ["1mo", "3mo", "6mo", "2y"],
    "1d": ["1mo", "3mo", "6mo", "1y", "max"],
}

FETCH_INTERVALS: dict[str, str] = {
    "1m": "1m",
    "5m": "5m",
    "15m": "15m",
    "1h": "60m",
    "4h": "60m",
    "1d": "1d",
}

RESAMPLE_RULES: dict[str, str | None] = {
    "1m": None,
    "5m": None,
    "15m": None,
    "1h": None,
    "4h": "4h",
    "1d": None,
}


def get_assets() -> list[AssetOption]:
    return ASSET_OPTIONS


_SAFE_MARKET_SYMBOL = re.compile(r"^[A-Z0-9^][A-Z0-9.^=_-]{0,29}$")


def search_assets(query: str, limit: int = 12) -> list[AssetOption]:
    """Search Yahoo Finance's public catalogue without broker credentials."""
    normalized_query = query.strip()
    if len(normalized_query) < 2:
        return ASSET_OPTIONS[:limit]

    normalized_for_match = normalized_query.upper().replace("/", "").replace(" ", "")
    curated = [
        asset
        for asset in ASSET_OPTIONS
        if normalized_for_match in asset.symbol.upper()
        or normalized_query.casefold() in asset.name.casefold()
    ]
    exact_curated = [asset for asset in curated if asset.symbol == normalized_for_match]
    if exact_curated:
        return exact_curated[:limit]

    from cortex.trading_opportunities.providers.twelve_data_provider import (
        TwelveDataMarketDataProvider,
        twelve_data_configured,
    )

    if twelve_data_configured():
        provider_results = TwelveDataMarketDataProvider().search_symbols(normalized_query, limit)
        assets = list(curated)
        seen = {asset.symbol for asset in assets}
        for item in provider_results:
            symbol = item["symbol"].strip().upper()
            if not _SAFE_MARKET_SYMBOL.fullmatch(symbol) or symbol in seen:
                continue
            seen.add(symbol)
            assets.append(
                AssetOption(
                    symbol=symbol,
                    name=item["name"],
                    category=item["category"],
                    default_provider_symbol=item["provider_symbol"],
                )
            )
        return assets[:limit]

    import yfinance as yf

    result = yf.Search(
        normalized_query,
        max_results=min(max(limit, 1), 25),
        news_count=0,
        lists_count=0,
        include_cb=False,
        include_nav_links=False,
        include_research=False,
        include_cultural_assets=False,
        timeout=8,
    )
    assets: list[AssetOption] = list(curated)
    seen: set[str] = {asset.symbol for asset in curated}
    supported_quote_types = {
        "EQUITY",
        "ETF",
        "INDEX",
        "FUTURE",
        "CRYPTOCURRENCY",
        "CURRENCY",
        "MUTUALFUND",
    }
    for quote in result.quotes:
        symbol = str(quote.get("symbol") or "").strip().upper()
        quote_type_raw = str(quote.get("quoteType") or "").upper()
        if (
            not _SAFE_MARKET_SYMBOL.fullmatch(symbol)
            or symbol in seen
            or quote_type_raw not in supported_quote_types
        ):
            continue
        seen.add(symbol)
        quote_type = str(quote.get("typeDisp") or quote_type_raw or "Ativo")
        assets.append(
            AssetOption(
                symbol=symbol,
                name=str(quote.get("longname") or quote.get("shortname") or symbol),
                category=quote_type.replace("_", " ").title(),
                default_provider_symbol=symbol,
            )
        )
    return assets[:limit]


def _resolve_free_asset(symbol: str) -> AssetOption:
    normalized_symbol = symbol.strip().upper()
    known = next((item for item in ASSET_OPTIONS if item.symbol == normalized_symbol), None)
    if known is not None:
        return known
    if not _SAFE_MARKET_SYMBOL.fullmatch(normalized_symbol):
        raise ValueError(f"Unsupported asset: {symbol}")
    return AssetOption(
        symbol=normalized_symbol,
        name=normalized_symbol,
        category="Mercado",
        default_provider_symbol=normalized_symbol,
    )


def get_free_market_tick(symbol: str) -> dict[str, str | int | float]:
    """Return the most recent free quote for incremental chart updates."""
    import yfinance as yf

    asset = _resolve_free_asset(symbol)
    ticker = yf.Ticker(asset.default_provider_symbol)
    volume = 0.0
    try:
        price = float(ticker.fast_info["last_price"])
        if price <= 0 or price != price:
            raise ValueError("invalid last price")
        try:
            volume = float(ticker.fast_info.get("last_volume", 0) or 0)
        except (KeyError, TypeError, ValueError):
            volume = 0.0
    except (AttributeError, KeyError, TypeError, ValueError):
        frame = ticker.history(
            period="1d",
            interval="1m",
            auto_adjust=False,
            prepost=False,
        )
        if frame.empty:
            raise ValueError(f"No market quote returned by yFinance for {symbol}")
        row = frame.iloc[-1]
        price = float(row["Close"])
        volume = float(row.get("Volume", 0) or 0)

    return {
        "type": "tick",
        "symbol": asset.symbol,
        "timestamp": int(time.time() * 1000),
        "bid": price,
        "ask": price,
        "last": price,
        "volume": volume,
    }


def _validate_history_request(period: str, interval: str) -> tuple[str, str]:
    interval_key = interval.lower()
    if interval_key not in SUPPORTED_HISTORY_PERIODS:
        raise ValueError(f"Unsupported interval: {interval}")

    normalized_period = period.lower()
    supported_periods = SUPPORTED_HISTORY_PERIODS[interval_key]
    if normalized_period not in supported_periods:
        allowed = ", ".join(supported_periods)
        raise ValueError(f"Unsupported period '{period}' for interval '{interval}'. Supported periods: {allowed}")

    return normalized_period, interval_key


def _resample_ohlc(data: pd.DataFrame, rule: str | None) -> pd.DataFrame:
    if not rule:
        return data

    aggregated = data.resample(rule).agg(
        {
            "Open": "first",
            "High": "max",
            "Low": "min",
            "Close": "last",
            "Volume": "sum",
        }
    )
    return aggregated.dropna(subset=["Open", "High", "Low", "Close"])


def _format_history_timestamp(index: pd.Timestamp, interval: str) -> str:
    if interval == "1d":
        return index.strftime("%Y-%m-%d")
    return index.strftime("%Y-%m-%dT%H:%M:%S")


def get_asset_history(
    symbol: str,
    period: str = "6mo",
    interval: str = "1d",
    mt5_provider=None,
) -> AssetHistoryResponse:
    if mt5_provider is not None:
        from cortex.trading_opportunities.schemas import Timeframe

        normalized_period, normalized_interval = _validate_history_request(period, interval)
        timeframe = {
            "1m": Timeframe.M1,
            "5m": Timeframe.M5,
            "15m": Timeframe.M15,
            "1h": Timeframe.H1,
            "4h": Timeframe.H4,
            "1d": Timeframe.D1,
        }[normalized_interval]
        period_days = {
            "1d": 1,
            "5d": 5,
            "7d": 7,
            "1mo": 31,
            "60d": 60,
            "3mo": 93,
            "6mo": 186,
            "1y": 366,
            "2y": 732,
            "max": 36_500,
        }[normalized_period]
        bars_per_day = {"1m": 1440, "5m": 288, "15m": 96, "1h": 24, "4h": 6, "1d": 1}[normalized_interval]
        limit = min(max(period_days * bars_per_day, 50), 5000)
        bars = mt5_provider.get_ohlcv(symbol, timeframe, limit)
        return AssetHistoryResponse(
            symbol=symbol,
            name=symbol,
            period=normalized_period,
            interval=normalized_interval,
            points=[
                PricePoint(
                    date=bar.timestamp.isoformat(),
                    open=bar.open,
                    high=bar.high,
                    low=bar.low,
                    close=bar.close,
                    volume=bar.volume,
                )
                for bar in bars
            ],
        )

    import yfinance as yf

    asset = _resolve_free_asset(symbol)

    normalized_period, normalized_interval = _validate_history_request(period, interval)
    fetch_interval = FETCH_INTERVALS[normalized_interval]

    ticker = yf.Ticker(asset.default_provider_symbol)
    data = ticker.history(period=normalized_period, interval=fetch_interval, auto_adjust=False, prepost=False)
    if data.empty:
        return AssetHistoryResponse(
            symbol=asset.symbol,
            name=asset.name,
            period=normalized_period,
            interval=normalized_interval,
            points=[],
        )

    if data.index.tz is not None:
        data.index = data.index.tz_localize(None)

    data = data.sort_index()
    data = _resample_ohlc(data, RESAMPLE_RULES[normalized_interval])

    points = [
        PricePoint(
            date=_format_history_timestamp(index, normalized_interval),
            open=round(float(row["Open"]), 4),
            high=round(float(row["High"]), 4),
            low=round(float(row["Low"]), 4),
            close=round(float(row["Close"]), 4),
            volume=None if "Volume" not in row or row["Volume"] != row["Volume"] else float(row["Volume"]),
        )
        for index, row in data.iterrows()
        if row.get("Open") == row.get("Open")
        and row.get("High") == row.get("High")
        and row.get("Low") == row.get("Low")
        and row.get("Close") == row.get("Close")
    ]
    return AssetHistoryResponse(
        symbol=asset.symbol,
        name=asset.name,
        period=normalized_period,
        interval=normalized_interval,
        points=points,
    )
