import type { EngineId } from "../shared.ts";
import { llmProvider } from "./llm.ts";
import { microsoftProvider } from "./microsoft.ts";
import type { EngineSettings, TranslationProvider } from "./types.ts";

/**
 * Engine registry. To add a backend, write a `TranslationProvider` module and
 * append it here plus to `ENGINES` in `../shared` (the options page renders
 * that list). Nothing else in the extension knows about specific engines.
 */
export const PROVIDERS: readonly TranslationProvider[] = [microsoftProvider, llmProvider];

export function providerFor(engine: EngineId): TranslationProvider {
  const provider = PROVIDERS.find(candidate => candidate.id === engine);
  if (!provider) throw new Error(`Unknown translation engine: ${engine}`);
  return provider;
}

/** Cache key prefix for the engine a run would use before any fallback. */
export function signatureFor(settings: EngineSettings): string {
  return providerFor(settings.engine).signature(settings);
}

export interface TranslateOutcome {
  translations: string[];
  /** Signature of the engine that produced these translations. */
  signature: string;
  /** True when the configured engine failed and Microsoft Translator answered. */
  fellBack: boolean;
}

export async function translateTexts(
  texts: string[],
  target: string,
  settings: EngineSettings,
): Promise<TranslateOutcome> {
  const empty = (text: string) => !text.trim();
  if (texts.every(empty)) return { translations: texts.map(() => ""), signature: signatureFor(settings), fellBack: false };

  // Empty blocks would confuse a batch protocol; keep their slots and skip them.
  const indexes = texts.map((text, index) => (empty(text) ? -1 : index)).filter(index => index >= 0);
  const payload = indexes.map(index => texts[index]);

  const primary = providerFor(settings.engine);
  try {
    const translated = await primary.translate(payload, target, settings);
    return merge(texts, indexes, translated, primary.signature(settings), false);
  } catch (error) {
    const canFallBack = settings.llmFallback && primary.id !== microsoftProvider.id;
    if (!canFallBack) throw error;
    try {
      const translated = await microsoftProvider.translate(payload, target, settings);
      return merge(texts, indexes, translated, microsoftProvider.signature(settings), true);
    } catch (fallbackError) {
      throw new Error(`${primary.label} failed (${message(error)}); Microsoft Translator also failed (${message(fallbackError)})`);
    }
  }
}

function merge(
  texts: string[],
  indexes: number[],
  translated: string[],
  signature: string,
  fellBack: boolean,
): TranslateOutcome {
  if (translated.length !== indexes.length) {
    throw new Error(`Engine returned ${translated.length} translations for ${indexes.length} blocks`);
  }
  const translations = texts.map(() => "");
  indexes.forEach((index, position) => { translations[index] = translated[position]; });
  return { translations, signature, fellBack };
}

function message(error: unknown): string {
  return String((error as Error)?.message ?? error);
}
