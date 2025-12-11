// Settings page - manages subtitle language preferences and position history

import browser from 'webextension-polyfill';

const STORAGE_KEY = 'subtitleLanguages';
const POSITION_HISTORY_KEY = 'positionHistoryEnabled';
const DEFAULT_LANGUAGES = ['English', 'English [CC]', 'English CC'];
const DEFAULT_POSITION_HISTORY = true;

// Use storage.local as fallback if storage.sync fails (Firefox temporary add-ons)
async function getStorage(): Promise<typeof browser.storage.sync> {
  try {
    // Test if sync works by doing a simple get
    await browser.storage.sync.get(null);
    return browser.storage.sync;
  } catch {
    console.warn('[StreamKeys] storage.sync unavailable, using storage.local');
    return browser.storage.local;
  }
}

// Cache the storage area to avoid repeated tests
let storageArea: typeof browser.storage.sync | null = null;
async function storage(): Promise<typeof browser.storage.sync> {
  if (!storageArea) {
    storageArea = await getStorage();
  }
  return storageArea;
}

let languages: string[] = [];
let draggedIndex: number | null = null;

// DOM elements - will be initialized after DOM is ready
let languageInput: HTMLInputElement;
let addButton: HTMLButtonElement;
let languageList: HTMLUListElement;
let restoreDefaultsButton: HTMLButtonElement;
let positionHistoryToggle: HTMLInputElement;

/**
 * Load preferences from storage
 */
async function loadPreferences(): Promise<void> {
  try {
    const store = await storage();
    const result = await store.get([STORAGE_KEY, POSITION_HISTORY_KEY]);
    languages = (result[STORAGE_KEY] as string[] | undefined) || [...DEFAULT_LANGUAGES];

    const positionHistoryEnabled =
      result[POSITION_HISTORY_KEY] !== undefined
        ? (result[POSITION_HISTORY_KEY] as boolean)
        : DEFAULT_POSITION_HISTORY;
    positionHistoryToggle.checked = positionHistoryEnabled;

    renderList();
  } catch (error) {
    console.error('[StreamKeys] Failed to load preferences:', error);
    // Fall back to defaults on error
    languages = [...DEFAULT_LANGUAGES];
    positionHistoryToggle.checked = DEFAULT_POSITION_HISTORY;
    renderList();
  }
}

/**
 * Save preferences to storage
 */
async function savePreferences(): Promise<void> {
  try {
    const store = await storage();
    await store.set({ [STORAGE_KEY]: languages });
  } catch (error) {
    console.error('[StreamKeys] Failed to save preferences:', error);
  }
}

/**
 * Save position history setting
 */
async function savePositionHistorySetting(): Promise<void> {
  try {
    const store = await storage();
    await store.set({ [POSITION_HISTORY_KEY]: positionHistoryToggle.checked });
  } catch (error) {
    console.error('[StreamKeys] Failed to save position history setting:', error);
  }
}

/**
 * Render the language list
 */
function renderList(): void {
  languageList.innerHTML = '';

  languages.forEach((language, index) => {
    const li = document.createElement('li');
    li.className = 'language-item';
    li.draggable = true;
    li.dataset.index = String(index);

    // Drag handle
    const handle = document.createElement('span');
    handle.className = 'drag-handle';
    handle.innerHTML = '⋮⋮';
    handle.title = 'Drag to reorder';

    // Language text
    const text = document.createElement('span');
    text.className = 'language-text';
    text.textContent = language;

    // Remove button
    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-button';
    removeBtn.innerHTML = '×';
    removeBtn.title = 'Remove';
    removeBtn.addEventListener('click', () => removeLanguage(index));

    li.appendChild(handle);
    li.appendChild(text);
    li.appendChild(removeBtn);

    // Drag events
    li.addEventListener('dragstart', handleDragStart);
    li.addEventListener('dragend', handleDragEnd);
    li.addEventListener('dragover', handleDragOver);
    li.addEventListener('drop', handleDrop);
    li.addEventListener('dragenter', handleDragEnter);
    li.addEventListener('dragleave', handleDragLeave);

    languageList.appendChild(li);
  });
}

/**
 * Add a new language
 */
function addLanguage(): void {
  const value = languageInput.value.trim();
  if (!value) return;

  // Check for duplicates (case insensitive)
  const exists = languages.some((lang) => lang.toLowerCase() === value.toLowerCase());
  if (exists) {
    languageInput.select();
    return;
  }

  languages.push(value);
  languageInput.value = '';
  savePreferences();
  renderList();
  languageInput.focus();
}

/**
 * Remove a language
 */
function removeLanguage(index: number): void {
  languages.splice(index, 1);
  savePreferences();
  renderList();
}

// Drag and drop handlers
function handleDragStart(e: DragEvent): void {
  const target = e.target as HTMLElement;
  draggedIndex = parseInt(target.dataset.index || '0');
  target.classList.add('dragging');
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move';
  }
}

function handleDragEnd(e: DragEvent): void {
  const target = e.target as HTMLElement;
  target.classList.remove('dragging');
  document.querySelectorAll('.language-item').forEach((item) => {
    item.classList.remove('drag-over');
  });
  draggedIndex = null;
}

function handleDragOver(e: DragEvent): void {
  e.preventDefault();
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'move';
  }
}

function handleDragEnter(e: DragEvent): void {
  e.preventDefault();
  const item = (e.target as HTMLElement).closest('.language-item') as HTMLElement | null;
  if (item && parseInt(item.dataset.index || '0') !== draggedIndex) {
    item.classList.add('drag-over');
  }
}

function handleDragLeave(e: DragEvent): void {
  const item = (e.target as HTMLElement).closest('.language-item') as HTMLElement | null;
  if (item) {
    item.classList.remove('drag-over');
  }
}

function handleDrop(e: DragEvent): void {
  e.preventDefault();
  const item = (e.target as HTMLElement).closest('.language-item') as HTMLElement | null;
  if (!item) return;

  const dropIndex = parseInt(item.dataset.index || '0');
  if (draggedIndex === null || draggedIndex === dropIndex) return;

  // Reorder the array
  const [removed] = languages.splice(draggedIndex, 1);
  languages.splice(dropIndex, 0, removed);

  savePreferences();
  renderList();
}

/**
 * Restore defaults
 */
function restoreDefaults(): void {
  languages = [...DEFAULT_LANGUAGES];
  savePreferences();
  renderList();
}

/**
 * Initialize the settings page
 */
function init(): void {
  // Get DOM elements
  languageInput = document.getElementById('language-input') as HTMLInputElement;
  addButton = document.getElementById('add-button') as HTMLButtonElement;
  languageList = document.getElementById('language-list') as HTMLUListElement;
  restoreDefaultsButton = document.getElementById('restore-defaults-button') as HTMLButtonElement;
  positionHistoryToggle = document.getElementById('position-history-toggle') as HTMLInputElement;

  // Event listeners
  addButton.addEventListener('click', addLanguage);
  restoreDefaultsButton.addEventListener('click', restoreDefaults);
  languageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      addLanguage();
    }
  });
  positionHistoryToggle.addEventListener('change', savePositionHistorySetting);

  // Load preferences
  loadPreferences();
}

// Internal API (for testing/debugging)
export const SettingsPage = {
  loadPreferences,
  savePreferences,
  renderList,
  addLanguage,
  removeLanguage,
  restoreDefaults,
  init,
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
