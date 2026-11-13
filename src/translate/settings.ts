import {
  DEFAULT_ENGINE,
  DEFAULT_LLM_API,
  DEFAULT_LLM_BASE_URL,
  DEFAULT_LLM_FALLBACK,
  DEFAULT_LLM_MODEL,
  LLM_API_KEY_KEY,
  type EngineId,
  type LlmApiStyle,
} from "../shared.ts";
import type { EngineSettings } from "./types.ts";

/**
 * Settings live in two places on purpose:
 * - `chrome.storage.sync` for non-secret preferences, so they follow the user
 *   across devices;
 * - `chrome.storage.local` for the API key, so a credential is never uploaded
 *   to the browser profile's sync account.
 */
export async function loadEngineSettings(): Promise<EngineSettings> {
  const sync = (await chrome.storage.sync.get({
    engine: DEFAULT_ENGINE,
    llmBaseUrl: DEFAULT_LLM_BASE_URL,
    llmModel: DEFAULT_LLM_MODEL,
    llmApi: DEFAULT_LLM_API,
    llmFallback: DEFAULT_LLM_FALLBACK,
  })) as {
    engine?: string;
    llmBaseUrl?: string;
    llmModel?: string;
    llmApi?: string;
    llmFallback?: boolean;
  };
  const local = (await chrome.storage.local.get({ [LLM_API_KEY_KEY]: "" })) as Record<string, string | undefined>;
  return {
    engine: sync.engine === "llm" ? "llm" : "microsoft",
    llmBaseUrl: (sync.llmBaseUrl ?? DEFAULT_LLM_BASE_URL).trim() || DEFAULT_LLM_BASE_URL,
    llmModel: (sync.llmModel ?? DEFAULT_LLM_MODEL).trim() || DEFAULT_LLM_MODEL,
    llmApi: sync.llmApi === "chat" ? "chat" : "responses",
    llmFallback: sync.llmFallback !== false,
    llmApiKey: (local[LLM_API_KEY_KEY] ?? "").trim(),
  };
}

export async function saveEngineSettings(settings: EngineSettings): Promise<void> {
  await chrome.storage.sync.set({
    engine: settings.engine,
    llmBaseUrl: settings.llmBaseUrl.trim(),
    llmModel: settings.llmModel.trim(),
    llmApi: settings.llmApi,
    llmFallback: settings.llmFallback,
  });
  await chrome.storage.local.set({ [LLM_API_KEY_KEY]: settings.llmApiKey.trim() });
}

export type { EngineId, LlmApiStyle };
