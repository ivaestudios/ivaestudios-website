// ============================================================================
// IVAE Marketing v2 - Editor de post: motor de autosave parcial.
//
// Mapa dirty por campo + debounce 800ms para textos; los pickers y switches
// guardan al instante ({immediate: true}). El PATCH manda SOLO los campos
// dirty (mata el PATCH full-payload del drawer legacy que pisaba todo).
//
// Maquina de estados del indicador (aria-live la pinta editor.js):
//   'saved'   Guardado
//   'dirty'   hay cambios pendientes (debounce corriendo)
//   'saving'  PATCH en vuelo
//   'error'   fallo el guardado (los dirty SE CONSERVAN: nada se pierde)
//   'offline' sin conexion (se reintenta solo al volver, listener online)
//
// Concurrencia:
//   - Un solo PATCH en vuelo; si llega mas dirt durante el vuelo se encola
//     un flush extra al terminar.
//   - Cada campo lleva un epoch: si el usuario re-tecleo el campo mientras
//     el PATCH volaba, ese campo NO se limpia del mapa (se re-envia).
//   - expected_updated_at viaja siempre que el snapshot lo tenga: el backend
//     v2 responde 409 {post} (onConflict); el backend viejo lo ignora.
//
// flush({keepalive:true}) usa fetch con keepalive (pagehide/visibilitychange
// hidden): la dueña edita, bloquea el telefono y todo queda guardado.
// ============================================================================

import { api } from '../api.js?v=202607092340';

const API_BASE = '/api/marketing';
const DEBOUNCE_MS = 800;

/**
 * createAutosave({getId, getSnapshot, onState, onSaved, onConflict})
 *   getId()        -> id del post (string)
 *   getSnapshot()  -> post tal cual lo devolvio el server (updated_at incluido)
 *   onState(state) -> pinta el indicador
 *   onSaved(serverPost, sentFields) -> reconciliar snapshot + store
 *   onConflict(serverPost|null)     -> banner "Alguien mas edito este post"
 *
 * Devuelve { setField, isDirty, getDirty, getState, flush, retry, clearDirty,
 *            dispose }.
 */
export function createAutosave({ getId, getSnapshot, onState, onSaved, onConflict } = {}) {
  const dirty = new Map();   // field -> value
  const epochs = new Map();  // field -> seq con que entro al mapa
  let seq = 0;
  let timer = 0;
  let inflight = null;       // Promise del PATCH en vuelo
  let queued = false;
  let state = 'saved';
  let disposed = false;

  function setState(next) {
    if (disposed || state === next) return;
    state = next;
    try { onState?.(next); } catch (e) { console.error('[autosave] onState', e); }
  }

  function buildBody(fields) {
    const body = {};
    for (const f of fields) body[f] = dirty.get(f);
    const snap = getSnapshot?.();
    if (snap && snap.updated_at) body.expected_updated_at = snap.updated_at;
    return body;
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(() => { flush(); }, DEBOUNCE_MS);
  }

  /**
   * Marca un campo como dirty. {immediate:true} = pickers y switches
   * (guardado instantaneo); el default es debounce 800ms (textos).
   */
  function setField(field, value, { immediate = false } = {}) {
    if (disposed || !field) return;
    dirty.set(field, value);
    epochs.set(field, ++seq);
    if (navigator.onLine === false) {
      setState('offline');
      return;
    }
    setState('dirty');
    if (immediate) flush();
    else schedule();
  }

  /** PATCH de los dirty actuales. Resuelve true si quedo todo guardado. */
  async function flush({ keepalive = false } = {}) {
    clearTimeout(timer);
    if (disposed) return true;
    if (!dirty.size) { if (state !== 'saved') setState('saved'); return true; }
    const id = getId?.();
    if (!id) return false;

    if (keepalive) {
      // Camino pagehide: fetch keepalive, no bloquea el cierre. Si la pagina
      // SOBREVIVE (bloquear el telefono / cambiar de app), la respuesta SI se
      // procesa como un flush normal: este PATCH sube updated_at en el server,
      // y sin reconciliar snapshot ni limpiar dirty el siguiente flush mandaria
      // un expected_updated_at obsoleto y el propio guardado dispararia un 409
      // falso ("Alguien mas edito este contenido").
      try {
        const fields = [...dirty.keys()];
        const sentEpochs = new Map(fields.map((f) => [f, epochs.get(f)]));
        const body = buildBody(fields);
        fetch(`${API_BASE}/posts/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          credentials: 'same-origin',
          keepalive: true,
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(body),
        }).then(async (r) => {
          if (disposed || !r.ok || getId?.() !== id) return;
          let post = null;
          try {
            const data = await r.json();
            post = (data && data.post) || data;
          } catch { /* server sin payload */ }
          // Limpia SOLO los campos que no se re-teclearon durante el vuelo.
          const sentValues = {};
          for (const f of fields) {
            sentValues[f] = body[f];
            if (epochs.get(f) === sentEpochs.get(f)) { dirty.delete(f); epochs.delete(f); }
          }
          try { onSaved?.(post && post.id ? post : null, fields, sentValues); } catch (e) { console.error('[autosave] onSaved', e); }
          if (!dirty.size) setState('saved');
        }).catch(() => { /* best-effort */ });
      } catch { /* best-effort */ }
      return true;
    }

    if (inflight) {
      // Ya hay un PATCH volando: encola otro pase al terminar.
      queued = true;
      try { await inflight; } catch { /* el dueño del vuelo ya manejo el error */ }
      // El pase encolado lo dispara el finally del vuelo anterior; aqui solo
      // esperamos a que la cadena se asiente para reportar el estado real.
      if (inflight) { try { await inflight; } catch { /* noop */ } }
      return !dirty.size && state !== 'error' && state !== 'offline';
    }

    if (navigator.onLine === false) { setState('offline'); return false; }

    const fields = [...dirty.keys()];
    const sentEpochs = new Map(fields.map((f) => [f, epochs.get(f)]));
    const body = buildBody(fields);
    setState('saving');

    const run = (async () => {
      try {
        const res = await api.patch(`/posts/${encodeURIComponent(id)}`, body);
        const post = (res && res.post) || res;
        // Limpia SOLO los campos que no se re-teclearon durante el vuelo.
        const sentValues = {};
        for (const f of fields) {
          sentValues[f] = body[f];
          if (epochs.get(f) === sentEpochs.get(f)) { dirty.delete(f); epochs.delete(f); }
        }
        try { onSaved?.(post && post.id ? post : null, fields, sentValues); } catch (e) { console.error('[autosave] onSaved', e); }
        if (dirty.size) { setState('dirty'); schedule(); }
        else setState('saved');
        return true;
      } catch (e) {
        if (e && e.status === 409) {
          // Edicion concurrente: el server manda su version en {post}.
          setState('error');
          try { onConflict?.((e.data && e.data.post) || null); } catch (err) { console.error('[autosave] onConflict', err); }
          return false;
        }
        // 'offline' SOLO si el navegador lo confirma: un timeout o un fallo
        // puntual de red (errores sin .status de api.js) con conexion se marca
        // 'error' para que Reintentar quede visible (en 'offline' nada
        // reintenta hasta un evento 'online' que nunca llegaria).
        const offline = navigator.onLine === false;
        setState(offline ? 'offline' : 'error');
        return false;
      } finally {
        inflight = null;
        if (queued) { queued = false; flush(); }
      }
    })();
    inflight = run;
    return run;
  }

  function onOnline() {
    if (disposed) return;
    if (dirty.size) flush();
    else if (state === 'offline') setState('saved');
  }
  function onOffline() {
    if (!disposed && dirty.size) setState('offline');
  }
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);

  return {
    setField,
    flush,
    retry: () => flush(),
    isDirty: () => dirty.size > 0,
    getDirty: () => Object.fromEntries(dirty),
    getState: () => state,
    /** Descarta los cambios pendientes (boton "Descartar cambios"). */
    clearDirty() {
      dirty.clear();
      epochs.clear();
      clearTimeout(timer);
      setState('saved');
    },
    dispose() {
      disposed = true;
      clearTimeout(timer);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    },
  };
}
