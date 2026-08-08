// ============================================================================
// IVAE Marketing — Vista "Métricas" (panel de Instagram por periodo).
//
// REDISEÑO 2026-07-27. Hereda del reporte mensual descargable
// (functions/api/marketing/_enterprise.js) su única regla rectora:
//   · NINGUNA CIFRA VIAJA SOLA  → kpi() no renderiza sin línea de lectura.
//   · LA FRASE VA ANTES QUE LA GRÁFICA.
//   · NUNCA SE DIBUJA UN 0 ni un dato ausente: se dice en texto.
// …pero la estructura es de PANTALLA, no de papel: una sola cifra héroe,
// "Tu cuenta hoy" separado del periodo (esas cifras no se mueven con el
// selector) y las gráficas con jerarquía por rango, no por gradiente.
//
// Datos: GET /ig/metrics-range?client_id&from&to. No se inventa nada que la
// API no devuelva (sin comparativas, sin flechas, sin sparklines: no hay
// histórico de seguidores — ver el reporte final de esta tanda).
// ============================================================================
import { api, el, clear, isClientRole } from '../api.js?v=202608080038';
import { icon } from '../shell/icons.js?v=202608080038';
import { T, isEN } from '../shell/i18n.js?v=202608080038';

const VIEW_ID = 'metricas';

let ctx = null;
let rootEl = null;
let mounted = false;
let unsubs = [];
let themeObs = null;

let period = '30d';
let customFrom = '';
let customTo = '';
let loading = false;
let lastRes = null;
let lastKey = '';        // clientId|from|to del último fetch (evita refetch igual)

// Solo Semana y Mes: son los periodos donde Instagram entrega datos completos
// y confiables. Periodos largos (3/6/12 meses) y personalizado se quitaron
// porque Instagram no da estadisticas tan atras (datos parciales/vacios).
const PERIODS = [
  { id: '7d', label: 'Semana', en: 'Week', days: 7 },
  { id: '30d', label: 'Mes', en: 'Month', days: 30 },
  // 90 días: los insights POR PUBLICACIÓN sí existen para posts viejos (lo que
  // Instagram no da hacia atrás son las series de la CUENTA). Una marca que
  // publica poco veía "Mes" vacío y parecía que la app no traía nada — que es
  // justo lo que el revisor de Meta interpretó como "no se obtiene en vivo".
  { id: '90d', label: '3 meses', en: '3 months', days: 90 },
];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ── Números ──────────────────────────────────────────────────────────────────
// El locale sigue al idioma: forzar es-MX en inglés dejaba "1.204" donde el
// revisor de Meta espera "1,204".
function nf(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  try { return v.toLocaleString(isEN ? 'en-US' : 'es-MX'); } catch { return String(Math.round(v)); }
}
// Nunca un 0 donde falta el dato: null ⇒ "—".
const fmtN = (n) => (n == null ? '—' : nf(n));
// Abrevia arriba de 5 dígitos para que la cifra no desborde en 390px
// (portado de _enterprise.js). El separador decimal es el PUNTO: en México la
// coma separa miles, así que "1,3 M" se leería como 13.
function nfBig(n) {
  if (n == null) return '—';
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  if (v >= 999500) {
    const m = v / 1e6;
    return (m >= 10 ? String(Math.round(m)) : m.toFixed(1).replace(/\.0$/, '')) + ' M';
  }
  if (v >= 1e5) return String(Math.round(v / 1e3)) + ' K';
  return nf(v);
}
const pctOf = (v, total) => (total ? Math.round((v / total) * 100) : 0);
// Reparto que SIEMPRE suma 100 (método del resto mayor). Redondear cada
// categoría por su cuenta dejaba leyendas de 99% y 101% debajo de un pie que
// promete "reparto de tus seguidores".
function pctShares(values, total) {
  if (!total) return values.map(() => 0);
  const raw = values.map((v) => (v / total) * 100);
  const out = raw.map((x) => Math.floor(x));
  let rest = 100 - out.reduce((s, x) => s + x, 0);
  const order = raw.map((x, i) => [x - Math.floor(x), i]).sort((a, b) => b[0] - a[0]);
  for (let k = 0; k < order.length && rest > 0; k += 1, rest -= 1) out[order[k][1]] += 1;
  return out;
}
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (m) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));

const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayISO = () => iso(new Date());
function daysAgoISO(n) { const d = new Date(); d.setDate(d.getDate() - (n - 1)); return iso(d); }
function monthAbbr(m) { return (isEN ? MONTHS_EN : MESES)[(m || 1) - 1] || ''; }
function prettyDate(s) {
  const [y, m, da] = String(s).split('-').map(Number);
  return isEN ? `${monthAbbr(m)} ${da}, ${y}` : `${da} ${monthAbbr(m)} ${y}`;
}
function shortDate(ts) {
  const d = Number(String(ts || '').slice(8, 10));
  const m = Number(String(ts || '').slice(5, 7));
  if (!d || !m) return '';
  return isEN ? `${monthAbbr(m)} ${d}` : `${d} ${monthAbbr(m)}`;
}
function fmtSec(s) {
  if (s == null) return null;
  const v = Number(s);
  // 0 no es "0.0s visto prom.": es que Instagram no midió. Se calla.
  if (!Number.isFinite(v) || v <= 0) return null;
  if (v >= 60) return `${Math.floor(v / 60)}m ${Math.round(v % 60)}s`;
  return v < 1 ? `${v.toFixed(1)}s` : `${Math.round(v)}s`;
}

// ── Color: tinta y tintes derivados de --client-accent ───────────────────────
// El acento cambia por marca (magenta IVAE, azul MELISA, ámbar…), así que
// NINGÚN color se puede dar por sentado. Se porta la receta de brandTokens()
// del reporte: la tinta se acerca EN BUCLE hasta medir ≥4.5:1 contra la
// superficie REAL del tema activo. Un color-mix a porcentaje fijo reprueba AA
// con ámbar, lima y cian; y mezclar hacia --surface a ojo deja barras que en
// oscuro casi empatan con la pista.
function relLum(rgb) {
  const f = (c) => { const x = c / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
}
function contrast(a, b) {
  const l1 = relLum(a); const l2 = relLum(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}
function mixRgb(a, b, t) { return a.map((v, i) => v + (b[i] - v) * t); }
function rgb2hex(rgb) {
  return '#' + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}
// Resuelve el acento REAL pintando una sonda: --client-accent puede valer
// literalmente "var(--brand)" (topbar.js lo pone así en "Todos"), y
// getPropertyValue devolvería ese texto sin resolver.
function resolveAccent(host) {
  try {
    const probe = document.createElement('span');
    probe.style.cssText = 'position:absolute;visibility:hidden;color:var(--client-accent,var(--brand))';
    host.appendChild(probe);
    const m = getComputedStyle(probe).color.match(/(\d+(?:\.\d+)?)/g);
    probe.remove();
    if (m && m.length >= 3) return [Number(m[0]), Number(m[1]), Number(m[2])];
  } catch { /* noop */ }
  return [226, 77, 160];
}
// Acerca `base` a la tinta del tema hasta medir `target` contra la superficie.
// Un solo bucle sirve para texto (4.6:1, AA) y para RELLENOS (3:1, WCAG 1.4.11):
// si el acento de la marca ya cumple, no se toca ni un tono.
function toward(base, surf, pull, target) {
  let c = base; let n = 0;
  while (contrast(c, surf) < target && n++ < 80) c = mixRgb(c, pull, 0.05);
  return c;
}
function applyAccentTokens(host) {
  if (!host) return;
  const c = resolveAccent(host);
  const light = document.documentElement.getAttribute('data-theme') === 'light';
  // Se mide contra la superficie PEOR de cada tema, no contra la ideal. En
  // claro NO basta --surface-2 (#F1F1F6): el body lleva tres lavados radiales
  // con background-attachment:fixed (theme-light.css) y el píxel más oscuro por
  // el que pasa un número de sección al hacer scroll es (240,229,240).
  const SURF = light ? [240, 229, 240] : [22, 22, 29];
  const PULL = light ? [11, 18, 32] : [255, 255, 255];
  const rgb = c.map((v) => Math.round(v)).join(',');
  // 0.179 es el umbral real donde blanco y negro empatan sobre un color.
  host.style.setProperty('--mt-on-accent', relLum(c) > 0.179 ? '#14141b' : '#ffffff');
  host.style.setProperty('--mt-ink', rgb2hex(toward(c, SURF, PULL, 4.6)));       // texto → AA
  // RELLENOS. El bucle de arriba sólo corregía el texto: las barras iban con el
  // acento crudo y en claro un ámbar medía 1.70:1 y un lima 1.19:1 contra su
  // propia superficie (WCAG 1.4.11 pide 3:1 a los objetos gráficos).
  host.style.setProperty('--mt-fill', rgb2hex(toward(c, SURF, PULL, 3.0)));      // líder
  host.style.setProperty('--mt-a55', rgb2hex(toward(mixRgb(c, SURF, 0.45), SURF, PULL, 3.0))); // no líder
  host.style.setProperty('--mt-a10', `rgba(${rgb},.10)`);
}

function ensureCss() {
  const has = [...document.querySelectorAll('link[rel="stylesheet"]')]
    .some((l) => (l.getAttribute('href') || '').includes('/marketing/css/metricas.css'));
  if (has) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  // OJO: metricas.css es la ÚNICA hoja de vista que no está listada en
  // app.html, así que ningún bump global toca este sello. Si editas
  // metricas.css, sube este número A MANO o el cambio no llega (el SW sirve
  // cache-first todo lo que trae ?v=).
  link.href = '/marketing/css/metricas.css?v=202608080038';
  document.head.appendChild(link);
}

function currentRange() {
  if (period === 'custom' && customFrom && customTo) {
    return customFrom <= customTo ? { from: customFrom, to: customTo } : { from: customTo, to: customFrom };
  }
  const p = PERIODS.find((x) => x.id === period) || PERIODS[1];
  return { from: daysAgoISO(p.days), to: todayISO() };
}
function rangeText() {
  const { from, to } = currentRange();
  return `${prettyDate(from)} – ${prettyDate(to)}`;
}
function activeBrand() {
  const { activeClientId, clients } = ctx.store.getState();
  if (!activeClientId || activeClientId === 'todos') return null;
  return (clients || []).find((c) => c.id === activeClientId) || { id: activeClientId, name: 'Marca' };
}

// ── Carga ────────────────────────────────────────────────────────────────────
async function load(force = false) {
  if (!mounted) return;
  const brand = activeBrand();
  if (!brand) { lastRes = null; render(); return; }
  const { from, to } = currentRange();
  const key = `${brand.id}|${from}|${to}`;
  if (!force && key === lastKey && lastRes) { render(); return; }
  lastKey = key;
  loading = true; render();
  try {
    const res = await api.get(`/ig/metrics-range?client_id=${encodeURIComponent(brand.id)}&from=${from}&to=${to}`);
    // Respuesta tardía: si lastKey ya cambió (se tocó otro periodo/marca
    // durante el fetch), este resultado es de una petición vieja y no debe
    // pisar el caché ni la vista.
    if (!mounted || key !== lastKey) return;
    loading = false; lastRes = res; render();
  } catch (e) {
    if (!mounted || key !== lastKey) return;
    loading = false; lastRes = { error: e.message || 'Error al cargar' }; render();
  }
}

// ── Piezas ───────────────────────────────────────────────────────────────────
function secOpen(title, dek) {
  return el('header', { class: 'mt-sec__open' }, [
    el('div', { class: 'mt-sec__n' }),
    el('h2', { class: 'mt-sec__t', text: title }),
    dek ? el('p', { class: 'mt-sec__dek', text: dek }) : null,
  ]);
}

// CONTRATO: una cifra sin línea de lectura NO se renderiza. La regla deja de
// ser disciplina y pasa a ser la firma de la función.
function kpi(label, value, read, opts = {}) {
  if (!read) return null;
  return el('div', { class: 'mt-num' + (opts.hero ? ' mt-num--hero' : '') }, [
    el('div', { class: 'mt-num__k', text: label }),
    el('div', { class: 'mt-num__v', text: value }),
    el('p', { class: 'mt-num__read', html: read }),
  ]);
}

// Fila de barra a DOS renglones: etiqueta + % arriba, barra de pared a pared
// abajo. El ancho se escala contra el MÁXIMO (no contra el total), así que la
// fila de 70% mide 14× la de 5%; el número sigue diciendo el % del total.
function barRow(label, pct, value, max, rank) {
  return el('div', { class: 'mt-bar', dataset: { rank: String(rank) } }, [
    el('span', { class: 'mt-bar__k', text: label, title: label }),
    el('span', { class: 'mt-bar__v', text: pct + '%' }),
    el('span', { class: 'mt-bar__t' }, [
      el('i', { style: { width: Math.max((value / (max || 1)) * 100, 2).toFixed(1) + '%' } }),
    ]),
  ]);
}

// Filtro duro de ruido: fuera todo lo que redondea a 0 (un 0% no es una barra
// chiquita, es AUSENCIA) y fuera las cubetas por debajo de `minPct`, que se
// declaran en el pie. Nunca se pierde la verdad: se cambia de gráfica a texto.
function trimSmall(rows, total, minPct, minKeep) {
  const keep = []; const out = [];
  for (const r of rows) {
    const p = pctOf(r.value || 0, total);
    // Ojo: redondear a 0% NO siempre es "cero seguidores". Con una cuenta muy
    // dispersa una ciudad de 1,600 seguidores redondea a 0%, y decir que "no
    // registra seguidores" sería mentira. Se separan los dos casos.
    if (p === 0) { out.push({ ...r, pct: p, zero: !(r.value > 0), tiny: r.value > 0 }); continue; }
    if (p < minPct && rows.length - out.length > (minKeep || 3)) { out.push({ ...r, pct: p }); continue; }
    keep.push({ ...r, pct: p });
  }
  return { keep, out };
}
// "a, b y c" — la conjunción sale SIEMPRE del join, nunca cosida dentro de un
// fragmento (así fue como el podio acabó imprimiendo "Funcionó porque y …").
const joinList = (a) => (a.length > 1 ? a.slice(0, -1).join(', ') + T(' y ', ' and ') + a[a.length - 1] : (a[0] || ''));

// "Fuera de la gráfica: 18-24 (2%) y 65+ (2%). 13-17 no registra seguidores."
function foldNote(out) {
  if (!out.length) return null;
  const small = out.filter((r) => !r.zero && !r.tiny);
  const tiny = out.filter((r) => r.tiny);
  const zeros = out.filter((r) => r.zero);
  const parts = [];
  const join = joinList;
  if (small.length) {
    parts.push(T('Fuera de la gráfica: ', 'Not charted: ') + join(small.map((r) => `${r.label} (${r.pct}%)`)) + '.');
  }
  if (tiny.length) {
    parts.push(join(tiny.map((r) => r.label)) + T(
      tiny.length > 1 ? ' no llegan al 1%.' : ' no llega al 1%.',
      tiny.length > 1 ? ' are under 1%.' : ' is under 1%.',
    ));
  }
  if (zeros.length) {
    parts.push(join(zeros.map((r) => r.label)) + T(
      zeros.length > 1 ? ' no registran seguidores.' : ' no registra seguidores.',
      zeros.length > 1 ? ' have no followers on record.' : ' has no followers on record.',
    ));
  }
  return parts.length ? el('p', { class: 'mt-fold', text: parts.join(' ') }) : null;
}

// Etiqueta de columna de edad a DOS renglones ("13-" / "17"). Con los 7 rangos
// que devuelve Meta la columna mide 28-30px (a 320px y también en el escritorio
// de 3 paneles): en una línea salían todas recortadas a "13-…" y la gráfica se
// quedaba sin el único lugar donde se nombra el rango.
function ageLabel(label) {
  const s = String(label);
  const i = s.indexOf('-');
  if (i <= 0) return el('span', { class: 'mt-col__k', text: s });
  return el('span', { class: 'mt-col__k' }, [
    el('span', { text: s.slice(0, i + 1) }),
    el('span', { text: s.slice(i + 1) }),
  ]);
}

function panel(kicker, kids, cap, note) {
  return el('figure', { class: 'mt-panel' }, [
    el('figcaption', { class: 'mt-kicker', text: kicker }),
    ...kids.filter(Boolean),
    cap ? el('figcaption', { class: 'mt-chartcap', html: cap }) : null,
    note || null,
  ]);
}

// ── 02 · Tu audiencia ────────────────────────────────────────────────────────
function buildAudience(aud) {
  if (!aud || (!aud.gender && !aud.age && !aud.city)) return null;

  const gLabel = (k) => ({ M: T('Hombres', 'Men'), F: T('Mujeres', 'Women'), U: T('Sin dato', 'Unknown') }[k] || k);
  const gender = (aud.gender || []).map((x) => ({ label: gLabel(x.key), key: x.key, value: x.value || 0 }))
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value);
  // La edad es ORDINAL: se lee en su orden natural, jamás por valor.
  const age = (aud.age || []).slice().sort((a, b) => String(a.key).localeCompare(String(b.key)))
    .map((x) => ({ label: String(x.key), value: x.value || 0 }));
  // "Playa del Carmen, Quintana Roo" → "Playa del Carmen". El estado sobra y
  // era lo que partía la fila en dos renglones.
  const city = (aud.city || []).map((x) => ({ label: String(x.key).split(',')[0].trim(), value: x.value || 0 }))
    .sort((a, b) => b.value - a.value).slice(0, 5);

  const gTotal = gender.reduce((s, x) => s + x.value, 0);
  const aTotal = age.reduce((s, x) => s + x.value, 0);
  const cTotal = (aud.city || []).reduce((s, x) => s + (x.value || 0), 0);

  // Los % del género se reparten UNA sola vez y de ahí come todo: la frase, la
  // leyenda y el aria-label. Antes la frase dividía entre M+F y la barra entre
  // el total, así que se leía "8 de cada 10 son mujeres" encima de un
  // "Mujeres 69%" a tres dedos de distancia.
  const gPct = pctShares(gender.map((x) => x.value), gTotal);

  // ── La frase, antes que cualquier gráfica ──────────────────────────────────
  const fem = gender.findIndex((x) => x.key === 'F');
  const male = gender.findIndex((x) => x.key === 'M');
  const fv = fem >= 0 ? gender[fem].value : 0;
  const mv = male >= 0 ? gender[male].value : 0;
  const domG = (fv || mv)
    ? (fv >= mv ? { lbl: T('mujeres', 'women'), i: fem } : { lbl: T('hombres', 'men'), i: male })
    : null;
  const frase = [];
  if (domG) {
    // MISMO denominador que la barra de abajo. Y el tope de "9 de cada 10" se
    // fue: con una sola cubeta imprimía "9 de cada 10" encima de un "100%".
    const p = gPct[domG.i];
    frase.push(
      p >= 100 ? T(`<b>El 100%</b> son ${esc(domG.lbl)}`, `<b>100%</b> are ${esc(domG.lbl)}`)
        : p >= 95 ? T(`<b>Casi el 100%</b> son ${esc(domG.lbl)}`, `<b>Nearly 100%</b> are ${esc(domG.lbl)}`)
          : T(`<b>${Math.max(5, Math.round(p / 10))} de cada 10</b> son ${esc(domG.lbl)}`,
            `<b>${Math.max(5, Math.round(p / 10))} in 10</b> are ${esc(domG.lbl)}`),
    );
  }
  const topAges = age.slice().sort((a, b) => b.value - a.value).slice(0, 2);
  if (aTotal && topAges.length === 2) {
    const p = pctOf(topAges.reduce((s, x) => s + x.value, 0), aTotal);
    const ord = topAges.map((x) => x.label).sort();
    // Rangos contiguos ⇒ se fusionan: "35-44 y 45-54" se lee mucho peor que
    // "entre 35 y 54". Sólo cuando de verdad son vecinos en la lista ordinal.
    const i0 = age.findIndex((x) => x.label === ord[0]);
    const i1 = age.findIndex((x) => x.label === ord[1]);
    const nums = ord.map((l) => String(l).match(/\d+/g) || []);
    const merged = (i1 - i0 === 1) && nums[0][0] && nums[1][1];
    frase.push(merged
      ? T(`<b>${p}%</b> tiene entre ${nums[0][0]} y ${nums[1][1]} años`,
        `<b>${p}%</b> are aged ${nums[0][0]} to ${nums[1][1]}`)
      : T(`<b>${p}%</b> tiene entre ${esc(ord.join(' y '))} años`,
        `<b>${p}%</b> are aged ${esc(ord.join(' or '))}`));
  }
  if (cTotal && city.length) {
    const p = pctOf(city[0].value, cTotal);
    frase.push(T(`<b>${p}%</b> está en ${esc(city[0].label)}`, `<b>${p}%</b> are in ${esc(city[0].label)}`));
  }

  const kids = [
    secOpen(T('Tu audiencia', 'Your audience'), T(
      'Es una foto de quién te sigue hoy, no de quién te vio en este periodo: Instagram sólo publica la demografía a nivel cuenta.',
      "A snapshot of who follows you today, not who saw you this period: Instagram only reports demographics at the account level.",
    )),
  ];
  if (frase.length) kids.push(el('p', { class: 'mt-lead mt-lead--sm', html: frase.join(', ') + '.' }));

  const panels = [];

  // Género — UNA barra partida. Sin texto encima: la leyenda va debajo, así
  // no hay riesgo de blanco ilegible sobre un acento claro.
  if (gender.length) {
    // "Sin dato" (key U) NUNCA lleva el color de la marca: no es una categoría
    // de la marca, es una ausencia. Va con trama neutra (data-i="9"). El rango
    // se cuenta SÓLO entre las categorías reales: si "Sin dato" va primero (que
    // pasa cuando es la mayor), usar el índice crudo pintaba Hombres y Mujeres
    // del mismo color.
    let rank = 0;
    const slots = gender.map((g) => (g.key === 'U' ? '9' : String(Math.min(rank++, 1))));
    const bar = el('div', {
      class: 'mt-split', role: 'img',
      'aria-label': gender.map((g, i) => `${g.label} ${gPct[i]}%`).join(', '),
    }, gender.map((g, i) => el('i', { dataset: { i: slots[i] }, style: { width: (g.value / (gTotal || 1) * 100).toFixed(2) + '%' } })));
    const legend = el('ul', { class: 'mt-legend' }, gender.map((g, i) => el('li', {}, [
      el('span', { class: 'mt-dot', dataset: { i: slots[i] } }),
      el('span', { text: g.label + ' ' }),
      el('b', { text: gPct[i] + '%' }),
    ])));
    panels.push(panel(T('Género', 'Gender'), [bar, legend], T(
      'Reparto de tus seguidores por género declarado.',
      'Your followers by declared gender.',
    )));
  }

  // Edad — columnas verticales: es ordinal, y en vertical un 2% cuesta una
  // columna angosta y CERO renglones (en horizontal costaba una fila entera).
  if (age.length) {
    const { keep, out } = trimSmall(age, aTotal, 3, 4);
    const note = foldNote(out);
    if (keep.length >= 4) {   // regla dura del reporte: <4 puntos ⇒ no hay gráfica
      const mx = Math.max.apply(null, keep.map((r) => r.value)) || 1;
      const cols = el('div', { class: 'mt-cols', 'aria-hidden': 'true' }, keep.map((r) => el('div', {
        class: 'mt-col', dataset: { top: r.value === mx ? '1' : '0' },
      }, [
        el('span', { class: 'mt-col__v', text: r.pct + '%' }),
        el('span', { class: 'mt-col__b', style: { height: Math.max(4, Math.round((r.value / mx) * 116)) + 'px' } }),
      ])));
      const ks = el('div', { class: 'mt-colks', 'aria-hidden': 'true' }, keep.map((r) => ageLabel(r.label)));
      // El % vive en .mt-cols y la etiqueta en .mt-colks (dos rejillas
      // hermanas): un lector de pantalla leía "24% 38% …" y luego "25-34 35-44
      // …" sin poder emparejarlos. Se envuelven y se anuncian juntos.
      const chart = el('div', {
        role: 'img',
        'aria-label': keep.map((r) => `${r.label}: ${r.pct}%`).join(', '),
      }, [cols, ks]);
      panels.push(panel(T('Edad', 'Age'), [chart], T(
        'Rangos de edad de tus seguidores. La columna más alta va en el color de tu marca.',
        "Your followers' age ranges. The tallest column carries your brand colour.",
      ), note));
    } else if (keep.length) {
      const list = joinList(keep.map((r) => `${esc(r.label)} (<b>${r.pct}%</b>)`));
      panels.push(panel(T('Edad', 'Age'), [
        el('p', { class: 'mt-plain', html: T(`Tus seguidores se concentran en ${list}.`, `Your followers cluster in ${list}.`) }),
      ], T('Con tan pocos rangos la frase se lee mejor que una gráfica.', 'With so few ranges a sentence reads better than a chart.'), note));
    }
  }

  // Ciudades — se QUEDAN como gráfica: "7 de cada 10 están en Cancún" es la
  // lámina que la dueña enseña en junta. Escaladas contra el máximo, la de 1%
  // es una astilla real y eso ES el mensaje.
  if (city.length) {
    const { keep, out } = trimSmall(city, cTotal, 2, 3);
    const note = foldNote(out);   // la nota se emite SIEMPRE: antes se tiraba justo
    const cap = T(                // en el caso en que era la única verdad en pantalla
      'La barra más larga es tu ciudad #1; el porcentaje es sobre el total de ciudades que reporta Instagram.',
      'The longest bar is your #1 city; percentages are over all cities Instagram reports.',
    );
    if (keep.length >= 3) {
      const mx = Math.max.apply(null, keep.map((r) => r.value)) || 1;
      panels.push(panel(T('Ciudades', 'Cities'), [
        el('div', { class: 'mt-bars' }, keep.map((r, i) => barRow(r.label, r.pct, r.value, mx, i + 1))),
      ], cap, note));
    } else if (keep.length) {
      // Con una o dos ciudades la barra deja de comparar y sólo confunde
      // (una de 64% pintada a lo largo y otra de 36% a la mitad).
      const list = joinList(keep.map((r) => `${esc(r.label)} (<b>${r.pct}%</b>)`));
      panels.push(panel(T('Ciudades', 'Cities'), [
        el('p', { class: 'mt-plain', html: T(`Tus seguidores se concentran en ${list}.`, `Your followers cluster in ${list}.`) }),
      ], T('Con una o dos ciudades la frase dice más que una gráfica.', 'With one or two cities a sentence says more than a chart.'), note));
    } else {
      // TODAS redondean a 0%: antes se dibujaban cinco barras "0%" casi llenas.
      const n = (aud.city || []).length;
      panels.push(panel(T('Ciudades', 'Cities'), [
        el('p', {
          class: 'mt-plain',
          html: T(
            `Ninguna ciudad llega al <b>1%</b>: tus seguidores están repartidos entre las ${nf(n)} ciudades que reporta Instagram. La que más concentra es ${esc(city[0].label)}.`,
            `No single city reaches <b>1%</b>: your followers are spread across the ${nf(n)} cities Instagram reports. The largest one is ${esc(city[0].label)}.`,
          ),
        }),
      ], T('Un reparto tan disperso no se puede dibujar sin mentir.', 'A spread this thin cannot be charted without lying.'), null));
    }
  }

  if (!panels.length) return null;
  kids.push(el('div', { class: 'mt-aud' }, panels));
  return el('section', { class: 'mt-sec' }, kids);
}

// Sección 02 cuando Instagram no entrega demografía (portada del reporte
// mensual): Meta sólo la publica arriba de ~100 seguidores.
function buildAudienceGap() {
  return el('section', { class: 'mt-sec' }, [
    secOpen(T('Tu audiencia', 'Your audience'), T(
      'Quién te sigue hoy: género, edad y ciudades.',
      'Who follows you today: gender, age and cities.',
    )),
    el('p', { class: 'mt-plain', text: T(
      'Instagram todavía no libera la demografía de esta cuenta: sólo entrega género, edad y ciudades cuando la cuenta rebasa unos 100 seguidores. En cuanto la libere, esta sección se llena sola.',
      "Instagram has not released this account's demographics yet: it only reports gender, age and cities once the account passes roughly 100 followers. This section fills in on its own as soon as it does.",
    ) }),
  ]);
}

// ── Publicaciones ────────────────────────────────────────────────────────────
function typeLabel(t) {
  return ({
    REELS: 'Reel', VIDEO: T('Video', 'Video'), CAROUSEL_ALBUM: T('Carrusel', 'Carousel'),
    IMAGE: T('Foto', 'Photo'), FEED: 'Post',
  }[t] || 'Post');
}
// "Carrusel" → "Carruseles", no "Carrusels": el plural no se hace con una `s`.
function typePlural(label) {
  return ({
    Carrusel: 'Carruseles', Carousel: 'Carousels', Foto: 'Fotos', Photo: 'Photos',
    Reel: 'Reels', Video: T('Videos', 'Videos'), Post: 'Posts',
  }[label] || label + 's');
}
const postMain = (p) => (p.reach != null ? p.reach : p.views);
const postInter = (p) => (p.interactions != null ? p.interactions : ((p.likes || 0) + (p.comments || 0)));

// Miniatura con respaldo: las URLs del CDN de Meta caducan, así que un
// onerror deja un monograma y nunca un ícono roto.
function thumb(p, cls, box) {
  const initial = (String(p.caption || typeLabel(p.type) || '?').trim().charAt(0) || '?').toUpperCase();
  if (!p.thumb || !/^https?:\/\//i.test(p.thumb)) return el('div', { class: cls + ' is-mono', text: initial });
  // width/height explícitos (no hay CLS) y prioridad baja: para IMAGE y
  // CAROUSEL Meta no da thumbnail_url y `thumb` es el JPEG original de 1080px,
  // así que la lista no debe pelearle ancho de banda a nada.
  return el('img', {
    class: cls, src: p.thumb, alt: '', loading: 'lazy', decoding: 'async', referrerpolicy: 'no-referrer',
    width: String(box || 56), height: String(box || 56), fetchpriority: 'low',
    onerror: (e) => {
      const n = e.currentTarget;
      const d = el('div', { class: cls + ' is-mono', text: initial });
      if (n.parentNode) n.parentNode.replaceChild(d, n);
    },
  });
}

// Mismo criterio que thumb(): sólo http(s). Meta devuelve URLs de instagram.com,
// pero era la única salida del archivo sin la guardia que sí tienen sus hermanas.
function postLink(p) {
  const href = p.permalink && /^https?:\/\//i.test(p.permalink) ? p.permalink : null;
  return href
    ? el('a', { class: 'mt-post__go', href, target: '_blank', rel: 'noopener', text: T('ver ↗', 'view ↗') })
    : null;
}

// ── 03 · Lo mejor del periodo (podio) ────────────────────────────────────────
function buildPodium(posts, truncated) {
  const measured = posts.filter((p) => postMain(p) != null);
  if (measured.length < 2) return null;
  const best = measured.slice().sort((a, b) => postMain(b) - postMain(a))[0];
  const vals = measured.map(postMain).sort((a, b) => a - b);
  const median = vals[Math.floor(vals.length / 2)] || 0;
  const lift = median > 0 ? Math.round(((postMain(best) - median) / median) * 100) : null;

  const why = [];
  if (lift != null && lift >= 10 && measured.length >= 4) {
    // Arriba de 200% el porcentaje deja de ser mostrable en junta ("llegó
    // 93,082% más lejos"): se cambia de unidad a veces ("930× más lejos").
    const x = postMain(best) / median;
    why.push(lift >= 200
      ? T(`llegó <b>${x >= 10 ? nf(Math.round(x)) : x.toFixed(1).replace(/\.0$/, '')}×</b> más lejos que la publicación mediana del periodo`,
        `it went <b>${x >= 10 ? nf(Math.round(x)) : x.toFixed(1).replace(/\.0$/, '')}×</b> further than the median post of the period`)
      : T(`llegó <b>${lift}%</b> más lejos que la publicación mediana del periodo`,
        `it went <b>${lift}%</b> further than the median post of the period`));
  }
  // NINGÚN fragmento trae la conjunción cosida: la pone joinList. Con "y se
  // compartió…" dentro del texto, un podio sin guardados imprimía
  // "Funcionó porque y se compartió 4 veces."
  if (best.saved) why.push(T(`se guardó <b>${nf(best.saved)}</b> ${best.saved === 1 ? 'vez' : 'veces'}`, `it was saved <b>${nf(best.saved)}</b> ${best.saved === 1 ? 'time' : 'times'}`));
  if (best.shares) why.push(T(`se compartió <b>${nf(best.shares)}</b> ${best.shares === 1 ? 'vez' : 'veces'}`, `it was shared <b>${nf(best.shares)}</b> ${best.shares === 1 ? 'time' : 'times'}`));
  const whyHtml = why.length
    ? T('Funcionó porque ', 'It worked because ') + joinList(why) + '.'
    : T('Es la publicación con más alcance del periodo.', 'It is the post with the most reach this period.');

  const mainLbl = best.reach != null ? T('alcance', 'reach') : T('vistas', 'views');
  const watch = fmtSec(best.avg_watch);

  const node = el('section', { class: 'mt-sec' }, [
    // La API sólo devuelve las 60 publicaciones más recientes: con el periodo
    // truncado la promesa absoluta ("la que más lejos llegó") puede ser falsa.
    secOpen(T('Lo mejor del periodo', 'Best of the period'), truncated
      ? T(`La publicación que más lejos llegó de las ${nf(posts.length)} más recientes, y por qué.`,
        `The post that travelled furthest among the ${nf(posts.length)} most recent ones, and why.`)
      : T('La publicación que más lejos llegó, y por qué.',
        'The post that travelled furthest, and why.')),
    el('article', { class: 'mt-best' }, [
      thumb(best, 'mt-best__th', 128),
      el('div', { class: 'mt-best__b' }, [
        el('div', { class: 'mt-post__meta' }, [
          el('span', { class: 'mt-post__type', text: typeLabel(best.type) }),
          el('span', { class: 'mt-post__date', text: shortDate(best.timestamp) }),
          postLink(best),
        ]),
        best.caption ? el('p', { class: 'mt-post__cap', text: best.caption }) : null,
        el('div', { class: 'mt-best__nums' }, [
          el('div', { class: 'mt-big' }, [
            el('span', { class: 'mt-big__v', text: nfBig(postMain(best)) }),
            el('span', { class: 'mt-big__k', text: mainLbl }),
          ]),
          el('div', { class: 'mt-big' }, [
            el('span', { class: 'mt-big__v', text: nfBig(postInter(best)) }),
            el('span', { class: 'mt-big__k', text: T('interacciones', 'interactions') }),
          ]),
          watch ? el('div', { class: 'mt-big' }, [
            el('span', { class: 'mt-big__v', text: watch }),
            el('span', { class: 'mt-big__k', text: T('visto prom.', 'avg. watched') }),
          ]) : null,
        ]),
        el('p', { class: 'mt-why', html: whyHtml }),
      ]),
    ]),
  ]);
  // Se devuelve el id para que la lista de abajo lo salte: la mejor publicación
  // aparece UNA vez, no dos.
  return { node, id: best.id };
}

// ── 04 · Publicación por publicación ─────────────────────────────────────────
function buildPosts(posts, truncated, skipId) {
  const list = posts.filter((p) => p.id !== skipId);
  if (!list.length) return null;
  // Ordenadas por alcance, igual que el reporte. Las que Instagram todavía no
  // libera van al final, nunca tratadas como 0.
  list.sort((a, b) => {
    const av = postMain(a); const bv = postMain(b);
    if (av == null && bv == null) return String(b.timestamp).localeCompare(String(a.timestamp));
    if (av == null) return 1;
    if (bv == null) return -1;
    return bv - av;
  });
  // El máximo se calcula sobre TODAS las publicaciones del periodo, incluida
  // la del podio: si no, la primera de la lista siempre saldría al 100% y la
  // barra dejaría de comparar contra la mejor, que es lo que promete el dek.
  const max = Math.max.apply(null, posts.map((p) => postMain(p) || 0)) || 1;

  const cards = list.map((p) => {
    const main = postMain(p);
    const mainLbl = p.reach != null ? T('alcance', 'reach') : T('vistas', 'views');
    // Truthiness, no `!= null`: Meta devuelve 0 de verdad, y "0 guardados ·
    // 0 compartidos" bajo cada publicación es exactamente el ruido que el
    // rediseño mató en las barras. El singular también importa: "1 guardado".
    const extra = [];
    if (p.saved) extra.push(`${nf(p.saved)} ${p.saved === 1 ? T('guardado', 'save') : T('guardados', 'saves')}`);
    if (p.shares) extra.push(`${nf(p.shares)} ${p.shares === 1 ? T('compartido', 'share') : T('compartidos', 'shares')}`);
    const w = fmtSec(p.avg_watch);
    if (w) extra.push(`${w} ${T('visto prom.', 'avg. watched')}`);
    return el('article', { class: 'mt-post' }, [
      thumb(p, 'mt-post__th'),
      el('div', { class: 'mt-post__b' }, [
        el('div', { class: 'mt-post__meta' }, [
          el('span', { class: 'mt-post__type', text: typeLabel(p.type) }),
          el('span', { class: 'mt-post__date', text: shortDate(p.timestamp) }),
          postLink(p),
        ]),
        p.caption ? el('p', { class: 'mt-post__cap', text: p.caption }) : null,
        el('span', { class: 'mt-idx' + (main == null ? ' mt-idx--wait' : '') },
          main == null ? [] : [el('i', { style: { width: Math.max((main / max) * 100, 2).toFixed(1) + '%' } })]),
        el('div', { class: 'mt-post__n' }, [
          main == null
            ? el('span', { class: 'mt-pend', text: T('En proceso', 'Processing') })
            : el('span', {}, [el('b', { text: nfBig(main) }), ' ' + mainLbl]),
          el('span', {}, [el('b', { text: nfBig(postInter(p)) }), ' ' + T('interacciones', 'interactions')]),
        ]),
        extra.length ? el('p', { class: 'mt-post__x', text: extra.join(' · ') }) : null,
      ]),
    ]);
  });

  const dek = skipId
    ? T('Las demás publicaciones del periodo, ordenadas por alcance. La barra compara cada una contra la mejor.',
      'The rest of the period, sorted by reach. The bar compares each one against the best.')
    : T('Ordenadas por alcance. La barra compara cada una contra la mejor del periodo.',
      'Sorted by reach. The bar compares each one against the best of the period.');

  return el('section', { class: 'mt-sec' }, [
    secOpen(T('Publicación por publicación', 'Post by post'), dek),
    el('div', { class: 'mt-posts' }, cards),
    truncated
      ? el('p', { class: 'mt-fold', text: T(
        `Hay ${truncated} publicación${truncated === 1 ? '' : 'es'} más en el periodo, ya contabilizada${truncated === 1 ? '' : 's'} en los totales de arriba.`,
        `There ${truncated === 1 ? 'is 1 more post' : `are ${truncated} more posts`} this period, already counted in the totals above.`,
      ) })
      : null,
  ]);
}

function buildEmpty(title, body, action, steps) {
  return el('div', { class: 'mt-empty empty-rich' }, [
    el('div', { class: 'empty-rich__ico' }, [icon('gauge', 26)]),
    el('h3', { class: 'empty-rich__t', text: title }),
    el('p', { class: 'empty-rich__s', text: body }),
    Array.isArray(steps) && steps.length
      ? el('ol', { class: 'mt-steps' }, steps.map((s, i) => el('li', { class: 'mt-step' }, [
          el('span', { class: 'mt-step__n', text: String(i + 1) }),
          el('span', { class: 'mt-step__t', text: s }),
        ])))
      : null,
    action || null,
  ]);
}

// Esqueleto con la FORMA del dato (no un spinner centrado): así la pantalla no
// brinca 600px cuando llega la respuesta.
function buildSkeleton() {
  const bar = (w, h, mt) => el('div', { class: 'mt-sk', style: { width: w, height: h, marginTop: mt || '0' } });
  return el('div', { class: 'mt-doc', 'aria-busy': 'true' }, [
    el('section', { class: 'mt-sec' }, [
      bar('86%', '22px'), bar('64%', '22px', '10px'),
      el('div', { class: 'mt-kpis' }, [
        el('div', { class: 'mt-num mt-num--hero' }, [bar('40%', '11px'), bar('58%', '48px', '12px'), bar('92%', '32px', '10px')]),
        el('div', { class: 'mt-num' }, [bar('60%', '11px'), bar('70%', '26px', '10px'), bar('100%', '30px', '8px')]),
        el('div', { class: 'mt-num' }, [bar('60%', '11px'), bar('70%', '26px', '10px'), bar('100%', '30px', '8px')]),
        el('div', { class: 'mt-num' }, [bar('60%', '11px'), bar('70%', '26px', '10px'), bar('100%', '30px', '8px')]),
      ]),
    ]),
    el('section', { class: 'mt-sec' }, [
      bar('44%', '16px'), bar('100%', '8px', '18px'), bar('100%', '8px', '14px'), bar('100%', '8px', '14px'),
    ]),
  ]);
}

// ── Render principal ──────────────────────────────────────────────────────────
function buildHead(brand, res) {
  const kids = [
    el('div', { class: 'mt-kicker mt-kicker--top', text: T('MÉTRICAS DE INSTAGRAM', 'INSTAGRAM METRICS') }),
    el('h1', { class: 'mt-title', text: brand ? brand.name : T('Elige una marca', 'Choose a brand') }),
  ];
  if (brand) {
    // El @usuario ya viene en la respuesta y la vista lo tiraba a la basura.
    const handle = res && res.username ? '@' + String(res.username).replace(/^@/, '') : '';
    // Sello de PROCEDENCIA: @usuario + "en vivo desde la API de Instagram" con
    // la hora de la consulta. El revisor de Meta rechazó el permiso de
    // insights porque "las métricas no están ligadas a una cuenta específica
    // y no parecen obtenerse en vivo" (App Review 2026-07-27): esta línea lo
    // deja probado en pantalla, y de paso le da confianza al cliente.
    const now = new Date();
    const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    kids.push(el('div', { class: 'mt-meta' }, [
      handle ? el('span', { class: 'mt-handle', text: handle }) : null,
      handle ? el('span', { class: 'mt-dotsep', text: '·' }) : null,
      el('span', { text: rangeText() }),
    ]));
    if (res && res.connected && handle) {
      kids.push(el('div', { class: 'mt-live' }, [
        el('span', { class: 'mt-live__dot', 'aria-hidden': 'true' }),
        el('span', {
          text: T(
            `Datos en vivo de la API de Instagram para ${handle} · consultados hoy ${hhmm}`,
            `Live data from the Instagram API for ${handle} · fetched today at ${hhmm}`,
          ),
        }),
      ]));
    }
  }

  const head = el('header', { class: 'mt-head' }, kids);
  if (!brand) return head;

  const chips = el('div', { class: 'mt-periods', role: 'group', 'aria-label': T('Periodo', 'Period') });
  for (const p of PERIODS) {
    chips.appendChild(el('button', {
      class: 'mt-chip' + (period === p.id ? ' is-active' : ''), type: 'button', text: T(p.label, p.en),
      'aria-pressed': period === p.id ? 'true' : 'false',
      onclick: () => { period = p.id; load(); },
    }));
  }
  const { from, to } = currentRange();
  const dl = el('a', {
    class: 'btn mt-download', target: '_blank', rel: 'noopener',
    href: `/api/marketing/report?client_id=${encodeURIComponent(brand.id)}&from=${from}&to=${to}`,
  }, [icon('activity', 16), el('span', { class: 'mt-download__t', text: T('Reporte PDF', 'PDF report') })]);

  head.appendChild(el('div', { class: 'mt-ctrl' }, [chips, dl]));
  return head;
}

function render() {
  if (!rootEl) return;
  clear(rootEl);
  applyAccentTokens(rootEl);

  const brand = activeBrand();
  const res = lastRes;
  rootEl.appendChild(buildHead(brand, res && !res.error ? res : null));

  if (!brand) {
    rootEl.appendChild(buildEmpty(
      T('Elige una marca', 'Choose a brand'),
      T('Selecciona una marca arriba para ver sus métricas de Instagram.', 'Pick a brand above to see its Instagram metrics.'),
    ));
    return;
  }

  if (loading) { rootEl.appendChild(buildSkeleton()); return; }
  if (!res) return;

  if (res.error) {
    rootEl.appendChild(buildEmpty(
      T('No se pudieron cargar', 'Could not load'), res.error,
      el('button', { class: 'btn', type: 'button', text: T('Reintentar', 'Retry'), onclick: () => load(true) }),
    ));
    return;
  }
  if (res.connected === false) {
    // CLIENTE: sin botón de conectar. La conexión la hace la agencia y el
    // backend se lo prohíbe con un 403; este botón navegaba directo a
    // /ig/login y el JSON {"error":"Forbidden"} reemplazaba la app ENTERA a
    // pantalla completa (auditoría App Review 2026-07-29, bloqueante).
    // El backend permite conectar al CLIENTE de IVAE STUDIOS (su propia marca);
    // a los demás clientes les responde 403. La UI tiene que respetar la MISMA
    // regla: esconderle el botón a IVAE STUDIOS impedía conectar su Instagram
    // desde su propio portal (y grabar el flujo para el App Review de Meta).
    const CLIENT_CAN_CONNECT = ['6ae5dd2381faa430d9e6966470b29602', 'demo-regeneris'];
    const meClientId = (ctx && ctx.store && (ctx.store.getState().me || {}).client_id) || null;
    if (isClientRole() && !CLIENT_CAN_CONNECT.includes(meClientId)) {
      rootEl.appendChild(buildEmpty(
        T('Instagram en conexión', 'Instagram being connected'),
        T('Tu agencia está conectando el Instagram de tu marca. En cuanto esté listo, aquí verás seguidores, alcance, interacciones y el rendimiento de cada publicación.',
          "Your agency is connecting your brand's Instagram. As soon as it's ready you'll see followers, reach, interactions and each post's performance here."),
      ));
      return;
    }
    rootEl.appendChild(buildEmpty(
      T('Instagram no conectado', 'Instagram not connected'),
      T('Conecta el Instagram de esta marca para ver seguidores, alcance, interacciones y el rendimiento de cada publicación, todo aquí.',
        "Connect this brand's Instagram to see followers, reach, interactions and each post's performance — all here."),
      el('button', {
        class: 'btn btn-primary', type: 'button', text: T('Conectar Instagram', 'Connect Instagram'),
        onclick: async () => {
          const b = activeBrand();
          if (!b) return;
          // Precheck (mismo patrón que clientswitcher.js): jamás navegar a un
          // error crudo — si el backend va a decir 403/503, se avisa bonito.
          try {
            const r = await fetch(`/api/marketing/ig/login?client_id=${encodeURIComponent(b.id)}`, { credentials: 'include', redirect: 'manual' });
            if (r.status === 503) { ctx?.toast?.(T('Falta configurar la app de Meta (te paso la guía).', 'The Meta app still needs setup (ask me for the guide).'), { type: 'error' }); return; }
            if (r.status === 403) { ctx?.toast?.(T('Esta cuenta no puede conectar Instagram. Hazlo desde tu acceso de agencia.', 'This account cannot connect Instagram. Use your agency access.'), { type: 'error' }); return; }
          } catch { /* sin red: la navegación de abajo mostrará su propio error */ }
          window.location.href = `/api/marketing/ig/login?client_id=${encodeURIComponent(b.id)}`;
        },
      }),
      [
        T('Toca "Conectar Instagram" aquí abajo', 'Tap "Connect Instagram" below'),
        T('Inicia sesión y autoriza el acceso en Instagram', 'Log in and grant access on Instagram'),
        T('Listo: el reporte se llena solo', 'Done — the report fills in automatically'),
      ],
    ));
    return;
  }

  const d = res.data || {};
  const t = d.totals || { posts: 0, views: 0, reach: 0, interactions: 0 };
  const posts = Array.isArray(d.posts) ? d.posts : [];
  const doc = el('div', { class: 'mt-doc' });

  // ── 01 · El periodo en una frase ───────────────────────────────────────────
  const pending = Number(d.pending || 0);
  const truncated = Number(d.truncated || 0);
  const hasViews = t.views != null && t.views > 0;
  // totals.views y totals.reach NACEN en 0 en el backend y sólo acumulan lo no
  // nulo: nunca llegan como null. Sin este `> 0` una marca recién publicada
  // (pending === posts) pintaba un "0" de 60px bajo ALCANCE DEL PERIODO, que es
  // justo lo que el encabezado de este archivo prohíbe.
  const heroVal = (hasViews ? t.views : t.reach) || 0;
  const heroLbl = hasViews ? T('Vistas del periodo', 'Views this period') : T('Alcance del periodo', 'Reach this period');
  // El denominador de la línea de lectura tiene que ser el de la MÉTRICA del
  // héroe: `pending` de la API sólo cuenta las que no traen NI vistas NI
  // alcance, así que una publicación con alcance pero sin vistas se contaba
  // como "ya medida" y aportaba 0 al héroe. Con la lista completa se cuenta
  // exacto; si la API truncó, se cae al conteo de la API.
  const measured = truncated
    ? Math.max(0, Number(t.posts || 0) - pending)
    : posts.filter((p) => (hasViews ? p.views : p.reach) != null).length;

  // Formato dominante: se calcula con lo que ya trae posts[], sin pedir nada.
  // Vive en la FRASE, no en un cuarto KPI: el conteo de publicaciones ya lo dice
  // la frase y repetirlo en tarjeta era uno de los tres números duplicados.
  const byType = {};
  for (const p of posts) { const k = typeLabel(p.type); byType[k] = (byType[k] || 0) + 1; }
  const topType = Object.entries(byType).sort((a, b) => b[1] - a[1])[0];
  const domFormat = topType && Object.keys(byType).length >= 2 && topType[1] / posts.length >= 0.5 ? topType[0] : null;

  const leadParts = [];
  if (t.posts) {
    leadParts.push(T(
      `En este periodo publicamos <b>${nf(t.posts)}</b> ${t.posts === 1 ? 'contenido' : 'contenidos'}`,
      `This period we published <b>${nf(t.posts)}</b> ${t.posts === 1 ? 'piece' : 'pieces'}`,
    ));
    if (domFormat) {
      const f = esc(t.posts === 1 ? domFormat : typePlural(domFormat));
      leadParts.push(T(`, sobre todo ${f}`, `, mostly ${f}`));
    }
    if (heroVal) {
      leadParts.push(T(
        `, que ${t.posts === 1 ? 'sumó' : 'sumaron'} <b>${nfBig(heroVal)}</b> ${hasViews ? 'vistas' : 'de alcance'}`,
        `, adding up to <b>${nfBig(heroVal)}</b> ${hasViews ? 'views' : 'reach'}`,
      ));
    }
    leadParts.push('.');
    // El alcance ya no se repite aquí: tiene su propia tarjeta abajo.
    if (!heroVal) {
      leadParts.push(T(
        ` Instagram todavía no libera sus números: aparecen aquí en cuanto los publique.`,
        ` Instagram has not released their numbers yet: they will appear here as soon as it does.`,
      ));
    }
  } else {
    leadParts.push(T('En este periodo no hay publicaciones registradas en Instagram.', 'No Instagram posts are on record for this period.'));
  }

  const sec1 = el('section', { class: 'mt-sec' }, [
    secOpen(T('El periodo en una frase', 'The period in one sentence'), T(
      'Lo esencial primero. Si sólo lees una pantalla, que sea esta.',
      'The essentials first. If you only read one screen, read this one.',
    )),
    el('p', { class: 'mt-lead', html: leadParts.join('') }),
  ]);

  // La fila de KPIs sólo existe si el héroe TIENE cifra. Con todo pendiente la
  // frase de arriba ya lo dijo con palabras y aquí no se dibuja nada.
  if (t.posts && heroVal) {
    const one = measured === 1;
    const heroRead = T(
      `Suma de ${one ? 'la <b>única</b> publicación ya medida' : `las <b>${nf(measured)}</b> publicaciones ya medidas`} del periodo${pending ? `, de ${nf(t.posts)} en total. ${pending === 1 ? 'Falta <b>1</b>' : `Faltan <b>${nf(pending)}</b>`} por liberar.` : '.'} No es el total de la cuenta.`,
      `Sum of the <b>${nf(measured)}</b> already-measured ${one ? 'post' : 'posts'} of the period${pending ? `, out of ${nf(t.posts)}. <b>${nf(pending)}</b> still pending.` : '.'} It is not the account total.`,
    );
    const saves = Number(t.saved || 0) + Number(t.shares || 0);

    const kpis = el('div', { class: 'mt-kpis' }, [
      kpi(heroLbl, nfBig(heroVal), heroRead, { hero: true }),
      // "Alcance" SÓLO cuando el héroe son vistas. Si el héroe ya es alcance
      // (marca que sólo publica fotos/carruseles), esta tarjeta imprimía el
      // mismo número dos veces, una al lado de la otra, con dos rótulos.
      hasViews && t.reach ? kpi(T('Alcance', 'Reach'), nfBig(t.reach), T(
        'Cuentas distintas que vieron tus publicaciones del periodo.',
        'Distinct accounts that saw your posts this period.',
      )) : null,
      kpi(T('Interacciones', 'Interactions'), nfBig(t.interactions), T(
        'Me gusta, comentarios, guardados y compartidos.',
        'Likes, comments, saves and shares.',
      )),
      // Guardados + compartidos: la API ya los devuelve en totals y la vista los
      // tiraba. Son las dos señales que mueven el alcance a gente nueva.
      // El desglose sólo nombra lo que NO es cero: "0 guardados y 3
      // compartidos" vuelve a meter un 0 en pantalla por la puerta de atrás.
      saves ? kpi(T('Guardados y compartidos', 'Saves and shares'), nfBig(saves), (() => {
        const bits = [];
        if (t.saved) bits.push(T(`<b>${nf(t.saved)}</b> ${t.saved === 1 ? 'guardado' : 'guardados'}`, `<b>${nf(t.saved)}</b> ${t.saved === 1 ? 'save' : 'saves'}`));
        if (t.shares) bits.push(T(`<b>${nf(t.shares)}</b> ${t.shares === 1 ? 'compartido' : 'compartidos'}`, `<b>${nf(t.shares)}</b> ${t.shares === 1 ? 'share' : 'shares'}`));
        return T(
          `${joinList(bits)}: las señales que más empujan a Instagram a mostrarte con gente nueva.`,
          `${joinList(bits)}: the signals that push Instagram hardest to show you to new people.`,
        );
      })()) : null,
    ].filter(Boolean));
    // Con 3 o 4 tarjetas el escritorio no puede llevar una plantilla fija de 4
    // columnas: dejaba una celda vacía a la derecha.
    kpis.style.setProperty('--mt-n', String(kpis.childElementCount - 1));
    sec1.appendChild(kpis);
  }

  // "Tu cuenta hoy": los dos datos que NO se mueven con el selector de periodo
  // van en su propia fila, separados de los KPIs del periodo. Antes vivían en
  // una tira de 19px que se perdía; Vianey pidió VER los seguidores, así que
  // ahora son tarjetas del mismo tamaño que las demás cifras (2026-07-29). La
  // separación periodo-vs-hoy se mantiene: fila aparte, con su propio kicker,
  // y cada cifra lleva su línea de lectura que dice "hoy, no el periodo".
  if (d.followers != null || d.reach_28d != null) {
    const acct = el('div', { class: 'mt-kpis mt-kpis--acct' }, [
      d.followers != null ? kpi(T('Seguidores', 'Followers'), nfBig(d.followers), T(
        'Foto de la cuenta <b>ahora mismo</b>, no del periodo que elegiste. Todavía no guardamos histórico, por eso no hay comparativa.',
        "A snapshot of the account <b>right now</b>, not of the period you picked. We don't store follower history yet, so there is no comparison.",
      )) : null,
      d.reach_28d != null ? kpi(T('Alcance · 28 días', 'Reach · 28 days'), nfBig(d.reach_28d), T(
        'Ventana móvil de Instagram con las cuentas alcanzadas en los últimos 28 días: no se suma con los números del periodo.',
        "Instagram's rolling window of accounts reached in the last 28 days: it does not add up with the period numbers.",
      )) : null,
    ].filter(Boolean));
    acct.style.setProperty('--mt-n', String(Math.max(acct.childElementCount - 1, 1)));
    sec1.appendChild(el('div', { class: 'mt-acctwrap' }, [
      el('div', { class: 'mt-kicker', text: T('Tu cuenta hoy', 'Your account today') }), acct,
    ]));
  }
  doc.appendChild(sec1);

  // ── 02 · Tu audiencia ──────────────────────────────────────────────────────
  // Si Instagram no libera demografía, la sección NO desaparece: se explica.
  // Una marca chica que sí publica veía un hueco mudo donde el PDF sí tiene
  // sección, y el hueco se lee como error nuestro.
  const aud = buildAudience(d.audience) || (posts.length ? buildAudienceGap() : null);
  if (aud) doc.appendChild(aud);

  // ── 03 · Lo mejor del periodo + 04 · Publicación por publicación ───────────
  const podium = buildPodium(posts, truncated);
  if (podium) doc.appendChild(podium.node);
  const list = buildPosts(posts, truncated, podium ? podium.id : null);
  if (list) doc.appendChild(list);

  rootEl.appendChild(doc);

  if (!aud && !posts.length) {
    rootEl.appendChild(buildEmpty(
      T('Sin datos en el periodo', 'No data for this period'),
      T('No hay publicaciones ni datos de audiencia para estas fechas. Prueba un periodo más amplio.',
        'No posts or audience data for these dates. Try a wider period.'),
    ));
  }
}

// ── Ciclo de vida ─────────────────────────────────────────────────────────────
export default {
  id: VIEW_ID,
  mount(host, c) {
    ctx = c;
    mounted = true;
    ensureCss();
    rootEl = el('div', { class: 'mt-root' });
    host.appendChild(rootEl);
    unsubs.push(ctx.store.subscribe(['clients', 'activeClientId'], () => { lastKey = ''; load(); }));
    // El tema se conmuta EN VIVO (theme.js no recarga): los tokens de color se
    // calculan en JS, así que hay que recalcularlos cuando cambia data-theme.
    try {
      themeObs = new MutationObserver(() => applyAccentTokens(rootEl));
      themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    } catch { /* noop */ }
    render();
    load();
  },
  onParams() { load(); },
  unmount() {
    for (const u of unsubs) { try { u(); } catch { /* noop */ } }
    unsubs = [];
    try { if (themeObs) themeObs.disconnect(); } catch { /* noop */ }
    themeObs = null;
    mounted = false;
    rootEl = null;
    ctx = null;
  },
};
