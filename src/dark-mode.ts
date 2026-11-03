import { installSendMessageRouter } from "./native-messaging";
import * as DarkReader from "darkreader";

import type { FetchStylesheetRequest, FetchStylesheetResponse } from "./shared";

installSendMessageRouter();

/*
 * Page dark mode is provided by Dark Reader's dynamic theme engine
 * (https://github.com/darkreader/darkreader, MIT). It rewrites the page's
 * stylesheets instead of blanket-`!important` overrides, so CSS variables,
 * shadows, gradients, inline styles and component themes stay consistent.
 *
 * A page that already has its own dark theme is left completely untouched.
 */

const DEFAULT_ENABLED = true;
const LEGACY_STYLE_ID = "bt-dark-style";
const media = matchMedia("(prefers-color-scheme: dark)");

let enabled = DEFAULT_ENABLED;
let applied = false;
let generation = 0;

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

function removeLegacyTheme() {
  document.getElementById(LEGACY_STYLE_ID)?.remove();
  delete document.documentElement.dataset.btDark;
}

// ---- native dark theme detection ----
// Adapted from Dark Reader's src/inject/detector.ts.

interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

const colorCache = new Map<string, RGBA | null>();
let colorCanvas: HTMLCanvasElement | null = null;
let colorContext: CanvasRenderingContext2D | null = null;

function parseColor(value: string): RGBA | null {
  const key = value.trim().toLowerCase();
  if (!key) return null;
  const cached = colorCache.get(key);
  if (cached !== undefined) return cached;
  const parsed = parseColorUncached(key);
  colorCache.set(key, parsed);
  return parsed;
}

function parseColorUncached(color: string): RGBA | null {
  if (color === "transparent") return { r: 0, g: 0, b: 0, a: 0 };

  const fn = color.match(/^rgba?\((.+)\)$/);
  if (fn) {
    const parts = fn[1].split(/[\s,/]+/).filter(Boolean);
    if (parts.length >= 3) {
      const r = channel(parts[0]);
      const g = channel(parts[1]);
      const b = channel(parts[2]);
      const a = parts[3] === undefined ? 1 : alpha(parts[3]);
      if ([r, g, b, a].every(Number.isFinite)) {
        return { r, g, b, a };
      }
    }
  }

  const hex = color.match(/^#([0-9a-f]{3,8})$/);
  if (hex) {
    let value = hex[1];
    if (value.length === 3 || value.length === 4) {
      value = [...value].map((c) => c + c).join("");
    }
    if (value.length === 6 || value.length === 8) {
      return {
        r: parseInt(value.slice(0, 2), 16),
        g: parseInt(value.slice(2, 4), 16),
        b: parseInt(value.slice(4, 6), 16),
        a: value.length === 8 ? parseInt(value.slice(6, 8), 16) / 255 : 1,
      };
    }
  }

  // Canvas understands modern formats such as color(srgb ...), lab(), oklch().
  try {
    if (!colorContext) {
      colorCanvas = document.createElement("canvas");
      colorCanvas.width = 1;
      colorCanvas.height = 1;
      colorContext = colorCanvas.getContext("2d", { willReadFrequently: true });
    }
    if (!colorContext) return null;
    colorContext.fillStyle = "#010203";
    colorContext.fillStyle = color;
    colorContext.clearRect(0, 0, 1, 1);
    colorContext.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = colorContext.getImageData(0, 0, 1, 1).data;
    return { r, g, b, a: a / 255 };
  } catch {
    return null;
  }
}

function channel(value: string): number {
  const n = parseFloat(value);
  return Math.max(0, Math.min(255, value.endsWith("%") ? (n / 100) * 255 : n));
}

function alpha(value: string): number {
  const n = parseFloat(value);
  return Math.max(0, Math.min(1, value.endsWith("%") ? n / 100 : n));
}

function lightness({ r, g, b }: RGBA): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function hasDarkMarker() {
  const markers = [
    "dark",
    "dark-mode",
    "darkmode",
    "dark-theme",
    "theme-dark",
    "night",
    "night-mode",
  ];
  const values = ["theme", "colorMode", "bsTheme", "mode"];
  const elements = [document.documentElement, document.body];

  for (const element of elements) {
    if (!element) continue;
    if (markers.some((marker) => element.classList.contains(marker))) return true;
    for (const key of values) {
      const value = (element.dataset as Record<string, string | undefined>)[key];
      if (value?.toLowerCase() === "dark" || value?.toLowerCase() === "night") return true;
    }
  }
  return false;
}

function hasBuiltInDarkTheme(): boolean {
  const rootStyle = getComputedStyle(document.documentElement);
  if (rootStyle.filter.includes("invert(1)") || rootStyle.colorScheme === "dark") {
    return true;
  }

  // Another dark theme extension is already active. Do not stack two themes.
  if (document.querySelector("style.darkreader, link.darkreader")) {
    return true;
  }

  const CELL_SIZE = 256;
  const MAX_ROW_COUNT = 4;
  const winWidth = innerWidth;
  const winHeight = innerHeight;
  if (winWidth < 1 || winHeight < 1) return false;

  const stepX = Math.floor(winWidth / Math.min(MAX_ROW_COUNT, Math.ceil(winWidth / CELL_SIZE)));
  const stepY = Math.floor(winHeight / Math.min(MAX_ROW_COUNT, Math.ceil(winHeight / CELL_SIZE)));
  const processed = new Set<Element>();

  for (let y = Math.floor(stepY / 2); y < winHeight; y += stepY) {
    for (let x = Math.floor(stepX / 2); x < winWidth; x += stepX) {
      const element = document.elementFromPoint(x, y);
      if (!element || processed.has(element) || element.tagName.toLowerCase() === "img") {
        continue;
      }
      processed.add(element);

      const style = element === document.documentElement ? rootStyle : getComputedStyle(element);
      const background = parseColor(style.backgroundColor);
      if (!background) return false;
      if (background.a === 1) {
        if (lightness(background) > 0.6) return false;
      } else {
        const text = parseColor(style.color);
        if (!text) return false;
        if (lightness(text) < 0.4) return false;
      }
    }
  }

  const rootBackground = parseColor(rootStyle.backgroundColor);
  if (!rootBackground) return false;
  const bodyStyle = document.body ? getComputedStyle(document.body) : null;
  const bodyBackground = bodyStyle
    ? parseColor(bodyStyle.backgroundColor)
    : ({ r: 0, g: 0, b: 0, a: 0 } satisfies RGBA);
  if (!bodyBackground) return false;

  if (rootBackground.a === 0 && bodyBackground.a === 0) {
    const rootText = parseColor(rootStyle.color);
    if (rootText) return lightness(rootText) > 0.5;
  }

  const rootLightness =
    (1 - rootBackground.a) + rootBackground.a * lightness(rootBackground);
  const finalLightness =
    (1 - bodyBackground.a) * rootLightness +
    bodyBackground.a * lightness(bodyBackground);
  return finalLightness < 0.5;
}

function hasSomeStyle(): boolean {
  if (document.querySelector('meta[name="color-scheme"]')) return true;
  if (
    document.documentElement.style.backgroundColor ||
    document.body?.style.backgroundColor
  ) {
    return true;
  }
  for (const sheet of Array.from(document.styleSheets)) {
    const owner = sheet.ownerNode as HTMLElement | null;
    if (owner && !owner.classList?.contains("darkreader")) return true;
  }
  return false;
}

function canCheckForStyle(): boolean {
  const body = document.body;
  if (
    !body ||
    body.scrollHeight < 32 ||
    body.clientHeight < 32 ||
    body.childElementCount === 0 ||
    !hasSomeStyle()
  ) {
    return false;
  }
  for (const child of Array.from(body.children)) {
    if (child.tagName !== "SCRIPT" && child.tagName !== "STYLE" && child.tagName !== "LINK") {
      return true;
    }
  }
  return false;
}

function runCheck(): boolean {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]');
  if (meta) {
    const content = meta.content.toLowerCase();
    const strictlyDark = content === "dark" || content === "only dark";
    const strictlyLight = content === "light" || content === "only light";
    if (strictlyDark || strictlyLight) return strictlyDark;
  }

  if (hasDarkMarker()) return true;
  return hasBuiltInDarkTheme();
}

function waitForStyles(): Promise<void> {
  if (canCheckForStyle()) return Promise.resolve();

  return new Promise((resolve) => {
    let finished = false;
    let observer: MutationObserver | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let onLoad: (() => void) | null = null;

    const cleanup = () => {
      observer?.disconnect();
      if (timer !== undefined) clearTimeout(timer);
      if (onLoad) window.removeEventListener("load", onLoad);
    };
    const finish = () => {
      if (finished) return;
      finished = true;
      cleanup();
      resolve();
    };

    observer = new MutationObserver(() => {
      if (canCheckForStyle()) finish();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });

    if (document.readyState !== "complete") {
      onLoad = () => {
        if (canCheckForStyle()) finish();
      };
      window.addEventListener("load", onLoad, { once: true });
    }

    // Do not leave a blank/SPA page undecorated forever.
    timer = setTimeout(finish, 2000);
    requestAnimationFrame(() => {
      if (canCheckForStyle()) finish();
    });
  });
}

// ---- enable / disable ----

function enableTheme() {
  if (applied) return;
  DarkReader.enable({
    mode: 1,
    brightness: 100,
    contrast: 100,
    grayscale: 0,
    sepia: 0,
    styleSystemControls: true,
  });
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

  if (!enabled || !media.matches) {
    disableTheme();
    return;
  }
  if (applied) return;

  await waitForStyles();
  // A little more time for client-rendered pages to paint their first screen.
  await new Promise((resolve) => setTimeout(resolve, 100));

  if (current !== generation || !enabled || !media.matches || applied) return;

  if (runCheck()) {
    // The site already has a dark theme. Leave it alone.
    disableTheme();
    return;
  }
  enableTheme();
}

chrome.storage.sync
  .get({ darkMode: DEFAULT_ENABLED })
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
