(() => {
  const STORAGE_KEY = 'aiSearchProConfig';
  const PROMPT_LIBRARY_STORAGE_KEY = 'aiSearchProPromptLibrary';
  const DEFAULT_SELECTION_DISPLAY_MODE = 'text';
  const PLATFORM_ORDER = Object.keys({
    doubao: true,
    qianwen: true,
    yuanbao: true,
    deepseek: true,
    kimi: true,
    chatglm: true,
    chatgpt: true,
    gemini: true,
    claude: true,
    perplexity: true,
    copilot: true,
    grok: true
  });
  const PROMPT_SECTION_SPLIT_INDEX = 3;
  const MORE_MENU_PROMPT_IDS = ['prompt-polish', 'prompt-rewrite', 'prompt-review', 'prompt-article'];
  const SAVE_DEBOUNCE_MS = 180;

  const AI_PLATFORMS = {
    doubao: { name: '豆包', url: 'https://www.doubao.com/chat/', icon: 'assets/doubao.png' },
    qianwen: { name: '千问', url: 'https://tongyi.aliyun.com/qianwen/', icon: 'assets/qianwen.png' },
    yuanbao: { name: '元宝', url: 'https://yuanbao.tencent.com/chat/naQivTmsDa', icon: 'assets/yuanbao.png' },
    deepseek: { name: 'DeepSeek', url: 'https://chat.deepseek.com/', icon: 'assets/deepseek.png' },
    kimi: { name: 'Kimi', url: 'https://www.kimi.com/', icon: 'assets/kimi.png' },
    chatglm: { name: '智谱清言', url: 'https://chatglm.cn/main/alltoolsdetail?lang=zh', icon: 'assets/chatglm.png' },
    chatgpt: { name: 'ChatGPT', url: 'https://chatgpt.com/', icon: 'assets/chatgpt.png' },
    gemini: { name: 'Gemini', url: 'https://gemini.google.com/', icon: 'assets/gemini.png' },
    claude: { name: 'Claude', url: 'https://claude.ai/new', icon: 'assets/claude.png' },
    perplexity: { name: 'Perplexity', url: 'https://www.perplexity.ai/', icon: 'assets/perplexity.png' },
    copilot: { name: 'Copilot', url: 'https://copilot.microsoft.com/', icon: 'assets/copilot.png' },
    grok: { name: 'Grok', url: 'https://grok.com/', icon: 'assets/grok.png' }
  };

  const SEARCH_ENGINES = {
    baidu: { name: '百度', icon: 'assets/search-baidu.png', host: 'baidu.com' },
    google: { name: 'Google', icon: 'assets/search-google.png', host: 'google.com' },
    bing: { name: 'Bing', icon: 'assets/search-bing.png', host: 'bing.com' }
  };

  const DEFAULT_PROMPTS = [
    { id: 'prompt-explain', title: '解释', icon: '💡', template: '请用简单易懂的方式解释下面这段内容：\n\n{{text}}', enabled: true },
    { id: 'prompt-summary', title: '总结', icon: '📝', template: '请总结下面这段内容的核心要点：\n\n{{text}}', enabled: true },
    { id: 'prompt-translate', title: '翻译', icon: '🌐', template: '请把下面内容翻译成中文，并保留原意：\n\n{{text}}', enabled: true },
    { id: 'prompt-polish', title: '润色', icon: '✨', template: '请润色下面这段内容，让表达更清晰自然：\n\n{{text}}', enabled: true },
    { id: 'prompt-review', title: '代码审查', icon: '🔍', template: '请从可读性、潜在问题和改进建议三个方面审查下面这段代码：\n\n{{text}}', enabled: false },
    { id: 'prompt-rewrite', title: '改写', icon: '✍️', template: '请在不改变原意的前提下改写下面内容，让表达更自然：\n\n{{text}}', enabled: false },
    { id: 'prompt-article', title: '文章提炼', icon: '📚', template: '请结合以下上下文提炼关键信息，并给出结构化总结：\n\n选中内容：\n{{text}}\n\n上下文：\n{{context}}\n\n页面标题：{{page}}\n页面地址：{{url}}', enabled: false }
  ];

  const PROMPT_ICON_MAP = {
    'prompt-explain': 'icons/selection-explain.svg',
    'prompt-summary': 'icons/selection-summary.svg',
    'prompt-translate': 'icons/selection-translate.svg',
    'prompt-polish': 'icons/selection-polish.svg',
    'prompt-rewrite': 'icons/selection-rewrite.svg',
    'prompt-review': 'icons/selection-review.svg',
    'prompt-article': 'icons/selection-article.svg'
  };

  const NAV_ICON_MAP = {
    general: 'icons/settings.svg',
    assistants: 'icons/settings-assistants.svg',
    'selection-toolbar': 'icons/settings-selection-toolbar.svg',
    'search-assistant': 'icons/selection-explain.svg'
  };

  const THEME_ICON_MAP = {
    auto: 'icons/theme-auto.svg',
    dark: 'icons/moon.svg',
    light: 'icons/sun.svg'
  };

  let currentConfig = null;
  let promptLibrary = [];
  let promptOrder = [];
  let activeSection = 'general';
  let saveTimer = 0;
  let isSaving = false;
  let observer = null;
  let dragState = null;

  function getDefaultPromptOrder() {
    return DEFAULT_PROMPTS.map((item) => item.id);
  }

  function normalizeSelectionDisplayMode(mode) {
    return mode === 'icon' ? 'icon' : DEFAULT_SELECTION_DISPLAY_MODE;
  }

  function normalizeTheme(mode) {
    return ['auto', 'dark', 'light'].includes(mode) ? mode : 'light';
  }

  function normalizeToggleList(rawList, sourceMap) {
    const incoming = Array.isArray(rawList) ? rawList : [];
    const enabledMap = new Map(
      incoming
        .filter((item) => item && sourceMap[item.id])
        .map((item) => [item.id, item.enabled !== false])
    );
    const orderedIds = sourceMap === AI_PLATFORMS ? PLATFORM_ORDER : Object.keys(sourceMap);
    return orderedIds.map((id) => ({
      id,
      enabled: enabledMap.has(id) ? enabledMap.get(id) : true
    }));
  }

  function normalizePromptLibrary(list) {
    const incoming = Array.isArray(list) ? list : [];
    const merged = [];
    const seen = new Set();
    [...incoming, ...DEFAULT_PROMPTS].forEach((item, index) => {
      const id = String(item?.id || '').trim() || `prompt-${index}`;
      if (seen.has(id)) return;
      const title = String(item?.title || '').trim();
      const template = typeof item?.template === 'string' ? item.template.trim() : '';
      if (!title || !template) return;
      seen.add(id);
      merged.push({
        id,
        title,
        icon: String(item?.icon || '💡').trim() || '💡',
        template,
        enabled: item?.enabled !== false
      });
    });
    return merged;
  }

  function normalizePromptOrder(rawOrder, prompts) {
    const order = Array.isArray(rawOrder) ? rawOrder : [];
    const promptIds = prompts.map((item) => item.id);
    const merged = [];
    const seen = new Set();
    order.forEach((id) => {
      if (!promptIds.includes(id) || seen.has(id)) return;
      seen.add(id);
      merged.push(id);
    });
    getDefaultPromptOrder().forEach((id) => {
      if (promptIds.includes(id) && !seen.has(id)) {
        seen.add(id);
        merged.push(id);
      }
    });
    promptIds.forEach((id) => {
      if (!seen.has(id)) {
        seen.add(id);
        merged.push(id);
      }
    });
    return merged;
  }

  function normalizeMorePromptIds(rawIds, prompts) {
    const incoming = Array.isArray(rawIds) ? rawIds : ['prompt-polish', 'prompt-rewrite'];
    const availableIds = prompts.map((item) => item.id).filter((id) => MORE_MENU_PROMPT_IDS.includes(id));
    const merged = [];
    const seen = new Set();
    incoming.forEach((id) => {
      if (!availableIds.includes(id) || seen.has(id)) return;
      seen.add(id);
      merged.push(id);
    });
    return merged.length ? merged : ['prompt-polish', 'prompt-rewrite'].filter((id) => availableIds.includes(id));
  }

  function normalizeConfig(rawConfig = {}, prompts = DEFAULT_PROMPTS) {
    const selectionDisplayMode = normalizeSelectionDisplayMode(
      rawConfig.selectionToolbar?.displayMode || rawConfig.selectionDisplayMode
    );
    const platforms = normalizeToggleList(rawConfig.platforms, AI_PLATFORMS);
    const searchEngines = normalizeToggleList(
      rawConfig.searchAssistant?.engines || rawConfig.searchEngines,
      SEARCH_ENGINES
    );
    const normalizedPromptOrder = normalizePromptOrder(rawConfig.promptOrder, prompts);
    return {
      platforms,
      theme: normalizeTheme(rawConfig.theme),
      selectionDisplayMode,
      selectionToolbar: {
        enabled: rawConfig.selectionToolbar?.enabled !== false && rawConfig.selectionToolbarEnabled !== false,
        displayMode: selectionDisplayMode
      },
      searchAssistant: {
        enabled: rawConfig.searchAssistant?.enabled !== false && rawConfig.searchAssistantEnabled !== false,
        engines: searchEngines
      },
      promptOrder: normalizedPromptOrder,
      selectionMorePromptIds: normalizeMorePromptIds(rawConfig.selectionMorePromptIds, prompts)
    };
  }

  function openExtensionPage(pagePath) {
    window.location.href = chrome.runtime.getURL(pagePath);
  }

  function setSaveState(text, state = 'idle') {
    const el = document.getElementById('settings-save-state');
    el.textContent = text;
    el.classList.remove('is-idle', 'is-saving', 'is-error');
    el.classList.add(`is-${state}`);
  }

  function renderStaticIcons() {
    document.querySelectorAll('[data-nav-icon]').forEach((node) => {
      const file = NAV_ICON_MAP[node.dataset.navIcon];
      if (!file) return;
      node.innerHTML = `<img src="${chrome.runtime.getURL(file)}" alt="">`;
    });
    document.querySelectorAll('[data-theme-icon]').forEach((node) => {
      const file = THEME_ICON_MAP[node.dataset.themeIcon];
      if (!file) return;
      node.innerHTML = `<img src="${chrome.runtime.getURL(file)}" alt="">`;
    });
  }

  function renderPlatformList(config) {
    const list = document.getElementById('settings-platform-list');
    list.innerHTML = config.platforms.map((item) => {
      const platform = AI_PLATFORMS[item.id];
      return `
        <label class="settings-chip-card">
          <input type="checkbox" data-platform-id="${item.id}" ${item.enabled ? 'checked' : ''}>
          <span class="settings-chip-main">
            <span class="settings-chip-icon"><img src="${chrome.runtime.getURL(platform.icon)}" alt=""></span>
            <span class="settings-chip-name">${platform.name}</span>
          </span>
          <span class="settings-chip-check" aria-hidden="true"></span>
        </label>
      `;
    }).join('');
  }

  function renderEngineList(config) {
    const list = document.getElementById('settings-engine-list');
    list.innerHTML = config.searchAssistant.engines.map((item) => {
      const engine = SEARCH_ENGINES[item.id];
      return `
        <label class="settings-chip-card">
          <input type="checkbox" data-engine-id="${item.id}" ${item.enabled ? 'checked' : ''}>
          <span class="settings-chip-main">
            <span class="settings-engine-badge"><img src="${chrome.runtime.getURL(engine.icon)}" alt=""></span>
            <span class="settings-chip-name">${engine.name}</span>
          </span>
          <span class="settings-chip-check" aria-hidden="true"></span>
        </label>
      `;
    }).join('');
  }

  function getPromptById(id) {
    return promptLibrary.find((item) => item.id === id);
  }

  function getPromptIconMarkup(prompt) {
    const mapped = PROMPT_ICON_MAP[prompt?.id];
    if (mapped) {
      return `<img src="${chrome.runtime.getURL(mapped)}" alt="">`;
    }
    return `<span>${prompt?.icon || '•'}</span>`;
  }

  function renderPromptOrderLists() {
    const quickList = document.getElementById('selection-quick-actions-list');
    const moreList = document.getElementById('selection-more-actions-list');
    const quickIds = promptOrder.slice(0, PROMPT_SECTION_SPLIT_INDEX);

    const renderItem = (id, group) => {
      const prompt = getPromptById(id);
      if (!prompt) return '';
      if (group === 'more') {
        const checked = currentConfig?.selectionMorePromptIds?.includes(id) ? 'checked' : '';
        return `
          <label class="settings-more-card">
            <input type="checkbox" data-more-prompt-id="${prompt.id}" ${checked}>
            <span class="settings-more-main">
              <span class="settings-prompt-badge">${getPromptIconMarkup(prompt)}</span>
              <span class="settings-prompt-copy">
                <strong>${prompt.title}</strong>
                <span>${prompt.template.replace(/\s+/g, ' ').trim().slice(0, 28)}</span>
              </span>
            </span>
          </label>
        `;
      }
      const summary = prompt.enabled ? prompt.template.replace(/\s+/g, ' ').trim() : '当前已停用，可在提示词库里重新启用';
      return `
        <div
          class="settings-prompt-item"
          draggable="true"
          data-prompt-id="${prompt.id}"
          data-prompt-group="${group}"
        >
          <div class="settings-prompt-main">
            <span class="settings-prompt-badge">${getPromptIconMarkup(prompt)}</span>
            <span class="settings-prompt-copy">
              <strong>${prompt.title}</strong>
              <span>${summary}</span>
            </span>
          </div>
          <span class="settings-prompt-drag" aria-hidden="true">
            <img src="${chrome.runtime.getURL('icons/drag.svg')}" alt="">
          </span>
        </div>
      `;
    };

    quickList.innerHTML = quickIds.map((id) => renderItem(id, 'quick')).join('');
    moreList.innerHTML = MORE_MENU_PROMPT_IDS.map((id) => renderItem(id, 'more')).join('');
  }

  function updatePlatformSummary() {
    const total = Object.keys(AI_PLATFORMS).length;
    const selectAll = document.getElementById('select-all-platforms');
    const enabledCount = Array.from(document.querySelectorAll('[data-platform-id]')).filter((input) => input.checked).length;
    selectAll.checked = enabledCount === total;
    selectAll.indeterminate = enabledCount > 0 && enabledCount < total;
  }

  function updateSelectionToolbarSummary() {
    const enabled = document.getElementById('selection-toolbar-enabled').checked;
    document.getElementById('selection-toolbar-switch-title').textContent = enabled ? '开启划词工具栏' : '关闭划词工具栏';
  }

  function updateSearchAssistantSummary() {
    const enabled = document.getElementById('search-assistant-enabled').checked;
    document.getElementById('search-assistant-switch-title').textContent = enabled ? '开启搜索助手' : '关闭搜索助手';
    const engineCard = document.getElementById('search-engine-card');
    if (engineCard) {
      engineCard.hidden = !enabled;
    }
  }

  function getOrderedEnabledPrompts() {
    return promptOrder
      .map((id) => getPromptById(id))
      .filter(Boolean)
      .filter((item) => item.enabled !== false);
  }

  function renderSelectionPreview() {
    const stage = document.getElementById('selection-preview-stage');
    const bar = document.getElementById('selection-preview-bar');
    const displayMode = document.querySelector('input[name="selection-display-mode"]:checked')?.value || DEFAULT_SELECTION_DISPLAY_MODE;
    const enabled = document.getElementById('selection-toolbar-enabled').checked;
    const activePlatformId = Array.from(document.querySelectorAll('[data-platform-id]')).find((input) => input.checked)?.dataset.platformId || 'doubao';
    const activePlatform = AI_PLATFORMS[activePlatformId] || AI_PLATFORMS.doubao;
    const quickPrompts = getOrderedEnabledPrompts().slice(0, PROMPT_SECTION_SPLIT_INDEX);

    stage.dataset.mode = normalizeSelectionDisplayMode(displayMode);
    stage.classList.toggle('is-disabled', !enabled);

    const platformHtml = `
      <span class="selection-preview-primary-group">
        <span class="selection-preview-platform">
          <span class="selection-preview-platform-logo">
            <img src="${chrome.runtime.getURL(activePlatform.icon)}" alt="">
          </span>
          <span class="selection-preview-label">${activePlatform.name}</span>
        </span>
        <span class="selection-preview-platform-toggle">
          <img src="${chrome.runtime.getURL('icons/platform-arrow-down.svg')}" alt="">
        </span>
      </span>
    `;

    const actionsHtml = quickPrompts.map((prompt) => `
      <span class="selection-preview-item">
        <span class="selection-preview-icon-wrap">${getPromptIconMarkup(prompt)}</span>
        <span class="selection-preview-label">${prompt.title}</span>
      </span>
    `).join('');

    bar.innerHTML = `
      <span class="selection-preview-group">
        ${platformHtml}
      </span>
      <span class="selection-preview-divider" aria-hidden="true"></span>
      <span class="selection-preview-group">
        ${actionsHtml}
      </span>
      <span class="selection-preview-divider" aria-hidden="true"></span>
      <span class="selection-preview-more">
        <span class="selection-preview-icon-wrap">
          <img src="${chrome.runtime.getURL('icons/selection-more.svg')}" alt="">
        </span>
        <span class="selection-preview-label">更多</span>
      </span>
    `;
  }

  function renderPromptSummary() {
    const enabledCount = promptLibrary.filter((item) => item.enabled !== false).length;
    const summary = document.getElementById('prompt-library-summary');
    if (summary) {
      summary.textContent = `共 ${promptLibrary.length} 条提示词，当前启用 ${enabledCount} 条。`;
    }
  }

  function syncForm(config) {
    document.querySelector(`input[name="theme"][value="${config.theme}"]`).checked = true;
    document.querySelector(`input[name="selection-display-mode"][value="${config.selectionToolbar.displayMode}"]`).checked = true;
    document.getElementById('selection-toolbar-enabled').checked = config.selectionToolbar.enabled;
    document.getElementById('search-assistant-enabled').checked = config.searchAssistant.enabled;
    renderPlatformList(config);
    renderEngineList(config);
    promptOrder = config.promptOrder.slice();
    renderPromptOrderLists();
    renderSelectionPreview();
    updatePlatformSummary();
    updateSelectionToolbarSummary();
    updateSearchAssistantSummary();
  }

  function collectConfig() {
    const nextConfig = normalizeConfig({
      theme: document.querySelector('input[name="theme"]:checked')?.value || currentConfig.theme,
      selectionDisplayMode: document.querySelector('input[name="selection-display-mode"]:checked')?.value || currentConfig.selectionDisplayMode,
      selectionToolbarEnabled: document.getElementById('selection-toolbar-enabled').checked,
      searchAssistantEnabled: document.getElementById('search-assistant-enabled').checked,
      platforms: Array.from(document.querySelectorAll('[data-platform-id]')).map((input) => ({
        id: input.dataset.platformId,
        enabled: input.checked
      })),
      searchEngines: Array.from(document.querySelectorAll('[data-engine-id]')).map((input) => ({
        id: input.dataset.engineId,
        enabled: input.checked
      })),
      promptOrder: promptOrder.slice(),
      selectionMorePromptIds: Array.from(document.querySelectorAll('[data-more-prompt-id]'))
        .filter((input) => input.checked)
        .map((input) => input.dataset.morePromptId)
    }, promptLibrary);
    nextConfig.selectionDisplayMode = nextConfig.selectionToolbar.displayMode;
    return nextConfig;
  }

  async function persistConfig() {
    if (isSaving) return;
    isSaving = true;
    setSaveState('正在保存...', 'saving');
    try {
      currentConfig = collectConfig();
      await chrome.storage.local.set({ [STORAGE_KEY]: currentConfig });
      setSaveState('设置已同步', 'idle');
    } catch (error) {
      console.error(error);
      setSaveState('保存失败', 'error');
    } finally {
      isSaving = false;
    }
  }

  function queueSave() {
    window.clearTimeout(saveTimer);
    setSaveState('正在准备保存...', 'saving');
    saveTimer = window.setTimeout(() => {
      persistConfig();
    }, SAVE_DEBOUNCE_MS);
  }

  function movePromptInOrder(group, fromId, toId) {
    const fromIndex = promptOrder.indexOf(fromId);
    const toIndex = promptOrder.indexOf(toId);
    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;
    const inQuickGroup = (index) => index < PROMPT_SECTION_SPLIT_INDEX;
    if (group === 'quick' && (!inQuickGroup(fromIndex) || !inQuickGroup(toIndex))) return;
    if (group === 'more' && (inQuickGroup(fromIndex) || inQuickGroup(toIndex))) return;
    const next = promptOrder.slice();
    const [moved] = next.splice(fromIndex, 1);
    const adjustedToIndex = fromIndex < toIndex ? toIndex - 1 : toIndex;
    next.splice(adjustedToIndex, 0, moved);
    promptOrder = next;
    renderPromptOrderLists();
    renderSelectionPreview();
    queueSave();
  }

  function bindPromptSortEvents() {
    document.addEventListener('dragstart', (event) => {
      const item = event.target.closest('.settings-prompt-item');
      if (!item) return;
      dragState = {
        promptId: item.dataset.promptId,
        group: item.dataset.promptGroup
      };
      item.classList.add('is-dragging');
    });

    document.addEventListener('dragend', (event) => {
      const item = event.target.closest('.settings-prompt-item');
      if (item) item.classList.remove('is-dragging');
      document.querySelectorAll('.settings-prompt-item').forEach((node) => node.classList.remove('is-drop-target'));
      dragState = null;
    });

    document.addEventListener('dragover', (event) => {
      const item = event.target.closest('.settings-prompt-item');
      if (!item || !dragState || item.dataset.promptGroup !== dragState.group) return;
      event.preventDefault();
      document.querySelectorAll('.settings-prompt-item').forEach((node) => node.classList.remove('is-drop-target'));
      item.classList.add('is-drop-target');
    });

    document.addEventListener('drop', (event) => {
      const item = event.target.closest('.settings-prompt-item');
      if (!item || !dragState || item.dataset.promptGroup !== dragState.group) return;
      event.preventDefault();
      document.querySelectorAll('.settings-prompt-item').forEach((node) => node.classList.remove('is-drop-target'));
      movePromptInOrder(dragState.group, dragState.promptId, item.dataset.promptId);
    });
  }

  function scrollToSection(sectionId, shouldPushHash = true) {
    const target = document.getElementById(sectionId);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (shouldPushHash && window.location.hash !== `#${sectionId}`) {
      history.replaceState(null, '', `#${sectionId}`);
    }
    setActiveSection(sectionId);
  }

  function setActiveSection(sectionId) {
    activeSection = sectionId;
    document.querySelectorAll('.settings-nav-item').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.sectionTarget === sectionId);
    });
  }

  function setupScrollSpy() {
    observer?.disconnect();
    observer = new IntersectionObserver((entries) => {
      const visibleEntries = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
      if (!visibleEntries.length) return;
      const sectionId = visibleEntries[0].target.id;
      if (sectionId !== activeSection) {
        setActiveSection(sectionId);
        history.replaceState(null, '', `#${sectionId}`);
      }
    }, {
      rootMargin: '-20% 0px -55% 0px',
      threshold: [0.15, 0.45, 0.75]
    });

    document.querySelectorAll('.settings-section').forEach((section) => observer.observe(section));
  }

  function bindActions() {
    document.getElementById('settings-nav').addEventListener('click', (event) => {
      const button = event.target.closest('.settings-nav-item');
      if (!button) return;
      scrollToSection(button.dataset.sectionTarget);
    });

    document.addEventListener('change', (event) => {
      const target = event.target;
      if (target.id === 'select-all-platforms') {
        document.querySelectorAll('[data-platform-id]').forEach((input) => {
          input.checked = target.checked;
        });
      }
      updatePlatformSummary();
      updateSelectionToolbarSummary();
      updateSearchAssistantSummary();
      renderSelectionPreview();
      queueSave();
    });

    document.addEventListener('input', (event) => {
      if (event.target.matches('input[name="selection-display-mode"]')) {
        renderSelectionPreview();
        queueSave();
      }
    });

    const openMemo = () => openExtensionPage('favorites/favorites.html');
    document.getElementById('open-settings-home-btn').addEventListener('click', () => {
      scrollToSection('general');
    });
    document.getElementById('open-prompt-library-btn').addEventListener('click', () => openExtensionPage('prompt-library/prompt_library.html'));
    document.getElementById('open-memo-btn').addEventListener('click', openMemo);
    document.getElementById('open-compare-btn').addEventListener('click', () => openExtensionPage('compare/compare.html'));

    window.addEventListener('hashchange', () => {
      const nextId = window.location.hash.replace('#', '');
      if (document.getElementById(nextId)) {
        setActiveSection(nextId);
      }
    });
  }

  async function init() {
    renderStaticIcons();
    bindPromptSortEvents();
    bindActions();

    const result = await chrome.storage.local.get([STORAGE_KEY, PROMPT_LIBRARY_STORAGE_KEY]);
    promptLibrary = normalizePromptLibrary(result?.[PROMPT_LIBRARY_STORAGE_KEY]);
    currentConfig = normalizeConfig(result?.[STORAGE_KEY], promptLibrary);
    syncForm(currentConfig);

    const hashSection = window.location.hash.replace('#', '');
    const initialSection = document.getElementById(hashSection) ? hashSection : 'general';
    setActiveSection(initialSection);
    if (initialSection === 'general') {
      history.replaceState(null, '', '#general');
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    } else {
      window.setTimeout(() => {
        scrollToSection(initialSection, false);
      }, 60);
    }
    window.setTimeout(() => {
      setupScrollSpy();
    }, 80);
  }

  init();
})();
