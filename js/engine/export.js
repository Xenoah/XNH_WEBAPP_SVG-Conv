/* engine/export.js — SVG を多様な拡張子へエクスポートする。
 *
 * SVG / SVGZ はテキストおよび圧縮済 Blob を返す。
 * PNG / JPEG / WebP は Image にロードして Canvas に描画したうえで toBlob で書き出す。
 * PDF は最小構成の PDF ドキュメントへ PNG として埋め込む。
 *
 * 全ての関数は { blob, filename, mime } を返すか、null（非対応）を返す。 */

import { toSvgz } from './optimizeSvg.js';

const FORMATS = {
  svg:  { mime: 'image/svg+xml', ext: 'svg' },
  svgz: { mime: 'image/svg+xml', ext: 'svgz' },
  png:  { mime: 'image/png',     ext: 'png'  },
  jpeg: { mime: 'image/jpeg',    ext: 'jpg'  },
  webp: { mime: 'image/webp',    ext: 'webp' },
  pdf:  { mime: 'application/pdf', ext: 'pdf' },
};

export function listFormats() {
  return Object.keys(FORMATS);
}

export function formatLabel(fmt) {
  return ({
    svg: 'SVG',
    svgz: 'SVGZ',
    png: 'PNG',
    jpeg: 'JPEG',
    webp: 'WebP',
    pdf: 'PDF',
  })[fmt] ?? fmt.toUpperCase();
}

/** SVG 文字列とサイズから、指定フォーマットの Blob を生成する。
 *  rasterScale: ラスター系で 1.0=等倍（SVG の viewBox と同等の解像度）。
 */
export async function exportSvgAs(svgString, { format, width, height, baseName, rasterScale = 1, jpegQuality = 0.92 }) {
  const fmt = FORMATS[format];
  if (!fmt) throw new Error(`unknown format: ${format}`);
  const filename = `${baseName || 'image'}.${fmt.ext}`;

  if (format === 'svg') {
    return { blob: new Blob([svgString], { type: fmt.mime }), filename, mime: fmt.mime };
  }
  if (format === 'svgz') {
    const blob = await toSvgz(svgString);
    if (!blob) return null;
    return { blob, filename, mime: fmt.mime };
  }

  // 以降はラスタライズが必要
  const targetW = Math.max(1, Math.round(width * rasterScale));
  const targetH = Math.max(1, Math.round(height * rasterScale));
  const pngBlob = await rasterizeSvg(svgString, targetW, targetH, 'image/png', 1.0);
  if (!pngBlob) return null;

  if (format === 'png') return { blob: pngBlob, filename, mime: fmt.mime };
  if (format === 'jpeg' || format === 'webp') {
    const blob = await rasterizeSvg(svgString, targetW, targetH, fmt.mime, jpegQuality);
    if (!blob) return null;
    return { blob, filename, mime: fmt.mime };
  }
  if (format === 'pdf') {
    const buf = await pngBlob.arrayBuffer();
    const blob = await buildPdfFromPng(new Uint8Array(buf), targetW, targetH);
    return { blob, filename, mime: fmt.mime };
  }
  return null;
}

/** SVG 文字列を <img> 経由で OffscreenCanvas/Canvas に描画し、指定 MIME の Blob にする。 */
async function rasterizeSvg(svgString, w, h, mime, quality) {
  // viewBox を上書きせず、CanvasRenderingContext2D.drawImage の縮尺で対応する
  const blob = new Blob([svgString], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  try {
    const img = await loadImage(url);
    const canvas = createCanvas(w, h);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    if (mime === 'image/jpeg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
    }
    ctx.drawImage(img, 0, 0, w, h);
    return await canvasToBlob(canvas, mime, quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = url;
  });
}

function createCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') {
    try {
      return new OffscreenCanvas(w, h);
    } catch {}
  }
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function canvasToBlob(canvas, mime, quality) {
  if (canvas instanceof OffscreenCanvas) {
    return canvas.convertToBlob({ type: mime, quality });
  }
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), mime, quality));
}

/* -------- PDF (single page, embeds the rasterized image) -------- */
/* Minimal PDF 1.4 with a single Image XObject. PNG ではなく FlateDecode された
 * raw RGBA を埋め込む方が PDF 仕様としては素直なので、png blob を一度
 * canvas で展開して圧縮する。 */
async function buildPdfFromPng(_pngBytes, w, h) {
  // Canvas に再ロードして RGBA を取り出し、FlateDecode で埋める
  const blob = new Blob([_pngBytes], { type: 'image/png' });
  const url = URL.createObjectURL(blob);
  let rgba;
  try {
    const img = await loadImage(url);
    const canvas = createCanvas(w, h);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas 2d unavailable');
    ctx.drawImage(img, 0, 0, w, h);
    if (canvas instanceof OffscreenCanvas) {
      rgba = ctx.getImageData(0, 0, w, h).data;
    } else {
      rgba = ctx.getImageData(0, 0, w, h).data;
    }
  } finally {
    URL.revokeObjectURL(url);
  }

  // RGBA → RGB
  const rgb = new Uint8Array(w * h * 3);
  for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) {
    rgb[j] = rgba[i];
    rgb[j + 1] = rgba[i + 1];
    rgb[j + 2] = rgba[i + 2];
  }

  // CompressionStream で deflate
  const deflated = await deflate(rgb);

  // PDF オブジェクト構築
  const enc = new TextEncoder();
  const parts = []; // {bytes: Uint8Array}
  let offset = 0;
  const xref = [];

  const pushStr = (s) => {
    const u = enc.encode(s);
    parts.push(u);
    offset += u.length;
  };
  const pushBin = (u) => {
    parts.push(u);
    offset += u.length;
  };

  // Header
  pushStr('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n');

  // 1: catalog
  xref.push(offset);
  pushStr('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  // 2: pages
  xref.push(offset);
  pushStr('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');

  // 3: page
  xref.push(offset);
  pushStr(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] ` +
    `/Resources << /XObject << /Im1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`,
  );

  // 4: image XObject
  xref.push(offset);
  pushStr(
    `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} ` +
    `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode ` +
    `/Length ${deflated.length} >>\nstream\n`,
  );
  pushBin(deflated);
  pushStr('\nendstream\nendobj\n');

  // 5: contents (draw image scaled to page)
  const contents = `q\n${w} 0 0 ${h} 0 0 cm\n/Im1 Do\nQ\n`;
  const contentsBytes = enc.encode(contents);
  xref.push(offset);
  pushStr(`5 0 obj\n<< /Length ${contentsBytes.length} >>\nstream\n`);
  pushBin(contentsBytes);
  pushStr('\nendstream\nendobj\n');

  // xref
  const xrefStart = offset;
  pushStr(`xref\n0 ${xref.length + 1}\n0000000000 65535 f \n`);
  for (const o of xref) pushStr(`${String(o).padStart(10, '0')} 00000 n \n`);

  // trailer
  pushStr(`trailer\n<< /Size ${xref.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`);

  return new Blob(parts, { type: 'application/pdf' });
}

async function deflate(bytes) {
  if (typeof CompressionStream === 'undefined') {
    // 非対応環境: 無圧縮 deflate を構築するのは煩雑なのでフォールバックは諦める
    throw new Error('CompressionStream not supported (PDF export needs deflate)');
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate'));
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}
