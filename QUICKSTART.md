# Quick Start Guide

## Chrome / Edge

1. **Build:**
   ```bash
   npm install
   npm run build
   ```

2. **Install:**
   - Open `chrome://extensions`
   - Enable **Developer mode** (top right)
   - Click **Load unpacked**
   - Select the `dist` folder
   - Click **Details** on the extension → enable **Allow access to file URLs**

3. **Use:**
   - Open any web page or local HTML/Markdown file
   - Press **Alt+A** to toggle translation
   - Translation lines appear below each paragraph

4. **Theme & Options:**
   - Click the extension icon to switch themes instantly
   - Click **⚙️ Language Settings** in the popup to change target language
   - All changes apply immediately, no page reload needed

## Firefox / Zen

### Temporary (Fastest - for testing)

1. **Build:**
   ```bash
   npm install
   npm run build:firefox
   ```

2. **Load:**
   - Open `about:debugging#/runtime/this-firefox` (Firefox) or `about:debugging` (Zen)
   - Click **Load Temporary Add-on**
   - Select `dist-firefox/manifest.json`

3. **Use:**
   - Press **Alt+A** on any page
   - Extension disappears when you quit the browser

### Permanent (Requires signing or Developer Edition)

See [INSTALL-FIREFOX.md](INSTALL-FIREFOX.md) for:
- Developer Edition with unsigned add-ons
- Self-distribution via AMO (unlisted)
- Public listing

## Tips

- **Keyboard shortcut:** Change it at `chrome://extensions/shortcuts` (Chrome) or `about:addons` → ⚙️ → Manage Extension Shortcuts (Firefox)
- **Local Markdown:** `.md` files automatically open in the viewer with drag-and-drop support
- **Dark mode:** Switches automatically with your system theme
- **Translation cache:** Stored locally for faster repeated translations
- **Selective translation:** Only visible content is translated (lazy loading)
- **Main-content mode:** Skips navigation, menus, forms, and buttons by default; switch to **All** in the popup to translate the whole page

## Troubleshooting

**Chrome: Extension doesn't work on file:// URLs**
- Go to `chrome://extensions` → extension **Details**
- Enable **Allow access to file URLs**
- Reload the page

**Firefox: Can't install permanently**
- Stable Firefox/Zen requires signed extensions
- Use temporary loading, or see INSTALL-FIREFOX.md for signing options

**Translations don't appear**
- Check browser console for errors
- Verify network access to `bing.com`
- Try toggling Alt+A again

**Markdown files download instead of opening in viewer**
- The redirect works on file:// URLs
- Chrome: make sure "Allow access to file URLs" is on, then reload the file.
- Firefox/Zen: untested. Open the extension's `viewer.html` and use its file picker.
