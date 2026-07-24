"""High-level service for Trading Opportunities."""

from __future__ import annotations

import json
from pathlib import Path

from .config import DEFAULT_OPPORTUNITY_LOG_PATH
from .providers import MarketDataProvider, MockMarketDataProvider, MT5ProviderStub, YFinanceMarketDataProvider
from .schemas import OpportunityAnalysisResult, OpportunityRequest, OpportunitySignal
from .signal_engine import TradingOpportunitySignalEngine


class TradingOpportunityAgent:
    """Coordinate data retrieval, signal generation and audit logging."""

    def __init__(
        self,
        provider: MarketDataProvider | None = None,
        log_path: str | None = DEFAULT_OPPORTUNITY_LOG_PATH,
    ) -> None:
        self.provider = provider
        self.log_path = Path(log_path).expanduser() if log_path else None
        self.engine = TradingOpportunitySignalEngine()

    def analyze(self, request: OpportunityRequest) -> OpportunityAnalysisResult:
        provider = self.provider or self._provider_from_name(request.provider)
        bars = list(provider.get_ohlcv(request.symbol, request.timeframe, request.limit))
        signals = self.engine.analyze(request, bars)
        result = OpportunityAnalysisResult(
            request=request,
            signals=signals,
            warnings=[
                "O módulo de oportunidades fornece análises exclusivamente educacionais.",
                "A integração atual com o MT5 não executa ordens.",
            ],
        )
        self._store_audit_entry(result)
        return result

    def analyze_one(self, request: OpportunityRequest) -> OpportunitySignal:
        return self.analyze(request).signals[0]

    def _provider_from_name(self, name: str) -> MarketDataProvider:
        if name == "mock":
            return MockMarketDataProvider()
        if name in {"yfinance", "yf"}:
            return YFinanceMarketDataProvider()
        if name == "mt5":
            return MT5ProviderStub()
        raise ValueError(f"Unsupported market data provider: {name}")

    def _store_audit_entry(self, result: OpportunityAnalysisResult) -> None:
        if not self.log_path:
            return
        self.log_path.parent.mkdir(parents=True, exist_ok=True)
        payload = result.model_dump(mode="json")
        first_signal = result.signals[0] if result.signals else None
        direction = first_signal.direction.value if first_signal else "NONE"
        tag = (
            f"[{result.generated_at.isoformat()} | {result.request.symbol} | "
            f"{result.request.strategy_type.value} | {result.request.timeframe.value} | {direction}]"
        )
        with open(self.log_path, "a", encoding="utf-8") as file:
            file.write(f"{tag}\n\nJSON:\n{json.dumps(payload, indent=2, ensure_ascii=False)}\n\n<!-- ENTRY_END -->\n\n")
