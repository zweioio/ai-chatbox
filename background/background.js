// background/background.js

// 监听扩展安装事件
chrome.runtime.onInstalled.addListener(() => {
  console.log("AI Search Pro 安装成功 (DOM Sidebar Mode)");
  
  // 创建右键菜单
  chrome.contextMenus.create({
    id: "ai-search-pro-ask",
    title: "发送给 OmniAI Search",
    contexts: ["selection"]
  });
});

// 处理右键菜单点击
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "ai-search-pro-ask" && info.selectionText) {
    if (tab && tab.id) {
      chrome.tabs.sendMessage(tab.id, { 
        action: "SEARCH_FROM_CONTEXT_MENU", 
        text: info.selectionText 
      }).catch(err => {
        console.log("Message failed:", err);
      });
    }
  }
});

// 处理扩展图标点击，发送消息给 content script 唤起 UI
chrome.action?.onClicked.addListener((tab) => {
  if (tab.id) {
    chrome.tabs.sendMessage(tab.id, { action: "TOGGLE_UI" }).catch(err => {
      console.log("Message failed (probably not a search page):", err);
    });
  }
});
