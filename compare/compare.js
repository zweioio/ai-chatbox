(() => {
  const AI_PLATFORMS = {
    doubao: { name: "豆包", url: "https://www.doubao.com/chat/" },
    qianwen: { name: "千问", url: "https://www.qianwen.com/" },
    deepseek: { name: "DeepSeek", url: "https://chat.deepseek.com/" },
    yuanbao: { name: "元宝", url: "https://yuanbao.tencent.com/chat/naQivTmsDa" },
    kimi: { name: "Kimi", url: "https://kimi.moonshot.cn/" },
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
  const countEl = document.getElementById("cmp-count");
  const refreshBtn = document.getElementById("cmp-refresh-btn");
  const panelEl = document.getElementById("cmp-panel");
  const panelToggleEl = document.getElementById("cmp-panel-toggle");
  const globalInputEl = document.getElementById("cmp-global-input");
  const sendBtn = document.getElementById("cmp-send-btn");
  const toastEl = document.getElementById("cmp-toast");
  const grid = document.getElementById("cmp-grid");
  const bodyEl = document.getElementById("cmp-body");
  const keywordsEl = document.getElementById("cmp-keywords");
  const diffListEl = document.getElementById("cmp-diff-list");
  const diffOnlyToggleEl = document.getElementById("cmp-diff-only-toggle");
  const minPanes = 2;
  const maxPanes = 4;
  const paneSummaries = new Map();
  const paneStates = new Map();
  const summaryRequests = new Map();
  let draggingPaneId = "";
  let paneOrderSeed = 1;
  const ENABLE_DRAG_REORDER = true;
  const dragIconUrl = chrome.runtime.getURL("icons/drag.svg");
  const closeIconUrl = chrome.runtime.getURL("icons/close.svg");
  const webIconUrl = chrome.runtime.getURL("icons/web.svg");
  const moveLeftIconUrl = chrome.runtime.getURL("icons/platform-arrow-left.svg");
  const moveRightIconUrl = chrome.runtime.getURL("icons/platform-arrow-right.svg");

  if (queryTitleEl) queryTitleEl.textContent = query || "内容对比";
  if (globalInputEl) globalInputEl.value = query;

  defaultEnabled.forEach(key => {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = AI_PLATFORMS[key].name;
    selectEl.appendChild(opt);
  });

  function buildIframeUrl(platformKey) {
    if (initialUrls[platformKey]) return initialUrls[platformKey];
    const base = AI_PLATFORMS[platformKey].url;
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

  function normalizeText(text) {
    return (text || "").replace(/\s+/g, " ").trim();
  }

  function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function tokenize(text) {
    const t = normalizeText(text).toLowerCase();
    const matches = t.match(/[\u4e00-\u9fa5]{2,}|[a-z]{3,}/g) || [];
    return matches.filter(w => !/^https?$/.test(w));
  }

  function splitSentences(text) {
    return (text || "")
      .replace(/\r/g, "\n")
      .split(/(?<=[。！？!?;；\n])/)
      .map(v => normalizeText(v))
      .filter(v => v.length >= 8)
      .slice(0, 24);
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

  function getPaneNodes() {
    return Array.from(grid.querySelectorAll(".cmp-pane"));
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
    addBtn.disabled = grid.children.length >= maxPanes || available.length === 0;
    if (countEl) countEl.textContent = `${grid.children.length}/${maxPanes}`;
  }

  function updateRestoreSummary() {
    if (!restoreSummaryEl) return;
    const all = getPaneNodes().length;
    let restored = 0;
    let fallback = 0;
    let restoring = 0;
    paneStates.forEach(v => {
      if (v.status === "restored") restored += 1;
      else if (v.status === "fallback") fallback += 1;
      else restoring += 1;
    });
    restoreSummaryEl.textContent = `已继承 ${restored} · 回退 ${fallback} · 处理中 ${restoring} / ${all}`;
  }

  function setPaneState(pane, status, reason = "", source = "") {
    const paneId = pane.dataset.paneId;
    const old = paneStates.get(paneId) || {};
    paneStates.set(paneId, { ...old, status, reason, source });
    const badge = pane.querySelector(".cmp-pane-status");
    const retryBtn = pane.querySelector(".cmp-pane-retry");
    if (badge) {
      badge.className = `cmp-pane-status ${status}`;
      if (status === "restored") badge.textContent = "已继承";
      else if (status === "fallback") badge.textContent = "已回退";
      else badge.textContent = "继承中";
      badge.title = reason || "";
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
        if (!paneSummaries.get(paneId)) {
          paneSummaries.set(paneId, "");
          renderDiffHighlights();
        }
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
    if (text.length >= 24) {
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
      requestPaneSummary(pane, 1200, "diff", 1, 4500);
    });
    renderDiffHighlights();
  }

  function handleDiffToggle() {
    if (!diffOnlyToggleEl) return;
    const isDiffOnly = diffOnlyToggleEl.checked;
    const items = diffListEl.querySelectorAll(".cmp-diff-item");
    items.forEach(item => {
      const matchCountBadge = item.querySelector(".cmp-badge.match");
      const matchCount = matchCountBadge ? parseInt(matchCountBadge.textContent.replace(/[^0-9]/g, ''), 10) : 0;
      const diffCountBadge = item.querySelector(".cmp-badge.diff");
      const diffCount = diffCountBadge ? parseInt(diffCountBadge.textContent.replace(/[^0-9]/g, ''), 10) : 0;
      
      if (isDiffOnly) {
        if (diffCount === 0 && matchCount > 0) {
          item.style.display = "none";
        } else {
          item.style.display = "flex";
          // We can also hide matching sentences inside the text, but for now we'll just hide entirely identical panels or show them
          const marks = item.querySelectorAll(".cmp-diff-text span:not(.cmp-mark)");
          // The current implementation uses span.cmp-mark for matches or differences?
          // Actually, cmp-mark is used for matches in sentences, and diff words. Let's keep it simple: just hide identical blocks.
        }
      } else {
        item.style.display = "flex";
      }
    });
  }

  if (diffOnlyToggleEl) {
    diffOnlyToggleEl.addEventListener("change", handleDiffToggle);
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

    const keywordPool = [];
    data.forEach(d => {
      keywordPool.push(...Array.from(new Set(d.tokens)).filter(t => tokenFreq.get(t) === 1).slice(0, 6));
    });

    keywordsEl.innerHTML = "";
    Array.from(new Set(keywordPool)).slice(0, 30).forEach(word => {
      const item = document.createElement("span");
      item.className = "cmp-keyword";
      item.textContent = word;
      keywordsEl.appendChild(item);
    });

    const baseline = data[0];
    const baselineSentences = baseline ? baseline.sentences.slice(0, 10) : [];
    diffListEl.innerHTML = "";
    data.forEach((d, idx) => {
      const card = document.createElement("div");
      card.className = "cmp-diff-item";
      const title = AI_PLATFORMS[d.platform] ? AI_PLATFORMS[d.platform].name : d.platform;
      const uniq = Array.from(new Set(d.tokens)).filter(t => tokenFreq.get(t) === 1).slice(0, 5);
      let matchCount = 0;
      let diffCount = 0;
      let missCount = 0;
      const lines = [];
      if (idx === 0) {
        baselineSentences.slice(0, 5).forEach(s => {
          lines.push(`<span class="cmp-mark" style="cursor:pointer;" title="点击跳转到对应内容">${s}</span>`);
          matchCount += 1;
        });
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
            lines.push(`<span class="cmp-mark" style="cursor:pointer;" title="点击跳转到对应内容">${bestSentence || baseSentence}</span>`);
          } else if (bestScore >= 0.25) {
            diffCount += 1;
            lines.push(bestSentence || baseSentence);
          } else {
            missCount += 1;
          }
        });
      }
    let snippetHtml = lines.length ? lines.slice(0, 5).join(" ") : "尚未抓取到摘要文本，可点击刷新高亮重试。";
    uniq.forEach(word => {
      const re = new RegExp(escapeRegExp(word), "ig");
      snippetHtml = snippetHtml.replace(re, (m) => `<span class="cmp-mark-diff" style="background: rgba(255, 99, 132, 0.2); padding: 0 2px; border-radius: 2px;">${m}</span>`);
    });
    const uniqText = uniq.length ? `差异词：${uniq.join("、")}` : "差异词：暂无";
    card.innerHTML = `
      <div class="cmp-diff-head">${title} · ${uniqText}</div>
      <div class="cmp-diff-badges">
        <span class="cmp-badge match">一致 ${matchCount}</span>
        <span class="cmp-badge diff">差异 ${diffCount}</span>
        <span class="cmp-badge miss">缺失 ${missCount}</span>
      </div>
      <div class="cmp-diff-text">${snippetHtml}</div>
    `;
    
    const markNodes = card.querySelectorAll('.cmp-mark, .cmp-mark-diff');
    markNodes.forEach(mark => {
      mark.style.cursor = 'pointer';
      mark.title = '点击跳转到对应内容';
      mark.addEventListener('click', () => {
        const textToFind = mark.textContent;
        const targetPane = document.querySelector(`.cmp-pane[data-pane-id="${d.paneId}"]`);
        if (targetPane) {
          const iframe = targetPane.querySelector('iframe');
          if (iframe && iframe.contentWindow) {
            iframe.contentWindow.postMessage({ type: 'AI_SEARCH_PRO_SCROLL_TO_TEXT', text: textToFind }, '*');
            showToast(`正在跳转到 ${title} 的对应内容...`);
          }
        }
      });
    });

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
    const bridge = FEATURE_SWITCH.v2 ? getBridgeContext() : "";
    getPaneNodes().forEach(pane => {
      const iframe = pane.querySelector(".cmp-iframe");
      if (!iframe || !iframe.contentWindow) return;
      const state = paneStates.get(pane.dataset.paneId) || {};
      let sendText = q;
      if (FEATURE_SWITCH.v2 && state.status === "fallback" && bridge) {
        sendText = `参考上下文继续：${bridge}\n\n用户问题：${q}`;
      }
      try {
        iframe.contentWindow.postMessage({ type: "AI_SEARCH_PRO_NEW_QUERY", query: sendText }, "*");
      } catch (e) {}
    });
    showToast("已同步发送到全部窗口");
    setTimeout(() => scheduleAllSummaryExtraction(), 1200);
    setTimeout(() => scheduleAllSummaryExtraction(), 2600);
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
    pane.draggable = true;

    const head = document.createElement("div");
    head.className = "cmp-pane-head";

    const dragBtn = document.createElement("button");
    dragBtn.className = "cmp-pane-drag";
    dragBtn.draggable = ENABLE_DRAG_REORDER;
    dragBtn.innerHTML = `<img src="${dragIconUrl}" alt="drag" width="20" height="20" draggable="false" /><span class="cmp-tooltip">按住拖拽</span>`;

    const sel = document.createElement("select");
    sel.className = "cmp-pane-select";
    getAvailablePlatforms([finalPlatform]).forEach(key => {
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = AI_PLATFORMS[key].name;
      sel.appendChild(opt);
    });
    sel.value = finalPlatform;

    const status = document.createElement("span");
    status.className = "cmp-pane-status restoring";
    status.textContent = "继承中";

    const retryBtn = document.createElement("button");
    retryBtn.className = "cmp-pane-retry";
    retryBtn.textContent = "重试";
    retryBtn.style.display = "none";

    const moveLeftBtn = document.createElement("button");
    moveLeftBtn.className = "cmp-pane-btn cmp-pane-btn-left";
    moveLeftBtn.innerHTML = `<img src="${moveLeftIconUrl}" alt="left" width="20" height="20" /><span class="cmp-tooltip">向左移动</span>`;

    const moveRightBtn = document.createElement("button");
    moveRightBtn.className = "cmp-pane-btn cmp-pane-btn-right";
    moveRightBtn.innerHTML = `<img src="${moveRightIconUrl}" alt="right" width="20" height="20" /><span class="cmp-tooltip">向右移动</span>`;

    const openBtn = document.createElement("button");
    openBtn.className = "cmp-pane-btn";
    openBtn.innerHTML = `<img src="${webIconUrl}" alt="web" width="20" height="20" /><span class="cmp-tooltip">网页打开</span>`;

    const removeBtn = document.createElement("button");
    removeBtn.className = "cmp-pane-btn";
    removeBtn.innerHTML = `<img src="${closeIconUrl}" alt="close" width="20" height="20" /><span class="cmp-tooltip">关闭</span>`;

    const iframe = document.createElement("iframe");
    iframe.className = "cmp-iframe";
    iframe.src = buildIframeUrl(finalPlatform);
    iframe.addEventListener("load", () => {
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

    head.appendChild(dragBtn);
    head.appendChild(sel);
    head.appendChild(status);
    head.appendChild(retryBtn);
    head.appendChild(moveLeftBtn);
    head.appendChild(moveRightBtn);
    head.appendChild(openBtn);
    head.appendChild(removeBtn);
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
  updateRestoreSummary();

  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      scheduleAllSummaryExtraction();
      showToast("正在刷新高亮...");
    });
  }

  if (panelToggleEl && panelEl) {
    const tipEl = panelToggleEl.querySelector(".cmp-tooltip");
    panelToggleEl.addEventListener("click", () => {
      panelEl.classList.toggle("collapsed");
      const collapsed = panelEl.classList.contains("collapsed");
      if (tipEl) tipEl.textContent = collapsed ? "展开差异高亮" : "收起差异高亮";
      if (bodyEl) bodyEl.classList.toggle("side-collapsed", collapsed);
    });
    if (tipEl) tipEl.textContent = "收起差异高亮";
  }

  if (sendBtn && globalInputEl) {
    const updateSendState = () => {
      sendBtn.disabled = !normalizeText(globalInputEl.value);
    };
    updateSendState();
    globalInputEl.addEventListener("input", updateSendState);
    sendBtn.addEventListener("click", () => {
      sendToAllWindows(globalInputEl.value);
      updateSendState();
    });
    globalInputEl.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      if (e.shiftKey) return;
      e.preventDefault();
      sendToAllWindows(globalInputEl.value);
      updateSendState();
    });
  }

  window.addEventListener("message", (event) => {
    const data = event.data || {};
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
      renderDiffHighlights();
    }
  });

  scheduleAllSummaryExtraction();
})();
