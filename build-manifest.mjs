// Chrome and Firefox share almost the entire manifest. Keep static/manifest.json
// as the single source of truth and derive Firefox's copy at build time so
// permissions, content scripts, and icons cannot drift between the two builds.
export function toFirefoxManifest(chromeManifest) {
  const manifest = { ...chromeManifest };
  delete manifest.minimum_chrome_version;

  const optionsPage = manifest.options_page;
  delete manifest.options_page;
  if (!optionsPage) throw new Error("static/manifest.json must define options_page");

  return {
    ...manifest,
    // Firefox 153+ hides the "Access local files on your computer" opt-in
    // unless the extension also declares a file: host permission. Content
    // scripts matching file:// are not enough to surface the toggle, and
    // without the opt-in the Markdown content script never runs.
    host_permissions: [...new Set([...(manifest.host_permissions ?? []), "file:///*"])],
    browser_specific_settings: {
      gecko: {
        id: "lucid@example.com",
        strict_min_version: "109.0",
      },
    },
    background: {
      scripts: ["background.js"],
      type: "module",
    },
    options_ui: {
      page: optionsPage,
      open_in_tab: false,
    },
  };
}
