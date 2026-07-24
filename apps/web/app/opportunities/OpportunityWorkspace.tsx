"use client";

import {
  Activity,
  AlertTriangle,
  Cable,
  Clock3,
  Loader2,
  RadioTower,
  Search,
  ShieldAlert,
  Sparkles,
  Target,
} from "lucide-react";
import { useEffect, useMemo, useState, type Dispatch, type FormEvent, type KeyboardEvent, type ReactNode, type SetStateAction } from "react";

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

const directionBadgeLabels: Record<OpportunityDirection, string> = {
  BUY: "COMPRA",
  SELL: "VENDA",
  WAIT: "AGUARDAR",
  AVOID: "EVITAR",
};

const setupLabels: Record<string, string> = {
  breakout: "Rompimento",
  pullback: "Pullback",
  trend_following: "Seguimento de tendência",
  mean_reversion: "Reversão à média",
  avoid_low_quality_market: "Evitar mercado de baixa qualidade",
  evitar_mercado_de_baixa_qualidade: "Evitar mercado de baixa qualidade",
  no_setup: "Sem setup",
  sem_setup: "Sem setup",
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
  marketSummary: {
    name: string;
    latest: number;
    min: number;
    max: number;
    change: number;
    changePct: number;
  } | null;
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
  marketSummary,
}: OpportunityWorkspaceProps) {
  const primarySignal = result?.signals[0] ?? null;

  return (
    <section className="opportunityWorkspace">
      <div className="opportunityShell opportunityShell--horizontal">
        <TradingConfigPanel assets={assets} form={form} setForm={setForm} isLoading={isLoading} onSubmit={onSubmit} />
        <div className="microSummaryGrid">
          <MarketSummaryCard summary={marketSummary} formatPrice={formatPrice} />
          <OpportunityDecisionCard
            signal={primarySignal}
            isLoading={isLoading}
            error={error}
          />
          <OperationalMetricsCard signal={primarySignal} formatPrice={formatPrice} />
          <OperationalStatusCard
            signal={primarySignal}
            provider={form.provider}
            error={error}
            isLoading={isLoading}
          />
        </div>
        <div className="microMainGrid">
          <div className="opportunityChartStage">{chartSlot}</div>
          <aside className="microInsightsPanel">
            <div className="microInsightsHeader">
              <Target size={17} />
              <h4>Análise da IA</h4>
            </div>
          <ContextPanel
            signal={primarySignal}
            result={result}
          />
          </aside>
        </div>
      </div>
    </section>
  );
}

function MarketSummaryCard({
  summary,
  formatPrice,
}: {
  summary: OpportunityWorkspaceProps["marketSummary"];
  formatPrice: (value: number) => string;
}) {
  if (!summary) {
    return (
      <section className="marketSummaryCard marketSummaryCard--empty">
        <span>Resumo do ativo</span>
        <strong>Aguardando dados de mercado</strong>
      </section>
    );
  }
  const isPositive = summary.change >= 0;
  return (
    <section className="marketSummaryCard">
      <div className="marketSummaryTitle">
        <h4>{summary.name}</h4>
        <span className="liveStreamBadge liveStreamBadge--live"><i /> Tempo real</span>
      </div>
      <strong className="marketSummaryPrice">{formatPrice(summary.latest)}</strong>
      <span className={isPositive ? "marketSummaryChange positive" : "marketSummaryChange negative"}>
        {isPositive ? "+" : ""}{formatPrice(summary.change)} ({isPositive ? "+" : ""}{summary.changePct.toFixed(2)}%)
      </span>
      <div className="marketSummaryStats">
        <span>Máx.<strong>{formatPrice(summary.max)}</strong></span>
        <span>Mín.<strong>{formatPrice(summary.min)}</strong></span>
      </div>
    </section>
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
      <form className="tradingConfigForm" onSubmit={onSubmit}>
        <AssetCombobox
          assets={assets}
          value={form.symbol}
          onChange={(symbol) => setForm({ ...form, symbol })}
        />

        <label className="configField">
          Tipo de operação
          <select
            value={form.strategy_type}
            onChange={(event) => setForm({ ...form, strategy_type: event.target.value as OpportunityStrategyType })}
          >
            <option value="daytrade">Day Trade</option>
            <option value="swingtrade">Swing Trade</option>
          </select>
        </label>

        <label className="configField">
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

        <label className="configField">
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

        <button className="tradeActionButton tradingConfigSubmit" disabled={isLoading} type="submit">
          {isLoading ? <Loader2 size={17} /> : <Sparkles size={17} />}
          {isLoading ? "Analisando..." : "Analisar ativo"}
        </button>
      </form>
    </aside>
  );
}

function AssetCombobox({
  assets,
  value,
  onChange,
}: {
  assets: Array<{ symbol: string; name: string; category: string }>;
  value: string;
  onChange: (symbol: string) => void;
}) {
  const selectedAsset = assets.find((asset) => asset.symbol === value);
  const selectedLabel = selectedAsset ? `${selectedAsset.symbol} · ${selectedAsset.name}` : value;
  const [query, setQuery] = useState(selectedLabel);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setQuery(selectedLabel);
  }, [selectedLabel]);

  const filteredAssets = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
    if (!normalizedQuery || query === selectedLabel) {
      return assets.slice(0, 80);
    }
    return assets
      .filter((asset) =>
        `${asset.symbol} ${asset.name} ${asset.category}`.toLocaleLowerCase("pt-BR").includes(normalizedQuery),
      )
      .slice(0, 80);
  }, [assets, query, selectedLabel]);

  function selectAsset(asset: { symbol: string; name: string }) {
    onChange(asset.symbol);
    setQuery(`${asset.symbol} · ${asset.name}`);
    setIsOpen(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((current) => Math.min(current + 1, Math.max(filteredAssets.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter" && isOpen && filteredAssets[activeIndex]) {
      event.preventDefault();
      selectAsset(filteredAssets[activeIndex]);
    } else if (event.key === "Escape") {
      setQuery(selectedLabel);
      setIsOpen(false);
    }
  }

  return (
    <div className="fieldGroup configField assetCombobox">
      <label htmlFor="asset-search">Ativo / símbolo</label>
      <span className="assetComboboxControl">
        <Search aria-hidden="true" size={16} />
        <input
          id="asset-search"
          aria-autocomplete="list"
          aria-controls="asset-options"
          aria-expanded={isOpen}
          autoComplete="off"
          onBlur={() => {
            window.setTimeout(() => {
              setQuery(selectedLabel);
              setIsOpen(false);
            }, 120);
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
            setIsOpen(true);
          }}
          onFocus={() => {
            setQuery("");
            setActiveIndex(0);
            setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Pesquise por símbolo ou nome"
          role="combobox"
          value={query}
        />
      </span>
      {isOpen ? (
        <div className="assetComboboxMenu" id="asset-options" role="listbox">
          {filteredAssets.length > 0 ? (
            filteredAssets.map((asset, index) => (
              <button
                aria-selected={asset.symbol === value}
                className={index === activeIndex ? "assetComboboxOption assetComboboxOption--active" : "assetComboboxOption"}
                key={asset.symbol}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => selectAsset(asset)}
                role="option"
                type="button"
              >
                <strong>{asset.symbol}</strong>
                <span>{asset.name}</span>
                <em>{asset.category}</em>
              </button>
            ))
          ) : (
            <span className="assetComboboxEmpty">Nenhum ativo encontrado</span>
          )}
        </div>
      ) : null}
    </div>
  );
}

function OpportunityDecisionCard({
  signal,
  isLoading,
  error,
}: {
  signal: OpportunitySignal | null;
  isLoading: boolean;
  error: string | null;
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
        <span className={`decisionBadge decisionBadge--${tone}`}>{directionBadgeLabels[signal.direction]}</span>
        <span>{directionLabels[signal.direction]}</span>
      </div>

      <div className="decisionTitle">
        <h4>Decisão da IA</h4>
        <strong>{setupLabels[signal.setup_name] ?? signal.setup_name.replaceAll("_", " ")}</strong>
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

    </section>
  );
}

function OperationalMetricsCard({
  signal,
  formatPrice,
}: {
  signal: OpportunitySignal | null;
  formatPrice: (value: number) => string;
}) {
  return (
    <section className="operationalMetricsCard">
      <div className="metricMatrix">
        <RiskMetricCard label="Entrada" value={signal?.entry_price ? formatPrice(signal.entry_price) : "-"} />
        <RiskMetricCard label="Stop loss" value={signal?.stop_loss ? formatPrice(signal.stop_loss) : "-"} tone="danger" />
        <RiskMetricCard label="Take profit" value={signal?.take_profit ? formatPrice(signal.take_profit) : "-"} tone="success" />
        <RiskMetricCard label="Risco/retorno" value={signal?.risk_reward_ratio?.toString() ?? "-"} />
        <RiskMetricCard label="Posição sugerida" value={signal ? formatPrice(signal.position_size) : "-"} />
        <RiskMetricCard label="Perda máxima" value={signal ? formatPrice(signal.max_loss) : "-"} tone="warning" />
      </div>
    </section>
  );
}

function OperationalStatusCard({
  signal,
  provider,
  error,
  isLoading,
}: {
  signal: OpportunitySignal | null;
  provider: OpportunityProvider;
  error: string | null;
  isLoading: boolean;
}) {
  const providerStatus = getProviderStatus(provider, error);
  return (
    <section className="operationalStatusCard">
      <h4>Status operacional</h4>
      <div className="opsStatusRows">
        <span><Cable size={15} />Provedor<strong>{providerStatus}</strong></span>
        <span><Clock3 size={15} />Data e hora<strong>{signal ? new Date(signal.generated_at).toLocaleString("pt-BR") : isLoading ? "Processando" : "Aguardando"}</strong></span>
        <span><ShieldAlert size={15} />Execução real<strong>Bloqueada</strong></span>
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
}: {
  signal: OpportunitySignal | null;
  result: OpportunityResult | null;
}) {
  return (
    <section className="contextPanel">
      <AnalysisReasonList title="Razões técnicas" items={signal?.technical_reasons ?? []} emptyText="Aguardando leitura técnica." />
      <AnalysisReasonList title="Razões de risco" items={signal?.risk_reasons ?? []} emptyText="Aguardando avaliação de risco." />
      <AnalysisReasonList title="Invalidação" items={signal?.invalidation_criteria ?? []} emptyText="Sem critérios definidos ainda." />
      <AnalysisReasonList title="Alertas" items={[...(signal?.warnings ?? []), ...(result?.warnings ?? [])]} emptyText="Sem alertas adicionais." />

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
