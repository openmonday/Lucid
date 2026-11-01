# Bilingual Translate

A browser extension for bilingual page translation using Microsoft Translator. Works on web pages, local HTML files, and local Markdown files.

## Features

- **Alt+A** toggles bilingual translation on the current page
- Translates as you scroll — only visible blocks are sent to the translation engine
- Works on local `.html` and `.md` files with the "Allow access to file URLs" permission
- Markdown viewer with drag-and-drop support
- Clean, responsive design with light and dark mode
- Translation cache stored locally
- Target language configurable on the options page

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
  dom-translator.ts    DOM walker and bilingual insertion
  viewer.ts            Markdown viewer page
  options.ts           Options page
  shared.ts            Shared types and utilities
static/
  manifest.json
  rules.json           declarativeNetRequest rules for Origin/Referer
  viewer.html
  viewer.css
  options.html
  icons/
```

## Translation Engine

The translator is adapted from `agent/plugins/pi-bridge/src/core/translator.ts`. It uses the same Microsoft neural translation endpoint as the public Bing Translator page. Session tokens are obtained by loading `https://www.bing.com/translator` once, and subsequent translation requests carry the browser's cookies with `credentials: "include"`. `declarativeNetRequest` rewrites `Origin` and `Referer` headers to match the Bing origin.

Results are cached in `chrome.storage.local`, keyed by target language and source text.

## Design

Visual style references the Claude Design System tokens (`agent/assist/refs/open-claude-ui/code-examples/cds-theme.css`):
- Deep slate surfaces with crisp borders
- Warm clay accent (#c6613f light, #e08264 dark)
- System font stack with CJK fallbacks
- Smooth transitions and subtle animations

## License

See LICENSE file.
