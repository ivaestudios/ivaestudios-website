// ============================================================================
// IVAE Marketing — GET /api/marketing/dashboard (modulo importado).
//
// El prefijo `_` hace que Pages Functions NO genere una ruta para este
// archivo: lo importa el catch-all v2 (hoy entregado como _middleware.js) y
// expone handleDashboard(). NO tiene export onRequest a proposito.
// Sustituye al _dashboard.js v1 (huerfano, ya sin importadores): esta version
// usa binds 100% anonimos (?) en el MISMO orden textual del SQL.
//
// Contrato (ARCHITECTURE.md):
//   GET /dashboard?month=YYYY-MM[&client_id=]   (solo staff; el gate vive en
//   el router del catch-all)
//   -> { scope, client_id, month, today,
//        counters:{pending,week,overdue,monthTotal,noDate},
//        pipeline, approvals:{count,items}, week:{count,items},
//        overdue:{count,items}, platforms, activity:{streak,days[14]},
//        clients? (solo scope global), generated_at }
//
// Reglas:
//   - UN solo env.DB.batch (Q1..Q8, debajo del tope de 10), cero N+1.
//   - Fechas en hora de Cancun (UTC-5 fijo; Quintana Roo no tiene DST).
//   - Items SIEMPRE como postLite (allowlist explicita: nada interno viaja).
//   - Binds 100% anonimos (?) en el MISMO orden textual del SQL.
//   - Definiciones canonicas, identicas a counts.pending del catch-all:
//       pending  = approval_state IN ('pending','changes') AND client_visible=1
//       overdue  = publish_date < hoy AND status != 'publicado'
//   - Es el UNICO agregador: el GET /stats de la propuesta A fue eliminado;
//     services/stats.js cachea este payload en el frontend.
// ============================================================================

const TZ_MODIFIER = '-5 hours'; // Cancun = UTC-5 fijo, sin DST

// Allowlist explicita de campos que viajan en las mini-listas del dashboard.
const POST_LITE_FIELDS = [
  'id', 'title', 'publish_date', 'status', 'approval_state',
  'platform', 'content_type', 'client_id'
];

function postLite(row) {
  const out = {};
  for (const f of POST_LITE_FIELDS) out[f] = row[f] === undefined ? null : row[f];
  return out;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json' }
  });
}

// Hoy en Cancun (UTC-5) como YYYY-MM-DD.
function cancunToday() {
  return new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10);
}

// Suma n dias a una fecha YYYY-MM-DD (aritmetica UTC, sin DST).
function addDaysISO(ymd, n) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

// handleDashboard(request, env, session, url) -> Response
// `url` ya viene con el prefijo /api/marketing recortado por el catch-all.
export async function handleDashboard(request, env, session, url) {
  const today = cancunToday();

  let month = url.searchParams.get('month') || today.slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return json({ error: 'Mes invalido, usa AAAA-MM' }, 400);
  }
  const clientId = url.searchParams.get('client_id') || null;
  const weekEnd = addDaysISO(today, 6);

  // ── Scope ──
  // Cliente: filtra por client_id. Global: solo clientes NO archivados.
  const scopeCond = clientId ? 'p.client_id = ?' : 'c.archived = 0';
  const scopeBind = clientId ? [clientId] : [];
  const FROM = 'FROM mkt_posts p JOIN mkt_clients c ON c.id = p.client_id';
  const liteCols = POST_LITE_FIELDS.map((f) => 'p.' + f).join(', ');

  // ── Q1: contadores (una fila). Binds en orden textual del SQL. ──
  const qCounters = env.DB.prepare(
    `SELECT
       SUM(CASE WHEN p.approval_state IN ('pending','changes') AND p.client_visible = 1 THEN 1 ELSE 0 END) AS pending,
       SUM(CASE WHEN p.publish_date >= ? AND p.publish_date <= ? THEN 1 ELSE 0 END) AS week,
       SUM(CASE WHEN p.publish_date IS NOT NULL AND p.publish_date < ? AND p.status != 'publicado' THEN 1 ELSE 0 END) AS overdue,
       SUM(CASE WHEN substr(p.publish_date, 1, 7) = ? THEN 1 ELSE 0 END) AS monthTotal,
       SUM(CASE WHEN p.publish_date IS NULL THEN 1 ELSE 0 END) AS noDate
     ${FROM} WHERE ${scopeCond}`
  ).bind(today, weekEnd, today, month, ...scopeBind);

  // ── Q2: pipeline por estado (scope completo, sin filtro de mes) ──
  const qPipeline = env.DB.prepare(
    `SELECT p.status AS status, COUNT(*) AS count ${FROM} WHERE ${scopeCond} GROUP BY p.status`
  ).bind(...scopeBind);

  // ── Q3: por aprobar (mini-lista, 5) ──
  const qApprovals = env.DB.prepare(
    `SELECT ${liteCols} ${FROM}
      WHERE ${scopeCond}
        AND p.approval_state IN ('pending','changes') AND p.client_visible = 1
      ORDER BY (p.publish_date IS NULL) ASC, p.publish_date ASC, p.position ASC
      LIMIT 5`
  ).bind(...scopeBind);

  // ── Q4: proximos 7 dias (mini-lista, 8) ──
  const qWeek = env.DB.prepare(
    `SELECT ${liteCols} ${FROM}
      WHERE ${scopeCond} AND p.publish_date >= ? AND p.publish_date <= ?
      ORDER BY p.publish_date ASC, p.position ASC
      LIMIT 8`
  ).bind(...scopeBind, today, weekEnd);

  // ── Q5: atrasados (mini-lista, 8) ──
  const qOverdue = env.DB.prepare(
    `SELECT ${liteCols} ${FROM}
      WHERE ${scopeCond}
        AND p.publish_date IS NOT NULL AND p.publish_date < ?
        AND p.status != 'publicado'
      ORDER BY p.publish_date ASC
      LIMIT 8`
  ).bind(...scopeBind, today);

  // ── Q6: plataformas del mes (donut) ──
  const qPlatforms = env.DB.prepare(
    `SELECT COALESCE(p.platform, 'Otro') AS platform, COUNT(*) AS count ${FROM}
      WHERE ${scopeCond} AND substr(p.publish_date, 1, 7) = ?
      GROUP BY COALESCE(p.platform, 'Otro')
      ORDER BY count DESC`
  ).bind(...scopeBind, month);

  // ── Q7: actividad de los ultimos 14 dias locales (racha) ──
  const qActivity = env.DB.prepare(
    `SELECT date(a.created_at, '${TZ_MODIFIER}') AS d, COUNT(*) AS c
       FROM mkt_activity a
      WHERE a.created_at >= datetime('now', '-15 days')
        ${clientId ? 'AND a.client_id = ?' : ''}
      GROUP BY d`
  ).bind(...(clientId ? [clientId] : []));

  // ── Q8: cards por cliente (SOLO scope global), ordenadas por urgencia ──
  const qClients = clientId ? null : env.DB.prepare(
    `SELECT c.id, c.name, c.brand_color,
            COUNT(p.id) AS posts,
            SUM(CASE WHEN p.approval_state IN ('pending','changes') AND p.client_visible = 1 THEN 1 ELSE 0 END) AS pending,
            SUM(CASE WHEN p.publish_date IS NOT NULL AND p.publish_date < ? AND p.status != 'publicado' THEN 1 ELSE 0 END) AS overdue,
            SUM(CASE WHEN p.publish_date >= ? AND p.publish_date <= ? THEN 1 ELSE 0 END) AS week
       FROM mkt_clients c
       LEFT JOIN mkt_posts p ON p.client_id = c.id
      WHERE c.archived = 0
      GROUP BY c.id
      ORDER BY overdue DESC, pending DESC, c.name COLLATE NOCASE ASC`
  ).bind(today, today, weekEnd);

  // ── UN solo round-trip a D1 ──
  const stmts = [qCounters, qPipeline, qApprovals, qWeek, qOverdue, qPlatforms, qActivity];
  if (qClients) stmts.push(qClients);
  const results = await env.DB.batch(stmts);

  const rowsOf = (i) => (results[i] && results[i].results) || [];
  const countersRow = rowsOf(0)[0] || {};
  const counters = {
    pending: countersRow.pending || 0,
    week: countersRow.week || 0,
    overdue: countersRow.overdue || 0,
    monthTotal: countersRow.monthTotal || 0,
    noDate: countersRow.noDate || 0
  };

  const pipeline = rowsOf(1).map((r) => ({ status: r.status, count: r.count }));
  const approvalsItems = rowsOf(2).map(postLite);
  const weekItems = rowsOf(3).map(postLite);
  const overdueItems = rowsOf(4).map(postLite);
  const platforms = rowsOf(5).map((r) => ({ platform: r.platform, count: r.count }));

  // ── Racha de actividad: 14 dias locales terminando hoy ──
  const byDay = {};
  for (const r of rowsOf(6)) byDay[r.d] = r.c;
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = addDaysISO(today, -i);
    days.push({ date: d, count: byDay[d] || 0 });
  }
  // Dias consecutivos con actividad terminando hoy; si hoy aun no hay
  // actividad, la racha cuenta desde ayer hacia atras (criterio amable).
  let streak = 0;
  let idx = days.length - 1;
  if (days[idx].count === 0) idx -= 1;
  for (; idx >= 0 && days[idx].count > 0; idx--) streak += 1;

  const payload = {
    scope: clientId ? 'client' : 'global',
    client_id: clientId,
    month,
    today,
    counters,
    pipeline,
    approvals: { count: counters.pending, items: approvalsItems },
    week: { count: counters.week, items: weekItems },
    overdue: { count: counters.overdue, items: overdueItems },
    platforms,
    activity: { streak, days },
    generated_at: new Date().toISOString()
  };

  if (!clientId) {
    payload.clients = rowsOf(7).map((r) => ({
      id: r.id,
      name: r.name,
      brand_color: r.brand_color,
      counts: {
        posts: r.posts || 0,
        pending: r.pending || 0,
        overdue: r.overdue || 0,
        week: r.week || 0
      }
    }));
  }

  return json(payload);
}
