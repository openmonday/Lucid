import assert from "node:assert/strict";
import test from "node:test";
import { splitMath } from "../src/math.ts";

test("plain text is returned unchanged", () => {
  assert.deepEqual(splitMath("Hello world"), [
    { type: "text", value: "Hello world" },
  ]);
});

test("recognizes inline $...$", () => {
  assert.deepEqual(splitMath("before $x^2$ after"), [
    { type: "text", value: "before " },
    { type: "math", value: { tex: "x^2", displayMode: false } },
    { type: "text", value: " after" },
  ]);
});

test("recognizes display $$...$$", () => {
  assert.deepEqual(splitMath("$$\\int x\\,dx$$"), [
    { type: "math", value: { tex: "\\int x\\,dx", displayMode: true } },
  ]);
});

test("recognizes \\(...\\) and \\[...\\]", () => {
  assert.deepEqual(splitMath("\\(a+b\\)"), [
    { type: "math", value: { tex: "a+b", displayMode: false } },
  ]);
  assert.deepEqual(splitMath("\\[a+b\\]"), [
    { type: "math", value: { tex: "a+b", displayMode: true } },
  ]);
});

test("does not treat escaped dollars as math", () => {
  assert.deepEqual(splitMath("Costs \\$5"), [
    { type: "text", value: "Costs \\$5" },
  ]);
});

test("ignores currency-style dollar amounts", () => {
  assert.deepEqual(splitMath("Costs $5 and $6 today"), [
    { type: "text", value: "Costs $5 and $6 today" },
  ]);
});

test("does not split math inside words", () => {
  assert.deepEqual(splitMath("a$x$b"), [{ type: "text", value: "a$x$b" }]);
});

test("allows math beside CJK text", () => {
  assert.deepEqual(splitMath("中文$x$。"), [
    { type: "text", value: "中文" },
    { type: "math", value: { tex: "x", displayMode: false } },
    { type: "text", value: "。" },
  ]);
});

test("leaves unmatched delimiters as text", () => {
  assert.deepEqual(splitMath("$x and $$y"), [
    { type: "text", value: "$x and $$y" },
  ]);
});
