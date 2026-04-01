(function() {
  if (window.self !== window.top) return; // 不在 iframe 中运行

  const AI_PLATFORMS = {
    doubao: { name: '豆包', url: 'https://www.doubao.com/chat/', icon: `<img src="${chrome.runtime.getURL('assets/doubao.png')}" style="width:24px;height:24px;vertical-align:middle;">`, settingsIcon: `<img src="${chrome.runtime.getURL('assets/doubao.png')}" style="width:32px;height:32px;vertical-align:middle;">` },
    qianwen: { name: '千问', url: 'https://www.qianwen.com/', icon: `<img src="${chrome.runtime.getURL('assets/qianwen.png')}" style="width:24px;height:24px;vertical-align:middle;">`, settingsIcon: `<img src="${chrome.runtime.getURL('assets/qianwen.png')}" style="width:32px;height:32px;vertical-align:middle;">` },
    deepseek: { name: 'DeepSeek', url: 'https://chat.deepseek.com/', icon: `<img src="${chrome.runtime.getURL('assets/deepseek.png')}" style="width:24px;height:24px;vertical-align:middle;">`, settingsIcon: `<img src="${chrome.runtime.getURL('assets/deepseek.png')}" style="width:32px;height:32px;vertical-align:middle;">` },
    yuanbao: { name: '元宝', url: 'https://yuanbao.tencent.com/chat/naQivTmsDa', icon: `<img src="${chrome.runtime.getURL('assets/yuanbao.png')}" style="width:24px;height:24px;vertical-align:middle;">`, settingsIcon: `<img src="${chrome.runtime.getURL('assets/yuanbao.png')}" style="width:32px;height:32px;vertical-align:middle;">` },
    kimi: { name: 'Kimi', url: 'https://kimi.moonshot.cn/', icon: `<img src="${chrome.runtime.getURL('assets/kimi.png')}" style="width:24px;height:24px;vertical-align:middle;">`, settingsIcon: `<img src="${chrome.runtime.getURL('assets/kimi.png')}" style="width:32px;height:32px;vertical-align:middle;">` },
    chatglm: { name: '智谱清言', url: 'https://chatglm.cn/main/alltoolsdetail?lang=zh', icon: `<img src="${chrome.runtime.getURL('assets/chatglm.png')}" style="width:24px;height:24px;vertical-align:middle;">`, settingsIcon: `<img src="${chrome.runtime.getURL('assets/chatglm.png')}" style="width:32px;height:32px;vertical-align:middle;">` },
    chatgpt: { name: 'ChatGPT', url: 'https://chatgpt.com/', icon: `<img src="${chrome.runtime.getURL('assets/chatgpt.png')}" style="width:24px;height:24px;vertical-align:middle;">`, settingsIcon: `<img src="${chrome.runtime.getURL('assets/chatgpt.png')}" style="width:32px;height:32px;vertical-align:middle;">` },
    gemini: { name: 'Gemini', url: 'https://gemini.google.com/', icon: `<img src="${chrome.runtime.getURL('assets/gemini.png')}" style="width:24px;height:24px;vertical-align:middle;">`, settingsIcon: `<img src="${chrome.runtime.getURL('assets/gemini.png')}" style="width:32px;height:32px;vertical-align:middle;">` },
    claude: { name: 'Claude', url: 'https://claude.ai/new', icon: `<img src="${chrome.runtime.getURL('assets/claude.png')}" style="width:24px;height:24px;vertical-align:middle;">`, settingsIcon: `<img src="${chrome.runtime.getURL('assets/claude.png')}" style="width:32px;height:32px;vertical-align:middle;">` },
    perplexity: { name: 'Perplexity', url: 'https://www.perplexity.ai/', icon: `<img src="${chrome.runtime.getURL('assets/perplexity.png')}" style="width:24px;height:24px;vertical-align:middle;">`, settingsIcon: `<img src="${chrome.runtime.getURL('assets/perplexity.png')}" style="width:32px;height:32px;vertical-align:middle;">` },
    copilot: { name: 'Copilot', url: 'https://copilot.microsoft.com/', icon: `<img src="${chrome.runtime.getURL('assets/copilot.png')}" style="width:24px;height:24px;vertical-align:middle;">`, settingsIcon: `<img src="${chrome.runtime.getURL('assets/copilot.png')}" style="width:32px;height:32px;vertical-align:middle;">` },
    grok: { name: 'Grok', url: 'https://grok.com/', icon: `<img src="${chrome.runtime.getURL('assets/grok.png')}" style="width:24px;height:24px;vertical-align:middle;">`, settingsIcon: `<img src="${chrome.runtime.getURL('assets/grok.png')}" style="width:32px;height:32px;vertical-align:middle;">` }
  };

  // 默认配置
  let userConfig = {
    platforms: Object.keys(AI_PLATFORMS).map(key => ({
      id: key,
      enabled: true
    })),
    theme: 'light' // 'light' or 'dark'
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
      <!-- 侧边栏拖拽调整宽度的区域 -->
      <div class="ai-sp-sidebar-resizer"></div>
      
      <!-- 设置页面面板 -->
      <div class="ai-sp-settings-panel" id="ai-sp-settings-panel" style="display: none;">
        <div class="ai-sp-settings-header">
          <button class="ai-sp-settings-back-btn" id="ai-sp-settings-back-btn" title="返回">
            <img src="${chrome.runtime.getURL('icons/settings-back.svg')}" style="width:20px;height:20px;" />
          </button>
          <span>设置</span>
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
        <img src="${chrome.runtime.getURL('icons/icon48.png')}" style="width: 18px; height: 18px; margin-right: 6px;">
        <span style="font-size: 16px; font-weight: 600; color: var(--ai-sp-text);">OmniAI</span>
      </div>
      <div class="ai-sp-header-controls">
        <button id="ai-sp-theme-btn">
          <img class="ai-sp-icon-sun" src="${chrome.runtime.getURL('icons/sun.svg')}" style="width:20px;height:20px;display:${userConfig.theme === 'dark' ? 'block' : 'none'};" />
          <img class="ai-sp-icon-moon" src="${chrome.runtime.getURL('icons/moon.svg')}" style="width:20px;height:20px;display:${userConfig.theme === 'dark' ? 'none' : 'block'};" />
          <span class="ai-sp-tooltip">${userConfig.theme === 'dark' ? '切换浅色模式' : '切换深色模式'}</span>
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
        <button id="ai-sp-settings-btn">
          <img src="${chrome.runtime.getURL('icons/settings.svg')}" style="width:20px;height:20px;" />
          <span class="ai-sp-tooltip">设置</span>
        </button>
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
        setTimeout(() => ensurePlatformBtnVisible(btn), 60);
        setTimeout(() => ensurePlatformBtnVisible(btn), 220);
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
      
      const newConfig = { platforms: [], theme: userConfig.theme };
      
      // 收集平台配置
      const items = platformList.querySelectorAll('.ai-sp-platform-item');
      items.forEach(item => {
        const id = item.dataset.id;
        const enabled = item.querySelector('.ai-sp-platform-toggle').checked;
        newConfig.platforms.push({ id, enabled });
      });
      
      // 更新全局变量
      userConfig = newConfig;
      
      // 同步缓存一份到 localStorage
      localStorage.setItem('aiSearchProLocalConfig', JSON.stringify(newConfig));
      
      // 动态更新 UI 而不销毁现有 iframe，以保留对话记录
      updateUIWithoutReload();
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
              platformUrls[targetPlatform] = `${AI_PLATFORMS[targetPlatform].url}#q=${encodeURIComponent(currentQuery)}`;
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
                 platformUrls[splitSecondaryPlatform] = `${AI_PLATFORMS[splitSecondaryPlatform].url}#q=${encodeURIComponent(currentQuery)}`;
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
    const closeBtn = container.querySelector('#ai-sp-close-btn');
    if(closeBtn) closeBtn.addEventListener('click', closeAll);

    // 初始化主题
    if (userConfig.theme === 'dark') {
      container.setAttribute('data-ai-sp-theme', 'dark');
    } else {
      container.removeAttribute('data-ai-sp-theme');
    }

    // 主题切换事件
    const themeBtn = container.querySelector('#ai-sp-theme-btn');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const isDark = userConfig.theme === 'dark';
        userConfig.theme = isDark ? 'light' : 'dark';
        
        if (userConfig.theme === 'dark') {
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
            try {
              iframe.contentWindow.postMessage({
                type: 'AI_SEARCH_PRO_THEME_CHANGE',
                theme: userConfig.theme
              }, '*');
            } catch(e) {}
          }
        });
        
        // 保存配置
        chrome.storage.local.set({ aiSearchProConfig: userConfig });
        localStorage.setItem('aiSearchProLocalConfig', JSON.stringify(userConfig));
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
          `compare/compare.html#q=${encodeURIComponent(queryText)}&platforms=${encodeURIComponent(comparePlatforms.join(','))}&enabled=${encodeURIComponent(enabledPlatformsList.join(','))}&urls=${encodeURIComponent(JSON.stringify(sessionUrls))}&theme=${encodeURIComponent(userConfig.theme || 'light')}`
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

    // 广播查询给所有启用的 AI
    const triggerGlobalSend = (text) => {
      if (!text) return;
      
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

    // 监听扩展图标点击唤起侧边栏
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'TOGGLE_UI') {
        const isVisible = container.style.display !== 'none' && container.style.opacity !== '0';
        
        if (isVisible) {
          closeAll();
        } else {
          // 强制切换到侧边栏模式
          if (!container.classList.contains('is-sidebar-mode')) {
             switchMode(true);
          } else {
             container.style.display = 'flex';
             container.style.opacity = '1';
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
