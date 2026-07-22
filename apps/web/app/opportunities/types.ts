export type OpportunityDirection = "BUY" | "SELL" | "WAIT" | "AVOID";
export type OpportunityStrategyType = "daytrade" | "swingtrade";
export type OpportunityTimeframe = "M1" | "M5" | "M15" | "M30" | "H1" | "H4" | "D1";
export type OpportunityRiskProfile = "conservador" | "moderado" | "agressivo";
export type OpportunityProvider = "mock" | "yfinance" | "mt5";

export type OpportunityRequest = {
  symbol: string;
  strategy_type: OpportunityStrategyType;
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
  timeframe: OpportunityTimeframe;
  direction: OpportunityDirection;
  confidence_score: number;
  setup_name: string;
  entry_price?: number | null;
  stop_loss?: number | null;
  take_profit?: number | null;
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

