// ========================================
// MusicFlow — Storage Service (localStorage)
// ========================================

const Storage = (() => {
  const KEYS = {
    FAVORITES: 'mf_favorites',
    RECENT: 'mf_recent',
    SETTINGS: 'mf_settings',
    QUEUE: 'mf_queue',
    SEARCH_HISTORY: 'mf_search_history',
    PLAYLISTS: 'mf_playlists',
    LISTENING_HISTORY: 'mf_listening_history',
    STATS: 'mf_stats',
    HOME_CACHE: 'mf_home_cache',
  };

  const MAX_RECENT = 50;
  const MAX_HISTORY = 1000;

  // ---- Generic Helpers ----

  function get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn('[Storage] Failed to save:', e.message);
    }
  }

  // ---- Favorites ----

  function getFavorites() {
    return get(KEYS.FAVORITES, []);
  }

  function addFavorite(song) {
    const favs = getFavorites();
    if (favs.some(f => f.id === song.id)) return false;
    favs.unshift({
      id: song.id,
      name: song.name,
      artists: song.artists,
      album: song.album,
      image: song.image,
      duration: song.duration,
    });
    set(KEYS.FAVORITES, favs);
    return true;
  }

  function removeFavorite(songId) {
    const favs = getFavorites().filter(f => f.id !== songId);
    set(KEYS.FAVORITES, favs);
  }

  function isFavorite(songId) {
    return getFavorites().some(f => f.id === songId);
  }

  function toggleFavorite(song) {
    if (isFavorite(song.id)) {
      removeFavorite(song.id);
      return false;
    } else {
      addFavorite(song);
      return true;
    }
  }

  // ---- Recently Played ----

  function getRecent() {
    return get(KEYS.RECENT, []);
  }

  function addRecent(song) {
    let recent = getRecent().filter(r => r.id !== song.id);
    recent.unshift({
      id: song.id,
      name: song.name,
      artists: song.artists,
      album: song.album,
      image: song.image,
      duration: song.duration,
      playedAt: Date.now(),
    });
    if (recent.length > MAX_RECENT) {
      recent = recent.slice(0, MAX_RECENT);
    }
    set(KEYS.RECENT, recent);
  }

  function clearRecent() {
    set(KEYS.RECENT, []);
  }

  // ---- Settings ----

  function getSettings() {
    return get(KEYS.SETTINGS, {
      volume: 0.8,
      quality: '320kbps',
      repeat: 'off',
      shuffle: false,
      theme: 'dark',
      autoplay: true,
    });
  }

  function updateSettings(partial) {
    const settings = { ...getSettings(), ...partial };
    set(KEYS.SETTINGS, settings);
    return settings;
  }

  // ---- Search History ----

  function getSearchHistory() {
    return get(KEYS.SEARCH_HISTORY, []);
  }

  function addSearchHistory(query) {
    if (!query) return;
    let history = getSearchHistory().filter(q => q.toLowerCase() !== query.toLowerCase());
    history.unshift(query);
    if (history.length > 10) history = history.slice(0, 10);
    set(KEYS.SEARCH_HISTORY, history);
  }

  function clearSearchHistory() {
    set(KEYS.SEARCH_HISTORY, []);
  }

  // ---- Playlists ----

  function getPlaylists() {
    return get(KEYS.PLAYLISTS, []);
  }

  function savePlaylists(playlists) {
    set(KEYS.PLAYLISTS, playlists);
  }

  function createPlaylist(name, description = '') {
    const playlists = getPlaylists();
    const newPlaylist = {
      id: 'pl_' + Date.now(),
      name,
      description,
      songs: [],
      createdAt: Date.now()
    };
    playlists.push(newPlaylist);
    savePlaylists(playlists);
    return newPlaylist;
  }

  function deletePlaylist(id) {
    savePlaylists(getPlaylists().filter(p => p.id !== id));
  }

  function addSongToPlaylist(playlistId, song) {
    const playlists = getPlaylists();
    const pl = playlists.find(p => p.id === playlistId);
    if (pl && !pl.songs.some(s => s.id === song.id)) {
      pl.songs.push(song);
      savePlaylists(playlists);
      return true;
    }
    return false;
  }

  // ---- Advanced Listening History & Stats ----

  function getListeningHistory() {
    return get(KEYS.LISTENING_HISTORY, []);
  }

  function addListeningHistory(song) {
    let history = getListeningHistory();
    history.unshift({
      id: song.id,
      name: song.name,
      artists: song.artists,
      album: song.album,
      image: song.image,
      duration: song.duration,
      playedAt: Date.now()
    });
    if (history.length > MAX_HISTORY) {
      history = history.slice(0, MAX_HISTORY);
    }
    set(KEYS.LISTENING_HISTORY, history);
    updateStats(song);
  }

  function getStats() {
    return get(KEYS.STATS, {
      totalSongsPlayed: 0,
      totalListeningTime: 0, // seconds
      topArtists: {},
    });
  }

  function updateStats(song) {
    const stats = getStats();
    stats.totalSongsPlayed += 1;
    stats.totalListeningTime += (parseInt(song.duration) || 0);
    
    // Top artists simple tracker
    const artist = song.artists ? song.artists.split(',')[0].trim() : 'Unknown';
    stats.topArtists[artist] = (stats.topArtists[artist] || 0) + 1;
    
    set(KEYS.STATS, stats);
  }

  // ---- Home Cache ----
  
  function getHomeCache() {
    const cache = get(KEYS.HOME_CACHE, null);
    if (!cache) return null;
    // 1 hour expiration
    if (Date.now() - cache.timestamp > 60 * 60 * 1000) {
      return null; // Expired
    }
    return cache.data;
  }

  function setHomeCache(data) {
    set(KEYS.HOME_CACHE, {
      timestamp: Date.now(),
      data: data
    });
  }

  // ---- IndexedDB Offline Storage ----
  let dbInstance = null;

  function initOfflineDB() {
    return new Promise((resolve, reject) => {
      if (dbInstance) return resolve(dbInstance);
      if (!window.indexedDB) return resolve(null);

      const request = indexedDB.open('mf_offline_db', 1);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('offline_songs')) {
          db.createObjectStore('offline_songs', { keyPath: 'id' });
        }
      };
      request.onsuccess = (e) => {
        dbInstance = e.target.result;
        resolve(dbInstance);
      };
      request.onerror = (e) => {
        console.warn('[Storage] IndexedDB open error:', e);
        resolve(null);
      };
    });
  }

  async function saveOfflineSong(song, blob) {
    const db = await initOfflineDB();
    if (!db) return false;
    return new Promise((resolve) => {
      const tx = db.transaction('offline_songs', 'readwrite');
      const store = tx.objectStore('offline_songs');
      const record = {
        id: song.id,
        name: song.name,
        artists: song.artists,
        album: song.album,
        image: song.image,
        duration: song.duration,
        blob: blob,
        savedAt: Date.now()
      };
      const req = store.put(record);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    });
  }

  async function getOfflineSong(songId) {
    const db = await initOfflineDB();
    if (!db) return null;
    return new Promise((resolve) => {
      const tx = db.transaction('offline_songs', 'readonly');
      const store = tx.objectStore('offline_songs');
      const req = store.get(songId);
      req.onsuccess = () => {
        const item = req.result;
        if (item && item.blob) {
          const url = URL.createObjectURL(item.blob);
          resolve({ ...item, url });
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  }

  async function getOfflineSongs() {
    const db = await initOfflineDB();
    if (!db) return [];
    return new Promise((resolve) => {
      const tx = db.transaction('offline_songs', 'readonly');
      const store = tx.objectStore('offline_songs');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  }

  async function removeOfflineSong(songId) {
    const db = await initOfflineDB();
    if (!db) return false;
    return new Promise((resolve) => {
      const tx = db.transaction('offline_songs', 'readwrite');
      const store = tx.objectStore('offline_songs');
      const req = store.delete(songId);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    });
  }

  return {
    getFavorites,
    addFavorite,
    removeFavorite,
    isFavorite,
    toggleFavorite,
    getRecent,
    addRecent,
    clearRecent,
    getHistory: getRecent, // Alias for backward compatibility
    getSettings,
    updateSettings,
    getSearchHistory,
    addSearchHistory,
    clearSearchHistory,
    getPlaylists,
    createPlaylist,
    deletePlaylist,
    addSongToPlaylist,
    getListeningHistory,
    addListeningHistory,
    getStats,
    getHomeCache,
    setHomeCache,
    saveOfflineSong,
    getOfflineSong,
    getOfflineSongs,
    removeOfflineSong
  };
})();
