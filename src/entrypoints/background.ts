import type {
  ExtensionRequest,
  FetchStylesheetResponse,
  TranslateResponse,
} from "../browser/messages.ts";
import { translateCached } from "../translation/engines/cache.ts";

async function toggle(tab?: chrome.tabs.Tab) {
  tab ??= (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
  if (!tab?.id) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "toggle" } satisfies ExtensionRequest);
  } catch {
    // No receiver: either the page is restricted or a file:// page without file access (Chrome only).
    const canCheck = typeof chrome.extension?.isAllowedFileSchemeAccess === "function";
    if (canCheck && tab.url?.startsWith("file://") && !(await chrome.extension.isAllowedFileSchemeAccess())) {
      await chrome.tabs.create({ url: `chrome://extensions/?id=${chrome.runtime.id}` });
    }
  }
}

// Dark Reader needs to read cross-origin stylesheets to rewrite their colors.
// Content-script fetch is subject to CORS; the background fetch is not.
async function fetchStylesheet(url: string): Promise<FetchStylesheetResponse> {
  const response = await fetch(url, { credentials: "omit" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return {
    ok: true,
    text: await response.text(),
    contentType: response.headers.get("content-type") || "text/css",
  };
}

function errorMessage(error: unknown): string {
  return String((error as Error)?.message ?? error);
}

chrome.commands.onCommand.addListener((command, tab) => {
  if (command === "toggle-translate") void toggle(tab);
});

chrome.runtime.onMessage.addListener((message: ExtensionRequest, _sender, sendResponse) => {
  switch (message?.type) {
    case "translate":
      translateCached(message.texts).then(
        translations => sendResponse({ ok: true, translations } satisfies TranslateResponse),
        error => sendResponse({ ok: false, error: errorMessage(error) } satisfies TranslateResponse),
      );
      return true;
    case "toggle-active":
      void toggle();
      return;
    case "fetch-stylesheet":
      fetchStylesheet(message.url).then(
        sendResponse,
        error => sendResponse({ ok: false, error: errorMessage(error) } satisfies FetchStylesheetResponse),
      );
      return true;
  }
});
