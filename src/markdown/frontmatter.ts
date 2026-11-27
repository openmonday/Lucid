import { CORE_SCHEMA, load, mergeTag } from "js-yaml";

export type Metadata = Record<string, unknown>;

export interface FrontmatterResult {
  body: string;
  metadata: Metadata | null;
}

const CLOSING_FENCE = /^(?:---|\.\.\.)\s*$/;
const FRONTMATTER_SCHEMA = CORE_SCHEMA.withTags(mergeTag);

export function isPlainObject(value: unknown): value is Metadata {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof Date) &&
    Object.prototype.toString.call(value) === "[object Object]"
  );
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
