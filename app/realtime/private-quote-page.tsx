"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { isSupportedStockCode, normalizeStockCode } from "@/lib/strategy";
import {
  PRIVATE_QUOTE_ENTRY_KEY, PrivateQuoteError, PrivateQuotePayload,
  fetchPrivateQuote, unlockPrivateQuotes,
} from "@/lib/private-quotes";

const formatNumber = (value: number | null, digits = 2) => value === null ? "—" :
  new Intl.NumberFormat("zh-TW", { maximumFractionDigits: digits }).format(value);

function formatTime(value: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return "來源未提供";
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).format(new Date(value));
}

export default function PrivateQuotePage() {
  const [tokenInput, setTokenInput] = useState("");
  const [token, setToken] = useState("");
  const [providerReady, setProviderReady] = useState(false);
  const [code, setCode] = useState("0050");
  const [selectedCode, setSelectedCode] = useState("");
  const [payload, setPayload] = useState<PrivateQuotePayload | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [showEntry, setShowEntry] = useState(false);
  const [storageMessage, setStorageMessage] = useState("");
  const [now, setNow] = useState(0);
  const pending = useRef<AbortController | null>(null);
  const generation = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setNow(Date.now());
      try { setShowEntry(localStorage.getItem(PRIVATE_QUOTE_ENTRY_KEY) === "1"); } catch { /* Preference is optional. */ }
    }, 0);
    const clock = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => { window.clearTimeout(timer); window.clearInterval(clock); pending.current?.abort(); };
  }, []);

  const lock = useCallback(() => {
    generation.current += 1;
    pending.current?.abort();
    setToken(""); setTokenInput(""); setPayload(null); setSelectedCode("");
    setProviderReady(false); setAutoRefresh(false); setBusy(false); setError("");
  }, []);

  const setEntryPreference = (enabled: boolean) => {
    try {
      if (enabled) localStorage.setItem(PRIVATE_QUOTE_ENTRY_KEY, "1");
      else localStorage.removeItem(PRIVATE_QUOTE_ENTRY_KEY);
      setShowEntry(enabled);
      setStorageMessage(enabled ? "首頁入口已開啟，只影響這個瀏覽器。" : "首頁入口已隱藏，仍可用直接網址開啟。");
    } catch { setStorageMessage("瀏覽器不允許儲存設定，仍可用直接網址開啟。"); }
  };

  const unlock = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextToken = tokenInput.trim();
    if (!nextToken) { setError("請輸入私人報價通行碼。"); return; }
    const current = ++generation.current;
    pending.current?.abort();
    const controller = new AbortController(); pending.current = controller;
    setBusy(true); setError("");
    try {
      const status = await unlockPrivateQuotes(nextToken, controller.signal);
      if (controller.signal.aborted || current !== generation.current) return;
      if (typeof status.enabled !== "boolean") throw new Error("報價服務回傳格式不正確。");
      setToken(nextToken); setTokenInput(""); setProviderReady(status.enabled);
    } catch (caught) {
      if (!controller.signal.aborted && current === generation.current) setError(caught instanceof Error ? caught.message : "驗證失敗。");
    } finally { if (current === generation.current) setBusy(false); }
  };

  const loadQuote = useCallback(async (requestedCode: string) => {
    const normalized = normalizeStockCode(requestedCode);
    if (!isSupportedStockCode(normalized)) { setError("請輸入正確的上市／上櫃股票或 ETF 代碼。"); setAutoRefresh(false); return; }
    if (!token || !providerReady || busy) return;
    const current = ++generation.current;
    pending.current?.abort();
    const controller = new AbortController(); pending.current = controller;
    setBusy(true); setError("");
    if (normalized !== selectedCode) setPayload(null);
    setSelectedCode(normalized);
    try {
      const result = await fetchPrivateQuote(normalized, token, controller.signal);
      if (controller.signal.aborted || current !== generation.current) return;
      if (!result.quote || result.quote.code !== normalized || !result.fetchedAt) throw new Error("報價服務回傳格式不正確。");
      setPayload(result); setNow(Date.now());
    } catch (caught) {
      if (controller.signal.aborted || current !== generation.current) return;
      setAutoRefresh(false);
      if (caught instanceof PrivateQuoteError && caught.status === 401) {
        lock();
        setError("驗證已失效，請重新輸入通行碼。");
      } else setError(caught instanceof Error ? caught.message : "行情讀取失敗。");
    } finally { if (current === generation.current) setBusy(false); }
  }, [token, providerReady, busy, selectedCode, lock]);

  useEffect(() => {
    if (!autoRefresh || !token || !providerReady || !selectedCode) return;
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadQuote(selectedCode);
    }, 60_000);
    return () => window.clearInterval(interval);
  }, [autoRefresh, token, providerReady, selectedCode, loadQuote]);

  const quoteTime = payload?.quote.quoteTime ? Date.parse(payload.quote.quoteTime) : NaN;
  const olderQuote = Boolean(payload && (!Number.isFinite(quoteTime) || now - quoteTime > 5 * 60_000));

  return (
    <main className="private-quote-shell">
      <a className="private-quote-home" href="../?v=private-quotes-v1">← 返回首頁</a>
      <header className="private-quote-header">
        <span className="eyebrow">個人測試</span>
        <h1>即時報價測試</h1>
        <p>輸入通行碼後才能讀取行情。首頁入口預設隱藏。</p>
      </header>

      <section className="card private-quote-card">
        <h2>首頁入口</h2>
        <label className="private-quote-check"><input type="checkbox" checked={showEntry} onChange={(event) => setEntryPreference(event.target.checked)} />在這個瀏覽器的首頁顯示私人報價入口</label>
        <p>這個設定只控制入口，行情仍需通行碼。第一次使用可直接開啟本頁，再啟用入口。</p>
        {storageMessage && <p role="status">{storageMessage}</p>}
      </section>

      {!token ? <section className="card private-quote-card">
        <h2>開啟私人報價</h2>
        <form onSubmit={unlock} className="private-quote-form">
          <label htmlFor="quote-token">私人通行碼</label>
          <input id="quote-token" type="password" autoComplete="off" value={tokenInput} onChange={(event) => setTokenInput(event.target.value)} maxLength={256} required disabled={busy} />
          <button className="primary-button" type="submit" disabled={busy}>{busy ? "驗證中…" : "解鎖報價"}</button>
        </form>
        <p>通行碼不寫入網址或瀏覽器儲存空間，重新整理後需再次輸入。</p>
      </section> : <section className="card private-quote-card">
        <div className="private-quote-heading"><h2>私人行情</h2><button type="button" className="private-quote-secondary" onClick={lock}>鎖定並清除行情</button></div>
        {!providerReady ? <p role="status">存取驗證已通過。行情來源尚未啟用，需先設定資料商 API 金鑰；目前不會顯示或下載即時股價。</p> : <>
          <form className="private-quote-form" onSubmit={(event) => { event.preventDefault(); setAutoRefresh(false); void loadQuote(code); }}>
            <label htmlFor="quote-code">股票／ETF 代碼</label>
            <input id="quote-code" value={code} onChange={(event) => setCode(event.target.value)} maxLength={6} autoComplete="off" disabled={busy} />
            <button className="primary-button" type="submit" disabled={busy}>{busy ? "讀取中…" : "查詢報價"}</button>
          </form>
          <label className="private-quote-check"><input type="checkbox" checked={autoRefresh} disabled={!selectedCode || busy} onChange={(event) => setAutoRefresh(event.target.checked)} />每 60 秒更新目前這一檔（頁面在背景時暫停）</label>
        </>}
      </section>}

      {error && <p className="private-quote-error" role="alert">{error} 已暫停自動更新。</p>}
      {payload && <section className="card private-quote-card" aria-live="polite">
        <div className="private-quote-heading"><h2>{payload.quote.code}　{payload.quote.name}</h2><span>{payload.quote.market === "TPEx" ? "上櫃" : "上市"}</span></div>
        {olderQuote && <p className="private-quote-stale">行情時間較舊或未提供，可能已收盤、暫無成交或尚未更新。請勿視為目前成交價。</p>}
        {error && <p>以下為上次成功取得的行情。</p>}
        <div className="private-quote-price">{formatNumber(payload.quote.price)}<small> 元</small></div>
        <dl className="private-quote-metrics">
          <div><dt>漲跌</dt><dd>{formatNumber(payload.quote.change)}</dd></div>
          <div><dt>漲跌幅</dt><dd>{formatNumber(payload.quote.changePercent)}{payload.quote.changePercent === null ? "" : "%"}</dd></div>
          <div><dt>成交量（張）</dt><dd>{formatNumber(payload.quote.volume, 0)}</dd></div>
          <div><dt>行情資料日</dt><dd>{payload.quote.tradingDate || "來源未提供"}</dd></div>
          <div><dt>來源行情時間</dt><dd>{formatTime(payload.quote.quoteTime)}</dd></div>
          <div><dt>本次讀取時間</dt><dd>{formatTime(payload.fetchedAt)}</dd></div>
        </dl>
        <p>來源：{payload.source}。更新頻率是本頁讀取間隔，實際行情時間以來源為準。</p>
      </section>}
      <p className="private-quote-note">本頁供個人測試，未接入真實下單、虛擬帳戶成交或策略分數。</p>
    </main>
  );
}
