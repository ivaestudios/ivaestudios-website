// ============================================================================
// IVAE Marketing — Cortador de tiras de VIDEO (motor compartido).
//
// Una "tira" es el export del diseñador: los N slides del carrusel pegados en
// fila dentro de UN video (5400×1350 = 5 slides de 1080×1350). Este módulo la
// mide y la corta en N videos MP4 independientes, que es lo que Instagram
// publica como carrusel. Lo usan Crear → Carrusel (views/carrusel.js, para
// descargar) y Entregables (views/entregables.js, para guardar el carrusel del
// cliente como sus N videos, listos para publicar).
//
// Lo que cuida:
//  · Un carrusel puede venir en VARIOS archivos ("X" + "X (2)"): se juntan y
//    los slides se numeran de corrido.
//  · O en UN archivo con las partes una DESPUÉS de otra (así exporta Canva un
//    diseño de varias páginas): 1-5 los primeros segundos y 6-7 + huecos
//    después. Cada parte es un TRAMO de la página y sus slides van de corrido.
//  · Los HUECOS (slides en blanco que rellenan el export) se detectan y se saltan.
//  · Cada slide se recorta a su animación real, pero NUNCA baja de MIN_SEG:
//    Instagram rechaza videos de menos de 3 segundos.
//  · Salida H.264 Main + AAC (silencio si la tira es muda), 30 fps CONSTANTES,
//    con WebCodecs + mp4-muxer: lo que WhatsApp e iPhone aceptan sin pelear.
//    (El respaldo con MediaRecorder vive en views/carrusel.js y NO sirve para
//    entregables: sale Opus/VFR.)
// ============================================================================

// Instagram: mínimo 3 s por video de carrusel. Un slide cuya animación dura
// 2 s se sostiene hasta 3 (el cuadro final se queda quieto).
export const MIN_SEG = 3;
export const MAX_SLIDES = 20;   // tope de Instagram por carrusel

export const esArchivoDeVideo = (f) => /^video\//i.test((f && f.type) || '') || /\.(mp4|mov|webm|m4v|3gp)$/i.test((f && f.name) || '');

export function tieneWebCodecs() {
  return typeof window.VideoEncoder !== 'undefined' && typeof window.VideoFrame !== 'undefined';
}

// Agrupa los archivos por nombre base (misma regla que Entregables con las
// imágenes): "X.mp4" + "X (2).mp4" (duplicado del navegador) y "X-1.mp4" +
// "X-2.mp4" (páginas numeradas) son páginas de UN carrusel. "X 1.mp4" con
// ESPACIO es otro diseño a propósito. Un mismo peso dentro del grupo = el mismo
// archivo bajado dos veces: entra una sola vez.
export function grupoDePaginasVideo(files) {
  const grupos = new Map();
  for (const f of files) {
    const sinExt = String(f.name || '').normalize('NFC').replace(/\.[a-z0-9]+$/i, '');
    const dup = sinExt.match(/^(.+?) \((\d{1,3})\)$/);
    const cuerpo = dup ? dup[1] : sinExt;
    let base, pag;
    const m = cuerpo.match(/^(.+)[-_](\d{1,3})$/);
    if (m) { base = m[1].trim().toLowerCase(); pag = Number(m[2]); }
    else { base = cuerpo.trim().toLowerCase(); pag = dup ? Number(dup[2]) + 1 : 1; }
    if (!grupos.has(base)) grupos.set(base, []);
    grupos.get(base).push({ f, pag });
  }
  return [...grupos.values()].map((arr) => {
    const pesos = new Set();
    const unicos = arr.filter((x) => { if (pesos.has(x.f.size)) return false; pesos.add(x.f.size); return true; });
    return unicos.sort((a, b) => a.pag - b.pag).map((x) => x.f);
  });
}

// Abre el archivo en un <video> listo para medir/cortar. El elemento va MUDO y
// en línea; conviene tenerlo en el documento mientras se reproduce.
export function cargarVideo(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.muted = true; v.defaultMuted = true; v.playsInline = true; v.preload = 'auto'; v.src = url;
    v.onloadedmetadata = () => resolve({ video: v, url, dur: (v.duration && isFinite(v.duration)) ? v.duration : 0 });
    v.onerror = () => { try { URL.revokeObjectURL(url); } catch { /* noop */ } reject(new Error('lectura')); };
  });
}

// Suelta el <video> de una página (memoria del blob).
export function soltarPagina(pg) {
  try { pg.video.pause(); } catch { /* noop */ }
  try { pg.video.removeAttribute('src'); pg.video.load(); } catch { /* noop */ }
  try { URL.revokeObjectURL(pg.url); } catch { /* noop */ }
}

// Recorte de zoom (para tapar la línea del slide vecino).
export function zoomSrc(baseX, baseY, w, h, zPct) {
  const z = Math.max(1, (zPct || 100) / 100);
  const zw = w / z, zh = h / z;
  return { sx: baseX + (w - zw) / 2, sy: baseY + (h - zh) / 2, sw: zw, sh: zh };
}

// Reproduce el video desde→(fin o pausa) llamando onFrame(meta) en cada cuadro.
// meta.mediaTime = tiempo REAL del cuadro en la línea del video (no del reloj):
// clave para que el corte con WebCodecs salga a velocidad correcta en cualquier
// compu. onFrame puede pausar el video para terminar antes (recorte por slide).
// sigueVivo() = false detiene la pasada (el usuario quitó la tira, se salió…).
// `desde` > 0 arranca en un tramo posterior (la 2ª parte de un export de Canva).
export function playThrough(v, onFrame, sigueVivo = () => true, desde = 0) {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => { if (done) return; done = true; try { v.pause(); } catch { /* noop */ } resolve(); };
    const useRVFC = 'requestVideoFrameCallback' in v;
    let iv = null;
    const step = (now, metadata) => {
      if (!sigueVivo()) { finish(); return; }
      onFrame(metadata);
      if (v.ended || v.paused) { finish(); return; }
      if (useRVFC) v.requestVideoFrameCallback(step);
    };
    v.onended = finish;
    const begin = () => {
      if (!sigueVivo()) { finish(); return; }
      v.play().then(() => {
        if (!sigueVivo()) { finish(); return; }
        if (useRVFC) v.requestVideoFrameCallback(step);
        else iv = setInterval(() => {
          if (!sigueVivo() || v.ended || v.paused) { clearInterval(iv); finish(); return; }
          onFrame({ mediaTime: v.currentTime });
        }, 1000 / 30);
      }).catch(() => { if (iv) clearInterval(iv); finish(); });
    };
    // Regresa al inicio (o al arranque del tramo) y ESPERA a que el cuadro esté
    // decodificado antes de grabar: si arrancamos durante el reposicionamiento,
    // el primer cuadro sale NEGRO. Con esto el primer cuadro grabado ya es
    // contenido real. El milisegundo extra cae DENTRO del primer cuadro del
    // tramo, no en el último de la parte anterior.
    if (Math.abs(v.currentTime - desde) <= 0.02 && v.readyState >= 2) { begin(); return; }
    let seeked = false;
    const onSeeked = () => { if (seeked) return; seeked = true; v.removeEventListener('seeked', onSeeked); begin(); };
    v.addEventListener('seeked', onSeeked);
    try { v.currentTime = desde > 0 ? desde + 0.001 : 0; } catch { onSeeked(); }
    setTimeout(onSeeked, 700); // salvavidas si 'seeked' no dispara
  });
}

// Umbrales, medidos sobre el export REAL de REGENERIS (18-oct-2026, 5400×1350,
// slides 1-5 durante 2.3 s y luego 6-7 + 3 huecos durante 5 s):
//  · CAMBIO: movimiento normal de un slide (zoom, texto que entra) da 1-22.
//  · CORTE: el salto de PARTE mueve TODOS los slides en el mismo cuadro, con
//    diferencias de 97 a 128. Un corte DENTRO de un slide (cambia la persona)
//    también llega a ~100, pero en UNO solo: nunca en todos a la vez.
//  · BLANCO: <0.4 % de pixeles con borde = no hay nada en ese slide.
const CAMBIO = 10, CORTE = 40, BLANCO = 0.004;
// Un tramo más corto que esto es un parpadeo de la animación, no una parte.
const TRAMO_MIN = 0.4;

// Mide UNA página: la reproduce una vez (muda) y guarda, cuadro a cuadro y por
// slide, cuánto cambió y cuánto CONTENIDO tiene (energía de bordes). Con eso:
//  (1) busca los SALTOS DE PARTE (ver buscarCortes) y parte la página en tramos;
//  (2) por tramo y slide, cuándo fue su ÚLTIMO cambio, para recortar la cola
//      congelada;
//  (3) los HUECOS: un slide sin bordes en todo su tramo es relleno del export;
//      se marca y el corte lo salta, así el carrusel de 6 que venía en 5 + 1 no
//      sale con cuatro videos en blanco.
// pg = { video, dur, cols, rows }; deja pg.tramos[], pg.durations[] y
// pg.blancos[] (tramo por tramo: el slide `idx` del tramo `j` es j*n + idx) y
// pg.cortesDudosos[] (saltos que hay que preguntar, ver aceptarCortesDudosos).
export function analizarPagina(pg, sigueVivo = () => true, onProg = null) {
  const v = pg.video;
  const cols2 = pg.cols, rows2 = pg.rows, n = cols2 * rows2;
  const sw = Math.floor(v.videoWidth / cols2), sh = Math.floor(v.videoHeight / rows2);
  const DW = 32, DH = 40, BORDE = 14;
  const mc = document.createElement('canvas'); mc.width = DW; mc.height = DH;
  const mg = mc.getContext('2d', { willReadFrequently: true });
  // FOTO del cuadro entero, UNA por muestra (a 4× la rejilla de medida): todos
  // los slides se miden sobre el MISMO instante. Leyéndolos directo del <video>
  // uno por uno, el video seguía corriendo entre slide y slide cuando la compu
  // decodifica lento, y el salto de parte salía "a pedazos" en dos muestras.
  const FW = DW * 4, FH = DH * 4;
  const fc = document.createElement('canvas'); fc.width = cols2 * FW; fc.height = rows2 * FH;
  const fg = fc.getContext('2d');
  const prev = new Array(n).fill(null);
  const tiempos = [], difs = [], bords = [];
  // Se muestrea el INTERIOR del slide (10 % / 6 % de orilla fuera): el vecino
  // sangra unos px al cortar y ese filo no es contenido.
  const mx = FW * 0.10, my = FH * 0.06;
  const lum = (d, i) => (d[i] + d[i + 1] + d[i + 2]) / 3;

  const sample = (meta) => {
    // El tiempo REAL del cuadro (no el del reloj): el corte busca el arranque
    // de cada tramo con este mismo número.
    const t = (meta && typeof meta.mediaTime === 'number') ? meta.mediaTime : v.currentTime;
    fg.drawImage(v, 0, 0, cols2 * sw, rows2 * sh, 0, 0, fc.width, fc.height);
    const fd = new Float32Array(n), fb = new Float32Array(n);
    for (let idx = 0; idx < n; idx++) {
      const c = idx % cols2, r = Math.floor(idx / cols2);
      mg.drawImage(fc, c * FW + mx, r * FH + my, FW - 2 * mx, FH - 2 * my, 0, 0, DW, DH);
      const data = mg.getImageData(0, 0, DW, DH).data;
      const p = prev[idx];
      if (p) {
        let diff = 0;
        for (let k = 0; k < data.length; k += 4) diff += Math.abs(data[k] - p[k]) + Math.abs(data[k + 1] - p[k + 1]) + Math.abs(data[k + 2] - p[k + 2]);
        fd[idx] = diff / (DW * DH * 3);
      }
      let bordes = 0, tot = 0;
      for (let y = 0; y < DH - 1; y++) {
        for (let x = 0; x < DW - 1; x++) {
          const i = (y * DW + x) * 4;
          if (Math.max(Math.abs(lum(data, i) - lum(data, i + 4)), Math.abs(lum(data, i) - lum(data, i + DW * 4))) > BORDE) bordes++;
          tot++;
        }
      }
      fb[idx] = bordes / tot;
      prev[idx] = data;
    }
    tiempos.push(t); difs.push(fd); bords.push(fb);
    if (onProg) onProg(pg.dur ? Math.min(1, t / pg.dur) : 0);
  };

  return playThrough(v, sample, sigueVivo).then(() => {
    if (!sigueVivo()) return;
    pg.medida = { tiempos, difs, bords, n };
    const { seguros, dudosos } = buscarCortes(pg.medida);
    pg.cortesSeguros = seguros;
    pg.cortesDudosos = dudosos;
    armarTramos(pg, seguros);
  });
}

// ¿Dónde empieza una PARTE nueva? En el cuadro donde los slides que tenían
// contenido cambian TODOS a la vez (ninguno se queda quieto) y la mayoría
// (60 %, mínimo 2) da un SALTO: cambio fuerte que no venía de antes ni sigue
// después — así el movimiento rápido de un video, medido con cuadros salteados
// cuando la compu decodifica lento, no se confunde con un corte. Además tiene
// que quedar contenido en alguno (un fundido final a blanco no es parte nueva)
// y ningún tramo puede ser un parpadeo.
//  · SEGURO: además, algún slide que tenía contenido queda en BLANCO todo el
//    tramo siguiente. Es la firma del export de Canva: la última parte trae
//    menos slides y rellena con huecos (7 = 5 + 2 y 3 huecos).
//  · DUDOSO: todos cambian pero ninguno queda en blanco. Puede ser otra parte
//    completa (10 = 5 + 5) o un video panorámico que cruza toda la tira y
//    cambia de escena: eso solo lo sabe quien lo diseñó, así que se PREGUNTA.
// Devuelve índices de cuadro (el primero de cada parte nueva).
function buscarCortes({ tiempos, difs, bords, n }) {
  const F = tiempos.length;
  if (n < 2 || F < 3) return { seguros: [], dudosos: [] };
  const cand = [];
  for (let f = 1; f < F; f++) {
    let conAntes = 0, semovieron = 0, saltaron = 0, conDespues = 0;
    for (let s = 0; s < n; s++) {
      if (bords[f][s] >= BLANCO) conDespues++;
      if (bords[f - 1][s] < BLANCO) continue;
      conAntes++;
      const d = difs[f][s];
      if (d > CAMBIO) semovieron++;
      const vecino = Math.max(f > 1 ? difs[f - 1][s] : 0, f + 1 < F ? difs[f + 1][s] : 0);
      if (d > CORTE && d > 2.5 * vecino) saltaron++;
    }
    if (conAntes >= 2 && semovieron === conAntes && saltaron >= Math.max(2, Math.ceil(0.6 * conAntes)) && conDespues >= 1) cand.push(f);
  }
  const fin = tiempos[F - 1] + 1 / 30;
  const cortes = [];
  for (let i = 0; i < cand.length; i++) {
    const f = cand[i];
    const ini = cortes.length ? tiempos[cortes[cortes.length - 1]] : tiempos[0];
    const sig = i + 1 < cand.length ? tiempos[cand[i + 1]] : fin;
    if (tiempos[f] - ini >= TRAMO_MIN && sig - tiempos[f] >= TRAMO_MIN) cortes.push(f);
  }
  const seguros = [], dudosos = [];
  cortes.forEach((f, i) => {
    const a0 = i ? cortes[i - 1] : 0, b1 = i + 1 < cortes.length ? cortes[i + 1] : F;
    let seVacia = false;
    for (let s = 0; s < n && !seVacia; s++) {
      let antes = 0, despues = 0;
      for (let k = a0; k < f; k++) antes = Math.max(antes, bords[k][s]);
      for (let k = f; k < b1; k++) despues = Math.max(despues, bords[k][s]);
      if (antes >= BLANCO && despues < BLANCO) seVacia = true;
    }
    (seVacia ? seguros : dudosos).push(f);
  });
  return { seguros, dudosos };
}

// Parte la página en tramos por los cortes dados (índices de cuadro) y calcula,
// por tramo y slide, duración real y si es hueco. Con 0 cortes queda UN tramo y
// el resultado es exactamente el de siempre.
function armarTramos(pg, cortes) {
  const { tiempos, difs, bords, n } = pg.medida;
  const F = tiempos.length;
  const bordesF = [0, ...cortes, F];
  pg.tramos = []; pg.durations = []; pg.blancos = [];
  for (let j = 0; j + 1 < bordesF.length; j++) {
    const fa = bordesF[j], fb = bordesF[j + 1];
    const ini = j ? tiempos[fa] : 0;
    const ultimo = fb === F;
    // El último tramo dura lo que el video; los demás, hasta el siguiente.
    const largo = (ultimo ? (pg.dur || (F ? tiempos[F - 1] + 1 / 30 : MIN_SEG)) : tiempos[fb]) - ini;
    pg.tramos.push({ ini, fin: ultimo ? Infinity : tiempos[fb], largo });
    for (let s = 0; s < n; s++) {
      let lc = null, maxB = 0;
      for (let f = fa; f < fb; f++) {
        maxB = Math.max(maxB, bords[f][s]);
        // El cuadro que ABRE el tramo se compara con la parte anterior: ese
        // salto no es movimiento del slide.
        if (f > fa && difs[f][s] > CAMBIO) lc = tiempos[f];
      }
      // Sin cambios = slide estático: dura lo que su tramo. Con cambios: hasta
      // el último + 0.2 s de aire. Y nunca menos de MIN_SEG (Instagram).
      const real = lc !== null ? Math.min(largo, lc - ini + 0.2) : (largo > 0 ? largo : MIN_SEG);
      pg.durations.push(Math.max(MIN_SEG, real));
      pg.blancos.push(maxB < BLANCO);
    }
  }
}

// Si quien sube confirma que los saltos dudosos SÍ son partes del carrusel
// (p. ej. 10 slides = 5 + 5), se rehacen los tramos con ellos. No vuelve a
// reproducir: usa la medida guardada.
export function aceptarCortesDudosos(pg) {
  if (!pg.medida || !(pg.cortesDudosos && pg.cortesDudosos.length)) return;
  const todos = [...(pg.cortesSeguros || []), ...pg.cortesDudosos].sort((a, b) => a - b);
  armarTramos(pg, todos);
  pg.cortesSeguros = todos;
  pg.cortesDudosos = [];
}

// Para la pregunta: en qué segundo salta, en cuántas partes quedaría y cuántos
// slides saldrían si se aceptan los saltos dudosos (sin tocar la página).
export function resumenDudoso(pg) {
  if (!pg.medida || !(pg.cortesDudosos && pg.cortesDudosos.length)) return null;
  const todos = [...(pg.cortesSeguros || []), ...pg.cortesDudosos].sort((a, b) => a - b);
  const prueba = { medida: pg.medida, dur: pg.dur };
  armarTramos(prueba, todos);
  return {
    segundo: pg.medida.tiempos[pg.cortesDudosos[0]],
    partes: prueba.tramos.length,
    slides: prueba.blancos.filter((b) => !b).length,
  };
}

// Slides REALES (sin huecos) de una lista de páginas, en orden: página por
// página y, dentro de cada una, tramo por tramo. Cada uno trae su página, su
// posición en la tira (idx), su lugar en durations/blancos (k) y el tramo de
// tiempo donde vive (ini/fin).
export function slidesRealesDe(paginas) {
  const out = [];
  for (const pg of paginas) {
    const n = pg.cols * pg.rows;
    const tramos = (pg.tramos && pg.tramos.length) ? pg.tramos : [{ ini: 0, fin: Infinity }];
    tramos.forEach((tr, j) => {
      for (let idx = 0; idx < n; idx++) {
        const k = j * n + idx;
        if (!(pg.blancos && pg.blancos[k])) out.push({ pg, idx, k, ini: tr.ini, fin: tr.fin });
      }
    });
  }
  return out;
}
export const huecosDe = (paginas) => paginas.reduce((a, pg) => a + (pg.blancos || []).filter(Boolean).length, 0);
// Cuántas partes de más (tramos después del primero) trae la tira.
export const partesExtraDe = (paginas) => paginas.reduce((a, pg) => a + Math.max(0, ((pg.tramos && pg.tramos.length) || 1) - 1), 0);

// ── Audio ────────────────────────────────────────────────────────────────────
// Decodifica el audio de la tira UNA vez (rápido, no en tiempo real). Devuelve
// un AudioBuffer, o null si el video no tiene audio o el navegador no puede.
async function decodeAudioSafe(file) {
  if (!file || typeof window.AudioEncoder === 'undefined' || typeof window.AudioData === 'undefined') return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  let ctx = null;
  try {
    const buf = await file.arrayBuffer();
    ctx = new AC();
    const audio = await ctx.decodeAudioData(buf.slice(0));
    return (audio && audio.length > 0) ? audio : null;
  } catch { return null; }
  finally { if (ctx) { try { ctx.close(); } catch { /* noop */ } } }
}

// Codifica en AAC el tramo [0, dur] del audio y lo mete al muxer del slide. Si
// el audio es más corto que el slide (cola sostenida), se rellena con silencio.
async function encodeAudioForSlide(audioBuf, dur, muxer) {
  const sr = audioBuf.sampleRate, ch = Math.max(1, audioBuf.numberOfChannels);
  const total = Math.max(1, Math.floor(dur * sr));
  const conAudio = Math.min(audioBuf.length, total);
  const chans = [];
  for (let c = 0; c < ch; c++) chans.push(audioBuf.getChannelData(c));
  let aerr = null;
  const aenc = new window.AudioEncoder({
    output: (chunk, meta) => { try { muxer.addAudioChunk(chunk, meta); } catch (e) { aerr = e; } },
    error: (e) => { aerr = e; },
  });
  aenc.configure({ codec: 'mp4a.40.2', sampleRate: sr, numberOfChannels: ch, bitrate: 128_000 });
  const BLK = 4096;
  for (let off = 0; off < total; off += BLK) {
    const nf = Math.min(BLK, total - off);
    const data = new Float32Array(nf * ch); // planar: [ch0…, ch1…]; lo que sobre queda en 0 = silencio
    for (let c = 0; c < ch; c++) {
      const fin = Math.min(off + nf, conAudio);
      if (fin > off) data.set(chans[c].subarray(off, fin), c * nf);
    }
    const ad = new window.AudioData({ format: 'f32-planar', sampleRate: sr, numberOfFrames: nf, numberOfChannels: ch, timestamp: Math.round(off / sr * 1e6), data });
    aenc.encode(ad); ad.close();
  }
  await aenc.flush(); aenc.close();
  if (aerr) throw aerr;
}

// Codifica `dur` segundos de SILENCIO en AAC. Se usa cuando la tira es muda, para
// que TODO slide salga con pista de audio: un MP4 sin audio es justo lo que hacía
// que WhatsApp no lo pudiera descargar/compartir (los videos normales siempre
// llevan audio). Con silencio, el video sale "normal" y se comparte sin error.
async function encodeSilentAudio(dur, muxer, sr, ch) {
  const total = Math.max(1, Math.floor(dur * sr));
  let aerr = null;
  const aenc = new window.AudioEncoder({
    output: (chunk, meta) => { try { muxer.addAudioChunk(chunk, meta); } catch (e) { aerr = e; } },
    error: (e) => { aerr = e; },
  });
  aenc.configure({ codec: 'mp4a.40.2', sampleRate: sr, numberOfChannels: ch, bitrate: 96_000 });
  const BLK = 4096;
  for (let off = 0; off < total; off += BLK) {
    const nf = Math.min(BLK, total - off);
    const data = new Float32Array(nf * ch); // ceros = silencio (planar)
    const ad = new window.AudioData({ format: 'f32-planar', sampleRate: sr, numberOfFrames: nf, numberOfChannels: ch, timestamp: Math.round(off / sr * 1e6), data });
    aenc.encode(ad); ad.close();
  }
  await aenc.flush(); aenc.close();
  if (aerr) throw aerr;
}

// ── El corte ─────────────────────────────────────────────────────────────────
// WebCodecs: a cada cuadro le pone su TIEMPO REAL del video (no el del reloj de
// pared). Aunque la compu vaya lenta y capture menos cuadros, el video sale con
// la DURACIÓN CORRECTA (nunca en cámara lenta). Conserva el audio de su página
// (recortado por slide). Los huecos se saltan y los slides se numeran de
// corrido a través de las páginas. Devuelve [{ blob, duration, width, height }]
// o null si sigueVivo() se apagó a medio camino. Lanza si algo falla.
export async function cortarWebCodecs({ paginas, zoom = 100, sigueVivo = () => true, onProgress = null }) {
  const reales = slidesRealesDe(paginas).slice(0, MAX_SLIDES);
  if (!reales.length) return [];
  const { Muxer, ArrayBufferTarget } = await import('../../vendor/mp4-muxer.mjs?v=202610262324');

  // Elige el códec H.264 MÁS COMPATIBLE que soporte el tamaño (Main → Baseline;
  // High solo de último recurso: daba error al compartir en algunos teléfonos).
  const codecPara = async (w, h) => {
    for (const cc of ['avc1.4d0028', 'avc1.42e028', 'avc1.4d0033', 'avc1.42e033', 'avc1.640028', 'avc1.42e01e']) {
      try {
        const r = await window.VideoEncoder.isConfigSupported({ codec: cc, width: w, height: h, bitrate: 10_000_000 });
        if (r && r.supported) return cc;
      } catch { /* noop */ }
    }
    return null;
  };
  const canAudio = typeof window.AudioEncoder !== 'undefined' && typeof window.AudioData !== 'undefined';
  const audioPorPagina = new Map();
  const FPS = 30, FDUR = Math.round(1e6 / FPS);

  const out = [];
  let k = 0;
  for (const { pg, idx, k: pos, ini, fin } of reales) {
    if (!sigueVivo()) return null;
    const v = pg.video;
    const cols2 = pg.cols, rows2 = pg.rows;
    const sw = Math.floor(v.videoWidth / cols2), sh = Math.floor(v.videoHeight / rows2);
    const sw2 = sw - (sw % 2), sh2 = sh - (sh % 2); // H.264 exige dimensiones pares
    // eslint-disable-next-line no-await-in-loop
    const codec = await codecPara(sw2, sh2);
    if (!codec) throw new Error('sin códec H.264 soportado');
    if (!audioPorPagina.has(pg)) {
      // eslint-disable-next-line no-await-in-loop
      audioPorPagina.set(pg, await decodeAudioSafe(pg.file));
    }
    const audioBuf = audioPorPagina.get(pg);
    const hasAudio = !!audioBuf;
    const aSr = hasAudio ? audioBuf.sampleRate : 44100;
    const aCh = hasAudio ? Math.max(1, audioBuf.numberOfChannels) : 2;

    const c = idx % cols2, r = Math.floor(idx / cols2);
    const dur = Math.max(MIN_SEG, pg.durations[pos] || MIN_SEG);
    // El tramo donde vive el slide: los cuadros de OTRA parte no entran.
    const desde = ini || 0, hasta = (typeof fin === 'number') ? fin : Infinity;
    const cv = document.createElement('canvas'); cv.width = sw2; cv.height = sh2;
    const cx = cv.getContext('2d');
    const muxerCfg = { target: new ArrayBufferTarget(), video: { codec: 'avc', width: sw2, height: sh2 }, fastStart: 'in-memory' };
    if (canAudio) muxerCfg.audio = { codec: 'aac', numberOfChannels: aCh, sampleRate: aSr };
    const muxer = new Muxer(muxerCfg);
    let encErr = null;
    const encoder = new window.VideoEncoder({
      output: (chunk, meta) => { try { muxer.addVideoChunk(chunk, meta); } catch (e) { encErr = e; } },
      error: (e) => { encErr = e; },
    });
    encoder.configure({ codec, width: sw2, height: sh2, bitrate: 10_000_000, framerate: FPS, latencyMode: 'realtime', avc: { format: 'avc' } });

    // 30 fps CONSTANTES: cada cuadro se ancla a la rejilla de 1/30 s según su
    // tiempo REAL en el video. Velocidad correcta en cualquier compu y un
    // frame-rate estable, que es lo que WhatsApp/iOS necesitan.
    let lastIdx = -1, t0 = null, frames = 0;
    const kk = k;
    const meter = (fidx) => {
      const vf = new window.VideoFrame(cv, { timestamp: fidx * FDUR, duration: FDUR });
      encoder.encode(vf, { keyFrame: frames % 30 === 0 });
      vf.close();
      frames += 1;
    };
    // eslint-disable-next-line no-await-in-loop
    await playThrough(v, (meta) => {
      const mt = (meta && typeof meta.mediaTime === 'number') ? meta.mediaTime : v.currentTime;
      // Un cuadro de la parte ANTERIOR que quedó tras el salto: no es de este slide.
      if (mt < desde - 0.004) return;
      // Ya empezó la parte SIGUIENTE, o el slide ya duró lo suyo: aquí acaba.
      if (mt >= hasta - 0.004 || mt > desde + dur + 0.05) { try { v.pause(); } catch { /* noop */ } return; }
      if (t0 === null) t0 = mt;
      const fidx = Math.round((mt - t0) * FPS);
      if (fidx <= lastIdx) { if (onProgress) onProgress((kk + Math.min(1, (mt - desde) / dur)) / reales.length); return; }
      lastIdx = fidx;
      const z = zoomSrc(c * sw, r * sh, sw, sh, zoom);
      cx.drawImage(v, z.sx, z.sy, z.sw, z.sh, 0, 0, sw2, sh2);
      try { meter(fidx); } catch (e) { encErr = e; try { v.pause(); } catch { /* noop */ } }
      if (onProgress) onProgress((kk + Math.min(1, (mt - desde) / dur)) / reales.length);
    }, sigueVivo, desde);
    if (!sigueVivo()) { try { encoder.close(); } catch { /* noop */ } return null; }

    if (encErr) { try { encoder.close(); } catch { /* noop */ } throw encErr; }
    if (!frames) throw new Error('no se capturó ningún cuadro');
    // Sostener el ÚLTIMO cuadro hasta completar la duración: pasa cuando la
    // página (o su tramo) dura menos de MIN_SEG (Instagram pide 3 s) o cuando
    // el navegador dejó de entregar cuadros antes de tiempo.
    const quiero = Math.round(dur * FPS);
    try { while (lastIdx + 1 < quiero) { lastIdx += 1; meter(lastIdx); } } catch (e) { encErr = e; }
    if (encErr) { try { encoder.close(); } catch { /* noop */ } throw encErr; }
    // eslint-disable-next-line no-await-in-loop
    await encoder.flush();
    encoder.close();
    if (canAudio) {
      try {
        // eslint-disable-next-line no-await-in-loop
        if (hasAudio) await encodeAudioForSlide(audioBuf, dur, muxer);
        // eslint-disable-next-line no-await-in-loop
        else await encodeSilentAudio(dur, muxer, aSr, aCh);
      } catch (e) { console.error('[cortador] audio slide', e && e.message); }
    }
    muxer.finalize();
    out.push({ blob: new Blob([muxer.target.buffer], { type: 'video/mp4' }), duration: dur, width: sw2, height: sh2 });
    k += 1;
  }
  return sigueVivo() ? out : null;
}

// ── La tira de cuadros (poster) ──────────────────────────────────────────────
// Un JPEG con los slides REALES en fila, tomados al `punto` (0..1) de cada
// página (o de cada tramo, si la página trae partes una tras otra) — tarde a
// propósito (0.85): en una tira animada los slides de la derecha aparecen
// después, y un cuadro del arranque saldría medio en blanco.
// Es lo que el visor, el PDF y la IA leen como "la tira" del carrusel.
function buscar(v, t) {
  return new Promise((res) => {
    let fin = false;
    const ok = () => { if (fin) return; fin = true; v.removeEventListener('seeked', ok); res(); };
    v.addEventListener('seeked', ok);
    try { v.currentTime = Math.max(0, Math.min(t, (v.duration || t) - 0.05)); } catch { ok(); }
    setTimeout(ok, 2000);
  });
}
export async function cuadroDeSlides(paginas, punto = 0.85, alto = 900) {
  const reales = slidesRealesDe(paginas).slice(0, MAX_SLIDES);
  if (!reales.length) return null;
  const pg0 = reales[0].pg;
  const sw0 = Math.floor(pg0.video.videoWidth / pg0.cols), sh0 = Math.floor(pg0.video.videoHeight / pg0.rows);
  if (!sw0 || !sh0) return null;
  const k = Math.min(alto / sh0, 8000 / (sw0 * reales.length), 1);
  const cw = Math.round(sw0 * k), ch = Math.round(sh0 * k);
  const cv = document.createElement('canvas'); cv.width = cw * reales.length; cv.height = ch;
  const cx = cv.getContext('2d');
  // Los slides vienen página por página y tramo por tramo: cada vez que cambia
  // el tramo se busca SU momento y se pintan sus slides antes de seguir (dos
  // tramos de una página comparten el mismo <video>).
  let enCurso = null;
  for (let i = 0; i < reales.length; i++) {
    const { pg, idx, ini = 0, fin = Infinity } = reales[i];
    const clave = `${paginas.indexOf(pg)}|${ini}`;
    if (clave !== enCurso) {
      enCurso = clave;
      const hasta = Number.isFinite(fin) ? fin : (pg.dur || ini + 1);
      // eslint-disable-next-line no-await-in-loop
      await buscar(pg.video, ini + Math.max(0, hasta - ini) * punto);
    }
    const sw = Math.floor(pg.video.videoWidth / pg.cols), sh = Math.floor(pg.video.videoHeight / pg.rows);
    const c = idx % pg.cols, r = Math.floor(idx / pg.cols);
    cx.drawImage(pg.video, c * sw, r * sh, sw, sh, i * cw, 0, cw, ch);
  }
  return new Promise((res) => cv.toBlob(res, 'image/jpeg', 0.9));
}

// ── ZIP (método STORE, sin compresión — el contenido ya viene comprimido) ────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(u8) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < u8.length; i++) c = CRC_TABLE[(c ^ u8[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// entries: [{ blob, name }] → Blob application/zip
export async function armarZip(entries) {
  const enc = new TextEncoder();
  const parts = [];
  const central = [];
  let offset = 0;
  let cdSize = 0;
  for (const e of entries) {
    // eslint-disable-next-line no-await-in-loop
    const data = new Uint8Array(await e.blob.arrayBuffer());
    const name = enc.encode(e.name);
    const crc = crc32(data);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true);
    lh.setUint16(4, 20, true);
    lh.setUint16(6, 0x0800, true);
    lh.setUint16(8, 0, true);
    lh.setUint32(14, crc, true);
    lh.setUint32(18, data.length, true);
    lh.setUint32(22, data.length, true);
    lh.setUint16(26, name.length, true);
    parts.push(new Uint8Array(lh.buffer), name, data);

    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true);
    ch.setUint16(4, 20, true);
    ch.setUint16(6, 20, true);
    ch.setUint16(8, 0x0800, true);
    ch.setUint16(10, 0, true);
    ch.setUint32(16, crc, true);
    ch.setUint32(20, data.length, true);
    ch.setUint32(24, data.length, true);
    ch.setUint16(28, name.length, true);
    ch.setUint32(42, offset, true);
    central.push(new Uint8Array(ch.buffer), name);
    cdSize += 46 + name.length;
    offset += 30 + name.length + data.length;
  }
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, cdSize, true);
  end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: 'application/zip' });
}
