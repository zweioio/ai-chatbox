(() => {
  function createDeleteConfirmDialog(options = {}) {
    const {
      iconUrl = '../icons/delete.svg',
      title = '确认删除',
      text = '请确认是否删除，删除后无法恢复',
      confirmText = '删除',
      cancelText = '取消'
    } = options;

    const mask = document.createElement('div');
    mask.className = 'shared-confirm-mask';
    mask.hidden = true;
    mask.innerHTML = `
      <div class="shared-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="shared-confirm-title">
        <div class="shared-confirm-head">
          <div class="shared-confirm-icon">
            <img src="${iconUrl}" alt="">
          </div>
          <div class="shared-confirm-copy">
            <strong id="shared-confirm-title"></strong>
            <p id="shared-confirm-text"></p>
          </div>
        </div>
        <div class="shared-confirm-actions">
          <button class="shared-confirm-btn" data-confirm-action="cancel" type="button"></button>
          <button class="shared-confirm-btn shared-confirm-btn-danger" data-confirm-action="submit" type="button"></button>
        </div>
      </div>
    `;
    document.body.appendChild(mask);

    const titleEl = mask.querySelector('#shared-confirm-title');
    const textEl = mask.querySelector('#shared-confirm-text');
    const cancelBtn = mask.querySelector('[data-confirm-action="cancel"]');
    const submitBtn = mask.querySelector('[data-confirm-action="submit"]');

    titleEl.textContent = title;
    textEl.textContent = text;
    cancelBtn.textContent = cancelText;
    submitBtn.textContent = confirmText;

    let resolver = null;

    function close(result) {
      mask.hidden = true;
      const current = resolver;
      resolver = null;
      current?.(result);
    }

    cancelBtn.addEventListener('click', () => close(false));
    submitBtn.addEventListener('click', () => close(true));
    mask.addEventListener('click', (event) => {
      if (event.target === mask) close(false);
    });

    return {
      open(nextOptions = {}) {
        titleEl.textContent = nextOptions.title || title;
        textEl.textContent = nextOptions.text || text;
        cancelBtn.textContent = nextOptions.cancelText || cancelText;
        submitBtn.textContent = nextOptions.confirmText || confirmText;
        mask.hidden = false;
        return new Promise((resolve) => {
          resolver = resolve;
        });
      },
      destroy() {
        mask.remove();
      }
    };
  }

  window.AIChatboxConfirmDialog = {
    createDeleteConfirmDialog
  };
})();
