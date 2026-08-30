import type { LlmModelId, LlmProviderId } from "./llm";
import { DEFAULT_DEEPSEEK_MODEL, isDeepSeekModel } from "./llm";
import type { AlertRule, DeskCurrency } from "./types";

const WATCH_KEY = "jarkkocomms-watchlist";
const ALERT_KEY = "jarkkocomms-alerts";
const FX_KEY = "jarkkocomms-fx";
const QUOTE_KEY = "jarkkocomms-last-quotes";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function loadWatchlist() {
  return read<string[]>(WATCH_KEY, ["CL=F", "BZ=F", "NG=F", "GC=F"]);
}

export function saveWatchlist(symbols: string[]) {
  localStorage.setItem(WATCH_KEY, JSON.stringify(symbols));
}

export function loadAlerts() {
  return read<AlertRule[]>(ALERT_KEY, []);
}

export function saveAlerts(alerts: AlertRule[]) {
  localStorage.setItem(ALERT_KEY, JSON.stringify(alerts));
}

export function loadCurrency(): DeskCurrency {
  const value = read<DeskCurrency | null>(FX_KEY, null);
  return value === "EUR" || value === "GBP" || value === "JPY" || value === "CHF" || value === "USD" ? value : "EUR";
}

export function saveCurrency(currency: DeskCurrency) {
  localStorage.setItem(FX_KEY, JSON.stringify(currency));
}

export function loadCachedQuotes() {
  return read<{ quotes: import("./types").Quote[]; fetchedAt: number } | null>(QUOTE_KEY, null);
}

export function saveCachedQuotes(quotes: import("./types").Quote[], fetchedAt: number) {
  localStorage.setItem(QUOTE_KEY, JSON.stringify({ quotes, fetchedAt }));
}

const KEY_KEY = "jarkkocomms-deepseek-key";
const MODEL_KEY = "jarkkocomms-llm-model";
const PROVIDER_KEY = "jarkkocomms-llm-provider";

export function loadDeepSeekKey() {
  try {
    return localStorage.getItem(KEY_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveDeepSeekKey(key: string) {
  if (!key) {
    localStorage.removeItem(KEY_KEY);
    return;
  }
  localStorage.setItem(KEY_KEY, key);
}

export function loadLlmModel(): LlmModelId {
  try {
    const value = localStorage.getItem(MODEL_KEY);
    return isDeepSeekModel(value) ? value : DEFAULT_DEEPSEEK_MODEL;
  } catch {
    return DEFAULT_DEEPSEEK_MODEL;
  }
}

export function saveLlmModel(model: LlmModelId) {
  localStorage.setItem(MODEL_KEY, model);
}

export function loadLlmProvider(): LlmProviderId {
  try {
    const value = localStorage.getItem(PROVIDER_KEY);
    return value === "openai" || value === "azure" || value === "deepseek" ? value : "deepseek";
  } catch {
    return "deepseek";
  }
}

export function saveLlmProvider(provider: LlmProviderId) {
  localStorage.setItem(PROVIDER_KEY, provider);
}
