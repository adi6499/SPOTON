/**
 * MusicFlow - Lightweight Tactile Haptics Engine
 * Fast, non-blocking hardware vibration on supported mobile devices.
 * Completely safe for Web Audio, battery, and iOS/Android playback.
 */

const Haptics = (function () {
  'use strict';

  let lastScrubPercent = -1;
  let lastHapticTime = 0;

  function isSupported() {
    return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
  }

  function isEnabled() {
    if (typeof Storage === 'undefined' || !Storage.getSettings) return true;
    const settings = Storage.getSettings();
    return settings.hapticsEnabled !== false;
  }

  function trigger(pattern) {
    if (!isEnabled()) return false;
    if (!isSupported()) return false;

    try {
      navigator.vibrate(pattern);
      return true;
    } catch (_) {
      return false;
    }
  }

  // ---- Apple Music Haptic Presets ----

  /** Short, crisp selection tick (10ms) */
  function light() {
    return trigger(10);
  }

  /** Ultra-crisp micro tick for rapid selection (8ms) */
  function selection() {
    return trigger(8);
  }

  /** Punchy impact for play/pause and state transitions (24ms) */
  function medium() {
    return trigger(24);
  }

  /** Heavy impact for full player expand/collapse or modals (38ms) */
  function heavy() {
    return trigger(38);
  }

  /** Apple Music Heart/Like dual-pulse */
  function like() {
    return trigger([15, 45, 25]);
  }

  /** Success action confirmation */
  function success() {
    return trigger([12, 40, 20]);
  }

  /** Warning or error vibration */
  function error() {
    return trigger([30, 40, 30, 40, 30]);
  }

  /** Mechanical gear tick during continuous scrubbing/seeking (throttled to 5% intervals) */
  function scrubTick(percent) {
    const rounded = Math.floor(percent / 5) * 5;
    if (rounded !== lastScrubPercent) {
      lastScrubPercent = rounded;
      const now = Date.now();
      if (now - lastHapticTime > 30) {
        lastHapticTime = now;
        selection();
      }
    }
  }

  function updatePlayerHapticsBadge() {
    if (typeof document === 'undefined' || typeof document.getElementById !== 'function') return;
    const btn = document.getElementById('btn-player-haptics');
    const text = document.getElementById('player-haptics-text');
    const enabled = isEnabled();
    if (btn) {
      btn.classList.toggle('active', enabled);
      btn.classList.toggle('inactive', !enabled);
    }
    if (text) {
      text.textContent = enabled ? 'HAPTICS ON' : 'HAPTICS OFF';
    }
    const toggleInput = document.getElementById('toggle-haptics');
    if (toggleInput) {
      toggleInput.checked = enabled;
    }
  }

  function toggle() {
    const current = isEnabled();
    const nextState = !current;
    if (typeof Storage !== 'undefined' && Storage.updateSettings) {
      Storage.updateSettings({ hapticsEnabled: nextState });
    }
    updatePlayerHapticsBadge();
    if (nextState) {
      medium();
      if (typeof UI !== 'undefined' && UI.showToast) {
        UI.showToast('📳 Apple Music Haptics: Enabled', 'success');
      }
    } else {
      if (typeof UI !== 'undefined' && UI.showToast) {
        UI.showToast('Haptics: Disabled', 'info');
      }
    }
    return nextState;
  }

  function handleDirectInteraction(e) {
    const target = e.target;
    if (!target) return;

    if (target.closest('.btn-fav, [data-action="fav-current"], [data-action="fav"]')) {
      like();
      return;
    }

    if (target.closest('.btn-play, .hero-play-btn, [data-action="toggle-play"], [data-action="play-full"]')) {
      medium();
      return;
    }

    if (target.closest('[data-action="next"], [data-action="previous"], [data-action="prev"], [data-action="shuffle"], [data-action="repeat"], [data-action="toggle-shuffle"], [data-action="toggle-repeat"]')) {
      light();
      return;
    }

    if (target.closest('.nav-item, .settings-tab-btn, .mood-chip-btn, .lang-chip, .filter-chip, .media-toggle-btn, .search-tab-chip')) {
      selection();
      return;
    }

    if (target.closest('.quick-pick-item, .song-item, .shelf-card, .radio-station-card, .podcast-show-card, .sample-reel-card, .library-song-row')) {
      light();
      return;
    }

    if (target.closest('.btn-icon, .btn-primary, #btn-refresh-home, #btn-user-profile-header, .settings-btn, #btn-player-haptics')) {
      light();
    }
  }

  let isInitialized = false;
  function init() {
    if (typeof document === 'undefined' || isInitialized) return;
    isInitialized = true;

    updatePlayerHapticsBadge();

    // Use single pointerdown event to prevent duplicate triggers
    if (typeof window !== 'undefined' && window.PointerEvent) {
      document.addEventListener('pointerdown', handleDirectInteraction, { passive: true });
    } else if (typeof document !== 'undefined') {
      document.addEventListener('touchstart', handleDirectInteraction, { passive: true });
    }

    if (typeof document !== 'undefined') {
      document.addEventListener('input', (e) => {
        const target = e.target;
        if (!target) return;

        if (target.classList.contains('volume-slider') || target.id === 'full-progress-range' || target.id === 'mini-progress-range') {
          const val = parseFloat(target.value) || 0;
          const max = parseFloat(target.max) || 100;
          const percent = (val / max) * 100;
          scrubTick(percent);
        }
      }, { passive: true });
    }
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }

  return {
    isSupported,
    isEnabled,
    trigger,
    light,
    selection,
    medium,
    heavy,
    like,
    success,
    error,
    scrubTick,
    toggle,
    updatePlayerHapticsBadge,
    init
  };
})();

if (typeof window !== 'undefined') {
  window.Haptics = Haptics;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Haptics;
}
