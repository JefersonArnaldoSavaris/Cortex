"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Bell,
  FileText,
  LineChart,
  Network,
  Play,
  RefreshCw,
} from "lucide-react";
import { CandlestickSeries, ColorType, UTCTimestamp, createChart } from "lightweight-charts";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import {
  AppShell,
  DashboardHome,
  EmptyState,
  ErrorState,
  FeaturePlaceholder,
  LoadingState,
  type SessionUser,
  type ViewKey,
} from "./components/platform";
import { AuthScreen, type AuthMode } from "./components/auth";
import { OpportunityWorkspace } from "./opportunities/OpportunityWorkspace";
import type { OpportunityRequest, OpportunityResult, OpportunitySignal, OpportunityTimeframe } from "./opportunities/types";

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

type AuthResponse = {
  user: SessionUser;
};

type MT5StatusResponse = {
  connected: boolean;
  login?: number | null;
  server?: string | null;
  name?: string | null;
  company?: string | null;
  currency?: string | null;
  balance?: number | null;
  equity?: number | null;
  margin?: number | null;
  trade_allowed?: boolean | null;
  message?: string | null;
};

type MT5ConnectForm = {
  login: string;
  password: string;
  server: string;
  terminal_path: string;
};

const API_URL = process.env.NEXT_PUBLIC_CORTEX_API_URL ?? "http://localhost:8000";

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
  "Building Cortex graph": "Preparando agentes",
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

const timeframeToChartInterval: Record<OpportunityTimeframe, string> = {
  M1: "1m",
  M5: "5m",
  M15: "15m",
  M30: "15m",
  H1: "1h",
  H4: "4h",
  D1: "1d",
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
  if (messages.has("Building Cortex graph")) {
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

function CandleChart({
  points,
  interval,
  period,
  opportunity,
}: {
  points: PricePoint[];
  interval: string;
  period: string;
  opportunity?: OpportunitySignal | null;
}) {
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
        background: { type: ColorType.Solid, color: "#080f1a" },
        textColor: "#8fa0b7",
        fontFamily: "Inter, system-ui, sans-serif",
      },
      grid: {
        vertLines: { color: "rgba(148, 163, 184, 0.10)" },
        horzLines: { color: "rgba(148, 163, 184, 0.10)" },
      },
      crosshair: {
        mode: 0,
      },
      rightPriceScale: {
        borderColor: "rgba(148, 163, 184, 0.24)",
      },
      timeScale: {
        borderColor: "rgba(148, 163, 184, 0.24)",
        timeVisible: interval !== "1d",
        secondsVisible: false,
      },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderUpColor: "#22c55e",
      borderDownColor: "#ef4444",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
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

    if (opportunity?.entry_price) {
      series.createPriceLine({
        price: opportunity.entry_price,
        color: "#22d3ee",
        lineWidth: 2,
        lineStyle: 2,
        axisLabelVisible: true,
        title: "Entrada",
      });
    }
    if (opportunity?.stop_loss) {
      series.createPriceLine({
        price: opportunity.stop_loss,
        color: "#ef4444",
        lineWidth: 2,
        lineStyle: 2,
        axisLabelVisible: true,
        title: "Stop",
      });
    }
    if (opportunity?.take_profit) {
      series.createPriceLine({
        price: opportunity.take_profit,
        color: "#22c55e",
        lineWidth: 2,
        lineStyle: 2,
        axisLabelVisible: true,
        title: "Alvo",
      });
    }
    chart.timeScale().fitContent();

    return () => chart.remove();
  }, [interval, opportunity?.entry_price, opportunity?.stop_loss, opportunity?.take_profit, points]);

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
      {opportunity?.entry_price || opportunity?.stop_loss || opportunity?.take_profit ? (
        <div className="levelLegend" aria-label="Níveis da oportunidade">
          {opportunity.entry_price ? <span className="levelLegendEntry">Entrada {formatPrice(opportunity.entry_price)}</span> : null}
          {opportunity.stop_loss ? <span className="levelLegendStop">Stop {formatPrice(opportunity.stop_loss)}</span> : null}
          {opportunity.take_profit ? <span className="levelLegendTarget">Alvo {formatPrice(opportunity.take_profit)}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

async function readApiError(response: Response, fallback: string) {
  const body = await response.json().catch(() => null);
  if (typeof body?.detail === "string") return body.detail;
  if (Array.isArray(body?.detail) && body.detail[0]?.msg) return body.detail[0].msg;
  if (typeof body?.message === "string") return body.message;
  return fallback;
}

export default function Dashboard() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authInfo, setAuthInfo] = useState<string | null>(null);
  const [options, setOptions] = useState<OptionsResponse | null>(null);
  const [analyses, setAnalyses] = useState<AnalysisRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [report, setReport] = useState("");
  const [history, setHistory] = useState<PricePoint[]>([]);
  const [activeView, setActiveView] = useState<ViewKey>("dashboard");
  const [chartInterval, setChartInterval] = useState("1d");
  const [chartPeriod, setChartPeriod] = useState("6mo");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOpportunityLoading, setIsOpportunityLoading] = useState(false);
  const [isChartLoading, setIsChartLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opportunityError, setOpportunityError] = useState<string | null>(null);
  const [opportunityResult, setOpportunityResult] = useState<OpportunityResult | null>(null);
  const [marketDataProvider, setMarketDataProvider] = useState<"yfinance" | "mt5">("yfinance");
  const [mt5Status, setMt5Status] = useState<MT5StatusResponse>({ connected: false });
  const [mt5Form, setMt5Form] = useState<MT5ConnectForm>({ login: "", password: "", server: "", terminal_path: "" });
  const [mt5Error, setMt5Error] = useState<string | null>(null);
  const [isMt5Loading, setIsMt5Loading] = useState(false);
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
  const [opportunityForm, setOpportunityForm] = useState<OpportunityRequest>({
    symbol: "SPY",
    strategy_type: "daytrade",
    timeframe: "M15",
    risk_profile: "moderado",
    capital: 10_000,
    max_risk_per_trade: 0.01,
    max_signals: 1,
    provider: "mock",
    limit: 160,
  });

  async function loadCurrentUser() {
    try {
      const response = await fetch(`${API_URL}/auth/me`, { credentials: "include" });
      if (response.status === 401 || response.status === 403) {
        setUser(null);
        return;
      }
      if (!response.ok) throw new Error(await readApiError(response, "Não foi possível validar a sessão."));
      const data = (await response.json()) as AuthResponse;
      setUser(data.user);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Erro inesperado ao validar sessão.");
      setUser(null);
    } finally {
      setIsAuthChecking(false);
    }
  }

  async function login(email: string, password: string) {
    setIsAuthLoading(true);
    setAuthError(null);
    setAuthInfo(null);
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) throw new Error(await readApiError(response, "Não foi possível entrar."));
      const data = (await response.json()) as AuthResponse;
      setUser(data.user);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Erro inesperado ao entrar.");
    } finally {
      setIsAuthLoading(false);
    }
  }

  async function register(payload: { name: string; email: string; password: string; acceptedTerms: boolean }) {
    setIsAuthLoading(true);
    setAuthError(null);
    setAuthInfo(null);
    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: payload.name,
          email: payload.email,
          password: payload.password,
          accepted_terms: payload.acceptedTerms,
        }),
      });
      if (!response.ok) throw new Error(await readApiError(response, "Não foi possível criar a conta."));
      const data = (await response.json()) as AuthResponse;
      setUser(data.user);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Erro inesperado ao criar conta.");
    } finally {
      setIsAuthLoading(false);
    }
  }

  async function forgotPassword(email: string) {
    setIsAuthLoading(true);
    setAuthError(null);
    setAuthInfo(null);
    try {
      const response = await fetch(`${API_URL}/auth/forgot-password`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!response.ok) throw new Error(await readApiError(response, "Não foi possível solicitar recuperação."));
      const body = (await response.json()) as { message: string };
      setAuthInfo(body.message);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Erro inesperado ao solicitar recuperação.");
    } finally {
      setIsAuthLoading(false);
    }
  }

  async function logout() {
    await fetch(`${API_URL}/auth/logout`, { method: "POST", credentials: "include" }).catch(() => null);
    setUser(null);
    setOptions(null);
    setAnalyses([]);
    setReport("");
    setMt5Status({ connected: false });
    setMarketDataProvider("yfinance");
    setAuthMode("login");
  }

  const providerModels = useMemo(() => options?.providers[form.provider], [form.provider, options]);
  const completedAnalyses = analyses.filter((analysis) => analysis.status === "completed");
  const activeAnalysis =
    analyses.find((analysis) => analysis.status === "running") ??
    analyses.find((analysis) => analysis.status === "queued") ??
    null;
  const selectedAnalysis =
    completedAnalyses.find((analysis) => analysis.id === selectedId) ?? completedAnalyses[0] ?? null;
  const chartSymbol = activeView === "oportunidades-micro"
    ? (opportunityForm.symbol.trim().toUpperCase() || "SPY")
    : form.ticker;
  const selectedAsset = options?.assets.find((asset) => asset.symbol === chartSymbol);
  const opportunitySignal = opportunityResult?.signals[0] ?? null;
  const periodOptions = periodOptionsByInterval[chartInterval] ?? periodOptionsByInterval["1d"];
  const activeChartPeriod = periodOptions.some((period) => period.value === chartPeriod)
    ? chartPeriod
    : (periodOptions[0]?.value ?? chartPeriod);
  const activeProgressStages = activeAnalysis ? getProgressStages(activeAnalysis.events, activeAnalysis.status) : [];
  const marketStats = useMemo(() => {
    if (history.length < 2) {
      return { latestPrice: "-", changePct: 0 };
    }
    const first = history[0];
    const last = history[history.length - 1];
    return {
      latestPrice: formatPrice(last.close),
      changePct: ((last.close - first.close) / first.close) * 100,
    };
  }, [history]);

  function updateChartInterval(nextInterval: string) {
    const nextPeriods = periodOptionsByInterval[nextInterval] ?? periodOptionsByInterval["1d"];
    setChartInterval(nextInterval);
    setChartPeriod(nextPeriods[0]?.value ?? "1mo");
  }

  async function loadOptions() {
    const response = await fetch(`${API_URL}/config/options`, { credentials: "include" });
    if (response.status === 401 || response.status === 403) {
      setUser(null);
      throw new Error("Sessão expirada. Entre novamente.");
    }
    if (!response.ok) throw new Error("Não foi possível carregar as configurações.");
    const data = (await response.json()) as OptionsResponse;
    setOptions(data);
  }

  async function loadAnalyses() {
    const response = await fetch(`${API_URL}/analyses`, { credentials: "include" });
    if (response.status === 401 || response.status === 403) {
      setUser(null);
      throw new Error("Sessão expirada. Entre novamente.");
    }
    if (!response.ok) throw new Error("Não foi possível carregar as análises.");
    const data = (await response.json()) as { analyses: AnalysisRecord[] };
    setAnalyses(data.analyses);
    const completed = data.analyses.filter((analysis) => analysis.status === "completed");
    if (!selectedId && completed.length > 0) setSelectedId(completed[0].id);
  }

  async function loadReport(id: string) {
    const response = await fetch(`${API_URL}/analyses/${id}/report`, { credentials: "include" });
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
      const params = new URLSearchParams({ period, interval, provider: marketDataProvider });
      const response = await fetch(`${API_URL}/assets/${symbol}/history?${params.toString()}`, { credentials: "include" });
      if (response.status === 401 || response.status === 403) {
        setUser(null);
        throw new Error("Sessão expirada. Entre novamente.");
      }
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

  async function loadMt5Status() {
    const response = await fetch(`${API_URL}/integrations/mt5/status`, { credentials: "include" });
    if (response.status === 401 || response.status === 403) {
      setUser(null);
      throw new Error("Sessão expirada. Entre novamente.");
    }
    if (!response.ok) throw new Error(await readApiError(response, "Não foi possível consultar o MT5."));
    const data = (await response.json()) as MT5StatusResponse;
    setMt5Status(data);
    if (!data.connected) setMarketDataProvider("yfinance");
  }

  useEffect(() => {
    void loadCurrentUser();
  }, []);

  useEffect(() => {
    if (!user) return;
    loadOptions().catch((err: Error) => setError(err.message));
    loadAnalyses().catch((err: Error) => setError(err.message));
    loadMt5Status().catch((err: Error) => setMt5Error(err.message));
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    if (activeChartPeriod !== chartPeriod) {
      setChartPeriod(activeChartPeriod);
      return;
    }
    const timer = window.setTimeout(() => {
      loadHistory(chartSymbol, activeChartPeriod, chartInterval).catch((err: Error) => setError(err.message));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [activeChartPeriod, chartInterval, chartPeriod, chartSymbol, marketDataProvider, user]);

  useEffect(() => {
    if (activeView !== "oportunidades-micro") return;
    const nextInterval = timeframeToChartInterval[opportunityForm.timeframe];
    if (nextInterval !== chartInterval) updateChartInterval(nextInterval);
  }, [activeView, opportunityForm.timeframe]);

  useEffect(() => {
    if (!user) return;
    const hasActive = analyses.some((analysis) => analysis.status === "queued" || analysis.status === "running");
    if (!hasActive) return;
    const timer = window.setInterval(() => {
      loadAnalyses().catch((err: Error) => setError(err.message));
    }, 2500);
    return () => window.clearInterval(timer);
  }, [analyses, user]);

  useEffect(() => {
    if (!user) return;
    if (selectedAnalysis?.status === "completed") {
      loadReport(selectedAnalysis.id).catch((err: Error) => setError(err.message));
    } else {
      setReport("");
    }
  }, [selectedAnalysis?.id, selectedAnalysis?.status, user]);

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
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!response.ok) {
        const body = await response.text();
        throw new Error(body || "Não foi possível criar a análise.");
      }
      const data = (await response.json()) as { analysis: AnalysisRecord };
      setActiveView("oportunidades-macro");
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

  async function submitOpportunity(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsOpportunityLoading(true);
    setOpportunityError(null);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/opportunities/analyze`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(opportunityForm),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        const detail = typeof body?.detail === "string" ? body.detail : "Não foi possível analisar a oportunidade.";
        throw new Error(detail);
      }
      const data = (await response.json()) as OpportunityResult;
      setOpportunityResult(data);
      const nextInterval = timeframeToChartInterval[opportunityForm.timeframe];
      updateChartInterval(nextInterval);
      setForm((current) => ({ ...current, ticker: opportunityForm.symbol }));
      setActiveView("oportunidades-micro");
    } catch (err) {
      setOpportunityResult(null);
      setOpportunityError(err instanceof Error ? err.message : "Erro inesperado ao analisar oportunidade.");
    } finally {
      setIsOpportunityLoading(false);
    }
  }

  async function connectMt5(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsMt5Loading(true);
    setMt5Error(null);
    try {
      const response = await fetch(`${API_URL}/integrations/mt5/connect`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          login: Number(mt5Form.login),
          password: mt5Form.password,
          server: mt5Form.server,
          terminal_path: mt5Form.terminal_path || null,
        }),
      });
      if (!response.ok) throw new Error(await readApiError(response, "Não foi possível conectar ao MT5."));
      const data = (await response.json()) as MT5StatusResponse;
      setMt5Status(data);
      setMarketDataProvider("mt5");
      setOpportunityForm((current) => ({ ...current, provider: "mt5" }));
      setMt5Form((current) => ({ ...current, password: "" }));
    } catch (err) {
      setMt5Error(err instanceof Error ? err.message : "Erro inesperado ao conectar MT5.");
    } finally {
      setIsMt5Loading(false);
    }
  }

  async function disconnectMt5() {
    setIsMt5Loading(true);
    setMt5Error(null);
    try {
      const response = await fetch(`${API_URL}/integrations/mt5/disconnect`, { method: "POST", credentials: "include" });
      if (!response.ok) throw new Error(await readApiError(response, "Não foi possível desconectar o MT5."));
      const data = (await response.json()) as MT5StatusResponse;
      setMt5Status(data);
      setMarketDataProvider("yfinance");
      setOpportunityForm((current) => ({ ...current, provider: "mock" }));
    } catch (err) {
      setMt5Error(err instanceof Error ? err.message : "Erro inesperado ao desconectar MT5.");
    } finally {
      setIsMt5Loading(false);
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

  function returnHome() {
    setActiveView("dashboard");
    setSelectedId(null);
    setReport("");
    setError(null);
    setOpportunityError(null);
    setOpportunityResult(null);
    setIsSubmitting(false);
    setIsOpportunityLoading(false);
  }

  if (isAuthChecking) {
    return (
      <main className="authShell authShell--checking">
        <LoadingState message="Validando sessão segura..." />
      </main>
    );
  }

  if (!user) {
    return (
      <AuthScreen
        error={authError}
        info={authInfo}
        isLoading={isAuthLoading}
        mode={authMode}
        onForgot={forgotPassword}
        onLogin={login}
        onModeChange={(nextMode) => {
          setAuthMode(nextMode);
          setAuthError(null);
          setAuthInfo(null);
        }}
        onRegister={register}
      />
    );
  }

  const analysisControlPanel = (
    <form className="analysisForm" onSubmit={submitAnalysis}>
      <div className="controlPanelTitle">
        <span>AI research</span>
        <strong>Nova análise</strong>
      </div>

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
        Data
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
        Idioma
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
  );

  const marketPanel = (
          <section className="chartPanel">
            <div className="sectionTitle">
              <LineChart size={18} />
              <h3>
                Gráfico de {chartSymbol}
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
              <span>
                Fonte: <strong>{marketDataProvider === "mt5" ? "MetaTrader 5" : "yFinance"}</strong>
              </span>
            </div>
            {isChartLoading ? (
              <LoadingState message="Carregando gráfico de mercado..." />
            ) : (
              <CandleChart points={history} interval={chartInterval} period={activeChartPeriod} opportunity={opportunitySignal} />
            )}
          </section>
  );

  return (
    <AppShell
      activeView={activeView}
      apiStatus={error ? "degraded" : "online"}
      controlPanel={null}
      marketStatus="Mercado aberto simulado"
      onHome={returnHome}
      onNavigate={setActiveView}
      onLogout={logout}
      onRefresh={() => loadAnalyses()}
      selectedSymbol={chartSymbol}
      user={user}
    >
      {error ? <ErrorState message={error} /> : null}

      {activeView === "dashboard" ? (
        <DashboardHome
          activeAnalysisLabel={activeAnalysis ? `${activeAnalysis.request.ticker} em ${statusLabels[activeAnalysis.status]}` : "Nenhuma execução ativa"}
          assetName={selectedAsset?.name ?? "Ativo monitorado"}
          chartSlot={marketPanel}
          completedCount={completedAnalyses.length}
          latestPrice={marketStats.latestPrice}
          marketChangePct={marketStats.changePct}
          onOpenIntegrations={() => setActiveView("integracoes")}
          onOpenOpportunities={() => setActiveView("oportunidades-micro")}
          opportunitySignal={opportunitySignal}
          selectedSymbol={form.ticker}
        />
      ) : activeView === "oportunidades-micro" ? (
        <OpportunityWorkspace
          assets={options?.assets ?? [
            { symbol: "SPY", name: "SPDR S&P 500 ETF", category: "ETF", default_provider_symbol: "SPY" },
          ]}
          chartSlot={marketPanel}
          error={opportunityError}
          form={opportunityForm}
          formatPrice={formatPrice}
          isLoading={isOpportunityLoading}
          onSubmit={submitOpportunity}
          result={opportunityResult}
          setForm={setOpportunityForm}
        />
      ) : activeView === "oportunidades-macro" ? (
          <section className="detailPanel detailPanelFull">
            <div className="sectionTitle">
              <FileText size={18} />
              <h3>Macro AI Research</h3>
            </div>

            <div className="macroResearchForm">
              {analysisControlPanel}
            </div>

            {marketPanel}

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

            {!selectedAnalysis && !activeAnalysis && (
              <EmptyState
                title="Nenhuma análise concluída ainda"
                message="Execute uma análise multiagente pelo painel lateral para preencher o histórico."
                icon={FileText}
              />
            )}

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
      ) : activeView === "backtest" ? (
        <FeaturePlaceholder
          icon={Activity}
          title="Backtest e validação"
          message="Módulo visual para validar setups antes de qualquer uso operacional futuro."
          items={["Cenários históricos", "Métricas de drawdown", "Win rate simulado", "Comparação por timeframe"]}
        />
      ) : activeView === "alertas" ? (
        <FeaturePlaceholder
          icon={Bell}
          title="Alertas inteligentes"
          message="Centro para acompanhar gatilhos de preço, risco, volatilidade e mudanças de direção da IA."
          items={["Alertas por ativo", "Mudança de setup", "Risco excedido", "Notificações futuras"]}
        />
      ) : (
        <section className="detailPanel detailPanelFull">
          <div className="sectionTitle">
            <Network size={18} />
            <h3>Integrações</h3>
          </div>

          <div className="brokerIntegrationGrid">
            <form className="brokerConnectionPanel" onSubmit={connectMt5}>
              <div className="controlPanelTitle">
                <span>MetaTrader 5</span>
                <strong>Conectar corretora</strong>
              </div>

              <label>
                Servidor
                <input
                  placeholder="Ex.: Broker-Demo"
                  value={mt5Form.server}
                  onChange={(event) => setMt5Form({ ...mt5Form, server: event.target.value })}
                />
              </label>

              <label>
                Usuário / login
                <input
                  inputMode="numeric"
                  placeholder="Número da conta MT5"
                  value={mt5Form.login}
                  onChange={(event) => setMt5Form({ ...mt5Form, login: event.target.value })}
                />
              </label>

              <label>
                Senha
                <input
                  autoComplete="current-password"
                  type="password"
                  value={mt5Form.password}
                  onChange={(event) => setMt5Form({ ...mt5Form, password: event.target.value })}
                />
              </label>

              <label>
                Caminho do terminal MT5
                <input
                  placeholder="Opcional"
                  value={mt5Form.terminal_path}
                  onChange={(event) => setMt5Form({ ...mt5Form, terminal_path: event.target.value })}
                />
              </label>

              {mt5Error ? <div className="errorBanner">{mt5Error}</div> : null}

              <div className="brokerActions">
                <button className="primaryButton" disabled={isMt5Loading} type="submit">
                  {isMt5Loading ? <RefreshCw size={17} /> : <Network size={17} />}
                  {isMt5Loading ? "Conectando..." : "Conectar MT5"}
                </button>
                <button className="secondaryPanelAction" disabled={isMt5Loading || !mt5Status.connected} onClick={disconnectMt5} type="button">
                  Desconectar
                </button>
              </div>
            </form>

            <aside className="brokerStatusPanel">
              <div className="panelHeader">
                <Network size={18} />
                <div>
                  <h4>Status da corretora</h4>
                  <span>{mt5Status.connected ? "Dados de mercado via MT5" : "Aguardando conexão"}</span>
                </div>
              </div>

              <div className="opsStatusRows">
                <span>
                  Provider
                  <strong>{marketDataProvider === "mt5" ? "MetaTrader 5" : "yFinance"}</strong>
                </span>
                <span>
                  Conta
                  <strong>{mt5Status.login ?? "-"}</strong>
                </span>
                <span>
                  Servidor
                  <strong>{mt5Status.server ?? "-"}</strong>
                </span>
                <span>
                  Corretora
                  <strong>{mt5Status.company ?? "-"}</strong>
                </span>
                <span>
                  Saldo
                  <strong>{typeof mt5Status.balance === "number" ? formatPrice(mt5Status.balance) : "-"}</strong>
                </span>
                <span>
                  Execução real
                  <strong>Bloqueada</strong>
                </span>
              </div>

              <button
                className="secondaryPanelAction"
                disabled={!mt5Status.connected}
                onClick={() => setMarketDataProvider(mt5Status.connected ? "mt5" : "yfinance")}
                type="button"
              >
                Usar MT5 nos gráficos
                <RefreshCw size={16} />
              </button>
            </aside>
          </div>
        </section>
      )}
    </AppShell>
  );
}
