// ============================================================================
// IVAE Marketing v2 — Composition root (unico script de app.html).
//
// Importa el shell, registra TODAS las vistas como plugins lazy (import()
// dinamico: el modulo de una vista solo se descarga al navegar a ella) y
// arranca shell.boot().
//
// Cada modulo de vista cumple el contrato:
//   export default { mount(el, ctx), unmount?(), onParams?(params) }
//   (tambien se aceptan exports nombrados mount/unmount/onParams o `view`).
//
// Si un modulo aun no existe (los paquetes de vistas se construyen en
// paralelo), la vista degrada a un empty state con reintento: el shell
// completo sigue funcionando.
// ============================================================================

import * as shell from './shell/shell.js?v=202606200110';
import { el } from './api.js?v=202606200110';
import { icon } from './shell/icons.js?v=202606200110';

function resolveImpl(mod) {
  if (!mod) return null;
  const cand = mod.default || mod.view || mod;
  return (cand && typeof cand.mount === 'function') ? cand : null;
}

/**
 * Registra una vista lazy: el primer mount importa el modulo y delega;
 * unmount/onParams se conectan tras la carga.
 */
function lazyView({ id, label, icon: iconName, loader }) {
  let impl = null;
  let pendingParams = null; // params llegados mientras el modulo descargaba

  const proxy = {
    id, label, icon: iconName,
    async mount(host, ctx) {
      pendingParams = null;
      // Skeleton de carga inmediato (la vista real lo reemplaza). Ademas es el
      // CENTINELA de vida de este mount: `host` es el #view permanente que el
      // router reusa para todas las vistas (host.isConnected siempre es true),
      // pero si el router desmonta esta vista mientras el modulo descarga,
      // unmountActive borra el skeleton junto con el resto de children.
      const skel = el('div', { class: 'view-loading' }, [
        el('span', { class: 'spinner', 'aria-hidden': 'true' }),
        el('span', { class: 'muted', text: `Cargando ${label.toLowerCase()}` }),
      ]);
      host.appendChild(skel);
      let alive = false;
      try {
        const mod = await loader();
        impl = resolveImpl(mod);
        if (!impl) throw new Error('El modulo no expone mount()');
        alive = skel.isConnected;
        skel.remove();
        if (!alive) return; // se navego a otra vista mientras cargaba
        await impl.mount(host, ctx);
        if (pendingParams) {
          // Llegaron params nuevos durante la descarga (p.ej. #/post/A ->
          // #/post/B rapido): se entregan ya montada la vista.
          const p = pendingParams;
          pendingParams = null;
          try { impl.onParams?.(p); } catch (e) { console.error(`[main] onParams ${id}`, e); }
        }
      } catch (err) {
        console.error(`[main] vista ${id}`, err);
        if (skel.isConnected) { alive = true; skel.remove(); }
        if (!alive) return; // el router ya desmonto esta vista: no pintar nada
        host.appendChild(el('div', { class: 'empty view-missing' }, [
          el('div', { class: 'empty__icon' }, [icon('clock', 28)]),
          el('h3', { text: 'Esta vista aún no está lista' }),
          el('p', { text: 'El módulo se está construyendo o no se pudo descargar. Intenta de nuevo en un momento.' }),
          el('button', {
            class: 'btn btn-primary', type: 'button', text: 'Reintentar',
            onclick: () => location.reload(),
          }),
        ]));
      }
    },
    unmount() {
      pendingParams = null;
      try { impl?.unmount?.(); } catch (e) { console.error(`[main] unmount ${id}`, e); }
    },
    onParams(params) {
      if (!impl) { pendingParams = params; return; } // aun descargando: se difiere
      try { impl.onParams?.(params); } catch (e) { console.error(`[main] onParams ${id}`, e); }
    },
  };
  return shell.registerView(proxy);
}

// ── Registro de vistas (ids en espanol = rutas hash) ─────────────────────────
lazyView({ id: 'inicio', label: 'Inicio', icon: 'home', loader: () => import('./views/dashboard.js?v=202606200110') });
// Meses: la pantalla principal por marca (flujo Notion de la duena: secciones
// por mes desplegables + tabla con sus columnas + nueva linea inline).
lazyView({ id: 'meses', label: 'Calendario', icon: 'calendar', loader: () => import('./views/meses.js?v=202606200110') });
lazyView({ id: 'calendario', label: 'Cuadrícula', icon: 'grip', loader: () => import('./calendar/index.js?v=202606200110') });
lazyView({ id: 'tablero', label: 'Tablero', icon: 'board', loader: () => import('./views/kanban.js?v=202606200110') });
lazyView({ id: 'tabla', label: 'Tabla', icon: 'table', loader: () => import('./views/table.js?v=202606200110') });
lazyView({ id: 'timeline', label: 'Timeline', icon: 'gantt', loader: () => import('./views/timeline.js?v=202606200110') });
lazyView({ id: 'carga', label: 'Carga', icon: 'gauge', loader: () => import('./views/workload.js?v=202606200110') });
lazyView({ id: 'mi-trabajo', label: 'Mi trabajo', icon: 'briefcase', loader: () => import('./views/mywork.js?v=202606200110') });
lazyView({ id: 'automatizaciones', label: 'Automatizaciones', icon: 'zap', loader: () => import('./views/automations.js?v=202606200110') });
// Métricas: panel de Instagram por periodo (semana/mes/3-6 meses/año/custom).
lazyView({ id: 'metricas', label: 'Métricas', icon: 'gauge', loader: () => import('./views/metricas.js?v=202606200110') });

// Detalle de post (#/post/:id): el deep-link que usan busqueda y avisos.
lazyView({ id: 'post', label: 'Contenido', icon: 'edit', loader: () => import('./editor/editor.js?v=202606200110') });

// ── Arranque ─────────────────────────────────────────────────────────────────
shell.boot();
