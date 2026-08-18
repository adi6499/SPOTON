// ========================================
// MusicFlow — Main App Controller
// ========================================

const App = (() => {
  let currentSearchResults = [];
  let searchDebounceTimer = null;

  async function init() {
    try {
      setupPlayerEvents();
      setupPlayerBarEvents();
      setupSearchEvents();
      setupNavigationEvents();
      setupDelegatedEvents();
      initSettings();

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

      if (miniPlayer) {
        const expandPlayer = (e) => {
          if (e.target.closest('button') || e.target.closest('.mini-player__controls')) return;
          playerContainer.classList.remove('player-minimized');
          playerContainer.classList.add('player-expanded');
        };
        miniPlayer.addEventListener('click', expandPlayer);
      }

      if (minimizeBtn) {
        minimizeBtn.addEventListener('click', () => {
          playerContainer.classList.add('player-minimized');
          playerContainer.classList.remove('player-expanded');
        });
      }

      const lyricsBtn = document.getElementById('btn-full-lyrics');
      const lyricsPanel = document.getElementById('lyrics-panel');
      const artworkImg = document.getElementById('full-player-img');
      if (lyricsBtn && lyricsPanel && artworkImg) {
        lyricsBtn.addEventListener('click', () => {
          const isHidden = lyricsPanel.style.display === 'none';
          lyricsPanel.style.display = isHidden ? 'flex' : 'none';
          artworkImg.style.opacity = isHidden ? '0.2' : '1';
          lyricsBtn.style.opacity = isHidden ? '1' : '0.5';
        });
      }

      // Queue buttons
      document.querySelectorAll('#btn-full-queue, .btn-queue-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
          playerContainer.classList.add('player-minimized');
          playerContainer.classList.remove('player-expanded');
          // Trigger navigation to queue page
          const queueNav = document.querySelector('[data-page="page-queue"]');
          if (queueNav) queueNav.click();
        });
      });
    } catch (e) {
      console.error('[App] Init failed:', e);
    }
  }



  // ---- Player Events ----

  function setupPlayerEvents() {
    // Touch Gestures for Player
    const miniPlayer = document.getElementById('mini-player');
    const playerContainer = document.getElementById('player-container');
    const fullPlayer = document.getElementById('full-player');
    
    let touchStartX = 0;
    let touchStartY = 0;
    let isTransitioning = false;

    if (playerContainer) {
      playerContainer.addEventListener('transitionend', () => {
        isTransitioning = false;
      });
    }

    if (miniPlayer) {
      miniPlayer.addEventListener('touchstart', (e) => {
        if (e.target.closest('button') || isTransitioning) return;
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
      }, { passive: true });

      miniPlayer.addEventListener('touchend', (e) => {
        if (e.target.closest('button') || isTransitioning || touchStartY === 0) return;
        const deltaX = e.changedTouches[0].screenX - touchStartX;
        const deltaY = e.changedTouches[0].screenY - touchStartY;
        
        if (Math.abs(deltaY) > Math.abs(deltaX)) {
          if (deltaY < -30) {
            isTransitioning = true;
            playerContainer.classList.remove('player-minimized');
            playerContainer.classList.add('player-expanded');
            document.body.style.overflow = 'hidden';
          }
        } else {
          if (deltaX < -40) Player.next();
          else if (deltaX > 40) Player.previous();
        }
        
        touchStartX = 0;
        touchStartY = 0;
      }, { passive: true });
    }
    
    if (fullPlayer) {
      let fpTouchStartY = 0;
      fullPlayer.addEventListener('touchstart', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.closest('.modal') || isTransitioning) return;
        fpTouchStartY = e.changedTouches[0].screenY;
      }, { passive: true });
      
      fullPlayer.addEventListener('touchend', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.closest('.modal') || isTransitioning || fpTouchStartY === 0) return;
        const deltaY = e.changedTouches[0].screenY - fpTouchStartY;
        if (deltaY > 50) { // Swipe Down to minimize
          isTransitioning = true;
          playerContainer.classList.remove('player-expanded');
          playerContainer.classList.add('player-minimized');
          document.body.style.overflow = '';
        }
        fpTouchStartY = 0;
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
    });

    Player.on('trackchange', (track) => {
      UI.updatePlayerBar(track);
      
      // Update full player with HD image and dynamic artwork
      if (track && track.image) {
        const hdImage = track.image.replace('150x150', '500x500').replace('50x50', '500x500');
        const fImg = document.getElementById('full-player-img');
        if (fImg) fImg.src = hdImage;
        if (typeof updateDynamicArtwork === 'function') updateDynamicArtwork(hdImage);
      }
      
      const codecEl = document.getElementById('full-player-codec');
      if (codecEl && Player.getStreamCodecDisplay) {
        codecEl.textContent = Player.getStreamCodecDisplay();
      }

      // Refresh favorites view if active
      const favsPage = document.getElementById('page-favorites');
      if (favsPage && favsPage.classList.contains('active')) {
        UI.renderFavorites(document.getElementById('favorites-container'));
      }
    });

    Player.on('error', () => {
      UI.showToast('Playback error. Trying next track...', 'error');
      setTimeout(() => Player.next(), 1500);
    });

    Player.on('queueupdate', () => {
      // Refresh queue view if active
      const queuePage = document.getElementById('page-queue');
      if (queuePage && queuePage.classList.contains('active')) {
        UI.renderQueue(document.getElementById('queue-container'));
        rebindQueueEvents();
      }
    });
  }

  // ---- Search ----

  function setupSearchEvents() {
    const input = document.getElementById('search-input');
    const clearBtn = document.getElementById('search-clear');

    input.addEventListener('focus', () => {
      if (!input.value.trim()) {
        renderSearchHistory();
      }
    });

    input.addEventListener('input', () => {
      const query = input.value.trim();
      clearBtn.classList.toggle('visible', query.length > 0);

      if (!query) {
        renderSearchHistory();
        return;
      }

      clearTimeout(searchDebounceTimer);
      if (query.length >= 2) {
        searchDebounceTimer = setTimeout(() => performSearch(query), 400);
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

    // Focus search on Ctrl+K
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        input.focus();
        input.select();
      }
    });
  }

  function renderSearchHistory() {
    UI.showPage('page-search');
    const container = document.getElementById('search-results');
    const history = Storage.getSearchHistory();

    if (history.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">🔍</div>
          <div class="empty-state__title">Search MusicFlow</div>
          <div class="empty-state__subtitle">Find your favorite songs, artists, and playlists.</div>
        </div>`;
      return;
    }

    let html = '<div class="section-header"><h2 class="section-title">Recent Searches</h2><button class="btn-text" id="btn-clear-history">Clear</button></div>';
    html += '<div class="search-history-list" style="display: flex; flex-wrap: wrap; gap: 8px;">';
    history.forEach(q => {
      html += `<button class="quick-tag" data-query="${q}" style="background: var(--bg-card); padding: 8px 16px; border-radius: var(--radius-full); font-size: var(--font-size-sm);">${q}</button>`;
    });
    html += '</div>';

    container.innerHTML = html;

    const clearBtn = document.getElementById('btn-clear-history');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        Storage.clearSearchHistory();
        renderSearchHistory();
      });
    }

    container.querySelectorAll('.quick-tag').forEach(tag => {
      tag.addEventListener('click', () => {
        const query = tag.dataset.query;
        const input = document.getElementById('search-input');
        input.value = query;
        document.getElementById('search-clear').classList.add('visible');
        performSearch(query);
      });
    });
  }

  async function performSearch(query) {
    UI.showPage('page-search');
    const container = document.getElementById('search-results');
    UI.showLoading(container);

    // Also update nav
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.page === 'page-search');
    });

    try {
      const [results, moreSongs] = await Promise.all([
        API.searchAll(query),
        API.searchSongs(query, 30)
      ]);
      
      // Override limited global search song results with the extended list
      if (results && moreSongs && moreSongs.length > 0) {
        results.songs = { results: moreSongs };
      }
      container.innerHTML = '';
      
      if (!results || Object.keys(results).length === 0) {
        container.innerHTML = '<div class="empty-state">No results found.</div>';
        return;
      }

      // Playlists
      if (results.playlists && results.playlists.results && results.playlists.results.length > 0) {
        const title = document.createElement('h2');
        title.className = 'shelf-title';
        title.textContent = 'Playlists';
        title.style.marginTop = 'var(--space-xl)';
        container.appendChild(title);
        
        const shelf = document.createElement('div');
        shelf.className = 'song-grid';
        container.appendChild(shelf);
        UI.renderShelf(results.playlists.results, shelf, 'playlist');
      }

      // Songs
      if (results.songs && results.songs.results && results.songs.results.length > 0) {
        const title = document.createElement('h2');
        title.className = 'shelf-title';
        title.textContent = 'Songs';
        title.style.marginTop = 'var(--space-xl)';
        container.appendChild(title);

        const shelf = document.createElement('div');
        shelf.className = 'song-list';
        container.appendChild(shelf);
        
        const rawNormSongs = results.songs.results.map(s => API.normalizeSong(s));
        
        // Local Language Filtering
        const prefs = Storage.getSettings().languages || [];
        const normSongs = prefs.length > 0 
          ? rawNormSongs.filter(s => {
              const lang = (s.language || '').toLowerCase();
              return lang === '' || lang === 'unknown' || prefs.includes(lang);
            })
          : rawNormSongs;

        currentSearchResults = normSongs;
        if (normSongs.length === 0) {
           shelf.innerHTML = '<div class="empty-state">No songs found in your preferred languages.</div>';
        } else {
           UI.renderSearchResults(normSongs, shelf);
        }
        bindSongCardEvents(shelf);
      }
      
      // Albums
      if (results.albums && results.albums.results && results.albums.results.length > 0) {
        const title = document.createElement('h2');
        title.className = 'shelf-title';
        title.textContent = 'Albums';
        title.style.marginTop = 'var(--space-xl)';
        container.appendChild(title);
        
        const shelf = document.createElement('div');
        shelf.className = 'song-grid';
        container.appendChild(shelf);
        UI.renderShelf(results.albums.results, shelf, 'album'); 
      }

      // Artists
      if (results.artists && results.artists.results && results.artists.results.length > 0) {
        const title = document.createElement('h2');
        title.className = 'shelf-title';
        title.textContent = 'Artists';
        title.style.marginTop = 'var(--space-xl)';
        container.appendChild(title);
        
        const shelf = document.createElement('div');
        shelf.className = 'song-grid';
        container.appendChild(shelf);
        UI.renderShelf(results.artists.results, shelf, 'artist'); 
      }
    } catch (error) {
      console.error('[App] Search failed:', error);
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">⚠️</div>
          <div class="empty-state__title">Search failed</div>
          <div class="empty-state__subtitle">Please check your connection and try again.</div>
        </div>`;
    }
  }

  // ---- Navigation ----

  function setupNavigationEvents() {
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        const pageId = item.dataset.page;
        UI.showPage(pageId);

        // Load page-specific content
        if (pageId === 'page-favorites') {
          UI.renderFavorites(document.getElementById('favorites-container'));
          bindFavoritesEvents();
        } else if (pageId === 'page-queue') {
          UI.renderQueue(document.getElementById('queue-container'));
          rebindQueueEvents();
        } else if (pageId === 'page-home') {
          loadHomePage();
        }
      });
    });

    // Quick tags
    document.querySelectorAll('.quick-tag').forEach(tag => {
      tag.addEventListener('click', () => {
        const query = tag.dataset.query;
        const input = document.getElementById('search-input');
        input.value = query;
        document.getElementById('search-clear').classList.add('visible');
        performSearch(query);
      });
    });
  }

  // ---- Player Bar Events ----

  function setupPlayerBarEvents() {
    const fullProgress = document.getElementById('full-progress');
    const miniProgress = document.getElementById('mini-progress');
    let isSeeking = false;
    let activeBar = null;

    function attachSeekEvents(bar) {
      if (!bar) return;
      
      bar.addEventListener('mousedown', (e) => {
        isSeeking = true;
        activeBar = bar;
        seekFromEvent(e, bar);
      });
      
      bar.addEventListener('click', (e) => {
        seekFromEvent(e, bar);
      });
      
      bar.addEventListener('touchstart', (e) => {
        isSeeking = true;
        activeBar = bar;
        seekFromTouch(e, bar);
      }, { passive: true });
    }

    attachSeekEvents(fullProgress);
    attachSeekEvents(miniProgress);

    document.addEventListener('mousemove', (e) => {
      if (isSeeking && activeBar) seekFromEvent(e, activeBar);
    });

    document.addEventListener('mouseup', () => {
      isSeeking = false;
      activeBar = null;
    });

    document.addEventListener('touchmove', (e) => {
      if (isSeeking && activeBar) seekFromTouch(e, activeBar);
    }, { passive: true });

    document.addEventListener('touchend', () => {
      isSeeking = false;
      activeBar = null;
    });

    // Volume slider
    const volumeSlider = document.getElementById('volume-slider');
    if (volumeSlider) {
      volumeSlider.addEventListener('input', () => {
        const vol = volumeSlider.value / 100;
        Player.setVolume(vol);
        UI.updateVolumeIcon(vol);
      });
    }
  }

  function seekFromEvent(e, bar) {
    const rect = bar.getBoundingClientRect();
    const percent = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    Player.seekPercent(percent);
  }

  function seekFromTouch(e, bar) {
    const touch = e.touches[0];
    const rect = bar.getBoundingClientRect();
    const percent = Math.max(0, Math.min(100, ((touch.clientX - rect.left) / rect.width) * 100));
    Player.seekPercent(percent);
  }

  // ---- Delegated Click Events ----

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
          Player.setQueue([], -1);
          Player.pause();
          UI.showToast('Queue cleared');
          const qContainer = document.getElementById('queue-container');
          if (qContainer) {
            UI.renderQueue(qContainer);
            rebindQueueEvents();
          }
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
                  navigator.share({ title: song.name, text: `Listen to ${song.name} by ${song.artists || 'Unknown Artist'}`, url: window.location.href }).catch(()=>{});
                } else {
                  navigator.clipboard.writeText(window.location.href);
                  UI.showToast('Link copied to clipboard', 'success');
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

        const song = queue.find(s => s.id === songId);
        if (song) {
          const rect = btn.getBoundingClientRect();
          UI.showContextMenu(rect.left, rect.bottom + 5, [
            { label: 'Play Next', icon: '▶️', onClick: () => { Player.playNext(song); UI.showToast('Added to Play Next'); } },
            { label: 'Add to Queue', icon: '🎵', onClick: () => { Player.addToQueue(song); UI.showToast('Added to Queue'); } },
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
                navigator.share({ title: song.name, text: `Listen to ${song.name} by ${song.artists}`, url: window.location.href })
                  .catch(() => UI.showToast('Failed to share', 'error'));
              } else {
                navigator.clipboard.writeText(window.location.href);
                UI.showToast('Link copied to clipboard', 'success');
              }
            }}
          ]);
        }
      });
    });
  }

  // ---- Home Page ----

  async function loadHomePage() {
    // 1. Greeting
    const greetingEl = document.getElementById('home-greeting');
    if (greetingEl) {
      const hour = new Date().getHours();
      let greeting = 'Good Evening';
      if (hour < 12) greeting = 'Good Morning';
      else if (hour < 17) greeting = 'Good Afternoon';
      greetingEl.textContent = greeting;
    }

    // 2. Show loading for all shelves
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

    // 3. Fetch Data
    const data = await API.getHomeRecommendations();

    // 4. Hero Section
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

    // 5. Render Shelves
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
        // Bind basic click for albums to just console log or toast for now until pages exist
        // Bind click for albums
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

    // 6. Load Recently Played
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
    if (colorSelect) colorSelect.value = settings.color || 'purple';
    
    const toggleGlass = document.getElementById('toggle-glass');
    if (toggleGlass) toggleGlass.checked = settings.glassEffect === true;

    const langCheckboxes = document.querySelectorAll('#settings-languages input[type="checkbox"]');
    const prefs = settings.languages || ['hindi', 'english', 'punjabi'];
    langCheckboxes.forEach(cb => {
      cb.checked = prefs.includes(cb.value);
    });
    
    const qualEl = document.getElementById('select-quality');
    if (qualEl) qualEl.value = settings.audioQuality || '320kbps';
    
    const speedEl = document.getElementById('select-speed');
    if (speedEl) speedEl.value = Player.getPlaybackSpeed();
    
    const eqPresetSelect = document.getElementById('select-eq-preset');
    if (eqPresetSelect) eqPresetSelect.value = settings.eqPreset || 'flat';
    
    const spatialToggle = document.getElementById('toggle-spatial-audio');
    if (spatialToggle) spatialToggle.checked = settings.spatialAudio === true;
    
    const ambientSelect = document.getElementById('select-ambient-sound');
    if (ambientSelect) ambientSelect.value = settings.ambientSound || 'off';

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
      Player.setEqBand(i, savedEQ[i]);
    });
    
    eqContainer.addEventListener('input', (e) => {
      if (e.target.classList.contains('eq-slider')) {
        const idx = parseInt(e.target.dataset.index);
        const val = parseFloat(e.target.value);
        Player.setEqBand(idx, val);
        
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

    document.getElementById('select-quality')?.addEventListener('change', (e) => {
      Storage.updateSettings({ audioQuality: e.target.value });
      UI.showToast(`Audio quality set to ${e.target.value}`);
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
          const details = await API.getPlaylistDetails(id);
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

    const topArtists = Object.entries(stats.artists).sort((a,b)=>b[1]-a[1]).slice(0,3).map(a=>a[0]);
    const topGenres = Object.entries(stats.genres).sort((a,b)=>b[1]-a[1]).slice(0,3).map(a=>a[0]);

    view.innerHTML = `
      <h1 style="margin-bottom:24px; font-size:32px; font-weight:800;">Your Library</h1>
      
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${stats.totalListens}</div>
          <div class="stat-label">Total Songs Played</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${Math.floor(stats.totalTimeMs / 60000)}</div>
          <div class="stat-label">Minutes Listened</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${topArtists[0] || 'None'}</div>
          <div class="stat-label">Top Artist</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${topGenres[0] || 'None'}</div>
          <div class="stat-label">Top Genre</div>
        </div>
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
          { label: 'Open Settings', action: () => document.getElementById('settings-modal').style.display = 'flex' },
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
    const color = settings.color || 'purple';

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
        openArtistPage(artistLink.dataset.name, artistLink.dataset.image);
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
    UI.showToast(`Starting Radio for "${song.name}"...`, 'info');
    
    try {
      const primaryArtist = song.artists ? song.artists.split(',')[0].trim() : '';
      const secondaryArtist = song.artists && song.artists.includes(',') ? song.artists.split(',')[1].trim() : '';
      
      const queryPromises = [
        API.searchSongs(primaryArtist, 15),
        API.searchSongs(song.album || song.name, 15)
      ];

      if (secondaryArtist) {
        queryPromises.push(API.searchSongs(secondaryArtist, 15));
      }
      if (song.language) {
        queryPromises.push(API.searchSongs(`trending ${song.language}`, 15));
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
      const seen = new Set();
      let uniqueSongs = [];
      combinedPool.forEach(s => {
        if (s && s.id && !seen.has(s.id)) {
          seen.add(s.id);
          const norm = API.normalizeSong(s);
          const lang = (norm.language || '').toLowerCase();
          if (prefs.length === 0 || lang === '' || lang === 'unknown' || prefs.includes(lang)) {
            uniqueSongs.push(norm);
          }
        }
      });

      if (uniqueSongs.length > 0) {
        const radioQueue = [...uniqueSongs].sort(() => Math.random() - 0.5);
        const existingIdx = radioQueue.findIndex(s => s.id === song.id);
        if (existingIdx !== -1) {
          radioQueue.splice(existingIdx, 1);
        }
        radioQueue.unshift(song);

        Player.setQueue(radioQueue, 0);
        await Player.playSong(song);
        UI.showToast(`Radio started based on ${song.name}`, 'success');
      } else {
        UI.showToast('Could not load radio mix', 'error');
      }
    } catch (err) {
      console.error('Start radio error:', err);
      UI.showToast('Failed to start radio', 'error');
    }
  }

  // ---- Global Functions for new pages ----
  async function openArtistPage(name, image) {
    UI.showPage('page-artist');
    document.getElementById('btn-minimize-player')?.click();
    
    const imgEl = document.getElementById('artist-page-img');
    const nameEl = document.getElementById('artist-page-name');
    if (nameEl) nameEl.textContent = name;
    if (imgEl) {
      imgEl.src = image || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%231a1a2e" width="100" height="100"/><text x="50" y="55" text-anchor="middle" fill="%236c5ce7" font-size="40">👤</text></svg>';
    }

    const container = document.getElementById('artist-songs-container');
    if (container) {
      container.innerHTML = '<div class="loading-shelf"></div>';
    }

    try {
      const results = await API.searchSongs(name, 30);
      if (container) {
        if (results && results.length > 0) {
          container.innerHTML = '';
          const normSongs = results.map(API.normalizeSong);
          normSongs.slice(0, 15).forEach((song, i) => {
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

          // Bind Start Mix button
          const mixBtn = document.getElementById('btn-artist-mix');
          if (mixBtn) {
            mixBtn.onclick = async () => {
              const shuffled = [...normSongs].sort(() => Math.random() - 0.5);
              Player.setQueue(shuffled, 0);
              await Player.playSong(shuffled[0]);
              UI.showToast(`Starting ${name} Mix`, 'success');
            };
          }
        } else {
          container.innerHTML = '<div class="empty-state">No songs found</div>';
        }
      }
    } catch (err) {
      if (container) container.innerHTML = '<div class="empty-state">Error loading artist</div>';
    }
  }

  async function openAlbumPage(id, name, image) {
    UI.showPage('page-album');
    document.getElementById('btn-minimize-player')?.click();
    
    const imgEl = document.getElementById('album-page-img');
    const nameEl = document.getElementById('album-page-name');
    if (nameEl) nameEl.textContent = name;
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

  async function openPlaylistPage(id, name, image) {
    UI.showPage('page-playlist');
    document.getElementById('btn-minimize-player')?.click();
    
    const imgEl = document.getElementById('playlist-page-img');
    const nameEl = document.getElementById('playlist-page-name');
    if (nameEl) nameEl.textContent = name;
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
        }
      } else if (container) {
        container.innerHTML = '<div class="empty-state">No tracks found</div>';
      }
    } catch (err) {
      if (container) container.innerHTML = '<div class="empty-state">Error loading playlist</div>';
    }
  }

  return { performSearch };
})();
