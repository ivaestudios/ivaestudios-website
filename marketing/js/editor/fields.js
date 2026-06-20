// ============================================================================
// IVAE Marketing v2 - Editor de post: primitivas de fila etiqueta-valor.
//
// Patron Monday movil: filas de 48px tap-to-edit. Nunca teclado inline salvo
// campos de texto. Cada primitiva devuelve { el, refresh() } y delega el
// guardado al caller (que usa el motor de autosave del editor).
//
//   rowButton     fila generica que abre un picker (chevron a la derecha)
//   rowSwitch     switch accesible (role=switch, 44px de target)
//   rowUrl        enlace con validacion http/https + boton Abrir rel=noopener
//   rowTextExpand textarea expandida en sheet (notas largas)
//   makeTextarea  textarea autosize 16px (guion, caption, titulo)
//   isSafeHttpUrl validacion: solo http/https via new URL (jamas javascript:)
// ============================================================================

import { el } from '../api.js?v=202606200400';
import { icon } from '../shell/icons.js?v=202606200400';
import { openSheet } from '../shell/sheet.js?v=202606200400';
import { textExpand } from '../ui/pickers.js?v=202606200400';

// ── Validacion de URLs (regla dura: solo http/https) ─────────────────────────
export function isSafeHttpUrl(value) {
  const v = String(value || '').trim();
  if (!v) return false;
  try {
    const u = new URL(v);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function hostOf(value) {
  try { return new URL(String(value)).host; } catch { return String(value); }
}

// ── Textarea autosize (sin saltos de layout) ─────────────────────────────────
export function autosize(ta) {
  const fit = () => {
    ta.style.height = 'auto';
    ta.style.height = `${Math.max(ta.scrollHeight, 24)}px`;
  };
  ta.addEventListener('input', fit);
  // Primer ajuste cuando ya esta en el DOM.
  requestAnimationFrame(fit);
  return fit;
}

/**
 * makeTextarea({value, placeholder, maxLength, rows, onInput, onBlur})
 * Textarea 16px (no zoom iOS) con autosize. Devuelve el nodo.
 */
export function makeTextarea({ value = '', placeholder = '', maxLength = 4000, rows = 1, onInput, onBlur } = {}) {
  const ta = el('textarea', {
    class: 'ed-ta', rows: String(rows), placeholder,
    maxlength: String(maxLength),
  });
  ta.value = value || '';
  autosize(ta);
  if (onInput) ta.addEventListener('input', () => onInput(ta.value));
  if (onBlur) ta.addEventListener('blur', () => onBlur(ta.value));
  return ta;
}

// ── Fila generica tap-to-edit ────────────────────────────────────────────────
/**
 * rowButton({label, render(valueEl, post), onTap(anchor)})
 * `render` repinta el valor (recibe el contenedor vacio); `onTap` abre el
 * picker correspondiente (recibe la fila como anchor para popover desktop).
 */
export function rowButton({ label, render, onTap, danger = false }) {
  const valueEl = el('span', { class: 'edrow__value' });
  const row = el('button', {
    class: 'edrow' + (danger ? ' edrow--danger' : ''),
    type: 'button',
    onclick: () => onTap?.(row),
  }, [
    el('span', { class: 'edrow__label', text: label }),
    valueEl,
    icon('right', 16),
  ]);
  function refresh() {
    while (valueEl.firstChild) valueEl.removeChild(valueEl.firstChild);
    try { render?.(valueEl); } catch (e) { console.error('[fields] render', label, e); }
  }
  refresh();
  return { el: row, refresh };
}

/** Valor vacio estandar para las filas ("Agregar..."). */
export function emptyValue(text = 'Agregar') {
  return el('span', { class: 'edrow__empty', text });
}

// ── Switch accesible ─────────────────────────────────────────────────────────
/**
 * rowSwitch({label, sub, get():bool, onToggle(next:bool)})
 * onToggle puede devolver false (o una Promise de false) para vetar el cambio
 * (avisos contextuales tipo "El cliente dejara de verlo").
 */
export function rowSwitch({ label, sub = '', get, onToggle }) {
  const knob = el('span', { class: 'edswitch__knob' });
  const track = el('span', { class: 'edswitch', 'aria-hidden': 'true' }, [knob]);
  const row = el('button', {
    class: 'edrow edrow--switch', type: 'button', role: 'switch',
  }, [
    el('span', { class: 'edrow__main' }, [
      el('span', { class: 'edrow__label', text: label }),
      sub ? el('span', { class: 'edrow__sub', text: sub }) : null,
    ]),
    track,
  ]);
  function refresh() {
    const on = !!get();
    row.setAttribute('aria-checked', on ? 'true' : 'false');
    track.classList.toggle('is-on', on);
  }
  row.addEventListener('click', async () => {
    const next = !get();
    try {
      const ok = await onToggle?.(next);
      if (ok === false) { refresh(); return; }
    } catch (e) { console.error('[fields] switch', label, e); }
    refresh();
  });
  refresh();
  return { el: row, refresh };
}

// ── Fila de URL (Inspiracion / Video) ────────────────────────────────────────
/**
 * rowUrl({label, get():string, onSave(url:string)})
 * Tap en la fila abre un sheet con input type=url; el boton Abrir solo
 * aparece con URL http/https valida (rel=noopener noreferrer).
 */
export function rowUrl({ label, get, onSave }) {
  const valueEl = el('span', { class: 'edrow__value' });
  const openBtn = el('a', {
    class: 'edrow__open', text: 'Abrir',
    target: '_blank', rel: 'noopener noreferrer',
    onclick: (e) => e.stopPropagation(),
  });

  const row = el('button', {
    class: 'edrow edrow--url', type: 'button',
    onclick: () => edit(row),
  }, [
    el('span', { class: 'edrow__label', text: label }),
    valueEl,
    openBtn,
    icon('right', 16),
  ]);

  function refresh() {
    const v = String(get() || '').trim();
    while (valueEl.firstChild) valueEl.removeChild(valueEl.firstChild);
    if (v && isSafeHttpUrl(v)) {
      valueEl.appendChild(el('span', { class: 'edrow__link', text: hostOf(v) }));
      openBtn.href = v;
      openBtn.hidden = false;
    } else if (v) {
      valueEl.appendChild(el('span', { class: 'edrow__empty', text: 'Enlace no valido' }));
      openBtn.hidden = true;
      openBtn.removeAttribute('href');
    } else {
      valueEl.appendChild(emptyValue('Agregar enlace'));
      openBtn.hidden = true;
      openBtn.removeAttribute('href');
    }
  }

  function edit(anchor) {
    openSheet({
      title: label,
      mode: 'form',
      anchor,
      build(body, close) {
        const input = el('input', {
          class: 'input ed-input', type: 'url', inputmode: 'url',
          placeholder: 'https://...',
        });
        input.value = String(get() || '');
        const err = el('div', { class: 'field__error', text: '' });
        const save = () => {
          const v = input.value.trim();
          if (v && !isSafeHttpUrl(v)) {
            err.textContent = 'Solo se aceptan enlaces http o https.';
            input.setAttribute('aria-invalid', 'true');
            return;
          }
          onSave?.(v);
          refresh();
          close({ source: 'save' });
        };
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); save(); } });
        body.append(
          el('div', { class: 'field' }, [el('label', { class: 'label', text: 'Enlace' }), input, err]),
          el('div', { class: 'sheet__footer' }, [
            el('button', { class: 'btn', type: 'button', text: 'Cancelar', onclick: () => close({ source: 'cancel' }) }),
            el('button', { class: 'btn btn-primary sheet-cta', type: 'button', text: 'Guardar', onclick: save }),
          ]),
        );
        setTimeout(() => input.focus(), 60);
      },
    });
  }

  refresh();
  return { el: row, refresh };
}

// ── Fila de texto largo (notas) ──────────────────────────────────────────────
/**
 * rowTextExpand({label, get():string, onSave(text), placeholder, maxLength})
 * Muestra una preview de 1 linea; tap abre el textExpand compartido.
 */
export function rowTextExpand({ label, get, onSave, placeholder = '', maxLength = 4000 }) {
  const valueEl = el('span', { class: 'edrow__value' });
  const row = el('button', {
    class: 'edrow', type: 'button',
    onclick: async () => {
      const next = await textExpand({
        title: label,
        value: String(get() || ''),
        placeholder,
        maxLength,
      });
      if (next === null) return; // cancelado
      onSave?.(next);
      refresh();
    },
  }, [
    el('span', { class: 'edrow__label', text: label }),
    valueEl,
    icon('right', 16),
  ]);
  function refresh() {
    const v = String(get() || '').trim();
    while (valueEl.firstChild) valueEl.removeChild(valueEl.firstChild);
    if (v) valueEl.appendChild(el('span', { class: 'edrow__preview', text: v }));
    else valueEl.appendChild(emptyValue('Agregar'));
  }
  refresh();
  return { el: row, refresh };
}
