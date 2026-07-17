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

import { el, copyText } from '../api.js?v=202607170114';
import { icon } from '../shell/icons.js?v=202607170114';
import { makeTextarea } from './fields.js?v=202607170114';
import { slidesFromPost, fieldsFromSlides, slideLabel, slideHint, slidePlaceholder, slidesToText, altsFromText, altsToText } from './slides.js?v=202607170114';

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

  // Botoncito de copiar por sección (como el de Claude): copia el valor ACTUAL
  // del campo al portapapeles. Vive en la cabecera de cada bloque.
  function copyBtn(field, label) {
    return el('button', {
      class: 'edcopy-mini', type: 'button', title: `Copiar ${label}`,
      'aria-label': `Copiar ${label}`,
      onclick: async () => {
        const v = String(ed.getPost()[field] || '').trim();
        if (!v) { ctx.toast(`No hay ${label} que copiar.`, { type: 'info' }); return; }
        const ok = await copyText(v);
        ctx.toast(ok ? `${label} copiado.` : 'No se pudo copiar.', { type: ok ? 'success' : 'error' });
      },
    }, [icon('copy', 14)]);
  }

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
        copyBtn(field, title),
      ]),
      ta,
    ]);
  }

  // ── Guion ──────────────────────────────────────────────────────────────────
  // Carrusel: se edita POR SLIDES (Slide 1 · HOOK … Slide N · CTA, + agregar).
  // Reel/foto/etc.: los bloques HOOK/BODY/CTA de siempre.
  const isCarrusel = post.content_type === 'carrusel';
  let slides = null;
  let alts = null;
  let altsWrap = null;
  let renderAlts = () => {};
  if (isCarrusel) {
    slides = slidesFromPost(post);
    if (slides.length < 2) slides = [slides[0] || '', ''];
    alts = altsFromText(post.alt_text, slides.length);
    altsWrap = el('div', { class: 'edslides edalts' });
    renderAlts = () => {
      while (altsWrap.firstChild) altsWrap.removeChild(altsWrap.firstChild);
      alts.forEach((text, i) => {
        const ta = makeTextarea({
          value: text,
          placeholder: `Describe la imagen del slide ${i + 1} (SEO/accesibilidad)`,
          maxLength: 1000,
          onInput: (v) => { alts[i] = v; ed.setField('alt_text', altsToText(alts)); },
          onBlur: () => ed.flush(),
        });
        altsWrap.appendChild(el('div', { class: 'edblock' }, [
          el('div', { class: 'edblock__head' }, [
            el('span', { class: 'edblock__title', text: `SEO ALT · SLIDE ${i + 1}` }),
            i === 0 ? el('span', { class: 'edblock__hint', text: 'Texto alternativo (IG)' }) : null,
            i > 0 ? el('button', {
              class: 'edcopy-mini edslide-del', type: 'button', title: 'Quitar este SEO alt',
              'aria-label': `Quitar SEO alt del slide ${i + 1}`,
              onclick: () => {
                alts.splice(i, 1);
                ed.setField('alt_text', altsToText(alts)); ed.flush();
                renderAlts();
              },
            }, [icon('trash', 14)]) : null,
            el('button', {
              class: 'edcopy-mini', type: 'button', title: `Copiar SEO alt del slide ${i + 1}`,
              'aria-label': `Copiar SEO alt del slide ${i + 1}`,
              onclick: async () => {
                const v = String(alts[i] || '').trim();
                if (!v) { ctx.toast('Este alt está vacío.', { type: 'info' }); return; }
                const ok = await copyText(v);
                ctx.toast(ok ? 'SEO alt copiado.' : 'No se pudo copiar.', { type: ok ? 'success' : 'error' });
              },
            }, [icon('copy', 14)]),
          ]),
          ta,
        ]));
      });
      altsWrap.appendChild(el('button', {
        class: 'btn edslide-add', type: 'button',
        onclick: () => { alts.push(''); ed.setField('alt_text', altsToText(alts)); renderAlts(); },
      }, [icon('plus', 16), ' Agregar SEO alt']));
    };
    const slidesWrap = el('div', { class: 'edslides' });
    const syncFields = () => {
      const f = fieldsFromSlides(slides);
      ed.setField('hook', f.hook);
      ed.setField('body', f.body);
      ed.setField('cta', f.cta);
    };
    const copySlideBtn = (i) => el('button', {
      class: 'edcopy-mini', type: 'button', title: 'Copiar este slide',
      'aria-label': `Copiar slide ${i + 1}`,
      onclick: async () => {
        const v = String(slides[i] || '').trim();
        if (!v) { ctx.toast('Este slide está vacío.', { type: 'info' }); return; }
        const ok = await copyText(v);
        ctx.toast(ok ? 'Slide copiado.' : 'No se pudo copiar.', { type: ok ? 'success' : 'error' });
      },
    }, [icon('copy', 14)]);
    // Reordenar arrastrando (drag & drop con mouse): solo los slides de EN
    // MEDIO se mueven — la Portada siempre abre y el Cierre siempre cierra.
    let dragIdx = null;
    const isMiddle = (i) => i > 0 && i < slides.length - 1;
    const moveSlide = (from, to) => {
      const [s] = slides.splice(from, 1); slides.splice(to, 0, s);
      const [a] = alts.splice(from, 1); alts.splice(to, 0, a);
      syncFields(); ed.setField('alt_text', altsToText(alts)); ed.flush();
      renderSlides(); renderAlts();
    };
    const renderSlides = () => {
      while (slidesWrap.firstChild) slidesWrap.removeChild(slidesWrap.firstChild);
      const blockRefs = [];
      slides.forEach((text, i) => {
        const ta = makeTextarea({
          value: text,
          placeholder: slidePlaceholder(i, slides.length),
          maxLength: 4000,
          onInput: (v) => { slides[i] = v; syncFields(); },
          onBlur: () => ed.flush(),
        });
        const hint = slideHint(i, slides.length);
        const grip = isMiddle(i) ? el('span', {
          class: 'edslide-grip', title: 'Arrastra para reordenar', 'aria-hidden': 'true',
        }, [icon('grip', 16)]) : null;
        const blockEl = el('div', { class: 'edblock' }, [
          el('div', { class: 'edblock__head' }, [
            el('span', { class: 'edblock__title', text: slideLabel(i, slides.length) }),
            hint ? el('span', { class: 'edblock__hint', text: hint }) : null,
            (i > 0 && i < slides.length - 1) ? el('button', {
              class: 'edcopy-mini edslide-del', type: 'button', title: 'Quitar este slide',
              'aria-label': `Quitar slide ${i + 1}`,
              onclick: () => {
                slides.splice(i, 1); alts.splice(i, 1);
                syncFields(); ed.setField('alt_text', altsToText(alts)); ed.flush();
                renderSlides(); renderAlts();
              },
            }, [icon('trash', 14)]) : null,
            copySlideBtn(i),
            grip, // agarradera al costado DERECHO (después de borrar/copiar)
          ]),
          ta,
        ]);
        if (grip) {
          // Arrastre por POINTER EVENTS (no drag nativo HTML5, que falla en
          // Safari/Mac): al presionar la ⠿ el bloque sigue al cursor; el slide
          // bajo el cursor se marca; al soltar encima, se intercambia el orden.
          grip.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            const startY = e.clientY;
            let target = null;
            let moved = false;
            document.body.style.userSelect = 'none';
            const onMove = (ev) => {
              const dy = ev.clientY - startY;
              if (!moved && Math.abs(dy) > 4) { moved = true; blockEl.classList.add('is-dragging'); }
              if (!moved) return;
              blockEl.style.transform = `translateY(${dy}px)`;
              target = null;
              for (const ref of blockRefs) {
                if (ref.el === blockEl || !isMiddle(ref.i)) { ref.el.classList.remove('is-dropover'); continue; }
                const r = ref.el.getBoundingClientRect();
                const over = ev.clientY >= r.top && ev.clientY <= r.bottom;
                ref.el.classList.toggle('is-dropover', over);
                if (over) target = ref.i;
              }
            };
            const onUp = () => {
              document.removeEventListener('pointermove', onMove);
              document.removeEventListener('pointerup', onUp);
              document.body.style.userSelect = '';
              blockEl.classList.remove('is-dragging');
              blockEl.style.transform = '';
              for (const ref of blockRefs) ref.el.classList.remove('is-dropover');
              if (moved && target !== null && target !== i) moveSlide(i, target);
            };
            document.addEventListener('pointermove', onMove);
            document.addEventListener('pointerup', onUp);
          });
        }
        blockRefs.push({ el: blockEl, i });
        slidesWrap.appendChild(blockEl);
      });
      slidesWrap.appendChild(el('button', {
        class: 'btn edslide-add', type: 'button',
        onclick: () => {
          slides.splice(slides.length - 1, 0, '');
          alts.splice(alts.length - 1, 0, '');
          syncFields(); renderSlides(); renderAlts();
        },
      }, [icon('plus', 16), ' Agregar slide']));
    };
    renderSlides();
    root.appendChild(slidesWrap);
  } else {
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
  }

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
      copyBtn('caption', 'Caption'),
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
      copyBtn('hashtags', 'Hashtags'),
    ]),
    tagTa,
  ]));

  // ── SEO ALT (texto alternativo) — abajo de hashtags ───────────────────────
  if (isCarrusel) {
    renderAlts();
    root.appendChild(altsWrap);
  } else {
    root.appendChild(block({
      title: 'SEO ALT',
      hint: 'Texto alternativo de la imagen (IG)',
      field: 'alt_text',
      value: post.alt_text || '',
      placeholder: 'Describe la imagen para SEO/accesibilidad',
      maxLength: 1000,
    }));
  }

  // ── Copiar (mismos 3 botones que el panel de guion de escritorio) ──────────
  async function copyCaption() {
    const v = String(ed.getPost().caption || '').trim();
    if (!v) { ctx.toast('No hay caption que copiar.', { type: 'info' }); return; }
    const ok = await copyText(v);
    ctx.toast(ok ? 'Caption copiado.' : 'No se pudo copiar.', { type: ok ? 'success' : 'error' });
  }
  async function copyCaptionTags() {
    const p = ed.getPost();
    const parts = [p.caption, p.hashtags].map((s) => String(s || '').trim()).filter(Boolean);
    if (!parts.length) { ctx.toast('No hay caption que copiar.', { type: 'info' }); return; }
    const ok = await copyText(parts.join('\n\n'));
    ctx.toast(ok ? 'Caption + hashtags copiados.' : 'No se pudo copiar.', { type: ok ? 'success' : 'error' });
  }
  async function copyScript() {
    const p = ed.getPost();
    let text = '';
    if (isCarrusel && slides) {
      text = slidesToText(slides);
    } else {
      const lines = [];
      if (String(p.hook || '').trim()) lines.push(`HOOK:\n${String(p.hook).trim()}`);
      if (String(p.body || '').trim()) lines.push(`BODY:\n${String(p.body).trim()}`);
      if (String(p.cta || '').trim()) lines.push(`CTA:\n${String(p.cta).trim()}`);
      text = lines.join('\n\n');
    }
    if (!text) { ctx.toast('No hay guion que copiar.', { type: 'info' }); return; }
    const ok = await copyText(text);
    ctx.toast(ok ? 'Guion copiado.' : 'No se pudo copiar.', { type: ok ? 'success' : 'error' });
  }

  root.appendChild(el('div', { class: 'edcopy-row' }, [
    el('button', { class: 'btn', type: 'button', onclick: copyCaption }, [icon('copy', 16), 'Copiar caption']),
    el('button', { class: 'btn', type: 'button', onclick: copyCaptionTags }, [icon('copy', 16), 'Copiar caption + hashtags']),
    el('button', { class: 'btn', type: 'button', onclick: copyScript }, [icon('copy', 16), 'Copiar guion completo']),
  ]));

  host.appendChild(root);

  return function dispose() { /* los textareas mueren con el DOM */ };
}
