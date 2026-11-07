# Installing on Firefox / Zen Browser

## Quick Install (Temporary)

This method is fastest but the extension disappears when you close the browser.

1. Build the Firefox version:
   ```bash
   npm run build:firefox
   ```

2. Open Firefox or Zen and navigate to:
   - **Firefox:** `about:debugging#/runtime/this-firefox`
   - **Zen:** `about:debugging`

3. Click **Load Temporary Add-on**

4. Select `dist-firefox/manifest.json`

5. Enable local-file access. Open `about:addons` → **Lucid** → **Permissions** and turn on **Access local files on your computer**. Firefox 153+ (including Zen) will not run any content script on a `file://` page until this is enabled, so local Markdown files stay as raw text and their images never load. The change applies to newly opened tabs; close and reopen any Markdown tab.

6. The extension is now active. Press **Alt+A** on any page to toggle translation.

## Updating an installed copy

Firefox copies an installed `.xpi` into the browser profile. Editing `dist-firefox/` or rebuilding `lucid.xpi` later does **not** update that installed copy.

- If you are using a temporary add-on, run `npm run build:firefox`, then click **Reload** next to Lucid in `about:debugging`. The Lucid entry shows the installed version (`0.1.3` or newer); if it shows an older version you are still running a stale build.
- If you installed from `lucid.xpi`, run `npm run package:firefox`, bump the version in `static/manifest.json`, then install the new `lucid.xpi` from `about:addons` → ⚙️ → **Install Add-on From File**. If Firefox refuses the reinstall, remove the old Lucid entry first.
- After reinstalling, check **Access local files on your computer** again under `about:addons` → Lucid → **Permissions**; removing an add-on can drop the grant.
- Close and reopen any Markdown tabs after updating; an already-open page keeps the old content script in memory.

`npm run build` only refreshes the Chrome `dist/` folder. It does not build or package the Firefox version.

## Permanent Install

Firefox requires all permanently installed extensions to be signed by Mozilla. You have three options:

### Option 1: Developer Edition (Easiest for Personal Use)

1. Install [Firefox Developer Edition](https://www.mozilla.org/firefox/developer/) or Firefox Nightly

2. Open `about:config` and set `xpinstall.signatures.required` to `false`

3. Build and package:
   ```bash
   npm run package:firefox
   ```

4. In Firefox, go to `about:addons` → ⚙️ (gear icon) → **Install Add-on From File**

5. Select `lucid.xpi`

**Note:** Stable Firefox and Zen may still refuse unsigned add-ons even with the pref changed. If this happens, use temporary loading or Option 2.

### Option 2: Self-Distribution (Unlisted on AMO)

This gives you a signed `.xpi` file you can install on any Firefox/Zen, including stable versions.

1. Create an account on [addons.mozilla.org](https://addons.mozilla.org)

2. Go to [Developer Hub](https://addons.mozilla.org/developers/) → **Submit a New Add-on**

3. Choose **"On your own"** (unlisted)

4. Build and package:
   ```bash
   npm run package:firefox
   ```

5. Upload `lucid.xpi`

6. Automated validation usually completes in minutes

7. Download the signed `.xpi` from AMO

8. Install from `about:addons` → ⚙️ → **Install Add-on From File**

**Important:** Before submitting, change the extension ID in `build-manifest.mjs`:
```json
"browser_specific_settings": {
  "gecko": {
    "id": "your-name@yourdomain.com"
  }
}
```

### Option 3: Public Listing

Submit to AMO for public distribution. Manual review takes days to weeks. Users can install directly from the add-ons store once approved.

## Usage

- Press **Alt+A** to toggle bilingual translation on any page
- Change target language: click the gear icon on `about:addons` next to the extension
- Firefox 153+ requires its own **Access local files on your computer** opt-in under `about:addons` → Lucid → **Permissions** (Chrome uses **Allow access to file URLs** instead). Without it, the content script never runs on `file://` pages.
- Local `.md` files are rendered in place by the page's content script, so relative images and links resolve against the file's URL.
- To view a Markdown file without local-file access, drop it onto the viewer page (Options → Open the local file viewer) instead; the file picker and drag-and-drop always work.

## Zen Browser Notes

Zen is based on Firefox, so the same installation methods and the **Access local files on your computer** permission apply. Use `about:debugging` for temporary loading. A temporary add-on disappears when Zen restarts; load it again and re-check the permission.

## Differences from Chrome

- **File access:** content scripts run on `file://` URLs without Chrome's toggle. On Firefox 153+ enable **Access local files on your computer** in `about:addons` → Lucid → Permissions. The content script renders the Markdown in the page itself; it does not fetch the file URL.
- **Background script:** persistent event page instead of a service worker
- **Host permissions:** Firefox may prompt you to grant `bing.com` access on first translation
