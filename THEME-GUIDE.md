# Theme Guide

The extension includes two themes:

## Default Theme (Gray)
Clean, subtle gray borders with page-adaptive text color.

- **Translation lines:** Faint gray left border (18% opacity), text inherits page color at 82% opacity
- **Markdown viewer:** Neutral gray palette with high contrast
- **Auto dark mode:** Border switches to white in dark mode
- **Best for:** Reading translated content without visual distractions

## Claude Theme (Orange)
Warm paper tones inspired by Claude.ai's interface.

- **Translation lines:** Orange/clay left border (#c6613f light, #e08264 dark), matching text color
- **Markdown viewer:** Warm beige/cream backgrounds with orange accents
- **Auto dark mode:** Deep brown surface with lighter orange accents
- **Best for:** Users who prefer Claude's visual style

## Switching Themes

1. Open the options page (Chrome: `chrome://extensions` → Details → Extension options; Firefox: `about:addons` → the extension → Preferences)
2. Pick a theme in the **Theme** dropdown. It is saved immediately.
3. Open pages and the Markdown viewer pick up the change through a `storage.onChanged` listener, so no reload should be needed.

Both themes automatically adapt to your system's light/dark mode preference.

## Theme Settings File

Themes are stored in `chrome.storage.sync` under the key `theme` with values:
- `"default"` (default)
- `"claude"`

The setting syncs across devices with the same browser profile.
