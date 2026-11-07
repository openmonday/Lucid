import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { build } from "esbuild";
import { copyKatex } from "./build-assets.mjs";
import { toFirefoxManifest } from "./build-manifest.mjs";

// Content scripts share one isolated world per extension in Chrome, so every
// top-level `var`/function they declare leaks into that shared scope. Two
// bundled scripts that both include a library (for example KaTeX) would then
// overwrite each other's internals. Build them as IIFEs to keep all of their
// declarations private; extension pages and the background script stay ESM.
const CONTENT_SCRIPTS = {
  content: "src/content.ts",
  "markdown-file": "src/markdown-file.ts",
};

const MODULE_SCRIPTS = {
  background: "src/background.ts",
  viewer: "src/viewer.ts",
  options: "src/options.ts",
  popup: "src/popup.ts",
};

/** Assemble an extension build: static files, KaTeX assets, manifest, and bundled scripts. */
export async function buildExtension({ outdir, target, firefox = false }) {
  rmSync(outdir, { recursive: true, force: true });
  mkdirSync(outdir, { recursive: true });
  cpSync("static", outdir, { recursive: true });
  copyKatex(outdir);

  if (firefox) {
    const manifest = JSON.parse(readFileSync("static/manifest.json", "utf8"));
    writeFileSync(
      join(outdir, "manifest.json"),
      `${JSON.stringify(toFirefoxManifest(manifest), null, 2)}\n`,
    );
  }

  await build({
    entryPoints: CONTENT_SCRIPTS,
    outdir,
    bundle: true,
    format: "iife",
    target,
    minify: false,
    logLevel: "info",
  });
  await build({
    entryPoints: MODULE_SCRIPTS,
    outdir,
    bundle: true,
    format: "esm",
    target,
    minify: false,
    logLevel: "info",
  });
}
