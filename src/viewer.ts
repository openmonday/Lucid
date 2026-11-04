import MarkdownIt from "markdown-it";
import hljs from "highlight.js/lib/common";
import { katex as katexPlugin } from "@mdit/plugin-katex";
import DOMPurify from "dompurify";
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

function languageName(code: HTMLElement): string {
  const match = /(?:^|\s)language-([^\s]+)/.exec(code.className);
  if (!match) return "Text";
  const lang = match[1].toLowerCase();
  return LANGUAGE_NAMES[lang] ?? lang.replace(/^./, c => c.toUpperCase());
}

async function copyCode(code: HTMLElement, button: HTMLButtonElement) {
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
    button.textContent = "Copy";
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

    const header = document.createElement("div");
    header.className = "code-block-header";

    const language = document.createElement("span");
    language.className = "code-block-language";
    language.textContent = languageName(code);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "code-block-copy";
    button.textContent = "Copy";
    button.setAttribute("aria-label", "Copy code to clipboard");
    button.addEventListener("click", () => void copyCode(code, button));

    header.append(language, button);
    pre.replaceWith(wrapper);
    wrapper.append(header, pre);
  });
}

function show(text: string, name: string, base?: string) {
  document.title = name;
  if (base) {
    const el = document.createElement("base");
    el.href = base;
    document.head.append(el);
  }
  content.innerHTML = DOMPurify.sanitize(md.render(text), SANITIZE);
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

async function init() {
  const src = new URLSearchParams(location.search).get("src");
  if (!src?.startsWith("file://")) return;
  try {
    const response = await fetch(src);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    show(await response.text(), decodeURIComponent(src.split("/").pop() ?? src), src);
  } catch {
    notice.hidden = false;
    notice.textContent = `Cannot read ${src}. Enable "Allow access to file URLs" for this extension on chrome://extensions, or choose the file below.`;
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
