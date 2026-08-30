import type { Lang } from "./i18n";

export type VoiceCommand =
  | { type: "select"; symbol: string }
  | { type: "watch"; symbol: string }
  | { type: "fx"; currency: "EUR" | "USD" }
  | { type: "speak" }
  | { type: "speakOil" };

type RecognitionCtor = new () => SpeechRecognitionLike;

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

declare global {
  interface Window {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  }
}

const NAME_MAP: { re: RegExp; symbol: string }[] = [
  { re: /brent|brentiä/, symbol: "BZ=F" },
  { re: /gasoline|bensiini|rbob/, symbol: "RB=F" },
  { re: /maakaasu|nat gas|henry hub|\bng\b/, symbol: "NG=F" },
  { re: /heating|lämmitys|ulsd|\bho\b/, symbol: "HO=F" },
  { re: /\bwti\b|raakaöljy|crude/, symbol: "CL=F" },
  { re: /gold|kulta/, symbol: "GC=F" },
  { re: /silver|hopea/, symbol: "SI=F" },
  { re: /copper|kupari/, symbol: "HG=F" },
  { re: /platina|platinum/, symbol: "PL=F" },
  { re: /palladium|pallad/, symbol: "PA=F" },
  { re: /corn|maissi/, symbol: "ZC=F" },
  { re: /soy|soija/, symbol: "ZS=F" },
  { re: /wheat|vehnä/, symbol: "ZW=F" },
  { re: /coffee|kahvi/, symbol: "KC=F" },
  { re: /sugar|sokeri/, symbol: "SB=F" },
  { re: /cocoa|kaakao/, symbol: "CC=F" },
];

export function speechSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

export function recognitionSupported() {
  return recognitionCtor() != null;
}

function pickVoice(lang: string) {
  const voices = window.speechSynthesis.getVoices();
  const prefix = lang.slice(0, 2).toLowerCase();
  return (
    voices.find((voice) => voice.lang.toLowerCase().startsWith(lang.toLowerCase())) ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith(prefix)) ??
    null
  );
}

export function speakText(text: string, lang: Lang) {
  if (!speechSupported()) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang === "fi" ? "fi-FI" : "en-US";
  const voice = pickVoice(utterance.lang);
  if (voice) utterance.voice = voice;
  window.speechSynthesis.speak(utterance);
}

export function stopSpeech() {
  if (speechSupported()) window.speechSynthesis.cancel();
}

export function parseVoiceCommand(raw: string): VoiceCommand | null {
  const text = raw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  if (!text) return null;

  if (/(lue hinta|read price|lue noteeraus)/.test(text)) return { type: "speak" };
  if (/(lue oljy|read oil|oil board)/.test(text) || (/\boljy\b/.test(text) && !/raaka/.test(text))) {
    return { type: "speakOil" };
  }
  if (/(eurot|euroissa|euros|euro)/.test(text)) return { type: "fx", currency: "EUR" };
  if (/(dollarit|dollareissa|dollars|dollar)/.test(text)) return { type: "fx", currency: "USD" };

  const watch = /(watch|seuraa)/.test(text);
  const match = NAME_MAP.find((item) => item.re.test(text));
  if (match && watch) return { type: "watch", symbol: match.symbol };
  if (match) return { type: "select", symbol: match.symbol };
  return null;
}

export function listenOnce(lang: Lang): Promise<string> {
  const Ctor = recognitionCtor();
  if (!Ctor) return Promise.reject(new Error("Speech recognition is not available"));
  return new Promise((resolve, reject) => {
    const rec = new Ctor();
    rec.lang = lang === "fi" ? "fi-FI" : "en-US";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.continuous = false;
    rec.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? "";
      resolve(transcript);
    };
    rec.onerror = (event) => {
      reject(new Error(event.error || "listen failed"));
    };
    rec.onend = () => undefined;
    rec.start();
  });
}
