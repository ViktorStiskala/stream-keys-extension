---
description: Position Restore Feature - Testing Guidelines
globs:
  - "**/restore-position/**/*.test.ts"
  - "**/restore-position/**/test-utils.ts"
---

# Position Restore Testing

## Test Files

- `history.test.ts` - Unit tests for PositionHistory API
- `debouncing.test.ts` - Integration tests with real DOM fixtures
- `integration.test.ts` - Full integration tests
- `test-utils.ts` - Shared test helpers and setup functions

## Critical: Debouncing vs SEEK_MIN_DIFF_SECONDS

**Always import constants - never hardcode values!**

```typescript
import {
  SEEK_MIN_DIFF_SECONDS,  // Position threshold (15s)
  SEEK_DEBOUNCE_MS,       // Time window (5000ms)
  STABLE_TIME_DELAY_MS,   // Stable time delay (500ms)
} from './history';
```

### SEEK_MIN_DIFF_SECONDS - Position rejection (NOT debouncing)
Positions too close together are rejected regardless of timing.

### SEEK_DEBOUNCE_MS - Time-based debouncing
Rapid actions within window are debounced even with valid position differences.

### Test Position Setup
- Start at `SEEK_MIN_DIFF_SECONDS * 10`+ (well above threshold)
- Use `SEEK_MIN_DIFF_SECONDS * 5`+ jumps between saves
- Time < `SEEK_DEBOUNCE_MS` for debounce testing

## Video Helpers from vitest.setup.ts

### MockVideoElement
Extended video element with controllable properties:

```typescript
import { createMockVideo, type MockVideoElement } from '@test';

const video = createMockVideo({
  currentTime: 200,
  duration: 7200,
  readyState: 4,
  src: 'blob:https://example.com/test',
});

// Control methods
video._setCurrentTime(500);
video._setSeeking(true);
video._setDuration(3600);
video._simulatePlayback(300);  // Updates currentTime + fires timeupdate
```

### Seek Event Helpers

```typescript
import { simulateSeek, simulateSeeked } from '@test';

// Full seek sequence (seeking → time change → seeked)
simulateSeek(video, 500);

// Just seeked event (when seek was initiated elsewhere)
// Use after keyboard press to reset isKeyboardOrButtonSeek flag
simulateSeeked(video);
```

### Video Load Simulation

```typescript
import { simulateVideoLoad } from '@test';

// Simulates: initial load → canplay → playing → resume seek
simulateVideoLoad(video, resumePosition);
```

## DOM Fixtures

### loadFixture()
```typescript
import { loadFixture, resetFixture } from '@test';

loadFixture('hbomax');   // From resources/dom/hbomax.html
loadFixture('disney');   // From resources/dom/disney.html

// Always reset in afterEach
afterEach(() => resetFixture());
```

### Disney+ Shadow DOM
```typescript
import { attachDisneyShadowDOM } from '@test';

// Attach after loadFixture('disney')
const { backwardButton, forwardButton, setProgressBarTime } = attachDisneyShadowDOM();

// Update progress bar time (simulates Disney+ UI)
setProgressBarTime(500);
```

## Service Test Helpers (test-utils.ts)

### Setup Helpers
```typescript
import {
  setupHBOMaxTest,
  setupDisneyPlusTest,
  type ServiceTestContext,
} from './test-utils';

const ctx = setupHBOMaxTest();  // Returns { video, player, handler, getSeekButtons, ... }
```

### User Interaction Helpers
```typescript
import {
  pressArrowKey,
  clickSkipButton,
  clickTimeline,
  advancePlayback,
} from './test-utils';

await pressArrowKey(user, 'right');
await clickSkipButton(user, 'forward', ctx);
clickTimeline(ctx.video, destinationTime);
advancePlayback(ctx, newPosition);  // Also updates stable time
```

## Fake Timers Setup

**Must include 'Date' to test debounce logic with Date.now():**

```typescript
const FAKE_TIMERS = [
  'setTimeout',
  'setInterval',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'Date',
] as const;

beforeEach(() => {
  vi.useFakeTimers({ toFake: FAKE_TIMERS });
});
```

## Counting Position Saves

Use console.info spy to count saves:

```typescript
let consoleInfoSpy: ReturnType<typeof vi.spyOn>;

function countPositionSaves(spy: typeof consoleInfoSpy): number {
  return spy.mock.calls.filter(
    (call) => typeof call[0] === 'string' && call[0].includes('Seek position saved')
  ).length;
}

beforeEach(() => {
  consoleInfoSpy = vi.spyOn(console, 'info');
  // ... setup ...
  consoleInfoSpy.mockClear();  // Clear after setup
});

it('saves correct number of positions', () => {
  // ... test actions ...
  expect(countPositionSaves(consoleInfoSpy)).toBe(2);
});
```

## Parameterized Tests

Run same tests on both services:

```typescript
const services = [
  { name: 'HBO Max', fixture: 'hbomax', setup: setupHBOMaxTest },
  { name: 'Disney+', fixture: 'disney', setup: setupDisneyPlusTest },
] as const;

describe.each(services)('Feature - $name', ({ setup }) => {
  let ctx: ServiceTestContext;
  beforeEach(() => { ctx = setup(); });
  // Tests run on both services
});
```

## Service-Specific Behavior

| Service | Stable Time Update | Flag Reset |
|---------|-------------------|------------|
| Disney+ | setTimeout (500ms) | Timeout |
| HBO Max | RAF loop | `seeked` event |

**HBO Max:** After keyboard press, dispatch `seeked` to reset flag:
```typescript
await pressArrowKey(user, 'right');
simulateSeeked(ctx.video);  // Reset isKeyboardOrButtonSeek flag
```

## When Tests Fail

**Challenge implementation first, not tests.**

Red flags suggesting implementation bugs:
- Timeline clicks being debounced (should NEVER be)
- Position history not saving first keyboard press
- `isKeyboardOrButtonSeek` flag reset prematurely
- Stable time not captured correctly before seek

## Mock Requirements

```typescript
vi.mock('@/core/settings', () => ({
  Settings: {
    isPositionHistoryEnabled: vi.fn(() => true),
    getSubtitlePreferences: vi.fn(() => ['English']),
    isCustomSeekEnabled: vi.fn(() => true),
    getSeekTime: vi.fn(() => 10),
    isMediaKeysCaptureEnabled: vi.fn(() => false),
  },
}));
```
