// ============================================================================
// MUSICFLOW — VERCEL SERVERLESS FUNCTION: YOUTUBE MUSIC SEARCH
// Endpoint: POST /api/providers/ytmusic/search
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

  let body = '';
  let query = '';
  let limit = 20;

  if (req.method === 'POST') {
    if (req.body && typeof req.body === 'object') {
      query = req.body.query || '';
      limit = req.body.limit || 20;
    } else {
      await new Promise(resolve => {
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            const parsed = JSON.parse(body || '{}');
            query = parsed.query || '';
            limit = parsed.limit || 20;
          } catch (_) {}
          resolve();
        });
      });
    }
  } else {
    const host = req.headers.host || 'localhost';
    const parsedUrl = new URL(req.url, `http://${host}`);
    query = parsedUrl.searchParams.get('query') || parsedUrl.searchParams.get('q') || '';
    limit = parseInt(parsedUrl.searchParams.get('limit') || '20', 10);
  }

  try {
    const results = await YouTubeMusicService.search(query, limit);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, ...results }));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: err.message, songs: [], artists: [], albums: [], playlists: [] }));
  }
};
