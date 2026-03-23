(function() {
  // 只在 iframe 中运行
  if (window === window.top) return;

  let hasInjected = false;
  
  // 用于向父窗口同步当前的真实 URL (包含会话ID)
  function syncUrlToParent() {
    window.parent.postMessage({ 
      type: 'AI_SEARCH_PRO_URL_SYNC', 
      url: window.location.href 
    }, '*');
  }

  // 监听 URL 变化 (SPA 路由变化)
  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      syncUrlToParent();
    }
  }).observe(document, {subtree: true, childList: true});

  function getQueryFromHash() {
    const hash = window.location.hash;
    if (hash.startsWith('#q=')) {
      return decodeURIComponent(hash.substring(3));
    }
    return '';
  }

  function injectQuery() {
    if (hasInjected) return;
    
    const query = getQueryFromHash();
    if (!query) return;

    // 防止同一个词重复发送（比如页面刷新时）
    const storageKey = `ai_sp_last_query_${window.location.hostname}`;
    const lastQuery = sessionStorage.getItem(storageKey);
    if (lastQuery === query) {
      hasInjected = true;
      window.parent.postMessage({ type: 'AI_SEARCH_PRO_LOADED' }, '*');
      syncUrlToParent();
      return;
    }

    const host = window.location.hostname;
    
    // --- 注入 CSS 隐藏各种烦人的侧边栏、弹窗 ---
    const styleId = 'ai-sp-injected-style';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      let css = '';
      if (host.includes('deepseek.com')) {
        // DeepSeek：隐藏对话框弹窗和侧边栏
        css += `
          [role="dialog"] { display: none !important; opacity: 0 !important; pointer-events: none !important; }
        `;
      } else if (host.includes('qianwen.com') || host.includes('tongyi.aliyun.com')) {
        // Qianwen：隐藏侧边栏
        css += `
          .layout-sider { display: none !important; width: 0 !important; }
          .layout-content { width: 100% !important; max-width: 100% !important; }
        `;
      }
      style.innerHTML = css;
      if (document.head) document.head.appendChild(style);
    }

    // --- 强力轮询去弹窗 (DeepSeek 特别顽固) ---
    if (host.includes('deepseek.com')) {
      setInterval(() => {
        const dialogs = document.querySelectorAll('[role="dialog"]');
        dialogs.forEach(d => {
          if (d.style.display !== 'none') {
            d.style.setProperty('display', 'none', 'important');
          }
        });
      }, 200);
    }

    // 针对不同平台的选择器适配
    let inputSelector = 'textarea';
    let btnSelectors = [
      'button[type="submit"]',
      'button[aria-label*="send" i]',
      'button[aria-label*="发送"]',
      '.send-button',
      'button[class*="send" i]',
      'div[role="button"]:has(svg)'
    ];

    if (host.includes('doubao.com')) {
      inputSelector = 'textarea[data-testid="chat_input_input"]';
      btnSelectors = ['button[data-testid="chat_input_send_button"]', 'button[data-testid="send_button"]'];
    } else if (host.includes('chatgpt.com')) {
      inputSelector = '#prompt-textarea';
      btnSelectors = ['button[data-testid="send-button"]'];
    } else if (host.includes('qianwen.com') || host.includes('tongyi.aliyun.com')) {
      inputSelector = 'textarea, div[data-slate-editor="true"][contenteditable="true"]';
      btnSelectors = ['div[class*="operateBtn"]', 'button[aria-label*="发送"]', 'button[aria-label*="Send"]', 'button[class*="send"]', 'button[type="submit"]'];
    } else if (host.includes('deepseek.com')) {
      inputSelector = '#chat-input, textarea';
      btnSelectors = ['button[aria-label*="Send"]', 'button[aria-label*="发送"]', 'button[class*="send"]', 'div[role="button"]:has(svg)', 'button[type="submit"]']; // DeepSeek 发送按钮
    } else if (host.includes('kimi.moonshot.cn') || host.includes('kimi.com')) {
      inputSelector = 'div[contenteditable="true"]';
      btnSelectors = ['button[class*="sendButton"]', 'button[class*="send-button"]', 'button[aria-label*="发送"]', 'button[aria-label*="Send"]', 'button[type="submit"]'];
    }

    // 寻找输入框
    let inputEl = null;
    const selectors = inputSelector.split(',').map(s => s.trim());
    for (const selector of selectors) {
      inputEl = document.querySelector(selector);
      if (inputEl) break;
    }
    if (inputEl) {
      // 激活输入框
      inputEl.focus();

      // 填充内容
      if (inputEl.isContentEditable) {
        // Kimi 等使用 contenteditable 的输入框
        // 先全选可能已有的内容
        document.execCommand('selectAll', false, null);
        document.execCommand('insertText', false, query);
      } else {
        // textarea 等原生输入框
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
        if (nativeInputValueSetter) {
           nativeInputValueSetter.call(inputEl, query);
        } else {
           inputEl.value = query;
        }
      }
      
      // 触发各类框架依赖的事件
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
      inputEl.dispatchEvent(new Event('change', { bubbles: true }));
      // 触发 compositionend 处理千问等中文输入法状态
      inputEl.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));

      // 对于基于 React/Vue 的富文本编辑器（如某些平台的 contenteditable），还需要抛出 InputEvent
      if (inputEl.isContentEditable) {
        // 先确保内容真的变了
        if (inputEl.textContent !== query) {
            inputEl.textContent = query;
        }
        inputEl.dispatchEvent(new InputEvent("input", {
          bubbles: true,
          cancelable: true,
          inputType: "insertText",
          data: query
        }));
      }

      // 统一使用双重保障机制：优先尝试点击发送按钮，如果找不到按钮或者按钮无效，则兜底使用模拟回车发送
      setTimeout(() => {
        const markDone = () => {
           hasInjected = true;
           sessionStorage.setItem(storageKey, query);
           window.parent.postMessage({ type: 'AI_SEARCH_PRO_LOADED' }, '*');
           syncUrlToParent();
        };

        // 1. 尝试查找发送按钮
        let btnEl = null;
        for (const selector of btnSelectors) {
          const els = Array.from(document.querySelectorAll(selector));
          // 找一个可见的、未被禁用的按钮
          btnEl = els.find(el => {
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden') return false;
            if (el.disabled || el.getAttribute('aria-disabled') === 'true' || el.className.includes('disabled')) return false;
            return true;
          });
          if (btnEl) break;
        }

        if (btnEl) {
           // 确保按钮获得焦点，某些平台（如Kimi）可能需要焦点才能正确处理点击
           try { btnEl.focus(); } catch(e) {}
           
           // 对于一些特殊的 div 按钮（如 DeepSeek），原生 click() 可能无效，使用更底层的 MouseEvent
           const clickEvent = new MouseEvent('click', {
             view: window,
             bubbles: true,
             cancelable: true
           });
           btnEl.dispatchEvent(clickEvent);
           // 同时也触发原生 click 作为双重保险
           try { btnEl.click(); } catch(e) {}
           markDone();
           return; // 按钮点击成功，退出
        }

        // 2. 兜底方案：触发回车事件
        const eventInit = {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          which: 13,
          bubbles: true,
          cancelable: true
        };
        inputEl.dispatchEvent(new KeyboardEvent('keydown', eventInit));
        inputEl.dispatchEvent(new KeyboardEvent('keypress', eventInit));
        inputEl.dispatchEvent(new KeyboardEvent('keyup', eventInit));
        
        // 有些平台通过表单提交
        const form = inputEl.closest('form');
        if (form) {
           try {
             if (typeof form.requestSubmit === 'function') {
               form.requestSubmit();
             } else {
               form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
             }
           } catch(e) {}
        }
        
        markDone();
      }, 600); // 等待 React/Vue 响应 state 变化
    }
  }

  // 轮询查找 DOM 元素，因为 SPA 渲染有延迟
  const intervalId = setInterval(() => {
    if (hasInjected) {
      clearInterval(intervalId);
      return;
    }
    injectQuery();
  }, 200);

  // 监听 hash 变化，支持同一个页面的多次搜索
  window.addEventListener('hashchange', () => {
    hasInjected = false;
    injectQuery();
  });
  
  // 监听来自父窗口（小窗外壳）的新词消息，用于在当前对话中继续回答
  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'AI_SEARCH_PRO_NEW_QUERY') {
      const newQuery = event.data.query;
      if (newQuery) {
        // 更新 URL hash，保持逻辑一致性（防止重复发送拦截）
        window.location.hash = `q=${encodeURIComponent(newQuery)}`;
        hasInjected = false; // 重置标志，允许重新注入发送
        injectQuery();
      }
    } else if (event.data && event.data.type === 'AI_SEARCH_PRO_THEME_CHANGE') {
      // 接收到主题切换消息
      const theme = event.data.theme;
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
        document.documentElement.setAttribute('data-theme', 'dark');
        document.documentElement.style.colorScheme = 'dark';
        // 强行注入反转滤镜（作为简单的兜底黑暗模式）
        let style = document.getElementById('ai-sp-dark-mode-fallback');
        if (!style) {
          style = document.createElement('style');
          style.id = 'ai-sp-dark-mode-fallback';
          document.head.appendChild(style);
        }
        // 对于没有原生黑暗模式的网站，使用滤镜反转颜色
        const host = window.location.hostname;
        if (!host.includes('chatgpt.com') && !host.includes('kimi.moonshot.cn')) {
          style.innerHTML = `
            html { filter: invert(1) hue-rotate(180deg) !important; background: #fff !important; }
            img, video, iframe, svg, canvas { filter: invert(1) hue-rotate(180deg) !important; }
          `;
        }
      } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.setAttribute('data-theme', 'light');
        document.documentElement.style.colorScheme = 'light';
        const style = document.getElementById('ai-sp-dark-mode-fallback');
        if (style) style.remove();
      }
    } else if (event.data && event.data.type === 'AI_SEARCH_PRO_STOP_GENERATION') {
      // 尝试寻找各个平台的“停止生成”按钮并点击
      const host = window.location.hostname;
      let stopSelectors = [
        'button[aria-label*="stop" i]',
        'button[aria-label*="停止"]',
        'button[class*="stop" i]',
        'div[class*="stop" i]'
      ];

      if (host.includes('doubao.com')) {
        stopSelectors.push('button[data-testid*="stop"]');
      } else if (host.includes('chatgpt.com')) {
        stopSelectors.push('button[aria-label="Stop generating"]');
      } else if (host.includes('qianwen.com') || host.includes('tongyi.aliyun.com')) {
        stopSelectors.push('div[class*="stopBtn"]', 'span[class*="stop"]');
      } else if (host.includes('deepseek.com')) {
        // DeepSeek 的停止按钮通常是一个包含方块 svg 的按钮
        stopSelectors.push('div[role="button"]:has(svg rect)'); 
      }

      for (const selector of stopSelectors) {
        const els = Array.from(document.querySelectorAll(selector));
        const stopBtn = els.find(el => {
          const style = window.getComputedStyle(el);
          return style.display !== 'none' && style.visibility !== 'hidden' && !el.disabled;
        });
        if (stopBtn) {
          try { stopBtn.click(); } catch(e) {}
          const clickEvent = new MouseEvent('click', { view: window, bubbles: true, cancelable: true });
          stopBtn.dispatchEvent(clickEvent);
          break;
        }
      }
    }
  });

  // 10秒后停止轮询，避免性能消耗
  setTimeout(() => {
    clearInterval(intervalId);
  }, 10000);

})();
