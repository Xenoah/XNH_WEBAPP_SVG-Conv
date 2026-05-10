/* main.js — 起動エントリ。各 UI モジュールを配線し、Worker と Service Worker を初期化。 */

import { store } from './store.js';
import { loadLocale, apply as applyI18n, t } from './i18n/index.js';
import { initDropZone } from './ui/dropZone.js';
import { initPreview, getViewports } from './ui/preview.js';
import { initSplitter } from './ui/splitter.js';
import { initControls } from './ui/controls.js';
import { initToolbar, applyTheme } from './ui/toolbar.js';
import { describe, optimize } from './engine/optimizeSvg.js';

const els = {
  toolbar: document.getElementById('toolbar'),
  fileInput: document.getElementById('file-input'),
  localeSelect: document.getElementById('locale-select'),

  preview: document.getElementById('preview'),
  previewDivider: document.querySelector('.preview__divider'),

  sourceHost: document.getElementById('source-viewport'),
  sourceContent: document.getElementById('source-content'),
  dropzone: document.getElementById('dropzone'),
  sourceCanvas: document.getElementById('source-canvas'),
  sourceMeta: document.getElementById('source-meta'),

  resultHost: document.getElementById('result-viewport'),
  resultContent: document.getElementById('result-content'),
  svgHost: document.getElementById('svg-host'),
  resultPlaceholder: document.getElementById('result-placeholder'),
  resultMeta: document.getElementById('result-meta'),

  compare: document.getElementById('compare'),
  compareBefore: document.getElementById('compare-before'),
  compareAfter: document.getElementById('compare-after'),
  compareHandle: document.getElementById('compare-handle'),
  compareBtn: document.getElementById('compare-btn'),

  status: document.getElementById('status'),
  progress: document.getElementById('progress'),

  modeGroup: document.getElementById('mode-group'),
  preprocessGroup: document.getElementById('preprocess-group'),
  traceGroup: document.getElementById('trace-group'),
  presetGroup: document.getElementById('preset-group'),
};

let traceWorker = null;
let activeJobId = 0;

function getWorker() {
  if (!traceWorker) {
    traceWorker = new Worker(new URL('./workers/trace.worker.js', import.meta.url), {
      type: 'module',
    });
    traceWorker.addEventListener('message', onWorkerMessage);
    traceWorker.addEventListener('error', (e) => {
      console.error('[worker] error', e);
      store.update({ ui: { busy: false, statusKey: 'status.error', progress: 0 } });
    });
  }
  return traceWorker;
}

function onWorkerMessage(event) {
  const msg = event.data;
  if (!msg || msg.id !== activeJobId) return;

  switch (msg.type) {
    case 'progress':
      store.update({ ui: { progress: msg.value } });
      break;
    case 'done': {
      const optimized = optimize(msg.svg, { precision: 2 });
      const meta = describe(optimized);
      store.update({
        svg: optimized,
        svgMeta: meta,
        ui: { busy: false, progress: 1, statusKey: 'status.done' },
      });
      break;
    }
    case 'error':
      console.error('[worker] error', msg.message);
      store.update({ ui: { busy: false, progress: 0, statusKey: 'status.error' } });
      break;
  }
}

async function convert() {
  const { source, mode, preprocess, trace } = store.state;
  if (!source) return;

  store.update({
    ui: { busy: true, progress: 0, statusKey: 'status.tracing' },
    svg: null,
    svgMeta: null,
  });

  // ソース canvas には preview 側で前処理済みの画像が入っている。
  const ctx = els.sourceCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    store.update({ ui: { busy: false, statusKey: 'status.error' } });
    return;
  }
  const imageData = ctx.getImageData(0, 0, source.width, source.height);

  const id = ++activeJobId;
  getWorker().postMessage(
    {
      id,
      type: 'trace',
      mode,
      imageData,
      params: { preprocess, trace },
    },
    [imageData.data.buffer],
  );
}

function downloadSvg() {
  const { svg, source } = store.state;
  if (!svg) return;
  const baseName = (source?.name ?? 'image').replace(/\.[^.]+$/, '') || 'image';
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${baseName}.svg`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function bindViewportButtons() {
  document.querySelectorAll('[data-viewport]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const which = btn.getAttribute('data-viewport');
      const action = btn.getAttribute('data-action');
      const vps = getViewports();
      const vp = which === 'source' ? vps.source : vps.result;
      if (!vp) return;
      const host = which === 'source' ? els.sourceHost : els.resultHost;
      const rect = host.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      if (action === 'fit') vp.fit();
      else if (action === 'zoom-in') vp.zoomAt(1.25, cx, cy);
      else if (action === 'zoom-out') vp.zoomAt(1 / 1.25, cx, cy);
    });
  });
}

function bindStatus() {
  store.subscribe((state) => {
    const { busy, progress, statusKey } = state.ui;
    els.status.textContent = t(statusKey);
    els.status.setAttribute('data-i18n', statusKey);
    els.progress.hidden = !busy && progress === 0;
    els.progress.value = progress;
  });
}

async function bootstrap() {
  applyTheme(store.state.ui.theme);

  const startLocale = store.state.ui.locale ?? 'ja';
  await loadLocale(startLocale);
  els.localeSelect.value = startLocale;

  initDropZone({ dropzoneEl: els.dropzone, fileInputEl: els.fileInput });
  initPreview({
    sourceHost: els.sourceHost,
    sourceContent: els.sourceContent,
    canvasEl: els.sourceCanvas,
    dropzoneEl: els.dropzone,
    sourceMetaEl: els.sourceMeta,
    resultHost: els.resultHost,
    resultContent: els.resultContent,
    svgHostEl: els.svgHost,
    placeholderEl: els.resultPlaceholder,
    resultMetaEl: els.resultMeta,
    compareEl: els.compare,
    compareBeforeEl: els.compareBefore,
    compareAfterEl: els.compareAfter,
    compareHandleEl: els.compareHandle,
    compareBtnEl: els.compareBtn,
  });
  initSplitter({ container: els.preview, divider: els.previewDivider });
  bindViewportButtons();
  initControls({
    modeGroup: els.modeGroup,
    preprocessGroup: els.preprocessGroup,
    traceGroup: els.traceGroup,
    presetGroup: els.presetGroup,
  });
  initToolbar({
    toolbarEl: els.toolbar,
    fileInputEl: els.fileInput,
    localeSelectEl: els.localeSelect,
    onConvert: convert,
    onDownload: downloadSvg,
    onLocaleChange: async (loc) => {
      store.update({ ui: { locale: loc } });
      await loadLocale(loc);
      applyI18n();
    },
  });
  bindStatus();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .register('./sw.js')
      .catch((err) => console.warn('[sw] register failed', err));
  }
}

bootstrap().catch((err) => {
  console.error('[main] bootstrap failed', err);
});
