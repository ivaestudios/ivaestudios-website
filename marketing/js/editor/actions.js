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

import { el, api, copyText } from '../api.js?v=202606241300';
import { icon } from '../shell/icons.js?v=202606241300';
import { openSheet } from '../shell/sheet.js?v=202606241300';
import * as store from '../shell/store.js?v=202606241300';
import * as cl from '../services/checklist.js?v=202606241300';

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
    title: 'Acciones',
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

      body.appendChild(el('div', { class: 'pick-list' }, [
        mk('Duplicar', 'copy', () => openDuplicateSheet(ed)),
        mk('Copiar enlace', 'link', () => copyDeepLink(ed)),
        mk('Eliminar', 'trash', () => openDeleteConfirm(ed), true),
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
  ed.ctx.toast(ok ? 'Enlace copiado.' : 'No se pudo copiar el enlace.', { type: ok ? 'success' : 'error' });
}

// ── Duplicar ─────────────────────────────────────────────────────────────────
export function openDuplicateSheet(ed) {
  const post = ed.getPost();

  openSheet({
    title: 'Duplicar contenido',
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
        switchRow('Incluir checklist', 'Los pasos se copian sin completar', () => withChecklist, (v) => { withChecklist = v; }),
        switchRow('Incluir guion y caption', 'HOOK, BODY, CTA, caption y hashtags', () => withScript, (v) => { withScript = v; }),
      ];

      const dupBtn = el('button', {
        class: 'btn btn-primary sheet-cta', type: 'button', text: 'Duplicar',
        onclick: async () => {
          if (busy) return;
          busy = true;
          dupBtn.dataset.loading = 'true';
          const created = await duplicatePost(ed, { withChecklist, withScript });
          dupBtn.dataset.loading = 'false';
          busy = false;
          if (created) {
            close({ source: 'done' });
            ed.ctx.toast('Contenido duplicado.', {
              type: 'success',
              action: { label: 'Abrir', onAction: () => ed.ctx.openEditor(created.id, { tab: 'contenido' }) },
            });
          }
        },
      });

      body.append(
        el('div', { class: 'edsection__rows' }, rows),
        el('p', { class: 'help', text: 'El duplicado nace en Idea, sin fecha y con aprobacion pendiente. No copia comentarios ni aprobaciones.' }),
        el('div', { class: 'sheet__footer' }, [
          el('button', { class: 'btn', type: 'button', text: 'Cancelar', onclick: () => close({ source: 'cancel' }) }),
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
      ed.ctx.toast((e && e.message) || 'No se pudo duplicar.', { type: 'error' });
      return null;
    }
    // 2) Fallback backend viejo: copia client-side.
  }

  const data = {
    client_id: src.client_id,
    title: `${src.title || 'Sin titulo'} (copia)`,
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
    title: 'Eliminar contenido',
    mode: 'form',
    build(body, close) {
      const delBtn = el('button', {
        class: 'btn btn-danger sheet-cta', type: 'button', text: 'Eliminar definitivamente',
        onclick: async () => {
          // Cierra el sheet ANTES de navegar (su capa de history se consume
          // primero y el goBack del editor no choca con ella).
          close({ source: 'confirm' });
          // El post va a morir: descarta los dirty para no PATCHear un 404.
          ed.discardChanges();
          const ok = await store.removePost(ed.postId); // optimista + rollback + toast
          if (ok) {
            ed.ctx.toast('Contenido eliminado.', { type: 'success' });
            ed.forceClose(); // idempotente: el evento post:deleted ya pudo cerrar
          }
        },
      });
      body.append(
        el('p', { class: 'ed-confirm__text' }, [
          'Se eliminara ',
          el('b', { text: post.title || 'este contenido' }),
          ' con sus comentarios, checklist y aprobaciones.',
        ]),
        el('p', { class: 'help', text: 'Esta accion no se puede deshacer.' }),
        el('div', { class: 'sheet__footer' }, [
          el('button', { class: 'btn', type: 'button', text: 'Cancelar', onclick: () => close({ source: 'cancel' }) }),
          delBtn,
        ]),
      );
    },
  });
}
