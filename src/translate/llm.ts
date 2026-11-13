import { LANGUAGES } from "../shared.ts";
import { glossaryLines } from "./glossary.ts";
import { ConfigError, type EngineSettings, type TranslationProvider } from "./types.ts";

/**
 * LLM backend speaking either the OpenAI Responses API or the older chat
 * completions API, so any OpenAI-compatible gateway can be used.
 *
 * Blocks are sent as one JSON request per batch: one round trip for up to
 * MAX_SEGMENTS blocks keeps latency and token overhead down (a system prompt
 * per block would dominate a short article).
 */

/** Bump on any prompt or protocol change; part of the cache signature. */
export const PROMPT_VERSION = 1;
const MAX_SEGMENTS = 12;
const MAX_CHARS = 4_000;
const CONCURRENCY = 2;
const TIMEOUT = 45_000;
const RETRY_DELAY = 800;
const PLACEHOLDER = /\[ZT_KEEP_\d+]/g;

function languageName(target: string): string {
  return LANGUAGES.find(([code]) => code === target)?.[1] ?? target;
}

export function buildSystemPrompt(target: string, count: number): string {
  const language = languageName(target);
  const glossary = glossaryLines(target);
  return [
    `You translate web page text into ${language}.`,
    "",
    "Rules:",
    `1. Reply with JSON only: {"translations": [...]} containing exactly ${count} strings, in input order.`,
    "2. Translate faithfully and readably. Never add notes, explanations, transliterations, or extra sentences.",
    "3. Copy these verbatim: [ZT_KEEP_<n>] placeholders, URLs, e-mail addresses, numbers and units, inline code, code identifiers (snake_case, camelCase, kebab-case, dotted.paths, foo()), and product/API/language names.",
    "4. Use established software-engineering terminology instead of word-by-word renderings. Headings and short labels are terminology, not prose to paraphrase.",
    "5. Preserve the paragraph count: one input segment yields one output string.",
    ...(glossary ? ["", glossary] : []),
  ].join("\n");
}

export function buildUserPayload(segments: string[]): string {
  return JSON.stringify({ segments });
}

/** Extract the translations array from a model reply, or null when unusable. */
export function parseTranslations(raw: string, expected: number): string[] | null {
  const text = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let data: unknown;
  try {
    data = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  const list = (data as { translations?: unknown })?.translations;
  if (!Array.isArray(list) || list.length !== expected) return null;
  if (!list.every(item => typeof item === "string" && item.trim() !== "")) return null;
  return list as string[];
}

/** Placeholders the translation dropped or invented. Empty means intact. */
export function placeholderDiff(source: string, translated: string): string[] {
  const of = (text: string) => [...new Set(text.match(PLACEHOLDER) ?? [])].sort();
  const wanted = of(source);
  const found = of(translated);
  return [
    ...wanted.filter(token => !found.includes(token)),
    ...found.filter(token => !wanted.includes(token)),
  ];
}

function split(texts: string[]): string[][] {
  const batches: string[][] = [];
  let batch: string[] = [];
  let size = 0;
  for (const text of texts) {
    if (batch.length && (batch.length >= MAX_SEGMENTS || size + text.length > MAX_CHARS)) {
      batches.push(batch);
      batch = [];
      size = 0;
    }
    batch.push(text);
    size += text.length;
  }
  if (batch.length) batches.push(batch);
  return batches;
}

async function postJson(url: string, key: string, body: unknown, attempt = 0): Promise<unknown> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300).trim();
    const retryable = response.status === 429 || response.status >= 500;
    if (retryable && attempt === 0) {
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return postJson(url, key, body, 1);
    }
    throw new Error(`LLM ${response.status}${detail ? `: ${detail}` : ""}`);
  }
  return response.json();
}

export function responseText(data: unknown): string {
  const payload = data as { output_text?: unknown; output?: unknown };
  if (typeof payload.output_text === "string") return payload.output_text;
  // Some gateways omit the convenience field; walk the raw Responses output.
  if (!Array.isArray(payload.output)) return "";
  const parts: string[] = [];
  for (const item of payload.output) {
    const content = (item as { content?: unknown })?.content;
    if (!Array.isArray(content)) continue;
    for (const piece of content) {
      const text = (piece as { text?: unknown })?.text;
      if (typeof text === "string") parts.push(text);
    }
  }
  return parts.join("");
}

export function chatText(data: unknown): string {
  const choice = (data as { choices?: unknown })?.choices;
  if (!Array.isArray(choice)) return "";
  const content = (choice[0] as { message?: { content?: unknown } })?.message?.content;
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.map(part => (typeof (part as { text?: unknown })?.text === "string" ? (part as { text: string }).text : "")).join("");
}

function requestBody(settings: EngineSettings, system: string, user: string) {
  if (settings.llmApi === "chat") {
    return {
      model: settings.llmModel,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    };
  }
  return {
    model: settings.llmModel,
    instructions: system,
    input: user,
    max_output_tokens: 8_000,
  };
}

async function translateBatch(segments: string[], target: string, settings: EngineSettings): Promise<string[]> {
  const base = settings.llmBaseUrl.replace(/\/+$/, "");
  const url = settings.llmApi === "chat" ? `${base}/chat/completions` : `${base}/responses`;
  const system = buildSystemPrompt(target, segments.length);
  const data = await postJson(url, settings.llmApiKey, requestBody(settings, system, buildUserPayload(segments)));
  const raw = settings.llmApi === "chat" ? chatText(data) : responseText(data);
  const parsed = parseTranslations(raw, segments.length);
  if (parsed && parsed.every((text, i) => placeholderDiff(segments[i], text).length === 0)) return parsed;

  // One bad segment should not cost the whole batch: retry the failures alone,
  // which also gives the model the best chance of keeping placeholders intact.
  const results = new Array<string>(segments.length);
  if (parsed) results.splice(0, results.length, ...parsed);
  const failed = segments.map((_, i) => i).filter(i => !results[i] || placeholderDiff(segments[i].trim(), results[i]).length);
  for (const index of failed) {
    const one = await postJson(url, settings.llmApiKey, requestBody(settings, buildSystemPrompt(target, 1), buildUserPayload([segments[index]])));
    const single = parseTranslations(settings.llmApi === "chat" ? chatText(one) : responseText(one), 1);
    if (!single || placeholderDiff(segments[index], single[0]).length) {
      throw new Error("LLM returned an unusable translation");
    }
    results[index] = single[0];
  }
  return results;
}

export const llmProvider: TranslationProvider = {
  id: "llm",
  label: "Custom LLM (OpenAI-compatible)",

  signature: settings => `llm:${settings.llmModel}:${settings.llmApi}:p${PROMPT_VERSION}`,

  async translate(texts, target, settings) {
    if (!settings.llmApiKey) throw new ConfigError("Add an LLM API key in the Lucid options page");
    if (!settings.llmBaseUrl || !settings.llmModel) throw new ConfigError("Set the LLM base URL and model");

    const batches = split(texts);
    const results = new Array<string[]>(batches.length);
    let next = 0;
    const worker = async () => {
      for (;;) {
        const index = next++;
        if (index >= batches.length) return;
        results[index] = await translateBatch(batches[index], target, settings);
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, batches.length) }, worker));
    return results.flat();
  },
};
