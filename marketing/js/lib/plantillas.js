// ============================================================================
// IVAE Marketing — PLANTILLAS del generador de carruseles.
//
// Nacieron de estudiar los carruseles que Vianey guarda como referencia
// (Canva: café Wildgrain, skincare neutro, "Own your morning", 5 hábitos,
// FAQ beige, cocktail). El diagnóstico fue claro: la plantilla original
// resolvía UN solo layout — foto a sangre + texto encima + velo — mientras
// que los buenos carruseles alternan cuatro cosas:
//
//   1. MARCO EDITORIAL: micro-tipografía arriba y abajo (marca, P.03/07,
//      fecha). Diminuta, espaciada, en mayúsculas. Es lo que da el aire de
//      revista y lo que más se extrañaba.
//   2. LA CURSIVA COMO ACENTO, no la negrita: "Rise *earlier*". Para una
//      marca de fotografía es mucho más elegante que un **bold**.
//   3. EL TEXTO NO SIEMPRE VA SOBRE LA FOTO: puede ir en una tarjeta de papel
//      flotante o en un panel sólido debajo. Eso resuelve la legibilidad de
//      RAÍZ — sin velo, sin pelear con la textura.
//   4. MENOS TEXTO Y MÁS AIRE: dos o tres palabras de título, una línea de
//      apoyo, y espacio.
//
// Cada plantilla exporta:
//   id, nombre, descripcion   → para el selector
//   sobreFoto                 → ¿el texto va encima de la foto? (si es false
//                               el fotómetro no necesita calcular velo)
//   fuentes                   → qué familias embeber en el SVG
//   css(ctx)                  → hoja de estilos del lienzo 1080×1350
//   html(ctx)                 → el markup de UN slide
//
// `ctx` trae todo ya resuelto: textos, plan del fotómetro, marca, fecha,
// posición, y los ayudantes esc()/acento().
// ============================================================================

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// **texto** → énfasis. Cada plantilla decide si eso es negrita o cursiva:
// es la misma marca del usuario, interpretada con el lenguaje de cada diseño.
const partir = (s) => esc(s).split('**');
const conNegrita = (s) => partir(s).map((p, i) => (i % 2 ? `<b>${p}</b>` : p)).join('');
const conCursiva = (s) => partir(s).map((p, i) => (i % 2 ? `<i>${p}</i>` : p)).join('');

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
export function fechaCorta(iso) {
  const d = /^\d{4}-\d{2}-\d{2}/.test(String(iso || '')) ? new Date(iso + 'T12:00:00') : new Date();
  return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`;
}

// Paginación con el formato de revista: P. 03/07
const folio = (i, n) => `P. ${String(i + 1).padStart(2, '0')}/${String(n).padStart(2, '0')}`;

// ── Base común ──────────────────────────────────────────────────────────────
const RESET = `
*{margin:0;padding:0;box-sizing:border-box}
.slide{position:relative;width:1080px;height:1350px;overflow:hidden;color:#fff;
  -webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
.foto{position:absolute;inset:0}
`;

// El marco editorial: la barra de arriba y la de abajo. Es el elemento que más
// "profesionaliza" un carrusel y el que faltaba por completo.
const MARCO = `
.marco{position:absolute;left:88px;right:88px;display:flex;justify-content:space-between;
  align-items:center;font-family:Outfit,sans-serif;font-size:21px;font-weight:400;
  letter-spacing:.19em;text-transform:uppercase}
.marco.arriba{top:74px}
.marco.abajo{bottom:74px}
.marco span{white-space:nowrap}
.m-claro{color:rgba(255,255,255,.93);text-shadow:0 1px 10px rgba(0,0,0,.5)}
.m-oscuro{color:rgba(28,28,32,.8)}
`;

// ════════════════════════════════════════════════════════════════════════════
// 1. EDITORIAL — la plantilla original, conservada tal cual para no romper el
//    trabajo hecho. Sans grande, mayúsculas, velo calculado por el fotómetro.
// ════════════════════════════════════════════════════════════════════════════
const editorial = {
  id: 'editorial',
  nombre: 'Editorial',
  descripcion: 'Titular grande en mayúsculas sobre la foto. La de siempre.',
  sobreFoto: true,
  fuentes: ['Outfit', 'Pinyon Script'],
  acento: 'negrita',
  css: () => `${RESET}
.slide{font-family:Outfit,sans-serif}
.scrim-top{position:absolute;top:0;left:0;right:0;height:230px;background:linear-gradient(rgba(12,12,16,.34),rgba(12,12,16,0))}
.scrim-block{position:absolute;left:0;right:0}
.scrim-bottom{position:absolute;left:0;right:0;bottom:0;height:240px;background:linear-gradient(rgba(12,12,16,0),rgba(12,12,16,.38))}
.hdr{position:absolute;top:88px;left:104px;right:104px;display:flex;justify-content:space-between;align-items:baseline;text-shadow:0 1px 14px rgba(0,0,0,.45)}
.hdr .h,.hdr .d{font-size:28px;font-weight:400;letter-spacing:.02em;color:rgba(255,255,255,.96)}
.hdr .b{font-family:'Pinyon Script',cursive;font-size:54px;line-height:1;transform:translateY(6px);color:#fff}
.pag{position:absolute;left:104px;bottom:96px;font-size:30px;letter-spacing:.08em;color:rgba(255,255,255,.95);text-shadow:0 1px 12px rgba(0,0,0,.5)}
.chev{position:absolute;right:100px;bottom:84px;width:62px;height:62px;border:2.5px solid rgba(255,255,255,.92);border-radius:50%}
.chev i{position:absolute;top:50%;left:50%;width:16px;height:16px;border-top:2.5px solid rgba(255,255,255,.92);border-right:2.5px solid rgba(255,255,255,.92);transform:translate(-62%,-50%) rotate(45deg)}
.chev.down i{transform:translate(-50%,-64%) rotate(135deg)}
.block{position:absolute;left:104px;right:104px;display:flex;flex-direction:column}
.kicker{font-size:36px;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.96);margin-bottom:26px;text-shadow:0 1px 12px rgba(0,0,0,.5)}
.title{font-size:99px;font-weight:275;line-height:1.07;text-transform:uppercase;letter-spacing:.004em;text-shadow:0 2px 20px rgba(0,0,0,.4);text-wrap:balance}
.title b{font-weight:800}
.title.sm{font-size:82px}
.support{font-size:42px;line-height:1.4;color:rgba(255,255,255,.95);margin-top:44px;max-width:82%;text-shadow:0 1px 12px rgba(0,0,0,.5)}
.support b{font-weight:700}
.pills{display:flex;flex-direction:column;align-items:center;gap:44px;margin-top:64px}
.pills.compactas{gap:26px;margin-top:44px}
.pill{border:1.6px solid rgba(255,255,255,.82);border-radius:50%;padding:34px 78px;font-size:39px;line-height:1.3;text-align:center;max-width:760px;color:rgba(255,255,255,.98);text-shadow:0 1px 12px rgba(0,0,0,.5)}
.pills.compactas .pill{padding:24px 56px;font-size:36px}
.pill:nth-child(1){transform:rotate(-1.6deg) translateX(-26px)}
.pill:nth-child(2){transform:rotate(1.3deg) translateX(22px)}
.pill:nth-child(3){transform:rotate(-1.1deg) translateX(-16px)}
.slide.t-oscuro .block{color:#18181E}
.slide.t-oscuro .kicker,.slide.t-oscuro .support{color:rgba(24,24,30,.92)}
.slide.t-oscuro .pill{color:#18181E;border-color:rgba(24,24,30,.55)}
.slide.t-oscuro .title,.slide.t-oscuro .kicker,.slide.t-oscuro .support{text-shadow:0 1px 10px rgba(255,255,255,.55)}
.veil-claro{background:linear-gradient(rgba(247,247,245,0),rgba(247,247,245,var(--va)) 90px,rgba(247,247,245,var(--va)))}
.hdr-oscuro .hdr .h,.hdr-oscuro .hdr .d{color:rgba(24,24,30,.9)}
.hdr-oscuro .hdr .b{color:#18181E}
.hdr-oscuro .hdr{text-shadow:0 1px 10px rgba(255,255,255,.55)}
.pie-oscuro .pag{color:rgba(24,24,30,.92);text-shadow:0 1px 10px rgba(255,255,255,.5)}
.pie-oscuro .chev{border-color:rgba(24,24,30,.7)}
.pie-oscuro .chev i{border-top-color:rgba(24,24,30,.7);border-right-color:rgba(24,24,30,.7)}
.hdr-refuerzo .hdr{text-shadow:0 1px 3px rgba(0,0,0,.9),0 2px 18px rgba(0,0,0,.7)}
.hdr-refuerzo.hdr-oscuro .hdr{text-shadow:0 1px 3px rgba(255,255,255,.95),0 2px 16px rgba(255,255,255,.8)}
.pie-refuerzo .pag{text-shadow:0 1px 3px rgba(0,0,0,.9),0 2px 18px rgba(0,0,0,.7)}
.pie-refuerzo.pie-oscuro .pag{text-shadow:0 1px 3px rgba(255,255,255,.95),0 2px 16px rgba(255,255,255,.8)}
.banda{position:absolute;left:0;right:0;background:#0C0C10}
.slide.t-banda .block{color:#fff}
`,
  html: (c) => {
    let inner = '';
    if (c.kicker) inner += `<div class="kicker">${esc(c.kicker)}</div>`;
    if (c.title) inner += `<div class="title${c.smTitle ? ' sm' : ''}">${conNegrita(c.title)}</div>`;
    if (c.items) inner += `<div class="pills${c.compactas ? ' compactas' : ''}">${c.items.map((i) => `<div class="pill">${esc(i)}</div>`).join('')}</div>`;
    if (c.plainBody) inner += `<div class="support">${conNegrita(c.plainBody)}</div>`;
    if (c.support) inner += `<div class="support">${conNegrita(c.support)}</div>`;
    return `<div class="slide${c.claseModo}">
      ${c.modo === 'oscuro' ? '' : '<div class="scrim-top"></div>'}
      ${c.veloHTML}
      ${c.modo === 'oscuro' ? '' : '<div class="scrim-bottom"></div>'}
      <div class="hdr"><span class="h">${esc(c.handle)}</span><span class="b">${esc(c.marca)}</span><span class="d">${c.fecha}</span></div>
      ${c.hasText ? `<div class="block" style="top:${c.blockTop}${c.miniCSS}">${inner}</div>` : ''}
      <div class="pag">${String(c.idx + 1).padStart(2, '0')}\\${String(c.total).padStart(2, '0')}</div>
      <div class="chev${c.isLast ? ' down' : ''}"><i></i></div>
    </div>`;
  },
};

// ════════════════════════════════════════════════════════════════════════════
// 2. REVISTA — el aprendizaje principal. Serif de la marca (Cormorant), la
//    cursiva como acento, marco editorial arriba y abajo, y la flecha circular
//    centrada que invita a deslizar. Es el lenguaje de "Own your morning".
// ════════════════════════════════════════════════════════════════════════════
const revista = {
  id: 'revista',
  nombre: 'Revista',
  descripcion: 'Serif de la marca, cursiva de acento y marco de revista. Elegante.',
  sobreFoto: true,
  fuentes: ['Cormorant', 'Outfit'],
  acento: 'cursiva',
  css: () => `${RESET}${MARCO}
.slide{font-family:Cormorant,Georgia,serif}
.tono{position:absolute;inset:0;background:linear-gradient(rgba(16,14,12,.30),rgba(16,14,12,.10) 38%,rgba(16,14,12,.34))}
.tono.suave{background:linear-gradient(rgba(250,248,244,.34),rgba(250,248,244,.12) 38%,rgba(250,248,244,.30))}
.bloque{position:absolute;left:120px;right:120px;text-align:center;display:flex;flex-direction:column;align-items:center}
.eyebrow{font-family:Outfit,sans-serif;font-size:23px;letter-spacing:.24em;text-transform:uppercase;
  color:rgba(255,255,255,.9);margin-bottom:30px;text-shadow:0 1px 10px rgba(0,0,0,.45)}
.tit{font-size:104px;font-weight:400;line-height:1.02;letter-spacing:-.005em;text-wrap:balance;
  text-shadow:0 2px 22px rgba(0,0,0,.34)}
.tit i{font-style:italic;font-weight:400}
.tit.sm{font-size:86px}
.bajada{font-family:Outfit,sans-serif;font-size:27px;font-weight:400;letter-spacing:.13em;
  line-height:1.65;text-transform:uppercase;color:rgba(255,255,255,.93);margin-top:38px;max-width:74%;
  text-shadow:0 1px 10px rgba(0,0,0,.5)}
.lista{margin-top:46px;display:flex;flex-direction:column;gap:26px;width:100%;max-width:720px}
.li{font-size:42px;line-height:1.3;padding-bottom:22px;border-bottom:1px solid rgba(255,255,255,.34);
  text-shadow:0 1px 12px rgba(0,0,0,.45)}
.li:last-child{border-bottom:0}
.flecha{position:absolute;left:50%;transform:translateX(-50%);bottom:168px;width:82px;height:82px;
  border:1.7px solid rgba(255,255,255,.85);border-radius:50%}
.flecha i{position:absolute;top:50%;left:50%;width:30px;height:1.7px;background:rgba(255,255,255,.9);transform:translate(-50%,-50%)}
.flecha i::after{content:'';position:absolute;right:0;top:50%;width:12px;height:12px;
  border-top:1.7px solid rgba(255,255,255,.9);border-right:1.7px solid rgba(255,255,255,.9);
  transform:translate(1px,-50%) rotate(45deg)}
.flecha.abajo{transform:translateX(-50%) rotate(90deg)}
/* Variante clara: sobre fotos luminosas todo el sistema se invierte. */
.claro .eyebrow,.claro .bajada{color:rgba(26,24,22,.86);text-shadow:0 1px 9px rgba(255,255,255,.5)}
.claro .tit{color:#1A1816;text-shadow:0 1px 12px rgba(255,255,255,.55)}
.claro .li{color:#1A1816;border-bottom-color:rgba(26,24,22,.3);text-shadow:0 1px 10px rgba(255,255,255,.5)}
.claro .flecha{border-color:rgba(26,24,22,.7)}
.claro .flecha i{background:rgba(26,24,22,.8)}
.claro .flecha i::after{border-top-color:rgba(26,24,22,.8);border-right-color:rgba(26,24,22,.8)}
`,
  html: (c) => {
    const claro = c.modo === 'oscuro';
    let inner = '';
    if (c.kicker) inner += `<div class="eyebrow">${esc(c.kicker)}</div>`;
    if (c.title) inner += `<div class="tit${c.smTitle ? ' sm' : ''}">${conCursiva(c.title)}</div>`;
    if (c.items) inner += `<div class="lista">${c.items.map((i) => `<div class="li">${esc(i)}</div>`).join('')}</div>`;
    const bajada = c.plainBody || c.support;
    if (bajada) inner += `<div class="bajada">${esc(bajada.replace(/\*\*/g, ''))}</div>`;
    return `<div class="slide${claro ? ' claro' : ''}">
      <div class="tono${claro ? ' suave' : ''}"></div>
      <div class="marco arriba ${claro ? 'm-oscuro' : 'm-claro'}">
        <span>${esc(c.marca)}</span><span>${folio(c.idx, c.total)}</span>
      </div>
      ${c.hasText ? `<div class="bloque" style="top:${c.blockTop}${c.miniCSS}">${inner}</div>` : ''}
      <div class="flecha${c.isLast ? ' abajo' : ''}"><i></i></div>
      <div class="marco abajo ${claro ? 'm-oscuro' : 'm-claro'}">
        <span>${c.fecha}</span><span>${esc(c.handle)}</span>
      </div>
    </div>`;
  },
};

// ════════════════════════════════════════════════════════════════════════════
// 3. NOTA — tarjeta de papel flotando sobre la foto. Resuelve la legibilidad
//    de RAÍZ: el texto nunca pelea con la imagen, así que funciona con
//    CUALQUIER foto, por complicada que sea. Es el truco de "5 hábitos".
// ════════════════════════════════════════════════════════════════════════════
const nota = {
  id: 'nota',
  nombre: 'Nota',
  descripcion: 'Tarjeta de papel sobre la foto. Se lee siempre, con cualquier imagen.',
  sobreFoto: false,
  fuentes: ['Cormorant', 'Outfit'],
  acento: 'cursiva',
  css: () => `${RESET}${MARCO}
.slide{font-family:Cormorant,Georgia,serif}
.tono{position:absolute;inset:0;background:linear-gradient(rgba(14,13,12,.20),rgba(14,13,12,.06) 42%,rgba(14,13,12,.26))}
.papel{position:absolute;left:132px;right:132px;background:#FAF8F4;color:#1B1A18;
  padding:88px 74px 78px;box-shadow:0 32px 70px rgba(0,0,0,.24),0 4px 12px rgba(0,0,0,.12);
  display:flex;flex-direction:column;align-items:center;text-align:center}
.cinta{position:absolute;top:-26px;left:50%;transform:translateX(-50%) rotate(-1.6deg);
  width:188px;height:52px;background:rgba(228,222,210,.82);border-left:1px solid rgba(0,0,0,.05);
  border-right:1px solid rgba(0,0,0,.05)}
.num{font-family:Outfit,sans-serif;font-size:24px;letter-spacing:.26em;color:rgba(27,26,24,.5);margin-bottom:26px}
.tit{font-size:88px;font-weight:400;line-height:1.06;letter-spacing:-.004em;text-wrap:balance}
.tit i{font-style:italic}
.tit.sm{font-size:72px}
.bajada{font-family:Outfit,sans-serif;font-size:28px;line-height:1.62;color:rgba(27,26,24,.74);margin-top:34px;max-width:88%}
.lista{margin-top:38px;display:flex;flex-direction:column;gap:20px;width:100%}
.li{font-size:38px;line-height:1.34;padding-bottom:18px;border-bottom:1px solid rgba(27,26,24,.16)}
.li:last-child{border-bottom:0;padding-bottom:0}
.rubrica{position:absolute;left:0;right:0;bottom:74px;text-align:center;font-family:Outfit,sans-serif;
  font-size:22px;letter-spacing:.2em;text-transform:uppercase;color:rgba(255,255,255,.92);
  text-shadow:0 1px 10px rgba(0,0,0,.55)}
.rubrica.oscura{color:rgba(26,24,22,.85);text-shadow:0 1px 9px rgba(255,255,255,.55)}
`,
  html: (c) => {
    let inner = `<div class="cinta"></div>`;
    inner += `<div class="num">${String(c.idx + 1).padStart(2, '0')} — ${String(c.total).padStart(2, '0')}</div>`;
    if (c.kicker) inner += `<div class="num" style="margin-top:-14px">${esc(c.kicker)}</div>`;
    if (c.title) inner += `<div class="tit${c.smTitle ? ' sm' : ''}">${conCursiva(c.title)}</div>`;
    if (c.items) inner += `<div class="lista">${c.items.map((i) => `<div class="li">${esc(i)}</div>`).join('')}</div>`;
    const bajada = c.plainBody || c.support;
    if (bajada) inner += `<div class="bajada">${conCursiva(bajada)}</div>`;
    // El papel se centra vertical: no depende de dónde el fotómetro vio hueco.
    return `<div class="slide">
      <div class="tono"></div>
      <div class="marco arriba ${c.marcoArriba}"><span>${esc(c.marca)}</span><span>${folio(c.idx, c.total)}</span></div>
      <div class="papel" style="top:${c.papelTop}px">${inner}</div>
      <div class="rubrica ${c.marcoAbajo === 'm-oscuro' ? 'oscura' : ''}">${esc(c.handle)}</div>
    </div>`;
  },
};

// ════════════════════════════════════════════════════════════════════════════
// 4. FICHA — split horizontal: la foto arriba, un panel sólido abajo con el
//    texto. Contraste garantizado por construcción y aire de catálogo. Es el
//    esquema del carrusel de cocktails.
// ════════════════════════════════════════════════════════════════════════════
const ficha = {
  id: 'ficha',
  nombre: 'Ficha',
  descripcion: 'Foto arriba y panel de color abajo. Ideal para explicar o listar.',
  sobreFoto: false,
  fuentes: ['Cormorant', 'Outfit'],
  acento: 'cursiva',
  css: (c) => `${RESET}${MARCO}
/* OJO: .slide NO lleva fondo. Esta capa se pinta ENCIMA de la foto del canvas;
   un color sólido aquí tapaba la foto entera y el slide salía liso. */
.slide{font-family:Cormorant,Georgia,serif}
.panel{position:absolute;left:0;right:0;bottom:0;height:44%;background:${c.tinta};color:#F3F0EA;
  padding:74px 104px 96px;display:flex;flex-direction:column}
.eyebrow{font-family:Outfit,sans-serif;font-size:22px;letter-spacing:.24em;text-transform:uppercase;
  color:rgba(243,240,234,.62);padding-bottom:20px;margin-bottom:26px;border-bottom:1px solid rgba(243,240,234,.24)}
.tit{font-size:76px;font-weight:400;line-height:1.06;letter-spacing:-.004em;text-wrap:balance}
.tit i{font-style:italic}
.tit.sm{font-size:62px}
.bajada{font-family:Outfit,sans-serif;font-size:26px;line-height:1.66;color:rgba(243,240,234,.8);margin-top:26px}
.lista{margin-top:26px;display:flex;flex-direction:column;gap:14px}
.li{font-family:Outfit,sans-serif;font-size:25px;line-height:1.5;color:rgba(243,240,234,.84);padding-left:30px;position:relative}
.li::before{content:'';position:absolute;left:0;top:15px;width:14px;height:1px;background:rgba(243,240,234,.6)}
.pieficha{position:absolute;left:104px;right:104px;bottom:44px;display:flex;justify-content:space-between;
  font-family:Outfit,sans-serif;font-size:20px;letter-spacing:.2em;text-transform:uppercase;color:rgba(243,240,234,.55)}
`,
  html: (c) => {
    let inner = '';
    if (c.kicker) inner += `<div class="eyebrow">${esc(c.kicker)}</div>`;
    if (c.title) inner += `<div class="tit${c.smTitle ? ' sm' : ''}">${conCursiva(c.title)}</div>`;
    if (c.items) inner += `<div class="lista">${c.items.map((i) => `<div class="li">${esc(i)}</div>`).join('')}</div>`;
    const bajada = c.plainBody || c.support;
    if (bajada) inner += `<div class="bajada">${conCursiva(bajada)}</div>`;
    return `<div class="slide">
      <div class="marco arriba ${c.marcoArriba}"><span>${esc(c.marca)}</span><span>${folio(c.idx, c.total)}</span></div>
      <div class="panel">${inner}
        <div class="pieficha"><span>${c.fecha}</span><span>${esc(c.handle)}</span></div>
      </div>
    </div>`;
  },
};

// ════════════════════════════════════════════════════════════════════════════
// 5. SUAVE — minúsculas, texto abajo, detalle en mayúsculas espaciadas y cero
//    paginación. El lenguaje del café Wildgrain: calmado, cálido, sin ruido.
// ════════════════════════════════════════════════════════════════════════════
const suave = {
  id: 'suave',
  nombre: 'Suave',
  descripcion: 'Minúsculas, texto abajo y mucho aire. Cálido y sin ruido.',
  sobreFoto: true,
  fuentes: ['Outfit', 'Cormorant'],
  acento: 'cursiva',
  css: () => `${RESET}
.slide{font-family:Outfit,sans-serif}
.tono{position:absolute;inset:0;background:linear-gradient(rgba(12,11,10,0) 44%,rgba(12,11,10,.62))}
.bloque{position:absolute;left:104px;right:104px;bottom:180px;text-align:center;
  display:flex;flex-direction:column;align-items:center}
.tit{font-size:78px;font-weight:300;line-height:1.12;letter-spacing:-.012em;text-transform:lowercase;
  text-shadow:0 2px 20px rgba(0,0,0,.42);text-wrap:balance}
.tit i{font-family:Cormorant,Georgia,serif;font-style:italic;font-weight:400;font-size:1.06em}
.tit.sm{font-size:64px}
.detalle{font-size:24px;font-weight:400;letter-spacing:.19em;line-height:1.75;text-transform:uppercase;
  color:rgba(255,255,255,.86);margin-top:30px;max-width:78%;text-shadow:0 1px 10px rgba(0,0,0,.55)}
.lista{margin-top:34px;display:flex;flex-direction:column;gap:16px}
.li{font-size:26px;letter-spacing:.15em;text-transform:uppercase;color:rgba(255,255,255,.9);
  text-shadow:0 1px 10px rgba(0,0,0,.5)}
.firma{position:absolute;left:0;right:0;bottom:88px;text-align:center;font-size:23px;
  letter-spacing:.3em;text-transform:uppercase;color:rgba(255,255,255,.9);text-shadow:0 1px 12px rgba(0,0,0,.55)}
.puntos{position:absolute;left:0;right:0;bottom:52px;display:flex;justify-content:center;gap:11px}
.pt{width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,.42)}
.pt.on{background:rgba(255,255,255,.96)}
`,
  html: (c) => {
    let inner = '';
    if (c.title) inner += `<div class="tit${c.smTitle ? ' sm' : ''}">${conCursiva(c.title)}</div>`;
    if (c.items) inner += `<div class="lista">${c.items.map((i) => `<div class="li">${esc(i)}</div>`).join('')}</div>`;
    const det = [c.kicker, c.plainBody || c.support].filter(Boolean).join(' · ');
    if (det) inner += `<div class="detalle">${esc(det.replace(/\*\*/g, ''))}</div>`;
    const puntos = Array.from({ length: c.total }, (_, i) => `<div class="pt${i === c.idx ? ' on' : ''}"></div>`).join('');
    return `<div class="slide">
      <div class="tono"></div>
      ${c.hasText ? `<div class="bloque">${inner}</div>` : ''}
      <div class="firma">${esc(c.marca || c.handle)}</div>
      <div class="puntos">${puntos}</div>
    </div>`;
  },
};

export const PLANTILLAS = [editorial, revista, nota, ficha, suave];
export const PLANTILLA_POR_DEFECTO = 'revista';
export function plantillaPorId(id) {
  return PLANTILLAS.find((p) => p.id === id) || PLANTILLAS.find((p) => p.id === PLANTILLA_POR_DEFECTO);
}
export { esc, conNegrita, conCursiva };
