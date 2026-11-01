// Rasterize assets/icon.svg into the PNG sizes the extension manifest needs.
// Run: node build-icons.mjs
import { Resvg } from "@resvg/resvg-js";
import { readFileSync, writeFileSync } from "node:fs";

const svg = readFileSync("assets/icon.svg", "utf8");
const sizes = [16, 32, 48, 128];
const targets = ["static/icons", "dist/icons", "dist-firefox/icons"];

for (const size of sizes) {
  const png = new Resvg(svg, {
    fitTo: { mode: "width", value: size },
    background: "rgba(0,0,0,0)",
  })
    .render()
    .asPng();
  for (const dir of targets) {
    try {
      writeFileSync(`${dir}/${size}.png`, png);
    } catch {
      // dist folders may not exist yet; static is the source of truth.
    }
  }
  console.log(`icon ${size}x${size}`);
}
