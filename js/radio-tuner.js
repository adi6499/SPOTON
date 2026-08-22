// ========================================
// MusicFlow — Custom Radio Tuner & Endless Station Engine
// ========================================

const RadioTuner = (() => {
  let selectedArtists = [];
  let currentStationConfig = null;
  let isFetchingMore = false;

  const VIBE_KEYWORDS = {
    chill: 'chill acoustic lo-fi calm relax',
    upbeat: 'upbeat dance pop energetic feel good',
    intense: 'high energy hardstyle phonk hype gym',
    melancholy: 'sad emotional acoustic slow melancholy',
    party: 'club dance party remix banger'
  };

  function getSelectedArtists() {
    return selectedArtists;
  }

  function addArtist(artist) {
    if (selectedArtists.some(a => a.id === artist.id || a.name.toLowerCase() === artist.name.toLowerCase())) {
      return false;
    }
    if (selectedArtists.length >= 5) {
      UI.showToast('You can select up to 5 artists', 'warning');
      return false;
    }
    selectedArtists.push({
      id: artist.id,
      name: artist.name,
      image: artist.image || ''
    });
    renderSelectedArtists();
    return true;
  }

  function removeArtist(artistId) {
    selectedArtists = selectedArtists.filter(a => a.id !== artistId);
    renderSelectedArtists();
  }

  function clearArtists() {
    selectedArtists = [];
    renderSelectedArtists();
  }

  function renderSelectedArtists() {
    const container = document.getElementById('tuner-selected-artists');
    if (!container) return;

    if (selectedArtists.length === 0) {
      container.innerHTML = `<span class="tuner-empty-hint">Search and pick up to 5 artists to tune your station</span>`;
      return;
    }

    container.innerHTML = selectedArtists.map(a => `
      <div class="tuner-artist-chip" data-id="${a.id}">
        <img src="${a.image || 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%23333%22 width=%22100%22 height=%22100%22/><text x=%2250%22 y=%2255%22 text-anchor=%22middle%22 fill=%22%23fff%22 font-size=%2240%22>👤</text></svg>'}" alt="${a.name}">
        <span>${a.name}</span>
        <button class="btn-remove-artist" onclick="RadioTuner.removeArtist('${a.id}')" aria-label="Remove artist">✕</button>
      </div>
    `).join('');
  }

  async function generateCustomStation(config) {
    const { artists, variety = 'blend', songType = 'popular', vibe = 'all' } = config;
    currentStationConfig = { ...config };

    if (!artists || artists.length === 0) {
      UI.showToast('Please select at least one artist', 'warning');
      return [];
    }

    UI.showToast(`Tuning station for ${artists.map(a => a.name).join(', ')}...`, 'info');

    let pool = [];

    // 1. Fetch tracks for chosen artists
    for (const artist of artists) {
      try {
        if (songType === 'deep_cuts') {
          // Discography deep cuts: search artist albums or songs and take latter half
          const res = await API.searchSongs(`${artist.name} songs`, 40);
          if (res && res.length > 8) {
            pool.push(...res.slice(8)); // Take deeper tracks
          } else if (res) {
            pool.push(...res);
          }
        } else if (songType === 'new_releases') {
          const res = await API.searchSongs(`latest ${artist.name} songs new releases 2026`, 20);
          pool.push(...(res || []));
        } else {
          // Popular chart hits
          const res = await API.searchSongs(`${artist.name} top hits`, 25);
          pool.push(...(res || []));
        }
      } catch (e) {
        console.warn(`[RadioTuner] Error fetching artist ${artist.name}:`, e);
      }
    }

    // 2. Blend or Discoveries
    if (variety === 'blend' || variety === 'discover') {
      const vibeTag = vibe !== 'all' ? (VIBE_KEYWORDS[vibe] || '') : '';
      const discoveryLimit = variety === 'discover' ? 35 : 20;

      for (const artist of artists.slice(0, 2)) {
        try {
          const res = await API.searchSongs(`${artist.name} style similar artists ${vibeTag}`, discoveryLimit);
          if (res) pool.push(...res);
        } catch (e) {}
      }
    }

    // 3. Apply Vibe Filter queries if specific
    if (vibe !== 'all' && VIBE_KEYWORDS[vibe]) {
      try {
        const vibeQuery = `${artists[0].name} ${VIBE_KEYWORDS[vibe]}`;
        const vibeTracks = await API.searchSongs(vibeQuery, 20);
        if (vibeTracks) pool.push(...vibeTracks);
      } catch (e) {}
    }

    // 4. Normalize, honor language prefs, kill title-variant clones, enforce artist diversity
    let unique = pool.filter(s => s && s.id).map(API.normalizeSong);
    unique = API.filterByLanguagePrefs ? API.filterByLanguagePrefs(unique, { minKeep: 15 }) : unique;
    const shuffled = unique.sort(() => Math.random() - 0.5);
    const stationQueue = API.dedupeVariants
      ? API.dedupeVariants(shuffled, { maxPerArtist: 5, maxRun: 2 })
      : shuffled;

    if (stationQueue.length > 0) {
      Player.setQueue(stationQueue, 0);
      await Player.playSong(stationQueue[0]);
      closeTunerModal();
      if (window.UI && UI.showRadioStartedAnimation) {
        UI.showRadioStartedAnimation({
          name: `${artists[0].name} Radio`,
          artists: artists.map(a => a.name).join(', '),
          image: artists[0].image
        });
      } else {
        UI.showToast(`Endless Radio Station Launched!`, 'success');
      }
    } else {
      UI.showToast('Could not find tracks matching these filters', 'error');
    }

    return stationQueue;
  }

  /**
   * Infinite auto-queue filler daemon: automatically fetches and appends tracks when queue is low
   */
  async function checkAndRefillQueue(currentIndex, queue) {
    if (!currentStationConfig || isFetchingMore) return;
    if (queue.length - currentIndex > 2) return; // Only refill when 2 or fewer songs remain

    isFetchingMore = true;
    console.log('[RadioTuner] Queue running low. Auto-refilling 10 more station tracks...');

    try {
      const { artists, vibe } = currentStationConfig;
      const seedArtist = artists[Math.floor(Math.random() * artists.length)] || { name: 'trending' };
      const vibeTag = vibe && vibe !== 'all' ? (VIBE_KEYWORDS[vibe] || '') : '';
      
      const moreTracks = await API.searchSongs(`${seedArtist.name} similar songs ${vibeTag}`, 15);
      if (moreTracks && moreTracks.length > 0) {
        const currentKeys = queue.map(s => API.getTitleKey ? API.getTitleKey(s) : s.id);
        let newSongs = moreTracks.map(API.normalizeSong);
        newSongs = API.dedupeVariants
          ? API.dedupeVariants(newSongs, { maxPerArtist: 3, maxRun: 2, excludeKeys: currentKeys })
          : newSongs.filter(s => !queue.some(q => q.id === s.id));

        if (newSongs.length > 0) {
          Player.appendToQueue(newSongs);
          console.log(`[RadioTuner] Appended ${newSongs.length} fresh station tracks`);
        }
      }
    } catch (e) {
      console.warn('[RadioTuner] Refill error:', e);
    } finally {
      isFetchingMore = false;
    }
  }

  function openTunerModal() {
    const modal = document.getElementById('radio-tuner-modal');
    if (!modal) return;
    modal.style.display = 'flex';
    renderSelectedArtists();

    // Auto-populate default favorite artist if empty
    if (selectedArtists.length === 0) {
      const topArtists = Object.keys(Storage.getStats().topArtists || {});
      if (topArtists.length > 0) {
        addArtist({ id: 'seed_' + topArtists[0], name: topArtists[0] });
      }
    }
  }

  function closeTunerModal() {
    const modal = document.getElementById('radio-tuner-modal');
    if (modal) modal.style.display = 'none';
  }

  // Bind infinite queue daemon into Player lifecycle
  if (typeof Player !== 'undefined' && Player.onTrackChange) {
    Player.onTrackChange((currentIndex, queue) => {
      checkAndRefillQueue(currentIndex, queue);
    });
  }

  return {
    getSelectedArtists,
    addArtist,
    removeArtist,
    clearArtists,
    generateCustomStation,
    checkAndRefillQueue,
    openTunerModal,
    closeTunerModal
  };
})();

window.RadioTuner = RadioTuner;
