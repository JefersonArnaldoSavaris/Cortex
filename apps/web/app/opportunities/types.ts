export type OpportunityDirection = "BUY" | "SELL" | "WAIT" | "AVOID";
export type OpportunityStrategyType = "daytrade" | "swingtrade";
export type OpportunityTimeframe = "M1" | "M5" | "M15" | "M30" | "H1" | "H4" | "D1";
export type OpportunityRiskProfile = "conservador" | "moderado" | "agressivo";
export type OpportunityProvider = "mock" | "twelvedata" | "yfinance" | "mt5";

export type OpportunityRequest = {
  symbol: string;
  strategy_type: OpportunityStrategyType;
  strategy_id: string;
  timeframe: OpportunityTimeframe;
  risk_profile: OpportunityRiskProfile;
  capital: number;
  max_risk_per_trade: number;
  max_signals: number;
  provider: OpportunityProvider;
  limit: number;
};

export type OpportunitySignal = {
  symbol: string;
  strategy_type: OpportunityStrategyType;
  strategy_id: string;
  timeframe: OpportunityTimeframe;
  direction: OpportunityDirection;
  planned_direction?: "BUY" | "SELL" | null;
  confidence_score: number;
  setup_name: string;
  entry_price?: number | null;
  stop_loss?: number | null;
  take_profit?: number | null;
  entry_zone_low?: number | null;
  entry_zone_high?: number | null;
  execution_ready: boolean;
  risk_reward_ratio?: number | null;
  position_size: number;
  max_loss: number;
  technical_reasons: string[];
  risk_reasons: string[];
  invalidation_criteria: string[];
  warnings: string[];
  generated_at: string;
};

export type OpportunityResult = {
  request: OpportunityRequest;
  signals: OpportunitySignal[];
  warnings: string[];
  generated_at: string;
};

export type OrderPreview = {
  symbol: string;
  direction: "BUY" | "SELL";
  volume: number;
  requested_volume: number;
  entry_price: number;
  stop_loss: number;
  take_profit: number;
  estimated_loss: number;
  estimated_profit: number;
  estimated_margin?: number | null;
  currency: string;
  volume_min: number;
  volume_max: number;
  volume_step: number;
  execution_enabled: boolean;
  check_message: string;
  order_kind: "market" | "pending";
  pending_type?: "BUY_LIMIT" | "BUY_STOP" | "SELL_LIMIT" | "SELL_STOP" | null;
};

export type PendingOrderStatus = {
  order_ticket: number;
  symbol: string;
  direction: "BUY" | "SELL";
  pending_type: "BUY_LIMIT" | "BUY_STOP" | "SELL_LIMIT" | "SELL_STOP";
  volume: number;
  entry_price: number;
  stop_loss?: number | null;
  take_profit?: number | null;
  created_at?: string | null;
};

export type OrderExecution = {
  order_ticket?: number | null;
  deal_ticket?: number | null;
  retcode: number;
  message: string;
  executed_price?: number | null;
  volume: number;
  position_ticket?: number | null;
};

export type OrderStatus = {
  status: "open" | "closed" | "not_found";
  symbol: string;
  position_ticket?: number | null;
  direction?: "BUY" | "SELL" | null;
  volume?: number | null;
  entry_price?: number | null;
  current_price?: number | null;
  stop_loss?: number | null;
  take_profit?: number | null;
  profit?: number | null;
  stop_result?: number | null;
  target_result?: number | null;
  swap?: number | null;
  currency: string;
  account_balance?: number | null;
  account_equity?: number | null;
  opened_at?: string | null;
  technical_reasons: string[];
  risk_reasons: string[];
  analysis_generated_at?: string | null;
};
