---
name: Fix Disney Fullscreen Video
overview: Fix the Disney+ video selector to work in fullscreen mode by using fallback selectors when the `hive-video` class is absent.
todos:
  - id: revert-history-changes
    content: Revert tryGetPlaybackTime changes in history.ts
    status: pending
  - id: revert-index-changes
    content: Revert _streamKeysLastKnownTime preservation in index.ts
    status: pending
  - id: fix-video-selector
    content: Update getDisneyVideo() with fallback selector chain
    status: in_progress
  - id: add-regression-test
    content: Add test using disney_full.html fixture to verify fullscreen video detection
    status: pending
---

# Fix Disney+ Video Selector for Fullscreen Mode

## Root Cause

Disney+ changes the video element's class from `hive-video` to `btm-media-client-element` when entering fullscreen mode. The current `getDisneyVideo()` function only looks for `video.hive-video`, causing it to return `null` in fullscreen.

## Solution

### Step 1: Revert Previous Changes

The previous attempts to fix this issue by modifying time tracking logic were based on incorrect assumptions. These changes should be reverted:

- **`src/features/restore-position/history.ts`**: Revert `tryGetPlaybackTime` changes - they could cause time tracking to stop when progress bar is temporarily unavailable
- **`src/features/restore-position/index.ts`**: Revert `_streamKeysLastKnownTime` preservation - unnecessary since the video element isn't being replaced, just not found

### Step 2: Fix Video Selector

Update `getDisneyVideo()` in [src/services/disney.ts](src/services/disney.ts) to use a fallback selector chain:

1. Try `.hive-video` first (current behavior)
2. Fall back to `#hivePlayer1` (stable ID present in both modes)
3. Fall back to any video with a `src` attribute that's visible
```typescript
function getDisneyVideo(): HTMLVideoElement | null {
  const player = document.body.querySelector('disney-web-player');
  if (!player) return null;
  
  // Primary: video with hive-video class (non-fullscreen)
  const hiveVideo = player.querySelector<HTMLVideoElement>('video.hive-video');
  if (hiveVideo) return hiveVideo;
  
  // Fallback 1: video by ID (stable across fullscreen transitions)
  const byId = player.querySelector<HTMLVideoElement>('#hivePlayer1');
  if (byId) return byId;
  
  // Fallback 2: any video with src (not the hidden one)
  const videos = player.querySelectorAll<HTMLVideoElement>('video[src]');
  for (const v of videos) {
    if (v.style.display !== 'none') return v;
  }
  
  return null;
}
```


## Files to Modify

- [src/features/restore-position/history.ts](src/features/restore-position/history.ts) - Revert tryGetPlaybackTime changes
- [src/features/restore-position/index.ts](src/features/restore-position/index.ts) - Revert _streamKeysLastKnownTime preservation
- [src/services/disney.ts](src/services/disney.ts) - Update `getDisneyVideo()` function

## Testing

- Run existing tests to verify no regressions from reverts
- Add regression test using the new `disney_full.html` fixture to verify fullscreen video detection