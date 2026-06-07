from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .repository import init_db
from .models import (
    AnalysisCreateResponse,
    AnalysisListResponse,
    AnalysisRequest,
    AssetHistoryResponse,
    ConfigOptionsResponse,
    ReportResponse,
)
from .service import analysis_service, get_asset_history, get_assets


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


@app.get("/config/options", response_model=ConfigOptionsResponse)
def config_options() -> ConfigOptionsResponse:
    return analysis_service.config_options()


@app.get("/assets")
def list_assets():
    return {"assets": get_assets()}


@app.get("/assets/{symbol}/history", response_model=AssetHistoryResponse)
def asset_history(symbol: str, period: str = "6mo", interval: str = "1d") -> AssetHistoryResponse:
    try:
        return get_asset_history(symbol, period, interval)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/analyses", response_model=AnalysisCreateResponse, status_code=202)
def create_analysis(request: AnalysisRequest) -> AnalysisCreateResponse:
    return analysis_service.create_analysis(request)


@app.get("/analyses", response_model=AnalysisListResponse)
def list_analyses() -> AnalysisListResponse:
    return analysis_service.list_records()


@app.get("/analyses/{analysis_id}")
def get_analysis(analysis_id: str):
    record = analysis_service.get_record(analysis_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Analysis not found")
    return record


@app.get("/analyses/{analysis_id}/report", response_model=ReportResponse)
def get_report(analysis_id: str) -> ReportResponse:
    markdown = analysis_service.read_report(analysis_id)
    if markdown is None:
        raise HTTPException(status_code=404, detail="Report not found")
    return ReportResponse(analysis_id=analysis_id, markdown=markdown)
