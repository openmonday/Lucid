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

/** Resolved engine configuration for one translation run. */
export interface EngineSettings {
  engine: EngineId;
  llmBaseUrl: string;
  llmModel: string;
  llmApi: LlmApiStyle;
  llmApiKey: string;
  llmFallback: boolean;
}
