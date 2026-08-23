// ========================================
// MusicFlow — Smart Auto-Downloads & Offline IndexedDB Engine
// ========================================

const SmartDownloads = (() => {
  const DB_NAME = 'musicflow_offline_db';
  const DB_VERSION = 1;
  const STORE_NAME = 'offline_tracks';
  const AUTO_SYNC_LIMIT = 50; // Auto-cache top 50 songs

  let dbInstance = null;
  let isSyncing = false;

  function openDB() {
    if (dbInstance) return Promise.resolve(dbInstance);

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('savedAt', 'savedAt', { unique: false });
          store.createIndex('name', 'name', { unique: false });
        }
      };

      request.onsuccess = (e) => {
        dbInstance = e.target.result;
        resolve(dbInstance);
      };

      request.onerror = (e) => {
        console.warn('[SmartDownloads] IndexedDB open error:', e.target.error);
        reject(e.target.error);
      };
    });
  }

  async function saveSong(song, audioBlob) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      const record = {
        id: song.id,
        name: song.name,
        artists: song.artists || song.artist,
        album: song.album || '',
        image: song.image || '',
        duration: song.duration || 0,
        blob: audioBlob,
        sizeBytes: audioBlob.size,
        savedAt: Date.now()
      };

      const req = store.put(record);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  async function getSong(songId) {
    try {
      const db = await openDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(songId);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }

  async function isSongDownloaded(songId) {
    const song = await getSong(songId);
    return !!song;
  }

  async function removeSong(songId) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(songId);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  async function getAllDownloadedSongs() {
    try {
      const db = await openDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });
    } catch {
      return [];
    }
  }

  async function getStorageUsage() {
    const songs = await getAllDownloadedSongs();
    const totalBytes = songs.reduce((sum, s) => sum + (s.sizeBytes || 0), 0);
    const totalMB = (totalBytes / (1024 * 1024)).toFixed(1);
    return {
      count: songs.length,
      totalBytes,
      totalMB
    };
  }

  async function clearAllDownloads() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Automatically caches top favorites & frequently played tracks in the background
   */
  async function syncSmartDownloads() {
    if (!navigator.onLine || isSyncing) return;
    isSyncing = true;

    try {
      const favorites = Storage.getFavorites();
      const history = Storage.getListeningHistory();

      // Top tracks pool
      const pool = [...favorites, ...history.slice(0, 30)];
      const seen = new Set();
      const targetSongs = [];

      for (const song of pool) {
        if (song && song.id && !seen.has(song.id)) {
          seen.add(song.id);
          targetSongs.push(song);
          if (targetSongs.length >= AUTO_SYNC_LIMIT) break;
        }
      }

      for (const song of targetSongs) {
        const alreadySaved = await isSongDownloaded(song.id);
        if (!alreadySaved) {
          try {
            let downloadUrl = song.streamUrl;
            if (!downloadUrl) {
              const details = await API.getSongDetails(song.id);
              if (details && details.length > 0) {
                downloadUrl = API.getBestDownloadUrl(details[0]);
              }
            }

            if (downloadUrl && downloadUrl.startsWith('http')) {
              try {
                let fetchTarget = downloadUrl;
                if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                  fetchTarget = `/api/proxy-audio?url=${encodeURIComponent(downloadUrl)}`;
                }
                const res = await fetch(fetchTarget, { mode: 'cors' });
                if (res && res.ok) {
                  const blob = await res.blob();
                  await saveSong(song, blob);
                  console.log(`[SmartDownloads] Cached: ${song.name}`);
                }
              } catch (_) {
                // Cross-origin CDN restrictions: non-fatal, skip caching this track
              }
            }
          } catch (e) {
            // Silently skip non-critical download sync failures
          }
        }
      }
    } catch (e) {
      console.warn('[SmartDownloads] Auto-sync error:', e);
    } finally {
      isSyncing = false;
    }
  }

  /**
   * Interceptor for Player: returns a local blob URL if available, else null
   */
  async function getOfflineAudioUrl(songId) {
    const record = await getSong(songId);
    if (record && record.blob) {
      return URL.createObjectURL(record.blob);
    }
    return null;
  }

  // Trigger smart download sync on app start and when online
  window.addEventListener('online', () => syncSmartDownloads());
  setTimeout(() => syncSmartDownloads(), 4000); // 4s delay after launch

  return {
    saveSong,
    getSong,
    isSongDownloaded,
    removeSong,
    getAllDownloadedSongs,
    getStorageUsage,
    clearAllDownloads,
    syncSmartDownloads,
    getOfflineAudioUrl
  };
})();

window.SmartDownloads = SmartDownloads;
