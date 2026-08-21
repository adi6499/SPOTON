// ========================================
// MusicFlow — Personalized Mix Suite Engine
// ========================================

const MixSuite = (() => {
  const MIX_CACHE_KEY = 'mf_personalized_mix_suite';

  const MIX_GRADIENTS = [
    'linear-gradient(135deg, #FF0844, #FFB199)', // Supermix
    'linear-gradient(135deg, #667EEA, #764BA2)', // Mix 1
    'linear-gradient(135deg, #F5576C, #F093FB)', // Mix 2
    'linear-gradient(135deg, #4FACFE, #00F2FE)', // Mix 3
    'linear-gradient(135deg, #43E97B, #38F9D7)', // Mix 4
    'linear-gradient(135deg, #FA709A, #FEE140)', // Mix 5
    'linear-gradient(135deg, #30CFD0, #330867)', // Mix 6
    'linear-gradient(135deg, #B3FFAB, #12FFF7)', // Mix 7
    'linear-gradient(135deg, #0BA360, #3CBA92)', // Replay
    'linear-gradient(135deg, #8E2DE2, #4A00E0)', // Discovery
    'linear-gradient(135deg, #F857A6, #FF5858)', // Forgotten
  ];

  function getListeningClusters() {
    const stats = Storage.getStats();
    const history = Storage.getListeningHistory();
    const favorites = Storage.getFavorites();

    const artistScores = { ...(stats.topArtists || {}) };
    const genreScores = { ...(stats.topGenres || {}) };

    // Weight recent plays
    history.slice(0, 60).forEach(song => {
      if (song.artists) {
        const primary = song.artists.split(',')[0].trim();
        artistScores[primary] = (artistScores[primary] || 0) + 2;
      }
      if (song.language) {
        genreScores[song.language] = (genreScores[song.language] || 0) + 2;
      }
    });

    // Weight favorites
    favorites.forEach(song => {
      if (song.artists) {
        const primary = song.artists.split(',')[0].trim();
        artistScores[primary] = (artistScores[primary] || 0) + 3;
      }
      if (song.language) {
        genreScores[song.language] = (genreScores[song.language] || 0) + 3;
      }
    });

    const topArtists = Object.entries(artistScores)
      .filter(([name]) => name && name !== 'Unknown' && name !== '-')
      .sort((a, b) => b[1] - a[1])
      .map(entry => entry[0]);

    const topGenres = Object.entries(genreScores)
      .filter(([name]) => name && name !== 'Unknown')
      .sort((a, b) => b[1] - a[1])
      .map(entry => entry[0]);

    return { topArtists, topGenres, totalListened: history.length + favorites.length };
  }

  async function generateMixSuite(forceRefresh = false) {
    if (!forceRefresh) {
      const cached = Storage.get(MIX_CACHE_KEY);
      if (cached && cached.timestamp && (Date.now() - cached.timestamp < 3600000)) { // 1 hour cache
        return cached.mixes;
      }
    }

    const { topArtists, topGenres, totalListened } = getListeningClusters();
    const history = Storage.getListeningHistory();
    const favorites = Storage.getFavorites();
    const mixes = [];

    // 1. MY SUPERMIX (100-track blend)
    const supermixSeed = topArtists.slice(0, 3).join(', ') || 'Global Hits';
    mixes.push({
      id: 'mix_supermix',
      type: 'supermix',
      title: 'My Supermix',
      subtitle: `Endless blend of ${supermixSeed} & more`,
      badge: 'Supermix',
      gradient: MIX_GRADIENTS[0],
      icon: '✨',
      query: topArtists.length > 0 ? `${topArtists[0]} top viral hits` : 'top 50 global hits'
    });

    // 2. REPLAY MIX (Heavy repeat tracks)
    const fourteenDaysAgo = Date.now() - (14 * 24 * 60 * 60 * 1000);
    const recentPlayCounts = {};
    history.forEach(item => {
      if (item.playedAt && item.playedAt > fourteenDaysAgo) {
        recentPlayCounts[item.id] = (recentPlayCounts[item.id] || { song: item, count: 0 });
        recentPlayCounts[item.id].count++;
      }
    });

    const replaySongs = Object.values(recentPlayCounts)
      .filter(entry => entry.count >= 2)
      .sort((a, b) => b.count - a.count)
      .map(entry => entry.song);

    mixes.push({
      id: 'mix_replay',
      type: 'replay',
      title: 'Replay Mix',
      subtitle: 'Your most repeated tracks right now',
      badge: 'On Repeat',
      gradient: MIX_GRADIENTS[8],
      icon: '🔁',
      staticSongs: replaySongs.length > 0 ? replaySongs : favorites.slice(0, 20),
      query: 'top viral songs 2026'
    });

    // 3. DISCOVERY MIX (Unheard gems & related artists)
    const historyIdSet = new Set(history.map(s => s.id));
    const discoverySeed = topGenres[0] || (topArtists[0] ? `${topArtists[0]} style` : 'trending');
    mixes.push({
      id: 'mix_discovery',
      type: 'discovery',
      title: 'Discovery Mix',
      subtitle: `Fresh tracks tailored to your love of ${discoverySeed}`,
      badge: 'Discovery',
      gradient: MIX_GRADIENTS[9],
      icon: '🧭',
      query: `${discoverySeed} underground fresh hits`
    });

    // 4. MY MIX 1 to 7 (Taste Sub-Clusters)
    const defaultMixThemes = [
      { name: 'Bollywood Melodies', query: 'bollywood romantic superhits' },
      { name: 'Phonk & Drift Hype', query: 'phonk drift bass boosted' },
      { name: 'Chill & Lo-Fi Beats', query: 'lo-fi chillhop beats calm' },
      { name: 'Punjabi Pop Banger Hits', query: 'punjabi pop chartbusters' },
      { name: 'Indie & Acoustic Flow', query: 'indie acoustic folk melodies' },
      { name: 'Global Dance & EDM', query: 'edm festival dance hits' },
      { name: 'Deep Focus & Synthwave', query: 'synthwave electronic focus' }
    ];

    for (let i = 1; i <= 7; i++) {
      let mixTitle = `My Mix ${i}`;
      let mixSubtitle = 'Curated for your vibe';
      let mixQuery = defaultMixThemes[i - 1].query;

      if (topArtists[i - 1]) {
        mixSubtitle = `Featuring ${topArtists[i - 1]}`;
        mixQuery = `${topArtists[i - 1]} greatest hits`;
      } else if (topGenres[i - 1]) {
        mixSubtitle = `Based on your love for ${topGenres[i - 1]}`;
        mixQuery = `${topGenres[i - 1]} top hits`;
      } else if (defaultMixThemes[i - 1]) {
        mixSubtitle = defaultMixThemes[i - 1].name;
      }

      mixes.push({
        id: `mix_${i}`,
        type: 'cluster',
        index: i,
        title: mixTitle,
        subtitle: mixSubtitle,
        badge: `Mix ${i}`,
        gradient: MIX_GRADIENTS[i] || MIX_GRADIENTS[1],
        icon: '🎵',
        query: mixQuery
      });
    }

    // 5. FORGOTTEN FAVORITES (Past loves)
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const pastSongs = history
      .filter(item => item.playedAt && item.playedAt < thirtyDaysAgo)
      .slice(0, 20);

    mixes.push({
      id: 'mix_forgotten',
      type: 'forgotten',
      title: 'Forgotten Favorites',
      subtitle: 'Relive songs you used to have on repeat',
      badge: 'Throwback',
      gradient: MIX_GRADIENTS[10],
      icon: '⏳',
      staticSongs: pastSongs.length > 0 ? pastSongs : favorites.slice(0, 15),
      query: 'classic nostalgic hits'
    });

    // Cache the mix suite configuration
    Storage.set(MIX_CACHE_KEY, { timestamp: Date.now(), mixes });

    return mixes;
  }

  async function getSongsForMix(mix) {
    if (mix.staticSongs && mix.staticSongs.length > 0) {
      return mix.staticSongs.map(API.normalizeSong);
    }

    if (mix.type === 'supermix') {
      const history = Storage.getListeningHistory();
      const favs = Storage.getFavorites();
      const { topArtists, topGenres } = getListeningClusters();

      const queries = [
        topArtists[0] ? `${topArtists[0]} songs` : 'trending hits',
        topArtists[1] ? `${topArtists[1]} songs` : 'top 50 viral',
        topGenres[0] ? `${topGenres[0]} hits` : 'global top 50',
        'billboard hot 100 superhits'
      ];

      const results = await Promise.allSettled(queries.map(q => API.searchSongs(q, 25)));
      const pool = [...favs, ...history.slice(0, 30)];
      
      results.forEach(res => {
        if (res.status === 'fulfilled' && Array.isArray(res.value)) {
          pool.push(...res.value);
        }
      });

      const seen = new Set();
      const unique = [];
      pool.forEach(item => {
        if (item && item.id && !seen.has(item.id)) {
          seen.add(item.id);
          unique.push(API.normalizeSong(item));
        }
      });

      return unique.sort(() => Math.random() - 0.5).slice(0, 100);
    }

    const res = await API.searchSongs(mix.query || 'top hits', 40);
    return (res || []).map(API.normalizeSong);
  }

  async function playMix(mixId) {
    const mixes = await generateMixSuite();
    const mix = mixes.find(m => m.id === mixId) || mixes[0];
    if (!mix) return;

    UI.showToast(`Loading ${mix.title}...`, 'info');
    const songs = await getSongsForMix(mix);
    if (songs && songs.length > 0) {
      Player.setQueue(songs, 0);
      await Player.playSong(songs[0]);
      UI.showToast(`Playing ${mix.title}`, 'success');
    } else {
      UI.showToast('Could not load mix songs', 'error');
    }
  }

  async function openMixPage(mixId) {
    const mixes = await generateMixSuite();
    const mix = mixes.find(m => m.id === mixId);
    if (!mix) return;

    UI.showPage('page-playlist');
    history.pushState({ type: 'mix', id: mix.id }, '', `#mix/${mix.id}`);

    const imgEl = document.getElementById('playlist-page-img');
    const nameEl = document.getElementById('playlist-page-name');
    if (nameEl) nameEl.textContent = mix.title;
    if (imgEl) {
      imgEl.src = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><rect fill="%231a1a2e" width="300" height="300"/><text x="150" y="140" text-anchor="middle" fill="%23fff" font-size="64">${mix.icon || '🎵'}</text><text x="150" y="200" text-anchor="middle" fill="%23ffffff" font-weight="bold" font-family="sans-serif" font-size="24">${mix.badge || 'Mix'}</text></svg>`;
      imgEl.style.background = mix.gradient;
    }

    const container = document.getElementById('playlist-songs-container');
    if (container) {
      container.innerHTML = '<div class="loading-shelf"></div>';
    }

    const songs = await getSongsForMix(mix);
    if (container && songs && songs.length > 0) {
      container.innerHTML = '';
      songs.forEach((song, i) => {
        const el = UI.renderSongListItem(song, i, { showRemove: false });
        container.appendChild(el);
      });

      container.querySelectorAll('[data-action="play"]').forEach(el => {
        el.addEventListener('click', async () => {
          const index = parseInt(el.dataset.index, 10);
          Player.setQueue(songs, index);
          await Player.playSong(songs[index]);
        });
      });

      const playBtn = document.getElementById('btn-playlist-play');
      if (playBtn) {
        playBtn.onclick = async () => {
          Player.setQueue(songs, 0);
          await Player.playSong(songs[0]);
        };
      }
    } else if (container) {
      container.innerHTML = '<div class="empty-state">No tracks found in this mix</div>';
    }
  }

  return {
    generateMixSuite,
    getSongsForMix,
    playMix,
    openMixPage
  };
})();

window.MixSuite = MixSuite;
