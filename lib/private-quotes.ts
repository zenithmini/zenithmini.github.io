export const PRIVATE_QUOTE_ENTRY_KEY = "tw-signal-private-quote-entry";

const API_BASE = (process.env.NEXT_PUBLIC_SIGNAL_API_URL ||
  "https://tw-stock-signal-api.market-signal-tools.workers.dev").replace(/\/$/, "");

export type PrivateQuote = {
  code: string;
  name: string;
  market: "TWSE" | "TPEx";
  price: number | null;
  change: number | null;
  changePercent: number | null;
  volume: number | null;
  quoteTime: string | null;
  tradingDate: string;
};

export type PrivateQuotePayload = {
  quote: PrivateQuote;
  fetchedAt: string;
  source: string;
};

export class PrivateQuoteError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "PrivateQuoteError";
  }
}

async function requestPrivateQuote<T>(path: string, token: string, signal: AbortSignal, method = "GET"): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}` },
    credentials: "omit",
    cache: "no-store",
    referrerPolicy: "no-referrer",
    signal,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = response.status === 401
      ? "通行碼無效，或私人報價尚未設定。"
      : typeof payload?.error === "string" ? payload.error : "報價服務暫時無法使用，請稍後再試。";
    throw new PrivateQuoteError(message, response.status);
  }
  if (!payload || typeof payload !== "object") throw new PrivateQuoteError("報價服務回傳格式不正確。", 502);
  return payload as T;
}

export const unlockPrivateQuotes = (token: string, signal: AbortSignal) =>
  requestPrivateQuote<{ enabled: boolean; provider: string }>("/api/private/quotes/session", token, signal, "POST");

export const fetchPrivateQuote = (code: string, token: string, signal: AbortSignal) =>
  requestPrivateQuote<PrivateQuotePayload>(`/api/private/quotes?code=${encodeURIComponent(code)}`, token, signal);
