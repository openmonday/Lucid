# Firefox / Zen Build

The Firefox build uses the same TypeScript source as Chrome, with a different manifest.

## Build

```bash
npm run build:firefox
```

Outputs to `dist-firefox/` with:
- `manifest.json` — Firefox manifest with `browser_specific_settings.gecko.id` and `background.scripts` instead of `service_worker`
- All other files are identical to the Chrome build

## Installation

### Temporary (for testing)

1. Run `npm run build:firefox`
2. Open `about:debugging#/runtime/this-firefox` (Firefox) or `about:debugging` (Zen)
3. Click **Load Temporary Add-on**
4. Choose `dist-firefox/manifest.json`
5. The extension disappears when you close the browser

### Permanent (requires signing)

Firefox requires extensions to be signed by Mozilla for permanent installation.

**Option 1: Developer Edition with signing disabled**
- Install [Firefox Developer Edition](https://www.mozilla.org/firefox/developer/) or Nightly
- Set `xpinstall.signatures.required` to `false` in `about:config`
- Install from `about:addons` → ⚙️ → **Install Add-on From File** → choose `dist-firefox/manifest.json`

**Option 2: Self-distribution (unlisted)**
- Create an account on [addons.mozilla.org](https://addons.mozilla.org)
- Go to [Developer Hub](https://addons.mozilla.org/developers/) → Submit a New Add-on
- Choose "On your own"
- Zip `dist-firefox/` and upload it
- Download the signed `.xpi` after automated review (usually minutes)
- Install from `about:addons` → **Install Add-on From File**

**Option 3: Public listing**
- Submit to AMO for public review
- Manual review takes days to weeks
- Users can install directly from the store once approved

## Usage

- Press **Alt+A** to toggle bilingual translation on any page
- Change target language in the extension's options (gear icon on `about:addons`)
- Works on `file://` URLs without the permission toggle that Chrome requires
- Local `.md` files open in the viewer automatically

## Differences from Chrome

- **`file://` access:** works by default (no toggle)
- **Markdown redirect:** clicking a local `.md` opens the extension's viewer page, and the viewer shows a file picker because Firefox blocks extension pages from fetching `file://` URLs
- **Host permissions:** declared for `bing.com`, but Firefox prompts the user on first translation request
- **Background:** persistent event page, not a service worker
- **Manifest:** V3 with `browser_specific_settings.gecko`

## Manual Testing

I haven't tested the Firefox build fully. Here's a checklist:

1. **Build and load:**
   ```bash
   npm run build:firefox
   ```
   Open `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** → select `dist-firefox/manifest.json`

2. **Web page translation:**
   - Open any web page
   - Press **Alt+A**
   - Translation lines should appear below each paragraph in clay/orange color
   - Press **Alt+A** again to remove them

3. **Options:**
   - Click the gear icon next to the extension on `about:addons`
   - Change target language and save
   - Translations should use the new language after toggling again

4. **Local HTML:**
   - Open a local `.html` file
   - Press **Alt+A**
   - Should translate (no permission required in Firefox)

5. **Markdown viewer:**
   - Open a local `.md` file
   - Should open the extension's viewer page
   - Drag the `.md` file onto the viewer or use the file picker
   - The viewer should render the Markdown
   - Press **Alt+A** to translate the rendered page

6. **Dark mode:**
   - Set Firefox to dark mode in preferences
   - Reload a translated page or the viewer
   - Colors should adapt (dark surface, lighter text, different clay tone)
