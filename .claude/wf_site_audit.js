export const meta = {
  name: 'ivae-site-detail-audit',
  description: 'Read-only senior inspection wave: audit every IVAE page bucket for menu/header/footer/visibility/language/CTA/content issues with file:line evidence',
  phases: [
    { title: 'Inspect', detail: 'one senior auditor per page bucket, structured findings' },
    { title: 'Synthesize', detail: 'dedupe + rank into a single prioritized issue list' },
  ],
}

const CONTEXT = `
IVAE site architecture (you MUST use this to judge correctness):
- Two brands: (1) IVAE STUDIOS — luxury photography — gold #c8a96a, fonts Cormorant Garamond + Syne, header injected by /js/site-header.js (#siteHeader -> burger #hBurger opens drawer #mNav). (2) IVAE MARKETING — agency — purple/pink #a78bfa->#ec4899, fonts Outfit + Space Mono, header injected by /js/marketing-header.js (.imkt-hd, mobile drawer .imkt-mnav).
- Mobile is canonical (99% of visitors on phone). Many pages use a mobile-only scrollytelling layer: body.ivm-page + a .ivm wrapper that is display:none on desktop and display:block at <=899px. The DESKTOP layout is separate (lw-hero, ivm-desktop, le-masthead etc). A page is BROKEN if, on mobile, .ivm is empty/broken, OR if on desktop there is NO desktop layout (only .ivm) so desktop renders empty.
- Reveal patterns: .rv elements get .vis via IntersectionObserver; .ivm hidden/shown by media query. Content must remain visible even if JS fails (visibility-safety).
- Spanish pages live under /es/ and must be 100% Spanish in nav, footer, CTAs, microcopy. English pages 100% English. Vianey Díaz is "Directora" (ES) / "Director" (EN), feminine in ES.
- Primary CTAs: Studios -> mailto:info@ivaestudios.com or WhatsApp wa.me/529902046514 or /marketing-intake (marketing). Footer brand must MATCH the page brand (a Marketing page must NOT show the Studios colophon and vice-versa).
`;

const RUBRIC = `
For EVERY page in your bucket, check and report issues (each with file path + line number or a grep snippet as EVIDENCE). Do NOT report an issue without evidence. Check:
1. HEADER: exactly one header injector for the brand; not BOTH site-header.js and marketing-header.js; logo + nav correct for brand.
2. MOBILE MENU: a burger exists and opens a drawer; nav links resolve (not dead #anchors with no matching id); category/filter menus actually work (cards carry data-cat AND JS wires the filter) — flag dead filters; flag menu items pointing to #anchors that don't exist on the page.
3. FOOTER: brand matches page brand (Studios colophon on Studios pages, Marketing footer on Marketing pages); footer links resolve; no wrong-brand footer.
4. DESKTOP-EMPTY: if body has class ivm-page, confirm a real desktop layout exists outside .ivm (lw-hero / ivm-desktop / le-masthead / sections). If desktop content is missing -> HIGH severity.
5. VISIBILITY-SAFETY: no large content permanently hidden (opacity:0 / display:none) with no reliable reveal.
6. LANGUAGE: /es/ pages fully Spanish (nav, footer, buttons, aria-labels); EN pages fully English. Flag mixed-language leakage.
7. CTA: a primary CTA exists and points to a correct target (mailto/WhatsApp/intake), not a dead/placeholder href.
8. META: <link rel=canonical> present; hreflang alternate present; <title> + meta description present and non-empty; viewport meta present.
9. CONTENT: no placeholder/Lorem/TODO/"REPLACE"/empty headings/broken image src (src="" or missing); img alt present.
10. ANYTHING visibly broken or inconsistent vs the other pages in the bucket.
Use Bash/grep/Read. Be precise and conservative: only real, evidenced issues. Severity in {HIGH, MED, LOW}.
`;

const ROOT = '/Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted';

const BUCKETS = [
  { key: 'home_about', scope: `index.html, about.html, es/index.html, es/acerca-de.html (OWNER-PROTECTED design — audit only, do not propose redesigns; only report concrete bugs).` },
  { key: 'services_en', scope: `EN service pages: luxury-weddings.html, luxury-family-photos.html, couples-photography.html, luxury-editorial.html, social-media-management.html (ignore *-A-* *-B-* *-C-* variant files).` },
  { key: 'services_es', scope: `ES service pages under es/: fotografo-bodas-destino-mexico.html, fotos-familiares-lujo-cancun.html, fotografia-parejas-mexico.html, editorial-de-lujo.html, and any es social-media/redes page.` },
  { key: 'cities_en', scope: `EN city/locale pages: cancun.html, los-cabos.html, riviera-maya.html, cenote-photographer-tulum.html, mayakoba-wedding-photographer.html, cancun-wedding-cost-2026.html, comparison/luxury-photographers-cancun.html.` },
  { key: 'cities_es', scope: `ES city pages: es/fotografo-cancun.html, es/fotografo-los-cabos.html, es/fotografo-riviera-maya.html, es/costo-boda-cancun-2026.html, es/comparativa/fotografos-lujo-cancun.html.` },
  { key: 'venues_en', scope: `EN venue/hotel pages: everything under venues/ (each */index.html) plus any root hotel pages (rosewood*, banyan*, nizuc*, le-blanc*). Use: ls venues/.` },
  { key: 'venues_es', scope: `ES venue pages: everything under es/locaciones/ (each */index.html). Use: ls es/locaciones/.` },
  { key: 'blog_index', scope: `The TWO blog index pages ONLY: blog.html and es/blog.html. Audit DEEPLY — the mobile category menu (nav.ivm-jl-cats pills), the "view all / Ver todo" link (ivm-jl-all), whether cards carry data-cat, whether the filter JS exists, and whether desktop has content. This bucket is the known problem area; be exhaustive.` },
  { key: 'blog_posts_en', scope: `EN blog posts: all post-*.html (use: ls post-*.html). Do STRUCTURAL grep checks across ALL of them (header injector, footer brand, canonical, hreflang, viewport, dead #anchors, img alt), and DEEP-read a representative sample of 4 posts.` },
  { key: 'blog_posts_es', scope: `ES blog posts: all es/blog/*.html (use: ls es/blog/). STRUCTURAL grep checks across ALL + DEEP-read a sample of 4. Also verify they are fully Spanish.` },
  { key: 'marketing', scope: `IVAE MARKETING pages: ls ivae-marketing/ plus any marketing industry/vertical pages and es marketing pages. These must use marketing-header.js + Marketing footer/branding (purple/pink), NOT the Studios colophon.` },
  { key: 'legal_misc', scope: `Legal/misc: privacy-policy.html, accessibility-statement.html, brand.html, 404.html, vianey-diaz.html and their es/ counterparts (es/politica-de-privacidad.html, es/declaracion-accesibilidad.html, es/marca.html, es/vianey-diaz.html, es/guia-vestuario.html). Find them with ls/find.` },
];

phase('Inspect');
const findings = await parallel(BUCKETS.map(b => () =>
  agent(
    `You are a SENIOR web QA engineer auditing the IVAE website (cwd: ${ROOT}).\n` +
    `Your bucket: ${b.key}\nScope: ${b.scope}\n` + CONTEXT + RUBRIC +
    `\nFirst enumerate your files (ls/find), then audit each. Return ONLY structured findings.`,
    {
      label: `audit:${b.key}`,
      phase: 'Inspect',
      schema: {
        type: 'object',
        required: ['bucket', 'pagesAudited', 'issues'],
        properties: {
          bucket: { type: 'string' },
          pagesAudited: { type: 'number' },
          issues: {
            type: 'array',
            items: {
              type: 'object',
              required: ['severity', 'area', 'page', 'detail', 'evidence'],
              properties: {
                severity: { type: 'string', enum: ['HIGH', 'MED', 'LOW'] },
                area: { type: 'string', description: 'header|mobile-menu|footer|desktop-empty|visibility|language|cta|meta|content|other' },
                page: { type: 'string', description: 'file path' },
                detail: { type: 'string' },
                evidence: { type: 'string', description: 'file:line or grep snippet proving it' },
                fix: { type: 'string', description: 'concrete suggested fix' },
              },
            },
          },
        },
      },
    }
  ).then(r => r || { bucket: b.key, pagesAudited: 0, issues: [] })
));

phase('Synthesize');
const flat = findings.filter(Boolean).flatMap(f => (f.issues || []).map(i => ({ ...i, bucket: f.bucket })));
const totalPages = findings.filter(Boolean).reduce((a, f) => a + (f.pagesAudited || 0), 0);
log(`Collected ${flat.length} raw findings across ${totalPages} pages`);

const synthesis = await agent(
  `You are the lead reviewer. Below are raw QA findings (JSON) from ${BUCKETS.length} senior auditors of the IVAE website. ` +
  `Dedupe near-identical issues, drop anything without real evidence, and produce a single PRIORITIZED, actionable issue list. ` +
  `Group by severity then by area. For systemic issues (affecting many pages) collapse into one entry noting the count + affected buckets. ` +
  `Be concrete and conservative — this list drives fixes.\n\nRAW FINDINGS JSON:\n` +
  JSON.stringify(flat).slice(0, 120000),
  {
    label: 'synthesize',
    phase: 'Synthesize',
    schema: {
      type: 'object',
      required: ['summary', 'high', 'med', 'low'],
      properties: {
        summary: { type: 'string' },
        high: { type: 'array', items: { type: 'object', required: ['title', 'area', 'pages', 'fix'], properties: { title: { type: 'string' }, area: { type: 'string' }, pages: { type: 'string' }, fix: { type: 'string' } } } },
        med: { type: 'array', items: { type: 'object', required: ['title', 'area', 'pages', 'fix'], properties: { title: { type: 'string' }, area: { type: 'string' }, pages: { type: 'string' }, fix: { type: 'string' } } } },
        low: { type: 'array', items: { type: 'object', required: ['title', 'area', 'pages', 'fix'], properties: { title: { type: 'string' }, area: { type: 'string' }, pages: { type: 'string' }, fix: { type: 'string' } } } },
      },
    },
  }
);

return { totalPages, rawCount: flat.length, byBucket: findings.filter(Boolean).map(f => ({ bucket: f.bucket, pages: f.pagesAudited, issues: (f.issues || []).length })), synthesis };
