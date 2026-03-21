// background/background.js

// 监听扩展安装事件
chrome.runtime.onInstalled.addListener(() => {
  console.log("AI Search Pro 安装成功 (DOM Sidebar Mode)");
});

// 处理扩展图标点击，发送消息给 content script 唤起 UI
chrome.action?.onClicked.addListener((tab) => {
  if (tab.id) {
    chrome.tabs.sendMessage(tab.id, { action: "TOGGLE_UI" }).catch(err => {
      console.log("Message failed (probably not a search page):", err);
    });
  }
});
