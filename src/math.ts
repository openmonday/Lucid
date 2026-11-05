import katex from "katex";

export interface MathSource {
  tex: string;
  displayMode: boolean;
}

export type RichTextPart =
  | { type: "text"; value: string }
  | { type: "math"; value: MathSource };

export type RichReplacement = RichTextPart;

/** Placeholders shared with the existing inline-code protection in dom-translator. */
export const PLACEHOLDER = /\[ZT_KEEP_(\d+)\]/g;
export const placeholder = (index: number) => `[ZT_KEEP_${index}]`;

function isEscaped(text: string, index: number): boolean {
  let slashes = 0;
  for (let i = index - 1; i >= 0 && text[i] === "\\"; i--) slashes++;
  return slashes % 2 === 1;
}

const isSpace = (char: string | undefined) => char !== undefined && /\s/u.test(char);
// Match the Markdown plugin's ASCII boundary rule so CJK prose can sit directly beside `$math$`.
const isWord = (char: string | undefined) => char !== undefined && /[A-Za-z0-9_]/.test(char);

function findClose(text: string, from: number, close: string): number {
  for (let index = text.indexOf(close, from); index !== -1; index = text.indexOf(close, index + close.length)) {
    if (!isEscaped(text, index)) return index;
  }
  return -1;
}

function matchDollarInline(text: string, start: number): { end: number; tex: string } | undefined {
  const after = text[start + 1];
  if (after === undefined || after === "$" || isSpace(after) || isWord(text[start - 1])) return undefined;
  for (let close = text.indexOf("$", start + 1); close !== -1; close = text.indexOf("$", close + 1)) {
    if (isEscaped(text, close) || text[close - 1] === "$" || text[close + 1] === "$") continue;
    if (isSpace(text[close - 1]) || isWord(text[close + 1])) continue;
    const tex = text.slice(start + 1, close).trim();
    if (tex) return { end: close + 1, tex };
  }
  return undefined;
}

function matchDollarBlock(text: string, start: number): { end: number; tex: string } | undefined {
  if (text[start + 1] !== "$" || text[start + 2] === "$" || text[start - 1] === "$") return undefined;
  const close = findClose(text, start + 2, "$$");
  if (close === -1) return undefined;
  const tex = text.slice(start + 2, close).trim();
  return tex ? { end: close + 2, tex } : undefined;
}

function matchBracket(
  text: string,
  start: number,
  open: string,
  close: string,
  displayMode: boolean,
): { end: number; tex: string; displayMode: boolean } | undefined {
  if (isEscaped(text, start) || !text.startsWith(open, start)) return undefined;
  const closeAt = findClose(text, start + open.length, close);
  if (closeAt === -1) return undefined;
  const tex = text.slice(start + open.length, closeAt).trim();
  return tex ? { end: closeAt + close.length, tex, displayMode } : undefined;
}

/** Split plain text into prose and LaTeX using the delimiters supported by the Markdown viewer. */
export function splitMath(text: string): RichTextPart[] {
  const parts: RichTextPart[] = [];
  let plainStart = 0;
  let index = 0;

  while (index < text.length) {
    let match: { end: number; tex: string; displayMode: boolean } | undefined;
    if (text[index] === "\\") {
      match =
        matchBracket(text, index, "\\[", "\\]", true) ??
        matchBracket(text, index, "\\(", "\\)", false);
    } else if (text[index] === "$") {
      const block = matchDollarBlock(text, index);
      const inline = block ? undefined : matchDollarInline(text, index);
      match = block ? { ...block, displayMode: true } : inline ? { ...inline, displayMode: false } : undefined;
    }

    if (!match) {
      index++;
      continue;
    }
    if (index > plainStart) parts.push({ type: "text", value: text.slice(plainStart, index) });
    parts.push({ type: "math", value: { tex: match.tex, displayMode: match.displayMode } });
    index = match.end;
    plainStart = index;
  }

  if (plainStart < text.length) parts.push({ type: "text", value: text.slice(plainStart) });
  return parts;
}

/** Read the TeX source back out of a rendered KaTeX or MathJax formula. */
export function mathFromElement(element: Element): MathSource | undefined {
  if (element.matches(".katex")) {
    const annotation = element.querySelector('annotation[encoding="application/x-tex"]');
    const tex = annotation?.textContent?.trim();
    if (tex) return { tex, displayMode: Boolean(element.closest(".katex-display")) };
  }

  if (element.matches("mjx-container, .MathJax")) {
    const math = element.querySelector("math[alttext]");
    const tex = math?.getAttribute("alttext")?.trim();
    if (tex) {
      const display = element.getAttribute("display") ?? math?.getAttribute("display");
      return { tex, displayMode: display === "true" || display === "block" };
    }

    const script = element.querySelector('script[type^="math/tex"]');
    const scriptTex = script?.textContent?.trim();
    if (scriptTex) return { tex: scriptTex, displayMode: /mode=display/.test(script?.getAttribute("type") ?? "") };
  }

  if (element.matches("math[alttext]")) {
    const tex = element.getAttribute("alttext")?.trim();
    if (tex) return { tex, displayMode: element.getAttribute("display") === "block" };
  }

  return undefined;
}

export function renderMath(source: MathSource): HTMLSpanElement {
  const wrapper = document.createElement("span");
  wrapper.className = source.displayMode ? "bt-math bt-math-display" : "bt-math";
  try {
    katex.render(source.tex, wrapper, {
      displayMode: source.displayMode,
      throwOnError: false,
      strict: "ignore",
      trust: false,
      output: "htmlAndMathml",
    });
  } catch {
    wrapper.textContent = source.tex;
  }
  return wrapper;
}

/** Render translated text without treating it as HTML, replacing tokens with KaTeX or literal text. */
export function renderRichText(
  target: HTMLElement,
  translated: string,
  replacements: RichReplacement[],
): void {
  const fragment = document.createDocumentFragment();
  let last = 0;

  PLACEHOLDER.lastIndex = 0;
  for (const match of translated.matchAll(PLACEHOLDER)) {
    if (match.index > last) fragment.append(translated.slice(last, match.index));
    const replacement = replacements[Number(match[1])];
    if (replacement?.type === "math") fragment.append(renderMath(replacement.value));
    else if (replacement?.type === "text") fragment.append(replacement.value);
    else fragment.append(match[0]);
    last = match.index + match[0].length;
  }

  if (last < translated.length) fragment.append(translated.slice(last));
  target.replaceChildren(fragment);
}
