<img src="./assets/icon.png" width="96">

# Stream Keys

A Chrome extension that improves keyboard controls on streaming services by fixing spacebar behavior, adding reliable keyboard shortcuts, and providing quick subtitle toggling.

![hero_banner](./assets/hero_banner.png)

## Supported Services

- **Disney+**
  - Fixes broken `Space` play/pause behavior, adds `C` for subtitles and `F` for fullscreen.
  - Removes the distracting blue focus outline and enables Left/Right arrow shortcuts for quick rewind/fast-forward.

- **HBO Max**
  - Fixes unreliable `Space` behavior and adds `C` for subtitles and `F` for fullscreen.
  - The HBO Max player already supports Left/Right arrow keys for skipping.

## Features

> The Extension mimics basic keyboard shortcuts known from YouTube.

- **Spacebar Play/Pause** - Press `Space` to toggle play/pause anywhere on the page, regardless of which element has focus
- **Fullscreen Toggle** - Press `F` to toggle fullscreen mode
- **Subtitle Toggle** - Press `C` to quickly enable/disable subtitles based on your language preferences
- **No Focus Outline** - Removes the distracting blue focus outline from the video player (Disney+)
- **Works in Fullscreen** - Keyboard shortcuts work reliably in both normal and fullscreen modes

## Subtitle Language Preferences

The extension includes a settings page where you can configure your preferred subtitle languages:

1. Right-click the extension icon and select "Options"
2. Add languages in order of preference (first = highest priority)
3. Language names must match exactly what's shown in the streaming service's subtitle menu
4. Matching is case insensitive

When you press `C`:
- If subtitles are on → turns them off, shows "Captions: Off"
- If subtitles are off → enables the first matching language from your preferences
- If no matching language is found → shows "Captions: Language not found, check extension settings"

Default preferences: English, English [CC], English CC

## The Problem This Solves

Default keyboard behavior on streaming services is often inconsistent:
- Pressing spacebar when a control button is focused activates that button instead of play/pause
- After exiting fullscreen, keyboard controls stop working until you click on the video
- The video player may show an ugly focus outline when focused
- No quick way to toggle subtitles without navigating through menus

This extension intercepts keyboard events at the highest level and redirects them to the correct player controls.

## Installation

### From Releases

1. Go to [releases page](https://github.com/ViktorStiskala/chrome-stream-keys/releases/latest) and download the ZIP file.
2. Extract ZIP to destination folder.
3. Open Chrome and navigate to `chrome://extensions/`
4. Enable "Developer mode" in the top right
5. Click "Load unpacked" and select the extension folder

### From Source

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension folder

### Building

```bash
make build    # Creates build/stream-keys.zip
make clean    # Removes build directory
```

## How It Works

### Architecture

The extension uses a base handler (`handlers/base.js`) with shared functionality, and service-specific handlers that provide configuration for each streaming service.

### Keyboard Event Capture

The extension uses `window.addEventListener('keydown', handler, true)` with the capture phase to intercept keyboard events before the streaming service's own handlers can process them.

### Service-Specific Handlers

- **Disney+**: Player controls are inside Shadow DOM elements, accessed via `element.shadowRoot.querySelector()`
- **HBO Max**: Uses standard DOM with `data-testid` attributes and class-based fallback selectors

### Settings Injection

Settings are stored in `chrome.storage.sync` and injected into page context as `window.__streamKeysSettings` before handlers are loaded.

### Fullscreen Focus Workaround

After exiting fullscreen, browsers require a real user click before routing keyboard events to the page (this is a security feature). The extension works around this by creating an invisible overlay that captures the first click, then removes itself - restoring keyboard functionality without affecting video playback.

## Permissions

- `webNavigation` - To detect when pages finish loading
- `scripting` - To inject the keyboard handler scripts
- `storage` - To save subtitle language preferences
- `host_permissions` - To run on supported streaming service domains

## License

[MIT](./LICENSE)
