import MarkdownIt from "markdown-it";
import hljs from "highlight.js/lib/common";
import { katex as katexPlugin } from "@mdit/plugin-katex";
import DOMPurify from "dompurify";
import { createMetadataCard, splitFrontmatter } from "./metadata";
import { installTranslator } from "./dom-translator";

const LANGUAGE_NAMES: Record<string, string> = {
  bash: "Shell",
  c: "C",
  cpp: "C++",
  csharp: "C#",
  cs: "C#",
  css: "CSS",
  diff: "Diff",
  dockerfile: "Dockerfile",
  go: "Go",
  html: "HTML",
  ini: "INI",
  java: "Java",
  javascript: "JavaScript",
  js: "JavaScript",
  json: "JSON",
  jsx: "JSX",
  kotlin: "Kotlin",
  md: "Markdown",
  markdown: "Markdown",
  php: "PHP",
  plaintext: "Text",
  py: "Python",
  python: "Python",
  rb: "Ruby",
  ruby: "Ruby",
  rs: "Rust",
  rust: "Rust",
  scss: "SCSS",
  sh: "Shell",
  shell: "Shell",
  sql: "SQL",
  swift: "Swift",
  text: "Text",
  toml: "TOML",
  ts: "TypeScript",
  tsx: "TSX",
  typescript: "TypeScript",
  xml: "XML",
  yaml: "YAML",
  yml: "YAML",
};

const md = new MarkdownIt({
  html: false,
  linkify: true,
  highlight(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
      } catch {
        // Fall back to markdown-it's escaped plain text.
      }
    }
    return "";
  },
});
md.use(katexPlugin, {
  delimiters: "all",
  mathFence: true,
  throwOnError: false,
  strict: "ignore",
  trust: false,
  output: "htmlAndMathml",
});
const SANITIZE = {
  USE_PROFILES: { html: true, mathMl: true, svg: true },
  ADD_TAGS: ["semantics", "annotation"],
  ADD_ATTR: ["encoding"],
};
const content = document.getElementById("content")!;
const drop = document.getElementById("drop")!;
const notice = document.getElementById("notice")!;
const picker = document.getElementById("picker") as HTMLInputElement;
const src = new URLSearchParams(location.search).get("src");
const handoff = new URLSearchParams(location.search).has("handoff");
let rendered = false;

function languageName(code: HTMLElement): string {
  const match = /(?:^|\s)language-([^\s]+)/.exec(code.className);
  if (!match) return "Text";
  const lang = match[1].toLowerCase();
  return LANGUAGE_NAMES[lang] ?? lang.replace(/^./, c => c.toUpperCase());
}

async function copyCode(code: HTMLElement, button: HTMLButtonElement) {
  const label = button.dataset.label ?? button.textContent ?? "";
  const text = code.textContent ?? "";
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.append(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }
  button.textContent = "Copied";
  button.classList.add("copied");
  setTimeout(() => {
    button.textContent = label;
    button.classList.remove("copied");
  }, 1600);
}

function enhanceCodeBlocks() {
  content.querySelectorAll<HTMLPreElement>("pre").forEach(pre => {
    const code = pre.querySelector<HTMLElement>("code");
    if (!code) return;
    code.classList.add("hljs");

    const wrapper = document.createElement("div");
    wrapper.className = "code-block";

    // Obsidian-style header: the language label in the top-right corner is the
    // copy control, so there is no separate toolbar row above the code.
    const button = document.createElement("button");
    button.type = "button";
    button.className = "code-block-copy notranslate";
    button.dataset.label = languageName(code);
    button.textContent = button.dataset.label;
    button.title = "Copy code";
    button.setAttribute("aria-label", "Copy code to clipboard");
    button.setAttribute("translate", "no");
    button.addEventListener("click", () => void copyCode(code, button));

    pre.replaceWith(wrapper);
    wrapper.append(button, pre);
  });
}

function fileName(src: string): string {
  const last = src.split("/").pop() || src;
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
}

function show(text: string, name: string, base?: string) {
  rendered = true;
  document.title = name;
  if (base) {
    const el = document.createElement("base");
    el.href = base;
    document.head.append(el);
  }
  const { body, metadata } = splitFrontmatter(text);
  content.innerHTML = DOMPurify.sanitize(md.render(body), SANITIZE);
  if (metadata && Object.keys(metadata).length > 0) {
    content.prepend(createMetadataCard(metadata));
  }
  content.querySelectorAll("a[href]").forEach(a => {
    const href = (a as HTMLAnchorElement).href;
    if (/^https?:/.test(href)) { a.setAttribute("target", "_blank"); a.setAttribute("rel", "noreferrer"); }
  });
  enhanceCodeBlocks();
  content.hidden = false;
  drop.hidden = true;
}

async function openFile(file: File) { show(await file.text(), file.name); }

picker.addEventListener("change", () => picker.files?.[0] && openFile(picker.files[0]));
addEventListener("dragover", e => { e.preventDefault(); document.body.classList.add("dragging"); });
addEventListener("dragleave", e => { if (!e.relatedTarget) document.body.classList.remove("dragging"); });
addEventListener("drop", e => { e.preventDefault(); document.body.classList.remove("dragging"); const f = e.dataTransfer?.files[0]; if (f) openFile(f); });

// The embedding content script already has the file's text and sends it via
// postMessage, because Firefox/Zen block file:// reads from extension pages.
addEventListener("message", (event) => {
  const data = event.data as { type?: unknown; src?: unknown; text?: unknown } | null;
  if (event.source !== parent) return;
  if (!handoff || rendered) return;
  if (data?.type !== "lucid:local-markdown" || typeof data.text !== "string") return;
  if (!src || data.src !== src) return;
  show(data.text, fileName(src), src);
});

function showReadError(src: string) {
  notice.hidden = false;
  notice.textContent = navigator.userAgent.includes("Firefox")
    ? `Cannot read ${src} directly. Drop the file here or choose it below.`
    : `Cannot read ${src}. Enable "Allow access to file URLs" for this extension on chrome://extensions, or choose the file below.`;
}

async function init() {
  if (!src?.startsWith("file://")) return;
  if (handoff) {
    // Wait for the content script's message, which arrives with the iframe load.
    setTimeout(() => { if (!rendered) showReadError(src); }, 3000);
    return;
  }
  try {
    const response = await fetch(src);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    show(await response.text(), fileName(src), src);
  } catch {
    showReadError(src);
  }
}

function applyViewerTheme(theme: unknown) {
  if (theme === "claude") document.documentElement.setAttribute("data-bt-viewer", "claude");
  else document.documentElement.removeAttribute("data-bt-viewer");
}
chrome.storage.sync.get({ viewerTheme: "default" }).then(v => applyViewerTheme(v.viewerTheme));
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.viewerTheme) applyViewerTheme(changes.viewerTheme.newValue);
});

installTranslator();
void init();
