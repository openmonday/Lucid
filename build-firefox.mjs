import { buildExtension } from "./build-extension.mjs";

await buildExtension({ outdir: "dist-firefox", target: "firefox109", firefox: true });
