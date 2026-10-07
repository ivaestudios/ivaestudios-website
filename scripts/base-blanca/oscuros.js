// Lista bloques con fondo oscuro (no foto) y textos con contraste bajo, por pagina, con el CSS de prueba inyectado y el modo oscuro apagado.
const { chromium } = require('/Users/ivae/Desktop/CLINICA-BASE/node_modules/playwright');
const fs = require('fs');
const [,, CSS, LIST, OUTJSON, WIDTH] = process.argv;
const css = fs.readFileSync(CSS, 'utf8');
const pages = fs.readFileSync(LIST, 'utf8').split('\n').map(s => s.trim()).filter(Boolean);
const W = +(WIDTH || 402);
(async () => {
  const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const ctx = await b.newContext({ viewport: { width: W, height: 874 }, isMobile: W < 800, hasTouch: W < 800, locale: 'en-US' });
  await ctx.route('**/dark-mode.js*', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
  await ctx.addInitScript(() => { const add = DOMTokenList.prototype.add; DOMTokenList.prototype.add = function (...t) { if (this === document.documentElement.classList) t = t.filter(x => x !== 'dark'); return add.apply(this, t); }; });
  await ctx.addInitScript(css => { const put = () => { if (document.getElementById('bb')) return; const st = document.createElement('style'); st.id = 'bb'; st.textContent = css; (document.head || document.documentElement).appendChild(st); }; document.addEventListener('DOMContentLoaded', () => { const st = document.getElementById('bb'); if (st) document.head.appendChild(st); else put(); }); put(); }, css);
  const out = {};
  for (const p of pages) {
    const pg = await ctx.newPage();
    try { await pg.goto('http://localhost:8899' + p, { waitUntil: 'networkidle', timeout: 45000 }); } catch (e) {}
    await pg.waitForTimeout(600);
    const h = await pg.evaluate(() => document.documentElement.scrollHeight);
    const acc = { oscuros: {}, bajos: {} };
    for (let y = 0; y < h; y += 700) {
      await pg.evaluate(y => scrollTo(0, y), y); await pg.waitForTimeout(120);
      const r = await pg.evaluate(() => {
        const parse = c => { const m = c && c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const v = m[1].split(',').map(parseFloat); return { r: v[0], g: v[1], b: v[2], a: v.length > 3 ? v[3] : 1 }; };
        const lum = c => { const f = x => { x /= 255; return x <= .03928 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4); }; return .2126 * f(c.r) + .7152 * f(c.g) + .0722 * f(c.b); };
        const name = e => { let s = e.tagName.toLowerCase(); const c = (typeof e.className === 'string' ? e.className.trim().split(/\s+/).filter(Boolean)[0] : ''); if (c) s += '.' + c; return s; };
        const chain = e => { const a = []; let x = e; while (x && x !== document.body && a.length < 3) { a.unshift(name(x)); x = x.parentElement; } return a.join(' > '); };
        const isPhoto = e => { let x = e; for (let i = 0; x && i < 4; i++, x = x.parentElement) { const s = getComputedStyle(x); if (/url\(/.test(s.backgroundImage)) return true; if ([...x.children].some(c => /^(IMG|PICTURE|VIDEO)$/.test(c.tagName) && getComputedStyle(c).position === 'absolute')) return true; } return false; };
        const vis = e => { const rc = e.getBoundingClientRect(); return rc.width > 40 && rc.height > 16 && rc.bottom > 0 && rc.top < innerHeight; };
        const osc = [], baj = [];
        for (const el of document.querySelectorAll('body *')) {
          if (!vis(el)) continue;
          const s = getComputedStyle(el); if (s.visibility === 'hidden' || +s.opacity < .3) continue;
          const bg = parse(s.backgroundColor);
          const grad = /gradient\(/.test(s.backgroundImage) && /rgba?\(\s*(1[0-9]|[0-9]|2[0-9]),\s*(1[0-9]|[0-9]|2[0-9]|3[0-9]),\s*(1[0-9]|[0-9]|2[0-9]|3[0-9])/.test(s.backgroundImage);
          if (((bg && bg.a > .5 && lum(bg) < .2) || grad) && !isPhoto(el)) { const rc = el.getBoundingClientRect(); osc.push({ k: chain(el), w: Math.round(rc.width), h: Math.round(rc.height), bg: s.backgroundColor + (grad ? ' +grad' : '') }); }
          const txt = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join(' ').trim();
          if (!txt) continue;
          const fg = parse(s.color); if (!fg) continue;
          let e = el, b2 = null, foto = false;
          while (e) { const st = getComputedStyle(e); if (/url\(/.test(st.backgroundImage)) { foto = true; break; } if ([...e.children].some(c => /^(IMG|PICTURE|VIDEO)$/.test(c.tagName) && getComputedStyle(c).position === 'absolute')) { foto = true; break; } const c = parse(st.backgroundColor); if (c && c.a > .5) { b2 = c; break; } e = e.parentElement; }
          if (foto || !b2) continue;
          const a = fg.a, mix = { r: fg.r * a + b2.r * (1 - a), g: fg.g * a + b2.g * (1 - a), b: fg.b * a + b2.b * (1 - a) };
          const L1 = lum(mix), L2 = lum(b2), ratio = (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05);
          if (ratio < 3) baj.push({ k: chain(el), t: txt.slice(0, 30), ratio: +ratio.toFixed(2), fg: s.color, bg: `rgb(${b2.r},${b2.g},${b2.b})` });
        }
        return { osc, baj };
      });
      for (const o of r.osc) acc.oscuros[o.k] = acc.oscuros[o.k] || o;
      for (const o of r.baj) if (!acc.bajos[o.k] || acc.bajos[o.k].ratio > o.ratio) acc.bajos[o.k] = o;
    }
    out[p] = acc;
    console.log(`${p}: oscuros ${Object.keys(acc.oscuros).length}, contraste bajo ${Object.keys(acc.bajos).length}`);
    await pg.close();
  }
  fs.writeFileSync(OUTJSON, JSON.stringify(out, null, 1));
  await b.close();
})();
