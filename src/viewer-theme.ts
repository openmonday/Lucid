import { DEFAULT_THEME } from "./shared.ts";

function applyViewerTheme(theme: unknown) {
  if (theme === "claude") document.documentElement.setAttribute("data-bt-viewer", "claude");
  else document.documentElement.removeAttribute("data-bt-viewer");
}

/** Keep the viewer palette in sync with the stored theme. */
export async function installViewerTheme(): Promise<void> {
  if (typeof chrome === "undefined" || !chrome.storage) return;
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes.viewerTheme) applyViewerTheme(changes.viewerTheme.newValue);
  });
  const { viewerTheme } = await chrome.storage.sync.get({ viewerTheme: DEFAULT_THEME });
  applyViewerTheme(viewerTheme);
}
