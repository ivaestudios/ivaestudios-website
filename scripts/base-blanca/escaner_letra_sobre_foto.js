// Escaner de letra sobre foto y de letra invisible.
//
// Para que sirve: oscuros.js mide el contraste con `color`, y por eso no vio dos fallas
// que dejo el paso a blanco del 9-oct-2026:
//   1. letra con relleno transparente y sin degradado (-webkit-text-fill-color:transparent
//      con background:none): el texto existe pero no se ve;
//   2. letra oscura encima de una foto oscurecida con filter:brightness(...).
//
// Como se usa: abrir la pagina, pegar todo esto en la consola y leer lo que devuelve.
// Hacerlo en computadora (ancho 1440 o mas) y en telefono (375). Recorre la pagina
// completa de arriba a abajo y al final regresa al inicio.
//
// Lo que NO ve (confirmar siempre mirando la pagina):
//   - velos puestos con ::before o ::after;
//   - fotos o fondos con pointer-events:none (no salen en elementsFromPoint);
//   - texto que todavia no aparece porque espera una animacion.
(() => {
  const lum = (c) => {
    const m = c.match(/[\d.]+/g);
    if (!m) return null;
    const [r, g, b] = m.slice(0, 3).map(Number).map((v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const avisos = new Map();
  const vistos = new Set();
  let textos = 0;
  const seccion = (e) => {
    const s = e.closest('section,header,footer,aside,[class*=hero],[class*=cta]');
    return s ? s.tagName.toLowerCase() + '.' + String(s.className).split(' ')[0].slice(0, 26) : '-';
  };
  const anotar = (clave, texto) => avisos.set(clave, (avisos.get(clave) || []).concat(texto));
  const paso = () => {
    const els = [...document.querySelectorAll('h1,h2,h3,h4,p,a,span,li,button,figcaption,em,strong,blockquote,dt,dd,label')]
      .filter((e) => !vistos.has(e) && [...e.childNodes].some((x) => x.nodeType === 3 && x.textContent.trim().length > 1));
    for (const e of els) {
      const r = e.getBoundingClientRect();
      if (r.width < 8 || r.height < 8) continue;
      const c = getComputedStyle(e);
      if (c.visibility === 'hidden' || c.display === 'none') continue;
      const texto = (e.textContent || '').trim().slice(0, 30);
      const cx = Math.min(innerWidth - 2, Math.max(2, r.left + Math.min(r.width / 2, 60)));
      const cy = r.top + Math.min(r.height / 2, 14);
      if (cy < 0 || cy > innerHeight) continue;
      vistos.add(e);
      textos++;
      // 1. Letra invisible: relleno transparente sin degradado detras.
      if (/rgba\(0, 0, 0, 0\)/.test(c.webkitTextFillColor) && c.backgroundImage === 'none') {
        anotar('INVISIBLE @ ' + seccion(e), texto);
        continue;
      }
      const pila = document.elementsFromPoint(cx, cy);
      if (!pila.includes(e) && !pila.some((x) => e.contains(x))) continue;
      let foto = null;
      let fondo = null;
      let velos = 0;
      for (const x of pila) {
        const cs = getComputedStyle(x);
        const propio = x === e || e.contains(x);
        if (!propio && (x.tagName === 'IMG' || x.tagName === 'VIDEO' || /url\(/.test(cs.backgroundImage))) { foto = x; break; }
        if (/gradient/.test(cs.backgroundImage)) { velos++; continue; }
        const a = cs.backgroundColor.match(/[\d.]+/g);
        if (a && (a.length < 4 || Number(a[3]) > 0.6)) { fondo = cs.backgroundColor; break; }
        if (a && a.length === 4 && Number(a[3]) > 0.15) velos++;
      }
      const lt = lum(c.color);
      if (lt === null) continue;
      if (foto) {
        // 2. Letra oscura sobre foto. El brillo dice que tan oscurecida esta la foto.
        const bm = getComputedStyle(foto).filter.match(/brightness\(([\d.]+)\)/);
        const brillo = bm ? Number(bm[1]) : 1;
        if (lt < 0.18) anotar('LETRA OSCURA sobre foto (brillo ' + brillo + ', velos ' + velos + ') @ ' + seccion(e), texto);
      } else if (fondo) {
        const lf = lum(fondo);
        const razon = (Math.max(lt, lf) + 0.05) / (Math.min(lt, lf) + 0.05);
        if (razon < 2.0) anotar('BAJO CONTRASTE @ ' + seccion(e), razon.toFixed(1) + ' ' + texto);
      }
    }
  };
  const alto = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
  for (let y = 0; y < alto; y += Math.round(innerHeight * 0.85)) {
    scrollTo({ top: y, left: 0, behavior: 'instant' });
    paso();
  }
  scrollTo({ top: 0, left: 0, behavior: 'instant' });
  const lineas = [...avisos.entries()].map(([k, v]) => '  ' + k + ' x' + v.length + ' | ej: ' + v.slice(0, 2).join(' ; '));
  return location.pathname + ' | ancho ' + innerWidth + ' | textos ' + textos + '\n' + (lineas.join('\n') || '  sin avisos');
})();
