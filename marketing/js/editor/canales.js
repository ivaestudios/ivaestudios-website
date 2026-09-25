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
//     publicar. Todo eso vive en esta hoja.
//   · YOUTUBE — la ley COPPA obliga a declarar si el video es contenido para
//     niños; YouTube no acepta un valor por defecto nuestro. Mientras el
//     proyecto no pase la revisión de YouTube, todo sube en PRIVADO (lo fuerza
//     YouTube): la hoja lo dice con todas sus letras en vez de fingir.
//
// Cada hoja guarda un JSON en tt_options / yt_options (mismo contrato que el
// publicador del backend).
// ============================================================================

import { el, api } from '../api.js?v=202609251423';
import { T } from '../shell/i18n.js?v=202609251423';
import { openSheet } from '../shell/sheet.js?v=202609251423';

// Fila de opción única (radio) con el mismo lenguaje visual de los pickers.
function filaOpcion({ label, sub, activa, onPick }) {
  const row = el('button', {
    class: 'pick-row' + (activa ? ' is-current' : ''), type: 'button', role: 'option',
    'aria-selected': activa ? 'true' : 'false',
    onclick: onPick,
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

  openSheet({
    title: T('Opciones de TikTok', 'TikTok options'),
    mode: 'form',
    build(body, close) {
      const cuenta = el('p', { class: 'help', text: T('Leyendo la cuenta de TikTok…', 'Reading the TikTok account…') });
      const lista = el('div', { class: 'pick-list', role: 'listbox' });
      const switches = el('div', { class: 'edsection__rows' });
      const nota = el('p', { class: 'help', text: T(
        'Al publicar aceptas la Confirmación de Uso de Música de TikTok.',
        'By publishing you accept TikTok\'s Music Usage Confirmation.',
      ) });
      const guardar = el('button', {
        class: 'btn btn-primary sheet-cta', type: 'button', text: T('Guardar', 'Save'),
        onclick: () => {
          ed.setField('tt_options', JSON.stringify({
            privacy_level: privacidad || null,
            allow_comment: comentarios, allow_duet: duos, allow_stitch: stitch,
          }), { immediate: true });
          close({ source: 'done' });
          if (onSaved) onSaved();
        },
      });

      body.append(
        cuenta,
        el('h3', { class: 'edsection__title', text: T('Privacidad en TikTok (la eliges tú)', 'TikTok privacy (you choose)') }),
        lista,
        switches,
        nota,
        el('div', { class: 'sheet__footer' }, [
          el('button', { class: 'btn', type: 'button', text: T('Cancelar', 'Cancel'), onclick: () => close({ source: 'cancel' }) }),
          guardar,
        ]),
      );

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
          (d.auditada ? '' : T(' · llegará a su BUZÓN de TikTok para publicar con un tap', ' · it will land in its TikTok inbox to publish with one tap'));

        function pintar() {
          while (lista.firstChild) lista.removeChild(lista.firstChild);
          for (const o of (d.privacy_level_options || [])) {
            lista.appendChild(filaOpcion({
              label: ETIQUETAS_TT[o] || o,
              activa: privacidad === o,
              onPick: () => { privacidad = o; pintar(); },
            }));
          }
          while (switches.firstChild) switches.removeChild(switches.firstChild);
          switches.append(
            filaSwitch({ label: T('Permitir comentarios', 'Allow comments'), get: () => comentarios, set: (v) => { comentarios = v; }, disabled: !!d.comment_disabled }),
            filaSwitch({ label: T('Permitir dúos', 'Allow duets'), get: () => duos, set: (v) => { duos = v; }, disabled: !!d.duet_disabled }),
            filaSwitch({ label: T('Permitir stitch', 'Allow stitch'), get: () => stitch, set: (v) => { stitch = v; }, disabled: !!d.stitch_disabled }),
          );
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
