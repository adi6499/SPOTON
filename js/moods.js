// ========================================
// MusicFlow — Mood & Activity Filters Engine
// ========================================

const Moods = (() => {
  const MOOD_CONFIG = {
    all: {
      id: 'all',
      label: 'All',
      icon: '✨',
      isDefault: true
    },
    new_releases: {
      id: 'new_releases',
      label: 'New Release',
      icon: '🚀',
      gradient: 'linear-gradient(135deg, #FA2D48, #FF5E7E)',
      queries: [
        { title: 'Fresh New Releases', query: 'latest release hot tracks', type: 'song' },
        { title: 'Brand New Singles', query: 'latest new hit singles', type: 'song' },
        { title: 'New Albums & EPs', query: 'latest album release songs', type: 'song' }
      ]
    },
    trending: {
      id: 'trending',
      label: 'Trending',
      icon: '🔥',
      gradient: 'linear-gradient(135deg, #FF416C, #FF4B2B)',
      queries: [
        { title: 'Trending Global Chartbusters', query: 'top trending music hits', type: 'song' },
        { title: 'Viral Music Right Now', query: 'viral trending social hits', type: 'song' },
        { title: 'High Velocity Streams', query: 'most streamed trending songs', type: 'song' }
      ]
    },
    top: {
      id: 'top',
      label: 'Top Charts',
      icon: '🏆',
      gradient: 'linear-gradient(135deg, #f857a6, #ff5858)',
      queries: [
        { title: 'Top 50 Global Hits', query: 'top global 50 billboard hits', type: 'song' },
        { title: 'All-Time Greatest Chartbusters', query: 'mega chartbusters top hits', type: 'song' }
      ]
    },
    relax: {
      id: 'relax',
      label: 'Relax',
      icon: '☕',
      gradient: 'linear-gradient(135deg, #1fa2ff, #12d8fa)',
      queries: [
        { title: 'Chill Quick Picks', query: 'chill acoustic relax hits', type: 'song' },
        { title: 'Peaceful Acoustic & Lo-Fi', query: 'lo-fi chillhop acoustic vibes', type: 'song' },
        { title: 'Calm Piano & Ambient Nights', query: 'peaceful piano ambient relaxation', type: 'song' },
        { title: 'Soothing Evening Melodies', query: 'soft indie acoustic relaxation', type: 'song' }
      ]
    },
    energise: {
      id: 'energise',
      label: 'Energise',
      icon: '🔥',
      gradient: 'linear-gradient(135deg, #FF416C, #FF4B2B)',
      queries: [
        { title: 'Instant Energy Boosters', query: 'supercharged high energy pop hits', type: 'song' },
        { title: 'High Octane EDM Bangers', query: 'high energy edm festival bangers', type: 'song' },
        { title: 'Uplifting Chartbusters', query: 'uplifting motivational top hits', type: 'song' },
        { title: 'Bass Boosted Power', query: 'bass boosted electronic hype', type: 'song' }
      ]
    },
    workout: {
      id: 'workout',
      label: 'Workout',
      icon: '⚡',
      gradient: 'linear-gradient(135deg, #f857a6, #ff5858)',
      queries: [
        { title: 'Gym Workout Quick Picks', query: 'gym workout pump hits', type: 'song' },
        { title: 'Hardstyle & Drift Phonk', query: 'phonk drift high energy gym', type: 'song' },
        { title: 'High BPM Cardio & Running', query: 'motivational running cardio beats', type: 'song' },
        { title: 'Hype Hip-Hop & Rap', query: 'banger hip hop hype workout', type: 'song' }
      ]
    },
    focus: {
      id: 'focus',
      label: 'Focus',
      icon: '🎯',
      gradient: 'linear-gradient(135deg, #38ef7d, #11998e)',
      queries: [
        { title: 'Deep Work Flow', query: 'deep focus electronic instrumental', type: 'song' },
        { title: 'Synthwave & Coding Beats', query: 'braindance synthwave chillwave', type: 'song' },
        { title: 'Lo-Fi Study Beats', query: 'lo-fi sleep study instrumental', type: 'song' },
        { title: 'Instrumental Ambient Flow', query: 'instrumental study flow calm', type: 'song' }
      ]
    },
    romance: {
      id: 'romance',
      label: 'Romance',
      icon: '💖',
      gradient: 'linear-gradient(135deg, #b224ef, #7579ff)',
      queries: [
        { title: 'Romantic Quick Picks', query: 'romantic love hits', type: 'song' },
        { title: 'Soulful Bollywood Ballads', query: 'bollywood romantic superhits', type: 'song' },
        { title: 'Late Night Love Songs', query: 'monsoon romantic love acoustic', type: 'song' },
        { title: 'R&B & Acoustic Romance', query: 'r&b love acoustic ballads', type: 'song' }
      ]
    },
    party: {
      id: 'party',
      label: 'Party',
      icon: '🎉',
      gradient: 'linear-gradient(135deg, #8E2DE2, #4A00E0)',
      queries: [
        { title: 'Party Quick Picks', query: 'club dance party hits', type: 'song' },
        { title: 'Weekend Club Anthems', query: 'dance pop party chartbusters', type: 'song' },
        { title: 'Punjabi Club Banger Drops', query: 'punjabi pop top hits dance', type: 'song' },
        { title: 'Remix Mashups & Drops', query: 'remix mashup banger party hits', type: 'song' }
      ]
    },
    sad: {
      id: 'sad',
      label: 'Sad',
      icon: '🌧️',
      gradient: 'linear-gradient(135deg, #141E30, #243B55)',
      queries: [
        { title: 'Heartbreak & Melancholy', query: 'sad emotional songs', type: 'song' },
        { title: 'Slow Acoustic Heartstrings', query: 'emotional piano acoustic sad hits', type: 'song' },
        { title: 'Late Night Feelings', query: 'late night sad vibes acoustic', type: 'song' },
        { title: 'Deep Melancholic Ballads', query: 'slow sad indie melodies', type: 'song' }
      ]
    },
    sleep: {
      id: 'sleep',
      label: 'Sleep',
      icon: '🌙',
      gradient: 'linear-gradient(135deg, #0F2027, #203A43, #2C5364)',
      queries: [
        { title: 'Bedtime Ambient Soundscapes', query: 'ambient sleep soundscape calm', type: 'song' },
        { title: 'Soft Piano For Sleeping', query: 'soft peaceful piano bedtime', type: 'song' },
        { title: 'Delta Wave & Rain Beats', query: 'rain sounds lofi sleep', type: 'song' },
        { title: 'Gentle Acoustic Lullabies', query: 'peaceful night acoustic calm', type: 'song' }
      ]
    },
    commute: {
      id: 'commute',
      label: 'Commute',
      icon: '🚗',
      gradient: 'linear-gradient(135deg, #F3904F, #3B4371)',
      queries: [
        { title: 'Road Trip Singalongs', query: 'feel good road trip pop hits', type: 'song' },
        { title: 'Highway Cruise Beats', query: 'upbeat driving songs indie', type: 'song' },
        { title: 'Morning Transit Energy', query: 'morning acoustic pop commute', type: 'song' },
        { title: 'Vibrant Car Tunes', query: 'upbeat car tunes international hits', type: 'song' }
      ]
    }
  };

  let activeMoodId = 'all';

  function getMoodList() {
    return Object.values(MOOD_CONFIG);
  }

  function getActiveMood() {
    return activeMoodId;
  }

  async function setMood(moodId) {
    if (activeMoodId === moodId && moodId !== 'all') {
      // Toggle off if already active
      return setMood('all');
    }

    activeMoodId = moodId || 'all';
    
    // Update chip active states in UI
    UI.updateMoodChipsActive(activeMoodId);

    const homeContent = document.getElementById('home-feed-sections');
    const heroSection = document.getElementById('hero-section');
    const quickPicksSection = document.getElementById('quick-picks-section');
    const mixSuiteSection = document.getElementById('mix-suite-section');
    const defaultShelves = document.getElementById('default-home-shelves');

    if (!homeContent) return;

    if (activeMoodId === 'all') {
      // Restore standard home feed
      if (heroSection) heroSection.style.display = '';
      if (quickPicksSection) quickPicksSection.style.display = '';
      if (mixSuiteSection) mixSuiteSection.style.display = '';
      if (defaultShelves) defaultShelves.style.display = '';
      
      const moodCustomContainer = document.getElementById('mood-custom-feed');
      if (moodCustomContainer) moodCustomContainer.innerHTML = '';
      return;
    }

    // Hide standard shelves during active mood
    if (heroSection) heroSection.style.display = 'none';
    if (defaultShelves) defaultShelves.style.display = 'none';
    if (mixSuiteSection) mixSuiteSection.style.display = 'none';

    // Show mood feed loader
    let moodCustomContainer = document.getElementById('mood-custom-feed');
    if (!moodCustomContainer) {
      moodCustomContainer = document.createElement('div');
      moodCustomContainer.id = 'mood-custom-feed';
      homeContent.insertBefore(moodCustomContainer, defaultShelves);
    }

    const config = MOOD_CONFIG[activeMoodId];
    if (!config) return;

    moodCustomContainer.innerHTML = `
      <div class="mood-feed-header" style="background: ${config.gradient || 'var(--bg-surface)'}">
        <div class="mood-feed-badge">${config.icon} ${config.label} Mood</div>
        <h2 class="mood-feed-title">${config.label} Experience</h2>
        <p class="mood-feed-subtitle">Curated tracks & dynamic mixes tailored for your ${config.label.toLowerCase()} moments.</p>
        <button class="btn-clear-mood" id="btn-clear-mood" aria-label="Clear filter">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          Clear Mood Filter
        </button>
      </div>
      <div class="mood-shelves-container">
        ${config.queries.map((q, idx) => `
          <section class="shelf-section">
            <h2 class="shelf-title">${q.title}</h2>
            <div class="shelf-container" id="mood-shelf-${idx}">
              <div class="loading-shelf shimmer-card"></div>
              <div class="loading-shelf shimmer-card"></div>
              <div class="loading-shelf shimmer-card"></div>
              <div class="loading-shelf shimmer-card"></div>
            </div>
          </section>
        `).join('')}
      </div>
    `;

    document.getElementById('btn-clear-mood')?.addEventListener('click', () => setMood('all'));

    // Automatically scroll to show the filtered results immediately so the user doesn't have to guess or manually scroll
    setTimeout(() => {
      const target = document.getElementById('mood-custom-feed') || homeContent;
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 120);
    if (typeof Haptics !== 'undefined' && Haptics.selection) Haptics.selection();

    // Fetch queries in parallel
    const promises = config.queries.map(q => API.searchSongs(q.query, 25));
    const results = await Promise.allSettled(promises);

    results.forEach((res, idx) => {
      const shelfEl = document.getElementById(`mood-shelf-${idx}`);
      if (!shelfEl) return;

      if (res.status === 'fulfilled' && Array.isArray(res.value) && res.value.length > 0) {
        const normSongs = res.value.map(API.normalizeSong);
        UI.renderShelf(normSongs, shelfEl, 'song');
        if (window.App && window.App.bindSongCardEvents) {
          window.App.bindSongCardEvents(shelfEl, normSongs);
        }
      } else {
        if (shelfEl.parentElement) shelfEl.parentElement.style.display = 'none';
      }
    });
  }

  return {
    MOOD_CONFIG,
    getMoodList,
    getActiveMood,
    setMood,
    applyMoodFilter: setMood
  };
})();

window.Moods = Moods;
window.applyMoodFilter = (moodId) => Moods.setMood(moodId);
