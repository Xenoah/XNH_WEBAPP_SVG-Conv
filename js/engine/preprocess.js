/* engine/preprocess.js — Phase 3 で実装。Canvas 上の ImageData を加工する純粋関数群。 */

/** Apply brightness/contrast/gamma to ImageData in place.
 *  Stub for now — real implementation comes in Phase 3. */
export function applyToneCurve(imageData, { brightness = 0, contrast = 0, gamma = 1.0 } = {}) {
  void imageData;
  void brightness;
  void contrast;
  void gamma;
  return imageData;
}

/** Otsu's threshold — returns 0..255. Phase 3. */
export function otsuThreshold(imageData) {
  void imageData;
  return 128;
}

/** Convert to binary using a threshold. Phase 3. */
export function binarize(imageData, threshold) {
  void imageData;
  void threshold;
  return imageData;
}

/** Box blur (separable). Phase 3. */
export function blur(imageData, radius) {
  void imageData;
  void radius;
  return imageData;
}
