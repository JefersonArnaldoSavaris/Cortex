"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, FileText, LineChart, Play, RefreshCw } from "lucide-react";
import { CandlestickSeries, ColorType, UTCTimestamp, createChart } from "lightweight-charts";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type AnalysisStatus = "queued" | "running" | "completed" | "failed";

type AnalysisRecord = {
  id: string;
  status: AnalysisStatus;
  request: AnalysisRequest;
  created_at: string;
  updated_at: string;
  decision?: string | null;
  report_path?: string | null;
  error?: string | null;
  events: Array<{ timestamp: string; level: "info" | "warning" | "error"; message: string }>;
};

type AnalysisRequest = {
  ticker: string;
  analysis_date: string;
  provider: string;
  quick_model: string;
  deep_model: string;
  analysts: string[];
  research_depth: number;
  output_language: string;
  mode: "quick_technical" | "standard" | "full";
  checkpoint: boolean;
};

type AssetOption = {
  symbol: string;
  name: string;
  category: string;
  default_provider_symbol: string;
};

type PricePoint = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number | null;
};

type AssetHistoryResponse = {
  symbol: string;
  name: string;
  period: string;
  interval: string;
  points: PricePoint[];
};

type OptionsResponse = {
  providers: Record<string, { quick: Array<{ label: string; value: string }>; deep: Array<{ label: string; value: string }> }>;
  assets: AssetOption[];
  default_request: AnalysisRequest;
};

const API_URL = process.env.NEXT_PUBLIC_TRADINGAGENTS_API_URL ?? "http://localhost:8000";

const analystOptions = [
  { value: "market", label: "Mercado" },
  { value: "news", label: "Notícias" },
  { value: "social", label: "Sentimento" },
  { value: "fundamentals", label: "Fundamentos" },
];

const statusLabels: Record<AnalysisStatus, string> = {
  queued: "Na fila",
  running: "Em execução",
  completed: "Concluída",
  failed: "Falhou",
};

const intervalOptions = [
  { value: "1m", label: "1m" },
  { value: "5m", label: "5m" },
  { value: "15m", label: "15m" },
  { value: "1h", label: "1h" },
  { value: "4h", label: "4h" },
  { value: "1d", label: "1D" },
];

const periodOptionsByInterval: Record<string, Array<{ value: string; label: string }>> = {
  "1m": [{ value: "1d", label: "1D" }],
  "5m": [
    { value: "1d", label: "1D" },
    { value: "5d", label: "5D" },
  ],
  "15m": [
    { value: "1d", label: "1D" },
    { value: "5d", label: "5D" },
    { value: "1mo", label: "1M" },
  ],
  "1h": [
    { value: "5d", label: "5D" },
    { value: "1mo", label: "1M" },
    { value: "3mo", label: "3M" },
  ],
  "4h": [
    { value: "1mo", label: "1M" },
    { value: "3mo", label: "3M" },
    { value: "6mo", label: "6M" },
  ],
  "1d": [
    { value: "1mo", label: "1M" },
    { value: "3mo", label: "3M" },
    { value: "6mo", label: "6M" },
    { value: "1y", label: "1A" },
  ],
};

const eventLabels: Record<string, string> = {
  "Analysis queued": "Análise adicionada à fila",
  "Worker started": "Processamento iniciado",
  "Building TradingAgents graph": "Preparando agentes",
  "Report saved": "Relatório salvo",
};

const intervalLabels: Record<string, string> = {
  "1m": "1 minuto",
  "5m": "5 minutos",
  "15m": "15 minutos",
  "1h": "1 hora",
  "4h": "4 horas",
  "1d": "1 dia",
};

const reportTranslations: Array<[RegExp, string]> = [
  [/Trading Analysis Report:/g, "Relatório de Análise:"],
  [/Generated:/g, "Gerado em:"],
  [/Analyst Team Reports/g, "Relatórios da Equipe de Análise"],
  [/Research Team Decision/g, "Decisão da Equipe de Research"],
  [/Trading Team Plan/g, "Plano da Equipe de Trading"],
  [/Risk Management Team Decision/g, "Decisão da Equipe de Risco"],
  [/Portfolio Manager Decision/g, "Decisão do Gestor de Portfólio"],
  [/Market Analyst/g, "Analista de Mercado"],
  [/Social Analyst/g, "Analista de Sentimento"],
  [/News Analyst/g, "Analista de Notícias"],
  [/Fundamentals Analyst/g, "Analista de Fundamentos"],
  [/Bull Researcher/g, "Pesquisador Altista"],
  [/Bear Researcher/g, "Pesquisador Baixista"],
  [/Research Manager/g, "Gestor de Research"],
  [/Aggressive Analyst/g, "Analista Agressivo"],
  [/Conservative Analyst/g, "Analista Conservador"],
  [/Neutral Analyst/g, "Analista Neutro"],
  [/Portfolio Manager/g, "Gestor de Portfólio"],
  [/Trader\b/g, "Trader"],
  [/FINAL TRANSACTION PROPOSAL:/g, "PROPOSTA FINAL DE TRANSAÇÃO:"],
  [/\bBUY\b/g, "COMPRAR"],
  [/\bHOLD\b/g, "MANTER"],
  [/\bSELL\b/g, "VENDER"],
];

const progressStages = [
  { key: "queued", label: "Na fila" },
  { key: "started", label: "Processamento" },
  { key: "graph", label: "Agentes" },
  { key: "running", label: "Análise" },
  { key: "saved", label: "Relatório" },
] as const;

type ProgressStageKey = (typeof progressStages)[number]["key"];
type ProgressStageState = "pending" | "active" | "completed";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function translateEvent(message: string) {
  if (message.startsWith("Running ")) return "Executando análise";
  return eventLabels[message] ?? message;
}

function formatPrice(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: value > 100 ? 2 : 4,
  }).format(value);
}

function formatPointLabel(value: string, interval: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  if (interval === "1d") {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    }).format(date);
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function cleanReportMarkdown(markdown: string) {
  let cleaned = markdown.replace(/\*\*([a-z]+_[a-z0-9_]+)\s+\(([^)]+)\):\*\*/g, "**$2:**");
  for (const [pattern, replacement] of reportTranslations) {
    cleaned = cleaned.replace(pattern, replacement);
  }
  return cleaned;
}

function getProgressStepIndex(events: AnalysisRecord["events"], status: AnalysisStatus) {
  const messages = new Set(events.map((event) => event.message));

  if (status === "completed" || messages.has("Report saved")) {
    return 4;
  }
  if (Array.from(messages).some((message) => message.startsWith("Running "))) {
    return 3;
  }
  if (messages.has("Building TradingAgents graph")) {
    return 2;
  }
  if (messages.has("Worker started") || status === "running") {
    return 1;
  }
  if (messages.has("Analysis queued") || status === "queued") {
    return 0;
  }
  return 0;
}

function getProgressStages(events: AnalysisRecord["events"], status: AnalysisStatus) {
  const activeIndex = getProgressStepIndex(events, status);

  return progressStages.map((stage, index) => {
    let state: ProgressStageState = "pending";
    if (index < activeIndex) state = "completed";
    else if (index === activeIndex) state = status === "completed" && index === progressStages.length - 1 ? "completed" : "active";

    return { ...stage, state };
  });
}

function CandleChart({ points, interval, period }: { points: PricePoint[]; interval: string; period: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const stats = useMemo(() => {
    if (points.length < 2) return null;
    const first = points[0];
    const last = points[points.length - 1];
    const closes = points.map((point) => point.close);
    const min = Math.min(...closes);
    const max = Math.max(...closes);
    const change = last.close - first.close;
    const changePct = (change / first.close) * 100;
    return { first, last, min, max, change, changePct };
  }, [points]);

  useEffect(() => {
    if (!containerRef.current || points.length < 2) return;

    const chart = createChart(containerRef.current, {
      autoSize: true,
      height: 320,
      layout: {
        background: { type: ColorType.Solid, color: "#ffffff" },
        textColor: "#475569",
        fontFamily: "Inter, system-ui, sans-serif",
      },
      grid: {
        vertLines: { color: "#eef2f7" },
        horzLines: { color: "#eef2f7" },
      },
      crosshair: {
        mode: 0,
      },
      rightPriceScale: {
        borderColor: "#d8dee8",
      },
      timeScale: {
        borderColor: "#d8dee8",
        timeVisible: interval !== "1d",
        secondsVisible: false,
      },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#0f766e",
      downColor: "#dc2626",
      borderUpColor: "#0f766e",
      borderDownColor: "#dc2626",
      wickUpColor: "#0f766e",
      wickDownColor: "#dc2626",
    });

    series.setData(
      points.map((point) => ({
        time: Math.floor(new Date(point.date).getTime() / 1000) as UTCTimestamp,
        open: point.open,
        high: point.high,
        low: point.low,
        close: point.close,
      })),
    );
    chart.timeScale().fitContent();

    return () => chart.remove();
  }, [interval, points]);

  if (!stats) {
    return <div className="chartEmpty">Sem dados suficientes para plotar o gráfico.</div>;
  }

  return (
    <div className="chartBox">
      <div className="chartStats">
        <span>
          Último <strong>{formatPrice(stats.last.close)}</strong>
        </span>
        <span className={stats.change >= 0 ? "positive" : "negative"}>
          {stats.change >= 0 ? "+" : ""}
          {formatPrice(stats.change)} ({stats.changePct.toFixed(2)}%)
        </span>
        <span>
          Mín. {formatPrice(stats.min)} / Máx. {formatPrice(stats.max)}
        </span>
        <span>
          {interval.toUpperCase()} · {period.toUpperCase()}
        </span>
      </div>
      <div className="priceChart" ref={containerRef} />
      <div className="chartDates">
        <span>{formatPointLabel(stats.first.date, interval)}</span>
        <span>{formatPointLabel(stats.last.date, interval)}</span>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [options, setOptions] = useState<OptionsResponse | null>(null);
  const [analyses, setAnalyses] = useState<AnalysisRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [report, setReport] = useState("");
  const [history, setHistory] = useState<PricePoint[]>([]);
  const [activeView, setActiveView] = useState<"mercado" | "analises">("mercado");
  const [chartInterval, setChartInterval] = useState("1d");
  const [chartPeriod, setChartPeriod] = useState("6mo");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isChartLoading, setIsChartLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<AnalysisRequest>({
    ticker: "SPY",
    analysis_date: today(),
    provider: "google",
    quick_model: "gemini-2.5-flash-lite",
    deep_model: "gemini-2.5-flash-lite",
    analysts: ["market"],
    research_depth: 1,
    output_language: "Portuguese",
    mode: "quick_technical",
    checkpoint: false,
  });

  const providerModels = useMemo(() => options?.providers[form.provider], [form.provider, options]);
  const completedAnalyses = analyses.filter((analysis) => analysis.status === "completed");
  const activeAnalysis =
    analyses.find((analysis) => analysis.status === "running") ??
    analyses.find((analysis) => analysis.status === "queued") ??
    null;
  const selectedAnalysis =
    completedAnalyses.find((analysis) => analysis.id === selectedId) ?? completedAnalyses[0] ?? null;
  const selectedAsset = options?.assets.find((asset) => asset.symbol === form.ticker);
  const periodOptions = periodOptionsByInterval[chartInterval] ?? periodOptionsByInterval["1d"];
  const activeChartPeriod = periodOptions.some((period) => period.value === chartPeriod)
    ? chartPeriod
    : (periodOptions[0]?.value ?? chartPeriod);
  const activeProgressStages = activeAnalysis ? getProgressStages(activeAnalysis.events, activeAnalysis.status) : [];

  function updateChartInterval(nextInterval: string) {
    const nextPeriods = periodOptionsByInterval[nextInterval] ?? periodOptionsByInterval["1d"];
    setChartInterval(nextInterval);
    setChartPeriod(nextPeriods[0]?.value ?? "1mo");
  }

  async function loadOptions() {
    const response = await fetch(`${API_URL}/config/options`);
    if (!response.ok) throw new Error("Não foi possível carregar as configurações.");
    const data = (await response.json()) as OptionsResponse;
    setOptions(data);
  }

  async function loadAnalyses() {
    const response = await fetch(`${API_URL}/analyses`);
    if (!response.ok) throw new Error("Não foi possível carregar as análises.");
    const data = (await response.json()) as { analyses: AnalysisRecord[] };
    setAnalyses(data.analyses);
    const completed = data.analyses.filter((analysis) => analysis.status === "completed");
    if (!selectedId && completed.length > 0) setSelectedId(completed[0].id);
  }

  async function loadReport(id: string) {
    const response = await fetch(`${API_URL}/analyses/${id}/report`);
    if (response.status === 404) {
      setReport("");
      return;
    }
    if (!response.ok) throw new Error("Não foi possível carregar o relatório.");
    const data = (await response.json()) as { markdown: string };
    setReport(data.markdown);
  }

  async function loadHistory(symbol: string, period: string, interval: string) {
    setIsChartLoading(true);
    try {
      const params = new URLSearchParams({ period, interval });
      const response = await fetch(`${API_URL}/assets/${symbol}/history?${params.toString()}`);
      if (!response.ok) throw new Error("Não foi possível carregar o gráfico.");
      const data = (await response.json()) as AssetHistoryResponse;
      setHistory(data.points);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado ao carregar gráfico.");
      setHistory([]);
    } finally {
      setIsChartLoading(false);
    }
  }

  useEffect(() => {
    loadOptions().catch((err: Error) => setError(err.message));
    loadAnalyses().catch((err: Error) => setError(err.message));
  }, []);

  useEffect(() => {
    if (activeChartPeriod !== chartPeriod) {
      setChartPeriod(activeChartPeriod);
      return;
    }
    loadHistory(form.ticker, activeChartPeriod, chartInterval).catch((err: Error) => setError(err.message));
  }, [activeChartPeriod, chartInterval, chartPeriod, form.ticker]);

  useEffect(() => {
    const hasActive = analyses.some((analysis) => analysis.status === "queued" || analysis.status === "running");
    if (!hasActive) return;
    const timer = window.setInterval(() => {
      loadAnalyses().catch((err: Error) => setError(err.message));
    }, 2500);
    return () => window.clearInterval(timer);
  }, [analyses]);

  useEffect(() => {
    if (selectedAnalysis?.status === "completed") {
      loadReport(selectedAnalysis.id).catch((err: Error) => setError(err.message));
    } else {
      setReport("");
    }
  }, [selectedAnalysis?.id, selectedAnalysis?.status]);

  function updateAnalysts(value: string) {
    setForm((current) => {
      const exists = current.analysts.includes(value);
      const analysts = exists ? current.analysts.filter((item) => item !== value) : [...current.analysts, value];
      return { ...current, analysts: analysts.length > 0 ? analysts : ["market"] };
    });
  }

  async function submitAnalysis(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/analyses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!response.ok) {
        const body = await response.text();
        throw new Error(body || "Não foi possível criar a análise.");
      }
      const data = (await response.json()) as { analysis: AnalysisRecord };
      setActiveView("analises");
      if (data.analysis.status === "completed") {
        setSelectedId(data.analysis.id);
      }
      await loadAnalyses();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function syncModelDefaults(provider: string) {
    const providerOptions = options?.providers[provider];
    setForm((current) => ({
      ...current,
      provider,
      quick_model: providerOptions?.quick[0]?.value ?? current.quick_model,
      deep_model: providerOptions?.deep[0]?.value ?? current.deep_model,
    }));
  }

  return (
    <main className="workspace">
      <aside className="sidebar">
        <div className="brand">
          <div className="brandMark">
            <BarChart3 size={22} />
          </div>
          <div>
            <h1>TradingAgents</h1>
            <span>Console de análises</span>
          </div>
        </div>

        <form className="analysisForm" onSubmit={submitAnalysis}>
          <label>
            Ativo
            <select value={form.ticker} onChange={(event) => setForm({ ...form, ticker: event.target.value })}>
              {(options?.assets ?? [{ symbol: "SPY", name: "SPDR S&P 500 ETF", category: "ETF", default_provider_symbol: "SPY" }]).map(
                (asset) => (
                  <option key={asset.symbol} value={asset.symbol}>
                    {asset.symbol} - {asset.name}
                  </option>
                ),
              )}
            </select>
          </label>

          <label>
            Data da análise
            <input
              type="date"
              value={form.analysis_date}
              onChange={(event) => setForm({ ...form, analysis_date: event.target.value })}
            />
          </label>

          <label>
            Provedor
            <select value={form.provider} onChange={(event) => syncModelDefaults(event.target.value)}>
              {Object.keys(options?.providers ?? { google: null }).map((provider) => (
                <option key={provider} value={provider}>
                  {provider}
                </option>
              ))}
            </select>
          </label>

          <label>
            Modelo rápido
            <select value={form.quick_model} onChange={(event) => setForm({ ...form, quick_model: event.target.value })}>
              {(providerModels?.quick ?? []).map((model) => (
                <option key={model.value} value={model.value}>
                  {model.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Modelo profundo
            <select value={form.deep_model} onChange={(event) => setForm({ ...form, deep_model: event.target.value })}>
              {(providerModels?.deep ?? []).map((model) => (
                <option key={model.value} value={model.value}>
                  {model.label}
                </option>
              ))}
            </select>
          </label>

          <div className="fieldGroup">
            <span>Analistas</span>
            <div className="toggleGrid">
              {analystOptions.map((option) => (
                <button
                  className={form.analysts.includes(option.value) ? "toggle active" : "toggle"}
                  key={option.value}
                  onClick={() => updateAnalysts(option.value)}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <label>
            Profundidade
            <input
              max={5}
              min={1}
              type="number"
              value={form.research_depth}
              onChange={(event) => setForm({ ...form, research_depth: Number(event.target.value) })}
            />
          </label>

          <label>
            Idioma do relatório
            <select value={form.output_language} onChange={(event) => setForm({ ...form, output_language: event.target.value })}>
              <option value="Portuguese">Português</option>
              <option value="English">Inglês</option>
              <option value="Spanish">Espanhol</option>
            </select>
          </label>

          <button className="primaryButton" disabled={isSubmitting} type="submit">
            {isSubmitting ? <RefreshCw size={17} /> : <Play size={17} />}
            Executar análise
          </button>
        </form>
      </aside>

      <section className="mainPanel">
        <header className="topbar">
          <div>
            <p className="eyebrow">Área de trabalho</p>
            <h2>Análises de trading</h2>
          </div>
          <button className="iconButton" onClick={() => loadAnalyses()} type="button" aria-label="Atualizar análises">
            <RefreshCw size={18} />
          </button>
        </header>

        {error && <div className="errorBanner">{error}</div>}

        <div className="viewTabs" role="tablist" aria-label="Navegação principal">
          <button
            className={activeView === "mercado" ? "viewTab active" : "viewTab"}
            onClick={() => setActiveView("mercado")}
            role="tab"
            type="button"
          >
            Mercado
          </button>
          <button
            className={activeView === "analises" ? "viewTab active" : "viewTab"}
            onClick={() => setActiveView("analises")}
            role="tab"
            type="button"
          >
            Análises e histórico
          </button>
        </div>

        {activeView === "mercado" ? (
          <section className="chartPanel">
            <div className="sectionTitle">
              <LineChart size={18} />
              <h3>
                Gráfico de {form.ticker}
                {selectedAsset ? <span>{selectedAsset.name}</span> : null}
              </h3>
            </div>
            <div className="chartToolbar">
              <div className="controlGroup">
                <span>Resolução</span>
                <div className="periodTabs">
                  {intervalOptions.map((interval) => (
                    <button
                      className={chartInterval === interval.value ? "periodTab active" : "periodTab"}
                      key={interval.value}
                      onClick={() => updateChartInterval(interval.value)}
                      type="button"
                    >
                      {interval.label}
                    </button>
                  ))}
                </div>
              </div>
              <label className="rangeSelect">
                <span>Histórico</span>
                <select value={activeChartPeriod} onChange={(event) => setChartPeriod(event.target.value)}>
                  {periodOptions.map((period) => (
                    <option key={period.value} value={period.value}>
                      {period.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="chartHint">
              <span>
                Resolução atual: <strong>{intervalLabels[chartInterval] ?? chartInterval}</strong>
              </span>
              <span>
                Janela: <strong>{periodOptions.find((item) => item.value === activeChartPeriod)?.label ?? activeChartPeriod}</strong>
              </span>
            </div>
            {isChartLoading ? (
              <div className="chartEmpty">Carregando gráfico...</div>
            ) : (
              <CandleChart points={history} interval={chartInterval} period={activeChartPeriod} />
            )}
          </section>
        ) : (
          <section className="detailPanel detailPanelFull">
            <div className="sectionTitle">
              <FileText size={18} />
              <h3>Relatório e histórico</h3>
            </div>

            {activeAnalysis && (
              <div className="progressBanner">
                <div className="progressBannerHeader">
                  <strong>
                    {activeAnalysis.request.ticker} em {statusLabels[activeAnalysis.status]}
                  </strong>
                  <span>{activeAnalysis.request.analysis_date}</span>
                </div>
                <div className="progressTimeline" aria-label="Andamento da análise">
                  {activeProgressStages.map((stage, index) => (
                    <div
                      className={`progressStage progressStage--${stage.state}`}
                      key={stage.key}
                    >
                      <div className="progressStageTrack">
                        {index > 0 ? (
                          <span
                            className={
                              activeProgressStages[index - 1].state === "completed"
                                ? "progressStageLine progressStageLine--filled"
                                : "progressStageLine"
                            }
                          />
                        ) : null}
                        <span className="progressStageDot" />
                      </div>
                      <div className="progressStageText">
                        <strong>{stage.label}</strong>
                        <span>
                          {stage.state === "completed"
                            ? "Concluído"
                            : stage.state === "active"
                              ? "Em andamento"
                              : "Aguardando"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {completedAnalyses.length > 0 && (
              <label className="historySelect">
                <span>Execução concluída</span>
                <select
                  value={selectedAnalysis?.id ?? completedAnalyses[0]?.id ?? ""}
                  onChange={(event) => setSelectedId(event.target.value)}
                >
                  {completedAnalyses.map((analysis) => (
                    <option key={analysis.id} value={analysis.id}>
                      {analysis.request.ticker} · {analysis.request.analysis_date} · {analysis.request.provider}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {!selectedAnalysis && !activeAnalysis && <p className="emptyState">Nenhuma análise concluída ainda.</p>}

            {selectedAnalysis && (
              <>
                <div className="summaryStrip">
                  <span>{selectedAnalysis.request.provider}</span>
                  <span>{selectedAnalysis.request.quick_model}</span>
                  <span>{selectedAnalysis.request.deep_model}</span>
                  <span>{selectedAnalysis.request.analysts.map((item) => analystOptions.find((option) => option.value === item)?.label ?? item).join(", ")}</span>
                </div>

                {selectedAnalysis.error && <div className="errorBanner">{selectedAnalysis.error}</div>}

                {report ? (
                  <article className="markdownPreview">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{cleanReportMarkdown(report)}</ReactMarkdown>
                  </article>
                ) : (
                  <p className="emptyState">
                    {selectedAnalysis.status === "completed" ? "Relatório indisponível." : "A análise ainda está em execução."}
                  </p>
                )}
              </>
            )}
          </section>
        )}
      </section>
    </main>
  );
}
