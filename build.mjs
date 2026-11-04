import { build, context } from "esbuild";
import { copyKatex } from "./build-assets.mjs";
import { cpSync, mkdirSync, rmSync } from "node:fs";

rmSync("dist", { recursive: true, force: true });
mkdirSync("dist", { recursive: true });
cpSync("static", "dist", { recursive: true });
copyKatex("dist");

const options = {
  entryPoints: {
    background: "src/background.ts",
    content: "src/content.ts",
    viewer: "src/viewer.ts",
    options: "src/options.ts",
    popup: "src/popup.ts",
  },
  outdir: "dist",
  bundle: true,
  format: "esm",
  target: "chrome120",
  minify: false,
  logLevel: "info",
};
await build(options);
