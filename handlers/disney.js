// Disney+ handler - service-specific configuration for StreamKeys

(function() {
  const getShadowRootButton = (selector) => {
    return document.body.querySelector(selector)?.shadowRoot?.querySelector("info-tooltip button");
  };

  // Remove outline from player and video
  const removeOutline = () => {
    const player = document.body.querySelector("disney-web-player");
    const video = player?.querySelector("video");
    player?.style?.setProperty("outline", "0", "important");
    video?.style?.setProperty("outline", "0", "important");
  };

  window.StreamKeys.createHandler({
    name: 'Disney+',

    getPlayer: () => document.body.querySelector("disney-web-player"),

    getButton: (keyCode) => {
      const keyMap = {
        'Space': 'toggle-play-pause',
        'KeyF': 'toggle-fullscreen',
        'ArrowLeft': 'quick-rewind',
        'ArrowRight': 'quick-fast-forward',
      };
      const selector = keyMap[keyCode];
      if (!selector) return null;

      const button = getShadowRootButton(selector);
      if (!button) {
        const buttonName = keyCode === 'Space' ? 'play/pause' : 'fullscreen';
        console.warn(`[StreamKeys] ${buttonName} button not found`);
      }
      return button;
    },

    setupPlayerFocus: (player) => {
      player.setAttribute('tabindex', '-1');
      player.focus();
      removeOutline();
    },

    onPlayerSetup: (player) => {
      removeOutline();
      player.setAttribute('tabindex', '-1');
    },

    subtitles: {
      getAvailable: () => {
        const labels = document.querySelectorAll('#subtitleTrackPicker label.picker-item');
        const results = [];
        labels.forEach(label => {
          // Skip the "off" option
          if (label.getAttribute('for') === 'subtitleTrackPicker-off') return;
          results.push({
            label: label.textContent.trim(),
            element: label,
            inputId: label.getAttribute('for')
          });
        });
        return results;
      },

      getCurrentState: () => {
        const offRadio = document.querySelector('#subtitleTrackPicker-off');
        // Subtitles are ON if the "off" radio is NOT checked
        return offRadio && !offRadio.checked;
      },

      turnOff: () => {
        const offRadio = document.querySelector('#subtitleTrackPicker-off');
        if (offRadio) {
          offRadio.click();
        }
      },

      selectLanguage: (item) => {
        const input = document.querySelector(`#${item.inputId}`);
        if (input) {
          input.click();
        }
      }
    }
  });
})();
