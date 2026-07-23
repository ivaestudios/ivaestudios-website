// ============================================================================
// IVAE Marketing v2 — Vista "Automatizaciones". Ruta: #/automatizaciones
//
// 8 recetas FIJAS estilo Monday ("cuando pase X, haz Y") como cards con
// switch. Cero builder generico. El catalogo de frases vive aqui y es ESPEJO
// del backend (const AUTOMATION_RECIPES en functions/api/marketing): las keys
// son identicas y la unica config editable es days_before (1|2) de
// recordatorio_publicacion.
//
// API real (catch-all v2):
//   GET   /automations                  -> [{recipe_key, enabled, config, updated_at}]
//   PATCH /automations/:recipe_key      {enabled?, config?} -> {automation}
//
// - Toggle y select: PATCH optimista con revert + toasts es-MX
//   ('Receta activada.' / 'Receta desactivada.' / 'Guardado.').
// - 404 (migracion 004 sin aplicar): empty state informativo con Reintentar;
//   el resto de la app sigue normal (degradacion limpia).
// - Mobile-first 390px: cards apiladas, switch con target de 44px, select
//   nativo de 44px. Sin hover-only affordances.
//
// NOTA: js/services/automations.js (services-domain) modela un builder
// generico de reglas que NO coincide con el backend desplegado; esta vista
// habla el contrato real del API directamente.
//
// Contrato de vista: export default { mount(el, ctx), unmount(), onParams() }.
// ============================================================================

import { api, el, clear, timeAgo } from '../api.js?v=202607221907';
import { icon } from '../shell/icons.js?v=202607221907';
import { T } from '../shell/i18n.js?v=202607221907';

// CSS del paquete (vive en css/mywork.css junto a la vista Mi trabajo).
// Lazy y con guard: si app.html ya lo linkea, no duplica.
function ensurePackageCss() {
  const has = [...document.querySelectorAll('link[rel="stylesheet"]')]
    .some((l) => (l.getAttribute('href') || '').includes('/marketing/css/mywork.css'));
  if (has) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/marketing/css/mywork.css?v=4';
  document.head.appendChild(link);
}

const ERR_SAVE = T('No se pudo guardar, intenta de nuevo.', "Couldn't save, try again.");

// Catalogo (orden curado; keys identicas al backend).
const RECIPES = [
  {
    key: 'aprobado_mueve_estado',
    ic: 'check',
    when: T('el cliente aprueba', 'the client approves'),
    then: T('mover el post a Aprobado y avisar al equipo', 'move the post to Approved and notify the team'),
    desc: T('El pipeline avanza solo en todas las vistas y el equipo se entera al momento.', 'The pipeline moves forward on its own in every view and the team knows right away.'),
  },
  {
    key: 'aviso_cambios',
    ic: 'edit',
    when: T('el cliente pide cambios', 'the client requests changes'),
    then: T('avisar al asignado y a los admins con su comentario', 'notify the assignee and admins with their comment'),
    desc: T('El aviso incluye el comentario del cliente para actuar sin abrir el portal.', "The alert includes the client's comment so you can act without opening the portal."),
  },
  {
    key: 'aviso_comentario',
    ic: 'send',
    when: T('el cliente comenta', 'the client comments'),
    then: T('avisar al equipo', 'notify the team'),
    desc: T('Ningun comentario del cliente se queda sin leer.', 'No client comment goes unread.'),
  },
  {
    key: 'aviso_asignacion',
    ic: 'user',
    when: T('te asignan un post', 'a post is assigned to you'),
    then: T('recibir un aviso', 'get an alert'),
    desc: T('Solo dispara cuando cambia el responsable. Nunca al autoasignarte.', 'Only fires when the assignee changes. Never when you self-assign.'),
  },
  {
    key: 'recordatorio_publicacion',
    ic: 'clock',
    when: T('falta poco para publicar', 'publish time is near'),
    then: T('avisar si el post no esta Programado ni Publicado', 'alert if the post is not Scheduled or Published'),
    desc: T('Un recordatorio por post por dia, al asignado y a los admins.', 'One reminder per post per day, to the assignee and admins.'),
    config: {
      field: 'days_before',
      label: T('Avisar con', 'Alert with'),
      options: [
        { value: 1, label: T('1 dia de anticipacion', '1 day in advance') },
        { value: 2, label: T('2 dias de anticipacion', '2 days in advance') },
      ],
    },
  },
  {
    key: 'marcar_atrasado',
    ic: 'warning',
    when: T('la fecha paso y el post sigue en Programado', 'the date passed and the post is still Scheduled'),
    then: T('marcarlo Atrasado y avisar', 'mark it Overdue and notify'),
    desc: T('El post se pinta con la etiqueta roja Atrasado y avisa una vez al dia.', 'The post gets the red Overdue label and alerts once a day.'),
  },
  {
    key: 'aviso_revision_cliente',
    ic: 'eye',
    when: T('un post entra a Revision', 'a post enters Review'),
    then: T('avisar que espera la decision del cliente', "alert that it awaits the client's decision"),
    desc: T('Para dar seguimiento cuando algo lleva dias esperando al cliente.', 'To follow up when something has been waiting on the client for days.'),
  },
  {
    key: 'alerta_sin_aprobar',
    ic: 'bell',
    when: T('llega la fecha sin aprobacion del cliente', 'the date arrives without client approval'),
    then: T('alertar al equipo', 'alert the team'),
    desc: T('Ultima linea de defensa antes de publicar sin visto bueno.', 'Last line of defense before publishing without sign-off.'),
  },
];

// ── Estado del modulo ────────────────────────────────────────────────────────
let ctx = null;
let mounted = false;
let rootEl = null;
let rows = null;                 // Map recipe_key -> {enabled, config, updated_at}
let phase = 'loading';           // 'loading' | 'ready' | 'unavailable' | 'error'
let errMsg = '';
const busy = new Set();          // keys con PATCH en vuelo (evita doble tap)
const refs = new Map();          // recipe_key -> {card, sw, select, meta}

// ── Datos ────────────────────────────────────────────────────────────────────

function normalizeRow(r) {
  let cfg = r && r.config;
  if (typeof cfg === 'string') { try { cfg = JSON.parse(cfg); } catch { cfg = {}; } }
  if (!cfg || typeof cfg !== 'object') cfg = {};
  return {
    enabled: r ? (r.enabled === true || Number(r.enabled) === 1) : false,
    config: cfg,
    updated_at: (r && r.updated_at) || null,
  };
}

async function load() {
  phase = 'loading';
  errMsg = '';
  render();
  try {
    const res = await api.get('/automations');
    const list = Array.isArray(res) ? res : [];
    rows = new Map();
    for (const r of list) {
      if (r && r.recipe_key) rows.set(r.recipe_key, normalizeRow(r));
    }
    phase = 'ready';
  } catch (e) {
    if (e && e.status === 404) {
      phase = 'unavailable';
    } else {
      phase = 'error';
      errMsg = (e && e.message) || T('No se pudo cargar.', "Couldn't load.");
    }
  }
  render();
}

function stateOf(key) {
  return (rows && rows.get(key)) || { enabled: false, config: {}, updated_at: null };
}

// ── Mutaciones (PATCH optimista + revert + toast) ────────────────────────────

async function patchRecipe(key, body, okMsg) {
  if (busy.has(key)) return;
  const toastFn = ctx ? ctx.toast : null;
  const prev = { ...stateOf(key), config: { ...stateOf(key).config } };

  // Optimista.
  const next = { ...prev, config: { ...prev.config } };
  if (Object.prototype.hasOwnProperty.call(body, 'enabled')) next.enabled = !!body.enabled;
  if (Object.prototype.hasOwnProperty.call(body, 'config')) next.config = { ...body.config };
  rows.set(key, next);
  patchCard(key);

  busy.add(key);
  try {
    const wire = { ...body };
    if (Object.prototype.hasOwnProperty.call(wire, 'enabled')) wire.enabled = wire.enabled ? 1 : 0;
    const res = await api.patch(`/automations/${encodeURIComponent(key)}`, wire);
    const a = res && res.automation;
    if (a && a.recipe_key) rows.set(key, normalizeRow(a));
    patchCard(key);
    if (okMsg && toastFn) toastFn(okMsg, { type: 'success' });
  } catch (e) {
    rows.set(key, prev);
    patchCard(key);
    if (toastFn) toastFn((e && e.message) || ERR_SAVE, { type: 'error' });
  } finally {
    busy.delete(key);
  }
}

function toggleRecipe(key) {
  const on = !stateOf(key).enabled;
  patchRecipe(key, { enabled: on }, on ? T('Receta activada.', 'Recipe turned on.') : T('Receta desactivada.', 'Recipe turned off.'));
}

function setDaysBefore(key, n) {
  patchRecipe(key, { config: { days_before: n } }, T('Guardado.', 'Saved.'));
}

// ── Render ───────────────────────────────────────────────────────────────────

function metaText(st) {
  return st.updated_at ? `${T('Editada', 'Edited')} ${timeAgo(st.updated_at)}` : '';
}

function patchCard(key) {
  const ref = refs.get(key);
  if (!ref) return;
  const st = stateOf(key);
  ref.sw.setAttribute('aria-checked', st.enabled ? 'true' : 'false');
  ref.sw.classList.toggle('is-on', st.enabled);
  ref.card.classList.toggle('is-off', !st.enabled);
  if (ref.select) {
    const v = Number(st.config && st.config.days_before) === 2 ? '2' : '1';
    if (ref.select.value !== v) ref.select.value = v;
    ref.select.disabled = !st.enabled;
  }
  ref.meta.textContent = metaText(st);
}

function renderCard(def) {
  const st = stateOf(def.key);

  const sw = el('button', {
    class: 'au-switch' + (st.enabled ? ' is-on' : ''),
    type: 'button', role: 'switch',
    'aria-checked': st.enabled ? 'true' : 'false',
    'aria-label': `${T('Receta: cuando', 'Recipe: when')} ${def.when}, ${def.then}`,
    onclick: () => toggleRecipe(def.key),
  }, [
    el('span', { class: 'au-switch__track' }, [el('span', { class: 'au-switch__thumb' })]),
  ]);

  const sentence = el('p', { class: 'au-card__sentence' }, [
    T('Cuando ', 'When '),
    el('span', { class: 'au-chip au-chip--when', text: def.when }),
    ', ',
    el('span', { class: 'au-chip au-chip--then', text: def.then }),
    '.',
  ]);

  const kids = [
    el('div', { class: 'au-card__top' }, [
      el('span', { class: 'au-card__icon' }, [icon(def.ic, 18)]),
      sentence,
      sw,
    ]),
    el('p', { class: 'au-card__desc', text: def.desc }),
  ];

  let select = null;
  if (def.config) {
    select = el('select', {
      class: 'au-select',
      'aria-label': T('Dias de anticipacion', 'Days in advance'),
      onchange: () => setDaysBefore(def.key, Number(select.value) === 2 ? 2 : 1),
    }, def.config.options.map((o) =>
      el('option', { value: String(o.value), text: o.label })
    ));
    select.value = Number(st.config && st.config.days_before) === 2 ? '2' : '1';
    select.disabled = !st.enabled;
    kids.push(el('div', { class: 'au-card__cfg' }, [
      el('label', { class: 'au-card__cfglabel', text: def.config.label }),
      select,
    ]));
  }

  const meta = el('p', { class: 'au-card__meta', text: metaText(st) });
  kids.push(meta);

  const card = el('article', {
    class: 'au-card' + (st.enabled ? '' : ' is-off'),
    dataset: { recipe: def.key },
  }, kids);

  refs.set(def.key, { card, sw, select, meta });
  return card;
}

function renderHead() {
  return el('header', { class: 'au-head' }, [
    el('div', { class: 'au-head__row' }, [
      el('span', { class: 'au-head__icon' }, [icon('zap', 22)]),
      el('div', {}, [
        el('h2', { class: 'au-head__title', text: T('Automatizaciones', 'Automations') }),
        el('p', { class: 'au-head__sub', text: T('8 recetas fijas que trabajan solas: cuando pasa X, hacen Y.', '8 fixed recipes that work on their own: when X happens, they do Y.') }),
      ]),
    ]),
  ]);
}

function render() {
  if (!rootEl) return;
  refs.clear();
  clear(rootEl);
  rootEl.appendChild(renderHead());

  if (phase === 'loading') {
    const skel = el('div', { class: 'au-list', 'aria-hidden': 'true' });
    for (let i = 0; i < 4; i++) {
      skel.appendChild(el('div', { class: 'au-skel' }, [
        el('div', { class: 'au-skel__bar au-skel__bar--wide' }),
        el('div', { class: 'au-skel__bar' }),
      ]));
    }
    rootEl.appendChild(skel);
    return;
  }

  if (phase === 'unavailable') {
    rootEl.appendChild(el('div', { class: 'au-empty' }, [
      el('div', { class: 'au-empty__icon' }, [icon('zap', 26)]),
      el('h3', { text: T('Aun no disponible', 'Not available yet') }),
      el('p', { class: 'muted', text: T('Las automatizaciones estaran disponibles cuando se aplique la migracion de base de datos. El resto de la app funciona normal.', 'Automations will be available once the database migration is applied. The rest of the app works normally.') }),
      el('button', { class: 'btn', type: 'button', text: T('Reintentar', 'Retry'), onclick: () => load() }),
    ]));
    return;
  }

  if (phase === 'error') {
    rootEl.appendChild(el('div', { class: 'au-empty' }, [
      el('div', { class: 'au-empty__icon au-empty__icon--err' }, [icon('warning', 26)]),
      el('h3', { text: T('No se pudieron cargar las recetas', "Couldn't load the recipes") }),
      el('p', { class: 'muted', text: errMsg || T('Revisa tu conexion e intenta de nuevo.', 'Check your connection and try again.') }),
      el('button', { class: 'btn btn-primary', type: 'button', text: T('Reintentar', 'Retry'), onclick: () => load() }),
    ]));
    return;
  }

  const list = el('div', { class: 'au-list' });
  for (const def of RECIPES) list.appendChild(renderCard(def));
  rootEl.appendChild(list);

  rootEl.appendChild(el('p', {
    class: 'au-foot',
    text: T('Las recetas corren solas cuando alguien guarda un cambio. Los avisos por fecha se revisan al abrir la app.', 'Recipes run on their own when someone saves a change. Date-based alerts are checked when the app opens.'),
  }));
}

// ── Contrato de vista ────────────────────────────────────────────────────────

export default {
  id: 'automatizaciones',

  mount(host, c) {
    ctx = c;
    mounted = true;
    ensurePackageCss();
    rootEl = el('div', { class: 'au-root' });
    host.appendChild(rootEl);
    load();
  },

  onParams() {
    if (mounted) render();
  },

  unmount() {
    mounted = false;
    rootEl = null;
    ctx = null;
    refs.clear();
  },
};
