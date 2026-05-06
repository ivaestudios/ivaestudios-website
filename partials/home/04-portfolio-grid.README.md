# 04-portfolio-grid.html — slot conventions

Editorial 9-tile portfolio grid (3×3 desktop, 2-col tablet, 1-col mobile). Reads as a single editorial spread, **not** a thumbnail wall. EN + ES blocks ship in one partial; Agent 30 picks one per locale.

## Tile pattern
```
[ image-1 ] [ image-2 ] [ TYPE-1  ]
[ image-3 ] [ TYPE-2  ] [ image-4 ]
[ image-5 ] [ image-6 ] [ CTA     ]
```
| # | Class | Notes |
|---|---|---|
| 1 | `--image` | Cancún · Couples · 2025-06 (Marina blue) |
| 2 | `--image` | Cancún · Family · 2025-08 (Open shade) |
| 3 | `--type-1` | navy · gold italic · «Direction over moments.» |
| 4 | `--image` | Riviera Maya · Couples · 2025-07 |
| 5 | `--type-2` | sand · navy italic · «The light, considered.» / «La luz, considerada.» |
| 6 | `--image` | Riviera Maya · Editorial · 2025-09 |
| 7 | `--image` | Los Cabos · Couples · 2025-04 (Golden hour) |
| 8 | `--image` | Cancún · Weddings · 2025-10 |
| 9 | `--cta` | deep-atlantic · gold Æ + ↗ → `/portfolio` (Oleada 3) |

## Image curation
All 6 slots filled from `images/` (four light registers per BRAND.md §8). No TODO placeholders. Files: `couple-session-canc-n-beach-`, `family-session-canc-n-pier-`, `couple-session-riviera-maya-`, `editorial-session-riviera-maya-resort-`, `los-cabos-sunset-session-`, `wedding-reception-outdoor-canc-n-` (`*-ivae-studios.jpg`). Higher-res crops can be added via `<source srcset>` — markup is already `<picture>`.

## Lightbox shortcuts
| Key | Action |
|---|---|
| `Enter` / `Space` on tile | open |
| `Esc` | close |
| `ArrowLeft` / `ArrowRight` | prev / next |
| `Tab` / `Shift+Tab` | trapped in dialog |

Focus restored to originating tile on close. `role="dialog"`, `aria-modal="true"`. Body scroll-locked while open. Pair with `styles/_home-portfolio.css` and `js/home-portfolio.js`.
