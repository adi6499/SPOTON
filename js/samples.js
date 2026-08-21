// ========================================
// MusicFlow — Samples Short-Form Feed Engine
// ========================================

const Samples = (() => {
  let sampleTracks = [];
  let currentSampleIndex = 0;
  let sampleAudio = null;
  let isPlaying = false;
  let observer = null;

  function initAudio() {
    if (!sampleAudio) {
      sampleAudio = document.createElement('audio');
      sampleAudio.id = 'samples-audio-player';
      sampleAudio.preload = 'auto';
      sampleAudio.volume = 0.85;
      document.body.appendChild(sampleAudio);

      sampleAudio.addEventListener('timeupdate', () => {
        const progressEl = document.getElementById(`sample-progress-${currentSampleIndex}`);
        if (progressEl && sampleAudio.duration) {
          const pct = (sampleAudio.currentTime / Math.min(30, sampleAudio.duration)) * 100;
          progressEl.style.width = `${Math.min(100, pct)}%`;
        }

        // Loop after 30 seconds
        if (sampleAudio.currentTime >= 30) {
          sampleAudio.currentTime = 0;
          sampleAudio.play().catch(() => {});
        }
      });
    }
  }

  async function loadSamplesFeed() {
    initAudio();
    const container = document.getElementById('samples-container');
    if (!container) return;

    container.innerHTML = `<div class="samples-loading" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 75vh; gap: 16px;">
      <div style="width: 48px; height: 48px; border: 3px solid rgba(255, 81, 103, 0.2); border-top-color: #ff5167; border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
      <span style="font-family: var(--font-heading); font-size: 15px; font-weight: 600; color: var(--text-secondary, #9ca3af);">Loading Live Viral Samples...</span>
    </div>`;

    try {
      // 1. Fetch authentic chart-topping hits & user favorites
      const [chartRes, popRes, indieRes, favTracks] = await Promise.allSettled([
        API.searchSongs('Arijit Singh Pritam Shreya Ghoshal Hits', 15),
        API.searchSongs('Diljit Dosanjh Badshah Karan Aujla AP Dhillon', 15),
        API.searchSongs('The Weeknd Dua Lipa Taylor Swift Bruno Mars', 15),
        Promise.resolve(Storage.getFavorites().slice(0, 10))
      ]);

      const pool = [];
      if (favTracks.status === 'fulfilled' && Array.isArray(favTracks.value)) {
        pool.push(...favTracks.value);
      }
      [chartRes, popRes, indieRes].forEach(res => {
        if (res.status === 'fulfilled' && Array.isArray(res.value)) {
          pool.push(...res.value);
        }
      });

      const bannedWords = ['katha', 'ramayan', 'bhajan', 'mantra', 'aarti', 'chalisa', 'workout', 'ballet', 'karaoke', 'instrumental', 'speech', 'meditation', 'podcast', 'audiobook', 'geeta', 'sunderkand', 'hanuman', 'recitation', 'pravachan', 'shloka'];

      const seen = new Set();
      sampleTracks = [];
      pool.forEach(song => {
        if (song && song.id && !seen.has(song.id)) {
          const norm = API.normalizeSong(song);
          const titleLower = (norm.name || '').toLowerCase();
          const artistLower = (norm.artists || norm.artist || '').toLowerCase();
          
          const isBanned = bannedWords.some(w => titleLower.includes(w) || artistLower.includes(w));
          if (!isBanned && norm.audioUrl) {
            seen.add(song.id);
            sampleTracks.push(norm);
          }
        }
      });

      // Shuffle for discovery
      sampleTracks = sampleTracks.sort(() => Math.random() - 0.5);

      if (sampleTracks.length === 0) {
        container.innerHTML = `<div class="empty-state" style="padding: 60px 20px; text-align: center; color: var(--text-secondary, #9ca3af);">No sample tracks found. Tap to reload.</div>`;
        return;
      }

      renderSamplesList(container);
    } catch (e) {
      console.warn('[Samples] Failed to load feed:', e);
      container.innerHTML = `<div class="empty-state" style="padding: 60px 20px; text-align: center; color: var(--text-secondary, #9ca3af);">Could not load Samples. Tap to retry.</div>`;
    }
  }

  function renderSamplesList(container) {
    container.innerHTML = '';

    const viewport = document.createElement('div');
    viewport.className = 'samples-viewport';
    viewport.style.cssText = 'height: calc(100vh - 140px); overflow-y: scroll; scroll-snap-type: y mandatory; scrollbar-width: none; position: relative;';

    sampleTracks.forEach((song, idx) => {
      const card = document.createElement('section');
      card.className = `sample-card ${idx === 0 ? 'active' : ''}`;
      card.dataset.index = idx;
      card.dataset.songId = song.id;
      card.style.cssText = 'height: calc(100vh - 140px); scroll-snap-align: start; position: relative; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 20px; overflow: hidden; background: var(--bg-base);';

      const isFav = Storage.isFavorite(song.id);
      const highResImg = (typeof API !== 'undefined' && API.getHighResImage) ? API.getHighResImage(song.image) : (song.image || 'assets/logo.jpg');

      card.innerHTML = `
        <!-- Ambient Dynamic Blur Glow -->
        <div style="position: absolute; width: 340px; height: 340px; border-radius: 50%; background: url('${highResImg}') center/cover; filter: blur(70px) opacity(0.35); pointer-events: none; transform: scale(1.3);"></div>

        <!-- Center Premium Spinning Vinyl Record Card (Stitch Design) -->
        <div class="sample-vinyl-record" style="width: min(75vw, 290px); aspect-ratio: 1; border-radius: 50%; position: relative; display: flex; align-items: center; justify-content: center; box-shadow: 0 20px 50px rgba(0,0,0,0.35); background: #121212; padding: 10px; margin-bottom: 24px; z-index: 2; border: 3px solid rgba(255,255,255,0.1);">
          <!-- Vinyl Grooves -->
          <div style="position: absolute; inset: 6px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.06); pointer-events: none;"></div>
          <div style="position: absolute; inset: 18px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.08); pointer-events: none;"></div>
          <div style="position: absolute; inset: 32px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.06); pointer-events: none;"></div>
          
          <!-- Center Album Art Disk -->
          <div style="width: 140px; height: 140px; border-radius: 50%; overflow: hidden; position: relative; border: 2px solid rgba(255,255,255,0.2); box-shadow: 0 4px 16px rgba(0,0,0,0.6);">
            <img src="${highResImg}" alt="${song.name}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='assets/logo.jpg'">
            <!-- Center Spindle Hole -->
            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 22px; height: 22px; border-radius: 50%; background: #ffffff; border: 4px solid #1c1b1b; box-shadow: inset 0 2px 4px rgba(0,0,0,0.5);"></div>
          </div>

          <!-- Animated Equalizer Live Badge -->
          <div style="position: absolute; top: 12px; right: 12px; background: rgba(0, 0, 0, 0.7); backdrop-filter: blur(12px); padding: 5px 10px; border-radius: 999px; display: flex; align-items: center; gap: 6px; border: 1px solid rgba(255,255,255,0.15);">
            <div class="playing-equalizer-bars" style="display: flex; gap: 2px; align-items: flex-end; height: 10px;">
              <span style="width: 2px; height: 100%; background: #ff5167; border-radius: 1px;"></span>
              <span style="width: 2px; height: 60%; background: #ff5167; border-radius: 1px;"></span>
              <span style="width: 2px; height: 80%; background: #ff5167; border-radius: 1px;"></span>
            </div>
            <span style="font-family: var(--font-mono, monospace); font-size: 10px; font-weight: 700; color: #ff5167; letter-spacing: 0.5px;">LIVE PREVIEW</span>
          </div>
        </div>

        <!-- Top 30s Progress Bar -->
        <div class="sample-card__progress-wrap" style="position: absolute; top: 12px; left: 16px; right: 16px; height: 3px; background: rgba(255, 255, 255, 0.2); border-radius: 2px; overflow: hidden; z-index: 10;">
          <div class="sample-card__progress-bar" id="sample-progress-${idx}" style="height: 100%; width: 0%; background: linear-gradient(90deg, #ff2d55, #ff5167); border-radius: 2px; transition: width 0.1s linear;"></div>
        </div>

        <!-- Info Overlay (Bottom Left) -->
        <div class="sample-info-overlay" style="position: absolute; bottom: 30px; left: 20px; right: 85px; z-index: 5;">
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
            <span class="material-symbols-outlined" style="font-size: 16px; color: #ff5167;">local_fire_department</span>
            <span style="font-family: var(--font-heading); font-size: 11px; color: #ff5167; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase;">SAMPLE PREVIEW (30S)</span>
          </div>
          <h2 style="font-family: var(--font-heading); font-size: 22px; font-weight: 800; color: var(--text-primary); line-height: 1.2; margin: 0 0 4px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${song.name}</h2>
          <p style="font-size: 14px; color: var(--text-secondary); margin: 0; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${song.artists || song.artist}</p>
        </div>

        <!-- Floating Action Column (Right) -->
        <div class="sample-floating-actions" style="position: absolute; bottom: 30px; right: 18px; display: flex; flex-direction: column; align-items: center; gap: 14px; z-index: 10;">
          <button class="btn-sample-play-full" data-action="play-full" title="Play Full Track" style="background: none; border: none; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 4px;">
            <div style="width: 50px; height: 50px; border-radius: 50%; background: #ff2d55; display: flex; align-items: center; justify-content: center; color: #fff; box-shadow: 0 4px 20px rgba(255, 45, 85, 0.45); transition: transform 0.2s;">
              <span class="material-symbols-outlined" style="font-size: 28px; font-variation-settings: 'FILL' 1;">play_arrow</span>
            </div>
            <span style="font-size: 11px; font-weight: 700; color: var(--text-primary);">Play Full</span>
          </button>

          <button data-action="fav" class="btn-sample-fav ${isFav ? 'active' : ''}" title="Favorite" style="background: none; border: none; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 4px;">
            <div style="width: 44px; height: 44px; border-radius: 50%; background: var(--bg-card, rgba(255, 255, 255, 0.8)); backdrop-filter: blur(16px); border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; box-shadow: var(--shadow-sm);">
              <span class="material-symbols-outlined" style="font-size: 22px; color: ${isFav ? '#ff2d55' : 'var(--text-primary)'}; ${isFav ? 'font-variation-settings: \'FILL\' 1;' : ''}">favorite</span>
            </div>
            <span style="font-size: 11px; font-weight: 600; color: var(--text-secondary);">${isFav ? 'Saved' : 'Like'}</span>
          </button>

          <button data-action="share" title="Share Sample" style="background: none; border: none; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 4px;">
            <div style="width: 44px; height: 44px; border-radius: 50%; background: var(--bg-card, rgba(255, 255, 255, 0.8)); backdrop-filter: blur(16px); border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; color: var(--text-primary); box-shadow: var(--shadow-sm);">
              <span class="material-symbols-outlined" style="font-size: 20px;">share</span>
            </div>
            <span style="font-size: 11px; font-weight: 500; color: var(--text-secondary);">Share</span>
          </button>
        </div>
      `;

      bindCardActions(card, song, idx);
      viewport.appendChild(card);
    });

    container.appendChild(viewport);
    setupScrollObserver(viewport);

    // Play first sample if active
    if (sampleTracks.length > 0) {
      playSampleAtIndex(0);
    }
  }

  function bindCardActions(card, song, index) {
    // Like button
    const favBtn = card.querySelector('[data-action="fav"]');
    if (favBtn) {
      favBtn.addEventListener('click', () => {
        const isNowFav = Storage.toggleFavorite(song);
        favBtn.classList.toggle('active', isNowFav);
        const svg = favBtn.querySelector('svg');
        if (svg) svg.setAttribute('fill', isNowFav ? '#FF4757' : 'none');
        UI.showToast(isNowFav ? `Added "${song.name}" to Favorites` : `Removed from Favorites`, 'success');
      });
    }

    // Add to playlist button
    const addPlBtn = card.querySelector('[data-action="add-playlist"]');
    if (addPlBtn) {
      addPlBtn.addEventListener('click', () => {
        const playlists = Storage.getPlaylists() || [];
        if (playlists.length === 0) {
          const newName = prompt('Create a new playlist:');
          if (newName) {
            const pl = Storage.createPlaylist(newName);
            Storage.addSongToPlaylist(pl.id, song);
            UI.showToast(`Saved to "${newName}"`, 'success');
          }
        } else {
          const menuItems = playlists.map(p => ({
            label: p.name,
            icon: '🎵',
            onClick: () => {
              Storage.addSongToPlaylist(p.id, song);
              UI.showToast(`Added to "${p.name}"`, 'success');
            }
          }));
          UI.showContextMenu(window.innerWidth / 2, window.innerHeight / 2, menuItems);
        }
      });
    }

    // Start radio button
    const radioBtn = card.querySelector('[data-action="start-radio"]');
    if (radioBtn) {
      radioBtn.addEventListener('click', () => {
        stopSample();
        if (window.App && window.App.startRadioForSong) {
          window.App.startRadioForSong(song);
        }
      });
    }

    // Play full song button
    const playFullBtn = card.querySelector('[data-action="play-full"]');
    if (playFullBtn) {
      playFullBtn.addEventListener('click', async () => {
        stopSample();
        Player.setQueue([song, ...sampleTracks.filter(s => s.id !== song.id)], 0);
        await Player.playSong(song);
        if (window.expandPlayer) window.expandPlayer(true);
      });
    }

    // Share button
    const shareBtn = card.querySelector('[data-action="share"]');
    if (shareBtn) {
      shareBtn.addEventListener('click', () => {
        const shareText = `Listen to "${song.name}" by ${song.artists} on MusicFlow!`;
        if (navigator.share) {
          navigator.share({ title: song.name, text: shareText, url: window.location.origin }).catch(() => {});
        } else {
          navigator.clipboard.writeText(`${shareText} ${window.location.origin}`);
          UI.showToast('Link copied to clipboard!', 'info');
        }
      });
    }
  }

  function setupScrollObserver(viewport) {
    if (observer) observer.disconnect();

    observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
          const index = parseInt(entry.target.dataset.index, 10);
          if (index !== currentSampleIndex) {
            playSampleAtIndex(index);
          }
        }
      });
    }, {
      root: viewport,
      threshold: 0.6
    });

    viewport.querySelectorAll('.sample-card').forEach(card => observer.observe(card));
  }

  async function playSampleAtIndex(index) {
    currentSampleIndex = index;
    const song = sampleTracks[index];
    if (!song) return;

    document.querySelectorAll('.sample-card').forEach((c, idx) => {
      c.classList.toggle('active', idx === index);
    });

    try {
      let streamUrl = song.streamUrl;
      if (!streamUrl) {
        const details = await API.getSongDetails(song.id);
        if (details && details.length > 0) {
          streamUrl = API.getBestDownloadUrl(details[0]);
        }
      }

      if (streamUrl && sampleAudio) {
        // Pause main player if it was playing
        if (typeof Player !== 'undefined') {
          const isMainPlaying = typeof Player.isPlaying === 'function' ? Player.isPlaying() : (typeof Player.getIsPlaying === 'function' ? Player.getIsPlaying() : false);
          if (isMainPlaying) {
            if (typeof Player.pauseAudio === 'function') Player.pauseAudio();
            else if (typeof Player.pause === 'function') Player.pause();
          }
        }

        sampleAudio.src = streamUrl;
        // Fast-forward 15s to hit the chorus snippet
        sampleAudio.currentTime = Math.min(15, (song.duration || 180) * 0.25);
        await sampleAudio.play();
        isPlaying = true;
      }
    } catch (e) {
      console.warn('[Samples] Play error:', e);
    }
  }

  function stopSample() {
    if (sampleAudio) {
      sampleAudio.pause();
      sampleAudio.currentTime = 0;
      isPlaying = false;
    }
  }

  function openSamplesPage() {
    UI.showPage('page-samples');
    history.pushState({ type: 'page', pageId: 'page-samples' }, '', '#samples');
    if (sampleTracks.length === 0) {
      loadSamplesFeed();
    } else {
      playSampleAtIndex(currentSampleIndex);
    }
  }

  return {
    loadSamplesFeed,
    openSamplesPage,
    stopSample
  };
})();

window.Samples = Samples;
