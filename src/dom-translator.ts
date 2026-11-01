import { needsTranslation, type Request, type TranslateResponse } from "./shared";

const CLASS = "bt-t";
const SKIP = "script,style,noscript,template,pre,textarea,input,select,svg,math,canvas,iframe,[contenteditable=''],[contenteditable='true'],[translate='no'],.notranslate,.bt-t";
const INLINE = "a,span,b,i,em,strong,small,sub,sup,mark,abbr,cite,q,u,s,time,kbd,var,label,font,bdi,bdo,img,br,wbr,code,samp,del,ins,dfn";
const KEEP = "code,kbd,samp";
const BATCH_ITEMS = 16;
const BATCH_CHARS = 6000;
const MAX_UNIT = 4000;

interface Unit { el: Element; text: string; keep: string[] }

let enabled = false;
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
.${CLASS}{display:block;margin:.35em 0 .7em;padding:.05em 0 .05em .75em;border-left:2px solid color-mix(in srgb,currentColor 28%,transparent);
color:inherit;opacity:.82;font-size:.96em;line-height:1.6;font-weight:400;font-style:normal;text-decoration:none;text-align:left;
text-indent:0;letter-spacing:normal;text-transform:none;white-space:normal}
.${CLASS}[data-state=loading]{border-left-color:transparent;color:transparent;opacity:1;border-radius:6px;min-height:1.3em;
background:linear-gradient(90deg,rgba(128,128,128,.12) 25%,rgba(128,128,128,.24) 50%,rgba(128,128,128,.12) 75%);background-size:200% 100%;
animation:bt-shimmer 1.2s linear infinite}
.${CLASS}[data-state=error]{border-left-color:#dc2626;color:#dc2626;opacity:1;font-size:.85em}
.${CLASS}:not([data-state]){animation:bt-in .25s ease-out}
@keyframes bt-shimmer{to{background-position:-200% 0}}
@keyframes bt-in{from{opacity:0;transform:translateY(-2px)}}
@media (prefers-reduced-motion:reduce){.${CLASS}{animation:none!important}}`;
  document.head.append(s);
}

function extract(el: Element): Unit | undefined {
  const keep: string[] = [];
  let text = "";
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) { text += node.nodeValue; return; }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const e = node as Element;
    if (e.matches(".bt-t,script,style,noscript,svg,math")) return;
    if (e.tagName === "BR") { text += " "; return; }
    if (e.matches(KEEP)) { keep.push(e.textContent ?? ""); text += `[ZT_KEEP_${keep.length - 1}]`; return; }
    e.childNodes.forEach(walk);
  };
  el.childNodes.forEach(walk);
  text = text.replace(/\s+/g, " ").trim();
  const plain = text.replace(/\[ZT_KEEP_\d+\]/g, "");
  if (!plain || text.length > MAX_UNIT || !needsTranslation(plain, target())) return undefined;
  return { el, text, keep };
}

let currentTarget = "";
const target = () => currentTarget;

function isUnit(el: Element): boolean {
  // A unit has no block-level descendants (only inline elements and text).
  return !el.querySelector(`:not(${INLINE})`) && !el.querySelector(`:scope > .${CLASS}`);
}

function collect(root: Element, out: Element[]) {
  if (root.matches(SKIP) || seen.has(root)) return;
  if (root.matches(INLINE) && root !== document.body) return; // handled by its block parent
  if (isUnit(root)) { out.push(root); return; }
  for (const child of root.children) collect(child, out);
}

function scan(root: Element = document.body) {
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
  const out = translated.replace(/\[ZT_KEEP_(\d+)\]/g, (_, n) => unit.keep[Number(n)] ?? "");
  node.removeAttribute("data-state");
  node.textContent = out;
}

function scheduleScan() {
  clearTimeout(scanTimer);
  scanTimer = setTimeout(() => scan(), 400);
}

async function enable() {
  const { target: t } = await chrome.storage.sync.get({ target: "zh-Hans" });
  currentTarget = t as string;
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

export function installTranslator() {
  chrome.runtime.onMessage.addListener((message: Request) => {
    if (message?.type !== "toggle") return;
    if (enabled) disable(); else void enable();
  });
}
