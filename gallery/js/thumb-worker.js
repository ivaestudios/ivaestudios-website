// Thumbnail + Web-size generation Web Worker
// Generates two JPEGs from an image file off the main thread:
//   - thumbBlob: 800px wide, 75% quality (for grid display)
//   - webBlob:   2000px wide, 85% quality (for fast viewing + "Web-Size" downloads)
// Runs resizes SEQUENTIALLY to minimize peak memory for large photos.

self.onmessage = async (e) => {
  const { id, file } = e.data;
  let bitmap = null;
  try {
    // Use resizeWidth hint so the browser downscales during decode — saves memory
    bitmap = await createImageBitmap(file, { resizeWidth: 2000, resizeQuality: 'high' });
    // Sequential resize to avoid holding two big canvases at once
    const webBlob = await resizeBitmap(bitmap, 2000, 0.85);
    const thumbBlob = await resizeBitmap(bitmap, 800, 0.75);
    bitmap.close();
    bitmap = null;
    self.postMessage({ id, thumbBlob, webBlob });
  } catch (err) {
    if (bitmap) { try { bitmap.close(); } catch {} }
    self.postMessage({ id, error: err.message || String(err) });
  }
};

async function resizeBitmap(bitmap, maxWidth, quality) {
  const scale = Math.min(1, maxWidth / bitmap.width);
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, w, h);
  return canvas.convertToBlob({ type: 'image/jpeg', quality });
}
