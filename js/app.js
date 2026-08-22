// ========================================
// MusicFlow — Main App Controller
// ========================================

const App = (() => {
  let currentSearchResults = [];
  let searchDebounceTimer = null;

  async function init() {
    try {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      if (isIOS) {
        document.documentElement.classList.add('is-ios');
        document.body.classList.add('is-ios');
      }

      setupPlayerEvents();
      setupPlayerBarEvents();
      setupSearchEvents();
      setupNavigationEvents();
      setupDelegatedEvents();
      setupRadioTunerModalEvents();
      setupPwaInstall();
      if (typeof Settings !== 'undefined') Settings.init();
      if (typeof VideoSwitcher !== 'undefined') VideoSwitcher.init();
      initSettings();
      
      UI.renderSidebarPlaylists();
      const btnCreatePl = document.getElementById('btn-create-playlist');
      if (btnCreatePl) {
        btnCreatePl.addEventListener('click', () => {
          const name = prompt('Enter playlist name:');
          if (name) {
            const newPl = Storage.createPlaylist(name);
            UI.renderSidebarPlaylists();
            window.location.hash = `playlist/${newPl.id}`;
          }
        });
      }

      const btnRefreshHome = document.getElementById('btn-refresh-home');
      if (btnRefreshHome) {
        let isRefreshing = false;
        btnRefreshHome.addEventListener('click', async () => {
          if (isRefreshing) return;
          isRefreshing = true;
          btnRefreshHome.style.transition = 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
          btnRefreshHome.style.transform = 'rotate(360deg)';
          if (typeof UI !== 'undefined' && UI.showToast) {
            UI.showToast('✨ Discovering fresh recommendations...', 'info');
          }
          try {
            await loadHomePage(true);
          } catch (err) {
            console.error('[App] Refresh failed:', err);
          } finally {
            setTimeout(() => {
              btnRefreshHome.style.transition = 'none';
              btnRefreshHome.style.transform = 'rotate(0deg)';
              isRefreshing = false;
            }, 650);
          }
        });
      }

      loadHomePage();

      const miniPlayer = document.getElementById('mini-player');
      const playerContainer = document.getElementById('player-container');
      const minimizeBtn = document.getElementById('btn-minimize-player');

      UI.updateVolumeIcon(Player.getVolume());
      const currentTrack = Player.getCurrentTrack();
      if (currentTrack && currentTrack.id) {
        UI.updatePlayerBar(currentTrack);
      } else {
        if (playerContainer) playerContainer.style.display = 'none';
        document.body.classList.remove('has-player');
      }

      window.expandPlayer = function(pushHistory = true) {
        if (window.innerWidth > 768 && !document.getElementById('full-player')) return;
        if (typeof Haptics !== 'undefined') Haptics.heavy();
        playerContainer.classList.remove('player-closing');
        playerContainer.classList.remove('player-minimized');
        playerContainer.classList.add('player-expanded');
        document.body.classList.add('is-player-expanded');
        if (pushHistory) {
          history.pushState({ type: 'player' }, '', '#player');
        }
      };

      window.minimizePlayer = function(fromPopstate = false) {
        if (!playerContainer.classList.contains('player-expanded')) return;
        if (typeof Haptics !== 'undefined') Haptics.light();
        playerContainer.classList.add('player-closing');
        setTimeout(() => {
          playerContainer.classList.remove('player-closing');
          playerContainer.classList.remove('player-expanded');
          playerContainer.classList.add('player-minimized');
          document.body.classList.remove('is-player-expanded');
        }, 270);
        if (!fromPopstate && window.location.hash === '#player') {
          history.back();
        }
      };

      if (miniPlayer) {
        miniPlayer.addEventListener('click', (e) => {
          if (window.innerWidth > 768) return;
          if (
            e.target.closest('button') || 
            e.target.closest('[data-action]') || 
            e.target.closest('.mini-player__controls') || 
            e.target.closest('.clickable-artist-link') || 
            e.target.closest('input') || 
            e.target.closest('.mini-player__progress-container')
          ) {
            return;
          }
          window.expandPlayer(true);
        });
      }

      const btnFullscreen = document.getElementById('btn-fullscreen');
      if (btnFullscreen) {
        btnFullscreen.addEventListener('click', (e) => {
          e.stopPropagation();
          window.expandPlayer(true);
        });
      }

      if (minimizeBtn) {
        minimizeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          window.minimizePlayer(false);
        });
      }

      const lyricsBtn = document.getElementById('btn-full-lyrics');
      const lyricsPanel = document.getElementById('lyrics-panel');
      const artworkImg = document.getElementById('full-player-img');
      if (lyricsBtn && lyricsPanel && artworkImg) {
        lyricsBtn.addEventListener('click', () => {
          const isHidden = lyricsPanel.style.display === 'none';
          lyricsPanel.style.display = isHidden ? 'flex' : 'none';
          artworkImg.style.opacity = isHidden ? '0.15' : '1';
          lyricsBtn.style.opacity = isHidden ? '1' : '0.5';
          if (isHidden) {
            const track = Player.getCurrentTrack();
            if (track) loadLyrics(track);
          }
        });
      }

      // Queue buttons
      document.querySelectorAll('#btn-full-queue, .btn-queue-toggle').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          e.preventDefault();
          if (typeof Haptics !== 'undefined') Haptics.light();
          navigateToPage('page-queue');
        });
      });
      startAudioReactivePulse();
      initVoiceSearch();
      bindMiniPlayerSwipe();
      bindUpNextStrip();
      bindArtworkDoubleTap();
      bindSleepTimerButton();
      bindBackupRestore();

      // Restore last session (queue + track + position) unless a deep link is taking over
      const hasDeepLink = window.location.hash.includes('/');
      if (!hasDeepLink && Player.restoreSession) {
        const resumed = Player.restoreSession();
        if (resumed && resumed.track) {
          const mins = Math.floor((resumed.position || 0) / 60);
          const secs = String(Math.floor((resumed.position || 0) % 60)).padStart(2, '0');
          UI.showToast(resumed.position > 5
            ? `\u25B6 Resume \u201C${resumed.track.name}\u201D from ${mins}:${secs}`
            : `\u25B6 Your queue is back \u2014 ${resumed.queueLength} songs`, 'info');
        }
      }
      handleDeepLinkOnLoad();
    } catch (e) {
      console.error('[App] Init failed:', e);
    }
  }

  // ---- Real-Time Audio-Reactive Beat & Micro-Beat Scaling ----
  const audioFreqData = new Uint8Array(64);
  let audioPulseFrame = null;
  let prevBassEnergy = 0;
  let beatDecay = 0;

  function startAudioReactivePulse() {
    if (audioPulseFrame) return;

    function renderPulse(now) {
      const pc = document.getElementById('player-container');
      const isPlayerExpanded = pc && pc.classList.contains('player-expanded');
      const isPlaying = document.body.classList.contains('is-playing') || (typeof Player !== 'undefined' && Player.getIsPlaying && Player.getIsPlaying());
      const fullArtworkImg = document.getElementById('full-player-img');
      const miniArtworkImg = document.getElementById('mini-player-img');
      const glowAura = document.querySelector('.artwork-glow-aura');
      const settings = (typeof Storage !== 'undefined' && Storage.getSettings) ? Storage.getSettings() : {};
      const isBeatPulseEnabled = settings.beatPulse !== false; // Default true (ON)

      if (isPlaying && isBeatPulseEnabled) {
        let beatPower = 0;
        let hasAnalyserSignal = false;

        const analyser = (typeof Player !== 'undefined' && Player.getAnalyserNode) ? Player.getAnalyserNode() : null;

        if (analyser) {
          try {
            analyser.getByteFrequencyData(audioFreqData);
            
            // 1. Low Bins (Sub-bass, Kick drums, 808s: 0..4)
            let bassSum = 0;
            for (let i = 0; i < 4; i++) {
              bassSum += audioFreqData[i];
            }
            const bassAvg = bassSum / (4 * 255);

            // 2. Mid/High Bins (Micro-beats, Snares, Claps, Hi-hats: 4..16)
            let midSum = 0;
            for (let i = 4; i < 16; i++) {
              midSum += audioFreqData[i];
            }
            const midAvg = midSum / (12 * 255);

            if (bassSum > 4 || midSum > 4) {
              hasAnalyserSignal = true;

              // Combined instant energy
              const instantEnergy = (bassAvg * 0.72) + (midAvg * 0.28);

              // Transient Onset Detection (micro-beat kick)
              const deltaEnergy = Math.max(0, instantEnergy - prevBassEnergy);
              prevBassEnergy = (prevBassEnergy * 0.82) + (instantEnergy * 0.18);

              if (deltaEnergy > 0.04) {
                beatDecay = Math.min(1.0, beatDecay + deltaEnergy * 2.8);
              } else {
                beatDecay *= 0.85; // snappy micro-beat recovery
              }

              beatPower = Math.min(1.0, (instantEnergy * 0.75) + (beatDecay * 0.75));
            }
          } catch (err) {}
        }

        // Mobile Fallback / CORS Fallback / Universal Rhythm Engine:
        // If analyser has no signal (CORS blocked on mobile / WebAudio muted),
        // synthesize a vibrant, tempo-locked rhythmic beat with primary kick transients and micro-beat bounces!
        if (!hasAnalyserSignal) {
          const currentTime = (typeof Player !== 'undefined' && Player.getCurrentTime) ? Player.getCurrentTime() : 0;
          const time = (currentTime > 0) ? currentTime : ((now || performance.now()) / 1000);
          
          // 126 BPM rhythm pulse (~0.476 sec/beat)
          const beatDuration = 60 / 126;
          const phase = (time % beatDuration) / beatDuration; // 0.0 -> 1.0
          
          // Snappy exponential kick decay on each beat
          const kick = Math.pow(Math.max(0, 1 - phase * 2.6), 2.2);
          
          // Off-beat micro-pulse (8th note groove / micro-snare)
          const subPhase = ((time + (beatDuration * 0.5)) % beatDuration) / beatDuration;
          const microBeat = Math.pow(Math.max(0, 1 - subPhase * 3.4), 2.8) * 0.48;
          
          // Micro-flutter breathing wave for live dynamic depth
          const organicFlutter = (Math.sin(time * 3.14) * 0.5 + 0.5) * 0.22;
          
          beatPower = Math.min(1.0, (kick * 0.75) + microBeat + organicFlutter);
        }

        // Distinct, punchy scaling on live music micro-beats (scale 1.000 to 1.115)
        const scale = 1.0 + (beatPower * 0.115);
        const transformValue = `scale(${scale.toFixed(3)})`;

        // Apply to full-screen mobile / desktop player artwork
        if (fullArtworkImg && isPlayerExpanded) {
          fullArtworkImg.style.transform = transformValue;
          fullArtworkImg.style.boxShadow = `0 ${Math.round(16 + beatPower * 32)}px ${Math.round(35 + beatPower * 45)}px rgba(0,0,0,0.85), 0 0 ${Math.round(25 + beatPower * 70)}px var(--dynamic-color, rgba(29, 185, 84, 0.75))`;
        }

        // Also scale mini player artwork slightly for consistency when minimized
        if (miniArtworkImg && !isPlayerExpanded) {
          const miniScale = 1.0 + (beatPower * 0.06);
          miniArtworkImg.style.transform = `scale(${miniScale.toFixed(3)})`;
        }

        // Pulse dynamic glowing aura behind artwork (subtle atmospheric glow)
        if (glowAura && isPlayerExpanded) {
          const auraScale = 0.92 + (beatPower * 0.22);
          const auraOpacity = 0.40 + (beatPower * 0.25);
          glowAura.style.transform = `scale(${auraScale.toFixed(3)})`;
          glowAura.style.opacity = auraOpacity.toFixed(2);
        }

        // Pulse and modulate ambient fluid mesh backdrop orbs (soft micro-movement)
        if (isPlayerExpanded) {
          const orb1 = document.querySelector('.ambient-mesh-orb.orb-1');
          const orb2 = document.querySelector('.ambient-mesh-orb.orb-2');
          const orb3 = document.querySelector('.ambient-mesh-orb.orb-3');
          if (orb1) {
            const o1Scale = 1.0 + (beatPower * 0.08);
            orb1.style.transform = `scale(${o1Scale.toFixed(3)})`;
            orb1.style.opacity = (0.35 + beatPower * 0.10).toFixed(2);
          }
          if (orb2) {
            const o2Scale = 1.0 + (beatPower * 0.06);
            orb2.style.transform = `scale(${o2Scale.toFixed(3)})`;
            orb2.style.opacity = (0.26 + beatPower * 0.08).toFixed(2);
          }
          if (orb3) {
            const o3Scale = 1.0 + (beatPower * 0.05);
            orb3.style.transform = `scale(${o3Scale.toFixed(3)})`;
            orb3.style.opacity = (0.18 + beatPower * 0.06).toFixed(2);
          }
        }
      } else {
        // Paused or pulse disabled: reset transforms
        if (fullArtworkImg) {
          fullArtworkImg.style.transform = '';
          fullArtworkImg.style.boxShadow = '';
        }
        if (miniArtworkImg) {
          miniArtworkImg.style.transform = '';
        }
        if (glowAura) {
          glowAura.style.transform = '';
          glowAura.style.opacity = '';
        }
      }

      // Keep the circular visualizer in sync (throttled ~4x/sec)
      if (!renderPulse._vizTick || (now || performance.now()) - renderPulse._vizTick > 250) {
        renderPulse._vizTick = now || performance.now();
        try { syncVisualizer(); } catch (err) {}
      }

      audioPulseFrame = requestAnimationFrame(renderPulse);
    }

    audioPulseFrame = requestAnimationFrame(renderPulse);
  }

  // ---- Player Events ----

  function setupPlayerEvents() {
    // 1:1 Real-Time Finger Tracking Gesture Physics for Bottom Player & Full Player
    const miniPlayer = document.getElementById('mini-player');
    const playerContainer = document.getElementById('player-container');
    const fullPlayer = document.getElementById('full-player');
    const bottomNav = document.querySelector('.bottom-nav');

    // --- 1. Real-Time 1:1 Drag-To-Open from Mini Player ---
    if (miniPlayer && playerContainer) {
      let mStartY = 0;
      let mStartX = 0;
      let mStartTime = 0;
      let isDraggingUp = false;

      miniPlayer.addEventListener('touchstart', (e) => {
        if (window.innerWidth > 768 || e.touches.length !== 1) return;
        if (e.target.closest('button, [data-action], .mini-player__controls, .clickable-artist-link, input, .mini-player__progress-container')) {
          mStartY = 0;
          return;
        }
        mStartY = e.touches[0].clientY;
        mStartX = e.touches[0].clientX;
        mStartTime = Date.now();
        isDraggingUp = false;
      }, { passive: true });

      miniPlayer.addEventListener('touchmove', (e) => {
        if (!mStartY || e.touches.length !== 1) return;
        if (playerContainer.classList.contains('player-expanded')) return;

        const currentY = e.touches[0].clientY;
        const deltaY = currentY - mStartY;
        const deltaX = e.touches[0].clientX - mStartX;

        if (!isDraggingUp) {
          if (deltaY < -5 && Math.abs(deltaY) > Math.abs(deltaX)) {
            isDraggingUp = true;
            playerContainer.classList.add('is-gesture-dragging');
            if (bottomNav) bottomNav.classList.add('is-gesture-dragging');
          }
        }

        if (isDraggingUp) {
          // Sheet is locked directly to finger Y position
          const sheetY = Math.max(0, Math.min(window.innerHeight, currentY));
          playerContainer.style.transform = `translate3d(0, ${sheetY}px, 0)`;
          if (bottomNav) {
            const navProg = Math.min(1, Math.max(0, (window.innerHeight - sheetY) / (window.innerHeight * 0.6)));
            bottomNav.style.transform = `translate3d(0, ${(navProg * 100).toFixed(1)}%, 0)`;
          }
        }
      }, { passive: true });

      miniPlayer.addEventListener('touchend', (e) => {
        if (!mStartY) return;
        const currentY = e.changedTouches[0].clientY;
        const deltaY = currentY - mStartY;
        const deltaX = e.changedTouches[0].clientX - mStartX;
        const deltaTime = Date.now() - mStartTime;
        const velocity = deltaY / Math.max(1, deltaTime);

        if (isDraggingUp) {
          isDraggingUp = false;
          playerContainer.classList.remove('is-gesture-dragging');
          if (bottomNav) bottomNav.classList.remove('is-gesture-dragging');
          playerContainer.classList.add('is-animating-snap');

          // If dragged up past 80px or finger ended in top 75% or flicked up fast
          if (deltaY < -80 || currentY < window.innerHeight * 0.75 || velocity < -0.25) {
            playerContainer.style.transform = 'translate3d(0, 0, 0)';
            if (bottomNav) bottomNav.style.transform = 'translate3d(0, 100%, 0)';

            setTimeout(() => {
              playerContainer.style.transform = '';
              if (bottomNav) bottomNav.style.transform = '';
              playerContainer.classList.remove('is-animating-snap');
              window.expandPlayer(true);
            }, 280);
          } else {
            // Snap back down to bottom
            playerContainer.style.transform = 'translate3d(0, 100vh, 0)';
            if (bottomNav) bottomNav.style.transform = 'translate3d(0, 0, 0)';

            setTimeout(() => {
              playerContainer.style.transform = '';
              if (bottomNav) bottomNav.style.transform = '';
              playerContainer.classList.remove('is-animating-snap');
            }, 280);
          }
        } else {
          // Horizontal skip on mini player
          if (Math.abs(deltaX) > 40 && deltaTime < 600) {
            if (deltaX < -40) Player.next();
            else if (deltaX > 40) Player.previous();
          }
        }

        mStartY = 0;
        mStartX = 0;
      }, { passive: true });
    }

    // --- 2. Real-Time 1:1 Drag-To-Close from Full Player ---
    if (fullPlayer && playerContainer) {
      let fpStartY = 0;
      let fpStartX = 0;
      let fpStartTime = 0;
      let isDraggingDown = false;

      fullPlayer.addEventListener('touchstart', (e) => {
        if (window.innerWidth > 768 || e.touches.length !== 1) return;
        if (e.target.tagName === 'INPUT' || e.target.closest('.modal') || e.target.closest('.lyrics-scroll') || e.target.closest('button, [data-action], .clickable-artist-link')) {
          fpStartY = 0;
          return;
        }
        fpStartY = e.touches[0].clientY;
        fpStartX = e.touches[0].clientX;
        fpStartTime = Date.now();
        isDraggingDown = false;
      }, { passive: true });

      fullPlayer.addEventListener('touchmove', (e) => {
        if (!fpStartY || e.touches.length !== 1) return;
        if (!playerContainer.classList.contains('player-expanded')) return;

        const currentY = e.touches[0].clientY;
        const deltaY = currentY - fpStartY;
        const deltaX = e.touches[0].clientX - fpStartX;

        if (!isDraggingDown) {
          if (deltaY > 5 && Math.abs(deltaY) > Math.abs(deltaX)) {
            isDraggingDown = true;
            playerContainer.classList.add('is-gesture-dragging');
            if (bottomNav) {
              bottomNav.style.display = 'flex';
              bottomNav.classList.add('is-gesture-dragging');
            }
          }
        }

        if (isDraggingDown && deltaY > 0) {
          // Sheet follows finger downwards
          playerContainer.style.transform = `translate3d(0, ${deltaY}px, 0)`;
          if (bottomNav) {
            const navProg = Math.max(0, 100 - (deltaY / (window.innerHeight * 0.75)) * 100);
            bottomNav.style.transform = `translate3d(0, ${navProg.toFixed(1)}%, 0)`;
          }
        }
      }, { passive: true });

      fullPlayer.addEventListener('touchend', (e) => {
        if (!fpStartY) return;
        const deltaY = e.changedTouches[0].clientY - fpStartY;
        const deltaTime = Date.now() - fpStartTime;
        const velocity = deltaY / Math.max(1, deltaTime);

        if (isDraggingDown) {
          isDraggingDown = false;
          playerContainer.classList.remove('is-gesture-dragging');
          if (bottomNav) bottomNav.classList.remove('is-gesture-dragging');
          playerContainer.classList.add('is-animating-snap');

          // If pulled down past 22% of screen or flicked down
          if (deltaY > window.innerHeight * 0.20 || velocity > 0.28) {
            playerContainer.style.transform = 'translate3d(0, 100vh, 0)';
            if (bottomNav) bottomNav.style.transform = 'translate3d(0, 0, 0)';

            setTimeout(() => {
              playerContainer.style.transform = '';
              if (bottomNav) {
                bottomNav.style.transform = '';
                bottomNav.style.display = '';
              }
              playerContainer.classList.remove('is-animating-snap');
              window.minimizePlayer(false);
            }, 320);
          } else {
            // Snap back open
            playerContainer.style.transform = 'translate3d(0, 0, 0)';
            if (bottomNav) bottomNav.style.transform = 'translate3d(0, 100%, 0)';

            setTimeout(() => {
              playerContainer.style.transform = '';
              if (bottomNav) {
                bottomNav.style.transform = '';
                bottomNav.style.display = '';
              }
              playerContainer.classList.remove('is-animating-snap');
            }, 320);
          }
        }

        fpStartY = 0;
        fpStartX = 0;
      }, { passive: true });
    }

    Player.on('play', () => {
      UI.updatePlayPauseButton(true);
    });

    Player.on('pause', () => {
      UI.updatePlayPauseButton(false);
    });

    Player.on('timeupdate', (data) => {
      UI.updateProgress(data);
      if (data && data.currentTime !== undefined) {
        updateSyncedLyrics(data.currentTime);
      }
    });

    Player.on('trackchange', (track) => {
      UI.updatePlayerBar(track);
      updateUpNextStrip();
      updateSleepBadge();
      
      // Update full player with HD image and dynamic artwork
      if (track && track.image) {
        let rawImg = '';
        if (typeof track.image === 'string') {
          rawImg = track.image;
        } else if (Array.isArray(track.image)) {
          const best = track.image[track.image.length - 1];
          rawImg = typeof best === 'string' ? best : (best?.url || best?.link || '');
        } else if (typeof track.image === 'object' && track.image !== null) {
          rawImg = track.image.url || track.image.link || '';
        }
        if (!rawImg || rawImg.includes('[object Object]')) {
          rawImg = 'assets/logo.jpg';
        }
        const hdImage = typeof rawImg === 'string'
          ? rawImg.replace('150x150', '500x500').replace('50x50', '500x500').replace('175x175', '500x500')
          : 'assets/logo.jpg';
        const fImg = document.getElementById('full-player-img');
        if (fImg) fImg.src = hdImage;
        if (typeof updateDynamicArtwork === 'function') updateDynamicArtwork(hdImage);
      }
      
      const codecEl = document.getElementById('full-player-codec');
      if (codecEl && Player.getStreamCodecDisplay) {
        codecEl.textContent = Player.getStreamCodecDisplay();
        if (typeof UI !== 'undefined' && UI.updateCodecBadgeStyle) {
          UI.updateCodecBadgeStyle(codecEl);
        }
      }

      // Auto-load lyrics if lyrics panel is open or preload
      const lyricsPanel = document.getElementById('lyrics-panel');
      if (track) {
        loadLyrics(track, lyricsPanel && lyricsPanel.style.display !== 'none');
      }

      // Refresh favorites view if active
      const favsPage = document.getElementById('page-favorites');
      if (favsPage && favsPage.classList.contains('active')) {
        UI.renderFavorites(document.getElementById('favorites-container'));
      }
    });

    Player.on('error', (err) => {
      console.warn('[App] Playback error encountered:', err);
    });

    Player.on('queueupdate', () => {
      updateUpNextStrip();
      // Refresh queue view if active
      const queuePage = document.getElementById('page-queue');
      if (queuePage && queuePage.classList.contains('active')) {
        UI.renderQueue(document.getElementById('queue-container'));
        rebindQueueEvents();
      }
    });
  }

  // ---- Live Lyrics Controller (Spotify Style) ----

  let activeLyricsData = null;
  let parsedLyricsLines = [];
  let currentLyricsSongId = null;

  function sanitizeLyricsText(text) {
    if (!text) return '';
    return text
      // Fix broken character encodings / question mark apostrophes (e.g. "I don?t", "I?m", "You?re", "can?t")
      .replace(/(\b[a-zA-Z]+)\?([a-zA-Z]+\b)/g, "$1'$2")
      .replace(/\bI\?m\b/g, "I'm")
      .replace(/\bYou\?re\b/g, "You're")
      .replace(/\byou\?re\b/g, "you're")
      .replace(/\bDon\?t\b/g, "Don't")
      .replace(/\bdon\?t\b/g, "don't")
      .replace(/\bCan\?t\b/g, "Can't")
      .replace(/\bcan\?t\b/g, "can't")
      .replace(/\bWon\?t\b/g, "Won't")
      .replace(/\bwon\?t\b/g, "won't")
      .replace(/\bIt\?s\b/g, "It's")
      .replace(/\bit\?s\b/g, "it's")
      .replace(/\bThat\?s\b/g, "That's")
      .replace(/\bthat\?s\b/g, "that's")
      // Fix HTML entities & unicode mojibake
      .replace(/&apos;/g, "'")
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#8217;/g, "'")
      .replace(/&#8216;/g, "'")
      .replace(/&#8220;/g, '"')
      .replace(/&#8221;/g, '"')
      .replace(/â€™/g, "'")
      .replace(/â€œ/g, '"')
      .replace(/â€/g, '"')
      .trim();
  }

  async function loadLyrics(song, force = false) {
    if (!song) return;
    if (!force && currentLyricsSongId === song.id && activeLyricsData) return;

    currentLyricsSongId = song.id;
    const lyricsContent = document.querySelector('.lyrics-content');
    if (!lyricsContent) return;

    lyricsContent.innerHTML = '<div style="opacity:0.6; padding: 40px 0;">Searching for lyrics...</div>';
    activeLyricsData = null;
    parsedLyricsLines = [];

    try {
      const data = await API.getLyrics(song.name, song.artists, song.duration);
      if (currentLyricsSongId !== song.id) return; // Song changed while fetching

      if (!data || (!data.synced && !data.plain)) {
        lyricsContent.innerHTML = '<div style="opacity:0.6; padding: 40px 0;">Lyrics not available for this song.</div>';
        return;
      }

      activeLyricsData = data;

      if (data.synced) {
        // Parse LRC format: [mm:ss.xx] Lyric line
        const rawLines = data.synced.split('\n');
        parsedLyricsLines = [];
        rawLines.forEach(line => {
          const match = line.match(/\[(\d+):(\d+\.?\d*)\](.*)/);
          if (match) {
            const time = parseInt(match[1]) * 60 + parseFloat(match[2]);
            const text = sanitizeLyricsText(match[3]);
            if (text) {
              parsedLyricsLines.push({ time, text });
            }
          }
        });

        if (parsedLyricsLines.length > 0) {
          lyricsContent.innerHTML = parsedLyricsLines.map((item, idx) => `
            <div class="lyrics-line" data-idx="${idx}" data-time="${item.time}">${item.text}</div>
          `).join('');

          lyricsContent.querySelectorAll('.lyrics-line').forEach(el => {
            el.addEventListener('click', (e) => {
              e.stopPropagation();
              const time = parseFloat(el.dataset.time);
              if (!isNaN(time)) {
                Player.seek(time);
                if (typeof Haptics !== 'undefined') Haptics.light();
              }
            });
          });
          return;
        }
      }

      // Plain lyrics fallback
      lyricsContent.innerHTML = data.plain.split('\n').map(line => {
        const cleaned = sanitizeLyricsText(line);
        return `<div class="lyrics-line">${cleaned || '&nbsp;'}</div>`;
      }).join('');
    } catch (e) {
      if (currentLyricsSongId === song.id) {
        lyricsContent.innerHTML = '<div style="opacity:0.6; padding: 40px 0;">Lyrics unavailable.</div>';
      }
    }
  }

  function updateSyncedLyrics(currentTime) {
    if (!parsedLyricsLines || parsedLyricsLines.length === 0) return;
    const lyricsPanel = document.getElementById('lyrics-panel');
    if (!lyricsPanel || lyricsPanel.style.display === 'none') return;

    let activeIndex = -1;
    for (let i = 0; i < parsedLyricsLines.length; i++) {
      if (currentTime >= parsedLyricsLines[i].time) {
        activeIndex = i;
      } else {
        break;
      }
    }

    const lines = lyricsPanel.querySelectorAll('.lyrics-line');
    lines.forEach((line, idx) => {
      const isActive = idx === activeIndex;
      if (line.classList.contains('active') !== isActive) {
        line.classList.toggle('active', isActive);
        if (isActive) {
          line.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    });
  }

  // ---- Search ----

  function setupSearchEvents() {
    const input = document.getElementById('search-input');
    const clearBtn = document.getElementById('search-clear');

    input.addEventListener('focus', () => {
      const query = input.value.trim();
      if (!query) {
        renderSearchHistoryDropdown();
      } else if (query.length >= 2) {
        performAutocomplete(query);
      }
    });

    input.addEventListener('input', () => {
      const query = input.value.trim();
      clearBtn.classList.toggle('visible', query.length > 0);

      if (!query) {
        renderSearchHistoryDropdown();
        return;
      }

      clearTimeout(searchDebounceTimer);
      if (query.length >= 2) {
        searchDebounceTimer = setTimeout(() => performAutocomplete(query), 300);
      }
    });

    // Keyboard navigation for the autocomplete dropdown (\u2191\u2193 to move, Enter to pick, Esc to close)
    input.addEventListener('keydown', (e) => {
      const dropdown = document.getElementById('search-dropdown');
      if (!dropdown || dropdown.style.display === 'none') return;
      const items = [...dropdown.querySelectorAll('.dropdown-item')];
      if (items.length === 0) return;
      let idx = items.findIndex(it => it.classList.contains('dropdown-item--active'));
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (e.key === 'ArrowDown') idx = (idx + 1) % items.length;
        else idx = idx <= 0 ? items.length - 1 : idx - 1;
        items.forEach(it => it.classList.remove('dropdown-item--active'));
        items[idx].classList.add('dropdown-item--active');
        items[idx].scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter' && idx >= 0) {
        e.preventDefault();
        e.stopImmediatePropagation();
        items[idx].click();
      } else if (e.key === 'Escape') {
        dropdown.style.display = 'none';
      }
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        clearTimeout(searchDebounceTimer);
        const query = input.value.trim();
        if (query) {
          Storage.addSearchHistory(query);
          performSearch(query);
        }
      }
    });

    clearBtn.addEventListener('click', () => {
      input.value = '';
      clearBtn.classList.remove('visible');
      UI.showPage('page-home');
      input.focus();
    });

    // Focus search on '/' (Ctrl+K is reserved for the command palette)
    document.addEventListener('keydown', (e) => {
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && !['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) {
        e.preventDefault();
        input.focus();
        input.select();
      }
    });
  }

  function renderSearchHistory() {
    UI.showPage('page-search');
    if (typeof SearchEngine !== 'undefined' && SearchEngine.renderSearchHistory) {
      SearchEngine.renderSearchHistory();
    }
  }

  async function performAutocomplete(query) {
    const dropdown = document.getElementById('search-dropdown');
    if (!dropdown) return;
    
    try {
      const results = await API.searchAll(query);
      if (!results || Object.keys(results).length === 0) {
        dropdown.innerHTML = '<div style="padding: 12px; color: var(--text-sec); font-size: 13px;">No suggestions found</div>';
      } else {
        dropdown.innerHTML = '';
        
        // Show up to 4 songs and 2 artists
        const songs = (results.songs?.results || []).slice(0, 4);
        const artists = (results.artists?.results || []).slice(0, 2);
        
        if (artists.length > 0) {
          const section = document.createElement('div');
          section.innerHTML = `<div style="padding: 8px 12px; font-size: 11px; text-transform: uppercase; color: var(--text-tertiary); font-weight: 700; letter-spacing: 1px;">Artists</div>`;
          artists.forEach(a => {
            const item = document.createElement('div');
            item.className = 'dropdown-item';
            const aImg = (window.API && API.getImageUrl) ? API.getImageUrl(a) : (a.image || 'assets/logo.jpg');
            item.innerHTML = `
              <img src="${aImg}" onerror="this.src='assets/logo.jpg'" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; margin-right: 12px;">
              <span style="flex:1; font-weight: 500; font-size: 14px;">${a.title || a.name || 'Unknown'}</span>
            `;
            item.onclick = (e) => {
              e.stopPropagation();
              dropdown.style.display = 'none';
              if (window.openArtistPage) window.openArtistPage(a.title || a.name, aImg);
            };
            section.appendChild(item);
          });
          dropdown.appendChild(section);
        }
        
        if (songs.length > 0) {
          const section = document.createElement('div');
          section.innerHTML = `<div style="padding: 8px 12px; font-size: 11px; text-transform: uppercase; color: var(--text-tertiary); font-weight: 700; letter-spacing: 1px;">Songs</div>`;
          songs.forEach((s, idx) => {
            const normSong = API.normalizeSong ? API.normalizeSong(s) : s;
            const item = document.createElement('div');
            item.className = 'dropdown-item';
            const sImg = normSong.image || 'assets/logo.jpg';
            item.innerHTML = `
              <img src="${sImg}" onerror="this.src='assets/logo.jpg'" style="width: 32px; height: 32px; border-radius: 4px; object-fit: cover; margin-right: 12px;">
              <div style="flex:1; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;">
                <div style="font-weight: 500; font-size: 14px;">${normSong.name}</div>
                <div style="font-size: 12px; color: var(--text-sec);">${normSong.artists}</div>
              </div>
            `;
            item.onclick = async (e) => {
              e.stopPropagation();
              dropdown.style.display = 'none';
              document.getElementById('search-input').value = '';
              document.getElementById('search-clear').classList.remove('visible');
              
              let songToPlay = normSong;
              if ((!songToPlay.streamUrl && !songToPlay.audioUrl) && songToPlay.id) {
                try {
                  const details = await API.getSongDetails(songToPlay.id);
                  if (details && details.length > 0) {
                    songToPlay = API.normalizeSong(details[0]);
                  }
                } catch (_) {}
              }
              Player.setQueue([songToPlay], 0);
              await Player.playSong(songToPlay);
            };
            section.appendChild(item);
          });
          dropdown.appendChild(section);
        }
      }
      dropdown.style.display = 'block';
    } catch (err) {
      console.error(err);
    }
  }

  function renderSearchHistoryDropdown() {
    const dropdown = document.getElementById('search-dropdown');
    if (!dropdown) return;
    const history = Storage.getSearchHistory();
    if (history.length === 0) {
      dropdown.style.display = 'none';
      return;
    }
    
    dropdown.innerHTML = `<div style="padding: 8px 12px; font-size: 11px; text-transform: uppercase; color: var(--text-tertiary); font-weight: 700; letter-spacing: 1px;">Recent Searches</div>`;
    history.slice(0, 5).forEach(term => {
      const item = document.createElement('div');
      item.className = 'dropdown-item';
      item.style.padding = '10px 12px';
      item.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 12px; opacity: 0.5;">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
        <span style="font-size: 14px;">${term}</span>
      `;
      item.onclick = () => {
        document.getElementById('search-input').value = term;
        dropdown.style.display = 'none';
        performSearch(term);
      };
      dropdown.appendChild(item);
    });
    dropdown.style.display = 'block';
  }

  document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('search-dropdown');
    const searchInput = document.getElementById('search-input');
    if (dropdown && dropdown.style.display === 'block') {
      if (!dropdown.contains(e.target) && e.target !== searchInput) {
        dropdown.style.display = 'none';
      }
    }
  });

  async function performSearch(query) {
    UI.showPage('page-search');

    // Also update nav
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.page === 'page-search');
    });

    if (typeof SearchEngine !== 'undefined' && SearchEngine.executeSearch) {
      await SearchEngine.executeSearch(query);
    }
  }

  // ---- Navigation & Route Normalization ----

  const ROUTE_MAP = {
    'home': 'page-home',
    'page-home': 'page-home',
    'library': 'page-favorites',
    'favorites': 'page-favorites',
    'page-favorites': 'page-favorites',
    'podcasts': 'page-podcasts',
    'page-podcasts': 'page-podcasts',
    'samples': 'page-samples',
    'page-samples': 'page-samples',
    'search': 'page-search',
    'page-search': 'page-search',
    'queue': 'page-queue',
    'page-queue': 'page-queue',
    'recap': 'page-recap',
    'page-recap': 'page-recap'
  };

  const CANONICAL_HASH = {
    'page-home': 'home',
    'page-favorites': 'library',
    'page-podcasts': 'podcasts',
    'page-samples': 'samples',
    'page-search': 'search',
    'page-queue': 'queue',
    'page-recap': 'recap'
  };

  function navigate(pageId, pushHistory = true) {
    return navigateToPage(pageId, pushHistory);
  }

  function navigateToPage(rawTarget, pushHistory = true) {
    if (!rawTarget || typeof rawTarget !== 'string' || rawTarget === '[object Object]') return;
    const target = rawTarget.trim();
    if (target === 'tuner') {
      if (typeof RadioTuner !== 'undefined' && RadioTuner.openTunerModal) {
        RadioTuner.openTunerModal();
      }
      return;
    }
    const pageId = ROUTE_MAP[target] || (target.startsWith('page-') ? target : `page-${target}`);
    const canonicalHash = CANONICAL_HASH[pageId] || target.replace('page-', '');

    UI.showPage(pageId);

    // Minimize player if open when changing top-level page
    const pc = document.getElementById('player-container');
    if (pc && pc.classList.contains('player-expanded')) {
      pc.classList.add('player-minimized');
      pc.classList.remove('player-expanded');
      document.body.classList.remove('is-player-expanded');
    }

    // Sync active state on all nav-items (desktop sidebar + mobile bottom nav)
    document.querySelectorAll('.nav-item').forEach(btn => {
      const isMatch = (btn.dataset.page === pageId || btn.dataset.route === canonicalHash || (canonicalHash === 'library' && btn.dataset.page === 'page-favorites'));
      btn.classList.toggle('active', isMatch);
    });

    // Smoothly animate floating glide indicator on mobile bottom-nav
    const bottomNav = document.querySelector('.bottom-nav');
    const indicator = bottomNav?.querySelector('.bottom-nav-indicator');
    if (bottomNav && indicator) {
      const activeBtn = bottomNav.querySelector('.nav-item.active');
      if (activeBtn) {
        const navRect = bottomNav.getBoundingClientRect();
        const itemRect = activeBtn.getBoundingClientRect();
        if (itemRect.width > 0) {
          indicator.style.width = `${itemRect.width}px`;
          indicator.style.transform = `translate3d(${Math.max(0, itemRect.left - navRect.left)}px, 0, 0)`;
        }
      }
    }

    if (pushHistory) {
      history.pushState({ type: 'page', pageId, route: canonicalHash }, '', '#' + canonicalHash);
    }

    // Load page-specific content
    document.body.classList.toggle('on-samples-page', pageId === 'page-samples');

    if (pageId === 'page-samples') {
      if (typeof Samples !== 'undefined') {
        Samples.openSamplesPage();
      }
    } else {
      if (typeof Samples !== 'undefined' && Samples.stopSample) {
        Samples.stopSample();
      }
    }

    if (pageId === 'page-podcasts') {
      if (typeof Podcasts !== 'undefined') {
        Podcasts.openPodcastsHub();
      }
    } else if (pageId === 'page-favorites') {
      UI.renderFavorites(document.getElementById('favorites-container'));
      bindFavoritesEvents();
    } else if (pageId === 'page-queue') {
      UI.renderQueue(document.getElementById('queue-container'));
      rebindQueueEvents();
      // Bring the currently playing track into view
      setTimeout(() => {
        const act = document.querySelector('#queue-container .song-list-item.active');
        if (act) act.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }, 150);
    } else if (pageId === 'page-recap') {
      Recap.renderRecap(document.getElementById('recap-container'));
    } else if (pageId === 'page-home') {
      loadHomePage();
    }
  }

  // ---- Apple Music Style Touch & Glide Navigation Gesture ----

  function initAppleGlideTabBar() {
    const nav = document.querySelector('.bottom-nav');
    if (!nav) return;

    let indicator = nav.querySelector('.bottom-nav-indicator');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.className = 'bottom-nav-indicator';
      nav.insertBefore(indicator, nav.firstChild);
    }

    const items = Array.from(nav.querySelectorAll('.nav-item'));
    if (items.length === 0) return;

    let isGliding = false;
    let currentHoverIndex = -1;
    let startPointerX = 0;

    function updateIndicatorPosition(index, animate = true) {
      if (index < 0 || index >= items.length) return;
      const navRect = nav.getBoundingClientRect();
      const itemRect = items[index].getBoundingClientRect();
      
      const leftOffset = Math.max(0, itemRect.left - navRect.left);
      const width = itemRect.width;

      indicator.style.width = `${width}px`;
      indicator.style.transform = `translate3d(${leftOffset}px, 0, 0) scale(1, 1)`;
    }

    function syncWithActiveNav() {
      const idx = items.findIndex(item => item.classList.contains('active'));
      if (idx !== -1) {
        updateIndicatorPosition(idx, false);
      }
    }

    setTimeout(syncWithActiveNav, 120);
    window.addEventListener('resize', syncWithActiveNav);

    function getClosestItemIndex(pointerX) {
      let closestIdx = 0;
      let minDistance = Infinity;

      items.forEach((item, i) => {
        const itemRect = item.getBoundingClientRect();
        const centerX = itemRect.left + itemRect.width / 2;
        const dist = Math.abs(pointerX - centerX);

        if (dist < minDistance) {
          minDistance = dist;
          closestIdx = i;
        }
      });

      items.forEach((item, i) => {
        item.classList.toggle('glide-hover', i === closestIdx);
      });

      return closestIdx;
    }

    function resetItemStates() {
      items.forEach(item => {
        item.classList.remove('glide-hover');
      });
    }

    function onPointerDown(e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      
      isGliding = true;
      startPointerX = e.clientX;
      nav.classList.add('is-gliding');

      try {
        nav.setPointerCapture(e.pointerId);
      } catch (_) {}

      const closestIdx = getClosestItemIndex(e.clientX);
      if (closestIdx !== -1) {
        currentHoverIndex = closestIdx;
        const navRect = nav.getBoundingClientRect();
        const itemRect = items[closestIdx].getBoundingClientRect();
        
        // Enlarged glass glider size when touching & gliding
        const gliderWidth = itemRect.width + 16;
        const leftOffset = Math.max(2, Math.min(navRect.width - gliderWidth - 2, e.clientX - navRect.left - gliderWidth / 2));
        
        indicator.style.width = `${gliderWidth}px`;
        indicator.style.transform = `translate3d(${leftOffset}px, 0, 0) scale(1.06, 1.04)`;

        if (typeof Haptics !== 'undefined' && Haptics.selection) {
          Haptics.selection();
        }
      }
    }

    function onPointerMove(e) {
      if (!isGliding) return;

      const closestIdx = getClosestItemIndex(e.clientX);
      if (closestIdx !== -1) {
        const navRect = nav.getBoundingClientRect();
        const itemRect = items[closestIdx].getBoundingClientRect();
        
        // Enlarged glass glider that follows finger smoothly with expanded width & aura
        const gliderWidth = itemRect.width + 20;
        const leftOffset = Math.max(2, Math.min(navRect.width - gliderWidth - 2, e.clientX - navRect.left - gliderWidth / 2));
        
        indicator.style.width = `${gliderWidth}px`;
        indicator.style.transform = `translate3d(${leftOffset}px, 0, 0) scale(1.08, 1.05)`;

        if (closestIdx !== currentHoverIndex) {
          currentHoverIndex = closestIdx;
          if (typeof Haptics !== 'undefined' && Haptics.selection) {
            Haptics.selection();
          }
        }
      }
    }

    function onPointerUp(e) {
      if (!isGliding) return;
      isGliding = false;
      nav.classList.remove('is-gliding');

      try {
        nav.releasePointerCapture(e.pointerId);
      } catch (_) {}

      resetItemStates();

      const closestIdx = currentHoverIndex !== -1 ? currentHoverIndex : items.findIndex(item => item.classList.contains('active'));
      if (closestIdx !== -1 && closestIdx < items.length) {
        updateIndicatorPosition(closestIdx, true);
        const selectedItem = items[closestIdx];
        if (selectedItem) {
          const route = selectedItem.dataset.route;
          const page = selectedItem.dataset.page;
          const targetRoute = route || (page ? page.replace('page-', '') : 'home');

          if (typeof Haptics !== 'undefined' && Haptics.light) {
            Haptics.light();
          }

          if (targetRoute === 'tuner' || route === 'tuner') {
            if (typeof RadioTuner !== 'undefined' && RadioTuner.openTunerModal) {
              RadioTuner.openTunerModal();
            }
            setTimeout(syncWithActiveNav, 100);
            return;
          }

          if (targetRoute) {
            navigateToPage(targetRoute, true);
          }
        }
      } else {
        syncWithActiveNav();
      }
      currentHoverIndex = -1;
    }

    nav.addEventListener('pointerdown', onPointerDown);
    nav.addEventListener('pointermove', onPointerMove);
    nav.addEventListener('pointerup', onPointerUp);
    nav.addEventListener('pointercancel', onPointerUp);

    // Sync indicator position on state changes
    window.addEventListener('popstate', () => setTimeout(syncWithActiveNav, 50));
  }

  function setupNavigationEvents() {
    initAppleGlideTabBar();

    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const route = item.dataset.route;
        const action = item.dataset.action;
        const page = item.dataset.page;

        if (route === 'settings' || action === 'open-settings') {
          e.preventDefault();
          const modal = document.getElementById('settings-modal');
          if (modal) modal.style.display = 'flex';
          return;
        }

        if (route === 'tuner') {
          e.preventDefault();
          if (typeof RadioTuner !== 'undefined' && RadioTuner.openTunerModal) {
            RadioTuner.openTunerModal();
          }
          return;
        }

        const targetRoute = route || (page ? page.replace('page-', '') : 'home');
        if (targetRoute) navigateToPage(targetRoute, true);
      });
    });

    // Quick tags
    document.querySelectorAll('.quick-tag').forEach(tag => {
      tag.addEventListener('click', () => {
        const query = tag.dataset.query;
        const input = document.getElementById('search-input');
        if (input) {
          input.value = query;
          document.getElementById('search-clear')?.classList.add('visible');
          performSearch(query);
        }
      });
    });
  }

  function setupRadioTunerModalEvents() {
    const openBtns = [
      document.getElementById('btn-open-radio-tuner-sidebar'),
      document.getElementById('btn-open-radio-tuner-mobile'),
      document.getElementById('btn-tune-radio-home')
    ].filter(Boolean);

    openBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        if (typeof RadioTuner !== 'undefined' && RadioTuner.openTunerModal) {
          RadioTuner.openTunerModal();
        }
      });
    });

    const artistInput = document.getElementById('tuner-artist-input');
    const artistDropdown = document.getElementById('tuner-artist-dropdown');

    let debounceTimer = null;
    if (artistInput && artistDropdown) {
      artistInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        const query = e.target.value.trim();
        if (!query) {
          artistDropdown.style.display = 'none';
          return;
        }

        debounceTimer = setTimeout(async () => {
          try {
            const results = await API.searchArtists(query, 6);
            if (results && results.length > 0) {
              artistDropdown.innerHTML = results.map(a => `
                <div class="dropdown-item" style="padding: 8px 12px; display: flex; align-items: center; gap: 10px; cursor: pointer;">
                  <img src="${a.image?.[0]?.link || a.image || ''}" style="width: 28px; height: 28px; border-radius: 50%; object-fit: cover;">
                  <span style="font-size: 13px; font-weight: 600;">${a.name}</span>
                </div>
              `).join('');

              artistDropdown.querySelectorAll('.dropdown-item').forEach((item, idx) => {
                item.addEventListener('click', () => {
                  const artist = results[idx];
                  RadioTuner.addArtist({
                    id: artist.id,
                    name: artist.name,
                    image: artist.image?.[1]?.link || artist.image?.[0]?.link || (Array.isArray(artist.image) ? artist.image[0]?.url : artist.image) || ''
                  });
                  artistInput.value = '';
                  artistDropdown.style.display = 'none';
                });
              });

              artistDropdown.style.display = 'block';
            } else {
              artistDropdown.style.display = 'none';
            }
          } catch (_) {
            artistDropdown.style.display = 'none';
          }
        }, 250);
      });
    }

    // Pill group active listeners
    ['tuner-variety-group', 'tuner-songtype-group', 'tuner-vibe-group'].forEach(groupId => {
      const group = document.getElementById(groupId);
      if (group) {
        group.querySelectorAll('.tuner-pill').forEach(pill => {
          pill.addEventListener('click', () => {
            group.querySelectorAll('.tuner-pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
          });
        });
      }
    });

    // Launch station button
    const launchBtn = document.getElementById('btn-launch-station');
    if (launchBtn) {
      launchBtn.addEventListener('click', async () => {
        const artists = RadioTuner.getSelectedArtists();
        const variety = document.querySelector('#tuner-variety-group .tuner-pill.active')?.dataset.val || 'blend';
        const songType = document.querySelector('#tuner-songtype-group .tuner-pill.active')?.dataset.val || 'popular';
        const vibe = document.querySelector('#tuner-vibe-group .tuner-pill.active')?.dataset.val || 'all';

        await RadioTuner.generateCustomStation({ artists, variety, songType, vibe });
      });
    }
  }

  // ---- Player Bar Events ----

  function setupPlayerBarEvents() {
    const fullProgress = document.getElementById('full-progress');
    const miniProgress = document.getElementById('mini-progress');
    const fFill = document.getElementById('full-progress-fill');
    const mFill = document.getElementById('mini-progress-fill');
    const tCurr = document.getElementById('time-current');
    
    window.isSeeking = false;
    let activeBar = null;
    let dragPercent = null;

    function updateVisualSeek(percent, bar) {
      if (bar === fullProgress || bar?.id === 'full-progress') {
        if (fFill) fFill.style.width = `${percent}%`;
        const duration = Player.getDuration ? Player.getDuration() : 0;
        if (tCurr && duration > 0) {
          tCurr.textContent = UI.formatDuration ? UI.formatDuration((percent / 100) * duration) : '0:00';
        }
      } else if (bar === miniProgress || bar?.id === 'mini-progress') {
        if (mFill) mFill.style.width = `${percent}%`;
      }
    }

    function calculatePercent(clientX, bar) {
      const rect = bar.getBoundingClientRect();
      if (!rect.width) return 0;
      return Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    }

    function startSeek(clientX, bar) {
      window.isSeeking = true;
      activeBar = bar;
      document.body.classList.add('is-seeking');
      const percent = calculatePercent(clientX, bar);
      dragPercent = percent;
      updateVisualSeek(percent, bar);
      if (typeof Haptics !== 'undefined' && Haptics.selection) Haptics.selection();
    }

    function moveSeek(clientX) {
      if (!window.isSeeking || !activeBar) return;
      const percent = calculatePercent(clientX, activeBar);
      dragPercent = percent;
      updateVisualSeek(percent, activeBar);
    }

    function endSeek() {
      if (!window.isSeeking) return;
      document.body.classList.remove('is-seeking');
      if (dragPercent !== null) {
        Player.seekPercent(dragPercent);
        if (typeof Haptics !== 'undefined' && Haptics.light) Haptics.light();
      }
      activeBar = null;
      dragPercent = null;
      setTimeout(() => {
        window.isSeeking = false;
      }, 100);
    }

    if (fullProgress) {
      fullProgress.addEventListener('mousedown', (e) => {
        startSeek(e.clientX, fullProgress);
      });
      fullProgress.addEventListener('touchstart', (e) => {
        if (e.touches.length > 0) startSeek(e.touches[0].clientX, fullProgress);
      }, { passive: true });
    }

    if (miniProgress) {
      miniProgress.addEventListener('mousedown', (e) => {
        startSeek(e.clientX, miniProgress);
      });
      miniProgress.addEventListener('touchstart', (e) => {
        if (e.touches.length > 0) startSeek(e.touches[0].clientX, miniProgress);
      }, { passive: true });
    }

    document.addEventListener('mousemove', (e) => {
      moveSeek(e.clientX);
    });

    document.addEventListener('touchmove', (e) => {
      if (e.touches.length > 0) moveSeek(e.touches[0].clientX);
    }, { passive: true });

    document.addEventListener('mouseup', () => {
      endSeek();
    });

    document.addEventListener('touchend', () => {
      endSeek();
    });

    // Volume sliders (Desktop & Mobile Full Player)
    const volumeSliders = document.querySelectorAll('.volume-slider');
    volumeSliders.forEach(slider => {
      slider.addEventListener('input', () => {
        const vol = parseFloat(slider.value) / 100;
        Player.setVolume(vol);
        UI.updateVolumeIcon(vol);
        volumeSliders.forEach(s => {
          if (s !== slider) s.value = slider.value;
        });
      });
    });
  }

  // ---- Delegated Click Events ----

  function setupPwaInstall() {
    const installBanner = document.getElementById('install-banner');
    const btnInstall = document.getElementById('btn-install-pwa');
    const btnDismiss = document.getElementById('btn-dismiss-install');

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      window.deferredPwaPrompt = e;
      if (installBanner && !sessionStorage.getItem('pwa_banner_dismissed')) {
        installBanner.style.display = 'flex';
      }
      const settingsPwaBtn = document.getElementById('btn-settings-install-pwa');
      if (settingsPwaBtn) settingsPwaBtn.style.display = 'flex';
    });

    if (btnInstall) {
      btnInstall.addEventListener('click', () => {
        if (window.deferredPwaPrompt) {
          window.deferredPwaPrompt.prompt();
          window.deferredPwaPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
              UI.showToast('🎉 Welcome to MusicFlow App!', 'success');
              if (typeof Haptics !== 'undefined') Haptics.success();
            }
            window.deferredPwaPrompt = null;
            if (installBanner) installBanner.style.display = 'none';
          });
        }
      });
    }

    if (btnDismiss) {
      btnDismiss.addEventListener('click', () => {
        if (installBanner) installBanner.style.display = 'none';
        sessionStorage.setItem('pwa_banner_dismissed', 'true');
      });
    }

    window.addEventListener('appinstalled', () => {
      if (installBanner) installBanner.style.display = 'none';
      window.deferredPwaPrompt = null;
      UI.showToast('🚀 MusicFlow successfully installed on your device!', 'success');
    });
  }

  function setupDelegatedEvents() {
    document.addEventListener('click', (e) => {
      // First check specific IDs
      const saveBtn = e.target.closest('#btn-save-playlist');
      if (saveBtn) {
        const queue = Player.getQueue();
        if (queue.length === 0) return UI.showToast('Queue is empty');
        const name = prompt('Enter playlist name:', 'New Playlist');
        if (name) {
          Storage.createPlaylist(name, queue);
          UI.showToast(`Saved ${queue.length} songs to "${name}"`, 'success');
        }
        return;
      }

      const refreshBtn = e.target.closest('#btn-refresh-home');
      if (refreshBtn) {
        refreshBtn.style.transition = 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
        refreshBtn.style.transform = 'rotate(360deg)';
        if (typeof UI !== 'undefined' && UI.showToast) {
          UI.showToast('✨ Discovering fresh recommendations...', 'info');
        }
        loadHomePage(true).finally(() => {
          setTimeout(() => {
            refreshBtn.style.transition = 'none';
            refreshBtn.style.transform = 'rotate(0deg)';
          }, 650);
        });
        return;
      }

      const userProfileBtn = e.target.closest('#btn-user-profile-header, .user-profile-header-btn');
      if (userProfileBtn) {
        if (typeof Settings !== 'undefined' && Settings.openProfileModal) {
          Settings.openProfileModal();
        }
        return;
      }

      const settingsBtn = e.target.closest('.settings-btn, #btn-open-settings, [data-action="open-settings"]');
      if (settingsBtn) {
        openSettingsModal();
        return;
      }

      const closeSettingsBtn = e.target.closest('#btn-close-settings, [data-action="close-settings"]');
      if (closeSettingsBtn) {
        const modal = document.getElementById('settings-modal');
        if (modal) modal.style.display = 'none';
        return;
      }

      const clearBtn = e.target.closest('#btn-clear-queue');
      if (clearBtn) {
        if (confirm('Clear the entire queue?')) {
          const prevQueue = Player.getQueue();
          const prevIdx = Player.getCurrentIndex();
          Player.setQueue([], -1);
          Player.pause();
          const rerenderQueue = () => {
            const qContainer = document.getElementById('queue-container');
            if (qContainer) {
              UI.renderQueue(qContainer);
              rebindQueueEvents();
            }
          };
          rerenderQueue();
          UI.showToast('Queue cleared', 'info', {
            action: {
              label: 'Undo',
              onClick: () => {
                Player.setQueue(prevQueue, Math.max(0, prevIdx));
                rerenderQueue();
                UI.showToast('Queue restored', 'success');
              }
            }
          });
        }
        return;
      }

      // Then check data-actions
      const target = e.target.closest('[data-action]');
      if (!target) return;

      const action = target.dataset.action;

      switch (action) {
        case 'toggle-play':
          Player.togglePlayPause();
          break;

        case 'next':
          Player.next();
          break;

        case 'previous':
          Player.previous();
          break;

        case 'shuffle':
          UI.updateShuffleButton(Player.toggleShuffle());
          UI.showToast(`Shuffle ${Player.getShuffleMode() ? 'on' : 'off'}`, 'info');
          break;

        case 'repeat': {
          const mode = Player.cycleRepeat();
          UI.updateRepeatButton(mode);
          const labels = { off: 'Repeat off', all: 'Repeat all', one: 'Repeat one' };
          UI.showToast(labels[mode], 'info');
          break;
        }

        case 'queue':
          if (typeof Haptics !== 'undefined') Haptics.light();
          navigateToPage('page-queue');
          break;

        case 'volume-toggle': {
          const muted = Player.mute();
          UI.updateVolumeIcon(muted ? 0 : Player.getVolume());
          break;
        }

        case 'fav-current': {
          const track = Player.getCurrentTrack();
          if (track) {
            const isFav = Storage.toggleFavorite(track);
            UI.showToast(isFav ? 'Added to favorites ❤️' : 'Removed from favorites', isFav ? 'success' : 'info');
            UI.updatePlayerBar(track);
          }
          break;
        }

        case 'fav': {
          const card = target.closest('[data-song-id]');
          if (!card || !card.dataset.songId) return;
          const songId = card.dataset.songId;
          // Look up song in any current dataset or history/queue/favorites
          let song = null;
          if (window.currentSearchResults) song = window.currentSearchResults.find(s => s.id === songId);
          if (!song) song = Storage.getFavorites().find(s => s.id === songId);
          if (!song) song = Storage.getRecent().find(s => s.id === songId);
          if (!song) song = Player.getQueue().find(s => s.id === songId);
          if (!song) return;

          const isFav = Storage.toggleFavorite(song);
          target.classList.toggle('active', isFav);
          const svg = target.querySelector('svg');
          if (svg) svg.setAttribute('fill', isFav ? 'currentColor' : 'none');
          UI.showToast(isFav ? 'Added to favorites ❤️' : 'Removed from favorites', isFav ? 'success' : 'info');
          break;
        }

        case 'add-queue': {
          const card = target.closest('[data-song-id]');
          if (!card || !card.dataset.songId) return;
          const songId = card.dataset.songId;
          let song = null;
          if (window.currentSearchResults) song = window.currentSearchResults.find(s => s.id === songId);
          if (!song) song = Storage.getFavorites().find(s => s.id === songId);
          if (!song) song = Storage.getRecent().find(s => s.id === songId);
          if (!song) return;

          Player.addToQueue(song);
          UI.showToast(`Added "${song.name}" to queue`, 'success');
          break;
        }

        case 'download': {
          const card = target.closest('[data-song-id]');
          if (!card || !card.dataset.songId) return;
          const songId = card.dataset.songId;
          let song = null;
          if (window.currentSearchResults) song = window.currentSearchResults.find(s => s.id === songId);
          if (!song) song = Storage.getFavorites().find(s => s.id === songId);
          if (!song) song = Storage.getRecent().find(s => s.id === songId);
          if (!song) song = Player.getQueue().find(s => s.id === songId);

          if (song && window.Download) Download.downloadSong(song);
          break;
        }

        case 'context-menu': {
          let song = null;
          const card = target.closest('[data-song-id]');
          if (card && card.dataset.songId) {
            const songId = card.dataset.songId;
            if (window.currentSearchResults) song = window.currentSearchResults.find(s => s.id === songId);
            if (!song) song = Storage.getFavorites().find(s => s.id === songId);
            if (!song) song = Storage.getRecent().find(s => s.id === songId);
            if (!song) song = Player.getQueue().find(s => s.id === songId);
          } else {
            song = Player.getCurrentTrack();
          }

          if (song) {
            const rect = target.getBoundingClientRect();
            UI.showContextMenu(rect.left - 120, rect.bottom + 5, [
              ...(() => {
                const pls = Storage.getPlaylists() || [];
                const items = pls.slice(0, 5).map(p => ({
                  label: `Add to ${p.name}`,
                  icon: '\u{1F4C1}',
                  onClick: () => { Storage.addSongToPlaylist(p.id, song); UI.showToast(`Added to ${p.name}`, 'success'); }
                }));
                items.push({
                  label: 'Add to New Playlist\u2026',
                  icon: '\u2795',
                  onClick: () => {
                    const name = prompt('Playlist name:');
                    if (name && name.trim()) {
                      const np = Storage.createPlaylist(name.trim());
                      Storage.addSongToPlaylist(np.id, song);
                      UI.showToast(`Created \u201C${np.name}\u201D and added song`, 'success');
                    }
                  }
                });
                items.push({ type: 'divider' });
                return items;
              })(),
              { label: 'Play Next', icon: '▶️', onClick: () => { Player.playNext(song); UI.showToast('Added to Play Next'); } },
              { label: 'Add to Queue', icon: '🎵', onClick: () => { Player.addToQueue(song); UI.showToast('Added to Queue'); } },
              { label: 'Start Radio', icon: '📻', onClick: () => startRadioForSong(song) },
              { label: 'Download', icon: '⬇️', onClick: () => typeof Download !== 'undefined' ? Download.downloadSong(song) : null },
              { type: 'divider' },
              { label: 'Go to Artist', icon: '👤', onClick: () => {
                 const artistName = song.artists ? song.artists.split(',')[0].trim() : 'Unknown';
                 openArtistPage(artistName, song.image);
              } },
              { label: 'Go to Album', icon: '💿', onClick: () => { 
                if (song.albumId) openAlbumPage(song.albumId, song.album, song.image); 
                else UI.showToast('Album not available for this track'); 
              } },
              { type: 'divider' },
              { label: 'Share', icon: '🔗', onClick: () => {
                if (navigator.share) {
                  navigator.share({ title: song.name, text: `Listen to ${song.name} by ${song.artists || 'Unknown Artist'}`, url: buildSongShareUrl(song) }).catch(()=>{});
                } else {
                  navigator.clipboard.writeText(buildSongShareUrl(song));
                  UI.showToast('Song link copied to clipboard', 'success');
                }
              }}
            ]);
          }
          break;
        }

        case 'open-artist': {
          const card = target.closest('.song-card');
          if (!card) return;
          const nameEl = card.querySelector('.song-card__name');
          const imgEl = card.querySelector('.song-card__img');
          const name = nameEl ? nameEl.textContent : 'Unknown';
          const img = imgEl ? imgEl.src : '';
          openArtistPage(name, img);
          break;
        }
      }
    });
  }

  function bindSongCardEvents(container, dataset = null) {
    // Play
    container.querySelectorAll('[data-action="play"]').forEach(el => {
      el.addEventListener('click', async () => {
        const card = el.closest('[data-song-id]');
        const songId = card?.dataset.songId;
        if (!songId) return;

        const sourceList = dataset || currentSearchResults;
        const song = sourceList.find(s => s.id === songId);
        if (song) {
          // Set entire list as queue
          Player.setQueue(sourceList, sourceList.indexOf(song));
          await Player.playSong(song);
        }
      });
    });

    // Favorite
    container.querySelectorAll('[data-action="fav"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const card = btn.closest('[data-song-id]');
        const songId = card?.dataset.songId;
        if (!songId) return;

        const sourceList = dataset || currentSearchResults;
        const song = sourceList.find(s => s.id === songId) || Storage.getFavorites().find(s => s.id === songId);
        if (song) {
          const isFav = Storage.toggleFavorite(song);
          btn.classList.toggle('active', isFav);
          btn.querySelector('svg').setAttribute('fill', isFav ? 'currentColor' : 'none');
          UI.showToast(isFav ? 'Added to favorites ❤️' : 'Removed from favorites', isFav ? 'success' : 'info');
        }
      });
    });

    // Download
    container.querySelectorAll('[data-action="download"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const card = btn.closest('[data-song-id]');
        const songId = card?.dataset.songId;
        if (!songId) return;

        const sourceList = dataset || currentSearchResults;
        const song = sourceList.find(s => s.id === songId) || Storage.getFavorites().find(s => s.id === songId);
        if (song) Download.downloadSong(song);
      });
    });

    // Add to queue
    container.querySelectorAll('[data-action="add-queue"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const card = btn.closest('[data-song-id]');
        const songId = card?.dataset.songId;
        if (!songId) return;

        const sourceList = dataset || currentSearchResults;
        const song = sourceList.find(s => s.id === songId);
        if (song) {
          Player.addToQueue(song);
          UI.showToast(`Added "${song.name}" to queue`, 'success');
        }
      });
    });
  }

  function bindFavoritesEvents() {
    const container = document.getElementById('favorites-container');
    const favs = Storage.getFavorites();

    // Play from favorites
    container.querySelectorAll('[data-action="play"]').forEach(el => {
      el.addEventListener('click', async () => {
        const item = el.closest('[data-song-id]');
        const songId = item?.dataset.songId;
        if (!songId) return;

        const index = parseInt(el.dataset.index, 10);
        Player.setQueue(favs, index);
        await Player.playSong(favs[index]);
      });
    });

    // Fav toggle (unfavorite)
    container.querySelectorAll('[data-action="fav"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const item = btn.closest('[data-song-id]');
        const songId = item?.dataset.songId;
        if (!songId) return;

        Storage.removeFavorite(songId);
        UI.renderFavorites(container);
        bindFavoritesEvents();
        UI.showToast('Removed from favorites', 'info');
      });
    });

    // Download
    container.querySelectorAll('[data-action="download"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const item = btn.closest('[data-song-id]');
        const songId = item?.dataset.songId;
        if (!songId) return;

        const song = favs.find(s => s.id === songId);
        if (song) Download.downloadSong(song);
      });
    });
  }

  function rebindQueueEvents() {
    const container = document.getElementById('queue-container');
    const queue = Player.getQueue();

    // Play from queue
    container.querySelectorAll('[data-action="play"]').forEach(el => {
      el.addEventListener('click', async () => {
        const index = parseInt(el.dataset.index, 10);
        if (queue[index]) {
          await Player.playSong(queue[index]);
        }
      });
    });

    // Remove from queue
    container.querySelectorAll('[data-action="remove-queue"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const index = parseInt(btn.dataset.index, 10);
        Player.removeFromQueue(index);
        UI.showToast('Removed from queue', 'info');
      });
    });

    // Fav toggle
    container.querySelectorAll('[data-action="fav"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const item = btn.closest('[data-song-id]');
        const songId = item?.dataset.songId;
        if (!songId) return;

        const song = queue.find(s => s.id === songId);
        if (song) {
          const isFav = Storage.toggleFavorite(song);
          btn.classList.toggle('active', isFav);
          btn.querySelector('svg').setAttribute('fill', isFav ? 'currentColor' : 'none');
        }
      });
    });

    // Download
    container.querySelectorAll('[data-action="download"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const item = btn.closest('[data-song-id]');
        const songId = item?.dataset.songId;
        if (!songId) return;

        const song = queue.find(s => s.id === songId);
        if (song) Download.downloadSong(song);
      });
    });

    // Context Menu
    container.querySelectorAll('[data-action="context-menu"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const item = btn.closest('[data-song-id]');
        const songId = item?.dataset.songId;
        if (!songId) return;
        let song = queue.find(s => s.id === songId) || recent.find(s => s.id === songId);
        if (!song && item.dataset.songData) {
          try { song = JSON.parse(decodeURIComponent(item.dataset.songData)); } catch(e){}
        }
        song = song || Player.getCurrentTrack(); // Fallback
        
        if (song) {
          const rect = btn.getBoundingClientRect();
          
          const playlists = Storage.getPlaylists() || [];
          const playlistItems = playlists.map(p => ({
            label: `Add to ${p.name}`,
            icon: '📁',
            onClick: () => {
              Storage.addSongToPlaylist(p.id, song);
              UI.showToast(`Added to ${p.name}`, 'success');
            }
          }));

          UI.showContextMenu(rect.left, rect.bottom + 5, [
            { label: 'Play Next', icon: '▶️', onClick: () => { Player.playNext(song); UI.showToast('Added to Play Next'); } },
            { label: 'Add to Queue', icon: '🎵', onClick: () => { Player.addToQueue(song); UI.showToast('Added to Queue'); } },
            ...playlistItems,
            { label: 'Start Radio', icon: '📻', onClick: () => startRadioForSong(song) },
            { type: 'divider' },
            { label: 'Go to Artist', icon: '👤', onClick: () => {
               const artistName = song.artists ? song.artists.split(',')[0].trim() : 'Unknown';
               openArtistPage(artistName, song.image);
            } },
            { label: 'Go to Album', icon: '💿', onClick: () => {
              if (song.albumId) openAlbumPage(song.albumId, song.album, song.image);
              else UI.showToast('Album not available for this track');
            } },
            { type: 'divider' },
            { label: 'Share', icon: '🔗', onClick: () => {
              if (navigator.share) {
                navigator.share({ title: song.name, text: `Listen to ${song.name} by ${song.artists}`, url: buildSongShareUrl(song) })
                  .catch(() => UI.showToast('Failed to share', 'error'));
              } else {
                navigator.clipboard.writeText(buildSongShareUrl(song));
                UI.showToast('Song link copied to clipboard', 'success');
              }
            }}
          ]);
        }
      });
    });
  }

  // ---- Home Page ----

  async function loadHomePage(forceRefresh = false) {
    // 1. Greeting with Username
    const greetingEl = document.getElementById('home-greeting');
    if (greetingEl) {
      const profile = (typeof Storage !== 'undefined' && Storage.getUserProfile) ? Storage.getUserProfile() : { username: 'Adesh' };
      const name = profile.username || 'Adesh';
      const hour = new Date().getHours();
      let greeting = 'Good Evening';
      if (hour < 12) greeting = 'Good Morning';
      else if (hour < 17) greeting = 'Good Afternoon';
      greetingEl.innerHTML = `${greeting}, <span class="home-greeting-user">${name}</span> 👋`;
    }

    // 2. Render Sticky Mood & Activity Filter Chips
    const moodChipsContainer = document.getElementById('mood-chips-container');
    if (moodChipsContainer && typeof UI !== 'undefined' && UI.renderMoodChips) {
      UI.renderMoodChips(moodChipsContainer, typeof Moods !== 'undefined' ? Moods.getActiveMood() : 'all');
    }

    // 3. Render Regional & Global Language Chips
    const langChipsContainer = document.getElementById('language-chips-container');
    if (langChipsContainer && typeof UI !== 'undefined' && UI.renderLanguageChips) {
      UI.renderLanguageChips(langChipsContainer);
    }

    // 4. Show loading for shelves
    const shelves = [
      { id: 'shelf-trending', key: 'trending', type: 'song' },
      { id: 'shelf-global', key: 'global', type: 'song' },
      { id: 'shelf-newReleases', key: 'newReleases', type: 'song' },
      { id: 'shelf-chill', key: 'chill', type: 'song' },
      { id: 'shelf-focus', key: 'focus', type: 'song' },
      { id: 'shelf-workout', key: 'workout', type: 'song' },
      { id: 'shelf-popularAlbums', key: 'popularAlbums', type: 'album' },
      { id: 'shelf-popularArtists', key: 'popularArtists', type: 'artist' }
    ];

    shelves.forEach(shelf => {
      const el = document.getElementById(shelf.id);
      if (el) UI.showLoading(el, shelf.type);
    });

    // 5. Fetch Data (with forceRefresh support)
    const data = await API.getHomeRecommendations(forceRefresh);

    // 6. Render Quick Picks 4x4 Instant Launch Grid
    const quickPicksContainer = document.getElementById('quick-picks-container');
    if (quickPicksContainer && typeof UI !== 'undefined' && UI.renderQuickPicks) {
      const history = Storage.getListeningHistory();
      const favs = Storage.getFavorites();
      const candidatePool = [...favs, ...history.slice(0, 10), ...(data.trending || []), ...(data.global || [])];
      
      const seen = new Set();
      const quickPickSongs = [];
      candidatePool.forEach(item => {
        if (item && item.id && !seen.has(item.id)) {
          seen.add(item.id);
          quickPickSongs.push(API.normalizeSong(item));
        }
      });

      // Shuffle pool for discovery and fresh picks
      const shuffledQuickPicks = quickPickSongs.sort(() => Math.random() - 0.5);

      // Show top 16 tracks (4 columns x 4 rows)
      UI.renderQuickPicks(shuffledQuickPicks.slice(0, 16), quickPicksContainer);
    }

    // 7. Render Personalized Mix Suite
    const mixSuiteContainer = document.getElementById('mix-suite-container');
    if (mixSuiteContainer && typeof MixSuite !== 'undefined' && UI.renderMixSuiteShelf) {
      const mixes = await MixSuite.generateMixSuite();
      UI.renderMixSuiteShelf(mixes, mixSuiteContainer);
    }

    // 7b. Render Contextual & Situational Lifestyle Hubs (Office, Home, Workout, Drive, Sleep, Party)
    const lifestyleHubsContainer = document.getElementById('lifestyle-hubs-container');
    if (lifestyleHubsContainer && UI.renderLifestyleHubs) {
      UI.renderLifestyleHubs(lifestyleHubsContainer);
    }

    // 8. Hero Section
    const heroSection = document.getElementById('hero-section');
    if (heroSection && data.hero) {
      const heroBg = document.getElementById('hero-bg');
      const heroImg = document.getElementById('hero-img');
      const heroTitle = document.getElementById('hero-title');
      const heroSubtitle = document.getElementById('hero-subtitle');
      const heroPlayBtn = document.getElementById('hero-play-btn');

      const heroSong = API.normalizeSong(data.hero);
      
      heroBg.style.backgroundImage = `url(${heroSong.image})`;
      heroImg.src = heroSong.image;
      heroTitle.textContent = heroSong.name;
      heroSubtitle.textContent = heroSong.artists;
      heroSection.style.display = 'flex';

      // Remove old listeners to prevent stacking
      const newPlayBtn = heroPlayBtn.cloneNode(true);
      heroPlayBtn.parentNode.replaceChild(newPlayBtn, heroPlayBtn);
      
      newPlayBtn.addEventListener('click', async () => {
        Player.setQueue([heroSong], 0);
        await Player.playSong(heroSong);
      });
    }

    // 9. Render Default Shelves
    shelves.forEach(shelf => {
      const el = document.getElementById(shelf.id);
      if (!el) return;
      
      const items = data[shelf.key] || [];
      if (items.length === 0) {
        el.parentElement.style.display = 'none';
        return;
      }

      if (shelf.type === 'song') {
        const normSongs = items.map(s => API.normalizeSong(s));
        UI.renderShelf(normSongs, el, 'song');
        bindSongCardEvents(el, normSongs);
      } else {
        UI.renderShelf(items, el, shelf.type);
        el.querySelectorAll('[data-action="open-album"]').forEach(btn => {
          btn.addEventListener('click', (e) => {
             const card = e.target.closest('.song-card');
             if (!card || !card.dataset.albumId) return;
             const nameEl = card.querySelector('.song-card__name');
             const imgEl = card.querySelector('.song-card__img');
             openAlbumPage(card.dataset.albumId, nameEl ? nameEl.textContent : 'Unknown', imgEl ? imgEl.src : '');
          });
        });
      }
    });

    // 10. Load Recently Played
    const recentContainer = document.getElementById('recent-container');
    if (recentContainer) {
      UI.renderRecent(recentContainer);
      const recent = Storage.getRecent();
      if (recent.length > 0) {
        recentContainer.parentElement.style.display = 'block';
        recentContainer.querySelectorAll('[data-action="play"]').forEach(el => {
          el.addEventListener('click', async () => {
            const card = el.closest('[data-song-id]');
            const songId = card?.dataset.songId;
            if (!songId) return;
            const song = recent.find(s => s.id === songId);
            if (song) {
              Player.setQueue(recent, recent.indexOf(song));
              await Player.playSong(song);
            }
          });
        });
      }
    }

    // 11. Render Public & Community Playlists
    const publicPlContainer = document.getElementById('public-playlists-container');
    if (publicPlContainer && typeof PlaylistSharing !== 'undefined' && UI.renderPublicPlaylistsShelf) {
      UI.renderPublicPlaylistsShelf(PlaylistSharing.getPublicPlaylists(), publicPlContainer);
    }
  }

  // ---- Settings & Visualizer ----

  let visualizerRAF = null;

  function openSettingsModal() {
    const modal = document.getElementById('settings-modal');
    if (!modal) return;
    modal.style.display = 'flex';
    
    const settings = Storage.getSettings();
    const themeSelect = document.getElementById('select-theme');
    if (themeSelect) themeSelect.value = settings.theme || 'system';
    
    const colorSelect = document.getElementById('select-color');
    if (colorSelect) colorSelect.value = settings.color || 'green';
    
    const toggleGlass = document.getElementById('toggle-glass');
    if (toggleGlass) toggleGlass.checked = settings.glassEffect === true;

    const langCheckboxes = document.querySelectorAll('#settings-languages input[type="checkbox"]');
    const prefs = settings.languages || ['hindi', 'english', 'punjabi'];
    langCheckboxes.forEach(cb => {
      cb.checked = prefs.includes(cb.value);
    });
    
    const qualEl = document.getElementById('select-quality');
    if (qualEl) qualEl.value = settings.audioQuality || '320kbps';

    const mxKeyEl = document.getElementById('input-musixmatch-key');
    if (mxKeyEl) mxKeyEl.value = settings.musixmatchApiKey || '';
    
    const speedEl = document.getElementById('select-speed');
    if (speedEl) speedEl.value = Player.getPlaybackSpeed();
    
    const eqPresetSelect = document.getElementById('select-eq-preset');
    if (eqPresetSelect) eqPresetSelect.value = settings.eqPreset || 'flat';
    
    const spatialToggle = document.getElementById('toggle-spatial-audio');
    if (spatialToggle) spatialToggle.checked = settings.spatialAudio === true;
    
    const ambientSelect = document.getElementById('select-ambient-sound');
    if (ambientSelect) ambientSelect.value = settings.ambientSound || 'off';

    const beatPulseToggle = document.getElementById('toggle-beat-pulse');
    if (beatPulseToggle) beatPulseToggle.checked = settings.beatPulse !== false;

    const visualizerToggle = document.getElementById('toggle-visualizer');
    if (visualizerToggle) visualizerToggle.checked = settings.visualizer !== false; // Default true

    const timerSelect = document.getElementById('select-timer');
    if (timerSelect) {
      const currentTimer = Player.getSleepTimerMinutes();
      timerSelect.value = currentTimer > 0 ? currentTimer.toString() : '0';
    }
    
    buildEqSliders();
  }

  function buildEqSliders() {
    const eqContainer = document.querySelector('.eq-sliders');
    if (!eqContainer || eqContainer.children.length > 0) return;
    
    const settings = Storage.getSettings();
    const toggleEq = document.getElementById('toggle-equalizer');
    const eqView = document.getElementById('eq-container-view');
    
    if (toggleEq) {
      toggleEq.checked = !!settings.eqEnabled;
      eqView.style.display = settings.eqEnabled ? 'block' : 'none';
      
      toggleEq.addEventListener('change', (e) => {
        const enabled = e.target.checked;
        eqView.style.display = enabled ? 'block' : 'none';
        Storage.updateSettings({ eqEnabled: enabled });
        if (enabled) {
          const currentEQ = Storage.getSettings().eq || Array(10).fill(0);
          currentEQ.forEach((val, i) => Player.setEqBand(i, val));
        } else {
          // If disabled, reset bands to 0 if WebAudio is already running
          for (let i=0; i<10; i++) {
             Player.setEqBand(i, 0);
          }
        }
      });
    }

    const freqs = ['60', '170', '310', '600', '1k', '3k', '6k', '12k', '14k', '16k'];
    const savedEQ = settings.eq || Array(10).fill(0);
    freqs.forEach((freq, i) => {
      const band = document.createElement('div');
      band.className = 'eq-band';
      band.innerHTML = `
        <input type="range" class="eq-slider" min="-12" max="12" step="0.1" value="${savedEQ[i]}" data-index="${i}">
        <div class="eq-label">${freq}</div>
      `;
      eqContainer.appendChild(band);
      if (settings.eqEnabled) {
        Player.setEqBand(i, savedEQ[i]);
      }
    });
    
    eqContainer.addEventListener('input', (e) => {
      if (e.target.classList.contains('eq-slider')) {
        const idx = parseInt(e.target.dataset.index);
        const val = parseFloat(e.target.value);
        if (Storage.getSettings().eqEnabled) {
          Player.setEqBand(idx, val);
        }
        
        const newEQ = Storage.getSettings().eq || Array(10).fill(0);
        newEQ[idx] = val;
        Storage.updateSettings({ eq: newEQ });
      }
    });
  }

  function initSettings() {
    const modal = document.getElementById('settings-modal');
    
    buildEqSliders();

    document.querySelectorAll('.settings-btn, #btn-open-settings').forEach(btn => {
      btn.addEventListener('click', openSettingsModal);
    });

    document.getElementById('btn-close-settings')?.addEventListener('click', () => {
      if (modal) modal.style.display = 'none';
    });

    modal?.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.style.display = 'none';
      }
    });

    const langCheckboxes = document.querySelectorAll('#settings-languages input[type="checkbox"]');
    langCheckboxes.forEach(cb => {
      cb.addEventListener('change', () => {
        const selected = Array.from(langCheckboxes)
          .filter(c => c.checked)
          .map(c => c.value);
        Storage.updateSettings({ languages: selected });
        Storage.clearHomeCache();
      });
    });

    document.getElementById('input-musixmatch-key')?.addEventListener('input', (e) => {
      const key = e.target.value.trim();
      Storage.updateSettings({ musixmatchApiKey: key });
    });

    document.getElementById('select-quality')?.addEventListener('change', async (e) => {
      const qual = e.target.value;
      Storage.updateSettings({ audioQuality: qual });
      if (typeof Player !== 'undefined' && Player.changeQuality) {
        await Player.changeQuality(qual);
      }
      const codecEl = document.getElementById('full-player-codec');
      if (codecEl && typeof Player !== 'undefined' && Player.getStreamCodecDisplay) {
        codecEl.textContent = Player.getStreamCodecDisplay();
        if (typeof UI !== 'undefined' && UI.updateCodecBadgeStyle) {
          UI.updateCodecBadgeStyle(codecEl, qual);
        }
      }
      UI.showToast(`Audio quality set to ${qual}`, 'success');
    });

    document.getElementById('select-theme')?.addEventListener('change', (e) => {
      Storage.updateSettings({ theme: e.target.value });
      applyTheme();
      UI.showToast(`Theme updated to ${e.target.value}`);
    });

    document.getElementById('select-color')?.addEventListener('change', (e) => {
      Storage.updateSettings({ color: e.target.value });
      applyTheme();
      UI.showToast(`Accent color set to ${e.target.value}`);
    });

    document.getElementById('toggle-beat-pulse')?.addEventListener('change', (e) => {
      Storage.updateSettings({ beatPulse: e.target.checked });
      UI.showToast(`Beat-Reactive Artwork Scaling ${e.target.checked ? 'enabled' : 'disabled'}`);
    });

    document.getElementById('toggle-visualizer')?.addEventListener('change', (e) => {
      Storage.updateSettings({ visualizer: e.target.checked });
      syncVisualizer();
      UI.showToast(`Audio visualizer ${e.target.checked ? 'enabled' : 'disabled'}`);
    });

    document.getElementById('toggle-glass')?.addEventListener('change', (e) => {
      Storage.updateSettings({ glassEffect: e.target.checked });
      applyTheme();
      UI.showToast(`Glassmorphism ${e.target.checked ? 'enabled' : 'disabled'}`);
    });

    document.getElementById('select-eq-preset')?.addEventListener('change', (e) => {
      Storage.updateSettings({ eqPreset: e.target.value });
      const presetValues = Player.applyEqPreset(e.target.value);
      
      // Update UI sliders dynamically
      document.querySelectorAll('.eq-slider').forEach((slider, i) => {
        if (presetValues && presetValues[i] !== undefined) {
          slider.value = presetValues[i];
        }
      });
      
      UI.showToast(`Equalizer preset set to ${e.target.options[e.target.selectedIndex].text}`);
    });

    document.getElementById('toggle-spatial-audio')?.addEventListener('change', (e) => {
      Storage.updateSettings({ spatialAudio: e.target.checked });
      const state = Player.toggleSpatialAudio();
      UI.showToast(`3D Spatial Audio ${state ? 'enabled' : 'disabled'}`);
    });

    document.getElementById('select-ambient-sound')?.addEventListener('change', (e) => {
      Storage.updateSettings({ ambientSound: e.target.value });
      Player.playAmbientSound(e.target.value);
      if (e.target.value !== 'off') {
        UI.showToast(`Ambient Sound "${e.target.options[e.target.selectedIndex].text}" active`, 'success');
      } else {
        UI.showToast('Ambient sounds turned off');
      }
    });

    document.getElementById('select-timer')?.addEventListener('change', (e) => {
      const val = parseInt(e.target.value) || 0;
      Player.setSleepTimer(val);
      if (val > 0) {
        UI.showToast(`Sleep Timer set for ${val} minutes`, 'info');
      } else {
        UI.showToast('Sleep Timer turned off');
      }
    });

    // Data Clear Buttons
    document.getElementById('btn-clear-history')?.addEventListener('click', () => {
      if (confirm('Clear all listening history?')) {
        localStorage.removeItem('mf_listening_history');
        localStorage.removeItem('mf_recent');
        UI.showToast('Listening history cleared');
      }
    });

    document.getElementById('btn-clear-search')?.addEventListener('click', () => {
      localStorage.removeItem('mf_search_history');
      UI.showToast('Search history cleared');
    });

    document.getElementById('btn-reset-app')?.addEventListener('click', () => {
      if (confirm('WARNING: This will clear all local data, playlists, and settings. Proceed?')) {
        localStorage.clear();
        window.location.reload();
      }
    });

    document.getElementById('select-speed')?.addEventListener('change', (e) => {
      Player.setPlaybackSpeed(parseFloat(e.target.value));
    });


  }

  // Start/stop the circular visualizer based on player state & setting
  function syncVisualizer() {
    const canvas = document.getElementById('visualizer-canvas');
    if (!canvas) return;
    const pc = document.getElementById('player-container');
    const expanded = pc && pc.classList.contains('player-expanded');
    const settings = (typeof Storage !== 'undefined' && Storage.getSettings) ? Storage.getSettings() : {};
    const enabled = settings.visualizer !== false; // default ON
    const playing = (typeof Player !== 'undefined' && Player.getIsPlaying) ? Player.getIsPlaying() : false;
    const shouldRun = expanded && enabled && playing;

    if (shouldRun && !visualizerRAF) {
      canvas.style.display = 'block';
      startVisualizer();
    } else if (!shouldRun && visualizerRAF) {
      canvas.style.display = 'none';
      cancelAnimationFrame(visualizerRAF);
      visualizerRAF = null;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  function startVisualizer() {
    const canvas = document.getElementById('visualizer-canvas');
    if (!canvas || canvas.style.display === 'none') return;
    const ctx = canvas.getContext('2d');
    const analyser = Player.getAnalyserNode();

    const bufferLength = analyser ? analyser.frequencyBinCount : 64;
    const dataArray = new Uint8Array(bufferLength);
    let step = 0;

    function draw() {
      if (canvas.style.display === 'none') return;
      visualizerRAF = requestAnimationFrame(draw);
      step += 0.05;

      if (analyser) {
        analyser.getByteFrequencyData(dataArray);
      }

      let hasData = false;
      for (let i = 0; i < dataArray.length; i++) {
        if (dataArray[i] > 0) { hasData = true; break; }
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const radius = 90;

      for (let i = 0; i < bufferLength; i++) {
        let val = hasData ? dataArray[i] : (Math.sin(step + i * 0.2) * 50 + 60 + Math.random() * 20);
        const barHeight = (val / 255) * 80;
        const angle = (i / bufferLength) * Math.PI * 2;

        const x1 = cx + Math.cos(angle) * radius;
        const y1 = cy + Math.sin(angle) * radius;
        const x2 = cx + Math.cos(angle) * (radius + barHeight);
        const y2 = cy + Math.sin(angle) * (radius + barHeight);

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = `hsl(${((i / bufferLength) * 360 + step * 50) % 360}, 100%, 65%)`;
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.stroke();
      }
    }
    draw();
  }

  // ---- Service Worker ----

  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js')
        .then(reg => {
          console.log('[SW] Registered:', reg.scope);

          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New update available and installed
                UI.showToast('New update available! Click here to refresh.', 'success', {
                  duration: 10000,
                  onClick: () => window.location.reload()
                });
              }
            });
          });
        })
        .catch(err => console.warn('[SW] Registration failed:', err));

      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        // Optionally auto-reload, but we prompt the user instead to not interrupt playback
        // window.location.reload(); 
      });
    }
  }

  // ---- Routing (Hash Router) & Deep Links ----

  async function handleHashChange() {
    const hash = window.location.hash.slice(1);
    const mainView = document.getElementById('home-view'); // Fallback container
    
    if (!hash || hash === 'home') {
      document.querySelectorAll('.view-section').forEach(v => v.style.display = 'none');
      document.getElementById('home-view').style.display = 'block';
      updateActiveNav();
      return;
    }

    if (hash === 'library' || hash === 'search') {
      document.querySelectorAll('.view-section').forEach(v => v.style.display = 'none');
      const view = document.getElementById(`${hash}-view`);
      if (view) view.style.display = 'block';
      updateActiveNav();
      
      // If it's library, we can render Stats and Playlists
      if (hash === 'library') {
        renderLibraryView();
      }
      return;
    }

    // Deep Links handling: #album/id, #artist/id, #playlist/id
    const parts = hash.split('/');
    if (parts.length >= 2) {
      const type = parts[0];
      const id = parts[1];

      UI.showLoading(mainView);
      try {
        if (type === 'album') {
          const details = await API.getAlbumDetails(id);
          renderEntityPage('Album', details);
        } else if (type === 'artist') {
          const details = await API.getArtistDetails(id);
          renderEntityPage('Artist', details);
        } else if (type === 'playlist') {
          let details = null;
          const localPlaylists = Storage.getPlaylists() || [];
          const localPl = localPlaylists.find(p => p.id === id);
          if (localPl) {
            details = { ...localPl, songs: localPl.songs || [] };
          } else {
            details = await API.getPlaylistDetails(id);
          }
          renderEntityPage('Playlist', details);
        } else if (type === 'song') {
          const details = await API.getSongDetails(id);
          if (details && details.length > 0) {
            Player.playSong(details[0]);
            UI.showToast(`Playing deep linked song: ${details[0].name}`);
            window.location.hash = ''; // Clear hash to prevent reload loops
          }
        }
      } catch (e) {
        UI.showToast(`Failed to load ${type}`, 'error');
        console.error(e);
      } finally {
        UI.hideLoading();
      }
    }
  }

  function renderEntityPage(type, data) {
    const mainView = document.getElementById('home-view');
    if (!data) return;
    
    const isArtist = type === 'Artist';
    const songs = isArtist ? data.topSongs : data.songs;
    const img = isArtist ? (data.image && data.image[2]?.link) : (data.image && data.image[2]?.link);
    const title = data.name || data.title;
    
    mainView.innerHTML = `
      <div class="entity-header">
        <img src="${img || ''}" class="entity-img" ${isArtist ? 'style="border-radius:50%"' : ''}>
        <div class="entity-info">
          <p>${type}</p>
          <h1>${title}</h1>
        </div>
      </div>
      <div class="shelf">
        <div class="shelf-header">
          <h2 class="shelf-title">Tracks</h2>
        </div>
        <div class="song-list" id="entity-songs"></div>
      </div>
    `;

    const container = document.getElementById('entity-songs');
    if (songs && songs.length > 0) {
      UI.renderShelf(songs, container, 'song-list');
      bindSongCardEvents(container, songs);
    }
    
    document.querySelectorAll('.view-section').forEach(v => v.style.display = 'none');
    mainView.style.display = 'block';
  }

  function renderLibraryView() {
    const view = document.getElementById('library-view');
    if (!view) return;

    const stats = Storage.getStats();
    const history = Storage.getListeningHistory();

    const safeTopArtists = stats.topArtists || {};
    const safeTopGenres = stats.topGenres || {};
    const topArtists = Object.entries(safeTopArtists).sort((a,b)=>b[1]-a[1]).slice(0,3).map(a=>a[0]);
    const topGenres = Object.entries(safeTopGenres).sort((a,b)=>b[1]-a[1]).slice(0,3).map(a=>a[0]);

    view.innerHTML = `
      <h1 style="margin-bottom:24px; font-size:32px; font-weight:800;">Your Library</h1>
      
      <div class="shelf" style="margin-bottom: 40px;">
        <div class="shelf-header">
          <h2 class="shelf-title">Playlists</h2>
        </div>
        <div class="song-grid" id="library-playlists" style="grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));"></div>
      </div>

      <div class="shelf">
        <div class="shelf-header">
          <h2 class="shelf-title">Favorites</h2>
          <a href="#" class="shelf-more">See All</a>
        </div>
        <div class="song-grid" id="library-favorites"></div>
      </div>

      <h2 style="margin-top:40px; margin-bottom:20px;">Listening History</h2>
      <div class="history-list" id="library-history"></div>
    `;

    // Render Playlists
    const playlistsContainer = document.getElementById('library-playlists');
    const playlists = Storage.getPlaylists() || [];
    if (playlists.length > 0) {
      playlistsContainer.innerHTML = playlists.map(p => {
        const d = document.createElement('div');
        const card = UI.renderPlaylistCard({ id: p.id, title: p.name, subtitle: `${p.songs ? p.songs.length : 0} songs`, image: false }, 0);
        return card.outerHTML;
      }).join('');
      // Attach click events
      playlistsContainer.querySelectorAll('.playlist-card').forEach(card => {
        card.addEventListener('click', () => {
          window.location.hash = `playlist/${card.dataset.playlistId}`;
        });
      });
    } else {
      playlistsContainer.innerHTML = '<p style="color:var(--text-sec)">No playlists yet.</p>';
    }

    // Render Favorites
    const favs = Storage.getFavorites().slice(0, 5);
    const favContainer = document.getElementById('library-favorites');
    if (favs.length > 0) {
      UI.renderShelf(favs, favContainer, 'song-list');
      bindSongCardEvents(favContainer, favs);
    } else {
      favContainer.innerHTML = '<p style="color:var(--text-sec)">No favorites yet. Start liking some songs!</p>';
    }

    // Render History
    const historyContainer = document.getElementById('library-history');
    if (history.length > 0) {
      historyContainer.innerHTML = history.slice(0, 20).map(item => `
        <div class="history-item" data-song-id="${item.song.id}">
          <div class="history-time">${new Date(item.timestamp).toLocaleDateString()}</div>
          <img src="${item.song.image}" style="width:40px; height:40px; border-radius:4px; object-fit:cover;">
          <div style="flex:1;">
            <div style="font-size:14px; font-weight:600;">${item.song.name}</div>
            <div style="font-size:12px; color:var(--text-sec);">${item.song.artists}</div>
          </div>
          <button class="btn-icon" data-action="play"><svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg></button>
        </div>
      `).join('');

      historyContainer.querySelectorAll('[data-action="play"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const songId = btn.closest('.history-item').dataset.songId;
          const song = history.find(h => h.song.id === songId)?.song;
          if (song) {
            Player.setQueue([song], 0);
            Player.playSong(song);
          }
        });
      });
    } else {
      historyContainer.innerHTML = '<p style="color:var(--text-sec)">No listening history available.</p>';
    }
  }


  // Build a shareable deep-link URL for a song
  function buildSongShareUrl(song) {
    if (!song || !song.id) return window.location.origin + window.location.pathname;
    return `${window.location.origin}${window.location.pathname}#song/${encodeURIComponent(song.id)}`;
  }

  // ---- Deep Links: open #song/<id>, #album/<id>, #artist/<name>, #playlist/<id> on load ----
  async function handleDeepLinkOnLoad() {
    const hash = decodeURIComponent(window.location.hash.slice(1));
    if (!hash || !hash.includes('/')) return;
    const slash = hash.indexOf('/');
    const type = hash.slice(0, slash);
    const id = hash.slice(slash + 1);
    if (!id) return;
    try {
      if (type === 'song') {
        const details = await API.getSongDetails(id);
        if (details && details.length > 0) {
          const s = API.normalizeSong(details[0]);
          Player.setQueue([s], 0);
          await Player.playSong(s);
          UI.showToast(`Playing shared song: ${s.name}`, 'success');
        }
      } else if (type === 'album') {
        openAlbumPage(id, '', '');
      } else if (type === 'artist') {
        openArtistPage(id, '');
      } else if (type === 'playlist') {
        openPlaylistPage(id, '', '');
      }
    } catch (e) {
      console.warn('[DeepLink] Failed to open shared link:', e.message);
    }
  }

  // ---- Backup & Restore (Settings > Your Data) ----
  function exportAllData() {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('mf_')) data[k] = localStorage.getItem(k);
    }
    const payload = { app: 'MusicFlow', version: 1, exportedAt: new Date().toISOString(), data };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `musicflow-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    UI.showToast('Backup downloaded \u2014 keep it safe!', 'success');
  }

  function importAllData(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const payload = JSON.parse(reader.result);
        if (!payload || payload.app !== 'MusicFlow' || !payload.data || typeof payload.data !== 'object') {
          UI.showToast('Not a valid MusicFlow backup file', 'error');
          return;
        }
        let restored = 0;
        Object.entries(payload.data).forEach(([k, v]) => {
          if (k.startsWith('mf_') && typeof v === 'string') {
            localStorage.setItem(k, v);
            restored++;
          }
        });
        UI.showToast(`Restored ${restored} data entries \u2014 reloading\u2026`, 'success');
        setTimeout(() => window.location.reload(), 1200);
      } catch (e) {
        UI.showToast('Could not read backup: ' + e.message, 'error');
      }
    };
    reader.readAsText(file);
  }

  function bindBackupRestore() {
    document.getElementById('btn-export-data')?.addEventListener('click', exportAllData);
    const fileInput = document.getElementById('input-import-data');
    document.getElementById('btn-import-data')?.addEventListener('click', () => fileInput?.click());
    fileInput?.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) importAllData(file);
      e.target.value = '';
    });
  }

  // ---- Keyboard Shortcuts Help Overlay ----
  function showShortcutsHelp() {
    let overlay = document.getElementById('shortcuts-help-overlay');
    if (overlay) { overlay.style.display = 'flex'; return; }
    overlay = document.createElement('div');
    overlay.id = 'shortcuts-help-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.55);backdrop-filter:blur(14px);display:flex;align-items:center;justify-content:center;';
    const rows = [
      ['Space', 'Play / Pause'],
      ['\u2190 / \u2192', 'Previous / Next track'],
      ['\u2191 / \u2193', 'Volume up / down'],
      ['F', 'Toggle favorite for current song'],
      ['M', 'Mute / Unmute'],
      ['S', 'Toggle shuffle'],
      ['R', 'Cycle repeat mode'],
      ['Q', 'Expand player'],
      ['/', 'Focus search'],
      ['Ctrl + K', 'Command palette'],
      ['?', 'This help'],
      ['Esc', 'Close overlays']
    ];
    overlay.innerHTML = `
      <div style="background:var(--bg-elevated, #16162a);border:1px solid var(--border, rgba(255,255,255,0.1));border-radius:20px;padding:28px 32px;max-width:420px;width:92vw;max-height:80vh;overflow:auto;box-shadow:0 24px 80px rgba(0,0,0,0.6);">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;">
          <h2 style="margin:0;font-size:20px;font-weight:800;">\u2328\uFE0F Keyboard Shortcuts</h2>
          <button id="shortcuts-help-close" class="btn-icon" aria-label="Close" style="font-size:20px;">\u2715</button>
        </div>
        ${rows.map(([k, d]) => `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
            <span style="color:var(--text-secondary,#aaa);font-size:14px;">${d}</span>
            <kbd style="background:var(--bg-input, rgba(255,255,255,0.1));border:1px solid var(--border-hover, rgba(255,255,255,0.15));border-radius:6px;padding:3px 10px;font-size:12.5px;font-weight:700;color:var(--text-primary,#fff);">${k}</kbd>
          </div>`).join('')}
      </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.style.display = 'none'; });
    overlay.querySelector('#shortcuts-help-close').addEventListener('click', () => overlay.style.display = 'none');
  }


  // ---- Voice Search (Web Speech API) ----
  function initVoiceSearch() {
    const micBtn = document.getElementById('btn-voice-search');
    if (!micBtn) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return; // unsupported browser: keep hidden
    micBtn.style.display = 'flex';
    let recognizing = false;
    let rec = null;
    micBtn.addEventListener('click', () => {
      if (recognizing) { try { rec.stop(); } catch (_) {} return; }
      rec = new SR();
      rec.lang = 'en-IN';
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      recognizing = true;
      micBtn.classList.add('listening');
      UI.showToast('\u{1F399}\uFE0F Listening\u2026 say a song or artist', 'info');
      rec.onresult = (ev) => {
        const text = ev.results[0][0].transcript;
        const input = document.getElementById('search-input');
        if (input && text) {
          input.value = text;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          Storage.addSearchHistory(text);
          performSearch(text);
        }
      };
      rec.onerror = (ev) => {
        if (ev.error === 'not-allowed') UI.showToast('Microphone access denied', 'error');
        else if (ev.error !== 'aborted') UI.showToast('Didn\u2019t catch that \u2014 try again', 'info');
      };
      rec.onend = () => { recognizing = false; micBtn.classList.remove('listening'); };
      try { rec.start(); } catch (_) { recognizing = false; micBtn.classList.remove('listening'); }
    });
  }

  // ---- Up Next preview strip in the full player ----
  function updateUpNextStrip() {
    const strip = document.getElementById('up-next-strip');
    if (!strip) return;
    const q = Player.getQueue();
    const idx = Player.getCurrentIndex();
    let nxt = null;
    if (q.length > 1 && idx >= 0) {
      if (idx + 1 < q.length) nxt = q[idx + 1];
      else if (Player.getRepeatMode && Player.getRepeatMode() === 'all') nxt = q[0];
    }
    if (!nxt) { strip.style.display = 'none'; return; }
    strip.style.display = 'flex';
    const img = document.getElementById('up-next-img');
    const title = document.getElementById('up-next-title');
    if (img) img.src = (typeof nxt.image === 'string' && nxt.image) ? nxt.image : 'assets/logo.jpg';
    if (title) title.textContent = `${nxt.name}${nxt.artists ? ' \u2022 ' + nxt.artists : ''}`;
  }

  function bindUpNextStrip() {
    const strip = document.getElementById('up-next-strip');
    if (!strip) return;
    strip.addEventListener('click', (e) => {
      e.stopPropagation();
      if (typeof Haptics !== 'undefined') Haptics.light();
      Player.next();
    });
  }

  // ---- Double-tap artwork to favorite (with heart burst) ----
  function bindArtworkDoubleTap() {
    const artworkWrap = document.querySelector('.full-player__artwork');
    if (!artworkWrap) return;

    function burstHeart(x, y) {
      const rect = artworkWrap.getBoundingClientRect();
      const heart = document.createElement('span');
      heart.className = 'heart-burst';
      heart.textContent = '\u2764\uFE0F';
      heart.style.left = `${x - rect.left}px`;
      heart.style.top = `${y - rect.top}px`;
      artworkWrap.appendChild(heart);
      setTimeout(() => heart.remove(), 950);
    }

    function favoriteCurrent(x, y) {
      const cur = Player.getCurrentTrack();
      if (!cur) return;
      const nowFav = Storage.toggleFavorite(cur);
      if (nowFav) {
        burstHeart(x, y);
        if (typeof Haptics !== 'undefined') Haptics.medium && Haptics.medium();
        UI.showToast(`\u2764\uFE0F Added \u201C${cur.name}\u201D to favorites`, 'success');
      } else {
        UI.showToast(`Removed \u201C${cur.name}\u201D from favorites`, 'info', {
          action: { label: 'Undo', onClick: () => { Storage.addFavorite(cur); UI.showToast('Restored to favorites', 'success'); } }
        });
      }
      if (UI.updateFavoriteButton) UI.updateFavoriteButton(nowFav);
    }

    // Desktop double-click
    artworkWrap.addEventListener('dblclick', (e) => {
      e.preventDefault();
      favoriteCurrent(e.clientX, e.clientY);
    });

    // Mobile double-tap
    let lastTap = 0;
    artworkWrap.addEventListener('touchend', (e) => {
      const now = Date.now();
      if (now - lastTap < 320 && e.changedTouches && e.changedTouches[0]) {
        e.preventDefault();
        const t = e.changedTouches[0];
        favoriteCurrent(t.clientX, t.clientY);
        lastTap = 0;
      } else {
        lastTap = now;
      }
    }, { passive: false });
  }

  // ---- Sleep timer quick menu in the full player ----
  function updateSleepBadge() {
    const badge = document.getElementById('sleep-timer-badge');
    const btn = document.getElementById('btn-full-sleep');
    if (!badge || !btn) return;
    const val = Player.getSleepTimerMinutes();
    if (val === 'song') {
      badge.textContent = '\u266A';
      badge.style.display = 'inline-block';
      btn.classList.add('active');
    } else if (val > 0) {
      badge.textContent = `${val}m`;
      badge.style.display = 'inline-block';
      btn.classList.add('active');
    } else {
      badge.style.display = 'none';
      btn.classList.remove('active');
    }
  }

  function bindSleepTimerButton() {
    const btn = document.getElementById('btn-full-sleep');
    if (!btn) return;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const rect = btn.getBoundingClientRect();
      const setTimer = (v, label) => () => {
        Player.setSleepTimer(v);
        updateSleepBadge();
        const sel = document.getElementById('select-timer');
        if (sel) sel.value = String(v);
        UI.showToast(v === 0 ? 'Sleep timer off' : `\u{1F319} Sleep timer: ${label}`, 'info');
      };
      UI.showContextMenu(rect.left - 140, rect.top - 10, [
        { label: 'Off', icon: '\u274C', onClick: setTimer(0, 'Off') },
        { label: '15 minutes', icon: '\u{1F319}', onClick: setTimer(15, '15 min') },
        { label: '30 minutes', icon: '\u{1F319}', onClick: setTimer(30, '30 min') },
        { label: '45 minutes', icon: '\u{1F319}', onClick: setTimer(45, '45 min') },
        { label: '60 minutes', icon: '\u{1F319}', onClick: setTimer(60, '60 min') },
        { label: 'End of current song', icon: '\u266A', onClick: setTimer('song', 'end of song') }
      ]);
    });
  }


  // ---- Mini player: swipe left/right to change track ----
  function bindMiniPlayerSwipe() {
    const mini = document.getElementById('mini-player');
    if (!mini) return;
    let sx = 0, sy = 0, t0 = 0;
    mini.addEventListener('touchstart', (e) => {
      const t = e.touches[0];
      sx = t.clientX; sy = t.clientY; t0 = Date.now();
    }, { passive: true });
    mini.addEventListener('touchend', (e) => {
      const t = e.changedTouches[0];
      const dx = t.clientX - sx;
      const dy = t.clientY - sy;
      if (Math.abs(dx) > 64 && Math.abs(dx) > Math.abs(dy) * 2 && Date.now() - t0 < 600) {
        if (typeof Haptics !== 'undefined') Haptics.light();
        if (dx < 0) { Player.next(); UI.showToast('\u23ED Next'); }
        else { Player.previous(); UI.showToast('\u23EE Previous'); }
      }
    }, { passive: true });
  }

  // ---- Keyboard Shortcuts & Command Palette ----

  function bindKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Ignore if typing in an input
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        toggleCommandPalette();
        return;
      }

      switch (e.key) {
        case ' ': // Space
          e.preventDefault();
          Player.togglePlayPause();
          break;
        case 'ArrowRight':
          e.preventDefault();
          Player.next();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          Player.previous();
          break;
        case 'm':
        case 'M':
          const isMuted = Player.mute();
          UI.showToast(isMuted ? 'Muted' : 'Unmuted');
          break;
        case 's':
        case 'S':
          const isShuffled = Player.toggleShuffle();
          UI.updateShuffleButton(isShuffled);
          UI.showToast(isShuffled ? 'Shuffle On' : 'Shuffle Off');
          break;
        case 'r':
        case 'R':
          const mode = Player.cycleRepeat();
          UI.updateRepeatButton(mode);
          UI.showToast(`Repeat: ${mode}`);
          break;
        case 'q':
        case 'Q':
          // Custom shortcut to show queue
          document.getElementById('player-container').classList.add('player-expanded');
          break;
        case 'f':
        case 'F': {
          const cur = Player.getCurrentTrack();
          if (cur) {
            const nowFav = Storage.toggleFavorite(cur);
            if (nowFav) {
              UI.showToast(`\u2764\uFE0F Added \u201C${cur.name}\u201D to favorites`);
            } else {
              UI.showToast(`Removed \u201C${cur.name}\u201D from favorites`, 'info', {
                action: { label: 'Undo', onClick: () => { Storage.addFavorite(cur); UI.showToast('Restored to favorites', 'success'); } }
              });
            }
            if (UI.updateFavoriteButton) UI.updateFavoriteButton(nowFav);
          }
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          const vUp = Math.min(1, (Player.getVolume() || 0) + 0.05);
          Player.setVolume(vUp);
          UI.showToast(`Volume: ${Math.round(vUp * 100)}%`);
          break;
        }
        case 'ArrowDown': {
          e.preventDefault();
          const vDn = Math.max(0, (Player.getVolume() || 0) - 0.05);
          Player.setVolume(vDn);
          UI.showToast(`Volume: ${Math.round(vDn * 100)}%`);
          break;
        }
        case '?':
          e.preventDefault();
          showShortcutsHelp();
          break;
        case 'Escape': {
          const help = document.getElementById('shortcuts-help-overlay');
          if (help && help.style.display !== 'none') help.style.display = 'none';
          break;
        }
      }
    });

    // Command Palette Logic
    const overlay = document.getElementById('cmd-palette');
    const input = document.getElementById('cmd-input');
    const results = document.getElementById('cmd-results');

    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) toggleCommandPalette();
      });
      
      input.addEventListener('input', () => {
        const query = input.value.toLowerCase();
        const commands = [
          { label: 'Play / Pause', action: () => Player.togglePlayPause() },
          { label: 'Next Track', action: () => Player.next() },
          { label: 'Previous Track', action: () => Player.previous() },
          { label: 'Toggle Shuffle', action: () => UI.updateShuffleButton(Player.toggleShuffle()) },
          { label: 'Cycle Repeat Mode', action: () => UI.updateRepeatButton(Player.cycleRepeat()) },
          { label: 'Favorite Current Song', action: () => { const c = Player.getCurrentTrack(); if (c) { Storage.toggleFavorite(c); UI.showToast('Favorite toggled'); } } },
          { label: 'Go Home', action: () => navigateToPage('page-home') },
          { label: 'Open Library', action: () => navigateToPage('page-favorites') },
          { label: 'Open Queue', action: () => navigateToPage('page-queue') },
          { label: 'Open Podcasts', action: () => navigateToPage('page-podcasts') },
          { label: 'Open Samples', action: () => navigateToPage('page-samples') },
          { label: 'Open Music Recap', action: () => navigateToPage('page-recap') },
          { label: 'Open Tune Radio', action: () => navigateToPage('tuner') },
          { label: 'Open Settings', action: () => document.getElementById('settings-modal').style.display = 'flex' },
          { label: 'Sleep Timer: 15 min', action: () => { Player.setSleepTimer(15); UI.showToast('Sleep timer set: 15 min'); } },
          { label: 'Sleep Timer: 30 min', action: () => { Player.setSleepTimer(30); UI.showToast('Sleep timer set: 30 min'); } },
          { label: 'Sleep Timer: Off', action: () => { Player.setSleepTimer(0); UI.showToast('Sleep timer off'); } },
          { label: 'Export Backup (Download Data)', action: () => exportAllData() },
          { label: 'Keyboard Shortcuts Help', action: () => showShortcutsHelp() },
          { label: 'Dark Mode', action: () => { Storage.updateSettings({theme:'dark'}); applyTheme(); } },
          { label: 'Light Mode', action: () => { Storage.updateSettings({theme:'light'}); applyTheme(); } }
        ];
        
        const filtered = commands.filter(c => c.label.toLowerCase().includes(query));
        results.innerHTML = filtered.map((c, i) => `
          <div class="cmd-item" data-index="${i}">
            <span class="cmd-item-icon">⚡</span>
            <span>${c.label}</span>
          </div>
        `).join('');
        
        results.querySelectorAll('.cmd-item').forEach(item => {
          item.addEventListener('click', () => {
            const idx = item.dataset.index;
            filtered[idx].action();
            toggleCommandPalette();
          });
        });
      });
    }
  }

  function toggleCommandPalette() {
    const overlay = document.getElementById('cmd-palette');
    if (!overlay) return;
    const input = document.getElementById('cmd-input');
    
    if (overlay.style.display === 'none') {
      overlay.style.display = 'flex';
      input.value = '';
      input.dispatchEvent(new Event('input'));
      input.focus();
    } else {
      overlay.style.display = 'none';
    }
  }

  // ---- Themes & Dynamic Artwork ----

  function applyTheme() {
    const settings = Storage.getSettings();
    const theme = settings.theme || 'system';
    const color = settings.color || 'green';

    document.body.classList.remove('theme-light', 'theme-dark');
    if (theme === 'light' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: light)').matches)) {
      document.body.classList.add('theme-light');
    }

    document.body.classList.remove('color-purple', 'color-blue', 'color-green', 'color-red', 'color-pink', 'color-orange');
    document.body.classList.add(`color-${color}`);

    if (settings.glassEffect) {
      document.body.classList.add('clear-glass');
    } else {
      document.body.classList.remove('clear-glass');
    }
  }

  function updateDynamicArtwork(url) {
    if (!url) return;
    const bg = document.getElementById('dynamic-bg');
    if (bg) {
      // Smooth fade transition via CSS
      bg.style.opacity = 0;
      setTimeout(() => {
        bg.style.backgroundImage = `url('${url.replace('150x150', '500x500')}')`;
        bg.style.opacity = 1;
      }, 500); // Wait for fade out
    }
  }

  // HD artwork and dynamic background now handled in the main trackchange handler above

  // ---- Init ----
  document.addEventListener('DOMContentLoaded', () => {
    applyTheme(); // Apply theme before init
    init();

    const settings = Storage.getSettings();

    bindKeyboardShortcuts();
    document.addEventListener('click', (e) => {
      const artistLink = e.target.closest('[data-action="open-artist"]');
      if (artistLink) {
        const card = artistLink.closest('.artist-card') || artistLink.closest('.song-card') || artistLink;
        const name = artistLink.dataset.name || card.querySelector('.song-card__name')?.textContent?.trim() || '';
        const img = artistLink.dataset.image || card.querySelector('.song-card__img')?.src || '';
        if (name && name !== 'undefined') {
          openArtistPage(name, img);
        }
      }
      const albumCard = e.target.closest('.album-card');
      if (albumCard) {
        const albumId = albumCard.dataset.albumId;
        const nameEl = albumCard.querySelector('.song-card__name');
        const imgEl = albumCard.querySelector('.song-card__img');
        if (albumId) openAlbumPage(albumId, nameEl?.textContent || 'Unknown', imgEl?.src || '');
      }
      const playlistCard = e.target.closest('.playlist-card');
      if (playlistCard) {
        const playlistId = playlistCard.dataset.playlistId;
        const nameEl = playlistCard.querySelector('.song-card__name');
        const imgEl = playlistCard.querySelector('.song-card__img');
        if (playlistId) openPlaylistPage(playlistId, nameEl?.textContent || 'Unknown', imgEl?.src || '');
      }
    });
  });

  async function startRadioForSong(song) {
    if (!song) return;
    const norm = (window.API && API.normalizeSong) ? API.normalizeSong(song) : { ...song };
    
    // 1. Activate Radio Mode State across Player and App
    document.body.classList.add('is-radio-active');
    
    // In-Player Banner Animation
    const banner = document.getElementById('player-radio-banner');
    const subEl = document.getElementById('player-radio-banner-subtitle');
    if (banner) {
      const artist = norm.artists ? norm.artists.split(',')[0].trim() : (norm.artist || 'Artist');
      if (subEl) subEl.textContent = `Streaming infinite flow based on "${norm.name}"`;
      banner.classList.add('active');
      setTimeout(() => banner.classList.remove('active'), 3500);
    }

    // 2. Immediately start playback on user gesture if not already playing
    const currentTrack = Player.getCurrentTrack();
    if (!currentTrack || currentTrack.id !== norm.id) {
      Player.setQueue([norm], 0);
      await Player.playSong(norm);
    }
    
    if (window.UI && UI.showRadioStartedAnimation) {
      UI.showRadioStartedAnimation(norm);
    } else {
      UI.showToast(`Starting Radio for "${norm.name}"...`, 'info');
    }
    
    // 3. Fetch and seed matching radio queue in background
    try {
      const primaryArtist = norm.artists ? norm.artists.split(',')[0].trim() : '';
      const secondaryArtist = norm.artists && norm.artists.includes(',') ? norm.artists.split(',')[1].trim() : '';
      
      const queryPromises = [
        API.searchSongs(primaryArtist, 15),
        API.searchSongs(norm.album || norm.name, 15)
      ];

      if (secondaryArtist) {
        queryPromises.push(API.searchSongs(secondaryArtist, 15));
      }
      if (norm.language) {
        queryPromises.push(API.searchSongs(`trending ${norm.language}`, 15));
      } else {
        queryPromises.push(API.searchSongs('trending hits', 15));
      }

      const resultsArray = await Promise.allSettled(queryPromises);
      let combinedPool = [];
      resultsArray.forEach(res => {
        if (res.status === 'fulfilled' && Array.isArray(res.value)) {
          combinedPool.push(...res.value);
        }
      });

      const prefs = Storage.getSettings().languages || [];
      const seen = new Set([norm.id]);
      let uniqueSongs = [norm];

      combinedPool.forEach(s => {
        if (s && s.id && !seen.has(s.id)) {
          seen.add(s.id);
          const sNorm = API.normalizeSong(s);
          const lang = (sNorm.language || '').toLowerCase();
          if (prefs.length === 0 || lang === '' || lang === 'unknown' || prefs.includes(lang)) {
            uniqueSongs.push(sNorm);
          }
        }
      });

      if (uniqueSongs.length > 1) {
        const tail = uniqueSongs.slice(1).sort(() => Math.random() - 0.5);
        const radioQueue = [norm, ...tail];
        Player.setQueue(radioQueue, 0);
        UI.showToast(`Radio loaded for ${norm.name}`, 'success');
      }
    } catch (err) {
      console.warn('Background radio expansion error:', err);
    }
  }

  // ---- Global Functions for new pages ----
  let _activeArtistState = null;

  window.openArtistPage = openArtistPage;
  window.openAlbumPage = openAlbumPage;

  async function openArtistPage(rawName, rawImage, pushHistory = true) {
    let name = rawName;
    if (typeof name === 'object' && name !== null) {
      name = name.name || name.title || name.artist || '';
    }
    if (!name || typeof name !== 'string' || name === 'undefined' || name === '[object Object]' || name.trim() === '') return;
    const cleanName = name.trim();

    let image = rawImage;
    if (typeof image === 'object' && image !== null) {
      image = (window.API && API.getImageUrl) ? API.getImageUrl(image) : (image.url || image.link || image.image || '');
    }
    if (typeof image !== 'string' || image === '[object Object]') {
      image = '';
    }

    UI.showPage('page-artist');
    document.getElementById('btn-minimize-player')?.click();
    
    if (pushHistory) {
      history.pushState({ type: 'artist', name: cleanName, image }, '', '#artist/' + encodeURIComponent(cleanName));
    }

    const imgEl = document.getElementById('artist-page-img');
    const nameEl = document.getElementById('artist-page-name');
    const subtitleEl = document.getElementById('artist-page-subtitle');
    const countEl = document.getElementById('artist-songs-count');
    const loadMoreContainer = document.getElementById('artist-load-more-container');
    const loadMoreBtn = document.getElementById('btn-artist-load-more');
    const albumsSection = document.getElementById('artist-albums-section');
    const albumsContainer = document.getElementById('artist-albums-container');
    const songsContainer = document.getElementById('artist-songs-container');

    if (nameEl) nameEl.textContent = cleanName;
    if (subtitleEl) subtitleEl.textContent = 'Verified Artist • Fetching catalog...';
    if (countEl) countEl.textContent = 'Loading songs...';
    if (loadMoreContainer) loadMoreContainer.style.display = 'none';
    if (albumsSection) albumsSection.style.display = 'none';
    if (imgEl) {
      imgEl.src = image || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%231a1a2e" width="100" height="100"/><text x="50" y="55" text-anchor="middle" fill="%236c5ce7" font-size="40">👤</text></svg>';
    }
    if (songsContainer) {
      songsContainer.innerHTML = '<div class="loading-shelf"></div>';
    }

    const artistState = {
      name: cleanName,
      artistId: null,
      songs: [],
      seenIds: new Set(),
      currentPage: 1,
      hasMore: true,
      isLoadingMore: false
    };
    _activeArtistState = artistState;

    try {
      // 1. Discover Artist profile & ID for deep catalog access
      let artistMeta = null;
      try {
        const searchRes = await API.searchArtists(cleanName, 5);
        if (searchRes && searchRes.length > 0) {
          const match = searchRes.find(a => (a.name || a.title || '').toLowerCase() === cleanName.toLowerCase()) || searchRes[0];
          if (match) {
            artistMeta = match;
            artistState.artistId = match.id;
            if (imgEl && match.image) {
              const hiRes = API.getHighResImage ? API.getHighResImage(API.getImageUrl(match) || match.image) : match.image;
              imgEl.src = hiRes;
            }
          }
        }
      } catch (_) {}

      // 2. Fetch initial batch of songs
      let initialSongs = [];
      let artistAlbums = [];

      if (artistState.artistId) {
        try {
          const details = await API.getArtistDetails(artistState.artistId, 50, 20);
          if (details) {
            if (details.topSongs && details.topSongs.length > 0) {
              initialSongs.push(...details.topSongs);
            } else if (details.songs && details.songs.length > 0) {
              initialSongs.push(...details.songs);
            }
            if (details.topAlbums && details.topAlbums.length > 0) {
              artistAlbums = details.topAlbums;
            } else if (details.albums && details.albums.length > 0) {
              artistAlbums = details.albums;
            }
            if (details.fanCount) {
              if (subtitleEl) subtitleEl.textContent = `${Number(details.fanCount).toLocaleString()} Listeners • Full Catalog`;
            }
          }
        } catch (_) {}
      }

      // Also search songs by query to supplement and find all related tracks
      try {
        const searchSongsRes = await API.searchSongs(cleanName, 50, 1);
        if (searchSongsRes && searchSongsRes.length > 0) {
          initialSongs.push(...searchSongsRes);
        }
      } catch (_) {}

      if (_activeArtistState !== artistState) return;

      // Deduplicate & normalize songs
      initialSongs.forEach(s => {
        const norm = API.normalizeSong(s);
        if (norm && norm.id && !artistState.seenIds.has(norm.id)) {
          artistState.seenIds.add(norm.id);
          artistState.songs.push(norm);
        }
      });

      if (subtitleEl && !subtitleEl.textContent.includes('Listeners')) {
        subtitleEl.textContent = `Artist • Discography`;
      }

      // Render songs
      if (songsContainer) {
        songsContainer.innerHTML = '';
        if (artistState.songs.length > 0) {
          renderArtistSongList(artistState);
          if (countEl) countEl.textContent = `${artistState.songs.length} Songs Loaded`;

          // Show load more button
          if (loadMoreContainer) {
            loadMoreContainer.style.display = 'block';
          }
        } else {
          songsContainer.innerHTML = '<div class="empty-state">No songs found for this artist</div>';
          if (countEl) countEl.textContent = '0 Songs';
        }
      }

      // Render albums section if available
      if (artistAlbums.length > 0 && albumsContainer && albumsSection) {
        try {
          albumsContainer.innerHTML = '';
          albumsSection.style.display = 'block';
          artistAlbums.forEach(album => {
            try {
              const card = document.createElement('div');
              card.className = 'song-card album-card';
              const imgUrl = API.getHighResImage(API.getImageUrl(album) || album.image || album.coverImage || '');
              card.innerHTML = `
                <div class="song-card__img-wrap skeleton" style="border-radius: var(--radius-md);">
                  <img class="song-card__img" src="${imgUrl}" alt="${album.name || album.title || 'Album'}" loading="lazy" style="border-radius: var(--radius-md);" onload="this.classList.add('loaded'); this.parentElement.classList.remove('skeleton');" onerror="this.onerror=null; this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%231a1a2e%22 width=%22100%22 height=%22100%22/><text x=%2250%22 y=%2255%22 text-anchor=%22middle%22 fill=%22%236c5ce7%22 font-size=%2240%22>🎵</text></svg>';">
                </div>
                <div class="song-card__info">
                  <div class="song-card__name">${album.name || album.title || 'Album'}</div>
                  <div class="song-card__artist">${album.year || 'Album'}</div>
                </div>
              `;
              card.onclick = () => {
                if (album.id) openAlbumPage(album.id, album.name || album.title || 'Album', imgUrl);
              };
              albumsContainer.appendChild(card);
            } catch (errAlbum) {
              console.warn('Error rendering album card:', errAlbum);
            }
          });
        } catch (e) {
          console.warn('Error displaying albums section:', e);
        }
      }

      // Bind Play All & Artist Radio
      const playAllBtn = document.getElementById('btn-artist-play-all');
      if (playAllBtn) {
        playAllBtn.onclick = async () => {
          if (artistState.songs.length === 0) return;
          Player.setQueue(artistState.songs, 0);
          await Player.playSong(artistState.songs[0]);
          UI.showToast(`Playing all songs by ${cleanName}`, 'success');
        };
      }

      const mixBtn = document.getElementById('btn-artist-mix');
      if (mixBtn) {
        mixBtn.onclick = async () => {
          if (artistState.songs.length === 0) return;
          const shuffled = [...artistState.songs].sort(() => Math.random() - 0.5);
          Player.setQueue(shuffled, 0);
          await Player.playSong(shuffled[0]);
          UI.showToast(`Starting ${cleanName} Radio Mix`, 'success');
        };
      }

      // Bind Load More button
      if (loadMoreBtn) {
        loadMoreBtn.onclick = () => loadMoreArtistSongs(artistState);
      }

    } catch (err) {
      console.error('[App] openArtistPage error:', err);
      if (songsContainer && (!artistState || artistState.songs.length === 0)) {
        songsContainer.innerHTML = '<div class="empty-state">Error loading artist</div>';
      }
    }
  }

  function renderArtistSongList(artistState) {
    const container = document.getElementById('artist-songs-container');
    if (!container || !artistState || !artistState.songs) return;
    container.innerHTML = '';

    artistState.songs.forEach((song, i) => {
      try {
        const el = UI.renderSongListItem(song, i, { showRemove: false });
        if (el) container.appendChild(el);
      } catch (errItem) {
        console.warn('Error rendering song list item:', errItem);
      }
    });

    container.querySelectorAll('[data-action="play"]').forEach(el => {
      el.addEventListener('click', async () => {
        const index = parseInt(el.dataset.index, 10);
        if (!isNaN(index) && artistState.songs[index]) {
          Player.setQueue(artistState.songs, index);
          await Player.playSong(artistState.songs[index]);
        }
      });
    });
  }

  async function loadMoreArtistSongs(artistState) {
    if (!artistState || artistState.isLoadingMore || !artistState.hasMore) return;
    artistState.isLoadingMore = true;

    const loadMoreBtn = document.getElementById('btn-artist-load-more');
    const countEl = document.getElementById('artist-songs-count');
    if (loadMoreBtn) {
      loadMoreBtn.textContent = 'Loading more songs...';
      loadMoreBtn.disabled = true;
    }

    artistState.currentPage += 1;
    let newSongs = [];

    try {
      // Try paginated artist songs if ID exists
      if (artistState.artistId && API.getArtistSongs) {
        try {
          const res = await API.getArtistSongs(artistState.artistId, artistState.currentPage - 1);
          if (res && res.length > 0) {
            newSongs.push(...res);
          }
        } catch (_) {}
      }

      // Also search next page of songs
      try {
        const searchRes = await API.searchSongs(artistState.name, 50, artistState.currentPage);
        if (searchRes && searchRes.length > 0) {
          newSongs.push(...searchRes);
        }
      } catch (_) {}

      let addedCount = 0;
      newSongs.forEach(s => {
        const norm = API.normalizeSong(s);
        if (norm && norm.id && !artistState.seenIds.has(norm.id)) {
          artistState.seenIds.add(norm.id);
          artistState.songs.push(norm);
          addedCount++;
        }
      });

      if (addedCount > 0) {
        renderArtistSongList(artistState);
        if (countEl) countEl.textContent = `${artistState.songs.length} Songs Loaded`;
      } else {
        artistState.hasMore = false;
        if (loadMoreBtn) {
          loadMoreBtn.textContent = `All ${artistState.songs.length} Songs Loaded`;
          loadMoreBtn.disabled = true;
          loadMoreBtn.style.opacity = '0.6';
        }
      }
    } catch (e) {
      console.warn('[App] loadMoreArtistSongs failed', e);
    } finally {
      artistState.isLoadingMore = false;
      if (artistState.hasMore && loadMoreBtn) {
        loadMoreBtn.textContent = 'Load More Songs';
        loadMoreBtn.disabled = false;
      }
    }
  }

  async function openAlbumPage(rawId, rawName, rawImage, pushHistory = true) {
    let id = rawId;
    if (typeof id === 'object' && id !== null) {
      id = id.id || id.albumId || '';
    }
    if (!id || typeof id !== 'string' || id === 'undefined' || id === '[object Object]') return;

    let name = rawName;
    if (typeof name === 'object' && name !== null) {
      name = name.name || name.title || 'Album';
    }
    const cleanName = (typeof name === 'string' && name !== '[object Object]') ? name : 'Album';

    let image = rawImage;
    if (typeof image === 'object' && image !== null) {
      image = (window.API && API.getImageUrl) ? API.getImageUrl(image) : (image.url || image.link || image.image || '');
    }
    if (typeof image !== 'string' || image === '[object Object]') {
      image = '';
    }

    UI.showPage('page-album');
    document.getElementById('btn-minimize-player')?.click();
    
    if (pushHistory) {
      history.pushState({ type: 'album', id, name: cleanName, image }, '', '#album/' + encodeURIComponent(id));
    }

    const imgEl = document.getElementById('album-page-img');
    const nameEl = document.getElementById('album-page-name');
    if (nameEl) nameEl.textContent = cleanName;
    if (imgEl) {
      imgEl.src = image || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%231a1a2e" width="100" height="100"/><text x="50" y="55" text-anchor="middle" fill="%236c5ce7" font-size="40">🎵</text></svg>';
    }

    const container = document.getElementById('album-songs-container');
    if (container) {
      container.innerHTML = '<div class="loading-shelf"></div>';
    }

    try {
      const albumData = await API.getAlbumDetails(id);
      if (container && albumData && albumData.songs && albumData.songs.length > 0) {
        container.innerHTML = '';
        const normSongs = albumData.songs.map(API.normalizeSong);
        normSongs.forEach((song, i) => {
          const el = UI.renderSongListItem(song, i, { showRemove: false });
          container.appendChild(el);
        });
        
        container.querySelectorAll('[data-action="play"]').forEach(el => {
          el.addEventListener('click', async () => {
            const index = parseInt(el.dataset.index, 10);
            Player.setQueue(normSongs, index);
            await Player.playSong(normSongs[index]);
          });
        });

        const playBtn = document.getElementById('btn-album-play');
        if (playBtn) {
          playBtn.onclick = async () => {
            Player.setQueue(normSongs, 0);
            await Player.playSong(normSongs[0]);
          };
        }
      } else if (container) {
        container.innerHTML = '<div class="empty-state">No tracks found</div>';
      }
    } catch (err) {
      if (container) container.innerHTML = '<div class="empty-state">Error loading album</div>';
    }
  }

  async function openPlaylistPage(rawId, rawName, rawImage, pushHistory = true) {
    let id = rawId;
    if (typeof id === 'object' && id !== null) {
      id = id.id || id.playlistId || '';
    }
    if (!id || typeof id !== 'string' || id === 'undefined' || id === '[object Object]') return;

    let name = rawName;
    if (typeof name === 'object' && name !== null) {
      name = name.name || name.title || 'Playlist';
    }
    const cleanName = (typeof name === 'string' && name !== '[object Object]') ? name : 'Playlist';

    let image = rawImage;
    if (typeof image === 'object' && image !== null) {
      image = (window.API && API.getImageUrl) ? API.getImageUrl(image) : (image.url || image.link || image.image || '');
    }
    if (typeof image !== 'string' || image === '[object Object]') {
      image = '';
    }

    UI.showPage('page-playlist');
    document.getElementById('btn-minimize-player')?.click();
    
    if (pushHistory) {
      history.pushState({ type: 'playlist', id, name: cleanName, image }, '', '#playlist/' + encodeURIComponent(id));
    }

    const imgEl = document.getElementById('playlist-page-img');
    const nameEl = document.getElementById('playlist-page-name');
    if (nameEl) nameEl.textContent = cleanName;

    // Local playlists get Rename / Delete management actions
    const oldManage = document.getElementById('playlist-manage-actions');
    if (oldManage) oldManage.remove();
    const isLocalPlaylist = (Storage.getPlaylists() || []).some(p => p.id === id);
    if (isLocalPlaylist) {
      const playBtnEl = document.getElementById('btn-playlist-play');
      if (playBtnEl && playBtnEl.parentElement) {
        const manage = document.createElement('div');
        manage.id = 'playlist-manage-actions';
        manage.style.cssText = 'display:flex; gap:10px; margin-top:10px;';
        manage.innerHTML = `
          <button class="btn-text" id="btn-playlist-rename" style="display:flex; align-items:center; gap:5px;">\u270F\uFE0F Rename</button>
          <button class="btn-text" id="btn-playlist-delete" style="display:flex; align-items:center; gap:5px; color:var(--error);">\u{1F5D1}\uFE0F Delete</button>
        `;
        playBtnEl.parentElement.appendChild(manage);

        manage.querySelector('#btn-playlist-rename').addEventListener('click', () => {
          const current = (Storage.getPlaylists() || []).find(p => p.id === id);
          const newName = prompt('Rename playlist:', current ? current.name : cleanName);
          if (newName && newName.trim() && Storage.renamePlaylist(id, newName)) {
            if (nameEl) nameEl.textContent = newName.trim();
            if (UI.renderSidebarPlaylists) UI.renderSidebarPlaylists();
            UI.showToast(`Renamed to \u201C${newName.trim()}\u201D`, 'success');
          }
        });

        manage.querySelector('#btn-playlist-delete').addEventListener('click', () => {
          const current = (Storage.getPlaylists() || []).find(p => p.id === id);
          if (!confirm(`Delete playlist \u201C${current ? current.name : cleanName}\u201D? This cannot be undone.`)) return;
          Storage.deletePlaylist(id);
          if (UI.renderSidebarPlaylists) UI.renderSidebarPlaylists();
          UI.showToast('Playlist deleted', 'info');
          navigateToPage('page-favorites');
        });
      }
    }
    if (imgEl) {
      imgEl.src = image || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%231a1a2e" width="100" height="100"/><text x="50" y="55" text-anchor="middle" fill="%236c5ce7" font-size="40">🎵</text></svg>';
    }

    const container = document.getElementById('playlist-songs-container');
    if (container) {
      container.innerHTML = '<div class="loading-shelf"></div>';
    }

    try {
      const playlistData = await API.getPlaylistDetails(id);
      if (container && playlistData && playlistData.songs && playlistData.songs.length > 0) {
        container.innerHTML = '';
        const normSongs = playlistData.songs.map(API.normalizeSong);
        normSongs.forEach((song, i) => {
          const el = UI.renderSongListItem(song, i, { showRemove: false });
          container.appendChild(el);
        });
        
        container.querySelectorAll('[data-action="play"]').forEach(el => {
          el.addEventListener('click', async () => {
            const index = parseInt(el.dataset.index, 10);
            Player.setQueue(normSongs, index);
            await Player.playSong(normSongs[index]);
          });
        });

        const playBtn = document.getElementById('btn-playlist-play');
        if (playBtn) {
          playBtn.onclick = async () => {
            Player.setQueue(normSongs, 0);
            await Player.playSong(normSongs[0]);
          };

          // Share playlist button
          let shareBtn = document.getElementById('btn-playlist-share');
          if (!shareBtn) {
            shareBtn = document.createElement('button');
            shareBtn.id = 'btn-playlist-share';
            shareBtn.className = 'btn-secondary';
            shareBtn.style.marginTop = 'var(--space-md)';
            shareBtn.style.marginLeft = '8px';
            shareBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px;"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>Share`;
            playBtn.parentNode?.appendChild(shareBtn);
          }
          shareBtn.onclick = () => {
            if (typeof PlaylistSharing !== 'undefined') {
              PlaylistSharing.sharePlaylist({ name, songs: normSongs });
            }
          };
        }
      } else if (container) {
        container.innerHTML = '<div class="empty-state">No tracks found</div>';
      }
    } catch (err) {
      if (container) container.innerHTML = '<div class="empty-state">Error loading playlist</div>';
    }
  }

  // ---- Global Browser Navigation (Popstate & Hash Routing) ----
  window.addEventListener('popstate', (e) => {
    const pc = document.getElementById('player-container');
    const isPlayerExpanded = pc && pc.classList.contains('player-expanded');

    if (isPlayerExpanded) {
      window.minimizePlayer(true);
      return;
    }

    if (e.state && typeof e.state === 'object') {
      if (e.state.type === 'player') {
        window.expandPlayer(false);
      } else if (e.state.type === 'artist') {
        openArtistPage(e.state.name, e.state.image, false);
      } else if (e.state.type === 'album') {
        openAlbumPage(e.state.id, e.state.name, e.state.image, false);
      } else if (e.state.type === 'playlist') {
        openPlaylistPage(e.state.id, e.state.name, e.state.image, false);
      } else if (e.state.type === 'public_playlist') {
        if (typeof PlaylistSharing !== 'undefined') PlaylistSharing.openPublicPlaylist(e.state.id);
      } else if (e.state.type === 'hub') {
        if (typeof LanguageHubs !== 'undefined' && LanguageHubs.openLanguageHub) {
          LanguageHubs.openLanguageHub(e.state.langId, false);
        }
      } else if (e.state.type === 'mix') {
        if (typeof MixSuite !== 'undefined' && MixSuite.openMixPage) {
          MixSuite.openMixPage(e.state.id);
        }
      } else if (e.state.type === 'page') {
        navigateToPage(e.state.route || e.state.pageId, false);
      }
      return;
    }

    // Check URL hash if state is null
    if (window.location.hash) {
      const hash = window.location.hash;
      if (hash.startsWith('#artist/')) {
        const rawArtist = hash.replace('#artist/', '');
        const artistName = decodeURIComponent(rawArtist).trim();
        if (artistName && artistName !== '[object Object]' && artistName !== 'undefined') {
          openArtistPage(artistName, '', false);
          return;
        }
      } else if (hash.startsWith('#album/')) {
        const rawAlbum = hash.replace('#album/', '');
        const albumId = decodeURIComponent(rawAlbum).trim();
        if (albumId && albumId !== '[object Object]' && albumId !== 'undefined') {
          openAlbumPage(albumId, 'Album', '', false);
          return;
        }
      } else if (hash.startsWith('#playlist/')) {
        const rawPlaylist = hash.replace('#playlist/', '');
        const playlistId = decodeURIComponent(rawPlaylist).trim();
        if (playlistId && playlistId !== '[object Object]' && playlistId !== 'undefined') {
          openPlaylistPage(playlistId, 'Playlist', '', false);
          return;
        }
      } else if (hash.startsWith('#hub/')) {
        const langId = hash.replace('#hub/', '');
        if (typeof LanguageHubs !== 'undefined') LanguageHubs.openLanguageHub(langId, false);
        return;
      } else if (hash.startsWith('#mix/')) {
        const mixId = hash.replace('#mix/', '');
        if (typeof MixSuite !== 'undefined') MixSuite.openMixPage(mixId);
        return;
      } else if (hash.startsWith('#share-pl=')) {
        const encoded = hash.replace('#share-pl=', '');
        if (typeof PlaylistSharing !== 'undefined') {
          const data = PlaylistSharing.parseSharedPlaylist(encoded);
          if (data) PlaylistSharing.openSharedPlaylist(data);
        }
        return;
      } else if (hash.startsWith('#public-playlist/')) {
        const id = hash.replace('#public-playlist/', '');
        if (typeof PlaylistSharing !== 'undefined') PlaylistSharing.openPublicPlaylist(id);
        return;
      } else if (hash.startsWith('#podcast/')) {
        const showId = hash.replace('#podcast/', '');
        if (typeof Podcasts !== 'undefined') Podcasts.openPodcastShow(showId);
        return;
      } else if (hash === '#podcasts') {
        navigateToPage('page-podcasts', false);
        return;
      } else if (hash === '#samples') {
        navigateToPage('page-samples', false);
        return;
      } else if (hash === '#library' || hash === '#favorites') {
        navigateToPage('page-favorites', false);
        return;
      } else if (hash === '#home') {
        navigateToPage('page-home', false);
        return;
      } else if (hash === '#search') {
        navigateToPage('page-search', false);
        return;
      } else if (hash === '#queue') {
        navigateToPage('page-queue', false);
        return;
      } else if (hash === '#recap') {
        navigateToPage('page-recap', false);
        return;
      }
    }

    // Default fallback to Home
    navigateToPage('page-home', false);
  });

  // ---- Global Mobile Swipe Gestures (Edge Swipe Back & Full Player Swipe Down) ----
  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartTime = 0;

  document.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchStartTime = Date.now();
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    if (!touchStartX || e.changedTouches.length !== 1) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX;
    const deltaY = e.changedTouches[0].clientY - touchStartY;
    const deltaTime = Date.now() - touchStartTime;

    const pc = document.getElementById('player-container');
    const isPlayerExpanded = pc && pc.classList.contains('player-expanded');

    // 1. Swipe down on full player to minimize
    if (isPlayerExpanded) {
      if (deltaY > 60 && Math.abs(deltaY) > Math.abs(deltaX) * 1.2 && deltaTime < 600) {
        window.minimizePlayer(false);
      }
      touchStartX = 0;
      touchStartY = 0;
      return;
    }

    // 2. Swipe left/right on mini player for next/previous
    const miniEl = document.getElementById('mini-player');
    if (miniEl && e.target.closest('#mini-player') && !isPlayerExpanded) {
      if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY) * 1.3 && deltaTime < 600) {
        if (deltaX < 0) {
          Player.next();
        } else {
          Player.previous();
        }
        touchStartX = 0;
        touchStartY = 0;
        return;
      }
    }

    // 3. Edge Swipe Right to navigate back (started near left screen edge <= 65px)
    if (touchStartX <= 65 && deltaX > 70 && Math.abs(deltaX) > Math.abs(deltaY) * 1.3 && deltaTime < 500) {
      const activePage = document.querySelector('.page.active');
      const isInnerPage = activePage && (
        activePage.id === 'page-artist' || 
        activePage.id === 'page-album' || 
        activePage.id === 'page-playlist' ||
        activePage.id === 'page-favorites' ||
        activePage.id === 'page-queue' ||
        activePage.id === 'page-settings' ||
        activePage.id === 'page-language-hub' ||
        activePage.id === 'page-podcast-show'
      );

      if (isInnerPage || window.history.length > 1) {
        window.history.back();
      }
    }

    touchStartX = 0;
    touchStartY = 0;
  }, { passive: true });

  async function checkNewReleasesFromFollowed(followed) {
    try {
      const toCheck = followed.sort(() => 0.5 - Math.random()).slice(0, 2);
      let newReleases = [];
      const seenIds = Storage.get('mf_seen_releases') || {};
      
      for (const artist of toCheck) {
        const albums = await API.getArtistAlbums(artist.id, 1);
        if (albums && albums.results && albums.results.length > 0) {
          const latest = albums.results[0];
          if (!seenIds[latest.id]) {
            latest.artistContext = artist.name;
            newReleases.push(latest);
            seenIds[latest.id] = true;
          }
        }
      }

      if (newReleases.length > 0) {
        Storage.set('mf_seen_releases', seenIds);
        renderNewReleasesShelf(newReleases);
      }
    } catch (e) {
      console.warn('Failed to fetch new releases', e);
    }
  }

  function renderNewReleasesShelf(releases) {
    const homeContainer = document.getElementById('home-content');
    if (!homeContainer) return;
    
    let section = document.getElementById('shelf-followed-releases');
    let grid;
    if (!section) {
      section = document.createElement('section');
      section.className = 'shelf-section';
      section.id = 'shelf-followed-releases';
      
      const title = document.createElement('h2');
      title.className = 'shelf-title';
      title.textContent = 'New From Artists You Follow';
      section.appendChild(title);
      
      grid = document.createElement('div');
      grid.className = 'shelf-container';
      grid.id = 'container-followed-releases';
      section.appendChild(grid);
      
      homeContainer.insertBefore(section, homeContainer.children[1] || homeContainer.firstChild);
    } else {
      grid = document.getElementById('container-followed-releases');
    }

    releases.forEach(release => {
      const item = document.createElement('div');
      item.className = 'song-card';
      item.innerHTML = `
        <div class="song-card__img-wrap skeleton">
          <img class="song-card__img" src="${release.image || ''}" alt="${release.title}" loading="lazy" onload="this.classList.add('loaded'); this.parentElement.classList.remove('skeleton');" onerror="this.onerror=null; this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%231a1a2e%22 width=%22100%22 height=%22100%22/><text x=%2250%22 y=%2255%22 text-anchor=%22middle%22 fill=%22%236c5ce7%22 font-size=%2240%22>🎵</text></svg>';">
        </div>
        <div class="song-card__info">
          <div class="song-card__title">${release.title || 'Unknown'}</div>
          <div class="song-card__subtitle">New Album • ${release.artistContext}</div>
        </div>
      `;
      item.onclick = () => {
        if (window.openAlbumPage) window.openAlbumPage(release.id, release.title, release.image);
      };
      grid.appendChild(item);
    });
  }

  window.checkNewReleasesFromFollowed = checkNewReleasesFromFollowed;

  const exportedApp = {
    navigateToPage,
    syncVisualizer,
    exportAllData,
    showShortcutsHelp,
    performSearch,
    loadHomePage,
    bindSongCardEvents,
    startRadioForSong,
    openAlbumPage,
    openArtistPage,
    openPlaylistPage
  };

  window.App = exportedApp;
  return exportedApp;
})();
