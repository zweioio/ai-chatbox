(() => {
  const STORAGE_KEY = 'aiSearchProFavorites';
  const CONFIG_STORAGE_KEY = 'aiSearchProConfig';
  const listEl = document.getElementById('fav-list');
  const listPageEl = document.getElementById('fav-list-page');
  const detailPageEl = document.getElementById('fav-detail-page');
  const detailBodyEl = document.getElementById('fav-detail-body');
  const detailCloseBtn = document.getElementById('fav-detail-close');
  const detailExportBtn = document.getElementById('fav-detail-export');
  const detailDeleteBtn = document.getElementById('fav-detail-delete');
  const widthButtons = Array.from(document.querySelectorAll('.fav-width-btn, .fav-export-width-btn'));
  const exportMask = document.getElementById('fav-export-mask');
  const exportStatus = document.getElementById('fav-export-status');
  const exportPreviewContent = document.getElementById('fav-export-preview-content');
  const exportCloseBtn = document.getElementById('fav-export-close');
  const exportDownloadBtn = document.getElementById('fav-export-download');
  const exportStageEl = document.getElementById('fav-export-stage');
  const openSettingsBtn = document.getElementById('fav-open-settings-btn');
  const openLibraryBtn = document.getElementById('fav-open-library-btn');
  const openCompareBtn = document.getElementById('fav-open-compare-btn');
  const themeMedia = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  let htmlToImageModulePromise = null;
  let favorites = [];
  let activeDetailId = '';
  let readerWidth = localStorage.getItem('aiSearchProMemoReaderWidth') || '760';
  let exportPreviewId = '';
  const confirmDialog = window.AIChatboxConfirmDialog?.createDeleteConfirmDialog({
    iconUrl: '../icons/delete.svg'
  });

  function openPage(path) {
    if (typeof window.__AI_SEARCH_PRO_NAVIGATE === 'function') {
      window.__AI_SEARCH_PRO_NAVIGATE(path);
      return;
    }
    window.location.href = chrome.runtime.getURL(path);
  }

  function loadHtmlToImageModule() {
    if (!htmlToImageModulePromise) {
      htmlToImageModulePromise = import(chrome.runtime.getURL('shared/html_to_image.js'));
    }
    return htmlToImageModulePromise;
  }

  function syncViewState() {
    const showingDetail = Boolean(activeDetailId);
    if (listPageEl) listPageEl.hidden = showingDetail;
    if (detailPageEl) detailPageEl.hidden = !showingDetail;
  }

  function openConfirmDialog() {
    if (!confirmDialog) return Promise.resolve(false);
    return confirmDialog.open();
  }

  function escapeHtml(text) {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizeText(text) {
    return String(text || '').replace(/\r/g, '').trim();
  }

  function deriveFavoriteConversationTitle(text) {
    const normalized = normalizeText(text).replace(/\s+/g, ' ').trim();
    if (!normalized) return '';
    const sentence = normalized.split(/(?<=[。！？!?])\s|[\n\r]+/u).find(Boolean) || normalized;
    return sentence.slice(0, 80).trim();
  }

  function toSafeFileName(text, fallback = '备忘录对话') {
    const normalized = normalizeText(text).replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim();
    return (normalized || fallback).slice(0, 80);
  }

  function extractQueryFromFavoritePanes(item) {
    if (!Array.isArray(item?.panes)) return '';
    for (const pane of item.panes) {
      const urlText = normalizeText(pane?.url || '');
      if (!urlText) continue;
      const hashMatch = urlText.match(/#q=([^&]+)/);
      if (!hashMatch) continue;
      const decoded = normalizeText(decodeURIComponent(hashMatch[1] || ''));
      if (decoded && decoded !== '内容对比') return decoded;
    }
    return '';
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

  async function load() {
    const data = await chrome.storage.local.get([STORAGE_KEY, CONFIG_STORAGE_KEY]);
    applyTheme(data?.[CONFIG_STORAGE_KEY]?.theme);
    const list = Array.isArray(data?.[STORAGE_KEY]) ? data[STORAGE_KEY] : [];
    favorites = list;
    render(list);
    const hash = window.location.hash || '#memo';
    const detailId = hash.startsWith('#detail=')
      ? decodeURIComponent(hash.slice('#detail='.length))
      : '';
    if (detailId) {
      const item = getFavoriteById(detailId);
      if (item) {
        activeDetailId = item.id;
        detailBodyEl.innerHTML = getDetailMarkup(item);
        history.replaceState(null, '', `#detail=${encodeURIComponent(item.id)}`);
      }
    }
    syncViewState();
  }

  function buildMetaText(item) {
    const parts = [new Date(item.createdAt || Date.now()).toLocaleString()];
    if (item.type === 'compare') {
      parts.push('内容对比');
    } else if (item.type === 'session') {
      parts.push(item.sourceLabel || '会话记录');
    }
    if (item.activePlatformName) {
      parts.push(`当前平台：${item.activePlatformName}`);
    }
    return parts.join(' · ');
  }

  function getFavoriteTitle(item) {
    const explicitTitle = normalizeText(item.title);
    if (explicitTitle && !['未命名问题', '未命名备忘录', '内容对比', '会话记录', '内容对比结果'].includes(explicitTitle)) {
      return deriveFavoriteConversationTitle(explicitTitle) || explicitTitle;
    }
    const queryText = normalizeText(item.query);
    if (queryText && queryText !== '内容对比') return deriveFavoriteConversationTitle(queryText) || queryText;
    const firstUserMessage = Array.isArray(item.messages)
      ? item.messages.find((message) => message.role === 'user' && normalizeText(message.content))
      : null;
    if (firstUserMessage) return deriveFavoriteConversationTitle(firstUserMessage.content) || normalizeText(firstUserMessage.content);
    const paneQuery = extractQueryFromFavoritePanes(item);
    if (paneQuery) return deriveFavoriteConversationTitle(paneQuery) || paneQuery;
    const paneSummary = Array.isArray(item.panes)
      ? normalizeText(item.panes.find((pane) => normalizeText(pane?.summary || pane?.markdown || ''))?.summary || item.panes.find((pane) => normalizeText(pane?.summary || pane?.markdown || ''))?.markdown || '')
      : '';
    if (paneSummary) return deriveFavoriteConversationTitle(paneSummary) || paneSummary.slice(0, 80);
    const aiMessageText = Array.isArray(item.messages)
      ? normalizeText(item.messages.find((message) => message.role !== 'user' && normalizeText(message.content))?.content || '')
      : '';
    if (aiMessageText) return deriveFavoriteConversationTitle(aiMessageText) || aiMessageText.slice(0, 80);
    return explicitTitle || '未命名问题';
  }

  function getFavoriteSource(item) {
    const activePlatformName = normalizeText(item.activePlatformName);
    if (activePlatformName) return activePlatformName;
    if (Array.isArray(item.panes) && item.panes.length) {
      const paneSource = normalizeText(item.panes[0]?.platformName || item.panes[0]?.platform || '');
      if (paneSource) return paneSource;
    }
    if (Array.isArray(item.messages) && item.messages.length) {
      const aiMessage = item.messages.find((message) => message.role !== 'user' && normalizeText(message.label));
      const aiLabel = normalizeText(aiMessage?.label || '');
      if (aiLabel && aiLabel !== '内容对比') return aiLabel;
    }
    return normalizeText(item.sourceLabel || '');
  }

  function getRelativeTimeText(timestamp) {
    const diff = Math.max(0, Date.now() - Number(timestamp || Date.now()));
    const minute = 60 * 1000;
    if (diff < minute) return '刚刚';
    if (diff < 30 * minute) return `${Math.floor(diff / minute)} 分钟前`;
    return new Date(timestamp || Date.now()).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  }

  function getFavoriteById(id) {
    return favorites.find((item) => item.id === id) || null;
  }

  function getConversationMessages(item) {
    if (Array.isArray(item.messages) && item.messages.length) {
      return item.messages
        .map((message) => ({
          role: message.role === 'user' ? 'user' : 'ai',
          label: normalizeText(message.label || (message.role === 'user' ? '用户' : 'AI')) || (message.role === 'user' ? '用户' : 'AI'),
          content: normalizeText(message.content || '')
        }))
        .filter((message) => message.content);
    }
    const messages = [];
    const queryText = normalizeText(item.query || item.title || '');
    if (queryText) {
      messages.push({
        role: 'user',
        label: '用户',
        content: queryText
      });
    }
    if (Array.isArray(item.panes) && item.panes.length) {
      item.panes.forEach((pane) => {
        const content = normalizeText(pane.summary || pane.markdown || '');
        if (!content) return;
        messages.push({
          role: 'ai',
          label: pane.platformName || pane.platform || 'AI',
          content
        });
      });
    } else if (normalizeText(item.markdown)) {
      messages.push({
        role: 'ai',
        label: item.type === 'compare' ? '内容对比' : (item.activePlatformName || 'AI'),
        content: normalizeText(item.markdown)
      });
    }
    return messages;
  }

  function getMessageAvatarText(message) {
    if (message.role === 'user') return 'U';
    const label = normalizeText(message.label || 'AI');
    return label.slice(0, 1).toUpperCase();
  }

  function renderRichTextBlocks(text) {
    const content = normalizeText(text);
    if (!content) return '';
    return content
      .split(/\n{2,}/)
      .map((block) => `<p>${escapeHtml(block)}</p>`)
      .join('');
  }

  function getConversationThreadMarkup(item, options = {}) {
    const exportMode = options.mode === 'export';
    const exportWidth = Number(options.exportWidth || readerWidth || 760);
    const exportArticleWidth = Math.max(320, Math.min(exportWidth - 48, 760));
    const exportBubbleWidth = Math.max(280, Math.min(Math.floor(exportWidth * 0.62), 540));
    const messages = getConversationMessages(item);
    const title = escapeHtml(getFavoriteTitle(item));
    const createdDate = new Date(item.createdAt || Date.now()).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const meta = `内容由 AI 生成，不能完全保障真实`;
    const relativeTime = escapeHtml(`${createdDate} ${getRelativeTimeText(item.createdAt)}`);
    const sourceText = normalizeText(getFavoriteSource(item));
    const relativeMarkup = `${relativeTime}${sourceText ? `<span class="fav-thread-source">来源于：${escapeHtml(sourceText)}</span>` : ''}`;
    const emptyText = escapeHtml(item.markdown || '暂无完整内容');
    const messageMarkup = messages.length ? messages.map((message) => `
      <div class="fav-message is-${message.role}">
        ${message.role === 'user' ? `
          <div class="fav-message-bubble">${escapeHtml(message.content)}</div>
        ` : `
          <div class="fav-message-article">${renderRichTextBlocks(message.content)}</div>
        `}
      </div>
    `).join('') : `<div class="fav-detail-empty">${emptyText}</div>`;
    if (!exportMode) {
      return `
        <div class="fav-thread-page">
          <div class="fav-thread-header">
            <h2 class="fav-thread-title">${title}</h2>
            <div class="fav-thread-meta">${meta}</div>
            <div class="fav-thread-relative">${relativeMarkup}</div>
          </div>
          <div class="fav-thread-divider"></div>
          <div class="fav-conversation">${messageMarkup}</div>
        </div>
      `;
    }
    return `
      <div class="fav-export-root" xmlns="http://www.w3.org/1999/xhtml">
        <style>
          .fav-export-root{width:${exportWidth}px;color:#111827;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;box-sizing:border-box;}
          .fav-thread-page{width:100%;background:#ffffff;border-radius:12px;overflow:hidden;}
          .fav-thread-header{padding:24px;background:#ffffff;}
          .fav-thread-title{margin:0;font-size:24px;line-height:1.4;font-weight:600;color:#111827;}
          .fav-thread-meta{margin-top:12px;font-size:12px;line-height:1;color:#a3a3a3;}
          .fav-thread-relative{margin-top:24px;font-size:14px;line-height:1;color:#6b7280;display:flex;align-items:center;justify-content:space-between;gap:16px;}
          .fav-thread-source{flex:0 0 auto;color:#6b7280;}
          .fav-thread-divider{height:1px;background:#e5e7eb;margin:0 24px;}
          .fav-conversation{display:flex;flex-direction:column;gap:24px;padding:24px;}
          .fav-message{display:flex;flex-direction:column;gap:8px;}
          .fav-message.is-user{align-items:flex-end;}
          .fav-message.is-ai{align-items:flex-start;}
          .fav-message-bubble{max-width:${exportBubbleWidth}px;padding:8px 16px;border-radius:12px;background:#f3f4f6;color:#374151;font-size:16px;line-height:1.8;white-space:pre-wrap;word-break:break-word;}
          .fav-message-article{width:100%;max-width:${exportArticleWidth}px;color:#3f3f46;font-size:16px;line-height:2;word-break:break-word;}
          .fav-message-article p{margin:0 0 26px;}
          .fav-message-article p:last-child{margin-bottom:0;}
          .fav-detail-empty{padding:52px 24px;text-align:center;color:#6b7280;font-size:15px;line-height:1.8;}
        </style>
        <div class="fav-thread-page">
          <div class="fav-thread-header">
            <h1 class="fav-thread-title">${title}</h1>
            <div class="fav-thread-meta">${meta}</div>
            <div class="fav-thread-relative">${relativeMarkup}</div>
          </div>
          <div class="fav-thread-divider"></div>
          <div class="fav-conversation">${messageMarkup}</div>
        </div>
      </div>
    `;
  }

  function getDetailMarkup(item) {
    return getConversationThreadMarkup(item, { mode: 'detail' });
  }

  function getExportMarkup(item, exportWidth = readerWidth) {
    return getConversationThreadMarkup(item, { mode: 'export', exportWidth });
  }

  async function renderConversationImageBlob(item, exportWidth = readerWidth) {
    const { toBlob } = await loadHtmlToImageModule();
    exportStageEl.innerHTML = getExportMarkup(item, exportWidth);
    const node = exportStageEl.firstElementChild;
    if (!node) return null;
    const blob = await toBlob(node, {
      pixelRatio: 2,
      cacheBust: true,
      backgroundColor: '#ffffff'
    });
    exportStageEl.innerHTML = '';
    return blob;
  }

  async function downloadConversationImage(item, exportWidth = readerWidth) {
    const pngBlob = await renderConversationImageBlob(item, exportWidth);
    if (!pngBlob) return;
    const filename = `${toSafeFileName(getFavoriteTitle(item), '备忘录对话')}.png`;
    const dataUrl = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(pngBlob);
    });
    const response = await chrome.runtime.sendMessage({
      type: 'DOWNLOAD_DATA_URL',
      url: dataUrl,
      filename,
      saveAs: true
    }).catch(() => null);
    if (response?.ok) return;
    const pngUrl = URL.createObjectURL(pngBlob);
    const link = document.createElement('a');
    link.href = pngUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(pngUrl);
  }

  function renderExportPreview(item) {
    if (!exportPreviewContent) return;
    exportPreviewContent.innerHTML = getExportMarkup(item, readerWidth);
  }

  function openExportPreview(item) {
    exportPreviewId = item.id;
    if (exportStatus) exportStatus.textContent = '正在准备导出预览...';
    renderExportPreview(item);
    if (exportStatus) exportStatus.textContent = '预览生成后可下载图片';
    if (exportMask) exportMask.hidden = false;
  }

  function closeExportPreview() {
    exportPreviewId = '';
    if (exportPreviewContent) exportPreviewContent.innerHTML = '';
    if (exportMask) exportMask.hidden = true;
  }

  function openDetail(item) {
    activeDetailId = item.id;
    detailBodyEl.innerHTML = getDetailMarkup(item);
    syncViewState();
    history.replaceState(null, '', `#detail=${encodeURIComponent(item.id)}`);
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }

  function closeDetail() {
    activeDetailId = '';
    detailBodyEl.innerHTML = '';
    syncViewState();
    history.replaceState(null, '', '#memo');
  }

  async function persistFavorites(nextList) {
    favorites = nextList;
    await chrome.storage.local.set({ [STORAGE_KEY]: nextList });
    render(nextList);
  }

  async function deleteFavorite(id) {
    const item = getFavoriteById(id);
    if (!item) return;
    const confirmed = await openConfirmDialog();
    if (!confirmed) return;
    const next = favorites.filter((entry) => entry.id !== id);
    await persistFavorites(next);
    if (activeDetailId === id) closeDetail();
  }

  function render(list) {
    favorites = list;
    listEl.innerHTML = list.map((item) => `
      <div class="fav-item" data-id="${item.id}">
        <div class="fav-top">
          <strong>${escapeHtml(getFavoriteTitle(item))}</strong>
          <div class="fav-meta">${buildMetaText(item)}</div>
          <div class="fav-preview"><div class="fav-preview-line">${escapeHtml((item.query || item.markdown || '暂无可预览内容').slice(0, 600))}</div></div>
        </div>
      </div>
    `).join('') || '<div class="fav-item">暂无备忘录内容</div>';
  }

  listEl.addEventListener('click', (event) => {
    const itemEl = event.target.closest('.fav-item');
    const id = itemEl?.dataset.id;
    if (!id) return;
    const item = favorites.find((entry) => entry.id === id);
    if (!item) return;
    openDetail(item);
  });

  detailCloseBtn?.addEventListener('click', closeDetail);
  detailExportBtn?.addEventListener('click', async () => {
    const item = getFavoriteById(activeDetailId);
    if (!item) return;
    openExportPreview(item);
  });
  detailDeleteBtn?.addEventListener('click', async () => {
    if (!activeDetailId) return;
    await deleteFavorite(activeDetailId);
  });
  exportCloseBtn?.addEventListener('click', closeExportPreview);
  exportMask?.addEventListener('click', (event) => {
    if (event.target === exportMask) closeExportPreview();
  });
  exportDownloadBtn?.addEventListener('click', async () => {
    const item = getFavoriteById(exportPreviewId || activeDetailId);
    if (!item) return;
    if (exportStatus) exportStatus.textContent = '正在生成图片...';
    try {
      await downloadConversationImage(item, readerWidth);
      if (exportStatus) exportStatus.textContent = '图片已准备下载';
    } catch (error) {
      if (exportStatus) exportStatus.textContent = '导出失败，请重试';
    }
  });

  function applyReaderWidth(nextWidth) {
    readerWidth = ['480', '760', '920'].includes(String(nextWidth)) ? String(nextWidth) : '760';
    detailPageEl?.style.setProperty('--fav-reader-width', `${readerWidth}px`);
    localStorage.setItem('aiSearchProMemoReaderWidth', readerWidth);
    widthButtons.forEach((button) => {
      button.classList.toggle('is-active', button.dataset.readerWidth === readerWidth);
    });
    const exportItem = getFavoriteById(exportPreviewId);
    if (exportItem) {
      renderExportPreview(exportItem);
    }
  }

  widthButtons.forEach((button) => {
    button.addEventListener('click', () => {
      applyReaderWidth(button.dataset.readerWidth);
    });
  });

  openSettingsBtn?.addEventListener('click', () => openPage('settings/settings.html'));
  openLibraryBtn?.addEventListener('click', () => openPage('prompt-library/prompt_library.html'));
  openCompareBtn?.addEventListener('click', () => openPage('compare/compare.html'));

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes[CONFIG_STORAGE_KEY]?.newValue) {
      applyTheme(changes[CONFIG_STORAGE_KEY].newValue.theme);
    }
    if (changes[STORAGE_KEY]?.newValue) {
      const nextList = Array.isArray(changes[STORAGE_KEY].newValue) ? changes[STORAGE_KEY].newValue : [];
      favorites = nextList;
      render(nextList);
      if (activeDetailId) {
        const item = getFavoriteById(activeDetailId);
        if (item) {
          detailBodyEl.innerHTML = getDetailMarkup(item);
        } else {
          closeDetail();
        }
      }
    }
  });
  themeMedia?.addEventListener?.('change', async () => {
    const data = await chrome.storage.local.get([CONFIG_STORAGE_KEY]);
    if (data?.[CONFIG_STORAGE_KEY]?.theme === 'auto') applyTheme('auto');
  });

  window.addEventListener('hashchange', () => {
    const hash = window.location.hash || '#memo';
    if (!hash.startsWith('#detail=')) {
      closeDetail();
      return;
    }
    const id = decodeURIComponent(hash.slice('#detail='.length));
    const item = getFavoriteById(id);
    if (!item) {
      closeDetail();
      return;
    }
    activeDetailId = item.id;
    detailBodyEl.innerHTML = getDetailMarkup(item);
    syncViewState();
  });

  applyReaderWidth(readerWidth);

  load();
})();
