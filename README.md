<img src="./assets/icon.png" width="96">

# Stream Keys

A browser extension that brings YouTube-style keyboard shortcuts to streaming services. Fixes broken spacebar behavior, adds quick subtitle toggling, and lets you jump back to previous positions.

![hero_banner](./assets/hero_banner.png)

## Supported Services

- **Disney+**
  - Fixes broken `Space` play/pause behavior, adds `C` for subtitles and `F` for fullscreen.
  - Removes the distracting blue focus outline and enables Left/Right arrow shortcuts for quick rewind/fast-forward.

- **HBO Max**
  - Fixes unreliable `Space` behavior and adds `C` for subtitles and `F` for fullscreen.
  - The HBO Max player already supports Left/Right arrow keys for skipping.

## Features

> YouTube-style keyboard shortcuts for streaming services.

- **Play/Pause** (`Space`) - Toggle play/pause anywhere on the page, regardless of focus
- **Fullscreen** (`F`) - Enter or exit fullscreen mode
- **Subtitles** (`C`) - Quickly toggle subtitles based on your language preferences
- **Position Restore** (`R`) - Jump back to previous positions in the video
- **Rewind/Forward** (`←`/`→`) - Skip backward or forward (Disney+)
- **No Focus Outline** - Removes the distracting blue focus ring (Disney+)
- **Works in Fullscreen** - All shortcuts work reliably in fullscreen mode

### Why This Extension?

Default keyboard behavior on streaming services is often frustrating:
- Spacebar activates focused buttons instead of play/pause
- Keyboard stops working after exiting fullscreen (until you click the video)
- No quick way to toggle subtitles
- Accidentally seeking too far with no easy way back

This extension intercepts keyboard events and routes them correctly, so shortcuts work consistently.

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play / Pause |
| `F` | Toggle fullscreen |
| `C` | Toggle subtitles |
| `R` | Open position restore dialog |
| `←` / `→` | Rewind / Forward (Disney+) |
| `1-3` | Jump to saved position (when dialog is open) |
| `Esc` | Close position restore dialog |

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

## Position Restore

Press `R` to open a dialog showing your recent positions in the video. This is useful when you accidentally skip too far or want to rewatch a scene.

**What gets saved:**
- The position where the video started (if you resumed from a previous session)
- Up to 3 positions from before you seeked (clicked the timeline or used arrow keys)

**How to use:**
1. Press `R` to open the position restore dialog
2. Press `1`, `2`, or `3` to jump to a saved position, or click on it
3. Press `R` again or `Esc` to close the dialog

The dialog shows:
- Your current position
- Saved positions with timestamps and how long ago they were saved
- A progress bar showing where each position is in the video

**Settings:**
- Position history can be disabled in the extension settings (right-click icon → Options)

## Installation

### From Releases

1. Go to [releases page](https://github.com/ViktorStiskala/chrome-stream-keys/releases/latest) and download the ZIP file.
2. Extract ZIP to destination folder.
3. Open Chrome and navigate to `chrome://extensions/`
4. Enable "Developer mode" in the top right
5. Click "Load unpacked" and select the extension folder

### From Source

1. Clone or download this repository
2. Install dependencies: `npm install`
3. Build the extension: `npm run build`
4. Open Chrome and navigate to `chrome://extensions/`
5. Enable "Developer mode" in the top right
6. Click "Load unpacked" and select the `build/chrome/extension` folder

## Permissions

- `webNavigation` - To detect when pages finish loading
- `scripting` - To inject the keyboard handler scripts
- `storage` - To save your preferences
- `host_permissions` - To run on supported streaming service domains

## For Developers

<details>
<summary>Building from source</summary>

```bash
npm install   # Install dependencies
npm run build # Production build to build/chrome/extension/
npm run dev   # Watch mode for development (build/dev/chrome/extension/)
```

**Available commands:**
- `npm run check` - Run all checks (typecheck + lint + format)
- `npm test` - Run tests
- `npm run test:watch` - Run tests in watch mode

**Architecture:** Built with TypeScript and Vite. Service-specific handlers in `src/services/`, composable features in `src/features/`, core utilities in `src/core/`.

</details>

## License

[MIT](./LICENSE)
