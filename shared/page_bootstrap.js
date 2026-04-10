(() => {
  const CONFIG_STORAGE_KEY = 'aiSearchProConfig';
  const THEME_SNAPSHOT_KEY = 'aiSearchProThemeSnapshot';
  const SHELL_PAGE = 'shell/shell.html';
  const root = document.documentElement;
  const systemThemeQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  const params = new URLSearchParams(window.location.search);

  function resolveTheme(theme) {
    if (theme === 'auto') return systemThemeQuery?.matches ? 'dark' : 'light';
    return theme === 'dark' ? 'dark' : 'light';
  }

  function applyTheme(theme) {
    const mode = resolveTheme(theme);
    if (mode === 'dark') {
      root.setAttribute('data-ai-sp-theme', 'dark');
    } else {
      root.removeAttribute('data-ai-sp-theme');
    }
    try {
      sessionStorage.setItem(THEME_SNAPSHOT_KEY, mode);
    } catch (e) {}
  }

  function showPage() {
    root.setAttribute('data-page-ready', '1');
  }

  function resolvePagePath(pagePath) {
    const normalized = String(pagePath || '').replace(/^\/+/, '');
    const [basePath, hashPart = ''] = normalized.split('#');
    if (basePath === 'settings/settings.html') {
      return `${SHELL_PAGE}#settings${hashPart ? `/${hashPart}` : ''}`;
    }
    if (basePath === 'prompt-library/prompt_library.html') {
      return `${SHELL_PAGE}#prompts`;
    }
    if (basePath === 'favorites/favorites.html') {
      return `${SHELL_PAGE}#memo`;
    }
    return normalized;
  }

  root.setAttribute('data-page-ready', '0');
  if (params.get('embedded') === '1') {
    root.setAttribute('data-embedded', '1');
  }

  try {
    const cachedTheme = sessionStorage.getItem(THEME_SNAPSHOT_KEY);
    if (cachedTheme === 'dark' || cachedTheme === 'light') {
      applyTheme(cachedTheme);
    } else {
      applyTheme('auto');
    }
  } catch (e) {
    applyTheme('auto');
  }

  window.__AI_SEARCH_PRO_NAVIGATE = (pagePath) => {
    try {
      const currentTheme = root.getAttribute('data-ai-sp-theme') === 'dark' ? 'dark' : 'light';
      sessionStorage.setItem(THEME_SNAPSHOT_KEY, currentTheme);
    } catch (e) {}
    window.location.href = chrome.runtime.getURL(resolvePagePath(pagePath));
  };

  try {
    chrome.storage.local.get([CONFIG_STORAGE_KEY], (result) => {
      if (chrome.runtime?.lastError) {
        showPage();
        return;
      }
      applyTheme(result?.[CONFIG_STORAGE_KEY]?.theme || 'auto');
      showPage();
    });
  } catch (e) {
    showPage();
  }

  window.setTimeout(showPage, 180);
})();
