# Lucid

A browser extension that makes web pages easier to read: bilingual translation, automatic dark mode, and a Markdown viewer. Works on web pages, local HTML files, and local Markdown files.

## Features

- **Alt+A** toggles bilingual translation on the current page (powered by Microsoft Translator)
- Translates as you scroll — only visible blocks are sent to the translation engine
- Main-content mode (the default) translates article text while skipping navigation, menus, forms, and buttons; switch to whole-page translation in the popup or options
- Automatic dark mode that darkens any web page, following your system preference
- Pages with their own dark theme (and pages already themed by another dark-mode extension) are left untouched
- Dark mode can be toggled from the popup
- Markdown viewer with drag-and-drop support
- LaTeX math rendered with KaTeX: `$...$`, `$$...$$`, `\(...\)`, `\[...\]`, and fenced `math` blocks
- Translation keeps LaTeX formulas intact and re-renders them in translation lines
- Works on local `.html` and `.md` files with the "Allow access to file URLs" permission
- Clean, responsive popup with automatic light and dark mode
- Default/Claude themes for translation text and the Markdown viewer
- Translation cache stored locally
- Target language configurable from the popup or the options page

## Installation

### Chrome / Edge

1. Run `npm install && npm run build` in this directory
2. Open `chrome://extensions` and enable **Developer mode**
3. Click **Load unpacked** and select the `dist` folder
4. Click **Details** on the extension and turn on **Allow access to file URLs**
5. Press **Alt+A** on any page to toggle bilingual translation

To change the keyboard shortcut, visit `chrome://extensions/shortcuts`.

## Structure

```
src/
  bing.ts              Microsoft Translator via the public Bing page
  background.ts        Service worker: translation + cache + toggle command
  content.ts           Content script entry point
  dom-translator.ts    DOM walker, content scope, and bilingual insertion
  math.ts              LaTeX detection and KaTeX rendering for translations
  dark-mode.ts         Dark Reader dynamic theme + native dark-page detection
  native-messaging.ts  Keeps native runtime messaging working alongside Dark Reader
  viewer.ts            Markdown viewer page (Markdown-It + KaTeX)
  options.ts           Options page
  popup.ts             Toolbar popup (toggle, language, scope, themes)
  shared.ts            Shared types and utilities
static/
  manifest.json
  rules.json           declarativeNetRequest rules for Origin/Referer
  viewer.html
  viewer.css
  options.html
  popup.html
  icons/
build-assets.mjs       Copies the local KaTeX stylesheet and fonts into each build
```

## Translation Engine

The translator is adapted from `agent/plugins/pi-bridge/src/core/translator.ts`. It uses the same Microsoft neural translation endpoint as the public Bing Translator page. Session tokens are obtained by loading `https://www.bing.com/translator` once, and subsequent translation requests carry the browser's cookies with `credentials: "include"`. `declarativeNetRequest` rewrites `Origin` and `Referer` headers to match the Bing origin.

Results are cached in `chrome.storage.local`, keyed by target language and source text.

## Design

Page dark mode is powered by [Dark Reader](https://github.com/darkreader/darkreader)'s dynamic theme engine (MIT, see `static/THIRD-PARTY-NOTICES.txt`). Lucid detects pages that already have a dark theme before applying anything, so native dark sites are not double-themed.

Visual style references the Claude Design System tokens (`agent/assist/refs/open-claude-ui/code-examples/cds-theme.css`):
- Deep slate surfaces with crisp borders
- Warm clay accent (#c6613f light, #e08264 dark)
- System font stack with CJK fallbacks
- Smooth transitions and subtle animations

## License

See LICENSE file.
