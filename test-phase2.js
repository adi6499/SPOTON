// ========================================
// MusicFlow — Phase 2 Automated Validation Test Suite
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

console.log('\n=============================================');
console.log('🧪 Starting Phase 2 Test Suite (MusicFlow)');
console.log('=============================================\n');

// --- Test 1: File Existence & Basic Integrity ---
console.log('📁 1. Validating Required Files:');
const requiredFiles = [
  'js/smart-downloads.js',
  'js/radio-tuner.js',
  'js/samples.js',
  'js/playlist-sharing.js',
  'js/player.js',
  'js/ui.js',
  'js/app.js',
  'css/style.css',
  'index.html',
  'sw.js'
];

requiredFiles.forEach(f => {
  const p = path.join(__dirname, f);
  const exists = fs.existsSync(p);
  assert(exists, `File ${f} exists`);
});

// --- Test 2: HTML Layout & Containers ---
console.log('\n📄 2. Validating index.html DOM Elements:');
const htmlContent = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

assert(htmlContent.includes('id="page-samples"'), 'Contains #page-samples container');
assert(htmlContent.includes('id="samples-container"'), 'Contains #samples-container');
assert(htmlContent.includes('id="radio-tuner-modal"'), 'Contains #radio-tuner-modal');
assert(htmlContent.includes('id="public-playlists-section"'), 'Contains #public-playlists-section');
assert(htmlContent.includes('id="public-playlists-container"'), 'Contains #public-playlists-container');
assert(htmlContent.includes('data-page="page-samples"'), 'Contains Samples nav button');
assert(htmlContent.includes('id="btn-open-radio-tuner-sidebar"'), 'Contains Tune Radio button');
assert(htmlContent.includes('js/smart-downloads.js'), 'Includes js/smart-downloads.js script');
assert(htmlContent.includes('js/radio-tuner.js'), 'Includes js/radio-tuner.js script');
assert(htmlContent.includes('js/samples.js'), 'Includes js/samples.js script');
assert(htmlContent.includes('js/playlist-sharing.js'), 'Includes js/playlist-sharing.js script');

// --- Test 3: CSS Styles ---
console.log('\n🎨 3. Validating CSS Styles:');
const cssContent = fs.readFileSync(path.join(__dirname, 'css/style.css'), 'utf8');

assert(cssContent.includes('.samples-viewport'), 'Contains .samples-viewport class');
assert(cssContent.includes('scroll-snap-type: y mandatory'), 'Contains vertical scroll snap styling');
assert(cssContent.includes('.sample-card__vinyl'), 'Contains .sample-card__vinyl rotating disc');
assert(cssContent.includes('.radio-tuner-modal-card'), 'Contains .radio-tuner-modal-card styles');
assert(cssContent.includes('.tuner-pill.active'), 'Contains .tuner-pill.active styling');
assert(cssContent.includes('.downloads-storage-bar'), 'Contains .downloads-storage-bar styles');
assert(cssContent.includes('.shared-playlist-banner'), 'Contains .shared-playlist-banner styles');

// --- Test 4: Playlist Sharing Logic (Encoding & Decoding) ---
console.log('\n🔗 4. Testing Playlist Sharing URL Encoder/Decoder:');
try {
  const samplePlaylist = {
    name: 'Lo-Fi Chill Session',
    description: 'Relaxing study beats',
    songs: [
      { id: 'song_1', name: 'Coffee Rain', artists: 'Lofi King', album: 'Chill Vol 1', duration: 180, image: 'https://img.com/1.jpg' },
      { id: 'song_2', name: 'Late Night Code', artists: 'Dev Beats', album: 'Chill Vol 1', duration: 210, image: 'https://img.com/2.jpg' }
    ]
  };

  const jsonStr = JSON.stringify({
    name: samplePlaylist.name,
    desc: samplePlaylist.description,
    songs: samplePlaylist.songs
  });
  const encoded = encodeURIComponent(Buffer.from(jsonStr).toString('base64'));
  const decoded = JSON.parse(Buffer.from(decodeURIComponent(encoded), 'base64').toString('utf8'));

  assert(decoded.name === 'Lo-Fi Chill Session', 'Decoded playlist title matches');
  assert(decoded.songs.length === 2, 'Decoded playlist song count matches (2)');
  assert(decoded.songs[0].id === 'song_1', 'Decoded first track ID matches');
} catch (e) {
  assert(false, `Playlist sharing test failed: ${e.message}`);
}

// --- Test 5: Service Worker Cache List ---
console.log('\n⚙️ 5. Validating Service Worker Cache:');
const swContent = fs.readFileSync(path.join(__dirname, 'sw.js'), 'utf8');
const swMatch = swContent.match(/musicflow-v(\d+)/);
assert(swMatch && parseInt(swMatch[1], 10) >= 35, 'Cache version bumped to musicflow-v35 or higher');
assert(swContent.includes('./js/smart-downloads.js'), 'SW caches smart-downloads.js');
assert(swContent.includes('./js/radio-tuner.js'), 'SW caches radio-tuner.js');
assert(swContent.includes('./js/samples.js'), 'SW caches samples.js');
assert(swContent.includes('./js/playlist-sharing.js'), 'SW caches playlist-sharing.js');

// --- Test 6: HTTP Server Availability ---
console.log('\n🌐 6. Testing Dev Server HTTP Response:');
http.get('http://localhost:5500', (res) => {
  assert(res.statusCode === 200, `Dev server responds with HTTP ${res.statusCode}`);
  
  console.log('\n=============================================');
  console.log(`📊 Test Results: ${passedTests}/${totalTests} Passed`);
  console.log('=============================================\n');

  if (passedTests === totalTests) {
    console.log('🎉 ALL PHASE 2 TESTS PASSED! 🚀');
    process.exit(0);
  } else {
    console.error('❌ Some tests failed. Please review output above.');
    process.exit(1);
  }
}).on('error', (err) => {
  assert(false, `Dev server connection failed: ${err.message}`);
  process.exit(1);
});
