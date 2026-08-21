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
    FOLLOWED_ARTISTS: 'mf_followed_artists',
    DAILY_MIX_CACHE: 'mf_daily_mix_cache',
    USER_PROFILE: 'mf_user_profile',
    PODCAST_PROGRESS: 'mf_podcast_progress',
    LIBRARY_PREFS: 'mf_library_prefs'
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

  // ---- Followed Artists ----

  function getFollowedArtists() {
    return get(KEYS.FOLLOWED_ARTISTS, []);
  }

  function followArtist(artist) {
    const followed = getFollowedArtists();
    if (followed.some(a => a.id === artist.id)) return false;
    followed.unshift({
      id: artist.id,
      name: artist.name,
      image: artist.image,
      followedAt: Date.now(),
    });
    set(KEYS.FOLLOWED_ARTISTS, followed);
    return true;
  }

  function unfollowArtist(artistId) {
    const followed = getFollowedArtists().filter(a => a.id !== artistId);
    set(KEYS.FOLLOWED_ARTISTS, followed);
  }

  function isArtistFollowed(artistId) {
    return getFollowedArtists().some(a => a.id === artistId);
  }

  function toggleFollowArtist(artist) {
    if (isArtistFollowed(artist.id)) {
      unfollowArtist(artist.id);
      return false; // Now unfollowed
    } else {
      followArtist(artist);
      return true; // Now followed
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
      languages: ['hindi', 'english', 'punjabi'],
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
      topGenres: {}
    });
  }

  function updateStats(song) {
    const stats = getStats();
    stats.totalSongsPlayed += 1;
    stats.totalListeningTime += (parseInt(song.duration) || 0);
    
    // Top artists simple tracker
    const artist = song.artists ? song.artists.split(',')[0].trim() : 'Unknown';
    stats.topArtists = stats.topArtists || {};
    stats.topArtists[artist] = (stats.topArtists[artist] || 0) + 1;
    
    // Top genres tracker (derived from language or genre if available)
    const genre = song.language ? song.language : 'Unknown';
    stats.topGenres = stats.topGenres || {};
    stats.topGenres[genre] = (stats.topGenres[genre] || 0) + 1;
    
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

  function clearHomeCache() {
    set(KEYS.HOME_CACHE, null);
  }

  // ---- Daily Mix Cache ----

  function getDailyMixCache() {
    const cache = get(KEYS.DAILY_MIX_CACHE, null);
    if (!cache) return null;
    // 24 hour expiration
    if (Date.now() - cache.timestamp > 24 * 60 * 60 * 1000) {
      return null;
    }
    return cache.data;
  }

  function setDailyMixCache(data) {
    set(KEYS.DAILY_MIX_CACHE, {
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

  // ---- Phase 3: User Profile ----

  function getUserProfile() {
    return get(KEYS.USER_PROFILE, {
      username: 'Adesh',
      avatar: '🎧',
      bio: 'Music enthusiast & audiophile',
      joinedDate: new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    });
  }

  function saveUserProfile(profile) {
    const current = getUserProfile();
    const updated = { ...current, ...profile };
    set(KEYS.USER_PROFILE, updated);
    return updated;
  }

  // ---- Phase 3: Podcast Progress & Bookmarks ----

  function getPodcastProgress(episodeId) {
    const all = get(KEYS.PODCAST_PROGRESS, {});
    return episodeId ? (all[episodeId] || 0) : all;
  }

  function savePodcastProgress(episodeId, seconds) {
    if (!episodeId) return;
    const all = get(KEYS.PODCAST_PROGRESS, {});
    all[episodeId] = Math.floor(seconds);
    set(KEYS.PODCAST_PROGRESS, all);
  }

  // ---- Phase 3: Library Preferences ----

  function getLibraryPreferences() {
    return get(KEYS.LIBRARY_PREFS, {
      sortBy: 'recent', // 'recent' | 'alphabetical' | 'most_played'
      showPodcasts: true,
      layoutDensity: 'comfortable'
    });
  }

  function saveLibraryPreferences(prefs) {
    const current = getLibraryPreferences();
    const updated = { ...current, ...prefs };
    set(KEYS.LIBRARY_PREFS, updated);
    return updated;
  }

  return {
    get,
    set,
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
    clearHomeCache,
    getDailyMixCache,
    setDailyMixCache,
    saveOfflineSong,
    getOfflineSong,
    getOfflineSongs,
    removeOfflineSong,
    getFollowedArtists,
    followArtist,
    unfollowArtist,
    isArtistFollowed,
    toggleFollowArtist,
    getUserProfile,
    saveUserProfile,
    getPodcastProgress,
    savePodcastProgress,
    getLibraryPreferences,
    saveLibraryPreferences
  };
})();
