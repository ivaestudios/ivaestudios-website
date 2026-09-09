// ============================================================================
// IVAE Marketing — La pantalla de acceso, en ingles.
//
// El resto de la app cambia de idioma con el interruptor ES|EN (i18n.js), pero
// ESTA pantalla estaba escrita en espanol a fuego. Se descubrio preparando el
// video para la revision de Meta: su norma exige que la interfaz del video
// este en INGLES, y el video empieza justo aqui. Cinco rechazos seguidos.
//
// Mismo interruptor que el resto: ?lang=en en la direccion, o 'mkt_lang' en
// localStorage. No traduce nada si el idioma es espanol.
//
// Traduce texto visible, placeholder, aria-label y title. Se busca por el
// texto EXACTO en espanol: si alguien cambia una frase del HTML, aqui deja de
// traducirse (y se ve en espanol), que es mejor que romper la pantalla.
// ============================================================================

(function () {
  var esIngles = false;
  try {
    if (/[?&]lang=en\b/.test(location.search)) { localStorage.setItem('mkt_lang', 'en'); esIngles = true; }
    else if (/[?&]lang=es\b/.test(location.search)) { localStorage.removeItem('mkt_lang'); }
    else { esIngles = localStorage.getItem('mkt_lang') === 'en'; }
  } catch (e) { esIngles = /[?&]lang=en\b/.test(location.search); }
  if (!esIngles) return;

  var D = {
    'Iniciar sesión': 'Sign in',
    'Calendario de contenido y aprobaciones.': 'Content calendar and approvals.',
    'Usuario o correo': 'Username or email',
    'Contraseña': 'Password',
    'Entrar': 'Sign in',
    'Olvidé mi contraseña': 'I forgot my password',
    'Enviarme el enlace': 'Send me the link',
    'Correo': 'Email',
    '¿Nueva marca? Crea tu cuenta gratis': 'New brand? Create your free account',
    'Crear mi cuenta': 'Create my account',
    'Tu nombre': 'Your name',
    'Tu marca o negocio': 'Your brand or business',
    'Crea una contraseña': 'Create a password',
    'Confirma la nueva contraseña': 'Confirm the new password',
    'Nueva contraseña': 'New password',
    'Tu contraseña es temporal. Crea una nueva para continuar.':
      'Your password is temporary. Create a new one to continue.',
    'Guardar y entrar': 'Save and sign in',
    'Configuración inicial (primera vez)': 'Initial setup (first time)',
    'Correo de administradora': 'Administrator email',
    'Crear administradora': 'Create administrator',
    'Acepto los': 'I accept the',
    'Términos de Uso': 'Terms of Use',
    'y el': 'and the',
    'Aviso de Privacidad': 'Privacy Policy',
    'Entiendo que hay': 'I understand there is',
    'tolerancia cero al contenido ofensivo y a los usuarios abusivos':
      'zero tolerance for objectionable content and abusive users',
    // placeholders y etiquetas de accesibilidad
    'Tu usuario o correo': 'Your username or email',
    'Tu contraseña': 'Your password',
    'Mostrar contraseña': 'Show password',
    'Mínimo 6 caracteres': 'At least 6 characters',
    'Mínimo 8 caracteres': 'At least 8 characters',
    'Repite la contraseña': 'Repeat the password',
    'Ana Pérez': 'Jane Smith',
    'Café Aurora': 'Aurora Cafe',
    'tu@correo.com': 'you@email.com',
  };

  function traduce() {
    // 1) Texto suelto (nodos de texto), sin tocar la estructura ni los <svg>.
    var caminante = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    var nodos = [];
    while (caminante.nextNode()) nodos.push(caminante.currentNode);
    for (var i = 0; i < nodos.length; i++) {
      var n = nodos[i];
      if (n.parentElement && /SCRIPT|STYLE|SVG/i.test(n.parentElement.tagName)) continue;
      var t = n.nodeValue.trim();
      if (t && D[t]) n.nodeValue = n.nodeValue.replace(t, D[t]);
    }
    // 2) Atributos que la persona SI ve o escucha.
    var atributos = ['placeholder', 'aria-label', 'title'];
    var todos = document.body.querySelectorAll('*');
    for (var k = 0; k < todos.length; k++) {
      for (var a = 0; a < atributos.length; a++) {
        var v = todos[k].getAttribute(atributos[a]);
        if (v && D[v.trim()]) todos[k].setAttribute(atributos[a], D[v.trim()]);
      }
    }
    document.documentElement.setAttribute('lang', 'en');
    document.title = 'Sign in · IVAE Marketing';
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', traduce);
  else traduce();
})();
