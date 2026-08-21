// ========================================
// MusicFlow — Collaborative & Public Playlists Engine
// ========================================

const PlaylistSharing = (() => {
  const CURATED_PUBLIC_PLAYLISTS = [
    {
      id: 'pub_phonk',
      title: 'Midnight Phonk Drift',
      description: 'Aggressive Brazilian phonk, drift bass & high octane speed',
      coverGradient: 'linear-gradient(135deg, #FF0844, #FFB199)',
      icon: '🏎️',
      query: 'brazilian phonk drift high energy'
    },
    {
      id: 'pub_bollywood2000',
      title: 'Bollywood 2000s Nostalgia',
      description: 'Golden era chartbusters, KK, Emraan Hashmi & Mohit Chauhan',
      coverGradient: 'linear-gradient(135deg, #F5576C, #F093FB)',
      icon: '💖',
      query: 'bollywood 2000s superhits kk'
    },
    {
      id: 'pub_lofi',
      title: 'Lo-Fi Chill & Study Flow',
      description: 'Relaxing beats, rain soundscapes & tranquil piano melodies',
      coverGradient: 'linear-gradient(135deg, #4FACFE, #00F2FE)',
      icon: '☕',
      query: 'lofi study chillhop beats'
    },
    {
      id: 'pub_punjabi',
      title: 'Punjabi Club Banger Drops',
      description: 'Sidhu, Karan Aujla, AP Dhillon, Diljit & Shubh anthems',
      coverGradient: 'linear-gradient(135deg, #F7971E, #FFD200)',
      icon: '🔥',
      query: 'top punjabi pop hits karan aujla sidhu'
    },
    {
      id: 'pub_gym',
      title: 'Gym Beast Mode & Hardstyle',
      description: 'Maximum motivation, hardstyle drops, EDM & heavy lifting beats',
      coverGradient: 'linear-gradient(135deg, #8E2DE2, #4A00E0)',
      icon: '⚡',
      query: 'gym workout pump motivational hits'
    },
    {
      id: 'pub_indie',
      title: 'Indie Folk & Soul India',
      description: 'Prateek Kuhad, Anuv Jain, Jasleen Royal & soulful acoustics',
      coverGradient: 'linear-gradient(135deg, #11998E, #38EF7D)',
      icon: '🌿',
      query: 'indie acoustic hindi songs anuv jain'
    }
  ];

  function getPublicPlaylists() {
    return CURATED_PUBLIC_PLAYLISTS;
  }

  /**
   * Generates a portable, shareable URL hash with encoded playlist metadata
   */
  function generateShareUrl(playlist) {
    try {
      const minimalData = {
        name: playlist.name,
        desc: playlist.description || '',
        songs: (playlist.songs || []).map(s => ({
          id: s.id,
          name: s.name,
          artists: s.artists,
          album: s.album,
          image: s.image,
          duration: s.duration
        }))
      };

      const jsonStr = JSON.stringify(minimalData);
      const encoded = encodeURIComponent(btoa(unescape(encodeURIComponent(jsonStr))));
      const origin = window.location.origin + window.location.pathname;
      return `${origin}#share-pl=${encoded}`;
    } catch (e) {
      console.error('[PlaylistSharing] Share URL error:', e);
      return null;
    }
  }

  function parseSharedPlaylist(encodedStr) {
    try {
      const decoded = decodeURIComponent(escape(atob(decodeURIComponent(encodedStr))));
      return JSON.parse(decoded);
    } catch (e) {
      console.warn('[PlaylistSharing] Parse error:', e);
      return null;
    }
  }

  function sharePlaylist(playlist) {
    const url = generateShareUrl(playlist);
    if (!url) {
      UI.showToast('Could not generate share link', 'error');
      return;
    }

    if (navigator.share) {
      navigator.share({
        title: playlist.name,
        text: `Listen to "${playlist.name}" on MusicFlow!`,
        url: url
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url);
      UI.showToast('Share link copied to clipboard!', 'success');
    }
  }

  async function openSharedPlaylist(sharedData) {
    if (!sharedData || !sharedData.songs) return;

    UI.showPage('page-playlist');
    const nameEl = document.getElementById('playlist-page-name');
    const imgEl = document.getElementById('playlist-page-img');
    const container = document.getElementById('playlist-songs-container');

    if (nameEl) nameEl.textContent = `${sharedData.name} (Shared)`;
    if (imgEl) {
      imgEl.src = sharedData.songs[0]?.image || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%231a1a2e" width="100" height="100"/><text x="50" y="55" text-anchor="middle" fill="%236c5ce7" font-size="40">🎵</text></svg>';
    }

    if (container) {
      container.innerHTML = `
        <div class="shared-playlist-banner">
          <div class="shared-playlist-badge">🔗 Shared Playlist</div>
          <p>Shared with you. Save it to your library to edit and keep it permanently.</p>
          <button class="btn-primary" id="btn-save-shared-pl" style="margin-top: 8px;">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px;"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Save to My Library
          </button>
        </div>
      `;

      sharedData.songs.forEach((song, i) => {
        const el = UI.renderSongListItem(song, i, { showRemove: false });
        container.appendChild(el);
      });

      document.getElementById('btn-save-shared-pl')?.addEventListener('click', () => {
        const newPl = Storage.createPlaylist(sharedData.name, sharedData.desc);
        sharedData.songs.forEach(s => Storage.addSongToPlaylist(newPl.id, s));
        UI.renderSidebarPlaylists();
        UI.showToast(`Saved "${sharedData.name}" to your library!`, 'success');
      });

      container.querySelectorAll('[data-action="play"]').forEach(el => {
        el.addEventListener('click', async () => {
          const index = parseInt(el.dataset.index, 10);
          Player.setQueue(sharedData.songs, index);
          await Player.playSong(sharedData.songs[index]);
        });
      });

      const playBtn = document.getElementById('btn-playlist-play');
      if (playBtn) {
        playBtn.onclick = async () => {
          Player.setQueue(sharedData.songs, 0);
          await Player.playSong(sharedData.songs[0]);
        };
      }
    }
  }

  async function openPublicPlaylist(pubPlId) {
    const pubPl = CURATED_PUBLIC_PLAYLISTS.find(p => p.id === pubPlId);
    if (!pubPl) return;

    UI.showPage('page-playlist');
    history.pushState({ type: 'public_playlist', id: pubPl.id }, '', `#public-playlist/${pubPl.id}`);

    const nameEl = document.getElementById('playlist-page-name');
    const imgEl = document.getElementById('playlist-page-img');
    const container = document.getElementById('playlist-songs-container');

    if (nameEl) nameEl.textContent = pubPl.title;
    if (imgEl) {
      imgEl.src = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><rect fill="%231a1a2e" width="300" height="300"/><text x="150" y="140" text-anchor="middle" fill="%23fff" font-size="64">${pubPl.icon || '🎵'}</text><text x="150" y="200" text-anchor="middle" fill="%23ffffff" font-weight="bold" font-family="sans-serif" font-size="20">Public</text></svg>`;
      imgEl.style.background = pubPl.coverGradient;
    }

    if (container) {
      container.innerHTML = '<div class="loading-shelf"></div>';
    }

    try {
      const res = await API.searchSongs(pubPl.query, 30);
      if (container && res && res.length > 0) {
        container.innerHTML = `
          <div class="shared-playlist-banner" style="background: ${pubPl.coverGradient}; margin-bottom: 16px;">
            <div class="shared-playlist-badge">🌍 Public Community Playlist</div>
            <p>${pubPl.description}</p>
            <button class="btn-primary" id="btn-save-pub-pl" style="margin-top: 8px; background: #fff; color: #000;">
              Save to My Library
            </button>
          </div>
        `;

        const normSongs = res.map(API.normalizeSong);
        normSongs.forEach((song, i) => {
          const el = UI.renderSongListItem(song, i, { showRemove: false });
          container.appendChild(el);
        });

        document.getElementById('btn-save-pub-pl')?.addEventListener('click', () => {
          const newPl = Storage.createPlaylist(pubPl.title, pubPl.description);
          normSongs.forEach(s => Storage.addSongToPlaylist(newPl.id, s));
          UI.renderSidebarPlaylists();
          UI.showToast(`Saved "${pubPl.title}" to your library!`, 'success');
        });

        container.querySelectorAll('[data-action="play"]').forEach(el => {
          el.addEventListener('click', async () => {
            const index = parseInt(el.dataset.index, 10);
            Player.setQueue(normSongs, index);
            await Player.playSong(normSongs[index]);
          });
        });

        const playBtn = document.getElementById('btn-playlist-play');
        if (playBtn) {
          playBtn.onclick = async () => {
            Player.setQueue(normSongs, 0);
            await Player.playSong(normSongs[0]);
          };
        }
      }
    } catch (e) {
      if (container) container.innerHTML = '<div class="empty-state">Could not load public playlist tracks</div>';
    }
  }

  function exportPlaylistsBackup() {
    const playlists = Storage.getPlaylists() || [];
    const jsonStr = JSON.stringify(playlists, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `musicflow-playlists-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    UI.showToast('Playlists backup downloaded!', 'success');
  }

  function importPlaylistsFromFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target.result);
        if (Array.isArray(imported)) {
          const existing = Storage.getPlaylists() || [];
          const merged = [...existing, ...imported];
          Storage.savePlaylists(merged);
          UI.renderSidebarPlaylists();
          UI.showToast(`Imported ${imported.length} playlists successfully!`, 'success');
        }
      } catch (err) {
        UI.showToast('Invalid backup file format', 'error');
      }
    };
    reader.readAsText(file);
  }

  return {
    getPublicPlaylists,
    generateShareUrl,
    parseSharedPlaylist,
    sharePlaylist,
    openSharedPlaylist,
    openPublicPlaylist,
    exportPlaylistsBackup,
    importPlaylistsFromFile
  };
})();

window.PlaylistSharing = PlaylistSharing;
