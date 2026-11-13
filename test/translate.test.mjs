import assert from "node:assert/strict";
import test from "node:test";
import { CODING_GLOSSARY, glossaryLines } from "../src/translate/glossary.ts";
import {
  buildSystemPrompt,
  buildUserPayload,
  chatText,
  parseTranslations,
  placeholderDiff,
  responseText,
} from "../src/translate/llm.ts";
import { PROVIDERS, providerFor, signatureFor, translateTexts } from "../src/translate/index.ts";

const settings = {
  engine: "llm",
  llmBaseUrl: "https://api.apikey.fan/v1",
  llmModel: "gpt-6.1-terra",
  llmApi: "responses",
  llmApiKey: "sk-test",
  llmFallback: true,
};

test("system prompt states the segment count and keeps placeholders", () => {
  const prompt = buildSystemPrompt("zh-Hans", 3);
  assert.match(prompt, /exactly 3 strings/);
  assert.match(prompt, /\[ZT_KEEP_<n>\]/);
  assert.match(prompt, /Chinese \(Simplified\)/);
});

test("coding glossary reaches the prompt for Chinese targets only", () => {
  assert.match(buildSystemPrompt("zh-Hans", 1), /functional core" -> 函数式核心/);
  assert.match(buildSystemPrompt("zh-Hant", 1), /functional core/);
  assert.equal(glossaryLines("ja"), "");
  assert.deepEqual(glossaryLines("en"), "");
});

test("glossary pairs are well formed", () => {
  for (const [source, translated] of CODING_GLOSSARY) {
    assert.ok(source.trim() && translated.trim(), `empty glossary entry: ${source}`);
  }
});

test("user payload is a JSON segment array", () => {
  assert.deepEqual(JSON.parse(buildUserPayload(["a", "b"])), { segments: ["a", "b"] });
});

test("parses plain, fenced, and chatty replies", () => {
  assert.deepEqual(parseTranslations('{"translations":["甲","乙"]}', 2), ["甲", "乙"]);
  assert.deepEqual(parseTranslations('```json\n{"translations":["甲"]}\n```', 1), ["甲"]);
  assert.deepEqual(parseTranslations('Here you go:\n{"translations":["甲"]}', 1), ["甲"]);
});

test("rejects replies with the wrong shape or count", () => {
  assert.equal(parseTranslations('{"translations":["甲"]}', 2), null);
  assert.equal(parseTranslations('{"translations":["甲",""]}', 2), null);
  assert.equal(parseTranslations('{"translations":["甲",3]}', 2), null);
  assert.equal(parseTranslations("no json here", 1), null);
});

test("extracts text from both gateway response shapes", () => {
  assert.equal(responseText({ output_text: "hi" }), "hi");
  assert.equal(
    responseText({ output: [{ content: [{ type: "output_text", text: "a" }, { type: "output_text", text: "b" }] }] }),
    "ab",
  );
  assert.equal(chatText({ choices: [{ message: { content: "hi" } }] }), "hi");
  assert.equal(chatText({ choices: [{ message: { content: [{ text: "hi" }] } }] }), "hi");
});

test("detects dropped and invented placeholders", () => {
  assert.deepEqual(placeholderDiff("see [ZT_KEEP_0] here", "看 [ZT_KEEP_0] 这里"), []);
  assert.deepEqual(placeholderDiff("see [ZT_KEEP_0]", "看 [ZT_KEEP_1]"), ["[ZT_KEEP_0]", "[ZT_KEEP_1]"]);
  assert.deepEqual(placeholderDiff("[ZT_KEEP_0][ZT_KEEP_0]", "[ZT_KEEP_0]"), []);
});

test("signatures separate models, protocols, and engines", () => {
  assert.notEqual(signatureFor(settings), signatureFor({ ...settings, llmModel: "other" }));
  assert.notEqual(signatureFor(settings), signatureFor({ ...settings, llmApi: "chat" }));
  assert.equal(signatureFor({ ...settings, engine: "microsoft" }), "microsoft");
});

test("registry resolves every advertised engine", () => {
  assert.deepEqual(PROVIDERS.map(provider => provider.id), ["microsoft", "llm"]);
  assert.equal(providerFor("llm").id, "llm");
  assert.throws(() => providerFor("nope"), /Unknown translation engine/);
});

test("an LLM without a key never reaches the network", async () => {
  await assert.rejects(
    translateTexts(["hello"], "zh-Hans", { ...settings, llmApiKey: "", llmFallback: false }),
    /API key/,
  );
});

test("blank blocks are skipped and keep their slot", async () => {
  const outcome = await translateTexts(["", "  "], "zh-Hans", settings);
  assert.deepEqual(outcome.translations, ["", ""]);
  assert.equal(outcome.fellBack, false);
});
