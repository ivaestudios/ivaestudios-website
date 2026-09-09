/* ═══════════════════════════════════════════════════════════════════════
   ESCÁNER DE CONTRASTE · WebKit · creado 2026-09-08
   Uso:  node scripts/auditar-contraste-webkit.js <url> [url...]
   Necesita playwright-core y el WebKit de ~/Library/Caches/ms-playwright.

   Mide la razón de contraste REAL de cada nodo de texto contra el primer
   fondo OPACO que encuentra subiendo por sus padres, aplicando la alfa del
   color y la opacidad heredada. Ignora lo que va sobre foto, porque ahí no
   se puede medir así.

   LO QUE ENCONTRÓ LA PRIMERA VEZ (para saber qué clase de cosas caza):
   · El "Saltar al contenido" salía DORADO SOBRE DORADO en las 551 páginas.
     Razón 1.0. Es lo primero que toca quien navega con teclado.
   · 39 textos en las páginas de ciudad entre 2.89 y 3.31, porque un mismo
     dorado vestía el fondo crema y el fondo tinta.
   · Tokens del sistema apenas por debajo: --muted-l daba 4.21.

   FALSOS POSITIVOS CONOCIDOS, no perseguirlos:
   · El botón "Seguir en" del widget de Pinterest (4.41): lo inyecta
     Pinterest, no es nuestro.
   · Un skip-link fuera de pantalla NO es falso positivo: hay que medirlo
     CON foco, que es cuando se ve.
   ═══════════════════════════════════════════════════════════════════════ */

const { webkit } = require("playwright-core");
const PGS = process.argv.slice(2);
(async () => {
  const b = await webkit.launch({ executablePath: "/Users/ivae/Library/Caches/ms-playwright/webkit-2336/pw_run.sh" });
  for (const u of PGS) {
    const pg = await b.newPage({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 1, isMobile: true });
    let ok = null;
    try { ok = await pg.goto(u, { waitUntil: "domcontentloaded", timeout: 90000 }); } catch (e) {}
    if (!ok || !ok.ok()) { console.log("NO CARGA", u); await pg.close(); continue; }
    await pg.waitForTimeout(2500);
    const malos = await pg.evaluate(() => {
      const lin = c => { c /= 255; return c <= 0.04045 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4); };
      const L = ([r,g,b]) => 0.2126*lin(r) + 0.7152*lin(g) + 0.0722*lin(b);
      const rgb = s => { const m = s.match(/[\d.]+/g); return m ? m.slice(0,3).map(Number) : null; };
      const alfa = s => { const m = s.match(/[\d.]+/g); return m && m.length > 3 ? parseFloat(m[3]) : 1; };
      // color de fondo REAL: sube por los padres hasta encontrar uno opaco
      const fondo = e => {
        let n = e;
        while (n && n !== document.documentElement) {
          const cs = getComputedStyle(n);
          if (cs.backgroundImage !== "none") return null;        // sobre foto: no se puede medir así
          const c = rgb(cs.backgroundColor);
          if (c && alfa(cs.backgroundColor) > 0.85) return c;
          n = n.parentElement;
        }
        return [255,255,255];
      };
      const res = [];
      document.querySelectorAll("p, li, span, a, h1, h2, h3, h4, figcaption, dd, dt, summary, td").forEach(e => {
        const t = (e.textContent || "").trim();
        if (t.length < 6) return;
        if ([...e.children].some(c => (c.textContent||"").trim().length > 4)) return;
        const cs = getComputedStyle(e);
        if (cs.display === "none" || cs.visibility === "hidden") return;
        const r = e.getBoundingClientRect();
        if (r.width < 4 || r.height < 4 || r.left < -300) return;
        let op = 1, n = e;
        while (n && n !== document.body) { op *= parseFloat(getComputedStyle(n).opacity) || 1; n = n.parentElement; }
        if (op < 0.5) return;                                     // aún no revelado
        const fg = rgb(cs.color), bg = fondo(e);
        if (!fg || !bg) return;
        const a = alfa(cs.color) * op;
        const mez = fg.map((v,i) => v*a + bg[i]*(1-a));
        const l1 = L(mez), l2 = L(bg);
        const ratio = (Math.max(l1,l2)+0.05) / (Math.min(l1,l2)+0.05);
        const px = parseFloat(cs.fontSize), grande = px >= 24 || (px >= 18.66 && parseInt(cs.fontWeight) >= 700);
        const min = grande ? 3 : 4.5;
        if (ratio < min) res.push({ t: t.slice(0,32), r: +ratio.toFixed(2), min, px: Math.round(px),
                                    c: (e.className+"").split(" ")[0] || e.tagName });
      });
      return res;
    });
    const corto = u.replace("https://ivaestudios.com","") || "/";
    console.log((malos.length ? "⚠ " : "✅ ") + corto.padEnd(46) + (malos.length ? malos.length + " bajo el mínimo" : "contraste ok"));
    malos.slice(0,5).forEach(m => console.log(`     ${m.r} (min ${m.min}) ${m.px}px  ${m.c}  "${m.t}"`));
    await pg.close();
  }
  await b.close();
})();
