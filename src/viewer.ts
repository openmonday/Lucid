import { installTranslator } from "./dom-translator.ts";
import { renderMarkdown } from "./render.ts";
import { installViewerTheme } from "./viewer-theme.ts";

const content = document.getElementById("content")!;
const drop = document.getElementById("drop")!;
const notice = document.getElementById("notice")!;
const picker = document.getElementById("picker") as HTMLInputElement;
const src = new URLSearchParams(location.search).get("src");

function fileName(src: string): string {
  const last = src.split("/").pop() || src;
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
}

function show(text: string, name: string, base?: string) {
  document.title = name;
  if (base) {
    const el = document.createElement("base");
    el.href = base;
    document.head.append(el);
  }
  renderMarkdown(content, text);
  content.hidden = false;
  drop.hidden = true;
}
async function openFile(file: File) { show(await file.text(), file.name); }

picker.addEventListener("change", () => picker.files?.[0] && openFile(picker.files[0]));
addEventListener("dragover", e => { e.preventDefault(); document.body.classList.add("dragging"); });
addEventListener("dragleave", e => { if (!e.relatedTarget) document.body.classList.remove("dragging"); });
addEventListener("drop", e => { e.preventDefault(); document.body.classList.remove("dragging"); const f = e.dataTransfer?.files[0]; if (f) openFile(f); });

function showReadError(src: string) {
  notice.hidden = false;
  notice.textContent = navigator.userAgent.includes("Firefox")
    ? `Cannot read ${src} directly. Drop the file here or choose it below.`
    : `Cannot read ${src}. Enable "Allow access to file URLs" for this extension on chrome://extensions, or choose the file below.`;
}

async function init() {
  if (!src?.startsWith("file://")) return;
  try {
    const response = await fetch(src);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    show(await response.text(), fileName(src), src);
  } catch {
    showReadError(src);
  }
}

void installViewerTheme();

installTranslator();
void init();
