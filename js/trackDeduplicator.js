// ==========================================================================
// MUSICFLOW — TRACK DEDUPLICATOR & QUALITY CLUSTER ENGINE
// ==========================================================================

const TrackDeduplicator = (() => {

  function cleanTrackTitle(name) {
    if (!name) return '';
    const clean = String(name)
      .replace(/\(.*?\)/gs, '')
      .replace(/\[.*?\]/gs, '')
      .replace(/(?:feat\..*|ft\..*|prod\..*|official.*|slowed.*|reverb.*)/gi, '');
    return (typeof QueryNormalizer !== 'undefined') ? QueryNormalizer.normalize(clean) : clean.toLowerCase().trim();
  }

  function cleanArtistName(artists) {
    if (!artists) return '';
    const first = String(artists).split(/[,&;/]|feat\.|ft\./i)[0].trim();
    const clean = first.replace(/(?:feat\..*|ft\..*)/gi, '');
    return (typeof QueryNormalizer !== 'undefined') ? QueryNormalizer.normalize(clean) : clean.toLowerCase().trim();
  }

  function scoreTrackQuality(song, wantsRemix, wantsLive, wantsAcoustic, wantsKaraoke) {
    let score = 100.0;
    const nameLower = (song.name || '').toLowerCase();
    const albumLower = (song.album || '').toLowerCase();

    // 1. Bitrate / Stream URL Quality & Playable Provider Bonus
    if (song.playbackAvailable || song.audioUrl || song.streamUrl) score += 30.0;
    if (song.provider === 'jiosaavn') score += 15.0; // Prefer JioSaavn canonical source
    if (Array.isArray(song.downloadUrl) && song.downloadUrl.some(u => (u.quality || '').includes('320'))) {
      score += 15.0;
    }

    // 2. High Resolution Artwork
    if (song.image && song.image.includes('500x500')) score += 10.0;
    if (song.image && !song.image.includes('logo.png')) score += 5.0;

    // 3. Album context
    if (song.album && !albumLower.includes('compilation') && !albumLower.includes('best of')) {
      score += 10.0;
    }

    // 4. Version modifiers
    const isKaraoke = nameLower.includes('karaoke') || nameLower.includes('instrumental');
    const isCover = nameLower.includes('cover') || nameLower.includes('tribute') || nameLower.includes('originally performed');
    const isLive = nameLower.includes('live') || nameLower.includes('concert');
    const isRemix = nameLower.includes('remix') || nameLower.includes('mix');
    const isSlowed = nameLower.includes('slowed') || nameLower.includes('reverb');

    if (isKaraoke && !wantsKaraoke) score -= 80.0;
    if (isCover) score -= 70.0;
    if (isLive && !wantsLive) score -= 30.0;
    if (isRemix && !wantsRemix) score -= 20.0;
    const dur = Number(song.duration || 0);
    if (dur >= 90 && dur <= 480) score += 5.0;

    // Metadata quality check: penalize if artist name is identical to track name
    if (cleanTrackTitle(song.name) === cleanArtistName(song.artists || song.primaryArtist)) {
      score -= 40.0;
    }

    return score;
  }

  function deduplicate(songs, query = '') {
    if (!Array.isArray(songs) || songs.length === 0) return [];

    const qNorm = (typeof QueryNormalizer !== 'undefined') ? QueryNormalizer.normalize(query) : query.toLowerCase();
    const wantsRemix = qNorm.includes('remix') || qNorm.includes('mix');
    const wantsLive = qNorm.includes('live') || qNorm.includes('concert');
    const wantsAcoustic = qNorm.includes('acoustic') || qNorm.includes('unplugged');
    const wantsKaraoke = qNorm.includes('karaoke') || qNorm.includes('instrumental');

    const clusters = new Map();

    for (const song of songs) {
      if (!song) continue;
      const titleNorm = cleanTrackTitle(song.name);
      const artistNorm = cleanArtistName(song.artists || song.primaryArtist);
      const fingerprint = `${titleNorm}:::${artistNorm}`;

      if (!clusters.has(fingerprint)) {
        clusters.set(fingerprint, []);
      }
      clusters.get(fingerprint).push(song);
    }

    const result = [];

    clusters.forEach((group) => {
      if (group.length === 1) {
        result.push(group[0]);
      } else {
        let best = group[0];
        let bestScore = -Infinity;

        for (const s of group) {
          const sc = scoreTrackQuality(s, wantsRemix, wantsLive, wantsAcoustic, wantsKaraoke);
          if (sc > bestScore) {
            bestScore = sc;
            best = s;
          }
        }
        result.push(best);

        // Keep distinct remix if not explicitly searching for remixes
        if (!wantsRemix) {
          const remixes = group.filter(s => s.id !== best.id && (s.name || '').toLowerCase().includes('remix'));
          if (remixes.length > 0 && remixes.length <= 2) {
            result.push(remixes[0]);
          }
        }
      }
    });

    return result;
  }

  return {
    cleanTrackTitle,
    cleanArtistName,
    deduplicate
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = TrackDeduplicator;
}
