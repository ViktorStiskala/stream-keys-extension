// Settings page - manages subtitle language preferences and position history

import browser from 'webextension-polyfill';
import type { ServiceId } from '@/types';
import {
  DEFAULT_LANGUAGES,
  DEFAULT_POSITION_HISTORY,
  DEFAULT_CAPTURE_MEDIA_KEYS,
  DEFAULT_CUSTOM_SEEK_ENABLED,
  DEFAULT_SEEK_TIME,
  DEFAULT_ENABLED_SERVICES,
  SERVICE_HANDLERS,
} from '@/types';

const STORAGE_KEY = 'subtitleLanguages';
const POSITION_HISTORY_KEY = 'positionHistoryEnabled';
const CAPTURE_MEDIA_KEYS_KEY = 'captureMediaKeys';
const CUSTOM_SEEK_ENABLED_KEY = 'customSeekEnabled';
const SEEK_TIME_KEY = 'seekTime';
const ENABLED_SERVICES_KEY = 'enabledServices';

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
let enabledServices: Record<ServiceId, boolean> = { ...DEFAULT_ENABLED_SERVICES };

// DOM elements - will be initialized after DOM is ready
let servicesList: HTMLDivElement;
let languageInput: HTMLInputElement;
let addButton: HTMLButtonElement;
let languageList: HTMLUListElement;
let restoreDefaultsButton: HTMLButtonElement;
let positionHistoryToggle: HTMLInputElement;
let captureMediaKeysToggle: HTMLInputElement;
let customSeekToggle: HTMLInputElement;
let seekTimeInput: HTMLInputElement;
let seekTimeSuffix: HTMLSpanElement;

/**
 * Load preferences from storage
 */
async function loadPreferences(): Promise<void> {
  try {
    const store = await storage();
    const result = await store.get([
      STORAGE_KEY,
      POSITION_HISTORY_KEY,
      CAPTURE_MEDIA_KEYS_KEY,
      CUSTOM_SEEK_ENABLED_KEY,
      SEEK_TIME_KEY,
    ]);
    languages = (result[STORAGE_KEY] as string[] | undefined) || [...DEFAULT_LANGUAGES];

    const positionHistoryEnabled =
      result[POSITION_HISTORY_KEY] !== undefined
        ? (result[POSITION_HISTORY_KEY] as boolean)
        : DEFAULT_POSITION_HISTORY;
    positionHistoryToggle.checked = positionHistoryEnabled;

    const captureMediaKeys =
      result[CAPTURE_MEDIA_KEYS_KEY] !== undefined
        ? (result[CAPTURE_MEDIA_KEYS_KEY] as boolean)
        : DEFAULT_CAPTURE_MEDIA_KEYS;
    captureMediaKeysToggle.checked = captureMediaKeys;

    const customSeekEnabled =
      result[CUSTOM_SEEK_ENABLED_KEY] !== undefined
        ? (result[CUSTOM_SEEK_ENABLED_KEY] as boolean)
        : DEFAULT_CUSTOM_SEEK_ENABLED;
    customSeekToggle.checked = customSeekEnabled;

    const seekTime =
      result[SEEK_TIME_KEY] !== undefined ? (result[SEEK_TIME_KEY] as number) : DEFAULT_SEEK_TIME;
    seekTimeInput.value = String(seekTime);

    updateSeekTimeRowState();
    renderList();
  } catch (error) {
    console.error('[StreamKeys] Failed to load preferences:', error);
    // Fall back to defaults on error
    languages = [...DEFAULT_LANGUAGES];
    positionHistoryToggle.checked = DEFAULT_POSITION_HISTORY;
    captureMediaKeysToggle.checked = DEFAULT_CAPTURE_MEDIA_KEYS;
    customSeekToggle.checked = DEFAULT_CUSTOM_SEEK_ENABLED;
    seekTimeInput.value = String(DEFAULT_SEEK_TIME);
    updateSeekTimeRowState();
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
 * Save capture media keys setting
 */
async function saveCaptureMediaKeysSetting(): Promise<void> {
  try {
    const store = await storage();
    await store.set({ [CAPTURE_MEDIA_KEYS_KEY]: captureMediaKeysToggle.checked });
  } catch (error) {
    console.error('[StreamKeys] Failed to save capture media keys setting:', error);
  }
}

/**
 * Save custom seek enabled setting
 */
async function saveCustomSeekEnabledSetting(): Promise<void> {
  try {
    const store = await storage();
    await store.set({ [CUSTOM_SEEK_ENABLED_KEY]: customSeekToggle.checked });
    updateSeekTimeRowState();
  } catch (error) {
    console.error('[StreamKeys] Failed to save custom seek enabled setting:', error);
  }
}

/**
 * Save seek time setting
 */
async function saveSeekTimeSetting(): Promise<void> {
  try {
    const store = await storage();
    const value = parseInt(seekTimeInput.value, 10);
    if (!isNaN(value) && value >= 5 && value <= 120) {
      await store.set({ [SEEK_TIME_KEY]: value });
    }
  } catch (error) {
    console.error('[StreamKeys] Failed to save seek time setting:', error);
  }
}

/**
 * Load enabled services from storage
 */
async function loadEnabledServices(): Promise<void> {
  try {
    const store = await storage();
    const result = await store.get(ENABLED_SERVICES_KEY);
    enabledServices = (result[ENABLED_SERVICES_KEY] as Record<ServiceId, boolean>) || {
      ...DEFAULT_ENABLED_SERVICES,
    };
    renderServicesList();
  } catch (error) {
    console.error('[StreamKeys] Failed to load enabled services:', error);
    enabledServices = { ...DEFAULT_ENABLED_SERVICES };
    renderServicesList();
  }
}

/**
 * Save enabled service setting
 */
async function saveEnabledService(serviceId: ServiceId, enabled: boolean): Promise<void> {
  try {
    enabledServices[serviceId] = enabled;
    const store = await storage();
    await store.set({ [ENABLED_SERVICES_KEY]: enabledServices });
  } catch (error) {
    console.error('[StreamKeys] Failed to save enabled service setting:', error);
  }
}

/**
 * Render the services list
 */
function renderServicesList(): void {
  servicesList.innerHTML = '';

  SERVICE_HANDLERS.forEach((service) => {
    const label = document.createElement('label');
    label.className = 'toggle-row';

    const labelText = document.createElement('span');
    labelText.className = 'toggle-label';
    labelText.textContent = service.displayName;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'toggle-input';
    checkbox.checked = enabledServices[service.id] ?? true;
    checkbox.addEventListener('change', () => {
      saveEnabledService(service.id, checkbox.checked);
    });

    const toggleSwitch = document.createElement('span');
    toggleSwitch.className = 'toggle-switch';

    label.appendChild(labelText);
    label.appendChild(checkbox);
    label.appendChild(toggleSwitch);
    servicesList.appendChild(label);
  });
}

/**
 * Update the seek time input disabled state based on custom seek toggle
 */
function updateSeekTimeRowState(): void {
  if (customSeekToggle.checked) {
    seekTimeInput.classList.remove('disabled');
    seekTimeInput.disabled = false;
    seekTimeSuffix.classList.remove('disabled');
  } else {
    seekTimeInput.classList.add('disabled');
    seekTimeInput.disabled = true;
    seekTimeSuffix.classList.add('disabled');
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
  servicesList = document.getElementById('services-list') as HTMLDivElement;
  languageInput = document.getElementById('language-input') as HTMLInputElement;
  addButton = document.getElementById('add-button') as HTMLButtonElement;
  languageList = document.getElementById('language-list') as HTMLUListElement;
  restoreDefaultsButton = document.getElementById('restore-defaults-button') as HTMLButtonElement;
  positionHistoryToggle = document.getElementById('position-history-toggle') as HTMLInputElement;
  captureMediaKeysToggle = document.getElementById('capture-media-keys-toggle') as HTMLInputElement;
  customSeekToggle = document.getElementById('custom-seek-toggle') as HTMLInputElement;
  seekTimeInput = document.getElementById('seek-time-input') as HTMLInputElement;
  seekTimeSuffix = seekTimeInput.nextElementSibling as HTMLSpanElement;

  // Event listeners
  addButton.addEventListener('click', addLanguage);
  restoreDefaultsButton.addEventListener('click', restoreDefaults);
  languageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      addLanguage();
    }
  });
  positionHistoryToggle.addEventListener('change', savePositionHistorySetting);
  captureMediaKeysToggle.addEventListener('change', saveCaptureMediaKeysSetting);
  customSeekToggle.addEventListener('change', saveCustomSeekEnabledSetting);
  seekTimeInput.addEventListener('change', saveSeekTimeSetting);

  // Fix for the custom seek toggle row which has both a number input and checkbox
  // The label's default behavior would focus the first input (number), not the checkbox
  // So we manually handle clicks on the row to toggle the checkbox
  const customSeekRow = seekTimeInput.closest('.toggle-row') as HTMLLabelElement;
  customSeekRow.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    // Don't toggle if clicking on the number input, suffix, or checkbox itself
    // Checkbox handles its own toggle via native behavior
    if (target === seekTimeInput || target === seekTimeSuffix || target === customSeekToggle) {
      return;
    }
    // Manually toggle the checkbox (prevent default label behavior which would focus number input)
    e.preventDefault();
    customSeekToggle.checked = !customSeekToggle.checked;
    customSeekToggle.dispatchEvent(new Event('change'));
  });

  // Load preferences
  loadEnabledServices();
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
  loadEnabledServices,
  saveEnabledService,
  renderServicesList,
  init,
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
