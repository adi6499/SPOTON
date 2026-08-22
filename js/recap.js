var Recap = (() => {
  'use strict';

  let currentRecapTheme = 'charcoal'; // charcoal, plum, midnight

  const THEME_STYLES = {
    charcoal: {
      bg: '#131313',
      cardBg: 'rgba(255, 255, 255, 0.04)',
      border: 'rgba(255, 255, 255, 0.08)',
      accent: '#00f1fe',
      gradient: 'linear-gradient(135deg, #00f1fe 0%, #006a70 100%)',
      accentText: 'text-gradient-secondary'
    },
    plum: {
      bg: '#18101c',
      cardBg: 'rgba(255, 81, 103, 0.06)',
      border: 'rgba(255, 81, 103, 0.15)',
      accent: '#ff5167',
      gradient: 'linear-gradient(135deg, #ffb3b5 0%, #ff5167 100%)',
      accentText: 'text-gradient-primary'
    },
    midnight: {
      bg: '#0a0f1d',
      cardBg: 'rgba(56, 189, 248, 0.06)',
      border: 'rgba(56, 189, 248, 0.15)',
      accent: '#38bdf8',
      gradient: 'linear-gradient(135deg, #38bdf8 0%, #1e40af 100%)',
      accentText: 'text-gradient-secondary'
    }
  };

  function generateRecapData() {
    const history = (typeof Storage !== 'undefined' && Storage.getListeningHistory) ? Storage.getListeningHistory() : [];
    const recents = (typeof Storage !== 'undefined' && Storage.getRecent) ? Storage.getRecent() : [];
    const favorites = (typeof Storage !== 'undefined' && Storage.getFavorites) ? Storage.getFavorites() : [];
    const stats = (typeof Storage !== 'undefined' && Storage.getStats) ? Storage.getStats() : { totalSongsPlayed: 0 };
    const settings = (typeof Storage !== 'undefined' && Storage.getSettings) ? Storage.getSettings() : {};

    const allSessions = [...history, ...recents];

    let totalDurationSeconds = 0;
    const artistCounts = {};
    const artistImages = {};
    const songCounts = {};
    const songMap = {};
    const genreCounts = {};
    const uniqueArtists = new Set();

    // 1. Process all playback sessions
    allSessions.forEach(session => {
      const dur = parseInt(session.duration) || 180;
      totalDurationSeconds += dur;

      // Artist tracking
      let artistList = [];
      if (typeof session.artists === 'string') {
        artistList = session.artists.split(',').map(a => a.trim()).filter(Boolean);
      } else if (Array.isArray(session.artists)) {
        artistList = session.artists.map(a => typeof a === 'object' ? (a?.name || '') : String(a)).filter(Boolean);
      } else if (session.artist) {
        artistList = [session.artist];
      }

      artistList.forEach(a => {
        if (!a || a === 'Unknown' || a === '[object Object]') return;
        uniqueArtists.add(a);
        artistCounts[a] = (artistCounts[a] || 0) + 1;
        if (session.image && !artistImages[a] && !session.image.includes('[object Object]')) {
          artistImages[a] = session.image;
        }
      });

      // Song tracking
      const songKey = session.id || session.name;
      if (session.name && songKey) {
        songCounts[songKey] = (songCounts[songKey] || 0) + 1;
        if (!songMap[songKey]) {
          songMap[songKey] = session;
        }
      }

      // Genre/Language tracking
      const lang = (session.language || session.raw?.language || '').toLowerCase();
      if (lang && lang !== 'unknown') {
        genreCounts[lang] = (genreCounts[lang] || 0) + 1;
      }
    });

    // 2. Also factor in user favorites
    favorites.forEach(fav => {
      let favArtists = [];
      if (typeof fav.artists === 'string') {
        favArtists = fav.artists.split(',').map(a => a.trim()).filter(Boolean);
      } else if (Array.isArray(fav.artists)) {
        favArtists = fav.artists.map(a => typeof a === 'object' ? (a?.name || '') : String(a)).filter(Boolean);
      } else if (fav.artist) {
        favArtists = [fav.artist];
      }

      favArtists.forEach(a => {
        if (!a || a === 'Unknown' || a === '[object Object]') return;
        uniqueArtists.add(a);
        artistCounts[a] = (artistCounts[a] || 0) + 2; // Favorites give boost
        if (fav.image && !artistImages[a] && !fav.image.includes('[object Object]')) {
          artistImages[a] = fav.image;
        }
      });

      const songKey = fav.id || fav.name;
      if (fav.name && songKey) {
        songCounts[songKey] = (songCounts[songKey] || 0) + 2;
        if (!songMap[songKey]) {
          songMap[songKey] = fav;
        }
      }
    });

    // Top Artists Sorted by Real Plays & Favorites
    const topArtistList = Object.entries(artistCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, plays]) => ({
        name,
        plays,
        image: artistImages[name] || 'assets/logo.jpg'
      }));

    // Top Songs Sorted by Real Plays & Favorites
    const topSongList = Object.entries(songCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([key, plays]) => {
        const s = songMap[key] || {};
        return {
          id: s.id || key,
          name: s.name || 'Track',
          artist: s.artists || s.artist || 'Artist',
          image: s.image || 'assets/logo.jpg',
          streamUrl: s.streamUrl || s.audioUrl || '',
          plays
        };
      });

    // Real Minutes
    let displayMinutes = Math.round(totalDurationSeconds / 60);
    if (displayMinutes === 0 && topSongList.length > 0) {
      displayMinutes = Math.round(topSongList.length * 3.5);
    }

    const totalTracks = Math.max(stats.totalSongsPlayed || 0, allSessions.length, favorites.length);

    // Real Top Genre
    const GENRE_LABELS = {
      hindi: 'Bollywood / Hindi',
      punjabi: 'Punjabi Hits',
      english: 'Global Pop',
      tamil: 'Tamil Melodies',
      telugu: 'Telugu Hits',
      marathi: 'Marathi Hits',
      kannada: 'Kannada Hits',
      malayalam: 'Malayalam Hits',
      bhojpuri: 'Bhojpuri Hits'
    };

    let topGenre = 'Pop / Mixed Hits';
    let genrePercent = 65;
    const sortedGenres = Object.entries(genreCounts).sort((a, b) => b[1] - a[1]);
    if (sortedGenres.length > 0) {
      const topKey = sortedGenres[0][0];
      topGenre = GENRE_LABELS[topKey] || `${topKey.toUpperCase()} Hits`;
      const totalGenreCount = sortedGenres.reduce((acc, curr) => acc + curr[1], 0);
      genrePercent = Math.min(95, Math.max(35, Math.round((sortedGenres[0][1] / totalGenreCount) * 100)));
    } else if (Array.isArray(settings.languages) && settings.languages.length > 0) {
      topGenre = GENRE_LABELS[settings.languages[0]] || `${settings.languages[0].toUpperCase()} Hits`;
      genrePercent = 70;
    }

    // Real 7-Day Daily Breakdown from timestamps
    const dailyMins = [0, 0, 0, 0, 0, 0, 0]; // Mon, Tue, Wed, Thu, Fri, Sat, Sun
    const DAY_NAMES = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

    if (history.length > 0) {
      history.forEach(session => {
        if (session.playedAt) {
          const d = new Date(session.playedAt);
          const dayIndex = (d.getDay() + 6) % 7; // Mon=0 .. Sun=6
          const mins = Math.max(1, Math.round((parseInt(session.duration) || 180) / 60));
          dailyMins[dayIndex] += mins;
        }
      });
    } else if (displayMinutes > 0) {
      // If user has plays without individual timestamps, spread across active days
      const currentDay = (new Date().getDay() + 6) % 7;
      dailyMins[currentDay] = displayMinutes;
    }

    let maxDaily = Math.max(...dailyMins);
    if (maxDaily === 0) {
      maxDaily = 1;
    }

    const peakIndex = dailyMins.indexOf(Math.max(...dailyMins));
    const peakDay = DAY_NAMES[peakIndex];
    const peakMins = dailyMins[peakIndex];

    return {
      hasData: totalTracks > 0 || topSongList.length > 0,
      totalMinutes: displayMinutes,
      totalSongs: totalTracks,
      newArtists: Math.max(uniqueArtists.size, topArtistList.length),
      topGenre,
      genrePercent,
      topArtists: topArtistList,
      topSongs: topSongList,
      topSong: topSongList[0]?.name || 'Favorite Track',
      dailyBreakdown: dailyMins,
      maxDaily,
      peakDay,
      peakMins
    };
  }

  function renderRecap(container) {
    if (!container) return;
    const data = generateRecapData();
    const theme = THEME_STYLES[currentRecapTheme] || THEME_STYLES.charcoal;

    if (!data.hasData) {
      container.innerHTML = `
        <div class="recap-suite-wrapper" style="width: 100%; max-width: 800px; margin: 0 auto; padding: 48px 16px 120px; text-align: center;">
          <div style="background: ${theme.cardBg}; border: 1px solid ${theme.border}; border-radius: 24px; padding: 48px 24px; backdrop-filter: blur(24px);">
            <div style="width: 80px; height: 80px; border-radius: 50%; background: ${theme.gradient}; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; box-shadow: 0 8px 30px rgba(0, 241, 254, 0.35);">
              <span class="material-symbols-outlined" style="font-size: 40px; color: #000;">insights</span>
            </div>
            <h1 style="font-family: var(--font-heading); font-size: 28px; font-weight: 800; color: #fff; margin: 0 0 10px 0;">Your Music Story Awaits</h1>
            <p style="font-size: 15px; color: #9ca3af; max-width: 480px; margin: 0 auto 24px; line-height: 1.5;">
              As you stream tracks and build your favorites on MusicFlow, your live 7-day breakdown, top artist charts, and listening analytics will appear here automatically!
            </p>
            <button id="btn-recap-explore" style="padding: 12px 28px; border-radius: 999px; font-size: 15px; font-weight: 700; background: ${theme.gradient}; color: #000; border: none; cursor: pointer; box-shadow: 0 4px 20px rgba(0, 241, 254, 0.4);">
              Explore Trending Music
            </button>
          </div>
        </div>
      `;

      container.querySelector('#btn-recap-explore')?.addEventListener('click', () => {
        document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
        document.querySelector('.nav-item[data-page="page-home"]')?.classList.add('active');
        if (typeof UI !== 'undefined' && UI.showPage) UI.showPage('page-home');
        history.pushState({ type: 'page', pageId: 'page-home' }, '', '#home');
      });
      return;
    }

    container.innerHTML = `
      <div class="recap-suite-wrapper" style="width: 100%; max-width: 1100px; margin: 0 auto; padding: 24px 16px 120px; text-align: left;">
        
        <!-- Header & Theme Switcher -->
        <header style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 16px; margin-bottom: 28px;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
              <span class="material-symbols-outlined" style="font-size: 22px; color: ${theme.accent};">insights</span>
              <span style="font-size: 13px; font-weight: 700; color: ${theme.accent}; letter-spacing: 1px; text-transform: uppercase;">Weekly Recap</span>
            </div>
            <h1 style="font-family: var(--font-heading); font-size: 36px; font-weight: 800; color: #fff; margin: 0; line-height: 1.1;">Your Music Story</h1>
            <p style="font-size: 14px; color: #9ca3af; margin: 4px 0 0 0;">Last 7 Days • Real-Time Personalized Listening Breakdown</p>
          </div>

          <!-- Actions & Theme Switcher -->
          <div style="display: flex; align-items: center; gap: 10px;">
            <!-- Theme Buttons -->
            <div class="recap-theme-selector" style="display: flex; background: rgba(255, 255, 255, 0.06); padding: 4px; border-radius: 999px; border: 1px solid rgba(255, 255, 255, 0.1);">
              <button class="recap-theme-btn ${currentRecapTheme === 'charcoal' ? 'active' : ''}" data-theme="charcoal" title="Charcoal" style="padding: 6px 12px; border-radius: 999px; font-size: 12px; font-weight: 600; background: ${currentRecapTheme === 'charcoal' ? '#222' : 'transparent'}; color: ${currentRecapTheme === 'charcoal' ? '#00f1fe' : '#9ca3af'}; border: none; cursor: pointer;">🌑 Charcoal</button>
              <button class="recap-theme-btn ${currentRecapTheme === 'plum' ? 'active' : ''}" data-theme="plum" title="Dark Plum" style="padding: 6px 12px; border-radius: 999px; font-size: 12px; font-weight: 600; background: ${currentRecapTheme === 'plum' ? '#331020' : 'transparent'}; color: ${currentRecapTheme === 'plum' ? '#ff5167' : '#9ca3af'}; border: none; cursor: pointer;">🍇 Plum</button>
              <button class="recap-theme-btn ${currentRecapTheme === 'midnight' ? 'active' : ''}" data-theme="midnight" title="Midnight Blue" style="padding: 6px 12px; border-radius: 999px; font-size: 12px; font-weight: 600; background: ${currentRecapTheme === 'midnight' ? '#10203e' : 'transparent'}; color: ${currentRecapTheme === 'midnight' ? '#38bdf8' : '#9ca3af'}; border: none; cursor: pointer;">🌌 Midnight</button>
            </div>

            <!-- Social Share Button -->
            <button id="btn-open-story-share" class="btn-primary" style="display: flex; align-items: center; gap: 6px; padding: 8px 18px; border-radius: 999px; font-size: 13px; font-weight: 700; background: ${theme.gradient}; color: #000; border: none; cursor: pointer; box-shadow: 0 4px 16px rgba(0,0,0,0.3);">
              <span class="material-symbols-outlined" style="font-size: 18px;">share</span>
              <span>Story Card</span>
            </button>
          </div>
        </header>

        <!-- Bento Grid Section -->
        <div class="recap-bento-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; margin-bottom: 24px;">
          
          <!-- 1. Total Listening Time Card -->
          <div class="recap-bento-card" style="background: ${theme.cardBg}; border: 1px solid ${theme.border}; backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); border-radius: 20px; padding: 24px; position: relative; overflow: hidden; display: flex; flex-direction: column; justify-content: space-between; min-height: 180px;">
            <div style="position: absolute; right: -10px; top: -10px; opacity: 0.08; pointer-events: none;">
              <span class="material-symbols-outlined" style="font-size: 140px; color: ${theme.accent};">schedule</span>
            </div>
            <div>
              <span style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af;">Total Listening Time</span>
              <div style="font-family: var(--font-heading); font-size: 44px; font-weight: 800; color: #fff; margin-top: 6px; line-height: 1;">
                <span style="background: ${theme.gradient}; -webkit-background-clip: text; -webkit-text-fill-color: transparent;">${data.totalMinutes.toLocaleString()}</span>
                <span style="font-size: 18px; color: #9ca3af; font-weight: 500;">mins</span>
              </div>
            </div>
            <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 16px;">
              <span style="font-size: 13px; color: #34d399; font-weight: 600; display: flex; align-items: center; gap: 4px;">
                <span class="material-symbols-outlined" style="font-size: 16px;">trending_up</span> Live Active Catalog
              </span>
              <span style="font-size: 12px; color: #9ca3af;">${data.totalSongs} ${data.totalSongs === 1 ? 'track' : 'tracks'} in story</span>
            </div>
          </div>

          <!-- 2. Top Genre & Discovery Stats Card -->
          <div class="recap-bento-card" style="background: ${theme.cardBg}; border: 1px solid ${theme.border}; backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); border-radius: 20px; padding: 24px; display: grid; grid-template-columns: 1fr 1fr; gap: 16px; min-height: 180px;">
            <div style="display: flex; flex-direction: column; justify-content: space-between; border-right: 1px solid rgba(255,255,255,0.06); padding-right: 12px;">
              <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af;">Top Genre</span>
              <div>
                <h3 style="font-family: var(--font-heading); font-size: 18px; font-weight: 700; color: #fff; margin: 4px 0 0 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${data.topGenre}</h3>
                <span style="font-size: 12px; color: ${theme.accent};">${data.genrePercent}% of your mix</span>
              </div>
              <span class="material-symbols-outlined" style="font-size: 26px; color: ${theme.accent}; opacity: 0.7;">graphic_eq</span>
            </div>

            <div style="display: flex; flex-direction: column; justify-content: space-between; padding-left: 4px;">
              <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af;">Artists In Mix</span>
              <div>
                <h3 style="font-family: var(--font-heading); font-size: 28px; font-weight: 800; color: #fff; margin: 4px 0 0 0;">${data.newArtists}</h3>
                <span style="font-size: 12px; color: #9ca3af;">Discovered</span>
              </div>
              <span class="material-symbols-outlined" style="font-size: 26px; color: #9ca3af; opacity: 0.7;">person_add</span>
            </div>
          </div>

        </div>

        <!-- 3. Daily Breakdown 7-Day Bar Chart -->
        <div class="recap-chart-card" style="background: ${theme.cardBg}; border: 1px solid ${theme.border}; backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); border-radius: 20px; padding: 24px; margin-bottom: 24px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <div>
              <h3 style="font-family: var(--font-heading); font-size: 18px; font-weight: 700; color: #fff; margin: 0;">Daily Listening Breakdown</h3>
              <p style="font-size: 12px; color: #9ca3af; margin: 2px 0 0 0;">Live minutes streamed per day</p>
            </div>
            <span style="font-family: var(--font-mono, monospace); font-size: 12px; color: ${theme.accent}; font-weight: 700;">PEAK: ${data.peakDay} (${data.peakMins}m)</span>
          </div>

          <!-- Chart Bars -->
          <div class="recap-bars-container" style="display: flex; align-items: flex-end; justify-content: space-between; height: 160px; gap: 12px; padding: 0 8px;">
            ${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => {
              const mins = data.dailyBreakdown[i] || 0;
              const heightPct = Math.max(8, Math.round((mins / data.maxDaily) * 100));
              const isPeak = mins > 0 && mins === data.maxDaily;
              return `
                <div class="recap-bar-col" style="flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; justify-content: flex-end; position: relative; group">
                  <div class="recap-bar-tooltip" style="position: absolute; bottom: calc(${heightPct}% + 8px); background: #222; border: 1px solid rgba(255,255,255,0.2); padding: 2px 6px; border-radius: 6px; font-size: 11px; font-weight: 700; color: #fff; white-space: nowrap; pointer-events: none; opacity: ${isPeak ? '1' : '0.8'};">
                    ${mins}m
                  </div>
                  <div class="recap-bar-fill" style="width: 100%; max-width: 44px; height: ${heightPct}%; border-radius: 8px 8px 3px 3px; background: ${isPeak ? theme.gradient : 'rgba(255,255,255,0.12)'}; transition: height 0.4s ease, background 0.2s ease; cursor: pointer;"></div>
                  <span style="font-size: 12px; font-weight: 600; color: ${isPeak ? theme.accent : '#9ca3af'}; margin-top: 8px;">${day[0]}</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- 4. Top 5 Artists Leaderboard & Top 5 Tracks Split Grid -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 20px;">
          
          <!-- Top 5 Artists List -->
          <div class="recap-artists-card" style="background: ${theme.cardBg}; border: 1px solid ${theme.border}; backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); border-radius: 20px; padding: 24px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px;">
              <h3 style="font-family: var(--font-heading); font-size: 18px; font-weight: 700; color: #fff; margin: 0;">Top 5 Artists</h3>
              <span style="font-size: 12px; color: #9ca3af;">Ranked</span>
            </div>

            <div style="display: flex; flex-direction: column; gap: 14px;">
              ${data.topArtists.map((artist, idx) => `
                <div class="recap-artist-row" style="display: flex; align-items: center; justify-content: space-between; padding: 6px 8px; border-radius: 12px; transition: background 0.2s;">
                  <div style="display: flex; align-items: center; gap: 12px;">
                    <span style="font-family: var(--font-mono, monospace); font-size: 14px; font-weight: 700; color: ${idx === 0 ? theme.accent : '#6b7280'}; width: 16px;">#${idx + 1}</span>
                    <div style="width: 44px; height: 44px; border-radius: 50%; overflow: hidden; border: 2px solid ${idx === 0 ? theme.accent : 'rgba(255,255,255,0.1)'}; flex-shrink: 0;">
                      <img src="${artist.image}" alt="${artist.name}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='assets/logo.jpg'">
                    </div>
                    <div>
                      <h4 style="font-family: var(--font-heading); font-size: 15px; font-weight: 600; color: #fff; margin: 0;">${artist.name}</h4>
                      <span style="font-size: 12px; color: #9ca3af;">Heavy Rotation</span>
                    </div>
                  </div>
                  <span style="font-family: var(--font-mono, monospace); font-size: 12px; font-weight: 600; color: ${theme.accent}; background: rgba(255,255,255,0.06); padding: 4px 10px; border-radius: 999px;">${artist.plays} plays</span>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Top 5 Tracks Countdown -->
          <div class="recap-tracks-card" style="background: ${theme.cardBg}; border: 1px solid ${theme.border}; backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); border-radius: 20px; padding: 24px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px;">
              <h3 style="font-family: var(--font-heading); font-size: 18px; font-weight: 700; color: #fff; margin: 0;">Top Tracks</h3>
              <span style="font-size: 12px; color: #9ca3af;">Most Streamed</span>
            </div>

            <div style="display: flex; flex-direction: column; gap: 12px;" id="recap-top-tracks-list">
              ${data.topSongs.map((track, idx) => `
                <div class="recap-track-row library-song-row" data-song-id="${track.id}" data-index="${idx}" style="display: flex; align-items: center; gap: 12px; padding: 8px; border-radius: 12px; cursor: pointer; transition: background 0.2s;">
                  <span style="font-family: var(--font-mono, monospace); font-size: 14px; font-weight: 700; color: ${idx === 0 ? theme.accent : '#6b7280'}; width: 16px;">${idx + 1}</span>
                  <img src="${track.image}" alt="${track.name}" style="width: 44px; height: 44px; border-radius: 8px; object-fit: cover; flex-shrink: 0;" onerror="this.src='assets/logo.jpg'">
                  <div style="flex: 1; min-width: 0;">
                    <h4 style="font-family: var(--font-heading); font-size: 14px; font-weight: 600; color: #fff; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${track.name}</h4>
                    <p style="font-size: 12px; color: #9ca3af; margin: 2px 0 0 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${track.artist}</p>
                  </div>
                  <button class="btn-play-recap-track" data-index="${idx}" title="Play Track" style="width: 34px; height: 34px; border-radius: 50%; background: ${theme.gradient}; border: none; display: flex; align-items: center; justify-content: center; color: #000; cursor: pointer; flex-shrink: 0;">
                    <span class="material-symbols-outlined" style="font-size: 18px; font-variation-settings: 'FILL' 1;">play_arrow</span>
                  </button>
                </div>
              `).join('')}
            </div>
          </div>

        </div>

      </div>

      <!-- 9:16 Social Story Share Modal -->
      <div id="recap-story-modal" class="modal-overlay hidden" style="position: fixed; inset: 0; background: rgba(0,0,0,0.85); backdrop-filter: blur(20px); z-index: 9999; display: none; align-items: center; justify-content: center; padding: 16px;">
        <div class="story-modal-inner" style="position: relative; width: 100%; max-width: 360px; aspect-ratio: 9/16; max-height: 90vh; border-radius: 28px; overflow: hidden; box-shadow: 0 24px 60px rgba(0,0,0,0.9); border: 1px solid rgba(255,255,255,0.15); display: flex; flex-direction: column; background: ${theme.gradient}; color: #fff; padding: 28px 24px;">
          
          <!-- Close Button -->
          <button id="btn-close-story-modal" style="position: absolute; top: 16px; right: 16px; width: 32px; height: 32px; border-radius: 50%; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.2); color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 20;">
            <span class="material-symbols-outlined" style="font-size: 18px;">close</span>
          </button>

          <!-- Top Brand Badge -->
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 20px;">
            <div style="width: 28px; height: 28px; border-radius: 50%; background: #000; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 14px; color: #fff;">M</div>
            <span style="font-family: var(--font-heading); font-size: 18px; font-weight: 800; letter-spacing: 0.5px; color: #000;">MusicFlow Recap</span>
          </div>

          <!-- Story Body Stats -->
          <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 24px; text-align: center;">
            <div>
              <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: rgba(0,0,0,0.6);">Time Spent Listening</span>
              <div style="font-family: var(--font-heading); font-size: 54px; font-weight: 900; line-height: 1; color: #000; margin: 4px 0;">${data.totalMinutes}</div>
              <span style="font-size: 14px; font-weight: 700; color: rgba(0,0,0,0.7);">minutes this week</span>
            </div>

            <!-- Top Genre Card -->
            <div style="background: rgba(0,0,0,0.25); backdrop-filter: blur(12px); padding: 12px 16px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.2);">
              <span style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #fff; opacity: 0.8;">TOP GENRE</span>
              <h3 style="font-family: var(--font-heading); font-size: 20px; font-weight: 800; color: #fff; margin: 2px 0 0 0;">${data.topGenre}</h3>
            </div>

            <!-- Top Artists Pill Stack -->
            <div style="background: rgba(0,0,0,0.25); backdrop-filter: blur(12px); padding: 14px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.2); text-align: left;">
              <span style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #fff; opacity: 0.8; margin-bottom: 6px; display: block;">TOP ARTISTS</span>
              <div style="display: flex; flex-direction: column; gap: 6px;">
                ${data.topArtists.slice(0, 3).map((a, i) => `
                  <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 700; color: #fff;">
                    <span>#${i + 1} ${a.name}</span>
                    <span style="opacity: 0.8;">${a.plays} plays</span>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>

          <!-- Bottom Footer Watermark & Share Actions -->
          <div style="display: flex; gap: 10px; margin-top: 16px;">
            <button id="btn-share-social-native" style="flex: 1; padding: 12px; border-radius: 999px; background: #000; color: #fff; font-size: 13px; font-weight: 700; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;">
              <span class="material-symbols-outlined" style="font-size: 18px;">share</span> Share Story
            </button>
            <button id="btn-copy-recap-text" style="padding: 12px 16px; border-radius: 999px; background: rgba(0,0,0,0.3); color: #fff; font-size: 13px; font-weight: 700; border: 1px solid rgba(255,255,255,0.2); cursor: pointer;">
              Copy
            </button>
          </div>

        </div>
      </div>
    `;

    bindRecapEvents(container, data);
  }

  function bindRecapEvents(container, data) {
    if (!container || typeof container.querySelectorAll !== 'function') return;

    // 1. Theme switchers
    container.querySelectorAll('.recap-theme-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        currentRecapTheme = btn.dataset.theme || 'charcoal';
        renderRecap(container);
        if (typeof Haptics !== 'undefined' && Haptics.selection) Haptics.selection();
      });
    });

    // 2. Story Modal triggers
    const storyModal = container.querySelector('#recap-story-modal');
    const openBtn = container.querySelector('#btn-open-story-share');
    const closeBtn = container.querySelector('#btn-close-story-modal');

    if (openBtn && storyModal) {
      openBtn.addEventListener('click', () => {
        storyModal.style.display = 'flex';
        if (typeof Haptics !== 'undefined' && Haptics.medium) Haptics.medium();
      });
    }

    if (closeBtn && storyModal) {
      closeBtn.addEventListener('click', () => {
        storyModal.style.display = 'none';
        if (typeof Haptics !== 'undefined' && Haptics.light) Haptics.light();
      });
    }

    // 3. Play track from top songs countdown
    container.querySelectorAll('.recap-track-row').forEach(row => {
      row.addEventListener('click', (e) => {
        const idx = parseInt(row.dataset.index, 10);
        const song = data.topSongs[idx];
        if (song && typeof Player !== 'undefined' && Player.playSong) {
          Player.setQueue(data.topSongs, idx);
          Player.playSong(song);
          if (typeof Haptics !== 'undefined' && Haptics.medium) Haptics.medium();
        }
      });
    });

    // 4. Native share story
    container.querySelector('#btn-share-social-native')?.addEventListener('click', () => {
      const shareText = `🎵 My MusicFlow Weekly Recap:\n⏱️ ${data.totalMinutes} mins listened\n🎸 Top Genre: ${data.topGenre}\n👑 Top Artist: ${data.topArtists[0]?.name}\n✨ Discover yours on MusicFlow!`;
      if (typeof navigator !== 'undefined' && navigator.share) {
        navigator.share({
          title: 'My MusicFlow Weekly Recap',
          text: shareText,
          url: window.location.href
        }).catch(() => {});
      } else {
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
          navigator.clipboard.writeText(shareText);
          if (typeof UI !== 'undefined' && UI.showToast) {
            UI.showToast('Recap story summary copied to clipboard! 📋', 'success');
          }
        }
      }
      if (typeof Haptics !== 'undefined' && Haptics.success) Haptics.success();
    });

    // 5. Copy recap summary
    container.querySelector('#btn-copy-recap-text')?.addEventListener('click', () => {
      const shareText = `🎵 My MusicFlow Weekly Recap:\n⏱️ ${data.totalMinutes} mins listened\n🎸 Top Genre: ${data.topGenre}\n👑 Top Artist: ${data.topArtists[0]?.name}\n✨ Check it out on MusicFlow!`;
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(shareText);
        if (typeof UI !== 'undefined' && UI.showToast) {
          UI.showToast('Recap summary copied to clipboard! 📋', 'success');
        }
      }
      if (typeof Haptics !== 'undefined' && Haptics.selection) Haptics.selection();
    });
  }

  return {
    generateRecapData,
    renderRecap
  };
})();

// Export globally and for module environments
if (typeof window !== 'undefined') {
  window.Recap = Recap;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Recap;
}


if (typeof window !== "undefined") window.Recap = Recap;
