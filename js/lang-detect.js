/* IVAE Studios — Language Detection & Switcher
 * Strategy:
 *   Default language = English (root /).
 *   Spanish mirrors at /es/<slug> with hreflang="es".
 *   On first visit: detect navigator.language; if "es*" and currently on EN, redirect to ES mirror.
 *   User choice (via EN|ES switcher) is persisted in localStorage and wins over browser lang.
 *   Google's crawler does not run JS, so both versions are independently indexable — hreflang
 *   tags in <head> tell Google which version to serve to which locale.
 */
(function () {
  "use strict";

  // EN path → ES path mapping. Keep keys as absolute paths without trailing slash except root.
  var MAP_EN_TO_ES = {
    "/": "/es/",
    "/about": "/es/acerca-de",
    "/blog": "/es/blog",
    "/cancun-photographer": "/es/fotografo-cancun",
    "/riviera-maya-photographer": "/es/fotografo-riviera-maya",
    "/cabo-photographer": "/es/fotografo-los-cabos",
    "/destination-wedding-photographer-mexico": "/es/fotografo-bodas-destino-mexico",
    "/luxury-family-photos-cancun": "/es/fotos-familiares-lujo-cancun",
    "/couples-photography-mexico": "/es/fotografia-parejas-mexico",
    "/social-media-management": "/es/manejo-redes-sociales",
    "/outfit-guide": "/es/guia-vestuario",
    "/blog/destination-wedding-photographer-riviera-maya": "/es/blog/fotografo-boda-destino-riviera-maya",
    "/blog/honeymoon-photographer-riviera-maya": "/es/blog/fotografo-luna-de-miel-riviera-maya",
    "/blog/wedding-photographer-cancun": "/es/blog/fotografo-boda-cancun",
    "/blog/couples-photographer-cancun": "/es/blog/fotografo-parejas-cancun",
    "/blog/engagement-session-cancun-riviera-maya": "/es/blog/sesion-compromiso-cancun-riviera-maya",
    "/blog/maternity-photoshoot-cancun-riviera-maya": "/es/blog/sesion-maternidad-cancun-riviera-maya",
    "/blog/best-photo-locations-riviera-maya": "/es/blog/mejores-locaciones-foto-riviera-maya",
    "/blog/family-vacation-photos-mexico": "/es/blog/fotos-vacaciones-familiares-mexico",
    "/blog/los-cabos-photographer-guide": "/es/blog/guia-fotografo-los-cabos",
    "/blog/how-to-choose-luxury-photographer-mexico": "/es/blog/como-elegir-fotografo-lujo-mexico",
    "/blog/surprise-proposal-photography-cancun": "/es/blog/fotografia-propuesta-sorpresa-cancun",
    "/blog/what-to-wear-beach-photos-mexico": "/es/blog/que-ponerte-fotos-playa-mexico",
    "/blog/best-resorts-cancun-photography": "/es/blog/mejores-resorts-fotografia-cancun",
    "/blog/cancun-vs-riviera-maya-photos": "/es/blog/cancun-vs-riviera-maya-fotos",
    "/blog/destination-elopement-mexico": "/es/blog/fuga-boda-destino-mexico",
    "/blog/golden-hour-photography-mexico": "/es/blog/fotografia-hora-dorada-mexico",
    "/blog/vow-renewal-mexico-photography": "/es/blog/renovacion-votos-mexico-fotografia",
    "/blog/babymoon-photography-cancun": "/es/blog/fotografia-babymoon-cancun",
    "/blog/anniversary-photography-mexico": "/es/blog/fotografia-aniversario-mexico",
    "/blog/all-inclusive-resort-photographer-mexico": "/es/blog/fotografo-resort-todo-incluido-mexico",
    "/blog/tulum-photography-guide": "/es/blog/guia-fotografia-tulum",
    "/blog/bachelorette-photoshoot-los-cabos": "/es/blog/sesion-despedida-soltera-los-cabos",
    "/blog/birthday-photoshoot-cancun": "/es/blog/sesion-cumpleanos-cancun",
    "/blog/cenote-underwater-photoshoot-tulum": "/es/blog/sesion-cenote-submarina-tulum",
    "/blog/quinceanera-photoshoot-cancun": "/es/blog/sesion-quinceanera-cancun",
    "/blog/luxury-yacht-photography-cancun": "/es/blog/fotografia-yate-lujo-cancun",
    "/blog/trash-the-dress-cancun": "/es/blog/trash-the-dress-cancun",
    "/blog/gender-reveal-photoshoot-cancun": "/es/blog/sesion-revelacion-genero-cancun"
  };

  // Build reverse map (ES → EN)
  var MAP_ES_TO_EN = {};
  Object.keys(MAP_EN_TO_ES).forEach(function (en) {
    MAP_ES_TO_EN[MAP_EN_TO_ES[en]] = en;
  });

  var STORAGE_KEY = "ivae_lang";

  function normalizePath(p) {
    // Strip trailing slash except for root variants
    if (!p) return "/";
    if (p === "/" || p === "/es/") return p;
    if (p.length > 1 && p.charAt(p.length - 1) === "/") {
      return p.slice(0, -1);
    }
    return p;
  }

  function isSpanishPath(p) {
    return p === "/es" || p === "/es/" || p.indexOf("/es/") === 0;
  }

  function counterpartPath(currentPath) {
    var p = normalizePath(currentPath);
    if (isSpanishPath(p)) {
      // ES → EN
      return MAP_ES_TO_EN[p] || MAP_ES_TO_EN[p + "/"] || null;
    }
    // EN → ES
    return MAP_EN_TO_ES[p] || MAP_EN_TO_ES[p + "/"] || null;
  }

  function getStoredLang() {
    try {
      return window.localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return null;
    }
  }

  function setStoredLang(lang) {
    try {
      window.localStorage.setItem(STORAGE_KEY, lang);
    } catch (e) {
      /* ignore */
    }
  }

  function detectBrowserLang() {
    var langs = [];
    if (navigator.languages && navigator.languages.length) {
      langs = Array.prototype.slice.call(navigator.languages);
    } else if (navigator.language) {
      langs = [navigator.language];
    }
    for (var i = 0; i < langs.length; i++) {
      var l = (langs[i] || "").toLowerCase();
      if (l.indexOf("es") === 0) return "es";
      if (l.indexOf("en") === 0) return "en";
    }
    return "en";
  }

  function autoRedirectIfNeeded() {
    var path = normalizePath(window.location.pathname);
    var onSpanish = isSpanishPath(path);
    var stored = getStoredLang();

    // User has an explicit preference → honor it
    if (stored === "en" && onSpanish) {
      var enAlt = counterpartPath(path);
      if (enAlt && enAlt !== path) {
        window.location.replace(enAlt + window.location.search + window.location.hash);
        return true;
      }
    }
    if (stored === "es" && !onSpanish) {
      var esAlt = counterpartPath(path);
      if (esAlt && esAlt !== path) {
        window.location.replace(esAlt + window.location.search + window.location.hash);
        return true;
      }
    }

    // No stored preference → infer from browser language
    if (!stored) {
      var browser = detectBrowserLang();
      if (browser === "es" && !onSpanish) {
        var alt = counterpartPath(path);
        if (alt && alt !== path) {
          window.location.replace(alt + window.location.search + window.location.hash);
          return true;
        }
      }
    }
    return false;
  }

  function updateSwitcherActive() {
    var path = normalizePath(window.location.pathname);
    var onSpanish = isSpanishPath(path);
    var buttons = document.querySelectorAll("[data-lang-switch]");
    buttons.forEach(function (btn) {
      var lang = btn.getAttribute("data-lang-switch");
      if ((lang === "es" && onSpanish) || (lang === "en" && !onSpanish)) {
        btn.classList.add("is-active");
        btn.setAttribute("aria-current", "true");
      } else {
        btn.classList.remove("is-active");
        btn.removeAttribute("aria-current");
      }
      // Wire click → persist choice + navigate
      if (!btn._ivaeLangBound) {
        btn._ivaeLangBound = true;
        btn.addEventListener("click", function (e) {
          setStoredLang(lang);
          // If already on desired side, no-op
          var curPath = normalizePath(window.location.pathname);
          var curIsEs = isSpanishPath(curPath);
          if ((lang === "es" && curIsEs) || (lang === "en" && !curIsEs)) {
            return;
          }
          var target = counterpartPath(curPath);
          if (target) {
            e.preventDefault();
            window.location.href = target + window.location.search + window.location.hash;
          } else {
            // Fallback: go to home of target lang
            e.preventDefault();
            window.location.href = lang === "es" ? "/es/" : "/";
          }
        });
      }
    });
  }

  // Run redirect IMMEDIATELY (before DOMContentLoaded) to avoid flash
  var redirected = autoRedirectIfNeeded();

  if (!redirected) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", updateSwitcherActive);
    } else {
      updateSwitcherActive();
    }
  }
})();
