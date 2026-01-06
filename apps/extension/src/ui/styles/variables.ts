// Shared CSS variables for StreamKeys UI components

const cssVars = {
  overlay: {
    bg: 'rgba(0, 0, 0, 0.9)',
    bgLight: 'rgba(0, 0, 0, 0.6)',
    border: 'rgba(255, 255, 255, 0.2)',
    borderLight: 'rgba(255, 255, 255, 0.1)',
    bgHover: 'rgba(255, 255, 255, 0.2)',
    bgActive: 'rgba(255, 255, 255, 0.1)',
  },
  accent: {
    green: 'rgba(76, 175, 80, 0.15)',
    greenBorder: 'rgba(76, 175, 80, 0.4)',
    greenHover: 'rgba(76, 175, 80, 0.25)',
  },
  text: {
    primary: 'white',
    secondary: 'rgba(255, 255, 255, 0.6)',
    muted: 'rgba(255, 255, 255, 0.5)',
  },
  progress: {
    bg: 'rgba(255, 255, 255, 0.2)',
    fill: 'rgba(255, 255, 255, 0.8)',
  },
  zIndex: {
    max: 2147483647,
  },
  font: {
    family: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    sizeSmall: '12px',
    sizeMedium: '14px',
    sizeLarge: '16px',
    sizeXLarge: '18px',
    sizeXXLarge: '22px',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '20px',
    xxl: '24px',
  },
  borderRadius: {
    sm: '4px',
    md: '6px',
    lg: '8px',
    xl: '10px',
    xxl: '12px',
  },
  timing: {
    bannerFade: 1500,
    fadeTransition: 300,
    dialogUpdate: 300,
  },
} as const;

// Helper to create CSS string from style object
function createStyleString(styles: Record<string, string | number>): string {
  return Object.entries(styles)
    .map(([key, value]) => {
      // Convert camelCase to kebab-case
      const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
      return `${cssKey}: ${value};`;
    })
    .join(' ');
}

// Public API
export const Styles = {
  vars: cssVars,
  createString: createStyleString,
};
