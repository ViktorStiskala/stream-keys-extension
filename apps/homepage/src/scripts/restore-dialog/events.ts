// Custom Event Dispatchers

export const EVENTS = {
  TIME_UPDATE: "streamkeys:timeupdate",
  HISTORY_CHANGE: "streamkeys:historychange",
  CLOSE_DIALOG: "streamkeys:closedialog",
} as const;

/**
 * Dispatch time update event (for progress bar and time displays)
 */
export function dispatchTimeUpdate(
  currentTime: number,
  duration: number,
): void {
  window.dispatchEvent(
    new CustomEvent(EVENTS.TIME_UPDATE, {
      detail: { currentTime, duration },
    }),
  );
}

/**
 * Dispatch history change event (for position list updates)
 */
export function dispatchHistoryChange(): void {
  window.dispatchEvent(new CustomEvent(EVENTS.HISTORY_CHANGE));
}

/**
 * Dispatch close dialog event
 */
export function dispatchCloseDialog(): void {
  window.dispatchEvent(new CustomEvent(EVENTS.CLOSE_DIALOG));
}
