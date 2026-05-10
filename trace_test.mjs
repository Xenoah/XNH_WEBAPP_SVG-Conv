import { traceImageData } from './js/engine/trace.js';

const w = 32, h = 32;
const data = new Uint8ClampedArray(w * h * 4);
for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    const inside = x >= 8 && x < 24 && y >= 8 && y < 24;
    const v = inside ? 0 : 255;
    data[i] = data[i+1] = data[i+2] = v;
    data[i+3] = 255;
  }
}
const imageData = { width: w, height: h, data };

console.log('--- binary mode ---');
let svg = traceImageData(imageData, {
  mode: 'binary',
  params: {
    preprocess: { brightness:0, contrast:0, gamma:1, blur:0, threshold:128, autoThreshold: true },
    trace: { simplify: 0.5, smoothing: 0, speckle: 0, cornerThreshold: 100, colors: 4, strokeWidth: 0 },
  },
});
console.log(svg);

console.log('\n--- silhouette mode (smoothing 0.6) ---');
svg = traceImageData(imageData, {
  mode: 'silhouette',
  params: {
    preprocess: { brightness:0, contrast:0, gamma:1, blur:0, threshold:128, autoThreshold: true },
    trace: { simplify: 0.5, smoothing: 0.6, speckle: 0, cornerThreshold: 100, colors: 4, strokeWidth: 0 },
  },
});
console.log(svg);

// gradient color test
console.log('\n--- color mode (4 colors, gradient) ---');
const w2 = 16, h2 = 16;
const data2 = new Uint8ClampedArray(w2 * h2 * 4);
for (let y = 0; y < h2; y++) {
  for (let x = 0; x < w2; x++) {
    const i = (y * w2 + x) * 4;
    data2[i] = (x * 16) | 0;
    data2[i+1] = (y * 16) | 0;
    data2[i+2] = 128;
    data2[i+3] = 255;
  }
}
svg = traceImageData({ width: w2, height: h2, data: data2 }, {
  mode: 'color',
  params: {
    preprocess: { brightness:0, contrast:0, gamma:1, blur:0, threshold:128, autoThreshold: false },
    trace: { simplify: 0.5, smoothing: 0, speckle: 0, cornerThreshold: 100, colors: 4, strokeWidth: 0 },
  },
});
console.log('color svg length:', svg.length);
console.log(svg.slice(0, 400));
