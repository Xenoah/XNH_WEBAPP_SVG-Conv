/* store.js — 軽量状態管理。EventTarget を継承し、`change` を発火する。
 * UI 側は store.subscribe(fn) で購読、store.update(patch) で更新する。 */

const STORAGE_KEY = 'xnh-svg-conv:state';

const DEFAULT_STATE = Object.freeze({
  // ファイル
  source: null, // { name, type, width, height, imageBitmap }
  // 出力
  svg: null, // string
  svgMeta: null, // { bytes, nodes }
  // モード
  mode: 'outline', // 'outline' | 'centerline' | 'edges' | 'color' | 'binary' | 'silhouette'
  // 前処理
  preprocess: {
    brightness: 0, // -100..100
    contrast: 0, // -100..100
    gamma: 1.0, // 0.2..3.0
    blur: 0, // 0..5 px
    threshold: 128, // 0..255 (binary mode)
    autoThreshold: true,
  },
  // トレースパラメータ
  trace: {
    simplify: 1.0, // path tolerance
    smoothing: 0.7, // 0..1
    speckle: 4, // min area
    cornerThreshold: 100, // 0..180 deg
    colors: 8, // 2..32 (color mode)
    strokeWidth: 0, // 0=fill mode
  },
  // UI 状態
  ui: {
    locale: 'ja', // 'ja' | 'en'
    theme: 'auto', // 'auto' | 'light' | 'dark'
    busy: false,
    progress: 0,
    statusKey: 'status.idle',
  },
});

class Store extends EventTarget {
  /** @type {typeof DEFAULT_STATE} */
  state;

  constructor() {
    super();
    this.state = structuredClone(DEFAULT_STATE);
    this.#loadPersisted();
  }

  /** Shallow-merge a patch into a section, or top-level if no section.
   *  Examples:
   *    store.update({ mode: 'binary' })
   *    store.update({ preprocess: { brightness: 10 } })
   */
  update(patch) {
    let changed = false;
    for (const [k, v] of Object.entries(patch)) {
      const prev = this.state[k];
      if (v !== null && typeof v === 'object' && !Array.isArray(v) && prev && typeof prev === 'object') {
        const next = { ...prev, ...v };
        if (!shallowEqual(prev, next)) {
          this.state = { ...this.state, [k]: next };
          changed = true;
        }
      } else if (prev !== v) {
        this.state = { ...this.state, [k]: v };
        changed = true;
      }
    }
    if (changed) {
      this.#persist();
      this.dispatchEvent(new CustomEvent('change', { detail: this.state }));
    }
  }

  /** Subscribe to state changes. Returns unsubscribe fn. */
  subscribe(handler) {
    const wrapped = (event) => handler(event.detail);
    this.addEventListener('change', wrapped);
    handler(this.state);
    return () => this.removeEventListener('change', wrapped);
  }

  reset() {
    this.state = structuredClone(DEFAULT_STATE);
    this.#persist();
    this.dispatchEvent(new CustomEvent('change', { detail: this.state }));
  }

  #persist() {
    try {
      const { ui, mode, preprocess, trace } = this.state;
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ui, mode, preprocess, trace }));
    } catch {
      /* private mode / quota */
    }
  }

  #loadPersisted() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data && typeof data === 'object') {
        this.state = {
          ...this.state,
          ...data,
          ui: { ...this.state.ui, ...(data.ui ?? {}) },
          preprocess: { ...this.state.preprocess, ...(data.preprocess ?? {}) },
          trace: { ...this.state.trace, ...(data.trace ?? {}) },
        };
      }
    } catch {
      /* ignore corrupt */
    }
  }
}

function shallowEqual(a, b) {
  if (a === b) return true;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) if (a[k] !== b[k]) return false;
  return true;
}

export const store = new Store();
