---
description: HBO Max / HBO / Max streaming service handler - Standard DOM and Player Controls. Apply when user mentions HBO Max, HBO, or Max streaming.
globs:
  - "**/hbomax.ts"
  - "**/services/hbomax*"
  - "**/handlers/hbomax*"
  - "resources/dom/hbomax*"
---

# HBO Max Handler Notes

## Standard DOM Button Access

HBO Max does NOT use Shadow DOM. Access buttons directly via `querySelector`:

### Play/Pause Button
- Primary: `button[data-testid="player-ux-play-pause-button"]`
- Fallback: `[class^="ControlsFooterBottomMiddle"] button:nth-child(2)`

### Fullscreen Button
- Primary: `button[data-testid="player-ux-fullscreen-button"]`
- Fallback: `[class^="ControlsFooterBottomRight"] button:last-child`

**Note:** Always implement fallback selectors as `data-testid` attributes may be removed in production builds.

## Player Elements

- Player container: `div[data-testid="playerContainer"]`
- Focusable overlay: `#overlay-root` (has `tabindex="0"`)
- App root for overlay placement: `#app-root`

## Focus Management

- Focus target: `#overlay-root` element
- Use `document.hasFocus()` check before calling `focus()`

## Fullscreen Detection

HBO Max requires both fullscreen event listeners:
- `fullscreenchange` - standard event
- `webkitfullscreenchange` - required for HBO Max (may use webkit prefix internally)

Check for fullscreen element with: `document.fullscreenElement || document.webkitFullscreenElement`

## Invisible Click Overlay

When creating the click overlay after fullscreen exit:
- Append to `#app-root` instead of `document.body` to be above HBO Max's layer structure
- Use `!important` on all CSS properties to override HBO Max styles
- Add `pointer-events: auto !important` to ensure clicks are captured

## Subtitle Selectors

HBO Max subtitle menu uses buttons with aria attributes:

- **Subtitle buttons**: `button[data-testid="player-ux-text-track-button"]`
- **Off option**: First button in the list (has `aria-label="Off"`)
- **Language labels**: `aria-label` attribute or `p.TrackLabel` inside button
- **Check if selected**: `aria-checked="true"` attribute

To check if subtitles are on: First button's `aria-checked !== "true"`

To select a language: Click the corresponding button element.

## DOM Reference

**Important:** Always consult `resources/dom/hbomax.html` when implementing any DOM-related changes, including selectors, value extraction, element traversal, or player structure. This file contains a snapshot of the actual HBO Max player (irrelevant parts removed to make the file smaller) DOM structure and should be the primary reference for understanding the page layout.

## Testing

### Test File Location

Tests are co-located at `src/services/hbomax.test.ts`.

### Internal Functions for Testing

The `HboMaxHandler` exports a `_test` object with internal functions:
```typescript
HboMaxHandler._test.getPlayer()       // Get playerContainer element
HboMaxHandler._test.getButton(code)   // Get button for key code
HboMaxHandler._test.subtitles         // Subtitle config object
```

### DOM Fixture Testing

Tests use the real DOM fixture from `resources/dom/hbomax.html`:
```typescript
import { loadFixture, resetFixture } from '@test';

beforeEach(() => {
  resetFixture();
  loadFixture('hbomax');
});
```
