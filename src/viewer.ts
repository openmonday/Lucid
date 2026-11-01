import MarkdownIt from "markdown-it";
import DOMPurify from "dompurify";
import { installTranslator } from "./dom-translator";

const md = new MarkdownIt({ html: false, linkify: true });
const content = document.getElementById("content")!;
const drop = document.getElementById("drop")!;
const notice = document.getElementById("notice")!;
const picker = document.getElementById("picker") as HTMLInputElement;

function show(text: string, name: string, base?: string) {
  document.title = name;
  if (base) {
    const el = document.createElement("base");
    el.href = base;
    document.head.append(el);
  }
  content.innerHTML = DOMPurify.sanitize(md.render(text));
  content.querySelectorAll("a[href]").forEach(a => {
    const href = (a as HTMLAnchorElement).href;
    if (/^https?:/.test(href)) { a.setAttribute("target", "_blank"); a.setAttribute("rel", "noreferrer"); }
  });
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

installTranslator("viewerTheme");
void init();
