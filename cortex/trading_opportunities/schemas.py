"""Pydantic schemas for trading-opportunity analysis."""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator, model_validator


class StrategyType(str, Enum):
    DAYTRADE = "daytrade"
    SWINGTRADE = "swingtrade"


class Timeframe(str, Enum):
    M1 = "M1"
    M5 = "M5"
    M15 = "M15"
    M30 = "M30"
    H1 = "H1"
    H4 = "H4"
    D1 = "D1"


class RiskProfile(str, Enum):
    CONSERVADOR = "conservador"
    MODERADO = "moderado"
    AGRESSIVO = "agressivo"


class Direction(str, Enum):
    BUY = "BUY"
    SELL = "SELL"
    WAIT = "WAIT"
    AVOID = "AVOID"


class OHLCVBar(BaseModel):
    timestamp: datetime
    open: float = Field(gt=0)
    high: float = Field(gt=0)
    low: float = Field(gt=0)
    close: float = Field(gt=0)
    volume: float = Field(ge=0)

    @model_validator(mode="after")
    def validate_ohlc(self) -> "OHLCVBar":
        if self.high < max(self.open, self.close) or self.low > min(self.open, self.close):
            raise ValueError("OHLC values are inconsistent")
        return self


class OpportunityRequest(BaseModel):
    symbol: str = Field(min_length=1, max_length=32)
    strategy_type: StrategyType = StrategyType.DAYTRADE
    timeframe: Timeframe = Timeframe.M15
    risk_profile: RiskProfile = RiskProfile.MODERADO
    capital: float = Field(default=10_000.0, gt=0)
    max_risk_per_trade: float = Field(default=0.01, gt=0, le=1)
    max_signals: int = Field(default=1, ge=1, le=20)
    provider: str = Field(default="mock")
    limit: int = Field(default=160, ge=50, le=1_000)

    @field_validator("symbol")
    @classmethod
    def normalize_symbol(cls, value: str) -> str:
        return value.strip()

    @field_validator("provider")
    @classmethod
    def normalize_provider(cls, value: str) -> str:
        return value.strip().lower()

    @model_validator(mode="after")
    def normalize_symbol_for_provider(self) -> "OpportunityRequest":
        # Broker suffixes can be case-sensitive (for example Exness uses
        # symbols such as ENJUSDm). Preserve the exact MT5 catalog value.
        if self.provider != "mt5":
            self.symbol = self.symbol.upper()
        return self


class TechnicalSnapshot(BaseModel):
    trend: str
    support: float
    resistance: float
    sma_fast: float
    sma_slow: float
    rsi: float
    macd: float
    macd_signal: float
    atr: float
    average_volume: float
    latest_volume: float
    volatility_pct: float
    breakout: Optional[str] = None
    pullback: Optional[str] = None
    candle_pattern: Optional[str] = None


class SetupCandidate(BaseModel):
    name: str
    direction: Direction
    score: float = Field(ge=0, le=1)
    technical_reasons: List[str] = Field(default_factory=list)


class RiskAssessment(BaseModel):
    entry_price: Optional[float] = None
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    risk_reward_ratio: Optional[float] = None
    position_size: float = Field(default=0, ge=0)
    max_loss: float = Field(default=0, ge=0)
    risk_reasons: List[str] = Field(default_factory=list)
    invalidation_criteria: List[str] = Field(default_factory=list)


class OpportunitySignal(BaseModel):
    symbol: str
    strategy_type: StrategyType
    timeframe: Timeframe
    direction: Direction
    confidence_score: float = Field(ge=0, le=1)
    setup_name: str
    entry_price: Optional[float] = None
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    risk_reward_ratio: Optional[float] = None
    position_size: float = Field(default=0, ge=0)
    max_loss: float = Field(default=0, ge=0)
    technical_reasons: List[str] = Field(default_factory=list)
    risk_reasons: List[str] = Field(default_factory=list)
    invalidation_criteria: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class OpportunityAnalysisResult(BaseModel):
    request: OpportunityRequest
    signals: List[OpportunitySignal]
    warnings: List[str] = Field(default_factory=list)
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
