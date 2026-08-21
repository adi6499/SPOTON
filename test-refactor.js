// ========================================
// MusicFlow — Comprehensive Refactor & UX Validation Suite
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
console.log('🧪 Starting MusicFlow Codebase Refactor Test Suite');
console.log('======================================================\n');

// 1. Validating Required Files
console.log('📁 1. Validating Core Files:');
const requiredFiles = [
  'js/api.js',
  'js/storage.js',
  'js/player.js',
  'js/ui.js',
  'js/recommendations.js',
  'js/smart-downloads.js',
  'js/moods.js',
  'js/mix-suite.js',
  'js/language-hubs.js',
  'js/podcasts.js',
  'js/radio-tuner.js',
  'js/samples.js',
  'js/playlist-sharing.js',
  'js/video-switcher.js',
  'js/settings.js',
  'js/app.js',
  'css/style.css',
  'index.html',
  'sw.js'
];

requiredFiles.forEach(f => {
  const p = path.join(__dirname, f);
  assert(fs.existsSync(p), `File ${f} exists`);
});

// 2. Testing HTML Structure & 5-Item Bottom Navigation
console.log('\n📱 2. Validating 5-Item Bottom Navigation & Header:');
const htmlContent = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

assert(htmlContent.includes('class="bottom-nav"'), 'Contains .bottom-nav container');
assert(htmlContent.includes('data-page="page-home"'), 'Bottom nav contains Home item');
assert(htmlContent.includes('data-page="page-favorites"'), 'Bottom nav contains Library item');
assert(htmlContent.includes('data-page="page-podcasts"'), 'Bottom nav contains Podcasts item');
assert(htmlContent.includes('data-page="page-samples"'), 'Bottom nav contains Samples item');
assert(htmlContent.includes('data-action="open-settings"'), 'Bottom nav contains Settings trigger');
assert(htmlContent.includes('id="btn-user-profile-header"'), 'Header contains user profile chip');
assert(htmlContent.includes('id="full-player-user-chip"'), 'Full player contains Now Playing user chip');
assert(htmlContent.includes('id="player-media-toggle"'), 'Full player contains Audio/Video switcher');

// 3. Testing Tabbed Settings Modal
console.log('\n⚙️ 3. Validating Tabbed Settings Modal Structure:');
assert(htmlContent.includes('class="modal tabbed-settings-modal"'), 'Settings modal has tabbed layout class');
assert(htmlContent.includes('class="settings-nav-tabs"'), 'Settings modal has tabs header');
assert(htmlContent.includes('data-tab="tab-appearance"'), 'Contains Appearance tab');
assert(htmlContent.includes('data-tab="tab-playback"'), 'Contains Playback tab');
assert(htmlContent.includes('data-tab="tab-profile"'), 'Contains Profile tab');
assert(htmlContent.includes('data-tab="tab-library"'), 'Contains Library tab');
assert(htmlContent.includes('id="tab-appearance"'), 'Contains Appearance tab panel');
assert(htmlContent.includes('id="tab-playback"'), 'Contains Playback tab panel');
assert(htmlContent.includes('id="tab-profile"'), 'Contains Profile tab panel');
assert(htmlContent.includes('id="tab-library"'), 'Contains Library tab panel');

// 4. Testing CSS Styles
console.log('\n🎨 4. Validating CSS Styles, Skeletons & Animations:');
const cssContent = fs.readFileSync(path.join(__dirname, 'css/style.css'), 'utf8');

assert(cssContent.includes('.tabbed-settings-modal'), 'CSS contains .tabbed-settings-modal');
assert(cssContent.includes('.settings-nav-tabs'), 'CSS contains .settings-nav-tabs');
assert(cssContent.includes('.settings-tab-btn'), 'CSS contains .settings-tab-btn');
assert(cssContent.includes('.settings-tab-panel'), 'CSS contains .settings-tab-panel');
assert(cssContent.includes('.player-media-toggle-pill'), 'CSS contains .player-media-toggle-pill');
assert(cssContent.includes('.media-toggle-btn'), 'CSS contains .media-toggle-btn');
assert(cssContent.includes('body.theme-oled'), 'CSS contains AMOLED theme');
assert(cssContent.includes('.skeleton-card'), 'CSS contains skeleton card loading styles');
assert(cssContent.includes('.is-active-track'), 'CSS contains active playing track highlight');
assert(cssContent.includes('.home-greeting-user'), 'CSS contains personalized home greeting styles');

// 5. Testing Player & Settings Engine Logic
console.log('\n🎵 5. Validating Player Engine, Normalization & Settings:');
const playerCode = fs.readFileSync(path.join(__dirname, 'js/player.js'), 'utf8');
const settingsCode = fs.readFileSync(path.join(__dirname, 'js/settings.js'), 'utf8');
const uiCode = fs.readFileSync(path.join(__dirname, 'js/ui.js'), 'utf8');
const moodsCode = fs.readFileSync(path.join(__dirname, 'js/moods.js'), 'utf8');
const appCode = fs.readFileSync(path.join(__dirname, 'js/app.js'), 'utf8');

assert(playerCode.includes('API.normalizeSong'), 'Player automatically normalizes tracks in setQueue and playSong');
assert(playerCode.includes('Track "${song.name}" unavailable. Auto-skipping...'), 'Player auto-skips missing stream tracks with toast');
assert(playerCode.includes('Track "${trackTitle}" unavailable. Auto-skipping...'), 'Audio error listener auto-skips broken tracks');
assert(uiCode.includes('startQuickPick:'), 'UI module exports normalized startQuickPick');
assert(moodsCode.includes('applyMoodFilter:'), 'Moods module exports applyMoodFilter');
assert(appCode.includes('home-greeting-user'), 'App displays personalized username greeting on home feed');
assert(settingsCode.includes('setupTabSwitcher'), 'Settings engine implements tab switching');
assert(settingsCode.includes('applyTheme'), 'Settings engine implements theme preview');
assert(settingsCode.includes('applyAccentColor'), 'Settings engine implements accent color preview');
assert(settingsCode.includes('renderProfileHeader'), 'Settings engine updates header & now playing profile');

// 6. Validating Service Worker Cache
console.log('\n⚡ 6. Validating Service Worker:');
const swCode = fs.readFileSync(path.join(__dirname, 'sw.js'), 'utf8');
const swMatch = swCode.match(/musicflow-v(\d+)/);
assert(swMatch && parseInt(swMatch[1], 10) >= 37, 'Service Worker cache bumped to musicflow-v37 or higher');

// 7. Testing Local Server HTTP 200
console.log('\n🌐 7. Testing Local Server Connectivity:');
http.get('http://localhost:5500', (res) => {
  assert(res.statusCode === 200, `Dev server responds with HTTP ${res.statusCode}`);

  console.log('\n======================================================');
  console.log(`📊 Test Results: ${passedTests}/${totalTests} Passed`);
  console.log('======================================================\n');

  if (passedTests === totalTests) {
    console.log('🎉 ALL COMPREHENSIVE REFACTOR & UX TESTS PASSED! 🚀\n');
    process.exit(0);
  } else {
    console.error('❌ Some tests failed.');
    process.exit(1);
  }
}).on('error', (err) => {
  assert(false, `Dev server connection failed: ${err.message}`);
  process.exit(1);
});
