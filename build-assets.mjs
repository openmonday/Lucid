import { cpSync, mkdirSync } from "node:fs";

/** Copy KaTeX's stylesheet and fonts next to each build so the viewer and content pages can use local assets. */
export function copyKatex(outdir) {
  const target = `${outdir}/vendor/katex`;
  mkdirSync(target, { recursive: true });
  cpSync("node_modules/katex/dist/katex.min.css", `${target}/katex.min.css`);
  cpSync("node_modules/katex/dist/fonts", `${target}/fonts`, { recursive: true });
}
