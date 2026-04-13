(() => {
  const AI_PLATFORMS = {
    doubao: { name: "豆包", url: "https://www.doubao.com/chat/" },
    qianwen: { name: "千问", url: "https://www.qianwen.com/" },
    yuanbao: { name: "元宝", url: "https://yuanbao.tencent.com/chat/naQivTmsDa" },
    deepseek: { name: "DeepSeek", url: "https://chat.deepseek.com/" },
    kimi: { name: "Kimi", url: "https://www.kimi.com/" },
    zai: { name: "Z.AI", url: "https://chat.z.ai/" },
    chatglm: { name: "智谱清言", url: "https://chatglm.cn/main/alltoolsdetail?lang=zh" },
    chatgpt: { name: "ChatGPT", url: "https://chatgpt.com/" },
    gemini: { name: "Gemini", url: "https://gemini.google.com/" },
    claude: { name: "Claude", url: "https://claude.ai/" },
    perplexity: { name: "Perplexity", url: "https://www.perplexity.ai/" },
    copilot: { name: "Copilot", url: "https://copilot.microsoft.com/" },
    grok: { name: "Grok", url: "https://grok.com/" }
  };

  const FEATURE_SWITCH = {
    v1: true,
    v2: true,
    v3: true
  };

  function getPlatformIconUrl(platformKey) {
    const iconMap = {
      doubao: "doubao.png",
      qianwen: "qianwen.png",
      deepseek: "deepseek.png",
      yuanbao: "yuanbao.png",
      kimi: "kimi.png",
      zai: "zhipuai.png",
      chatglm: "chatglm.png",
      chatgpt: "chatgpt.png",
      gemini: "gemini.png",
      claude: "claude.png",
      perplexity: "perplexity.png",
      copilot: "copilot.png",
      grok: "grok.png"
    };
    const fileName = iconMap[platformKey];
    return fileName ? chrome.runtime.getURL(`assets/${fileName}`) : "";
  }

  const PLATFORM_STRATEGY = {
    default: { restoreDelay: 1200, restoreTimeout: 4200, maxRetries: 2, retryGap: 700 },
    chatgpt: { restoreDelay: 1500, restoreTimeout: 5200, maxRetries: 3, retryGap: 900 },
    claude: { restoreDelay: 1600, restoreTimeout: 5200, maxRetries: 3, retryGap: 900 },
    deepseek: { restoreDelay: 1200, restoreTimeout: 4600, maxRetries: 2, retryGap: 700 },
    qianwen: { restoreDelay: 1400, restoreTimeout: 5000, maxRetries: 3, retryGap: 900 }
  };

  const hash = new URLSearchParams(location.hash.replace(/^#/, ""));
  let query = (hash.get("q") || "").trim();
  const enabled = (hash.get("enabled") || "").split(",").map(v => v.trim()).filter(v => AI_PLATFORMS[v]);
  const initial = (hash.get("platforms") || "").split(",").map(v => v.trim()).filter(v => AI_PLATFORMS[v]);
  let initialUrls = {};
  try {
    initialUrls = JSON.parse(hash.get("urls") || "{}") || {};
  } catch (e) {
    try {
      initialUrls = JSON.parse(decodeURIComponent(hash.get("urls") || "%7B%7D")) || {};
    } catch (e2) {
      initialUrls = {};
    }
  }

  const defaultEnabled = Object.keys(AI_PLATFORMS);
  const preferredEnabled = enabled.length ? enabled : defaultEnabled;
  const initPlatforms = initial.length ? initial : preferredEnabled.slice(0, 2);

  const queryTitleEl = document.getElementById("cmp-query-title");
  const restoreSummaryEl = document.getElementById("cmp-restore-summary");
  const selectEl = document.getElementById("cmp-platform-select");
  const addBtn = document.getElementById("cmp-add-btn");
  const favoriteBtn = document.getElementById("cmp-favorite-btn");
  const exportBtn = document.getElementById("cmp-export-btn");
  const countEl = document.getElementById("cmp-count");
  const refreshBtn = document.getElementById("cmp-refresh-btn");
  const panelEl = document.getElementById("cmp-panel");
  const panelToggleEl = document.getElementById("cmp-panel-toggle");
  const globalInputEl = document.getElementById("cmp-global-input");
  const sendBtn = document.getElementById("cmp-send-btn");
  const toastEl = document.getElementById("cmp-toast");
  const grid = document.getElementById("cmp-grid");
  const bodyEl = document.getElementById("cmp-body");
  const settingsBtn = document.getElementById("cmp-settings-btn");
  const themeBtn = document.getElementById("cmp-theme-btn");
  const legendFilterEls = Array.from(document.querySelectorAll(".cmp-tag-filter"));
  const legendDescEl = document.getElementById("cmp-legend-desc");
  const diffListEl = document.getElementById("cmp-diff-list");
  const minPanes = 2;
  const maxPanes = 4;
  const paneSummaries = new Map();
  const paneStates = new Map();
  const summaryRequests = new Map();
  const EXT_ORIGIN = location.origin;
  const EMBEDDED_SEND_EVENT = "AI_SP_EMBEDDED_SEND";
  const EMBEDDED_SEND_DONE_EVENT = "AI_SP_EMBEDDED_SEND_DONE";
  const EMBEDDED_SEND_READY_REQUEST_EVENT = "AI_SP_EMBEDDED_SEND_READY_REQUEST";
  const EMBEDDED_SEND_READY_RESPONSE_EVENT = "AI_SP_EMBEDDED_SEND_READY_RESPONSE";
  const FAVORITES_STORAGE_KEY = "aiSearchProFavorites";
  const pendingSends = new Map();
  const sendReadyRequests = new Map();
  const collapsedDiffCards = new Map();
  const CONFIG_STORAGE_KEY = "aiSearchProConfig";
  const THEME_STORAGE_KEY = "cmp-theme";
  const SEND_READY_MAX_RETRIES = 8;
  const SEND_READY_RETRY_GAP = 450;
  const SEND_READY_STABLE_DELAY = 320;
  let activeDiffFilter = "all";
  let draggingPaneId = "";
  let paneOrderSeed = 1;
  let currentTheme = hash.get("theme") === "dark" ? "dark" : (localStorage.getItem(THEME_STORAGE_KEY) === "dark" ? "dark" : "light");
  const themeMedia = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  const ENABLE_DRAG_REORDER = true;
  const DIFF_SUMMARY_MAX_RETRIES = 4;
  const DIFF_SUMMARY_DELAY = 1500;
  const DIFF_SUMMARY_TIMEOUT = 5200;
  const MIN_VALID_SUMMARY_LENGTH = 8;
  const MAX_ANALYSIS_SENTENCES = 48;
  const MAX_BASELINE_SENTENCES = 18;
  const MAX_VISIBLE_INSIGHT_LINES = 8;
  const FILTER_DESCRIPTIONS = {
    all: "全部 AI 模型的洞察内容信息",
    match: "多个模型都提到的共同点",
    diff: "观点、表述或重点不同",
    miss: "只有部分模型覆盖或其他没有提到的信息"
  };
  const dragIconUrl = chrome.runtime.getURL("icons/drag.svg");
  const closeIconUrl = chrome.runtime.getURL("icons/close.svg");
  const webIconUrl = chrome.runtime.getURL("icons/web.svg");
  const moveLeftIconUrl = chrome.runtime.getURL("icons/platform-arrow-left.svg");
  const moveRightIconUrl = chrome.runtime.getURL("icons/platform-arrow-right.svg");
  const compareRefreshIconUrl = chrome.runtime.getURL("icons/compare-refresh.svg");
  const retryIconUrl = chrome.runtime.getURL("icons/retry.svg");

  if (queryTitleEl) queryTitleEl.textContent = query || "内容对比";
  if (globalInputEl) globalInputEl.value = query;

  function buildIframeUrl(platformKey) {
    if (initialUrls[platformKey]) return initialUrls[platformKey];
    const base = AI_PLATFORMS[platformKey].url;
    if (platformKey === "kimi") return base;
    if (!query) return base;
    return `${base}#q=${encodeURIComponent(query)}`;
  }

  function getPlatformStrategy(platformKey) {
    const base = PLATFORM_STRATEGY.default;
    if (!FEATURE_SWITCH.v3) return base;
    return { ...base, ...(PLATFORM_STRATEGY[platformKey] || {}) };
  }

  function makeRequestId() {
    return `r_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function getPaneExportPayload() {
    return getPaneNodes().map((pane) => {
      const paneId = pane.dataset.paneId;
      const select = pane.querySelector(".cmp-pane-select");
      const key = select ? select.value : "";
      const iframe = pane.querySelector(".cmp-iframe");
      return {
        paneId,
        platform: key,
        platformName: AI_PLATFORMS[key]?.name || key,
        summary: paneSummaries.get(paneId) || "",
        url: iframe?.src || initialUrls[key] || ""
      };
    });
  }

  function collectInsightMarkdown() {
    const items = Array.from(diffListEl?.querySelectorAll(".cmp-diff-item") || []);
    if (!items.length) return "";
    return items.map((item, index) => {
      const type = item.querySelector(".cmp-diff-type")?.textContent?.trim() || "";
      const title = item.querySelector(".cmp-diff-title")?.textContent?.trim() || "";
      const text = item.querySelector(".cmp-diff-text")?.textContent?.trim() || "";
      return `${index + 1}. [${type}] ${title}\n${text}`;
    }).join("\n\n");
  }

  function buildCompareMarkdown() {
    const panes = getPaneExportPayload();
    const lines = [`# 内容对比`, ``, `- 问题：${query || "未命名问题"}`, `- 导出时间：${new Date().toLocaleString()}`, ``];
    panes.forEach((pane) => {
      lines.push(`## ${pane.platformName}`);
      if (pane.url) lines.push(`- 地址：${pane.url}`);
      lines.push(``);
      lines.push(pane.summary || `暂无摘要`);
      lines.push(``);
    });
    const insights = collectInsightMarkdown();
    if (insights) {
      lines.push(`## 回答洞察`);
      lines.push(``);
      lines.push(insights);
      lines.push(``);
    }
    return lines.join("\n");
  }

  async function saveFavoriteRecord() {
    const data = await chrome.storage.local.get([FAVORITES_STORAGE_KEY]);
    const list = Array.isArray(data?.[FAVORITES_STORAGE_KEY]) ? data[FAVORITES_STORAGE_KEY] : [];
    const record = {
      id: makeRequestId(),
      title: query || "未命名问题",
      query,
      createdAt: Date.now(),
      panes: getPaneExportPayload(),
      markdown: buildCompareMarkdown()
    };
    await chrome.storage.local.set({ [FAVORITES_STORAGE_KEY]: [record, ...list].slice(0, 100) });
  }

  function exportMarkdownFile() {
    const content = buildCompareMarkdown();
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${(query || "内容对比").slice(0, 24)}.md`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function applyTheme(theme) {
    currentTheme = theme === "dark" ? "dark" : "light";
    if (currentTheme === "dark") {
      document.documentElement.setAttribute("data-cmp-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-cmp-theme");
    }
    localStorage.setItem(THEME_STORAGE_KEY, currentTheme);
    updateThemeButton();
  }

  function resolveTheme(theme) {
    if (theme === "auto") return themeMedia?.matches ? "dark" : "light";
    return theme === "dark" ? "dark" : "light";
  }

  async function persistThemePreference(theme) {
    const data = await chrome.storage.local.get([CONFIG_STORAGE_KEY]);
    const config = data?.[CONFIG_STORAGE_KEY] || {};
    await chrome.storage.local.set({
      [CONFIG_STORAGE_KEY]: {
        ...config,
        theme
      }
    });
  }

  async function syncThemeFromConfig() {
    const data = await chrome.storage.local.get([CONFIG_STORAGE_KEY]);
    const configTheme = data?.[CONFIG_STORAGE_KEY]?.theme;
    if (!configTheme) return;
    applyTheme(resolveTheme(configTheme));
  }

  function updateThemeButton() {
    if (!themeBtn) return;
    const sunIcon = themeBtn.querySelector(".cmp-theme-icon-sun");
    const moonIcon = themeBtn.querySelector(".cmp-theme-icon-moon");
    const tooltip = themeBtn.querySelector(".cmp-tooltip");
    const isDark = currentTheme === "dark";
    if (sunIcon) sunIcon.style.display = isDark ? "block" : "none";
    if (moonIcon) moonIcon.style.display = isDark ? "none" : "block";
    if (tooltip) tooltip.textContent = isDark ? "切换浅色模式" : "切换深色模式";
  }

  function setSelectMenuOpen(wrap, open) {
    if (!wrap) return;
    const trigger = wrap.querySelector(".cmp-select-trigger");
    const menu = wrap.querySelector(".cmp-select-menu");
    wrap.classList.toggle("is-open", open);
    if (trigger) trigger.setAttribute("aria-expanded", open ? "true" : "false");
    if (menu) menu.hidden = !open;
  }

  function closeAllSelectMenus(exceptWrap = null) {
    document.querySelectorAll(".cmp-select-wrap.is-open").forEach((wrap) => {
      if (exceptWrap && wrap === exceptWrap) return;
      setSelectMenuOpen(wrap, false);
    });
  }

  function ensureCustomSelect(select) {
    if (!select) return null;
    const wrap = select.closest(".cmp-select-wrap");
    if (!wrap) return null;
    let trigger = wrap.querySelector(".cmp-select-trigger");
    if (!trigger) {
      trigger = document.createElement("button");
      trigger.type = "button";
      trigger.className = "cmp-select-trigger";
      trigger.setAttribute("aria-haspopup", "menu");
      trigger.setAttribute("aria-expanded", "false");
      wrap.appendChild(trigger);
      trigger.addEventListener("click", (event) => {
        event.stopPropagation();
        if (trigger.disabled) return;
        const nextOpen = !wrap.classList.contains("is-open");
        closeAllSelectMenus(nextOpen ? wrap : null);
        setSelectMenuOpen(wrap, nextOpen);
      });
    }
    let menu = wrap.querySelector(".cmp-select-menu");
    if (!menu) {
      menu = document.createElement("div");
      menu.className = "cmp-select-menu";
      menu.hidden = true;
      wrap.appendChild(menu);
      menu.addEventListener("click", (event) => {
        event.stopPropagation();
        const option = event.target.closest(".cmp-select-option");
        if (!option) return;
        const value = option.dataset.value || "";
        if (!value || select.value === value) {
          setSelectMenuOpen(wrap, false);
          return;
        }
        select.value = value;
        refreshCustomSelect(select);
        setSelectMenuOpen(wrap, false);
        select.dispatchEvent(new Event("change", { bubbles: true }));
      });
    }
    return { wrap, trigger, menu };
  }

  function refreshCustomSelect(select) {
    const ui = ensureCustomSelect(select);
    if (!ui) return;
    const { wrap, trigger, menu } = ui;
    const options = Array.from(select.options).map((option) => ({
      value: option.value,
      label: option.textContent || option.value
    }));
    const activeValue = select.value || options[0]?.value || "";
    const activePlatform = AI_PLATFORMS[activeValue];
    trigger.disabled = options.length === 0;
    if (activePlatform) {
      trigger.innerHTML = `
        <span class="cmp-select-trigger-main">
          <span class="cmp-select-trigger-icon"><img src="${getPlatformIconUrl(activeValue)}" alt="" /></span>
          <span class="cmp-select-trigger-label">${activePlatform.name}</span>
        </span>
        <span class="cmp-select-trigger-arrow" aria-hidden="true">
          <img src="${chrome.runtime.getURL("icons/platform-arrow-down.svg")}" alt="" />
        </span>
      `;
    } else {
      trigger.innerHTML = `
        <span class="cmp-select-trigger-main">
          <span class="cmp-select-trigger-label">选择 AI 助手</span>
        </span>
        <span class="cmp-select-trigger-arrow" aria-hidden="true">
          <img src="${chrome.runtime.getURL("icons/platform-arrow-down.svg")}" alt="" />
        </span>
      `;
    }
    menu.innerHTML = options.map(({ value, label }) => `
      <button type="button" class="cmp-select-option${value === activeValue ? " is-active" : ""}" data-value="${value}">
        <span class="cmp-select-option-main">
          <span class="cmp-select-option-icon"><img src="${getPlatformIconUrl(value)}" alt="" /></span>
          <span class="cmp-select-option-label">${label}</span>
        </span>
        <span class="cmp-select-option-check"${value === activeValue ? "" : " hidden"}></span>
      </button>
    `).join("");
    wrap.classList.toggle("is-disabled", options.length === 0);
  }

  function updateLegendDescription() {
    if (!legendDescEl) return;
    legendDescEl.textContent = FILTER_DESCRIPTIONS[activeDiffFilter] || FILTER_DESCRIPTIONS.all;
  }

  function normalizeText(text) {
    return (text || "").replace(/\s+/g, " ").trim();
  }

  function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function escapeHtml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function shortenInsightText(text, max = 42) {
    const normalized = normalizeText(text || "");
    if (normalized.length <= max) return normalized;
    return `${normalized.slice(0, max).trim()}…`;
  }

  function collectDistinctSentences(sentences, max = 2) {
    const unique = [];
    (sentences || []).forEach((sentence) => {
      const normalized = normalizeText(sentence);
      if (!normalized || normalized.length < 8) return;
      const duplicated = unique.some((existing) => {
        return existing === normalized
          || existing.includes(normalized)
          || normalized.includes(existing)
          || similarity(existing, normalized) >= 0.72;
      });
      if (duplicated) return;
      unique.push(normalized);
    });
    return unique.slice(0, max);
  }

  function buildInsightLine(label, text, className = "cmp-mark") {
    const fullText = normalizeText(text || "");
    if (!fullText) return "";
    return `<span class="cmp-insight-line"><span class="cmp-insight-label">${escapeHtml(label)}：</span><span class="${className}" data-full-text="${escapeHtml(fullText)}">${escapeHtml(shortenInsightText(fullText))}</span></span>`;
  }

  function tokenize(text) {
    const t = normalizeText(text).toLowerCase();
    const matches = t.match(/[\u4e00-\u9fa5]{2,}|[a-z]{3,}/g) || [];
    return matches.filter(w => !/^https?$/.test(w));
  }

  function splitSentences(text) {
    const normalized = (text || "")
      .replace(/\r/g, "\n")
      .split(/(?<=[。！？!?;；\n])/)
      .map(v => normalizeText(v))
      .filter(v => v.length >= 8)
      .slice(0, MAX_ANALYSIS_SENTENCES);
    if (normalized.length) return normalized;
    const compact = normalizeText(text || "");
    if (!compact) return [];
    const chunks = compact.match(/.{1,48}(?:[，,、：:；;。！？!?]|$)/g) || [];
    return chunks
      .map(v => normalizeText(v))
      .filter(v => v.length >= 8)
      .slice(0, MAX_ANALYSIS_SENTENCES);
  }

  function similarity(a, b) {
    const ta = new Set(tokenize(a));
    const tb = new Set(tokenize(b));
    if (!ta.size || !tb.size) return 0;
    let inter = 0;
    ta.forEach(w => {
      if (tb.has(w)) inter += 1;
    });
    return inter / (ta.size + tb.size - inter);
  }

  function showToast(text) {
    if (!toastEl) return;
    toastEl.textContent = text;
    toastEl.style.display = "block";
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => {
      toastEl.style.display = "none";
    }, 1600);
  }

  function openExtensionPage(pagePath) {
    if (typeof window.__AI_SEARCH_PRO_NAVIGATE === "function") {
      window.__AI_SEARCH_PRO_NAVIGATE(pagePath);
      return;
    }
    window.location.href = chrome.runtime.getURL(pagePath);
  }

  function getPaneNodes() {
    return Array.from(grid.querySelectorAll(".cmp-pane"));
  }

  function getPaneName(paneId) {
    const pane = document.querySelector(`.cmp-pane[data-pane-id="${paneId}"]`);
    if (!pane) return "未知";
    const sel = pane.querySelector(".cmp-pane-select");
    const key = sel ? sel.value : "";
    return (AI_PLATFORMS[key] && AI_PLATFORMS[key].name) ? AI_PLATFORMS[key].name : "未知";
  }

  function clearReadyRequestEntry(key) {
    const entry = sendReadyRequests.get(key);
    if (!entry) return;
    clearTimeout(entry.timer);
    sendReadyRequests.delete(key);
  }

  function clearReadyRequestsByRequestId(requestId) {
    Array.from(sendReadyRequests.keys()).forEach((key) => {
      if (key.startsWith(`${requestId}:`)) clearReadyRequestEntry(key);
    });
  }

  function finalizePendingSend(requestId, fallbackText) {
    const pending = pendingSends.get(requestId);
    if (!pending) return;
    clearTimeout(pending.timer);
    clearReadyRequestsByRequestId(requestId);
    pendingSends.delete(requestId);
    if (pending.failedPaneIds.size) {
      const names = Array.from(pending.failedPaneIds).map(getPaneName).filter(Boolean).join("、");
      showToast(fallbackText || `成功 ${pending.done.size}/${pending.expected.size}，失败：${names}`);
    } else {
      showToast("已同步发送到全部窗口");
    }
    setTimeout(() => scheduleAllSummaryExtraction(), 1200);
    setTimeout(() => scheduleAllSummaryExtraction(), 2600);
  }

  function markPaneSendFailure(requestId, paneId) {
    const pending = pendingSends.get(requestId);
    if (!pending || pending.done.has(paneId)) return;
    pending.failedPaneIds.add(paneId);
    if (pending.done.size + pending.failedPaneIds.size >= pending.expected.size) {
      const names = Array.from(pending.failedPaneIds).map(getPaneName).filter(Boolean).join("、");
      finalizePendingSend(requestId, `成功 ${pending.done.size}/${pending.expected.size}，失败：${names}`);
    }
  }

  function dispatchSendToPane(pane, text, requestId) {
    const iframe = pane.querySelector(".cmp-iframe");
    if (!iframe || !iframe.contentWindow) {
      markPaneSendFailure(requestId, pane.dataset.paneId);
      return;
    }
    try {
      iframe.contentWindow.postMessage({ type: EMBEDDED_SEND_EVENT, text, submit: true, requestId, paneId: pane.dataset.paneId }, "*");
    } catch (e) {
      markPaneSendFailure(requestId, pane.dataset.paneId);
    }
  }

  function queueSendToPane(pane, text, requestId, attempt = 1) {
    const iframe = pane.querySelector(".cmp-iframe");
    const paneId = pane.dataset.paneId;
    if (!iframe || !iframe.contentWindow) {
      markPaneSendFailure(requestId, paneId);
      return;
    }
    const key = `${requestId}:${paneId}`;
    clearReadyRequestEntry(key);
    const timer = window.setTimeout(() => {
      clearReadyRequestEntry(key);
      if (attempt < SEND_READY_MAX_RETRIES) {
        queueSendToPane(pane, text, requestId, attempt + 1);
      } else {
        markPaneSendFailure(requestId, paneId);
      }
    }, SEND_READY_RETRY_GAP);
    sendReadyRequests.set(key, { pane, text, requestId, paneId, attempt, timer });
    try {
      iframe.contentWindow.postMessage({ type: EMBEDDED_SEND_READY_REQUEST_EVENT, requestId, paneId }, "*");
    } catch (e) {
      clearReadyRequestEntry(key);
      if (attempt < SEND_READY_MAX_RETRIES) {
        queueSendToPane(pane, text, requestId, attempt + 1);
      } else {
        markPaneSendFailure(requestId, paneId);
      }
    }
  }

  function getOrderedPanes() {
    return getPaneNodes().sort((a, b) => Number(a.style.order || 0) - Number(b.style.order || 0));
  }

  function applyPaneOrder(list) {
    list.forEach((pane, idx) => {
      pane.style.order = String(idx + 1);
    });
  }

  function getPaneSelects() {
    return Array.from(grid.querySelectorAll(".cmp-pane-select"));
  }

  function getSelectedPlatforms() {
    return getPaneSelects().map(sel => sel.value).filter(Boolean);
  }

  function getAvailablePlatforms(exclude = []) {
    const selected = getSelectedPlatforms();
    return defaultEnabled.filter(k => !selected.includes(k) || exclude.includes(k));
  }

  function refreshGridCols() {
    const count = grid.children.length;
    grid.classList.remove("cols-3", "cols-4");
    if (count >= 4) grid.classList.add("cols-4");
    else if (count === 3) grid.classList.add("cols-3");
    updateArrowButtonsState();
  }

  function updateArrowButtonsState() {
    const ordered = getOrderedPanes();
    ordered.forEach((pane, idx) => {
      const leftBtn = pane.querySelector('.cmp-pane-btn-left');
      const rightBtn = pane.querySelector('.cmp-pane-btn-right');
      if (leftBtn) {
        if (idx === 0) {
          leftBtn.classList.add('is-disabled');
          leftBtn.style.opacity = '0.3';
          leftBtn.style.cursor = 'not-allowed';
        } else {
          leftBtn.classList.remove('is-disabled');
          leftBtn.style.opacity = '1';
          leftBtn.style.cursor = 'pointer';
        }
      }
      if (rightBtn) {
        if (idx === ordered.length - 1) {
          rightBtn.classList.add('is-disabled');
          rightBtn.style.opacity = '0.3';
          rightBtn.style.cursor = 'not-allowed';
        } else {
          rightBtn.classList.remove('is-disabled');
          rightBtn.style.opacity = '1';
          rightBtn.style.cursor = 'pointer';
        }
      }
    });
  }

  function updateTopSelector() {
    const current = selectEl.value;
    selectEl.innerHTML = "";
    const available = getAvailablePlatforms();
    available.forEach(key => {
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = AI_PLATFORMS[key].name;
      selectEl.appendChild(opt);
    });
    if (available.includes(current)) selectEl.value = current;
    else if (available[0]) selectEl.value = available[0];
    refreshCustomSelect(selectEl);
    addBtn.disabled = grid.children.length >= maxPanes || available.length === 0;
    if (countEl) countEl.textContent = `${grid.children.length}/${maxPanes}`;
  }

  function updateRestoreSummary() {
    if (!restoreSummaryEl) return;
    let restored = 0;
    let fallback = 0;
    let restoring = 0;
    paneStates.forEach(v => {
      if (v.status === "restored") restored += 1;
      else if (v.status === "fallback") fallback += 1;
      else restoring += 1;
    });
    restoreSummaryEl.innerHTML = `
      <span class="cmp-summary-item restored"><span class="cmp-status-dot"></span>已继承 ${restored}</span>
      <span class="cmp-summary-sep">·</span>
      <span class="cmp-summary-item fallback"><span class="cmp-status-dot"></span>回退 ${fallback}</span>
      <span class="cmp-summary-sep">·</span>
      <span class="cmp-summary-item restoring"><span class="cmp-status-dot"></span>处理中 ${restoring}</span>
    `;
  }

  function setPaneState(pane, status, reason = "", source = "") {
    const paneId = pane.dataset.paneId;
    const old = paneStates.get(paneId) || {};
    paneStates.set(paneId, { ...old, status, reason, source });
    const badge = pane.querySelector(".cmp-pane-status");
    const retryBtn = pane.querySelector(".cmp-pane-retry");
    if (badge) {
      badge.className = `cmp-pane-status ${status}`;
      const label = status === "restored" ? "已继承" : status === "fallback" ? "已回退" : "继承中";
      badge.setAttribute("aria-label", label);
      badge.title = reason || "";
      const tip = badge.querySelector(".cmp-tooltip");
      if (tip) tip.textContent = label;
    }
    if (retryBtn) {
      retryBtn.style.display = status === "fallback" ? "inline-flex" : "none";
    }
    updateRestoreSummary();
  }

  function syncPaneSelectors() {
    const paneSelects = getPaneSelects();
    paneSelects.forEach(sel => {
      const current = sel.value;
      const available = getAvailablePlatforms([current]);
      sel.innerHTML = "";
      available.forEach(key => {
        const opt = document.createElement("option");
        opt.value = key;
        opt.textContent = AI_PLATFORMS[key].name;
        sel.appendChild(opt);
      });
      if (available.includes(current)) sel.value = current;
      else if (available[0]) sel.value = available[0];
      refreshCustomSelect(sel);
      const pane = sel.closest(".cmp-pane");
      const iframe = pane && pane.querySelector(".cmp-iframe");
      if (iframe && sel.value !== current) iframe.src = buildIframeUrl(sel.value);
    });
    updateTopSelector();
  }

  function requestPaneSummary(pane, delay = 1200, mode = "diff", attempt = 1, timeout = 4500) {
    const iframe = pane.querySelector(".cmp-iframe");
    if (!iframe || !iframe.contentWindow) return null;
    const paneId = pane.dataset.paneId;
    const requestId = makeRequestId();
    const timer = window.setTimeout(() => {
      const req = summaryRequests.get(requestId);
      if (!req) return;
      summaryRequests.delete(requestId);
      if (mode === "diff") {
        if (!paneSummaries.get(paneId) && attempt < DIFF_SUMMARY_MAX_RETRIES) {
          requestPaneSummary(pane, DIFF_SUMMARY_DELAY, "diff", attempt + 1, DIFF_SUMMARY_TIMEOUT);
          return;
        }
        if (!paneSummaries.get(paneId)) paneSummaries.set(paneId, "");
        renderDiffHighlights();
      } else {
        handleRestoreTimeout(pane, req.attempt);
      }
    }, timeout);
    summaryRequests.set(requestId, { paneId, timer, mode, attempt });
    window.setTimeout(() => {
      try {
        iframe.contentWindow.postMessage({ type: "AI_SEARCH_PRO_REQUEST_SUMMARY", requestId }, "*");
      } catch (e) {}
    }, delay);
    return requestId;
  }

  function startRestoreForPane(pane, force = false) {
    if (!FEATURE_SWITCH.v1) return;
    const sel = pane.querySelector(".cmp-pane-select");
    const platform = sel ? sel.value : "";
    const strategy = getPlatformStrategy(platform);
    const paneId = pane.dataset.paneId;
    paneStates.set(paneId, { status: "restoring", attempt: 1, maxRetries: strategy.maxRetries, reason: "", source: "" });
    setPaneState(pane, "restoring");
    if (force) showToast(`${AI_PLATFORMS[platform].name} 正在重试继承`);
    requestPaneSummary(pane, strategy.restoreDelay, "restore", 1, strategy.restoreTimeout);
  }

  function handleRestoreTimeout(pane, attempt) {
    const sel = pane.querySelector(".cmp-pane-select");
    const platform = sel ? sel.value : "";
    const strategy = getPlatformStrategy(platform);
    if (attempt < strategy.maxRetries) {
      setTimeout(() => {
        requestPaneSummary(pane, strategy.restoreDelay, "restore", attempt + 1, strategy.restoreTimeout);
      }, strategy.retryGap);
    } else {
      setPaneState(pane, "fallback", "会话恢复超时，已回退新会话", "new");
    }
  }

  function handleRestoreResponse(pane, summary, attempt) {
    const text = normalizeText(summary || "");
    const sel = pane.querySelector(".cmp-pane-select");
    const platform = sel ? sel.value : "";
    const strategy = getPlatformStrategy(platform);
    if (text.length >= MIN_VALID_SUMMARY_LENGTH) {
      paneSummaries.set(pane.dataset.paneId, text);
      setPaneState(pane, "restored", "", "url");
      renderDiffHighlights();
      return;
    }
    if (attempt < strategy.maxRetries) {
      setTimeout(() => {
        requestPaneSummary(pane, strategy.restoreDelay, "restore", attempt + 1, strategy.restoreTimeout);
      }, strategy.retryGap);
    } else {
      setPaneState(pane, "fallback", "未提取到有效摘要，已回退新会话", "new");
    }
  }

  function scheduleAllSummaryExtraction() {
    getPaneNodes().forEach(pane => {
      paneSummaries.set(pane.dataset.paneId, "");
      requestPaneSummary(pane, DIFF_SUMMARY_DELAY, "diff", 1, DIFF_SUMMARY_TIMEOUT);
    });
    renderDiffHighlights();
  }

  function handleDiffToggle() {
    const items = diffListEl.querySelectorAll(".cmp-diff-item");
    items.forEach(item => {
      const matchCountBadge = item.querySelector(".cmp-badge.match");
      const matchCount = matchCountBadge ? parseInt(matchCountBadge.textContent.replace(/[^0-9]/g, ''), 10) : 0;
      const diffCountBadge = item.querySelector(".cmp-badge.diff");
      const diffCount = diffCountBadge ? parseInt(diffCountBadge.textContent.replace(/[^0-9]/g, ''), 10) : 0;
      const missCountBadge = item.querySelector(".cmp-badge.miss");
      const missCount = missCountBadge ? parseInt(missCountBadge.textContent.replace(/[^0-9]/g, ''), 10) : 0;
      const typeVisible =
        !activeDiffFilter ||
        activeDiffFilter === "all" ||
        (activeDiffFilter === "match" && matchCount > 0) ||
        (activeDiffFilter === "diff" && diffCount > 0) ||
        (activeDiffFilter === "miss" && missCount > 0);
      item.style.display = typeVisible ? "flex" : "none";
    });
  }

  if (legendFilterEls.length) {
    legendFilterEls.forEach(btn => {
      btn.addEventListener("click", () => {
        const filter = btn.dataset.filter || "all";
        activeDiffFilter = filter;
        legendFilterEls.forEach(el => el.classList.toggle("is-active", el.dataset.filter === activeDiffFilter));
        updateLegendDescription();
        handleDiffToggle();
      });
    });
  }

  function renderDiffHighlights() {
    const panes = getPaneNodes();
    const data = panes.map((pane) => {
      const paneId = pane.dataset.paneId;
      const sel = pane.querySelector(".cmp-pane-select");
      const platform = sel ? sel.value : "";
      const summary = paneSummaries.get(paneId) || "";
      const tokens = tokenize(summary);
      const sentences = splitSentences(summary);
      return { paneId, platform, summary, tokens, sentences };
    });

    const tokenFreq = new Map();
    data.forEach(d => {
      Array.from(new Set(d.tokens)).forEach(t => tokenFreq.set(t, (tokenFreq.get(t) || 0) + 1));
    });

    const baseline = data[0];
    const baselineSentences = baseline ? baseline.sentences.slice(0, MAX_BASELINE_SENTENCES) : [];
    const cards = [];
    diffListEl.innerHTML = "";
    data.forEach((d, idx) => {
      const title = AI_PLATFORMS[d.platform] ? AI_PLATFORMS[d.platform].name : d.platform;
      const uniq = Array.from(new Set(d.tokens)).filter(t => tokenFreq.get(t) === 1).slice(0, 5);
      let matchCount = 0;
      let diffCount = 0;
      let missCount = 0;
      const lines = [];
      const matchLines = [];
      const diffLines = [];
      const missLines = [];
      const fallbackLines = d.sentences.length ? d.sentences : splitSentences(d.summary);
      if (idx === 0) {
        const coreLines = collectDistinctSentences(baselineSentences, 2);
        if (coreLines[0]) lines.push(buildInsightLine("核心观点", coreLines[0]));
        if (coreLines[1]) lines.push(buildInsightLine("补充观点", coreLines[1]));
        matchCount = coreLines.length;
      } else {
        baselineSentences.forEach((baseSentence) => {
          let bestScore = 0;
          let bestSentence = "";
          d.sentences.forEach(s => {
            const score = similarity(baseSentence, s);
            if (score > bestScore) {
              bestScore = score;
              bestSentence = s;
            }
          });
          if (bestScore >= 0.6) {
            matchCount += 1;
            matchLines.push(bestSentence || baseSentence);
          } else if (bestScore >= 0.25) {
            diffCount += 1;
            diffLines.push(bestSentence || baseSentence);
          } else {
            missCount += 1;
            missLines.push(baseSentence);
          }
        });
        const commonLine = collectDistinctSentences(matchLines, 1)[0];
        const diffLine = collectDistinctSentences(diffLines, 1)[0];
        const missLine = collectDistinctSentences(missLines, 1)[0];
        if (commonLine) lines.push(buildInsightLine("共同点", commonLine));
        if (diffLine) lines.push(buildInsightLine("差异点", diffLine, "cmp-mark-diff"));
        if (missLine) lines.push(buildInsightLine("未覆盖", missLine, "cmp-mark-focus"));
      }
      let snippetHtml = lines.length
        ? lines.slice(0, MAX_VISIBLE_INSIGHT_LINES).join("")
        : fallbackLines.length
          ? collectDistinctSentences(fallbackLines, 2).map((line, lineIdx) => buildInsightLine(lineIdx === 0 ? "回答提炼" : "补充信息", line)).join("")
          : "尚未抓取到摘要文本，可点击刷新回答重试";
      uniq.forEach(word => {
        const re = new RegExp(escapeRegExp(word), "ig");
        snippetHtml = snippetHtml.replace(re, (m) => `<span class="cmp-mark-diff" style="background: rgba(255, 99, 132, 0.2); padding: 0 2px; border-radius: 2px;">${m}</span>`);
      });
      const uniqText = uniq.length ? `差异词：${uniq.join("、")}` : "差异词：暂无";
      const score = diffCount * 2 + missCount;
      cards.push({
        paneId: d.paneId,
        platformKey: d.platform,
        title,
        uniqText,
        matchCount,
        diffCount,
        missCount,
        snippetHtml,
        score,
        isBaseline: idx === 0
      });
    });

    const sortedCards = [
      ...cards.filter(card => card.isBaseline),
      ...cards.filter(card => !card.isBaseline).sort((a, b) => b.score - a.score || b.diffCount - a.diffCount || b.missCount - a.missCount)
    ];

    sortedCards.forEach(cardData => {
      const iconUrl = cardData.platformKey ? getPlatformIconUrl(cardData.platformKey) : "";
      const card = document.createElement("div");
      card.className = "cmp-diff-item";
      card.dataset.platform = cardData.title;
      card.innerHTML = `
      <div class="cmp-diff-head" role="button" tabindex="0" aria-expanded="true">
        <div class="cmp-diff-head-left">
          ${iconUrl ? `<img class="cmp-diff-icon" src="${iconUrl}" alt="${cardData.title}"/>` : ""}
          <span class="cmp-diff-title">${cardData.title}</span>
        </div>
        <div class="cmp-diff-badges">
          <span class="cmp-badge match">一致 ${cardData.matchCount}</span>
          <span class="cmp-badge diff">差异 ${cardData.diffCount}</span>
          <span class="cmp-badge miss">缺失 ${cardData.missCount}</span>
        </div>
      </div>
      <div class="cmp-diff-meta">${cardData.uniqText}</div>
      <div class="cmp-diff-text">${cardData.snippetHtml}</div>
    `;

      const markNodes = card.querySelectorAll('.cmp-mark, .cmp-mark-diff, .cmp-mark-focus');
      markNodes.forEach(mark => {
        mark.style.cursor = 'pointer';
        mark.title = '点击跳转到对应内容';
        mark.addEventListener('click', () => {
          const textToFind = mark.dataset.fullText || mark.textContent;
          const targetPane = document.querySelector(`.cmp-pane[data-pane-id="${cardData.paneId}"]`);
          if (targetPane) {
            const iframe = targetPane.querySelector('iframe');
            if (iframe && iframe.contentWindow) {
              iframe.contentWindow.postMessage({ type: 'AI_SEARCH_PRO_SCROLL_TO_TEXT', text: textToFind }, '*');
              showToast(`正在跳转到 ${cardData.title} 的对应内容...`);
            }
          }
        });
      });

      const cardHead = card.querySelector(".cmp-diff-head");
      if (cardHead) {
        const collapsed = collapsedDiffCards.get(cardData.paneId) === true;
        card.classList.toggle("is-collapsed", collapsed);
        cardHead.setAttribute("aria-expanded", collapsed ? "false" : "true");
        const toggleCard = () => {
          const collapsed = card.classList.toggle("is-collapsed");
          collapsedDiffCards.set(cardData.paneId, collapsed);
          cardHead.setAttribute("aria-expanded", collapsed ? "false" : "true");
        };
        cardHead.addEventListener("click", toggleCard);
        cardHead.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            toggleCard();
          }
        });
      }

      diffListEl.appendChild(card);
    });
  
  handleDiffToggle(); // re-apply filter
}

  function getBridgeContext() {
    const restored = [];
    paneStates.forEach((state, paneId) => {
      if (state.status !== "restored") return;
      const s = paneSummaries.get(paneId) || "";
      if (s) restored.push(s);
    });
    if (!restored.length) return "";
    return restored[0].slice(0, 220);
  }

  function sendToAllWindows(text) {
    const q = normalizeText(text);
    if (!q) return;
    query = q;
    if (queryTitleEl) queryTitleEl.textContent = q;
    const requestId = makeRequestId();
    const expected = new Set();
    const failedPaneIds = new Set();
    const bridge = FEATURE_SWITCH.v2 ? getBridgeContext() : "";
    getPaneNodes().forEach(pane => {
      const paneId = pane.dataset.paneId;
      if (!paneId) return;
      expected.add(paneId);
      const state = paneStates.get(pane.dataset.paneId) || {};
      let sendText = q;
      if (FEATURE_SWITCH.v2 && state.status === "fallback" && bridge) {
        sendText = `参考上下文继续：${bridge}\n\n用户问题：${q}`;
      }
      queueSendToPane(pane, sendText, requestId, 1);
    });
    if (!expected.size) return;
    const done = new Set();
    const timer = setTimeout(() => {
      const pending = pendingSends.get(requestId);
      if (!pending) return;
      const names = Array.from(pending.failedPaneIds).map(getPaneName).filter(Boolean).join("、");
      finalizePendingSend(requestId, pending.failedPaneIds.size ? `成功 ${pending.done.size}/${pending.expected.size}，失败：${names}` : `已发送 ${pending.done.size}/${pending.expected.size} 个窗口`);
    }, 4500);
    pendingSends.set(requestId, { expected, done, failedPaneIds, timer });
    showToast("正在同步发送...");
  }

  function createPane(platformKey) {
    if (grid.children.length >= maxPanes) return;
    const selected = getSelectedPlatforms();
    let finalPlatform = platformKey;
    if (selected.includes(finalPlatform)) finalPlatform = defaultEnabled.find(k => !selected.includes(k));
    if (!finalPlatform) return;

    const pane = document.createElement("section");
    pane.className = "cmp-pane";
    pane.dataset.paneId = makeRequestId();
    pane.dataset.platformKey = finalPlatform;
    pane.draggable = true;

    const head = document.createElement("div");
    head.className = "cmp-pane-head";

    const headMain = document.createElement("div");
    headMain.className = "cmp-pane-head-main";

    const headActions = document.createElement("div");
    headActions.className = "cmp-pane-head-actions";

    const dragBtn = document.createElement("button");
    dragBtn.className = "cmp-pane-drag";
    dragBtn.draggable = ENABLE_DRAG_REORDER;
    dragBtn.innerHTML = `<img src="${dragIconUrl}" alt="drag" width="20" height="20" draggable="false" /><span class="cmp-tooltip">按住拖拽</span>`;

    const selectWrap = document.createElement("span");
    selectWrap.className = "cmp-select-wrap cmp-pane-select-wrap";

    const sel = document.createElement("select");
    sel.className = "cmp-select cmp-pane-select";
    getAvailablePlatforms([finalPlatform]).forEach(key => {
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = AI_PLATFORMS[key].name;
      sel.appendChild(opt);
    });
    sel.value = finalPlatform;
    selectWrap.appendChild(sel);

    const status = document.createElement("span");
    status.className = "cmp-pane-status restoring";
    status.setAttribute("aria-label", "继承中");
    status.innerHTML = `<span class="cmp-tooltip">继承中</span>`;

    const retryBtn = document.createElement("button");
    retryBtn.className = "cmp-pane-retry";
    retryBtn.innerHTML = `<img src="${retryIconUrl}" alt="retry" width="18" height="18" /><span class="cmp-tooltip">重试</span>`;
    retryBtn.style.display = "none";

    const moveLeftBtn = document.createElement("button");
    moveLeftBtn.className = "cmp-pane-btn cmp-pane-btn-left";
    moveLeftBtn.innerHTML = `<img src="${moveLeftIconUrl}" alt="left" width="20" height="20" /><span class="cmp-tooltip">向左移动</span>`;

    const moveRightBtn = document.createElement("button");
    moveRightBtn.className = "cmp-pane-btn cmp-pane-btn-right";
    moveRightBtn.innerHTML = `<img src="${moveRightIconUrl}" alt="right" width="20" height="20" /><span class="cmp-tooltip">向右移动</span>`;

    const openBtn = document.createElement("button");
    openBtn.className = "cmp-pane-btn cmp-pane-btn-open";
    openBtn.innerHTML = `<img src="${webIconUrl}" alt="web" width="20" height="20" /><span class="cmp-tooltip">网页打开</span>`;

    const removeBtn = document.createElement("button");
    removeBtn.className = "cmp-pane-btn cmp-pane-btn-close";
    removeBtn.innerHTML = `<img src="${closeIconUrl}" alt="close" width="20" height="20" /><span class="cmp-tooltip">关闭窗口</span>`;

    const iframe = document.createElement("iframe");
    iframe.className = "cmp-iframe";
    iframe.src = buildIframeUrl(finalPlatform);
    iframe.addEventListener("load", () => {
      if (pane.dataset.platformKey === "kimi" && query) {
        setTimeout(() => {
          queueSendToPane(pane, query, makeRequestId(), 1);
        }, 180);
      }
      startRestoreForPane(pane, false);
      requestPaneSummary(pane, 1500, "diff", 1, 4500);
    });

    sel.addEventListener("change", () => {
      const values = getSelectedPlatforms();
      const duplicated = values.filter(v => v === sel.value).length > 1;
      if (duplicated) {
        syncPaneSelectors();
        return;
      }
      iframe.src = buildIframeUrl(sel.value);
      pane.dataset.platformKey = sel.value;
      syncPaneSelectors();
      setPaneState(pane, "restoring");
    });

    retryBtn.addEventListener("click", () => {
      startRestoreForPane(pane, true);
    });

    moveLeftBtn.addEventListener("click", () => {
      const ordered = getOrderedPanes();
      const idx = ordered.indexOf(pane);
      if (idx <= 0) return;
      [ordered[idx - 1], ordered[idx]] = [ordered[idx], ordered[idx - 1]];
      applyPaneOrder(ordered);
      refreshGridCols();
    });

    moveRightBtn.addEventListener("click", () => {
      const ordered = getOrderedPanes();
      const idx = ordered.indexOf(pane);
      if (idx < 0 || idx >= ordered.length - 1) return;
      [ordered[idx], ordered[idx + 1]] = [ordered[idx + 1], ordered[idx]];
      applyPaneOrder(ordered);
      refreshGridCols();
    });

    openBtn.addEventListener("click", () => {
      window.open(iframe.src || AI_PLATFORMS[sel.value].url, "_blank");
    });

    removeBtn.addEventListener("click", () => {
      if (grid.children.length <= minPanes) return;
      paneStates.delete(pane.dataset.paneId);
      paneSummaries.delete(pane.dataset.paneId);
      pane.remove();
      refreshGridCols();
      syncPaneSelectors();
      renderDiffHighlights();
      updateRestoreSummary();
    });

    dragBtn.addEventListener("dragstart", (e) => {
      if (!ENABLE_DRAG_REORDER) {
        e.preventDefault();
        return;
      }
      e.stopPropagation();
      draggingPaneId = pane.dataset.paneId;
      pane.style.opacity = "0.6";
      const iframes = grid.querySelectorAll(".cmp-iframe");
      iframes.forEach(f => { f.style.pointerEvents = "none"; });
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("application/x-cmp-pane", pane.dataset.paneId);
        try {
          const rect = pane.getBoundingClientRect();
          e.dataTransfer.setDragImage(pane, rect.width / 2, 20);
        } catch (err) {}
      }
    });
    dragBtn.addEventListener("dragend", () => {
      if (!ENABLE_DRAG_REORDER) return;
      draggingPaneId = "";
      pane.style.opacity = "";
      const iframes = grid.querySelectorAll(".cmp-iframe");
      iframes.forEach(f => { f.style.pointerEvents = ""; });
    });
    pane.addEventListener("dragover", (e) => {
      if (!ENABLE_DRAG_REORDER) return;
      if (!draggingPaneId) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
    });
    pane.addEventListener("drop", (e) => {
      if (!ENABLE_DRAG_REORDER) return;
      if (!draggingPaneId) return;
      e.preventDefault();
      const ordered = getOrderedPanes();
      const src = ordered.find(node => node.dataset && node.dataset.paneId === draggingPaneId);
      if (!src || src === pane) return;
      const srcIdx = ordered.indexOf(src);
      const dstIdx = ordered.indexOf(pane);
      if (srcIdx < 0 || dstIdx < 0) return;
      ordered.splice(srcIdx, 1);
      ordered.splice(dstIdx, 0, src);
      applyPaneOrder(ordered);
      refreshGridCols();
    });

    headMain.appendChild(dragBtn);
    headMain.appendChild(selectWrap);
    headMain.appendChild(status);
    headActions.appendChild(retryBtn);
    headActions.appendChild(moveLeftBtn);
    headActions.appendChild(moveRightBtn);
    headActions.appendChild(openBtn);
    headActions.appendChild(removeBtn);
    head.appendChild(headMain);
    head.appendChild(headActions);
    pane.appendChild(head);
    pane.appendChild(iframe);
    pane.style.order = String(paneOrderSeed++);
    grid.appendChild(pane);
    paneStates.set(pane.dataset.paneId, { status: "restoring", reason: "", source: "" });
    refreshGridCols();
    syncPaneSelectors();
    updateRestoreSummary();
  }

  const initUnique = Array.from(new Set(initPlatforms)).filter(k => defaultEnabled.includes(k));
  initUnique.forEach(key => createPane(key));
  while (grid.children.length < minPanes && defaultEnabled[grid.children.length]) {
    const next = defaultEnabled.find(k => !getSelectedPlatforms().includes(k));
    if (!next) break;
    createPane(next);
  }

  document.addEventListener("click", (event) => {
    if (event.target.closest(".cmp-select-wrap")) return;
    closeAllSelectMenus();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeAllSelectMenus();
  });

  addBtn.addEventListener("click", () => {
    const value = selectEl.value || defaultEnabled[0];
    createPane(value);
  });

  grid.addEventListener("dragover", (e) => {
    if (!ENABLE_DRAG_REORDER) return;
    if (!draggingPaneId) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
  });
  grid.addEventListener("drop", (e) => {
    if (!ENABLE_DRAG_REORDER) return;
    if (!draggingPaneId) return;
    e.preventDefault();
  });

  syncPaneSelectors();
  updateLegendDescription();
  updateRestoreSummary();

  if (refreshBtn) {
    refreshBtn.innerHTML = `<img src="${compareRefreshIconUrl}" width="18" height="18" alt="refresh" /><span>刷新回答</span>`;
    refreshBtn.addEventListener("click", () => {
      scheduleAllSummaryExtraction();
    });
  }

  if (panelToggleEl && panelEl) {
    const tipEl = panelToggleEl.querySelector(".cmp-tooltip");
    panelToggleEl.addEventListener("click", () => {
      panelEl.classList.toggle("collapsed");
      const collapsed = panelEl.classList.contains("collapsed");
      if (tipEl) tipEl.textContent = collapsed ? "展开回答洞察" : "收起回答洞察";
      if (bodyEl) bodyEl.classList.toggle("side-collapsed", collapsed);
    });
    if (tipEl) tipEl.textContent = "收起回答洞察";
  }

  if (themeBtn) {
    themeBtn.addEventListener("click", async () => {
      const nextTheme = currentTheme === "dark" ? "light" : "dark";
      applyTheme(nextTheme);
      await persistThemePreference(nextTheme);
    });
  }

  if (settingsBtn) {
    settingsBtn.addEventListener("click", () => {
      openExtensionPage("settings/settings.html");
    });
  }

  if (favoriteBtn) {
    favoriteBtn.addEventListener("click", async () => {
      await saveFavoriteRecord();
      showToast("已保存到备忘录");
    });
  }

  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      exportMarkdownFile();
      showToast("已导出 Markdown");
    });
  }

  if (sendBtn && globalInputEl) {
    const updateSendState = () => {
      sendBtn.disabled = !normalizeText(globalInputEl.value);
    };
    const clearSentInput = () => {
      globalInputEl.value = "";
      updateSendState();
      globalInputEl.focus();
    };
    updateSendState();
    globalInputEl.addEventListener("input", updateSendState);
    sendBtn.addEventListener("click", () => {
      sendToAllWindows(globalInputEl.value);
      clearSentInput();
    });
    globalInputEl.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      if (e.shiftKey) return;
      e.preventDefault();
      sendToAllWindows(globalInputEl.value);
      clearSentInput();
    });
  }

  window.addEventListener("message", (event) => {
    const data = event.data || {};
    if (data.type === EMBEDDED_SEND_READY_RESPONSE_EVENT && data.requestId && data.paneId) {
      const key = `${data.requestId}:${data.paneId}`;
      const entry = sendReadyRequests.get(key);
      if (!entry) return;
      clearReadyRequestEntry(key);
      const pending = pendingSends.get(data.requestId);
      if (!pending || pending.done.has(data.paneId) || pending.failedPaneIds.has(data.paneId)) return;
      if (data.ready) {
        const stableDelay = typeof data.delay === "number" ? data.delay : SEND_READY_STABLE_DELAY;
        window.setTimeout(() => {
          dispatchSendToPane(entry.pane, entry.text, data.requestId);
        }, stableDelay);
      } else if (entry.attempt < SEND_READY_MAX_RETRIES) {
        queueSendToPane(entry.pane, entry.text, data.requestId, entry.attempt + 1);
      } else {
        markPaneSendFailure(data.requestId, data.paneId);
      }
      return;
    }
    if (data.type === EMBEDDED_SEND_DONE_EVENT && data.requestId) {
      const pending = pendingSends.get(data.requestId);
      if (pending && data.paneId && pending.expected.has(data.paneId)) {
        if (data.ok === false && data.paneId) {
          pending.failedPaneIds.add(data.paneId);
        } else {
          pending.done.add(data.paneId);
        }
        if (data.paneId) clearReadyRequestEntry(`${data.requestId}:${data.paneId}`);
        if (pending.done.size + pending.failedPaneIds.size >= pending.expected.size) {
          const names = Array.from(pending.failedPaneIds).map(getPaneName).filter(Boolean).join("、");
          finalizePendingSend(data.requestId, pending.failedPaneIds.size ? `部分失败：${names}` : "已同步发送到全部窗口");
        }
      }
      return;
    }
    if (data.type !== "AI_SEARCH_PRO_SUMMARY" || !data.requestId) return;
    const req = summaryRequests.get(data.requestId);
    if (!req) return;
    clearTimeout(req.timer);
    summaryRequests.delete(data.requestId);
    const pane = getPaneNodes().find(p => p.dataset.paneId === req.paneId);
    if (!pane) return;
    const text = normalizeText(data.summary || "");
    paneSummaries.set(req.paneId, text);
    if (req.mode === "restore") {
      handleRestoreResponse(pane, text, req.attempt);
    } else {
      if (text.length < MIN_VALID_SUMMARY_LENGTH && req.attempt < DIFF_SUMMARY_MAX_RETRIES) {
        requestPaneSummary(pane, DIFF_SUMMARY_DELAY, "diff", req.attempt + 1, DIFF_SUMMARY_TIMEOUT);
        return;
      }
      renderDiffHighlights();
    }
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes[CONFIG_STORAGE_KEY]?.newValue) return;
    applyTheme(resolveTheme(changes[CONFIG_STORAGE_KEY].newValue.theme));
  });
  themeMedia?.addEventListener?.("change", async () => {
    const data = await chrome.storage.local.get([CONFIG_STORAGE_KEY]);
    if (data?.[CONFIG_STORAGE_KEY]?.theme === "auto") applyTheme(resolveTheme("auto"));
  });
  scheduleAllSummaryExtraction();
  applyTheme(currentTheme);
  syncThemeFromConfig();
})();
