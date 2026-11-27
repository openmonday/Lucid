import assert from "node:assert/strict";
import test from "node:test";
import { llmProvider, PROMPT_VERSION } from "../src/translation/engines/llm.ts";
import { microsoftProvider } from "../src/translation/engines/microsoft.ts";

let nextImportId = 0;

async function loadBackground(t, storage = {}) {
  const messages = [];
  const commands = [];
  const sent = [];
  globalThis.chrome = {
    runtime: { onMessage: { addListener: listener => messages.push(listener) } },
    commands: { onCommand: { addListener: listener => commands.push(listener) } },
    tabs: {
      query: async () => [{ id: 1 }],
      sendMessage: async (...args) => sent.push(args),
    },
    storage,
  };
  t.after(() => { delete globalThis.chrome; });
  // Each test loads the entrypoint against its own fake browser API.
  await import(`../src/entrypoints/background.ts?test=${nextImportId++}`);
  assert.equal(messages.length, 1);
  assert.equal(commands.length, 1);
  return { onMessage: messages[0], onCommand: commands[0], sent };
}

async function request(onMessage, message) {
  const { promise, resolve } = Promise.withResolvers();
  assert.equal(onMessage(message, {}, resolve), true, "async responses must keep the message channel open");
  return promise;
}

test("routes toggle messages and the keyboard command to the right tab", async t => {
  const { onMessage, onCommand, sent } = await loadBackground(t);
  assert.equal(onMessage({ type: "unknown" }, {}, assert.fail), undefined);
  assert.equal(onMessage({ type: "toggle-active" }, {}, assert.fail), undefined);
  await Promise.resolve();
  onCommand("unrelated", { id: 2 });
  onCommand("toggle-translate", { id: 3 });
  assert.deepEqual(sent, [[1, { type: "toggle" }], [3, { type: "toggle" }]]);
});

test("the stylesheet route responds on success and on fetch or HTTP failure", { timeout: 5000 }, async t => {
  const { onMessage } = await loadBackground(t);
  const message = { type: "fetch-stylesheet", url: "https://example.test/page.css" };
  const fetch = t.mock.method(globalThis, "fetch", async () => new Response("body {}", {
    headers: { "content-type": "text/css" },
  }));
  assert.deepEqual(await request(onMessage, message), { ok: true, text: "body {}", contentType: "text/css" });
  assert.deepEqual(fetch.mock.calls[0].arguments, [message.url, { credentials: "omit" }]);

  fetch.mock.mockImplementationOnce(async () => new Response(null, { status: 404 }));
  assert.deepEqual(await request(onMessage, message), { ok: false, error: "HTTP 404" });
  fetch.mock.mockImplementationOnce(async () => { throw new Error("network down"); });
  assert.deepEqual(await request(onMessage, message), { ok: false, error: "network down" });
});

test("translation deduplicates misses and keeps fallback, model, and language cache entries separate", { timeout: 5000 }, async t => {
  const { promise: saved, resolve: save } = Promise.withResolvers();
  const settings = { target: "ja", engine: "llm", llmModel: "first" };
  const llm = t.mock.method(llmProvider, "translate", async (texts, target, config) =>
    texts.map(text => `${config.llmModel}:${target}:${text}`),
  );
  llm.mock.mockImplementationOnce(async () => { throw new Error("temporarily unavailable"); });
  const bing = t.mock.method(microsoftProvider, "translate", async texts => texts.map(text => `bing:${text}`));
  const local = {
    get: async keys => typeof keys === "string" ? {} : keys,
    set: async values => save(values),
    remove: t.mock.fn(async () => {}),
  };
  const { onMessage } = await loadBackground(t, {
    sync: { get: async defaults => ({ ...defaults, ...settings }) },
    local,
  });
  const translate = (...texts) => request(onMessage, { type: "translate", texts });
  const expected = (...translations) => ({ ok: true, translations });

  assert.deepEqual(await translate("title", "subheading", "title"), expected("bing:title", "bing:subheading", "bing:title"));
  assert.deepEqual(bing.mock.calls[0].arguments[0], ["title", "subheading"]);
  assert.deepEqual(await translate("title"), expected("first:ja:title"));
  assert.deepEqual(await translate("title"), expected("first:ja:title"));
  assert.equal(llm.mock.callCount(), 2);

  settings.llmModel = "second";
  assert.deepEqual(await translate("title"), expected("second:ja:title"));
  settings.target = "de";
  assert.deepEqual(await translate("title"), expected("second:de:title"));
  assert.deepEqual(local.remove.mock.calls[0].arguments, ["cache-v1"]);
  assert.deepEqual(new Map((await saved)["cache-v2"]), new Map([
    [["microsoft", "ja", "title"].join("\0"), "bing:title"],
    [["microsoft", "ja", "subheading"].join("\0"), "bing:subheading"],
    [[`llm:first:responses:p${PROMPT_VERSION}`, "ja", "title"].join("\0"), "first:ja:title"],
    [[`llm:second:responses:p${PROMPT_VERSION}`, "ja", "title"].join("\0"), "second:ja:title"],
    [[`llm:second:responses:p${PROMPT_VERSION}`, "de", "title"].join("\0"), "second:de:title"],
  ]));
});
