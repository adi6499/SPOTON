// ========================================
// MusicFlow — Comprehensive Tabbed Settings, User Profile & Onboarding Engine
// ========================================

const Settings = (() => {
  const ACCENT_COLORS = {
    crimson: { name: 'Ruby Crimson (Signature)', primary: '#FA2D48', light: '#FF5E7E', glow: 'rgba(250, 45, 72, 0.42)', text: '#ffffff' },
    purple: { name: 'Electric Purple', primary: '#6c5ce7', light: '#a29bfe', glow: 'rgba(108, 92, 231, 0.4)', text: '#ffffff' },
    green: { name: 'Emerald Green', primary: '#00b894', light: '#55efc4', glow: 'rgba(0, 184, 148, 0.4)', text: '#ffffff' },
    red: { name: 'Crimson Red', primary: '#d63031', light: '#ff7675', glow: 'rgba(214, 48, 49, 0.4)', text: '#ffffff' },
    blue: { name: 'Ocean Blue', primary: '#0984e3', light: '#74b9ff', glow: 'rgba(9, 132, 227, 0.4)', text: '#ffffff' },
    pink: { name: 'Velvet Pink', primary: '#e84393', light: '#fd79a8', glow: 'rgba(232, 67, 147, 0.4)', text: '#ffffff' },
    orange: { name: 'Sunset Orange', primary: '#e17055', light: '#fab1a0', glow: 'rgba(225, 112, 85, 0.4)', text: '#ffffff' },
    cyan: { name: 'Cyberpunk Cyan', primary: '#00cec9', light: '#81ecec', glow: 'rgba(0, 206, 201, 0.4)', text: '#ffffff' }
  };

  const AVATAR_PRESETS = ['🎧', '👑', '⚡', '🎵', '🎸', '🏎️', '🚀', '🦊', '🐉', '🎙️', '🌌', '💎'];

  function init() {
    applyAllSettings();
    setupTabSwitcher();
    setupSettingsModalEvents();
    setupProfileModalEvents();
    renderProfileHeader();
    renderProfileTabContent();
    checkAndShowOnboarding();
  }

  function applyAllSettings() {
    const settings = Storage.getSettings();
    const prefs = Storage.getLibraryPreferences();

    // 1. Theme
    applyTheme(settings.theme || 'dark');

    // 2. Accent Color (auto-migrate from legacy lime)
    let activeAccent = settings.accentColor;
    if (!activeAccent || activeAccent === 'lime') {
      activeAccent = 'crimson';
      Storage.updateSettings({ accentColor: 'crimson' });
    }
    applyAccentColor(activeAccent);

    // 3. Font Size & Density
    applyFontSize(settings.fontSize || 'medium');
    applyLayoutDensity(prefs.layoutDensity || 'comfortable');

    // 4. Glassmorphism (Disabled by default for maximum speed & clarity)
    const isGlass = settings.glass === true || settings.glassEffect === true;
    if (isGlass) {
      document.body.classList.add('ultra-glass', 'clear-glass');
    } else {
      document.body.classList.remove('ultra-glass', 'clear-glass');
    }

    // 5. Custom Background Atmosphere & Color
    applyCustomBackground(settings.customBgPreset || 'default', settings.customBgColor || null);
  }

  const BG_PRESETS = {
    default: { name: 'Dynamic Ambient', bg: '', color: 'rgba(29, 185, 84, 0.55)', baseColor: '#0a0812' },
    midnight: { name: 'Midnight Nebula', bg: 'linear-gradient(135deg, #0b0f19 0%, #1a103c 100%)', color: '#6c5ce7', baseColor: '#0b0f19' },
    cosmic: { name: 'Cosmic Purple', bg: 'linear-gradient(135deg, #180922 0%, #3b0764 100%)', color: '#a855f7', baseColor: '#180922' },
    ocean: { name: 'Ocean Breeze', bg: 'linear-gradient(135deg, #031b2e 0%, #0369a1 100%)', color: '#0ea5e9', baseColor: '#031b2e' },
    emerald: { name: 'Emerald Forest', bg: 'linear-gradient(135deg, #051b14 0%, #047857 100%)', color: '#10b981', baseColor: '#051b14' },
    sunset: { name: 'Sunset Horizon', bg: 'linear-gradient(135deg, #240b15 0%, #831843 100%)', color: '#ec4899', baseColor: '#240b15' },
    oled: { name: 'Pitch Black', bg: '#000000', color: '#111111', baseColor: '#000000' }
  };

  function applyCustomBackground(bgPreset, customHex = null) {
    const dynBg = document.getElementById('dynamic-bg');
    if (customHex) {
      document.body.classList.add('has-custom-bg');
      document.documentElement.style.setProperty('--surface', customHex);
      document.documentElement.style.setProperty('--bg-base', customHex);
      document.documentElement.style.setProperty('--bg-elevated', customHex);
      document.documentElement.style.setProperty('--dynamic-color', customHex);
      document.body.style.background = customHex;
      if (dynBg) {
        dynBg.style.background = `radial-gradient(circle at 50% 0%, ${customHex} 0%, transparent 75%)`;
        dynBg.style.opacity = '0.9';
      }
      return;
    }

    if (bgPreset === 'default' || !bgPreset) {
      document.body.classList.remove('has-custom-bg');
      document.documentElement.style.removeProperty('--surface');
      document.documentElement.style.removeProperty('--bg-base');
      document.documentElement.style.removeProperty('--bg-elevated');
      document.documentElement.style.removeProperty('--dynamic-color');
      document.body.style.background = '';
      if (dynBg) {
        dynBg.style.background = '';
        dynBg.style.opacity = '0.85';
      }
      return;
    }

    const preset = BG_PRESETS[bgPreset];
    if (preset) {
      document.body.classList.add('has-custom-bg');
      document.body.style.background = preset.bg;
      document.documentElement.style.setProperty('--dynamic-color', preset.color);
      document.documentElement.style.setProperty('--bg-base', preset.baseColor);
      document.documentElement.style.setProperty('--bg-elevated', preset.baseColor);
      if (dynBg) {
        dynBg.style.background = preset.bg;
        dynBg.style.opacity = '0.9';
      }
    }
  }

  function setTheme(themeName, event = null) {
    if (typeof Haptics !== 'undefined' && Haptics.selection) Haptics.selection();
    Storage.updateSettings({ theme: themeName });
    applyTheme(themeName, event);

    const themeSelect = document.getElementById('select-theme');
    if (themeSelect) themeSelect.value = themeName;

    document.querySelectorAll('.theme-card-option').forEach(card => {
      const isMatch = card.dataset.theme === themeName;
      card.classList.toggle('active', isMatch);
      let badge = card.querySelector('.theme-card-badge');
      if (isMatch && !badge) {
        badge = document.createElement('span');
        badge.className = 'theme-card-badge';
        badge.textContent = 'Active';
        card.querySelector('.theme-card-label')?.appendChild(badge);
      } else if (!isMatch && badge) {
        badge.remove();
      }
    });

    if (typeof UI !== 'undefined' && UI.showToast) {
      UI.showToast(`Theme set to ${themeName.toUpperCase()}`, 'info');
    }
  }

  function applyTheme(theme, clickOrigin = null) {
    const updateDOM = () => {
      document.body.classList.remove('theme-light', 'theme-dark', 'theme-oled');
      if (theme === 'light') {
        document.body.classList.add('theme-light');
      } else if (theme === 'oled') {
        document.body.classList.add('theme-oled');
      } else if (theme === 'system') {
        const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
        if (prefersLight) document.body.classList.add('theme-light');
      }
      document.body.classList.add('theme-transitioning');
      setTimeout(() => document.body.classList.remove('theme-transitioning'), 600);
    };

    if (!document.startViewTransition || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) {
      updateDOM();
      return;
    }

    const x = clickOrigin?.clientX ?? window.innerWidth / 2;
    const y = clickOrigin?.clientY ?? window.innerHeight / 2;
    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );

    try {
      const transition = document.startViewTransition(() => {
        updateDOM();
      });

      transition.ready.then(() => {
        document.documentElement.animate(
          {
            clipPath: [
              `circle(0px at ${x}px ${y}px)`,
              `circle(${endRadius}px at ${x}px ${y}px)`
            ]
          },
          {
            duration: 520,
            easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
            pseudoElement: '::view-transition-new(root)'
          }
        );
      }).catch(() => {
        updateDOM();
      });
    } catch (_) {
      updateDOM();
    }
  }

  function applyAccentColor(colorKey) {
    if (colorKey === 'lime') colorKey = 'crimson';
    const palette = ACCENT_COLORS[colorKey] || ACCENT_COLORS.crimson;
    const root = document.documentElement;
    root.style.setProperty('--accent-color', palette.primary);
    root.style.setProperty('--primary', palette.primary);
    root.style.setProperty('--accent-light', palette.light);
    root.style.setProperty('--accent-glow', palette.glow);
    root.style.setProperty('--accent-contrast', palette.text || '#ffffff');
    root.style.setProperty('--on-primary', palette.text || '#ffffff');
    root.style.setProperty('--accent-gradient', `linear-gradient(135deg, ${palette.primary}, ${palette.light})`);
  }

  function applyFontSize(size) {
    const root = document.documentElement;
    if (size === 'compact') {
      root.style.fontSize = '14px';
    } else if (size === 'large') {
      root.style.fontSize = '17px';
    } else {
      root.style.fontSize = '15px';
    }
  }

  function applyLayoutDensity(density) {
    if (density === 'compact') {
      document.body.classList.add('density-compact');
    } else {
      document.body.classList.remove('density-compact');
    }
  }

  function setupTabSwitcher() {
    const tabButtons = document.querySelectorAll('.settings-tab-btn');
    const tabPanels = document.querySelectorAll('.settings-tab-panel');

    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.dataset.tab;
        tabButtons.forEach(b => b.classList.remove('active'));
        tabPanels.forEach(p => p.classList.remove('active'));

        btn.classList.add('active');
        const targetPanel = document.getElementById(targetTab);
        if (targetPanel) {
          targetPanel.classList.add('active');
          if (targetTab === 'tab-profile') {
            renderProfileTabContent();
          }
        }
      });
    });
  }

  function renderProfileHeader() {
    const profile = Storage.getUserProfile();
    
    // Header Chip
    const headerBtn = document.getElementById('btn-user-profile-header');
    if (headerBtn) {
      headerBtn.innerHTML = `
        <span class="user-avatar-badge">${profile.avatar || '🎧'}</span>
        <span class="user-name-badge">${profile.username || 'Adesh'}</span>
      `;
      headerBtn.onclick = () => openProfileModal();
    }

    // Now Playing Chip
    const npAvatar = document.getElementById('np-user-avatar');
    const npName = document.getElementById('np-user-name');
    if (npAvatar) npAvatar.textContent = profile.avatar || '🎧';
    if (npName) npName.textContent = profile.username || 'Adesh';

    // Sidebar User Profile Card
    const sidebarName = document.getElementById('sidebar-user-name');
    if (sidebarName) sidebarName.textContent = profile.username || 'Adesh';

    // Home Greeting
    const greetingEl = document.getElementById('home-greeting');
    if (greetingEl) {
      const hour = new Date().getHours();
      let greeting = 'Good Evening';
      if (hour < 12) greeting = 'Good Morning';
      else if (hour < 17) greeting = 'Good Afternoon';
      greetingEl.innerHTML = `${greeting}, <span class="home-greeting-user">${profile.username || 'Adesh'}</span> 👋`;
    }
  }

  function checkAndShowOnboarding() {
    const profile = Storage.getUserProfile();
    // Only show if never onboarded AND no existing user data is found
    if (!profile.hasOnboarded) {
      const hasExistingData = localStorage.getItem('mf_favorites') || 
                             localStorage.getItem('mf_playlists') || 
                             localStorage.getItem('mf_recent') || 
                             (profile.username && profile.username !== 'Adesh');
      if (hasExistingData) {
        Storage.saveUserProfile({ hasOnboarded: true });
        return;
      }

      const modal = document.getElementById('welcome-onboarding-modal');
      if (!modal) return;

      const avatarPreview = document.getElementById('onboarding-avatar-preview');
      const avatarPresets = document.getElementById('onboarding-avatar-presets');
      const nameInput = document.getElementById('onboarding-username-input');
      const submitBtn = document.getElementById('btn-submit-onboarding');

      let selectedAvatar = profile.avatar || '🎧';

      if (avatarPreview) avatarPreview.textContent = selectedAvatar;
      if (nameInput) {
        nameInput.value = (profile.username && profile.username !== 'Adesh') ? profile.username : '';
      }

      if (avatarPresets) {
        avatarPresets.innerHTML = AVATAR_PRESETS.map(av => `
          <button type="button" class="avatar-preset-btn ${selectedAvatar === av ? 'active' : ''}" data-avatar="${av}">
            ${av}
          </button>
        `).join('');

        avatarPresets.querySelectorAll('.avatar-preset-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            avatarPresets.querySelectorAll('.avatar-preset-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedAvatar = btn.dataset.avatar;
            if (avatarPreview) avatarPreview.textContent = selectedAvatar;
            if (typeof Haptics !== 'undefined' && Haptics.selection) Haptics.selection();
          });
        });
      }

      // Language chips: the single most important personalization signal
      const LANG_OPTIONS = ['hindi', 'english', 'punjabi', 'tamil', 'telugu', 'marathi', 'gujarati', 'bengali', 'kannada', 'bhojpuri', 'malayalam', 'urdu'];
      const langChipsWrap = document.getElementById('onboarding-lang-chips');
      let selectedLangs = new Set((Storage.getSettings().languages || ['hindi', 'english']).map(l => l.toLowerCase()));
      if (langChipsWrap) {
        langChipsWrap.innerHTML = LANG_OPTIONS.map(l => `
          <button type="button" class="lang-chip ${selectedLangs.has(l) ? 'active' : ''}" data-lang="${l}">
            ${l.charAt(0).toUpperCase() + l.slice(1)}
          </button>
        `).join('');
        langChipsWrap.querySelectorAll('.lang-chip').forEach(chip => {
          chip.addEventListener('click', () => {
            const l = chip.dataset.lang;
            if (selectedLangs.has(l)) {
              if (selectedLangs.size <= 1) {
                if (typeof UI !== 'undefined') UI.showToast('Keep at least one language selected', 'info');
                return;
              }
              selectedLangs.delete(l);
              chip.classList.remove('active');
            } else {
              selectedLangs.add(l);
              chip.classList.add('active');
            }
            if (typeof Haptics !== 'undefined' && Haptics.selection) Haptics.selection();
          });
        });
      }

      modal.style.display = 'flex';
      if (nameInput) setTimeout(() => nameInput.focus(), 300);

      const completeOnboarding = () => {
        const enteredName = nameInput ? nameInput.value.trim() : '';
        const finalName = enteredName || 'Adesh';

        Storage.saveUserProfile({
          username: finalName,
          avatar: selectedAvatar,
          hasOnboarded: true
        });

        // Persist language choice and rebuild recommendations around it
        if (selectedLangs && selectedLangs.size > 0) {
          Storage.updateSettings({ languages: [...selectedLangs] });
          try { localStorage.removeItem('mf_home_cache'); } catch (_) {}
          if (window.App && App.loadHomePage) App.loadHomePage(true);
        }

        modal.style.animation = 'fadeOut 0.3s ease forwards';
        setTimeout(() => {
          modal.style.display = 'none';
          modal.style.animation = '';
        }, 300);

        renderProfileHeader();
        if (typeof Haptics !== 'undefined' && Haptics.medium) Haptics.medium();
        if (typeof UI !== 'undefined' && UI.showToast) {
          UI.showToast(`✨ Welcome aboard, ${finalName}! Enjoy your lossless music experience.`, 'success');
        }
      };

      if (submitBtn) {
        submitBtn.onclick = completeOnboarding;
      }
      if (nameInput) {
        nameInput.onkeydown = (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            completeOnboarding();
          }
        };
      }
    }
  }

  function renderProfileTabContent() {
    const profile = Storage.getUserProfile();
    const stats = Storage.getStats();
    const history = Storage.getListeningHistory();

    const nameInput = document.getElementById('settings-username-input');
    const bioInput = document.getElementById('settings-bio-input');
    const avatarDisplay = document.getElementById('settings-profile-avatar');
    const statsTotalPlayed = document.getElementById('settings-stat-played');
    const statsTotalMinutes = document.getElementById('settings-stat-time');
    const statsTopArtist = document.getElementById('settings-stat-artist');
    const statsTopGenre = document.getElementById('settings-stat-genre');
    const avatarGrid = document.getElementById('settings-avatar-presets');

    if (nameInput) nameInput.value = profile.username || 'Adesh';
    if (bioInput) bioInput.value = profile.bio || 'Music enthusiast & audiophile';
    if (avatarDisplay) avatarDisplay.textContent = profile.avatar || '🎧';

    // 1. Language Preferences Selection Chips
    const PROFILE_LANGUAGES = [
      { id: 'english', label: 'English', flag: '🇬🇧' },
      { id: 'hindi', label: 'Hindi', flag: '🇮🇳' },
      { id: 'punjabi', label: 'Punjabi', flag: '🪕' },
      { id: 'tamil', label: 'Tamil', flag: '🌴' },
      { id: 'telugu', label: 'Telugu', flag: '🎬' },
      { id: 'spanish', label: 'Spanish', flag: '🇪🇸' },
      { id: 'korean', label: 'K-Pop', flag: '🇰🇷' },
      { id: 'japanese', label: 'J-Pop', flag: '🇯🇵' },
      { id: 'malayalam', label: 'Malayalam', flag: '🥥' },
      { id: 'kannada', label: 'Kannada', flag: '🐘' },
      { id: 'marathi', label: 'Marathi', flag: '🚩' },
      { id: 'gujarati', label: 'Gujarati', flag: '🦚' },
      { id: 'bengali', label: 'Bengali', flag: '🐅' },
      { id: 'bhojpuri', label: 'Bhojpuri', flag: '🌾' },
      { id: 'urdu', label: 'Urdu', flag: '🌙' }
    ];

    const langContainer = document.getElementById('settings-profile-lang-chips');
    const storedLangs = new Set((Storage.getSettings().languages || ['hindi', 'english']).map(l => l.toLowerCase()));
    if (langContainer) {
      langContainer.innerHTML = PROFILE_LANGUAGES.map(lang => {
        const isSelected = storedLangs.has(lang.id);
        return `
          <button type="button" class="taste-chip ${isSelected ? 'active' : ''}" data-lang-id="${lang.id}">
            <span>${lang.flag}</span>
            <span>${lang.label}</span>
          </button>
        `;
      }).join('');

      langContainer.querySelectorAll('.taste-chip').forEach(chip => {
        chip.addEventListener('click', () => {
          const lId = chip.dataset.langId;
          if (storedLangs.has(lId)) {
            if (storedLangs.size <= 1) {
              if (typeof UI !== 'undefined') UI.showToast('Keep at least one language selected', 'info');
              return;
            }
            storedLangs.delete(lId);
            chip.classList.remove('active');
          } else {
            storedLangs.add(lId);
            chip.classList.add('active');
          }
          if (typeof Haptics !== 'undefined' && Haptics.selection) Haptics.selection();
        });
      });
    }

    // 2. Music Genres & Song Types Selection Chips
    const PROFILE_GENRES = [
      { id: 'pop', label: 'Pop Hits', icon: '🌟' },
      { id: 'hiphop', label: 'Hip-Hop & Rap', icon: '🎤' },
      { id: 'edm', label: 'EDM & Dance', icon: '⚡' },
      { id: 'bollywood', label: 'Bollywood Hits', icon: '✨' },
      { id: 'lofi', label: 'Lo-Fi & Chill', icon: '🍃' },
      { id: 'acoustic', label: 'Acoustic & Unplugged', icon: '🎸' },
      { id: 'rock', label: 'Rock & Metal', icon: '🤘' },
      { id: 'rnb', label: 'R&B & Soul', icon: '🎷' },
      { id: 'party', label: 'Party & Club', icon: '🎉' },
      { id: 'classical', label: 'Classical & Sufi', icon: '🎻' },
      { id: 'workout', label: 'Workout & Energy', icon: '🔥' },
      { id: 'indie', label: 'Indie Vibes', icon: '🎧' },
      { id: 'sad', label: 'Sad & Emotional', icon: '🌧️' }
    ];

    const genreContainer = document.getElementById('settings-profile-genre-chips');
    const storedGenres = new Set((profile.favoriteGenres || ['pop', 'bollywood', 'lofi']).map(g => g.toLowerCase()));
    if (genreContainer) {
      genreContainer.innerHTML = PROFILE_GENRES.map(g => {
        const isSelected = storedGenres.has(g.id);
        return `
          <button type="button" class="taste-chip ${isSelected ? 'active' : ''}" data-genre-id="${g.id}">
            <span>${g.icon}</span>
            <span>${g.label}</span>
          </button>
        `;
      }).join('');

      genreContainer.querySelectorAll('.taste-chip').forEach(chip => {
        chip.addEventListener('click', () => {
          const gId = chip.dataset.genreId;
          if (storedGenres.has(gId)) {
            storedGenres.delete(gId);
            chip.classList.remove('active');
          } else {
            storedGenres.add(gId);
            chip.classList.add('active');
          }
          if (typeof Haptics !== 'undefined' && Haptics.selection) Haptics.selection();
        });
      });
    }

    // Calculate real dynamic stats
    const totalSongs = stats.totalPlays || history.length || 0;
    const totalSeconds = history.reduce((sum, h) => sum + (h.song?.duration || 180), 0);
    const totalHours = (totalSeconds / 3600).toFixed(1);

    const topArtistsMap = stats.topArtists || {};
    let topArtistName = Object.keys(topArtistsMap).sort((a, b) => topArtistsMap[b] - topArtistsMap[a])[0];
    if (!topArtistName && history.length > 0) {
      topArtistName = history[0].song?.artists || history[0].song?.artist;
    }
    if (!topArtistName) {
      topArtistName = 'Discovering...';
    }

    let topGenreName = stats.topGenre;
    if (!topGenreName && history.length > 0) {
      const lang = history[0].song?.language;
      topGenreName = lang ? `${lang.charAt(0).toUpperCase() + lang.slice(1)} & Hits` : 'Personalized Mix';
    }
    if (!topGenreName) {
      topGenreName = 'Explore Mixes';
    }

    if (statsTotalPlayed) statsTotalPlayed.textContent = totalSongs;
    if (statsTotalMinutes) statsTotalMinutes.textContent = `${totalHours} hrs`;
    if (statsTopArtist) statsTopArtist.textContent = topArtistName;
    if (statsTopGenre) statsTopGenre.textContent = topGenreName;

    if (avatarGrid) {
      avatarGrid.innerHTML = AVATAR_PRESETS.map(av => `
        <button class="avatar-preset-btn ${profile.avatar === av ? 'active' : ''}" data-avatar="${av}">
          ${av}
        </button>
      `).join('');

      avatarGrid.querySelectorAll('.avatar-preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          avatarGrid.querySelectorAll('.avatar-preset-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          if (avatarDisplay) avatarDisplay.textContent = btn.dataset.avatar;
          if (typeof Haptics !== 'undefined' && Haptics.selection) Haptics.selection();
        });
      });
    }
  }

  function openProfileModal() {
    // Open tabbed settings directly on Profile tab
    const modal = document.getElementById('settings-modal');
    if (modal) {
      modal.style.display = 'flex';
      const profileTabBtn = document.querySelector('[data-tab="tab-profile"]');
      if (profileTabBtn) profileTabBtn.click();
    }
  }

  function closeProfileModal() {
    const modal = document.getElementById('user-profile-modal');
    if (modal) modal.style.display = 'none';
  }

  function setupProfileModalEvents() {
    document.getElementById('btn-close-profile')?.addEventListener('click', closeProfileModal);
    
    document.getElementById('btn-save-settings-profile')?.addEventListener('click', () => {
      const nameInput = document.getElementById('settings-username-input');
      const bioInput = document.getElementById('settings-bio-input');
      const avatarDisplay = document.getElementById('settings-profile-avatar');

      // Collect selected languages and genres
      const langChips = document.querySelectorAll('#settings-profile-lang-chips .taste-chip.active');
      const selectedLangs = Array.from(langChips).map(c => c.dataset.langId).filter(Boolean);

      const genreChips = document.querySelectorAll('#settings-profile-genre-chips .taste-chip.active');
      const selectedGenres = Array.from(genreChips).map(c => c.dataset.genreId).filter(Boolean);

      const updated = Storage.saveUserProfile({
        username: nameInput?.value.trim() || 'Adesh',
        bio: bioInput?.value.trim() || '',
        avatar: avatarDisplay?.textContent || '🎧',
        favoriteGenres: selectedGenres,
        hasOnboarded: true
      });

      if (selectedLangs.length > 0) {
        Storage.updateSettings({ languages: selectedLangs });
        try { localStorage.removeItem('mf_home_cache'); } catch (_) {}
        if (window.App && App.loadHomePage) App.loadHomePage(true);
      }

      renderProfileHeader();
      if (typeof Haptics !== 'undefined' && Haptics.medium) Haptics.medium();
      UI.showToast(`✨ Profile & Music Taste saved successfully!`, 'success');
    });
  }

  function setupSettingsModalEvents() {
    // 1. Theme Select (Live Preview)
    const themeSelect = document.getElementById('select-theme');
    if (themeSelect) {
      themeSelect.value = Storage.getSettings().theme || 'dark';
      themeSelect.addEventListener('change', (e) => {
        const theme = e.target.value;
        Storage.updateSettings({ theme });
        applyTheme(theme, e);
        UI.showToast(`Theme updated: ${theme.toUpperCase()}`, 'info');
      });
    }

    // 2. Accent Color Select (Live Preview)
    const colorSelect = document.getElementById('select-color');
    if (colorSelect) {
      colorSelect.value = Storage.getSettings().accentColor || 'lime';
      colorSelect.addEventListener('change', (e) => {
        const color = e.target.value;
        Storage.updateSettings({ accentColor: color });
        applyAccentColor(color);
        const name = ACCENT_COLORS[color]?.name || color;
        UI.showToast(`Accent color updated: ${name}`, 'info');
      });
    }

    // 3. Font Size Select (Live Preview)
    const fontSelect = document.getElementById('select-font-size');
    if (fontSelect) {
      fontSelect.value = Storage.getSettings().fontSize || 'medium';
      fontSelect.addEventListener('change', (e) => {
        const size = e.target.value;
        Storage.updateSettings({ fontSize: size });
        applyFontSize(size);
        UI.showToast(`Font size set to ${size}`, 'info');
      });
    }

    // 4. Layout Density Select (Live Preview)
    const densitySelect = document.getElementById('select-layout-density');
    if (densitySelect) {
      densitySelect.value = Storage.getLibraryPreferences().layoutDensity || 'comfortable';
      densitySelect.addEventListener('change', (e) => {
        const density = e.target.value;
        Storage.saveLibraryPreferences({ layoutDensity: density });
        applyLayoutDensity(density);
        UI.showToast(`Layout density: ${density}`, 'info');
      });
    }

    // 5. Crossfade Duration Slider & Toggle
    const crossfadeSlider = document.getElementById('input-crossfade-duration');
    const crossfadeDurationLabel = document.getElementById('label-crossfade-duration');
    const toggleCrossfade = document.getElementById('toggle-crossfade');

    if (crossfadeSlider) {
      const currentVal = Storage.getSettings().crossfade?.duration || 3;
      crossfadeSlider.value = currentVal;
      if (crossfadeDurationLabel) crossfadeDurationLabel.textContent = `${currentVal}s`;

      crossfadeSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        if (crossfadeDurationLabel) crossfadeDurationLabel.textContent = `${val}s`;
        Storage.updateSettings({
          crossfade: {
            enabled: toggleCrossfade ? toggleCrossfade.checked : true,
            duration: val
          }
        });
      });
    }

    if (toggleCrossfade) {
      toggleCrossfade.checked = Storage.getSettings().crossfade?.enabled !== false;
      toggleCrossfade.addEventListener('change', (e) => {
        const dur = crossfadeSlider ? parseInt(crossfadeSlider.value, 10) : 3;
        Storage.updateSettings({
          crossfade: {
            enabled: e.target.checked,
            duration: dur
          }
        });
        UI.showToast(e.target.checked ? 'Crossfade enabled' : 'Crossfade disabled', 'info');
      });
    }

    // 6. Autoplay Toggle
    const autoplayToggle = document.getElementById('toggle-autoplay');
    if (autoplayToggle) {
      autoplayToggle.checked = Storage.getSettings().autoplay !== false;
      autoplayToggle.addEventListener('change', (e) => {
        Storage.updateSettings({ autoplay: e.target.checked });
        UI.showToast(e.target.checked ? 'Autoplay enabled' : 'Autoplay disabled', 'info');
      });
    }

    // 6b. Apple Music Haptic Feedback Toggle
    const hapticsToggle = document.getElementById('toggle-haptics');
    if (hapticsToggle) {
      hapticsToggle.checked = Storage.getSettings().hapticsEnabled !== false;
      hapticsToggle.addEventListener('change', (e) => {
        Storage.updateSettings({ hapticsEnabled: e.target.checked });
        if (e.target.checked && typeof Haptics !== 'undefined') {
          Haptics.success();
        }
        UI.showToast(e.target.checked ? '📳 Apple Music Haptics enabled' : 'Haptics disabled', 'info');
      });
    }

    // 7. Library Preferences: Show Podcasts Toggle
    const showPodcastsToggle = document.getElementById('toggle-show-podcasts');
    if (showPodcastsToggle) {
      showPodcastsToggle.checked = Storage.getLibraryPreferences().showPodcasts !== false;
      showPodcastsToggle.addEventListener('change', (e) => {
        Storage.saveLibraryPreferences({ showPodcasts: e.target.checked });
        UI.showToast(e.target.checked ? 'Showing podcasts in library' : 'Hiding podcasts in library', 'info');
      });
    }

    // 8. Library Preferences: Default Sort Order
    const sortSelect = document.getElementById('select-library-sort');
    if (sortSelect) {
      sortSelect.value = Storage.getLibraryPreferences().sortBy || 'recent';
      sortSelect.addEventListener('change', (e) => {
        Storage.saveLibraryPreferences({ sortBy: e.target.value });
        UI.showToast(`Library default sort: ${e.target.value}`, 'info');
      });
    }

    // 9. Glassmorphism Toggle (defaults to false)
    const glassToggle = document.getElementById('toggle-glass');
    if (glassToggle) {
      const isGlass = Storage.getSettings().glass === true || Storage.getSettings().glassEffect === true;
      glassToggle.checked = isGlass;
      glassToggle.addEventListener('change', (e) => {
        const val = e.target.checked;
        Storage.updateSettings({ glass: val, glassEffect: val });
        if (val) {
          document.body.classList.add('ultra-glass', 'clear-glass');
        } else {
          document.body.classList.remove('ultra-glass', 'clear-glass');
        }
        if (typeof UI !== 'undefined' && UI.showToast) {
          UI.showToast(`Glassmorphism ${val ? 'enabled' : 'disabled'}`);
        }
      });
    }

    // 9. Custom Background Atmosphere Preset Buttons & Hex Picker
    const bgPresets = document.getElementById('custom-bg-presets');
    if (bgPresets) {
      const currentPreset = Storage.getSettings().customBgPreset || 'default';
      bgPresets.querySelectorAll('.bg-preset-chip').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.bg === currentPreset);
        btn.addEventListener('click', () => {
          bgPresets.querySelectorAll('.bg-preset-chip').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const bgVal = btn.dataset.bg;
          Storage.updateSettings({ customBgPreset: bgVal, customBgColor: null });
          applyCustomBackground(bgVal);
          const name = BG_PRESETS[bgVal]?.name || bgVal;
          UI.showToast(`Background atmosphere: ${name}`, 'info');
        });
      });
    }

    const hexInput = document.getElementById('input-custom-bg-color');
    if (hexInput) {
      if (Storage.getSettings().customBgColor) {
        hexInput.value = Storage.getSettings().customBgColor;
      }
      hexInput.addEventListener('input', (e) => {
        const hex = e.target.value;
        Storage.updateSettings({ customBgColor: hex, customBgPreset: null });
        applyCustomBackground(null, hex);
        if (bgPresets) {
          bgPresets.querySelectorAll('.bg-preset-chip').forEach(b => b.classList.remove('active'));
        }
      });
    }

    // 10. PWA Installation Handler
    const pwaBtn = document.getElementById('btn-settings-install-pwa');
    if (pwaBtn) {
      pwaBtn.addEventListener('click', () => {
        openPwaModal();
      });
    }

    // 11. Close settings modal button
    document.getElementById('btn-close-settings')?.addEventListener('click', () => {
      const modal = document.getElementById('settings-modal');
      if (modal) modal.style.display = 'none';
    });
  }

  function openPwaModal() {
    if (window.deferredPwaPrompt) {
      window.deferredPwaPrompt.prompt();
      window.deferredPwaPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          UI.showToast('🎉 Welcome to MusicFlow App!', 'success');
          if (typeof Haptics !== 'undefined') Haptics.success();
        }
        window.deferredPwaPrompt = null;
      });
      return;
    }

    const modal = document.getElementById('pwa-install-modal');
    const body = document.getElementById('pwa-install-modal-body');
    if (!modal || !body) return;

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

    if (isStandalone) {
      body.innerHTML = `
        <div style="text-align: center; padding: 20px 10px;">
          <div style="font-size: 48px; margin-bottom: 12px;">🎉</div>
          <h3 style="margin: 0 0 8px 0; font-size: 18px; color: #fff;">MusicFlow is Already Installed!</h3>
          <p style="color: var(--text-secondary); font-size: 13px; margin: 0 0 20px 0; line-height: 1.4;">You are currently enjoying the full native standalone experience with high-res audio and offline playback.</p>
          <button class="btn-primary" style="width: 100%; border-radius: var(--radius-full); padding: 12px;" onclick="Settings.closePwaModal()">Awesome!</button>
        </div>
      `;
    } else if (isIOS) {
      body.innerHTML = `
        <div class="pwa-guide-container">
          <div class="pwa-guide-step">
            <div class="pwa-step-num">1</div>
            <div class="pwa-step-text">
              <strong>Tap the Share button</strong>
              <span>Tap the <span style="display:inline-flex; align-items:center; background:rgba(255,255,255,0.12); padding:2px 6px; border-radius:6px; font-weight:700;">📤 Share</span> icon at the bottom of Safari.</span>
            </div>
          </div>
          <div class="pwa-guide-step">
            <div class="pwa-step-num">2</div>
            <div class="pwa-step-text">
              <strong>Select "Add to Home Screen"</strong>
              <span>Scroll down and tap <span style="display:inline-flex; align-items:center; background:rgba(255,255,255,0.12); padding:2px 6px; border-radius:6px; font-weight:700;">➕ Add to Home Screen</span>.</span>
            </div>
          </div>
          <div class="pwa-guide-step">
            <div class="pwa-step-num">3</div>
            <div class="pwa-step-text">
              <strong>Tap "Add" in Top Right</strong>
              <span>Tap <strong>Add</strong> to launch MusicFlow as a native app with zero browser bars!</span>
            </div>
          </div>
          <button class="btn-primary" style="width: 100%; margin-top: 16px; border-radius: var(--radius-full); padding: 12px;" onclick="Settings.closePwaModal()">Got It!</button>
        </div>
      `;
    } else {
      body.innerHTML = `
        <div class="pwa-guide-container">
          <div class="pwa-guide-step">
            <div class="pwa-step-num">1</div>
            <div class="pwa-step-text">
              <strong>Browser Address Bar / Menu</strong>
              <span>Click the <span style="display:inline-flex; align-items:center; background:rgba(255,255,255,0.12); padding:2px 6px; border-radius:6px; font-weight:700;">⊕ Install App</span> or <span style="display:inline-flex; align-items:center; background:rgba(255,255,255,0.12); padding:2px 6px; border-radius:6px; font-weight:700;">⋮ Menu → Install</span> in Chrome / Edge.</span>
            </div>
          </div>
          <div class="pwa-guide-step">
            <div class="pwa-step-num">2</div>
            <div class="pwa-step-text">
              <strong>Confirm Installation</strong>
              <span>Click <strong>Install</strong> to add MusicFlow to your Desktop or App Drawer.</span>
            </div>
          </div>
          <button class="btn-primary" style="width: 100%; margin-top: 16px; border-radius: var(--radius-full); padding: 12px;" onclick="Settings.closePwaModal()">Got It!</button>
        </div>
      `;
    }

    modal.style.display = 'flex';
    if (typeof Haptics !== 'undefined' && Haptics.light) Haptics.light();
  }

  function closePwaModal() {
    const modal = document.getElementById('pwa-install-modal');
    if (modal) modal.style.display = 'none';
  }

  return {
    init,
    setTheme,
    openProfileModal,
    closeProfileModal,
    openPwaModal,
    closePwaModal,
    applyAllSettings,
    renderProfileHeader,
    renderProfileTabContent,
    checkAndShowOnboarding
  };
})();

window.Settings = Settings;
