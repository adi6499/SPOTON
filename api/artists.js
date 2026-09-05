// ============================================================================
// MUSICFLOW — VERCEL SERVERLESS FUNCTION: JIOSAAVN ARTIST DETAILS
// Endpoint: GET /api/artists?id=... or /api/artists/:id
// ============================================================================

const jiosaavnService = require('../jiosaavnService.js');

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
  const id = parsedUrl.searchParams.get('id') || parsedUrl.pathname.replace(/^\/api\/artists\/?/, '').trim();

  try {
    const results = await jiosaavnService.getArtistDetails(id);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(results));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: err.message, data: { topSongs: [], topAlbums: [] } }));
  }
};
