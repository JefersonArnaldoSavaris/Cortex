"""High-level service for Trading Opportunities."""

from __future__ import annotations

import json
from pathlib import Path

from .config import DEFAULT_OPPORTUNITY_LOG_PATH
from .providers import MarketDataProvider, MockMarketDataProvider, MT5ProviderStub, TwelveDataMarketDataProvider, YFinanceMarketDataProvider
from .schemas import OpportunityAnalysisResult, OpportunityRequest, OpportunitySignal, Timeframe
from .signal_engine import TradingOpportunitySignalEngine
from .strategies.catalog import get_strategy


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
        definition = get_strategy(request.strategy_id)
        if request.timeframe.value not in definition.supported_timeframes:
            raise ValueError(
                f"A estratégia {definition.name} não suporta {request.timeframe.value}. "
                f"Use: {', '.join(definition.supported_timeframes)}."
            )
        bars = list(provider.get_ohlcv(request.symbol, request.timeframe, request.limit))
        context_bars = None
        if request.strategy_id == "smc":
            context_timeframe = {
                Timeframe.M1: Timeframe.M15,
                Timeframe.M5: Timeframe.H1,
                Timeframe.M15: Timeframe.H1,
                Timeframe.M30: Timeframe.H4,
                Timeframe.H1: Timeframe.H4,
                Timeframe.H4: Timeframe.D1,
                Timeframe.D1: Timeframe.D1,
            }[request.timeframe]
            context_bars = list(provider.get_ohlcv(request.symbol, context_timeframe, max(120, request.limit)))
        signals = self.engine.analyze(request, bars, context_bars)
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
        if name in {"twelvedata", "twelve_data"}:
            return TwelveDataMarketDataProvider()
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
