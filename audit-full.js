const fs = require('fs');

console.log('==========================================================');
console.log('🔍 MUSICFLOW PRODUCTION READINESS AUDIT');
console.log('==========================================================\n');

const issues = { critical: [], high: [], medium: [], low: [], info: [] };

// ============ 1. CHECK ALL JS FILES FOR SYNTAX ISSUES ============
console.log('📋 1. JavaScript Syntax Validation');
const jsFiles = fs.readdirSync('js').filter(f => f.endsWith('.js')).map(f => 'js/' + f);
jsFiles.forEach(f => {
  try {
    const code = fs.readFileSync(f, 'utf8');
    new Function(code); // Will throw SyntaxError if invalid
    console.log('  ✅ ' + f);
  } catch (e) {
    console.log('  ❌ ' + f + ': ' + e.message);
    issues.critical.push({ file: f, issue: 'Syntax error: ' + e.message });
  }
});

// ============ 2. CHECK UNDEFINED REFERENCES ============
console.log('\n📋 2. Cross-Module Reference Checks');
const html = fs.readFileSync('index.html', 'utf8');
const appCode = fs.readFileSync('js/app.js', 'utf8');

// Check all module references in app.js match existing files
const moduleRefs = ['Player', 'UI', 'Storage', 'API', 'Haptics', 'Ambience', 'Settings', 'Search', 
  'Samples', 'Podcasts', 'RadioTuner', 'SmartDownloads', 'PlaylistSharing', 'VideoSwitcher', 
  'Moods', 'MixSuite', 'LanguageHubs', 'Recommendations', 'Recap'];

moduleRefs.forEach(mod => {
  if (appCode.includes(mod + '.') || appCode.includes(mod + '(')) {
    // Check if guarded with typeof check
    const hasGuard = appCode.includes("typeof " + mod + " !== 'undefined'") || 
                     appCode.includes('typeof ' + mod + " !== 'undefined'");
    if (!hasGuard && mod !== 'Player' && mod !== 'UI' && mod !== 'Storage' && mod !== 'API') {
      // Check if included in HTML
      if (!html.includes(mod.toLowerCase() + '.js')) {
        issues.medium.push({ file: 'js/app.js', issue: mod + ' referenced without typeof guard' });
      }
    }
    console.log('  ✅ ' + mod + ' referenced and ' + (hasGuard ? 'guarded' : 'core module'));
  }
});

// ============ 3. STORAGE SAFETY ============
console.log('\n📋 3. Storage Safety');
const storageCode = fs.readFileSync('js/storage.js', 'utf8');
const storageLines = storageCode.split('\n');

// Check if set() handles QuotaExceededError
if (storageCode.includes('catch (e)') && storageCode.includes('localStorage.setItem')) {
  console.log('  ✅ localStorage writes wrapped in try-catch');
} else {
  issues.high.push({ file: 'js/storage.js', issue: 'localStorage writes not error-protected' });
  console.log('  ❌ localStorage writes need try-catch');
}

// Check for data size management
if (storageCode.includes('MAX_RECENT') || storageCode.includes('slice')) {
  console.log('  ✅ Data size limits enforced');
} else {
  issues.medium.push({ file: 'js/storage.js', issue: 'No data size limits' });
}

// ============ 4. API ERROR HANDLING ============
console.log('\n📋 4. API Error Handling');
const apiCode = fs.readFileSync('js/api.js', 'utf8');
const apiLines = apiCode.split('\n');

// Check fetch calls have error handling
let fetchCalls = 0;
let guardedFetch = 0;
apiLines.forEach((l, i) => {
  if (l.includes('fetch(') || l.includes('fetch (')) {
    fetchCalls++;
    // Check surrounding lines for try/catch
    let hasGuard = false;
    for (let j = Math.max(0, i - 15); j <= i; j++) {
      if (apiLines[j].includes('try')) hasGuard = true;
    }
    if (hasGuard) guardedFetch++;
    else {
      issues.medium.push({ file: 'js/api.js', issue: 'Unguarded fetch at line ' + (i + 1) });
    }
  }
});
console.log('  ' + (fetchCalls === guardedFetch ? '✅' : '⚠️') + ' ' + guardedFetch + '/' + fetchCalls + ' fetch calls error-protected');

// Check for request timeout
if (apiCode.includes('AbortController') || apiCode.includes('timeout')) {
  console.log('  ✅ Request timeout handling present');
} else {
  issues.medium.push({ file: 'js/api.js', issue: 'No request timeout/abort controller' });
  console.log('  ⚠️ No request timeout handling');
}

// ============ 5. PLAYER ENGINE SAFETY ============
console.log('\n📋 5. Player Engine Safety');
const playerCode = fs.readFileSync('js/player.js', 'utf8');

const playerChecks = [
  ['Race condition guard (_loadId)', playerCode.includes('_loadId')],
  ['iOS detection bypass', playerCode.includes('isIOS')],
  ['MediaSession handlers', playerCode.includes('setActionHandler')],
  ['Audio error recovery', /auto-skip/i.test(playerCode)],
  ['Crossfade cleanup (clearInterval)', playerCode.includes('clearInterval(activeCrossfadeTimer)')],
  ['Volume persistence', playerCode.includes('volume') && playerCode.includes('Storage')],
  ['Session persistence', playerCode.includes('persistSession')],
  ['Background keepalive', playerCode.includes('visibilitychange')],
];
playerChecks.forEach(([name, ok]) => {
  console.log('  ' + (ok ? '✅' : '❌') + ' ' + name);
  if (!ok) issues.high.push({ file: 'js/player.js', issue: 'Missing: ' + name });
});

// ============ 6. CSS ISSUES ============
console.log('\n📋 6. CSS Integrity');
const css = fs.readFileSync('css/style.css', 'utf8');

// Brace balance
let braces = 0;
css.split('\n').forEach((l, i) => {
  for (const ch of l) { if (ch === '{') braces++; if (ch === '}') braces--; }
  if (braces < 0) {
    issues.critical.push({ file: 'css/style.css', issue: 'Unmatched } at line ' + (i + 1) });
  }
});
console.log('  ' + (braces === 0 ? '✅' : '❌') + ' Brace balance: ' + braces);

// Check for vendor prefix issues
const vendorPrefixes = ['-webkit-', '-moz-', '-ms-'];
vendorPrefixes.forEach(prefix => {
  const count = (css.match(new RegExp(prefix.replace('-', '\\-'), 'g')) || []).length;
  console.log('  ℹ️ ' + prefix + ' used ' + count + ' times');
});

// Check for overscroll behavior (important for iOS)
if (css.includes('overscroll-behavior')) {
  console.log('  ✅ Overscroll behavior set');
} else {
  issues.low.push({ file: 'css/style.css', issue: 'No overscroll-behavior (may cause iOS rubber-banding)' });
  console.log('  ⚠️ No overscroll-behavior (iOS rubber-banding)');
}

// ============ 7. HTML STRUCTURE ============
console.log('\n📋 7. HTML Structure');

// Meta tags
const hasMeta = {
  viewport: html.includes('viewport'),
  charset: html.includes('charset'),
  themeColor: html.includes('theme-color'),
  description: html.includes('meta name="description"'),
  ogTitle: html.includes('og:title'),
  manifest: html.includes('manifest'),
  appleMobileCapable: html.includes('apple-mobile-web-app-capable'),
};
Object.entries(hasMeta).forEach(([name, ok]) => {
  console.log('  ' + (ok ? '✅' : '⚠️') + ' ' + name);
  if (!ok) issues.low.push({ file: 'index.html', issue: 'Missing meta: ' + name });
});

// ============ 8. SERVICE WORKER ============
console.log('\n📋 8. Service Worker');
const sw = fs.readFileSync('sw.js', 'utf8');

// Check for stale cache cleanup
if (sw.includes('delete') || sw.includes('caches.keys')) {
  console.log('  ✅ Old cache cleanup on activate');
} else {
  issues.medium.push({ file: 'sw.js', issue: 'No old cache cleanup on activate event' });
  console.log('  ❌ No old cache cleanup');
}

// Check network-first or cache-first strategy
if (sw.includes('networkFirst') || (sw.includes('fetch') && sw.includes('cache'))) {
  console.log('  ✅ Fetch strategy defined');
}

// Check if all SW cached assets actually exist
const assetMatch = sw.match(/ASSETS\s*=\s*\[([\s\S]*?)\]/);
if (assetMatch) {
  const assets = [];
  const assetRe = /'([^']+)'/g;
  let am;
  while ((am = assetRe.exec(assetMatch[1])) !== null) assets.push(am[1]);
  let missingCount = 0;
  assets.forEach(a => {
    const p = a.replace('./', '');
    if (p && !fs.existsSync(p)) {
      missingCount++;
      issues.high.push({ file: 'sw.js', issue: 'Cached asset missing: ' + a });
      console.log('  ❌ Missing asset: ' + a);
    }
  });
  if (missingCount === 0) console.log('  ✅ All ' + assets.length + ' cached assets exist');
}

// ============ 9. GLOBAL ERROR HANDLING ============
console.log('\n📋 9. Global Error Handling');

if (appCode.includes('window.onerror') || appCode.includes("addEventListener('error'")) {
  console.log('  ✅ Global error handler');
} else {
  issues.high.push({ file: 'js/app.js', issue: 'No window.onerror or global error handler' });
  console.log('  ❌ No global error handler');
}

if (appCode.includes('unhandledrejection')) {
  console.log('  ✅ Unhandled promise rejection handler');
} else {
  issues.high.push({ file: 'js/app.js', issue: 'No unhandledrejection handler' });
  console.log('  ❌ No unhandledrejection handler');
}

// ============ 10. PERFORMANCE CONCERNS ============
console.log('\n📋 10. Performance');
const totalCSS = css.length;
const totalJS = jsFiles.reduce((sum, f) => sum + fs.statSync(f).size, 0);
const totalHTML = html.length;
console.log('  ℹ️ Total CSS: ' + (totalCSS / 1024).toFixed(1) + ' KB');
console.log('  ℹ️ Total JS: ' + (totalJS / 1024).toFixed(1) + ' KB');
console.log('  ℹ️ Total HTML: ' + (totalHTML / 1024).toFixed(1) + ' KB');
console.log('  ℹ️ Grand Total: ' + ((totalCSS + totalJS + totalHTML) / 1024).toFixed(1) + ' KB');

if (totalCSS > 400 * 1024) {
  issues.info.push({ file: 'css/style.css', issue: 'CSS file is very large (' + (totalCSS/1024).toFixed(0) + 'KB). Consider splitting.' });
}

// ============ SUMMARY ============
console.log('\n==========================================================');
console.log('📊 AUDIT SUMMARY');
console.log('==========================================================');
console.log('🔴 Critical: ' + issues.critical.length);
issues.critical.forEach(i => console.log('   ' + i.file + ': ' + i.issue));
console.log('🟠 High: ' + issues.high.length);
issues.high.forEach(i => console.log('   ' + i.file + ': ' + i.issue));
console.log('🟡 Medium: ' + issues.medium.length);
issues.medium.forEach(i => console.log('   ' + i.file + ': ' + i.issue));
console.log('🔵 Low: ' + issues.low.length);
issues.low.forEach(i => console.log('   ' + i.file + ': ' + i.issue));
console.log('ℹ️ Info: ' + issues.info.length);
issues.info.forEach(i => console.log('   ' + i.file + ': ' + i.issue));
console.log('\n==========================================================');

if (issues.critical.length === 0 && issues.high.length <= 3) {
  console.log('✅ PRODUCTION READY (with recommended fixes)');
} else if (issues.critical.length > 0) {
  console.log('❌ NOT PRODUCTION READY - Critical issues found');
} else {
  console.log('⚠️ PRODUCTION READY WITH CAVEATS');
}
console.log('==========================================================\n');
