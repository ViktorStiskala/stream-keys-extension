// Restore Position dialog DOM creation

import type { RestorePosition } from '../history';
import { Styles } from '@/ui/styles/variables';
import { DialogStyles } from './styles';

// __DEV__ is defined by vite config based on isWatch
declare const __DEV__: boolean;

// DOM element IDs and classes
export const DIALOG_ID = 'streamkeys-restore-dialog';
export const CURRENT_TIME_ID = 'streamkeys-current-time';
export const RELATIVE_TIME_CLASS = 'streamkeys-relative-time';

/** Callback type for position item click */
export type PositionClickHandler = (pos: RestorePosition) => void;

/** Return type for createDialogDOM - element references needed by controller */
export interface DialogElements {
  container: HTMLDivElement;
  list: HTMLDivElement;
  hint: HTMLDivElement;
  currentTimeValue: HTMLSpanElement;
}

/**
 * Create a position item button
 */
export function createPositionItem(
  keyNumber: number,
  pos: RestorePosition,
  videoDuration: number,
  onClick: () => void,
  debugAction?: (action: string, detail: string) => void
): HTMLButtonElement {
  const item = document.createElement('button');

  // Use green styling for user saved position
  if (pos.isUserSaved) {
    item.style.cssText = DialogStyles.positionItemUserSaved;
    item.onmouseenter = () => (item.style.background = Styles.vars.accent.greenHover);
    item.onmouseleave = () => (item.style.background = Styles.vars.accent.green);
  } else {
    item.style.cssText = DialogStyles.positionItem;
    item.onmouseenter = () => (item.style.background = Styles.vars.overlay.bgHover);
    item.onmouseleave = () => (item.style.background = Styles.vars.overlay.bgActive);
  }

  // Key hint
  const keyHint = document.createElement('span');
  keyHint.textContent = `${keyNumber}`;
  keyHint.style.cssText = DialogStyles.keyHint;

  // Time label
  const timeLabel = document.createElement('span');
  timeLabel.textContent = pos.label;
  timeLabel.style.cssText = DialogStyles.timeLabel;

  // Relative time
  const relativeTime = document.createElement('span');
  if (pos.isLoadTime || pos.isUserSaved) {
    // Static text for load time and user saved positions
    relativeTime.textContent = pos.relativeText as string;
  } else {
    // Dynamic relative time for history positions
    relativeTime.className = RELATIVE_TIME_CLASS;
    relativeTime.dataset.savedAt = String(pos.relativeText);
  }
  relativeTime.style.cssText = DialogStyles.relativeTime;

  // Progress bar
  const progressBar = document.createElement('div');
  const progressPercent = videoDuration > 0 ? (pos.time / videoDuration) * 100 : 0;
  progressBar.style.cssText = DialogStyles.progressBar;

  const progressFill = document.createElement('div');
  progressFill.style.cssText = DialogStyles.progressFill;
  progressFill.style.width = `${progressPercent}%`;
  progressBar.appendChild(progressFill);

  item.appendChild(keyHint);
  item.appendChild(timeLabel);
  item.appendChild(relativeTime);
  item.appendChild(progressBar);

  item.onclick = (e) => {
    if (__DEV__ && debugAction) debugAction(`UI: Position ${keyNumber} clicked`, pos.label);
    e.preventDefault();
    e.stopPropagation();
    onClick();
  };

  return item;
}

/**
 * Build the position list inside the dialog.
 * Can be called for initial render or to rebuild on position changes.
 * @returns maxKey for updating hint text
 */
export function buildPositionList(
  listElement: HTMLDivElement,
  positions: RestorePosition[],
  videoDuration: number,
  onSelectPosition: PositionClickHandler,
  debugAction?: (action: string, detail: string) => void
): number {
  // Clear existing items
  listElement.innerHTML = '';

  const hasUserSaved = positions.some((pos) => pos.isUserSaved);
  const hasHistoryItems = positions.some((pos) => !pos.isLoadTime && !pos.isUserSaved);

  // Key numbering: load time = 0 (reserved), user saved = 1 (reserved), history continues from there
  const historyStartKey = hasUserSaved ? 2 : 1;
  let historyKeyNumber = historyStartKey;

  positions.forEach((pos) => {
    // Determine key number based on position type
    let keyNumber: number;
    if (pos.isLoadTime) {
      keyNumber = 0;
    } else if (pos.isUserSaved) {
      keyNumber = 1;
    } else {
      keyNumber = historyKeyNumber++;
    }

    const item = createPositionItem(
      keyNumber,
      pos,
      videoDuration,
      () => {
        onSelectPosition(pos);
      },
      debugAction
    );
    listElement.appendChild(item);

    // Add separator after load time if there are other items (user saved or history)
    if (pos.isLoadTime && (hasUserSaved || hasHistoryItems)) {
      const separator = document.createElement('div');
      separator.style.cssText = DialogStyles.separator;
      listElement.appendChild(separator);
    }
  });

  // Calculate max key
  const historyCount = positions.filter((pos) => !pos.isLoadTime && !pos.isUserSaved).length;
  const maxKey = historyCount > 0 ? historyStartKey + historyCount - 1 : hasUserSaved ? 1 : 0;

  return maxKey;
}

/**
 * Update the hint text based on max key
 */
export function updateHintText(hintElement: HTMLDivElement, maxKey: number): void {
  hintElement.textContent =
    maxKey === 0
      ? 'Press 0 to select, Esc or R to close'
      : `Press 0-${maxKey} to select, Esc or R to close`;
}

/**
 * Create the dialog DOM structure.
 * Returns element references needed by the controller for updates and event handling.
 */
export function createDialogDOM(
  onClose: () => void,
  debugAction?: (action: string, detail: string) => void
): DialogElements {
  const container = document.createElement('div');
  container.id = DIALOG_ID;
  container.style.cssText = DialogStyles.container;

  // Header
  const header = document.createElement('div');
  header.style.cssText = DialogStyles.header;

  const title = document.createElement('div');
  title.textContent = 'Restore Position';
  title.style.cssText = DialogStyles.title;

  const closeButton = document.createElement('button');
  closeButton.textContent = '×';
  closeButton.style.cssText = DialogStyles.closeButton;
  closeButton.onmouseenter = () => (closeButton.style.color = Styles.vars.text.primary);
  closeButton.onmouseleave = () => (closeButton.style.color = Styles.vars.text.secondary);
  closeButton.onclick = (e) => {
    if (__DEV__ && debugAction) debugAction('UI: Close button', 'restore dialog');
    e.preventDefault();
    e.stopPropagation();
    onClose();
  };

  header.appendChild(title);
  header.appendChild(closeButton);
  container.appendChild(header);

  // Current time display
  const currentTimeContainer = document.createElement('div');
  currentTimeContainer.style.cssText = DialogStyles.currentTimeContainer;

  const currentTimeLabel = document.createElement('span');
  currentTimeLabel.textContent = 'Current time';
  currentTimeLabel.style.cssText = DialogStyles.currentTimeLabel;

  const currentTimeValue = document.createElement('span');
  currentTimeValue.id = CURRENT_TIME_ID;
  currentTimeValue.style.cssText = DialogStyles.currentTimeValue;

  currentTimeContainer.appendChild(currentTimeLabel);
  currentTimeContainer.appendChild(currentTimeValue);
  container.appendChild(currentTimeContainer);

  // Position list
  const list = document.createElement('div');
  list.style.cssText = DialogStyles.list;
  container.appendChild(list);

  // Hint text
  const hint = document.createElement('div');
  hint.style.cssText = DialogStyles.hint;
  container.appendChild(hint);

  return { container, list, hint, currentTimeValue };
}
