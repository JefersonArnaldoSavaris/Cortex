from __future__ import annotations

import os
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
        symbol="XAUUSD",
        name="Ouro spot / Dólar",
        category="Metal",
        default_provider_symbol="GC=F",
    ),
]

SUPPORTED_HISTORY_PERIODS: dict[str, list[str]] = {
    "1m": ["1d"],
    "5m": ["1d", "5d"],
    "15m": ["1d", "5d", "1mo"],
    "1h": ["5d", "1mo", "3mo"],
    "4h": ["1mo", "3mo", "6mo"],
    "1d": ["1mo", "3mo", "6mo", "1y"],
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


def get_asset_history(symbol: str, period: str = "6mo", interval: str = "1d") -> AssetHistoryResponse:
    import yfinance as yf

    asset = next((item for item in ASSET_OPTIONS if item.symbol == symbol.upper()), None)
    if asset is None:
        raise ValueError(f"Unsupported asset: {symbol}")

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
