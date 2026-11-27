// Microsoft Translator via the public Bing Translator page.
// Adapted from agent/plugins/pi-bridge/src/core/translator.ts for an MV3 service worker:
// the browser cookie jar replaces manual Cookie handling, and Origin/Referer are set by rules.json.
import type { TranslationProvider } from "./types.ts";

const PAGE = "https://www.bing.com/translator";
const AUTH_MARGIN = 60_000;
const AUTH_TIMEOUT = 15_000;
const REQUEST_TIMEOUT = 25_000;
const CONCURRENCY = 4;
const MAX_REQUEST = 4_000;

interface Session { origin: string; ig: string; iid: string; key: string; token: string; expires: number }
class StaleSession extends Error {}

function parseSession(html: string, page: string): Session {
  const abuse = /params_AbusePreventionHelper\s*=\s*\[\s*(\d+)\s*,\s*"([^"]+)"\s*,\s*(\d+)\s*]/.exec(html);
  const ig = /IG\s*:\s*"([A-Fa-f0-9]+)"/.exec(html);
  const iid = /data-iid\s*=\s*"([^"]+)"/.exec(html);
  if (!abuse || !ig || !iid) throw new Error("Could not read the Microsoft Translator session");
  return {
    origin: new URL(page).origin,
    ig: ig[1], iid: iid[1], key: abuse[1], token: abuse[2],
    expires: Date.now() + Math.max(60_000, Number(abuse[3]) - AUTH_MARGIN),
  };
}

async function loadSession(): Promise<Session> {
  const response = await fetch(PAGE, { credentials: "include", signal: AbortSignal.timeout(AUTH_TIMEOUT) });
  if (!response.ok) throw new Error(`Microsoft Translator page returned HTTP ${response.status}`);
  return parseSession(await response.text(), response.url || PAGE);
}

async function request(text: string, target: string, session: Session): Promise<string> {
  const url = new URL("/ttranslatev3", session.origin);
  url.searchParams.set("isVertical", "1");
  url.searchParams.set("IG", session.ig);
  url.searchParams.set("IID", session.iid);
  const response = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token: session.token, key: session.key, text, fromLang: "auto-detect", to: target }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT),
  });
  if (response.status === 401 || response.status === 403) throw new StaleSession(`HTTP ${response.status}`);
  if (!response.ok) throw new Error(`Microsoft Translator returned HTTP ${response.status}`);
  const raw = await response.text();
  if (!raw.trim()) throw new StaleSession("empty response");
  let data: unknown;
  try { data = JSON.parse(raw); } catch { throw new StaleSession("invalid response (session may have expired)"); }
  const translated = Array.isArray(data) ? (data[0] as any)?.translations?.[0]?.text : undefined;
  if (typeof translated !== "string" || !translated.trim()) throw new StaleSession("empty translation");
  return translated;
}

function split(text: string, limit = MAX_REQUEST): string[] {
  if (text.length <= limit) return [text];
  const parts: string[] = [];
  let rest = text;
  while (rest.length > limit) {
    const w = rest.slice(0, limit + 1);
    let end = Math.max(w.lastIndexOf("\n\n"), w.lastIndexOf(". "), w.lastIndexOf("\u3002"), w.lastIndexOf(" "));
    if (end < limit / 2) end = limit;
    const open = rest.lastIndexOf("[ZT_KEEP_", end);
    if (open >= 0 && rest.indexOf("]", open) >= end) end = open;
    if (end <= 0) end = limit;
    parts.push(rest.slice(0, end));
    rest = rest.slice(end);
  }
  if (rest) parts.push(rest);
  return parts;
}

let session: Session | undefined;
let loading: Promise<Session> | undefined;

function authenticate(force = false): Promise<Session> {
  if (force) session = undefined;
  if (session && Date.now() < session.expires) return Promise.resolve(session);
  loading ??= loadSession().then(s => (session = s)).finally(() => { loading = undefined; });
  return loading;
}

async function translateText(text: string, target: string): Promise<string> {
  if (!text) return "";
  for (let attempt = 0; ; attempt++) {
    const current = await authenticate(attempt > 0);
    try {
      return await request(text, target, current);
    } catch (error) {
      if (attempt === 0 && error instanceof StaleSession) continue;
      throw error;
    }
  }
}

/** Free default engine: no key, no quota, and the same endpoint as Bing's page. */
export const microsoftProvider: TranslationProvider = {
  id: "microsoft",
  label: "Microsoft Translator",
  signature: () => "microsoft",
  translate: translateMany,
};

async function translateMany(texts: string[], target: string): Promise<string[]> {
  const results = new Array<string>(texts.length);
  let next = 0;
  const worker = async () => {
    for (;;) {
      const i = next++;
      if (i >= texts.length) return;
      const out: string[] = [];
      for (const part of split(texts[i])) out.push(await translateText(part, target));
      results[i] = out.join(" ");
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, texts.length) }, worker));
  return results;
}
