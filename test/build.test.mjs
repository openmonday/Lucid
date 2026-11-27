import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { buildExtension } from "../scripts/build-extension.mjs";
import { verifyFirefoxBuild } from "../scripts/package-firefox.mjs";

const chromeManifest = readFileSync(new URL("../static/manifest.json", import.meta.url), "utf8");
const contentScripts = ["content.js", "markdown-file.js"];
const modules = ["background.js", "viewer.js", "options.js", "popup.js"];

function checkBundles(dist) {
  for (const file of [...contentScripts, ...modules]) {
    const source = readFileSync(join(dist, file), "utf8");
    assert.ok(source.trim(), `${file} should not be empty`);
    const body = source.trimStart().replace(/^["']use strict["'];\s*/, "");
    const isIife = body.startsWith("(() => {");
    assert.equal(isIife, contentScripts.includes(file), `${file} should use its configured format`);
  }
}

test("builds Chrome and Firefox artifacts outside the project directory", async (t) => {
  const temp = mkdtempSync(join(tmpdir(), "lucid-build-"));
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  const chrome = join(temp, "chrome");
  const firefox = join(temp, "firefox");
  const cwd = process.cwd();
  process.chdir(temp);
  try {
    await buildExtension("chrome", { outdir: chrome });
    await buildExtension("firefox", { outdir: firefox });
  } finally {
    process.chdir(cwd);
  }

  assert.equal(readFileSync(join(chrome, "manifest.json"), "utf8"), chromeManifest);
  assert.equal(JSON.parse(chromeManifest).background.service_worker, "background.js");
  checkBundles(chrome);
  checkBundles(firefox);

  const manifest = verifyFirefoxBuild(firefox);
  assert.deepEqual(manifest.background, { scripts: ["background.js"], type: "module" });
  assert.deepEqual(manifest.options_ui, { page: "options.html", open_in_tab: false });
  assert.equal(manifest.minimum_chrome_version, undefined);
  assert.equal(manifest.options_page, undefined);
  assert.ok(manifest.host_permissions.includes("file:///*"));
  assert.deepEqual(manifest.browser_specific_settings.gecko.data_collection_permissions, {
    required: ["websiteContent"],
  });
  assert.deepEqual(manifest.content_scripts, JSON.parse(chromeManifest).content_scripts);

  await t.test("the Firefox verifier rejects invalid manifest settings", () => {
    const path = join(firefox, "manifest.json");
    writeFileSync(path, JSON.stringify({ ...manifest, background: {} }));
    assert.throws(() => verifyFirefoxBuild(firefox), /background\.scripts/);
    writeFileSync(path, JSON.stringify({ ...manifest, browser_specific_settings: {} }));
    assert.throws(() => verifyFirefoxBuild(firefox), /data_collection_permissions/);
    writeFileSync(path, JSON.stringify(manifest));
  });

  await t.test("the Firefox verifier rejects missing manifest assets", () => {
    for (const file of ["markdown-file.js", "icons/128.png", "rules.json", "popup.html"]) {
      const path = join(firefox, file);
      const contents = readFileSync(path);
      rmSync(path);
      assert.throws(() => verifyFirefoxBuild(firefox), { message: `Firefox build is missing ${file}` });
      writeFileSync(path, contents);
    }
    rmSync(join(firefox, "vendor/katex/fonts"), { recursive: true });
    assert.throws(() => verifyFirefoxBuild(firefox), { message: "Firefox build is missing vendor/katex/fonts/*" });
  });
});
