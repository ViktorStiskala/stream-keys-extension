// Service worker router - injects appropriate handler based on URL

import type { StreamKeysSettings } from '@/types';

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
  { urlPattern: 'disneyplus.com', handlerFile: 'src/handlers/disney.js' },
  { urlPattern: 'hbomax.com', handlerFile: 'src/handlers/hbomax.js' },
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
  const result = await chrome.storage.sync.get([STORAGE_KEY, POSITION_HISTORY_KEY]);
  const settings: StreamKeysSettings = {
    subtitleLanguages: result[STORAGE_KEY] || DEFAULT_LANGUAGES,
    positionHistoryEnabled:
      result[POSITION_HISTORY_KEY] !== undefined
        ? result[POSITION_HISTORY_KEY]
        : DEFAULT_POSITION_HISTORY,
  };

  // Inject settings as global variable (main frame only)
  await chrome.scripting.executeScript({
    target: { tabId },
    func: (settingsObj: StreamKeysSettings) => {
      window.__streamKeysSettings = settingsObj;
    },
    args: [settings],
    world: 'MAIN',
  });

  // Inject handler bundle (main frame only)
  await chrome.scripting.executeScript({
    target: { tabId },
    files: [handlerFile],
    world: 'MAIN',
  });
}

/**
 * Handle navigation completion
 */
chrome.webNavigation.onCompleted.addListener((details) => {
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
});

// Clean up when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  injectedTabs.delete(tabId);
});

// Clean up when tab navigates away from supported service
chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  if (details.frameId !== 0) return;

  const handler = findHandler(details.url);
  if (!handler) {
    injectedTabs.delete(details.tabId);
  }
});
