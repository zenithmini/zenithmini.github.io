export type DailyBar = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  turnover: number;
  transactions: number;
};

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

type IndicatorSeries = {
  ma7: Array<number | null>;
  ma25: Array<number | null>;
  ma99: Array<number | null>;
  rsi14: Array<number | null>;
  k: Array<number | null>;
  d: Array<number | null>;
  macd: Array<number | null>;
  macdSignal: Array<number | null>;
  macdHistogram: Array<number | null>;
  atr14: Array<number | null>;
  volumeMa20: Array<number | null>;
};

export const normalizeStockCode = (value: string) =>
  value.trim().toUpperCase().replace(/[^0-9A-Z]/g, "").slice(0, 6);

export const isSupportedStockCode = (value: string) =>
  /^(?:\d{4,6}|\d{4,5}[A-Z])$/.test(normalizeStockCode(value));

const formatQueryMonth = (date: Date) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}${month}01`;
};

const monthQueries = (count: number) => {
  const now = new Date();
  return Array.from({ length: count }, (_, index) =>
    formatQueryMonth(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - index, 1))),
  );
};

const parseNumber = (value: unknown) => {
  if (typeof value === "number") return value;
  const normalized = String(value ?? "")
    .replaceAll(",", "")
    .replace(/[+\s]/g, "")
    .replace("X", "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

const parseRocDate = (value: string) => {
  const [rocYear, month, day] = value.split("/").map(Number);
  if (!rocYear || !month || !day) return "";
  return `${rocYear + 1911}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

const extractName = (title: string, code: string) => {
  const match = title.match(new RegExp(`${code}\\s+(.+?)\\s+各日`));
  return match?.[1]?.trim() || code;
};

const formatIsoDate = (date: Date) =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;

const finMindDateRange = () => {
  const now = new Date();
  return {
    startDate: formatIsoDate(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 12, 1))),
    endDate: new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" }),
  };
};

async function fetchFinMindDailyBars(dataId: string): Promise<DailyBar[]> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15_000);
  try {
    const { startDate, endDate } = finMindDateRange();
    const endpoint = new URL("https://api.finmindtrade.com/api/v4/data");
    endpoint.searchParams.set("dataset", "TaiwanStockPrice");
    endpoint.searchParams.set("data_id", dataId);
    endpoint.searchParams.set("start_date", startDate);
    endpoint.searchParams.set("end_date", endDate);
    const response = await fetch(endpoint, { cache: "no-store", signal: controller.signal });
    if (!response.ok) throw new Error(`FinMind HTTP ${response.status}`);
    const payload = (await response.json()) as {
      status?: number;
      data?: Array<Record<string, unknown>>;
    };
    if (payload.status !== 200 || !Array.isArray(payload.data)) {
      throw new Error("FinMind 未回傳有效日線資料");
    }
    return payload.data
      .map((row) => ({
        date: String(row.date ?? ""),
        open: parseNumber(row.open),
        high: parseNumber(row.max),
        low: parseNumber(row.min),
        close: parseNumber(row.close),
        volume: parseNumber(row.Trading_Volume) || 0,
        turnover: parseNumber(row.Trading_money) || 0,
        transactions: parseNumber(row.Trading_turnover) || 0,
      }))
      .filter(
        (bar) =>
          /^\d{4}-\d{2}-\d{2}$/.test(bar.date) &&
          [bar.open, bar.high, bar.low, bar.close].every(Number.isFinite),
      )
      .sort((a, b) => a.date.localeCompare(b.date));
  } finally {
    window.clearTimeout(timeout);
  }
}

async function fetchFinMindStockName(code: string): Promise<string> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 10_000);
  try {
    const endpoint = new URL("https://api.finmindtrade.com/api/v4/data");
    endpoint.searchParams.set("dataset", "TaiwanStockInfo");
    endpoint.searchParams.set("data_id", code);
    const response = await fetch(endpoint, { cache: "no-store", signal: controller.signal });
    if (!response.ok) return code;
    const payload = (await response.json()) as {
      data?: Array<{ stock_name?: string }>;
    };
    return payload.data?.at(-1)?.stock_name?.trim() || code;
  } catch {
    return code;
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function fetchTwseDailyBars(
  code: string,
  onProgress?: (completed: number, total: number) => void,
): Promise<{ name: string; bars: DailyBar[] }> {
  const normalizedCode = normalizeStockCode(code);
  if (!isSupportedStockCode(normalizedCode)) {
    throw new Error("請輸入 4–6 碼的上市股票或 ETF 代碼，例如 0050、2330、00403A。");
  }

  let finMindData: { name: string; bars: DailyBar[] } | null = null;
  try {
    const finMindBars = await fetchFinMindDailyBars(normalizedCode);
    onProgress?.(1, 2);
    const finMindName = await fetchFinMindStockName(normalizedCode);
    onProgress?.(2, 2);
    finMindData = { name: finMindName, bars: finMindBars };
  } catch {
    // FinMind is the GitHub Pages-friendly source; TWSE remains the fallback.
  }

  if (finMindData?.bars.length) {
    if (finMindData.bars.length >= 40) return finMindData;
    throw new Error(
      `${finMindData.name}（${normalizedCode}）目前只有 ${finMindData.bars.length} 個交易日資料，` +
        "尚不足以建立可靠的費波那契波段；累積至少 40 個交易日後再分析。",
    );
  }

  const queries = monthQueries(10);
  const collected: DailyBar[] = [];
  let stockName = normalizedCode;
  let completed = 0;

  for (let start = 0; start < queries.length; start += 3) {
    const batch = queries.slice(start, start + 3);
    const responses = await Promise.all(
      batch.map(async (month) => {
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 8_000);
        try {
          const endpoint = new URL("https://www.twse.com.tw/exchangeReport/STOCK_DAY");
          endpoint.searchParams.set("response", "json");
          endpoint.searchParams.set("date", month);
          endpoint.searchParams.set("stockNo", normalizedCode);
          const response = await fetch(endpoint, { cache: "no-store", signal: controller.signal });
          if (!response.ok) return null;
          return response.json() as Promise<{
            stat?: string;
            title?: string;
            data?: unknown[][];
          }>;
        } catch {
          return null;
        } finally {
          window.clearTimeout(timeout);
        }
      }),
    );

    for (const payload of responses) {
      completed += 1;
      onProgress?.(completed, queries.length);
      if (!payload) continue;
      if (payload.title) stockName = extractName(payload.title, normalizedCode);
      if (!Array.isArray(payload.data)) continue;

      for (const row of payload.data) {
        const date = parseRocDate(String(row[0] ?? ""));
        const open = parseNumber(row[3]);
        const high = parseNumber(row[4]);
        const low = parseNumber(row[5]);
        const close = parseNumber(row[6]);
        if (!date || ![open, high, low, close].every(Number.isFinite)) continue;
        collected.push({
          date,
          volume: parseNumber(row[1]) || 0,
          turnover: parseNumber(row[2]) || 0,
          open,
          high,
          low,
          close,
          transactions: parseNumber(row[8]) || 0,
        });
      }
    }
  }

  const deduplicated = Array.from(new Map(collected.map((bar) => [bar.date, bar])).values()).sort((a, b) =>
    a.date.localeCompare(b.date),
  );

  if (deduplicated.length < 40) {
    throw new Error(
      deduplicated.length === 0
        ? "找不到資料。請確認代碼屬於證交所上市股票或 ETF；上櫃股票目前尚未支援。"
        : `只有 ${deduplicated.length} 個交易日資料，尚不足以建立可靠的費波那契波段。`,
    );
  }

  return { name: stockName, bars: deduplicated };
}

export async function fetchTaiexDailyBars(
  onProgress?: (completed: number, total: number) => void,
): Promise<DailyBar[]> {
  try {
    const finMindBars = await fetchFinMindDailyBars("TAIEX");
    onProgress?.(1, 1);
    if (finMindBars.length >= 120) return finMindBars;
  } catch {
    // Fall back to the official TWSE endpoint when it is reachable.
  }

  const queries = monthQueries(10);
  const collected: DailyBar[] = [];
  let completed = 0;

  for (let start = 0; start < queries.length; start += 3) {
    const batch = queries.slice(start, start + 3);
    const responses = await Promise.all(
      batch.map(async (month) => {
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 8_000);
        try {
          const endpoint = new URL("https://www.twse.com.tw/rwd/zh/TAIEX/MI_5MINS_HIST");
          endpoint.searchParams.set("response", "json");
          endpoint.searchParams.set("date", month);
          const response = await fetch(endpoint, { cache: "no-store", signal: controller.signal });
          if (!response.ok) return null;
          return response.json() as Promise<{ data?: unknown[][] }>;
        } catch {
          return null;
        } finally {
          window.clearTimeout(timeout);
        }
      }),
    );

    for (const payload of responses) {
      completed += 1;
      onProgress?.(completed, queries.length);
      if (!Array.isArray(payload?.data)) continue;
      for (const row of payload.data) {
        const date = parseRocDate(String(row[0] ?? ""));
        const open = parseNumber(row[1]);
        const high = parseNumber(row[2]);
        const low = parseNumber(row[3]);
        const close = parseNumber(row[4]);
        if (!date || ![open, high, low, close].every(Number.isFinite)) continue;
        collected.push({
          date,
          open,
          high,
          low,
          close,
          volume: 0,
          turnover: 0,
          transactions: 0,
        });
      }
    }
  }

  const deduplicated = Array.from(new Map(collected.map((bar) => [bar.date, bar])).values()).sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  if (deduplicated.length < 120) {
    throw new Error("加權指數資料不足，無法先判斷台股大盤環境；本次不提供個股進場訊號。");
  }
  return deduplicated;
}

const sma = (values: number[], period: number) => {
  const result: Array<number | null> = Array(values.length).fill(null);
  let sum = 0;
  for (let index = 0; index < values.length; index += 1) {
    sum += values[index];
    if (index >= period) sum -= values[index - period];
    if (index >= period - 1) result[index] = sum / period;
  }
  return result;
};

const ema = (values: number[], period: number) => {
  const result: Array<number | null> = Array(values.length).fill(null);
  if (!values.length) return result;
  const multiplier = 2 / (period + 1);
  let current = values[0];
  result[0] = current;
  for (let index = 1; index < values.length; index += 1) {
    current = values[index] * multiplier + current * (1 - multiplier);
    result[index] = current;
  }
  return result;
};

const rsi = (values: number[], period: number) => {
  const result: Array<number | null> = Array(values.length).fill(null);
  if (values.length <= period) return result;
  let gains = 0;
  let losses = 0;
  for (let index = 1; index <= period; index += 1) {
    const change = values[index] - values[index - 1];
    gains += Math.max(change, 0);
    losses += Math.max(-change, 0);
  }
  let averageGain = gains / period;
  let averageLoss = losses / period;
  result[period] = averageLoss === 0 ? 100 : 100 - 100 / (1 + averageGain / averageLoss);
  for (let index = period + 1; index < values.length; index += 1) {
    const change = values[index] - values[index - 1];
    averageGain = (averageGain * (period - 1) + Math.max(change, 0)) / period;
    averageLoss = (averageLoss * (period - 1) + Math.max(-change, 0)) / period;
    result[index] = averageLoss === 0 ? 100 : 100 - 100 / (1 + averageGain / averageLoss);
  }
  return result;
};

const atr = (bars: DailyBar[], period: number) => {
  const result: Array<number | null> = Array(bars.length).fill(null);
  if (bars.length <= period) return result;
  const trueRanges = bars.map((bar, index) => {
    if (index === 0) return bar.high - bar.low;
    return Math.max(
      bar.high - bar.low,
      Math.abs(bar.high - bars[index - 1].close),
      Math.abs(bar.low - bars[index - 1].close),
    );
  });
  let current = trueRanges.slice(1, period + 1).reduce((sum, value) => sum + value, 0) / period;
  result[period] = current;
  for (let index = period + 1; index < bars.length; index += 1) {
    current = (current * (period - 1) + trueRanges[index]) / period;
    result[index] = current;
  }
  return result;
};

const stochastic = (bars: DailyBar[], period = 14) => {
  const k: Array<number | null> = Array(bars.length).fill(null);
  const d: Array<number | null> = Array(bars.length).fill(null);
  let previousK = 50;
  let previousD = 50;
  for (let index = period - 1; index < bars.length; index += 1) {
    const window = bars.slice(index - period + 1, index + 1);
    const highest = Math.max(...window.map((bar) => bar.high));
    const lowest = Math.min(...window.map((bar) => bar.low));
    const rsv = highest === lowest ? 50 : ((bars[index].close - lowest) / (highest - lowest)) * 100;
    previousK = (previousK * 2 + rsv) / 3;
    previousD = (previousD * 2 + previousK) / 3;
    k[index] = previousK;
    d[index] = previousD;
  }
  return { k, d };
};

const calculateIndicators = (bars: DailyBar[]): IndicatorSeries => {
  const closes = bars.map((bar) => bar.close);
  const volumes = bars.map((bar) => bar.volume);
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  const macd = closes.map((_, index) => (ema12[index] ?? 0) - (ema26[index] ?? 0));
  const macdSignal = ema(macd, 9);
  const macdHistogram = macd.map((value, index) => value - (macdSignal[index] ?? 0));
  const kd = stochastic(bars);
  return {
    ma7: sma(closes, 7),
    ma25: sma(closes, 25),
    ma99: sma(closes, 99),
    rsi14: rsi(closes, 14),
    k: kd.k,
    d: kd.d,
    macd,
    macdSignal,
    macdHistogram,
    atr14: atr(bars, 14),
    volumeMa20: sma(volumes, 20),
  };
};

const tickSize = (price: number) => {
  if (price < 10) return 0.01;
  if (price < 50) return 0.05;
  if (price < 100) return 0.1;
  if (price < 500) return 0.5;
  if (price < 1000) return 1;
  return 5;
};

const roundToTick = (price: number, direction: "up" | "down") => {
  const tick = tickSize(price);
  const scaled = price / tick;
  return (direction === "up" ? Math.ceil(scaled) : Math.floor(scaled)) * tick;
};

const formatPrice = (value: number) =>
  new Intl.NumberFormat("zh-TW", { maximumFractionDigits: value < 50 ? 2 : 1 }).format(value);

export function analyzeFibonacci(code: string, name: string, bars: DailyBar[]): FibonacciAnalysis {
  if (bars.length < 40) throw new Error("至少需要 40 個交易日資料才能建立費波那契波段。");

  const windowBars = bars.slice(-120);
  const lowIndex = windowBars.reduce(
    (best, bar, index) => (bar.low < windowBars[best].low ? index : best),
    0,
  );
  const highIndex = windowBars.reduce(
    (best, bar, index) => (bar.high > windowBars[best].high ? index : best),
    0,
  );
  const swingLow = { date: windowBars[lowIndex].date, price: windowBars[lowIndex].low };
  const swingHigh = { date: windowBars[highIndex].date, price: windowBars[highIndex].high };
  const priceRange = swingHigh.price - swingLow.price;
  if (!(priceRange > 0)) throw new Error("波段高低點相同，暫時無法建立費波那契區間。");

  const latest = windowBars.at(-1)!;
  const direction: FibonacciAnalysis["direction"] =
    lowIndex === highIndex
      ? latest.close >= (swingHigh.price + swingLow.price) / 2
        ? "up"
        : "down"
      : lowIndex < highIndex
        ? "up"
        : "down";
  const retracementRatios = [0.236, 0.382, 0.5, 0.618, 0.786];
  const extensionRatios = [1.272, 1.618, 2];
  const retracements = retracementRatios.map((ratio) => ({
    ratio,
    label: `${(ratio * 100).toFixed(ratio === 0.5 ? 0 : 1)}%`,
    price:
      direction === "up"
        ? swingHigh.price - priceRange * ratio
        : swingLow.price + priceRange * ratio,
  }));
  const extensions = extensionRatios.map((ratio) => ({
    ratio,
    label: ratio.toFixed(ratio === 2 ? 1 : 3),
    price:
      direction === "up"
        ? swingLow.price + priceRange * ratio
        : Math.max(0, swingHigh.price - priceRange * ratio),
  }));
  const retracementPercent =
    direction === "up"
      ? ((swingHigh.price - latest.close) / priceRange) * 100
      : ((latest.close - swingLow.price) / priceRange) * 100;

  let zoneLabel = "關鍵區間";
  let summary = "價格正處在費波那契關鍵區，需搭配量價與轉強訊號確認。";
  if (direction === "up") {
    if (latest.close > swingHigh.price) {
      zoneLabel = "突破擴展區";
      summary = "價格已突破波段高點，可依序觀察 1.272、1.618 與 2.0 擴展目標，並分段移動停利。";
    } else if (retracementPercent <= 23.6) {
      zoneLabel = "強勢淺回檔";
      summary = "回檔尚未超過 23.6%，走勢偏強；不追價，等待短線轉強或回測支撐。";
    } else if (retracementPercent <= 38.2) {
      zoneLabel = "健康回檔區";
      summary = "價格位於 23.6%–38.2% 回檔帶，是強勢多頭常見的第一層承接區。";
    } else if (retracementPercent <= 61.8) {
      zoneLabel = "核心承接區";
      summary = "價格進入 38.2%–61.8% 核心回檔帶，應等待止跌與轉強，不能只因碰線就買進。";
    } else if (retracementPercent <= 78.6) {
      zoneLabel = "深度回檔區";
      summary = "回檔已超過 61.8%，波段結構轉弱；僅列入觀察，不宜預設一定反彈。";
    } else {
      zoneLabel = "波段失守風險";
      summary = "價格接近或跌破 78.6% 回檔，原上升波段可能失效，應優先控制風險。";
    }
  } else if (latest.close < swingLow.price) {
    zoneLabel = "下跌擴展區";
    summary = "價格跌破波段低點，1.272、1.618 與 2.0 為下行風險參考，不作為接刀依據。";
  } else if (retracementPercent <= 38.2) {
    zoneLabel = "弱勢反彈區";
    summary = "下降波段僅出現淺幅反彈，上方費波那契價位仍視為壓力，不提供多方進場訊號。";
  } else if (retracementPercent <= 61.8) {
    zoneLabel = "主要反壓區";
    summary = "反彈進入 38.2%–61.8% 壓力帶，需先確認趨勢反轉，不能把反彈直接當成多頭。";
  } else {
    zoneLabel = "深度反彈區";
    summary = "反彈已收復大部分跌幅，但仍需站回波段高點與長期均線，才算完成結構反轉。";
  }

  const priceLevels = [
    swingLow.price,
    swingHigh.price,
    ...retracements.map((level) => level.price),
    ...extensions.map((level) => level.price),
  ];
  const nearestSupport = priceLevels
    .filter((price) => price < latest.close)
    .sort((a, b) => b - a)[0] ?? null;
  const nearestResistance = priceLevels
    .filter((price) => price > latest.close)
    .sort((a, b) => a - b)[0] ?? null;

  return {
    code,
    name,
    dataDate: latest.date,
    barsCount: bars.length,
    lookback: windowBars.length,
    direction,
    directionLabel: direction === "up" ? "上升波段" : "下降波段",
    currentPrice: latest.close,
    swingLow,
    swingHigh,
    retracementPercent,
    zoneLabel,
    summary,
    retracements,
    extensions,
    nearestSupport,
    nearestResistance,
  };
}

const finite = (value: number | null | undefined, label: string) => {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    throw new Error(`無法計算 ${label}，請稍後重試。`);
  }
  return value;
};

export function analyzeMarketRegime(bars: DailyBar[]): MarketRegime {
  if (bars.length < 120) throw new Error("至少需要 120 個交易日才能判斷大盤環境。");
  const closes = bars.map((bar) => bar.close);
  const ma25Series = sma(closes, 25);
  const ma99Series = sma(closes, 99);
  const index = bars.length - 1;
  const latest = bars[index];
  const previous = bars[index - 1];
  const ma25 = finite(ma25Series[index], "加權指數 MA25");
  const ma99 = finite(ma99Series[index], "加權指數 MA99");
  const ma99Past = finite(ma99Series[index - 20], "加權指數 MA99 斜率");
  const ma99Slope20Percent = ((ma99 - ma99Past) / ma99Past) * 100;
  const aboveLong = latest.close > ma99;
  const midAboveLong = ma25 > ma99;
  const longSlopeUp = ma99Slope20Percent > 0;
  const conditions = [
    {
      id: "market-price",
      label: "指數站上 MA99",
      pass: aboveLong,
      value: `${formatPrice(latest.close)} ${aboveLong ? ">" : "≤"} ${formatPrice(ma99)}`,
    },
    {
      id: "market-order",
      label: "MA25 高於 MA99",
      pass: midAboveLong,
      value: `${formatPrice(ma25)} ${midAboveLong ? ">" : "≤"} ${formatPrice(ma99)}`,
    },
    {
      id: "market-slope",
      label: "MA99 二十日向上",
      pass: longSlopeUp,
      value: `${ma99Slope20Percent >= 0 ? "+" : ""}${ma99Slope20Percent.toFixed(2)}%`,
    },
  ];

  let state: MarketRegime["state"] = "neutral";
  let label: MarketRegime["label"] = "中性降部位";
  let summary = "大盤條件多空交錯；個股即使觸發，也只允許半部位試單。";
  let positionMultiplier = 0.5;

  if (aboveLong && midAboveLong && longSlopeUp) {
    state = "bull";
    label = "多頭可操作";
    summary = "加權指數的價格、均線排列與長期斜率均為正向，可進入個股分析。";
    positionMultiplier = 1;
  } else if (!aboveLong && !midAboveLong && !longSlopeUp) {
    state = "bear";
    label = "空頭停止進場";
    summary = "加權指數三項大盤條件均未通過，本策略停止所有新的多方進場。";
    positionMultiplier = 0;
  }

  return {
    state,
    label,
    summary,
    dataDate: latest.date,
    close: latest.close,
    changePercent: previous.close ? ((latest.close - previous.close) / previous.close) * 100 : 0,
    ma25,
    ma99,
    ma99Slope20Percent,
    positionMultiplier,
    conditions,
  };
}

export function analyzeBars(
  code: string,
  name: string,
  bars: DailyBar[],
  settings: StrategySettings,
  market: MarketRegime,
): AnalysisResult {
  if (bars.length < 120) throw new Error("至少需要 120 個交易日資料才能分析。");
  const indicators = calculateIndicators(bars);
  const index = bars.length - 1;
  const latest = bars[index];
  const previous = bars[index - 1];
  const ma7 = finite(indicators.ma7[index], "MA7");
  const ma25 = finite(indicators.ma25[index], "MA25");
  const ma99 = finite(indicators.ma99[index], "MA99");
  const ma99Past = finite(indicators.ma99[index - 5], "MA99 斜率");
  const rsi14 = finite(indicators.rsi14[index], "RSI14");
  const k = finite(indicators.k[index], "KD-K");
  const d = finite(indicators.d[index], "KD-D");
  const macd = finite(indicators.macd[index], "MACD");
  const macdSignal = finite(indicators.macdSignal[index], "MACD 訊號線");
  const macdHistogram = finite(indicators.macdHistogram[index], "MACD 柱狀體");
  const previousMacdHistogram = finite(indicators.macdHistogram[index - 1], "前一日 MACD 柱狀體");
  const atr14 = finite(indicators.atr14[index], "ATR14");
  const volumeMa20 = finite(indicators.volumeMa20[index], "20 日均量");
  const distanceToMa25Percent = ((latest.close - ma25) / ma25) * 100;
  const ma99Slope5Percent = ((ma99 - ma99Past) / ma99Past) * 100;
  const recentHigh = Math.max(...bars.slice(-21, -1).map((bar) => bar.high));

  const trendPass = ma25 > ma99 && ma99Slope5Percent > -0.25;
  const longPricePass = latest.close > ma99;
  const pullbackPass =
    Math.abs(latest.close - ma25) <= atr14 * 1.2 ||
    (rsi14 >= 42 && rsi14 <= 58) ||
    k <= 35;
  const turnUpPass =
    latest.close > ma7 && macdHistogram > previousMacdHistogram && (k > d || latest.close > previous.close);
  const breakoutPass = latest.close >= recentHigh && latest.volume >= volumeMa20 * 1.3 && rsi14 <= 72;
  const setupPass = (pullbackPass && turnUpPass) || breakoutPass;
  const noChasePass =
    rsi14 < 72 &&
    latest.close <= ma25 + atr14 * (breakoutPass ? 2.5 : 1.8) &&
    latest.close <= ma99 * 1.25;
  const liquidityPass = volumeMa20 >= 200_000;

  const rules: RuleResult[] = [
    {
      id: "trend",
      label: "中長期趨勢",
      pass: trendPass,
      value: `MA25 ${ma25 > ma99 ? ">" : "≤"} MA99；MA99 五日 ${ma99Slope5Percent >= 0 ? "+" : ""}${ma99Slope5Percent.toFixed(2)}%`,
      explanation: "只在中期均線高於長期均線，且長期均線沒有明顯下彎時找買點。",
      weight: 20,
    },
    {
      id: "structure",
      label: "價格結構",
      pass: longPricePass,
      value: `收盤 ${formatPrice(latest.close)}；MA99 ${formatPrice(ma99)}`,
      explanation: "價格必須站在 MA99 之上，避免在空頭結構中搶反彈。",
      weight: 15,
    },
    {
      id: "pullback",
      label: "回檔區間",
      pass: pullbackPass,
      value: `距 MA25 ${distanceToMa25Percent >= 0 ? "+" : ""}${distanceToMa25Percent.toFixed(2)}%；RSI ${rsi14.toFixed(1)}`,
      explanation: "靠近 MA25、RSI 回到中性或 KD 進入低檔，至少符合一項。",
      weight: 15,
    },
    {
      id: "trigger",
      label: "轉強觸發",
      pass: setupPass,
      value: breakoutPass ? "放量突破 20 日高點" : `收盤 ${latest.close > ma7 ? ">" : "≤"} MA7；MACD 柱 ${macdHistogram > previousMacdHistogram ? "增強" : "轉弱"}`,
      explanation: "回檔後需重新站上短均線且動能改善；放量突破可作為替代觸發。",
      weight: 25,
    },
    {
      id: "chase",
      label: "禁止追價",
      pass: noChasePass,
      value: `RSI ${rsi14.toFixed(1)}；距 MA25 ${distanceToMa25Percent >= 0 ? "+" : ""}${distanceToMa25Percent.toFixed(2)}%`,
      explanation: "RSI 過熱、偏離 MA25 太遠或相對 MA99 漲幅過大時不追。",
      weight: 15,
    },
    {
      id: "liquidity",
      label: "流動性",
      pass: liquidityPass,
      value: `20 日均量 ${Math.round(volumeMa20).toLocaleString("zh-TW")} 股`,
      explanation: "低於每日 20 萬股時，滑價與無法停損的風險明顯增加。",
      weight: 10,
    },
  ];

  const suspiciousJumps = bars.slice(-100).filter((bar, position, recentBars) => {
    if (position === 0) return false;
    return Math.abs(bar.close / recentBars[position - 1].close - 1) > 0.15;
  });
  const warnings: string[] = [];
  if (suspiciousJumps.length) {
    warnings.push(
      `近 100 個交易日出現 ${suspiciousJumps.length} 次超過 15% 的價格跳空，可能涉及除權息、分割或資料未還原。`,
    );
  }
  if (latest.date !== new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" })) {
    warnings.push(`分析使用 ${latest.date} 收盤資料；盤中不會即時更新。`);
  }
  warnings.push("證交所提供的是原始成交價；除權息或分割後，請另以還原股價交叉確認。");

  const score = rules.reduce((sum, rule) => sum + (rule.pass ? rule.weight : 0), 0);
  const recentLow = Math.min(...bars.slice(-10).map((bar) => bar.low));
  const rawStop = Math.max(recentLow - tickSize(recentLow), latest.close - atr14 * 2);
  const stop = roundToTick(rawStop, "down");
  const riskDistance = latest.close - stop;
  const stopPercent = (riskDistance / latest.close) * 100;
  const target = roundToTick(latest.close + riskDistance * 3, "up");
  const feeRate = 0.001425;
  const taxRate = code.startsWith("00") ? 0.001 : 0.003;
  const riskPerShare = riskDistance + latest.close * feeRate + stop * (feeRate + taxRate);
  const capital = Math.max(0, settings.capital || 0);
  const riskBudget = capital * Math.max(0, settings.riskPercent || 0) * 0.01;
  const exposureBudget = capital * Math.max(0, settings.maxExposurePercent || 0) * 0.01;
  let shares = Math.max(0, Math.floor(Math.min(riskBudget / riskPerShare, exposureBudget / latest.close)));
  if (!settings.allowOddLot) shares = Math.floor(shares / 1000) * 1000;
  const riskTooWide = stopPercent <= 0 || stopPercent > 8;
  if (riskTooWide) shares = 0;
  shares = Math.floor(shares * market.positionMultiplier);
  if (!settings.allowOddLot) shares = Math.floor(shares / 1000) * 1000;

  let verdict: AnalysisResult["verdict"] = "等待轉強";
  let verdictKey: AnalysisResult["verdictKey"] = "wait";
  let summary = "趨勢仍可觀察，但轉強條件尚未完整，先把資金留在場外。";

  if (suspiciousJumps.length) {
    verdict = "資料需調整";
    verdictKey = "avoid";
    summary = "原始價格可能受除權息或分割影響，技術指標失真前不應直接下單。";
  } else if (!trendPass || !longPricePass) {
    verdict = "趨勢不符";
    verdictKey = "avoid";
    summary = "MA99 趨勢或價格結構未通過，這不是本策略要承擔的行情。";
  } else if (!liquidityPass) {
    verdict = "流動性不足";
    verdictKey = "avoid";
    summary = "成交量不足可能放大滑價，建議跳過或改用更低的部位。";
  } else if (!noChasePass) {
    verdict = "禁止追價";
    verdictKey = "avoid";
    summary = "趨勢雖強，但價格偏離合理區間；等待回檔比追高更符合風險報酬。";
  } else if (riskTooWide) {
    verdict = "風險過大";
    verdictKey = "avoid";
    summary = "依 2ATR 與近期低點計算的停損距離超過 8%，本次不進場。";
  } else if (setupPass) {
    verdict = "可分批進場";
    verdictKey = "enter";
    summary = "趨勢、回檔／突破與轉強條件已通過；仍應等下一交易日實際開盤價重算部位。";
  } else if (!pullbackPass || latest.close > ma25 + atr14) {
    verdict = "等待回檔";
    verdictKey = "wait";
    summary = "趨勢正向，但價格不在理想回檔區；等靠近 MA25 或動能降溫。";
  }

  if (market.state === "bear") {
    verdict = "大盤不佳";
    verdictKey = "avoid";
    summary = "個股條件不能取代大盤風險；加權指數處於空頭環境，本次停止新的多方進場。";
  } else if (market.state === "neutral" && verdict === "可分批進場") {
    verdict = "可小量試單";
    verdictKey = "wait";
    summary = "個股條件已通過，但加權指數仍是中性環境；部位自動減半，不追價。";
  }

  const changePercent = previous.close ? ((latest.close - previous.close) / previous.close) * 100 : 0;

  return {
    code,
    name,
    dataDate: latest.date,
    barsCount: bars.length,
    verdict,
    verdictKey,
    summary,
    score,
    price: latest.close,
    changePercent,
    metrics: {
      ma7,
      ma25,
      ma99,
      rsi14,
      k,
      d,
      macd,
      macdSignal,
      macdHistogram,
      atr14,
      volume: latest.volume,
      volumeMa20,
      distanceToMa25Percent,
      ma99Slope5Percent,
    },
    rules,
    risk: {
      referenceEntry: latest.close,
      stop,
      target,
      riskPerShare,
      stopPercent,
      rewardRiskRatio: 3,
      shares,
      lots: Math.floor(shares / 1000),
      oddShares: shares % 1000,
      estimatedPosition: shares * latest.close,
      estimatedRisk: shares * riskPerShare,
      feeRate,
      taxRate,
    },
    chart: bars.slice(-75).map((bar, offset) => {
      const sourceIndex = bars.length - 75 + offset;
      return {
        date: bar.date,
        close: bar.close,
        ma25: indicators.ma25[sourceIndex] ?? null,
        ma99: indicators.ma99[sourceIndex] ?? null,
      };
    }),
    warnings,
    market,
  };
}
