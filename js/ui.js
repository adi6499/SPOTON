// ========================================
// MusicFlow — UI Rendering & Interactions
// ========================================

const UI = (() => {
  // ---- Toast Notification System ----

  let toastTimeout = null;

  function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span>
      <span class="toast-msg">${message}</span>
    `;
    container.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('show'));

    setTimeout(() => {
      toast.classList.remove('show');
      toast.addEventListener('transitionend', () => toast.remove());
    }, 3000);
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
    return text.length > maxLen ? text.substring(0, maxLen) + '…' : text;
  }

  // ---- Rendering: Song Cards ----

  function renderSongCard(song, index) {
    const isFav = Storage.isFavorite(song.id);
    const div = document.createElement('div');
    div.className = 'song-card';
    div.dataset.songId = song.id;
    div.innerHTML = `
      <div class="song-card__img-wrap" data-action="play" data-index="${index}">
        <img class="song-card__img" src="${song.image || ''}" alt="${song.name}" loading="lazy" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%231a1a2e%22 width=%22100%22 height=%22100%22/><text x=%2250%22 y=%2255%22 text-anchor=%22middle%22 fill=%22%236c5ce7%22 font-size=%2240%22>♪</text></svg>'">
        <div class="song-card__play-overlay">
          <svg class="play-icon" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
        </div>
      </div>
      <div class="song-card__info">
        <div class="song-card__name" title="${song.name}">${truncate(song.name, 28)}</div>
        <div class="song-card__artist" title="${song.artists}">${truncate(song.artists, 32)}</div>
      </div>
      <div class="song-card__actions">
        <button class="btn-icon btn-fav ${isFav ? 'active' : ''}" data-action="fav" title="Favorite" aria-label="Toggle favorite">
          <svg viewBox="0 0 24 24" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
        </button>
        <button class="btn-icon btn-queue" data-action="add-queue" title="Add to queue" aria-label="Add to queue">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
        <button class="btn-icon btn-context" data-action="context-menu" title="More options" aria-label="More options">
          <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
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
    const imageUrl = API.getImageUrl(album) || '';
    
    div.innerHTML = `
      <div class="song-card__img-wrap" data-action="open-album">
        <img class="song-card__img" src="${imageUrl}" alt="${album.title}" loading="lazy" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%231a1a2e%22 width=%22100%22 height=%22100%22/><text x=%2250%22 y=%2255%22 text-anchor=%22middle%22 fill=%22%236c5ce7%22 font-size=%2240%22>🎵</text></svg>'">
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
    const imageUrl = API.getImageUrl(playlist) || '';
    
    div.innerHTML = `
      <div class="song-card__img-wrap" data-action="open-playlist">
        <img class="song-card__img" src="${imageUrl}" alt="${playlist.title}" loading="lazy" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%231a1a2e%22 width=%22100%22 height=%22100%22/><text x=%2250%22 y=%2255%22 text-anchor=%22middle%22 fill=%22%236c5ce7%22 font-size=%2240%22>🎵</text></svg>'">
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
    const imageUrl = API.getImageUrl(artist) || '';
    
    div.innerHTML = `
      <div class="song-card__img-wrap artist-card__img-wrap" data-action="open-artist">
        <img class="song-card__img" src="${imageUrl}" alt="${artist.title || artist.name}" loading="lazy" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%231a1a2e%22 width=%22100%22 height=%22100%22/><text x=%2250%22 y=%2255%22 text-anchor=%22middle%22 fill=%22%236c5ce7%22 font-size=%2240%22>👤</text></svg>'">
      </div>
      <div class="song-card__info artist-card__info">
        <div class="song-card__name" title="${artist.title || artist.name}">${truncate(artist.title || artist.name, 28)}</div>
        <div class="song-card__artist">Artist</div>
      </div>
    `;
    return div;
  }

  // ---- Rendering: Song List Item (for queue / favorites) ----

  function renderSongListItem(song, index, options = {}) {
    const isFav = Storage.isFavorite(song.id);
    const isActive = options.isActive || false;
    const showRemove = options.showRemove || false;

    const div = document.createElement('div');
    div.className = `song-list-item ${isActive ? 'active' : ''}`;
    div.dataset.songId = song.id;
    div.dataset.index = index;
    div.innerHTML = `
      <div class="song-list-item__num">${isActive ? '<span class="now-playing-indicator"><span></span><span></span><span></span></span>' : index + 1}</div>
      <img class="song-list-item__img" src="${song.image || ''}" alt="" loading="lazy" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%231a1a2e%22 width=%22100%22 height=%22100%22/><text x=%2250%22 y=%2255%22 text-anchor=%22middle%22 fill=%22%236c5ce7%22 font-size=%2240%22>♪</text></svg>'">
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

  function renderSearchResults(songs, container) {
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

  function renderFavorites(container) {
    const favs = Storage.getFavorites();
    container.innerHTML = '';

    if (favs.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">❤️</div>
          <div class="empty-state__title">No favorites yet</div>
          <div class="empty-state__subtitle">Search for songs and tap the heart to save them</div>
        </div>`;
      return;
    }

    const header = document.createElement('div');
    header.className = 'section-header';
    header.innerHTML = `
      <h2 class="section-title">Your Favorites</h2>
      <span class="section-count">${favs.length} songs</span>
    `;
    container.appendChild(header);

    const list = document.createElement('div');
    list.className = 'song-list';
    favs.forEach((song, i) => {
      list.appendChild(renderSongListItem(song, i, { showRemove: false }));
    });
    container.appendChild(list);
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
      el.style.touchAction = 'none'; // Prevent scrolling during drag
      
      // Inject Drag Handle
      const dragHandle = document.createElement('div');
      dragHandle.className = 'drag-handle';
      dragHandle.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>';
      dragHandle.style.cursor = 'grab';
      dragHandle.style.padding = '10px';
      dragHandle.style.opacity = '0.5';
      el.insertBefore(dragHandle, el.firstChild);

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

  // ---- Player Bar ----

  function updatePlayerBar(track) {
    const bar = document.getElementById('player-container');
    if (!bar) return;

    if (!track || !track.id || track.name === 'Not Playing') {
      document.body.classList.remove('has-player');
      bar.style.display = 'none';
      return;
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

    const highResImg = API.getHighResImage ? API.getHighResImage(track.image) : track.image;

    if (mImg) mImg.src = track.image || '';
    if (mName) mName.textContent = track.name || 'Unknown';
    if (mArtist) mArtist.textContent = track.artists || 'Unknown';

    if (fImg) fImg.src = highResImg || '';
    if (fName) fName.textContent = track.name || 'Unknown';
    if (fArtist) fArtist.textContent = track.artists || 'Unknown';

    const isFav = Storage.isFavorite(track.id);
    document.querySelectorAll('.full-player .btn-fav, .mini-player .btn-fav').forEach(btn => {
      if (isFav) btn.classList.add('active');
      else btn.classList.remove('active');
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
    });

    updateDynamicBackground(track.image);
  }

  function updatePlayPauseButton(isPlaying) {
    document.querySelectorAll('.btn-play').forEach(btn => {
      btn.innerHTML = isPlaying 
        ? '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>';
    });
  }

  function updateProgress(data) {
    const mFill = document.getElementById('mini-progress-fill');
    const fFill = document.getElementById('full-progress-fill');
    const fThumb = document.getElementById('full-progress-thumb');
    const tCurr = document.getElementById('time-current');
    const tTot = document.getElementById('time-total');

    if (mFill && data.progress !== undefined) mFill.style.width = `${data.progress}%`;
    if (fFill && data.progress !== undefined) fFill.style.width = `${data.progress}%`;
    if (fThumb && data.progress !== undefined) fThumb.style.left = `${data.progress}%`;

    if (tCurr && data.currentTime !== undefined) tCurr.textContent = formatDuration(data.currentTime);
    if (tTot && data.duration !== undefined) tTot.textContent = formatDuration(data.duration);
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
    const btn = document.querySelector('[data-action="volume-toggle"]');
    if (!btn) return;
    if (volume === 0) {
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>';
    } else if (volume < 0.5) {
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>';
    } else {
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>';
    }
  }

  // ---- Dynamic Background ----

  function updateDynamicBackground(imageUrl) {
    if (!imageUrl) return;
    const bg = document.getElementById('dynamic-bg');
    if (bg) {
      bg.style.backgroundImage = `url(${imageUrl})`;
      bg.classList.add('active');
    }
  }

  // ---- Loading States ----

  function showLoading(container, type = 'card') {
    if (type === 'card' || type === 'album') {
      container.innerHTML = `
        <div class="loading-grid">
          ${Array(8).fill('<div class="skeleton-card"><div class="skeleton skeleton-img"></div><div class="skeleton skeleton-text"></div><div class="skeleton skeleton-text short"></div></div>').join('')}
        </div>`;
    } else if (type === 'artist') {
      container.innerHTML = `
        <div class="loading-grid">
          ${Array(8).fill('<div class="skeleton-card"><div class="skeleton skeleton-img skeleton-circle"></div><div class="skeleton skeleton-text" style="margin: 0 auto;"></div></div>').join('')}
        </div>`;
    }
  }

  function hideLoading(container) {
    const loading = container.querySelector('.loading-grid');
    if (loading) loading.remove();
  }

  // ---- Page Navigation ----

  function showPage(pageId) {
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
    updatePlayPauseButton,
    updateProgress,
    updateRepeatButton,
    updateShuffleButton,
    updateVolumeIcon,
    updateDynamicBackground,
    showLoading,
    hideLoading,
    showPage,
    renderAlbumCard,
    renderPlaylistCard,
    renderArtistCard,
    showContextMenu,
    closeContextMenu,
  };
})();
