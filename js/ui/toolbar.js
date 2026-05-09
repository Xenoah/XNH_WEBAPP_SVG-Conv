/* ui/toolbar.js — ヘッダーボタンの配線。 */

import { store } from '../store.js';
import { loadFile } from './dropZone.js';

/** @param {{ toolbarEl: HTMLElement, fileInputEl: HTMLInputElement,
 *           localeSelectEl: HTMLSelectElement,
 *           onConvert: () => void, onDownload: () => void,
 *           onLocaleChange: (loc: string) => void }} opts */
export function initToolbar(opts) {
  const { toolbarEl, fileInputEl, localeSelectEl, onConvert, onDownload, onLocaleChange } = opts;

  toolbarEl.addEventListener('click', async (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    const action = target.closest('[data-action]')?.getAttribute('data-action');
    if (!action) return;

    switch (action) {
      case 'open-file':
        fileInputEl.click();
        break;
      case 'paste':
        await pasteFromClipboard();
        break;
      case 'convert':
        onConvert();
        break;
      case 'download':
        onDownload();
        break;
      case 'toggle-theme':
        toggleTheme();
        break;
    }
  });

  localeSelectEl.value = store.state.ui.locale;
  localeSelectEl.addEventListener('change', () => {
    onLocaleChange(localeSelectEl.value);
  });

  store.subscribe((state) => {
    const convertBtn = toolbarEl.querySelector('[data-action="convert"]');
    const downloadBtn = toolbarEl.querySelector('[data-action="download"]');
    if (convertBtn) convertBtn.toggleAttribute('disabled', !state.source || state.ui.busy);
    if (downloadBtn) downloadBtn.toggleAttribute('disabled', !state.svg);
  });
}

async function pasteFromClipboard() {
  if (!navigator.clipboard?.read) {
    console.warn('[toolbar] clipboard read not supported; use Ctrl+V on the page');
    return;
  }
  try {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      const imageType = item.types.find((t) => t.startsWith('image/'));
      if (imageType) {
        const blob = await item.getType(imageType);
        const file = new File([blob], 'clipboard-image', { type: imageType });
        await loadFile(file);
        return;
      }
    }
  } catch (err) {
    console.warn('[toolbar] clipboard read failed', err);
  }
}

function toggleTheme() {
  const root = document.documentElement;
  const isDark = root.classList.toggle('theme-dark');
  store.update({ ui: { theme: isDark ? 'dark' : 'light' } });
}

export function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'auto') {
    const prefersDark = matchMedia('(prefers-color-scheme: dark)').matches;
    root.classList.toggle('theme-dark', prefersDark);
  } else {
    root.classList.toggle('theme-dark', theme === 'dark');
  }
}
