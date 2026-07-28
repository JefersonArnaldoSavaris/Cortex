"use client";

import {
  Activity,
  AlertTriangle,
  BarChart3,
  Cable,
  Clock3,
  List,
  Loader2,
  RadioTower,
  Search,
  Send,
  ShieldAlert,
  Sparkles,
  Star,
  Target,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type Dispatch, type FormEvent, type KeyboardEvent, type ReactNode, type SetStateAction } from "react";

import type {
  OpportunityDirection,
  OpportunityProvider,
  OpportunityRequest,
  OpportunityResult,
  OpportunityRiskProfile,
  OpportunitySignal,
  OpportunityStrategyType,
  OpportunityTimeframe,
  OrderExecution,
  OrderPreview,
  OrderStatus,
  PendingOrderStatus,
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
  smc_liquidity_structure: "SMC · Estrutura e liquidez",
};

type StrategyOption = {
  id: string;
  name: string;
  description: string;
  supported_timeframes: string[];
  context_timeframes: string[];
};

const directionTone: Record<OpportunityDirection, string> = {
  BUY: "buy",
  SELL: "sell",
  WAIT: "wait",
  AVOID: "avoid",
};

type OpportunityWorkspaceProps = {
  demoMode: boolean;
  assets: Array<{ symbol: string; name: string; category: string }>;
  favorites: Array<{ symbol: string; name: string; category: string; default_provider_symbol: string }>;
  favoritesEnabled: boolean;
  strategies: StrategyOption[];
  form: OpportunityRequest;
  setForm: Dispatch<SetStateAction<OpportunityRequest>>;
  onAssetSearch?: (query: string) => void;
  onToggleFavorite: (asset: { symbol: string; name: string; category: string; default_provider_symbol: string }) => void;
  orderPreview: OrderPreview | null;
  orderExecution: OrderExecution | null;
  orderError: string | null;
  orderStatuses: OrderStatus[];
  pendingOrderStatuses: PendingOrderStatus[];
  viewedOrder: OrderStatus | null;
  isOrderLoading: boolean;
  onPreviewOrder: (volume: number) => void;
  onExecuteOrder: (volume: number) => void;
  onCloseOrder: (positionTicket: number) => void;
  onCloseAllOrders: (positionTickets: number[]) => void;
  onCancelPendingOrder: (orderTicket: number) => void;
  onResetOrder: () => void;
  onViewOrderOnChart: (status: OrderStatus) => void;
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
  demoMode,
  assets,
  favorites,
  favoritesEnabled,
  strategies,
  form,
  setForm,
  onAssetSearch,
  onToggleFavorite,
  orderPreview,
  orderExecution,
  orderError,
  orderStatuses,
  pendingOrderStatuses,
  viewedOrder,
  isOrderLoading,
  onPreviewOrder,
  onExecuteOrder,
  onCloseOrder,
  onCloseAllOrders,
  onCancelPendingOrder,
  onResetOrder,
  onViewOrderOnChart,
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
        <TradingConfigPanel
          assets={assets}
          favorites={favorites}
          favoritesEnabled={favoritesEnabled}
          strategies={strategies}
          form={form}
          setForm={setForm}
          isLoading={isLoading}
          onAssetSearch={onAssetSearch}
          onToggleFavorite={onToggleFavorite}
          onSubmit={onSubmit}
        />
        <div className="microSummaryGrid">
          <MarketSummaryCard summary={marketSummary} formatPrice={formatPrice} />
          <OpportunityDecisionCard
            signal={primarySignal}
            isLoading={isLoading}
            error={error}
          />
          <OperationalMetricsCard signal={primarySignal} formatPrice={formatPrice} />
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
            execution={viewedOrder}
          />
          </aside>
        </div>
        {(form.provider === "mt5" || demoMode) && (
          (primarySignal && (["BUY", "SELL"].includes(primarySignal.direction) || Boolean(primarySignal.planned_direction))) ||
          orderStatuses.length > 0 ||
          pendingOrderStatuses.length > 0
        ) ? (
          <OrderExecutionPanel
            demoMode={demoMode}
            signal={primarySignal && (["BUY", "SELL"].includes(primarySignal.direction) || primarySignal.planned_direction) ? primarySignal : null}
            preview={orderPreview}
            execution={orderExecution}
            statuses={orderStatuses}
            pendingStatuses={pendingOrderStatuses}
            error={orderError}
            isLoading={isOrderLoading}
            onPreview={onPreviewOrder}
            onExecute={onExecuteOrder}
            onClose={onCloseOrder}
            onCloseAll={onCloseAllOrders}
            onCancelPending={onCancelPendingOrder}
            onReset={onResetOrder}
            onViewOnChart={onViewOrderOnChart}
          />
        ) : null}
      </div>
    </section>
  );
}

function OrderExecutionPanel({
  demoMode,
  signal,
  preview,
  execution,
  statuses,
  pendingStatuses,
  error,
  isLoading,
  onPreview,
  onExecute,
  onClose,
  onCloseAll,
  onCancelPending,
  onReset,
  onViewOnChart,
}: {
  demoMode: boolean;
  signal: OpportunitySignal | null;
  preview: OrderPreview | null;
  execution: OrderExecution | null;
  statuses: OrderStatus[];
  pendingStatuses: PendingOrderStatus[];
  error: string | null;
  isLoading: boolean;
  onPreview: (volume: number) => void;
  onExecute: (volume: number) => void;
  onClose: (positionTicket: number) => void;
  onCloseAll: (positionTickets: number[]) => void;
  onCancelPending: (orderTicket: number) => void;
  onReset: () => void;
  onViewOnChart: (status: OrderStatus) => void;
}) {
  const [volume, setVolume] = useState(0.01);
  const [reasonStatus, setReasonStatus] = useState<OrderStatus | null>(null);
  const [closeStatus, setCloseStatus] = useState<OrderStatus | null>(null);
  const [isCloseAllOpen, setIsCloseAllOpen] = useState(false);
  const [pendingCancelStatus, setPendingCancelStatus] = useState<PendingOrderStatus | null>(null);
  const [isPreparationOpen, setIsPreparationOpen] = useState(true);
  const onPreviewRef = useRef(onPreview);

  useEffect(() => {
    if (execution) setIsPreparationOpen(false);
  }, [execution]);

  useEffect(() => {
    onPreviewRef.current = onPreview;
  }, [onPreview]);

  useEffect(() => {
    setVolume(0.01);
  }, [signal?.symbol, signal?.generated_at]);

  useEffect(() => {
    if (!signal || !isPreparationOpen || !Number.isFinite(volume) || volume < 0.01) return;
    const timer = window.setTimeout(() => onPreviewRef.current(volume), 300);
    return () => window.clearTimeout(timer);
  }, [
    isPreparationOpen,
    signal?.direction,
    signal?.entry_price,
    signal?.planned_direction,
    signal?.stop_loss,
    signal?.symbol,
    signal?.take_profit,
    volume,
  ]);

  const accountCurrency = statuses[0]?.currency ?? "";
  const accountTotal = statuses[0]?.account_equity;
  const openResult = statuses.reduce((total, status) => total + (status.profit ?? 0), 0);
  const displayedDirection = signal?.planned_direction ?? signal?.direction;
  const calculatedPreview = preview && Math.abs(preview.requested_volume - volume) < 0.000001 ? preview : null;

  return (
    <section className="orderExecutionPanel">
      <div className="orderExecutionHeader">
        <div>
          <span>{demoMode ? "Simulador de operações" : "Execução na corretora"}</span>
          <strong>{signal ? `${displayedDirection} ${signal.symbol}` : `${statuses.length} posição(ões) em execução`}</strong>
        </div>
        <span className="orderExecutionWarning">{demoMode ? "Conta demo" : "Ordem real"}</span>
        {execution ? <span className="orderExecutionSuccess">{demoMode ? "Simulação aberta" : "Ordem enviada"}</span> : null}
        {signal ? (
          <button
            className="orderPreparationToggle"
            onClick={() => {
              if (!isPreparationOpen) onReset();
              setIsPreparationOpen((current) => !current);
            }}
            type="button"
          >
            {isPreparationOpen ? "Fechar preparação" : "Preparar nova ordem"}
          </button>
        ) : null}
      </div>
      {statuses.length > 0 ? (
        <div className="orderAccountSummary">
          <span>Patrimônio <strong>{accountTotal == null ? "-" : `${accountCurrency} ${accountTotal.toFixed(2)}`}</strong></span>
          <span>Resultado aberto <strong className={openResult >= 0 ? "positive" : "negative"}>{accountCurrency} {openResult.toFixed(2)}</strong></span>
          <button disabled={isLoading} onClick={() => setIsCloseAllOpen(true)} type="button">Fechar todas</button>
        </div>
      ) : null}
      {signal && isPreparationOpen ? <section className="orderCalculationStage">
        <strong>Preparar ordem</strong>
        <div className="orderExecutionControls">
        <label>
          Volume em lotes
          <input min="0.01" onChange={(event) => setVolume(Number(event.target.value))} step="0.01" type="number" value={volume} />
        </label>
        <span className="orderAutoCalculation">
          {isLoading || !calculatedPreview ? "Atualizando cálculo..." : "Cálculo atualizado automaticamente"}
        </span>
        </div>
      </section> : null}
      {signal && isPreparationOpen && calculatedPreview ? (
        <section className="orderSendStage">
          <strong>{demoMode ? "Enviar para a conta demo" : "Enviar para a corretora"}</strong>
          <div className="orderPreviewGrid">
            <RiskMetricCard label="Lote" value={calculatedPreview.volume.toString()} />
            <RiskMetricCard label="Entrada atual" value={calculatedPreview.entry_price.toString()} />
            <RiskMetricCard label="Perda no stop" value={`${calculatedPreview.currency} ${calculatedPreview.estimated_loss.toFixed(2)}`} tone="danger" />
            <RiskMetricCard label="Ganho no alvo" value={`${calculatedPreview.currency} ${calculatedPreview.estimated_profit.toFixed(2)}`} tone="success" />
            <RiskMetricCard label="Margem estimada" value={calculatedPreview.estimated_margin == null ? "-" : `${calculatedPreview.currency} ${calculatedPreview.estimated_margin.toFixed(2)}`} />
          </div>
          <div className="orderConfirmation">
            <span>{demoMode ? "Revise os valores. Esta ação cria somente uma posição simulada." : "Revise os valores antes de enviar. Esta ação cria uma ordem real."}</span>
            <button
              className="orderSendButton"
              disabled={isLoading || !calculatedPreview.execution_enabled}
              onClick={() => onExecute(calculatedPreview.volume)}
              type="button"
            >
              <Send size={16} /> {demoMode ? "Abrir operação demo" : calculatedPreview.order_kind === "pending" ? "Apregoar ordem pendente" : "Enviar ordem real"}
            </button>
          </div>
          {!calculatedPreview.execution_enabled ? <p className="orderExecutionDisabled">{demoMode ? "Simulação indisponível." : "Execução real desabilitada no servidor."}</p> : null}
        </section>
      ) : null}
      {error ? <p className="orderExecutionError">{error}</p> : null}
      {statuses.map((status) => (
        <div className="orderTrackingPanel" key={status.position_ticket ?? status.symbol}>
          <div><span>Ativo</span><strong>{status.direction} {status.symbol}</strong></div>
          <div><span>Status</span><strong>{status.status === "open" ? "Posição aberta" : status.status === "closed" ? "Posição encerrada" : "Localizando posição"}</strong></div>
          <div><span>Ticket</span><strong>{status.position_ticket ?? execution?.position_ticket ?? "-"}</strong></div>
          <div><span>Volume</span><strong>{status.volume ?? execution?.volume ?? "-"}</strong></div>
          <div><span>Entrada</span><strong>{status.entry_price ?? "-"}</strong></div>
          <div><span>Preço atual</span><strong>{status.current_price ?? "-"}</strong></div>
          <div><span>Stop loss</span><strong>{status.stop_loss ?? "-"}</strong></div>
          <div><span>Take profit</span><strong>{status.take_profit ?? "-"}</strong></div>
          <div className={(status.profit ?? 0) >= 0 ? "positive" : "negative"}>
            <span>Resultado atual</span>
            <strong>{status.currency} {(status.profit ?? 0).toFixed(2)}</strong>
          </div>
          <div className="orderPositionActions">
            <button aria-label="Ver no gráfico" className="orderChartButton" onClick={() => onViewOnChart(status)} title="Ver no gráfico" type="button">
              <BarChart3 aria-hidden="true" size={16} />
            </button>
            <button aria-label="Ver razões técnicas" className="orderReasonButton" onClick={() => setReasonStatus(status)} title="Razões técnicas" type="button">
              <List aria-hidden="true" size={16} />
            </button>
            <button aria-label="Fechar posição" className="orderCloseButton" disabled={isLoading || !status.position_ticket} onClick={() => setCloseStatus(status)} title="Fechar posição" type="button">
              <X aria-hidden="true" size={17} />
            </button>
          </div>
        </div>
      ))}
      {pendingStatuses.map((order) => (
        <div className="pendingOrderPanel" key={order.order_ticket}>
          <span>Ordem pendente</span>
          <strong>{order.pending_type.replace("_", " ")} {order.symbol}</strong>
          <span>Ticket <strong>{order.order_ticket}</strong></span>
          <span>Volume <strong>{order.volume}</strong></span>
          <span>Entrada <strong>{order.entry_price}</strong></span>
          <span>Stop <strong>{order.stop_loss ?? "-"}</strong></span>
          <span>Alvo <strong>{order.take_profit ?? "-"}</strong></span>
          <button disabled={isLoading} onClick={() => setPendingCancelStatus(order)} type="button">Cancelar ordem</button>
        </div>
      ))}
      {reasonStatus ? (
        <div className="orderModalBackdrop" onMouseDown={() => setReasonStatus(null)} role="presentation">
          <section aria-modal="true" className="orderModal" onMouseDown={(event) => event.stopPropagation()} role="dialog">
            <div className="orderModalHeader">
              <div><span>Contexto da execução</span><strong>{reasonStatus.direction} {reasonStatus.symbol}</strong></div>
              <button aria-label="Fechar" onClick={() => setReasonStatus(null)} type="button">×</button>
            </div>
            <AnalysisReasonList title="Razões técnicas" items={reasonStatus.technical_reasons} emptyText="Esta ordem não possui razões técnicas registradas." />
            <AnalysisReasonList title="Razões de risco" items={reasonStatus.risk_reasons} emptyText="Esta ordem não possui razões de risco registradas." />
          </section>
        </div>
      ) : null}
      {closeStatus ? (
        <div className="orderModalBackdrop" onMouseDown={() => setCloseStatus(null)} role="presentation">
          <section aria-modal="true" className="orderModal orderCloseModal" onMouseDown={(event) => event.stopPropagation()} role="dialog">
            <div className="orderModalHeader">
              <div><span>Confirmar fechamento</span><strong>{closeStatus.direction} {closeStatus.symbol}</strong></div>
              <button aria-label="Cancelar" onClick={() => setCloseStatus(null)} type="button">×</button>
            </div>
            <p>Esta ação enviará uma ordem real para encerrar integralmente a posição de volume {closeStatus.volume}.</p>
            <div className="orderModalActions">
              <button onClick={() => setCloseStatus(null)} type="button">Cancelar</button>
              <button
                className="orderCloseConfirmButton"
                disabled={isLoading || !closeStatus.position_ticket}
                onClick={() => {
                  if (closeStatus.position_ticket) onClose(closeStatus.position_ticket);
                  setCloseStatus(null);
                }}
                type="button"
              >
                {isLoading ? "Fechando..." : "Confirmar fechamento"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
      {isCloseAllOpen ? (
        <div className="orderModalBackdrop" onMouseDown={() => setIsCloseAllOpen(false)} role="presentation">
          <section aria-modal="true" className="orderModal orderCloseModal" onMouseDown={(event) => event.stopPropagation()} role="dialog">
            <div className="orderModalHeader">
              <div><span>Ação em lote</span><strong>Fechar todas as posições</strong></div>
              <button aria-label="Cancelar" onClick={() => setIsCloseAllOpen(false)} type="button">×</button>
            </div>
            <p>Serão enviadas {statuses.length} ordens reais de fechamento, uma para cada posição aberta pelo Cortex.</p>
            <div className="orderModalActions">
              <button onClick={() => setIsCloseAllOpen(false)} type="button">Cancelar</button>
              <button
                className="orderCloseConfirmButton"
                disabled={isLoading}
                onClick={() => {
                  onCloseAll(statuses.flatMap((status) => status.position_ticket ? [status.position_ticket] : []));
                  setIsCloseAllOpen(false);
                }}
                type="button"
              >
                {isLoading ? "Fechando..." : `Fechar ${statuses.length} posições`}
              </button>
            </div>
          </section>
        </div>
      ) : null}
      {pendingCancelStatus ? (
        <div className="orderModalBackdrop" onMouseDown={() => setPendingCancelStatus(null)} role="presentation">
          <section aria-modal="true" className="orderModal orderCloseModal" onMouseDown={(event) => event.stopPropagation()} role="dialog">
            <div className="orderModalHeader">
              <div><span>Cancelar ordem pendente</span><strong>{pendingCancelStatus.pending_type.replace("_", " ")} {pendingCancelStatus.symbol}</strong></div>
              <button aria-label="Fechar" onClick={() => setPendingCancelStatus(null)} type="button">×</button>
            </div>
            <p>A ordem ainda não foi executada. O cancelamento removerá o apregoamento do MT5.</p>
            <div className="orderModalActions">
              <button onClick={() => setPendingCancelStatus(null)} type="button">Voltar</button>
              <button
                className="orderCloseConfirmButton"
                disabled={isLoading}
                onClick={() => {
                  onCancelPending(pendingCancelStatus.order_ticket);
                  setPendingCancelStatus(null);
                }}
                type="button"
              >
                Confirmar cancelamento
              </button>
            </div>
          </section>
        </div>
      ) : null}
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
  favorites,
  favoritesEnabled,
  strategies,
  form,
  setForm,
  isLoading,
  onAssetSearch,
  onToggleFavorite,
  onSubmit,
}: {
  assets: Array<{ symbol: string; name: string; category: string }>;
  favorites: Array<{ symbol: string; name: string; category: string; default_provider_symbol: string }>;
  favoritesEnabled: boolean;
  strategies: StrategyOption[];
  form: OpportunityRequest;
  setForm: Dispatch<SetStateAction<OpportunityRequest>>;
  isLoading: boolean;
  onAssetSearch?: (query: string) => void;
  onToggleFavorite: (asset: { symbol: string; name: string; category: string; default_provider_symbol: string }) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <aside className="tradingConfigPanel">
      <form className="tradingConfigForm" onSubmit={onSubmit}>
        <AssetCombobox
          assets={assets}
          favorites={favorites}
          favoritesEnabled={favoritesEnabled}
          value={form.symbol}
          onChange={(symbol) => setForm({ ...form, symbol })}
          onSearch={onAssetSearch}
          onToggleFavorite={onToggleFavorite}
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
          Estratégia
          <select
            value={form.strategy_id}
            onChange={(event) => {
              const strategyId = event.target.value;
              const strategy = strategies.find((item) => item.id === strategyId);
              const timeframe = strategy && !strategy.supported_timeframes.includes(form.timeframe) ? "M15" : form.timeframe;
              setForm({ ...form, strategy_id: strategyId, timeframe: timeframe as OpportunityTimeframe });
            }}
          >
            {strategies.map((strategy) => (
              <option key={strategy.id} value={strategy.id}>{strategy.name}</option>
            ))}
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

        <button className="tradeActionButton tradingConfigSubmit" disabled={isLoading || !form.symbol.trim()} type="submit">
          {isLoading ? <Loader2 size={17} /> : <Sparkles size={17} />}
          {isLoading ? "Analisando..." : "Analisar ativo"}
        </button>
      </form>
    </aside>
  );
}

export function AssetCombobox({
  assets,
  favorites,
  favoritesEnabled,
  value,
  onChange,
  onSearch,
  onToggleFavorite,
}: {
  assets: Array<{ symbol: string; name: string; category: string; default_provider_symbol?: string }>;
  favorites: Array<{ symbol: string; name: string; category: string; default_provider_symbol: string }>;
  favoritesEnabled: boolean;
  value: string;
  onChange: (symbol: string) => void;
  onSearch?: (query: string) => void;
  onToggleFavorite: (asset: { symbol: string; name: string; category: string; default_provider_symbol: string }) => void;
}) {
  const selectedAsset = assets.find((asset) => asset.symbol === value);
  const selectedLabel = selectedAsset ? `${selectedAsset.symbol} · ${selectedAsset.name}` : value;
  const [query, setQuery] = useState(selectedLabel);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setQuery(selectedLabel);
  }, [selectedLabel]);

  useEffect(() => {
    if (!isOpen || query.trim().length < 2 || query === selectedLabel) return;
    const timer = window.setTimeout(() => onSearch?.(query), 350);
    return () => window.clearTimeout(timer);
  }, [isOpen, onSearch, query, selectedLabel]);

  const filteredAssets = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
    if (normalizedQuery.length < 2 || query === selectedLabel) return favorites;
    return assets
      .filter((asset) =>
        `${asset.symbol} ${asset.name} ${asset.category}`.toLocaleLowerCase("pt-BR").includes(normalizedQuery),
      )
      .slice(0, 80);
  }, [assets, favorites, query, selectedLabel]);

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
        {favoritesEnabled ? <button
          aria-label={favorites.some((asset) => asset.symbol === value) ? "Remover dos favoritos" : "Adicionar aos favoritos"}
          className={favorites.some((asset) => asset.symbol === value) ? "assetFavoriteButton assetFavoriteButton--active" : "assetFavoriteButton"}
          disabled={!selectedAsset}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => selectedAsset && onToggleFavorite({
            ...selectedAsset,
            default_provider_symbol: selectedAsset.default_provider_symbol ?? selectedAsset.symbol,
          })}
          title={favorites.some((asset) => asset.symbol === value) ? "Remover dos favoritos" : "Adicionar aos favoritos"}
          type="button"
        >
          <Star size={16} />
        </button> : null}
      </span>
      {isOpen && (favorites.length > 0 || query.trim().length >= 2) ? (
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
  const entryLabel = signal?.strategy_id === "smc" ? "Zona de entrada" : "Entrada";
  const entryValue = signal?.strategy_id === "smc" && signal.entry_zone_low && signal.entry_zone_high
    ? `${formatPrice(signal.entry_zone_low)} – ${formatPrice(signal.entry_zone_high)}`
    : signal?.entry_price ? formatPrice(signal.entry_price) : "-";
  return (
    <section className="operationalMetricsCard">
      <div className="metricMatrix">
        <RiskMetricCard label={entryLabel} value={entryValue} />
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
  execution,
}: {
  signal: OpportunitySignal | null;
  result: OpportunityResult | null;
  execution: OrderStatus | null;
}) {
  if (execution) {
    return (
      <section className="contextPanel">
        <AnalysisReasonList title="Razões técnicas da execução" items={execution.technical_reasons} emptyText="Esta ordem não possui razões técnicas registradas." />
        <AnalysisReasonList title="Razões de risco da execução" items={execution.risk_reasons} emptyText="Esta ordem não possui razões de risco registradas." />
      </section>
    );
  }
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
  if (provider === "twelvedata") return "Twelve Data";
  return "Leitura de mercado";
}
