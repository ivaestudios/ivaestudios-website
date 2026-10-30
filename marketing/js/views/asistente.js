// ============================================================================
// IVAE Marketing — Vista "Asistente": chat de IA para el CLIENTE (piloto).
//
// Pedido de Israel (30-oct-2026): que la IA también atienda a los clientes de
// marketing cuando el equipo no está. El cliente pregunta por SU marca (qué se
// publica, qué debe aprobar, entregables, cómo va su Instagram) y, si hace
// falta una persona, el asistente deja una SOLICITUD que le llega al equipo.
//
// Backend: functions/api/marketing/_asistente.js (la marca sale de la sesión;
// esta vista solo pinta). Se enciende marca por marca: para el STAFF aparece
// siempre (prueba y encendido), para el cliente solo si su marca lo tiene.
// ============================================================================
import { el, clear, api, toast, isClientRole, timeAgo } from '../api.js?v=202610270229';
import { T } from '../shell/i18n.js?v=202610270229';
import { icon } from '../shell/icons.js?v=202610270229';

const VIEW_ID = 'asistente';

let ctx = null;
let rootEl = null;
let unsubs = [];
let hiloEl = null;
let barraEl = null;
let inputEl = null;
let enviarBtn = null;
let chipsEl = null;
let staffEl = null;
let marcaId = null;
let enviando = false;
let estadoActual = null;

function st() { return ctx.store.getState(); }

// La marca: el cliente trae la suya en `me`; el staff, la del selector.
function marcaActiva() {
  const s = st();
  if (isClientRole()) return (s.me || {}).client_id || null;
  const id = s.activeClientId;
  return (id && id !== 'todos') ? id : null;
}
function nombreMarca(id) {
  const c = (st().clients || []).find((x) => x.id === id);
  return c ? c.name : (estadoActual && estadoActual.marca ? estadoActual.marca.name : T('tu marca', 'your brand'));
}
function q(id) { return isClientRole() ? '' : `?client_id=${encodeURIComponent(id)}`; }

// ── Pintado ─────────────────────────────────────────────────────────────────
function cabecera() {
  return el('div', { class: 'asis-cab' }, [
    el('div', { class: 'asis-cab__ico' }, [icon('sparkles', 22)]),
    el('div', {}, [
      el('h2', { class: 'asis-cab__tit', text: T('Asistente de IVAE Marketing', 'IVAE Marketing assistant') }),
      el('p', { class: 'asis-cab__sub', text: marcaId ? nombreMarca(marcaId) : T('Elige una marca arriba', 'Pick a brand above') }),
    ]),
  ]);
}

function burbuja(rol, texto, extra) {
  const b = el('div', { class: `asis-msg asis-msg--${rol}` });
  b.appendChild(document.createTextNode(String(texto || '')));
  if (extra && extra.folio) b.appendChild(el('div', { class: 'asis-msg__folio', text: `${T('Folio', 'Ticket')} ${extra.folio}` }));
  if (extra && extra.hora) b.appendChild(el('div', { class: 'asis-hora', text: extra.hora }));
  return b;
}

function pintarHilo(historial) {
  clear(hiloEl);
  if (!historial || !historial.length) {
    hiloEl.appendChild(burbuja('ia', T(
      `Hola, soy el asistente de IVAE Marketing para ${nombreMarca(marcaId)}. Puedo decirte qué se publica, qué tienes pendiente de aprobar, tus entregables y cómo va tu Instagram. Si necesitas algo del equipo, lo registro y les aviso.`,
      `Hi, I'm the IVAE Marketing assistant for ${nombreMarca(marcaId)}. I can tell you what gets published, what is pending your approval, your deliverables and how your Instagram is doing. If you need the team, I'll log it and let them know.`
    )));
    return;
  }
  for (const m of historial) {
    hiloEl.appendChild(burbuja(m.rol === 'usuario' ? 'yo' : 'ia', m.texto, { hora: m.created_at ? timeAgo(m.created_at.replace(' ', 'T') + 'Z') : null }));
  }
  bajar();
}

function bajar() {
  requestAnimationFrame(() => {
    const y = hiloEl.getBoundingClientRect().bottom + window.scrollY + 160;
    window.scrollTo({ top: y, behavior: 'smooth' });
  });
}

function pintarChips(lista) {
  clear(chipsEl);
  for (const s of (lista || [])) {
    chipsEl.appendChild(el('button', { type: 'button', class: 'asis-chip', text: s, onclick: () => { inputEl.value = s; enviar(); } }));
  }
}

function pintarApagado() {
  clear(hiloEl); clear(chipsEl);
  barraEl.hidden = true;
  hiloEl.appendChild(el('div', { class: 'asis-off' }, [
    icon('clock', 32),
    el('h3', { text: T('Tu asistente todavía no está activo', 'Your assistant is not active yet') }),
    el('p', { text: T('El equipo de IVAE Marketing lo activará para tu marca. Mientras tanto, escríbenos por WhatsApp.', 'The IVAE Marketing team will turn it on for your brand. In the meantime, message us on WhatsApp.') }),
  ]));
}

// Panel del equipo: interruptor por marca + solicitudes abiertas.
async function pintarStaff() {
  if (isClientRole() || !staffEl) return;
  clear(staffEl);
  staffEl.hidden = !marcaId;
  if (!marcaId) return;
  const me = st().me || {};
  const activo = !!(estadoActual && estadoActual.activo);
  const sw = el('button', {
    type: 'button', class: 'asis-sw', role: 'switch', 'aria-checked': activo ? 'true' : 'false',
    'aria-label': T('Asistente activo para esta marca', 'Assistant on for this brand'),
    onclick: async () => {
      if (me.role !== 'admin') { toast(T('Solo una administradora puede encenderlo.', 'Only an admin can turn it on.'), { type: 'info' }); return; }
      sw.disabled = true;
      try {
        const r = await api.post('/asistente/activar', { client_id: marcaId, activo: !activo });
        estadoActual.activo = r.activo;
        toast(r.activo ? T('Asistente encendido para esta marca.', 'Assistant on for this brand.') : T('Asistente apagado para esta marca.', 'Assistant off for this brand.'), { type: 'success' });
        await pintarStaff();
      } catch (e) { toast((e && e.data && e.data.error) || T('No se pudo cambiar.', 'Could not change it.'), { type: 'error' }); }
      finally { sw.disabled = false; }
    },
  });
  staffEl.appendChild(el('div', { class: 'asis-staff__row' }, [
    el('div', {}, [
      el('strong', { text: T('Asistente activo para esta marca', 'Assistant on for this brand') }),
      el('div', { class: 'asis-sol__meta', text: activo ? T('El cliente ya lo ve en su app.', 'The client can see it in the app.') : T('Apagado: solo el equipo puede probarlo aquí.', 'Off: only the team can test it here.') }),
    ]),
    sw,
  ]));
  let sols = [];
  try { sols = (await api.get(`/asistente/solicitudes?client_id=${encodeURIComponent(marcaId)}&estado=todas`)).solicitudes || []; } catch { sols = []; }
  const abiertas = sols.filter((s) => s.estado === 'abierta');
  const fila = el('div', { class: 'asis-staff__row' }, [
    el('strong', { text: `${T('Solicitudes del cliente', 'Client requests')} · ${abiertas.length} ${T('abiertas', 'open')}` }),
  ]);
  staffEl.appendChild(fila);
  if (sols.length) {
    const lista = el('div', { class: 'asis-sol' });
    for (const s of sols.slice(0, 20)) {
      const item = el('div', { class: `asis-sol__item${s.estado === 'atendida' ? ' is-atendida' : ''}` }, [
        el('div', {}, [
          el('div', { class: 'asis-sol__meta', text: `${s.folio} · ${s.tipo} · ${s.user_nombre || ''} · ${timeAgo(String(s.created_at).replace(' ', 'T') + 'Z')}` }),
          el('p', { class: 'asis-sol__txt', text: s.texto }),
        ]),
        el('button', {
          type: 'button', class: 'btn btn-sm ' + (s.estado === 'abierta' ? 'btn-primary' : 'btn-ghost'),
          text: s.estado === 'abierta' ? T('Atendida', 'Done') : T('Reabrir', 'Reopen'),
          onclick: async (ev) => {
            ev.currentTarget.disabled = true;
            try { await api.post('/asistente/solicitud-estado', { id: s.id, estado: s.estado === 'abierta' ? 'atendida' : 'abierta' }); await pintarStaff(); }
            catch { toast(T('No se pudo actualizar.', 'Could not update.'), { type: 'error' }); }
          },
        }),
      ]);
      lista.appendChild(item);
    }
    staffEl.appendChild(lista);
  }
}

// ── Datos ───────────────────────────────────────────────────────────────────
async function cargar() {
  marcaId = marcaActiva();
  rootEl.querySelector('.asis-cab').replaceWith(cabecera());
  if (!marcaId) {
    clear(hiloEl); clear(chipsEl); barraEl.hidden = true;
    hiloEl.appendChild(el('div', { class: 'empty' }, [el('p', { text: T('Elige una marca en el selector para probar su asistente.', 'Pick a brand in the switcher to try its assistant.') })]));
    if (staffEl) staffEl.hidden = true;
    return;
  }
  try {
    estadoActual = await api.get(`/asistente/estado${q(marcaId)}`);
  } catch (e) {
    estadoActual = null;
    clear(hiloEl);
    hiloEl.appendChild(burbuja('sys', (e && e.data && e.data.error) || T('No se pudo cargar el asistente.', 'Could not load the assistant.')));
    return;
  }
  await pintarStaff();
  if (isClientRole() && !estadoActual.activo) { pintarApagado(); return; }
  barraEl.hidden = false;
  pintarHilo(estadoActual.historial);
  pintarChips(estadoActual.sugerencias);
}

async function enviar() {
  const texto = String(inputEl.value || '').trim();
  if (!texto || enviando || !marcaId) return;
  enviando = true; enviarBtn.disabled = true; inputEl.value = ''; autoAlto();
  chipsEl.hidden = true;
  hiloEl.appendChild(burbuja('yo', texto));
  const espera = burbuja('ia asis-msg--espera', T('Consultando tu información…', 'Checking your information…'));
  hiloEl.appendChild(espera); bajar();
  try {
    const body = isClientRole() ? { texto } : { texto, client_id: marcaId };
    const r = await api.post('/asistente/chat', body);
    espera.replaceWith(burbuja('ia', r.respuesta, { folio: r.solicitud ? r.solicitud.folio : null }));
    if (r.solicitud && !isClientRole()) pintarStaff();
  } catch (e) {
    const msg = (e && e.data && e.data.error) || T('No pude responder. Intenta de nuevo.', 'I could not answer. Try again.');
    espera.replaceWith(burbuja('sys', msg));
    if (e && e.status === 403 && isClientRole()) pintarApagado();
  } finally {
    enviando = false; enviarBtn.disabled = false; bajar(); inputEl.focus();
  }
}

function autoAlto() {
  inputEl.style.height = 'auto';
  inputEl.style.height = Math.min(140, Math.max(44, inputEl.scrollHeight)) + 'px';
}

// ── Contrato de vista ───────────────────────────────────────────────────────
export default {
  id: VIEW_ID,
  async mount(host, c) {
    ctx = c;
    marcaId = marcaActiva();
    hiloEl = el('div', { class: 'asis-hilo', 'aria-live': 'polite' });
    chipsEl = el('div', { class: 'asis-chips' });
    staffEl = isClientRole() ? null : el('section', { class: 'asis-staff', hidden: true });
    inputEl = el('textarea', { rows: 1, placeholder: T('Escribe tu pregunta…', 'Type your question…'), 'aria-label': T('Mensaje', 'Message') });
    inputEl.addEventListener('input', autoAlto);
    inputEl.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && !ev.shiftKey && window.matchMedia('(min-width: 1024px)').matches) { ev.preventDefault(); enviar(); } });
    enviarBtn = el('button', { type: 'button', class: 'asis-enviar', 'aria-label': T('Enviar', 'Send'), onclick: enviar }, [icon('send', 20)]);
    barraEl = el('div', { class: 'asis-barra', hidden: true }, [el('div', { class: 'asis-barra__in' }, [inputEl, enviarBtn])]);
    rootEl = el('section', { class: 'asis' }, [cabecera(), ...(staffEl ? [staffEl] : []), hiloEl, chipsEl]);
    host.appendChild(rootEl);
    document.body.appendChild(barraEl);
    unsubs.push(ctx.store.subscribe(['activeClientId', 'clients'], () => { if (!isClientRole()) cargar(); }));
    await cargar();
  },
  unmount() {
    for (const u of unsubs) { try { u(); } catch { /* nada */ } }
    unsubs = [];
    if (barraEl && barraEl.parentNode) barraEl.parentNode.removeChild(barraEl);
    rootEl = hiloEl = barraEl = inputEl = enviarBtn = chipsEl = staffEl = null;
    estadoActual = null; enviando = false;
  },
};
