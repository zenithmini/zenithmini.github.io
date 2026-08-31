export type StrategySettings = {
  capital: number;
  riskPercent: number;
  maxExposurePercent: number;
  allowOddLot: boolean;
};

export type RuleResult = {
  id: string;
  label: string;
  pass: boolean;
  value: string;
  explanation: string;
  weight: number;
};

export type ChartPoint = {
  date: string;
  close: number;
  ma25: number | null;
  ma99: number | null;
};

export type FibonacciLevel = {
  ratio: number;
  label: string;
  price: number;
};

export type FibonacciAnalysis = {
  code: string;
  name: string;
  dataDate: string;
  barsCount: number;
  lookback: number;
  direction: "up" | "down";
  directionLabel: "上升波段" | "下降波段";
  currentPrice: number;
  swingLow: { date: string; price: number };
  swingHigh: { date: string; price: number };
  retracementPercent: number;
  zoneLabel: string;
  summary: string;
  retracements: FibonacciLevel[];
  extensions: FibonacciLevel[];
  nearestSupport: number | null;
  nearestResistance: number | null;
};

export type MarketRegime = {
  state: "bull" | "neutral" | "bear";
  label: "多頭可操作" | "中性降部位" | "空頭停止進場";
  summary: string;
  dataDate: string;
  close: number;
  changePercent: number;
  ma25: number;
  ma99: number;
  ma99Slope20Percent: number;
  positionMultiplier: number;
  conditions: Array<{
    id: string;
    label: string;
    pass: boolean;
    value: string;
  }>;
};

export type AnalysisResult = {
  code: string;
  name: string;
  dataDate: string;
  barsCount: number;
  verdict: "可分批進場" | "可小量試單" | "等待回檔" | "等待轉強" | "趨勢不符" | "禁止追價" | "流動性不足" | "資料需調整" | "風險過大" | "大盤不佳";
  verdictKey: "enter" | "wait" | "avoid";
  summary: string;
  score: number;
  price: number;
  changePercent: number;
  metrics: {
    ma7: number;
    ma25: number;
    ma99: number;
    rsi14: number;
    k: number;
    d: number;
    macd: number;
    macdSignal: number;
    macdHistogram: number;
    atr14: number;
    volume: number;
    volumeMa20: number;
    distanceToMa25Percent: number;
    ma99Slope5Percent: number;
  };
  rules: RuleResult[];
  entryPlan: {
    available: boolean;
    state: "ready" | "wait-pullback" | "wait-breakout" | "blocked";
    stateLabel: string;
    zoneLow: number | null;
    zoneHigh: number | null;
    preferred: number | null;
    breakout: number | null;
    distancePercent: number | null;
    distanceLabel: string;
    basis: string;
  };
  risk: {
    referenceEntry: number;
    stop: number;
    target: number;
    riskPerShare: number;
    stopPercent: number;
    rewardRiskRatio: number;
    shares: number;
    lots: number;
    oddShares: number;
    estimatedPosition: number;
    estimatedRisk: number;
    feeRate: number;
    taxRate: number;
  };
  chart: ChartPoint[];
  warnings: string[];
  market: MarketRegime;
};

export type AnalysisPayload = {
  result: AnalysisResult | null;
  fibonacci: FibonacciAnalysis;
  market: MarketRegime;
  notice: string | null;
  generatedAt: string;
  source: {
    name: string;
    license: string;
    url: string;
  };
};

export type ScreenerCategory = "ready" | "near-entry" | "near-breakout" | "watch" | "blocked";

export type ScreenerItem = {
  code: string;
  name: string;
  dataDate: string;
  price: number;
  changePercent: number;
  score: number;
  verdict: AnalysisResult["verdict"];
  verdictKey: AnalysisResult["verdictKey"];
  category: ScreenerCategory;
  categoryLabel: string;
  reason: string;
  entry: {
    state: AnalysisResult["entryPlan"]["state"];
    zoneLow: number | null;
    zoneHigh: number | null;
    preferred: number | null;
    breakout: number | null;
    distancePercent: number | null;
  };
  risk: {
    stop: number;
    target: number;
    rewardRiskRatio: number;
  };
};

export type ScreenerSnapshot = {
  status: "ready";
  fund: {
    code: "0050";
    name: "元大台灣50";
    constituentDate: string;
    sourceUrl: string;
  };
  generatedAt: string;
  dataDate: string;
  market: MarketRegime;
  groups: {
    ready: ScreenerItem[];
    nearEntry: ScreenerItem[];
    nearBreakout: ScreenerItem[];
    watch: ScreenerItem[];
    blocked: ScreenerItem[];
  };
  all: ScreenerItem[];
  failed: Array<{ code: string; message: string }>;
};

export type ScreenerPayload =
  | { status: "ready"; snapshot: ScreenerSnapshot }
  | {
      status: "building";
      generatedAt: string;
      progress: { completed: number; total: number; failed: number };
      message: string;
    };

export type BacktestTrade = {
  entryDate: string;
  entryPrice: number;
  exitDate: string;
  exitPrice: number;
  shares: number;
  stop: number;
  target: number;
  exitReason: "stop" | "target" | "trend" | "period-end";
  profit: number;
  returnPercent: number;
};

export type FibonacciValidation = {
  horizonTradingDays: number;
  sampleCount: number;
  pendingSampleCount: number;
  coreZoneSampleCount: number;
  coreZoneSuccessCount: number;
  coreZoneSuccessRatePercent: number | null;
  extension1272HitCount: number;
  extension1272HitRatePercent: number | null;
  extension1618HitCount: number;
  extension1618HitRatePercent: number | null;
  invalidationCount: number;
  invalidationRatePercent: number | null;
  medianDaysTo1272: number | null;
  medianDaysTo1618: number | null;
  insufficientSample: boolean;
};

export type BacktestResult = {
  code: string;
  name: string;
  initialCapital: number;
  finalEquity: number;
  startDate: string;
  endDate: string;
  testedTradingDays: number;
  signalCount: number;
  skippedGapCount: number;
  strategyReturnPercent: number;
  benchmarkReturnPercent: number;
  excessReturnPercent: number;
  maxDrawdownPercent: number;
  completedTrades: number;
  winRatePercent: number;
  profitFactor: number | null;
  fibonacciValidation?: FibonacciValidation;
  assumptions: string[];
  trades: BacktestTrade[];
  equityCurve: Array<{ date: string; equity: number }>;
};

export type BacktestPayload = {
  result: BacktestResult;
  generatedAt: string;
  source: {
    name: string;
    license: string;
    url: string;
  };
};

const signalApiBaseUrl = () =>
  (
    process.env.NEXT_PUBLIC_SIGNAL_API_URL ||
    "https://tw-stock-signal-api.market-signal-tools.workers.dev"
  ).replace(/\/+$/, "");

export const normalizeStockCode = (value: string) =>
  value.trim().toUpperCase().replace(/[^0-9A-Z]/g, "").slice(0, 6);

export const isSupportedStockCode = (value: string) =>
  /^(?:\d{4,6}|\d{4,5}[A-Z])$/.test(normalizeStockCode(value));

export const applyPositionSizing = (
  result: AnalysisResult,
  settings: StrategySettings,
): AnalysisResult => {
  const capital = Math.max(0, Number(settings.capital) || 0);
  const riskPercent = Math.max(0, Number(settings.riskPercent) || 0);
  const exposurePercent = Math.max(0, Number(settings.maxExposurePercent) || 0);
  const { referenceEntry, riskPerShare, stopPercent } = result.risk;
  const canSize =
    result.entryPlan.available &&
    result.market.positionMultiplier > 0 &&
    referenceEntry > 0 &&
    riskPerShare > 0 &&
    stopPercent > 0 &&
    stopPercent <= 8;

  let shares = canSize
    ? Math.floor(
        Math.min(
          (capital * riskPercent * 0.01) / riskPerShare,
          (capital * exposurePercent * 0.01) / referenceEntry,
        ),
      )
    : 0;
  if (!settings.allowOddLot) shares = Math.floor(shares / 1000) * 1000;
  shares = Math.floor(shares * result.market.positionMultiplier);
  if (!settings.allowOddLot) shares = Math.floor(shares / 1000) * 1000;

  return {
    ...result,
    risk: {
      ...result.risk,
      shares,
      lots: Math.floor(shares / 1000),
      oddShares: shares % 1000,
      estimatedPosition: shares * referenceEntry,
      estimatedRisk: shares * riskPerShare,
    },
  };
};

export async function fetchStockAnalysis(code: string): Promise<AnalysisPayload> {
  const baseUrl = signalApiBaseUrl();

  const normalizedCode = normalizeStockCode(code);
  if (!isSupportedStockCode(normalizedCode)) {
    throw new Error("請輸入 4–6 碼的上市股票或 ETF 代碼，例如 0050、2330、00403A。");
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(`${baseUrl}/api/analyze`, {
      method: "POST",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: normalizedCode }),
      signal: controller.signal,
    });
    const payload = (await response.json().catch(() => null)) as AnalysisPayload | { error?: string } | null;
    if (!response.ok) {
      throw new Error(payload && "error" in payload && payload.error ? payload.error : "分析服務暫時無法使用。");
    }
    if (!payload || !("market" in payload) || !("fibonacci" in payload) || !("result" in payload)) {
      throw new Error("分析服務回傳的資料格式不正確。");
    }
    return payload;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("分析超過 30 秒，請稍後重新嘗試。");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function fetchTaiwan50Screener(): Promise<ScreenerPayload> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 60_000);
  try {
    const response = await fetch(`${signalApiBaseUrl()}/api/screener/0050`, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });
    const payload = (await response.json().catch(() => null)) as ScreenerPayload | { error?: string } | null;
    if (!response.ok && response.status !== 202) {
      throw new Error(payload && "error" in payload && payload.error ? payload.error : "0050 雷達暫時無法使用。");
    }
    if (!payload || !("status" in payload) || !["ready", "building"].includes(payload.status)) {
      throw new Error("0050 雷達回傳的資料格式不正確。");
    }
    return payload as ScreenerPayload;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("0050 雷達更新超過 60 秒，請稍後重新整理。");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function fetchStrategyBacktest(code: string, periodDays: number): Promise<BacktestPayload> {
  const normalizedCode = normalizeStockCode(code);
  if (!isSupportedStockCode(normalizedCode)) {
    throw new Error("請輸入正確的上市／上櫃股票或 ETF 代碼。");
  }
  const normalizedPeriod = Math.min(120, Math.max(20, Math.trunc(periodDays || 60)));
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 60_000);
  try {
    const response = await fetch(`${signalApiBaseUrl()}/api/simulator/backtest`, {
      method: "POST",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: normalizedCode, periodDays: normalizedPeriod }),
      signal: controller.signal,
    });
    const payload = (await response.json().catch(() => null)) as BacktestPayload | { error?: string } | null;
    if (!response.ok) {
      throw new Error(payload && "error" in payload && payload.error ? payload.error : "策略歷史回測服務暫時無法使用。");
    }
    if (!payload || !("result" in payload) || !Array.isArray(payload.result.equityCurve)) {
      throw new Error("策略歷史回測服務回傳的資料格式不正確。");
    }
    return payload;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("策略歷史回測超過 60 秒，請稍後重新嘗試。");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}
