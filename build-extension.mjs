import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { build } from "esbuild";
import { copyKatex } from "./build-assets.mjs";
import { toFirefoxManifest } from "./build-manifest.mjs";

const ENTRY_POINTS = {
  background: "src/background.ts",
  content: "src/content.ts",
  "markdown-file": "src/markdown-file.ts",
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
    entryPoints: ENTRY_POINTS,
    outdir,
    bundle: true,
    format: "esm",
    target,
    minify: false,
    logLevel: "info",
  });
}
