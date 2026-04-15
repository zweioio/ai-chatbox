(function() {
  if (window.self !== window.top) return; // 不在 iframe 中运行

  const AI_PLATFORMS = {
    doubao: { name: '豆包', url: 'https://www.doubao.com/chat/', icon: `<img src="${chrome.runtime.getURL('assets/doubao.png')}" style="width:24px;height:24px;vertical-align:middle;">`, settingsIcon: `<img src="${chrome.runtime.getURL('assets/doubao.png')}" style="width:32px;height:32px;vertical-align:middle;">` },
    qianwen: { name: '千问', url: 'https://tongyi.aliyun.com/qianwen/', icon: `<img src="${chrome.runtime.getURL('assets/qianwen.png')}" style="width:24px;height:24px;vertical-align:middle;">`, settingsIcon: `<img src="${chrome.runtime.getURL('assets/qianwen.png')}" style="width:32px;height:32px;vertical-align:middle;">` },
    yuanbao: { name: '元宝', url: 'https://yuanbao.tencent.com/chat/naQivTmsDa', icon: `<img src="${chrome.runtime.getURL('assets/yuanbao.png')}" style="width:24px;height:24px;vertical-align:middle;">`, settingsIcon: `<img src="${chrome.runtime.getURL('assets/yuanbao.png')}" style="width:32px;height:32px;vertical-align:middle;">` },
    deepseek: { name: 'DeepSeek', url: 'https://chat.deepseek.com/', icon: `<img src="${chrome.runtime.getURL('assets/deepseek.png')}" style="width:24px;height:24px;vertical-align:middle;">`, settingsIcon: `<img src="${chrome.runtime.getURL('assets/deepseek.png')}" style="width:32px;height:32px;vertical-align:middle;">` },
    kimi: { name: 'Kimi', url: 'https://www.kimi.com/', icon: `<img src="${chrome.runtime.getURL('assets/kimi.png')}" style="width:24px;height:24px;vertical-align:middle;">`, settingsIcon: `<img src="${chrome.runtime.getURL('assets/kimi.png')}" style="width:32px;height:32px;vertical-align:middle;">` },
    zai: { name: 'Z.AI', url: 'https://chat.z.ai/', icon: `<img src="${chrome.runtime.getURL('assets/zhipuai.png')}" style="width:24px;height:24px;vertical-align:middle;">`, settingsIcon: `<img src="${chrome.runtime.getURL('assets/zhipuai.png')}" style="width:32px;height:32px;vertical-align:middle;">` },
    chatglm: { name: '智谱清言', url: 'https://chatglm.cn/main/alltoolsdetail?lang=zh', icon: `<img src="${chrome.runtime.getURL('assets/chatglm.png')}" style="width:24px;height:24px;vertical-align:middle;">`, settingsIcon: `<img src="${chrome.runtime.getURL('assets/chatglm.png')}" style="width:32px;height:32px;vertical-align:middle;">` },
    chatgpt: { name: 'ChatGPT', url: 'https://chatgpt.com/', icon: `<img src="${chrome.runtime.getURL('assets/chatgpt.png')}" style="width:24px;height:24px;vertical-align:middle;">`, settingsIcon: `<img src="${chrome.runtime.getURL('assets/chatgpt.png')}" style="width:32px;height:32px;vertical-align:middle;">` },
    gemini: { name: 'Gemini', url: 'https://gemini.google.com/', icon: `<img src="${chrome.runtime.getURL('assets/gemini.png')}" style="width:24px;height:24px;vertical-align:middle;">`, settingsIcon: `<img src="${chrome.runtime.getURL('assets/gemini.png')}" style="width:32px;height:32px;vertical-align:middle;">` },
    claude: { name: 'Claude', url: 'https://claude.ai/new', icon: `<img src="${chrome.runtime.getURL('assets/claude.png')}" style="width:24px;height:24px;vertical-align:middle;">`, settingsIcon: `<img src="${chrome.runtime.getURL('assets/claude.png')}" style="width:32px;height:32px;vertical-align:middle;">` },
    perplexity: { name: 'Perplexity', url: 'https://www.perplexity.ai/', icon: `<img src="${chrome.runtime.getURL('assets/perplexity.png')}" style="width:24px;height:24px;vertical-align:middle;">`, settingsIcon: `<img src="${chrome.runtime.getURL('assets/perplexity.png')}" style="width:32px;height:32px;vertical-align:middle;">` },
    copilot: { name: 'Copilot', url: 'https://copilot.microsoft.com/', icon: `<img src="${chrome.runtime.getURL('assets/copilot.png')}" style="width:24px;height:24px;vertical-align:middle;">`, settingsIcon: `<img src="${chrome.runtime.getURL('assets/copilot.png')}" style="width:32px;height:32px;vertical-align:middle;">` },
    grok: { name: 'Grok', url: 'https://grok.com/', icon: `<img src="${chrome.runtime.getURL('assets/grok.png')}" style="width:24px;height:24px;vertical-align:middle;">`, settingsIcon: `<img src="${chrome.runtime.getURL('assets/grok.png')}" style="width:32px;height:32px;vertical-align:middle;">` }
  };

  const DEFAULT_SELECTION_DISPLAY_MODE = 'text';
  const PLATFORM_ORDER = Object.keys(AI_PLATFORMS);
  const SEARCH_ENGINES = {
    baidu: { host: 'baidu.com' },
    google: { host: 'google.com' },
    bing: { host: 'bing.com' }
  };

  // 默认配置
  let userConfig = {
    platforms: PLATFORM_ORDER.map(key => ({
      id: key,
      enabled: true
    })),
    theme: 'light',
    selectionDisplayMode: DEFAULT_SELECTION_DISPLAY_MODE,
    selectionToolbarEnabled: true,
    searchAssistantEnabled: true,
    searchAssistantPlatform: 'doubao',
    searchEngines: Object.keys(SEARCH_ENGINES).map((id) => ({
      id,
      enabled: true
    })),
    contextMenuDefaultPlatform: 'doubao',
    selectionMorePromptIds: ['prompt-polish', 'prompt-rewrite'],
    promptOrder: [
      'prompt-explain',
      'prompt-summary',
      'prompt-translate',
      'prompt-polish',
      'prompt-review',
      'prompt-rewrite',
      'prompt-article'
    ]
  };

  let currentPlatform = 'doubao';
  let isSidebarOpen = false;
  let isResizing = false;
  let activeAiUrl = ''; // 保存当前活跃对话的 URL
  let nativeSidebarOpen = false;
  const PROMPT_LIBRARY_STORAGE_KEY = 'aiSearchProPromptLibrary';
  const FAVORITES_STORAGE_KEY = 'aiSearchProFavorites';
  const FLOATING_CONTEXT_ACTION_STORAGE_KEY = 'aiSearchProFloatingContextAction';
  const DEFAULT_PROMPTS = [
    { id: 'prompt-explain', title: '解释', icon: '💡', template: '请用简单易懂的方式解释下面这段内容：\n\n{{text}}', enabled: true },
    { id: 'prompt-summary', title: '总结', icon: '📝', template: '请总结下面这段内容的核心要点：\n\n{{text}}', enabled: true },
    { id: 'prompt-translate', title: '翻译', icon: '🌐', template: '请把下面内容翻译成中文，并保留原意：\n\n{{text}}', enabled: true },
    { id: 'prompt-polish', title: '润色', icon: '✨', template: '请润色下面这段内容，让表达更清晰自然：\n\n{{text}}', enabled: true },
    { id: 'prompt-rewrite', title: '改写', icon: '✍️', template: '请在不改变原意的前提下改写下面内容，让表达更自然：\n\n{{text}}', enabled: true },
    { id: 'prompt-article', title: '文章提炼', icon: '📚', template: '请结合以下上下文提炼关键信息，并给出结构化总结：\n\n选中内容：\n{{text}}\n\n上下文：\n{{context}}\n\n页面标题：{{page}}\n页面地址：{{url}}', enabled: false },
    { id: 'prompt-review', title: '代码审查', icon: '🔍', template: '请从可读性、潜在问题和改进建议三个方面审查下面这段代码：\n\n{{text}}', enabled: false }
  ];
  const LOCKED_PROMPT_IDS = ['prompt-explain', 'prompt-summary', 'prompt-translate', 'prompt-polish', 'prompt-rewrite'];
  const SELECTION_PROMPT_ICON_MAP = {
    'prompt-explain': 'selection-explain.svg',
    'prompt-summary': 'selection-summary.svg',
    'prompt-translate': 'selection-translate.svg',
    'prompt-polish': 'selection-polish.svg',
    'prompt-rewrite': 'selection-rewrite.svg',
    'prompt-review': 'selection-review.svg',
    'prompt-article': 'selection-article.svg'
  };
  const SELECTION_MORE_ICON = 'selection-more.svg';
  const SELECTION_PROMPTS_ICON = 'selection-prompts.svg';
  let promptLibraryCache = DEFAULT_PROMPTS.slice();
  let selectionToolbarEl = null;
  let selectionToolbarShadow = null;
  let selectionToolbarHideTimer = null;
  let selectionPlatformMenuTimer = null;
  let selectionMoreMenuTimer = null;
  let selectionToolbarState = {
    text: '',
    context: '',
    page: '',
    url: '',
    time: '',
    placement: 'bottom'
  };
  let pendingFloatingContextAction = null;
  const systemThemeQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  const SETTINGS_MENU_ITEMS = [
    { action: 'inline-assistants', label: 'AI 助手显示设置' },
    { tab: 'general', label: '系统设置' }
  ];

  function openExtensionPage(pagePath) {
    chrome.runtime.sendMessage({ type: 'OPEN_EXTENSION_PAGE', pagePath }, () => chrome.runtime.lastError);
  }

  function openSettingsPage(tab = 'general') {
    openExtensionPage(`settings/settings.html#${tab}`);
  }

  function openMemoPage() {
    openExtensionPage('favorites/favorites.html');
  }

  async function readQueuedFloatingContextAction() {
    const data = await chrome.storage.local.get([FLOATING_CONTEXT_ACTION_STORAGE_KEY]);
    return data?.[FLOATING_CONTEXT_ACTION_STORAGE_KEY] || null;
  }

  async function queueFloatingContextAction(action) {
    if (!action?.text) return;
    await chrome.storage.local.set({
      [FLOATING_CONTEXT_ACTION_STORAGE_KEY]: {
        id: action.id || `float_${Date.now()}`,
        platformId: action.platformId || currentPlatform,
        text: action.text,
        createdAt: Date.now()
      }
    });
  }

  async function clearQueuedFloatingContextAction() {
    await chrome.storage.local.remove(FLOATING_CONTEXT_ACTION_STORAGE_KEY);
  }

  function normalizePromptLibrary(list) {
    const incoming = Array.isArray(list) ? list : [];
    const merged = [];
    const seen = new Set();
    [...incoming, ...DEFAULT_PROMPTS].forEach((item) => {
      if (!item || !item.id || seen.has(item.id)) return;
      seen.add(item.id);
      merged.push({
        id: item.id,
        title: (item.title || '').trim() || '未命名提示词',
        icon: (item.icon || '').trim() || '💡',
        iconKey: SELECTION_PROMPT_ICON_MAP[item.iconKey] ? item.iconKey : (SELECTION_PROMPT_ICON_MAP[item.id] ? item.id : ''),
        template: typeof item.template === 'string' ? item.template : '',
        enabled: LOCKED_PROMPT_IDS.includes(item.id) ? true : item.enabled !== false
      });
    });
    return merged.filter((item) => item.template.trim());
  }

  function normalizeSelectionDisplayMode(mode) {
    return mode === 'icon' ? 'icon' : DEFAULT_SELECTION_DISPLAY_MODE;
  }

  function normalizeTheme(mode) {
    return mode === 'dark' || mode === 'auto' ? mode : 'light';
  }

  function normalizeToggleList(rawList = [], sourceMap = {}) {
    const incoming = Array.isArray(rawList) ? rawList : [];
    const merged = [];
    const seen = new Set();
    incoming.forEach((item) => {
      if (!item || !sourceMap[item.id] || seen.has(item.id)) return;
      seen.add(item.id);
      merged.push({
        id: item.id,
        enabled: item.enabled !== false
      });
    });
    Object.keys(sourceMap).forEach((id) => {
      if (!seen.has(id)) {
        merged.push({ id, enabled: true });
      }
    });
    return merged;
  }

  function normalizePromptOrder(rawOrder = [], prompts = DEFAULT_PROMPTS) {
    const sourceOrder = Array.isArray(rawOrder) ? rawOrder : [];
    const promptIds = prompts.map((item) => item.id);
    const merged = [];
    const seen = new Set();
    sourceOrder.forEach((id) => {
      if (!promptIds.includes(id) || seen.has(id)) return;
      seen.add(id);
      merged.push(id);
    });
    promptIds.forEach((id) => {
      if (!seen.has(id)) {
        seen.add(id);
        merged.push(id);
      }
    });
    return merged;
  }

  function normalizeMorePromptIds(rawIds = [], prompts = DEFAULT_PROMPTS) {
    const allowIds = ['prompt-polish', 'prompt-rewrite', 'prompt-review', 'prompt-article'];
    const promptIds = prompts.map((item) => item.id).filter((id) => allowIds.includes(id));
    const sourceOrder = Array.isArray(rawIds) ? rawIds : [];
    const merged = [];
    const seen = new Set();
    sourceOrder.forEach((id) => {
      if (!promptIds.includes(id) || seen.has(id)) return;
      seen.add(id);
      merged.push(id);
    });
    if (!merged.length) {
      ['prompt-polish', 'prompt-rewrite'].forEach((id) => {
        if (promptIds.includes(id) && !seen.has(id)) {
          seen.add(id);
          merged.push(id);
        }
      });
    }
    return merged;
  }

  function normalizeUserConfig(rawConfig = {}) {
    const mergedPlatforms = normalizeToggleList(rawConfig.platforms, AI_PLATFORMS);
    const normalizedSearchEngines = normalizeToggleList(
      rawConfig.searchAssistant?.engines || rawConfig.searchEngines,
      SEARCH_ENGINES
    );
    return {
      platforms: mergedPlatforms,
      theme: normalizeTheme(rawConfig.theme),
      selectionDisplayMode: normalizeSelectionDisplayMode(
        rawConfig.selectionToolbar?.displayMode || rawConfig.selectionDisplayMode
      ),
      selectionToolbarEnabled: rawConfig.selectionToolbar?.enabled !== false && rawConfig.selectionToolbarEnabled !== false,
      searchAssistantEnabled: rawConfig.searchAssistant?.enabled !== false && rawConfig.searchAssistantEnabled !== false,
      searchAssistantPlatform: AI_PLATFORMS[rawConfig.searchAssistant?.platform] ? rawConfig.searchAssistant.platform : (AI_PLATFORMS[rawConfig.searchAssistantPlatform] ? rawConfig.searchAssistantPlatform : 'doubao'),
      searchEngines: normalizedSearchEngines,
      contextMenuDefaultPlatform: AI_PLATFORMS[rawConfig.contextMenuDefaultPlatform] ? rawConfig.contextMenuDefaultPlatform : 'doubao',
      selectionMorePromptIds: normalizeMorePromptIds(rawConfig.selectionMorePromptIds, DEFAULT_PROMPTS),
      promptOrder: normalizePromptOrder(rawConfig.promptOrder, DEFAULT_PROMPTS)
    };
  }

  function getDefaultEnabledPlatformId() {
    return userConfig.platforms.find((item) => item.enabled && AI_PLATFORMS[item.id])?.id || 'doubao';
  }

  function getDefaultContextMenuPlatformId() {
    return AI_PLATFORMS[userConfig.contextMenuDefaultPlatform] ? userConfig.contextMenuDefaultPlatform : 'doubao';
  }

  function getDefaultSearchAssistantPlatformId() {
    return AI_PLATFORMS[userConfig.searchAssistantPlatform] ? userConfig.searchAssistantPlatform : 'doubao';
  }

  function getPlatformAssetFile(platformKey) {
    return platformKey === 'zai' ? 'zhipuai.png' : `${platformKey}.png`;
  }

  function removeStaleFloatingUI() {
    const container = document.getElementById('ai-sp-container');
    if (!container || window.__aiSearchProToggleUI) return;
    container.remove();
  }

  function applyPromptTemplate(template, text, variables = {}) {
    const rawTemplate = typeof template === 'string' ? template : '';
    const merged = {
      text: (text || '').trim(),
      context: typeof variables.context === 'string' ? variables.context.trim() : '',
      page: typeof variables.page === 'string' ? variables.page.trim() : document.title,
      url: typeof variables.url === 'string' ? variables.url.trim() : window.location.href,
      time: typeof variables.time === 'string' ? variables.time.trim() : new Date().toLocaleString()
    };
    const normalizedContext = merged.context || merged.text;
    const replaced = rawTemplate
      .replaceAll('{{text}}', merged.text)
      .replaceAll('{{context}}', normalizedContext)
      .replaceAll('{{page}}', merged.page)
      .replaceAll('{{url}}', merged.url)
      .replaceAll('{{time}}', merged.time)
      .trim();
    if (!/\{\{(text|context|page|url|time)\}\}/.test(rawTemplate)) {
      return replaced ? `${replaced}\n\n${merged.text}`.trim() : merged.text;
    }
    return replaced;
  }

  async function loadPromptLibrary() {
    const data = await chrome.storage.local.get([PROMPT_LIBRARY_STORAGE_KEY]);
    promptLibraryCache = normalizePromptLibrary(data?.[PROMPT_LIBRARY_STORAGE_KEY]);
    return promptLibraryCache;
  }

  function findPromptById(promptId) {
    if (!promptId) return null;
    return promptLibraryCache.find((item) => item.id === promptId)
      || DEFAULT_PROMPTS.find((item) => item.id === promptId)
      || null;
  }

  async function openFloatingContextAction(text, platformId = currentPlatform) {
    const action = {
      id: `float_${Date.now()}`,
      platformId: AI_PLATFORMS[platformId] ? platformId : currentPlatform,
      text
    };
    await queueFloatingContextAction(action);
    pendingFloatingContextAction = action;
    if (window.__aiSearchProConsumeFloatingContextAction) {
      window.__aiSearchProToggleUI(true);
      const consumed = await window.__aiSearchProConsumeFloatingContextAction(action);
      if (consumed) {
        await clearQueuedFloatingContextAction();
      }
    } else {
      createUI('', userConfig.platforms.filter(p => p.enabled).map(p => p.id), { initialQueuedAction: action });
    }
    return true;
  }

  async function handleContextMenuPrompt(promptId, text) {
    const rawText = String(text || '').trim();
    if (!rawText) return false;
    await loadPromptLibrary();
    const prompt = findPromptById(promptId);
    if (!prompt) return false;
    const finalText = applyPromptTemplate(prompt.template, rawText, {
      context: rawText,
      page: document.title,
      url: window.location.href,
      time: new Date().toLocaleString()
    });
    await openSelectionPrompt(finalText, getDefaultContextMenuPlatformId());
    return true;
  }

  function queryNativeSidebarState() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'GET_TAB_SIDEBAR_STATE' }, (response) => {
        if (chrome.runtime.lastError || !response?.ok) {
          resolve(nativeSidebarOpen);
          return;
        }
        nativeSidebarOpen = response.state?.nativeSidebarOpen === true;
        resolve(nativeSidebarOpen);
      });
    });
  }

  function escapeSelectionHtml(text) {
    return String(text || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function getSelectionPromptIconMarkup(prompt) {
    const iconKey = prompt?.iconKey && SELECTION_PROMPT_ICON_MAP[prompt.iconKey]
      ? prompt.iconKey
      : prompt?.id;
    if (SELECTION_PROMPT_ICON_MAP[iconKey]) {
      return `<img src="${chrome.runtime.getURL(`icons/${SELECTION_PROMPT_ICON_MAP[iconKey]}`)}" alt="" aria-hidden="true">`;
    }
    return `<span class="ai-sp-selection-chip-fallback-icon">${escapeSelectionHtml(prompt?.icon || '•')}</span>`;
  }

  function getSelectionMoreIconMarkup() {
    return `<img src="${chrome.runtime.getURL(`icons/${SELECTION_MORE_ICON}`)}" alt="" aria-hidden="true">`;
  }

  function getSelectionMenuIconMarkup(iconFileName, fallback = '•') {
    if (iconFileName) {
      return `<img src="${chrome.runtime.getURL(`icons/${iconFileName}`)}" alt="" aria-hidden="true">`;
    }
    return `<span class="ai-sp-selection-chip-fallback-icon">${escapeSelectionHtml(fallback)}</span>`;
  }

  function getSelectionDisplayModeMarkup(mode) {
    const activeMode = normalizeSelectionDisplayMode(mode);
    return `
      <div class="ai-sp-settings-section ai-sp-selection-display-section">
        <div class="ai-sp-settings-section-title">划词显示设置</div>
        <div class="ai-sp-selection-display-options">
          <label class="ai-sp-selection-display-card ${activeMode === 'text' ? 'is-active' : ''}">
            <input type="radio" name="ai-sp-selection-display-mode" value="text" ${activeMode === 'text' ? 'checked' : ''}>
            <span class="ai-sp-selection-display-copy">
              <span class="ai-sp-selection-display-title">文字版</span>
              <span class="ai-sp-selection-display-desc">显示图标和文字，信息更完整</span>
            </span>
            <span class="ai-sp-selection-display-preview text" aria-hidden="true">
              <span class="ai-sp-selection-display-preview-pill wide"></span>
              <span class="ai-sp-selection-display-preview-pill"></span>
              <span class="ai-sp-selection-display-preview-pill"></span>
            </span>
          </label>
          <label class="ai-sp-selection-display-card ${activeMode === 'icon' ? 'is-active' : ''}">
            <input type="radio" name="ai-sp-selection-display-mode" value="icon" ${activeMode === 'icon' ? 'checked' : ''}>
            <span class="ai-sp-selection-display-copy">
              <span class="ai-sp-selection-display-title">图标版</span>
              <span class="ai-sp-selection-display-desc">显示紧凑图标，页面里更轻巧</span>
            </span>
            <span class="ai-sp-selection-display-preview icon" aria-hidden="true">
              <span class="ai-sp-selection-display-preview-dot wide"></span>
              <span class="ai-sp-selection-display-preview-dot"></span>
              <span class="ai-sp-selection-display-preview-dot"></span>
              <span class="ai-sp-selection-display-preview-dot"></span>
            </span>
          </label>
        </div>
      </div>
    `;
  }

  function normalizeSelectionText(text) {
    return String(text || '').replace(/\s+/g, ' ').trim();
  }

  function isSelectionInEditable(selection) {
    const anchorNode = selection?.anchorNode;
    const baseEl = anchorNode?.nodeType === Node.ELEMENT_NODE ? anchorNode : anchorNode?.parentElement;
    if (!baseEl) return false;
    if (selectionToolbarEl && (baseEl === selectionToolbarEl || selectionToolbarEl.contains(baseEl))) return true;
    return Boolean(baseEl.closest('input, textarea, [contenteditable="true"], [contenteditable=""], [role="textbox"]'));
  }

  function getSelectionContext(range, text) {
    const baseEl = range?.commonAncestorContainer?.nodeType === Node.ELEMENT_NODE
      ? range.commonAncestorContainer
      : range?.commonAncestorContainer?.parentElement;
    if (!baseEl) return '';
    const block = baseEl.closest('article, section, main, p, li, td, blockquote, pre, div');
    const contextText = normalizeSelectionText(block?.textContent || '');
    if (!contextText || contextText === text) return '';
    if (contextText.length <= 220) return contextText;
    const index = contextText.indexOf(text);
    if (index === -1) return `${contextText.slice(0, 220)}…`;
    const start = Math.max(0, index - 90);
    const end = Math.min(contextText.length, index + text.length + 90);
    const prefix = start > 0 ? '…' : '';
    const suffix = end < contextText.length ? '…' : '';
    return `${prefix}${contextText.slice(start, end)}${suffix}`;
  }

  function getSelectionTheme() {
    const currentTheme = userConfig.theme === 'auto'
      ? (systemThemeQuery?.matches ? 'dark' : 'light')
      : userConfig.theme;
    return currentTheme === 'dark' ? 'dark' : 'light';
  }

  function subscribeSystemThemeChange(listener) {
    if (!systemThemeQuery || typeof listener !== 'function') return;
    if (typeof systemThemeQuery.addEventListener === 'function') {
      systemThemeQuery.addEventListener('change', listener);
      return;
    }
    if (typeof systemThemeQuery.addListener === 'function') {
      systemThemeQuery.addListener(listener);
    }
  }

  function isSelectionToolbarEnabled() {
    return userConfig.selectionToolbarEnabled !== false;
  }

  function getCurrentSearchEngineId() {
    const host = window.location.hostname;
    if (host.includes(SEARCH_ENGINES.baidu.host)) return 'baidu';
    if (host.includes(SEARCH_ENGINES.google.host)) return 'google';
    if (host.includes(SEARCH_ENGINES.bing.host)) return 'bing';
    return '';
  }

  function isSearchAssistantEnabledForCurrentPage() {
    if (userConfig.searchAssistantEnabled === false) return false;
    const engineId = getCurrentSearchEngineId();
    if (!engineId) return false;
    const engine = Array.isArray(userConfig.searchEngines)
      ? userConfig.searchEngines.find((item) => item.id === engineId)
      : null;
    return engine ? engine.enabled !== false : true;
  }

  function getSelectionPayload() {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount) return null;
    if (isSelectionInEditable(selection)) return null;
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (!rect || (!rect.width && !rect.height)) return null;
    const text = normalizeSelectionText(selection.toString());
    if (!text || text.length < 2) return null;
    return {
      text,
      rect,
      context: getSelectionContext(range, text),
      page: document.title || '',
      url: window.location.href,
      time: new Date().toLocaleString(),
      theme: getSelectionTheme()
    };
  }

  function refreshSelectionToolbarPosition() {
    if (!selectionToolbarEl || selectionToolbarEl.style.display === 'none') return;
    const payload = getSelectionPayload();
    if (!payload) {
      hideSelectionToolbar(true);
      return;
    }
    selectionToolbarState = {
      ...selectionToolbarState,
      text: payload.text,
      context: payload.context,
      page: payload.page,
      url: payload.url,
      time: payload.time
    };
    positionSelectionToolbar(payload.rect);
  }

  function closeSelectionMoreMenu() {
    if (selectionMoreMenuTimer) {
      clearTimeout(selectionMoreMenuTimer);
      selectionMoreMenuTimer = null;
    }
    const moreMenu = selectionToolbarShadow?.getElementById('ai-sp-selection-more-menu');
    const moreBtn = selectionToolbarShadow?.getElementById('ai-sp-selection-more-btn');
    if (moreMenu) moreMenu.hidden = true;
    if (moreBtn) moreBtn.dataset.open = 'false';
  }

  function openSelectionMoreMenu() {
    if (selectionMoreMenuTimer) {
      clearTimeout(selectionMoreMenuTimer);
      selectionMoreMenuTimer = null;
    }
    const moreMenu = selectionToolbarShadow?.getElementById('ai-sp-selection-more-menu');
    const moreBtn = selectionToolbarShadow?.getElementById('ai-sp-selection-more-btn');
    if (!moreMenu) return;
    moreMenu.hidden = false;
    if (moreBtn) moreBtn.dataset.open = 'true';
  }

  function scheduleCloseSelectionMoreMenu() {
    if (selectionMoreMenuTimer) {
      clearTimeout(selectionMoreMenuTimer);
    }
    selectionMoreMenuTimer = window.setTimeout(() => {
      closeSelectionMoreMenu();
    }, 120);
  }

  function closeSelectionPlatformMenu() {
    if (selectionPlatformMenuTimer) {
      clearTimeout(selectionPlatformMenuTimer);
      selectionPlatformMenuTimer = null;
    }
    const platformMenu = selectionToolbarShadow?.getElementById('ai-sp-selection-platform-menu');
    const platformToggle = selectionToolbarShadow?.getElementById('ai-sp-selection-platform-toggle');
    const primaryButton = selectionToolbarShadow?.getElementById('ai-sp-selection-send-btn');
    if (platformMenu) platformMenu.hidden = true;
    if (platformToggle) {
      platformToggle.dataset.open = 'false';
      platformToggle.setAttribute('aria-expanded', 'false');
    }
    if (primaryButton) {
      primaryButton.dataset.open = 'false';
      primaryButton.setAttribute('aria-expanded', 'false');
    }
  }

  function openSelectionPlatformMenu() {
    if (selectionPlatformMenuTimer) {
      clearTimeout(selectionPlatformMenuTimer);
      selectionPlatformMenuTimer = null;
    }
    const platformMenu = selectionToolbarShadow?.getElementById('ai-sp-selection-platform-menu');
    const platformToggle = selectionToolbarShadow?.getElementById('ai-sp-selection-platform-toggle');
    const primaryButton = selectionToolbarShadow?.getElementById('ai-sp-selection-send-btn');
    if (!platformMenu) return;
    platformMenu.hidden = false;
    if (platformToggle) {
      platformToggle.dataset.open = 'true';
      platformToggle.setAttribute('aria-expanded', 'true');
    }
    if (primaryButton) {
      primaryButton.dataset.open = 'true';
      primaryButton.setAttribute('aria-expanded', 'true');
    }
  }

  function scheduleCloseSelectionPlatformMenu() {
    if (selectionPlatformMenuTimer) {
      clearTimeout(selectionPlatformMenuTimer);
    }
    selectionPlatformMenuTimer = window.setTimeout(() => {
      closeSelectionPlatformMenu();
    }, 120);
  }

  function hideSelectionToolbar(immediate = false) {
    if (selectionToolbarHideTimer) {
      clearTimeout(selectionToolbarHideTimer);
      selectionToolbarHideTimer = null;
    }
    if (!selectionToolbarEl) return;
    if (immediate) {
      selectionToolbarEl.style.display = 'none';
      closeSelectionMoreMenu();
      closeSelectionPlatformMenu();
      return;
    }
    selectionToolbarHideTimer = window.setTimeout(() => {
      if (selectionToolbarEl) {
        selectionToolbarEl.style.display = 'none';
        closeSelectionMoreMenu();
        closeSelectionPlatformMenu();
      }
    }, 120);
  }

  function getEnabledSelectionPlatforms() {
    return userConfig.platforms
      .filter((item) => item.enabled && AI_PLATFORMS[item.id])
      .map((item) => item.id);
  }

  function syncSelectionPlatform(platformKey) {
    if (!AI_PLATFORMS[platformKey]) return;
    currentPlatform = platformKey;
    chrome.storage.local.set({ aiSearchProLastPlatform: currentPlatform });
  }

  function refreshSelectionPlatformUI() {
    if (!selectionToolbarShadow) return;
    const enabledPlatforms = getEnabledSelectionPlatforms();
    if (!enabledPlatforms.length) return;
    if (!enabledPlatforms.includes(currentPlatform)) {
      currentPlatform = enabledPlatforms[0];
    }
    const platformName = selectionToolbarShadow.getElementById('ai-sp-selection-platform-name');
    const platformLogo = selectionToolbarShadow.getElementById('ai-sp-selection-platform-logo-img');
    const platformList = selectionToolbarShadow.getElementById('ai-sp-selection-platform-list');
    const platformToggle = selectionToolbarShadow.getElementById('ai-sp-selection-platform-toggle');
    const platformSendBtn = selectionToolbarShadow.getElementById('ai-sp-selection-send-btn');
    if (platformName) {
      platformName.textContent = AI_PLATFORMS[currentPlatform]?.name || '豆包';
    }
    if (platformLogo) {
      platformLogo.src = chrome.runtime.getURL(`assets/${getPlatformAssetFile(currentPlatform)}`);
      platformLogo.alt = AI_PLATFORMS[currentPlatform]?.name || '';
    }
    if (platformSendBtn) {
      const sendLabel = `${AI_PLATFORMS[currentPlatform]?.name || '豆包'}，切换平台`;
      platformSendBtn.setAttribute('title', sendLabel);
      platformSendBtn.setAttribute('aria-label', sendLabel);
    }
    if (platformToggle) {
      platformToggle.hidden = enabledPlatforms.length <= 1;
    }
    if (platformList) {
      platformList.innerHTML = enabledPlatforms.map((platformKey) => {
        const platform = AI_PLATFORMS[platformKey];
        const isActive = platformKey === currentPlatform;
        return `
          <button
            class="ai-sp-selection-platform-item ${isActive ? 'is-active' : ''}"
            data-selection-action="platform-select"
            data-platform-id="${escapeSelectionHtml(platformKey)}"
            role="menuitemradio"
            aria-checked="${isActive ? 'true' : 'false'}"
          >
            <span class="ai-sp-selection-platform-item-logo">
              <img src="${chrome.runtime.getURL(`assets/${getPlatformAssetFile(platformKey)}`)}" alt="${escapeSelectionHtml(platform.name)}">
            </span>
            <span class="ai-sp-selection-platform-item-name">${escapeSelectionHtml(platform.name)}</span>
            <span class="ai-sp-selection-platform-item-check" aria-hidden="true">${isActive ? '当前' : ''}</span>
          </button>
        `;
      }).join('');
    }
  }

  async function openSelectionPrompt(text, platformKey = currentPlatform) {
    const query = text.trim();
    if (!query) return;
    const nextPlatform = AI_PLATFORMS[platformKey] ? platformKey : currentPlatform;
    if (AI_PLATFORMS[platformKey]) {
      syncSelectionPlatform(platformKey);
    }
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({
        type: 'QUEUE_SIDEPANEL_CONTEXT_ACTION',
        text: query,
        platformId: nextPlatform,
        actionId: `sel_${Date.now()}`,
        state: {
          currentPlatform: nextPlatform,
          forceSidebarOnly: true
        }
      }, (response) => {
        resolve(Boolean(response?.ok) && !chrome.runtime.lastError);
      });
    });
  }

  function ensureSelectionToolbar() {
    if (selectionToolbarEl) return selectionToolbarEl;
    const el = document.createElement('div');
    el.id = 'ai-sp-selection-toolbar-host';
    el.style.display = 'none';
    el.style.position = 'fixed';
    el.style.left = '0';
    el.style.top = '0';
    el.style.zIndex = '2147483646';
    el.style.pointerEvents = 'none';
    selectionToolbarShadow = el.attachShadow({ mode: 'open' });
    selectionToolbarShadow.innerHTML = `
      <style>
        :host {
          all: initial;
        }
        #ai-sp-selection-toolbar {
          --ai-sp-selection-bg: #ffffff;
          --ai-sp-selection-border: #ececef;
          --ai-sp-selection-text: #111827;
          --ai-sp-selection-subtext: #374151;
          --ai-sp-selection-hover: #f2f2f2;
          --ai-sp-selection-soft-hover: rgba(15, 45, 98, 0.06);
          --ai-sp-selection-icon-bg: #dbeafe;
          --ai-sp-selection-divider: #e5e7eb;
          --ai-sp-selection-menu-bg: #ffffff;
          --ai-sp-selection-disabled-bg: rgba(148, 163, 184, 0.14);
          --ai-sp-selection-disabled-text: #9ca3af;
          position: fixed;
          left: 0;
          top: 0;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px;
          border-radius: 12px;
          background: var(--ai-sp-selection-bg);
          border: 1px solid var(--ai-sp-selection-border);
          box-shadow: 0 8px 24px rgba(17, 24, 39, 0.14);
          pointer-events: auto;
          max-width: calc(100vw - 24px);
          box-sizing: border-box;
          font-family: "PingFang SC", -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif;
          color: var(--ai-sp-selection-text);
        }
        #ai-sp-selection-toolbar[data-theme="dark"] {
          --ai-sp-selection-bg: #111827;
          --ai-sp-selection-border: #374151;
          --ai-sp-selection-text: #f3f4f6;
          --ai-sp-selection-subtext: #cbd5e1;
          --ai-sp-selection-hover: #374151;
          --ai-sp-selection-soft-hover: rgba(148, 163, 184, 0.18);
          --ai-sp-selection-icon-bg: #243b53;
          --ai-sp-selection-divider: rgba(255, 255, 255, 0.12);
          --ai-sp-selection-menu-bg: #1f2937;
          --ai-sp-selection-disabled-bg: rgba(148, 163, 184, 0.18);
          --ai-sp-selection-disabled-text: #6b7280;
        }
        .ai-sp-selection-main {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
        }
        .ai-sp-selection-primary-group {
          position: relative;
          display: flex;
          align-items: center;
          flex: 0 0 auto;
          min-width: 0;
          gap: 4px;
          border-radius: 6px;
          background: transparent;
        }
        .ai-sp-selection-divider {
          width: 1px;
          height: 12px;
          background: var(--ai-sp-selection-divider);
          flex: 0 0 auto;
        }
        .ai-sp-selection-chip {
          border: none;
          outline: none;
          min-height: 28px;
          padding: 6px;
          border-radius: 6px;
          font-size: 14px;
          line-height: 1;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          white-space: nowrap;
          transition: background 0.16s ease, color 0.16s ease, opacity 0.16s ease;
          max-width: none;
          box-sizing: border-box;
          color: var(--ai-sp-selection-text);
          background: transparent;
          font-weight: 500;
        }
        .ai-sp-selection-chip-icon {
          flex: 0 0 auto;
          width: 20px;
          height: 20px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: var(--ai-sp-selection-text);
        }
        .ai-sp-selection-chip-icon svg {
          width: 20px;
          height: 20px;
          display: block;
        }
        .ai-sp-selection-chip-icon img,
        .ai-sp-selection-action-icon img {
          width: 100%;
          height: 100%;
          display: block;
          object-fit: contain;
          filter: none;
        }
        #ai-sp-selection-toolbar[data-theme="dark"] .ai-sp-selection-chip-icon img,
        #ai-sp-selection-toolbar[data-theme="dark"] .ai-sp-selection-action-icon img,
        #ai-sp-selection-toolbar[data-theme="dark"] .ai-sp-selection-menu-item-icon img {
          filter: brightness(0) invert(1);
        }
        .ai-sp-selection-chip-fallback-icon {
          font-size: 20px;
          line-height: 1;
        }
        .ai-sp-selection-chip:hover,
        .ai-sp-selection-chip:focus-visible {
          background: var(--ai-sp-selection-soft-hover);
        }
        .ai-sp-selection-chip.primary:hover,
        .ai-sp-selection-chip.primary:focus-visible,
        .ai-sp-selection-chip.primary-toggle:hover,
        .ai-sp-selection-chip.primary-toggle:focus-visible,
        .ai-sp-selection-chip.more:hover,
        .ai-sp-selection-chip.more:focus-visible,
        .ai-sp-selection-chip.secondary:not(.is-active):hover,
        .ai-sp-selection-chip.secondary:not(.is-active):focus-visible {
          background: transparent;
        }
        .ai-sp-selection-action:hover,
        .ai-sp-selection-action:focus-visible {
          background: var(--ai-sp-selection-hover);
        }
        .ai-sp-selection-chip.primary {
          border-radius: 6px;
          padding: 0;
          background: transparent;
          color: inherit;
          flex: 0 0 auto;
          gap: 8px;
        }
        .ai-sp-selection-chip.primary-toggle {
          width: 12px;
          min-width: 12px;
          height: 12px;
          padding: 0;
          justify-content: center;
          border-left: none;
          border-radius: 6px;
          background: transparent;
        }
        .ai-sp-selection-chip.primary-toggle[hidden] {
          display: none;
        }
        .ai-sp-selection-chip.primary-toggle[data-open="true"] .ai-sp-selection-platform-arrow {
          transform: rotate(180deg);
        }
        .ai-sp-selection-chip.secondary {
          flex: 0 0 auto;
          padding: 6px;
        }
        .ai-sp-selection-chip.secondary.is-active {
          background: var(--ai-sp-selection-hover);
        }
        .ai-sp-selection-chip.more {
          min-width: 28px;
          width: 28px;
          height: 28px;
          justify-content: center;
          padding: 0;
          font-weight: 500;
          border-radius: 8px;
        }
        .ai-sp-selection-chip.more[hidden] {
          display: none;
        }
        .ai-sp-selection-chip.more:hover,
        .ai-sp-selection-chip.more:focus-visible,
        .ai-sp-selection-chip.more[data-open="true"] {
          background: var(--ai-sp-selection-hover);
        }
        #ai-sp-selection-toolbar[data-mode="icon"] .ai-sp-selection-chip.primary:hover,
        #ai-sp-selection-toolbar[data-mode="icon"] .ai-sp-selection-chip.primary:focus-visible,
        #ai-sp-selection-toolbar[data-mode="icon"] .ai-sp-selection-chip.primary[data-open="true"] {
          background: var(--ai-sp-selection-hover);
        }
        #ai-sp-selection-toolbar[data-mode="icon"] .ai-sp-selection-chip {
          width: 28px;
          min-width: 28px;
          max-width: 28px;
          min-height: 28px;
          padding: 0;
        }
        #ai-sp-selection-toolbar[data-mode="icon"] .ai-sp-selection-chip.primary {
          width: 28px;
          min-width: 28px;
          max-width: 28px;
          padding: 0;
        }
        #ai-sp-selection-toolbar[data-mode="icon"] .ai-sp-selection-chip.primary-toggle {
          display: none;
        }
        #ai-sp-selection-toolbar[data-mode="icon"] .ai-sp-selection-chip-label {
          display: none;
        }
        #ai-sp-selection-toolbar[data-mode="icon"] .ai-sp-selection-primary-group .ai-sp-selection-chip-label {
          display: none;
        }
        #ai-sp-selection-toolbar[data-mode="icon"] .ai-sp-selection-primary-group {
          gap: 0;
        }
        .ai-sp-selection-platform-logo {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          background: var(--ai-sp-selection-icon-bg);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          flex: 0 0 auto;
        }
        .ai-sp-selection-platform-logo img {
          width: 28px;
          height: 28px;
          display: block;
          object-fit: cover;
        }
        .ai-sp-selection-chip-label.platform {
          font-size: 14px;
          line-height: 14px;
          color: var(--ai-sp-selection-text);
        }
        .ai-sp-selection-platform-arrow {
          width: 12px;
          height: 12px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex: 0 0 auto;
          transition: transform 0.16s ease;
        }
        .ai-sp-selection-platform-arrow svg {
          width: 12px;
          height: 12px;
          display: block;
        }
        .ai-sp-selection-platform-menu {
          position: absolute;
          top: calc(100% + 16px);
          left: 0;
          display: flex;
          width: 180px;
          padding: 8px;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          border-radius: 12px;
          box-shadow: 0 18px 40px rgba(17, 24, 39, 0.18);
          background: var(--ai-sp-selection-menu-bg);
          border: 1px solid var(--ai-sp-selection-border);
          box-sizing: border-box;
        }
        .ai-sp-selection-platform-menu[hidden] {
          display: none;
        }
        .ai-sp-selection-platform-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          width: 100%;
        }
        .ai-sp-selection-platform-item {
          width: 100%;
          min-height: 40px;
          padding: 6px;
          border: none;
          border-radius: 8px;
          background: var(--ai-sp-selection-menu-bg);
          color: var(--ai-sp-selection-text);
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          align-self: stretch;
          text-align: left;
          box-sizing: border-box;
        }
        .ai-sp-selection-platform-item:hover,
        .ai-sp-selection-platform-item:focus-visible,
        .ai-sp-selection-platform-item.is-active {
          background: var(--ai-sp-selection-hover);
        }
        .ai-sp-selection-platform-item.is-active .ai-sp-selection-platform-item-name {
          color: #617bff;
        }
        .ai-sp-selection-platform-item-logo {
          width: 24px;
          height: 24px;
          border-radius: 6px;
          overflow: hidden;
          flex: 0 0 auto;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .ai-sp-selection-platform-item-logo img {
          width: 24px;
          height: 24px;
          display: block;
          object-fit: cover;
        }
        .ai-sp-selection-platform-item-name {
          flex: 1 1 auto;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .ai-sp-selection-platform-item-check {
          display: none;
        }
        .ai-sp-selection-chip-label {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .ai-sp-selection-action {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px;
          border-radius: 8px;
          background: transparent;
          border: none;
          color: var(--ai-sp-selection-text);
          cursor: pointer;
          flex: 0 0 auto;
        }
        .ai-sp-selection-action-icon {
          width: 20px;
          height: 20px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: var(--ai-sp-selection-text);
          flex: 0 0 auto;
        }
        .ai-sp-selection-action-icon svg {
          width: 20px;
          height: 20px;
          display: block;
        }
        .ai-sp-selection-action-label {
          font-size: 14px;
          line-height: 14px;
          font-weight: 400;
          color: var(--ai-sp-selection-text);
          white-space: nowrap;
        }
        #ai-sp-selection-toolbar[data-mode="icon"] .ai-sp-selection-action {
          width: 28px;
          height: 28px;
          min-width: 28px;
          min-height: 28px;
          padding: 4px;
          background: transparent;
          border-radius: 8px;
        }
        #ai-sp-selection-toolbar[data-mode="icon"] .ai-sp-selection-action:hover,
        #ai-sp-selection-toolbar[data-mode="icon"] .ai-sp-selection-action:focus-visible,
        #ai-sp-selection-toolbar[data-mode="icon"] .ai-sp-selection-action:active {
          background: var(--ai-sp-selection-hover);
        }
        #ai-sp-selection-toolbar[data-mode="icon"] .ai-sp-selection-action.is-active,
        #ai-sp-selection-toolbar[data-mode="icon"] .ai-sp-selection-action.is-active:hover,
        #ai-sp-selection-toolbar[data-mode="icon"] .ai-sp-selection-action.is-active:focus-visible {
          background: var(--ai-sp-selection-hover);
        }
        #ai-sp-selection-toolbar[data-mode="icon"] .ai-sp-selection-action-icon {
          width: 20px;
          height: 20px;
        }
        #ai-sp-selection-toolbar[data-mode="icon"] .ai-sp-selection-action-icon svg {
          width: 20px;
          height: 20px;
        }
        #ai-sp-selection-toolbar[data-mode="icon"] .ai-sp-selection-action-label {
          display: none;
        }
        .ai-sp-selection-quick {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
          overflow: hidden;
        }
        #ai-sp-selection-toolbar[data-mode="icon"] .ai-sp-selection-divider {
          height: 12px;
        }
        .ai-sp-selection-more-menu {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          min-width: 220px;
          padding: 10px;
          border-radius: 14px;
          box-shadow: 0 18px 40px rgba(17, 24, 39, 0.18);
          background: var(--ai-sp-selection-menu-bg);
          border: 1px solid var(--ai-sp-selection-border);
        }
        .ai-sp-selection-more-menu[hidden] {
          display: none;
        }
        .ai-sp-selection-more-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .ai-sp-selection-menu-item {
          width: 100%;
          border: none;
          border-radius: 10px;
          text-align: left;
          padding: 8px 10px;
          cursor: pointer;
          font-size: 12px;
          line-height: 1.4;
          background: var(--ai-sp-selection-menu-bg);
          color: var(--ai-sp-selection-text);
          display: flex;
          align-items: flex-start;
          gap: 8px;
        }
        .ai-sp-selection-menu-item:hover,
        .ai-sp-selection-menu-item:focus-visible {
          background: var(--ai-sp-selection-hover);
        }
        .ai-sp-selection-menu-item-icon {
          width: 20px;
          height: 20px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex: 0 0 auto;
          color: var(--ai-sp-selection-text);
        }
        .ai-sp-selection-menu-item-icon img,
        .ai-sp-selection-menu-item-icon svg {
          width: 20px;
          height: 20px;
          display: block;
          object-fit: contain;
        }
        .ai-sp-selection-menu-item-copy {
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-width: 0;
        }
        .ai-sp-selection-menu-item-title {
          font-size: 13px;
          line-height: 18px;
          color: var(--ai-sp-selection-text);
        }
        .ai-sp-selection-menu-item small {
          display: block;
          opacity: 0.65;
        }
        .ai-sp-selection-tooltip {
          position: fixed;
          left: 0;
          top: 0;
          transform: translate(-50%, 0);
          background: var(--ai-sp-selection-menu-bg);
          color: var(--ai-sp-selection-subtext);
          border: 1px solid var(--ai-sp-selection-border);
          border-radius: 6px;
          padding: 4px 8px;
          font-size: 12px;
          line-height: 1.2;
          white-space: nowrap;
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.12);
          pointer-events: none;
          opacity: 0;
          visibility: hidden;
          transition: opacity 0.16s ease;
        }
        .ai-sp-selection-tooltip.is-visible {
          opacity: 1;
          visibility: visible;
        }
        .ai-sp-selection-chip:disabled,
        .ai-sp-selection-action:disabled,
        .ai-sp-selection-menu-item:disabled,
        .ai-sp-selection-platform-item:disabled {
          background: var(--ai-sp-selection-disabled-bg);
          color: var(--ai-sp-selection-disabled-text);
          cursor: not-allowed;
          opacity: 0.7;
        }
        @media (max-width: 720px) {
          #ai-sp-selection-toolbar {
            gap: 8px;
            padding: 8px;
          }
          .ai-sp-selection-chip {
            min-height: 28px;
            font-size: 14px;
          }
          .ai-sp-selection-platform-logo,
          .ai-sp-selection-platform-logo img {
            width: 28px;
            height: 28px;
          }
          #ai-sp-selection-toolbar[data-mode="icon"] .ai-sp-selection-chip,
          #ai-sp-selection-toolbar[data-mode="icon"] .ai-sp-selection-chip.primary,
          .ai-sp-selection-chip.more {
            width: 28px;
            min-width: 28px;
            max-width: 28px;
          }
        }
      </style>
      <div id="ai-sp-selection-toolbar" data-placement="bottom" data-mode="text" data-theme="light">
        <div class="ai-sp-selection-main">
          <div class="ai-sp-selection-primary-group" id="ai-sp-selection-primary-group">
            <button class="ai-sp-selection-chip primary" id="ai-sp-selection-send-btn" data-selection-action="send" data-open="false" aria-haspopup="menu" aria-expanded="false">
              <span class="ai-sp-selection-platform-logo">
                <img id="ai-sp-selection-platform-logo-img" src="" alt="">
              </span>
              <span class="ai-sp-selection-chip-label platform" id="ai-sp-selection-platform-name">豆包</span>
            </button>
            <button
              class="ai-sp-selection-chip primary-toggle"
              id="ai-sp-selection-platform-toggle"
              data-selection-action="platforms-toggle"
              data-open="false"
              aria-label="切换平台"
              aria-haspopup="menu"
              aria-expanded="false"
            >
              <span class="ai-sp-selection-platform-arrow" aria-hidden="true">
                <svg viewBox="0 0 12 12" fill="none">
                  <path d="M2.4 4.4 6 7.8l3.6-3.4" stroke="#000000" stroke-width="0.72" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </span>
            </button>
            <div class="ai-sp-selection-platform-menu" id="ai-sp-selection-platform-menu" hidden>
              <div class="ai-sp-selection-platform-list" id="ai-sp-selection-platform-list" role="menu" aria-label="选择平台"></div>
            </div>
          </div>
          <span class="ai-sp-selection-divider platform"></span>
          <div class="ai-sp-selection-quick" id="ai-sp-selection-quick"></div>
          <span class="ai-sp-selection-divider action-end"></span>
          <button class="ai-sp-selection-chip more" id="ai-sp-selection-more-btn" data-selection-action="more" hidden aria-label="更多功能" title="更多功能">
            <span class="ai-sp-selection-chip-icon">${getSelectionMoreIconMarkup()}</span>
          </button>
        </div>
        <div class="ai-sp-selection-more-menu" id="ai-sp-selection-more-menu" hidden>
          <div class="ai-sp-selection-more-list" id="ai-sp-selection-more-list"></div>
        </div>
        <div class="ai-sp-selection-tooltip" id="ai-sp-selection-tooltip"></div>
      </div>
    `;
    document.documentElement.appendChild(el);
    selectionToolbarEl = el;
    return el;
  }

  function renderSelectionToolbar(payload) {
    ensureSelectionToolbar();
    selectionToolbarState = {
      text: payload.text,
      context: payload.context,
      page: payload.page,
      url: payload.url,
      time: payload.time,
      placement: 'bottom'
    };
    const toolbar = selectionToolbarShadow.getElementById('ai-sp-selection-toolbar');
    const quick = selectionToolbarShadow.getElementById('ai-sp-selection-quick');
    const moreList = selectionToolbarShadow.getElementById('ai-sp-selection-more-list');
    const moreBtn = selectionToolbarShadow.getElementById('ai-sp-selection-more-btn');
    const moreMenu = selectionToolbarShadow.getElementById('ai-sp-selection-more-menu');
    const primaryGroup = selectionToolbarShadow.getElementById('ai-sp-selection-primary-group');
    const platformMenu = selectionToolbarShadow.getElementById('ai-sp-selection-platform-menu');
    const tooltipEl = selectionToolbarShadow.getElementById('ai-sp-selection-tooltip');
    const selectionDisplayMode = normalizeSelectionDisplayMode(userConfig.selectionDisplayMode);
    const promptOrder = normalizePromptOrder(userConfig.promptOrder, promptLibraryCache);
    const morePromptIds = normalizeMorePromptIds(userConfig.selectionMorePromptIds, promptLibraryCache);
    const orderedPrompts = promptOrder
      .map((id) => promptLibraryCache.find((item) => item.id === id))
      .filter(Boolean);
    const enabledPrompts = orderedPrompts.filter((item) => item.enabled !== false);
    const allPromptsById = new Map(promptLibraryCache.map((item) => [item.id, item]));
    const quickPrompts = enabledPrompts.slice(0, 3);
    const morePrompts = morePromptIds
      .map((id) => allPromptsById.get(id))
      .filter(Boolean);
    toolbar.className = '';
    toolbar.dataset.mode = selectionDisplayMode;
    toolbar.dataset.theme = payload.theme === 'dark' ? 'dark' : 'light';
    refreshSelectionPlatformUI();
    quick.innerHTML = quickPrompts.map((item) => `
      <button
        class="ai-sp-selection-action"
        data-selection-action="prompt"
        data-prompt-id="${escapeSelectionHtml(item.id)}"
        title="${escapeSelectionHtml(item.title)}"
        aria-label="${escapeSelectionHtml(item.title)}"
      >
        <span class="ai-sp-selection-action-icon">${getSelectionPromptIconMarkup(item)}</span>
        <span class="ai-sp-selection-action-label">${escapeSelectionHtml(item.title)}</span>
      </button>
    `).join('');
    moreList.innerHTML = `
      ${morePrompts.map((item) => `
        <button class="ai-sp-selection-menu-item" data-selection-action="prompt" data-prompt-id="${escapeSelectionHtml(item.id)}">
          <span class="ai-sp-selection-menu-item-icon">${getSelectionMenuIconMarkup(SELECTION_PROMPT_ICON_MAP[item.iconKey || item.id], item.icon || '•')}</span>
          <span class="ai-sp-selection-menu-item-copy">
            <span class="ai-sp-selection-menu-item-title">${escapeSelectionHtml(item.title)}</span>
            <small>${escapeSelectionHtml(item.template.replace(/\s+/g, ' ').slice(0, 48))}</small>
          </span>
        </button>
      `).join('')}
    `;
    moreBtn.hidden = morePrompts.length === 0;
    const hideSelectionTooltip = () => {
      if (tooltipEl) {
        tooltipEl.classList.remove('is-visible');
      }
    };
    const showSelectionTooltip = (target) => {
      if (!tooltipEl || selectionDisplayMode !== 'icon' || !target) {
        hideSelectionTooltip();
        return;
      }
      const text = target.getAttribute('aria-label') || target.getAttribute('title') || '';
      if (!text) {
        hideSelectionTooltip();
        return;
      }
      tooltipEl.textContent = text;
      tooltipEl.classList.add('is-visible');
      const rect = target.getBoundingClientRect();
      const toolbarRect = toolbar.getBoundingClientRect();
      const tipRect = tooltipEl.getBoundingClientRect();
      const left = Math.min(window.innerWidth - tipRect.width / 2 - 8, Math.max(tipRect.width / 2 + 8, rect.left + rect.width / 2));
      const top = Math.max(8, toolbarRect.top - tipRect.height - 4);
      tooltipEl.style.left = `${left}px`;
      tooltipEl.style.top = `${top}px`;
    };
    if (primaryGroup && platformMenu) {
      primaryGroup.onmouseenter = () => {
        closeSelectionMoreMenu();
        openSelectionPlatformMenu();
      };
      primaryGroup.onmouseleave = () => {
        scheduleCloseSelectionPlatformMenu();
      };
      platformMenu.onmouseenter = () => {
        if (selectionPlatformMenuTimer) {
          clearTimeout(selectionPlatformMenuTimer);
          selectionPlatformMenuTimer = null;
        }
      };
      platformMenu.onmouseleave = () => {
        scheduleCloseSelectionPlatformMenu();
      };
    }
    if (moreBtn && moreMenu) {
      moreBtn.onmouseenter = () => {
        closeSelectionPlatformMenu();
        openSelectionMoreMenu();
      };
      moreBtn.onmouseleave = () => {
        scheduleCloseSelectionMoreMenu();
      };
      moreMenu.onmouseenter = () => {
        if (selectionMoreMenuTimer) {
          clearTimeout(selectionMoreMenuTimer);
          selectionMoreMenuTimer = null;
        }
      };
      moreMenu.onmouseleave = () => {
        scheduleCloseSelectionMoreMenu();
      };
    }
    toolbar.onmousedown = (event) => {
      event.preventDefault();
      event.stopPropagation();
    };
    toolbar.ontouchstart = (event) => {
      event.stopPropagation();
    };
    toolbar.onmouseover = (event) => {
      const button = event.target.closest('.ai-sp-selection-main button');
      if (!button) {
        hideSelectionTooltip();
        return;
      }
      showSelectionTooltip(button);
    };
    toolbar.onmouseout = (event) => {
      if (event.relatedTarget && toolbar.contains(event.relatedTarget) && event.relatedTarget.closest('.ai-sp-selection-main button')) {
        return;
      }
      hideSelectionTooltip();
    };
    toolbar.onfocusin = (event) => {
      const button = event.target.closest('.ai-sp-selection-main button');
      if (!button) return;
      showSelectionTooltip(button);
    };
    toolbar.onfocusout = () => {
      hideSelectionTooltip();
    };
    toolbar.onclick = async (event) => {
      const target = event.target.closest('button');
      if (!target) return;
      hideSelectionTooltip();
      const action = target.dataset.selectionAction;
      if (action === 'platforms-toggle') {
        const nextOpen = platformMenu.hidden;
        closeSelectionMoreMenu();
        if (nextOpen) {
          openSelectionPlatformMenu();
        } else {
          closeSelectionPlatformMenu();
        }
        return;
      }
      if (action === 'platform-select') {
        const nextPlatform = target.dataset.platformId;
        if (AI_PLATFORMS[nextPlatform]) {
          syncSelectionPlatform(nextPlatform);
          refreshSelectionPlatformUI();
        }
        closeSelectionPlatformMenu();
        return;
      }
      if (action === 'more') {
        const nextOpen = moreMenu.hidden;
        closeSelectionPlatformMenu();
        if (nextOpen) {
          openSelectionMoreMenu();
        } else {
          closeSelectionMoreMenu();
        }
        return;
      }
      if (action === 'prompts') {
        openExtensionPage('prompt-library/prompt_library.html');
        hideSelectionToolbar(true);
        return;
      }
      if (action === 'send') {
        closeSelectionMoreMenu();
        if (platformMenu.hidden) {
          openSelectionPlatformMenu();
        } else {
          closeSelectionPlatformMenu();
        }
        return;
      }
      if (action === 'prompt') {
        const prompt = promptLibraryCache.find((item) => item.id === target.dataset.promptId);
        if (!prompt) return;
        await openSelectionPrompt(applyPromptTemplate(prompt.template, selectionToolbarState.text, selectionToolbarState));
        hideSelectionToolbar(true);
      }
    };
    return toolbar;
  }

  function positionSelectionToolbar(rect) {
    ensureSelectionToolbar();
    const toolbar = selectionToolbarShadow.getElementById('ai-sp-selection-toolbar');
    const gap = 14;
    selectionToolbarEl.style.display = 'block';
    const toolbarRect = toolbar.getBoundingClientRect();
    const centeredLeft = rect.left + rect.width / 2 - toolbarRect.width / 2;
    const left = Math.min(window.innerWidth - toolbarRect.width - 12, Math.max(12, centeredLeft));
    const canPlaceTop = rect.top >= toolbarRect.height + gap + 12;
    const top = canPlaceTop
      ? rect.top - toolbarRect.height - gap
      : Math.min(window.innerHeight - toolbarRect.height - 12, rect.bottom + gap);
    selectionToolbarState.placement = canPlaceTop ? 'top' : 'bottom';
    toolbar.dataset.placement = selectionToolbarState.placement;
    toolbar.style.left = `${left}px`;
    toolbar.style.top = `${top}px`;
  }

  function isSelectionToolbarEvent(event) {
    if (!selectionToolbarEl || !event) return false;
    const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
    return path.includes(selectionToolbarEl) || selectionToolbarEl.contains(event.target);
  }

  function initSelectionQuickAsk() {
    loadPromptLibrary();
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && changes[PROMPT_LIBRARY_STORAGE_KEY]) {
        promptLibraryCache = normalizePromptLibrary(changes[PROMPT_LIBRARY_STORAGE_KEY].newValue);
      }
      if (areaName === 'local' && changes[FLOATING_CONTEXT_ACTION_STORAGE_KEY]?.newValue) {
        pendingFloatingContextAction = changes[FLOATING_CONTEXT_ACTION_STORAGE_KEY].newValue;
        if (window.__aiSearchProConsumeFloatingContextAction) {
          window.__aiSearchProConsumeFloatingContextAction(pendingFloatingContextAction)
            .then((consumed) => {
              if (consumed) {
                pendingFloatingContextAction = null;
                clearQueuedFloatingContextAction().catch(() => {});
              }
            })
            .catch(() => {});
        }
      }
      if (areaName === 'local' && changes.aiSearchProConfig) {
        userConfig = normalizeUserConfig(changes.aiSearchProConfig.newValue);
        if (!isSelectionToolbarEnabled()) {
          hideSelectionToolbar(true);
        }
        const container = document.getElementById('ai-sp-container');
        if (!isSearchAssistantEnabledForCurrentPage()) {
          if (container) container.remove();
          return;
        }
        if (container) {
          if (getSelectionTheme() === 'dark') {
            container.setAttribute('data-ai-sp-theme', 'dark');
          } else {
            container.removeAttribute('data-ai-sp-theme');
          }
          const themeBtn = container.querySelector('#ai-sp-theme-btn');
          if (themeBtn) {
            const isDark = getSelectionTheme() === 'dark';
            const sunIcon = themeBtn.querySelector('.ai-sp-icon-sun');
            const moonIcon = themeBtn.querySelector('.ai-sp-icon-moon');
            const themeTip = themeBtn.querySelector('.ai-sp-tooltip');
            if (sunIcon) sunIcon.style.display = isDark ? 'block' : 'none';
            if (moonIcon) moonIcon.style.display = isDark ? 'none' : 'block';
            if (themeTip) themeTip.textContent = isDark ? '切换浅色模式' : '切换深色模式';
          }
          userConfig.platforms.filter(p => p.enabled).forEach((item) => {
            const iframe = document.getElementById(`ai-sp-iframe-${item.id}`);
            if (iframe && loadedPlatforms[item.id]) sendThemeToIframe(iframe);
          });
        }
        if (!container) {
          renderInitialUI();
        }
      }
    });
    subscribeSystemThemeChange(() => {
      if (userConfig.theme !== 'auto') return;
      const container = document.getElementById('ai-sp-container');
      if (!container) return;
      if (getSelectionTheme() === 'dark') {
        container.setAttribute('data-ai-sp-theme', 'dark');
      } else {
        container.removeAttribute('data-ai-sp-theme');
      }
      userConfig.platforms.filter(p => p.enabled).forEach((item) => {
        const iframe = document.getElementById(`ai-sp-iframe-${item.id}`);
        if (iframe && loadedPlatforms[item.id]) sendThemeToIframe(iframe);
      });
    });
    document.addEventListener('mousedown', (event) => {
      if (isSelectionToolbarEvent(event)) return;
      if (selectionToolbarEl && !selectionToolbarEl.contains(event.target)) {
        hideSelectionToolbar(true);
      }
    });
    document.addEventListener('scroll', () => refreshSelectionToolbarPosition(), true);
    window.addEventListener('resize', () => refreshSelectionToolbarPosition());
    document.addEventListener('touchstart', (event) => {
      if (isSelectionToolbarEvent(event)) return;
      hideSelectionToolbar(true);
    }, { passive: true });
    document.addEventListener('selectionchange', () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        hideSelectionToolbar();
      }
    });
    const showSelectionToolbar = (event) => {
      window.setTimeout(async () => {
        if (isSelectionToolbarEvent(event)) return;
        if (!isSelectionToolbarEnabled()) {
          hideSelectionToolbar(true);
          return;
        }
        const payload = getSelectionPayload();
        if (!payload) {
          hideSelectionToolbar();
          return;
        }
        await loadPromptLibrary();
        renderSelectionToolbar(payload);
        positionSelectionToolbar(payload.rect);
      }, 0);
    };
    document.addEventListener('mouseup', showSelectionToolbar);
    document.addEventListener('touchend', showSelectionToolbar, { passive: true });
  }

  // 拦截搜索引擎首页的搜索事件，只有在表单提交（回车或点击搜索按钮）时才记录并传递搜索词
  function initSearchInterception() {
    if (!isSearchAssistantEnabledForCurrentPage()) return;
    const host = window.location.hostname;
    const isHomePage = window.location.pathname === '/' && !window.location.search;
    
    if (!isHomePage) return;

    // 百度首页拦截
    if (host.includes('baidu.com')) {
      const form = document.querySelector('#form');
      const input = document.querySelector('#kw');

      if (form && input) {
        form.addEventListener('submit', () => {
          if (input.value.trim()) {
            // 利用 sessionStorage 极速同步传递（比 chrome.storage 异步快得多）
            sessionStorage.setItem('aiSearchProFastQuery', input.value.trim());
          }
        });
      }
    } 
    // Google 首页拦截
    else if (host.includes('google.com')) {
      const form = document.querySelector('form[action="/search"]');
      const input = document.querySelector('textarea[name="q"], input[name="q"]');
      
      if (form && input) {
        form.addEventListener('submit', () => {
          if (input.value.trim()) {
            sessionStorage.setItem('aiSearchProFastQuery', input.value.trim());
          }
        });
      }
    }
    // Bing 首页拦截
    else if (host.includes('bing.com')) {
      const form = document.querySelector('#sb_form');
      const input = document.querySelector('#sb_form_q');
      
      if (form && input) {
        form.addEventListener('submit', () => {
          if (input.value.trim()) {
            sessionStorage.setItem('aiSearchProFastQuery', input.value.trim());
          }
        });
      }
    }
  }

  // 修改获取搜索词的逻辑，做到真正的同步、零延迟
  // 只有当 URL 中真正包含搜索参数，或者是由首页拦截到提交事件时，才返回搜索词
  function getSearchQuery() {
    // 1. 最高优先级：刚从首页跳转过来时，同步读取 sessionStorage（这说明用户已经点击了搜索或按了回车）
    const fastQuery = sessionStorage.getItem('aiSearchProFastQuery');
    if (fastQuery) {
      sessionStorage.removeItem('aiSearchProFastQuery'); // 消费后立刻删除
      return fastQuery;
    }

    // 2. 次优级：直接解析当前 URL 参数（URL 中有参数，说明已经是搜索结果页，且搜索已提交）
    const host = window.location.hostname;
    const url = new URL(window.location.href);
    
    if (host.includes('baidu.com')) {
      const wd = url.searchParams.get('wd') || url.searchParams.get('word');
      if (wd) return wd;
      // 移除直接读取输入框的逻辑，因为输入框的值在未提交时也会变，导致提前触发
    } else if (host.includes('google.com')) {
      const q = url.searchParams.get('q');
      if (q) return q;
    } else if (host.includes('bing.com')) {
      const q = url.searchParams.get('q');
      if (q) return q;
    }
    
    return '';
  }

  function shouldUseHashBootstrap(platformKey) {
    return platformKey !== 'kimi';
  }

  function buildPlatformUrl(platformKey, text) {
    const base = AI_PLATFORMS[platformKey].url;
    const queryText = (text || '').trim();
    if (!queryText || !shouldUseHashBootstrap(platformKey)) return base;
    return `${base}#q=${encodeURIComponent(queryText)}`;
  }

  function sendQueryToIframe(iframe, text) {
    const queryText = (text || '').trim();
    if (!iframe || !iframe.contentWindow || !queryText) return;
    try {
      iframe.contentWindow.postMessage({ type: 'AI_SEARCH_PRO_NEW_QUERY', query: queryText }, '*');
    } catch (e) {}
  }

  function sendThemeToIframe(iframe) {
    if (!iframe || !iframe.contentWindow) return;
    try {
      iframe.contentWindow.postMessage({ type: 'AI_SEARCH_PRO_THEME_CHANGE', theme: getSelectionTheme() }, '*');
    } catch (e) {}
  }

  // 提取创建 UI 的核心逻辑，允许在配置加载前先渲染默认外壳
  async function renderInitialUI() {
    if (document.getElementById('ai-sp-container')) return;
    if (await queryNativeSidebarState()) return;
    if (!isSearchAssistantEnabledForCurrentPage()) return;

    // 获取搜索词（同步）
    const query = getSearchQuery();
    if (!query) return;

    // 先用默认配置渲染外壳，保证小窗秒出
    createUI(query, userConfig.platforms.filter(p => p.enabled).map(p => p.id));
  }

  // 修改 createUI 接收 query 和 enabledPlatformsList 参数
  function createUI(query, enabledPlatforms, options = {}) {
    if (document.getElementById('ai-sp-container')) return;

    if (enabledPlatforms.length === 0) {
        console.warn('AIChatbox: No platforms enabled');
        return;
      }
    
    const searchEngineId = getCurrentSearchEngineId();
    const preferredSearchPlatform = getDefaultSearchAssistantPlatformId();
    if (searchEngineId && enabledPlatforms.includes(preferredSearchPlatform)) {
      currentPlatform = preferredSearchPlatform;
    } else if (!enabledPlatforms.includes(currentPlatform)) {
      currentPlatform = enabledPlatforms[0];
    }

    // --- 1. 创建统一的容器外壳 ---
    const container = document.createElement('div');
    container.id = 'ai-sp-container';
    container.className = 'is-floating-mode';
    
    // 记录每个平台对应的 iframe 是否已经加载过
    const loadedPlatforms = {};
    const platformUrls = {};
    const EMBEDDED_SEND_EVENT = 'AI_SP_EMBEDDED_SEND';
    const EMBEDDED_SEND_DONE_EVENT = 'AI_SP_EMBEDDED_SEND_DONE';
    const EMBEDDED_SEND_READY_REQUEST_EVENT = 'AI_SP_EMBEDDED_SEND_READY_REQUEST';
    const EMBEDDED_SEND_READY_RESPONSE_EVENT = 'AI_SP_EMBEDDED_SEND_READY_RESPONSE';
    const SEND_READY_MAX_RETRIES = 8;
    const SEND_READY_RETRY_GAP = 450;
    const SEND_READY_STABLE_DELAY = 320;
    const pendingEmbeddedSends = new Map();
    const sendReadyRequests = new Map();
    const pendingSummaryRequests = new Map();
    let currentSessionQuery = (query || '').trim();
    let lastFloatingActionId = '';
      const getEnabledPlatformsList = () => userConfig.platforms
      .filter(p => p.enabled && AI_PLATFORMS[p.id])
      .map(p => p.id);
    const getSearchSyncPlatformId = () => {
      const preferred = getDefaultSearchAssistantPlatformId();
      const enabled = getEnabledPlatformsList();
      if (enabled.includes(preferred)) return preferred;
      return enabled[0] || preferred;
    };
    const getCurrentQueryText = () => getSearchQuery() || currentSessionQuery || '';

    const buildNativeSidePanelState = () => {
      const enabledPlatformsList = getEnabledPlatformsList();
      const urls = {};
      enabledPlatformsList.forEach((key) => {
        const iframe = document.getElementById(`ai-sp-iframe-${key}`);
        urls[key] = (iframe && iframe.src) ? iframe.src : (platformUrls[key] || buildPlatformUrl(key, getCurrentQueryText()));
      });
      return {
        currentPlatform,
        enabledPlatforms: enabledPlatformsList,
        platformUrls: urls,
        activeUrl: urls[currentPlatform] || AI_PLATFORMS[currentPlatform].url,
        query: getCurrentQueryText(),
        theme: getSelectionTheme()
      };
    };

    const syncNativeSidePanelState = () => {
      chrome.runtime.sendMessage({
        type: 'SYNC_SIDEPANEL_STATE',
        state: buildNativeSidePanelState()
      }, () => chrome.runtime.lastError);
    };

    const makeSendRequestId = () => `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const makeSessionRecordId = () => `fav_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const updateSessionStatus = (text, isError = false) => {
      const statusEl = container.querySelector('#ai-sp-session-status');
      if (!statusEl) return;
      statusEl.textContent = text || '';
      statusEl.dataset.state = isError ? 'error' : 'default';
    };

    const clearSessionStatus = (delay = 2200) => {
      window.setTimeout(() => {
        const statusEl = container.querySelector('#ai-sp-session-status');
        if (!statusEl) return;
        statusEl.textContent = '';
        statusEl.dataset.state = 'default';
      }, delay);
    };

    const closePromptMenu = () => {
      const menu = container.querySelector('#ai-sp-prompt-menu');
      if (menu) menu.style.display = 'none';
    };

    const buildSessionMarkdown = (snapshot, actionLabel = '导出时间') => {
      const lines = [
        '# OmniAI 会话',
        '',
        `- 问题：${snapshot.query || '未命名问题'}`,
        `- 来源：${snapshot.sourceLabel}`,
        `- 当前平台：${snapshot.activePlatformName || '未选择'}`,
        `- ${actionLabel}：${new Date(snapshot.createdAt).toLocaleString()}`
      ];
      if (snapshot.sourceUrl) {
        lines.push(`- 来源网页：${snapshot.sourceUrl}`);
      }
      lines.push('');
      snapshot.panes.forEach((pane) => {
        lines.push(`## ${pane.platformName}`);
        if (pane.active) lines.push('- 当前查看：是');
        if (pane.url) lines.push(`- 地址：${pane.url}`);
        lines.push('');
        lines.push(pane.summary || '暂无摘要');
        lines.push('');
      });
      return lines.join('\n');
    };

    const downloadMarkdownFile = (title, content) => {
      const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${(title || 'OmniAI会话').slice(0, 24)}.md`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    };

    const requestPlatformSummary = (platformKey, timeout = 3200) => new Promise((resolve) => {
      const iframe = document.getElementById(`ai-sp-iframe-${platformKey}`);
      if (!iframe?.contentWindow || !loadedPlatforms[platformKey]) {
        resolve({ platformKey, summary: '', url: platformUrls[platformKey] || '' });
        return;
      }
      const requestId = `sum_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const timer = window.setTimeout(() => {
        pendingSummaryRequests.delete(requestId);
        resolve({
          platformKey,
          summary: '',
          url: iframe.src || platformUrls[platformKey] || ''
        });
      }, timeout);
      pendingSummaryRequests.set(requestId, { platformKey, resolve, timer, iframe });
      try {
        iframe.contentWindow.postMessage({ type: 'AI_SEARCH_PRO_REQUEST_SUMMARY', requestId }, '*');
      } catch (e) {
        clearTimeout(timer);
        pendingSummaryRequests.delete(requestId);
        resolve({
          platformKey,
          summary: '',
          url: iframe.src || platformUrls[platformKey] || ''
        });
      }
    });

    const collectSessionSnapshot = async (sourceLabel) => {
      const activeQuery = getCurrentQueryText().trim();
      const enabledPlatformsList = getEnabledPlatformsList();
      const summaries = await Promise.all(enabledPlatformsList.map((platformKey) => requestPlatformSummary(platformKey)));
      const panes = enabledPlatformsList.map((platformKey) => {
        const summaryItem = summaries.find((item) => item.platformKey === platformKey) || {};
        const iframe = document.getElementById(`ai-sp-iframe-${platformKey}`);
        return {
          platform: platformKey,
          platformName: AI_PLATFORMS[platformKey]?.name || platformKey,
          summary: summaryItem.summary || '',
          url: summaryItem.url || iframe?.src || platformUrls[platformKey] || AI_PLATFORMS[platformKey]?.url || '',
          active: platformKey === currentPlatform
        };
      });
      const messages = [];
      if (activeQuery) {
        messages.push({
          role: 'user',
          label: '用户',
          content: activeQuery
        });
      }
      panes.forEach((pane) => {
        if (!String(pane.summary || '').trim()) return;
        messages.push({
          role: 'ai',
          label: pane.platformName || pane.platform || 'AI',
          content: pane.summary || '',
          platform: pane.platform,
          active: pane.active === true
        });
      });
      return {
        id: makeSessionRecordId(),
        type: 'session',
        source: 'floating',
        sourceLabel,
        title: activeQuery || '未命名问题',
        query: activeQuery,
        createdAt: Date.now(),
        currentPlatform,
        activePlatformName: AI_PLATFORMS[currentPlatform]?.name || currentPlatform,
        sourceUrl: window.location.href,
        panes,
        messages
      };
    };

    const saveCurrentSessionFavorite = async () => {
      const activeQuery = getCurrentQueryText().trim();
      if (!activeQuery) {
        updateSessionStatus('当前没有可保存的内容', true);
        clearSessionStatus();
        return;
      }
      updateSessionStatus('正在保存到备忘录...');
      const snapshot = await collectSessionSnapshot('小窗');
      snapshot.markdown = buildSessionMarkdown(snapshot, '保存时间');
      const data = await chrome.storage.local.get([FAVORITES_STORAGE_KEY]);
      const list = Array.isArray(data?.[FAVORITES_STORAGE_KEY]) ? data[FAVORITES_STORAGE_KEY] : [];
      await chrome.storage.local.set({ [FAVORITES_STORAGE_KEY]: [snapshot, ...list].slice(0, 100) });
      updateSessionStatus('已保存到备忘录');
      clearSessionStatus();
    };

    const exportCurrentSessionMarkdown = async () => {
      const activeQuery = getCurrentQueryText().trim();
      if (!activeQuery) {
        updateSessionStatus('当前没有可导出的内容', true);
        clearSessionStatus();
        return;
      }
      updateSessionStatus('正在导出...');
      const snapshot = await collectSessionSnapshot('小窗');
      const markdown = buildSessionMarkdown(snapshot, '导出时间');
      downloadMarkdownFile(snapshot.title, markdown);
      updateSessionStatus('Markdown 已导出');
      clearSessionStatus();
    };

    const renderPromptMenu = async () => {
      const menu = container.querySelector('#ai-sp-prompt-menu');
      if (!menu) return;
      const prompts = await loadPromptLibrary();
      const enabledPromptList = prompts.filter((item) => item.enabled !== false);
      if (!enabledPromptList.length) {
        menu.innerHTML = '<div class="ai-sp-prompt-empty">暂无可用提示词</div>';
      } else {
        menu.innerHTML = enabledPromptList.map((item) => `
          <button class="ai-sp-prompt-item" data-prompt-id="${item.id}">
            <strong>${item.icon || '💡'} ${item.title}</strong>
            <span>${item.template.replace(/\s+/g, ' ').slice(0, 60)}</span>
          </button>
        `).join('');
      }
      menu.style.display = 'flex';
    };

    const clearReadyRequestEntry = (key) => {
      const entry = sendReadyRequests.get(key);
      if (!entry) return;
      clearTimeout(entry.timer);
      sendReadyRequests.delete(key);
    };

    const clearReadyRequestsByRequestId = (requestId) => {
      Array.from(sendReadyRequests.keys()).forEach((key) => {
        if (key.startsWith(`${requestId}:`)) clearReadyRequestEntry(key);
      });
    };

    const finalizeEmbeddedSend = (requestId) => {
      const pending = pendingEmbeddedSends.get(requestId);
      if (!pending) return;
      clearTimeout(pending.timer);
      clearReadyRequestsByRequestId(requestId);
      pendingEmbeddedSends.delete(requestId);
    };

    const markEmbeddedSendFailure = (requestId, platformKey) => {
      const pending = pendingEmbeddedSends.get(requestId);
      if (!pending || pending.done.has(platformKey)) return;
      pending.failed.add(platformKey);
      if (pending.done.size + pending.failed.size >= pending.expected.size) {
        finalizeEmbeddedSend(requestId);
      }
    };

    const dispatchEmbeddedSend = (platformKey, text, requestId) => {
      const iframe = document.getElementById(`ai-sp-iframe-${platformKey}`);
      if (!iframe?.contentWindow) {
        markEmbeddedSendFailure(requestId, platformKey);
        return;
      }
      try {
        iframe.contentWindow.postMessage({
          type: EMBEDDED_SEND_EVENT,
          text,
          submit: true,
          requestId,
          paneId: platformKey
        }, '*');
      } catch (e) {
        markEmbeddedSendFailure(requestId, platformKey);
      }
    };

    const queueEmbeddedSend = (platformKey, text, requestId, attempt = 1) => {
      const iframe = document.getElementById(`ai-sp-iframe-${platformKey}`);
      if (!iframe?.contentWindow) {
        markEmbeddedSendFailure(requestId, platformKey);
        return;
      }
      const key = `${requestId}:${platformKey}`;
      clearReadyRequestEntry(key);
      const timer = window.setTimeout(() => {
        clearReadyRequestEntry(key);
        if (attempt < SEND_READY_MAX_RETRIES) {
          queueEmbeddedSend(platformKey, text, requestId, attempt + 1);
        } else {
          markEmbeddedSendFailure(requestId, platformKey);
        }
      }, SEND_READY_RETRY_GAP);
      sendReadyRequests.set(key, { platformKey, text, requestId, attempt, timer });
      try {
        iframe.contentWindow.postMessage({
          type: EMBEDDED_SEND_READY_REQUEST_EVENT,
          requestId,
          paneId: platformKey
        }, '*');
      } catch (e) {
        clearReadyRequestEntry(key);
        if (attempt < SEND_READY_MAX_RETRIES) {
          queueEmbeddedSend(platformKey, text, requestId, attempt + 1);
        } else {
          markEmbeddedSendFailure(requestId, platformKey);
        }
      }
    };

    const openNativeSidePanel = () => {
      chrome.runtime.sendMessage({
        type: 'OPEN_NATIVE_SIDEBAR',
        state: buildNativeSidePanelState()
      }, (response) => {
        if (chrome.runtime.lastError) return;
        if (response?.ok) {
          closeAll();
        }
      });
    };
    
    enabledPlatforms.forEach(platformKey => {
      const isCurrent = platformKey === currentPlatform;
      loadedPlatforms[platformKey] = isCurrent;
      platformUrls[platformKey] = isCurrent ? buildPlatformUrl(platformKey, query) : 'about:blank';
    });

    container.innerHTML = `
      <!-- 侧边栏拖拽调整宽度的区域 -->
      <div class="ai-sp-sidebar-resizer"></div>
      
      <!-- 设置页面面板 -->
      <div class="ai-sp-settings-panel" id="ai-sp-settings-panel" style="display: none;">
        <div class="ai-sp-settings-header">
          <button class="ai-sp-settings-back-btn" id="ai-sp-settings-back-btn" title="返回">
            <img src="${chrome.runtime.getURL('icons/settings-back.svg')}" style="width:20px;height:20px;" />
          </button>
          <span>AI 助手</span>
          <div style="flex: 1;"></div>
          <button class="ai-sp-settings-save-btn" id="ai-sp-settings-save-btn">保存</button>
        </div>
        <div class="ai-sp-settings-content">
          <!-- 平台管理 -->
          <div class="ai-sp-platform-list" id="ai-sp-platform-list" style="margin-bottom: 24px;">
            ${userConfig.platforms.map(p => {
              if(!AI_PLATFORMS[p.id]) return '';
              const data = AI_PLATFORMS[p.id];
              return `
                <div class="ai-sp-platform-item" data-id="${p.id}" draggable="true">
                  <div class="ai-sp-platform-drag-handle">
                    <img src="${chrome.runtime.getURL('icons/settings-sort-drag.svg')}" style="width:16px;height:16px;" />
                    <span class="ai-sp-tooltip">按住拖拽排序</span>
                  </div>
                  <div class="ai-sp-platform-info">
                    <span>${data.settingsIcon}</span>
                    <div class="ai-sp-platform-info-text">
                      <span>${data.name}</span>
                      <span class="ai-sp-platform-url">${new URL(data.url).hostname}</span>
                    </div>
                  </div>
                  <label class="ai-sp-switch">
                    <input type="checkbox" class="ai-sp-platform-toggle" data-id="${p.id}" ${p.enabled ? 'checked' : ''}>
                    <span class="ai-sp-slider"></span>
                  </label>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
      
      <div class="ai-sp-header">
      <div class="ai-sp-header-left">
        <button id="ai-sp-drag-btn" class="ai-sp-drag-handle">
          <img src="${chrome.runtime.getURL('icons/drag.svg')}" style="width:20px;height:20px;pointer-events:none;" />
          <span class="ai-sp-tooltip">按住拖拽</span>
        </button>
        <img src="${chrome.runtime.getURL('icons/aichatbox.png')}" style="width: 18px; height: 18px; margin-right: 6px;">
      </div>
      <div class="ai-sp-header-controls">
        <button id="ai-sp-theme-btn">
          <img class="ai-sp-icon-sun" src="${chrome.runtime.getURL('icons/sun.svg')}" style="width:20px;height:20px;display:${getSelectionTheme() === 'dark' ? 'block' : 'none'};" />
          <img class="ai-sp-icon-moon" src="${chrome.runtime.getURL('icons/moon.svg')}" style="width:20px;height:20px;display:${getSelectionTheme() === 'dark' ? 'none' : 'block'};" />
          <span class="ai-sp-tooltip">${getSelectionTheme() === 'dark' ? '切换浅色模式' : '切换深色模式'}</span>
        </button>
        <button id="ai-sp-prompt-library-toolbar-btn">
          <img src="${chrome.runtime.getURL('icons/selection-prompts.svg')}" style="width:20px;height:20px;" />
          <span class="ai-sp-tooltip">提示词</span>
        </button>
        <button id="ai-sp-memo-btn" aria-label="打开备忘录">
          <img src="${chrome.runtime.getURL('icons/memo.svg')}" style="width:20px;height:20px;" />
          <span class="ai-sp-tooltip">打开备忘录</span>
        </button>
        <button id="ai-sp-split-mode-btn">
          <img src="${chrome.runtime.getURL('icons/split.svg')}" style="width:20px;height:20px;" />
          <span class="ai-sp-tooltip">内容对比</span>
        </button>
        <button id="ai-sp-web-btn">
          <img src="${chrome.runtime.getURL('icons/web.svg')}" style="width:20px;height:20px;" />
          <span class="ai-sp-tooltip">网页打开</span>
        </button>
        <button id="ai-sp-toggle-mode-btn">
          <img src="${chrome.runtime.getURL('icons/sidebar.svg')}" style="width:20px;height:20px;" />
          <span class="ai-sp-tooltip" id="ai-sp-toggle-mode-tooltip">侧边栏打开</span>
        </button>
        <div class="ai-sp-header-menu-wrap" id="ai-sp-settings-menu-wrap">
          <button id="ai-sp-settings-btn" aria-label="设置" aria-haspopup="menu" aria-expanded="false">
            <img src="${chrome.runtime.getURL('icons/settings.svg')}" style="width:20px;height:20px;" />
          </button>
          <div class="ai-sp-header-dropdown" id="ai-sp-settings-menu" hidden>
            ${SETTINGS_MENU_ITEMS.map((item) => `
              <button class="ai-sp-header-dropdown-item" ${item.action ? `data-action="${item.action}"` : ''} ${item.tab ? `data-settings-tab="${item.tab}"` : ''} ${item.pagePath ? `data-page-path="${item.pagePath}"` : ''}>${item.label}</button>
            `).join('')}
          </div>
        </div>
        <button id="ai-sp-close-btn">
          <img src="${chrome.runtime.getURL('icons/close.svg')}" style="width:20px;height:20px;" />
          <span class="ai-sp-tooltip">关闭</span>
        </button>
      </div>
    </div>

      <div class="ai-sp-platforms-wrapper">
        <button class="ai-sp-platforms-scroll-btn is-disabled" id="ai-sp-scroll-left">
          <img src="${chrome.runtime.getURL('icons/platform-arrow-left.svg')}" style="width:16px;height:16px;" />
        </button>
        <div class="ai-sp-platforms">
          ${enabledPlatforms.map(key => {
            const data = AI_PLATFORMS[key];
            return `
            <button class="ai-sp-platform-btn ${currentPlatform === key ? 'active' : ''}" data-platform="${key}">
              <span class="ai-sp-platform-icon" style="width: 24px; height: 24px;">${data.icon}</span>
              <span class="ai-sp-platform-name">${data.name}</span>
            </button>
          `}).join('')}
        </div>
        <button class="ai-sp-platforms-scroll-btn is-disabled" id="ai-sp-scroll-right">
          <img src="${chrome.runtime.getURL('icons/platform-arrow-right.svg')}" style="width:16px;height:16px;" />
        </button>
      </div>
      <div class="ai-sp-iframe-content-area" style="position: relative; width: 100%; min-height: 0;">
        ${enabledPlatforms.map(platformKey => {
          const isCurrent = platformKey === currentPlatform;
          return `
            <div class="ai-sp-iframe-container" id="ai-sp-container-${platformKey}" style="
              position: absolute; top: 0; left: 0; width: 100%; height: 100%;
              opacity: ${isCurrent ? '1' : '0'};
              pointer-events: ${isCurrent ? 'auto' : 'none'};
              z-index: ${isCurrent ? '10' : '1'};
              transition: opacity 0.2s;
            ">
              <div class="ai-sp-loading" id="ai-sp-loading-${platformKey}" style="display: ${isCurrent ? 'flex' : 'none'};">
                <div class="ai-sp-spinner"></div>
                <span>正在连接 ${AI_PLATFORMS[platformKey].name} 并输入问题...</span>
              </div>
              <iframe 
                id="ai-sp-iframe-${platformKey}" 
                data-platform="${platformKey}"
                src="${platformUrls[platformKey]}"
                style="opacity: 0; width: 100%; height: 100%; border: none;">
              </iframe>
            </div>
          `;
        }).join('')}
      </div>
    `;

    // 插入DOM前先清理旧节点
    const existingContainer = document.getElementById('ai-sp-container');
    if (existingContainer) existingContainer.remove();

    // 统一注入到 html 根节点，而不是 body
    // 因为像百度这样的 SPA 页面，在重新搜索时会清空重写整个 body，导致我们的 iframe 被销毁，从而丢失对话记录。
    // 挂载到 document.documentElement 上可以避免被网页自身的 DOM 刷新波及，真正实现 iframe 的永久驻留。
    document.documentElement.appendChild(container);

    // 必须在 appendChild 之后绑定事件，否则某些浏览器下可能获取不到内部元素
    // 绑定 iframe 加载完成事件
    enabledPlatforms.forEach(platformKey => {
      const iframe = document.getElementById(`ai-sp-iframe-${platformKey}`);
      const loading = document.getElementById(`ai-sp-loading-${platformKey}`);
      if (iframe) {
        iframe.addEventListener('load', () => {
          // 只要不是 about:blank 就认为加载成功
          if (iframe.src && iframe.src !== 'about:blank') {
            if (loading) loading.style.display = 'none';
            iframe.style.opacity = '1';
            setTimeout(() => sendThemeToIframe(iframe), 120);
            if (!shouldUseHashBootstrap(platformKey)) {
              const currentQuery = getSearchQuery();
              if (currentQuery) {
                  setTimeout(() => sendQueryToIframe(iframe, currentQuery), 180);
              }
            }
          }
        });
      }
    });
    
    // --- 4. 交互与事件绑定 ---

    // 拖拽小窗功能
    let isDragging = false;
    let isDragged = false;
    let startX, startY, initialLeft, initialTop;
    
    // 恢复为纯悬浮模式，不再尝试融入网页 DOM 流
    function updateFloatingWindowPosition() {
      if (container.classList.contains('is-sidebar-mode') || container.style.display === 'none') return;
      
      // 如果用户没有手动拖拽过，才进行位置重置
      if (!isDragged) {
        container.style.setProperty('position', 'fixed', 'important');
        container.style.left = 'auto';
        container.style.right = 'calc(50% - 358px)'; // 左对齐百度热搜
        container.style.top = '154px';
        container.style.bottom = 'auto';
        container.style.margin = '0';
      }
      adjustPageLayout();
    }
    
    // 动态调整网页布局（给右侧内容增加上边距，防止被遮挡）
    function adjustPageLayout() {
      const host = window.location.hostname;
      if (!host.includes('baidu.com')) return;

      const rightContent = document.getElementById('content_right');
      if (!rightContent) return;

      const isFloating = container.classList.contains('is-floating-mode');
      const isVisible = container.style.display !== 'none' && container.style.opacity !== '0';
      
      // 判断小窗是否在默认的百度右侧栏区域附近
      // 百度右侧栏大约在屏幕中心偏右，热搜的左边界
      let targetRight = window.innerWidth / 2 - 358; 
      if (targetRight < 0) targetRight = 20; // 屏幕太小的话保底
      
      let isInDefaultArea = true;
      
      if (isDragged) {
        const rect = container.getBoundingClientRect();
        // 计算距离屏幕右侧的距离
        const currentRight = window.innerWidth - rect.right;
        const currentTop = rect.top;
        
        // 如果小窗的 top 在 0-200 之间，且 right 在目标区域的 ±150px 范围内，认为它回到了原位
        const isTopMatch = currentTop > 0 && currentTop < 200;
        const isRightMatch = Math.abs(currentRight - targetRight) < 150;
        
        isInDefaultArea = isTopMatch && isRightMatch;
      }

      if (isFloating && isVisible && isInDefaultArea) {
        // 强制设置，覆盖可能的其他样式冲突
        rightContent.style.setProperty('margin-top', '700px', 'important'); 
      } else {
        rightContent.style.removeProperty('margin-top');
      }
    }
    
    // 初始化时立刻执行一次，并用 MutationObserver 确保不会被百度后续加载的脚本覆盖
    adjustPageLayout();
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
          const rightContent = document.getElementById('content_right');
          if (rightContent && mutation.target === rightContent) {
            const currentMargin = rightContent.style.marginTop;
            const shouldHaveMargin = container.classList.contains('is-floating-mode') && 
                                     container.style.display !== 'none' && 
                                     !isDragged;
            if (shouldHaveMargin && currentMargin !== '700px') {
              adjustPageLayout();
            }
          }
        }
      });
    });
    const rightContentNode = document.getElementById('content_right');
    if (rightContentNode) {
      observer.observe(rightContentNode, { attributes: true });
    }

    // 因为取消了 wrapper，不再需要同步位置函数
    function syncIframePosition() {
      // 占位函数，防止其他地方调用报错
    }

    // 初始化时更新位置
    updateFloatingWindowPosition();
    
    // 监听窗口大小变化以保持同步
    window.addEventListener('resize', () => {
      updateFloatingWindowPosition();
    });

    // 使用 querySelector 确保抓取的是当前容器内的元素
    const dragHandle = container.querySelector('.ai-sp-drag-handle');
    
    if (dragHandle) {
      dragHandle.addEventListener('mousedown', (e) => {
        if (container.classList.contains('is-sidebar-mode')) return; // 侧边栏模式不允许拖拽
        
        isDragging = true;
        isDragged = true; // 标记用户已手动拖拽
        adjustPageLayout(); // 拖拽时取消网页的挤压空白
        startX = e.clientX;
        startY = e.clientY;
        
        const rect = container.getBoundingClientRect();
        
        // 使用明确的 rect.left 和 rect.top，不再依赖 auto，防止跳动
        container.style.left = rect.left + 'px';
        container.style.top = rect.top + 'px';
        container.style.right = 'auto';
        container.style.bottom = 'auto';
        container.style.margin = '0';
        
        initialLeft = rect.left;
        initialTop = rect.top;
        
        container.classList.add('is-dragging'); // 添加拖拽阴影效果
        
        document.body.style.userSelect = 'none'; // 防止拖拽时选中文本
        // 拖拽时禁用 iframe 的鼠标事件，防止鼠标进入 iframe 后丢失 mousemove 事件
        const iframeArea = container.querySelector('.ai-sp-iframe-content-area');
        if (iframeArea) iframeArea.style.pointerEvents = 'none';
      });
    }

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      
      container.style.left = `${initialLeft + dx}px`;
      container.style.top = `${initialTop + dy}px`;
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        container.classList.remove('is-dragging'); // 移除拖拽阴影效果
        document.body.style.userSelect = '';
        const iframeArea = container.querySelector('.ai-sp-iframe-content-area');
        if (iframeArea) iframeArea.style.pointerEvents = '';
        
        // 拖拽结束后，检查是否回到了原位，如果是，则挤压网页
        adjustPageLayout();
      }
    });

    // 侧边栏宽度调整功能
    let isResizingSidebar = false;
    let startSidebarX, startSidebarWidth;
    const sidebarResizer = container.querySelector('.ai-sp-sidebar-resizer');
    
    if (sidebarResizer) {
      sidebarResizer.addEventListener('mousedown', (e) => {
        if (!container.classList.contains('is-sidebar-mode')) return; // 只有侧边栏模式才能调整宽度
        
        isResizingSidebar = true;
        startSidebarX = e.clientX;
        startSidebarWidth = container.getBoundingClientRect().width;
        document.body.style.userSelect = 'none'; // 防止拖拽时选中文本
        // 调整宽度时禁用 iframe 的鼠标事件
        const iframeArea = container.querySelector('.ai-sp-iframe-content-area');
        if (iframeArea) iframeArea.style.pointerEvents = 'none';
      });
    }

    document.addEventListener('mousemove', (e) => {
      if (isResizingSidebar) {
        // 向左拖拽，鼠标X变小，宽度应该变大。向右拖拽，鼠标X变大，宽度应该变小
        const dx = startSidebarX - e.clientX;
        let newWidth = startSidebarWidth + dx;
        
        // 限制最大最小宽度
        if (newWidth < 380) newWidth = 380;
        if (newWidth > window.innerWidth * 0.8) newWidth = window.innerWidth * 0.8;
        
        container.style.width = `${newWidth}px`;
      }
    });

    document.addEventListener('mouseup', () => {
      if (isResizingSidebar) {
        isResizingSidebar = false;
        document.body.style.userSelect = '';
        const iframeArea = container.querySelector('.ai-sp-iframe-content-area');
        if (iframeArea) iframeArea.style.pointerEvents = '';
      }
    });

    // 平台切换
    const platformBtns = container.querySelectorAll('.ai-sp-platform-btn');
    platformBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetPlatform = btn.dataset.platform;
        if (targetPlatform === currentPlatform) return;

        // 更新按钮状态
        platformBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // 隐藏当前 iframe，显示新的 iframe
        const oldContainer = document.getElementById(`ai-sp-container-${currentPlatform}`);
        const newContainer = document.getElementById(`ai-sp-container-${targetPlatform}`);
        const newLoading = document.getElementById(`ai-sp-loading-${targetPlatform}`);
        const newIframe = document.getElementById(`ai-sp-iframe-${targetPlatform}`);
        
        if (oldContainer) {
          oldContainer.style.opacity = '0';
          oldContainer.style.pointerEvents = 'none';
          oldContainer.style.zIndex = '1';
        }
        if (newContainer) {
          newContainer.style.opacity = '1';
          newContainer.style.pointerEvents = 'auto';
          newContainer.style.zIndex = '10';
        }

        // 如果该平台还没加载过当前搜索词，则加载
        if (!loadedPlatforms[targetPlatform]) {
          const currentQuery = getSearchQuery();
          if (currentQuery) {
            platformUrls[targetPlatform] = `${AI_PLATFORMS[targetPlatform].url}#q=${encodeURIComponent(currentQuery)}`;
            newIframe.style.opacity = '0';
            newLoading.style.display = 'flex';
            newIframe.src = platformUrls[targetPlatform];
            loadedPlatforms[targetPlatform] = true;
          }
        }

        currentPlatform = targetPlatform;
        syncNativeSidePanelState();
        
        // 点击后让当前按钮滚动到可视区域内居中
        btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        setTimeout(() => ensurePlatformBtnVisible(btn), 60);
        setTimeout(() => ensurePlatformBtnVisible(btn), 220);
      });
    });

    // 侧边栏/小窗 切换逻辑
    let isSwitching = false;
    
    function switchMode(toSidebar) {
      if (isSwitching) return;
      if (toSidebar) {
        isSwitching = false;
        openNativeSidePanel();
        return;
      }
      isSwitching = true;
      
      const isSidebarMode = container.classList.contains('is-sidebar-mode');
      if (isSidebarMode === toSidebar) {
        isSwitching = false;
        return;
      }
      
      // 1. 透明度变为 0
      container.style.opacity = '0';
      
      setTimeout(() => {
        if (toSidebar) {
          // 切换到侧边栏
          container.classList.remove('is-floating-mode');
          container.classList.add('is-sidebar-mode');
          
          // 清除所有内联位置样式
          container.style.removeProperty('width');
          container.style.removeProperty('height');
          container.style.removeProperty('right');
          container.style.removeProperty('left');
          container.style.removeProperty('top');
          container.style.removeProperty('bottom');
          
          const toggleBtn = document.getElementById('ai-sp-toggle-mode-btn');
          const toggleTooltip = document.getElementById('ai-sp-toggle-mode-tooltip');
          if(toggleBtn) {
            toggleBtn.innerHTML = `<img src="${chrome.runtime.getURL('icons/floating.svg')}" style="width:20px;height:20px;" /><span class="ai-sp-tooltip">小窗打开</span>`;
          }
        } else {
          // 切换回小窗
          container.classList.remove('is-sidebar-mode');
          container.classList.add('is-floating-mode');
          
          // 清除内联样式
          container.style.removeProperty('width');
          container.style.removeProperty('height');
          
          const toggleBtn = document.getElementById('ai-sp-toggle-mode-btn');
          if(toggleBtn) {
            toggleBtn.innerHTML = `<img src="${chrome.runtime.getURL('icons/sidebar.svg')}" style="width:20px;height:20px;" /><span class="ai-sp-tooltip" id="ai-sp-toggle-mode-tooltip">侧边栏打开</span>`;
          }
          
          updateFloatingWindowPosition();
        }
        
        // 2. 透明度恢复 1
        setTimeout(() => {
          container.style.opacity = '1';
          adjustPageLayout(); // 模式切换完成，调整布局
          setTimeout(() => {
            isSwitching = false;
          }, 150);
        }, 50);
      }, 150);
    }

    const toggleBtn = container.querySelector('#ai-sp-toggle-mode-btn');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        openNativeSidePanel();
      });
    }

    // 设置
    const settingsPanel = container.querySelector('#ai-sp-settings-panel');
    const settingsBtn = container.querySelector('#ai-sp-settings-btn');
    const memoBtn = container.querySelector('#ai-sp-memo-btn');
    const settingsMenuWrap = container.querySelector('#ai-sp-settings-menu-wrap');
    const settingsMenu = container.querySelector('#ai-sp-settings-menu');
    const settingsBackBtn = container.querySelector('#ai-sp-settings-back-btn');
    const settingsSaveBtn = container.querySelector('#ai-sp-settings-save-btn');
    const promptLibraryToolbarBtn = container.querySelector('#ai-sp-prompt-library-toolbar-btn');
    let settingsMenuHideTimer = null;

    function openSettingsDropdown() {
      if (!settingsBtn || !settingsMenu) return;
      if (settingsMenuHideTimer) {
        clearTimeout(settingsMenuHideTimer);
        settingsMenuHideTimer = null;
      }
      settingsMenu.hidden = false;
      settingsBtn.setAttribute('aria-expanded', 'true');
    }

    function closeSettingsDropdown() {
      if (!settingsBtn || !settingsMenu) return;
      if (settingsMenuHideTimer) {
        clearTimeout(settingsMenuHideTimer);
        settingsMenuHideTimer = null;
      }
      settingsMenu.hidden = true;
      settingsBtn.setAttribute('aria-expanded', 'false');
    }

    function scheduleCloseSettingsDropdown() {
      if (settingsMenuHideTimer) {
        clearTimeout(settingsMenuHideTimer);
      }
      settingsMenuHideTimer = window.setTimeout(() => {
        closeSettingsDropdown();
      }, 120);
    }

    function openInlineAssistantSettings() {
      renderSettingsPlatformList();
      if (settingsPanel) settingsPanel.style.display = 'flex';
    }

    // 生成平台列表 HTML 的辅助函数
    function renderSettingsPlatformList() {
      if (!platformList) return;
      platformList.innerHTML = userConfig.platforms.map(p => {
        if(!AI_PLATFORMS[p.id]) return '';
        const data = AI_PLATFORMS[p.id];
        return `
          <div class="ai-sp-platform-item" data-id="${p.id}" draggable="true">
            <div class="ai-sp-platform-drag-handle">
                  <img src="${chrome.runtime.getURL('icons/settings-sort-drag.svg')}" style="width:16px;height:16px;" />
                  <span class="ai-sp-tooltip">按住拖拽排序</span>
            </div>
            <div class="ai-sp-platform-info">
              <span>${data.settingsIcon}</span>
              <div class="ai-sp-platform-info-text">
                <span>${data.name}</span>
                <span class="ai-sp-platform-url">${new URL(data.url).hostname}</span>
              </div>
            </div>
            <label class="ai-sp-switch">
              <input type="checkbox" class="ai-sp-platform-toggle" data-id="${p.id}" ${p.enabled ? 'checked' : ''}>
              <span class="ai-sp-slider"></span>
            </label>
          </div>
        `;
      }).join('');
      
      // 重新绑定拖拽事件
      bindDragEvents();
    }

    if(settingsBtn) {
      settingsBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        if (settingsMenu?.hidden === false) {
          closeSettingsDropdown();
          return;
        }
        openSettingsDropdown();
      });
    }

    settingsMenuWrap?.addEventListener('mouseenter', openSettingsDropdown);
    settingsMenuWrap?.addEventListener('mouseleave', scheduleCloseSettingsDropdown);

    settingsMenu?.addEventListener('click', (event) => {
      const item = event.target.closest('.ai-sp-header-dropdown-item');
      if (!item) return;
      if (item.dataset.action === 'inline-assistants') {
        openInlineAssistantSettings();
      } else if (item.dataset.pagePath) {
        openExtensionPage(item.dataset.pagePath);
      } else {
        openSettingsPage(item.dataset.settingsTab);
      }
      closeSettingsDropdown();
    });

    if(settingsBackBtn) {
      settingsBackBtn.addEventListener('click', () => {
        settingsPanel.style.display = 'none';
      });
    }

    if (promptLibraryToolbarBtn) {
      promptLibraryToolbarBtn.addEventListener('click', () => {
        openExtensionPage('prompt-library/prompt_library.html');
      });
    }

    memoBtn?.addEventListener('click', () => {
      openMemoPage();
    });

    document.addEventListener('mousedown', (event) => {
      if (settingsMenu?.hidden === false && !settingsMenuWrap?.contains(event.target)) {
        closeSettingsDropdown();
      }
    });

    // 设置页面拖拽排序功能
    const platformList = container.querySelector('#ai-sp-platform-list');
    let draggedItem = null;

    function bindDragEvents() {
      if (!platformList) return;
      const items = platformList.querySelectorAll('.ai-sp-platform-item');
      
      items.forEach(item => {
        // 防止重复绑定
        item.removeEventListener('dragstart', handleDragStart);
        item.removeEventListener('dragend', handleDragEnd);
        item.removeEventListener('dragover', handleDragOver);
        
        item.addEventListener('dragstart', handleDragStart);
        item.addEventListener('dragend', handleDragEnd);
        item.addEventListener('dragover', handleDragOver);
      });
    }

    function handleDragStart(e) {
      draggedItem = e.currentTarget;
      setTimeout(() => draggedItem.classList.add('is-dragging'), 0);
      e.dataTransfer.effectAllowed = 'move';
    }

    function handleDragEnd(e) {
      if (draggedItem) {
        draggedItem.classList.remove('is-dragging');
        draggedItem = null;
      }
    }

    function handleDragOver(e) {
      e.preventDefault(); // 允许放置
      e.dataTransfer.dropEffect = 'move';
      
      // 找到鼠标下方最近的列表项
      const targetItem = e.target.closest('.ai-sp-platform-item');
      
      // 确保目标项有效且不是当前拖拽的项本身
      if (!targetItem || targetItem === draggedItem) return;

      const rect = targetItem.getBoundingClientRect();
      const next = (e.clientY - rect.top) / (rect.bottom - rect.top) > 0.5;
      
      // 获取父容器，并进行节点移动
      const parent = targetItem.parentNode;
      if (next) {
        // 如果鼠标在目标项下半部分，则插入到目标项的下一个兄弟节点之前
        if (targetItem.nextSibling) {
          parent.insertBefore(draggedItem, targetItem.nextSibling);
        } else {
          // 如果没有下一个兄弟节点，说明已经是最后一个，直接追加
          parent.appendChild(draggedItem);
        }
      } else {
        // 如果鼠标在目标项上半部分，则插入到目标项之前
        parent.insertBefore(draggedItem, targetItem);
      }
    }

    bindDragEvents();

    if (settingsSaveBtn) {
      settingsSaveBtn.addEventListener('click', () => {
        saveSettings();
        settingsPanel.style.display = 'none';
      });
    }

    function saveSettings() {
      if (!platformList) return;
      
      const newConfig = {
        platforms: [],
        theme: userConfig.theme,
        selectionDisplayMode: normalizeSelectionDisplayMode(userConfig.selectionDisplayMode)
      };
      
      // 收集平台配置
      const items = platformList.querySelectorAll('.ai-sp-platform-item');
      items.forEach(item => {
        const id = item.dataset.id;
        const enabled = item.querySelector('.ai-sp-platform-toggle').checked;
        newConfig.platforms.push({ id, enabled });
      });
      
      // 更新全局变量
      userConfig = normalizeUserConfig(newConfig);
      
      // 同步缓存一份到 localStorage
      chrome.storage.local.set({ aiSearchProConfig: userConfig });
      localStorage.setItem('aiSearchProLocalConfig', JSON.stringify(userConfig));
      
      // 动态更新 UI 而不销毁现有 iframe，以保留对话记录
      updateUIWithoutReload();
    }

    // 动态更新 UI 辅助函数
    function updateUIWithoutReload() {
      const enabledPlatformsList = userConfig.platforms
        .filter(p => p.enabled && AI_PLATFORMS[p.id])
        .map(p => p.id);

      if (enabledPlatformsList.length === 0) return; // 至少保留一个，否则不处理

      const selectionToolbar = selectionToolbarShadow?.getElementById('ai-sp-selection-toolbar');
      if (selectionToolbar) {
        selectionToolbar.dataset.mode = normalizeSelectionDisplayMode(userConfig.selectionDisplayMode);
      }
      
      // 如果当前平台被禁用了，切换到第一个启用的
      if (!enabledPlatformsList.includes(currentPlatform)) {
        currentPlatform = enabledPlatformsList[0];
      }

      // 1. 更新顶部 Tab 按钮
      const platformsContainer = container.querySelector('.ai-sp-platforms');
      if (platformsContainer) {
        platformsContainer.innerHTML = enabledPlatformsList.map(key => {
          const data = AI_PLATFORMS[key];
          return `
          <button class="ai-sp-platform-btn ${currentPlatform === key ? 'active' : ''}" data-platform="${key}">
            <span class="ai-sp-platform-icon" style="width: 24px; height: 24px;">${data.icon}</span>
            <span class="ai-sp-platform-name">${data.name}</span>
          </button>
        `}).join('');
        
        // 重新绑定 Tab 点击事件
        bindPlatformTabEvents();
        // 更新滚动按钮状态
        setTimeout(updateScrollButtons, 100);
      }

      // 2. 动态管理 iframe 容器
      const contentArea = container.querySelector('.ai-sp-iframe-content-area');
      if (contentArea) {
        // 隐藏/显示/创建 iframe 容器
        PLATFORM_ORDER.forEach(platformKey => {
          let iframeContainer = document.getElementById(`ai-sp-container-${platformKey}`);
          
          if (enabledPlatformsList.includes(platformKey)) {
            // 这个平台被启用了
            if (!iframeContainer) {
              // 之前没有，新建一个
              const div = document.createElement('div');
              div.className = 'ai-sp-iframe-container';
              div.id = `ai-sp-container-${platformKey}`;
              div.style.position = 'absolute';
              div.style.top = '0';
              div.style.left = '0';
              div.style.width = '100%';
              div.style.height = '100%';
              div.style.opacity = '0';
              div.style.pointerEvents = 'none';
              div.style.zIndex = '1';
              div.style.transition = 'opacity 0.2s';
              div.innerHTML = `
                <div class="ai-sp-loading" id="ai-sp-loading-${platformKey}" style="display: none;">
                  <div class="ai-sp-spinner"></div>
                  <span>正在连接 ${AI_PLATFORMS[platformKey].name} 并输入问题...</span>
                </div>
                <iframe 
                  id="ai-sp-iframe-${platformKey}" 
                  data-platform="${platformKey}"
                  src="about:blank"
                  style="opacity: 0; width: 100%; height: 100%; border: none;">
                </iframe>
              `;
              contentArea.appendChild(div);
              
              // 绑定新 iframe 的 load 事件
              const newIframe = div.querySelector('iframe');
              const newLoading = div.querySelector('.ai-sp-loading');
              newIframe.addEventListener('load', () => {
                if (newIframe.src && newIframe.src !== 'about:blank') {
                  if (newLoading) newLoading.style.display = 'none';
                  newIframe.style.opacity = '1';
                  setTimeout(() => sendThemeToIframe(newIframe), 120);
                  if (!shouldUseHashBootstrap(platformKey)) {
                    const currentQuery = getSearchQuery();
                    if (currentQuery) {
                      setTimeout(() => sendQueryToIframe(newIframe, currentQuery), 180);
                    }
                  }
                }
              });
            }
            
            // 更新显示状态
            const targetContainer = document.getElementById(`ai-sp-container-${platformKey}`);
            if (targetContainer) {
              const isCurrent = platformKey === currentPlatform;
              targetContainer.style.opacity = isCurrent ? '1' : '0';
              targetContainer.style.pointerEvents = isCurrent ? 'auto' : 'none';
              targetContainer.style.zIndex = isCurrent ? '10' : '1';
            }
            
            // 如果被启用了且没加载过，立即触发加载，实现统一并发发送
            if (!loadedPlatforms[platformKey]) {
              const currentQuery = getSearchQuery();
              if (currentQuery) {
                const targetIframe = document.getElementById(`ai-sp-iframe-${platformKey}`);
                const targetLoading = document.getElementById(`ai-sp-loading-${platformKey}`);
                if (targetIframe) {
                  platformUrls[platformKey] = buildPlatformUrl(platformKey, currentQuery);
                  targetIframe.style.opacity = '0';
                  if (targetLoading) targetLoading.style.display = 'flex';
                  targetIframe.src = platformUrls[platformKey];
                  loadedPlatforms[platformKey] = true;
                }
              }
            }
            
          } else {
            // 这个平台被禁用了，仅仅隐藏它，不销毁 iframe（保留状态，万一用户又打开了）
            if (iframeContainer) {
              iframeContainer.style.opacity = '0';
              iframeContainer.style.pointerEvents = 'none';
              iframeContainer.style.zIndex = '1';
            }
          }
        });
      }
    }

    // 统一管理 iframe 显示状态的函数
    function updateIframeDisplay() {
      const enabledPlatformsList = userConfig.platforms.filter(p => p.enabled).map(p => p.id);
      
      enabledPlatformsList.forEach(platformKey => {
        const container = document.getElementById(`ai-sp-container-${platformKey}`);
        if (!container) return;

        let isVisible = false;
        if (isSplitMode) {
          isVisible = (platformKey === currentPlatform || platformKey === splitSecondaryPlatform);
        } else {
          isVisible = (platformKey === currentPlatform);
        }

        if (isVisible) {
          container.style.display = 'block'; // 必须有 display 才能参与 flex 布局
          // 等待一帧后再设置 opacity，确保 display 已经生效，过渡动画能执行
          setTimeout(() => {
            container.style.opacity = '1';
            container.style.pointerEvents = 'auto';
            container.style.zIndex = '10';
            if (isSplitMode) {
              container.style.position = 'relative'; // 参与 flex 布局
            } else {
              container.style.position = 'absolute'; // 恢复绝对定位
            }
          }, 10);
        } else {
          container.style.opacity = '0';
          container.style.pointerEvents = 'none';
          container.style.zIndex = '1';
          container.style.position = 'absolute'; // 隐藏的始终绝对定位，不占空间
          setTimeout(() => {
            if (container.style.opacity === '0') {
               container.style.display = 'none'; // 动画结束后真正隐藏，释放 flex 空间
            }
          }, 200); // 匹配 CSS transition 时间
        }
      });
    }

    // 平台左右滚动逻辑
    const platformsContainer = container.querySelector('.ai-sp-platforms');
    const scrollLeftBtn = container.querySelector('#ai-sp-scroll-left');
    const scrollRightBtn = container.querySelector('#ai-sp-scroll-right');

    function ensurePlatformBtnVisible(btn) {
      if (!platformsContainer || !btn) return;
      const safeRight = 64;
      const safeLeft = 64;
      const containerRect = platformsContainer.getBoundingClientRect();
      const btnRect = btn.getBoundingClientRect();
      if (btnRect.right > containerRect.right - safeRight) {
        const delta = btnRect.right - (containerRect.right - safeRight);
        platformsContainer.scrollBy({ left: delta, behavior: 'smooth' });
      } else if (btnRect.left < containerRect.left + safeLeft) {
        const delta = btnRect.left - (containerRect.left + safeLeft);
        platformsContainer.scrollBy({ left: delta, behavior: 'smooth' });
      }
    }

    function updateScrollButtons() {
      if (!platformsContainer || !scrollLeftBtn || !scrollRightBtn) return;
      const canScroll = platformsContainer.scrollWidth > platformsContainer.clientWidth;
      const canScrollLeft = canScroll && platformsContainer.scrollLeft > 0;
      const isAtEnd = Math.abs(platformsContainer.scrollWidth - platformsContainer.clientWidth - platformsContainer.scrollLeft) <= 1;
      const canScrollRight = canScroll && !isAtEnd;

      scrollLeftBtn.classList.toggle('is-disabled', !canScrollLeft);
      scrollRightBtn.classList.toggle('is-disabled', !canScrollRight);
    }

    if (platformsContainer) {
      platformsContainer.addEventListener('scroll', updateScrollButtons);
      window.addEventListener('resize', updateScrollButtons);
      // 初始化检查
      setTimeout(updateScrollButtons, 100);
    }

    if (scrollLeftBtn) {
      scrollLeftBtn.addEventListener('click', () => {
        if (scrollLeftBtn.classList.contains('is-disabled')) return;
        const step = Math.max(220, Math.floor(platformsContainer.clientWidth * 0.95));
        platformsContainer.scrollBy({ left: -step, behavior: 'smooth' });
      });
    }

    if (scrollRightBtn) {
      scrollRightBtn.addEventListener('click', () => {
        if (scrollRightBtn.classList.contains('is-disabled')) return;
        const step = Math.max(220, Math.floor(platformsContainer.clientWidth * 0.95));
        platformsContainer.scrollBy({ left: step, behavior: 'smooth' });
      });
    }

    // 平台切换事件绑定辅助函数
    function bindPlatformTabEvents() {
      const platformBtns = container.querySelectorAll('.ai-sp-platform-btn');
      platformBtns.forEach(btn => {
        // 先移除可能存在的旧事件
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        
        newBtn.addEventListener('click', () => {
          const targetPlatform = newBtn.dataset.platform;
          if (targetPlatform === currentPlatform) return;

          container.querySelectorAll('.ai-sp-platform-btn').forEach(b => b.classList.remove('active'));
          newBtn.classList.add('active');

          const newIframe = document.getElementById(`ai-sp-iframe-${targetPlatform}`);
          const newLoading = document.getElementById(`ai-sp-loading-${targetPlatform}`);

          // 如果该平台还没加载过当前搜索词，则加载
          if (!loadedPlatforms[targetPlatform] && newIframe) {
            const currentQuery = getSearchQuery();
            if (currentQuery) {
              platformUrls[targetPlatform] = buildPlatformUrl(targetPlatform, currentQuery);
              newIframe.style.opacity = '0';
              if (newLoading) newLoading.style.display = 'flex';
              newIframe.src = platformUrls[targetPlatform];
              loadedPlatforms[targetPlatform] = true;
            }
          }

          currentPlatform = targetPlatform;
          
          if (isSplitMode) {
             // 如果在双栏模式下点击了不同的 Tab，更新第二个平台逻辑
             const enabledPlatformsList = userConfig.platforms.filter(p => p.enabled).map(p => p.id);
             const currentIndex = enabledPlatformsList.indexOf(currentPlatform);
             splitSecondaryPlatform = enabledPlatformsList[(currentIndex + 1) % enabledPlatformsList.length];
             
             // 确保第二个平台也被加载
             if (splitSecondaryPlatform && !loadedPlatforms[splitSecondaryPlatform]) {
               const secondaryIframe = document.getElementById(`ai-sp-iframe-${splitSecondaryPlatform}`);
               const secondaryLoading = document.getElementById(`ai-sp-loading-${splitSecondaryPlatform}`);
               const currentQuery = getSearchQuery();
               if (currentQuery && secondaryIframe) {
                 platformUrls[splitSecondaryPlatform] = buildPlatformUrl(splitSecondaryPlatform, currentQuery);
                 secondaryIframe.style.opacity = '0';
                 if (secondaryLoading) secondaryLoading.style.display = 'flex';
                 secondaryIframe.src = platformUrls[splitSecondaryPlatform];
                 loadedPlatforms[splitSecondaryPlatform] = true;
               }
             }
          }

          updateIframeDisplay();

          // 记录用户偏好
          chrome.storage.local.set({ aiSearchProLastPlatform: currentPlatform });
          
          // 点击后让当前按钮滚动到可视区域内居中
          newBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
          setTimeout(() => ensurePlatformBtnVisible(newBtn), 60);
          setTimeout(() => ensurePlatformBtnVisible(newBtn), 220);
        });
      });
    }

    // 关闭：仅仅隐藏当前容器
    const closeAll = () => {
      container.style.display = 'none';
      adjustPageLayout();
    };
    window.__aiSearchProHideUI = closeAll;
    const closeBtn = container.querySelector('#ai-sp-close-btn');
    if(closeBtn) closeBtn.addEventListener('click', closeAll);

    // 初始化主题
    if (getSelectionTheme() === 'dark') {
      container.setAttribute('data-ai-sp-theme', 'dark');
    } else {
      container.removeAttribute('data-ai-sp-theme');
    }

    // 主题切换事件
    const themeBtn = container.querySelector('#ai-sp-theme-btn');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const isDark = getSelectionTheme() === 'dark';
        userConfig.theme = isDark ? 'light' : 'dark';
        
        if (getSelectionTheme() === 'dark') {
          container.setAttribute('data-ai-sp-theme', 'dark');
          themeBtn.querySelector('.ai-sp-icon-sun').style.display = 'block';
          themeBtn.querySelector('.ai-sp-icon-moon').style.display = 'none';
          const themeTip = themeBtn.querySelector('.ai-sp-tooltip');
          if (themeTip) themeTip.textContent = '切换浅色模式';
        } else {
          container.removeAttribute('data-ai-sp-theme');
          themeBtn.querySelector('.ai-sp-icon-sun').style.display = 'none';
          themeBtn.querySelector('.ai-sp-icon-moon').style.display = 'block';
          const themeTip = themeBtn.querySelector('.ai-sp-tooltip');
          if (themeTip) themeTip.textContent = '切换深色模式';
        }
        
        // 跨域向所有已加载的 iframe 发送主题切换消息
        const enabledPlatformsList = userConfig.platforms.filter(p => p.enabled).map(p => p.id);
        enabledPlatformsList.forEach(platformKey => {
          const iframe = document.getElementById(`ai-sp-iframe-${platformKey}`);
          if (iframe && loadedPlatforms[platformKey]) {
            sendThemeToIframe(iframe);
          }
        });
        
        // 保存配置
        chrome.storage.local.set({ aiSearchProConfig: userConfig });
        localStorage.setItem('aiSearchProLocalConfig', JSON.stringify(userConfig));
        syncNativeSidePanelState();
      });
    }

    // 双栏对比模式逻辑
    const splitModeBtn = container.querySelector('#ai-sp-split-mode-btn');
    let isSplitMode = false;
    let splitSecondaryPlatform = null; // 第二个显示的平台

    if (splitModeBtn) {
      splitModeBtn.addEventListener('click', () => {
        const enabledPlatformsList = userConfig.platforms.filter(p => p.enabled).map(p => p.id);
        
        // 获取所有已经加载（即打开过）的平台
        let comparePlatforms = enabledPlatformsList.filter(id => loadedPlatforms[id]);
        
        // 确保当前选中的平台包含在内
        if (!comparePlatforms.includes(currentPlatform)) {
          comparePlatforms.push(currentPlatform);
        }
        
        // 按照用户设置的排序重新排序（enabledPlatformsList 已经是用户排序好的）
        comparePlatforms = enabledPlatformsList.filter(id => comparePlatforms.includes(id));

        if (comparePlatforms.length > 4) {
          comparePlatforms = comparePlatforms.slice(0, 4);
        } else if (comparePlatforms.length < 2) {
          // 如果打开的少于2个，为了对比页面，我们还是补充到2个（或者使用全部可用的前几个，这里根据用户逻辑：至少显示2个？）
          // 用户的意思是：如果在小窗打开了豆包和千问，对比页就显示豆包和千问。
          // 如果只打开了一个，我们为了对比功能，默认再补一个。
          const needed = 2 - comparePlatforms.length;
          const additional = enabledPlatformsList.filter(id => !comparePlatforms.includes(id)).slice(0, needed);
          comparePlatforms = comparePlatforms.concat(additional);
          // 再次按用户排序
          comparePlatforms = enabledPlatformsList.filter(id => comparePlatforms.includes(id));
        }

        if (comparePlatforms.length < 2) {
          alert('请至少启用两个AI助手才能使用内容对比');
          return;
        }
        const queryText = getSearchQuery() || query || '';
        const sessionUrls = {};
        enabledPlatformsList.forEach((key) => {
          const iframe = document.getElementById(`ai-sp-iframe-${key}`);
          const src = iframe && iframe.src ? iframe.src : (platformUrls[key] || AI_PLATFORMS[key].url);
          sessionUrls[key] = src;
        });
        const compareUrl = chrome.runtime.getURL(
          `compare/compare.html#q=${encodeURIComponent(queryText)}&platforms=${encodeURIComponent(comparePlatforms.join(','))}&enabled=${encodeURIComponent(enabledPlatformsList.join(','))}&urls=${encodeURIComponent(JSON.stringify(sessionUrls))}&theme=${encodeURIComponent(getSelectionTheme())}`
        );
        window.open(compareUrl, '_blank');
      });
    }

    // 网页打开
    const openWeb = () => {
      const targetUrl = platformUrls[currentPlatform] || AI_PLATFORMS[currentPlatform].url;
      window.open(targetUrl, '_blank');
    };
    const webBtn = container.querySelector('#ai-sp-web-btn');
    if(webBtn) webBtn.addEventListener('click', openWeb);

    const setFloatingActivePlatform = (targetPlatform) => {
      if (!AI_PLATFORMS[targetPlatform]) return;
      const platformBtns = container.querySelectorAll('.ai-sp-platform-btn');
      platformBtns.forEach((button) => {
        button.classList.toggle('active', button.dataset.platform === targetPlatform);
      });
      const oldContainer = document.getElementById(`ai-sp-container-${currentPlatform}`);
      const newContainer = document.getElementById(`ai-sp-container-${targetPlatform}`);
      if (oldContainer) {
        oldContainer.style.opacity = '0';
        oldContainer.style.pointerEvents = 'none';
        oldContainer.style.zIndex = '1';
      }
      if (newContainer) {
        newContainer.style.opacity = '1';
        newContainer.style.pointerEvents = 'auto';
        newContainer.style.zIndex = '10';
      }
      currentPlatform = targetPlatform;
      const activeBtn = container.querySelector(`.ai-sp-platform-btn[data-platform="${targetPlatform}"]`);
      if (activeBtn) {
        setTimeout(() => ensurePlatformBtnVisible(activeBtn), 60);
      }
    };

    const triggerPlatformSend = (text, targetPlatform = currentPlatform) => {
      const sendText = (text || '').trim();
      if (!sendText || !AI_PLATFORMS[targetPlatform]) return false;
      currentSessionQuery = sendText;
      setFloatingActivePlatform(targetPlatform);
      const iframe = document.getElementById(`ai-sp-iframe-${targetPlatform}`);
      const loading = document.getElementById(`ai-sp-loading-${targetPlatform}`);
      const wasLoaded = loadedPlatforms[targetPlatform] === true;
      if (!iframe) return false;
      if (wasLoaded) {
        const requestId = makeSendRequestId();
        pendingEmbeddedSends.set(requestId, {
          expected: new Set([targetPlatform]),
          done: new Set(),
          failed: new Set(),
          timer: window.setTimeout(() => finalizeEmbeddedSend(requestId), 4500)
        });
        queueEmbeddedSend(targetPlatform, sendText, requestId, 1);
      } else {
        platformUrls[targetPlatform] = buildPlatformUrl(targetPlatform, sendText);
        iframe.style.opacity = '0';
        if (loading) loading.style.display = 'flex';
        iframe.src = platformUrls[targetPlatform];
        loadedPlatforms[targetPlatform] = true;
      }
      syncNativeSidePanelState();
      return true;
    };

    window.__aiSearchProBroadcastQuery = null;
    window.__aiSearchProConsumeFloatingContextAction = async (action) => {
      const text = (action?.text || '').trim();
      if (!text) return false;
      const actionId = String(action?.id || '').trim();
      if (actionId && actionId === lastFloatingActionId) return false;
      if (actionId) lastFloatingActionId = actionId;
      const targetPlatform = AI_PLATFORMS[action?.platformId] ? action.platformId : currentPlatform;
      const consumed = triggerPlatformSend(text, targetPlatform);
      if (consumed) {
        pendingFloatingContextAction = null;
      }
      return consumed;
    };
    window.__aiSearchProToggleUI = (forceShow) => {
      const isVisible = container.style.display !== 'none' && container.style.opacity !== '0';
      if (isVisible && !forceShow) {
        closeAll();
      } else {
        container.style.display = 'flex';
        if (container.classList.contains('is-sidebar-mode')) switchMode(false);
        container.style.opacity = '1';
        if (!container.classList.contains('is-sidebar-mode')) {
          updateFloatingWindowPosition();
        } else {
          adjustPageLayout();
        }
      }
    };
    if (pendingFloatingContextAction) {
      window.__aiSearchProConsumeFloatingContextAction(pendingFloatingContextAction)
        .then((consumed) => {
          if (consumed) {
            clearQueuedFloatingContextAction().catch(() => {});
          }
        })
        .catch(() => {});
    } else {
      readQueuedFloatingContextAction().then((action) => {
        if (!action) return;
        pendingFloatingContextAction = action;
        return window.__aiSearchProConsumeFloatingContextAction(action).then((consumed) => {
          if (consumed) {
            clearQueuedFloatingContextAction().catch(() => {});
          }
        });
      }).catch(() => {});
    }

    // 监听 URL / 搜索词变化 (只针对原生搜索引擎的输入)
    let lastUrlQuery = getSearchQuery() || query;
    setInterval(async () => {
      const currentQuery = getSearchQuery();
      
      if (!currentQuery) return;

      if (!document.getElementById('ai-sp-container')) {
        if (await queryNativeSidebarState()) return;
        createUI(currentQuery, userConfig.platforms.filter(p => p.enabled).map(p => p.id));
        return;
      }
      
      // 只有当搜索引擎的词真正发生变化时，才触发自动广播，防止与全局手动输入框冲突
      if (currentQuery !== lastUrlQuery) {
        lastUrlQuery = currentQuery;
        
        container.style.display = 'flex';
        container.style.opacity = '1';
        if (!container.classList.contains('is-sidebar-mode')) {
          updateFloatingWindowPosition();
        } else {
          adjustPageLayout();
        }
        currentSessionQuery = currentQuery;
        const syncPlatformId = getSearchSyncPlatformId();
        if (currentPlatform !== syncPlatformId) {
          currentPlatform = syncPlatformId;
          Array.from(buttonContainer.querySelectorAll('.ai-sp-platform-btn')).forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.platform === currentPlatform);
          });
          updateIframeDisplay();
        }
        triggerPlatformSend(currentQuery, syncPlatformId);
      }
    }, 1000);

    // 监听 iframe 消息
    window.addEventListener('message', (event) => {
      if (event.data) {
        if (event.data.type === 'AI_SEARCH_PRO_LOADED') {
          const iframes = document.querySelectorAll('.ai-sp-iframe-container iframe');
          iframes.forEach(iframe => {
            if (iframe.contentWindow === event.source) {
              const platform = iframe.dataset.platform;
              const loading = document.getElementById(`ai-sp-loading-${platform}`);
              if (loading) loading.style.display = 'none';
              iframe.style.opacity = '1';
            }
          });
        } else if (event.data.type === 'AI_SEARCH_PRO_SUMMARY' && event.data.requestId) {
          const entry = pendingSummaryRequests.get(event.data.requestId);
          if (!entry) return;
          clearTimeout(entry.timer);
          pendingSummaryRequests.delete(event.data.requestId);
          entry.resolve({
            platformKey: entry.platformKey,
            summary: typeof event.data.summary === 'string' ? event.data.summary.trim() : '',
            url: event.data.url || entry.iframe?.src || platformUrls[entry.platformKey] || ''
          });
        } else if (event.data.type === EMBEDDED_SEND_READY_RESPONSE_EVENT && event.data.requestId && event.data.paneId) {
          const key = `${event.data.requestId}:${event.data.paneId}`;
          const entry = sendReadyRequests.get(key);
          if (!entry) return;
          clearReadyRequestEntry(key);
          const pending = pendingEmbeddedSends.get(event.data.requestId);
          if (!pending || pending.done.has(event.data.paneId) || pending.failed.has(event.data.paneId)) return;
          if (event.data.ready) {
            const stableDelay = typeof event.data.delay === 'number' ? event.data.delay : SEND_READY_STABLE_DELAY;
            window.setTimeout(() => {
              dispatchEmbeddedSend(entry.platformKey, entry.text, event.data.requestId);
            }, stableDelay);
          } else if (entry.attempt < SEND_READY_MAX_RETRIES) {
            queueEmbeddedSend(entry.platformKey, entry.text, event.data.requestId, entry.attempt + 1);
          } else {
            markEmbeddedSendFailure(event.data.requestId, event.data.paneId);
          }
        } else if (event.data.type === EMBEDDED_SEND_DONE_EVENT && event.data.requestId && event.data.paneId) {
          const pending = pendingEmbeddedSends.get(event.data.requestId);
          if (pending && pending.expected.has(event.data.paneId)) {
            clearReadyRequestEntry(`${event.data.requestId}:${event.data.paneId}`);
            if (event.data.ok === false) {
              pending.failed.add(event.data.paneId);
            } else {
              pending.done.add(event.data.paneId);
            }
            if (pending.done.size + pending.failed.size >= pending.expected.size) {
              finalizeEmbeddedSend(event.data.requestId);
            }
          }
        } else if (event.data.type === 'AI_SEARCH_PRO_URL_SYNC') {
          // 查找是哪个平台的 iframe 发来的消息
          const iframes = document.querySelectorAll('.ai-sp-iframe-container iframe');
          iframes.forEach(iframe => {
            if (iframe.contentWindow === event.source) {
              const platform = iframe.dataset.platform;
              if (platform) {
                platformUrls[platform] = event.data.url;
                syncNativeSidePanelState();
              }
            }
          });
        }
      }
    });

    // 兜底：10秒后自动显示 iframe
    setTimeout(() => {
      const enabledPlatformsList = userConfig.platforms
        .filter(p => p.enabled && AI_PLATFORMS[p.id])
        .map(p => p.id);
      enabledPlatformsList.forEach(platformKey => {
        const iframe = document.getElementById(`ai-sp-iframe-${platformKey}`);
        const loading = document.getElementById(`ai-sp-loading-${platformKey}`);
        if (iframe && loading && loading.style.display !== 'none') {
          loading.style.display = 'none';
          iframe.style.opacity = '1';
        } else if (iframe) {
          iframe.style.opacity = '1';
        }
      });
      syncNativeSidePanelState();
    }, 10000);

  }

  // 立即执行拦截
  initSearchInterception();

  // 全局暴露一个触发查询的方法，方便外部调用（如右键菜单、全局输入框）
  window.__aiSearchProBroadcastQuery = null;
  window.__aiSearchProConsumeFloatingContextAction = null;
  window.__aiSearchProToggleUI = null;

  // 监听扩展后台的消息（右键菜单、图标点击）
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'AI_SP_GET_SEARCH_QUERY') {
      sendResponse({ query: getSearchQuery() });
    } else if (request.action === 'HIDE_CONTENT_UI') {
      nativeSidebarOpen = true;
      if (window.__aiSearchProHideUI) {
        window.__aiSearchProHideUI();
      }
      sendResponse({ status: 'ok' });
    } else if (request.action === 'SHOW_FLOATING_UI') {
      nativeSidebarOpen = false;
      if (request.currentPlatform && AI_PLATFORMS[request.currentPlatform]) {
        currentPlatform = request.currentPlatform;
      }
      const enabledIds = Array.isArray(request.enabledPlatforms)
        ? request.enabledPlatforms.filter((id) => AI_PLATFORMS[id])
        : userConfig.platforms.filter(p => p.enabled).map(p => p.id);
      removeStaleFloatingUI();
      if (window.__aiSearchProToggleUI) {
        window.__aiSearchProToggleUI(true);
      } else {
        createUI(request.query || '', enabledIds.length ? enabledIds : userConfig.platforms.filter(p => p.enabled).map(p => p.id));
      }
      sendResponse({ status: 'ok' });
    } else if (request.action === 'TOGGLE_UI') {
      nativeSidebarOpen = false;
      const shouldOpenSidebar = request.openSidebar === true;
      const forceShow = request.forceShow === true;
      if (request.currentPlatform && AI_PLATFORMS[request.currentPlatform]) {
        currentPlatform = request.currentPlatform;
      }
      if (window.__aiSearchProToggleUI) {
        if (shouldOpenSidebar) {
          window.__aiSearchProHideUI?.();
        } else {
          window.__aiSearchProToggleUI(forceShow);
        }
      } else {
        if (!shouldOpenSidebar) {
          removeStaleFloatingUI();
          createUI('', userConfig.platforms.filter(p => p.enabled).map(p => p.id));
        }
      }
      sendResponse({status: "ok"});
    } else if (request.action === 'SEARCH_FROM_CONTEXT_MENU') {
      const text = request.text;
      const promptId = typeof request.promptId === 'string' ? request.promptId : '';
      if (promptId) {
        handleContextMenuPrompt(promptId, text)
          .then((ok) => sendResponse({ status: ok ? 'ok' : 'error' }))
          .catch(() => sendResponse({ status: 'error' }));
        return true;
      }
      openSelectionPrompt(text, getDefaultContextMenuPlatformId())
        .then(() => sendResponse({ status: 'ok' }))
        .catch(() => sendResponse({ status: 'error' }));
      return true;
    }
  });

  // 初始化
  function init() {
    initSelectionQuickAsk();
    // 0. 最高优先级：尝试从 localStorage 同步读取用户配置缓存，确保首屏渲染就是最新排序
    const localConfigStr = localStorage.getItem('aiSearchProLocalConfig');
    if (localConfigStr) {
      try {
        userConfig = normalizeUserConfig(JSON.parse(localConfigStr));
      } catch (e) {
        console.error('Failed to parse local config', e);
      }
    }

    // 1. 立即（同步）尝试渲染默认 UI 和加载 iframe，不等待任何异步操作
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', renderInitialUI);
    } else {
      renderInitialUI();
    }
    
    // 2. 异步获取用户配置（兜底，比如用户在其他标签页修改了配置）
    chrome.storage.local.get(['aiSearchProConfig'], (result) => {
      if (result.aiSearchProConfig) {
        userConfig = normalizeUserConfig(result.aiSearchProConfig);
        const container = document.getElementById('ai-sp-container');
        if (!isSearchAssistantEnabledForCurrentPage()) {
          if (container) container.remove();
          return;
        }
        if (!container) {
          renderInitialUI();
        }
      }
    });
  }

  init();
})();
