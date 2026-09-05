/* IVAE Studios — Vacantes / Careers API (Cloudflare Pages Function)
 *
 * Rutas:
 *   POST   /api/careers            → recibir postulación (multipart: datos + CV)
 *   GET    /api/careers            → listar postulaciones          (admin)
 *   GET    /api/careers/cv/<id>    → descargar el CV               (admin)
 *   PATCH  /api/careers/<id>       → actualizar estado             (admin)
 *   DELETE /api/careers/<id>       → eliminar postulación + CV     (admin)
 *
 * Bindings (proyecto Pages): env.DB (D1), env.R2_BUCKET (R2), env.RESEND_API_KEY.
 * La tabla y columnas se crean/migran solas — no requiere migración manual.
 * Auth admin: Authorization: Bearer <correo:contraseña> → env.CAREERS_ADMIN_KEY o hash SHA-256 embebido.
 * Anti-abuso: honeypot + rate limit por IP (3 postulaciones / 10 min) + magic bytes del CV.
 */

const ADMIN_KEY_SHA256 = "ef45593e8fb2690f2364f47e393cbd16a9ea16680aedf68e6abca8ccfef8680d"; // sha256("correo:contraseña")

const MAX_CV_BYTES = 8 * 1024 * 1024; // 8 MB
const RATE_LIMIT = { max: 3, windowMs: 10 * 60 * 1000 };
const ESTADOS = ["nuevo", "visto", "entrevista", "descartado", "contratado"];
const NOTIFY_TO = ["info@ivaestudios.com"];

const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      ...extra,
    },
  });

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function isAdmin(request, env) {
  const auth = request.headers.get("authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return false;
  const key = m[1].trim();
  if (env.CAREERS_ADMIN_KEY && key === env.CAREERS_ADMIN_KEY) return true;
  return (await sha256Hex(key)) === ADMIN_KEY_SHA256;
}

async function ensureTable(env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS careers_applications (
       id         TEXT PRIMARY KEY,
       nombre     TEXT NOT NULL,
       email      TEXT NOT NULL,
       telefono   TEXT,
       puesto     TEXT,
       mensaje    TEXT,
       cv_key     TEXT,
       cv_name    TEXT,
       cv_size    INTEGER,
       estado     TEXT DEFAULT 'nuevo',
       ip         TEXT,
       created_at TEXT NOT NULL
     )`
  ).run();
  // migraciones suaves para instalaciones previas (columna nueva sobre tabla vieja)
  for (const col of ["estado TEXT DEFAULT 'nuevo'", "ip TEXT"]) {
    try { await env.DB.prepare(`ALTER TABLE careers_applications ADD COLUMN ${col}`).run(); } catch (e) {}
  }
  try {
    await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_careers_created ON careers_applications(created_at)`).run();
  } catch (e) {}
}

/* Valida el contenido REAL del archivo (magic bytes), no solo el MIME que declara el navegador. */
function sniffCv(bytes, declaredType, name) {
  const b = new Uint8Array(bytes.slice(0, 8));
  const ascii = String.fromCharCode(...b.slice(0, 5));
  if (ascii.startsWith("%PDF-")) return { ext: ".pdf", type: "application/pdf" };
  if (b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04 && /\.docx$/i.test(name || ""))
    return { ext: ".docx", type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
  if (b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0)
    return { ext: ".doc", type: "application/msword" };
  return null;
}

const clean = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const escHtml = (s) => (s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

async function notifyNewApplication(env, app) {
  if (!env.RESEND_API_KEY) return;
  const html = `
    <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#141b26">
      <p style="letter-spacing:.2em;font-size:11px;color:#8a6d1f;font-family:Arial,sans-serif">IVAE STUDIOS · VACANTES</p>
      <h2 style="font-weight:400;margin:6px 0 18px">Nueva postulación: ${escHtml(app.nombre)}</h2>
      <table style="font-size:14px;line-height:1.9;font-family:Arial,sans-serif">
        <tr><td style="color:#888;padding-right:14px">Puesto</td><td><b>${escHtml(app.puesto || "Sin puesto")}</b></td></tr>
        <tr><td style="color:#888;padding-right:14px">Correo</td><td>${escHtml(app.email)}</td></tr>
        <tr><td style="color:#888;padding-right:14px">Teléfono</td><td>${escHtml(app.telefono || "")}</td></tr>
        <tr><td style="color:#888;padding-right:14px">CV</td><td>${escHtml(app.cv_name || "")} (${Math.round((app.cv_size || 0) / 1024)} KB)</td></tr>
      </table>
      ${app.mensaje ? `<p style="font-size:14px;background:#f7f5f0;padding:14px;border-radius:8px;font-family:Arial,sans-serif">${escHtml(app.mensaje)}</p>` : ""}
      <p style="margin-top:22px"><a href="https://ivaestudios.com/vacantes-admin" style="background:#141b26;color:#fff;text-decoration:none;padding:12px 22px;border-radius:6px;font-family:Arial,sans-serif;font-size:13px">Abrir el panel de vacantes →</a></p>
    </div>`;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: `Bearer ${env.RESEND_API_KEY}` },
      body: JSON.stringify({
        from: "IVAE Studios <info@ivaestudios.com>",
        to: NOTIFY_TO,
        reply_to: app.email,
        subject: `Vacantes · ${app.puesto || "Postulación"} · ${app.nombre}`,
        html,
      }),
    });
  } catch (e) { /* la notificación nunca debe tumbar la postulación */ }
}

async function sendApplicantThankYou(env, app) {
  if (!env.RESEND_API_KEY || !app.email) return;
  // Diseño navy autorado: si Gmail oscuro lo transforma, fondo y texto invierten JUNTOS (legible siempre).
  // El logo lleva la placa navy horneada en el PNG: Gmail recolorea fondos pero nunca píxeles de imagen.
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="x-apple-disable-message-reformatting"/>
<style>
  /* Outlook.com dark mode: re-forzar nuestros colores si intenta transformarlos */
  [data-ogsb] .bgpage { background-color:#0a0f17 !important; }
  [data-ogsb] .bgcard { background-color:#101724 !important; }
  [data-ogsb] .bgbox  { background-color:#151d2b !important; }
  [data-ogsc] .txmain { color:#faf8f5 !important; }
  [data-ogsc] .txbody { color:#c2c9d4 !important; }
  [data-ogsc] .txdim  { color:#8f97a6 !important; }
  [data-ogsc] .txgold { color:#d6b25e !important; }
</style>
</head>
<body style="margin:0;padding:0;background-color:#0a0f17" bgcolor="#0a0f17">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0a0f17" class="bgpage" style="background-color:#0a0f17">
    <tr><td align="center" style="padding:36px 14px">

      <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" bgcolor="#101724" class="bgcard" style="width:100%;max-width:560px;background-color:#101724;border:1px solid #212c3d;border-radius:14px">
        <tr><td align="center" style="padding:34px 24px 26px;border-bottom:1px solid #1c2534">
          <img src="https://ivaestudios.com/images/logo-ivae-email-plate.png" alt="IVAE STUDIOS" width="214" height="56" style="height:56px;width:auto;display:block;border:0"/>
        </td></tr>

        <tr><td style="padding:38px 34px 6px">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
            <td width="44" height="2" bgcolor="#c9a54e" style="background-color:#c9a54e;font-size:0;line-height:0">&nbsp;</td>
          </tr></table>
          <h1 class="txmain" style="font-family:Georgia,'Times New Roman',serif;font-weight:400;font-size:28px;line-height:1.3;color:#faf8f5;margin:22px 0 16px">Gracias por postularte.</h1>
          <p class="txbody" style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.75;color:#c2c9d4;margin:0 0 14px">Recibimos tu postulaci&oacute;n para la vacante de <b class="txmain" style="color:#faf8f5">${escHtml(app.puesto || "nuestro equipo")}</b> en IVAE Studios y tu CV lleg&oacute; correctamente.</p>
          <p class="txbody" style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.75;color:#c2c9d4;margin:0 0 14px">Revisamos cada solicitud personalmente. Si tu perfil avanza al siguiente paso, nos pondremos en contacto contigo por correo o WhatsApp.</p>
          <p class="txbody" style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.75;color:#c2c9d4;margin:0">Mientras tanto, puedes conocer nuestro trabajo en <a href="https://ivaestudios.com" class="txgold" style="color:#d6b25e;text-decoration:none;font-weight:bold">ivaestudios.com</a> y en <a href="https://instagram.com/ivae.studios" class="txgold" style="color:#d6b25e;text-decoration:none;font-weight:bold">Instagram</a>.</p>
        </td></tr>

        <tr><td style="padding:22px 34px 4px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#151d2b" class="bgbox" style="width:100%;background-color:#151d2b;border:1px solid #232e40;border-radius:10px;border-collapse:separate;border-spacing:0">
            <tr><td class="txdim" style="padding:16px 20px 6px;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:3px;color:#8f97a6;font-weight:bold">TU POSTULACI&Oacute;N</td></tr>
            <tr><td class="txbody" style="padding:0 20px 4px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#c2c9d4">Puesto: <b class="txmain" style="color:#faf8f5">${escHtml(app.puesto || "General")}</b></td></tr>
            <tr><td class="txbody" style="padding:0 20px 16px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#c2c9d4">CV recibido <span style="color:#d6b25e">&#10003;</span></td></tr>
          </table>
        </td></tr>

        <tr><td style="padding:24px 34px 34px">
          <p class="txbody" style="font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:16px;color:#c2c9d4;margin:0 0 6px">Con aprecio,</p>
          <p class="txgold" style="font-family:Arial,Helvetica,sans-serif;font-size:12px;letter-spacing:3px;color:#c9a54e;font-weight:bold;margin:0">IVAE STUDIOS</p>
        </td></tr>

        <tr><td align="center" style="border-top:1px solid #1c2534;padding:18px 20px">
          <p class="txdim" style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#8f97a6;margin:0">Canc&uacute;n &middot; Riviera Maya &middot; Los Cabos &middot; <a href="https://ivaestudios.com" class="txdim" style="color:#8f97a6;text-decoration:underline">ivaestudios.com</a></p>
        </td></tr>
      </table>

      <p class="txdim" style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#8f97a6;margin:16px 0 0">Recibiste este correo porque enviaste una postulaci&oacute;n en <a href="https://ivaestudios.com/vacantes" class="txdim" style="color:#8f97a6;text-decoration:underline">ivaestudios.com/vacantes</a>.</p>
    </td></tr>
  </table>
</body>
</html>`;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: `Bearer ${env.RESEND_API_KEY}` },
      body: JSON.stringify({
        from: "IVAE Studios <info@ivaestudios.com>",
        to: [app.email],
        subject: "Recibimos tu postulación · IVAE Studios",
        html,
      }),
    });
  } catch (e) { /* nunca tumbar la postulación por el correo */ }
}

export async function onRequest(context) {
  const { request, env, params, waitUntil } = context;
  const segs = Array.isArray(params.path) ? params.path : params.path ? [params.path] : [];

  try {
    // ── POST /api/careers — nueva postulación (público) ──
    if (request.method === "POST" && segs.length === 0) {
      const ct = request.headers.get("content-type") || "";
      if (!ct.includes("multipart/form-data")) return json({ ok: false, error: "Formato inválido." }, 400);

      let form;
      try { form = await request.formData(); }
      catch (e) { return json({ ok: false, error: "No se pudo leer el formulario. Intenta de nuevo." }, 400); }

      // honeypot anti-spam: campo oculto que los humanos dejan vacío
      if (clean(form.get("contacto_fax"), 100) || clean(form.get("website"), 100)) return json({ ok: true });

      const nombre = clean(form.get("nombre"), 120);
      const email = clean(form.get("email"), 160).toLowerCase();
      const telefono = clean(form.get("telefono"), 40);
      const puesto = clean(form.get("puesto"), 80);
      const mensaje = clean(form.get("mensaje"), 2000);
      const cv = form.get("cv");

      if (!nombre || nombre.length < 2) return json({ ok: false, error: "Escribe tu nombre." }, 400);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return json({ ok: false, error: "Revisa tu correo." }, 400);
      if (!(cv instanceof File) || cv.size === 0) return json({ ok: false, error: "Adjunta tu CV." }, 400);
      if (cv.size > MAX_CV_BYTES) return json({ ok: false, error: "El CV pesa más de 8 MB." }, 400);

      const cvBytes = await cv.arrayBuffer();
      const kind = sniffCv(cvBytes, cv.type, cv.name);
      if (!kind) return json({ ok: false, error: "El CV debe ser un PDF o Word válido." }, 400);

      await ensureTable(env);

      // rate limit por IP: máx 3 postulaciones cada 10 minutos
      const ip = request.headers.get("cf-connecting-ip") || "";
      if (ip) {
        const since = new Date(Date.now() - RATE_LIMIT.windowMs).toISOString();
        const row = await env.DB.prepare(
          `SELECT COUNT(*) AS n FROM careers_applications WHERE ip = ? AND created_at > ?`
        ).bind(ip, since).first();
        if (row && row.n >= RATE_LIMIT.max)
          return json({ ok: false, error: "Recibimos varias postulaciones desde tu conexión. Espera unos minutos e intenta de nuevo." }, 429);
      }

      // Sin anti-duplicados por decisión de la dueña (2026-07-30): si envían dos veces,
      // llegan dos. Cada envío válido SIEMPRE se guarda y dispara sus dos correos.
      const id = crypto.randomUUID();
      const cvKey = `careers/cv/${id}${kind.ext}`;
      const safeName = (cv.name || `cv${kind.ext}`).replace(/[^\w.\- ()áéíóúÁÉÍÓÚñÑ]/g, "_").slice(0, 120);

      await env.R2_BUCKET.put(cvKey, cvBytes, {
        httpMetadata: { contentType: kind.type },
        customMetadata: { originalName: safeName, applicant: nombre },
      });

      try {
        await env.DB.prepare(
          `INSERT INTO careers_applications (id, nombre, email, telefono, puesto, mensaje, cv_key, cv_name, cv_size, estado, ip, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'nuevo', ?, ?)`
        )
          .bind(id, nombre, email, telefono, puesto, mensaje, cvKey, safeName, cv.size, ip, new Date().toISOString())
          .run();
      } catch (e) {
        // si la fila no se pudo guardar, no dejamos el CV huérfano en R2
        try { await env.R2_BUCKET.delete(cvKey); } catch (e2) {}
        throw e;
      }

      const app = { nombre, email, telefono, puesto, mensaje, cv_name: safeName, cv_size: cv.size };
      const notif = Promise.allSettled([notifyNewApplication(env, app), sendApplicantThankYou(env, app)]);
      if (typeof waitUntil === "function") waitUntil(notif);

      return json({ ok: true, id });
    }

    // ── Rutas de administración (requieren Bearer) ──
    if (!(await isAdmin(request, env))) return json({ ok: false, error: "No autorizado." }, 401);

    // GET /api/careers — listado
    if (request.method === "GET" && segs.length === 0) {
      await ensureTable(env);
      const { results } = await env.DB.prepare(
        `SELECT id, nombre, email, telefono, puesto, mensaje, cv_name, cv_size, estado, created_at
           FROM careers_applications ORDER BY created_at DESC LIMIT 1000`
      ).all();
      return json({ ok: true, applications: results || [] });
    }

    // GET /api/careers/cv/<id> — descargar CV
    if (request.method === "GET" && segs[0] === "cv" && segs[1]) {
      const row = await env.DB.prepare(`SELECT cv_key, cv_name FROM careers_applications WHERE id = ?`)
        .bind(segs[1])
        .first();
      if (!row || !row.cv_key) return json({ ok: false, error: "No encontrado." }, 404);
      const obj = await env.R2_BUCKET.get(row.cv_key);
      if (!obj) return json({ ok: false, error: "Archivo no disponible." }, 404);
      return new Response(obj.body, {
        headers: {
          "content-type": obj.httpMetadata?.contentType || "application/octet-stream",
          "content-disposition": `inline; filename="${(row.cv_name || "cv.pdf").replace(/["\\\r\n]/g, "")}"`,
          "cache-control": "no-store",
          "x-content-type-options": "nosniff",
        },
      });
    }

    // PATCH /api/careers/<id> — actualizar estado
    if (request.method === "PATCH" && segs[0] && segs.length === 1) {
      let body = {};
      try { body = await request.json(); } catch (e) {}
      const estado = clean(body.estado, 20).toLowerCase();
      if (!ESTADOS.includes(estado)) return json({ ok: false, error: "Estado inválido." }, 400);
      await ensureTable(env);
      const r = await env.DB.prepare(`UPDATE careers_applications SET estado = ? WHERE id = ?`)
        .bind(estado, segs[0]).run();
      if (!r.meta || r.meta.changes === 0) return json({ ok: false, error: "No encontrado." }, 404);
      return json({ ok: true, estado });
    }

    // DELETE /api/careers/<id>
    if (request.method === "DELETE" && segs[0] && segs.length === 1) {
      const row = await env.DB.prepare(`SELECT cv_key FROM careers_applications WHERE id = ?`).bind(segs[0]).first();
      if (!row) return json({ ok: false, error: "No encontrado." }, 404);
      if (row.cv_key) { try { await env.R2_BUCKET.delete(row.cv_key); } catch (e) {} }
      await env.DB.prepare(`DELETE FROM careers_applications WHERE id = ?`).bind(segs[0]).run();
      return json({ ok: true });
    }

    return json({ ok: false, error: "Ruta no válida." }, 404);
  } catch (err) {
    console.error("careers-api", request.method, segs.join("/"), err && err.message);
    return json({ ok: false, error: "Error del servidor. Intenta de nuevo." }, 500);
  }
}
