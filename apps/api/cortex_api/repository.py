from __future__ import annotations

import json
from datetime import datetime

from sqlalchemy import select

from .db import engine, session_scope
from .models import AnalysisEvent, AnalysisRecord, AnalysisRequest, AnalysisStatus
from .orm import AnalysisEventORM, AnalysisORM, Base


def init_db() -> None:
    Base.metadata.create_all(bind=engine)


def _to_record(row: AnalysisORM) -> AnalysisRecord:
    return AnalysisRecord(
        id=row.id,
        status=AnalysisStatus(row.status),
        request=AnalysisRequest(
            ticker=row.ticker,
            analysis_date=row.analysis_date,
            provider=row.provider,
            quick_model=row.quick_model,
            deep_model=row.deep_model,
            analysts=json.loads(row.analysts_json),
            research_depth=row.research_depth,
            output_language=row.output_language,
            mode=row.mode,
            checkpoint=row.checkpoint,
        ),
        created_at=row.created_at,
        updated_at=row.updated_at,
        decision=row.decision,
        report_path=row.report_path,
        error=row.error,
        events=[
            AnalysisEvent(
                timestamp=event.timestamp,
                level=event.level,
                message=event.message,
            )
            for event in row.events
        ],
    )


def create_analysis_record(analysis_id: str, request: AnalysisRequest) -> AnalysisRecord:
    now = datetime.now()
    with session_scope() as session:
        row = AnalysisORM(
            id=analysis_id,
            ticker=request.ticker,
            analysis_date=request.analysis_date,
            provider=request.provider,
            quick_model=request.quick_model,
            deep_model=request.deep_model,
            analysts_json=json.dumps(request.analysts),
            research_depth=request.research_depth,
            output_language=request.output_language,
            mode=request.mode.value,
            checkpoint=request.checkpoint,
            status=AnalysisStatus.QUEUED.value,
            created_at=now,
            updated_at=now,
        )
        row.events.append(AnalysisEventORM(timestamp=now, message="Analysis queued", level="info"))
        session.add(row)
        session.flush()
        session.refresh(row)
        return _to_record(row)


def list_analysis_records() -> list[AnalysisRecord]:
    with session_scope() as session:
        rows = session.scalars(select(AnalysisORM).order_by(AnalysisORM.created_at.desc())).all()
        return [_to_record(row) for row in rows]


def get_analysis_record(analysis_id: str) -> AnalysisRecord | None:
    with session_scope() as session:
        row = session.get(AnalysisORM, analysis_id)
        return None if row is None else _to_record(row)


def get_report_markdown(analysis_id: str) -> str | None:
    with session_scope() as session:
        row = session.get(AnalysisORM, analysis_id)
        return None if row is None else row.report_markdown


def append_event(analysis_id: str, message: str, level: str = "info") -> None:
    with session_scope() as session:
        row = session.get(AnalysisORM, analysis_id)
        if row is None:
            return
        row.events.append(AnalysisEventORM(timestamp=datetime.now(), message=message, level=level))
        row.updated_at = datetime.now()


def set_analysis_status(
    analysis_id: str,
    status: AnalysisStatus,
    *,
    decision: str | None = None,
    report_path: str | None = None,
    report_markdown: str | None = None,
    error: str | None = None,
) -> None:
    with session_scope() as session:
        row = session.get(AnalysisORM, analysis_id)
        if row is None:
            return

        row.status = status.value
        row.updated_at = datetime.now()
        if decision is not None:
            row.decision = decision
        if report_path is not None:
            row.report_path = report_path
        if report_markdown is not None:
            row.report_markdown = report_markdown
        if error is not None:
            row.error = error
