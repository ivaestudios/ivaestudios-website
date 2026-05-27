# IVAE Marketing — Launch Checklist (Post-Push)

**Esto se ejecuta DESPUÉS de que el push a main esté live en Cloudflare (~60s después de git push).**

**Owner:** Vianey + studio team.

**Estimated time:** 2-4 horas distribuidas en 1-2 semanas.

---

## ✅ Inmediato (primeras 24 horas)

### Verificar deploy

- [ ] Ir a https://ivaestudios.com/social-media-management → carga al 100%
- [ ] Ir a https://ivaestudios.com/es/manejo-redes-sociales → carga al 100%
- [ ] Ir a https://ivaestudios.com/marketing-intake → carga al 100%
- [ ] Verificar cada uno de los 6 industry pages (EN + ES = 12 URLs)
- [ ] Verificar cada uno de los 5 nuevos blog posts
- [ ] Verificar `/blog` muestra los 5 nuevos posts en grid
- [ ] Verificar `/sitemap.xml` contiene URLs nuevas
- [ ] Verificar `/_redirects` ruteo limpio funciona

### Submit a indexación

- [ ] GitHub Actions → `SEO — Index IVAE Marketing URLs` → manual run
- [ ] Verificar logs del workflow: 0 errors
- [ ] Si tienes BING_WEBMASTER_KEY: trigger IndexNow workflow

### Setup Resend (si aún no)

- [ ] Crear cuenta en https://resend.com (free 3K/mo)
- [ ] Verificar dominio ivaestudios.com (DNS records)
- [ ] Generar API key
- [ ] Cloudflare → Pages → ivaestudios → Settings → Environment Variables
- [ ] Añadir: `RESEND_API_KEY` = api_key_value
- [ ] Añadir: `RESEND_FROM` = `IVAE Marketing <info@ivaestudios.com>`
- [ ] Redeploy

### Setup Cloudflare Turnstile (si aún no)

- [ ] Cloudflare dashboard → Turnstile → Create widget
- [ ] Sitekey + Secret key generados
- [ ] Pages → Environment Variables
- [ ] Añadir: `TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY`
- [ ] Redeploy
- [ ] Test envío del form: verificar el captcha pide validación

---

## 📋 Días 2-7

### Brand assets

- [ ] Subir logo IVAE Marketing PNG transparente a `/brand-kit-marketing/`
- [ ] Subir 3 product photos del equipo trabajando
- [ ] Subir 1 foto profesional de Vianey (head shot)
- [ ] Subir mockup de feed editorial (3-5 ejemplos)

### Google Business Profile (separado para IVAE Marketing)

- [ ] Ir a https://business.google.com
- [ ] Add business: "IVAE Marketing"
- [ ] Categoría primaria: "Social Media Marketing Agency"
- [ ] Categorías secundarias: "Marketing Agency", "Advertising Agency"
- [ ] Address: misma que IVAE Studios
- [ ] Phone: número GBP
- [ ] Website: `https://ivaestudios.com/social-media-management`
- [ ] Hours: M-F 9-18, Sat 10-14
- [ ] Solicitar verificación (postal 5-14 días)
- [ ] Completar perfil al 100% mientras esperas verificación

### LinkedIn Company Page

- [ ] Crear página: "IVAE Marketing"
- [ ] Subcategoría: "Social Media Marketing Agency"
- [ ] About section: usar texto del press kit
- [ ] Cover image + logo
- [ ] Primer post: anuncio del lanzamiento
- [ ] Invite team + 50 connections relevantes a follow

### Personal LinkedIn de Vianey

- [ ] Update headline: "Founder & Director, IVAE Studios + IVAE Marketing | Luxury Hospitality Photo & SMM"
- [ ] About section: mencionar IVAE Marketing
- [ ] Featured section: añadir link a `/social-media-management`
- [ ] Primer artículo: "Why I extended my photography studio into social media management"

---

## 📋 Semana 2

### Directorios B2B (siguiendo `marketing-directories-ready.md`)

Por cada directorio, usar contenido pre-llenado del playbook:

- [ ] Clutch.co — submit profile (cuenta gratis), espera 5-7 días review
- [ ] GoodFirms — submit profile
- [ ] Sortlist — submit profile
- [ ] DesignRush — submit profile
- [ ] Agency Spotter — submit profile
- [ ] The Manifest — submit profile (auto-claim post-Clutch)
- [ ] TopDevelopers / TopMarketingAgencies — submit profile
- [ ] Hotel Tech Report — submit (vertical hotel)

**IMPORTANTE:** Tener listos los 5 client references ANTES de submit a Clutch (te llamarán a verificar).

### Behance

- [ ] Crear 3 case studies anonymized
- [ ] Subir a Behance con tag "Social Media for Luxury Hospitality"
- [ ] Cross-link al sitio IVAE Marketing

### Pinterest Business

- [ ] Crear cuenta business para IVAE Marketing
- [ ] Crear 5 boards iniciales:
  - "Luxury Hotel Instagram Inspiration"
  - "Restaurant Content Ideas Mexico"
  - "Spa & Wellness Editorial"
  - "Boutique Hotel Aesthetics"
  - "Bilingual Hospitality Content"
- [ ] Pin 20 pins iniciales (5 por board)

---

## 📋 Semana 3-4

### Trade press outreach (siguiendo `marketing-hospitality-trade-press.md`)

Por cada publicación, usar pitch del playbook:

- [ ] Pitch a Skift
- [ ] Pitch a Hotel News Resource
- [ ] Pitch a Hospitality Net
- [ ] Pitch a Marketing Brew
- [ ] Pitch a Campaign México
- [ ] Pitch a Merca2.0
- [ ] Pitch a Hotel Marketing Podcast (audio)
- [ ] Pitch a Heads in Beds (audio)

**Cadencia:** 2 pitches/día. No mandar todos el mismo día (parece spam).

### Pedir reviews B2B iniciales

- [ ] Email a 5 clientes existentes con template del playbook
- [ ] Pedir review en Clutch + Google Business
- [ ] Pedir LinkedIn recommendation a 3 clientes

### Wikidata sub-entity

- [ ] Login en https://www.wikidata.org
- [ ] Submitir item nueva basado en `/seo/playbooks/wikidata-ivae-marketing.md`
- [ ] Esperar reviewer (24-72h)
- [ ] Modificar parent IVAE Studios Q139689577 con P527

---

## 📋 Mes 2

### Content production

- [ ] Publicar 1 blog post nuevo (siguiendo `content-calendar-2026.md`)
- [ ] Publicar 8 LinkedIn posts en cadencia bi-semanal
- [ ] Publicar 1 LinkedIn artículo long-form
- [ ] Update Pinterest con 20 nuevos pins

### Cliente outreach

- [ ] Identificar 10 hoteles boutique en Cancún + Riviera Maya
- [ ] Cold outreach a los 10 (usando email template)
- [ ] Follow-up #1 después de 10 días
- [ ] Track responses en spreadsheet

### Smile Now Dental (lead específico)

- [ ] Revisar `/seo/playbooks/smile-now-pitch.md`
- [ ] Customizar pitch específico
- [ ] Enviar pitch
- [ ] Schedular 20-min call si responde

---

## 📋 Mes 3

### Más contenido

- [ ] 2 blog posts adicionales
- [ ] 8 LinkedIn posts adicionales
- [ ] 1 video case study (60s) para LinkedIn + IG

### Más directorios (Tier B/C)

- [ ] Páginas Amarillas México
- [ ] Mexico Business Pages
- [ ] HSMAI Mexico (membership inquiry — cuesta $5-10K MX/año pero da B2B exposure brutal)
- [ ] AMHM (Asociación Mexicana de Hoteles) vendor directory

### Audits

- [ ] Run `python scripts/audit_links.py --fail-on-broken` → 0 broken
- [ ] Run `python scripts/validate_schema.py` → all valid
- [ ] Google Search Console: check Core Web Vitals (target: 90+ in mobile)
- [ ] PageSpeed Insights mobile score: 90+

---

## 🎯 Mediciones que tienes que trackear cada lunes

| Métrica | Donde | Target Mes 3 |
|---|---|---|
| Google ranking "agencia social media Cancún" | Search Console | Top 10 |
| Google ranking "social media luxury hotel Mexico" | Search Console | Top 20 |
| Indexed pages (Marketing URLs) | Search Console | 18+ indexed |
| Backlinks totales | Ahrefs Webmaster Tools (free) | 25+ |
| GBP impressions | GBP Insights | 500/mes |
| Form submissions | Cloudflare Function logs | 5+ |
| LinkedIn page followers | LinkedIn Analytics | 100+ |
| Blog organic traffic | GSC | 200+ visits |

---

## 🚨 Si algo no funciona

### Form no envía emails

1. Verificar Cloudflare Pages env vars: RESEND_API_KEY, RESEND_FROM
2. Si fallan: el mailto fallback debe activarse — usuario ve correo abierto en su email
3. Logs: Cloudflare → Pages → Functions → Logs

### Páginas no aparecen en Google

1. Submit manual via Search Console URL Inspection tool
2. Verificar canonical tags
3. Verificar robots.txt no bloquea
4. Submit via Indexing API workflow manualmente
5. Espera 7-14 días — Google necesita tiempo

### Schema validation falla

1. Run `python scripts/validate_schema.py`
2. Copiar JSON-LD a https://validator.schema.org/
3. Fix errores

### Burger menu no abre en mobile

1. Hard refresh con Cmd+Shift+R
2. Verificar Service Worker actualizado
3. DevTools → Application → Service Workers → Update on reload

---

## 📞 Soporte interno

Cualquier duda → consultar:
1. `/seo/playbooks/ivae-marketing-90-day-execution.md` (master roadmap)
2. `/seo/AGENTS.md` (agente system docs)
3. `/CLAUDE.md` (instrucciones AI assistant)

---

## ✅ Done checkmark

Cuando todos estos puntos estén ✅, IVAE Marketing tendrá:

- ✓ Sitio técnicamente perfecto
- ✓ 18+ URLs indexadas
- ✓ 8+ directory listings B2B
- ✓ 3+ trade press mentions
- ✓ 10+ B2B reviews
- ✓ Active LinkedIn presence
- ✓ Wikidata sub-entity
- ✓ GBP verificado
- ✓ 5+ inbound leads via /marketing-intake
- ✓ Top-3 ranking en queries prioritarias

**Tiempo total estimado:** 90 días con dedicación part-time (1-2 horas/día Vianey).
