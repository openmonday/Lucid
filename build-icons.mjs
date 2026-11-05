// Rasterize assets/icon.svg into the PNG sizes the extension manifest needs.
// Run: node build-icons.mjs. Builds copy static/ into each output folder, so
// static/icons is the only place this script needs to write.
import { Resvg } from "@resvg/resvg-js";
import { readFileSync, writeFileSync } from "node:fs";

const svg = readFileSync("assets/icon.svg", "utf8");
const sizes = [16, 32, 48, 128];

for (const size of sizes) {
  const png = new Resvg(svg, {
    fitTo: { mode: "width", value: size },
    background: "rgba(0,0,0,0)",
  })
    .render()
    .asPng();
  writeFileSync(`static/icons/${size}.png`, png);
  console.log(`icon ${size}x${size}`);
}
