"use client";

import {
  Activity,
  AlertTriangle,
  Bot,
  Cable,
  Clock3,
  Loader2,
  RadioTower,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  Target,
} from "lucide-react";
import type { Dispatch, FormEvent, ReactNode, SetStateAction } from "react";

import type {
  OpportunityDirection,
  OpportunityProvider,
  OpportunityRequest,
  OpportunityResult,
  OpportunityRiskProfile,
  OpportunitySignal,
  OpportunityStrategyType,
  OpportunityTimeframe,
} from "./types";

const opportunityTimeframes: Array<{ value: OpportunityTimeframe; label: string }> = [
  { value: "M1", label: "M1" },
  { value: "M5", label: "M5" },
  { value: "M15", label: "M15" },
  { value: "M30", label: "M30" },
  { value: "H1", label: "H1" },
  { value: "H4", label: "H4" },
  { value: "D1", label: "D1" },
];

const directionLabels: Record<OpportunityDirection, string> = {
  BUY: "Compra",
  SELL: "Venda",
  WAIT: "Aguardar",
  AVOID: "Evitar",
};

const directionTone: Record<OpportunityDirection, string> = {
  BUY: "buy",
  SELL: "sell",
  WAIT: "wait",
  AVOID: "avoid",
};

type OpportunityWorkspaceProps = {
  assets: Array<{ symbol: string; name: string; category: string }>;
  form: OpportunityRequest;
  setForm: Dispatch<SetStateAction<OpportunityRequest>>;
  result: OpportunityResult | null;
  error: string | null;
  isLoading: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  formatPrice: (value: number) => string;
  chartSlot: ReactNode;
};

export function OpportunityWorkspace({
  assets,
  form,
  setForm,
  result,
  error,
  isLoading,
  onSubmit,
  formatPrice,
  chartSlot,
}: OpportunityWorkspaceProps) {
  const primarySignal = result?.signals[0] ?? null;
  const isMt5Selected = form.provider === "mt5";

  return (
    <section className="opportunityWorkspace">
      <OpportunityHeader provider={form.provider} isMt5Selected={isMt5Selected} />

      <div className="opportunityShell">
        <TradingConfigPanel assets={assets} form={form} setForm={setForm} isLoading={isLoading} onSubmit={onSubmit} />

        <div className="opportunityMainStack">
          <div className="opportunityCoreGrid">
            <OpportunityDecisionCard
              signal={primarySignal}
              isLoading={isLoading}
              error={error}
              formatPrice={formatPrice}
            />
            {chartSlot}
          </div>

          <ContextPanel
            signal={primarySignal}
            result={result}
            provider={form.provider}
            error={error}
            isLoading={isLoading}
          />
        </div>
      </div>
    </section>
  );
}

function OpportunityHeader({ provider, isMt5Selected }: { provider: OpportunityProvider; isMt5Selected: boolean }) {
  return (
    <header className="opportunityHero">
      <div>
        <p className="eyebrow">Cortex AI Trading Desk</p>
        <div className="opportunityHeroTitle">
          <h3>Trading Opportunities</h3>
          <span className="modeBadge">Sem execução real</span>
        </div>
        <p>
          IA para leitura de cenários operacionais de Day Trade e Swing Trade, com foco em contexto técnico,
          risco e validação humana.
        </p>
      </div>
      <div className="opportunityHeroStatus">
        <span>
          <Bot size={16} />
          Modo análise
        </span>
        <span className={isMt5Selected ? "statusPill statusPill--warning" : "statusPill"}>
          <Cable size={16} />
          {isMt5Selected ? "MT5 / Corretora" : `Provider ${provider}`}
        </span>
        <span className="riskPill">
          <ShieldAlert size={16} />
          Não é recomendação financeira
        </span>
      </div>
    </header>
  );
}

function TradingConfigPanel({
  assets,
  form,
  setForm,
  isLoading,
  onSubmit,
}: {
  assets: Array<{ symbol: string; name: string; category: string }>;
  form: OpportunityRequest;
  setForm: Dispatch<SetStateAction<OpportunityRequest>>;
  isLoading: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <aside className="tradingConfigPanel">
      <div className="panelHeader">
        <SlidersHorizontal size={18} />
        <div>
          <h4>Configuração operacional</h4>
          <span>Parâmetros da simulação técnica</span>
        </div>
      </div>

      <form className="tradingConfigForm" onSubmit={onSubmit}>
        <label>
          Ativo / símbolo
          <select
            value={form.symbol}
            onChange={(event) => setForm({ ...form, symbol: event.target.value })}
          >
            {assets.map((asset) => (
              <option key={asset.symbol} value={asset.symbol}>
                {asset.symbol} · {asset.name} ({asset.category})
              </option>
            ))}
          </select>
        </label>

        <label>
          Tipo de operação
          <select
            value={form.strategy_type}
            onChange={(event) => setForm({ ...form, strategy_type: event.target.value as OpportunityStrategyType })}
          >
            <option value="daytrade">Day Trade</option>
            <option value="swingtrade">Swing Trade</option>
          </select>
        </label>

        <label>
          Timeframe
          <select
            value={form.timeframe}
            onChange={(event) => setForm({ ...form, timeframe: event.target.value as OpportunityTimeframe })}
          >
            {opportunityTimeframes.map((timeframe) => (
              <option key={timeframe.value} value={timeframe.value}>
                {timeframe.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          Perfil de risco
          <select
            value={form.risk_profile}
            onChange={(event) => setForm({ ...form, risk_profile: event.target.value as OpportunityRiskProfile })}
          >
            <option value="conservador">Conservador</option>
            <option value="moderado">Moderado</option>
            <option value="agressivo">Agressivo</option>
          </select>
        </label>

        <div className="configSplit">
          <label>
            Capital
            <input
              min={1}
              step={100}
              type="number"
              value={form.capital}
              onChange={(event) => setForm({ ...form, capital: Number(event.target.value) })}
            />
          </label>

          <label>
            Risco/operação
            <input
              max={1}
              min={0.001}
              step={0.001}
              type="number"
              value={form.max_risk_per_trade}
              onChange={(event) => setForm({ ...form, max_risk_per_trade: Number(event.target.value) })}
            />
          </label>
        </div>

        <label>
          Provider de dados
          <select
            value={form.provider}
            onChange={(event) => setForm({ ...form, provider: event.target.value as OpportunityProvider })}
          >
            <option value="mock">Mock / Preview</option>
            <option value="yfinance">yFinance</option>
            <option value="mt5">MT5 / Corretora</option>
          </select>
        </label>

        <div className="configSplit">
          <label>
            Máx. sinais
            <input
              max={20}
              min={1}
              type="number"
              value={form.max_signals}
              onChange={(event) => setForm({ ...form, max_signals: Number(event.target.value) })}
            />
          </label>

          <label>
            Barras OHLCV
            <input
              max={1000}
              min={50}
              type="number"
              value={form.limit}
              onChange={(event) => setForm({ ...form, limit: Number(event.target.value) })}
            />
          </label>
        </div>

        <button className="tradeActionButton" disabled={isLoading} type="submit">
          {isLoading ? <Loader2 size={17} /> : <Sparkles size={17} />}
          {isLoading ? "Analisando..." : "Analisar oportunidade"}
        </button>
      </form>
    </aside>
  );
}

function OpportunityDecisionCard({
  signal,
  isLoading,
  error,
  formatPrice,
}: {
  signal: OpportunitySignal | null;
  isLoading: boolean;
  error: string | null;
  formatPrice: (value: number) => string;
}) {
  if (isLoading) {
    return (
      <section className="decisionCard decisionCard--loading">
        <LoadingSkeleton />
      </section>
    );
  }

  if (error) {
    return (
      <section className="decisionCard decisionCard--error">
        <AlertTriangle size={22} />
        <h4>Não foi possível concluir a leitura operacional</h4>
        <p>{error}</p>
      </section>
    );
  }

  if (!signal) {
    return (
      <section className="decisionCard decisionCard--empty">
        <RadioTower size={22} />
        <h4>Aguardando análise</h4>
        <p>Configure o ativo, risco e timeframe para gerar um sinal técnico preliminar.</p>
      </section>
    );
  }

  const tone = directionTone[signal.direction];
  const confidencePct = Math.round(signal.confidence_score * 100);
  return (
    <section className={`decisionCard decisionCard--${tone}`}>
      <div className="decisionTopline">
        <span className={`decisionBadge decisionBadge--${tone}`}>{signal.direction}</span>
        <span>{directionLabels[signal.direction]}</span>
      </div>

      <div className="decisionTitle">
        <h4>Decisão da IA</h4>
        <strong>{signal.setup_name.replaceAll("_", " ")}</strong>
      </div>

      <div className="confidenceBlock">
        <div>
          <span>Score de confiança</span>
          <strong>{confidencePct}%</strong>
        </div>
        <div className="confidenceTrack">
          <span style={{ width: `${confidencePct}%` }} />
        </div>
      </div>

      <div className="metricMatrix">
        <RiskMetricCard label="Entrada" value={signal.entry_price ? formatPrice(signal.entry_price) : "-"} />
        <RiskMetricCard label="Stop loss" value={signal.stop_loss ? formatPrice(signal.stop_loss) : "-"} tone="danger" />
        <RiskMetricCard label="Take profit" value={signal.take_profit ? formatPrice(signal.take_profit) : "-"} tone="success" />
        <RiskMetricCard label="Risco/retorno" value={signal.risk_reward_ratio?.toString() ?? "-"} />
        <RiskMetricCard label="Posição sugerida" value={formatPrice(signal.position_size)} />
        <RiskMetricCard label="Perda máxima" value={formatPrice(signal.max_loss)} tone="warning" />
      </div>
    </section>
  );
}

function RiskMetricCard({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "danger" | "success" | "warning" }) {
  return (
    <div className={`riskMetricCard riskMetricCard--${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function MarketPreviewCard({
  signal,
  form,
  isLoading,
  formatPrice,
}: {
  signal: OpportunitySignal | null;
  form: OpportunityRequest;
  isLoading: boolean;
  formatPrice: (value: number) => string;
}) {
  const hasLevels = Boolean(signal?.entry_price || signal?.stop_loss || signal?.take_profit);
  const levels = getLevelPositions(signal);
  const indicators = buildIndicatorPreview(signal);

  return (
    <section className="marketPreviewCard">
      <div className="panelHeader">
        <Activity size={18} />
        <div>
          <h4>Painel de mercado</h4>
          <span>{form.symbol} · {form.timeframe} · preview operacional</span>
        </div>
      </div>

      <div className="marketCanvas">
        {isLoading ? (
          <div className="marketCanvasState">Processando candles e risco...</div>
        ) : hasLevels ? (
          <>
            <div className="marketBand marketBand--target" style={{ top: `${levels.target}%` }}>
              <span>Alvo {signal?.take_profit ? formatPrice(signal.take_profit) : ""}</span>
            </div>
            <div className="marketBand marketBand--entry" style={{ top: `${levels.entry}%` }}>
              <span>Entrada {signal?.entry_price ? formatPrice(signal.entry_price) : ""}</span>
            </div>
            <div className="marketBand marketBand--stop" style={{ top: `${levels.stop}%` }}>
              <span>Stop {signal?.stop_loss ? formatPrice(signal.stop_loss) : ""}</span>
            </div>
            <div className="marketPulse" />
          </>
        ) : (
          <div className="marketCanvasState">Sem níveis operacionais. Execute uma análise para preencher o painel.</div>
        )}
      </div>

      <div className="indicatorGrid">
        {indicators.map((indicator) => (
          <IndicatorBadge key={indicator.label} label={indicator.label} value={indicator.value} tone={indicator.tone} />
        ))}
      </div>
    </section>
  );
}

function ContextPanel({
  signal,
  result,
  provider,
  error,
  isLoading,
}: {
  signal: OpportunitySignal | null;
  result: OpportunityResult | null;
  provider: OpportunityProvider;
  error: string | null;
  isLoading: boolean;
}) {
  const providerStatus = getProviderStatus(provider, error);

  return (
    <section className="contextPanel">
      <AnalysisReasonList title="Razões técnicas" items={signal?.technical_reasons ?? []} emptyText="Aguardando leitura técnica." />
      <AnalysisReasonList title="Razões de risco" items={signal?.risk_reasons ?? []} emptyText="Aguardando avaliação de risco." />
      <AnalysisReasonList title="Invalidação" items={signal?.invalidation_criteria ?? []} emptyText="Sem critérios definidos ainda." />
      <AnalysisReasonList title="Warnings" items={[...(signal?.warnings ?? []), ...(result?.warnings ?? [])]} emptyText="Sem alertas adicionais." />

      <div className="opsStatusCard">
        <h4>Status operacional</h4>
        <div className="opsStatusRows">
          <span>
            <Cable size={15} />
            Provider
            <strong>{providerStatus}</strong>
          </span>
          <span>
            <Clock3 size={15} />
            Timestamp
            <strong>{signal ? new Date(signal.generated_at).toLocaleString("pt-BR") : isLoading ? "Processando" : "Aguardando"}</strong>
          </span>
          <span>
            <ShieldAlert size={15} />
            Execução real
            <strong>Bloqueada</strong>
          </span>
        </div>
      </div>
    </section>
  );
}

function AnalysisReasonList({ title, items, emptyText }: { title: string; items: string[]; emptyText: string }) {
  return (
    <div className="analysisReasonList">
      <h4>{title}</h4>
      {items.length > 0 ? (
        <ul>
          {items.map((item, index) => (
            <li key={`${title}-${index}`}>{item}</li>
          ))}
        </ul>
      ) : (
        <p>{emptyText}</p>
      )}
    </div>
  );
}

function IndicatorBadge({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className={`indicatorBadge indicatorBadge--${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <>
      <div className="skeletonLine skeletonLine--short" />
      <div className="skeletonLine skeletonLine--wide" />
      <div className="skeletonGrid">
        <span />
        <span />
        <span />
        <span />
      </div>
    </>
  );
}

function getLevelPositions(signal: OpportunitySignal | null) {
  const values = [signal?.entry_price, signal?.stop_loss, signal?.take_profit].filter((value): value is number => typeof value === "number");
  if (values.length === 0) return { entry: 50, stop: 72, target: 28 };
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = Math.max(max - min, 0.0001);
  const position = (value?: number | null) => {
    if (typeof value !== "number") return 50;
    return 82 - ((value - min) / spread) * 64;
  };
  return {
    entry: position(signal?.entry_price),
    stop: position(signal?.stop_loss),
    target: position(signal?.take_profit),
  };
}

function buildIndicatorPreview(signal: OpportunitySignal | null) {
  const direction = signal?.direction;
  return [
    {
      label: "Tendência",
      value: direction === "BUY" ? "Alta" : direction === "SELL" ? "Baixa" : direction ? "Neutra" : "Preview",
      tone: direction === "BUY" ? "positive" : direction === "SELL" ? "negative" : "neutral",
    },
    { label: "RSI", value: signal ? "Contexto" : "Simulado", tone: "neutral" },
    { label: "MACD", value: signal?.direction === "SELL" ? "Pressão" : signal ? "Momentum" : "Simulado", tone: signal ? "positive" : "neutral" },
    { label: "ATR", value: signal ? "Risco" : "Simulado", tone: "warning" },
    { label: "Volume", value: signal ? "Validado" : "Simulado", tone: signal ? "positive" : "neutral" },
    { label: "Volatilidade", value: signal?.direction === "AVOID" ? "Alta" : signal ? "Monitorar" : "Preview", tone: signal?.direction === "AVOID" ? "warning" : "neutral" },
  ];
}

function getProviderStatus(provider: OpportunityProvider, error: string | null) {
  if (provider === "mt5") return error ? "MT5 indisponível" : "MT5 conectado";
  if (error) return "Indisponível";
  if (provider === "mock") return "Preview simulado";
  return "Leitura de mercado";
}
