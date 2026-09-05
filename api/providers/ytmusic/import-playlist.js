// ============================================================================
// MUSICFLOW — VERCEL SERVERLESS FUNCTION: YOUTUBE PLAYLIST / ALBUM IMPORT
// Endpoint: POST /api/providers/ytmusic/import-playlist
// Always returns standardized JSON: { success: true, ... } or { success: false, error, code }
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

  // Extract from query params if available
  if (req.query && typeof req.query === 'object') {
    url = req.query.url || req.query.playlistUrl || req.query.id || req.query.list || '';
  }

  if (!url && req.body && typeof req.body === 'object') {
    url = req.body.url || req.body.playlistUrl || req.body.id || req.body.list || '';
  } else if (!url) {
    await new Promise(resolve => {
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body || '{}');
          url = parsed.url || parsed.playlistUrl || parsed.id || parsed.list || '';
        } catch (_) {}
        resolve();
      });
    });
  }

  if (!url || typeof url !== 'string' || !url.trim()) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'YouTube URL or Playlist ID is required', code: 'MISSING_URL' }));
    return;
  }

  try {
    const result = await YouTubeMusicService.importAndMatchPlaylist(url.trim());
    if (!result || (result.totalFound === 0 && !result.isSingleSong)) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: {
          code: 'EMPTY_PLAYLIST',
          message: 'Playlist contains no accessible tracks.'
        },
        totalFound: 0,
        matchedCount: 0,
        unmatchedCount: 0,
        matchedTracks: [],
        unmatchedTracks: [],
        allTracks: []
      }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, ...result }));
  } catch (err) {
    console.error('[ImportPlaylistAPI] Execution failed:', err.message);
    const isNotFound = err.message && (err.message.includes('no accessible tracks') || err.message.includes('not found'));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: false,
      error: {
        code: isNotFound ? 'EMPTY_PLAYLIST' : 'IMPORT_FAILED',
        message: isNotFound ? 'Playlist contains no accessible tracks.' : (err.message || 'Failed to import YouTube playlist'),
        details: String(err.stack || '')
      },
      totalFound: 0,
      matchedCount: 0,
      unmatchedCount: 0,
      matchedTracks: [],
      unmatchedTracks: [],
      allTracks: []
    }));
  }
};
