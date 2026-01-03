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

## Seeking Implementation

Disney+ requires custom seeking implementations because `video.currentTime` is buffer-relative:

### Relative Seeking (seekByDelta)

The handler provides `seekByDelta` that clicks the native quick-rewind/quick-fast-forward buttons:
```typescript
seekByDelta: (_video, delta) => {
  const button = delta < 0 
    ? getShadowRootButton('quick-rewind') 
    : getShadowRootButton('quick-fast-forward');
  button?.click();
}
```

**Note:** This ignores the delta value - Disney+ buttons always skip 10 seconds. Custom seek time setting does NOT work on Disney+.

### Absolute Seeking (seekToTime)

For position restore, the handler provides `seekToTime` that simulates a click on the progress bar:
```typescript
seekToTime(time: number, duration: number): boolean
```

**Critical:** Disney+ requires **PointerEvent** instead of MouseEvent, and events must be dispatched **inside the Shadow DOM** on the `.progress-bar__seekable-range` element (not the `<progress-bar>` host).

The progress bar Shadow DOM structure:
```html
<progress-bar>
  <template shadowroot="open">
    <div class="progress-bar__container progress-bar__no-pointer-events ...">
      <div class="progress-bar__seekable-range" tabindex="0" aria-label="Slider">
        <div class="progress-bar__thumb" aria-valuenow="885" aria-valuemax="2647"></div>
      </div>
    </div>
  </template>
</progress-bar>
```

- The container has `progress-bar__no-pointer-events` (CSS `pointer-events: none`)
- The interactive element is `.progress-bar__seekable-range` (with `tabindex="0"`)
- Events on the host element are ignored by Disney+'s handlers

```typescript
const seekableRange = progressBar.shadowRoot.querySelector('.progress-bar__seekable-range');
const eventInit: PointerEventInit = {
  bubbles: true,
  cancelable: true,
  composed: true,
  clientX: clickX,
  clientY: clickY,
  view: window,
  pointerId: 1,
  pointerType: 'mouse',
  isPrimary: true,
  button: 0,
  buttons: 1,
};
seekableRange.dispatchEvent(new PointerEvent('pointerdown', eventInit));
seekableRange.dispatchEvent(new PointerEvent('pointerup', { ...eventInit, buttons: 0 }));
```

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

**Important:** Always consult the DOM fixtures when implementing any DOM-related changes, including selectors, value extraction, element traversal, or Shadow DOM access.

### Available Fixtures

- `resources/dom/disney.html` - Normal (non-fullscreen) player state
- `resources/dom/disney_full.html` - Fullscreen player state

### Capture Method

The fixtures were captured using a Shadow DOM flattening script that serializes the DOM with shadow roots inlined as `<template shadowroot="open">` elements:

```javascript
(() => {
  function escapeHtml(s) {
    return s
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  function serialize(node) {
    if (node.nodeType === Node.TEXT_NODE) return escapeHtml(node.nodeValue ?? "");
    if (node.nodeType === Node.COMMENT_NODE) return `<!--${node.nodeValue ?? ""}-->`;
    if (node.nodeType === Node.DOCUMENT_NODE) return serialize(node.documentElement);

    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node;
      const tag = el.tagName.toLowerCase();
      const attrs = [...el.attributes]
        .map(a => ` ${a.name}="${escapeHtml(a.value)}"`)
        .join("");

      let inner = "";
      for (const child of el.childNodes) inner += serialize(child);

      // Inline open shadow roots
      if (el.shadowRoot) {
        inner += `<template shadowroot="open">`;
        for (const child of el.shadowRoot.childNodes) inner += serialize(child);
        inner += `</template>`;
      }

      return `<${tag}${attrs}>${inner}</${tag}>`;
    }
    return "";
  }

  const html = "<!doctype html>\n" + serialize(document);
  copy(html);
  return "Copied flattened DOM (open shadow roots only) to clipboard.";
})();
```

**Note:** The script only captures **open** shadow roots. Closed shadow roots will appear empty in the fixture.

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
DisneyHandler._test.seekToTime(time, duration) // Seek by clicking progress bar
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
