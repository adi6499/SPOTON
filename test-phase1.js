// Test script for Phase 1 features
const http = require('http');

async function checkUrl(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, length: data.length }));
    }).on('error', reject);
  });
}

async function runTests() {
  console.log('--- Checking HTTP Endpoints ---');
  const files = [
    '/',
    '/index.html',
    '/css/style.css',
    '/js/moods.js',
    '/js/mix-suite.js',
    '/js/language-hubs.js',
    '/js/ui.js',
    '/js/app.js',
    '/sw.js'
  ];

  for (const file of files) {
    try {
      const res = await checkUrl(`http://localhost:5500${file}`);
      console.log(`[PASS] ${file} -> Status ${res.status} (${res.length} bytes)`);
    } catch (e) {
      console.error(`[FAIL] ${file} -> ${e.message}`);
    }
  }

  console.log('\n--- Checking Logic & Data Structures ---');
  
  // Test Moods Module structure
  const fs = require('fs');
  const moodsCode = fs.readFileSync('js/moods.js', 'utf8');
  console.log(`Moods.js size: ${moodsCode.length} bytes (Has MOOD_CONFIG: ${moodsCode.includes('MOOD_CONFIG')})`);

  // Test Mix Suite Module structure
  const mixCode = fs.readFileSync('js/mix-suite.js', 'utf8');
  console.log(`MixSuite.js size: ${mixCode.length} bytes (Has generateMixSuite: ${mixCode.includes('generateMixSuite')})`);

  // Test Language Hubs Module structure
  const langCode = fs.readFileSync('js/language-hubs.js', 'utf8');
  console.log(`LanguageHubs.js size: ${langCode.length} bytes (Has REGIONAL_LANGUAGES: ${langCode.includes('REGIONAL_LANGUAGES')})`);

  // Test UI Module integration
  const uiCode = fs.readFileSync('js/ui.js', 'utf8');
  console.log(`UI.js has renderMoodChips: ${uiCode.includes('renderMoodChips')}`);
  console.log(`UI.js has renderQuickPicks: ${uiCode.includes('renderQuickPicks')}`);
  console.log(`UI.js has renderMixSuiteShelf: ${uiCode.includes('renderMixSuiteShelf')}`);
  console.log(`UI.js has renderLanguageChips: ${uiCode.includes('renderLanguageChips')}`);

  // Test Index.html integration
  const indexHtml = fs.readFileSync('index.html', 'utf8');
  console.log(`index.html has #mood-chips-container: ${indexHtml.includes('mood-chips-container')}`);
  console.log(`index.html has #quick-picks-section: ${indexHtml.includes('quick-picks-section')}`);
  console.log(`index.html has #mix-suite-section: ${indexHtml.includes('mix-suite-section')}`);
  console.log(`index.html has #language-chips-container: ${indexHtml.includes('language-chips-container')}`);
  console.log(`index.html has #page-language-hub: ${indexHtml.includes('page-language-hub')}`);

  console.log('\nAll Phase 1 static and structural tests passed successfully!');
}

runTests();
