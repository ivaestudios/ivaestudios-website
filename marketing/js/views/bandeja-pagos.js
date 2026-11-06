// ============================================================================
// IVAE Marketing — Bandeja · 💳 LINKS DE PAGO de Stripe (estudio de fotos).
//
// Israel (6-nov-2026): "necesito que Juan me ayude a generar links de pago…
// todo conectado al 100%". Desde el chat del cliente (botón "💳 Cobrar" junto
// al chip de Juan) o desde la ficha de una reserva (pestaña Reservas), se llena
// monto, moneda y tipo (sesión / upgrade / propina) y Juan crea en Stripe un
// link de UN SOLO USO con el correo del cliente ya puesto. La hoja devuelve el
// link y el mensaje listo para mandarlo (en el idioma del cliente, calcado de
// los que manda Vianey) y lo pone en el chat para revisarlo y enviarlo.
//
// Los PAGOS no se registran aquí: los guarda la galería (cobros_sesion) y el
// Embudo / Administración los amarran. Este módulo solo los LEE para decir
// "pagado", "link enviado, sin pagar" o "sin cobrar".
//
// Backend: functions/api/marketing/_pagos.js (rutas /pagos/*). Enganches en
// bandeja.js: conectarPagos(deps), botonCobrar(v) en la cabecera del chat y
// fichaCobro(r) en la ficha de la reserva. Estilos: inyectados aquí (sin tocar
// bandeja.css).
// ============================================================================
import { api, el, clear, timeAgo, copyText } from '../api.js?v=202611060341';
import { toast } from '../shell/toast.js?v=202611060341';
import { icon } from '../shell/icons.js?v=202611060341';
import { T } from '../shell/i18n.js?v=202611060341';

let d = null;        // deps que pone bandeja.js: ctx(), cid(), nombreDe(v), ponerEnChat(v, texto), alCambiarChat(id), alCambiarReservas()
let estado = null;   // { client_id, en, aplica, stripe, links, cobros, catalogo }
let cargando = null;

export function conectarPagos(deps) { d = deps; }
export function reiniciarPagos() { estado = null; cargando = null; }

function fmt(monto, moneda) {
  const n = Number(monto) || 0;
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 }) + ' ' + String(moneda || 'usd').toUpperCase();
}
function copiar(texto) {
  try { const r = copyText(texto); if (r && r.then) r.then(() => toast(T('Copiado.', 'Copied.'), { type: 'success' })).catch(() => toast(T('No se pudo copiar.', 'Could not copy.'), { type: 'error' })); else toast(T('Copiado.', 'Copied.'), { type: 'success' }); }
  catch { toast(T('No se pudo copiar.', 'Could not copy.'), { type: 'error' }); }
}

async function cargarEstado(clientId, { forzar = false } = {}) {
  if (!clientId) return null;
  if (!forzar && estado && estado.client_id === clientId && Date.now() - estado.en < 60e3) return estado;
  if (!forzar && cargando && cargando.id === clientId) return cargando.p;
  const p = api.get('/pagos/estado?client_id=' + encodeURIComponent(clientId))
    .then((r) => { estado = { client_id: clientId, en: Date.now(), ...(r || { aplica: false }) }; return estado; })
    .catch(() => { estado = { client_id: clientId, en: Date.now(), aplica: false }; return estado; })
    .finally(() => { cargando = null; });
  cargando = { id: clientId, p };
  return p;
}
export async function cargarPagos(clientId) { return cargarEstado(clientId, { forzar: true }); }

// ── Botón "💳 Cobrar" (cabecera del chat; compacto para el paso "Pago" del flujo) ──
export function botonCobrar(v, { compacto = false } = {}) {
  if (!d || !v) return null;
  const cid = v.client_id || (d.cid && d.cid());
  const b = el('button', {
    type: 'button', class: compacto ? 'btn btn-ghost btn-sm bj-cobrar' : 'bj-asignado is-libre bj-cobrar', style: { display: 'none' },
    title: T('Crear un link de pago de Stripe para este cliente', 'Create a Stripe payment link for this client'),
    onclick: () => hojaCobro({ v }),
  }, [el('span', { text: '💳 ' + T(compacto ? 'Mandar link de pago' : 'Cobrar', compacto ? 'Send payment link' : 'Charge') })]);
  cargarEstado(cid).then((e) => { if (e && e.aplica) b.style.display = ''; });
  return b;
}

// ── Estado del cobro de una reserva (pestaña Reservas) ──
function cobroDeReserva(r, e) {
  const rid = String(r.id);
  const correo = String(r.email || '').toLowerCase();
  const links = (e.links || []).filter((l) => String(l.reserva_id || '') === rid || (correo && String(l.correo || '').toLowerCase() === correo));
  const link = links[0] || null;
  const cobro = (e.cobros || []).find((c) => (link && c.link_id && c.link_id === link.id) || (correo && String(c.correo || '').toLowerCase() === correo)) || null;
  if (cobro) return { estado: 'pagado', monto: cobro.monto, moneda: cobro.moneda, fecha: cobro.fecha, via: 'stripe' };
  // Efectivo o transferencia (Administración): por la reserva o por el nombre.
  const nom = String(r.cliente || '').trim().toLowerCase();
  const manual = (e.efectivo || []).find((m) => String(m.reserva_id || '') === 'juan:' + rid || (nom.length > 3 && String(m.cliente || '').trim().toLowerCase() === nom)) || null;
  if (manual) return { estado: 'pagado', monto: manual.precio || manual.monto_mxn, moneda: manual.precio ? 'usd' : 'mxn', fecha: manual.fecha ? manual.fecha + 'T12:00:00Z' : null, via: manual.forma_pago === 'bbva' ? 'transferencia' : manual.forma_pago };
  if (link && link.estado === 'pagado') return { estado: 'pagado', monto: link.monto, moneda: link.moneda, fecha: link.pagado_en };
  if (link && link.estado === 'pendiente') return { estado: 'link', monto: link.monto, moneda: link.moneda, url: link.url, creado: link.created_at };
  return { estado: 'sin' };
}
export function fichaCobro(r) {
  if (!d || !r) return null;
  estilos();
  const wrap = el('div', { class: 'bj-reserva-ficha__cobro' });
  cargarEstado(d.cid && d.cid()).then((e) => {
    if (!e || !e.aplica) return;
    const c = cobroDeReserva(r, e);
    clear(wrap);
    const via = c.via === 'stripe' ? ' · Stripe' : c.via === 'transferencia' ? ' · ' + T('transferencia', 'transfer') : c.via === 'efectivo' ? ' · ' + T('efectivo', 'cash') : '';
    const txt = c.estado === 'pagado' ? '✅ ' + T(`Pagado ${fmt(c.monto, c.moneda)}`, `Paid ${fmt(c.monto, c.moneda)}`) + via + (c.fecha ? ' · ' + timeAgo(c.fecha) : '')
      : c.estado === 'link' ? '🔗 ' + T(`Link enviado por ${fmt(c.monto, c.moneda)}, sin pagar`, `Link sent for ${fmt(c.monto, c.moneda)}, unpaid`) + (c.creado ? ' · ' + timeAgo(c.creado) : '')
      : T('Sin cobrar todavía', 'Not charged yet');
    wrap.append(el('div', { class: 'bj-reserva-ficha__dato' }, [el('span', { text: T('Cobro', 'Payment') }), el('b', { text: txt })]));
    const btns = el('div', { class: 'bj-cobro__btns' });
    if (c.estado !== 'pagado') btns.append(el('button', { type: 'button', class: 'btn btn-primary btn-sm', onclick: () => hojaCobro({ reserva: r }) }, ['💳 ' + T(c.estado === 'link' ? 'Crear otro link' : 'Crear link de pago', c.estado === 'link' ? 'Create another link' : 'Create payment link')]));
    if (c.estado === 'link' && c.url) btns.append(el('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => copiar(c.url) }, [T('Copiar link', 'Copy link')]));
    if (btns.childNodes.length) wrap.append(btns);
  });
  return wrap;
}

// ── La hoja: datos → link → mensaje listo ──
export async function hojaCobro({ v = null, reserva = null } = {}) {
  const ctx = d && d.ctx && d.ctx();
  if (!ctx || !ctx.sheet) return;
  estilos();
  const cid = (v && v.client_id) || (d.cid && d.cid());
  const e = await cargarEstado(cid);
  const precioDe = (paq) => {
    if (!paq) return null;
    const it = ((e && e.catalogo) || []).find((x) => x.nombre && String(x.nombre).toLowerCase() === String(paq).toLowerCase());
    return it && it.precio ? Number(it.precio) : null;
  };
  const ini = {
    cliente: (reserva && reserva.cliente) || (v && (d.nombreDe ? d.nombreDe(v) : v.nombre)) || '',
    correo: (reserva && reserva.email) || (v && v.correo) || '',
    paquete: (reserva && reserva.paquete) || '',
    monto: (reserva && (precioDe(reserva.paquete) || reserva.precio_usd)) || (v && Number(v.valor_estimado) > 0 ? Number(v.valor_estimado) : ''),
    idioma: reserva && reserva.idioma === 'es' ? 'es' : 'en',
    telefono: (reserva && reserva.cliente_wa) || (v && v.canal === 'whatsapp' ? v.contacto_id : '') || '',
  };
  const listo = !!(e && e.stripe && e.stripe.listo);
  ctx.sheet.openSheet({
    title: '💳 ' + T('Link de pago', 'Payment link'),
    mode: 'form',
    build(body, close) {
      if (!listo) body.appendChild(el('p', { class: 'bj-cobro__aviso', text: T('Stripe no está conectado todavía: falta cargar la llave restringida en Juan (Israel). Puedes llenar los datos, pero el link no se creará hasta entonces.', 'Stripe is not connected yet: the restricted key still needs to be loaded into Juan (Israel). You can fill in the details, but the link will not be created until then.') }));
      const inCliente = el('input', { class: 'input', type: 'text', value: ini.cliente, placeholder: T('Nombre del cliente', 'Client name') });
      const inCorreo = el('input', { class: 'input', type: 'email', value: ini.correo, placeholder: 'correo@…' });
      const inMonto = el('input', { class: 'input', type: 'number', min: '1', step: '0.01', inputmode: 'decimal', value: ini.monto === '' || ini.monto == null ? '' : String(ini.monto), placeholder: '465' });
      const selMoneda = el('select', { class: 'input' }, [el('option', { value: 'usd', text: 'USD' }), el('option', { value: 'mxn', text: 'MXN' })]);
      const selTipo = el('select', { class: 'input' }, [['sesion', T('Sesión', 'Session')], ['upgrade', 'Upgrade'], ['propina', T('Propina', 'Tip')], ['otro', T('Otro', 'Other')]].map(([k, t]) => el('option', { value: k, text: t })));
      const inPaquete = el('input', { class: 'input', type: 'text', value: ini.paquete, placeholder: T('Colección (opcional)', 'Collection (optional)'), list: 'bj-cobro-paquetes' });
      const dl = el('datalist', { id: 'bj-cobro-paquetes' }, ((e && e.catalogo) || []).map((x) => el('option', { value: x.nombre })));
      const inConcepto = el('input', { class: 'input', type: 'text', placeholder: T('Concepto (opcional; se arma solo)', 'Description (optional; built automatically)') });
      const selIdioma = el('select', { class: 'input' }, [el('option', { value: 'en', text: 'English' }), el('option', { value: 'es', text: 'Español' })]);
      selIdioma.value = ini.idioma;
      inPaquete.addEventListener('change', () => { const p = precioDe(inPaquete.value); if (p && !inMonto.value) inMonto.value = String(p); });
      const fila = (label, input) => el('div', { class: 'field' }, [el('label', { class: 'label', text: label }), input]);
      const dos = (a, b) => el('div', { class: 'bj-cobro__dos' }, [a, b]);
      const form = el('div', { class: 'bj-cobro__form' }, [
        fila(T('Cliente', 'Client'), inCliente),
        fila(T('Correo (el link ya lo lleva puesto)', 'Email (prefilled in the link)'), inCorreo),
        dos(fila(T('Monto', 'Amount'), inMonto), fila(T('Moneda', 'Currency'), selMoneda)),
        dos(fila(T('Tipo', 'Type'), selTipo), fila(T('Idioma del mensaje', 'Message language'), selIdioma)),
        fila(T('Colección', 'Collection'), inPaquete), dl,
        fila(T('Concepto', 'Description'), inConcepto),
        el('p', { class: 'muted bj-cobro__p', text: T('Link de un solo uso. Lo crea Juan en Stripe; cuando el cliente paga, el pago llega solo al CRM y a Administración → Dinero.', 'Single-use link. Juan creates it in Stripe; when the client pays, the payment lands in the CRM and in Administración → Dinero by itself.') }),
      ]);
      const etiqueta = () => [icon('link', 16), ' ' + T('Crear link de pago', 'Create payment link')];
      const btn = el('button', { type: 'button', class: 'btn btn-primary bj-cobro__crear' }, etiqueta());
      if (!listo) btn.disabled = true;
      const res = el('div', { class: 'bj-cobro__res' });
      res.hidden = true;
      body.append(form, btn, res);
      btn.onclick = async () => {
        const monto = Number(inMonto.value);
        if (!(monto > 0)) { toast(T('Escribe el monto.', 'Enter the amount.'), { type: 'error' }); inMonto.focus(); return; }
        if (!inCliente.value.trim()) { toast(T('Escribe el nombre del cliente.', 'Enter the client name.'), { type: 'error' }); inCliente.focus(); return; }
        btn.disabled = true; btn.textContent = T('Creando el link…', 'Creating the link…');
        try {
          const r = await api.post('/pagos/link', {
            client_id: cid, conv_id: v ? v.id : undefined, reserva_id: reserva ? reserva.id : undefined,
            monto, moneda: selMoneda.value, tipo: selTipo.value, cliente: inCliente.value.trim(), correo: inCorreo.value.trim(),
            idioma: selIdioma.value, paquete: inPaquete.value.trim(), concepto: inConcepto.value.trim(), telefono: ini.telefono,
          });
          form.hidden = true; btn.hidden = true;
          mostrarResultado(res, r, { v, close });
          if (estado && estado.client_id === cid) estado.links = [{ id: r.id, url: r.url, monto: r.monto, moneda: r.moneda, concepto: r.concepto, tipo: r.tipo, cliente: r.cliente, correo: r.correo, conv_id: v ? v.id : null, reserva_id: reserva ? String(reserva.id) : null, estado: 'pendiente', created_at: new Date().toISOString() }, ...(estado.links || [])];
          if (v && d.alCambiarChat) d.alCambiarChat(v.id);
          if (reserva && d.alCambiarReservas) d.alCambiarReservas();
        } catch (err) {
          toast((err && err.message) || T('No se pudo crear el link.', 'Could not create the link.'), { type: 'error', ms: 9000 });
          btn.disabled = false; clear(btn); btn.append(...etiqueta());
        }
      };
    },
  });
}

function mostrarResultado(res, r, { v, close }) {
  clear(res); res.hidden = false;
  const url = el('input', { class: 'input bj-cobro__url', type: 'text', value: r.url || '' });
  url.readOnly = true; url.onclick = () => url.select();
  const msg = el('textarea', { class: 'textarea bj-cobro__msg', rows: 7 });
  msg.value = r.mensaje || ''; msg.readOnly = true;
  const b = (txt, fn, primario) => el('button', { type: 'button', class: 'btn ' + (primario ? 'btn-primary' : 'btn-ghost'), onclick: fn }, [txt]);
  res.append(
    el('p', { class: 'bj-cobro__ok', text: '✅ ' + T(`Link creado por ${fmt(r.monto, r.moneda)}. Juan y la Bandeja ya saben que este cliente lo tiene pendiente.`, `Link created for ${fmt(r.monto, r.moneda)}. Juan and the Inbox now know this client has it pending.`) }),
    el('label', { class: 'label', text: 'Link' }), url,
    el('label', { class: 'label', text: T('Mensaje para el cliente', 'Message for the client') }), msg,
    el('div', { class: 'bj-cobro__btns' }, [
      v && d.ponerEnChat ? b('💬 ' + T('Ponerlo en el chat', 'Put it in the chat'), () => { d.ponerEnChat(v, r.mensaje || r.url); close(); toast(T('Listo: revisa el mensaje y envíalo.', 'Done: review the message and send it.'), { type: 'success' }); }, true) : null,
      b(T('Copiar mensaje', 'Copy message'), () => copiar(r.mensaje || r.url), !(v && d.ponerEnChat)),
      b(T('Copiar link', 'Copy link'), () => copiar(r.url)),
    ].filter(Boolean)),
  );
}

let estilosPuestos = false;
function estilos() {
  if (estilosPuestos || typeof document === 'undefined') return;
  estilosPuestos = true;
  const st = document.createElement('style');
  st.textContent = `
.bj-cobro__form{display:grid;gap:10px}
.bj-cobro__dos{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.bj-cobro__p{margin:0;font-size:12px;line-height:1.4}
.bj-cobro__aviso{margin:0 0 12px;padding:8px 10px;border-radius:8px;background:rgba(255,170,0,.14);font-size:13px;line-height:1.4}
.bj-cobro__crear{margin-top:12px;width:100%}
.bj-cobro__res{display:grid;gap:8px;margin-top:8px}
.bj-cobro__ok{margin:0 0 4px;font-weight:600;line-height:1.4}
.bj-cobro__url{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px}
.bj-cobro__msg{font-size:13px;line-height:1.4}
.bj-cobro__btns{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px}
.bj-reserva-ficha__cobro{margin-top:8px;display:grid;gap:6px}
.bj-cobrar{white-space:nowrap}`;
  document.head.appendChild(st);
}
