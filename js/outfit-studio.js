/* ═══════════════════════════════════════════════════════════════
   OUTFIT STUDIO · IVAE Studios
   1) LOOKBOOK: eliges un color de outfit y ves FOTOS REALES de
      clientas de IVAE usándolo en Cancún (datos en js/outfit-looks.js).
   2) PREGÚNTALE A TU ESTILISTA: buscador de dudas de vestuario.
   3) PROBADOR CON IA: sube tu foto y la IA te viste con ese look
      (solo aparece si el backend tiene GEMINI_API_KEY).
   i18n por <html lang>. Sin dependencias.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var lookMount = document.getElementById('osxProbador');
  var preguntasMount = document.getElementById('osxPreguntas');
  if (!lookMount && !preguntasMount) return;

  var ES = (document.documentElement.lang || '').toLowerCase().indexOf('es') === 0 ||
           location.pathname.indexOf('/es/') === 0;
  var WA = 'https://wa.me/529902046514?text=';
  var LOOKS = (window.IVAE_LOOKS || []).slice();

  /* ── Paleta del lookbook ── */
  var COLORS = [
    { id: 'cream',    hex: '#EFE7D3', es: 'Crema',      en: 'Cream' },
    { id: 'white',    hex: '#FAFAF6', es: 'Blanco',     en: 'White' },
    { id: 'sand',     hex: '#CDBD9F', es: 'Arena',      en: 'Sand' },
    { id: 'verde',    hex: '#9DAF8E', es: 'Verde',      en: 'Green' },
    { id: 'rosa',     hex: '#CFA0A0', es: 'Rosa palo',  en: 'Dusty rose' },
    { id: 'softblue', hex: '#9FB6C9', es: 'Azul suave', en: 'Soft blue' },
    { id: 'navy',     hex: '#24344F', es: 'Marino',     en: 'Navy' },
    { id: 'gris',     hex: '#B9BCC2', es: 'Gris',       en: 'Gray' },
    { id: 'black',    hex: '#1D1D22', es: 'Negro',      en: 'Black' }
  ];
  var GRUPOS = [
    { id: 'pareja',     es: 'Pareja',     en: 'Couple' },
    { id: 'boda',       es: 'Boda',       en: 'Wedding' },
    { id: 'familia',    es: 'Familia',    en: 'Family' },
    { id: 'individual', es: 'Individual', en: 'Solo' }
  ];

  function nota(l) { return (!ES && l.ne) ? l.ne : l.n; }

  function colorById(id) { for (var i = 0; i < COLORS.length; i++) if (COLORS[i].id === id) return COLORS[i]; return COLORS[0]; }
  function cName(id) { var c = colorById(id); return ES ? c.es : c.en; }
  function gName(id) { for (var i = 0; i < GRUPOS.length; i++) if (GRUPOS[i].id === id) return ES ? GRUPOS[i].es : GRUPOS[i].en; return ''; }

  /* ── Textos ── */
  var T = ES ? {
    colorLbl: 'Color del outfit', grupoLbl: 'Tipo de sesión', todos: 'Todas',
    verdict: 'Por qué funciona', cta: 'Quiero este look',
    prev: 'Anterior', next: 'Siguiente', reales: 'Fotos reales de sesiones IVAE',
    vacio: 'Aún no tenemos una foto de esa combinación. Te mostramos lo mejor de ese color.',
    waIntro: 'Hola Vianey, vi el lookbook de la guía de vestuario y me encantó este look: ',
    askPlaceholder: 'Escribe tu duda de vestuario',
    askNoMatch: 'Esa pregunta merece respuesta de una estilista real. Escríbenos y Vianey te contesta personalmente.',
    askWa: 'Preguntar por WhatsApp', askPop: 'Preguntas populares',
    tryTitle: 'Ahora pruébatelo con TU foto',
    tryIntro: 'Sube una foto tuya y nuestra IA te viste con el color que elegiste arriba.',
    tryHint: 'Ideal: foto de cuerpo completo, de frente y con buena luz.',
    tryPrenda: 'Prenda', tryUpload: 'Subir mi foto', tryChange: 'Cambiar foto', tryGo: 'Vestirme con IA',
    tryWorking: 'La IA está creando tu look. Tarda entre 20 y 40 segundos, no cierres la página.',
    tryPrivacy: 'Tu foto se usa solo para generar la imagen y no se guarda.',
    tryLimit: 'Hasta 4 pruebas al día.', tryAgain: 'Probar otro look',
    tryDownload: 'Descargar', trySend: 'Enviar a Vianey',
    tryWa: 'Hola Vianey, me probé un look con la IA de su página y me encantó: '
  } : {
    colorLbl: 'Outfit color', grupoLbl: 'Session type', todos: 'All',
    verdict: 'Why it works', cta: 'I want this look',
    prev: 'Previous', next: 'Next', reales: 'Real photos from IVAE sessions',
    vacio: 'We do not have that exact combination yet. Here is the best of that color.',
    waIntro: 'Hi Vianey, I saw the lookbook in your style guide and loved this look: ',
    askPlaceholder: 'Type your outfit question',
    askNoMatch: 'That question deserves a real stylist answer. Message us and Vianey replies personally.',
    askWa: 'Ask on WhatsApp', askPop: 'Popular questions',
    tryTitle: 'Now try it on with YOUR photo',
    tryIntro: 'Upload a photo of yourself and our AI dresses you in the color you picked above.',
    tryHint: 'Best: a full-body, front-facing, well-lit photo.',
    tryPrenda: 'Garment', tryUpload: 'Upload my photo', tryChange: 'Change photo', tryGo: 'Dress me with AI',
    tryWorking: 'The AI is creating your look. It takes 20 to 40 seconds, keep the page open.',
    tryPrivacy: 'Your photo is used only to generate the image and is never stored.',
    tryLimit: 'Up to 4 tries a day.', tryAgain: 'Try another look',
    tryDownload: 'Download', trySend: 'Send to Vianey',
    tryWa: 'Hi Vianey, I tried a look with the AI on your page and loved it: '
  };

  var ICONS = {
    ok: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>',
    meh: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2"><path stroke-linecap="round" d="M12 9v4m0 4h.01"/><circle cx="12" cy="12" r="9.2"/></svg>',
    bad: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4"><path stroke-linecap="round" d="M6 18L18 6M6 6l12 12"/></svg>',
    wa: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.3 14.1c-.2.7-1.3 1.3-1.8 1.3-.5.1-1 .3-3.4-.7-2.9-1.2-4.7-4.1-4.9-4.3-.1-.2-1.1-1.5-1.1-2.9s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5s.8 1.9.8 2c.1.1.1.3 0 .5l-.3.5-.4.4c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.3.1.5.1.6-.1s.7-.8.9-1.1c.2-.3.4-.2.6-.1l2 .9c.2.1.4.2.5.3 0 .1 0 .7-.3 1.2Z"/></svg>'
  };

  /* ── Consejo de estilista por color ── */
  var NOTAS = {
    cream: [['ok', 'El crema es el neutro más favorecedor bajo el sol del Caribe: ilumina la piel sin deslumbrar como el blanco puro.'],
            ['ok', 'Combínalo con arena, verde o marino y tendrás una paleta que jamás falla.']],
    white: [['ok', 'El blanco total es el clásico atemporal de la playa y se ve caro en cámara.'],
            ['meh', 'A mediodía puede deslumbrar: prefiere marfil o crema si tu sesión es con sol alto, o pide golden hour.']],
    sand:  [['ok', 'La arena aterriza el look sin pesar y dialoga con la playa de manera natural.'],
            ['ok', 'Funciona precioso como color ancla cuando son varias personas.']],
    verde: [['ok', 'El verde salvia u olivo se ve fresco y distinto, y en la selva o el jardín se ve editorial.'],
            ['meh', 'Si la locación es puro verde, contrasta con crema o blanco para no camuflarte.']],
    rosa:  [['ok', 'El rosa palo se funde con el cielo del atardecer: el efecto es de ensueño.'],
            ['ok', 'Es el tono más romántico para parejas sin caer en lo dulce.']],
    softblue: [['ok', 'El azul suave conversa con el mar turquesa: frescura caribeña sin esfuerzo.'],
               ['ok', 'Es el favorito para familias porque le queda bien a todas las edades.']],
    navy:  [['ok', 'El marino da profundidad y contraste sin la dureza del negro.'],
            ['ok', 'Con crema o blanco forma una de nuestras combinaciones favoritas.']],
    gris:  [['ok', 'El gris claro es un neutro tranquilo que deja brillar los rostros.'],
            ['meh', 'Evita los grises muy oscuros o fríos: apagan la calidez de la hora dorada.']],
    black: [['bad', 'El negro absorbe la luz de la playa y suele verse plano, sin textura.'],
            ['meh', 'Si lo amas, funciona en el muelle, de noche o en satén con caída: mira las fotos, ahí sí luce.']]
  };
  var NOTAS_EN = {
    cream: [['ok', 'Cream is the most flattering neutral under Caribbean sun: it lights up skin without the glare of pure white.'],
            ['ok', 'Pair it with sand, green or navy and you have a palette that never fails.']],
    white: [['ok', 'All white is the timeless beach classic and reads expensive on camera.'],
            ['meh', 'It can blow out at midday: choose ivory or cream for high sun, or book golden hour.']],
    sand:  [['ok', 'Sand grounds the look without weight and talks to the beach naturally.'],
            ['ok', 'It works beautifully as the anchor color when several people are shooting.']],
    verde: [['ok', 'Sage or olive looks fresh and different, and in the jungle or gardens it reads editorial.'],
            ['meh', 'If the location is all green, contrast with cream or white so you do not blend in.']],
    rosa:  [['ok', 'Dusty rose melts into the sunset sky: the effect is dreamy.'],
            ['ok', 'It is the most romantic tone for couples without turning sweet.']],
    softblue: [['ok', 'Soft blue talks to the turquoise sea: effortless Caribbean freshness.'],
               ['ok', 'A family favorite because it flatters every age.']],
    navy:  [['ok', 'Navy brings depth and contrast without the harshness of black.'],
            ['ok', 'With cream or white it forms one of our favorite pairings.']],
    gris:  [['ok', 'Light gray is a calm neutral that lets faces shine.'],
            ['meh', 'Avoid very dark or cool grays: they mute the warmth of golden hour.']],
    black: [['bad', 'Black absorbs beach light and usually photographs flat, with no texture.'],
            ['meh', 'If you love it, it works on the pier, at night, or in flowing satin: see the photos, there it shines.']]
  };

  /* ── Estado ── */
  var st = { color: 'cream', grupo: null, i: 0 };

  function filtrar() {
    var porColor = LOOKS.filter(function (l) { return l.c.indexOf(st.color) !== -1; });
    if (!st.grupo) return { list: porColor, relajado: false };
    var exacto = porColor.filter(function (l) { return l.g === st.grupo; });
    if (exacto.length) return { list: exacto, relajado: false };
    return { list: porColor, relajado: true };
  }

  function waLook(l) {
    return WA + encodeURIComponent(T.waIntro + cName(st.color) +
      (st.grupo ? ' · ' + gName(st.grupo) : '') + (l ? ' · ' + l.loc : '') + '.');
  }

  function precargar(list, i) {
    [i + 1, i - 1].forEach(function (k) {
      var l = list[(k + list.length) % list.length];
      if (l) { var im = new Image(); im.src = l.src; }
    });
  }

  function renderLookbook() {
    if (!lookMount) return;
    if (!LOOKS.length) { lookMount.innerHTML = ''; return; }
    var r = filtrar(), list = r.list;
    if (st.i >= list.length) st.i = 0;
    var l = list[st.i] || list[0];
    var notas = (ES ? NOTAS : NOTAS_EN)[st.color] || [];

    var h = '<div class="osx-lb">' +
      '<div class="osx-stage" id="osxStage">' +
        '<div class="osx-stage-frame" style="aspect-ratio:' + l.w + '/' + l.h + '">' +
          '<img id="osxPhoto" src="' + l.src + '" alt="' + (ES ? 'Look de sesión IVAE en ' : 'IVAE session look in ') + l.loc + '" ' +
            (st.i === 0 ? 'fetchpriority="high"' : 'loading="lazy"') + ' decoding="async" width="' + l.w + '" height="' + l.h + '"/>' +
          '<div class="osx-stage-veil"></div>' +
          '<span class="osx-stage-label">' + l.loc + '</span>' +
          '<div class="osx-stage-foot">' +
            '<p class="osx-stage-note" id="osxNote">' + nota(l) + '</p>' +
            '<div class="osx-nav">' +
              '<button type="button" class="osx-arrow" data-dir="-1" aria-label="' + T.prev + '">' +
                '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg></button>' +
              '<span class="osx-count" id="osxCount">' + (st.i + 1) + ' / ' + list.length + '</span>' +
              '<button type="button" class="osx-arrow" data-dir="1" aria-label="' + T.next + '">' +
                '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg></button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<p class="osx-panel-t osx-lb-lbl">' + T.colorLbl + ' · <b>' + cName(st.color) + '</b></p>' +
      '<div class="osx-chips" role="group" aria-label="' + T.colorLbl + '">';
    for (var i = 0; i < COLORS.length; i++) {
      var c = COLORS[i];
      var n = LOOKS.filter(function (x) { return x.c.indexOf(c.id) !== -1; }).length;
      if (!n) continue;
      h += '<button type="button" class="osx-chip-c' + (c.id === st.color ? ' sel' : '') + '" data-color="' + c.id + '" aria-pressed="' + (c.id === st.color) + '">' +
        '<span class="sw" style="background:' + c.hex + '"></span>' + (ES ? c.es : c.en) + '</button>';
    }
    h += '</div>' +
      '<div class="osx-tabs" role="group" aria-label="' + T.grupoLbl + '">' +
        '<button type="button" class="osx-tab' + (!st.grupo ? ' sel' : '') + '" data-grupo="" aria-pressed="' + (!st.grupo) + '">' + T.todos + '</button>';
    for (var j = 0; j < GRUPOS.length; j++) {
      var g = GRUPOS[j];
      var m = LOOKS.filter(function (x) { return x.g === g.id; }).length;
      if (!m) continue;
      h += '<button type="button" class="osx-tab' + (st.grupo === g.id ? ' sel' : '') + '" data-grupo="' + g.id + '" aria-pressed="' + (st.grupo === g.id) + '">' + (ES ? g.es : g.en) + '</button>';
    }
    h += '</div>';

    if (r.relajado) h += '<p class="osx-try-note" style="text-align:center">' + T.vacio + '</p>';

    h += '<div class="osx-verdict" aria-live="polite"><div class="osx-verdict-head">' +
      '<span class="osx-verdict-badge ' + (notas[0] ? notas[0][0] : 'ok') + '">' + cName(st.color) + '</span>' +
      '<span class="osx-verdict-title">' + T.verdict + '</span></div>';
    for (var k = 0; k < notas.length; k++)
      h += '<div class="osx-note ' + notas[k][0] + '">' + ICONS[notas[k][0]] + '<span>' + notas[k][1] + '</span></div>';
    h += '<a class="osx-verdict-cta" id="osxLookCta" target="_blank" rel="noopener" href="' + waLook(l) + '">' + ICONS.wa + ' ' + T.cta + '</a></div>' +
      '<p class="osx-lb-cred">' + T.reales + '</p></div>';

    lookMount.innerHTML = h;
    wireLookbook(list);
    precargar(list, st.i);
    var lk = document.getElementById('osxTryLook');
    if (lk) lk.textContent = tryLookText();
  }

  function mostrar(list, dir) {
    st.i = (st.i + dir + list.length) % list.length;
    var l = list[st.i];
    var img = document.getElementById('osxPhoto');
    var frame = img && img.parentElement;
    if (!img) return renderLookbook();
    img.style.opacity = '0';
    setTimeout(function () {
      frame.style.aspectRatio = l.w + '/' + l.h;
      img.src = l.src; img.width = l.w; img.height = l.h;
      img.style.opacity = '1';
      document.getElementById('osxNote').textContent = nota(l);
      document.getElementById('osxCount').textContent = (st.i + 1) + ' / ' + list.length;
      document.querySelector('.osx-stage-label').textContent = l.loc;
      var cta = document.getElementById('osxLookCta');
      if (cta) cta.href = waLook(l);
      precargar(list, st.i);
    }, 180);
  }

  function wireLookbook(list) {
    lookMount.querySelectorAll('.osx-arrow').forEach(function (b) {
      b.addEventListener('click', function () { mostrar(list, parseInt(b.getAttribute('data-dir'), 10)); });
    });
    lookMount.querySelectorAll('[data-color]').forEach(function (b) {
      b.addEventListener('click', function () { st.color = b.getAttribute('data-color'); st.i = 0; renderLookbook(); });
    });
    lookMount.querySelectorAll('[data-grupo]').forEach(function (b) {
      b.addEventListener('click', function () { st.grupo = b.getAttribute('data-grupo') || null; st.i = 0; renderLookbook(); });
    });
    var stage = document.getElementById('osxStage'), x0 = null;
    if (stage) {
      stage.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
      stage.addEventListener('touchend', function (e) {
        if (x0 === null) return;
        var dx = e.changedTouches[0].clientX - x0; x0 = null;
        if (Math.abs(dx) > 45) mostrar(list, dx < 0 ? 1 : -1);
      }, { passive: true });
    }
  }

  /* ═══ PREGUNTAS ═══ */
  var QA = ES ? [
    { c: 'colores', q: '¿Qué colores se ven mejor en la playa?', k: ['color', 'mejor', 'playa', 'paleta', 'combinar'], a: 'Los neutros cálidos son infalibles: crema, arena, salvia, rosa palo, terracota y azul marino. Todos armonizan con el mar turquesa y la luz dorada, y todos combinan entre sí.', pal: ['#EFE7D3', '#CDBD9F', '#A2B899', '#CFA0A0', '#C08054', '#24344F'] },
    { c: 'colores', q: '¿Puedo vestir de negro?', k: ['negro', 'oscuro'], a: 'Mejor no en la playa: el negro absorbe la luz y sale plano, sin textura. Si amas lo oscuro, el azul marino es tu aliado: da la misma elegancia y sí conserva vida en foto.' },
    { c: 'colores', q: '¿El blanco total funciona?', k: ['blanco', 'total', 'white'], a: 'Sí, es un clásico. Dos secretos: al mediodía prefiere crema o marfil (el blanco puro deslumbra al sol) y mezcla texturas (lino, algodón, gasa) para que no se vea uniforme.' },
    { c: 'colores', q: '¿Qué color me favorece según mi tono de piel?', k: ['piel', 'tono', 'morena', 'clara', 'favorece'], a: 'Regla simple: pieles doradas y morenas brillan con blancos, cremas y terracotas (el contraste ilumina). Pieles claras se ven preciosas con salvia, azul suave y rosa palo. En el lookbook de arriba puedes ver cada color en piel real.' },
    { c: 'colores', q: '¿Los estampados están prohibidos?', k: ['estampado', 'flores', 'print', 'rayas'], a: 'Prohibidos no, pero con criterio: florales grandes y suaves en tonos de la paleta sí funcionan. Evita estampados pequeños y apretados (hacen ruido en cámara) y logos o letras grandes.' },
    { c: 'pareja', q: '¿Cómo coordinamos en pareja sin ir iguales?', k: ['pareja', 'coordinar', 'igual', 'novio', 'esposo'], a: 'Elijan un color ancla y un acento: ella crema con él en marino, o ella rosa palo con él en arena. La regla es tonos que dialoguen, no que se repitan. En el lookbook filtra por Pareja y verás decenas de ejemplos reales.' },
    { c: 'hombres', q: '¿Qué se pone él?', k: ['hombre', 'camisa', 'pantalon', 'caballero', 'senor'], a: 'El uniforme ganador: camisa de lino arremangada y con uno o dos botones abiertos (crema, arena, salvia o marino), con pantalón de lino claro. Descalzo en arena o con sandalias de piel. Sin relojes deportivos ni lentes en la cabeza.' },
    { c: 'hombres', q: '¿Camisa fajada o suelta?', k: ['fajada', 'suelta', 'meter', 'faja'], a: 'Suelta y ligeramente arremangada: relajada pero intencional. Fajada solo si el pantalón es de tiro alto y el look es más formal, por ejemplo para una boda.' },
    { c: 'ninos', q: '¿Cómo visto a los niños?', k: ['nino', 'nina', 'hijo', 'bebe', 'kids'], a: 'Comodidad primero: un niño cómodo es un niño que juega, y ahí salen las mejores fotos. Vestidos ligeros de algodón para ellas, camisa o playera lisa de lino para ellos, en los mismos tonos de la familia. Descalzos es perfecto.' },
    { c: 'ninos', q: '¿Y si el bebé no tiene ropa de la paleta?', k: ['bebe', 'ropa', 'paleta'], a: 'Blanco o crema liso siempre gana en bebés y es fácil de encontrar. Un dato: evita ropa con personajes o letras, en foto distraen muchísimo.' },
    { c: 'vestido', q: '¿Vestido largo o corto?', k: ['vestido', 'largo', 'corto', 'maxi'], a: 'El maxivestido fluido es el rey de la playa: el viento lo convierte en movimiento y drama editorial. El corto funciona lindo en sesiones casuales o si te sientes más tú. Si dudas, lleva ambos y lo decidimos juntos en la locación.' },
    { c: 'vestido', q: '¿Qué telas se mueven bonito con el viento?', k: ['tela', 'viento', 'gasa', 'fluida', 'mueve'], a: 'Gasa, chiffon, seda y lino ligero. Son las telas que flotan y dibujan movimiento en cada toma. Evita poliéster grueso, mezclilla y telas rígidas: se ven pesadas y dan calor.' },
    { c: 'clima', q: '¿Qué me pongo si hace viento?', k: ['viento', 'aire', 'ventoso'], a: 'El viento es tu mejor accesorio: telas fluidas y pelo suelto lo aprovechan precioso. Solo evita faldas muy ligeras sin forro y sombreros sueltos. Nosotros elegimos el ángulo para que el viento juegue a favor.' },
    { c: 'clima', q: '¿Y si hace mucho calor?', k: ['calor', 'sudor', 'fresco'], a: 'Lino y algodón respiran; el poliéster no. Trae tu outfit en gancho y cámbiate al llegar; suma agua fría y toallitas secantes. Las sesiones al atardecer también son más frescas que al mediodía.' },
    { c: 'clima', q: '¿Qué pasa si llueve el día de la sesión?', k: ['lluvia', 'llueve', 'clima', 'tormenta'], a: 'Tenemos plan B siempre: movemos la hora al claro del día o buscamos contigo la mejor alternativa. Y un secreto: el cielo después de la lluvia da la luz más dramática y bonita de todas.' },
    { c: 'detalles', q: '¿Qué accesorios sí y cuáles no?', k: ['accesorio', 'joyeria', 'collar', 'arete', 'sombrero'], a: 'Sí: joyería delgada de oro, aretes pequeños, sombrero de ala amplia si va con tu estilo. No: relojes deportivos, bolsas grandes, lentes de sol puestos (se pueden sostener en mano para un gesto casual).' },
    { c: 'detalles', q: '¿Pelo suelto o recogido?', k: ['pelo', 'cabello', 'peinado', 'recogido'], a: 'Suelto con ondas naturales es lo más fotogénico en playa: el viento lo convierte en movimiento. Si lo prefieres recogido, un chongo bajo flojo con mechones sueltos se ve editorial y aguanta la brisa.' },
    { c: 'detalles', q: '¿Cuánto maquillaje me pongo?', k: ['maquillaje', 'makeup', 'labial'], a: 'Natural y luminoso: piel fresca, un poco de rubor y labial en tono nude o rosa. Evita el efecto mate total y los brillos con glitter, la luz dorada ya hace el trabajo de iluminar.' },
    { c: 'detalles', q: '¿Tacones o descalza?', k: ['tacones', 'zapatos', 'descalza', 'sandalias', 'calzado'], a: 'Descalza en la arena, siempre: es natural, cómodo y estiliza igual que un tacón en foto de cuerpo completo. Para hotel o ruinas, sandalias planas de piel o un tacón de bloque bajo si el suelo lo permite.' },
    { c: 'practico', q: '¿Cuántos cambios de outfit llevo?', k: ['cambio', 'outfit', 'cuantos', 'ropa'], a: 'Dos es el número ideal: uno fluido y romántico para golden hour, otro más casual o con color. Llévalos planchados y en gancho, y nosotros coordinamos el momento del cambio.' },
    { c: 'practico', q: '¿Qué llevo a la sesión además de la ropa?', k: ['llevar', 'traer', 'sesion', 'preparar'], a: 'Agua, toallitas secantes, tu outfit en gancho, sandalias fáciles de quitar y el pelo ya listo. Si traen niños: snacks sin chocolate (mancha) y su juguete favorito para los descansos.' },
    { c: 'practico', q: '¿Me maquillo y peino antes o llegando?', k: ['antes', 'llegando', 'lista', 'preparada'], a: 'Llega lista: maquillaje y peinado hechos, outfit puesto o en gancho. Así aprovechamos cada minuto de luz dorada, que es oro puro y dura poco.' },
    { c: 'practico', q: '¿Y si no me siento fotogénica?', k: ['fotogenica', 'pena', 'verguenza', 'posar', 'nervios'], a: 'Nadie llega sabiendo posar y no hace falta: te dirigimos en cada toma con movimientos naturales, caminar, abrazar, reír. En diez minutos se olvida la cámara. Es nuestra especialidad.' },
    { c: 'practico', q: '¿Puedo pedir asesoría personal de vestuario?', k: ['asesoria', 'ayuda', 'personal', 'vianey', 'duda'], a: 'Claro que sí: mándanos foto de tus opciones por WhatsApp y te decimos qué funciona mejor para tu locación y horario. Es parte de prepararte bien.' }
  ] : [
    { c: 'colors', q: 'Which colors look best on the beach?', k: ['color', 'best', 'beach', 'palette', 'match'], a: 'Warm neutrals never fail: cream, sand, sage, dusty rose, terracotta and navy. They all harmonize with turquoise water and golden light, and they all pair with each other.', pal: ['#EFE7D3', '#CDBD9F', '#A2B899', '#CFA0A0', '#C08054', '#24344F'] },
    { c: 'colors', q: 'Can I wear black?', k: ['black', 'dark'], a: 'Better not on the beach: black absorbs light and photographs flat, with no texture. If you love dark tones, navy is your friend: same elegance, and it keeps life in camera.' },
    { c: 'colors', q: 'Does all white work?', k: ['white', 'all'], a: 'Yes, it is a classic. Two secrets: at midday choose cream or ivory (pure white glares in full sun) and mix textures (linen, cotton, chiffon) so it does not read as a uniform.' },
    { c: 'colors', q: 'Which color suits my skin tone?', k: ['skin', 'tone', 'tan', 'fair', 'suits'], a: 'Simple rule: golden and deeper skin glows with whites, creams and terracottas (the contrast lights you up). Fair skin looks beautiful in sage, soft blue and dusty rose. In the lookbook above you can see every color on real skin.' },
    { c: 'colors', q: 'Are prints forbidden?', k: ['print', 'floral', 'pattern', 'stripes'], a: 'Not forbidden, just curated: large soft florals in palette tones work. Avoid small busy patterns (they create visual noise) and big logos or lettering.' },
    { c: 'couples', q: 'How do we coordinate as a couple without matching?', k: ['couple', 'coordinate', 'match', 'partner'], a: 'Pick one anchor color and one accent: her in cream with him in navy, or her in dusty rose with him in sand. The rule is tones that talk to each other, not repeat. Filter the lookbook by Couple for dozens of real examples.' },
    { c: 'men', q: 'What should he wear?', k: ['men', 'shirt', 'pants', 'guy', 'husband'], a: 'The winning uniform: a linen shirt rolled at the sleeves with a button or two open (cream, sand, sage or navy), with light linen pants. Barefoot on sand or leather sandals. No sport watches, no sunglasses on the head.' },
    { c: 'men', q: 'Shirt tucked or untucked?', k: ['tucked', 'untucked', 'loose'], a: 'Untucked and lightly rolled: relaxed but intentional. Tucked only with high-waist trousers for a more formal look, for example a wedding.' },
    { c: 'kids', q: 'How do I dress the kids?', k: ['kids', 'children', 'baby', 'son', 'daughter'], a: 'Comfort first: a comfortable kid is a playing kid, and that is where the best frames live. Light cotton dresses for girls, a plain linen shirt or tee for boys, in the family palette. Barefoot is perfect.' },
    { c: 'kids', q: 'What if the baby has nothing in the palette?', k: ['baby', 'clothes', 'palette'], a: 'Plain white or cream always wins on babies and is easy to find. One tip: skip clothing with characters or lettering, on camera they steal all the attention.' },
    { c: 'dresses', q: 'Long dress or short?', k: ['dress', 'long', 'short', 'maxi'], a: 'The flowing maxi is the queen of the beach: wind turns it into movement and editorial drama. Short works beautifully for casual sessions or if it feels more you. In doubt, bring both and we decide together on location.' },
    { c: 'dresses', q: 'Which fabrics move beautifully in the wind?', k: ['fabric', 'wind', 'chiffon', 'flowy'], a: 'Chiffon, silk, gauze and light linen. They float and draw movement into every frame. Avoid thick polyester, denim and stiff fabrics: they look heavy and feel hot.' },
    { c: 'weather', q: 'What do I wear if it is windy?', k: ['wind', 'windy', 'breeze'], a: 'Wind is your best accessory: flowing fabrics and loose hair use it beautifully. Just avoid unlined ultra-light skirts and loose hats. We choose angles so the wind plays in your favor.' },
    { c: 'weather', q: 'What if it is very hot?', k: ['hot', 'heat', 'sweat'], a: 'Linen and cotton breathe; polyester does not. Bring your outfit on a hanger and change on arrival; add cold water and blotting papers. Sunset sessions also run much cooler than midday.' },
    { c: 'weather', q: 'What happens if it rains on session day?', k: ['rain', 'rains', 'weather', 'storm'], a: 'There is always a plan B: we shift the hour to the clear window or find the best alternative with you. And a secret: post-rain skies give the most dramatic, beautiful light of all.' },
    { c: 'details', q: 'Which accessories yes, and which no?', k: ['accessories', 'jewelry', 'necklace', 'hat', 'earrings'], a: 'Yes: thin gold jewelry, small earrings, a wide-brim hat if it is your style. No: sport watches, big bags, sunglasses on (you can hold them in hand for a casual gesture).' },
    { c: 'details', q: 'Hair up or down?', k: ['hair', 'updo', 'hairstyle'], a: 'Down with natural waves is the most photogenic on the beach: wind becomes movement. If you prefer it up, a loose low bun with face-framing strands reads editorial and survives the breeze.' },
    { c: 'details', q: 'How much makeup should I wear?', k: ['makeup', 'lipstick'], a: 'Natural and luminous: fresh skin, a touch of blush, a nude or rose lip. Skip full matte and glitter shimmer, golden light already does the illuminating for you.' },
    { c: 'details', q: 'Heels or barefoot?', k: ['heels', 'shoes', 'barefoot', 'sandals', 'footwear'], a: 'Barefoot on sand, always: natural, comfortable, and in full-body frames it flatters just like a heel. For resorts or ruins, flat leather sandals or a low block heel where the ground allows.' },
    { c: 'practical', q: 'How many outfit changes should I bring?', k: ['changes', 'outfits', 'how many'], a: 'Two is the sweet spot: one flowing and romantic for golden hour, one more casual or with color. Bring them pressed on hangers and we coordinate the change moment.' },
    { c: 'practical', q: 'What do I bring besides the clothes?', k: ['bring', 'session', 'prepare', 'pack'], a: 'Water, blotting papers, outfits on hangers, easy-off sandals, hair already done. With kids: chocolate-free snacks (stains) and their favorite toy for breaks.' },
    { c: 'practical', q: 'Do I arrive ready or get ready there?', k: ['ready', 'arrive', 'makeup done'], a: 'Arrive ready: hair and makeup done, outfit on or on the hanger. That way every minute of golden light, which is pure gold and short, goes into photos.' },
    { c: 'practical', q: 'What if I am not photogenic?', k: ['photogenic', 'shy', 'pose', 'nervous', 'awkward'], a: 'Nobody arrives knowing how to pose and nobody needs to: we direct every frame with natural movement, walking, embracing, laughing. In ten minutes the camera disappears. It is our specialty.' },
    { c: 'practical', q: 'Can I get personal outfit advice?', k: ['advice', 'help', 'personal', 'vianey', 'question'], a: 'Of course: send us photos of your options on WhatsApp and we will tell you what works best for your location and hour. It is part of preparing you well.' }
  ];

  var CATS = ES
    ? [['colores', 'Colores'], ['pareja', 'Pareja'], ['hombres', 'Hombres'], ['ninos', 'Niños'], ['vestido', 'Vestidos y telas'], ['clima', 'Clima'], ['detalles', 'Pelo y detalles'], ['practico', 'Práctico']]
    : [['colors', 'Colors'], ['couples', 'Couples'], ['men', 'Men'], ['kids', 'Kids'], ['dresses', 'Dresses & fabrics'], ['weather', 'Weather'], ['details', 'Hair & details'], ['practical', 'Practical']];

  function norm(s) {
    return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, ' ');
  }
  function searchQA(input) {
    var toks = norm(input).split(/\s+/).filter(function (t) { return t.length >= 3; });
    if (!toks.length) return [];
    var scored = [];
    for (var i = 0; i < QA.length; i++) {
      var qa = QA[i], score = 0, nq = norm(qa.q);
      for (var t = 0; t < toks.length; t++) {
        var tok = toks[t];
        for (var kk = 0; kk < qa.k.length; kk++) {
          var key = norm(qa.k[kk]).trim();
          if (key.length < 3) continue;
          if (key === tok || (tok.length >= 4 && key.indexOf(tok) !== -1) || (key.length >= 4 && tok.indexOf(key) !== -1)) { score += 2; break; }
        }
        if (nq.indexOf(tok) !== -1) score += 1;
      }
      if (score >= 2) scored.push({ s: score, qa: qa });
    }
    scored.sort(function (a, b) { return b.s - a.s; });
    return scored.slice(0, 3).map(function (x) { return x.qa; });
  }
  function ansCard(qa) {
    var h = '<div class="osx-ans"><h4>' + qa.q + '</h4><p>' + qa.a + '</p>';
    if (qa.pal) {
      h += '<div class="osx-minipal">';
      for (var i = 0; i < qa.pal.length; i++) h += '<i style="background:' + qa.pal[i] + '"></i>';
      h += '</div>';
    }
    return h + '</div>';
  }

  function renderPreguntas() {
    if (!preguntasMount) return;
    var html = '<div class="osx-ask"><div class="osx-askbox">' +
      '<input type="text" id="osxAskInput" placeholder="' + T.askPlaceholder + '" autocomplete="off" enterkeyhint="search" aria-label="' + T.askPlaceholder + '"/>' +
      '<button type="button" class="lens" aria-label="' + (ES ? 'Buscar' : 'Search') + '"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path stroke-linecap="round" d="M21 21l-4.3-4.3"/></svg></button></div>' +
      '<div class="osx-cats" id="osxCats">';
    for (var i = 0; i < CATS.length; i++)
      html += '<button type="button" class="osx-cat" data-cat="' + CATS[i][0] + '">' + CATS[i][1] + '</button>';
    html += '</div><div class="osx-answers" id="osxAnswers"></div></div>';
    preguntasMount.innerHTML = html;

    var input = document.getElementById('osxAskInput');
    var answers = document.getElementById('osxAnswers');
    var activeCat = null;
    function showPopular() {
      var pop = [QA[0], QA[5], QA[6], QA[8]];
      answers.innerHTML = '<p class="osx-panel-t" style="text-align:center">' + T.askPop + '</p>' + pop.map(ansCard).join('');
    }
    function showCat(cat) { answers.innerHTML = QA.filter(function (q) { return q.c === cat; }).map(ansCard).join(''); }
    function showSearch(q) {
      var res = searchQA(q);
      if (res.length) { answers.innerHTML = res.map(ansCard).join(''); return; }
      answers.innerHTML = '<div class="osx-noans"><p>' + T.askNoMatch + '</p>' +
        '<a target="_blank" rel="noopener" href="' + WA + encodeURIComponent((ES ? 'Hola Vianey, tengo una duda de vestuario: ' : 'Hi Vianey, I have an outfit question: ') + q) + '">' +
        ICONS.wa + ' ' + T.askWa + '</a></div>';
    }
    function syncCats() {
      preguntasMount.querySelectorAll('.osx-cat').forEach(function (b) {
        b.classList.toggle('sel', b.getAttribute('data-cat') === activeCat);
        b.setAttribute('aria-pressed', b.getAttribute('data-cat') === activeCat);
      });
    }
    var deb;
    input.addEventListener('input', function () {
      clearTimeout(deb);
      deb = setTimeout(function () {
        var v = input.value.trim();
        activeCat = null; syncCats();
        if (v.length < 3) { showPopular(); return; }
        showSearch(v);
      }, 160);
    });
    preguntasMount.querySelectorAll('.osx-cat').forEach(function (b) {
      b.addEventListener('click', function () {
        var c = b.getAttribute('data-cat');
        activeCat = activeCat === c ? null : c;
        input.value = ''; syncCats();
        if (activeCat) showCat(activeCat); else showPopular();
      });
    });
    showPopular();
  }

  /* ═══ PROBADOR CON IA ═══ */
  var tryFile = null, tryBusy = false, tryPrenda = 'mujerMaxi';
  var PRENDAS = ES
    ? [['mujerMaxi', 'Vestido largo'], ['mujerCorto', 'Vestido corto'], ['hombre', 'Camisa de lino']]
    : [['mujerMaxi', 'Maxi dress'], ['mujerCorto', 'Short dress'], ['hombre', 'Linen shirt']];
  var COLOR_IA = { cream: 'cream', white: 'white', sand: 'sand', verde: 'sage', rosa: 'dustyrose', softblue: 'softblue', navy: 'navy', gris: 'sand', black: 'black' };
  var ESCENA_IA = { 'Playa': 'golden', 'Selva': 'selva', 'Muelle': 'turquesa', 'Atardecer': 'rosa', 'Resort': 'golden', 'Alberca': 'turquesa', 'Interior': 'golden', 'Cancún': 'golden', 'Ciudad': 'golden' };

  function tryLookText() {
    for (var i = 0; i < PRENDAS.length; i++) if (PRENDAS[i][0] === tryPrenda) return PRENDAS[i][1] + ' · ' + cName(st.color).toLowerCase();
    return cName(st.color);
  }
  function resizePhoto(file, cb) {
    var img = new Image(), url = URL.createObjectURL(file);
    img.onload = function () {
      var sf = Math.min(1, 1280 / Math.max(img.width, img.height));
      var c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.width * sf));
      c.height = Math.max(1, Math.round(img.height * sf));
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      if (c.toBlob) c.toBlob(function (b) { cb(b || file); }, 'image/jpeg', 0.86); else cb(file);
    };
    img.onerror = function () { URL.revokeObjectURL(url); cb(file); };
    img.src = url;
  }

  function renderTryon() {
    var mount = document.getElementById('osxTryon');
    if (!mount) return;
    fetch('/api/outfit/status').then(function (r) { return r.json(); }).then(function (stt) {
      if (!stt || !stt.ready) return;
      var h = '<div class="osx-try"><div class="osx-try-head">' +
        '<h3>' + T.tryTitle + '</h3><p>' + T.tryIntro + '</p></div>' +
        '<p class="osx-panel-t">' + T.tryPrenda + ' · <span id="osxTryLook">' + tryLookText() + '</span></p>' +
        '<div class="osx-tabs">';
      for (var i = 0; i < PRENDAS.length; i++)
        h += '<button type="button" class="osx-tab' + (PRENDAS[i][0] === tryPrenda ? ' sel' : '') + '" data-prenda="' + PRENDAS[i][0] + '">' + PRENDAS[i][1] + '</button>';
      h += '</div><div class="osx-try-row">' +
        '<label class="osx-try-upload" id="osxTryUpLbl" tabindex="0">' +
        '<input type="file" id="osxTryFile" accept="image/jpeg,image/png,image/webp" hidden/>' +
        '<span id="osxTryUpTxt">' + T.tryUpload + '</span></label>' +
        '<img id="osxTryThumb" class="osx-try-thumb" alt="" hidden/>' +
        '<button type="button" class="osx-verdict-cta osx-try-go" id="osxTryGo" disabled>' + T.tryGo + '</button></div>' +
        '<p class="osx-try-note">' + T.tryHint + ' ' + T.tryLimit + '</p>' +
        '<p class="osx-try-note" style="opacity:.75">' + T.tryPrivacy + '</p>' +
        '<div class="osx-try-status" id="osxTryStatus" hidden></div>' +
        '<div class="osx-try-result" id="osxTryResult" hidden><img id="osxTryImg" alt=""/>' +
        '<div class="osx-try-actions">' +
        '<a class="osx-verdict-cta" id="osxTryDl" download="mi-look-ivae.jpg">' + T.tryDownload + '</a>' +
        '<a class="osx-verdict-cta" id="osxTryWa" target="_blank" rel="noopener">' + ICONS.wa + ' ' + T.trySend + '</a>' +
        '<button type="button" class="osx-more" id="osxTryAgain">' + T.tryAgain + '</button>' +
        '</div></div></div>';
      mount.innerHTML = h;

      var fileIn = document.getElementById('osxTryFile'), upLbl = document.getElementById('osxTryUpLbl'),
          upTxt = document.getElementById('osxTryUpTxt'), thumb = document.getElementById('osxTryThumb'),
          go = document.getElementById('osxTryGo'), status = document.getElementById('osxTryStatus'),
          result = document.getElementById('osxTryResult');

      mount.querySelectorAll('[data-prenda]').forEach(function (b) {
        b.addEventListener('click', function () { tryPrenda = b.getAttribute('data-prenda'); renderTryon(); });
      });
      upLbl.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileIn.click(); }
      });
      fileIn.addEventListener('change', function () {
        var f = fileIn.files && fileIn.files[0];
        if (!f) return;
        tryFile = f; upTxt.textContent = T.tryChange;
        thumb.src = URL.createObjectURL(f); thumb.hidden = false;
        go.disabled = false; result.hidden = true; status.hidden = true;
      });
      go.addEventListener('click', function () {
        if (!tryFile || tryBusy) return;
        tryBusy = true; go.disabled = true; result.hidden = true;
        status.hidden = false; status.className = 'osx-try-status';
        status.innerHTML = '<span class="osx-spin"></span>' + T.tryWorking;
        var r = filtrar(), l = r.list[st.i] || r.list[0];
        resizePhoto(tryFile, function (blob) {
          var fd = new FormData();
          fd.append('photo', blob, 'foto.jpg');
          fd.append('fig', tryPrenda);
          fd.append('color', COLOR_IA[st.color] || 'cream');
          fd.append('scene', (l && ESCENA_IA[l.loc]) || 'golden');
          fetch('/api/outfit/tryon', { method: 'POST', body: fd })
            .then(function (res) { return res.json(); })
            .then(function (d) {
              tryBusy = false; go.disabled = false;
              if (!d || !d.ok) {
                status.className = 'osx-try-status err';
                status.textContent = (d && d.error) || 'Error. Intenta de nuevo.';
                return;
              }
              status.hidden = true;
              document.getElementById('osxTryImg').src = d.image;
              document.getElementById('osxTryDl').href = d.image;
              document.getElementById('osxTryWa').href = WA + encodeURIComponent(T.tryWa + tryLookText() + '.');
              result.hidden = false;
              result.scrollIntoView({ behavior: 'smooth', block: 'center' });
            })
            .catch(function () {
              tryBusy = false; go.disabled = false;
              status.className = 'osx-try-status err';
              status.textContent = ES ? 'Sin conexión. Intenta de nuevo.' : 'Connection lost. Try again.';
            });
        });
      });
      document.getElementById('osxTryAgain').addEventListener('click', function () {
        result.hidden = true;
        document.getElementById('osxProbador').scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }).catch(function () {});
  }

  function arrancar() { renderLookbook(); renderPreguntas(); renderTryon(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar);
  else arrancar();
})();
