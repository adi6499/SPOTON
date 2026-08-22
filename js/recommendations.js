// ========================================
// MusicFlow — Personalized Recommendation Engine
// ========================================

const Recs = (() => {
  // Aggregate data from stats, favorites, and history
  function getTasteProfile() {
    const stats = Storage.getStats();
    const history = Storage.getListeningHistory();
    const favorites = Storage.getFavorites();

    const topArtistsMap = { ...stats.topArtists };
    const topGenresMap = { ...stats.topGenres };

    // Weight recent history higher
    history.slice(0, 50).forEach(song => {
      const artist = song.artists ? song.artists.split(',')[0].trim() : 'Unknown';
      topArtistsMap[artist] = (topArtistsMap[artist] || 0) + 2;
      
      const genre = song.language ? song.language : 'Unknown';
      topGenresMap[genre] = (topGenresMap[genre] || 0) + 2;
    });

    // Weight favorites highest
    favorites.forEach(song => {
      const artist = song.artists ? song.artists.split(',')[0].trim() : 'Unknown';
      topArtistsMap[artist] = (topArtistsMap[artist] || 0) + 3;
      
      const genre = song.language ? song.language : 'Unknown';
      topGenresMap[genre] = (topGenresMap[genre] || 0) + 3;
    });

    const topArtists = Object.entries(topArtistsMap)
      .filter(([name]) => name !== 'Unknown')
      .sort((a, b) => b[1] - a[1])
      .map(a => a[0]);

    const topGenres = Object.entries(topGenresMap)
      .filter(([name]) => name !== 'Unknown')
      .sort((a, b) => b[1] - a[1])
      .map(a => a[0]);

    // Require a little signal to avoid cold-start; listening history counts too
    const hasEnoughData = (stats.totalSongsPlayed + favorites.length + history.length) >= 3;

    return { topArtists, topGenres, hasEnoughData };
  }

  async function getPersonalizedHome() {
    const profile = getTasteProfile();
    if (!profile.hasEnoughData) {
      return { madeForYou: [], perArtistShelves: {} };
    }

    const madeForYou = [];
    const perArtistShelves = {};

    try {
      // 1. Made For You: blend of the user's top artists (artist-verified),
      // topped up with their top language's hits. (topGenres alone was often
      // empty, which silently killed this shelf forever.)
      for (const artist of profile.topArtists.slice(0, 3)) {
        const res = await API.searchSongs(`${artist} best songs`, 12);
        if (res && res.length > 0) {
          const al = artist.toLowerCase();
          madeForYou.push(...res.map(API.normalizeSong)
            .filter(s => String(s.artists || '').toLowerCase().includes(al)));
        }
      }
      if (profile.topGenres.length > 0 && madeForYou.length < 8) {
        const topGenre = profile.topGenres[0];
        const res = await API.searchSongs(`top ${topGenre} hits`, 12);
        if (res && res.length > 0) {
          madeForYou.push(...res.map(API.normalizeSong));
        }
      }

      // 2. Per-Artist Shelves (only keep songs actually BY that artist -
      // artist searches return sound-alike cover spam otherwise)
      const artistsToFetch = profile.topArtists.slice(0, 2); // Max 2 artist shelves
      for (const artist of artistsToFetch) {
        const res = await API.searchSongs(`${artist} songs`, 20);
        if (res && res.length > 0) {
          const al = artist.toLowerCase();
          const byArtist = res.map(API.normalizeSong)
            .filter(s => String(s.artists || '').toLowerCase().includes(al));
          if (byArtist.length >= 4) perArtistShelves[artist] = byArtist.slice(0, 14);
        }
      }
      
      // Shuffle the 'Made For You' shelf slightly so it's not identical every time
      if (madeForYou.length > 0) {
        madeForYou.sort(() => Math.random() - 0.5);
      }

    } catch (e) {
      console.warn('[Recs] Failed to fetch personalized home:', e);
    }

    return { madeForYou, perArtistShelves };
  }

  async function getDailyMixes() {
    const cached = Storage.getDailyMixCache();
    if (cached) return cached;

    const mixes = [];
    const profile = getTasteProfile();
    
    try {
      if (profile.hasEnoughData && profile.topArtists.length > 0) {
        // Generate personalized mixes
        const artistMix = await API.searchSongs(`${profile.topArtists[0]} hits`);
        if (artistMix && artistMix.length > 0) {
          mixes.push({ title: 'Daily Mix 1', subtitle: `Based on ${profile.topArtists[0]}`, songs: artistMix.slice(0, 15).map(API.normalizeSong) });
        }
        
        if (profile.topGenres.length > 0) {
          const genreMix = await API.searchSongs(`${profile.topGenres[0]} mix`);
          if (genreMix && genreMix.length > 0) {
            mixes.push({ title: 'Daily Mix 2', subtitle: `Your ${profile.topGenres[0]} mix`, songs: genreMix.slice(0, 15).map(API.normalizeSong) });
          }
        }
      } else {
        // Fallback curated mixes
        const mix1 = await API.searchSongs('Top hits');
        const mix2 = await API.searchSongs('Chill hits');
        if (mix1) mixes.push({ title: 'Daily Mix 1', subtitle: 'Curated for you', songs: mix1.slice(0, 15).map(API.normalizeSong) });
        if (mix2) mixes.push({ title: 'Daily Mix 2', subtitle: 'Curated for you', songs: mix2.slice(0, 15).map(API.normalizeSong) });
      }

      if (mixes.length > 0) {
        Storage.setDailyMixCache(mixes);
      }
    } catch (e) {
      console.warn('[Recs] Failed to fetch daily mixes:', e);
    }
    return mixes;
  }

  return {
    getTasteProfile,
    getPersonalizedHome,
    getDailyMixes
  };
})();

window.Recs = Recs;
