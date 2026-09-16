// ============================================================================
// IVAE Marketing — Vista "Pauta" (anuncios pagados de la casa, solo admin).
//
// Pedido de la dueña (14-sep-2026): "un sistema para pautar y que tú veas y
// hagas los movimientos según rendimiento". Esto es el PASO 1 de eso: conectar
// la cuenta publicitaria y VER los números. Decidir y mover va después, con su
// bitácora y su interruptor, para que ejecutar sea una decisión explícita.
//
// Hoy es SOLO la cuenta de IVAE (no de marcas cliente): por eso no hay
// selector de marca y la sección es de admin. Ver functions/api/marketing/_ads.js.
// ============================================================================
import { el, clear, toast } from '../api.js?v=202609161710';
import { icon } from '../shell/icons.js?v=202609161710';
import { T, isEN } from '../shell/i18n.js?v=202609161710';

const VIEW_ID = 'pauta';

let ctx = null;
let rootEl = null;
// 90 dias por defecto, LA MISMA ventana con la que decide la IA. Con 30 la
// pantalla decia "nada gasto" justo debajo de decisiones basadas en gasto real,
// que es la peor mezcla posible: parece que se contradice a si misma.
let dias = 90;

function esAdmin() { return ((ctx.store.getState().me || {}).role === 'admin'); }

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

function chipEstado(c) {
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
  const activa = estado === 'ACTIVE';
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
        body: JSON.stringify({ campaign_id: c.id, quien: 'persona' }),
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
    onclick: () => accion(
      activa ? 'apagar' : 'encender', bPrender,
      activa ? T('Pausando…', 'Pausing…') : T('Encendiendo…', 'Turning on…'),
      activa ? T('Pausada.', 'Paused.') : T('Encendida: ya está gastando.', 'On: it is spending now.'),
    ),
  });
  botones.push(bPrender);
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

function cabecera() {
  const sel = el('div', { class: 'pauta-rango' }, [7, 30, 90].map((d) => el('button', {
    class: 'btn btn-sm' + (d === dias ? ' is-active' : ''), type: 'button',
    text: T(`${d} días`, `${d} days`),
    onclick: () => { dias = d; render(); },
  })));
  return el('div', { class: 'mk-head' }, [
    el('h1', { class: 'mk-title', text: T('Pauta', 'Ads') }),
    el('p', { class: 'mk-sub', text: T(
      'Los anuncios pagados de IVAE. Aquí se ve qué gastó cada campaña y qué devolvió.',
      "IVAE's paid ads. What each campaign spent and what it returned.",
    ) }),
    sel,
  ]);
}

function vacio(iconName, titulo, texto, boton) {
  return el('div', { class: 'pauta-empty' }, [
    icon(iconName, 28),
    el('h2', { text: titulo }),
    el('p', { text: texto }),
    boton || null,
  ].filter(Boolean));
}

async function conectar() {
  const url = `/api/marketing/ads/login${isEN ? '?lang=en' : ''}`;
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
  if (!esAdmin()) {
    rootEl.appendChild(vacio('lock', T('Solo la dueña', 'Owner only'), T(
      'La pauta es dinero de la casa: esta sección no se comparte.',
      "Ads are the studio's own money: this section is not shared.",
    )));
    return;
  }
  rootEl.appendChild(cabecera());

  const cargando = el('div', { class: 'pauta-empty' }, [el('span', { class: 'spinner' })]);
  rootEl.appendChild(cargando);

  let estado = null;
  try {
    estado = await (await fetch('/api/marketing/ads/estado', { credentials: 'include' })).json();
  } catch {
    cargando.remove();
    rootEl.appendChild(vacio('warning', T('Sin conexión', 'Offline'), T('No se pudo consultar. Reintenta.', 'Could not check. Try again.')));
    return;
  }
  cargando.remove();

  if (!estado || !estado.conectada) {
    rootEl.appendChild(vacio(
      'link',
      T('Conecta tu cuenta publicitaria', 'Connect your ad account'),
      estado && estado.falta_config
        ? estado.falta_config
        : T(
          'Para leer tus campañas y sus números hace falta darle acceso a la cuenta publicitaria de IVAE.',
          "To read your campaigns and their numbers, the app needs access to IVAE's ad account.",
        ),
      estado && estado.falta_config ? null : el('button', {
        class: 'btn btn-primary', type: 'button',
        text: T('Conectar cuenta publicitaria', 'Connect ad account'),
        onclick: conectar,
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
    data = await (await fetch(`/api/marketing/ads/campanas?dias=${dias}`, { credentials: 'include' })).json();
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
  try { d = await (await fetch('/api/marketing/ads/bitacora', { credentials: 'include' })).json(); } catch { return; }
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
          body: JSON.stringify({ auto: !d.auto }),
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
          headers: { 'Content-Type': 'application/json' }, body: '{}',
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
      `Tope: ${d.tope} MXN al día entre todas.`,
      `Cap: ${d.tope} MXN a day across all.`,
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
  link.href = '/marketing/css/pauta.css?v=202609161710';
  document.head.appendChild(link);
}

export default {
  id: VIEW_ID,
  mount(host, c) {
    ctx = c;
    ensureCss();
    rootEl = el('div', { class: 'pauta-root' });
    host.appendChild(rootEl);
    render();
  },
  unmount() { rootEl = null; ctx = null; },
};
