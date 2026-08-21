// ========================================
// MusicFlow — Regional Language Hubs Engine
// ========================================

const LanguageHubs = (() => {
  const REGIONAL_LANGUAGES = [
    {
      id: 'hindi',
      name: 'Hindi',
      script: 'हिन्दी',
      icon: '🔥',
      gradient: 'linear-gradient(135deg, #FF416C, #FF4B2B)',
      tagline: 'Bollywood Superhits, Hindi Pop, & Soulful Melodies',
      queries: {
        topHits: 'top 50 hindi hits chartbusters 2026',
        newReleases: 'latest hindi songs new releases',
        viral: 'viral hindi reels trending hits',
        albums: 'top bollywood movie soundtrack albums',
        artists: 'top hindi playback singers arijit'
      }
    },
    {
      id: 'punjabi',
      name: 'Punjabi',
      script: 'ਪੰਜਾਬੀ',
      icon: '⚡',
      gradient: 'linear-gradient(135deg, #F7971E, #FFD200)',
      tagline: 'High Octane Punjabi Pop, Bhangra & Banger Hits',
      queries: {
        topHits: 'top 50 punjabi hits 2026',
        newReleases: 'latest punjabi songs new releases',
        viral: 'viral punjabi pop banger hits',
        albums: 'trending punjabi albums',
        artists: 'top punjabi singers karan aujla sidhu diljit'
      }
    },
    {
      id: 'tamil',
      name: 'Tamil',
      script: 'தமிழ்',
      icon: '🎵',
      gradient: 'linear-gradient(135deg, #8E2DE2, #4A00E0)',
      tagline: 'Kollywood Soundtracks, Anirudh Bangers & Tamil Melodies',
      queries: {
        topHits: 'top 50 tamil songs superhits 2026',
        newReleases: 'latest tamil songs new releases',
        viral: 'viral tamil kuthu dance hits',
        albums: 'blockbuster tamil movie albums',
        artists: 'top tamil singers anirudh ar rahman'
      }
    },
    {
      id: 'telugu',
      name: 'Telugu',
      script: 'తెలుగు',
      icon: '🌟',
      gradient: 'linear-gradient(135deg, #00B4DB, #0083B0)',
      tagline: 'Tollywood Mass Beats, Romantic Hits & Chartbusters',
      queries: {
        topHits: 'top 50 telugu hits 2026',
        newReleases: 'latest telugu songs new releases',
        viral: 'viral telugu dance mass hits',
        albums: 'trending telugu movie albums',
        artists: 'top telugu singers sid sriram dsp thaman'
      }
    },
    {
      id: 'malayalam',
      name: 'Malayalam',
      script: 'മലയാളം',
      icon: '🌿',
      gradient: 'linear-gradient(135deg, #11998E, #38EF7D)',
      tagline: 'Mollywood Melodies, Indie Malayalam & Soul Vibes',
      queries: {
        topHits: 'top 50 malayalam hits 2026',
        newReleases: 'latest malayalam songs new releases',
        viral: 'viral malayalam indie songs',
        albums: 'top malayalam movie albums',
        artists: 'top malayalam singers sushin shyam kshithij'
      }
    },
    {
      id: 'kannada',
      name: 'Kannada',
      script: 'ಕನ್ನಡ',
      icon: '💫',
      gradient: 'linear-gradient(135deg, #EB3349, #F45C43)',
      tagline: 'Sandalwood Superhits, Kannada Melodies & Beats',
      queries: {
        topHits: 'top 50 kannada hits 2026',
        newReleases: 'latest kannada songs new releases',
        viral: 'viral kannada trending hits',
        albums: 'top kannada soundtrack albums',
        artists: 'top kannada singers vijay prakash sanjith'
      }
    },
    {
      id: 'bengali',
      name: 'Bengali',
      script: 'বাংলা',
      icon: '🎨',
      gradient: 'linear-gradient(135deg, #4E54C8, #8F94FB)',
      tagline: 'Tollywood Bangla Hits, Modern Bengali & Folk Pop',
      queries: {
        topHits: 'top 50 bengali hits 2026',
        newReleases: 'latest bengali songs new releases',
        viral: 'viral bangla pop songs',
        albums: 'top bengali movie albums',
        artists: 'top bengali singers anupam arijit shreya'
      }
    },
    {
      id: 'bhojpuri',
      name: 'Bhojpuri',
      script: 'भोजपुरी',
      icon: '💥',
      gradient: 'linear-gradient(135deg, #FF512F, #DD2476)',
      tagline: 'Bhojpuri Wave, Festive Hits & Dance Bangers',
      queries: {
        topHits: 'top 50 bhojpuri superhits 2026',
        newReleases: 'latest bhojpuri songs new releases',
        viral: 'viral bhojpuri dance hits',
        albums: 'trending bhojpuri albums',
        artists: 'top bhojpuri singers pawan khesari'
      }
    },
    {
      id: 'english',
      name: 'English',
      script: 'Global',
      icon: '🌍',
      gradient: 'linear-gradient(135deg, #2C3E50, #3498DB)',
      tagline: 'Billboard Hot 100, Global Pop, Hip-Hop & EDM',
      queries: {
        topHits: 'billboard hot 100 top 50 global hits',
        newReleases: 'latest english pop songs 2026',
        viral: 'viral global tiktok hits 2026',
        albums: 'top studio albums pop hip hop',
        artists: 'popular global artists taylor the weeknd drake'
      }
    },
    {
      id: 'kpop',
      name: 'K-Pop',
      script: '한국어',
      icon: '💖',
      gradient: 'linear-gradient(135deg, #FF758C, #FF7EB3)',
      tagline: 'K-Pop Chartbusters, Korean OSTs & Idol Anthems',
      queries: {
        topHits: 'top 50 k-pop hits billboard',
        newReleases: 'latest kpop songs new releases',
        viral: 'viral k-pop dance challenge hits',
        albums: 'top kpop albums bts blackpink',
        artists: 'famous k-pop groups bts newjeans stray kids'
      }
    }
  ];

  function getLanguages() {
    return REGIONAL_LANGUAGES;
  }

  async function openLanguageHub(langId, pushHistory = true) {
    const lang = REGIONAL_LANGUAGES.find(l => l.id === langId) || REGIONAL_LANGUAGES[0];
    if (!lang) return;

    UI.showPage('page-language-hub');
    if (pushHistory) {
      history.pushState({ type: 'hub', langId: lang.id }, '', `#hub/${lang.id}`);
    }

    const hubHeader = document.getElementById('hub-header');
    const hubTitle = document.getElementById('hub-title');
    const hubScript = document.getElementById('hub-script');
    const hubTagline = document.getElementById('hub-tagline');
    const hubContent = document.getElementById('hub-content');

    if (hubHeader) hubHeader.style.background = lang.gradient;
    if (hubTitle) hubTitle.textContent = `${lang.name} Music Hub`;
    if (hubScript) hubScript.textContent = lang.script;
    if (hubTagline) hubTagline.textContent = lang.tagline;

    if (hubContent) {
      hubContent.innerHTML = `
        <section class="shelf-section"><h2 class="shelf-title">Top 50 ${lang.name} Hits</h2><div class="shelf-container" id="hub-shelf-topHits"><div class="loading-shelf shimmer-card"></div><div class="loading-shelf shimmer-card"></div><div class="loading-shelf shimmer-card"></div><div class="loading-shelf shimmer-card"></div></div></section>
        <section class="shelf-section"><h2 class="shelf-title">Fresh ${lang.name} Releases</h2><div class="shelf-container" id="hub-shelf-newReleases"><div class="loading-shelf"></div></div></section>
        <section class="shelf-section"><h2 class="shelf-title">Viral & Trending in ${lang.name}</h2><div class="shelf-container" id="hub-shelf-viral"><div class="loading-shelf"></div></div></section>
        <section class="shelf-section"><h2 class="shelf-title">Popular ${lang.name} Albums</h2><div class="shelf-container" id="hub-shelf-albums"><div class="loading-shelf"></div></div></section>
        <section class="shelf-section"><h2 class="shelf-title">Featured ${lang.name} Artists</h2><div class="shelf-container" id="hub-shelf-artists"><div class="loading-shelf"></div></div></section>
      `;
    }

    // Fetch hub categories in parallel
    const [topHits, newReleases, viral, albums, artists] = await Promise.allSettled([
      API.searchSongs(lang.queries.topHits, 30),
      API.searchSongs(lang.queries.newReleases, 25),
      API.searchSongs(lang.queries.viral, 25),
      API.searchAlbums(lang.queries.albums, 15),
      API.searchArtists(lang.queries.artists, 15)
    ]);

    // Render shelves
    const renderSection = (shelfId, result, type = 'song') => {
      const el = document.getElementById(shelfId);
      if (!el) return;
      if (result.status === 'fulfilled' && Array.isArray(result.value) && result.value.length > 0) {
        const items = type === 'song' ? result.value.map(API.normalizeSong) : result.value;
        UI.renderShelf(items, el, type);
        if (type === 'song' && window.App && window.App.bindSongCardEvents) {
          window.App.bindSongCardEvents(el, items);
        }
      } else {
        if (el.parentElement) el.parentElement.style.display = 'none';
      }
    };

    renderSection('hub-shelf-topHits', topHits, 'song');
    renderSection('hub-shelf-newReleases', newReleases, 'song');
    renderSection('hub-shelf-viral', viral, 'song');
    renderSection('hub-shelf-albums', albums, 'album');
    renderSection('hub-shelf-artists', artists, 'artist');
  }

  return {
    getLanguages,
    openLanguageHub
  };
})();

window.LanguageHubs = LanguageHubs;
