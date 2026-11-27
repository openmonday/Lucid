// Capture native messaging before importing Dark Reader, which installs its shim.
import { installSendMessageRouter } from "./native-messaging.ts";
import * as DarkReader from "darkreader";
import { DEFAULT_DARK_MODE } from "../browser/preferences.ts";
import type { FetchStylesheetRequest, FetchStylesheetResponse } from "../browser/messages.ts";
import { hasNativeDarkTheme, waitForStyles } from "./native-theme.ts";

/*
 * Page dark mode is provided by Dark Reader's dynamic theme engine
 * (https://github.com/darkreader/darkreader, MIT). It rewrites the page's
 * stylesheets instead of blanket-`!important` overrides, so CSS variables,
 * shadows, gradients, inline styles and component themes stay consistent.
 *
 * A page that already has its own dark theme is left completely untouched.
 */

const LEGACY_STYLE_ID = "bt-dark-style";
const media = matchMedia("(prefers-color-scheme: dark)");

// Bilibili's comment widgets render into shadow roots whose styles can be
// created after Dark Reader's pass. Their unprocessed rules keep using the
// light-theme variables, so comment text stays dark and the comment editor
// keeps a near-white border. Pin those variables to Dark Reader's values.
// Adapted from Dark Reader's dynamic-theme-fixes.config (MIT).
const BILIBILI_FIXES: DarkReader.DynamicThemeFix = {
  css: `
:root {
  --text1: var(--darkreader-neutral-text) !important;
  --text2: var(--darkreader-text--text2, var(--darkreader-neutral-text)) !important;
  --bg1: var(--darkreader-neutral-background) !important;
  --bg3: var(--darkreader-bg--bg3, var(--darkreader-neutral-background)) !important;
  --brand_blue_thin: var(--darkreader-bg--brand_blue_thin, var(--darkreader-neutral-background)) !important;
  --graph_bg_thick: var(--darkreader-border--graph_bg_thick, #3e4346) !important;
  --graph_weak: var(--darkreader-border--graph_weak, #3e4346) !important;
  --line_regular: var(--darkreader-border--line_regular, #3e4346) !important;
  --Ga1: var(--darkreader-border--Ga1, #34383a) !important;
}
`,
  invert: [],
  ignoreInlineStyle: [],
  ignoreImageAnalysis: [],
  disableStyleSheetsProxy: false,
  ignoreCSSUrl: [],
};

function fixesForHost(hostname: string): DarkReader.DynamicThemeFix | undefined {
  const host = hostname.toLowerCase();
  if (host === "bilibili.com" || host.endsWith(".bilibili.com")) {
    return BILIBILI_FIXES;
  }
  return undefined;
}

let enabled = DEFAULT_DARK_MODE;
let applied = false;
let generation = 0;

function removeLegacyTheme() {
  document.getElementById(LEGACY_STYLE_ID)?.remove();
  delete document.documentElement.dataset.btDark;
}

// ---- enable / disable ----

// Dark Reader hands its stylesheet proxy to the page as an inline <script>, a
// holdover from the MV2 era. Chromium's content-script isolated world has its
// own CSP (`script-src 'self' 'wasm-unsafe-eval' 'inline-speculation-rules'
// chrome-extension://…/`) without `'unsafe-inline'`, so that script is always
// blocked there and Chrome 142+ reports the block as an extension error. The
// proxy therefore never runs under the embeddable API on Chromium, and skipping
// the insertion leaves Dark Reader's non-proxy polling path — the one that
// already runs — untouched. Firefox applies the page's CSP to such scripts and
// can still run the proxy, so it keeps the default behavior.
const isFirefox =
  typeof (globalThis as { browser?: { runtime?: { getBrowserInfo?: unknown } } }).browser
    ?.runtime?.getBrowserInfo === "function";
const proxyNeverRuns = !isFirefox;

function isProxyScript(node: Node): boolean {
  return node instanceof Element && node.classList.contains("darkreader--proxy");
}

function skipProxyScriptInsertion(): () => void {
  const head = document.head;
  const originalInsertBefore = head.insertBefore;
  head.insertBefore = function <T extends Node>(node: T, child: Node | null): T {
    if (isProxyScript(node)) return node;
    return originalInsertBefore.call(head, node, child) as T;
  };
  return () => {
    head.insertBefore = originalInsertBefore;
  };
}

function enableTheme() {
  if (applied) return;
  const restoreInsertBefore = proxyNeverRuns ? skipProxyScriptInsertion() : null;
  try {
    DarkReader.enable(
      {
        mode: 1,
        brightness: 100,
        contrast: 100,
        grayscale: 0,
        sepia: 0,
        styleSystemControls: true,
      },
      fixesForHost(location.hostname),
    );
  } finally {
    restoreInsertBefore?.();
  }
  applied = true;
}

function disableTheme() {
  if (!applied) return;
  DarkReader.disable();
  applied = false;
}

async function evaluate() {
  const current = ++generation;

  removeLegacyTheme();

  // Lucid renders local Markdown with the viewer's own light/dark palette.
  if (document.documentElement.dataset.lucidMarkdown !== undefined) {
    disableTheme();
    return;
  }

  if (!enabled || !media.matches) {
    disableTheme();
    return;
  }
  if (applied) return;

  await waitForStyles();
  // A little more time for client-rendered pages to paint their first screen.
  await new Promise((resolve) => setTimeout(resolve, 100));

  if (current !== generation || !enabled || !media.matches || applied) return;

  if (hasNativeDarkTheme()) {
    // The site already has a dark theme. Leave it alone.
    disableTheme();
    return;
  }
  enableTheme();
}

export function installDarkMode(): void {
  installSendMessageRouter();

  // Dark Reader uses this for cross-origin stylesheets and image analysis. Prefer
  // the page's own fetch, then fall back to the extension background (which has
  // host permissions and therefore ignores CORS).
  DarkReader.setFetchMethod(async (url) => {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch {
      // Fall through to the privileged fetch.
    }

    const result = (await chrome.runtime.sendMessage({
      type: "fetch-stylesheet",
      url,
    } satisfies FetchStylesheetRequest)) as FetchStylesheetResponse | undefined;

    if (!result?.ok) {
      throw new Error(result?.error ?? `Could not fetch ${url}`);
    }
    return new Response(result.text, {
      status: 200,
      headers: { "content-type": result.contentType },
    });
  });

  chrome.storage.sync
    .get({ darkMode: DEFAULT_DARK_MODE })
    .then((value) => {
      enabled = value.darkMode !== false;
      void evaluate();
    });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync" || !changes.darkMode) return;
    enabled = changes.darkMode.newValue !== false;
    void evaluate();
  });

  media.addEventListener("change", () => {
    void evaluate();
  });
}
