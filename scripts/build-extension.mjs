import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { toFirefoxManifest } from "./build-manifest.mjs";

export const projectRoot = fileURLToPath(new URL("../", import.meta.url));

const targets = {
  chrome: { outdir: "dist", target: "chrome120" },
  firefox: { outdir: "dist-firefox", target: "firefox109" },
};

// Content scripts share one isolated world per extension in Chrome. Build them
// as IIFEs so their top-level declarations can't overwrite each other's; the
// extension pages and background script stay ESM.
const bundles = [
  { format: "iife", entries: ["content", "markdown-file"] },
  { format: "esm", entries: ["background", "viewer", "options", "popup"] },
];

/** Assemble a named browser target, optionally in a different output directory. */
export async function buildExtension(browser, { outdir } = {}) {
  if (!Object.hasOwn(targets, browser)) throw new Error(`Unknown extension target: ${browser}`);
  const config = targets[browser];
  const output = resolve(projectRoot, outdir ?? config.outdir);
  const staticDir = join(projectRoot, "static");
  const katex = join(projectRoot, "node_modules", "katex", "dist");
  const katexOutput = join(output, "vendor", "katex");

  rmSync(output, { recursive: true, force: true });
  cpSync(staticDir, output, { recursive: true });
  mkdirSync(katexOutput, { recursive: true });
  cpSync(join(katex, "katex.min.css"), join(katexOutput, "katex.min.css"));
  cpSync(join(katex, "fonts"), join(katexOutput, "fonts"), { recursive: true });

  if (browser === "firefox") {
    const manifest = JSON.parse(readFileSync(join(staticDir, "manifest.json"), "utf8"));
    writeFileSync(join(output, "manifest.json"), `${JSON.stringify(toFirefoxManifest(manifest), null, 2)}\n`);
  }

  for (const { format, entries } of bundles) {
    await build({
      absWorkingDir: projectRoot,
      entryPoints: Object.fromEntries(entries.map((name) => [name, `src/entrypoints/${name}.ts`])),
      outdir: output,
      bundle: true,
      format,
      target: config.target,
      minify: false,
      logLevel: "info",
    });
  }
  return output;
}
