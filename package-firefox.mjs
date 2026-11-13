import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, renameSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const dist = join(root, "dist-firefox");
const archive = join(root, "lucid.xpi");
const temp = join(root, "lucid.tmp.xpi");

process.chdir(root);
await import("./build-firefox.mjs");

const required = [
  "manifest.json",
  "viewer.html",
  "viewer.js",
  "viewer.css",
  "background.js",
  "content.js",
  "options.html",
  "options.js",
];
for (const file of required) {
  if (!existsSync(join(dist, file))) {
    throw new Error(`Firefox build is missing ${file}; check build-firefox.mjs output.`);
  }
}

rmSync(temp, { force: true });
try {
  execFileSync("zip", ["-qr", "-X", temp, "."], { cwd: dist, stdio: "inherit" });
} catch (error) {
  rmSync(temp, { force: true });
  if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
    throw new Error("The `zip` command is required to build lucid.xpi.");
  }
  throw error;
}

rmSync(archive, { force: true });
renameSync(temp, archive);

const manifest = JSON.parse(readFileSync(join(dist, "manifest.json"), "utf8"));
// Firefox ignores background.service_worker, so a manifest that lost its
// event-page scripts would package cleanly but never run.
if (!manifest.background?.scripts?.length) {
  throw new Error("Firefox manifest must define background.scripts");
}
if (!manifest.browser_specific_settings?.gecko?.data_collection_permissions) {
  throw new Error("Firefox manifest must declare data_collection_permissions (Firefox 140+)");
}
const size = (statSync(archive).size / 1024 / 1024).toFixed(2);
console.log(`\nCreated ${archive}`);
console.log(`Lucid ${manifest.version} · ${size} MB`);
