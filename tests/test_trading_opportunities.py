from datetime import datetime, timedelta, timezone

import pytest

from cortex.trading_opportunities import OpportunityRequest, TradingOpportunityAgent
from cortex.trading_opportunities.providers.mock_provider import MockMarketDataProvider
from cortex.trading_opportunities.providers.mt5_provider_stub import MT5ProviderStub
from cortex.trading_opportunities.risk import calculate_risk_assessment
from cortex.trading_opportunities.schemas import (
    Direction,
    OHLCVBar,
    OpportunitySignal,
    RiskProfile,
    SetupCandidate,
    TechnicalSnapshot,
    Timeframe,
)
from cortex.trading_opportunities.signal_engine import TradingOpportunitySignalEngine


def make_snapshot(**overrides):
    values = {
        "trend": "bullish",
        "support": 98.0,
        "resistance": 106.0,
        "sma_fast": 103.0,
        "sma_slow": 101.0,
        "rsi": 55.0,
        "macd": 1.2,
        "macd_signal": 0.8,
        "atr": 2.0,
        "average_volume": 100_000.0,
        "latest_volume": 130_000.0,
        "volatility_pct": 1.9,
        "breakout": "upside",
        "pullback": None,
        "candle_pattern": "bullish_pin_bar",
    }
    values.update(overrides)
    return TechnicalSnapshot(**values)


def make_bars(closes):
    now = datetime.now(timezone.utc) - timedelta(minutes=len(closes) * 15)
    bars = []
    for index, close in enumerate(closes):
        open_price = close - 0.2
        bars.append(
            OHLCVBar(
                timestamp=now + timedelta(minutes=index * 15),
                open=open_price,
                high=max(open_price, close) + 0.6,
                low=min(open_price, close) - 0.6,
                close=close,
                volume=100_000 + index * 100,
            )
        )
    return bars


@pytest.mark.unit
def test_risk_calculation_for_buy_caps_max_loss():
    assessment = calculate_risk_assessment(
        direction=Direction.BUY,
        latest_price=100.0,
        snapshot=make_snapshot(atr=2.0),
        capital=10_000,
        max_risk_per_trade=0.01,
        risk_profile=RiskProfile.MODERADO,
    )

    assert assessment.entry_price == 100.0
    assert assessment.stop_loss == 98.0
    assert assessment.take_profit == 104.0
    assert assessment.risk_reward_ratio == 2.0
    assert assessment.position_size == 50.0
    assert assessment.max_loss == 100.0


@pytest.mark.unit
def test_structured_output_validation_accepts_expected_signal_shape():
    signal = OpportunitySignal(
        symbol="SPY",
        strategy_type="daytrade",
        timeframe="M15",
        direction="BUY",
        confidence_score=0.72,
        setup_name="breakout",
        entry_price=100.0,
        stop_loss=98.0,
        take_profit=104.0,
        risk_reward_ratio=2.0,
        position_size=50.0,
        max_loss=100.0,
        technical_reasons=["Breakout confirmed."],
        risk_reasons=["Risk capped."],
        invalidation_criteria=["Close below stop."],
        warnings=["Educational signal only."],
    )

    assert signal.direction == Direction.BUY
    assert signal.symbol == "SPY"


@pytest.mark.unit
def test_mock_provider_returns_valid_ohlcv_bars():
    bars = MockMarketDataProvider().get_ohlcv("SPY", Timeframe.M15, 60)

    assert len(bars) == 60
    assert all(bar.high >= bar.close >= bar.low for bar in bars)


@pytest.mark.unit
def test_engine_generates_buy_signal_for_bullish_breakout(monkeypatch):
    request = OpportunityRequest(symbol="SPY", max_signals=1)
    engine = TradingOpportunitySignalEngine()
    monkeypatch.setattr(
        "cortex.trading_opportunities.signal_engine.compute_technical_snapshot",
        lambda bars: make_snapshot(breakout="upside", trend="bullish", macd=1.5, macd_signal=0.5),
    )

    signal = engine.analyze(request, make_bars([100 + i * 0.1 for i in range(60)]))[0]

    assert signal.direction == Direction.BUY
    assert signal.entry_price is not None


@pytest.mark.unit
def test_engine_generates_sell_signal_for_bearish_breakout(monkeypatch):
    request = OpportunityRequest(symbol="SPY", max_signals=1)
    engine = TradingOpportunitySignalEngine()
    monkeypatch.setattr(
        "cortex.trading_opportunities.signal_engine.compute_technical_snapshot",
        lambda bars: make_snapshot(
            trend="bearish",
            breakout="downside",
            macd=-1.5,
            macd_signal=-0.5,
            rsi=45,
        ),
    )

    signal = engine.analyze(request, make_bars([110 - i * 0.1 for i in range(60)]))[0]

    assert signal.direction == Direction.SELL
    assert signal.stop_loss > signal.entry_price


@pytest.mark.unit
def test_engine_generates_wait_when_score_is_too_low(monkeypatch):
    request = OpportunityRequest(symbol="SPY", max_signals=1)
    engine = TradingOpportunitySignalEngine()
    monkeypatch.setattr(
        "cortex.trading_opportunities.signal_engine.compute_technical_snapshot",
        lambda bars: make_snapshot(
            trend="bullish",
            breakout=None,
            pullback=None,
            macd=-0.2,
            macd_signal=0.2,
            rsi=55,
        ),
    )
    monkeypatch.setattr(
        engine,
        "_rank_candidates",
        lambda candidates: [
            SetupCandidate(
                name="low_quality_breakout",
                direction=Direction.BUY,
                score=0.4,
                technical_reasons=["Directional idea exists but confirmation is weak."],
            )
        ],
    )

    signal = engine.analyze(request, make_bars([100 + i * 0.03 for i in range(60)]))[0]

    assert signal.direction == Direction.WAIT


@pytest.mark.unit
def test_engine_generates_avoid_for_high_volatility(monkeypatch):
    request = OpportunityRequest(symbol="SPY", max_signals=1)
    engine = TradingOpportunitySignalEngine()
    monkeypatch.setattr(
        "cortex.trading_opportunities.signal_engine.compute_technical_snapshot",
        lambda bars: make_snapshot(breakout="upside", volatility_pct=8.0),
    )

    signal = engine.analyze(request, make_bars([100 + i * 0.1 for i in range(60)]))[0]

    assert signal.direction == Direction.AVOID
    assert signal.position_size == 0


@pytest.mark.unit
def test_mt5_stub_never_places_real_orders(monkeypatch):
    monkeypatch.setenv("ENABLE_LIVE_TRADING", "true")
    provider = MT5ProviderStub()

    with pytest.raises(NotImplementedError):
        provider.place_order(symbol="SPY", direction="BUY", volume=1)


@pytest.mark.unit
def test_agent_does_not_need_live_trading_and_can_skip_audit_log():
    request = OpportunityRequest(symbol="SPY", provider="mock", max_signals=1)
    result = TradingOpportunityAgent(log_path=None).analyze(request)

    assert result.signals
    assert "No real order execution" in " ".join(result.signals[0].warnings)
