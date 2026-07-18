// ============================================================================
// IVAE Marketing — Idioma (ES por defecto / EN opcional).
//
// El idioma se guarda en localStorage 'mkt_lang' ('en' | ausente=es) y también
// se puede forzar con ?lang=en / ?lang=es en la URL (útil para grabar el App
// Review de Meta y para el enlace directo). El toggle del menú de cuenta llama
// setLang() y recarga. Las vistas envuelven sus textos con T('español','English').
// ============================================================================

export const LANG = (() => {
  try {
    const s = location.search + location.hash;
    if (/[?&]lang=en\b/.test(s)) { localStorage.setItem('mkt_lang', 'en'); return 'en'; }
    if (/[?&]lang=es\b/.test(s)) { localStorage.removeItem('mkt_lang'); return 'es'; }
    return localStorage.getItem('mkt_lang') === 'en' ? 'en' : 'es';
  } catch { return 'es'; }
})();

export const isEN = LANG === 'en';

// T('texto en español', 'text in English') → devuelve el que toca según el idioma.
export function T(es, en) { return (isEN && en != null) ? en : es; }

// Cambia el idioma de TODA la app y recarga para aplicarlo. Si la URL trae
// ?lang=..., lo quita: si no, ese parámetro re-forzaría el idioma al recargar
// y el toggle "no pegaría".
export function setLang(l) {
  try {
    if (l === 'en') localStorage.setItem('mkt_lang', 'en');
    else localStorage.removeItem('mkt_lang');
  } catch { /* sin storage: no persiste */ }
  try {
    const u = new URL(location.href);
    if (u.searchParams.has('lang')) {
      u.searchParams.delete('lang');
      location.replace(u.href); // recarga sin el parámetro
      return;
    }
  } catch { /* URL rara: cae al reload normal */ }
  location.reload();
}
