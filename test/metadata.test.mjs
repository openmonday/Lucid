import assert from "node:assert/strict";
import test from "node:test";
import { splitFrontmatter } from "../src/metadata.ts";

test("returns the source when frontmatter is absent", () => {
  const source = "# Heading\n\nBody";
  assert.deepEqual(splitFrontmatter(source), { body: source, metadata: null });
});

test("parses YAML and returns the remaining body", () => {
  const result = splitFrontmatter(
    "---\ntitle: Hello\ntags:\n  - one\n  - two\n---\n# Heading\n",
  );
  assert.equal(result.body, "# Heading\n");
  assert.deepEqual(result.metadata, { title: "Hello", tags: ["one", "two"] });
});

test("accepts ... as the closing fence", () => {
  assert.deepEqual(splitFrontmatter("---\ntitle: Hi\n...\nBody"), {
    body: "Body",
    metadata: { title: "Hi" },
  });
});

test("strips a BOM before the opening fence", () => {
  assert.deepEqual(splitFrontmatter("\uFEFF---\ntitle: Hi\n---\nBody"), {
    body: "Body",
    metadata: { title: "Hi" },
  });
});

test("requires the opening fence on the first line", () => {
  const source = "\n---\ntitle: Hi\n---\nBody";
  assert.deepEqual(splitFrontmatter(source), { body: source, metadata: null });
});

test("drops an empty frontmatter block but keeps the body", () => {
  assert.deepEqual(splitFrontmatter("---\n---\nBody"), {
    body: "Body",
    metadata: null,
  });
});

test("keeps the source when YAML is malformed", () => {
  const source = "---\ntitle: [oops\n---\nBody";
  assert.deepEqual(splitFrontmatter(source), { body: source, metadata: null });
});

test("keeps the source when frontmatter is not a mapping", () => {
  const source = "---\n- one\n- two\n---\nBody";
  assert.deepEqual(splitFrontmatter(source), { body: source, metadata: null });
});

test("supports YAML merge keys", () => {
  const result = splitFrontmatter(
    "---\ndefaults: &d\n  a: 1\nconfig:\n  <<: *d\n  b: 2\n---\nBody",
  );
  assert.deepEqual(result.metadata, {
    defaults: { a: 1 },
    config: { a: 1, b: 2 },
  });
});
