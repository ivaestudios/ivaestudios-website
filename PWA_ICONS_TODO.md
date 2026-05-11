# PWA Icons — Vianey to upload

The PWA manifest references these icon files at the repo root. They
don't exist yet. Generate them from /icon-512.png (already exists per
schema) or from the IVAE logo SVG, then commit:

| Filename | Size | Purpose |
|---|---|---|
| /icon-192.png | 192×192 | Android home screen, shortcuts |
| /icon-512.png | 512×512 | Android splash screen |
| /icon-512-maskable.png | 512×512 | Adaptive icon (safe area 80% center) |
| /apple-touch-icon.png | 180×180 | iOS home screen |

Generate via https://realfavicongenerator.net or any image tool.
Until uploaded, browsers fall back to /favicon.ico and the manifest
will warn in DevTools but won't break anything.

Cloudflare Pages auto-serves them once committed at the repo root.
