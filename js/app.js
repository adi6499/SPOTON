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
        if (!document.getElementById('full-player')) return;
        if (typeof Haptics !== 'undefined' && Haptics.medium) Haptics.medium();
        playerContainer.classList.remove('player-closing');
        playerContainer.classList.remove('player-minimized');
        playerContainer.classList.add('player-expanded');
        document.body.classList.add('is-player-expanded');
        if (pushHistory) {
          history.pushState({ type: 'player' }, '', '#player');
        }
        // Defer heavy Swiper/Deck recalculations to after the slide begins so first paint is 120fps smooth
        requestAnimationFrame(() => {
          if (typeof UI !== 'undefined' && UI.refreshPlayerCardsDeck) {
            UI.refreshPlayerCardsDeck();
          }
        });
      };

      window.minimizePlayer = function(fromPopstate = false) {
        if (!playerContainer.classList.contains('player-expanded')) return;
        if (typeof Haptics !== 'undefined' && Haptics.light) Haptics.light();
        playerContainer.classList.add('player-closing');
        setTimeout(() => {
          playerContainer.classList.remove('player-closing');
          playerContainer.classList.remove('player-expanded');
          playerContainer.classList.add('player-minimized');
          document.body.classList.remove('is-player-expanded');
        }, 240);
        if (!fromPopstate && window.location.hash === '#player') {
          history.back();
        }
      };

      if (miniPlayer) {
        miniPlayer.addEventListener('click', (e) => {
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
        minimizeBtn.onclick = (e) => {
          e.stopPropagation();
          e.preventDefault();
          if (typeof Haptics !== 'undefined' && Haptics.light) Haptics.light();
          window.minimizePlayer(false);
        };
      }

      const lyricsBtn = document.getElementById('btn-full-lyrics');
      const previewLyricsBlock = document.getElementById('player-lyrics-preview');

      if (lyricsBtn) {
        lyricsBtn.onclick = (e) => {
          e.stopPropagation();
          e.preventDefault();
          const panel = document.getElementById('fullscreen-lyrics-overlay');
          if (panel && panel.style.display === 'flex') {
            closeLyricsOverlay();
          } else {
            openLyricsOverlay();
          }
        };
      }

      if (previewLyricsBlock) {
        previewLyricsBlock.onclick = (e) => {
          e.stopPropagation();
          e.preventDefault();
          openLyricsOverlay();
        };
      }

      document.querySelectorAll('#btn-close-fullscreen-lyrics, .btn-dismiss-lyrics, .lyrics-footer-close-btn').forEach(btn => {
        btn.onclick = (e) => {
          e.stopPropagation();
          e.preventDefault();
          closeLyricsOverlay();
        };
      });

      // Queue buttons
      document.querySelectorAll('#btn-full-queue, .btn-queue-toggle').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          e.preventDefault();
          if (typeof Haptics !== 'undefined') Haptics.light();
          navigateToPage('page-queue');
        });
      });
      applyPerformanceMode();
      startAudioReactivePulse();
      initVoiceSearch();
      bindMiniPlayerSwipe();
      bindUpNextStrip();
      bindArtworkDoubleTap();
      bindSleepTimerButton();
      bindPlayerActionRail();
      bindFollowButton();
      bindKaraokeButton();
      bindBackupRestore();
      bindMindfulControls();

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

  // ---- Adaptive Performance Mode (low-end device support) ----

  function detectLowEndDevice() {
    try {
      const cores = navigator.hardwareConcurrency || 8;
      // deviceMemory is Chrome/Android only - Safari never reports it, so an
      // unknown value must NOT be treated as low memory.
      const mem = typeof navigator.deviceMemory === 'number' ? navigator.deviceMemory : null;
      const saveData = !!(navigator.connection && navigator.connection.saveData);
      // iPhones report just 4-6 cores yet are fast; a core count alone must not
      // trigger Lite mode (that made every iPhone run the reduced UI).
      // prefers-reduced-motion is handled by its own media query, so it no
      // longer forces Lite either.
      return cores <= 2 || (mem !== null && mem <= 3) || saveData;
    } catch (_) {
      return false;
    }
  }

  function applyPerformanceMode() {
    const mode = Storage.getSettings().perfMode || 'auto';
    const lite = mode === 'lite' || (mode === 'auto' && detectLowEndDevice());
    document.body.classList.toggle('perf-lite', lite);
    return lite;
  }

  // ---- Real-Time Audio-Reactive Beat & Micro-Beat Scaling ----
  const audioFreqData = new Uint8Array(64);
  let audioPulseFrame = null;
  let prevBassEnergy = 0;
  let beatDecay = 0;

  // Cached refs: these ids never change; per-frame getElementById/querySelector
  // was a measurable cost at 60-165fps
  const pulseEls = {};
  function getPulseEls() {
    if (!pulseEls.pc) {
      pulseEls.pc = document.getElementById('player-container');
      pulseEls.fullImg = document.getElementById('full-player-img');
      pulseEls.miniImg = document.getElementById('mini-player-img');
      pulseEls.aura = document.querySelector('.artwork-glow-aura');
    }
    return pulseEls;
  }
  let lastShadowWrite = 0;
  let lastShadowPower = -1;
  let pulseIdleCleared = false;

  function startAudioReactivePulse() {
    if (audioPulseFrame) {
      cancelAnimationFrame(audioPulseFrame);
      audioPulseFrame = null;
    }
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
      const t = Player.getCurrentTrack();
      document.title = t ? `\u23F8 ${t.name} \u00B7 ${t.artists || 'MusicFlow'}` : 'MusicFlow \u2014 Ultimate Premium';
      UI.updatePlayPauseButton(false);
    });

    const fmtChipTime = (s) => {
      if (!isFinite(s) || s < 0) return '0:00';
      const m = Math.floor(s / 60);
      const sec = String(Math.floor(s % 60)).padStart(2, '0');
      return `${m}:${sec}`;
    };

    Player.on('timeupdate', (data) => {
      UI.updateProgress(data);
      const chipText = document.getElementById('player-meta-time-text');
      if (chipText && data) {
        chipText.textContent = `${fmtChipTime(data.currentTime)} / ${fmtChipTime(data.duration)}`;
      }
      if (data && data.currentTime !== undefined) {
        updateSyncedLyrics(data.currentTime);
        updateKaraokeHighlight(data.currentTime);
      }
    });

    Player.on('trackchange', (track) => {
      UI.updatePlayerBar(track);
      updateUpNextStrip();
      updateSleepBadge();
      updateRailFavState();
      // Now playing in the browser tab title
      document.title = track ? `\u25B6 ${track.name} \u00B7 ${track.artists || 'MusicFlow'}` : 'MusicFlow \u2014 Ultimate Premium';
      
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

      // Auto-load lyrics for new track immediately
      if (track) {
        loadLyrics(track, true);
      }

      // Sync 3D Queue Cards Deck to active playing song
      if (typeof UI !== 'undefined' && UI.updatePlayerCardsDeck && typeof Player !== 'undefined') {
        const q = Player.getQueue ? Player.getQueue() : [];
        const idx = Player.getQueueIndex ? Player.getQueueIndex() : 0;
        UI.updatePlayerCardsDeck(q, idx);
      }

      // Sync desktop right sidebar Now Playing mini card
      const dTitle = document.getElementById('desktop-np-title');
      const dArtist = document.getElementById('desktop-np-artist');
      const dImg = document.getElementById('desktop-np-art-img');
      if (dTitle) dTitle.textContent = track ? track.name : 'Not Playing';
      if (dArtist) dArtist.textContent = track ? (track.artists || 'MusicFlow') : '-';
      if (dImg && track && track.image) {
        let rawImg = '';
        if (typeof track.image === 'string') rawImg = track.image;
        else if (Array.isArray(track.image)) rawImg = track.image[track.image.length - 1]?.url || track.image[0]?.url || '';
        else if (typeof track.image === 'object') rawImg = track.image.url || track.image.link || '';
        if (rawImg) dImg.src = rawImg;
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

    Player.on('queueupdate', (queue, curIdx) => {
      updateUpNextStrip();
      if (typeof UI !== 'undefined' && UI.updatePlayerCardsDeck && typeof Player !== 'undefined') {
        const q = Array.isArray(queue) ? queue : Player.getQueue();
        const idx = typeof curIdx === 'number' ? curIdx : (Player.getQueueIndex ? Player.getQueueIndex() : 0);
        UI.updatePlayerCardsDeck(q, idx);
      }
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

  function openLyricsOverlay() {
    const panel = document.getElementById('fullscreen-lyrics-overlay');
    if (!panel) return;
    panel.classList.add('active');
    panel.style.setProperty('display', 'flex', 'important');
    const track = (typeof Player !== 'undefined' && Player.getCurrentTrack) ? Player.getCurrentTrack() : null;
    if (track) {
      const subTitle = document.getElementById('lyrics-track-title-sub');
      if (subTitle) subTitle.textContent = `${track.name || track.title || ''} · ${track.artists || track.artist || ''}`;
      loadLyrics(track, true);
    }
    if (typeof Haptics !== 'undefined' && Haptics.light) Haptics.light();
  }

  function closeLyricsOverlay() {
    const panel = document.getElementById('fullscreen-lyrics-overlay');
    if (!panel) return;
    panel.classList.remove('active', 'show', 'is-open');
    panel.style.setProperty('display', 'none', 'important');
    if (typeof Haptics !== 'undefined' && Haptics.light) Haptics.light();
  }

  window.openLyricsOverlay = openLyricsOverlay;
  window.closeLyricsOverlay = closeLyricsOverlay;

  document.addEventListener('click', (e) => {
    if (e.target && (
      e.target.closest('#btn-close-fullscreen-lyrics') || 
      e.target.closest('.btn-dismiss-lyrics') || 
      e.target.closest('.lyrics-footer-close-btn') || 
      e.target.closest('.lyrics-header-close-pill')
    )) {
      e.stopPropagation();
      closeLyricsOverlay();
    }
  }, true);

  // Allow closing lyrics with Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const panel = document.getElementById('fullscreen-lyrics-overlay');
      if (panel && panel.style.display === 'flex') {
        closeLyricsOverlay();
      }
    }
  });

  async function loadLyrics(song, force = false) {
    if (!song) return;
    const songId = song.id || `${song.name || song.title || ''}_${song.artists || song.artist || ''}`;
    if (!force && currentLyricsSongId === songId && activeLyricsData) return;

    currentLyricsSongId = songId;
    activeLyricsData = null;
    parsedLyricsLines = [];

    const subTitle = document.getElementById('lyrics-track-title-sub');
    if (subTitle) {
      subTitle.textContent = `${song.name || song.title || ''} · ${song.artists || song.artist || ''}`;
    }

    // 1. Instantly reset and clear in-player synced lyrics preview
    const previewEl = document.getElementById('player-lyrics-preview');
    if (previewEl) {
      previewEl.style.display = 'flex';
      previewEl.classList.add('active');
    }
    const elPrev = document.getElementById('lyric-preview-prev');
    const elCurr = document.getElementById('lyric-preview-curr');
    const elNext = document.getElementById('lyric-preview-next');
    if (elPrev) elPrev.textContent = '';
    if (elCurr) elCurr.textContent = '🎵 Tap for live synchronized lyrics';
    if (elNext) elNext.textContent = '';

    // 2. Reset full screen overlay if exists
    const lyricsContent = document.getElementById('fullscreen-lyrics-content') || document.querySelector('.lyrics-content');
    if (lyricsContent) {
      lyricsContent.innerHTML = `<div style="opacity:0.6; padding: 40px 0; text-align:center;">Searching for lyrics for "${song.name || song.title || 'Track'}"...</div>`;
    }

    try {
      const songName = song.name || song.title || '';
      const songArtist = song.artists || song.artist || '';
      const data = await API.getLyrics(songName, songArtist, song.duration);
      if (currentLyricsSongId !== songId) return; // Song changed while fetching

      if (!data || (!data.synced && !data.plain)) {
        if (lyricsContent) {
          lyricsContent.innerHTML = `
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding: 48px 20px; text-align:center; color:#fff; gap:16px;">
              <div style="width:60px; height:60px; border-radius:18px; background:rgba(250,45,72,0.15); border:1px solid rgba(250,45,72,0.3); display:flex; align-items:center; justify-content:center;">
                <span class="material-symbols-outlined" style="font-size:30px; color:#FA2D48;">music_note</span>
              </div>
              <div style="font-size:18px; font-weight:800; letter-spacing:-0.2px;">${song.name || song.title || 'This Track'}</div>
              <div style="font-size:13px; color:rgba(255,255,255,0.6); max-width:280px; line-height:1.5;">Instrumental or no synchronized lyrics found for this track.</div>
              <button onclick="if(window.App && App.toggleKaraokeMode) App.toggleKaraokeMode()" style="margin-top:8px; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.18); color:#fff; border-radius:9999px; padding:8px 18px; font-size:12.5px; font-weight:700; cursor:pointer;">
                🎤 Sing Along Karaoke Mode
              </button>
            </div>
          `;
        }
        if (elCurr) elCurr.textContent = '🎤 Sing Along Karaoke · Tap to open';
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
          if (lyricsContent) {
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
          }
          // Immediately update preview if current player time is available
          if (typeof Player !== 'undefined' && Player.getCurrentTime) {
            updateSyncedLyrics(Player.getCurrentTime());
          }
          return;
        }
      }

      // Plain lyrics fallback
      if (lyricsContent && data.plain) {
        lyricsContent.innerHTML = data.plain.split('\n').map(line => {
          const cleaned = sanitizeLyricsText(line);
          return `<div class="lyrics-line">${cleaned || '&nbsp;'}</div>`;
        }).join('');
      }
      if (previewEl) previewEl.style.display = 'none';
    } catch (e) {
      if (currentLyricsSongId === songId) {
        if (lyricsContent) {
          lyricsContent.innerHTML = '<div style="opacity:0.6; padding: 40px 0; text-align:center;">Lyrics unavailable.</div>';
        }
        if (previewEl) previewEl.style.display = 'none';
      }
    }
  }

  function updateSyncedLyrics(currentTime) {
    const previewEl = document.getElementById('player-lyrics-preview');
    if (!parsedLyricsLines || parsedLyricsLines.length === 0) {
      if (previewEl) previewEl.style.display = 'none';
      return;
    }

    let activeIndex = -1;
    for (let i = 0; i < parsedLyricsLines.length; i++) {
      if (currentTime >= parsedLyricsLines[i].time) {
        activeIndex = i;
      } else {
        break;
      }
    }

    if (previewEl) {
      previewEl.style.display = 'flex';
      previewEl.classList.add('active');

      const elPrev = document.getElementById('lyric-preview-prev');
      const elCurr = document.getElementById('lyric-preview-curr');
      const elNext = document.getElementById('lyric-preview-next');

      if (activeIndex >= 0) {
        const prevLine = activeIndex > 0 ? (parsedLyricsLines[activeIndex - 1].text || '') : '';
        const currLine = (parsedLyricsLines[activeIndex]?.text || '').trim();
        const nextLine = (activeIndex + 1 < parsedLyricsLines.length) ? (parsedLyricsLines[activeIndex + 1].text || '') : '';

        if (currLine) {
          if (elPrev) elPrev.textContent = prevLine;
          if (elCurr) elCurr.textContent = currLine;
          if (elNext) elNext.textContent = nextLine;
        }
      } else {
        if (elPrev) elPrev.textContent = '';
        if (elCurr) elCurr.textContent = '🎵 Instrumental Intro · Tap for full lyrics';
        if (elNext) elNext.textContent = (parsedLyricsLines[0]?.text || '');
      }
    }

    // 2. Update Dedicated Full Lyrics Panel if opened
    const lyricsPanel = document.getElementById('fullscreen-lyrics-overlay');
    if (lyricsPanel && (lyricsPanel.classList.contains('active') || lyricsPanel.style.display === 'flex')) {
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
    'page-recap': 'page-recap',
    'history': 'page-history',
    'page-history': 'page-history',
    'mindfulness': 'page-mindfulness',
    'page-mindfulness': 'page-mindfulness'
  };

  const CANONICAL_HASH = {
    'page-home': 'home',
    'page-favorites': 'library',
    'page-mindfulness': 'mindfulness',
    'page-podcasts': 'podcasts',
    'page-samples': 'samples',
    'page-search': 'search',
    'page-queue': 'queue',
    'page-recap': 'recap',
    'page-history': 'history'
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
    } else if (pageId === 'page-history') {
      renderHistoryPage();
    } else if (pageId === 'page-recap') {
      Recap.renderRecap(document.getElementById('recap-container'));
    } else if (pageId === 'page-search') {
      if (typeof SearchEngine !== 'undefined' && SearchEngine.initSearchDiscoveryPage) {
        SearchEngine.initSearchDiscoveryPage();
      }
      setTimeout(() => {
        const pInp = document.getElementById('search-page-input');
        if (pInp && document.activeElement !== pInp && !pInp.value) {
          pInp.focus();
        }
      }, 120);
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
          const action = selectedItem.dataset.action;

          if (typeof Haptics !== 'undefined' && Haptics.light) {
            Haptics.light();
          }

          if (action === 'open-settings' || route === 'settings') {
            const modal = document.getElementById('settings-modal');
            if (modal) modal.style.display = 'flex';
            setTimeout(syncWithActiveNav, 100);
            return;
          }

          if (route === 'tuner' || page === 'page-tuner') {
            if (typeof RadioTuner !== 'undefined' && RadioTuner.openTunerModal) {
              RadioTuner.openTunerModal();
            }
            setTimeout(syncWithActiveNav, 100);
            return;
          }

          const targetRoute = route || (page ? page.replace('page-', '') : 'home');
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

    setupDesktopRightSidebar();
  }

  function setupDesktopRightSidebar() {
    const dSearch = document.getElementById('desktop-right-search-input');
    if (dSearch && !dSearch.dataset.bound) {
      dSearch.dataset.bound = 'true';
      let debounceTimer = null;
      dSearch.addEventListener('input', () => {
        const q = dSearch.value.trim();
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          if (q && typeof SearchEngine !== 'undefined') {
            SearchEngine.executeSearch(q);
          }
        }, 300);
      });
      dSearch.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          clearTimeout(debounceTimer);
          const q = dSearch.value.trim();
          if (q && typeof SearchEngine !== 'undefined') {
            SearchEngine.executeSearch(q);
          }
        }
      });
    }
  }

  function bindFollowButton() {
    document.querySelectorAll('#btn-player-follow, .btn-artist-follow, #btn-artist-follow-action').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        toggleFollowArtist();
      };
    });
  }

  function bindKaraokeButton() {
    const btn = document.getElementById('btn-full-karaoke');
    if (btn) {
      btn.onclick = (e) => {
        e.stopPropagation();
        toggleKaraokeMode();
      };
    }
  }

  function bindBackupRestore() {
    const exportBtn = document.getElementById('btn-export-backup');
    if (exportBtn) {
      exportBtn.onclick = () => exportAllData();
    }
  }

  function bindMindfulControls() {
    document.querySelectorAll('.btn-mindful-play').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        if (typeof Ambience !== 'undefined' && Ambience.openAmbienceModal) {
          Ambience.openAmbienceModal();
        }
      };
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
        const radialBar = document.getElementById('radial-progress-bar');
        if (radialBar) {
          const circumference = 791.68;
          const offset = circumference - (percent / 100) * circumference;
          radialBar.style.strokeDashoffset = `${offset}`;
        }
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
            if (!song) song = (Storage.getListeningHistory() || []).find(s => s.id === songId);
            // Home-shelf cards belong to none of those collections - the menu
            // used to silently do nothing there. Cards carry their own payload.
            if (!song && card.dataset.songData) {
              try { song = JSON.parse(decodeURIComponent(card.dataset.songData)); } catch (_) {}
            }
            if (!song) {
              const nameEl = card.querySelector('.song-card__name, .song-card__title, .quick-pick-item__title');
              const artistEl = card.querySelector('.song-card__artist, .quick-pick-item__artist');
              const imgEl = card.querySelector('img');
              if (nameEl) {
                song = { id: songId, name: nameEl.textContent.trim(), artists: artistEl ? artistEl.textContent.trim() : '', image: imgEl ? imgEl.src : '' };
              }
            }
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
{ label: 'More Like This', icon: '✨', onClick: () => showMoreLikeThis(song) },
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

  async function renderTasteShelves() {
    if (typeof Recs === 'undefined' || !Recs.getPersonalizedHome) return;
    const host = document.getElementById('home-feed-sections');
    if (!host) return;
    try {
      const { madeForYou, perArtistShelves } = await Recs.getPersonalizedHome();

      let wrap = document.getElementById('taste-shelves');
      if (wrap) wrap.remove();
      wrap = document.createElement('div');
      wrap.id = 'taste-shelves';

      const addShelf = (title, eyebrow, songs) => {
        if (!songs || songs.length < 4) return;
        let clean = API.filterByLanguagePrefs(songs, { minKeep: 6 });
        clean = API.dedupeVariants(clean, { maxPerArtist: 6, maxRun: 3 });
        if (clean.length < 4) return;
        const list = clean.slice(0, 14);
        const section = document.createElement('section');
        section.className = 'shelf-section taste-shelf';
        section.innerHTML = `
          <div class="shelf-header">
            <div>
              <div class="shelf-eyebrow">${eyebrow}</div>
              <h2 class="shelf-title">${title}</h2>
            </div>
          </div>
          <div class="shelf-container"></div>`;
        const cont = section.querySelector('.shelf-container');
        UI.renderShelf(list, cont, 'song');
        bindSongCardEvents(cont, list);
        wrap.appendChild(section);
      };

      addShelf('Made For You', 'BASED ON WHAT YOU LISTEN TO', madeForYou);
      Object.entries(perArtistShelves || {}).forEach(([artist, songs]) => {
        addShelf(`More from ${artist}`, 'BECAUSE YOU LISTEN TO THEM', songs);
      });

      if (wrap.children.length > 0) {
        const qp = document.getElementById('quick-picks-section');
        if (qp && qp.parentElement === host) host.insertBefore(wrap, qp.nextSibling);
        else host.prepend(wrap);
      }
    } catch (e) {
      console.warn('[App] Taste shelves failed:', e);
    }
  }

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

      // Kill near-duplicate variants, then shuffle for discovery
      const qpClean = API.dedupeVariants
        ? API.dedupeVariants(quickPickSongs, { maxPerArtist: 4, maxRun: 2 })
        : quickPickSongs;
      const shuffledQuickPicks = qpClean.sort(() => Math.random() - 0.5);

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

      // Prefer a hero from the user's actual taste (top artist, not recently played)
      let heroCandidate = data.hero;
      try {
        if (typeof Recs !== 'undefined' && Recs.getTasteProfile) {
          const tp = Recs.getTasteProfile();
          if (tp.hasEnoughData && tp.topArtists.length > 0) {
            const heroArtist = tp.topArtists[0];
            const res = await API.searchSongs(`${heroArtist} best songs`, 10);
            const normList = (res || []).map(API.normalizeSong);
            const al = heroArtist.toLowerCase();
            const recentIds = new Set(Storage.getRecent().slice(0, 20).map(r => r.id));
            const matches = normList.filter(s => String(s.artists || '').toLowerCase().includes(al) && !recentIds.has(s.id));
            if (matches.length > 0) heroCandidate = matches[Math.floor(Math.random() * matches.length)];
          }
        }
      } catch (_) {}

      const heroSong = API.normalizeSong(heroCandidate);

      heroBg.style.backgroundImage = `url(${heroSong.image})`;
      heroImg.src = heroSong.image;
      heroTitle.textContent = heroSong.name;
      heroSubtitle.textContent = heroSong.artists;
      heroSection.style.display = 'flex';

      if (heroPlayBtn) {
        heroPlayBtn.onclick = async () => {
          Player.setQueue([heroSong], 0);
          await Player.playSong(heroSong);
        };
      }

      const heroFavBtn = document.getElementById('hero-fav-btn');
      if (heroFavBtn) {
        heroFavBtn.onclick = (e) => {
          e.stopPropagation();
          if (Storage.isFavorite(heroSong.id)) {
            Storage.removeFavorite(heroSong.id);
            UI.showToast('Removed from Favorites', 'info');
          } else {
            Storage.addFavorite(heroSong);
            UI.showToast('Added to Favorites ❤️', 'success');
          }
        };
      }

      const heroDownloadBtn = document.getElementById('hero-download-btn');
      if (heroDownloadBtn) {
        heroDownloadBtn.onclick = (e) => {
          e.stopPropagation();
          if (typeof Download !== 'undefined' && Download.downloadSong) {
            Download.downloadSong(heroSong);
          }
        };
      }

      const heroMoreBtn = document.getElementById('hero-more-btn');
      if (heroMoreBtn) {
        heroMoreBtn.onclick = (e) => {
          e.stopPropagation();
          if (typeof UI !== 'undefined' && UI.showSongContextMenu) {
            UI.showSongContextMenu(e, heroSong);
          }
        };
      }
    }

    // Home quick action buttons
    const btnHomeSearch = document.getElementById('btn-home-search');
    if (btnHomeSearch) {
      btnHomeSearch.onclick = () => navigateToPage('search');
    }
    const btnHomeFavs = document.getElementById('btn-home-favorites');
    if (btnHomeFavs) {
      btnHomeFavs.onclick = () => navigateToPage('library');
    }

    // 8.5. Render Skiper48 3D Swiper Cards Deck Carousel (Endless & Deep)
    const rawDeckList = [...(data.trending || []), ...(data.charts || []), ...(data.quickPicks || []), ...(data.newReleases || [])];
    const seenIds = new Set();
    const deckTracks = [];
    rawDeckList.forEach(item => {
      const id = item.id || item.name;
      if (!seenIds.has(id)) {
        seenIds.add(id);
        deckTracks.push(item);
      }
    });

    if (typeof UI !== 'undefined' && UI.render3DCardsCarousel && deckTracks.length > 0) {
      UI.render3DCardsCarousel(deckTracks);
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

    // 9b. Most Played (per-song counts)
    renderMostPlayedShelf();

    // 9c. Taste-based shelves: Made For You + "More from <artist>"
    renderTasteShelves();

    // 9d. New releases from artists the user follows
    try {
      const followed = Storage.getFollowedArtists() || [];
      if (followed.length > 0) checkNewReleasesFromFollowed(followed);
    } catch (_) {}

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
    if (toggleGlass) toggleGlass.checked = settings.glassEffect === true || settings.glass === true;

    const perfModeSelect = document.getElementById('select-perf-mode');
    if (perfModeSelect) perfModeSelect.value = settings.perfMode || 'auto';

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
    if (beatPulseToggle) beatPulseToggle.checked = settings.beatPulse === true;

    const visualizerToggle = document.getElementById('toggle-visualizer');
    if (visualizerToggle) visualizerToggle.checked = settings.visualizer === true; // Default false

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
        try { localStorage.removeItem('mf_home_cache'); } catch (_) {}
        if (typeof loadHomePage === 'function') loadHomePage(true);
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

    document.getElementById('select-perf-mode')?.addEventListener('change', (e) => {
      Storage.updateSettings({ perfMode: e.target.value });
      const lite = applyPerformanceMode();
      UI.showToast(lite ? '\u26A1 Lite mode on \u2014 max smoothness' : '\u2728 High fidelity effects on');
    });

    document.getElementById('toggle-glass')?.addEventListener('change', (e) => {
      const val = e.target.checked;
      Storage.updateSettings({ glassEffect: val, glass: val });
      applyTheme();
      if (typeof Settings !== 'undefined' && Settings.applyAllSettings) Settings.applyAllSettings();
      UI.showToast(`Glassmorphism ${val ? 'enabled' : 'disabled'}`);
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
      const state = Player.toggleSpatialAudio(e.target.checked);
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
    const enabled = settings.visualizer === true; // default OFF
    const playing = (typeof Player !== 'undefined' && Player.getIsPlaying) ? Player.getIsPlaying() : false;
    const shouldRun = expanded && enabled && playing && !document.body.classList.contains('perf-lite');

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
      ['K', 'Karaoke mode'],
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
    micBtn.closest('.search-container')?.classList.add('has-mic');
    // With mic + clear occupying the right edge, the long placeholder gets
    // clipped mid-word on phones - use a shorter one there.
    const searchInputEl = document.getElementById('search-input');
    if (searchInputEl && window.matchMedia('(max-width: 767.98px)').matches) {
      searchInputEl.placeholder = 'Songs, artists, albums…';
    }
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
    strip.style.display = 'none';
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


  // ---- Mini player swipe is handled cleanly in setupPlayerEvents ----
  function bindMiniPlayerSwipe() {
    // Handled in setupPlayerEvents to avoid duplicate listeners
  }

  // ---- Player action rail (mockup: fav / download / add / share) ----
  function updateRailFavState() {
    const btn = document.getElementById('btn-rail-fav');
    if (!btn) return;
    const cur = Player.getCurrentTrack();
    btn.classList.toggle('active', !!(cur && Storage.isFavorite(cur.id)));
  }

  function bindPlayerActionRail() {
    const favBtn = document.getElementById('btn-rail-fav');
    const dlBtn = document.getElementById('btn-rail-download');
    const addBtn = document.getElementById('btn-rail-add');
    const shareBtn = document.getElementById('btn-rail-share');

    favBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      const cur = Player.getCurrentTrack();
      if (!cur) return;
      const nowFav = Storage.toggleFavorite(cur);
      updateRailFavState();
      if (typeof Haptics !== 'undefined') Haptics.light();
      if (nowFav) UI.showToast(`\u2764\uFE0F Added \u201C${cur.name}\u201D to favorites`, 'success');
      else UI.showToast(`Removed \u201C${cur.name}\u201D from favorites`, 'info', {
        action: { label: 'Undo', onClick: () => { Storage.addFavorite(cur); updateRailFavState(); } }
      });
    });

    dlBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      const cur = Player.getCurrentTrack();
      if (cur && typeof Download !== 'undefined') Download.downloadSong(cur);
    });

    addBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      const cur = Player.getCurrentTrack();
      if (!cur) return;
      const rect = addBtn.getBoundingClientRect();
      const pls = Storage.getPlaylists() || [];
      const items = pls.slice(0, 6).map(p => ({
        label: `Add to ${p.name}`,
        icon: '\u{1F4C1}',
        onClick: () => { Storage.addSongToPlaylist(p.id, cur); UI.showToast(`Added to ${p.name}`, 'success'); }
      }));
      items.push({
        label: 'Add to New Playlist\u2026',
        icon: '\u2795',
        onClick: () => {
          const name = prompt('Playlist name:');
          if (name && name.trim()) {
            const np = Storage.createPlaylist(name.trim());
            Storage.addSongToPlaylist(np.id, cur);
            UI.showToast(`Created \u201C${np.name}\u201D and added song`, 'success');
          }
        }
      });
      UI.showContextMenu(rect.left - 190, rect.top, items);
    });

    shareBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      const cur = Player.getCurrentTrack();
      if (!cur) return;
      const rect = shareBtn.getBoundingClientRect();
      UI.showContextMenu(rect.left - 200, rect.top, [
        { label: 'Share song link', icon: '\u{1F517}', onClick: () => shareSongLink(cur) },
        { label: 'Share as image card', icon: '\u{1F5BC}\uFE0F', onClick: () => shareSongCard(cur) },
        { label: 'More like this', icon: '\u2728', onClick: () => showMoreLikeThis(cur) }
      ]);
    });
  }

  function shareSongLink(cur) {
    const url = buildSongShareUrl(cur);
    if (navigator.share) {
      navigator.share({ title: cur.name, text: `Listen to ${cur.name} by ${cur.artists || ''}`, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url);
      UI.showToast('Song link copied to clipboard', 'success');
    }
  }

  // ---- Live waveform strip above the progress bar ----
  let waveformLastDraw = 0;
  function drawWaveform(now) {
    if (now - waveformLastDraw < 100) return; // ~10fps is plenty
    waveformLastDraw = now;
    const canvas = document.getElementById('waveform-canvas');
    if (!canvas) return;
    const pc = document.getElementById('player-container');
    if (!pc || !pc.classList.contains('player-expanded')) return;
    const ctx = canvas.getContext('2d');
    const analyser = (Player.getAnalyserNode && Player.getAnalyserNode()) || null;
    const N = 56;
    let data = null;
    let hasSignal = false;
    if (analyser) {
      data = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(data);
      hasSignal = data.some(v => v > 0);
    }
    const accent = (getComputedStyle(document.documentElement).getPropertyValue('--dynamic-color') || '').trim() || '#ff5167';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = accent;
    const bw = canvas.width / N;
    const t = now / 320;
    const playing = Player.getIsPlaying && Player.getIsPlaying();
    for (let i = 0; i < N; i++) {
      let v;
      if (hasSignal) {
        v = data[Math.floor(i * data.length / (N * 2))] / 255;
      } else if (playing) {
        v = Math.sin(t + i * 0.45) * 0.28 + 0.45;
      } else {
        v = 0.12 + Math.sin(i * 0.5) * 0.05;
      }
      const h = Math.max(3, v * canvas.height * 0.92);
      ctx.globalAlpha = 0.3 + v * 0.7;
      ctx.fillRect(i * bw + bw * 0.28, (canvas.height - h) / 2, bw * 0.44, h);
    }
    ctx.globalAlpha = 1;
  }


  // ---- Listening History page (grouped by day, replay, clear) ----
  // Library "History" chip -> history page
  document.addEventListener('click', (e) => {
    if (e.target.closest && e.target.closest('#btn-lib-history-chip')) {
      e.preventDefault();
      navigateToPage('page-history');
    }
  });

  function renderHistoryPage() {
    const host = document.getElementById('history-container');
    if (!host) return;
    const history = Storage.getListeningHistory() || [];

    if (history.length === 0) {
      host.innerHTML = `
        <div class="empty-state" style="padding: 60px 16px; text-align: center;">
          <div class="empty-state__icon" style="font-size: 44px;">\u{1F553}</div>
          <div class="empty-state__title" style="font-size: 21px; font-weight: 800; color: var(--text-primary); margin-top: 10px;">No listening history yet</div>
          <div class="empty-state__subtitle" style="color: var(--text-secondary); font-size: 14px; margin-top: 6px;">Play a few songs and they'll show up here.</div>
        </div>`;
      return;
    }

    // Group by calendar day
    const startOfDay = (ts) => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); };
    const today = startOfDay(Date.now());
    const dayMs = 86400000;
    const groups = new Map();
    history.forEach(s => {
      const key = startOfDay(s.playedAt || Date.now());
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(s);
    });

    const labelFor = (key) => {
      if (key === today) return 'Today';
      if (key === today - dayMs) return 'Yesterday';
      return new Date(key).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
    };

    host.innerHTML = `
      <div class="section-header" style="align-items: center;">
        <h2 class="section-title">Listening History</h2>
        <div class="section-actions">
          <span class="section-count">${history.length} plays</span>
          <button class="btn-text" id="btn-clear-history">Clear</button>
        </div>
      </div>
      <div id="history-groups"></div>`;

    const groupHost = host.querySelector('#history-groups');
    [...groups.entries()].sort((a, b) => b[0] - a[0]).slice(0, 30).forEach(([key, songs]) => {
      const sec = document.createElement('div');
      sec.className = 'history-day';
      sec.innerHTML = `<div class="history-day__label">${labelFor(key)} \u00B7 ${songs.length}</div>`;
      const list = document.createElement('div');
      list.className = 'song-list';
      songs.slice(0, 40).forEach((song, i) => {
        const row = UI.renderSongListItem(song, i, {});
        const time = document.createElement('span');
        time.className = 'history-time';
        time.textContent = new Date(song.playedAt || Date.now()).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
        row.querySelector('.song-list-item__info')?.appendChild(time);
        list.appendChild(row);
      });
      sec.appendChild(list);
      groupHost.appendChild(sec);
      bindSongCardEvents(list, songs);
    });

    host.querySelector('#btn-clear-history')?.addEventListener('click', () => {
      const backup = Storage.getListeningHistory();
      if (!confirm('Clear your entire listening history?')) return;
      Storage.clearListeningHistory ? Storage.clearListeningHistory() : localStorage.removeItem('mf_listening_history');
      renderHistoryPage();
      UI.showToast('History cleared', 'info', {
        action: { label: 'Undo', onClick: () => {
          localStorage.setItem('mf_listening_history', JSON.stringify(backup));
          renderHistoryPage();
          UI.showToast('History restored', 'success');
        } }
      });
    });
  }

  // ---- Share as image card (canvas) ----
  async function shareSongCard(song) {
    if (!song) {
      song = (typeof Player !== 'undefined' && Player.getCurrentTrack) ? Player.getCurrentTrack() : null;
    }
    if (!song) {
      UI.showToast('No track playing to share', 'info');
      return;
    }
    UI.showToast('Creating share card\u2026', 'info');
    const W = 1080, H = 1350;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');

    // Load artwork (crossOrigin so the canvas stays exportable)
    const img = await new Promise(resolve => {
      const im = new Image();
      im.crossOrigin = 'anonymous';
      im.onload = () => resolve(im);
      im.onerror = () => resolve(null);
      im.src = (typeof song.image === 'string' && song.image) ? song.image : 'assets/logo.jpg';
    });

    // Background: blurred artwork wash + dark gradient
    if (img) {
      ctx.filter = 'blur(60px) saturate(1.6)';
      ctx.drawImage(img, -120, -120, W + 240, H + 240);
      ctx.filter = 'none';
    } else {
      ctx.fillStyle = '#1a1030';
      ctx.fillRect(0, 0, W, H);
    }
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, 'rgba(10,8,18,0.55)');
    grad.addColorStop(0.55, 'rgba(10,8,18,0.72)');
    grad.addColorStop(1, 'rgba(10,8,18,0.96)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Artwork card
    const AW = 720, AX = (W - AW) / 2, AY = 190;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 60;
    ctx.shadowOffsetY = 24;
    const r = 48;
    ctx.beginPath();
    ctx.moveTo(AX + r, AY);
    ctx.arcTo(AX + AW, AY, AX + AW, AY + AW, r);
    ctx.arcTo(AX + AW, AY + AW, AX, AY + AW, r);
    ctx.arcTo(AX, AY + AW, AX, AY, r);
    ctx.arcTo(AX, AY, AX + AW, AY, r);
    ctx.closePath();
    ctx.clip();
    if (img) ctx.drawImage(img, AX, AY, AW, AW);
    else { ctx.fillStyle = '#2a2140'; ctx.fillRect(AX, AY, AW, AW); }
    ctx.restore();

    // Text
    const fit = (text, size, maxW) => {
      ctx.font = `800 ${size}px "Geist", "Helvetica Neue", Arial, sans-serif`;
      let t = String(text || '');
      while (ctx.measureText(t).width > maxW && t.length > 4) t = t.slice(0, -2);
      return t === String(text || '') ? t : t + '\u2026';
    };
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 64px "Geist", "Helvetica Neue", Arial, sans-serif';
    ctx.fillText(fit(song.name, 64, W - 160), W / 2, AY + AW + 130);
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    ctx.font = '500 40px "Geist", "Helvetica Neue", Arial, sans-serif';
    ctx.fillText(fit(song.artists || song.artist, 40, W - 200), W / 2, AY + AW + 196);

    // Header + footer branding
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '800 30px "Geist", "Helvetica Neue", Arial, sans-serif';
    ctx.letterSpacing = '6px';
    ctx.fillText('NOW PLAYING', W / 2, 110);
    ctx.letterSpacing = '0px';

    // Waveform flourish
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    const bars = 34, bw = 8, gap = 12, tw = bars * bw + (bars - 1) * gap, bx = (W - tw) / 2, by = AY + AW + 280;
    for (let i = 0; i < bars; i++) {
      const t = i / (bars - 1);
      const h = 14 + Math.abs(Math.sin(t * Math.PI * 3.2)) * 62 * Math.sin(t * Math.PI);
      ctx.globalAlpha = 0.35 + 0.55 * Math.sin(t * Math.PI);
      ctx.fillRect(bx + i * (bw + gap), by - h / 2, bw, Math.max(8, h));
    }
    ctx.globalAlpha = 1;

    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '700 30px "Geist", "Helvetica Neue", Arial, sans-serif';
    ctx.fillText('\u266A  MusicFlow', W / 2, H - 76);

    const blob = await new Promise(res => canvas.toBlob(res, 'image/png', 0.95));
    if (!blob) { UI.showToast('Could not create the card', 'error'); return; }
    const file = new File([blob], `musicflow-${(song.name || 'song').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`, { type: 'image/png' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: song.name, text: `${song.name} \u2014 ${song.artists || ''}` });
        return;
      } catch (_) { /* user cancelled or share failed: fall through to download */ }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    UI.showToast('Share card saved to your downloads', 'success');
  }

  // ---- "More like this": related songs sheet ----
  async function showMoreLikeThis(song) {
    if (!song) return;
    let sheet = document.getElementById('more-like-sheet');
    if (sheet) sheet.remove();
    sheet = document.createElement('div');
    sheet.id = 'more-like-sheet';
    sheet.className = 'modal-overlay';
    sheet.style.display = 'flex';
    sheet.innerHTML = `
      <div class="modal more-like-card">
        <div class="modal-header">
          <div>
            <div class="shelf-eyebrow">MORE LIKE</div>
            <h2 style="margin:0; font-size:19px;">${song.name}</h2>
          </div>
          <button class="btn-icon" id="more-like-close" aria-label="Close">\u2715</button>
        </div>
        <div class="more-like-body"><div class="loading-shelf"></div></div>
      </div>`;
    document.body.appendChild(sheet);
    const close = () => sheet.remove();
    sheet.addEventListener('click', (e) => { if (e.target === sheet) close(); });
    sheet.querySelector('#more-like-close').addEventListener('click', close);

    try {
      const artist = String(song.artists || song.artist || '').split(',')[0].trim();
      const results = await Promise.allSettled([
        API.searchSongs(`${artist} best songs`, 18),
        API.searchSongs(song.album || song.name, 12)
      ]);
      let pool = [];
      results.forEach(r => { if (r.status === 'fulfilled' && Array.isArray(r.value)) pool.push(...r.value); });
      let list = pool.map(API.normalizeSong).filter(s => s && s.id !== song.id);
      list = API.filterByLanguagePrefs(list, { minKeep: 8 });
      list = API.dedupeVariants(list, { maxPerArtist: 4, maxRun: 2, excludeKeys: [API.getTitleKey(song)] }).slice(0, 20);

      const body = sheet.querySelector('.more-like-body');
      if (list.length === 0) {
        body.innerHTML = `<div style="padding:32px; text-align:center; color:var(--text-secondary);">No similar tracks found.</div>`;
        return;
      }
      body.innerHTML = '';
      const listEl = document.createElement('div');
      listEl.className = 'song-list';
      list.forEach((s, i) => listEl.appendChild(UI.renderSongListItem(s, i, {})));
      body.appendChild(listEl);
      bindSongCardEvents(listEl, list);

      const playAll = document.createElement('button');
      playAll.className = 'btn-primary';
      playAll.style.cssText = 'width:100%; margin-top:14px; padding:13px; border-radius:var(--radius-full); font-weight:800;';
      playAll.textContent = `\u25B6 Play all ${list.length}`;
      playAll.addEventListener('click', () => {
        Player.setQueue(list, 0);
        Player.playSong(list[0], 0);
        UI.showToast(`Playing ${list.length} similar tracks`, 'success');
        close();
      });
      body.appendChild(playAll);
    } catch (e) {
      sheet.querySelector('.more-like-body').innerHTML = `<div style="padding:32px; text-align:center; color:var(--text-secondary);">Couldn't load similar songs.</div>`;
    }
  }


  // ---- Follow artist (activates the new-releases subsystem) ----
  function updateFollowButton(artistName) {
    const btn = document.getElementById('btn-artist-follow');
    const label = document.getElementById('btn-artist-follow-label');
    if (!btn || !label) return;
    const id = 'artist_' + String(artistName || '').toLowerCase().replace(/\s+/g, '_');
    const following = Storage.isArtistFollowed(id);
    label.textContent = following ? 'Following' : 'Follow';
    btn.classList.toggle('is-following', following);
    btn.querySelector('.material-symbols-outlined').textContent = following ? 'how_to_reg' : 'person_add';
  }

  function bindFollowButton() {
    document.getElementById('btn-artist-follow')?.addEventListener('click', () => {
      const name = document.getElementById('artist-page-name')?.textContent?.trim();
      if (!name) return;
      const id = 'artist_' + name.toLowerCase().replace(/\s+/g, '_');
      const img = document.getElementById('artist-page-img')?.src || '';
      if (Storage.isArtistFollowed(id)) {
        Storage.unfollowArtist(id);
        UI.showToast(`Unfollowed ${name}`);
      } else {
        Storage.followArtist({ id, name, image: img });
        UI.showToast(`\u2713 Following ${name} \u2014 you'll see their new releases on Home`, 'success');
      }
      updateFollowButton(name);
      if (typeof Haptics !== 'undefined') Haptics.light();
    });
  }

  // ---- Most Played shelf (per-song counts) ----
  function renderMostPlayedShelf() {
    const host = document.getElementById('home-feed-sections');
    if (!host || !Storage.getMostPlayed) return;
    const top = Storage.getMostPlayed(14);
    const existing = document.getElementById('shelf-most-played');
    if (existing) existing.remove();
    if (top.length < 4) return;

    const section = document.createElement('section');
    section.className = 'shelf-section';
    section.id = 'shelf-most-played';
    section.innerHTML = `
      <div class="shelf-header">
        <div>
          <div class="shelf-eyebrow">ON REPEAT</div>
          <h2 class="shelf-title">Your Most Played</h2>
        </div>
      </div>
      <div class="shelf-container"></div>`;
    const cont = section.querySelector('.shelf-container');
    UI.renderShelf(top, cont, 'song');
    // Badge each card with its play count
    [...cont.children].forEach((card, i) => {
      if (!top[i]) return;
      const badge = document.createElement('span');
      badge.className = 'play-count-badge';
      badge.textContent = `${top[i].count}\u00D7`;
      card.style.position = 'relative';
      card.appendChild(badge);
    });
    bindSongCardEvents(cont, top);
    const taste = document.getElementById('taste-shelves');
    if (taste) host.insertBefore(section, taste);
    else host.prepend(section);
  }

  // ---- Full-screen karaoke lyrics mode ----
  let karaokeActive = false;
  function toggleKaraokeMode(force) {
    const track = Player.getCurrentTrack();
    let overlay = document.getElementById('karaoke-overlay');
    const shouldOpen = force !== undefined ? force : !karaokeActive;

    if (!shouldOpen) {
      karaokeActive = false;
      overlay?.classList.remove('open');
      setTimeout(() => overlay?.remove(), 250);
      return;
    }
    if (!track) { UI.showToast('Play a song first', 'info'); return; }

    if (overlay) overlay.remove();
    overlay = document.createElement('div');
    overlay.id = 'karaoke-overlay';
    overlay.innerHTML = `
      <div class="karaoke-bg" style="background-image:url('${(typeof track.image === 'string' && track.image) || 'assets/logo.jpg'}')"></div>
      <div class="karaoke-top">
        <div class="karaoke-track">
          <div class="karaoke-track__name">${track.name}</div>
          <div class="karaoke-track__artist">${track.artists || ''}</div>
        </div>
        <button class="btn-icon" id="karaoke-close" aria-label="Exit karaoke">
          <span class="material-symbols-outlined" style="font-size:26px;">close</span>
        </button>
      </div>
      <div class="karaoke-lines" id="karaoke-lines"><div class="karaoke-empty">Loading lyrics\u2026</div></div>
      <div class="karaoke-controls">
        <button class="btn-icon" data-action="previous"><span class="material-symbols-outlined" style="font-size:30px;">skip_previous</span></button>
        <button class="btn-icon karaoke-play" data-action="toggle-play"><span class="material-symbols-outlined" style="font-size:34px;">${Player.getIsPlaying() ? 'pause' : 'play_arrow'}</span></button>
        <button class="btn-icon" data-action="next"><span class="material-symbols-outlined" style="font-size:30px;">skip_next</span></button>
      </div>`;
    document.body.appendChild(overlay);
    // rAF alone can be throttled (background/low-power); timeout guarantees it
    requestAnimationFrame(() => overlay.classList.add('open'));
    setTimeout(() => overlay.classList.add('open'), 60);
    karaokeActive = true;

    overlay.querySelector('#karaoke-close').addEventListener('click', () => toggleKaraokeMode(false));
    overlay.querySelectorAll('[data-action]').forEach(b => {
      b.addEventListener('click', () => {
        const a = b.dataset.action;
        if (a === 'previous') Player.previous();
        else if (a === 'next') Player.next();
        else if (a === 'toggle-play') {
          Player.togglePlayPause();
          setTimeout(() => {
            const icon = overlay.querySelector('.karaoke-play .material-symbols-outlined');
            if (icon) icon.textContent = Player.getIsPlaying() ? 'pause' : 'play_arrow';
          }, 200);
        }
      });
    });

    // Reuse the already-parsed synced lyrics when available
    const linesHost = overlay.querySelector('#karaoke-lines');
    const paint = () => {
      if (parsedLyricsLines && parsedLyricsLines.length > 0) {
        linesHost.innerHTML = parsedLyricsLines
          .map((l, i) => `<div class="karaoke-line" data-k-idx="${i}" data-time="${l.time}">${l.text}</div>`).join('');
      } else if (activeLyricsData && activeLyricsData.plain) {
        linesHost.innerHTML = activeLyricsData.plain.split('\n')
          .filter(t => t.trim())
          .map(t => `<div class="karaoke-line karaoke-line--static">${t}</div>`).join('');
      } else {
        linesHost.innerHTML = '<div class="karaoke-empty">Lyrics aren\u2019t available for this song.</div>';
      }
    };
    if (!parsedLyricsLines || parsedLyricsLines.length === 0) {
      loadLyrics(track, true).then(paint).catch(paint);
    } else {
      paint();
    }
  }

  function updateKaraokeHighlight(currentTime) {
    if (!karaokeActive) return;
    const host = document.getElementById('karaoke-lines');
    if (!host) return;
    const lines = host.querySelectorAll('.karaoke-line[data-time]');
    if (!lines.length) return;
    let activeIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (parseFloat(lines[i].dataset.time) <= currentTime + 0.25) activeIdx = i;
      else break;
    }
    if (activeIdx < 0) return;
    if (host.dataset.active === String(activeIdx)) return;
    host.dataset.active = String(activeIdx);
    lines.forEach((l, i) => {
      l.classList.toggle('karaoke-line-active', i === activeIdx);
      l.classList.toggle('karaoke-line-past', i < activeIdx);
    });
    lines[activeIdx].scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  function bindKaraokeButton() {
    document.getElementById('btn-full-karaoke')?.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleKaraokeMode();
    });
  }

  // ---- Keyboard Shortcuts & Command Palette ----

  function bindKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Ignore if typing in any input, textarea, search bar, or if an input is active
      const target = e.target;
      const activeEl = document.activeElement;
      if (
        (target && (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable || target.closest('input, textarea, select, [contenteditable="true"]'))) ||
        (activeEl && (['INPUT', 'TEXTAREA', 'SELECT'].includes(activeEl.tagName) || activeEl.isContentEditable))
      ) {
        return;
      }

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
        case 'k':
        case 'K':
          toggleKaraokeMode();
          break;
        case 'Escape': {
          const help = document.getElementById('shortcuts-help-overlay');
          if (help && help.style.display !== 'none') help.style.display = 'none';
          if (document.getElementById('karaoke-overlay')) toggleKaraokeMode(false);
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
          { label: 'Open Listening History', action: () => navigateToPage('page-history') },
          { label: 'Karaoke Mode (full-screen lyrics)', action: () => toggleKaraokeMode(true) },
          { label: 'Share Current Song as Image', action: () => shareSongCard(Player.getCurrentTrack()) },
          { label: 'More Like Current Song', action: () => showMoreLikeThis(Player.getCurrentTrack()) },
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

    const isGlass = settings.glass === true || settings.glassEffect === true;
    if (isGlass) {
      document.body.classList.add('ultra-glass', 'clear-glass');
    } else {
      document.body.classList.remove('ultra-glass', 'clear-glass');
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

  // ---- Global Error Resilience ----
  window.addEventListener('error', (event) => {
    // Ignore harmless cross-origin script error noise or cancelled resource loads
    if (!event.message || event.message.includes('Script error')) return;
    console.warn('[MusicFlow Global Error Caught]:', event.message, event.filename, event.lineno);
  });

  window.addEventListener('unhandledrejection', (event) => {
    // Ignore cancelled playback abort errors or aborted fetch requests
    if (event.reason && (event.reason.name === 'AbortError' || event.reason.name === 'NotAllowedError')) {
      return;
    }
    console.warn('[MusicFlow Unhandled Rejection Caught]:', event.reason);
  });

  // ---- Init ----
  function startApp() {
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
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startApp);
  } else {
    // DOM is already ready (e.g. cached or deferred script execution)
    startApp();
  }

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
      
      // Phase 1: RELATED-ONLY queries (artists, the song family, the album).
      // Language/chart backfill is fetched later ONLY if this pool runs thin,
      // so an artist radio is never polluted with unrelated chart songs.
      const queryPromises = [
        API.searchSongs(primaryArtist, 20),
        API.searchSongs(`${primaryArtist} best songs`, 15),
        API.searchSongs(norm.name, 15),
        API.searchSongs(norm.album || norm.name, 10)
      ];

      if (secondaryArtist) {
        queryPromises.push(API.searchSongs(secondaryArtist, 15));
      }

      const resultsArray = await Promise.allSettled(queryPromises);
      let combinedPool = [];
      resultsArray.forEach(res => {
        if (res.status === 'fulfilled' && Array.isArray(res.value)) {
          combinedPool.push(...res.value);
        }
      });

      const seen = new Set([norm.id]);
      let normalizedPool = [];
      combinedPool.forEach(s => {
        if (s && s.id && !seen.has(s.id)) {
          seen.add(s.id);
          normalizedPool.push(API.normalizeSong(s));
        }
      });

      // RELEVANCE SCORE: JioSaavn artist searches return sound-alike cover
      // spam for niche tracks. Keep only songs that actually relate to the
      // seed: shared artist (+3), title-family token (+2), same album (+1),
      // same language (+1). Score >= 2 = related.
      const seedArtistList = (norm.artists || '').toLowerCase().split(',').map(a => a.trim()).filter(a => a.length > 1);
      const seedTokens = (norm.name || '').toLowerCase().replace(/[^a-z0-9\u0900-\u097f ]+/g, ' ').split(/\s+/).filter(w => w.length > 3);
      const relevanceScore = (s) => {
        let sc = 0;
        const a = (s.artists || '').toLowerCase();
        if (seedArtistList.some(sa => a.includes(sa))) sc += 3;
        const n = (s.name || '').toLowerCase();
        if (seedTokens.some(t => n.includes(t))) sc += 2;
        if (norm.album && s.album && s.album === norm.album) sc += 1;
        if (norm.language && s.language && s.language === norm.language) sc += 1;
        return sc;
      };
      let related = normalizedPool
        .map(s => ({ s, sc: relevanceScore(s) }))
        .filter(x => x.sc >= 2)
        .sort((x, y) => y.sc - x.sc)
        .map(x => x.s);
      related = API.filterByLanguagePrefs(related, { minKeep: 12 });

      // Phase 2: backfill with the user's languages/charts only if thin
      if (related.length < 12) {
        const prefLangs = (Storage.getSettings().languages || []).slice(0, 2);
        const backfillPromises = prefLangs.map(lang => API.searchSongs(`top ${lang} songs`, 12));
        backfillPromises.push(API.getTrendingPool(15));
        const backfillResults = await Promise.allSettled(backfillPromises);
        let backfill = [];
        backfillResults.forEach(r => {
          if (r.status === 'fulfilled' && Array.isArray(r.value)) backfill.push(...r.value);
        });
        backfill = backfill.map(API.normalizeSong).filter(s => s && s.id && !seen.has(s.id));
        backfill.forEach(s => seen.add(s.id));
        backfill = API.filterByLanguagePrefs(backfill, { minKeep: 10 });
        related = [...related, ...backfill];
      }

      let uniqueSongs = [norm, ...related];

      if (uniqueSongs.length > 1) {
        // Kill slowed/8D/sped-up clones, cap per-artist, interleave artists
        const seedKey = API.getTitleKey(norm);
        const recentKeys = (Storage.getRecent() || []).slice(0, 40).map(r => API.getTitleKey(r));
        let tail = uniqueSongs.slice(1).sort(() => Math.random() - 0.5);
        tail = API.dedupeVariants(tail, { maxPerArtist: 4, maxRun: 2, excludeKeys: [seedKey, ...recentKeys] });
        if (tail.length < 8) {
          // Too much history overlap: allow repeats rather than a thin station
          tail = API.dedupeVariants(uniqueSongs.slice(1), { maxPerArtist: 4, maxRun: 2, excludeKeys: [seedKey] });
        }
        const radioQueue = [norm, ...tail];
        Player.setQueue(radioQueue, 0);
        UI.showToast(`Radio loaded \u2014 ${radioQueue.length} unique tracks`, 'success');
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
    setTimeout(() => updateFollowButton(cleanName), 60);
    document.getElementById('btn-minimize-player')?.click();
    
    if (pushHistory) {
      history.pushState({ type: 'artist', name: cleanName, image }, '', '#artist/' + encodeURIComponent(cleanName));
    }

    const imgEl = document.getElementById('artist-page-img');
    const nameEl = document.getElementById('artist-page-name');
    const subtitleEl = document.getElementById('artist-page-subtitle');
    const countEl = document.getElementById('artist-songs-count');
    const followersEl = document.getElementById('artist-followers-count');
    const listenersEl = document.getElementById('artist-listeners-count');
    const loadMoreContainer = document.getElementById('artist-load-more-container');
    const loadMoreBtn = document.getElementById('btn-artist-load-more');
    const albumsSection = document.getElementById('artist-albums-section');
    const albumsContainer = document.getElementById('artist-albums-container');
    const songsContainer = document.getElementById('artist-songs-container');

    if (nameEl) nameEl.textContent = cleanName;
    if (subtitleEl) subtitleEl.textContent = 'Verified Artist • Official Discography';
    if (countEl) countEl.textContent = 'Loading tracks...';
    if (followersEl) {
      const pseudoFollowers = (Math.abs(cleanName.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 80) / 10 + 1.2).toFixed(1);
      followersEl.textContent = `${pseudoFollowers}M`;
    }
    if (listenersEl) {
      const pseudoListeners = (Math.abs(cleanName.split('').reduce((acc, c) => acc * 3 + c.charCodeAt(0), 0) % 250) / 10 + 5.5).toFixed(1);
      listenersEl.textContent = `${pseudoListeners}M`;
    }
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

  async function openArtistHighlight(type) {
    const artistNameEl = document.getElementById('artist-hero-name');
    const artistName = artistNameEl ? artistNameEl.textContent.trim() : 'Artist';
    if (!artistName || artistName === 'Artist') {
      UI.showToast('Select an artist first', 'info');
      return;
    }

    const HIGHLIGHT_TYPES = {
      live: { title: 'Live Concert & Tour 🎤', query: `${artistName} live concert acoustic performance` },
      studio: { title: 'Studio Sessions & Master Tracks 🎧', query: `${artistName} studio session acoustic recording` },
      qa: { title: 'Fan Interviews & Stories 🎙️', query: `${artistName} interview podcast story` },
      behind: { title: 'Behind the Scenes & Unreleased 🎹', query: `${artistName} unreleased demo session` }
    };

    const hl = HIGHLIGHT_TYPES[type] || HIGHLIGHT_TYPES.live;
    UI.showToast(`Loading ${hl.title}...`, 'info');
    if (typeof Haptics !== 'undefined' && Haptics.light) Haptics.light();

    try {
      const results = await API.search(hl.query);
      const songs = (results?.songs || []).slice(0, 15);
      if (songs.length > 0) {
        Player.setQueue(songs, 0);
        UI.showToast(`Playing ${hl.title} (${songs.length} tracks)`, 'success');
        if (window.expandPlayer) window.expandPlayer(true);
      } else {
        UI.showToast(`No special highlight tracks found for ${artistName}`, 'info');
      }
    } catch (err) {
      console.warn('Failed to load artist highlight:', err);
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

    // Edge Swipe Right to navigate back (started near left screen edge <= 65px)
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

  async function playMindfulStation(query, stationName, soundscapeName = null) {
    if (typeof Haptics !== 'undefined' && Haptics.medium) Haptics.medium();
    UI.showToast(`🌿 Playing ${stationName}...`, 'success');

    if (soundscapeName && typeof Ambience !== 'undefined' && Ambience.setSoundscape) {
      Ambience.setSoundscape(soundscapeName);
    }

    try {
      let results = [];
      if (window.API && API.search) {
        const res = await API.search(query);
        results = res?.songs || res?.results || (Array.isArray(res) ? res : []);
      }
      
      if (!results || !results.length) {
        if (window.API && API.getTrending) {
          const tr = await API.getTrending();
          results = tr?.songs || tr || [];
        }
      }

      if (results && results.length > 0) {
        const normalizedList = results.map(s => (window.API && API.normalizeSong) ? API.normalizeSong(s) : s);
        Player.setQueue(normalizedList, 0);
        await Player.playSong(normalizedList[0]);
        
        // Expand player on desktop/mobile for full immersion
        const playerContainer = document.getElementById('player-container');
        if (playerContainer) {
          playerContainer.classList.add('player-expanded');
          playerContainer.classList.remove('player-minimized');
        }
      } else {
        if (typeof Search !== 'undefined' && Search.executeSearch) {
          Search.executeSearch(query);
        }
      }
    } catch (e) {
      console.warn('[Mindful] Playback fallback:', e);
      if (typeof Search !== 'undefined' && Search.executeSearch) {
        Search.executeSearch(query);
      }
    }
  }

  function bindMindfulControls() {
    // 1. Mindful Start Session
    const startSessionBtn = document.getElementById('btn-mindful-start-session');
    if (startSessionBtn) {
      startSessionBtn.onclick = (e) => {
        e.stopPropagation();
        playMindfulStation('Morning Mindfulness Relaxing Meditation', 'Morning Mindfulness', 'ocean');
      };
    }

    // 2. Quick Actions 4-Pack (Meditate, Sleep, Breathe, Focus)
    document.querySelectorAll('.quick-action-card').forEach(card => {
      card.onclick = (e) => {
        e.stopPropagation();
        const mode = card.dataset.mode;
        const modeConfig = {
          meditate: { query: 'Mindfulness Meditation Flow', name: 'Meditation Flow', sound: 'ocean' },
          sleep: { query: 'Deep Sleep Delta Waves Sleep', name: 'Deep Sleep', sound: 'rain' },
          breathe: { query: 'Breathwork Ambient Chill Beats', name: 'Breathwork & Chill', sound: 'forest' },
          focus: { query: 'Deep Focus Alpha Waves Binaural', name: 'Deep Focus Beats', sound: 'campfire' }
        };
        const cfg = modeConfig[mode] || { query: 'Chill Instrumental', name: 'Chillout', sound: 'ocean' };
        playMindfulStation(cfg.query, cfg.name, cfg.sound);
      };
    });

    // 3. Focus Session Cards
    document.querySelectorAll('.focus-card').forEach(card => {
      card.onclick = (e) => {
        e.stopPropagation();
        const query = card.dataset.query || 'Stress Relief Meditation';
        const title = card.querySelector('.focus-card-title')?.textContent || 'Session';
        playMindfulStation(query, title, 'ocean');
      };
    });

    // 4. Focus Filter Pills
    document.querySelectorAll('.focus-pill').forEach(pill => {
      pill.onclick = () => {
        document.querySelectorAll('.focus-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        const focus = pill.dataset.focus;
        if (typeof Haptics !== 'undefined' && Haptics.selection) Haptics.selection();
        
        const focusData = {
          all: [
            { title: 'Let Go of Stress', desc: 'Guided flow to release stress, tension, and worry.', duration: '15 min', query: 'Stress Relief Meditation', bg: 'linear-gradient(135deg, #133a34 0%, #0c2420 100%)' },
            { title: 'Deep Sleep', desc: 'Fall into a deep, uninterrupted, and restful sleep.', duration: '30 min', query: 'Deep Sleep Delta Waves', bg: 'linear-gradient(135deg, #1b3a58 0%, #0e2236 100%)' },
            { title: 'Self Love', desc: 'Nurture yourself, build inner confidence and peace.', duration: '20 min', query: 'Self Love Healing Frequency', bg: 'linear-gradient(135deg, #443224 0%, #26190f 100%)' }
          ],
          anxiety: [
            { title: 'Anxiety Release', desc: 'Soothe your nervous system with 432Hz ambient tones.', duration: '12 min', query: 'Anxiety Relief 432Hz', bg: 'linear-gradient(135deg, #133a34 0%, #0c2420 100%)' },
            { title: 'Calm the Mind', desc: 'Deep breathing flow with gentle piano & strings.', duration: '18 min', query: 'Calm Mind Piano', bg: 'linear-gradient(135deg, #1d333b 0%, #0b1a20 100%)' }
          ],
          sleep: [
            { title: 'Deep Sleep Delta Waves', desc: 'Drift away with low delta frequencies & night rain.', duration: '45 min', query: 'Deep Sleep Delta Waves', bg: 'linear-gradient(135deg, #1b3a58 0%, #0e2236 100%)' },
            { title: 'Midnight Stargazing', desc: 'Cosmic ambient synthesizer soundscapes.', duration: '30 min', query: 'Space Ambient Sleep', bg: 'linear-gradient(135deg, #1f274a 0%, #101428 100%)' }
          ],
          'self-love': [
            { title: 'Self Love & Healing', desc: 'Positive affirmations with warm harmonic acoustic guitar.', duration: '20 min', query: 'Self Love Acoustic Healing', bg: 'linear-gradient(135deg, #443224 0%, #26190f 100%)' }
          ],
          energy: [
            { title: 'Morning Radiance', desc: 'Uplifting organic house & energizing morning beats.', duration: '25 min', query: 'Morning Energy House', bg: 'linear-gradient(135deg, #4a3418 0%, #291b0a 100%)' },
            { title: 'Flow State Beats', desc: 'Brisk 120 BPM deep focus groove.', duration: '35 min', query: 'Flow State Instrumental', bg: 'linear-gradient(135deg, #401b34 0%, #210c1a 100%)' }
          ],
          focus: [
            { title: 'Deep Work Flow', desc: 'Alpha wave binaural beats for peak concentration.', duration: '50 min', query: 'Deep Focus Alpha Waves', bg: 'linear-gradient(135deg, #242b50 0%, #10152c 100%)' },
            { title: 'Minimal Lo-Fi Study', desc: 'Soft vinyl beats and chill coffeehouse warmth.', duration: '30 min', query: 'Lofi Study Beats', bg: 'linear-gradient(135deg, #372844 0%, #1c1324 100%)' }
          ]
        };

        const listEl = document.getElementById('focus-cards-list');
        if (!listEl) return;
        const items = focusData[focus] || focusData.all;
        listEl.innerHTML = items.map(item => `
          <div class="focus-card" data-query="${item.query}" style="background: ${item.bg};">
            <div class="focus-card-info">
              <h4 class="focus-card-title">${item.title}</h4>
              <p class="focus-card-desc">${item.desc}</p>
              <div class="focus-card-meta">
                <span class="focus-card-duration">${item.duration}</span>
                <div class="focus-waveform-preview">
                  <span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span>
                </div>
              </div>
            </div>
            <button class="focus-card-play-btn" aria-label="Play ${item.title}">
              <span class="material-symbols-outlined" style="font-size: 20px; font-variation-settings: 'FILL' 1;">play_arrow</span>
            </button>
          </div>
        `).join('');

        // Re-bind click
        listEl.querySelectorAll('.focus-card').forEach(card => {
          card.onclick = (e) => {
            e.stopPropagation();
            const query = card.dataset.query;
            const title = card.querySelector('.focus-card-title')?.textContent || 'Session';
            playMindfulStation(query, title, 'ocean');
          };
        });
      };
    });

    // 5. 15s Rewind & Fast Forward Skip Buttons in Full Player
    const btnSkipBack = document.getElementById('btn-skip-backward-15');
    if (btnSkipBack) {
      btnSkipBack.onclick = (e) => {
        e.stopPropagation();
        if (typeof Player !== 'undefined' && Player.getCurrentTime) {
          const newTime = Math.max(0, Player.getCurrentTime() - 15);
          Player.seekTo(newTime);
          if (typeof Haptics !== 'undefined' && Haptics.selection) Haptics.selection();
          UI.showToast('↶ Rewind 15s', 'info');
        }
      };
    }

    const btnSkipForward = document.getElementById('btn-skip-forward-15');
    if (btnSkipForward) {
      btnSkipForward.onclick = (e) => {
        e.stopPropagation();
        if (typeof Player !== 'undefined' && Player.getCurrentTime && Player.getDuration) {
          const newTime = Math.min(Player.getDuration(), Player.getCurrentTime() + 15);
          Player.seekTo(newTime);
          if (typeof Haptics !== 'undefined' && Haptics.selection) Haptics.selection();
          UI.showToast('15s ↷ Forward', 'info');
        }
      };
    }
  }

  function toggleFollowArtist(artistName) {
    if (!artistName || artistName === '-' || artistName === 'Artist') {
      const cur = (typeof Player !== 'undefined' && Player.getCurrentTrack) ? Player.getCurrentTrack() : null;
      if (cur?.artists) {
        artistName = typeof cur.artists === 'string' ? cur.artists.split(/[,/&]+/)[0].trim() : (cur.artists[0]?.name || 'Artist');
      }
    }
    if (!artistName || artistName === '-' || artistName === 'Artist') return;

    const isFollowed = (window.Storage && Storage.isArtistFollowed) ? Storage.isArtistFollowed(artistName) : false;
    if (isFollowed) {
      Storage.unfollowArtist(artistName);
      if (typeof UI !== 'undefined' && UI.showToast) UI.showToast(`Unfollowed ${artistName}`, 'info');
    } else {
      Storage.followArtist(artistName);
      if (typeof UI !== 'undefined' && UI.showToast) UI.showToast(`Following ${artistName}! 🌟`, 'success');
    }
    if (typeof Haptics !== 'undefined' && Haptics.like) Haptics.like();

    // Update all follow button instances across the app
    document.querySelectorAll('#btn-player-follow, .minimal-follow-btn, .btn-artist-follow, #btn-artist-follow-action').forEach(b => {
      b.textContent = !isFollowed ? 'Following' : 'Follow';
      b.classList.toggle('following', !isFollowed);
    });
    const pageBtn = document.getElementById('btn-artist-follow-label');
    if (pageBtn) {
      pageBtn.textContent = !isFollowed ? 'Following' : 'Follow';
    }
  }

  function openActiveListenersModal() {
    const cur = (typeof Player !== 'undefined' && Player.getCurrentTrack) ? Player.getCurrentTrack() : null;
    const title = cur?.name || 'Current Song';
    const countEl = document.getElementById('minimal-listener-count');
    const count = countEl ? countEl.textContent : '384';

    let modal = document.getElementById('active-listeners-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'active-listeners-modal';
      modal.className = 'modal-overlay';
      modal.innerHTML = `
        <div class="modal active-listeners-card" style="max-width: 400px; width: 90%; border-radius: 24px; padding: 22px; background: #12141c; border: 1px solid rgba(255,255,255,0.1); color: #fff; box-shadow: 0 24px 60px rgba(0,0,0,0.8);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="minimal-pulse-dot" style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #ff5252; box-shadow: 0 0 8px #ff5252;"></span>
              <h3 style="margin: 0; font-size: 17px; font-weight: 800;">Active Listeners</h3>
            </div>
            <button class="btn-icon" onclick="document.getElementById('active-listeners-modal').style.display='none'" style="color: #fff; background: none; border: none; cursor: pointer;">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>
          <p style="font-size: 12.5px; color: rgba(255,255,255,0.65); margin: 0 0 14px 0;"><strong>${count} listeners</strong> are vibing to <span style="color: #ff5252;">${title}</span> right now.</p>
          <div style="display: flex; flex-direction: column; gap: 10px;">
            <div style="display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: rgba(255,255,255,0.05); border-radius: 12px;">
              <span style="font-size: 22px;">🎧</span>
              <div style="flex: 1;"><div style="font-size: 13px; font-weight: 700;">Alex Rivera</div><div style="font-size: 11px; color: rgba(255,255,255,0.5);">Listening via Hi-Res Lossless</div></div>
              <span style="font-size: 11px; color: #1dd1a1; font-weight: 700;">● Live</span>
            </div>
            <div style="display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: rgba(255,255,255,0.05); border-radius: 12px;">
              <span style="font-size: 22px;">👑</span>
              <div style="flex: 1;"><div style="font-size: 13px; font-weight: 700;">Maya Sharma</div><div style="font-size: 11px; color: rgba(255,255,255,0.5);">Listening in Mumbai</div></div>
              <span style="font-size: 11px; color: #1dd1a1; font-weight: 700;">● Live</span>
            </div>
            <div style="display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: rgba(255,255,255,0.05); border-radius: 12px;">
              <span style="font-size: 22px;">⚡</span>
              <div style="flex: 1;"><div style="font-size: 13px; font-weight: 700;">Liam Carter</div><div style="font-size: 11px; color: rgba(255,255,255,0.5);">Synced Session Host</div></div>
              <span style="font-size: 11px; color: #1dd1a1; font-weight: 700;">● Live</span>
            </div>
          </div>
          <button class="btn-primary" onclick="if(window.UI && UI.showToast) UI.showToast('Started Listening Party Mode! 🎧', 'success'); document.getElementById('active-listeners-modal').style.display='none';" style="width: 100%; margin-top: 16px; padding: 12px; border-radius: 9999px; font-weight: 800; background: var(--accent-color, #ff5252);">
            Join Listening Party
          </button>
        </div>
      `;
      document.body.appendChild(modal);
      modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };
    } else {
      const p = modal.querySelector('p');
      if (p) p.innerHTML = `<strong>${count} listeners</strong> are vibing to <span style="color: #ff5252;">${title}</span> right now.`;
    }
    modal.style.display = 'flex';
    if (typeof Haptics !== 'undefined' && Haptics.light) Haptics.light();
  }

  function toggleFavoriteCurrent() {
    const cur = (typeof Player !== 'undefined' && Player.getCurrentTrack) ? Player.getCurrentTrack() : null;
    if (!cur) return;
    const isFav = Storage.toggleFavorite(cur);
    UI.showToast(isFav ? `Added "${cur.name}" to Favorites ❤️` : `Removed "${cur.name}" from Favorites`, isFav ? 'success' : 'info');
    if (typeof Haptics !== 'undefined' && Haptics.like) Haptics.like();
    document.querySelectorAll('.btn-fav, [data-action="fav-current"]').forEach(btn => {
      btn.classList.toggle('active', isFav);
      btn.classList.toggle('favorited', isFav);
      btn.innerHTML = `<span class="material-symbols-outlined" style="font-size: 26px; ${isFav ? 'color: #ff4757; font-variation-settings: \'FILL\' 1;' : ''}">${isFav ? 'favorite' : 'favorite_border'}</span>`;
    });
  }

  function openPlayerOptions() {
    const cur = (typeof Player !== 'undefined' && Player.getCurrentTrack) ? Player.getCurrentTrack() : null;
    if (!cur) {
      UI.showToast('No song playing', 'info');
      return;
    }
    
    let modal = document.getElementById('player-options-sheet');
    if (modal) modal.remove();

    const isFav = Storage.isFavorite(cur.id);

    modal = document.createElement('div');
    modal.id = 'player-options-sheet';
    modal.className = 'modal-backdrop';
    modal.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); z-index: 100000; display: flex; align-items: flex-end; justify-content: center; padding: 0;';
    modal.innerHTML = `
      <div class="modal-card" style="max-width: 480px; width: 100%; border-radius: 28px 28px 0 0; padding: 24px 20px calc(24px + env(safe-area-inset-bottom, 16px)); background: rgba(18, 20, 28, 0.96); border: 1px solid rgba(255,255,255,0.12); box-shadow: 0 -10px 40px rgba(0,0,0,0.8); display: flex; flex-direction: column; gap: 6px;">
        <div style="width: 40px; height: 4px; border-radius: 9999px; background: rgba(255,255,255,0.25); margin: 0 auto 14px auto;"></div>
        
        <div style="display: flex; align-items: center; gap: 14px; margin-bottom: 12px; padding: 0 4px;">
          <img src="${cur.image || 'assets/logo.png'}" alt="Art" style="width: 48px; height: 48px; border-radius: 12px; object-fit: cover;">
          <div style="flex: 1; min-width: 0;">
            <div style="font-weight: 800; font-size: 15px; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${cur.name}</div>
            <div style="font-size: 12px; color: rgba(255,255,255,0.6); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${cur.artists || 'Unknown Artist'}</div>
          </div>
        </div>

        <button id="opt-share-card" style="display: flex; align-items: center; gap: 14px; padding: 12px 14px; border-radius: 14px; background: rgba(255,255,255,0.05); border: none; color: #fff; font-size: 14px; font-weight: 700; cursor: pointer; text-align: left;">
          <span class="material-symbols-outlined" style="font-size: 22px; color: #ff7675;">share</span>
          <span>Share as High-Res Image Card</span>
        </button>

        <button id="opt-toggle-fav" style="display: flex; align-items: center; gap: 14px; padding: 12px 14px; border-radius: 14px; background: rgba(255,255,255,0.05); border: none; color: #fff; font-size: 14px; font-weight: 700; cursor: pointer; text-align: left;">
          <span class="material-symbols-outlined" style="font-size: 22px; color: #ff5252; font-variation-settings: 'FILL' ${isFav ? 1 : 0};">favorite</span>
          <span>${isFav ? 'Remove from Favorites' : 'Add to Favorites'}</span>
        </button>

        <button id="opt-start-radio" style="display: flex; align-items: center; gap: 14px; padding: 12px 14px; border-radius: 14px; background: rgba(255,255,255,0.05); border: none; color: #fff; font-size: 14px; font-weight: 700; cursor: pointer; text-align: left;">
          <span class="material-symbols-outlined" style="font-size: 22px; color: #74b9ff;">radio</span>
          <span>Start Song Radio Station</span>
        </button>

        <button id="opt-audio-qual" style="display: flex; align-items: center; gap: 14px; padding: 12px 14px; border-radius: 14px; background: rgba(255,255,255,0.05); border: none; color: #fff; font-size: 14px; font-weight: 700; cursor: pointer; text-align: left;">
          <span class="material-symbols-outlined" style="font-size: 22px; color: var(--accent-color, #FA2D48);">headphones</span>
          <span>Audio Quality &amp; Device</span>
        </button>

        <button id="opt-ambience" style="display: flex; align-items: center; gap: 14px; padding: 12px 14px; border-radius: 14px; background: rgba(255,255,255,0.05); border: none; color: #fff; font-size: 14px; font-weight: 700; cursor: pointer; text-align: left;">
          <span class="material-symbols-outlined" style="font-size: 22px; color: #a29bfe;">nature</span>
          <span>Ambience Soundscapes Mixer</span>
        </button>

        <button id="opt-close-sheet" style="margin-top: 8px; padding: 12px; border-radius: 14px; background: rgba(255,255,255,0.1); border: none; color: #fff; font-size: 14px; font-weight: 800; cursor: pointer;">
          Cancel
        </button>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('#opt-share-card').onclick = () => { modal.remove(); shareSongCard(cur); };
    modal.querySelector('#opt-toggle-fav').onclick = () => { modal.remove(); toggleFavoriteCurrent(); };
    modal.querySelector('#opt-start-radio').onclick = () => { modal.remove(); startRadioForSong(cur); };
    modal.querySelector('#opt-audio-qual').onclick = () => { modal.remove(); UI.openAudioQualityModal(); };
    modal.querySelector('#opt-ambience').onclick = () => { modal.remove(); Ambience.openAmbienceModal(); };
    modal.querySelector('#opt-close-sheet').onclick = () => modal.remove();
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

    if (typeof Haptics !== 'undefined' && Haptics.light) Haptics.light();
  }

  async function openExploreCategory(cat) {
    if (cat === 'albums') {
      if (typeof SearchEngine !== 'undefined') SearchEngine.executeSearch('Top Global Albums 2024', 'albums');
    } else if (cat === 'genres') {
      navigateToPage('page-search', true);
      setTimeout(() => {
        const hub = document.getElementById('search-browse-hub');
        if (hub) hub.scrollIntoView({ behavior: 'smooth' });
      }, 150);
    } else if (cat === 'artists') {
      if (typeof SearchEngine !== 'undefined') SearchEngine.executeSearch('Global Top Artists', 'artists');
    }
  }

  async function playDesktopCuratedPlaylist(type) {
    UI.showToast(`Loading ${type} playlist...`, 'info');
    try {
      let query = 'Top 50 Hits';
      if (type === 'electronic') query = 'Electronic Dance EDM Hits';
      if (type === 'rock') query = 'Rock Classics Superhits';
      if (type === 'acoustic') query = 'Lo-Fi Chill Beats & Acoustic';
      const results = await API.searchSongs(query, 1, 20);
      if (results && results.length > 0) {
        Player.setQueue(results, 0);
        await Player.playSong(results[0]);
        UI.showToast(`Playing ${type} playlist`, 'success');
      }
    } catch (e) {
      console.warn('Failed to load desktop curated playlist:', e);
    }
  }

  async function playDesktopTrendingHero() {
    UI.showToast('Starting Featured Hit...', 'info');
    try {
      const results = await API.searchSongs('Happier Than Ever Billie Eilish', 1, 10);
      if (results && results.length > 0) {
        Player.setQueue(results, 0);
        await Player.playSong(results[0]);
      } else {
        await Player.playSong({
          name: 'Happier Than Ever',
          artists: 'Billie Eilish',
          id: 'desktop_hero_billie',
          image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop&q=80',
          audioUrl: 'https://commondatastorage.googleapis.com/codeskulptor-demos/DDR_assets/Sevish_-__Hang_On.mp3'
        });
      }
    } catch (e) {
      console.warn('Error starting hero song:', e);
    }
  }

  window.checkNewReleasesFromFollowed = checkNewReleasesFromFollowed;

  const exportedApp = {
    navigateToPage,
    syncVisualizer,
    renderHistoryPage,
    toggleKaraokeMode,
    renderMostPlayedShelf,
    updateFollowButton,
    toggleFollowArtist,
    toggleFavoriteCurrent,
    openActiveListenersModal,
    openPlayerOptions,
    shareSongCard,
    showMoreLikeThis,
    exportAllData,
    showShortcutsHelp,
    performSearch,
    loadHomePage,
    bindSongCardEvents,
    startRadioForSong,
    openAlbumPage,
    openArtistPage,
    openArtistHighlight,
    openPlaylistPage,
    openExploreCategory,
    playDesktopCuratedPlaylist,
    playDesktopTrendingHero,
    openLyricsOverlay,
    loadLyrics
  };

  window.App = exportedApp;
  return exportedApp;
})();
