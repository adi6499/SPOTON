// ============================================================================
// MUSICFLOW — YOUTUBE MUSIC RADIO BUILDER ENGINE (Step 5)
// Multi-artist seed selection, variety tuning, mood filtering, and radio generation.
// ============================================================================

const RadioBuilder = (() => {
  const selectedArtists = new Set();
  let currentVariety = 'familiar'; // 'familiar' | 'blend' | 'discover'
  let currentMood = 'all'; // 'all' | 'chill' | 'upbeat' | 'party'

  const POPULAR_ARTISTS = [
    { name: 'Arijit Singh', image: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=200&auto=format&fit=crop&q=80' },
    { name: 'The Weeknd', image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=200&auto=format&fit=crop&q=80' },
    { name: 'Post Malone', image: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=200&auto=format&fit=crop&q=80' },
    { name: 'Dua Lipa', image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80' },
    { name: 'Shreya Ghoshal', image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&auto=format&fit=crop&q=80' },
    { name: 'Taylor Swift', image: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&auto=format&fit=crop&q=80' },
    { name: 'Pritam', image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80' },
    { name: 'Ed Sheeran', image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80' },
    { name: 'Billie Eilish', image: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=200&auto=format&fit=crop&q=80' }
  ];

  function open() {
    selectedArtists.clear();
    const grid = document.getElementById('radio-artist-grid');
    const label = document.getElementById('radio-builder-step-label');

    if (label) label.textContent = 'Select up to 10 artists (0 selected)';
    if (grid) {
      grid.innerHTML = POPULAR_ARTISTS.map(a => `
        <div class="radio-artist-item" id="radio-art-${a.name.replace(/[^a-zA-Z0-9]/g, '')}" onclick="RadioBuilder.toggleArtist('${a.name}')">
          <img src="${a.image}" alt="${a.name}" onerror="this.src='assets/logo.png'">
          <span>${a.name}</span>
        </div>
      `).join('');
    }

    if (typeof App !== 'undefined' && App.openBottomSheet) {
      App.openBottomSheet('sheet-radio-builder');
    }
  }

  function toggleArtist(artistName) {
    if (selectedArtists.has(artistName)) {
      selectedArtists.delete(artistName);
    } else {
      if (selectedArtists.size >= 10) {
        if (typeof UI !== 'undefined' && UI.showToast) {
          UI.showToast('You can select up to 10 artists');
        }
        return;
      }
      selectedArtists.add(artistName);
    }

    const safeId = `radio-art-${artistName.replace(/[^a-zA-Z0-9]/g, '')}`;
    const el = document.getElementById(safeId);
    if (el) {
      el.classList.toggle('selected', selectedArtists.has(artistName));
    }

    const label = document.getElementById('radio-builder-step-label');
    if (label) {
      label.textContent = `Select up to 10 artists (${selectedArtists.size} selected)`;
    }
  }

  function setVariety(variety) {
    currentVariety = variety;
    document.querySelectorAll('[data-variety]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.variety === variety);
    });
  }

  function setMood(mood) {
    currentMood = mood;
    document.querySelectorAll('[data-mood]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mood === mood);
    });
  }

  async function launch() {
    if (selectedArtists.size === 0) {
      if (typeof UI !== 'undefined' && UI.showToast) {
        UI.showToast('Please select at least 1 artist');
      }
      return;
    }

    if (typeof App !== 'undefined' && App.closeBottomSheet) {
      App.closeBottomSheet('sheet-radio-builder');
    }
    if (typeof UI !== 'undefined' && UI.showToast) {
      UI.showToast(`Starting custom radio for ${Array.from(selectedArtists).join(', ')}...`);
    }

    const artists = Array.from(selectedArtists);
    const query = `${artists.join(' ')} ${currentMood === 'all' ? '' : currentMood} radio`;

    try {
      let tracks = [];
      if (typeof YouTubeMusicService !== 'undefined' && YouTubeMusicService.search) {
        const res = await YouTubeMusicService.search(query, 20);
        tracks = res?.songs || [];
      }
      if (!tracks || tracks.length === 0) {
        if (typeof API !== 'undefined' && API.searchSongs) {
          tracks = await API.searchSongs(query, 1, 20);
        }
      }

      if (tracks && tracks.length > 0) {
        if (typeof Player !== 'undefined' && Player.playTrack) {
          Player.playTrack(tracks[0], tracks);
        }
        if (typeof App !== 'undefined' && App.expandFullPlayer) {
          App.expandFullPlayer();
        }
      }
    } catch (err) {
      console.warn('[RadioBuilder] Launch failed:', err.message);
    }
  }

  return {
    open,
    toggleArtist,
    setVariety,
    setMood,
    launch,
    getSelectedArtists: () => Array.from(selectedArtists),
    getVariety: () => currentVariety,
    getMood: () => currentMood
  };
})();

if (typeof window !== 'undefined') {
  window.RadioBuilder = RadioBuilder;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = RadioBuilder;
}
