// ============================================================================
// MUSICFLOW — CENTRALIZED MULTI-PROVIDER PLAYBACK RESOLVER
// Single Source of Truth for Cross-Provider Playback Resolution & Stream Validation
// Priority: Downloaded > Local > Cached > Origin Provider > Fallback Provider
// ============================================================================

const PlaybackResolver = (() => {
  const SourceType = {
    DOWNLOADED: 'DOWNLOADED',
    LOCAL: 'LOCAL',
    CACHED: 'CACHED',
    STREAMING: 'STREAMING',
    UNKNOWN: 'UNKNOWN'
  };

  const ErrorCode = {
    SOURCE_UNAVAILABLE: 'SOURCE_UNAVAILABLE',
    OFFLINE_UNAVAILABLE: 'OFFLINE_UNAVAILABLE',
    ABORTED: 'ABORTED',
    NETWORK_ERROR: 'NETWORK_ERROR'
  };

  // In-Memory Stream Cache with TTL (1 hour)
  const streamCache = new Map();
  const CACHE_TTL_MS = 60 * 60 * 1000;

  function getCachedStream(songId) {
    if (!songId) return null;
    const entry = streamCache.get(String(songId));
    if (entry && (Date.now() - entry.timestamp < CACHE_TTL_MS)) {
      return entry.streamUrl;
    }
    return null;
  }

  function setCachedStream(songId, streamUrl) {
    if (!songId || !streamUrl) return;
    streamCache.set(String(songId), { streamUrl, timestamp: Date.now() });
    if (streamCache.size > 200) {
      const oldest = streamCache.keys().next().value;
      streamCache.delete(oldest);
    }
  }

  /**
   * Safe helper to normalize artist strings without throwing TypeError
   */
  function safeArtistString(song) {
    if (typeof DataNormalizer !== 'undefined' && DataNormalizer.getArtistString) {
      return DataNormalizer.getArtistString(song);
    }
    if (!song) return '';
    if (typeof song.artists === 'string') return song.artists;
    if (Array.isArray(song.artists)) {
      return song.artists.map(a => (typeof a === 'object' ? a.name : a)).filter(Boolean).join(', ');
    }
    if (typeof song.artists === 'object' && song.artists !== null) {
      return song.artists.name || '';
    }
    return String(song.primaryArtist || song.artist || '');
  }

  /**
   * Safe helper to normalize track title
   */
  function safeTrackTitle(song) {
    if (typeof DataNormalizer !== 'undefined' && DataNormalizer.getTrackTitle) {
      return DataNormalizer.getTrackTitle(song);
    }
    return String(song?.name || song?.title || '').trim();
  }

  /**
   * Centralized resolvePlayableSource
   * Implements strict origin-aware provider hierarchy with automatic cross-provider fallback
   */
  async function resolvePlayableSource(song, options = {}) {
    if (!song) {
      return { type: SourceType.UNKNOWN, uri: '', error: ErrorCode.SOURCE_UNAVAILABLE, message: "Couldn't play this song" };
    }

    const signal = options.signal;
    if (signal?.aborted) {
      const abortErr = new Error('Playback request aborted');
      abortErr.name = 'AbortError';
      throw abortErr;
    }

    const songId = String(song.id || '');
    const title = safeTrackTitle(song);
    const artists = safeArtistString(song);
    const primaryArtist = artists.split(/[,;&/]|feat\.|ft\./i)[0].trim();
    const preferredQuality = (typeof Storage !== 'undefined' && Storage.getAudioQuality) ? Storage.getAudioQuality() : '320kbps';

    function createResult(type, uri, provider, song, extra = {}) {
      let bitrate = '320kbps';
      let format = 'AAC';
      let isLossless = false;

      if (type === SourceType.DOWNLOADED) {
        bitrate = song?.bitrate || '320kbps';
        format = song?.format || 'AAC';
        isLossless = Boolean(song?.isLossless) || String(bitrate).includes('320') || ['FLAC', 'WAV', 'ALAC'].includes(String(format).toUpperCase());
      } else if (type === SourceType.LOCAL) {
        const ext = String(uri || song?.name || '').match(/\.(flac|wav|alac|aac|mp3|m4a|ogg)/i)?.[1]?.toUpperCase() || 'AUDIO';
        format = ext;
        isLossless = ['FLAC', 'WAV', 'ALAC'].includes(ext) || Boolean(song?.isLossless);
        bitrate = isLossless ? 'Lossless' : '320kbps';
      } else if (provider === 'youtube_music') {
        bitrate = '160kbps';
        format = 'Opus/WebM';
        isLossless = false;
      } else {
        // JioSaavn / Remote stream
        if (uri.includes('_320') || (Array.isArray(song?.downloadUrl) && song.downloadUrl.some(u => (u.url === uri || u.link === uri) && String(u.quality).includes('320')))) {
          bitrate = '320kbps';
          isLossless = true;
        } else if (uri.includes('_160')) {
          bitrate = '160kbps';
          isLossless = false;
        } else if (uri.includes('_96')) {
          bitrate = '96kbps';
          isLossless = false;
        } else if (uri.includes('_48')) {
          bitrate = '48kbps';
          isLossless = false;
        } else if (uri.includes('_12')) {
          bitrate = '12kbps';
          isLossless = false;
        } else {
          bitrate = preferredQuality || '320kbps';
          isLossless = String(bitrate).includes('320');
        }
        format = uri.includes('.mp4') ? 'AAC (MP4)' : (uri.includes('.m4a') ? 'AAC' : 'MP3');
      }

      return {
        type,
        uri,
        provider: provider || 'direct',
        song,
        bitrate,
        format,
        isLossless,
        ...extra
      };
    }

    // 1. Downloaded Offline Audio Check
    if (song.source === 'DOWNLOADED' || (typeof Storage !== 'undefined' && Storage.isDownloaded && Storage.isDownloaded(song.id))) {
      try {
        const offlineUrl = await Storage.getDownloadedAudioUrl(song.id);
        if (offlineUrl) {
          console.log(`[PlaybackResolver] Selected: DOWNLOADED (${song.name || song.title})`);
          return createResult(SourceType.DOWNLOADED, offlineUrl, 'local_offline', song);
        }
      } catch (e) {
        console.warn('[PlaybackResolver] Downloaded audio check warning:', e);
      }
    }

    // 2. Local User Audio Check (Blob URL / File / ID3)
    const isLocalTrack = song.source === 'LOCAL' || 
                         song.isLocal === true || 
                         (typeof song.id === 'string' && (song.id.startsWith('loc_') || song.id.startsWith('local_'))) ||
                         Boolean(song.localBlobUrl) || 
                         (song.streamUrl && song.streamUrl.startsWith('blob:'));

    if (isLocalTrack) {
      let resolvedUrl = null;

      // 2a. Direct fileBlob on song object
      if (song.fileBlob && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
        resolvedUrl = URL.createObjectURL(song.fileBlob);
      }

      // 2b. Local audio URL from Storage / IndexedDB
      if (!resolvedUrl && typeof Storage !== 'undefined' && typeof Storage.getLocalAudioUrl === 'function') {
        try {
          resolvedUrl = await Storage.getLocalAudioUrl(song.id);
        } catch (e) {
          console.warn('[PlaybackResolver] getLocalAudioUrl warning:', e);
        }
      }

      // 2c. Fallback to existing localBlobUrl or streamUrl
      if (!resolvedUrl && (song.localBlobUrl || song.streamUrl)) {
        resolvedUrl = song.localBlobUrl || song.streamUrl;
      }

      if (resolvedUrl) {
        song.localBlobUrl = resolvedUrl;
        song.streamUrl = resolvedUrl;
        console.log(`[PlaybackResolver] Selected: LOCAL (${title}) -> ${resolvedUrl}`);
        return createResult(SourceType.LOCAL, resolvedUrl, 'local_file', song);
      } else {
        console.warn(`[PlaybackResolver] Local audio source missing for "${title}" (${songId})`);
        return {
          type: SourceType.LOCAL,
          uri: '',
          error: ErrorCode.FILE_MISSING,
          message: 'Local audio file could not be found or read from device storage.'
        };
      }
    }

    // Check Online Connectivity for remote streams
    const isOnline = (typeof OfflineManager !== 'undefined')
      ? OfflineManager.isOnline()
      : (typeof navigator === 'undefined' || navigator.onLine !== false);

    if (!isOnline) {
      return {
        type: SourceType.STREAMING,
        uri: '',
        error: ErrorCode.OFFLINE_UNAVAILABLE,
        message: 'This track is available offline only if downloaded.'
      };
    }

    // 3. In-Memory Stream Cache Check
    const cachedUrl = getCachedStream(song.id);
    if (cachedUrl && cachedUrl.startsWith('http')) {
      console.log(`[PlaybackResolver] Selected: CACHED (${title})`);
      return createResult(SourceType.CACHED, cachedUrl, song.provider || 'cached', song);
    }

    // 4. Already Available Direct Audio URL Check
    let directUrl = (typeof API !== 'undefined' && API.getDownloadUrl) ? API.getDownloadUrl(song, preferredQuality) : (song.audioUrl || song.streamUrl || '');

    if (directUrl && typeof directUrl === 'string' && directUrl.trim().startsWith('http')) {
      const u = directUrl.trim();
      setCachedStream(song.id, u);
      return createResult(SourceType.STREAMING, u, song.provider || 'direct', song);
    }

    const isYtOrigin = songId.startsWith('yt_') || song.provider === 'youtube_music' || Boolean(song.videoId || song.sourceYtVideoId);
    const ytVideoId = song.videoId || song.sourceYtVideoId || (songId.startsWith('yt_') ? songId.replace(/^yt_/, '') : null);

    console.log(`[PlaybackResolver] Resolving stream for "${title}" by "${artists}" (Origin: ${isYtOrigin ? 'YouTube Music' : 'JioSaavn'})`);

    // ========================================================================
    // PIPELINE A: YOUTUBE MUSIC ORIGIN TRACKS
    // 1. YouTube Music / YouTube Playback Source -> 2. JioSaavn Fallback -> 3. Offline/Local
    // ========================================================================
    if (isYtOrigin) {
      // Attempt 1: YouTube Music Direct Stream Resolution
      if (ytVideoId) {
        console.log(`[PlaybackResolver] Attempt 1 (YouTube Music): Resolving videoId ${ytVideoId}`);
        try {
          let ytStream = null;
          if (typeof youtubeMusicProvider !== 'undefined' && youtubeMusicProvider.resolveStream) {
            ytStream = await youtubeMusicProvider.resolveStream(ytVideoId, { signal });
          } else if (typeof YouTubeMusicService !== 'undefined' && typeof YouTubeMusicService.getStreamUrl === 'function') {
            ytStream = await YouTubeMusicService.getStreamUrl(ytVideoId);
          } else if (typeof fetch !== 'undefined' && (typeof ApiConfig === 'undefined' || !ApiConfig.isRunningInAndroid())) {
            const streamPath = `/api/providers/ytmusic/stream?videoId=${encodeURIComponent(ytVideoId)}`;
            const streamUrl = (typeof ApiConfig !== 'undefined' && typeof ApiConfig.buildUrl === 'function')
              ? ApiConfig.buildUrl(streamPath)
              : streamPath;
            const res = await fetch(streamUrl, { signal });
            if (res.ok) ytStream = await res.json();
          }

          if (ytStream && ytStream.url && ytStream.url.startsWith('http')) {
            const u = ytStream.url.trim();
            song.audioUrl = u;
            song.streamUrl = u;
            song.playbackAvailable = true;
            song.isPlayable = true;
            setCachedStream(song.id, u);
            console.log(`[PlaybackResolver] Selected: YouTube Music Stream (${title})`);
            return createResult(SourceType.STREAMING, u, 'youtube_music', song);
          }
        } catch (err) {
          if (err.name === 'AbortError') throw err;
          console.warn(`[PlaybackResolver] YouTube Music direct resolution failed:`, err.message);
        }
      }

      if (signal?.aborted) throw new Error('Playback request aborted');

      // Attempt 2: JioSaavn Catalog Match Fallback
      console.log(`[PlaybackResolver] Attempt 2 (JioSaavn Fallback): Searching for "${title} ${primaryArtist}"`);
      if (typeof API !== 'undefined' && API.searchSongs && (title || primaryArtist)) {
        try {
          const cleanQ = `${title.replace(/\(.*?\)|\[.*?\]/g, '')} ${primaryArtist}`.trim();
          const searchResults = await API.searchSongs(cleanQ, 1, 4);
          if (searchResults && searchResults.length > 0) {
            const matched = searchResults[0];
            const matchedUrl = API.getDownloadUrl(matched, preferredQuality);
            if (matchedUrl && typeof matchedUrl === 'string' && matchedUrl.trim().startsWith('http')) {
              const u = matchedUrl.trim();
              song.audioUrl = u;
              song.streamUrl = u;
              song.downloadUrl = matched.downloadUrl || [];
              song.playbackAvailable = true;
              song.isPlayable = true;
              setCachedStream(song.id, u);
              console.log(`[PlaybackResolver] Selected: JioSaavn Fallback Match (${matched.name})`);
              return createResult(SourceType.STREAMING, u, 'jiosaavn', song);
            }
          }
        } catch (err) {
          if (err.name === 'AbortError') throw err;
          console.warn('[PlaybackResolver] JioSaavn fallback matching failed:', err.message);
        }
      }
    }

    // ========================================================================
    // PIPELINE B: JIOSAAVN ORIGIN TRACKS
    // 1. JioSaavn Details & Streams -> 2. YouTube Music Fallback -> 3. Offline/Local
    // ========================================================================
    else {
      // Attempt 1: JioSaavn Song Details by ID
      if (song.id && typeof API !== 'undefined' && API.getSongDetails) {
        console.log(`[PlaybackResolver] Attempt 1 (JioSaavn ID): Fetching details for ID ${song.id}`);
        try {
          const details = await API.getSongDetails(song.id);
          if (details && details.length > 0) {
            const resolved = details[0];
            Object.assign(song, resolved);
            const u = API.getDownloadUrl(resolved, preferredQuality);
            if (u && typeof u === 'string' && u.trim().startsWith('http')) {
              const cleanU = u.trim();
              song.audioUrl = cleanU;
              song.streamUrl = cleanU;
              song.playbackAvailable = true;
              song.isPlayable = true;
              setCachedStream(song.id, cleanU);
              console.log(`[PlaybackResolver] Selected: JioSaavn Direct Stream (${title})`);
              return createResult(SourceType.STREAMING, cleanU, 'jiosaavn', song);
            }
          }
        } catch (err) {
          if (err.name === 'AbortError') throw err;
          console.warn('[PlaybackResolver] JioSaavn details resolution failed:', err.message);
        }
      }

      if (signal?.aborted) throw new Error('Playback request aborted');

      // Attempt 2: JioSaavn Search Match
      if (typeof API !== 'undefined' && API.searchSongs && (title || primaryArtist)) {
        console.log(`[PlaybackResolver] Attempt 2 (JioSaavn Search): Searching for "${title} ${primaryArtist}"`);
        try {
          const cleanQ = `${title.replace(/\(.*?\)|\[.*?\]/g, '')} ${primaryArtist}`.trim();
          const searchResults = await API.searchSongs(cleanQ, 1, 3);
          if (searchResults && searchResults.length > 0) {
            const matched = searchResults[0];
            const matchedUrl = API.getDownloadUrl(matched, preferredQuality);
            if (matchedUrl && typeof matchedUrl === 'string' && matchedUrl.trim().startsWith('http')) {
              const u = matchedUrl.trim();
              song.audioUrl = u;
              song.streamUrl = u;
              song.downloadUrl = matched.downloadUrl || [];
              song.playbackAvailable = true;
              song.isPlayable = true;
              setCachedStream(song.id, u);
              console.log(`[PlaybackResolver] Selected: JioSaavn Search Stream (${matched.name})`);
              return createResult(SourceType.STREAMING, u, 'jiosaavn', song);
            }
          }
        } catch (err) {
          if (err.name === 'AbortError') throw err;
          console.warn('[PlaybackResolver] JioSaavn search stream resolution failed:', err.message);
        }
      }

      if (signal?.aborted) throw new Error('Playback request aborted');

      // Attempt 3: YouTube Music Fallback via Title + Artist Search
      console.log(`[PlaybackResolver] Attempt 3 (YouTube Music Fallback): Searching for "${title} ${primaryArtist}"`);
      try {
        let ytTrack = null;
        if (typeof youtubeMusicProvider !== 'undefined' && youtubeMusicProvider.search) {
          const ytSearch = await youtubeMusicProvider.search(`${title} ${primaryArtist}`.trim(), { limit: 3, signal });
          ytTrack = ytSearch?.songs?.[0];
        }

        if (ytTrack && ytTrack.videoId) {
          const ytStream = (typeof youtubeMusicProvider !== 'undefined' && youtubeMusicProvider.resolveStream)
            ? await youtubeMusicProvider.resolveStream(ytTrack.videoId, { signal })
            : null;

          if (ytStream && ytStream.url && ytStream.url.startsWith('http')) {
            const u = ytStream.url.trim();
            song.audioUrl = u;
            song.streamUrl = u;
            song.sourceYtVideoId = ytTrack.videoId;
            song.playbackAvailable = true;
            song.isPlayable = true;
            setCachedStream(song.id, u);
            console.log(`[PlaybackResolver] Selected: YouTube Music Fallback (${ytTrack.name})`);
            return createResult(SourceType.STREAMING, u, 'youtube_music', song);
          }
        }
      } catch (err) {
        if (err.name === 'AbortError') throw err;
        console.warn('[PlaybackResolver] YouTube Music fallback resolution failed:', err.message);
      }
    }

    // All Providers Failed
    console.warn(`[PlaybackResolver] All providers failed for "${title}" (${songId})`);
    return {
      type: SourceType.UNKNOWN,
      uri: '',
      error: ErrorCode.SOURCE_UNAVAILABLE,
      message: "Couldn't play this song"
    };
  }

  return {
    SourceType,
    ErrorCode,
    resolvePlayableSource,
    getCachedStream,
    setCachedStream
  };
})();

if (typeof window !== 'undefined') {
  window.PlaybackResolver = PlaybackResolver;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PlaybackResolver;
}
