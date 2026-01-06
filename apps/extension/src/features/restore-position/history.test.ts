import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  PositionHistory,
  SEEK_MAX_HISTORY,
  SEEK_MIN_DIFF_SECONDS,
  SEEK_DEBOUNCE_MS,
  type PositionHistoryState,
} from './history';

// Mock Settings module
vi.mock('@/core/settings', () => ({
  Settings: {
    isPositionHistoryEnabled: vi.fn(() => true),
  },
}));

describe('PositionHistory', () => {
  let state: PositionHistoryState;

  beforeEach(() => {
    state = PositionHistory.createState();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('createState', () => {
    it('creates initial state with empty history', () => {
      expect(state.positionHistory).toEqual([]);
      expect(state.loadTimePosition).toBeNull();
      expect(state.lastSeekTime).toBe(0);
      expect(state.isKeyboardOrButtonSeek).toBe(false);
    });
  });

  describe('debouncedSave (return value semantics)', () => {
    // These tests verify the return value of debouncedSave:
    // - returns true when debounced (within window, save skipped)
    // - returns false when save was attempted (outside window)

    const POSITION_OFFSET = 100;

    describe('returns true when debounced', () => {
      it('returns true for second save within debounce window', () => {
        const position1 = SEEK_MIN_DIFF_SECONDS + POSITION_OFFSET;
        const position2 = position1 + SEEK_MIN_DIFF_SECONDS + POSITION_OFFSET;

        // First save - should return false (not debounced, save attempted)
        const result1 = PositionHistory.debouncedSave(state, position1);
        expect(result1).toBe(false);
        expect(state.positionHistory).toHaveLength(1);

        // Second save within window - should return true (debounced)
        vi.advanceTimersByTime(1000); // Still within 5s window
        const result2 = PositionHistory.debouncedSave(state, position2);
        expect(result2).toBe(true);
        expect(state.positionHistory).toHaveLength(1); // Still just 1
      });

      it('returns true at exact debounce boundary (<=)', () => {
        const position1 = SEEK_MIN_DIFF_SECONDS + POSITION_OFFSET;
        const position2 = position1 + SEEK_MIN_DIFF_SECONDS + POSITION_OFFSET;

        PositionHistory.debouncedSave(state, position1);
        expect(state.positionHistory).toHaveLength(1);

        // At exactly SEEK_DEBOUNCE_MS, condition is now - lastSeekTime <= SEEK_DEBOUNCE_MS
        // 5000 - 0 = 5000, 5000 <= 5000 is TRUE
        vi.advanceTimersByTime(SEEK_DEBOUNCE_MS);
        const result = PositionHistory.debouncedSave(state, position2);
        expect(result).toBe(true); // Still debounced at exact boundary
      });
    });

    describe('returns false when save attempted', () => {
      it('returns false for first save (successful)', () => {
        const position = SEEK_MIN_DIFF_SECONDS + POSITION_OFFSET;

        const result = PositionHistory.debouncedSave(state, position);
        expect(result).toBe(false);
        expect(state.positionHistory).toHaveLength(1);
      });

      it('returns false after debounce window expires (successful save)', () => {
        const position1 = SEEK_MIN_DIFF_SECONDS + POSITION_OFFSET;
        const position2 = position1 + SEEK_MIN_DIFF_SECONDS + POSITION_OFFSET;

        PositionHistory.debouncedSave(state, position1);
        expect(state.positionHistory).toHaveLength(1);

        // Past debounce window
        vi.advanceTimersByTime(SEEK_DEBOUNCE_MS + 1);

        const result = PositionHistory.debouncedSave(state, position2);
        expect(result).toBe(false); // Not debounced
        expect(state.positionHistory).toHaveLength(2); // Both saved
      });

      it('returns false when save blocked by threshold (not debounced, but blocked)', () => {
        // Position below SEEK_MIN_DIFF_SECONDS
        const invalidPosition = SEEK_MIN_DIFF_SECONDS - 1;

        const result = PositionHistory.debouncedSave(state, invalidPosition);
        expect(result).toBe(false); // Not debounced (save was attempted, just blocked)
        expect(state.positionHistory).toHaveLength(0); // Not saved
      });

      it('returns false when save blocked by proximity (not debounced, but blocked)', () => {
        const position1 = SEEK_MIN_DIFF_SECONDS + POSITION_OFFSET;
        const tooClose = position1 + SEEK_MIN_DIFF_SECONDS - 1;

        // First save
        PositionHistory.debouncedSave(state, position1);
        expect(state.positionHistory).toHaveLength(1);

        // Wait for debounce to expire
        vi.advanceTimersByTime(SEEK_DEBOUNCE_MS + 1);

        // Try to save too-close position
        const result = PositionHistory.debouncedSave(state, tooClose);
        expect(result).toBe(false); // Not debounced (save was attempted)
        expect(state.positionHistory).toHaveLength(1); // But blocked by proximity
      });
    });

    describe('debounce window management', () => {
      it('successful save starts debounce window', () => {
        const position = SEEK_MIN_DIFF_SECONDS + POSITION_OFFSET;
        const initialLastSeekTime = state.lastSeekTime;

        PositionHistory.debouncedSave(state, position);
        // lastSeekTime should be updated (save succeeded)
        expect(state.lastSeekTime).not.toBe(initialLastSeekTime);
        expect(state.positionHistory).toHaveLength(1);
      });

      it('debounced save extends the window', () => {
        const position1 = SEEK_MIN_DIFF_SECONDS + POSITION_OFFSET;
        const position2 = position1 + SEEK_MIN_DIFF_SECONDS + POSITION_OFFSET;

        PositionHistory.debouncedSave(state, position1);
        const timeAfterFirstSave = state.lastSeekTime;

        // Advance within debounce window and save again (debounced)
        const advanceTime = Math.floor(SEEK_DEBOUNCE_MS * 0.5);
        vi.advanceTimersByTime(advanceTime);
        PositionHistory.debouncedSave(state, position2);

        // Window should be extended (lastSeekTime updated)
        expect(state.lastSeekTime).toBe(timeAfterFirstSave + advanceTime);
        expect(state.positionHistory).toHaveLength(1); // Second save was debounced
      });

      it('blocked save does NOT start debounce window', () => {
        const initialLastSeekTime = state.lastSeekTime;

        // Try to save invalid position
        const invalidPosition = SEEK_MIN_DIFF_SECONDS - 1;
        PositionHistory.debouncedSave(state, invalidPosition);

        expect(state.lastSeekTime).toBe(initialLastSeekTime); // NOT updated
        expect(state.positionHistory).toHaveLength(0);

        // A subsequent valid save should work immediately (no debounce active)
        const validPosition = SEEK_MIN_DIFF_SECONDS + POSITION_OFFSET;
        const result = PositionHistory.debouncedSave(state, validPosition);
        expect(result).toBe(false); // Not debounced
        expect(state.positionHistory).toHaveLength(1);
      });
    });
  });

  describe('save', () => {
    describe('position threshold rules', () => {
      it.each([
        {
          position: SEEK_MIN_DIFF_SECONDS - 5,
          shouldSave: false,
          description: 'does NOT save position below threshold',
        },
        {
          position: SEEK_MIN_DIFF_SECONDS - 1,
          shouldSave: false,
          description: 'does NOT save position just below threshold',
        },
        {
          position: SEEK_MIN_DIFF_SECONDS,
          shouldSave: true,
          description: 'saves position at exactly threshold',
        },
        {
          position: SEEK_MIN_DIFF_SECONDS + 10,
          shouldSave: true,
          description: 'saves position above threshold',
        },
      ])('$description (position: $position)', ({ position, shouldSave }) => {
        PositionHistory.save(state, position);

        if (shouldSave) {
          expect(state.positionHistory).toHaveLength(1);
          expect(state.positionHistory[0].time).toBe(position);
        } else {
          expect(state.positionHistory).toHaveLength(0);
        }
      });
    });

    describe('load time position rules', () => {
      it('does NOT save position too close to load time position', () => {
        state.loadTimePosition = 100;

        // Position within SEEK_MIN_DIFF_SECONDS of load time
        const tooClosePosition = 100 + SEEK_MIN_DIFF_SECONDS - 1;
        PositionHistory.save(state, tooClosePosition);

        expect(state.positionHistory).toHaveLength(0);
      });

      it('saves position sufficiently far from load time position', () => {
        state.loadTimePosition = 100;

        // Position outside SEEK_MIN_DIFF_SECONDS of load time
        const farEnoughPosition = 100 + SEEK_MIN_DIFF_SECONDS + 1;
        PositionHistory.save(state, farEnoughPosition);

        expect(state.positionHistory).toHaveLength(1);
        expect(state.positionHistory[0].time).toBe(farEnoughPosition);
      });
    });

    describe('existing position proximity rules', () => {
      it('does NOT save position too close to existing entry', () => {
        // Add an existing entry
        const existingPosition = 100;
        PositionHistory.save(state, existingPosition);
        expect(state.positionHistory).toHaveLength(1);

        // Try to add position within SEEK_MIN_DIFF_SECONDS
        const tooClosePosition = existingPosition + SEEK_MIN_DIFF_SECONDS - 1;
        PositionHistory.save(state, tooClosePosition);

        expect(state.positionHistory).toHaveLength(1); // Still only 1 entry
      });

      it('saves position sufficiently far from existing entry', () => {
        // Add an existing entry
        const existingPosition = 100;
        PositionHistory.save(state, existingPosition);
        expect(state.positionHistory).toHaveLength(1);

        // Add position outside SEEK_MIN_DIFF_SECONDS
        const farEnoughPosition = existingPosition + SEEK_MIN_DIFF_SECONDS + 1;
        PositionHistory.save(state, farEnoughPosition);

        expect(state.positionHistory).toHaveLength(2);
      });
    });

    describe('max history enforcement (FIFO)', () => {
      it(`removes oldest entry when adding more than ${SEEK_MAX_HISTORY} entries`, () => {
        // Add SEEK_MAX_HISTORY + 1 entries, spaced far apart
        const baseTime = 100;
        const spacing = SEEK_MIN_DIFF_SECONDS + 10;

        for (let i = 0; i <= SEEK_MAX_HISTORY; i++) {
          PositionHistory.save(state, baseTime + i * spacing);
        }

        // Should have exactly SEEK_MAX_HISTORY entries
        expect(state.positionHistory).toHaveLength(SEEK_MAX_HISTORY);

        // First entry should have been removed (FIFO)
        const firstRemainingTime = state.positionHistory[0].time;
        expect(firstRemainingTime).toBe(baseTime + spacing); // Second entry is now first
      });
    });
  });

  describe('record (debouncing)', () => {
    // All debounce tests use positions explicitly calculated to exceed SEEK_MIN_DIFF_SECONDS
    // This ensures we're testing debounce logic, NOT position proximity blocking
    const POSITION_OFFSET = 100; // Added to ensure positions > SEEK_MIN_DIFF_SECONDS

    it('saves position on first call in a sequence', () => {
      // Position must exceed SEEK_MIN_DIFF_SECONDS to be valid
      const position = SEEK_MIN_DIFF_SECONDS + POSITION_OFFSET;
      expect(position).toBeGreaterThan(SEEK_MIN_DIFF_SECONDS);

      PositionHistory.record(state, position);

      expect(state.positionHistory).toHaveLength(1);
      expect(state.positionHistory[0].time).toBe(position);
    });

    it('does NOT save second position within debounce window', () => {
      // Positions must be > SEEK_MIN_DIFF_SECONDS apart so we test debounce, not proximity
      const position1 = SEEK_MIN_DIFF_SECONDS + POSITION_OFFSET;
      const position2 = position1 + SEEK_MIN_DIFF_SECONDS + POSITION_OFFSET;

      // Verify test setup: positions are far enough apart that proximity won't block
      expect(position2 - position1).toBeGreaterThan(SEEK_MIN_DIFF_SECONDS);

      // First seek
      PositionHistory.record(state, position1);
      expect(state.positionHistory).toHaveLength(1);

      // Advance time but stay within debounce window
      vi.advanceTimersByTime(SEEK_DEBOUNCE_MS - 1000);

      // Second seek within debounce window - blocked by DEBOUNCE, not proximity
      PositionHistory.record(state, position2);

      // Should still have only the first position
      expect(state.positionHistory).toHaveLength(1);
      expect(state.positionHistory[0].time).toBe(position1);
    });

    it('saves second position after debounce window expires', () => {
      // Positions must be > SEEK_MIN_DIFF_SECONDS apart so we test debounce, not proximity
      const position1 = SEEK_MIN_DIFF_SECONDS + POSITION_OFFSET;
      const position2 = position1 + SEEK_MIN_DIFF_SECONDS + POSITION_OFFSET;

      // Verify test setup: positions are far enough apart that proximity won't block
      expect(position2 - position1).toBeGreaterThan(SEEK_MIN_DIFF_SECONDS);

      // First seek
      PositionHistory.record(state, position1);
      expect(state.positionHistory).toHaveLength(1);

      // Advance time past debounce window
      vi.advanceTimersByTime(SEEK_DEBOUNCE_MS + 1000);

      // Second seek after debounce window - should save (not blocked by debounce or proximity)
      PositionHistory.record(state, position2);

      // Should have both positions
      expect(state.positionHistory).toHaveLength(2);
      expect(state.positionHistory[0].time).toBe(position1);
      expect(state.positionHistory[1].time).toBe(position2);
    });

    describe('debounce window edge cases', () => {
      it('does NOT start debounce when save blocked due to load time proximity', () => {
        // Set load time position
        state.loadTimePosition = 100;

        // Try to record position too close to load time - should be blocked
        const tooCloseToLoadTime = 100 + SEEK_MIN_DIFF_SECONDS - 1;
        PositionHistory.record(state, tooCloseToLoadTime);
        expect(state.positionHistory).toHaveLength(0);

        // Immediately try another position far from load time
        // Should save because debounce window was NOT started
        const farFromLoadTime = 100 + SEEK_MIN_DIFF_SECONDS + 50;
        PositionHistory.record(state, farFromLoadTime);

        expect(state.positionHistory).toHaveLength(1);
        expect(state.positionHistory[0].time).toBe(farFromLoadTime);
      });

      it('does NOT start debounce when save blocked due to position below threshold', () => {
        // Try to record position below threshold - should be blocked
        const belowThreshold = SEEK_MIN_DIFF_SECONDS - 1;
        PositionHistory.record(state, belowThreshold);
        expect(state.positionHistory).toHaveLength(0);

        // Immediately try another valid position
        // Should save because debounce window was NOT started
        const validPosition = 100;
        PositionHistory.record(state, validPosition);

        expect(state.positionHistory).toHaveLength(1);
        expect(state.positionHistory[0].time).toBe(validPosition);
      });

      it('does NOT start debounce when save blocked due to existing position proximity', () => {
        // Save an initial position
        const existingPosition = 100;
        PositionHistory.save(state, existingPosition);
        expect(state.positionHistory).toHaveLength(1);

        // Advance past debounce window so we're not in an active debounce
        vi.advanceTimersByTime(SEEK_DEBOUNCE_MS + 1000);

        // Try to record position too close to existing - should be blocked
        const tooCloseToExisting = existingPosition + SEEK_MIN_DIFF_SECONDS - 1;
        PositionHistory.record(state, tooCloseToExisting);
        expect(state.positionHistory).toHaveLength(1); // Still just 1

        // Immediately try another position far from existing
        // Should save because debounce window was NOT started by the blocked save
        const farFromExisting = existingPosition + SEEK_MIN_DIFF_SECONDS + 50;
        PositionHistory.record(state, farFromExisting);

        expect(state.positionHistory).toHaveLength(2);
        expect(state.positionHistory[1].time).toBe(farFromExisting);
      });

      it('extends debounce window with each seek while actively seeking', () => {
        // Use positions that are explicitly far apart to test debounce, not proximity
        const position1 = SEEK_MIN_DIFF_SECONDS + 100;
        const position2 = position1 + SEEK_MIN_DIFF_SECONDS + 100;
        const position3 = position2 + SEEK_MIN_DIFF_SECONDS + 100;

        // Verify all positions are far enough apart
        expect(position2 - position1).toBeGreaterThan(SEEK_MIN_DIFF_SECONDS);
        expect(position3 - position2).toBeGreaterThan(SEEK_MIN_DIFF_SECONDS);

        // First seek
        PositionHistory.record(state, position1);
        expect(state.positionHistory).toHaveLength(1);

        // Multiple rapid seeks, each just before debounce would expire
        for (let i = 0; i < 5; i++) {
          vi.advanceTimersByTime(SEEK_DEBOUNCE_MS - 1000);
          PositionHistory.record(state, position2);
        }

        // Should still have only the first position (debounce kept extending)
        expect(state.positionHistory).toHaveLength(1);
        expect(state.positionHistory[0].time).toBe(position1);

        // Now wait for debounce to truly expire
        vi.advanceTimersByTime(SEEK_DEBOUNCE_MS + 1000);

        // New seek should save
        PositionHistory.record(state, position3);
        expect(state.positionHistory).toHaveLength(2);
        expect(state.positionHistory[1].time).toBe(position3);
      });

      it('handles scenario: seek from load time then rapid seeks', () => {
        // This tests the exact user scenario that was reported
        // 1. Video loads at some position
        // 2. User seeks away (position = load time, so blocked)
        // 3. User then seeks rapidly
        // 4. The position they seeked TO should be saved

        // Set load time - must be > SEEK_MIN_DIFF_SECONDS to be a valid load time
        const loadTime = SEEK_MIN_DIFF_SECONDS + 100;
        state.loadTimePosition = loadTime;

        // First seek from load time - blocked because position is too close to load time
        const loadTimeSeek = loadTime + SEEK_MIN_DIFF_SECONDS - 5;
        PositionHistory.record(state, loadTimeSeek);
        expect(state.positionHistory).toHaveLength(0);

        // User is now at a new position, they seek again
        // Position must be far from loadTime to not be blocked by proximity
        const newPosition = loadTime + SEEK_MIN_DIFF_SECONDS + 100;
        expect(newPosition - loadTime).toBeGreaterThan(SEEK_MIN_DIFF_SECONDS);

        // This should save because debounce was NOT started (previous save was blocked)
        PositionHistory.record(state, newPosition);
        expect(state.positionHistory).toHaveLength(1);
        expect(state.positionHistory[0].time).toBe(newPosition);

        // Rapid subsequent seeks should be debounced
        // Use positions far enough from newPosition so proximity doesn't block
        const rapidSeek1 = newPosition + SEEK_MIN_DIFF_SECONDS + 50;
        const rapidSeek2 = rapidSeek1 + SEEK_MIN_DIFF_SECONDS + 50;

        vi.advanceTimersByTime(1000);
        PositionHistory.record(state, rapidSeek1);
        expect(state.positionHistory).toHaveLength(1); // Debounced, not proximity blocked

        vi.advanceTimersByTime(1000);
        PositionHistory.record(state, rapidSeek2);
        expect(state.positionHistory).toHaveLength(1); // Still debounced
      });
    });
  });

  describe('race conditions and edge cases', () => {
    // Use positions explicitly calculated to exceed SEEK_MIN_DIFF_SECONDS
    const POSITION_OFFSET = 100;

    describe('debounce boundary timing', () => {
      it('save at exactly SEEK_DEBOUNCE_MS is still debounced (boundary inclusive)', () => {
        const position1 = SEEK_MIN_DIFF_SECONDS + POSITION_OFFSET;
        const position2 = position1 + SEEK_MIN_DIFF_SECONDS + POSITION_OFFSET;

        // Verify positions are far enough apart
        expect(position2 - position1).toBeGreaterThan(SEEK_MIN_DIFF_SECONDS);

        // First seek
        PositionHistory.record(state, position1);
        expect(state.positionHistory).toHaveLength(1);

        // Advance exactly SEEK_DEBOUNCE_MS (boundary condition)
        // The condition is: now - lastSeekTime <= SEEK_DEBOUNCE_MS
        // At exactly SEEK_DEBOUNCE_MS elapsed, the condition is TRUE (debounced)
        vi.advanceTimersByTime(SEEK_DEBOUNCE_MS);

        PositionHistory.record(state, position2);
        // At exactly the boundary, it's still within the window (<=)
        expect(state.positionHistory).toHaveLength(1);
      });

      it('save at SEEK_DEBOUNCE_MS + 1 is NOT debounced (just outside window)', () => {
        const position1 = SEEK_MIN_DIFF_SECONDS + POSITION_OFFSET;
        const position2 = position1 + SEEK_MIN_DIFF_SECONDS + POSITION_OFFSET;

        // Verify positions are far enough apart
        expect(position2 - position1).toBeGreaterThan(SEEK_MIN_DIFF_SECONDS);

        // First seek
        PositionHistory.record(state, position1);
        expect(state.positionHistory).toHaveLength(1);

        // Advance just past debounce window
        vi.advanceTimersByTime(SEEK_DEBOUNCE_MS + 1);

        PositionHistory.record(state, position2);
        // Just outside window - should save
        expect(state.positionHistory).toHaveLength(2);
        expect(state.positionHistory[1].time).toBe(position2);
      });

      it('save at SEEK_DEBOUNCE_MS - 1 is debounced (just inside window)', () => {
        const position1 = SEEK_MIN_DIFF_SECONDS + POSITION_OFFSET;
        const position2 = position1 + SEEK_MIN_DIFF_SECONDS + POSITION_OFFSET;

        // Verify positions are far enough apart
        expect(position2 - position1).toBeGreaterThan(SEEK_MIN_DIFF_SECONDS);

        // First seek
        PositionHistory.record(state, position1);
        expect(state.positionHistory).toHaveLength(1);

        // Advance just before debounce window expires
        vi.advanceTimersByTime(SEEK_DEBOUNCE_MS - 1);

        PositionHistory.record(state, position2);
        // Just inside window - should be debounced
        expect(state.positionHistory).toHaveLength(1);
      });
    });

    describe('concurrent saves at same timestamp', () => {
      it('multiple saves at exact same timestamp - first saves, rest debounced', () => {
        const position1 = SEEK_MIN_DIFF_SECONDS + POSITION_OFFSET;
        const position2 = position1 + SEEK_MIN_DIFF_SECONDS + POSITION_OFFSET;
        const position3 = position2 + SEEK_MIN_DIFF_SECONDS + POSITION_OFFSET;

        // All positions are far enough apart for proximity
        expect(position2 - position1).toBeGreaterThan(SEEK_MIN_DIFF_SECONDS);
        expect(position3 - position2).toBeGreaterThan(SEEK_MIN_DIFF_SECONDS);

        // All three records at the same timestamp (time 0)
        PositionHistory.record(state, position1);
        PositionHistory.record(state, position2);
        PositionHistory.record(state, position3);

        // Only first should be saved - others debounced by the first save's window
        expect(state.positionHistory).toHaveLength(1);
        expect(state.positionHistory[0].time).toBe(position1);
      });

      it('rapid saves extend debounce window correctly', () => {
        const basePosition = SEEK_MIN_DIFF_SECONDS + POSITION_OFFSET;

        // Save first position
        PositionHistory.record(state, basePosition);
        expect(state.positionHistory).toHaveLength(1);

        // Simulate rapid seeking - each at different timestamp but within debounce
        for (let i = 1; i <= 10; i++) {
          vi.advanceTimersByTime(100); // 100ms between each
          const newPosition = basePosition + i * (SEEK_MIN_DIFF_SECONDS + 10);
          PositionHistory.record(state, newPosition);
        }

        // All should be debounced because each extends the window
        expect(state.positionHistory).toHaveLength(1);

        // Total time elapsed: 1000ms (10 * 100ms)
        // Last seek extended window to 1000ms, need to wait SEEK_DEBOUNCE_MS more
        vi.advanceTimersByTime(SEEK_DEBOUNCE_MS + 1);

        // Now a new save should work
        const finalPosition = basePosition + 15 * (SEEK_MIN_DIFF_SECONDS + 10);
        PositionHistory.record(state, finalPosition);
        expect(state.positionHistory).toHaveLength(2);
      });
    });

    describe('keyboard seek flag interaction', () => {
      it('isKeyboardOrButtonSeek flag state is independent of debounce', () => {
        const position1 = SEEK_MIN_DIFF_SECONDS + POSITION_OFFSET;
        const position2 = position1 + SEEK_MIN_DIFF_SECONDS + POSITION_OFFSET;

        // Record first position (simulates keyboard seek)
        state.isKeyboardOrButtonSeek = true;
        PositionHistory.record(state, position1);
        expect(state.positionHistory).toHaveLength(1);

        // Flag should remain true (not modified by record)
        expect(state.isKeyboardOrButtonSeek).toBe(true);

        // Advance past debounce
        vi.advanceTimersByTime(SEEK_DEBOUNCE_MS + 1);

        // Record again with flag still true
        PositionHistory.record(state, position2);
        expect(state.positionHistory).toHaveLength(2);

        // Flag still not modified
        expect(state.isKeyboardOrButtonSeek).toBe(true);
      });

      it('record does not modify isKeyboardOrButtonSeek flag', () => {
        const position = SEEK_MIN_DIFF_SECONDS + POSITION_OFFSET;

        // Start with flag false
        expect(state.isKeyboardOrButtonSeek).toBe(false);
        PositionHistory.record(state, position);
        expect(state.isKeyboardOrButtonSeek).toBe(false);

        // Set flag true
        state.isKeyboardOrButtonSeek = true;
        vi.advanceTimersByTime(SEEK_DEBOUNCE_MS + 1);

        const position2 = position + SEEK_MIN_DIFF_SECONDS + POSITION_OFFSET;
        PositionHistory.record(state, position2);
        expect(state.isKeyboardOrButtonSeek).toBe(true);
      });
    });

    describe('state consistency under stress', () => {
      it('lastSeekTime is only updated on successful save or debounce extension', () => {
        const position = SEEK_MIN_DIFF_SECONDS + POSITION_OFFSET;
        const initialLastSeekTime = state.lastSeekTime;

        // Blocked save (below threshold) should NOT update lastSeekTime
        PositionHistory.record(state, SEEK_MIN_DIFF_SECONDS - 1);
        expect(state.lastSeekTime).toBe(initialLastSeekTime);
        expect(state.positionHistory).toHaveLength(0);

        // Valid save should update lastSeekTime
        PositionHistory.record(state, position);
        const timeAfterFirstSave = state.lastSeekTime;
        expect(timeAfterFirstSave).not.toBe(initialLastSeekTime);
        expect(state.positionHistory).toHaveLength(1);

        // Advance time
        vi.advanceTimersByTime(1000);

        // Debounced save should update lastSeekTime (extends window)
        const position2 = position + SEEK_MIN_DIFF_SECONDS + POSITION_OFFSET;
        PositionHistory.record(state, position2);
        expect(state.lastSeekTime).toBe(timeAfterFirstSave + 1000); // Updated to current time
        expect(state.positionHistory).toHaveLength(1); // Still just 1
      });

      it('blocked saves do not corrupt state', () => {
        // Fill history to max
        const baseTime = SEEK_MIN_DIFF_SECONDS + POSITION_OFFSET;
        for (let i = 0; i < SEEK_MAX_HISTORY; i++) {
          PositionHistory.save(state, baseTime + i * (SEEK_MIN_DIFF_SECONDS + 10));
        }
        expect(state.positionHistory).toHaveLength(SEEK_MAX_HISTORY);

        const originalHistory = [...state.positionHistory];

        // Wait for debounce to expire
        vi.advanceTimersByTime(SEEK_DEBOUNCE_MS + 1);

        // Try multiple blocked saves (too close to existing)
        for (let i = 0; i < SEEK_MAX_HISTORY; i++) {
          const tooClose = state.positionHistory[i].time + 1;
          PositionHistory.record(state, tooClose);
        }

        // History should be unchanged
        expect(state.positionHistory).toHaveLength(SEEK_MAX_HISTORY);
        expect(state.positionHistory.map((e) => e.time)).toEqual(
          originalHistory.map((e) => e.time)
        );
      });
    });
  });

  describe('getPositions', () => {
    it('returns empty array when no positions', () => {
      const positions = PositionHistory.getPositions(state);
      expect(positions).toHaveLength(0);
    });

    it('includes load time position first when available', () => {
      state.loadTimePosition = 120;
      PositionHistory.save(state, 200);

      const positions = PositionHistory.getPositions(state);

      expect(positions).toHaveLength(2);
      expect(positions[0].isLoadTime).toBe(true);
      expect(positions[0].time).toBe(120);
      expect(positions[1].isLoadTime).toBe(false);
      expect(positions[1].time).toBe(200);
    });

    it('does NOT include load time position below threshold', () => {
      state.loadTimePosition = SEEK_MIN_DIFF_SECONDS - 1;

      const positions = PositionHistory.getPositions(state);
      expect(positions).toHaveLength(0);
    });

    it('returns history positions in reverse order (most recent first)', () => {
      const times = [100, 150, 200];
      times.forEach((t) => PositionHistory.save(state, t));

      const positions = PositionHistory.getPositions(state);

      // History positions should be reversed
      expect(positions[0].time).toBe(200);
      expect(positions[1].time).toBe(150);
      expect(positions[2].time).toBe(100);
    });
  });
});
