(() => {
  const STORAGE_KEY = 'aiSearchProPromptLibrary';
  const CONFIG_STORAGE_KEY = 'aiSearchProConfig';
  const PREVIEW_TEXT = '请帮我整理这段内容的重点，并用简单清晰的方式输出。';
  const PREVIEW_CONTEXT = '这段内容来自一个网页段落，主题和 AI 搜索、插件体验优化有关。';
  const PROMPT_ICON_OPTIONS = [
    { key: 'prompt-explain', label: '解释', file: 'selection-explain.svg', fallback: '💡' },
    { key: 'prompt-summary', label: '总结', file: 'selection-summary.svg', fallback: '📝' },
    { key: 'prompt-translate', label: '翻译', file: 'selection-translate.svg', fallback: '🌐' },
    { key: 'prompt-polish', label: '润色', file: 'selection-polish.svg', fallback: '✨' },
    { key: 'prompt-review', label: '代码审查', file: 'selection-review.svg', fallback: '🔍' },
    { key: 'prompt-rewrite', label: '改写', file: 'selection-rewrite.svg', fallback: '✍️' },
    { key: 'prompt-article', label: '文章提炼', file: 'selection-article.svg', fallback: '📚' }
  ];
  const PROMPT_ICON_MAP = new Map(PROMPT_ICON_OPTIONS.map((item) => [item.key, item]));
  const LOCKED_PROMPT_IDS = ['prompt-explain', 'prompt-summary', 'prompt-translate', 'prompt-polish', 'prompt-rewrite'];
  const DEFAULT_PROMPTS = [
    { id: 'prompt-explain', title: '解释', icon: '💡', iconKey: 'prompt-explain', template: '请用简单易懂的方式解释下面这段内容：\n\n{{text}}', enabled: true },
    { id: 'prompt-summary', title: '总结', icon: '📝', iconKey: 'prompt-summary', template: '请总结下面这段内容的核心要点：\n\n{{text}}', enabled: true },
    { id: 'prompt-translate', title: '翻译', icon: '🌐', iconKey: 'prompt-translate', template: '请把下面内容翻译成中文，并保留原意：\n\n{{text}}', enabled: true },
    { id: 'prompt-polish', title: '润色', icon: '✨', iconKey: 'prompt-polish', template: '请润色下面这段内容，让表达更清晰自然：\n\n{{text}}', enabled: true },
    { id: 'prompt-rewrite', title: '改写', icon: '✍️', iconKey: 'prompt-rewrite', template: '请在不改变原意的前提下改写下面内容，让表达更自然：\n\n{{text}}', enabled: true },
    { id: 'prompt-article', title: '文章提炼', icon: '📚', iconKey: 'prompt-article', template: '请结合以下上下文提炼关键信息，并给出结构化总结：\n\n选中内容：\n{{text}}\n\n上下文：\n{{context}}\n\n页面标题：{{page}}\n页面地址：{{url}}', enabled: false },
    { id: 'prompt-review', title: '代码审查', icon: '🔍', iconKey: 'prompt-review', template: '请从可读性、潜在问题和改进建议三个方面审查下面这段代码：\n\n{{text}}', enabled: false }
  ];
  const listEl = document.getElementById('pl-list');
  const addBtn = document.getElementById('pl-add-btn');
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
  const editorNote = document.getElementById('pl-editor-note');
  const editorClose = document.getElementById('pl-editor-close');
  const editorCancel = document.getElementById('pl-editor-cancel');
  const editorSave = document.getElementById('pl-editor-save');
  const editorDelete = document.getElementById('pl-editor-delete');
  const confirmMask = document.getElementById('pl-confirm-mask');
  const confirmTitle = document.getElementById('pl-confirm-title');
  const confirmText = document.getElementById('pl-confirm-text');
  const confirmCancel = document.getElementById('pl-confirm-cancel');
  const confirmSubmit = document.getElementById('pl-confirm-submit');
  const openSettingsBtn = document.getElementById('pl-open-settings-btn');
  const openMemoBtn = document.getElementById('pl-open-memo-btn');
  const openCompareBtn = document.getElementById('pl-open-compare-btn');
  const formTitle = document.getElementById('pl-form-title');
  const formIconKey = document.getElementById('pl-form-icon-key');
  const formIconTrigger = document.getElementById('pl-form-icon-trigger');
  const formIconPreview = document.getElementById('pl-form-icon-preview');
  const iconPicker = document.getElementById('pl-icon-picker');
  const formTemplate = document.getElementById('pl-form-template');
  const formEnabled = document.getElementById('pl-form-enabled');
  const previewText = document.getElementById('pl-preview-text');
  const inlineTools = document.querySelector('.pl-inline-tools');
  let prompts = [];
  let keyword = '';
  let dirty = false;
  let editingId = '';
  let iconPickerOpen = false;
  let confirmResolver = null;
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
      iconKey: item.iconKey || item.id,
      template: item.template,
      enabled: item.enabled !== false,
      createdAt: now,
      updatedAt: now
    };
  }

  function getPromptIconOption(key) {
    return PROMPT_ICON_MAP.get(key) || PROMPT_ICON_OPTIONS[0];
  }

  function resolvePromptIconKey(item) {
    if (item?.iconKey && PROMPT_ICON_MAP.has(item.iconKey)) return item.iconKey;
    if (item?.id && PROMPT_ICON_MAP.has(item.id)) return item.id;
    return PROMPT_ICON_OPTIONS[0].key;
  }

  function getPromptIconMarkup(iconKey, alt = '') {
    const option = getPromptIconOption(iconKey);
    return `<img src="${chrome.runtime.getURL(`icons/${option.file}`)}" alt="${escapeHtml(alt || option.label)}" />`;
  }

  function isLockedPrompt(id) {
    return LOCKED_PROMPT_IDS.includes(id);
  }

  function isBuiltInPrompt(id) {
    return DEFAULT_PROMPTS.some((item) => item.id === id);
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
        iconKey: resolvePromptIconKey(item),
        template,
        enabled: isLockedPrompt(id) ? true : item.enabled !== false,
        createdAt: timestamp,
        updatedAt: Number(item.updatedAt) || timestamp
      });
    });
    const mergedMap = new Map(merged.map((item) => [item.id, item]));
    const orderedBuiltins = DEFAULT_PROMPTS.map((item) => mergedMap.get(item.id)).filter(Boolean);
    orderedBuiltins.forEach((item) => mergedMap.delete(item.id));
    return [...orderedBuiltins, ...Array.from(mergedMap.values())];
  }

  function setDirty(nextDirty, text = '') {
    dirty = nextDirty;
    statusText.textContent = text || (dirty ? '有未保存修改' : '已同步');
  }

  function setSavingStatus(text = '正在保存...') {
    statusText.textContent = text;
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
      const haystack = `${item.title} ${item.template} ${item.icon} ${item.iconKey || ''}`.toLowerCase();
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
            <span class="pl-card-icon">${getPromptIconMarkup(item.iconKey, item.title)}</span>
            <div>
              <strong>${escapeHtml(item.title)}</strong>
              <span>更新于 ${formatTime(item.updatedAt)}</span>
            </div>
          </div>
          <div class="pl-card-actions">
            <button class="pl-switch${isLockedPrompt(item.id) ? ' is-locked' : ''}" type="button" data-action="toggle-enabled" data-enabled="${item.enabled ? 'true' : 'false'}" aria-label="${item.enabled ? '停用提示词' : '启用提示词'}" aria-pressed="${item.enabled ? 'true' : 'false'}" title="${isLockedPrompt(item.id) ? '基础提示词不可关闭' : ''}">
              <span class="pl-switch-track"><span class="pl-switch-thumb"></span></span>
            </button>
          </div>
        </div>
        <div class="pl-card-hover-actions">
          <button class="pl-card-icon-button" type="button" data-action="copy" aria-label="复制提示词">
            <img src="../icons/copy.svg" alt="" />
            <span class="pl-card-action-tip">复制</span>
          </button>
          <button class="pl-card-icon-button" type="button" data-action="edit" aria-label="编辑提示词">
            <img src="../icons/edit.svg" alt="" />
            <span class="pl-card-action-tip">编辑</span>
          </button>
          ${isBuiltInPrompt(item.id) ? '' : `
          <button class="pl-card-icon-button" type="button" data-action="delete" aria-label="删除提示词">
            <img src="../icons/delete.svg" alt="" />
            <span class="pl-card-action-tip">删除</span>
          </button>
          `}
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

  function renderIconPicker() {
    const grid = iconPicker?.querySelector('.pl-icon-picker-grid');
    if (!grid) return;
    const selected = formIconKey.value || PROMPT_ICON_OPTIONS[0].key;
    grid.innerHTML = PROMPT_ICON_OPTIONS.map((item) => `
      <button type="button" class="pl-icon-option${item.key === selected ? ' is-active' : ''}" data-icon-key="${item.key}" aria-label="${escapeHtml(item.label)}">
        ${getPromptIconMarkup(item.key, item.label)}
      </button>
    `).join('');
  }

  function updateIconPreview() {
    if (!formIconPreview) return;
    const selected = formIconKey.value || PROMPT_ICON_OPTIONS[0].key;
    formIconPreview.innerHTML = getPromptIconMarkup(selected, getPromptIconOption(selected).label);
  }

  function syncIconPickerPosition() {
    if (!iconPicker || !formIconTrigger || iconPicker.hidden) return;
    const rect = formIconTrigger.getBoundingClientRect();
    const pickerWidth = 248;
    const gap = 10;
    const top = Math.min(window.innerHeight - 180, rect.bottom + gap);
    const left = Math.min(window.innerWidth - pickerWidth - 16, Math.max(16, rect.left));
    iconPicker.style.top = `${Math.max(16, top)}px`;
    iconPicker.style.left = `${left}px`;
  }

  function setIconPickerOpen(open) {
    iconPickerOpen = open;
    if (!iconPicker || !formIconTrigger) return;
    iconPicker.hidden = !open;
    formIconTrigger.setAttribute('aria-expanded', open ? 'true' : 'false');
    renderIconPicker();
    if (open) syncIconPickerPosition();
  }

  function openEditor(id = '') {
    editingId = id;
    const item = prompts.find((prompt) => prompt.id === id);
    const builtIn = isBuiltInPrompt(item?.id);
    editorTitle.textContent = item ? '编辑提示词' : '新建提示词';
    formTitle.value = item?.title || '';
    formIconKey.value = resolvePromptIconKey(item || { id });
    formTemplate.value = item?.template || '';
    formEnabled.checked = item ? item.enabled !== false : true;
    formEnabled.disabled = builtIn || isLockedPrompt(item?.id);
    formEnabled.closest('.pl-checkbox')?.classList.toggle('is-disabled', builtIn || isLockedPrompt(item?.id));
    formTitle.disabled = builtIn;
    formTemplate.disabled = builtIn;
    formIconTrigger.disabled = builtIn;
    editorDelete.hidden = !item || builtIn;
    editorSave.hidden = false;
    editorSave.disabled = builtIn;
    editorNote.hidden = !builtIn;
    inlineTools?.classList.toggle('is-readonly', builtIn);
    editorMask.hidden = false;
    updateIconPreview();
    setIconPickerOpen(false);
    renderPreview();
    setTimeout(() => {
      if (builtIn) {
        editorClose.focus();
        return;
      }
      formTitle.focus();
    }, 0);
  }

  function closeEditor() {
    editingId = '';
    setIconPickerOpen(false);
    formTitle.disabled = false;
    formTemplate.disabled = false;
    formIconTrigger.disabled = false;
    formEnabled.disabled = false;
    formEnabled.closest('.pl-checkbox')?.classList.remove('is-disabled');
    editorSave.hidden = false;
    editorSave.disabled = false;
    editorDelete.hidden = true;
    editorNote.hidden = true;
    inlineTools?.classList.remove('is-readonly');
    editorMask.hidden = true;
  }

  async function upsertPromptFromForm() {
    if (editingId && isBuiltInPrompt(editingId)) {
      return false;
    }
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
        icon: getPromptIconOption(formIconKey.value).fallback,
        iconKey: formIconKey.value || PROMPT_ICON_OPTIONS[0].key,
        template,
        enabled: isLockedPrompt(item.id) ? true : formEnabled.checked,
        updatedAt: now
      } : item);
    } else {
      prompts = [{
        id: makeId(),
        title,
        icon: getPromptIconOption(formIconKey.value).fallback,
        iconKey: formIconKey.value || PROMPT_ICON_OPTIONS[0].key,
        template,
        enabled: formEnabled.checked,
        createdAt: now,
        updatedAt: now
      }, ...prompts];
    }
    prompts = normalize(prompts);
    closeEditor();
    render();
    setSavingStatus('正在保存...');
    await persist('已自动保存');
    return true;
  }

  async function persist(text = '已保存') {
    prompts = normalize(prompts);
    await chrome.storage.local.set({ [STORAGE_KEY]: prompts });
    setDirty(false, text);
    render();
  }

  async function restoreDefaults() {
    const builtInIds = new Set(DEFAULT_PROMPTS.map((item) => item.id));
    const customPrompts = prompts.filter((item) => !builtInIds.has(item.id));
    prompts = normalize([
      ...DEFAULT_PROMPTS.map(createDefaultPrompt),
      ...customPrompts
    ]);
    render();
    setSavingStatus('正在保存...');
    await persist('已恢复内置默认提示词');
  }

  async function copyPromptContent(id) {
    const item = prompts.find((prompt) => prompt.id === id);
    if (!item) return;
    await navigator.clipboard.writeText(item.template).catch(() => {});
    setDirty(dirty, '提示词内容已复制');
  }

  async function togglePrompt(id) {
    if (isLockedPrompt(id)) {
      setDirty(dirty, '基础提示词不可关闭');
      return;
    }
    prompts = prompts.map((item) => item.id === id ? {
      ...item,
      enabled: !item.enabled,
      updatedAt: Date.now()
    } : item);
    render();
    setSavingStatus('正在保存...');
    await persist('已修改启用状态');
  }

  function openConfirmDialog({
    title,
    text,
    confirmTextValue = '删除'
  }) {
    if (!confirmMask || !confirmTitle || !confirmText || !confirmSubmit) {
      return Promise.resolve(false);
    }
    confirmTitle.textContent = title;
    confirmText.textContent = text;
    confirmSubmit.textContent = confirmTextValue;
    confirmMask.hidden = false;
    return new Promise((resolve) => {
      confirmResolver = resolve;
    });
  }

  function closeConfirmDialog(result) {
    if (!confirmMask) return;
    confirmMask.hidden = true;
    const resolver = confirmResolver;
    confirmResolver = null;
    resolver?.(result);
  }

  async function deletePrompt(id) {
    const item = prompts.find((prompt) => prompt.id === id);
    if (!item || isBuiltInPrompt(id)) return;
    const confirmed = await openConfirmDialog({
      title: '删除提示词',
      text: `确认删除提示词“${item.title}”吗？删除后无法恢复。`,
      confirmTextValue: '删除'
    });
    if (!confirmed) return;
    prompts = prompts.filter((prompt) => prompt.id !== id);
    if (editingId === id) {
      closeEditor();
    }
    render();
    setSavingStatus('正在保存...');
    await persist('已删除');
  }

  function parseImport(text) {
    const payload = JSON.parse(text);
    return normalize(toArray(payload));
  }

  addBtn.addEventListener('click', () => {
    openEditor();
  });

  listEl.addEventListener('click', async (event) => {
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
    if (action === 'delete') {
      await deletePrompt(id);
      return;
    }
    if (event.target.closest('[data-action="toggle-enabled"]')) {
      await togglePrompt(id);
    }
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

  resetBtn.addEventListener('click', async () => {
    await restoreDefaults();
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
  editorDelete.addEventListener('click', async () => {
    if (!editingId) return;
    await deletePrompt(editingId);
  });

  confirmCancel?.addEventListener('click', () => closeConfirmDialog(false));
  confirmSubmit?.addEventListener('click', () => closeConfirmDialog(true));
  confirmMask?.addEventListener('click', (event) => {
    if (event.target === confirmMask) closeConfirmDialog(false);
  });

  editorMask.addEventListener('click', (event) => {
    if (event.target === editorMask) closeEditor();
  });
  formIconTrigger?.addEventListener('click', (event) => {
    event.stopPropagation();
    setIconPickerOpen(!iconPickerOpen);
  });
  iconPicker?.addEventListener('click', (event) => {
    const option = event.target.closest('[data-icon-key]');
    if (!option) return;
    formIconKey.value = option.dataset.iconKey || PROMPT_ICON_OPTIONS[0].key;
    updateIconPreview();
    setIconPickerOpen(false);
  });
  window.addEventListener('resize', syncIconPickerPosition);
  window.addEventListener('scroll', syncIconPickerPosition, true);

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
    if (iconPickerOpen && !event.target.closest('.pl-icon-field')) {
      setIconPickerOpen(false);
    }
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
