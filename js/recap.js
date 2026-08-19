const Recap = (() => {
  function generateRecapData() {
    const history = Storage.getListeningHistory();
    const stats = Storage.getStats();
    
    if (!history || history.length < 5) {
      return null;
    }

    let totalMinutes = 0;
    const artistCounts = {};
    const songCounts = {};

    history.forEach(session => {
      // session is a flat object: { id, name, artists, album, image, duration, playedAt }
      const duration = session.duration || 180; // default 3 mins if missing
      totalMinutes += duration / 60; // 1 play = 1 duration
      
      if (session.artists) {
        const artists = session.artists.split(',').map(a => a.trim());
        artists.forEach(a => {
          if (!a || a === '-') return;
          artistCounts[a] = (artistCounts[a] || 0) + 1; // 1 occurrence = 1 count
        });
      }

      if (session.name) {
        songCounts[session.name] = (songCounts[session.name] || 0) + 1;
      }
    });

    const topArtists = Object.entries(artistCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(entry => entry[0]);

    const topSongEntry = Object.entries(songCounts)
      .sort((a, b) => b[1] - a[1])[0];

    return {
      totalMinutes: Math.round(totalMinutes),
      totalSongs: stats.totalSongsPlayed || history.length || 0,
      topArtists: topArtists.length > 0 ? topArtists : ['Unknown'],
      topSong: topSongEntry ? topSongEntry[0] : 'Unknown'
    };
  }

  function renderRecap(container) {
    const data = generateRecapData();
    container.innerHTML = '';

    if (!data) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon" style="font-size: 48px; margin-bottom: 16px;">🎧</div>
          <div class="empty-state__title" style="font-size: 24px;">Keep Listening</div>
          <div class="empty-state__subtitle" style="opacity: 0.7; margin-top: 8px;">Listen to a few more songs to unlock your Music Recap.</div>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div style="background: linear-gradient(135deg, var(--accent-color), var(--bg-surface)); border-radius: var(--radius-xl); padding: var(--space-2xl); box-shadow: var(--shadow-lg); width: 100%; max-width: 400px; position: relative; overflow: hidden; margin: 0 auto; text-align: left;">
        <h1 style="font-size: 32px; font-weight: 800; margin-bottom: 32px; letter-spacing: -1px; text-shadow: 0 2px 10px rgba(0,0,0,0.3); text-align: center;">Your Music Recap</h1>
        
        <div style="margin-bottom: 24px; background: rgba(0,0,0,0.2); padding: 16px; border-radius: var(--radius-lg);">
          <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; opacity: 0.8;">Total Time</div>
          <div style="font-size: 36px; font-weight: 700; color: #fff;">${data.totalMinutes.toLocaleString()} <span style="font-size: 16px; opacity: 0.8;">min</span></div>
        </div>

        <div style="margin-bottom: 24px; background: rgba(0,0,0,0.2); padding: 16px; border-radius: var(--radius-lg);">
          <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; opacity: 0.8;">Top Artists</div>
          <ol style="margin: 8px 0 0; padding-left: 20px; font-size: 16px; line-height: 1.6; font-weight: 600;">
            ${data.topArtists.map(a => `<li>${a}</li>`).join('')}
          </ol>
        </div>

        <div style="margin-bottom: 32px; background: rgba(0,0,0,0.2); padding: 16px; border-radius: var(--radius-lg);">
          <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; opacity: 0.8;">Most Played Song</div>
          <div style="font-size: 20px; font-weight: 600; margin-top: 4px;">${data.topSong}</div>
        </div>

        <button id="btn-share-recap" class="btn-primary" style="width: 100%; font-size: 16px; padding: 14px; border-radius: var(--radius-full); box-shadow: 0 4px 15px rgba(0,0,0,0.2); display: flex; justify-content: center; align-items: center; gap: 8px;">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
          Share Recap
        </button>
      </div>
    `;

    document.getElementById('btn-share-recap')?.addEventListener('click', () => {
      if (navigator.share) {
        navigator.share({
          title: 'My MusicFlow Recap',
          text: `I listened to ${data.totalMinutes} minutes of music! My top artist is ${data.topArtists[0]}.`,
          url: window.location.href
        }).catch(console.error);
      } else {
        alert('Sharing is not supported on this browser.');
      }
    });
  }

  return { renderRecap };
})();
