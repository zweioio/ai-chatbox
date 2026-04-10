// background/background.js

const sidePanelStates = new Map();
const SIDEPANEL_CONTEXT_ACTION_STORAGE_KEY = "aiSearchProSidepanelContextAction";
const FLOATING_CONTEXT_ACTION_STORAGE_KEY = "aiSearchProFloatingContextAction";
const AI_CONTEXT_MENU_ROOT_ID = "ai-search-pro-process";
const AI_CONTEXT_MENU_ITEMS = [
  { id: "prompt-explain", title: "解释" },
  { id: "prompt-summary", title: "总结" },
  { id: "prompt-translate", title: "翻译" },
  { id: "prompt-polish", title: "润色" },
  { id: "prompt-rewrite", title: "改写" },
  { id: "prompt-article", title: "文章提炼" },
  { id: "prompt-review", title: "代码审查" }
];

if (chrome.sidePanel && typeof chrome.sidePanel.setPanelBehavior === "function") {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
}
setupContextMenus();

function getDefaultSidePanelState(tabId, url = "about:blank") {
  return {
    tabId,
    currentPlatform: "doubao",
    enabledPlatforms: [],
    platformUrls: {},
    activeUrl: url,
    query: "",
    theme: "light",
    nativeSidebarOpen: false,
  };
}

function updateSidePanelState(tabId, patch = {}) {
  const previous = sidePanelStates.get(tabId) || getDefaultSidePanelState(tabId, patch.activeUrl || patch.url || "about:blank");
  const next = {
    ...previous,
    ...patch,
    platformUrls: {
      ...(previous.platformUrls || {}),
      ...(patch.platformUrls || {}),
    },
  };
  if (!next.activeUrl) {
    next.activeUrl = next.platformUrls?.[next.currentPlatform] || patch.url || "about:blank";
  }
  sidePanelStates.set(tabId, next);
  return next;
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tabs && tabs.length ? tabs[0] : null;
}

async function queueSidePanelContextAction(action) {
  await chrome.storage.local.set({
    [SIDEPANEL_CONTEXT_ACTION_STORAGE_KEY]: {
      id: action.id,
      platformId: action.platformId,
      text: action.text,
      createdAt: Date.now()
    }
  });
}

async function openAndQueueSidePanelContextAction(tabId, action, patch = {}, windowId) {
  const result = await openNativeSidePanel(tabId, {
    ...patch,
    query: action.text,
    currentPlatform: action.platformId,
    forceSidebarOnly: true,
    windowId
  });
  if (result?.ok) {
    await queueSidePanelContextAction(action);
  } else {
    await clearQueuedSidePanelContextAction();
  }
  return result;
}

async function clearQueuedSidePanelContextAction() {
  await chrome.storage.local.remove(SIDEPANEL_CONTEXT_ACTION_STORAGE_KEY);
}

async function queueFloatingContextAction(action) {
  await chrome.storage.local.set({
    [FLOATING_CONTEXT_ACTION_STORAGE_KEY]: {
      id: action.id,
      platformId: action.platformId,
      text: action.text,
      createdAt: Date.now()
    }
  });
}

function setupContextMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: AI_CONTEXT_MENU_ROOT_ID,
      title: "使用 AI 处理",
      contexts: ["selection"]
    });
    AI_CONTEXT_MENU_ITEMS.forEach((item) => {
      chrome.contextMenus.create({
        id: item.id,
        parentId: AI_CONTEXT_MENU_ROOT_ID,
        title: item.title,
        contexts: ["selection"]
      });
    });
  });
}

async function ensureContentScript(tabId) {
  try {
    await chrome.scripting.insertCSS({ target: { tabId }, files: ["content/content.css"] });
  } catch (e) {}
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ["content/content.js"] });
  } catch (e) {}
}

async function sendMessageToTab(tabId, message) {
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch (err) {
    await ensureContentScript(tabId);
    return chrome.tabs.sendMessage(tabId, message);
  }
}

async function broadcastSidePanelState(tabId) {
  const state = sidePanelStates.get(tabId);
  if (!state) return;
  try {
    await chrome.runtime.sendMessage({ type: "SIDEPANEL_STATE_UPDATED", tabId, state });
  } catch (e) {}
}

async function openNativeSidePanel(tabId, patch = {}) {
  const { forceSidebarOnly = false, ...statePatch } = patch || {};
  const state = updateSidePanelState(tabId, { ...statePatch, nativeSidebarOpen: false });
  const fallbackToFloating = async () => {
    if (forceSidebarOnly) {
      await broadcastSidePanelState(tabId);
      return { ok: false, state };
    }
    await sendMessageToTab(tabId, { action: "TOGGLE_UI", openSidebar: false, forceShow: true });
    await broadcastSidePanelState(tabId);
    return { ok: false, state };
  };
  if (!chrome.sidePanel) {
    return fallbackToFloating();
  }
  if (typeof chrome.sidePanel.open !== "function") {
    try {
      await chrome.sidePanel.setOptions({ tabId, path: "sidepanel/sidepanel.html", enabled: true });
      if (typeof chrome.sidePanel.setPanelBehavior === "function") {
        await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
      }
    } catch (e) {}
    await broadcastSidePanelState(tabId);
    return { ok: false, state };
  }
  const tryOpen = async (windowId) => {
    if (typeof windowId === "number") {
      await chrome.sidePanel.open({ windowId });
    } else {
      await chrome.sidePanel.open({ tabId });
    }
    try {
      await chrome.sidePanel.setOptions({ tabId, path: "sidepanel/sidepanel.html", enabled: true });
    } catch (e0) {}
    await sendMessageToTab(tabId, { action: "HIDE_CONTENT_UI" });
    const openedState = updateSidePanelState(tabId, { nativeSidebarOpen: true });
    await broadcastSidePanelState(tabId);
    return { ok: true, state: openedState };
  };
  try {
    const windowId = typeof statePatch.windowId === "number" ? statePatch.windowId : undefined;
    return await tryOpen(windowId);
  } catch (e) {
    try {
      const activeTab = await getActiveTab();
      const activeWindowId = activeTab?.windowId;
      return await tryOpen(activeWindowId);
    } catch (e2) {}
    return fallbackToFloating();
  }
}

async function closeNativeSidePanel(tabId, windowId) {
  if (!chrome.sidePanel || typeof chrome.sidePanel.close !== "function") return { ok: false };
  let resolvedWindowId = windowId;
  if (typeof resolvedWindowId !== "number" && typeof tabId === "number") {
    try {
      const tab = await chrome.tabs.get(tabId);
      resolvedWindowId = tab?.windowId;
    } catch (e) {}
  }
  let closed = false;
  if (typeof resolvedWindowId === "number") {
    try {
      await chrome.sidePanel.close({ windowId: resolvedWindowId });
      closed = true;
    } catch (e) {}
  }
  if (typeof tabId === "number") {
    try {
      await chrome.sidePanel.close({ tabId });
      closed = true;
    } catch (e) {}
  }
  if (closed && typeof tabId === "number") {
    updateSidePanelState(tabId, { nativeSidebarOpen: false });
    await broadcastSidePanelState(tabId);
  }
  return { ok: closed };
}

function resolveExtensionPagePath(pagePath) {
  const normalized = String(pagePath || "").replace(/^\/+/, "");
  const [basePath, hashPart = ""] = normalized.split("#");
  if (basePath === "settings/settings.html") {
    return `shell/shell.html#settings${hashPart ? `/${hashPart}` : ""}`;
  }
  if (basePath === "prompt-library/prompt_library.html") {
    return "shell/shell.html#prompts";
  }
  if (basePath === "favorites/favorites.html") {
    return "shell/shell.html#memo";
  }
  return normalized;
}

// 监听扩展安装事件
chrome.runtime.onInstalled.addListener(() => {
  console.log("AI Search Pro 安装成功 (Native Side Panel + Floating Window)");
  if (chrome.sidePanel && typeof chrome.sidePanel.setPanelBehavior === "function") {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
  }
  setupContextMenus();
});

chrome.tabs.onRemoved.addListener((tabId) => {
  sidePanelStates.delete(tabId);
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  if (!sidePanelStates.has(tabId)) return;
  await broadcastSidePanelState(tabId);
});

// 处理右键菜单点击
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (AI_CONTEXT_MENU_ITEMS.some((item) => item.id === info.menuItemId) && info.selectionText && tab?.id) {
    sendMessageToTab(tab.id, {
      action: "SEARCH_FROM_CONTEXT_MENU",
      text: info.selectionText,
      promptId: info.menuItemId
    }).catch(err => {
      console.log("Message failed:", err);
    });
  }
});

// 点击扩展图标时打开浏览器原生侧边栏
chrome.action?.onClicked.addListener((tab) => {
  if (!tab?.id) return;
  openNativeSidePanel(tab.id, { activeUrl: tab.url || "about:blank", windowId: tab.windowId }).catch(err => {
    console.log("Open native side panel failed:", err);
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (message?.type === "SYNC_SIDEPANEL_STATE") {
      const tabId = sender.tab?.id;
      if (!tabId) {
        sendResponse({ ok: false });
        return;
      }
      updateSidePanelState(tabId, message.state || {});
      await broadcastSidePanelState(tabId);
      sendResponse({ ok: true });
      return;
    }

    if (message?.type === "OPEN_NATIVE_SIDEBAR") {
      const tabId = sender.tab?.id;
      if (!tabId) {
        sendResponse({ ok: false });
        return;
      }
      const result = await openNativeSidePanel(tabId, { ...(message.state || {}), windowId: sender.tab?.windowId });
      sendResponse(result);
      return;
    }

    if (message?.type === "QUEUE_SIDEPANEL_CONTEXT_ACTION") {
      const tabId = sender.tab?.id;
      if (!tabId || typeof message.text !== "string") {
        sendResponse({ ok: false });
        return;
      }
      const action = {
        id: message.actionId || `ctx_${Date.now()}`,
        platformId: message.platformId || "doubao",
        text: message.text
      };
      const result = await openAndQueueSidePanelContextAction(
        tabId,
        action,
        message.state || {},
        sender.tab?.windowId
      );
      sendResponse(result);
      return;
    }

    if (message?.type === "GET_SIDEBAR_STATE") {
      const activeTab = await getActiveTab();
      if (!activeTab?.id) {
        sendResponse({ ok: false, state: null });
        return;
      }
      const state = sidePanelStates.get(activeTab.id) || getDefaultSidePanelState(activeTab.id, activeTab.url || "about:blank");
      sidePanelStates.set(activeTab.id, state);
      sendResponse({ ok: true, tabId: activeTab.id, state });
      return;
    }

    if (message?.type === "GET_TAB_SIDEBAR_STATE") {
      const tabId = sender.tab?.id;
      if (!tabId) {
        sendResponse({ ok: false, state: null });
        return;
      }
      const tab = await chrome.tabs.get(tabId).catch(() => null);
      const state = sidePanelStates.get(tabId) || getDefaultSidePanelState(tabId, tab?.url || "about:blank");
      sidePanelStates.set(tabId, state);
      sendResponse({ ok: true, tabId, state });
      return;
    }

    if (message?.type === "UPDATE_ACTIVE_URL") {
      const activeTab = await getActiveTab();
      const tabId = message.tabId || activeTab?.id;
      if (!tabId) {
        sendResponse({ ok: false });
        return;
      }
      const currentPlatform = message.currentPlatform;
      const platformUrls = currentPlatform && message.url ? { [currentPlatform]: message.url } : {};
      updateSidePanelState(tabId, {
        currentPlatform: currentPlatform || undefined,
        activeUrl: message.url,
        platformUrls
      });
      await broadcastSidePanelState(tabId);
      sendResponse({ ok: true });
      return;
    }

    if (message?.type === "UPDATE_SIDEPANEL_PLATFORM") {
      const activeTab = await getActiveTab();
      const tabId = message.tabId || activeTab?.id;
      if (!tabId) {
        sendResponse({ ok: false });
        return;
      }
      const state = updateSidePanelState(tabId, {
        currentPlatform: message.currentPlatform,
        activeUrl: message.activeUrl || undefined
      });
      await broadcastSidePanelState(tabId);
      sendResponse({ ok: true, state });
      return;
    }

    if (message?.type === "SWITCH_TO_WINDOW") {
      const activeTab = await getActiveTab();
      const tabId = message.tabId || activeTab?.id;
      if (!tabId) {
        sendResponse({ ok: false });
        return;
      }
      const state = updateSidePanelState(tabId, message.state || {});
      await sendMessageToTab(tabId, {
        action: "SHOW_FLOATING_UI",
        query: state.query || "",
        currentPlatform: state.currentPlatform || "",
      });
      sendResponse({ ok: true });
      return;
    }

    if (message?.type === "OPEN_FLOATING_UI") {
      const activeTab = await getActiveTab();
      const tabId = message.tabId || activeTab?.id;
      if (!tabId) {
        sendResponse({ ok: false });
        return;
      }
      const nextState = {
        nativeSidebarOpen: false,
        ...(message.state || {})
      };
      if (message.query && typeof message.query === "string") {
        nextState.query = message.query;
        await queueFloatingContextAction({
          id: message.state?.selectionRequestId || `float_${Date.now()}`,
          platformId: message.state?.currentPlatform || nextState.currentPlatform || "doubao",
          text: message.query
        });
      }
      updateSidePanelState(tabId, nextState);
      await broadcastSidePanelState(tabId);
      await closeNativeSidePanel(tabId, activeTab?.windowId);
      await ensureContentScript(tabId);
      await sendMessageToTab(tabId, {
        action: "SHOW_FLOATING_UI",
        query: nextState.query || "",
        currentPlatform: nextState.currentPlatform || "",
        enabledPlatforms: Array.isArray(nextState.enabledPlatforms) ? nextState.enabledPlatforms : [],
        forceShow: true
      });
      sendResponse({ ok: true });
      return;
    }

    if (message?.type === "CLOSE_NATIVE_SIDEBAR") {
      const activeTab = await getActiveTab();
      const tabId = message.tabId || activeTab?.id;
      const result = await closeNativeSidePanel(tabId, activeTab?.windowId);
      sendResponse(result);
      return;
    }

    if (message?.type === "OPEN_EXTENSION_PAGE") {
      const pagePath = typeof message.pagePath === "string" ? message.pagePath : "";
      if (!pagePath) {
        sendResponse({ ok: false });
        return;
      }
      await chrome.tabs.create({ url: chrome.runtime.getURL(resolveExtensionPagePath(pagePath)) });
      sendResponse({ ok: true });
      return;
    }

    sendResponse({ ok: false });
  })().catch((error) => {
    console.log("Background message failed:", error);
    sendResponse({ ok: false, error: error?.message || String(error) });
  });

  return true;
});
