"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Building2,
  FileText,
  HardDrive,
  LockKeyhole,
  Network,
  Play,
  RefreshCw,
  Server,
  UserRound,
  Wallet,
} from "lucide-react";
import { CandlestickSeries, ColorType, type ISeriesApi, UTCTimestamp, createChart } from "lightweight-charts";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import {
  AppShell,
  EmptyState,
  ErrorState,
  LoadingState,
  type SessionUser,
  type ViewKey,
} from "./components/platform";
import { AuthScreen, type AuthMode } from "./components/auth";
import { AssetCombobox, OpportunityWorkspace } from "./opportunities/OpportunityWorkspace";
import type { OpportunityRequest, OpportunityResult, OpportunitySignal, OpportunityTimeframe, OrderExecution, OrderPreview, OrderStatus, PendingOrderStatus } from "./opportunities/types";

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

type MarketTick = {
  type: "tick";
  symbol: string;
  timestamp: number;
  bid: number;
  ask: number;
  last: number;
  volume: number;
};

type StreamStatus = "offline" | "connecting" | "live" | "reconnecting" | "error";

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

type MT5SymbolResponse = {
  symbols: Array<{
    symbol: string;
    name: string;
    category: string;
    path?: string | null;
    visible: boolean;
  }>;
};

type StrategyOption = {
  id: string;
  name: string;
  description: string;
  supported_timeframes: string[];
  context_timeframes: string[];
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

const periodOptionsByInterval: Record<string, Array<{ value: string; label: string }>> = {
  "1m": [
    { value: "1d", label: "1D" },
    { value: "7d", label: "7D" },
  ],
  "5m": [
    { value: "1d", label: "1D" },
    { value: "5d", label: "5D" },
    { value: "60d", label: "60D" },
  ],
  "15m": [
    { value: "1d", label: "1D" },
    { value: "5d", label: "5D" },
    { value: "1mo", label: "1M" },
    { value: "60d", label: "60D" },
  ],
  "1h": [
    { value: "5d", label: "5D" },
    { value: "1mo", label: "1M" },
    { value: "3mo", label: "3M" },
    { value: "2y", label: "2A" },
  ],
  "4h": [
    { value: "1mo", label: "1M" },
    { value: "3mo", label: "3M" },
    { value: "6mo", label: "6M" },
    { value: "2y", label: "2A" },
  ],
  "1d": [
    { value: "1mo", label: "1M" },
    { value: "3mo", label: "3M" },
    { value: "6mo", label: "6M" },
    { value: "1y", label: "1A" },
    { value: "max", label: "Máximo" },
  ],
};

const eventLabels: Record<string, string> = {
  "Analysis queued": "Análise adicionada à fila",
  "Worker started": "Processamento iniciado",
  "Building Cortex graph": "Preparando agentes",
  "Report saved": "Relatório salvo",
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

function formatOperationValue(currency: string | undefined, value: number | null | undefined) {
  if (value == null) return null;
  const formatted = new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: "always",
  }).format(value);
  return `${currency || ""} ${formatted}`.trim();
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
  assetName,
  points,
  interval,
  period,
  opportunity,
  liveCandle,
  streamStatus,
}: {
  assetName?: string;
  points: PricePoint[];
  interval: string;
  period: string;
  opportunity?: {
    entry_price?: number | null;
    stop_loss?: number | null;
    take_profit?: number | null;
    profit?: number | null;
    stop_result?: number | null;
    target_result?: number | null;
    currency?: string;
    levelSource?: "analysis" | "execution";
  } | null;
  liveCandle?: PricePoint | null;
  streamStatus: StreamStatus;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const entryLineRef = useRef<ReturnType<ISeriesApi<"Candlestick">["createPriceLine"]> | null>(null);
  const stopLineRef = useRef<ReturnType<ISeriesApi<"Candlestick">["createPriceLine"]> | null>(null);
  const targetLineRef = useRef<ReturnType<ISeriesApi<"Candlestick">["createPriceLine"]> | null>(null);
  const pointsRef = useRef(points);
  pointsRef.current = points;
  const isAnalysisLevel = opportunity?.levelSource === "analysis";

  const displayPoints = useMemo(() => {
    if (!liveCandle) return points;
    const liveTime = new Date(liveCandle.date).getTime();
    const withoutCurrent = points.filter((point) => new Date(point.date).getTime() !== liveTime);
    return [...withoutCurrent, liveCandle].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [liveCandle, points]);

  const stats = useMemo(() => {
    if (displayPoints.length < 2) return null;
    const first = displayPoints[0];
    const last = displayPoints[displayPoints.length - 1];
    const closes = displayPoints.map((point) => point.close);
    const min = Math.min(...closes);
    const max = Math.max(...closes);
    const change = last.close - first.close;
    const changePct = (change / first.close) * 100;
    return { first, last, min, max, change, changePct };
  }, [displayPoints]);

  useEffect(() => {
    if (!containerRef.current) return;

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
    seriesRef.current = series;
    if (pointsRef.current.length > 0) {
      series.setData(pointsRef.current.map((point) => ({
        time: Math.floor(new Date(point.date).getTime() / 1000) as UTCTimestamp,
        open: point.open,
        high: point.high,
        low: point.low,
        close: point.close,
      })));
    }

    if (opportunity?.entry_price) {
      entryLineRef.current = series.createPriceLine({
        price: opportunity.entry_price,
        color: isAnalysisLevel ? "#a78bfa" : "#22d3ee",
        lineWidth: 2,
        lineStyle: isAnalysisLevel ? 3 : 2,
        axisLabelVisible: true,
        title: isAnalysisLevel ? "Entrada proposta" : formatOperationValue(opportunity.currency, opportunity.profit) ?? "Entrada",
      });
    }
    if (opportunity?.stop_loss) {
      stopLineRef.current = series.createPriceLine({
        price: opportunity.stop_loss,
        color: isAnalysisLevel ? "#fb923c" : "#ef4444",
        lineWidth: 2,
        lineStyle: isAnalysisLevel ? 3 : 2,
        axisLabelVisible: true,
        title: isAnalysisLevel ? "Stop projetado" : formatOperationValue(opportunity.currency, opportunity.stop_result) ?? "Stop",
      });
    }
    if (opportunity?.take_profit) {
      targetLineRef.current = series.createPriceLine({
        price: opportunity.take_profit,
        color: isAnalysisLevel ? "#60a5fa" : "#22c55e",
        lineWidth: 2,
        lineStyle: isAnalysisLevel ? 3 : 2,
        axisLabelVisible: true,
        title: isAnalysisLevel ? "Alvo projetado" : formatOperationValue(opportunity.currency, opportunity.target_result) ?? "Alvo",
      });
    }
    chart.timeScale().fitContent();

    return () => {
      seriesRef.current = null;
      entryLineRef.current = null;
      stopLineRef.current = null;
      targetLineRef.current = null;
      chart.remove();
    };
  }, [interval, isAnalysisLevel, opportunity?.entry_price, opportunity?.stop_loss, opportunity?.take_profit]);

  useEffect(() => {
    const currentResult = formatOperationValue(opportunity?.currency, opportunity?.profit);
    const stopResult = formatOperationValue(opportunity?.currency, opportunity?.stop_result);
    const targetResult = formatOperationValue(opportunity?.currency, opportunity?.target_result);
    if (entryLineRef.current && currentResult) entryLineRef.current.applyOptions({ title: currentResult });
    if (stopLineRef.current && stopResult) stopLineRef.current.applyOptions({ title: stopResult });
    if (targetLineRef.current && targetResult) targetLineRef.current.applyOptions({ title: targetResult });
  }, [opportunity?.currency, opportunity?.profit, opportunity?.stop_result, opportunity?.target_result]);

  useEffect(() => {
    if (!seriesRef.current || points.length === 0) return;
    seriesRef.current.setData(points.map((point) => ({
      time: Math.floor(new Date(point.date).getTime() / 1000) as UTCTimestamp,
      open: point.open,
      high: point.high,
      low: point.low,
      close: point.close,
    })));
  }, [points]);

  useEffect(() => {
    if (!seriesRef.current || !liveCandle) return;
    const liveTimestamp = Math.floor(new Date(liveCandle.date).getTime() / 1000);
    const lastHistoryTimestamp = points.length > 0
      ? Math.floor(new Date(points[points.length - 1].date).getTime() / 1000)
      : -1;
    if (!Number.isFinite(liveTimestamp) || liveTimestamp < lastHistoryTimestamp) return;
    seriesRef.current.update({
      time: liveTimestamp as UTCTimestamp,
      open: liveCandle.open,
      high: liveCandle.high,
      low: liveCandle.low,
      close: liveCandle.close,
    });
  }, [liveCandle, points]);

  if (!stats) {
    return <div className="chartEmpty">Sem dados suficientes para plotar o gráfico.</div>;
  }

  return (
    <div className="chartBox">
      <div className="chartStats">
        {assetName ? <span className="chartAssetName">{assetName}</span> : null}
        <span className={`liveStreamBadge liveStreamBadge--${streamStatus}`}>
          <i /> {streamStatus === "live" ? "Tempo real" : streamStatus === "connecting" ? "Conectando" : streamStatus === "reconnecting" ? "Reconectando" : streamStatus === "error" ? "Stream indisponível" : "Snapshot"}
        </span>
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
  const [liveCandle, setLiveCandle] = useState<PricePoint | null>(null);
  const [streamStatus, setStreamStatus] = useState<StreamStatus>("offline");
  const [activeView, setActiveView] = useState<ViewKey>("oportunidades-micro");
  const [chartInterval, setChartInterval] = useState("1d");
  const [chartPeriod, setChartPeriod] = useState("6mo");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOpportunityLoading, setIsOpportunityLoading] = useState(false);
  const [opportunityStrategies, setOpportunityStrategies] = useState<StrategyOption[]>([
    {
      id: "classic_auto",
      name: "Automático clássico",
      description: "Ranking automático dos setups clássicos.",
      supported_timeframes: ["M1", "M5", "M15", "M30", "H1", "H4", "D1"],
      context_timeframes: [],
    },
    {
      id: "smc",
      name: "SMC",
      description: "Estrutura, liquidez, FVG e order block.",
      supported_timeframes: ["M1", "M5", "M15", "M30", "H1", "H4", "D1"],
      context_timeframes: ["M15", "H1", "H4", "D1"],
    },
  ]);
  const [isChartLoading, setIsChartLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opportunityError, setOpportunityError] = useState<string | null>(null);
  const [opportunityResult, setOpportunityResult] = useState<OpportunityResult | null>(null);
  const [orderPreview, setOrderPreview] = useState<OrderPreview | null>(null);
  const [orderExecution, setOrderExecution] = useState<OrderExecution | null>(null);
  const [openOrderStatuses, setOpenOrderStatuses] = useState<OrderStatus[]>([]);
  const [pendingOrderStatuses, setPendingOrderStatuses] = useState<PendingOrderStatus[]>([]);
  const [chartedOrderTicket, setChartedOrderTicket] = useState<number | null>(null);
  const initializedOpenOrderChartRef = useRef(false);
  const initializedMacroFavoriteSourceRef = useRef<string | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [isOrderLoading, setIsOrderLoading] = useState(false);
  const [marketDataProvider, setMarketDataProvider] = useState<"twelvedata" | "yfinance" | "mt5">("twelvedata");
  const [mt5Status, setMt5Status] = useState<MT5StatusResponse>({ connected: false });
  const [mt5Assets, setMt5Assets] = useState<AssetOption[]>([]);
  const [freeSearchAssets, setFreeSearchAssets] = useState<AssetOption[]>([]);
  const [favoriteAssets, setFavoriteAssets] = useState<AssetOption[]>([]);
  const [brokerFavoriteAssets, setBrokerFavoriteAssets] = useState<AssetOption[]>([]);
  const [mt5Form, setMt5Form] = useState<MT5ConnectForm>({ login: "", password: "", server: "", terminal_path: "" });
  const [mt5Error, setMt5Error] = useState<string | null>(null);
  const [isMt5Loading, setIsMt5Loading] = useState(false);
  const [form, setForm] = useState<AnalysisRequest>({
    ticker: "SPY",
    analysis_date: today(),
    provider: "google",
    quick_model: "gemini-2.5-flash-lite",
    deep_model: "gemini-2.5-flash-lite",
    analysts: ["market", "news", "social", "fundamentals"],
    research_depth: 1,
    output_language: "Portuguese",
    mode: "quick_technical",
    checkpoint: false,
  });
  const [opportunityForm, setOpportunityForm] = useState<OpportunityRequest>({
    symbol: "",
    strategy_type: "daytrade",
    strategy_id: "classic_auto",
    timeframe: "M15",
    risk_profile: "moderado",
    capital: 10_000,
    max_risk_per_trade: 0.01,
    max_signals: 1,
    provider: "twelvedata",
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
    setFavoriteAssets([]);
    setBrokerFavoriteAssets([]);
    initializedMacroFavoriteSourceRef.current = null;
    setMarketDataProvider("twelvedata");
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
  const requestedChartSymbol = activeView === "oportunidades-micro"
    ? (marketDataProvider === "mt5"
        ? opportunityForm.symbol.trim()
        : opportunityForm.symbol.trim().toUpperCase())
    : form.ticker;
  const opportunityAssets = marketDataProvider === "mt5"
    ? mt5Assets
    : [...favoriteAssets, ...freeSearchAssets].filter(
        (asset, index, items) => items.findIndex((candidate) => candidate.symbol === asset.symbol) === index,
      );
  const chartSymbol = marketDataProvider === "mt5"
    ? (mt5Assets.find((asset) => asset.symbol === requestedChartSymbol)?.symbol ?? mt5Assets[0]?.symbol ?? "")
    : requestedChartSymbol;
  const selectedAsset = opportunityAssets.find((asset) => asset.symbol === chartSymbol);
  const marketSummary = useMemo(() => {
    if (history.length < 2) return null;
    const first = history[0];
    const last = history[history.length - 1];
    const closes = history.map((point) => point.close);
    const change = last.close - first.close;
    return {
      name: selectedAsset?.name ?? chartSymbol,
      latest: last.close,
      min: Math.min(...closes),
      max: Math.max(...closes),
      change,
      changePct: (change / first.close) * 100,
    };
  }, [chartSymbol, history, selectedAsset?.name]);
  const opportunitySignal = opportunityResult?.signals[0] ?? null;
  const chartedOrder = openOrderStatuses.find((status) => status.position_ticket === chartedOrderTicket) ?? null;
  const chartLevels = chartedOrder?.symbol === chartSymbol
    ? { ...chartedOrder, levelSource: "execution" as const }
    : opportunitySignal
      ? { ...opportunitySignal, levelSource: "analysis" as const }
      : null;
  const periodOptions = periodOptionsByInterval[chartInterval] ?? periodOptionsByInterval["1d"];
  const activeChartPeriod = periodOptions.some((period) => period.value === chartPeriod)
    ? chartPeriod
    : (periodOptions[0]?.value ?? chartPeriod);
  const activeProgressStages = activeAnalysis ? getProgressStages(activeAnalysis.events, activeAnalysis.status) : [];

  function updateChartInterval(nextInterval: string) {
    const nextPeriods = periodOptionsByInterval[nextInterval] ?? periodOptionsByInterval["1d"];
    setChartInterval(nextInterval);
    setChartPeriod(nextPeriods[nextPeriods.length - 1]?.value ?? "1y");
  }

  function viewOrderOnChart(status: OrderStatus) {
    setChartedOrderTicket(status.position_ticket ?? null);
    setOpportunityForm((current) => ({ ...current, symbol: status.symbol }));
    window.setTimeout(() => {
      document.getElementById("cortex-market-chart")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
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

  async function loadFavorites() {
    const response = await fetch(`${API_URL}/favorites`, { credentials: "include" });
    if (!response.ok) throw new Error(await readApiError(response, "Não foi possível carregar os favoritos."));
    const data = (await response.json()) as { assets: AssetOption[] };
    setFavoriteAssets(data.assets);
  }

  async function loadOpportunityStrategies() {
    const response = await fetch(`${API_URL}/opportunities/strategies`, { credentials: "include" });
    if (!response.ok) throw new Error(await readApiError(response, "Não foi possível carregar o catálogo de estratégias."));
    const data = (await response.json()) as { strategies: StrategyOption[] };
    setOpportunityStrategies(data.strategies);
  }

  async function loadBrokerFavorites() {
    const response = await fetch(`${API_URL}/favorites/mt5/list`, { credentials: "include" });
    if (!response.ok) throw new Error(await readApiError(response, "Não foi possível carregar os favoritos da corretora."));
    const data = (await response.json()) as { assets: AssetOption[] };
    setBrokerFavoriteAssets(data.assets);
  }

  async function toggleFavorite(asset: AssetOption) {
    const isBrokerFavorite = marketDataProvider === "mt5";
    const currentFavorites = isBrokerFavorite ? brokerFavoriteAssets : favoriteAssets;
    const isFavorite = currentFavorites.some((favorite) => favorite.symbol === asset.symbol);
    const endpoint = isBrokerFavorite ? "favorites/mt5" : "favorites";
    const response = await fetch(`${API_URL}/${endpoint}/${encodeURIComponent(asset.symbol)}`, {
      method: isFavorite ? "DELETE" : "PUT",
      credentials: "include",
      headers: isFavorite ? undefined : { "Content-Type": "application/json" },
      body: isFavorite ? undefined : JSON.stringify(asset),
    });
    if (!response.ok) throw new Error(await readApiError(response, "Não foi possível atualizar o favorito."));
    const update = (current: AssetOption[]) => isFavorite
      ? current.filter((favorite) => favorite.symbol !== asset.symbol)
      : [...current, asset];
    if (isBrokerFavorite) setBrokerFavoriteAssets(update);
    else setFavoriteAssets(update);
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
      if (!response.ok) throw new Error(await readApiError(response, "Não foi possível carregar o gráfico."));
      const data = (await response.json()) as AssetHistoryResponse;
      setHistory(data.points);
      setLiveCandle(null);
      setError(null);
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
    if (data.connected) {
      setMarketDataProvider("mt5");
      setOpportunityForm((current) => ({ ...current, symbol: "", provider: "mt5" }));
      await loadMt5Symbols();
    } else {
      setMarketDataProvider("twelvedata");
      setMt5Assets([]);
      setOpportunityForm((current) => ({ ...current, symbol: "", provider: "twelvedata" }));
    }
  }

  async function searchFreeAssets(query: string) {
    if (marketDataProvider === "mt5" || query.trim().length < 2) {
      setFreeSearchAssets([]);
      return;
    }
    const params = new URLSearchParams({ query: query.trim(), limit: "15" });
    const response = await fetch(`${API_URL}/assets/search?${params.toString()}`, { credentials: "include" });
    if (!response.ok) return;
    const data = (await response.json()) as { assets: AssetOption[] };
    setFreeSearchAssets(data.assets);
  }

  async function loadMt5Symbols() {
    const response = await fetch(`${API_URL}/integrations/mt5/symbols?limit=1000`, { credentials: "include" });
    if (!response.ok) throw new Error(await readApiError(response, "Não foi possível carregar os ativos da corretora."));
    const data = (await response.json()) as MT5SymbolResponse;
    const assets = data.symbols.map((item) => ({
      symbol: item.symbol,
      name: item.name || item.symbol,
      category: item.category || "Corretora",
      default_provider_symbol: item.symbol,
    }));
    setMt5Assets(assets);
    if (assets.length > 0) {
      setOpportunityForm((current) => ({
        ...current,
        symbol: assets.some((asset) => asset.symbol === current.symbol) ? current.symbol : assets[0].symbol,
        provider: "mt5",
      }));
      setForm((current) => ({
        ...current,
        ticker: assets.some((asset) => asset.symbol === current.ticker) ? current.ticker : assets[0].symbol,
      }));
    } else {
      setOpportunityForm((current) => ({ ...current, symbol: "", provider: "mt5" }));
    }
  }

  useEffect(() => {
    void loadCurrentUser();
  }, []);

  useEffect(() => {
    if (!user) return;
    loadOptions().catch((err: Error) => setError(err.message));
    loadAnalyses().catch((err: Error) => setError(err.message));
    loadFavorites().catch((err: Error) => setError(err.message));
    loadOpportunityStrategies().catch((err: Error) => setError(err.message));
    loadBrokerFavorites().catch((err: Error) => setError(err.message));
    loadMt5Status().catch((err: Error) => setMt5Error(err.message));
  }, [user?.id]);

  useEffect(() => {
    const source = marketDataProvider === "mt5" ? "mt5" : "free";
    const favorites = marketDataProvider === "mt5" ? brokerFavoriteAssets : favoriteAssets;
    if (favorites.length === 0 || initializedMacroFavoriteSourceRef.current === source) return;
    initializedMacroFavoriteSourceRef.current = source;
    setForm((current) => ({ ...current, ticker: favorites[0].symbol }));
  }, [brokerFavoriteAssets, favoriteAssets, marketDataProvider]);

  useEffect(() => {
    if (!user) return;
    if (activeView === "integracoes") return;
    if (!chartSymbol) {
      setHistory([]);
      setLiveCandle(null);
      return;
    }
    if (marketDataProvider === "mt5" && (!mt5Status.connected || mt5Assets.length === 0)) return;
    if (activeChartPeriod !== chartPeriod) {
      setChartPeriod(activeChartPeriod);
      return;
    }
    const timer = window.setTimeout(() => {
      loadHistory(chartSymbol, activeChartPeriod, chartInterval).catch((err: Error) => setError(err.message));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [activeChartPeriod, activeView, chartInterval, chartPeriod, chartSymbol, marketDataProvider, mt5Assets.length, mt5Status.connected, user]);

  useEffect(() => {
    if (!user || !chartSymbol || (marketDataProvider === "mt5" && !mt5Status.connected)) {
      setStreamStatus("offline");
      setLiveCandle(null);
      return;
    }

    let socket: WebSocket | null = null;
    let reconnectTimer: number | null = null;
    let cancelled = false;

    const connect = () => {
      if (cancelled) return;
      setStreamStatus((current) => current === "offline" ? "connecting" : "reconnecting");
      const wsBase = API_URL.replace(/^http/, "ws");
      socket = new WebSocket(
        `${wsBase}/ws/market-data?symbol=${encodeURIComponent(chartSymbol)}&provider=${encodeURIComponent(marketDataProvider)}`,
      );
      socket.onopen = () => setStreamStatus("live");
      socket.onmessage = (event) => {
        const message = JSON.parse(event.data) as MarketTick | { type: "heartbeat" | "error"; message?: string };
        if (message.type !== "tick") {
          if (message.type === "error") setStreamStatus("error");
          return;
        }
        const price = message.last || message.bid || message.ask;
        if (!price) return;
        const bucketMs = chartInterval === "1m" ? 60_000
          : chartInterval === "5m" ? 300_000
          : chartInterval === "15m" ? 900_000
          : chartInterval === "1h" ? 3_600_000
          : chartInterval === "4h" ? 14_400_000
          : 86_400_000;
        const bucketTime = Math.floor(message.timestamp / bucketMs) * bucketMs;
        setLiveCandle((current) => {
          const currentTime = current ? new Date(current.date).getTime() : -1;
          const historyLast = history[history.length - 1];
          const historyTime = historyLast ? Math.floor(new Date(historyLast.date).getTime() / bucketMs) * bucketMs : -1;
          const base = currentTime === bucketTime ? current : historyTime === bucketTime ? historyLast : null;
          return {
            date: new Date(bucketTime).toISOString(),
            open: base?.open ?? price,
            high: Math.max(base?.high ?? price, price),
            low: Math.min(base?.low ?? price, price),
            close: price,
            volume: (base?.volume ?? 0) + (message.volume > 0 ? message.volume : 1),
          };
        });
      };
      socket.onerror = () => setStreamStatus("error");
      socket.onclose = () => {
        if (cancelled) return;
        setStreamStatus("reconnecting");
        reconnectTimer = window.setTimeout(connect, 2000);
      };
    };

    connect();
    return () => {
      cancelled = true;
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [chartInterval, chartSymbol, history, marketDataProvider, mt5Status.connected, user]);

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
    setOrderPreview(null);
    setOrderExecution(null);
    setOrderError(null);
    setOpportunityResult(null);
    setChartedOrderTicket(null);
    try {
      const response = await fetch(`${API_URL}/opportunities/analyze`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...opportunityForm, provider: marketDataProvider }),
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

  async function previewOrder(volume: number) {
    const signal = opportunityResult?.signals[0];
    const direction = ["BUY", "SELL"].includes(signal?.direction ?? "") ? signal?.direction : signal?.planned_direction;
    const isPending = signal?.direction === "WAIT" && signal.strategy_id === "smc";
    if (!signal || !signal.stop_loss || !signal.take_profit || !signal.entry_price || !direction) return;
    setIsOrderLoading(true);
    setOrderError(null);
    try {
      const response = await fetch(`${API_URL}/${isPending ? "orders/pending/preview" : "orders/preview"}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: signal.symbol,
          direction,
          volume,
          ...(isPending ? { entry_price: signal.entry_price } : {}),
          stop_loss: signal.stop_loss,
          take_profit: signal.take_profit,
        }),
      });
      if (!response.ok) throw new Error(await readApiError(response, "Não foi possível validar a ordem."));
      setOrderPreview((await response.json()) as OrderPreview);
      setOrderExecution(null);
    } catch (err) {
      setOrderError(err instanceof Error ? err.message : "Erro ao validar a ordem.");
    } finally {
      setIsOrderLoading(false);
    }
  }

  async function executeOrder(volume: number) {
    const signal = opportunityResult?.signals[0];
    const direction = ["BUY", "SELL"].includes(signal?.direction ?? "") ? signal?.direction : signal?.planned_direction;
    const isPending = orderPreview?.order_kind === "pending";
    if (!signal || !signal.stop_loss || !signal.take_profit || !signal.entry_price || !direction) return;
    setIsOrderLoading(true);
    setOrderError(null);
    try {
      const response = await fetch(`${API_URL}/${isPending ? "orders/pending/execute" : "orders/execute"}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: signal.symbol,
          direction,
          volume,
          ...(isPending ? { entry_price: signal.entry_price } : {}),
          stop_loss: signal.stop_loss,
          take_profit: signal.take_profit,
          technical_reasons: signal.technical_reasons,
          risk_reasons: signal.risk_reasons,
          analysis_generated_at: signal.generated_at,
        }),
      });
      if (!response.ok) throw new Error(await readApiError(response, "A corretora rejeitou a ordem."));
      const execution = (await response.json()) as OrderExecution;
      setOrderExecution(execution);
      if (execution.position_ticket) setChartedOrderTicket(execution.position_ticket);
    } catch (err) {
      setOrderError(err instanceof Error ? err.message : "Erro ao enviar a ordem.");
    } finally {
      setIsOrderLoading(false);
    }
  }

  async function closePosition(positionTicket: number) {
    setIsOrderLoading(true);
    setOrderError(null);
    try {
      const response = await fetch(`${API_URL}/orders/close`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ position_ticket: positionTicket }),
      });
      if (!response.ok) throw new Error(await readApiError(response, "A corretora rejeitou o fechamento."));
      if (chartedOrderTicket === positionTicket) setChartedOrderTicket(null);
      setOpenOrderStatuses((current) => current.filter((status) => status.position_ticket !== positionTicket));
    } catch (err) {
      setOrderError(err instanceof Error ? err.message : "Erro ao fechar a posição.");
    } finally {
      setIsOrderLoading(false);
    }
  }

  async function closeAllPositions(positionTickets: number[]) {
    setIsOrderLoading(true);
    setOrderError(null);
    const closed: number[] = [];
    const failures: string[] = [];
    for (const positionTicket of positionTickets) {
      try {
        const response = await fetch(`${API_URL}/orders/close`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ position_ticket: positionTicket }),
        });
        if (!response.ok) throw new Error(await readApiError(response, `Falha no ticket ${positionTicket}.`));
        closed.push(positionTicket);
      } catch (err) {
        failures.push(err instanceof Error ? err.message : `Falha no ticket ${positionTicket}.`);
      }
    }
    setOpenOrderStatuses((current) => current.filter((status) => !closed.includes(status.position_ticket ?? 0)));
    if (chartedOrderTicket && closed.includes(chartedOrderTicket)) setChartedOrderTicket(null);
    if (failures.length > 0) setOrderError(`${closed.length} posição(ões) fechada(s). ${failures.join(" ")}`);
    setIsOrderLoading(false);
  }

  async function cancelPendingOrder(orderTicket: number) {
    setIsOrderLoading(true);
    setOrderError(null);
    try {
      const response = await fetch(`${API_URL}/orders/pending/cancel`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_ticket: orderTicket }),
      });
      if (!response.ok) throw new Error(await readApiError(response, "A corretora rejeitou o cancelamento."));
      setPendingOrderStatuses((current) => current.filter((order) => order.order_ticket !== orderTicket));
    } catch (err) {
      setOrderError(err instanceof Error ? err.message : "Erro ao cancelar a ordem pendente.");
    } finally {
      setIsOrderLoading(false);
    }
  }

  function resetOrderPreparation() {
    setOrderPreview(null);
    setOrderExecution(null);
    setOrderError(null);
  }

  useEffect(() => {
    if (marketDataProvider !== "mt5" || !mt5Status.connected) {
      setOpenOrderStatuses([]);
      setPendingOrderStatuses([]);
      setChartedOrderTicket(null);
      initializedOpenOrderChartRef.current = false;
      return;
    }
    let cancelled = false;
    const loadStatus = async () => {
      try {
        const [positionsResponse, pendingResponse] = await Promise.all([
          fetch(`${API_URL}/orders/open`, { credentials: "include" }),
          fetch(`${API_URL}/orders/pending`, { credentials: "include" }),
        ]);
        if (!positionsResponse.ok || !pendingResponse.ok) return;
        const statuses = (await positionsResponse.json()) as OrderStatus[];
        const pending = (await pendingResponse.json()) as PendingOrderStatus[];
        if (!cancelled) {
          setOpenOrderStatuses(statuses);
          setPendingOrderStatuses(pending);
          if (!initializedOpenOrderChartRef.current && statuses.length > 0) {
            const firstOpenOrder = statuses[0];
            initializedOpenOrderChartRef.current = true;
            setChartedOrderTicket(firstOpenOrder.position_ticket ?? null);
            setOpportunityForm((current) => ({ ...current, symbol: firstOpenOrder.symbol }));
          }
        }
      } catch {
        // Keep the last known positions during transient connectivity issues.
      }
    };
    void loadStatus();
    const timer = window.setInterval(loadStatus, 1000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [marketDataProvider, mt5Status.connected, orderExecution?.order_ticket, orderExecution?.position_ticket]);

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
      setOpportunityForm((current) => ({ ...current, symbol: "", provider: "mt5" }));
      setMt5Form((current) => ({ ...current, password: "" }));
      await loadMt5Symbols();
      setError(null);
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
      setMarketDataProvider("twelvedata");
      setMt5Assets([]);
      setOpportunityForm((current) => ({ ...current, symbol: "", provider: "twelvedata" }));
      setForm((current) => ({ ...current, ticker: "SPY" }));
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
    setActiveView("oportunidades-micro");
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
      <div className="macroField macroField--asset">
        <AssetCombobox
          assets={opportunityAssets}
          favorites={marketDataProvider === "mt5" ? brokerFavoriteAssets : favoriteAssets}
          favoritesEnabled
          value={form.ticker}
          onChange={(ticker) => setForm({ ...form, ticker })}
          onSearch={searchFreeAssets}
          onToggleFavorite={(asset) => toggleFavorite(asset).catch((err: Error) => setError(err.message))}
        />
      </div>

      <label className="macroField">
        Data
        <input
          type="date"
          value={form.analysis_date}
          onChange={(event) => setForm({ ...form, analysis_date: event.target.value })}
        />
      </label>

      {false && <label className="macroField">
        Provedor
        <select value={form.provider} onChange={(event) => syncModelDefaults(event.target.value)}>
          {Object.keys(options?.providers ?? { google: null }).map((provider) => (
            <option key={provider} value={provider}>
              {provider}
            </option>
          ))}
        </select>
      </label>}

      {false && <label className="macroField macroField--depth">
        Profundidade
        <input
          max={5}
          min={1}
          type="number"
          value={form.research_depth}
          onChange={(event) => setForm({ ...form, research_depth: Number(event.target.value) })}
        />
      </label>}

      <div className="fieldGroup macroAnalystField">
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

      <button className="primaryButton" disabled={isSubmitting} type="submit">
        {isSubmitting ? <RefreshCw size={17} /> : <Play size={17} />}
        Analisar cenário
      </button>

      {false && <details className="macroAdvancedSettings">
        <summary>Configurações avançadas</summary>
        <div className="macroAdvancedGrid">
          <label>
            Modelo rápido
            <select value={form.quick_model} onChange={(event) => setForm({ ...form, quick_model: event.target.value })}>
              {(providerModels?.quick ?? []).map((model) => (
                <option key={model.value} value={model.value}>{model.label}</option>
              ))}
            </select>
          </label>

          <label>
            Modelo profundo
            <select value={form.deep_model} onChange={(event) => setForm({ ...form, deep_model: event.target.value })}>
              {(providerModels?.deep ?? []).map((model) => (
                <option key={model.value} value={model.value}>{model.label}</option>
              ))}
            </select>
          </label>

          <label>
            Idioma
            <select value={form.output_language} onChange={(event) => setForm({ ...form, output_language: event.target.value })}>
              <option value="Portuguese">Português</option>
              <option value="English">Inglês</option>
              <option value="Spanish">Espanhol</option>
            </select>
          </label>

          <div className="fieldGroup macroAnalystField">
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
        </div>
      </details>}
    </form>
  );

  const marketPanel = (
          <section className="chartPanel" id="cortex-market-chart">
            {isChartLoading ? (
              <LoadingState message="Carregando gráfico de mercado..." />
            ) : (
              <CandleChart
                assetName={selectedAsset?.name}
                points={history}
                interval={chartInterval}
                period={activeChartPeriod}
                opportunity={activeView === "oportunidades-micro" ? chartLevels : null}
                liveCandle={liveCandle}
                streamStatus={streamStatus}
              />
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
      user={user}
    >
      {error ? <ErrorState message={error} /> : null}

      {activeView === "oportunidades-micro" ? (
        <OpportunityWorkspace
          assets={opportunityAssets}
          chartSlot={marketPanel}
          error={opportunityError}
          form={opportunityForm}
          formatPrice={formatPrice}
          favorites={marketDataProvider === "mt5" ? brokerFavoriteAssets : favoriteAssets}
          favoritesEnabled
          strategies={opportunityStrategies}
          isLoading={isOpportunityLoading}
          marketSummary={marketSummary}
          orderError={orderError}
          orderExecution={orderExecution}
          orderPreview={orderPreview}
          orderStatuses={openOrderStatuses}
          pendingOrderStatuses={pendingOrderStatuses}
          viewedOrder={null}
          isOrderLoading={isOrderLoading}
          onAssetSearch={searchFreeAssets}
          onExecuteOrder={executeOrder}
          onCloseOrder={closePosition}
          onCloseAllOrders={closeAllPositions}
          onCancelPendingOrder={cancelPendingOrder}
          onResetOrder={resetOrderPreparation}
          onPreviewOrder={previewOrder}
          onViewOrderOnChart={viewOrderOnChart}
          onToggleFavorite={(asset) => toggleFavorite(asset).catch((err: Error) => setError(err.message))}
          onSubmit={submitOpportunity}
          result={opportunityResult}
          setForm={setOpportunityForm}
        />
      ) : activeView === "oportunidades-macro" ? (
          <section className="detailPanel detailPanelFull macroWorkspace">
            <div className="sectionTitle macroWorkspaceTitle">
              <FileText size={18} />
              <h3>
                Macro AI Research
                <span>Análise fundamentalista multiagente e contexto de mercado</span>
              </h3>
            </div>

            <div className="macroResearchForm">
              {analysisControlPanel}
            </div>

            <div className="macroOverviewGrid">
              <div className="macroChartPanel">{marketPanel}</div>
              <aside className="macroActivityPanel">
                <div className="macroActivityHeader">
                  <h4>Andamento da análise</h4>
                  <span>{activeAnalysis ? statusLabels[activeAnalysis.status] : "Aguardando execução"}</span>
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
                      {analysis.request.ticker} · {analysis.request.analysis_date}
                    </option>
                  ))}
                </select>
                </label>
              )}

              {!selectedAnalysis && !activeAnalysis && (
                <EmptyState
                title="Nenhuma análise concluída ainda"
                message="Configure um cenário acima para iniciar a pesquisa multiagente."
                icon={FileText}
                />
              )}
              </aside>
            </div>

            {selectedAnalysis && (
              <section className="macroReportSection">
                <div className="macroReportHeader">
                  <div>
                    <span>Relatório consolidado</span>
                    <h4>{selectedAnalysis.request.ticker} · {selectedAnalysis.request.analysis_date}</h4>
                  </div>
                  <span className="macroReportStatus">{statusLabels[selectedAnalysis.status]}</span>
                </div>
                {false && <div className="summaryStrip">
                  <span>{selectedAnalysis.request.provider}</span>
                  <span>{selectedAnalysis.request.quick_model}</span>
                  <span>{selectedAnalysis.request.deep_model}</span>
                  <span>{selectedAnalysis.request.analysts.map((item) => analystOptions.find((option) => option.value === item)?.label ?? item).join(", ")}</span>
                </div>}

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
              </section>
            )}
          </section>
      ) : (
        <section className="detailPanel detailPanelFull">
          <div className="sectionTitle">
            <Network size={18} />
            <h3>Integrações</h3>
          </div>

          <div className="brokerIntegrationGrid">
            <form autoComplete="off" className="brokerConnectionPanel" onSubmit={connectMt5}>
              <div className="controlPanelTitle">
                <span>MetaTrader 5</span>
                <strong>Conectar corretora</strong>
                <small>Informe as credenciais da sua conta de negociação. Elas são diferentes do acesso ao Cortex.</small>
              </div>

              <label className="brokerField">
                <span>Servidor</span>
                <input
                  autoComplete="off"
                  name="mt5-broker-server"
                  placeholder="Ex.: Broker-Demo"
                  value={mt5Form.server}
                  onChange={(event) => setMt5Form({ ...mt5Form, server: event.target.value })}
                />
                <small>Use o nome exato exibido no seu terminal MT5.</small>
              </label>

              <label className="brokerField">
                <span>Número da conta MT5</span>
                <input
                  autoComplete="off"
                  inputMode="numeric"
                  name="mt5-account-number"
                  placeholder="Ex.: 12345678"
                  value={mt5Form.login}
                  onChange={(event) => setMt5Form({ ...mt5Form, login: event.target.value })}
                />
              </label>

              <label className="brokerField">
                <span>Senha da conta MT5</span>
                <input
                  autoComplete="new-password"
                  name="mt5-trading-password"
                  placeholder="Digite a senha da corretora"
                  type="password"
                  value={mt5Form.password}
                  onChange={(event) => setMt5Form({ ...mt5Form, password: event.target.value })}
                />
              </label>

              {mt5Error ? <div className="errorBanner">{mt5Error}</div> : null}

              <div className="brokerActions">
                <button className="primaryButton" disabled={isMt5Loading} type="submit">
                  {isMt5Loading ? <RefreshCw size={17} /> : <Network size={17} />}
                  {isMt5Loading ? "Conectando..." : "Conectar MT5"}
                </button>
              </div>
            </form>

            <aside className="brokerStatusPanel">
              <div className="brokerStatusHeader">
                <div className={`brokerStatusIcon ${mt5Status.connected ? "brokerStatusIcon--connected" : ""}`}>
                  <Network size={20} />
                </div>
                <div>
                  <h4>Status da corretora</h4>
                  <span>{mt5Status.connected ? "Conexão estabelecida com o MetaTrader 5" : "Preencha os dados ao lado para iniciar a conexão"}</span>
                </div>
                <span className={`brokerConnectionBadge ${mt5Status.connected ? "brokerConnectionBadge--online" : ""}`}>
                  {mt5Status.connected ? "Conectada" : "Não conectada"}
                </span>
              </div>

              <div className="brokerStatusGrid">
                <div className="brokerStatusItem"><HardDrive size={17} /><span>Fonte de dados</span><strong>{mt5Status.connected ? (marketDataProvider === "mt5" ? "MetaTrader 5" : "Twelve Data") : ""}</strong></div>
                <div className="brokerStatusItem"><UserRound size={17} /><span>Conta</span><strong>{mt5Status.connected ? mt5Status.login ?? "" : ""}</strong></div>
                <div className="brokerStatusItem"><Server size={17} /><span>Servidor</span><strong>{mt5Status.connected ? mt5Status.server ?? "" : ""}</strong></div>
                <div className="brokerStatusItem"><Building2 size={17} /><span>Corretora</span><strong>{mt5Status.connected ? mt5Status.company ?? "" : ""}</strong></div>
                <div className="brokerStatusItem"><Wallet size={17} /><span>Saldo disponível</span><strong>{mt5Status.connected && typeof mt5Status.balance === "number" ? formatPrice(mt5Status.balance) : ""}</strong></div>
                <div className="brokerStatusItem brokerStatusItem--safe"><LockKeyhole size={17} /><span>Execução de ordens</span><strong>{mt5Status.connected ? "Bloqueada por segurança" : ""}</strong></div>
              </div>

              <div className="brokerStatusFooter">
                <button className="secondaryPanelAction brokerDisconnectAction" disabled={isMt5Loading || !mt5Status.connected} onClick={disconnectMt5} type="button">
                  Desconectar
                </button>
              </div>
            </aside>
          </div>
        </section>
      )}
    </AppShell>
  );
}
