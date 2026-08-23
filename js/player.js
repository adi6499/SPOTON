// ========================================
// MusicFlow — Audio Player Engine
// ========================================

const Player = (() => {
  let audio = document.getElementById('main-audio') || new Audio();
  let audio2 = document.getElementById('crossfade-audio') || new Audio();

  if (!document.getElementById('main-audio')) {
    audio.id = 'main-audio';
    audio.style.display = 'none';
    if (document.body) document.body.appendChild(audio);
    else document.addEventListener('DOMContentLoaded', () => document.body.appendChild(audio));
  }
  if (!document.getElementById('crossfade-audio')) {
    audio2.id = 'crossfade-audio';
    audio2.style.display = 'none';
    if (document.body) document.body.appendChild(audio2);
    else document.addEventListener('DOMContentLoaded', () => document.body.appendChild(audio2));
  }
  let activeAudio = audio;
  let inactiveAudio = audio2;
  
  const isMobile = typeof navigator !== 'undefined' && (
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
  const isIOS = typeof navigator !== 'undefined' && (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );

  [audio, audio2].forEach(a => {
    a.preload = 'auto';
    a.playsInline = true;
    a.setAttribute('playsinline', 'true');
    a.setAttribute('webkit-playsinline', 'true');
    if (!isMobile) {
      a.crossOrigin = 'anonymous';
      a.setAttribute('crossorigin', 'anonymous');
    }
    if (!a.parentNode && document.body) {
      document.body.appendChild(a);
    }
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
  let targetVolume = 0.8;
  let gaplessPrefetchedUrl = null;
  let _lastErrorToastTime = 0;

  function showPlayerErrorToast(msg) {
    const now = Date.now();
    if (now - _lastErrorToastTime > 2000) {
      _lastErrorToastTime = now;
      if (typeof UI !== 'undefined' && UI.showToast) {
        UI.showToast(msg, 'warning');
      }
    }
  }

  // Web Audio API Context (Initialized on demand to protect background audio playback)
  let audioCtx = null;
  let sourceNode1 = null;
  let sourceNode2 = null;
  let gainNode = null;
  let analyserNode = null;
  let volumeNormalizer = null;
  let eqFilters = [];
  let spatialPresenceFilter = null;
  let spatialAirFilter = null;
  let spatialCrossfeedNode = null;
  let spatialCrossfeedGain = null;
  let dryMasterGain = null;
  let isSpatialEnabled = false;

  const EQ_FREQUENCIES = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

  function initWebAudio() {
    // On mobile devices, skip Web Audio to guarantee 100% stable lockscreen & background audio
    if (isMobile) return;
    if (!audioCtx) {
      try {
        const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
        if (AudioCtxClass) {
          audioCtx = new AudioCtxClass();
          const inputGain = audioCtx.createGain();
          gainNode = inputGain;
          gainNode.gain.value = targetVolume;

          eqFilters = EQ_FREQUENCIES.map((freq, idx) => {
            const eq = audioCtx.createBiquadFilter();
            if (idx === 0) {
              eq.type = 'lowshelf';
            } else if (idx === EQ_FREQUENCIES.length - 1) {
              eq.type = 'highshelf';
            } else {
              eq.type = 'peaking';
              eq.Q.value = 1.4;
            }
            eq.frequency.value = freq;
            eq.gain.value = 0;
            return eq;
          });

          inputGain.connect(eqFilters[0]);
          for (let i = 0; i < eqFilters.length - 1; i++) {
            eqFilters[i].connect(eqFilters[i + 1]);
          }

          // 3D Spatial Surround Binaural Acoustic Processor
          spatialPresenceFilter = audioCtx.createBiquadFilter();
          spatialPresenceFilter.type = 'peaking';
          spatialPresenceFilter.frequency.value = 3200; // Ear-canal HRTF presence band
          spatialPresenceFilter.Q.value = 1.2;
          spatialPresenceFilter.gain.value = 0;

          spatialAirFilter = audioCtx.createBiquadFilter();
          spatialAirFilter.type = 'highshelf';
          spatialAirFilter.frequency.value = 8500; // Spatial air dimension
          spatialAirFilter.gain.value = 0;

          spatialCrossfeedNode = audioCtx.createDelay ? audioCtx.createDelay(0.01) : null;
          if (spatialCrossfeedNode) {
            spatialCrossfeedNode.delayTime.value = 0.00028; // 280µs interaural time difference
          }
          spatialCrossfeedGain = audioCtx.createGain ? audioCtx.createGain() : null;
          if (spatialCrossfeedGain) {
            spatialCrossfeedGain.gain.value = 0;
          }

          dryMasterGain = audioCtx.createGain();
          dryMasterGain.gain.value = 1.0;

          const lastEq = eqFilters[eqFilters.length - 1];
          lastEq.connect(spatialPresenceFilter);
          spatialPresenceFilter.connect(spatialAirFilter);
          spatialAirFilter.connect(dryMasterGain);

          if (spatialCrossfeedNode && spatialCrossfeedGain) {
            spatialAirFilter.connect(spatialCrossfeedNode);
            spatialCrossfeedNode.connect(spatialCrossfeedGain);
            spatialCrossfeedGain.connect(dryMasterGain);
          }

          analyserNode = audioCtx.createAnalyser();
          analyserNode.fftSize = 128;
          analyserNode.smoothingTimeConstant = 0.35;
          dryMasterGain.connect(analyserNode);

          volumeNormalizer = audioCtx.createDynamicsCompressor();
          volumeNormalizer.threshold.setValueAtTime(-24, audioCtx.currentTime);
          volumeNormalizer.knee.setValueAtTime(30, audioCtx.currentTime);
          volumeNormalizer.ratio.setValueAtTime(12, audioCtx.currentTime);
          volumeNormalizer.attack.setValueAtTime(0.003, audioCtx.currentTime);
          volumeNormalizer.release.setValueAtTime(0.25, audioCtx.currentTime);

          analyserNode.connect(volumeNormalizer);
          volumeNormalizer.connect(audioCtx.destination);

          // Connect HTML5 audio elements on desktop (mobile uses native audio pipeline for background & lockscreen)
          if (!isMobile) {
            if (audio && !sourceNode1) {
              try {
                sourceNode1 = audioCtx.createMediaElementSource(audio);
                sourceNode1.connect(inputGain);
              } catch (_) {}
            }
            if (audio2 && !sourceNode2) {
              try {
                sourceNode2 = audioCtx.createMediaElementSource(audio2);
                sourceNode2.connect(inputGain);
              } catch (_) {}
            }
          }

          // Apply saved settings
          const settings = (typeof Storage !== 'undefined' ? Storage.getSettings() : {}) || {};
          if (settings.eq && Array.isArray(settings.eq)) {
            settings.eq.forEach((g, i) => setEqBand(i, g));
          }
          if (settings.spatialAudio) {
            toggleSpatialAudio(true);
          }
        }
      } catch (e) {
        console.warn('[Player] Web Audio API init:', e);
      }
    }

    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
  }

  function setEqBand(index, gain) {
    if (!audioCtx) initWebAudio();
    if (eqFilters && eqFilters[index] && audioCtx) {
      try {
        eqFilters[index].gain.setValueAtTime(parseFloat(gain) || 0, audioCtx.currentTime);
      } catch (_) {
        try { eqFilters[index].gain.value = parseFloat(gain) || 0; } catch (e) {}
      }
    }
  }

  function toggleSpatialAudio(enable) {
    if (!audioCtx) initWebAudio();
    isSpatialEnabled = enable !== undefined ? enable : !isSpatialEnabled;
    Storage.updateSettings({ spatialAudio: isSpatialEnabled });

    if (audioCtx) {
      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }
      const targetGain = isSpatialEnabled ? 3.5 : 0;
      const targetAir = isSpatialEnabled ? 2.8 : 0;
      const targetCrossfeed = isSpatialEnabled ? 0.35 : 0;

      try {
        if (spatialPresenceFilter) {
          spatialPresenceFilter.gain.cancelScheduledValues(audioCtx.currentTime);
          spatialPresenceFilter.gain.setValueAtTime(targetGain, audioCtx.currentTime);
        }
        if (spatialAirFilter) {
          spatialAirFilter.gain.cancelScheduledValues(audioCtx.currentTime);
          spatialAirFilter.gain.setValueAtTime(targetAir, audioCtx.currentTime);
        }
        if (spatialCrossfeedGain) {
          spatialCrossfeedGain.gain.cancelScheduledValues(audioCtx.currentTime);
          spatialCrossfeedGain.gain.setValueAtTime(targetCrossfeed, audioCtx.currentTime);
        }
        if (dryMasterGain) {
          dryMasterGain.gain.cancelScheduledValues(audioCtx.currentTime);
          dryMasterGain.gain.setValueAtTime(1.0, audioCtx.currentTime);
        }
        if (gainNode) {
          gainNode.gain.cancelScheduledValues(audioCtx.currentTime);
          gainNode.gain.setValueAtTime(targetVolume, audioCtx.currentTime);
        }
      } catch (e) {
        console.warn('[Player] Spatial audio param update error:', e);
      }
    }
    return isSpatialEnabled;
  }

  // Mobile Audio Background & Lifecycle Keepalive
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      if ('mediaSession' in navigator) {
        try {
          navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
        } catch (_) {}
      }
    } else if (document.visibilityState === 'visible') {
      // Resume AudioContext only on non-iOS
      if (!isIOS && audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }
      // Sync UI state with actual audio element state
      if (activeAudio) {
        const isAudioActive = !activeAudio.paused && !activeAudio.ended;
        if (isAudioActive !== isPlaying) {
          isPlaying = isAudioActive;
          if (isPlaying) onPlay?.();
          else onPause?.();
        }
      }
    }
  });

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

  // Session restore state
  let resumeSeekOnce = null; // { id, pos } applied once on next successful load
  let lastSessionPersist = 0;

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
  let onSleepTimer = null;

  // Initialize settings
  const settings = Storage.getSettings();
  targetVolume = settings.volume !== undefined ? settings.volume : 0.8;
  audio.volume = targetVolume;
  audio2.volume = targetVolume;
  repeatMode = settings.repeat || 'off';
  shuffleMode = settings.shuffle || false;

  // ---- Audio Event Listeners ----

  function bindAudioEvents(a) {
    a.addEventListener('play', () => {
      if (a !== activeAudio) return;
      isPlaying = true;
      onPlay?.();
      if ('mediaSession' in navigator) {
        try {
          navigator.mediaSession.playbackState = 'playing';
        } catch (e) {}
      }
    });

    a.addEventListener('pause', () => {
      if (a !== activeAudio) return;
      isPlaying = false;
      onPause?.();
      if ('mediaSession' in navigator) {
        try {
          navigator.mediaSession.playbackState = 'paused';
        } catch (e) {}
      }
    });

    a.addEventListener('timeupdate', () => {
      if (a !== activeAudio) return;
      
      // Crossfade / Gapless logic trigger
      const settings = Storage.getSettings();
      const crossfadeConfig = settings.crossfade || { enabled: false, duration: 0 };
      const prefetchTime = crossfadeConfig.enabled ? (crossfadeConfig.duration || 3) : 10; // Prefetch 10s early for gapless
      
      if (a.duration && a.duration - a.currentTime <= prefetchTime && !a._isFading) {
        a._isFading = true;
        if (crossfadeConfig.enabled && crossfadeConfig.duration > 0) {
          next(true); // Trigger next with crossfade flag
        } else {
          // Gapless: just prefetch the next track URL but don't play yet
          checkAndPrefetchGapless();
        }
      }

      // Persist session (queue + position) every ~5s while playing
      const nowTs = Date.now();
      if (nowTs - lastSessionPersist > 5000) {
        lastSessionPersist = nowTs;
        persistSession();
      }

      onTimeUpdate?.({
        currentTime: a.currentTime,
        duration: a.duration || 0,
        progress: a.duration ? (a.currentTime / a.duration) * 100 : 0,
      });

      // Periodically persist podcast progress
      const currentTrack = getCurrentTrack();
      if (currentTrack && currentTrack.isPodcast && typeof Storage !== 'undefined' && Storage.savePodcastProgress) {
        if (Math.floor(a.currentTime) % 4 === 0) {
          Storage.savePodcastProgress(currentTrack.id, a.currentTime);
        }
      }

      // Update lock screen progress
      if ('mediaSession' in navigator && a.duration && isFinite(a.duration)) {
        try {
          navigator.mediaSession.setPositionState({
            duration: a.duration,
            playbackRate: a.playbackRate || 1,
            position: Math.min(a.currentTime, a.duration)
          });
        } catch (e) {
          // Ignore state errors if track changed rapidly
        }
      }
    });

    a.addEventListener('ended', () => {
      if (a !== activeAudio) return;
      a._isFading = false;
      onEnded?.();
      handleTrackEnd();
    });

    a.addEventListener('error', (e) => {
      if (a !== activeAudio) return;
      console.warn('[Player] Audio error on active element:', e);
      onError?.(e);

      const currentTrack = (currentIndex >= 0 && queue[currentIndex]) ? queue[currentIndex] : getCurrentTrack();
      const trackTitle = currentTrack?.name || 'Current track';
      showPlayerErrorToast(`Track "${trackTitle}" unavailable. Auto-skipping...`);

      if (queue.length > 1) {
        setTimeout(() => {
          if (activeAudio === a) {
            next(false);
          }
        }, 400);
      }
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

  // ---- Session Persistence (Continue where you left off) ----

  function slimTrack(s) {
    if (!s) return null;
    return {
      id: s.id, name: s.name, title: s.title || s.name,
      artists: s.artists, artist: s.artist || s.artists,
      album: s.album, duration: s.duration,
      image: typeof s.image === 'string' ? s.image : '',
      imageUrl: typeof s.imageUrl === 'string' ? s.imageUrl : '',
      streamUrl: s.streamUrl || '', audioUrl: s.audioUrl || '',
      downloadUrls: Array.isArray(s.downloadUrls) ? s.downloadUrls.slice(0, 6) : [],
      year: s.year || '', language: s.language || ''
    };
  }

  function persistSession() {
    try {
      const payload = {
        v: 1,
        queue: queue.slice(0, 150).map(slimTrack).filter(Boolean),
        index: currentIndex,
        position: (activeAudio && isFinite(activeAudio.currentTime)) ? Math.floor(activeAudio.currentTime) : 0,
        ts: Date.now()
      };
      localStorage.setItem('mf_queue', JSON.stringify(payload));
    } catch (e) { /* quota or serialization issue: non-fatal */ }
  }

  function restoreSession() {
    try {
      const raw = localStorage.getItem('mf_queue');
      if (!raw) return null;
      const payload = JSON.parse(raw);
      if (!payload || !Array.isArray(payload.queue) || payload.queue.length === 0) return null;
      // Don't clobber an active queue (e.g. a deep link already started playback)
      if (queue.length > 0) return null;

      queue = payload.queue.filter(s => s && (s.id || s.name));
      currentIndex = Math.max(0, Math.min(payload.index || 0, queue.length - 1));
      if (shuffleMode) generateShuffledIndices();

      const track = queue[currentIndex] || null;
      if (track && payload.position > 5 && (!track.duration || payload.position < track.duration - 5)) {
        resumeSeekOnce = { id: track.id, pos: payload.position };
      }

      onQueueUpdate?.(queue, currentIndex);
      if (track) onTrackChange?.(track, currentIndex);
      return { track, position: resumeSeekOnce ? resumeSeekOnce.pos : 0, queueLength: queue.length };
    } catch (e) {
      return null;
    }
  }

  window.addEventListener('beforeunload', persistSession);

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
    if (!Array.isArray(songs)) {
      queue = [];
      currentIndex = -1;
      return;
    }
    queue = songs
      .filter(s => s && (s.id || s.name))
      .map(s => (window.API && API.normalizeSong) ? API.normalizeSong(s) : { ...s });

    currentIndex = Math.max(0, Math.min(startIndex, queue.length - 1));
    if (shuffleMode) generateShuffledIndices();
    onQueueUpdate?.(queue, currentIndex);
  }

  function addToQueue(song) {
    if (!song) return;
    const norm = (window.API && API.normalizeSong) ? API.normalizeSong(song) : { ...song };
    queue.push(norm);
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
    if (!song) return;
    const norm = (window.API && API.normalizeSong) ? API.normalizeSong(song) : { ...song };
    if (currentIndex === -1) {
      playSong(norm);
    } else {
      queue.splice(currentIndex + 1, 0, norm);
      if (shuffleMode) generateShuffledIndices();
      onQueueUpdate?.(queue, currentIndex);
    }
  }

  // ---- Playback Controls ----

  async function playAtIndex(index) {
    if (index < 0 || index >= queue.length) return;
    currentIndex = index;
    await loadAndPlay(queue[currentIndex]);
    onQueueUpdate?.(queue, currentIndex);
  }

  async function playSong(song, explicitIndex = null) {
    if (!song) return;
    const normalized = (window.API && API.normalizeSong) ? API.normalizeSong(song) : { ...song };

    if (explicitIndex !== null && explicitIndex >= 0 && explicitIndex < queue.length) {
      currentIndex = explicitIndex;
    } else {
      const existingIndex = queue.findIndex(q => q.id === normalized.id);
      if (existingIndex === -1) {
        queue.push(normalized);
        currentIndex = queue.length - 1;
      } else {
        currentIndex = existingIndex;
      }
    }

    await loadAndPlay(queue[currentIndex] || normalized);
    onQueueUpdate?.(queue, currentIndex);
  }

  // Active crossfade interval reference
  let activeCrossfadeTimer = null;

  function stopInactiveAudio() {
    if (activeCrossfadeTimer) {
      clearInterval(activeCrossfadeTimer);
      activeCrossfadeTimer = null;
    }
    try {
      inactiveAudio.pause();
      inactiveAudio.currentTime = 0;
    } catch (_) {}
    inactiveAudio._isFading = false;
    activeAudio._isFading = false;
    inactiveAudio.volume = getVolume();
  }

  let _loadId = 0; // Guard against concurrent/double play calls

  async function loadAndPlay(song, isCrossfade = false) {
    if (!song) return;
    const thisLoadId = ++_loadId; // Increment to cancel any previous pending load
    const isFading = (isCrossfade === true);
    const trackToPlay = (window.API && API.normalizeSong) ? API.normalizeSong(song) : { ...song };
    let updatedSong = trackToPlay;

    try {
      if (!isFading) {
        stopInactiveAudio();
      }

      // Fire track change immediately so UI shows something right away
      onTrackChange?.(trackToPlay, currentIndex);

      let qual = getAdaptiveQuality(Storage.getSettings().audioQuality || 'auto');
      let streamUrl = song.audioUrl || song.streamUrl || null;

      // 0. Check offline IndexedDB cache first
      if (typeof SmartDownloads !== 'undefined' && SmartDownloads.getOfflineAudioUrl) {
        try {
          const offlineUrl = await SmartDownloads.getOfflineAudioUrl(trackToPlay.id);
          if (offlineUrl) {
            streamUrl = offlineUrl;
            console.log(`[Player] Playing "${trackToPlay.name}" directly from offline IndexedDB cache`);
          }
        } catch (_) {}
      }

      // Extract available stream URLs in order of preference
      function extractCandidateStreams(songObj) {
        const urls = [];
        if (songObj.downloadUrls && Array.isArray(songObj.downloadUrls)) {
          const match = songObj.downloadUrls.find(u => u.quality === qual);
          if (match?.url || match?.link) urls.push(match.url || match.link);
          songObj.downloadUrls.forEach(u => {
            const url = u.url || u.link;
            if (url && !urls.includes(url)) urls.push(url);
          });
        }
        if (songObj.raw && window.API && API.getDownloadUrl) {
          const u = API.getDownloadUrl(songObj.raw, qual);
          if (u && !urls.includes(u)) urls.push(u);
        }
        if (songObj.streamUrl && !urls.includes(songObj.streamUrl)) urls.push(songObj.streamUrl);
        if (songObj.audioUrl && !urls.includes(songObj.audioUrl)) urls.push(songObj.audioUrl);
        return urls.filter(u => typeof u === 'string' && u.startsWith('http'));
      }

      let rawCandidateUrls = [];
      if (streamUrl) {
        rawCandidateUrls.push(streamUrl);
      } else {
        rawCandidateUrls = extractCandidateStreams(song);
      }

      // Build proxy & direct candidate list to guarantee clean Web Audio CORS stream
      let candidateUrls = [];
      const isLocalServer = (
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname.startsWith('192.168.') ||
        window.location.hostname.startsWith('10.') ||
        window.location.hostname.startsWith('172.') ||
        window.location.port === '5500' ||
        window.location.protocol === 'http:'
      );
      rawCandidateUrls.forEach(url => {
        // On mobile devices, always use direct CDN URLs for instant zero-latency stream start
        if (!isMobile && isLocalServer && url.includes('saavncdn.com')) {
          candidateUrls.push(`/api/proxy-audio?url=${encodeURIComponent(url)}`);
        }
        candidateUrls.push(url);
      });

      // If no candidate stream URLs, fetch full song details
      if (candidateUrls.length === 0 && song.id) {
        try {
          const details = await API.getSongDetails(song.id);
          if (details && details.length > 0) {
            const normalized = API.normalizeSong(details[0]);
            updatedSong = { ...trackToPlay, ...normalized };
            candidateUrls = extractCandidateStreams(normalized);
            if (currentIndex >= 0 && currentIndex < queue.length) {
              queue[currentIndex] = { ...queue[currentIndex], ...normalized };
            }
          }
        } catch (_) {}
      }

      // Live mirror fallback search if still no candidate stream
      if (candidateUrls.length === 0 && song.name) {
        try {
          const searchKey = `${song.name} ${song.artists || song.artist || ''}`.trim();
          const searchHits = await API.searchSongs(searchKey, 3);
          if (searchHits && searchHits.length > 0) {
            for (const hit of searchHits) {
              const normHit = API.normalizeSong(hit);
              const hitStreams = extractCandidateStreams(normHit);
              if (hitStreams.length > 0) {
                candidateUrls = hitStreams;
                updatedSong = { ...trackToPlay, ...normHit };
                break;
              }
            }
          }
        } catch (_) {}
      }

      if (candidateUrls.length === 0) {
        console.warn('[Player] No stream URL available for:', song.name);
        showPlayerErrorToast(`Track "${song.name}" unavailable. Auto-skipping...`);
        onError?.({ message: 'No stream URL available', song });
        if (queue.length > 1) {
          setTimeout(() => next(false), 500);
        }
        return;
      }

      // Check again if a newer load was triggered
      if (thisLoadId !== _loadId) {
        stopInactiveAudio();
        return;
      }

      streamUrl = candidateUrls[0];

      // Attempt playback with candidate streams
      let playedSuccessfully = false;
      for (let i = 0; i < candidateUrls.length; i++) {
        const testUrl = candidateUrls[i];
        try {
          if (isFading) {
            stopInactiveAudio();
            const oldAudio = activeAudio;
            activeAudio = inactiveAudio;
            inactiveAudio = oldAudio;
            
            activeAudio.src = testUrl;
            activeAudio.volume = 0;
            await activeAudio.play();
            
            const durationSecs = Storage.getSettings().crossfade?.duration || 3;
            const intervalMs = 150;
            const steps = (durationSecs * 1000) / intervalMs;
            const volStep = 1 / steps;
            
            let vol = 0;
            const currentTargetVol = getVolume();
            activeCrossfadeTimer = setInterval(() => {
              vol += volStep;
              if (vol >= 1) {
                activeAudio.volume = currentTargetVol;
                oldAudio.pause();
                oldAudio.currentTime = 0;
                oldAudio.volume = currentTargetVol;
                oldAudio._isFading = false;
                activeAudio._isFading = false;
                if (activeCrossfadeTimer) {
                  clearInterval(activeCrossfadeTimer);
                  activeCrossfadeTimer = null;
                }
              } else {
                activeAudio.volume = vol * currentTargetVol;
                oldAudio.volume = Math.max(0, (1 - vol) * currentTargetVol);
              }
            }, intervalMs);
          } else {
            stopInactiveAudio();
            if (gaplessPrefetchedUrl === testUrl && inactiveAudio.src === testUrl) {
              const oldAudio = activeAudio;
              activeAudio = inactiveAudio;
              inactiveAudio = oldAudio;
              oldAudio.pause();
              oldAudio.currentTime = 0;
            } else {
              activeAudio.src = testUrl;
            }
            activeAudio.muted = false;
            activeAudio.volume = Math.max(0.1, getVolume());
            await activeAudio.play();
            gaplessPrefetchedUrl = null;
          }
          playedSuccessfully = true;
          // Apply one-shot resume position (Continue where you left off)
          if (resumeSeekOnce) {
            if (resumeSeekOnce.id === trackToPlay.id) {
              const pos = resumeSeekOnce.pos;
              try { activeAudio.currentTime = pos; } catch (e) {
                activeAudio.addEventListener('loadedmetadata', () => { try { activeAudio.currentTime = pos; } catch (_) {} }, { once: true });
              }
            }
            resumeSeekOnce = null;
          }
          persistSession();
          break;
        } catch (streamErr) {
          if (streamErr.name === 'AbortError') return;
          if (streamErr.name === 'NotAllowedError') {
            console.warn('[Player] Autoplay blocked by browser. User must tap play.');
            isPlaying = false;
            onPause?.();
            return;
          }
          console.warn(`[Player] Stream quality ${i} failed for ${song.name}, trying next fallback...`, streamErr);
        }
      }

      if (!playedSuccessfully) {
        // Automatic live mirror fallback search
        try {
          const cleanName = (song.name || song.title || '').replace(/\(.*?\)|\[.*?\]|-.*$/g, '').trim();
          const cleanArtist = (song.artists || song.artist || '').split(',')[0].split('&')[0].trim();
          const mirrorQuery = `${cleanName} ${cleanArtist}`.trim();
          if (mirrorQuery && window.API && API.searchSongs) {
            console.log(`[Player] Searching live mirror stream for "${mirrorQuery}"...`);
            const mirrorHits = await API.searchSongs(mirrorQuery, 5);
            if (mirrorHits && mirrorHits.length > 0) {
              for (const hit of mirrorHits) {
                const normHit = API.normalizeSong(hit);
                const hitStreams = extractCandidateStreams(normHit);
                for (const mirrorStream of hitStreams) {
                  try {
                    activeAudio.src = mirrorStream;
                    activeAudio.muted = false;
                    activeAudio.volume = Math.max(0.1, getVolume());
                    await activeAudio.play();
                    playedSuccessfully = true;
                    updatedSong = { ...trackToPlay, ...normHit };
                    if (currentIndex >= 0 && currentIndex < queue.length) {
                      queue[currentIndex] = { ...queue[currentIndex], ...normHit };
                    }
                    break;
                  } catch (_) {}
                }
                if (playedSuccessfully) break;
              }
            }
          }
        } catch (_) {}
      }

      if (!playedSuccessfully) {
        throw new Error(`Failed to load any audio stream for "${song.name}"`);
      }

      // Track in recently played
      Storage.addRecent(updatedSong);

      // Fire track change again with updated song data (correct image/metadata)
      onTrackChange?.(updatedSong, currentIndex);
      updateMediaSession(updatedSong);
    } catch (error) {
      if (error.name === 'AbortError') return;
      if (error.name === 'NotAllowedError') {
        console.warn('[Player] Autoplay blocked by browser. User must click play.');
        isPlaying = false;
        onPause?.();
        return;
      }
      console.error('[Player] Play error:', error);
      showPlayerErrorToast(`⚠️ Cannot play "${trackToPlay?.name || 'track'}". Skipping...`);
      onError?.(error);
      if (queue.length > 1) {
        setTimeout(() => next(false), 500);
      }
    }
    
    // Background prefetch for autoplay to prevent async NotAllowedError on track end
    checkAndPrefetchAutoplay();
  }

  async function checkAndPrefetchAutoplay() {
    const settings = (typeof Storage !== 'undefined' && Storage.getSettings) ? Storage.getSettings() : {};
    if (settings.autoplay === false || queue.length === 0) return;
    
    // Prefetch whenever we are within 2 songs of the end of the queue (and not repeating a single track)
    if (currentIndex >= queue.length - 2 && repeatMode !== 'one') {
      try {
        const currentTrack = queue[currentIndex] || queue[queue.length - 1];
        let artists = [];
        if (currentTrack) {
          if (typeof currentTrack.artists === 'string') {
            artists = currentTrack.artists.split(',');
          } else if (Array.isArray(currentTrack.artists)) {
            artists = currentTrack.artists.map(a => typeof a === 'object' ? (a?.name || a?.artist || '') : String(a));
          } else if (currentTrack.artist) {
            artists = [currentTrack.artist];
          }
        }
        const seedArtist = (artists[Math.floor(Math.random() * artists.length)] || '').trim();
        
        let query = seedArtist || 'Trending Top Hits';
        if (Math.random() < 0.15) query = 'Top Global Hits 2024';
        
        const res = await API.searchSongs(query, 15);
        if (!res || res.length === 0) return;
        
        const recentIds = (typeof Storage !== 'undefined' && Storage.getRecent) ? Storage.getRecent().map(r => r.id) : [];
        const queueIds = queue.map(q => q.id);
        const prefs = settings.languages || [];
        
        const newSongs = res.filter(s => {
          if (queueIds.includes(s.id) || recentIds.includes(s.id)) return false;
          const lang = (s.language || '').toLowerCase();
          if (prefs.length > 0 && lang !== '' && lang !== 'unknown' && !prefs.includes(lang)) return false;
          return true;
        });
        
        if (newSongs.length > 0) {
          const songsToAdd = newSongs.slice(0, 5).map(s => (window.API && API.normalizeSong) ? API.normalizeSong(s) : s);
          queue.push(...songsToAdd);
          if (shuffleMode) generateShuffledIndices();
          onQueueUpdate?.(queue, currentIndex);
        }
      } catch (e) {
        console.warn('[Player] Background autoplay prefetch failed:', e);
      }
    }
  }

  function play() {
    if (!activeAudio) return;
    stopInactiveAudio();
    
    // If no source is loaded yet, but we have a track in queue, load and play it
    if ((!activeAudio.src || activeAudio.src === '' || activeAudio.src === window.location.href)) {
      if (queue.length > 0 && currentIndex >= 0 && queue[currentIndex]) {
        loadAndPlay(queue[currentIndex]);
      } else {
        if (typeof UI !== 'undefined' && UI.showToast) {
          UI.showToast('No track selected to play', 'info');
        }
      }
      return;
    }

    // Resume AudioContext only on non-iOS (iOS doesn't use Web Audio)
    if (!isIOS && audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(err => console.warn('[Player] audioCtx.resume() failed:', err));
    }

    // Call activeAudio.play() synchronously in the immediate user activation frame
    try {
      const playPromise = activeAudio.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          isPlaying = true;
          onPlay?.();
          if ('mediaSession' in navigator) {
            try {
              navigator.mediaSession.playbackState = 'playing';
            } catch (_) {}
          }
        }).catch(err => {
          console.warn(`[Player] Resume error: ${err.name} - ${err.message}`);
          // On iOS lockscreen, do NOT call loadAndPlay — it requires a user gesture.
          // Just mark as paused so the lockscreen shows the correct state.
          if (isIOS) {
            isPlaying = false;
            onPause?.();
            if ('mediaSession' in navigator) {
              try { navigator.mediaSession.playbackState = 'paused'; } catch (_) {}
            }
            return;
          }
          const track = getCurrentTrack();
          if (track) {
            loadAndPlay(track);
          }
        });
      }
    } catch (err) {
      console.warn(`[Player] Play sync error: ${err.name} - ${err.message}`);
      if (isIOS) {
        isPlaying = false;
        onPause?.();
        return;
      }
      const track = getCurrentTrack();
      if (track) loadAndPlay(track);
    }
  }

  function pause() {
    stopInactiveAudio();
    if (activeAudio) {
      activeAudio.pause();
      isPlaying = false;
      onPause?.();
      if ('mediaSession' in navigator) {
        try {
          navigator.mediaSession.playbackState = 'paused';
        } catch (e) {}
      }
    }
  }

  function togglePlayPause() {
    // Check actual audio state first to avoid desync
    if (activeAudio && !activeAudio.paused && !activeAudio.ended) {
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
        // Endless autoplay: never let the music stop. Fetch dynamic recommendations or loop seamlessly.
        const settings = Storage.getSettings();
        if (settings.autoplay !== false) {
          try {
            const currentTrack = queue[currentIndex] || queue[queue.length - 1];
            let artists = [];
            if (currentTrack) {
              if (typeof currentTrack.artists === 'string') {
                artists = currentTrack.artists.split(',');
              } else if (Array.isArray(currentTrack.artists)) {
                artists = currentTrack.artists.map(a => typeof a === 'object' ? (a?.name || a?.artist || '') : String(a));
              } else if (currentTrack.artist) {
                artists = [currentTrack.artist];
              }
            }
            const seedArtist = (artists[Math.floor(Math.random() * artists.length)] || '').trim();
            const seedQueries = [];
            if (seedArtist) seedQueries.push(seedArtist, `${seedArtist} hits`);
            (settings.languages || []).slice(0, 1).forEach(l => seedQueries.push(`top ${l} songs`));
            seedQueries.push('trending hits', 'popular songs');

            const recentIds = new Set(Storage.getRecent().slice(0, 30).map(r => r.id));
            const queueKeys = queue.map(q => (API.getTitleKey ? API.getTitleKey(q) : q.id));

            let added = [];
            for (let pass = 0; pass < 2 && added.length === 0; pass++) {
              const relaxed = pass === 1;
              for (const q of seedQueries) {
                let res = [];
                try { res = await API.searchSongs(q, 15) || []; } catch (_) { continue; }
                let candidates = res.map(s => API.normalizeSong(s));
                if (!relaxed) {
                  candidates = API.filterByLanguagePrefs ? API.filterByLanguagePrefs(candidates, { minKeep: 5 }) : candidates;
                  candidates = candidates.filter(s => !recentIds.has(s.id));
                  if (seedArtist && q.toLowerCase().includes(seedArtist.toLowerCase())) {
                    const sl = seedArtist.toLowerCase();
                    candidates = candidates.filter(s => (s.artists || '').toLowerCase().includes(sl));
                  }
                }
                candidates = API.dedupeVariants
                  ? API.dedupeVariants(candidates, { maxPerArtist: 3, maxRun: 2, excludeKeys: queueKeys })
                  : candidates;
                if (candidates.length > 0) {
                  added = candidates.slice(0, 8);
                  break;
                }
              }
            }

            if (added.length === 0 && API.getTrendingPool) {
              try {
                let pool = await API.getTrendingPool(15);
                pool = API.dedupeVariants
                  ? API.dedupeVariants(pool, { maxPerArtist: 2, maxRun: 2, excludeKeys: queueKeys })
                  : pool;
                added = pool.slice(0, 8);
              } catch (_) {}
            }

            if (added.length > 0) {
              queue.push(...added);
              nextIndex = queue.length - added.length;
              if (shuffleMode) generateShuffledIndices();
            } else {
              nextIndex = 0; // Loop seamlessly
            }
          } catch (e) {
            console.error('[Player] Autoplay fetch failed, looping queue:', e);
            nextIndex = 0;
          }
        } else {
          // If autoplay setting is explicitly off, loop the queue so playback never abruptly dies
          nextIndex = 0;
        }
      }
    }

    currentIndex = nextIndex;
    const trackToPlay = queue[currentIndex];
    if (trackToPlay) {
      await loadAndPlay(trackToPlay, isCrossfade === true);
      onQueueUpdate?.(queue, currentIndex);
    }
  }

  async function checkAndPrefetchGapless() {
    if (queue.length === 0) return;
    let nextIdx = shuffleMode ? shuffledIndices[(shuffledIndices.indexOf(currentIndex) + 1) % shuffledIndices.length] : currentIndex + 1;
    if (nextIdx >= queue.length && repeatMode !== 'all') return; // End of queue
    if (nextIdx >= queue.length) nextIdx = 0;
    
    const nextSong = queue[nextIdx];
    if (!nextSong) return;

    try {
      const qual = getAdaptiveQuality(Storage.getSettings().audioQuality || 'auto');
      let streamUrl = null;
      if (Storage.getOfflineSong(nextSong.id)) {
        streamUrl = await Storage.getOfflineSong(nextSong.id);
      } else {
        const details = await window.API.getSongDetails(nextSong.id);
        if (details && details.length > 0) {
          streamUrl = window.API.getDownloadUrl(details[0], qual);
        }
      }

      if (streamUrl && inactiveAudio.src !== streamUrl) {
        inactiveAudio.src = streamUrl;
        inactiveAudio.load(); // Start buffering
        gaplessPrefetchedUrl = streamUrl;
      }
    } catch (e) {
      console.warn('[Player] Gapless prefetch failed', e);
    }
  }

  async function previous() {
    stopInactiveAudio();
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
        prevIndex = 0;
      }
    }

    currentIndex = prevIndex;
    const trackToPlay = queue[currentIndex];
    if (trackToPlay) {
      await loadAndPlay(trackToPlay, false);
      onQueueUpdate?.(queue, currentIndex);
    }
  }

  function seek(seconds) {
    stopInactiveAudio();
    if (activeAudio.duration) {
      activeAudio.currentTime = Math.max(0, Math.min(seconds, activeAudio.duration));
    }
  }

  function skipForward(seconds = 15) {
    if (activeAudio && activeAudio.duration) {
      seek(activeAudio.currentTime + seconds);
    }
  }

  function skipBackward(seconds = 15) {
    if (activeAudio && activeAudio.duration) {
      seek(Math.max(0, activeAudio.currentTime - seconds));
    }
  }

  function pauseAudio() {
    pause();
  }

  async function resumeAudio() {
    await play();
  }

  function seekPercent(percent) {
    stopInactiveAudio();
    if (activeAudio.duration) {
      activeAudio.currentTime = (percent / 100) * activeAudio.duration;
    }
  }

  // ---- Volume ----

  function setVolume(vol) {
    targetVolume = Math.max(0, Math.min(1, vol));
    if (gainNode) {
      // Use Web Audio API for volume control (fixes Safari iOS volume lock)
      gainNode.gain.value = targetVolume;
      activeAudio.volume = 1;
      inactiveAudio.volume = 1;
    } else {
      activeAudio.volume = targetVolume;
      inactiveAudio.volume = targetVolume;
    }
    
    if (targetVolume > 0 && activeAudio.muted) {
      activeAudio.muted = false;
    }
    Storage.updateSettings({ volume: targetVolume });
  }

  function getVolume() {
    return targetVolume;
  }

  function mute() {
    activeAudio.muted = !activeAudio.muted;
    return activeAudio.muted;
  }

  // ---- Audio Quality Realtime Switch ----

  function getAdaptiveQuality(requestedQual) {
    let qual = requestedQual || 'auto';
    
    if (qual === 'auto') {
      qual = '320kbps'; // Default to high
      if ('connection' in navigator) {
        const conn = navigator.connection;
        if (conn.effectiveType === '2g' || conn.effectiveType === 'slow-2g') {
          qual = '96kbps';
        } else if (conn.effectiveType === '3g' || (conn.downlink && conn.downlink < 1.5)) {
          qual = '160kbps';
        }
      }
    }
    
    // Map lossless to 320kbps for now since API doesn't support true lossless
    if (['lossless', 'hi-res-48', 'hi-res-96', 'hi-res-192'].includes(qual)) {
      qual = '320kbps';
    }
    
    return qual;
  }

  async function changeQuality(newQuality) {
    Storage.updateSettings({ audioQuality: newQuality });
    const track = getCurrentTrack();
    if (!track) return;

    const wasPlaying = !activeAudio.paused && !activeAudio.ended;
    const currentTime = activeAudio.currentTime || 0;

    let qual = getAdaptiveQuality(newQuality);

    let streamUrl = null;
    if (track.raw && window.API && API.getDownloadUrl) {
      streamUrl = API.getDownloadUrl(track.raw, qual);
    } else if (track.downloadUrls && track.downloadUrls.length > 0) {
      const match = track.downloadUrls.find(u => u.quality === qual);
      streamUrl = match?.url || match?.link;
    }

    if (!streamUrl && window.API) {
      try {
        const details = await API.getSongDetails(track.id);
        if (details && details.length > 0) {
          streamUrl = API.getDownloadUrl(details[0], qual);
        }
      } catch (e) {
        console.warn('[Player] Could not re-fetch stream for quality change:', e);
      }
    }

    if (streamUrl) {
      activeAudio.src = streamUrl;
      activeAudio.currentTime = currentTime;
      if (wasPlaying) {
        activeAudio.play().catch(console.warn);
      }
    }

    const codecEl = document.getElementById('full-player-codec');
    if (codecEl) {
      codecEl.textContent = getStreamCodecDisplay();
    }
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

  function updateMediaSession(trackToUse) {
    if (!('mediaSession' in navigator)) return;
    const track = trackToUse || getCurrentTrack();
    if (!track) return;

    const artworkList = track.image ? [
      { src: track.image, sizes: '96x96', type: 'image/jpeg' },
      { src: track.image, sizes: '128x128', type: 'image/jpeg' },
      { src: track.image, sizes: '192x192', type: 'image/jpeg' },
      { src: track.image, sizes: '256x256', type: 'image/jpeg' },
      { src: track.image, sizes: '384x384', type: 'image/jpeg' },
      { src: track.image, sizes: '512x512', type: 'image/jpeg' }
    ] : [];

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.name || 'Unknown Track',
        artist: track.artists || track.artist || 'Unknown Artist',
        album: track.album || 'MusicFlow',
        artwork: artworkList,
      });
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    } catch (e) {
      console.warn('[Player] MediaSession metadata error:', e);
    }

    try {
      navigator.mediaSession.setActionHandler('play', () => {
        play();
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        pause();
      });
      navigator.mediaSession.setActionHandler('previoustrack', () => {
        previous();
      });
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        next(false);
      });
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime != null) seek(details.seekTime);
      });
      // Clear skip handlers so mobile lockscreen shows Previous/Next track controls
      navigator.mediaSession.setActionHandler('seekbackward', null);
      navigator.mediaSession.setActionHandler('seekforward', null);
      navigator.mediaSession.setActionHandler('stop', () => {
        pause();
      });
    } catch (e) {
      console.warn('[Player] MediaSession setActionHandler error:', e);
    }
  }

  // ---- Sleep Timer & Speed ----

  function setSleepTimer(minutes) {
    if (sleepTimerId && sleepTimerId !== 'song') clearTimeout(sleepTimerId);
    // "End of current song" mode: pause when the current track finishes
    if (minutes === 'song') {
      sleepTimerMinutes = 'song';
      sleepTimerId = 'song';
      onSleepTimer?.('song');
      return;
    }
    minutes = parseInt(minutes, 10) || 0;
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
    if (presetName === 'custom') {
      const saved = Storage.getSettings().eq || EQ_PRESETS.flat;
      saved.forEach((gain, i) => setEqBand(i, gain));
      return saved;
    }
    const preset = EQ_PRESETS[presetName] || EQ_PRESETS.flat;
    preset.forEach((gain, i) => setEqBand(i, gain));
    Storage.updateSettings({ eqPreset: presetName, eq: preset });
    return preset;
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

  function getAnalyserNode() {
    return analyserNode;
  }

  function getStreamCodecDisplay() {
    if (!queue[currentIndex]) return '';
    const qual = Storage.getSettings().audioQuality || '320kbps';
    if (qual === 'hi-res-192') return 'Hi-Res 24-bit / 192 kHz';
    if (qual === 'hi-res-96') return 'Hi-Res 24-bit / 96 kHz';
    if (qual === 'hi-res-48') return 'Hi-Res 24-bit / 48 kHz';
    if (qual === 'lossless') return 'Lossless 16-bit / 44.1 kHz';
    if (qual === 'auto' || qual === '320kbps') return '320 kbps AAC';
    if (qual === '256kbps') return '256 kbps AAC';
    if (qual === '192kbps') return '192 kbps AAC';
    if (qual === '128kbps') return '128 kbps AAC';
    if (qual === '64kbps') return '64 kbps AAC';
    return '320 kbps AAC';
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
      case 'sleeptimer': onSleepTimer = callback; break;
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
    playAtIndex,
    playIndex: playAtIndex,
    play,
    pause,
    togglePlayPause,
    next,
    previous,
    seek,
    seekTo: seek,
    skipForward,
    skipBackward,
    pauseAudio,
    resumeAudio,
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
    getQueueIndex: getCurrentIndex,
    setQueue,
    addToQueue,
    removeFromQueue,
    clearQueue,
    playNext,
    getState,
    getDuration,
    getCurrentTime,
    getIsPlaying,
    isPlaying: () => isPlaying,
    pauseAudio: pause,
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
    changeQuality,
    getStreamCodecDisplay,
    restoreSession,
    persistSession,
    initWebAudio
  };
})();

window.Player = Player;
