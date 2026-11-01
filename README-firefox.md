# Firefox / Zen Installation

The Firefox build shares the same TypeScript source with Chrome, with a different manifest.

## Build

```bash
npm run build:firefox
```

This creates `dist-firefox/` with:
- `background.js` — uses `browser.storage` API names for Firefox compatibility, but the code is the same as Chrome
- `manifest.json` — Firefox manifest with `browser_specific_settings.gecko` and `background.scripts` instead of `service_worker`
- All other files are identical to the Chrome build

## Temporary Install (for testing)

Firefox and Zen allow loading unsigned extensions temporarily. They disappear when you close the browser.

1. Run `npm run build:firefox`
2. Open `about:debugging#/runtime/this-firefox` (Firefox) or `about:debugging` (Zen)
3. Click **Load Temporary Add-on**
4. Choose `dist-firefox/manifest.json`
5. Press **Alt+A** on any page to toggle bilingual translation

The extension works on `file://` URLs without the "Allow file access" toggle that Chrome requires.

## Permanent Install

Firefox requires extensions to be signed by Mozilla. You have three options:

### 1. Developer Edition or Nightly with signing disabled
- Install [Firefox Developer Edition](https://www.mozilla.org/firefox/developer/) or Nightly
- Set `xpinstall.signatures.required` to `false` in `about:config`
- Install from `about:addons` → gear icon → **Install Add-on From File** → choose any file in `dist-firefox/`

### 2. Self-distribution (unlisted)
- Create an account on [addons.mozilla.org](https://addons.mozilla.org)
- Go to [Developer Hub](https://addons.mozilla.org/developers/) → Submit a New Add-on
- Choose "On your own" (self-distribution)
- Upload a `.zip` of `dist-firefox/`
- Download the signed `.xpi` file after review
- Install it from `about:addons` → **Install Add-on From File**

### 3. Public listing
- Submit the extension to AMO for public review
- Once approved, users can install it directly from the store

## Differences from Chrome

- **Background script:** runs as a persistent event page (`background.scripts`), not a service worker
- **`file://` access:** works by default (no permission toggle)
- **Markdown redirect:** clicking a local `.md` file opens it in the viewer
- **Viewer fetch:** Firefox blocks `fetch()` on `file://` URLs from extension pages, so the viewer shows a file picker if the redirect brings a `file://` URL
- **Host permissions:** `bing.com` is declared in `host_permissions`, but Firefox treats it as optional by default. The first translation request will prompt the user to allow access.

## Testing Checklist

- [ ] Alt+A toggles translation on web pages
- [ ] Translation appears below original text with the clay accent border
- [ ] Toggling off removes translations
- [ ] Options page saves target language
- [ ] Local `.md` files open in the viewer
- [ ] Drag-and-drop a `.md` file onto the viewer
- [ ] File picker works in the viewer
- [ ] Local `.html` files translate when Alt+A is pressed
- [ ] Dark mode applies correctly
