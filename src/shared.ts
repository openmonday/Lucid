export const DEFAULT_TARGET = "zh-Hans";
export const LANGUAGES: [string, string][] = [
  ["zh-Hans", "Chinese (Simplified)"],
  ["zh-Hant", "Chinese (Traditional)"],
  ["en", "English"],
  ["ja", "Japanese"],
  ["ko", "Korean"],
  ["fr", "French"],
  ["de", "German"],
  ["es", "Spanish"],
  ["ru", "Russian"],
];

export const DEFAULT_THEME = "default";
export const DEFAULT_DARK_MODE = true;
export const THEMES: [string, string][] = [
  ["default", "Plain"],
  ["claude", "Claude"],
];

export type TranslationScope = "main" | "all";
export const DEFAULT_TRANSLATION_SCOPE: TranslationScope = "main";
export const TRANSLATION_SCOPES: [TranslationScope, string][] = [
  ["main", "Main content"],
  ["all", "Whole page"],
];

export type EngineId = "microsoft" | "llm";
export const DEFAULT_ENGINE: EngineId = "microsoft";
export const ENGINES: [EngineId, string][] = [
  ["microsoft", "Microsoft Translator (free, no setup)"],
  ["llm", "Custom LLM (OpenAI-compatible)"],
];

/** `responses` is the OpenAI Responses API; `chat` is /chat/completions. */
export type LlmApiStyle = "responses" | "chat";
export const LLM_APIS: [LlmApiStyle, string][] = [
  ["responses", "Responses API (/responses)"],
  ["chat", "Chat completions (/chat/completions)"],
];
export const DEFAULT_LLM_BASE_URL = "https://api.apikey.fan/v1";
export const DEFAULT_LLM_MODEL = "gpt-6.1-terra";
export const DEFAULT_LLM_API: LlmApiStyle = "responses";
export const DEFAULT_LLM_FALLBACK = true;
/** Stored in `chrome.storage.local`, never in sync. */
export const LLM_API_KEY_KEY = "llmApiKey";

export type Request =
  | { type: "translate"; texts: string[] }
  | { type: "toggle" }
  | { type: "toggle-active" };
export type TranslateResponse =
  | { ok: true; translations: string[] }
  | { ok: false; error: string };

export type FetchStylesheetRequest = {
  type: "fetch-stylesheet";
  url: string;
};
export type FetchStylesheetResponse =
  | { ok: true; text: string; contentType: string }
  | { ok: false; error: string };

export function needsTranslation(text: string, target: string): boolean {
  if (!/\p{L}/u.test(text)) return false;
  if (target.startsWith("zh") && /\p{Script=Han}/u.test(text) && !/[A-Za-z]{3}/.test(text)) return false;
  return true;
}
