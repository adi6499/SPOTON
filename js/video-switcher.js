// ========================================
// MusicFlow — Audio ⇄ Video Switcher Engine
// ========================================

const VideoSwitcher = (() => {
  let currentMode = 'song'; // 'song' | 'video'
  let currentVideoId = null;
  let videoPlayerIframe = null;

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

      toggleWrap.querySelectorAll('.media-toggle-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const mode = btn.dataset.mode;
          setMode(mode);
        });
      });
    }

    // Video iframe container in artwork slot
    let videoContainer = document.getElementById('full-player-video-wrap');
    const artworkSlot = document.querySelector('.full-player__artwork');
    if (!videoContainer && artworkSlot) {
      videoContainer = document.createElement('div');
      videoContainer.id = 'full-player-video-wrap';
      videoContainer.className = 'full-player-video-wrap';
      videoContainer.style.display = 'none';
      artworkSlot.appendChild(videoContainer);
    }
  }

  async function setMode(mode) {
    if (mode === currentMode) return;
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
    const vinylVisual = document.querySelector('.artwork-vinyl');

    if (mode === 'video') {
      const currentTime = Math.floor(Player.getCurrentTime() || 0);
      
      // Pause HTML5 audio
      Player.pauseAudio();

      if (artworkImg) artworkImg.style.display = 'none';
      if (vinylVisual) vinylVisual.style.display = 'none';
      if (videoWrap) {
        videoWrap.style.display = 'block';
        videoWrap.innerHTML = `
          <div class="video-loading-indicator">
            <div class="spinner"></div>
            <span>Loading official music video...</span>
          </div>
        `;

        // Search and embed YouTube video
        const searchQuery = encodeURIComponent(`${currentTrack.name} ${currentTrack.artists} official music video`);
        const embedUrl = `https://www.youtube-nocookie.com/embed?listType=search&list=${searchQuery}&autoplay=1&start=${currentTime}&enablejsapi=1`;

        videoWrap.innerHTML = `
          <iframe 
            id="yt-video-embed" 
            src="${embedUrl}" 
            title="${currentTrack.name} Video" 
            frameborder="0" 
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
            allowfullscreen>
          </iframe>
        `;
      }
      UI.showToast('Switched to Video Mode 🎬', 'info');
    } else {
      // Switch back to Song mode
      if (videoWrap) {
        videoWrap.innerHTML = '';
        videoWrap.style.display = 'none';
      }
      if (artworkImg) artworkImg.style.display = 'block';
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
    getCurrentMode,
    resetToSongMode
  };
})();

window.VideoSwitcher = VideoSwitcher;
