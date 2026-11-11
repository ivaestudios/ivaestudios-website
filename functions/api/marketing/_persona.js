// ============================================================================
// LA MISMA PERSONA EN VARIOS CANALES Y LO QUE DICEN NUESTROS MENSAJES
// (7-nov-2026). Caso Woo Han: escribió por Instagram, el asistente le confirmó
// "You're all set: your session is booked for Monday, November 23 at 6:45 am
// with The Creative Runway" y la carta salió por correo a la dirección que ella
// misma escribió en el chat. La reserva de Juan se amarró al hilo de correo
// (Sesión reservada) y el de Instagram se quedó en Seguimiento: dos tarjetas de
// una sola persona y ninguna decía si ya salió la carta. Vianey: "tiene que
// funcionar como un sistema, discerniendo solo".
//
// Aquí vive lo que no depende de la base:
//   · extraerContactos: correos y teléfonos que la persona escribe en el chat.
//   · agruparPersonas: une conversaciones de la misma persona por correo,
//     teléfono o nombre completo (incluido "allisonlull@" = "Allison Lull").
//   · confirmaReserva / CARTA_ENVIADA: nuestra confirmación de la reserva y el
//     aviso de la carta, en inglés y en español.
//   · fechaDeTexto / paqueteDeTexto: la fecha, la hora y la colección que dice
//     el mensaje.
// ============================================================================

const CORREOS_PROPIOS = /^(info@ivaestudios\.com|vianeydm07@gmail\.com|vianeydmphoto@gmail\.com|isra9158@gmail\.com)$/i;
const TELS_PROPIOS = /(9902046514|2288570584|9987582363)$/;

// Teléfonos como los guarda la Bandeja: solo dígitos y sin el 1 de los celulares de México.
export const claveTel = (s) => { const d = String(s || '').replace(/\D/g, ''); return d.length === 13 && d.startsWith('521') ? '52' + d.slice(3) : d; };
export const nombreClave = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

const RE_CORREO = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// Un número de 10 a 13 dígitos, con espacios, guiones, puntos o paréntesis en medio.
const RE_TEL = /(?:\+?\d[\d\s().-]{8,18}\d)/g;

export function extraerContactos(texto) {
  const t = String(texto || '');
  const correos = [...new Set((t.match(RE_CORREO) || []).map((c) => c.toLowerCase().replace(/\.+$/, '')))]
    .filter((c) => !CORREOS_PROPIOS.test(c) && !/no-?reply|@(ivaestudios|google)\./i.test(c));
  const tels = [...new Set((t.match(RE_TEL) || []).map(claveTel))]
    .filter((d) => d.length >= 10 && d.length <= 13 && !TELS_PROPIOS.test(d) && !/^(19|20)\d{2}(0[1-9]|1[0-2])/.test(d));
  return { correos, tels };
}

// ── Personas ────────────────────────────────────────────────────────────────
// Llaves de una conversación: lo que la identifica sin duda.
function llavesDe(v) {
  const k = [];
  const correos = [];
  if (v.canal === 'correo' && v.contacto_id) correos.push(String(v.contacto_id).toLowerCase());
  if (v.correo) correos.push(String(v.correo).toLowerCase());
  for (const c of correos) {
    if (!c.includes('@') || CORREOS_PROPIOS.test(c)) continue;
    k.push('c:' + c);
    // "allisonlull@gmail.com" es "Allison Lull": solo letras, 8 o más.
    const local = c.split('@')[0].replace(/[^a-z]/g, '');
    if (local.length >= 8) k.push('nj:' + local);
  }
  const tels = [];
  // Con el número oculto, WhatsApp da un identificador (CA.123…) que no es teléfono.
  if (v.canal === 'whatsapp' && v.contacto_id && !/^[A-Za-z]{2}\./.test(String(v.contacto_id))) tels.push(claveTel(v.contacto_id));
  if (v.telefono) tels.push(claveTel(v.telefono));
  for (const d of tels) if (d.length >= 10 && !TELS_PROPIOS.test(d)) k.push('t:' + d.slice(-10));
  // Nombre completo (dos palabras o más): "Woo Han" en Instagram y en la carta.
  const n = nombreClave(v.nombre);
  const partes = n.split(' ').filter((p) => p.length > 1 && !/^\d+$/.test(p));
  if (partes.length >= 2 && n.length >= 6 && !n.includes('@')) {
    k.push('n:' + partes.join(' '));
    if (partes.join('').length >= 8) k.push('nj:' + partes.join(''));
  }
  return k;
}

// Map conv.id → id del grupo (la primera conversación del grupo).
export function agruparPersonas(convs) {
  const padre = new Map(convs.map((v) => [v.id, v.id]));
  const raiz = (x) => { while (padre.get(x) !== x) { padre.set(x, padre.get(padre.get(x))); x = padre.get(x); } return x; };
  const unir = (a, b) => { const ra = raiz(a); const rb = raiz(b); if (ra !== rb) padre.set(rb, ra); };
  const dueno = new Map();
  for (const v of convs) {
    for (const k of llavesDe(v)) {
      if (dueno.has(k)) unir(dueno.get(k), v.id); else dueno.set(k, v.id);
    }
  }
  const grupo = new Map();
  for (const v of convs) grupo.set(v.id, raiz(v.id));
  return grupo;
}
export function miembrosPorGrupo(grupo) {
  const m = new Map();
  for (const [id, g] of grupo) { if (!m.has(g)) m.set(g, []); m.get(g).push(id); }
  return m;
}

// ── Lo que dicen nuestros mensajes ─────────────────────────────────────────
// Confirmación de la reserva (no la oferta: "to save Monday… could you share"
// no cuenta; "you're all set", "your session is booked for…", "we just sent
// your confirmation letter" sí).
const RESERVO = [
  /\byou(?:'|’)?re all set\b/i,
  /\b(?:your|the) (?:photo |family |couples? |beach )?session (?:is|has been) (?:now |officially )?(?:booked|confirmed|reserved|scheduled)\b/i,
  /\bsession (?:is )?booked\b/i,
  /\bbooked (?:you )?(?:for|on) (?:mon|tue|wed|thu|fri|sat|sun|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d)/i,
  /\b(?:we(?:'|’)ve|we have|we) (?:just |already )?(?:sent|emailed) (?:you )?(?:your|the) confirmation (?:letter|email)\b/i,
  /\b(?:we(?:'|’)ve|we have) attached your confirmation letter\b/i,
  /\bsession confirmation\b/i,
  /\b(?:tu|su) sesi[oó]n (?:ya )?(?:qued[oó]|est[aá]|fue) (?:reservada|agendada|confirmada|apartada)\b/i,
  /\bqued[oó] (?:reservad[ao]|agendad[ao]|confirmad[ao]) (?:tu|su|la) sesi[oó]n\b/i,
  /\b(?:te|le) (?:acabamos de |ya )?(?:enviamos|mandamos|enviamos ya) (?:tu|su|la) carta de confirmaci[oó]n\b/i,
];
// Lo que hace condicional la frase ("once your session is confirmed…").
const CONDICIONAL = /\b(once|when|after|as soon as|until|if|to get|para que|cuando|una vez que|en cuanto|hasta que|si)\b[^.!?]{0,30}$/i;
export function confirmaReserva(texto) {
  const t = String(texto || '');
  for (const re of RESERVO) {
    const m = re.exec(t);
    if (m && !CONDICIONAL.test(t.slice(Math.max(0, m.index - 40), m.index))) return true;
  }
  return false;
}
// La carta de confirmación ya salió (el correo "Session Confirmation" de info@
// o el aviso "we just sent your confirmation letter").
export const CARTA_ENVIADA = /session confirmation|(?:sent|emailed|attached)[^.!?]{0,40}confirmation letter|carta de confirmaci[oó]n[^.!?]{0,20}(?:enviada|adjunta)|(?:enviamos|mandamos|adjuntamos|adjunto)[^.!?]{0,40}carta de confirmaci[oó]n/i;

// ── La fecha y la hora que dice un mensaje ─────────────────────────────────
const MESES_EN = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
const MESES_ES = { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 };
const dos = (n) => String(n).padStart(2, '0');
function horaDe(trozo) {
  // "at 6:45 am", "5:00 pm", "a las 6:45 am", "17:00 hrs", "at 5pm"
  const m = /\b(\d{1,2})(?::(\d{2}))?\s*(a\.?\s?m\.?|p\.?\s?m\.?)(?![a-z])/i.exec(trozo) || /\b(\d{1,2}):(\d{2})\s*(?:hrs?|h)?\b/i.exec(trozo);
  if (!m) return null;
  let h = Number(m[1]); const min = Number(m[2] || 0);
  const suf = (m[3] || '').toLowerCase().replace(/[\s.]/g, '');
  if (suf === 'pm' && h < 12) h += 12;
  if (suf === 'am' && h === 12) h = 0;
  if (!suf && h < 13 && !m[2]) return null;
  if (h > 23 || min > 59) return null;
  return `${dos(h)}:${dos(min)}`;
}
// Devuelve 'AAAA-MM-DD HH:MM' o null. ref = cuándo se escribió el mensaje: el año
// es el de la próxima vez que caiga esa fecha.
export function fechaDeTexto(texto, ref) {
  const t = String(texto || '');
  const base = new Date(ref ? String(ref).replace(' ', 'T') + (String(ref).length <= 19 ? 'Z' : '') : Date.now());
  const candidatos = [];
  const reEn = /\b(?:(?:mon|tues?|wed(?:nes)?|thu(?:rs)?|fri|sat(?:ur)?|sun)(?:day)?,?\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?/gi;
  for (const m of t.matchAll(reEn)) candidatos.push({ i: m.index + m[0].length, mes: MESES_EN[m[1].toLowerCase().slice(0, 3)], dia: Number(m[2]), anio: m[3] ? Number(m[3]) : null });
  const reEs = /\b(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)(?:\s+(?:de|del)\s+(\d{4}))?/gi;
  for (const m of t.matchAll(reEs)) candidatos.push({ i: m.index + m[0].length, mes: MESES_ES[m[2].toLowerCase()], dia: Number(m[1]), anio: m[3] ? Number(m[3]) : null });
  // "tomorrow at 5:00 PM", "today at 4 pm", "mañana a las 7 am", "hoy a las 5 pm"
  // (Joni Blake, 27-dic-2025): el día es el del mensaje en Cancún (UTC−5).
  const reRel = /\b(tomorrow|today|tonight|ma[nñ]ana|hoy)\b/gi;
  for (const m of t.matchAll(reRel)) {
    if (/\b(?:la|por|en)\s+$/i.test(t.slice(Math.max(0, m.index - 6), m.index))) continue; // "de la mañana"
    const local = new Date(base.getTime() - 5 * 3600e3);
    if (/^(tomorrow|ma[nñ]ana)$/i.test(m[1])) local.setUTCDate(local.getUTCDate() + 1);
    candidatos.push({ i: m.index + m[0].length, mes: local.getUTCMonth() + 1, dia: local.getUTCDate(), anio: local.getUTCFullYear() });
  }
  for (const c of candidatos) {
    if (!c.mes || !(c.dia >= 1 && c.dia <= 31)) continue;
    const hora = horaDe(t.slice(c.i, c.i + 45));
    if (!hora) continue;
    let anio = c.anio || base.getUTCFullYear();
    if (!c.anio) {
      const f = Date.UTC(anio, c.mes - 1, c.dia);
      if (f < base.getTime() - 2 * 864e5) anio += 1;
    }
    return `${anio}-${dos(c.mes)}-${dos(c.dia)} ${hora}`;
  }
  return null;
}

// ── La colección que nombra un mensaje ─────────────────────────────────────
const COLECCIONES = [
  'The Spark', 'The Glow Hour', 'The Essential Flow', 'The Creative Runway', 'The Visual Story', 'The Full Experience',
  'The Postcard', 'The Keepsake', 'The Chapter', 'The Editorial Reel', 'The Narrative Reel', 'The Cinematic Short', 'The Editorial', 'The Heirloom', 'The Story',
];
export function paqueteDeTexto(texto, extra = []) {
  const t = ' ' + nombreClave(texto) + ' ';
  const nombres = [...new Set([...extra, ...COLECCIONES])].sort((a, b) => b.length - a.length);
  for (const n of nombres) {
    const sin = nombreClave(n).replace(/^the /, '');
    if (sin.length < 4) continue;
    // "The Story" solo con "the" delante: "your story" no es la colección.
    const re = sin === 'story' || sin === 'editorial' || sin === 'chapter' ? ` the ${sin} ` : ` ${sin} `;
    if (t.includes(re)) return n;
  }
  return null;
}
