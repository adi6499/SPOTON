/**
 * MusicFlow - Apple Music Style Haptics Engine
 * Provides authentic iOS Taptic Engine style haptic feedback across playback, navigation, and gestures.
 */

const Haptics = (function () {
  'use strict';

  let lastScrubPercent = -1;
  let lastHapticTime = 0;

  let audioCtx = null;
  let iosSwitchEl = null;

  function getAudioContext() {
    if (!hasUserInteracted || typeof window === 'undefined') return null;
    try {
      if (!audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
          audioCtx = new AudioContextClass();
        }
      }
      if (audioCtx && audioCtx.state === 'suspended' && hasUserInteracted) {
        audioCtx.resume().catch(() => {});
      }
      return audioCtx;
    } catch (e) {
      return null;
    }
  }

  /**
   * iOS Transducer Kick: Outputs an ultra-short (10-25ms) sub-bass transient
   * through the device's hardware speaker / Taptic transducer.
   * On iOS Safari, this produces a real, physical tactile click felt in the hand.
   */
  function triggerTransducerPulse(freq = 55, durationMs = 18, gainLevel = 0.9) {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + (durationMs / 1000));

      gain.gain.setValueAtTime(gainLevel, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + (durationMs / 1000));

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + (durationMs / 1000) + 0.01);
    } catch (e) {}
  }

  /**
   * iOS WebKit Native Haptic Trigger via virtual Switch/Checkbox control
   */
  function triggerIOSNativeSwitch() {
    if (typeof document === 'undefined') return;
    try {
      if (!iosSwitchEl) {
        iosSwitchEl = document.createElement('input');
        iosSwitchEl.type = 'checkbox';
        iosSwitchEl.setAttribute('switch', '');
        iosSwitchEl.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;pointer-events:none;';
        document.body.appendChild(iosSwitchEl);
      }
      iosSwitchEl.checked = !iosSwitchEl.checked;
    } catch (e) {}
  }

  function isSupported() {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) return true;
    if (typeof window !== 'undefined' && ('AudioContext' in window || 'webkitAudioContext' in window)) return true;
    return false;
  }

  function isEnabled() {
    if (typeof Storage === 'undefined' || !Storage.getSettings) return true;
    const settings = Storage.getSettings();
    return settings.hapticsEnabled !== false;
  }

  let hasUserInteracted = false;

  function trigger(pattern) {
    if (!isEnabled()) return false;
    let didTrigger = false;

    // 1. Android & Standards-Compliant Hardware Vibration
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(pattern);
        didTrigger = true;
      } catch (e) {}
    }

    // 2. iOS Taptic Sub-Bass Transducer Pulse (felt physically while audio is active)
    if (hasUserInteracted) {
      const duration = Array.isArray(pattern) ? (pattern[0] || 15) : (typeof pattern === 'number' ? pattern : 15);
      const freq = duration <= 10 ? 75 : 55;
      triggerTransducerPulse(freq, Math.max(12, Math.min(35, duration)));

      // 3. iOS WebKit Native Selection Switch
      triggerIOSNativeSwitch();
    }

    return true;
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
      if (now - lastHapticTime > 35) {
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

    // Heart / Favorite button
    if (target.closest('.btn-fav, [data-action="fav-current"], [data-action="fav"]')) {
      like();
      return;
    }

    // Play / Pause button
    if (target.closest('.btn-play, .hero-play-btn, [data-action="toggle-play"], [data-action="play-full"]')) {
      medium();
      return;
    }

    // Next / Previous / Skip
    if (target.closest('[data-action="next"], [data-action="previous"], [data-action="prev"], [data-action="shuffle"], [data-action="repeat"], [data-action="toggle-shuffle"], [data-action="toggle-repeat"]')) {
      light();
      return;
    }

    // Tabs, Filter chips, Mood chips, Media toggle pill
    if (target.closest('.nav-item, .settings-tab-btn, .mood-chip-btn, .lang-chip, .filter-chip, .media-toggle-btn, .search-tab-chip')) {
      selection();
      return;
    }

    // Songs, Quick picks, Shelf cards
    if (target.closest('.quick-pick-item, .song-item, .shelf-card, .radio-station-card, .podcast-show-card, .sample-reel-card, .library-song-row')) {
      light();
      return;
    }

    // Action buttons
    if (target.closest('.btn-icon, .btn-primary, #btn-refresh-home, #btn-user-profile-header, .settings-btn, #btn-player-haptics')) {
      light();
      return;
    }
  }

  /** Initialize automatic tactile feedback delegation */
  function init() {
    if (typeof document === 'undefined') return;

    updatePlayerHapticsBadge();

    const onFirstGesture = () => {
      hasUserInteracted = true;
      getAudioContext();
    };

    // 1. Delegated touch / click feedback (capture phase for zero-latency synchronous trigger)
    document.addEventListener('touchstart', (e) => { hasUserInteracted = true; handleDirectInteraction(e); }, { capture: true, passive: true });
    document.addEventListener('pointerdown', (e) => { hasUserInteracted = true; handleDirectInteraction(e); }, { capture: true, passive: true });

    // Unlock AudioContext on first user touch so transducer is hot and ready
    document.addEventListener('touchstart', onFirstGesture, { once: true, passive: true });
    document.addEventListener('pointerdown', onFirstGesture, { once: true, passive: true });
    document.addEventListener('click', onFirstGesture, { once: true, passive: true });

    // 2. Continuous slider scrubbing haptics (Volume & Progress)
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

  // Auto-init on DOM ready if in browser
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

// Export globally and for module environments
if (typeof window !== 'undefined') {
  window.Haptics = Haptics;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Haptics;
}

if (typeof window !== "undefined") window.Haptics = Haptics;
