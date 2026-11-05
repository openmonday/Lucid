import { buildExtension } from "./build-extension.mjs";

await buildExtension({ outdir: "dist", target: "chrome120" });
