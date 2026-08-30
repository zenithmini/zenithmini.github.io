"use client";

import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AnalysisResult,
  AnalysisPayload,
  BacktestResult,
  FibonacciAnalysis,
  MarketRegime,
  ScreenerItem,
  ScreenerSnapshot,
  StrategySettings,
  applyPositionSizing,
  fetchStockAnalysis,
  fetchStrategyBacktest,
  fetchTaiwan50Screener,
  isSupportedStockCode,
  normalizeStockCode,
} from "@/lib/strategy";

const DEFAULT_SETTINGS: StrategySettings = {
  capital: 1_000_000,
  riskPercent: 1,
  maxExposurePercent: 25,
  allowOddLot: true,
};

type HistoryItem = Pick<
  AnalysisResult,
  "code" | "name" | "dataDate" | "verdict" | "verdictKey" | "price" | "score"
> & { checkedAt?: string };

type HistoryRefreshState = {
  running: boolean;
  completed: number;
  total: number;
  failed: number;
};

const expectedLatestTradingDate = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value || 0);
  const date = new Date(Date.UTC(value("year"), value("month") - 1, value("day")));
  if (value("hour") < 18) date.setUTCDate(date.getUTCDate() - 1);
  while (date.getUTCDay() === 0 || date.getUTCDay() === 6) date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
};

const formatHistoryDate = (value: string) => {
  const [, month = "", day = ""] = value.split("-");
  return month && day ? `${Number(month)}/${Number(day)}` : value;
};

const formatPrice = (value: number) =>
  new Intl.NumberFormat("zh-TW", {
    minimumFractionDigits: value < 50 ? 2 : 1,
    maximumFractionDigits: value < 50 ? 2 : 1,
  }).format(value);

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("zh-TW", { style: "currency", currency: "TWD", maximumFractionDigits: 0 }).format(value);

type IconName = "search" | "star" | "shield" | "chart" | "check" | "alert" | "clock" | "menu" | "close" | "home" | "radar" | "simulator" | "trade" | "book" | "info" | "refresh";

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<typeof name, ReactNode> = {
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9Z"/>,
    shield: <><path d="M12 3 5 6v5c0 4.7 2.9 8.4 7 10 4.1-1.6 7-5.3 7-10V6Z"/><path d="m9.5 12 1.6 1.6 3.6-3.8"/></>,
    chart: <><path d="M4 19V5"/><path d="M4 19h16"/><path d="m7 15 4-4 3 2 5-6"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    alert: <><path d="M12 4 3.5 19h17Z"/><path d="M12 9v4"/><path d="M12 16h.01"/></>,
    clock: <><circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/></>,
    menu: <><path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/></>,
    close: <><path d="m6 6 12 12"/><path d="m18 6-12 12"/></>,
    home: <><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/></>,
    radar: <><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 12 18 6"/><path d="M12 2v2"/><path d="M22 12h-2"/></>,
    simulator: <><path d="M8 3h8"/><path d="M10 3v6l-5 9a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-9V3"/><path d="M8 15h8"/></>,
    trade: <><path d="M4 7h16v12H4Z"/><path d="M7 7V5h10v2"/><path d="M4 11h16"/><path d="M8 15h3"/></>,
    book: <><path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H11v17H7.5A3.5 3.5 0 0 0 4 22Z"/><path d="M20 5.5A3.5 3.5 0 0 0 16.5 2H13v17h3.5A3.5 3.5 0 0 1 20 22Z"/></>,
    info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><path d="M12 7h.01"/></>,
    refresh: <><path d="M20 6v5h-5"/><path d="M4 18v-5h5"/><path d="M18.2 9A7 7 0 0 0 6.1 6.4L4 8"/><path d="M5.8 15A7 7 0 0 0 17.9 17.6L20 16"/></>,
  };
  return (
    <svg aria-hidden="true" className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
}

type ViewMode = "analysis" | "screener" | "paper" | "simulator" | "guide";
type FontSize = "small" | "standard" | "large" | "extra-large";

const FONT_SIZE_OPTIONS: Array<{ value: FontSize; label: string }> = [
  { value: "small", label: "小" },
  { value: "standard", label: "標準" },
  { value: "large", label: "大" },
  { value: "extra-large", label: "特大" },
];

type BacktestHistoryItem = {
  result: BacktestResult;
  periodDays: number;
  savedAt: string;
};

type PaperPosition = { code: string; name: string; shares: number; averageCost: number; lastPrice: number; dataDate: string };
type PaperTrade = { id: string; side: "buy" | "sell"; code: string; name: string; shares: number; price: number; fee: number; tax: number; total: number; dataDate: string; createdAt: string };
type PaperAccount = { initialCapital: number; cash: number; positions: PaperPosition[]; trades: PaperTrade[] };
type PaperQuote = Pick<AnalysisResult, "code" | "name" | "price" | "dataDate"> & Partial<Pick<AnalysisResult, "verdict" | "verdictKey">>;

const DEFAULT_PAPER_ACCOUNT: PaperAccount = { initialCapital: 1_000_000, cash: 1_000_000, positions: [], trades: [] };

function TermTip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <details className="term-tip">
      <summary aria-label={`說明：${label}`}><Icon name="info" size={15} /></summary>
      <span>{children}</span>
    </details>
  );
}

function AdSenseUnit({ slot, label }: { slot: string; label: string }) {
  const adRef = useRef<HTMLModElement | null>(null);
  const [unfilled, setUnfilled] = useState(false);

  useEffect(() => {
    const ad = adRef.current;
    if (!ad) return;

    const updateStatus = () => {
      const status = ad.getAttribute("data-ad-status");
      if (status === "unfilled" || status === "unfill-optimized") setUnfilled(true);
    };
    const observer = new MutationObserver(updateStatus);
    observer.observe(ad, { attributes: true, attributeFilter: ["data-ad-status"] });

    const timer = window.setTimeout(() => {
      if (!ad.getAttribute("data-adsbygoogle-status")) {
        try {
          const adWindow = window as Window & { adsbygoogle?: Array<Record<string, unknown>> };
          (adWindow.adsbygoogle ||= []).push({});
        } catch (error) {
          console.warn("AdSense unit failed to initialize", error);
        }
      }
      updateStatus();
    }, 0);

    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, [slot]);

  if (unfilled) return null;

  return (
    <aside className="ad-placement" aria-label={label}>
      <span className="ad-placement-label">廣告</span>
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client="ca-pub-6042352419761579"
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </aside>
  );
}

function ScreenerStockCard({ item, onAnalyze }: { item: ScreenerItem; onAnalyze: (code: string) => void }) {
  return (
    <button className={`radar-stock radar-${item.category}`} type="button" onClick={() => onAnalyze(item.code)}>
      <span className="radar-stock-head">
        <span><strong>{item.code}</strong><small>{item.name}</small></span>
        <em>{item.score} 分</em>
      </span>
      <span className="radar-price">
        <strong>{formatPrice(item.price)}</strong>
        <small className={item.changePercent >= 0 ? "price-up" : "price-down"}>{item.changePercent >= 0 ? "+" : ""}{item.changePercent.toFixed(2)}%</small>
      </span>
      <span className="radar-reason"><b>為何列入：</b>{item.reason}</span>
      <span className="radar-action">查看完整分析 →</span>
    </button>
  );
}

function ScreenerGroup({
  title,
  explanation,
  items,
  onAnalyze,
}: {
  title: string;
  explanation: string;
  items: ScreenerItem[];
  onAnalyze: (code: string) => void;
}) {
  return (
    <section className="radar-group card">
      <div className="radar-group-heading">
        <div><h2>{title}</h2><p>{explanation}</p></div>
        <strong>{items.length}</strong>
      </div>
      {items.length ? (
        <div className="radar-stock-grid">
          {items.slice(0, 5).map((item) => <ScreenerStockCard item={item} key={item.code} onAnalyze={onAnalyze} />)}
        </div>
      ) : <p className="radar-empty">今天沒有符合這一類條件的成分股。</p>}
    </section>
  );
}

function StockChart({ result }: { result: AnalysisResult }) {
  const width = 760;
  const height = 270;
  const padding = { left: 20, right: 58, top: 22, bottom: 32 };
  const allValues = result.chart.flatMap((point) => [point.close, point.ma25, point.ma99]).filter((value): value is number => value !== null);
  const minimum = Math.min(...allValues);
  const maximum = Math.max(...allValues);
  const range = Math.max(maximum - minimum, maximum * 0.02);
  const lower = minimum - range * 0.08;
  const upper = maximum + range * 0.08;
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const x = (index: number) => padding.left + (index / Math.max(1, result.chart.length - 1)) * plotWidth;
  const y = (value: number) => padding.top + ((upper - value) / (upper - lower)) * plotHeight;
  const points = (key: "close" | "ma25" | "ma99") =>
    result.chart.map((point, index) => `${x(index).toFixed(1)},${y(point[key] ?? point.close).toFixed(1)}`).join(" ");
  const ticks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className="chart-wrap" role="img" aria-label={`${result.code} 最近 75 個交易日收盤價、MA25 與 MA99 趨勢圖`}>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        {ticks.map((tick) => {
          const tickY = padding.top + tick * plotHeight;
          const tickValue = upper - tick * (upper - lower);
          return (
            <g key={tick}>
              <line className="chart-grid" x1={padding.left} x2={width - padding.right} y1={tickY} y2={tickY} />
              <text className="chart-axis" x={width - padding.right + 8} y={tickY + 4}>{formatPrice(tickValue)}</text>
            </g>
          );
        })}
        <polyline className="chart-line chart-ma99" points={points("ma99")} />
        <polyline className="chart-line chart-ma25" points={points("ma25")} />
        <polyline className="chart-line chart-close" points={points("close")} />
        <text className="chart-date" x={padding.left} y={height - 8}>{result.chart[0]?.date.slice(5)}</text>
        <text className="chart-date" textAnchor="end" x={width - padding.right} y={height - 8}>{result.chart.at(-1)?.date.slice(5)}</text>
      </svg>
      <div className="chart-legend" aria-hidden="true">
        <span><i className="legend-close" />收盤</span>
        <span><i className="legend-ma25" />MA25</span>
        <span><i className="legend-ma99" />MA99</span>
      </div>
    </div>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
      {hint ? <small>{hint}</small> : null}
    </div>
  );
}

function EntryPlanCard({ result }: { result: AnalysisResult }) {
  const plan = result.entryPlan;
  const statusIcon = plan.state === "ready" ? "check" : plan.state === "blocked" ? "alert" : "clock";

  return (
    <section className={`entry-card card entry-${plan.state}`}>
      <div className="section-heading entry-heading">
        <div><span>建議入場價位</span><h2>回檔區間與突破確認</h2></div>
        <em><Icon name={statusIcon} size={16} />{plan.stateLabel}</em>
      </div>

      {plan.available && plan.zoneLow !== null && plan.zoneHigh !== null && plan.preferred !== null && plan.breakout !== null ? (
        <div className="entry-levels">
          <div className="entry-zone">
            <span>建議回檔區間</span>
            <strong>{formatPrice(plan.zoneLow)}～{formatPrice(plan.zoneHigh)}</strong>
            <small>{plan.basis}</small>
          </div>
          <div>
            <span>優先觀察價</span>
            <strong>{formatPrice(plan.preferred)}</strong>
            <small>{plan.distanceLabel}</small>
          </div>
          <div className="entry-breakout">
            <span>突破確認價</span>
            <strong>{formatPrice(plan.breakout)}</strong>
            <small>需同時符合放量與不過熱條件</small>
          </div>
        </div>
      ) : (
        <div className="entry-blocked-message">
          <Icon name="alert" size={21} />
          <div><strong>{plan.stateLabel}</strong><p>{plan.basis}</p></div>
        </div>
      )}

      <p className="entry-disclaimer">
        <Icon name="alert" size={16} />以上價位依歷史日線、均線、費波那契與 ATR 自動推算，可能受資料延遲、除權息、跳空及流動性影響；僅供研究與風險管理參考，不構成個別投資建議、招攬、報酬保證或代客操作。
      </p>
    </section>
  );
}

function MarketGate({ market }: { market: MarketRegime }) {
  return (
    <section className={`market-gate card market-${market.state}`}>
      <div className="market-gate-main">
        <span className="stage-label">第一步｜台股大盤</span>
        <div className="market-title-row">
          <div>
            <h2>加權指數</h2>
            <p>資料至 {market.dataDate}</p>
          </div>
          <div className="market-index">
            <strong>{formatPrice(market.close)}</strong>
            <small>{market.changePercent >= 0 ? "+" : ""}{market.changePercent.toFixed(2)}%</small>
          </div>
        </div>
        <div className="market-verdict"><i />{market.label}</div>
        <p className="market-summary">{market.summary}</p>
      </div>
      <div className="market-conditions">
        {market.conditions.map((condition) => (
          <article key={condition.id} className={condition.pass ? "condition-pass" : "condition-fail"}>
            <span><Icon name={condition.pass ? "check" : "alert"} size={16} />{condition.label}</span>
            <strong>{condition.value}</strong>
          </article>
        ))}
        <div className="market-position">
          <span>允許部位係數</span>
          <strong>{Math.round(market.positionMultiplier * 100)}%</strong>
        </div>
      </div>
    </section>
  );
}

function FibonacciCard({ fibonacci }: { fibonacci: FibonacciAnalysis }) {
  return (
    <section className={`fib-card card fib-${fibonacci.direction}`}>
      <div className="section-heading">
        <div><span>費波那契區間</span><h2>回檔支撐與擴展目標</h2></div>
        <small>近 {fibonacci.lookback} 個交易日・資料至 {fibonacci.dataDate}</small>
      </div>

      <div className="fib-overview">
        <div>
          <span className="fib-direction">{fibonacci.directionLabel}</span>
          <h3>{fibonacci.zoneLabel}</h3>
          <p>{fibonacci.summary}</p>
        </div>
        <div className="fib-nearest">
          <span>現價 {formatPrice(fibonacci.currentPrice)}</span>
          <dl>
            <div><dt>最近支撐</dt><dd>{fibonacci.nearestSupport === null ? "—" : formatPrice(fibonacci.nearestSupport)}</dd></div>
            <div><dt>最近壓力</dt><dd>{fibonacci.nearestResistance === null ? "—" : formatPrice(fibonacci.nearestResistance)}</dd></div>
          </dl>
        </div>
      </div>

      <div className="fib-anchors">
        <div><span>波段低點</span><strong>{formatPrice(fibonacci.swingLow.price)}</strong><small>{fibonacci.swingLow.date}</small></div>
        <div><span>波段高點</span><strong>{formatPrice(fibonacci.swingHigh.price)}</strong><small>{fibonacci.swingHigh.date}</small></div>
        <div><span>{fibonacci.direction === "up" ? "目前回檔" : "目前反彈"}</span><strong>{Math.max(0, fibonacci.retracementPercent).toFixed(1)}%</strong><small>相對本次波段</small></div>
      </div>

      <div className="fib-columns">
        <div className="fib-levels">
          <div className="fib-level-title"><span>{fibonacci.direction === "up" ? "回檔支撐" : "反彈壓力"}</span><small>23.6%～78.6%</small></div>
          {fibonacci.retracements.map((level) => (
            <div className="fib-level" key={level.label}>
              <span>{level.label}</span><strong>{formatPrice(level.price)}</strong>
            </div>
          ))}
        </div>
        <div className="fib-levels fib-extension-levels">
          <div className="fib-level-title"><span>{fibonacci.direction === "up" ? "突破目標" : "下行風險"}</span><small>擴展</small></div>
          {fibonacci.extensions.map((level) => (
            <div className="fib-level" key={level.label}>
              <span>{level.label}</span><strong>{formatPrice(level.price)}</strong>
            </div>
          ))}
        </div>
      </div>
      <p className="fib-note"><Icon name="alert" size={16} />費波那契是價格區間工具，不是單獨的買進訊號；仍以大盤、趨勢、量價與停損條件為主。</p>
    </section>
  );
}

function BacktestChart({ result }: { result: BacktestResult }) {
  const width = 760;
  const height = 230;
  const padding = { left: 18, right: 18, top: 20, bottom: 30 };
  const values = result.equityCurve.map((point) => point.equity);
  const minimum = Math.min(result.initialCapital, ...values);
  const maximum = Math.max(result.initialCapital, ...values);
  const range = Math.max(maximum - minimum, result.initialCapital * 0.01);
  const lower = minimum - range * 0.12;
  const upper = maximum + range * 0.12;
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const x = (index: number) => padding.left + (index / Math.max(1, values.length - 1)) * plotWidth;
  const y = (value: number) => padding.top + ((upper - value) / (upper - lower)) * plotHeight;
  const points = values.map((value, index) => `${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(" ");
  const baselineY = y(result.initialCapital);
  return (
    <div className="backtest-chart" role="img" aria-label={`${result.code} 策略歷史回測資產曲線`}>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <line className="backtest-baseline" x1={padding.left} x2={width - padding.right} y1={baselineY} y2={baselineY} />
        <polyline className="backtest-line" points={points} />
        <text x={padding.left} y={height - 8}>{result.startDate.slice(5)}</text>
        <text textAnchor="end" x={width - padding.right} y={height - 8}>{result.endDate.slice(5)}</text>
      </svg>
      <div><span><i />策略資產</span><span>虛線為初始100萬元</span></div>
    </div>
  );
}

export default function Home() {
  const [code, setCode] = useState("0050");
  const [settings, setSettings] = useState<StrategySettings>(DEFAULT_SETTINGS);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [fibonacci, setFibonacci] = useState<FibonacciAnalysis | null>(null);
  const [marketResult, setMarketResult] = useState<MarketRegime | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "partial" | "success" | "error">("idle");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  const [loadingStage, setLoadingStage] = useState("先判斷台股大盤");
  const [watchlist, setWatchlist] = useState<string[]>(["0050", "2330"]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyRefresh, setHistoryRefresh] = useState<HistoryRefreshState>({
    running: false,
    completed: 0,
    total: 0,
    failed: 0,
  });
  const [usingCache, setUsingCache] = useState(false);
  const [activeView, setActiveView] = useState<ViewMode>("analysis");
  const [fontSize, setFontSize] = useState<FontSize>("standard");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [screenerStatus, setScreenerStatus] = useState<"loading" | "building" | "ready" | "error">("loading");
  const [screenerSnapshot, setScreenerSnapshot] = useState<ScreenerSnapshot | null>(null);
  const [screenerProgress, setScreenerProgress] = useState({ completed: 0, total: 50, failed: 0 });
  const [screenerError, setScreenerError] = useState("");
  const [simulatorCode, setSimulatorCode] = useState("0050");
  const [simulatorPeriod, setSimulatorPeriod] = useState(60);
  const [simulatorStatus, setSimulatorStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [simulatorResult, setSimulatorResult] = useState<BacktestResult | null>(null);
  const [simulatorError, setSimulatorError] = useState("");
  const [backtestHistory, setBacktestHistory] = useState<BacktestHistoryItem[]>([]);
  const [paperAccount, setPaperAccount] = useState<PaperAccount>(DEFAULT_PAPER_ACCOUNT);
  const [paperCode, setPaperCode] = useState("0050");
  const [paperSide, setPaperSide] = useState<"buy" | "sell">("buy");
  const [paperShares, setPaperShares] = useState(1000);
  const [paperQuote, setPaperQuote] = useState<PaperQuote | null>(null);
  const [paperStatus, setPaperStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [paperMessage, setPaperMessage] = useState("");
  const [paperRefreshing, setPaperRefreshing] = useState(false);

  const loadScreener = useCallback(async () => {
    setScreenerStatus((current) => current === "building" ? "building" : "loading");
    setScreenerError("");
    try {
      const payload = await fetchTaiwan50Screener();
      if (payload.status === "ready") {
        setScreenerSnapshot(payload.snapshot);
        setScreenerStatus("ready");
      } else {
        setScreenerProgress(payload.progress);
        setScreenerStatus("building");
      }
    } catch (caught) {
      setScreenerStatus("error");
      setScreenerError(caught instanceof Error ? caught.message : "0050 雷達暫時無法使用。");
    }
  }, []);

  useEffect(() => {
    const restoreTimer = window.setTimeout(() => {
      try {
        const savedSettings = localStorage.getItem("tw-signal-settings");
        const savedWatchlist = localStorage.getItem("tw-signal-watchlist");
        const savedHistory = localStorage.getItem("tw-signal-history");
        const savedFontSize = localStorage.getItem("tw-signal-font-size") as FontSize | null;
        const savedBacktests = localStorage.getItem("tw-signal-backtests");
        const savedPaperAccount = localStorage.getItem("tw-signal-paper-account");
        if (savedSettings) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) });
        if (savedWatchlist) setWatchlist(JSON.parse(savedWatchlist));
        if (savedHistory) setHistory(JSON.parse(savedHistory));
        if (savedFontSize && FONT_SIZE_OPTIONS.some((option) => option.value === savedFontSize)) {
          setFontSize(savedFontSize);
        }
        if (savedBacktests) setBacktestHistory(JSON.parse(savedBacktests));
        if (savedPaperAccount) setPaperAccount({ ...DEFAULT_PAPER_ACCOUNT, ...JSON.parse(savedPaperAccount) });
      } catch {
        // Ignore malformed browser storage and keep safe defaults.
      }
    }, 0);
    const registerServiceWorker = () => {
      void navigator.serviceWorker.register(new URL("./sw.js", window.location.href).href);
    };
    if ("serviceWorker" in navigator) {
      if (document.readyState === "complete") registerServiceWorker();
      else window.addEventListener("load", registerServiceWorker, { once: true });
    }
    return () => {
      window.clearTimeout(restoreTimer);
      window.removeEventListener("load", registerServiceWorker);
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadScreener(), 0);
    return () => window.clearTimeout(timer);
  }, [loadScreener]);

  useEffect(() => {
    if (activeView !== "screener" || screenerStatus !== "building") return;
    const timer = window.setTimeout(() => void loadScreener(), 1_800);
    return () => window.clearTimeout(timer);
  }, [activeView, loadScreener, screenerStatus, screenerProgress.completed]);

  const normalizedCode = normalizeStockCode(code);
  const isStarred = watchlist.includes(normalizedCode);

  const runAnalysis = async (requestedCode = normalizedCode) => {
    const target = normalizeStockCode(requestedCode);
    setActiveView("analysis");
    setDrawerOpen(false);
    setCode(target);
    setStatus("loading");
    setResult(null);
    setFibonacci(null);
    setMarketResult(null);
    setError("");
    setProgress(0);
    setLoadingStage("伺服器先判斷大盤，再分析個股");
    setUsingCache(false);
    try {
      setProgress(15);
      const payload = await fetchStockAnalysis(target);
      setProgress(100);
      setMarketResult(payload.market);
      setFibonacci(payload.fibonacci);
      if (!payload.result) {
        setStatus("partial");
        setError(payload.notice || "資料期間不足，本次只顯示費波那契觀察區。");
        return;
      }
      const nextResult = applyPositionSizing(payload.result, settings);
      setResult(nextResult);
      setStatus("success");
      const nextHistory: HistoryItem[] = [
        {
          code: nextResult.code,
          name: nextResult.name,
          dataDate: nextResult.dataDate,
          verdict: nextResult.verdict,
          verdictKey: nextResult.verdictKey,
          price: nextResult.price,
          score: nextResult.score,
          checkedAt: new Date().toISOString(),
        },
        ...history.filter((item) => item.code !== target),
      ].slice(0, 20);
      setHistory(nextHistory);
      localStorage.setItem("tw-signal-history", JSON.stringify(nextHistory));
      localStorage.setItem(`tw-signal-cache-v4-${target}`, JSON.stringify({ savedAt: Date.now(), payload }));
    } catch (caught) {
      try {
        const cached = localStorage.getItem(`tw-signal-cache-v4-${target}`);
        if (cached) {
          const parsed = JSON.parse(cached) as { savedAt: number; payload: AnalysisPayload };
          setMarketResult(parsed.payload.market);
          setFibonacci(parsed.payload.fibonacci);
          if (!parsed.payload.result) throw caught;
          setResult(applyPositionSizing(parsed.payload.result, settings));
          setStatus("success");
          setUsingCache(true);
          setError("目前無法連到分析服務，以下為這台裝置上次成功分析的結果。");
          return;
        }
      } catch {
        // Fall through to the original error.
      }
      setStatus("error");
      setResult(null);
      setError(caught instanceof Error ? caught.message : "分析失敗，請稍後再試。");
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void runAnalysis();
  };

  const toggleWatchlist = () => {
    if (!isSupportedStockCode(normalizedCode)) return;
    const next = isStarred ? watchlist.filter((item) => item !== normalizedCode) : [normalizedCode, ...watchlist].slice(0, 12);
    setWatchlist(next);
    localStorage.setItem("tw-signal-watchlist", JSON.stringify(next));
  };

  const updateSettings = (next: StrategySettings) => {
    setSettings(next);
    localStorage.setItem("tw-signal-settings", JSON.stringify(next));
  };

  const refreshAllHistory = async () => {
    if (!history.length || historyRefresh.running) return;
    const original = [...history];
    const refreshed = [...original];
    let completed = 0;
    let failed = 0;
    setHistoryRefresh({ running: true, completed: 0, total: original.length, failed: 0 });

    for (let start = 0; start < original.length; start += 2) {
      const batch = original.slice(start, start + 2);
      const batchResults = await Promise.all(
        batch.map(async (item) => {
          try {
            const payload = await fetchStockAnalysis(item.code);
            if (!payload.result) throw new Error("資料期間不足");
            localStorage.setItem(
              `tw-signal-cache-v4-${item.code}`,
              JSON.stringify({ savedAt: Date.now(), payload }),
            );
            return {
              ok: true as const,
              item: {
                code: payload.result.code,
                name: payload.result.name,
                dataDate: payload.result.dataDate,
                verdict: payload.result.verdict,
                verdictKey: payload.result.verdictKey,
                price: payload.result.price,
                score: payload.result.score,
                checkedAt: new Date().toISOString(),
              } satisfies HistoryItem,
            };
          } catch {
            return { ok: false as const, item };
          }
        }),
      );

      batchResults.forEach((batchResult, offset) => {
        refreshed[start + offset] = batchResult.item;
        if (!batchResult.ok) failed += 1;
      });
      completed += batch.length;
      setHistory([...refreshed]);
      setHistoryRefresh({ running: true, completed, total: original.length, failed });
    }

    localStorage.setItem("tw-signal-history", JSON.stringify(refreshed));
    setHistoryRefresh({ running: false, completed, total: original.length, failed });
  };

  const runBacktest = async (requestedCode = simulatorCode, requestedPeriod = simulatorPeriod) => {
    const target = normalizeStockCode(requestedCode);
    setSimulatorCode(target);
    setSimulatorPeriod(requestedPeriod);
    setSimulatorStatus("loading");
    setSimulatorResult(null);
    setSimulatorError("");
    try {
      const payload = await fetchStrategyBacktest(target, requestedPeriod);
      setSimulatorResult(payload.result);
      setSimulatorStatus("success");
      const nextHistory: BacktestHistoryItem[] = [
        { result: payload.result, periodDays: requestedPeriod, savedAt: new Date().toISOString() },
        ...backtestHistory.filter((item) => item.result.code !== target || item.periodDays !== requestedPeriod),
      ].slice(0, 10);
      setBacktestHistory(nextHistory);
      localStorage.setItem("tw-signal-backtests", JSON.stringify(nextHistory));
    } catch (caught) {
      setSimulatorStatus("error");
      setSimulatorError(caught instanceof Error ? caught.message : "策略歷史回測失敗，請稍後重試。");
    }
  };

  const savePaperAccount = (next: PaperAccount) => {
    setPaperAccount(next);
    localStorage.setItem("tw-signal-paper-account", JSON.stringify(next));
  };

  const loadPaperQuote = async (requestedCode = paperCode) => {
    const target = normalizeStockCode(requestedCode);
    setPaperCode(target);
    setPaperStatus("loading");
    setPaperMessage("");
    setPaperQuote(null);
    if (!isSupportedStockCode(target)) {
      setPaperStatus("error");
      setPaperMessage("請輸入有效的上市／上櫃股票或 ETF 代碼。");
      return;
    }
    try {
      const payload = await fetchStockAnalysis(target);
      if (!payload.result) throw new Error(payload.notice || "這檔股票目前沒有足夠資料。");
      setPaperQuote(payload.result);
      setPaperStatus("ready");
    } catch (caught) {
      setPaperStatus("error");
      setPaperMessage(caught instanceof Error ? caught.message : "目前無法取得盤後價格。");
    }
  };

  const openPaperOrder = (analysis: AnalysisResult) => {
    setActiveView("paper");
    setDrawerOpen(false);
    setPaperCode(analysis.code);
    setPaperSide("buy");
    setPaperShares(Math.max(1, analysis.risk.shares || 1));
    setPaperQuote(analysis);
    setPaperStatus("ready");
    setPaperMessage("已帶入風險計畫的參考股數，你仍可自行調整。");
    window.setTimeout(() => document.getElementById("top")?.scrollIntoView({ behavior: "smooth" }), 0);
  };

  const openHistoryPaperOrder = (item: HistoryItem) => {
    setActiveView("paper");
    setDrawerOpen(false);
    setPaperCode(item.code);
    setPaperSide("buy");
    setPaperShares(1000);
    setPaperQuote(null);
    setPaperStatus("loading");
    window.setTimeout(() => document.getElementById("top")?.scrollIntoView({ behavior: "smooth" }), 0);
    void loadPaperQuote(item.code);
  };

  const executePaperOrder = (event: FormEvent) => {
    event.preventDefault();
    const target = normalizeStockCode(paperCode);
    const shares = Math.floor(paperShares);
    if (!paperQuote || paperQuote.code !== target) {
      setPaperStatus("error");
      setPaperMessage("股票代碼已變更，請先重新取得盤後價格。");
      return;
    }
    if (!Number.isFinite(shares) || shares <= 0) {
      setPaperStatus("error");
      setPaperMessage("股數必須是大於 0 的整數。");
      return;
    }
    const price = paperQuote.price;
    const gross = price * shares;
    const fee = Math.max(20, Math.round(gross * 0.001425));
    const tax = paperSide === "sell" ? Math.round(gross * 0.003) : 0;
    const current = paperAccount.positions.find((position) => position.code === target);
    let nextPositions = [...paperAccount.positions];
    let nextCash = paperAccount.cash;
    if (paperSide === "buy") {
      const totalCost = gross + fee;
      if (totalCost > paperAccount.cash) {
        setPaperStatus("error");
        setPaperMessage(`可用現金不足，這筆虛擬買進約需 ${formatCurrency(totalCost)}。`);
        return;
      }
      const oldShares = current?.shares || 0;
      const oldCost = current ? current.averageCost * current.shares : 0;
      const nextPosition: PaperPosition = { code: target, name: paperQuote.name, shares: oldShares + shares, averageCost: (oldCost + totalCost) / (oldShares + shares), lastPrice: price, dataDate: paperQuote.dataDate };
      nextPositions = [nextPosition, ...nextPositions.filter((position) => position.code !== target)];
      nextCash -= totalCost;
    } else {
      if (!current || current.shares < shares) {
        setPaperStatus("error");
        setPaperMessage(`持股不足，目前只有 ${(current?.shares || 0).toLocaleString("zh-TW")} 股。`);
        return;
      }
      const remaining = current.shares - shares;
      nextPositions = remaining > 0 ? nextPositions.map((position) => position.code === target ? { ...position, shares: remaining, lastPrice: price, dataDate: paperQuote.dataDate } : position) : nextPositions.filter((position) => position.code !== target);
      nextCash += gross - fee - tax;
    }
    const trade: PaperTrade = { id: `${Date.now()}-${target}`, side: paperSide, code: target, name: paperQuote.name, shares, price, fee, tax, total: paperSide === "buy" ? gross + fee : gross - fee - tax, dataDate: paperQuote.dataDate, createdAt: new Date().toISOString() };
    savePaperAccount({ ...paperAccount, cash: nextCash, positions: nextPositions, trades: [trade, ...paperAccount.trades].slice(0, 100) });
    setPaperStatus("ready");
    setPaperMessage(`${paperSide === "buy" ? "虛擬買進" : "虛擬賣出"}完成：${target} ${shares.toLocaleString("zh-TW")} 股，成交基準為 ${paperQuote.dataDate} 收盤價。`);
  };

  const refreshPaperPositions = async () => {
    if (!paperAccount.positions.length || paperRefreshing) return;
    setPaperRefreshing(true);
    setPaperMessage("");
    const refreshed = await Promise.all(paperAccount.positions.map(async (position) => {
      try {
        const payload = await fetchStockAnalysis(position.code);
        return payload.result ? { ...position, name: payload.result.name, lastPrice: payload.result.price, dataDate: payload.result.dataDate } : position;
      } catch { return position; }
    }));
    savePaperAccount({ ...paperAccount, positions: refreshed });
    setPaperRefreshing(false);
    setPaperMessage("持股已更新為目前可取得的最新盤後價格。");
  };

  const paperMarketValue = useMemo(() => paperAccount.positions.reduce((total, position) => total + position.shares * position.lastPrice, 0), [paperAccount.positions]);
  const paperTotalAssets = paperAccount.cash + paperMarketValue;
  const paperProfit = paperTotalAssets - paperAccount.initialCapital;

  const ruleCount = useMemo(() => result?.rules.filter((rule) => rule.pass).length ?? 0, [result]);
  const expectedDataDate = expectedLatestTradingDate();

  const switchView = (view: ViewMode) => {
    setActiveView(view);
    setDrawerOpen(false);
    window.setTimeout(() => document.getElementById("top")?.scrollIntoView({ behavior: "smooth" }), 0);
  };

  const updateFontSize = (next: FontSize) => {
    setFontSize(next);
    document.documentElement.setAttribute("data-font-size", next);
    localStorage.setItem("tw-signal-font-size", next);
  };

  return (
    <main>
      <header className="topbar">
        <button className="menu-button" type="button" onClick={() => setDrawerOpen(true)} aria-label="開啟功能選單">
          <Icon name="menu" size={22} />
        </button>
        <button className="brand" type="button" onClick={() => switchView("analysis")} aria-label="台股進場判斷器首頁">
          <span className="brand-mark"><Icon name="chart" size={21} /></span>
          <span>進場判斷器</span>
        </button>
        <span className="market-pill"><i />TWSE＋TPEx 日線</span>
      </header>

      <button className={`drawer-overlay${drawerOpen ? " open" : ""}`} type="button" onClick={() => setDrawerOpen(false)} aria-label="關閉功能選單" />
      <div className="app-frame">
        <aside className={`sidebar${drawerOpen ? " open" : ""}`} aria-label="主要功能">
          <div className="sidebar-mobile-head">
            <strong>功能選單</strong>
            <button type="button" onClick={() => setDrawerOpen(false)} aria-label="關閉功能選單"><Icon name="close" size={20} /></button>
          </div>
          <nav className="sidebar-nav">
            <button className={activeView === "analysis" ? "active" : ""} type="button" onClick={() => switchView("analysis")}>
              <Icon name="home" size={19} /><span><strong>個股進場判斷</strong><small>輸入股票代碼分析</small></span>
            </button>
            <button className={activeView === "screener" ? "active" : ""} type="button" onClick={() => switchView("screener")}>
              <Icon name="radar" size={19} /><span><strong>0050 機會雷達</strong><small>{screenerSnapshot ? `${screenerSnapshot.groups.ready.length} 檔條件已符合` : "掃描 50 檔成分股"}</small></span>
            </button>
            <button className={activeView === "paper" ? "active" : ""} type="button" onClick={() => switchView("paper")}>
              <Icon name="trade" size={19} /><span><strong>虛擬交易市場</strong><small>100萬元紙上交易帳戶</small></span>
            </button>
            <button className={activeView === "simulator" ? "active" : ""} type="button" onClick={() => switchView("simulator")}>
              <Icon name="simulator" size={19} /><span><strong>策略歷史回測</strong><small>重播歷史並與0050比較</small></span>
            </button>
            <button className={activeView === "guide" ? "active" : ""} type="button" onClick={() => switchView("guide")}>
              <Icon name="book" size={19} /><span><strong>策略白話說明</strong><small>1：3、停損與股數</small></span>
            </button>
          </nav>
          <section className="font-size-setting" aria-labelledby="font-size-setting-label">
            <div>
              <strong id="font-size-setting-label">字體大小</strong>
              <small>這台裝置會記住設定</small>
            </div>
            <div className="font-size-options" role="group" aria-label="選擇網站字體大小">
              {FONT_SIZE_OPTIONS.map((option) => (
                <button
                  className={fontSize === option.value ? "active" : ""}
                  key={option.value}
                  type="button"
                  aria-pressed={fontSize === option.value}
                  onClick={() => updateFontSize(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </section>
          <div className="sidebar-note">
            <Icon name="shield" size={18} />
            <p>先看大盤，再看個股。所有結果僅供研究與風險管理參考。</p>
          </div>
        </aside>

        <div className="main-column">
      <div id="top" className="page-shell">
        {activeView === "analysis" ? <>
        <section className="hero">
          <div className="eyebrow">趨勢 × 回檔 × 轉強 × 風控</div>
          <h1>現在，適合進場嗎？</h1>
          <p>輸入上市／上櫃股票或 ETF 代碼，由安全分析服務檢查建議入場區間、停損、目標價與可承擔部位。</p>

          <form className="search-panel" onSubmit={submit}>
            <div className="search-field">
              <Icon name="search" size={22} />
              <input
                aria-label="股票代碼"
                autoComplete="off"
                autoCapitalize="characters"
                inputMode="text"
                maxLength={6}
                onChange={(event) => setCode(normalizeStockCode(event.target.value))}
                placeholder="例如 0050、2330、3374、00403A"
                spellCheck={false}
                value={code}
              />
              <button className={`star-button${isStarred ? " active" : ""}`} type="button" onClick={toggleWatchlist} aria-label={isStarred ? "從自選股移除" : "加入自選股"}>
                <Icon name="star" size={21} />
              </button>
            </div>
            <button className="analyze-button" disabled={status === "loading"} type="submit">
              {status === "loading" ? `分析中 ${progress}%` : "開始分析"}
            </button>
          </form>

          {watchlist.length ? (
            <div className="watchlist" aria-label="自選股">
              <span>自選</span>
              {watchlist.map((item) => (
                <button key={item} type="button" onClick={() => void runAnalysis(item)}>{item}</button>
              ))}
            </div>
          ) : null}

          <details className="settings-panel">
            <summary>資金與風險設定</summary>
            <div className="settings-grid">
              <label>
                <span>可用資金（元）</span>
                <input type="number" min="0" step="10000" value={settings.capital} onChange={(event) => updateSettings({ ...settings, capital: Number(event.target.value) })} />
              </label>
              <label>
                <span>單筆風險（%）</span>
                <input type="number" min="0.1" max="3" step="0.1" value={settings.riskPercent} onChange={(event) => updateSettings({ ...settings, riskPercent: Number(event.target.value) })} />
              </label>
              <label>
                <span>單檔資金上限（%）</span>
                <input type="number" min="5" max="100" step="5" value={settings.maxExposurePercent} onChange={(event) => updateSettings({ ...settings, maxExposurePercent: Number(event.target.value) })} />
              </label>
              <label className="toggle-label">
                <input type="checkbox" checked={settings.allowOddLot} onChange={(event) => updateSettings({ ...settings, allowOddLot: event.target.checked })} />
                <span>允許零股</span>
              </label>
            </div>
            <p>預設每筆最多承擔總資金 1%，且單檔不超過 25%。更改後請重新分析。</p>
          </details>
        </section>

        {status === "idle" ? (
          <section className="empty-state card">
            <div className="empty-icon"><Icon name="search" size={26} /></div>
            <div>
              <h2>先分析 0050，看看今天的條件</h2>
              <p>私人分析服務會先判斷加權指數多空，再分析個股條件；本金與風險設定只留在你的裝置。</p>
            </div>
            <button type="button" onClick={() => void runAnalysis("0050")}>分析 0050</button>
          </section>
        ) : null}

        {status === "loading" ? (
          <section className="loading-card card" aria-live="polite">
            <div className="loading-top"><span>{loadingStage}</span><strong>{progress}%</strong></div>
            <div className="progress-track"><i style={{ width: `${progress}%` }} /></div>
            <p>第一步檢查加權指數，通過後才決定個股是否允許出現進場訊號。</p>
          </section>
        ) : null}

        {status === "error" ? (
          <section className="error-card card" role="alert">
            <div className="error-icon"><Icon name="alert" size={24} /></div>
            <div><h2>目前無法完成分析</h2><p>{error}</p></div>
            <button type="button" onClick={() => void runAnalysis()}>重新嘗試</button>
          </section>
        ) : null}

        {status === "partial" && fibonacci && marketResult ? (
          <div className="results" aria-live="polite">
            <MarketGate market={marketResult} />
            <section className="partial-card card" role="status">
              <div className="partial-icon"><Icon name="clock" size={24} /></div>
              <div>
                <span>新上市標的觀察模式</span>
                <h2>先看價格區間，暫不判斷進場</h2>
                <p>{error}</p>
              </div>
            </section>
            <FibonacciCard fibonacci={fibonacci} />
          </div>
        ) : null}

        {status === "success" && result ? (
          <div className="results" aria-live="polite">
            {usingCache ? <div className="cache-notice"><Icon name="clock" size={18} />{error}</div> : null}

            <MarketGate market={result.market} />

            <section className={`signal-card signal-${result.verdictKey}`}>
              <div className="signal-main">
                <div className="stock-heading">
                  <span>{result.code}</span>
                  <h2>{result.name}</h2>
                </div>
                <div className="signal-label"><i />{result.verdict}</div>
                <p>{result.summary}</p>
              </div>
              <div className="score-block">
                <span>條件符合度</span>
                <strong>{result.score}<small>/100</small></strong>
                <em>{ruleCount} / {result.rules.length} 項通過</em>
              </div>
            </section>

            <section className="metric-grid card">
              <Metric label="收盤價" value={formatPrice(result.price)} hint={`${result.changePercent >= 0 ? "+" : ""}${result.changePercent.toFixed(2)}%`} />
              <Metric label="MA25" value={formatPrice(result.metrics.ma25)} hint={`距離 ${result.metrics.distanceToMa25Percent >= 0 ? "+" : ""}${result.metrics.distanceToMa25Percent.toFixed(2)}%`} />
              <Metric label="RSI 14" value={result.metrics.rsi14.toFixed(1)} hint={result.metrics.rsi14 >= 70 ? "偏熱" : result.metrics.rsi14 <= 35 ? "低檔" : "中性"} />
              <Metric label="ATR 14（日常波動）" value={formatPrice(result.metrics.atr14)} hint={`近 14 日每天通常波動約 ${(result.metrics.atr14 / result.price * 100).toFixed(2)}%`} />
            </section>

            <EntryPlanCard result={result} />

            <AdSenseUnit slot="9369999183" label="個股分析中間廣告" />

            {fibonacci ? <FibonacciCard fibonacci={fibonacci} /> : null}

            <section className="chart-card card">
              <div className="section-heading">
                <div><span>價格趨勢</span><h2>最近 75 個交易日</h2></div>
                <small>資料至 {result.dataDate}</small>
              </div>
              <StockChart result={result} />
            </section>

            <section className="rules-card card">
              <div className="section-heading">
                <div><span>判斷依據</span><h2>六道進場檢查</h2></div>
                <small>符合度不是勝率</small>
              </div>
              <div className="rule-list">
                {result.rules.map((rule) => (
                  <article key={rule.id} className={rule.pass ? "rule-pass" : "rule-fail"}>
                    <div className="rule-status"><Icon name={rule.pass ? "check" : "alert"} size={18} /></div>
                    <div className="rule-copy">
                      <div><h3>{rule.label}</h3><span>{rule.value}</span></div>
                      <p>{rule.explanation}</p>
                    </div>
                    <strong>+{rule.pass ? rule.weight : 0}</strong>
                  </article>
                ))}
              </div>
            </section>

            <section className="risk-card card">
              <div className="section-heading">
                <div><span>風險計畫</span><h2>先知道錯了要賠多少</h2></div>
                <Icon name="shield" size={24} />
              </div>
              <div className="risk-levels">
                <div><span className="label-with-tip">{result.entryPlan.available ? "參考進場價" : "風險觀察基準"}<TermTip label="參考進場價">用這個價格試算停損、目標價與股數；實際成交價不同時必須重算。</TermTip></span><strong>{formatPrice(result.risk.referenceEntry)}</strong><small>{result.entryPlan.available ? "以優先觀察價計算" : "目前不構成進場建議"}</small></div>
                <div className="stop"><span className="label-with-tip">判斷錯誤時的離場價<TermTip label="停損價">跌到這裡代表原先條件可能失效，應依計畫離場；跳空時實際成交可能更低。</TermTip></span><strong>{formatPrice(result.risk.stop)}</strong><small>距參考進場價 -{result.risk.stopPercent.toFixed(2)}%</small></div>
                <div className="target"><span className="label-with-tip">目標價（賺 3、賠 1）<TermTip label="賺三賠一">每願意承擔 1 元損失，目標爭取 3 元報酬；只是風險規劃，不保證到價。</TermTip></span><strong>{formatPrice(result.risk.target)}</strong><small>每承擔 1 元損失，目標爭取 3 元</small></div>
              </div>
              <div className="position-box">
                <div>
                  <span className="label-with-tip">風險計算的股數上限<TermTip label="股數上限">這是依風險算出的最多股數，不代表一定要買滿，也不是買進指令。</TermTip></span>
                  <strong>{result.risk.shares.toLocaleString("zh-TW")} 股</strong>
                  <small>{result.risk.lots} 張 + {result.risk.oddShares} 股</small>
                </div>
                <dl>
                  <div><dt>預計投入金額</dt><dd>{formatCurrency(result.risk.estimatedPosition)}</dd></div>
                  <div><dt>跌到停損時約損失</dt><dd>{formatCurrency(result.risk.estimatedRisk)}</dd></div>
                </dl>
              </div>
              <div className="risk-example">
                <strong>用這次數字來看</strong>
                {result.risk.shares > 0 ? (
                  <p>若約在 {formatPrice(result.risk.referenceEntry)} 元進場、跌到 {formatPrice(result.risk.stop)} 元離場，最多 {result.risk.shares.toLocaleString("zh-TW")} 股的整筆估計損失約為 {formatCurrency(result.risk.estimatedRisk)}；若順利到 {formatPrice(result.risk.target)} 元，才達到「賺 3、賠 1」的原始目標。</p>
                ) : (
                  <p>目前條件不允許建立部位，所以股數上限為 0。參考進場、停損與目標價只用來觀察，不應視為下單指令。</p>
                )}
              </div>
              <p className="execution-note"><Icon name="alert" size={17} />實際下單前，請用成交價重新計算停損與股數；若開盤跳空超過建議區間、風報比不足或大盤轉弱，應放棄進場。</p>
            </section>

            <section className="paper-trade-cta card">
              <div><span>不動用真金</span><h2>把這份風險計畫放進虛擬市場測試</h2><p>系統會帶入股票、最新盤後收盤價與建議股數，你可以自行調整後用100萬元虛擬帳戶下單。</p></div>
              <button type="button" onClick={() => openPaperOrder(result)}><Icon name="trade" size={18} />模擬下單</button>
            </section>

            <section className="details-grid">
              <article className="card detail-card">
                <span>動能</span>
                <h2>KD 與 MACD</h2>
                <dl>
                  <div><dt>K / D</dt><dd>{result.metrics.k.toFixed(1)} / {result.metrics.d.toFixed(1)}</dd></div>
                  <div><dt>MACD</dt><dd>{result.metrics.macd.toFixed(3)}</dd></div>
                  <div><dt>柱狀體</dt><dd>{result.metrics.macdHistogram.toFixed(3)}</dd></div>
                </dl>
              </article>
              <article className="card detail-card">
                <span>資料品質</span>
                <h2>使用前確認</h2>
                <ul>
                  {result.warnings.map((warning) => <li key={warning}>{warning}</li>)}
                </ul>
              </article>
            </section>
          </div>
        ) : null}

        </> : null}

        {activeView === "screener" ? (
          <div className="radar-page">
            <section className="radar-hero">
              <div>
                <span className="eyebrow">0050 成分股每日掃描</span>
                <h1>今天，哪些股票接近進場條件？</h1>
                <p>先套用加權指數環境，再逐一檢查 0050 成分股。這是規則篩選結果，不是買進推薦。</p>
              </div>
              <button type="button" onClick={() => void loadScreener()} disabled={screenerStatus === "loading"}>
                {screenerStatus === "loading" ? "讀取中…" : "更新畫面"}
              </button>
            </section>

            {screenerStatus === "loading" ? (
              <section className="loading-card card" aria-live="polite">
                <div className="loading-top"><span>讀取 0050 最新雷達</span><strong>請稍候</strong></div>
                <div className="progress-track"><i style={{ width: "42%" }} /></div>
                <p>資料在伺服器端整理，手機不需要重算 50 檔股票。</p>
              </section>
            ) : null}

            {screenerStatus === "building" ? (
              <section className="loading-card card" aria-live="polite">
                <div className="loading-top"><span>第一次建立雷達快取</span><strong>{screenerProgress.completed} / {screenerProgress.total}</strong></div>
                <div className="progress-track"><i style={{ width: `${screenerProgress.completed / screenerProgress.total * 100}%` }} /></div>
                <p>系統正分批讀取公開日線，會自動繼續；已略過 {screenerProgress.failed} 檔資料異常標的。</p>
              </section>
            ) : null}

            {screenerStatus === "error" ? (
              <section className="error-card card" role="alert">
                <div className="error-icon"><Icon name="alert" size={24} /></div>
                <div><h2>雷達暫時無法讀取</h2><p>{screenerError}</p></div>
                <button type="button" onClick={() => void loadScreener()}>重新嘗試</button>
              </section>
            ) : null}

            {screenerStatus === "ready" && screenerSnapshot ? (
              <div className="radar-results" aria-live="polite">
                <MarketGate market={screenerSnapshot.market} />
                <div className="radar-meta">
                  <span>行情資料至 {screenerSnapshot.dataDate}</span>
                  <span>已分析 {screenerSnapshot.all.length} / 50 檔</span>
                  <a href={screenerSnapshot.fund.sourceUrl} rel="noreferrer" target="_blank">成分股來源與日期</a>
                </div>
                <div className="radar-groups">
                  <ScreenerGroup title="策略條件已符合" explanation="大盤允許，個股的趨勢與觸發條件也已成立；仍要核對實際成交價。" items={screenerSnapshot.groups.ready} onAnalyze={(stockCode) => void runAnalysis(stockCode)} />
                  <ScreenerGroup title="接近進場區" explanation="距離回檔參考區 1.5% 以內，等待價格進區並出現轉強。" items={screenerSnapshot.groups.nearEntry} onAnalyze={(stockCode) => void runAnalysis(stockCode)} />
                  <div className="radar-ad-row">
                    <AdSenseUnit slot="3727674747" label="0050 機會雷達中間廣告" />
                  </div>
                  <ScreenerGroup title="關鍵突破觀察" explanation="距突破參考價 1.5% 以內，必須搭配成交量且不可追高。" items={screenerSnapshot.groups.nearBreakout} onAnalyze={(stockCode) => void runAnalysis(stockCode)} />
                  <ScreenerGroup title="暫不適合" explanation="大盤、趨勢、過熱、流動性或資料品質未通過；列出來是提醒避開。" items={screenerSnapshot.groups.blocked} onAnalyze={(stockCode) => void runAnalysis(stockCode)} />
                </div>

                <details className="radar-all card">
                  <summary>查看完整 50 檔篩選結果</summary>
                  <div className="radar-table" role="table" aria-label="0050 完整篩選結果">
                    {screenerSnapshot.all.map((item) => (
                      <button type="button" role="row" key={item.code} onClick={() => void runAnalysis(item.code)}>
                        <span role="cell"><strong>{item.code}</strong><small>{item.name}</small></span>
                        <em role="cell" className={`radar-tag radar-${item.category}`}>{item.categoryLabel}</em>
                        <span role="cell">{formatPrice(item.price)}</span>
                        <span role="cell">{item.score} 分</span>
                      </button>
                    ))}
                  </div>
                </details>

                <p className="radar-disclaimer">0050 成分股會定期調整；本頁依標示日期的清單與收盤資料篩選。分類只表示規則是否符合，不代表未來一定上漲，也不構成買進推薦。</p>
                <AdSenseUnit slot="6743835843" label="0050 機會雷達底部廣告" />
              </div>
            ) : null}
          </div>
        ) : null}

        {activeView === "paper" ? (
          <div className="paper-market-page">
            <section className="paper-market-hero">
              <div><span className="eyebrow">紙上交易 × 上市上櫃市場</span><h1>虛擬交易市場</h1><p>用100萬元虛擬資金練習買賣、建立持股並追蹤損益。成交基準採最新盤後收盤價，不會連到券商，也不會動用真實資金。</p></div>
              <button type="button" onClick={() => void refreshPaperPositions()} disabled={paperRefreshing || !paperAccount.positions.length}><Icon name="refresh" size={17} />{paperRefreshing ? "更新中…" : "更新持股價格"}</button>
            </section>
            <section className="paper-account-summary card">
              <div><span>虛擬總資產</span><strong>{formatCurrency(paperTotalAssets)}</strong><small>初始 {formatCurrency(paperAccount.initialCapital)}</small></div>
              <div><span>可用現金</span><strong>{formatCurrency(paperAccount.cash)}</strong><small>尚未投入的虛擬資金</small></div>
              <div><span>持股市值</span><strong>{formatCurrency(paperMarketValue)}</strong><small>{paperAccount.positions.length} 檔持股</small></div>
              <div><span>帳戶總損益</span><strong className={paperProfit >= 0 ? "price-up" : "price-down"}>{paperProfit >= 0 ? "+" : ""}{formatCurrency(paperProfit)}</strong><small>{paperProfit >= 0 ? "+" : ""}{(paperProfit / paperAccount.initialCapital * 100).toFixed(2)}%</small></div>
            </section>
            <section className="paper-order-card card">
              <div className="section-heading"><div><span>虛擬委託單</span><h2>用盤後收盤價模擬成交</h2></div><small>資料日期會顯示在成交確認中</small></div>
              <div className="paper-quote-search">
                <label><span>股票代碼</span><input aria-label="虛擬交易股票代碼" maxLength={6} value={paperCode} onChange={(event) => { setPaperCode(normalizeStockCode(event.target.value)); setPaperQuote(null); setPaperStatus("idle"); setPaperMessage(""); }} placeholder="例如 2330、3374" /></label>
                <button type="button" onClick={() => void loadPaperQuote()} disabled={paperStatus === "loading"}><Icon name="search" size={17} />{paperStatus === "loading" ? "查詢中…" : "取得盤後價格"}</button>
              </div>
              {paperQuote ? <div className="paper-quote"><div><strong>{paperQuote.code}</strong><span>{paperQuote.name}</span></div><div><small>{paperQuote.dataDate} 收盤價</small><strong>{formatPrice(paperQuote.price)}</strong></div>{paperQuote.verdict && paperQuote.verdictKey ? <div><small>策略判斷</small><em className={`history-${paperQuote.verdictKey}`}>{paperQuote.verdict}</em></div> : null}</div> : null}
              <form className="paper-order-form" onSubmit={executePaperOrder}>
                <fieldset><legend>方向</legend><div className="paper-side-options"><button className={paperSide === "buy" ? "active buy" : ""} type="button" onClick={() => setPaperSide("buy")}>虛擬買進</button><button className={paperSide === "sell" ? "active sell" : ""} type="button" onClick={() => setPaperSide("sell")}>虛擬賣出</button></div></fieldset>
                <label><span>股數</span><input aria-label="虛擬交易股數" type="number" min="1" step="1" value={paperShares} onChange={(event) => setPaperShares(Number(event.target.value))} /></label>
                <div className="paper-order-estimate"><span>預估成交金額</span><strong>{paperQuote ? formatCurrency(paperQuote.price * Math.max(0, paperShares || 0)) : "先取得價格"}</strong></div>
                <button className={paperSide === "buy" ? "paper-buy-button" : "paper-sell-button"} type="submit" disabled={!paperQuote}>確認{paperSide === "buy" ? "買進" : "賣出"}</button>
              </form>
              {paperMessage ? <p className={`paper-order-message${paperStatus === "error" ? " is-error" : ""}`}>{paperMessage}</p> : null}
              <p className="paper-fee-note">虛擬成交估入0.1425%手續費（最低20元）；賣出另以0.3%交易稅估算。ETF等標的實際稅率可能不同，本頁只作練習。</p>
            </section>
            <section className="paper-positions card">
              <div className="section-heading"><div><span>虛擬持股</span><h2>目前投資組合</h2></div><small>價格需手動更新</small></div>
              {paperAccount.positions.length ? <div className="paper-position-list">{paperAccount.positions.map((position) => { const positionProfit = (position.lastPrice - position.averageCost) * position.shares; return <article key={position.code}><div><strong>{position.code}</strong><small>{position.name}</small></div><div><span>{position.shares.toLocaleString("zh-TW")} 股</span><small>均價 {formatPrice(position.averageCost)}</small></div><div><span>{formatPrice(position.lastPrice)}</span><small>{position.dataDate} 收盤</small></div><strong className={positionProfit >= 0 ? "price-up" : "price-down"}>{positionProfit >= 0 ? "+" : ""}{formatCurrency(positionProfit)}</strong><div className="paper-position-actions"><button type="button" onClick={() => { setPaperCode(position.code); setPaperSide("buy"); setPaperShares(1000); setPaperQuote({ code: position.code, name: position.name, price: position.lastPrice, dataDate: position.dataDate }); setPaperStatus("ready"); }}>加碼</button><button type="button" onClick={() => { setPaperCode(position.code); setPaperSide("sell"); setPaperShares(position.shares); setPaperQuote({ code: position.code, name: position.name, price: position.lastPrice, dataDate: position.dataDate }); setPaperStatus("ready"); }}>賣出</button></div></article>; })}</div> : <p className="paper-empty">目前還沒有虛擬持股。可以從上方查詢股票，或在個股分析的「風險計畫」後面按下「模擬下單」。</p>}
            </section>
            <section className="paper-trades card">
              <div className="section-heading"><div><span>虛擬成交紀錄</span><h2>最近100筆交易</h2></div><small>只保存在這台裝置</small></div>
              {paperAccount.trades.length ? <div className="paper-trade-list">{paperAccount.trades.map((trade) => <article key={trade.id}><em className={trade.side}>{trade.side === "buy" ? "買進" : "賣出"}</em><div><strong>{trade.code}</strong><small>{trade.name}</small></div><div><span>{trade.shares.toLocaleString("zh-TW")} 股 × {formatPrice(trade.price)}</span><small>{trade.dataDate} 收盤價成交</small></div><strong>{formatCurrency(trade.total)}</strong></article>)}</div> : <p className="paper-empty">完成第一筆虛擬買進後，成交紀錄會出現在這裡。</p>}
            </section>
          </div>
        ) : null}

        {activeView === "simulator" ? (
          <div className="simulator-page">
            <section className="simulator-hero">
              <div>
                <span className="eyebrow">歷史時光機 × 防止偷看未來</span>
                <h1>策略歷史回測</h1>
                <p>重播過去日線，檢查策略在歷史期間的訊號、成交與績效，並和同期0050比較。這不是持續經營的虛擬帳戶。</p>
              </div>
            </section>

            <form className="simulator-form card" onSubmit={(event) => { event.preventDefault(); void runBacktest(); }}>
              <label>
                <span>股票代碼</span>
                <input
                  aria-label="模擬股票代碼"
                  autoComplete="off"
                  maxLength={6}
                  value={simulatorCode}
                  onChange={(event) => setSimulatorCode(normalizeStockCode(event.target.value))}
                  placeholder="例如 0050、2330、3374"
                />
              </label>
              <label>
                <span>測試期間</span>
                <select aria-label="模擬交易日數" value={simulatorPeriod} onChange={(event) => setSimulatorPeriod(Number(event.target.value))}>
                  <option value={20}>近20個交易日</option>
                  <option value={40}>近40個交易日</option>
                  <option value={60}>近60個交易日</option>
                  <option value={90}>近90個交易日</option>
                </select>
              </label>
              <button type="submit" disabled={simulatorStatus === "loading"}>
                <Icon name="simulator" size={18} />
                {simulatorStatus === "loading" ? "正在重播歷史…" : "開始歷史回測"}
              </button>
            </form>

            <section className="simulator-rules card">
              <div><strong>100萬元</strong><span>固定虛擬本金</span></div>
              <div><strong>1%</strong><span>單筆風險上限</span></div>
              <div><strong>25%</strong><span>單檔資金上限</span></div>
              <p><Icon name="shield" size={17} />只使用當時已經發生的資料；下一日跳空超過3%會放棄該次進場，避免用不可能成交的價格美化績效。</p>
            </section>

            {backtestHistory.length ? (
              <div className="simulator-history" aria-label="最近策略歷史回測">
                <span>最近回測</span>
                {backtestHistory.slice(0, 6).map((item) => (
                  <button key={`${item.result.code}-${item.periodDays}`} type="button" onClick={() => void runBacktest(item.result.code, item.periodDays)}>
                    {item.result.code}・{item.periodDays}日
                  </button>
                ))}
              </div>
            ) : null}

            {simulatorStatus === "loading" ? (
              <section className="loading-card card" aria-live="polite">
                <div className="loading-top"><span>逐日重建策略訊號與虛擬成交</span><strong>請稍候</strong></div>
                <div className="progress-track"><i style={{ width: "58%" }} /></div>
                <p>第一次執行需要下載個股、加權指數與0050歷史資料；相同條件之後會讀取快取。</p>
              </section>
            ) : null}

            {simulatorStatus === "error" ? (
              <section className="error-card card" role="alert">
                <div className="error-icon"><Icon name="alert" size={24} /></div>
                <div><h2>這次無法完成模擬</h2><p>{simulatorError}</p></div>
                <button type="button" onClick={() => void runBacktest()}>重新嘗試</button>
              </section>
            ) : null}

            {simulatorStatus === "success" && simulatorResult ? (
              <div className="simulator-results" aria-live="polite">
                <section className={`simulator-verdict card ${simulatorResult.excessReturnPercent >= 0 ? "is-ahead" : "is-behind"}`}>
                  <div>
                    <span>{simulatorResult.code}</span>
                    <h2>{simulatorResult.name}・{simulatorResult.testedTradingDays}個交易日</h2>
                    <p>{simulatorResult.startDate} 至 {simulatorResult.endDate}</p>
                  </div>
                  <strong>{simulatorResult.excessReturnPercent >= 0 ? "跑贏0050" : "落後0050"}<b>{simulatorResult.excessReturnPercent >= 0 ? "+" : ""}{simulatorResult.excessReturnPercent.toFixed(2)}%</b></strong>
                </section>

                <section className="simulator-metrics card">
                  <div><span>策略報酬</span><strong className={simulatorResult.strategyReturnPercent >= 0 ? "price-up" : "price-down"}>{simulatorResult.strategyReturnPercent >= 0 ? "+" : ""}{simulatorResult.strategyReturnPercent.toFixed(2)}%</strong><small>{formatCurrency(simulatorResult.finalEquity)}</small></div>
                  <div><span>同期0050</span><strong>{simulatorResult.benchmarkReturnPercent >= 0 ? "+" : ""}{simulatorResult.benchmarkReturnPercent.toFixed(2)}%</strong><small>買進持有比較</small></div>
                  <div><span>最大資金回落</span><strong>{simulatorResult.maxDrawdownPercent.toFixed(2)}%</strong><small>期間內最深跌幅</small></div>
                  <div><span>完成交易</span><strong>{simulatorResult.completedTrades} 筆</strong><small>{simulatorResult.signalCount} 次進場訊號</small></div>
                  <div><span>交易勝率</span><strong>{simulatorResult.winRatePercent.toFixed(1)}%</strong><small>只計已完成交易</small></div>
                  <div><span>獲利因子</span><strong>{simulatorResult.profitFactor === null ? "∞" : simulatorResult.profitFactor.toFixed(2)}</strong><small>總獲利 ÷ 總虧損</small></div>
                </section>

                <section className="backtest-chart-card card">
                  <div className="section-heading"><div><span>虛擬資產曲線</span><h2>策略帳戶變化</h2></div><small>初始 {formatCurrency(simulatorResult.initialCapital)}</small></div>
                  <BacktestChart result={simulatorResult} />
                </section>

                <section className="backtest-trades card">
                  <div className="section-heading"><div><span>成交紀錄</span><h2>每筆進出場</h2></div><small>含滑價與交易成本</small></div>
                  {simulatorResult.trades.length ? (
                    <div className="backtest-trade-list">
                      {simulatorResult.trades.map((trade, index) => (
                        <article key={`${trade.entryDate}-${trade.exitDate}-${index}`}>
                          <div><strong>{trade.entryDate.slice(5)} → {trade.exitDate.slice(5)}</strong><small>{trade.shares.toLocaleString("zh-TW")} 股</small></div>
                          <div><span>{formatPrice(trade.entryPrice)} → {formatPrice(trade.exitPrice)}</span><small>{trade.exitReason === "stop" ? "停損" : trade.exitReason === "target" ? "目標價" : trade.exitReason === "trend" ? "趨勢轉弱" : "測試期結束"}</small></div>
                          <strong className={trade.profit >= 0 ? "price-up" : "price-down"}>{trade.profit >= 0 ? "+" : ""}{formatCurrency(trade.profit)}<small>{trade.returnPercent >= 0 ? "+" : ""}{trade.returnPercent.toFixed(2)}%</small></strong>
                        </article>
                      ))}
                    </div>
                  ) : <p className="backtest-empty">這段期間沒有符合「可執行且下一日能合理成交」的訊號。沒有交易也是策略結果，不代表系統故障。</p>}
                </section>

                <details className="backtest-assumptions card">
                  <summary>查看模擬假設與限制</summary>
                  <ul>{simulatorResult.assumptions.map((item) => <li key={item}>{item}</li>)}</ul>
                </details>
              </div>
            ) : null}

          </div>
        ) : null}

        {activeView === "guide" ? <section className="method guide-page card">
          <div className="section-heading">
            <div><span>策略白話說明</span><h2>看懂每個數字，才決定要不要交易</h2></div>
          </div>
          <div className="plain-guide-intro">
            <h3>先用一句話理解</h3>
            <p>這套方法先確認台股大盤是否適合做多，再找趨勢向上的股票，等待好價格與轉強訊號，最後先算好「判斷錯了最多損失多少」。</p>
          </div>
          <div className="method-grid">
            <article><b>01</b><h3>大盤先行</h3><p>加權指數三項條件決定全額、半額或停止新的多方進場。</p></article>
            <article><b>02</b><h3>個股趨勢</h3><p>MA25 高於 MA99，價格也要站上 MA99。不在空頭中猜底。</p></article>
            <article><b>03</b><h3>只買好位置</h3><p>等待靠近 MA25、RSI 降溫，或用放量突破確認，不追過熱價格。</p></article>
            <article><b>04</b><h3>等轉強再進</h3><p>收盤站回 MA7、MACD 柱增強，KD 或價格同步轉強才觸發。</p></article>
            <article><b>05</b><h3>費波那契定位</h3><p>用回檔位找支撐區、用擴展位規劃突破後目標，但不單獨作為買點。</p></article>
            <article><b>06</b><h3>部位由風險決定</h3><p>以 ATR 與近期低點設停損，再乘上大盤允許的部位係數。</p></article>
          </div>
          <div className="glossary-grid">
            <article><h3>目標價（賺 3、賠 1）</h3><p>如果進場到停損的距離是 5 元，目標就先抓 15 元。意思是每願意承擔 1 元損失，爭取 3 元報酬；它是規劃，不是保證。</p></article>
            <article><h3>停損價</h3><p>代表「原本的判斷可能錯了」時預先離場的價格。實際成交可能因跳空或滑價低於這個價位。</p></article>
            <article><h3>最多股數</h3><p>依你的資金、單筆可承擔損失、單檔上限及大盤係數算出的風險上限，不是叫你一定要買滿。</p></article>
            <article><h3>跌到停損時約損失</h3><p>股數乘上每股風險，並估入買賣手續費與交易稅。這仍是估算，跳空與滑價會讓實際損失更高。</p></article>
            <article><h3>ATR 14</h3><p>最近 14 個交易日每天通常波動多少。ATR 越大，代表價格晃動較大，停損通常也要留得更寬。</p></article>
            <article><h3>條件符合度</h3><p>六項規則的加權分數，用來確認策略條件，不是上漲機率，也不是勝率。</p></article>
          </div>
          <p className="disclaimer">免責聲明：本工具依公開歷史資料進行規則化研究與風險管理試算，所有訊號、建議區間、停損、目標價及股數均非個別投資建議、證券推薦、招攬、報酬保證或自動下單服務。資料可能延遲、遺漏或因除權息與市場事件失真；使用者應自行查證並承擔交易決策及損益。</p>
        </section> : null}

        {activeView === "analysis" && history.length ? (
          <section className="history card">
            <div className="section-heading">
              <div><span>本機紀錄</span><h2>最近分析</h2></div>
              <div className="history-actions">
                <small>{history.length} 筆・最多保留 20 筆</small>
                <button type="button" onClick={() => void refreshAllHistory()} disabled={historyRefresh.running}>
                  <Icon name="refresh" size={14} />
                  {historyRefresh.running ? `${historyRefresh.completed}/${historyRefresh.total}` : "更新全部"}
                </button>
              </div>
            </div>
            <p className={`history-update-note ${historyRefresh.failed ? "has-error" : ""}`}>
              {historyRefresh.running
                ? `正在分批重新分析，已完成 ${historyRefresh.completed}／${historyRefresh.total} 筆，請先不要關閉頁面。`
                : historyRefresh.total
                  ? historyRefresh.failed
                    ? `更新完成；${historyRefresh.failed} 筆連線失敗，暫時保留原紀錄。`
                    : "全部紀錄已使用最新可取得的日線重新分析。"
                  : "右側訊號是上次分析結果，不會自動改變；資料日期較舊時會提示更新。"}
            </p>
            <div className="history-list">
              {history.map((item) => {
                const needsRefresh = item.dataDate < expectedDataDate;
                return (
                  <div className="history-row" key={item.code}>
                    <button className="history-reanalyze" type="button" onClick={() => void runAnalysis(item.code)} disabled={historyRefresh.running} title={`資料日期 ${item.dataDate}；點選可重新分析`}>
                      <span className="history-stock"><b>{item.code}</b>{item.name}</span><em className={`history-${item.verdictKey}`}>{item.verdict}</em><span className={`history-date ${needsRefresh ? "is-stale" : ""}`}><small>資料日 {formatHistoryDate(item.dataDate)}</small>{needsRefresh ? <i>可能需更新</i> : null}</span>
                    </button>
                    <button className="history-trade-button" type="button" onClick={() => openHistoryPaperOrder(item)} disabled={historyRefresh.running}><Icon name="trade" size={14} />模擬交易</button>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        {activeView === "analysis" ? <AdSenseUnit slot="5040756419" label="個股分析底部廣告" /> : null}

      </div>

      <footer>
        <span>
          資料來源：
          <a href="https://data.gov.tw/dataset/11549" rel="noreferrer" target="_blank">臺灣證券交易所股份有限公司「個股日成交資訊」</a>
          、<a href="https://www.tpex.org.tw/zh-tw/openapi.html" rel="noreferrer" target="_blank">證券櫃檯買賣中心公開資料</a>
          ・依各來源開放資料規範利用
        </span>
        <span className="footer-links"><a href="./privacy/">隱私權政策</a><i />支援上市／上櫃股票與 ETF・日線收盤後更新</span>
      </footer>
        </div>
      </div>
    </main>
  );
}
