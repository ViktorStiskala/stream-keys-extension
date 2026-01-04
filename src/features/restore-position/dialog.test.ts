import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import {
  PositionHistory,
  POSITION_HISTORY_CHANGED_EVENT,
  SEEK_MIN_DIFF_SECONDS,
  type PositionHistoryState,
} from './history';

// Mock modules
vi.mock('@/core/settings', () => ({
  Settings: {
    isPositionHistoryEnabled: vi.fn(() => true),
  },
}));

vi.mock('@/ui/banner', () => ({
  Banner: {
    show: vi.fn(),
  },
}));

describe('Position History Events', () => {
  let state: PositionHistoryState;
  let eventListener: EventListener;
  let mockFn: Mock;

  beforeEach(() => {
    state = PositionHistory.createState();
    mockFn = vi.fn();
    eventListener = mockFn as unknown as EventListener;
    window.addEventListener(POSITION_HISTORY_CHANGED_EVENT, eventListener);
  });

  afterEach(() => {
    window.removeEventListener(POSITION_HISTORY_CHANGED_EVENT, eventListener);
  });

  describe('event emission on mutations', () => {
    it('emits event when position is saved to history', () => {
      const position = SEEK_MIN_DIFF_SECONDS + 100;
      PositionHistory.save(state, position);

      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn.mock.calls[0][0].type).toBe(POSITION_HISTORY_CHANGED_EVENT);
    });

    it('does NOT emit event when save is blocked (position too short)', () => {
      const position = SEEK_MIN_DIFF_SECONDS - 1;
      PositionHistory.save(state, position);

      expect(mockFn).not.toHaveBeenCalled();
    });

    it('does NOT emit event when save is blocked (too close to existing)', () => {
      // First save
      const position1 = SEEK_MIN_DIFF_SECONDS + 100;
      PositionHistory.save(state, position1);
      mockFn.mockClear();

      // Second save too close
      const position2 = position1 + SEEK_MIN_DIFF_SECONDS - 1;
      PositionHistory.save(state, position2);

      expect(mockFn).not.toHaveBeenCalled();
    });

    it('emits event when user position is saved (S key)', () => {
      const position = 50; // Any position, S key always saves
      PositionHistory.saveUserPosition(state, position);

      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('emits event when user position is overwritten', () => {
      PositionHistory.saveUserPosition(state, 50);
      mockFn.mockClear();

      PositionHistory.saveUserPosition(state, 100);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('emits event when state is reset (video change)', () => {
      // Add some data first
      state.loadTimePosition = 100;
      PositionHistory.save(state, SEEK_MIN_DIFF_SECONDS + 200);
      mockFn.mockClear();

      PositionHistory.reset(state);

      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('S key (saveUserPosition) behavior', () => {
    it('always saves regardless of position being below threshold', () => {
      const veryShortPosition = 5; // Less than SEEK_MIN_DIFF_SECONDS
      const result = PositionHistory.saveUserPosition(state, veryShortPosition);

      expect(result).not.toBeNull();
      expect(state.userSavedPosition?.time).toBe(veryShortPosition);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('always saves even when close to load time', () => {
      state.loadTimePosition = 100;
      const closeToLoadTime = 105; // Very close to load time

      const result = PositionHistory.saveUserPosition(state, closeToLoadTime);

      expect(result).not.toBeNull();
      expect(state.userSavedPosition?.time).toBe(closeToLoadTime);
    });

    it('always saves even when close to history positions', () => {
      // Save a position to history
      const historyPosition = SEEK_MIN_DIFF_SECONDS + 100;
      PositionHistory.save(state, historyPosition);
      mockFn.mockClear();

      // S key save very close to it
      const closePosition = historyPosition + 1;
      const result = PositionHistory.saveUserPosition(state, closePosition);

      expect(result).not.toBeNull();
      expect(state.userSavedPosition?.time).toBe(closePosition);
    });

    it('overwrites previous user saved position', () => {
      PositionHistory.saveUserPosition(state, 50);
      PositionHistory.saveUserPosition(state, 100);

      expect(state.userSavedPosition?.time).toBe(100);
    });
  });

  describe('automatic saves check user saved position', () => {
    it('does NOT save history position too close to user saved position', () => {
      // First, user saves a position
      PositionHistory.saveUserPosition(state, 100);
      mockFn.mockClear();

      // Try to auto-save too close to user saved
      const tooClose = 100 + SEEK_MIN_DIFF_SECONDS - 1;
      PositionHistory.save(state, tooClose);

      expect(state.positionHistory).toHaveLength(0);
      expect(mockFn).not.toHaveBeenCalled();
    });

    it('saves history position far enough from user saved position', () => {
      // First, user saves a position
      PositionHistory.saveUserPosition(state, 100);
      mockFn.mockClear();

      // Auto-save far enough from user saved
      const farEnough = 100 + SEEK_MIN_DIFF_SECONDS + 1;
      PositionHistory.save(state, farEnough);

      expect(state.positionHistory).toHaveLength(1);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('getPositions order', () => {
    it('returns positions in correct order: load time, user saved, history', () => {
      // Set up all position types
      state.loadTimePosition = SEEK_MIN_DIFF_SECONDS + 50;
      PositionHistory.saveUserPosition(state, 200);
      PositionHistory.save(state, 300);
      PositionHistory.save(state, 400);

      const positions = PositionHistory.getPositions(state);

      expect(positions).toHaveLength(4);
      expect(positions[0].isLoadTime).toBe(true);
      expect(positions[0].time).toBe(state.loadTimePosition);
      expect(positions[1].isUserSaved).toBe(true);
      expect(positions[1].time).toBe(200);
      // History is reversed (most recent first)
      expect(positions[2].time).toBe(400);
      expect(positions[3].time).toBe(300);
    });

    it('user saved position has correct metadata', () => {
      PositionHistory.saveUserPosition(state, 100);

      const positions = PositionHistory.getPositions(state);

      expect(positions).toHaveLength(1);
      expect(positions[0].isUserSaved).toBe(true);
      expect(positions[0].isLoadTime).toBe(false);
      expect(positions[0].relativeText).toBe('saved position');
    });
  });

  describe('key numbering', () => {
    it('user saved position is always key 1, even without load time', () => {
      // No load time, only user saved
      PositionHistory.saveUserPosition(state, 100);

      const positions = PositionHistory.getPositions(state);

      expect(positions).toHaveLength(1);
      expect(positions[0].isUserSaved).toBe(true);
      // Key 0 is reserved for load time, user saved should be at index 0
      // but when rendered, it gets key 1 (tested in dialog rendering)
    });

    it('history starts at key 2 when user saved exists', () => {
      state.loadTimePosition = SEEK_MIN_DIFF_SECONDS + 50;
      PositionHistory.saveUserPosition(state, 100);
      PositionHistory.save(state, 200);

      const positions = PositionHistory.getPositions(state);

      // Order: load time (key 0), user saved (key 1), history (key 2+)
      expect(positions).toHaveLength(3);
      expect(positions[0].isLoadTime).toBe(true);
      expect(positions[1].isUserSaved).toBe(true);
      expect(positions[2].isLoadTime).toBe(false);
      expect(positions[2].isUserSaved).toBe(false);
    });

    it('history starts at key 1 when no user saved position', () => {
      state.loadTimePosition = SEEK_MIN_DIFF_SECONDS + 50;
      PositionHistory.save(state, 200);

      const positions = PositionHistory.getPositions(state);

      // Order: load time (key 0), history (key 1+)
      expect(positions).toHaveLength(2);
      expect(positions[0].isLoadTime).toBe(true);
      expect(positions[1].isLoadTime).toBe(false);
      expect(positions[1].isUserSaved).toBe(false);
    });
  });

  describe('video change scenarios', () => {
    it('reset clears all positions and emits event', () => {
      // Set up data
      state.loadTimePosition = 100;
      PositionHistory.saveUserPosition(state, 200);
      PositionHistory.save(state, SEEK_MIN_DIFF_SECONDS + 300);
      mockFn.mockClear();

      // Reset (simulates video change)
      PositionHistory.reset(state);

      expect(state.loadTimePosition).toBeNull();
      expect(state.userSavedPosition).toBeNull();
      expect(state.positionHistory).toHaveLength(0);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('getPositions returns empty after reset', () => {
      state.loadTimePosition = 100;
      PositionHistory.saveUserPosition(state, 200);
      PositionHistory.reset(state);

      const positions = PositionHistory.getPositions(state);
      expect(positions).toHaveLength(0);
    });
  });
});

describe('Position History Event Constant', () => {
  it('exports the correct event name', () => {
    expect(POSITION_HISTORY_CHANGED_EVENT).toBe('streamkeys:position-history-changed');
  });
});
