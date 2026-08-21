// ========================================
// MusicFlow — Podcasts & RSS Feed Engine
// ========================================

const Podcasts = (() => {
  const CURATED_SHOWS = [
    {
      id: 'trs_hindi',
      title: 'The Ranveer Show (TRS)',
      host: 'Ranveer Allahbadia',
      category: 'Self-Improvement & Spirituality',
      image: 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=500&q=80',
      gradient: 'linear-gradient(135deg, #FF416C, #FF4B2B)',
      description: 'India\'s smartest podcast with billionaires, spiritual masters, scientists, and world-class athletes.',
      rssUrl: 'https://anchor.fm/s/4f7c2224/podcast/rss',
      sampleEpisodes: [
        {
          id: 'trs_ep_1',
          title: 'The Science of Kundalini Yoga & Brainwaves with Dr. Alok',
          duration: 3840,
          pubDate: '2 days ago',
          description: 'Exploring neurobiology, pineal gland activation, ancient meditation practices, and higher consciousness.',
          streamUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'
        },
        {
          id: 'trs_ep_2',
          title: 'Deep Focus & Dopamine Fasting Protocol for Peak Performance',
          duration: 2940,
          pubDate: '5 days ago',
          description: 'Tactical tools to overcome procrastination, optimize focus states, and maximize creative output.',
          streamUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3'
        },
        {
          id: 'trs_ep_3',
          title: 'Ancient Himalayan Wisdom & The Mystery of Immortals',
          duration: 4120,
          pubDate: '1 week ago',
          description: 'A deep dive into Siddha traditions, yogic sciences, and the sacred geography of Kailash.',
          streamUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3'
        }
      ]
    },
    {
      id: 'huberman_lab',
      title: 'Huberman Lab',
      host: 'Dr. Andrew Huberman',
      category: 'Health, Neuroscience & Science',
      image: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=500&q=80',
      gradient: 'linear-gradient(135deg, #0ba360, #3cba92)',
      description: 'Neuroscience and science-based tools for everyday life, sleep, cognitive function, and longevity.',
      rssUrl: 'https://feeds.megaphone.fm/hubermanlab',
      sampleEpisodes: [
        {
          id: 'hub_ep_1',
          title: 'Master Your Sleep & Reset Your Circadian Clock',
          duration: 5400,
          pubDate: '3 days ago',
          description: 'Morning sunlight viewing, temperature regulation, non-sleep deep rest (NSDR), and optimal sleep hygiene.',
          streamUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3'
        },
        {
          id: 'hub_ep_2',
          title: 'How to Enhance Learning, Memory & Neuroplasticity',
          duration: 4800,
          pubDate: '1 week ago',
          description: 'Leveraging adrenaline, acetylcholine, and deliberate rest epochs to accelerate skill acquisition.',
          streamUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3'
        }
      ]
    },
    {
      id: 'finshots_daily',
      title: 'Finshots Daily',
      host: 'Finshots Editorial',
      category: 'Business & Finance',
      image: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=500&q=80',
      gradient: 'linear-gradient(135deg, #1fa2ff, #12d8fa)',
      description: 'A 5-minute daily breakdown of the most important financial, economic, and business news in plain English.',
      rssUrl: 'https://anchor.fm/s/11516e88/podcast/rss',
      sampleEpisodes: [
        {
          id: 'fin_ep_1',
          title: 'Why Global Central Banks Are Hoarding Physical Gold',
          duration: 480,
          pubDate: 'Yesterday',
          description: 'Unpacking de-dollarization trends, reserve currency shifts, and geopolitical hedging.',
          streamUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3'
        },
        {
          id: 'fin_ep_2',
          title: 'The Economics of Semiconductor Fab Mega-Projects in India',
          duration: 520,
          pubDate: '3 days ago',
          description: 'Analyzing supply chain dynamics, government incentives, and the silicon foundry race.',
          streamUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3'
        }
      ]
    },
    {
      id: 'lex_fridman',
      title: 'Lex Fridman Podcast',
      host: 'Lex Fridman',
      category: 'AI, Technology & Philosophy',
      image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=500&q=80',
      gradient: 'linear-gradient(135deg, #654ea3, #eaafc8)',
      description: 'Conversations about artificial intelligence, consciousness, physics, history, philosophy, and the future.',
      rssUrl: 'https://lexfridman.com/feed/podcast/',
      sampleEpisodes: [
        {
          id: 'lex_ep_1',
          title: 'Yann LeCun: Future of AI, World Models & AGI',
          duration: 7200,
          pubDate: '4 days ago',
          description: 'Exploring Joint Embedding Predictive Architectures (JEPA), animal intelligence, and artificial general intelligence.',
          streamUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3'
        },
        {
          id: 'lex_ep_2',
          title: 'Demis Hassabis: AlphaFold, Google DeepMind & Physics of Mind',
          duration: 6800,
          pubDate: '10 days ago',
          description: 'Biology breakthroughs, quantum mechanics, reinforcement learning, and decoding the universe.',
          streamUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3'
        }
      ]
    },
    {
      id: 'figuring_out',
      title: 'Figuring Out with Raj Shamani',
      host: 'Raj Shamani',
      category: 'Startups & Wealth Creation',
      image: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=500&q=80',
      gradient: 'linear-gradient(135deg, #f12711, #f5af19)',
      description: 'Building unicorn startups, scaling consumer brands, venture capital, and modern wealth secrets.',
      rssUrl: 'https://anchor.fm/s/1e938914/podcast/rss',
      sampleEpisodes: [
        {
          id: 'raj_ep_1',
          title: 'How to Build a ₹100 Crore D2C Brand from Scratch',
          duration: 3600,
          pubDate: '5 days ago',
          description: 'Customer acquisition cost (CAC), supply chain leverage, branding psychology, and distribution channels.',
          streamUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3'
        }
      ]
    },
    {
      id: 'naval',
      title: 'Naval Ravikant on Wealth & Happiness',
      host: 'Naval Ravikant',
      category: 'Philosophy & Wealth',
      image: 'https://images.unsplash.com/photo-1506784983877-45594efa4cbe?w=500&q=80',
      gradient: 'linear-gradient(135deg, #11998e, #38ef7d)',
      description: 'Timeless principles on specific knowledge, leverage, accountability, judgment, and peace of mind.',
      rssUrl: 'https://naval.libsyn.com/rss',
      sampleEpisodes: [
        {
          id: 'nav_ep_1',
          title: 'How to Get Rich Without Getting Lucky (Full Timeless Masterclass)',
          duration: 4200,
          pubDate: 'Classic',
          description: 'Productize yourself, seek wealth not money or status, earn with your mind not your time.',
          streamUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-11.mp3'
        }
      ]
    }
  ];

  function getCuratedShows() {
    return CURATED_SHOWS;
  }

  function getShowById(showId) {
    return CURATED_SHOWS.find(s => s.id === showId) || null;
  }

  async function fetchShowEpisodes(showId) {
    const show = getShowById(showId);
    if (!show) return [];

    try {
      // If RSS URL exists, try to fetch via proxy or fallback to sample episodes
      if (show.rssUrl && window.fetch) {
        try {
          const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(show.rssUrl)}`;
          const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(3500) });
          if (res.ok) {
            const xmlText = await res.text();
            const episodes = parseRssXml(xmlText, show);
            if (episodes && episodes.length > 0) {
              return episodes;
            }
          }
        } catch (_) {}
      }
    } catch (_) {}

    // Fallback to rich sample episodes
    return (show.sampleEpisodes || []).map(ep => ({
      id: ep.id,
      title: ep.title,
      name: ep.title,
      artists: show.host,
      album: show.title,
      image: show.image,
      duration: ep.duration,
      pubDate: ep.pubDate,
      description: ep.description,
      streamUrl: ep.streamUrl,
      isPodcast: true,
      showId: show.id
    }));
  }

  function parseRssXml(xmlText, show) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlText, 'text/xml');
      const items = doc.querySelectorAll('item');
      const episodes = [];

      items.forEach((item, idx) => {
        if (idx >= 25) return;
        const title = item.querySelector('title')?.textContent || `Episode ${idx + 1}`;
        const desc = item.querySelector('description')?.textContent?.replace(/<[^>]*>?/gm, '').slice(0, 200) || '';
        const enclosure = item.querySelector('enclosure');
        const audioUrl = enclosure?.getAttribute('url') || '';
        const pubDateStr = item.querySelector('pubDate')?.textContent || '';
        const pubDate = pubDateStr ? new Date(pubDateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
        const itunesDuration = item.querySelector('duration')?.textContent || '45:00';
        
        let durationSec = 2700;
        if (itunesDuration.includes(':')) {
          const parts = itunesDuration.split(':').map(Number);
          durationSec = parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + parts[1];
        }

        if (audioUrl) {
          episodes.push({
            id: `rss_${show.id}_${idx}`,
            title,
            name: title,
            artists: show.host,
            album: show.title,
            image: show.image,
            duration: durationSec,
            pubDate,
            description: desc,
            streamUrl: audioUrl,
            isPodcast: true,
            showId: show.id
          });
        }
      });

      return episodes;
    } catch (e) {
      console.warn('[Podcasts] XML parse error:', e);
      return [];
    }
  }

  async function playEpisode(episode, show) {
    const showInfo = show || getShowById(episode.showId) || { title: episode.album, host: episode.artists, image: episode.image };
    const normTrack = {
      id: episode.id,
      name: episode.title || episode.name,
      artists: showInfo.host || episode.artists,
      album: showInfo.title || episode.album,
      image: episode.image || showInfo.image,
      duration: episode.duration || 3000,
      streamUrl: episode.streamUrl,
      isPodcast: true
    };

    // Restore saved progress
    const savedPos = Storage.getPodcastProgress(episode.id);

    Player.setQueue([normTrack], 0);
    await Player.playSong(normTrack);

    if (savedPos > 5) {
      Player.seekTo(savedPos);
      UI.showToast(`Resumed from ${UI.formatDuration(savedPos)}`, 'info');
    }

    if (window.expandPlayer) window.expandPlayer(true);
  }

  function openPodcastShow(showId) {
    const show = getShowById(showId);
    if (!show) return;

    UI.showPage('page-podcast-show');
    history.pushState({ type: 'podcast_show', showId: show.id }, '', `#podcast/${show.id}`);

    const bannerEl = document.getElementById('podcast-show-banner');
    const episodesContainer = document.getElementById('podcast-episodes-container');

    if (bannerEl) {
      bannerEl.style.background = show.gradient;
      bannerEl.innerHTML = `
        <button class="btn-icon btn-back" aria-label="Go back" onclick="window.history.back() || Podcasts.openPodcastsHub()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <img class="podcast-show-img" src="${show.image}" alt="${show.title}">
        <div class="podcast-show-info">
          <span class="podcast-show-tag">${show.category}</span>
          <h1 class="podcast-show-title">${show.title}</h1>
          <p class="podcast-show-host">Hosted by <strong>${show.host}</strong></p>
          <p class="podcast-show-desc">${show.description}</p>
        </div>
      `;
    }

    if (episodesContainer) {
      episodesContainer.innerHTML = '<div class="loading-shelf shimmer-card" style="height: 300px;"></div>';
      fetchShowEpisodes(show.id).then(episodes => {
        renderEpisodesList(episodes, show, episodesContainer);
      });
    }
  }

  function renderEpisodesList(episodes, show, container) {
    container.innerHTML = '';
    if (!episodes || episodes.length === 0) {
      container.innerHTML = `<div class="empty-state">No episodes available.</div>`;
      return;
    }

    episodes.forEach((ep, idx) => {
      const card = document.createElement('div');
      card.className = 'podcast-episode-card';
      card.dataset.epId = ep.id;

      const savedPos = Storage.getPodcastProgress(ep.id);
      const progressPct = ep.duration ? Math.min(100, (savedPos / ep.duration) * 100) : 0;

      card.innerHTML = `
        <div class="podcast-ep-play-btn" title="Play Episode">
          <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="6,4 18,12 6,20"/></svg>
        </div>
        <div class="podcast-ep-content">
          <div class="podcast-ep-meta">
            <span class="podcast-ep-date">${ep.pubDate || 'Recent'}</span>
            <span class="podcast-ep-duration">${UI.formatDuration(ep.duration)}</span>
            ${savedPos > 10 ? `<span class="podcast-ep-resume-badge">⏱️ ${UI.formatDuration(savedPos)} played</span>` : ''}
          </div>
          <h3 class="podcast-ep-title">${ep.title || ep.name}</h3>
          <p class="podcast-ep-desc">${ep.description || ''}</p>
          ${progressPct > 0 ? `
            <div class="podcast-ep-progress-wrap">
              <div class="podcast-ep-progress-bar" style="width: ${progressPct}%;"></div>
            </div>
          ` : ''}
        </div>
      `;

      card.addEventListener('click', () => {
        playEpisode(ep, show);
      });

      container.appendChild(card);
    });
  }

  function openPodcastsHub() {
    UI.showPage('page-podcasts');
    history.pushState({ type: 'page', pageId: 'page-podcasts' }, '', '#podcasts');

    const container = document.getElementById('podcasts-hub-container');
    if (!container) return;

    container.innerHTML = `
      <div class="hub-header" style="background: linear-gradient(135deg, #FF416C, #8A2387); margin-bottom: 24px;">
        <div class="hub-header__watermark">🎙️</div>
        <div class="hub-header__info">
          <span class="hub-header__badge">PODCASTS & TALKS</span>
          <h1 class="hub-header__title">Podcasts Hub</h1>
          <p class="hub-header__tagline">Binge top Indian & Global shows, deep dives, tech talks, and masterclasses.</p>
        </div>
      </div>

      <div class="shelf-section">
        <div class="shelf-header">
          <h2 class="shelf-title">Top Shows & Series</h2>
        </div>
        <div class="podcast-shows-grid" id="podcasts-shows-grid"></div>
      </div>
    `;

    const grid = document.getElementById('podcasts-shows-grid');
    CURATED_SHOWS.forEach(show => {
      const card = document.createElement('div');
      card.className = 'podcast-show-card';
      card.innerHTML = `
        <div class="podcast-show-card__cover" style="background-image: url('${show.image}');">
          <div class="podcast-show-card__overlay">
            <span class="podcast-show-card__category">${show.category}</span>
          </div>
        </div>
        <div class="podcast-show-card__info">
          <h3 class="podcast-show-card__title">${show.title}</h3>
          <p class="podcast-show-card__host">${show.host}</p>
        </div>
      `;

      card.addEventListener('click', () => {
        openPodcastShow(show.id);
      });

      grid.appendChild(card);
    });
  }

  return {
    getCuratedShows,
    getShowById,
    fetchShowEpisodes,
    playEpisode,
    openPodcastShow,
    openPodcastsHub
  };
})();

window.Podcasts = Podcasts;
