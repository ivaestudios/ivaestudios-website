# 12 · Home CSS Orchestrator

Agent 12 of Oleada 2 — the homepage CSS orchestrator.

## What it is

`styles/_home.css` is to the homepage what `_legacy.css` is to legacy
pages: a single entry point that imports every section module and adds
only the rules that all sections share. Each section module
(`_home-hero.css`, `_home-manifesto.css`, …) is self-contained and uses
unique `.section--<name>` selectors, so the orchestrator stays thin.

## What it imports

Ten section modules built in parallel by Agents 02–11, top → bottom:

```
_home-hero.css         _home-manifesto.css    _home-portfolio.css
_home-services.css     _home-destinations.css _home-process.css
_home-testimonials.css _home-journal.css      _home-final-cta.css
_home-faq.css
```

## Merge expectation

When Oleada 2 lands on `feat/redesign-2026`, every section branch
(`feat/r26-2-02-hero` … `feat/r26-2-11-faq`) plus this orchestrator
(`feat/r26-2-12-home-css`) merge together — 10 modules + 1 orchestrator
produce a working homepage cascade.

## Activation

`main.css` ships with `@import "_home.css";` already active under the
`Pages` block (Activated Oleada 2). Pushing to `main` switches the
homepage onto the new modules — no follow-up edit needed.

## Shared rules (minimal)

`.section` padding rhythm, `:target` scroll-margin, fallback bg.
