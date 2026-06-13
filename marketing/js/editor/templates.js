// ============================================================================
// IVAE Marketing v2 - Plantillas builtin de post (cero red, cero migracion).
//
// Una plantilla por content_type principal (Reel, TikTok, Carrusel, Historia,
// Foto, Pauta): defaults de campos + placeholders de guion HOOK-BODY-CTA +
// checklist sugerida. Las plantillas custom por cliente (mkt_templates) son
// extension v1.5: el esquema ya existe, los hooks de este modulo tambien
// (fetchCustomTemplates degrada a [] si el endpoint no existe).
//
// API:
//   TEMPLATES                       catalogo builtin (orden de TEMPLATE_ORDER)
//   checklistFor(contentType)       pasos sugeridos para el tipo (siempre hay)
//   applyChecklistTemplate(postId, type)  inserta los pasos via services/checklist
//   openNewContentSheet({ctx, onCreated}) selector "Nuevo contenido":
//       Vacio + plantillas con preview de que incluye; crear = POST /posts
//       prefilled + checklist + abrir editor.
// ============================================================================

import { el, api, CONTENT_TYPES, contentTypeLabel } from '../api.js?v=202606130448';
import { icon } from '../shell/icons.js?v=202606130448';
import { openSheet } from '../shell/sheet.js?v=202606130448';
import * as store from '../shell/store.js?v=202606130448';
import * as checklistService from '../services/checklist.js?v=202606130448';

// ── Checklists sugeridas por tipo (todas los 9 tipos tienen una) ─────────────
const DEFAULT_CHECKLISTS = {
  reel: [
    'Guion aprobado',
    'Grabar',
    'Editar',
    'Subtitulos y musica',
    'Portada',
    'Caption y hashtags',
    'Enviar a aprobacion',
    'Programar',
  ],
  tiktok: [
    'Guion aprobado',
    'Grabar',
    'Editar con tendencias',
    'Subtitulos',
    'Caption y hashtags',
    'Enviar a aprobacion',
    'Programar',
  ],
  carrusel: [
    'Definir tema y estructura',
    'Textos por lamina',
    'Diseno de laminas',
    'Revision ortografica',
    'Caption y hashtags',
    'Enviar a aprobacion',
    'Programar',
  ],
  historia: [
    'Definir idea',
    'Grabar o disenar',
    'Stickers e interaccion',
    'Enviar a aprobacion',
    'Publicar',
  ],
  foto: [
    'Seleccionar foto',
    'Retoque y formato',
    'Caption y hashtags',
    'Enviar a aprobacion',
    'Programar',
  ],
  pauta: [
    'Definir objetivo y publico',
    'Creativo listo',
    'Copy del anuncio',
    'Presupuesto aprobado',
    'Configurar campana',
    'Lanzar y monitorear',
  ],
  informativo: [
    'Investigar el tema',
    'Redactar texto',
    'Diseno o grabacion',
    'Caption y hashtags',
    'Enviar a aprobacion',
    'Programar',
  ],
  experiencia: [
    'Conseguir testimonio',
    'Grabar o recopilar material',
    'Editar',
    'Caption y hashtags',
    'Enviar a aprobacion',
    'Programar',
  ],
  tratamientos: [
    'Definir tratamiento a destacar',
    'Material visual',
    'Texto con beneficios',
    'Caption y hashtags',
    'Enviar a aprobacion',
    'Programar',
  ],
};

const GENERIC_CHECKLIST = [
  'Definir idea',
  'Producir contenido',
  'Caption y hashtags',
  'Enviar a aprobacion',
  'Programar',
];

/** Pasos sugeridos para un content_type (siempre devuelve una lista). */
export function checklistFor(contentType) {
  return (DEFAULT_CHECKLISTS[contentType] || GENERIC_CHECKLIST).slice();
}

// ── Catalogo builtin de plantillas de post ───────────────────────────────────
export const TEMPLATE_ORDER = ['reel', 'tiktok', 'carrusel', 'historia', 'foto', 'pauta'];

export const TEMPLATES = {
  reel: {
    key: 'reel',
    label: 'Reel',
    sub: 'Guion HOOK-BODY-CTA + checklist de 8 pasos + Instagram',
    defaults: { content_type: 'reel', platform: 'Instagram' },
    script: {
      hook: 'Las primeras palabras venden: empieza con el beneficio o el dato que detiene el scroll.',
      body: 'Desarrolla la idea en 2 o 3 bloques cortos. Una idea por toma.',
      cta: 'Cierra con una accion clara: agenda, manda mensaje, guarda este reel.',
    },
  },
  tiktok: {
    key: 'tiktok',
    label: 'TikTok',
    sub: 'Guion con gancho rapido + checklist de 7 pasos + TikTok',
    defaults: { content_type: 'tiktok', platform: 'TikTok' },
    script: {
      hook: 'Gancho en el primer segundo: pregunta, dato o situacion inesperada.',
      body: 'Ritmo rapido, cortes cada 2 o 3 segundos, texto en pantalla.',
      cta: 'Invita a comentar o seguir para la parte 2.',
    },
  },
  carrusel: {
    key: 'carrusel',
    label: 'Carrusel',
    sub: 'Estructura por laminas + checklist de 7 pasos + Instagram',
    defaults: { content_type: 'carrusel', platform: 'Instagram' },
    script: {
      hook: 'Lamina 1: titulo que promete algo concreto (la portada decide el swipe).',
      body: 'Laminas 2 a 8: un punto por lamina, texto corto, jerarquia clara.',
      cta: 'Ultima lamina: cierre con accion (guarda, comparte, agenda).',
    },
  },
  historia: {
    key: 'historia',
    label: 'Historia',
    sub: 'Idea + interaccion + checklist de 5 pasos + Instagram',
    defaults: { content_type: 'historia', platform: 'Instagram' },
    script: {
      hook: 'Primer frame: que se entienda en 1 segundo de que va.',
      body: 'Usa sticker de pregunta, encuesta o slider para interaccion.',
      cta: 'Cierra con link o "responde esta historia".',
    },
  },
  foto: {
    key: 'foto',
    label: 'Foto',
    sub: 'Caption lista + checklist de 5 pasos + Instagram',
    defaults: { content_type: 'foto', platform: 'Instagram' },
    script: {
      hook: 'Primera linea del caption: el gancho (es lo unico visible sin tocar "mas").',
      body: 'Contexto o historia detras de la foto en 2 o 3 lineas.',
      cta: 'Pregunta o accion para invitar al comentario.',
    },
  },
  pauta: {
    key: 'pauta',
    label: 'Pauta',
    sub: 'Copy de anuncio + checklist de 6 pasos',
    defaults: { content_type: 'pauta', platform: 'Instagram' },
    script: {
      hook: 'Promesa principal del anuncio en una linea.',
      body: 'Beneficios concretos + prueba social. Publico objetivo definido.',
      cta: 'CTA del boton: Reservar, Enviar mensaje, Mas informacion.',
    },
  },
};

// ── Hook v1.5: plantillas custom por cliente (mkt_templates) ────────────────
/** Degrada a [] si el endpoint aun no existe (v1 funciona solo con builtin). */
export async function fetchCustomTemplates(clientId) {
  if (!clientId || clientId === 'todos') return [];
  try {
    const res = await api.get(`/templates?client_id=${encodeURIComponent(clientId)}`);
    const list = Array.isArray(res) ? res : (res && res.templates) || [];
    return list.filter((t) => t && t.id && t.name);
  } catch {
    return [];
  }
}

// ── Insertar checklist sugerida en un post ───────────────────────────────────
/**
 * Inserta los pasos del tipo via services/checklist (optimista, encadenado en
 * orden). Devuelve cuantos pasos entraron.
 */
export async function applyChecklistTemplate(postId, contentType) {
  if (!postId || !checklistService.isAvailable()) return 0;
  const steps = checklistFor(contentType);
  let added = 0;
  for (const label of steps) {
    const item = await checklistService.add(postId, label);
    if (item) added++;
  }
  return added;
}

// ── Selector "Nuevo contenido" ───────────────────────────────────────────────
/**
 * openNewContentSheet({ctx, status, publishDate, onCreated})
 * Sheet con "Vacio" + las 6 plantillas builtin mostrando que incluye cada una.
 * Elegir crea el post (POST /posts prefilled), inserta la checklist sugerida
 * y abre el editor con el post nuevo. onCreated(post) es opcional.
 */
export function openNewContentSheet({ ctx, status = 'idea', publishDate = null, onCreated } = {}) {
  const { activeClientId, clients } = ctx.store.getState();
  if (!activeClientId || activeClientId === 'todos') {
    ctx.toast('Elige un cliente para crear contenido.', { type: 'info' });
    return;
  }
  const client = (clients || []).find((c) => c.id === activeClientId);

  openSheet({
    title: 'Nuevo contenido',
    mode: 'menu',
    build(body, close) {
      let busy = false;

      async function create(tpl) {
        if (busy) return;
        busy = true;
        const data = {
          client_id: activeClientId,
          title: '',
          status,
          client_visible: 0,
        };
        if (publishDate) data.publish_date = publishDate;
        if (tpl) {
          Object.assign(data, tpl.defaults);
          data.hook = tpl.script.hook;
          data.body = tpl.script.body;
          data.cta = tpl.script.cta;
        }
        const post = await store.createPost(data);
        busy = false;
        if (!post) return; // createPost ya mostro el toast de error
        close({ source: 'created' });
        if (tpl) {
          // La checklist entra en background: el editor la pinta al llegar.
          applyChecklistTemplate(post.id, tpl.defaults.content_type).catch(() => { /* noop */ });
        }
        try { onCreated?.(post); } catch { /* noop */ }
        ctx.openEditor(post.id, { tab: 'contenido' });
      }

      const list = el('div', { class: 'pick-list' });
      list.appendChild(el('button', {
        class: 'pick-row', type: 'button',
        onclick: () => create(null),
      }, [
        el('span', { class: 'pick-row__main' }, [
          el('span', { class: 'pick-row__label', text: 'Vacio' }),
          el('span', { class: 'pick-row__sub', text: 'Sin guion ni checklist, todo desde cero' }),
        ]),
        icon('plus', 18),
      ]));

      for (const key of TEMPLATE_ORDER) {
        const tpl = TEMPLATES[key];
        const color = (CONTENT_TYPES[key] && CONTENT_TYPES[key].color) || 'var(--text-mute)';
        list.appendChild(el('button', {
          class: 'pick-row', type: 'button',
          onclick: () => create(tpl),
        }, [
          el('span', { class: 'pick-row__dot', style: { background: color } }),
          el('span', { class: 'pick-row__main' }, [
            el('span', { class: 'pick-row__label', text: tpl.label }),
            el('span', { class: 'pick-row__sub', text: tpl.sub }),
          ]),
        ]));
      }

      body.appendChild(list);
      if (client && client.name) {
        body.appendChild(el('div', {
          class: 'help ed-tpl-help',
          text: `Se creara para ${client.name}. La fecha se asigna despues.`,
        }));
      }
    },
  });
}

export { contentTypeLabel };
