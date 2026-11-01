# Bilingual Translate Extension - Summary

## What It Does
Chrome and Firefox extension for bilingual page translation using Microsoft Translator. Press **Alt+A** on any page to toggle translation lines below each paragraph.

## Status
- ✅ Chrome/Edge build fully working
- ⚠️ Firefox/Zen build compiles but untested (see INSTALL-FIREFOX.md)

## Key Features
- Bilingual translation (source text + translation, not replacement)
- Works on web pages, local HTML, and local Markdown files
- Markdown viewer with drag-and-drop
- Lazy loading (translates only visible content)
- Translation cache in local storage
- Configurable target language (default: zh-Hans)
- Two themes: Default (gray, subtle) and Claude (orange/clay, warm paper tones)
- Auto dark mode support for both themes
- Clean blue/white/gray icon (bilingual card concept)

## Visual Design
- **Icon:** Blue background with white card (CJK glyph) and gray card (A)
- **Translation text:** Inherits page text color at 82% opacity with blue left border
- **Dark mode:** Automatic via `prefers-color-scheme`
- **Loading state:** Shimmer animation
- **Error state:** Red border and text

## Chrome Installation
```bash
npm install && npm run build
```
Load `dist/` as unpacked extension, enable "Allow access to file URLs".

## Firefox/Zen Installation
See INSTALL-FIREFOX.md for:
- Temporary loading (quick, disappears on quit)
- Permanent install options (requires signing or Developer Edition)

## Known Gaps
1. Firefox build has not been tested in Firefox or Zen
2. `.md` redirect and the viewer loading `file://` files are untested in Firefox
3. Icon is only verified at 128px; 16px toolbar size unchecked
4. Host permission prompt behavior in Firefox unverified
5. Git committer identity auto-configured (set `user.name` and `user.email` if needed)

## File Structure
```
src/
  background.ts       Service worker (Chrome) / event page (Firefox)
  bing.ts             Microsoft Translator API via Bing page
  content.ts          Content script entry
  dom-translator.ts   DOM scanning + bilingual insertion
  viewer.ts           Markdown viewer
  options.ts          Options page
  shared.ts           Common types
static/
  manifest.json              Chrome manifest
  manifest-firefox.json      Firefox manifest
  rules.json                 DNR rules for Origin/Referer
  viewer.html, viewer.css    Markdown viewer UI
  options.html               Options UI
  icons/                     16, 32, 48, 128 PNG
assets/
  icon.svg            Source icon (blue theme)
build.mjs             Chrome build (esbuild + copy static/)
build-firefox.mjs     Firefox build (same, renames manifest)
```

## Translation Engine
Adapted from `agent/plugins/pi-bridge/src/core/translator.ts`. Uses Microsoft neural translation endpoint via the public Bing Translator page. Session token from loading `https://www.bing.com/translator`, with `credentials: "include"` for cookies. `declarativeNetRequest` rewrites `Origin` and `Referer` headers.

## Design References
- Visual style: Claude Design System (`agent/assist/refs/open-claude-ui/code-examples/cds-theme.css`)
- Icon concept: Immersive Translate Firefox build (`reference/translator/immersive-translate/dist/firefox`)

## Git History
```
53f8d49 Change icon to blue/white/gray theme; update translation border to blue
3608ba1 Add INSTALL-FIREFOX.md with clear installation steps for Firefox and Zen
14cc40b Minimal flat icon; fix Firefox install steps
f8a3293 Update icon to show bilingual concept (CJK glyph and A cards); change translation text to inherit page color with auto dark mode
709bb99 Add manual testing checklist for Firefox
19138f2 Add Firefox/Zen build (shares source, different manifest)
602ebf2 Add Firefox/Zen build target
ad7cab7 Use Anthropic fonts and fix table text wrapping
a816d04 Initial commit
```
