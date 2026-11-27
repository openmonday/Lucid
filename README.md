# Lucid

A browser extension that makes web pages easier to read: bilingual translation, automatic dark mode, and a Markdown viewer. Works on web pages, local HTML files, and local Markdown files.

## Features

- **Bilingual translation** — press **Alt+A** to toggle translation lines on the current page. Translation runs as you scroll and only sends visible blocks.
- **Translation engines** — Microsoft Translator by default, or an OpenAI-compatible LLM (configured on the options page), with automatic fallback to Microsoft.
- **Dark mode** — darkens any page to follow your system preference. Pages that already have a dark theme are left alone.
- **Markdown viewer** — drag and drop `.md` files; supports YAML frontmatter, syntax-highlighted code, and LaTeX math (KaTeX).
- **Local files** — works on local `.html` and `.md` files, with extra browser setup (see below).
- **Themes** — Plain (default) or Claude, set separately for translations and the viewer.

## Installation

### Chrome / Edge

1. Run `npm install && npm run build`
2. Open `chrome://extensions` and enable **Developer mode**
3. Click **Load unpacked** and select the `dist` folder
4. For local files, click **Details** on Lucid and enable **Allow access to file URLs**

To change the keyboard shortcut, visit `chrome://extensions/shortcuts`.

### Firefox / Zen

Requires Firefox 142 or newer.

1. Run `npm install && npm run build:firefox`
2. Open `about:debugging#/runtime/this-firefox` (`about:debugging` in Zen)
3. Click **Load Temporary Add-on** and select `dist-firefox/manifest.json`
4. For local files, open `about:addons` → **Lucid** → **Permissions** and enable **Access local files on your computer**. Reopen any Markdown tab afterward.

For permanent installation and signing, see [INSTALL-FIREFOX.md](INSTALL-FIREFOX.md).

## Development

- `npm run build` — build Chrome/Edge into `dist/`
- `npm run build:firefox` — build Firefox/Zen into `dist-firefox/`
- `npm run package:firefox` — build and package `lucid.xpi`
- `npm run typecheck` — TypeScript check
- `npm test` — unit tests (requires Node 22.18 or newer)

### Project layout

```text
src/
  entrypoints/          Background, content scripts, popup, options, and viewer
  browser/              Shared message contracts and user preference defaults
  translation/page/     DOM block extraction and bilingual line rendering
  translation/engines/  Provider registry, engine settings, and persistent cache
  dark-mode/            Dark Reader integration and native theme detection
  markdown/             Rendering, frontmatter, and the viewer palette
scripts/                Browser builds, icon generation, and Firefox packaging
static/                 Base manifest, extension pages, styles, and icons
```

Both builds use `static/manifest.json`; the build derives Firefox's variant. Entrypoint source files can move without changing the bundle names referenced by the manifest or extension pages. To regenerate the checked-in icons from `assets/icon.svg`, run `npm run build:icons`.

## Translation Engines

- **Microsoft Translator** (default, free) uses the same endpoint as the public Bing translator page.
- **Custom LLM** uses any OpenAI-compatible API. Enter the base URL, model, and API key in the options page. The key is stored in `chrome.storage.local`, not in sync storage.

Translations are cached locally. Nothing is sent to an LLM endpoint unless you select an LLM engine.

## Troubleshooting

- **Local files are not translated or rendered (Chrome)** — enable **Allow access to file URLs** in `chrome://extensions` → Lucid → Details, then reload the page.
- **Markdown shows as raw text or without images (Firefox/Zen)** — enable **Access local files on your computer** in `about:addons` → Lucid → Permissions, then reopen the tab.
- **Firefox refuses a permanent install** — stable Firefox and Zen require a signed XPI. See [INSTALL-FIREFOX.md](INSTALL-FIREFOX.md).
- **Translation lines do not appear** — check the browser console, confirm access to `bing.com`, then press Alt+A again.

## License

See the LICENSE file.
