(() => {
  const CONFIG_STORAGE_KEY = 'aiSearchProConfig';
  const VIEW_CONFIG = {
    settings: {
      frameId: 'shell-frame-settings',
      src: '../settings/settings.html?embedded=1'
    },
    prompts: {
      frameId: 'shell-frame-prompts',
      src: '../prompt-library/prompt_library.html?embedded=1'
    },
    memo: {
      frameId: 'shell-frame-memo',
      src: '../favorites/favorites.html?embedded=1'
    }
  };

  const navButtons = Array.from(document.querySelectorAll('.shell-nav-btn[data-view]'));
  const compareBtn = document.getElementById('shell-nav-compare');
  const loadedViews = new Set();
  const themeMedia = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function resolveTheme(theme) {
    if (theme === 'auto') return themeMedia?.matches ? 'dark' : 'light';
    return theme === 'dark' ? 'dark' : 'light';
  }

  function applyTheme(theme) {
    const mode = resolveTheme(theme);
    if (mode === 'dark') {
      document.documentElement.setAttribute('data-ai-sp-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-ai-sp-theme');
    }
  }

  function parseRoute() {
    const raw = window.location.hash.replace(/^#/, '');
    const [viewPart, sectionPart] = raw.split('/');
    const view = VIEW_CONFIG[viewPart] ? viewPart : 'settings';
    return {
      view,
      section: view === 'settings' && sectionPart ? decodeURIComponent(sectionPart) : ''
    };
  }

  function buildFrameSrc(view, section = '') {
    const base = VIEW_CONFIG[view]?.src || VIEW_CONFIG.settings.src;
    if (view === 'settings' && section) return `${base}#${encodeURIComponent(section)}`;
    return base;
  }

  function updateActiveNav(view) {
    navButtons.forEach((button) => {
      button.classList.toggle('is-active', button.dataset.view === view);
    });
  }

  function ensureFrame(view, section = '') {
    const config = VIEW_CONFIG[view];
    const frame = document.getElementById(config.frameId);
    const nextSrc = buildFrameSrc(view, section);
    if (!loadedViews.has(view)) {
      frame.src = nextSrc;
      loadedViews.add(view);
      return frame;
    }
    if (view === 'settings' && section) {
      const currentHash = frame.contentWindow?.location?.hash?.replace(/^#/, '') || '';
      if (currentHash !== section) {
        frame.src = nextSrc;
      }
    }
    return frame;
  }

  function updateVisibleFrame(view) {
    Object.entries(VIEW_CONFIG).forEach(([key, config]) => {
      const frame = document.getElementById(config.frameId);
      frame.classList.toggle('is-active', key === view);
    });
  }

  function activateRoute(route, syncHash = false) {
    const view = VIEW_CONFIG[route.view] ? route.view : 'settings';
    const section = view === 'settings' ? route.section : '';
    ensureFrame(view, section);
    updateVisibleFrame(view);
    updateActiveNav(view);
    if (syncHash) {
      const nextHash = view === 'settings' && section ? `#${view}/${encodeURIComponent(section)}` : `#${view}`;
      if (window.location.hash !== nextHash) {
        window.location.hash = nextHash;
      }
    }
  }

  navButtons.forEach((button) => {
    button.addEventListener('click', () => {
      activateRoute({ view: button.dataset.view || 'settings', section: '' }, true);
    });
  });

  compareBtn?.addEventListener('click', () => {
    if (typeof window.__AI_SEARCH_PRO_NAVIGATE === 'function') {
      window.__AI_SEARCH_PRO_NAVIGATE('compare/compare.html');
      return;
    }
    window.location.href = chrome.runtime.getURL('compare/compare.html');
  });

  window.addEventListener('hashchange', () => {
    activateRoute(parseRoute(), false);
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[CONFIG_STORAGE_KEY]?.newValue) return;
    applyTheme(changes[CONFIG_STORAGE_KEY].newValue.theme);
  });
  themeMedia?.addEventListener?.('change', async () => {
    const data = await chrome.storage.local.get([CONFIG_STORAGE_KEY]);
    if (data?.[CONFIG_STORAGE_KEY]?.theme === 'auto') {
      applyTheme('auto');
    }
  });
  chrome.storage.local.get([CONFIG_STORAGE_KEY]).then((data) => {
    applyTheme(data?.[CONFIG_STORAGE_KEY]?.theme || 'auto');
  });

  activateRoute(parseRoute(), false);
})();
