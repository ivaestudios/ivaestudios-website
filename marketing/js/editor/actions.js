// ============================================================================
// IVAE Marketing v2 - Editor de post: menu 3 puntos (Duplicar / Copiar enlace /
// Eliminar).
//
// - Duplicar: sheet con switches "Incluir checklist" e "Incluir guion y
//   caption"; la fecha SIEMPRE nace vacia (no choca el calendario).
//   POST /posts/:id/duplicate (backend v2). Fallback al backend viejo:
//   copia client-side via store.createPost + checklist via servicio.
//   Toast "Contenido duplicado" con accion "Abrir".
// - Copiar enlace: deep-link #/post/<id> via copyText.
// - Eliminar: confirmacion danger -> store.removePost -> cierra el editor.
//   Sin undo (el delete es hard en el backend): el copy lo deja claro.
// ============================================================================

import { el, api, copyText, isClientRole } from '../api.js?v=202609211346';
import { T } from '../shell/i18n.js?v=202609211346';
import { icon } from '../shell/icons.js?v=202609211346';
import { openSheet } from '../shell/sheet.js?v=202609211346';
import * as store from '../shell/store.js?v=202609211346';
import * as cl from '../services/checklist.js?v=202609211346';

function isMissingEndpoint(e) {
  const s = e && e.status;
  return s === 400 || s === 404 || s === 405 || s === 501;
}

// Campos que copia el fallback client-side (espejo de POST_EDITABLE_FIELDS,
// menos status/fecha que el duplicado resetea).
const COPY_FIELDS = ['content_type', 'grabacion', 'assignee', 'platform', 'notes_team', 'client_visible', 'inspo_url', 'video_url'];
const SCRIPT_FIELDS = ['hook', 'body', 'cta', 'caption', 'hashtags'];

// ── Menu principal ───────────────────────────────────────────────────────────
export function openActionsMenu(ed, anchor) {
  openSheet({
    title: T('Acciones', 'Actions'),
    mode: 'menu',
    anchor,
    build(body, close) {
      const mk = (label, iconName, fn, danger = false) => el('button', {
        class: 'pick-row' + (danger ? ' pick-row--danger' : ''), type: 'button',
        onclick: () => { close({ source: 'pick' }); fn(); },
      }, [
        icon(iconName, 18),
        el('span', { class: 'pick-row__main' }, [el('span', { class: 'pick-row__label', text: label })]),
      ]);

      // Eliminar es SOLO del equipo (el backend tambien lo rechaza para
      // role=client): esta era la otra puerta de borrado que veia el cliente.
      // Duplicar tambien: POST /posts/:id/duplicate es staff-only en el router,
      // asi que al cliente le devolvia un 403 despues de abrirle la hoja de
      // opciones. Un boton que siempre falla es peor que no tenerlo.
      // Publicar ahora: staff y solo si la pieza aun no se publico. Usa el
      // endpoint del cron para UNA pieza (POST /posts/:id/publicar): Instagram
      // ya, y Facebook si el interruptor "tambien en Facebook" esta activo.
      const post = ed.getPost() || {};
      const puedePublicar = !isClientRole() && !post.published_media_id && !post.fb_post_id;
      body.appendChild(el('div', { class: 'pick-list' }, [
        ...(puedePublicar ? [mk(T('Publicar ahora', 'Publish now'), 'activity', () => openPublishNowSheet(ed))] : []),
        mk(T('Duplicar', 'Duplicate'), 'copy', () => openDuplicateSheet(ed)),
        mk(T('Copiar enlace', 'Copy link'), 'link', () => copyDeepLink(ed)),
        mk(T('Eliminar', 'Delete'), 'trash', () => openDeleteConfirm(ed), true),
      ]));
    },
  });
}

// ── Copiar enlace ────────────────────────────────────────────────────────────
export async function copyDeepLink(ed) {
  const { activeClientId } = store.getState();
  const qs = activeClientId && activeClientId !== 'todos'
    ? `?cliente=${encodeURIComponent(activeClientId)}`
    : '';
  const link = `${location.origin}${location.pathname}#/post/${encodeURIComponent(ed.postId)}${qs}`;
  const ok = await copyText(link);
  ed.ctx.toast(ok ? T('Enlace copiado.', 'Link copied.') : T('No se pudo copiar el enlace.', 'Could not copy the link.'), { type: ok ? 'success' : 'error' });
}

// ── Duplicar ─────────────────────────────────────────────────────────────────
export function openDuplicateSheet(ed) {
  const post = ed.getPost();

  openSheet({
    title: T('Duplicar contenido', 'Duplicate content'),
    mode: 'form',
    build(body, close) {
      let withChecklist = cl.isAvailable();
      let withScript = true;
      let busy = false;

      function switchRow(label, sub, get, set) {
        const knob = el('span', { class: 'edswitch__knob' });
        const track = el('span', { class: 'edswitch', 'aria-hidden': 'true' }, [knob]);
        const row = el('button', {
          class: 'edrow edrow--switch', type: 'button', role: 'switch',
          onclick: () => { set(!get()); sync(); },
        }, [
          el('span', { class: 'edrow__main' }, [
            el('span', { class: 'edrow__label', text: label }),
            sub ? el('span', { class: 'edrow__sub', text: sub }) : null,
          ]),
          track,
        ]);
        const sync = () => {
          row.setAttribute('aria-checked', get() ? 'true' : 'false');
          track.classList.toggle('is-on', get());
        };
        sync();
        return row;
      }

      const rows = [
        switchRow(T('Incluir checklist', 'Include checklist'), T('Los pasos se copian sin completar', 'Steps are copied unchecked'), () => withChecklist, (v) => { withChecklist = v; }),
        switchRow(T('Incluir guion y caption', 'Include script and caption'), T('HOOK, BODY, CTA, caption y hashtags', 'HOOK, BODY, CTA, caption and hashtags'), () => withScript, (v) => { withScript = v; }),
      ];

      const dupBtn = el('button', {
        class: 'btn btn-primary sheet-cta', type: 'button', text: T('Duplicar', 'Duplicate'),
        onclick: async () => {
          if (busy) return;
          busy = true;
          dupBtn.dataset.loading = 'true';
          const created = await duplicatePost(ed, { withChecklist, withScript });
          dupBtn.dataset.loading = 'false';
          busy = false;
          if (created) {
            close({ source: 'done' });
            ed.ctx.toast(T('Contenido duplicado.', 'Content duplicated.'), {
              type: 'success',
              action: { label: T('Abrir', 'Open'), onAction: () => ed.ctx.openEditor(created.id, { tab: 'contenido' }) },
            });
          }
        },
      });

      body.append(
        el('div', { class: 'edsection__rows' }, rows),
        el('p', { class: 'help', text: T('El duplicado nace en Idea, sin fecha y con aprobación pendiente. No copia comentarios ni aprobaciones.', 'The duplicate starts in Idea, with no date and pending approval. Comments and approvals are not copied.') }),
        el('div', { class: 'sheet__footer' }, [
          el('button', { class: 'btn', type: 'button', text: T('Cancelar', 'Cancel'), onclick: () => close({ source: 'cancel' }) }),
          dupBtn,
        ]),
      );
    },
  });
}

async function duplicatePost(ed, { withChecklist, withScript }) {
  const src = ed.getPost();

  // 1) Camino v2: el server hace la copia atomica.
  try {
    const res = await api.post(`/posts/${encodeURIComponent(ed.postId)}/duplicate`, {
      include_checklist: withChecklist ? 1 : 0,
      include_script: withScript ? 1 : 0,
    });
    const post = (res && res.post) || res;
    if (post && post.id) {
      store.upsertPost(post);
      store.emit('post:created', post);
      store.emit('posts:changed');
      store.emit('mutated');
      store.refreshClientCounts();
      cl.invalidateCounts(post.client_id);
      return post;
    }
  } catch (e) {
    if (!isMissingEndpoint(e)) {
      ed.ctx.toast((e && e.message) || T('No se pudo duplicar.', 'Could not duplicate.'), { type: 'error' });
      return null;
    }
    // 2) Fallback backend viejo: copia client-side.
  }

  const data = {
    client_id: src.client_id,
    title: `${src.title || T('Sin título', 'Untitled')} ${T('(copia)', '(copy)')}`,
    status: 'idea',
  };
  for (const f of COPY_FIELDS) {
    if (src[f] !== undefined && src[f] !== null && src[f] !== '') data[f] = src[f];
  }
  if (withScript) {
    for (const f of SCRIPT_FIELDS) {
      if (src[f] !== undefined && src[f] !== null && src[f] !== '') data[f] = src[f];
    }
  }
  if (src.notes_people && typeof src.notes_people === 'object' && Object.keys(src.notes_people).length) {
    data.notes_people = { ...src.notes_people };
  }

  const post = await store.createPost(data); // ya hace toast de error + emits
  if (!post) return null;

  if (withChecklist && cl.isAvailable()) {
    try {
      const items = await cl.list(ed.postId, { force: true });
      for (const it of items) {
        await cl.add(post.id, it.text); // nacen con done=0
      }
    } catch { /* best-effort: el post ya existe */ }
  }
  return post;
}

// ── Eliminar ─────────────────────────────────────────────────────────────────
export function openDeleteConfirm(ed) {
  const post = ed.getPost();
  openSheet({
    title: T('Eliminar contenido', 'Delete content'),
    mode: 'form',
    build(body, close) {
      // `sheet-cta` (flex:1) va en Cancelar: la salida segura es la grande.
      // La etiqueta es corta A PROPOSITO: `.btn` es white-space:nowrap, asi que
      // "Eliminar definitivamente" fijaba un ancho minimo de ~193px y se comia
      // el flex:1 de Cancelar — el boton irreversible acababa siendo el MAS
      // ancho. El titulo ya dice "Eliminar contenido" y el cuerpo ya avisa que
      // no se puede deshacer.
      const delBtn = el('button', {
        class: 'btn btn-danger', type: 'button', text: T('Eliminar', 'Delete'),
        onclick: async () => {
          // Cierra el sheet ANTES de navegar (su capa de history se consume
          // primero y el goBack del editor no choca con ella).
          close({ source: 'confirm' });
          const ok = await store.removePost(ed.postId); // optimista + rollback + toast
          if (ok) {
            // El post ya murio: descarta los dirty para no PATCHear un 404.
            // (Solo tras el ok: si el DELETE falla y el post revive, los
            // cambios sin guardar se conservan en vez de perderse en silencio.)
            ed.discardChanges();
            ed.ctx.toast(T('Contenido eliminado.', 'Content deleted.'), { type: 'success' });
            ed.forceClose(); // idempotente: el evento post:deleted ya pudo cerrar
          }
        },
      });
      body.append(
        el('p', { class: 'ed-confirm__text' }, [
          T('Se eliminara ', 'This will delete '),
          el('b', { text: post.title || T('este contenido', 'this content') }),
          T(' con sus comentarios, checklist y aprobaciones.', ' along with its comments, checklist and approvals.'),
        ]),
        el('p', { class: 'help', text: T('Esta acción no se puede deshacer.', 'This action cannot be undone.') }),
        el('div', { class: 'sheet__footer' }, [
          el('button', { class: 'btn sheet-cta', type: 'button', text: T('Cancelar', 'Cancel'), onclick: () => close({ source: 'cancel' }) }),
          delBtn,
        ]),
      );
    },
  });
}


// ── Publicar ahora ──────────────────────────────────────────────────
// La misma maquina del cron para UNA pieza. Desde el 21-sep-2026 la hoja
// NOMBRA cada cuenta a la que va a salir (@usuario de Instagram, pagina de
// Facebook, canal de YouTube) y deja apagar la que no se quiera: una prueba
// de YouTube ya se publicó sin querer en el Instagram de IVAE, y eso no se
// deshace porque Instagram no tiene forma de borrar por API.
export function openPublishNowSheet(ed) {
  openSheet({
    title: T('Publicar ahora', 'Publish now'),
    mode: 'form',
    build(body, close) {
      let busy = false;
      const post = ed.getPost() || {};
      const cli = (store.getState().clients || []).find((c) => c.id === post.client_id) || null;

      // Destinos REALES de esta pieza: el Instagram conectado de la marca mas
      // los canales extra que la pieza traiga encendidos.
      const destinos = [];
      if (cli) {
        if (cli.ig_username) {
          destinos.push({ key: 'instagram', label: 'Instagram', cuenta: '@' + String(cli.ig_username).replace(/^@/, ''), on: true });
        }
        if (Number(post.also_facebook) === 1 && !post.fb_post_id) {
          destinos.push({ key: 'facebook', label: 'Facebook', cuenta: cli.fb_page_name || T('página conectada', 'connected page'), on: true });
        }
        if (Number(post.also_tiktok) === 1 && !post.tt_post_id) {
          destinos.push({ key: 'tiktok', label: 'TikTok', cuenta: cli.tt_username ? '@' + String(cli.tt_username).replace(/^@/, '') : T('cuenta conectada', 'connected account'), on: true });
        }
        if (Number(post.also_youtube) === 1 && !post.yt_video_id) {
          destinos.push({ key: 'youtube', label: 'YouTube', cuenta: cli.yt_channel_title || T('canal conectado', 'connected channel'), on: true });
        }
      }

      const pubBtn = el('button', {
        class: 'btn btn-primary sheet-cta', type: 'button', text: T('Publicar', 'Publish'),
        onclick: async () => {
          if (busy) return;
          const elegidos = destinos.filter((d) => d.on).map((d) => d.key);
          if (destinos.length && !elegidos.length) return;
          busy = true;
          pubBtn.dataset.loading = 'true';
          try {
            // Sin destinos resueltos (ficha de la marca no cargada) se manda
            // vacio: el servidor hace lo de siempre.
            const cuerpo = destinos.length ? { canales: elegidos } : {};
            const r = await api.post(`/posts/${encodeURIComponent(ed.postId)}/publicar`, cuerpo);
            close({ source: 'done' });
            // El resumen dice EXACTAMENTE a dónde salió y a dónde no: con
            // cuatro canales, un "Publicado" a secas ya no informa nada.
            const salio = [];
            const fallo = [];
            if (r && r.media_id) salio.push('Instagram');
            if (r && r.fb) (r.fb.ok ? salio : fallo).push('Facebook');
            if (r && r.tt) (r.tt.ok ? salio : fallo).push(r.tt.ok && r.tt.modo === 'buzon' ? T('TikTok (a su buzón)', 'TikTok (to its inbox)') : 'TikTok');
            if (r && r.yt) (r.yt.ok ? salio : fallo).push(r.yt.ok && r.yt.modo !== 'publico' ? T('YouTube (en privado)', 'YouTube (private)') : 'YouTube');
            ed.ctx.toast(
              (salio.length ? `${T('Publicado en', 'Published to')} ${salio.join(', ')}.` : T('No salió en ningún canal.', 'It did not go out anywhere.'))
                + (fallo.length ? ` ${T('Falló', 'Failed')}: ${fallo.join(', ')}.` : ''),
              { type: fallo.length ? 'info' : 'success' },
            );
            try { await store.loadPosts(); } catch { /* la vista se refresca sola al volver */ }
          } catch (e) {
            pubBtn.dataset.loading = 'false';
            busy = false;
            ed.ctx.toast((e && e.message) || T('No se pudo publicar.', 'Could not publish.'), { type: 'error' });
          }
        },
      });
      const resumen = el('p', { class: 'help' });
      const pintarResumen = () => {
        const elegidos = destinos.filter((d) => d.on);
        resumen.textContent = elegidos.length
          ? `${T('Sale AHORA en', 'It goes out NOW to')}: ${elegidos.map((d) => `${d.cuenta} (${d.label})`).join(', ')}.`
          : T('No hay ninguna cuenta elegida.', 'No account selected.');
        pubBtn.disabled = !elegidos.length;
      };

      function switchRow(d) {
        const knob = el('span', { class: 'edswitch__knob' });
        const track = el('span', { class: 'edswitch', 'aria-hidden': 'true' }, [knob]);
        const row = el('button', {
          class: 'edrow edrow--switch', type: 'button', role: 'switch',
          onclick: () => { d.on = !d.on; sync(); pintarResumen(); },
        }, [
          el('span', { class: 'edrow__main' }, [
            el('span', { class: 'edrow__label', text: d.label }),
            el('span', { class: 'edrow__sub', text: d.cuenta }),
          ]),
          track,
        ]);
        const sync = () => {
          row.setAttribute('aria-checked', d.on ? 'true' : 'false');
          track.classList.toggle('is-on', d.on);
        };
        sync();
        return row;
      }
      if (destinos.length) {
        body.append(
          el('div', { class: 'edsection__rows' }, destinos.map(switchRow)),
          resumen,
          el('p', { class: 'help', text: T('Apaga la cuenta en la que NO quieras que salga. Una publicación no se puede deshacer.', 'Switch off any account you do NOT want. A publication cannot be undone.') }),
        );
        pintarResumen();
      } else {
        body.append(el('p', { class: 'help', text: T(
          'La pieza se publica AHORA en el Instagram conectado de la marca, y en los canales extra que tenga encendidos (Facebook, TikTok, YouTube).',
          "The piece publishes NOW to the brand's connected Instagram, plus any extra channels switched on (Facebook, TikTok, YouTube).",
        ) }));
      }
      body.append(
        el('div', { class: 'sheet__footer' }, [
          el('button', { class: 'btn', type: 'button', text: T('Cancelar', 'Cancel'), onclick: () => close({ source: 'cancel' }) }),
          pubBtn,
        ]),
      );
    },
  });
}
