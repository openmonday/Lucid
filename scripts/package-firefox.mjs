import { execFileSync } from "node:child_process";
import { globSync, mkdtempSync, readFileSync, renameSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { buildExtension, projectRoot } from "./build-extension.mjs";

const iconPaths = (icons) => typeof icons === "string" ? [icons] : Object.values(icons ?? {});

export function verifyFirefoxBuild(dist) {
  const manifest = JSON.parse(readFileSync(join(dist, "manifest.json"), "utf8"));
  // Firefox ignores background.service_worker. An archive without scripts can
  // look valid but will have no working background page.
  const backgroundScripts = manifest.background?.scripts;
  if (!Array.isArray(backgroundScripts) || !backgroundScripts.length) {
    throw new Error("Firefox manifest must define background.scripts");
  }
  if (!manifest.browser_specific_settings?.gecko?.data_collection_permissions) {
    throw new Error("Firefox manifest must declare data_collection_permissions (Firefox 140+)");
  }

  const files = new Set([
    // These are loaded by extension pages, not directly by the manifest.
    "viewer.html", "viewer.js", "viewer.css", "options.js", "popup.js",
    ...backgroundScripts,
    ...(manifest.content_scripts ?? []).flatMap(({ js = [], css = [] }) => [...js, ...css]),
    ...iconPaths(manifest.icons),
    ...iconPaths(manifest.action?.default_icon),
    manifest.action?.default_popup,
    manifest.options_ui?.page,
    ...(manifest.declarative_net_request?.rule_resources ?? []).map(({ path }) => path),
    ...(manifest.web_accessible_resources ?? []).flatMap(({ resources }) => resources),
  ]);
  for (const file of files) {
    if (file === undefined) continue;
    const matches = file.includes("*") ? globSync(file, { cwd: dist }) : [file];
    if (!matches.some((match) => statSync(join(dist, match), { throwIfNoEntry: false })?.isFile())) {
      throw new Error(`Firefox build is missing ${file}`);
    }
  }
  return manifest;
}

export async function packageFirefox() {
  const dist = await buildExtension("firefox");
  const manifest = verifyFirefoxBuild(dist);
  const archive = join(projectRoot, "lucid.xpi");
  // Keep the temporary archive on the same filesystem for an atomic rename.
  const staging = mkdtempSync(join(projectRoot, ".lucid-package-"));
  try {
    const temp = join(staging, "lucid.xpi");
    execFileSync("zip", ["-qr", "-X", temp, "."], { cwd: dist, stdio: "inherit" });
    renameSync(temp, archive);
  } catch (error) {
    if (error?.path === "zip" && error.code === "ENOENT") {
      throw new Error("The `zip` command is required to build lucid.xpi.", { cause: error });
    }
    throw error;
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }

  const size = (statSync(archive).size / 1024 / 1024).toFixed(2);
  console.log(`\nCreated ${archive}`);
  console.log(`Lucid ${manifest.version} · ${size} MB`);
}
