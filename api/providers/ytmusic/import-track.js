// ============================================================================
// MUSICFLOW — VERCEL SERVERLESS FUNCTION: YOUTUBE SINGLE TRACK IMPORT
// Endpoint: POST /api/providers/ytmusic/import-track
// Always returns standardized JSON: { success: true, track: ..., matched: ... }
// ============================================================================

const YouTubeMusicService = require('../../../youtubeMusicService.js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization, X-Requested-With, Origin');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Method Not Allowed', code: 'METHOD_NOT_ALLOWED' }));
    return;
  }

  let body = '';
  let url = '';

  if (req.query && typeof req.query === 'object') {
    url = req.query.url || req.query.videoId || req.query.id || req.query.v || '';
  }

  if (!url && req.body && typeof req.body === 'object') {
    url = req.body.url || req.body.videoId || req.body.id || req.body.v || '';
  } else if (!url) {
    await new Promise(resolve => {
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body || '{}');
          url = parsed.url || parsed.videoId || parsed.id || parsed.v || '';
        } catch (_) {}
        resolve();
      });
    });
  }

  if (!url || typeof url !== 'string' || !url.trim()) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'YouTube URL or Video ID is required', code: 'MISSING_URL' }));
    return;
  }

  try {
    const result = await YouTubeMusicService.importTrack(url.trim());
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, ...result }));
  } catch (err) {
    console.error('[ImportTrackAPI] Execution failed:', err.message);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: false,
      error: {
        code: 'IMPORT_FAILED',
        message: err.message || 'Failed to import YouTube track',
        details: String(err.stack || '')
      }
    }));
  }
};
