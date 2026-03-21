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

    // 针对不同平台的选择器适配
    const host = window.location.hostname;
    let inputSelector = 'textarea';
    let btnSelector = 'button[type="submit"], button[aria-label*="send"], button[aria-label*="发送"], .send-button';

    if (host.includes('doubao.com')) {
      inputSelector = 'textarea[data-testid="chat_input_input"]';
      btnSelector = 'button[data-testid="chat_input_send_button"]';
    } else if (host.includes('chatgpt.com')) {
      inputSelector = '#prompt-textarea';
      btnSelector = 'button[data-testid="send-button"]';
    } else if (host.includes('qianwen.com') || host.includes('tongyi.aliyun.com')) {
      inputSelector = 'textarea';
      btnSelector = '.send-btn'; // 需要根据实际情况调整
    } else if (host.includes('deepseek.com')) {
      inputSelector = 'textarea';
      btnSelector = 'div[role="button"]:has(svg)'; // DeepSeek 发送按钮
    }

    const inputEl = document.querySelector(inputSelector);
    if (inputEl) {
      // 解决 React 等框架的受控组件问题
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
      if (nativeInputValueSetter) {
         nativeInputValueSetter.call(inputEl, query);
      } else {
         inputEl.value = query;
      }
      
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
      inputEl.dispatchEvent(new Event('change', { bubbles: true }));

      // 尝试查找并点击发送按钮
      setTimeout(() => {
        const btnEl = document.querySelector(btnSelector);
        if (btnEl && !btnEl.disabled) {
           btnEl.click();
           hasInjected = true;
           sessionStorage.setItem(storageKey, query); // 记录已发送的词
           
           // 通知父窗口加载完成，可以隐藏 Loading
           window.parent.postMessage({ type: 'AI_SEARCH_PRO_LOADED' }, '*');
           syncUrlToParent();
        } else {
           // 如果找不到按钮或者按钮被禁用，触发回车事件
           inputEl.dispatchEvent(new KeyboardEvent('keydown', {
             key: 'Enter',
             code: 'Enter',
             keyCode: 13,
             which: 13,
             bubbles: true
           }));
           hasInjected = true;
           sessionStorage.setItem(storageKey, query); // 记录已发送的词
           window.parent.postMessage({ type: 'AI_SEARCH_PRO_LOADED' }, '*');
           syncUrlToParent();
        }
      }, 500);
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
    }
  });

  // 10秒后停止轮询，避免性能消耗
  setTimeout(() => {
    clearInterval(intervalId);
  }, 10000);

})();
