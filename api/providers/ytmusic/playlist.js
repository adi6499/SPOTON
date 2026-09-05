// ============================================================================
// MUSICFLOW — VERCEL SERVERLESS FUNCTION: YOUTUBE MUSIC PLAYLIST
// Endpoint: POST/GET /api/providers/ytmusic/playlist
// ============================================================================

const YouTubeMusicService = require('../../../youtubeMusicService.js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  let playlistId = '';
  if (req.method === 'POST') {
    if (req.body && typeof req.body === 'object') {
      playlistId = req.body.playlistId || req.body.id || req.body.url || '';
    } else {
      await new Promise(resolve => {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            const parsed = JSON.parse(body || '{}');
            playlistId = parsed.playlistId || parsed.id || parsed.url || '';
          } catch (_) {}
          resolve();
        });
      });
    }
  } else {
    const host = req.headers.host || 'localhost';
    const parsedUrl = new URL(req.url, `http://${host}`);
    playlistId = parsedUrl.searchParams.get('playlistId') || parsedUrl.searchParams.get('id') || parsedUrl.searchParams.get('url') || '';
  }

  try {
    const results = await YouTubeMusicService.getPlaylist(playlistId);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, ...results }));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: err.message, playlist: null }));
  }
};
