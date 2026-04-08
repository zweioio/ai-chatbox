(() => {
  const STORAGE_KEY = 'aiSearchProFavorites';
  const listEl = document.getElementById('fav-list');
  const openSettingsBtn = document.getElementById('fav-open-settings-btn');
  const openLibraryBtn = document.getElementById('fav-open-library-btn');
  const openCompareBtn = document.getElementById('fav-open-compare-btn');

  function openPage(path) {
    window.location.href = chrome.runtime.getURL(path);
  }

  function downloadMarkdown(title, content) {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(title || '备忘录内容').slice(0, 24)}.md`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function load() {
    const data = await chrome.storage.local.get([STORAGE_KEY]);
    const list = Array.isArray(data?.[STORAGE_KEY]) ? data[STORAGE_KEY] : [];
    render(list);
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

  function render(list) {
    listEl.innerHTML = list.map((item) => `
      <div class="fav-item" data-id="${item.id}">
        <div class="fav-top">
          <strong>${item.title || '未命名问题'}</strong>
          <div class="fav-actions">
            <button data-action="export">导出 Markdown</button>
            <button data-action="delete">删除</button>
          </div>
        </div>
        <div class="fav-meta">${buildMetaText(item)}</div>
        <div class="fav-preview">${(item.markdown || '暂无可预览内容').slice(0, 600)}</div>
      </div>
    `).join('') || '<div class="fav-item">暂无备忘录内容</div>';
  }

  listEl.addEventListener('click', async (event) => {
    const btn = event.target.closest('button');
    if (!btn) return;
    const itemEl = btn.closest('.fav-item');
    const id = itemEl?.dataset.id;
    if (!id) return;
    const data = await chrome.storage.local.get([STORAGE_KEY]);
    const list = Array.isArray(data?.[STORAGE_KEY]) ? data[STORAGE_KEY] : [];
    const item = list.find((entry) => entry.id === id);
    if (!item) return;
    if (btn.dataset.action === 'export') {
      downloadMarkdown(item.title, item.markdown || '');
      return;
    }
    if (btn.dataset.action === 'delete') {
      const next = list.filter((entry) => entry.id !== id);
      await chrome.storage.local.set({ [STORAGE_KEY]: next });
      render(next);
    }
  });

  openSettingsBtn?.addEventListener('click', () => openPage('settings/settings.html'));
  openLibraryBtn?.addEventListener('click', () => openPage('prompt-library/prompt_library.html'));
  openCompareBtn?.addEventListener('click', () => openPage('compare/compare.html'));

  load();
})();
