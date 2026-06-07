import importlib
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from apps.api.cortex_api.models import AnalysisRequest, AnalysisStatus


@pytest.mark.unit
def test_analysis_repository_persists_records_and_events(tmp_path, monkeypatch):
    database_url = f"sqlite:///{tmp_path / 'analysis-test.db'}"
    monkeypatch.setenv("CORTEX_DATABASE_URL", database_url)

    import apps.api.cortex_api.db as db_module
    import apps.api.cortex_api.orm as orm_module
    import apps.api.cortex_api.repository as repository_module

    importlib.reload(db_module)
    importlib.reload(orm_module)
    repository_module = importlib.reload(repository_module)

    repository_module.init_db()

    request = AnalysisRequest(
        ticker="SPY",
        analysis_date="2026-05-02",
        provider="google",
        quick_model="gemini-2.5-flash-lite",
        deep_model="gemini-2.5-flash-lite",
        analysts=["market"],
        research_depth=1,
        output_language="Portuguese",
        checkpoint=False,
    )

    created = repository_module.create_analysis_record("repo-test", request)
    repository_module.append_event("repo-test", "Worker started")
    repository_module.set_analysis_status(
        "repo-test",
        AnalysisStatus.COMPLETED,
        decision="buy",
        report_path="/tmp/report.md",
        report_markdown="# Report",
    )

    loaded = repository_module.get_analysis_record("repo-test")
    listed = repository_module.list_analysis_records()
    markdown = repository_module.get_report_markdown("repo-test")

    assert created.id == "repo-test"
    assert loaded is not None
    assert loaded.status == AnalysisStatus.COMPLETED
    assert loaded.decision == "buy"
    assert loaded.report_path == "/tmp/report.md"
    assert [event.message for event in loaded.events] == ["Analysis queued", "Worker started"]
    assert listed[0].id == "repo-test"
    assert markdown == "# Report"
