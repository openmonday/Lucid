# Lucid

A browser extension that makes web pages easier to read: bilingual translation, automatic dark mode, and a Markdown viewer. Works on web pages, local HTML files, and local Markdown files.

## Features

- **Alt+A** toggles bilingual translation on the current page (Microsoft Translator by default; an OpenAI-compatible LLM such as `gpt-6.1-terra` can be selected in the options page for coding-heavy pages, with automatic fallback)
- Terms like *functional core, imperative shell* translate as terminology (函数式核心，命令式外壳) when the LLM engine is on
- Translates as you scroll — only visible blocks are sent to the translation engine
- Main-content mode (the default) translates article text while skipping navigation, menus, forms, and buttons; switch to whole-page translation in the popup or options
- Automatic dark mode that darkens any web page, following your system preference
- Pages with their own dark theme (and pages already themed by another dark-mode extension) are left untouched
- Dark mode can be toggled from the popup
- Markdown viewer with drag-and-drop support
- YAML frontmatter rendered as an Obsidian-style, collapsible properties card
- Syntax-highlighted code blocks with a language label and one-click copy
- LaTeX math rendered with KaTeX: `$...$`, `$$...$$`, `\(...\)`, `\[...\]`, and fenced `math` blocks
- Translation keeps LaTeX formulas intact and re-renders them in translation lines
- Works on local `.html` and `.md` files (Chrome needs the "Allow access to file URLs" toggle; Firefox 153+ uses **Access local files on your computer** in `about:addons` → Permissions)
- Local Markdown files keep their `file://` URL while rendering in place. The page's content script renders them directly, so relative images and links resolve against the file's own URL; this also works in Firefox/Zen, which never let extension pages load `file://` images
- Clean, responsive popup with automatic light and dark mode
- Plain/Claude themes for translation text and the Markdown viewer
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

### Firefox / Zen

Requires Firefox 142 or newer (`strict_min_version` is set by the manifest keys Lucid
uses: `background.type`, `declarativeNetRequest.rule_resources`, and
`data_collection_permissions`).

1. Run `npm install && npm run build:firefox`
2. Open `about:debugging#/runtime/this-firefox` (`about:debugging` in Zen)
3. Click **Load Temporary Add-on** and select `dist-firefox/manifest.json`
4. Open `about:addons` → **Lucid** → **Permissions** and enable **Access local files on your computer**. Firefox 153+ and Zen do not run content scripts on `file://` pages without this, so local Markdown files stay as raw text and their images do not load. Close and reopen any Markdown tab afterward.

For permanent installation and AMO signing, see [INSTALL-FIREFOX.md](INSTALL-FIREFOX.md). `npm run package:firefox` builds, verifies, and packages `lucid.xpi`.

## Themes

Translation lines and the Markdown viewer each support two themes, set independently in the popup or on the options page:

- **Plain** (default): a subtle gray rule with page-adaptive text; the viewer uses a neutral gray palette.
- **Claude**: warm clay tones inspired by Claude.ai, including matching viewer colors.

Both themes follow the system light/dark preference. Settings live in `chrome.storage.sync` under `translationTheme` and `viewerTheme` (`"default"` or `"claude"`), and open pages pick up changes immediately.

## Structure

```
src/
  translate/           Pluggable engines: provider interface, registry, settings
    index.ts           Registry, fallback orchestration, cache signature
    types.ts           TranslationProvider interface and engine settings
    settings.ts        Engine settings (sync) and API key (local)
    microsoft.ts       Microsoft Translator via the public Bing page
    llm.ts             OpenAI-compatible LLM backend (prompt, batching, parsing)
    glossary.ts        Curated coding terminology used in LLM prompts
  background.ts        Service worker: translation + cache + toggle command
  content.ts           Content script entry point
  dom-translator.ts    DOM walker, content scope, and bilingual insertion
  math.ts              LaTeX detection and KaTeX rendering for translations
  dark-mode.ts         Dark Reader dynamic theme + native dark-page detection
  native-messaging.ts  Keeps native runtime messaging working alongside Dark Reader
  viewer.ts            Standalone Markdown viewer page UI
  render.ts            Markdown-It + KaTeX rendering shared by the viewer and local files
  viewer-theme.ts      Viewer palette and theme storage sync
  metadata.ts          YAML frontmatter parsing and properties card
  options.ts           Options page (language, scope, themes, translation engine)
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
build-extension.mjs    Shared esbuild + static-asset build for both browsers
build-icons.mjs        Rasterizes assets/icon.svg into static/icons
build-manifest.mjs     Derives the Firefox manifest from static/manifest.json
build.mjs              Chrome/Edge build into dist/
build-firefox.mjs      Firefox/Zen build into dist-firefox/
package-firefox.mjs    Builds and packages the Firefox XPI as lucid.xpi
test/
  math.test.mjs        LaTeX delimiter parsing
  metadata.test.mjs    Frontmatter parsing
```

## Development

- `npm run build` — build Chrome/Edge into `dist/`
- `npm run build:firefox` — build Firefox/Zen into `dist-firefox/`
- `npm run package:firefox` — build and package `lucid.xpi`
- `npm run typecheck` — TypeScript check
- `npm test` — unit tests for the pure parsers in `src/math.ts`, `src/metadata.ts`, and `src/translate/`

Tests run the TypeScript sources directly through Node's built-in test runner and type stripping (Node 22.18 or newer), so there is no test framework dependency.

## Translation Engines

Translation is provider-based. `src/translate/index.ts` holds the registry; everything
above it (background worker, DOM walker, options page) talks to the
`TranslationProvider` interface in `src/translate/types.ts` and never branches on an
engine id.

```
src/translate/
  types.ts       TranslationProvider interface, EngineSettings, ConfigError
  index.ts       registry, fallback orchestration, signature for caching
  settings.ts    load/save engine settings (sync) and API key (local)
  microsoft.ts   Microsoft Translator via the public Bing page (default, free)
  llm.ts         OpenAI-compatible LLM backend (Responses or chat completions)
  glossary.ts    curated English software-engineering terminology for prompts
```

### Microsoft Translator

`src/translate/microsoft.ts` uses the same neural endpoint as the public Bing page.
Session tokens are obtained by loading `https://www.bing.com/translator` once, and
subsequent requests carry the browser's cookies with `credentials: "include"`.
`declarativeNetRequest` rewrites `Origin` and `Referer` to the Bing origin.

### Custom LLM

`src/translate/llm.ts` sends a batch of blocks as one JSON request and asks for
`{"translations": [...]}` back. Design points:

- **Batching** — up to 12 blocks or 4000 characters per request, two requests in
  flight. A per-block system prompt would dominate a short article.
- **Placeholder integrity** — `[ZT_KEEP_<n>]` tokens (inline code and LaTeX) must
  survive; a batch that drops or invents one is retried segment by segment and
  then fails over. Harness code and formulas are never translated.
- **Coding terminology** — the system prompt lists curated terms from
  `glossary.ts` (`functional core` → 函数式核心 and friends), so short headings
  are read as terminology instead of dictionary glosses.
- **Two protocols** — `responses` (default, `/responses`) or `chat`
  (`/chat/completions`), so any OpenAI-compatible gateway works.

Defaults are base URL `https://api.apikey.fan/v1` and model `gpt-6.1-terra`. The API
key is entered in the options page and stored in `chrome.storage.local` — never in
`sync`, which uploads to the browser profile's sync account.

If the LLM call fails and **fall back to Microsoft Translator** is enabled (default),
that batch is translated by Microsoft instead, so a dead endpoint or an exhausted
quota degrades rather than breaks. Fallback results are cached under the engine that
produced them, so fixing the configuration retries the LLM instead of replaying
Microsoft output.

### Cache

Results live in `chrome.storage.local` under `cache-v2`, keyed by
`engine signature + target language + source text`. The signature includes the
engine, model, protocol, and `PROMPT_VERSION`, so switching models or editing the
prompt cannot serve stale wording. The pre-v2 (`cache-v1`) entries are dropped on
first load.

### Adding an engine

1. Write `src/translate/<name>.ts` exporting a `TranslationProvider`
   (`id`, `label`, `signature`, `translate`).
2. Add the id to `EngineId` and `ENGINES` in `src/shared.ts`; the options page
   renders that list.
3. Register the provider in `PROVIDERS` (`src/translate/index.ts`).
4. Add prompt/parser unit tests under `test/` if it has a wire format.

For providers that need their own host (beyond the existing `https://*/*` host
permission) add it to `host_permissions` in `static/manifest.json`; Firefox derives
its own copy at build time.

### Known limits

- MV3 service workers are terminated when idle. A pending `sendMessage` keeps the
  worker alive, so a very long page (many batches of 12) can outlive the message
  channel; the affected blocks then show a translation error and are retried on the
  next scroll.
- LLM translation sends page text to the configured endpoint. Nothing leaves the
  machine unless an LLM engine is selected.

## Design

Page dark mode is powered by [Dark Reader](https://github.com/darkreader/darkreader)'s dynamic theme engine (MIT, see `static/THIRD-PARTY-NOTICES.txt`). Lucid detects pages that already have a dark theme before applying anything, so native dark sites are not double-themed.

Dark Reader normally hands its stylesheet proxy to the page as an inline `<script>`. Chrome's content-script isolated world has its own CSP without `'unsafe-inline'`, so that injection is always blocked there (and Chrome 142+ reports it as an extension error in `chrome://extensions`) while Dark Reader silently polls instead. Lucid drops the doomed insertion on Chromium, which leaves the theme output identical; Firefox applies the page's CSP to such scripts and keeps the proxy.

The UI takes its cues from the Claude Design System; every token is defined in `static/viewer.css`:
- Deep slate surfaces with crisp borders
- Warm clay accent (#c6613f light, #e08264 dark)
- System font stack with CJK fallbacks
- Smooth transitions and subtle animations

## Troubleshooting

- **`file://` pages are not translated or viewed in Chrome** — open `chrome://extensions`, click **Details** for Lucid, enable **Allow access to file URLs**, then reload the page.
- **Firefox/Zen shows raw Markdown, or rendered Markdown without its images** — open `about:addons` → Lucid → **Permissions**, enable **Access local files on your computer**, then close and reopen the Markdown tab. Also check that `about:debugging` shows the current version (`0.2.0` or newer); reload the temporary add-on after rebuilding.
- **Firefox refuses a permanent install** — stable Firefox and Zen require a signed XPI. Use temporary loading, or follow [INSTALL-FIREFOX.md](INSTALL-FIREFOX.md).
- **Translation lines do not appear** — check the browser console, confirm network access to `bing.com`, then press Alt+A again.
- **A Markdown file downloads instead of opening** — grant the extension local-file access, or open the viewer from the options page and choose the file.

## License

See LICENSE file.
