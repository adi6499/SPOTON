// ============================================================================
// MUSICFLOW — VERCEL SERVERLESS FUNCTION: YOUTUBE MUSIC ALBUM
// Endpoint: POST/GET /api/providers/ytmusic/album
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

  let browseId = '';
  if (req.method === 'POST') {
    if (req.body && typeof req.body === 'object') {
      browseId = req.body.browseId || req.body.id || '';
    } else {
      await new Promise(resolve => {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            const parsed = JSON.parse(body || '{}');
            browseId = parsed.browseId || parsed.id || '';
          } catch (_) {}
          resolve();
        });
      });
    }
  } else {
    const host = req.headers.host || 'localhost';
    const parsedUrl = new URL(req.url, `http://${host}`);
    browseId = parsedUrl.searchParams.get('browseId') || parsedUrl.searchParams.get('id') || '';
  }

  try {
    const results = await YouTubeMusicService.getAlbum(browseId);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, ...results }));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: err.message, album: null }));
  }
};
