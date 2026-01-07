// Shadow Patcher Loader - Content script that injects shadow-patcher.js into main world
// This runs in the isolated world at document_start, then injects the actual patcher
// via script tag to bypass Safari's lack of world: "MAIN" support

// Chrome extension API is available in content scripts
declare const chrome: { runtime: { getURL: (path: string) => string } };

const script = document.createElement('script');
script.src = chrome.runtime.getURL('src/shadow-patcher.js');
(document.head || document.documentElement).appendChild(script);
