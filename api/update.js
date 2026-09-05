// ============================================================================
// MUSICFLOW — VERCEL SERVERLESS UPDATE API & GITHUB RELEASES INTEGRATION
// Endpoint: GET /api/update?platform=android&version=2.7.0
// Normalized in-app update information for sideloaded Android APK & iOS IPA builds
// ============================================================================

const https = require('https');
const http = require('http');

// Configurable Server Environment Variables
const GITHUB_REPO = process.env.GITHUB_REPO || 'adi6499/MUSIC-FLOW';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const MINIMUM_SUPPORTED_VERSION = process.env.MINIMUM_SUPPORTED_VERSION || '1.0.0';

// Server-Side In-Memory Cache (10-minute TTL to protect GitHub API limits)
let cachedReleaseData = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// ----------------------------------------------------------------------------
// 1. SEMANTIC VERSION PARSER & COMPARATOR
// ----------------------------------------------------------------------------
function parseSemVer(verStr) {
  if (!verStr || typeof verStr !== 'string') {
    return { major: 0, minor: 0, patch: 0, build: 0, raw: '0.0.0' };
  }

  // Strip leading 'v' or 'V' and whitespace
  let clean = verStr.trim().replace(/^[vV]/, '');

  // Extract build number if present (e.g. 1.8.0+12 or 1.8.0-build.12 or 1.8.0 (12))
  let build = 0;
  const buildMatch = clean.match(/[\+\-build\.]+(\d+)$/i) || clean.match(/\((\d+)\)$/);
  if (buildMatch) {
    build = parseInt(buildMatch[1], 10) || 0;
    clean = clean.replace(/[\+\-build\.]+(\d+)$/i, '').replace(/\((\d+)\)$/, '').trim();
  }

  // Remove pre-release tags (e.g., -beta, -rc1) for core version numbers
  const coreParts = clean.split('-')[0].split('.');
  const major = parseInt(coreParts[0], 10) || 0;
  const minor = parseInt(coreParts[1], 10) || 0;
  const patch = parseInt(coreParts[2], 10) || 0;

  return { major, minor, patch, build, raw: verStr.trim() };
}

/**
 * Compares two semantic version strings.
 * Returns:
 *   1 if v1 > v2 (v1 is newer)
 *  -1 if v1 < v2 (v1 is older)
 *   0 if v1 === v2
 */
function compareSemVer(v1, v2) {
  const p1 = parseSemVer(v1);
  const p2 = parseSemVer(v2);

  if (p1.major !== p2.major) return p1.major > p2.major ? 1 : -1;
  if (p1.minor !== p2.minor) return p1.minor > p2.minor ? 1 : -1;
  if (p1.patch !== p2.patch) return p1.patch > p2.patch ? 1 : -1;
  if (p1.build !== p2.build) return p1.build > p2.build ? 1 : -1;
  return 0;
}

// ----------------------------------------------------------------------------
// 2. RELEASE NOTES PARSER
// ----------------------------------------------------------------------------
function parseReleaseNotes(markdownBody) {
  if (!markdownBody || typeof markdownBody !== 'string') {
    return ['General performance improvements and bug fixes.'];
  }

  const lines = markdownBody.split('\n');
  const bulletNotes = [];

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    // Match markdown bullets: - item, * item, + item, 1. item
    const bulletMatch = trimmed.match(/^[\*\-\+]\s+(.+)$/) || trimmed.match(/^\d+\.\s+(.+)$/);
    if (bulletMatch) {
      const cleanNote = bulletMatch[1]
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // remove markdown links [text](url) -> text
        .replace(/[*_`~]/g, '') // remove bold/italic/code markers
        .trim();
      if (cleanNote.length > 2 && !cleanNote.startsWith('Full Changelog') && !cleanNote.startsWith('Signed-off-by')) {
        bulletNotes.push(cleanNote);
      }
    }
  }

  if (bulletNotes.length === 0) {
    // If no bullet points found, extract non-empty sentences or headers
    const paragraphs = lines
      .map(l => l.replace(/^[#\*\-\+>\s]+/, '').replace(/[*_`~]/g, '').trim())
      .filter(l => l.length > 5 && !l.startsWith('http') && !l.startsWith('Full Changelog'));
    return paragraphs.slice(0, 6);
  }

  return bulletNotes.slice(0, 8);
}

// ----------------------------------------------------------------------------
// 3. GITHUB RELEASES API FETCH
// ----------------------------------------------------------------------------
function fetchGitHubReleases(repo) {
  return new Promise((resolve, reject) => {
    const url = `https://api.github.com/repos/${repo}/releases`;
    const options = {
      headers: {
        'User-Agent': 'MusicFlow-InApp-Update-Service/2.6.0',
        'Accept': 'application/vnd.github.v3+json'
      }
    };

    if (GITHUB_TOKEN) {
      options.headers['Authorization'] = `token ${GITHUB_TOKEN}`;
    }

    https.get(url, options, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const releases = JSON.parse(body);
            resolve(releases);
          } catch (e) {
            reject(new Error(`Failed to parse GitHub response: ${e.message}`));
          }
        } else if (res.statusCode === 403 || res.statusCode === 429) {
          reject(new Error('GitHub API rate limit reached.'));
        } else if (res.statusCode === 404) {
          reject(new Error(`GitHub repository "${repo}" or releases not found.`));
        } else {
          reject(new Error(`GitHub API returned status ${res.statusCode}: ${body.slice(0, 100)}`));
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

// ----------------------------------------------------------------------------
// 4. LATEST STABLE RELEASE NORMALIZATION
// ----------------------------------------------------------------------------
async function getLatestReleaseData(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedReleaseData && (now - cacheTimestamp < CACHE_TTL_MS)) {
    return cachedReleaseData;
  }

  try {
    const releases = await fetchGitHubReleases(GITHUB_REPO);
    if (!Array.isArray(releases) || releases.length === 0) {
      throw new Error('No releases found in GitHub repository');
    }

    // Filter out drafts and prereleases to ensure only stable releases are served
    const stableReleases = releases.filter(r => !r.draft && !r.prerelease);
    const targetRelease = stableReleases[0] || releases[0];

    if (!targetRelease) {
      throw new Error('No valid release available');
    }

    const tagName = targetRelease.tag_name || targetRelease.name || '0.0.0';
    const cleanVersion = tagName.replace(/^[vV]/, '').trim();
    const assets = targetRelease.assets || [];

    // Find Android APK Asset
    let androidAsset = assets.find(a => {
      const name = a.name.toLowerCase();
      return name.endsWith('.apk') && (name.includes('android') || name.includes('musicflow'));
    }) || assets.find(a => a.name.toLowerCase().endsWith('.apk'));

    // Find iOS IPA Asset
    let iosAsset = assets.find(a => {
      const name = a.name.toLowerCase();
      return name.endsWith('.ipa') && (name.includes('ios') || name.includes('musicflow'));
    }) || assets.find(a => a.name.toLowerCase().endsWith('.ipa'));

    const releaseNotes = parseReleaseNotes(targetRelease.body);

    const normalized = {
      latestVersion: cleanVersion,
      minimumVersion: MINIMUM_SUPPORTED_VERSION,
      tagName: tagName,
      title: targetRelease.name || `MusicFlow ${cleanVersion}`,
      message: (targetRelease.body && targetRelease.body.slice(0, 140).trim()) || 'New update with performance and discovery improvements.',
      releaseNotes: releaseNotes,
      releaseUrl: 'https://adi6499.github.io/MUSICFLOW/',
      publishedAt: targetRelease.published_at || new Date().toISOString(),
      android: {
        available: true,
        version: cleanVersion,
        downloadUrl: 'https://adi6499.github.io/MUSICFLOW/downloads/MusicFlow.apk',
        fileName: androidAsset ? androidAsset.name : `MusicFlow-Android-v${cleanVersion}.apk`,
        size: androidAsset ? androidAsset.size : 25188956
      },
      ios: {
        available: true,
        version: cleanVersion,
        downloadUrl: 'https://adi6499.github.io/MUSICFLOW/downloads/MusicFlow.ipa',
        fileName: iosAsset ? iosAsset.name : `MusicFlow-iOS-v${cleanVersion}.ipa`,
        size: iosAsset ? iosAsset.size : 5571930
      }
    };

    cachedReleaseData = normalized;
    cacheTimestamp = now;
    return normalized;
  } catch (err) {
    // If cache exists, return stale cache gracefully on network failure
    if (cachedReleaseData) {
      console.warn('[UpdateAPI] Using stale release cache due to error:', err.message);
      return cachedReleaseData;
    }
    throw err;
  }
}

// ----------------------------------------------------------------------------
// 5. VERCEL SERVERLESS HANDLER & REQUEST PROCESSOR
// ----------------------------------------------------------------------------
async function handleUpdateRequest(req, res) {
  // Set standard CORS & Cache Headers
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1800'
  };

  if (req.method === 'OPTIONS') {
    res.writeHead(204, headers);
    res.end();
    return;
  }

  if (req.method !== 'GET') {
    res.writeHead(405, headers);
    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    return;
  }

  // Parse query parameters
  const host = req.headers.host || 'localhost';
  const parsedUrl = new URL(req.url, `http://${host}`);
  const platform = (parsedUrl.searchParams.get('platform') || '').toLowerCase().trim(); // 'android' | 'ios' | 'web'
  const currentVersion = (parsedUrl.searchParams.get('version') || '1.0.0').trim();
  const forceRefresh = parsedUrl.searchParams.get('force') === 'true';

  try {
    const releaseData = await getLatestReleaseData(forceRefresh);

    const isOlderThanLatest = compareSemVer(releaseData.latestVersion, currentVersion) > 0;
    const isBelowMinimum = compareSemVer(releaseData.minimumVersion, currentVersion) > 0;

    let targetPlatform = platform;
    if (!targetPlatform || (targetPlatform !== 'android' && targetPlatform !== 'ios')) {
      const userAgent = (req.headers['user-agent'] || '').toLowerCase();
      if (userAgent.includes('android')) targetPlatform = 'android';
      else if (userAgent.includes('iphone') || userAgent.includes('ipad') || userAgent.includes('ios')) targetPlatform = 'ios';
      else targetPlatform = 'android'; // default fallback
    }

    const platformAsset = targetPlatform === 'ios' ? releaseData.ios : releaseData.android;
    const assetAvailable = !!(platformAsset && platformAsset.available);

    const responsePayload = {
      updateAvailable: isOlderThanLatest,
      updateRequired: isBelowMinimum,
      currentVersion: currentVersion,
      latestVersion: releaseData.latestVersion,
      versionCode: 27,
      minimumVersion: releaseData.minimumVersion,
      platform: targetPlatform,
      title: releaseData.title,
      message: releaseData.message,
      releaseNotes: releaseData.releaseNotes,
      releaseUrl: 'https://adi6499.github.io/MUSICFLOW/',
      publishedAt: releaseData.publishedAt,
      assetAvailable: assetAvailable,
      downloadUrl: targetPlatform === 'ios' ? 'https://adi6499.github.io/MUSICFLOW/downloads/MusicFlow.ipa' : 'https://adi6499.github.io/MUSICFLOW/downloads/MusicFlow.apk',
      apkUrl: 'https://adi6499.github.io/MUSICFLOW/downloads/MusicFlow.apk',
      fileName: platformAsset ? platformAsset.fileName : (targetPlatform === 'ios' ? 'MusicFlow.ipa' : 'MusicFlow.apk'),
      fileSize: platformAsset ? platformAsset.size : 34296622,
      mandatory: isBelowMinimum,
      android: releaseData.android || {
        available: true,
        version: '2.7.1',
        downloadUrl: 'https://adi6499.github.io/MUSICFLOW/downloads/MusicFlow.apk',
        fileName: 'MusicFlow.apk',
        size: 34296622
      },
      ios: releaseData.ios || {
        available: true,
        version: '2.7.1',
        downloadUrl: 'https://adi6499.github.io/MUSICFLOW/downloads/MusicFlow.ipa',
        fileName: 'MusicFlow.ipa',
        size: 3994324
      }
    };

    res.writeHead(200, headers);
    res.end(JSON.stringify(responsePayload, null, 2));
  } catch (err) {
    console.warn('[UpdateAPI] Release lookup fallback:', err.message);
    const targetPlatform = (platform === 'ios') ? 'ios' : 'android';
    const latestVer = '2.7.1';
    const isOlder = compareSemVer(latestVer, currentVersion) > 0;
    res.writeHead(200, headers);
    res.end(JSON.stringify({
      updateAvailable: isOlder,
      updateRequired: false,
      currentVersion: currentVersion,
      latestVersion: latestVer,
      versionCode: 28,
      minimumVersion: '1.0.0',
      platform: targetPlatform,
      title: `MusicFlow v${latestVer}`,
      message: 'MusicFlow is up to date',
      releaseNotes: [
        'Instant zero-lag search input responsiveness',
        'Clean Full Player top bar layout with enhanced centering',
        'YouTube Music single-song and playlist import',
        'Radio playback instant start and stream skip recovery',
        'Non-blocking startup and Stale-While-Revalidate caching',
        'Lock-screen media controls and background playback'
      ],
      releaseUrl: 'https://adi6499.github.io/MUSICFLOW/',
      downloadUrl: targetPlatform === 'ios'
        ? 'https://adi6499.github.io/MUSICFLOW/downloads/MusicFlow.ipa'
        : 'https://adi6499.github.io/MUSICFLOW/downloads/MusicFlow.apk',
      apkUrl: 'https://adi6499.github.io/MUSICFLOW/downloads/MusicFlow.apk',
      fileName: targetPlatform === 'ios' ? 'MusicFlow.ipa' : 'MusicFlow.apk',
      fileSize: targetPlatform === 'ios' ? 3994324 : 34296622,
      assetAvailable: true,
      mandatory: false,
      android: {
        available: true,
        version: latestVer,
        downloadUrl: 'https://adi6499.github.io/MUSICFLOW/downloads/MusicFlow.apk',
        fileName: 'MusicFlow.apk',
        size: 34296622
      },
      ios: {
        available: true,
        version: latestVer,
        downloadUrl: 'https://adi6499.github.io/MUSICFLOW/downloads/MusicFlow.ipa',
        fileName: 'MusicFlow.ipa',
        size: 3994324
      }
    }, null, 2));
  }
}

// Export for Vercel Serverless Function and Node server module
module.exports = handleUpdateRequest;
module.exports.handleUpdateRequest = handleUpdateRequest;
module.exports.compareSemVer = compareSemVer;
module.exports.parseSemVer = parseSemVer;
module.exports.parseReleaseNotes = parseReleaseNotes;
module.exports.getLatestReleaseData = getLatestReleaseData;
module.exports.setCachedReleaseData = (data) => {
  cachedReleaseData = data;
  cacheTimestamp = Date.now();
};
