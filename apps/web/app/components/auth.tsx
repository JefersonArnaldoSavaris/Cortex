"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import {
  Apple,
  BrainCircuit,
  Chrome,
  Eye,
  EyeOff,
  Gauge,
  KeyRound,
  LineChart,
  Lock,
  Mail,
  Network,
  Radar,
  RefreshCw,
  ShieldCheck,
  Target,
  TrendingUp,
  UserRound,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type AuthMode = "login" | "register" | "forgot";

type AuthScreenProps = {
  error: string | null;
  info: string | null;
  isLoading: boolean;
  mode: AuthMode;
  onForgot: (email: string) => Promise<void>;
  onLogin: (email: string, password: string) => Promise<void>;
  onModeChange: (mode: AuthMode) => void;
  onRegister: (payload: { name: string; email: string; password: string; acceptedTerms: boolean }) => Promise<void>;
};

function isStrongPassword(password: string) {
  return password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password);
}

function getPasswordScore(password: string) {
  return [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[a-z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;
}

export function AuthScreen(props: AuthScreenProps) {
  return (
    <AuthShell>
      <AuthMarketingPanel />
      <AuthCard {...props} />
    </AuthShell>
  );
}

function AuthShell({ children }: { children: ReactNode }) {
  return <main className="authShell authShell--premium">{children}</main>;
}

function AuthMarketingPanel() {
  return (
    <section className="authMarketingPanel" aria-label="Cortex trading intelligence">
      <div className="authAura authAura--primary" />
      <div className="authAura authAura--secondary" />

      <div className="authBrand">
        <div className="authBrandMark">
          <Radar size={25} />
        </div>
        <div>
          <strong>Cortex</strong>
          <span>AI Trading Intelligence</span>
        </div>
      </div>

      <div className="authMarketingCopy">
        <p className="eyebrow">Fintech intelligence layer</p>
        <h1>Inteligência, dados e estratégia para <span>decisões superiores.</span></h1>
        <p>
          Uma plataforma para pesquisar ativos, detectar oportunidades, acompanhar risco e preparar
          integrações operacionais com governança desde o primeiro acesso.
        </p>
      </div>

      <div className="authBenefitGrid">
        <BenefitCard icon={BrainCircuit} title="Análises com IA" detail="Agentes especializados para mercado, notícias, sentimento e fundamentos." />
        <BenefitCard icon={LineChart} title="Oportunidades de Trade" detail="Leituras de Day Trade e Swing Trade com contexto técnico." />
        <BenefitCard icon={Gauge} title="Gestão de Risco" detail="Base para limites por plano, exposição e disciplina operacional." />
        <BenefitCard icon={Network} title="Integrações Futuras" detail="MT5 e automações preparadas com arquitetura segura." />
      </div>

      <PlatformMockup />

      <footer className="authTrustFooter">
        <span><ShieldCheck size={18} /><strong>Segurança de ponta</strong><em>Dados protegidos com criptografia</em></span>
        <span><ShieldCheck size={18} /><strong>Privacidade</strong><em>Transparência total no uso de dados</em></span>
        <span><Gauge size={18} /><strong>Infraestrutura robusta</strong><em>Alta disponibilidade e performance</em></span>
        <span><TrendingUp size={18} /><strong>Feito para performance</strong><em>Velocidade, estabilidade e escala</em></span>
      </footer>
    </section>
  );
}

function PlatformMockup() {
  const opportunities = [
    ["PETR4", "Day Trade · M15", "BUY", "82% confiança", "1:2,45"],
    ["VALE3", "Day Trade · M15", "BUY", "76% confiança", "1:2,10"],
    ["WINQ25", "Day Trade · M5", "SELL", "71% confiança", "1:1,85"],
  ];

  return (
    <div className="authPlatformMockup" aria-hidden="true">
      <div className="phoneFrame">
        <div className="phoneButton phoneButton--one" />
        <div className="phoneButton phoneButton--two" />
        <div className="phoneScreen">
          <div className="phoneStatus">
            <strong>9:41</strong>
            <span>▮▮▮  ◔</span>
          </div>
          <div className="phoneNotch" />

          <div className="phoneAppHeader">
            <div>
              <Radar size={20} />
              <strong>Cortex</strong>
            </div>
            <span className="phoneBell">•</span>
          </div>

          <div className="phoneGreeting">
            <span>Olá, Pedro! <em>PRO</em></span>
            <small>Plano Pro · válido até 20/08/2026</small>
          </div>

          <div className="phoneWealth">
            <span>Patrimônio total</span>
            <strong>R$ 123.329,20</strong>
            <em>+ R$ 3.819,91 (2,01%) hoje</em>
          </div>

          <div className="phoneLineChart">
            <svg viewBox="0 0 280 90" role="img" aria-label="Curva de patrimônio">
              <path d="M4 62 C28 48, 40 68, 58 45 S92 24, 112 48 S145 70, 165 42 S205 38, 224 52 S256 70, 276 38" />
            </svg>
            <span>+2,01%</span>
          </div>

          <div className="phoneMetrics">
            <span><small>Oportunidades</small><strong>24</strong><em>+12 hoje</em></span>
            <span><small>Taxa de acerto</small><strong>68%</strong><em>+5 pp</em></span>
            <span><small>Risco médio</small><strong>0,85%</strong><em>por operação</em></span>
          </div>

          <div className="phoneSectionHeader">
            <strong>Oportunidades em destaque</strong>
            <button type="button">Ver todas ›</button>
          </div>

          <div className="phoneOpportunityList">
            {opportunities.map(([asset, type, side, confidence, ratio]) => (
              <div className="phoneOpportunity" key={asset}>
                <span className={side === "SELL" ? "phoneOpportunityIcon phoneOpportunityIcon--sell" : "phoneOpportunityIcon"}>
                  {side === "SELL" ? <ShieldCheck size={14} /> : <Target size={14} />}
                </span>
                <div>
                  <strong>{asset}</strong>
                  <small>{type}</small>
                </div>
                <em className={side === "SELL" ? "negative" : "positive"}>{side}</em>
                <span><small>{confidence}</small><strong>{ratio}</strong></span>
              </div>
            ))}
          </div>

          <div className="phoneTabbar">
            <span className="active"><Radar size={15} />Dashboard</span>
            <span><LineChart size={15} />Mercado</span>
            <span><Target size={15} />Trades</span>
            <span><Wallet size={15} />Carteira</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function BenefitCard({ detail, icon: Icon, title }: { detail: string; icon: LucideIcon; title: string }) {
  return (
    <article className="authBenefitCard">
      <Icon size={19} />
      <strong>{title}</strong>
      <span>{detail}</span>
    </article>
  );
}

function AuthCard({
  error,
  info,
  isLoading,
  mode,
  onForgot,
  onLogin,
  onModeChange,
  onRegister,
}: AuthScreenProps) {
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerPasswordConfirmation, setRegisterPasswordConfirmation] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const activeError = localError ?? error;

  function resetMode(nextMode: AuthMode) {
    setLocalError(null);
    onModeChange(nextMode);
  }

  function submitLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError(null);
    if (!loginEmail.trim() || !loginPassword) {
      setLocalError("Informe e-mail e senha para entrar.");
      return;
    }
    void onLogin(loginEmail, loginPassword);
  }

  function submitRegister(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError(null);
    if (!registerName.trim() || !registerEmail.trim() || !registerPassword || !registerPasswordConfirmation) {
      setLocalError("Preencha todos os campos obrigatórios.");
      return;
    }
    if (registerPassword !== registerPasswordConfirmation) {
      setLocalError("A confirmação de senha não confere.");
      return;
    }
    if (!isStrongPassword(registerPassword)) {
      setLocalError("Use uma senha com 8+ caracteres, maiúscula, minúscula, número e símbolo.");
      return;
    }
    if (!acceptedTerms) {
      setLocalError("Aceite os termos de uso e a política de privacidade.");
      return;
    }
    void onRegister({ name: registerName, email: registerEmail, password: registerPassword, acceptedTerms });
  }

  function submitForgot(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError(null);
    if (!forgotEmail.trim()) {
      setLocalError("Informe o e-mail da sua conta.");
      return;
    }
    void onForgot(forgotEmail);
  }

  return (
    <section className="authCardPanel" aria-live="polite">
      <div className="authCardGlow" />
      <div className="authModeTabs authModeTabs--premium">
        <button className={mode === "login" ? "active" : ""} onClick={() => resetMode("login")} type="button">Entrar</button>
        <button className={mode === "register" ? "active" : ""} onClick={() => resetMode("register")} type="button">Criar conta</button>
      </div>

      {mode === "login" ? (
        <form className="authForm authForm--premium" onSubmit={submitLogin}>
          <AuthTitle icon={Radar} title="Bem-vindo de volta" subtitle="Acesse sua conta e continue sua jornada com o Cortex." />
          <div className="socialLoginGrid">
            <SocialLoginButton icon={Chrome} label="Entrar com Google" />
            <SocialLoginButton icon={Apple} label="Entrar com Apple" />
          </div>
          <div className="authDivider"><span>ou</span></div>
          <FieldShell icon={Mail} label="E-mail ou usuário">
            <input autoComplete="email" type="email" value={loginEmail} onChange={(event) => setLoginEmail(event.target.value)} />
          </FieldShell>
          <PasswordInput label="Senha" autoComplete="current-password" value={loginPassword} onChange={setLoginPassword} />
          <div className="loginOptionsRow">
            <label className="rememberRow">
              <input checked={rememberMe} type="checkbox" onChange={(event) => setRememberMe(event.target.checked)} />
              <span>Lembrar de mim</span>
            </label>
            <button onClick={() => resetMode("forgot")} type="button">Esqueci minha senha</button>
          </div>
          <AuthFeedback error={activeError} info={info} />
          <button className="authPrimaryButton" disabled={isLoading} type="submit">
            {isLoading ? <RefreshCw size={17} /> : <KeyRound size={17} />}
            Entrar
            <span className="authPrimaryArrow">→</span>
          </button>
          <p className="authSwitchText">
            Não tem uma conta? <button onClick={() => resetMode("register")} type="button">Criar conta</button>
          </p>
          <SecurityBadge />
        </form>
      ) : mode === "register" ? (
        <form className="authForm authForm--premium" onSubmit={submitRegister}>
          <AuthTitle icon={UserRound} title="Criar conta Cortex" subtitle="Comece no plano free e evolua para recursos comerciais." />
          <FieldShell icon={UserRound} label="Nome completo">
            <input autoComplete="name" value={registerName} onChange={(event) => setRegisterName(event.target.value)} />
          </FieldShell>
          <FieldShell icon={Mail} label="E-mail">
            <input autoComplete="email" type="email" value={registerEmail} onChange={(event) => setRegisterEmail(event.target.value)} />
          </FieldShell>
          <PasswordInput label="Senha" autoComplete="new-password" value={registerPassword} onChange={setRegisterPassword} />
          <PasswordInput label="Confirmar senha" autoComplete="new-password" value={registerPasswordConfirmation} onChange={setRegisterPasswordConfirmation} />
          <PasswordStrength password={registerPassword} />
          <label className="termsRow termsRow--premium">
            <input checked={acceptedTerms} type="checkbox" onChange={(event) => setAcceptedTerms(event.target.checked)} />
            <span>Aceito os termos de uso e a política de privacidade.</span>
          </label>
          <AuthFeedback error={activeError} info={info} />
          <button className="authPrimaryButton" disabled={isLoading} type="submit">
            {isLoading ? <RefreshCw size={17} /> : <UserRound size={17} />}
            Criar conta
          </button>
          <p className="authSwitchText">
            Já tem acesso? <button onClick={() => resetMode("login")} type="button">Voltar ao login</button>
          </p>
        </form>
      ) : (
        <form className="authForm authForm--premium" onSubmit={submitForgot}>
          <AuthTitle icon={Mail} title="Recuperar senha" subtitle="Enviaremos instruções se o e-mail estiver cadastrado." />
          <FieldShell icon={Mail} label="E-mail">
            <input autoComplete="email" type="email" value={forgotEmail} onChange={(event) => setForgotEmail(event.target.value)} />
          </FieldShell>
          <AuthFeedback error={activeError} info={info} />
          <button className="authPrimaryButton" disabled={isLoading} type="submit">
            {isLoading ? <RefreshCw size={17} /> : <Mail size={17} />}
            Enviar instruções
          </button>
          <p className="authSwitchText">
            Lembrou a senha? <button onClick={() => resetMode("login")} type="button">Voltar ao login</button>
          </p>
          <SecurityBadge />
        </form>
      )}
    </section>
  );
}

function AuthTitle({ icon: Icon, subtitle, title }: { icon: LucideIcon; subtitle: string; title: string }) {
  return (
    <div className="authTitle authTitle--premium">
      <span><Icon size={22} /></span>
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
    </div>
  );
}

function SocialLoginButton({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <button className="socialLoginButton" disabled title="Em breve" type="button">
      <Icon size={18} />
      <span>{label}</span>
      <em>Em breve</em>
    </button>
  );
}

function FieldShell({ children, icon: Icon, label }: { children: ReactNode; icon: LucideIcon; label: string }) {
  return (
    <label className="authField">
      <span>{label}</span>
      <div className="authFieldControl">
        <Icon size={17} />
        {children}
      </div>
    </label>
  );
}

function PasswordInput({
  autoComplete,
  label,
  onChange,
  value,
}: {
  autoComplete: string;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <label className="authField">
      <span>{label}</span>
      <div className="authFieldControl authFieldControl--password">
        <Lock size={17} />
        <input autoComplete={autoComplete} type={isVisible ? "text" : "password"} value={value} onChange={(event) => onChange(event.target.value)} />
        <button aria-label={isVisible ? "Ocultar senha" : "Mostrar senha"} onClick={() => setIsVisible((current) => !current)} type="button">
          {isVisible ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>
    </label>
  );
}

function PasswordStrength({ password }: { password: string }) {
  const score = getPasswordScore(password);
  const label = score >= 5 ? "Senha forte" : score >= 3 ? "Senha média" : "Senha fraca";

  return (
    <div className="passwordStrength">
      <div className="passwordStrengthHeader">
        <span>{label}</span>
        <em>8+ caracteres, maiúscula, minúscula, número e símbolo.</em>
      </div>
      <div className="passwordStrengthTrack" data-score={score}>
        {[0, 1, 2, 3, 4].map((index) => <span key={index} className={index < score ? "active" : ""} />)}
      </div>
    </div>
  );
}

function AuthFeedback({ error, info }: { error: string | null; info: string | null }) {
  return (
    <>
      {error ? <div className="authMessage authMessage--error">{error}</div> : null}
      {info ? <div className="authMessage authMessage--info">{info}</div> : null}
    </>
  );
}

function SecurityBadge() {
  return (
    <div className="securityBadge">
      <ShieldCheck size={17} />
      <div>
        <strong>Seus dados estão protegidos</strong>
        <span>Sessão segura com cookie HttpOnly e sem senha no navegador.</span>
      </div>
    </div>
  );
}

