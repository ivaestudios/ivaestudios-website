// ============================================================================
// IVAE Marketing v2 - Editor de post: CANALES EXTRA (TikTok y YouTube).
//
// La pieza sale a Instagram (o a Facebook) por el camino de siempre; estos dos
// canales son opt-in POR PIEZA y cada uno pide una decisión humana que no
// podemos inventar:
//
//   · TIKTOK — sus guidelines EXIGEN, para aprobar la auditoría: que se vea a
//     qué cuenta se publica, que la privacidad la elija una persona (SIN valor
//     por defecto), que las interacciones nazcan apagadas y respeten lo que la
//     cuenta tenga deshabilitado, y la declaración de uso de música antes de
//     publicar. Todo eso vive en esta hoja. Y (15-oct-2026, para la auditoría
//     de Direct Post) la DECLARACIÓN DE CONTENIDO COMERCIAL ("Tu marca" →
//     «Contenido promocional», "Contenido de marca" → «Colaboración pagada»;
//     lo de marca no puede ser privado y lleva la Política de Contenido de
//     Marca) y la DURACIÓN MÁXIMA que acepta esa cuenta.
//   · YOUTUBE — la ley COPPA obliga a declarar si el video es contenido para
//     niños; YouTube no acepta un valor por defecto nuestro. Mientras el
//     proyecto no pase la revisión de YouTube, todo sube en PRIVADO (lo fuerza
//     YouTube): la hoja lo dice con todas sus letras en vez de fingir.
//
// Cada hoja guarda un JSON en tt_options / yt_options (mismo contrato que el
// publicador del backend).
// ============================================================================

import { el, api } from '../api.js?v=202610270229';
import { T } from '../shell/i18n.js?v=202610270229';
import { openSheet } from '../shell/sheet.js?v=202610270229';

// Fila de opción única (radio) con el mismo lenguaje visual de los pickers.
function filaOpcion({ label, sub, activa, onPick, disabled = false }) {
  const row = el('button', {
    class: 'pick-row' + (activa ? ' is-current' : ''), type: 'button', role: 'option',
    'aria-selected': activa ? 'true' : 'false', 'aria-disabled': disabled ? 'true' : null,
    disabled: disabled ? 'disabled' : null,
    style: disabled ? { opacity: '.5', cursor: 'not-allowed' } : null,
    onclick: disabled ? null : onPick,
  }, [
    el('span', { class: 'pick-row__main' }, [
      el('span', { class: 'pick-row__label', text: label }),
      sub ? el('span', { class: 'pick-row__sub', text: sub }) : null,
    ]),
    activa ? el('span', { class: 'pick-row__check', text: '✓' }) : null,
  ]);
  return row;
}

function filaSwitch({ label, sub, get, set, disabled = false }) {
  const knob = el('span', { class: 'edswitch__knob' });
  const track = el('span', { class: 'edswitch', 'aria-hidden': 'true' }, [knob]);
  const row = el('button', {
    class: 'edrow edrow--switch', type: 'button', role: 'switch',
    disabled: disabled ? 'disabled' : null,
    onclick: () => { if (disabled) return; set(!get()); sync(); },
  }, [
    el('span', { class: 'edrow__main' }, [
      el('span', { class: 'edrow__label', text: label }),
      sub ? el('span', { class: 'edrow__sub', text: sub }) : null,
    ]),
    track,
  ]);
  function sync() {
    const on = !!get();
    row.setAttribute('aria-checked', on ? 'true' : 'false');
    track.classList.toggle('is-on', on);
    row.style.opacity = disabled ? '.5' : '';
  }
  sync();
  return row;
}

const ETIQUETAS_TT = {
  PUBLIC_TO_EVERYONE: T('Público', 'Public'),
  MUTUAL_FOLLOW_FRIENDS: T('Amigos', 'Friends'),
  FOLLOWER_OF_CREATOR: T('Seguidores', 'Followers'),
  SELF_ONLY: T('Solo yo', 'Only me'),
};

function leerOpciones(post, campo) {
  try { return post[campo] ? JSON.parse(post[campo]) : {}; } catch { return {}; }
}

/** Resumen corto para pintar el valor de la fila en el tab Contenido. */
export function resumenTikTok(post) {
  const o = leerOpciones(post, 'tt_options');
  if (!o.privacy_level) return T('Falta elegir privacidad', 'Pick a privacy level');
  return ETIQUETAS_TT[o.privacy_level] || o.privacy_level;
}

export function resumenYouTube(post) {
  const o = leerOpciones(post, 'yt_options');
  if (o.made_for_kids == null) return T('Falta la declaración', 'Declaration missing');
  const p = { public: T('Público', 'Public'), unlisted: T('Oculto', 'Unlisted'), private: T('Privado', 'Private') };
  return p[o.privacy_status] || T('Privado', 'Private');
}

// ── TIKTOK ───────────────────────────────────────────────────────────────────
export function openTikTokSheet(ed, { onSaved } = {}) {
  const post = ed.getPost() || {};
  const elec = leerOpciones(post, 'tt_options');
  let privacidad = elec.privacy_level || '';
  let comentarios = elec.allow_comment === true;
  let duos = elec.allow_duet === true;
  let stitch = elec.allow_stitch === true;
  // Contenido comercial (apagado por defecto, como pide TikTok).
  let tuMarca = elec.brand_organic === true;
  let patrocinado = elec.brand_content === true;
  let declarar = tuMarca || patrocinado;
  let maxSeg = null;      // duración máxima que acepta la cuenta
  let durSeg = null;      // duración del video de la pieza

  const LIGA_MUSICA = 'https://www.tiktok.com/legal/page/global/music-usage-confirmation/en';
  const LIGA_MARCA = 'https://www.tiktok.com/legal/page/global/bc-policy/en';
  const fmtDur = (s) => { const t = Math.round(s); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };

  openSheet({
    title: T('Opciones de TikTok', 'TikTok options'),
    mode: 'form',
    build(body, close) {
      const cuenta = el('p', { class: 'help', text: T('Leyendo la cuenta de TikTok…', 'Reading the TikTok account…') });
      const duracion = el('p', { class: 'help' });
      const lista = el('div', { class: 'pick-list', role: 'listbox' });
      const switches = el('div', { class: 'edsection__rows' });
      const comercial = el('div', { class: 'edsection__rows' });
      const etiqueta = el('p', { class: 'help' });
      const nota = el('p', { class: 'help' });
      const error = el('p', { class: 'help', role: 'alert', style: { color: 'var(--danger, #c0352b)', fontWeight: '600' } });
      const liga = (href, txt) => el('a', { href, target: '_blank', rel: 'noopener', text: txt });
      function pintarNota() {
        while (nota.firstChild) nota.removeChild(nota.firstChild);
        // TikTok pide esta declaración, con sus ligas, antes de publicar.
        if (declarar && patrocinado) {
          nota.append(T('Al publicar aceptas la ', 'By posting, you agree to TikTok\'s '), liga(LIGA_MARCA, T('Política de Contenido de Marca', 'Branded Content Policy')),
            T(' y la ', ' and '), liga(LIGA_MUSICA, T('Confirmación de Uso de Música', 'Music Usage Confirmation')), T(' de TikTok.', '.'));
        } else {
          nota.append(T('Al publicar aceptas la ', 'By posting, you agree to TikTok\'s '), liga(LIGA_MUSICA, T('Confirmación de Uso de Música', 'Music Usage Confirmation')), T(' de TikTok.', '.'));
        }
      }
      pintarNota();
      const guardar = el('button', {
        class: 'btn btn-primary sheet-cta', type: 'button', text: T('Guardar', 'Save'),
        onclick: () => {
          error.textContent = '';
          if (declarar && !tuMarca && !patrocinado) {
            error.textContent = T('Elige si el contenido es de tu marca, de marca (patrocinado) o ambos; o apaga «Declarar contenido comercial».', 'Choose Your brand, Branded content or both; or turn off "Disclose commercial content".');
            return;
          }
          if (maxSeg && durSeg && durSeg > maxSeg + 0.5) {
            error.textContent = T(`El video dura ${fmtDur(durSeg)} y esta cuenta de TikTok acepta hasta ${fmtDur(maxSeg)}. Recórtalo antes de publicarlo.`, `The video is ${fmtDur(durSeg)} long and this TikTok account accepts up to ${fmtDur(maxSeg)}. Trim it before posting.`);
            return;
          }
          ed.setField('tt_options', JSON.stringify({
            privacy_level: privacidad || null,
            allow_comment: comentarios, allow_duet: duos, allow_stitch: stitch,
            brand_organic: declarar && tuMarca, brand_content: declarar && patrocinado,
          }), { immediate: true });
          close({ source: 'done' });
          if (onSaved) onSaved();
        },
      });

      body.append(
        cuenta,
        duracion,
        el('h3', { class: 'edsection__title', text: T('Privacidad en TikTok (la eliges tú)', 'TikTok privacy (you choose)') }),
        lista,
        switches,
        el('h3', { class: 'edsection__title', text: T('Contenido comercial', 'Commercial content') }),
        comercial,
        etiqueta,
        nota,
        error,
        el('div', { class: 'sheet__footer' }, [
          el('button', { class: 'btn', type: 'button', text: T('Cancelar', 'Cancel'), onclick: () => close({ source: 'cancel' }) }),
          guardar,
        ]),
      );

      // Duración del video de la pieza (para compararla con lo que acepta la cuenta).
      if (post.video_url) {
        const v = document.createElement('video');
        v.preload = 'metadata'; v.muted = true;
        v.onloadedmetadata = () => { if (Number.isFinite(v.duration)) { durSeg = v.duration; pintarDuracion(); } v.removeAttribute('src'); v.load(); };
        v.src = post.video_url;
      }
      function pintarDuracion() {
        if (!maxSeg) { duracion.textContent = ''; return; }
        const pasa = durSeg && durSeg > maxSeg + 0.5;
        duracion.textContent = (durSeg ? T(`Este video dura ${fmtDur(durSeg)}. `, `This video is ${fmtDur(durSeg)} long. `) : '')
          + T(`Esta cuenta acepta videos de hasta ${fmtDur(maxSeg)}.`, `This account accepts videos up to ${fmtDur(maxSeg)}.`)
          + (pasa ? T(' Hay que recortarlo para publicarlo.', ' It must be trimmed to post.') : '');
        duracion.style.color = pasa ? 'var(--danger, #c0352b)' : '';
      }

      (async () => {
        let d = {};
        try {
          d = await api.get(`/tt/creator?client_id=${encodeURIComponent(post.client_id)}`);
        } catch {
          cuenta.textContent = T('No se pudo leer la cuenta de TikTok.', 'Could not read the TikTok account.');
          return;
        }
        if (!d.conectado) {
          cuenta.textContent = d.error || T('Esta marca no tiene TikTok conectado, hazlo desde su ficha.', 'This brand has no TikTok connected yet.');
          return;
        }
        cuenta.textContent = `${T('Se publicará en', 'Will publish to')}: ${d.nickname || d.username || T('la cuenta conectada', 'the connected account')}` +
          (d.auditada ? '' : T(' · hasta que TikTok apruebe la app, se publica en su perfil como PRIVADO (solo lo ve la cuenta)', ' · until TikTok approves the app, it posts to the profile as PRIVATE (only the account can see it)'));
        maxSeg = Number(d.max_video_post_duration_sec) || null;
        pintarDuracion();

        function pintar() {
          // Lo de marca (patrocinado) no puede ser privado: "Solo yo" se apaga.
          if (declarar && patrocinado && privacidad === 'SELF_ONLY') privacidad = '';
          while (lista.firstChild) lista.removeChild(lista.firstChild);
          for (const o of (d.privacy_level_options || [])) {
            const bloqueada = o === 'SELF_ONLY' && declarar && patrocinado;
            lista.appendChild(filaOpcion({
              label: ETIQUETAS_TT[o] || o,
              sub: bloqueada ? T('El contenido de marca no puede ser privado', 'Branded content visibility cannot be set to private') : null,
              activa: privacidad === o, disabled: bloqueada,
              onPick: () => { privacidad = o; pintar(); },
            }));
          }
          while (switches.firstChild) switches.removeChild(switches.firstChild);
          switches.append(
            filaSwitch({ label: T('Permitir comentarios', 'Allow comments'), get: () => comentarios, set: (v) => { comentarios = v; }, disabled: !!d.comment_disabled }),
            filaSwitch({ label: T('Permitir dúos', 'Allow duets'), get: () => duos, set: (v) => { duos = v; }, disabled: !!d.duet_disabled }),
            filaSwitch({ label: T('Permitir stitch', 'Allow stitch'), get: () => stitch, set: (v) => { stitch = v; }, disabled: !!d.stitch_disabled }),
          );
          while (comercial.firstChild) comercial.removeChild(comercial.firstChild);
          comercial.append(filaSwitch({
            label: T('Declarar contenido comercial', 'Disclose commercial content'),
            sub: T('Si el video promociona una marca, un producto o un servicio.', 'If the video promotes a brand, product or service.'),
            get: () => declarar, set: (v) => { declarar = v; if (!v) { tuMarca = false; patrocinado = false; } error.textContent = ''; pintar(); },
          }));
          if (declarar) {
            comercial.append(
              filaSwitch({ label: T('Tu marca', 'Your brand'), sub: T('Promocionas tu propio negocio.', 'You are promoting your own business.'), get: () => tuMarca, set: (v) => { tuMarca = v; error.textContent = ''; pintar(); } }),
              filaSwitch({ label: T('Contenido de marca', 'Branded content'), sub: T('Promocionas a otra marca o a un tercero.', 'You are promoting another brand or a third party.'), get: () => patrocinado, set: (v) => { patrocinado = v; error.textContent = ''; pintar(); } }),
            );
          }
          etiqueta.textContent = !declarar ? '' : (patrocinado
            ? T('Tu video se etiquetará como «Colaboración pagada».', 'Your video will be labeled as "Paid partnership".')
            : (tuMarca ? T('Tu video se etiquetará como «Contenido promocional».', 'Your video will be labeled as "Promotional content".') : T('Elige al menos una opción.', 'Choose at least one option.')));
          pintarNota();
        }
        if (d.comment_disabled) comentarios = false;
        if (d.duet_disabled) duos = false;
        if (d.stitch_disabled) stitch = false;
        pintar();
      })();
    },
  });
}

// ── YOUTUBE ──────────────────────────────────────────────────────────────────
export function openYouTubeSheet(ed, { onSaved } = {}) {
  const post = ed.getPost() || {};
  const elec = leerOpciones(post, 'yt_options');
  let privacidad = elec.privacy_status || 'public';
  let ninos = elec.made_for_kids === true ? true : elec.made_for_kids === false ? false : null;

  openSheet({
    title: T('Opciones de YouTube', 'YouTube options'),
    mode: 'form',
    build(body, close) {
      const canal = el('p', { class: 'help', text: T('Leyendo el canal…', 'Reading the channel…') });
      const listaPriv = el('div', { class: 'pick-list', role: 'listbox' });
      const listaNinos = el('div', { class: 'pick-list', role: 'listbox' });
      const aviso = el('p', { class: 'help' });
      const guardar = el('button', {
        class: 'btn btn-primary sheet-cta', type: 'button', text: T('Guardar', 'Save'),
        onclick: () => {
          if (ninos === null) {
            aviso.textContent = T('Falta declarar si el video es contenido para niños (lo exige YouTube).', 'You must declare whether the video is made for kids (YouTube requires it).');
            return;
          }
          ed.setField('yt_options', JSON.stringify({ privacy_status: privacidad, made_for_kids: ninos }), { immediate: true });
          close({ source: 'done' });
          if (onSaved) onSaved();
        },
      });

      body.append(
        canal,
        el('h3', { class: 'edsection__title', text: T('Quién puede verlo', 'Who can watch it') }),
        listaPriv,
        el('h3', { class: 'edsection__title', text: T('¿Es contenido para niños?', 'Is it made for kids?') }),
        listaNinos,
        aviso,
        el('div', { class: 'sheet__footer' }, [
          el('button', { class: 'btn', type: 'button', text: T('Cancelar', 'Cancel'), onclick: () => close({ source: 'cancel' }) }),
          guardar,
        ]),
      );

      function pintar() {
        while (listaPriv.firstChild) listaPriv.removeChild(listaPriv.firstChild);
        const ops = [
          { v: 'public', l: T('Público', 'Public'), s: T('Cualquiera lo encuentra y lo ve', 'Anyone can find and watch it') },
          { v: 'unlisted', l: T('Oculto', 'Unlisted'), s: T('Solo quien tenga el enlace', 'Only people with the link') },
          { v: 'private', l: T('Privado', 'Private'), s: T('Solo el canal', 'Only the channel') },
        ];
        for (const o of ops) {
          listaPriv.appendChild(filaOpcion({ label: o.l, sub: o.s, activa: privacidad === o.v, onPick: () => { privacidad = o.v; pintar(); } }));
        }
        while (listaNinos.firstChild) listaNinos.removeChild(listaNinos.firstChild);
        listaNinos.append(
          filaOpcion({ label: T('No, no es para niños', 'No, not made for kids'), activa: ninos === false, onPick: () => { ninos = false; aviso.textContent = ''; pintar(); } }),
          filaOpcion({ label: T('Sí, es para niños', 'Yes, made for kids'), sub: T('YouTube apaga comentarios y notificaciones', 'YouTube turns off comments and notifications'), activa: ninos === true, onPick: () => { ninos = true; aviso.textContent = ''; pintar(); } }),
        );
      }
      pintar();

      (async () => {
        let d = {};
        try {
          d = await api.get(`/yt/estado?client_id=${encodeURIComponent(post.client_id)}`);
        } catch {
          canal.textContent = T('No se pudo leer el canal de YouTube.', 'Could not read the YouTube channel.');
          return;
        }
        if (!d.conectado) {
          canal.textContent = d.configurada
            ? T('Esta marca no tiene YouTube conectado, hazlo desde su ficha.', 'This brand has no YouTube connected yet.')
            : T('Falta configurar la app de YouTube en Cloudflare (YT_CLIENT_ID y YT_CLIENT_SECRET).', 'The YouTube app is not configured in Cloudflare yet.');
          return;
        }
        canal.textContent = `${T('Se subirá al canal', 'Will upload to channel')}: ${d.canal}`;
        if (!d.auditada) {
          aviso.textContent = T(
            'Mientras YouTube no apruebe el proyecto, todo sube en PRIVADO aunque elijas público: el video te espera en YouTube Studio para hacerlo público con un clic.',
            'Until YouTube approves the project, everything uploads as PRIVATE even if you pick public: the video waits in YouTube Studio.',
          );
        }
      })();
    },
  });
}

// ── YOUTUBE: el video ya en el canal ─────────────────────────────────────────
// Después de publicar, la app LEE DE VUELTA el video en el canal (videos.list)
// y enseña lo que YouTube contesta: canal, título, privacidad y fecha. Es la
// regla de la casa (todo desde la app, no desde el panel del proveedor) y de
// paso es la prueba de que la subida por API quedó donde debía.
export function openYouTubeVideoSheet(ed) {
  const post = ed.getPost() || {};
  const videoId = post.yt_video_id || '';
  openSheet({
    title: T('El video en YouTube', 'The video on YouTube'),
    mode: 'form',
    build(body, close) {
      const estado = el('p', { class: 'help', text: T('Leyendo el canal…', 'Reading the channel…') });
      const datos = el('div', { class: 'edsection__rows' });
      const abrir = el('a', {
        class: 'btn btn-primary sheet-cta', target: '_blank', rel: 'noopener',
        href: 'https://youtu.be/' + videoId, text: T('Abrir en YouTube', 'Open on YouTube'),
      });
      const fila = (etiqueta, valor) => el('div', { class: 'edrow' }, [
        el('span', { class: 'edrow__main' }, [
          el('span', { class: 'edrow__label', text: etiqueta }),
          el('span', { class: 'edrow__sub', text: valor }),
        ]),
      ]);
      body.append(
        estado,
        datos,
        el('div', { class: 'sheet__footer' }, [
          el('button', { class: 'btn', type: 'button', text: T('Cerrar', 'Close'), onclick: () => close({ source: 'cancel' }) }),
          abrir,
        ]),
      );
      (async () => {
        let d;
        try {
          d = await api.get(`/yt/video?client_id=${encodeURIComponent(post.client_id)}&video_id=${encodeURIComponent(videoId)}`);
        } catch (e) {
          estado.textContent = (e && e.message) || T('No se pudo leer el video en YouTube.', 'Could not read the video on YouTube.');
          return;
        }
        const privacidades = {
          public: T('Público: cualquiera lo ve', 'Public: anyone can watch it'),
          unlisted: T('Oculto: solo con el enlace', 'Unlisted: link only'),
          private: T('Privado: solo el canal', 'Private: channel only'),
        };
        estado.textContent = T('YouTube confirma que el video está en el canal:', 'YouTube confirms the video is on the channel:');
        datos.append(
          fila(T('Canal', 'Channel'), d.canal || '—'),
          fila(T('Título', 'Title'), d.titulo || '—'),
          fila(T('Quién puede verlo', 'Who can watch it'), privacidades[d.privacidad] || d.privacidad || '—'),
          fila(T('Contenido para niños', 'Made for kids'), d.para_ninos ? T('Sí', 'Yes') : T('No', 'No')),
          fila(T('Subido', 'Uploaded'), d.subido ? new Date(d.subido).toLocaleString() : '—'),
          fila('ID', d.id || videoId),
        );
      })();
    },
  });
}
