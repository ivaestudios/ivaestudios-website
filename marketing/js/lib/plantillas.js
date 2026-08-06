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
// ⚠️ REGLA DURA DEL PIPELINE: esta capa se pinta ENCIMA de la foto que ya
// dibujó el canvas. NINGUNA plantilla puede poner `background` en `.slide`:
// taparía la foto entera y el slide saldría de color liso. Para oscurecer, se
// usa una capa aparte (.tono, .viñeta) con rgba — nunca un color opaco.
const RESET = `
*{margin:0;padding:0;box-sizing:border-box}
.slide{position:relative;width:1080px;height:1350px;overflow:hidden;color:#fff;
  -webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
.foto{position:absolute;inset:0}
`;

// El marco editorial: la barra de arriba y la de abajo. Es el elemento que más
// "profesionaliza" un carrusel y el que faltaba por completo.
// Los velos de las franjas del marco. El texto de la marca/folio/fecha es el
// más chico del diseño y cae donde caiga: sin esto desaparecía sobre un cielo.
const VELOS_MARCO = `
.velo-arriba{position:absolute;top:0;left:0;right:0;height:300px;
  background:linear-gradient(rgba(8,8,10,var(--va-top,.34)),rgba(8,8,10,calc(var(--va-top,.34) * .55)) 45%,rgba(8,8,10,0))}
.velo-abajo{position:absolute;bottom:0;left:0;right:0;height:340px;
  background:linear-gradient(rgba(8,8,10,0),rgba(8,8,10,calc(var(--va-bot,.34) * .55)) 45%,rgba(8,8,10,var(--va-bot,.34)))}
`;

const MARCO = `
/* Márgenes que respetan lo que Instagram YA ocupa: la cuadrícula del perfil
   recorta a 3:4 (~34px por lado) y la franja inferior de la interfaz se come
   ~160px. Y el folio va a la IZQUIERDA: arriba a la derecha vive la píldora
   "1/5" nativa, competir con ella se ve amateur. */
.marco{position:absolute;left:96px;right:96px;display:flex;justify-content:space-between;
  align-items:center;font-family:Outfit,sans-serif;font-size:30px;font-weight:500;
  letter-spacing:.16em;text-transform:uppercase}
.marco.arriba{top:78px;justify-content:flex-start;gap:22px}
.marco.abajo{bottom:170px}
.marco span{white-space:nowrap}
.m-claro{color:rgba(255,255,255,.93);text-shadow:0 0 9px rgba(0,0,0,.85),0 2px 6px rgba(0,0,0,.5)}
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
.hdr{position:absolute;top:88px;left:104px;right:104px;display:flex;justify-content:space-between;align-items:baseline;text-shadow:0 0 9px rgba(0,0,0,.85),0 2px 6px rgba(0,0,0,.5)}
.hdr .h,.hdr .d{font-size:34px;font-weight:400;letter-spacing:.02em;color:rgba(255,255,255,.96)}
.hdr .b{font-family:'Pinyon Script',cursive;font-size:54px;line-height:1;transform:translateY(6px);color:#fff}
.pag{position:absolute;left:104px;bottom:96px;font-size:30px;letter-spacing:.08em;color:rgba(255,255,255,.95);text-shadow:0 0 9px rgba(0,0,0,.85),0 2px 6px rgba(0,0,0,.5)}
.chev{position:absolute;right:100px;bottom:84px;width:62px;height:62px;border:2.5px solid rgba(255,255,255,.92);border-radius:50%}
.chev i{position:absolute;top:50%;left:50%;width:16px;height:16px;border-top:2.5px solid rgba(255,255,255,.92);border-right:2.5px solid rgba(255,255,255,.92);transform:translate(-62%,-50%) rotate(45deg)}
.chev.down i{transform:translate(-50%,-64%) rotate(135deg)}
.block{position:absolute;left:104px;right:104px;display:flex;flex-direction:column}
.kicker{font-size:36px;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.96);margin-bottom:26px;text-shadow:0 0 9px rgba(0,0,0,.85),0 2px 6px rgba(0,0,0,.5)}
.title{font-size:99px;font-weight:275;line-height:1.07;text-transform:uppercase;letter-spacing:.004em;text-shadow:0 0 9px rgba(0,0,0,.85),0 2px 6px rgba(0,0,0,.5);text-wrap:balance}
.title b{font-weight:800}
.title.sm{font-size:82px}
.support{font-size:42px;line-height:1.4;color:rgba(255,255,255,.95);margin-top:44px;max-width:82%;text-shadow:0 0 9px rgba(0,0,0,.85),0 2px 6px rgba(0,0,0,.5)}
.support b{font-weight:700}
.pills{display:flex;flex-direction:column;align-items:center;gap:44px;margin-top:64px}
.pills.compactas{gap:26px;margin-top:44px}
.pill{border:1.6px solid rgba(255,255,255,.82);border-radius:50%;padding:34px 78px;font-size:39px;line-height:1.3;text-align:center;max-width:760px;color:rgba(255,255,255,.98);text-shadow:0 0 9px rgba(0,0,0,.85),0 2px 6px rgba(0,0,0,.5)}
.pills.compactas .pill{padding:24px 56px;font-size:36px}
.pill:nth-child(1){transform:rotate(-1.6deg) translateX(-26px)}
.pill:nth-child(2){transform:rotate(1.3deg) translateX(22px)}
.pill:nth-child(3){transform:rotate(-1.1deg) translateX(-16px)}
.hdr-refuerzo .hdr{text-shadow:0 1px 3px rgba(0,0,0,.9),0 2px 18px rgba(0,0,0,.7)}
.pie-refuerzo .pag{text-shadow:0 1px 3px rgba(0,0,0,.9),0 2px 18px rgba(0,0,0,.7)}
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
  css: () => `${RESET}${MARCO}${VELOS_MARCO}
.slide{font-family:Cormorant,Georgia,serif}
/* Oscurecimiento GENERAL, no solo una franja: es lo que da el look editorial
   "moody" que pidió la marca — sombra negra, letra blanca. */
.tono{position:absolute;inset:0;background:linear-gradient(rgba(14,13,12,.46),rgba(14,13,12,.24) 40%,rgba(14,13,12,.52))}
.bloque{position:absolute;left:120px;right:120px;text-align:center;display:flex;flex-direction:column;align-items:center}
.eyebrow{font-family:Outfit,sans-serif;font-size:34px;letter-spacing:.24em;text-transform:uppercase;
  color:rgba(255,255,255,.9);margin-bottom:30px;text-shadow:0 0 9px rgba(0,0,0,.85),0 2px 6px rgba(0,0,0,.5)}
.tit{font-size:104px;font-weight:400;line-height:1.02;letter-spacing:-.005em;text-wrap:balance;
  text-shadow:0 0 9px rgba(0,0,0,.85),0 2px 6px rgba(0,0,0,.5)}
.tit i{font-style:italic;font-weight:400}
.tit.sm{font-size:86px}
/* PORTADA: además del feed se ve en la cuadrícula del perfil (~130pt), donde
   un píxel vale un tercio. Es donde el cliente decide si entra: crece. */
.slide.portada-1 .tit{font-size:152px;line-height:.98}
.slide.portada-1 .tit.sm{font-size:126px}
.slide.portada-1 .eyebrow{font-size:38px}
.bajada{font-family:Outfit,sans-serif;font-size:38px;font-weight:500;letter-spacing:.11em;
  line-height:1.42;text-transform:uppercase;color:rgba(255,255,255,.93);margin-top:38px;max-width:74%;
  text-shadow:0 0 9px rgba(0,0,0,.85),0 2px 6px rgba(0,0,0,.5)}
.lista{margin-top:46px;display:flex;flex-direction:column;gap:26px;width:100%;max-width:720px}
.li{font-family:Outfit,sans-serif;font-size:48px;font-weight:400;line-height:1.34;padding-bottom:22px;border-bottom:1px solid rgba(255,255,255,.34);
  text-shadow:0 0 9px rgba(0,0,0,.85),0 2px 6px rgba(0,0,0,.5)}
.li:last-child{border-bottom:0}
.flecha{position:absolute;left:50%;transform:translateX(-50%);bottom:168px;width:82px;height:82px;
  border:1.7px solid rgba(255,255,255,.85);border-radius:50%}
.flecha i{position:absolute;top:50%;left:50%;width:30px;height:1.7px;background:rgba(255,255,255,.9);transform:translate(-50%,-50%)}
.flecha i::after{content:'';position:absolute;right:0;top:50%;width:12px;height:12px;
  border-top:1.7px solid rgba(255,255,255,.9);border-right:1.7px solid rgba(255,255,255,.9);
  transform:translate(1px,-50%) rotate(45deg)}
.flecha.abajo{transform:translateX(-50%) rotate(90deg)}
/* Fotos MUY luminosas: se sube la sombra general en vez de invertir el texto
   a negro. La letra SIEMPRE es blanca (dirección de marca). */
.slide.velado .tono{background:linear-gradient(rgba(12,11,10,.66),rgba(12,11,10,.5) 40%,rgba(12,11,10,.7))}
`,
  html: (c) => {
    // Zona muy clara → se OSCURECE más; nunca se invierte el texto a negro.
    const velado = (c.velo || 0) > 0.45 || c.modo === 'banda';
    let inner = '';
    if (c.kicker) inner += `<div class="eyebrow">${esc(c.kicker)}</div>`;
    if (c.title) inner += `<div class="tit${c.smTitle ? ' sm' : ''}">${conCursiva(c.title)}</div>`;
    if (c.items) inner += `<div class="lista">${c.items.map((i) => `<div class="li">${esc(i)}</div>`).join('')}</div>`;
    const bajada = c.plainBody || c.support;
    if (bajada) inner += `<div class="bajada">${esc(bajada.replace(/\*\*/g, ''))}</div>`;
    return `<div class="slide${velado ? ' velado' : ''}${c.idx === 0 ? ' portada-1' : ''}">
      <div class="tono"></div>
      <div class="velo-arriba" style="--va-top:${c.veloMarcoTop}"></div>
      <div class="velo-abajo" style="--va-bot:${c.veloMarcoBot}"></div>
      <div class="marco arriba m-claro">
        <span>${esc(c.marca)}</span><span>${folio(c.idx, c.total)}</span>
      </div>
      ${c.hasText ? `<div class="bloque" style="top:${c.blockTop}${c.miniCSS}">${inner}</div>` : ''}
      <div class="flecha${c.isLast ? ' abajo' : ''}"><i></i></div>
      <div class="marco abajo m-claro">
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
  descripcion: 'Tarjeta oscura sobre la foto. Se lee siempre, con cualquier imagen.',
  sobreFoto: false,
  fuentes: ['Cormorant', 'Outfit'],
  acento: 'cursiva',
  css: () => `${RESET}${MARCO}${VELOS_MARCO}
.slide{font-family:Cormorant,Georgia,serif}
.tono{position:absolute;inset:0;background:linear-gradient(rgba(10,10,12,.42),rgba(10,10,12,.26) 42%,rgba(10,10,12,.46))}
/* Tarjeta OSCURA translúcida: la foto se sigue viendo a través, pero el texto
   blanco tiene su propio piso de contraste. Nada de papel blanco — la marca
   pidió sombra negra con letra blanca. */
.papel{position:absolute;left:126px;right:126px;background:rgba(13,13,15,.72);color:#F6F5F3;
  padding:84px 70px 74px;border:1px solid rgba(255,255,255,.30);
  box-shadow:0 30px 80px rgba(0,0,0,.45);
  display:flex;flex-direction:column;align-items:center;text-align:center}
.cinta{position:absolute;top:-1px;left:50%;transform:translateX(-50%);
  width:150px;height:3px;background:rgba(255,255,255,.55)}
.num{font-family:Outfit,sans-serif;font-size:32px;letter-spacing:.26em;color:rgba(246,245,243,.58);margin-bottom:26px}
.tit{font-size:88px;font-weight:400;line-height:1.06;letter-spacing:-.004em;text-wrap:balance}
.tit i{font-style:italic}
.tit.sm{font-size:72px}
.bajada{font-family:Outfit,sans-serif;font-size:46px;line-height:1.42;color:rgba(246,245,243,.8);margin-top:34px;max-width:88%}
.lista{margin-top:38px;display:flex;flex-direction:column;gap:20px;width:100%}
.li{font-family:Outfit,sans-serif;font-size:46px;font-weight:400;line-height:1.36;padding-bottom:18px;border-bottom:2px solid rgba(255,255,255,.28)}
.li:last-child{border-bottom:0;padding-bottom:0}
.rubrica{position:absolute;left:0;right:0;bottom:120px;text-align:center;font-family:Outfit,sans-serif;
  font-size:32px;letter-spacing:.18em;text-transform:uppercase;color:rgba(255,255,255,.92);
  text-shadow:0 0 9px rgba(0,0,0,.85),0 2px 6px rgba(0,0,0,.5)}
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
      <div class="velo-arriba" style="--va-top:${c.veloMarcoTop}"></div>
      <div class="velo-abajo" style="--va-bot:${c.veloMarcoBot}"></div>
      <div class="marco arriba m-claro"><span>${esc(c.marca)}</span><span>${folio(c.idx, c.total)}</span></div>
      <div class="papel" style="top:${c.papelTop}px">${inner}</div>
      <div class="rubrica">${esc(c.handle)}</div>
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
  css: (c) => `${RESET}${MARCO}${VELOS_MARCO}
/* OJO: .slide NO lleva fondo. Esta capa se pinta ENCIMA de la foto del canvas;
   un color sólido aquí tapaba la foto entera y el slide salía liso. */
.slide{font-family:Cormorant,Georgia,serif}
.panel{position:absolute;left:0;right:0;bottom:0;height:44%;background:${c.tinta};color:#F3F0EA;
  padding:74px 104px 96px;display:flex;flex-direction:column}
.eyebrow{font-family:Outfit,sans-serif;font-size:34px;letter-spacing:.24em;text-transform:uppercase;
  color:rgba(243,240,234,.62);padding-bottom:20px;margin-bottom:26px;border-bottom:2px solid rgba(243,240,234,.30);text-shadow:0 0 9px rgba(0,0,0,.85),0 2px 6px rgba(0,0,0,.5)}
.tit{font-size:96px;font-weight:400;line-height:1.06;letter-spacing:-.004em;text-wrap:balance}
.tit i{font-style:italic}
.tit.sm{font-size:78px}
.bajada{font-family:Outfit,sans-serif;font-size:46px;line-height:1.42;color:rgba(243,240,234,.8);margin-top:26px}
.lista{margin-top:26px;display:flex;flex-direction:column;gap:14px}
.li{font-family:Outfit,sans-serif;font-size:46px;line-height:1.5;color:rgba(243,240,234,.84);padding-left:30px;position:relative}
.li::before{content:'';position:absolute;left:0;top:15px;width:14px;height:1px;background:rgba(243,240,234,.6)}
.pieficha{position:absolute;left:104px;right:104px;bottom:44px;display:flex;justify-content:space-between;
  font-family:Outfit,sans-serif;font-size:30px;letter-spacing:.2em;text-transform:uppercase;color:rgba(243,240,234,.55)}
`,
  html: (c) => {
    let inner = '';
    if (c.kicker) inner += `<div class="eyebrow">${esc(c.kicker)}</div>`;
    if (c.title) inner += `<div class="tit${c.smTitle ? ' sm' : ''}">${conCursiva(c.title)}</div>`;
    if (c.items) inner += `<div class="lista">${c.items.map((i) => `<div class="li">${esc(i)}</div>`).join('')}</div>`;
    const bajada = c.plainBody || c.support;
    if (bajada) inner += `<div class="bajada">${conCursiva(bajada)}</div>`;
    return `<div class="slide">
      <div class="marco arriba m-claro"><span>${esc(c.marca)}</span><span>${folio(c.idx, c.total)}</span></div>
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
.bloque{position:absolute;left:104px;right:104px;bottom:280px;text-align:center;
  display:flex;flex-direction:column;align-items:center}
.tit{font-size:78px;font-weight:300;line-height:1.12;letter-spacing:-.012em;text-transform:lowercase;
  text-shadow:0 0 9px rgba(0,0,0,.85),0 2px 6px rgba(0,0,0,.5);text-wrap:balance}
/* 1.231em, no 1.06. Cormorant tiene el ojo mucho más chico que Outfit (.386
   contra .475): a 1.06em la palabra en CURSIVA —que es EL ACENTO— se leía un
   14% más chica que el texto que venía a acentuar. El factor iguala la altura
   de la x, que es lo que el ojo compara, no el font-size. */
.tit i{font-family:Cormorant,Georgia,serif;font-style:italic;font-weight:400;font-size:1.231em}
.tit.sm{font-size:64px}
.detalle{font-size:34px;font-weight:400;letter-spacing:.19em;line-height:1.75;text-transform:uppercase;
  color:rgba(255,255,255,.86);margin-top:30px;max-width:78%;text-shadow:0 0 9px rgba(0,0,0,.85),0 2px 6px rgba(0,0,0,.5)}
.lista{margin-top:34px;display:flex;flex-direction:column;gap:16px}
.li{font-size:34px;letter-spacing:.13em;text-transform:uppercase;color:rgba(255,255,255,.9);
  text-shadow:0 0 9px rgba(0,0,0,.85),0 2px 6px rgba(0,0,0,.5)}
.firma{position:absolute;left:0;right:0;bottom:182px;text-align:center;font-size:32px;
  letter-spacing:.3em;text-transform:uppercase;color:rgba(255,255,255,.9);text-shadow:0 0 9px rgba(0,0,0,.85),0 2px 6px rgba(0,0,0,.5)}
`,
  html: (c) => {
    let inner = '';
    if (c.title) inner += `<div class="tit${c.smTitle ? ' sm' : ''}">${conCursiva(c.title)}</div>`;
    if (c.items) inner += `<div class="lista">${c.items.map((i) => `<div class="li">${esc(i)}</div>`).join('')}</div>`;
    const det = [c.kicker, c.plainBody || c.support].filter(Boolean).join(' · ');
    if (det) inner += `<div class="detalle">${esc(det.replace(/\*\*/g, ''))}</div>`;
    return `<div class="slide">
      <div class="tono"></div>
      ${c.hasText ? `<div class="bloque">${inner}</div>` : ''}
      <div class="firma">${esc(c.marca || c.handle)}</div>
    </div>`;
  },
};

// ════════════════════════════════════════════════════════════════════════════
// 6. MURAL — collage CONTINUO. Aprendido de los carruseles "seamless" de
//    fotógrafos de boda: las fotos viven en un plano del ancho de todo el
//    carrusel, así que las del borde se completan al deslizar. El efecto es
//    "álbum desplegado" y es imposible de lograr resolviendo slide por slide.
//    Aquí el texto es mínimo a propósito: el trabajo es el protagonista.
// ════════════════════════════════════════════════════════════════════════════
const mural = {
  id: 'mural',
  nombre: 'Mural',
  descripcion: 'Collage continuo: las fotos siguen de un slide al otro. Para mostrar una sesión.',
  sobreFoto: false,
  fuentes: ['Cormorant', 'Outfit'],
  acento: 'cursiva',
  css: () => `${RESET}${MARCO}${VELOS_MARCO}
.slide{font-family:Cormorant,Georgia,serif}
.viñeta{position:absolute;inset:0;background:radial-gradient(ellipse at center,rgba(12,12,15,0) 45%,rgba(12,12,15,.5))}
/* El titular solo en la PORTADA: en los demás el mural manda. */
.portada{position:absolute;left:96px;right:96px;bottom:190px;text-align:left}
.tit{font-size:82px;font-weight:400;line-height:1.05;letter-spacing:-.006em;
  text-shadow:0 0 9px rgba(0,0,0,.85),0 2px 6px rgba(0,0,0,.5);text-wrap:balance}
.tit i{font-style:italic}
.tit.sm{font-size:80px}
.eyebrow{font-family:Outfit,sans-serif;font-size:34px;letter-spacing:.26em;text-transform:uppercase;
  color:rgba(255,255,255,.82);margin-bottom:22px;text-shadow:0 0 9px rgba(0,0,0,.85),0 2px 6px rgba(0,0,0,.5)}
.bajada{font-family:Outfit,sans-serif;font-size:46px;line-height:1.6;color:rgba(255,255,255,.86);
  margin-top:22px;max-width:74%;text-shadow:0 0 9px rgba(0,0,0,.85),0 2px 6px rgba(0,0,0,.5)}
/* El cierre puede caer sobre su foto: cojín local con pluma ancha (forma 3
   de la ley de la sombra) para que el CTA se lea sobre cualquier claro. */
.portada--cierre{background:radial-gradient(ellipse 92% 120% at 50% 62%,rgba(12,12,15,.66),rgba(12,12,15,.42) 55%,rgba(12,12,15,0) 82%);
  padding:64px 72px;left:24px;right:24px}
/* Firma vertical en el canto: el detalle que delata el formato editorial. */
.canto{position:absolute;right:34px;top:50%;transform:translateY(-50%) rotate(180deg);
  writing-mode:vertical-rl;font-family:Outfit,sans-serif;font-size:30px;letter-spacing:.34em;
  text-transform:uppercase;color:rgba(255,255,255,.6)}
`,
  html: (c) => {
    // Mural es COLLAGE: los interiores son foto pura (el mural manda) y el
    // texto vive en los EXTREMOS — portada con el hook y cierre con el CTA
    // (la regla de serie extremos=A). Antes el cierre salía mudo (sin CTA) y
    // los textos de la pieza morían en silencio; ahora el cierre habla.
    const esPortada = c.idx === 0;
    const esCierre = c.isLast && c.total > 1;
    let inner = '';
    if (esPortada || esCierre) {
      if (c.kicker) inner += `<div class="eyebrow">${esc(c.kicker)}</div>`;
      if (c.title) inner += `<div class="tit${c.smTitle ? ' sm' : ''}">${conCursiva(c.title)}</div>`;
      const b = c.plainBody || (esPortada ? c.support : '');
      if (b) inner += `<div class="bajada">${esc(b.replace(/\*\*/g, ''))}</div>`;
    }
    return `<div class="slide">
      <div class="viñeta"></div>
      <div class="velo-arriba" style="--va-top:${c.veloMarcoTop}"></div>
      <div class="velo-abajo" style="--va-bot:${c.veloMarcoBot}"></div>
      <div class="marco arriba m-claro"><span>${esc(c.marca)}</span><span>${folio(c.idx, c.total)}</span></div>
      ${inner ? `<div class="portada${esCierre ? ' portada--cierre' : ''}">${inner}</div>` : ''}
      <div class="canto">${esc(c.handle)}</div>
      ${c.isLast ? `<div class="marco abajo m-claro"><span>${c.fecha}</span><span>${esc(c.support || '')}</span></div>` : ''}
    </div>`;
  },
};

// ════════════════════════════════════════════════════════════════════════════
// 7. PANORÁMICA — el formato "seamless": UNA imagen continua repartida a lo
//    largo de todos los slides. Al deslizar, la foto no cambia: SIGUE.
//
//    Es el formato con mejor rendimiento medido del carrusel (el doble de
//    deslizamientos completos que uno de slides sueltos) y sigue siendo raro
//    en Instagram porque hacerlo a mano en Canva es un dolor. Para un estudio
//    de fotografía es el formato natural: la foto manda y el texto se aparta.
//
//    REGLA PROPIA DE ESTE FORMATO: el texto vive en un carril central, lejos
//    de los bordes. Un titular pegado al borde se PARTE en la costura entre
//    slides y se lee a la mitad. Por eso los márgenes aquí son mucho más
//    anchos que en el resto de plantillas, y el titular es más contenido.
// ════════════════════════════════════════════════════════════════════════════
const panorama = {
  id: 'panorama',
  nombre: 'Panorámica',
  descripcion: 'Una sola imagen que fluye por todos los slides. La que más hace deslizar.',
  sobreFoto: true,
  fuentes: ['Cormorant', 'Outfit'],
  acento: 'cursiva',
  css: () => `${RESET}${MARCO}${VELOS_MARCO}
.slide{font-family:Cormorant,Georgia,serif}
/* Oscurecimiento parejo en TODA la tira: si cada slide llevara su propio
   degradado, al deslizar se verían escalones de luz justo en las costuras y se
   rompería la ilusión de imagen única. Plano y constante. */
.tono{position:absolute;inset:0;background:rgba(12,12,15,.34)}
.slide.velado .tono{background:rgba(12,12,15,.52)}
/* CARRIL CENTRAL: 168px de aire a cada lado. Es el margen que evita que una
   palabra quede cortada por la costura del slide. */
.bloque{position:absolute;left:168px;right:168px;text-align:center;
  display:flex;flex-direction:column;align-items:center}
.eyebrow{font-family:Outfit,sans-serif;font-size:32px;letter-spacing:.26em;text-transform:uppercase;
  color:rgba(255,255,255,.88);margin-bottom:26px;text-shadow:0 0 9px rgba(0,0,0,.85),0 2px 6px rgba(0,0,0,.5)}
.tit{font-size:92px;font-weight:400;line-height:1.04;letter-spacing:-.004em;text-wrap:balance;
  text-shadow:0 0 9px rgba(0,0,0,.85),0 2px 6px rgba(0,0,0,.5)}
.tit i{font-style:italic}
.tit.sm{font-size:76px}
/* La portada crece: se ve también en la cuadrícula del perfil (~130pt). */
.slide.portada-1 .tit{font-size:134px;line-height:.99}
.slide.portada-1 .tit.sm{font-size:112px}
.bajada{font-family:Outfit,sans-serif;font-size:40px;font-weight:400;line-height:1.5;
  color:rgba(255,255,255,.9);margin-top:32px;max-width:92%;
  text-shadow:0 0 9px rgba(0,0,0,.85),0 2px 6px rgba(0,0,0,.5)}
.lista{margin-top:40px;display:flex;flex-direction:column;gap:22px;width:100%}
.li{font-family:Outfit,sans-serif;font-size:44px;line-height:1.34;padding-bottom:18px;
  border-bottom:2px solid rgba(255,255,255,.30);
  text-shadow:0 0 9px rgba(0,0,0,.85),0 2px 6px rgba(0,0,0,.5)}
.li:last-child{border-bottom:0}
/* Filete de continuidad: una línea finísima que cruza el slide de lado a lado
   a la misma altura en todos. Al deslizar NO se corta — es la pista visual de
   que esto es una sola pieza y no cinco. */
.hilo{position:absolute;left:0;right:0;top:50%;height:2px;background:rgba(255,255,255,.26)}
.slide.con-texto .hilo{display:none}
/* PIE CORRIDO — el detalle que separa un seamless de verdad de cinco slides
   pegados. La micro-tipografía NO se repite igual en cada slide: es una sola
   línea que atraviesa la tira entera y se corta en las costuras. Al deslizar,
   la palabra que quedó partida se completa — y eso es lo que le dice al ojo
   que esto es una pieza, no cinco. (Visto en las plantillas seamless de
   fotógrafo: el pie corre y se corta; el marco repetido delata el montaje.) */
.pie-corrido{position:absolute;bottom:170px;left:0;display:flex;align-items:center;
  gap:70px;white-space:nowrap;font-family:Outfit,sans-serif;font-size:30px;font-weight:500;
  letter-spacing:.16em;text-transform:uppercase;color:rgba(255,255,255,.9);
  text-shadow:0 0 9px rgba(0,0,0,.85),0 2px 6px rgba(0,0,0,.5)}
.pie-corrido span{flex:none}
.pie-corrido .sep{opacity:.5}
/* La flecha SOLO en la portada: en los interiores estorbaría la continuidad. */
.flecha{position:absolute;left:50%;transform:translateX(-50%);bottom:230px;width:74px;height:74px;
  border:1.6px solid rgba(255,255,255,.82);border-radius:50%}
.flecha i{position:absolute;top:50%;left:50%;width:28px;height:1.6px;background:rgba(255,255,255,.88);transform:translate(-50%,-50%)}
.flecha i::after{content:'';position:absolute;right:0;top:50%;width:11px;height:11px;
  border-top:1.6px solid rgba(255,255,255,.88);border-right:1.6px solid rgba(255,255,255,.88);
  transform:translate(1px,-50%) rotate(45deg)}
`,
  html: (c) => {
    const velado = (c.velo || 0) > 0.45 || c.modo === 'banda';
    let inner = '';
    if (c.kicker) inner += `<div class="eyebrow">${esc(c.kicker)}</div>`;
    if (c.title) inner += `<div class="tit${c.smTitle ? ' sm' : ''}">${conCursiva(c.title)}</div>`;
    if (c.items) inner += `<div class="lista">${c.items.map((i) => `<div class="li">${esc(i)}</div>`).join('')}</div>`;
    const bajada = c.plainBody || c.support;
    if (bajada) inner += `<div class="bajada">${esc(bajada.replace(/\*\*/g, ''))}</div>`;
    const hay = c.hasText && inner;
    return `<div class="slide${velado ? ' velado' : ''}${c.idx === 0 ? ' portada-1' : ''}${hay ? ' con-texto' : ''}">
      <div class="tono"></div>
      <div class="hilo"></div>
      <div class="velo-arriba" style="--va-top:${c.veloMarcoTop}"></div>
      <div class="velo-abajo" style="--va-bot:${c.veloMarcoBot}"></div>
      <div class="marco arriba m-claro"><span>${esc(c.marca)}</span><span>${folio(c.idx, c.total)}</span></div>
      ${hay ? `<div class="bloque" style="top:${c.blockTop}${c.miniCSS}">${inner}</div>` : ''}
      ${c.idx === 0 ? '<div class="flecha"><i></i></div>' : ''}
      ${pieCorrido(c)}
    </div>`;
  },
};

// Arma la línea de micro-tipografía que atraviesa la tira completa. Cada slide
// pinta la MISMA línea, solo desplazada: por eso al deslizar se completa lo que
// quedó cortado, en vez de repetirse un pie idéntico cinco veces.
function pieCorrido(c) {
  const piezas = [c.marca, c.handle, c.fecha].map((x) => String(x || '').trim()).filter(Boolean);
  if (!piezas.length) return '';
  // Repeticiones de sobra para cubrir W×total: cada vuelta mide ~1000px y la
  // tira más larga (10 slides) son 10800. Sobrar no cuesta — el slide recorta.
  const vueltas = Math.max(4, c.total * 2 + 2);
  let linea = '';
  for (let v = 0; v < vueltas; v++) {
    for (const p of piezas) linea += `<span>${esc(p)}</span><span class="sep">·</span>`;
  }
  return `<div class="pie-corrido" style="transform:translateX(-${c.idx * 1080}px)">${linea}</div>`;
}

// ════════════════════════════════════════════════════════════════════════════
// 8. PAPEL — la primera plantilla de FONDO CLARO, calcada de la referencia que
//    eligió Vianey ("4 Types of Content for Business"): hoja color hueso, la
//    foto metida en un recuadro con aire alrededor —no a sangre— y el titular
//    debajo en serif de imprenta, mayúsculas, con la primera línea chica y el
//    resto grande.
//
//    Por qué existe: el resto del catálogo es oscuro y vive de la foto. Las
//    marcas que NO son de fotografía (dental, RH, café, consultoría) no tienen
//    banco de imágenes para llenar cinco slides a sangre; este formato aguanta
//    con una sola foto decente porque el aire hace la mitad del trabajo.
//
//    OJO: aquí el fondo y el recuadro los pinta el CANVAS (campos `fondo` y
//    `cajaFoto`), no el CSS. Poner `background` en `.slide` taparía la foto —
//    es la trampa que ya costó dos plantillas.
// ════════════════════════════════════════════════════════════════════════════
const PAPEL_TINTA = '#17150F';
const papel = {
  id: 'papel',
  nombre: 'Papel',
  descripcion: 'Hoja clara, foto enmarcada con aire y titular de imprenta. Para marcas sin muchas fotos.',
  sobreFoto: false,
  fuentes: ['Cormorant', 'Outfit'],
  acento: 'cursiva',
  fondo: '#F2EEE7',                                   // hueso cálido (lo pinta el canvas)
  // El recuadro de la foto. Termina en y=652 y el bloque de texto (anclado
  // abajo) arranca hacia y=727: ~75px de colchón, que al 36% del feed son 27px
  // reales. Con 534 el aire bajaba a 12px reales y —ya con el cerco visible—
  // el antetítulo se leía como una etiqueta pegada al marco de la foto.
  cajaFoto: { x: 96, y: 172, w: 888, h: 480 },
  css: () => `${RESET}
.slide{font-family:Cormorant,Georgia,serif;color:${PAPEL_TINTA}}
/* Filete finísimo sobre el borde del recuadro: separa la foto del papel sin
   dibujar un marco pesado. */
.cerco{position:absolute;left:96px;top:188px;width:888px;height:590px;
  border:1px solid rgba(23,21,15,.32);pointer-events:none}
.cab{position:absolute;top:92px;left:96px;right:96px;display:flex;
  justify-content:flex-start;align-items:baseline}
.cab .marca{font-size:44px;font-weight:500;letter-spacing:-.005em}
/* EL BLOQUE DE TEXTO SE ANCLA ABAJO, no arriba. Anclado arriba crecía hacia el
   pie y la bajada acababa encima de la fecha, con la regla cruzándola (visto en
   la primera prueba). Anclado abajo crece hacia el aire que hay bajo la foto,
   que es justo donde sobra sitio. */
.texto{position:absolute;left:104px;right:104px;bottom:266px;text-align:center}
.tit .l1{font-family:Outfit,sans-serif;font-size:34px;font-weight:500;
  letter-spacing:.2em;text-transform:uppercase;color:rgba(23,21,15,.62);margin-bottom:20px}
.tit .l2{font-size:104px;font-weight:500;line-height:1.02;letter-spacing:.005em;
  text-transform:uppercase;text-wrap:balance}
.tit .l2 i{font-style:italic;text-transform:none;font-weight:400}
.tit.sm .l2{font-size:82px}
/* 40px es el piso de Outfit en minúsculas: el feed se ve al 36% y por debajo de
   eso quedan menos de 15px reales. A 34px se veía diminuta. */
.bajada{margin-top:28px;font-family:Outfit,sans-serif;font-size:40px;line-height:1.45;
  color:rgba(23,21,15,.66)}
.lista{position:absolute;left:150px;right:150px;bottom:266px;display:flex;
  flex-direction:column;gap:22px}
.li{font-family:Outfit,sans-serif;font-size:42px;line-height:1.34;padding-bottom:18px;
  border-bottom:2px solid rgba(23,21,15,.30)}
.li:last-child{border-bottom:0}
/* La firma va abajo del todo, por encima de los ~160px que ocupa la interfaz
   de Instagram. El folio a la IZQUIERDA: arriba a la derecha vive su píldora
   "1/5" y competir con ella se ve amateur. */
.pie{position:absolute;left:96px;right:96px;bottom:178px;display:flex;
  justify-content:space-between;align-items:center;font-family:Outfit,sans-serif;
  font-size:26px;font-weight:500;letter-spacing:.2em;text-transform:uppercase;
  color:rgba(23,21,15,.46)}
.regla{position:absolute;left:96px;right:96px;bottom:232px;height:2px;background:rgba(23,21,15,.30)}
`,
  html: (c) => {
    // El título se parte en dos voces: lo que va antes del primer salto lógico
    // queda de antetítulo chico y el resto manda. Si no hay kicker, se usa la
    // primera palabra fuerte como línea 1.
    const limpio = String(c.title || '');
    let l1 = esc(c.kicker || '');
    let l2 = conCursiva(limpio);
    if (!l1 && limpio.includes('|')) {
      const [a, ...b] = limpio.split('|');
      l1 = esc(a.trim());
      l2 = conCursiva(b.join('|').trim());
    }
    const bajada = c.plainBody || c.support;
    const hayLista = c.items && c.items.length;
    return `<div class="slide">
      <div class="cerco"></div>
      <div class="cab"><span class="marca">${esc(c.marca)}</span></div>
      ${hayLista
        ? `<div class="lista">${c.items.map((i) => `<div class="li">${esc(i)}</div>`).join('')}</div>`
        : (l1 || l2 || bajada) ? `<div class="texto">
            ${(l1 || l2) ? `<div class="tit${c.smTitle ? ' sm' : ''}">
              ${l1 ? `<div class="l1">${l1}</div>` : ''}
              ${l2 ? `<div class="l2">${l2}</div>` : ''}
            </div>` : ''}
            ${bajada ? `<div class="bajada">${esc(String(bajada).replace(/\*\*/g, ''))}</div>` : ''}
          </div>` : ''}
      <div class="regla"></div>
      <div class="pie">
        <span>${esc(c.handle) || folio(c.idx, c.total)}</span>
        <span>${c.fecha}</span>
      </div>
    </div>`;
  },
};

// ════════════════════════════════════════════════════════════════════════════
// 9. RÓTULO — CERO fotografías. La plantilla para las marcas sin banco de
//    imágenes (dental, RH, terapia): no usa ni una foto en toda la tira, así
//    que nunca hay una imagen de stock fea que justificar.
//
//    Sale del estudio de 88 plantillas reales (2026-08): once del corpus
//    resuelven así y ninguna se ve pobre. Las reglas de serie, medidas al
//    píxel de las referencias:
//      · margen de contenido CLAVADO en x=140, medida máxima 800px
//      · portada e interiores se distinguen por el NUMERAL FANTASMA (420px a
//        contraste 1.1:1 — es textura, no información) que solo existe en los
//        interiores, y el titular lo PISA
//      · el riel inferior cambia de carga: píldora "DESLIZA →" en portada,
//        contador + filete en interiores, firma en el cierre
//      · el cierre repite las dos voces de la portada (bookend), centrado
//      · acento en dosis mínimas; NUNCA un fondo de color
//
//    NOTA de marca: aquí hay letra oscura sobre papel — la regla "texto blanco
//    sobre sombra negra" aplica cuando hay FOTO debajo que velar; sobre papel
//    el contraste es 12.8:1, más del doble de lo que cualquier sombra logra.
//    (Misma decisión que Vianey ya aprobó al elegir la referencia de Papel.)
// ════════════════════════════════════════════════════════════════════════════
const ROT = {
  papel: '#F1EEE8', tinta: '#1A1714', cuerpo: '#2C2722',
  gris: '#6A625A', fantasma: '#E4DFD6', filete: '#C9C1B6', acento: '#B4471F',
};
const rotulo = {
  id: 'rotulo',
  nombre: 'Rótulo',
  descripcion: 'Sin fotos: papel, tipografía y un acento. Para marcas sin banco de imágenes.',
  sobreFoto: false,
  sinFoto: true,                      // el generador permite slides SIN imagen
  fuentes: ['Cormorant', 'Outfit'],
  acento: 'cursiva',
  fondo: ROT.papel,                   // lo pinta el canvas
  css: () => `${RESET}
.slide{font-family:Cormorant,Georgia,serif;color:${ROT.tinta}}
/* Grano de papel sin imagen de textura: tres radiales casi invisibles. */
.grano{position:absolute;inset:0;pointer-events:none;background:
  radial-gradient(circle at 20% 30%, rgba(0,0,0,.03), transparent 45%),
  radial-gradient(circle at 78% 12%, rgba(0,0,0,.025), transparent 40%),
  radial-gradient(circle at 55% 82%, rgba(0,0,0,.03), transparent 48%)}
/* Riel superior: marca a la izquierda, etiqueta al acento a la derecha. */
.riel-arriba{position:absolute;top:92px;left:140px;right:140px;display:flex;
  justify-content:space-between;align-items:baseline;font-family:Outfit,sans-serif;
  font-size:26px;font-weight:600;letter-spacing:.22em;text-transform:uppercase}
.riel-arriba .etq{color:${ROT.acento}}
/* Numeral fantasma: SOLO interiores. 420px a 1.1:1 — textura, no información. */
.fantasma{position:absolute;top:250px;left:132px;font-weight:600;font-size:420px;
  line-height:1;color:${ROT.fantasma};letter-spacing:-.02em}
/* Titular de PORTADA: dos voces, 3 renglones máx, bloque y=392-707. */
.tit-portada{position:absolute;left:140px;right:140px;top:392px;
  font-size:112px;line-height:105px;font-weight:600;text-wrap:balance}
.tit-portada i{font-style:italic;font-weight:500;color:${ROT.acento}}
.tit-portada.sm{font-size:94px;line-height:90px}
.bajada-portada{position:absolute;left:140px;right:140px;top:790px;
  font-family:Outfit,sans-serif;font-size:30px;font-weight:500;
  letter-spacing:.16em;text-transform:uppercase;color:${ROT.gris};line-height:1.35}
/* Titular INTERIOR: una voz, pisa al numeral. */
.tit-interior{position:absolute;left:140px;right:140px;top:286px;
  font-size:88px;line-height:1.04;font-weight:600;text-wrap:balance}
.tit-interior i{font-style:italic;color:${ROT.acento}}
.tit-interior.sm{font-size:74px}
.cuerpo{position:absolute;left:140px;top:540px;width:760px;
  font-family:Outfit,sans-serif;font-size:40px;font-weight:400;line-height:57px;color:${ROT.cuerpo}}
.lista{position:absolute;left:140px;top:540px;width:760px;display:flex;flex-direction:column;gap:34px}
.li{font-family:Outfit,sans-serif;font-size:40px;line-height:1.4;color:${ROT.cuerpo};
  padding-left:52px;position:relative}
.li::before{content:'';position:absolute;left:0;top:12px;width:18px;height:18px;
  border:2px solid ${ROT.acento}}
/* Titular de CIERRE: dos voces como la portada, 96px y CENTRADO. */
.tit-cierre{position:absolute;left:120px;right:120px;top:400px;text-align:center;
  font-size:96px;line-height:1.05;font-weight:600;text-wrap:balance}
.tit-cierre i{font-style:italic;font-weight:500;color:${ROT.acento}}
.tit-cierre.sm{font-size:80px}
.bajada-cierre{position:absolute;left:150px;right:150px;top:730px;text-align:center;
  font-family:Outfit,sans-serif;font-size:40px;font-weight:500;line-height:1.5;color:${ROT.cuerpo}}
/* Riel inferior (y≈1112-1188, por encima de la franja de interfaz). */
.riel-abajo{position:absolute;left:140px;right:140px;top:1112px;height:76px;
  display:flex;align-items:center;font-family:Outfit,sans-serif}
.pildora{display:inline-flex;align-items:center;height:76px;padding:0 36px;
  border:2px solid ${ROT.acento};border-radius:999px;
  font-size:28px;font-weight:600;letter-spacing:.08em;color:${ROT.acento}}
.contador{font-size:28px;font-weight:600;color:${ROT.gris};letter-spacing:.08em;flex:none}
.filete-riel{height:2px;background:${ROT.filete};flex:1;margin-left:34px}
.firma{font-size:30px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;
  color:${ROT.tinta};line-height:1.4}
`,
  html: (c) => {
    const esPortada = c.idx === 0;
    const esCierre = c.isLast && c.total > 1;
    const nn = String(c.idx + 1).padStart(2, '0');
    const etiqueta = esPortada ? c.fecha : esCierre ? esc(c.handle) : (esc(c.kicker) || esc(c.handle));

    let centro = '';
    if (esPortada) {
      if (c.title) centro += `<div class="tit-portada${c.smTitle ? ' sm' : ''}">${conCursiva(c.title)}</div>`;
      const b = c.plainBody || c.support;
      if (b) centro += `<div class="bajada-portada">${esc(String(b).replace(/\*\*/g, ''))}</div>`;
    } else if (esCierre) {
      if (c.title) centro += `<div class="tit-cierre${c.smTitle ? ' sm' : ''}">${conCursiva(c.title)}</div>`;
      const b = c.support || c.plainBody;
      if (b) centro += `<div class="bajada-cierre">${esc(String(b).replace(/\*\*/g, ''))}</div>`;
    } else {
      centro += `<div class="fantasma">${nn}</div>`;
      if (c.title) centro += `<div class="tit-interior${c.smTitle ? ' sm' : ''}">${conCursiva(c.title)}</div>`;
      if (c.items) centro += `<div class="lista">${c.items.map((i) => `<div class="li">${esc(i)}</div>`).join('')}</div>`;
      else if (c.plainBody) centro += `<div class="cuerpo">${esc(String(c.plainBody).replace(/\*\*/g, ''))}</div>`;
    }

    const riel = esPortada
      ? `<div class="pildora">DESLIZA&#160;&#8594;</div>`
      : esCierre
      ? `<div class="firma">${esc(c.marca)}&#160;&#160;&#183;&#160;&#160;${esc(c.handle)}</div>`
      : `<span class="contador">${nn}&#160;/&#160;${String(c.total).padStart(2, '0')}</span><span class="filete-riel"></span>`;

    return `<div class="slide">
      <div class="grano"></div>
      <div class="riel-arriba"><span>${esc(c.marca)}</span><span class="etq">${etiqueta}</span></div>
      ${centro}
      <div class="riel-abajo">${riel}</div>
    </div>`;
  },
};

export const PLANTILLAS = [editorial, revista, nota, ficha, suave, mural, panorama, papel, rotulo];
export const PLANTILLA_POR_DEFECTO = 'revista';
export function plantillaPorId(id) {
  return PLANTILLAS.find((p) => p.id === id) || PLANTILLAS.find((p) => p.id === PLANTILLA_POR_DEFECTO);
}
export { esc, conNegrita, conCursiva };
