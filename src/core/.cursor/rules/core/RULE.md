---
description: Core Browser APIs and Event Handling
globs:
  - "**/core/**/*.ts"
---

# Core Module Notes

## Keyboard Event Capture Strategy

1. Use `window.addEventListener('keydown', handler, true)` - the capture phase (`true`) intercepts events before they reach other handlers
2. `window` is preferred over `document` as it's higher in the capture chain
3. Also attach listener to `document.fullscreenElement` when in fullscreen mode
4. Attach listener directly to the player element as additional fallback

## Browser Security: Fullscreen Exit Focus Issue

**Problem:** After exiting fullscreen, browsers require "user activation" (a real click) before routing keyboard events to the page. This is a security feature that cannot be bypassed with JavaScript - `element.focus()`, synthetic events, and other tricks do not satisfy this requirement.

**Solution:** Create an invisible full-page overlay after fullscreen exit that captures the user's first click:
- Overlay covers entire viewport with `z-index: 2147483647`
- Completely transparent so user doesn't notice
- Captures click, removes itself, then focuses the player
- Click doesn't propagate to video (avoids unwanted pause/play)

## Script Injection

The background script injects in this order:
1. Settings as global variable (`window.__streamKeysSettings`)
2. Handler bundle (contains all features and service handler)

All injected into MAIN world to share context with the streaming service's scripts.

## Fullscreen Detection

Use both standard and webkit-prefixed APIs:
```typescript
const fullscreenEl = document.fullscreenElement || document.webkitFullscreenElement;
```

Listen to both events:
```typescript
document.addEventListener('fullscreenchange', handler);
document.addEventListener('webkitfullscreenchange', handler);
```

## Focus Management

- Always check `document.hasFocus()` before calling `element.focus()`
- Set `tabindex="-1"` on elements that need to be focusable but shouldn't be in tab order
- Some services require focusing specific overlay elements instead of the player directly
