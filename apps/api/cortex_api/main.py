from __future__ import annotations

import asyncio
import time

from fastapi import Depends, FastAPI, HTTPException, Query, Request, Response, WebSocket, WebSocketDisconnect, status
from fastapi.middleware.cors import CORSMiddleware
from cortex.trading_opportunities import OpportunityRequest, TradingOpportunityAgent
from cortex.trading_opportunities.schemas import OpportunityAnalysisResult

from .repository import init_db
from .auth import (
    authenticate_user,
    AUTH_COOKIE_NAME,
    clear_auth_cookie,
    enforce_auth_rate_limit,
    get_current_user,
    get_user_from_token,
    register_user,
    request_password_reset,
    set_auth_cookie,
)
from .mt5 import mt5_sessions
from .models import (
    AnalysisCreateResponse,
    AnalysisListResponse,
    AnalysisRequest,
    AssetHistoryResponse,
    ConfigOptionsResponse,
    ReportResponse,
    AuthResponse,
    AuthUser,
    ForgotPasswordRequest,
    LoginRequest,
    MessageResponse,
    MT5ConnectRequest,
    MT5StatusResponse,
    MT5SymbolsResponse,
    RegisterRequest,
)
from .service import analysis_service, get_asset_history, get_assets


opportunity_agent = TradingOpportunityAgent()


app = FastAPI(
    title="Cortex API",
    version="0.1.0",
    description="Product API for creating and reading Cortex analyses.",
)


@app.on_event("startup")
def startup() -> None:
    init_db()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/auth/register", response_model=AuthResponse, status_code=201)
def auth_register(payload: RegisterRequest, request: Request, response: Response) -> AuthResponse:
    enforce_auth_rate_limit(request, "register")
    if not payload.accepted_terms:
        raise HTTPException(status_code=422, detail="É necessário aceitar os termos de uso.")
    user = register_user(payload)
    _, token = authenticate_user(LoginRequest(email=payload.email, password=payload.password))
    set_auth_cookie(response, token)
    return AuthResponse(user=user)


@app.post("/auth/login", response_model=AuthResponse)
def auth_login(payload: LoginRequest, request: Request, response: Response) -> AuthResponse:
    enforce_auth_rate_limit(request, "login")
    user, token = authenticate_user(payload)
    set_auth_cookie(response, token)
    return AuthResponse(user=user)


@app.post("/auth/logout", response_model=MessageResponse)
def auth_logout(response: Response) -> MessageResponse:
    clear_auth_cookie(response)
    return MessageResponse(message="Sessão encerrada.")


@app.get("/auth/me", response_model=AuthResponse)
def auth_me(current_user: AuthUser = Depends(get_current_user)) -> AuthResponse:
    return AuthResponse(user=current_user)


@app.post("/auth/forgot-password", response_model=MessageResponse)
def auth_forgot_password(payload: ForgotPasswordRequest, request: Request) -> MessageResponse:
    enforce_auth_rate_limit(request, "forgot-password")
    request_password_reset(payload)
    return MessageResponse(message="Se o e-mail estiver cadastrado, enviaremos instruções para redefinir a senha.")


@app.get("/config/options", response_model=ConfigOptionsResponse)
def config_options(current_user: AuthUser = Depends(get_current_user)) -> ConfigOptionsResponse:
    return analysis_service.config_options()


@app.get("/assets")
def list_assets(current_user: AuthUser = Depends(get_current_user)):
    return {"assets": get_assets()}


@app.get("/assets/{symbol}/history", response_model=AssetHistoryResponse)
def asset_history(
    symbol: str,
    period: str = "6mo",
    interval: str = "1d",
    provider: str = "yfinance",
    current_user: AuthUser = Depends(get_current_user),
) -> AssetHistoryResponse:
    try:
        if provider == "mt5":
            return get_asset_history(symbol, period, interval, mt5_provider=mt5_sessions.get_provider(current_user))
        return get_asset_history(symbol, period, interval)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/analyses", response_model=AnalysisCreateResponse, status_code=202)
def create_analysis(
    request: AnalysisRequest,
    current_user: AuthUser = Depends(get_current_user),
) -> AnalysisCreateResponse:
    return analysis_service.create_analysis(request)


@app.post("/opportunities/analyze", response_model=OpportunityAnalysisResult)
def analyze_opportunity(
    request: OpportunityRequest,
    current_user: AuthUser = Depends(get_current_user),
) -> OpportunityAnalysisResult:
    try:
        if request.provider == "mt5" and isinstance(current_user, AuthUser):
            return TradingOpportunityAgent(provider=mt5_sessions.get_provider(current_user)).analyze(request)
        return opportunity_agent.analyze(request)
    except NotImplementedError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.get("/analyses", response_model=AnalysisListResponse)
def list_analyses(current_user: AuthUser = Depends(get_current_user)) -> AnalysisListResponse:
    return analysis_service.list_records()


@app.get("/analyses/{analysis_id}")
def get_analysis(analysis_id: str, current_user: AuthUser = Depends(get_current_user)):
    record = analysis_service.get_record(analysis_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Analysis not found")
    return record


@app.get("/analyses/{analysis_id}/report", response_model=ReportResponse)
def get_report(analysis_id: str, current_user: AuthUser = Depends(get_current_user)) -> ReportResponse:
    markdown = analysis_service.read_report(analysis_id)
    if markdown is None:
        raise HTTPException(status_code=404, detail="Report not found")
    return ReportResponse(analysis_id=analysis_id, markdown=markdown)


@app.get("/integrations/mt5/status", response_model=MT5StatusResponse)
def mt5_status(current_user: AuthUser = Depends(get_current_user)) -> MT5StatusResponse:
    return mt5_sessions.status(current_user)


@app.post("/integrations/mt5/connect", response_model=MT5StatusResponse)
def mt5_connect(
    payload: MT5ConnectRequest,
    current_user: AuthUser = Depends(get_current_user),
) -> MT5StatusResponse:
    try:
        return mt5_sessions.connect(current_user, payload)
    except (ConnectionError, RuntimeError, ValueError) as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.post("/integrations/mt5/disconnect", response_model=MT5StatusResponse)
def mt5_disconnect(current_user: AuthUser = Depends(get_current_user)) -> MT5StatusResponse:
    return mt5_sessions.disconnect(current_user)


@app.get("/integrations/mt5/symbols", response_model=MT5SymbolsResponse)
def mt5_symbols(
    query: str = "",
    limit: int = Query(default=500, ge=1, le=5000),
    current_user: AuthUser = Depends(get_current_user),
) -> MT5SymbolsResponse:
    try:
        return MT5SymbolsResponse(symbols=mt5_sessions.list_symbols(current_user, query=query, limit=limit))
    except (ConnectionError, RuntimeError, ValueError) as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.websocket("/ws/market-data")
async def market_data_stream(websocket: WebSocket, symbol: str) -> None:
    token = websocket.cookies.get(AUTH_COOKIE_NAME)
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Autenticação necessária.")
        return
    try:
        user = get_user_from_token(token)
        mt5_sessions.get_provider(user)
    except HTTPException:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Sessão inválida.")
        return
    except ValueError as exc:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason=str(exc))
        return

    await websocket.accept()
    last_signature: tuple | None = None
    last_heartbeat = 0.0
    try:
        while True:
            tick = await asyncio.to_thread(mt5_sessions.get_tick, user, symbol)
            signature = (tick.get("timestamp"), tick.get("bid"), tick.get("ask"), tick.get("last"), tick.get("volume"))
            now = time.monotonic()
            if signature != last_signature:
                await websocket.send_json({"type": "tick", **tick})
                last_signature = signature
                last_heartbeat = now
            elif now - last_heartbeat >= 10:
                await websocket.send_json({"type": "heartbeat", "timestamp": int(time.time() * 1000)})
                last_heartbeat = now
            await asyncio.sleep(0.5)
    except WebSocketDisconnect:
        return
    except Exception as exc:
        await websocket.send_json({"type": "error", "message": str(exc)})
        await websocket.close(code=status.WS_1011_INTERNAL_ERROR)
