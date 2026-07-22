from __future__ import annotations

from threading import RLock

from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field

from cortex.trading_opportunities.providers import MT5Credentials, MT5MarketDataProvider
from cortex.trading_opportunities.schemas import Timeframe


class MT5ConnectPayload(BaseModel):
    login: int = Field(gt=0)
    password: str = Field(min_length=1)
    server: str = Field(min_length=2)
    terminal_path: str | None = None


class OHLCVResponse(BaseModel):
    bars: list[dict]


class SymbolsResponse(BaseModel):
    symbols: list[dict]


app = FastAPI(
    title="Cortex MT5 Bridge",
    version="0.1.0",
    description="Read-only Windows bridge between Cortex and a local MetaTrader 5 terminal.",
)

_lock = RLock()
_provider: MT5MarketDataProvider | None = None
_account: dict | None = None


def _status_from_account(account: dict) -> dict:
    return {
        "login": account.get("login"),
        "server": account.get("server"),
        "name": account.get("name"),
        "company": account.get("company"),
        "currency": account.get("currency"),
        "balance": account.get("balance"),
        "equity": account.get("equity"),
        "margin": account.get("margin"),
        "trade_allowed": account.get("trade_allowed"),
    }


def _active_provider() -> MT5MarketDataProvider:
    with _lock:
        provider = _provider
    if provider is None:
        raise HTTPException(status_code=409, detail="Conecte uma conta MT5 antes de solicitar dados.")
    return provider


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/connect")
def connect(payload: MT5ConnectPayload) -> dict:
    global _account, _provider
    try:
        provider = MT5MarketDataProvider(
            MT5Credentials(
                login=payload.login,
                password=payload.password,
                server=payload.server,
                terminal_path=payload.terminal_path,
            )
        )
        account = provider.get_account_info()
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    with _lock:
        _provider = provider
        _account = account
    return _status_from_account(account)


@app.post("/disconnect")
def disconnect() -> dict[str, str]:
    global _account, _provider
    with _lock:
        _provider = None
        _account = None
    return {"status": "disconnected"}


@app.get("/status")
def status() -> dict:
    with _lock:
        account = _account
    if account is None:
        return {"connected": False, "message": "Nenhuma conta MT5 conectada."}
    return {"connected": True, **_status_from_account(account)}


@app.get("/ohlcv", response_model=OHLCVResponse)
def ohlcv(symbol: str, timeframe: Timeframe, limit: int = Query(default=160, ge=1, le=5000)) -> OHLCVResponse:
    try:
        bars = _active_provider().get_ohlcv(symbol.upper(), timeframe, limit)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return OHLCVResponse(
        bars=[
            {
                "timestamp": bar.timestamp.isoformat(),
                "open": bar.open,
                "high": bar.high,
                "low": bar.low,
                "close": bar.close,
                "volume": bar.volume,
            }
            for bar in bars
        ]
    )


@app.get("/price")
def price(symbol: str) -> dict[str, float]:
    try:
        value = _active_provider().get_current_price(symbol.upper())
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return {"price": value}


@app.get("/tick")
def tick(symbol: str) -> dict:
    try:
        return _active_provider().get_market_tick(symbol)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.get("/symbols", response_model=SymbolsResponse)
def symbols(query: str = "", limit: int = Query(default=500, ge=1, le=5000)) -> SymbolsResponse:
    try:
        items = _active_provider().list_symbols(query=query, limit=limit)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return SymbolsResponse(symbols=items)
