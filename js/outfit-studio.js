/* ═══════════════════════════════════════════════════════════════
   OUTFIT STUDIO · IVAE Studios
   Probador de vestuario interactivo + Pregúntale a tu estilista.
   Se monta en #osxProbador y #osxPreguntas (outfit-guide EN / ES).
   100% cliente, sin APIs. i18n por <html lang>.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var probadorMount = document.getElementById('osxProbador');
  var preguntasMount = document.getElementById('osxPreguntas');
  if (!probadorMount && !preguntasMount) return;

  var ES = (document.documentElement.lang || '').toLowerCase().indexOf('es') === 0 ||
           location.pathname.indexOf('/es/') === 0;
  var WA = 'https://wa.me/529902046514?text=';

  /* ── Escenas ── */
  var SCENES = [
    { id: 'golden',   img: '/images/probador-playa-golden.jpg',   es: 'Playa · Golden hour', en: 'Beach · Golden hour' },
    { id: 'turquesa', img: '/images/probador-playa-turquesa.jpg', es: 'Playa · Mediodía',    en: 'Beach · Midday' },
    { id: 'rosa',     img: '/images/probador-atardecer-rosa.jpg', es: 'Atardecer rosado',    en: 'Pink sunset' },
    { id: 'selva',    img: '/images/probador-selva.jpg',          es: 'Selva tropical',      en: 'Tropical jungle' }
  ];

  /* ── Colores de vestuario ── */
  var COLORS = [
    { id: 'cream',     hex: '#EFE7D3', es: 'Crema',        en: 'Cream' },
    { id: 'white',     hex: '#FAFAF6', es: 'Blanco',       en: 'White' },
    { id: 'sand',      hex: '#CDBD9F', es: 'Arena',        en: 'Sand' },
    { id: 'sage',      hex: '#A2B899', es: 'Salvia',       en: 'Sage' },
    { id: 'dustyrose', hex: '#CFA0A0', es: 'Rosa palo',    en: 'Dusty rose' },
    { id: 'terracotta',hex: '#C08054', es: 'Terracota',    en: 'Terracotta' },
    { id: 'softblue',  hex: '#9FB6C9', es: 'Azul suave',   en: 'Soft blue' },
    { id: 'navy',      hex: '#24344F', es: 'Azul marino',  en: 'Navy' },
    { id: 'black',     hex: '#1D1D22', es: 'Negro',        en: 'Black' },
    { id: 'coral',     hex: '#FF6F61', es: 'Coral brillante', en: 'Bright coral' }
  ];
  var SKINS = ['#F2D6BC', '#DDB08E', '#B5825E', '#7C543A'];
  var HAIR = '#3E3128';

  function colorById(id) { for (var i = 0; i < COLORS.length; i++) if (COLORS[i].id === id) return COLORS[i]; return COLORS[0]; }
  function sceneById(id) { for (var i = 0; i < SCENES.length; i++) if (SCENES[i].id === id) return SCENES[i]; return SCENES[0]; }
  function shade(hex, amt) { /* amt -1..1: negativo oscurece */
    var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    function ch(v) { return Math.max(0, Math.min(255, Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt))); }
    return '#' + (1 << 24 | ch(r) << 16 | ch(g) << 8 | ch(b)).toString(16).slice(1);
  }

  /* ── Figuras (croquis SVG) ── */
  var uid = 0;
  function svgOpen(w) {
    return '<svg viewBox="0 0 200 430" preserveAspectRatio="xMidYMax meet" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"' + (w ? ' class="' + w + '"' : '') + '>';
  }
  function defs(c) {
    uid++;
    var g = 'osxg' + uid;
    return { id: g, html: '<defs><linearGradient id="' + g + '" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="' + shade(c, 0.10) + '"/><stop offset="1" stop-color="' + shade(c, -0.12) + '"/>' +
      '</linearGradient></defs>' };
  }
  var RING = '<ellipse class="osx-ring" cx="100" cy="414" rx="58" ry="9" fill="none" stroke="#c4a35a" stroke-width="2.5"/>';
  var SHADOW = '<ellipse cx="100" cy="413" rx="50" ry="8" fill="rgba(10,15,23,.30)"/>';

  function figMujerMaxi(c, skin) {
    var d = defs(c), c2 = shade(c, -0.24);
    return svgOpen() + d.html + SHADOW + RING +
      '<ellipse cx="100" cy="42" rx="18" ry="21" fill="' + HAIR + '"/>' +
      '<circle cx="117" cy="59" r="8" fill="' + HAIR + '"/>' +
      '<ellipse cx="99" cy="46" rx="13" ry="16" fill="' + skin + '"/>' +
      '<rect x="95" y="58" width="10" height="15" rx="4" fill="' + skin + '"/>' +
      '<path d="M80,80 Q100,68 120,80 L116,95 Q100,86 84,95 Z" fill="' + skin + '"/>' +
      '<path d="M83,84 C73,110 71,142 80,166" stroke="' + skin + '" stroke-width="7.5" fill="none" stroke-linecap="round"/>' +
      '<path d="M117,84 C127,110 129,142 120,166" stroke="' + skin + '" stroke-width="7.5" fill="none" stroke-linecap="round"/>' +
      '<path d="M82,78 C79,104 81,124 88,142 C72,210 52,300 36,392 Q64,406 96,400 Q128,394 156,404 Q174,408 176,392 C162,296 148,206 112,142 C118,118 119,98 118,78 Q100,70 82,78 Z" fill="url(#' + d.id + ')"/>' +
      '<path d="M86,140 Q100,150 114,140 L113,149 Q100,157 87,149 Z" fill="' + c2 + '" opacity=".55"/>' +
      '<path d="M97,152 Q88,270 72,386" stroke="' + c2 + '" stroke-width="2" fill="none" opacity=".45"/>' +
      '<path d="M112,154 Q122,268 140,386" stroke="' + c2 + '" stroke-width="2" fill="none" opacity=".45"/>' +
      '</svg>';
  }
  function figMujerCorto(c, skin) {
    var d = defs(c), c2 = shade(c, -0.24);
    return svgOpen() + d.html + SHADOW + RING +
      '<ellipse cx="100" cy="42" rx="18" ry="21" fill="' + HAIR + '"/>' +
      '<path d="M83,36 Q75,62 81,92 Q86,104 89,88 Q85,64 88,46 Z" fill="' + HAIR + '"/>' +
      '<ellipse cx="100" cy="46" rx="13" ry="16" fill="' + skin + '"/>' +
      '<rect x="95" y="58" width="10" height="15" rx="4" fill="' + skin + '"/>' +
      '<path d="M80,80 Q100,68 120,80 L116,95 Q100,86 84,95 Z" fill="' + skin + '"/>' +
      '<path d="M83,84 C74,110 72,138 80,162" stroke="' + skin + '" stroke-width="7.5" fill="none" stroke-linecap="round"/>' +
      '<path d="M117,84 C126,110 128,138 120,162" stroke="' + skin + '" stroke-width="7.5" fill="none" stroke-linecap="round"/>' +
      '<path d="M82,78 C79,104 81,124 88,142 C80,182 70,222 63,254 Q100,270 137,254 C130,222 120,182 112,142 C118,118 119,98 118,78 Q100,70 82,78 Z" fill="url(#' + d.id + ')"/>' +
      '<path d="M95,150 Q90,205 82,250" stroke="' + c2 + '" stroke-width="2" fill="none" opacity=".45"/>' +
      '<path d="M89,260 C88,306 87,356 89,398" stroke="' + skin + '" stroke-width="7.5" fill="none" stroke-linecap="round"/>' +
      '<path d="M111,260 C112,306 113,356 111,398" stroke="' + skin + '" stroke-width="7.5" fill="none" stroke-linecap="round"/>' +
      '<ellipse cx="88" cy="404" rx="7" ry="3.6" fill="' + skin + '"/>' +
      '<ellipse cx="112" cy="404" rx="7" ry="3.6" fill="' + skin + '"/>' +
      '</svg>';
  }
  function figHombre(c, skin) {
    var d = defs(c), c2 = shade(c, -0.26), pant = '#E9E1CF', pant2 = '#D5CAB0';
    return svgOpen() + d.html + SHADOW + RING +
      '<ellipse cx="100" cy="46" rx="15.5" ry="18" fill="' + skin + '"/>' +
      '<path d="M83,42 Q83,23 100,23 Q117,23 117,42 L115,50 Q100,38 85,50 Z" fill="' + HAIR + '"/>' +
      '<rect x="94" y="61" width="12" height="14" rx="4" fill="' + skin + '"/>' +
      '<path d="M77,84 C72,126 73,172 81,225 L119,225 C127,172 128,126 123,84 Q112,75 100,77 Q88,75 77,84 Z" fill="url(#' + d.id + ')"/>' +
      '<path d="M91,79 L100,96 L109,79" stroke="' + c2 + '" stroke-width="2.2" fill="none"/>' +
      '<line x1="100" y1="96" x2="100" y2="221" stroke="' + c2 + '" stroke-width="1.6" opacity=".5"/>' +
      '<path d="M77,86 C62,112 56,142 58,168 L73,172 C71,146 75,118 83,94 Z" fill="url(#' + d.id + ')"/>' +
      '<path d="M123,86 C138,112 144,142 142,168 L127,172 C129,146 125,118 117,94 Z" fill="url(#' + d.id + ')"/>' +
      '<path d="M67,170 L72,206" stroke="' + skin + '" stroke-width="7" fill="none" stroke-linecap="round"/>' +
      '<path d="M133,170 L128,206" stroke="' + skin + '" stroke-width="7" fill="none" stroke-linecap="round"/>' +
      '<path d="M80,223 L99,223 L96,318 L95,402 L84,402 L85,318 Z" fill="' + pant + '"/>' +
      '<path d="M101,223 L120,223 L116,318 L116,402 L105,402 L104,318 Z" fill="' + pant + '"/>' +
      '<path d="M89,232 L88,394" stroke="' + pant2 + '" stroke-width="1.6" opacity=".7"/>' +
      '<path d="M111,232 L112,394" stroke="' + pant2 + '" stroke-width="1.6" opacity=".7"/>' +
      '<ellipse cx="90" cy="407" rx="8.5" ry="4.2" fill="' + skin + '"/>' +
      '<ellipse cx="110" cy="407" rx="8.5" ry="4.2" fill="' + skin + '"/>' +
      '</svg>';
  }
  function figNina(c, skin) {
    var d = defs(c), c2 = shade(c, -0.24);
    return svgOpen() + d.html + SHADOW + RING +
      '<ellipse cx="100" cy="60" rx="22" ry="24" fill="' + HAIR + '"/>' +
      '<circle cx="76" cy="46" r="9" fill="' + HAIR + '"/>' +
      '<circle cx="124" cy="46" r="9" fill="' + HAIR + '"/>' +
      '<ellipse cx="100" cy="65" rx="16.5" ry="18.5" fill="' + skin + '"/>' +
      '<rect x="95" y="82" width="10" height="12" rx="4" fill="' + skin + '"/>' +
      '<path d="M84,100 Q100,90 116,100 L113,112 Q100,104 87,112 Z" fill="' + skin + '"/>' +
      '<path d="M86,102 C78,124 76,148 82,168" stroke="' + skin + '" stroke-width="7" fill="none" stroke-linecap="round"/>' +
      '<path d="M114,102 C122,124 124,148 118,168" stroke="' + skin + '" stroke-width="7" fill="none" stroke-linecap="round"/>' +
      '<path d="M85,98 C83,120 83,138 88,156 C80,196 72,236 66,268 Q100,283 134,268 C128,236 120,196 112,156 C117,138 117,120 115,98 Q100,90 85,98 Z" fill="url(#' + d.id + ')"/>' +
      '<path d="M94,164 Q90,215 84,262" stroke="' + c2 + '" stroke-width="2" fill="none" opacity=".45"/>' +
      '<path d="M90,280 C89,320 88,362 90,398" stroke="' + skin + '" stroke-width="9" fill="none" stroke-linecap="round"/>' +
      '<path d="M110,280 C111,320 112,362 110,398" stroke="' + skin + '" stroke-width="9" fill="none" stroke-linecap="round"/>' +
      '<ellipse cx="89" cy="404" rx="7.5" ry="3.4" fill="' + skin + '"/>' +
      '<ellipse cx="111" cy="404" rx="7.5" ry="3.4" fill="' + skin + '"/>' +
      '</svg>';
  }
  function figNino(c, skin) {
    var d = defs(c), c2 = shade(c, -0.26), pant = '#DCD2BA';
    return svgOpen() + d.html + SHADOW + RING +
      '<ellipse cx="100" cy="63" rx="17.5" ry="19.5" fill="' + skin + '"/>' +
      '<path d="M81,56 Q81,36 100,36 Q119,36 119,56 L117,63 Q100,50 83,63 Z" fill="' + HAIR + '"/>' +
      '<rect x="94" y="78" width="12" height="12" rx="4" fill="' + skin + '"/>' +
      '<path d="M82,96 C78,124 79,152 84,178 L116,178 C121,152 122,124 118,96 Q100,88 82,96 Z" fill="url(#' + d.id + ')"/>' +
      '<path d="M93,94 L100,106 L107,94" stroke="' + c2 + '" stroke-width="2" fill="none"/>' +
      '<path d="M82,98 C72,110 68,122 70,134 L80,138 C79,126 82,112 88,102 Z" fill="url(#' + d.id + ')"/>' +
      '<path d="M118,98 C128,110 132,122 130,134 L120,138 C121,126 118,112 112,102 Z" fill="url(#' + d.id + ')"/>' +
      '<path d="M74,136 L71,158" stroke="' + skin + '" stroke-width="6.5" fill="none" stroke-linecap="round"/>' +
      '<path d="M126,136 L129,158" stroke="' + skin + '" stroke-width="6.5" fill="none" stroke-linecap="round"/>' +
      '<path d="M85,174 L115,174 L113,254 L103,254 L102,208 L98,208 L97,254 L87,254 Z" fill="' + pant + '"/>' +
      '<path d="M91,256 C90,304 89,356 91,398" stroke="' + skin + '" stroke-width="9" fill="none" stroke-linecap="round"/>' +
      '<path d="M109,256 C110,304 111,356 109,398" stroke="' + skin + '" stroke-width="9" fill="none" stroke-linecap="round"/>' +
      '<ellipse cx="90" cy="404" rx="7.5" ry="3.4" fill="' + skin + '"/>' +
      '<ellipse cx="110" cy="404" rx="7.5" ry="3.4" fill="' + skin + '"/>' +
      '</svg>';
  }

  var FIGS = {
    mujerMaxi:  { fn: figMujerMaxi,  kid: false, es: 'Ella · vestido largo', en: 'Her · maxi dress' },
    mujerCorto: { fn: figMujerCorto, kid: false, es: 'Ella · vestido corto', en: 'Her · short dress' },
    hombre:     { fn: figHombre,     kid: false, es: 'Él · camisa de lino',  en: 'Him · linen shirt' },
    nina:       { fn: figNina,       kid: true,  es: 'Niña',                 en: 'Girl' },
    nino:       { fn: figNino,       kid: true,  es: 'Niño',                 en: 'Boy' }
  };

  /* ── Textos ── */
  var T = ES ? {
    scene: 'Locación', crew: 'Tu grupo', add: 'Agregar persona', outfit: 'Color del outfit de',
    skin: 'Tono de piel', badgeOk: 'Lista para la cámara', badgeMeh: 'Casi perfecto', badgeBad: 'Ajustemos algo',
    verdict: 'Veredicto de tu estilista', cta: 'Enviar mi look a Vianey',
    empty: 'Agrega a las personas de tu sesión para armar su look.',
    waIntro: 'Hola Vianey, armé mi outfit en la guía de vestuario: ',
    waAsk: ' ¿Qué opinas?',
    askPlaceholder: 'Escribe tu duda de vestuario',
    tryTitle: 'Ahora pruébatelo con TU foto',
    tryIntro: 'Sube una foto tuya y nuestra IA te viste con el look que armaste arriba, en la locación que elegiste.',
    tryHint: 'Ideal: foto de cuerpo completo, de frente y con buena luz.',
    tryLookLbl: 'Look elegido',
    tryUpload: 'Subir mi foto',
    tryChange: 'Cambiar foto',
    tryGo: 'Vestirme con IA',
    tryWorking: 'La IA está creando tu look. Tarda entre 20 y 40 segundos, no cierres la página.',
    tryPrivacy: 'Tu foto se usa solo para generar la imagen y no se guarda.',
    tryLimit: 'Hasta 4 pruebas al día.',
    tryAgain: 'Probar otro look',
    tryDownload: 'Descargar',
    trySend: 'Enviar a Vianey',
    tryWa: 'Hola Vianey, me probé un look con la IA de su página y me encantó: ',
    askNoMatch: 'Esa pregunta merece respuesta de una estilista real. Escríbenos y Vianey te contesta personalmente.',
    askWa: 'Preguntar por WhatsApp', askAll: 'Ver todas', askPop: 'Preguntas populares'
  } : {
    scene: 'Location', crew: 'Your group', add: 'Add person', outfit: 'Outfit color for',
    skin: 'Skin tone', badgeOk: 'Camera ready', badgeMeh: 'Almost perfect', badgeBad: 'Let us adjust',
    verdict: 'Your stylist verdict', cta: 'Send my look to Vianey',
    empty: 'Add the people in your session to style their look.',
    waIntro: 'Hi Vianey, I styled my outfits in your style guide: ',
    waAsk: ' What do you think?',
    askPlaceholder: 'Type your outfit question',
    tryTitle: 'Now try it on with YOUR photo',
    tryIntro: 'Upload a photo of yourself and our AI dresses you in the look you styled above, in the location you picked.',
    tryHint: 'Best: a full-body, front-facing, well-lit photo.',
    tryLookLbl: 'Chosen look',
    tryUpload: 'Upload my photo',
    tryChange: 'Change photo',
    tryGo: 'Dress me with AI',
    tryWorking: 'The AI is creating your look. It takes 20 to 40 seconds, keep the page open.',
    tryPrivacy: 'Your photo is used only to generate the image and is never stored.',
    tryLimit: 'Up to 4 tries a day.',
    tryAgain: 'Try another look',
    tryDownload: 'Download',
    trySend: 'Send to Vianey',
    tryWa: 'Hi Vianey, I tried a look with the AI on your page and loved it: ',
    askNoMatch: 'That question deserves a real stylist answer. Message us and Vianey replies personally.',
    askWa: 'Ask on WhatsApp', askAll: 'See all', askPop: 'Popular questions'
  };

  /* ── Estado ── */
  var state = {
    scene: 'golden',
    sel: 0,
    menuOpen: false,
    people: [
      { fig: 'mujerMaxi', color: 'cream', skin: 1 },
      { fig: 'hombre', color: 'navy', skin: 2 }
    ]
  };

  /* ── Veredicto ── */
  function analyze() {
    var notes = [], p = state.people, ids = p.map(function (x) { return x.color; }), sc = state.scene;
    function has(id) { return ids.indexOf(id) !== -1; }
    function name(id) { var c = colorById(id); return ES ? c.es : c.en; }
    function add(level, es, en) { notes.push({ level: level, txt: ES ? es : en }); }

    if (has('black')) add('bad',
      'El negro absorbe la luz de la playa y se ve plano en foto. Cámbialo por azul marino: da la misma elegancia, con más vida.',
      'Black absorbs beach light and looks flat on camera. Swap it for navy: same elegance, with more life.');
    if (has('coral')) add('bad',
      'Los colores brillantes reflejan su tinte en la piel. Prueba terracota: cálido, rico y sin reflejos.',
      'Bright saturated colors cast tints on skin. Try terracotta: warm, rich, no color cast.');
    if (p.length >= 2) {
      var allSame = ids.every(function (i) { return i === ids[0]; });
      if (allSame && (ids[0] === 'cream' || ids[0] === 'white')) add('ok',
        'Todo en tonos claros es un clásico atemporal. Suma texturas distintas (lino, algodón, gasa) para que no se vea uniforme.',
        'All light tones is a timeless classic. Mix textures (linen, cotton, chiffon) so it does not read as a uniform.');
      else if (allSame) add('meh',
        'Coordinen, no se uniformen: elijan un color ancla y varíen los demás con tonos vecinos.',
        'Coordinate, do not match: keep one anchor color and vary the rest with neighbor tones.');
    }
    var PAIRS = [['cream','navy'],['cream','terracotta'],['sage','terracotta'],['dustyrose','sand'],['cream','sage'],['navy','sand'],['softblue','sand'],['cream','dustyrose'],['white','softblue']];
    for (var i = 0; i < PAIRS.length; i++) {
      if (has(PAIRS[i][0]) && has(PAIRS[i][1])) {
        add('ok',
          name(PAIRS[i][0]) + ' con ' + name(PAIRS[i][1]) + ' es una de nuestras combinaciones favoritas: contraste suave que se ve editorial.',
          name(PAIRS[i][0]) + ' with ' + name(PAIRS[i][1]) + ' is one of our favorite pairings: soft contrast that reads editorial.');
        break;
      }
    }
    if (sc === 'golden' && (has('terracotta') || has('dustyrose') || has('cream') || has('sand'))) add('ok',
      'Los tonos cálidos brillan en golden hour: la luz dorada los enciende de manera preciosa.',
      'Warm tones glow at golden hour: the golden light lights them up beautifully.');
    if (sc === 'turquesa' && has('white')) add('meh',
      'El blanco puro deslumbra con sol de mediodía. El crema da la misma frescura sin quemar detalles.',
      'Pure white can blow out under midday sun. Cream gives the same freshness without losing detail.');
    if (sc === 'turquesa' && (has('navy') || has('softblue') || has('sand'))) add('ok',
      'Azules y arenas dialogan con el mar turquesa: frescura caribeña sin esfuerzo.',
      'Blues and sands talk to the turquoise sea: effortless Caribbean freshness.');
    if (sc === 'rosa' && (has('dustyrose') || has('cream'))) add('ok',
      'Rosa palo y crema se funden con el cielo del atardecer: el efecto es de ensueño.',
      'Dusty rose and cream melt into the sunset sky: the effect is dreamy.');
    if (sc === 'selva' && has('sage')) add('meh',
      'El salvia se pierde entre el verde de la selva. Contrástalo con crema o rosa palo para destacar.',
      'Sage blends into the jungle green. Contrast with cream or dusty rose to stand out.');
    if (sc === 'selva' && (has('cream') || has('white') || has('dustyrose'))) add('ok',
      'Los claros brillan contra el verde profundo de la selva: es el contraste que amamos fotografiar ahí.',
      'Light tones pop against deep jungle green: exactly the contrast we love shooting there.');

    if (!notes.length) add('ok',
      'Combinación equilibrada. Telas ligeras (lino, algodón, gasa) y listo: la brisa hace el resto.',
      'Balanced combination. Light fabrics (linen, cotton, chiffon) and you are set: the breeze does the rest.');

    var order = { bad: 0, meh: 1, ok: 2 };
    notes.sort(function (a, b) { return order[a.level] - order[b.level]; });
    notes = notes.slice(0, 4);
    var badge = 'ok';
    for (var j = 0; j < notes.length; j++) { if (notes[j].level === 'bad') { badge = 'bad'; break; } if (notes[j].level === 'meh') badge = 'meh'; }
    return { badge: badge, notes: notes };
  }

  var refocus = null;

  /* ── Render del probador ── */
  var ICONS = {
    ok: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>',
    meh: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2"><path stroke-linecap="round" d="M12 9v4m0 4h.01"/><circle cx="12" cy="12" r="9.2"/></svg>',
    bad: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4"><path stroke-linecap="round" d="M6 18L18 6M6 6l12 12"/></svg>',
    wa: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.3 14.1c-.2.7-1.3 1.3-1.8 1.3-.5.1-1 .3-3.4-.7-2.9-1.2-4.7-4.1-4.9-4.3-.1-.2-1.1-1.5-1.1-2.9s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5s.8 1.9.8 2c.1.1.1.3 0 .5l-.3.5-.4.4c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.3.1.5.1.6-.1s.7-.8.9-1.1c.2-.3.4-.2.6-.1l2 .9c.2.1.4.2.5.3 0 .1 0 .7-.3 1.2Z"/></svg>'
  };

  function stageFigures() {
    var out = '';
    for (var i = 0; i < state.people.length; i++) {
      var per = state.people[i], f = FIGS[per.fig];
      out += '<div class="osx-fig' + (f.kid ? ' osx-kid' : '') + (i === state.sel ? ' sel' : '') + '" data-i="' + i + '" role="button" tabindex="0" aria-label="' + (ES ? f.es : f.en) + '">' +
        f.fn(colorById(per.color).hex, SKINS[per.skin]) + '</div>';
    }
    return out;
  }

  function renderProbador() {
    if (!probadorMount) return;
    var sc = sceneById(state.scene);
    var selPer = state.people[state.sel];
    var html = '<div class="osx-wrap"><div class="osx-grid"><div class="osx-left">' +
      '<div class="osx-stage">' +
      '<img class="osx-stage-bg" src="' + sc.img + '" alt="" loading="lazy" decoding="async"/>' +
      '<div class="osx-stage-veil"></div>' +
      '<span class="osx-stage-label">' + (ES ? sc.es : sc.en) + '</span>' +
      (state.people.length ? '<div class="osx-people">' + stageFigures() + '</div>'
        : '<div class="osx-stage-empty">' + T.empty + '</div>') +
      '</div></div><div class="osx-right">' +
      '<div class="osx-scenes" role="group" aria-label="' + T.scene + '">';
    for (var i = 0; i < SCENES.length; i++) {
      var s = SCENES[i];
      html += '<button type="button" class="osx-scene' + (s.id === state.scene ? ' sel' : '') + '" data-scene="' + s.id + '" aria-pressed="' + (s.id === state.scene) + '">' +
        '<img src="' + s.img.replace('.jpg', '-thumb.jpg') + '" alt="" decoding="async"/><span>' + (ES ? s.es : s.en) + '</span></button>';
    }
    html += '</div>';

    /* grupo */
    html += '<div class="osx-panel"><p class="osx-panel-t">' + T.crew + '</p><div class="osx-crew">';
    for (var j = 0; j < state.people.length; j++) {
      var per = state.people[j], f2 = FIGS[per.fig];
      html += '<span class="osx-chip' + (j === state.sel ? ' sel' : '') + '" data-i="' + j + '" role="button" tabindex="0" aria-pressed="' + (j === state.sel) + '">' +
        '<span class="dot" style="background:' + colorById(per.color).hex + '"></span>' + (ES ? f2.es : f2.en) +
        '<span class="x" data-del="' + j + '" role="button" tabindex="0" aria-label="' + (ES ? 'Quitar ' : 'Remove ') + (ES ? f2.es : f2.en) + '">&times;</span></span>';
    }
    if (state.people.length < 5)
      html += '<button type="button" class="osx-add" id="osxAdd" aria-expanded="' + state.menuOpen + '" aria-controls="osxAddMenu">+ ' + T.add + '</button>';
    html += '</div><div class="osx-addmenu' + (state.menuOpen ? ' open' : '') + '" id="osxAddMenu">';
    for (var k in FIGS) html += '<button type="button" data-add="' + k + '">' + (ES ? FIGS[k].es : FIGS[k].en) + '</button>';
    html += '</div></div>';

    /* colores + piel */
    if (selPer) {
      var fName = ES ? FIGS[selPer.fig].es : FIGS[selPer.fig].en;
      html += '<div class="osx-panel"><p class="osx-panel-t">' + T.outfit + ' <b>' + fName + '</b> &middot; ' + (ES ? colorById(selPer.color).es : colorById(selPer.color).en) + '</p>' +
        '<div class="osx-panelrow"><div class="osx-swcol"><div class="osx-swatches">';
      for (var m = 0; m < COLORS.length; m++) {
        var c = COLORS[m];
        html += '<button type="button" class="osx-sw' + (c.id === selPer.color ? ' sel' : '') + '" data-color="' + c.id + '" aria-pressed="' + (c.id === selPer.color) + '" style="background:' + c.hex + '" aria-label="' + (ES ? c.es : c.en) + '" title="' + (ES ? c.es : c.en) + '"></button>';
      }
      html += '</div><p class="osx-panel-t" style="margin-top:16px">' + T.skin + '</p><div class="osx-swatches osx-skins">';
      for (var n = 0; n < SKINS.length; n++)
        html += '<button type="button" class="osx-sw' + (n === selPer.skin ? ' sel' : '') + '" data-skin="' + n + '" aria-pressed="' + (n === selPer.skin) + '" style="background:' + SKINS[n] + '" aria-label="' + T.skin + ' ' + (n + 1) + '"></button>';
      html += '</div></div>' +
        '<div class="osx-minifig" aria-hidden="true" style="background-image:url(' + sc.img.replace('.jpg', '-thumb.jpg') + ')">' +
        FIGS[selPer.fig].fn(colorById(selPer.color).hex, SKINS[selPer.skin]) + '</div></div>';
      html += '</div>';
    }

    /* veredicto */
    if (state.people.length) {
      var v = analyze();
      var badgeTxt = v.badge === 'ok' ? T.badgeOk : v.badge === 'meh' ? T.badgeMeh : T.badgeBad;
      html += '<div class="osx-verdict" aria-live="polite"><div class="osx-verdict-head">' +
        '<span class="osx-verdict-badge ' + v.badge + '">' + badgeTxt + '</span>' +
        '<span class="osx-verdict-title">' + T.verdict + '</span></div>';
      for (var q = 0; q < v.notes.length; q++)
        html += '<div class="osx-note ' + v.notes[q].level + '">' + ICONS[v.notes[q].level] + '<span>' + v.notes[q].txt + '</span></div>';
      html += '<a class="osx-verdict-cta" target="_blank" rel="noopener" href="' + waLink() + '">' + ICONS.wa + ' ' + T.cta + '</a></div>';
    } else {
      html += '<div class="osx-verdict" aria-live="polite"><div class="osx-verdict-head">' +
        '<span class="osx-verdict-title">' + T.verdict + '</span></div>' +
        '<div class="osx-note meh">' + ICONS.meh + '<span>' + T.empty + '</span></div></div>';
    }

    html += '</div></div></div>';
    probadorMount.innerHTML = html;
    wireProbador();
    var lk = document.getElementById('osxTryLook');
    if (lk) lk.textContent = tryLookText();
    if (refocus) {
      var rf = probadorMount.querySelector(refocus);
      if (rf) rf.focus();
      refocus = null;
    }
  }

  function waLink() {
    var sc = sceneById(state.scene);
    var parts = state.people.map(function (p) {
      return (ES ? FIGS[p.fig].es : FIGS[p.fig].en) + ': ' + (ES ? colorById(p.color).es : colorById(p.color).en).toLowerCase();
    });
    return WA + encodeURIComponent(T.waIntro + (ES ? sc.es : sc.en) + ' · ' + parts.join(' · ') + '.' + T.waAsk);
  }

  function wireProbador() {
    probadorMount.querySelectorAll('.osx-scene').forEach(function (b) {
      b.addEventListener('click', function () { state.scene = b.getAttribute('data-scene'); refocus = '[data-scene="' + state.scene + '"]'; renderProbador(); });
    });
    probadorMount.querySelectorAll('.osx-fig,[data-i].osx-chip').forEach(function (el) {
      el.addEventListener('click', function (e) {
        if (e.target.hasAttribute && e.target.hasAttribute('data-del')) return;
        state.sel = parseInt(el.getAttribute('data-i'), 10); renderProbador();
      });
    });
    probadorMount.querySelectorAll('[data-del]').forEach(function (x) {
      x.addEventListener('click', function (e) {
        e.stopPropagation();
        state.people.splice(parseInt(x.getAttribute('data-del'), 10), 1);
        if (state.sel >= state.people.length) state.sel = Math.max(0, state.people.length - 1);
        renderProbador();
      });
    });
    var add = document.getElementById('osxAdd');
    if (add) add.addEventListener('click', function () { state.menuOpen = !state.menuOpen; refocus = '#osxAdd'; renderProbador(); });
    probadorMount.querySelectorAll('[data-add]').forEach(function (b) {
      b.addEventListener('click', function () {
        state.people.push({ fig: b.getAttribute('data-add'), color: 'cream', skin: 1 });
        state.sel = state.people.length - 1; refocus = '[data-add="' + b.getAttribute('data-add') + '"]'; renderProbador();
      });
    });
    probadorMount.querySelectorAll('[data-color]').forEach(function (b) {
      b.addEventListener('click', function () { var c = b.getAttribute('data-color'); state.people[state.sel].color = c; refocus = '[data-color="' + c + '"]'; renderProbador(); });
    });
    probadorMount.querySelectorAll('[data-skin]').forEach(function (b) {
      b.addEventListener('click', function () { var k = b.getAttribute('data-skin'); state.people[state.sel].skin = parseInt(k, 10); refocus = '[data-skin="' + k + '"]'; renderProbador(); });
    });
  }

  /* ═══ PREGUNTAS ═══ */
  var QA = ES ? [
    { c: 'colores', q: '¿Qué colores se ven mejor en la playa?', k: ['color', 'mejor', 'playa', 'paleta', 'combinar'], a: 'Los neutros cálidos son infalibles: crema, arena, salvia, rosa palo, terracota y azul marino. Todos armonizan con el mar turquesa y la luz dorada, y todos combinan entre sí.', pal: ['#EFE7D3', '#CDBD9F', '#A2B899', '#CFA0A0', '#C08054', '#24344F'] },
    { c: 'colores', q: '¿Puedo vestir de negro?', k: ['negro', 'oscuro'], a: 'Mejor no en la playa: el negro absorbe la luz y sale plano, sin textura. Si amas lo oscuro, el azul marino es tu aliado: da la misma elegancia y sí conserva vida en foto.' },
    { c: 'colores', q: '¿El blanco total funciona?', k: ['blanco', 'total', 'white'], a: 'Sí, es un clásico. Dos secretos: al mediodía prefiere crema o marfil (el blanco puro deslumbra al sol) y mezcla texturas (lino, algodón, gasa) para que no se vea uniforme.' },
    { c: 'colores', q: '¿Qué color me favorece según mi tono de piel?', k: ['piel', 'tono', 'morena', 'clara', 'favorece'], a: 'Regla simple: pieles doradas y morenas brillan con blancos, cremas y terracotas (el contraste ilumina). Pieles claras se ven preciosas con salvia, azul suave y rosa palo. En el probador de arriba puedes verlo con tu tono.' },
    { c: 'colores', q: '¿Los estampados están prohibidos?', k: ['estampado', 'flores', 'print', 'rayas'], a: 'Prohibidos no, pero con criterio: florales grandes y suaves en tonos de la paleta sí funcionan. Evita estampados pequeños y apretados (hacen ruido en cámara) y logos o letras grandes.' },
    { c: 'pareja', q: '¿Cómo coordinamos en pareja sin ir iguales?', k: ['pareja', 'coordinar', 'igual', 'novio', 'esposo'], a: 'Elijan un color ancla y un acento: ella crema con él en marino, o ella rosa palo con él en arena. La regla es tonos que dialoguen, no que se repitan. Prueben su combinación en el probador de arriba.' },
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
    { c: 'colors', q: 'Which color suits my skin tone?', k: ['skin', 'tone', 'tan', 'fair', 'suits'], a: 'Simple rule: golden and deeper skin glows with whites, creams and terracottas (the contrast lights you up). Fair skin looks beautiful in sage, soft blue and dusty rose. Try it with your tone in the styler above.' },
    { c: 'colors', q: 'Are prints forbidden?', k: ['print', 'floral', 'pattern', 'stripes'], a: 'Not forbidden, just curated: large soft florals in palette tones work. Avoid small busy patterns (they create visual noise) and big logos or lettering.' },
    { c: 'couples', q: 'How do we coordinate as a couple without matching?', k: ['couple', 'coordinate', 'match', 'partner'], a: 'Pick one anchor color and one accent: her in cream with him in navy, or her in dusty rose with him in sand. The rule is tones that talk to each other, not repeat. Test your combo in the styler above.' },
    { c: 'men', q: 'What should he wear?', k: ['men', 'shirt', 'pants', 'guy', 'husband'], a: 'The winning uniform: a linen shirt (cream, sand, sage or navy) with light linen pants, sleeves rolled, a button or two open. Barefoot on sand or leather sandals. No sport watches, no sunglasses on the head.' },
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
    function showCat(cat) {
      var list = QA.filter(function (q) { return q.c === cat; });
      answers.innerHTML = list.map(ansCard).join('');
    }
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

  /* ═══ PROBADOR CON IA (se enciende solo si el backend tiene llave) ═══ */
  var tryFile = null, tryBusy = false;

  function tryLookText() {
    var per = state.people[state.sel];
    var sc = sceneById(state.scene);
    if (!per) return ES ? sc.es : sc.en;
    return (ES ? FIGS[per.fig].es : FIGS[per.fig].en) + ' · ' +
      (ES ? colorById(per.color).es : colorById(per.color).en).toLowerCase() + ' · ' +
      (ES ? sc.es : sc.en);
  }

  function resizePhoto(file, cb) {
    var img = new Image();
    var url = URL.createObjectURL(file);
    img.onload = function () {
      var sf = Math.min(1, 1280 / Math.max(img.width, img.height));
      var c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.width * sf));
      c.height = Math.max(1, Math.round(img.height * sf));
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      if (c.toBlob) c.toBlob(function (b) { cb(b || file); }, 'image/jpeg', 0.86);
      else cb(file);
    };
    img.onerror = function () { URL.revokeObjectURL(url); cb(file); };
    img.src = url;
  }

  function renderTryon() {
    var mount = document.getElementById('osxTryon');
    if (!mount || !probadorMount) return;
    fetch('/api/outfit/status').then(function (r) { return r.json(); }).then(function (st) {
      if (!st || !st.ready) return;
      mount.innerHTML =
        '<div class="osx-try"><div class="osx-try-head">' +
        '<h3>' + T.tryTitle + '</h3><p>' + T.tryIntro + '</p></div>' +
        '<p class="osx-panel-t">' + T.tryLookLbl + ' · <span id="osxTryLook">' + tryLookText() + '</span></p>' +
        '<div class="osx-try-row">' +
        '<label class="osx-try-upload" id="osxTryUpLbl" tabindex="0">' +
        '<input type="file" id="osxTryFile" accept="image/jpeg,image/png,image/webp" hidden/>' +
        '<span id="osxTryUpTxt">' + T.tryUpload + '</span></label>' +
        '<img id="osxTryThumb" class="osx-try-thumb" alt="" hidden/>' +
        '<button type="button" class="osx-verdict-cta osx-try-go" id="osxTryGo" disabled>' + T.tryGo + '</button>' +
        '</div>' +
        '<p class="osx-try-note">' + T.tryHint + ' ' + T.tryLimit + '</p>' +
        '<p class="osx-try-note" style="opacity:.75">' + T.tryPrivacy + '</p>' +
        '<div class="osx-try-status" id="osxTryStatus" hidden></div>' +
        '<div class="osx-try-result" id="osxTryResult" hidden>' +
        '<img id="osxTryImg" alt=""/>' +
        '<div class="osx-try-actions">' +
        '<a class="osx-verdict-cta" id="osxTryDl" download="mi-look-ivae.jpg">' + T.tryDownload + '</a>' +
        '<a class="osx-verdict-cta" id="osxTryWa" target="_blank" rel="noopener">' + ICONS.wa + ' ' + T.trySend + '</a>' +
        '<button type="button" class="osx-more" id="osxTryAgain">' + T.tryAgain + '</button>' +
        '</div></div></div>';

      var fileIn = document.getElementById('osxTryFile');
      var upLbl = document.getElementById('osxTryUpLbl');
      var upTxt = document.getElementById('osxTryUpTxt');
      var thumb = document.getElementById('osxTryThumb');
      var go = document.getElementById('osxTryGo');
      var status = document.getElementById('osxTryStatus');
      var result = document.getElementById('osxTryResult');

      upLbl.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileIn.click(); }
      });
      fileIn.addEventListener('change', function () {
        var f = fileIn.files && fileIn.files[0];
        if (!f) return;
        tryFile = f;
        upTxt.textContent = T.tryChange;
        thumb.src = URL.createObjectURL(f);
        thumb.hidden = false;
        go.disabled = false;
        result.hidden = true;
        status.hidden = true;
      });
      go.addEventListener('click', function () {
        if (!tryFile || tryBusy) return;
        tryBusy = true;
        go.disabled = true;
        result.hidden = true;
        status.hidden = false;
        status.className = 'osx-try-status';
        status.innerHTML = '<span class="osx-spin"></span>' + T.tryWorking;
        var per = state.people[state.sel] || { fig: 'mujerMaxi', color: 'cream' };
        resizePhoto(tryFile, function (blob) {
          var fd = new FormData();
          fd.append('photo', blob, 'foto.jpg');
          fd.append('fig', per.fig);
          fd.append('color', per.color);
          fd.append('scene', state.scene);
          fetch('/api/outfit/tryon', { method: 'POST', body: fd })
            .then(function (r) { return r.json(); })
            .then(function (d) {
              tryBusy = false;
              go.disabled = false;
              if (!d || !d.ok) {
                status.className = 'osx-try-status err';
                status.textContent = (d && d.error) || 'Error. Intenta de nuevo.';
                return;
              }
              status.hidden = true;
              var img = document.getElementById('osxTryImg');
              img.src = d.image;
              document.getElementById('osxTryDl').href = d.image;
              document.getElementById('osxTryWa').href = WA + encodeURIComponent(T.tryWa + tryLookText() + '.');
              result.hidden = false;
              result.scrollIntoView({ behavior: 'smooth', block: 'center' });
            })
            .catch(function () {
              tryBusy = false;
              go.disabled = false;
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

  if (probadorMount) probadorMount.addEventListener('keydown', function (e) {
    var t = e.target;
    if ((e.key === 'Enter' || e.key === ' ') && t && t.getAttribute && t.getAttribute('role') === 'button') {
      e.preventDefault(); t.click();
    }
  });

  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', function () { renderProbador(); renderPreguntas(); renderTryon(); });
  else { renderProbador(); renderPreguntas(); renderTryon(); }
})();
