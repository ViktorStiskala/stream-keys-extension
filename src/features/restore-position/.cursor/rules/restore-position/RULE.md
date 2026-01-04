---
description: Position Restore Feature - History and Dialog
globs:
  - "**/restore-position/**/*.ts"
  - "!**/*.test.ts"
---

# Position Restore Feature

## Position History Algorithm

### State Management
- `positionHistory`: Array of { time, label, savedAt } entries
- `loadTimePosition`: Position when video first loaded (captured after initial resume)
- `userSavedPosition`: User-saved position via S key (single entry, overwrites previous)
- `SEEK_MAX_HISTORY`: Maximum entries to keep (3)
- `SEEK_MIN_DIFF_SECONDS`: Minimum difference between saved positions (15 seconds)

### Debounce Logic for Seeks
- `SEEK_DEBOUNCE_MS`: 5 seconds window for grouping rapid seeks
- Only the position before the FIRST seek in a sequence is saved
- **Keyboard/button seeks** use debouncing via `debouncedSavePosition()` - prevents rapid key presses from filling history
- **Timeline clicks** are NOT debounced - each click is a deliberate user action that should be recorded
- Flag `isKeyboardOrButtonSeek` distinguishes seek sources (keyboard seeks are recorded explicitly via `recordBeforeSeek()`, timeline seeks are recorded via `seeking` event)
- Debounce window uses inclusive boundary: `now - lastSeekTime <= SEEK_DEBOUNCE_MS`

### Position Recording Rules (for automatic history saves)
1. Don't save positions < 15 seconds into video
2. Don't save if too close to load time position  
3. Don't save if too close to user saved position
4. Don't save if too close to ANY existing position in history
5. Blocked saves (due to rules 1-4) do NOT start a debounce window

Note: User saved position (S key) bypasses all these rules and always saves.

## Load Time Position Capture

Capture happens on `canplay`, `playing`, or `seeked` events:
1. Wait 1 second for player to settle
2. Only capture if position >= 15 seconds
3. Mark video ready for tracking after 500ms delay (avoids recording initial resume seek)

## Video Change Detection

History is automatically cleared when navigating to a new video:

- **Tracked state**: Current video element AND its source (`video.src || video.currentSrc`)
- **Detection**: Runs every 1 second via `setupInterval`
- **Triggers**:
  - Different video element (HBO Max pattern: new DOM element for each video)
  - Same video element with different source (Disney+ pattern: blob URL changes)
- **On change**:
  1. Log "[StreamKeys] New video detected, position history cleared"
  2. Clean up old video listeners
  3. Reset state via `PositionHistory.reset(state)`
  4. Clear `_streamKeysSeekListenerAdded` flag on old video
  5. Set up tracking for new video (which recaptures load time position)

## User Saved Position (S Key)

- Press S to save current video position
- **Always saves** regardless of position (no SEEK_MIN_DIFF_SECONDS check)
- Only one user-saved position is stored; S overwrites the previous one
- Appears as first item in the history section (after load time separator)
- Has green-tinted styling to distinguish from other positions
- **Key number is always "1"** (reserved), pushing history items to start at "2"
- Key "0" is reserved for load time (even if load time is not present)
- If no user saved position, history items start at "1"
- Shows "saved position" as label (not relative time)

## Dialog State Management

### Toggle Behavior
- Pressing R when dialog is open closes it
- Pressing R when closed opens it
- ESC key closes dialog and prevents fullscreen exit

### Key Handling in Dialog
- Number keys 0-4 select corresponding position (load time + user saved + up to 3 history)
- R or ESC closes dialog
- Modifier keys (Cmd, Ctrl) pass through for browser shortcuts

### Real-time Updates
- Current time display updates every 300ms
- Relative time ("2m 30s ago") updates live
- Use `tabular-nums` for stable number widths

## Video Time Tracking

### Two-Timestamp System with Delayed Capture

For services like Disney+ where the UI updates before `video.seeking` becomes true, we use a two-timestamp system:

- `_streamKeysLastKnownTime`: Always current, updated every RAF frame
- `_streamKeysStableTime`: Delayed by ~500ms, guaranteed to be pre-seek value

The stable time is updated using delayed capture with `setTimeout`:
```typescript
const track = () => {
  const newTime = getActualPlaybackTime(currentVideo);
  currentVideo._streamKeysLastKnownTime = newTime;

  // Schedule stable time update with captured value (every ~200ms)
  if (now - lastStableSchedule >= STABLE_TIME_SCHEDULE_INTERVAL_MS) {
    const capturedTime = newTime; // Frozen at this moment
    setTimeout(() => {
      currentVideo._streamKeysStableTime = capturedTime; // Used 500ms later
    }, STABLE_TIME_DELAY_MS);
    lastStableSchedule = now;
  }
  requestAnimationFrame(track);
};
```

The key insight: the value passed to `setTimeout` is captured at scheduling time, not read when the timeout fires. This eliminates race conditions where the UI updates before `video.seeking` becomes true.

After seek completes (`seeked` event), only `_streamKeysLastKnownTime` is synced to the current position. The `_streamKeysStableTime` is NOT updated by the `seeked` handler - the RAF loop will update it with the proper 500ms delay, ensuring it always reflects a position from before any potential new seek.

### Getting Pre-Seek Position

Use `_streamKeysGetStableTime()` method which provides consistent fallback:
```typescript
video._streamKeysGetStableTime = () => {
  return video._streamKeysStableTime ??
         video._streamKeysLastKnownTime ??
         video._streamKeysGetPlaybackTime?.() ??
         video.currentTime;
};
```

This method is used by both keyboard seeks and timeline/UI seeks for consistent behavior.

### Video Element Properties

- `_streamKeysLastKnownTime`: Current position (updated every frame)
- `_streamKeysStableTime`: Delayed position (~500ms behind, pre-seek safe)
- `_streamKeysGetPlaybackTime()`: Returns actual playback time (uses custom logic for services like Disney+)
- `_streamKeysGetStableTime()`: Returns stable time with fallback chain
- `_streamKeysSeekListenerAdded`: Prevents duplicate listeners
- `_streamKeysReadyForTracking`: True after initial load complete

## Exported Constants

```typescript
import {
  PositionHistory,
  SEEK_MAX_HISTORY,      // 3 - max entries in history
  SEEK_MIN_DIFF_SECONDS, // 15 - min seconds between positions
  SEEK_DEBOUNCE_MS       // 5000 - debounce window for rapid seeks
} from './history';

// Public API methods:
// - PositionHistory.createState() - create new state object
// - PositionHistory.reset(state) - reset state for new video
// - PositionHistory.save(state, time) - direct save, no debounce
// - PositionHistory.record(state, time) - save with debounce
// - PositionHistory.saveUserPosition(state, time) - save user position (S key), overwrites previous
// - PositionHistory.debouncedSave(state, time) - returns true if debounced, false if save attempted
```
