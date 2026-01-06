# Stream Keys Browser Extension - Comprehensive Information

## Overview

Stream Keys is a free browser extension that brings YouTube-style keyboard shortcuts to streaming services. It fixes broken keyboard behavior on streaming sites, adds quick subtitle toggling, and provides a unique "position restore" feature that lets users jump back to previous positions in videos – like an undo feature for video navigation.

The extension is available for Chrome, Firefox, Safari, and Microsoft Edge. It's lightweight, privacy-focused (zero tracking, zero ads, zero data collection), and open source under the MIT license.

---

## The Problem Stream Keys Solves

Default keyboard behavior on streaming services is often frustrating:

### Broken Spacebar Behavior
When you press Space to pause a video, streaming services often activate whichever button happens to be focused instead of toggling play/pause. This can result in:
- Accidentally skipping to the next episode
- Restarting the entire movie from the beginning (pressing a "Start from beginning" button)
- Triggering fast-forward or rewind buttons
- Clicking random UI buttons the user didn't intend to press

### Lost Focus After Fullscreen
After exiting fullscreen mode, keyboard shortcuts often stop working entirely. Users have to click somewhere on the page to regain focus, which can inadvertently pause the video, trigger a seek, or interact with other UI elements.

### No Quick Subtitle Toggle
There's typically no quick, consistent way to toggle subtitles on or off. Users have to navigate through menus, find the subtitle settings, and manually select their preferred language every time.

### No Way to Return to Previous Position
If you accidentally overshoot with a skip, seek too far on the timeline, or want to rewatch a scene and then return to where you were, there's no easy way to jump back. Stream Keys solves this with its "Position Restore" feature.

---

## Key Features

### Reliable Play/Pause (Space Key)
Press Space anywhere on the page to toggle play/pause, regardless of what element is focused. The extension intercepts the keypress and directly controls the video player, bypassing the problematic focus-based behavior of streaming services.

### Fullscreen Toggle (F Key)
Press F to enter or exit fullscreen mode. Unlike native implementations, Stream Keys' shortcuts continue working reliably even after you exit fullscreen – no need to click the page to regain keyboard control.

### Quick Subtitle Toggle (C Key)
Press C to toggle subtitles based on your language preferences:
- If subtitles are currently on → turns them off, displays "Captions: Off"
- If subtitles are currently off → enables the first matching language from your preference list
- If no matching language is found → shows "Captions: Language not found, check extension settings"

Users can configure their preferred subtitle languages in the extension settings, ordered by priority. The first available matching language will be selected.

### Position Restore (R Key) – Unique Feature
Press R to open a dialog showing your recent positions in the video. This is perfect for:
- When you accidentally skip too far forward or backward
- When your finger slips on the trackpad and seeks to the wrong spot
- When you want to rewatch a scene and then return exactly where you were
- When you want to check something earlier in the video without losing your place

**It's like undo for video navigation.**

The position restore dialog shows:
- Your current playback position
- The position where the video started (if you resumed from a previous session)
- Your manually saved position (if you pressed S to bookmark a spot)
- Up to 3 positions from before you seeked (automatically saved when you click the timeline or use skip buttons)
- How long ago each position was saved
- A visual progress bar showing where each position is relative to the total video length

**How to use:**
1. Press R to open the position restore dialog
2. Press a number key (0-4) to instantly jump to a saved position, or click on the position
3. Press R again or Escape to close the dialog

### Save Position (S Key)
Press S anytime to manually bookmark your current position. This is great for:
- Marking a favorite scene to return to later
- Saving your place before exploring other parts of the video
- Keeping track of exactly where you want to be

Only one manually saved position is stored at a time – pressing S again overwrites the previous bookmark. The saved position appears with a distinct green highlight in the position restore dialog.

### Rewind and Fast-Forward (Arrow Keys)
On supported services (Disney+ and BBC iPlayer), use the left and right arrow keys to skip backward or forward. The default skip duration is 10 seconds, but this can be customized.

### Media Keys Support
Control playback using your keyboard's media keys:
- **Play/Pause media key**: Toggles video playback
- **Previous/Next track keys**: Skip backward or forward using the configured skip duration

Media key capture can be disabled in settings if it conflicts with other applications (like Spotify or system media controls).

### Custom Seek Time
By default, skip controls jump 10 seconds. Users can customize this to any value between 5 and 120 seconds in the extension settings. This affects:
- Arrow key skipping (on supported services)
- Media key skipping
- Keyboard shortcuts

**Note:** Custom seek time does NOT work on Disney+ due to technical limitations – Disney+'s native skip buttons always use their default 10-second duration.

### Works in Fullscreen
All keyboard shortcuts work reliably in fullscreen mode, and continue working after you exit fullscreen. No more clicking to regain focus.

### No Focus Outline (Disney+)
On Disney+, the extension removes the distracting blue focus ring that normally appears when navigating the player UI.

---

## Supported Streaming Services

### Disney+
**All features supported:**
- Space for play/pause
- F for fullscreen
- C for subtitles with language preference
- Arrow keys for rewind/fast-forward (10-second jumps)
- R for position restore
- S to save position
- Media keys for playback control
- Removes the distracting blue focus outline

**Limitations:**
- Custom seek time is NOT supported on Disney+ – skip buttons and arrow keys always use 10-second jumps

### HBO Max (Max)
**All features supported:**
- Space for play/pause
- F for fullscreen
- C for subtitles with language preference
- Custom seek time works with keyboard shortcuts and media keys
- R for position restore
- S to save position
- Media keys for playback control

**Note:** HBO Max's native player already supports left/right arrow keys for skipping, which work alongside the extension's features.

### BBC iPlayer
**All features supported:**
- Space for play/pause
- F for fullscreen
- C for subtitles (on/off toggle – BBC iPlayer uses a simple toggle rather than language selection)
- Arrow keys for rewind/fast-forward
- Custom seek time works with all controls
- R for position restore
- S to save position
- Media keys for playback control

### YouTube
**Limited feature set** (YouTube already has excellent native keyboard shortcuts):
- R for position restore
- S to save position

YouTube's native keyboard shortcuts (Space for play/pause, F for fullscreen, C for subtitles, arrow keys for seeking, etc.) are preserved and work as normal. Stream Keys only adds the position restore feature on top of YouTube's existing functionality.

---

## Extension Settings

Access settings by right-clicking the extension icon and selecting "Options."

### Enabled Services
Toggle the extension on or off for each individual streaming service. Useful if you only want the extension active on certain sites.

### Subtitle Language Preferences
Configure your preferred subtitle languages in order of priority:
- The first language in the list has the highest priority
- Matching is case-insensitive
- Language names must match exactly what's displayed in the streaming service's subtitle menu (e.g., "English", "English [CC]", "English CC")
- You can add, remove, and reorder languages
- A "Restore defaults" button resets to: English, English [CC], English CC

### Position History
Enable or disable the position history tracking feature. When disabled, the R key won't open the restore dialog and positions won't be tracked.

### Capture Media Keys
Enable or disable media key capture. When enabled:
- Play/Pause media key toggles video playback
- Previous/Next track keys skip backward/forward

Disable this if you want media keys to control other applications instead.

### Custom Seek Time
Enable and configure a custom skip duration (5-120 seconds) for arrow keys and media keys. The default is 10 seconds.

---

## Keyboard Shortcuts Reference

| Key | Action | Services |
|-----|--------|----------|
| Space | Play / Pause | Disney+, HBO Max, BBC iPlayer |
| F | Toggle fullscreen | Disney+, HBO Max, BBC iPlayer |
| C | Toggle subtitles | Disney+, HBO Max, BBC iPlayer |
| R | Open position restore dialog | All services |
| S | Save current position | All services |
| ← (Left Arrow) | Rewind | Disney+, BBC iPlayer |
| → (Right Arrow) | Fast-forward | Disney+, BBC iPlayer |
| 0-4 | Jump to saved position (when dialog is open) | All services |
| Escape | Close position restore dialog | All services |
| ⏯ (Play/Pause media key) | Play / Pause | All services with keyboard enabled |
| ⏮ / ⏭ (Skip media keys) | Skip backward / forward | All services with keyboard enabled |

---

## Position Restore Feature – Detailed Explanation

The position restore feature is one of Stream Keys' most unique capabilities. Here's everything it does:

### Automatic Position Tracking

**Load Time Position:**
When a video loads and resumes from a previous session (e.g., you closed the browser and came back), Stream Keys captures that starting position. This appears in the restore dialog with key 0.

**Pre-Seek Positions:**
Every time you seek in the video (by clicking the timeline or using skip buttons), Stream Keys automatically saves your position from before the seek. Up to 3 of these positions are kept.

**Intelligent Debouncing:**
To prevent the history from filling up with many entries during rapid navigation:
- Keyboard seeks (arrow keys, media keys) are debounced – only the position before the first skip in a rapid sequence is saved
- Timeline clicks are NOT debounced – each deliberate click is recorded, since clicking the timeline is an intentional action

### User-Saved Positions

Press S anytime to manually save your current position. This:
- Always saves, regardless of position in the video
- Overwrites any previously saved position
- Appears with a green highlight in the dialog
- Is always accessible via key 1

### Video Change Detection

When you navigate to a different video (new episode, different movie, etc.), the position history is automatically cleared. This ensures the restore dialog always shows positions relevant to the current video.

### Dialog Interface

The restore dialog shows:
- **Current time** – Your current playback position, updated in real-time
- **Load time (key 0)** – Where the video started when it loaded
- **Saved position (key 1)** – Your manually bookmarked position (if any), with green styling
- **History positions (keys 2-4)** – Up to 3 automatically saved positions from before seeks

Each position shows:
- The timestamp (e.g., "14:32")
- A relative time indicator (e.g., "2m 30s ago")
- A visual progress bar showing the position relative to total video length

---

## Browser Support

Stream Keys is available for:
- **Google Chrome** – Install from Chrome Web Store
- **Mozilla Firefox** – Install from Firefox Add-ons
- **Apple Safari** – Download DMG from GitHub releases
- **Microsoft Edge** – Download ZIP from GitHub releases (Chrome-compatible)

The extension uses the WebExtension API standard, ensuring consistent behavior across browsers.

---

## Privacy and Permissions

### Privacy Policy
- **Zero tracking** – Stream Keys doesn't collect any usage data or analytics
- **Zero ads** – Completely ad-free
- **No data transmission** – All data stays local on your device
- **Open source** – The code is publicly available for inspection

### Permissions Used
The extension requires the following permissions:

- **webNavigation** – To detect when pages finish loading and inject the keyboard handler
- **scripting** – To inject the keyboard handler scripts into streaming service pages
- **storage** – To save your preferences (subtitle languages, enabled services, etc.)
- **host_permissions** – To run on supported streaming service domains (Disney+, HBO Max, BBC iPlayer, YouTube)

---

## How Stream Keys Works (Non-Technical Overview)

When you visit a supported streaming service, Stream Keys:

1. **Detects the video player** – Finds the video element on the page
2. **Sets up keyboard handling** – Listens for key presses and performs the appropriate action
3. **Manages focus** – Ensures keyboard shortcuts work regardless of what's focused, including after fullscreen
4. **Tracks positions** – Monitors playback position for the restore feature
5. **Handles subtitles** – Interfaces with each service's subtitle system to toggle captions

The extension only activates on supported streaming service websites. On all other websites, it does nothing and has no impact on your browsing.

---

## Common Questions

### Why doesn't custom seek time work on Disney+?
Disney+ uses a non-standard video implementation where directly setting the playback time doesn't work. Stream Keys has to simulate clicking the native skip buttons, which always use Disney's default 10-second duration.

### Why are my preferred subtitles not being selected?
The language name must match exactly what's shown in the streaming service's subtitle menu. For example, if the service shows "English (US)" but you have "English" in your preferences, it won't match. Check the subtitle menu on the streaming service and update your preferences accordingly. Matching is case-insensitive, so "english" will match "English".

### Does the extension work with picture-in-picture mode?
The extension focuses on full-screen and in-page playback. Picture-in-picture behavior depends on the specific service and browser combination.

### Can I use Stream Keys with multiple browser profiles?
Yes, settings are stored per browser profile. Each profile will have its own independent settings.

### Does Stream Keys work with VPNs?
Yes, Stream Keys is a local browser extension that only interacts with the web page. It doesn't interfere with VPN functionality.

### Will Stream Keys break if a streaming service updates their website?
Possibly. Streaming services occasionally update their player implementations, which may temporarily break Stream Keys' functionality until an update is released. The extension is actively maintained.

---

## About the Extension

Stream Keys was created to solve the frustrating keyboard behavior on streaming services. The goal is simple: make keyboard shortcuts work the way users expect them to – reliably, consistently, and without surprises.

The project is open source and available on GitHub. It's free to use, modify, and distribute under the MIT license.

---

## Quick Reference Card

**Essential Shortcuts:**
- **Space** – Play/Pause
- **F** – Fullscreen
- **C** – Subtitles
- **R** – Position Restore
- **S** – Save Position

**Position Restore:**
1. Press R to open dialog
2. Press 0-4 to jump to a position
3. Press Escape or R to close

**Tagline:**
*YouTube-style keyboard shortcuts for streaming services. Lightweight, privacy-friendly, and unobtrusive.*
