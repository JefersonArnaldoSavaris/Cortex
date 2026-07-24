import pytest
from fastapi import HTTPException

from cortex.trading_opportunities import OpportunityRequest, TradingOpportunityAgent


@pytest.mark.unit
def test_opportunity_endpoint_returns_structured_signal(monkeypatch):
    import apps.api.cortex_api.main as main_module

    monkeypatch.setattr(main_module, "opportunity_agent", TradingOpportunityAgent(log_path=None))

    result = main_module.analyze_opportunity(
        OpportunityRequest(
            symbol="SPY",
            strategy_type="daytrade",
            timeframe="M15",
            risk_profile="moderado",
            capital=10000,
            max_risk_per_trade=0.01,
            max_signals=1,
            provider="mock",
            limit=160,
        )
    )

    body = result.model_dump(mode="json")
    assert body["request"]["symbol"] == "SPY"
    assert body["signals"]
    assert body["signals"][0]["direction"] in {"BUY", "SELL", "WAIT", "AVOID"}
    assert "não executa ordens reais" in " ".join(body["signals"][0]["warnings"])


@pytest.mark.unit
def test_opportunity_endpoint_keeps_mt5_as_safe_stub(monkeypatch):
    import apps.api.cortex_api.main as main_module

    monkeypatch.setattr(main_module, "opportunity_agent", TradingOpportunityAgent(log_path=None))

    with pytest.raises(HTTPException) as exc:
        main_module.analyze_opportunity(
            OpportunityRequest(
                symbol="SPY",
                strategy_type="daytrade",
                timeframe="M15",
                risk_profile="moderado",
                capital=10000,
                max_risk_per_trade=0.01,
                max_signals=1,
                provider="mt5",
                limit=160,
            )
        )

    assert exc.value.status_code == 400
    assert "not implemented" in str(exc.value.detail).lower()
