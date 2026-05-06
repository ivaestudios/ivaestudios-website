# Wikidata Seed Playbook for IVAE Studios

> Goal: create a Wikidata item for IVAE Studios so Google's Knowledge Graph picks it up as a distinct entity from ivaestudio.com.

## One-time owner action

1. Go to https://www.wikidata.org/wiki/Special:NewItem
2. Sign in (create account if needed)
3. Submit:

### Required statements

| Property | Value |
|---|---|
| `P31` instance of | `Q3257138` photography studio |
| `P17` country | `Q96` Mexico |
| `P159` headquarters location | `Q8806` Cancún |
| `P856` official website | `https://ivaestudios.com` |
| `P112` founded by | Vianey Díaz (create as separate item if not exists, instance_of `Q5` human) |
| `P571` inception | (date studio started — owner provides) |
| `P407` language of work or name | `Q1860` English, `Q1321` Spanish |

### Aliases (multilingual)

EN: IVAE, ivaestudios, IVAE Studios Mexico, IVAE Studios Cancún
ES: IVAE Estudios, IVAE

### Description

EN: "luxury resort photography studio in Cancún, Mexico"
ES: "estudio de fotografía editorial de lujo en Cancún, México"

### Sitelinks

- enwiki / eswiki: leave empty (no Wikipedia article yet)
- Add identifier: P1448 official name = "IVAE Studios"

### Disambiguation hint

Add a note to disambiguate from any "ivaestudio" item: in the Description field, include "with S" parenthetical.

## After submission

1. Wait 4-6 weeks for Google's Knowledge Graph crawler to ingest.
2. Once Wikidata Q-ID is assigned (e.g. `Q12345678`), add it to:
   - `index.html` schema `Organization.sameAs` array
   - `brand.html` schema `Brand.sameAs` array
   - `api/facts.json` field `wikidata_id`
3. Commit + push.

## Verification

- Search Google for "IVAE Studios" 4-6 weeks post-Wikidata-submission
- Knowledge Panel should appear on the right side of SERP
- Verify `ivaestudios.com` ranks above `ivaestudio.com` for the brand query
</content>
</invoke>