// ========================================
// MusicFlow — Audio Player Engine
// ========================================

const Player = (() => {
  let audio = new Audio();
  let audio2 = new Audio(); // For crossfade
  let activeAudio = audio;
  let inactiveAudio = audio2;
  
  [audio, audio2].forEach(a => {
    a.crossOrigin = 'anonymous';
    a.preload = 'auto';
  });

  let queue = [];
  let currentIndex = -1;
  let isPlaying = false;
  let repeatMode = 'off'; // 'off' | 'one' | 'all'
  let shuffleMode = false;
  let shuffledIndices = [];
  let playbackSpeed = 1.0;
  let sleepTimerId = null;
  let sleepTimerMinutes = 0;

  // Web Audio API Context
  let audioCtx = null;
  let sourceNode = null;
  let gainNode = null;
  let analyserNode = null;
  const eqBands = [];
  const eqFrequencies = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000];

  function initWebAudio() {
    if (!audioCtx) {
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        
        const source1 = audioCtx.createMediaElementSource(audio);
        const source2 = audioCtx.createMediaElementSource(audio2);
        
        // Both sources feed into the same EQ chain start node
        const inputGain = audioCtx.createGain();
        source1.connect(inputGain);
        source2.connect(inputGain);
        
        const freqs = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000];
        let prevNode = inputGain;

        freqs.forEach(freq => {
          const eq = audioCtx.createBiquadFilter();
          eq.type = 'peaking';
          eq.frequency.value = freq;
          eq.Q.value = 1;
          eq.gain.value = 0;
          eqBands.push(eq);
          prevNode.connect(eq);
          prevNode = eq;
        });

        analyserNode = audioCtx.createAnalyser();
        analyserNode.fftSize = 256;
        prevNode.connect(analyserNode);
        
        volumeNormalizer = audioCtx.createDynamicsCompressor();
        volumeNormalizer.threshold.setValueAtTime(-24, audioCtx.currentTime);
        volumeNormalizer.knee.setValueAtTime(30, audioCtx.currentTime);
        volumeNormalizer.ratio.setValueAtTime(12, audioCtx.currentTime);
        volumeNormalizer.attack.setValueAtTime(0.003, audioCtx.currentTime);
        volumeNormalizer.release.setValueAtTime(0.25, audioCtx.currentTime);
        
        applyNormalization();

        analyserNode.connect(volumeNormalizer);
        volumeNormalizer.connect(audioCtx.destination);
      } catch (e) {
        console.warn('[Player] Web Audio API not supported', e);
      }
    }
  }

  function applyNormalization() {
    if (!volumeNormalizer) return;
    const isNorm = Storage.getSettings().volumeNormalization !== false;
    if (isNorm) {
      volumeNormalizer.ratio.value = 12;
      volumeNormalizer.threshold.value = -24;
    } else {
      volumeNormalizer.ratio.value = 1;
      volumeNormalizer.threshold.value = 0;
    }
  }

  // Callbacks
  let onPlay = null;
  let onPause = null;
  let onTimeUpdate = null;
  let onTrackChange = null;
  let onEnded = null;
  let onError = null;
  let onQueueUpdate = null;
  let onLoadStart = null;
  let onCanPlay = null;

  // Initialize settings
  const settings = Storage.getSettings();
  audio.volume = settings.volume;
  repeatMode = settings.repeat || 'off';
  shuffleMode = settings.shuffle || false;

  // ---- Audio Event Listeners ----

  function bindAudioEvents(a) {
    a.addEventListener('play', () => {
      if (a !== activeAudio) return;
      isPlaying = true;
      onPlay?.();
      updateMediaSession();
    });

    a.addEventListener('pause', () => {
      if (a !== activeAudio) return;
      isPlaying = false;
      onPause?.();
    });

    a.addEventListener('timeupdate', () => {
      if (a !== activeAudio) return;
      
      // Crossfade logic trigger
      const settings = Storage.getSettings();
      if (settings.crossfade && a.duration && a.duration - a.currentTime <= 3 && !a._isFading) {
        a._isFading = true;
        next(true); // Trigger next with crossfade flag
      }

      onTimeUpdate?.({
        currentTime: a.currentTime,
        duration: a.duration || 0,
        progress: a.duration ? (a.currentTime / a.duration) * 100 : 0,
      });
    });

    a.addEventListener('ended', () => {
      if (a !== activeAudio) return;
      a._isFading = false;
      onEnded?.();
      handleTrackEnd();
    });

    a.addEventListener('error', (e) => {
      if (a !== activeAudio) return;
      console.error('[Player] Audio error:', e);
      onError?.(e);
    });

    a.addEventListener('loadstart', () => {
      if (a !== activeAudio) return;
      onLoadStart?.();
    });

    a.addEventListener('canplay', () => {
      if (a !== activeAudio) return;
      onCanPlay?.();
    });
  }

  bindAudioEvents(audio);
  bindAudioEvents(audio2);

  // ---- Queue Management ----

  function getQueue() {
    return [...queue];
  }

  function getCurrentTrack() {
    if (currentIndex < 0 || currentIndex >= queue.length) return null;
    return queue[currentIndex];
  }

  function getCurrentIndex() {
    return currentIndex;
  }

  function setQueue(songs, startIndex = 0) {
    queue = songs.map(s => ({ ...s }));
    currentIndex = startIndex;
    if (shuffleMode) generateShuffledIndices();
    onQueueUpdate?.(queue, currentIndex);
  }

  function addToQueue(song) {
    queue.push({ ...song });
    if (shuffleMode) generateShuffledIndices();
    onQueueUpdate?.(queue, currentIndex);
  }

  function removeFromQueue(index) {
    if (index < 0 || index >= queue.length) return;
    queue.splice(index, 1);
    if (index < currentIndex) currentIndex--;
    if (currentIndex >= queue.length) currentIndex = queue.length - 1;
    if (shuffleMode) generateShuffledIndices();
    onQueueUpdate?.(queue, currentIndex);
  }

  function clearQueue() {
    queue = [];
    currentIndex = -1;
    audio.pause();
    audio.src = '';
    isPlaying = false;
    onQueueUpdate?.(queue, currentIndex);
  }

  function playNext(song) {
    if (currentIndex === -1) {
      playSong(song);
    } else {
      queue.splice(currentIndex + 1, 0, { ...song });
      if (shuffleMode) generateShuffledIndices();
      onQueueUpdate?.(queue, currentIndex);
    }
  }

  // ---- Playback Controls ----

  async function playSong(song) {
    // If song is not in queue, add and play
    const existingIndex = queue.findIndex(q => q.id === song.id);
    if (existingIndex === -1) {
      queue.push({ ...song });
      currentIndex = queue.length - 1;
    } else {
      currentIndex = existingIndex;
    }

    await loadAndPlay(song);
    onQueueUpdate?.(queue, currentIndex);
  }

  async function loadAndPlay(song, isCrossfade = false) {
    try {
      // Fire track change immediately so UI artwork and title update instantly
      onTrackChange?.(song, currentIndex);

      const qual = Storage.getSettings().audioQuality || '320kbps';
      let streamUrl = null;

      if (song.raw && window.API && API.getDownloadUrl) {
        streamUrl = API.getDownloadUrl(song.raw, qual);
      } else if (song.downloadUrls && song.downloadUrls.length > 0) {
        const match = song.downloadUrls.find(u => u.quality === qual);
        streamUrl = match?.url || match?.link || song.streamUrl;
      } else {
        streamUrl = song.streamUrl;
      }

      // If no stream URL, fetch it
      if (!streamUrl) {
        const details = await API.getSongDetails(song.id);
        if (details && details.length > 0) {
          streamUrl = API.getDownloadUrl(details[0], qual);
          
          // Update song in queue with stream URL
          if (currentIndex >= 0 && queue[currentIndex]) {
            queue[currentIndex].streamUrl = streamUrl;
            queue[currentIndex] = { ...queue[currentIndex], ...API.normalizeSong(details[0]) };
          }
        }
      }

      if (!streamUrl) {
        console.error('[Player] No stream URL available for:', song.name);
        onError?.({ message: 'No stream URL available' });
        return;
      }

      if (isCrossfade) {
        // Swap active audio
        const oldAudio = activeAudio;
        activeAudio = inactiveAudio;
        inactiveAudio = oldAudio;
        
        activeAudio.src = streamUrl;
        activeAudio.volume = 0;
        await activeAudio.play();
        
        // Simple linear crossfade over 3 seconds
        let vol = 0;
        const fadeInt = setInterval(() => {
          vol += 0.05;
          if (vol >= 1) {
            activeAudio.volume = getVolume();
            oldAudio.pause();
            oldAudio.volume = getVolume();
            clearInterval(fadeInt);
          } else {
            activeAudio.volume = vol * getVolume();
            oldAudio.volume = (1 - vol) * getVolume();
          }
        }, 150);
      } else {
        activeAudio.src = streamUrl;
        activeAudio.volume = getVolume();
        await activeAudio.play();
      }

      // Track in recently played
      Storage.addRecent(getCurrentTrack());

      onTrackChange?.(getCurrentTrack(), currentIndex);
    } catch (error) {
      if (error.name === 'AbortError') return;
      console.error('[Player] Play error:', error);
      onError?.(error);
    }
  }

  function play() {
    if (activeAudio.src) {
      if (!audioCtx) initWebAudio();
      if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      activeAudio.play().catch(console.error);
    }
  }

  function pause() {
    activeAudio.pause();
  }

  function togglePlayPause() {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }

  async function next(isCrossfade = false) {
    if (queue.length === 0) return;

    let nextIndex;
    if (shuffleMode) {
      const shuffledPos = shuffledIndices.indexOf(currentIndex);
      nextIndex = shuffledIndices[(shuffledPos + 1) % shuffledIndices.length];
    } else {
      nextIndex = currentIndex + 1;
    }

    if (nextIndex >= queue.length) {
      if (repeatMode === 'all') {
        nextIndex = 0;
      } else {
        const settings = Storage.getSettings();
        if (settings.autoplay && queue[currentIndex]) {
          try {
            const currentTrack = queue[currentIndex];
            const artists = currentTrack.artists?.split(',') || [currentTrack.artist];
            const seedArtist = artists[Math.floor(Math.random() * artists.length)].trim();
            
            let query = seedArtist;
            if (Math.random() < 0.1) {
              query = "Trending Top Hits";
            }

            const res = await API.searchSongs(query, 15);
            
            const recentIds = Storage.getRecent().map(r => r.id);
            const queueIds = queue.map(q => q.id);
            
            const newSongs = res.filter(s => !queueIds.includes(s.id) && !recentIds.includes(s.id));
            
            if (newSongs.length > 0) {
              queue.push(newSongs[0]); 
              nextIndex = currentIndex + 1;
              if (shuffleMode) generateShuffledIndices();
            } else {
              return; 
            }
          } catch (e) {
            console.error('[Player] Autoplay fetch failed:', e);
            return;
          }
        } else {
          return; 
        }
      }
    }

    currentIndex = nextIndex;
    await loadAndPlay(queue[currentIndex], isCrossfade);
    onQueueUpdate?.(queue, currentIndex);
  }

  async function previous() {
    if (queue.length === 0) return;

    if (activeAudio.currentTime > 3) {
      activeAudio.currentTime = 0;
      return;
    }

    let prevIndex;
    if (shuffleMode) {
      const shuffledPos = shuffledIndices.indexOf(currentIndex);
      prevIndex = shuffledIndices[(shuffledPos - 1 + shuffledIndices.length) % shuffledIndices.length];
    } else {
      prevIndex = currentIndex - 1;
    }

    if (prevIndex < 0) {
      if (repeatMode === 'all') {
        prevIndex = queue.length - 1;
      } else {
        activeAudio.currentTime = 0;
        return;
      }
    }

    currentIndex = prevIndex;
    await loadAndPlay(queue[currentIndex]);
    onQueueUpdate?.(queue, currentIndex);
  }

  function seek(time) {
    if (activeAudio.duration) {
      activeAudio.currentTime = Math.max(0, Math.min(time, activeAudio.duration));
    }
  }

  function seekPercent(percent) {
    if (activeAudio.duration) {
      activeAudio.currentTime = (percent / 100) * activeAudio.duration;
    }
  }

  // ---- Volume ----

  function setVolume(vol) {
    activeAudio.volume = Math.max(0, Math.min(1, vol));
    Storage.updateSettings({ volume: activeAudio.volume });
  }

  function getVolume() {
    return activeAudio.volume;
  }

  function mute() {
    activeAudio.muted = !activeAudio.muted;
    return activeAudio.muted;
  }

  // ---- Repeat & Shuffle ----

  function setRepeatMode(mode) {
    repeatMode = mode;
    Storage.updateSettings({ repeat: mode });
  }

  function cycleRepeat() {
    const modes = ['off', 'all', 'one'];
    const nextIdx = (modes.indexOf(repeatMode) + 1) % modes.length;
    repeatMode = modes[nextIdx];
    Storage.updateSettings({ repeat: repeatMode });
    return repeatMode;
  }

  function getRepeatMode() {
    return repeatMode;
  }

  function toggleShuffle() {
    shuffleMode = !shuffleMode;
    if (shuffleMode) generateShuffledIndices();
    Storage.updateSettings({ shuffle: shuffleMode });
    return shuffleMode;
  }

  function getShuffleMode() {
    return shuffleMode;
  }

  function generateShuffledIndices() {
    shuffledIndices = Array.from({ length: queue.length }, (_, i) => i);
    for (let i = shuffledIndices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledIndices[i], shuffledIndices[j]] = [shuffledIndices[j], shuffledIndices[i]];
    }
    if (currentIndex >= 0) {
      const pos = shuffledIndices.indexOf(currentIndex);
      if (pos > 0) {
        [shuffledIndices[0], shuffledIndices[pos]] = [shuffledIndices[pos], shuffledIndices[0]];
      }
    }
  }

  // ---- Internal ----

  function handleTrackEnd() {
    if (sleepTimerId === 'song') {
      pause();
      sleepTimerMinutes = 0;
      sleepTimerId = null;
      onSleepTimer?.();
      return;
    }
    
    if (repeatMode === 'one') {
      activeAudio.currentTime = 0;
      activeAudio.play().catch(console.error);
    } else {
      next(false);
    }
  }

  function updateMediaSession() {
    if (!('mediaSession' in navigator)) return;
    const track = getCurrentTrack();
    if (!track) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.name,
      artist: track.artists,
      album: track.album,
      artwork: track.image ? [
        { src: track.image, sizes: '500x500', type: 'image/jpeg' }
      ] : [],
    });

    navigator.mediaSession.setActionHandler('play', play);
    navigator.mediaSession.setActionHandler('pause', pause);
    navigator.mediaSession.setActionHandler('previoustrack', previous);
    navigator.mediaSession.setActionHandler('nexttrack', next);
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime != null) seek(details.seekTime);
    });
  }

  // ---- Sleep Timer & Speed ----

  function setSleepTimer(minutes) {
    if (sleepTimerId && sleepTimerId !== 'song') clearTimeout(sleepTimerId);
    if (sleepTimerId) clearTimeout(sleepTimerId);
    sleepTimerMinutes = minutes;
    if (minutes > 0) {
      const ms = minutes * 60 * 1000;
      const fadeStartMs = Math.max(0, ms - 10000); // 10s before end
      
      sleepTimerId = setTimeout(() => {
        let startVol = activeAudio.volume;
        let fadeStep = startVol / 20;
        let fadeInterval = setInterval(() => {
          if (activeAudio.volume > fadeStep) {
            activeAudio.volume -= fadeStep;
          } else {
            clearInterval(fadeInterval);
            pause();
            activeAudio.volume = startVol;
            sleepTimerMinutes = 0;
            sleepTimerId = null;
            onSleepTimer?.(0);
          }
        }, 500);
      }, fadeStartMs);
      onSleepTimer?.(minutes);
    } else {
      sleepTimerId = null;
      onSleepTimer?.(0);
    }
  }

  function getSleepTimerMinutes() {
    return sleepTimerMinutes;
  }

  // ---- EQ Presets ----

  const EQ_PRESETS = {
    flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    bass: [7, 6, 5, 3, 1, 0, 0, 0, 0, 0],
    vocal: [-2, -1, 1, 3, 5, 4, 3, 1, 0, -1],
    treble: [-3, -2, 0, 1, 2, 4, 6, 7, 8, 8],
    party: [5, 4, 2, 0, 0, 2, 4, 5, 5, 5],
    chill: [2, 1, 0, 1, 2, 2, 1, 0, -1, -2]
  };

  function applyEqPreset(presetName) {
    const preset = EQ_PRESETS[presetName] || EQ_PRESETS.flat;
    preset.forEach((gain, i) => setEqBand(i, gain));
    Storage.updateSettings({ eqPreset: presetName, eq: preset });
    return preset;
  }

  // ---- 3D Spatial Surround ----

  let isSpatialEnabled = false;

  function toggleSpatialAudio() {
    isSpatialEnabled = !isSpatialEnabled;
    Storage.updateSettings({ spatialAudio: isSpatialEnabled });
    return isSpatialEnabled;
  }

  // ---- Ambient Focus Sound Generator ----

  let ambientSource = null;
  let ambientGainNode = null;
  let activeAmbientType = 'off';

  function playAmbientSound(type = 'off', volume = 0.4) {
    if (!audioCtx) initWebAudio();
    if (!audioCtx) return;

    if (ambientSource) {
      try { ambientSource.stop(); } catch(e){}
      ambientSource = null;
    }

    activeAmbientType = type;
    if (type === 'off') return;

    const bufferSize = audioCtx.sampleRate * 2;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);

    if (type === 'rain') {
      let b0=0, b1=0, b2=0, b3=0, b4=0, b5=0, b6=0;
      for (let i = 0; i < bufferSize; i++) {
        let white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.08;
        b6 = white * 0.115926;
      }
    } else if (type === 'binaural' || type === 'lofi') {
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.sin(2 * Math.PI * 110 * (i / audioCtx.sampleRate)) * 0.1 + (Math.random() * 0.03);
      }
    }

    ambientSource = audioCtx.createBufferSource();
    ambientSource.buffer = buffer;
    ambientSource.loop = true;

    if (!ambientGainNode) {
      ambientGainNode = audioCtx.createGain();
    }
    ambientGainNode.gain.value = volume;

    ambientSource.connect(ambientGainNode);
    ambientGainNode.connect(audioCtx.destination);
    ambientSource.start();
  }

  function setAmbientVolume(vol) {
    if (ambientGainNode) {
      ambientGainNode.gain.value = Math.max(0, Math.min(1, vol));
    }
  }

  function setPlaybackSpeed(speed) {
    playbackSpeed = Math.max(0.5, Math.min(2.0, speed));
    activeAudio.playbackRate = playbackSpeed;
    inactiveAudio.playbackRate = playbackSpeed;
    Storage.updateSettings({ playbackSpeed });
  }

  function getPlaybackSpeed() {
    return playbackSpeed;
  }

  function setEqBand(index, gain) {
    if (eqBands[index]) {
      eqBands[index].gain.value = gain;
    }
  }

  function getAnalyserNode() {
    return analyserNode;
  }

  function getStreamCodecDisplay() {
    if (!queue[currentIndex]) return '';
    const qual = Storage.getSettings().audioQuality || '320kbps';
    if (qual === 'auto' || qual === '320kbps') return '320 kbps AAC';
    if (qual === '256kbps') return '256 kbps AAC';
    if (qual === '192kbps') return '192 kbps AAC';
    if (qual === '128kbps') return '128 kbps AAC';
    if (qual === '64kbps') return '64 kbps AAC';
    return '';
  }

  // ---- State Getters ----

  function getState() {
    return {
      isPlaying,
      currentTrack: getCurrentTrack(),
      currentIndex,
      queue: [...queue],
      currentTime: activeAudio.currentTime,
      duration: activeAudio.duration || 0,
      volume: activeAudio.volume,
      muted: activeAudio.muted,
      repeatMode,
      shuffleMode,
    };
  }

  function getDuration() {
    return activeAudio.duration || 0;
  }

  function getCurrentTime() {
    return activeAudio.currentTime;
  }

  function getIsPlaying() {
    return isPlaying;
  }

  // ---- Event Registration ----

  function on(event, callback) {
    switch (event) {
      case 'play': onPlay = callback; break;
      case 'pause': onPause = callback; break;
      case 'timeupdate': onTimeUpdate = callback; break;
      case 'trackchange': onTrackChange = callback; break;
      case 'ended': onEnded = callback; break;
      case 'error': onError = callback; break;
      case 'queueupdate': onQueueUpdate = callback; break;
      case 'loadstart': onLoadStart = callback; break;
      case 'canplay': onCanPlay = callback; break;
      case 'sleeptimer': onSleepTimer = callback; break;
    }
  }

  return {
    playSong,
    play,
    pause,
    togglePlayPause,
    next,
    previous,
    seek,
    seekPercent,
    setVolume,
    getVolume,
    mute,
    setRepeatMode,
    cycleRepeat,
    getRepeatMode,
    toggleShuffle,
    getShuffleMode,
    getQueue,
    getCurrentTrack,
    getCurrentIndex,
    setQueue,
    addToQueue,
    removeFromQueue,
    clearQueue,
    playNext,
    getState,
    getDuration,
    getCurrentTime,
    getIsPlaying,
    on,
    setPlaybackSpeed,
    getPlaybackSpeed,
    setEqBand,
    getAnalyserNode,
    setSleepTimer,
    getSleepTimerMinutes,
    applyEqPreset,
    toggleSpatialAudio,
    playAmbientSound,
    setAmbientVolume,
    getStreamCodecDisplay
  };
})();
