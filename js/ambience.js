/**
 * Ambience Soundscape Generator (Web Audio API)
 * Provides procedural background soundscapes (Ocean Waves, Rain, Forest Wind, Campfire)
 * that can be played standalone or layered under music.
 */
const Ambience = (() => {
  let audioCtx = null;
  let currentSoundscape = 'off'; // 'off' | 'ocean' | 'rain' | 'forest' | 'campfire'
  let volume = 0.5; // 0.0 to 1.0
  let isPlaying = false;

  let masterGain = null;
  let activeNodes = [];
  let intervalId = null;

  function initContext() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        audioCtx = new AudioContext();
        masterGain = audioCtx.createGain();
        masterGain.gain.setValueAtTime(volume, audioCtx.currentTime);
        masterGain.connect(audioCtx.destination);
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function stopCurrent() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    activeNodes.forEach(node => {
      try {
        if (node.stop) node.stop();
        if (node.disconnect) node.disconnect();
      } catch (e) {}
    });
    activeNodes = [];
    isPlaying = false;
  }

  // Generate a buffer of white noise
  function createNoiseBuffer(seconds = 5) {
    if (!audioCtx) return null;
    const bufferSize = audioCtx.sampleRate * seconds;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  // --- Soundscape Generators ---

  // 1. Ocean Waves: Modulated low-pass noise that swells in a 6-second wave cycle
  function startOcean() {
    initContext();
    if (!audioCtx) return;

    const noiseBuffer = createNoiseBuffer(6);
    const noise = audioCtx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;

    // Filter
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(300, audioCtx.currentTime);

    // LFO for wave modulation
    const lfo = audioCtx.createOscillator();
    lfo.frequency.setValueAtTime(0.16, audioCtx.currentTime); // ~6 second wave period

    const lfoGain = audioCtx.createGain();
    lfoGain.gain.setValueAtTime(250, audioCtx.currentTime);

    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.7, audioCtx.currentTime);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);

    noise.start();
    lfo.start();

    activeNodes.push(noise, filter, lfo, lfoGain, gain);
    isPlaying = true;
  }

  // 2. Gentle Rain: Pink/Brown filtered noise with slight high-end droplets
  function startRain() {
    initContext();
    if (!audioCtx) return;

    const noiseBuffer = createNoiseBuffer(5);
    const noise = audioCtx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(850, audioCtx.currentTime);
    filter.Q.setValueAtTime(0.5, audioCtx.currentTime);

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.55, audioCtx.currentTime);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);

    noise.start();
    activeNodes.push(noise, filter, gain);
    isPlaying = true;
  }

  // 3. Forest Wind: Smooth airy low-pass wind breeze
  function startForest() {
    initContext();
    if (!audioCtx) return;

    const noiseBuffer = createNoiseBuffer(8);
    const noise = audioCtx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(450, audioCtx.currentTime);

    const lfo = audioCtx.createOscillator();
    lfo.frequency.setValueAtTime(0.08, audioCtx.currentTime); // ~12 second slow gust

    const lfoGain = audioCtx.createGain();
    lfoGain.gain.setValueAtTime(180, audioCtx.currentTime);

    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.5, audioCtx.currentTime);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);

    noise.start();
    lfo.start();

    activeNodes.push(noise, filter, lfo, lfoGain, gain);
    isPlaying = true;
  }

  // 4. Campfire: Low warm rumble with randomized crackles
  function startCampfire() {
    initContext();
    if (!audioCtx) return;

    const noiseBuffer = createNoiseBuffer(4);
    const noise = audioCtx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(220, audioCtx.currentTime);

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.6, audioCtx.currentTime);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);

    noise.start();
    activeNodes.push(noise, filter, gain);

    // Random crackles
    intervalId = setInterval(() => {
      if (!isPlaying || !audioCtx) return;
      try {
        const pop = audioCtx.createBufferSource();
        const popBuf = audioCtx.createBuffer(1, 400, audioCtx.sampleRate);
        const popData = popBuf.getChannelData(0);
        for (let i = 0; i < 400; i++) popData[i] = (Math.random() * 2 - 1) * Math.exp(-i / 50);
        pop.buffer = popBuf;
        const popGain = audioCtx.createGain();
        popGain.gain.setValueAtTime(Math.random() * 0.4 + 0.1, audioCtx.currentTime);
        pop.connect(popGain);
        popGain.connect(masterGain);
        pop.start();
      } catch (e) {}
    }, 450);

    isPlaying = true;
  }

  function setSoundscape(name) {
    stopCurrent();
    currentSoundscape = name || 'off';

    if (currentSoundscape === 'ocean') startOcean();
    else if (currentSoundscape === 'rain') startRain();
    else if (currentSoundscape === 'forest') startForest();
    else if (currentSoundscape === 'campfire') startCampfire();

    updateUI();
  }

  function toggleSoundscape(name) {
    if (typeof Haptics !== 'undefined' && Haptics.light) Haptics.light();
    if (currentSoundscape === name) {
      setSoundscape('off');
      if (typeof UI !== 'undefined' && UI.showToast) {
        UI.showToast('Ambience Muted 🔇', 'info');
      }
    } else {
      setSoundscape(name);
      if (typeof UI !== 'undefined' && UI.showToast) {
        UI.showToast(`Playing ${name} soundscape 🌿`, 'info');
      }
    }
  }

  function stop() {
    if (typeof Haptics !== 'undefined' && Haptics.light) Haptics.light();
    setSoundscape('off');
    if (typeof UI !== 'undefined' && UI.showToast) {
      UI.showToast('Ambience Stopped 🔇', 'info');
    }
  }

  function setVolume(val) {
    volume = Math.max(0, Math.min(1, val));
    if (masterGain && audioCtx) {
      masterGain.gain.setValueAtTime(volume, audioCtx.currentTime);
    }
    const volLabel = document.getElementById('ambience-vol-text');
    if (volLabel) volLabel.textContent = `${Math.round(volume * 100)}%`;
  }

  function updateUI() {
    const pill = document.getElementById('player-ambience-pill');
    const label = document.getElementById('player-ambience-label');
    const icon = document.getElementById('player-ambience-icon');

    const names = {
      off: 'None',
      ocean: 'Ocean Waves',
      rain: 'Rain Sounds',
      forest: 'Forest Wind',
      campfire: 'Campfire'
    };

    const icons = {
      off: 'water_drop',
      ocean: 'waves',
      rain: 'rainy',
      forest: 'forest',
      campfire: 'local_fire_department'
    };

    if (label) label.textContent = names[currentSoundscape] || 'Ambience';
    if (icon) icon.textContent = icons[currentSoundscape] || 'nature';
    if (pill) {
      pill.classList.toggle('active', currentSoundscape !== 'off');
    }

    // Update soundscape cards in the Studio Console
    document.querySelectorAll('.soundscape-quick-card').forEach(card => {
      const sound = card.dataset.sound;
      const isActive = (currentSoundscape === sound);
      card.classList.toggle('active', isActive);

      const statusEl = card.querySelector('.soundscape-status-text');
      const actionIcon = card.querySelector('.soundscape-action-icon');

      if (statusEl) {
        statusEl.textContent = isActive ? 'Playing (Tap to Stop)' : (card.dataset.sub || 'Ambient sound');
        statusEl.style.color = isActive ? '#FA2D48' : 'rgba(255,255,255,0.6)';
      }
      if (actionIcon) {
        actionIcon.textContent = isActive ? 'stop_circle' : 'play_circle';
        actionIcon.style.color = isActive ? '#FA2D48' : 'rgba(255,255,255,0.7)';
      }
      if (isActive) {
        card.style.borderColor = '#FA2D48';
        card.style.background = 'rgba(250, 45, 72, 0.15)';
        card.style.boxShadow = '0 0 20px rgba(250, 45, 72, 0.25)';
      } else {
        card.style.borderColor = 'rgba(255,255,255,0.08)';
        card.style.background = 'rgba(255,255,255,0.05)';
        card.style.boxShadow = 'none';
      }
    });

    const muteBtn = document.getElementById('btn-mute-ambience');
    if (muteBtn) {
      if (currentSoundscape !== 'off') {
        muteBtn.style.background = 'rgba(255, 118, 117, 0.2)';
        muteBtn.style.borderColor = '#ff7675';
        muteBtn.style.color = '#ff7675';
        muteBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 15px; vertical-align: middle;">stop</span> Stop Ambience';
      } else {
        muteBtn.style.background = 'rgba(255,255,255,0.08)';
        muteBtn.style.borderColor = 'rgba(255,255,255,0.15)';
        muteBtn.style.color = '#fff';
        muteBtn.innerHTML = 'Mute Ambience';
      }
    }
  }

  function openAmbienceModal() {
    let modal = document.getElementById('ambience-modal');
    if (modal) {
      modal.remove();
    }
    modal = document.createElement('div');
    modal.id = 'ambience-modal';
    modal.className = 'modal-backdrop';
    modal.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(16px); z-index: 100000; display: flex; align-items: center; justify-content: center; padding: 20px;';
    modal.innerHTML = `
      <div class="modal-card ambience-modal-card" style="max-width: 360px; width: 100%; border-radius: 24px; padding: 24px; background: rgba(20, 16, 26, 0.95); backdrop-filter: blur(28px); border: 1px solid rgba(250, 45, 72, 0.25); box-shadow: 0 20px 50px rgba(0,0,0,0.7);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="material-symbols-outlined" style="color: #FA2D48; font-size: 24px;">nature</span>
            <h3 style="margin: 0; font-size: 18px; font-weight: 800; color: #fff;">Ambience Soundscapes</h3>
          </div>
          <button id="btn-close-ambience" style="background: none; border: none; color: rgba(255,255,255,0.6); cursor: pointer; padding: 4px;">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>

        <p style="font-size: 12px; color: rgba(255,255,255,0.65); line-height: 1.4; margin: 0 0 16px 0;">
          Layer peaceful background soundscapes over your music or play them standalone for sleep &amp; deep focus.
        </p>

        <div class="ambience-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 18px;">
          <button class="ambience-option-btn ${currentSoundscape === 'off' ? 'active' : ''}" data-sound="off" style="display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-radius: 14px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: #fff; font-size: 13px; font-weight: 600; cursor: pointer;">
            <span class="material-symbols-outlined" style="font-size: 18px;">volume_off</span>
            <span>Mute / Off</span>
          </button>
          <button class="ambience-option-btn ${currentSoundscape === 'ocean' ? 'active' : ''}" data-sound="ocean" style="display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-radius: 14px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: #fff; font-size: 13px; font-weight: 600; cursor: pointer;">
            <span class="material-symbols-outlined" style="font-size: 18px; color: #74b9ff;">waves</span>
            <span>Ocean Waves</span>
          </button>
          <button class="ambience-option-btn ${currentSoundscape === 'rain' ? 'active' : ''}" data-sound="rain" style="display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-radius: 14px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: #fff; font-size: 13px; font-weight: 600; cursor: pointer;">
            <span class="material-symbols-outlined" style="font-size: 18px; color: #a29bfe;">rainy</span>
            <span>Gentle Rain</span>
          </button>
          <button class="ambience-option-btn ${currentSoundscape === 'forest' ? 'active' : ''}" data-sound="forest" style="display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-radius: 14px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: #fff; font-size: 13px; font-weight: 600; cursor: pointer;">
            <span class="material-symbols-outlined" style="font-size: 18px; color: #00cec9;">forest</span>
            <span>Forest Wind</span>
          </button>
          <button class="ambience-option-btn ${currentSoundscape === 'campfire' ? 'active' : ''}" data-sound="campfire" style="grid-column: span 2; display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-radius: 14px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: #fff; font-size: 13px; font-weight: 600; cursor: pointer;">
            <span class="material-symbols-outlined" style="font-size: 18px; color: #ff7675;">local_fire_department</span>
            <span>Cozy Campfire</span>
          </button>
        </div>

        <div style="background: rgba(255,255,255,0.05); padding: 12px 14px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.08);">
          <div style="display: flex; justify-content: space-between; font-size: 12px; color: rgba(255,255,255,0.85); margin-bottom: 6px; font-weight: 600;">
            <span>Ambience Volume</span>
            <span id="ambience-vol-text">${Math.round(volume * 100)}%</span>
          </div>
          <input type="range" id="ambience-vol-slider" min="0" max="1" step="0.01" value="${volume}" style="width: 100%; accent-color: var(--accent-color, #FA2D48); cursor: pointer;">
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    // Event listeners
    modal.querySelector('#btn-close-ambience').onclick = () => modal.remove();
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

    modal.querySelectorAll('.ambience-option-btn').forEach(btn => {
      btn.onclick = () => {
        modal.querySelectorAll('.ambience-option-btn').forEach(b => {
          b.style.borderColor = 'rgba(255,255,255,0.1)';
          b.style.background = 'rgba(255,255,255,0.06)';
        });
        btn.style.borderColor = '#FA2D48';
        btn.style.background = 'rgba(250, 45, 72, 0.2)';

        const sound = btn.dataset.sound;
        setSoundscape(sound);
        if (typeof Haptics !== 'undefined' && Haptics.light) Haptics.light();
        if (typeof UI !== 'undefined' && UI.showToast) {
          UI.showToast(sound === 'off' ? 'Ambience Muted' : `Playing ${sound} soundscape 🌿`, 'info');
        }
      };
    });

    const slider = modal.querySelector('#ambience-vol-slider');
    if (slider) {
      slider.oninput = (e) => setVolume(parseFloat(e.target.value));
    }
  }

  return {
    setSoundscape,
    toggleSoundscape,
    stop,
    setVolume,
    getSoundscape: () => currentSoundscape,
    getVolume: () => volume,
    openAmbienceModal,
    updateUI
  };
})();

window.Ambience = Ambience;
