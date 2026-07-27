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


class UserRole(str, Enum):
    ADMIN = "admin"
    USER = "user"


class UserPlan(str, Enum):
    FREE = "free"
    PRO = "pro"
    ENTERPRISE = "enterprise"


class UserStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    TRIAL = "trial"
    BLOCKED = "blocked"


class RegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=8, max_length=256)
    accepted_terms: bool


class LoginRequest(BaseModel):
    email: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=1, max_length=256)


class ForgotPasswordRequest(BaseModel):
    email: str = Field(min_length=5, max_length=254)


class AuthUser(BaseModel):
    id: str
    name: str
    email: str
    role: UserRole
    plan: UserPlan
    status: UserStatus
    created_at: datetime
    updated_at: datetime
    last_login_at: datetime | None = None


class AuthResponse(BaseModel):
    user: AuthUser


class MessageResponse(BaseModel):
    message: str


class MT5ConnectRequest(BaseModel):
    login: int = Field(gt=0)
    password: str = Field(min_length=1)
    server: str = Field(min_length=2)
    terminal_path: str | None = None


class MT5StatusResponse(BaseModel):
    connected: bool
    login: int | None = None
    server: str | None = None
    name: str | None = None
    company: str | None = None
    currency: str | None = None
    balance: float | None = None
    equity: float | None = None
    margin: float | None = None
    trade_allowed: bool | None = None
    message: str


class MT5Symbol(BaseModel):
    symbol: str
    name: str
    category: str = "Corretora"
    path: str | None = None
    currency_base: str | None = None
    currency_profit: str | None = None
    visible: bool = False


class MT5SymbolsResponse(BaseModel):
    symbols: list[MT5Symbol]


class OrderPreviewRequest(BaseModel):
    symbol: str = Field(min_length=1, max_length=64)
    direction: Literal["BUY", "SELL"]
    volume: float = Field(gt=0)
    stop_loss: float = Field(gt=0)
    take_profit: float = Field(gt=0)


class OrderPreviewResponse(BaseModel):
    symbol: str
    direction: Literal["BUY", "SELL"]
    volume: float
    requested_volume: float
    entry_price: float
    stop_loss: float
    take_profit: float
    estimated_loss: float
    estimated_profit: float
    estimated_margin: float | None = None
    currency: str
    volume_min: float
    volume_max: float
    volume_step: float
    execution_enabled: bool
    check_message: str
    order_kind: Literal["market", "pending"] = "market"
    pending_type: Literal["BUY_LIMIT", "BUY_STOP", "SELL_LIMIT", "SELL_STOP"] | None = None


class OrderExecuteRequest(OrderPreviewRequest):
    technical_reasons: list[str] = Field(default_factory=list, max_length=20)
    risk_reasons: list[str] = Field(default_factory=list, max_length=20)
    analysis_generated_at: str | None = None


class PendingOrderRequest(OrderExecuteRequest):
    entry_price: float = Field(gt=0)


class OrderExecutionResponse(BaseModel):
    order_ticket: int | None = None
    deal_ticket: int | None = None
    retcode: int
    message: str
    executed_price: float | None = None
    volume: float
    position_ticket: int | None = None


class OrderCloseRequest(BaseModel):
    position_ticket: int = Field(gt=0)


class PendingOrderCancelRequest(BaseModel):
    order_ticket: int = Field(gt=0)


class PendingOrderStatusResponse(BaseModel):
    order_ticket: int
    symbol: str
    direction: Literal["BUY", "SELL"]
    pending_type: Literal["BUY_LIMIT", "BUY_STOP", "SELL_LIMIT", "SELL_STOP"]
    volume: float
    entry_price: float
    stop_loss: float | None = None
    take_profit: float | None = None
    created_at: datetime | None = None


class OrderStatusResponse(BaseModel):
    status: Literal["open", "closed", "not_found"]
    symbol: str
    position_ticket: int | None = None
    direction: Literal["BUY", "SELL"] | None = None
    volume: float | None = None
    entry_price: float | None = None
    current_price: float | None = None
    stop_loss: float | None = None
    take_profit: float | None = None
    profit: float | None = None
    stop_result: float | None = None
    target_result: float | None = None
    swap: float | None = None
    currency: str
    account_balance: float | None = None
    account_equity: float | None = None
    opened_at: datetime | None = None
    technical_reasons: list[str] = Field(default_factory=list)
    risk_reasons: list[str] = Field(default_factory=list)
    analysis_generated_at: str | None = None


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
