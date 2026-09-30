// ============================================================================
// IVAE Marketing — Vista "Video IA" (generador de clips con IA; SOLO staff).
//
// Eliges la marca (la activa), describes la escena o dejas que Claude la
// proponga desde una pieza del calendario, eliges la calidad y la duración
// (con su precio a la vista) y generas. El clip tarda 1-3 minutos; la vista
// sondea cada 6 s y lo muestra en cuanto está. Todo el gasto queda anotado
// por marca.
//
// El precio de Google se cobra POR SEGUNDO, así que la duración cambia el
// costo y por eso se enseña junta con la calidad, nunca escondida.
// ============================================================================
import { api, el, clear, toast } from '../api.js?v=202609301122';
import { icon } from '../shell/icons.js?v=202609301122';
import { T } from '../shell/i18n.js?v=202609301122';

const VIEW_ID = 'video-ia';
const MXN = 20; // tipo de cambio aproximado, solo para orientar

let rootEl = null, ctx = null, listEl = null, gastoEl = null, promptEl = null, notaEl = null;
let tierEls = {}, precioEls = {}, segundosRow = null, notaSegEl = null, btnGenTxt = null;
let autoSegundos = true; // se apaga en cuanto ella toca un botón de duración
let estado = { configurado: false, catalogo: {} };
let segundos = 8;
let jobs = [];
let timer = null;
let busy = false;
let unsub = null;
// Foto de INICIO y foto FINAL (data URL). Veo va de una a la otra.
let fotos = { inicio: null, fin: null };
let fotosRow = null, slots = {};

const usdTxt = (u) => {
  const mx = Math.round(Number(u) * MXN);
  return `$${Number(u).toFixed(2)} USD · ≈ ${mx} ${mx === 1 ? 'peso' : 'pesos'}`;
};
// Una foto del teléfono pesa 8-12 MB y el servidor corta en 7. Se encoge a
// 1920 px del lado largo antes de mandarla: Veo no aprovecha más resolución y
// así la subida no se cae en datos móviles.
const LADO_MAX = 1920;
function aDataUrl(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(new Error(T('No se pudo leer la foto.', 'Could not read the photo.')));
    fr.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error(T('Esa foto no se puede abrir.', 'That photo cannot be opened.')));
      img.onload = () => {
        const escala = Math.min(1, LADO_MAX / Math.max(img.width, img.height));
        if (escala === 1 && String(fr.result).length < 6.5 * 1024 * 1024) { resolve(String(fr.result)); return; }
        const cv = document.createElement('canvas');
        cv.width = Math.round(img.width * escala); cv.height = Math.round(img.height * escala);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        resolve(cv.toDataURL('image/jpeg', 0.92));
      };
      img.src = String(fr.result);
    };
    fr.readAsDataURL(file);
  });
}

const clienteActivo = () => {
  const st = ctx.store.getState();
  return (st.clients || []).find((c) => c.id === st.activeClientId) || null;
};
const piezasDelMes = () => {
  const st = ctx.store.getState();
  const cid = st.activeClientId;
  const hoy = new Date().toISOString().slice(0, 7);
  return (st.posts || []).filter((p) => p.client_id === cid && String(p.publish_date || '').slice(0, 7) >= hoy)
    .sort((a, b) => String(a.publish_date).localeCompare(String(b.publish_date)));
};

// Cuántos segundos pide la frase entre comillas del prompt. Misma cuenta que el
// servidor: 2.5 palabras por segundo más un respiro, subida al escalón de Veo.
function segundosParaFrase(texto) {
  const m = String(texto || '').match(/["\u201C\u201D']([^"\u201C\u201D']{8,400})["\u201C\u201D']/);
  if (!m) return null;
  const palabras = m[1].trim().split(/\s+/).filter(Boolean).length;
  if (!palabras) return null;
  const ideal = palabras / 2.5 + 1;
  const escalon = [4, 6, 8].find((x) => x >= ideal) || 8;
  return { palabras, segundos: escalon, cabe: ideal <= 8 };
}

// Las duraciones largas NO se ajustan solas: la frase siempre cabe en los
// primeros 8 s, lo demás es plano continuo y eso lo decide ella.
function esLarga(sg) { return Number(sg) > 8; }

// Ajusta la duración sola a lo que pide la frase y lo dice sin esconderlo.
function ajustarSegundos(texto, { avisar = true } = {}) {
  const m = segundosParaFrase(texto);
  if (!m || !autoSegundos || esLarga(segundos)) return;
  if (m.segundos !== segundos) {
    segundos = m.segundos;
    marcarSegundos();
    refrescarPrecios();
  }
  if (avisar && notaSegEl) {
    notaSegEl.textContent = m.cabe
      ? T(`Ajustado solo: la frase tiene ${m.palabras} palabras y pide ${m.segundos} s.`,
          `Set automatically: the line has ${m.palabras} words and needs ${m.segundos} s.`)
      : T(`La frase tiene ${m.palabras} palabras y no cabe en 8 s, que es el máximo. Córtala o pártela en dos clips.`,
          `The line has ${m.palabras} words and will not fit in 8 s. Shorten it or split it in two clips.`);
    notaSegEl.hidden = false;
  }
}

function marcarSegundos() {
  if (!segundosRow) return;
  [...segundosRow.querySelectorAll('.via-seg')].forEach((x) => x.classList.toggle('is-on', x.textContent === `${segundos} s`));
}

function ensureCss() {
  const has = [...document.querySelectorAll('link[rel="stylesheet"]')].some((l) => (l.getAttribute('href') || '').includes('/marketing/css/video-ia.css'));
  if (has) return;
  const link = document.createElement('link'); link.rel = 'stylesheet';
  link.href = '/marketing/css/video-ia.css?v=202609301122'; document.head.appendChild(link);
}

async function cargar() {
  const cli = clienteActivo();
  if (!cli) return;
  try {
    const r = await api.get(`/video-ia/jobs?client_id=${encodeURIComponent(cli.id)}`);
    jobs = r.jobs || [];
    pintarLista(); pintarGasto(r.gasto_mes);
  } catch (e) { toast(e.message, { type: 'error' }); }
}

function programarSondeo() {
  clearInterval(timer);
  timer = setInterval(() => { if (jobs.some((j) => j.status === 'running' || j.status === 'queued')) cargar(); }, 6000);
}

// Nombre de cada bolsillo, para que se vea A QUIÉN le están cobrando.
const BOLSILLOS = {
  credito: () => T('con el crédito de Google', 'on the Google credit'),
  tarjeta: () => T('a la tarjeta (Google)', 'to the card (Google)'),
  openai: () => T('del saldo de OpenAI', 'from the OpenAI balance'),
  fal: () => T('del saldo de fal.ai', 'from the fal.ai balance'),
  replicate: () => T('del saldo de Replicate', 'from the Replicate balance'),
};

function pintarGasto(g) {
  if (!gastoEl) return;
  clear(gastoEl);
  const cli = clienteActivo();
  if (!g) return;
  gastoEl.appendChild(el('span', { text: `${cli ? cli.name : ''} · ${T('este mes', 'this month')}: ` }));
  gastoEl.appendChild(el('strong', { text: `${g.clips} ${T('clips', 'clips')} · ${usdTxt(g.usd || 0)}` }));
  // Y el desglose: un total en dólares no dice de dónde salió el dinero.
  const partes = Object.entries(g.por_bolsillo || {}).filter(([, v]) => v && v.usd > 0);
  if (partes.length) {
    const ul = el('div', { class: 'via-bolsillos' });
    for (const [k, v] of partes.sort((a, b) => b[1].usd - a[1].usd)) {
      const nombre = BOLSILLOS[k] ? BOLSILLOS[k]() : k;
      ul.appendChild(el('span', { class: 'via-bolsillo', text: `${usdTxt(v.usd)} ${nombre}` }));
    }
    gastoEl.appendChild(ul);
  }
}

function tarjeta(j) {
  const cat = estado.catalogo[j.tier] || {};
  const card = el('article', { class: 'via-card via-card--' + j.status });
  const media = el('div', { class: 'via-card__media' });
  if (j.status === 'done' && j.video_url) {
    media.appendChild(el('video', { src: j.video_url, controls: true, playsinline: true, preload: 'metadata' }));
  } else if (j.status === 'error') {
    media.appendChild(el('div', { class: 'via-card__estado via-card__estado--error' }, [icon('wifi-off', 22), el('span', { text: j.error || T('Falló la generación', 'Generation failed') })]));
  } else {
    media.appendChild(el('div', { class: 'via-card__estado' }, [el('span', { class: 'spinner' }), el('span', { text: T('Generando… tarda 1 a 3 minutos', 'Generating… takes 1 to 3 minutes') })]));
  }
  const meta = el('div', { class: 'via-card__meta' }, [
    el('span', { class: 'via-chip', text: cat.label || j.tier }),
    el('span', { class: 'via-chip via-chip--mute', text: cat.modelo || j.model }),
    el('span', { class: 'via-chip via-chip--mute', text: `${j.seconds || 8} s` }),
    ...(j.parent_id ? [el('span', { class: 'via-chip via-chip--mute', text: T('continuación', 'continuation') })] : []),
    el('span', { class: 'via-chip via-chip--mute', text: usdTxt(Number(j.cost_usd || 0)) }),
  ]);
  const prompt = el('p', { class: 'via-card__prompt', text: j.prompt });
  const acciones = el('div', { class: 'via-card__acciones' });
  if (j.status === 'done') {
    acciones.appendChild(el('a', { class: 'btn btn--ghost', href: j.video_url, download: `video-ia-${j.id.slice(0, 8)}.mp4` }, [icon('download', 15), el('span', { text: T('Descargar', 'Download') })]));
  }
  // Alargar: Veo continúa el MISMO plano 7 s más y devuelve el video completo.
  if (j.puede_alargar) {
    const mx = Math.round(Number(j.alargar_usd || 0) * MXN);
    acciones.appendChild(el('button', { class: 'btn btn--ghost', type: 'button',
      title: T('Sigue el mismo plano 7 segundos más, sin corte', 'Continues the same shot 7 more seconds, no cut'),
      onclick: () => abrirAlargar(card, j) },
      [icon('spark', 15), el('span', { text: `${T('Alargar 7 s', 'Extend 7 s')} · ${mx} ${mx === 1 ? 'peso' : 'pesos'}` })]));
  }
  acciones.appendChild(el('button', { class: 'btn btn--ghost', type: 'button', onclick: () => generar(j.prompt, j.tier, j.seconds) }, [icon('spark', 15), el('span', { text: T('Otro intento', 'Try again') })]));
  acciones.appendChild(el('button', { class: 'btn btn--ghost via-borrar', type: 'button', 'aria-label': T('Borrar', 'Delete'), onclick: async () => {
    try { await api.del(`/video-ia/jobs/${j.id}`); jobs = jobs.filter((x) => x.id !== j.id); pintarLista(); } catch (e) { toast(e.message, { type: 'error' }); }
  } }, [icon('trash', 15)]));
  card.append(media, meta, prompt, acciones);
  return card;
}

// Panel de "Alargar": se abre dentro de la tarjeta. Si se deja vacío, el
// servidor le pide a Veo que siga lo que ya estaba pasando.
function abrirAlargar(card, j) {
  if (card.querySelector('.via-alargar')) return;
  const ta = el('textarea', { class: 'via-alargar__txt', rows: 2,
    placeholder: T('¿Qué pasa en los siguientes 7 segundos? (opcional, en inglés sale mejor)', 'What happens in the next 7 seconds? (optional)') });
  const box = el('div', { class: 'via-alargar' }, [
    el('p', { class: 'via-alargar__nota', text: T('Sigue el mismo plano, sin corte. Te devuelve el video completo y más largo.', 'Continues the same shot with no cut. You get the full, longer video.') }),
    ta,
    el('div', { class: 'via-alargar__pie' }, [
      el('button', { class: 'btn btn--ghost', type: 'button', text: T('Cancelar', 'Cancel'), onclick: () => box.remove() }),
      el('button', { class: 'btn btn--primary', type: 'button', text: T('Alargar', 'Extend'), onclick: async () => {
        if (busy) return;
        busy = true; rootEl.classList.add('is-busy');
        try {
          const r = await api.post(`/video-ia/jobs/${j.id}/alargar`, { prompt: (ta.value || '').trim() }, { timeout: 60000 });
          jobs = [r.job, ...jobs]; pintarLista(); programarSondeo();
          toast(T('Alargando. Tarda 1 a 3 minutos.', 'Extending. Takes 1 to 3 minutes.'), { type: 'ok' });
        } catch (e) { toast(e.message, { type: 'error' }); }
        finally { busy = false; rootEl.classList.remove('is-busy'); }
      } }),
    ]),
  ]);
  card.appendChild(box);
  ta.focus();
}

function pintarLista() {
  if (!listEl) return;
  clear(listEl);
  if (!jobs.length) {
    listEl.appendChild(el('p', { class: 'via-vacio', text: T('Todavía no hay clips de esta marca. Describe una escena arriba y genera el primero.', 'No clips for this brand yet. Describe a scene above and generate the first one.') }));
    return;
  }
  for (const j of jobs) listEl.appendChild(tarjeta(j));
}

async function generar(prompt, tier, segs) {
  const cli = clienteActivo();
  if (!cli) { toast(T('Elige una marca primero.', 'Pick a brand first.'), { type: 'error' }); return; }
  const cat = estado.catalogo[tier];
  if (!cat || !cat.listo) { toast(T('Esa calidad todavía no está conectada. Ve el aviso de arriba.', 'That quality is not connected yet. See the notice above.'), { type: 'error' }); return; }
  if (busy) return;
  const s = segundosDe(tier, segs);
  busy = true; rootEl.classList.add('is-busy');
  try {
    const cuerpo = { client_id: cli.id, tier, prompt, aspect: '9:16', seconds: s };
    if (cat.fotoInicio && fotos.inicio) cuerpo.image_start = fotos.inicio;
    if (cat.fotoFinal && fotos.fin) cuerpo.image_end = fotos.fin;
    // Con foto final y sin la de inicio Veo no sabe de dónde salir: se avisa
    // aquí para no gastar un viaje al servidor.
    if (cuerpo.image_end && !cuerpo.image_start) {
      toast(T('Falta la foto de inicio: Veo va de la primera a la última.', 'Start photo missing: Veo goes from the first to the last.'), { type: 'error' });
      return;
    }
    const r = await api.post('/video-ia/jobs', cuerpo, { timeout: 90000 });
    jobs = [r.job, ...jobs]; pintarLista(); programarSondeo();
    toast(T('Clip en camino. Te aviso cuando esté.', 'Clip on its way.'), { type: 'ok' });
  } catch (e) { toast(e.message, { type: 'error' }); }
  finally { busy = false; rootEl.classList.remove('is-busy'); }
}

// La duración pedida solo vale si el proveedor la acepta (Veo 4/6/8, fal 5).
function segundosDe(tier, pedido) {
  const cat = estado.catalogo[tier] || {};
  const ok = cat.segundos || [8];
  const p = Number(pedido || segundos);
  return ok.includes(p) ? p : ok[ok.length - 1];
}

// Un recuadro de foto: se toca, se elige del disco, se ve la miniatura y se
// puede quitar con la ×. `clave` es 'inicio' o 'fin'.
function slotFoto(clave, etiqueta, ayuda) {
  const inp = el('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', hidden: true });
  const mini = el('div', { class: 'via-foto__mini' });
  const txt = el('span', { class: 'via-foto__txt', text: etiqueta });
  const quitar = el('button', {
    class: 'via-foto__x', type: 'button', hidden: true, 'aria-label': T('Quitar la foto', 'Remove photo'),
    onclick: (e) => { e.stopPropagation(); fotos[clave] = null; pintarSlot(clave); refrescarPrecios(); },
  }, [icon('close', 14)]);
  const caja = el('button', { class: 'via-foto', type: 'button', onclick: () => inp.click() }, [mini, txt, quitar]);
  inp.onchange = async () => {
    const f = inp.files && inp.files[0];
    inp.value = '';
    if (!f) return;
    try { fotos[clave] = await aDataUrl(f); pintarSlot(clave); refrescarPrecios(); }
    catch (err) { toast(err.message, { type: 'error' }); }
  };
  const cont = el('div', { class: 'via-foto-wrap' }, [caja, inp, el('span', { class: 'via-foto__ayuda', text: ayuda })]);
  slots[clave] = { cont, mini, txt, quitar, etiqueta };
  return cont;
}

function pintarSlot(clave) {
  const sl = slots[clave]; if (!sl) return;
  const src = fotos[clave];
  sl.mini.style.backgroundImage = src ? `url("${src}")` : '';
  sl.mini.classList.toggle('is-llena', !!src);
  sl.txt.textContent = src ? T('Cambiar', 'Change') : sl.etiqueta;
  sl.quitar.hidden = !src;
}

function tierActual() {
  return Object.keys(tierEls).find((k) => tierEls[k].checked) || Object.keys(estado.catalogo)[0];
}

function refrescarPrecios() {
  for (const [k, c] of Object.entries(estado.catalogo)) {
    const s = segundosDe(k);
    if (precioEls[k]) precioEls[k].textContent = `${s} s · ${usdTxt((c.usdSeg || 0) * s)}`;
  }
  // La fila de duración no aplica a los proveedores de duración fija.
  const k = tierActual();
  const cat = estado.catalogo[k] || {};
  if (segundosRow) segundosRow.hidden = (cat.segundos || []).length < 2;
  // Cada nivel acepta lo que acepta. Si ella ya había puesto una foto y cambia
  // a un nivel que no la recibe, se quita Y se avisa: mandarla en silencio a la
  // basura daría un video que no se parece a lo que pidió.
  if (slots.inicio && slots.fin) {
    const perdidas = [];
    for (const [clave, puede] of [['inicio', !!cat.fotoInicio], ['fin', !!cat.fotoFinal]]) {
      slots[clave].cont.hidden = !puede;
      if (!puede && fotos[clave]) { fotos[clave] = null; pintarSlot(clave); perdidas.push(clave === 'inicio' ? T('de inicio', 'start') : T('final', 'end')); }
    }
    if (perdidas.length) {
      toast(T(`"${cat.label}" no acepta foto ${perdidas.join(' ni ')}; se quitó.`, `"${cat.label}" does not take a ${perdidas.join(' or ')} photo; removed.`), { type: 'warn' });
    }
    if (fotosRow) fotosRow.hidden = !cat.fotoInicio && !cat.fotoFinal;
  }
  if (btnGenTxt && cat.usdSeg != null) {
    const mx = Math.round(cat.usdSeg * segundosDe(k) * MXN);
    btnGenTxt.textContent = `${T('Generar clip', 'Generate clip')} · ${mx} ${mx === 1 ? 'peso' : 'pesos'}`;
  }
}

async function proponer(sel) {
  const p = piezasDelMes().find((x) => x.id === sel.value);
  if (!p) { toast(T('Elige una pieza del calendario.', 'Pick a piece from the calendar.'), { type: 'error' }); return; }
  const cli = clienteActivo();
  promptEl.disabled = true; notaEl.textContent = T('Claude está pensando la escena…', 'Claude is thinking the scene…');
  try {
    const t = tierActual();
    const r = await api.post('/video-ia/escena', { hook: p.hook || p.title, guion: p.body || '', marca: cli ? cli.name : '', tier: t, seconds: segundosDe(t) }, { timeout: 40000 });
    promptEl.value = r.prompt_en; notaEl.textContent = r.nota_es || '';
    if (r.segundos && autoSegundos) { segundos = r.segundos; marcarSegundos(); refrescarPrecios(); }
    ajustarSegundos(r.prompt_en);
  } catch (e) { notaEl.textContent = ''; toast(e.message, { type: 'error' }); }
  finally { promptEl.disabled = false; }
}

function avisoConexion() {
  // Tres estados posibles, y cada uno se dice sin rodeos.
  if (estado.google === 'vertex') {
    return el('div', { class: 'via-aviso via-aviso--ok' }, [
      el('strong', { text: T('Conectado a Google Vertex AI', 'Connected to Google Vertex AI') }),
      el('p', { text: T('Los clips se pagan con el crédito de prueba de 300 USD.', 'Clips are paid with the 300 USD trial credit.') }),
    ]);
  }
  if (estado.google === 'gemini') {
    return el('div', { class: 'via-aviso' }, [
      el('strong', { text: T('Conectado por la API de Gemini', 'Connected through the Gemini API') }),
      el('p', { text: T('Ojo: el crédito de prueba de 300 USD NO paga esta vía. Cada clip se le cobra a la tarjeta. Para usar el crédito hay que conectar Vertex AI (GOOGLE_SA_JSON).', 'Heads up: the 300 USD trial credit does NOT cover this path. Each clip is charged to the card.') }),
    ]);
  }
  return el('div', { class: 'via-aviso' }, [
    el('strong', { text: T('Falta conectar el proveedor de video', 'Video provider not connected yet') }),
    el('p', { text: T('En Cloudflare Pages hay que guardar una de estas: GOOGLE_SA_JSON (Vertex AI, lo paga el crédito de 300 USD) o GEMINI_API_KEY (se le cobra a la tarjeta). En cuanto esté, este aviso desaparece.', 'In Cloudflare Pages store either GOOGLE_SA_JSON (Vertex AI, covered by the 300 USD credit) or GEMINI_API_KEY (charged to the card).') }),
  ]);
}

function render() {
  clear(rootEl);
  const cli = clienteActivo();
  rootEl.appendChild(el('header', { class: 'via-head' }, [
    el('h1', { class: 'via-title', text: T('Video con IA', 'AI video') }),
    el('p', { class: 'via-sub', text: T('Describe la escena, elige la calidad y genera. Cada clip queda anotado con su costo por marca.', 'Describe the scene, pick the quality and generate. Every clip is logged with its cost per brand.') }),
  ]));
  rootEl.appendChild(avisoConexion());
  gastoEl = el('div', { class: 'via-gasto' }); rootEl.appendChild(gastoEl);

  // ── Formulario ──
  const form = el('section', { class: 'via-form' });
  const piezas = piezasDelMes();
  const sel = el('select', { class: 'via-select' }, [el('option', { value: '', text: T('Tomar la escena de una pieza del calendario…', 'Take the scene from a calendar piece…') }),
    ...piezas.map((p) => el('option', { value: p.id, text: `${String(p.publish_date || '').slice(5)} · ${p.title || ''}` }))]);
  const btnProp = el('button', { class: 'btn btn--ghost', type: 'button', onclick: () => proponer(sel) }, [icon('spark', 15), el('span', { text: T('Proponer escena', 'Suggest scene') })]);
  form.appendChild(el('div', { class: 'via-row' }, [sel, btnProp]));
  promptEl = el('textarea', { class: 'via-prompt', rows: 5, oninput: () => ajustarSegundos(promptEl.value), placeholder: T('Ej. A 60-year-old man sits calmly in a bright clinic chair, IV pole softly out of focus behind him, warm morning light, slow push-in, beige and green palette. (En inglés sale mejor.)', 'e.g. A 60-year-old man sits calmly in a bright clinic chair…') });
  form.appendChild(promptEl);
  notaEl = el('p', { class: 'via-nota' }); form.appendChild(notaEl);

  // Foto de inicio y foto final: con las dos, Veo inventa el movimiento que va
  // de una a la otra. Se enseñan solo en los niveles que de verdad las reciben.
  slots = {};
  fotosRow = el('div', { class: 'via-fotos' }, [
    el('span', { class: 'via-fotos__lbl', text: T('Fotos', 'Photos') }),
    slotFoto('inicio', T('Foto de inicio', 'Start photo'), T('Con qué cuadro empieza', 'Opening frame')),
    slotFoto('fin', T('Foto final', 'End photo'), T('Con qué cuadro termina', 'Closing frame')),
  ]);
  form.appendChild(fotosRow);
  pintarSlot('inicio'); pintarSlot('fin');

  // Duración: cambia el precio, así que va antes de los niveles.
  segundosRow = el('div', { class: 'via-segs' }, [el('span', { class: 'via-segs__lbl', text: T('Duración', 'Length') })]);
  const opciones = (estado.catalogo[tierActual()] || {}).segundos || [4, 6, 8];
  for (const sg of opciones) {
    const b = el('button', { class: 'via-seg' + (sg === segundos ? ' is-on' : ''), type: 'button', text: `${sg} s`, onclick: () => {
      segundos = sg; autoSegundos = false; // manda ella
      marcarSegundos(); refrescarPrecios();
      if (notaSegEl) { notaSegEl.textContent = T('Duración fija por ti.', 'Length set by you.'); notaSegEl.hidden = false; }
    } });
    segundosRow.appendChild(b);
  }
  form.appendChild(segundosRow);
  notaSegEl = el('p', { class: 'via-notaseg', hidden: true });
  form.appendChild(notaSegEl);
  // Lo largo no es magia: hay que decir cómo se arma y cuánto tarda.
  form.appendChild(el('p', { class: 'via-notalargo', text: T(
    'Cada calidad ofrece SOLO lo que da de una sola toma: Veo 8 segundos, Sora 2 llega a 20 y Seedance a 30. Para pasar de ahí, genera el clip y usa "Alargar": así sabes que lo que ves es una toma y lo que crece son tomas pegadas.',
    'Each quality offers ONLY what it delivers in a single shot: Veo 8 seconds, Sora 2 up to 20, Seedance up to 30. To go longer, generate the clip and use "Extend".') }));

  const tiers = el('div', { class: 'via-tiers', role: 'radiogroup' });
  tierEls = {}; precioEls = {};
  const claves = Object.keys(estado.catalogo);
  let marcado = false;
  for (const k of claves) {
    const c = estado.catalogo[k];
    if (c.retirado) continue;   // proveedor apagado (Sora desde el 24-sep-2026): ni se muestra
    const input = el('input', { type: 'radio', name: 'via-tier', value: k, id: 'via-tier-' + k, onchange: refrescarPrecios });
    if (!c.listo) input.disabled = true;
    if (c.listo && !marcado) { input.checked = true; marcado = true; }
    tierEls[k] = input;
    const precio = el('span', { class: 'via-tier__precio' });
    precioEls[k] = precio;
    const cuerpo = [
      el('strong', { text: `${c.label} · ${c.modelo}` }),
      el('span', { class: 'via-tier__sub', text: c.sub }),
      precio,
    ];
    if (!c.listo) cuerpo.push(el('span', { class: 'via-tier__off', text: T('Falta conectar este proveedor', 'Provider not connected') }));
    tiers.appendChild(el('label', { class: 'via-tier' + (c.listo ? '' : ' is-off'), for: 'via-tier-' + k }, [input, el('span', { class: 'via-tier__body' }, cuerpo)]));
  }
  form.appendChild(tiers);
  // El botón vivía DEBAJO de los cuatro niveles y se quedaba fuera de pantalla:
  // Vianey no lo encontraba. Ahora va pegado al borde inferior mientras se
  // desliza el formulario, y lleva escrito lo que va a costar.
  btnGenTxt = el('span', { text: T('Generar clip', 'Generate clip') });
  const btnGen = el('button', { class: 'btn btn--primary via-generar', type: 'button', onclick: () => {
    const p = (promptEl.value || '').trim();
    if (p.length < 12) { toast(T('Describe la escena con un poco más de detalle.', 'Describe the scene in a bit more detail.'), { type: 'error' }); return; }
    generar(p, tierActual());
  } }, [icon('spark', 16), btnGenTxt]);
  form.appendChild(el('div', { class: 'via-generar-wrap' }, [btnGen]));
  rootEl.appendChild(form);
  refrescarPrecios();

  rootEl.appendChild(el('h2', { class: 'via-h2', text: cli ? `${T('Clips de', 'Clips for')} ${cli.name}` : T('Clips', 'Clips') }));
  listEl = el('div', { class: 'via-lista' }); rootEl.appendChild(listEl);
}

export default {
  id: VIEW_ID,
  async mount(host, c) {
    ctx = c; ensureCss();
    rootEl = el('div', { class: 'via-root' }); host.appendChild(rootEl);
    try { estado = await api.get('/video-ia/estado'); } catch (e) { toast(e.message, { type: 'error' }); }
    render(); await cargar(); programarSondeo();
    // Cambio de marca → recargar. Firma real del store: subscribe(keys, fn) -> unsub.
    unsub = ctx.store.subscribe(['activeClientId'], () => { if (rootEl) { render(); cargar(); } });
  },
  unmount() {
    if (unsub) { try { unsub(); } catch { /* noop */ } unsub = null; }
    clearInterval(timer); timer = null; rootEl = null; listEl = null; gastoEl = null; promptEl = null; notaEl = null;
    tierEls = {}; precioEls = {}; segundosRow = null; notaSegEl = null; btnGenTxt = null; autoSegundos = true; jobs = []; busy = false;
    fotos = { inicio: null, fin: null }; fotosRow = null; slots = {};
  },
};
