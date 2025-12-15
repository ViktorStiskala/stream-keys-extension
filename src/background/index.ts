// Service worker router - injects appropriate handler based on URL

import browser, { WebNavigation } from 'webextension-polyfill';
import type { StreamKeysSettings } from '@/types';
import { Debug } from '@/core/debug';

// __DEV__ is defined by vite config based on isWatch
declare const __DEV__: boolean;

// Initialize console forwarding in dev mode
if (__DEV__) {
  Debug.initConsoleForward();
}

const STORAGE_KEY = 'subtitleLanguages';
const POSITION_HISTORY_KEY = 'positionHistoryEnabled';
const CAPTURE_MEDIA_KEYS_KEY = 'captureMediaKeys';
const CUSTOM_SEEK_ENABLED_KEY = 'customSeekEnabled';
const SEEK_TIME_KEY = 'seekTime';
const DEFAULT_LANGUAGES = ['English', 'English [CC]', 'English CC'];
const DEFAULT_POSITION_HISTORY = true;
const DEFAULT_CAPTURE_MEDIA_KEYS = true;
const DEFAULT_CUSTOM_SEEK_ENABLED = false;
const DEFAULT_SEEK_TIME = 10;

// Use storage.local as fallback if storage.sync fails (Firefox temporary add-ons)
async function getStorage(): Promise<typeof browser.storage.sync> {
  try {
    await browser.storage.sync.get(null);
    return browser.storage.sync;
  } catch {
    return browser.storage.local;
  }
}

// Track injected tabs to prevent double injection
const injectedTabs = new Map<number, string>();

/**
 * Handler configuration for each supported service
 */
interface ServiceHandler {
  urlPattern: string;
  handlerFile: string;
}

const handlers: ServiceHandler[] = [
  { urlPattern: 'disneyplus.com', handlerFile: 'src/services/disney.js' },
  { urlPattern: 'hbomax.com', handlerFile: 'src/services/hbomax.js' },
];

/**
 * Find the handler for a given URL
 */
function findHandler(url: string): ServiceHandler | undefined {
  return handlers.find((h) => url.includes(h.urlPattern));
}

/**
 * Inject settings and handler scripts into a tab
 */
async function injectHandler(tabId: number, handlerFile: string): Promise<void> {
  // Read settings from storage (with fallback to local)
  const store = await getStorage();
  const result = await store.get([
    STORAGE_KEY,
    POSITION_HISTORY_KEY,
    CAPTURE_MEDIA_KEYS_KEY,
    CUSTOM_SEEK_ENABLED_KEY,
    SEEK_TIME_KEY,
  ]);
  const settings: StreamKeysSettings = {
    subtitleLanguages: (result[STORAGE_KEY] as string[] | undefined) || DEFAULT_LANGUAGES,
    positionHistoryEnabled:
      result[POSITION_HISTORY_KEY] !== undefined
        ? (result[POSITION_HISTORY_KEY] as boolean)
        : DEFAULT_POSITION_HISTORY,
    captureMediaKeys:
      result[CAPTURE_MEDIA_KEYS_KEY] !== undefined
        ? (result[CAPTURE_MEDIA_KEYS_KEY] as boolean)
        : DEFAULT_CAPTURE_MEDIA_KEYS,
    customSeekEnabled:
      result[CUSTOM_SEEK_ENABLED_KEY] !== undefined
        ? (result[CUSTOM_SEEK_ENABLED_KEY] as boolean)
        : DEFAULT_CUSTOM_SEEK_ENABLED,
    seekTime:
      result[SEEK_TIME_KEY] !== undefined ? (result[SEEK_TIME_KEY] as number) : DEFAULT_SEEK_TIME,
  };

  // Inject settings as global variable (main frame only)
  await browser.scripting.executeScript({
    target: { tabId },
    func: (settingsObj: StreamKeysSettings) => {
      window.__streamKeysSettings = settingsObj;
    },
    args: [settings],
    world: 'MAIN',
  });

  // Inject handler bundle (main frame only)
  await browser.scripting.executeScript({
    target: { tabId },
    files: [handlerFile],
    world: 'MAIN',
  });
}

/**
 * Handle navigation completion
 */
function handleNavigationComplete(details: WebNavigation.OnCompletedDetailsType): void {
  // Skip chrome:// URLs
  if (details.url.includes('chrome://')) {
    return;
  }

  // Only handle main frame
  if (details.frameId !== 0) {
    return;
  }

  const handler = findHandler(details.url);
  if (!handler) {
    if (__DEV__) {
      Debug.event('WebNavigation.onCompleted', details, 'no handler found, skipping');
    }
    return;
  }

  // Check if already injected for this tab (prevents double injection on SPA navigation)
  const previousHandler = injectedTabs.get(details.tabId);
  if (previousHandler === handler.handlerFile) {
    if (__DEV__) {
      Debug.event('WebNavigation.onCompleted', details, 'already injected, skipping');
    }
    return;
  }

  if (__DEV__) {
    Debug.event('WebNavigation.onCompleted', details, `injecting handler=${handler.handlerFile}`);
  }

  injectedTabs.set(details.tabId, handler.handlerFile);
  injectHandler(details.tabId, handler.handlerFile).catch((err) => {
    if (__DEV__) {
      Debug.event('WebNavigation.onCompleted', details, `injection failed: ${err}`);
    }
    // Injection failed, allow retry
    injectedTabs.delete(details.tabId);
  });
}

/**
 * Handle tab removal
 */
function handleTabRemoved(tabId: number): void {
  if (__DEV__) {
    const wasInjected = injectedTabs.has(tabId);
    Debug.log(`[tabs.onRemoved] tab=${tabId} wasInjected=${wasInjected}`);
  }
  injectedTabs.delete(tabId);
}

/**
 * Handle before navigation - clean up to allow re-injection on reload
 */
function handleBeforeNavigate(details: WebNavigation.OnBeforeNavigateDetailsType): void {
  if (__DEV__) {
    Debug.log(
      `[WebNavigation.onBeforeNavigate] tab=${details.tabId} frame=${details.frameId} url=${details.url}`
    );
  }

  if (details.frameId !== 0) return;

  // Always clear on navigation start to allow re-injection on reload
  const wasInjected = injectedTabs.has(details.tabId);
  injectedTabs.delete(details.tabId);

  if (__DEV__ && wasInjected) {
    Debug.log(`[WebNavigation.onBeforeNavigate] tab=${details.tabId} cleared injection state`);
  }
}

// Internal API (for testing/debugging)
export const Background = {
  findHandler,
  injectHandler,
  handleNavigationComplete,
  handleTabRemoved,
  handleBeforeNavigate,
};

// Set up event listeners
browser.webNavigation.onCompleted.addListener(handleNavigationComplete);
browser.tabs.onRemoved.addListener(handleTabRemoved);
browser.webNavigation.onBeforeNavigate.addListener(handleBeforeNavigate);

// Open settings when clicking the extension icon
browser.action.onClicked.addListener(() => {
  browser.runtime.openOptionsPage();
});

/**
 * Inject into existing tabs on extension startup
 * Handles tabs opened before the extension's service worker was ready
 */
async function injectIntoExistingTabs(): Promise<void> {
  if (__DEV__) {
    Debug.log('[startup] Checking existing tabs for injection');
  }

  const tabs = await browser.tabs.query({});
  for (const tab of tabs) {
    const tabId = tab.id;
    if (!tabId || !tab.url) continue;

    const handler = findHandler(tab.url);
    if (handler && !injectedTabs.has(tabId)) {
      if (__DEV__) {
        Debug.log(`[startup] tab=${tabId} injecting handler=${handler.handlerFile} url=${tab.url}`);
      }
      injectedTabs.set(tabId, handler.handlerFile);
      injectHandler(tabId, handler.handlerFile).catch((err) => {
        if (__DEV__) {
          Debug.log(`[startup] tab=${tabId} injection failed: ${err}`);
        }
        // Tab might not be ready yet, ignore errors
        injectedTabs.delete(tabId);
      });
    }
  }
}

// Run on service worker startup
injectIntoExistingTabs();
