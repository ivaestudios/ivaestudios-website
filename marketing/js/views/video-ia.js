// ============================================================================
// IVAE Marketing — Vista "Video IA" (generador de clips con IA; SOLO staff).
//
// Eliges la marca (la activa), describes la escena o dejas que Claude la
// proponga desde una pieza del calendario, eliges la calidad (con su precio a
// la vista) y generas. El clip tarda 1-3 minutos; la vista sondea cada 6 s y
// lo muestra en cuanto está. Todo el gasto queda anotado por marca.
// ============================================================================
import { api, el, clear, toast } from '../api.js?v=202609072218';
import { icon } from '../shell/icons.js?v=202609072218';
import { T } from '../shell/i18n.js?v=202609072218';

const VIEW_ID = 'video-ia';
const MXN = 20; // tipo de cambio aproximado, solo para orientar

let rootEl = null, ctx = null, listEl = null, gastoEl = null, promptEl = null, notaEl = null, tierEls = {};
let estado = { configurado: false, catalogo: {} };
let jobs = [];
let timer = null;
let busy = false;
let unsub = null;

const usdTxt = (u) => `$${u.toFixed(2)} USD · ≈ ${Math.round(u * MXN)} pesos`;
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

function ensureCss() {
  const has = [...document.querySelectorAll('link[rel="stylesheet"]')].some((l) => (l.getAttribute('href') || '').includes('/marketing/css/video-ia.css'));
  if (has) return;
  const link = document.createElement('link'); link.rel = 'stylesheet';
  link.href = '/marketing/css/video-ia.css?v=202609072218'; document.head.appendChild(link);
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

function pintarGasto(g) {
  if (!gastoEl) return;
  clear(gastoEl);
  const cli = clienteActivo();
  if (!g) return;
  gastoEl.appendChild(el('span', { text: `${cli ? cli.name : ''} · ${T('este mes', 'this month')}: ` }));
  gastoEl.appendChild(el('strong', { text: `${g.clips} ${T('clips', 'clips')} · ${usdTxt(g.usd || 0)}` }));
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
    el('span', { class: 'via-chip via-chip--mute', text: usdTxt(Number(j.cost_usd || 0)) }),
  ]);
  const prompt = el('p', { class: 'via-card__prompt', text: j.prompt });
  const acciones = el('div', { class: 'via-card__acciones' });
  if (j.status === 'done') {
    acciones.appendChild(el('a', { class: 'btn btn--ghost', href: j.video_url, download: `video-ia-${j.id.slice(0, 8)}.mp4` }, [icon('download', 15), el('span', { text: T('Descargar', 'Download') })]));
  }
  acciones.appendChild(el('button', { class: 'btn btn--ghost', type: 'button', onclick: () => generar(j.prompt, j.tier) }, [icon('spark', 15), el('span', { text: T('Otro intento', 'Try again') })]));
  acciones.appendChild(el('button', { class: 'btn btn--ghost via-borrar', type: 'button', 'aria-label': T('Borrar', 'Delete'), onclick: async () => {
    try { await api.del(`/video-ia/jobs/${j.id}`); jobs = jobs.filter((x) => x.id !== j.id); pintarLista(); } catch (e) { toast(e.message, { type: 'error' }); }
  } }, [icon('trash', 15)]));
  card.append(media, meta, prompt, acciones);
  return card;
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

async function generar(prompt, tier) {
  const cli = clienteActivo();
  if (!cli) { toast(T('Elige una marca primero.', 'Pick a brand first.'), { type: 'error' }); return; }
  if (!estado.configurado) { toast(T('Falta la llave de fal.ai. Ve el aviso de arriba.', 'fal.ai key missing. See the notice above.'), { type: 'error' }); return; }
  if (busy) return;
  busy = true; rootEl.classList.add('is-busy');
  try {
    const r = await api.post('/video-ia/jobs', { client_id: cli.id, tier, prompt, aspect: '9:16' }, { timeout: 45000 });
    jobs = [r.job, ...jobs]; pintarLista(); programarSondeo();
    toast(T('Clip en camino. Te aviso cuando esté.', 'Clip on its way.'), { type: 'ok' });
  } catch (e) { toast(e.message, { type: 'error' }); }
  finally { busy = false; rootEl.classList.remove('is-busy'); }
}

function tierActual() { return Object.keys(tierEls).find((k) => tierEls[k].checked) || 'rapido'; }

async function proponer(sel) {
  const p = piezasDelMes().find((x) => x.id === sel.value);
  if (!p) { toast(T('Elige una pieza del calendario.', 'Pick a piece from the calendar.'), { type: 'error' }); return; }
  const cli = clienteActivo();
  promptEl.disabled = true; notaEl.textContent = T('Claude está pensando la escena…', 'Claude is thinking the scene…');
  try {
    const r = await api.post('/video-ia/escena', { hook: p.hook || p.title, guion: p.body || '', marca: cli ? cli.name : '', tier: tierActual() }, { timeout: 40000 });
    promptEl.value = r.prompt_en; notaEl.textContent = r.nota_es || '';
  } catch (e) { notaEl.textContent = ''; toast(e.message, { type: 'error' }); }
  finally { promptEl.disabled = false; }
}

function render() {
  clear(rootEl);
  const cli = clienteActivo();
  rootEl.appendChild(el('header', { class: 'via-head' }, [
    el('h1', { class: 'via-title', text: T('Video con IA', 'AI video') }),
    el('p', { class: 'via-sub', text: T('Describe la escena, elige la calidad y genera. Cada clip queda anotado con su costo por marca.', 'Describe the scene, pick the quality and generate. Every clip is logged with its cost per brand.') }),
  ]));
  if (!estado.configurado) {
    rootEl.appendChild(el('div', { class: 'via-aviso' }, [
      el('strong', { text: T('Falta la llave de fal.ai', 'fal.ai key missing') }),
      el('p', { text: T('Para generar hay que cargar saldo en fal.ai (desde 5 USD, sin membresía) y guardar la llave como FAL_KEY en Cloudflare Pages. En cuanto esté, este aviso desaparece.', 'Load balance at fal.ai (from 5 USD, no membership) and store the key as FAL_KEY in Cloudflare Pages.') }),
    ]));
  }
  gastoEl = el('div', { class: 'via-gasto' }); rootEl.appendChild(gastoEl);

  // ── Formulario ──
  const form = el('section', { class: 'via-form' });
  const piezas = piezasDelMes();
  const sel = el('select', { class: 'via-select' }, [el('option', { value: '', text: T('Tomar la escena de una pieza del calendario…', 'Take the scene from a calendar piece…') }),
    ...piezas.map((p) => el('option', { value: p.id, text: `${String(p.publish_date || '').slice(5)} · ${p.title || ''}` }))]);
  const btnProp = el('button', { class: 'btn btn--ghost', type: 'button', onclick: () => proponer(sel) }, [icon('spark', 15), el('span', { text: T('Proponer escena', 'Suggest scene') })]);
  form.appendChild(el('div', { class: 'via-row' }, [sel, btnProp]));
  promptEl = el('textarea', { class: 'via-prompt', rows: 5, placeholder: T('Ej. A 60-year-old man sits calmly in a bright clinic chair, IV pole softly out of focus behind him, warm morning light, slow push-in, beige and green palette. (En inglés sale mejor.)', 'e.g. A 60-year-old man sits calmly in a bright clinic chair…') });
  form.appendChild(promptEl);
  notaEl = el('p', { class: 'via-nota' }); form.appendChild(notaEl);

  const tiers = el('div', { class: 'via-tiers', role: 'radiogroup' });
  tierEls = {};
  for (const [k, c] of Object.entries(estado.catalogo)) {
    const input = el('input', { type: 'radio', name: 'via-tier', value: k, id: 'via-tier-' + k });
    if (k === 'rapido') input.checked = true;
    tierEls[k] = input;
    tiers.appendChild(el('label', { class: 'via-tier', for: 'via-tier-' + k }, [input,
      el('span', { class: 'via-tier__body' }, [
        el('strong', { text: `${c.label} · ${c.modelo}` }),
        el('span', { class: 'via-tier__sub', text: c.sub }),
        el('span', { class: 'via-tier__precio', text: `${c.seconds} s · ${usdTxt(c.usd)}` }),
      ])]));
  }
  form.appendChild(tiers);
  const btnGen = el('button', { class: 'btn btn--primary via-generar', type: 'button', onclick: () => {
    const p = (promptEl.value || '').trim();
    if (p.length < 12) { toast(T('Describe la escena con un poco más de detalle.', 'Describe the scene in a bit more detail.'), { type: 'error' }); return; }
    generar(p, tierActual());
  } }, [icon('spark', 16), el('span', { text: T('Generar clip', 'Generate clip') })]);
  form.appendChild(btnGen);
  rootEl.appendChild(form);

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
    clearInterval(timer); timer = null; rootEl = null; listEl = null; gastoEl = null; promptEl = null; notaEl = null; jobs = []; busy = false;
  },
};
