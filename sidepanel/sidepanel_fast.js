const AI_PLATFORMS = {
  doubao: { name: '豆包', url: 'https://www.doubao.com/chat/', icon: 'doubao.png' },
  qianwen: { name: '千问', url: 'https://tongyi.aliyun.com/qianwen/', icon: 'qianwen.png' },
  yuanbao: { name: '元宝', url: 'https://yuanbao.tencent.com/chat/naQivTmsDa', icon: 'yuanbao.png' },
  deepseek: { name: 'DeepSeek', url: 'https://chat.deepseek.com/', icon: 'deepseek.png' },
  kimi: { name: 'Kimi', url: 'https://www.kimi.com/', icon: 'kimi.png' },
  zai: { name: 'Z.AI', url: 'https://chat.z.ai/', icon: 'zhipuai.png' },
  chatglm: { name: '智谱清言', url: 'https://chatglm.cn/main/alltoolsdetail?lang=zh', icon: 'chatglm.png' },
  chatgpt: { name: 'ChatGPT', url: 'https://chatgpt.com/', icon: 'chatgpt.png' },
  gemini: { name: 'Gemini', url: 'https://gemini.google.com/', icon: 'gemini.png' },
  claude: { name: 'Claude', url: 'https://claude.ai/new', icon: 'claude.png' },
  perplexity: { name: 'Perplexity', url: 'https://www.perplexity.ai/', icon: 'perplexity.png' },
  copilot: { name: 'Copilot', url: 'https://copilot.microsoft.com/', icon: 'copilot.png' },
  grok: { name: 'Grok', url: 'https://grok.com/', icon: 'grok.png' }
};

const loadedIds = new Set();
const loadTimeouts = new Map();
const EMBEDDED_SEND_EVENT = 'AI_SP_EMBEDDED_SEND';
const EMBEDDED_SEND_DONE_EVENT = 'AI_SP_EMBEDDED_SEND_DONE';
const EMBEDDED_SEND_READY_REQUEST_EVENT = 'AI_SP_EMBEDDED_SEND_READY_REQUEST';
const EMBEDDED_SEND_READY_RESPONSE_EVENT = 'AI_SP_EMBEDDED_SEND_READY_RESPONSE';
const EMBEDDED_LOCATION_REQUEST_EVENT = 'AI_SP_EMBEDDED_LOCATION_REQUEST';
const EMBEDDED_LOCATION_EVENT = 'AI_SP_EMBEDDED_LOCATION';
const SEND_READY_MAX_RETRIES = 8;
const SEND_READY_RETRY_GAP = 450;
const SEND_READY_STABLE_DELAY = 320;
const CONTEXT_READY_TIMEOUT = 1500;
const CONTEXT_SEND_RETRY_MAX = 24;
const CONTEXT_SEND_RETRY_GAP = 500;
const pendingEmbeddedSends = new Map();
const sendReadyRequests = new Map();
const pendingSummaryRequests = new Map();
const deferredContextSends = new Map();
const contextReadyRequests = new Map();
const pendingContextSends = new Map();
const PROMPT_LIBRARY_STORAGE_KEY = 'aiSearchProPromptLibrary';
const FAVORITES_STORAGE_KEY = 'aiSearchProFavorites';
const SIDEPANEL_CONTEXT_ACTION_STORAGE_KEY = 'aiSearchProSidepanelContextAction';
const DEFAULT_SELECTION_DISPLAY_MODE = 'text';
const PLATFORM_ORDER = Object.keys(AI_PLATFORMS);
let currentPlatform = 'doubao';
let currentQuery = '';
let currentTheme = 'light';
let enabledPlatforms = PLATFORM_ORDER.slice();
let platformUrls = {};
let activeTabId = null;
let lastConsumedContextActionId = '';
let promptLibraryCache = [];
let userConfig = {
  platforms: PLATFORM_ORDER.map((id) => ({ id, enabled: true })),
  theme: 'light',
  selectionDisplayMode: DEFAULT_SELECTION_DISPLAY_MODE,
  contextMenuDefaultPlatform: 'doubao'
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
const SETTINGS_MENU_ITEMS = [
  { action: 'inline-assistants', label: 'AI 助手显示设置' },
  { tab: 'general', label: '系统设置' }
];
const systemThemeQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

function sendRuntimeMessage(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        resolve(null);
        return;
      }
      resolve(response || null);
    });
  });
}

function openExtensionPage(pagePath) {
  chrome.runtime.sendMessage({ type: 'OPEN_EXTENSION_PAGE', pagePath }, () => chrome.runtime.lastError);
}

function openSettingsPage(tab = 'general') {
  openExtensionPage(`settings/settings.html#${tab}`);
}

function openMemoPage() {
  openExtensionPage('favorites/favorites.html');
}

function normalizeText(text) {
  return (text || '').trim();
}

function normalizeSelectionDisplayMode(mode) {
  return mode === 'icon' ? 'icon' : DEFAULT_SELECTION_DISPLAY_MODE;
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

function normalizePromptLibrary(list) {
  const incoming = Array.isArray(list) ? list : [];
  const merged = [];
  const seen = new Set();
  [...incoming, ...DEFAULT_PROMPTS].forEach((item) => {
    if (!item || !item.id || seen.has(item.id)) return;
    seen.add(item.id);
    const template = typeof item.template === 'string' ? item.template.trim() : '';
    if (!template) return;
    merged.push({
      id: item.id,
      title: (item.title || '').trim() || '未命名提示词',
      icon: (item.icon || '').trim() || '💡',
      template,
      enabled: item.enabled !== false
    });
  });
  return merged;
}

function applyPromptTemplate(template, text, variables = {}) {
  const rawTemplate = typeof template === 'string' ? template : '';
  const merged = {
    text: normalizeText(text),
    context: normalizeText(variables.context || text),
    page: normalizeText(variables.page || 'OmniAI 原生侧边栏'),
    url: normalizeText(variables.url || platformUrls[currentPlatform] || ''),
    time: normalizeText(variables.time || new Date().toLocaleString())
  };
  const replaced = rawTemplate
    .replaceAll('{{text}}', merged.text)
    .replaceAll('{{context}}', merged.context)
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

function makeSessionRecordId() {
  return `fav_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function updateSessionStatus(text, isError = false) {
  const statusEl = document.getElementById('ai-sp-session-status');
  if (!statusEl) return;
  statusEl.textContent = text || '';
  statusEl.dataset.state = isError ? 'error' : 'default';
}

function clearSessionStatus(delay = 2200) {
  window.setTimeout(() => {
    const statusEl = document.getElementById('ai-sp-session-status');
    if (!statusEl) return;
    statusEl.textContent = '';
    statusEl.dataset.state = 'default';
  }, delay);
}

function closePromptMenu() {
  const menu = document.getElementById('ai-sp-prompt-menu');
  if (menu) menu.style.display = 'none';
}

function buildSessionMarkdown(snapshot, actionLabel = '导出时间') {
  const lines = [
    '# OmniAI 会话',
    '',
    `- 问题：${snapshot.query || '未命名问题'}`,
    `- 来源：${snapshot.sourceLabel}`,
    `- 当前平台：${snapshot.activePlatformName || '未选择'}`,
    `- ${actionLabel}：${new Date(snapshot.createdAt).toLocaleString()}`,
    ''
  ];
  snapshot.panes.forEach((pane) => {
    lines.push(`## ${pane.platformName}`);
    if (pane.active) lines.push('- 当前查看：是');
    if (pane.url) lines.push(`- 地址：${pane.url}`);
    lines.push('');
    lines.push(pane.summary || '暂无摘要');
    lines.push('');
  });
  return lines.join('\n');
}

function downloadMarkdownFile(title, content) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${(title || 'OmniAI会话').slice(0, 24)}.md`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function requestPlatformSummary(platformKey, timeout = 3200) {
  return new Promise((resolve) => {
    const iframe = document.getElementById(`ai-sp-sidepanel-iframe-${platformKey}`);
    if (!iframe?.contentWindow || !loadedIds.has(platformKey)) {
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
}

async function collectSessionSnapshot(sourceLabel) {
  const summaries = await Promise.all(enabledPlatforms.map((platformKey) => requestPlatformSummary(platformKey)));
  const panes = enabledPlatforms.map((platformKey) => {
    const summaryItem = summaries.find((item) => item.platformKey === platformKey) || {};
    const iframe = document.getElementById(`ai-sp-sidepanel-iframe-${platformKey}`);
    return {
      platform: platformKey,
      platformName: AI_PLATFORMS[platformKey]?.name || platformKey,
      summary: summaryItem.summary || '',
      url: summaryItem.url || iframe?.src || platformUrls[platformKey] || AI_PLATFORMS[platformKey]?.url || '',
      active: platformKey === currentPlatform
    };
  });
  return {
    id: makeSessionRecordId(),
    type: 'session',
    source: 'sidepanel',
    sourceLabel,
    title: currentQuery || '未命名问题',
    query: currentQuery,
    createdAt: Date.now(),
    currentPlatform,
    activePlatformName: AI_PLATFORMS[currentPlatform]?.name || currentPlatform,
    panes
  };
}

async function saveCurrentSessionFavorite() {
  if (!currentQuery) {
    updateSessionStatus('当前没有可保存的内容', true);
    clearSessionStatus();
    return;
  }
  updateSessionStatus('正在保存到备忘录...');
  const snapshot = await collectSessionSnapshot('原生侧边栏');
  snapshot.markdown = buildSessionMarkdown(snapshot, '保存时间');
  const data = await chrome.storage.local.get([FAVORITES_STORAGE_KEY]);
  const list = Array.isArray(data?.[FAVORITES_STORAGE_KEY]) ? data[FAVORITES_STORAGE_KEY] : [];
  await chrome.storage.local.set({ [FAVORITES_STORAGE_KEY]: [snapshot, ...list].slice(0, 100) });
  updateSessionStatus('已保存到备忘录');
  clearSessionStatus();
}

async function exportCurrentSessionMarkdown() {
  if (!currentQuery) {
    updateSessionStatus('当前没有可导出的内容', true);
    clearSessionStatus();
    return;
  }
  updateSessionStatus('正在导出...');
  const snapshot = await collectSessionSnapshot('原生侧边栏');
  const markdown = buildSessionMarkdown(snapshot, '导出时间');
  downloadMarkdownFile(snapshot.title, markdown);
  updateSessionStatus('Markdown 已导出');
  clearSessionStatus();
}

async function renderPromptMenu() {
  const menu = document.getElementById('ai-sp-prompt-menu');
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
}

function shouldUseHashBootstrap(platformKey) {
  return platformKey !== 'kimi';
}

function buildPlatformUrl(platformKey, queryText) {
  const base = AI_PLATFORMS[platformKey]?.url || 'about:blank';
  const q = normalizeText(queryText);
  if (!q || !shouldUseHashBootstrap(platformKey)) return base;
  return `${base}#q=${encodeURIComponent(q)}`;
}

function getContextLoadUrl(platformKey) {
  const currentUrl = String(platformUrls[platformKey] || '').trim();
  if (!currentUrl || currentUrl === 'about:blank') {
    return AI_PLATFORMS[platformKey]?.url || 'about:blank';
  }
  if (currentUrl.includes('#q=')) {
    return currentUrl.split('#q=')[0] || (AI_PLATFORMS[platformKey]?.url || 'about:blank');
  }
  return currentUrl;
}

function getContextStableDelay(platformKey) {
  return platformKey === 'qianwen' ? 960 : SEND_READY_STABLE_DELAY;
}

function iconUrl(name) {
  return chrome.runtime.getURL(`icons/${name}.svg`);
}

function assetUrl(name) {
  return chrome.runtime.getURL(`assets/${name}`);
}

function getEnabledPlatformIds(config = userConfig) {
  const list = Array.isArray(config?.platforms)
    ? config.platforms.filter((p) => p?.enabled && AI_PLATFORMS[p.id]).map((p) => p.id)
    : [];
  const enabledSet = new Set(list);
  return list.length ? PLATFORM_ORDER.filter((id) => enabledSet.has(id)) : PLATFORM_ORDER.slice();
}

function mergePlatformsWithDefaults(platforms = []) {
  const existingMap = new Map(
    (Array.isArray(platforms) ? platforms : [])
      .filter((p) => AI_PLATFORMS[p.id])
      .map((p) => [p.id, p.enabled !== false])
  );
  return PLATFORM_ORDER.map((id) => ({
    id,
    enabled: existingMap.has(id) ? existingMap.get(id) : true
  }));
}

function applyEnabledPlatformsToUserConfig(enabledIds = []) {
  const enabledSet = new Set(enabledIds.filter((id) => AI_PLATFORMS[id]));
  userConfig.platforms = mergePlatformsWithDefaults(userConfig.platforms).map((item) => ({
    ...item,
    enabled: enabledSet.has(item.id)
  }));
}

function getPlatformsSignature(list = enabledPlatforms) {
  return (Array.isArray(list) ? list : []).join('|');
}

function makeSendRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function clearReadyRequestEntry(key) {
  const entry = sendReadyRequests.get(key);
  if (!entry) return;
  clearTimeout(entry.timer);
  sendReadyRequests.delete(key);
}

function clearReadyRequestsByRequestId(requestId) {
  Array.from(sendReadyRequests.keys()).forEach((key) => {
    if (key.startsWith(`${requestId}:`)) clearReadyRequestEntry(key);
  });
}

function finalizeEmbeddedSend(requestId) {
  const pending = pendingEmbeddedSends.get(requestId);
  if (!pending) return;
  clearTimeout(pending.timer);
  clearReadyRequestsByRequestId(requestId);
  pendingEmbeddedSends.delete(requestId);
}

function markEmbeddedSendFailure(requestId, platformKey) {
  const pending = pendingEmbeddedSends.get(requestId);
  if (!pending || pending.done.has(platformKey)) return;
  pending.failed.add(platformKey);
  if (pending.done.size + pending.failed.size >= pending.expected.size) {
    finalizeEmbeddedSend(requestId);
  }
}

function clearContextReadyRequest(platformKey) {
  const entry = contextReadyRequests.get(platformKey);
  if (!entry) return;
  clearTimeout(entry.timer);
  contextReadyRequests.delete(platformKey);
}

function clearPendingContextSend(platformKey) {
  const entry = pendingContextSends.get(platformKey);
  if (!entry) return;
  clearTimeout(entry.timer);
  pendingContextSends.delete(platformKey);
}

function queueSendToContextPlatform(platformKey, text, requestId, attempt = 1) {
  const iframe = document.getElementById(`ai-sp-sidepanel-iframe-${platformKey}`);
  clearPendingContextSend(platformKey);
  if (!iframe?.contentWindow) {
    if (attempt >= CONTEXT_SEND_RETRY_MAX) {
      clearPendingContextSend(platformKey);
      return;
    }
    const timer = window.setTimeout(() => {
      queueSendToContextPlatform(platformKey, text, requestId, attempt + 1);
    }, CONTEXT_SEND_RETRY_GAP);
    pendingContextSends.set(platformKey, { requestId, text, attempt, timer });
    return;
  }
  deferredContextSends.delete(platformKey);
  try {
    iframe.contentWindow.postMessage({
      type: EMBEDDED_SEND_EVENT,
      text,
      submit: true,
      requestId,
      paneId: platformKey
    }, '*');
  } catch (e) {}
  if (attempt >= CONTEXT_SEND_RETRY_MAX) {
    clearPendingContextSend(platformKey);
    return;
  }
  const timer = window.setTimeout(() => {
    queueSendToContextPlatform(platformKey, text, requestId, attempt + 1);
  }, CONTEXT_SEND_RETRY_GAP);
  pendingContextSends.set(platformKey, { requestId, text, attempt, timer });
}

function flushDeferredContextSend(platformKey, requestId) {
  const deferred = deferredContextSends.get(platformKey);
  if (!deferred || deferred.requestId !== requestId) return;
  window.setTimeout(() => {
    queueSendToContextPlatform(platformKey, deferred.text, deferred.requestId, 1);
  }, getContextStableDelay(platformKey));
}

function requestDeferredContextSend(platformKey, requestId, text, attempt = 1) {
  const iframe = document.getElementById(`ai-sp-sidepanel-iframe-${platformKey}`);
  if (!iframe?.contentWindow) return;
  clearContextReadyRequest(platformKey);
  const timer = window.setTimeout(() => {
    clearContextReadyRequest(platformKey);
    const deferred = deferredContextSends.get(platformKey);
    if (!deferred || deferred.requestId !== requestId) return;
    if (attempt < SEND_READY_MAX_RETRIES) {
      requestDeferredContextSend(platformKey, requestId, text, attempt + 1);
    } else {
      flushDeferredContextSend(platformKey, requestId);
    }
  }, CONTEXT_READY_TIMEOUT);
  contextReadyRequests.set(platformKey, { requestId, text, attempt, timer });
  try {
    iframe.contentWindow.postMessage({
      type: EMBEDDED_LOCATION_REQUEST_EVENT,
      requestId,
      paneId: platformKey
    }, '*');
  } catch (e) {
    clearContextReadyRequest(platformKey);
    if (attempt < SEND_READY_MAX_RETRIES) {
      requestDeferredContextSend(platformKey, requestId, text, attempt + 1);
    } else {
      flushDeferredContextSend(platformKey, requestId);
    }
  }
}

function queueDeferredContextSend(platformKey, text, requestId = makeSendRequestId()) {
  deferredContextSends.set(platformKey, { requestId, text });
  platformUrls[platformKey] = getContextLoadUrl(platformKey);
  ensureIframeLoaded(platformKey, text);
  if (loadedIds.has(platformKey)) {
    requestDeferredContextSend(platformKey, requestId, text, 1);
  }
}

function setTheme(theme) {
  const themeMode = theme === 'auto'
    ? (systemThemeQuery?.matches ? 'dark' : 'light')
    : (theme === 'dark' ? 'dark' : 'light');
  currentTheme = themeMode;
  if (currentTheme === 'dark') {
    document.documentElement.setAttribute('data-ai-sp-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-ai-sp-theme');
  }
  updateThemeButtonUI();
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

function sendThemeToIframe(platformKey) {
  const iframe = document.getElementById(`ai-sp-sidepanel-iframe-${platformKey}`);
  if (!iframe?.contentWindow) return;
  try {
    iframe.contentWindow.postMessage({ type: 'AI_SEARCH_PRO_THEME_CHANGE', theme: currentTheme }, '*');
  } catch (e) {}
}

function updateThemeButtonUI() {
  const themeBtn = document.getElementById('ai-sp-theme-btn');
  if (!themeBtn) return;
  const sunIcon = themeBtn.querySelector('.ai-sp-icon-sun');
  const moonIcon = themeBtn.querySelector('.ai-sp-icon-moon');
  const tooltip = themeBtn.querySelector('.ai-sp-tooltip');
  const isDark = currentTheme === 'dark';
  if (sunIcon) sunIcon.style.display = isDark ? 'block' : 'none';
  if (moonIcon) moonIcon.style.display = isDark ? 'none' : 'block';
  if (tooltip) tooltip.textContent = isDark ? '切换浅色模式' : '切换深色模式';
}

function buildSettingsPlatformListMarkup() {
  return userConfig.platforms.map((item) => {
    if (!AI_PLATFORMS[item.id]) return '';
    const data = AI_PLATFORMS[item.id];
    return `
      <div class="ai-sp-platform-item" data-id="${item.id}" draggable="true">
        <div class="ai-sp-platform-drag-handle">
          <img src="${iconUrl('settings-sort-drag')}" style="width:16px;height:16px;" />
          <span class="ai-sp-tooltip">按住拖拽排序</span>
        </div>
        <div class="ai-sp-platform-info">
          <span><img src="${assetUrl(data.icon)}" style="width:32px;height:32px;vertical-align:middle;"></span>
          <div class="ai-sp-platform-info-text">
            <span>${data.name}</span>
            <span class="ai-sp-platform-url">${new URL(data.url).hostname}</span>
          </div>
        </div>
        <label class="ai-sp-switch">
          <input type="checkbox" class="ai-sp-platform-toggle" data-id="${item.id}" ${item.enabled ? 'checked' : ''}>
          <span class="ai-sp-slider"></span>
        </label>
      </div>
    `;
  }).join('');
}

function getRoot() {
  return document.getElementById('ai-sp-sidepanel-root');
}

function renderShell() {
  const root = getRoot();
  root.innerHTML = `
    <div id="ai-sp-container" class="is-sidebar-mode">
      <div class="ai-sp-settings-panel" id="ai-sp-settings-panel" style="display:none;">
        <div class="ai-sp-settings-header">
          <button class="ai-sp-settings-back-btn" id="ai-sp-settings-back-btn" title="返回">
            <img src="${iconUrl('settings-back')}" style="width:20px;height:20px;" />
          </button>
          <span>AI 助手</span>
          <div style="flex:1;"></div>
          <button class="ai-sp-settings-save-btn" id="ai-sp-settings-save-btn">保存</button>
        </div>
        <div class="ai-sp-settings-content">
          <div class="ai-sp-platform-list" id="ai-sp-platform-list" style="margin-bottom:24px;">
            ${buildSettingsPlatformListMarkup()}
          </div>
        </div>
      </div>
      <div class="ai-sp-header">
        <div class="ai-sp-header-left">
          <div class="ai-sp-title">
            <span class="ai-sp-logo">✦</span>
            <span>OmniAI</span>
          </div>
        </div>
        <div class="ai-sp-header-controls">
          <button id="ai-sp-theme-btn">
            <img class="ai-sp-icon-sun" src="${iconUrl('sun')}" style="width:20px;height:20px;display:none;" />
            <img class="ai-sp-icon-moon" src="${iconUrl('moon')}" style="width:20px;height:20px;display:block;" />
            <span class="ai-sp-tooltip">切换深色模式</span>
          </button>
          <button id="ai-sp-prompt-library-toolbar-btn" aria-label="提示词库">
            <img src="${iconUrl('selection-prompts')}" style="width:20px;height:20px;" />
            <span class="ai-sp-tooltip">提示词库</span>
          </button>
          <button id="ai-sp-memo-btn" aria-label="打开备忘录">
            <img src="${iconUrl('memo')}" style="width:20px;height:20px;" />
            <span class="ai-sp-tooltip">打开备忘录</span>
          </button>
          <button id="ai-sp-split-mode-btn">
            <img src="${iconUrl('split')}" style="width:20px;height:20px;" />
            <span class="ai-sp-tooltip">内容对比</span>
          </button>
          <button id="ai-sp-web-btn">
            <img src="${iconUrl('web')}" style="width:20px;height:20px;" />
            <span class="ai-sp-tooltip">网页打开</span>
          </button>
          <button id="ai-sp-toggle-mode-btn">
            <img src="${iconUrl('floating')}" style="width:20px;height:20px;" />
            <span class="ai-sp-tooltip">小窗打开</span>
          </button>
          <div class="ai-sp-header-menu-wrap" id="ai-sp-settings-menu-wrap">
            <button id="ai-sp-settings-btn" aria-label="设置" aria-haspopup="menu" aria-expanded="false">
              <img src="${iconUrl('settings')}" style="width:20px;height:20px;" />
            </button>
            <div class="ai-sp-header-dropdown" id="ai-sp-settings-menu" hidden>
              ${SETTINGS_MENU_ITEMS.map((item) => `
                <button class="ai-sp-header-dropdown-item" ${item.action ? `data-action="${item.action}"` : ''} ${item.tab ? `data-settings-tab="${item.tab}"` : ''} ${item.pagePath ? `data-page-path="${item.pagePath}"` : ''}>${item.label}</button>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
      <div class="ai-sp-platforms-wrapper">
        <button class="ai-sp-platforms-scroll-btn is-disabled" id="ai-sp-scroll-left">
          <img src="${iconUrl('platform-arrow-left')}" style="width:16px;height:16px;" />
        </button>
        <div class="ai-sp-platforms" id="ai-sp-platforms"></div>
        <button class="ai-sp-platforms-scroll-btn is-disabled" id="ai-sp-scroll-right">
          <img src="${iconUrl('platform-arrow-right')}" style="width:16px;height:16px;" />
        </button>
      </div>
      <div class="ai-sp-iframe-content-area" id="ai-sp-iframe-area"></div>
    </div>
  `;
  setTheme(currentTheme);
}

function renderPlatforms() {
  const platformsEl = document.getElementById('ai-sp-platforms');
  platformsEl.innerHTML = enabledPlatforms.map((key) => {
    const item = AI_PLATFORMS[key];
    return `
      <button class="ai-sp-platform-btn ${key === currentPlatform ? 'active' : ''}" data-platform="${key}">
        <span class="ai-sp-platform-icon"><img src="${assetUrl(item.icon)}" style="width:24px;height:24px;vertical-align:middle;"></span>
        <span class="ai-sp-platform-name">${item.name}</span>
      </button>
    `;
  }).join('');
  updateScrollButtons();
}

function renderContainers() {
  const area = document.getElementById('ai-sp-iframe-area');
  area.innerHTML = '';
  loadTimeouts.forEach((timer) => clearTimeout(timer));
  loadTimeouts.clear();
  contextReadyRequests.forEach((entry) => clearTimeout(entry.timer));
  contextReadyRequests.clear();
  pendingContextSends.forEach((entry) => clearTimeout(entry.timer));
  pendingContextSends.clear();
  enabledPlatforms.forEach((key) => {
    const wrap = document.createElement('div');
    wrap.className = 'ai-sp-iframe-container';
    wrap.id = `ai-sp-sidepanel-container-${key}`;
    wrap.dataset.platform = key;
    wrap.style.opacity = key === currentPlatform ? '1' : '0';
    wrap.style.pointerEvents = key === currentPlatform ? 'auto' : 'none';
    wrap.style.zIndex = key === currentPlatform ? '10' : '1';
    wrap.innerHTML = `
      <div class="ai-sp-loading" id="ai-sp-sidepanel-loading-${key}" style="display:${key === currentPlatform ? 'flex' : 'none'};">
        <div class="ai-sp-spinner"></div>
        <span>正在连接 ${AI_PLATFORMS[key].name}...</span>
      </div>
      <iframe id="ai-sp-sidepanel-iframe-${key}" data-platform="${key}" loading="eager" src="about:blank" style="opacity:0;width:100%;height:100%;border:none;"></iframe>
    `;
    area.appendChild(wrap);
  });
}

function syncSidebarState() {
  return sendRuntimeMessage({
    type: 'SYNC_SIDEPANEL_STATE',
    state: { query: currentQuery, currentPlatform, platformUrls, enabledPlatforms, theme: currentTheme }
  });
}

function applyConfigToUI() {
  enabledPlatforms = getEnabledPlatformIds();
  if (!enabledPlatforms.includes(currentPlatform)) {
    currentPlatform = enabledPlatforms[0] || 'doubao';
  }
  loadedIds.clear();
  renderPlatforms();
  renderContainers();
  setActivePlatform(currentPlatform);
  ensureIframeLoaded(currentPlatform, currentQuery);
  updateScrollButtons();
  syncSidebarState();
}

function setActivePlatform(platformKey) {
  currentPlatform = platformKey;
  document.querySelectorAll('.ai-sp-platform-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.platform === platformKey);
  });
  enabledPlatforms.forEach((key) => {
    const wrap = document.getElementById(`ai-sp-sidepanel-container-${key}`);
    if (!wrap) return;
    const active = key === platformKey;
    wrap.style.opacity = active ? '1' : '0';
    wrap.style.pointerEvents = active ? 'auto' : 'none';
    wrap.style.zIndex = active ? '10' : '1';
  });
}

function dispatchEmbeddedSend(platformKey, text, requestId) {
  const iframe = document.getElementById(`ai-sp-sidepanel-iframe-${platformKey}`);
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
}

function queueEmbeddedSend(platformKey, text, requestId, attempt = 1) {
  const iframe = document.getElementById(`ai-sp-sidepanel-iframe-${platformKey}`);
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
}

function sendQueryToIframe(platformKey, queryText) {
  const q = normalizeText(queryText);
  if (!q || !loadedIds.has(platformKey)) return;
  const requestId = makeSendRequestId();
  pendingEmbeddedSends.set(requestId, {
    expected: new Set([platformKey]),
    done: new Set(),
    failed: new Set(),
    timer: window.setTimeout(() => finalizeEmbeddedSend(requestId), 4500)
  });
  queueEmbeddedSend(platformKey, q, requestId, 1);
}

function ensureIframeLoaded(platformKey, queryText) {
  if (loadedIds.has(platformKey)) return;
  const iframe = document.getElementById(`ai-sp-sidepanel-iframe-${platformKey}`);
  const loading = document.getElementById(`ai-sp-sidepanel-loading-${platformKey}`);
  if (!iframe) return;
  const url = platformUrls[platformKey] || buildPlatformUrl(platformKey, queryText);
  platformUrls[platformKey] = url;
  iframe.style.opacity = '0';
  if (loading) loading.style.display = 'flex';
  iframe.src = url;
  loadedIds.add(platformKey);
  const previousTimer = loadTimeouts.get(platformKey);
  if (previousTimer) clearTimeout(previousTimer);
  loadTimeouts.set(platformKey, window.setTimeout(() => {
    const loadingEl = document.getElementById(`ai-sp-sidepanel-loading-${platformKey}`);
    const iframeEl = document.getElementById(`ai-sp-sidepanel-iframe-${platformKey}`);
    if (loadingEl) loadingEl.style.display = 'none';
    if (iframeEl) iframeEl.style.opacity = '1';
    loadTimeouts.delete(platformKey);
  }, 10000));
  iframe.addEventListener('load', () => {
    iframe.style.opacity = '1';
    if (loading) loading.style.display = 'none';
    setTimeout(() => sendThemeToIframe(platformKey), 120);
    const timer = loadTimeouts.get(platformKey);
    if (timer) {
      clearTimeout(timer);
      loadTimeouts.delete(platformKey);
    }
    const deferred = deferredContextSends.get(platformKey);
    if (deferred) {
      requestDeferredContextSend(platformKey, deferred.requestId, deferred.text, 1);
      return;
    }
    if (!shouldUseHashBootstrap(platformKey) && queryText) {
      setTimeout(() => sendQueryToIframe(platformKey, queryText), 180);
    }
  }, { once: true });
}

function updateScrollButtons() {
  const platformsEl = document.getElementById('ai-sp-platforms');
  const leftBtn = document.getElementById('ai-sp-scroll-left');
  const rightBtn = document.getElementById('ai-sp-scroll-right');
  if (!platformsEl || !leftBtn || !rightBtn) return;
  const canScroll = platformsEl.scrollWidth > platformsEl.clientWidth;
  const canScrollLeft = canScroll && platformsEl.scrollLeft > 0;
  const isAtEnd = Math.abs(platformsEl.scrollWidth - platformsEl.clientWidth - platformsEl.scrollLeft) <= 1;
  const canScrollRight = canScroll && !isAtEnd;
  leftBtn.classList.toggle('is-disabled', !canScrollLeft);
  rightBtn.classList.toggle('is-disabled', !canScrollRight);
}

function ensurePlatformBtnVisible(btn) {
  const platformsEl = document.getElementById('ai-sp-platforms');
  if (!platformsEl || !btn) return;
  const safeRight = 64;
  const safeLeft = 64;
  const containerRect = platformsEl.getBoundingClientRect();
  const btnRect = btn.getBoundingClientRect();
  if (btnRect.right > containerRect.right - safeRight) {
    const delta = btnRect.right - (containerRect.right - safeRight);
    platformsEl.scrollBy({ left: delta, behavior: 'smooth' });
  } else if (btnRect.left < containerRect.left + safeLeft) {
    const delta = btnRect.left - (containerRect.left + safeLeft);
    platformsEl.scrollBy({ left: delta, behavior: 'smooth' });
  }
}

async function resolveTargetTabId() {
  if (typeof activeTabId === 'number') return activeTabId;
  const tabId = await getActiveTabId();
  if (typeof tabId === 'number') activeTabId = tabId;
  return tabId;
}

async function getActiveTabId() {
  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tabs && tabs.length ? tabs[0].id : null;
}

async function fetchQueryFromActiveTab() {
  const tabId = await resolveTargetTabId();
  if (!tabId) return '';
  try {
    const resp = await chrome.tabs.sendMessage(tabId, { type: 'AI_SP_GET_SEARCH_QUERY' });
    return normalizeText(resp?.query || '');
  } catch (e) {
    return '';
  }
}

async function readConfig() {
  const data = await chrome.storage.local.get(['aiSearchProConfig']);
  const cfg = data?.aiSearchProConfig;
  if (cfg?.theme) {
    userConfig.theme = cfg.theme === 'auto' ? 'auto' : (cfg.theme === 'dark' ? 'dark' : 'light');
    setTheme(userConfig.theme);
  }
  userConfig.selectionDisplayMode = normalizeSelectionDisplayMode(cfg?.selectionDisplayMode);
  if (Array.isArray(cfg?.platforms)) {
    const list = mergePlatformsWithDefaults(cfg.platforms);
    if (list.length) {
      userConfig.platforms = list;
      enabledPlatforms = getEnabledPlatformIds(userConfig);
    }
  }
}

async function fetchSidebarState() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'GET_SIDEBAR_STATE' }, (resp) => {
      if (chrome.runtime.lastError || !resp?.ok) return resolve(null);
      activeTabId = resp.tabId;
      resolve(resp.state || null);
    });
  });
}

async function readQueuedContextAction() {
  const data = await chrome.storage.local.get([SIDEPANEL_CONTEXT_ACTION_STORAGE_KEY]);
  return data?.[SIDEPANEL_CONTEXT_ACTION_STORAGE_KEY] || null;
}

async function clearQueuedContextAction() {
  await chrome.storage.local.remove(SIDEPANEL_CONTEXT_ACTION_STORAGE_KEY);
}

async function consumeQueuedContextAction(action) {
  const text = normalizeText(action?.text || '');
  if (!text) return;
  const actionId = String(action?.id || '').trim();
  if (actionId && actionId === lastConsumedContextActionId) return;
  if (actionId) lastConsumedContextActionId = actionId;
  const targetPlatform = enabledPlatforms.includes(action?.platformId) ? action.platformId : (enabledPlatforms[0] || currentPlatform);
  const requestId = action?.id || makeSendRequestId();
  currentQuery = text;
  currentPlatform = targetPlatform;
  platformUrls[targetPlatform] = buildPlatformUrl(targetPlatform, text);
  setActivePlatform(targetPlatform);
  queueDeferredContextSend(targetPlatform, text, requestId);
  await syncSidebarState();
}

async function syncFromActiveTab() {
  const query = await fetchQueryFromActiveTab();
  if (!query) return;
  currentQuery = query;
  enabledPlatforms.forEach((key) => {
    const iframe = document.getElementById(`ai-sp-sidepanel-iframe-${key}`);
    if (!iframe || !loadedIds.has(key)) return;
    sendQueryToIframe(key, currentQuery);
  });
  chrome.runtime.sendMessage({
    type: 'SYNC_SIDEPANEL_STATE',
    state: { query: currentQuery, currentPlatform, platformUrls, enabledPlatforms, theme: currentTheme }
  }, () => chrome.runtime.lastError);
}

function openCompare() {
  const sessionUrls = {};
  enabledPlatforms.forEach((key) => {
    const iframe = document.getElementById(`ai-sp-sidepanel-iframe-${key}`);
    sessionUrls[key] = iframe?.src && iframe.src !== 'about:blank' ? iframe.src : (platformUrls[key] || AI_PLATFORMS[key].url);
  });
  const compareUrl = chrome.runtime.getURL(
    `compare/compare.html#q=${encodeURIComponent(currentQuery || '')}&platforms=${encodeURIComponent(enabledPlatforms.join(','))}&enabled=${encodeURIComponent(enabledPlatforms.join(','))}&urls=${encodeURIComponent(JSON.stringify(sessionUrls))}&theme=${encodeURIComponent(currentTheme)}`
  );
  window.open(compareUrl, '_blank');
  sendRuntimeMessage({ type: 'CLOSE_NATIVE_SIDEBAR', tabId: activeTabId });
}

function bindEvents() {
  const settingsPanel = document.getElementById('ai-sp-settings-panel');
  const settingsBtn = document.getElementById('ai-sp-settings-btn');
  const memoBtn = document.getElementById('ai-sp-memo-btn');
  const settingsMenuWrap = document.getElementById('ai-sp-settings-menu-wrap');
  const settingsMenu = document.getElementById('ai-sp-settings-menu');
  const settingsBackBtn = document.getElementById('ai-sp-settings-back-btn');
  const settingsSaveBtn = document.getElementById('ai-sp-settings-save-btn');
  const promptLibraryToolbarBtn = document.getElementById('ai-sp-prompt-library-toolbar-btn');
  const platformList = document.getElementById('ai-sp-platform-list');
  let draggedItem = null;
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

  function bindDragEvents() {
    if (!platformList) return;
    platformList.querySelectorAll('.ai-sp-platform-item').forEach((item) => {
      item.ondragstart = (e) => {
        draggedItem = item;
        setTimeout(() => item.classList.add('is-dragging'), 0);
        if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
      };
      item.ondragend = () => {
        item.classList.remove('is-dragging');
        draggedItem = null;
      };
      item.ondragover = (e) => {
        e.preventDefault();
        if (!draggedItem || draggedItem === item) return;
        const rect = item.getBoundingClientRect();
        const next = (e.clientY - rect.top) / (rect.bottom - rect.top) > 0.5;
        const parent = item.parentNode;
        if (!parent) return;
        if (next) {
          if (item.nextSibling) parent.insertBefore(draggedItem, item.nextSibling);
          else parent.appendChild(draggedItem);
        } else {
          parent.insertBefore(draggedItem, item);
        }
      };
    });
  }

  function renderSettingsPlatformList() {
    if (!platformList) return;
    platformList.innerHTML = buildSettingsPlatformListMarkup();
    bindDragEvents();
  }

  function openSettingsPanel() {
    renderSettingsPlatformList();
    if (settingsPanel) settingsPanel.style.display = 'flex';
  }

  function closeSettingsPanel() {
    if (settingsPanel) settingsPanel.style.display = 'none';
  }

  async function saveSettings() {
    if (!platformList) return;
    const platforms = Array.from(platformList.querySelectorAll('.ai-sp-platform-item')).map((item) => ({
      id: item.dataset.id,
      enabled: item.querySelector('.ai-sp-platform-toggle')?.checked === true
    })).filter((item) => AI_PLATFORMS[item.id]);
    const fallbackPlatforms = platforms.some((item) => item.enabled)
      ? platforms
      : platforms.map((item, index) => ({ ...item, enabled: index === 0 }));
    userConfig = {
      platforms: fallbackPlatforms,
      theme: currentTheme,
      selectionDisplayMode: normalizeSelectionDisplayMode(userConfig.selectionDisplayMode)
    };
    await chrome.storage.local.set({ aiSearchProConfig: userConfig });
    closeSettingsPanel();
    applyConfigToUI();
  }

  const platformsEl = document.getElementById('ai-sp-platforms');
  platformsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.ai-sp-platform-btn');
    if (!btn) return;
    const key = btn.dataset.platform;
    if (!key || key === currentPlatform) return;
    setActivePlatform(key);
    ensurePlatformBtnVisible(btn);
    ensureIframeLoaded(key, currentQuery);
    chrome.runtime.sendMessage({
      type: 'UPDATE_SIDEPANEL_PLATFORM',
      tabId: activeTabId,
      currentPlatform: key,
      activeUrl: platformUrls[key] || AI_PLATFORMS[key].url
    }, () => chrome.runtime.lastError);
  });
  platformsEl.addEventListener('scroll', updateScrollButtons);

  document.getElementById('ai-sp-scroll-left')?.addEventListener('click', () => {
    const el = document.getElementById('ai-sp-platforms');
    if (!el) return;
    const leftBtn = document.getElementById('ai-sp-scroll-left');
    if (leftBtn?.classList.contains('is-disabled')) return;
    const step = Math.max(220, Math.floor(el.clientWidth * 0.95));
    el.scrollBy({ left: -step, behavior: 'smooth' });
  });

  document.getElementById('ai-sp-scroll-right')?.addEventListener('click', () => {
    const el = document.getElementById('ai-sp-platforms');
    if (!el) return;
    const rightBtn = document.getElementById('ai-sp-scroll-right');
    if (rightBtn?.classList.contains('is-disabled')) return;
    const step = Math.max(220, Math.floor(el.clientWidth * 0.95));
    el.scrollBy({ left: step, behavior: 'smooth' });
  });

  document.getElementById('ai-sp-theme-btn')?.addEventListener('click', async () => {
    setTheme(currentTheme === 'dark' ? 'light' : 'dark');
    userConfig.theme = currentTheme;
    enabledPlatforms.forEach((platformKey) => {
      if (loadedIds.has(platformKey)) sendThemeToIframe(platformKey);
    });
    await chrome.storage.local.set({ aiSearchProConfig: userConfig });
    syncSidebarState();
  });

  settingsBtn?.addEventListener('click', (event) => {
    event.stopPropagation();
    if (settingsMenu?.hidden === false) {
      closeSettingsDropdown();
      return;
    }
    openSettingsDropdown();
  });
  settingsMenuWrap?.addEventListener('mouseenter', openSettingsDropdown);
  settingsMenuWrap?.addEventListener('mouseleave', scheduleCloseSettingsDropdown);
  settingsMenu?.addEventListener('click', (event) => {
    const item = event.target.closest('.ai-sp-header-dropdown-item');
    if (!item) return;
    if (item.dataset.action === 'inline-assistants') {
      openSettingsPanel();
    } else if (item.dataset.pagePath) {
      openExtensionPage(item.dataset.pagePath);
    } else {
      openSettingsPage(item.dataset.settingsTab);
    }
    closeSettingsDropdown();
  });
  settingsBackBtn?.addEventListener('click', closeSettingsPanel);
  settingsSaveBtn?.addEventListener('click', saveSettings);
  promptLibraryToolbarBtn?.addEventListener('click', () => {
    openExtensionPage('prompt-library/prompt_library.html');
  });
  memoBtn?.addEventListener('click', openMemoPage);
  document.getElementById('ai-sp-split-mode-btn')?.addEventListener('click', openCompare);
  document.getElementById('ai-sp-web-btn')?.addEventListener('click', () => {
    const url = platformUrls[currentPlatform] || AI_PLATFORMS[currentPlatform]?.url;
    if (url) window.open(url, '_blank');
  });
  document.getElementById('ai-sp-toggle-mode-btn')?.addEventListener('click', async () => {
    const tabId = await resolveTargetTabId();
    if (!tabId) return;
    await sendRuntimeMessage({
      type: 'OPEN_FLOATING_UI',
      tabId,
      query: currentQuery,
      state: {
        currentPlatform,
        enabledPlatforms,
        platformUrls,
        theme: currentTheme
      }
    });
  });

  window.addEventListener('resize', updateScrollButtons);
  document.addEventListener('mousedown', (event) => {
    if (settingsMenu?.hidden === false && !settingsMenuWrap?.contains(event.target)) {
      closeSettingsDropdown();
    }
  });
  window.addEventListener('message', (event) => {
    if (event.data?.type === 'AI_SEARCH_PRO_LOADED') {
      enabledPlatforms.forEach((key) => {
        const iframe = document.getElementById(`ai-sp-sidepanel-iframe-${key}`);
        const loading = document.getElementById(`ai-sp-sidepanel-loading-${key}`);
        if (iframe?.contentWindow === event.source) {
          if (loading) loading.style.display = 'none';
          iframe.style.opacity = '1';
          const timer = loadTimeouts.get(key);
          if (timer) {
            clearTimeout(timer);
            loadTimeouts.delete(key);
          }
          const deferred = deferredContextSends.get(key);
          if (deferred) {
            requestDeferredContextSend(key, deferred.requestId, deferred.text, 1);
          }
        }
      });
      return;
    }
    if (event.data?.type === 'AI_SEARCH_PRO_SUMMARY' && event.data.requestId) {
      const entry = pendingSummaryRequests.get(event.data.requestId);
      if (!entry) return;
      clearTimeout(entry.timer);
      pendingSummaryRequests.delete(event.data.requestId);
      entry.resolve({
        platformKey: entry.platformKey,
        summary: typeof event.data.summary === 'string' ? event.data.summary.trim() : '',
        url: event.data.url || entry.iframe?.src || platformUrls[entry.platformKey] || ''
      });
      return;
    }
    if (event.data?.type === EMBEDDED_LOCATION_EVENT && event.data.requestId) {
      enabledPlatforms.forEach((key) => {
        const iframe = document.getElementById(`ai-sp-sidepanel-iframe-${key}`);
        if (iframe?.contentWindow !== event.source) return;
        const contextEntry = contextReadyRequests.get(key);
        if (!contextEntry || contextEntry.requestId !== event.data.requestId) return;
        clearContextReadyRequest(key);
        if (event.data.href) {
          platformUrls[key] = event.data.href;
        }
        const deferred = deferredContextSends.get(key);
        if (!deferred || deferred.requestId !== event.data.requestId) return;
        flushDeferredContextSend(key, deferred.requestId);
      });
      return;
    }
    if (event.data?.type === EMBEDDED_SEND_READY_RESPONSE_EVENT && event.data.requestId && event.data.paneId) {
      const contextEntry = contextReadyRequests.get(event.data.paneId);
      if (contextEntry && contextEntry.requestId === event.data.requestId) {
        clearContextReadyRequest(event.data.paneId);
        const deferred = deferredContextSends.get(event.data.paneId);
        if (!deferred || deferred.requestId !== event.data.requestId) return;
        flushDeferredContextSend(event.data.paneId, deferred.requestId);
        return;
      }
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
      return;
    }
    if (event.data?.type === EMBEDDED_SEND_DONE_EVENT && event.data.requestId && event.data.paneId) {
      const pendingContext = pendingContextSends.get(event.data.paneId);
      if (pendingContext && pendingContext.requestId === event.data.requestId) {
        if (event.data.ok !== false) {
          clearPendingContextSend(event.data.paneId);
          deferredContextSends.delete(event.data.paneId);
        }
        return;
      }
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
      return;
    }
    if (event.data?.type !== 'AI_SEARCH_PRO_URL_SYNC' || !event.data.url) return;
    enabledPlatforms.forEach((key) => {
      const iframe = document.getElementById(`ai-sp-sidepanel-iframe-${key}`);
      if (iframe?.contentWindow === event.source) {
        platformUrls[key] = event.data.url;
        chrome.runtime.sendMessage({
          type: 'UPDATE_ACTIVE_URL',
          tabId: activeTabId,
          currentPlatform: key,
          url: event.data.url
        }, () => chrome.runtime.lastError);
      }
    });
  });
}

function init(initialQueuedAction = null) {
  renderShell();
  renderPlatforms();
  renderContainers();
  bindEvents();
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes[PROMPT_LIBRARY_STORAGE_KEY]) {
      promptLibraryCache = normalizePromptLibrary(changes[PROMPT_LIBRARY_STORAGE_KEY].newValue);
    }
    if (areaName === 'local' && changes[SIDEPANEL_CONTEXT_ACTION_STORAGE_KEY]?.newValue) {
      consumeQueuedContextAction(changes[SIDEPANEL_CONTEXT_ACTION_STORAGE_KEY].newValue).catch(() => {});
      clearQueuedContextAction().catch(() => {});
    }
    if (areaName === 'local' && changes[CONFIG_STORAGE_KEY]?.newValue) {
      const cfg = changes[CONFIG_STORAGE_KEY].newValue || {};
      if (cfg.theme) {
        userConfig.theme = cfg.theme === 'auto' ? 'auto' : (cfg.theme === 'dark' ? 'dark' : 'light');
        setTheme(userConfig.theme);
        enabledPlatforms.forEach((platformKey) => {
          if (loadedIds.has(platformKey)) sendThemeToIframe(platformKey);
        });
      }
    }
  });
  setActivePlatform(currentPlatform);
  if (initialQueuedAction) {
    consumeQueuedContextAction(initialQueuedAction).then(() => clearQueuedContextAction()).catch(() => {});
  } else {
    ensureIframeLoaded(currentPlatform, currentQuery);
  }
  let lastEnabledPlatformsSignature = getPlatformsSignature(enabledPlatforms);
  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type !== 'SIDEPANEL_STATE_UPDATED') return;
    const state = message.state || {};
    if (typeof message.tabId === 'number') activeTabId = message.tabId;
    if (typeof state.query === 'string') currentQuery = normalizeText(state.query);
    if (state.theme) setTheme(state.theme);
    if (state.platformUrls) platformUrls = { ...platformUrls, ...state.platformUrls };
    if (Array.isArray(state.enabledPlatforms) && state.enabledPlatforms.length) {
      const list = state.enabledPlatforms.filter((id) => AI_PLATFORMS[id]);
      if (list.length) {
        const nextSignature = getPlatformsSignature(list);
        const shouldRerenderPlatforms = nextSignature !== lastEnabledPlatformsSignature;
        enabledPlatforms = list;
        applyEnabledPlatformsToUserConfig(list);
        if (!enabledPlatforms.includes(currentPlatform)) {
          currentPlatform = enabledPlatforms[0];
        }
        if (shouldRerenderPlatforms) {
          lastEnabledPlatformsSignature = nextSignature;
          loadedIds.clear();
          renderPlatforms();
          renderContainers();
          setActivePlatform(currentPlatform);
          if (!deferredContextSends.size) {
            ensureIframeLoaded(currentPlatform, currentQuery);
          }
          return;
        }
      }
    }
    if (state.currentPlatform && enabledPlatforms.includes(state.currentPlatform)) {
      currentPlatform = state.currentPlatform;
      setActivePlatform(currentPlatform);
      if (!deferredContextSends.size) {
        ensureIframeLoaded(currentPlatform, currentQuery);
      }
    }
  });
}

(async () => {
  await readConfig();
  await loadPromptLibrary();
  const state = await fetchSidebarState();
  const queuedAction = await readQueuedContextAction();
  if (state) {
    if (typeof state.query === 'string') currentQuery = normalizeText(state.query);
    if (state.theme) {
      userConfig.theme = state.theme === 'auto' ? 'auto' : (state.theme === 'dark' ? 'dark' : 'light');
      setTheme(userConfig.theme);
    }
    if (state.platformUrls) platformUrls = { ...state.platformUrls };
    if (Array.isArray(state.enabledPlatforms) && state.enabledPlatforms.length) {
      const list = state.enabledPlatforms.filter((id) => AI_PLATFORMS[id]);
      if (list.length) {
        enabledPlatforms = list;
        applyEnabledPlatformsToUserConfig(list);
      }
    }
    currentPlatform = enabledPlatforms.includes(state.currentPlatform) ? state.currentPlatform : (enabledPlatforms[0] || 'doubao');
    if (!currentQuery) currentQuery = await fetchQueryFromActiveTab();
  } else {
    currentPlatform = enabledPlatforms[0] || 'doubao';
    currentQuery = await fetchQueryFromActiveTab();
  }
  init(queuedAction);
  updateScrollButtons();
  subscribeSystemThemeChange(() => {
    if (userConfig.theme !== 'auto') return;
    setTheme('auto');
    enabledPlatforms.forEach((platformKey) => {
      if (loadedIds.has(platformKey)) sendThemeToIframe(platformKey);
    });
  });
})();
