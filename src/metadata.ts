import { CORE_SCHEMA, load, mergeTag } from "js-yaml";

type Metadata = Record<string, unknown>;
type IconName =
  | "sliders"
  | "text"
  | "list"
  | "tag"
  | "calendar"
  | "status"
  | "hash"
  | "toggle"
  | "link"
  | "external"
  | "check"
  | "chevron"
  | "braces";

export interface FrontmatterResult {
  body: string;
  metadata: Metadata | null;
}

const DATE_FORMAT = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "numeric",
});
const DATE_TIME_FORMAT = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_TIME = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?$/;
const CLOSING_FENCE = /^(?:---|\.\.\.)\s*$/;
const FRONTMATTER_SCHEMA = CORE_SCHEMA.withTags(mergeTag);

// Icons are static SVG path data; property keys and values never enter it.
const ICONS: Record<IconName, string> = {
  sliders:
    '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
  text: '<path d="M5 5h14M12 5v14M9 19h6"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/>',
  tag:
    '<path d="M12.59 2.59A2 2 0 0 0 11.17 2H4a2 2 0 0 0-2 2v7.17a2 2 0 0 0 .59 1.42l8.7 8.7a2.43 2.43 0 0 0 3.42 0l6.58-6.58a2.43 2.43 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".75" fill="currentColor" stroke="none"/>',
  calendar:
    '<path d="M8 2v4M16 2v4"/><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18"/>',
  status:
    '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/>',
  hash: '<path d="M5 9h14M5 15h14M10 3 8 21M16 3l-2 18"/>',
  toggle:
    '<rect x="2" y="6" width="20" height="12" rx="6"/><circle cx="16" cy="12" r="2" fill="currentColor" stroke="none"/>',
  link:
    '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  external: '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  braces:
    '<path d="M8 3H7a2 2 0 0 0-2 2v4a2 2 0 0 1-2 2 2 2 0 0 1 2 2v4a2 2 0 0 0 2 2h1"/><path d="M16 3h1a2 2 0 0 1 2 2v4a2 2 0 0 0 2 2 2 2 0 0 0-2 2v4a2 2 0 0 1-2 2h-1"/>',
};

function span(className: string, text?: string): HTMLSpanElement {
  const element = document.createElement("span");
  element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function icon(name: IconName, className = "metadata-icon"): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("class", className.includes("metadata-icon") ? className : `metadata-icon ${className}`);
  svg.innerHTML = ICONS[name];
  return svg;
}

function isPlainObject(value: unknown): value is Metadata {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof Date) &&
    Object.prototype.toString.call(value) === "[object Object]"
  );
}

function isTagKey(key: string): boolean {
  const name = key.trim().toLowerCase();
  return name === "tags" || name === "tag";
}

function isStatusKey(key: string): boolean {
  const name = key.trim().toLowerCase();
  return name === "status" || name === "state";
}

function isLink(value: unknown): boolean {
  return typeof value === "string" && /^(?:https?:\/\/|mailto:)/i.test(value.trim());
}

function parseDateText(value: string): Date | null {
  const dateOnly = DATE_ONLY.exec(value);
  if (dateOnly) {
    const year = Number(dateOnly[1]);
    const month = Number(dateOnly[2]) - 1;
    const day = Number(dateOnly[3]);
    const date = new Date(year, month, day);
    return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day
      ? date
      : null;
  }
  if (!DATE_TIME.test(value)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(date: Date, withTime: boolean): string {
  return (withTime ? DATE_TIME_FORMAT : DATE_FORMAT).format(date);
}

function scalarText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  if (value instanceof Date) return formatDate(value, true);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function tagText(value: unknown): string {
  const text = scalarText(value).trim();
  if (!text) return "";
  return text.startsWith("#") ? text : `#${text}`;
}

function valueIcon(key: string, value: unknown): IconName {
  if (isTagKey(key)) return "tag";
  if (typeof value === "boolean") return "toggle";
  if (typeof value === "number" || typeof value === "bigint") return "hash";
  if (value instanceof Date) return "calendar";
  if (typeof value === "string" && parseDateText(value)) return "calendar";
  if (isLink(value)) return "link";
  if (isStatusKey(key) && typeof value === "string") return "status";
  if (Array.isArray(value)) return "list";
  if (isPlainObject(value)) return "braces";
  return "text";
}

function appendEmpty(target: HTMLElement): void {
  target.classList.add("metadata-empty");
  target.textContent = "—";
}

function appendTags(target: HTMLElement, values: unknown[]): void {
  const tags = values.map(tagText).filter(Boolean);
  if (!tags.length) {
    appendEmpty(target);
    return;
  }
  const list = span("metadata-tag-list");
  for (const tag of tags) list.append(span("metadata-tag", tag));
  target.append(list);
}

function appendList(target: HTMLElement, key: string, values: unknown[]): void {
  const items = values.filter(value => value !== null && value !== undefined && value !== "");
  if (!items.length) {
    appendEmpty(target);
    return;
  }
  if (isTagKey(key)) {
    appendTags(target, items);
    return;
  }
  const list = span("metadata-pill-list");
  for (const item of items) list.append(span("metadata-pill", scalarText(item)));
  target.append(list);
}

function appendLink(target: HTMLElement, value: string): void {
  const href = value.trim();
  const link = document.createElement("a");
  link.className = "metadata-link";
  link.href = href;
  link.target = "_blank";
  link.rel = "noreferrer";
  link.append(span("metadata-link-text", href), icon("external", "metadata-link-icon"));
  target.append(link);
}

function appendDate(target: HTMLElement, date: Date, raw: string, withTime: boolean): void {
  const time = document.createElement("time");
  time.className = "metadata-date";
  time.dateTime = raw;
  time.textContent = formatDate(date, withTime);
  target.append(time);
}

function appendStatus(target: HTMLElement, value: string): void {
  const status = span("metadata-status");
  status.append(span("metadata-status-dot"), document.createTextNode(value));
  target.append(status);
}

function appendCheckbox(target: HTMLElement, checked: boolean): void {
  const box = span(checked ? "metadata-checkbox checked" : "metadata-checkbox");
  box.setAttribute("role", "img");
  box.setAttribute("aria-label", checked ? "Checked" : "Unchecked");
  if (checked) box.append(icon("check"));
  target.append(box);
}

function appendString(target: HTMLElement, key: string, value: string): void {
  if (isTagKey(key)) {
    const tags = value.split(",").map(item => item.trim()).filter(Boolean);
    if (tags.length) {
      appendTags(target, tags);
      return;
    }
  }
  if (isLink(value)) {
    appendLink(target, value);
    return;
  }
  const date = parseDateText(value);
  if (date) {
    appendDate(target, date, value, !DATE_ONLY.test(value));
    return;
  }
  if (isStatusKey(key)) {
    appendStatus(target, value);
    return;
  }
  if (value.includes("\n")) target.classList.add("metadata-multiline");
  target.textContent = value;
}

function appendValue(target: HTMLElement, key: string, value: unknown): void {
  if (value === null || value === undefined || value === "") {
    appendEmpty(target);
    return;
  }
  if (typeof value === "boolean") {
    appendCheckbox(target, value);
    return;
  }
  if (typeof value === "number" || typeof value === "bigint") {
    target.append(span("metadata-number", String(value)));
    return;
  }
  if (value instanceof Date) {
    appendDate(target, value, value.toISOString(), true);
    return;
  }
  if (Array.isArray(value)) {
    appendList(target, key, value);
    return;
  }
  if (isPlainObject(value)) {
    let text: string;
    try {
      text = JSON.stringify(value);
    } catch {
      text = "[object]";
    }
    const code = document.createElement("code");
    code.className = "metadata-code";
    code.textContent = text;
    target.append(code);
    return;
  }
  if (typeof value === "string") {
    appendString(target, key, value);
    return;
  }
  target.textContent = scalarText(value);
}

export function splitFrontmatter(source: string): FrontmatterResult {
  const text = source.startsWith("\uFEFF") ? source.slice(1) : source;
  const lines = text.split(/\r?\n/);
  if (lines[0]?.trimEnd() !== "---") return { body: source, metadata: null };

  const end = lines.findIndex((line, index) => index > 0 && CLOSING_FENCE.test(line));
  if (end === -1) return { body: source, metadata: null };

  const raw = lines.slice(1, end).join("\n");
  if (!raw.trim()) {
    return { body: lines.slice(end + 1).join("\n"), metadata: null };
  }

  try {
    const value = load(raw, { schema: FRONTMATTER_SCHEMA });
    if (!isPlainObject(value)) return { body: source, metadata: null };
    return { body: lines.slice(end + 1).join("\n"), metadata: value };
  } catch {
    // Keep the original Markdown visible if the YAML is malformed.
    return { body: source, metadata: null };
  }
}

export function createMetadataCard(metadata: Metadata): HTMLElement {
  const entries = Object.entries(metadata);
  const card = document.createElement("details");
  card.className = "metadata-card";
  card.open = true;

  const summary = document.createElement("summary");
  summary.className = "metadata-head";

  const heading = span("metadata-heading");
  heading.append(icon("sliders"), span("metadata-heading-text", "Properties"));

  const headMeta = span("metadata-head-meta");
  headMeta.append(
    span("metadata-count", `${entries.length} ${entries.length === 1 ? "field" : "fields"}`),
    icon("chevron", "metadata-chevron"),
  );
  summary.append(heading, headMeta);

  const list = document.createElement("dl");
  list.className = "metadata-list";
  for (const [key, value] of entries) {
    const row = document.createElement("div");
    row.className = "metadata-row";

    const term = document.createElement("dt");
    term.className = "metadata-key";
    term.append(icon(valueIcon(key, value)), span("metadata-key-text", key));

    const detail = document.createElement("dd");
    detail.className = "metadata-value";
    appendValue(detail, key, value);

    row.append(term, detail);
    list.append(row);
  }

  card.append(summary, list);
  return card;
}
