const fs = require('fs');

// Mock DOM
function createMockElement() {
  return {
    addEventListener: () => {},
    innerHTML: '',
    appendChild: () => {},
    click: () => {},
    querySelector: () => createMockElement(),
    querySelectorAll: () => [createMockElement()]
  };
}

global.document = {
  getElementById: (id) => createMockElement(),
  createElement: () => createMockElement(),
  querySelector: () => createMockElement(),
  querySelectorAll: () => [createMockElement()]
};
global.window = {
  location: { href: 'http://localhost' }
};
global.navigator = {};

// Mock Storage
global.Storage = {
  getListeningHistory: () => [
    { id: '1', name: 'Song 1', artists: 'A, B', duration: 180, playedAt: 1000 },
    { id: '2', name: 'Song 2', artists: 'A', duration: 200, playedAt: 2000 },
    { id: '3', name: 'Song 3', artists: 'C', duration: 210, playedAt: 3000 },
    { id: '4', name: 'Song 1', artists: 'A, B', duration: 180, playedAt: 4000 },
    { id: '5', name: 'Song 5', artists: 'B', duration: 150, playedAt: 5000 },
    { id: '6', name: 'Song 6', artists: 'D', duration: 100, playedAt: 6000 }
  ],
  getStats: () => ({ totalSongsPlayed: 6 })
};

// Load recap.js
const code = fs.readFileSync('./js/recap.js', 'utf8');
eval(code);

try {
  const container = global.document.getElementById('recap-container');
  Recap.renderRecap(container);
  console.log('TEST PASSED: Recap generated successfully!');
} catch (e) {
  console.error('TEST FAILED:', e);
  process.exit(1);
}
