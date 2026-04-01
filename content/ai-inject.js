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
    const contents = document.querySelectorAll('.layout-content, .ant-layout-content, main[class*="layout"], div[class*="layout-content"]');
    contents.forEach(el => {
      setStyle(el, 'width', '100%');
      setStyle(el, 'max-width', '100%');
      setStyle(el, 'min-width', '0px');
      setStyle(el, 'flex', '1 1 auto');
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

  function injectQuery() {
    if (hasInjected) return;
    ensureHostLayoutStyle();
    
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
    
    // 强力轮询去弹窗 (DeepSeek 特别顽固)
    if (host.includes('deepseek.com')) {
      setInterval(() => {
        // 隐藏遮罩层和弹窗
        const dialogs = document.querySelectorAll('[role="dialog"], .ReactModalPortal');
        dialogs.forEach(d => {
          if (d.style.display !== 'none') {
            d.style.setProperty('display', 'none', 'important');
          }
        });
        
        // 隐藏左侧侧边栏 (根据常见 class 或 aria-label 过滤)
        const sidebars = document.querySelectorAll('div[class*="sidebar"], aside, div[aria-label*="sidebar" i], div[aria-label*="侧边栏"]');
        sidebars.forEach(s => {
           if (s.style.display !== 'none') {
             // 检查它是否真的是侧边栏，而不是一些包含该类名的无辜元素（比如按钮）
             const tagName = s.tagName.toLowerCase();
             if (tagName !== 'button' && s.getAttribute('role') !== 'button' && s.querySelector('svg') === null) {
               s.style.setProperty('display', 'none', 'important');
               s.style.setProperty('width', '0', 'important');
               s.style.setProperty('opacity', '0', 'important');
               s.style.setProperty('pointer-events', 'none', 'important');
             }
           }
        });
        
        // 强制关闭可能打开的菜单/下拉框
        const menus = document.querySelectorAll('[id*="menu"], [class*="menu"]');
        menus.forEach(m => {
          const style = window.getComputedStyle(m);
          if (style.position === 'absolute' || style.position === 'fixed') {
            m.style.setProperty('display', 'none', 'important');
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
      'button[class*="send" i]'
    ];

    if (host.includes('doubao.com')) {
      inputSelector = 'textarea[data-testid="chat_input_input"], #chat-input, div.ql-editor[contenteditable="true"], textarea';
      btnSelectors = ['button[data-testid="chat_input_send_button"]', 'button[data-testid="send_button"]', 'button[aria-label="发送"]'];
    } else if (host.includes('chatgpt.com')) {
      inputSelector = '#prompt-textarea';
      btnSelectors = ['button[data-testid="send-button"]'];
    } else if (host.includes('yuanbao.tencent.com')) {
      inputSelector = 'textarea, div[role="textbox"][contenteditable="true"], div[data-slate-editor="true"][contenteditable="true"], div[contenteditable="true"]';
      btnSelectors = ['button[aria-label*="发送"]', 'button[aria-label*="Send"]', 'button[type="submit"]', 'button[class*="send"]', 'div[role="button"][aria-label*="发送"]'];
    } else if (host.includes('qianwen.com') || host.includes('tongyi.aliyun.com') || host.includes('yuanbao.tencent.com')) {
      inputSelector = '#chat-input, textarea, div[data-slate-editor="true"][contenteditable="true"]';
      btnSelectors = ['div[class*="operateBtn"]', 'button[aria-label*="发送"]', 'button[aria-label*="Send"]', 'button[class*="send"]', 'button[type="submit"]', 'div[class*="sendBtn"]'];
    } else if (host.includes('deepseek.com')) {
      // DeepSeek 的输入框现在主要是 #chat-input 或者是 contenteditable
      inputSelector = '#chat-input, textarea, div[contenteditable="true"]'; 
      // 避免选中包含 sidebar 或 user-menu 的按钮
      btnSelectors = []; // 对于 DeepSeek，我们完全依赖下面的“特定处理”来找按钮，不要在通用逻辑里找，以免点错
    } else if (host.includes('kimi.moonshot.cn') || host.includes('kimi.com')) {
      inputSelector = '.chat-input-editor[data-lexical-editor="true"][contenteditable="true"][role="textbox"], .chat-input-editor[data-lexical-editor="true"][contenteditable="true"], .editor[contenteditable="true"], .ProseMirror[contenteditable="true"], div[data-slate-editor="true"][contenteditable="true"], div[role="textbox"][contenteditable="true"], div[contenteditable="true"].editor';
      btnSelectors = ['button[class*="sendButton"]', 'button[class*="send-button"]', 'button[aria-label*="发送"]', 'button[aria-label*="Send"]', 'button[type="submit"]'];
    } else if (host.includes('grok.com')) {
      inputSelector = 'textarea[placeholder*="Ask"], textarea[aria-label*="Ask"], textarea, div[contenteditable="true"]';
      btnSelectors = ['button[aria-label*="Grok"]', 'button[aria-label*="Send"]', 'button[aria-label*="Search"]', 'button[class*="send"]', 'svg[class*="send"]'];
    }

    // 寻找输入框
    let inputEl = null;
    const selectors = inputSelector.split(',').map(s => s.trim());
    for (const selector of selectors) {
      const els = Array.from(document.querySelectorAll(selector));
      const visibleEls = els.filter(el => {
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetWidth > 0;
      });
      if (visibleEls.length > 0) {
        inputEl = visibleEls[visibleEls.length - 1]; // pick the last visible one (usually the chat input at the bottom)
        break;
      }
    }
    if (inputEl) {
      // 激活输入框
      inputEl.focus();

      // 如果是 DeepSeek，尝试直接触发 React 的 setValue，避免侧边栏被误触
      if (host.includes('deepseek.com')) {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
        if (nativeInputValueSetter) {
           nativeInputValueSetter.call(inputEl, query);
        } else {
           inputEl.value = query;
        }
        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        inputEl.dispatchEvent(new Event('change', { bubbles: true }));
        
        // DeepSeek 也可能用了 contenteditable，尝试双重赋值
        if (inputEl.isContentEditable) {
           // 确保全选并替换
           document.execCommand('selectAll', false, null);
           document.execCommand('insertText', false, query);
           inputEl.dispatchEvent(new InputEvent("input", { bubbles: true, cancelable: true, inputType: "insertText", data: query }));
        }
        
        // DeepSeek 最新版本可能有的时候在输入时会拦截 focus 事件触发侧边栏，强行移除可能导致打开侧边栏的类名
        const body = document.body;
        if (body.classList.contains('sidebar-open')) {
            body.classList.remove('sidebar-open');
        }
        // 对于有些版本的 DeepSeek 还需要触发 compositionend 才能激活发送按钮
        inputEl.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
      } else {
        // 填充内容
        if (inputEl.isContentEditable) {
          // Kimi 等使用 contenteditable 的输入框
          inputEl.focus();
          
          // Kimi 的特殊处理：它使用 ProseMirror，需要通过原生的 TextEvent 或特定的输入方式触发状态更新
          if (host.includes('kimi.moonshot.cn') || host.includes('kimi.com')) {
            inputEl.focus();
            
            // Kimi 可能会有残留文本，我们尝试全选再替换
            try { document.execCommand('selectAll', false, null); } catch(e) {}
            
            // 竞品逻辑：完全依赖于 execCommand("insertText")
            // 绝大部分现代富文本编辑器（包括 ProseMirror）都会拦截这个命令并正确处理
            let inserted = false;
            try {
              inserted = document.execCommand("insertText", false, query);
            } catch (e) {}

            // 如果没生效，再尝试模拟剪贴板
            if (!inserted || !inputEl.textContent.includes(query)) {
              try {
                const clipboardData = new DataTransfer();
                clipboardData.setData("text/plain", query);
                const pasteEvent = new ClipboardEvent("paste", {
                  bubbles: true,
                  cancelable: true,
                  clipboardData: clipboardData
                });
                inputEl.dispatchEvent(pasteEvent);
              } catch (e) {}
            }
          } else {
            // 其他普通的 contenteditable
            document.execCommand('selectAll', false, null);
            document.execCommand('insertText', false, query);
          }
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
        
        // 对于通义千问的特殊处理：模拟真实的输入过程
        if (host.includes('qianwen.com') || host.includes('tongyi.aliyun.com') || host.includes('yuanbao.tencent.com')) {
          // 千问的输入逻辑极度依赖内部的 Slate.js，最稳妥的办法是聚焦后，通过原生剪贴板事件，不使用 execCommand 也不改 textContent
          if (inputEl.isContentEditable) {
            inputEl.focus();
            
            // 确保光标在最后
            try {
              const selection = window.getSelection();
              selection.selectAllChildren(inputEl);
              selection.collapseToEnd();
            } catch(e) {}
            
            // 为了防止千问因为重试或重复触发导致的多次粘贴，我们加一个标记
            if (inputEl.dataset.injected !== query) {
               try {
                 const clipboardData = new DataTransfer();
                 clipboardData.setData("text/plain", query);
                 const pasteEvent = new ClipboardEvent("paste", {
                   bubbles: true,
                   cancelable: true,
                   clipboardData: clipboardData
                 });
                 inputEl.dispatchEvent(pasteEvent);
                 inputEl.dataset.injected = query; // 标记已注入该词
               } catch (e) {}
            }
          } else {
             const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
             if (nativeInputValueSetter) {
                nativeInputValueSetter.call(inputEl, query);
             } else {
                inputEl.value = query;
             }
             inputEl.dispatchEvent(new Event('input', { bubbles: true }));
             inputEl.dispatchEvent(new Event('change', { bubbles: true }));
          }
        } else {
          // 触发 compositionend 处理千问等中文输入法状态
          inputEl.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
        }
  
        // 对于基于 React/Vue 的富文本编辑器（如某些平台的 contenteditable），还需要抛出 InputEvent
        if (inputEl.isContentEditable && !host.includes('kimi.moonshot.cn')) {
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
      }

      // 统一使用双重保障机制：优先尝试点击发送按钮，如果找不到按钮或者按钮无效，则兜底使用模拟回车发送
      setTimeout(() => {
        const markDone = () => {
           hasInjected = true;
           sessionStorage.setItem(storageKey, query);
           window.parent.postMessage({ type: 'AI_SEARCH_PRO_LOADED' }, '*');
           syncUrlToParent();
        };

        // 针对豆包的发送优化：它的按钮有时可能被覆盖或者事件冒泡被拦截，需要更暴力的点击
        if (host.includes('doubao.com')) {
          let doubaoBtn = document.querySelector('button[data-testid="chat_input_send_button"]') || 
                          document.querySelector('button[data-testid="send_button"]') || 
                          document.querySelector('button[aria-label="发送"]');
          if (doubaoBtn && !doubaoBtn.disabled) {
            doubaoBtn.dispatchEvent(new MouseEvent('mousedown', { view: window, bubbles: true, cancelable: true }));
            doubaoBtn.dispatchEvent(new MouseEvent('mouseup', { view: window, bubbles: true, cancelable: true }));
            doubaoBtn.dispatchEvent(new MouseEvent('click', { view: window, bubbles: true, cancelable: true }));
            try { doubaoBtn.click(); } catch(e) {}
          } else {
             inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
          }
          markDone();
          return;
        }

        // Kimi 的回车发送策略
        if (host.includes('kimi.moonshot.cn') || host.includes('kimi.com')) {
          setTimeout(() => {
            // 竞品找按钮的方法
            let kimiBtn = document.querySelector('button[class*="sendButton"]') || 
                          document.querySelector('button[class*="send-button"]') || 
                          document.querySelector('button[aria-label*="发送"]') ||
                          document.querySelector('button[aria-label*="Send"]') ||
                          document.querySelector('button[type="submit"]');
            
            if (kimiBtn && !kimiBtn.disabled) {
              try {
                kimiBtn.click();
              } catch(e) {
                kimiBtn.dispatchEvent(new MouseEvent('click', { view: window, bubbles: true, cancelable: true }));
              }
            } else {
              // Kimi 的回车
              const enterEvent = new KeyboardEvent('keydown', { 
                key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true
              });
              inputEl.dispatchEvent(enterEvent);
            }
            markDone();
          }, 600); // Kimi 的编辑器反应非常慢，给足 600ms 等待它的 UI 变成可发送状态
          return;
        }

        // 千问的发送策略
        if (host.includes('qianwen.com') || host.includes('tongyi.aliyun.com') || host.includes('yuanbao.tencent.com')) {
          // 增加更长延迟，确保剪贴板粘贴的文本已经彻底被千问的 React 状态接管
          setTimeout(() => {
            // 参考竞品：千问的发送按钮通常可以通过 aria-label 等找到
            const qianwenBtn = document.querySelector('div[class*="operateBtn"]') || 
                               document.querySelector('button[aria-label*="发送"]') || 
                               document.querySelector('button[aria-label*="Send"]') ||
                               document.querySelector('button[class*="send"]') ||
                               document.querySelector('div[class*="send-btn"]') ||
                               document.querySelector('div[class*="send_btn"]') ||
                               document.querySelector('div[class*="chat-input-send"]') ||
                               document.querySelector('button[type="submit"]');
                               
            if (qianwenBtn && (!qianwenBtn.disabled || qianwenBtn.getAttribute('aria-disabled') === 'false')) {
              // 对于千问和元宝，简单的 click() 或标准的 MouseEvent
              try { 
                qianwenBtn.click(); 
              } catch(e) {
                qianwenBtn.dispatchEvent(new MouseEvent('mousedown', { view: window, bubbles: true, cancelable: true }));
                qianwenBtn.dispatchEvent(new MouseEvent('mouseup', { view: window, bubbles: true, cancelable: true }));
                qianwenBtn.dispatchEvent(new MouseEvent('click', { view: window, bubbles: true, cancelable: true }));
              }
            } else {
               // 兜底回车，触发全套键盘事件
              inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
              inputEl.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
              inputEl.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
            }
            markDone();
          }, 500); // 增加延迟到 500ms
          return;
        }

        // DeepSeek 特殊处理：寻找真正的发送按钮，通常在输入框的同一级或父级的右侧
        if (host.includes('deepseek.com')) {
           // 首先尝试通过特定的类名或结构找
           let dsSendBtn = document.querySelector('div[role="button"]:has(svg path[d*="M2 12"]):not([class*="sidebar"])') || 
                           document.querySelector('div[role="button"]:has(svg path[d*="M2.01 21"]):not([class*="sidebar"])') ||
                           document.querySelector('div[role="button"]:has(svg path[d*="M2.01 21L23 12"]):not([class*="sidebar"])') ||
                           document.querySelector('div[role="button"][aria-label*="发送"]') ||
                           document.querySelector('div[role="button"][aria-label*="Send"]'); // 常见的发送图标特征
           
           if (!dsSendBtn) {
             // 尝试找输入框旁边的 div 按钮，精准匹配包含发送 svg 的按钮
             const wrapper = inputEl.closest('div[class*="chat-input"]') || inputEl.closest('div'); 
             if (wrapper) {
               const buttons = wrapper.parentElement.querySelectorAll('div[role="button"]');
               dsSendBtn = Array.from(buttons).find(b => {
                 const isStopBtn = b.innerHTML.includes('<rect') || (b.getAttribute('aria-label') && b.getAttribute('aria-label').toLowerCase().includes('stop'));
                 const isSidebarBtn = b.className.includes('sidebar') || (b.getAttribute('aria-label') && b.getAttribute('aria-label').toLowerCase().includes('sidebar'));
                 // 必须包含特定的 path，避免点到别的功能按钮（如附件）
                 const isSendSvg = b.innerHTML.includes('M2 12') || b.innerHTML.includes('M2.01 21') || b.innerHTML.includes('M2.01 21L23 12') || b.innerHTML.includes('M3.4 22');
                 return b.querySelector('svg') && !isSidebarBtn && !isStopBtn && isSendSvg && !b.className.includes('disabled');
               });
             }
           }
           
           if (!dsSendBtn) {
             // 最暴力的兜底：直接找所有 svg，看哪个像发送按钮
             const svgs = document.querySelectorAll('svg');
             for (const svg of svgs) {
               if (svg.innerHTML.includes('M2 12') || svg.innerHTML.includes('M2.01 21') || svg.innerHTML.includes('M2.01 21L23 12') || svg.innerHTML.includes('M3.4 22')) {
                 const btn = svg.closest('div[role="button"]') || svg.parentElement;
                 if (btn && !btn.className.includes('disabled') && !btn.className.includes('sidebar')) {
                   dsSendBtn = btn;
                   break;
                 }
               }
             }
           }
           
           if (dsSendBtn) {
              // 发送前再给输入框派发一次回车，以防按钮被禁用
              inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
              inputEl.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
              inputEl.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
              
              // 触发完整的鼠标点击事件生命周期
              dsSendBtn.dispatchEvent(new MouseEvent('mousedown', { view: window, bubbles: true, cancelable: true }));
              dsSendBtn.dispatchEvent(new MouseEvent('mouseup', { view: window, bubbles: true, cancelable: true }));
              dsSendBtn.dispatchEvent(new MouseEvent('click', { view: window, bubbles: true, cancelable: true }));
              try { dsSendBtn.click(); } catch(e) {}
              markDone();
              return;
           }
        }

        // 1. 尝试查找发送按钮
        let btnEl = null;
        for (const selector of btnSelectors) {
          const els = Array.from(document.querySelectorAll(selector));
          // 找一个可见的、未被禁用的按钮
          btnEl = els.find(el => {
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden') return false;
            // 如果是在 DeepSeek 下且是那个包含 svg 的 div，即使有 disabled 属性也强行尝试（因为它可能是通过 pointer-events 控制的）
            if (host.includes('deepseek.com') && el.tagName.toLowerCase() === 'div' && el.querySelector('svg')) {
               const isSidebar = el.className.includes('sidebar') || (el.getAttribute('aria-label') && el.getAttribute('aria-label').toLowerCase().includes('sidebar')) || el.innerHTML.includes('sidebar');
               // 确保是发送按钮（匹配特定的 SVG path，排除附件按钮）
               const isSendSvg = el.innerHTML.includes('M2 12') || el.innerHTML.includes('M2.01 21') || el.innerHTML.includes('M2.01 21L23 12');
               if (!isSidebar && isSendSvg) return true;
            }
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
           
           // DeepSeek 的发送前再补一次回车，并尝试触发鼠标按下/抬起事件
           if (host.includes('deepseek.com')) {
              inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
              btnEl.dispatchEvent(new MouseEvent('mousedown', { view: window, bubbles: true, cancelable: true }));
              btnEl.dispatchEvent(new MouseEvent('mouseup', { view: window, bubbles: true, cancelable: true }));
              
              const svgEl = btnEl.querySelector('svg');
              if (svgEl) {
                 svgEl.dispatchEvent(new MouseEvent('click', { view: window, bubbles: true, cancelable: true }));
              }
           }
           
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
        
        // DeepSeek 最后的兜底：如果模拟回车也失败了，再尝试一次
        if (host.includes('deepseek.com')) {
          setTimeout(() => {
            // 找到包裹输入框的容器，它旁边往往就是发送按钮
            const container = inputEl.closest('div[class*="chat-input"]') || inputEl.closest('div:has(textarea)');
            if (container) {
               const buttons = container.parentElement.querySelectorAll('div[role="button"]');
               const sendBtn = Array.from(buttons).find(b => {
                 const isStopBtn = b.innerHTML.includes('<rect') || (b.getAttribute('aria-label') && b.getAttribute('aria-label').toLowerCase().includes('stop'));
                 const isSidebarBtn = b.className.includes('sidebar') || (b.getAttribute('aria-label') && b.getAttribute('aria-label').toLowerCase().includes('sidebar')) || b.innerHTML.includes('sidebar');
                 const isSendSvg = b.innerHTML.includes('M2 12') || b.innerHTML.includes('M2.01 21') || b.innerHTML.includes('M2.01 21L23 12') || b.innerHTML.includes('M3.4 22');
                 return b.querySelector('svg') && !isSidebarBtn && !b.className.includes('disabled') && !isStopBtn && isSendSvg;
               });
               if (sendBtn) {
                 sendBtn.dispatchEvent(new MouseEvent('mousedown', { view: window, bubbles: true, cancelable: true }));
                 sendBtn.dispatchEvent(new MouseEvent('mouseup', { view: window, bubbles: true, cancelable: true }));
                 sendBtn.dispatchEvent(new MouseEvent('click', { view: window, bubbles: true, cancelable: true }));
                 try { sendBtn.click(); } catch(e) {}
               }
            } else {
               // 连父容器都找不到，尝试直接找带有特定 path 的 svg 按钮
               const svgs = document.querySelectorAll('svg');
               for (const svg of svgs) {
                 if (svg.innerHTML.includes('M2 12') || svg.innerHTML.includes('M2.01 21') || svg.innerHTML.includes('M2.01 21L23 12') || svg.innerHTML.includes('M3.4 22')) {
                   const btn = svg.closest('div[role="button"]') || svg.parentElement;
                   if (btn && !btn.className.includes('disabled') && !btn.className.includes('sidebar')) {
                     btn.dispatchEvent(new MouseEvent('mousedown', { view: window, bubbles: true, cancelable: true }));
                     btn.dispatchEvent(new MouseEvent('mouseup', { view: window, bubbles: true, cancelable: true }));
                     btn.dispatchEvent(new MouseEvent('click', { view: window, bubbles: true, cancelable: true }));
                     break;
                   }
                 }
               }
            }
          }, 300);
        }
        
        markDone();
      }, 600); // 等待 React/Vue 响应 state 变化
    }
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

  function normalizeSummaryText(text) {
    return (text || '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function isVisibleElement(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function extractSummaryText() {
    const host = window.location.hostname;
    const selectors = [];
    if (host.includes('chatgpt.com')) {
      selectors.push('[data-message-author-role="assistant"]', 'main [class*="prose"]');
    } else if (host.includes('deepseek.com')) {
      selectors.push('[class*="assistant"]', '[class*="markdown"]');
    } else if (host.includes('kimi.moonshot.cn')) {
      selectors.push('[data-role="assistant"]', '[class*="assistant"]', '[class*="markdown"]');
    } else if (host.includes('qianwen.com') || host.includes('tongyi.aliyun.com') || host.includes('yuanbao.tencent.com')) {
      selectors.push('[class*="assistant"]', '[class*="answer"]', '[class*="markdown"]');
    } else {
      selectors.push('[class*="assistant"]', '[class*="answer"]', '[class*="markdown"]', 'article', 'main');
    }

    let parts = [];
    selectors.forEach(sel => {
      try {
        document.querySelectorAll(sel).forEach(el => {
          if (!isVisibleElement(el)) return;
          const t = normalizeSummaryText(el.innerText || '');
          if (t.length >= 20) parts.push(t);
        });
      } catch (e) {}
    });

    if (!parts.length) {
      const bodyText = normalizeSummaryText(document.body ? document.body.innerText : '');
      return bodyText.slice(0, 2200);
    }

    return normalizeSummaryText(parts.slice(-8).join('\n')).slice(0, 2200);
  }
  
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
    } else if (event.data && event.data.type === 'AI_SEARCH_PRO_SCROLL_TO_TEXT') {
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
        // 临时添加一个高亮动画效果
        const originalBg = targetElement.style.backgroundColor;
        const originalTransition = targetElement.style.transition;
        targetElement.style.transition = 'background-color 0.3s ease';
        targetElement.style.backgroundColor = 'rgba(255, 235, 59, 0.6)';
        
        setTimeout(() => {
          targetElement.style.backgroundColor = originalBg;
          setTimeout(() => {
            targetElement.style.transition = originalTransition;
          }, 300);
        }, 2000);
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
    } else if (event.data && event.data.type === 'AI_SEARCH_PRO_REQUEST_SUMMARY') {
      const requestId = event.data.requestId || '';
      const summary = extractSummaryText();
      window.parent.postMessage({
        type: 'AI_SEARCH_PRO_SUMMARY',
        requestId,
        summary,
        url: window.location.href
      }, '*');
    }
  });

  // 10秒后停止轮询，避免性能消耗
  setTimeout(() => {
    clearInterval(intervalId);
  }, 10000);

})();
