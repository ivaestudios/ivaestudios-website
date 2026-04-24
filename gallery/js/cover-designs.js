// Shared cover-design renderer used by gallery.html (client view) and
// admin/gallery-edit.html (live preview). Single source of truth so the
// admin preview and what clients see can never drift apart.
//
// Usage:
//   window.IvaeCoverDesigns.render(
//     design, title, date, desc, count, bgImg, bg, tx,
//     hasCover, fx, fy,
//     logoUrl,   // optional: if set, overlays the studio logo on the cover
//     logoWhite  // optional: true=force white, false=force dark, undefined=auto
//   )
//   window.IvaeCoverDesigns.isDarkColor('#1c1c1c') -> true

(function (root) {
  // ── helpers ──────────────────────────────────────────────────────────
  function isDarkColor(hex) {
    if (!hex || typeof hex !== 'string') return false;
    const c = hex.replace('#', '').trim();
    if (c.length !== 6) return false;
    const r = parseInt(c.slice(0, 2), 16);
    const g = parseInt(c.slice(2, 4), 16);
    const b = parseInt(c.slice(4, 6), 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) return false;
    // ITU-R BT.601 luminance — < 128 = "dark"
    return (0.299 * r + 0.587 * g + 0.114 * b) < 128;
  }

  // Designs whose dominant surface is a dark photo+overlay (logo must be white)
  const OVERLAY_DESIGNS = ['splitOverlay', 'fullOverlay', 'bold', 'stacked'];

  function logoOverlayHtml(logoUrl, logoWhite, design, bg) {
    if (!logoUrl) return '';
    const isOverlayCover = OVERLAY_DESIGNS.indexOf(design) !== -1;
    let useWhite;
    if (logoWhite === true || logoWhite === 1)       useWhite = true;
    else if (logoWhite === false || logoWhite === 0) useWhite = false;
    else                                              useWhite = isOverlayCover || isDarkColor(bg);
    const filt = useWhite
      ? 'filter:brightness(0) invert(1) drop-shadow(0 1px 3px rgba(0,0,0,0.45));'
      : 'filter:brightness(0) drop-shadow(0 1px 2px rgba(255,255,255,0.55));';
    return `<img src="${logoUrl}" alt="" style="position:absolute;top:5vh;left:50%;transform:translateX(-50%);height:auto;width:auto;max-height:9vh;min-height:36px;max-width:240px;object-fit:contain;z-index:5;pointer-events:none;${filt}"/>`;
  }

  // ── main renderer ────────────────────────────────────────────────────
  function render(design, title, date, desc, count, bgImg, bg, tx, hasCover, fx, fy, logoUrl, logoWhite) {
    const innerHtml = renderInner(design, title, date, desc, count, bgImg, bg, tx, hasCover, fx, fy);
    const logoEl = logoOverlayHtml(logoUrl, logoWhite, design, bg);
    if (!logoEl) return innerHtml;
    // Wrap in a positioned container so the absolute-positioned logo
    // anchors to the top of the cover (not the page).
    return `<div style="position:relative;min-height:100vh;">${logoEl}${innerHtml}</div>`;
  }

  // Original 12-template renderer — extracted so the wrapper can prepend overlays.
  function renderInner(design, title, date, desc, count, bgImg, bg, tx, hasCover, fx, fy) {
    const arrow = `<div style="font-size:22px;color:${tx};opacity:0.15;margin-top:20px;">&#8964;</div>`;
    const studio = `<span style="font-size:8px;font-weight:600;letter-spacing:3px;text-transform:uppercase;color:${tx};opacity:0.3;font-family:'Syne',sans-serif;">IVAE Studios</span>`;
    const countEl = `<span style="display:inline-block;font-size:9px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:${tx};opacity:0.3;margin-top:16px;padding-top:14px;border-top:1px solid ${tx === '#ffffff' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)'};">${count} photos</span>`;
    const dateEl = date ? `<span style="font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:${tx};opacity:0.5;font-family:'Syne',sans-serif;margin-top:8px;">${date}</span>` : '';
    const descEl = desc ? `<p style="font-size:13px;color:${tx};opacity:0.45;max-width:400px;line-height:1.7;margin:10px auto 0;text-align:center;">${desc}</p>` : '';
    const titleEl = `<span style="font-family:'Cormorant Garamond',serif;font-size:clamp(28px,5vw,48px);font-weight:300;letter-spacing:2px;color:${tx};text-align:center;line-height:1.15;text-transform:uppercase;">${title}</span>`;
    const line = `<span style="width:28px;height:0.5px;background:${tx};opacity:0.2;display:block;margin:12px auto;"></span>`;

    if (design === 'classic') {
      return `<div style="display:flex;min-height:100vh;background:${bg};">
        <div style="flex:0 0 5%;display:flex;align-items:center;justify-content:center;background:${bg};border-right:1px solid ${tx === '#ffffff' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'};"><span style="writing-mode:vertical-rl;transform:rotate(180deg);font-size:7px;color:${tx};opacity:0.25;letter-spacing:2px;font-family:'Syne',sans-serif;text-transform:uppercase;">Photos by IVAE Studios</span></div>
        <div style="flex:1;${bgImg}"></div>
        <div style="flex:0 0 34%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 24px;background:${bg};position:relative;text-align:center;">
          ${studio}<div style="margin-top:20px;">${titleEl}</div>${line}${dateEl}${descEl}${countEl}${arrow}
        </div>
      </div>`;
    }
    if (design === 'portrait') {
      return `<div style="display:flex;min-height:100vh;background:${bg};">
        <div style="flex:0 0 5%;display:flex;align-items:center;justify-content:center;background:${bg};border-right:1px solid ${tx === '#ffffff' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'};"><span style="writing-mode:vertical-rl;transform:rotate(180deg);font-size:7px;color:${tx};opacity:0.25;letter-spacing:2px;font-family:'Syne',sans-serif;text-transform:uppercase;">Photos by IVAE Studios</span></div>
        <div style="flex:0 0 38%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 24px;background:${bg};text-align:center;">
          ${studio}<div style="margin-top:20px;">${titleEl}</div>${line}${dateEl}${descEl}${countEl}${arrow}
        </div>
        <div style="flex:1;${bgImg}"></div>
      </div>`;
    }
    if (design === 'splitOverlay') {
      return `<div style="position:relative;min-height:100vh;${bgImg}">
        <div style="position:absolute;inset:0;background:linear-gradient(to right,rgba(0,0,0,0.55) 0%,rgba(0,0,0,0.2) 100%);"></div>
        <div style="position:relative;z-index:2;display:flex;flex-direction:column;align-items:flex-start;justify-content:center;min-height:100vh;padding:60px 60px;max-width:500px;">
          <span style="font-size:8px;font-weight:600;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,0.4);font-family:'Syne',sans-serif;">IVAE Studios</span>
          <span style="font-family:'Cormorant Garamond',serif;font-size:clamp(28px,5vw,48px);font-weight:300;letter-spacing:2px;color:white;line-height:1.15;text-transform:uppercase;margin-top:16px;">${title}</span>
          <span style="width:28px;height:0.5px;background:rgba(255,255,255,0.3);display:block;margin:14px 0;"></span>
          ${date ? `<span style="font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:rgba(255,255,255,0.5);font-family:'Syne',sans-serif;">${date}</span>` : ''}
          ${desc ? `<p style="font-size:13px;color:rgba(255,255,255,0.5);line-height:1.7;margin-top:10px;">${desc}</p>` : ''}
          <span style="display:inline-block;font-size:9px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:rgba(255,255,255,0.3);margin-top:16px;padding-top:14px;border-top:1px solid rgba(255,255,255,0.1);">${count} photos</span>
        </div>
      </div>`;
    }
    if (design === 'editorial') {
      return `<div style="display:flex;min-height:100vh;background:${bg};">
        <div style="flex:1;${bgImg}"></div>
        <div style="flex:0 0 40%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 32px;background:${bg};text-align:center;">
          ${studio}<div style="margin-top:20px;">${titleEl}</div>${line}${dateEl}${descEl}${countEl}${arrow}
        </div>
      </div>`;
    }
    if (design === 'fullOverlay') {
      return `<div style="position:relative;min-height:100vh;${bgImg}">
        <div style="position:absolute;inset:0;background:rgba(0,0,0,0.45);"></div>
        <div style="position:relative;z-index:2;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;padding:60px 24px;text-align:center;">
          <span style="font-size:8px;font-weight:600;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,0.35);font-family:'Syne',sans-serif;">IVAE Studios</span>
          <span style="font-family:'Cormorant Garamond',serif;font-size:clamp(32px,6vw,56px);font-weight:300;letter-spacing:2px;color:white;line-height:1.1;text-transform:uppercase;margin-top:16px;text-shadow:0 2px 20px rgba(0,0,0,0.3);">${title}</span>
          <span style="width:28px;height:0.5px;background:rgba(255,255,255,0.3);display:block;margin:14px auto;"></span>
          ${date ? `<span style="font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:rgba(196,163,90,0.8);font-family:'Syne',sans-serif;">${date}</span>` : ''}
          ${desc ? `<p style="font-size:13px;color:rgba(255,255,255,0.55);max-width:400px;line-height:1.7;margin:10px auto 0;">${desc}</p>` : ''}
          <span style="display:inline-block;font-size:9px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:rgba(255,255,255,0.25);margin-top:20px;padding-top:14px;border-top:1px solid rgba(196,163,90,0.2);">${count} photos</span>
          <div style="font-size:22px;color:rgba(255,255,255,0.15);margin-top:20px;">&#8964;</div>
        </div>
      </div>`;
    }
    if (design === 'horizon') {
      return `<div style="display:flex;flex-direction:column;min-height:100vh;background:${bg};">
        <div style="flex:1;${bgImg}"></div>
        <div style="padding:32px 40px 28px;text-align:center;background:${bg};">
          ${titleEl}${line}${dateEl}${descEl}${countEl}
        </div>
      </div>`;
    }
    if (design === 'magazine') {
      return `<div style="display:flex;min-height:100vh;background:${bg};">
        <div style="flex:0 0 55%;${bgImg}"></div>
        <div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding:40px 36px;background:${bg};">
          <span style="font-family:'Cormorant Garamond',serif;font-size:clamp(32px,5vw,52px);font-weight:300;letter-spacing:1px;color:${tx};line-height:1.1;text-transform:uppercase;">${title}</span>
          ${line}${dateEl}${descEl}${countEl}
          <span style="font-size:8px;color:${tx};opacity:0.2;margin-top:auto;letter-spacing:2px;font-family:'Syne',sans-serif;text-transform:uppercase;">IVAE Studios</span>
        </div>
      </div>`;
    }
    if (design === 'bold') {
      return `<div style="position:relative;min-height:100vh;${bgImg}">
        <div style="position:absolute;inset:0;background:rgba(0,0,0,0.5);"></div>
        <div style="position:relative;z-index:2;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;padding:60px 24px;text-align:center;">
          <span style="font-family:'Syne',sans-serif;font-size:clamp(28px,5vw,52px);font-weight:800;color:white;letter-spacing:8px;text-transform:uppercase;text-align:center;line-height:1.15;">${title}</span>
          <span style="width:36px;height:1px;background:rgba(255,255,255,0.3);display:block;margin:18px auto;"></span>
          ${date ? `<span style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,0.5);font-family:'Syne',sans-serif;">${date}</span>` : ''}
          <span style="display:inline-block;font-size:9px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:rgba(255,255,255,0.25);margin-top:20px;">${count} photos</span>
        </div>
      </div>`;
    }
    if (design === 'stacked') {
      return `<div style="position:relative;min-height:100vh;${bgImg}">
        <div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,0.65));padding:60px 48px 36px;z-index:2;">
          <span style="font-family:'Cormorant Garamond',serif;font-size:clamp(28px,5vw,48px);font-weight:300;letter-spacing:2px;color:white;text-transform:uppercase;">${title}</span>
          ${date ? `<span style="display:block;font-size:10px;color:rgba(255,255,255,0.5);margin-top:8px;letter-spacing:1.5px;font-family:'Syne',sans-serif;text-transform:uppercase;">${date}</span>` : ''}
          <span style="display:inline-block;font-size:9px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:rgba(255,255,255,0.3);margin-top:12px;">${count} photos</span>
        </div>
      </div>`;
    }
    if (design === 'framed') {
      return `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;background:${bg};padding:40px;">
        <div style="width:50%;max-width:500px;aspect-ratio:4/3;${bgImg};border:1px solid ${tx === '#ffffff' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)'};"></div>
        <div style="margin-top:24px;text-align:center;">${titleEl}${line}${dateEl}${countEl}</div>
      </div>`;
    }
    if (design === 'elegant') {
      return `<div style="display:flex;flex-direction:column;min-height:100vh;background:${bg};padding:24px 12%;">
        <div style="text-align:center;padding:20px 0;">
          ${studio}<div style="margin-top:12px;">${titleEl}</div>${line}${dateEl}
        </div>
        <div style="flex:1;${bgImg}"></div>
        <div style="text-align:center;padding:16px 0;">${countEl}</div>
      </div>`;
    }
    if (design === 'minimal') {
      return `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;background:${bg};padding:60px 24px;text-align:center;">
        ${studio}<div style="margin-top:24px;">${titleEl}</div>${line}${dateEl}${descEl}${countEl}${arrow}
      </div>`;
    }
    return `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;background:${bg};padding:60px 24px;text-align:center;">
      ${studio}<div style="margin-top:20px;">${titleEl}</div>${line}${dateEl}${countEl}
    </div>`;
  }

  root.IvaeCoverDesigns = { render, renderInner, isDarkColor, OVERLAY_DESIGNS };
})(typeof window !== 'undefined' ? window : globalThis);
