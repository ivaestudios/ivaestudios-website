// ============================================================================
// IVAE Marketing — EL PUBLICADOR: sube la pieza programada a Instagram.
//
// Programación de contenido (2026-08-15): Instagram NO programa nativo por
// API, así que el reloj vive AQUÍ — el cron (cada 15 min, GitHub Actions con
// el mismo bearer de la galería) publica las piezas en status 'programado'
// cuya fecha y hora ya llegaron. Facebook llegará con el App Review
// (pages_manage_posts); Instagram usa el token POR MARCA que la app ya
// guarda (Instagram Login, mkt_clients.ig_access_token).
//
// v1: REELS (video_url en R2, público — justo lo que exige la API) y FOTO
// única. Carruseles después (piden contenedores hijos).
//
// OJO permisos: publicar exige el scope instagram_business_content_publish
// en el token de la marca. Los tokens viejos (solo insights) fallan con un
// error CLARO que queda en publish_error — se arregla reconectando la marca
// desde su ficha (el scope ya viene incluido en el botón de conectar).
// ============================================================================

const GRAPH = 'https://graph.instagram.com/v23.0';

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

async function gJson(url, init) {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    let msg = (data.error && (data.error.error_user_msg || data.error.message)) || `HTTP ${res.status}`;
    // Traducción de los errores que SÍ van a pasar, a idioma de Vianey:
    if (/missing permissions|does not support this operation|Unsupported post request/i.test(msg)) {
      msg = 'El Instagram de la marca está conectado con permisos viejos (solo lectura). Reconéctalo desde la ficha del cliente para otorgar el permiso de publicar.';
    } else if (/session has been invalidated|access token/i.test(msg)) {
      msg = 'El token de Instagram de la marca caducó — reconéctala desde su ficha.';
    }
    const e = new Error(msg);
    e.igCode = data.error && data.error.code;
    e.igSubcode = data.error && data.error.error_subcode;
    throw e;
  }
  return data;
}

// Colaboradores de la publicación: "@ana @luis" o "ana, luis" → hasta 3
// usernames limpios como los pide la API (el colaborador recibe la invitación
// en su Instagram y al aceptar el post aparece en ambos perfiles).
function listaColaboradores(post) {
  const crudo = String(post.collaborators || '').trim();
  if (!crudo) return null;
  const usuarios = crudo.split(/[\s,;]+/)
    .map((u) => u.replace(/^@+/, '').trim())
    .filter((u) => /^[\w.]{1,30}$/.test(u))
    .slice(0, 3);
  return usuarios.length ? JSON.stringify(usuarios) : null;
}

// El caption FINAL que ve Instagram: el copy + los hashtags (si no vienen ya
// dentro del caption). IG corta en 2200 chars — se respeta desde aquí.
function captionFinal(post) {
  const cap = String(post.caption || '').trim();
  const tags = String(post.hashtags || '').trim();
  const junto = tags && !cap.includes(tags.split(/\s+/)[0]) ? `${cap}\n\n${tags}` : cap;
  return junto.slice(0, 2200);
}

/**
 * Publica UNA pieza en el Instagram de su marca. Devuelve { mediaId, permalink }.
 * Lanza Error con mensaje humano si algo falta o IG rechaza.
 */
export async function publicarEnInstagram(env, { client, post, slides, cover, onContainer }) {
  if (!client || !client.ig_user_id || !client.ig_access_token) {
    throw new Error('La marca no tiene Instagram conectado (ficha del cliente → Conectar Instagram).');
  }
  const tok = client.ig_access_token;
  const tipo = String(post.content_type || '').toLowerCase();
  const caption = captionFinal(post);

  // CARRUSEL (2026-08-15): la API lo pide desarmado — un contenedor por
  // slide (JPEG público firmado) y un contenedor padre que los junta.
  if (slides && slides.length >= 2) {
    const hijos = [];
    for (const u of slides.slice(0, 10)) {
      const h = await gJson(`${GRAPH}/${client.ig_user_id}/media`, {
        method: 'POST',
        body: new URLSearchParams({ image_url: u, is_carousel_item: 'true', access_token: tok }),
      });
      if (!h.id) throw new Error('Instagram no devolvió el contenedor de un slide.');
      hijos.push(h.id);
    }
    const paramsPadre = new URLSearchParams({ media_type: 'CAROUSEL', children: hijos.join(','), caption, access_token: tok });
    const colabCar = listaColaboradores(post);
    if (colabCar) paramsPadre.set('collaborators', colabCar);
    const padre = await gJson(`${GRAPH}/${client.ig_user_id}/media`, {
      method: 'POST',
      body: paramsPadre,
    });
    if (!padre.id) throw new Error('Instagram no devolvió el contenedor del carrusel.');
    if (onContainer) { try { await onContainer(padre.id); } catch { /* best effort */ } }
    // Los JPEG procesan casi al instante; un respiro corto y a publicar.
    let carruselListo = false;
    for (let i = 0; !carruselListo && i < 10; i++) {
      const st = await gJson(`${GRAPH}/${padre.id}?fields=status_code&access_token=${encodeURIComponent(tok)}`);
      if (st.status_code === 'FINISHED') carruselListo = true;
      else if (st.status_code === 'ERROR') throw new Error('Instagram no pudo procesar el carrusel (¿todos los slides son JPEG?).');
      else await espera(3000);
    }
    if (!carruselListo) throw new Error('Instagram sigue procesando el carrusel — se reintenta en el siguiente ciclo.');
    // Meta a veces dice FINISHED y aun así media_publish responde "The media
    // is not ready" (visto 2026-08-27 con un carrusel de 3 JPEG): reintentar
    // esa condición puntual unas veces antes de rendirse.
    let pub = null;
    for (let i = 0; i < 4; i++) {
      try {
        pub = await gJson(`${GRAPH}/${client.ig_user_id}/media_publish`, {
          method: 'POST',
          body: new URLSearchParams({ creation_id: padre.id, access_token: tok }),
        });
        break;
      } catch (e) {
        if (i < 3 && /not ready/i.test((e && e.message) || '')) { await espera(6000); continue; }
        throw e;
      }
    }
    if (!pub || !pub.id) throw new Error('Instagram no confirmó la publicación del carrusel.');
    let permalink = null;
    try {
      const media = await gJson(`${GRAPH}/${pub.id}?fields=permalink&access_token=${encodeURIComponent(tok)}`);
      permalink = media.permalink || null;
    } catch { /* sin permalink no pasa nada */ }
    return { mediaId: pub.id, permalink };
  }

  // 1) El contenedor.
  let params;
  if (post.video_url) {
    params = new URLSearchParams({ media_type: 'REELS', video_url: post.video_url, caption, access_token: tok });
    // Portada del reel: imagen subida a la pieza (gana) o el milisegundo elegido.
    if (cover) params.set('cover_url', cover);
    else if (Number(post.thumb_offset) > 0) params.set('thumb_offset', String(Math.round(Number(post.thumb_offset))));
    else params.set('thumb_offset', '0');   // frame 0 = la portada horneada del render
  } else if (tipo === 'post' && post.inspo_url && /\.(jpe?g)(\?|$)/i.test(post.inspo_url)) {
    // v1 foto única: solo JPEG (regla de la API de IG).
    params = new URLSearchParams({ image_url: post.inspo_url, caption, access_token: tok });
  } else {
    throw new Error(tipo === 'carrusel'
      ? 'El carrusel no tiene slides subidos para publicar (se suben como JPEG al almacén de la pieza).'
      : 'La pieza no tiene video subido — sube el video final antes de programarla.');
  }
  const colab = listaColaboradores(post);
  if (colab) params.set('collaborators', colab);
  const cont = await gJson(`${GRAPH}/${client.ig_user_id}/media`, { method: 'POST', body: params });
  if (!cont.id) throw new Error('Instagram no devolvió el contenedor.');
  if (onContainer) { try { await onContainer(cont.id); } catch { /* best effort */ } }

  // 2) Esperar a que IG procese el video (FINISHED). Los reels tardan.
  let listo = !post.video_url;   // las fotos no procesan
  for (let i = 0; !listo && i < 24; i++) {
    await espera(5000);
    const st = await gJson(`${GRAPH}/${cont.id}?fields=status_code&access_token=${encodeURIComponent(tok)}`);
    if (st.status_code === 'FINISHED') listo = true;
    else if (st.status_code === 'ERROR') throw new Error('Instagram no pudo procesar el video (¿H.264 9:16, <100MB?).');
  }
  if (!listo) throw new Error('Instagram sigue procesando el video — se reintenta en el siguiente ciclo.');

  // 3) Publicar.
  const pub = await gJson(`${GRAPH}/${client.ig_user_id}/media_publish`, {
    method: 'POST',
    body: new URLSearchParams({ creation_id: cont.id, access_token: tok }),
  });
  if (!pub.id) throw new Error('Instagram no confirmó la publicación.');

  // 4) El permalink (best-effort: si falla, el id basta).
  let permalink = null;
  try {
    const media = await gJson(`${GRAPH}/${pub.id}?fields=permalink&access_token=${encodeURIComponent(tok)}`);
    permalink = media.permalink || null;
  } catch { /* sin permalink no pasa nada */ }
  return { mediaId: pub.id, permalink };
}

// El estado OFICIAL de un contenedor (doc de Meta: PUBLISHED = ya salió;
// FINISHED = listo para publicar; ERROR/EXPIRED = crear uno nuevo).
export async function estadoContenedor(client, creationId) {
  try {
    const st = await gJson(`${GRAPH}/${creationId}?fields=status_code&access_token=${encodeURIComponent(client.ig_access_token)}`);
    return st.status_code || null;
  } catch { return null; }
}

// Publica un contenedor que YA está FINISHED (reanudación tras un error
// ambiguo de media_publish — jamás re-crear el contenedor a ciegas).
export async function publicarContenedorExistente(client, creationId) {
  const pub = await gJson(`${GRAPH}/${client.ig_user_id}/media_publish`, {
    method: 'POST',
    body: new URLSearchParams({ creation_id: creationId, access_token: client.ig_access_token }),
  });
  if (!pub.id) throw new Error('Instagram no confirmó la publicación.');
  let permalink = null;
  try {
    const media = await gJson(`${GRAPH}/${pub.id}?fields=permalink&access_token=${encodeURIComponent(client.ig_access_token)}`);
    permalink = media.permalink || null;
  } catch { /* sin permalink no pasa nada */ }
  return { mediaId: pub.id, permalink };
}

// Hora local de Cancún (Quintana Roo: UTC-5 fijo, sin horario de verano).
export function ahoraCancun() {
  const d = new Date(Date.now() - 5 * 3600e3);
  return { fecha: d.toISOString().slice(0, 10), hora: d.toISOString().slice(11, 16) };
}
