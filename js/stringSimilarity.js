// ==========================================================================
// MUSICFLOW — STRING SIMILARITY & TYPO TOLERANCE ENGINE
// ==========================================================================

const StringSimilarity = (() => {

  function damerauLevenshteinDistance(s1, s2) {
    const len1 = s1.length;
    const len2 = s2.length;
    if (len1 === 0) return len2;
    if (len2 === 0) return len1;

    const d = Array.from({ length: len1 + 1 }, () => new Int32Array(len2 + 1));

    for (let i = 0; i <= len1; i++) d[i][0] = i;
    for (let j = 0; j <= len2; j++) d[0][j] = j;

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        d[i][j] = Math.min(
          d[i - 1][j] + 1,
          d[i][j - 1] + 1,
          d[i - 1][j - 1] + cost
        );
        if (i > 1 && j > 1 && s1[i - 1] === s2[j - 2] && s1[i - 2] === s2[j - 1]) {
          d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + cost);
        }
      }
    }

    return d[len1][len2];
  }

  function normalizedLevenshtein(s1, s2) {
    if (s1 === s2) return 1.0;
    const maxLen = Math.max(s1.length, s2.length);
    if (maxLen === 0) return 1.0;
    const dist = damerauLevenshteinDistance(s1, s2);
    return Math.max(0, Math.min(1, 1.0 - (dist / maxLen)));
  }

  function jaroWinklerSimilarity(s1, s2) {
    if (s1 === s2) return 1.0;
    if (!s1 || !s2) return 0.0;

    const matchDistance = Math.floor(Math.max(s1.length, s2.length) / 2) - 1;
    const s1Matches = new Array(s1.length).fill(false);
    const s2Matches = new Array(s2.length).fill(false);

    let matches = 0;
    for (let i = 0; i < s1.length; i++) {
      const start = Math.max(0, i - matchDistance);
      const end = Math.min(i + matchDistance + 1, s2.length);
      for (let j = start; j < end; j++) {
        if (s2Matches[j] || s1[i] !== s2[j]) continue;
        s1Matches[i] = true;
        s2Matches[j] = true;
        matches++;
        break;
      }
    }

    if (matches === 0) return 0.0;

    let transpositions = 0;
    let k = 0;
    for (let i = 0; i < s1.length; i++) {
      if (!s1Matches[i]) continue;
      while (!s2Matches[k]) k++;
      if (s1[i] !== s2[k]) transpositions++;
      k++;
    }
    const t = transpositions / 2.0;

    const jaro = ((matches / s1.length) + (matches / s2.length) + ((matches - t) / matches)) / 3.0;

    let prefixLength = 0;
    const maxPrefix = Math.min(4, Math.min(s1.length, s2.length));
    for (let i = 0; i < maxPrefix; i++) {
      if (s1[i] === s2[i]) prefixLength++;
      else break;
    }

    const scalingFactor = 0.1;
    return Math.max(0, Math.min(1, jaro + (prefixLength * scalingFactor * (1.0 - jaro))));
  }

  function tokenSetSimilarity(s1, s2) {
    const t1 = new Set(s1.split(' ').filter(Boolean));
    const t2 = new Set(s2.split(' ').filter(Boolean));

    if (t1.size === 0 && t2.size === 0) return 1.0;
    if (t1.size === 0 || t2.size === 0) return 0.0;

    let intersection = 0;
    t1.forEach(t => { if (t2.has(t)) intersection++; });
    const union = new Set([...t1, ...t2]).size;

    return intersection / union;
  }

  function phoneticKey(input) {
    if (!input) return '';
    let k = input.toLowerCase();

    k = k.replace(/ph/g, 'f')
      .replace(/gh/g, 'g')
      .replace(/kh/g, 'k')
      .replace(/dh/g, 'd')
      .replace(/bh/g, 'b')
      .replace(/th/g, 't')
      .replace(/jh/g, 'j')
      .replace(/sh/g, 's')
      .replace(/ch/g, 's')
      .replace(/ck/g, 'k')
      .replace(/qu/g, 'k')
      .replace(/x/g, 'ks')
      .replace(/c/g, 'k')
      .replace(/z/g, 's')
      .replace(/ee/g, 'i')
      .replace(/ea/g, 'i')
      .replace(/oo/g, 'u')
      .replace(/ou/g, 'u')
      .replace(/yu/g, 'u')
      .replace(/ie/g, 'i')
      .replace(/y/g, 'i')
      .replace(/w/g, 'v')
      .replace(/h\b/g, '')
      .replace(/e\b/g, '');

    // Collapse repeated letters
    let out = '';
    let prev = '';
    for (let i = 0; i < k.length; i++) {
      const c = k[i];
      if (c !== prev || !/[a-z]/.test(c)) {
        out += c;
        prev = c;
      }
    }
    return out.trim();
  }

  function phoneticSimilarity(s1, s2) {
    const p1 = phoneticKey(s1);
    const p2 = phoneticKey(s2);
    if (p1 === p2 && p1.length > 0) return 1.0;
    return jaroWinklerSimilarity(p1, p2);
  }

  function computeMatchScore(query, target) {
    if (!query || !target) return 0.0;
    if (query === target) return 1.0;

    const qNorm = (typeof QueryNormalizer !== 'undefined') ? QueryNormalizer.normalize(query) : query.toLowerCase().trim();
    const tNorm = (typeof QueryNormalizer !== 'undefined') ? QueryNormalizer.normalize(target) : target.toLowerCase().trim();

    if (qNorm === tNorm) return 1.0;

    if (tNorm.startsWith(qNorm)) {
      const ratio = qNorm.length / tNorm.length;
      return Math.max(0, Math.min(1, 0.85 + (0.15 * ratio)));
    }

    if (tNorm.includes(qNorm)) {
      const ratio = qNorm.length / tNorm.length;
      return Math.max(0, Math.min(1, 0.75 + (0.20 * ratio)));
    }

    const dist = damerauLevenshteinDistance(qNorm, tNorm);
    const jw = jaroWinklerSimilarity(qNorm, tNorm);
    const lev = normalizedLevenshtein(qNorm, tNorm);
    const tokens = tokenSetSimilarity(qNorm, tNorm);
    const phone = phoneticSimilarity(qNorm, tNorm);

    // Small edit distance boost
    if (dist <= 2 || phone >= 0.95 || lev >= 0.85) {
      return Math.max(0.85, Math.max(jw, (jw * 0.4 + lev * 0.4 + phone * 0.2)));
    }

    return Math.max(0, Math.min(1, (jw * 0.35 + lev * 0.25 + tokens * 0.25 + phone * 0.15)));
  }

  return {
    damerauLevenshteinDistance,
    normalizedLevenshtein,
    jaroWinklerSimilarity,
    tokenSetSimilarity,
    phoneticKey,
    phoneticSimilarity,
    computeMatchScore
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = StringSimilarity;
}
