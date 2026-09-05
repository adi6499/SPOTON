// ============================================================================
// MUSICFLOW — VERCEL SERVERLESS FUNCTION: YOUTUBE MUSIC RADIO
// Endpoint: POST /api/providers/ytmusic/radio
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
  let payload = {};

  if (req.method === 'POST') {
    if (req.body && typeof req.body === 'object') {
      payload = req.body;
    } else {
      await new Promise(resolve => {
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            payload = JSON.parse(body || '{}');
          } catch (_) {}
          resolve();
        });
      });
    }
  } else {
    const host = req.headers.host || 'localhost';
    const parsedUrl = new URL(req.url, `http://${host}`);
    payload = {
      videoId: parsedUrl.searchParams.get('videoId') || '',
      title: parsedUrl.searchParams.get('title') || '',
      artist: parsedUrl.searchParams.get('artist') || '',
      limit: parseInt(parsedUrl.searchParams.get('limit') || '25', 10)
    };
  }

  try {
    const { videoId, title, artist, limit } = payload;
    const results = await YouTubeMusicService.getRadioCandidates(videoId, title, artist, limit || 25);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, ...results }));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: err.message, candidates: [] }));
  }
};
