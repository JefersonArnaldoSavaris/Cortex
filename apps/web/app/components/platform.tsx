"use client";

import {
  Activity,
  AlertCircle,
  Bell,
  Bot,
  Cable,
  ChevronRight,
  CircleUserRound,
  Crosshair,
  Flame,
  Gauge,
  Landmark,
  LayoutDashboard,
  LineChart,
  LucideIcon,
  Network,
  Radar,
  Search,
  ShieldAlert,
  LogOut,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import type { OpportunitySignal } from "../opportunities/types";

export type ViewKey =
  | "dashboard"
  | "oportunidades-micro"
  | "oportunidades-macro"
  | "backtest"
  | "alertas"
  | "integracoes";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user";
  plan: "free" | "pro" | "enterprise";
  status: "active" | "inactive" | "trial" | "blocked";
  created_at: string;
  updated_at: string;
  last_login_at?: string | null;
};

type NavItem = {
  key: ViewKey;
  label: string;
  icon: LucideIcon;
  status?: string;
};

type NavGroup = {
  label: string;
  icon: LucideIcon;
  status?: string;
  children: NavItem[];
};

type NavigationEntry = NavItem | NavGroup;

const navigation: NavItem[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "backtest", label: "Backtest", icon: Activity },
  { key: "alertas", label: "Alertas", icon: Bell },
  { key: "integracoes", label: "Integrações", icon: Network },
];

const opportunityNavigation: NavGroup = {
  label: "Oportunidades",
  icon: Target,
  status: "AI",
  children: [
    { key: "oportunidades-micro", label: "Micro", icon: Crosshair },
    { key: "oportunidades-macro", label: "Macro", icon: Bot },
  ],
};

const navigationEntries: NavigationEntry[] = [
  navigation[0],
  opportunityNavigation,
  ...navigation.slice(1),
];

type AppShellProps = {
  activeView: ViewKey;
  apiStatus: "online" | "degraded";
  children: ReactNode;
  controlPanel: ReactNode;
  marketStatus: string;
  onHome: () => void;
  onNavigate: (view: ViewKey) => void;
  onRefresh: () => void;
  onLogout: () => void;
  selectedSymbol: string;
  user: SessionUser;
};

export function AppShell({
  activeView,
  apiStatus,
  children,
  controlPanel,
  marketStatus,
  onHome,
  onNavigate,
  onRefresh,
  onLogout,
  selectedSymbol,
  user,
}: AppShellProps) {
  return (
    <main className="terminalShell">
      <Sidebar activeView={activeView} controlPanel={controlPanel} onHome={onHome} onNavigate={onNavigate} />
      <section className="terminalMain">
        <Topbar
          apiStatus={apiStatus}
          marketStatus={marketStatus}
          onLogout={onLogout}
          onRefresh={onRefresh}
          selectedSymbol={selectedSymbol}
          user={user}
        />
        {children}
      </section>
    </main>
  );
}

export function Sidebar({
  activeView,
  controlPanel,
  onHome,
  onNavigate,
}: {
  activeView: ViewKey;
  controlPanel: ReactNode;
  onHome: () => void;
  onNavigate: (view: ViewKey) => void;
}) {
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  function toggleGroup(label: string) {
    setExpandedGroups((current) => ({ ...current, [label]: !current[label] }));
  }

  return (
    <aside className="terminalSidebar">
      <button className="brandBlock brandBlock--button" onClick={onHome} type="button">
        <div className="brandMark">
          <Radar size={23} />
        </div>
        <div>
          <h1>Cortex</h1>
          <span>AI Trading Intelligence</span>
        </div>
      </button>

      <nav className="sidebarNav" aria-label="Navegação principal">
        {navigationEntries.map((item) => {
          const Icon = item.icon;
          if ("children" in item) {
            const isGroupActive = item.children.some((child) => child.key === activeView);
            const isExpanded = expandedGroups[item.label] ?? isGroupActive;
            return (
              <div className="navGroup" key={item.label}>
                <button
                  aria-expanded={isExpanded}
                  className={isGroupActive ? "navItem navItem--active navItem--group" : "navItem navItem--group"}
                  onClick={() => toggleGroup(item.label)}
                  type="button"
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                  <span className="navItemMeta">
                    {item.status ? <em>{item.status}</em> : null}
                    <ChevronRight className={isExpanded ? "navChevron navChevron--open" : "navChevron"} size={16} />
                  </span>
                </button>
                {isExpanded ? (
                  <div className="navSubmenu" aria-label={`Submenu ${item.label}`}>
                    {item.children.map((child) => {
                      const ChildIcon = child.icon;
                      return (
                        <button
                          className={activeView === child.key ? "navSubitem navSubitem--active" : "navSubitem"}
                          key={child.key}
                          onClick={() => onNavigate(child.key)}
                          type="button"
                        >
                          <ChildIcon size={15} />
                          <span>{child.label}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          }
          return (
            <button
              className={activeView === item.key ? "navItem navItem--active" : "navItem"}
              key={item.key}
              onClick={() => onNavigate(item.key)}
              type="button"
            >
              <Icon size={18} />
              <span>{item.label}</span>
              {item.status ? <em>{item.status}</em> : null}
            </button>
          );
        })}
      </nav>

      {controlPanel ? <div className="sidebarControlPanel">{controlPanel}</div> : null}
    </aside>
  );
}

export function Topbar({
  apiStatus,
  marketStatus,
  onRefresh,
  onLogout,
  selectedSymbol,
  user,
}: {
  apiStatus: "online" | "degraded";
  marketStatus: string;
  onLogout: () => void;
  onRefresh: () => void;
  selectedSymbol: string;
  user: SessionUser;
}) {
  const firstName = user.name.split(" ")[0] || "Trader";
  return (
    <header className="terminalTopbar">
      <div className="globalSearch" aria-label="Busca global">
        <Search size={17} />
        <span>Buscar ativo, análise, oportunidade...</span>
        <kbd>{selectedSymbol}</kbd>
      </div>
      <div className="topbarCluster">
        <span className="marketStatus">
          <span />
          {marketStatus}
        </span>
        <span className={apiStatus === "online" ? "apiStatus apiStatus--online" : "apiStatus apiStatus--degraded"}>
          API {apiStatus === "online" ? "online" : "atenção"}
        </span>
        <button className="topbarIconButton" onClick={onRefresh} type="button" aria-label="Atualizar dados">
          <Activity size={17} />
        </button>
        <button className="topbarIconButton" type="button" aria-label="Notificações">
          <Bell size={17} />
        </button>
        <div className="userChip" title={`${user.name} · ${user.plan}`}>
          <CircleUserRound size={18} />
          <span>{firstName}</span>
        </div>
        <button className="topbarIconButton" onClick={onLogout} type="button" aria-label="Sair">
          <LogOut size={17} />
        </button>
      </div>
    </header>
  );
}

export function StatCard({
  label,
  value,
  detail,
  tone = "neutral",
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "positive" | "negative" | "warning" | "neutral";
  icon: LucideIcon;
}) {
  return (
    <article className={`statCard statCard--${tone}`}>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
      <Icon size={20} />
    </article>
  );
}

export function MarketCard({
  symbol,
  name,
  price,
  change,
}: {
  symbol: string;
  name: string;
  price: string;
  change: number;
}) {
  return (
    <article className="marketCard">
      <div>
        <strong>{symbol}</strong>
        <span>{name}</span>
      </div>
      <div className={change >= 0 ? "marketMove marketMove--up" : "marketMove marketMove--down"}>
        <span>{price}</span>
        <em>{change >= 0 ? "+" : ""}{change.toFixed(2)}%</em>
      </div>
    </article>
  );
}

export function Heatmap() {
  const assets = [
    { symbol: "SPY", move: 0.78, size: "large" },
    { symbol: "QQQ", move: 1.12, size: "wide" },
    { symbol: "AAPL", move: -0.42, size: "small" },
    { symbol: "NVDA", move: 2.35, size: "large" },
    { symbol: "TSLA", move: -1.18, size: "small" },
    { symbol: "MSFT", move: 0.31, size: "small" },
    { symbol: "BTC", move: 1.84, size: "wide" },
  ];

  return (
    <div className="heatmapGrid">
      {assets.map((asset) => (
        <div
          className={`heatmapTile heatmapTile--${asset.move >= 0 ? "up" : "down"} heatmapTile--${asset.size}`}
          key={asset.symbol}
        >
          <strong>{asset.symbol}</strong>
          <span>{asset.move >= 0 ? "+" : ""}{asset.move.toFixed(2)}%</span>
        </div>
      ))}
    </div>
  );
}

export function IntegrationStatusCard({
  name,
  status,
  detail,
  tone = "neutral",
}: {
  name: string;
  status: string;
  detail: string;
  tone?: "positive" | "warning" | "neutral";
}) {
  return (
    <article className={`integrationCard integrationCard--${tone}`}>
      <Cable size={18} />
      <div>
        <strong>{name}</strong>
        <span>{status}</span>
        <small>{detail}</small>
      </div>
    </article>
  );
}

export function EmptyState({ title, message, icon: Icon = Sparkles }: { title: string; message: string; icon?: LucideIcon }) {
  return (
    <div className="stateCard stateCard--empty">
      <Icon size={22} />
      <strong>{title}</strong>
      <span>{message}</span>
    </div>
  );
}

export function LoadingState({ message }: { message: string }) {
  return (
    <div className="stateCard stateCard--loading">
      <span className="stateSpinner" />
      <strong>{message}</strong>
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="stateCard stateCard--error">
      <AlertCircle size={20} />
      <strong>Algo saiu do esperado</strong>
      <span>{message}</span>
    </div>
  );
}

export function DashboardHome({
  activeAnalysisLabel,
  assetName,
  chartSlot,
  completedCount,
  latestPrice,
  marketChangePct,
  onOpenIntegrations,
  onOpenOpportunities,
  opportunitySignal,
  selectedSymbol,
}: {
  activeAnalysisLabel: string;
  assetName: string;
  chartSlot: ReactNode;
  completedCount: number;
  latestPrice: string;
  marketChangePct: number;
  onOpenIntegrations: () => void;
  onOpenOpportunities: () => void;
  opportunitySignal: OpportunitySignal | null;
  selectedSymbol: string;
}) {
  const confidence = opportunitySignal ? `${Math.round(opportunitySignal.confidence_score * 100)}%` : "Aguardando";
  const direction = opportunitySignal?.direction ?? "WAIT";
  const directionTone = direction === "BUY" ? "positive" : direction === "SELL" ? "negative" : direction === "AVOID" ? "warning" : "neutral";

  return (
    <section className="dashboardGrid">
      <div className="executiveHero">
        <div>
          <p className="eyebrow">Cortex command center</p>
          <h2>Trading intelligence com IA, risco e mercado em uma única mesa.</h2>
          <p>
            Visão executiva para monitorar oportunidades, análises multiagente, dados de mercado e integrações futuras sem execução real de ordens.
          </p>
        </div>
        <div className="heroActions">
          <button onClick={onOpenOpportunities} type="button">
            <Target size={17} />
            Analisar oportunidade
          </button>
        </div>
      </div>

      <div className="statGrid">
        <StatCard icon={Zap} label="Resumo do dia" value={selectedSymbol} detail={`${assetName} · ${latestPrice}`} tone="neutral" />
        <StatCard icon={Target} label="Oportunidade atual" value={direction} detail="Última decisão gerada" tone={directionTone} />
        <StatCard icon={Gauge} label="Confiança da IA" value={confidence} detail="Score do sinal ativo" tone="positive" />
        <StatCard icon={ShieldAlert} label="Risco médio" value="1.00%" detail="Limite por operação" tone="warning" />
        <StatCard icon={TrendingUp} label="Retorno médio" value="+1.8R" detail="Simulado / educacional" tone="positive" />
        <StatCard icon={Bot} label="Análises salvas" value={String(completedCount)} detail={activeAnalysisLabel} tone="neutral" />
      </div>

      <section className="marketDeck">
        <div className="panelHeader panelHeader--large">
          <LineChart size={19} />
          <div>
            <h3>Gráfico de mercado</h3>
            <span>{selectedSymbol} · variação {marketChangePct >= 0 ? "+" : ""}{marketChangePct.toFixed(2)}%</span>
          </div>
        </div>
        {chartSlot}
      </section>

      <section className="heatmapPanel">
        <div className="panelHeader panelHeader--large">
          <Flame size={19} />
          <div>
            <h3>Heatmap de ativos</h3>
            <span>Performance intraday simulada para leitura visual</span>
          </div>
        </div>
        <Heatmap />
      </section>

      <section className="sideFeedPanel">
        <div className="panelHeader panelHeader--large">
          <Sparkles size={19} />
          <div>
            <h3>Notícias e sinais</h3>
            <span>Feed contextual para análise humana</span>
          </div>
        </div>
        <div className="newsList">
          <article>
            <strong>Volatilidade concentrada em tecnologia</strong>
            <span>Oportunidades favorecem setups com stop técnico curto.</span>
          </article>
          <article>
            <strong>Liquidez acima da média</strong>
            <span>Confirmações por volume ganham peso nas próximas leituras.</span>
          </article>
          <article>
            <strong>Modo educativo ativo</strong>
            <span>Nenhum sinal executa ordem real ou recomendação financeira.</span>
          </article>
        </div>
      </section>

      <section className="moversPanel">
        <div className="panelHeader panelHeader--large">
          <Landmark size={19} />
          <div>
            <h3>Top movers</h3>
            <span>Ativos monitorados</span>
          </div>
        </div>
        <div className="marketList">
          <MarketCard symbol="NVDA" name="NVIDIA Corp." price="148.20" change={2.35} />
          <MarketCard symbol="BTC" name="Bitcoin" price="104,820" change={1.84} />
          <MarketCard symbol="TSLA" name="Tesla Inc." price="184.10" change={-1.18} />
          <MarketCard symbol="AAPL" name="Apple Inc." price="201.74" change={-0.42} />
        </div>
      </section>

      <section className="integrationPanel">
        <div className="panelHeader panelHeader--large">
          <Network size={19} />
          <div>
            <h3>Status das integrações</h3>
            <span>Conexões de dados e execução</span>
          </div>
        </div>
        <div className="integrationGrid">
          <IntegrationStatusCard name="API Cortex" status="Online" detail="FastAPI respondendo localmente" tone="positive" />
          <IntegrationStatusCard name="yFinance" status="Dados" detail="Provider de mercado para histórico" tone="neutral" />
          <IntegrationStatusCard name="MetaTrader 5" status="Conectável" detail="Dados da corretora sem execução de ordens" tone="warning" />
        </div>
        <button className="secondaryPanelAction" onClick={onOpenIntegrations} type="button">
          Ver integrações
          <ChevronRight size={16} />
        </button>
      </section>
    </section>
  );
}

export function FeaturePlaceholder({
  icon: Icon,
  title,
  message,
  items,
}: {
  icon: LucideIcon;
  title: string;
  message: string;
  items: string[];
}) {
  return (
    <section className="featurePlaceholder">
      <div className="featurePlaceholderHero">
        <Icon size={28} />
        <div>
          <p className="eyebrow">Módulo Cortex</p>
          <h2>{title}</h2>
          <p>{message}</p>
        </div>
      </div>
      <div className="featureRoadmap">
        {items.map((item) => (
          <article key={item}>
            <span />
            <strong>{item}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}
