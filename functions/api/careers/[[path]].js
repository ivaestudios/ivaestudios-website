/* IVAE Studios — Vacantes / Careers API (Cloudflare Pages Function)
 *
 * Rutas:
 *   POST   /api/careers            → recibir postulación (multipart: datos + CV)
 *   GET    /api/careers            → listar postulaciones      (requiere admin)
 *   GET    /api/careers/cv/<id>    → descargar el CV           (requiere admin)
 *   DELETE /api/careers/<id>       → eliminar postulación + CV (requiere admin)
 *
 * Bindings (proyecto Pages, mismos que la galería): env.DB (D1), env.R2_BUCKET (R2).
 * La tabla se crea sola en el primer uso — no requiere migración manual.
 * Auth admin: Authorization: Bearer <clave>. La clave se valida contra
 * env.CAREERS_ADMIN_KEY si existe; si no, contra el hash SHA-256 embebido.
 */

const ADMIN_KEY_SHA256 = "396a5a265e187c38c9825452d59f907d5dd51b37f15487808ada97ab8a9da4da";

const MAX_CV_BYTES = 8 * 1024 * 1024; // 8 MB
const CV_TYPES = {
  "application/pdf": ".pdf",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
};

const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra },
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
       created_at TEXT NOT NULL
     )`
  ).run();
}

const clean = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function onRequest(context) {
  const { request, env, params } = context;
  const segs = Array.isArray(params.path) ? params.path : params.path ? [params.path] : [];

  try {
    // ── POST /api/careers — nueva postulación (público) ──
    if (request.method === "POST" && segs.length === 0) {
      const ct = request.headers.get("content-type") || "";
      if (!ct.includes("multipart/form-data")) return json({ ok: false, error: "Formato inválido." }, 400);

      const form = await request.formData();

      // honeypot anti-spam: campo oculto que los humanos dejan vacío
      if (clean(form.get("website"), 100)) return json({ ok: true });

      const nombre = clean(form.get("nombre"), 120);
      const email = clean(form.get("email"), 160);
      const telefono = clean(form.get("telefono"), 40);
      const puesto = clean(form.get("puesto"), 80);
      const mensaje = clean(form.get("mensaje"), 2000);
      const cv = form.get("cv");

      if (!nombre || nombre.length < 2) return json({ ok: false, error: "Escribe tu nombre." }, 400);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return json({ ok: false, error: "Revisa tu correo." }, 400);
      if (!(cv instanceof File) || cv.size === 0) return json({ ok: false, error: "Adjunta tu CV." }, 400);
      if (cv.size > MAX_CV_BYTES) return json({ ok: false, error: "El CV pesa más de 8 MB." }, 400);
      const ext = CV_TYPES[cv.type] || (/\.pdf$/i.test(cv.name) ? ".pdf" : /\.docx$/i.test(cv.name) ? ".docx" : /\.doc$/i.test(cv.name) ? ".doc" : null);
      if (!ext) return json({ ok: false, error: "El CV debe ser PDF o Word." }, 400);

      const id = crypto.randomUUID();
      const cvKey = `careers/cv/${id}${ext}`;
      const safeName = (cv.name || `cv${ext}`).replace(/[^\w.\- ()áéíóúÁÉÍÓÚñÑ]/g, "_").slice(0, 120);

      await env.R2_BUCKET.put(cvKey, cv.stream(), {
        httpMetadata: { contentType: cv.type || "application/octet-stream" },
        customMetadata: { originalName: safeName, applicant: nombre },
      });

      await ensureTable(env);
      await env.DB.prepare(
        `INSERT INTO careers_applications (id, nombre, email, telefono, puesto, mensaje, cv_key, cv_name, cv_size, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(id, nombre, email, telefono, puesto, mensaje, cvKey, safeName, cv.size, new Date().toISOString())
        .run();

      return json({ ok: true, id });
    }

    // ── Rutas de administración (requieren Bearer) ──
    if (!(await isAdmin(request, env))) return json({ ok: false, error: "No autorizado." }, 401);

    // GET /api/careers — listado
    if (request.method === "GET" && segs.length === 0) {
      await ensureTable(env);
      const { results } = await env.DB.prepare(
        `SELECT id, nombre, email, telefono, puesto, mensaje, cv_name, cv_size, created_at
           FROM careers_applications ORDER BY created_at DESC LIMIT 500`
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
          "content-disposition": `attachment; filename="${(row.cv_name || "cv.pdf").replace(/"/g, "")}"`,
          "cache-control": "no-store",
        },
      });
    }

    // DELETE /api/careers/<id>
    if (request.method === "DELETE" && segs[0] && segs.length === 1) {
      const row = await env.DB.prepare(`SELECT cv_key FROM careers_applications WHERE id = ?`).bind(segs[0]).first();
      if (!row) return json({ ok: false, error: "No encontrado." }, 404);
      if (row.cv_key) await env.R2_BUCKET.delete(row.cv_key);
      await env.DB.prepare(`DELETE FROM careers_applications WHERE id = ?`).bind(segs[0]).run();
      return json({ ok: true });
    }

    return json({ ok: false, error: "Ruta no válida." }, 404);
  } catch (err) {
    return json({ ok: false, error: "Error del servidor. Intenta de nuevo." }, 500);
  }
}
