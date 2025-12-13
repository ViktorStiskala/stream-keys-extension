---
description: Handler configuration, feature flags, and position tracking for StreamKeys service handlers. Apply this rule when working with createHandler() in src/handlers/factory.ts, implementing or modifying service handlers in src/services/, configuring feature flags (subtitles, restorePosition, keyboard, fullscreenOverlay), implementing seek button interception, or debugging position history recording. Essential for understanding: getPlayer, getButton, getSeekButtons, supportsDirectSeek, getPlaybackTime, getDuration config properties; the isKeyboardOrButtonSeek flag and its reset strategies (event-based vs timeout); pointerdown vs click event handling; and position history debouncing (keyboard seeks debounced, timeline clicks not). Relevant keywords: handler, createHandler, feature flag, seek, position history, debounce, media keys, button interception.
---

# Handler Configuration with Feature Flags

Service handlers provide a config object to `createHandler()`:

@scripts/handler-template.ts

## Required Config Properties

- `name`: Display name for the service (used in logs)
- `getPlayer`: Function returning the player container element
- `getButton`: Function mapping key codes to control buttons

## Optional Config Properties

- `setupPlayerFocus`: Custom focus handling logic
- `onPlayerSetup`: Callback when player is initialized
- `getOverlayContainer`: Container element for click overlay
- `subtitles`: Subtitle control configuration object
- `getSeekButtons`: Function returning `{ backward, forward }` button elements for position history tracking and custom seek override
- `supportsDirectSeek`: Whether direct `video.currentTime` manipulation works. Set to `false` for services using MediaSource Extensions (like Disney+) where currentTime is buffer-relative. Defaults to `true`.
- `getPlaybackTime`: Custom playback time getter for services where `video.currentTime` is unreliable
- `getDuration`: Custom duration getter for services where `video.duration` is unreliable
- `getVideo`: Custom video element selector for services with multiple video elements

## Feature Flags

All features are enabled by default. Set to `false` to disable:

- `subtitles`: Automatic subtitle language selection
- `restorePosition`: Position history and restore dialog
- `keyboard`: Keyboard shortcut handling
- `fullscreenOverlay`: Click overlay for fullscreen mode

## Position Tracking Flag Reset Strategies

The `isKeyboardOrButtonSeek` flag is used to distinguish keyboard/button seeks from timeline/UI seeks to prevent duplicate position recording. Two different reset strategies are used depending on the context:

### 1. Event-Based Reset (Keyboard Handler)

Used in `src/features/keyboard/index.ts` for arrow key seeks:

```typescript
// Listen for 'seeked' event to reset flag precisely when seek completes
video.addEventListener('seeked', resetFlag, { once: true });
// Fallback timeout (2000ms) in case 'seeked' never fires
setTimeout(() => { ... }, KEYBOARD_SEEK_FLAG_TIMEOUT_MS);
```

**Why:** Keyboard seeks are user-initiated and may be rapid. The `seeked` event provides accurate timing for when the seek completes, which is important for correctly handling rapid successive seeks. The 2000ms fallback handles edge cases where services don't emit the event.

### 2. Simple Timeout Reset (Media Session & Button Interception)

Used in `src/handlers/factory.ts` for media keys and UI button clicks:

```typescript
setTimeout(() => restorePositionAPI.setKeyboardSeek(false), POSITION_TRACK_TIMEOUT_MS);
```

**Why:** Media Session handlers and button click handlers fire once per user action. The 500ms timeout is sufficient because:
- The debounce logic already handles rapid seeks
- These handlers don't need to track precise seek completion
- Simpler code with fewer event listeners to manage

### When to Use Each

| Handler Type | Strategy | Timeout | Reason |
|--------------|----------|---------|--------|
| Keyboard (arrow keys) | `seeked` event + fallback | 2000ms | Precise timing for rapid seeks |
| Media Session (media keys) | Simple timeout | 500ms | One-shot, debounce handles overlap |
| Button interception (UI buttons) | Simple timeout | 500ms | One-shot, debounce handles overlap |

## Button Interception Event Type

The button interception uses `pointerdown` instead of `click` to capture the position BEFORE the streaming service's event handlers fire. Many services (like HBO Max) use `mousedown` or `pointerdown` to trigger seeks, so by the time `click` fires, the seek has already started and the video time has changed.

```typescript
// Use pointerdown to fire before the service's handlers
button.addEventListener('pointerdown', handler, true);  // capture phase
```

The capture phase (`true`) ensures our handler runs before any handlers on child elements, while `pointerdown` fires earlier in the event sequence than `click`.

## Position History Debouncing

Position history uses different debouncing strategies based on seek source:

### Keyboard/Button Seeks: DEBOUNCED (2 seconds)

Seeks triggered by keyboard arrow keys, media keys, or UI skip buttons are debounced. This prevents rapid key presses (e.g., holding down an arrow key) from filling up the position history with many entries.

```typescript
// In recordPositionBeforeSeek (used by keyboard/button seeks)
debouncedSavePosition(state, preSeekTime);  // 2-second debounce window
```

### Timeline Clicks: NEVER DEBOUNCED

Seeks triggered by clicking on the video timeline/progress bar are NOT debounced. Each timeline click is a deliberate user action that should always be recorded.

```typescript
// In handleSeeking (triggered by 'seeking' event for timeline clicks)
savePositionToHistory(state, stableTime);  // Direct save, no debounce
```

**Why the difference:**
- **Keyboard/buttons**: User might rapidly press keys while navigating; only the first position in a series matters
- **Timeline clicks**: Each click represents a deliberate navigation to a specific point; user expects to be able to return to each clicked position

**Important:** If you add a new seek source, determine whether it should be debounced (rapid input) or not (deliberate single actions).

## Testing with Fake Timers

When testing code that uses timers, understand the difference between macrotasks and microtasks:

### setTimeout (macrotasks)

`vi.advanceTimersByTime()` handles setTimeout correctly, including nested setTimeout:

```typescript
// This works - vitest executes nested setTimeout during the advance
setTimeout(() => {
  setTimeout(() => { /* inner */ }, 500);
}, 1000);
vi.advanceTimersByTime(1600); // Both callbacks run
```

**No `vi.runAllTicks()` needed** for regular setTimeout patterns.

### Promises and async patterns (microtasks)

If code uses Promises, `await`, or `queueMicrotask`, you MUST call `vi.runAllTicks()`:

```typescript
// Code that schedules a Promise after timeout
setTimeout(() => {
  Promise.resolve().then(() => { /* async callback */ });
}, 1000);

vi.advanceTimersByTime(1100);
vi.runAllTicks(); // Required! Flushes the Promise microtask
```

### When to use vi.runAllTicks()

| Pattern | vi.runAllTicks() needed? |
|---------|-------------------------|
| `setTimeout(() => { ... })` | ❌ No |
| Nested `setTimeout` | ❌ No |
| `Promise.resolve().then()` | ✅ Yes |
| `async/await` | ✅ Yes |
| `queueMicrotask()` | ✅ Yes |
| setTimeout + Promise combo | ✅ Yes |

### jsdom RAF limitation

`requestAnimationFrame` doesn't properly advance with fake timers in jsdom. For code that uses RAF loops (like stable time tracking), manually set the expected values in tests:

```typescript
// RAF loop doesn't run in jsdom - set values manually
augmentedVideo._streamKeysStableTime = expectedTime;
augmentedVideo._streamKeysLastKnownTime = expectedTime;
```

This is acceptable when testing logic that consumes these values, not the RAF loop itself.
