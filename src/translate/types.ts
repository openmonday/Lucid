import type { EngineId, LlmApiStyle } from "../shared.ts";

/** Resolved engine configuration for one translation run. */
export interface EngineSettings {
  engine: EngineId;
  llmBaseUrl: string;
  llmModel: string;
  llmApi: LlmApiStyle;
  llmApiKey: string;
  llmFallback: boolean;
}

/**
 * A translation backend.
 *
 * Adding a new backend (DeepL, Youdao, a local model, ...) means writing one
 * module that exports this interface and registering it in `./index.ts`.
 * Callers never branch on the engine id.
 */
export interface TranslationProvider {
  readonly id: EngineId;
  readonly label: string;
  /**
   * Cache discriminator. Two results with the same signature are
   * interchangeable, so it must change whenever model, prompt, or protocol
   * changes — otherwise stale translations survive a configuration change.
   */
  signature(settings: EngineSettings): string;
  /** Translate every text, returning one translation per input in order. */
  translate(texts: string[], target: string, settings: EngineSettings): Promise<string[]>;
}

/** Input rejected before any network call (bad configuration, unsupported text). */
export class ConfigError extends Error {}
