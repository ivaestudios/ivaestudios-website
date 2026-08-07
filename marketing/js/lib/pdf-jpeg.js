// ============================================================================
// IVAE Marketing — Ensamblador de PDF a partir de páginas JPEG.
//
// Un PDF "de imágenes": cada página es un JPEG a página completa (DCTDecode),
// escrito A MANO — sin librerías. Es la mitad fácil del formato PDF y nos da
// fidelidad total: las páginas se rasterizan con el mismo pipeline de
// HTML→SVG→canvas del generador de carruseles (fuentes de marca embebidas),
// así que lo que se diseña es EXACTAMENTE lo que imprime.
//
// A4 vertical: 595.28 × 841.89 pt. Las imágenes se dibujan a sangre completa.
// ============================================================================

const A4_W = 595.28;
const A4_H = 841.89;

const enc = new TextEncoder();

function dataUrlABytes(dataUrl) {
  const b64 = String(dataUrl).split(',')[1] || '';
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Arma el PDF.
 * @param {Array<{dataUrl:string,w:number,h:number}>} paginas JPEGs (mismo tamaño idealmente)
 * @returns {Blob} application/pdf
 */
export function pdfDesdeJpegs(paginas) {
  const partes = [];        // Uint8Array | string (latin1)
  let offset = 0;
  const offsets = [];       // offset de cada objeto (índice 1-based)

  const push = (x) => {
    const bytes = typeof x === 'string' ? enc.encode(x) : x;
    partes.push(bytes);
    offset += bytes.length;
  };
  const obj = (num, cuerpo) => {
    offsets[num] = offset;
    push(`${num} 0 obj\n${cuerpo}\nendobj\n`);
  };

  push('%PDF-1.4\n%âãÏÓ\n');

  // Numeración: 1=Catalog, 2=Pages, luego por página i (0-based):
  //   3+i*3 = Page, 4+i*3 = Contents, 5+i*3 = Image XObject.
  const n = paginas.length;
  const pageRefs = paginas.map((_, i) => `${3 + i * 3} 0 R`).join(' ');
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, `<< /Type /Pages /Kids [ ${pageRefs} ] /Count ${n} >>`);

  paginas.forEach((p, i) => {
    const pageNum = 3 + i * 3;
    const contNum = 4 + i * 3;
    const imgNum = 5 + i * 3;
    obj(pageNum,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4_W} ${A4_H}] ` +
      `/Resources << /XObject << /Im${i} ${imgNum} 0 R >> >> /Contents ${contNum} 0 R >>`);
    const contenido = `q\n${A4_W} 0 0 ${A4_H} 0 0 cm\n/Im${i} Do\nQ\n`;
    obj(contNum, `<< /Length ${contenido.length} >>\nstream\n${contenido}endstream`);
    const bytes = dataUrlABytes(p.dataUrl);
    offsets[imgNum] = offset;
    push(`${imgNum} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${p.w} /Height ${p.h} ` +
      `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bytes.length} >>\nstream\n`);
    push(bytes);
    push('\nendstream\nendobj\n');
  });

  const total = 2 + n * 3;
  const xrefAt = offset;
  let xref = `xref\n0 ${total + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= total; i++) xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  push(xref);
  push(`trailer\n<< /Size ${total + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`);

  return new Blob(partes, { type: 'application/pdf' });
}
