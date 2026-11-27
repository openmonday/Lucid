import type { TranslationScope } from "../../browser/preferences.ts";
import { PLACEHOLDER, placeholder } from "../placeholders.ts";
import { mathFromElement, splitMath, type RichReplacement } from "./math.ts";

export const TRANSLATION_CLASS = "bt-t";
const SKIP = `script,style,noscript,template,pre,textarea,input,select,svg,math,canvas,iframe,[contenteditable=''],[contenteditable='true'],[translate='no'],.notranslate,.${TRANSLATION_CLASS}`;
// `input` is skipped as a translation target, but it must remain inline so a
// checkbox or radio button does not split the prose beside it into a lost text run.
const INLINE = "a,span,b,i,em,strong,small,sub,sup,mark,abbr,cite,q,u,s,time,kbd,var,label,font,bdi,bdo,img,br,wbr,input,code,samp,del,ins,dfn,math,mjx-container,.MathJax";
const KEEP = "code,kbd,samp";
const MATH = "math,.katex,mjx-container,.MathJax";
const CHROME = "nav,aside,form,dialog,menu,[role='navigation'],[role='banner'],[role='contentinfo'],[role='complementary'],[role='search'],[role='menu'],[role='menubar'],[role='toolbar'],[role='dialog'],[aria-hidden='true']";
const CONTROL = "button,summary,[role='button'],[role='tab'],[role='menuitem'],[role='menuitemcheckbox'],[role='menuitemradio'],[role='option'],[role='switch'],[role='checkbox'],[role='radio'],[role='slider'],[role='spinbutton']";
// Aquascope renders Rust memory diagrams as HTML and renames its mount point after initialization.
const DIAGRAM = ".aquascope-embed,.aquascope";
const MAIN = "main,[role='main']";
const ARTICLE = "article,[role='article']";
const LANDMARK = `${MAIN},${ARTICLE}`;
const MAX_UNIT = 4000;

export interface TranslationBlock {
  el: Element;
  text: string;
  replacements: RichReplacement[];
}

function needsTranslation(text: string, target: string): boolean {
  if (!/\p{L}/u.test(text)) return false;
  if (target.startsWith("zh") && /\p{Script=Han}/u.test(text) && !/[A-Za-z]{3}/.test(text)) return false;
  return true;
}

export function extractBlock(el: Element, scope: TranslationScope, target: string): TranslationBlock | undefined {
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
    if (e.matches(`.${TRANSLATION_CLASS},script,style,noscript,svg`) || isSkippedInScope(e, scope)) return;
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
  if (!plain || text.length > MAX_UNIT || !needsTranslation(plain, target)) return undefined;
  return { el, text, replacements };
}

function isChrome(el: Element): boolean {
  if (el.matches(CHROME)) return true;
  // Keep article headers/footers, but skip site-level header/footer landmarks.
  return el.matches("header,footer") && !el.closest(LANDMARK);
}

function isSkippedInScope(el: Element, scope: TranslationScope): boolean {
  return scope === "main" && (isChrome(el) || el.matches(`${CONTROL},${DIAGRAM}`));
}

function isInlineElement(el: Element, scope: TranslationScope): boolean {
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

export function contentRoot(scope: TranslationScope): Element {
  if (scope === "all") return document.body;
  const main = largest([...document.querySelectorAll(MAIN)]);
  if (main) return main;
  const articles = [...document.querySelectorAll(ARTICLE)];
  return articles.length === 1 && isRendered(articles[0]) && textLength(articles[0]) > 0
    ? articles[0]
    : document.body;
}

function hasBlockOutsideMath(el: Element, scope: TranslationScope): boolean {
  for (const child of el.children) {
    if (child.closest(MATH)) continue;
    if (!isInlineElement(child, scope) || hasBlockOutsideMath(child, scope)) return true;
  }
  return false;
}

function isUnit(el: Element, scope: TranslationScope): boolean {
  // A unit has no block-level descendants (only inline elements, text, and math).
  return !el.querySelector(`:scope > .${TRANSLATION_CLASS}`) && !hasBlockOutsideMath(el, scope);
}

export function collectBlocks(root: Element, scope: TranslationScope, seen: WeakSet<Element>): Element[] {
  const blocks: Element[] = [];
  const visit = (element: Element) => {
    if (element.matches(SKIP) || isSkippedInScope(element, scope) || seen.has(element)) return;
    if (isInlineElement(element, scope) && element !== document.body) return; // handled by its block parent
    if (isUnit(element, scope)) { blocks.push(element); return; }
    for (const child of element.children) visit(child);
  };
  visit(root);
  return blocks;
}
