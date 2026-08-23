// ========================================
// MusicFlow — Audio ⇄ Video Switcher Engine
// ========================================

const VideoSwitcher = (() => {
  let currentMode = 'song'; // 'song' | 'video'
  let currentVideoId = null;
  const videoCache = new Map();

  const INVIDIOUS_INSTANCES = [
    'https://invidious.flokinet.to',
    'https://inv.nadeko.net',
    'https://invidious.drgns.space',
    'https://invidious.nerdvpn.de',
    'https://invidious.privacydev.net'
  ];

  function init() {
    setupTogglePill();
  }

  function setupTogglePill() {
    const fullPlayer = document.getElementById('full-player');
    if (!fullPlayer) return;

    let toggleWrap = document.getElementById('player-media-toggle');
    if (!toggleWrap) {
      toggleWrap = document.createElement('div');
      toggleWrap.id = 'player-media-toggle';
      toggleWrap.className = 'player-media-toggle-pill';
      toggleWrap.innerHTML = `
        <button class="media-toggle-btn active" data-mode="song">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
          Song
        </button>
        <button class="media-toggle-btn" data-mode="video">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
          Video
        </button>
      `;

      // Insert at the top of the full player content
      const fullHeader = fullPlayer.querySelector('.full-player__header') || fullPlayer.firstChild;
      fullPlayer.insertBefore(toggleWrap, fullHeader.nextSibling);
    }

    // Always bind all buttons inside toggleWrap
    toggleWrap.querySelectorAll('.media-toggle-btn').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        e.preventDefault();
        const mode = btn.dataset.mode;
        setMode(mode);
      };
    });

    // Video iframe container in artwork slot
    let videoContainer = document.getElementById('full-player-video-wrap');
    const artworkSlot = document.querySelector('.minimal-art-wrap, .full-player__artwork');
    if (!videoContainer && artworkSlot) {
      videoContainer = document.createElement('div');
      videoContainer.id = 'full-player-video-wrap';
      videoContainer.className = 'full-player-video-wrap';
      videoContainer.style.cssText = 'display:none; position:absolute; inset:0; width:100%; height:100%; border-radius:24px; overflow:hidden; z-index:50; background:#000;';
      artworkSlot.appendChild(videoContainer);
    }
  }

  async function resolveYouTubeVideoId(track) {
    if (!track) return null;
    const cacheKey = `${track.name}_${track.artists || ''}`.toLowerCase().trim();
    if (videoCache.has(cacheKey)) return videoCache.get(cacheKey);

    const query = `${track.name} ${track.artists || ''} official music video`;

    // Try Invidious API mirrors in fast sequence with timeout
    for (const host of INVIDIOUS_INSTANCES) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2800);
        const url = `${host}/api/v1/search?q=${encodeURIComponent(query)}&type=video`;
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json) && json.length > 0) {
            const first = json.find(x => x.type === 'video' || x.videoId) || json[0];
            const vId = first.videoId || first.id;
            if (vId) {
              videoCache.set(cacheKey, vId);
              return vId;
            }
          }
        }
      } catch (_) {
        // Try next mirror
      }
    }

    return null;
  }

  async function setMode(mode, explicitVideoId = null) {
    if (mode === currentMode && !explicitVideoId) return;
    currentMode = mode;

    const toggleWrap = document.getElementById('player-media-toggle');
    if (toggleWrap) {
      toggleWrap.querySelectorAll('.media-toggle-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
      });
    }

    const currentTrack = Player.getCurrentTrack();
    if (!currentTrack) return;

    const videoWrap = document.getElementById('full-player-video-wrap');
    const artworkImg = document.getElementById('full-player-img');
    const cardsDeck = document.getElementById('player-cards-swiper');
    const vinylVisual = document.querySelector('.artwork-vinyl');

    if (mode === 'video') {
      const currentTime = Math.floor(Player.getCurrentTime() || 0);
      
      // Pause HTML5 audio
      Player.pauseAudio();

      if (artworkImg) artworkImg.style.display = 'none';
      if (cardsDeck) cardsDeck.style.display = 'none';
      if (vinylVisual) vinylVisual.style.display = 'none';
      
      if (videoWrap) {
        videoWrap.style.display = 'block';
        videoWrap.innerHTML = `
          <div class="video-loading-indicator" style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:#fff; gap:12px; font-size:13px; background:#000;">
            <div class="spinner" style="width:28px; height:28px; border:3px solid rgba(255,255,255,0.2); border-top-color:var(--accent-color, #FA2D48); border-radius:50%; animation:spin 0.8s linear infinite;"></div>
            <span>Finding Official Music Video...</span>
          </div>
        `;

        const videoId = explicitVideoId || await resolveYouTubeVideoId(currentTrack);
        currentVideoId = videoId;

        if (videoId) {
          const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&start=${currentTime}&enablejsapi=1&playsinline=1&rel=0&iv_load_policy=3`;
          videoWrap.innerHTML = `
            <iframe 
              id="yt-video-embed" 
              src="${embedUrl}" 
              title="${currentTrack.name} Video" 
              frameborder="0" 
              style="width:100%; height:100%; border:none; border-radius:24px;"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
              allowfullscreen>
            </iframe>
          `;
          UI.showToast('Playing Official Music Video 🎬', 'success');
        } else {
          // Fallback UI if video cannot be resolved
          const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(currentTrack.name + ' ' + currentTrack.artists + ' official video')}`;
          videoWrap.innerHTML = `
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; padding:20px; text-align:center; background:#111216; color:#fff; border-radius:24px; box-sizing:border-box;">
              <span class="material-symbols-outlined" style="font-size:42px; color:#ff4757; margin-bottom:8px;">smart_display</span>
              <div style="font-size:14px; font-weight:800; margin-bottom:4px; max-width:90%; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${currentTrack.name}</div>
              <div style="font-size:12px; color:rgba(255,255,255,0.6); margin-bottom:14px;">Direct embed restricted by copyright holder.</div>
              <div style="display:flex; gap:8px;">
                <a href="${searchUrl}" target="_blank" rel="noopener noreferrer" style="background:#ff0000; color:#fff; padding:8px 16px; border-radius:9999px; font-size:12px; font-weight:700; text-decoration:none; display:inline-flex; align-items:center; gap:6px;">
                  <span class="material-symbols-outlined" style="font-size:16px;">open_in_new</span>
                  <span>Watch on YouTube</span>
                </a>
                <button onclick="VideoSwitcher.setMode('song')" style="background:rgba(255,255,255,0.12); color:#fff; border:none; padding:8px 14px; border-radius:9999px; font-size:12px; font-weight:700; cursor:pointer;">
                  Audio Mode
                </button>
              </div>
            </div>
          `;
        }
      }
    } else {
      // Switch back to Song mode
      if (videoWrap) {
        videoWrap.innerHTML = '';
        videoWrap.style.display = 'none';
      }
      if (artworkImg) artworkImg.style.display = 'block';
      if (cardsDeck) cardsDeck.style.display = 'block';
      if (vinylVisual) vinylVisual.style.display = '';

      // Resume HTML5 audio
      await Player.resumeAudio();
      UI.showToast('Switched to High-Res Audio Mode 🎵', 'info');
    }
  }

  function getCurrentMode() {
    return currentMode;
  }

  function resetToSongMode() {
    if (currentMode === 'video') {
      setMode('song');
    }
  }

  return {
    init,
    setMode,
    switchToMode: setMode,
    getCurrentMode,
    resetToSongMode,
    resolveYouTubeVideoId
  };
})();

window.VideoSwitcher = VideoSwitcher;
