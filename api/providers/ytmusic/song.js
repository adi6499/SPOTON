// ============================================================================
// MUSICFLOW — VERCEL SERVERLESS FUNCTION: YOUTUBE MUSIC SONG DETAILS
// Endpoint: POST/GET /api/providers/ytmusic/song
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

  let videoId = '';
  if (req.method === 'POST') {
    if (req.body && typeof req.body === 'object') {
      videoId = req.body.videoId || req.body.id;
    } else {
      await new Promise(resolve => {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            const parsed = JSON.parse(body || '{}');
            videoId = parsed.videoId || parsed.id;
          } catch (_) {}
          resolve();
        });
      });
    }
  } else {
    const host = req.headers.host || 'localhost';
    const parsedUrl = new URL(req.url, `http://${host}`);
    videoId = parsedUrl.searchParams.get('videoId') || parsedUrl.searchParams.get('id') || '';
  }

  if (!videoId) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'videoId parameter is required', code: 'MISSING_VIDEO_ID' }));
    return;
  }

  try {
    const result = await YouTubeMusicService.importTrack(videoId);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, ...result }));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: err.message, track: null }));
  }
};
