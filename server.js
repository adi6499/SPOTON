// ========================================
// MusicFlow — Local Dev & Mobile Test Server
// ========================================

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = process.env.PORT || 5500;
const ROOT_DIR = __dirname;
const jiosaavnService = require('./jiosaavnService');
const YouTubeMusicService = require('./youtubeMusicService');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.m4a': 'audio/mp4',
  '.mp3': 'audio/mpeg'
};

function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

const server = http.createServer((req, res) => {
  // CORS & Security headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  let cleanUrl = req.url.split('?')[0];
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost:5500'}`);
  const urlPath = parsedUrl.pathname;

  // JioSaavn Service Endpoints
  if (urlPath === '/api/search/songs' && req.method === 'GET') {
    const q = parsedUrl.searchParams.get('query') || parsedUrl.searchParams.get('q') || '';
    const page = parseInt(parsedUrl.searchParams.get('page') || parsedUrl.searchParams.get('p') || '1', 10);
    const limit = parseInt(parsedUrl.searchParams.get('limit') || parsedUrl.searchParams.get('n') || '20', 10);
    (async () => {
      try {
        const data = await jiosaavnService.searchSongs(q, page, limit);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    })();
    return;
  }

  if (urlPath === '/api/search/albums' && req.method === 'GET') {
    const q = parsedUrl.searchParams.get('query') || parsedUrl.searchParams.get('q') || '';
    const page = parseInt(parsedUrl.searchParams.get('page') || '1', 10);
    const limit = parseInt(parsedUrl.searchParams.get('limit') || '20', 10);
    (async () => {
      try {
        const data = await jiosaavnService.searchAlbums(q, page, limit);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    })();
    return;
  }

  if (urlPath === '/api/search/playlists' && req.method === 'GET') {
    const q = parsedUrl.searchParams.get('query') || parsedUrl.searchParams.get('q') || '';
    const page = parseInt(parsedUrl.searchParams.get('page') || '1', 10);
    const limit = parseInt(parsedUrl.searchParams.get('limit') || '20', 10);
    (async () => {
      try {
        const data = await jiosaavnService.searchPlaylists(q, page, limit);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    })();
    return;
  }

  if (urlPath === '/api/search/artists' && req.method === 'GET') {
    const q = parsedUrl.searchParams.get('query') || parsedUrl.searchParams.get('q') || '';
    const page = parseInt(parsedUrl.searchParams.get('page') || '1', 10);
    const limit = parseInt(parsedUrl.searchParams.get('limit') || '20', 10);
    (async () => {
      try {
        const data = await jiosaavnService.searchArtists(q, page, limit);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    })();
    return;
  }

  if (urlPath === '/api/search' && req.method === 'GET') {
    const q = parsedUrl.searchParams.get('query') || parsedUrl.searchParams.get('q') || '';
    (async () => {
      try {
        const data = await jiosaavnService.searchAll(q);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    })();
    return;
  }

  if ((urlPath.startsWith('/api/songs/') || urlPath === '/api/songs') && req.method === 'GET') {
    const id = urlPath.startsWith('/api/songs/') ? urlPath.replace('/api/songs/', '').trim() : parsedUrl.searchParams.get('id');
    (async () => {
      try {
        const data = await jiosaavnService.getSongDetails(id);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    })();
    return;
  }

  if ((urlPath.startsWith('/api/albums/') || urlPath === '/api/albums') && req.method === 'GET') {
    const id = urlPath.startsWith('/api/albums/') ? urlPath.replace('/api/albums/', '').trim() : parsedUrl.searchParams.get('id');
    (async () => {
      try {
        const data = await jiosaavnService.getAlbumDetails(id);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    })();
    return;
  }

  if ((urlPath.startsWith('/api/playlists/') || urlPath === '/api/playlists') && req.method === 'GET') {
    const id = urlPath.startsWith('/api/playlists/') ? urlPath.replace('/api/playlists/', '').trim() : parsedUrl.searchParams.get('id');
    (async () => {
      try {
        const data = await jiosaavnService.getPlaylistDetails(id);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    })();
    return;
  }

  if ((urlPath.startsWith('/api/artists/') || urlPath === '/api/artists') && req.method === 'GET') {
    const id = urlPath.startsWith('/api/artists/') ? urlPath.replace('/api/artists/', '').trim() : parsedUrl.searchParams.get('id');
    (async () => {
      try {
        const data = await jiosaavnService.getArtistDetails(id);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    })();
    return;
  }

  if (urlPath === '/api/modules' && req.method === 'GET') {
    (async () => {
      try {
        const data = await jiosaavnService.getBrowseModules();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    })();
    return;
  }

  // YouTube Music endpoints
  if (urlPath === '/api/providers/ytmusic/stream') {
    const videoId = parsedUrl.searchParams.get('videoId') || parsedUrl.searchParams.get('id');
    (async () => {
      try {
        const streamData = await YouTubeMusicService.getStreamUrl(videoId);
        if (streamData && streamData.url) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(streamData));
        } else {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'STREAM_NOT_FOUND' }));
        }
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    })();
    return;
  }

  if (urlPath === '/api/providers/ytmusic/search' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { query, limit } = JSON.parse(body || '{}');
        const results = await YouTubeMusicService.search(query, limit || 30);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(results));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message, songs: [] }));
      }
    });
    return;
  }

  if (urlPath === '/api/providers/ytmusic/radio' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { videoId, title, artist, limit } = JSON.parse(body || '{}');
        const results = await YouTubeMusicService.getRadioCandidates(videoId, title, artist, limit || 25);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(results));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message, candidates: [] }));
      }
    });
    return;
  }

  if (urlPath === '/api/update') {
    try {
      const handleUpdate = require('./api/update.js');
      handleUpdate(req, res);
      return;
    } catch (_) {}
  }

  // Streaming audio CORS proxy for Web Audio, Equalizer & 3D Spatial Sound
  if (cleanUrl === '/api/proxy-audio' || cleanUrl === '/proxy-audio') {
    try {
      const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
      const targetAudioUrl = parsedUrl.searchParams.get('url');
      if (!targetAudioUrl || !targetAudioUrl.startsWith('http')) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Missing or invalid url query parameter');
        return;
      }

      const https = require('https');
      const httpModule = targetAudioUrl.startsWith('https:') ? https : http;

      const proxyReq = httpModule.get(targetAudioUrl, (proxyRes) => {
        // Handle redirect if any
        if (proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
          res.writeHead(302, { 'Location': proxyRes.headers.location, 'Access-Control-Allow-Origin': '*' });
          res.end();
          return;
        }

        const headers = {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': '*',
          'Content-Type': proxyRes.headers['content-type'] || 'audio/mp4',
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=86400'
        };
        if (proxyRes.headers['content-length']) {
          headers['Content-Length'] = proxyRes.headers['content-length'];
        }
        if (proxyRes.headers['content-range']) {
          headers['Content-Range'] = proxyRes.headers['content-range'];
        }

        res.writeHead(proxyRes.statusCode || 200, headers);
        proxyRes.pipe(res);
      });

      proxyReq.on('error', (err) => {
        console.warn('[Proxy Audio Error]:', err.message);
        res.writeHead(502, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' });
        res.end('Proxy Fetch Failed');
      });
      return;
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' });
      res.end('Internal Proxy Error');
      return;
    }
  }

  // Guard: API routes must return JSON 404, never static files
  if (urlPath.startsWith('/api/')) {
    res.writeHead(404, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ success: false, error: 'API route not found', path: urlPath }));
    return;
  }

  if (cleanUrl === '/' || cleanUrl === '') {
    cleanUrl = '/index.html';
  }

  const safePath = path.normalize(cleanUrl).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(ROOT_DIR, safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Cache-Control': 'no-cache'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const localIp = getLocalIp();
  console.log('\n========================================');
  console.log('🎵 MusicFlow Local & Mobile Server Running!');
  console.log('========================================');
  console.log(`💻 Local PC URL:       http://localhost:${PORT}`);
  console.log(`📱 Mobile (Same Wi-Fi): http://${localIp}:${PORT}`);
  console.log('========================================\n');
});
