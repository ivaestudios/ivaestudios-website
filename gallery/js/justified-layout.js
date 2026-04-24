// Flickr-style justified-row layout.
// Given an array of items with {width, height}, returns rows where each
// row's items have been scaled to fit the container width at a target
// height. Last row scales to target height (no stretching past it).
//
// Returns: [{ height, items: [{ ...item, displayWidth, displayHeight }] }]
//
// Usage:
//   const rows = justifyRows(photos, { containerWidth, targetRowHeight, gap });
//   rows.forEach(row => row.items.forEach(it => render(it.displayWidth, it.displayHeight)));

(function (root) {
  function justifyRows(items, opts) {
    const containerWidth = Math.max(0, opts.containerWidth || 0);
    const targetRowHeight = opts.targetRowHeight || 280;
    const gap = opts.gap || 8;
    const maxRowAspect = opts.maxRowAspect || 5;
    const fallbackAspect = opts.fallbackAspect || 1.5; // 3:2 landscape default
    if (!items.length || containerWidth <= 0) return [];

    const rows = [];
    let buffer = [];
    let bufferAspect = 0;

    for (const item of items) {
      const w = item.width > 0 ? item.width : Math.round(targetRowHeight * fallbackAspect);
      const h = item.height > 0 ? item.height : targetRowHeight;
      const aspect = w / h;
      buffer.push({ ...item, _w: w, _h: h, _aspect: aspect });
      bufferAspect += aspect;

      const innerWidth = containerWidth - gap * (buffer.length - 1);
      const projectedHeight = innerWidth / bufferAspect;

      if (projectedHeight <= targetRowHeight) {
        rows.push(commitRow(buffer, projectedHeight, gap));
        buffer = [];
        bufferAspect = 0;
      }
    }

    if (buffer.length) {
      const innerWidth = containerWidth - gap * (buffer.length - 1);
      let height = innerWidth / bufferAspect;
      if (height > targetRowHeight) height = targetRowHeight;
      rows.push(commitRow(buffer, height, gap));
    }

    return rows;
  }

  function commitRow(items, height, gap) {
    return {
      height: Math.round(height),
      items: items.map(it => ({
        ...it,
        displayWidth: Math.round(height * it._aspect),
        displayHeight: Math.round(height)
      }))
    };
  }

  root.justifyRows = justifyRows;
})(typeof window !== 'undefined' ? window : globalThis);
