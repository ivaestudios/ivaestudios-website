# Contact page · partial folder

Owner: Agent 14 (Oleada 3)
Files shipped by this agent:

- `/contact.html`            (English)
- `/es/contacto.html`        (Spanish — pretty URL `/es/contacto`)
- `/styles/_contact.css`     (page-specific layout)
- `/js/contact-form.js`      (~120 lines, vanilla)

## Backend handler — Oleada 5

The form on both pages posts to `/api/contact`. **The endpoint
itself is added in Oleada 5** as a Cloudflare Pages Function under
`functions/api/contact.js`.

Until then the form fails gracefully:

1. With JS enabled — `js/contact-form.js` catches the non-200
   response and shows an inline error banner offering WhatsApp /
   email instead. No data is lost in the air; the user always
   has a way through.
2. With JS disabled — the browser performs the native POST and
   currently lands on a 404. Today this is the documented price
   for keeping the contact page live before Oleada 5 ships.

## Schema

The page-level JSON-LD includes:

- `WebPage` with `@type: ContactPage` linkage.
- `ContactPoint` with `contactType: "Customer Inquiry"`,
  `availableLanguage: ["en", "es"]`, `email` and `telephone`.
- `BreadcrumbList`: Home → Contact.

## Honeypot

The `input[name="website"]` field is a honeypot. Real users never
see it (visually-hidden via `.field--honeypot` in `_forms.css`);
bots fill it. Both the JS handler and any backend MUST drop
submissions whose `website` field is non-empty.
