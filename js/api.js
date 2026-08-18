// ========================================
// MusicFlow — JioSaavn API Service Layer
// ========================================

const API = (() => {
  // Public JioSaavn API instances (unofficial)
  // Users can self-host on Vercel for reliability
  const localApiUrl = window.location.hostname === 'localhost' 
    ? 'http://localhost:3001' 
    : `http://${window.location.hostname}:3001`;

  const INSTANCES = [
    'https://spoton-trpn.vercel.app',
    localApiUrl,
    'https://saavn.dev',
    'https://jiosaavn-api-privatecvc2.vercel.app',
    'https://saavn.me',
  ];

  let currentInstanceIndex = 0;
  let baseUrl = INSTANCES[0];

  /**
   * Set a custom API base URL (e.g., self-hosted instance)
   */
  function setBaseUrl(url) {
    baseUrl = url.replace(/\/+$/, '');
  }

  function getBaseUrl() {
    return baseUrl;
  }

  /**
   * Try next instance if current fails
   */
  function rotateInstance() {
    currentInstanceIndex = (currentInstanceIndex + 1) % INSTANCES.length;
    baseUrl = INSTANCES[currentInstanceIndex];
    console.log(`[API] Rotating to instance: ${baseUrl}`);
  }

  /**
   * Core fetch wrapper with retry & instance fallback
   * Each request independently tries instances without mutating shared state
   */
  async function request(endpoint, retries = 2) {
    let lastError = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      const instanceUrl = INSTANCES[(currentInstanceIndex + attempt) % INSTANCES.length];
      const url = `${instanceUrl}${endpoint}`;

      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();
        // On success, remember this working instance
        currentInstanceIndex = INSTANCES.indexOf(instanceUrl);
        baseUrl = instanceUrl;
        return data;
      } catch (error) {
        console.warn(`[API] Attempt ${attempt + 1} failed for ${url}:`, error.message);
        lastError = error;
      }
    }

    throw lastError;
  }

  // ---- Search Endpoints ----

  /**
   * Search for songs
   * @param {string} query - Search term
   * @param {number} limit - Max results (default 20)
   * @returns {Promise<Array>} Array of song objects
   */
  async function searchSongs(query, limit = 50) {
    const data = await request(`/api/search/songs?query=${encodeURIComponent(query)}&limit=${limit}`);
    return data?.data?.results || [];
  }

  /**
   * Search for albums
   * @param {string} query - Search term
   * @param {number} limit - Max results
   * @returns {Promise<Array>} Array of album objects
   */
  async function searchAlbums(query, limit = 50) {
    const data = await request(`/api/search/albums?query=${encodeURIComponent(query)}&limit=${limit}`);
    return data?.data?.results || [];
  }

  /**
   * Search for artists
   * @param {string} query - Search term
   * @param {number} limit - Max results
   * @returns {Promise<Array>} Array of artist objects
   */
  async function searchArtists(query, limit = 50) {
    const data = await request(`/api/search/artists?query=${encodeURIComponent(query)}&limit=${limit}`);
    return data?.data?.results || [];
  }

  /**
   * Global search (songs + albums + artists)
   * @param {string} query - Search term
   * @returns {Promise<Object>} Combined search results
   */
  async function searchAll(query) {
    const data = await request(`/api/search?query=${encodeURIComponent(query)}`);
    return data?.data || {};
  }

  // ---- Recommendations Aggregator ----

  async function getHomeRecommendations() {
    const cached = Storage.getHomeCache();
    // Only use cache if it has actual content
    if (cached && cached.trending && cached.trending.length > 0) {
      console.log('[API] Using cached home recommendations');
      return cached;
    }

    const prefs = Storage.getSettings().languages || [];
    const mainLang = prefs.length > 0 ? prefs[0] : '';
    const langSuffix = mainLang ? ` ${mainLang}` : '';

    const queries = {
      trending: { type: 'songs', query: `trending hits${langSuffix}` },
      global: { type: 'songs', query: `top 50${langSuffix}` },
      newReleases: { type: 'songs', query: `new releases${langSuffix}` },
      chill: { type: 'songs', query: 'lo-fi chill' },
      focus: { type: 'songs', query: 'deep focus' },
      workout: { type: 'songs', query: 'workout hits' },
      popularArtists: { type: 'artists', query: `popular artists${langSuffix}` },
      popularAlbums: { type: 'albums', query: `top albums${langSuffix}` }
    };

    const keys = Object.keys(queries);
    const promises = keys.map(k => {
      const q = queries[k];
      if (q.type === 'songs') return searchSongs(q.query, 50);
      if (q.type === 'artists') return searchArtists(q.query, 20);
      if (q.type === 'albums') return searchAlbums(q.query, 20);
      return Promise.resolve([]);
    });

    try {
      const results = await Promise.allSettled(promises);
      const data = {};
      
      const seenIds = new Set();
      
      keys.forEach((k, index) => {
        let items = results[index].status === 'fulfilled' ? results[index].value : [];
        
        // Deduplicate songs across categories
        if (queries[k].type === 'songs') {
          items = items.filter(item => {
            if (seenIds.has(item.id)) return false;
            seenIds.add(item.id);
            return true;
          });
        }
        
        data[k] = items;
      });

      // Populate hero with a random trending song (if available)
      data.hero = data.trending.length > 0 ? data.trending[0] : null;

      // Only cache if we got actual data
      const hasData = keys.some(k => data[k] && data[k].length > 0);
      if (hasData) {
        Storage.setHomeCache(data);
      }
      return data;
    } catch (e) {
      console.warn('[API] Home recommendations failed', e);
      return {};
    }
  }

  // ---- Detail Endpoints ----

  /**
   * Get full song details including stream URLs
   * @param {string|Array<string>} ids - Song ID(s)
   * @returns {Promise<Array>} Array of song detail objects
   */
  async function getSongDetails(ids) {
    const idStr = Array.isArray(ids) ? ids.join(',') : ids;
    const data = await request(`/api/songs/${idStr}`);
    return data?.data || [];
  }

  /**
   * Get album details with all tracks
   * @param {string} id - Album ID
   * @returns {Promise<Object>} Album object with songs
   */
  async function getAlbumDetails(id) {
    const data = await request(`/api/albums?id=${id}`);
    return data?.data || null;
  }

  /**
   * Get playlist details with all tracks
   * @param {string} id - Playlist ID
   * @returns {Promise<Object>} Playlist object with songs
   */
  async function getPlaylistDetails(id, limit = 100) {
    const data = await request(`/api/playlists?id=${id}&limit=${limit}`);
    return data?.data || null;
  }

  /**
   * Get artist details
   * @param {string} id - Artist ID
   * @returns {Promise<Object>} Artist object
   */
  async function getArtistDetails(id) {
    const data = await request(`/api/artists/${id}`);
    return data?.data || null;
  }

  /**
   * Get lyrics (synced or plain) for a track
   * @param {string} trackName - Song name
   * @param {string} artistName - Artist name
   * @param {number} duration - Duration in seconds
   * @returns {Promise<Object|null>}
   */
  async function getLyrics(trackName, artistName, duration) {
    if (!trackName) return null;
    const cleanTitle = trackName.replace(/\(.*?\)|\[.*?\]/g, '').trim();
    const cleanArtist = (artistName || '').split(',')[0].split('&')[0].trim();

    // 1. Try LRCLIB exact match (supports both synced & plain lyrics)
    try {
      let url = `https://lrclib.net/api/get?track_name=${encodeURIComponent(cleanTitle)}&artist_name=${encodeURIComponent(cleanArtist)}`;
      if (duration) url += `&duration=${Math.round(duration)}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.syncedLyrics || data.plainLyrics) {
          return {
            synced: data.syncedLyrics || null,
            plain: data.plainLyrics || data.syncedLyrics
          };
        }
      }
    } catch (e) {}

    // 2. Try LRCLIB search query
    try {
      const searchRes = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(cleanTitle + ' ' + cleanArtist)}`);
      if (searchRes.ok) {
        const results = await searchRes.json();
        if (results && results.length > 0) {
          const match = results[0];
          return {
            synced: match.syncedLyrics || null,
            plain: match.plainLyrics || match.syncedLyrics
          };
        }
      }
    } catch (e) {}

    // 3. Fallback to Lyrics.ovh
    try {
      const ovhRes = await fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(cleanArtist)}/${encodeURIComponent(cleanTitle)}`);
      if (ovhRes.ok) {
        const ovhData = await ovhRes.json();
        if (ovhData.lyrics) {
          return { synced: null, plain: ovhData.lyrics };
        }
      }
    } catch (e) {}

    return null;
  }

  // ---- Helpers ----

  /**
   * Extract the best quality download URL from song data
   * @param {Object} song - Song object from API
   * @returns {string|null} Best quality URL
   */
  function getBestDownloadUrl(song) {
    if (!song?.downloadUrl) return null;

    const urls = song.downloadUrl;
    if (Array.isArray(urls)) {
      // Pick highest quality (last in array is usually 320kbps)
      const best = urls[urls.length - 1];
      return best?.url || best?.link || null;
    }

    // Sometimes it's a direct string
    if (typeof urls === 'string') return urls;

    return null;
  }

  /**
   * Get a specific quality download URL
   * @param {Object} song - Song object
   * @param {string} quality - '12kbps', '48kbps', '96kbps', '160kbps', '320kbps'
   * @returns {string|null}
   */
  function getDownloadUrl(song, quality = '320kbps') {
    if (!song?.downloadUrl || !Array.isArray(song.downloadUrl)) {
      return getBestDownloadUrl(song);
    }
    const match = song.downloadUrl.find(u => u.quality === quality);
    return match?.url || match?.link || getBestDownloadUrl(song);
  }

  /**
   * Get the best quality image URL from song/album data
   * @param {Object} item - Song/album object
   * @returns {string} Image URL
   */
  function getImageUrl(item) {
    if (!item?.image) return '';

    const images = item.image;
    if (Array.isArray(images)) {
      const best = images[images.length - 1];
      return best?.url || best?.link || '';
    }
    if (typeof images === 'string') return images;
    return '';
  }

  /**
   * Safely extract artists from various API response formats
   * @param {Object} raw - Raw song from API
   * @returns {string} Comma-separated artists
   */
  function getArtistsString(raw) {
    if (!raw) return 'Unknown Artist';
    
    if (typeof raw.artists === 'string') return raw.artists;
    
    if (Array.isArray(raw.artists)) {
      return raw.artists.map(a => a.name || a).join(', ');
    }
    
    if (raw.artists && typeof raw.artists === 'object') {
      if (Array.isArray(raw.artists.primary) && raw.artists.primary.length > 0) {
        return raw.artists.primary.map(a => a.name || a).join(', ');
      }
      if (Array.isArray(raw.artists.all) && raw.artists.all.length > 0) {
        return raw.artists.all.map(a => a.name || a).join(', ');
      }
    }
    
    if (typeof raw.primaryArtists === 'string') return raw.primaryArtists;
    if (Array.isArray(raw.primaryArtists)) return raw.primaryArtists.map(a => a.name || a).join(', ');
    
    if (typeof raw.artist === 'string') return raw.artist;
    
    return 'Unknown Artist';
  }

  /**
   * Normalize a song object for consistent usage
   * @param {Object} raw - Raw song from API
   * @returns {Object} Normalized song
   */
  function normalizeSong(raw) {
    return {
      id: raw.id,
      name: raw.name || raw.title || 'Unknown',
      artists: getArtistsString(raw),
      album: raw.album?.name || raw.album || '',
      duration: raw.duration || 0,
      image: getImageUrl(raw),
      streamUrl: getBestDownloadUrl(raw),
      downloadUrls: raw.downloadUrl || [],
      year: raw.year || '',
      language: raw.language || '',
      hasLyrics: raw.hasLyrics || false,
      raw: raw,
    };
  }

  /**
   * Get a high-resolution version of an image URL
   * @param {string} imageUrl - Original image URL
   * @returns {string} High-res image URL
   */
  function getHighResImage(imageUrl) {
    if (!imageUrl) return '';
    return imageUrl
      .replace('50x50', '500x500')
      .replace('150x150', '500x500')
      .replace('175x175', '500x500');
  }

  return {
    setBaseUrl,
    getBaseUrl,
    searchSongs,
    searchAlbums,
    searchArtists,
    searchAll,
    getHomeRecommendations,
    getSongDetails,
    getAlbumDetails,
    getPlaylistDetails,
    getArtistDetails,
    getLyrics,
    getBestDownloadUrl,
    getDownloadUrl,
    getImageUrl,
    getHighResImage,
    normalizeSong,
  };
})();
