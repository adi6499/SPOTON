// ========================================
// MusicFlow — Federated Search Engine (YouTube Music Style)
// ========================================

const SearchEngine = (() => {
  const TABS = [
    { id: 'all', label: 'All', icon: '🌟' },
    { id: 'songs', label: 'Songs', icon: '🎵' },
    { id: 'albums', label: 'Albums', icon: '💿' },
    { id: 'artists', label: 'Artists', icon: '👤' },
    { id: 'playlists', label: 'Playlists', icon: '📑' },
    { id: 'mixes', label: 'Mixes', icon: '✨' },
    { id: 'podcasts', label: 'Podcasts', icon: '🎙️' },
    { id: 'videos', label: 'Videos', icon: '🎬' }
  ];

  let state = {
    currentQuery: '',
    activeTab: 'all',
    isLoading: false,
    isLoadingMore: false,
    results: {
      songs: [],
      albums: [],
      artists: [],
      playlists: [],
      mixes: [],
      podcasts: [],
      videos: []
    },
    pagination: {
      songs: { page: 1, hasMore: true },
      albums: { page: 1, hasMore: true },
      artists: { page: 1, hasMore: true },
      playlists: { page: 1, hasMore: true }
    },
    topResult: null
  };

  let scrollListenerAttached = false;
  let infiniteScrollDebounce = null;

  /**
   * Escape regex special characters
   */
  function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Highlight matched search query substring in text
   */
  function highlightMatch(text, query) {
    if (!text || !query) return text || '';
    const cleanQuery = query.trim();
    if (!cleanQuery) return text;

    const words = cleanQuery.split(/\s+/).filter(w => w.length > 0).map(escapeRegExp);
    if (words.length === 0) return text;

    const regex = new RegExp(`(${words.join('|')})`, 'gi');
    return String(text).replace(regex, '<mark class="search-highlight">$1</mark>');
  }

  /**
   * Determine the single best "Top Result" card for the query (YouTube Music style)
   */
  function calculateTopResult(query, { songs, albums, artists, playlists, podcasts }) {
    const q = (query || '').toLowerCase().trim();
    if (!q) return null;

    const words = q.split(/\s+/).filter(Boolean);

    // 1. Exact artist match
    const exactArtist = (artists || []).find(a => (a.name || '').toLowerCase() === q);
    if (exactArtist) {
      return { item: exactArtist, type: 'artist', confidence: 1.0 };
    }

    // 2. Exact song title match
    const exactSong = (songs || []).find(s => (s.title || s.name || '').toLowerCase() === q);
    if (exactSong) {
      return { item: exactSong, type: 'song', confidence: 0.95 };
    }

    // 3. Multi-token high-relevance song match (e.g. "OK" by "Katy Perry")
    if (words.length >= 2 && songs && songs.length > 0) {
      const bestMatch = (songs || []).find(s => {
        const title = (s.title || s.name || '').toLowerCase();
        const artist = (s.artist || '').toLowerCase();
        return words.every(w => title.includes(w) || artist.includes(w));
      });
      if (bestMatch) {
        return { item: bestMatch, type: 'song', confidence: 0.92 };
      }
    }

    // 4. Exact album title match
    const exactAlbum = (albums || []).find(a => (a.title || a.name || '').toLowerCase() === q);
    if (exactAlbum) {
      return { item: exactAlbum, type: 'album', confidence: 0.90 };
    }

    // 5. Prefix artist match
    const prefixArtist = (artists || []).find(a => (a.name || '').toLowerCase().startsWith(q));
    if (prefixArtist) {
      return { item: prefixArtist, type: 'artist', confidence: 0.85 };
    }

    // 6. First song if available
    if (songs && songs.length > 0) {
      return { item: songs[0], type: 'song', confidence: 0.75 };
    }

    // 7. First album
    if (albums && albums.length > 0) {
      return { item: albums[0], type: 'album', confidence: 0.70 };
    }

    // 8. First artist
    if (artists && artists.length > 0) {
      return { item: artists[0], type: 'artist', confidence: 0.65 };
    }

    return null;
  }

  /**
   * Generate tailored mixes matching the query
   */
  function generateSearchMixes(query, songs, artists) {
    const q = query.trim();
    const primaryArtist = artists[0]?.name || (songs[0]?.artists ? songs[0].artists.split(',')[0].trim() : q);
    
    const gradients = [
      'linear-gradient(135deg, #FF0844, #FFB199)',
      'linear-gradient(135deg, #667EEA, #764BA2)',
      'linear-gradient(135deg, #F5576C, #F093FB)',
      'linear-gradient(135deg, #4FACFE, #00F2FE)',
      'linear-gradient(135deg, #43E97B, #38F9D7)',
      'linear-gradient(135deg, #FA709A, #FEE140)'
    ];

    return [
      {
        id: `search_mix_1_${encodeURIComponent(q)}`,
        title: `${q} Supermix`,
        subtitle: `Endless blend of ${primaryArtist} & related hits`,
        badge: 'Supermix',
        icon: '✨',
        gradient: gradients[0],
        query: `${q} superhits top viral`
      },
      {
        id: `search_mix_2_${encodeURIComponent(q)}`,
        title: `${q} Radio Station`,
        subtitle: `Curated vibe station featuring ${primaryArtist}`,
        badge: 'Radio',
        icon: '📻',
        gradient: gradients[1],
        query: `${primaryArtist} greatest hits`
      },
      {
        id: `search_mix_3_${encodeURIComponent(q)}`,
        title: `${q} Chill & Acoustic`,
        subtitle: `Mellow, acoustic & lo-fi renditions of ${q}`,
        badge: 'Chill',
        icon: '🍃',
        gradient: gradients[2],
        query: `${q} acoustic chill unplugged`
      },
      {
        id: `search_mix_4_${encodeURIComponent(q)}`,
        title: `${q} High Energy Workout`,
        subtitle: `Upbeat, bass boosted & dance remix collection`,
        badge: 'Energise',
        icon: '⚡',
        gradient: gradients[3],
        query: `${q} remix edm dance bass boosted`
      }
    ];
  }

  /**
   * Search matching podcasts & episodes
   */
  function generateSearchPodcasts(query) {
    if (typeof Podcasts === 'undefined') return [];
    const shows = Podcasts.getCuratedShows ? Podcasts.getCuratedShows() : [];
    const q = query.toLowerCase();

    // Match show title, host, category, or description
    const matchedShows = shows.filter(show => 
      show.title.toLowerCase().includes(q) ||
      show.host.toLowerCase().includes(q) ||
      show.category.toLowerCase().includes(q) ||
      show.description.toLowerCase().includes(q) ||
      (show.sampleEpisodes || []).some(ep => ep.title.toLowerCase().includes(q))
    );

    // If query didn't match curated shows, provide relevant shows anyway
    return matchedShows.length > 0 ? matchedShows : shows.slice(0, 4);
  }

  /**
   * Search matching YouTube music videos
   */
  function generateSearchVideos(query, songs) {
    // Generate video representations from top song results
    const topSongs = (songs || []).slice(0, 12);
    return topSongs.map((song) => {
      const rawImg = (window.API && API.getImageUrl) ? API.getImageUrl(song) : (typeof song.image === 'string' ? song.image : '');
      const cleanImg = (typeof rawImg === 'string' && rawImg !== '[object Object]') ? rawImg : '';
      return {
        id: `vid_${song.id}`,
        title: `${song.name} (Official Music Video)`,
        artist: song.artists,
        image: cleanImg,
        duration: song.duration,
        songData: song,
        videoQuery: `${song.name} ${song.artists} official video`
      };
    });
  }

  /**
   * Search user local playlists + public web playlists
   */
  function getLocalAndPublicPlaylists(query) {
    const q = query.toLowerCase();
    const local = (typeof Storage !== 'undefined' && Storage.getPlaylists) ? Storage.getPlaylists() : [];
    const matchedLocal = local.filter(p => (p.name || '').toLowerCase().includes(q)).map(p => {
      let img = p.songs && p.songs[0] ? (p.songs[0].image || p.songs[0].imageUrl || '') : '';
      if (typeof img === 'object' && img !== null) {
        img = (window.API && API.getImageUrl) ? API.getImageUrl(img) : '';
      }
      if (typeof img !== 'string' || img === '[object Object]') img = '';

      return {
        id: p.id,
        title: p.name,
        subtitle: `${(p.songs || []).length} Songs • My Playlist`,
        songCount: (p.songs || []).length,
        image: img,
        type: 'playlist',
        isLocal: true,
        raw: p
      };
    });

    return matchedLocal;
  }

  /**
   * Execute comprehensive federated search
   */
  async function executeSearch(query, preferredTab = 'all') {
    const cleanQuery = (query || '').trim();
    if (!cleanQuery) {
      renderSearchHistory();
      return;
    }

    state.currentQuery = cleanQuery;
    state.activeTab = preferredTab || 'all';
    state.isLoading = true;
    state.pagination = {
      songs: { page: 1, hasMore: true },
      albums: { page: 1, hasMore: true },
      artists: { page: 1, hasMore: true },
      playlists: { page: 1, hasMore: true }
    };

    // Show search page & toggle hub
    UI.showPage('page-search');
    const browseHub = document.getElementById('search-browse-hub');
    if (browseHub) browseHub.style.display = 'none';
    const container = document.getElementById('search-results');
    if (!container) return;
    container.style.display = 'block';

    const pageInput = document.getElementById('search-page-input');
    if (pageInput && document.activeElement !== pageInput && pageInput.value.trim() !== cleanQuery) {
      pageInput.value = cleanQuery;
    }
    const pageClear = document.getElementById('search-page-clear');
    if (pageClear) pageClear.style.display = 'flex';

    // Render skeleton layout immediately
    renderSearchPageSkeleton(container, cleanQuery, state.activeTab);

    try {
      // 1. Fetch federated collections in parallel
      const federated = await API.searchFederated(cleanQuery, 1);
      
      const rawSongs = federated?.songs || [];
      const rawAlbums = federated?.albums || [];
      const rawArtists = federated?.artists || [];
      const rawPlaylists = federated?.playlists || [];

      // In user-initiated search, return all rich matched results without artificial filtering
      const finalSongs = rawSongs;

      // Integrate local matching playlists
      const localPlaylists = getLocalAndPublicPlaylists(cleanQuery);
      const allPlaylists = [...localPlaylists, ...rawPlaylists];

      // Generate mixes, podcasts, and videos
      const mixes = generateSearchMixes(cleanQuery, finalSongs, rawArtists);
      const podcasts = generateSearchPodcasts(cleanQuery);
      const videos = generateSearchVideos(cleanQuery, finalSongs);

      state.results = {
        songs: finalSongs,
        albums: rawAlbums,
        artists: rawArtists,
        playlists: allPlaylists,
        mixes: mixes,
        podcasts: podcasts,
        videos: videos
      };

      state.topResult = calculateTopResult(cleanQuery, state.results);

      // Render full search results
      renderSearchResultsPage(container);

      // Attach infinite scroll observer
      setupInfiniteScroll();

    } catch (err) {
      console.error('[SearchEngine] Search execution failed:', err);
      renderSearchError(container, cleanQuery);
    } finally {
      state.isLoading = false;
      UI.hideGlobalLoader();
    }
  }

  /**
   * Switch active search tab
   */
  async function switchTab(tabId) {
    if (state.activeTab === tabId) return;
    state.activeTab = tabId;

    const container = document.getElementById('search-results');
    if (!container) return;

    renderSearchResultsPage(container);
  }

  /**
   * Load next page for active tab (infinite scroll / pagination)
   */
  async function loadMore(tabId) {
    if (state.isLoadingMore || !state.currentQuery) return;
    const pag = state.pagination[tabId];
    if (!pag || !pag.hasMore) return;

    state.isLoadingMore = true;
    const sentinel = document.getElementById('search-infinite-sentinel');
    if (sentinel) {
      sentinel.innerHTML = `
        <div class="search-infinite-loader">
          <div class="spinner-small"></div>
          <span>Loading more ${tabId}...</span>
        </div>`;
    }

    try {
      const nextPage = pag.page + 1;
      let newItems = [];

      if (tabId === 'songs') {
        const res = await API.searchSongs(state.currentQuery, 40, nextPage);
        newItems = (res || []).map(API.normalizeSong);
        if (newItems.length > 0) {
          state.results.songs.push(...newItems);
          pag.page = nextPage;
          appendSongListItems(newItems, state.currentQuery);
        } else {
          pag.hasMore = false;
        }
      } else if (tabId === 'albums') {
        const res = await API.searchAlbums(state.currentQuery, 20, nextPage);
        newItems = (res || []).map(API.normalizeAlbum).filter(Boolean);
        if (newItems.length > 0) {
          state.results.albums.push(...newItems);
          pag.page = nextPage;
          appendGridCards(newItems, 'album', state.currentQuery);
        } else {
          pag.hasMore = false;
        }
      } else if (tabId === 'artists') {
        const res = await API.searchArtists(state.currentQuery, 20, nextPage);
        newItems = (res || []).map(API.normalizeArtist).filter(Boolean);
        if (newItems.length > 0) {
          state.results.artists.push(...newItems);
          pag.page = nextPage;
          appendGridCards(newItems, 'artist', state.currentQuery);
        } else {
          pag.hasMore = false;
        }
      } else if (tabId === 'playlists') {
        const res = await API.searchPlaylists(state.currentQuery, 20, nextPage);
        newItems = (res || []).map(API.normalizePlaylist).filter(Boolean);
        if (newItems.length > 0) {
          state.results.playlists.push(...newItems);
          pag.page = nextPage;
          appendGridCards(newItems, 'playlist', state.currentQuery);
        } else {
          pag.hasMore = false;
        }
      }

      if (!pag.hasMore && sentinel) {
        sentinel.innerHTML = `<div class="search-end-hint">Reached end of ${tabId} results</div>`;
      }
    } catch (err) {
      console.warn('[SearchEngine] loadMore failed:', err);
    } finally {
      state.isLoadingMore = false;
      if (sentinel && pag.hasMore) {
        sentinel.innerHTML = '';
      }
    }
  }

  /**
   * Append newly paginated songs to the DOM list
   */
  function appendSongListItems(songs, query) {
    const list = document.getElementById('search-tab-songs-list');
    if (!list) return;

    const startIndex = state.results.songs.length - songs.length;
    songs.forEach((song, i) => {
      const idx = startIndex + i;
      const el = UI.renderSongListItem(song, idx);
      
      // Apply highlight
      const nameEl = el.querySelector('.song-list-item__name');
      const artistEl = el.querySelector('.song-list-item__artist');
      if (nameEl) nameEl.innerHTML = highlightMatch(song.name, query);
      if (artistEl) artistEl.innerHTML = highlightMatch(song.artists, query);

      el.addEventListener('click', async (e) => {
        if (e.target.closest('.btn-icon')) return;
        Player.setQueue(state.results.songs, idx);
        await Player.playSong(song, idx);
      });

      list.appendChild(el);
    });
  }

  /**
   * Append newly paginated cards to the DOM grid
   */
  function appendGridCards(items, type, query) {
    const grid = document.getElementById(`search-tab-${type}s-grid`);
    if (!grid) return;

    const startIndex = state.results[`${type}s`].length - items.length;
    items.forEach((item, i) => {
      let card;
      if (type === 'album') card = UI.renderAlbumCard(item, startIndex + i);
      else if (type === 'artist') card = UI.renderArtistCard(item, startIndex + i);
      else if (type === 'playlist') card = UI.renderPlaylistCard(item, startIndex + i);

      if (card) {
        const nameEl = card.querySelector('.song-card__name');
        const artistEl = card.querySelector('.song-card__artist');
        if (nameEl) nameEl.innerHTML = highlightMatch(item.title || item.name, query);
        if (artistEl && item.artist) artistEl.innerHTML = highlightMatch(item.artist, query);
        grid.appendChild(card);
      }
    });
  }

  /**
   * Render Tab Bar Header
   */
  function renderTabsBar() {
    const active = state.activeTab;
    return `
      <div class="search-tabs-carousel-wrapper">
        <div class="search-tabs-carousel" id="search-tabs-bar">
          ${TABS.map(tab => `
            <button class="search-tab-chip ${active === tab.id ? 'active' : ''}" data-tab="${tab.id}">
              <span class="search-tab-chip__icon">${tab.icon}</span>
              <span class="search-tab-chip__label">${tab.label}</span>
            </button>
          `).join('')}
        </div>
      </div>
    `;
  }

  /**
   * Render Top Result Feature Card (YouTube Music style)
   */
  function renderTopResultCard(top, query) {
    if (!top || !top.item) return '';
    const item = top.item;
    const type = top.type; // 'artist' | 'song' | 'album'

    let title = item.name || item.title || 'Unknown';
    let subtitle = '';
    let image = (window.API && API.getImageUrl) ? API.getImageUrl(item) : (item.image || item.imageUrl || '');
    if (typeof image !== 'string' || image === '[object Object]') {
      image = '';
    }
    let badge = 'TOP RESULT';

    if (type === 'artist') {
      badge = 'ARTIST';
      subtitle = 'Verified Artist';
    } else if (type === 'song') {
      badge = 'SONG';
      subtitle = `${item.artists || ''} • ${item.album || 'Single'}`;
    } else if (type === 'album') {
      badge = 'ALBUM';
      subtitle = `${item.artist || ''} • ${item.year || 'Album'}`;
    }

    return `
      <div class="search-top-result-wrapper">
        <h2 class="search-section-heading">Top Result</h2>
        <div class="search-top-result-card ${type === 'artist' ? 'is-artist' : ''}" id="search-top-result-btn" data-type="${type}">
          <div class="search-top-result-card__art-wrap skeleton">
            <img class="search-top-result-card__img" src="${image}" alt="${title}" loading="lazy" onload="this.classList.add('loaded'); this.parentElement.classList.remove('skeleton');" onerror="this.onerror=null; this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%231a1a2e%22 width=%22100%22 height=%22100%22/><text x=%2250%22 y=%2255%22 text-anchor=%22middle%22 fill=%22%236c5ce7%22 font-size=%2240%22>🎵</text></svg>';">
            <div class="search-top-result-card__play-btn" title="Play Now">
              <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="6,4 18,12 6,20"/></svg>
            </div>
          </div>
          <div class="search-top-result-card__info">
            <span class="search-top-result-card__badge">${badge}</span>
            <h1 class="search-top-result-card__title">${highlightMatch(title, query)}</h1>
            <p class="search-top-result-card__subtitle">${highlightMatch(subtitle, query)}</p>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render Full Search Results Page View
   */
  function renderSearchResultsPage(container) {
    const q = state.currentQuery;
    const tab = state.activeTab;

    let html = renderTabsBar();
    html += `<div class="search-content-body" id="search-content-body">`;

    if (tab === 'all') {
      html += renderAllOverviewHTML(q);
    } else {
      html += renderSpecificTabHTML(tab, q);
    }

    html += `</div>`;
    html += `<div id="search-infinite-sentinel" class="search-infinite-sentinel"></div>`;

    container.innerHTML = html;

    // Attach Tab Switcher Clicks
    container.querySelectorAll('.search-tab-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const tabId = btn.dataset.tab;
        switchTab(tabId);
      });
    });

    // Attach Top Result Click
    const topCard = document.getElementById('search-top-result-btn');
    if (topCard && state.topResult) {
      topCard.addEventListener('click', async () => {
        const top = state.topResult;
        if (top.type === 'song') {
          Player.setQueue(state.results.songs, 0);
          await Player.playSong(top.item);
        } else if (top.type === 'artist') {
          if (window.openArtistPage) window.openArtistPage(top.item.name, top.item.image);
        } else if (top.type === 'album') {
          if (window.openAlbumPage) window.openAlbumPage(top.item.id, top.item.title, top.item.image);
        }
      });
    }

    // Attach item events
    bindTabEvents(container);
  }

  /**
   * Render HTML for "All" Overview tab
   */
  function renderAllOverviewHTML(query) {
    const { songs, albums, artists, playlists, mixes, podcasts, videos } = state.results;
    let html = '';

    const totalResults = songs.length + albums.length + artists.length + playlists.length;
    if (totalResults === 0) {
      return renderEmptyFallbackHTML('results', query);
    }

    // 1. Top Result Spotlight
    if (state.topResult) {
      html += renderTopResultCard(state.topResult, query);
    }

    // 2. Songs Shelf (List of top 6)
    if (songs.length > 0) {
      html += `
        <div class="search-shelf-section">
          <div class="search-shelf-header">
            <h2 class="search-shelf-title">Songs</h2>
            <button class="search-shelf-see-all" data-switch-tab="songs">See All (${songs.length}) ›</button>
          </div>
          <div class="search-songs-overview-list" id="search-overview-songs">
            <!-- Rendered in bindTabEvents -->
          </div>
        </div>
      `;
    }

    // 3. Videos Shelf (Horizontal carousel)
    if (videos.length > 0) {
      html += `
        <div class="search-shelf-section">
          <div class="search-shelf-header">
            <h2 class="search-shelf-title">Music Videos</h2>
            <button class="search-shelf-see-all" data-switch-tab="videos">See All ›</button>
          </div>
          <div class="search-videos-grid">
            ${videos.slice(0, 4).map(vid => `
              <div class="video-search-card" data-song-id="${vid.songData.id}">
                <div class="video-search-card__art-wrap skeleton">
                  <img class="video-search-card__img" src="${vid.image}" alt="${vid.title}" loading="lazy" onload="this.classList.add('loaded'); this.parentElement.classList.remove('skeleton');" onerror="this.onerror=null; this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%231a1a2e%22 width=%22100%22 height=%22100%22/><text x=%2250%22 y=%2255%22 text-anchor=%22middle%22 fill=%22%236c5ce7%22 font-size=%2240%22>🎬</text></svg>';">
                  <div class="video-search-card__overlay">
                    <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="6,4 18,12 6,20"/></svg>
                  </div>
                  <span class="video-search-card__badge">VIDEO</span>
                </div>
                <div class="video-search-card__info">
                  <div class="video-search-card__title">${highlightMatch(vid.title, query)}</div>
                  <div class="video-search-card__subtitle">${highlightMatch(vid.artist, query)}</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    // 4. Albums Shelf
    if (albums.length > 0) {
      html += `
        <div class="search-shelf-section">
          <div class="search-shelf-header">
            <h2 class="search-shelf-title">Albums</h2>
            <button class="search-shelf-see-all" data-switch-tab="albums">See All (${albums.length}) ›</button>
          </div>
          <div class="song-grid" id="search-overview-albums"></div>
        </div>
      `;
    }

    // 5. Artists Shelf
    if (artists.length > 0) {
      html += `
        <div class="search-shelf-section">
          <div class="search-shelf-header">
            <h2 class="search-shelf-title">Artists</h2>
            <button class="search-shelf-see-all" data-switch-tab="artists">See All (${artists.length}) ›</button>
          </div>
          <div class="song-grid" id="search-overview-artists"></div>
        </div>
      `;
    }

    // 6. Playlists Shelf
    if (playlists.length > 0) {
      html += `
        <div class="search-shelf-section">
          <div class="search-shelf-header">
            <h2 class="search-shelf-title">Playlists</h2>
            <button class="search-shelf-see-all" data-switch-tab="playlists">See All (${playlists.length}) ›</button>
          </div>
          <div class="song-grid" id="search-overview-playlists"></div>
        </div>
      `;
    }

    // 7. Personalized Mixes Shelf
    if (mixes.length > 0) {
      html += `
        <div class="search-shelf-section">
          <div class="search-shelf-header">
            <h2 class="search-shelf-title">Featured & Custom Mixes</h2>
            <button class="search-shelf-see-all" data-switch-tab="mixes">See All ›</button>
          </div>
          <div class="song-grid" id="search-overview-mixes"></div>
        </div>
      `;
    }

    // 8. Podcasts Shelf
    if (podcasts.length > 0) {
      html += `
        <div class="search-shelf-section">
          <div class="search-shelf-header">
            <h2 class="search-shelf-title">Podcasts & Shows</h2>
            <button class="search-shelf-see-all" data-switch-tab="podcasts">See All ›</button>
          </div>
          <div class="podcast-shows-grid" id="search-overview-podcasts"></div>
        </div>
      `;
    }

    return html;
  }

  /**
   * Render HTML for a specific collection tab
   */
  function renderSpecificTabHTML(tab, query) {
    const items = state.results[tab] || [];
    if (items.length === 0) {
      return renderEmptyFallbackHTML(tab, query);
    }

    let html = `<div class="search-tab-dedicated-view">`;

    if (tab === 'songs') {
      html += `<div class="song-list" id="search-tab-songs-list"></div>`;
    } else if (tab === 'albums') {
      html += `<div class="song-grid" id="search-tab-albums-grid"></div>`;
    } else if (tab === 'artists') {
      html += `<div class="song-grid" id="search-tab-artists-grid"></div>`;
    } else if (tab === 'playlists') {
      html += `<div class="song-grid" id="search-tab-playlists-grid"></div>`;
    } else if (tab === 'mixes') {
      html += `<div class="song-grid" id="search-tab-mixes-grid"></div>`;
    } else if (tab === 'podcasts') {
      html += `<div class="podcast-shows-grid" id="search-tab-podcasts-grid"></div>`;
    } else if (tab === 'videos') {
      html += `
        <div class="search-videos-grid" id="search-tab-videos-grid">
          ${items.map(vid => `
            <div class="video-search-card" data-song-id="${vid.songData.id}">
              <div class="video-search-card__art-wrap skeleton">
                <img class="video-search-card__img" src="${vid.image}" alt="${vid.title}" loading="lazy" onload="this.classList.add('loaded'); this.parentElement.classList.remove('skeleton');" onerror="this.onerror=null; this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%231a1a2e%22 width=%22100%22 height=%22100%22/><text x=%2250%22 y=%2255%22 text-anchor=%22middle%22 fill=%22%236c5ce7%22 font-size=%2240%22>🎬</text></svg>';">
                <div class="video-search-card__overlay">
                  <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="6,4 18,12 6,20"/></svg>
                </div>
                <span class="video-search-card__badge">VIDEO</span>
              </div>
              <div class="video-search-card__info">
                <div class="video-search-card__title">${highlightMatch(vid.title, query)}</div>
                <div class="video-search-card__subtitle">${highlightMatch(vid.artist, query)}</div>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }

    html += `</div>`;
    return html;
  }

  /**
   * Bind event listeners for search cards, see all buttons, videos, and playback
   */
  function bindTabEvents(container) {
    const q = state.currentQuery;
    const tab = state.activeTab;

    // See All buttons
    container.querySelectorAll('[data-switch-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.dataset.switchTab;
        switchTab(targetTab);
      });
    });

    // Populate Overview components
    if (tab === 'all') {
      // 1. Overview Songs (Show 10 songs for rich results)
      const songsContainer = document.getElementById('search-overview-songs');
      if (songsContainer && state.results.songs.length > 0) {
        state.results.songs.slice(0, 10).forEach((song, i) => {
          const el = UI.renderSongListItem(song, i);
          const nameEl = el.querySelector('.song-list-item__name');
          const artistEl = el.querySelector('.song-list-item__artist');
          if (nameEl) nameEl.innerHTML = highlightMatch(song.name, q);
          if (artistEl) artistEl.innerHTML = highlightMatch(song.artists, q);

          el.addEventListener('click', async (e) => {
            if (e.target.closest('.btn-icon')) return;
            Player.setQueue(state.results.songs, i);
            await Player.playSong(song, i);
          });
          songsContainer.appendChild(el);
        });
      }

      // 2. Overview Albums
      const albumsContainer = document.getElementById('search-overview-albums');
      if (albumsContainer && state.results.albums.length > 0) {
        state.results.albums.slice(0, 8).forEach((album, i) => {
          const card = UI.renderAlbumCard(album, i);
          const nameEl = card.querySelector('.song-card__name');
          const artistEl = card.querySelector('.song-card__artist');
          if (nameEl) nameEl.innerHTML = highlightMatch(album.title || album.name, q);
          if (artistEl) artistEl.innerHTML = highlightMatch(album.artist, q);
          albumsContainer.appendChild(card);
        });
      }

      // 3. Overview Artists
      const artistsContainer = document.getElementById('search-overview-artists');
      if (artistsContainer && state.results.artists.length > 0) {
        state.results.artists.slice(0, 8).forEach((artist, i) => {
          const card = UI.renderArtistCard(artist, i);
          const nameEl = card.querySelector('.song-card__name');
          if (nameEl) nameEl.innerHTML = highlightMatch(artist.name, q);
          artistsContainer.appendChild(card);
        });
      }

      // 4. Overview Playlists
      const playlistsContainer = document.getElementById('search-overview-playlists');
      if (playlistsContainer && state.results.playlists.length > 0) {
        state.results.playlists.slice(0, 8).forEach((playlist, i) => {
          const card = UI.renderPlaylistCard(playlist, i);
          const nameEl = card.querySelector('.song-card__name');
          if (nameEl) nameEl.innerHTML = highlightMatch(playlist.title || playlist.name, q);
          playlistsContainer.appendChild(card);
        });
      }

      // 5. Overview Mixes
      const mixesContainer = document.getElementById('search-overview-mixes');
      if (mixesContainer && state.results.mixes.length > 0) {
        renderMixCards(mixesContainer, state.results.mixes.slice(0, 6), q);
      }

      // 6. Overview Podcasts
      const podcastsContainer = document.getElementById('search-overview-podcasts');
      if (podcastsContainer && state.results.podcasts.length > 0) {
        renderPodcastCards(podcastsContainer, state.results.podcasts.slice(0, 6), q);
      }
    } else {
      // Dedicated Tab content rendering
      if (tab === 'songs') {
        const list = document.getElementById('search-tab-songs-list');
        if (list) {
          state.results.songs.forEach((song, i) => {
            const el = UI.renderSongListItem(song, i);
            const nameEl = el.querySelector('.song-list-item__name');
            const artistEl = el.querySelector('.song-list-item__artist');
            if (nameEl) nameEl.innerHTML = highlightMatch(song.name, q);
            if (artistEl) artistEl.innerHTML = highlightMatch(song.artists, q);

            el.addEventListener('click', async (e) => {
              if (e.target.closest('.btn-icon')) return;
              Player.setQueue(state.results.songs, i);
              await Player.playSong(song, i);
            });
            list.appendChild(el);
          });
        }
      } else if (tab === 'albums') {
        const grid = document.getElementById('search-tab-albums-grid');
        if (grid) {
          state.results.albums.forEach((album, i) => {
            const card = UI.renderAlbumCard(album, i);
            const nameEl = card.querySelector('.song-card__name');
            const artistEl = card.querySelector('.song-card__artist');
            if (nameEl) nameEl.innerHTML = highlightMatch(album.title || album.name, q);
            if (artistEl) artistEl.innerHTML = highlightMatch(album.artist, q);
            grid.appendChild(card);
          });
        }
      } else if (tab === 'artists') {
        const grid = document.getElementById('search-tab-artists-grid');
        if (grid) {
          state.results.artists.forEach((artist, i) => {
            const card = UI.renderArtistCard(artist, i);
            const nameEl = card.querySelector('.song-card__name');
            if (nameEl) nameEl.innerHTML = highlightMatch(artist.name, q);
            grid.appendChild(card);
          });
        }
      } else if (tab === 'playlists') {
        const grid = document.getElementById('search-tab-playlists-grid');
        if (grid) {
          state.results.playlists.forEach((playlist, i) => {
            const card = UI.renderPlaylistCard(playlist, i);
            const nameEl = card.querySelector('.song-card__name');
            if (nameEl) nameEl.innerHTML = highlightMatch(playlist.title || playlist.name, q);
            grid.appendChild(card);
          });
        }
      } else if (tab === 'mixes') {
        const grid = document.getElementById('search-tab-mixes-grid');
        if (grid) renderMixCards(grid, state.results.mixes, q);
      } else if (tab === 'podcasts') {
        const grid = document.getElementById('search-tab-podcasts-grid');
        if (grid) renderPodcastCards(grid, state.results.podcasts, q);
      }
    }

    // Video card clicks
    container.querySelectorAll('.video-search-card').forEach(card => {
      card.addEventListener('click', async () => {
        const songId = card.dataset.songId;
        const song = state.results.songs.find(s => s.id === songId);
        if (song) {
          Player.setQueue([song], 0);
          await Player.playSong(song);
          if (typeof VideoSwitcher !== 'undefined') {
            VideoSwitcher.switchToMode('video');
          }
        }
      });
    });
  }

  /**
   * Render custom mix cards with gradients and icons
   */
  function renderMixCards(container, mixes, query) {
    mixes.forEach(mix => {
      const card = document.createElement('div');
      card.className = 'song-card mix-suite-card';
      card.innerHTML = `
        <div class="song-card__img-wrap" style="background: ${mix.gradient}; display: flex; align-items: center; justify-content: center; position: relative;">
          <div style="font-size: 48px; filter: drop-shadow(0 4px 12px rgba(0,0,0,0.4));">${mix.icon}</div>
          <span style="position: absolute; top: 10px; left: 10px; font-size: 10px; font-weight: 800; background: rgba(0,0,0,0.6); padding: 3px 8px; border-radius: var(--radius-full); backdrop-filter: blur(10px); color: #fff;">${mix.badge}</span>
          <div class="song-card__play-overlay">
            <svg class="play-icon" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
          </div>
        </div>
        <div class="song-card__info">
          <div class="song-card__name">${highlightMatch(mix.title, query)}</div>
          <div class="song-card__artist">${highlightMatch(mix.subtitle, query)}</div>
        </div>
      `;

      card.addEventListener('click', async () => {
        UI.showToast(`Loading ${mix.title}...`, 'info');
        const songs = await API.searchSongs(mix.query || mix.title, 30);
        if (songs && songs.length > 0) {
          const norm = songs.map(API.normalizeSong);
          Player.setQueue(norm, 0);
          await Player.playSong(norm[0]);
          UI.showToast(`Playing ${mix.title}`, 'success');
        }
      });

      container.appendChild(card);
    });
  }

  /**
   * Render podcast show cards
   */
  function renderPodcastCards(container, shows, query) {
    shows.forEach(show => {
      const card = document.createElement('div');
      card.className = 'podcast-show-card';
      card.innerHTML = `
        <div class="podcast-show-card__cover skeleton" style="background-image: url('${show.image}');">
          <div class="podcast-show-card__overlay">
            <span class="podcast-show-card__category">${show.category}</span>
          </div>
        </div>
        <div class="podcast-show-card__info">
          <h3 class="podcast-show-card__title">${highlightMatch(show.title, query)}</h3>
          <p class="podcast-show-card__host">${highlightMatch(show.host, query)}</p>
        </div>
      `;

      card.addEventListener('click', () => {
        if (typeof Podcasts !== 'undefined' && Podcasts.openPodcastShow) {
          Podcasts.openPodcastShow(show.id);
        }
      });

      container.appendChild(card);
    });
  }

  /**
   * Render Skeleton layout while data is loading
   */
  function renderSearchPageSkeleton(container, query, activeTab) {
    let html = renderTabsBar();
    html += `<div class="search-content-body">`;

    if (activeTab === 'all') {
      // Top result shimmer card
      html += `
        <div class="search-top-result-wrapper">
          <div class="skeleton-text" style="width: 140px; height: 18px; margin-bottom: 12px;"></div>
          <div class="skeleton" style="width: 100%; height: 160px; border-radius: var(--radius-xl); margin-bottom: 24px;"></div>
        </div>
        <div class="search-shelf-section">
          <div class="skeleton-text" style="width: 100px; height: 16px; margin-bottom: 12px;"></div>
          <div class="loading-grid">
            ${[1, 2, 3, 4, 5, 6].map(() => `
              <div class="skeleton-card">
                <div class="skeleton skeleton-img"></div>
                <div class="skeleton skeleton-text"></div>
                <div class="skeleton skeleton-text short"></div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    } else {
      html += `
        <div class="loading-grid-wrap">
          ${[1, 2, 3, 4, 5, 6, 7, 8].map(() => `
            <div class="skeleton-card">
              <div class="skeleton skeleton-img"></div>
              <div class="skeleton skeleton-text"></div>
              <div class="skeleton skeleton-text short"></div>
            </div>
          `).join('')}
        </div>
      `;
    }

    html += `</div>`;
    container.innerHTML = html;
  }

  /**
   * Render Empty state fallback message with search term
   */
  function renderEmptyFallbackHTML(collectionType, query) {
    const formattedType = collectionType === 'results' ? 'results' : collectionType;
    return `
      <div class="empty-state search-empty-state">
        <div class="empty-state__icon">🔍</div>
        <div class="empty-state__title">No ${formattedType} found for "${query}"</div>
        <div class="empty-state__subtitle">Check for typos or try searching with a different artist, song, or mood term.</div>
      </div>
    `;
  }

  /**
   * Render Error state
   */
  function renderSearchError(container, query) {
    container.innerHTML = `
      ${renderTabsBar()}
      <div class="empty-state search-empty-state">
        <div class="empty-state__icon">⚠️</div>
        <div class="empty-state__title">Could not load search results</div>
        <div class="empty-state__subtitle">Please check your connection and try again for "${query}".</div>
        <button class="btn-primary" id="btn-retry-search" style="margin-top: 16px;">Try Again</button>
      </div>
    `;
    document.getElementById('btn-retry-search')?.addEventListener('click', () => {
      executeSearch(query, state.activeTab);
    });
  }

  /**
   * Render Recent Search History view when input is empty
   */
  function renderSearchHistory() {
    UI.showPage('page-search');
    const browseHub = document.getElementById('search-browse-hub');
    const container = document.getElementById('search-results');
    if (browseHub) browseHub.style.display = 'block';
    if (container) container.style.display = 'none';

    initSearchDiscoveryPage();
  }

  /**
   * Initialize Search Discovery Page controls and trending tags
   */
  function initSearchDiscoveryPage() {
    const pageInput = document.getElementById('search-page-input');
    const headerInput = document.getElementById('search-input');
    const pageClear = document.getElementById('search-page-clear');
    const browseHub = document.getElementById('search-browse-hub');
    const resultsArea = document.getElementById('search-results');

    // 1. Render recent searches in chips if available
    const recentSection = document.getElementById('search-recent-section');
    const recentChips = document.getElementById('search-recent-chips');
    const history = (typeof Storage !== 'undefined' && Storage.getSearchHistory) ? Storage.getSearchHistory() : [];
    if (recentSection && recentChips) {
      if (history.length > 0) {
        recentSection.style.display = 'block';
        recentChips.innerHTML = history.slice(0, 10).map(q => `
          <button class="search-trend-chip" data-query="${q}">${q}</button>
        `).join('');

        recentChips.querySelectorAll('.search-trend-chip').forEach(chip => {
          chip.onclick = (e) => {
            e.stopPropagation();
            const query = chip.dataset.query;
            if (pageInput) pageInput.value = query;
            if (headerInput) headerInput.value = query;
            if (pageClear) pageClear.style.display = 'flex';
            executeSearch(query);
          };
        });
      } else {
        recentSection.style.display = 'none';
      }
    }

    // 2. Clear history button
    document.getElementById('btn-clear-search-history')?.addEventListener('click', () => {
      if (typeof Storage !== 'undefined' && Storage.clearSearchHistory) Storage.clearSearchHistory();
      if (recentSection) recentSection.style.display = 'none';
      if (recentChips) recentChips.innerHTML = '';
    });

    // 3. Trending chips & Browse categories click handlers
    document.querySelectorAll('.search-trend-chip, .search-cat-card').forEach(el => {
      el.onclick = (e) => {
        e.stopPropagation();
        const query = el.dataset.query;
        if (!query) return;
        if (pageInput) pageInput.value = query;
        if (headerInput) headerInput.value = query;
        if (pageClear) pageClear.style.display = 'flex';
        executeSearch(query);
      };
    });

    // 4. Input listener for real-time typing
    if (pageInput && !pageInput.dataset.bound) {
      pageInput.dataset.bound = 'true';
      let debounceTimer = null;

      pageInput.addEventListener('input', () => {
        const rawVal = pageInput.value;
        const q = rawVal.trim();
        if (headerInput && headerInput !== document.activeElement) headerInput.value = rawVal;
        if (pageClear) pageClear.style.display = rawVal.length > 0 ? 'flex' : 'none';

        if (!q) {
          if (browseHub) browseHub.style.display = 'block';
          if (resultsArea) resultsArea.style.display = 'none';
          initSearchDiscoveryPage();
          return;
        }

        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          if (typeof Storage !== 'undefined' && Storage.addSearchHistory) Storage.addSearchHistory(q);
          executeSearch(q);
        }, 360);
      });

      pageInput.addEventListener('keydown', (e) => {
        if (e.key === ' ' || e.code === 'Space') {
          e.stopPropagation();
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          clearTimeout(debounceTimer);
          const q = pageInput.value.trim();
          if (q) {
            if (typeof Storage !== 'undefined' && Storage.addSearchHistory) Storage.addSearchHistory(q);
            executeSearch(q);
          }
        }
      });
    }

    // 5. Clear button click handler
    if (pageClear && !pageClear.dataset.bound) {
      pageClear.dataset.bound = 'true';
      pageClear.onclick = (e) => {
        e.stopPropagation();
        if (pageInput) pageInput.value = '';
        if (headerInput) headerInput.value = '';
        pageClear.style.display = 'none';
        if (browseHub) browseHub.style.display = 'block';
        if (resultsArea) resultsArea.style.display = 'none';
        initSearchDiscoveryPage();
        pageInput?.focus();
      };
    }
  }

  /**
   * Setup Infinite Scroll listener on scroll container
   */
  function setupInfiniteScroll() {
    if (scrollListenerAttached) return;
    scrollListenerAttached = true;

    const mainContent = document.getElementById('main-content') || window;

    mainContent.addEventListener('scroll', () => {
      if (state.activeTab === 'all' || state.isLoadingMore || !state.currentQuery) return;

      clearTimeout(infiniteScrollDebounce);
      infiniteScrollDebounce = setTimeout(() => {
        const sentinel = document.getElementById('search-infinite-sentinel');
        if (!sentinel) return;

        const rect = sentinel.getBoundingClientRect();
        const windowHeight = window.innerHeight || document.documentElement.clientHeight;

        if (rect.top <= windowHeight + 300) {
          loadMore(state.activeTab);
        }
      }, 150);
    }, { passive: true });
  }

  return {
    TABS,
    getState: () => state,
    highlightMatch,
    executeSearch,
    switchTab,
    loadMore,
    renderSearchHistory,
    initSearchDiscoveryPage
  };
})();

window.SearchEngine = SearchEngine;
