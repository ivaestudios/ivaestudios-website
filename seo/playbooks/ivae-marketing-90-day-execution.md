# IVAE Marketing — 90-day Execution Roadmap to Top-3

**Objetivo:** Posicionar IVAE Marketing en el top 3 de Google + IAs (ChatGPT, Claude, Perplexity, Gemini) para queries clave de social media management en hospitalidad de lujo en México.

**Scope:** Solamente IVAE Marketing (sub-marca SMM). NO toca IVAE Studios fotografía.

**Brand:** purple/pink (#a78bfa → #ec4899), Outfit + Space Mono, dark navy (#0a0a0f).

---

## Estado actual (snapshot)

### Lo que YA tenemos vivo

| Activo | Estado | URL |
|---|---|---|
| Master page EN | LIVE | `/social-media-management` |
| Master page ES | LIVE | `/es/manejo-redes-sociales` |
| Intake form bilingüe | LIVE | `/marketing-intake` |
| Form backend (Cloudflare Function) | LIVE | `/functions/api/marketing-intake.js` |
| Mailto fallback | LIVE | (works sin Resend) |
| Blog post (Hotel IG Strategy) | LIVE | `/post-hotel-instagram-strategy-mexico-2026` |
| 6 industry landing pages EN | EN ESTA SESIÓN (Agent 1) | `/social-media-luxury-hotels-mexico`, etc. |
| 6 industry landing pages ES | EN ESTA SESIÓN (Agent 1) | `/es/redes-sociales-hoteles-lujo-mexico`, etc. |
| 5 nuevos blog posts | EN ESTA SESIÓN (Agent 2) | `/post-restaurant-social-media-mexico-2026`, etc. |
| B2B directory playbooks | EN ESTA SESIÓN (Agent 3) | `/seo/playbooks/marketing-directories-ready.md` |
| Schema enhancements | EN ESTA SESIÓN (Agent 4) | Service + Audience B2B |
| llms.txt expansion | EN ESTA SESIÓN (Agent 4) | +20 marketing triggers |
| Wikidata sub-entity draft | EN ESTA SESIÓN (Agent 4) | `/seo/playbooks/wikidata-ivae-marketing.md` |

### Lo que falta (necesita acción de Vianey)

1. **[TIER 0] Crear cuenta Resend** (`resend.com`) — añadir API key como Cloudflare Pages env var `RESEND_API_KEY`
2. **[TIER 0] Configurar dominio `ivaestudios.com`** en Resend (verificar DNS records)
3. **[TIER 0] Crear cuenta Cloudflare Turnstile** — añadir env vars `TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY`
4. **[TIER 0] 5 referencias verificables** (clientes que aceptan llamada de Clutch — bloqueante para Clutch submit)
5. **[TIER 0] 3 case studies** con métricas reales (hotel/restaurante)
6. **[TIER 0] Brand assets:** logo PNG transparente, foto del equipo, foto de oficina/estudio
7. **[RESUELTO 2026-06-05] Teléfonos confirmados REALES:** `+52 998 758 2363` es el WhatsApp real del estudio y `+52 998 758 2363` es el número real de llamadas (coincide con GBP). Usar 228 como teléfono en directorios (NAP) y 990 en enlaces de WhatsApp; NUNCA tratarlos como placeholder ni unificarlos
8. **[TIER 0] Decisión engagement mínimo:** FAQ master dice 6 meses, directorios playbook dice 3 meses. Alinear antes de submit
9. **[TIER 1] Google Business Profile separado** para IVAE Marketing (categoría: "Social Media Marketing Agency")
10. **[TIER 1] LinkedIn Company Page** independiente para IVAE Marketing

---

## Roadmap por sprints

### Sprint 1 — Días 1 a 7 (semana de inicio)

**Owner: Vianey + studio team**

| Tarea | Tiempo | Responsable | Output |
|---|---|---|---|
| Configurar Resend + verificar dominio | 30 min | Vianey | Email pipeline activo |
| Configurar Turnstile + añadir keys | 15 min | Vianey | Anti-spam activo |
| Test 5 envíos del intake form | 20 min | Vianey | Confirma email llega |
| Generar 5 client references | 2 días | Vianey | Lista con: nombre + cargo + email + teléfono |
| Generar 3 case studies anonymized | 1 día | Studio | Métricas reales con números |
| Logo PNG transparente + brand kit | 1 hora | Vianey | Files en `/brand-kit-marketing/` |
| Crear LinkedIn Company Page | 30 min | Vianey | "IVAE Marketing" como entidad |
| Submitir Clutch profile (paga $0) | 1 hora | Vianey | Perfil pending review |

**Resultado esperado:** Infraestructura 100%, primera presencia B2B externa.

---

### Sprint 2 — Días 8 a 14

**Owner: Studio + Vianey**

| Tarea | Tiempo | Responsable | Output |
|---|---|---|---|
| Submitir GoodFirms profile | 30 min | Vianey | Perfil pending |
| Submitir Sortlist | 30 min | Vianey | Perfil pending |
| Submitir DesignRush | 45 min | Vianey | Perfil pending |
| Submitir Agency Spotter | 20 min | Vianey | Perfil pending |
| Submitir The Manifest | 15 min | Vianey | Perfil pending (auto from Clutch) |
| Crear Google Business Profile "IVAE Marketing" | 1 hora | Vianey | Pin separado en Maps |
| Verificar GBP por correo o llamada | 5-14 días | Vianey | Verificación pendiente |
| LinkedIn artículo 1: "Why luxury hotels need bilingual social media" | 2 horas | Studio team | Post + share |
| Subir 3 case studies a Behance | 3 horas | Studio team | 3 backlinks DA 95 |

**Resultado esperado:** 8 directory submissions + presencia LinkedIn + Behance.

---

### Sprint 3 — Días 15 a 30

**Owner: Studio team (Vianey supervisa)**

| Tarea | Output |
|---|---|
| Hotel Tech Report submission | DA 71 backlink |
| Pitchear 3 publicaciones trade press (de press-kit) | 1-3 menciones |
| Crear 5 Pinterest boards: "Luxury Hotel Instagram", "Resort Content Ideas", etc. | Pinterest authority |
| Optimizar las 6 industry landing pages con imágenes reales | Mejor CTR |
| Internal linking pass: cada blog post → industry landing page relevante | Topical authority |
| Submitir a IndexNow para todas las URLs nuevas | Indexación rápida Bing |
| Submit Google Indexing API para 18 URLs nuevas | Indexación 24-48h |
| Crear quincenales LinkedIn posts (4 posts) | Engagement B2B |
| Setup Google Analytics 4 events para form submits | Tracking conversiones |

**Resultado esperado:** Toda infraestructura SEO al 100%, primer mes con tráfico orgánico medible.

---

### Sprint 4 — Días 31 a 60

**Owner: Studio team**

| Tarea | Output |
|---|---|
| Reach out a 5 hoteles boutique Cancún con propuesta IVAE Marketing | 2-3 leads |
| Pitchear Hotel News Resource, Skift, Hospitality Net | 1-2 menciones |
| Publicar 2 nuevos blog posts (TikTok hotels, Spa SMM) | Topical authority |
| Pedir 3 reviews iniciales en Clutch | 3 ratings |
| LinkedIn Posts: 8 posts (2/semana) + 2 artículos | B2B reach |
| Audit competitivo: comparar SEO vs top 3 agencias MX | Strategic intel |
| Outreach con 10 fotógrafos/agencias para colaboraciones cross-link | 3-5 backlinks |
| Refresh content viejo según queries Google Search Console | CTR boost |

**Resultado esperado:** Primeras conversiones inbound, 5+ reviews B2B, primera mención editorial.

---

### Sprint 5 — Días 61 a 90

**Owner: Studio team**

| Tarea | Output |
|---|---|
| Pedir reviews adicionales clientes B2B → 10 reviews totales | Clutch rating |
| Lanzar mini-conference o webinar: "Hotel Instagram 2026" | Lead generation |
| Crear case study video: 60s con hotel client | Social proof |
| Pitchear Forbes Mexico, El País, Reforma con angle de marketing | High-DA backlinks |
| Submitir Wikidata sub-entity oficialmente | Entity authority |
| Crear página `/case-studies` con 6+ casos | Conversion page |
| Audit técnico: Core Web Vitals score 90+ en todas las páginas marketing | Performance |
| Run Sistrix/Ahrefs análisis competitivo → ajustar páginas | Position improvements |
| Pitchear 3 podcasts hospitality: "Hotel Marketing Podcast", "Heads in Beds" | Audio authority |

**Resultado esperado:** Top-3 en queries B2B hospitality MX. 100+ orgánico/mes. 5+ leads inbound/mes.

---

## Métricas a trackear cada semana

### Métricas de visibilidad
- Position en Google para 10 queries B2B (tracked vía Search Console)
- Position en ChatGPT / Claude / Perplexity (manual check cada lunes)
- Domain Rating Ahrefs/SEMrush (mensual)
- Indexed pages count (Search Console)
- Backlinks totales (Ahrefs)

### Métricas de conversión
- Form submissions del `/marketing-intake`
- Direct LinkedIn DMs
- Email inquiries a `info@ivaestudios.com`
- Site visits (GA4)
- Bounce rate per landing page

### Métricas B2B
- Clutch profile views
- LinkedIn page followers
- Behance project saves
- Pinterest impressions

---

## Top 10 keywords objetivo (top-3 target)

### Español

1. agencia social media hotel boutique Cancún
2. manejo Instagram hotel Riviera Maya
3. agencia marketing hospitalidad lujo México
4. social media para restaurante lujo
5. agencia content creation hotel México
6. fotografía editorial + redes sociales hoteles
7. agencia TikTok hoteles México
8. manejo redes sociales clínica dental Cancún
9. marketing redes sociales spa Riviera Maya
10. agencia Instagram hoteles boutique

### English

11. social media agency luxury hotel Cancún
12. Instagram management boutique hotel Mexico
13. content creation agency luxury hospitality Mexico
14. luxury hotel Instagram strategy Cancún
15. social media agency Riviera Maya
16. TikTok agency hotels Mexico
17. hospitality marketing agency Mexico
18. dental clinic social media agency Cancún
19. luxury wellness social media Mexico
20. Mayakoba Instagram agency

---

## Stack de herramientas (todas free tier OK)

| Herramienta | Para qué | Costo |
|---|---|---|
| Google Search Console | Tracking rankings | Free |
| Google Analytics 4 | Tracking conversiones | Free |
| Bing Webmaster Tools | Bing/Yandex rankings | Free |
| Ahrefs Webmaster Tools | Backlinks gratis | Free |
| Resend | Email pipeline | Free 3K/mo |
| Cloudflare Turnstile | Anti-bot | Free unlimited |
| Cloudflare Pages | Hosting | Free |
| Cloudflare Pages Functions | Backend | Free 100K req/day |
| Buffer Free | Scheduling LinkedIn | Free 3 channels |
| Loom | Case study videos | Free |
| Canva Pro | Mockups (Vianey ya tiene) | Existing |

---

## Riesgos + mitigaciones

| Riesgo | Mitigación |
|---|---|
| Clutch rechaza por falta de referencias | Tener 5 listas antes de submit |
| Resend hits 3K/mo free tier | Plan paga $20/mo si pasa, o switch a Cloudflare Email Workers |
| GBP rechaza categoría "SMM Agency" | Apelar con documentación + RFC fiscal |
| Competencia copia las páginas industry | Mover rápido, sin advertir competencia |
| Owner ausente para approvals | Pre-aprobar batch de 4 contenidos por semana |
| Confusión IVAE Studios vs IVAE Marketing | Cada activo debe decir explícitamente "IVAE Marketing" en H1 |

---

## El plan en una frase

**Semanas 1-2:** Infraestructura B2B + 8 directory submissions.
**Semanas 3-4:** Trade press + LinkedIn + reviews.
**Mes 2:** Outreach a hoteles + content cluster + reviews.
**Mes 3:** Top-3 visibility consolidada + caso de éxito convertido.

Es ambicioso pero realizable porque:
1. La base técnica ya está al 100%
2. La diferenciación (estudio fotográfico editorial + SMM) es genuinamente única
3. El mercado de hospitality SMM en MX está sub-servido por agencias generalistas
4. El stack hospitality vertical en MX no tiene competidor con esa combinación
