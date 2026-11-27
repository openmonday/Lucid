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
        // 142 is the floor for the manifest keys used here: background.type (112),
        // declarativeNetRequest rule_resources (113), data_collection_permissions
        // (140 desktop, 142 Android).
        strict_min_version: "142.0",
        // Firefox 140+ requires extensions to declare data collection. Page text
        // is sent to the configured translation engine (Bing, or the user's own
        // LLM endpoint), so this is required, not optional.
        data_collection_permissions: { required: ["websiteContent"] },
      },
    },
    background: {
      scripts: ["background.js"],
      // Firefox applies `type: "module"` to background scripts from 106 on. The
      // bundle has no top-level import/export statements, so it also loads as a
      // classic event-page script on browsers that ignore the key.
      type: "module",
    },
    options_ui: {
      page: optionsPage,
      open_in_tab: false,
    },
  };
}
