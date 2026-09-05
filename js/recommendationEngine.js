// ============================================================================
// MUSICFLOW — RECOMMENDATION ENGINE 2.0 (Phase 8)
// Real Hybrid Personalization Pipeline: Multi-Dimensional User Profiling,
// Context-Aware Mood Scaling, Multi-Channel Recall, Song-First Filtering,
// Strict Artist Diversity, Controlled Discovery, and Human-Readable Reasons.
// ============================================================================

const RecommendationEngine = (() => {

  // Configurable Hybrid Ranker Weights (Language + Mood + Taste)
  const Weights = {
    languageMatch: 0.35,
    moodRelevance: 0.20,
    artistRelevance: 0.15,
    userAffinity: 0.15,
    vectorSimilarity: 0.05,
    playableSource: 0.05,
    popularity: 0.03,
    freshness: 0.02,
    skipPenaltyWeight: 0.30,
    repetitionPenaltyWeight: 0.15
  };

  let lastDiagnostics = [];
  const radioSessionSeenIds = new Set();

  // Context-Aware Mood Profiles (Modulates taste without replacing it)
  const MOOD_PROFILES = {
    'workout': { energy: 0.85, danceability: 0.80, minTempo: 120, maxTempo: 155, acousticness: 0.20, valence: 0.70, keywords: ['workout', 'gym', 'pump', 'beast', 'fast', 'high energy', 'dance', 'phonk'] },
    'relax': { energy: 0.35, danceability: 0.40, minTempo: 60, maxTempo: 100, acousticness: 0.80, valence: 0.50, keywords: ['chill', 'relax', 'acoustic', 'lo-fi', 'unplugged', 'peaceful', 'ambient', 'soft'] },
    'focus': { energy: 0.50, speechiness: 0.15, instrumentalness: 0.70, minTempo: 70, maxTempo: 115, keywords: ['study', 'focus', 'instrumental', 'piano', 'deep focus', 'ambient', 'concentration'] },
    'energize': { energy: 0.90, danceability: 0.85, valence: 0.85, minTempo: 110, maxTempo: 150, keywords: ['party', 'dance', 'energetic', 'club', 'pop', 'banger', 'hype', 'edm'] },
    'party': { energy: 0.90, danceability: 0.90, valence: 0.80, minTempo: 115, maxTempo: 140, keywords: ['party', 'club', 'remix', 'celebration', 'dance', 'dj', 'bass'] },
    'romance': { energy: 0.45, valence: 0.65, acousticness: 0.60, minTempo: 65, maxTempo: 105, keywords: ['love', 'romantic', 'dil', 'ishq', 'pyaar', 'sweet', 'ballad', 'slow'] },
    'sleep': { energy: 0.20, danceability: 0.25, acousticness: 0.90, minTempo: 50, maxTempo: 85, keywords: ['sleep', 'lullaby', 'peaceful', 'rain', 'meditation', 'drone', 'night'] },
    'all': null
  };

  // Curated Related Artists Graph for Deep Discovery
  const RELATED_ARTISTS_GRAPH = {
    'the weeknd': ['drake', 'travis scott', 'post malone', 'dua lipa', 'daft punk', 'kanye west', 'sza', 'charlie puth'],
    'arijit singh': ['pritam', 'shreya ghoshal', 'atif aslam', 'mohit chauhan', 'kk', 'darshan raval', 'jubin nautiyal', 'jasleen royal', 'vishal mishra'],
    'ed sheeran': ['shawn mendes', 'charlie puth', 'taylor swift', 'justin bieber', 'james arthur', 'lewis capaldi', 'sam smith'],
    'taylor swift': ['olivia rodrigo', 'ed sheeran', 'billie eilish', 'sabrina carpenter', 'katy perry', 'ariana grande', 'selena gomez', 'gracie abrams'],
    'drake': ['travis scott', 'the weeknd', 'future', '21 savage', 'kendrick lamar', 'post malone', 'kanye west', 'lil baby'],
    'travis scott': ['drake', 'future', 'don toliver', 'playboi carti', 'kanye west', 'asap rocky', 'metro boomin'],
    'shreya ghoshal': ['arijit singh', 'sonu nigam', 'sunidhi chauhan', 'alka yagnik', 'pritam', 'shaan', 'mohit chauhan', 'monali thakur'],
    'pritam': ['arijit singh', 'kk', 'mohit chauhan', 'atif aslam', 'shreya ghoshal', 'badshah', 'vishal-shekhar', 'sachin-jigar'],
    'badshah': ['yo yo honey singh', 'diljit dosanjh', 'karan aujla', 'raftaar', 'divine', 'neha kakkar', 'guru randhawa', 'ikky'],
    'diljit dosanjh': ['karan aujla', 'sidhu moose wala', 'ap dhillon', 'badshah', 'amrinder gill', 'guru randhawa', 'shubh'],
    'atif aslam': ['arijit singh', 'rahat fateh ali khan', 'mustafa zahid', 'ali zafar', 'kk', 'mohit chauhan', 'ali sethi'],
    'karan aujla': ['diljit dosanjh', 'sidhu moose wala', 'ap dhillon', 'shubh', 'ikky', 'amrit maan'],
    'sidhu moose wala': ['karan aujla', 'amrit maan', 'premy', 'ap dhillon', 'bohemia', 'shubh'],
    'shubh': ['ap dhillon', 'karan aujla', 'sidhu moose wala', 'diljit dosanjh', 'gurinder gill'],
    'anirudh ravichander': ['a.r. rahman', 'yuvan shankar raja', 'harris jayaraj', 'santhosh narayanan', 'sid sriram', 'g.v. prakash kumar'],
    'a.r. rahman': ['anirudh ravichander', 'harris jayaraj', 'yuvan shankar raja', 'sid sriram', 'shreya ghoshal', 'hariharan', 'k.s. chithra'],
    'sid sriram': ['anirudh ravichander', 'a.r. rahman', 'pradeep kumar', 'chinmayi', 'shreya ghoshal', 'jonita gandhi'],
    'coldplay': ['imagine dragons', 'one republic', 'the chainsmokers', 'keane', 'maroon 5', 'u2', 'bastille'],
    'imagine dragons': ['coldplay', 'fall out boy', 'one republic', 'bastille', 'twenty one pilots', 'linkin park', 'the score'],
    'alan walker': ['marshmello', 'the chainsmokers', 'martin garrix', 'kygo', 'dj snake', 'avicii', 'k-391'],
    'dua lipa': ['bebe rexha', 'ava max', 'calvin harris', 'olivia rodrigo', 'the weeknd', 'anne-marie', 'katy perry']
  };

  function getEmbedder() {
    if (typeof MusicFlowEmbedder !== 'undefined') return MusicFlowEmbedder;
    if (typeof require !== 'undefined') {
      try { return require('./musicFlowEmbedder.js'); } catch (_) {}
      try { return require('./js/musicFlowEmbedder.js'); } catch (_) {}
    }
    return null;
  }

  function getFeatureStore() {
    if (typeof FeatureStore !== 'undefined') return FeatureStore;
    if (typeof require !== 'undefined') {
      try { return require('./featureStore.js'); } catch (_) {}
      try { return require('./js/featureStore.js'); } catch (_) {}
    }
    return null;
  }

  function getDataNormalizer() {
    if (typeof DataNormalizer !== 'undefined') return DataNormalizer;
    if (typeof require !== 'undefined') {
      try { return require('./dataNormalizer.js'); } catch (_) {}
      try { return require('./js/dataNormalizer.js'); } catch (_) {}
    }
    return {
      normalizeLanguage: (l) => {
        if (!l || typeof l !== 'string') return 'unknown';
        const clean = l.toLowerCase().trim();
        if (clean === 'hi' || clean.includes('hindi') || clean.includes('हिंदी')) return 'hindi';
        if (clean === 'en' || clean.includes('english')) return 'english';
        if (clean === 'pa' || clean.includes('punjabi') || clean.includes('ਪੰਜਾਬੀ')) return 'punjabi';
        if (clean === 'ta' || clean.includes('tamil') || clean.includes('தமிழ்')) return 'tamil';
        if (clean === 'te' || clean.includes('telugu') || clean.includes('తెలుగు')) return 'telugu';
        if (clean === 'bn' || clean.includes('bengali') || clean.includes('বাংলা')) return 'bengali';
        if (clean === 'mr' || clean.includes('marathi') || clean.includes('मराठी')) return 'marathi';
        if (clean === 'gu' || clean.includes('gujarati')) return 'gujarati';
        if (clean === 'spanish') return 'spanish';
        if (clean === 'korean') return 'korean';
        return clean || 'unknown';
      },
      getArtistString: (a) => {
        if (!a) return 'Unknown Artist';
        if (typeof a === 'string') return a;
        if (Array.isArray(a)) return a.map(x => (typeof x === 'object' ? x.name : x)).filter(Boolean).join(', ') || 'Unknown Artist';
        if (typeof a === 'object') return a.name || a.title || 'Unknown Artist';
        return 'Unknown Artist';
      },
      getPrimaryArtist: (a) => {
        if (!a) return 'Unknown Artist';
        if (typeof a === 'string') return a.split(/[,;&/]|feat\.|ft\./i)[0].trim() || 'Unknown Artist';
        if (typeof a === 'object') return a.primaryArtist || a.name || 'Unknown Artist';
        return 'Unknown Artist';
      }
    };
  }

  function getTrackDeduplicator() {
    if (typeof TrackDeduplicator !== 'undefined') return TrackDeduplicator;
    if (typeof require !== 'undefined') {
      try { return require('./trackDeduplicator.js'); } catch (_) {}
      try { return require('./js/trackDeduplicator.js'); } catch (_) {}
    }
    return {
      cleanArtistName: (a) => String(a || '').split(/[,&;/]|feat\.|ft\./i)[0].trim().toLowerCase(),
      cleanTrackTitle: (t) => String(t || '').replace(/\(.*?\)|\[.*?\]/g, '').trim().toLowerCase(),
      deduplicate: (arr) => arr
    };
  }

  function TD_clean(a) {
    const artStr = (typeof DataNormalizer !== 'undefined' && a && typeof a === 'object') ? DataNormalizer.getArtistString(a) : a;
    return getTrackDeduplicator().cleanArtistName(artStr);
  }

  // Song-First Quality Filter: Strictly rejects channels, playlists, compilations, podcasts
  function isLegitimateTrack(song) {
    if (!song) return false;
    const type = (song.type || '').toLowerCase();
    if (type === 'playlist' || type === 'channel' || type === 'artist' || type === 'album' || type === 'user') {
      return false;
    }

    const title = (song.name || song.title || '').toLowerCase();
    const artStr = (typeof DataNormalizer !== 'undefined')
      ? DataNormalizer.getArtistString(song)
      : (typeof song.artists === 'string' ? song.artists : (song.artists?.name || song.primaryArtist || ''));
    const artist = String(artStr || '').toLowerCase();
    const dur = Number(song.duration || 0);

    // Reject non-track compilation titles
    const invalidKeywords = ['podcast', 'playlist', 'jukebox', 'best songs of', 'top hits of', 'full album', 'audiobook', 'continuous mix', 'megamix', 'live stream'];
    if (invalidKeywords.some(kw => title.includes(kw))) {
      return false;
    }

    // Must have recognizable duration (> 30s) or valid provider stream
    if (dur > 0 && dur < 30) return false;
    if (artist === 'unknown artist' && !song.audioUrl && !song.streamUrl) return false;

    return true;
  }

  function computeArtistSimilarity(artistA, artistB) {
    const TD = getTrackDeduplicator();
    const artStrA = (typeof DataNormalizer !== 'undefined' && typeof artistA === 'object') ? DataNormalizer.getArtistString(artistA) : artistA;
    const artStrB = (typeof DataNormalizer !== 'undefined' && typeof artistB === 'object') ? DataNormalizer.getArtistString(artistB) : artistB;
    const a = TD.cleanArtistName(artStrA);
    const b = TD.cleanArtistName(artStrB);

    if (!a || !b) return 0.0;
    if (a === b) return 1.0;
    if (a.includes(b) || b.includes(a)) return 0.85;

    const relA = RELATED_ARTISTS_GRAPH[a] || [];
    if (relA.includes(b)) return 0.75;

    const relB = RELATED_ARTISTS_GRAPH[b] || [];
    if (relB.includes(a)) return 0.75;

    return 0.0;
  }

  // Multi-Channel Candidate Recall Engine
  function generateCandidates(seedTrack, candidatePool = [], options = {}) {
    if (!seedTrack || !Array.isArray(candidatePool) || candidatePool.length === 0) return [];
    const Embedder = getEmbedder();
    const Store = getFeatureStore();
    const TD = getTrackDeduplicator();
    const TD_clean = TD.cleanArtistName;

    const seedFeatures = Store ? Store.getFeatures(seedTrack.id) : null;
    const seedVector = Embedder ? Embedder.generateEmbedding(seedTrack, seedFeatures) : null;
    const seedArtist = TD_clean(seedTrack.artists || seedTrack.primaryArtist);
    const seedLang = (seedTrack.language || 'hindi').toLowerCase();
    const relatedList = (RELATED_ARTISTS_GRAPH[seedArtist] || []).map(a => a.toLowerCase());

    const candidateMap = new Map();

    function recordCandidate(song, channel, score) {
      if (!isLegitimateTrack(song)) return;
      if (String(song.id) === String(seedTrack.id)) return;
      const id = String(song.id);
      if (!candidateMap.has(id)) {
        candidateMap.set(id, { song, channels: new Set(), channelScores: {} });
      }
      const entry = candidateMap.get(id);
      entry.channels.add(channel);
      entry.channelScores[channel] = Math.max(entry.channelScores[channel] || 0, score);
    }

    candidatePool.forEach(cand => {
      if (String(cand.id) === String(seedTrack.id)) return;
      const candArtist = TD_clean(cand.artists || cand.primaryArtist);
      const candLang = (cand.language || 'hindi').toLowerCase();

      // Channel 1: 64-dim Embeat Vector Similarity (Acoustic ANN)
      if (Embedder && seedVector) {
        const candFeatures = Store ? Store.getFeatures(cand.id) : null;
        const candVector = Embedder.generateEmbedding(cand, candFeatures);
        const sim = Embedder.cosineSimilarity(seedVector, candVector);
        if (sim > 0.40) {
          recordCandidate(cand, 'vector_ann', sim);
          recordCandidate(cand, 'acoustic', sim);
        }
      }

      // Channel 2: Same Artist Catalog
      if (candArtist === seedArtist || candArtist.includes(seedArtist) || seedArtist.includes(candArtist)) {
        recordCandidate(cand, 'same_artist', 0.95);
      }

      // Channel 3: Related Artist Graph
      if (relatedList.includes(candArtist)) {
        recordCandidate(cand, 'related_artist', 0.80);
      }

      // Channel 4: Language & Genre Cluster
      if (candLang === seedLang) {
        const pop = (cand.popularity ? Number(cand.popularity) : 60) / 100.0;
        recordCandidate(cand, 'genre_cluster', 0.65 + (pop * 0.25));
      }

      // Channel 5: Playable Provider Source Bonus
      if (cand.playbackAvailable || cand.audioUrl || cand.provider === 'jiosaavn') {
        recordCandidate(cand, 'playable_source', 0.85);
      }
    });

    return Array.from(candidateMap.values()).map(entry => ({
      song: entry.song,
      sources: Array.from(entry.channels),
      channelScores: entry.channelScores
    }));
  }

  // Calculate Context/Mood Affinity for a Track
  function scoreMoodAffinity(song, moodName = 'all') {
    if (!moodName || moodName.toLowerCase() === 'all') return 0.5;
    const moodKey = moodName.toLowerCase();
    const profile = MOOD_PROFILES[moodKey];
    if (!profile) return 0.5;

    const Store = getFeatureStore();
    const features = Store ? Store.getFeatures(song.id) : null;
    let score = 0.5;

    if (features) {
      if (profile.energy !== undefined && features.energy !== undefined) {
        const energyDiff = Math.abs(features.energy - profile.energy);
        score += (1.0 - energyDiff) * 0.25;
      }
      if (profile.danceability !== undefined && features.danceability !== undefined) {
        const danceDiff = Math.abs(features.danceability - profile.danceability);
        score += (1.0 - danceDiff) * 0.25;
      }
      if (profile.minTempo !== undefined && features.tempo !== undefined) {
        if (features.tempo >= profile.minTempo && features.tempo <= profile.maxTempo) {
          score += 0.25;
        } else {
          score -= 0.15;
        }
      }
    }

    // Keyword Match in Title / Genre / Album
    const fullText = `${song.name || ''} ${song.album || ''} ${song.genre || ''}`.toLowerCase();
    if (profile.keywords && profile.keywords.some(kw => fullText.includes(kw))) {
      score += 0.20;
    }

    return Math.max(0.0, Math.min(1.0, score));
  }

  // Main Hybrid Personalized Recommender (Recommendation 2.0)
  function getPersonalizedRecommendations(
    userHistory = [],
    userFavorites = [],
    candidatePool = [],
    options = {}
  ) {
    if (!Array.isArray(candidatePool) || candidatePool.length === 0) return [];
    const limit = options.limit || 20;
    const mood = options.mood || 'all';
    const discoveryRatio = options.discoveryRatio !== undefined ? options.discoveryRatio : 0.15;

    const Embedder = getEmbedder();
    const Store = getFeatureStore();
    const TD = getTrackDeduplicator();
    const DN = getDataNormalizer();
    const TD_clean = (a) => {
      const artStr = (a && typeof a === 'object') ? DN.getArtistString(a) : (typeof a === 'string' ? a : (a?.name || ''));
      return TD.cleanArtistName(artStr);
    };

    // 1. Authoritative User Language Preference (from Settings or options)
    const configuredLangs = options.selectedLanguages || (typeof Storage !== 'undefined' && typeof Storage.getLanguages === 'function' ? Storage.getLanguages() : null);
    const userSelectedLanguages = (configuredLangs && Array.isArray(configuredLangs) ? configuredLangs : (configuredLangs ? [configuredLangs] : []))
      .map(l => DN.normalizeLanguage(l))
      .filter(l => l && l !== 'unknown');

    // Filter candidate pool to legitimate tracks only (0% playlist/channel contamination)
    const validCandidates = candidatePool.filter(isLegitimateTrack);
    if (validCandidates.length === 0) return [];

    // Retrieve User Signals from Storage
    let userSignals = {
      artistScores: {},
      languageScores: {},
      skippedSongCounts: {},
      skippedArtistCounts: {},
      milestones: {},
      totalSignals: 0
    };
    let recentDelivered = [];
    if (typeof Storage !== 'undefined' && typeof Storage.getUserTasteSignals === 'function') {
      userSignals = Storage.getUserTasteSignals();
      recentDelivered = (Storage.getRecentDeliveredRecommendations() || []).map(r => String(r.id));
    }

    const artistScores = { ...(userSignals.artistScores || {}) };
    const languageScores = { ...(userSignals.languageScores || {}) };
    const skippedSongCounts = { ...(userSignals.skippedSongCounts || {}) };
    const skippedArtistCounts = { ...(userSignals.skippedArtistCounts || {}) };
    const milestones = { ...(userSignals.milestones || {}) };

    // Supplement with directly provided history & favorites arrays
    userFavorites.forEach(s => {
      if (!s) return;
      const art = TD_clean(s.artists || s.primaryArtist || '');
      if (art) artistScores[art] = (artistScores[art] || 0) + 1.5;
      const sLang = DN.normalizeLanguage(s.language || s.lang || '');
      if (sLang && sLang !== 'unknown') languageScores[sLang] = (languageScores[sLang] || 0) + 1.5;
    });

    userHistory.forEach(s => {
      if (!s) return;
      const art = TD_clean(s.artists || s.primaryArtist || '');
      if (art) artistScores[art] = (artistScores[art] || 0) + 1.0;
      const sLang = DN.normalizeLanguage(s.language || s.lang || '');
      if (sLang && sLang !== 'unknown') languageScores[sLang] = (languageScores[sLang] || 0) + 1.0;
    });

    // Cold-Start Handling for Fresh Users
    const isColdStart = (userHistory.length === 0 && userFavorites.length === 0 && userSignals.totalSignals === 0);
    if (isColdStart) {
      const sortedByPop = [...validCandidates].sort((a, b) => {
        const langA = DN.normalizeLanguage(a.language || a.lang || '');
        const langB = DN.normalizeLanguage(b.language || b.lang || '');
        const langMatchA = userSelectedLanguages.length === 0 || userSelectedLanguages.includes(langA) ? 50 : -40;
        const langMatchB = userSelectedLanguages.length === 0 || userSelectedLanguages.includes(langB) ? 50 : -40;
        const moodA = scoreMoodAffinity(a, mood);
        const moodB = scoreMoodAffinity(b, mood);
        const popA = (a.popularity ? Number(a.popularity) : 70) + (moodA * 30) + langMatchA;
        const popB = (b.popularity ? Number(b.popularity) : 70) + (moodB * 30) + langMatchB;
        return popB - popA;
      });
      const dedup = TD.deduplicate(sortedByPop);
      const coldResults = [];
      const artCount = {};
      for (const s of dedup) {
        const art = TD_clean(s.artists || s.primaryArtist);
        if ((artCount[art] || 0) < 2) {
          coldResults.push({
            song: s,
            score: 0.85,
            reason: mood !== 'all' ? `Trending in ${mood}` : 'Trending popular tracks',
            provenance: 'METADATA_DERIVED'
          });
          artCount[art] = (artCount[art] || 0) + 1;
        }
        if (coldResults.length >= limit) break;
      }
      return coldResults;
    }

    const recentDeliveredSet = new Set(recentDelivered);
    const knownSongIds = new Set([...userFavorites, ...userHistory].map(s => String(s.id)));
    const mostRecentSong = userHistory[0] || userFavorites[0] || null;
    const seedFeatures = (mostRecentSong && Store) ? Store.getFeatures(mostRecentSong.id) : null;
    const seedVector = (mostRecentSong && Embedder) ? Embedder.generateEmbedding(mostRecentSong, seedFeatures) : null;

    lastDiagnostics = [];

    // Score all candidate tracks using Hybrid Multi-Signal Formula
    const scoredCandidates = validCandidates.map(cand => {
      const candId = String(cand.id);
      const candArtist = DN.getArtistString(cand);
      const cleanCandArtist = TD_clean(candArtist);
      const candLang = DN.normalizeLanguage(cand.language || cand.lang || cand.language_name || '');
      const candFeatures = Store ? Store.getFeatures(candId) : null;

      // 1. Language Score: Exact Match (+100 / 1.0), Detected (+80 / 0.8), Unknown (0 / 0.0), Unselected (-60 / -0.6)
      let langScore = 0.0;
      let isLanguageMatched = false;
      const userLangSignals = languageScores[candLang] || 0;

      if (userSelectedLanguages.length > 0) {
        if (userSelectedLanguages.includes(candLang)) {
          langScore = 1.0;
          isLanguageMatched = true;
        } else if (userLangSignals >= 1.0) {
          langScore = Math.min(0.90, 0.50 + (userLangSignals / 5.0));
          isLanguageMatched = true;
        } else if (candLang === 'unknown') {
          langScore = 0.0;
        } else {
          langScore = -0.60;
        }
      } else {
        if (userLangSignals > 0) {
          langScore = Math.min(1.0, 0.40 + (userLangSignals / 4.0));
          isLanguageMatched = true;
        } else {
          langScore = 0.0;
        }
      }

      // 2. Vector Similarity (64-dim embedding cosine sim)
      let vecSim = 0.5;
      if (Embedder && seedVector) {
        const candVec = Embedder.generateEmbedding(cand, candFeatures);
        vecSim = Embedder.cosineSimilarity(seedVector, candVec);
      }

      // 3. Artist Relevance (Long-term affinity + short-term history)
      let artistScore = 0.0;
      if (artistScores[cleanCandArtist]) {
        artistScore = Math.min(1.0, artistScores[cleanCandArtist] / 4.0);
      } else if (mostRecentSong) {
        artistScore = computeArtistSimilarity(mostRecentSong.artists || mostRecentSong.primaryArtist, cand.artists || cand.primaryArtist);
      }

      // 4. User Affinity (Likes: +1.5, Completions: +1.0, 50% Plays: +0.4)
      const isFav = userFavorites.some(f => String(f.id) === candId);
      const milestone = milestones[candId];
      let userAffinityScore = isFav ? 0.90 : 0.20;
      if (milestone) {
        if (milestone.completions > 0) userAffinityScore += 0.30;
        if (milestone.highestPct >= 50) userAffinityScore += 0.15;
        if (milestone.plays > 2) userAffinityScore += 0.25; // Repeat play bonus
      }

      // 5. Context-Aware Mood Scaling
      const moodScore = scoreMoodAffinity(cand, mood);

      // 6. Playability Check
      const isPlayable = cand.playbackAvailable || cand.audioUrl || cand.streamUrl || cand.provider === 'jiosaavn';
      const playabilityScore = isPlayable ? 1.0 : 0.15;

      // 7. Popularity & Freshness / Discovery
      const popScore = (cand.popularity ? Number(cand.popularity) : 65) / 100.0;
      const isDiscovery = !knownSongIds.has(candId);
      const freshnessScore = isDiscovery ? 0.90 : 0.40;

      // 8. Penalties: Skips & Repetition
      const skipsOnTrack = skippedSongCounts[candId] || 0;
      const skipsOnArtist = skippedArtistCounts[cleanCandArtist] || 0;
      const skipPenalty = (skipsOnTrack * 0.50) + Math.min(0.35, skipsOnArtist * 0.15);
      const repetitionPenalty = recentDeliveredSet.has(candId) ? 0.35 : 0.0;

      // Final Composite Score: Language + Mood + Taste
      const totalScore =
        (langScore * Weights.languageMatch) +
        (moodScore * Weights.moodRelevance) +
        (artistScore * Weights.artistRelevance) +
        (userAffinityScore * Weights.userAffinity) +
        (vecSim * Weights.vectorSimilarity) +
        (playabilityScore * Weights.playableSource) +
        (popScore * Weights.popularity) +
        (freshnessScore * Weights.freshness) -
        (skipPenalty * Weights.skipPenaltyWeight) -
        (repetitionPenalty * Weights.repetitionPenaltyWeight);

      // Explainable Human-Readable Reason
      let reason = 'Recommended for you';
      if (mood !== 'all' && moodScore >= 0.50) {
        reason = `Matches your ${mood} taste`;
      } else if (isFav) {
        reason = 'From your Liked Songs';
      } else if (artistScores[cleanCandArtist] > 2.0) {
        reason = `From your top artist ${candArtist}`;
      } else if (mostRecentSong && vecSim > 0.70) {
        reason = `Similar style to ${mostRecentSong.name}`;
      } else if (candLang !== 'unknown' && isLanguageMatched) {
        const capLang = candLang.charAt(0).toUpperCase() + candLang.slice(1);
        reason = `Popular in ${capLang}`;
      }

      // Record Developer Diagnostics (Internal only)
      lastDiagnostics.push({
        songId: candId,
        title: cand.name || cand.title || 'Track',
        artist: candArtist,
        language: candLang,
        selectedLanguages: userSelectedLanguages,
        mood,
        languageScore: Math.round(langScore * 100),
        moodScore: Math.round(moodScore * 100),
        artistScore: Math.round(artistScore * 100),
        historyScore: Math.round(userAffinityScore * 100),
        finalScore: Math.round(totalScore * 100),
        reason
      });

      return {
        song: cand,
        score: Math.max(0.01, totalScore),
        reason,
        isDiscovery,
        isLanguageMatched,
        candLang,
        provenance: candFeatures?.source || 'METADATA_DERIVED'
      };
    });

    scoredCandidates.sort((a, b) => b.score - a.score);

    // Apply Soft-First Filtering & Interleaved Diversity
    // Always sequence matching language candidates first, followed by non-matching fallback candidates
    const matchedLanguageTracks = scoredCandidates.filter(c => c.isLanguageMatched || userSelectedLanguages.length === 0);
    const unmatchedTracks = scoredCandidates.filter(c => !c.isLanguageMatched && userSelectedLanguages.length > 0);
    const candidateSource = [...matchedLanguageTracks, ...unmatchedTracks];

    const deduplicated = TD.deduplicate(candidateSource.map(c => c.song));
    const scoredMap = new Map();
    scoredCandidates.forEach(c => scoredMap.set(String(c.song.id), c));

    const candidateList = deduplicated.map(s => scoredMap.get(String(s.id))).filter(Boolean);
    const finalRecs = [];
    const artistUsage = new Map();
    let lastArtist = null;

    while (finalRecs.length < limit && candidateList.length > 0) {
      // 1. Prefer the highest-scoring candidate whose artist is not lastArtist (and usage < 2)
      let pickIdx = candidateList.findIndex(item => {
        const art = TD_clean(item.song.artists || item.song.primaryArtist || 'unknown');
        const count = artistUsage.get(art) || 0;
        return count < 2 && art !== lastArtist;
      });

      // 2. If no alternating candidate is available, pick the next highest-scoring candidate with usage < 2
      if (pickIdx === -1) {
        pickIdx = candidateList.findIndex(item => {
          const art = TD_clean(item.song.artists || item.song.primaryArtist || 'unknown');
          return (artistUsage.get(art) || 0) < 2;
        });
      }

      if (pickIdx === -1) break; // No more eligible tracks

      const [selected] = candidateList.splice(pickIdx, 1);
      const art = TD_clean(selected.song.artists || selected.song.primaryArtist || 'unknown');
      finalRecs.push(selected);
      artistUsage.set(art, (artistUsage.get(art) || 0) + 1);
      lastArtist = art;
    }

    return finalRecs;
  }

  // Quick Picks Builder: 12-20 Song-First Tracks (Zero Playlists/Channels)
  function buildQuickPicks(userHistory = [], userFavorites = [], candidatePool = [], mood = 'all', limit = 16, options = {}) {
    const recs = getPersonalizedRecommendations(userHistory, userFavorites, candidatePool, {
      limit: Math.max(12, Math.min(24, limit)),
      mood,
      discoveryRatio: 0.15,
      ...options
    });
    return recs.map(r => ({
      ...r.song,
      recommendationReason: r.reason
    }));
  }

  // Similar Songs ("More Like This" & Song Radio Candidates)
  function getSimilarTracks(seedSong, candidatePool = [], limit = 20) {
    if (!seedSong || !Array.isArray(candidatePool) || candidatePool.length === 0) return [];
    const valid = candidatePool.filter(isLegitimateTrack);
    const candidates = generateCandidates(seedSong, valid, { limit: 50 });
    const TD = getTrackDeduplicator();

    const scored = candidates.map(c => {
      const vecSim = c.channelScores['vector_ann'] || 0.5;
      const sameArt = c.channelScores['same_artist'] ? 0.25 : 0.0;
      const relArt = c.channelScores['related_artist'] ? 0.20 : 0.0;
      const genre = c.channelScores['genre_cluster'] ? 0.15 : 0.0;
      const playable = c.channelScores['playable_source'] ? 0.15 : 0.0;

      const score = (vecSim * 0.40) + sameArt + relArt + genre + playable;
      let reason = `Similar style to ${seedSong.name}`;
      if (sameArt > 0) reason = `More from ${seedSong.artists || 'this artist'}`;
      else if (relArt > 0) reason = `From related artists`;

      return { song: c.song, score, reason };
    });

    scored.sort((a, b) => b.score - a.score);

    // Apply Interleaved Diversity to Radio / Similar Candidates
    const dedup = TD.deduplicate(scored.map(s => s.song));
    const sMap = new Map();
    scored.forEach(s => sMap.set(String(s.song.id), s));

    const aBuckets = new Map();
    for (const song of dedup) {
      const art = TD.cleanArtistName(song.artists || song.primaryArtist || '');
      if (!aBuckets.has(art)) aBuckets.set(art, []);
      aBuckets.get(art).push(sMap.get(String(song.id)) || { song, score: 0.5, reason: 'Similar track' });
    }

    const interleavedSimilar = [];
    const uIds = new Set();
    const aKeys = Array.from(aBuckets.keys());
    let maxD = 0;
    aBuckets.forEach(b => { if (b.length > maxD) maxD = b.length; });

    for (let r = 0; r < Math.min(maxD, 2); r++) {
      for (const k of aKeys) {
        const b = aBuckets.get(k);
        if (b && b[r]) {
          const it = b[r];
          const sid = String(it.song.id);
          if (!uIds.has(sid)) {
            uIds.add(sid);
            interleavedSimilar.push(it);
          }
        }
        if (interleavedSimilar.length >= limit) break;
      }
      if (interleavedSimilar.length >= limit) break;
    }

    return interleavedSimilar;
  }

  // Continuous Song Radio Queue (Session-level Deduplication)
  function resetRadioSession() {
    radioSessionSeenIds.clear();
  }

  function getTrackRadio(seedSong, candidatePool = [], limit = 25) {
    if (!seedSong) return candidatePool.filter(isLegitimateTrack).slice(0, limit);
    const seedId = String(seedSong.id);
    radioSessionSeenIds.add(seedId);

    const filteredPool = candidatePool.filter(c => !radioSessionSeenIds.has(String(c.id)));
    const pool = filteredPool.length >= 5 ? filteredPool : candidatePool;
    const similar = getSimilarTracks(seedSong, pool, limit);
    const radioQueue = [seedSong];
    similar.forEach(item => {
      const sid = String(item.song.id);
      if (sid !== seedId && !radioSessionSeenIds.has(sid)) {
        radioSessionSeenIds.add(sid);
        radioQueue.push(item.song);
      }
    });
    return radioQueue;
  }

  const discoverySessionSeenIds = new Set();

  function resetDiscoverySession() {
    discoverySessionSeenIds.clear();
  }

  function getDiscoveryFeed(candidatePool = [], options = {}) {
    const limit = options.limit || 25;
    const mood = options.mood || 'all';
    const DN = getDataNormalizer();
    const excludeIds = new Set((options.excludeIds || []).map(String));

    let userHistory = [];
    let userFavorites = [];
    let selectedLanguages = options.selectedLanguages || [];

    if (typeof Storage !== 'undefined') {
      if (typeof Storage.getHistory === 'function') userHistory = Storage.getHistory() || [];
      if (typeof Storage.getFavorites === 'function') userFavorites = Storage.getFavorites() || [];
      if (selectedLanguages.length === 0 && typeof Storage.getLanguages === 'function') {
        selectedLanguages = Storage.getLanguages() || [];
      }
    }

    // 6-Level Fallback Chain Pipeline with Session-level Deduplication
    let pool = candidatePool.filter(c => {
      if (!c || !c.id) return false;
      const sid = String(c.id);
      return !discoverySessionSeenIds.has(sid) && !excludeIds.has(sid);
    });

    if (pool.length < limit && candidatePool.length > 0) {
      // Keep feed alive by recycling candidates while avoiding currently loaded cards
      const freshCandidates = candidatePool.filter(c => c && c.id && !excludeIds.has(String(c.id)));
      pool = [...pool, ...freshCandidates];
    }

    const recs = getPersonalizedRecommendations(userHistory, userFavorites, pool, {
      limit,
      mood,
      selectedLanguages,
      discoveryRatio: 0.35
    });

    const feedTracks = [];
    recs.forEach(r => {
      const sid = String(r.song.id);
      discoverySessionSeenIds.add(sid);
      feedTracks.push({
        ...r.song,
        discoveryReason: r.reason || 'Recommended for you',
        tag: r.isDiscovery ? 'DISCOVER' : (r.isLanguageMatched && r.candLang && r.candLang !== 'unknown' ? r.candLang.toUpperCase() : 'FOR YOU')
      });
    });

    return feedTracks;
  }

  function recordInteraction(eventType, payload = {}) {
    if (!eventType) return;
    if (typeof Storage !== 'undefined' && typeof Storage.recordTasteSignal === 'function') {
      Storage.recordTasteSignal(eventType, payload);
    }
  }

  function recordImportSignal(songs = []) {
    if (!Array.isArray(songs) || songs.length === 0) return;
    recordInteraction('imported_playlist_tracks', { count: songs.length, sample: songs.slice(0, 5) });
  }

  function getLastDiagnostics() {
    return [...lastDiagnostics];
  }

  return {
    Weights,
    MOOD_PROFILES,
    isLegitimateTrack,
    computeArtistSimilarity,
    generateCandidates,
    scoreMoodAffinity,
    getPersonalizedRecommendations,
    buildQuickPicks,
    getSimilarTracks,
    getTrackRadio,
    buildRadioQueue: getTrackRadio,
    resetRadioSession,
    getDiscoveryFeed,
    resetDiscoverySession,
    getLastDiagnostics,
    recordInteraction,
    recordImportSignal
  };
})();

if (typeof window !== 'undefined') {
  window.RecommendationEngine = RecommendationEngine;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = RecommendationEngine;
}
