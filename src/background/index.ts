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
const DEFAULT_LANGUAGES = ['English', 'English [CC]', 'English CC'];
const DEFAULT_POSITION_HISTORY = true;

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
  // Read settings from storage
  const result = await browser.storage.sync.get([STORAGE_KEY, POSITION_HISTORY_KEY]);
  const settings: StreamKeysSettings = {
    subtitleLanguages: (result[STORAGE_KEY] as string[] | undefined) || DEFAULT_LANGUAGES,
    positionHistoryEnabled:
      result[POSITION_HISTORY_KEY] !== undefined
        ? (result[POSITION_HISTORY_KEY] as boolean)
        : DEFAULT_POSITION_HISTORY,
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
    return;
  }

  // Check if already injected for this tab (prevents double injection on SPA navigation)
  const previousHandler = injectedTabs.get(details.tabId);
  if (previousHandler === handler.handlerFile) {
    return;
  }

  injectedTabs.set(details.tabId, handler.handlerFile);
  injectHandler(details.tabId, handler.handlerFile);
}

/**
 * Handle tab removal
 */
function handleTabRemoved(tabId: number): void {
  injectedTabs.delete(tabId);
}

/**
 * Handle before navigation - clean up to allow re-injection on reload
 */
function handleBeforeNavigate(details: WebNavigation.OnBeforeNavigateDetailsType): void {
  if (details.frameId !== 0) return;

  // Always clear on navigation start to allow re-injection on reload
  injectedTabs.delete(details.tabId);
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

/**
 * Inject into existing tabs on extension startup
 * Handles tabs opened before the extension's service worker was ready
 */
async function injectIntoExistingTabs(): Promise<void> {
  const tabs = await browser.tabs.query({});
  for (const tab of tabs) {
    const tabId = tab.id;
    if (!tabId || !tab.url) continue;

    const handler = findHandler(tab.url);
    if (handler && !injectedTabs.has(tabId)) {
      injectedTabs.set(tabId, handler.handlerFile);
      injectHandler(tabId, handler.handlerFile).catch(() => {
        // Tab might not be ready yet, ignore errors
        injectedTabs.delete(tabId);
      });
    }
  }
}

// Run on service worker startup
injectIntoExistingTabs();
