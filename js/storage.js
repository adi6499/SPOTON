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

  const BACKUP_KEY = 'mf_data_backup_v2';

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
      if (key !== BACKUP_KEY && key !== KEYS.HOME_CACHE && key !== KEYS.DAILY_MIX_CACHE) {
        scheduleDataBackup();
      }
    } catch (e) {
      if (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014) {
        console.warn('[Storage] Quota exceeded. Purging transient caches to free space...');
        try {
          // Free non-critical caches
          localStorage.removeItem(KEYS.HOME_CACHE);
          localStorage.removeItem(KEYS.DAILY_MIX_CACHE);
          localStorage.removeItem(BACKUP_KEY);
          // Try again
          localStorage.setItem(key, JSON.stringify(value));
          return;
        } catch (retryErr) {
          console.warn('[Storage] Retry after cache purge failed:', retryErr.message);
        }
      }
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

  // Settings are read every animation frame by the beat-pulse/visualizer loops,
  // so cache the parsed object instead of JSON.parsing localStorage 60-165x/sec.
  let settingsCache = null;

  function getSettings() {
    if (settingsCache) return settingsCache;
    settingsCache = get(KEYS.SETTINGS, {
      volume: 0.8,
      quality: '320kbps',
      repeat: 'off',
      shuffle: false,
      theme: 'dark',
      autoplay: true,
      glass: false,
      glassEffect: false,
      beatPulse: false,
      visualizer: false,
      languages: ['hindi', 'english', 'punjabi'],
    });
    return settingsCache;
  }

  function updateSettings(partial) {
    const settings = { ...getSettings(), ...partial };
    settingsCache = settings;
    set(KEYS.SETTINGS, settings);
    return settings;
  }

  // Invalidate the cache if another tab (or a restore) rewrites settings
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
      if (!e.key || e.key === KEYS.SETTINGS) settingsCache = null;
    });
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

  function renamePlaylist(id, newName) {
    if (!newName || !newName.trim()) return false;
    const pls = getPlaylists();
    const p = pls.find(x => x.id === id);
    if (!p) return false;
    p.name = newName.trim();
    set(KEYS.PLAYLISTS, pls);
    return true;
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

  function clearListeningHistory() {
    set(KEYS.LISTENING_HISTORY, []);
  }

  function getMostPlayed(limit = 20) {
    const plays = getStats().songPlays || {};
    return Object.entries(plays)
      .map(([id, v]) => ({ id, ...v }))
      .filter(s => s.count >= 2 && s.name)
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
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

    // Per-song play counts (powers the Most Played shelf)
    if (song.id) {
      stats.songPlays = stats.songPlays || {};
      const prev = stats.songPlays[song.id];
      stats.songPlays[song.id] = {
        count: (prev && prev.count ? prev.count : 0) + 1,
        name: song.name,
        artists: song.artists,
        image: typeof song.image === 'string' ? song.image : (prev && prev.image) || '',
        duration: song.duration || 0,
        lastPlayed: Date.now()
      };
      // Keep the map bounded: retain the 300 most recently played entries
      const ids = Object.keys(stats.songPlays);
      if (ids.length > 300) {
        ids.sort((a, b) => (stats.songPlays[b].lastPlayed || 0) - (stats.songPlays[a].lastPlayed || 0))
           .slice(300)
           .forEach(id => { delete stats.songPlays[id]; });
      }
    }

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

  // ---- Phase 3: User Profile & Permanent Data Protection ----

  let backupDebounceTimer = null;
  function scheduleDataBackup() {
    if (backupDebounceTimer) clearTimeout(backupDebounceTimer);
    backupDebounceTimer = setTimeout(() => {
      createDataBackupSnapshot();
    }, 4000);
  }

  function createDataBackupSnapshot() {
    try {
      const snapshot = {
        version: 2,
        timestamp: Date.now(),
        profile: get(KEYS.USER_PROFILE, null),
        favorites: get(KEYS.FAVORITES, []),
        playlists: get(KEYS.PLAYLISTS, []),
        recent: get(KEYS.RECENT, []),
        settings: get(KEYS.SETTINGS, null),
        searchHistory: get(KEYS.SEARCH_HISTORY, []),
        followedArtists: get(KEYS.FOLLOWED_ARTISTS, []),
        podcastProgress: get(KEYS.PODCAST_PROGRESS, {}),
        libraryPrefs: get(KEYS.LIBRARY_PREFS, null)
      };
      localStorage.setItem(BACKUP_KEY, JSON.stringify(snapshot));
    } catch (_) {}
  }

  function restoreFromBackup() {
    try {
      const raw = localStorage.getItem(BACKUP_KEY);
      if (!raw) return false;
      const snapshot = JSON.parse(raw);
      if (!snapshot) return false;

      if (snapshot.profile && !localStorage.getItem(KEYS.USER_PROFILE)) {
        set(KEYS.USER_PROFILE, snapshot.profile);
      }
      if (snapshot.favorites?.length && !localStorage.getItem(KEYS.FAVORITES)) {
        set(KEYS.FAVORITES, snapshot.favorites);
      }
      if (snapshot.playlists?.length && !localStorage.getItem(KEYS.PLAYLISTS)) {
        set(KEYS.PLAYLISTS, snapshot.playlists);
      }
      if (snapshot.settings && !localStorage.getItem(KEYS.SETTINGS)) {
        set(KEYS.SETTINGS, snapshot.settings);
      }
      if (snapshot.recent?.length && !localStorage.getItem(KEYS.RECENT)) {
        set(KEYS.RECENT, snapshot.recent);
      }
      return true;
    } catch (_) {
      return false;
    }
  }

  function initDataProtection() {
    // 1. Request permanent storage from browser (PWA/Installed/Web)
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
      navigator.storage.persist().then(persistent => {
        if (persistent) {
          console.log('[Storage] Persistent storage granted by browser — data will never be cleared!');
        }
      }).catch(() => {});
    }

    // 2. Heal any missing keys from backup snapshot if available
    restoreFromBackup();

    // 3. Ensure user profile exists and has hasOnboarded correctly set
    const profile = get(KEYS.USER_PROFILE, null);
    const hasAnyExistingData = localStorage.getItem(KEYS.FAVORITES) || 
                               localStorage.getItem(KEYS.PLAYLISTS) || 
                               localStorage.getItem(KEYS.RECENT) || 
                               localStorage.getItem(KEYS.SETTINGS);

    if (profile) {
      if (profile.username && profile.hasOnboarded === undefined) {
        profile.hasOnboarded = true;
        set(KEYS.USER_PROFILE, profile);
      }
    } else if (hasAnyExistingData) {
      // Existing user updating app -> preserve data and never prompt onboarding again
      set(KEYS.USER_PROFILE, {
        username: 'Adesh',
        avatar: '🎧',
        bio: 'Music enthusiast & audiophile',
        joinedDate: new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        hasOnboarded: true
      });
    }

    // 4. Update backup snapshot
    createDataBackupSnapshot();
  }

  // Auto-run data protection on script evaluation
  try {
    initDataProtection();
  } catch (_) {}

  function getUserProfile() {
    let profile = get(KEYS.USER_PROFILE, null);
    if (!profile) {
      const hasAnyExistingData = localStorage.getItem(KEYS.FAVORITES) || 
                                 localStorage.getItem(KEYS.PLAYLISTS) || 
                                 localStorage.getItem(KEYS.SETTINGS);
      profile = {
        username: 'Adesh',
        avatar: '🎧',
        bio: 'Music enthusiast & audiophile',
        joinedDate: new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        hasOnboarded: Boolean(hasAnyExistingData)
      };
      set(KEYS.USER_PROFILE, profile);
      createDataBackupSnapshot();
    }
    return profile;
  }

  function saveUserProfile(profile) {
    const current = getUserProfile();
    const updated = { ...current, ...profile };
    if (profile && profile.username) {
      updated.hasOnboarded = true;
    }
    set(KEYS.USER_PROFILE, updated);
    createDataBackupSnapshot();
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
    renamePlaylist,
    addSongToPlaylist,
    getListeningHistory,
    clearListeningHistory,
    getMostPlayed,
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
    saveLibraryPreferences,
    initDataProtection,
    createDataBackupSnapshot,
    restoreFromBackup
  };
})();

window.Storage = Storage;
