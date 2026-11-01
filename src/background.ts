import { translateMany } from "./bing";
import { DEFAULT_TARGET, type Request, type TranslateResponse } from "./shared";

// ---- translation with a persistent cache ----
const CACHE_KEY = "cache-v1";
const CACHE_MAX = 3000;
let cache: Map<string, string> | undefined;
let saveTimer: ReturnType<typeof setTimeout> | undefined;

async function loadCache() {
  if (!cache) {
    const data = await chrome.storage.local.get(CACHE_KEY);
    cache = new Map(Array.isArray(data[CACHE_KEY]) ? data[CACHE_KEY] : []);
  }
  return cache;
}
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => chrome.storage.local.set({ [CACHE_KEY]: [...cache!] }), 1000);
}

async function translate(texts: string[]): Promise<string[]> {
  const { target } = (await chrome.storage.sync.get({ target: DEFAULT_TARGET })) as { target: string };
  const store = await loadCache();
  const key = (t: string) => `${target}\0${t}`;
  const missing = [...new Set(texts.filter(t => !store.has(key(t))))];
  if (missing.length) {
    const done = await translateMany(missing, target);
    missing.forEach((t, i) => store.set(key(t), done[i]));
    while (store.size > CACHE_MAX) store.delete(store.keys().next().value!);
    scheduleSave();
  }
  return texts.map(t => store.get(key(t))!);
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
chrome.action.onClicked.addListener(tab => toggle(tab));

// ---- send local Markdown files to the viewer ----
const viewer = (src: string) => chrome.runtime.getURL(`viewer.html?src=${encodeURIComponent(src)}`);
chrome.webNavigation.onBeforeNavigate.addListener(
  details => {
    if (details.frameId !== 0) return;
    chrome.tabs.update(details.tabId, { url: viewer(details.url) });
  },
  { url: [".md", ".markdown", ".mdown", ".mkd"].map(pathSuffix => ({ schemes: ["file"], pathSuffix })) },
);
