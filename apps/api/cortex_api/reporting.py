from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Any


def save_analysis_report(final_state: dict[str, Any], ticker: str, output_dir: Path) -> Path:
    """Persist a structured markdown report from a Cortex final state."""
    output_dir.mkdir(parents=True, exist_ok=True)
    sections: list[str] = []

    analyst_parts = []
    analyst_map = [
        ("market_report", "Analista de Mercado", "market.md"),
        ("sentiment_report", "Analista de Sentimento", "sentiment.md"),
        ("news_report", "Analista de Notícias", "news.md"),
        ("fundamentals_report", "Analista de Fundamentos", "fundamentals.md"),
    ]
    analysts_dir = output_dir / "1_analysts"
    for key, title, filename in analyst_map:
        content = final_state.get(key)
        if content:
            analysts_dir.mkdir(exist_ok=True)
            (analysts_dir / filename).write_text(str(content), encoding="utf-8")
            analyst_parts.append(f"### {title}\n{content}")
    if analyst_parts:
        sections.append("## I. Relatórios da Equipe de Análise\n\n" + "\n\n".join(analyst_parts))

    debate = final_state.get("investment_debate_state") or {}
    research_parts = []
    research_map = [
        ("bull_history", "Pesquisador Altista", "bull.md"),
        ("bear_history", "Pesquisador Baixista", "bear.md"),
        ("judge_decision", "Gestor de Research", "manager.md"),
    ]
    research_dir = output_dir / "2_research"
    for key, title, filename in research_map:
        content = debate.get(key)
        if content:
            research_dir.mkdir(exist_ok=True)
            (research_dir / filename).write_text(str(content), encoding="utf-8")
            research_parts.append(f"### {title}\n{content}")
    if research_parts:
        sections.append("## II. Decisão da Equipe de Research\n\n" + "\n\n".join(research_parts))

    trader_plan = final_state.get("trader_investment_plan")
    if trader_plan:
        trading_dir = output_dir / "3_trading"
        trading_dir.mkdir(exist_ok=True)
        (trading_dir / "trader.md").write_text(str(trader_plan), encoding="utf-8")
        sections.append(f"## III. Plano da Equipe de Trading\n\n### Trader\n{trader_plan}")

    risk = final_state.get("risk_debate_state") or {}
    risk_parts = []
    risk_map = [
        ("aggressive_history", "Analista Agressivo", "aggressive.md"),
        ("conservative_history", "Analista Conservador", "conservative.md"),
        ("neutral_history", "Analista Neutro", "neutral.md"),
    ]
    risk_dir = output_dir / "4_risk"
    for key, title, filename in risk_map:
        content = risk.get(key)
        if content:
            risk_dir.mkdir(exist_ok=True)
            (risk_dir / filename).write_text(str(content), encoding="utf-8")
            risk_parts.append(f"### {title}\n{content}")
    if risk_parts:
        sections.append("## IV. Decisão da Equipe de Risco\n\n" + "\n\n".join(risk_parts))

    portfolio_decision = risk.get("judge_decision") or final_state.get("final_trade_decision")
    if portfolio_decision:
        portfolio_dir = output_dir / "5_portfolio"
        portfolio_dir.mkdir(exist_ok=True)
        (portfolio_dir / "decision.md").write_text(str(portfolio_decision), encoding="utf-8")
        sections.append(f"## V. Decisão do Gestor de Portfólio\n\n### Gestor de Portfólio\n{portfolio_decision}")

    header = (
        f"# Relatório de Análise: {ticker.upper()}\n\n"
        f"Gerado em: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n"
    )
    report_path = output_dir / "complete_report.md"
    report_path.write_text(header + "\n\n".join(sections), encoding="utf-8")
    return report_path
