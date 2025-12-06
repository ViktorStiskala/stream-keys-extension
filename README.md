# Disney+ UX Spacebar Fix

A Chrome extension that improves keyboard controls on Disney+ by fixing the spacebar behavior and adding reliable keyboard shortcuts.

## Features

- **Spacebar Play/Pause** - Press `Space` to toggle play/pause anywhere on the page, regardless of which element has focus
- **Fullscreen Toggle** - Press `F` to toggle fullscreen mode
- **No Focus Outline** - Removes the distracting blue focus outline from the video player
- **Works in Fullscreen** - Keyboard shortcuts work reliably in both normal and fullscreen modes

## The Problem This Solves

Disney+'s default spacebar behavior is inconsistent:
- Pressing spacebar when a control button is focused activates that button instead of play/pause
- After exiting fullscreen, keyboard controls stop working until you click on the video
- The video player shows an ugly blue outline when focused

This extension intercepts keyboard events at the highest level and redirects them to the correct player controls.

## Installation

### From Source

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension folder

## How It Works

### Keyboard Event Capture

The extension uses `window.addEventListener('keydown', handler, true)` with the capture phase to intercept keyboard events before Disney+'s own handlers can process them.

### Shadow DOM Access

Disney+ player controls are inside Shadow DOM elements. The extension accesses them via:
```javascript
document.body.querySelector(selector)?.shadowRoot?.querySelector("info-tooltip button")
```

### Fullscreen Focus Workaround

After exiting fullscreen, browsers require a real user click before routing keyboard events to the page (this is a security feature). The extension works around this by creating an invisible overlay that captures the first click, then removes itself - restoring keyboard functionality without affecting video playback.

## Permissions

- `webNavigation` - To detect when Disney+ pages finish loading
- `scripting` - To inject the keyboard handler script
- `host_permissions` for `*.disneyplus.com` - To run on Disney+ domains

## Version History

- **1.1.2** - Current version with fullscreen focus fix and F key support
- Earlier versions focused on spacebar play/pause fix

## License

MIT

