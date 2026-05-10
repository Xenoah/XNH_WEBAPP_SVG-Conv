/* engine/preprocess.js — Canvas ImageData 用の前処理。すべて純粋関数で in-place 編集。
 *
 * - applyToneCurve: 明るさ・コントラスト・ガンマを 1 パスで適用
 * - blur: 半径 r の box blur（separable, 3 パスで近似ガウシアン）
 * - otsuThreshold: 大津法による最適しきい値
 * - binarize: しきい値を使って 2 値化（α は維持）
 * - toGrayscale: ITU-R BT.601 の係数で輝度に
 */

/** @param {ImageData} imageData
 *  @param {{ brightness?: number, contrast?: number, gamma?: number }} opts
 *    brightness: -100..100  / contrast: -100..100 / gamma: 0.2..3.0 */
export function applyToneCurve(imageData, { brightness = 0, contrast = 0, gamma = 1.0 } = {}) {
  if (!brightness && !contrast && Math.abs(gamma - 1) < 1e-3) return imageData;
  const lut = buildToneLUT(brightness, contrast, gamma);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = lut[data[i]];
    data[i + 1] = lut[data[i + 1]];
    data[i + 2] = lut[data[i + 2]];
  }
  return imageData;
}

function buildToneLUT(brightness, contrast, gamma) {
  // contrast: factor = (259*(c+255)) / (255*(259-c)) where c is -255..255
  const c = (contrast / 100) * 255;
  const cf = (259 * (c + 255)) / (255 * (259 - c));
  const b = (brightness / 100) * 255;
  const invG = 1 / Math.max(0.05, gamma);
  const lut = new Uint8ClampedArray(256);
  for (let i = 0; i < 256; i++) {
    let v = i;
    v = (v / 255) ** invG * 255; // gamma
    v = cf * (v - 128) + 128 + b; // contrast + brightness
    lut[i] = v < 0 ? 0 : v > 255 ? 255 : v;
  }
  return lut;
}

/** Box blur, repeated 3 times → near-gaussian. radius is in pixels. */
export function blur(imageData, radius) {
  const r = Math.max(0, Math.round(radius));
  if (!r) return imageData;
  const { width, height, data } = imageData;
  const tmp = new Uint8ClampedArray(data.length);
  for (let pass = 0; pass < 3; pass++) {
    boxBlurH(data, tmp, width, height, r);
    boxBlurV(tmp, data, width, height, r);
  }
  return imageData;
}

function boxBlurH(src, dst, w, h, r) {
  const win = r * 2 + 1;
  for (let y = 0; y < h; y++) {
    let rs = 0, gs = 0, bs = 0, as = 0;
    const row = y * w * 4;
    for (let i = -r; i <= r; i++) {
      const x = clampI(i, 0, w - 1);
      const idx = row + x * 4;
      rs += src[idx];
      gs += src[idx + 1];
      bs += src[idx + 2];
      as += src[idx + 3];
    }
    for (let x = 0; x < w; x++) {
      const o = row + x * 4;
      dst[o] = (rs / win) | 0;
      dst[o + 1] = (gs / win) | 0;
      dst[o + 2] = (bs / win) | 0;
      dst[o + 3] = (as / win) | 0;
      const xOut = clampI(x - r, 0, w - 1);
      const xIn = clampI(x + r + 1, 0, w - 1);
      const oOut = row + xOut * 4;
      const oIn = row + xIn * 4;
      rs += src[oIn] - src[oOut];
      gs += src[oIn + 1] - src[oOut + 1];
      bs += src[oIn + 2] - src[oOut + 2];
      as += src[oIn + 3] - src[oOut + 3];
    }
  }
}

function boxBlurV(src, dst, w, h, r) {
  const win = r * 2 + 1;
  for (let x = 0; x < w; x++) {
    let rs = 0, gs = 0, bs = 0, as = 0;
    for (let i = -r; i <= r; i++) {
      const y = clampI(i, 0, h - 1);
      const idx = (y * w + x) * 4;
      rs += src[idx];
      gs += src[idx + 1];
      bs += src[idx + 2];
      as += src[idx + 3];
    }
    for (let y = 0; y < h; y++) {
      const o = (y * w + x) * 4;
      dst[o] = (rs / win) | 0;
      dst[o + 1] = (gs / win) | 0;
      dst[o + 2] = (bs / win) | 0;
      dst[o + 3] = (as / win) | 0;
      const yOut = clampI(y - r, 0, h - 1);
      const yIn = clampI(y + r + 1, 0, h - 1);
      const oOut = (yOut * w + x) * 4;
      const oIn = (yIn * w + x) * 4;
      rs += src[oIn] - src[oOut];
      gs += src[oIn + 1] - src[oOut + 1];
      bs += src[oIn + 2] - src[oOut + 2];
      as += src[oIn + 3] - src[oOut + 3];
    }
  }
}

function clampI(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Convert RGBA → grayscale (Y). アルファは維持。 */
export function toGrayscale(imageData) {
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const y = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
    data[i] = data[i + 1] = data[i + 2] = y | 0;
  }
  return imageData;
}

/** 大津法による最適しきい値。グレースケール前提でなくても輝度で計算する。 */
export function otsuThreshold(imageData) {
  const data = imageData.data;
  const hist = new Array(256).fill(0);
  let total = 0;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a === 0) continue;
    const y = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
    hist[y | 0]++;
    total++;
  }
  if (total === 0) return 128;

  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];

  let sumB = 0;
  let wB = 0;
  let wF = 0;
  let varMax = 0;
  let threshold = 128;

  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    wF = total - wB;
    if (wF === 0) break;

    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > varMax) {
      varMax = between;
      threshold = t;
    }
  }
  return threshold;
}

/** しきい値で 2 値化。RGB → 黒(0) または白(255)、α は維持。 */
export function binarize(imageData, threshold = 128) {
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const y = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
    const v = y >= threshold ? 255 : 0;
    data[i] = data[i + 1] = data[i + 2] = v;
  }
  return imageData;
}

/** Apply the full preprocessing pipeline used by Phase 3 preview.
 *  mode は最終的なトレースモード。preview 用に「2 値化したかった結果」もここで反映する。 */
export function preprocessForPreview(imageData, { mode, preprocess }) {
  applyToneCurve(imageData, preprocess);
  if (preprocess.blur > 0) blur(imageData, preprocess.blur);

  if (mode === 'binary' || mode === 'silhouette' || mode === 'outline' || mode === 'centerline') {
    const t = preprocess.autoThreshold ? otsuThreshold(imageData) : preprocess.threshold;
    binarize(imageData, t);
  } else if (mode === 'edges') {
    toGrayscale(imageData);
  }
  return imageData;
}
