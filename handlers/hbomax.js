// HBO Max handler - service-specific configuration for StreamKeys

(function() {
  const getButton = (primarySelector, fallbackSelector) => {
    return document.querySelector(primarySelector) || document.querySelector(fallbackSelector);
  };

  window.StreamKeys.createHandler({
    name: 'HBO Max',

    getPlayer: () => document.querySelector('div[data-testid="playerContainer"]'),

    getButton: (keyCode) => {
      if (keyCode === 'Space') {
        const button = getButton(
          'button[data-testid="player-ux-play-pause-button"]',
          '[class^="ControlsFooterBottomMiddle"] button:nth-child(2)'
        );
        if (!button) console.warn('[StreamKeys] play/pause button not found');
        return button;
      }
      if (keyCode === 'KeyF') {
        const button = getButton(
          'button[data-testid="player-ux-fullscreen-button"]',
          '[class^="ControlsFooterBottomRight"] button:last-child'
        );
        if (!button) console.warn('[StreamKeys] fullscreen button not found');
        return button;
      }
      return null;
    },

    setupPlayerFocus: (player) => {
      const overlay = document.querySelector('#overlay-root');
      if (overlay) {
        overlay.focus();
      }
    },

    getOverlayContainer: () => {
      return document.getElementById('app-root') || document.body;
    },

    subtitles: {
      getAvailable: () => {
        const buttons = document.querySelectorAll('button[data-testid="player-ux-text-track-button"]');
        const results = [];
        buttons.forEach((button, index) => {
          // Skip the first button (Off option)
          if (index === 0) return;
          const label = button.getAttribute('aria-label') || 
                        button.querySelector('p')?.textContent || '';
          results.push({
            label: label.trim(),
            element: button
          });
        });
        return results;
      },

      getCurrentState: () => {
        // First button is the "Off" option - if it's checked, subtitles are off
        const offButton = document.querySelector('button[data-testid="player-ux-text-track-button"]');
        return offButton && offButton.getAttribute('aria-checked') !== 'true';
      },

      turnOff: () => {
        // Click the first button (Off option)
        const offButton = document.querySelector('button[data-testid="player-ux-text-track-button"]');
        if (offButton) {
          offButton.click();
        }
      },

      selectLanguage: (item) => {
        if (item.element) {
          item.element.click();
        }
      }
    }
  });
})();
