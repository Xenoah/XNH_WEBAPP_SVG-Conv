/* workers/trace.worker.js — トレース処理本体。Phase 4 で Potrace / ImageTracer 統合。
 * Phase 1 ではメッセージ I/F を確立するスタブ。
 *
 * Message protocol:
 *   in:  { id, type: 'trace', mode, imageData, params }
 *   out: { id, type: 'progress', value }
 *   out: { id, type: 'done', svg }
 *   out: { id, type: 'error', message }
 *   in:  { id, type: 'cancel' }
 */

const cancelled = new Set();

self.addEventListener('message', async (event) => {
  const msg = event.data;
  if (!msg || typeof msg !== 'object') return;

  if (msg.type === 'cancel') {
    cancelled.add(msg.id);
    return;
  }

  if (msg.type === 'trace') {
    try {
      const svg = await stubTrace(msg);
      if (cancelled.has(msg.id)) {
        cancelled.delete(msg.id);
        return;
      }
      self.postMessage({ id: msg.id, type: 'done', svg });
    } catch (err) {
      self.postMessage({
        id: msg.id,
        type: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }
});

/** Phase 1 stub — produces a placeholder SVG echoing image dimensions. */
async function stubTrace({ id, imageData, mode }) {
  const w = imageData?.width ?? 100;
  const h = imageData?.height ?? 100;

  for (let i = 1; i <= 4; i++) {
    if (cancelled.has(id)) throw new Error('cancelled');
    self.postMessage({ id, type: 'progress', value: i / 4 });
    await new Promise((r) => setTimeout(r, 30));
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <rect width="100%" height="100%" fill="#f1f5f9"/>
  <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle"
    font-family="system-ui" font-size="${Math.max(10, Math.min(w, h) / 16)}"
    fill="#475569">[stub:${mode}] ${w}×${h}</text>
</svg>`;
}
