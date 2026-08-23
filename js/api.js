// ========================================
// MusicFlow — JioSaavn API Service Layer
// ========================================

const API = (() => {
  // Public JioSaavn API instances (unofficial)
  // Users can self-host on Vercel for reliability
  // Only offer the local dev API when actually running on localhost / LAN over http.
  // On a deployed https origin an http://host:3001 entry is mixed content — it can
  // never succeed and would just burn a fetch timeout during instance rotation.
  const isLocalDev = window.location.protocol === 'http:' &&
    /^(localhost|127\.|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(window.location.hostname);
  const localApiUrl = `http://${window.location.hostname}:3001`;

  const INSTANCES = isLocalDev
    ? [localApiUrl, 'https://spoton-trpn.vercel.app', 'https://jiosaavn-api-sage.vercel.app']
    : ['https://spoton-trpn.vercel.app', 'https://jiosaavn-api-sage.vercel.app'];

  let currentInstanceIndex = 0;
  let baseUrl = INSTANCES[0];
  const memoryCache = new Map();

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
  }

  /**
   * Core fetch wrapper with fast timeout, memory caching & instance fallback
   */
  async function request(endpoint, retries = INSTANCES.length) {
    const cacheKey = endpoint;
    if (memoryCache.has(cacheKey)) {
      const entry = memoryCache.get(cacheKey);
      if (Date.now() - entry.time < 300000) { // 5 min cache
        return entry.data;
      }
    }

    let lastError = null;

    for (let attempt = 0; attempt < retries; attempt++) {
      const instanceUrl = INSTANCES[(currentInstanceIndex + attempt) % INSTANCES.length];
      const url = `${instanceUrl}${endpoint}`;
      const timeoutMs = instanceUrl.includes(':3001') ? 1800 : 3000;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();
        currentInstanceIndex = INSTANCES.indexOf(instanceUrl);
        baseUrl = instanceUrl;

        memoryCache.set(cacheKey, { time: Date.now(), data });
        return data;
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error('All API instances failed');
  }

  // ---- Search Endpoints ----

  /**
   * Search for songs
   * @param {string} query - Search term
   * @param {number} limit - Max results (default 50)
   * @param {number} page - Page number (default 1)
   * @returns {Promise<Array>} Array of song objects
   */
  async function searchSongs(query, limit = 50, page = 1) {
    const data = await request(`/api/search/songs?query=${encodeURIComponent(query)}&limit=${limit}&page=${page}`);
    return data?.data?.results || [];
  }

  /**
   * Search for albums
   * @param {string} query - Search term
   * @param {number} limit - Max results
   * @param {number} page - Page number
   * @returns {Promise<Array>} Array of album objects
   */
  async function searchAlbums(query, limit = 50, page = 1) {
    const data = await request(`/api/search/albums?query=${encodeURIComponent(query)}&limit=${limit}&page=${page}`);
    return data?.data?.results || [];
  }

  /**
   * Search for artists
   * @param {string} query - Search term
   * @param {number} limit - Max results
   * @param {number} page - Page number
   * @returns {Promise<Array>} Array of artist objects
   */
  async function searchArtists(query, limit = 50, page = 1) {
    const data = await request(`/api/search/artists?query=${encodeURIComponent(query)}&limit=${limit}&page=${page}`);
    return data?.data?.results || [];
  }

  /**
   * Search for playlists
   * @param {string} query - Search term
   * @param {number} limit - Max results
   * @param {number} page - Page number
   * @returns {Promise<Array>} Array of playlist objects
   */
  async function searchPlaylists(query, limit = 50, page = 1) {
    const data = await request(`/api/search/playlists?query=${encodeURIComponent(query)}&limit=${limit}&page=${page}`);
    return data?.data?.results || [];
  }

  /**
   * Global search (songs + albums + artists + playlists)
   * @param {string} query - Search term
   * @returns {Promise<Object>} Combined search results
   */
  async function searchAll(query) {
    const data = await request(`/api/search?query=${encodeURIComponent(query)}`);
    return data?.data || {};
  }

  // ---- Recommendations Aggregator ----

  async function getHomeRecommendations(forceRefresh = false) {
    if (!forceRefresh) {
      const cached = Storage.getHomeCache();
      if (cached && cached.trending && cached.trending.length > 0) {
        return cached;
      }
    }

    const prefs = (typeof Storage !== 'undefined' && Storage.getSettings && Storage.getSettings().languages) ? Storage.getSettings().languages : [];
    const userLangs = prefs.length > 0 ? prefs.map(l => String(l).toLowerCase()) : ['hindi', 'english'];
    const primaryLang = userLangs[0] || 'hindi';
    const secondaryLang = userLangs[1] || primaryLang;

    // Dynamic rotation pools matching user's selected languages
    const trendingPool = [
      `top ${primaryLang} songs`,
      `trending ${primaryLang} hits`,
      `latest ${primaryLang} chartbusters`,
      `top songs 2026 ${primaryLang}`,
      `top ${secondaryLang} viral hits`
    ];

    const globalPool = [
      `top global songs`,
      `worldwide viral hits`,
      `top international hits`,
      `billboard hot 100`,
      `top ${primaryLang} songs`
    ];

    const newReleasesPool = [
      `new ${primaryLang} songs 2026`,
      `latest ${primaryLang} singles`,
      `fresh ${primaryLang} music drops`,
      `new releases ${secondaryLang}`
    ];

    const chillPool = [
      `chill ${primaryLang} songs`,
      `acoustic ${primaryLang} melodies`,
      `late night ${primaryLang} vibes`,
      `lo-fi chillhop beats`,
      `peaceful piano melodies`
    ];

    const focusPool = [
      'deep focus electronic',
      'instrumental study flow',
      'chillwave beats',
      'lo-fi sleep study',
      `relaxing ${primaryLang} instrumental`
    ];

    const workoutPool = [
      `workout ${primaryLang} gym hits`,
      'high energy edm festival',
      'banger hip hop hype',
      'motivational running beats',
      `fast beats ${primaryLang}`
    ];

    const artistPool = [
      `top ${primaryLang} singers`,
      `famous ${primaryLang} artists`,
      `legendary ${primaryLang} vocalists`,
      `trending ${secondaryLang} artists`
    ];

    const albumPool = [
      `top ${primaryLang} albums`,
      `blockbuster ${primaryLang} movie albums`,
      `latest ${primaryLang} soundtrack albums`,
      `trending ${secondaryLang} albums`
    ];

    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

    const queries = {
      trending: { type: 'songs', query: pick(trendingPool) },
      global: { type: 'songs', query: pick(globalPool) },
      newReleases: { type: 'songs', query: pick(newReleasesPool) },
      chill: { type: 'songs', query: pick(chillPool) },
      focus: { type: 'songs', query: pick(focusPool) },
      workout: { type: 'songs', query: pick(workoutPool) },
      popularArtists: { type: 'artists', query: pick(artistPool) },
      popularAlbums: { type: 'albums', query: pick(albumPool) }
    };

    const keys = Object.keys(queries);
    const promises = keys.map(k => {
      const q = queries[k];
      if (q.type === 'songs') return searchSongs(q.query, 16);
      if (q.type === 'artists') return searchArtists(q.query, 12);
      if (q.type === 'albums') return searchAlbums(q.query, 12);
      return Promise.resolve([]);
    });

    try {
      const results = await Promise.allSettled(promises);
      const data = {};
      const seenIds = new Set();

      keys.forEach((k, index) => {
        let items = results[index].status === 'fulfilled' ? results[index].value : [];
        if (queries[k].type === 'songs') {
          // Strictly filter by user language preferences
          items = filterByLanguagePrefs(items, { minKeep: 6 });
          // Shuffle slightly to give variety
          items = items.sort(() => Math.random() - 0.5);
          items = items.filter(item => {
            if (seenIds.has(item.id)) return false;
            seenIds.add(item.id);
            return true;
          });
        }
        data[k] = items;
      });

      // Pick a random exciting hero song from top trending
      const heroPool = [...(data.trending || []), ...(data.global || []), ...(data.newReleases || [])];
      data.hero = heroPool.length > 0 ? heroPool[Math.floor(Math.random() * Math.min(10, heroPool.length))] : null;

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
    try {
      const data = await request(`/api/songs/${idStr}`);
      if (Array.isArray(data?.data)) {
        return data.data;
      }
      if (data?.data && typeof data.data === 'object') {
        if (Array.isArray(data.data.songs)) return data.data.songs;
        if (Array.isArray(data.data.results)) return data.data.results;
        if (data.data.id || data.data.name) return [data.data];
      }
      if (Array.isArray(data)) return data;
      return [];
    } catch (e) {
      console.warn(`[API] getSongDetails failed for ${idStr}:`, e);
      return [];
    }
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
   * @param {number} songCount - Number of top songs
   * @param {number} albumCount - Number of albums
   * @returns {Promise<Object>} Artist object
   */
  async function getArtistDetails(id, songCount = 50, albumCount = 50) {
    const data = await request(`/api/artists/${id}?songCount=${songCount}&albumCount=${albumCount}`);
    return data?.data || null;
  }

  /**
   * Get paginated songs for an artist
   * @param {string} id - Artist ID
   * @param {number} page - Page index (0-indexed)
   * @param {string} sortBy - 'popularity' | 'latest' | 'alphabetical'
   * @returns {Promise<Array>}
   */
  async function getArtistSongs(id, page = 0, sortBy = 'popularity', sortOrder = 'desc') {
    const data = await request(`/api/artists/${id}/songs?page=${page}&sortBy=${sortBy}&sortOrder=${sortOrder}`);
    return data?.data?.songs || data?.data?.results || data?.data || [];
  }

  /**
   * Get paginated albums for an artist
   * @param {string} id - Artist ID
   * @param {number} page - Page index (0-indexed)
   * @returns {Promise<Array>}
   */
  async function getArtistAlbums(id, page = 0) {
    const data = await request(`/api/artists/${id}/albums?page=${page}`);
    return data?.data?.albums || data?.data?.results || data?.data || [];
  }

  /**
   * Get lyrics (synced or plain) for a track
   * @param {string} trackName - Song name
   * @param {string} artistName - Artist name
   * @param {number} duration - Duration in seconds
   * @returns {Promise<Object|null    */
  const _lyricsMemoryCache = new Map();

  async function getLyrics(trackName, artistName, duration) {
    if (!trackName) return null;
    const cleanTitle = trackName
      .replace(/\(.*?\)|\[.*?\]/g, '')
      .replace(/feat\..*|ft\..*|prod\..*|official.*|slowed.*|reverb.*/gi, '')
      .trim();
    const rawFirstArtist = (artistName || '').split(',')[0].split('&')[0].trim();
    const cleanArtist = rawFirstArtist.replace(/feat\..*|ft\..*/gi, '').trim();
    const cacheKey = `${cleanTitle.toLowerCase()}__${cleanArtist.toLowerCase()}`;

    // 1. Instant Cache Check (0ms response)
    if (_lyricsMemoryCache.has(cacheKey)) {
      return _lyricsMemoryCache.get(cacheKey);
    }

    try {
      const stored = localStorage.getItem(`mf_lyrics_${cacheKey}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && (parsed.synced || parsed.plain)) {
          _lyricsMemoryCache.set(cacheKey, parsed);
          return parsed;
        }
      }
    } catch (_) {}

    // 2. Fast Parallel Multi-Query Execution (<500ms)
    const queries = [
      `https://lrclib.net/api/search?q=${encodeURIComponent(`${cleanTitle} ${cleanArtist}`.trim())}`,
      `https://lrclib.net/api/get?track_name=${encodeURIComponent(cleanTitle)}&artist_name=${encodeURIComponent(cleanArtist)}` + (duration ? `&duration=${Math.round(duration)}` : ''),
      `https://lrclib.net/api/search?q=${encodeURIComponent(cleanTitle)}`
    ];

    if (artistName && artistName.includes(',')) {
      const secondaryArtist = (artistName.split(',')[1] || '').trim();
      if (secondaryArtist) {
        queries.push(`https://lrclib.net/api/search?q=${encodeURIComponent(`${cleanTitle} ${secondaryArtist}`)}`);
      }
    }

    try {
      const fetchPromises = queries.map(async (url) => {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 2500);
          const res = await fetch(url, { signal: controller.signal });
          clearTimeout(timer);
          if (!res.ok) return null;
          const json = await res.json();
          if (Array.isArray(json)) {
            return json.find(d => d.syncedLyrics) || json[0] || null;
          }
          return json;
        } catch {
          return null;
        }
      });

      const candidates = await Promise.all(fetchPromises);
      const match = candidates.find(c => c && c.syncedLyrics) || candidates.find(c => c && c.plainLyrics);

      if (match && (match.syncedLyrics || match.plainLyrics)) {
        const result = {
          synced: match.syncedLyrics || null,
          plain: match.plainLyrics || match.syncedLyrics
        };
        _lyricsMemoryCache.set(cacheKey, result);
        try {
          localStorage.setItem(`mf_lyrics_${cacheKey}`, JSON.stringify(result));
        } catch (_) {}
        return result;
      }
    } catch (_) {}

    return null;
  }

  // ---- Helpers ----

  /**
   * Extract the best quality download URL from song data
   * @param {Object} song - Song object from API
   * @returns {string|null} Best quality URL
   */
  function getBestDownloadUrl(song) {
    if (!song) return null;

    const urls = song.downloadUrl || song.downloadUrls || song.download_url || song.media_url;
    if (Array.isArray(urls) && urls.length > 0) {
      // Look for 320kbps first, then 160kbps, then last element
      const match320 = urls.find(u => (u?.quality === '320kbps' || u?.bitrate === '320') && (u?.url || u?.link));
      if (match320) return match320.url || match320.link;
      const match160 = urls.find(u => (u?.quality === '160kbps' || u?.bitrate === '160') && (u?.url || u?.link));
      if (match160) return match160.url || match160.link;
      
      const best = urls[urls.length - 1];
      if (typeof best === 'string') return best;
      return best?.url || best?.link || null;
    }

    // Direct strings
    if (typeof urls === 'string' && urls.startsWith('http')) return urls;
    if (typeof song.streamUrl === 'string' && song.streamUrl.startsWith('http')) return song.streamUrl;
    if (typeof song.audioUrl === 'string' && song.audioUrl.startsWith('http')) return song.audioUrl;
    if (typeof song.url === 'string' && (song.url.endsWith('.mp4') || song.url.endsWith('.mp3') || song.url.endsWith('.m4a'))) return song.url;

    return null;
  }

  /**
   * Get a specific quality download URL
   * @param {Object} song - Song object
   * @param {string} quality - '12kbps', '48kbps', '96kbps', '160kbps', '320kbps'
   * @returns {string|null}
   */
  function getDownloadUrl(song, quality = '320kbps') {
    if (!song) return null;
    const urls = song.downloadUrl || song.downloadUrls || song.download_url;
    if (!urls || !Array.isArray(urls)) {
      return getBestDownloadUrl(song);
    }
    const match = urls.find(u => u?.quality === quality);
    return match?.url || match?.link || getBestDownloadUrl(song);
  }

  /**
   * Get the best quality image URL from song/album data
   * @param {Object|string} item - Song/album object or image string
   * @returns {string} Image URL
   */
  function getImageUrl(item) {
    if (!item) return '';
    if (typeof item === 'string') return item;
    
    let images = item.image || item.imageUrl || item.images;
    if (!images) return '';

    if (typeof images === 'string') return images;
    if (Array.isArray(images) && images.length > 0) {
      const best = images[images.length - 1];
      if (typeof best === 'string') return best;
      return best?.url || best?.link || '';
    }
    if (typeof images === 'object') {
      return images.url || images.link || '';
    }
    return '';
  }

  /**
   * Decode HTML entities in text strings returned by the API
   * @param {string} str - String with entities like &quot;, &amp;, &#039;
   * @returns {string} Clean decoded string
   */
  function decodeHtml(str) {
    if (!str) return '';
    if (typeof str !== 'string') {
      if (typeof str === 'object') {
        str = str.name || str.title || str.artist || '';
      } else {
        str = String(str);
      }
    }
    return str
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
      .trim();
  }

  /**
   * Safely extract artists from various API response formats
   * @param {Object} raw - Raw song from API
   * @returns {string} Comma-separated artists
   */
  function getArtistsString(raw) {
    if (!raw) return 'Unknown Artist';
    
    function extractArtistName(a) {
      if (!a) return '';
      if (typeof a === 'string') return a !== '[object Object]' ? a : '';
      if (typeof a === 'object') {
        return a.name || a.title || a.artist || a.role || '';
      }
      return String(a);
    }

    let result = '';
    if (typeof raw.artists === 'string' && raw.artists !== '[object Object]') {
      result = raw.artists;
    } else if (Array.isArray(raw.artists)) {
      result = raw.artists.map(extractArtistName).filter(Boolean).join(', ');
    } else if (raw.artists && typeof raw.artists === 'object') {
      if (Array.isArray(raw.artists.primary) && raw.artists.primary.length > 0) {
        result = raw.artists.primary.map(extractArtistName).filter(Boolean).join(', ');
      } else if (raw.artists.primary && typeof raw.artists.primary === 'object') {
        result = extractArtistName(raw.artists.primary);
      } else if (Array.isArray(raw.artists.all) && raw.artists.all.length > 0) {
        result = raw.artists.all.map(extractArtistName).filter(Boolean).join(', ');
      } else if (raw.artists.name) {
        result = raw.artists.name;
      }
    }
    
    if (!result || result.trim() === '' || result.includes('[object Object]')) {
      if (typeof raw.primaryArtists === 'string' && raw.primaryArtists !== '[object Object]') {
        result = raw.primaryArtists;
      } else if (Array.isArray(raw.primaryArtists)) {
        result = raw.primaryArtists.map(extractArtistName).filter(Boolean).join(', ');
      } else if (typeof raw.featuredArtists === 'string' && raw.featuredArtists !== '[object Object]') {
        result = raw.featuredArtists;
      } else if (Array.isArray(raw.featuredArtists)) {
        result = raw.featuredArtists.map(extractArtistName).filter(Boolean).join(', ');
      } else if (typeof raw.artist === 'string' && raw.artist !== '[object Object]') {
        result = raw.artist;
      } else if (Array.isArray(raw.artist)) {
        result = raw.artist.map(extractArtistName).filter(Boolean).join(', ');
      } else if (raw.artist && typeof raw.artist === 'object') {
        result = extractArtistName(raw.artist);
      } else if (typeof raw.subtitle === 'string' && raw.subtitle !== '[object Object]') {
        result = raw.subtitle;
      } else if (raw.more_info) {
        if (typeof raw.more_info.singers === 'string') result = raw.more_info.singers;
        else if (typeof raw.more_info.music === 'string') result = raw.more_info.music;
        else if (typeof raw.more_info.artistMap?.primary_artists === 'string') result = raw.more_info.artistMap.primary_artists;
      }
    }

    if (!result || result.trim() === '' || result.includes('[object Object]')) {
      result = 'Unknown Artist';
    }
    
    return decodeHtml(result);
  }

  /**
   * Normalize a song object for consistent usage
   * @param {Object} raw - Raw song from API
   * @returns {Object} Normalized song
   */
  function normalizeSong(raw) {
    if (!raw) return null;
    const name = decodeHtml(raw.name || raw.title || 'Unknown');
    const artists = getArtistsString(raw);
    const album = decodeHtml(raw.album?.name || raw.album || '');
    let img = getImageUrl(raw) || '';
    if (typeof img === 'object' && img !== null) {
      img = (Array.isArray(img) ? (img[img.length - 1]?.url || img[img.length - 1]?.link) : (img.url || img.link)) || '';
    }
    if (typeof img !== 'string' || img.includes('[object Object]')) {
      img = '';
    }
    img = getHighResImage(img) || img || '';
    if (typeof img !== 'string' || img.includes('[object Object]')) {
      img = '';
    }

    let audioUrl = getBestDownloadUrl(raw) || raw.streamUrl || raw.audioUrl || '';
    if (typeof audioUrl === 'object' && audioUrl !== null) {
      audioUrl = audioUrl.url || audioUrl.link || '';
    }
    if (typeof audioUrl !== 'string' || audioUrl.includes('[object Object]')) {
      audioUrl = '';
    }

    const downloadUrlsList = Array.isArray(raw.downloadUrl) 
      ? raw.downloadUrl 
      : (Array.isArray(raw.downloadUrls) ? raw.downloadUrls : (audioUrl ? [{ quality: '320kbps', url: audioUrl }] : []));

    return {
      id: String(raw.id || `track_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`),
      name: name,
      title: name,
      artists: artists,
      artist: artists,
      album: album,
      duration: Number(raw.duration) || 0,
      image: img,
      imageUrl: img,
      streamUrl: audioUrl,
      audioUrl: audioUrl,
      downloadUrl: downloadUrlsList,
      downloadUrls: downloadUrlsList,
      year: raw.year || '',
      language: raw.language || '',
      hasLyrics: Boolean(raw.hasLyrics),
      raw: raw,
    };
  }

  /**
   * Get a high-resolution version of an image URL
   * @param {string|Array|Object} imageUrl - Original image URL or object
   * @returns {string} High-res image URL
   */
  function getHighResImage(imageUrl) {
    if (!imageUrl) return '';
    if (typeof imageUrl !== 'string') {
      if (Array.isArray(imageUrl)) {
        const best = imageUrl[imageUrl.length - 1];
        imageUrl = best?.url || best?.link || '';
      } else if (typeof imageUrl === 'object') {
        imageUrl = imageUrl.url || imageUrl.link || '';
      }
    }
    if (typeof imageUrl !== 'string') return '';
    return imageUrl
      .replace('50x50', '500x500')
      .replace('150x150', '500x500')
      .replace('175x175', '500x500');
  }

  /**
   * Normalize an album object for consistent usage
   */
  function normalizeAlbum(raw) {
    if (!raw) return null;
    const title = decodeHtml(raw.name || raw.title || 'Unknown Album');
    const artist = decodeHtml(raw.artist || raw.music || (Array.isArray(raw.artists) ? raw.artists.map(a => a.name || a).join(', ') : (raw.primaryArtists || 'Various Artists')));
    const img = getHighResImage(getImageUrl(raw)) || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%231a1a2e" width="100" height="100"/><text x="50" y="55" text-anchor="middle" fill="%236c5ce7" font-size="40">🎵</text></svg>';
    return {
      id: raw.id || `alb_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      title: title,
      name: title,
      artist: artist,
      artists: artist,
      year: raw.year || raw.releaseDate || '',
      songCount: raw.songCount || (raw.songs ? raw.songs.length : 0),
      image: img,
      imageUrl: img,
      type: 'album',
      raw: raw
    };
  }

  /**
   * Normalize an artist object for consistent usage
   */
  function normalizeArtist(raw) {
    if (!raw) return null;
    const name = decodeHtml(raw.name || raw.title || raw.artist || 'Unknown Artist');
    const img = getHighResImage(getImageUrl(raw)) || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%231a1a2e" width="100" height="100"/><text x="50" y="55" text-anchor="middle" fill="%236c5ce7" font-size="40">👤</text></svg>';
    return {
      id: raw.id || `art_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      name: name,
      title: name,
      role: raw.role || 'Artist',
      image: img,
      imageUrl: img,
      type: 'artist',
      raw: raw
    };
  }

  /**
   * Normalize a playlist object for consistent usage
   */
  function normalizePlaylist(raw) {
    if (!raw) return null;
    const title = decodeHtml(raw.title || raw.name || 'Untitled Playlist');
    const img = getHighResImage(getImageUrl(raw)) || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%231a1a2e" width="100" height="100"/><text x="50" y="55" text-anchor="middle" fill="%236c5ce7" font-size="40">🎵</text></svg>';
    const songCount = raw.songCount || (raw.songs ? raw.songs.length : 0);
    return {
      id: raw.id || `pl_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      title: title,
      name: title,
      subtitle: decodeHtml(raw.subtitle || (songCount ? `${songCount} Songs` : '') || 'Playlist'),
      songCount: songCount,
      image: img,
      imageUrl: img,
      type: 'playlist',
      songs: raw.songs ? raw.songs.map(normalizeSong) : [],
      raw: raw
    };
  }

  /**
   * Federated multi-collection search across all collections
   */
  async function searchFederated(query, page = 1) {
    const cleanQuery = (query || '').trim();
    if (!cleanQuery) return null;

    const words = cleanQuery.split(/\s+/).filter(Boolean);
    const subFetches = [
      searchSongs(cleanQuery, 50, page),
      searchAlbums(cleanQuery, 25, page),
      searchArtists(cleanQuery, 25, page),
      searchPlaylists(cleanQuery, 25, page)
    ];

    // For multi-word queries (e.g. "OK Katy Perry", "Katy Perry OK"),
    // dispatch smart sub-query variations to guarantee discovery
    if (words.length >= 2) {
      const firstWord = words[0];
      const restWords = words.slice(1).join(' ');
      subFetches.push(
        searchSongs(firstWord, 35, 1).catch(() => []),
        searchSongs(restWords, 35, 1).catch(() => [])
      );
      if (words.length > 2) {
        const lastWord = words[words.length - 1];
        const firstWords = words.slice(0, -1).join(' ');
        subFetches.push(
          searchSongs(lastWord, 35, 1).catch(() => []),
          searchSongs(firstWords, 35, 1).catch(() => [])
        );
      }
    }

    const settled = await Promise.allSettled(subFetches);

    let rawSongs = (settled[0].status === 'fulfilled' && Array.isArray(settled[0].value)) ? settled[0].value : [];
    const albums = (settled[1].status === 'fulfilled' && Array.isArray(settled[1].value)) ? settled[1].value.map(normalizeAlbum).filter(Boolean) : [];
    const artists = (settled[2].status === 'fulfilled' && Array.isArray(settled[2].value)) ? settled[2].value.map(normalizeArtist).filter(Boolean) : [];
    const playlists = (settled[3].status === 'fulfilled' && Array.isArray(settled[3].value)) ? settled[3].value.map(normalizePlaylist).filter(Boolean) : [];

    // Append sub-query matches
    for (let i = 4; i < settled.length; i++) {
      if (settled[i].status === 'fulfilled' && Array.isArray(settled[i].value)) {
        rawSongs = rawSongs.concat(settled[i].value);
      }
    }

    // If matching albums exist, backfill top album songs in parallel to enrich catalog diversity
    if (albums.length > 0) {
      const topAlbums = albums.slice(0, 3);
      const albumSongFetches = topAlbums.map(a => getAlbumDetails(a.id).catch(() => null));
      const albumDetails = await Promise.all(albumSongFetches);
      albumDetails.forEach(ad => {
        if (ad && Array.isArray(ad.songs)) {
          rawSongs = rawSongs.concat(ad.songs);
        }
      });
    }

    // Relevance scoring & smart deduplication
    const lowerQ = cleanQuery.toLowerCase();
    const wordRegexes = words.map(w => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'));
    const matchedArtistNames = artists.map(a => (a.name || '').toLowerCase());

    function computeRelevance(s) {
      const title = (s.name || s.title || '').toLowerCase();
      let art = s.primaryArtists || s.artists || s.artist || '';
      if (Array.isArray(art)) art = art.map(a => typeof a === 'object' ? a.name : a).join(' ');
      else if (typeof art === 'object' && art !== null) art = art.name || '';
      const artistStr = String(art).toLowerCase();
      const albumStr = (s.album?.name || s.album || '').toLowerCase();

      let score = 0;

      // 1. Exact full query match
      if (title === lowerQ) score += 300;
      else if (title.startsWith(lowerQ)) score += 180;
      else if (title.includes(lowerQ)) score += 120;

      // 2. Primary Artist Boost (e.g. song is performed by matched artist)
      matchedArtistNames.forEach(artName => {
        if (artistStr.includes(artName)) {
          score += 260;
        }
      });

      // 3. Whole-word token matching (avoids matching "ok" in "Crooks" or "Rokko")
      let matchedTokens = 0;
      wordRegexes.forEach(rx => {
        let hit = false;
        if (rx.test(title)) {
          score += 55;
          hit = true;
        }
        if (rx.test(artistStr)) {
          score += 65;
          hit = true;
        }
        if (rx.test(albumStr)) {
          score += 20;
          hit = true;
        }
        if (hit) matchedTokens++;
      });

      // 4. Exact short title match boost (e.g. Song titled literally "OK")
      if (words.some(w => title === w.toLowerCase())) {
        score += 120;
      }

      if (matchedTokens >= words.length) score += 90;
      return score;
    }

    const seenSongKeys = new Set();
    const scoredSongs = [];

    rawSongs.forEach(rawSong => {
      if (!rawSong) return;
      const norm = normalizeSong(rawSong);
      if (!norm || !norm.id || !norm.title) return;

      const cleanTitle = norm.title.toLowerCase().replace(/[^a-z0-9]/g, '');
      const cleanArtist = String(norm.artist || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 16);
      const dedupeKey = `${cleanTitle}__${cleanArtist}`;

      if (seenSongKeys.has(dedupeKey)) return;
      seenSongKeys.add(dedupeKey);

      scoredSongs.push({
        song: norm,
        score: computeRelevance(norm)
      });
    });

    scoredSongs.sort((a, b) => b.score - a.score);
    const finalSongs = scoredSongs.map(s => s.song);

    return {
      query: cleanQuery,
      songs: finalSongs,
      albums,
      artists,
      playlists
    };
  }

  /**
   * Real chart songs for autoplay/radio fallbacks. Uses the cached home
   * recommendations instead of searching the literal word "trending"
   * (which returns songs actually titled "Trending").
   */
  async function getTrendingPool(limit = 20) {
    try {
      const home = await getHomeRecommendations();
      const pool = [...(home.trending || []), ...(home.global || []), ...(home.newReleases || [])];
      if (pool.length > 0) {
        const normalized = pool.map(normalizeSong).filter(Boolean);
        return filterByLanguagePrefs(normalized, { minKeep: limit }).slice(0, limit);
      }
    } catch (_) {}
    try {
      const res = await searchSongs('top hits', limit);
      return (res || []).map(normalizeSong).filter(Boolean);
    } catch (_) { return []; }
  }

  /**
   * Strictly honor the user's chosen languages. Songs with a KNOWN
   * non-matching language are dropped; unknown-language songs only backfill
   * when there aren't enough matches (so pools never come back empty).
   */
  function filterByLanguagePrefs(songs, opts = {}) {
    const prefs = ((typeof Storage !== 'undefined' && Storage.getSettings().languages) || []).map(l => String(l).toLowerCase());
    if (!prefs.length) return songs || [];
    const { minKeep = 10 } = opts;
    const match = [];
    const unknown = [];
    (songs || []).forEach(s => {
      if (!s) return;
      const lang = String(s.language || '').toLowerCase();
      if (prefs.includes(lang)) match.push(s);
      else if (!lang || lang === 'unknown') unknown.push(s);
      // known non-matching language: dropped
    });
    if (match.length >= minKeep) return match;
    return [...match, ...unknown.slice(0, Math.max(0, minKeep - match.length))];
  }

  /**
   * Canonical key for a track so "Song", "Song (Slowed)", "Song (8D Audio)",
   * "Song - Ultra Slowed" all collapse to one entry.
   */
  function getTitleKey(song) {
    if (!song) return '';
    let t = String(song.name || song.title || '').toLowerCase();
    t = t.replace(/\(.*?\)|\[.*?\]|\{.*?\}/g, ' ');       // drop bracketed segments
    t = t.replace(/\s[-\u2013\u2014|].*$/, ' ');              // drop " - suffix" tails
    t = t.replace(/\b(slowed|slow|reverb|reverbed|sped\s*up|speed\s*up|speedup|8d|9d|16d|3d|lofi|lo-fi|remix|flip|ultra|super|bass\s*boosted|boosted|nightcore|daycore|instrumental|karaoke|extended|tiktok|version|audio|edit|mix|cover|remake|remastered|remaster|vip|bonus|deluxe|live)\b/g, ' ');
    t = t.replace(/[^a-z0-9\u0900-\u097f\u0a00-\u0a7f]+/g, ' ').trim().replace(/\s+/g, ' ');
    const artist = String(song.artists || song.artist || '').toLowerCase().split(',')[0].trim();
    return `${t}::${artist}`;
  }

  /**
   * Dedupe a track list by canonical title (kills slowed/8D/sped-up clones),
   * cap tracks per primary artist, and interleave so the same artist never
   * plays more than `maxRun` times in a row. Order of first appearance wins.
   */
  function dedupeVariants(songs, opts = {}) {
    const { maxPerArtist = 4, maxRun = 2, excludeKeys = null } = opts;
    const seenKeys = new Set(excludeKeys || []);
    const artistCount = {};
    const kept = [];
    (songs || []).forEach(s => {
      if (!s) return;
      const key = getTitleKey(s);
      if (!key || key.startsWith('::')) return;      // empty title
      if (seenKeys.has(key)) return;
      const artist = key.split('::')[1] || 'unknown';
      if ((artistCount[artist] || 0) >= maxPerArtist) return;
      seenKeys.add(key);
      artistCount[artist] = (artistCount[artist] || 0) + 1;
      kept.push(s);
    });

    // Greedy interleave: avoid > maxRun consecutive tracks by one artist
    const out = [];
    const rest = [...kept];
    while (rest.length) {
      let idx = 0;
      if (out.length >= maxRun) {
        const lastArtists = out.slice(-maxRun).map(getPrimaryArtist);
        const allSame = lastArtists.every(a => a === lastArtists[0]);
        if (allSame) {
          const diff = rest.findIndex(s => getPrimaryArtist(s) !== lastArtists[0]);
          if (diff !== -1) idx = diff;
        }
      }
      out.push(rest.splice(idx, 1)[0]);
    }
    return out;

    function getPrimaryArtist(s) {
      return String(s.artists || s.artist || '').toLowerCase().split(',')[0].trim();
    }
  }

  return {
    setBaseUrl,
    getBaseUrl,
    searchSongs,
    searchAlbums,
    searchArtists,
    searchPlaylists,
    searchFederated,
    searchAll,
    getHomeRecommendations,
    getSongDetails,
    getAlbumDetails,
    getPlaylistDetails,
    getArtistDetails,
    getArtistSongs,
    getArtistAlbums,
    getLyrics,
    getBestDownloadUrl,
    getDownloadUrl,
    getImageUrl,
    getHighResImage,
    getTitleKey,
    dedupeVariants,
    getTrendingPool,
    filterByLanguagePrefs,
    normalizeSong,
    normalizeAlbum,
    normalizeArtist,
    normalizePlaylist,
    decodeHtml,
  };
})();

// Expose module globally so cross-module window.* guards work
window.API = API;
