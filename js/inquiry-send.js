/* IVAE Studios: envía las consultas de los formularios a info@ por /api/inquiry.
 *
 * Lo usan el formulario de la home (EN/ES) y la hoja de contacto del celular
 * (lwMobSheetForm) de las páginas de servicio. Antes solo abrían la app de
 * correo del teléfono y, sin app configurada, la consulta se perdía.
 * Si el servidor no responde, cae al correo del teléfono (mailto) como antes.
 *
 *   window.ivaeSendInquiry({ form, email, name, kind, lines, message, lang, mailto, status })
 */
(function () {
  'use strict';

  var T = {
    en: {
      email: 'Please add your email so we can write back.',
      sending: 'Sending your message…',
      ok: function (e) { return 'Thank you, your message is on its way. Vianey will write back to you at ' + e + '.'; },
      okTitle: 'Thank you.',
      fallback: 'We could not send it from here, so we are opening your email app with your message ready.'
    },
    es: {
      email: 'Por favor agrega tu correo para que podamos responderte.',
      sending: 'Enviando tu mensaje…',
      ok: function (e) { return 'Gracias, tu mensaje ya va en camino. Vianey te responderá a ' + e + '.'; },
      okTitle: 'Gracias.',
      fallback: 'No pudimos enviarlo desde aquí, así que abrimos tu app de correo con el mensaje listo.'
    }
  };

  function isEmail(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s); }

  function statusEl(opts) {
    if (opts.status) return opts.status;
    var form = opts.form;
    var el = form.querySelector('.ivae-inq-status');
    if (!el) {
      el = document.createElement('p');
      el.className = 'ivae-inq-status';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      el.style.cssText = 'margin:10px 0 0;font-size:14px;line-height:1.45;min-height:1.2em';
      var btn = form.querySelector('[type="submit"]');
      if (btn && btn.parentNode) btn.parentNode.insertBefore(el, btn.nextSibling);
      else form.appendChild(el);
    }
    return el;
  }

  window.ivaeSendInquiry = function (opts) {
    var t = T[opts.lang === 'es' ? 'es' : 'en'];
    var form = opts.form;
    var email = String(opts.email || '').trim();
    var st = statusEl(opts);
    var emailField = form.querySelector('input[type="email"]');
    var btn = form.querySelector('[type="submit"]');

    if (!isEmail(email)) {
      st.textContent = t.email;
      if (emailField) { emailField.setAttribute('aria-invalid', 'true'); emailField.focus(); }
      return;
    }
    if (emailField) emailField.removeAttribute('aria-invalid');
    if (btn) btn.disabled = true;
    st.textContent = t.sending;

    var fallback = function () {
      st.textContent = t.fallback;
      if (btn) btn.disabled = false;
      if (opts.mailto) setTimeout(function () { window.location.href = opts.mailto; }, 600);
    };

    var payload = {
      email: email,
      name: String(opts.name || '').trim(),
      kind: opts.kind || '',
      lines: opts.lines || [],
      message: opts.message || '',
      page: window.location.pathname,
      lang: opts.lang === 'es' ? 'es' : 'en',
      website: (form.querySelector('[name="website"]') || {}).value || ''
    };

    if (!window.fetch) { fallback(); return; }
    fetch('/api/inquiry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok && j && j.ok, j: j || {} }; });
    }).then(function (res) {
      if (res.ok) {
        /* Consulta enviada: evento clave en Google Analytics (site-header.js). */
        if (window.ivaeTrack) window.ivaeTrack('generate_lead', { form_kind: opts.kind || 'inquiry' });
        if (btn) btn.disabled = false;
        form.reset();
        if (opts.status) {
          st.textContent = t.ok(email);
        } else {
          /* Hoja del celular: el formulario se cambia por el agradecimiento. */
          var done = document.createElement('div');
          done.className = 'ivae-inq-done';
          done.setAttribute('role', 'status');
          done.setAttribute('tabindex', '-1');
          done.style.cssText = 'padding:8px 0 4px;font-size:16px;line-height:1.5';
          var h = document.createElement('p');
          h.style.cssText = 'margin:0 0 6px;font-size:22px';
          h.textContent = t.okTitle;
          var p = document.createElement('p');
          p.style.cssText = 'margin:0';
          p.textContent = t.ok(email);
          done.appendChild(h);
          done.appendChild(p);
          form.style.display = 'none';
          form.parentNode.insertBefore(done, form.nextSibling);
          try { done.focus(); } catch (e) { /* noop */ }
        }
      } else if (res.j && res.j.field === 'email') {
        if (btn) btn.disabled = false;
        st.textContent = t.email;
        if (emailField) { emailField.setAttribute('aria-invalid', 'true'); emailField.focus(); }
      } else {
        fallback();
      }
    }).catch(fallback);
  };
})();
