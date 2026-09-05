// ============================================================================
// MUSICFLOW — VERCEL SERVERLESS FUNCTION: YOUTUBE MUSIC STREAM RESOLVER
// Endpoint: POST/GET /api/providers/ytmusic/stream
// ============================================================================

const YouTubeMusicService = require('../../../youtubeMusicService.js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  let videoId = '';
  if (req.method === 'POST') {
    let body = '';
    if (req.body && typeof req.body === 'object') {
      videoId = req.body.videoId || req.body.id;
    } else {
      await new Promise(resolve => {
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
    const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    videoId = urlObj.searchParams.get('videoId') || urlObj.searchParams.get('id');
  }

  if (!videoId) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'MISSING_VIDEO_ID', message: 'videoId parameter is required' }));
    return;
  }

  try {
    const streamData = await YouTubeMusicService.getStreamUrl(videoId);
    if (streamData && streamData.url) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(streamData));
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'STREAM_NOT_FOUND', message: 'No valid audio stream found for videoId' }));
    }
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: err.message }));
  }
};
