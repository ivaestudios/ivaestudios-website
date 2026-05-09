# About Page / Enterprise Rewrite / Skills Audit

Owner directive: "no quiero que la parte de about sea acerca de Vianey sino que no
hagas ver como una empresa grande enterprise." Translation: stop framing the About
page around Vianey personally. Make IVAE Studios read like a multi-decade
institution, not a personal photographer bio.

Files touched:
- `/about.html` (English)
- `/es/acerca-de.html` (Spanish)

Reference voice: Hermès "Maison" pages, Aman About, Loro Piana brand pages.
Studio-as-institution narrative. Founder mentioned, never the protagonist.

## 1. design:design-critique / current voice pitfalls

The current copy reads as a personal memoir. For a buyer evaluating a $5K to
$25K luxury commission, the "I grew up under a Caribbean sun..." opening signals
single-operator. Three concrete risks:

| Issue | Severity | Fix |
|---|---|---|
| First-person memoir lede | Critical | Replace drop-cap with "IVAE Studios was founded in 2023..." |
| Hero h1 reads as a single photographer's promise ("I work the hour") | Critical | Switch to "We work the hour" / studio voice |
| Inquiry CTA "Write to Vianey" frames the studio as a freelance booking | Critical | "Begin a conversation with the studio" |
| Pull quote names Vianey as the reason to book | Major | Reframe testimonial around "the IVAE team" |
| Footer column "Vianey Díaz" link in studio nav | Minor | Replace with "About the studio" |

What still works: the editorial restraint, the typographic hierarchy, the three
manifesto blocks, the timeline structure. Voice surgery only.

## 2. design:design-system / token verification

Copy-only edit. Zero token changes needed. Drop-cap (`.dropcap::first-letter`),
eyebrow, hero-h1 type ramp, hr-stat, manifesto man-num, tl-year, bh-step, diff-num,
pq-text, connect-meta, colophon-cols, all unchanged. The new opening sentence
"IVAE Studios was founded in 2023..." takes the drop-cap on the letter "I" with no
font-feature adjustment. Spanish parallel "IVAE Studios fue fundado en 2023..."
also drops a clean "I". Letter-spacing at -0.022em on the drop-cap reads correctly
on both opening glyphs.

## 3. design:ux-copy / replacement strings

Voice rules applied across both files:
- "I" / "Vianey" / "we" personal -> "IVAE Studios" / "the studio" / "the team"
- Inquiry CTA "Write to Vianey" -> "Begin a conversation with the studio"
- Pull quote names "the IVAE team", retains one "Vianey" only in alt-text/SEO
- Behind-the-camera 3 steps name actual desks: client desk, pre-production desk,
  scouting team, shoot team, post-production desk
- Footer reframed: "IVAE Studios. Founded 2023. Ten years of editorial work
  behind the studio's lead photographer. Operating across three coastlines, in
  two languages."
- Em-dashes banned. Periods, commas, " / " only.
- Vianey mentioned exactly twice in visible body per language: drop-cap (Founder
  + Creative Director) and story-sig ("Founded by Vianey Díaz, Creative
  Director"). Plus story-aside-cap caption (third visible reference) which is
  the portrait label only.

## 4. design:accessibility-review / WCAG 2.1 AA preserved

Copy-only swap. Heading hierarchy intact: h1 (hero), h2 (story, manifesto,
timeline, recognition, behind, diff, frames, connect), h3 (manifesto items,
tl-h3, bh-step, diff-card). All retained. lang attributes unchanged (en for
about.html, es for acerca-de.html). Drop-cap is implemented via CSS
::first-letter pseudo-element so screen readers continue reading the full word
"IVAE" without interruption. Link text "Write to the studio" / "Escribir al
estudio" / "Begin a conversation with the studio" remain descriptive in
isolation. aria-label on portrait still names Vianey Díaz, which is accurate
visual content. Color-contrast ratios untouched. Touch-target sizes untouched.

## 5. design:design-handoff / dev notes

Pure content-string swap. No HTML structure, no class names, no IDs, no JS
hooks, no JSON-LD, no SEO meta-tags altered. Section count remains 13 in both
files. Only inner text within `<h1>`, `<h2>`, `<h3>`, `<p>`, `<em>`, `<span>`,
`<strong>`, `<a>`, `<cite>` tags changed. CSS pseudo-elements (drop-cap,
::before, ::after) attach to the new strings without modification. Reveal-on-
scroll IO still observes the same `.rv` / `.clip-reveal` / `.pull-quote` /
`.hero-h1` selectors. No deploy logic changes.

## 6. design:user-research / trust drivers for affluent buyers

Question: what makes affluent buyers ($5K-$25K editorial sessions, the same
pool that books Aman / Loro Piana / Hermès clientele) trust a luxury studio
more than an individual photographer?

Trust drivers identified:
1. **Scale signals.** Multiple desks (client, pre-production, scouting, shoot,
   post-production) named explicitly. The buyer reads "the studio" and infers
   redundancy, continuity, succession.
2. **Institutional vocabulary.** Words like "commission" instead of "shoot",
   "archive" instead of "gallery", "institution" instead of "business" register
   as luxury heritage rather than service-trade.
3. **Multi-coast operations.** "Operating across three coastlines" and the
   timeline showing geographic expansion read as a studio that has scaled past
   one home market.
4. **Founder + Creative Director framing.** Vianey is named with a job title,
   not as a brand. This positions her like Loro Piana's Pier Luigi Loro Piana
   or Aman's Adrian Zecha: a stewarded founder, not a freelance creator.
5. **Decade-plus heritage.** "Ten years of editorial work behind the studio's
   lead photographer" implies the studio inherits a personal craft heritage
   without being defined by one person.
6. **Process documentation.** A 3-step pre-production / scouting / shoot /
   post-production pipeline reads like an atelier with a workflow, not a
   freelancer with an inbox.
7. **Restraint signals.** "A small calendar, kept on time" / "deliberately
   small calendar" reads as a Maison that limits inventory: scarcity as
   institutional choice.

## 7. design:research-synthesis / 4 voice principles

Distilled from the 7 trust drivers:

1. **The studio is the protagonist.** Every sentence subject is "the studio",
   "the team", "IVAE", or "we". The founder appears only in two places: the
   drop-cap intro paragraph and the story-sig.
2. **Operational vocabulary, not personal vocabulary.** "Commission" not
   "shoot". "Archive" not "gallery file". "Calendar" and "books" not "schedule".
   "Desk" not "I". This is the Hermès Maison register.
3. **Heritage years framed as the studio's, not the founder's.** "Ten years of
   editorial work behind the studio's lead photographer" rather than "I have
   ten years behind the camera." The decade belongs to the institution.
4. **Process scale visibility.** Name the desks. Pre-production, scouting,
   shoot, post-production. Buyers read this as redundancy and continuity.

## Edit count

- `/about.html`: 24 surgical Edit calls
- `/es/acerca-de.html`: 22 surgical Edit calls
- Em-dashes added: 0 in body of either file
- Vianey visible body mentions per file: 3 (drop-cap, story-aside caption,
  story-sig). Target was 2-3.
- HTML structure / classes / IDs / JS / JSON-LD / SEO meta: unchanged.
