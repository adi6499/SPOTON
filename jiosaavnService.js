// ============================================================================
// MUSICFLOW — JIOSAAVN SERVICE (Server-side & Vercel Serverless Engine)
// Directly interfaces with JioSaavn API with 320kbps lossless stream decryption
// ============================================================================

const forge = require('node-forge');

const JIOSAAVN_API_URL = 'https://www.jiosaavn.com/api.php';
const DES_KEY = '38346591';
const DES_IV = '00000000';

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
];

function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function decodeHtml(str) {
  if (!str || typeof str !== 'string') return str || '';
  return str
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&apos;/g, "'");
}

function decryptMediaUrl(encryptedMediaUrl) {
  if (!encryptedMediaUrl || typeof encryptedMediaUrl !== 'string') return [];
  try {
    const encrypted = forge.util.decode64(encryptedMediaUrl.trim());
    const decipher = forge.cipher.createDecipher('DES-ECB', forge.util.createBuffer(DES_KEY));
    decipher.start({ iv: forge.util.createBuffer(DES_IV) });
    decipher.update(forge.util.createBuffer(encrypted));
    decipher.finish();
    const raw = decipher.output.getBytes();
    if (!raw || !raw.includes('.mp4')) return [];

    return [
      { quality: '12kbps', url: raw.replace('_96', '_12') },
      { quality: '48kbps', url: raw.replace('_96', '_48') },
      { quality: '96kbps', url: raw.replace('_96', '_96') },
      { quality: '160kbps', url: raw.replace('_96', '_160') },
      { quality: '320kbps', url: raw.replace('_96', '_320') }
    ];
  } catch (_) {
    return [];
  }
}

function createImageLinks(link) {
  if (!link || typeof link !== 'string') return [];
  const clean = link.trim().replace(/^http:\/\//, 'https://');
  return [
    { quality: '50x50', url: clean.replace(/150x150|50x50|500x500/, '50x50') },
    { quality: '150x150', url: clean.replace(/150x150|50x50|500x500/, '150x150') },
    { quality: '500x500', url: clean.replace(/150x150|50x50|500x500/, '500x500') }
  ];
}

function formatSong(s) {
  if (!s) return null;
  const more = s.more_info || {};
  const dl = decryptMediaUrl(more.encrypted_media_url || s.encrypted_media_url);
  const bestUrl = dl.find(d => d.quality === '320kbps')?.url || dl[dl.length - 1]?.url || '';

  let primaryArtists = '';
  if (Array.isArray(more.artistMap?.primary_artists) && more.artistMap.primary_artists.length > 0) {
    primaryArtists = more.artistMap.primary_artists.map(a => a.name).join(', ');
  } else if (more.primary_artists) {
    primaryArtists = String(more.primary_artists);
  } else if (s.primary_artists) {
    primaryArtists = String(s.primary_artists);
  } else if (s.subtitle) {
    primaryArtists = String(s.subtitle).split('-')[0].trim();
  }

  const titleClean = decodeHtml(s.title || s.song || s.name || 'Unknown');
  const albumName = decodeHtml(more.album || s.album || '');

  return {
    id: String(s.id),
    name: titleClean,
    title: titleClean,
    type: s.type || 'song',
    year: s.year || more.year || '',
    releaseDate: more.release_date || s.release_date || null,
    duration: Number(more.duration || s.duration || 0),
    label: more.label || s.label || null,
    explicitContent: s.explicit_content === '1' || more.explicit_content === '1',
    playCount: Number(s.play_count || more.play_count || 0),
    language: s.language || more.language || 'hindi',
    hasLyrics: more.has_lyrics === 'true',
    lyricsId: more.lyrics_id || null,
    url: s.perma_url || '',
    album: {
      id: String(more.album_id || s.albumid || ''),
      name: albumName,
      title: albumName,
      url: more.album_url || s.album_url || ''
    },
    artists: {
      primary: primaryArtists ? primaryArtists.split(',').map(n => ({ id: '', name: n.trim(), role: 'singer' })) : [],
      all: []
    },
    primaryArtists: primaryArtists,
    image: createImageLinks(s.image),
    downloadUrl: dl,
    audioUrl: bestUrl,
    streamUrl: bestUrl,
    isPlayable: true,
    provider: 'jiosaavn'
  };
}

function formatAlbum(a) {
  if (!a) return null;
  const more = a.more_info || {};
  let artist = '';
  if (more.artistMap?.primary_artists?.length) {
    artist = more.artistMap.primary_artists.map(ar => ar.name).join(', ');
  } else if (a.artist || more.music) {
    artist = a.artist || more.music;
  } else if (a.subtitle) {
    artist = a.subtitle;
  }

  const titleClean = decodeHtml(a.title || a.name || 'Unknown Album');

  return {
    id: String(a.id),
    name: titleClean,
    title: titleClean,
    type: 'album',
    year: a.year || more.year || '',
    language: a.language || more.language || 'hindi',
    url: a.perma_url || '',
    songCount: Number(more.song_pids ? more.song_pids.split(',').length : (a.list_count || 0)),
    artist: artist,
    artists: artist,
    image: createImageLinks(a.image)
  };
}

function formatPlaylist(p) {
  if (!p) return null;
  const more = p.more_info || {};
  const titleClean = decodeHtml(p.title || p.name || 'Unknown Playlist');

  return {
    id: String(p.id || p.listid),
    name: titleClean,
    title: titleClean,
    type: 'playlist',
    url: p.perma_url || '',
    songCount: Number(more.song_count || p.list_count || 0),
    language: p.language || more.language || 'hindi',
    image: createImageLinks(p.image),
    subtitle: p.subtitle || more.firstname || 'MusicFlow'
  };
}

async function callJioSaavn(endpoint, params = {}) {
  const url = new URL(JIOSAAVN_API_URL);
  url.searchParams.set('__call', endpoint);
  url.searchParams.set('_format', 'json');
  url.searchParams.set('_marker', '0');
  url.searchParams.set('api_version', '4');
  url.searchParams.set('ctx', 'web6dot0');

  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) {
      url.searchParams.set(k, String(v));
    }
  });

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'User-Agent': getRandomUserAgent(),
      'Accept': 'application/json, text/plain, */*'
    },
    signal: (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) ? AbortSignal.timeout(9000) : undefined
  });

  if (!res.ok) {
    throw new Error(`JioSaavn returned HTTP ${res.status}`);
  }

  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (_) {
    try {
      const clean = text.trim().replace(/^[^{[]*/, '').replace(/[^}\]]*$/, '');
      return clean ? JSON.parse(clean) : {};
    } catch (_) {
      return {};
    }
  }
}

// ----------------------------------------------------------------------------
// PUBLIC API METHODS
// ----------------------------------------------------------------------------

async function searchSongs(query, page = 1, limit = 20) {
  const data = await callJioSaavn('search.getResults', {
    q: query,
    p: page,
    n: limit
  });

  const rawResults = data.results || [];
  const results = rawResults.map(formatSong).filter(Boolean);

  return {
    success: true,
    data: {
      total: Number(data.total || results.length),
      start: Number(data.start || 0),
      results
    }
  };
}

async function searchAlbums(query, page = 1, limit = 20) {
  const data = await callJioSaavn('search.getAlbumResults', {
    q: query,
    p: page,
    n: limit
  });

  const rawResults = data.results || [];
  const results = rawResults.map(formatAlbum).filter(Boolean);

  return {
    success: true,
    data: {
      total: Number(data.total || results.length),
      start: Number(data.start || 0),
      results
    }
  };
}

async function searchPlaylists(query, page = 1, limit = 20) {
  const data = await callJioSaavn('search.getPlaylistResults', {
    q: query,
    p: page,
    n: limit
  });

  const rawResults = data.results || [];
  const results = rawResults.map(formatPlaylist).filter(Boolean);

  return {
    success: true,
    data: {
      total: Number(data.total || results.length),
      start: Number(data.start || 0),
      results
    }
  };
}

async function searchArtists(query, page = 1, limit = 20) {
  const data = await callJioSaavn('search.getArtistResults', {
    q: query,
    p: page,
    n: limit
  });

  const rawResults = data.results || [];
  const results = rawResults.map(a => ({
    id: String(a.id),
    name: decodeHtml(a.title || a.name || 'Artist'),
    role: a.role || 'artist',
    image: createImageLinks(a.image),
    type: 'artist',
    url: a.perma_url || ''
  }));

  return {
    success: true,
    data: {
      total: Number(data.total || results.length),
      start: Number(data.start || 0),
      results
    }
  };
}

async function searchAll(query) {
  const data = await callJioSaavn('autocomplete.get', {
    query: query
  });

  const songs = (data.songs?.data || []).map(formatSong).filter(Boolean);
  const albums = (data.albums?.data || []).map(formatAlbum).filter(Boolean);
  const playlists = (data.playlists?.data || []).map(formatPlaylist).filter(Boolean);
  const artists = (data.artists?.data || []).map(a => ({
    id: String(a.id),
    name: decodeHtml(a.title || a.name),
    image: createImageLinks(a.image),
    role: 'artist'
  }));

  return {
    success: true,
    data: {
      songs: { results: songs },
      albums: { results: albums },
      playlists: { results: playlists },
      artists: { results: artists }
    }
  };
}

async function getSongDetails(id) {
  if (!id || typeof id !== 'string' || id.startsWith('yt_') || id.startsWith('ytm_')) {
    return {
      success: true,
      data: []
    };
  }

  const data = await callJioSaavn('song.getDetails', {
    pids: id
  });

  const list = Array.isArray(data.songs) ? data.songs : Object.values(data.songs || data || {}).filter(item => item && item.id);
  const results = list.map(formatSong).filter(Boolean);

  return {
    success: true,
    data: results
  };
}

async function getAlbumDetails(id) {
  if (!id || typeof id !== 'string' || id.startsWith('alb_yt_') || id.startsWith('yt_')) {
    return {
      success: true,
      data: { id: id || '', name: '', songs: [] }
    };
  }

  const data = await callJioSaavn('content.getAlbumDetails', {
    albumid: id
  });

  const songs = (data.list || data.songs || []).map(formatSong).filter(Boolean);
  const album = formatAlbum(data);

  return {
    success: true,
    data: {
      ...album,
      songs
    }
  };
}

async function getPlaylistDetails(id) {
  if (!id || typeof id !== 'string' || id.startsWith('pl_yt_') || id.startsWith('yt_')) {
    return {
      success: true,
      data: { id: id || '', name: '', songs: [] }
    };
  }

  const data = await callJioSaavn('playlist.getDetails', {
    listid: id
  });

  const songs = (data.list || data.songs || []).map(formatSong).filter(Boolean);
  const playlist = formatPlaylist(data);

  return {
    success: true,
    data: {
      ...playlist,
      songs
    }
  };
}

async function getArtistDetails(id) {
  const data = await callJioSaavn('artist.getArtistPageDetails', {
    artistId: id
  });

  const topSongs = (data.topSongs || data.songs || []).map(formatSong).filter(Boolean);
  const topAlbums = (data.topAlbums || data.albums || []).map(formatAlbum).filter(Boolean);

  return {
    success: true,
    data: {
      id: String(data.artistId || id),
      name: decodeHtml(data.name || data.title || 'Artist'),
      image: createImageLinks(data.image),
      topSongs,
      topAlbums
    }
  };
}

async function getBrowseModules() {
  const data = await callJioSaavn('content.getBrowseModules');
  return {
    success: true,
    data
  };
}

module.exports = {
  searchSongs,
  searchAlbums,
  searchPlaylists,
  searchArtists,
  searchAll,
  getSongDetails,
  getAlbumDetails,
  getPlaylistDetails,
  getArtistDetails,
  getBrowseModules,
  formatSong,
  decryptMediaUrl,
  createImageLinks
};
