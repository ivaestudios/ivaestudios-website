export const meta = {
  name: 'ivae-fix-content',
  description: 'Conservative fix wave: remove user-facing placeholders/fabricated content, fix canonicals/hreflang, de-leak ES pages — each agent owns disjoint files',
  phases: [
    { title: 'Fix', detail: 'one corrector per disjoint file cluster' },
    { title: 'Verify', detail: 're-scan that placeholders are gone' },
  ],
}

const ROOT = '/Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted';

const RULES = `
HARD RULES (a senior editor would enforce):
- NEVER fabricate facts, press coverage, testimonials, names, dates, awards, or stats. If content is a placeholder or unverifiable, REMOVE it or replace with honest, generic-but-true copy — do not invent specifics.
- Preserve ALL <head> metadata, JSON-LD <script type=application/ld+json> blocks, canonical, and hreflang UNLESS the task is explicitly to fix them.
- Keep edits minimal and surgical. Do not restructure pages or change design.
- Match the page's language exactly (ES pages -> Spanish, EN -> English). Vianey = "Directora" (ES) / "Director" (EN).
- After editing, the page must remain valid HTML (balanced tags). Verify with grep that the target string is gone.
- Work only on the files in YOUR scope. Do not touch other files.
Return exactly what you changed with file:line evidence.
`;

const SCHEMA = {
  type: 'object',
  required: ['cluster', 'filesChanged', 'changes'],
  properties: {
    cluster: { type: 'string' },
    filesChanged: { type: 'number' },
    changes: { type: 'array', items: { type: 'object', required: ['file', 'what'], properties: {
      file: { type: 'string' }, what: { type: 'string' }, evidence: { type: 'string' } } } },
    notes: { type: 'string' },
  },
};

const CLUSTERS = [
  {
    key: 'venue_related_en',
    task: `EN venue pages: ls venues/ then open each venues/*/index.html. Several render a VISIBLE developer placeholder in the "Related venues / cluster pages" section, literally e.g. "Will be auto-populated by scripts/build_internal_links.py (leave empty for now)" or a "Coming soon." stub. For EACH affected file: replace that placeholder with 2-4 REAL related-venue links chosen from the OTHER venues that exist under venues/ (use their real index URLs and human venue names). If you cannot confidently build real links, instead REMOVE the entire placeholder .venue-related section cleanly. Never leave build-script jargon or "Coming soon" visible.`,
  },
  {
    key: 'venue_related_es',
    task: `ES venue pages: ls es/locaciones/ then open each es/locaciones/*/index.html. Same defect in Spanish: "Será autopoblado por scripts/build_internal_links.py (dejar vacío por ahora)." or "Próximamente." in the "Locaciones relacionadas" section. Replace with 2-4 real related-venue links from the other es/locaciones/* pages (Spanish names + real ES URLs), or cleanly REMOVE the placeholder section. Never leave build jargon visible. Spanish only.`,
  },
  {
    key: 'press_pages',
    task: `Press/media pages: post-ivae-studios-press-media-coverage.html and es/blog/ivae-studios-prensa-cobertura-medios.html. They ship FABRICATED-looking press coverage: named outlets (Vogue, Brides, Hello!) paired with "Pending"/"Pending Real Feature"/"TBD"/"Pendiente" badges and non-clickable placeholder "links". This is a credibility/legal risk. Fix conservatively: REMOVE any specific outlet claim that is marked pending/placeholder, and remove all "Pending/TBD/Pendiente" badges and dead placeholder links. Keep only genuinely true, non-specific copy (e.g. "press inquiries welcome"). Do NOT invent real coverage. The page should read as honest (e.g. an open press-kit / "for press" page) rather than claiming features that have not happened.`,
  },
  {
    key: 'marketing_placeholders',
    task: `Marketing content placeholders. Files: post-restaurant-social-media-mexico-2026.html (a visible <h2> literally starts with "Case study placeholder"); social-media-dental-clinic-mexico.html and es/redes-sociales-clinica-dental-mexico.html (a visible testimonial/case-study attribution line renders the INTERNAL placeholder text). Also grep these + any sibling SMM landing/post for visible "placeholder"/"Case study placeholder"/"[ ]" stubs. Replace each visible placeholder with honest generic copy appropriate to the section (e.g. a real section heading, or remove the fake testimonial entirely). Never invent a named client testimonial. Match page language.`,
  },
  {
    key: 'cenote_testimonials',
    task: `cenote-photographer-tulum.html renders VISIBLE placeholder testimonial attributions in its "Words from the Water" (or similar) testimonial section (e.g. bracketed placeholder names / generic stand-ins). Remove the fake/placeholder attributions or the placeholder testimonial cards entirely so no stand-in/placeholder text is visible to users. Do not invent real client names. Keep the rest of the page intact (its body class was just changed to "has-bottom-tabs"; do not re-add ivm-page).`,
  },
  {
    key: 'canonicals_hreflang',
    task: `SEO meta fixes. (A) Canonical mismatch: several IVAE Marketing blog posts (post-dental-clinic-social-media-mexico.html, post-luxury-hospitality-content-strategy-mexico.html, post-restaurant-social-media-mexico-2026.html, post-spa-wellness-social-media-mexico.html, post-tiktok-for-luxury-hotels-mexico.html) set <link rel=canonical> to a /post-… URL, but the sitemap.xml + _redirects use the /blog/<slug> form. First CONFIRM the convention by grepping sitemap.xml for these slugs, then update each canonical (and og:url if present) to the /blog/<slug> form that the sitemap uses. (B) Missing hreflang: post-anniversary-photography-cancun-mexico.html, post-jewish-wedding-photographer-mexico.html, post-micro-wedding-photographer-cancun-tulum.html, post-newborn-photography-cancun-resorts.html lack a <link rel=alternate hreflang=es> even though they link to an ES counterpart — add the correct hreflang alternate pair (en + es + x-default) ONLY if a real ES counterpart file exists (verify it exists before adding). Do not change anything else.`,
  },
  {
    key: 'es_leakage',
    task: `Spanish-page English leakage (do NOT touch es/index.html — it is owner-protected). Fix es/manejo-redes-sociales.html: a VISIBLE primary CTA and a section subtitle contain English phrases on this Spanish page — translate the leaked English to natural Mexican Spanish (keep meaning + any links). Then grep other es/ service pages (es/fotografo-bodas-destino-mexico.html, es/fotos-familiares-lujo-cancun.html, es/fotografia-parejas-mexico.html, es/editorial-de-lujo.html) for obvious visible English UI strings (button labels, "Read more", "Learn more") and translate those too. Only translate clearly-English visible UI/body strings; leave proper nouns, brand names, and code alone.`,
  },
];

phase('Fix');
const results = await parallel(CLUSTERS.map(c => () =>
  agent(
    `You are a senior web editor fixing the IVAE website (cwd: ${ROOT}).\n` +
    `Cluster: ${c.key}\nTask: ${c.task}\n` + RULES,
    { label: `fix:${c.key}`, phase: 'Fix', schema: SCHEMA }
  ).then(r => r || { cluster: c.key, filesChanged: 0, changes: [], notes: 'no result' })
));

phase('Verify');
const verify = await agent(
  `Verify the IVAE fix wave (cwd: ${ROOT}). Run these greps and report counts (each should now be ~0 in user-visible content):\n` +
  `1) grep -rn "auto-populated\\|autopoblado\\|build_internal_links\\|Case study placeholder\\|Pending Real Feature\\|Próximamente\\.\\|Coming soon\\." across *.html (excluding -preview).\n` +
  `2) grep for visible "Pending"/"TBD"/"Pendiente" badges in the two press pages.\n` +
  `3) Confirm the 5 SMM posts' canonical now uses /blog/<slug> (matches sitemap.xml).\n` +
  `4) Confirm balanced <script> tags in every file that was edited (count <script> vs </script>).\n` +
  `Report any remaining placeholder occurrences with file:line, and any tag imbalance.`,
  { label: 'verify', phase: 'Verify', schema: {
    type: 'object', required: ['remainingPlaceholders', 'canonicalsOk', 'tagBalanceOk', 'detail'],
    properties: {
      remainingPlaceholders: { type: 'number' },
      canonicalsOk: { type: 'boolean' },
      tagBalanceOk: { type: 'boolean' },
      detail: { type: 'string' },
    } } }
);

return { fixed: results.filter(Boolean).map(r => ({ cluster: r.cluster, files: r.filesChanged, changes: (r.changes || []).length })), verify };
