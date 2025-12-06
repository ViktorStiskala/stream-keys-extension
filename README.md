# Stream Keys

A Chrome extension that improves keyboard controls on streaming services by fixing spacebar behavior and adding reliable keyboard shortcuts.

## Supported Services

- **Disney+** - Shadow DOM player controls
- **HBO Max** - Standard DOM player controls

## Features

- **Spacebar Play/Pause** - Press `Space` to toggle play/pause anywhere on the page, regardless of which element has focus
- **Fullscreen Toggle** - Press `F` to toggle fullscreen mode
- **No Focus Outline** - Removes the distracting blue focus outline from the video player (Disney+)
- **Works in Fullscreen** - Keyboard shortcuts work reliably in both normal and fullscreen modes

## The Problem This Solves

Default keyboard behavior on streaming services is often inconsistent:
- Pressing spacebar when a control button is focused activates that button instead of play/pause
- After exiting fullscreen, keyboard controls stop working until you click on the video
- The video player may show an ugly focus outline when focused

This extension intercepts keyboard events at the highest level and redirects them to the correct player controls.

## Installation

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

### Keyboard Event Capture

The extension uses `window.addEventListener('keydown', handler, true)` with the capture phase to intercept keyboard events before the streaming service's own handlers can process them.

### Service-Specific Handlers

- **Disney+**: Player controls are inside Shadow DOM elements, accessed via `element.shadowRoot.querySelector()`
- **HBO Max**: Uses standard DOM with `data-testid` attributes and class-based fallback selectors

### Fullscreen Focus Workaround

After exiting fullscreen, browsers require a real user click before routing keyboard events to the page (this is a security feature). The extension works around this by creating an invisible overlay that captures the first click, then removes itself - restoring keyboard functionality without affecting video playback.

## Permissions

- `webNavigation` - To detect when pages finish loading
- `scripting` - To inject the keyboard handler scripts
- `host_permissions` - To run on supported streaming service domains

## License

MIT
