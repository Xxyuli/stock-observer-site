export type Stock = {
  symbol: string;
  previous_symbol?: string | null;
  name: string;
  market: "HK" | "US";
  asset_type?: "stock" | "etf";
  sector: string;
  currency: string;
  close: number | null;
  change: number | null;
  last_date: string | null;
  expected_date: string;
  next_session_date?: string;
  next_session_due?: string;
  day: number | null;
  anchor: string | null;
  cycle: string | null;
  phase: string;
  quality: string;
  pending_count: number;
  repair_count: number;
  updated_at: string;
  history_sessions?: number;
  latest_event?: SignalEvent | null;
};
export type SignalEvent = {
  date: string;
  kind: string;
  day: number;
  anchor: string;
  previous_anchor?: string | null;
};
export type Bar = {
  time: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
  valid: boolean;
  entry_price_factor?: number | null;
  [key: string]: string | number | null | boolean | undefined;
};
export type Position = {
  status: "open" | "closed";
  buy_date: string;
  buy_price: number;
  quantity?: number | null;
  sell_date?: string | null;
  sell_price?: number | null;
};
export type State = {
  status: "none" | "observe" | "ignore";
  cycle: string | null;
  note: string;
  muted: boolean;
  position: Position | null;
  revision: number;
  updated_at?: string;
};
export type Settings = {
  email: string;
  email_enabled: boolean;
  indicators: string[];
  oscillator: "volume" | "macd" | "rsi" | "atr" | "kdj";
  revision: number;
};
export type Issue = {
  symbol: string;
  date: string;
  kind: string;
  reason: string;
  status?: string;
};
export type Repair = {
  symbol: string;
  date: string;
  kind: string;
  source: string;
  scale?: number;
  before?: Record<string, number>;
  after?: Record<string, number>;
};
export type Detail = {
  summary: Stock;
  daily: Bar[];
  weekly: Bar[];
  monthly: Bar[];
  period_complete?: { weekly: boolean; monthly: boolean };
  signal: {
    events: SignalEvent[];
    evidence: {
      date: string;
      open: number;
      close: number;
      previous_close: number;
    }[];
    day10?: {
      pivot_date: string;
      pivot_day: number;
      reference_date: string;
      reference_open: number;
      trend_passed: boolean;
      price_passed: boolean;
      review_day: number;
      date: string;
    } | null;
  };
  issues: Issue[];
  repairs: Repair[];
  price_description?: string;
};
export type Bootstrap = {
  stocks: Stock[];
  states: Record<string, State>;
  settings: Settings;
  mode: string;
  mail_configured: boolean;
};
export const blankState: State = {
  status: "none",
  cycle: null,
  note: "",
  muted: false,
  position: null,
  revision: 0,
};
export const defaultSettings: Settings = {
  email: "",
  email_enabled: false,
  indicators: ["ma20", "ma60"],
  oscillator: "volume",
  revision: 0,
};
