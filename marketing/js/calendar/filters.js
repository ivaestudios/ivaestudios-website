// ============================================================================
// IVAE Marketing v2 — Calendario: controles del subhead + sheet de filtros.
//
// Los filtros viven en la URL (#/calendario?estado=&tipo=&persona=&desde=
// &hasta=) y el shell los espeja en store.filters. Aplicar = router.navigate
// con los params nuevos (cambio paramsOnly -> onParams -> re-render, sin
// remount). prefs 'calFilters' guarda la ultima combinacion solo como
// recuerdo para prellenar el sheet; la URL siempre manda.
// ============================================================================

import {
  el,
  STATUSES, STATUS_ORDER,
  CONTENT_TYPES, CONTENT_TYPE_ORDER,
} from '../api.js?v=202607100036';
import * as calState from './state.js?v=202607100036';
import { parseFilters } from './data.js?v=202607100036';

// ── Controles del subhead (slot derecho) ─────────────────────────────────────
/**
 * Devuelve { nodes, sync(counts) } para shell.setViewControls.
 * counts = { filterCount, backlogCount }.
 */
export function buildControls(ctx) {
  // Segmented Mes / Semana (solo visible >=768px via CSS).
  const segBtns = new Map();
  const seg = el('div', { class: 'cal-modeseg', role: 'tablist', 'aria-label': 'Modo del calendario' });
  for (const m of ['mes', 'semana']) {
    const b = el('button', {
      type: 'button', role: 'tab', class: 'cal-modeseg__btn',
      text: m === 'mes' ? 'Mes' : 'Semana',
      onclick: () => calState.setMode(m),
    });
    segBtns.set(m, b);
    seg.appendChild(b);
  }

  // Boton de filtros con badge de activos.
  const filterBadge = el('span', { class: 'cal-ctlbtn__badge', hidden: true });
  const filterBtn = el('button', {
    class: 'cal-ctlbtn', type: 'button', 'aria-label': 'Filtros',
    onclick: () => openFiltersSheet(ctx, { anchor: filterBtn }),
  }, [ctx.icons('filter', 20), filterBadge]);

  // Toggle del backlog (panel Sin fecha, solo desktop via CSS).
  const backlogBadge = el('span', { class: 'cal-ctlbtn__badge', hidden: true });
  const backlogBtn = el('button', {
    class: 'cal-ctlbtn cal-ctlbtn--backlog', type: 'button',
    'aria-label': 'Mostrar u ocultar el backlog sin fecha',
    onclick: () => calState.setBacklogOpen(!calState.get().backlogOpen),
  }, [ctx.icons('inbox', 20), backlogBadge]);

  function sync({ filterCount = 0, backlogCount = 0 } = {}) {
    const { mode, backlogOpen } = calState.get();
    for (const [m, b] of segBtns) {
      const is = m === mode;
      b.classList.toggle('is-active', is);
      b.setAttribute('aria-selected', is ? 'true' : 'false');
    }
    filterBadge.hidden = filterCount <= 0;
    filterBadge.textContent = String(filterCount);
    filterBtn.classList.toggle('is-active', filterCount > 0);
    backlogBadge.hidden = backlogCount <= 0;
    backlogBadge.textContent = backlogCount > 99 ? '99+' : String(backlogCount);
    backlogBtn.classList.toggle('is-active', backlogOpen);
    backlogBtn.setAttribute('aria-pressed', backlogOpen ? 'true' : 'false');
  }

  return { nodes: [seg, backlogBtn, filterBtn], sync };
}

// ── Sheet de filtros ─────────────────────────────────────────────────────────

function chipBtn(label, color, active, onTap) {
  const b = el('button', {
    class: 'cal-fchip' + (active ? ' is-active' : ''),
    type: 'button', 'aria-pressed': active ? 'true' : 'false',
  }, [
    color ? el('span', { class: 'cal-fchip__dot', style: { background: color } }) : null,
    el('span', { text: label }),
  ]);
  b.addEventListener('click', () => {
    const on = b.classList.toggle('is-active');
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    onTap(on);
  });
  return b;
}

export function openFiltersSheet(ctx, { anchor = null } = {}) {
  const current = parseFilters(ctx.store.getState().filters);
  // Copia editable local del sheet.
  const draft = {
    estado: new Set(current.estado),
    tipo: new Set(current.tipo),
    persona: current.persona,
    desde: current.desde,
    hasta: current.hasta,
  };

  ctx.sheet.openSheet({
    title: 'Filtros',
    mode: 'form',
    anchor,
    build(body, close) {
      // Estado (multi).
      const estadoWrap = el('div', { class: 'cal-fchips', role: 'group', 'aria-label': 'Filtrar por estado' });
      for (const s of STATUS_ORDER || []) {
        const info = (STATUSES && STATUSES[s]) || { label: s };
        estadoWrap.appendChild(chipBtn(info.label || s, info.color || null, draft.estado.has(s), (on) => {
          if (on) draft.estado.add(s); else draft.estado.delete(s);
        }));
      }

      // Tipo (multi).
      const tipoWrap = el('div', { class: 'cal-fchips', role: 'group', 'aria-label': 'Filtrar por tipo' });
      for (const t of CONTENT_TYPE_ORDER || []) {
        const info = (CONTENT_TYPES && CONTENT_TYPES[t]) || { label: t };
        tipoWrap.appendChild(chipBtn(info.label || t, info.color || null, draft.tipo.has(t), (on) => {
          if (on) draft.tipo.add(t); else draft.tipo.delete(t);
        }));
      }

      // Persona (single, via pickPerson).
      const personaTxt = el('span', { class: 'qc-rowbtn__txt', text: draft.persona || 'Cualquier persona' });
      const personaBtn = el('button', { class: 'qc-rowbtn', type: 'button' }, [
        ctx.icons('user', 18), personaTxt, ctx.icons('down', 14),
      ]);
      personaBtn.addEventListener('click', async () => {
        const users = await ctx.store.loadUsers();
        const picked = await ctx.pickers.pickPerson({
          current: draft.persona,
          users: users || [],
          anchor: personaBtn,
          title: 'Filtrar por responsable',
        });
        if (picked === null) return;
        draft.persona = picked.name || '';
        personaTxt.textContent = draft.persona || 'Cualquier persona';
      });

      // Rango de fechas.
      const desdeIn = el('input', { class: 'input cal-fdate', type: 'date', 'aria-label': 'Desde' });
      if (draft.desde) desdeIn.value = draft.desde;
      desdeIn.addEventListener('change', () => { draft.desde = desdeIn.value || ''; });
      const hastaIn = el('input', { class: 'input cal-fdate', type: 'date', 'aria-label': 'Hasta' });
      if (draft.hasta) hastaIn.value = draft.hasta;
      hastaIn.addEventListener('change', () => { draft.hasta = hastaIn.value || ''; });

      // Footer: limpiar / aplicar.
      const clearBtn = el('button', {
        class: 'btn', type: 'button', text: 'Limpiar',
        onclick: () => {
          close({ source: 'clear' });
          applyToUrl(ctx, { estado: [], tipo: [], persona: '', desde: '', hasta: '' });
        },
      });
      const applyBtn = el('button', {
        class: 'btn btn-primary sheet-cta', type: 'button', text: 'Aplicar',
        onclick: () => {
          if (draft.desde && draft.hasta && draft.hasta < draft.desde) {
            ctx.toast('El rango de fechas esta invertido: revisa Desde y Hasta.', { type: 'error' });
            return;
          }
          close({ source: 'apply' });
          applyToUrl(ctx, {
            estado: [...draft.estado],
            tipo: [...draft.tipo],
            persona: draft.persona,
            desde: draft.desde,
            hasta: draft.hasta,
          });
        },
      });

      body.append(
        el('div', { class: 'field' }, [el('label', { class: 'label', text: 'Estado' }), estadoWrap]),
        el('div', { class: 'field' }, [el('label', { class: 'label', text: 'Tipo de contenido' }), tipoWrap]),
        el('div', { class: 'field' }, [el('label', { class: 'label', text: 'Responsable' }), personaBtn]),
        el('div', { class: 'field' }, [
          el('label', { class: 'label', text: 'Rango de fechas' }),
          el('div', { class: 'cal-fdates' }, [
            desdeIn,
            el('span', { class: 'cal-fdates__sep', text: 'a' }),
            hastaIn,
          ]),
        ]),
        el('div', { class: 'sheet__footer' }, [clearBtn, applyBtn]),
      );
    },
  });
}

/** Serializa los filtros a la URL (merge sobre los params actuales). */
function applyToUrl(ctx, f) {
  const cur = ctx.router.current();
  const params = { ...cur.params };
  const setOrDel = (k, v) => { if (v) params[k] = v; else delete params[k]; };
  setOrDel('estado', (f.estado || []).join(','));
  setOrDel('tipo', (f.tipo || []).join(','));
  setOrDel('persona', f.persona || '');
  setOrDel('desde', f.desde || '');
  setOrDel('hasta', f.hasta || '');
  ctx.prefs.set('calFilters', {
    estado: f.estado || [], tipo: f.tipo || [],
    persona: f.persona || '', desde: f.desde || '', hasta: f.hasta || '',
  });
  ctx.router.navigate('calendario', params);
}
