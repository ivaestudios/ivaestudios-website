// ============================================================================
// IVAE Marketing — CLIENT PORTAL (a warm, read-only window for one client).
//
// What a client can do here:
//   - Read a friendly welcome with their brand + a reassuring line.
//   - See a prominent, inviting "Por aprobar" section of posts awaiting them,
//     and approve / request changes right from the card (one tap).
//   - Browse their upcoming content as a vertical agenda feed grouped by date
//     (phone-first; far friendlier than a spreadsheet/grid on a phone).
//   - Open a post (read-only) in a centered modal: friendly date, platform,
//     caption (copy), script as Gancho / Desarrollo / Llamado a la acción,
//     hashtags (copy), plus a comment thread.
//   - Approve, request changes (required comment), or leave a comment.
//
// What a client can NEVER do: edit post content, see other clients, see internal
// notes (notes_team) or internal comments. The API enforces all of this and
// auto-scopes everything to this client's session; this file never sends a
// client_id. We additionally never build any edit UI and never render notes_team
// or any internal field, even if it somehow appeared in a payload.
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
  monthCursor: null, // Date pinned to the 1st of the visible month (for the feed)
  openPostId: null,  // id of the post shown in the modal (null = closed)
};

// ── Small inline icons (stroke = currentColor) ────────────────────────────────
const I = {
  check:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  copy:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
  prev:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>',
  next:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>',
  logout:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
  sparkle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/></svg>',
  calendar:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="17" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/></svg>',
  heart:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 5.6a5.5 5.5 0 0 0-7.8 0L12 6.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 22l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>',
};

const MONTHS = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

// "Pendiente de tu decisión" = pending OR changes (they still owe a decision).
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

  // Pin the feed to the earliest upcoming month with content (else this month).
  state.monthCursor = defaultMonth();

  applyAccent();
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
// BRAND ACCENT: applied to the whole portal as a SUBTLE tint. The primary
// action color stays the IVAE Marketing violet→pink gradient.
// ============================================================================
function accent() {
  const c = state.client && state.client.brand_color;
  if (!c) return null;
  const v = c[0] === '#' ? c : '#' + c;
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(v) ? v : null;
}
function applyAccent() {
  const acc = accent();
  if (!acc) return;
  const rgb = hexToRgb(acc);
  appEl.style.setProperty('--accent', acc);
  if (rgb) {
    appEl.style.setProperty('--accent-glow', `rgba(${rgb.r},${rgb.g},${rgb.b},.16)`);
    appEl.style.setProperty('--accent-shadow', `rgba(${rgb.r},${rgb.g},${rgb.b},.40)`);
  }
}
function hexToRgb(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length === 8) h = h.slice(0, 6);
  if (h.length !== 6) return null;
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

// ============================================================================
// RENDER: header + warm greeting + "Por aprobar" + agenda feed + footer.
// ============================================================================
function render() {
  clear(appEl);
  appEl.append(renderHeader(), renderMain());
}

function renderHeader() {
  const name = (state.client && state.client.name) || 'tu marca';
  const logoUrl = state.client && state.client.logo_url;

  const logo = el('div', { class: 'portal__logo' });
  if (logoUrl) {
    logo.append(el('img', { src: logoUrl, alt: name, loading: 'eager',
      onerror: function () { this.remove(); logo.textContent = initials(name); } }));
  } else {
    logo.textContent = initials(name);
  }

  return el('header', { class: 'portal__header' }, [
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
}

function renderMain() {
  const main = el('main', { class: 'portal__main' });
  const clientName = (state.client && state.client.name) || 'tu marca';

  // Warm welcome.
  main.append(el('section', { class: 'greet' }, [
    el('h1', {}, [
      'Hola ',
      el('span', { class: 'wave', 'aria-hidden': 'true' }, ['👋']),
      ', este es el contenido de ',
      el('span', { class: 'grad-text', text: clientName }),
      ' ✨',
    ]),
    el('p', { text: 'Aquí revisas y apruebas tu contenido con calma. Lee, copia lo que necesites y, cuando algo te encante, apruébalo. Si quieres ajustar algo, solo dinos. Cualquier duda, aquí estamos.' }),
  ]));

  // "Por aprobar" first, the priority.
  main.append(renderNeedsYou());

  // Upcoming content as a friendly agenda feed.
  main.append(renderFeed());

  // Reassuring footer.
  main.append(el('footer', { class: 'portal__foot' }, [
    el('span', {}, ['Tu contenido, cuidado por ']),
    el('span', { class: 'grad-text', text: 'IVAE Marketing' }),
    el('span', { text: '. Gracias por confiar en nosotros 💜' }),
  ]));

  return main;
}

// ── "Por aprobar" section ─────────────────────────────────────────────────────
function renderNeedsYou() {
  const pending = state.posts.filter(awaitingDecision)
    .sort((a, b) => (a.publish_date || '9999').localeCompare(b.publish_date || '9999'));

  const head = el('div', { class: 'p-section__head' }, [
    el('span', { class: 'ico', html: I.heart, 'aria-hidden': 'true' }),
    el('h2', { text: 'Por aprobar' }),
    pending.length ? el('span', { class: 'pill-count', text: String(pending.length), 'aria-label': `${pending.length} por aprobar` }) : null,
    el('span', { class: 'spacer' }),
  ]);

  let inner;
  if (!pending.length) {
    inner = el('div', { class: 'empty' }, [
      el('div', { class: 'empty__icon', html: I.check }),
      el('h3', { text: 'Todo aprobado, gracias 💜' }),
      el('p', { text: 'No tienes nada pendiente por ahora. Te avisaremos en cuanto haya contenido nuevo para ti.' }),
    ]);
  } else {
    inner = el('div', { class: 'approve-list' }, pending.map(approveCard));
  }

  return el('section', { class: 'p-section needs-you', id: 'needsYou' }, [head, inner]);
}

function approveCard(p) {
  const preview = (p.caption || p.hook || p.body || '').trim();

  const card = el('div', { class: 'pcard', 'data-id': p.id }, [
    el('div', { class: 'pcard__top' }, [
      chip(p.content_type),
      approvalBadge(p.approval_state),
      p.publish_date ? el('span', { class: 'pcard__date' }, [
        el('span', { class: 'ico', html: I.calendar, 'aria-hidden': 'true' }),
        el('span', { text: friendlyDate(p.publish_date) }),
      ]) : null,
    ]),
    el('div', { class: 'pcard__title', text: p.title || 'Contenido' }),
    preview
      ? el('p', { class: 'pcard__preview', text: preview })
      : el('p', { class: 'pcard__preview muted', text: 'Toca "Ver detalle" para conocer este contenido.' }),
  ]);

  // Inline actions: approving feels like one happy tap, no detour.
  const approveBtn = el('button', { class: 'btn btn-primary btn-lg', type: 'button' }, [
    el('span', { class: 'ico', html: I.check }),
    el('span', { text: 'Aprobar' }),
  ]);
  approveBtn.addEventListener('click', () => approveFromCard(p, card, approveBtn));

  const changesBtn = el('button', { class: 'btn btn-lg', type: 'button', text: 'Pedir cambios' });
  changesBtn.addEventListener('click', () => openPost(p.id, { focus: 'changes' }));

  card.append(el('div', { class: 'pcard__actions' }, [approveBtn, changesBtn]));

  // A quiet "see everything" affordance that opens the full read-only detail.
  const open = el('button', { class: 'pcard__open', type: 'button' }, [
    el('span', { text: 'Ver detalle' }),
    el('span', { class: 'ico', html: I.chevron, style: { width: '14px', height: '14px' }, 'aria-hidden': 'true' }),
  ]);
  open.addEventListener('click', () => openPost(p.id));
  card.append(open);

  return card;
}

// Approve straight from the "Por aprobar" card with a warm success state.
async function approveFromCard(p, card, btn) {
  btn.dataset.loading = 'true';
  try {
    await api.post('/posts/' + encodeURIComponent(p.id) + '/approve', {});
    syncApproval(p.id, 'approved');
    showCardApproved(card);
    toast('¡Gracias! Aprobaste este contenido 💜', 'success');
  } catch (err) {
    delete btn.dataset.loading;
    toast(err.message || 'No pudimos registrar tu aprobación.', 'error');
  }
}

// Swap a pending card for a celebratory "approved" state, then let it fade out.
function showCardApproved(card) {
  card.classList.add('is-done');
  clear(card);
  card.append(el('div', { class: 'done-banner' }, [
    el('span', { class: 'check' }, [el('span', { class: 'ico', html: I.check })]),
    el('span', { text: '¡Aprobado! Gracias por revisarlo.' }),
  ]));
  // After a moment, refresh the section so the count + list settle.
  setTimeout(refreshNeedsYou, 1500);
}

// ── Agenda feed (the friendly, phone-first calendar) ──────────────────────────
function renderFeed() {
  const cur = state.monthCursor;
  const monthLabel = `${capitalize(MONTHS[cur.getMonth()])} ${cur.getFullYear()}`;

  const head = el('div', { class: 'feed-head' }, [
    el('span', { class: 'ico', html: I.calendar, 'aria-hidden': 'true' }),
    el('h2', { text: 'Tu calendario' }),
    el('div', { class: 'feed-nav' }, [
      el('button', { class: 'feed-nav__btn', type: 'button', 'aria-label': 'Mes anterior', html: I.prev, onclick: () => shiftMonth(-1) }),
      el('span', { class: 'feed-month', id: 'feedMonth', text: monthLabel, 'aria-live': 'polite' }),
      el('button', { class: 'feed-nav__btn', type: 'button', 'aria-label': 'Mes siguiente', html: I.next, onclick: () => shiftMonth(1) }),
      el('button', { class: 'feed-today', type: 'button', text: 'Hoy', onclick: goToday }),
    ]),
  ]);

  return el('section', { class: 'p-section cal-feed', id: 'feed' }, [head, buildFeedBody(cur)]);
}

function buildFeedBody(cur) {
  const year = cur.getFullYear(), month = cur.getMonth();

  // Group this month's dated posts by day, in date order.
  const byDay = new Map();
  for (const p of state.posts) {
    if (!p.publish_date) continue;
    const d = parseDate(p.publish_date);
    if (!d || d.getFullYear() !== year || d.getMonth() !== month) continue;
    const key = String(p.publish_date).slice(0, 10);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(p);
  }
  for (const arr of byDay.values()) arr.sort((a, b) => (a.position || 0) - (b.position || 0));

  if (!byDay.size) {
    return el('div', { class: 'empty', style: { padding: 'var(--s-10) var(--s-4)' } }, [
      el('div', { class: 'empty__icon', html: I.calendar }),
      el('h3', { text: 'Sin contenido este mes' }),
      el('p', { text: 'Cuando tu equipo programe contenido para este mes, aparecerá aquí en orden por fecha.' }),
    ]);
  }

  const todayKey = ymd(new Date());
  const groups = el('div', { class: 'feed-groups' });
  for (const key of [...byDay.keys()].sort()) {
    const d = parseDate(key);
    const isToday = key === todayKey;
    const label = el('div', { class: 'feed-group__label' }, [
      el('span', { class: 'num', text: String(d.getDate()) }),
      el('span', { class: 'dow', text: fmtDate(key, { weekday: 'long' }) }),
      el('span', {}, [fmtDate(key, { month: 'long' })]),
      isToday ? el('span', { class: 'today-tag', text: 'Hoy' }) : null,
    ]);
    const items = byDay.get(key).map(feedItem);
    groups.append(el('div', { class: 'feed-group' + (isToday ? ' is-today' : '') }, [label, ...items]));
  }
  return groups;
}

function feedItem(p) {
  const color = (CONTENT_TYPES[p.content_type] && CONTENT_TYPES[p.content_type].color) || 'var(--brand)';
  const item = el('button', {
    class: 'feed-item', type: 'button', style: { '--c': color }, onclick: () => openPost(p.id),
  }, [
    el('div', { class: 'feed-item__body' }, [
      el('div', { class: 'feed-item__title truncate', text: p.title || contentTypeLabel(p.content_type) }),
      el('div', { class: 'feed-item__meta' }, [
        chip(p.content_type),
        awaitingDecision(p) ? approvalBadge(p.approval_state) : null,
      ]),
    ]),
    el('span', { class: 'feed-item__chev ico', html: I.chevron, 'aria-hidden': 'true' }),
  ]);
  return item;
}

// Pick a sensible starting month: earliest month that still has upcoming content,
// otherwise the current month.
function defaultMonth() {
  const today = startOfMonth(new Date());
  const future = state.posts
    .map((p) => parseDate(p.publish_date))
    .filter((d) => d && startOfMonth(d) >= today)
    .sort((a, b) => a - b);
  return future.length ? startOfMonth(future[0]) : today;
}

// Re-render only the feed section (keeps modal/header/approve intact) on change.
function rerenderFeed() {
  const old = appEl.querySelector('#feed');
  if (old) old.replaceWith(renderFeed());
}
function shiftMonth(delta) {
  state.monthCursor = startOfMonth(new Date(state.monthCursor.getFullYear(), state.monthCursor.getMonth() + delta, 1));
  rerenderFeed();
}
function goToday() {
  state.monthCursor = startOfMonth(new Date());
  rerenderFeed();
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
  setTimeout(onEnd, 320); // fallback if transitionend doesn't fire
}

async function openPost(id, opts = {}) {
  state.openPostId = id;
  modalTitle.textContent = 'Detalle';
  clear(modalBody);
  modalBody.append(el('div', { class: 'loading-state' }, [
    el('span', { class: 'spinner spinner--lg', 'aria-hidden': 'true' }),
    el('p', { text: 'Cargando...' }),
  ]));
  openModalShell();
  modalBody.scrollTop = 0;

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
  renderPostDetail(data, opts);
}

function renderPostDetail(data, opts = {}) {
  const post = data && data.post ? data.post : data;
  // Defensive: clients only ever see non-internal comments; filter again client-side.
  const comments = ((data && data.comments) || []).filter((c) => !c.internal);

  modalTitle.textContent = post.title || 'Contenido';
  clear(modalBody);

  // Hero: friendly date + platform + content type + current approval.
  const metaRow = el('div', { class: 'detail-meta' }, [
    chip(post.content_type),
    post.platform ? el('span', { class: 'tag', text: post.platform }) : null,
    el('span', { id: 'detailApproval' }, [approvalBadge(post.approval_state)]),
  ]);
  const dateRow = post.publish_date
    ? el('div', { class: 'detail-date' }, [
        el('span', { class: 'ico', html: I.calendar, 'aria-hidden': 'true' }),
        el('span', { text: capitalize(friendlyDate(post.publish_date)) }),
      ])
    : el('div', { class: 'detail-date muted' }, [
        el('span', { class: 'ico', html: I.calendar, 'aria-hidden': 'true' }),
        el('span', { text: 'Sin fecha programada todavía' }),
      ]);
  modalBody.append(el('div', { class: 'detail-hero' }, [dateRow, metaRow]));

  // Caption (with copy).
  modalBody.append(readBlock('Caption', post.caption, { copy: true }));

  // Script: Gancho / Desarrollo / Llamado a la acción.
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

  // If we were asked to jump straight to "pedir cambios", open that box.
  if (opts.focus === 'changes' && awaitingDecision(post)) {
    const decide = modalBody.querySelector('#decide');
    if (decide) showChangesBox(post, decide);
  }

  // NOTE: we intentionally never render post.notes_team or any internal field,
  // even if the payload somehow contained it.
}

function scriptPart(tag, text) {
  return el('div', { class: 'script-part' }, [
    el('div', { class: 'script-part__tag', text: tag }),
    el('div', { class: 'script-part__text', text }),
  ]);
}

function readBlock(label, value, { copy = false, klass = '' } = {}) {
  const has = !!(value && String(value).trim());
  const labelRow = el('div', { class: 'detail-block__label' }, [
    el('span', { text: label }),
    el('span', { class: 'spacer' }),
  ]);
  if (copy && has) labelRow.append(copyBtn(String(value)));
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
    el('span', { text: 'Tu decisión:' }),
    el('span', { id: 'decideBadge' }, [approvalBadge(post.approval_state)]),
  ]));

  // Already approved → just a warm confirmation, no buttons.
  if (post.approval_state === 'approved') {
    wrap.append(el('div', { class: 'thanks' }, [
      el('span', { class: 'check' }, [el('span', { class: 'ico', html: I.check })]),
      el('span', { text: 'Ya aprobaste este contenido. Gracias por revisarlo 💜' }),
    ]));
    return wrap;
  }

  const actions = el('div', { class: 'btn-row', id: 'decideActions' });

  const approveBtn = el('button', { class: 'btn btn-primary btn-lg', type: 'button' }, [
    el('span', { class: 'ico', html: I.check }),
    el('span', { text: 'Aprobar' }),
  ]);
  approveBtn.addEventListener('click', () => doApprove(post, approveBtn));

  const changesBtn = el('button', { class: 'btn btn-lg', type: 'button', text: 'Pedir cambios' });
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
    afterDecision(post, 'approved');
    toast('¡Gracias! Aprobaste este contenido 💜', 'success');
  } catch (err) {
    toast(err.message || 'No pudimos registrar tu aprobación.', 'error');
  } finally {
    delete btn.dataset.loading;
  }
}

function showChangesBox(post, wrap) {
  const slot = wrap.querySelector('#decideSlot');
  if (!slot) return;
  clear(slot);

  const ta = el('textarea', {
    class: 'textarea', id: 'changesText', rows: '3',
    placeholder: 'Cuéntanos qué te gustaría ajustar. Entre más claro, mejor 💬',
    'aria-label': 'Cambios solicitados',
  });
  const errEl = el('div', { class: 'field__error', id: 'changesErr', 'aria-live': 'polite' });

  const sendBtn = el('button', { class: 'btn btn-primary btn-lg', type: 'button', text: 'Enviar cambios' });
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
    ta.removeAttribute('aria-invalid');
    sendBtn.dataset.loading = 'true';
    try {
      await api.post('/posts/' + encodeURIComponent(post.id) + '/request-changes', { comment });
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

  slot.append(el('div', { class: 'field changes-box' }, [
    el('label', { class: 'label', for: 'changesText' }, ['¿Qué te gustaría cambiar? ', el('span', { class: 'req', text: '*' })]),
    ta,
    errEl,
    el('div', { class: 'btn-row' }, [sendBtn, cancelBtn]),
  ]));
  ta.focus();
}

// After approve / request-changes: update badges, swap action buttons for a thanks.
function afterDecision(post, newState) {
  syncApproval(post.id, newState);

  // Update the badge inside the modal (decision area + meta row).
  const decideBadge = modalBody.querySelector('#decideBadge');
  if (decideBadge) { clear(decideBadge); decideBadge.append(approvalBadge(newState)); }
  const metaBadge = modalBody.querySelector('#detailApproval');
  if (metaBadge) { clear(metaBadge); metaBadge.append(approvalBadge(newState)); }

  // Replace the action buttons with a warm thank-you confirmation.
  const actions = modalBody.querySelector('#decideActions');
  if (actions) actions.remove();
  const slot = modalBody.querySelector('#decideSlot');
  if (slot) {
    clear(slot);
    const msg = newState === 'approved'
      ? '¡Aprobado! Gracias por revisar tu contenido 💜'
      : 'Cambios solicitados. Tu equipo de IVAE Marketing ya fue notificado.';
    slot.append(el('div', { class: 'thanks' }, [
      el('span', { class: 'check' }, [el('span', { class: 'ico', html: I.check })]),
      el('span', { text: msg }),
    ]));
  }
}

// Keep state.posts in sync and refresh the sections underneath the modal.
function syncApproval(id, newState) {
  const p = state.posts.find((x) => x.id === id);
  if (p) p.approval_state = newState;
  refreshNeedsYou();
  rerenderFeed();
}

function refreshNeedsYou() {
  const old = appEl.querySelector('#needsYou');
  if (old) old.replaceWith(renderNeedsYou());
}

// ── Comment thread ────────────────────────────────────────────────────────────
function renderThread(comments) {
  const list = el('div', { class: 'thread', id: 'thread' },
    comments.length
      ? comments.map(commentNode)
      : [el('p', { class: 'comment-empty', text: 'Aún no hay comentarios. Si tienes dudas o ideas, escríbenos aquí, te leemos.' })]
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
  const placeholder = thread.querySelector('.comment-empty');
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

// "jueves 11 de junio" (no year, friendly). Caller capitalizes when needed.
function friendlyDate(ymdStr) {
  return fmtDate(ymdStr, { weekday: 'long', day: 'numeric', month: 'long' });
}
function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function capitalize(s = '') { return s ? s[0].toUpperCase() + s.slice(1) : s; }
