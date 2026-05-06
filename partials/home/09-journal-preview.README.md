# `partials/home/09-journal-preview.html` — homepage Journal preview

Three editorial cards previewing the latest entries of "The Journal" / "El Diario".
Owner: Agent 09 (Oleada 2). Wired by Agent 30. Pairs with `styles/_home-journal.css`.

## Featured posts (Mayo 2026)

| # | Slug (EN) | Slug (ES) | Category |
|---|---|---|---|
| 1 | `/blog/best-photo-locations-riviera-maya` | `/es/blog/mejores-locaciones-foto-riviera-maya` | Locations · Riviera Maya |
| 2 | `/blog/best-resorts-cancun-photography` | `/es/blog/mejores-resorts-fotografia-cancun` | Planning · Cancún |
| 3 | `/blog/cenote-underwater-photoshoot-tulum` | `/es/blog/sesion-cenote-submarina-tulum` | Signature · Tulum |

Picked for: 2 destinations covered (Riviera Maya + Cancún), 3 distinct categories
(location guide / planning / signature service), and editorial alignment with the
IVAE voice (process control, hidden spots, restraint — no "capture / moments" clichés).

## Slot convention

Each card carries an HTML comment marker:

```
<!-- POST-SLOT-1 -->
<!-- POST-SLOT-2 -->
<!-- POST-SLOT-3 -->
```

## Build / Agent-30 hook

If you want to programmatically inject the latest 3 posts, mark these slots and
write a script that reads `<title>` and the first paragraph of each
`post-*.html`. For now, the cards are hard-coded with the 3 picks above —
copy is rewritten in IVAE voice, not pulled verbatim from posts.

## Image curation TODO

Currently the cards reference the existing `assets.ivaestudios.com/blog/<slug>-og.jpg`
covers. If Agent 11 (image library) ships landscape `3:2` crops at
`/images/blog/<slug>-card.jpg`, swap the `src` on each `<img data-ivae-img>`.
Local crops have not landed yet — TODO before final cutover.
