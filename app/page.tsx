"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import {
  AnalysisResult,
  FibonacciAnalysis,
  MarketRegime,
  StrategySettings,
  analyzeBars,
  analyzeFibonacci,
  analyzeMarketRegime,
  fetchTaiexDailyBars,
  fetchTwseDailyBars,
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
>;

const formatPrice = (value: number) =>
  new Intl.NumberFormat("zh-TW", {
    minimumFractionDigits: value < 50 ? 2 : 1,
    maximumFractionDigits: value < 50 ? 2 : 1,
  }).format(value);

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("zh-TW", { style: "currency", currency: "TWD", maximumFractionDigits: 0 }).format(value);

function Icon({ name, size = 20 }: { name: "search" | "star" | "shield" | "chart" | "check" | "alert" | "clock"; size?: number }) {
  const paths: Record<typeof name, ReactNode> = {
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9Z"/>,
    shield: <><path d="M12 3 5 6v5c0 4.7 2.9 8.4 7 10 4.1-1.6 7-5.3 7-10V6Z"/><path d="m9.5 12 1.6 1.6 3.6-3.8"/></>,
    chart: <><path d="M4 19V5"/><path d="M4 19h16"/><path d="m7 15 4-4 3 2 5-6"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    alert: <><path d="M12 4 3.5 19h17Z"/><path d="M12 9v4"/><path d="M12 16h.01"/></>,
    clock: <><circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/></>,
  };
  return (
    <svg aria-hidden="true" className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
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
  const [usingCache, setUsingCache] = useState(false);

  useEffect(() => {
    const restoreTimer = window.setTimeout(() => {
      try {
        const savedSettings = localStorage.getItem("tw-signal-settings");
        const savedWatchlist = localStorage.getItem("tw-signal-watchlist");
        const savedHistory = localStorage.getItem("tw-signal-history");
        if (savedSettings) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) });
        if (savedWatchlist) setWatchlist(JSON.parse(savedWatchlist));
        if (savedHistory) setHistory(JSON.parse(savedHistory));
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

  const normalizedCode = normalizeStockCode(code);
  const isStarred = watchlist.includes(normalizedCode);

  const runAnalysis = async (requestedCode = normalizedCode) => {
    const target = normalizeStockCode(requestedCode);
    setCode(target);
    setStatus("loading");
    setResult(null);
    setFibonacci(null);
    setMarketResult(null);
    setError("");
    setProgress(0);
    setLoadingStage("先判斷台股大盤");
    setUsingCache(false);
    try {
      let market: MarketRegime | null = null;
      let cachedMarket: { savedAt: number; market: MarketRegime } | null = null;
      try {
        const storedMarket = localStorage.getItem("tw-signal-market-v2");
        if (storedMarket) cachedMarket = JSON.parse(storedMarket);
      } catch {
        cachedMarket = null;
      }

      if (cachedMarket && Date.now() - cachedMarket.savedAt < 60 * 60 * 1000) {
        market = cachedMarket.market;
        setProgress(35);
      } else {
        try {
          const marketBars = await fetchTaiexDailyBars((completed, total) =>
            setProgress(Math.round((completed / total) * 35)),
          );
          market = analyzeMarketRegime(marketBars);
          localStorage.setItem("tw-signal-market-v2", JSON.stringify({ savedAt: Date.now(), market }));
        } catch (marketError) {
          if (cachedMarket && Date.now() - cachedMarket.savedAt < 7 * 24 * 60 * 60 * 1000) {
            market = {
              ...cachedMarket.market,
              summary: `${cachedMarket.market.summary}（目前使用最近一次大盤快取）`,
            };
          } else {
            throw marketError;
          }
        }
      }

      setMarketResult(market);

      setLoadingStage("再分析個股條件");
      const data = await fetchTwseDailyBars(target, (completed, total) =>
        setProgress(35 + Math.round((completed / total) * 65)),
      );
      const nextFibonacci = analyzeFibonacci(target, data.name, data.bars);
      setFibonacci(nextFibonacci);
      if (data.bars.length < 120) {
        setStatus("partial");
        setError(
          `${data.name}（${target}）目前只有 ${data.bars.length} 個交易日，尚不足以計算 MA99；` +
            "本次只顯示費波那契觀察區，不提供進場訊號與部位建議。",
        );
        return;
      }
      const nextResult = analyzeBars(target, data.name, data.bars, settings, market);
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
        },
        ...history.filter((item) => item.code !== target),
      ].slice(0, 5);
      setHistory(nextHistory);
      localStorage.setItem("tw-signal-history", JSON.stringify(nextHistory));
      localStorage.setItem(`tw-signal-cache-v2-${target}`, JSON.stringify({ savedAt: Date.now(), result: nextResult }));
    } catch (caught) {
      try {
        const cached = localStorage.getItem(`tw-signal-cache-v2-${target}`);
        if (cached) {
          const parsed = JSON.parse(cached) as { savedAt: number; result: AnalysisResult };
          setResult(parsed.result);
          setStatus("success");
          setUsingCache(true);
          setError("目前無法連到證交所，以下為這台裝置上次成功分析的結果。");
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

  const ruleCount = useMemo(() => result?.rules.filter((rule) => rule.pass).length ?? 0, [result]);

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="台股進場判斷器首頁">
          <span className="brand-mark"><Icon name="chart" size={21} /></span>
          <span>進場判斷器</span>
        </a>
        <span className="market-pill"><i />TWSE 日線</span>
      </header>

      <div id="top" className="page-shell">
        <section className="hero">
          <div className="eyebrow">趨勢 × 回檔 × 轉強 × 風控</div>
          <h1>現在，適合進場嗎？</h1>
          <p>輸入上市股票或 ETF 代碼，直接檢查條件、停損、目標價與可承擔部位。</p>

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
                placeholder="例如 0050、2330、00403A"
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
              <p>系統會先判斷加權指數多空，再分析個股條件、風控與部位。</p>
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
              <Metric label="ATR 14" value={formatPrice(result.metrics.atr14)} hint={`約 ${(result.metrics.atr14 / result.price * 100).toFixed(2)}%`} />
            </section>

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
                <div><span>參考進場</span><strong>{formatPrice(result.risk.referenceEntry)}</strong><small>以最新收盤估算</small></div>
                <div className="stop"><span>停損</span><strong>{formatPrice(result.risk.stop)}</strong><small>-{result.risk.stopPercent.toFixed(2)}%</small></div>
                <div className="target"><span>3R 目標</span><strong>{formatPrice(result.risk.target)}</strong><small>風報比 1 : 3</small></div>
              </div>
              <div className="position-box">
                <div>
                  <span>依資金與大盤係數調整後最多</span>
                  <strong>{result.risk.shares.toLocaleString("zh-TW")} 股</strong>
                  <small>{result.risk.lots} 張 + {result.risk.oddShares} 股</small>
                </div>
                <dl>
                  <div><dt>估計部位</dt><dd>{formatCurrency(result.risk.estimatedPosition)}</dd></div>
                  <div><dt>含成本風險</dt><dd>{formatCurrency(result.risk.estimatedRisk)}</dd></div>
                </dl>
              </div>
              <p className="execution-note"><Icon name="alert" size={17} />實際下單前，請用下一交易日成交價重新計算停損與股數；跳空超過預期時放棄進場。</p>
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

        <section className="method card">
          <div className="section-heading">
            <div><span>策略說明</span><h2>改良後的進場邏輯</h2></div>
          </div>
          <div className="method-grid">
            <article><b>01</b><h3>大盤先行</h3><p>加權指數三項條件決定全額、半額或停止新的多方進場。</p></article>
            <article><b>02</b><h3>個股趨勢</h3><p>MA25 高於 MA99，價格也要站上 MA99。不在空頭中猜底。</p></article>
            <article><b>03</b><h3>只買好位置</h3><p>等待靠近 MA25、RSI 降溫，或用放量突破確認，不追過熱價格。</p></article>
            <article><b>04</b><h3>等轉強再進</h3><p>收盤站回 MA7、MACD 柱增強，KD 或價格同步轉強才觸發。</p></article>
            <article><b>05</b><h3>費波那契定位</h3><p>用回檔位找支撐區、用擴展位規劃突破後目標，但不單獨作為買點。</p></article>
            <article><b>06</b><h3>部位由風險決定</h3><p>以 ATR 與近期低點設停損，再乘上大盤允許的部位係數。</p></article>
          </div>
          <p className="disclaimer">本工具是規則化研究與風險管理輔助，不是投資建議、報酬保證或自動下單服務。訊號應搭配個人財務狀況與事件風險判斷。</p>
        </section>

        {history.length ? (
          <section className="history card">
            <div className="section-heading"><div><span>本機紀錄</span><h2>最近分析</h2></div></div>
            <div className="history-list">
              {history.map((item) => (
                <button type="button" key={`${item.code}-${item.dataDate}`} onClick={() => void runAnalysis(item.code)}>
                  <span><b>{item.code}</b>{item.name}</span>
                  <em className={`history-${item.verdictKey}`}>{item.verdict}</em>
                  <small>{item.dataDate}</small>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <section className="ad-placeholder" aria-label="廣告預留區">
          <span>廣告</span>
          <div>
            <strong>自適應橫幅廣告預留區</strong>
            <small>AdSense 審核通過後，廣告將在此自動配合手機與電腦寬度顯示。</small>
          </div>
        </section>
      </div>

      <footer>
        <span>資料來源：FinMind 日線資料・TWSE 備援</span>
        <span className="footer-links"><a href="./privacy/">隱私權政策</a><i />僅支援上市股票與 ETF・日線收盤後更新</span>
      </footer>
    </main>
  );
}
