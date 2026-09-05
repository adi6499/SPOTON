// ============================================================================
// MUSICFLOW — VERCEL SERVERLESS FUNCTION: PROVIDERS HEALTH CHECK
// Endpoint: GET /api/providers/health
// ============================================================================

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  let saavnStatus = 'AVAILABLE';
  try {
    const saavnRes = await fetch('https://spoton-trpn.vercel.app/api/search/songs?query=test&limit=1', {
      signal: (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) ? AbortSignal.timeout(4000) : undefined
    });
    if (!saavnRes.ok) saavnStatus = 'SAAVN_PROVIDER_UNAVAILABLE';
  } catch (_) {
    saavnStatus = 'SAAVN_PROVIDER_UNAVAILABLE';
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    status: 'OK',
    timestamp: Date.now(),
    providers: {
      jiosaavn: { status: saavnStatus },
      youtube_music: { status: 'AVAILABLE' }
    }
  }));
};
