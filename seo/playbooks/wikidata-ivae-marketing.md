# Wikidata Submission Draft. IVAE Marketing (sub-entity of IVAE Studios)

> **Goal:** Register IVAE Marketing as a distinct Wikidata item that is structurally linked to the existing IVAE Studios entity (Q139689577) via `parent organization` (P749) and `has part(s)` (P527). This gives Google's Knowledge Graph, ChatGPT search, Perplexity, and other LLM-powered discovery surfaces a clean machine-readable record of the social media management sub-brand.

> **Owner note (Vianey):** "marketing e ivaestudios son diferentes." IVAE Marketing is a sibling brand that happens to share infrastructure with IVAE Studios. Treat it as its own entity.

---

## 1. Item label

| Language | Label |
|---|---|
| en | IVAE Marketing |
| es | IVAE Marketing |

(Same brand string in both languages, no translation needed.)

---

## 2. Description (Wikidata limit: ~250 chars, recommended ~70)

| Language | Description |
|---|---|
| en | luxury hospitality social media agency in Cancún, Mexico |
| es | agencia de redes sociales para hospitalidad de lujo en Cancún, México |

Both descriptions are under 70 characters and follow Wikidata convention (lowercase, no period, noun phrase).

---

## 3. Aliases

### English aliases
- IVAE Marketing Agency
- IVAE Studios Marketing
- IVAE Marketing Cancún
- IVAE Marketing Mexico
- IVAE SMM
- IVAE Social Media

### Spanish aliases
- IVAE Marketing
- IVAE Marketing Agencia
- Agencia IVAE Marketing
- IVAE Marketing Cancún
- IVAE Marketing México

---

## 4. Statements

| Property | ID | Value | Notes |
|---|---|---|---|
| instance of | P31 | social media marketing agency (Q105756498) | Or fallback to digital marketing agency (Q1640628) |
| instance of (secondary) | P31 | business (Q4830453) | Generic backup if P31 above is too narrow |
| parent organization | P749 | IVAE Studios (Q139689577) | Key relationship link |
| country | P17 | Mexico (Q96) | |
| headquarters location | P159 | Cancún (Q8806) | |
| located in the administrative territorial entity | P131 | Quintana Roo (Q80108) | |
| inception | P571 | 2024-01-01 | Year marketing arm formally launched (placeholder, owner to confirm) |
| official website | P856 | https://ivaestudios.com/social-media-management | EN master URL |
| official name | P1448 | IVAE Marketing (en), IVAE Marketing (es) | |
| industry | P452 | social media marketing (Q1124173), digital marketing (Q1640628), hospitality industry (Q1361261) | Multi-value |
| product or material produced | P1056 | editorial photography, social media content, content marketing strategy, monthly performance reports | Free-text or linked items |
| genre / specialty | P136 | luxury hospitality marketing | Free text |
| language of work or name | P407 | English (Q1860), Spanish (Q1321) | |
| founder | P112 | Vianey Díaz (Q139689736) | Inherits founder of parent org |
| chief executive officer | P169 | Vianey Díaz (Q139689736) | Director / Creative Director |
| Instagram username | P2003 | ivae.marketing | Sub-brand handle |
| logo image | P154 | (upload to Wikimedia Commons first, then link) | See sitelinks below |
| describes a project that uses | P1535 | Instagram (Q209330), TikTok (Q63862603), Facebook (Q355) | Platform list |

---

## 5. Modifications to IVAE Studios (Q139689577)

Add the following statement on the parent item:

| Property | ID | Value |
|---|---|---|
| has part(s) | P527 | IVAE Marketing (new Q-ID once minted) |

This creates the bidirectional link between parent and sub-entity. Wikidata convention: P527 (has part) on parent + P749 (parent organization) on child.

Also confirm on parent item:
- P1056 product/service should already include "social media management". Verify and add if missing.

---

## 6. Sources / references (3 to 5 required for credibility)

Wikidata items with no sources are flagged as low quality. Each statement above should cite at least one of the following:

1. **Official website citation**
   - Reference URL (P854): https://ivaestudios.com/social-media-management
   - Title (P1476): "Social Media Management for Luxury Hospitality | IVAE Studios"
   - Publisher (P123): IVAE Studios (Q139689577)
   - Date retrieved (P813): (date of submission)

2. **Spanish master page citation**
   - Reference URL (P854): https://ivaestudios.com/es/manejo-redes-sociales
   - Title (P1476): "Manejo de Redes Sociales para Hospitalidad de Lujo | IVAE Studios"
   - Language (P407): Spanish (Q1321)

3. **AI manifest citation**
   - Reference URL (P854): https://ivaestudios.com/llms.txt
   - Title (P1476): "IVAE Studios / LLM Discovery Manifest"
   - Statement supported: brand identity, sub-organization relationship

4. **Machine-readable facts citation**
   - Reference URL (P854): https://ivaestudios.com/api/facts.json
   - Title (P1476): "IVAE Studios facts (JSON)"
   - Statement supported: structured data, services list, plans

5. **Instagram profile citation (after sub-brand IG is live)**
   - Reference URL (P854): https://www.instagram.com/ivae.marketing
   - Title (P1476): "IVAE Marketing on Instagram"
   - Publisher (P123): Meta Platforms (Q380)

---

## 7. Sitelinks targets (5 destinations)

Sitelinks connect the Wikidata item to external pages so the knowledge graph can resolve queries to specific surfaces.

| Target | URL / Path | Status |
|---|---|---|
| English Wikipedia draft | en.wikipedia.org/wiki/Draft:IVAE_Marketing | TO CREATE (after notability threshold met, est. 12-18 months) |
| Spanish Wikipedia draft | es.wikipedia.org/wiki/Borrador:IVAE_Marketing | TO CREATE (same timeline) |
| Wikimedia Commons category | commons.wikimedia.org/wiki/Category:IVAE_Marketing | TO CREATE after first logo or campaign image uploaded under CC BY-SA |
| Official website | https://ivaestudios.com/social-media-management | LIVE |
| Instagram profile | https://www.instagram.com/ivae.marketing | TO CREATE (handle to be claimed) |

Additional external identifiers to attach once available:
- Crunchbase organization ID
- LinkedIn company ID
- Google Business Profile ID (separate listing or sub-listing)
- Facebook page ID
- D-U-N-S number (if Mexico's equivalent registry applies)

---

## 8. Disambiguation hints

Inside the Description field on Wikidata, do NOT confuse with:
- **IVAE Studio** (singular, no S) at ivaestudio.com. Unrelated European agency.
- **IVAE Studios** (parent) Q139689577. The photography studio. IVAE Marketing is a sub-organization of it, not the same as it.

Add a `nature of statement` (P5102) qualifier where needed:
- On P749 parent organization → IVAE Studios: qualifier "subject of statement: marketing sub-brand"

---

## 9. Post-submission checklist

Once IVAE Marketing has a Q-ID (e.g., Q14XXXXXX):

1. Add the Q-ID to `/api/facts.json` under `marketing.wikidata_id` (replace "DRAFT - submission pending")
2. Add `https://www.wikidata.org/wiki/Q14XXXXXX` to the `sameAs` array in the Service JSON-LD on both /social-media-management and /es/manejo-redes-sociales pages
3. Add the Q-ID to the parent IVAE Studios Wikidata item via P527 (has part)
4. Update `/llms.txt` and `/llms-full.txt` with the live Wikidata link
5. Wait 4-6 weeks for Google Knowledge Graph crawler ingestion
6. Verify by searching Google for "IVAE Marketing Cancún". Knowledge panel should appear.

---

## 10. Submission steps

1. Go to https://www.wikidata.org/wiki/Special:NewItem
2. Sign in as the account that manages IVAE Studios Wikidata edits (Vianey or designated editor)
3. Fill in label / description / aliases as listed in sections 1-3 above
4. After item creation, add statements one by one with sources as listed in sections 4-6
5. Add sitelinks from section 7
6. Edit parent item Q139689577 to add P527 reference to the new sub-item
7. Save and note the new Q-ID
8. Run the post-submission checklist in section 9

---

## 11. Notability note (for English Wikipedia eventual draft)

English Wikipedia requires significant coverage in reliable, independent sources for organization articles. Build toward this by collecting:
- Trade publication mentions (Hospitality Net, Travel Weekly LATAM, Hotel Management LATAM)
- Award listings (regional marketing awards in Mexico)
- Industry citations in Mexican business press (Expansión, El Economista, Forbes México)

A draft article is realistic 12-18 months after launch with documented client portfolio.

---

Maintained by: Vianey Díaz, Directora, IVAE Studios
Last updated: May 2026
