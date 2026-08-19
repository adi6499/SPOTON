// ========================================
// MusicFlow — UI Rendering & Interactions
// ========================================

const UI = (() => {
  // ---- Toast Notification System ----

  let toastTimeout = null;

  function showToast(message, type = 'info', options = {}) {
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
    
    if (options.onClick) {
      toast.style.cursor = 'pointer';
      toast.addEventListener('click', () => {
        options.onClick();
        toast.classList.remove('show');
      });
    }

    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));

    const duration = options.duration || 3000;
    setTimeout(() => {
      toast.classList.remove('show');
      toast.addEventListener('transitionend', () => toast.remove());
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
    return text.length > maxLen ? text.substring(0, maxLen) + '…' : text;
  }

  // ---- Rendering: Song Cards ----

  function renderSongCard(song, index) {
    const isFav = Storage.isFavorite(song.id);
    const div = document.createElement('div');
    div.className = 'song-card';
    div.dataset.songId = song.id;
    div.dataset.songData = encodeURIComponent(JSON.stringify(song));
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
    const name = artist.name || artist.title || artist.artist || 'Unknown';
    const imageUrl = API.getImageUrl(artist) || '';
    
    div.innerHTML = `
      <div class="song-card__img-wrap artist-card__img-wrap" data-action="open-artist" data-name="${name.replace(/"/g, '&quot;')}" data-image="${imageUrl}">
        <img class="song-card__img" src="${imageUrl}" alt="${name}" loading="lazy" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%231a1a2e%22 width=%22100%22 height=%22100%22/><text x=%2250%22 y=%2255%22 text-anchor=%22middle%22 fill=%22%236c5ce7%22 font-size=%2240%22>👤</text></svg>'">
      </div>
      <div class="song-card__info artist-card__info" data-action="open-artist" data-name="${name.replace(/"/g, '&quot;')}" data-image="${imageUrl}">
        <div class="song-card__name" title="${name}">${truncate(name, 28)}</div>
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
    div.dataset.songData = encodeURIComponent(JSON.stringify(song));
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

    const recapBanner = document.createElement('div');
    recapBanner.style.background = 'linear-gradient(135deg, var(--accent-color), var(--accent-dark))';
    recapBanner.style.padding = '16px 20px';
    recapBanner.style.borderRadius = 'var(--radius-lg)';
    recapBanner.style.marginBottom = '24px';
    recapBanner.style.display = 'flex';
    recapBanner.style.justifyContent = 'space-between';
    recapBanner.style.alignItems = 'center';
    recapBanner.style.cursor = 'pointer';
    recapBanner.style.boxShadow = 'var(--shadow-md)';
    recapBanner.innerHTML = `
      <div>
        <div style="font-weight: 800; font-size: 18px; color: #fff;">Your Music Recap</div>
        <div style="font-size: 13px; color: rgba(255,255,255,0.8); margin-top: 4px;">See your listening stats</div>
      </div>
      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#fff" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
    `;
    recapBanner.onclick = () => {
      document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
      UI.showPage('page-recap');
      Recap.renderRecap(document.getElementById('recap-container'));
      history.pushState({ type: 'page', pageId: 'page-recap' }, '', '#recap');
    };
    container.appendChild(recapBanner);

    const recentlyAdded = [...favs].reverse().slice(0, 8); // top 8 recently added

    // Recently Added Shelf
    if (recentlyAdded.length > 0) {
      const recentHeader = document.createElement('div');
      recentHeader.className = 'section-header';
      recentHeader.innerHTML = `<h2 class="section-title">Recently Added</h2>`;
      container.appendChild(recentHeader);

      const recentGrid = document.createElement('div');
      recentGrid.className = 'shelf-grid horizontal-scroll';
      recentlyAdded.forEach((song) => {
        const originalIndex = favs.findIndex(s => s.id === song.id);
        recentGrid.appendChild(renderSongCard(song, originalIndex));
      });
      container.appendChild(recentGrid);
    }

    // All Favorites List
    const allHeader = document.createElement('div');
    allHeader.className = 'section-header';
    allHeader.style.marginTop = '24px';
    allHeader.innerHTML = `
      <h2 class="section-title">All Favorites</h2>
      <span class="section-count">${favs.length} songs</span>
    `;
    container.appendChild(allHeader);

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
    if (fImg) fImg.src = highResImg || '';
    if (fName) fName.textContent = track.name || 'Unknown';

    const renderArtistChips = (container, artistsText, trackImg) => {
      if (!container) return;
      if (!artistsText || artistsText === 'Unknown' || artistsText === '-') {
        container.textContent = artistsText || 'Unknown';
        return;
      }
      container.innerHTML = '';
      const list = artistsText.split(/[,/&]+/).map(a => a.trim()).filter(Boolean);
      list.forEach((artName, idx) => {
        const span = document.createElement('span');
        span.className = 'clickable-artist-link';
        span.textContent = artName;
        span.title = `View artist: ${artName}`;
        span.onclick = (e) => {
          e.stopPropagation();
          if (window.openArtistPage) {
            window.openArtistPage(artName, trackImg);
          }
        };
        container.appendChild(span);
        if (idx < list.length - 1) {
          container.appendChild(document.createTextNode(', '));
        }
      });
    };

    renderArtistChips(mArtist, track.artists, track.image);
    renderArtistChips(fArtist, track.artists, highResImg || track.image);

    const isFav = Storage.isFavorite(track.id);
    document.querySelectorAll('.full-player .btn-fav, .mini-player .btn-fav').forEach(btn => {
      if (isFav) btn.classList.add('active');
      else btn.classList.remove('active');
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
    });

    updateDynamicBackground(track.image);
  }

  function updatePlayPauseButton(isPlaying) {
    document.body.classList.toggle('is-playing', isPlaying);
    const pc = document.getElementById('player-container');
    if (pc) pc.classList.toggle('is-playing', isPlaying);

    document.querySelectorAll('.btn-play').forEach(btn => {
      btn.innerHTML = isPlaying 
        ? '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>';
    });
  }

  function updateProgress(data) {
    if (window.isSeeking) return;
    const mFill = document.getElementById('mini-progress-fill');
    const mEdge = document.getElementById('mini-progress-edge');
    const fFill = document.getElementById('full-progress-fill');
    const fThumb = document.getElementById('full-progress-thumb');
    
    const tCurr = document.getElementById('time-current');
    const tTot = document.getElementById('time-total');
    
    const mtCurr = document.getElementById('mini-time-current');
    const mtTot = document.getElementById('mini-time-total');

    if (data.progress !== undefined) {
      if (mFill) mFill.style.width = `${data.progress}%`;
      if (mEdge) mEdge.style.width = `${data.progress}%`;
      if (fFill) fFill.style.width = `${data.progress}%`;
      if (fThumb) fThumb.style.left = `${data.progress}%`;
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

  function extractDominantColor(imageUrl, callback) {
    if (!imageUrl) return;
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
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
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

  function updateDynamicBackground(imageUrl) {
    if (!imageUrl) return;
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
        bg.style.background = `radial-gradient(circle at 50% 0%, rgba(${r}, ${g}, ${b}, 0.4) 0%, transparent 70%)`;
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
    showGlobalLoader,
    hideGlobalLoader,
    showPage,
    renderAlbumCard,
    renderPlaylistCard,
    renderArtistCard,
    showContextMenu,
    closeContextMenu,
    renderSidebarPlaylists,
  };
})();
