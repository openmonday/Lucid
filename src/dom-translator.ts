import {
  DEFAULT_THEME,
  DEFAULT_TRANSLATION_SCOPE,
  needsTranslation,
  type Request,
  type TranslateResponse,
  type TranslationScope,
} from "./shared";
import { mathFromElement, PLACEHOLDER, placeholder, renderRichText, splitMath, type RichReplacement } from "./math";

const CLASS = "bt-t";
const SKIP = "script,style,noscript,template,pre,textarea,input,select,svg,math,canvas,iframe,[contenteditable=''],[contenteditable='true'],[translate='no'],.notranslate,.bt-t";
// `input` is skipped as a translation target, but it must remain inline so a
// checkbox or radio button does not split the prose beside it into a lost text run.
const INLINE = "a,span,b,i,em,strong,small,sub,sup,mark,abbr,cite,q,u,s,time,kbd,var,label,font,bdi,bdo,img,br,wbr,input,code,samp,del,ins,dfn,math,mjx-container,.MathJax";
const KEEP = "code,kbd,samp";
const MATH = "math,.katex,mjx-container,.MathJax";
const CHROME = "nav,aside,form,dialog,menu,[role='navigation'],[role='banner'],[role='contentinfo'],[role='complementary'],[role='search'],[role='menu'],[role='menubar'],[role='toolbar'],[role='dialog'],[aria-hidden='true']";
const CONTROL = "button,summary,[role='button'],[role='tab'],[role='menuitem'],[role='menuitemcheckbox'],[role='menuitemradio'],[role='option'],[role='switch'],[role='checkbox'],[role='radio'],[role='slider'],[role='spinbutton']";
const MAIN = "main,[role='main']";
const ARTICLE = "article,[role='article']";
const LANDMARK = "main,[role='main'],article,[role='article']";
const BATCH_ITEMS = 16;
const BATCH_CHARS = 6000;
const MAX_UNIT = 4000;

interface Unit { el: Element; text: string; replacements: RichReplacement[] }

let enabled = false;
let scope: TranslationScope = DEFAULT_TRANSLATION_SCOPE;
let io: IntersectionObserver | undefined;
let mo: MutationObserver | undefined;
let scanTimer: ReturnType<typeof setTimeout> | undefined;
let flushTimer: ReturnType<typeof setTimeout> | undefined;
let queue: Unit[] = [];
let generation = 0;
let seen = new WeakSet<Element>();
const pendingUnits = new WeakMap<Element, Unit>();

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

function extract(el: Element): Unit | undefined {
  const replacements: RichReplacement[] = [];
  let text = "";
  const add = (value: RichReplacement) => {
    replacements.push(value);
    text += placeholder(replacements.length - 1);
  };
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      for (const part of splitMath(node.nodeValue ?? "")) {
        if (part.type === "text") text += part.value;
        else add({ type: "math", value: part.value });
      }
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const e = node as Element;
    if (e.matches(".bt-t,script,style,noscript,svg") || isSkippedInScope(e)) return;
    if (e.tagName === "BR") { text += " "; return; }
    if (e.matches(KEEP)) { add({ type: "text", value: e.textContent ?? "" }); return; }
    const math = mathFromElement(e);
    if (math) { add({ type: "math", value: math }); return; }
    if (e.matches(MATH)) return;
    e.childNodes.forEach(walk);
  };
  el.childNodes.forEach(walk);
  text = text.replace(/\s+/g, " ").trim();
  const plain = text.replace(PLACEHOLDER, "");
  if (!plain || text.length > MAX_UNIT || !needsTranslation(plain, target())) return undefined;
  return { el, text, replacements };
}

let currentTarget = "";
const target = () => currentTarget;

function isChrome(el: Element): boolean {
  if (el.matches(CHROME)) return true;
  // Keep article headers/footers, but skip site-level header/footer landmarks.
  return el.matches("header,footer") && !el.closest(LANDMARK);
}

function isSkippedInScope(el: Element): boolean {
  return scope === "main" && (isChrome(el) || el.matches(CONTROL));
}

function isInlineElement(el: Element): boolean {
  // Treat controls as inline boundaries in main-content mode so surrounding prose
  // is still translated while the control itself is skipped.
  return el.matches(INLINE) || (scope === "main" && el.matches(CONTROL));
}

function textLength(el: Element): number {
  return (el.textContent ?? "").replace(/\s+/g, " ").trim().length;
}

function isRendered(el: Element): boolean {
  return el.getClientRects().length > 0;
}

function largest(candidates: Element[]): Element | undefined {
  let best: Element | undefined;
  let bestLength = 0;
  for (const candidate of candidates) {
    if (!isRendered(candidate)) continue;
    const length = textLength(candidate);
    if (length > bestLength) {
      best = candidate;
      bestLength = length;
    }
  }
  return best;
}

function contentRoot(): Element {
  if (scope === "all") return document.body;
  const main = largest([...document.querySelectorAll(MAIN)]);
  if (main) return main;
  const articles = [...document.querySelectorAll(ARTICLE)];
  return articles.length === 1 && isRendered(articles[0]) && textLength(articles[0]) > 0
    ? articles[0]
    : document.body;
}

function hasBlockOutsideMath(el: Element): boolean {
  for (const child of el.children) {
    if (child.closest(MATH)) continue;
    if (!isInlineElement(child) || hasBlockOutsideMath(child)) return true;
  }
  return false;
}

function isUnit(el: Element): boolean {
  // A unit has no block-level descendants (only inline elements, text, and math).
  return !el.querySelector(`:scope > .${CLASS}`) && !hasBlockOutsideMath(el);
}

function collect(root: Element, out: Element[]) {
  if (root.matches(SKIP) || isSkippedInScope(root) || seen.has(root)) return;
  if (isInlineElement(root) && root !== document.body) return; // handled by its block parent
  if (isUnit(root)) { out.push(root); return; }
  for (const child of root.children) collect(child, out);
}

function scan(root: Element = contentRoot()) {
  if (!enabled || !root?.isConnected) return;
  const found: Element[] = [];
  collect(root, found);
  for (const el of found) {
    seen.add(el);
    io?.observe(el);
  }
}

function onVisible(entries: IntersectionObserverEntry[]) {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    io?.unobserve(entry.target);
    const unit = extract(entry.target);
    if (!unit) continue;
    const node = document.createElement("span");
    node.className = CLASS;
    node.dataset.state = "loading";
    node.textContent = "\u00a0";
    unit.el.append(node);
    pendingUnits.set(unit.el, unit);
    queue.push(unit);
  }
  if (queue.length) { clearTimeout(flushTimer); flushTimer = setTimeout(flush, 120); }
}

async function flush() {
  const gen = generation;
  while (queue.length && gen === generation) {
    const batch: Unit[] = [];
    let size = 0;
    while (queue.length && batch.length < BATCH_ITEMS && size + queue[0].text.length <= BATCH_CHARS) {
      const u = queue.shift()!; batch.push(u); size += u.text.length;
    }
    if (!batch.length) batch.push(queue.shift()!);
    let response: TranslateResponse;
    try {
      response = await chrome.runtime.sendMessage({ type: "translate", texts: batch.map(u => u.text) } satisfies Request);
    } catch (e) {
      response = { ok: false, error: String((e as Error)?.message ?? e) };
    }
    if (gen !== generation) return;
    batch.forEach((u, i) => render(u, response.ok ? response.translations[i] : undefined, response.ok ? undefined : response.error));
  }
}

function render(unit: Unit, translated: string | undefined, error?: string) {
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
  const values = await chrome.storage.sync.get({ target: "zh-Hans", translationScope: DEFAULT_TRANSLATION_SCOPE });
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

export function installTranslator(themeKey = "translationTheme") {
  chrome.storage.sync.get({ [themeKey]: DEFAULT_THEME }).then(values => applyTheme(values[themeKey]));
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    if (changes[themeKey]) applyTheme(changes[themeKey].newValue);
    if (changes.translationScope && enabled) {
      disable();
      void enable();
    }
  });
  chrome.runtime.onMessage.addListener((message: Request) => {
    if (message?.type !== "toggle") return;
    if (enabled) disable(); else void enable();
  });
}
