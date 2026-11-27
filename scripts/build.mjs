import { buildExtension } from "./build-extension.mjs";
import { packageFirefox } from "./package-firefox.mjs";

switch (process.argv[2]) {
  case "chrome":
  case "firefox":
    await buildExtension(process.argv[2]);
    break;
  case "package-firefox":
    await packageFirefox();
    break;
  default:
    console.error("Usage: node scripts/build.mjs <chrome | firefox | package-firefox>");
    process.exitCode = 1;
}
