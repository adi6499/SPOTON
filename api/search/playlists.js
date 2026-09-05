// ============================================================================
// MUSICFLOW — VERCEL SERVERLESS FUNCTION: JIOSAAVN SEARCH PLAYLISTS
// Endpoint: GET /api/search/playlists?query=...&page=1&limit=20
// ============================================================================

const jiosaavnService = require('../../jiosaavnService.js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const host = req.headers.host || 'localhost';
  const parsedUrl = new URL(req.url, `http://${host}`);
  const query = parsedUrl.searchParams.get('query') || parsedUrl.searchParams.get('q') || '';
  const page = parseInt(parsedUrl.searchParams.get('page') || '1', 10);
  const limit = parseInt(parsedUrl.searchParams.get('limit') || '20', 10);

  try {
    const results = await jiosaavnService.searchPlaylists(query, page, limit);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(results));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: err.message, data: { results: [], total: 0, start: 0 } }));
  }
};
