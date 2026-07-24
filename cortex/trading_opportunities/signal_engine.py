"""Signal generation and decision consolidation."""

from __future__ import annotations

from typing import Sequence

from .indicators import compute_technical_snapshot
from .risk import calculate_risk_assessment
from .schemas import (
    Direction,
    OHLCVBar,
    OpportunityRequest,
    OpportunitySignal,
    SetupCandidate,
)
from .strategies import (
    breakout_candidate,
    mean_reversion_candidate,
    pullback_candidate,
    trend_following_candidate,
)


BASE_WARNINGS = [
    "Sinal técnico apenas para fins educacionais; não constitui recomendação financeira.",
    "É necessária validação humana antes de qualquer decisão de operação.",
    "O Cortex não executa ordens reais neste módulo de oportunidades.",
]


class TradingOpportunitySignalEngine:
    """Generate structured preliminary signals from OHLCV data."""

    def analyze(self, request: OpportunityRequest, bars: Sequence[OHLCVBar]) -> list[OpportunitySignal]:
        snapshot = compute_technical_snapshot(bars)
        latest_price = bars[-1].close
        candidates = self._rank_candidates(
            [
                breakout_candidate(snapshot),
                pullback_candidate(snapshot),
                trend_following_candidate(snapshot),
                mean_reversion_candidate(snapshot),
            ]
        )

        signals = [
            self._build_signal(request, candidate, snapshot, latest_price)
            for candidate in candidates[: request.max_signals]
        ]
        if not signals:
            signals.append(self._build_wait_signal(request, "sem_setup", ["Nenhum setup pôde ser avaliado."]))
        return signals

    def _rank_candidates(self, candidates: Sequence[SetupCandidate]) -> list[SetupCandidate]:
        actionable = [candidate for candidate in candidates if candidate.direction in {Direction.BUY, Direction.SELL}]
        if actionable:
            ranked = sorted(actionable, key=lambda candidate: candidate.score, reverse=True)
            return ranked

        avoid = SetupCandidate(
            name="evitar_mercado_de_baixa_qualidade",
            direction=Direction.AVOID,
            score=0.15,
            technical_reasons=["Nenhum setup direcional atingiu o nível mínimo de qualidade."],
        )
        return [avoid]

    def _build_signal(
        self,
        request: OpportunityRequest,
        candidate: SetupCandidate,
        snapshot,
        latest_price: float,
    ) -> OpportunitySignal:
        direction = candidate.direction
        confidence = candidate.score
        technical_reasons = list(candidate.technical_reasons)

        if snapshot.volatility_pct > 6:
            direction = Direction.AVOID
            confidence = min(confidence, 0.35)
            technical_reasons.append("A volatilidade medida pelo ATR está elevada para um sinal de curto prazo.")

        if direction in {Direction.BUY, Direction.SELL} and confidence < 0.5:
            direction = Direction.WAIT
            technical_reasons.append("A pontuação do setup está abaixo do limite operacional.")

        risk = calculate_risk_assessment(
            direction=direction,
            latest_price=latest_price,
            snapshot=snapshot,
            capital=request.capital,
            max_risk_per_trade=request.max_risk_per_trade,
            risk_profile=request.risk_profile,
        )

        warnings = list(BASE_WARNINGS)
        if direction == Direction.AVOID:
            warnings.append("As condições de mercado estão desfavoráveis para um sinal preliminar.")
        elif direction == Direction.WAIT:
            warnings.append("O sinal deve permanecer apenas em observação até que haja uma confirmação melhor.")

        return OpportunitySignal(
            symbol=request.symbol,
            strategy_type=request.strategy_type,
            timeframe=request.timeframe,
            direction=direction,
            confidence_score=round(confidence, 2),
            setup_name=candidate.name,
            entry_price=risk.entry_price,
            stop_loss=risk.stop_loss,
            take_profit=risk.take_profit,
            risk_reward_ratio=risk.risk_reward_ratio,
            position_size=risk.position_size,
            max_loss=risk.max_loss,
            technical_reasons=technical_reasons,
            risk_reasons=risk.risk_reasons,
            invalidation_criteria=risk.invalidation_criteria,
            warnings=warnings,
        )

    def _build_wait_signal(self, request: OpportunityRequest, setup_name: str, reasons: list[str]) -> OpportunitySignal:
        return OpportunitySignal(
            symbol=request.symbol,
            strategy_type=request.strategy_type,
            timeframe=request.timeframe,
            direction=Direction.WAIT,
            confidence_score=0.0,
            setup_name=setup_name,
            technical_reasons=reasons,
            warnings=BASE_WARNINGS + ["Nenhum sinal operacional foi gerado."],
        )
