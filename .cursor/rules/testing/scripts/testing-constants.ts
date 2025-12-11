import {
  SEEK_MIN_DIFF_SECONDS,
  SEEK_DEBOUNCE_MS,
  SEEK_MAX_HISTORY,
} from './history';

// Use constants in test cases
it('does NOT save position below threshold', () => {
  PositionHistory.save(state, SEEK_MIN_DIFF_SECONDS - 5);
  expect(state.positionHistory).toHaveLength(0);
});
