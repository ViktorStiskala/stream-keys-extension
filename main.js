// Service worker router - injects appropriate script based on URL

const injectScript = (tabId, scriptFile) => {
  chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    files: [scriptFile],
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
    injectScript(details.tabId, 'services/disney.js');
  } else if (url.includes('hbomax.com')) {
    injectScript(details.tabId, 'services/hbomax.js');
  }
});
