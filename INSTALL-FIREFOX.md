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

5. The extension is now active. Press **Alt+A** on any page to toggle translation.

## Permanent Install

Firefox requires all permanently installed extensions to be signed by Mozilla. You have three options:

### Option 1: Developer Edition (Easiest for Personal Use)

1. Install [Firefox Developer Edition](https://www.mozilla.org/firefox/developer/) or Firefox Nightly

2. Open `about:config` and set `xpinstall.signatures.required` to `false`

3. Build and package:
   ```bash
   npm run build:firefox
   cd dist-firefox
   zip -r ../lucid.xpi .
   cd ..
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
   npm run build:firefox
   cd dist-firefox
   zip -r ../lucid.xpi .
   cd ..
   ```

5. Upload `lucid.xpi`

6. Automated validation usually completes in minutes

7. Download the signed `.xpi` from AMO

8. Install from `about:addons` → ⚙️ → **Install Add-on From File**

**Important:** Before submitting, change the extension ID in `static/manifest-firefox.json`:
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
- Works on `file://` URLs without requiring special permissions (unlike Chrome)
- Local `.md` files should redirect to the extension's viewer (untested in Firefox). If not, open `viewer.html` and use its file picker.

## Zen Browser Notes

Zen is based on Firefox, so the same installation methods work. Use `about:debugging` for temporary loading.

## Differences from Chrome

- **File access:** works by default, no permission toggle needed
- **Background script:** persistent event page instead of a service worker
- **Host permissions:** Firefox may prompt you to grant `bing.com` access on first translation
