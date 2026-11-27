import { DEFAULT_TARGET } from "../../browser/preferences.ts";
import { signatureFor, translateTexts } from "./index.ts";
import { loadEngineSettings } from "./settings.ts";

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

export async function translateCached(texts: string[]): Promise<string[]> {
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
