"use client";

import { History, RefreshCw } from "lucide-react";

export type OperationHistoryItem = {
  position_ticket: number;
  symbol: string;
  direction: "BUY" | "SELL";
  volume: number;
  entry_price: number;
  exit_price?: number | null;
  stop_loss?: number | null;
  take_profit?: number | null;
  profit: number;
  swap: number;
  commission: number;
  currency: string;
  status: "open" | "closed";
  opened_at: string;
  closed_at?: string | null;
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value));
}

function formatNumber(value?: number | null, digits = 5) {
  if (value == null) return "—";
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(value);
}

export function OperationHistory({
  operations,
  currency,
  demoMode,
  error,
  isLoading,
  onRefresh,
}: {
  operations: OperationHistoryItem[];
  currency?: string | null;
  demoMode: boolean;
  error?: string | null;
  isLoading: boolean;
  onRefresh: () => void;
}) {
  const total = operations.reduce((sum, operation) => sum + operation.profit + operation.swap + operation.commission, 0);
  const closed = operations.filter((operation) => operation.status === "closed");
  const winners = closed.filter((operation) => operation.profit + operation.swap + operation.commission > 0).length;

  return (
    <section className="operationHistoryPanel">
      <header className="operationHistoryHeader">
        <div>
          <span className="operationHistoryEyebrow">{demoMode ? "Conta demo Cortex" : "MetaTrader 5"}</span>
          <h2><History size={20} /> Histórico de operações</h2>
          <p>{demoMode ? "Operações simuladas com cotações de mercado." : "Posições abertas e operações encerradas na conta conectada."}</p>
        </div>
        <button className="operationHistoryRefresh" disabled={isLoading} onClick={onRefresh} type="button">
          <RefreshCw className={isLoading ? "spin" : ""} size={16} />
          Atualizar
        </button>
      </header>

      <div className="operationHistoryMetrics">
        <div><span>Operações</span><strong>{operations.length}</strong></div>
        <div><span>Encerradas</span><strong>{closed.length}</strong></div>
        <div><span>Taxa de acerto</span><strong>{closed.length ? `${Math.round((winners / closed.length) * 100)}%` : "—"}</strong></div>
        <div><span>Resultado líquido</span><strong className={total >= 0 ? "positive" : "negative"}>{total >= 0 ? "+" : ""}{formatNumber(total, 2)} {currency ?? ""}</strong></div>
      </div>

      {error ? <div className="operationHistoryError">{error}</div> : null}

      <div className="operationHistoryTableWrap">
        <table className="operationHistoryTable">
          <thead>
            <tr>
              <th>Ativo</th>
              <th>Abertura</th>
              <th>Fechamento</th>
              <th>Tipo</th>
              <th>Volume</th>
              <th>Entrada</th>
              <th>Stop</th>
              <th>Alvo</th>
              <th>Saída / Atual</th>
              <th>Resultado</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {operations.map((operation) => {
              const result = operation.profit + operation.swap + operation.commission;
              return (
                <tr className={operation.status === "open" ? "operationRowOpen" : ""} key={`${operation.position_ticket}-${operation.status}`}>
                  <td><strong>{operation.symbol}</strong><small>#{operation.position_ticket}</small></td>
                  <td>{formatDate(operation.opened_at)}</td>
                  <td>{formatDate(operation.closed_at)}</td>
                  <td><span className={`operationDirection operationDirection--${operation.direction.toLowerCase()}`}>{operation.direction === "BUY" ? "Compra" : "Venda"}</span></td>
                  <td>{formatNumber(operation.volume, 2)}</td>
                  <td>{formatNumber(operation.entry_price)}</td>
                  <td>{formatNumber(operation.stop_loss)}</td>
                  <td>{formatNumber(operation.take_profit)}</td>
                  <td>{formatNumber(operation.exit_price)}</td>
                  <td><strong className={result >= 0 ? "positive" : "negative"}>{result >= 0 ? "+" : ""}{formatNumber(result, 2)} {operation.currency}</strong></td>
                  <td><span className={`operationStatus operationStatus--${operation.status}`}>{operation.status === "open" ? "Aberta" : "Fechada"}</span></td>
                </tr>
              );
            })}
            {!isLoading && operations.length === 0 ? (
              <tr><td className="operationHistoryEmpty" colSpan={11}>Nenhuma operação encontrada no período selecionado.</td></tr>
            ) : null}
            {isLoading ? (
              <tr><td className="operationHistoryEmpty" colSpan={11}>Carregando histórico da corretora...</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
