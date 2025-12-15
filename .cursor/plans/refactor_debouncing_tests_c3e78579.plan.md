---
name: Refactor Debouncing Tests
overview: Complete rewrite using real DOM fixtures, @testing-library/user-event, and proper Shadow DOM attachment for Disney+. Tests distinguish debouncing from SEEK_MIN_DIFF_SECONDS rejection.
todos:
  - id: add-deps
    content: Add @testing-library/user-event and @testing-library/dom as dev dependencies
    status: pending
  - id: enhance-vitest-setup
    content: Add attachDisneyShadowDOM helper and enhance MockVideoElement in vitest.setup.ts
    status: pending
  - id: create-test-helpers
    content: Create service setup helpers and user action helpers in test-utils.ts
    status: pending
  - id: refactor-tests
    content: Rewrite debouncing.test.ts with parameterized tests using real fixtures
    status: pending
  - id: create-cursor-rule
    content: Create Cursor rule at features/restore-position/.cursor/rules/debouncing-test/RULE.md
    status: pending
---

# Refactor Debouncing Tests - Using Real DOM Fixtures

## Problem

Current tests have several issues:

1. Directly manipulate internal state (`setKeyboardSeek()`, `recordBeforeSeek()`, `_streamKeysStableTime`)
2. Don't distinguish between **debouncing** and **SEEK_MIN_DIFF_SECONDS rejection**
3. Use hardcoded selectors instead of real service configs
4. Don't use real DOM fixtures properly

## Key Insight: Real Fixtures

### HBO Max Fixture (`resources/dom/hbomax.html`)

- **Buttons already exist** with `data-testid` attributes
- No Shadow DOM needed - standard DOM access
- `button[data-testid="player-ux-skip-back-button"]`
- `button[data-testid="player-ux-skip-forward-button"]`
- Player container: `div[data-testid="playerContainer"]`
- Video: `video[data-testid="VideoElement"]`

### Disney+ Fixture (`resources/dom/disney.html`)

- **Empty custom elements** that need Shadow DOM attached:
                                - `<quick-rewind class="quick-rewind"></quick-rewind>`
                                - `<quick-fast-forward class="quick-fast-forward"></quick-fast-forward>`
                                - `<progress-bar></progress-bar>`
- Must attach Shadow DOM with correct internal structure (`info-tooltip > button`)
- Player: `disney-web-player`
- Video: `video.hive-video`

---

## Critical Test Distinctions

**Always import constants - never hardcode values!**

```typescript
import {
  SEEK_MIN_DIFF_SECONDS,  // Position threshold (currently 15s)
  SEEK_DEBOUNCE_MS,       // Time window (currently 5000ms)
  STABLE_TIME_DELAY_MS,   // Stable time delay (currently 500ms)
} from './history';
```

### SEEK_MIN_DIFF_SECONDS - NOT what we're testing

```typescript
position1 = 100;  // saved
position2 = 105;  // rejected (diff < SEEK_MIN_DIFF_SECONDS) - NOT debouncing!
```

### SEEK_DEBOUNCE_MS - What we ARE testing

```typescript
// Position 200s -> SAVED (first press)
// 3s of rapid presses, position now 290s (diff >> SEEK_MIN_DIFF_SECONDS, valid!)
// Still DEBOUNCED because only 3s passed (< SEEK_DEBOUNCE_MS window)
```

### Test Requirements

- Start at `SEEK_MIN_DIFF_SECONDS * 10`+ (well above threshold)
- Use `SEEK_MIN_DIFF_SECONDS * 5`+ position jumps between saves
- Time advances < `SEEK_DEBOUNCE_MS` for debounce testing, > for expiration

---

## Implementation

### 1. Add Dependencies

```bash
npm install -D @testing-library/user-event @testing-library/dom
```

### 2. Enhance [`vitest.setup.ts`](vitest.setup.ts)

**Attach Shadow DOM to Disney+ elements (from fixture):**

```typescript
/**
 * Attach Shadow DOM to Disney+ custom elements from the fixture.
 * The fixture has empty <quick-rewind>, <quick-fast-forward>, <progress-bar> elements.
 * Real Disney+ has shadowRoot with info-tooltip > button inside.
 */
export function attachDisneyShadowDOM(): {
  backwardButton: HTMLButtonElement;
  forwardButton: HTMLButtonElement;
  setProgressBarTime: (seconds: number) => void;
} {
  // Attach Shadow DOM to quick-rewind
  const quickRewind = document.querySelector('quick-rewind');
  if (quickRewind && !quickRewind.shadowRoot) {
    const shadow = quickRewind.attachShadow({ mode: 'open' });
    const infoTooltip = document.createElement('info-tooltip');
    const button = document.createElement('button');
    button.setAttribute('type', 'button');
    infoTooltip.appendChild(button);
    shadow.appendChild(infoTooltip);
  }
  
  // Attach Shadow DOM to quick-fast-forward
  const quickFastForward = document.querySelector('quick-fast-forward');
  if (quickFastForward && !quickFastForward.shadowRoot) {
    const shadow = quickFastForward.attachShadow({ mode: 'open' });
    const infoTooltip = document.createElement('info-tooltip');
    const button = document.createElement('button');
    button.setAttribute('type', 'button');
    infoTooltip.appendChild(button);
    shadow.appendChild(infoTooltip);
  }
  
  // Attach Shadow DOM to progress-bar
  const progressBar = document.querySelector('progress-bar');
  let thumb: HTMLDivElement | null = null;
  if (progressBar && !progressBar.shadowRoot) {
    const shadow = progressBar.attachShadow({ mode: 'open' });
    thumb = document.createElement('div');
    thumb.className = 'progress-bar__thumb';
    thumb.setAttribute('aria-valuenow', '200');
    thumb.setAttribute('aria-valuemax', '7200');
    shadow.appendChild(thumb);
  } else {
    thumb = progressBar?.shadowRoot?.querySelector('.progress-bar__thumb') ?? null;
  }
  
  return {
    backwardButton: quickRewind?.shadowRoot?.querySelector('info-tooltip button') as HTMLButtonElement,
    forwardButton: quickFastForward?.shadowRoot?.querySelector('info-tooltip button') as HTMLButtonElement,
    setProgressBarTime: (seconds: number) => {
      thumb?.setAttribute('aria-valuenow', String(seconds));
    },
  };
}
```

**Enhance MockVideoElement with `_simulatePlayback`:**

```typescript
export interface MockVideoElement extends HTMLVideoElement {
  _setCurrentTime: (time: number) => void;
  _setSeeking: (seeking: boolean) => void;
  _setDuration: (duration: number) => void;
  /** Simulate playback - updates currentTime and fires timeupdate */
  _simulatePlayback: (toTime: number) => void;
}
```

### 3. Service Setup Helpers ([`test-utils.ts`](src/features/restore-position/test-utils.ts))

```typescript
import { Handler } from '@/handlers';
import { loadFixture, createMockVideo, attachDisneyShadowDOM, type MockVideoElement } from '@test';

export interface ServiceTestContext {
  name: string;
  video: MockVideoElement;
  player: HTMLElement;
  handler: { cleanup: () => void };
  getSeekButtons: () => { backward: HTMLElement | null; forward: HTMLElement | null };
  /** Disney+ only: update progress bar time */
  setProgressBarTime?: (seconds: number) => void;
  supportsDirectSeek: boolean;
}

/**
 * Set up HBO Max test using real fixture.
 * Fixture already has buttons with data-testid attributes.
 */
export function setupHBOMaxTest(): ServiceTestContext {
  loadFixture('hbomax');
  
  const player = document.querySelector<HTMLElement>('[data-testid="playerContainer"]')!;
  const video = createMockVideo({
    currentTime: 200,
    duration: 7200,
    readyState: 4,
    src: 'blob:https://play.hbomax.com/test',
  });
  
  // Replace fixture's video with mock
  const existingVideo = player.querySelector('video');
  existingVideo?.replaceWith(video);
  
  const getSeekButtons = () => ({
    backward: document.querySelector<HTMLElement>('button[data-testid="player-ux-skip-back-button"]'),
    forward: document.querySelector<HTMLElement>('button[data-testid="player-ux-skip-forward-button"]'),
  });
  
  const handler = Handler.create({
    name: 'HBO Max',
    getPlayer: () => player,
    getVideo: () => video,
    getSeekButtons,
    supportsDirectSeek: true,
    getButton: (code: string) => {
      if (code === 'ArrowLeft') return getSeekButtons().backward;
      if (code === 'ArrowRight') return getSeekButtons().forward;
      return null;
    },
  });
  
  return { name: 'HBO Max', video, player, handler, getSeekButtons, supportsDirectSeek: true };
}

/**
 * Set up Disney+ test using real fixture.
 * Fixture has empty custom elements - attach Shadow DOM.
 */
export function setupDisneyPlusTest(): ServiceTestContext {
  loadFixture('disney');
  
  const { backwardButton, forwardButton, setProgressBarTime } = attachDisneyShadowDOM();
  const player = document.querySelector<HTMLElement>('disney-web-player')!;
  
  const video = createMockVideo({
    currentTime: 0, // Disney+ video.currentTime is unreliable
    duration: 7200,
    readyState: 4,
    src: 'blob:https://www.disneyplus.com/test',
  });
  video.classList.add('hive-video');
  
  // Replace fixture's video with mock
  const existingVideo = player.querySelector('video.hive-video') || player.querySelector('video');
  existingVideo?.replaceWith(video);
  
  const getSeekButtons = () => ({
    backward: document.querySelector('quick-rewind')?.shadowRoot?.querySelector<HTMLElement>('info-tooltip button') ?? null,
    forward: document.querySelector('quick-fast-forward')?.shadowRoot?.querySelector<HTMLElement>('info-tooltip button') ?? null,
  });
  
  // Disney+ getPlaybackTime reads from progress bar Shadow DOM
  const getPlaybackTime = () => {
    const thumb = document.querySelector('progress-bar')?.shadowRoot?.querySelector('.progress-bar__thumb');
    return thumb ? parseInt(thumb.getAttribute('aria-valuenow') || '0', 10) : null;
  };
  
  const handler = Handler.create({
    name: 'Disney+',
    getPlayer: () => player,
    getVideo: () => video,
    getPlaybackTime,
    getDuration: () => 7200,
    getSeekButtons,
    supportsDirectSeek: false, // Disney+ uses button clicks
    getButton: (code: string) => {
      if (code === 'ArrowLeft') return getSeekButtons().backward;
      if (code === 'ArrowRight') return getSeekButtons().forward;
      return null;
    },
  });
  
  setProgressBarTime(200);
  return { name: 'Disney+', video, player, handler, getSeekButtons, setProgressBarTime, supportsDirectSeek: false };
}
```

### 4. User Action Helpers ([`test-utils.ts`](src/features/restore-position/test-utils.ts))

```typescript
import userEvent from '@testing-library/user-event';

export function createUserEventInstance() {
  return userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
}

/** Press arrow key - fires realistic keydown/keypress/keyup sequence */
export async function pressArrowKey(
  user: ReturnType<typeof userEvent.setup>,
  direction: 'left' | 'right'
) {
  const key = direction === 'left' ? '{ArrowLeft}' : '{ArrowRight}';
  await user.keyboard(key);
}

/** Click skip button using pointerdown (matches real handler interception) */
export async function clickSkipButton(
  user: ReturnType<typeof userEvent.setup>,
  direction: 'backward' | 'forward',
  ctx: ServiceTestContext
) {
  const buttons = ctx.getSeekButtons();
  const button = direction === 'backward' ? buttons.backward : buttons.forward;
  if (button) {
    await user.pointer({ keys: '[MouseLeft>]', target: button });
    await user.pointer({ keys: '[/MouseLeft]', target: button });
  }
}

/** Simulate timeline click (direct seeking, NOT through buttons) */
export function clickTimeline(video: MockVideoElement, toTime: number) {
  video._setSeeking(true);
  video.dispatchEvent(new Event('seeking'));
  video._setCurrentTime(toTime);
  video._setSeeking(false);
  video.dispatchEvent(new Event('seeked'));
}

/** Advance playback and let RAF loop update stable time */
export function advancePlayback(ctx: ServiceTestContext, toTime: number, advanceMs?: number) {
  ctx.video._simulatePlayback(toTime);
  ctx.setProgressBarTime?.(toTime);
  vi.advanceTimersByTime(advanceMs ?? STABLE_TIME_DELAY_MS + 100);
}
```

### 5. Test Structure ([`debouncing.test.ts`](src/features/restore-position/debouncing.test.ts))

Use `describe.each` for parameterized tests across both services:

```typescript
const services = [
  { name: 'HBO Max', setup: setupHBOMaxTest },
  { name: 'Disney+', setup: setupDisneyPlusTest },
] as const;

describe.each(services)('Position History Debouncing - $name', ({ setup }) => {
  let ctx: ServiceTestContext;
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'setInterval', 'requestAnimationFrame', 'cancelAnimationFrame'],
    });
    user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    ctx = setup();
    vi.advanceTimersByTime(LOAD_TIME_CAPTURE_DELAY_MS + READY_FOR_TRACKING_DELAY_MS + 100);
  });

  describe('timeline clicks (NEVER debounced)', () => {
    it('saves every timeline click even within debounce window', () => {
      const startPos = SEEK_MIN_DIFF_SECONDS * 10;
      advancePlayback(ctx, startPos);
      
      const dest1 = startPos + SEEK_MIN_DIFF_SECONDS * 5;
      clickTimeline(ctx.video, dest1);
      expect(getPositionHistory()).toHaveLength(1);
      
      vi.advanceTimersByTime(1000); // Within SEEK_DEBOUNCE_MS!
      advancePlayback(ctx, dest1);
      
      const dest2 = dest1 + SEEK_MIN_DIFF_SECONDS * 5;
      clickTimeline(ctx.video, dest2);
      expect(getPositionHistory()).toHaveLength(2); // NOT debounced
    });
  });

  describe('keyboard seeks (debounced)', () => {
    it('debounces rapid presses even when position diff exceeds SEEK_MIN_DIFF_SECONDS', async () => {
      // Proves we test DEBOUNCING, not SEEK_MIN_DIFF_SECONDS
      const startPos = SEEK_MIN_DIFF_SECONDS * 10;
      advancePlayback(ctx, startPos);
      
      await pressArrowKey(user, 'right');
      expect(getPositionHistory()).toHaveLength(1);
      
      // Hold key for 3s - position changes by 6x SEEK_MIN_DIFF_SECONDS (valid!)
      // But still debounced because < SEEK_DEBOUNCE_MS
      for (let i = 0; i < 30; i++) {
        vi.advanceTimersByTime(100);
        await pressArrowKey(user, 'right');
      }
      
      expect(getPositionHistory()).toHaveLength(1); // Still debounced!
    });
  });
});
```

---

## Key Design Decisions

| Aspect | Approach |

|--------|----------|

| **Fixtures** | Real fixtures from `resources/dom/` via `loadFixture()` |

| **HBO Max buttons** | Already in fixture with `data-testid` - no modification needed |

| **Disney+ buttons** | Attach Shadow DOM to existing `<quick-rewind>`, `<quick-fast-forward>` elements |

| **Disney+ progress bar** | Attach Shadow DOM with `.progress-bar__thumb` and `aria-valuenow` |

| **Video elements** | Replace fixture's video with MockVideoElement |

| **Position values** | Start at `SEEK_MIN_DIFF_SECONDS * 10`+, jumps of `SEEK_MIN_DIFF_SECONDS * 5`+ |

| **getSeekButtons** | Real patterns from `disney.ts` and `hbomax.ts` |

---

## Files to Modify

1. **[`package.json`](package.json)** - Add `@testing-library/user-event` and `@testing-library/dom`
2. **[`vitest.setup.ts`](vitest.setup.ts)** - Add `attachDisneyShadowDOM()`, enhance `MockVideoElement._simulatePlayback()`
3. **[`src/features/restore-position/test-utils.ts`](src/features/restore-position/test-utils.ts)** - `setupHBOMaxTest()`, `setupDisneyPlusTest()`, user action helpers
4. **[`src/features/restore-position/debouncing.test.ts`](src/features/restore-position/debouncing.test.ts)** - Complete rewrite with parameterized tests
5. **`src/features/restore-position/.cursor/rules/debouncing-test/RULE.md`** - Cursor rule documenting test patterns