// ============================================================================
// IVAE Marketing — Pantalla de "conectar red" (16-nov-2026).
//
// Vianey, viendo "✅ Facebook conectado" en negro: "esta parte no está con el
// nuevo branding". Las pantallas a las que regresa Facebook, Instagram, TikTok,
// YouTube, LinkedIn y Pauta después de dar permiso usaban cada una su propio
// estilo oscuro de 2025. Aquí vive UNO solo, con el tema "Sistema IVA" de la
// app: Outfit, fondo claro, tarjetas blancas y el acento magenta → violeta.
// Si el teléfono está en modo oscuro, se usa la versión oscura del mismo tema.
// ============================================================================

const ESTILO = `
@font-face{font-family:'Outfit';font-weight:100 900;font-display:swap;src:url('/marketing/fonts/outfit-latin-var.woff2') format('woff2')}
:root{--bg:#F6F6FA;--surface:#FFFFFF;--surface-2:#F1F1F6;--border:#E5E5EC;--text:#16161E;--dim:#52525E;--mute:#6A6A78;--brand:#C93E8C;--brand-2:#8A4FD3;--ok:#16a34a}
@media (prefers-color-scheme:dark){:root{--bg:#0A0A0E;--surface:#121218;--surface-2:#16161D;--border:#1E1E26;--text:#ECECF1;--dim:#9A9AA8;--mute:#62626F;--brand:#E24DA0;--brand-2:#9D5BE0;--ok:#22c55e}}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px 16px;background:var(--bg);color:var(--text);font:16px/1.55 Outfit,Inter,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased}
.marca{display:flex;align-items:center;justify-content:center;gap:10px;margin:0 0 18px;font-weight:700;letter-spacing:.14em;font-size:12px;color:var(--dim)}
.marca img{width:28px;height:28px;border-radius:8px}
main{width:100%;max-width:440px;background:var(--surface);border:1px solid var(--border);border-radius:20px;padding:28px 24px;box-shadow:0 1px 2px rgba(15,15,35,.04),0 12px 32px rgba(15,15,35,.06)}
h1{font-size:21px;line-height:1.3;font-weight:700;margin:0 0 10px;letter-spacing:-.01em}
p{color:var(--dim);margin:0 0 14px}
b{color:var(--text)}
small{display:block;color:var(--mute);font-size:13px;margin-top:14px}
ul{padding-left:18px;color:var(--dim)}li{margin:6px 0}
a,button.pg{display:flex;width:100%;align-items:center;gap:10px;min-height:48px;margin-top:10px;padding:12px 14px;border-radius:14px;border:1px solid var(--border);background:var(--surface-2);color:var(--text);font:inherit;font-weight:600;text-decoration:none;text-align:left;cursor:pointer}
a:hover,button.pg:hover{border-color:var(--brand)}
a[href^="/marketing/app"]{justify-content:center;border:0;color:#fff;background:linear-gradient(135deg,var(--brand),var(--brand-2))}
p a{display:inline;min-height:0;margin:0;padding:0;border:0;background:none;color:var(--brand);font-weight:600}
`;

export function paginaConexion(body, status = 200, { lang = 'es', titulo = 'IVAE Marketing' } = {}) {
  const page = `<!doctype html><html lang="${lang === 'en' ? 'en' : 'es'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><meta name="theme-color" content="#F6F6FA"><title>${titulo}</title><style>${ESTILO}</style></head><body><div><div class="marca"><img src="/marketing/icons/icon-192.png" alt="">IVAE MARKETING</div><main>${body}</main></div></body></html>`;
  return new Response(page, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}
