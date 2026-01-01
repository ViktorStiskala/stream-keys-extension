// Service worker router - injects appropriate handler based on URL

import browser, { WebNavigation } from 'webextension-polyfill';
import type { ServiceId, ServiceHandler, StreamKeysSettings } from '@/types';
import {
  DEFAULT_LANGUAGES,
  DEFAULT_POSITION_HISTORY,
  DEFAULT_CAPTURE_MEDIA_KEYS,
  DEFAULT_CUSTOM_SEEK_ENABLED,
  DEFAULT_SEEK_TIME,
  DEFAULT_ENABLED_SERVICES,
  SERVICE_HANDLERS,
} from '@/types';
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
const ENABLED_SERVICES_KEY = 'enabledServices';

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
 * Find the handler for a given URL
 */
function findHandler(url: string): ServiceHandler | undefined {
  return SERVICE_HANDLERS.find((h) => url.includes(h.urlPattern));
}

/**
 * Get enabled services from storage
 */
async function getEnabledServices(): Promise<Record<ServiceId, boolean>> {
  const store = await getStorage();
  const result = await store.get(ENABLED_SERVICES_KEY);
  return (result[ENABLED_SERVICES_KEY] as Record<ServiceId, boolean>) || DEFAULT_ENABLED_SERVICES;
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
    ENABLED_SERVICES_KEY,
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
    enabledServices:
      (result[ENABLED_SERVICES_KEY] as Record<ServiceId, boolean>) || DEFAULT_ENABLED_SERVICES,
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
 * Try to inject handler for a URL if service is enabled and not already injected
 */
async function tryInjectHandler(
  tabId: number,
  url: string,
  eventName: string,
  details: object
): Promise<void> {
  // Skip chrome:// URLs
  if (url.includes('chrome://')) {
    return;
  }

  const handler = findHandler(url);
  if (!handler) {
    if (__DEV__) {
      Debug.event(eventName, details, 'no handler found, skipping');
    }
    return;
  }

  // Check if service is enabled
  const enabledServices = await getEnabledServices();
  if (!enabledServices[handler.id]) {
    if (__DEV__) {
      Debug.event(eventName, details, `service ${handler.id} disabled, skipping`);
    }
    return;
  }

  // Check if already injected for this tab
  if (injectedTabs.get(tabId) === handler.handlerFile) {
    if (__DEV__) {
      Debug.event(eventName, details, 'already injected, skipping');
    }
    return;
  }

  if (__DEV__) {
    Debug.event(eventName, details, `injecting handler=${handler.handlerFile}`);
  }

  injectedTabs.set(tabId, handler.handlerFile);
  try {
    await injectHandler(tabId, handler.handlerFile);
  } catch (err) {
    if (__DEV__) {
      Debug.event(eventName, details, `injection failed: ${err}`);
    }
    // Injection failed, allow retry
    injectedTabs.delete(tabId);
  }
}

/**
 * Handle navigation completion
 */
function handleNavigationComplete(details: WebNavigation.OnCompletedDetailsType): void {
  if (details.frameId !== 0) return;
  tryInjectHandler(details.tabId, details.url, 'WebNavigation.onCompleted', details);
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

/**
 * Handle SPA navigation (History API pushState/replaceState)
 * Used for sites like YouTube that navigate without full page reloads
 */
function handleHistoryStateUpdated(details: WebNavigation.OnHistoryStateUpdatedDetailsType): void {
  if (details.frameId !== 0) return;
  tryInjectHandler(details.tabId, details.url, 'WebNavigation.onHistoryStateUpdated', details);
}

// Internal API (for testing/debugging)
export const Background = {
  handlers: SERVICE_HANDLERS,
  findHandler,
  injectHandler,
  tryInjectHandler,
  handleNavigationComplete,
  handleTabRemoved,
  handleBeforeNavigate,
  handleHistoryStateUpdated,
  getEnabledServices,
  DEFAULT_ENABLED_SERVICES,
};

// Set up event listeners
browser.webNavigation.onCompleted.addListener(handleNavigationComplete);
browser.tabs.onRemoved.addListener(handleTabRemoved);
browser.webNavigation.onBeforeNavigate.addListener(handleBeforeNavigate);
browser.webNavigation.onHistoryStateUpdated.addListener(handleHistoryStateUpdated);

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

  const enabledServices = await getEnabledServices();
  const tabs = await browser.tabs.query({});

  for (const tab of tabs) {
    const tabId = tab.id;
    if (!tabId || !tab.url) continue;

    const handler = findHandler(tab.url);
    if (handler && !injectedTabs.has(tabId) && enabledServices[handler.id]) {
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
