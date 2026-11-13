import { signatureFor, translateTexts } from "./translate/index.ts";
import { loadEngineSettings } from "./translate/settings.ts";
import {
  DEFAULT_TARGET,
  type FetchStylesheetRequest,
  type FetchStylesheetResponse,
  type Request,
  type TranslateResponse,
} from "./shared.ts";

// ---- translation with a persistent cache ----
// v2 keys include the engine signature (engine, model, prompt version):
// switching engines must never serve the previous engine's wording.
const CACHE_KEY = "cache-v2";
const CACHE_MAX = 3000;
let cache: Map<string, string> | undefined;
let saveTimer: ReturnType<typeof setTimeout> | undefined;

async function loadCache() {
  if (!cache) {
    const data = await chrome.storage.local.get(CACHE_KEY);
    cache = new Map(Array.isArray(data[CACHE_KEY]) ? data[CACHE_KEY] : []);
    // One-time cleanup of the pre-v2 cache, whose keys carry no engine signature.
    if (typeof chrome.storage.local.remove === "function") void chrome.storage.local.remove("cache-v1");
  }
  return cache;
}
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => chrome.storage.local.set({ [CACHE_KEY]: [...cache!] }), 1000);
}

async function translate(texts: string[]): Promise<string[]> {
  const settings = await loadEngineSettings();
  const { target } = (await chrome.storage.sync.get({ target: DEFAULT_TARGET })) as { target: string };
  const store = await loadCache();
  const key = (signature: string, text: string) => `${signature}\0${target}\0${text}`;

  const signature = signatureFor(settings);
  const pending = [...new Set(texts.filter(t => !store.has(key(signature, t))))];
  const fresh = new Map<string, string>();
  if (pending.length) {
    const outcome = await translateTexts(pending, target, settings);
    pending.forEach((text, i) => {
      fresh.set(text, outcome.translations[i]);
      store.set(key(outcome.signature, text), outcome.translations[i]);
    });
    while (store.size > CACHE_MAX) store.delete(store.keys().next().value!);
    scheduleSave();
  }

  return texts.map(t => store.get(key(signature, t)) ?? fresh.get(t) ?? t);
}

chrome.runtime.onMessage.addListener((message: Request, _sender, sendResponse) => {
  if (message?.type !== "translate") return;
  translate(message.texts).then(
    translations => sendResponse({ ok: true, translations } satisfies TranslateResponse),
    error => sendResponse({ ok: false, error: String(error?.message ?? error) } satisfies TranslateResponse),
  );
  return true;
});

// ---- toggle shortcut ----
async function toggle(tab?: chrome.tabs.Tab) {
  tab ??= (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
  if (!tab?.id) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "toggle" } satisfies Request);
  } catch {
    // No receiver: either the page is restricted or a file:// page without file access (Chrome only).
    const canCheck = typeof chrome.extension?.isAllowedFileSchemeAccess === "function";
    if (canCheck && tab.url?.startsWith("file://") && !(await chrome.extension.isAllowedFileSchemeAccess())) {
      await chrome.tabs.create({ url: `chrome://extensions/?id=${chrome.runtime.id}` });
    }
  }
}
chrome.commands.onCommand.addListener((command, tab) => { if (command === "toggle-translate") toggle(tab); });
chrome.runtime.onMessage.addListener((message: Request) => {
  if (message?.type === "toggle-active") void toggle();
});

// ---- privileged stylesheet fetch for the dark theme engine ----
// Dark Reader needs to read cross-origin stylesheets to rewrite their colors.
// Content-script fetch is subject to CORS; the background fetch is not.
chrome.runtime.onMessage.addListener(
  (message: FetchStylesheetRequest, _sender, sendResponse) => {
    if (message?.type !== "fetch-stylesheet") return;
    fetch(message.url, { credentials: "omit" }).then(
      async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const text = await response.text();
        sendResponse({
          ok: true,
          text,
          contentType: response.headers.get("content-type") || "text/css",
        } satisfies FetchStylesheetResponse);
      },
      (error) =>
        sendResponse({
          ok: false,
          error: String(error?.message ?? error),
        } satisfies FetchStylesheetResponse),
    );
    return true;
  },
);
