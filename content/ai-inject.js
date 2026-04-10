(function() {
  // 只在 iframe 中运行
  if (window === window.top) return;

  let hasInjected = false;
  let lastHref = window.location.href;
  let lastLoadCompletedAt = document.readyState === "complete" ? Date.now() : 0;
  const extensionOrigin = new URL(chrome.runtime.getURL("")).origin;
  const EMBEDDED_SEND_EVENT = "AI_SP_EMBEDDED_SEND";
  const EMBEDDED_SEND_DONE_EVENT = "AI_SP_EMBEDDED_SEND_DONE";
  const EMBEDDED_SEND_READY_REQUEST_EVENT = "AI_SP_EMBEDDED_SEND_READY_REQUEST";
  const EMBEDDED_SEND_READY_RESPONSE_EVENT = "AI_SP_EMBEDDED_SEND_READY_RESPONSE";
  const EMBEDDED_LOCATION_REQUEST_EVENT = "AI_SP_EMBEDDED_LOCATION_REQUEST";
  const EMBEDDED_LOCATION_EVENT = "AI_SP_EMBEDDED_LOCATION";
  const EMBEDDED_SEND_READY_DELAY_MS = 420;
  
  function publishLocation(requestId) {
    const href = window.location.href;
    const shouldForcePublish = typeof requestId === "string";
    if (!shouldForcePublish && href === lastHref) return;
    lastHref = href;
    window.parent.postMessage({ type: EMBEDDED_LOCATION_EVENT, href, requestId }, extensionOrigin);
    window.parent.postMessage({ type: "AI_SEARCH_PRO_URL_SYNC", url: href }, "*");
  }

  function syncLocation() {
    const href = window.location.href;
    if (href === lastHref) return;
    lastHref = href;
    lastLoadCompletedAt = document.readyState === "complete" ? Date.now() : 0;
    window.parent.postMessage({ type: EMBEDDED_LOCATION_EVENT, href }, extensionOrigin);
    window.parent.postMessage({ type: "AI_SEARCH_PRO_URL_SYNC", url: href }, "*");
  }

  function getQueryFromHash() {
    const hash = window.location.hash;
    if (hash.startsWith('#q=')) {
      return decodeURIComponent(hash.substring(3));
    }
    return '';
  }

  function normalizeInjectedText(text) {
    return (text || "").replace(/\s+/g, " ").trim();
  }

  function ensureHostLayoutStyle() {
    const host = window.location.hostname;
    const styleId = 'ai-sp-injected-style';
    if (document.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id = styleId;
    let css = '';
    if (host.includes('deepseek.com')) {
      css += `
        [role="dialog"] { display: none !important; opacity: 0 !important; pointer-events: none !important; }
      `;
    } else if (host.includes('qianwen.com') || host.includes('tongyi.aliyun.com') || host.includes('yuanbao.tencent.com')) {
      css += `
        .layout-sider { display: none !important; width: 0 !important; }
        .layout-content { width: 100% !important; max-width: 100% !important; }
      `;
    }
    style.innerHTML = css;
    if (document.head) document.head.appendChild(style);
  }

  function applyQianwenFallbackLayout() {
    const host = window.location.hostname;
    if (!(host.includes('qianwen.com') || host.includes('tongyi.aliyun.com'))) return;
    
    const setStyle = (el, prop, value) => {
      if (el.style.getPropertyValue(prop) !== value) {
        el.style.setProperty(prop, value, 'important');
      }
    };

    const sidebars = document.querySelectorAll('.layout-sider, .ant-layout-sider, aside[class*="sider"], div[class*="sider"]');
    sidebars.forEach(el => {
      setStyle(el, 'display', 'none');
      setStyle(el, 'width', '0px');
      setStyle(el, 'min-width', '0px');
      setStyle(el, 'flex', '0 0 0px');
    });

    const likelySidebarCandidates = document.querySelectorAll('aside, nav, [role="navigation"], div[class*="sidebar"], div[class*="sider"], section[class*="sidebar"]');
    likelySidebarCandidates.forEach(el => {
      if (!isVisibleElement(el)) return;
      const identity = `${el.tagName} ${el.id || ''} ${el.className || ''} ${el.getAttribute('role') || ''}`.toLowerCase();
      const isExplicitSidebar = /sidebar|sider|navigation|drawer|menu/.test(identity) || el.tagName === 'ASIDE' || el.tagName === 'NAV';
      if (!isExplicitSidebar) return;
      const rect = el.getBoundingClientRect();
      const maxSidebarWidth = Math.min(320, Math.max(220, window.innerWidth * 0.36));
      const looksLikeLeftSidebar = rect.left <= 16 && rect.width >= 160 && rect.width <= maxSidebarWidth && rect.height >= Math.max(360, window.innerHeight * 0.6);
      if (!looksLikeLeftSidebar) return;
      setStyle(el, 'display', 'none');
      setStyle(el, 'width', '0px');
      setStyle(el, 'min-width', '0px');
      setStyle(el, 'flex', '0 0 0px');
      setStyle(el, 'overflow', 'hidden');
      setStyle(el, 'pointer-events', 'none');
    });

    const contents = document.querySelectorAll('.layout-content, .ant-layout-content, main[class*="layout"], div[class*="layout-content"]');
    contents.forEach(el => {
      setStyle(el, 'width', '100%');
      setStyle(el, 'max-width', '100%');
      setStyle(el, 'min-width', '0px');
      setStyle(el, 'flex', '1 1 auto');
    });

    const mains = document.querySelectorAll('main, [role="main"], #app, #root');
    mains.forEach(el => {
      setStyle(el, 'width', '100%');
      setStyle(el, 'max-width', '100%');
      setStyle(el, 'min-width', '0px');
    });
    const editors = document.querySelectorAll('#chat-input, textarea, div[data-slate-editor="true"][contenteditable="true"], div[role="textbox"][contenteditable="true"]');
    editors.forEach(el => {
      setStyle(el, 'max-width', '100%');
      const wrap = el.closest('form, [class*="input"], [class*="editor"], [class*="chat"], [class*="content"]');
      if (wrap) {
        setStyle(wrap, 'max-width', '100%');
        setStyle(wrap, 'width', '100%');
        setStyle(wrap, 'min-width', '0px');
      }
    });
  }

  function getConfig() {
    const host = window.location.hostname;
    const base = {
      inputs: ['textarea', 'div[contenteditable="true"]', 'div[role="textbox"][contenteditable="true"]'],
      buttons: ['button[type="submit"]', 'button[aria-label*="send" i]', 'button[aria-label*="发送"]', '.send-button', 'button[class*="send" i]'],
      submitAssist: false,
    };
    if (host.includes('doubao.com')) {
      return {
        inputs: [
          'div[data-testid="chat_input_input"]',
          'div.ql-editor[contenteditable="true"]',
          'textarea'
        ],
        buttons: [
          'button[data-testid="chat_input_send_button"]',
          'button[data-testid="send_button"]',
          'button[aria-label*="发送"]',
          'button[type="submit"]',
        ],
        submitAssist: true,
      };
    }
    if (host.includes('chatgpt.com')) {
      return {
        inputs: ['#prompt-textarea', 'textarea'],
        buttons: ['button[data-testid="send-button"]', 'button[aria-label*="Send prompt"]', 'button[type="submit"]'],
        submitAssist: false,
      };
    }
    if (host.includes('qianwen.com') || host.includes('tongyi.aliyun.com')) {
      return {
        inputs: [
          'div.chatInput-ucD7bG div[role="textbox"][data-placeholder="向千问提问"][data-slate-editor="true"][contenteditable="true"]',
          'div.inputContainer-ti33qt div[role="textbox"][data-placeholder="向千问提问"][data-slate-editor="true"][contenteditable="true"]',
          'div[data-slate-editor="true"][contenteditable="true"]',
          'div[role="textbox"][contenteditable="true"]',
          'div[role="textbox"][data-placeholder][contenteditable="true"]',
          'div[contenteditable="true"][data-placeholder]',
          'textarea[placeholder*="向千问"]',
          'textarea[placeholder*="提问"]',
          'textarea[class*="chatInput"]',
          'textarea'
        ],
        buttons: [
          '.right-XCy4NU .operateBtn-ehxNOr',
          '.operateBtn-ehxNOr',
          'div[class*="operateBtn"]',
          'button[aria-label*="发送"]',
          'button[aria-label*="Send"]',
          'button[type="submit"]',
          'button[class*="send"]'
        ],
        submitAssist: true,
      };
    }
    if (host.includes('yuanbao.tencent.com')) {
      return {
        inputs: ['textarea', 'div[role="textbox"][contenteditable="true"]', 'div[data-slate-editor="true"][contenteditable="true"]', 'div[contenteditable="true"]'],
        buttons: ['button[aria-label*="发送"]', 'button[aria-label*="Send"]', 'button[type="submit"]', 'button[class*="send"]', 'div[role="button"][aria-label*="发送"]'],
        submitAssist: true,
      };
    }
    if (host.includes('deepseek.com')) {
      return {
        inputs: ['#chat-input', 'textarea', 'div[contenteditable="true"]'],
        buttons: [],
        submitAssist: true,
      };
    }
    if (host.includes('kimi.moonshot.cn') || host.includes('kimi.com')) {
      return {
        inputs: [
          '.chat-input-editor[data-lexical-editor="true"][contenteditable="true"][role="textbox"]',
          '.chat-input-editor[data-lexical-editor="true"][contenteditable="true"]',
          '.editor[contenteditable="true"]',
          '.ProseMirror[contenteditable="true"]',
          'div[data-slate-editor="true"][contenteditable="true"]',
          'div[role="textbox"][contenteditable="true"]',
          'div[contenteditable="true"].editor',
        ],
        buttons: ['button[class*="sendButton"]', 'button[class*="send-button"]', 'button[aria-label*="发送"]', 'button[aria-label*="Send"]', 'button[type="submit"]'],
        submitAssist: false,
      };
    }
    if (host.includes('grok.com')) {
      return {
        inputs: ['textarea[placeholder*="Ask"]', 'textarea[aria-label*="Ask"]', 'textarea', 'div[contenteditable="true"]'],
        buttons: ['button[aria-label*="Grok"]', 'button[aria-label*="Send"]', 'button[aria-label*="Search"]', 'button[class*="send"]', 'button[type="submit"]'],
        submitAssist: false,
      };
    }
    if (host.includes('chatglm.cn')) {
      return {
        inputs: ['textarea', 'div[contenteditable="true"]'],
        buttons: ['button[aria-label*="发送"]', 'button[aria-label*="Send"]', 'button[class*="send"]', 'button[type="submit"]'],
        submitAssist: false,
      };
    }
    if (host.includes('gemini.google.com')) {
      return {
        inputs: ['div[role="textbox"][contenteditable="true"]', 'textarea', 'div[contenteditable="true"]'],
        buttons: ['button[aria-label*="Send message"]', 'button[aria-label*="发送"]', 'button.send-button', 'button[type="submit"]'],
        submitAssist: false,
      };
    }
    if (host.includes('claude.ai')) {
      return {
        inputs: ['div[contenteditable="true"]', 'textarea'],
        buttons: ['button[aria-label*="Send Message"]', 'button[aria-label*="Send message"]', 'button[type="submit"]'],
        submitAssist: false,
      };
    }
    if (host.includes('perplexity.ai')) {
      return {
        inputs: ['textarea', 'div[contenteditable="true"]'],
        buttons: ['button[aria-label*="Submit"]', 'button[aria-label*="Send"]', 'button[type="submit"]'],
        submitAssist: false,
      };
    }
    if (host.includes('copilot.microsoft.com')) {
      return {
        inputs: ['textarea', 'div[contenteditable="true"]'],
        buttons: ['button[aria-label*="Submit"]', 'button[aria-label*="Send"]', 'button[type="submit"]'],
        submitAssist: false,
      };
    }
    return base;
  }

  function isVisibleElement(el) {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden';
  }

  function findInputTarget(config) {
    const host = window.location.hostname;
    const selectors = (config?.inputs || []).filter(Boolean);
    for (const selector of selectors) {
      const els = Array.from(document.querySelectorAll(selector));
      const visibleEls = els.filter(isVisibleElement).filter((el) => {
        if (!(host.includes("qianwen.com") || host.includes("tongyi.aliyun.com"))) return true;
        return el.getAttribute("aria-disabled") !== "true";
      });
      if (visibleEls.length === 0) continue;
      visibleEls.sort((a, b) => b.getBoundingClientRect().top - a.getBoundingClientRect().top);
      return visibleEls[0];
    }
    return null;
  }

  function getQianwenComposerRoot(target) {
    return target?.closest(".inputOutWrap-_hjFu_")
      || target?.closest(".inputContainer-ti33qt")
      || target?.closest(".chatInput-ucD7bG")
      || target?.closest("form")
      || target?.closest('[class*="chatInput"]')
      || target?.closest('[class*="inputWrap"]')
      || target?.closest('[class*="inputArea"]')
      || target?.closest('[class*="editor"]')
      || target?.parentElement
      || null;
  }

  function placeCaretAtEnd(target) {
    const selection = window.getSelection();
    if (!selection) return;
    const tailRange = document.createRange();
    tailRange.selectNodeContents(target);
    tailRange.collapse(false);
    selection.removeAllRanges();
    selection.addRange(tailRange);
  }

  function maintainInputFocus(target, isContentEditable) {
    const focusOnce = () => {
      target.focus();
      if (isContentEditable) placeCaretAtEnd(target);
    };
    focusOnce();
    requestAnimationFrame(focusOnce);
    window.setTimeout(focusOnce, 70);
    window.setTimeout(focusOnce, 180);
  }

  // 根据配置直接暴露函数供外部调用
  window.__AI_SEARCH_PRO_INJECT_TEXT = function(text, avoidFocus = true) {
    const config = getConfig();
    const inputEl = findInputTarget(config);
    if (!inputEl) return false;
    
    // 注入的核心逻辑，完全参考竞品的 insertToChat
    const host = window.location.hostname;
    const isContentEditable = inputEl.getAttribute("contenteditable") === "true" || inputEl.isContentEditable;
    const needsSubmitAssist = config.submitAssist;
    const shouldTemporarilyFocus = avoidFocus && needsSubmitAssist;
    
    if (inputEl.tagName === "TEXTAREA" || inputEl.tagName === "INPUT") {
      if (!avoidFocus || shouldTemporarilyFocus) {
        inputEl.focus();
      }
      const prototype = inputEl.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
      if (descriptor && descriptor.set) {
        descriptor.set.call(inputEl, text);
      } else {
        inputEl.value = text;
      }
      inputEl.dispatchEvent(new Event("input", { bubbles: true }));
      inputEl.dispatchEvent(new Event("change", { bubbles: true }));
      
      if ("setSelectionRange" in inputEl) {
        try {
          const end = inputEl.value.length;
          inputEl.setSelectionRange(end, end);
        } catch (e) {}
      }
      
      if (!avoidFocus) {
        maintainInputFocus(inputEl, false);
      }
      return true;
    }
    
    if (isContentEditable) {
      const currentText = normalizeInjectedText(inputEl.innerText || inputEl.textContent || "");
      const nextText = normalizeInjectedText(text);
      if (currentText === nextText) {
        return true;
      }
      if (!avoidFocus || shouldTemporarilyFocus) {
        inputEl.focus();
      }
      const selection = window.getSelection();
      if (!avoidFocus || shouldTemporarilyFocus) {
        const range = document.createRange();
        range.selectNodeContents(inputEl);
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
      
      let inserted = false;
      // 参考竞品：仅对千问系优先尝试剪贴板注入（Kimi 直接走 execCommand 更稳定）
      if (host.includes('qianwen.com') || host.includes('tongyi.aliyun.com') || host.includes('yuanbao.tencent.com')) {
        const beforeText = inputEl.textContent ?? "";
        try {
          const clipboardData = new DataTransfer();
          clipboardData.setData("text/plain", text);
          const pasteEvent = new ClipboardEvent("paste", {
            bubbles: true,
            cancelable: true,
            clipboardData: clipboardData
          });
          inputEl.dispatchEvent(pasteEvent);
        } catch (e) {}
        const afterText = inputEl.textContent ?? "";
        inserted = afterText !== beforeText;
      }
      
      if (!inserted) {
        inserted = document.execCommand("insertText", false, text);
      }
      
      if (!inserted) {
        inputEl.textContent = text;
      }
      
      inputEl.dispatchEvent(new InputEvent("input", {
        bubbles: true,
        cancelable: true,
        inputType: "insertText",
        data: text
      }));
      inputEl.dispatchEvent(new Event("change", { bubbles: true }));
      
      if (!avoidFocus) maintainInputFocus(inputEl, true);
      return true;
    }
    
    return false;
  };

  window.__AI_SEARCH_PRO_SUBMIT_CHAT = function(avoidFocus = true) {
    const config = getConfig();
    const target = findInputTarget(config);
    const host = window.location.hostname;
    const shouldTemporarilyFocus = Boolean(target && avoidFocus && config.submitAssist);
    
    if (target && shouldTemporarilyFocus) {
      target.focus();
    }
    
    let button = null;
    
    // DeepSeek 特殊逻辑：防误触寻找按钮
    if (host.includes('deepseek.com')) {
      const wrappers = [target?.closest('div[class*="chat-input"]'), target?.closest('div')].filter(Boolean);
      for (const wrapper of wrappers) {
        if (wrapper && wrapper.parentElement) {
          const buttons = wrapper.parentElement.querySelectorAll('div[role="button"]');
          button = Array.from(buttons).find(b => {
            const isSidebar = b.className.includes('sidebar') || (b.getAttribute('aria-label') || '').toLowerCase().includes('sidebar');
            const isSendSvg = b.innerHTML.includes('M2 12') || b.innerHTML.includes('M2.01 21') || b.innerHTML.includes('M2.01 21L23 12');
            return !isSidebar && isSendSvg;
          });
          if (button) break;
        }
      }
    } else {
      for (const selector of config.buttons) {
        button = Array.from(document.querySelectorAll(selector)).find(el => {
          if (!isVisibleElement(el)) return false;
          if (el.getAttribute("aria-disabled") === "true" || el.className.includes("disabled") || el.disabled) return false;
          return true;
        });
        if (button) break;
      }
    }

    if (button) {
      button.click();
      if (shouldTemporarilyFocus) {
        requestAnimationFrame(() => target?.blur());
      }
      return true;
    }

    if (target) {
      if (!avoidFocus || shouldTemporarilyFocus) {
        target.focus();
      }
      const form = target.closest("form");
      if (form) {
        if (typeof form.requestSubmit === "function") {
          form.requestSubmit();
        } else {
          form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
        }
        if (shouldTemporarilyFocus) {
          requestAnimationFrame(() => target.blur());
        }
        return true;
      }
      
      const enterDown = new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true });
      const enterPress = new KeyboardEvent("keypress", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true });
      const enterUp = new KeyboardEvent("keyup", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true });
      
      target.dispatchEvent(enterDown);
      target.dispatchEvent(enterPress);
      target.dispatchEvent(enterUp);

      if (host.includes('qianwen.com') || host.includes('tongyi.aliyun.com') || host.includes('yuanbao.tencent.com')) {
        const cmdEnterDown = new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, which: 13, metaKey: true, ctrlKey: true, bubbles: true, cancelable: true });
        const cmdEnterPress = new KeyboardEvent("keypress", { key: "Enter", code: "Enter", keyCode: 13, which: 13, metaKey: true, ctrlKey: true, bubbles: true, cancelable: true });
        const cmdEnterUp = new KeyboardEvent("keyup", { key: "Enter", code: "Enter", keyCode: 13, which: 13, metaKey: true, ctrlKey: true, bubbles: true, cancelable: true });
        target.dispatchEvent(cmdEnterDown);
        target.dispatchEvent(cmdEnterPress);
        target.dispatchEvent(cmdEnterUp);
      }
      
      if (shouldTemporarilyFocus) {
        requestAnimationFrame(() => target.blur());
      }
      return true;
    }
    return false;
  };

  // 全局注入入口
  function injectQuery() {
    if (hasInjected) return;
    ensureHostLayoutStyle();
    const host = window.location.hostname;
    if (host.includes('kimi.moonshot.cn') || host.includes('kimi.com')) return;
    
    const query = getQueryFromHash();
    if (!query) return;
    const storageKey = `ai_sp_last_query_${window.location.hostname}`;
    
    // DeepSeek 防侧边栏弹窗强力轮询
    if (host.includes('deepseek.com')) {
      setInterval(() => {
        const dialogs = document.querySelectorAll('[role="dialog"], .ReactModalPortal');
        dialogs.forEach(d => { if (d.style.display !== 'none') d.style.setProperty('display', 'none', 'important'); });
        
        const sidebars = document.querySelectorAll('div[class*="sidebar"], aside, div[aria-label*="sidebar" i], div[aria-label*="侧边栏"]');
        sidebars.forEach(s => {
           if (s.style.display !== 'none') {
             const tagName = s.tagName.toLowerCase();
             if (tagName !== 'button' && s.getAttribute('role') !== 'button' && s.querySelector('svg') === null) {
               s.style.setProperty('display', 'none', 'important');
               s.style.setProperty('width', '0', 'important');
               s.style.setProperty('opacity', '0', 'important');
               s.style.setProperty('pointer-events', 'none', 'important');
             }
           }
        });
      }, 200);
    }

    const inserted = window.__AI_SEARCH_PRO_INJECT_TEXT(query, true);
    
    if (inserted) {
      const { initialDelay, retryDelay, maxAttempts } = getSubmitRetryConfig();
      const finishInjected = () => {
        hasInjected = true;
        sessionStorage.setItem(storageKey, query);
        window.parent.postMessage({ type: 'AI_SEARCH_PRO_LOADED' }, '*');
        publishLocation();
      };
      const runSubmit = (attempt = 1) => {
        const submitted = window.__AI_SEARCH_PRO_SUBMIT_CHAT(true);
        if (submitted) {
          finishInjected();
          return;
        }
        if (attempt >= maxAttempts) {
          finishInjected();
          return;
        }
        window.setTimeout(() => runSubmit(attempt + 1), retryDelay);
      };
      window.setTimeout(() => {
        runSubmit(1);
      }, initialDelay);
    }
  }

  function findSubmitTarget(config) {
    const host = window.location.hostname;
    const selectors = (config?.buttons || []).filter(Boolean);
    const inputTarget = findInputTarget(config);
    if ((host.includes("qianwen.com") || host.includes("tongyi.aliyun.com")) && inputTarget) {
      const scopedRoot = getQianwenComposerRoot(inputTarget);
      if (scopedRoot) {
        for (const selector of selectors) {
          try {
            const button = Array.from(scopedRoot.querySelectorAll(selector)).find((el) => {
              if (!el || !isVisibleElement(el)) return false;
              if (el.getAttribute("aria-disabled") === "true" || el.className.includes("disabled") || el.disabled) return false;
              return true;
            });
            if (button) return button;
          } catch (e) {}
        }
      }
    }
    for (const selector of selectors) {
      try {
        const button = Array.from(document.querySelectorAll(selector)).find((el) => {
          if (!el || !isVisibleElement(el)) return false;
          if (el.getAttribute("aria-disabled") === "true" || el.className.includes("disabled") || el.disabled) return false;
          return true;
        });
        if (button) return button;
      } catch (e) {}
    }
    return null;
  }

  function getReadyStableDelay() {
    const host = window.location.hostname;
    if (host.includes("deepseek.com")) return 420;
    return 320;
  }

  function getSubmitRetryConfig() {
    const host = window.location.hostname;
    if (host.includes("deepseek.com")) {
      return { initialDelay: 260, retryDelay: 280, maxAttempts: 18 };
    }
    return { initialDelay: 120, retryDelay: 260, maxAttempts: 16 };
  }

  function isPlatformReadyForSend() {
    if (document.readyState !== "complete") return false;
    const config = getConfig();
    const inputEl = findInputTarget(config);
    if (!inputEl || !isVisibleElement(inputEl)) return false;
    return true;
  }

  ensureHostLayoutStyle();
  applyQianwenFallbackLayout();
  
  // 使用 MutationObserver 实时监控 DOM 变化，强制应用 Qianwen 的后备布局
  const host = window.location.hostname;
  if (host.includes('qianwen.com') || host.includes('tongyi.aliyun.com')) {
    const observer = new MutationObserver(() => {
      applyQianwenFallbackLayout();
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });
    window.addEventListener('resize', () => {
      window.requestAnimationFrame(() => {
        applyQianwenFallbackLayout();
      });
    });
  }

  // 轮询查找 DOM 元素，因为 SPA 渲染有延迟
  let injectAttempts = 0;
  const intervalId = setInterval(() => {
    if (hasInjected || injectAttempts > 50) { // 最多尝试约10秒
      clearInterval(intervalId);
      return;
    }
    injectAttempts++;
    injectQuery();
  }, 200);

  // 监听 hash 变化，支持同一个页面的多次搜索
  window.addEventListener('hashchange', () => {
    hasInjected = false;
    injectAttempts = 0;
    injectQuery();
  });

  function normalizeSummaryText(text) {
    return (text || '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function isVisibleElement(el) {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden';
  }

  function extractSummaryText() {
    const host = window.location.hostname;
    const MIN_SUMMARY_TEXT_LENGTH = 8;
    const MAX_ASSISTANT_BLOCKS = 12;
    const MAX_FALLBACK_BLOCKS = 8;
    const MAX_SUMMARY_CHARACTERS = 8000;
    const assistantSelectors = [];
    const userSelectors = [];
    const fallbackSelectors = [];
    if (host.includes('doubao.com')) {
      assistantSelectors.push('[data-testid*="message"] [data-testid*="assistant"]', '[class*="assistant"]', '[class*="answer"]', '[class*="markdown"]');
      userSelectors.push('[data-testid*="message"] [data-testid*="user"]', '[class*="user"]');
      fallbackSelectors.push('main [class*="answer"]', 'main [class*="markdown"]');
    } else if (host.includes('chatgpt.com')) {
      assistantSelectors.push('[data-message-author-role="assistant"]', 'main [class*="prose"]');
      userSelectors.push('[data-message-author-role="user"]');
      fallbackSelectors.push('main article');
    } else if (host.includes('deepseek.com')) {
      assistantSelectors.push('[class*="assistant"]', '[class*="markdown"]', '[class*="answer"]');
      userSelectors.push('[class*="user"]');
      fallbackSelectors.push('main article', 'main [class*="markdown"]');
    } else if (host.includes('kimi.moonshot.cn') || host.includes('kimi.com')) {
      assistantSelectors.push('[data-role="assistant"]', '[class*="assistant"]', '[class*="markdown"]');
      userSelectors.push('[data-role="user"]', '[class*="user"]');
      fallbackSelectors.push('main article', 'main [class*="markdown"]');
    } else if (host.includes('qianwen.com') || host.includes('tongyi.aliyun.com')) {
      assistantSelectors.push('[class*="assistant"]', '[class*="answer"]', '[class*="markdown"]');
      userSelectors.push('[class*="user"]', '[data-role="user"]');
      fallbackSelectors.push('main article', 'main [class*="answer"]');
    } else if (host.includes('yuanbao.tencent.com')) {
      assistantSelectors.push('[class*="assistant"]', '[class*="answer"]', '[class*="markdown"]');
      userSelectors.push('[class*="user"]', '[data-role="user"]');
      fallbackSelectors.push('main article');
    } else if (host.includes('claude.ai')) {
      assistantSelectors.push('[data-is-streaming]', '[class*="font-claude-message"]', '[class*="assistant"]', 'main article');
      userSelectors.push('[class*="user"]', '[data-testid*="user"]');
      fallbackSelectors.push('main article');
    } else if (host.includes('gemini.google.com')) {
      assistantSelectors.push('[data-response-id]', '[class*="model-response"]', '[class*="response-container"]', 'main article');
      userSelectors.push('[class*="query-text"]', '[class*="user-query"]', '[class*="user"]');
      fallbackSelectors.push('main article');
    } else if (host.includes('perplexity.ai')) {
      assistantSelectors.push('[class*="prose"]', '[class*="answer"]', 'main article');
      userSelectors.push('textarea', '[class*="user"]');
      fallbackSelectors.push('main article');
    } else if (host.includes('copilot.microsoft.com')) {
      assistantSelectors.push('[class*="ac-textBlock"]', '[class*="message-content"]', 'main article');
      userSelectors.push('[class*="user"]', '[data-content="user"]');
      fallbackSelectors.push('main article');
    } else if (host.includes('grok.com')) {
      assistantSelectors.push('[class*="assistant"]', '[class*="response"]', 'main article');
      userSelectors.push('[class*="user"]');
      fallbackSelectors.push('main article');
    } else if (host.includes('chatglm.cn')) {
      assistantSelectors.push('[class*="assistant"]', '[class*="answer"]', '[class*="markdown"]');
      userSelectors.push('[class*="user"]');
      fallbackSelectors.push('main article');
    } else if (host.includes('z.ai')) {
      assistantSelectors.push('[class*="assistant"]', '[class*="answer"]', '[class*="markdown"]', 'main article');
      userSelectors.push('[class*="user"]');
      fallbackSelectors.push('main article');
    } else {
      assistantSelectors.push('[class*="assistant"]', '[class*="answer"]', '[class*="markdown"]', 'main article');
      userSelectors.push('[class*="user"]');
      fallbackSelectors.push('main article');
    }

    let parts = [];
    const ignoredLinePattern = /^(继续追问|猜你想问|相关问题|为你推荐|推荐问题|延伸阅读|换个问法|重新生成|复制|分享|点赞|点踩|搜索|上传附件|选择文件|全部内容由AI生成|内容由AI生成|仅供参考|展开更多|收起|发送|停止生成|深度思考|联网搜索)([:：].*)?$/i;
    const ignoredBlockPattern = /(猜你想问|相关问题|为你推荐|推荐问题|延伸阅读|换个问法|相关搜索|推荐阅读)/i;
    const ignoredTailPattern = /\s*(猜你想问|相关问题|为你推荐|推荐问题|延伸阅读|换个问法|相关搜索|推荐阅读)([:：].*)?[\s\S]*$/i;
    const cleanSummaryBlock = (text) => {
      const raw = String(text || "")
        .replace(/\r/g, "\n")
        .replace(/\u00a0/g, " ")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
      if (!raw) return "";
      const trimmed = raw.replace(ignoredTailPattern, "").trim();
      const source = trimmed || raw;
      const lines = source
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean)
        .filter((line) => !ignoredLinePattern.test(line))
        .filter((line) => !ignoredBlockPattern.test(line))
        .filter((line) => line.length >= 4);
      return normalizeSummaryText(lines.join("\n"));
    };

    const hasUserContent = userSelectors.some((sel) => {
      try {
        return Array.from(document.querySelectorAll(sel)).some((el) => isVisibleElement(el) && normalizeSummaryText(el.innerText || '').length >= 2);
      } catch (e) {
        return false;
      }
    });

    let assistantHits = 0;
    let assistantCandidateCount = 0;
    assistantSelectors.forEach(sel => {
      try {
        Array.from(document.querySelectorAll(sel)).slice(-MAX_ASSISTANT_BLOCKS).forEach(el => {
          if (!isVisibleElement(el)) return;
          assistantCandidateCount += 1;
          const t = cleanSummaryBlock(el.innerText || '');
          if (t.length >= MIN_SUMMARY_TEXT_LENGTH) {
            parts.push(t);
            assistantHits += 1;
          }
        });
      } catch (e) {}
    });

    if (!parts.length && (hasUserContent || assistantCandidateCount > 0)) {
      const fallbackQuery = Array.from(new Set([
        ...fallbackSelectors,
        'main [class*="prose"]',
        'main [class*="markdown"]',
        'article [class*="prose"]',
        'article [class*="markdown"]',
        '[role="main"] article'
      ])).join(', ');
      const fallbackBlocks = Array.from(document.querySelectorAll(fallbackQuery))
        .filter(isVisibleElement)
        .slice(-MAX_FALLBACK_BLOCKS)
        .map((el) => cleanSummaryBlock(el.innerText || ''))
        .filter((text) => text.length >= MIN_SUMMARY_TEXT_LENGTH);
      if (fallbackBlocks.length) {
        parts = fallbackBlocks;
      }
    }

    if (!hasUserContent && !assistantHits) return '';

    const dedupedParts = Array.from(new Set(parts.map((part) => normalizeSummaryText(part)).filter(Boolean)));
    return normalizeSummaryText(dedupedParts.slice(-MAX_ASSISTANT_BLOCKS).join('\n')).slice(0, MAX_SUMMARY_CHARACTERS);
  }
  
  window.addEventListener("message", (event) => {
    const data = event.data || {};
    if (event.origin !== extensionOrigin) return;

    if (data.type === EMBEDDED_SEND_READY_REQUEST_EVENT) {
      const requestId = typeof data.requestId === "string" ? data.requestId : "";
      window.parent.postMessage({
        type: EMBEDDED_SEND_READY_RESPONSE_EVENT,
        requestId,
        paneId: data.paneId,
        ready: isPlatformReadyForSend(),
        delay: getReadyStableDelay()
      }, extensionOrigin);
      return;
    }

    if (data.type === EMBEDDED_LOCATION_REQUEST_EVENT) {
      publishLocation(typeof data.requestId === "string" ? data.requestId : undefined);
      return;
    }

    if (data.type === EMBEDDED_SEND_EVENT && typeof data.text === "string") {
      const requestId = typeof data.requestId === "string" ? data.requestId : "";
      const completed = window.__aiSpCompletedSendIds ?? new Set();
      const pending = window.__aiSpPendingSendIds ?? new Set();
      window.__aiSpCompletedSendIds = completed;
      window.__aiSpPendingSendIds = pending;
      if (requestId && completed.has(requestId)) {
        window.parent.postMessage({ type: EMBEDDED_SEND_DONE_EVENT, requestId, paneId: data.paneId, ok: true }, extensionOrigin);
        return;
      }
      if (requestId && pending.has(requestId)) {
        return;
      }
      const isDocumentReady = document.readyState === "complete";
      const loadSettled = lastLoadCompletedAt > 0 && Date.now() - lastLoadCompletedAt >= EMBEDDED_SEND_READY_DELAY_MS;
      if (!isDocumentReady || !loadSettled) {
        return;
      }
      if (!isPlatformReadyForSend()) {
        return;
      }
      const inserted = window.__AI_SEARCH_PRO_INJECT_TEXT(data.text, true);
      if (!inserted) {
        return;
      }
      if (data.submit === false) {
        if (requestId) completed.add(requestId);
        window.parent.postMessage({ type: EMBEDDED_SEND_DONE_EVENT, requestId, paneId: data.paneId, ok: true }, extensionOrigin);
        return;
      }
      const { initialDelay, retryDelay, maxAttempts } = getSubmitRetryConfig();
      if (requestId) pending.add(requestId);
      const runSubmit = (attempt = 0) => {
        const submitted = window.__AI_SEARCH_PRO_SUBMIT_CHAT(true);
        if (submitted) {
          if (requestId) {
            pending.delete(requestId);
            completed.add(requestId);
          }
          window.parent.postMessage({ type: EMBEDDED_SEND_DONE_EVENT, requestId, paneId: data.paneId, ok: true }, extensionOrigin);
          return;
        }
        if (attempt >= maxAttempts) {
          if (requestId) pending.delete(requestId);
          return;
        }
        window.setTimeout(() => runSubmit(attempt + 1), retryDelay);
      };
      window.setTimeout(() => {
        runSubmit(0);
      }, initialDelay);
      return;
    }

    if (data.type === "AI_SEARCH_PRO_NEW_QUERY") {
      const newQuery = data.query;
      if (newQuery) {
        const inserted = window.__AI_SEARCH_PRO_INJECT_TEXT(newQuery, true);
        if (inserted) {
          const { initialDelay, retryDelay, maxAttempts } = getSubmitRetryConfig();
          const runSubmit = (attempt = 1) => {
            const submitted = window.__AI_SEARCH_PRO_SUBMIT_CHAT(true);
            if (submitted || attempt >= maxAttempts) return;
            window.setTimeout(() => runSubmit(attempt + 1), retryDelay);
          };
          window.setTimeout(() => {
            runSubmit(1);
          }, initialDelay);
        }
      }
      return;
    }

    if (data.type === "AI_SEARCH_PRO_SCROLL_TO_TEXT") {
      const textToFind = event.data.text;
      if (!textToFind) return;
      
      // 简单的高亮与滚动实现
      // 遍历所有可能的文本节点寻找匹配的文字
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
      let node;
      let targetElement = null;
      
      while (node = walker.nextNode()) {
        if (node.nodeValue.includes(textToFind) && node.parentElement) {
          const style = window.getComputedStyle(node.parentElement);
          if (style.display !== 'none' && style.visibility !== 'hidden') {
            targetElement = node.parentElement;
            break; // 找到第一个匹配的就停止
          }
        }
      }
      
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const originalBg = targetElement.style.backgroundColor;
        const originalTransition = targetElement.style.transition;
        const originalOutline = targetElement.style.outline;
        const originalOutlineOffset = targetElement.style.outlineOffset;
        const originalBoxShadow = targetElement.style.boxShadow;
        const originalBorderRadius = targetElement.style.borderRadius;
        targetElement.style.transition = 'background-color 0.3s ease';
        targetElement.style.backgroundColor = 'rgba(255, 235, 59, 0.6)';
        targetElement.style.outline = '2px solid rgba(79, 70, 229, 0.9)';
        targetElement.style.outlineOffset = '3px';
        targetElement.style.boxShadow = '0 0 0 6px rgba(79, 70, 229, 0.16)';
        targetElement.style.borderRadius = targetElement.style.borderRadius || '6px';
        
        setTimeout(() => {
          targetElement.style.backgroundColor = originalBg;
          targetElement.style.outline = originalOutline;
          targetElement.style.outlineOffset = originalOutlineOffset;
          targetElement.style.boxShadow = originalBoxShadow;
          targetElement.style.borderRadius = originalBorderRadius;
          setTimeout(() => {
            targetElement.style.transition = originalTransition;
          }, 300);
        }, 2000);
      }
    }

    if (data.type === "AI_SEARCH_PRO_THEME_CHANGE") {
      const theme = data.theme;
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
        if (!host.includes('chatgpt.com') && !host.includes('kimi.moonshot.cn') && !host.includes('kimi.com')) {
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
    }

    if (data.type === "AI_SEARCH_PRO_REQUEST_SUMMARY") {
      const requestId = data.requestId || '';
      const summary = extractSummaryText();
      window.parent.postMessage({
        type: 'AI_SEARCH_PRO_SUMMARY',
        requestId,
        summary,
        url: window.location.href
      }, '*');
    }
  });

  window.parent.postMessage({ type: EMBEDDED_LOCATION_EVENT, href: lastHref }, extensionOrigin);
  window.addEventListener("load", () => {
    lastLoadCompletedAt = Date.now();
    publishLocation();
  });
  window.addEventListener("hashchange", syncLocation);
  window.addEventListener("popstate", syncLocation);
  window.setInterval(syncLocation, 1000);

  // 10秒后停止轮询，避免性能消耗
  setTimeout(() => {
    clearInterval(intervalId);
  }, 10000);

})();
