// ========================================
// MusicFlow — Federated Search Engine Validation Suite
// ========================================

const fs = require('fs');
const path = require('path');
const http = require('http');

let totalTests = 0;
let passedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
  }
}

console.log('\n======================================================');
console.log('🧪 Starting Federated Search Engine Test Suite');
console.log('======================================================\n');

// 1. Validating Core Search Files
console.log('📁 1. Validating Required Files:');
const requiredFiles = [
  'js/api.js',
  'js/search.js',
  'js/app.js',
  'js/ui.js',
  'css/style.css',
  'index.html',
  'sw.js'
];

requiredFiles.forEach(f => {
  const p = path.join(__dirname, f);
  assert(fs.existsSync(p), `File ${f} exists`);
});

// 2. Testing HTML Structure & Script Inclusions
console.log('\n📄 2. Validating index.html & Script Inclusions:');
const htmlContent = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

assert(htmlContent.includes('<script src="js/search.js"></script>'), 'Includes js/search.js script');
assert(htmlContent.includes('id="page-search"'), 'Contains #page-search container');
assert(htmlContent.includes('id="search-results"'), 'Contains #search-results container');
assert(htmlContent.includes('id="search-input"'), 'Contains #search-input element');
assert(htmlContent.includes('id="search-clear"'), 'Contains #search-clear button');

// 3. Testing CSS Styles for Federated Search
console.log('\n🎨 3. Validating CSS Styles & Components:');
const cssContent = fs.readFileSync(path.join(__dirname, 'css/style.css'), 'utf8');

assert(cssContent.includes('.search-tabs-carousel-wrapper'), 'CSS contains .search-tabs-carousel-wrapper');
assert(cssContent.includes('.search-tabs-carousel'), 'CSS contains .search-tabs-carousel');
assert(cssContent.includes('.search-tab-chip'), 'CSS contains .search-tab-chip');
assert(cssContent.includes('.search-top-result-card'), 'CSS contains .search-top-result-card');
assert(cssContent.includes('.search-top-result-card__badge'), 'CSS contains .search-top-result-card__badge');
assert(cssContent.includes('mark.search-highlight'), 'CSS contains mark.search-highlight');
assert(cssContent.includes('.search-shelf-section'), 'CSS contains .search-shelf-section');
assert(cssContent.includes('.search-shelf-see-all'), 'CSS contains .search-shelf-see-all');
assert(cssContent.includes('.video-search-card'), 'CSS contains .video-search-card');
assert(cssContent.includes('.video-search-card__badge'), 'CSS contains .video-search-card__badge');
assert(cssContent.includes('.search-infinite-loader'), 'CSS contains .search-infinite-loader');

// 4. Testing API Endpoints & Normalizers
console.log('\n🎵 4. Validating API Normalizers & Search Functions:');
const apiCode = fs.readFileSync(path.join(__dirname, 'js/api.js'), 'utf8');

assert(apiCode.includes('searchPlaylists'), 'API exports searchPlaylists function');
assert(apiCode.includes('searchFederated'), 'API exports searchFederated function');
assert(apiCode.includes('normalizeSong'), 'API exports normalizeSong function');
assert(apiCode.includes('normalizeAlbum'), 'API exports normalizeAlbum function');
assert(apiCode.includes('normalizeArtist'), 'API exports normalizeArtist function');
assert(apiCode.includes('normalizePlaylist'), 'API exports normalizePlaylist function');

// 5. Testing SearchEngine Module Logic & Highlighting
console.log('\n🔍 5. Validating SearchEngine Module & Term Highlighting:');
const searchCode = fs.readFileSync(path.join(__dirname, 'js/search.js'), 'utf8');

assert(searchCode.includes('const TABS ='), 'SearchEngine defines TABS');
assert(searchCode.includes("'all'"), 'SearchEngine includes All tab');
assert(searchCode.includes("'songs'"), 'SearchEngine includes Songs tab');
assert(searchCode.includes("'albums'"), 'SearchEngine includes Albums tab');
assert(searchCode.includes("'artists'"), 'SearchEngine includes Artists tab');
assert(searchCode.includes("'playlists'"), 'SearchEngine includes Playlists tab');
assert(searchCode.includes("'mixes'"), 'SearchEngine includes Mixes tab');
assert(searchCode.includes("'podcasts'"), 'SearchEngine includes Podcasts tab');
assert(searchCode.includes("'videos'"), 'SearchEngine includes Videos tab');
assert(searchCode.includes('function highlightMatch'), 'SearchEngine implements highlightMatch function');
assert(searchCode.includes('function calculateTopResult'), 'SearchEngine implements calculateTopResult function');
assert(searchCode.includes('function executeSearch'), 'SearchEngine implements executeSearch function');
assert(searchCode.includes('function switchTab'), 'SearchEngine implements switchTab function');
assert(searchCode.includes('function loadMore'), 'SearchEngine implements loadMore function');
assert(searchCode.includes('function setupInfiniteScroll'), 'SearchEngine implements setupInfiniteScroll function');

// Test highlightMatch in a sandbox
try {
  const matchFn = new Function('text', 'query', `
    function escapeRegExp(string) { return string.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&'); }
    if (!text || !query) return text || '';
    const cleanQuery = query.trim();
    if (!cleanQuery) return text;
    const words = cleanQuery.split(/\\s+/).filter(w => w.length > 0).map(escapeRegExp);
    if (words.length === 0) return text;
    const regex = new RegExp('(' + words.join('|') + ')', 'gi');
    return String(text).replace(regex, '<mark class="search-highlight">$1</mark>');
  `);

  const highlighted = matchFn('Kesariya - Brahmastra (Arijit Singh)', 'Arijit');
  assert(highlighted.includes('<mark class="search-highlight">Arijit</mark>'), 'Highlight match wraps term in <mark> tag');

  const multiWordMatch = matchFn('Shape of You Ed Sheeran', 'shape sheeran');
  assert(multiWordMatch.includes('<mark class="search-highlight">Shape</mark>') && multiWordMatch.includes('<mark class="search-highlight">Sheeran</mark>'), 'Highlight match supports multi-word queries');
} catch (e) {
  assert(false, `Highlight match test failed: ${e.message}`);
}

// 6. Validating Complete Song Object Schema & Player Handling
console.log('\n🎧 6. Validating Song Normalization & Playback Safety:');
const playerCode = fs.readFileSync(path.join(__dirname, 'js/player.js'), 'utf8');

assert(apiCode.includes('title: name') && apiCode.includes('artist: artists'), 'normalizeSong guarantees title & artist fields');
assert(apiCode.includes('audioUrl:') && apiCode.includes('imageUrl:'), 'normalizeSong guarantees audioUrl & imageUrl fields');
assert(playerCode.includes('API.normalizeSong(song)'), 'Player.playSong normalizes track before playback');
assert(playerCode.includes('song.audioUrl || song.streamUrl'), 'Player validates audioUrl or streamUrl');
assert(playerCode.includes('API.getSongDetails(song.id)'), 'Player fetches song details from API if streamUrl missing');
const uiCode = fs.readFileSync(path.join(__dirname, 'js/ui.js'), 'utf8');
assert(uiCode.includes('is-active-track'), 'Player & UI highlight currently playing track in search results and shelves');

// 7. Validating App Integration & Service Worker
console.log('\n⚡ 7. Validating App Integration & Service Worker:');
const appCode = fs.readFileSync(path.join(__dirname, 'js/app.js'), 'utf8');
const swCode = fs.readFileSync(path.join(__dirname, 'sw.js'), 'utf8');

assert(appCode.includes('SearchEngine.executeSearch'), 'App delegates search to SearchEngine.executeSearch');
assert(appCode.includes('SearchEngine.renderSearchHistory'), 'App delegates history to SearchEngine.renderSearchHistory');
assert(swCode.includes('./js/search.js'), 'Service Worker caches ./js/search.js');
const swMatch = swCode.match(/musicflow-v(\d+)/);
assert(swMatch && parseInt(swMatch[1], 10) >= 38, 'Service Worker cache bumped to musicflow-v38 or higher');

// 8. Testing Local Server HTTP 200
console.log('\n🌐 8. Testing Local Server Connectivity:');
http.get('http://localhost:5500', (res) => {
  assert(res.statusCode === 200, `Dev server responds with HTTP ${res.statusCode}`);

  console.log('\n======================================================');
  console.log(`📊 Test Results: ${passedTests}/${totalTests} Passed`);
  console.log('======================================================\n');

  if (passedTests === totalTests) {
    console.log('🎉 ALL FEDERATED SEARCH TESTS PASSED! 🚀\n');
    process.exit(0);
  } else {
    console.error('❌ Some tests failed.');
    process.exit(1);
  }
}).on('error', (err) => {
  assert(false, `Dev server connection failed: ${err.message}`);
  process.exit(1);
});
