<img src="./assets/icon.png" width="96">

# Stream Keys

A browser extension that brings YouTube-style keyboard shortcuts to streaming services. Fixes broken spacebar behavior, adds quick subtitle toggling, and lets you jump back to previous positions.

![hero_banner](./assets/hero_banner.png)

## Why Stream Keys?

Default keyboard behavior on streaming services is often frustrating:

- Spacebar activates whichever button happens to be focused instead of play/pause (for example, a fast-forward button or a "Start from beginning" button that restarts the whole movie).
- After exiting fullscreen, keyboard shortcuts often stop working until you click the page again, which can also pause or seek the video.
- There's no quick, consistent way to toggle subtitles or switch to your preferred language.
- If you overshoot with a seek or skip, there's no easy way to jump back to where you were.

Stream Keys adds a reliable layer of keyboard handling on top of the player, so your shortcuts always do what you expect.

## Supported Services

- **Disney+**
  - Fixes broken `Space` play/pause behavior, adds `C` for subtitles and `F` for fullscreen.
  - Removes the distracting blue focus outline and enables Left/Right arrow shortcuts for quick rewind/fast-forward.

- **HBO Max**
  - Fixes unreliable `Space` behavior and adds `C` for subtitles and `F` for fullscreen.
  - The HBO Max player already supports Left/Right arrow keys for skipping.

- **YouTube**
  - Position restore feature (`R` key) to jump back to previous positions.
  - Other YouTube keyboard shortcuts work natively.

- **BBC iPlayer**
  - Fixes broken `Space` play/pause behavior, adds `C` for subtitles and `F` for fullscreen.
  - Left/Right arrow keys for quick rewind/fast-forward.

Individual services can be enabled or disabled in the extension settings.

## Features

> YouTube-style keyboard shortcuts for streaming services.

- **Play/Pause** (`Space`) - Toggle play/pause anywhere on the page, regardless of focus
- **Fullscreen** (`F`) - Enter or exit fullscreen mode
- **Subtitles** (`C`) - Quickly toggle subtitles based on your language preferences
- **Position Restore** (`R`) - Jump back to previous positions in the video
- **Rewind/Forward** (`←`/`→`) - Skip backward or forward (Disney+)
- **Media Keys** - Control playback with keyboard media keys (play/pause, skip forward/backward)
- **Custom Seek Time** - Configure how many seconds to skip with arrow keys and media keys
- **No Focus Outline** - Removes the distracting blue focus ring (Disney+)
- **Works in Fullscreen** - All shortcuts work reliably in fullscreen mode, including after you exit fullscreen

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
| `⏯` | Play / Pause (media key) |
| `⏮` / `⏭` | Skip backward / forward (media keys) |

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

## Playback Controls

Control playback with keyboard media keys and customize skip duration.

**Media Keys:**
- Play/Pause media key toggles video playback
- Previous/Next track keys skip backward/forward (uses custom seek time if enabled)
- Media key capture can be disabled in settings if it conflicts with other applications

**Custom Seek Time:**
- Override the default 10-second skip duration for arrow keys and media keys
- Configure any value from 5 to 120 seconds
- Enable in the extension settings (right-click icon → Options)

> **Note:** Custom seek time uses keyboard shortcuts and media keys. Skip buttons on Disney+ always use the service's default duration (10 seconds).

## Installation (Google Chrome)

> [!CAUTION]
> Always carefully review the extension code before installing from unofficial sources. For automated security reviews, use an official extension store instead.

1. Go to [releases page](https://github.com/ViktorStiskala/chrome-stream-keys/releases/latest) and download the ZIP archive for your browser.
2. Choose a permanent location and extract the ZIP there. The extension loads directly from this folder, so it must not be removed.
3. Open Chrome and navigate to `chrome://extensions/`
4. Enable "Developer mode" in the top right.
5. Click "Load unpacked" and select the extension folder.

## Permissions

- `webNavigation` - To detect when pages finish loading
- `scripting` - To inject the keyboard handler scripts
- `storage` - To save your preferences
- `host_permissions` - To run on supported streaming service domains

## For Developers

This repository is organized as a monorepo with two applications:

```
stream-keys/
├── apps/
│   ├── extension/    # Browser extension (Chrome, Firefox, Safari)
│   └── homepage/     # Marketing website (Astro + Tailwind)
├── assets/           # Shared marketing assets
└── .github/          # CI/CD workflows
```

<details>
<summary>Building the extension</summary>

```bash
cd apps/extension
npm install   # Install dependencies
npm run build # Production build to build/production/chrome/extension/
npm run dev   # Watch mode for development (build/dev/chrome/extension/)
```

**Available commands:**
- `npm run check` - Run all checks (typecheck + lint + format)
- `npm test` - Run tests
- `npm run test:watch` - Run tests in watch mode

**Architecture:** Built with TypeScript and Vite. Service-specific handlers in `src/services/`, composable features in `src/features/`, core utilities in `src/core/`.

</details>

<details>
<summary>Building the homepage</summary>

```bash
cd apps/homepage
npm install      # Install dependencies
npm run build    # Production build to dist/
npm run dev      # Development server at http://localhost:4321
```

**Tech stack:** Astro, Tailwind CSS v4, TypeScript. Deployed to Cloudflare Pages.

</details>

## License

[MIT](./LICENSE)
