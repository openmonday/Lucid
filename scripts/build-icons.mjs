// Rasterize assets/icon.svg into the PNG sizes the extension manifest needs.
// Run: npm run build:icons. Builds copy static/ into each output directory.
import { readFileSync, writeFileSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";

const svg = readFileSync(new URL("../assets/icon.svg", import.meta.url), "utf8");
const sizes = [16, 32, 48, 128];

for (const size of sizes) {
  const png = new Resvg(svg, {
    fitTo: { mode: "width", value: size },
    background: "rgba(0,0,0,0)",
  })
    .render()
    .asPng();
  writeFileSync(new URL(`../static/icons/${size}.png`, import.meta.url), png);
  console.log(`icon ${size}x${size}`);
}
