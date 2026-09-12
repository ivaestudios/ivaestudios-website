// ============================================================================
// IVAE Marketing - Panel lateral del GUION, compartido por las vistas.
//
// Nacio dentro de la vista Meses ("Calendario"). Vianey lo pidio tambien en la
// Cuadricula (2026-09-11): "cuando le pones click tiene que aparecer el guion
// igual que en el calendario, no esa ventana" — antes la Cuadricula abria el
// editor completo a pantalla partida.
//
// Vive en document.body, asi que sobrevive a los re-render de cualquier tabla.
// Quien lo abre pasa su contexto y, si quiere, tres ganchos:
//   trackMutation(promesa)  envuelve el guardado (la vista Meses lo usa para
//                           descartar respuestas de una marca que ya cambio)
//   alGuardar(saved)        se llama con la pieza guardada
//   avisarCaption(id, txt)  guardarrail de caption sucio
//   abrirEditor()           si existe, el pie muestra "Abrir contenido"
// ============================================================================

import { el, copyText, clearClipboard } from '../api.js?v=202609121521';
import { icon } from '../shell/icons.js?v=202609121521';
import { T } from '../shell/i18n.js?v=202609121521';
import { pushLayer } from '../shell/router.js?v=202609121521';
import {
  slidesFromPost, fieldsFromSlides, slideLabel, slideHint, slidePlaceholder,
  slidesToText, altsFromText, altsToText,
} from '../editor/slides.js?v=202609121521';

// Contexto y ganchos de la apertura en curso.
let ctx = null;
let ganchos = {};

// ── Panel lateral de caption (estilo side peek de Notion) ────────────────────
// Los captions son largos: la celda solo muestra un preview y el panel lateral
// da espacio completo para leer y editar. Vive en document.body (sobrevive a
// los re-renders de la tabla).

let drawerEl = null;
let drawerFlush = null; // guarda lo pendiente ANTES de cerrar (autosave)
let drawerRelease = null; // capa de history: el boton atras cierra el panel

// Publicadas por abrirGuion para que el cierre pueda proteger el texto.
let drawerHasUnsaved = null;
let drawerRetry = null;

// `force` = ya se decidió descartar (o no había nada que perder).
export async function cerrarGuion(info = {}) {
  if (!drawerEl) return;

  // Si queda texto sin guardar, intenta guardarlo UNA vez y, si aun así falla,
  // pregunta antes de cerrar en vez de tragarse el trabajo.
  if (!info.force && typeof drawerHasUnsaved === 'function' && drawerHasUnsaved()) {
    const guardado = drawerRetry ? await drawerRetry() : false;
    if (!guardado) {
      const v = await ctx.sheet.pickFrom({
        title: T('No se pudo guardar tu guion', 'Your script could not be saved'),
        options: [
          { value: 'reintentar', label: T('Reintentar', 'Try again'), sub: T('Revisa tu conexión y vuelve a intentarlo', 'Check your connection and try again') },
          { value: 'salir', label: T('Cerrar y perder lo escrito', 'Close and discard'), color: '#ef4444' },
        ],
      });
      if (v === 'reintentar') { const ok2 = drawerRetry ? await drawerRetry() : false; if (!ok2) return; }
      else if (v !== 'salir') return; // cerró la hoja = no cierres el panel
    }
  }
  drawerHasUnsaved = null;
  drawerRetry = null;
  try { if (drawerFlush) drawerFlush(); } catch { /* noop */ }
  drawerFlush = null;
  // Mismo contrato que sheet.js: si el cierre vino del boton atras, el
  // history YA consumio la capa; en cualquier otro cierre hay que soltarla.
  if (!info.fromHistory && drawerRelease) { try { drawerRelease(); } catch { /* noop */ } }
  drawerRelease = null;
  try { drawerEl.remove(); } catch { /* noop */ }
  drawerEl = null;
  document.removeEventListener('keydown', onDrawerKeydown, true);
}

function onDrawerKeydown(e) {
  if (e.key === 'Escape') { e.stopPropagation(); cerrarGuion(); }
}


// Copiar "nada" tiene que dejar el portapapeles VACÍO, no intacto.
// Si se deja intacto, el siguiente pegado suelta lo copiado del reel anterior
// — y eso termina publicado en el Instagram de un cliente. Pasó de verdad
// (2026-08-04, ADAGIO RH): la pieza no tenía caption y al pegar salió el de
// otra. Es el tipo de error que no se puede permitir dos veces.
export async function vaciarPortapapeles(ctx, mensaje) {
  const limpio = await clearClipboard();
  ctx.toast(limpio
    ? `${mensaje} ${T('Se vació lo copiado para que no pegues otro texto por error.', 'Clipboard cleared so you do not paste the wrong text.')}`
    : `${mensaje} ${T('⚠️ Revisa lo que pegas: puede quedar texto de otra pieza.', '⚠️ Check what you paste: text from another piece may remain.')}`,
    { type: limpio ? 'info' : 'error', ms: 7000 });
}

export async function abrirGuion(post, opciones = {}) {
  ctx = opciones.ctx || ctx;
  ganchos = opciones;
  // await: cerrar puede preguntar si hay guion sin guardar; sin esperar, el
  // panel viejo se removía DESPUÉS de crear el nuevo y se perdía la referencia.
  await cerrarGuion();

  // El guion COMPLETO por secciones (misma visualización que el móvil), en el
  // panel lateral derecho de siempre. Cada sección con su botón de copiar.
  // Carrusel: el guion se edita POR SLIDES (Slide 1 · HOOK … Slide N · CTA);
  // caption y hashtags siguen siendo secciones normales. Otros tipos: HOOK/BODY/CTA.
  const isCarrusel = post.content_type === 'carrusel';
  const SECTIONS = isCarrusel
    ? [
      { field: 'caption', label: 'CAPTION', hint: T('Listo para pegar en IG', 'Ready to paste into IG') },
      { field: 'hashtags', label: 'HASHTAGS', hint: '' },
    ]
    : [
      { field: 'hook', label: 'HOOK', hint: T('Las primeras palabras venden', 'The first words sell') },
      { field: 'body', label: 'BODY', hint: T('Desarrollo de la idea', 'Develop the idea') },
      { field: 'cta', label: 'CTA', hint: T('Cierre con acción clara', 'Close with a clear action') },
      { field: 'caption', label: 'CAPTION', hint: T('Listo para pegar en IG', 'Ready to paste into IG') },
      { field: 'hashtags', label: 'HASHTAGS', hint: '' },
      { field: 'alt_text', label: 'SEO ALT', hint: T('Texto alternativo de la imagen (IG)', 'Alt text for the image (IG)') },
    ];
  const tas = {};
  let slides = null;
  let alts = null; // SEO alt por slide (solo carrusel)
  if (isCarrusel) {
    slides = slidesFromPost(post);
    if (slides.length < 2) slides = [slides[0] || '', ''];
    alts = altsFromText(post.alt_text, slides.length);
  }

  async function copyField(field, label) {
    const v = String(tas[field] ? tas[field].value : '').trim();
    if (!v) { await vaciarPortapapeles(ctx, T(`No hay ${label} que copiar.`, `No ${label} to copy.`)); return; }
    let ok = false;
    try { await navigator.clipboard.writeText(v); ok = true; } catch { /* fallback abajo */ }
    if (!ok) {
      try { tas[field].select(); ok = document.execCommand('copy'); } catch { /* noop */ }
    }
    ctx.toast(ok ? T(`${label} copiado.`, `${label} copied.`) : T('No se pudo copiar.', 'Could not copy.'), { type: ok ? 'success' : 'error' });
  }

  // Los mismos 3 botones de copiar que el tab Guion del editor (móvil):
  // caption solo, caption + hashtags (listo para IG) y guion completo.
  async function copyPlain(text, okMsg, emptyMsg) {
    const v = String(text || '').trim();
    if (!v) { await vaciarPortapapeles(ctx, emptyMsg); return; }
    const ok = await copyText(v);
    ctx.toast(ok ? okMsg : T('No se pudo copiar.', 'Could not copy.'), { type: ok ? 'success' : 'error' });
  }
  function copyCaptionOnly() {
    return copyPlain(tas.caption.value, T('Caption copiado.', 'Caption copied.'), T('No hay caption que copiar.', 'No caption to copy.'));
  }
  function copyCaptionAll() {
    const parts = ['caption', 'hashtags'].map((f) => String(tas[f] ? tas[f].value : '').trim()).filter(Boolean);
    return copyPlain(parts.join('\n\n'), T('Caption + hashtags copiados.', 'Caption + hashtags copied.'), T('No hay caption que copiar.', 'No caption to copy.'));
  }
  function copyScriptAll() {
    if (isCarrusel && slides) {
      return copyPlain(slidesToText(slides), T('Guion copiado.', 'Script copied.'), T('No hay guion que copiar.', 'No script to copy.'));
    }
    const lines = [];
    for (const [f, lbl] of [['hook', 'HOOK'], ['body', 'BODY'], ['cta', 'CTA']]) {
      const v = String(tas[f] ? tas[f].value : '').trim();
      if (v) lines.push(`${lbl}:\n${v}`);
    }
    return copyPlain(lines.join('\n\n'), T('Guion copiado.', 'Script copied.'), T('No hay guion que copiar.', 'No script to copy.'));
  }

  // Autosize: cada caja crece hasta su contenido (máx 320px) — nada de texto
  // rebanado a media línea.
  const fit = (ta) => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight + 2, 320) + 'px'; };

  const counters = {};
  function updateCount(field) {
    const elc = counters[field]; if (!elc) return;
    const v = String(tas[field].value || '');
    if (field === 'hashtags') {
      const n = (v.match(/#[^\s#]+/g) || []).length;
      elc.textContent = `${n}/30`;
      elc.classList.toggle('is-over', n > 30);
    } else {
      elc.textContent = `${v.length}/2200`;
      elc.classList.toggle('is-over', v.length >= 2200);
    }
  }

  // Host de slides (solo carrusel): se reconstruye al agregar/quitar slides.
  const slidesHost = isCarrusel ? el('div', { class: 'meses-drawer__slides' }) : null;
  function renderSlides() {
    if (!slidesHost) return;
    while (slidesHost.firstChild) slidesHost.removeChild(slidesHost.firstChild);
    // Reordenar arrastrando (pointer events, igual que el editor): solo los
    // slides de EN MEDIO — la Portada abre y el Cierre cierra, fijos.
    const blockRefs = [];
    const isMiddle = (idx) => idx > 0 && idx < slides.length - 1;
    const moveSlide = (from, to) => {
      const [s] = slides.splice(from, 1); slides.splice(to, 0, s);
      const [a] = alts.splice(from, 1); alts.splice(to, 0, a);
      renderSlides(); renderAlts(); scheduleSave();
    };
    slides.forEach((text, i) => {
      const ta = el('textarea', {
        class: 'meses-drawer__ta meses-drawer__ta--sec',
        placeholder: slidePlaceholder(i, slides.length),
        maxLength: 4000,
        rows: 1,
      });
      ta.value = text || '';
      ta.addEventListener('input', () => { slides[i] = ta.value; fit(ta); scheduleSave(); });
      ta.addEventListener('blur', () => flushSave());
      const hint = slideHint(i, slides.length);
      const grip = isMiddle(i) ? el('span', {
        class: 'edslide-grip', title: T('Arrastra para reordenar', 'Drag to reorder'), 'aria-hidden': 'true',
      }, [icon('grip', 16)]) : null;
      const secEl = el('section', { class: 'mdsec' }, [
        el('div', { class: 'mdsec__head' }, [
          el('span', { class: 'mdsec__lbl', text: slideLabel(i, slides.length) }),
          hint ? el('span', { class: 'mdsec__hint', text: hint }) : null,
          (i > 0 && i < slides.length - 1) ? el('button', {
            class: 'mdsec__copy', type: 'button', title: T('Quitar este slide', 'Remove this slide'),
            'aria-label': `${T('Quitar slide', 'Remove slide')} ${i + 1}`,
            onclick: () => { slides.splice(i, 1); alts.splice(i, 1); renderSlides(); renderAlts(); scheduleSave(); },
          }, [icon('trash', 14)]) : null,
          el('button', {
            class: 'mdsec__copy', type: 'button', title: T('Copiar este slide', 'Copy this slide'),
            'aria-label': `${T('Copiar slide', 'Copy slide')} ${i + 1}`,
            onclick: () => copyPlain(slides[i], T('Slide copiado.', 'Slide copied.'), T('Este slide está vacío.', 'This slide is empty.')),
          }, [icon('copy', 14)]),
          grip, // agarradera al costado derecho
        ]),
        ta,
      ]);
      if (grip) {
        grip.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          const startY = e.clientY;
          let target = null;
          let moved = false;
          document.body.style.userSelect = 'none';
          const onMove = (ev) => {
            const dy = ev.clientY - startY;
            if (!moved && Math.abs(dy) > 4) { moved = true; secEl.classList.add('is-dragging'); }
            if (!moved) return;
            secEl.style.transform = `translateY(${dy}px)`;
            target = null;
            for (const ref of blockRefs) {
              if (ref.el === secEl || !isMiddle(ref.i)) { ref.el.classList.remove('is-dropover'); continue; }
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
            secEl.classList.remove('is-dragging');
            secEl.style.transform = '';
            for (const ref of blockRefs) ref.el.classList.remove('is-dropover');
            if (moved && target !== null && target !== i) moveSlide(i, target);
          };
          document.addEventListener('pointermove', onMove);
          document.addEventListener('pointerup', onUp);
        });
      }
      blockRefs.push({ el: secEl, i });
      slidesHost.appendChild(secEl);
      fit(ta);
    });
    slidesHost.appendChild(el('div', { class: 'mdsec mdsec--add' }, [
      el('button', {
        class: 'btn meses-drawer__addslide', type: 'button',
        onclick: () => {
          slides.splice(slides.length - 1, 0, '');
          alts.splice(alts.length - 1, 0, '');
          renderSlides(); renderAlts(); scheduleSave();
        },
      }, [icon('plus', 15), ' ' + T('Agregar slide', 'Add slide')]),
    ]));
  }

  // SEO ALT por slide (carrusel): al final del panel, uno por slide con copiar.
  const altsHost = isCarrusel ? el('div', { class: 'meses-drawer__alts' }) : null;
  function renderAlts() {
    if (!altsHost) return;
    while (altsHost.firstChild) altsHost.removeChild(altsHost.firstChild);
    alts.forEach((text, i) => {
      const ta = el('textarea', {
        class: 'meses-drawer__ta meses-drawer__ta--sec',
        placeholder: T(`Describe la imagen del slide ${i + 1} (SEO/accesibilidad)`, `Describe the image in slide ${i + 1} (SEO/accessibility)`),
        maxLength: 1000,
        rows: 1,
      });
      ta.value = text || '';
      ta.addEventListener('input', () => { alts[i] = ta.value; fit(ta); scheduleSave(); });
      ta.addEventListener('blur', () => flushSave());
      altsHost.appendChild(el('section', { class: 'mdsec' }, [
        el('div', { class: 'mdsec__head' }, [
          el('span', { class: 'mdsec__lbl', text: `SEO ALT · SLIDE ${i + 1}` }),
          i === 0 ? el('span', { class: 'mdsec__hint', text: T('Texto alternativo (IG)', 'Alt text (IG)') }) : null,
          i > 0 ? el('button', {
            class: 'mdsec__copy', type: 'button', title: T('Borrar este SEO alt', 'Clear this SEO alt'),
            'aria-label': `${T('Borrar SEO alt del slide', 'Clear SEO alt for slide')} ${i + 1}`,
            // Solo se VACÍA el texto (nada de splice): alts debe seguir 1:1
            // con los slides o reordenar/quitar slides corre los alts de lugar.
            onclick: () => { alts[i] = ''; renderAlts(); scheduleSave(); },
          }, [icon('trash', 14)]) : null,
          el('button', {
            class: 'mdsec__copy', type: 'button', title: `${T('Copiar SEO alt del slide', 'Copy SEO alt for slide')} ${i + 1}`,
            'aria-label': `${T('Copiar SEO alt del slide', 'Copy SEO alt for slide')} ${i + 1}`,
            onclick: () => copyPlain(alts[i], T('SEO alt copiado.', 'SEO alt copied.'), T('Este alt está vacío.', 'This alt is empty.')),
          }, [icon('copy', 14)]),
        ]),
        ta,
      ]));
      fit(ta);
    });
    // Sin botón "Agregar SEO alt": los alts nacen y mueren JUNTO con su slide
    // (agregar/quitar/mover slide ya espeja el arreglo). Un push suelto aquí
    // desfasaba alts.length de slides.length y corría los textos de slide.
  }

  const body = el('div', { class: 'meses-drawer__body' }, SECTIONS.map((s) => {
    const ta = el('textarea', {
      class: 'meses-drawer__ta meses-drawer__ta--sec',
      placeholder: s.field === 'caption' ? T('Escribe el caption completo aquí...', 'Write the full caption here...') : T(`Escribe el ${s.label.toLowerCase()} aquí...`, `Write the ${s.label.toLowerCase()} here...`),
      maxLength: 4000,
      rows: 1,
    });
    ta.value = post[s.field] || '';
    ta.addEventListener('input', () => { fit(ta); updateCount(s.field); scheduleSave(); });
    ta.addEventListener('blur', () => flushSave());
    tas[s.field] = ta;
    const withCount = s.field === 'caption' || s.field === 'hashtags';
    if (withCount) counters[s.field] = el('span', { class: 'mdsec__count' });
    return el('section', { class: 'mdsec' }, [
      el('div', { class: 'mdsec__head' }, [
        el('span', { class: 'mdsec__lbl', text: s.label }),
        s.hint ? el('span', { class: 'mdsec__hint', text: s.hint }) : null,
        withCount ? counters[s.field] : null,
        el('button', {
          class: 'mdsec__copy', type: 'button', title: `${T('Copiar', 'Copy')} ${s.label}`,
          'aria-label': `${T('Copiar', 'Copy')} ${s.label}`,
          onclick: () => copyField(s.field, s.label),
        }, [icon('copy', 14)]),
      ]),
      ta,
    ]);
  }));

  if (slidesHost) { renderSlides(); body.insertBefore(slidesHost, body.firstChild); }
  if (altsHost) { renderAlts(); body.appendChild(altsHost); }

  // ── AUTOSAVE: se guarda solo (sin botón "Guardar"). Debounce 800ms al escribir
  //    + al salir del campo + al cerrar. Indicador "Guardando…/Guardado ✓". ──
  const indicatorEl = el('span', { class: 'meses-drawer__save meses-drawer__save--saved', text: T('Guardado ✓', 'Saved ✓') });
  const currentValues = () => {
    const out = {};
    for (const s of SECTIONS) out[s.field] = (tas[s.field].value || '').trim() || null;
    if (isCarrusel && slides) {
      const f = fieldsFromSlides(slides);
      out.hook = f.hook || null; out.body = f.body || null; out.cta = f.cta || null;
      out.alt_text = altsToText(alts) || null;
    }
    return out;
  };
  const savedSnap = currentValues(); // lo ya guardado (base para calcular el delta)
  let saveTimer = null, saving = false, queued = false;
  // ¿Hay texto escrito que todavía NO está en el servidor? Antes, si el guardado
  // fallaba (mala señal, 5xx) el panel se cerraba igual y el texto se perdía sin
  // más aviso que un toast: horas de guion tiradas (auditoría 2026-07-31).
  drawerHasUnsaved = () => {
    if (saveTimer || saving) return true;
    const cur = currentValues();
    return Object.keys(cur).some((k) => cur[k] !== savedSnap[k]);
  };
  drawerRetry = async () => { if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; } await doSave(); return !drawerHasUnsaved(); };
  const paint = (state) => {
    indicatorEl.className = 'meses-drawer__save meses-drawer__save--' + state;
    indicatorEl.textContent = (state === 'saving' || state === 'dirty') ? T('Guardando…', 'Saving…')
      : state === 'error' ? T('⚠ No se guardó', '⚠ Not saved') : T('Guardado ✓', 'Saved ✓');
  };
  async function doSave() {
    if (saving) { queued = true; return; }
    const cur = currentValues(); const patch = {};
    for (const k of Object.keys(cur)) if (cur[k] !== savedSnap[k]) patch[k] = cur[k];
    if (!Object.keys(patch).length) { paint('saved'); return; }
    // Guardrail cero-errores: avisa si el caption trae guion/hashtags dentro
    // (una vez por pieza; NUNCA bloquea el guardado).
    if (Object.prototype.hasOwnProperty.call(patch, 'caption') && ganchos.avisarCaption) ganchos.avisarCaption(post.id, patch.caption);
    saving = true; paint('saving');
    let ok = false;
    try {
      const promesa = ctx.store.patchPost(post.id, patch);
      const saved = await (ganchos.trackMutation ? ganchos.trackMutation(promesa) : promesa);
      ok = !!saved;
      // Flush tardío tras cambiar de marca: no dejar la fila de la marca
      // anterior inyectada en el calendario de la marca nueva.
      if (saved && ganchos.alGuardar) ganchos.alGuardar(saved);
    } catch { ok = false; }
    if (ok) { Object.assign(savedSnap, cur); paint('saved'); } else { paint('error'); }
    saving = false;
    if (queued) { queued = false; doSave(); }
  }
  const scheduleSave = () => {
    paint('dirty');
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { saveTimer = null; doSave(); }, 800);
  };
  const flushSave = () => {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    doSave();
  };
  drawerFlush = flushSave;

  // Cmd/Ctrl+Enter = guardar y cerrar (el cierre hace flush).
  body.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); cerrarGuion(); }
  });

  drawerEl = el('div', { class: 'meses-drawer__wrap', role: 'dialog', 'aria-modal': 'true', 'aria-label': `${T('Guion de', 'Script for')} ${post.title || T('contenido', 'content')}` }, [
    el('div', { class: 'meses-drawer__overlay', onclick: () => cerrarGuion() }),
    el('aside', { class: 'meses-drawer' }, [
      el('header', { class: 'meses-drawer__head' }, [
        el('div', { class: 'meses-drawer__titles' }, [
          el('span', { class: 'meses-drawer__kicker', text: T('Guion', 'Script') }),
          el('h3', { class: 'meses-drawer__title', text: post.title || T('Sin título', 'Untitled') }),
        ]),
        el('button', {
          class: 'meses-drawer__close', type: 'button', 'aria-label': T('Cerrar', 'Close'),
          onclick: () => cerrarGuion(),
        }, [icon('close', 18)]),
      ]),
      body,
      el('div', { class: 'meses-drawer__copyrow' }, [
        el('button', { class: 'btn meses-drawer__copybtn', type: 'button', title: T('Copia solo el caption', 'Copy only the caption'), onclick: copyCaptionOnly }, [icon('copy', 14), T('Copiar caption', 'Copy caption')]),
        el('button', { class: 'btn meses-drawer__copybtn', type: 'button', title: T('Caption + hashtags juntos, listos para pegar en IG', 'Caption + hashtags together, ready to paste into IG'), onclick: copyCaptionAll }, [icon('copy', 14), T('Copiar caption + hashtags', 'Copy caption + hashtags')]),
        el('button', { class: 'btn meses-drawer__copybtn', type: 'button', title: T('HOOK, BODY y CTA etiquetados', 'HOOK, BODY and CTA labeled'), onclick: copyScriptAll }, [icon('copy', 14), T('Copiar guion completo', 'Copy full script')]),
      ]),
      el('footer', { class: 'meses-drawer__foot' }, [
        indicatorEl,
        el('div', { class: 'meses-drawer__actions' }, [
          // Desde la Cuadricula este panel es la UNICA puerta a la pieza: sin
          // esto no habria forma de llegar al estado, la fecha ni la aprobacion.
          ganchos.abrirEditor
            ? el('button', {
              class: 'btn', type: 'button', text: T('Abrir contenido', 'Open content'),
              onclick: async () => { const ir = ganchos.abrirEditor; await cerrarGuion(); ir(); },
            })
            : null,
          el('button', { class: 'btn btn-primary', type: 'button', text: T('Listo', 'Done'), onclick: () => cerrarGuion() }),
        ].filter(Boolean)),
      ]),
    ]),
  ]);

  document.body.appendChild(drawerEl);
  // Boton ATRAS del telefono: este panel es de pantalla completa en movil (no
  // hay "afuera" que tocar), asi que sin capa de history el atras sacaba de la
  // app. Misma capa que usan los sheets del shell (router.pushLayer).
  drawerRelease = pushLayer((info) => cerrarGuion({ ...info, source: 'back' }));
  document.addEventListener('keydown', onDrawerKeydown, true);
  // Reflow forzado en lugar de rAF: rAF se congela en pestanas tapadas y la
  // transicion de entrada nunca corria (el panel quedaba invisible).
  void drawerEl.offsetWidth;
  drawerEl.classList.add('is-open');
  // Ajustar cada caja a su contenido y pintar contadores.
  for (const f of Object.keys(tas)) { fit(tas[f]); updateCount(f); }
  // Los textareas de slides se crearon antes de montar el drawer (scrollHeight
  // era 0): re-ajustarlos ya visibles para que no salgan recortados.
  if (slidesHost) for (const sta of slidesHost.querySelectorAll('textarea')) fit(sta);
  if (altsHost) for (const sta of altsHost.querySelectorAll('textarea')) fit(sta);
  // Abrir desde el COMIENZO: scroll arriba, sin abrir teclado en móvil.
  body.scrollTop = 0;
  drawerEl.querySelector('.meses-drawer__close')?.focus();
}

