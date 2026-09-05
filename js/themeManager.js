// ==========================================================================
// MUSICFLOW — CENTRALIZED THEME & APPEARANCE MANAGER
// Manages global CSS variables, 8 native presets, custom color selection,
// WCAG-compliant contrast computation, smooth transitions, and local persistence.
// ==========================================================================

const ThemeManager = (() => {
  const STORAGE_KEY = 'mf_user_theme';

  const PRESETS = [
    { id: 'red', name: 'MusicFlow Red', color: '#FF1744', isDefault: true },
    { id: 'ocean_blue', name: 'Ocean Blue', color: '#007AFF' },
    { id: 'emerald', name: 'Emerald', color: '#10B981' },
    { id: 'purple', name: 'Royal Purple', color: '#8B5CF6' },
    { id: 'sunset', name: 'Sunset Orange', color: '#FF5722' },
    { id: 'rose', name: 'Rose Pink', color: '#EC4899' },
    { id: 'gold', name: 'Gold Amber', color: '#F59E0B' },
    { id: 'cyan', name: 'Cyan', color: '#06B6D4' }
  ];

  const DEFAULT_THEME = PRESETS[0];

  function hexToRgb(hex) {
    if (!hex || typeof hex !== 'string') return { r: 255, g: 23, b: 68 };
    let clean = hex.replace('#', '').trim();
    if (clean.length === 3) {
      clean = clean.split('').map(c => c + c).join('');
    }
    if (clean.length !== 6) {
      return { r: 255, g: 23, b: 68 };
    }
    const num = parseInt(clean, 16);
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255
    };
  }

  function rgbToHex(r, g, b) {
    const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
    return '#' + [clamp(r), clamp(g), clamp(b)].map(x => x.toString(16).padStart(2, '0')).join('');
  }

  function getLuminance(r, g, b) {
    const a = [r, g, b].map(v => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
  }

  function calculateContrastColor(hexColor) {
    const rgb = hexToRgb(hexColor);
    const lum = getLuminance(rgb.r, rgb.g, rgb.b);
    return lum > 0.45 ? '#000000' : '#FFFFFF';
  }

  function getCSSVariables(themeOrHex) {
    let color = DEFAULT_THEME.color;
    if (typeof themeOrHex === 'string') {
      color = themeOrHex;
    } else if (themeOrHex && themeOrHex.color) {
      color = themeOrHex.color;
    } else if (currentTheme && currentTheme.color) {
      color = currentTheme.color;
    }
    const rgb = hexToRgb(color);
    const contrastText = calculateContrastColor(color);
    const strongHex = rgbToHex(rgb.r * 0.85, rgb.g * 0.85, rgb.b * 0.85);

    return {
      '--accent': color,
      '--accent-rgb': `${rgb.r}, ${rgb.g}, ${rgb.b}`,
      '--accent-soft': `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15)`,
      '--accent-strong': strongHex,
      '--accent-glow': `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.45)`,
      '--accent-text': contrastText,
      '--accent-border': `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.30)`,
      '--accent-surface': `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.08)`,
      '--color-primary': color,
      '--color-primary-glow': `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.45)`,
      '--color-primary-dark': `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.7)`,
      '--dynamic-color': `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.40)`
    };
  }

  function getStoredTheme() {
    try {
      if (typeof Storage !== 'undefined' && typeof Storage.getTheme === 'function') {
        const t = Storage.getTheme();
        if (t) return t;
      }
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) return JSON.parse(raw);
      }
    } catch (_) {}
    return DEFAULT_THEME;
  }

  function saveStoredTheme(theme) {
    try {
      if (typeof Storage !== 'undefined' && typeof Storage.setTheme === 'function') {
        Storage.setTheme(theme);
      }
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(theme));
      }
    } catch (_) {}
  }

  let currentTheme = DEFAULT_THEME;

  function applyVariablesToDOM(vars) {
    if (typeof document === 'undefined' || !document.documentElement) return;
    const root = document.documentElement;
    Object.entries(vars).forEach(([prop, val]) => {
      root.style.setProperty(prop, val);
    });
  }

  function getPresets() {
    return [...PRESETS];
  }

  function getTheme() {
    return currentTheme || getStoredTheme();
  }

  function setTheme(presetIdOrColor) {
    if (!presetIdOrColor) return currentTheme;

    let targetTheme = null;
    const preset = PRESETS.find(p => p.id === presetIdOrColor);
    if (preset) {
      targetTheme = { ...preset };
    } else if (typeof presetIdOrColor === 'string' && presetIdOrColor.startsWith('#')) {
      const matched = PRESETS.find(p => p.color.toLowerCase() === presetIdOrColor.toLowerCase());
      targetTheme = matched
        ? { ...matched }
        : { id: 'custom', name: 'Custom Color', color: presetIdOrColor, isCustom: true };
    } else {
      targetTheme = DEFAULT_THEME;
    }

    currentTheme = targetTheme;
    saveStoredTheme(targetTheme);

    const cssVars = getCSSVariables(targetTheme.color);
    applyVariablesToDOM(cssVars);

    // 1. Update In-App Preview Live if visible
    if (typeof UI !== 'undefined' && typeof UI.renderThemePreview === 'function') {
      UI.renderThemePreview(targetTheme);
    }

    // 2. Notify Full Player & Component Theme Listeners live
    if (typeof UI !== 'undefined' && typeof UI.onThemeChange === 'function') {
      UI.onThemeChange(targetTheme);
    }

    // 3. Redraw Scrubber waveform canvas live
    if (typeof App !== 'undefined' && typeof App.redrawSeekBarWave === 'function') {
      App.redrawSeekBarWave();
    }

    // 4. Dispatch global window custom event
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent !== 'undefined') {
      try {
        window.dispatchEvent(new CustomEvent('mf_theme_change', { detail: targetTheme }));
      } catch (_) {}
    }

    return targetTheme;
  }

  function setDynamicColor(colorOrUrl) {
    if (!colorOrUrl) {
      resetDynamicColor();
      return;
    }
    if (typeof colorOrUrl === 'string' && (colorOrUrl.startsWith('#') || colorOrUrl.startsWith('rgb'))) {
      if (typeof document !== 'undefined' && document.documentElement) {
        document.documentElement.style.setProperty('--dynamic-color', colorOrUrl);
      }
      return;
    }
    resetDynamicColor();
  }

  function resetDynamicColor() {
    const color = currentTheme?.color || DEFAULT_THEME.color;
    const rgb = hexToRgb(color);
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.style.setProperty('--dynamic-color', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.40)`);
    }
  }

  function setAccentColor(color) {
    return setTheme(color);
  }

  function reset() {
    return setTheme(DEFAULT_THEME.id);
  }

  function apply() {
    const saved = getStoredTheme();
    currentTheme = saved || DEFAULT_THEME;
    const cssVars = getCSSVariables(currentTheme.color);
    applyVariablesToDOM(cssVars);
    return currentTheme;
  }

  // Self-initialize if running in browser
  if (typeof window !== 'undefined') {
    try {
      apply();
    } catch (_) {}
  }

  return {
    getPresets,
    getTheme,
    setTheme,
    setAccentColor,
    setDynamicColor,
    resetDynamicColor,
    reset,
    apply,
    getCSSVariables,
    calculateContrastColor
  };
})();

if (typeof window !== 'undefined') {
  window.ThemeManager = ThemeManager;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ThemeManager;
}
