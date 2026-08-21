const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('\n======================================================');
console.log('🧪 Starting Apple Music Haptics Engine Test Suite');
console.log('======================================================\n');

let passedTests = 0;
let totalTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}`);
  }
}

// Mock browser environment for Haptics testing
let lastVibratePattern = null;
let vibrateCallCount = 0;

global.navigator = {
  vibrate: (pattern) => {
    lastVibratePattern = pattern;
    vibrateCallCount++;
    return true;
  }
};

global.document = {
  addEventListener: () => {},
  readyState: 'complete'
};

let mockSettings = { hapticsEnabled: true };
global.Storage = {
  getSettings: () => mockSettings,
  updateSettings: (s) => { Object.assign(mockSettings, s); }
};

const Haptics = require('./js/haptics.js');

console.log('📁 1. Validating Haptics Module Structure:');
test('Haptics object is exported', () => {
  assert.ok(Haptics, 'Haptics should be defined');
  assert.strictEqual(typeof Haptics, 'object');
});

test('Haptics exports all required Apple Music methods', () => {
  assert.strictEqual(typeof Haptics.isSupported, 'function');
  assert.strictEqual(typeof Haptics.isEnabled, 'function');
  assert.strictEqual(typeof Haptics.light, 'function');
  assert.strictEqual(typeof Haptics.selection, 'function');
  assert.strictEqual(typeof Haptics.medium, 'function');
  assert.strictEqual(typeof Haptics.heavy, 'function');
  assert.strictEqual(typeof Haptics.like, 'function');
  assert.strictEqual(typeof Haptics.success, 'function');
  assert.strictEqual(typeof Haptics.error, 'function');
  assert.strictEqual(typeof Haptics.scrubTick, 'function');
});

console.log('\n📳 2. Validating Vibration Patterns & Apple Presets:');
test('Haptics.light triggers 10ms crisp tap', () => {
  lastVibratePattern = null;
  const res = Haptics.light();
  assert.strictEqual(res, true);
  assert.strictEqual(lastVibratePattern, 10);
});

test('Haptics.selection triggers 8ms micro-tick', () => {
  lastVibratePattern = null;
  const res = Haptics.selection();
  assert.strictEqual(res, true);
  assert.strictEqual(lastVibratePattern, 8);
});

test('Haptics.medium triggers 24ms impact', () => {
  lastVibratePattern = null;
  const res = Haptics.medium();
  assert.strictEqual(res, true);
  assert.strictEqual(lastVibratePattern, 24);
});

test('Haptics.heavy triggers 38ms impact', () => {
  lastVibratePattern = null;
  const res = Haptics.heavy();
  assert.strictEqual(res, true);
  assert.strictEqual(lastVibratePattern, 38);
});

test('Haptics.like triggers Apple Music heart dual-pulse', () => {
  lastVibratePattern = null;
  const res = Haptics.like();
  assert.strictEqual(res, true);
  assert.deepStrictEqual(lastVibratePattern, [15, 45, 25]);
});

test('Haptics.scrubTick emits ticks on 5% progress boundaries', () => {
  lastVibratePattern = null;
  Haptics.scrubTick(22); // rounds to 20%
  assert.strictEqual(lastVibratePattern, 8);
});

console.log('\n⚙️ 3. Validating User Setting Suppression:');
test('Haptics respects disabled settings toggle', () => {
  mockSettings.hapticsEnabled = false;
  lastVibratePattern = null;
  const res = Haptics.light();
  assert.strictEqual(res, false);
  assert.strictEqual(lastVibratePattern, null);
  mockSettings.hapticsEnabled = true;
});

test('Haptics.toggle toggles state and updates settings', () => {
  mockSettings.hapticsEnabled = true;
  const newState = Haptics.toggle();
  assert.strictEqual(newState, false);
  assert.strictEqual(mockSettings.hapticsEnabled, false);
  const backState = Haptics.toggle();
  assert.strictEqual(backState, true);
  assert.strictEqual(mockSettings.hapticsEnabled, true);
});

console.log('\n📄 4. Validating HTML, Service Worker & Script Inclusions:');
test('index.html includes js/haptics.js script', () => {
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  assert.ok(html.includes('src="js/haptics.js"'), 'index.html must include js/haptics.js');
});

test('index.html contains toggle-haptics switch in settings', () => {
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  assert.ok(html.includes('id="toggle-haptics"'), 'index.html must have #toggle-haptics switch');
});

test('index.html contains btn-player-haptics in Now Playing full player', () => {
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  assert.ok(html.includes('id="btn-player-haptics"'), 'index.html must have #btn-player-haptics badge');
});

test('Service Worker caches ./js/haptics.js with bumped version', () => {
  const sw = fs.readFileSync(path.join(__dirname, 'sw.js'), 'utf8');
  assert.ok(sw.includes("'./js/haptics.js'"), 'sw.js must cache ./js/haptics.js');
  const swMatch = sw.match(/musicflow-v(\d+)/);
  assert.ok(swMatch && parseInt(swMatch[1], 10) >= 39, 'sw.js must have cache version v39 or higher');
});

console.log('\n======================================================');
console.log(`📊 Test Results: ${passedTests}/${totalTests} Passed`);
console.log('======================================================\n');

if (passedTests === totalTests) {
  console.log('🎉 ALL APPLE MUSIC HAPTICS TESTS PASSED! 🚀\n');
  process.exit(0);
} else {
  console.error('❌ SOME TESTS FAILED!\n');
  process.exit(1);
}
