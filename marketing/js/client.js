// ============================================================================
// IVAE Marketing — CLIENT PORTAL (read-only window for a single client).
//
// What a client can do here:
//   - See their scheduled content on a friendly month calendar (agenda on phone).
//   - See a prominent "Por aprobar" section of posts awaiting their decision.
//   - Open a post (read-only): caption, script (HOOK/BODY/CTA), hashtags, date.
//   - Approve, request changes (required comment), or leave a comment.
//
// What a client can NEVER do: edit post content, see other clients, see internal
// notes (notes_team) or internal comments. The API enforces all of this and
// auto-scopes everything to this client's session; this file never sends a
// client_id. We additionally never build any edit UI and never render notes_team
// or internal comments even if they somehow appeared in a payload.
// ============================================================================

import {
  api, el, clear, toast, copyText,
  parseDate, ymd, fmtDate, timeAgo, initials,
  CONTENT_TYPES,
  contentTypeLabel, chip, approvalBadge,
} from '/marketing/js/api.js';

// ── State ────────────────────────────────────────────────────────────────────
const state = {
  me: null,          // { id, email, name, role, client_id }
  client: null,      // the client's own client object
  posts: [],         // all client-visible posts (already scoped + stripped by API)
  monthCursor: null, // Date pinned to the 1st of the visible month
  openPostId: null,  // id of the post shown in the modal (null = closed)
};

// ── Small inline icons (stroke = currentColor) ────────────────────────────────
const I = {
  check:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  copy:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
  prev:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>',
  next:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>',
  logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
  sparkle:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/></svg>',
  calendar:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="17" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/></svg>',
};

const MONTHS = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const DOW = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom']; // week starts Monday

function firstName(name = '') { return (name.trim().split(/\s+/)[0]) || ''; }

// "Pendiente de tu decisión" = pending OR changes.
function awaitingDecision(p) { return p.approval_state === 'pending' || p.approval_state === 'changes'; }

// ── DOM refs (static shells in client.html) ───────────────────────────────────
const bootEl    = document.getElementById('boot');
const appEl     = document.getElementById('app');
const overlayEl = document.getElementById('overlay');
const modalEl   = document.getElementById('modal');
const modalTitle= document.getElementById('modalTitle');
const modalBody = document.getElementById('modalBody');
const modalClose= document.getElementById('modalClose');

// ============================================================================
// BOOT: auth-gate, then load the client + posts, then render.
// ============================================================================
init();

async function init() {
  // 1) Who am I? 401 → login; non-client → team app.
  let me;
  try {
    me = await api.get('/auth/me');
  } catch (err) {
    if (err.status === 401) { location.replace('/marketing/'); return; }
    bootFailed('No pudimos verificar tu sesión. Inténtalo de nuevo.');
    return;
  }
  if (!me || !me.role) { location.replace('/marketing/'); return; }
  if (me.role !== 'client') { location.replace('/marketing/app.html'); return; }
  state.me = me;

  // 2) Load the client's own profile + their posts in parallel.
  //    The API returns ONLY this client's object from /clients for a client role,
  //    and auto-scopes /posts. We never pass a client_id.
  try {
    const [clients, posts] = await Promise.all([
      api.get('/clients').catch(() => []),
      api.get('/posts'),
    ]);
    state.client = Array.isArray(clients) ? (clients[0] || null) : (clients || null);
    state.posts = Array.isArray(posts) ? posts : [];
  } catch (err) {
    bootFailed('No pudimos cargar tu contenido. Inténtalo de nuevo.');
    return;
  }

  state.monthCursor = startOfMonth(new Date());

  bootEl.classList.add('hidden');
  appEl.classList.remove('hidden');
  render();
  wireModal();
}

function bootFailed(msg) {
  clear(bootEl);
  bootEl.append(
    el('div', { class: 'empty' }, [
      el('div', { class: 'empty__icon', html: I.sparkle }),
      el('h3', { text: 'Algo salió mal' }),
      el('p', { text: msg }),
      el('button', { class: 'btn btn-primary', onclick: () => location.reload() }, ['Reintentar']),
    ])
  );
}

// ============================================================================
// RENDER: header + greeting + "Por aprobar" + calendar/agenda.
// ============================================================================
function render() {
  clear(appEl);
  appEl.append(renderHeader(), renderMain());
}

function accent() {
  const c = state.client && state.client.brand_color;
  return (c && /^#?[0-9a-fA-F]{3,8}$/.test(c)) ? (c[0] === '#' ? c : '#' + c) : null;
}

function renderHeader() {
  const name = (state.client && state.client.name) || 'tu marca';
  const logoUrl = state.client && state.client.logo_url;
  const acc = accent();

  const logo = el('div', { class: 'portal__logo' });
  if (logoUrl) {
    logo.append(el('img', { src: logoUrl, alt: name, loading: 'eager',
      onerror: function () { this.remove(); logo.textContent = initials(name); } }));
  } else {
    logo.textContent = initials(name);
  }

  const header = el('header', { class: 'portal__header' }, [
    el('span', { class: 'portal__brandline', 'aria-hidden': 'true' }),
    logo,
    el('div', { class: 'portal__id grow' }, [
      el('div', { class: 'portal__name truncate', text: name }),
      el('div', { class: 'portal__by' }, ['con ', el('span', { class: 'grad-text', text: 'IVAE Marketing' })]),
    ]),
    el('span', { class: 'portal__spacer' }),
    el('button', { class: 'btn btn-sm', type: 'button', onclick: logout }, [
      el('span', { class: 'ico', html: I.logout }),
      el('span', { text: 'Salir' }),
    ]),
  ]);

  // Apply the brand accent (header top-line + logo) when we have a valid color.
  if (acc) header.style.setProperty('--accent', acc);
  return header;
}

function renderMain() {
  const main = el('main', { class: 'portal__main' });

  // Greeting.
  const clientName = (state.client && state.client.name) || 'tu marca';
  main.append(el('section', { class: 'greet' }, [
    el('h1', {}, [
      'Hola, contenido de ',
      el('span', { class: 'grad-text', text: clientName }),
    ]),
    el('p', { text: 'Aquí ves tu calendario y todo lo que tu equipo de IVAE Marketing está preparando. Revisa, aprueba o pide cambios cuando quieras.' }),
  ]));

  // "Por aprobar" first — the priority section.
  main.append(renderNeedsYou());

  // Calendar (month grid) + agenda (mobile).
  main.append(renderCalendar());

  return main;
}

// ── "Por aprobar" section ─────────────────────────────────────────────────────
function renderNeedsYou() {
  const pending = state.posts.filter(awaitingDecision)
    .sort((a, b) => (a.publish_date || '9999').localeCompare(b.publish_date || '9999'));

  const head = el('div', { class: 'section-head' }, [
    el('h2', {}, ['Por aprobar']),
    pending.length ? el('span', { class: 'pill-count', text: String(pending.length) }) : null,
    el('span', { class: 'spacer' }),
  ]);

  let inner;
  if (!pending.length) {
    inner = el('div', { class: 'empty', style: { padding: 'var(--s-8) var(--s-5)' } }, [
      el('div', { class: 'empty__icon', html: I.check }),
      el('h3', { text: 'Todo al día' }),
      el('p', { text: 'No tienes nada pendiente de aprobar por ahora. Te avisaremos cuando haya contenido nuevo para ti.' }),
    ]);
  } else {
    inner = el('div', { class: 'approve-list' }, pending.map(approveCard));
  }

  return el('section', { class: 'needs-you', id: 'needsYou' }, [head, inner]);
}

function approveCard(p) {
  const preview = (p.caption || p.hook || p.body || '').trim();
  return el('button', {
    class: 'pcard', type: 'button',
    onclick: () => openPost(p.id),
  }, [
    el('div', { class: 'pcard__top' }, [
      chip(p.content_type),
      approvalBadge(p.approval_state),
      p.publish_date ? el('span', { class: 'pcard__date', text: fmtDate(p.publish_date, { weekday: 'short', day: 'numeric', month: 'short' }) }) : null,
    ]),
    el('div', { class: 'pcard__title', text: p.title || 'Contenido' }),
    preview ? el('div', { class: 'pcard__preview', text: preview }) : el('div', { class: 'pcard__preview muted', text: 'Toca para ver el detalle.' }),
  ]);
}

// ── Calendar (month grid) + agenda list ───────────────────────────────────────
function renderCalendar() {
  const cur = state.monthCursor;
  const monthLabel = `${capitalize(MONTHS[cur.getMonth()])} ${cur.getFullYear()}`;

  // Only scheduled, calendar-eligible posts.
  const scheduled = state.posts.filter((p) => !!p.publish_date);
  const byDay = new Map();
  for (const p of scheduled) {
    const key = String(p.publish_date).slice(0, 10);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(p);
  }
  for (const arr of byDay.values()) arr.sort((a, b) => (a.position || 0) - (b.position || 0));

  const head = el('div', { class: 'cal__head' }, [
    el('span', { class: 'ico', style: { width: '20px', height: '20px', color: 'var(--brand)' }, html: I.calendar }),
    el('h2', { class: 'cal__month', text: monthLabel, id: 'calMonth' }),
    el('span', { style: { flex: '1 1 auto' } }),
    el('button', { class: 'cal__nav-btn', type: 'button', 'aria-label': 'Mes anterior', html: I.prev, onclick: () => shiftMonth(-1) }),
    el('button', { class: 'cal__nav-btn', type: 'button', 'aria-label': 'Mes siguiente', html: I.next, onclick: () => shiftMonth(1) }),
    el('button', { class: 'btn btn-sm', type: 'button', text: 'Hoy', onclick: goToday }),
  ]);

  const grid = buildMonthGrid(cur, byDay);
  const agenda = buildAgenda(cur, byDay);

  return el('section', { class: 'cal' }, [
    el('div', { class: 'section-head', style: { marginBottom: 'var(--s-3)' } }, [head]),
    grid,
    agenda,
  ]);
}

function buildMonthGrid(cur, byDay) {
  const grid = el('div', { class: 'cal-grid', role: 'grid', 'aria-label': 'Calendario de contenido' });
  for (const d of DOW) grid.append(el('div', { class: 'cal-grid__dow', text: d }));

  const year = cur.getFullYear(), month = cur.getMonth();
  const first = new Date(year, month, 1);
  // Monday-first offset (JS getDay: 0=Sun..6=Sat → 0=Mon..6=Sun).
  const lead = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - lead);
  const todayKey = ymd(new Date());

  for (let i = 0; i < 42; i++) {
    const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const key = ymd(day);
    const isOther = day.getMonth() !== month;
    const isToday = key === todayKey;
    const posts = byDay.get(key) || [];

    const chips = el('div', { class: 'cal-day__chips' });
    for (const p of posts) {
      chips.append(el('button', {
        class: 'cal-chip', type: 'button', 'data-type': p.content_type,
        title: p.title || contentTypeLabel(p.content_type),
        onclick: () => openPost(p.id),
      }, [
        el('span', { class: 'cal-chip__txt', text: p.title || contentTypeLabel(p.content_type) }),
      ]));
    }

    grid.append(el('div', {
      class: 'cal-day' + (isOther ? ' is-other' : '') + (isToday ? ' is-today' : ''),
      role: 'gridcell',
    }, [
      el('div', { class: 'cal-day__num', text: String(day.getDate()) }),
      chips,
    ]));
  }
  return grid;
}

function buildAgenda(cur, byDay) {
  const agenda = el('div', { class: 'agenda', 'aria-label': 'Agenda del mes' });
  const year = cur.getFullYear(), month = cur.getMonth();

  // Days of THIS month that have posts, in date order.
  const days = [...byDay.keys()]
    .filter((k) => { const d = parseDate(k); return d && d.getFullYear() === year && d.getMonth() === month; })
    .sort();

  if (!days.length) {
    agenda.append(el('div', { class: 'empty', style: { padding: 'var(--s-8) var(--s-4)' } }, [
      el('div', { class: 'empty__icon', html: I.calendar }),
      el('h3', { text: 'Sin contenido este mes' }),
      el('p', { text: 'Cuando tu equipo programe contenido para este mes, aparecerá aquí.' }),
    ]));
    return agenda;
  }

  for (const key of days) {
    const items = el('div', { class: 'agenda__items' });
    for (const p of byDay.get(key)) {
      const color = (CONTENT_TYPES[p.content_type] && CONTENT_TYPES[p.content_type].color) || 'var(--brand)';
      items.append(el('button', {
        class: 'agenda-item', type: 'button', onclick: () => openPost(p.id),
      }, [
        el('span', { class: 'agenda-item__bar', style: { background: color } }),
        el('div', { class: 'agenda-item__body' }, [
          el('div', { class: 'agenda-item__title truncate', text: p.title || contentTypeLabel(p.content_type) }),
          el('div', { class: 'agenda-item__meta' }, [
            chip(p.content_type),
            awaitingDecision(p) ? approvalBadge(p.approval_state) : null,
          ]),
        ]),
      ]));
    }
    agenda.append(el('div', {}, [
      el('div', { class: 'agenda__day-label', text: fmtDate(key, { weekday: 'long', day: 'numeric', month: 'long' }) }),
      items,
    ]));
  }
  return agenda;
}

// Re-render only the calendar section (keeps modal/header intact) on month change.
function rerenderCalendar() {
  const old = appEl.querySelector('.cal');
  if (old) old.replaceWith(renderCalendar());
}
function shiftMonth(delta) {
  state.monthCursor = startOfMonth(new Date(state.monthCursor.getFullYear(), state.monthCursor.getMonth() + delta, 1));
  rerenderCalendar();
}
function goToday() {
  state.monthCursor = startOfMonth(new Date());
  rerenderCalendar();
}

// ============================================================================
// POST DETAIL MODAL (read-only) + approve / request-changes / comment.
// ============================================================================
function wireModal() {
  modalClose.addEventListener('click', closeModal);
  overlayEl.addEventListener('click', closeModal);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && state.openPostId) closeModal(); });
}

function openModalShell() {
  overlayEl.hidden = false; modalEl.hidden = false;
  // Force a reflow so the open transition runs.
  void modalEl.offsetWidth;
  overlayEl.classList.add('is-open');
  modalEl.classList.add('is-open');
  document.body.style.overflow = 'hidden';
}
function closeModal() {
  state.openPostId = null;
  overlayEl.classList.remove('is-open');
  modalEl.classList.remove('is-open');
  document.body.style.overflow = '';
  const onEnd = () => { overlayEl.hidden = true; modalEl.hidden = true; clear(modalBody); };
  modalEl.addEventListener('transitionend', onEnd, { once: true });
  setTimeout(onEnd, 300); // fallback if transitionend doesn't fire
}

async function openPost(id) {
  state.openPostId = id;
  modalTitle.textContent = 'Detalle';
  clear(modalBody);
  modalBody.append(el('div', { class: 'loading-state' }, [
    el('span', { class: 'spinner spinner--lg', 'aria-hidden': 'true' }),
    el('p', { text: 'Cargando...' }),
  ]));
  openModalShell();

  let data;
  try {
    data = await api.get('/posts/' + encodeURIComponent(id));
  } catch (err) {
    clear(modalBody);
    modalBody.append(el('div', { class: 'empty' }, [
      el('div', { class: 'empty__icon', html: I.sparkle }),
      el('h3', { text: 'No pudimos abrir este contenido' }),
      el('p', { text: err.message || 'Inténtalo de nuevo.' }),
    ]));
    return;
  }
  if (state.openPostId !== id) return; // user already closed/opened another
  renderPostDetail(data);
}

function renderPostDetail(data) {
  const post = data && data.post ? data.post : data;
  // Defensive: clients only ever see non-internal comments; filter again client-side.
  const comments = ((data && data.comments) || []).filter((c) => !c.internal);

  modalTitle.textContent = post.title || 'Contenido';
  clear(modalBody);

  // Meta row: scheduled date · platform · content_type · approval.
  const meta = el('div', { class: 'detail-meta' }, [
    chip(post.content_type),
    post.platform ? el('span', { class: 'tag', text: post.platform }) : null,
    post.publish_date ? el('span', { class: 'tag', text: '📅 ' + fmtDate(post.publish_date, { weekday: 'long', day: 'numeric', month: 'long' }) }) : el('span', { class: 'tag', text: 'Sin fecha aún' }),
    el('span', { class: 'detail-approval', id: 'detailApproval' }, [approvalBadge(post.approval_state)]),
  ]);
  modalBody.append(meta);

  // Caption (with copy).
  modalBody.append(readBlock('Caption', post.caption, { copy: true }));

  // Script: HOOK / BODY / CTA.
  if (post.hook || post.body || post.cta) {
    const box = el('div', { class: 'readbox' });
    if (post.hook) box.append(scriptPart('Gancho', post.hook));
    if (post.body) box.append(scriptPart('Desarrollo', post.body));
    if (post.cta)  box.append(scriptPart('Llamado a la acción', post.cta));
    modalBody.append(el('div', { class: 'detail-block' }, [
      el('div', { class: 'detail-block__label' }, ['Guion']),
      box,
    ]));
  }

  // Hashtags (with copy).
  if (post.hashtags) {
    modalBody.append(readBlock('Hashtags', post.hashtags, { copy: true, klass: 'hashtags' }));
  }

  // Decision area + comment thread.
  modalBody.append(renderDecision(post));
  modalBody.append(renderThread(comments));

  // NOTE: we intentionally never render post.notes_team or any internal field,
  // even if the payload somehow contained it.
}

function scriptPart(tag, text) {
  return el('div', { class: 'script-part' }, [
    el('div', { class: 'script-part__tag', text: tag }),
    el('div', { text }),
  ]);
}

function readBlock(label, value, { copy = false, klass = '' } = {}) {
  const has = !!(value && String(value).trim());
  const labelRow = el('div', { class: 'detail-block__label' }, [
    el('span', { text: label }),
    el('span', { class: 'spacer' }),
  ]);
  if (copy && has) {
    labelRow.append(copyBtn(String(value)));
  }
  return el('div', { class: 'detail-block' }, [
    labelRow,
    el('div', { class: 'readbox' + (has ? '' : ' is-empty') + (klass ? ' ' + klass : ''),
      text: has ? String(value) : 'Aún sin contenido.' }),
  ]);
}

function copyBtn(text) {
  const b = el('button', { class: 'btn-copy', type: 'button' }, [
    el('span', { class: 'ico', html: I.copy }),
    el('span', { text: 'Copiar' }),
  ]);
  b.addEventListener('click', async (e) => {
    e.stopPropagation();
    const ok = await copyText(text);
    toast(ok ? 'Copiado al portapapeles.' : 'No pudimos copiar.', ok ? 'success' : 'error', 1800);
  });
  return b;
}

// ── Decision (approve / request-changes) ──────────────────────────────────────
function renderDecision(post) {
  const wrap = el('div', { class: 'decide', id: 'decide' });

  wrap.append(el('div', { class: 'decide__status' }, [
    el('span', { text: 'Estado de tu aprobación:' }),
    el('span', { id: 'decideBadge' }, [approvalBadge(post.approval_state)]),
  ]));

  const actions = el('div', { class: 'btn-row', id: 'decideActions' });

  const approveBtn = el('button', { class: 'btn btn-primary', type: 'button' }, [
    el('span', { class: 'ico', html: I.check }),
    el('span', { text: 'Aprobar' }),
  ]);
  approveBtn.addEventListener('click', () => doApprove(post, approveBtn));

  const changesBtn = el('button', { class: 'btn', type: 'button', text: 'Pedir cambios' });
  changesBtn.addEventListener('click', () => showChangesBox(post, wrap));

  actions.append(approveBtn, changesBtn);
  wrap.append(actions);

  // Slot where the "thank you" / changes box is injected.
  wrap.append(el('div', { id: 'decideSlot' }));
  return wrap;
}

async function doApprove(post, btn) {
  btn.dataset.loading = 'true';
  try {
    await api.post('/posts/' + encodeURIComponent(post.id) + '/approve', {});
    post.approval_state = 'approved';
    afterDecision(post, 'approved');
    toast('¡Gracias! Aprobaste este contenido.', 'success');
  } catch (err) {
    toast(err.message || 'No pudimos registrar tu aprobación.', 'error');
  } finally {
    delete btn.dataset.loading;
  }
}

function showChangesBox(post, wrap) {
  const slot = wrap.querySelector('#decideSlot');
  clear(slot);

  const ta = el('textarea', {
    class: 'textarea', id: 'changesText', rows: '3',
    placeholder: 'Cuéntanos qué te gustaría ajustar. Entre más claro, mejor.',
    'aria-label': 'Cambios solicitados',
  });
  const errEl = el('div', { class: 'field__error', id: 'changesErr' });

  const sendBtn = el('button', { class: 'btn btn-primary', type: 'button', text: 'Enviar cambios' });
  const cancelBtn = el('button', { class: 'btn btn-ghost', type: 'button', text: 'Cancelar', onclick: () => clear(slot) });

  sendBtn.addEventListener('click', async () => {
    const comment = ta.value.trim();
    if (!comment) {
      errEl.textContent = 'Escribe qué cambios necesitas para poder avisar al equipo.';
      ta.setAttribute('aria-invalid', 'true');
      ta.focus();
      return;
    }
    errEl.textContent = '';
    sendBtn.dataset.loading = 'true';
    try {
      await api.post('/posts/' + encodeURIComponent(post.id) + '/request-changes', { comment });
      post.approval_state = 'changes';
      afterDecision(post, 'changes');
      // Reflect the new comment in the thread immediately.
      appendCommentToThread({
        author_name: state.me.name, author_role: 'client',
        body: comment, created_at: new Date().toISOString(), internal: 0, _mine: true,
      });
      toast('¡Listo! Le pedimos los cambios a tu equipo.', 'success');
    } catch (err) {
      toast(err.message || 'No pudimos enviar tu solicitud.', 'error');
    } finally {
      delete sendBtn.dataset.loading;
    }
  });

  slot.append(el('div', { class: 'field', style: { marginTop: 'var(--s-3)' } }, [
    el('label', { class: 'label', for: 'changesText' }, ['¿Qué te gustaría cambiar? ', el('span', { class: 'req', text: '*' })]),
    ta,
    errEl,
    el('div', { class: 'btn-row' }, [sendBtn, cancelBtn]),
  ]));
  ta.focus();
}

// After approve / request-changes: update badges, swap action buttons.
function afterDecision(post, newState) {
  // Update the badge inside the modal (decision area + meta row).
  const decideBadge = modalBody.querySelector('#decideBadge');
  if (decideBadge) { clear(decideBadge); decideBadge.append(approvalBadge(newState)); }
  const metaBadge = modalBody.querySelector('#detailApproval');
  if (metaBadge) { clear(metaBadge); metaBadge.append(approvalBadge(newState)); }

  // Replace the action buttons with a thank-you confirmation.
  const slot = modalBody.querySelector('#decideSlot');
  const actions = modalBody.querySelector('#decideActions');
  if (actions) actions.remove();
  if (slot) {
    clear(slot);
    const msg = newState === 'approved'
      ? 'Aprobado. Gracias por revisar tu contenido.'
      : 'Cambios solicitados. Tu equipo de IVAE Marketing ya fue notificado.';
    slot.append(el('div', { class: 'thanks' }, [
      el('span', { class: 'ico', html: I.check }),
      el('span', { text: msg }),
    ]));
  }

  // Keep state.posts in sync and refresh the "Por aprobar" section underneath.
  const p = state.posts.find((x) => x.id === post.id);
  if (p) p.approval_state = newState;
  refreshNeedsYou();
}

function refreshNeedsYou() {
  const old = appEl.querySelector('#needsYou');
  if (old) old.replaceWith(renderNeedsYou());
}

// ── Comment thread ────────────────────────────────────────────────────────────
function renderThread(comments) {
  const list = el('div', { class: 'thread', id: 'thread' },
    comments.length ? comments.map(commentNode) : [el('p', { class: 'muted', style: { fontSize: '13.5px' }, text: 'Aún no hay comentarios. Si tienes dudas, escríbenos aquí.' })]
  );

  const ta = el('textarea', {
    class: 'textarea', id: 'commentText', rows: '2',
    placeholder: 'Escribe un comentario para tu equipo...', 'aria-label': 'Nuevo comentario',
  });
  const sendBtn = el('button', { class: 'btn btn-primary', type: 'button', text: 'Comentar' });
  sendBtn.addEventListener('click', () => submitComment(ta, sendBtn));

  return el('div', { class: 'detail-block', style: { marginTop: 'var(--s-6)', marginBottom: '0' } }, [
    el('div', { class: 'detail-block__label' }, ['Comentarios']),
    list,
    el('div', { class: 'comment-form' }, [
      ta,
      el('div', { class: 'btn-row', style: { marginTop: 'var(--s-2)', justifyContent: 'flex-end' } }, [sendBtn]),
    ]),
  ]);
}

function commentNode(c) {
  const mine = c._mine || (c.author_role === 'client');
  return el('div', { class: 'comment' + (mine ? ' is-mine' : '') }, [
    el('span', { class: 'avatar avatar--sm', title: c.author_name || '', text: initials(c.author_name || '?') }),
    el('div', { class: 'comment__body' }, [
      el('div', { class: 'comment__meta' }, [
        el('span', { class: 'comment__author', text: c.author_name || (mine ? 'Tú' : 'Equipo') }),
        el('span', { class: 'comment__time', text: timeAgo(c.created_at) }),
      ]),
      el('div', { class: 'comment__bubble', text: c.body || '' }),
    ]),
  ]);
}

function appendCommentToThread(c) {
  const thread = modalBody.querySelector('#thread');
  if (!thread) return;
  // Drop the "no comments yet" placeholder if present.
  const placeholder = thread.querySelector('p.muted');
  if (placeholder) placeholder.remove();
  thread.append(commentNode(c));
}

async function submitComment(ta, btn) {
  const body = ta.value.trim();
  if (!body) { ta.focus(); return; }
  btn.dataset.loading = 'true';
  try {
    // Clients never set internal; the API enforces it too.
    await api.post('/posts/' + encodeURIComponent(state.openPostId) + '/comments', { body });
    appendCommentToThread({
      author_name: state.me.name, author_role: 'client',
      body, created_at: new Date().toISOString(), internal: 0, _mine: true,
    });
    ta.value = '';
    toast('Comentario enviado.', 'success', 1800);
  } catch (err) {
    toast(err.message || 'No pudimos enviar tu comentario.', 'error');
  } finally {
    delete btn.dataset.loading;
  }
}

// ============================================================================
// Misc
// ============================================================================
async function logout() {
  try { await api.post('/auth/logout', {}); } catch { /* ignore */ }
  location.replace('/marketing/');
}

function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function capitalize(s = '') { return s ? s[0].toUpperCase() + s.slice(1) : s; }
