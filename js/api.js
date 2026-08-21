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

    const prefs = Storage.getSettings().languages || [];
    const mainLang = prefs.length > 0 ? prefs[0] : '';
    const langSuffix = mainLang ? ` ${mainLang}` : '';

    // Dynamic rotation pools for vibrant and fresh daily discovery
    const trendingPool = [
      `trending hits${langSuffix}`,
      `top 50 viral${langSuffix}`,
      `latest chartbusters${langSuffix}`,
      `top songs 2026${langSuffix}`,
      `billboard hot 100`,
      `bollywood superhits`,
      `punjabi pop top hits`
    ];

    const globalPool = [
      `top 50 global`,
      `worldwide viral hits`,
      `international pop hits`,
      `top english songs`,
      `global dance hits`,
      `billboard global 200`
    ];

    const newReleasesPool = [
      `new releases${langSuffix}`,
      `latest singles 2026`,
      `fresh new tracks${langSuffix}`,
      `brand new music`,
      `hot new arrivals`,
      `friday music drops`
    ];

    const chillPool = [
      'lo-fi chillhop beats',
      'acoustic coffee morning',
      'late night vibes songs',
      'peaceful piano melodies',
      'ambient chill beats',
      'monsoon romantic songs',
      'indie acoustic vibes'
    ];

    const focusPool = [
      'deep focus electronic',
      'braindance synthwave',
      'phonk drift high energy',
      'instrumental study flow',
      'chillwave beats',
      'lo-fi sleep & study'
    ];

    const workoutPool = [
      'workout pump gym hits',
      'high energy edm festival',
      'banger hip hop hype',
      'motivational running beats',
      'hardstyle edm',
      'rap gym workout'
    ];

    const artistPool = [
      `popular artists${langSuffix}`,
      'top indian singers',
      'famous global artists',
      'top vocalists',
      'legendary playback singers',
      'trending rap artists'
    ];

    const albumPool = [
      `top albums${langSuffix}`,
      'best soundtrack albums',
      'blockbuster movie albums',
      'trending studio albums',
      'iconic music albums'
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
      if (q.type === 'songs') return searchSongs(q.query, 40);
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
        if (queries[k].type === 'songs') {
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
   * @returns {Promise<Object|null>}
   */
  async function getLyrics(trackName, artistName, duration) {
    if (!trackName) return null;
    const cleanTitle = trackName.replace(/\(.*?\)|\[.*?\]/g, '').trim();
    const cleanArtist = (artistName || '').split(',')[0].split('&')[0].trim();
    const settings = (typeof Storage !== 'undefined' && Storage.getSettings) ? Storage.getSettings() : {};
    const musixmatchKey = settings.musixmatchApiKey || '';

    // 1. Try LRCLIB exact match if artist is provided
    if (cleanArtist) {
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
      } catch (_) {}
    }

    // 2. Try LRCLIB search query
    try {
      const q = cleanArtist ? `${cleanTitle} ${cleanArtist}` : cleanTitle;
      const searchRes = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(q)}`);
      if (searchRes.ok) {
        const results = await searchRes.json();
        if (Array.isArray(results) && results.length > 0) {
          const match = results[0];
          if (match.syncedLyrics || match.plainLyrics) {
            return {
              synced: match.syncedLyrics || null,
              plain: match.plainLyrics || match.syncedLyrics
            };
          }
        }
      }
    } catch (_) {}

    // 3. Try Musixmatch API (if API key is configured)
    if (musixmatchKey && cleanArtist) {
      try {
        const mxTarget = `https://api.musixmatch.com/ws/1.1/matcher.lyrics.get?q_track=${encodeURIComponent(cleanTitle)}&q_artist=${encodeURIComponent(cleanArtist)}&apikey=${musixmatchKey}`;
        const mxRes = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(mxTarget)}`);
        if (mxRes.ok) {
          const mxData = await mxRes.json();
          const lyricsBody = mxData?.message?.body?.lyrics?.lyrics_body;
          if (lyricsBody) {
            return {
              synced: null,
              plain: lyricsBody.replace(/\*\*\*.*$/s, '').trim()
            };
          }
        }
      } catch (_) {}
    }

    // 4. Fallback to Lyrics.ovh only if both artist and title are present
    if (cleanArtist && cleanTitle) {
      try {
        const ovhRes = await fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(cleanArtist)}/${encodeURIComponent(cleanTitle)}`);
        if (ovhRes.ok) {
          const ovhData = await ovhRes.json();
          if (ovhData.lyrics) {
            return { synced: null, plain: ovhData.lyrics };
          }
        }
      } catch (_) {}
    }

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
   * Decode HTML entities in text strings returned by the API
   * @param {string} str - String with entities like &quot;, &amp;, &#039;
   * @returns {string} Clean decoded string
   */
  function decodeHtml(str) {
    if (!str || typeof str !== 'string') return str || '';
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
    if (Array.isArray(images)) {
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
   * Safely extract artists from various API response formats
   * @param {Object} raw - Raw song from API
   * @returns {string} Comma-separated artists
   */
  function getArtistsString(raw) {
    if (!raw) return 'Unknown Artist';
    
    function extractArtistName(a) {
      if (!a) return '';
      if (typeof a === 'string') return a;
      if (typeof a === 'object') return a.name || a.title || a.artist || '';
      return String(a);
    }

    let result = '';
    if (typeof raw.artists === 'string') {
      result = raw.artists;
    } else if (Array.isArray(raw.artists)) {
      result = raw.artists.map(extractArtistName).filter(Boolean).join(', ');
    } else if (raw.artists && typeof raw.artists === 'object') {
      if (Array.isArray(raw.artists.primary) && raw.artists.primary.length > 0) {
        result = raw.artists.primary.map(extractArtistName).filter(Boolean).join(', ');
      } else if (Array.isArray(raw.artists.all) && raw.artists.all.length > 0) {
        result = raw.artists.all.map(extractArtistName).filter(Boolean).join(', ');
      }
    } else if (typeof raw.primaryArtists === 'string') {
      result = raw.primaryArtists;
    } else if (Array.isArray(raw.primaryArtists)) {
      result = raw.primaryArtists.map(extractArtistName).filter(Boolean).join(', ');
    } else if (typeof raw.artist === 'string') {
      result = raw.artist;
    } else if (Array.isArray(raw.artist)) {
      result = raw.artist.map(extractArtistName).filter(Boolean).join(', ');
    } else if (raw.artist && typeof raw.artist === 'object') {
      result = extractArtistName(raw.artist);
    }

    if (!result || result.trim() === '' || result === '[object Object]') {
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

    let audioUrl = getBestDownloadUrl(raw) || raw.streamUrl || raw.audioUrl || raw.url || '';
    if (typeof audioUrl === 'object' && audioUrl !== null) {
      audioUrl = audioUrl.url || audioUrl.link || '';
    }
    if (typeof audioUrl !== 'string' || audioUrl === '[object Object]') {
      audioUrl = '';
    }

    return {
      id: String(raw.id || `track_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`),
      name: name,
      title: name,
      artists: artists,
      artist: artists,
      album: album,
      duration: raw.duration || 0,
      image: img,
      imageUrl: img,
      streamUrl: audioUrl,
      audioUrl: audioUrl,
      downloadUrls: raw.downloadUrl || [],
      year: raw.year || '',
      language: raw.language || '',
      hasLyrics: raw.hasLyrics || false,
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
    const cleanQuery = query.trim();
    if (!cleanQuery) return null;

    const [songsRes, albumsRes, artistsRes, playlistsRes] = await Promise.allSettled([
      searchSongs(cleanQuery, 40, page),
      searchAlbums(cleanQuery, 20, page),
      searchArtists(cleanQuery, 20, page),
      searchPlaylists(cleanQuery, 20, page)
    ]);

    const songs = (songsRes.status === 'fulfilled' && Array.isArray(songsRes.value)) 
      ? songsRes.value.map(normalizeSong) 
      : [];
    const albums = (albumsRes.status === 'fulfilled' && Array.isArray(albumsRes.value)) 
      ? albumsRes.value.map(normalizeAlbum).filter(Boolean) 
      : [];
    const artists = (artistsRes.status === 'fulfilled' && Array.isArray(artistsRes.value)) 
      ? artistsRes.value.map(normalizeArtist).filter(Boolean) 
      : [];
    const playlists = (playlistsRes.status === 'fulfilled' && Array.isArray(playlistsRes.value)) 
      ? playlistsRes.value.map(normalizePlaylist).filter(Boolean) 
      : [];

    return {
      query: cleanQuery,
      songs,
      albums,
      artists,
      playlists
    };
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
    normalizeSong,
    normalizeAlbum,
    normalizeArtist,
    normalizePlaylist,
    decodeHtml,
  };
})();
