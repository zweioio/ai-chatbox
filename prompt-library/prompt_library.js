(() => {
  const STORAGE_KEY = 'aiSearchProPromptLibrary';
  const CONFIG_STORAGE_KEY = 'aiSearchProConfig';
  const PREVIEW_TEXT = '请帮我整理这段内容的重点，并用简单清晰的方式输出。';
  const PREVIEW_CONTEXT = '这段内容来自一个网页段落，主题和 AI 搜索、插件体验优化有关。';
  const DEFAULT_PROMPTS = [
    { id: 'prompt-explain', title: '解释', icon: '💡', template: '请用简单易懂的方式解释下面这段内容：\n\n{{text}}', enabled: true },
    { id: 'prompt-summary', title: '总结', icon: '📝', template: '请总结下面这段内容的核心要点：\n\n{{text}}', enabled: true },
    { id: 'prompt-translate', title: '翻译', icon: '🌐', template: '请把下面内容翻译成中文，并保留原意：\n\n{{text}}', enabled: true },
    { id: 'prompt-polish', title: '润色', icon: '✨', template: '请润色下面这段内容，让表达更清晰自然：\n\n{{text}}', enabled: true },
    { id: 'prompt-review', title: '代码审查', icon: '🔍', template: '请从可读性、潜在问题和改进建议三个方面审查下面这段代码：\n\n{{text}}', enabled: false },
    { id: 'prompt-rewrite', title: '改写', icon: '✍️', template: '请在不改变原意的前提下改写下面内容，让表达更自然：\n\n{{text}}', enabled: false },
    { id: 'prompt-article', title: '文章提炼', icon: '📚', template: '请结合以下上下文提炼关键信息，并给出结构化总结：\n\n选中内容：\n{{text}}\n\n上下文：\n{{context}}\n\n页面标题：{{page}}\n页面地址：{{url}}', enabled: false }
  ];
  const listEl = document.getElementById('pl-list');
  const addBtn = document.getElementById('pl-add-btn');
  const saveBtn = document.getElementById('pl-save-btn');
  const exportBtn = document.getElementById('pl-export-btn');
  const importBtn = document.getElementById('pl-import-btn');
  const importInput = document.getElementById('pl-import-input');
  const searchInput = document.getElementById('pl-search-input');
  const countText = document.getElementById('pl-count-text');
  const statusText = document.getElementById('pl-status-text');
  const emptyEl = document.getElementById('pl-empty');
  const resetBtn = document.getElementById('pl-reset-btn');
  const editorMask = document.getElementById('pl-editor-mask');
  const editorTitle = document.getElementById('pl-editor-title');
  const editorClose = document.getElementById('pl-editor-close');
  const editorCancel = document.getElementById('pl-editor-cancel');
  const editorSave = document.getElementById('pl-editor-save');
  const editorDelete = document.getElementById('pl-editor-delete');
  const openSettingsBtn = document.getElementById('pl-open-settings-btn');
  const openMemoBtn = document.getElementById('pl-open-memo-btn');
  const openCompareBtn = document.getElementById('pl-open-compare-btn');
  const formTitle = document.getElementById('pl-form-title');
  const formIcon = document.getElementById('pl-form-icon');
  const formTemplate = document.getElementById('pl-form-template');
  const formEnabled = document.getElementById('pl-form-enabled');
  const previewText = document.getElementById('pl-preview-text');
  let prompts = [];
  let keyword = '';
  let dirty = false;
  let editingId = '';
  const themeMedia = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function makeId() {
    return `prompt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function openPage(path) {
    if (typeof window.__AI_SEARCH_PRO_NAVIGATE === 'function') {
      window.__AI_SEARCH_PRO_NAVIGATE(path);
      return;
    }
    window.location.href = chrome.runtime.getURL(path);
  }

  function resolveTheme(theme) {
    if (theme === 'auto') return themeMedia?.matches ? 'dark' : 'light';
    return theme === 'dark' ? 'dark' : 'light';
  }

  function applyTheme(theme) {
    const mode = resolveTheme(theme);
    document.documentElement.setAttribute('data-ai-sp-theme', mode);
    try {
      sessionStorage.setItem('aiSearchProThemeSnapshot', mode);
    } catch (e) {}
    document.documentElement.setAttribute('data-page-ready', '1');
  }

  function toArray(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.prompts)) return payload.prompts;
    return [];
  }

  function createDefaultPrompt(item) {
    const now = Date.now();
    return {
      id: item.id,
      title: item.title,
      icon: item.icon || '💡',
      template: item.template,
      enabled: item.enabled !== false,
      createdAt: now,
      updatedAt: now
    };
  }

  function normalize(list) {
    const merged = [];
    const seen = new Set();
    const fingerprintSet = new Set();
    [...toArray(list), ...DEFAULT_PROMPTS.map(createDefaultPrompt)].forEach((item, index) => {
      if (!item) return;
      const id = String(item.id || '').trim() || `${makeId()}-${index}`;
      if (seen.has(id)) return;
      const title = String(item.title || '').trim();
      const template = typeof item.template === 'string'
        ? item.template.trim()
        : typeof item.content === 'string'
          ? item.content.trim()
          : '';
      if (!title || !template) return;
      const fingerprint = `${title}__${template}`;
      if (fingerprintSet.has(fingerprint)) return;
      fingerprintSet.add(fingerprint);
      seen.add(id);
      const timestamp = Number(item.createdAt) || Date.now();
      merged.push({
        id,
        title,
        icon: String(item.icon || '💡').trim() || '💡',
        template,
        enabled: item.enabled !== false,
        createdAt: timestamp,
        updatedAt: Number(item.updatedAt) || timestamp
      });
    });
    return merged.sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
  }

  function setDirty(nextDirty, text = '') {
    dirty = nextDirty;
    statusText.textContent = text || (dirty ? '有未保存修改' : '已同步');
    saveBtn.disabled = !dirty;
  }

  function formatTime(ts) {
    return new Date(ts || Date.now()).toLocaleString();
  }

  function escapeHtml(text) {
    return String(text || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function applyTemplatePreview(template) {
    return String(template || '')
      .replaceAll('{{text}}', PREVIEW_TEXT)
      .replaceAll('{{context}}', PREVIEW_CONTEXT)
      .replaceAll('{{page}}', document.title)
      .replaceAll('{{url}}', 'https://example.com/article')
      .replaceAll('{{time}}', '2026/04/06 10:30:00');
  }

  function getFilteredPrompts() {
    const q = keyword.trim().toLowerCase();
    if (!q) return prompts;
    return prompts.filter((item) => {
      const haystack = `${item.title} ${item.template} ${item.icon}`.toLowerCase();
      return haystack.includes(q);
    });
  }

  function renderCount(list) {
    countText.textContent = `${list.length} / ${prompts.length} 条提示词`;
  }

  async function load() {
    const data = await chrome.storage.local.get([STORAGE_KEY, CONFIG_STORAGE_KEY]);
    applyTheme(data?.[CONFIG_STORAGE_KEY]?.theme);
    prompts = normalize(data?.[STORAGE_KEY]);
    setDirty(false);
    render();
  }

  function render() {
    const list = getFilteredPrompts();
    renderCount(list);
    emptyEl.hidden = list.length > 0;
    listEl.innerHTML = list.map((item) => `
      <div class="pl-card" data-id="${item.id}">
        <div class="pl-card-top">
          <div class="pl-card-title">
            <span class="pl-card-icon">${escapeHtml(item.icon)}</span>
            <div>
              <strong>${escapeHtml(item.title)}</strong>
              <span>更新于 ${formatTime(item.updatedAt)}</span>
            </div>
          </div>
          <div class="pl-card-actions">
            <span class="pl-toggle" data-enabled="${item.enabled ? 'true' : 'false'}">${item.enabled ? '已启用' : '已停用'}</span>
            <button data-action="copy">复制</button>
            <button data-action="edit">编辑</button>
          </div>
        </div>
        <div class="pl-card-body">
          <p class="pl-card-preview">${escapeHtml(item.template)}</p>
          <div class="pl-card-meta">
            <span>创建于 ${formatTime(item.createdAt)}</span>
            <span>${item.template.includes('{{') ? '包含变量' : '纯文本模板'}</span>
          </div>
        </div>
      </div>
    `).join('');
  }

  function insertAtCursor(textarea, text) {
    const start = textarea.selectionStart || 0;
    const end = textarea.selectionEnd || 0;
    const next = `${textarea.value.slice(0, start)}${text}${textarea.value.slice(end)}`;
    textarea.value = next;
    textarea.focus();
    textarea.selectionStart = textarea.selectionEnd = start + text.length;
    renderPreview();
  }

  function renderPreview() {
    previewText.textContent = applyTemplatePreview(formTemplate.value.trim()) || '这里会显示提示词预览效果';
  }

  function openEditor(id = '') {
    editingId = id;
    const item = prompts.find((prompt) => prompt.id === id);
    editorTitle.textContent = item ? '编辑提示词' : '新增提示词';
    formTitle.value = item?.title || '';
    formIcon.value = item?.icon || '💡';
    formTemplate.value = item?.template || '';
    formEnabled.checked = item ? item.enabled !== false : true;
    editorDelete.hidden = !item;
    editorMask.hidden = false;
    renderPreview();
    setTimeout(() => formTitle.focus(), 0);
  }

  function closeEditor() {
    editingId = '';
    editorMask.hidden = true;
  }

  function upsertPromptFromForm() {
    const title = formTitle.value.trim();
    const template = formTemplate.value.trim();
    if (!title || !template) {
      setDirty(dirty, '标题和提示词内容不能为空');
      if (!title) {
        formTitle.focus();
      } else {
        formTemplate.focus();
      }
      return false;
    }
    const now = Date.now();
    if (editingId) {
      prompts = prompts.map((item) => item.id === editingId ? {
        ...item,
        title,
        icon: formIcon.value.trim() || '💡',
        template,
        enabled: formEnabled.checked,
        updatedAt: now
      } : item);
    } else {
      prompts = [{
        id: makeId(),
        title,
        icon: formIcon.value.trim() || '💡',
        template,
        enabled: formEnabled.checked,
        createdAt: now,
        updatedAt: now
      }, ...prompts];
    }
    prompts = normalize(prompts);
    closeEditor();
    setDirty(true, '已修改，请保存');
    render();
    return true;
  }

  async function persist(text = '已保存') {
    prompts = normalize(prompts);
    await chrome.storage.local.set({ [STORAGE_KEY]: prompts });
    setDirty(false, text);
    render();
  }

  function restoreDefaults() {
    prompts = normalize(DEFAULT_PROMPTS.map(createDefaultPrompt));
    setDirty(true, '已恢复默认，请保存');
    render();
  }

  async function copyPromptContent(id) {
    const item = prompts.find((prompt) => prompt.id === id);
    if (!item) return;
    await navigator.clipboard.writeText(item.template).catch(() => {});
    setDirty(dirty, '提示词内容已复制');
  }

  function togglePrompt(id) {
    prompts = prompts.map((item) => item.id === id ? {
      ...item,
      enabled: !item.enabled,
      updatedAt: Date.now()
    } : item);
    setDirty(true, '已修改启用状态，请保存');
    render();
  }

  function parseImport(text) {
    const payload = JSON.parse(text);
    return normalize(toArray(payload));
  }

  addBtn.addEventListener('click', () => {
    openEditor();
  });

  listEl.addEventListener('click', (event) => {
    const card = event.target.closest('.pl-card');
    const id = card?.dataset.id;
    if (!id) return;
    const action = event.target.closest('button')?.dataset.action;
    if (action === 'edit') {
      openEditor(id);
      return;
    }
    if (action === 'copy') {
      copyPromptContent(id);
      return;
    }
    if (event.target.closest('.pl-toggle')) {
      togglePrompt(id);
    }
  });

  saveBtn.addEventListener('click', async () => {
    await persist();
  });

  exportBtn.addEventListener('click', async () => {
    const blob = new Blob([JSON.stringify({ prompts: normalize(prompts) }, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'ai-search-pro-prompts.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  });

  importBtn.addEventListener('click', () => importInput.click());
  importInput.addEventListener('change', async () => {
    const file = importInput.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      prompts = normalize([...parseImport(text), ...prompts]);
      await persist('导入成功');
      render();
    } catch (e) {}
    importInput.value = '';
  });

  resetBtn.addEventListener('click', () => {
    restoreDefaults();
  });

  searchInput.addEventListener('input', () => {
    keyword = searchInput.value.trim();
    render();
  });

  editorClose.addEventListener('click', closeEditor);
  editorCancel.addEventListener('click', closeEditor);
  editorSave.addEventListener('click', () => {
    upsertPromptFromForm();
  });
  editorDelete.addEventListener('click', () => {
    if (!editingId) return;
    prompts = prompts.filter((item) => item.id !== editingId);
    closeEditor();
    setDirty(true, '已删除，请保存');
    render();
  });

  editorMask.addEventListener('click', (event) => {
    if (event.target === editorMask) closeEditor();
  });

  formTemplate.addEventListener('input', renderPreview);
  formTitle.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      upsertPromptFromForm();
    }
  });
  formTemplate.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      upsertPromptFromForm();
    }
  });
  openSettingsBtn?.addEventListener('click', () => openPage('settings/settings.html'));
  openMemoBtn?.addEventListener('click', () => openPage('favorites/favorites.html'));
  openCompareBtn?.addEventListener('click', () => openPage('compare/compare.html'));

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes[CONFIG_STORAGE_KEY]?.newValue) {
      applyTheme(changes[CONFIG_STORAGE_KEY].newValue.theme);
    }
  });
  themeMedia?.addEventListener?.('change', async () => {
    const data = await chrome.storage.local.get([CONFIG_STORAGE_KEY]);
    if (data?.[CONFIG_STORAGE_KEY]?.theme === 'auto') applyTheme('auto');
  });

  document.addEventListener('click', (event) => {
    const variableBtn = event.target.closest('.pl-variable-chip');
    if (!variableBtn) return;
    const variable = variableBtn.dataset.variable;
    if (!variable) return;
    if (!editorMask.hidden) {
      insertAtCursor(formTemplate, variable);
      return;
    }
    navigator.clipboard.writeText(variable).catch(() => {});
    setDirty(dirty, `${variable} 已复制`);
  });

  load();
})();
