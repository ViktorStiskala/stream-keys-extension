---
description: Disney+ / Disney Plus streaming service handler - Shadow DOM and Player Controls. Apply when user mentions Disney+, Disney Plus, or Disney streaming.
globs:
  - "**/disney.ts"
  - "**/services/disney*"
  - "**/handlers/disney*"
  - "resources/dom/disney*"
---

# Disney+ Handler Notes

## Video Elements

Disney+ has **two video elements** inside `disney-web-player`:

1. **Hidden video**: `display: none`, class `btm-media-client-element` - not used for playback
2. **Active video**: id `hivePlayer1`, class `hive-video` - the actual player

Use the `.hive-video` selector to get the correct video element:
```typescript
player.querySelector('video.hive-video')
```

## Playback Time (Progress Bar)

**Important:** `video.currentTime` is unreliable on Disney+ due to MediaSource Extensions. It returns buffer-relative position, not actual content position.

The actual playback time is available from the progress bar, which uses **declarative Shadow DOM**:

```typescript
const progressBar = document.querySelector('progress-bar');
const thumb = progressBar?.shadowRoot?.querySelector('.progress-bar__thumb');
const currentSeconds = parseInt(thumb?.getAttribute('aria-valuenow') || '0', 10);
const totalSeconds = parseInt(thumb?.getAttribute('aria-valuemax') || '0', 10);
```

- `aria-valuenow`: current position in seconds
- `aria-valuemax`: total duration in seconds

### Progress Bar Timing Issue

Disney+ updates the progress bar's `aria-valuenow` **before** `video.seeking` becomes `true`. This creates a race condition when capturing pre-seek positions:

1. User clicks timeline or presses seek key
2. Disney+ immediately updates progress bar to target position
3. `video.seeking` is still `false` at this point
4. Only then does `video.seeking` become `true`

The solution uses delayed capture: values passed to `setTimeout` are frozen at scheduling time. By scheduling stable time updates with a 500ms delay (and throttling to every 200ms), the stable time always reflects a position from before any seek started. See `restore-position` rules for implementation details.

## Shadow DOM Button Access

Disney+ player controls use Shadow DOM. Access buttons via:
```typescript
document.body.querySelector(selector)?.shadowRoot?.querySelector("info-tooltip button")
```

Available selectors: `toggle-play-pause`, `toggle-fullscreen`, `toggle-mute-button`, `quick-rewind`, `quick-fast-forward`, `restart-playback`.

## Player Element

- Main player element: `disney-web-player`
- Make player focusable with `tabindex="-1"`
- Remove outline from both `disney-web-player` and `video` elements after focusing

## Focus Management

- Focus target: `disney-web-player` element
- Use `document.hasFocus()` check before calling `focus()` to avoid focusing when browser window is inactive
- Attach keydown listener directly to player element as fallback

## Subtitle Selectors

Disney+ subtitle menu uses radio inputs with labels:

- **Subtitle picker container**: `#subtitleTrackPicker`
- **Off option**: `input#subtitleTrackPicker-off` (locale-dependent label, e.g., "Vypnuto")
- **Language labels**: `#subtitleTrackPicker label.picker-item`
- **Get input ID from label**: `label.getAttribute('for')` → `#subtitleTrackPicker-{id}`

To check if subtitles are on: `!document.querySelector('#subtitleTrackPicker-off').checked`

To select a language: Click the corresponding radio input element.

## DOM Reference

**Important:** Always consult `resources/dom/disney.html` when implementing any DOM-related changes, including selectors, value extraction, element traversal, or Shadow DOM access. This file contains a snapshot of the actual Disney+ player (irrelevant parts removed to make the file smaller) DOM structure and should be the primary reference for understanding the page layout.

## Testing

### Test File Location

Tests are co-located at `src/services/disney.test.ts`.

### Internal Functions for Testing

The `DisneyHandler` exports a `_test` object with internal functions:
```typescript
DisneyHandler._test.getPlayer()     // Get player element
DisneyHandler._test.getVideo()      // Get active video element
DisneyHandler._test.getPlaybackTime() // Get time from Shadow DOM
DisneyHandler._test.getDuration()   // Get duration from Shadow DOM
DisneyHandler._test.subtitles       // Subtitle config object
DisneyHandler._test.resetCache()    // Reset progress bar cache
```

### Shadow DOM Mocking

For testing `getPlaybackTime()` and `getDuration()`, use the helper from `vitest.setup.ts`:
```typescript
import { createMockProgressBar } from '@test';

// Creates progress-bar element with Shadow DOM
createMockProgressBar('120', '7200'); // aria-valuenow, aria-valuemax
```

### DOM Fixture Testing

Tests use the real DOM fixture from `resources/dom/disney.html`:
```typescript
import { loadFixture, resetFixture } from '@test';

beforeEach(() => {
  resetFixture();
  loadFixture('disney');
});
```
