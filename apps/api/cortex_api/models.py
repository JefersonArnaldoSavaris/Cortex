from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field


AnalystKey = Literal["market", "social", "news", "fundamentals"]
ProviderKey = Literal[
    "openai",
    "google",
    "anthropic",
    "xai",
    "deepseek",
    "qwen",
    "glm",
    "openrouter",
    "ollama",
    "azure",
]


class AnalysisMode(str, Enum):
    QUICK_TECHNICAL = "quick_technical"
    STANDARD = "standard"
    FULL = "full"


class AnalysisStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class AnalysisRequest(BaseModel):
    ticker: str = Field(default="SPY", min_length=1, max_length=32, examples=["SPY"])
    analysis_date: str = Field(
        default_factory=lambda: datetime.now().strftime("%Y-%m-%d"),
        pattern=r"^\d{4}-\d{2}-\d{2}$",
        examples=["2026-04-24"],
    )
    provider: ProviderKey = "google"
    quick_model: str = "gemini-2.5-flash-lite"
    deep_model: str = "gemini-2.5-flash-lite"
    analysts: list[AnalystKey] = Field(default_factory=lambda: ["market"])
    research_depth: int = Field(default=1, ge=1, le=5)
    output_language: str = "Portuguese"
    mode: AnalysisMode = AnalysisMode.QUICK_TECHNICAL
    checkpoint: bool = False


class AnalysisEvent(BaseModel):
    timestamp: datetime
    level: Literal["info", "warning", "error"] = "info"
    message: str


class AnalysisRecord(BaseModel):
    id: str
    status: AnalysisStatus
    request: AnalysisRequest
    created_at: datetime
    updated_at: datetime
    decision: str | None = None
    report_path: str | None = None
    error: str | None = None
    events: list[AnalysisEvent] = Field(default_factory=list)


class AnalysisListResponse(BaseModel):
    analyses: list[AnalysisRecord]


class AnalysisCreateResponse(BaseModel):
    analysis: AnalysisRecord


class ReportResponse(BaseModel):
    analysis_id: str
    markdown: str


class AssetOption(BaseModel):
    symbol: str
    name: str
    category: str
    default_provider_symbol: str


class PricePoint(BaseModel):
    date: str
    open: float
    high: float
    low: float
    close: float
    volume: float | None = None


class AssetHistoryResponse(BaseModel):
    symbol: str
    name: str
    period: str
    interval: str
    points: list[PricePoint]


class ModelOption(BaseModel):
    label: str
    value: str


class ProviderOptions(BaseModel):
    quick: list[ModelOption]
    deep: list[ModelOption]


class ConfigOptionsResponse(BaseModel):
    providers: dict[str, ProviderOptions]
    assets: list[AssetOption]
    default_request: AnalysisRequest
