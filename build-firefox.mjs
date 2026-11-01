import { build } from "esbuild";
import { cpSync, mkdirSync, rmSync, renameSync } from "node:fs";

rmSync("dist-firefox", { recursive: true, force: true });
mkdirSync("dist-firefox", { recursive: true });
cpSync("static", "dist-firefox", { recursive: true });
renameSync("dist-firefox/manifest-firefox.json", "dist-firefox/manifest.json");

const options = {
  entryPoints: {
    background: "src/background.ts",
    content: "src/content.ts",
    viewer: "src/viewer.ts",
    options: "src/options.ts",
  },
  outdir: "dist-firefox",
  bundle: true,
  format: "esm",
  target: "firefox109",
  minify: false,
  logLevel: "info",
};
await build(options);
