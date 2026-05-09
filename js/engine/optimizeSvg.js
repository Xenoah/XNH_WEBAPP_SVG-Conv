/* engine/optimizeSvg.js — Phase 6 で本実装。属性整理・座標丸めを行う。
 * Phase 1 ではノード数とバイト数だけ拾えるユーティリティを暫定提供する。 */

/** Count element nodes inside a serialized SVG string. */
export function countNodes(svgString) {
  if (!svgString) return 0;
  const matches = svgString.match(/<[a-zA-Z][^!>]*?>/g);
  return matches ? matches.length : 0;
}

/** Round numeric attributes to a given decimal precision. Phase 6 で拡張。 */
export function optimize(svgString, { precision = 2 } = {}) {
  if (!svgString) return svgString;
  return svgString.replace(/(\d+\.\d+)/g, (m) => {
    const n = Number(m);
    if (!Number.isFinite(n)) return m;
    const factor = 10 ** precision;
    return String(Math.round(n * factor) / factor);
  });
}

/** Compute a small metadata object for the result preview. */
export function describe(svgString) {
  return {
    bytes: new Blob([svgString]).size,
    nodes: countNodes(svgString),
  };
}
