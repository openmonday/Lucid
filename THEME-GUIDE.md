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

1. Click the extension icon or go to the options page
2. Select theme from the dropdown
3. **Translation lines:** Reload the page to apply
4. **Markdown viewer:** Changes immediately

Both themes automatically adapt to your system's light/dark mode preference.

## Theme Settings File

Themes are stored in `chrome.storage.sync` under the key `theme` with values:
- `"default"` (default)
- `"claude"`

The setting syncs across devices with the same browser profile.
