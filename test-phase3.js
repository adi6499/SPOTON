// ========================================
// MusicFlow — Phase 3 Automated Validation Test Suite
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
console.log('🧪 Starting Phase 3 Test Suite (MusicFlow)');
console.log('=============================================\n');

// --- Test 1: File Existence ---
console.log('📁 1. Validating Required Files:');
const requiredFiles = [
  'js/podcasts.js',
  'js/video-switcher.js',
  'js/settings.js',
  'js/smart-downloads.js',
  'js/radio-tuner.js',
  'js/samples.js',
  'js/playlist-sharing.js',
  'js/player.js',
  'js/storage.js',
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

// --- Test 2: HTML Layout & Phase 3 DOM Elements ---
console.log('\n📄 2. Validating index.html Phase 3 Elements:');
const htmlContent = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

assert(htmlContent.includes('data-page="page-podcasts"'), 'Contains Podcasts nav item in navigation');
assert(htmlContent.includes('id="page-podcasts"'), 'Contains #page-podcasts container');
assert(htmlContent.includes('id="page-podcast-show"'), 'Contains #page-podcast-show container');
assert(htmlContent.includes('id="btn-user-profile-header"'), 'Contains #btn-user-profile-header chip');
assert(htmlContent.includes('id="user-profile-modal"'), 'Contains #user-profile-modal');
assert(htmlContent.includes('id="select-font-size"'), 'Contains #select-font-size in settings');
assert(htmlContent.includes('id="select-layout-density"'), 'Contains #select-layout-density in settings');
assert(htmlContent.includes('id="toggle-autoplay"'), 'Contains #toggle-autoplay in settings');
assert(htmlContent.includes('id="select-library-sort"'), 'Contains #select-library-sort in settings');
assert(htmlContent.includes('id="toggle-show-podcasts"'), 'Contains #toggle-show-podcasts in settings');
assert(htmlContent.includes('js/podcasts.js'), 'Includes js/podcasts.js script');
assert(htmlContent.includes('js/video-switcher.js'), 'Includes js/video-switcher.js script');
assert(htmlContent.includes('js/settings.js'), 'Includes js/settings.js script');

// --- Test 3: CSS Styles & Themes ---
console.log('\n🎨 3. Validating CSS Styles & Themes:');
const cssContent = fs.readFileSync(path.join(__dirname, 'css/style.css'), 'utf8');

assert(cssContent.includes('.user-profile-header-btn'), 'Contains .user-profile-header-btn styles');
assert(cssContent.includes('.podcast-shows-grid'), 'Contains .podcast-shows-grid styles');
assert(cssContent.includes('.podcast-episode-card'), 'Contains .podcast-episode-card styles');
assert(cssContent.includes('.podcast-show-hero'), 'Contains .podcast-show-hero styles');
assert(cssContent.includes('.player-media-toggle-pill'), 'Contains .player-media-toggle-pill styles');
assert(cssContent.includes('.full-player-video-wrap'), 'Contains .full-player-video-wrap styles');
assert(cssContent.includes('.user-profile-modal-card'), 'Contains .user-profile-modal-card styles');
assert(cssContent.includes('.profile-stats-grid'), 'Contains .profile-stats-grid styles');
assert(cssContent.includes('body.theme-oled'), 'Contains AMOLED Pitch Black theme styles');
assert(cssContent.includes('body.density-compact'), 'Contains Compact layout density styles');

// --- Test 4: Service Worker Cache ---
console.log('\n⚙️ 4. Validating Service Worker Cache:');
const swContent = fs.readFileSync(path.join(__dirname, 'sw.js'), 'utf8');
const swMatch = swContent.match(/musicflow-v(\d+)/);
assert(swMatch && parseInt(swMatch[1], 10) >= 36, 'Cache version bumped to musicflow-v36 or higher');
assert(swContent.includes('./js/podcasts.js'), 'SW caches podcasts.js');
assert(swContent.includes('./js/video-switcher.js'), 'SW caches video-switcher.js');
assert(swContent.includes('./js/settings.js'), 'SW caches settings.js');

// --- Test 5: HTTP Server Response ---
console.log('\n🌐 5. Testing Dev Server HTTP Response:');
http.get('http://localhost:5500', (res) => {
  assert(res.statusCode === 200, `Dev server responds with HTTP ${res.statusCode}`);
  
  console.log('\n=============================================');
  console.log(`📊 Test Results: ${passedTests}/${totalTests} Passed`);
  console.log('=============================================\n');

  if (passedTests === totalTests) {
    console.log('🎉 ALL PHASE 3 TESTS PASSED! 🚀');
    process.exit(0);
  } else {
    console.error('❌ Some tests failed. Please review output above.');
    process.exit(1);
  }
}).on('error', (err) => {
  assert(false, `Dev server connection failed: ${err.message}`);
  process.exit(1);
});
