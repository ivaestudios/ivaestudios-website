// ============================================================================
// IVAE Marketing v2 — Calendario: quick-create (tocar un dia vacio o el FAB).
//
// Sheet de formulario minimo: titulo + tipo + fecha (+ cliente si el scope es
// 'todos'; estado y plataforma opcionales). store.createPost ya maneja el
// error con toast; en exito ofrecemos "Abrir" para saltar al editor.
// ============================================================================

import {
  el,
  STATUS_ORDER,
  CONTENT_TYPES, CONTENT_TYPE_ORDER,
} from '../api.js?v=202607032040';
import { parseYMD, dayLong, statusInfo, safeColor } from './data.js?v=202607032040';

/**
 * Abre el quick-create. `date` = 'YYYY-MM-DD' o '' (backlog).
 */
export function openQuickCreate(ctx, { date = '', clientId = null } = {}) {
  const st = ctx.store.getState();
  const clients = (st.clients || []).filter((c) => !c.archived);
  const isTodos = st.activeClientId === 'todos';

  const model = {
    client_id: clientId || (!isTodos ? st.activeClientId : null),
    title: '',
    content_type: CONTENT_TYPE_ORDER && CONTENT_TYPE_ORDER.length ? CONTENT_TYPE_ORDER[0] : null,
    status: STATUS_ORDER && STATUS_ORDER.length ? STATUS_ORDER[0] : null,
    publish_date: date || '',
    platform: '',
  };

  ctx.sheet.openSheet({
    title: 'Nuevo contenido',
    mode: 'form',
    build(body, close) {
      // ── Titulo ─────────────────────────────────────────────────────────────
      const titleIn = el('input', {
        class: 'input', type: 'text', maxlength: '160',
        placeholder: 'Titulo del contenido',
        'aria-label': 'Titulo del contenido',
      });
      titleIn.addEventListener('input', () => { model.title = titleIn.value; });

      // ── Cliente (solo en scope Todos) ──────────────────────────────────────
      let clientBtn = null;
      if (isTodos) {
        const label = () => {
          const c = clients.find((x) => x.id === model.client_id);
          return c ? c.name : 'Elige un cliente';
        };
        clientBtn = el('button', { class: 'qc-rowbtn', type: 'button' }, [
          ctx.icons('users', 18),
          el('span', { class: 'qc-rowbtn__txt', text: label() }),
          ctx.icons('down', 14),
        ]);
        clientBtn.addEventListener('click', async () => {
          const picked = await ctx.sheet.pickFrom({
            title: 'Cliente',
            anchor: clientBtn,
            options: clients.map((c) => ({
              value: c.id, label: c.name,
              color: safeColor(c.brand_color),
              current: c.id === model.client_id,
            })),
          });
          if (picked === null) return;
          model.client_id = picked;
          clientBtn.querySelector('.qc-rowbtn__txt').textContent = label();
        });
      }

      // ── Tipo de contenido (chips) ──────────────────────────────────────────
      const typeWrap = el('div', { class: 'qc-chips', role: 'group', 'aria-label': 'Tipo de contenido' });
      const typeBtns = new Map();
      for (const t of CONTENT_TYPE_ORDER || []) {
        const info = (CONTENT_TYPES && CONTENT_TYPES[t]) || { label: t };
        const b = el('button', {
          class: 'qc-chip' + (model.content_type === t ? ' is-active' : ''),
          type: 'button', text: info.label || t,
          'aria-pressed': model.content_type === t ? 'true' : 'false',
        });
        b.addEventListener('click', () => {
          model.content_type = t;
          for (const [k, btn] of typeBtns) {
            const is = k === t;
            btn.classList.toggle('is-active', is);
            btn.setAttribute('aria-pressed', is ? 'true' : 'false');
          }
        });
        typeBtns.set(t, b);
        typeWrap.appendChild(b);
      }

      // ── Fecha ──────────────────────────────────────────────────────────────
      const dateLabel = () => {
        if (!model.publish_date) return 'Sin fecha (backlog)';
        const d = parseYMD(model.publish_date);
        return d ? dayLong(d) : model.publish_date;
      };
      const dateBtn = el('button', { class: 'qc-rowbtn', type: 'button' }, [
        ctx.icons('calendar', 18),
        el('span', { class: 'qc-rowbtn__txt', text: dateLabel() }),
        ctx.icons('down', 14),
      ]);
      dateBtn.addEventListener('click', async () => {
        const picked = await ctx.pickers.pickDate({
          current: model.publish_date || null,
          title: 'Fecha de publicacion',
          allowClear: true,
        });
        if (picked === null) return;
        model.publish_date = picked; // '' = sin fecha
        dateBtn.querySelector('.qc-rowbtn__txt').textContent = dateLabel();
      });

      // ── Estado ─────────────────────────────────────────────────────────────
      const statusDot = el('span', { class: 'qc-dot', style: { background: statusInfo(model.status).color } });
      const statusBtn = el('button', { class: 'qc-rowbtn', type: 'button' }, [
        statusDot,
        el('span', { class: 'qc-rowbtn__txt', text: statusInfo(model.status).label }),
        ctx.icons('down', 14),
      ]);
      statusBtn.addEventListener('click', async () => {
        const picked = await ctx.pickers.pickStatus({ current: model.status, anchor: statusBtn });
        if (picked === null) return;
        model.status = picked;
        const info = statusInfo(picked);
        statusDot.style.background = info.color;
        statusBtn.querySelector('.qc-rowbtn__txt').textContent = info.label;
      });

      // ── Plataforma (opcional) ──────────────────────────────────────────────
      const platBtn = el('button', { class: 'qc-rowbtn', type: 'button' }, [
        ctx.icons('send', 18),
        el('span', { class: 'qc-rowbtn__txt', text: 'Plataforma (opcional)' }),
        ctx.icons('down', 14),
      ]);
      platBtn.addEventListener('click', async () => {
        const picked = await ctx.pickers.pickPlatform({ current: model.platform || null, anchor: platBtn });
        if (picked === null) return;
        model.platform = picked; // '' = sin plataforma
        platBtn.querySelector('.qc-rowbtn__txt').textContent = picked || 'Plataforma (opcional)';
      });

      // ── Crear ──────────────────────────────────────────────────────────────
      const createBtn = el('button', { class: 'btn btn-primary sheet-cta', type: 'button', text: 'Crear contenido' });
      createBtn.addEventListener('click', async () => {
        const title = (model.title || '').trim();
        if (!title) {
          ctx.toast('Escribe un titulo para el contenido.', { type: 'error' });
          titleIn.focus();
          return;
        }
        if (!model.client_id) {
          ctx.toast('Elige el cliente del contenido.', { type: 'error' });
          return;
        }
        createBtn.disabled = true;
        const payload = {
          client_id: model.client_id,
          title,
          content_type: model.content_type || null,
          status: model.status || null,
          publish_date: model.publish_date || null,
          platform: model.platform || null,
        };
        const post = await ctx.store.createPost(payload);
        if (!post) { createBtn.disabled = false; return; } // createPost ya aviso
        close({ source: 'created' });
        const when = payload.publish_date
          ? `para el ${dayLong(parseYMD(payload.publish_date) || new Date())}`
          : 'sin fecha (backlog)';
        ctx.toast(`Contenido creado ${when}.`, {
          type: 'success',
          action: { label: 'Abrir', onAction: () => ctx.openEditor(post.id) },
        });
      });

      body.append(
        el('div', { class: 'field' }, [el('label', { class: 'label', text: 'Titulo' }), titleIn]),
        clientBtn ? el('div', { class: 'field' }, [el('label', { class: 'label', text: 'Cliente' }), clientBtn]) : null,
        el('div', { class: 'field' }, [el('label', { class: 'label', text: 'Tipo de contenido' }), typeWrap]),
        el('div', { class: 'field' }, [el('label', { class: 'label', text: 'Fecha' }), dateBtn]),
        el('div', { class: 'field qc-half' }, [
          el('div', { class: 'qc-halfcol' }, [el('label', { class: 'label', text: 'Estado' }), statusBtn]),
          el('div', { class: 'qc-halfcol' }, [el('label', { class: 'label', text: 'Plataforma' }), platBtn]),
        ]),
        el('div', { class: 'sheet__footer' }, [
          el('button', { class: 'btn', type: 'button', text: 'Cancelar', onclick: () => close({ source: 'cancel' }) }),
          createBtn,
        ]),
      );
      setTimeout(() => titleIn.focus(), 60);
    },
  });
}
