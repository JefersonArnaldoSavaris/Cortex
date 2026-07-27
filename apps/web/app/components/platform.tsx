"use client";

import {
  Activity,
  AlertCircle,
  Bell,
  Bot,
  ChevronRight,
  CircleUserRound,
  Crosshair,
  LucideIcon,
  Network,
  Radar,
  LogOut,
  Sparkles,
  Target,
} from "lucide-react";
import { useState, type ReactNode } from "react";

export type ViewKey =
  | "oportunidades-micro"
  | "oportunidades-macro"
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
  opportunityNavigation,
  ...navigation,
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
  user,
}: {
  apiStatus: "online" | "degraded";
  marketStatus: string;
  onLogout: () => void;
  onRefresh: () => void;
  user: SessionUser;
}) {
  const firstName = user.name.split(" ")[0] || "Trader";
  return (
    <header className="terminalTopbar">
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
