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

    // Require at least 3 played/favorited songs to avoid cold-start issues
    const hasEnoughData = (stats.totalSongsPlayed + favorites.length) >= 3;

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
      // 1. Made For You (based on top genres)
      if (profile.topGenres.length > 0) {
        const topGenre = profile.topGenres[0];
        const res = await API.searchSongs(`${topGenre} hits`);
        if (res && res.length > 0) {
          // Add normalized songs
          madeForYou.push(...res.slice(0, 15).map(API.normalizeSong));
        }
      }

      // 2. Per-Artist Shelves
      const artistsToFetch = profile.topArtists.slice(0, 2); // Max 2 artist shelves
      for (const artist of artistsToFetch) {
        const res = await API.searchSongs(`${artist} songs`);
        if (res && res.length > 0) {
          perArtistShelves[artist] = res.slice(0, 10).map(API.normalizeSong);
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
