# Oleada 3 · Agent 17 — CSS orchestrator

## Why this agent exists

Oleada 3 ships nine page-level CSS modules in parallel (Agents 01-16).
If every agent edited `styles/main.css`, sixteen branches would conflict
on the same import block. Agent 17 centralises that work: it adds the
`@import "_<page>.css";` lines to `main.css` ahead of the merge, so each
sibling agent only touches their own page module on their own branch.

## Merge expectation

When Oleada 3 merges into `feat/redesign-2026`, these modules land:

- `_about.css` (01) · `_bio.css` (02) · `_service.css` (03-08, shared)
- `_destination.css` (09-11, shared) · `_outfit-guide.css` (12)
- `_blog-index.css` (13) · `_contact.css` (14)
- `_portfolio.css` (15) · `_legal.css` (16)

This branch pre-stages the imports. The moment the modules merge, the
cascade lights up — no follow-up commit needed.

## What if a module file is missing?

`@import` for a non-existent file is a **silent no-op**: the browser
logs a 404, the cascade continues, the page does not break. That gives
two failure modes a graceful path:

1. **Agent ships late** — import sits dormant until their branch lands.
2. **Page dropped from scope** — comment the `@import` line out with a
   one-line note. Don't delete it; `git blame` archaeology is easier
   when the removal is visible.
