createHandler({
  name: 'Service Name',
  getPlayer: () => document.querySelector('.player'),
  getButton: (keyCode) => {
    /* return button for key */
  },
  setupPlayerFocus: (player) => {
    /* optional: custom focus logic */
  },
  onPlayerSetup: (player) => {
    /* optional: called on player setup */
  },
  getOverlayContainer: () => {
    /* optional: container for click overlay */
  },
  subtitles: {
    getAvailable: () => {
      /* return [{label, element, ...}] */
    },
    getCurrentState: () => {
      /* return true if subtitles on */
    },
    turnOff: () => {
      /* click off option */
    },
    selectLanguage: (item) => {
      /* click language option */
    },
  },
  // Feature flags (all true by default)
  features: {
    subtitles: true,
    restorePosition: true,
    keyboard: true,
    fullscreenOverlay: true,
  },
});
