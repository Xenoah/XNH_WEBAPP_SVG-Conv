/* ui/preview.js — 原画 Canvas と SVG 結果の表示・ズームパン・Before/After 比較。 */

import { store } from '../store.js';
import { attachViewport } from './viewport.js';

let sourceVp = null;
let resultVp = null;
let compareActive = false;

/** @param {{ sourceHost: HTMLElement, sourceContent: HTMLElement, canvasEl: HTMLCanvasElement,
 *           dropzoneEl: HTMLElement, sourceMetaEl: HTMLElement,
 *           resultHost: HTMLElement, resultContent: HTMLElement,
 *           svgHostEl: HTMLElement, placeholderEl: HTMLElement, resultMetaEl: HTMLElement,
 *           compareEl: HTMLElement, compareBeforeEl: HTMLElement,
 *           compareAfterEl: HTMLElement, compareHandleEl: HTMLElement,
 *           compareBtnEl: HTMLElement }} opts */
export function initPreview(opts) {
  sourceVp = attachViewport({ host: opts.sourceHost, content: opts.sourceContent });
  resultVp = attachViewport({ host: opts.resultHost, content: opts.resultContent });

  initCompare(opts);

  let lastSourceRef = null;
  let lastSvgRef = null;

  store.subscribe((state) => {
    if (state.source !== lastSourceRef) {
      lastSourceRef = state.source;
      renderSource(state.source, opts);
      sourceVp.refit();
    }
    if (state.svg !== lastSvgRef) {
      lastSvgRef = state.svg;
      renderResult(state.svg, state.svgMeta, opts);
      resultVp.refit();
      if (compareActive) refreshCompare(opts);
    }
  });
}

export function getViewports() {
  return { source: sourceVp, result: resultVp };
}

function renderSource(source, { canvasEl, dropzoneEl, sourceMetaEl }) {
  if (!source) {
    canvasEl.hidden = true;
    dropzoneEl.hidden = false;
    sourceMetaEl.textContent = '';
    return;
  }
  dropzoneEl.hidden = true;
  canvasEl.hidden = false;
  canvasEl.width = source.width;
  canvasEl.height = source.height;
  canvasEl.style.width = `${source.width}px`;
  canvasEl.style.height = `${source.height}px`;
  const ctx = canvasEl.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
    ctx.drawImage(source.imageBitmap, 0, 0);
  }
  sourceMetaEl.textContent = `${source.width}×${source.height}`;
}

function renderResult(svg, meta, { svgHostEl, placeholderEl, resultMetaEl, compareBtnEl }) {
  if (!svg) {
    svgHostEl.hidden = true;
    svgHostEl.innerHTML = '';
    placeholderEl.hidden = false;
    resultMetaEl.textContent = '';
    if (compareBtnEl) compareBtnEl.toggleAttribute('disabled', true);
    return;
  }
  placeholderEl.hidden = true;
  svgHostEl.hidden = false;
  svgHostEl.innerHTML = svg;
  if (meta) {
    const kb = (meta.bytes / 1024).toFixed(1);
    resultMetaEl.textContent = `${kb} KB · ${meta.nodes} nodes`;
  } else {
    resultMetaEl.textContent = '';
  }
  if (compareBtnEl) compareBtnEl.toggleAttribute('disabled', false);
}

/* ---------- Before/After 比較 ---------- */

function initCompare(opts) {
  const { compareBtnEl, compareEl, compareHandleEl } = opts;
  if (!compareBtnEl || !compareEl) return;

  compareBtnEl.addEventListener('click', () => {
    const { svg, source } = store.state;
    if (!svg || !source) return;
    compareActive = !compareActive;
    compareEl.hidden = !compareActive;
    compareBtnEl.setAttribute('aria-pressed', String(compareActive));
    if (compareActive) {
      refreshCompare(opts);
      setSplit(50, opts);
    }
  });

  // ハンドルドラッグで分割位置調整
  let dragging = false;
  const onPointerDown = (e) => {
    dragging = true;
    compareHandleEl.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!dragging) return;
    const rect = compareEl.getBoundingClientRect();
    const ratio = ((e.clientX - rect.left) / rect.width) * 100;
    setSplit(clamp(ratio, 0, 100), opts);
  };
  const onPointerUp = (e) => {
    dragging = false;
    try { compareHandleEl.releasePointerCapture(e.pointerId); } catch {}
  };
  compareHandleEl.addEventListener('pointerdown', onPointerDown);
  compareHandleEl.addEventListener('pointermove', onPointerMove);
  compareHandleEl.addEventListener('pointerup', onPointerUp);
  compareHandleEl.addEventListener('pointercancel', onPointerUp);

  compareHandleEl.addEventListener('keydown', (e) => {
    const cur = parseFloat(compareEl.style.getPropertyValue('--split') || '50');
    if (e.key === 'ArrowLeft') setSplit(clamp(cur - 2, 0, 100), opts);
    else if (e.key === 'ArrowRight') setSplit(clamp(cur + 2, 0, 100), opts);
  });
}

function refreshCompare({ compareBeforeEl, compareAfterEl }) {
  const { source, svg } = store.state;
  if (!source || !svg) return;

  // Before = 原画 canvas を data URL で複製
  const tmp = document.createElement('canvas');
  tmp.width = source.width;
  tmp.height = source.height;
  const ctx = tmp.getContext('2d');
  if (ctx) ctx.drawImage(source.imageBitmap, 0, 0);
  compareBeforeEl.style.backgroundImage = `url("${tmp.toDataURL('image/png')}")`;
  compareBeforeEl.style.aspectRatio = `${source.width} / ${source.height}`;

  // After = SVG を直接埋め込み
  compareAfterEl.innerHTML = svg;
  compareAfterEl.style.aspectRatio = `${source.width} / ${source.height}`;
}

function setSplit(pct, { compareEl }) {
  compareEl.style.setProperty('--split', `${pct}`);
}

function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}
