// ============================================================================
// IVAE Marketing v2 - Editor de post: tab Guion (HOOK / BODY / CTA).
//
// - Bloques HOOK ("Las primeras palabras venden"), BODY y CTA con textareas
//   autosize y autosave con debounce 800ms + flush en blur.
// - Caption con contador en vivo: marca el corte visible de Instagram (~125)
//   y el maximo (2200, con maxlength fisico).
// - Hashtags con contador N/30 y aviso al pasarse.
// - Botones "Copiar caption" (caption + hashtags) y "Copiar guion completo"
//   (HOOK/BODY/CTA etiquetados) via copyText de api.js.
//
// mount(host, ed) -> dispose()
// ============================================================================

import { el, copyText } from '../api.js?v=202606200400';
import { icon } from '../shell/icons.js?v=202606200400';
import { makeTextarea } from './fields.js?v=202606200400';

const IG_VISIBLE_CUT = 125;
const CAPTION_MAX = 2200;
const HASHTAG_MAX = 30;

function countHashtags(text) {
  const m = String(text || '').match(/#[^\s#]+/g);
  return m ? m.length : 0;
}

export function mount(host, ed) {
  const { ctx } = ed;
  const post = ed.getPost();
  const root = el('div', { class: 'edtab edtab-guion' });

  function block({ title, hint, field, value, placeholder, maxLength = 4000 }) {
    const ta = makeTextarea({
      value,
      placeholder,
      maxLength,
      onInput: (v) => ed.setField(field, v),
      onBlur: () => ed.flush(),
    });
    return el('div', { class: 'edblock' }, [
      el('div', { class: 'edblock__head' }, [
        el('span', { class: 'edblock__title', text: title }),
        hint ? el('span', { class: 'edblock__hint', text: hint }) : null,
      ]),
      ta,
    ]);
  }

  // ── HOOK / BODY / CTA ──────────────────────────────────────────────────────
  root.appendChild(block({
    title: 'HOOK',
    hint: 'Las primeras palabras venden',
    field: 'hook',
    value: post.hook || '',
    placeholder: 'El gancho que detiene el scroll',
  }));
  root.appendChild(block({
    title: 'BODY',
    hint: 'Desarrollo de la idea',
    field: 'body',
    value: post.body || '',
    placeholder: 'El cuerpo del guion, una idea por bloque',
  }));
  root.appendChild(block({
    title: 'CTA',
    hint: 'Cierre con accion clara',
    field: 'cta',
    value: post.cta || '',
    placeholder: 'Que quieres que haga la persona al terminar',
  }));

  // ── Caption con contador en vivo ───────────────────────────────────────────
  const capCounter = el('span', { class: 'edcount' });
  const capTa = makeTextarea({
    value: post.caption || '',
    placeholder: 'Caption del post',
    maxLength: CAPTION_MAX,
    onInput: (v) => { ed.setField('caption', v); updateCapCounter(v); },
    onBlur: () => ed.flush(),
  });
  function updateCapCounter(v) {
    const len = String(v || '').length;
    capCounter.textContent = `${len}/${CAPTION_MAX}`;
    capCounter.classList.toggle('is-over', len >= CAPTION_MAX);
    capCounter.classList.toggle('is-cut', len > IG_VISIBLE_CUT && len < CAPTION_MAX);
    capCounter.title = len > IG_VISIBLE_CUT
      ? `Instagram corta la vista previa cerca de los ${IG_VISIBLE_CUT} caracteres`
      : '';
  }
  updateCapCounter(post.caption || '');
  root.appendChild(el('div', { class: 'edblock' }, [
    el('div', { class: 'edblock__head' }, [
      el('span', { class: 'edblock__title', text: 'Caption' }),
      el('span', { class: 'edblock__hint', text: `Corte visible en IG: ~${IG_VISIBLE_CUT}` }),
      capCounter,
    ]),
    capTa,
  ]));

  // ── Hashtags con contador N/30 ─────────────────────────────────────────────
  const tagCounter = el('span', { class: 'edcount' });
  const tagTa = makeTextarea({
    value: post.hashtags || '',
    placeholder: '#hashtags separados por espacio',
    maxLength: 2000,
    onInput: (v) => { ed.setField('hashtags', v); updateTagCounter(v); },
    onBlur: () => ed.flush(),
  });
  let warnedTags = false;
  function updateTagCounter(v) {
    const n = countHashtags(v);
    tagCounter.textContent = `${n}/${HASHTAG_MAX}`;
    const over = n > HASHTAG_MAX;
    tagCounter.classList.toggle('is-over', over);
    if (over && !warnedTags) {
      warnedTags = true;
      ctx.toast(`Instagram permite maximo ${HASHTAG_MAX} hashtags.`, { type: 'info' });
    }
    if (!over) warnedTags = false;
  }
  updateTagCounter(post.hashtags || '');
  root.appendChild(el('div', { class: 'edblock' }, [
    el('div', { class: 'edblock__head' }, [
      el('span', { class: 'edblock__title', text: 'Hashtags' }),
      tagCounter,
    ]),
    tagTa,
  ]));

  // ── Copiar ─────────────────────────────────────────────────────────────────
  async function copyCaption() {
    const p = ed.getPost();
    const parts = [p.caption, p.hashtags].map((s) => String(s || '').trim()).filter(Boolean);
    if (!parts.length) { ctx.toast('No hay caption que copiar.', { type: 'info' }); return; }
    const ok = await copyText(parts.join('\n\n'));
    ctx.toast(ok ? 'Caption copiado.' : 'No se pudo copiar.', { type: ok ? 'success' : 'error' });
  }
  async function copyScript() {
    const p = ed.getPost();
    const lines = [];
    if (String(p.hook || '').trim()) lines.push(`HOOK:\n${String(p.hook).trim()}`);
    if (String(p.body || '').trim()) lines.push(`BODY:\n${String(p.body).trim()}`);
    if (String(p.cta || '').trim()) lines.push(`CTA:\n${String(p.cta).trim()}`);
    if (!lines.length) { ctx.toast('No hay guion que copiar.', { type: 'info' }); return; }
    const ok = await copyText(lines.join('\n\n'));
    ctx.toast(ok ? 'Guion copiado.' : 'No se pudo copiar.', { type: ok ? 'success' : 'error' });
  }

  root.appendChild(el('div', { class: 'edcopy-row' }, [
    el('button', { class: 'btn', type: 'button', onclick: copyCaption }, [icon('copy', 16), 'Copiar caption']),
    el('button', { class: 'btn', type: 'button', onclick: copyScript }, [icon('copy', 16), 'Copiar guion completo']),
  ]));

  host.appendChild(root);

  return function dispose() { /* los textareas mueren con el DOM */ };
}
