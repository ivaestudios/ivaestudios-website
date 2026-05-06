/* ============================================================
   contact-form.js
   IVAE Studios · Redesign 2026 · Oleada 3 · Agent 14
   ──────────────────────────────────────────────────────────
   Minimal, framework-free progressive enhancement for the
   /contact and /es/contacto inquiry form. With JS disabled,
   the form still posts to /api/contact (handled by Oleada 5).

   Behavior:
     · Validates required fields and email format on submit.
     · Inline .field--error + aria-invalid="true" on bad fields.
     · Disables submit + sets aria-busy="true" during request.
     · 200 OK   → replaces the form with a thank-you panel.
     · 4xx/5xx  → shows an inline banner with WhatsApp / email
                  fall-backs.
     · Honeypot (input[name="website"]): any value aborts silently.

   ARIA:
     · The error banner is rendered as role="alert" so screen
       readers announce a failed submission.
     · aria-busy on the submit button drives the spinner from
       _buttons.css (the .btn[aria-busy="true"]::after rule).
   ============================================================ */

(() => {
  const form = document.getElementById('contact-form');
  if (!form) return;

  const lang = (document.documentElement.lang || 'en').toLowerCase().startsWith('es') ? 'es' : 'en';
  const t = {
    en: {
      thankYouTitle: 'Thank you — your inquiry is in.',
      thankYouLine1: "We'll respond within 24 hours with availability and a session structure built around your dates.",
      thankYouLine2: 'In the meantime, feel free to write us on WhatsApp at +52 990 204 6514.',
      errorMissing:  'This field is required.',
      errorEmail:    'Please enter a valid email address.',
      errorConsent:  'Please confirm we can contact you.',
      errorNetwork:  "Something went wrong sending your inquiry. Please try WhatsApp or email instead — we respond fastest there.",
      btnRetry:      'Try again',
    },
    es: {
      thankYouTitle: 'Gracias — recibimos tu consulta.',
      thankYouLine1: 'Te respondemos en menos de 24 horas con disponibilidad y una estructura de sesión a la medida de tus fechas.',
      thankYouLine2: 'Mientras tanto, puedes escribirnos por WhatsApp al +52 990 204 6514.',
      errorMissing:  'Este campo es obligatorio.',
      errorEmail:    'Ingresa un correo electrónico válido.',
      errorConsent:  'Confirma que podemos contactarte.',
      errorNetwork:  'Hubo un problema al enviar tu consulta. Prueba por WhatsApp o correo — respondemos más rápido por ahí.',
      btnRetry:      'Intentar de nuevo',
    },
  }[lang];

  const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim());

  const setFieldError = (input, message) => {
    const wrapper = input.closest('.field') || input.parentElement;
    if (!wrapper) return;
    wrapper.classList.add('field--error');
    input.setAttribute('aria-invalid', 'true');
    let help = wrapper.querySelector('.field__help');
    if (!help) {
      help = document.createElement('p');
      help.className = 'field__help';
      wrapper.appendChild(help);
    }
    help.dataset.errorMessage = '1';
    help.textContent = message;
  };

  const clearFieldError = (input) => {
    const wrapper = input.closest('.field') || input.parentElement;
    if (!wrapper) return;
    wrapper.classList.remove('field--error');
    input.removeAttribute('aria-invalid');
    const help = wrapper.querySelector('.field__help[data-error-message]');
    if (help) help.remove();
  };

  form.addEventListener('input', (e) => {
    const tgt = e.target;
    if (tgt && tgt.matches('.field__input, input[type="checkbox"]')) clearFieldError(tgt);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Honeypot — bots fill this; abort silently for humans we never reach this branch.
    const trap = form.querySelector('input[name="website"]');
    if (trap && trap.value) return;

    let firstInvalid = null;
    const required = form.querySelectorAll('[required]');
    required.forEach((input) => {
      clearFieldError(input);
      const val = input.type === 'checkbox' ? input.checked : (input.value || '').trim();
      if (!val) {
        const msg = input.type === 'checkbox' ? t.errorConsent : t.errorMissing;
        setFieldError(input, msg);
        if (!firstInvalid) firstInvalid = input;
      } else if (input.type === 'email' && !isEmail(val)) {
        setFieldError(input, t.errorEmail);
        if (!firstInvalid) firstInvalid = input;
      }
    });
    if (firstInvalid) {
      firstInvalid.focus();
      return;
    }

    const submit = form.querySelector('button[type="submit"]');
    submit.setAttribute('aria-busy', 'true');
    submit.disabled = true;

    // Remove any prior error banner before retrying.
    const oldBanner = form.querySelector('.contact-form__error');
    if (oldBanner) oldBanner.remove();

    try {
      const data = new FormData(form);
      const res = await fetch(form.action || '/api/contact', {
        method: 'POST',
        body: data,
        headers: { 'Accept': 'application/json' },
      });
      if (res.ok) {
        const panel = document.createElement('div');
        panel.className = 'contact-form__thankyou';
        panel.setAttribute('role', 'status');
        panel.innerHTML =
          `<h2>${t.thankYouTitle}</h2>` +
          `<p>${t.thankYouLine1}</p>` +
          `<p>${t.thankYouLine2}</p>`;
        form.replaceWith(panel);
        panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      throw new Error('http ' + res.status);
    } catch (_err) {
      const banner = document.createElement('div');
      banner.className = 'contact-form__error';
      banner.setAttribute('role', 'alert');
      const wa = 'https://wa.me/529902046514';
      const mailto = 'mailto:info@ivaestudios.com';
      banner.innerHTML =
        `<p>${t.errorNetwork} <a href="${wa}" rel="noopener">WhatsApp</a> · <a href="${mailto}">info@ivaestudios.com</a></p>`;
      const actions = form.querySelector('.form__actions');
      if (actions) actions.parentNode.insertBefore(banner, actions);
      else form.appendChild(banner);
    } finally {
      submit.removeAttribute('aria-busy');
      submit.disabled = false;
    }
  });
})();
