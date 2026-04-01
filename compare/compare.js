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
  const minPanes = 2;
  const maxPanes = 4;
  const paneSummaries = new Map();
  const summaryRequests = new Map();
  let draggingPaneId = "";
  const dragIconUrl = chrome.runtime.getURL("icons/drag.svg");

  if (queryTitleEl) queryTitleEl.textContent = query || "对话结果对比";
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
    }, 1500);
  }

  function getPaneNodes() {
    return Array.from(grid.querySelectorAll(".cmp-pane"));
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

  function requestPaneSummary(pane, delay = 1200) {
    const iframe = pane.querySelector(".cmp-iframe");
    if (!iframe || !iframe.contentWindow) return;
    const paneId = pane.dataset.paneId;
    const requestId = makeRequestId();
    const timer = window.setTimeout(() => {
      summaryRequests.delete(requestId);
      if (!paneSummaries.get(paneId)) {
        paneSummaries.set(paneId, "");
        renderDiffHighlights();
      }
    }, 4500);
    summaryRequests.set(requestId, { paneId, timer });
    window.setTimeout(() => {
      try {
        iframe.contentWindow.postMessage({ type: "AI_SEARCH_PRO_REQUEST_SUMMARY", requestId }, "*");
      } catch (e) {}
    }, delay);
  }

  function scheduleAllSummaryExtraction() {
    getPaneNodes().forEach(pane => {
      paneSummaries.set(pane.dataset.paneId, "");
      requestPaneSummary(pane, 1200);
    });
    renderDiffHighlights();
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
          lines.push(`<span class="cmp-mark">${s}</span>`);
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
            lines.push(`<span class="cmp-mark">${bestSentence || baseSentence}</span>`);
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
        snippetHtml = snippetHtml.replace(re, (m) => `<span class="cmp-mark">${m}</span>`);
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
      diffListEl.appendChild(card);
    });
  }

  function sendToAllWindows(text) {
    const q = normalizeText(text);
    if (!q) return;
    query = q;
    if (queryTitleEl) queryTitleEl.textContent = q;
    getPaneNodes().forEach(pane => {
      const iframe = pane.querySelector(".cmp-iframe");
      if (!iframe || !iframe.contentWindow) return;
      try {
        iframe.contentWindow.postMessage({ type: "AI_SEARCH_PRO_NEW_QUERY", query: q }, "*");
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
    dragBtn.innerHTML = `<img src="${dragIconUrl}" alt="drag" width="14" height="14" />`;

    const sel = document.createElement("select");
    sel.className = "cmp-pane-select";
    getAvailablePlatforms([finalPlatform]).forEach(key => {
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = AI_PLATFORMS[key].name;
      sel.appendChild(opt);
    });
    sel.value = finalPlatform;

    const openBtn = document.createElement("button");
    openBtn.className = "cmp-pane-btn";
    openBtn.textContent = "↗";

    const removeBtn = document.createElement("button");
    removeBtn.className = "cmp-pane-btn";
    removeBtn.textContent = "×";

    const iframe = document.createElement("iframe");
    iframe.className = "cmp-iframe";
    iframe.src = buildIframeUrl(finalPlatform);
    iframe.addEventListener("load", () => requestPaneSummary(pane, 1200));

    sel.addEventListener("change", () => {
      const values = getSelectedPlatforms();
      const duplicated = values.filter(v => v === sel.value).length > 1;
      if (duplicated) {
        syncPaneSelectors();
        return;
      }
      iframe.src = buildIframeUrl(sel.value);
      syncPaneSelectors();
      requestPaneSummary(pane, 1200);
    });

    openBtn.addEventListener("click", () => {
      window.open(iframe.src || AI_PLATFORMS[sel.value].url, "_blank");
    });

    removeBtn.addEventListener("click", () => {
      if (grid.children.length <= minPanes) return;
      pane.remove();
      refreshGridCols();
      syncPaneSelectors();
      renderDiffHighlights();
    });

    pane.addEventListener("dragstart", (e) => {
      if (!e.target || !e.target.closest || !e.target.closest(".cmp-pane-drag")) {
        e.preventDefault();
        return;
      }
      draggingPaneId = pane.dataset.paneId;
      pane.style.opacity = "0.6";
    });
    pane.addEventListener("dragend", () => {
      draggingPaneId = "";
      pane.style.opacity = "";
    });
    pane.addEventListener("dragover", (e) => {
      if (!draggingPaneId) return;
      e.preventDefault();
    });
    pane.addEventListener("drop", (e) => {
      if (!draggingPaneId) return;
      e.preventDefault();
      const src = Array.from(grid.children).find(node => node.dataset && node.dataset.paneId === draggingPaneId);
      if (!src || src === pane) return;
      const nodes = Array.from(grid.children);
      const srcIdx = nodes.indexOf(src);
      const dstIdx = nodes.indexOf(pane);
      if (srcIdx < dstIdx) grid.insertBefore(src, pane.nextSibling);
      else grid.insertBefore(src, pane);
      refreshGridCols();
    });

    head.appendChild(dragBtn);
    head.appendChild(sel);
    head.appendChild(openBtn);
    head.appendChild(removeBtn);
    pane.appendChild(head);
    pane.appendChild(iframe);
    grid.appendChild(pane);
    refreshGridCols();
    syncPaneSelectors();
    requestPaneSummary(pane, 1400);
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

  syncPaneSelectors();

  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      scheduleAllSummaryExtraction();
      showToast("正在刷新高亮...");
    });
  }

  if (panelToggleEl && panelEl) {
    panelToggleEl.addEventListener("click", () => {
      panelEl.classList.toggle("collapsed");
      const collapsed = panelEl.classList.contains("collapsed");
      panelToggleEl.textContent = collapsed ? "◂" : "▸";
      if (bodyEl) bodyEl.classList.toggle("side-collapsed", collapsed);
    });
    panelToggleEl.textContent = "▸";
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
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        sendToAllWindows(globalInputEl.value);
        updateSendState();
      }
    });
  }

  window.addEventListener("message", (event) => {
    const data = event.data || {};
    if (data.type !== "AI_SEARCH_PRO_SUMMARY" || !data.requestId) return;
    const req = summaryRequests.get(data.requestId);
    if (!req) return;
    clearTimeout(req.timer);
    summaryRequests.delete(data.requestId);
    paneSummaries.set(req.paneId, normalizeText(data.summary || ""));
    renderDiffHighlights();
  });

  scheduleAllSummaryExtraction();
})();
