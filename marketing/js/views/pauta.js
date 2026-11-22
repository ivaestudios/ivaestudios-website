// ============================================================================
// IVAE Marketing — Vista "Pauta" (anuncios pagados de la casa, solo admin).
//
// Pedido de la dueña (14-sep-2026): "un sistema para pautar y que tú veas y
// hagas los movimientos según rendimiento". Esto es el PASO 1 de eso: conectar
// la cuenta publicitaria y VER los números. Decidir y mover va después, con su
// bitácora y su interruptor, para que ejecutar sea una decisión explícita.
//
// 16-nov-2026 · PAUTA DE TODAS LAS MARCAS. Vianey: "si quiero manejar pautas de
// todos los clientes, tiene que estar súper bien hecho". Arriba, el tablero de
// todas las marcas (gasto, resultados y costo de los últimos 30 días); al tocar
// una, su detalle con campañas, IA y bitácora. "La casa" es la cuenta de IVAE
// de siempre. Cada marca conecta SU cuenta publicitaria (agencia o propia).
// Ver functions/api/marketing/_ads.js y la migración 052.
// ============================================================================
import { el, clear, toast } from '../api.js?v=202611220222';
import { icon } from '../shell/icons.js?v=202611220222';
import { T, isEN } from '../shell/i18n.js?v=202611220222';

const VIEW_ID = 'pauta';

let ctx = null;
let rootEl = null;
// 90 dias por defecto, LA MISMA ventana con la que decide la IA. Con 30 la
// pantalla decia "nada gasto" justo debajo de decisiones basadas en gasto real,
// que es la peor mezcla posible: parece que se contradice a si misma.
let dias = 90;
// Qué se está viendo: 'todas' (tablero), 'casa' (la cuenta de IVAE) o el id de
// una marca. Nace de la marca elegida arriba en la app.
let vista = 'todas';
let unsubs = [];

// El pedazo de URL / cuerpo que dice de qué marca se habla.
const esMarca = () => vista && vista !== 'todas' && vista !== 'casa';
const qMarca = () => (esMarca() ? `client_id=${encodeURIComponent(vista)}` : '');
const conMarca = (obj) => (esMarca() ? { ...obj, client_id: vista } : obj);
function nombreMarca(id) {
  const c = ((ctx && ctx.store.getState().clients) || []).find((x) => x.id === id);
  return c ? c.name : '';
}
function vistaDesdeStore() {
  if (ctx && esCliente()) return miMarca() || 'todas';
  const id = ctx && ctx.store.getState().activeClientId;
  return id && id !== 'todos' ? id : 'todas';
}

function esAdmin() { return ((ctx.store.getState().me || {}).role === 'admin'); }
// El cliente maneja la pauta de SU marca (16-nov-2026); la dueña, todas.
function esCliente() { return ((ctx.store.getState().me || {}).role === 'client'); }
function miMarca() { return (ctx.store.getState().me || {}).client_id || null; }

// Meta manda los presupuestos en centavos de la moneda de la cuenta.
function dinero(centavos, moneda) {
  const n = Number(centavos);
  if (!Number.isFinite(n)) return '—';
  try {
    return (n / 100).toLocaleString(isEN ? 'en-US' : 'es-MX', { style: 'currency', currency: moneda || 'MXN', maximumFractionDigits: 0 });
  } catch { return `${(n / 100).toFixed(0)} ${moneda || ''}`; }
}
// El gasto de insights viene en unidades enteras (no centavos), al revés.
function gasto(v, moneda) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  try {
    return n.toLocaleString(isEN ? 'en-US' : 'es-MX', { style: 'currency', currency: moneda || 'MXN', maximumFractionDigits: 0 });
  } catch { return `${n.toFixed(0)} ${moneda || ''}`; }
}
function num(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  try { return n.toLocaleString(isEN ? 'en-US' : 'es-MX'); } catch { return String(n); }
}

// El "resultado" de una campaña depende de su objetivo: mensajes, clics al
// sitio, interacciones… Meta lo devuelve en actions[], no en un campo fijo.
const ACCIONES_UTILES = [
  'onsite_conversion.messaging_conversation_started_7d',
  'link_click',
  'landing_page_view',
  'lead',
  'purchase',
  'post_engagement',
];
function resultadoDe(ins) {
  const acts = (ins && ins.actions) || [];
  for (const tipo of ACCIONES_UTILES) {
    const a = acts.find((x) => x.action_type === tipo);
    if (a) {
      const costos = (ins.cost_per_action_type || []).find((x) => x.action_type === tipo);
      return { tipo, valor: Number(a.value) || 0, costo: costos ? Number(costos.value) : null };
    }
  }
  return null;
}
const NOMBRE_ACCION = {
  'onsite_conversion.messaging_conversation_started_7d': () => T('conversaciones', 'conversations'),
  link_click: () => T('clics al enlace', 'link clicks'),
  landing_page_view: () => T('visitas a la página', 'landing page views'),
  lead: () => T('registros', 'leads'),
  purchase: () => T('compras', 'purchases'),
  post_engagement: () => T('interacciones', 'engagements'),
};

// Una promoción de post con fecha de fin ya pasada sigue "ACTIVE" para Meta,
// pero ya no gasta: para la dueña es "Terminada", no "Activa".
function terminada(c) {
  const e = String(c.effective_status || c.status || '').toUpperCase();
  return e === 'ACTIVE' && !!c.stop_time && (Date.parse(c.stop_time) || 0) < Date.now();
}
function chipEstado(c) {
  if (terminada(c)) return el('span', { class: 'pauta-chip pauta-chip--off', text: T('Terminada', 'Ended') });
  const e = String(c.effective_status || c.status || '').toUpperCase();
  const mapa = {
    ACTIVE: [T('Activa', 'Active'), 'ok'],
    PAUSED: [T('Pausada', 'Paused'), 'off'],
    IN_PROCESS: [T('Procesando', 'Processing'), 'warn'],
    WITH_ISSUES: [T('Con problemas', 'With issues'), 'warn'],
    CAMPAIGN_PAUSED: [T('Pausada', 'Paused'), 'off'],
    ADSET_PAUSED: [T('Pausada', 'Paused'), 'off'],
    DELETED: [T('Borrada', 'Deleted'), 'off'],
    ARCHIVED: [T('Archivada', 'Archived'), 'off'],
  };
  const [txt, tono] = mapa[e] || [e || '—', 'off'];
  return el('span', { class: `pauta-chip pauta-chip--${tono}`, text: txt });
}

function tarjetaCampana(c, moneda) {
  const ins = (c.insights && c.insights.data && c.insights.data[0]) || null;
  const r = resultadoDe(ins);
  // El presupuesto puede estar en la campaña o repartido en sus conjuntos.
  // Mirar solo la campaña pintaba "sin presupuesto" una que gastaba 400 al día.
  const sets = (c.adsets && c.adsets.data) || [];
  const sumar = (k) => sets.reduce((t, a) => t + (Number(a[k]) || 0), 0);
  const diario = Number(c.daily_budget) || sumar('daily_budget');
  const total = Number(c.lifetime_budget) || sumar('lifetime_budget');
  const presupuesto = diario
    ? `${dinero(diario, moneda)} ${T('al día', 'a day')}`
    : (total ? `${dinero(total, moneda)} ${T('en total', 'total')}` : T('sin presupuesto', 'no budget'));

  const dato = (etiqueta, valor) => el('div', { class: 'pauta-dato' }, [
    el('div', { class: 'pauta-dato__v', text: valor }),
    el('div', { class: 'pauta-dato__k', text: etiqueta }),
  ]);

  const estado = String(c.effective_status || c.status || '').toUpperCase();
  const activa = estado === 'ACTIVE' && !terminada(c);
  // ⚠️ NO llamarle `gasto`: hay una funcion `gasto()` que formatea dinero y la
  // variable la tapaba dentro de esta funcion. Solo reventaba cuando la campana
  // SI tenia numeros, que es justo cuando la tarjeta importa.
  const gastoNum = ins ? (Number(ins.spend) || 0) : 0;

  const accion = async (ruta, btn, txtCargando, ok) => {
    btn.disabled = true;
    const antes = btn.textContent;
    btn.textContent = txtCargando;
    try {
      const r = await (await fetch(`/api/marketing/ads/${ruta}`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(conMarca({ campaign_id: c.id, quien: 'persona' })),
      })).json();
      if (r && r.error) { toast(r.error, { type: 'error' }); btn.disabled = false; btn.textContent = antes; return; }
      toast(ok, { type: 'success' });
      render();
    } catch {
      toast(T('No se pudo. Reintenta.', 'Could not do it. Try again.'), { type: 'error' });
      btn.disabled = false; btn.textContent = antes;
    }
  };

  const botones = [];
  const bPrender = el('button', {
    class: 'btn btn-sm' + (activa ? '' : ' btn-primary'), type: 'button',
    text: activa ? T('Pausar', 'Pause') : T('Encender', 'Turn on'),
    onclick: () => {
      if (!activa && !window.confirm(T(
        `Al encender "${c.name}" empieza a gastar dinero real: ${presupuesto}. ¿Encender?`,
        `Turning on "${c.name}" starts spending real money: ${presupuesto}. Turn on?`,
      ))) return;
      accion(
      activa ? 'apagar' : 'encender', bPrender,
      activa ? T('Pausando…', 'Pausing…') : T('Encendiendo…', 'Turning on…'),
      activa ? T('Pausada.', 'Paused.') : T('Encendida: ya está gastando.', 'On: it is spending now.'),
      );
    },
  });
  // Una campaña terminada no se pausa ni se enciende: ya acabó.
  if (!terminada(c)) botones.push(bPrender);
  // Borrar SOLO si nunca gastó: con gasto, el historial es lo que sirve para
  // decidir, y borrarlo lo tira a la basura. El backend lo vuelve a comprobar.
  if (!gastoNum) {
    const bBorrar = el('button', {
      class: 'btn btn-sm pauta-card__del', type: 'button',
      text: T('Borrar', 'Delete'),
      onclick: () => accion('borrar', bBorrar, T('Borrando…', 'Deleting…'), T('Borrada.', 'Deleted.')),
    });
    botones.push(bBorrar);
  }

  return el('div', { class: 'pauta-card' }, [
    el('div', { class: 'pauta-card__top' }, [
      el('div', { class: 'pauta-card__name', text: c.name || '—' }),
      chipEstado(c),
    ]),
    el('div', { class: 'pauta-card__sub', text: presupuesto }),
    el('div', { class: 'pauta-datos' }, [
      dato(T('Gastado', 'Spent'), ins ? gasto(ins.spend, moneda) : '—'),
      dato(T('Alcance', 'Reach'), ins ? num(ins.reach) : '—'),
      dato(T('Clics', 'Clicks'), ins ? num(ins.clicks) : '—'),
      r
        ? dato((NOMBRE_ACCION[r.tipo] || (() => r.tipo))(), num(r.valor))
        : dato(T('Resultados', 'Results'), '—'),
      r && r.costo != null
        ? dato(T('Costo por resultado', 'Cost per result'), gasto(r.costo, moneda))
        : null,
    ].filter(Boolean)),
    el('div', { class: 'pauta-card__acc' }, botones),
  ]);
}

function cabecera(estado) {
  const sel = el('div', { class: 'pauta-rango' }, [7, 30, 90].map((d) => el('button', {
    class: 'btn btn-sm' + (d === dias ? ' is-active' : ''), type: 'button',
    text: T(`${d} días`, `${d} days`),
    onclick: () => { dias = d; render(); },
  })));
  const titulo = vista === 'casa' ? T('Pauta · IVAE (la casa)', 'Ads · IVAE (house)') : `${T('Pauta', 'Ads')} · ${nombreMarca(vista) || T('Marca', 'Brand')}`;
  const cuenta = estado && estado.cuenta;
  const volver = esCliente() ? null : el('button', {
    class: 'btn btn-ghost btn-sm pauta-volver', type: 'button',
    onclick: () => { vista = 'todas'; render(); },
  }, [icon('left', 14), el('span', { text: T('Todas las marcas', 'All brands') })]);
  // La cuenta de la casa (sin `modo`) no se desconecta desde aquí.
  const desconectar = esMarca() && cuenta && cuenta.modo ? el('button', {
    class: 'btn btn-ghost btn-sm', type: 'button', text: T('Desconectar cuenta', 'Disconnect account'),
    onclick: async () => {
      if (!window.confirm(T(
        `¿Quitar la cuenta publicitaria "${cuenta.name}" de ${nombreMarca(vista)}? En Meta no se toca nada: las campañas siguen como estén.`,
        `Remove the ad account "${cuenta.name}" from ${nombreMarca(vista)}? Nothing changes in Meta: campaigns stay as they are.`,
      ))) return;
      try {
        const r = await (await fetch('/api/marketing/ads/desconectar', {
          method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ client_id: vista }),
        })).json();
        if (r && r.error) { toast(r.error, { type: 'error' }); return; }
        toast(T('Cuenta desconectada de la marca.', 'Account disconnected from the brand.'), { type: 'success' });
        render();
      } catch { toast(T('No se pudo. Reintenta.', 'Could not do it. Try again.'), { type: 'error' }); }
    },
  }) : null;
  return el('div', { class: 'mk-head' }, [
    volver,
    el('h1', { class: 'mk-title', text: titulo }),
    cuenta ? el('p', { class: 'mk-sub', text: [
      cuenta.name,
      cuenta.currency,
      cuenta.modo === 'propia' ? T('cuenta propia', 'own account') : (cuenta.modo === 'agencia' ? T('manejada por la agencia', 'managed by the agency') : T('cuenta de la casa', 'house account')),
    ].filter(Boolean).join(' · ') }) : null,
    el('div', { class: 'pauta-head__acc' }, [
      cuenta ? el('button', { class: 'btn btn-primary btn-sm', type: 'button', text: T('Nueva campaña', 'New campaign'), onclick: () => nuevaCampana(cuenta) }) : null,
      sel, desconectar,
    ].filter(Boolean)),
  ].filter(Boolean));
}

// ── Nueva campaña (16-nov-2026) ─────────────────────────────────────────────
// Lo que pide la guía de pauta high ticket: optimizar a CONVERSACIONES (WhatsApp,
// Instagram o Messenger), público amplio con Advantage+ y el creativo hace la
// segmentación. Nace PAUSADA siempre; encender es aparte y pide confirmar.
function nuevaCampana(cuenta) {
  const moneda = cuenta.currency || 'MXN';
  const f = {
    objetivo: 'WHATSAPP', whatsapp: '', enlace: '', forma: 'post', post: '',
    imagen: '', texto: '', titular: '', paises: ['MX'], edadMin: 25, edadMax: 65,
    presupuesto: 150, dias: 7, nombre: '',
  };
  const campo = (etiqueta, input, ayuda) => el('label', { class: 'pauta-f' }, [
    el('span', { class: 'pauta-f__k', text: etiqueta }), input,
    ayuda ? el('span', { class: 'pauta-f__help', text: ayuda }) : null,
  ].filter(Boolean));
  const entrada = (clave, attrs = {}) => {
    const i = el('input', { class: 'pauta-f__in', value: String(f[clave] ?? ''), ...attrs });
    i.addEventListener('input', () => { f[clave] = attrs.type === 'number' ? Number(i.value) : i.value; pintarTotal(); });
    return i;
  };
  const opciones = (clave, lista, alCambiar) => {
    const g = el('div', { class: 'pauta-seg' });
    const pintar = () => {
      clear(g);
      for (const [v, txt] of lista) {
        g.appendChild(el('button', {
          class: 'btn btn-sm' + (f[clave] === v ? ' is-active' : ''), type: 'button', text: txt,
          onclick: () => { f[clave] = v; pintar(); if (alCambiar) alCambiar(); },
        }));
      }
    };
    pintar();
    return g;
  };
  const total = el('div', { class: 'pauta-f__total' });
  function pintarTotal() {
    const t = (Number(f.presupuesto) || 0) * (Number(f.dias) || 0);
    total.textContent = T(
      `Máximo ${gasto(f.presupuesto, moneda)} al día durante ${f.dias} día(s): hasta ${gasto(t, moneda)} en total. Se crea pausada: no gasta nada hasta que la enciendas.`,
      `Up to ${gasto(f.presupuesto, moneda)} a day for ${f.dias} day(s): up to ${gasto(t, moneda)} total. Created paused: it spends nothing until you turn it on.`,
    );
  }

  ctx.sheet.openSheet({
    title: T('Nueva campaña', 'New campaign'), mode: 'form',
    build(body, close) {
      const destino = el('div');
      const anuncio = el('div');
      function pintarDestino() {
        clear(destino);
        if (f.objetivo === 'WHATSAPP') destino.appendChild(campo(T('WhatsApp que recibe los mensajes', 'WhatsApp that gets the messages'), entrada('whatsapp', { inputmode: 'tel', placeholder: '5219981234567' }), T('Con lada del país. Si la marca tiene WhatsApp conectado, se usa ese.', 'With country code. If the brand has WhatsApp connected, that one is used.')));
        if (f.objetivo === 'TRAFICO') destino.appendChild(campo(T('Enlace a donde lleva', 'Link it goes to'), entrada('enlace', { type: 'url', placeholder: 'https://' })));
      }
      function pintarAnuncio() {
        clear(anuncio);
        if (f.forma === 'post') {
          anuncio.appendChild(campo(T('Enlace del post o reel de Instagram', 'Instagram post or reel link'), entrada('post', { type: 'url', placeholder: 'https://www.instagram.com/p/…' }), T('Se anuncia tal cual, con el botón de mensaje encima.', 'It is advertised as is, with the message button on top.')));
        } else {
          anuncio.append(
            campo(T('Foto (enlace público JPG o PNG)', 'Photo (public JPG or PNG link)'), entrada('imagen', { type: 'url', placeholder: 'https://' })),
            campo(T('Texto principal', 'Primary text'), (() => { const t = el('textarea', { class: 'pauta-f__in', rows: '4' }); t.addEventListener('input', () => { f.texto = t.value; }); return t; })()),
            campo(T('Titular', 'Headline'), entrada('titular', { maxlength: '120' })),
          );
        }
      }
      pintarDestino(); pintarAnuncio(); pintarTotal();

      const paises = el('div', { class: 'pauta-seg' });
      const pintarPaises = () => {
        clear(paises);
        for (const [c, txt] of [['MX', T('México', 'Mexico')], ['US', T('Estados Unidos', 'United States')], ['CA', 'Canadá']]) {
          const on = f.paises.includes(c);
          paises.appendChild(el('button', {
            class: 'btn btn-sm' + (on ? ' is-active' : ''), type: 'button', text: txt,
            onclick: () => { f.paises = on ? f.paises.filter((x) => x !== c) : [...f.paises, c]; if (!f.paises.length) f.paises = [c]; pintarPaises(); },
          }));
        }
      };
      pintarPaises();

      const crear = el('button', { class: 'btn btn-primary sheet-cta', type: 'button', text: T('Crear pausada', 'Create paused') });
      crear.addEventListener('click', async () => {
        crear.disabled = true; crear.textContent = T('Creando en Meta…', 'Creating in Meta…');
        try {
          const cuerpo = conMarca({
            quien: 'persona',
            objetivo: f.objetivo === 'TRAFICO' ? '' : f.objetivo,
            whatsapp: f.whatsapp, enlace: f.enlace,
            presupuesto_mxn: Number(f.presupuesto), dias: Number(f.dias),
            paises: f.paises, edad_min: Number(f.edadMin), edad_max: Number(f.edadMax),
            nombre: f.nombre || undefined,
          });
          if (f.forma === 'post') {
            if (!f.post) throw new Error(T('Pega el enlace del post de Instagram.', 'Paste the Instagram post link.'));
            const p = await (await fetch(`/api/marketing/ads/post?url=${encodeURIComponent(f.post)}${qMarca() ? '&' + qMarca() : ''}`, { credentials: 'include' })).json();
            if (!p || p.error) throw new Error((p && p.error) || T('No se encontró ese post.', 'That post was not found.'));
            cuerpo.ig_media_id = p.ig_media_id;
          } else {
            if (!f.imagen || !f.texto) throw new Error(T('Falta la foto o el texto.', 'Photo or text missing.'));
            cuerpo.imagen_url = f.imagen; cuerpo.texto = f.texto; cuerpo.titular = f.titular;
          }
          const r = await (await fetch('/api/marketing/ads/crear', {
            method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo),
          })).json();
          if (!r || r.error) throw new Error((r && r.error) || 'Error');
          toast(T('Campaña creada y PAUSADA. Revísala y enciéndela cuando quieras.', 'Campaign created and PAUSED. Review it and turn it on when ready.'), { type: 'success' });
          close();
          render();
        } catch (e) {
          toast((e && e.message) || T('No se pudo crear.', 'Could not create.'), { type: 'error' });
          crear.disabled = false; crear.textContent = T('Crear pausada', 'Create paused');
        }
      });

      body.append(
        campo(T('¿Qué quieres que pase?', 'What should happen?'), opciones('objetivo', [
          ['WHATSAPP', T('Mensajes a WhatsApp', 'WhatsApp messages')],
          ['INSTAGRAM', T('Mensajes de Instagram', 'Instagram messages')],
          ['MESSENGER', 'Messenger'],
          ['TRAFICO', T('Visitas a un enlace', 'Link visits')],
        ], pintarDestino)),
        destino,
        campo(T('El anuncio', 'The ad'), opciones('forma', [
          ['post', T('Un post de Instagram', 'An Instagram post')],
          ['foto', T('Foto y texto', 'Photo and text')],
        ], pintarAnuncio)),
        anuncio,
        campo(T('¿Dónde?', 'Where?'), paises),
        el('div', { class: 'pauta-f__fila' }, [
          campo(T('Edad desde', 'Age from'), entrada('edadMin', { type: 'number', min: '18', max: '65' })),
          campo(T('hasta', 'to'), entrada('edadMax', { type: 'number', min: '18', max: '65' })),
        ]),
        el('div', { class: 'pauta-f__fila' }, [
          campo(T(`Presupuesto al día (${moneda})`, `Daily budget (${moneda})`), entrada('presupuesto', { type: 'number', min: '20', step: '10' })),
          campo(T('Días', 'Days'), entrada('dias', { type: 'number', min: '1', max: '30' })),
        ]),
        campo(T('Nombre (opcional)', 'Name (optional)'), entrada('nombre', { placeholder: T('Se pone solo si lo dejas vacío', 'Auto if empty') })),
        total,
        el('div', { class: 'sheet__footer' }, [crear]),
      );
    },
  });
}

// ── Tablero de TODAS las marcas ─────────────────────────────────────────────
async function renderTodas() {
  rootEl.appendChild(el('div', { class: 'mk-head' }, [
    el('h1', { class: 'mk-title', text: T('Pauta', 'Ads') }),
    el('p', { class: 'mk-sub', text: T(
      'Los anuncios pagados de cada marca: lo que gastó y lo que devolvió en los últimos 30 días. Toca una marca para ver sus campañas.',
      'Paid ads for every brand: what it spent and returned in the last 30 days. Tap a brand to see its campaigns.',
    ) }),
  ]));
  const host = el('div', { class: 'pauta-marcas' }, [el('div', { class: 'pauta-empty' }, [el('span', { class: 'spinner' })])]);
  rootEl.appendChild(host);
  let d = null;
  try { d = await (await fetch('/api/marketing/ads/marcas', { credentials: 'include' })).json(); } catch { /* abajo */ }
  clear(host);
  if (!d || d.error) {
    host.appendChild(vacio('warning', T('No se pudo leer', 'Could not load'), (d && d.error) || T('Reintenta.', 'Try again.')));
    return;
  }

  // Totales por moneda (no se suman pesos con dólares).
  const tot = new Map();
  const sumar = (moneda, g, r) => {
    const t = tot.get(moneda) || { g: 0, r: 0, n: 0 };
    t.g += Number(g) || 0; t.r += Number(r) || 0; t.n += 1;
    tot.set(moneda, t);
  };
  if (d.casa) sumar(d.casa.moneda || 'MXN', d.casa.gasto_30d, d.casa.resultados_30d);
  for (const m of d.marcas) if (m.conectada) sumar((m.cuenta && m.cuenta.moneda) || 'MXN', m.gasto_30d, m.resultados_30d);
  if (tot.size) {
    host.appendChild(el('div', { class: 'pauta-resumen' }, [
      el('div', { class: 'pauta-resumen__t', text: T('Todas las cuentas · últimos 30 días', 'All accounts · last 30 days') }),
      el('div', { class: 'pauta-datos' }, [...tot.entries()].flatMap(([mon, t]) => [
        el('div', { class: 'pauta-dato' }, [el('div', { class: 'pauta-dato__v', text: gasto(t.g, mon) }), el('div', { class: 'pauta-dato__k', text: T(`Gastado (${mon})`, `Spent (${mon})`) })]),
        el('div', { class: 'pauta-dato' }, [el('div', { class: 'pauta-dato__v', text: num(t.r) }), el('div', { class: 'pauta-dato__k', text: T('Resultados', 'Results') })]),
        t.r ? el('div', { class: 'pauta-dato' }, [el('div', { class: 'pauta-dato__v', text: gasto(t.g / t.r, mon) }), el('div', { class: 'pauta-dato__k', text: T('Costo por resultado', 'Cost per result') })]) : null,
      ].filter(Boolean))),
    ]));
  }

  const lista = el('div', { class: 'pauta-mlista' });
  host.appendChild(lista);
  const filaMarca = ({ id, nombre, color, conectada, cuenta, gasto_30d, resultados_30d, costo_resultado, moneda }) => {
    const abrir = () => { vista = id; render(); };
    const datos = conectada ? el('div', { class: 'pauta-mfila__nums' }, [
      el('span', { text: gasto(gasto_30d, moneda) }),
      el('span', { text: `${num(resultados_30d)} ${T('resultados', 'results')}` }),
      el('span', { text: costo_resultado != null ? `${gasto(costo_resultado, moneda)} ${T('c/u', 'each')}` : '—' }),
    ]) : null;
    return el('div', { class: 'pauta-mfila' + (conectada ? '' : ' is-off') }, [
      el('span', { class: 'pauta-mfila__dot', style: { background: color || 'var(--brand, #7c3aed)' } }),
      el('div', { class: 'pauta-mfila__main' }, [
        el('div', { class: 'pauta-mfila__name', text: nombre }),
        el('div', { class: 'pauta-mfila__sub', text: conectada
          ? [cuenta && cuenta.nombre, cuenta && cuenta.modo === 'casa' ? T('cuenta de la casa', 'house account') : null, cuenta && cuenta.auto ? T('IA moviendo', 'AI moving') : null].filter(Boolean).join(' · ')
          : T('Sin cuenta publicitaria', 'No ad account') }),
        datos,
      ].filter(Boolean)),
      el('button', {
        class: 'btn btn-sm' + (conectada ? '' : ' btn-primary'), type: 'button',
        text: conectada ? T('Ver', 'Open') : T('Conectar', 'Connect'),
        onclick: () => (conectada ? abrir() : conectar(id)),
      }),
    ]);
  };
  if (d.casa) {
    lista.appendChild(filaMarca({
      id: 'casa', nombre: T('IVAE (la casa)', 'IVAE (house)'), color: '#c8a96a', conectada: true,
      cuenta: { nombre: d.casa.cuenta }, gasto_30d: d.casa.gasto_30d, resultados_30d: d.casa.resultados_30d,
      costo_resultado: d.casa.costo_resultado, moneda: d.casa.moneda,
    }));
  }
  for (const m of d.marcas) {
    lista.appendChild(filaMarca({
      id: m.client_id, nombre: m.nombre, color: m.color, conectada: m.conectada, cuenta: m.cuenta,
      gasto_30d: m.gasto_30d, resultados_30d: m.resultados_30d, costo_resultado: m.costo_resultado,
      moneda: (m.cuenta && m.cuenta.moneda) || 'MXN',
    }));
  }
  host.appendChild(el('p', { class: 'pauta-nota', text: T(
    'Para manejar la pauta de un cliente: pídele que agregue a IVAE como socio en su Business Manager (Configuración del negocio → Socios) con acceso a su cuenta publicitaria, y luego toca Conectar con tu Facebook. Si la marca es tuya, conecta con el Facebook que administra la cuenta.',
    "To run a client's ads: ask them to add IVAE as a partner in their Business Manager (Business settings → Partners) with access to their ad account, then tap Connect with your Facebook. If the brand is yours, connect with the Facebook that manages the account.",
  ) }));
}

function vacio(iconName, titulo, texto, boton) {
  return el('div', { class: 'pauta-empty' }, [
    icon(iconName, 28),
    el('h2', { text: titulo }),
    el('p', { text: texto }),
    boton || null,
  ].filter(Boolean));
}

async function conectar(marca) {
  const id = marca !== undefined ? marca : (esMarca() ? vista : null);
  const qs = [id && id !== 'casa' ? `client_id=${encodeURIComponent(id)}` : null, isEN ? 'lang=en' : null].filter(Boolean).join('&');
  const url = `/api/marketing/ads/login${qs ? '?' + qs : ''}`;
  const r = await fetch(url, { credentials: 'include', redirect: 'manual' });
  if (r.status === 503) {
    let msg = T('Falta configurar la pauta en la app de Meta.', 'Ads setup is missing in the Meta app.');
    try { const d = await r.json(); if (d && d.error) msg = d.error; } catch { /* sin cuerpo */ }
    toast(msg, { type: 'error' });
    return;
  }
  window.location.href = url;
}

async function render() {
  if (!rootEl) return;
  clear(rootEl);
  if (!esAdmin() && !esCliente()) {
    rootEl.appendChild(vacio('lock', T('Solo la dueña', 'Owner only'), T(
      'La pauta la maneja la dueña de la agencia y cada marca la suya.',
      'Ads are run by the agency owner, and each brand runs its own.',
    )));
    return;
  }
  if (esCliente()) vista = miMarca() || 'todas';
  if (vista === 'todas') { await renderTodas(); return; }

  const cargando = el('div', { class: 'pauta-empty' }, [el('span', { class: 'spinner' })]);
  rootEl.appendChild(cargando);

  let estado = null;
  try {
    estado = await (await fetch(`/api/marketing/ads/estado${qMarca() ? '?' + qMarca() : ''}`, { credentials: 'include' })).json();
  } catch {
    cargando.remove();
    rootEl.appendChild(cabecera(null));
    rootEl.appendChild(vacio('warning', T('Sin conexión', 'Offline'), T('No se pudo consultar. Reintenta.', 'Could not check. Try again.')));
    return;
  }
  cargando.remove();
  rootEl.appendChild(cabecera(estado));

  if (!estado || !estado.conectada) {
    rootEl.appendChild(vacio(
      'link',
      T('Conecta la cuenta publicitaria', 'Connect the ad account'),
      estado && estado.falta_config
        ? estado.falta_config
        : (esMarca()
          ? (esCliente()
            ? T(
              'Conecta la cuenta publicitaria de tu empresa con el Facebook que la administra. Vas a ver tus campañas, lo que gastan y lo que te devuelven, y podrás crear las tuyas. Tu agencia también la verá para ayudarte.',
              "Connect your business ad account with the Facebook that manages it. You'll see your campaigns, what they spend and what they return, and you can create your own. Your agency will see it too, to help you.",
            )
            : T(
              `Para ver y manejar la pauta de ${nombreMarca(vista)}: si es tu cliente, que agregue a IVAE como socio en su Business Manager con acceso a su cuenta publicitaria; luego conecta con tu Facebook y elige su cuenta. También la puede conectar el cliente desde su app.`,
              `To see and run ads for ${nombreMarca(vista)}: if it is your client, they add IVAE as a partner in their Business Manager with access to their ad account; then connect with your Facebook and pick their account. The client can also connect it from their app.`,
            ))
          : T(
            'Para leer tus campañas y sus números hace falta darle acceso a la cuenta publicitaria de IVAE.',
            "To read your campaigns and their numbers, the app needs access to IVAE's ad account.",
          )),
      estado && estado.falta_config ? null : el('button', {
        class: 'btn btn-primary', type: 'button',
        text: T('Conectar cuenta publicitaria', 'Connect ad account'),
        onclick: () => conectar(),
      }),
    ));
    return;
  }

  const moneda = (estado.cuenta && estado.cuenta.currency) || 'MXN';

  // Sin método de pago Meta no deja publicar: se avisa aquí, no cuando falle.
  if (estado.pago && !estado.pago.medio_pago) {
    rootEl.appendChild(el('div', { class: 'pauta-aviso' }, [
      icon('warning', 18),
      el('span', { text: T(
        'Esta cuenta no tiene método de pago, así que Meta no va a dejar publicar ninguna campaña. Ponlo en Business Manager, en la cuenta publicitaria.',
        'This account has no payment method, so Meta will not let any campaign run. Add it in Business Manager, on the ad account.',
      ) }),
    ]));
  }

  const cerebro = el('div', { class: 'pauta-cerebro' });
  rootEl.appendChild(cerebro);
  pintarCerebro(cerebro).catch(() => { /* el cerebro es un extra: nunca tumba la vista */ });

  const lista = el('div', { class: 'pauta-grid' });
  rootEl.appendChild(lista);
  lista.appendChild(el('div', { class: 'pauta-empty' }, [el('span', { class: 'spinner' })]));

  let data = null;
  try {
    data = await (await fetch(`/api/marketing/ads/campanas?dias=${dias}${qMarca() ? '&' + qMarca() : ''}`, { credentials: 'include' })).json();
  } catch { /* se trata abajo */ }
  clear(lista);

  if (!data || data.error) {
    lista.appendChild(vacio('warning', T('No se pudieron leer las campañas', 'Could not read campaigns'), (data && data.error) || ''));
    return;
  }
  if (!data.campanas.length) {
    lista.appendChild(vacio('spark', T('Todavía no hay campañas', 'No campaigns yet'), T(
      'Cuando crees la primera en Meta, aparece aquí con sus números.',
      'When you create the first one in Meta, it shows up here with its numbers.',
    )));
    return;
  }

  // Con 71 campañas (casi todas promociones viejas de un post) una lista plana
  // no sirve para decidir: primero lo que SÍ gastó en el periodo, de mayor a
  // menor, y lo que no gastó se queda detrás de un botón.
  const gastoDe = (c) => {
    const ins = (c.insights && c.insights.data && c.insights.data[0]) || null;
    return ins ? (Number(ins.spend) || 0) : 0;
  };
  const conGasto = data.campanas.filter((c) => gastoDe(c) > 0).sort((a, b) => gastoDe(b) - gastoDe(a));
  // Una campaña recién creada todavía no gastó, así que caía en el montón
  // escondido: justo la que hay que ver para encenderla. Las de los últimos 14
  // días salen siempre, arriba del todo.
  const recientes = data.campanas.filter((c) => {
    if (gastoDe(c) > 0) return false;
    const t = c.created_time ? Date.parse(c.created_time) : 0;
    return t && (Date.now() - t) < 14 * 864e5;
  });
  const idsArriba = new Set([...conGasto, ...recientes].map((c) => c.id));
  const sinGasto = data.campanas.filter((c) => !idsArriba.has(c.id));

  lista.parentNode.insertBefore(resumen(conGasto, moneda), lista);

  if (recientes.length) {
    lista.appendChild(el('div', { class: 'pauta-sec', text: T('Nuevas, sin gastar todavía', 'New, nothing spent yet') }));
    for (const c of recientes) {
      try { lista.appendChild(tarjetaCampana(c, moneda)); }
      catch (e) { console.error('[pauta] tarjeta', c && c.id, e); }
    }
    if (conGasto.length) lista.appendChild(el('div', { class: 'pauta-sec', text: T('Con gasto en este periodo', 'With spend in this period') }));
  }

  if (!conGasto.length) {
    lista.appendChild(vacio('spark', T('Nada gastó en este periodo', 'Nothing spent in this period'), T(
      'Prueba con un rango más amplio arriba.',
      'Try a wider range above.',
    )));
  }
  // Una tarjeta que reviente no puede llevarse la lista entera por delante:
  // asi fue como un error de una variable dejo la pantalla vacia sin avisar.
  for (const c of conGasto) {
    try { lista.appendChild(tarjetaCampana(c, moneda)); }
    catch (e) { console.error('[pauta] tarjeta', c && c.id, e); }
  }

  if (sinGasto.length) {
    const masHost = el('div', { class: 'pauta-mas' });
    const btn = el('button', {
      class: 'btn', type: 'button',
      text: T(`Ver ${sinGasto.length} campañas sin gasto en este periodo`, `Show ${sinGasto.length} campaigns with no spend in this period`),
      onclick: () => {
        btn.remove();
        for (const c of sinGasto) lista.appendChild(tarjetaCampana(c, moneda));
      },
    });
    masHost.appendChild(btn);
    lista.parentNode.appendChild(masHost);
  }
}

// La fila de arriba: lo que se gastó en total y qué devolvió. Es el numero que
// se mira primero para decidir si una pauta sigue.
function resumen(campanas, moneda) {
  let gastado = 0; let alcance = 0; let clics = 0; let resultados = 0;
  let tipoRes = null;
  for (const c of campanas) {
    const ins = (c.insights && c.insights.data && c.insights.data[0]) || null;
    if (!ins) continue;
    gastado += Number(ins.spend) || 0;
    alcance += Number(ins.reach) || 0;
    clics += Number(ins.clicks) || 0;
    const r = resultadoDe(ins);
    if (r) { resultados += r.valor; tipoRes = tipoRes || r.tipo; }
  }
  const dato = (etiqueta, valor) => el('div', { class: 'pauta-dato' }, [
    el('div', { class: 'pauta-dato__v', text: valor }),
    el('div', { class: 'pauta-dato__k', text: etiqueta }),
  ]);
  return el('div', { class: 'pauta-resumen' }, [
    el('div', { class: 'pauta-resumen__t', text: T(`${campanas.length} campañas con gasto`, `${campanas.length} campaigns with spend`) }),
    el('div', { class: 'pauta-datos' }, [
      dato(T('Gastado', 'Spent'), gasto(gastado, moneda)),
      dato(T('Alcance', 'Reach'), num(alcance)),
      dato(T('Clics', 'Clicks'), num(clics)),
      resultados
        ? dato((NOMBRE_ACCION[tipoRes] || (() => tipoRes))(), num(resultados))
        : null,
      resultados
        ? dato(T('Costo por resultado', 'Cost per result'), gasto(gastado / resultados, moneda))
        : (clics ? dato(T('Costo por clic', 'Cost per click'), gasto(gastado / clics, moneda)) : null),
    ].filter(Boolean)),
  ]);
}


const ETIQUETA_ACCION = {
  pausar: () => T('Pausar', 'Pause'),
  activar: () => T('Activar', 'Activate'),
  presupuesto: () => T('Presupuesto', 'Budget'),
  dejar: () => T('Dejar', 'Keep'),
};

// ── El cerebro: lo que decidí, con qué freno y qué moví ──────────────────────
// Va ARRIBA de las campañas a propósito: primero la decisión, después el
// detalle. Es lo que pidió la dueña ("que tú veas y hagas los movimientos").
async function pintarCerebro(host) {
  let d = null;
  try { d = await (await fetch(`/api/marketing/ads/bitacora${qMarca() ? '?' + qMarca() : ''}`, { credentials: 'include' })).json(); } catch { return; }
  if (!d || d.error) return;
  clear(host);

  const sw = el('button', {
    class: 'pauta-sw' + (d.auto ? ' is-on' : ''), type: 'button',
    'aria-pressed': String(!!d.auto),
    onclick: async () => {
      sw.disabled = true;
      try {
        await fetch('/api/marketing/ads/ajustes', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(conMarca({ auto: !d.auto })),
        });
        toast(!d.auto
          ? T('Listo: de ahora en adelante muevo la pauta sola.', 'Done: from now on I move the ads myself.')
          : T('Apagado. Voy a seguir opinando, pero sin tocar nada.', 'Off. I will keep advising, but touch nothing.'), { type: 'success' });
        await pintarCerebro(host);
      } catch { sw.disabled = false; }
    },
  }, [el('span', { class: 'pauta-sw__dot' }), el('span', { text: d.auto
    ? T('Moviendo sola', 'Moving on its own')
    : T('Solo opina', 'Advice only') })]);

  const revisar = el('button', {
    class: 'btn btn-primary', type: 'button',
    text: T('Revisar ahora', 'Review now'),
    onclick: async () => {
      revisar.disabled = true;
      revisar.textContent = T('Leyendo los números…', 'Reading the numbers…');
      try {
        const r = await (await fetch('/api/marketing/ads/revisar', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(conMarca({})),
        })).json();
        if (r && r.error) toast(r.error, { type: 'error' });
        else toast(r.aplicadas
          ? T(`Hice ${r.aplicadas} movimiento(s).`, `Made ${r.aplicadas} change(s).`)
          : T('Revisado. No había nada que mover.', 'Reviewed. Nothing to move.'), { type: 'success' });
      } catch { toast(T('No se pudo revisar.', 'Could not review.'), { type: 'error' }); }
      revisar.disabled = false;
      revisar.textContent = T('Revisar ahora', 'Review now');
      await pintarCerebro(host);
    },
  });

  const cab = el('div', { class: 'pauta-cerebro__top' }, [
    el('div', { class: 'pauta-cerebro__t', text: T('Qué decidí', 'What I decided') }),
    el('div', { class: 'pauta-cerebro__acc' }, [sw, revisar]),
  ]);

  const cuerpo = el('div', { class: 'pauta-cerebro__body' });
  const u = d.ultima;
  if (!u) {
    cuerpo.appendChild(el('p', { class: 'pauta-cerebro__vacio', text: T(
      'Todavía no he revisado. Cada noche guardo lo que gastó y devolvió cada campaña, y con eso decido. También puedes pedirme que revise ahora.',
      "I have not reviewed yet. Every night I save what each campaign spent and returned, and decide from that. You can also ask me to review now.",
    ) }));
  } else {
    cuerpo.appendChild(el('p', { class: 'pauta-cerebro__lectura', text: u.lectura || '' }));
    const movidas = (u.decisiones || []).filter((x) => x.accion !== 'dejar');
    if (!movidas.length) {
      cuerpo.appendChild(el('p', { class: 'pauta-cerebro__vacio', text: T('No había nada que mover.', 'Nothing to move.') }));
    }
    for (const x of movidas) {
      cuerpo.appendChild(el('div', { class: 'pauta-dec' }, [
        el('span', { class: `pauta-dec__acc pauta-dec__acc--${x.accion}`, text: ETIQUETA_ACCION[x.accion] ? ETIQUETA_ACCION[x.accion]() : x.accion }),
        el('div', { class: 'pauta-dec__main' }, [
          el('div', { class: 'pauta-dec__name', text: x.nombre || x.campaign_id }),
          el('div', { class: 'pauta-dec__why', text: x.motivo || '' }),
          x.aplicada && x.despues
            ? el('div', { class: 'pauta-dec__ok', text: `${x.antes} → ${x.despues}` })
            : (x.error ? el('div', { class: 'pauta-dec__err', text: x.error })
              : el('div', { class: 'pauta-dec__pend', text: T('Sin aplicar (está en "solo opina")', 'Not applied (in "advice only")') })),
        ]),
      ]));
    }
    cuerpo.appendChild(el('div', { class: 'pauta-cerebro__pie', text: T(
      `Tope: ${d.tope} ${d.moneda || 'MXN'} al día entre todas.`,
      `Cap: ${d.tope} ${d.moneda || 'MXN'} a day across all.`,
    ) }));
  }

  host.append(cab, cuerpo);
}

function ensureCss() {
  const has = [...document.querySelectorAll('link[rel="stylesheet"]')]
    .some((l) => (l.getAttribute('href') || '').includes('/marketing/css/pauta.css'));
  if (has) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/marketing/css/pauta.css?v=202611220222';
  document.head.appendChild(link);
}

export default {
  id: VIEW_ID,
  mount(host, c) {
    ctx = c;
    ensureCss();
    rootEl = el('div', { class: 'pauta-root' });
    host.appendChild(rootEl);
    vista = vistaDesdeStore();
    // Si cambian la marca arriba, la pauta la sigue.
    unsubs.push(ctx.store.subscribe(['activeClientId'], () => { vista = vistaDesdeStore(); render(); }));
    render();
  },
  unmount() {
    for (const u of unsubs) { try { u(); } catch { /* noop */ } }
    unsubs = [];
    rootEl = null; ctx = null; vista = 'todas';
  },
};
