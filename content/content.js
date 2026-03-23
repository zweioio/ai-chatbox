(function() {
  if (window.self !== window.top) return; // 不在 iframe 中运行

  const AI_PLATFORMS = {
    doubao: { name: '豆包', url: 'https://www.doubao.com/chat/', icon: '👩‍💻' },
    qianwen: { name: '千问', url: 'https://www.qianwen.com/', icon: '🔍' },
    deepseek: { name: 'DeepSeek', url: 'https://chat.deepseek.com/', icon: '🚀' },
    kimi: { name: 'Kimi', url: 'https://kimi.moonshot.cn/', icon: '🌟' },
    chatglm: { name: '智谱清言', url: 'https://chatglm.cn/', icon: '💡' },
    chatgpt: { name: 'ChatGPT', url: 'https://chatgpt.com/', icon: '🤖' },
    gemini: { name: 'Gemini', url: 'https://gemini.google.com/', icon: '✨' },
    claude: { name: 'Claude', url: 'https://claude.ai/new', icon: '🧠' },
    perplexity: { name: 'Perplexity', url: 'https://www.perplexity.ai/', icon: '🔎' },
    copilot: { name: 'Copilot', url: 'https://copilot.microsoft.com/', icon: '💬' },
    grok: { name: 'Grok', url: 'https://grok.com/', icon: '✖️' }
  };

  // 默认配置
  let userConfig = {
    platforms: Object.keys(AI_PLATFORMS).map(key => ({
      id: key,
      enabled: true
    }))
  };

  let currentPlatform = 'doubao';
  let isSidebarOpen = false;
  let isResizing = false;
  let activeAiUrl = ''; // 保存当前活跃对话的 URL

  // 拦截搜索引擎首页的搜索事件，只有在表单提交（回车或点击搜索按钮）时才记录并传递搜索词
  function initSearchInterception() {
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

  // 提取创建 UI 的核心逻辑，允许在配置加载前先渲染默认外壳
  function renderInitialUI() {
    if (document.getElementById('ai-sp-container')) return;

    // 获取搜索词（同步）
    const query = getSearchQuery();
    if (!query) return;

    // 先用默认配置渲染外壳，保证小窗秒出
    createUI(query, userConfig.platforms.filter(p => p.enabled).map(p => p.id));
  }

  // 修改 createUI 接收 query 和 enabledPlatformsList 参数
  function createUI(query, enabledPlatforms) {
    if (document.getElementById('ai-sp-container')) return;

    if (enabledPlatforms.length === 0) {
        console.warn('OmniAI Search: No platforms enabled');
        return;
      }
    
    // 如果当前平台被禁用了，则切换到第一个启用的平台
    if (!enabledPlatforms.includes(currentPlatform)) {
      currentPlatform = enabledPlatforms[0];
    }

    // --- 1. 创建统一的容器外壳 ---
    const container = document.createElement('div');
    container.id = 'ai-sp-container';
    // 默认是小窗模式
    container.className = 'is-floating-mode';
    
    // 记录每个平台对应的 iframe 是否已经加载过
    const loadedPlatforms = {};
    const platformUrls = {};
    
    // 立即加载所有已启用的平台，实现统一并发发送
    enabledPlatforms.forEach(platformKey => {
      loadedPlatforms[platformKey] = true;
      platformUrls[platformKey] = `${AI_PLATFORMS[platformKey].url}#q=${encodeURIComponent(query)}`;
    });

    container.innerHTML = `
      <div class="ai-sp-sidebar-resizer"></div>
      
      <!-- 设置页面面板 -->
      <div class="ai-sp-settings-panel" id="ai-sp-settings-panel" style="display: none;">
        <div class="ai-sp-settings-header">
          <button class="ai-sp-settings-back-btn" id="ai-sp-settings-back-btn" title="返回">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
          </button>
          <span>设置</span>
        </div>
        <div class="ai-sp-settings-content">
          <div class="ai-sp-settings-section-title">AI 助手管理 (拖拽排序)</div>
          <div class="ai-sp-platform-list" id="ai-sp-platform-list">
            ${userConfig.platforms.map(p => {
              if(!AI_PLATFORMS[p.id]) return '';
              const data = AI_PLATFORMS[p.id];
              return `
                <div class="ai-sp-platform-item" data-id="${p.id}" draggable="true">
                  <div class="ai-sp-platform-drag-handle">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="9" x2="20" y2="9"></line><line x1="4" y1="15" x2="20" y2="15"></line></svg>
                  </div>
                  <div class="ai-sp-platform-info">
                    <span>${data.icon}</span>
                    <span>${data.name}</span>
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
        <div class="ai-sp-settings-footer">
          <button class="ai-sp-settings-save-btn" id="ai-sp-settings-save-btn">保存并应用</button>
        </div>
      </div>
      
      <div class="ai-sp-header">
        <div class="ai-sp-title">
          <div class="ai-sp-drag-handle" title="按住拖拽">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="5" r="1"></circle><circle cx="9" cy="12" r="1"></circle><circle cx="9" cy="19" r="1"></circle><circle cx="15" cy="5" r="1"></circle><circle cx="15" cy="12" r="1"></circle><circle cx="15" cy="19" r="1"></circle></svg>
          </div>
          <span class="ai-sp-logo">✦</span>
          OmniAI
        </div>
        <div class="ai-sp-header-controls">
          <button id="ai-sp-web-btn" title="在网页打开">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
          </button>
          <button id="ai-sp-toggle-mode-btn" title="在侧边栏打开">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="15" y1="3" x2="15" y2="21"></line></svg>
          </button>
          <button id="ai-sp-settings-btn" title="设置">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
          </button>
          <button id="ai-sp-close-btn" title="关闭">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
      </div>

      <!-- 全局快捷 Prompt & 输入区域 -->
      <div class="ai-sp-global-input-container" style="padding: 10px; border-bottom: 1px solid var(--ai-sp-border, #e5e7eb); background: var(--ai-sp-bg, #ffffff); display: flex; flex-direction: column; gap: 8px;">
        <div class="ai-sp-quick-prompts" style="display: flex; gap: 6px; overflow-x: auto; white-space: nowrap; padding-bottom: 2px; scrollbar-width: none; -ms-overflow-style: none;">
          <style>.ai-sp-quick-prompts::-webkit-scrollbar { display: none; }</style>
          <span class="ai-sp-prompt-tag" data-prompt="请帮我翻译以下内容：" style="font-size: 12px; background: #e0f2fe; color: #1d4ed8; padding: 4px 8px; border-radius: 12px; cursor: pointer; user-select: none;">翻译</span>
          <span class="ai-sp-prompt-tag" data-prompt="请总结以下内容的核心观点：" style="font-size: 12px; background: #dcfce7; color: #0369a1; padding: 4px 8px; border-radius: 12px; cursor: pointer; user-select: none;">总结</span>
          <span class="ai-sp-prompt-tag" data-prompt="请帮我润色这段文字，使其更专业：" style="font-size: 12px; background: #f3e8ff; color: #15803d; padding: 4px 8px; border-radius: 12px; cursor: pointer; user-select: none;">润色</span>
          <span class="ai-sp-prompt-tag" data-prompt="请详细解释一下：" style="font-size: 12px; background: #ffedd5; color: #7e22ce; padding: 4px 8px; border-radius: 12px; cursor: pointer; user-select: none;">解释</span>
          <span class="ai-sp-prompt-tag" data-prompt="请帮我写一段代码，实现：" style="font-size: 12px; background: #fee2e2; color: #b91c1c; padding: 4px 8px; border-radius: 12px; cursor: pointer; user-select: none;">写代码</span>
        </div>
        <div style="display: flex; gap: 8px;">
          <input type="text" id="ai-sp-global-input" placeholder="追加提问或输入新搜索词..." style="flex: 1; padding: 6px 10px; border: 1px solid var(--ai-sp-border, #d1d5db); border-radius: 6px; font-size: 13px; outline: none; background: transparent; color: var(--ai-sp-text, #374151);">
          <button id="ai-sp-global-send-btn" style="padding: 6px 12px; background: #3b82f6; color: white; border: none; border-radius: 6px; font-size: 13px; cursor: pointer; transition: background 0.2s;">统一发送</button>
        </div>
      </div>

      <div class="ai-sp-platforms">
        ${enabledPlatforms.map(key => {
          const data = AI_PLATFORMS[key];
          return `
          <button class="ai-sp-platform-btn ${currentPlatform === key ? 'active' : ''}" data-platform="${key}">
            <span class="ai-sp-platform-icon">${data.icon}</span>
            ${data.name}
          </button>
        `}).join('')}
      </div>
      <div class="ai-sp-iframe-content-area" style="position: relative; width: 100%; height: 100%; overflow: hidden;">
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
        
        // 点击后让当前按钮滚动到可视区域内居中
        btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      });
    });

    // 侧边栏/小窗 切换逻辑
    let isSwitching = false;
    
    function switchMode(toSidebar) {
      if (isSwitching) return;
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
          if(toggleBtn) {
            toggleBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg>`;
            toggleBtn.title = "在小窗打开";
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
            toggleBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="15" y1="3" x2="15" y2="21"></line></svg>`;
            toggleBtn.title = "在侧边栏打开";
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
        const isSidebarMode = container.classList.contains('is-sidebar-mode');
        switchMode(!isSidebarMode);
      });
    }

    // 设置
    const settingsPanel = container.querySelector('#ai-sp-settings-panel');
    const settingsBtn = container.querySelector('#ai-sp-settings-btn');
    const settingsBackBtn = container.querySelector('#ai-sp-settings-back-btn');
    const settingsSaveBtn = container.querySelector('#ai-sp-settings-save-btn');

    // 生成平台列表 HTML 的辅助函数
    function renderSettingsPlatformList() {
      if (!platformList) return;
      platformList.innerHTML = userConfig.platforms.map(p => {
        if(!AI_PLATFORMS[p.id]) return '';
        const data = AI_PLATFORMS[p.id];
        return `
          <div class="ai-sp-platform-item" data-id="${p.id}" draggable="true">
            <div class="ai-sp-platform-drag-handle">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="9" x2="20" y2="9"></line><line x1="4" y1="15" x2="20" y2="15"></line></svg>
            </div>
            <div class="ai-sp-platform-info">
              <span>${data.icon}</span>
              <span>${data.name}</span>
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
      settingsBtn.addEventListener('click', () => {
        // 打开时恢复最新的配置状态
        renderSettingsPlatformList();
        settingsPanel.style.display = 'flex';
      });
    }

    if(settingsBackBtn) {
      settingsBackBtn.addEventListener('click', () => {
        settingsPanel.style.display = 'none';
      });
    }

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
      
      const newConfig = { platforms: [] };
      const items = platformList.querySelectorAll('.ai-sp-platform-item');
      
      items.forEach(item => {
        const id = item.dataset.id;
        const enabled = item.querySelector('.ai-sp-platform-toggle').checked;
        newConfig.platforms.push({ id, enabled });
      });
      
      // 更新全局变量
      userConfig = newConfig;
      
      // 同步缓存一份到 localStorage，保证下次刷新页面能瞬间（同步）读取到最新配置
      localStorage.setItem('aiSearchProLocalConfig', JSON.stringify(newConfig));
      
      // 保存到 chrome.storage (用于多标签页和插件层面的持久化同步)
      chrome.storage.local.set({ aiSearchProConfig: userConfig }, () => {
        // 动态更新 UI 而不销毁现有 iframe，以保留对话记录
        updateUIWithoutReload();
      });
    }

    // 动态更新 UI 辅助函数
    function updateUIWithoutReload() {
      const enabledPlatformsList = userConfig.platforms
        .filter(p => p.enabled && AI_PLATFORMS[p.id])
        .map(p => p.id);

      if (enabledPlatformsList.length === 0) return; // 至少保留一个，否则不处理
      
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
            <span class="ai-sp-platform-icon">${data.icon}</span>
            ${data.name}
          </button>
        `}).join('');
        
        // 重新绑定 Tab 点击事件
        bindPlatformTabEvents();
      }

      // 2. 动态管理 iframe 容器
      const contentArea = container.querySelector('.ai-sp-iframe-content-area');
      if (contentArea) {
        // 隐藏/显示/创建 iframe 容器
        Object.keys(AI_PLATFORMS).forEach(platformKey => {
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
                  platformUrls[platformKey] = `${AI_PLATFORMS[platformKey].url}#q=${encodeURIComponent(currentQuery)}`;
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

          // 更新按钮状态
          container.querySelectorAll('.ai-sp-platform-btn').forEach(b => b.classList.remove('active'));
          newBtn.classList.add('active');

          // 隐藏当前 iframe，显示新的 iframe
          const oldContainer = document.getElementById(`ai-sp-container-${currentPlatform}`);
          const newContainer = document.getElementById(`ai-sp-container-${targetPlatform}`);
          const newIframe = document.getElementById(`ai-sp-iframe-${targetPlatform}`);
          const newLoading = document.getElementById(`ai-sp-loading-${targetPlatform}`);
          
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
          if (!loadedPlatforms[targetPlatform] && newIframe) {
            const currentQuery = getSearchQuery();
            if (currentQuery) {
              platformUrls[targetPlatform] = `${AI_PLATFORMS[targetPlatform].url}#q=${encodeURIComponent(currentQuery)}`;
              newIframe.style.opacity = '0';
              if (newLoading) newLoading.style.display = 'flex';
              newIframe.src = platformUrls[targetPlatform];
              loadedPlatforms[targetPlatform] = true;
            }
          }

          currentPlatform = targetPlatform;
          
          // 点击后让当前按钮滚动到可视区域内居中
          newBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        });
      });
    }

    // 关闭：仅仅隐藏当前容器
    const closeAll = () => {
      container.style.display = 'none';
      adjustPageLayout();
    };
    const closeBtn = container.querySelector('#ai-sp-close-btn');
    if(closeBtn) closeBtn.addEventListener('click', closeAll);

    // 网页打开
    const openWeb = () => {
      const targetUrl = platformUrls[currentPlatform] || AI_PLATFORMS[currentPlatform].url;
      window.open(targetUrl, '_blank');
    };
    const webBtn = container.querySelector('#ai-sp-web-btn');
    if(webBtn) webBtn.addEventListener('click', openWeb);

    // --- 全局快捷 Prompt & 输入处理 ---
    const globalInput = container.querySelector('#ai-sp-global-input');
    const globalSendBtn = container.querySelector('#ai-sp-global-send-btn');
    const promptTags = container.querySelectorAll('.ai-sp-prompt-tag');

    // 点击 prompt tag 自动填入
    promptTags.forEach(tag => {
      tag.addEventListener('click', () => {
        const promptText = tag.dataset.prompt;
        if (globalInput) {
          globalInput.value = promptText + ' ' + globalInput.value;
          globalInput.focus();
        }
      });
    });

    // 触发全局发送的方法
    const triggerGlobalSend = (forceQuery) => {
      const text = typeof forceQuery === 'string' ? forceQuery : (globalInput ? globalInput.value.trim() : '');
      if (!text) return;
      
      if (globalInput) globalInput.value = ''; // 发送后清空
      
      const enabledPlatformsList = userConfig.platforms
        .filter(p => p.enabled && AI_PLATFORMS[p.id])
        .map(p => p.id);
        
      enabledPlatformsList.forEach(platformKey => {
        const iframe = document.getElementById(`ai-sp-iframe-${platformKey}`);
        if (iframe) {
          if (loadedPlatforms[platformKey]) {
            try {
              iframe.contentWindow.postMessage({
                type: 'AI_SEARCH_PRO_NEW_QUERY',
                query: text
              }, '*');
            } catch(e) {
              console.warn('postMessage failed', e);
            }
          } else {
            const loading = document.getElementById(`ai-sp-loading-${platformKey}`);
            const newUrl = `${AI_PLATFORMS[platformKey].url}#q=${encodeURIComponent(text)}`;
            platformUrls[platformKey] = newUrl;
            iframe.style.opacity = '0';
            if (loading) loading.style.display = 'flex';
            iframe.src = platformUrls[platformKey];
            loadedPlatforms[platformKey] = true;
          }
        }
      });
    };

    if (globalSendBtn) {
      globalSendBtn.addEventListener('click', () => triggerGlobalSend());
    }
    if (globalInput) {
      globalInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          triggerGlobalSend();
        }
      });
    }

    // 将方法暴露给 window，方便右键菜单直接调用
    window.__aiSearchProBroadcastQuery = triggerGlobalSend;
    window.__aiSearchProToggleUI = (forceShow) => {
      const isVisible = container.style.display !== 'none' && container.style.opacity !== '0';
      if (isVisible && !forceShow) {
        closeAll();
      } else {
        container.style.display = 'flex';
        container.style.opacity = '1';
        if (!container.classList.contains('is-sidebar-mode')) {
          updateFloatingWindowPosition();
        } else {
          adjustPageLayout();
        }
      }
    };

    // 监听 URL / 搜索词变化 (只针对原生搜索引擎的输入)
    let lastUrlQuery = getSearchQuery() || query;
    setInterval(() => {
      const currentQuery = getSearchQuery();
      
      if (!currentQuery) return;

      if (!document.getElementById('ai-sp-container')) {
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
        
        triggerGlobalSend(currentQuery);
      }
    }, 1000);

    // 监听扩展图标点击唤起侧边栏或小窗
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'TOGGLE_UI') {
        const isVisible = container.style.display !== 'none' && container.style.opacity !== '0';
        
        if (isVisible) {
          closeAll();
        } else {
          container.style.display = 'flex';
          container.style.opacity = '1';
          if (!container.classList.contains('is-sidebar-mode')) {
            updateFloatingWindowPosition();
          } else {
            adjustPageLayout();
          }
        }
        sendResponse({status: "ok"});
      }
    });

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
        } else if (event.data.type === 'AI_SEARCH_PRO_URL_SYNC') {
          // 查找是哪个平台的 iframe 发来的消息
          const iframes = document.querySelectorAll('.ai-sp-iframe-container iframe');
          iframes.forEach(iframe => {
            if (iframe.contentWindow === event.source) {
              const platform = iframe.dataset.platform;
              if (platform) {
                platformUrls[platform] = event.data.url;
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
    }, 10000);

  }

  // 立即执行拦截
  initSearchInterception();

  // 全局暴露一个触发查询的方法，方便外部调用（如右键菜单、全局输入框）
  window.__aiSearchProBroadcastQuery = null;
  window.__aiSearchProToggleUI = null;

  // 监听扩展后台的消息（右键菜单、图标点击）
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'TOGGLE_UI') {
      if (window.__aiSearchProToggleUI) {
        window.__aiSearchProToggleUI();
      } else {
        createUI('', userConfig.platforms.filter(p => p.enabled).map(p => p.id));
      }
      sendResponse({status: "ok"});
    } else if (request.action === 'SEARCH_FROM_CONTEXT_MENU') {
      const text = request.text;
      if (window.__aiSearchProBroadcastQuery) {
        window.__aiSearchProToggleUI(true); // 强制显示
        window.__aiSearchProBroadcastQuery(text);
      } else {
        createUI(text, userConfig.platforms.filter(p => p.enabled).map(p => p.id));
      }
      sendResponse({status: "ok"});
    }
  });

  // 初始化
  function init() {
    // 0. 最高优先级：尝试从 localStorage 同步读取用户配置缓存，确保首屏渲染就是最新排序
    const localConfigStr = localStorage.getItem('aiSearchProLocalConfig');
    if (localConfigStr) {
      try {
        const localConfig = JSON.parse(localConfigStr);
        if (localConfig && localConfig.platforms) {
          // 合并逻辑：防止代码里新增了平台但缓存里没有
          const allPlatformKeys = Object.keys(AI_PLATFORMS);
          const mergedPlatforms = localConfig.platforms.filter(p => allPlatformKeys.includes(p.id));
          const existingIds = mergedPlatforms.map(p => p.id);
          allPlatformKeys.forEach(key => {
            if (!existingIds.includes(key)) {
              mergedPlatforms.push({ id: key, enabled: true });
            }
          });
          userConfig.platforms = mergedPlatforms;
        }
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
        // 合并新老配置，防止代码里新增了平台但本地存储里没有
        const savedConfig = result.aiSearchProConfig;
        const allPlatformKeys = Object.keys(AI_PLATFORMS);
        
        // 保留已保存的排序和状态
        const mergedPlatforms = savedConfig.platforms.filter(p => allPlatformKeys.includes(p.id));
        
        // 找出本地存储里没有的新平台（比如代码更新了新平台）
        const existingIds = mergedPlatforms.map(p => p.id);
        allPlatformKeys.forEach(key => {
          if (!existingIds.includes(key)) {
            mergedPlatforms.push({ id: key, enabled: true });
          }
        });
        
        userConfig.platforms = mergedPlatforms;
        
        // 配置加载完毕后，如果不一致，则无感更新 UI
        if (document.getElementById('ai-sp-container')) {
           updateUIWithoutReload();
        }
      }
    });
  }

  init();
})();