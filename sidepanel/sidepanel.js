// 侧边栏脚本
let currentUrl = 'about:blank';

document.addEventListener('DOMContentLoaded', () => {
  const iframe = document.getElementById('ai-sp-sidebar-iframe');
  const loading = document.getElementById('loading');
  const webBtn = document.getElementById('ai-sp-sidebar-web-btn');
  const windowBtn = document.getElementById('ai-sp-sidebar-window-btn');

  // 从 background 获取当前状态
  chrome.runtime.sendMessage({ type: 'GET_SIDEBAR_STATE' }, (response) => {
    if (response && response.url) {
      currentUrl = response.url;
      iframe.src = currentUrl;
    }
  });

  // 监听来自 content script 或 background 的消息
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'SYNC_URL_TO_SIDEPANEL') {
      if (currentUrl !== message.url) {
        currentUrl = message.url;
        loading.style.display = 'flex';
        iframe.style.opacity = '0';
        iframe.src = currentUrl;
      }
    }
  });

  // 监听 iframe 加载完成
  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'AI_SEARCH_PRO_LOADED') {
      loading.style.display = 'none';
      iframe.style.opacity = '1';
    } else if (event.data && event.data.type === 'AI_SEARCH_PRO_URL_SYNC') {
      currentUrl = event.data.url;
      // 同步给 background
      chrome.runtime.sendMessage({ type: 'UPDATE_ACTIVE_URL', url: currentUrl });
    }
  });

  // 网页打开按钮
  webBtn.addEventListener('click', () => {
    window.open(currentUrl, '_blank');
  });

  // 在小窗打开按钮
  windowBtn.addEventListener('click', () => {
    // 告诉 background 切换状态，由 background 通知当前活跃的 content script
    chrome.runtime.sendMessage({ type: 'SWITCH_TO_WINDOW', url: currentUrl });
    window.close(); // 自动关闭原生侧边栏
  });
  
  // 兜底隐藏 loading
  setTimeout(() => {
    loading.style.display = 'none';
    iframe.style.opacity = '1';
  }, 10000);
});
