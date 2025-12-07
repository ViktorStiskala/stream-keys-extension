// Service worker router - injects appropriate script based on URL

const STORAGE_KEY = 'subtitleLanguages';
const DEFAULT_LANGUAGES = ['English', 'English [CC]', 'English CC'];

// Inject settings as global variable, then base handler, then service handler
const injectHandler = async (tabId, handlerFile) => {
  // Read settings from storage
  const result = await chrome.storage.sync.get(STORAGE_KEY);
  const settings = {
    subtitleLanguages: result[STORAGE_KEY] || DEFAULT_LANGUAGES
  };

  // Inject settings as global variable
  await chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    func: (settingsObj) => {
      window.__streamKeysSettings = settingsObj;
    },
    args: [settings],
    world: 'MAIN'
  });

  // Inject base handler
  await chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    files: ['handlers/base.js'],
    world: 'MAIN'
  });

  // Inject service-specific handler
  await chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    files: [handlerFile],
    world: 'MAIN'
  });
};

chrome.webNavigation.onCompleted.addListener((details) => {
  if (details.url.includes('chrome://')) {
    return;
  }

  if (details.frameId !== 0) {
    return;
  }

  const url = details.url;

  if (url.includes('disneyplus.com')) {
    injectHandler(details.tabId, 'handlers/disney.js');
  } else if (url.includes('hbomax.com')) {
    injectHandler(details.tabId, 'handlers/hbomax.js');
  }
});
