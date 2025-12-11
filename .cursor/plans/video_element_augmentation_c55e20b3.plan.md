---
name: Video Element Augmentation
overview: Create a video getter factory that returns augmented video elements with `_streamKeysGetPlaybackTime` method, simplifying feature interfaces and standardizing all custom DOM properties with `_streamKeys` prefix.
todos:
  - id: rename-types
    content: Rename properties in types/index.ts with _streamKeys prefix
    status: completed
  - id: create-factory
    content: Create createVideoGetter factory and augmentVideoElement in video.ts
    status: completed
  - id: update-handler-factory
    content: Update handlers/factory.ts to create and pass video getter
    status: completed
  - id: simplify-restore-position
    content: Simplify restore-position feature to use getVideoElement only
    status: completed
  - id: simplify-keyboard
    content: Simplify keyboard feature to use getVideoElement only
    status: completed
  - id: simplify-dialog-history
    content: Simplify dialog.ts and history.ts - remove getPlaybackTime params
    status: completed
  - id: rename-refs
    content: Rename all _lastKnownTime and _mouseListenerAdded references
    status: completed
  - id: update-exports
    content: Update core/index.ts exports
    status: completed
  - id: cleanup-search
    content: Search codebase for removed functions and fix any remaining refs
    status: completed
  - id: verify-build
    content: Run npm run check and verify build passes
    status: completed
---

# Video Element Augmentation with Factory Pattern

## Overview

Create a `createVideoGetter` factory that produces a configured video element getter. The getter returns augmented video elements with a `_streamKeysGetPlaybackTime()` method that automatically uses custom playback time logic when available. Also standardize all custom DOM properties with `_streamKeys` prefix.

## 1. Rename Properties for Consistency

In [`src/types/index.ts`](src/types/index.ts):

**StreamKeysVideoElement:**

- `_lastKnownTime` → `_streamKeysLastKnownTime`
- `_mouseListenerAdded` → `_streamKeysMouseListenerAdded`
- Add: `_streamKeysGetPlaybackTime?: () => number`

**StreamKeysPlayerElement:**

- `_mouseListenerAdded` → `_streamKeysMouseListenerAdded`

## 2. Create Video Getter Factory

In [`src/core/video.ts`](src/core/video.ts):

```typescript
export interface VideoGetterConfig {
  getPlayer: () => HTMLElement | null;
  getVideo?: () => HTMLVideoElement | null;
  getPlaybackTime?: () => number | null;
}

function augmentVideoElement(
  video: HTMLVideoElement,
  customGetPlaybackTime?: () => number | null
): StreamKeysVideoElement {
  const augmented = video as StreamKeysVideoElement;
  if (!augmented._streamKeysGetPlaybackTime) {
    augmented._streamKeysGetPlaybackTime = () => {
      if (customGetPlaybackTime) {
        const time = customGetPlaybackTime();
        if (time !== null) return time;
      }
      return video.currentTime;
    };
  }
  return augmented;
}

export function createVideoGetter(
  config: VideoGetterConfig
): () => StreamKeysVideoElement | null {
  return () => {
    // Use custom getter exclusively if provided
    if (config.getVideo) {
      const video = config.getVideo();
      return video ? augmentVideoElement(video, config.getPlaybackTime) : null;
    }
    // Fallback to generic detection using getPlayer
    // ... existing fallback logic ...
  };
}
```

Remove the old `getVideoElement` function.

## 3. Update Factory to Create Video Getter

In [`src/handlers/factory.ts`](src/handlers/factory.ts):

```typescript
// Create video getter once at handler init
const getVideoElement = createVideoGetter({
  getPlayer: config.getPlayer,
  getVideo: config.getVideo,
  getPlaybackTime: config.getPlaybackTime,
});

// Pass to features - just one function
restorePositionAPI = initRestorePosition({ getVideoElement });
keyboardAPI = initKeyboard({
  getVideoElement,
  getButton: config.getButton,
  restorePosition: restorePositionAPI,
  subtitles: subtitlesAPI,
});
```

## 4. Simplify Feature Interfaces

**[`src/features/restore-position/index.ts`](src/features/restore-position/index.ts):**

```typescript
export interface RestorePositionConfig {
  getVideoElement: () => StreamKeysVideoElement | null;
}
```

Remove `getPlayer`, `getVideo`, `getPlaybackTime`.

**[`src/features/keyboard/index.ts`](src/features/keyboard/index.ts):**

```typescript
export interface KeyboardConfig {
  getVideoElement: () => StreamKeysVideoElement | null;
  getButton?: (keyCode: string) => HTMLElement | null;
  restorePosition?: RestorePositionAPI;
  subtitles?: SubtitlesAPI;
}
```

Remove `getPlayer`, `getVideo`, `getPlaybackTime`.

## 5. Use `_streamKeysGetPlaybackTime()` Method

Replace all direct time access with the method:

- [`src/features/restore-position/index.ts`](src/features/restore-position/index.ts): Replace `video.currentTime`
- [`src/features/restore-position/history.ts`](src/features/restore-position/history.ts): Remove `getActualPlaybackTime` helper, remove `getPlaybackTime` parameter from `setupVideoTracking`
- [`src/features/keyboard/index.ts`](src/features/keyboard/index.ts): Remove `getActualPlaybackTime` helper
- [`src/features/restore-position/dialog.ts`](src/features/restore-position/dialog.ts): Remove `getPlaybackTime` parameter, remove `getDisplayTime` helper

## 6. Rename All Property References

| File | Old | New |

|------|-----|-----|

| `src/types/index.ts` | `_lastKnownTime` | `_streamKeysLastKnownTime` |

| `src/types/index.ts` | `_mouseListenerAdded` | `_streamKeysMouseListenerAdded` |

| `src/features/restore-position/index.ts` | `_lastKnownTime` | `_streamKeysLastKnownTime` |

| `src/features/restore-position/history.ts` | `_lastKnownTime` (5x) | `_streamKeysLastKnownTime` |

| `src/core/player.ts` | `_mouseListenerAdded` (2x) | `_streamKeysMouseListenerAdded` |

## 7. Update Exports

In [`src/core/index.ts`](src/core/index.ts):

- Export `createVideoGetter` and `VideoGetterConfig`
- Remove `getVideoElement` export

## 8. Cleanup: Search and Fix Removed Functions

Search codebase for any remaining references to removed/changed items:

**Functions removed:**

- `getVideoElement` from `@/core/video` - replaced by `createVideoGetter`
- `getActualPlaybackTime` helpers in features

**Parameters removed:**

- `getPlaybackTime` parameter in `setupVideoTracking`, `createRestoreDialog`, `handleRestoreDialogKeys`
- `getPlayer`, `getVideo`, `getPlaybackTime` in feature configs

**Search patterns to verify cleanup:**

```
grep -r "getVideoElement" src/
grep -r "getActualPlaybackTime" src/
grep -r "getPlaybackTime\?" src/
grep -r "_lastKnownTime" src/
grep -r "_mouseListenerAdded" src/
```

Update any outdated comments referencing old function signatures or removed parameters.

## 9. Verify Build

Run `npm run check` to ensure:

- TypeScript compiles without errors
- ESLint passes
- Prettier formatting is correct

## Summary of Benefits

- **Simpler interfaces** - Features receive just `getVideoElement: () => StreamKeysVideoElement | null`
- **No parameter threading** - All config captured in factory closure
- **Self-contained video element** - `_streamKeysGetPlaybackTime()` always available
- **Consistent naming** - All custom properties use `_streamKeys` prefix
- **Single augmentation point** - Factory handles all video element enhancement