// ========================================
// MusicFlow — UI Rendering & Interactions
// ========================================

const UI = (() => {
  // ---- Toast Notification System ----

  let activeToast = null;
  let toastTimer = null;
  let lastToastMsg = '';
  let lastToastTime = 0;

  function showToast(message, type = 'info', options = {}) {
    if (!message) return;
    const now = Date.now();
    
    // Deduplicate identical message within 2 seconds
    if (message === lastToastMsg && (now - lastToastTime < 2000)) {
      return;
    }
    lastToastMsg = message;
    lastToastTime = now;

    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }

    if (typeof Haptics !== 'undefined') {
      if (type === 'error' || type === 'warning') Haptics.error();
      else if (type === 'success') Haptics.success();
    }

    // Dismiss existing toast immediately to avoid clutter
    if (activeToast) {
      clearTimeout(toastTimer);
      const old = activeToast;
      old.classList.remove('show');
      setTimeout(() => old.remove(), 220);
      activeToast = null;
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : type === 'warning' ? '⚠' : 'ℹ';
    toast.innerHTML = `
      <span class="toast-icon">${icon}</span>
      <span class="toast-msg">${message}</span>
      ${options.action && options.action.label ? `<button class="toast-action">${options.action.label}</button>` : ''}
    `;

    const actionBtn = toast.querySelector('.toast-action');
    if (actionBtn && options.action && typeof options.action.onClick === 'function') {
      actionBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        options.action.onClick();
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 220);
        if (activeToast === toast) activeToast = null;
      });
    }
    
    toast.style.cursor = 'pointer';
    toast.addEventListener('click', () => {
      if (options.onClick) options.onClick();
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 220);
      if (activeToast === toast) activeToast = null;
    });

    container.appendChild(toast);
    activeToast = toast;
    requestAnimationFrame(() => toast.classList.add('show'));

    const duration = options.duration || (options.action ? 6000 : 2600);
    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        toast.remove();
        if (activeToast === toast) activeToast = null;
      }, 220);
    }, duration);
  }

  // ---- Context Menu System ----

  let activeContextMenu = null;

  function closeContextMenu() {
    if (activeContextMenu) {
      activeContextMenu.remove();
      activeContextMenu = null;
    }
  }

  document.addEventListener('click', closeContextMenu);

  function showContextMenu(x, y, items) {
    closeContextMenu();

    const menu = document.createElement('div');
    menu.className = 'context-menu';
    
    // Position
    menu.style.position = 'fixed';
    menu.style.left = `${Math.min(x, window.innerWidth - 200)}px`;
    menu.style.top = `${Math.min(y, window.innerHeight - (items.length * 40))}px`;
    menu.style.zIndex = '1000';

    items.forEach(item => {
      if (item.type === 'divider') {
        const div = document.createElement('div');
        div.className = 'context-menu-divider';
        menu.appendChild(div);
        return;
      }
      
      const btn = document.createElement('button');
      btn.className = 'context-menu-item';
      btn.innerHTML = `<span class="context-icon">${item.icon}</span> ${item.label}`;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        item.onClick();
        closeContextMenu();
      });
      menu.appendChild(btn);
    });

    document.body.appendChild(menu);
    activeContextMenu = menu;
  }

  // ---- Format Helpers ----

  function formatDuration(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function truncate(text, maxLen = 30) {
    if (!text) return '';
    if (typeof text !== 'string') {
      if (typeof text === 'object') {
        text = text.name || text.title || text.artist || (Array.isArray(text) ? text.map(t => t?.name || t).join(', ') : '') || '';
      } else {
        text = String(text);
      }
    }
    if (text.includes('[object Object]')) return 'Unknown Artist';
    return text.length > maxLen ? text.substring(0, maxLen) + '…' : text;
  }

  // ---- Rendering: Song Cards ----

  function renderSongCard(song, index) {
    const isFav = Storage.isFavorite(song.id);
    const currentTrack = (typeof Player !== 'undefined' && Player.getCurrentTrack) ? Player.getCurrentTrack() : null;
    const isPlaying = currentTrack && currentTrack.id === song.id;
    const rawImg = (window.API && API.getImageUrl) ? API.getImageUrl(song) : (typeof song.image === 'string' ? song.image : '');
    const cleanImg = (typeof rawImg === 'string' && rawImg !== '[object Object]') ? rawImg : '';

    const div = document.createElement('div');
    div.className = `song-card ${isPlaying ? 'playing is-active-track' : ''}`;
    div.dataset.songId = song.id;
    div.dataset.songData = encodeURIComponent(JSON.stringify(song));
    div.innerHTML = `
      <div class="song-card__img-wrap skeleton" data-action="play" data-index="${index}">
        <img class="song-card__img" src="${cleanImg}" alt="${song.name || 'Song'}" loading="lazy" onload="this.classList.add('loaded'); this.parentElement.classList.remove('skeleton');" onerror="this.onerror=null; this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%231a1a2e%22 width=%22100%22 height=%22100%22/><text x=%2250%22 y=%2255%22 text-anchor=%22middle%22 fill=%22%236c5ce7%22 font-size=%2240%22>♪</text></svg>';">
        <div class="song-card__play-overlay">
          <svg class="play-icon" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
        </div>
      </div>
      <div class="song-card__info">
        <div class="song-card__name" title="${song.name}">${truncate(song.name, 28)}</div>
        <div class="song-card__artist" title="${song.artists}">${truncate(song.artists, 32)}</div>
      </div>
      <div class="song-card__actions">
        <button class="btn-icon btn-fav ${isFav ? 'active' : ''}" data-action="fav" title="${isFav ? 'Remove Favorite' : 'Add Favorite'}" aria-label="Toggle favorite">
          <span class="material-symbols-outlined" style="font-size: 19px; font-variation-settings: 'FILL' ${isFav ? 1 : 0}; color: ${isFav ? '#ff2d55' : 'inherit'};">${isFav ? 'favorite' : 'favorite_border'}</span>
        </button>
        <button class="btn-icon btn-queue" data-action="add-queue" title="Add to queue" aria-label="Add to queue">
          <span class="material-symbols-outlined" style="font-size: 19px;">playlist_add</span>
        </button>
        <button class="btn-icon btn-context" data-action="context-menu" title="More options" aria-label="More options">
          <span class="material-symbols-outlined" style="font-size: 19px;">more_vert</span>
        </button>
      </div>
    `;
    return div;
  }

  // ---- Rendering: Album Cards ----

  function renderAlbumCard(album, index) {
    const div = document.createElement('div');
    div.className = 'song-card album-card';
    div.dataset.albumId = album.id;
    const rawImg = (window.API && API.getImageUrl) ? API.getImageUrl(album) : (typeof album.image === 'string' ? album.image : '');
    const cleanImg = (typeof rawImg === 'string' && rawImg !== '[object Object]') ? rawImg : '';
    
    div.innerHTML = `
      <div class="song-card__img-wrap skeleton" data-action="open-album">
        <img class="song-card__img" src="${cleanImg}" alt="${album.title || 'Album'}" loading="lazy" onload="this.classList.add('loaded'); this.parentElement.classList.remove('skeleton');" onerror="this.onerror=null; this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%231a1a2e%22 width=%22100%22 height=%22100%22/><text x=%2250%22 y=%2255%22 text-anchor=%22middle%22 fill=%22%236c5ce7%22 font-size=%2240%22>🎵</text></svg>';">
        <div class="song-card__play-overlay">
          <svg class="play-icon" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
        </div>
      </div>
      <div class="song-card__info">
        <div class="song-card__name" title="${album.title}">${truncate(album.title || album.name, 28)}</div>
        <div class="song-card__artist">${truncate(album.music || album.artist || 'Album', 28)}</div>
      </div>
    `;
    return div;
  }

  function renderPlaylistCard(playlist, index) {
    const div = document.createElement('div');
    div.className = 'song-card playlist-card';
    div.dataset.playlistId = playlist.id;
    const rawImg = (window.API && API.getImageUrl) ? API.getImageUrl(playlist) : (typeof playlist.image === 'string' ? playlist.image : '');
    const cleanImg = (typeof rawImg === 'string' && rawImg !== '[object Object]') ? rawImg : '';
    
    div.innerHTML = `
      <div class="song-card__img-wrap skeleton" data-action="open-playlist">
        <img class="song-card__img" src="${cleanImg}" alt="${playlist.title || 'Playlist'}" loading="lazy" onload="this.classList.add('loaded'); this.parentElement.classList.remove('skeleton');" onerror="this.onerror=null; this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%231a1a2e%22 width=%22100%22 height=%22100%22/><text x=%2250%22 y=%2255%22 text-anchor=%22middle%22 fill=%22%236c5ce7%22 font-size=%2240%22>🎵</text></svg>';">
        <div class="song-card__play-overlay">
          <svg class="play-icon" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
        </div>
      </div>
      <div class="song-card__info">
        <div class="song-card__name" title="${playlist.title}">${truncate(playlist.title || playlist.name, 28)}</div>
        <div class="song-card__artist">${truncate(playlist.subtitle || 'Playlist', 28)}</div>
      </div>
    `;
    return div;
  }

  // ---- Rendering: Artist Cards ----

  function renderArtistCard(artist, index) {
    const div = document.createElement('div');
    div.className = 'song-card artist-card';
    div.dataset.artistId = artist.id;
    const name = artist.name || artist.title || artist.artist || 'Unknown';
    const rawImg = (window.API && API.getImageUrl) ? API.getImageUrl(artist) : (typeof artist.image === 'string' ? artist.image : '');
    const cleanImg = (typeof rawImg === 'string' && rawImg !== '[object Object]') ? rawImg : '';
    
    div.innerHTML = `
      <div class="song-card__img-wrap artist-card__img-wrap skeleton" data-action="open-artist" data-name="${name.replace(/"/g, '&quot;')}" data-image="${cleanImg}">
        <img class="song-card__img" src="${cleanImg}" alt="${name}" loading="lazy" onload="this.classList.add('loaded'); this.parentElement.classList.remove('skeleton');" onerror="this.onerror=null; this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%231a1a2e%22 width=%22100%22 height=%22100%22/><text x=%2250%22 y=%2255%22 text-anchor=%22middle%22 fill=%22%236c5ce7%22 font-size=%2240%22>👤</text></svg>';">
      </div>
      <div class="song-card__info artist-card__info" data-action="open-artist" data-name="${name.replace(/"/g, '&quot;')}" data-image="${cleanImg}">
        <div class="song-card__name" title="${name}">${truncate(name, 28)}</div>
        <div class="song-card__artist">Artist</div>
      </div>
    `;
    return div;
  }

  // ---- Rendering: Song List Item (for queue / favorites) ----

  function renderSongListItem(song, index, options = {}) {
    const isFav = Storage.isFavorite(song.id);
    const currentTrack = (typeof Player !== 'undefined' && Player.getCurrentTrack) ? Player.getCurrentTrack() : null;
    const isCurrent = currentTrack && currentTrack.id === song.id;
    const isActive = options.isActive || isCurrent || false;
    const showRemove = options.showRemove || false;
    const rawImg = (window.API && API.getImageUrl) ? API.getImageUrl(song) : (typeof song.image === 'string' ? song.image : '');
    const cleanImg = (typeof rawImg === 'string' && rawImg !== '[object Object]') ? rawImg : '';

    const div = document.createElement('div');
    div.className = `song-list-item ${isActive ? 'active is-active-track playing' : ''}`;
    div.dataset.songId = song.id;
    div.dataset.songData = encodeURIComponent(JSON.stringify(song));
    div.dataset.index = index;
    div.innerHTML = `
      <div class="song-list-item__num">${isActive ? '<span class="now-playing-indicator"><span></span><span></span><span></span></span>' : index + 1}</div>
      <div class="song-list-item__img-wrap skeleton">
        <img class="song-list-item__img" src="${cleanImg}" alt="" loading="lazy" onload="this.classList.add('loaded'); this.parentElement.classList.remove('skeleton');" onerror="this.onerror=null; this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%231a1a2e%22 width=%22100%22 height=%22100%22/><text x=%2250%22 y=%2255%22 text-anchor=%22middle%22 fill=%22%236c5ce7%22 font-size=%2240%22>♪</text></svg>';">
      </div>
      <div class="song-list-item__info" data-action="play" data-index="${index}">
        <div class="song-list-item__name">${truncate(song.name, 36)}</div>
        <div class="song-list-item__artist">${truncate(song.artists, 40)}</div>
      </div>
      <div class="song-list-item__duration">${formatDuration(song.duration)}</div>
      <div class="song-list-item__actions">
        <button class="btn-icon btn-fav ${isFav ? 'active' : ''}" data-action="fav" title="Favorite" aria-label="Toggle favorite">
          <svg viewBox="0 0 24 24" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
        </button>
        <button class="btn-icon btn-download" data-action="download" title="Download" aria-label="Download">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        </button>
        ${showRemove ? `<button class="btn-icon btn-remove" data-action="remove-queue" data-index="${index}" title="Remove" aria-label="Remove from queue">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>` : ''}
      </div>
    `;
    return div;
  }

  // ---- Rendering: Search Results ----

  function renderSearchResults(songs, container, query = '') {
    container.innerHTML = '';
    if (!songs || songs.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">🔍</div>
          <div class="empty-state__title">No results found</div>
          <div class="empty-state__subtitle">Try a different search term</div>
        </div>`;
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'song-grid';

    songs.forEach((song, i) => {
      const normalized = API.normalizeSong(song);
      const card = renderSongCard(normalized, i);
      if (query && typeof SearchEngine !== 'undefined' && SearchEngine.highlightMatch) {
        const nameEl = card.querySelector('.song-card__name');
        const artistEl = card.querySelector('.song-card__artist');
        if (nameEl) nameEl.innerHTML = SearchEngine.highlightMatch(normalized.name, query);
        if (artistEl) artistEl.innerHTML = SearchEngine.highlightMatch(normalized.artists, query);
      }
      grid.appendChild(card);
    });

    container.appendChild(grid);
  }

  // ---- Rendering: Shelf (Home Page) ----

  function renderShelf(items, container, type = 'song') {
    container.innerHTML = '';
    if (!items || items.length === 0) {
      container.parentElement.style.display = 'none'; // Hide section if empty
      return;
    }

    container.parentElement.style.display = 'block';

    items.forEach((item, i) => {
      let card;
      if (type === 'artist') card = renderArtistCard(item, i);
      else if (type === 'album') card = renderAlbumCard(item, i);
      else if (type === 'playlist') card = renderPlaylistCard(item, i);
      else {
        const normalized = item.raw ? item : API.normalizeSong(item);
        card = renderSongCard(normalized, i);
        // Play click is handled by bindSongCardEvents in app.js
      }
      card.classList.add('song-card--shelf');
      container.appendChild(card);
    });
  }

  // ---- Rendering: Favorites List ----

  async function renderFavorites(container, activeFilter = 'all') {
    if (!container) return;
    const favs = Storage.getFavorites();
    container.innerHTML = '';

    if (favs.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding: 48px 16px; text-align: center;">
          <div class="empty-state__icon" style="font-size: 44px; margin-bottom: 12px;">❤️</div>
          <div class="empty-state__title" style="font-size: 22px; font-weight: 700; color: var(--text-primary);">Your Library is Empty</div>
          <div class="empty-state__subtitle" style="color: var(--text-secondary); font-size: 14px; margin-top: 6px;">Search for songs, albums, and artists and tap the heart icon to build your library.</div>
        </div>`;
      return;
    }

    // 0. Library Header
    const libHeader = document.createElement('div');
    libHeader.className = 'library-header';
    libHeader.innerHTML = `
      <h1 class="library-header-title">Your Library</h1>
      <span class="library-header-badge">${favs.length} ${favs.length === 1 ? 'Song' : 'Songs'}</span>
      ${favs.length > 0 ? `
      <div class="library-header-actions">
        <button class="btn-lib-action" id="btn-fav-play-all" aria-label="Play all favorites">
          <span class="material-symbols-outlined" style="font-size: 18px; font-variation-settings: 'FILL' 1;">play_arrow</span>
          Play All
        </button>
        <button class="btn-lib-action secondary" id="btn-fav-shuffle" aria-label="Shuffle favorites">
          <span class="material-symbols-outlined" style="font-size: 18px;">shuffle</span>
          Shuffle
        </button>
      </div>` : ''}
    `;
    container.appendChild(libHeader);

    // Play All / Shuffle favorites
    const favPlayAllBtn = libHeader.querySelector('#btn-fav-play-all');
    const favShuffleBtn = libHeader.querySelector('#btn-fav-shuffle');
    if (favPlayAllBtn) favPlayAllBtn.addEventListener('click', () => {
      const list = Storage.getFavorites() || [];
      if (!list.length) return;
      Player.setQueue(list, 0);
      Player.playSong(list[0], 0);
      showToast(`Playing ${list.length} favorites`);
    });
    if (favShuffleBtn) favShuffleBtn.addEventListener('click', () => {
      const list = [...(Storage.getFavorites() || [])];
      if (!list.length) return;
      for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
      }
      Player.setQueue(list, 0);
      Player.playSong(list[0], 0);
      showToast(`Shuffling ${list.length} favorites`);
    });

    // 1. Library Filter Chips Bar
    const filterChips = document.createElement('div');
    filterChips.className = 'library-filter-carousel';
    filterChips.style.cssText = 'display: flex; gap: 8px; overflow-x: auto; padding: 4px 0 16px 0; margin-bottom: 12px; scrollbar-width: none;';
    filterChips.innerHTML = `
      <button class="filter-chip ${activeFilter === 'all' ? 'active' : ''}" data-filter="all" style="padding: 6px 16px; border-radius: 999px; font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap;">All (${favs.length})</button>
      <button class="filter-chip ${activeFilter === 'downloaded' ? 'active' : ''}" data-filter="downloaded" style="padding: 6px 16px; border-radius: 999px; font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap;">Downloaded</button>
      <button class="filter-chip ${activeFilter === 'artists' ? 'active' : ''}" data-filter="artists" style="padding: 6px 16px; border-radius: 999px; font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap;">Artists</button>
      <button class="filter-chip" id="btn-lib-history-chip" style="padding: 6px 16px; border-radius: 999px; font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap;">\u{1F553} History</button>
      <button class="filter-chip" id="btn-lib-recap-chip" style="padding: 6px 16px; border-radius: 999px; font-size: 13px; font-weight: 600; background: linear-gradient(135deg, #00f1fe 0%, #3b82f6 100%); color: #000; border: none; cursor: pointer; white-space: nowrap;">✨ Weekly Recap</button>
    `;

    filterChips.querySelectorAll('.filter-chip[data-filter]').forEach(chip => {
      chip.addEventListener('click', () => {
        const filter = chip.dataset.filter;
        renderFavorites(container, filter);
        if (typeof Haptics !== 'undefined' && Haptics.selection) Haptics.selection();
      });
    });

    filterChips.querySelector('#btn-lib-recap-chip')?.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
      UI.showPage('page-recap');
      if (typeof Recap !== 'undefined') Recap.renderRecap(document.getElementById('recap-container'));
      history.pushState({ type: 'page', pageId: 'page-recap' }, '', '#recap');
      if (typeof Haptics !== 'undefined' && Haptics.medium) Haptics.medium();
    });
    container.appendChild(filterChips);

    // ================= VIEW: ARTISTS =================
    if (activeFilter === 'artists') {
      const artistMap = {};
      favs.forEach(song => {
        const artistName = (song.artists || song.artist || 'Unknown').split(',')[0].trim();
        if (!artistMap[artistName]) {
          artistMap[artistName] = { name: artistName, count: 0, image: song.image, songs: [] };
        }
        artistMap[artistName].count++;
        artistMap[artistName].songs.push(song);
      });

      const artistList = Object.values(artistMap).sort((a, b) => b.count - a.count);

      const artistsSection = document.createElement('section');
      artistsSection.style.cssText = 'margin-bottom: 28px;';
      artistsSection.innerHTML = `
        <h2 style="font-family: var(--font-heading); font-size: 22px; font-weight: 800; color: var(--text-primary); margin: 0 0 14px 0;">Artists in Library (${artistList.length})</h2>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 14px;">
          ${artistList.map((art, idx) => `
            <div class="lib-artist-card" data-index="${idx}" style="border-radius: 16px; padding: 16px 12px; display: flex; flex-direction: column; align-items: center; text-align: center; cursor: pointer; transition: transform 0.2s, background 0.2s;">
              <div style="width: 80px; height: 80px; border-radius: 50%; overflow: hidden; margin-bottom: 10px; box-shadow: 0 4px 16px rgba(0,0,0,0.15); border: 2px solid rgba(255,255,255,0.1);">
                <img src="${art.image || 'assets/logo.jpg'}" alt="${art.name}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='assets/logo.jpg'">
              </div>
              <h4 style="font-family: var(--font-heading); font-size: 14px; font-weight: 700; color: var(--text-primary); margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%;">${art.name}</h4>
              <span style="font-size: 12px; color: #ff5167; font-weight: 600; margin-top: 2px;">${art.count} ${art.count === 1 ? 'song' : 'songs'}</span>
            </div>
          `).join('')}
        </div>
      `;

      artistsSection.querySelectorAll('.lib-artist-card').forEach(card => {
        card.addEventListener('click', () => {
          const idx = parseInt(card.dataset.index, 10);
          const art = artistList[idx];
          if (art && art.songs.length > 0) {
            Player.setQueue(art.songs, 0);
            Player.playSong(art.songs[0]);
            UI.showToast(`Playing ${art.name}`, 'info');
          }
        });
      });

      container.appendChild(artistsSection);
      return;
    }

    // ================= VIEW: DOWNLOADED =================
    if (activeFilter === 'downloaded') {
      const dlSection = document.createElement('section');
      dlSection.id = 'library-smart-downloads';
      dlSection.style.cssText = 'margin-top: 12px;';
      container.appendChild(dlSection);
      renderSmartDownloadsList(dlSection);
      return;
    }

    // ================= VIEW: ALL (DEFAULT) =================

    // 2. Music Recap Gradient Banner
    const recapBanner = document.createElement('div');
    recapBanner.className = 'recap-summary-banner';
    recapBanner.style.cssText = 'background: linear-gradient(135deg, #ff2d55 0%, #ec4899 100%); border-radius: 16px; padding: 18px 20px; display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; cursor: pointer; box-shadow: 0 8px 24px rgba(236, 72, 153, 0.25);';
    recapBanner.innerHTML = `
      <div>
        <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: rgba(255,255,255,0.85); margin-bottom: 2px;">Your Music Story</div>
        <h2 style="font-family: var(--font-heading); font-size: 20px; font-weight: 800; color: #fff; margin: 0;">Weekly Listening Recap</h2>
        <p style="font-size: 13px; color: rgba(255,255,255,0.9); margin: 3px 0 0 0;">View stats, 7-day chart & top artists</p>
      </div>
      <div style="width: 40px; height: 40px; border-radius: 50%; background: rgba(255, 255, 255, 0.2); backdrop-filter: blur(10px); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
        <span class="material-symbols-outlined" style="font-size: 22px; color: #fff;">arrow_forward</span>
      </div>
    `;
    recapBanner.onclick = () => {
      document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
      UI.showPage('page-recap');
      if (typeof Recap !== 'undefined') Recap.renderRecap(document.getElementById('recap-container'));
      history.pushState({ type: 'page', pageId: 'page-recap' }, '', '#recap');
    };
    container.appendChild(recapBanner);

    const recentlyAdded = [...favs].reverse().slice(0, 4);

    // 3. Recently Added (Stitch 2-Column Responsive Grid)
    if (recentlyAdded.length > 0) {
      const recentSection = document.createElement('section');
      recentSection.style.cssText = 'margin-bottom: 28px;';
      recentSection.innerHTML = `
        <h2 style="font-family: var(--font-heading); font-size: 22px; font-weight: 800; color: var(--text-primary); margin: 0 0 14px 0;">Recently Added</h2>
        <div class="recently-added-grid"></div>
      `;
      const gridEl = recentSection.querySelector('.recently-added-grid');
      recentlyAdded.forEach((song) => {
        const originalIndex = favs.findIndex(s => s.id === song.id);
        const card = document.createElement('div');
        card.className = 'library-card';
        card.dataset.songId = song.id;
        card.innerHTML = `
          <div class="library-card__art-wrap">
            <img alt="${song.name}" class="library-card__img" src="${song.image || 'assets/logo.jpg'}" onerror="this.src='assets/logo.jpg'">
            <div class="library-card__play-btn" title="Play">
              <span class="material-symbols-outlined" style="font-size: 20px; font-variation-settings: 'FILL' 1; margin-left: 2px;">play_arrow</span>
            </div>
          </div>
          <div class="library-card__info">
            <h3 class="library-card__title">${song.name}</h3>
            <p class="library-card__artist">${song.artists || song.artist}</p>
          </div>
        `;

        card.addEventListener('click', () => {
          Player.setQueue(favs, originalIndex);
          Player.playSong(favs[originalIndex]);
        });

        gridEl.appendChild(card);
      });
      container.appendChild(recentSection);
    }

    // 4. All Saved Songs List
    const songsSection = document.createElement('section');
    songsSection.style.cssText = 'margin-bottom: 28px;';
    songsSection.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <h2 style="font-family: var(--font-heading); font-size: 22px; font-weight: 800; color: var(--text-primary); margin: 0;">All Songs</h2>
        <span style="font-family: var(--font-mono, monospace); font-size: 12px; color: var(--text-secondary);">${favs.length} tracks</span>
      </div>
      <div id="favs-full-list" style="display: flex; flex-direction: column; gap: 6px;"></div>
    `;
    const fullListEl = songsSection.querySelector('#favs-full-list');
    favs.forEach((song, idx) => {
      const row = document.createElement('div');
      row.className = 'library-song-row';
      row.dataset.songId = song.id;
      row.dataset.index = idx;
      row.innerHTML = `
        <span class="library-song-index">${idx + 1}</span>
        <img alt="${song.name}" class="library-song-img" src="${song.image || 'assets/logo.jpg'}" onerror="this.src='assets/logo.jpg'">
        <div class="library-song-info">
          <h3 class="library-song-title">${song.name}</h3>
          <p class="library-song-artist">${song.artists || song.artist}</p>
        </div>
        <div class="library-song-actions">
          <button class="btn-icon" data-action="fav" title="Favorite" style="color: #ff2d55; background: none; border: none; cursor: pointer; padding: 6px; display: flex; align-items: center;">
            <span class="material-symbols-outlined" style="font-size: 20px; font-variation-settings: 'FILL' 1;">favorite</span>
          </button>
          <button class="btn-icon" data-action="download" title="Smart Download" style="color: #9ca3af; background: none; border: none; cursor: pointer; padding: 6px; display: flex; align-items: center;">
            <span class="material-symbols-outlined" style="font-size: 20px;">download</span>
          </button>
        </div>
      `;

      row.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        Player.setQueue(favs, idx);
        Player.playSong(favs[idx]);
      });

      row.querySelector('[data-action="fav"]')?.addEventListener('click', (e) => {
        e.stopPropagation();
        Storage.removeFavorite(song.id);
        renderFavorites(container, activeFilter);
        UI.showToast(`Removed from favorites`, 'info');
      });

      row.querySelector('[data-action="download"]')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (typeof SmartDownloads !== 'undefined') {
          await SmartDownloads.downloadSong(song);
          UI.showToast(`Downloaded "${song.name}" for offline play`, 'success');
          const dlContainer = document.getElementById('library-smart-downloads');
          if (dlContainer) renderSmartDownloadsList(dlContainer);
        }
      });

      fullListEl.appendChild(row);
    });
    container.appendChild(songsSection);

    // 5. Smart Downloads Section
    const dlSection = document.createElement('section');
    dlSection.id = 'library-smart-downloads';
    dlSection.style.cssText = 'margin-top: 12px;';
    container.appendChild(dlSection);
    renderSmartDownloadsList(dlSection);
  }

  // ---- Rendering: Queue ----

  function renderQueue(container) {
    const queue = Player.getQueue();
    const currentIdx = Player.getCurrentIndex();
    container.innerHTML = '';

    if (queue.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">🎵</div>
          <div class="empty-state__title">Queue is empty</div>
          <div class="empty-state__subtitle">Search for songs and add them to your queue</div>
        </div>`;
      return;
    }

    container.style.paddingBottom = 'calc(140px + env(safe-area-inset-bottom, 20px))';

    const header = document.createElement('div');
    header.className = 'section-header';
    header.innerHTML = `
      <h2 class="section-title">Play Queue</h2>
      <div class="section-actions">
        <span class="section-count">${queue.length} songs</span>
        <button class="btn-text" id="btn-save-playlist">Save as Playlist</button>
        <button class="btn-text" id="btn-clear-queue">Clear All</button>
      </div>
    `;
    container.appendChild(header);

    const list = document.createElement('div');
    list.className = 'song-list queue-sortable-list';
    list.style.position = 'relative';

    queue.forEach((song, i) => {
      const el = renderSongListItem(song, i, {
        isActive: i === currentIdx,
        showRemove: true,
      });
      el.style.cursor = 'pointer';
      
      // Inject Drag Handle with touchAction: none only on handle
      const dragHandle = document.createElement('div');
      dragHandle.className = 'drag-handle';
      dragHandle.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>';
      dragHandle.style.cursor = 'grab';
      dragHandle.style.padding = '10px';
      dragHandle.style.opacity = '0.5';
      dragHandle.style.touchAction = 'none';
      el.insertBefore(dragHandle, el.firstChild);

      // Direct item click -> plays exactly this queue track index
      el.addEventListener('click', async (e) => {
        if (e.target.closest('.btn-icon') || e.target.closest('.drag-handle')) return;
        await Player.playAtIndex(i);
        renderQueue(container);
      });

      // Favorite toggle button
      const favBtn = el.querySelector('[data-action="fav"]');
      if (favBtn) {
        favBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const isFav = Storage.toggleFavorite(song);
          favBtn.classList.toggle('active', isFav);
          const svg = favBtn.querySelector('svg');
          if (svg) svg.setAttribute('fill', isFav ? 'currentColor' : 'none');
          showToast(isFav ? 'Added to favorites ❤️' : 'Removed from favorites', isFav ? 'success' : 'info');
        });
      }

      // Download button
      const dlBtn = el.querySelector('[data-action="download"]');
      if (dlBtn) {
        dlBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (typeof Download !== 'undefined' && Download.downloadSong) {
            Download.downloadSong(song);
          }
        });
      }

      // Remove from queue button
      const rmBtn = el.querySelector('[data-action="remove-queue"]');
      if (rmBtn) {
        rmBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          Player.removeFromQueue(i);
          renderQueue(container);
          showToast('Removed from queue', 'info');
        });
      }

      list.appendChild(el);
    });
    container.appendChild(list);

    // ---- Pointer Event Drag Reordering ----
    let draggingEl = null;
    let placeholder = null;
    let startY = 0;
    let startTop = 0;
    let originalIndex = -1;

    list.addEventListener('pointerdown', (e) => {
      if (!e.target.closest('.drag-handle')) return;
      
      draggingEl = e.target.closest('.song-list-item');
      if (!draggingEl) return;
      
      e.preventDefault(); // Prevent text selection
      draggingEl.setPointerCapture(e.pointerId);

      originalIndex = Array.from(list.children).indexOf(draggingEl);
      
      // Create placeholder
      placeholder = document.createElement('div');
      placeholder.className = 'song-list-item placeholder';
      placeholder.style.height = `${draggingEl.offsetHeight}px`;
      placeholder.style.background = 'rgba(255,255,255,0.05)';
      placeholder.style.border = '1px dashed var(--border)';
      placeholder.style.borderRadius = 'var(--radius-sm)';
      
      // Set fixed positioning for dragged element
      const rect = draggingEl.getBoundingClientRect();
      startY = e.clientY;
      startTop = rect.top;
      
      draggingEl.style.position = 'fixed';
      draggingEl.style.top = `${startTop}px`;
      draggingEl.style.left = `${rect.left}px`;
      draggingEl.style.width = `${rect.width}px`;
      draggingEl.style.zIndex = '1000';
      draggingEl.style.boxShadow = '0 10px 30px rgba(0,0,0,0.5)';
      draggingEl.style.transition = 'none';
      
      list.insertBefore(placeholder, draggingEl.nextSibling);
    });

    list.addEventListener('pointermove', (e) => {
      if (!draggingEl) return;
      
      const deltaY = e.clientY - startY;
      draggingEl.style.top = `${startTop + deltaY}px`;
      
      // Find where to place the placeholder
      const siblings = Array.from(list.children).filter(el => el !== draggingEl && el !== placeholder);
      let nextSibling = siblings.find(sib => {
        const rect = sib.getBoundingClientRect();
        return e.clientY < rect.top + rect.height / 2;
      });
      
      if (nextSibling) {
        list.insertBefore(placeholder, nextSibling);
      } else {
        list.appendChild(placeholder);
      }
    });

    list.addEventListener('pointerup', (e) => {
      if (!draggingEl) return;
      draggingEl.releasePointerCapture(e.pointerId);
      
      // Reset styles
      draggingEl.style.position = '';
      draggingEl.style.top = '';
      draggingEl.style.left = '';
      draggingEl.style.width = '';
      draggingEl.style.zIndex = '';
      draggingEl.style.boxShadow = '';
      draggingEl.style.transition = '';
      
      // Swap elements
      list.insertBefore(draggingEl, placeholder);
      placeholder.remove();
      
      const newIndex = Array.from(list.children).indexOf(draggingEl);
      draggingEl = null;
      placeholder = null;
      
      if (newIndex !== originalIndex && newIndex !== -1) {
        const state = Player.getState();
        const q = [...state.queue];
        const movedItem = q.splice(originalIndex, 1)[0];
        q.splice(newIndex, 0, movedItem);
        
        let newCurrentIndex = state.currentIndex;
        if (originalIndex === state.currentIndex) {
          newCurrentIndex = newIndex;
        } else if (originalIndex < state.currentIndex && newIndex >= state.currentIndex) {
          newCurrentIndex--;
        } else if (originalIndex > state.currentIndex && newIndex <= state.currentIndex) {
          newCurrentIndex++;
        }
        
        Player.setQueue(q, newCurrentIndex);
      }
    });

    // ---- Load More Endless Songs Button ----
    const loadMoreWrap = document.createElement('div');
    loadMoreWrap.style.padding = '0 8px';
    const loadMoreBtn = document.createElement('button');
    loadMoreBtn.className = 'btn-queue-load-more';
    loadMoreBtn.innerHTML = `
      <span class="material-symbols-outlined" style="font-size: 20px;">auto_awesome</span>
      <span>Load More Songs (+20 Recommendations)</span>
    `;
    loadMoreBtn.onclick = async () => {
      loadMoreBtn.disabled = true;
      loadMoreBtn.innerHTML = `
        <span class="spinner" style="width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; display: inline-block; animation: spin 0.8s linear infinite;"></span>
        <span>Finding Best Tracks...</span>
      `;
      try {
        const curQueue = Player.getQueue();
        const curTrack = Player.getCurrentTrack() || curQueue[curQueue.length - 1];
        let query = 'trending hits';
        if (curTrack) {
          query = curTrack.artists ? curTrack.artists.split(',')[0].trim() : (curTrack.name || 'trending');
        }
        const newTracks = await API.searchSongs(query, 20);
        if (newTracks && newTracks.length > 0) {
          const existingIds = new Set(curQueue.map(s => s.id));
          const normalizedNew = newTracks
            .map(t => API.normalizeSong(t))
            .filter(t => t && t.id && !existingIds.has(t.id));
          
          if (normalizedNew.length > 0) {
            const expandedQueue = [...curQueue, ...normalizedNew];
            Player.setQueue(expandedQueue, Player.getCurrentIndex());
            renderQueue(container);
            UI.showToast(`Added ${normalizedNew.length} more songs to queue! 🎵`, 'success');
            if (typeof Haptics !== 'undefined') Haptics.success();
            return;
          }
        }
        UI.showToast('No more unique songs found for this station', 'info');
      } catch (e) {
        console.error(e);
        UI.showToast('Failed to load more songs', 'warning');
      } finally {
        loadMoreBtn.disabled = false;
        loadMoreBtn.innerHTML = `
          <span class="material-symbols-outlined" style="font-size: 20px;">auto_awesome</span>
          <span>Load More Songs (+20 Recommendations)</span>
        `;
      }
    };
    loadMoreWrap.appendChild(loadMoreBtn);
    container.appendChild(loadMoreWrap);
  }

  // ---- Rendering: Recently Played ----

  function renderRecent(container) {
    const history = Storage.getRecent();
    container.innerHTML = '';

    if (history.length === 0) return;

    history.slice(0, 15).forEach((song, i) => {
      const card = renderSongCard(song, i);
      card.onclick = (e) => {
        if (e.target.closest('button')) return;
        Player.setQueue(history, i);
        Player.playSong(history[i]);
      };
      container.appendChild(card);
    });
  }

  // ---- Full Player 3D Queue Cards Swiper ----
  let fullPlayerSwiper = null;
  let isProgrammaticPlayerSlide = false;
  let isUserSwipingPlayer = false;
  let _lastRenderedQueueHash = '';

  function updatePlayerCardsDeck(queue, currentIndex = 0, forceRebuild = false) {
    const swiperWrapper = document.getElementById('player-cards-swiper-wrapper');
    if (!swiperWrapper) return;

    const list = Array.isArray(queue) && queue.length > 0 
      ? queue 
      : (typeof Player !== 'undefined' && (Player.getCurrentTrack ? Player.getCurrentTrack() : Player.getCurrentSong()) ? [(Player.getCurrentTrack ? Player.getCurrentTrack() : Player.getCurrentSong())] : []);
    if (list.length === 0) return;

    const validIndex = Math.max(0, Math.min(currentIndex, list.length - 1));
    const currentQueueHash = list.map(s => s.id || `${s.name}_${s.artists}`).join('|');

    // If swiper already initialized with same queue and not forced, just sync index
    if (!forceRebuild && fullPlayerSwiper && !fullPlayerSwiper.destroyed && _lastRenderedQueueHash === currentQueueHash && swiperWrapper.children.length === list.length) {
      if (!isUserSwipingPlayer) {
        syncPlayerCardsSlide(validIndex);
      }
      return;
    }

    _lastRenderedQueueHash = currentQueueHash;

    // Build clean square rounded slides for 3D player cards swiper
    swiperWrapper.innerHTML = list.map((song, idx) => {
      const img = (window.API && API.getImageUrl) ? API.getImageUrl(song) : (song?.image || 'assets/logo.png');
      const highRes = (window.API && API.getHighResImage) ? API.getHighResImage(img) : (img || 'assets/logo.png');
      const name = song?.name || song?.title || 'Track';
      const isCurrent = idx === validIndex;
      return `
        <div class="swiper-slide player-card-slide" data-index="${idx}">
          <img class="minimal-art-img" ${isCurrent ? 'id="full-player-img"' : ''} src="${highRes}" alt="${name}" onerror="this.src='assets/logo.png'">
        </div>
      `;
    }).join('');

    if (typeof Swiper !== 'undefined') {
      try {
        if (fullPlayerSwiper) {
          fullPlayerSwiper.destroy(true, true);
        }
        const isMobileDevice = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
        fullPlayerSwiper = new Swiper('#player-cards-swiper', {
          effect: 'cards',
          grabCursor: true,
          initialSlide: validIndex,
          speed: 260,
          cardsEffect: {
            slideShadows: !isMobileDevice,
            rotate: true,
            perSlideRotate: 2.5,
            perSlideOffset: 8
          },
          touchRatio: 1.0,
          resistanceRatio: 0.85,
          threshold: 5,
          observer: true,
          observeParents: true,
          on: {
            touchStart: function() {
              isUserSwipingPlayer = true;
            },
            touchEnd: function() {
              setTimeout(() => {
                isUserSwipingPlayer = false;
              }, 300);
            },
            slideChange: function() {
              if (isProgrammaticPlayerSlide) return;
              const newIndex = typeof this.realIndex === 'number' ? this.realIndex : this.activeIndex;
              if (newIndex >= 0 && newIndex < list.length && typeof Player !== 'undefined') {
                const curIdx = typeof Player.getQueueIndex === 'function' ? Player.getQueueIndex() : (Player.getCurrentIndex ? Player.getCurrentIndex() : -1);
                if (newIndex !== curIdx) {
                  if (typeof Haptics !== 'undefined' && Haptics.selection) Haptics.selection();
                  if (typeof Player.playAtIndex === 'function') {
                    Player.playAtIndex(newIndex);
                  } else if (typeof Player.playSong === 'function') {
                    Player.playSong(list[newIndex]);
                  }
                }
              }
            }
          }
        });
      } catch (e) {
        console.warn('Player Swiper error:', e);
      }
    }
  }

  function refreshPlayerCardsDeck() {
    if (typeof Player !== 'undefined') {
      const q = Player.getQueue ? Player.getQueue() : [];
      const idx = Player.getQueueIndex ? Player.getQueueIndex() : 0;
      updatePlayerCardsDeck(q, idx, false);
      if (fullPlayerSwiper && !fullPlayerSwiper.destroyed) {
        try {
          fullPlayerSwiper.update();
          fullPlayerSwiper.slideTo(idx, 0);
        } catch (_) {}
      }
    }
  }

  function syncPlayerCardsSlide(index) {
    if (!fullPlayerSwiper || fullPlayerSwiper.destroyed) return;
    if (isUserSwipingPlayer) return;
    const curSwiperIdx = typeof fullPlayerSwiper.realIndex === 'number' ? fullPlayerSwiper.realIndex : fullPlayerSwiper.activeIndex;
    if (curSwiperIdx === index) return;
    try {
      isProgrammaticPlayerSlide = true;
      fullPlayerSwiper.slideTo(index, 300);
      setTimeout(() => {
        isProgrammaticPlayerSlide = false;
      }, 320);
    } catch (_) {
      isProgrammaticPlayerSlide = false;
    }
  }

  // ---- Player Bar ----

  function updatePlayerBar(track) {
    const bar = document.getElementById('player-container');
    if (!bar) return;

    const activeTrack = track || (typeof Player !== 'undefined' && Player.getCurrentTrack ? Player.getCurrentTrack() : null);

    if (!activeTrack || !activeTrack.id || activeTrack.name === 'Not Playing') {
      const qLen = (typeof Player !== 'undefined' && Player.getQueue) ? Player.getQueue().length : 0;
      if (qLen === 0) {
        document.body.classList.remove('has-player');
        bar.style.display = 'none';
        return;
      }
    }

    bar.style.display = 'block';
    document.body.classList.add('has-player');

    // Mini Player
    const mImg = document.getElementById('mini-player-img');
    const mName = document.getElementById('mini-player-name');
    const mArtist = document.getElementById('mini-player-artist');

    // Full Player
    const fImg = document.getElementById('full-player-img');
    const fName = document.getElementById('full-player-name');
    const fArtist = document.getElementById('full-player-artist');

    const cleanImg = (window.API && API.getImageUrl) ? API.getImageUrl(track) : (typeof track.image === 'string' ? track.image : '');
    const highResImg = (window.API && API.getHighResImage) ? API.getHighResImage(cleanImg) : (cleanImg || 'assets/logo.jpg');

    if (mImg) mImg.src = cleanImg || 'assets/logo.jpg';
    if (mName) mName.textContent = track.name || 'Unknown';
    if (fImg) fImg.src = highResImg || 'assets/logo.jpg';
    if (fName) fName.textContent = track.name || 'Unknown';

    const renderArtistChips = (container, artistsInput, trackImg) => {
      if (!container) return;
      
      let artistsText = '';
      if (typeof artistsInput === 'string') {
        artistsText = artistsInput;
      } else if (Array.isArray(artistsInput)) {
        artistsText = artistsInput.map(a => {
          if (typeof a === 'string') return a;
          if (typeof a === 'object' && a !== null) return a.name || a.title || a.artist || '';
          return '';
        }).filter(Boolean).join(', ');
      } else if (typeof artistsInput === 'object' && artistsInput !== null) {
        artistsText = artistsInput.name || artistsInput.title || artistsInput.artist || '';
      }

      let imgUrl = trackImg;
      if (typeof imgUrl === 'object' && imgUrl !== null) {
        imgUrl = (window.API && API.getImageUrl) ? API.getImageUrl(imgUrl) : (imgUrl.url || imgUrl.link || imgUrl.image || '');
      }
      if (typeof imgUrl !== 'string' || imgUrl === '[object Object]') {
        imgUrl = '';
      }

      if (!artistsText || artistsText === 'Unknown' || artistsText === '-' || artistsText === '[object Object]') {
        container.textContent = (artistsText && artistsText !== '[object Object]') ? artistsText : 'Unknown';
        return;
      }

      container.innerHTML = '';
      const list = artistsText.split(/[,/&]+/).map(a => a.trim()).filter(Boolean);
      list.forEach((artName, idx) => {
        if (!artName || artName === '[object Object]') return;
        const span = document.createElement('span');
        span.className = 'clickable-artist-link';
        span.textContent = artName;
        span.title = `View artist: ${artName}`;
        span.onclick = (e) => {
          e.stopPropagation();
          if (window.openArtistPage) {
            window.openArtistPage(artName, imgUrl);
          }
        };
        container.appendChild(span);
        if (idx < list.length - 1) {
          container.appendChild(document.createTextNode(', '));
        }
      });
    };

    // Mini-player artist is plain text so tapping the mini player expands the player without redirecting
    if (mArtist) {
      let mArtStr = 'Artist';
      if (typeof track.artists === 'string') mArtStr = track.artists;
      else if (Array.isArray(track.artists)) mArtStr = track.artists.map(a => typeof a === 'string' ? a : (a.name || '')).filter(Boolean).join(', ');
      mArtist.textContent = mArtStr || 'Artist';
    }
    renderArtistChips(fArtist, track.artists, highResImg || track.image);

    // Minimalist Spotify-style Player Artist Pill & Live Listeners
    const minAvatar = document.getElementById('minimal-artist-avatar');
    const minName = document.getElementById('minimal-artist-name');
    const minListeners = document.getElementById('minimal-listener-count');
    const followBtn = document.getElementById('btn-player-follow');

    let primaryArtist = 'Artist';
    if (typeof track.artists === 'string' && track.artists) {
      primaryArtist = track.artists.split(/[,/&]+/)[0].trim();
    } else if (Array.isArray(track.artists) && track.artists.length > 0) {
      primaryArtist = track.artists[0]?.name || track.artists[0] || 'Artist';
    }
    if (minName) minName.textContent = primaryArtist;
    if (minAvatar) minAvatar.src = highResImg || cleanImg || 'assets/logo.png';
    if (minListeners) {
      const base = Math.abs((track.name || 'Song').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 850) + 120;
      minListeners.textContent = base.toLocaleString();
    }
    if (followBtn) {
      const followed = (window.Storage && Storage.isArtistFollowed) ? Storage.isArtistFollowed(primaryArtist) : false;
      followBtn.textContent = followed ? 'Following' : 'Follow';
      followBtn.classList.toggle('following', followed);
    }

    // Highlight currently active track across all cards and list items in DOM
    document.querySelectorAll('.song-card, .song-list-item, .quick-pick-item, .video-search-card, .search-top-result-card').forEach(el => {
      if (el.dataset.songId === track.id) {
        el.classList.add('playing', 'is-active-track');
      } else {
        el.classList.remove('playing', 'is-active-track');
      }
    });

    const isFav = Storage.isFavorite(track.id);
    document.querySelectorAll('.full-player .btn-fav, .mini-player .btn-fav, #full-player .btn-fav, [data-action="fav-current"]').forEach(btn => {
      btn.classList.toggle('active', isFav);
      btn.classList.toggle('favorited', isFav);
      btn.innerHTML = `<span class="material-symbols-outlined" style="font-size: 26px; ${isFav ? 'color: #ff4757; font-variation-settings: \'FILL\' 1;' : ''}">${isFav ? 'favorite' : 'favorite_border'}</span>`;
    });

    updateDynamicBackground(track.image);

    // Update Full Player 3D Queue Cards Deck
    if (typeof Player !== 'undefined') {
      const queue = Player.getQueue ? Player.getQueue() : [];
      const currentIdx = Player.getQueueIndex ? Player.getQueueIndex() : 0;
      if (queue.length > 0) {
        if (!fullPlayerSwiper || fullPlayerSwiper.slides?.length !== queue.length) {
          updatePlayerCardsDeck(queue, currentIdx);
        } else {
          syncPlayerCardsSlide(currentIdx);
        }
      }
    }
  }

  function updatePlayPauseButton(isPlaying) {
    document.body.classList.toggle('is-playing', isPlaying);
    const pc = document.getElementById('player-container');
    if (pc) pc.classList.toggle('is-playing', isPlaying);

    document.querySelectorAll('.btn-play, .neu-btn-hero-play, .neu-btn-play-mini, [data-action="toggle-play"]').forEach(btn => {
      const isHero = btn.classList.contains('neu-btn-hero-play');
      const isMini = btn.classList.contains('neu-btn-play-mini');
      const fontSize = isHero ? '38px' : (isMini ? '24px' : '32px');
      btn.innerHTML = isPlaying 
        ? `<span class="material-symbols-outlined" style="font-size: ${fontSize}; font-variation-settings: 'FILL' 1;">pause</span>`
        : `<span class="material-symbols-outlined" style="font-size: ${fontSize}; font-variation-settings: 'FILL' 1;">play_arrow</span>`;
    });
  }

  function updateProgress(data) {
    if (window.isSeeking) return;
    const mFill = document.getElementById('mini-progress-fill');
    const mEdge = document.getElementById('mini-progress-edge');
    const fFill = document.getElementById('full-progress-fill');
    const fThumb = document.getElementById('full-progress-thumb');
    const radialBar = document.getElementById('radial-progress-bar');
    
    const tCurr = document.getElementById('time-current');
    const tTot = document.getElementById('time-total');
    
    const mtCurr = document.getElementById('mini-time-current');
    const mtTot = document.getElementById('mini-time-total');

    if (data.progress !== undefined) {
      if (mFill) mFill.style.width = `${data.progress}%`;
      if (mEdge) mEdge.style.transform = `scaleX(${(data.progress / 100).toFixed(4)})`;
      if (fFill) fFill.style.width = `${data.progress}%`;

      if (radialBar) {
        const circumference = 791.68; // 2 * PI * 126
        const offset = circumference - (data.progress / 100) * circumference;
        radialBar.style.strokeDasharray = `${circumference}`;
        radialBar.style.strokeDashoffset = `${offset}`;
      }
    }

    if (data.currentTime !== undefined) {
      const formatted = formatDuration(data.currentTime);
      if (tCurr) tCurr.textContent = formatted;
      if (mtCurr) mtCurr.textContent = formatted;
    }
    
    if (data.duration !== undefined) {
      const formatted = formatDuration(data.duration);
      if (tTot) tTot.textContent = formatted;
      if (mtTot) mtTot.textContent = formatted;
    }
  }

  function updateRepeatButton(mode) {
    const btn = document.querySelector('[data-action="repeat"]');
    if (!btn) return;
    btn.classList.toggle('active', mode !== 'off');
    if (mode === 'one') {
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg><span class="repeat-one-badge">1</span>';
    } else {
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>';
    }
  }

  function updateShuffleButton(active) {
    const btn = document.querySelector('[data-action="shuffle"]');
    if (btn) btn.classList.toggle('active', active);
  }

  function updateVolumeIcon(volume) {
    const iconHtml = volume === 0
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>'
      : (volume < 0.5
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>');

    document.querySelectorAll('[data-action="volume-toggle"]').forEach(btn => {
      btn.innerHTML = iconHtml;
    });

    document.querySelectorAll('.volume-slider').forEach(slider => {
      if (document.activeElement !== slider) {
        slider.value = Math.round(volume * 100);
      }
    });
  }

  // ---- Dynamic Background (Spotify Ambient Color Glow) ----

  function extractDominantColor(imageInput, callback) {
    if (!imageInput) return fallbackColor('', callback);
    
    let imageUrl = imageInput;
    if (typeof imageUrl === 'object' && imageUrl !== null) {
      imageUrl = (window.API && API.getImageUrl) ? API.getImageUrl(imageUrl) : (imageUrl.url || imageUrl.link || imageUrl.image || '');
    }
    if (!imageUrl || typeof imageUrl !== 'string' || imageUrl.includes('[object Object]')) {
      return fallbackColor(imageUrl, callback);
    }

    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 40;
        canvas.height = 40;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, 40, 40);
        const data = ctx.getImageData(0, 0, 40, 40).data;
        
        const buckets = [];
        
        for (let i = 0; i < data.length; i += 4) {
          const red = data[i], green = data[i + 1], blue = data[i + 2], alpha = data[i + 3];
          if (alpha < 140) continue;
          
          const max = Math.max(red, green, blue) / 255;
          const min = Math.min(red, green, blue) / 255;
          const chroma = max - min;
          const l = (max + min) / 2;
          
          // Skip pure black, pure white, and pure neutral grays
          if (l < 0.12 || l > 0.94 || chroma < 0.14) continue;
          
          let h = 0;
          if (chroma > 0) {
            if (max === red / 255) h = ((green / 255 - blue / 255) / chroma) % 6;
            else if (max === green / 255) h = (blue / 255 - red / 255) / chroma + 2;
            else h = (red / 255 - green / 255) / chroma + 4;
            h = Math.round(h * 60);
            if (h < 0) h += 360;
          }
          
          const s = chroma / (1 - Math.abs(2 * l - 1) + 1e-4);
          // High score for vivid, saturated, medium-lightness colors
          const score = (chroma * 4.5) + (1 - Math.abs(l - 0.52) * 1.5);
          
          buckets.push({ h, s, l, r: red, g: green, b: blue, score });
        }
        
        if (buckets.length > 0) {
          buckets.sort((a, b) => b.score - a.score);
          const best = buckets[0];
          
          // Find vibrant secondary color with distinct hue (at least 35 deg apart)
          let second = buckets.find(b => Math.abs(b.h - best.h) > 35 && Math.abs(b.h - best.h) < 325) || buckets[Math.min(buckets.length - 1, 8)];
          
          function hsl2rgb(h, s, l) {
            const c = (1 - Math.abs(2 * l - 1)) * s;
            const x = c * (1 - Math.abs((h / 60) % 2 - 1));
            const m = l - c / 2;
            let r1 = 0, g1 = 0, b1 = 0;
            if (h < 60) { r1 = c; g1 = x; }
            else if (h < 120) { r1 = x; g1 = c; }
            else if (h < 180) { g1 = c; b1 = x; }
            else if (h < 240) { g1 = x; b1 = c; }
            else if (h < 300) { r1 = x; b1 = c; }
            else { r1 = c; b1 = x; }
            return [Math.round((r1 + m) * 255), Math.round((g1 + m) * 255), Math.round((b1 + m) * 255)];
          }
          
          const [domR, domG, domB] = hsl2rgb(best.h, Math.max(0.72, best.s), 0.54);
          const [secR, secG, secB] = hsl2rgb(second ? second.h : (best.h + 45) % 360, Math.max(0.78, second ? second.s : 0.8), 0.58);
          const [triR, triG, triB] = hsl2rgb((best.h + 85) % 360, 0.85, 0.52);
          
          callback(domR, domG, domB, secR, secG, secB, triR, triG, triB);
          return;
        }
      } catch (e) {}
      fallbackColor(imageUrl, callback);
    };
    img.onerror = () => fallbackColor(imageUrl, callback);
    img.src = imageUrl;
  }

  function fallbackColor(str, callback) {
    const text = (typeof str === 'string' && str && !str.includes('[object Object]')) ? str : 'musicflow_color_seed';
    let hash = 0;
    for (let i = 0; i < text.length; i++) hash = text.charCodeAt(i) + ((hash << 5) - hash);
    const hue = Math.abs(hash % 360);
    const hue2 = (hue + 45) % 360;
    const hue3 = (hue + 90) % 360;
    
    function hslToRgb(h, s, l) {
      const c = (1 - Math.abs(2 * l - 1)) * s;
      const x = c * (1 - Math.abs((h / 60) % 2 - 1));
      const m = l - c / 2;
      let r1 = 0, g1 = 0, b1 = 0;
      if (h < 60) { r1 = c; g1 = x; }
      else if (h < 120) { r1 = x; g1 = c; }
      else if (h < 180) { g1 = c; b1 = x; }
      else if (h < 240) { g1 = x; b1 = c; }
      else if (h < 300) { r1 = x; b1 = c; }
      else { r1 = c; b1 = x; }
      return [Math.round((r1 + m) * 255), Math.round((g1 + m) * 255), Math.round((b1 + m) * 255)];
    }
    
    const [r, g, b] = hslToRgb(hue, 0.85, 0.52);
    const [r2, g2, b2] = hslToRgb(hue2, 0.88, 0.56);
    const [r3, g3, b3] = hslToRgb(hue3, 0.90, 0.50);
    callback(r, g, b, r2, g2, b2, r3, g3, b3);
  }

  function updateDynamicBackground(input) {
    if (!input) return;
    let imageUrl = input;
    if (typeof imageUrl === 'object' && imageUrl !== null) {
      imageUrl = (window.API && API.getImageUrl) ? API.getImageUrl(imageUrl) : (imageUrl.url || imageUrl.link || imageUrl.image || '');
    }
    if (!imageUrl || typeof imageUrl !== 'string' || imageUrl.includes('[object Object]')) {
      imageUrl = 'assets/logo.jpg';
    }
    extractDominantColor(imageUrl, (r, g, b, r2, g2, b2, r3, g3, b3) => {
      const secR = r2 ?? r;
      const secG = g2 ?? g;
      const secB = b2 ?? b;
      const triR = r3 ?? Math.min(255, Math.round(r * 0.7 + 50));
      const triG = g3 ?? Math.min(255, Math.round(g * 0.5 + 40));
      const triB = b3 ?? Math.min(255, Math.round(b * 1.3));

      document.documentElement.style.setProperty('--dynamic-color', `rgba(${r}, ${g}, ${b}, 0.65)`);
      document.documentElement.style.setProperty('--dynamic-color-sec', `rgba(${secR}, ${secG}, ${secB}, 0.5)`);
      document.documentElement.style.setProperty('--dynamic-color-tri', `rgba(${triR}, ${triG}, ${triB}, 0.4)`);
      document.documentElement.style.setProperty('--dynamic-color-dim', `rgba(${r}, ${g}, ${b}, 0.2)`);
      document.documentElement.style.setProperty('--dynamic-rgb', `${r}, ${g}, ${b}`);
      document.documentElement.style.setProperty('--dynamic-rgb-sec', `${secR}, ${secG}, ${secB}`);
      document.documentElement.style.setProperty('--dynamic-rgb-tri', `${triR}, ${triG}, ${triB}`);
      
      const bg = document.getElementById('dynamic-bg');
      if (bg) {
        bg.style.background = 'none';
      }
    });
  }

  // ---- Loading States ----

  function showGlobalLoader() {
    const loader = document.getElementById('app-loader');
    if (loader) loader.classList.add('is-loading');
  }

  function hideGlobalLoader() {
    const loader = document.getElementById('app-loader');
    if (loader) loader.classList.remove('is-loading');
  }

  function showLoading(container, type = 'card') {
    if (!container) return;
    if (type === 'card' || type === 'album' || type === 'song') {
      container.innerHTML = `
        <div class="loading-grid">
          ${Array(8).fill('<div class="skeleton-card"><div class="skeleton skeleton-img"></div><div class="skeleton skeleton-text"></div><div class="skeleton skeleton-text short"></div></div>').join('')}
        </div>`;
    } else if (type === 'artist') {
      container.innerHTML = `
        <div class="loading-grid">
          ${Array(8).fill('<div class="skeleton-card"><div class="skeleton skeleton-img" style="border-radius:50%;"></div><div class="skeleton skeleton-text" style="margin: 0 auto;"></div></div>').join('')}
        </div>`;
    } else if (type === 'list' || type === 'queue' || type === 'favorites') {
      container.innerHTML = `
        <div class="loading-list">
          ${Array(7).fill('<div class="skeleton-list-item"><div class="skeleton skeleton-list-img"></div><div style="flex:1;"><div class="skeleton skeleton-text" style="margin-bottom:6px;"></div><div class="skeleton skeleton-text short"></div></div></div>').join('')}
        </div>`;
    } else if (type === 'grid') {
      container.innerHTML = `
        <div class="loading-grid-wrap">
          ${Array(10).fill('<div class="skeleton-card" style="width:100%;"><div class="skeleton skeleton-img"></div><div class="skeleton skeleton-text"></div><div class="skeleton skeleton-text short"></div></div>').join('')}
        </div>`;
    }
  }

  function hideLoading(container) {
    if (!container) return;
    const loading = container.querySelector('.loading-grid, .loading-list, .loading-grid-wrap, .loading-shelf');
    if (loading) loading.remove();
  }

  // ---- Page Navigation ----

  function showPage(pageId) {
    showGlobalLoader();
    setTimeout(hideGlobalLoader, 350);

    document.querySelectorAll('.page').forEach(p => {
      p.classList.remove('active');
    });
    const page = document.getElementById(pageId);
    if (page) {
      page.classList.add('active');
      page.scrollTop = 0;
    }

    // Update nav
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.page === pageId);
    });
  }

  function renderSidebarPlaylists() {
    const container = document.getElementById('sidebar-playlists');
    if (!container) return;
    const playlists = Storage.getPlaylists() || [];
    container.innerHTML = playlists.map(p => `
      <button class="nav-item" data-page="playlist-${p.id}" onclick="window.location.hash='playlist/${p.id}'" style="padding: 4px 8px; border-radius: 4px; font-size: 14px; opacity: 0.8; margin-bottom: 2px;">
        <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${p.name}</span>
      </button>
    `).join('');
  }

  // ---- Phase 1: Mood & Activity Chips Carousel ----

  function renderMoodChips(container, activeMood = 'all') {
    if (!container || typeof Moods === 'undefined') return;
    const moods = Moods.getMoodList();
    container.innerHTML = moods.map(m => `
      <button class="filter-chip mood-chip ${m.id === activeMood ? 'active' : ''}" data-mood="${m.id}" aria-label="${m.label} mood">
        <span class="filter-chip__icon">${m.icon}</span>
        <span class="filter-chip__label">${m.label}</span>
      </button>
    `).join('');

    container.querySelectorAll('.mood-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const moodId = btn.dataset.mood;
        if (typeof Moods !== 'undefined' && Moods.setMood) {
          Moods.setMood(moodId);
        }
      });
    });
  }

  function updateMoodChipsActive(activeMood) {
    const chips = document.querySelectorAll('.mood-chip');
    chips.forEach(chip => {
      chip.classList.toggle('active', chip.dataset.mood === activeMood);
    });
  }

  // ---- Phase 1: Quick Picks 4x4 Multi-Row Grid ----

  function renderQuickPicks(songs, container) {
    if (!container) return;
    container.innerHTML = '';
    if (!songs || songs.length === 0) {
      container.parentElement.style.display = 'none';
      return;
    }
    container.parentElement.style.display = 'block';

    const normSongs = songs.map(API.normalizeSong);

    // Group into columns of 4 songs (up to 4 columns = 16 songs)
    const columns = [];
    for (let i = 0; i < Math.min(normSongs.length, 16); i += 4) {
      columns.push(normSongs.slice(i, i + 4));
    }

    const scrollWrap = document.createElement('div');
    scrollWrap.className = 'quick-picks-carousel';

    columns.forEach(col => {
      const colDiv = document.createElement('div');
      colDiv.className = 'quick-picks-column';

      col.forEach(song => {
        const currentTrack = (typeof Player !== 'undefined' && Player.getCurrentTrack) ? Player.getCurrentTrack() : null;
        const isPlaying = currentTrack && currentTrack.id === song.id;

        const item = document.createElement('div');
        item.className = `quick-pick-item ${isPlaying ? 'playing is-active-track' : ''}`;
        item.dataset.songId = song.id;
        item.dataset.songData = encodeURIComponent(JSON.stringify(song));
        item.innerHTML = `
          <div class="quick-pick-item__thumb-wrap skeleton">
            <img class="quick-pick-item__img" src="${song.image || ''}" alt="${song.name}" loading="lazy" onload="this.classList.add('loaded'); this.parentElement.classList.remove('skeleton');" onerror="this.onerror=null; this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%231a1a2e%22 width=%22100%22 height=%22100%22/><text x=%2250%22 y=%2255%22 text-anchor=%22middle%22 fill=%22%236c5ce7%22 font-size=%2240%22>♪</text></svg>';">
            <div class="quick-pick-item__play-overlay">
              ${isPlaying ? `
                <div class="quick-pick-item__eq-bars">
                  <span class="eq-bar eq-bar-1"></span>
                  <span class="eq-bar eq-bar-2"></span>
                  <span class="eq-bar eq-bar-3"></span>
                </div>
              ` : `<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="6,4 18,12 6,20"/></svg>`}
            </div>
          </div>
          <div class="quick-pick-item__info">
            <div class="quick-pick-item__name">${truncate(song.name, 30)}</div>
            <div class="quick-pick-item__artist">${truncate(song.artists || song.artist, 32)}</div>
          </div>
          <button class="quick-pick-item__radio-btn btn-icon" title="Start Radio" aria-label="Start Radio from track">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"/></svg>
          </button>
        `;

        // Direct click on entire card starts playback immediately
        item.addEventListener('click', async (e) => {
          if (e.target.closest('.quick-pick-item__radio-btn')) {
            e.stopPropagation();
            if (window.App && window.App.startRadioForSong) {
              window.App.startRadioForSong(song);
            } else {
              Player.playSong(song);
            }
            return;
          }

          const norm = (window.API && API.normalizeSong) ? API.normalizeSong(song) : { ...song };
          const songIndex = normSongs.findIndex(s => s.id === norm.id);
          if (songIndex !== -1) {
            Player.setQueue(normSongs, songIndex);
          } else {
            Player.setQueue([norm], 0);
          }
          await Player.playSong(norm);

          // Background radio expansion if supported
          if (window.App && window.App.startRadioForSong) {
            window.App.startRadioForSong(norm);
          }
        });

        colDiv.appendChild(item);
      });

      scrollWrap.appendChild(colDiv);
    });

    container.appendChild(scrollWrap);
  }

  // ---- Phase 1: Personalized Mix Suite Shelf ----

  function renderMixSuiteShelf(mixes, container) {
    if (!container) return;
    container.innerHTML = '';
    if (!mixes || mixes.length === 0) {
      container.parentElement.style.display = 'none';
      return;
    }
    container.parentElement.style.display = 'block';

    mixes.forEach(mix => {
      const card = document.createElement('div');
      card.className = 'mix-card';
      card.dataset.mixId = mix.id;
      card.innerHTML = `
        <div class="mix-card__cover" style="background: ${mix.gradient};">
          <div class="mix-card__vinyl-ring"></div>
          <div class="mix-card__badge">${mix.badge || 'Mix'}</div>
          <div class="mix-card__icon">${mix.icon || '🎵'}</div>
          <div class="mix-card__play-btn" title="Play ${mix.title}">
            <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="6,4 18,12 6,20"/></svg>
          </div>
        </div>
        <div class="mix-card__info">
          <div class="mix-card__title">${mix.title}</div>
          <div class="mix-card__subtitle">${mix.subtitle}</div>
        </div>
      `;

      card.addEventListener('click', () => {
        if (typeof MixSuite !== 'undefined' && MixSuite.openMixPage) {
          MixSuite.openMixPage(mix.id);
        }
      });

      const playBtn = card.querySelector('.mix-card__play-btn');
      if (playBtn) {
        playBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (typeof MixSuite !== 'undefined' && MixSuite.playMix) {
            MixSuite.playMix(mix.id);
          }
        });
      }

      container.appendChild(card);
    });
  }

  // ---- Phase 1: Regional Language Category Chips ----

  function renderLanguageChips(container) {
    if (!container || typeof LanguageHubs === 'undefined') return;
    const languages = LanguageHubs.getLanguages();
    container.innerHTML = languages.map(lang => `
      <button class="filter-chip language-chip" data-lang="${lang.id}" style="--chip-gradient: ${lang.gradient};">
        <span class="language-chip__icon">${lang.icon}</span>
        <span class="language-chip__name">${lang.name}</span>
        <span class="language-chip__script">${lang.script}</span>
      </button>
    `).join('');

    container.querySelectorAll('.language-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const langId = btn.dataset.lang;
        if (typeof LanguageHubs !== 'undefined' && LanguageHubs.openLanguageHub) {
          LanguageHubs.openLanguageHub(langId);
        }
      });
    });
  }

  // ---- Skiper48 3D Swiper Cards Carousel ----
  let cardsSwiperInstance = null;

  function render3DCardsCarousel(songs) {
    const swiperWrapper = document.getElementById('home-cards-swiper-wrapper');
    const deckSection = document.getElementById('cards-deck-section');
    if (!swiperWrapper || !deckSection) return;

    if (!songs || songs.length === 0) {
      deckSection.style.display = 'none';
      return;
    }
    deckSection.style.display = 'block';

    const normalizedSongs = songs.slice(0, 20).map(s => (window.API && API.normalizeSong) ? API.normalizeSong(s) : s);

    swiperWrapper.innerHTML = normalizedSongs.map((song, idx) => {
      const img = song.image || 'assets/logo.png';
      const name = typeof truncate === 'function' ? truncate(song.name, 22) : song.name;
      const artist = typeof truncate === 'function' ? truncate(song.artists || song.artist || 'Trending Artist', 24) : (song.artists || song.artist || 'Trending');
      return `
        <div class="swiper-slide card-deck-slide" data-index="${idx}">
          <img class="card-deck-img" src="${img}" alt="${name}" onerror="this.src='assets/logo.png'">
          <div class="card-deck-overlay">
            <div class="card-deck-top-badge">#${idx + 1} Trending</div>
            <div class="card-deck-bottom-pill">
              <div class="card-deck-info">
                <h4 class="card-deck-name">${name}</h4>
                <p class="card-deck-artist">${artist}</p>
              </div>
              <button class="card-deck-play-btn" data-index="${idx}" aria-label="Play ${name}" title="Play Now">
                <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">play_arrow</span>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Delegated click handler on the swiper container so original AND looped/duplicated slides play seamlessly
    const swiperContainer = document.getElementById('home-cards-swiper');
    if (swiperContainer) {
      swiperContainer.onclick = async (e) => {
        const slide = e.target.closest('.card-deck-slide');
        if (!slide) return;
        const idx = parseInt(slide.dataset.index, 10);
        if (isNaN(idx) || !normalizedSongs[idx]) return;
        const song = normalizedSongs[idx];
        if (typeof Haptics !== 'undefined' && Haptics.light) Haptics.light();
        Player.setQueue(normalizedSongs, idx);
        await Player.playSong(song);
      };
    }

    // Initialize Swiper with True Endless Loop
    if (typeof Swiper !== 'undefined') {
      try {
        if (cardsSwiperInstance) {
          cardsSwiperInstance.destroy(true, true);
        }
        const isMobileDevice = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
        cardsSwiperInstance = new Swiper('#home-cards-swiper', {
          effect: 'cards',
          grabCursor: true,
          loop: normalizedSongs.length > 2,
          loopAdditionalSlides: 2,
          cardsEffect: {
            slideShadows: !isMobileDevice,
            rotate: true,
            perSlideRotate: 2.5,
            perSlideOffset: 8
          },
          autoplay: isMobileDevice ? false : {
            delay: 4500,
            disableOnInteraction: true,
            pauseOnMouseEnter: true
          },
          navigation: {
            nextEl: '.swiper-cards-next',
            prevEl: '.swiper-cards-prev'
          }
        });
      } catch (err) {
        console.warn('Swiper init error:', err);
      }
    }
  }

  // ---- Phase 2: Public Playlists Shelf ----

  function renderPublicPlaylistsShelf(playlists, container) {
    if (!container) return;
    container.innerHTML = '';
    if (!playlists || playlists.length === 0) {
      container.parentElement.style.display = 'none';
      return;
    }
    container.parentElement.style.display = 'block';

    playlists.forEach(pl => {
      const card = document.createElement('div');
      card.className = 'mix-card public-playlist-card';
      card.dataset.id = pl.id;
      card.innerHTML = `
        <div class="mix-card__cover" style="background: ${pl.coverGradient};">
          <div class="mix-card__vinyl-ring"></div>
          <div class="mix-card__badge">Public</div>
          <div class="mix-card__icon">${pl.icon || '🌍'}</div>
          <div class="mix-card__play-btn" title="Play ${pl.title}">
            <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="6,4 18,12 6,20"/></svg>
          </div>
        </div>
        <div class="mix-card__info">
          <div class="mix-card__title">${pl.title}</div>
          <div class="mix-card__subtitle">${pl.description}</div>
        </div>
      `;

      card.addEventListener('click', () => {
        if (typeof PlaylistSharing !== 'undefined' && PlaylistSharing.openPublicPlaylist) {
          PlaylistSharing.openPublicPlaylist(pl.id);
        }
      });

      const playBtn = card.querySelector('.mix-card__play-btn');
      if (playBtn) {
        playBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (typeof PlaylistSharing !== 'undefined' && PlaylistSharing.openPublicPlaylist) {
            PlaylistSharing.openPublicPlaylist(pl.id);
          }
        });
      }

      container.appendChild(card);
    });
  }

  // ---- Contextual & Situational Lifestyle Hubs (Office, Home, Workout, Drive, Sleep, Party) ----

  const LIFESTYLE_HUBS = [
    {
      id: 'office',
      title: 'Office & Deep Focus',
      tagline: 'Lo-Fi coding, study & work flow',
      icon: '💼',
      badge: 'FOCUS & CODING',
      gradient: 'linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)',
      queries: ['Lofi Beats', 'Study Beats', 'Deep Focus']
    },
    {
      id: 'home',
      title: 'Home & Cozy Lounge',
      tagline: 'Warm acoustic, dinner & evening chill',
      icon: '🏡',
      badge: 'CHILLOUT & RELAX',
      gradient: 'linear-gradient(135deg, #833ab4 0%, #fd1d1d 50%, #fcb045 100%)',
      queries: ['Acoustic Chill', 'Chill Hits', 'Cozy Acoustic']
    },
    {
      id: 'workout',
      title: 'Workout & Gym Beast',
      tagline: 'Phonk, high BPM cardio & EDM bangers',
      icon: '⚡',
      badge: 'HIGH ENERGY PUMP',
      gradient: 'linear-gradient(135deg, #f12711 0%, #f5af19 100%)',
      queries: ['Workout Hits', 'Gym Workout', 'Phonk']
    },
    {
      id: 'drive',
      title: 'Drive & Highway Sunset',
      tagline: 'Road trip anthems & night synthwave',
      icon: '🚗',
      badge: 'ROAD TRIP HITS',
      gradient: 'linear-gradient(135deg, #2b5876 0%, #4e4376 100%)',
      queries: ['Road Trip', 'Highway Drive', 'Synthwave']
    },
    {
      id: 'sleep',
      title: 'Sleep & Night Wind-Down',
      tagline: 'Binaural delta waves, rain & soft piano',
      icon: '🌙',
      badge: 'MEDITATE & REST',
      gradient: 'linear-gradient(135deg, #141e30 0%, #243b55 100%)',
      queries: ['Peaceful Piano', 'Sleep Relax', 'Meditation']
    },
    {
      id: 'party',
      title: 'Party & Weekend Dance',
      tagline: 'Dancefloor chartbusters & club grooves',
      icon: '🎉',
      badge: 'WEEKEND PARTY',
      gradient: 'linear-gradient(135deg, #ff0844 0%, #ffb199 100%)',
      queries: ['Party Hits', 'Bollywood Dance', 'Club Hits']
    }
  ];

  function renderLifestyleHubs(container) {
    if (!container) return;
    container.innerHTML = '';

    LIFESTYLE_HUBS.forEach(hub => {
      const card = document.createElement('div');
      card.className = 'lifestyle-hub-card';
      card.dataset.hubId = hub.id;
      card.innerHTML = `
        <div class="lifestyle-hub-card__bg" style="background: ${hub.gradient};"></div>
        <div class="lifestyle-hub-card__content">
          <div class="lifestyle-hub-card__top">
            <span class="lifestyle-hub-card__badge">${hub.badge}</span>
            <span class="lifestyle-hub-card__icon">${hub.icon}</span>
          </div>
          <div class="lifestyle-hub-card__bottom">
            <h3 class="lifestyle-hub-card__title">${hub.title}</h3>
            <p class="lifestyle-hub-card__tagline">${hub.tagline}</p>
          </div>
          <button class="lifestyle-hub-card__play-btn" title="Start ${hub.title} Station" aria-label="Play ${hub.title}">
            <span class="material-symbols-outlined" style="font-size: 24px; font-variation-settings: 'FILL' 1;">play_arrow</span>
          </button>
        </div>
      `;

      const launchStation = async (e) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        if (typeof Haptics !== 'undefined' && Haptics.medium) Haptics.medium();
        UI.showToast(`Launching ${hub.title} Station... 🎵`, 'info');

        try {
          let foundTracks = [];
          for (const q of hub.queries) {
            try {
              const res = await API.searchSongs(q, 20);
              if (res && Array.isArray(res) && res.length > 0) {
                foundTracks = foundTracks.concat(res);
                if (foundTracks.length >= 20) break;
              }
            } catch (_) {}
          }

          if (foundTracks.length > 0) {
            const normalized = foundTracks.map(t => API.normalizeSong(t)).filter(t => t && t.id);
            if (normalized.length > 0) {
              const seen = new Set();
              const uniqueTracks = normalized.filter(t => {
                if (seen.has(t.id)) return false;
                seen.add(t.id);
                return true;
              });

              Player.setQueue(uniqueTracks, 0);
              await Player.playSong(uniqueTracks[0]);
              if (window.App && window.App.startRadioForSong) {
                window.App.startRadioForSong(uniqueTracks[0]);
              }
              return;
            }
          }
          UI.showToast(`Unable to load ${hub.title} tracks`, 'warning');
        } catch (err) {
          console.error(err);
          UI.showToast(`Failed to launch ${hub.title}`, 'error');
        }
      };

      card.addEventListener('click', launchStation);
      const playBtn = card.querySelector('.lifestyle-hub-card__play-btn');
      if (playBtn) playBtn.addEventListener('click', launchStation);

      container.appendChild(card);
    });
  }

  // ---- Phase 2: Smart Downloads List & Storage Manager ----

  async function renderSmartDownloadsList(container) {
    if (!container || typeof SmartDownloads === 'undefined') return;
    container.innerHTML = '<div class="loading-shelf shimmer-card" style="height: 120px; border-radius: 16px;"></div>';

    const songs = await SmartDownloads.getAllDownloadedSongs();
    const stats = await SmartDownloads.getStorageUsage();

    container.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 16px;">
        <div style="width: 32px; height: 32px; border-radius: 8px; background: linear-gradient(135deg, #ff2d55 0%, #9333ea 100%); display: flex; align-items: center; justify-content: center; color: #fff; flex-shrink: 0;">
          <span class="material-symbols-outlined" style="font-size: 18px;">download</span>
        </div>
        <h2 style="font-family: var(--font-heading); font-size: 20px; font-weight: 800; color: var(--text-primary); margin: 0;">Smart Downloads (Offline)</h2>
      </div>

      <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 18px 20px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 14px; box-shadow: var(--shadow-sm);">
        <div style="display: flex; gap: 20px; align-items: center;">
          <div style="display: flex; flex-direction: column;">
            <span style="font-family: var(--font-heading); color: var(--text-primary); font-weight: 800; font-size: 20px; line-height: 1;">${stats.count}</span>
            <span style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;">Songs Cached</span>
          </div>
          <div style="width: 1px; height: 28px; background: var(--border);"></div>
          <div style="display: flex; flex-direction: column;">
            <span style="font-family: var(--font-mono, monospace); color: #ff5167; font-weight: 800; font-size: 20px; line-height: 1;">${stats.totalMB} MB</span>
            <span style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;">Offline Storage</span>
          </div>
        </div>
        <button id="btn-clear-all-downloads" style="background: var(--bg-input); border: 1px solid var(--border); color: var(--text-primary); font-size: 12px; font-weight: 600; padding: 8px 16px; border-radius: 999px; display: flex; align-items: center; gap: 6px; cursor: pointer; transition: background 0.2s;">
          <span class="material-symbols-outlined" style="font-size: 16px; color: #ff5167;">delete</span>
          <span>Clear Storage</span>
        </button>
      </div>

      <div id="smart-downloads-list-items" style="display: flex; flex-direction: column; gap: 6px;"></div>
    `;

    document.getElementById('btn-clear-all-downloads')?.addEventListener('click', async () => {
      if (confirm('Clear all downloaded offline music?')) {
        await SmartDownloads.clearAllDownloads();
        renderSmartDownloadsList(container);
        showToast('Offline cache cleared', 'info');
      }
    });

    const listEl = container.querySelector('#smart-downloads-list-items');
    if (songs.length === 0) {
      listEl.innerHTML = `
        <div class="p-6 text-center text-gray-400 text-sm border border-white/5 rounded-2xl">
          No downloaded songs yet. Songs you favorite are automatically cached for offline listening!
        </div>
      `;
      return;
    }

    songs.forEach((song, i) => {
      const row = document.createElement('div');
      row.className = 'library-song-row';
      row.dataset.songId = song.id;
      row.dataset.index = i;
      row.innerHTML = `
        <span class="library-song-index">${i + 1}</span>
        <img alt="${song.name}" class="library-song-img" src="${song.image || 'assets/logo.jpg'}" onerror="this.src='assets/logo.jpg'">
        <div class="library-song-info">
          <h3 class="library-song-title">${song.name}</h3>
          <p class="library-song-artist">${song.artists || song.artist}</p>
        </div>
        <div class="library-song-actions">
          <button class="btn-icon p-1" style="color: #ff2d55; background: none; border: none; cursor: pointer;" title="Favorite">
            <span class="material-symbols-outlined text-xl" style="font-variation-settings: 'FILL' 1;">favorite</span>
          </button>
          <button class="btn-icon p-1" style="color: #ff2d55; background: none; border: none; cursor: pointer;" title="Offline Ready">
            <span class="material-symbols-outlined text-xl" style="font-variation-settings: 'FILL' 1;">check_circle</span>
          </button>
        </div>
      `;

      row.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        Player.setQueue(songs, i);
        Player.playSong(songs[i]);
      });

      listEl.appendChild(row);
    });
  }

  // ---- Audio Quality Quick Picker Modal ----

  function updateCodecBadgeStyle(codecEl, quality) {
    if (!codecEl) return;
    const qual = quality || (typeof Storage !== 'undefined' ? Storage.getSettings().audioQuality : '320kbps') || '320kbps';
    codecEl.classList.remove('badge-hi-res', 'badge-lossless', 'badge-hq', 'badge-standard');

    if (['hi-res-192', 'hi-res-96', 'hi-res-48'].includes(qual)) {
      codecEl.classList.add('badge-hi-res');
    } else if (qual === 'lossless') {
      codecEl.classList.add('badge-lossless');
    } else if (qual === '320kbps' || qual === '256kbps' || qual === 'auto') {
      codecEl.classList.add('badge-hq');
    } else {
      codecEl.classList.add('badge-standard');
    }
  }

  function openAudioQualityModal() {
    const modal = document.getElementById('audio-quality-modal');
    if (!modal) return;

    const currentQuality = (typeof Storage !== 'undefined' ? Storage.getSettings().audioQuality : '320kbps') || '320kbps';
    const container = document.getElementById('quality-options-container');

    const QUALITIES = [
      { id: 'hi-res-192', name: 'Hi-Res Lossless — 24-bit / 192 kHz', desc: 'Studio master quality up to 9216 kbps (DAC recommended)', icon: '🌟', badge: 'HI-RES 24/192', color: '#00cec9' },
      { id: 'hi-res-96', name: 'Hi-Res Lossless — 24-bit / 96 kHz', desc: 'Ultra-high definition audio up to 4608 kbps', icon: '💎', badge: 'HI-RES 24/96', color: '#00cec9' },
      { id: 'hi-res-48', name: 'Hi-Res Lossless — 24-bit / 48 kHz', desc: 'Studio quality audio up to 2304 kbps', icon: '🎵', badge: 'HI-RES 24/48', color: '#00cec9' },
      { id: 'lossless', name: 'Lossless CD Quality — 16-bit / 44.1 kHz', desc: 'Bit-perfect 1411 kbps uncompressed audio', icon: '💿', badge: 'LOSSLESS', color: '#a29bfe' },
      { id: '320kbps', name: 'Extreme Quality — 320 kbps AAC', desc: 'Crystal clear high-fidelity AAC (Recommended)', icon: '🚀', badge: '320 KBPS', color: '#6c5ce7' },
      { id: '192kbps', name: 'High Quality — 192 kbps', desc: 'Great sound quality with lower data usage', icon: '⚡', badge: '192 KBPS', color: '#74b9ff' },
      { id: '128kbps', name: 'Standard Quality — 128 kbps', desc: 'Fast loading for mobile networks', icon: '🍃', badge: '128 KBPS', color: '#00cec9' },
      { id: 'data-saver', name: 'Data Saver — 64 kbps Opus/AAC', desc: 'Ultra-low bandwidth mode for saving mobile data', icon: '📉', badge: 'DATA SAVER', color: '#00b894' },
      { id: 'auto', name: 'Auto / Adaptive Bitrate', desc: 'Automatically adjusts to current network bandwidth', icon: '📶', badge: 'ADAPTIVE', color: '#fdcb6e' },
    ];

    if (container) {
      container.innerHTML = QUALITIES.map(q => {
        const isSelected = q.id === currentQuality;
        return `
          <div class="quality-option-item ${isSelected ? 'selected' : ''}" data-quality-id="${q.id}">
            <div class="quality-option-item__icon">${q.icon}</div>
            <div class="quality-option-item__info">
              <div class="quality-option-item__title-row">
                <span class="quality-option-item__title">${q.name}</span>
                <span class="quality-option-item__badge" style="background: ${q.color}22; color: ${q.color}; border: 1px solid ${q.color}44;">${q.badge}</span>
              </div>
              <p class="quality-option-item__desc">${q.desc}</p>
            </div>
            <div class="quality-option-item__check">
              ${isSelected ? '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>' : ''}
            </div>
          </div>
        `;
      }).join('');

      container.querySelectorAll('.quality-option-item').forEach(item => {
        item.addEventListener('click', async () => {
          const qualId = item.dataset.qualityId;
          Storage.updateSettings({ audioQuality: qualId });

          // Sync Settings select dropdown if exists
          const selectQual = document.getElementById('select-quality');
          if (selectQual) selectQual.value = qualId;

          // Hot-swap stream quality in Player without resetting playback position
          if (typeof Player !== 'undefined' && Player.changeQuality) {
            await Player.changeQuality(qualId);
          }

          // Update Codec Badge on Full Player
          const codecEl = document.getElementById('full-player-codec');
          if (codecEl && typeof Player !== 'undefined' && Player.getStreamCodecDisplay) {
            codecEl.textContent = Player.getStreamCodecDisplay();
            updateCodecBadgeStyle(codecEl, qualId);
          }

          const chosen = QUALITIES.find(q => q.id === qualId);
          showToast(`Audio quality set to ${chosen ? chosen.name : qualId}`, 'success');

          closeAudioQualityModal();
        });
      });
    }

    modal.style.display = 'flex';
    document.body.classList.add('modal-open');

    // Close on clicking backdrop
    modal.onclick = (e) => {
      if (e.target === modal) closeAudioQualityModal();
    };
  }

  function closeAudioQualityModal() {
    const modal = document.getElementById('audio-quality-modal');
    if (modal) modal.style.display = 'none';
    document.body.classList.remove('modal-open');
  }

  return {
    showToast,
    formatDuration,
    truncate,
    renderSongCard,
    renderSongListItem,
    renderSearchResults,
    renderShelf,
    renderFavorites,
    renderQueue,
    renderRecent,
    updatePlayerBar,
    updatePlayerCardsDeck,
    refreshPlayerCardsDeck,
    syncPlayerCardsSlide,
    updatePlayPauseButton,
    updateProgress,
    updateRepeatButton,
    updateShuffleButton,
    updateVolumeIcon,
    updateDynamicBackground,
    showLoading,
    hideLoading,
    showGlobalLoader,
    hideGlobalLoader,
    showPage,
    renderAlbumCard,
    renderPlaylistCard,
    renderArtistCard,
    showContextMenu,
    closeContextMenu,
    renderSidebarPlaylists,
    renderMoodChips,
    updateMoodChipsActive,
    render3DCardsCarousel,
    renderQuickPicks,
    renderMixSuiteShelf,
    renderLanguageChips,
    renderPublicPlaylistsShelf,
    renderLifestyleHubs,
    renderSmartDownloadsList,
    openAudioQualityModal,
    closeAudioQualityModal,
    updateCodecBadgeStyle,
    startQuickPick: async (song) => {
      if (!song) return;
      const normalized = (window.API && API.normalizeSong) ? API.normalizeSong(song) : { ...song };
      Player.setQueue([normalized], 0);
      await Player.playSong(normalized);
      if (window.App && window.App.startRadioForSong) {
        window.App.startRadioForSong(normalized);
      }
    },
    showRadioStartedAnimation: (song) => {
      try {
        if (typeof Haptics !== 'undefined' && Haptics.success) Haptics.success();
      } catch (_) {}

      // Dismiss any open context menus or sheets
      const existingMenu = document.querySelector('.context-menu');
      if (existingMenu) existingMenu.remove();

      const existing = document.getElementById('radio-started-overlay');
      if (existing) existing.remove();

      const rawName = song?.name || song?.title || (typeof song === 'string' ? song : 'Radio Station');
      const songName = typeof truncate === 'function' ? truncate(rawName, 32) : rawName.slice(0, 32);
      const songImg = (window.API && API.getImageUrl && API.getImageUrl(song)) || (typeof song?.image === 'string' && song.image) || 'assets/logo.jpg';

      const overlay = document.createElement('div');
      overlay.id = 'radio-started-overlay';
      overlay.className = 'radio-started-overlay visible';
      overlay.style.cssText = 'position: fixed !important; inset: 0 !important; z-index: 9999999 !important; display: flex !important; align-items: center !important; justify-content: center !important; opacity: 1 !important; pointer-events: auto !important;';
      overlay.innerHTML = `
        <div class="radio-started-backdrop"></div>
        <div class="radio-started-card" style="transform: scale(1) translateY(0) !important; opacity: 1 !important;">
          <div class="radio-radar-pulse-ring ring-1"></div>
          <div class="radio-radar-pulse-ring ring-2"></div>
          <div class="radio-radar-pulse-ring ring-3"></div>

          <div class="radio-station-disc">
            <img src="${songImg}" onerror="this.src='assets/logo.jpg'" alt="${songName}">
            <div class="radio-station-disc-center">
              <span class="material-symbols-outlined" style="font-size: 32px; color: #fff;">radio</span>
            </div>
          </div>

          <div class="radio-started-badge">
            <span class="live-dot"></span>
            <span>LIVE RADIO ACTIVATED</span>
          </div>

          <h2 class="radio-started-title">Tuning Into Radio...</h2>
          <p class="radio-started-subtitle">Streaming curated infinite flow based on <strong style="color: #fff;">"${songName}"</strong></p>

          <div class="radio-started-equalizer">
            <span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span>
          </div>

          <div class="radio-started-tagline">Enjoy the Endless Flow ✨</div>
        </div>
      `;

      document.body.appendChild(overlay);

      const timer = setTimeout(() => {
        overlay.style.opacity = '0';
        overlay.style.transition = 'opacity 0.4s ease';
        setTimeout(() => overlay.remove(), 450);
      }, 3200);

      overlay.onclick = () => {
        clearTimeout(timer);
        overlay.style.opacity = '0';
        overlay.style.transition = 'opacity 0.25s ease';
        setTimeout(() => overlay.remove(), 260);
      };
    }
  };
})();

window.startQuickPick = (song) => UI.startQuickPick(song);
window.showRadioStartedAnimation = (song) => UI.showRadioStartedAnimation(song);
window.testRadioAnimation = (name) => UI.showRadioStartedAnimation({ name: name || 'Endless Radio Flow', artists: 'MusicFlow AI', image: 'assets/logo.jpg' });

window.UI = UI;
