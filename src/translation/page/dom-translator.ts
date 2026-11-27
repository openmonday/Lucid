import {
  DEFAULT_TARGET,
  DEFAULT_THEME,
  DEFAULT_TRANSLATION_SCOPE,
  type TranslationScope,
} from "../../browser/preferences.ts";
import type { ExtensionRequest, TranslateResponse } from "../../browser/messages.ts";
import { collectBlocks, contentRoot, extractBlock, TRANSLATION_CLASS as CLASS, type TranslationBlock } from "./content-blocks.ts";
import { renderRichText } from "./math.ts";

const BATCH_ITEMS = 16;
const BATCH_CHARS = 6000;

let enabled = false;
let scope: TranslationScope = DEFAULT_TRANSLATION_SCOPE;
let io: IntersectionObserver | undefined;
let mo: MutationObserver | undefined;
let scanTimer: ReturnType<typeof setTimeout> | undefined;
let flushTimer: ReturnType<typeof setTimeout> | undefined;
let queue: TranslationBlock[] = [];
let generation = 0;
let seen = new WeakSet<Element>();
let currentTarget = "";

function ensureStyle() {
  if (document.getElementById("bt-style")) return;
  const s = document.createElement("style");
  s.id = "bt-style";
  s.textContent = `
.${CLASS}{display:block;margin:.35em 0 .7em;padding:.05em 0 .05em .75em;border-left:2px solid rgba(0,0,0,.18);
color:inherit;opacity:.82;font-size:.96em;line-height:1.6;font-weight:400;font-style:normal;text-decoration:none;text-align:left;
text-indent:0;letter-spacing:normal;text-transform:none;white-space:normal}
@media (prefers-color-scheme:dark){.${CLASS}{border-left-color:rgba(255,255,255,.18)}}
html[data-bt-theme=claude] .${CLASS}{border-left-color:#c6613f;color:#b4502f;opacity:1}
@media (prefers-color-scheme:dark){html[data-bt-theme=claude] .${CLASS}{border-left-color:#e08264;color:#eea68e}}
.${CLASS}[data-state=loading]{border-left-color:transparent;color:transparent;opacity:1;border-radius:6px;min-height:1.3em;
background:linear-gradient(90deg,rgba(128,128,128,.12) 25%,rgba(128,128,128,.24) 50%,rgba(128,128,128,.12) 75%);background-size:200% 100%;
animation:bt-shimmer 1.2s linear infinite}
.${CLASS}[data-state=error],html[data-bt-theme=claude] .${CLASS}[data-state=error]{border-left-color:#dc2626;color:#dc2626;opacity:1;font-size:.85em}
.${CLASS}:not([data-state]){animation:bt-in .25s ease-out}
@keyframes bt-shimmer{to{background-position:-200% 0}}
@keyframes bt-in{from{opacity:0;transform:translateY(-2px)}}
@media (prefers-reduced-motion:reduce){.${CLASS}{animation:none!important}}
.${CLASS} .katex{color:inherit}
.${CLASS} .bt-math-display{display:block;max-width:100%}
.${CLASS} .katex-display{margin:.4em 0;padding-bottom:.2em;overflow-x:auto;overflow-y:hidden}
.${CLASS} .katex-error{color:#dc2626}`;
  document.head.append(s);
}

function applyTheme(theme: unknown) {
  if (theme === "claude") document.documentElement.setAttribute("data-bt-theme", "claude");
  else document.documentElement.removeAttribute("data-bt-theme");
}

function scan() {
  if (!enabled) return;
  const root = contentRoot(scope);
  if (!root?.isConnected) return;
  for (const el of collectBlocks(root, scope, seen)) {
    seen.add(el);
    io?.observe(el);
  }
}

function onVisible(entries: IntersectionObserverEntry[]) {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    io?.unobserve(entry.target);
    const unit = extractBlock(entry.target, scope, currentTarget);
    if (!unit) continue;
    const node = document.createElement("span");
    node.className = CLASS;
    node.dataset.state = "loading";
    node.textContent = "\u00a0";
    unit.el.append(node);
    queue.push(unit);
  }
  if (queue.length) { clearTimeout(flushTimer); flushTimer = setTimeout(flush, 120); }
}

async function flush() {
  const gen = generation;
  while (queue.length && gen === generation) {
    const batch: TranslationBlock[] = [];
    let size = 0;
    while (queue.length && batch.length < BATCH_ITEMS && size + queue[0].text.length <= BATCH_CHARS) {
      const u = queue.shift()!; batch.push(u); size += u.text.length;
    }
    if (!batch.length) batch.push(queue.shift()!);
    let response: TranslateResponse;
    try {
      response = await chrome.runtime.sendMessage({ type: "translate", texts: batch.map(u => u.text) } satisfies ExtensionRequest);
    } catch (e) {
      response = { ok: false, error: String((e as Error)?.message ?? e) };
    }
    if (gen !== generation) return;
    batch.forEach((u, i) => render(u, response.ok ? response.translations[i] : undefined, response.ok ? undefined : response.error));
  }
}

function render(unit: TranslationBlock, translated: string | undefined, error?: string) {
  const node = unit.el.querySelector(`:scope > .${CLASS}`) as HTMLElement | null;
  if (!node) return;
  if (translated === undefined) {
    node.dataset.state = "error";
    node.textContent = `Translation failed: ${error ?? "unknown error"}`;
    return;
  }
  node.removeAttribute("data-state");
  renderRichText(node, translated, unit.replacements);
}

function scheduleScan() {
  clearTimeout(scanTimer);
  scanTimer = setTimeout(() => scan(), 400);
}

async function enable() {
  const values = await chrome.storage.sync.get({ target: DEFAULT_TARGET, translationScope: DEFAULT_TRANSLATION_SCOPE });
  currentTarget = values.target as string;
  scope = values.translationScope === "all" ? "all" : "main";
  enabled = true;
  ensureStyle();
  io = new IntersectionObserver(onVisible, { rootMargin: "300px 0px" });
  mo = new MutationObserver(records => {
    if (records.some(r => [...r.addedNodes].some(n => !(n instanceof Element && n.classList.contains(CLASS))))) scheduleScan();
  });
  mo.observe(document.body, { childList: true, subtree: true });
  scan();
}

function disable() {
  enabled = false;
  generation++;
  queue = [];
  io?.disconnect(); mo?.disconnect();
  io = mo = undefined;
  clearTimeout(scanTimer); clearTimeout(flushTimer);
  document.querySelectorAll(`.${CLASS}`).forEach(n => n.remove());
  seen = new WeakSet();
}

export function installTranslator(): void {
  chrome.storage.sync.get({ translationTheme: DEFAULT_THEME }).then(values => applyTheme(values.translationTheme));
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    if (changes.translationTheme) applyTheme(changes.translationTheme.newValue);
    if (changes.translationScope && enabled) {
      disable();
      void enable();
    }
  });
  chrome.runtime.onMessage.addListener((message: ExtensionRequest) => {
    if (message?.type !== "toggle") return;
    if (enabled) disable(); else void enable();
  });
}
