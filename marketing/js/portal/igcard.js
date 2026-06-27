// ============================================================================
// Portal cliente v2 — Builder PURO de la tarjeta preview Instagram.
//
// igCard(post, client, opts) -> nodo .igcard. Sin estado propio: quien la
// monta decide acciones y reacciona a eventos. 100% textContent para datos de
// usuario (anti-XSS); innerHTML SOLO para los SVG estaticos de ICONS.
//
// El cliente NUNCA ve campos internos: esta tarjeta solo lee la allowlist
// {title, content_type, publish_date, caption, video_url, approval_state}.
// ============================================================================

import { el, fmtDate, initials, CONTENT_TYPES, contentTypeLabel, approvalBadge } from '../api.js?v=202606262017';

// SVG estaticos (unico innerHTML permitido). Stroke = currentColor.
export const ICONS = {
  heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 5.6a5.5 5.5 0 0 0-7.8 0L12 6.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 22l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>',
  comment: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.6 8.6 0 0 1-3.9-.9L3 20l1-4.9a8.4 8.4 0 1 1 17-3.6z"/></svg>',
  send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
  save: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="6 3 20 12 6 21 6 3"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>',
  chevdown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>',
  prev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>',
  next: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="17" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/></svg>',
  logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
  sparkle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/></svg>',
  heartHand: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8.4a3.2 3.2 0 0 1 6 1.5c0 2.6-3.4 4.6-6 6.4-2.6-1.8-6-3.8-6-6.4a3.2 3.2 0 0 1 6-1.5z"/></svg>',
  // Iconos por tipo de contenido (placeholder de la media)
  reel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M3 8.5h18M8 3l3 5.5M14 3l3 5.5"/><polygon points="10.5 12.5 15.5 15.4 10.5 18.3 10.5 12.5"/></svg>',
  video: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="14" height="14" rx="3"/><polygon points="16 10 22 7 22 17 16 14 16 10"/></svg>',
  carousel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="13" height="13" rx="3"/><path d="M8 3h10a3 3 0 0 1 3 3v10"/></svg>',
  photo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5-9 9"/></svg>',
  story: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9" stroke-dasharray="4 3"/><circle cx="12" cy="12" r="4.5"/></svg>',
  doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z"/><polyline points="14 2 14 7 19 7"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/></svg>',
  megaphone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l14-6v14L3 13v-2z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/><path d="M17 8a5 5 0 0 1 0 8"/></svg>',
};

const TYPE_ICON = {
  reel: ICONS.reel,
  tiktok: ICONS.video,
  informativo: ICONS.doc,
  carrusel: ICONS.carousel,
  experiencia: ICONS.heartHand,
  pauta: ICONS.megaphone,
  tratamientos: ICONS.sparkle,
  historia: ICONS.story,
  foto: ICONS.photo,
};

/** Solo http/https sobreviven (datos legacy pueden traer javascript: URLs). */
export function safeUrl(u) {
  if (!u) return null;
  try {
    const url = new URL(String(u), location.origin);
    return (url.protocol === 'http:' || url.protocol === 'https:') ? url.href : null;
  } catch { return null; }
}

function typeColor(contentType) {
  return (CONTENT_TYPES[contentType] && CONTENT_TYPES[contentType].color) || 'var(--brand)';
}

// "vie 12 de jun" corto y amistoso para el header IG.
function friendlyShort(ymdStr) {
  if (!ymdStr) return 'Sin fecha';
  return fmtDate(ymdStr, { weekday: 'short', day: 'numeric', month: 'short' });
}

function clientAvatar(client) {
  const name = (client && client.name) || 'tu marca';
  const wrap = el('span', { class: 'igcard__avatar', 'aria-hidden': 'true' });
  const logoUrl = safeUrl(client && client.logo_url);
  if (logoUrl) {
    wrap.append(el('img', {
      src: logoUrl, alt: '', loading: 'lazy',
      onerror() { this.remove(); wrap.textContent = initials(name); },
    }));
  } else {
    wrap.textContent = initials(name);
  }
  return wrap;
}

/**
 * igCard(post, client, opts) -> HTMLElement
 * opts:
 *   actions: Node[]          botones para la fila de acciones (48px c/u)
 *   onOpenThread: fn(post)   la burbuja se vuelve interactiva
 *   commentCount: number|null
 *   position: {index, total} etiqueta "1 de 7" sobre la media
 *   showState: bool          badge de approval_state visible (franja cambios / detalle)
 *   clampCaption: bool       line-clamp 3 + boton "mas" (default true)
 *   openLabel + onOpen: fn   link discreto "Ver completo"
 */
export function igCard(post, client, opts = {}) {
  const {
    actions = [],
    onOpenThread = null,
    commentCount = null,
    position = null,
    showState = false,
    clampCaption = true,
    onOpen = null,
    openLabel = 'Ver completo',
  } = opts;

  const handle = (client && (client.instagram_handle || client.name)) || 'tu marca';
  const handleTxt = client && client.instagram_handle
    ? '@' + String(client.instagram_handle).replace(/^@/, '')
    : handle;

  const card = el('article', { class: 'igcard', dataset: { id: post.id } });

  // (a) Header IG: avatar + handle + fecha amistosa
  card.append(el('div', { class: 'igcard__head' }, [
    clientAvatar(client),
    el('span', { class: 'igcard__handle', text: handleTxt }),
    el('span', { class: 'igcard__date', text: friendlyShort(post.publish_date) }),
  ]));

  // (b) Media 4/5: placeholder editorial tintado por content_type
  const media = el('div', {
    class: 'igcard__media',
    style: { '--ct': typeColor(post.content_type) },
    'aria-hidden': 'false',
  }, [
    el('span', { class: 'ico', html: TYPE_ICON[post.content_type] || ICONS.sparkle, 'aria-hidden': 'true' }),
    el('span', { class: 'igcard__mtype', text: contentTypeLabel(post.content_type) }),
    el('h3', { class: 'igcard__mtitle', text: post.title || 'Contenido' }),
  ]);
  const videoUrl = safeUrl(post.video_url);
  if (videoUrl) {
    media.append(el('a', {
      class: 'igcard__video', href: videoUrl, target: '_blank', rel: 'noopener noreferrer',
    }, [
      el('span', { class: 'ico', html: ICONS.play, 'aria-hidden': 'true' }),
      el('span', { text: 'Ver video' }),
    ]));
  }
  if (position && position.total > 1) {
    media.append(el('span', {
      class: 'igcard__pos',
      text: `${position.index} de ${position.total}`,
      'aria-label': `Contenido ${position.index} de ${position.total} por revisar`,
    }));
  }
  card.append(media);

  // (c) Fila de iconos IG: decorativa, salvo la burbuja (abre el hilo)
  const icons = el('div', { class: 'igcard__icons' });
  icons.append(el('span', { class: 'ig-ico', html: ICONS.heart, 'aria-hidden': 'true' }));
  if (onOpenThread) {
    const bubble = el('button', {
      class: 'ig-ico', type: 'button',
      'aria-label': 'Ver comentarios',
      dataset: { thread: post.id },
      onclick: () => onOpenThread(post),
    });
    bubble.innerHTML = ICONS.comment;
    if (commentCount != null && commentCount > 0) {
      bubble.append(el('span', { class: 'ig-ico__count', dataset: { count: post.id }, text: String(commentCount) }));
    }
    icons.append(bubble);
  } else {
    icons.append(el('span', { class: 'ig-ico', html: ICONS.comment, 'aria-hidden': 'true' }));
  }
  icons.append(el('span', { class: 'ig-ico', html: ICONS.send, 'aria-hidden': 'true' }));
  icons.append(el('span', { class: 'ig-ico ig-ico--save', html: ICONS.save, 'aria-hidden': 'true' }));
  card.append(icons);

  // (d) Caption real con line-clamp 3 + boton "mas" explicito (sin hover)
  const captionTxt = (post.caption || '').trim();
  if (captionTxt) {
    const txt = el('p', { class: 'igcard__captxt' }, [
      el('span', { class: 'cap-handle', text: handleTxt }),
      captionTxt,
    ]);
    const wrap = el('div', { class: 'igcard__caption' }, [txt]);
    if (clampCaption) {
      const more = el('button', { class: 'igcard__more', type: 'button', text: 'más' });
      more.addEventListener('click', () => {
        const open = txt.classList.toggle('is-open');
        more.textContent = open ? 'menos' : 'más';
      });
      wrap.append(more);
      // Si el caption es corto y no se recorta, el boton sobra. Solo medimos
      // con la tarjeta visible (clientHeight 0 = oculta o aun sin montar).
      requestAnimationFrame(() => {
        if (txt.clientHeight > 0 && txt.scrollHeight <= txt.clientHeight + 2) more.remove();
      });
    } else {
      txt.classList.add('is-open');
    }
    card.append(wrap);
  }

  // Badge de decision (solo cuando el contexto lo pide)
  if (showState) {
    card.append(el('div', { class: 'igcard__state' }, [approvalBadge(post.approval_state)]));
  }

  // (f) Acciones (cada boton llega listo desde la vista)
  if (actions.length) {
    card.append(el('div', { class: 'igcard__actions' }, actions));
  }
  if (onOpen) {
    card.append(el('button', {
      class: 'igcard__open', type: 'button', onclick: () => onOpen(post),
    }, [
      el('span', { text: openLabel }),
      el('span', { class: 'ico', html: ICONS.chevron, 'aria-hidden': 'true' }),
    ]));
  }

  return card;
}
