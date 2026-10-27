// ============================================================================
// IVAE Marketing — VISITA GUIADA INTERACTIVA (primer ingreso).
//
// Vianey (1-oct-2026): "hazme la visita guiada cuando alguien ingrese a la
// app" y "que el flujo sea muy interactivo". Cinco personas de fuera se
// registraron, entraron una vez a un calendario vacío sin que nadie les
// enseñara nada, y no volvieron.
//
// Cómo funciona: una máscara oscura con un HUECO sobre el elemento real; el
// hueco deja pasar el toque. En los pasos de ACCIÓN la visita no avanza con
// "Siguiente": avanza cuando la persona toca el elemento (abrir su marca,
// abrir el asistente de IA, abrir una pieza). Cuando esa acción abre una hoja
// o el editor, la máscara se quita (paso "libre") para que la persona la use,
// y la visita sigue sola cuando la cierra. Si un elemento no existe (mes
// vacío, sin piezas) la tarjeta sale centrada y la visita continúa.
// Se enseña UNA vez por usuario (prefs 'tourDone'); se repite desde
// Tu cuenta → Visita guiada. router/store/prefs/closeAll llegan por
// parámetro: shell.js importa este módulo y no puede haber ciclo.
// ============================================================================
import { el, esCreador } from '../api.js?v=202610262324';
import { T } from './i18n.js?v=202610262324';

export const TOUR_VERSION = 2;
let activo = null;

const esMovil = () => window.matchMedia('(max-width: 767px)').matches;
// "Capa" = hoja (#sheetHost) o el diálogo de Generar mes (IA): en los pasos
// libres la visita espera a que la persona la cierre.
const hayCapa = () => !!document.querySelector('#sheetHost .sheet, .mesia-overlay');
const anclaContenido = () => (esMovil() ? '.bn-tab[data-tab="contenido"]' : '[data-grupo="g-contenido"]');
// Escritorio: tabla con lápiz por fila. Móvil: tarjetas; se toca la tarjeta.
const SEL_ABRIR_PIEZA = '.meses-task__open, .meses-item__main';
const pistaAbrir = () => (esMovil() ? T('Toca la pieza', 'Tap the piece') : T('Toca el lápiz', 'Tap the pencil'));

// Un paso: { view?, sel?, selTexto?, accion?, libre?, sigueCuando?, titulo, texto, pista? }
//  accion: true   → avanza cuando la persona TOCA el elemento del foco.
//  libre: true    → sin máscara (la persona usa la hoja/editor que abrió).
//  sigueCuando()  → condición que, al cumplirse, avanza sola (p.ej. cerró la hoja).
function pasosEquipo() {
  const creador = esCreador();
  return [
    {
      titulo: T('Bienvenida a IVAE Marketing', 'Welcome to IVAE Marketing'),
      texto: T('Te enseño la app haciendo, no leyendo: en cada paso tocas el elemento real. Dos minutos. Puedes saltarlo y repetirlo cuando quieras desde Tu cuenta → Visita guiada.', 'You will learn the app by doing, not reading: in each step you tap the real element. Two minutes. You can skip it and replay it anytime from Your account → Guided tour.'),
    },
    {
      sel: '.tb-client', accion: true,
      titulo: T('Tu marca', 'Your brand'),
      texto: creador
        ? T('Todo lo que ves pertenece a la marca elegida aquí. Puedes llevar varias marcas o proyectos, cada uno con su calendario. Tócala para verlas.', 'Everything you see belongs to the brand chosen here. You can run several brands or projects, each with its own calendar. Tap it to see them.')
        : T('Todo lo que ves pertenece a la marca elegida aquí. Tócala para ver tus marcas.', 'Everything you see belongs to the brand chosen here. Tap it to see your brands.'),
      pista: T('Toca aquí', 'Tap here'),
    },
    {
      libre: true, empiezaCuando: () => hayCapa(), sigueCuando: () => !hayCapa(),
      titulo: T('Tus marcas', 'Your brands'),
      texto: creador
        ? T('Esta es tu lista. Cada marca tiene su calendario, sus redes y su voz. Con "Nueva marca" agregas otra. Cierra la hoja para seguir.', 'This is your list. Each brand has its own calendar, networks and voice. "New brand" adds another. Close the sheet to continue.')
        : T('Esta es tu lista. Cada cliente es una marca, con su calendario, sus redes y su propio acceso. Con "Nuevo cliente" agregas otra. Cierra la hoja para seguir.', 'This is your list. Each client is a brand, with its own calendar, networks and access. "New client" adds another. Close the sheet to continue.'),
      siguiente: T('Cerrar y seguir', 'Close and continue'),
    },
    {
      view: 'meses', sel: anclaContenido(),
      titulo: T('Contenido: el calendario', 'Content: the calendar'),
      texto: T('Aquí vive el mes de la marca: cada fila es una pieza (reel, carrusel o post). También están la Cuadrícula, el Feed, los Entregables y la Marca.', 'The brand\'s month lives here: each row is one piece (reel, carousel or post). Grid, Feed, Deliverables and Brand live here too.'),
    },
    {
      view: 'meses', sel: '.meses-iabtn', accion: true,
      titulo: T('¿Mes vacío? La IA lo arma', 'Empty month? AI builds it'),
      texto: T('Generar mes (IA) escribe de 8 a 12 piezas con guion, caption y hashtags, en la voz de la marca. Tócalo para ver el asistente; puedes cancelar.', 'Generate month (AI) writes 8 to 12 pieces with script, caption and hashtags, in the brand\'s voice. Tap it to see the assistant; you can cancel.'),
      pista: T('Toca aquí', 'Tap here'),
    },
    {
      libre: true, empiezaCuando: () => hayCapa(), sigueCuando: () => !hayCapa(),
      titulo: T('El asistente del mes', 'The month assistant'),
      texto: T('Le dices de qué va el mes y la IA escribe todas las piezas; tú corriges lo que quieras después. Hoy solo míralo: Cancelar para seguir, o genéralo de una vez si ya tienes la marca lista.', 'Tell it what the month is about and the AI writes every piece; you fix whatever you want afterwards. For now just look: Cancel to continue, or generate it right away if the brand is ready.'),
      siguiente: T('Cerrar y seguir', 'Close and continue'),
    },
    {
      view: 'meses', sel: SEL_ABRIR_PIEZA, accion: true,
      titulo: T('Abre una pieza', 'Open a piece'),
      texto: esMovil() ? T('Toca una pieza para verla completa.', 'Tap a piece to see it in full.') : T('El lápiz abre la pieza completa. Tócalo.', 'The pencil opens the full piece. Tap it.'),
      pista: pistaAbrir(),
      sinElemento: T('Cuando el mes tenga piezas, cada fila trae un lápiz que la abre completa: guion, caption, fecha, hora y redes.', 'Once the month has pieces, each row has a pencil that opens it in full: script, caption, date, time and networks.'),
    },
    {
      libre: true, cierraPieza: true, empiezaCuando: (store) => store.getState().view === 'post', sigueCuando: (store) => store.getState().view !== 'post',
      titulo: T('La pieza por dentro', 'Inside the piece'),
      texto: T('Guion, caption, fecha y hora, y las redes donde sale. Sin hora NO se publica: ponle hora y pásala a Programado, y el reloj la publica solo en Instagram, Facebook, TikTok y YouTube. Cierra la pieza para seguir.', 'Script, caption, date and time, and the networks it goes out to. With no time it does NOT publish: set a time and mark it Scheduled, and the clock posts it by itself to Instagram, Facebook, TikTok and YouTube. Close the piece to continue.'),
      siguiente: T('Cerrar y seguir', 'Close and continue'),
    },
    {
      view: 'conexiones', sel: '.cx-card',
      titulo: T('Conexiones', 'Connections'),
      texto: creador
        ? T('Conecta tus redes una sola vez: Instagram, Facebook, TikTok y YouTube. Verde quiere decir que publica en automático. Cuando tengas tu Instagram a la mano, vuelve aquí y toca Conectar.', 'Connect your networks once: Instagram, Facebook, TikTok and YouTube. Green means it posts automatically. When you have your Instagram at hand, come back here and tap Connect.')
        : T('Conecta las redes de cada marca una sola vez. Verde quiere decir que publica en automático. Cuando tengas el Instagram de la marca a la mano, vuelve aquí y toca Conectar.', 'Connect each brand\'s networks once. Green means it posts automatically. When you have the brand\'s Instagram at hand, come back here and tap Connect.'),
    },
    {
      view: 'entregables', sel: '.dlv-drop',
      titulo: T('Entregables', 'Deliverables'),
      texto: creador
        ? T('Aquí guardas tus reels y carruseles terminados, por mes. Desde el teléfono los descargas con un toque, y con "Al calendario" la IA los convierte en una pieza con guion y caption.', 'Keep your finished reels and carousels here, by month. From your phone you download them with one tap, and "To calendar" lets the AI turn them into a piece with script and caption.')
        : T('Aquí sueltas los reels y carruseles finales. Tu cliente los ve desde su propio acceso, comenta, pide cambios y los descarga listos para publicar.', 'Drop the final reels and carousels here. Your client sees them from their own access, comments, requests changes and downloads them ready to post.'),
    },
    {
      view: 'meses',
      titulo: T('Listo', 'All set'),
      texto: creador
        ? T('Siguiente paso real: conecta tu Instagram y genera tu primer mes. Si te pierdes, esta visita vive en Tu cuenta → Visita guiada, y Ayuda abre nuestro WhatsApp.', 'Next real step: connect your Instagram and generate your first month. If you get lost, this tour lives in Your account → Guided tour, and Help opens our WhatsApp.')
        : T('Siguiente paso real: conecta el Instagram de tu marca y genera tu primer mes. Si te pierdes, esta visita vive en Tu cuenta → Visita guiada, y Ayuda abre nuestro WhatsApp.', 'Next real step: connect your brand\'s Instagram and generate your first month. If you get lost, this tour lives in Your account → Guided tour, and Help opens our WhatsApp.'),
    },
  ];
}

// La marca del cliente, ¿lleva aprobación? (mismo criterio que el calendario)
function aprobacionActiva(store) {
  const { activeClientId, clients } = store.getState();
  const b = (clients || []).find((c) => c.id === activeClientId);
  return !(b && Number(b.approval_enabled) === 0);
}
const enPieza = (store) => store.getState().view === 'post';

// CLIENTE: visita OBLIGATORIA (Vianey, 1-oct-2026: "que no se pueda salir
// hasta que la terminen"): sin Saltar, sin Escape, y si recarga retoma donde iba.
function pasosCliente(store) {
  const aprueba = aprobacionActiva(store);
  return [
    {
      titulo: T('Bienvenido a tu calendario', 'Welcome to your calendar'),
      texto: aprueba
        ? T('Aquí ves el contenido que tu agencia prepara para tu marca, lo apruebas o pides cambios, y descargas tus videos finales. Son dos minutos y al terminar sabrás usarlo todo.', 'Here you see the content your agency prepares for your brand, you approve it or request changes, and you download your final videos. Two minutes and you will know how to use it all.')
        : T('Aquí ves el contenido que tu agencia prepara para tu marca, lo comentas y descargas tus videos finales. Son dos minutos y al terminar sabrás usarlo todo.', 'Here you see the content your agency prepares for your brand, you comment on it and download your final videos. Two minutes and you will know how to use it all.'),
    },
    {
      view: 'meses', sel: SEL_ABRIR_PIEZA, accion: true,
      titulo: T('Abre una pieza', 'Open a piece'),
      texto: esMovil() ? T('Cada tarjeta es una pieza del mes: un post, un reel o un carrusel. Toca una para verla completa.', 'Each card is one piece of the month: a post, a reel or a carousel. Tap one to see it in full.') : T('Cada fila es una pieza del mes: un post, un reel o un carrusel. Toca el lápiz para verla completa.', 'Each row is one piece of the month: a post, a reel or a carousel. Tap the pencil to see it in full.'),
      pista: pistaAbrir(),
      sinElemento: T('Cuando tu agencia suba piezas, cada una aparece aquí con su fecha, su texto y su estado; la tocas para verla completa.', 'Once your agency adds pieces, each one appears here with its date, text and status; tap it to see it in full.'),
    },
    ...(aprueba ? [{
      soloSi: enPieza, sel: '[data-row="estado"]', accion: true,
      titulo: T('Tu decisión: la fila Estado', 'Your decision: the Status row'),
      texto: T('Esta fila es tuya. Tócala para ver tus dos opciones.', 'This row is yours. Tap it to see your two options.'),
      pista: T('Toca aquí', 'Tap here'),
    }, {
      soloSi: enPieza, libre: true, empiezaCuando: () => hayCapa(), sigueCuando: () => !hayCapa(),
      titulo: T('Aprobado o Modificar', 'Approved or Modify'),
      texto: T('Aprobado deja la pieza lista y tu agencia se entera al instante. Modificar le pide cambios con tu comentario. Elige una si ya revisaste la pieza, o cierra para seguir.', 'Approved marks the piece ready and your agency is notified instantly. Modify requests changes with your comment. Pick one if you already reviewed the piece, or close to continue.'),
      siguiente: T('Cerrar y seguir', 'Close and continue'),
    }] : []),
    {
      soloSi: enPieza, libre: true, cierraPieza: true, empiezaCuando: enPieza, sigueCuando: (st) => !enPieza(st),
      titulo: T('La pieza por dentro', 'Inside the piece'),
      texto: T('Arriba: Guion muestra el texto completo de la pieza y Conversación es tu chat con la agencia. Explora lo que quieras y, cuando termines, cierra con la X para seguir.', 'At the top: Script shows the full text of the piece and Conversation is your chat with the agency. Explore as you like and, when you are done, close with the X to continue.'),
      siguiente: T('Cerrar y seguir', 'Close and continue'),
    },
    ...(aprueba ? [{
      view: 'meses', sel: esMovil() ? '.meses-approve' : '.meses-statuscell', soloResaltar: true,
      titulo: T('Decidir desde la lista', 'Decide from the list'),
      texto: esMovil()
        ? T('Sin abrir la pieza también puedes decidir: cada pieza pendiente trae aquí mismo Aprobar y Pedir cambios.', 'You can also decide without opening the piece: each pending piece has Approve and Request changes right here.')
        : T('Sin abrir la pieza también puedes decidir: la columna Estado abre Aprobado o Modificar en cualquier pieza.', 'You can also decide without opening the piece: the Status column opens Approved or Modify on any piece.'),
      sinElemento: T('Cuando haya piezas pendientes de tu aprobación, cada una trae aquí mismo los botones Aprobar y Pedir cambios, sin abrirla.', 'Once there are pieces pending your approval, each one has Approve and Request changes right here, without opening it.'),
    }] : []),
    {
      view: 'entregables', sel: '.dlv-dl, .dlv-card', soloResaltar: true,
      titulo: T('Tus entregables', 'Your deliverables'),
      texto: T('Aquí viven tus reels y carruseles finales: míralos, comenta y descárgalos a tu teléfono con un toque.', 'Your final reels and carousels live here: watch them, comment and download them to your phone with one tap.'),
      sinElemento: T('Cuando tu agencia suba tus videos finales aparecen aquí, listos para ver, comentar y descargar con un toque.', 'Once your agency uploads your final videos they appear here, ready to watch, comment and download with one tap.'),
    },
    {
      view: 'meses',
      titulo: T('Listo', 'All set'),
      texto: T('Cada vez que tu agencia suba o cambie algo te llega un aviso en la campana. Puedes repetir esta visita desde tu foto, arriba a la derecha → Visita guiada.', 'Every time your agency adds or changes something you get a notification in the bell. You can replay this tour from your photo, top right → Guided tour.'),
    },
  ];
}

// ── VISITA DEL CRM (demo de SMILE NOW, 15-oct-2026) ──────────────────────────
// Israel: "haz una visita guiada súper detallada, pero que solo se active una
// vez y solo para este CRM de prueba". Recorre la Bandeja tocando lo real:
// Mensajes → un chat → su oportunidad (etapas, plan, tareas, historial) →
// Embudo → una tarjeta → Tareas → Desempeño. La ven SOLO los accesos de una
// marca demo (me.tour_crm_pendiente) y una vez por persona.
const hayOp = () => !!document.querySelector('#sheetHost .sheet--op');
const hayChat = () => !!document.querySelector('.bj-chat__head');
const enChatMovil = () => esMovil() && !!document.querySelector('.bj-root.is-chat');
function pasosCRM(store) {
  const me = store.getState().me || {};
  const agente = me.bandeja_rol === 'agente';
  const noAgente = () => !agente;
  // Ir a una pestaña de la Bandeja (y, en el teléfono, salir del chat abierto).
  const irTab = (tab) => async ({ router, params }) => {
    if (enChatMovil()) { const b = document.querySelector('.bj-back'); if (b) b.click(); await esperar(() => !enChatMovil(), 1500); }
    if (!document.querySelector(`.bj-seg button[data-tab="${tab}"].is-active`)) {
      router.navigate('bandeja', { ...params, tab });
      await esperar(() => !!document.querySelector(`.bj-seg button[data-tab="${tab}"].is-active`), 3000);
    }
  };
  const salirDelChat = async () => {
    if (enChatMovil()) { const b = document.querySelector('.bj-back'); if (b) b.click(); await esperar(() => !enChatMovil(), 1500); }
  };
  const verVista = (v) => async () => {
    const b = document.querySelector(`.bj-emb__seg button[data-vista="${v}"]`);
    if (b && !b.classList.contains('is-active')) { b.click(); await esperar(() => b.isConnected && b.classList.contains('is-active'), 2000); }
  };
  const seccionOp = (k) => (esMovil() ? `.sheet--op .bj-op__tabs [data-sec="${k}"]` : `.sheet--op .bj-op__sec[data-sec="${k}"]`);
  // Lo que depende de quién entra o del aparato se decide AQUÍ (paso.aplica):
  // así el contador "3 de N" cuenta solo los pasos que esa persona va a ver.
  const pasos = [
    {
      titulo: T('Te damos la bienvenida al CRM de SMILE NOW', 'Welcome to the SMILE NOW CRM'),
      texto: T('En unos minutos te enseño todo tocando los botones reales. Es una demo: los pacientes son de prueba y nada se le envía a nadie, así que puedes tocar sin miedo. Puedes saltarla y repetirla desde tu foto → Visita guiada.', 'In a few minutes I will show you everything by tapping the real buttons. It is a demo: the patients are test data and nothing is sent to anyone, so tap away. You can skip it and replay it from your photo → Guided tour.'),
    },
    {
      view: 'bandeja', antes: irTab('mensajes'), sel: '.bj-seg button[data-tab="mensajes"]', soloResaltar: true,
      titulo: T('1 · Mensajes', '1 · Messages'),
      texto: T('Aquí llegan los WhatsApp, Instagram y Messenger de la clínica, en una sola lista. El número son los mensajes sin leer. Los nuevos se reparten solos entre las agentes disponibles.', 'The clinic\'s WhatsApp, Instagram and Messenger arrive here, in one list. The number is unread messages. New ones are shared out automatically among available agents.'),
    },
    {
      aplica: noAgente(), sel: '.bj-canales', soloResaltar: true,
      titulo: T('Filtrar por red', 'Filter by network'),
      texto: T('Cada red es un botón: un toque muestra solo esa red y otro toque quita el filtro. El punto verde dice que la cuenta está conectada.', 'Each network is a button: one tap shows only that network and another tap clears the filter. The green dot means the account is connected.'),
    },
    {
      sel: '.bj-menus', soloResaltar: true,
      titulo: T('Ver, Red y Etapa', 'View, Network and Stage'),
      texto: agente
        ? T('«Ver» te enseña lo sin leer, lo que espera tu respuesta, quién lleva días sin contestar, los tuyos y lo archivado. «Red» y «Etapa» filtran igual.', '"View" shows unread, awaiting your reply, gone quiet for days, yours and archived. "Network" and "Stage" filter the same way.')
        : T('«Ver» te enseña lo sin leer, lo que espera respuesta, quién lleva días sin contestar, lo sin asignar y lo archivado. «Red» y «Etapa» filtran igual.', '"View" shows unread, awaiting reply, gone quiet for days, unassigned and archived. "Network" and "Stage" filter the same way.'),
    },
    {
      sel: '.bj-conv', accion: true, pista: T('Toca un chat', 'Tap a chat'),
      titulo: T('2 · Un paciente', '2 · A patient'),
      texto: T('Cada fila dice su etapa, quién lo atiende y si llegó por un anuncio. Toca uno para abrir la conversación.', 'Each row shows its stage, who handles it and whether it came from an ad. Tap one to open the conversation.'),
      sinElemento: T('Cuando un paciente escriba, aparece aquí con su etapa, su agente y de qué anuncio llegó.', 'When a patient writes, they appear here with their stage, agent and the ad they came from.'),
    },
    {
      soloSi: hayChat, espera: 4000, sel: '.bj-chat__head', soloResaltar: true,
      titulo: T('Arriba del chat', 'Top of the chat'),
      texto: T('La etapa (tócala para moverlo), quién lo atiende, el teléfono para llamarle y el maletín, que abre su oportunidad completa.', 'The stage (tap it to move them), who handles it, the phone to call and the briefcase, which opens their full deal.'),
    },
    {
      soloSi: hayChat, sel: '.bj-composer', soloResaltar: true,
      titulo: T('Contestar', 'Replying'),
      texto: T('Aquí escribes. «Sugerir» propone la respuesta con IA en el tono de la clínica, tú la revisas. Si pasaron más de 24 horas, WhatsApp exige plantilla: la app la arma sola y te dice cuánto cuesta.', 'Type here. "Suggest" drafts the reply with AI in the clinic\'s tone; you review it. After 24 hours WhatsApp requires a template: the app builds it and tells you the cost.'),
    },
    {
      soloSi: hayChat, sel: '.bj-chat__head button[title="Oportunidad"]', accion: true, pista: T('Toca el maletín', 'Tap the briefcase'),
      titulo: T('3 · La oportunidad', '3 · The deal'),
      texto: T('Es la ficha de venta del paciente: su etapa, su plan de tratamiento, sus tareas y todo su historial. Ábrela.', 'It is the patient\'s sales record: stage, treatment plan, tasks and full history. Open it.'),
    },
    {
      soloSi: hayOp, espera: 4000, sel: '.sheet--op .bj-op__head', soloResaltar: true,
      titulo: T('Quién es y cuánto vale', 'Who they are and their value'),
      texto: T('Su red y teléfono, de qué anuncio llegó y cuánto vale la oportunidad. Desde aquí abres el chat, le llamas o cambias quién lo atiende.', 'Their network and phone, the ad they came from and the deal value. From here you open the chat, call them or change who handles them.'),
    },
    {
      soloSi: hayOp, sel: '.sheet--op .bj-op__etapas', soloResaltar: true,
      titulo: T('Las etapas', 'The stages'),
      texto: T('De la más oscura (Nuevo) a la más clara (Cliente). Un toque lo mueve. Al marcar Perdido te pide el motivo y cancela sus tareas; al pasar a Cita agendada te pide la fecha.', 'From darkest (New) to lightest (Customer). One tap moves them. Marking Lost asks for the reason and cancels their tasks; moving to Booked asks for the date.'),
    },
    {
      soloSi: hayOp, sel: seccionOp('plan'), soloResaltar: true,
      titulo: T('Plan de tratamiento', 'Treatment plan'),
      texto: T('Eliges tratamientos del catálogo (ya traen precio), anotas pieza o zona y marcas si está propuesto, aceptado o realizado. El valor de la oportunidad se calcula solo.', 'Pick treatments from the catalog (prices included), note the tooth or area and mark them proposed, accepted or done. The deal value is calculated for you.'),
    },
    {
      soloSi: hayOp, sel: seccionOp('tareas'), soloResaltar: true,
      titulo: T('Tareas', 'Tasks'),
      texto: T('El siguiente paso con este paciente: qué hacer, para cuándo y quién. Cuando se vence le llega un aviso al celular a esa persona. Las vencidas salen en rojo.', 'The next step with this patient: what, when and who. When it is due, that person gets a phone alert. Overdue ones show in red.'),
    },
    {
      soloSi: hayOp, sel: seccionOp('historial'), soloResaltar: true,
      titulo: T('Historial de contacto', 'Contact history'),
      texto: T('Cada mensaje, llamada, cambio de etapa, tarea y comentario, con quién y cuándo. Aquí también dejas comentarios para el equipo, como «vino a la clínica».', 'Every message, call, stage change, task and comment, with who and when. You also leave notes for the team here, like "came to the clinic".'),
    },
    {
      soloSi: hayOp, sel: '.sheet--op .sheet__close', accion: true, pista: T('Toca la X', 'Tap the X'), siguiente: T('Cerrar y seguir', 'Close and continue'),
      titulo: T('Cerrar', 'Close'),
      texto: T('Ciérrala para seguir. Si cambias datos o el plan, abajo sale «Guardar cambios»; las etapas, tareas y comentarios se guardan solos al momento.', 'Close it to continue. If you change details or the plan, "Save changes" appears at the bottom; stages, tasks and comments save instantly.'),
    },
    {
      antes: async (c) => { if (hayCapa() && c.closeAll) { c.closeAll(); await esperar(() => !hayCapa(), 1500); } await salirDelChat(); }, sel: '.bj-seg button[data-tab="embudo"]', accion: true, pista: T('Toca Embudo', 'Tap Pipeline'),
      titulo: T('4 · El Embudo', '4 · The pipeline'),
      texto: T('Es el tablero de ventas: todos los pacientes por etapa. El número son las tareas vencidas y las de hoy. Tócalo.', 'It is the sales board: every patient by stage. The number is overdue and today\'s tasks. Tap it.'),
    },
    {
      antes: irTab('embudo'), sel: '.bj-emb__kpis', soloResaltar: true,
      titulo: T('De un vistazo', 'At a glance'),
      texto: T('Oportunidades abiertas, dinero en juego, citas de los próximos 7 días y tareas vencidas (ese cuadro se toca y te lleva a ellas).', 'Open deals, money in play, visits in the next 7 days and overdue tasks (that box is tappable and takes you to them).'),
    },
    {
      aplica: esMovil(), sel: '.bj-emb__etapas', soloResaltar: true,
      titulo: T('Salta entre etapas', 'Jump between stages'),
      texto: T('Toca una etapa para ir a su columna, o desliza el tablero a los lados.', 'Tap a stage to go to its column, or swipe the board sideways.'),
    },
    {
      sel: esMovil() ? '.bj-col__head' : '.bj-tablero', soloResaltar: true,
      titulo: T('Las columnas', 'The columns'),
      texto: esMovil()
        ? T('Cada columna es una etapa, con cuántos pacientes y cuánto dinero hay en ella. Las etapas se cambian dentro de la oportunidad de cada paciente.', 'Each column is a stage, with how many patients and how much money it holds. Stages are changed inside each patient\'s deal.')
        : T('Cada columna es una etapa, con cuántos pacientes y cuánto dinero hay en ella. Arrastra una tarjeta a otra columna para cambiarla de etapa.', 'Each column is a stage, with how many patients and how much money it holds. Drag a card to another column to change its stage.'),
    },
    {
      sel: '.bj-card', accion: true, pista: T('Toca una tarjeta', 'Tap a card'),
      titulo: T('Las tarjetas', 'The cards'),
      texto: T('Nombre, valor, quién lo atiende, su siguiente tarea (en rojo si ya se venció) y su cita. «Sin siguiente paso» avisa que falta agendarle algo. Toca una.', 'Name, value, who handles it, its next task (red if overdue) and its visit. "No next step" warns that nothing is scheduled. Tap one.'),
      sinElemento: T('Cuando haya pacientes, cada uno aparece aquí como tarjeta en su etapa.', 'Once there are patients, each appears here as a card in its stage.'),
    },
    {
      libre: true, saltarSiNoAbre: true, empiezaCuando: () => hayOp(), sigueCuando: () => !hayCapa(),
      titulo: T('Pruébalo tú', 'Try it yourself'),
      texto: T('Es la misma oportunidad que viste desde el chat. Agrega un tratamiento, crea una tarea o escribe un comentario: es de prueba. Ciérrala para seguir.', 'It is the same deal you saw from the chat. Add a treatment, create a task or write a comment: it is test data. Close it to continue.'),
      siguiente: T('Cerrar y seguir', 'Close and continue'),
    },
    {
      antes: irTab('embudo'), sel: '.bj-emb__seg button[data-vista="tareas"]', accion: true, pista: T('Toca Tareas', 'Tap Tasks'),
      titulo: T('5 · Tareas', '5 · Tasks'),
      texto: agente ? T('Todo lo que te toca hacer, en un solo lugar. Tócalo.', 'Everything you have to do, in one place. Tap it.') : T('Todo lo que el equipo tiene que hacer, en un solo lugar. Tócalo.', 'Everything the team has to do, in one place. Tap it.'),
    },
    {
      antes: verVista('tareas'), sel: '.bj-tarea', soloResaltar: true,
      titulo: T('La lista de tareas', 'The task list'),
      texto: T('Primero lo vencido, luego hoy, mañana y la semana. El círculo la marca como hecha (con Deshacer), ⋮ la edita, la pasa a mañana o la borra, y tocar el texto abre al paciente.', 'Overdue first, then today, tomorrow and the week. The circle marks it done (with Undo), ⋮ edits it, moves it to tomorrow or deletes it, and tapping the text opens the patient.'),
      sinElemento: T('Cuando haya tareas, salen aquí: lo vencido primero.', 'Once there are tasks they show here, overdue first.'),
    },
    {
      aplica: noAgente(), sel: '.bj-emb__menus .bj-menu', soloResaltar: true,
      titulo: T('Por agente', 'By agent'),
      texto: T('«Responsable» filtra el tablero y las tareas por agente, para ver cómo va cada quien.', '"Owner" filters the board and the tasks by agent, to see how each one is doing.'),
    },
    {
      aplica: noAgente(), antes: verVista('tablero'), sel: '.bj-seg button[data-tab="desempeno"]', soloResaltar: true,
      titulo: T('6 · Desempeño', '6 · Performance'),
      texto: T('Quién contesta más rápido, cuántas llamadas y citas lleva cada agente y qué anuncio trae más pacientes.', 'Who replies fastest, how many calls and visits each agent has and which ad brings the most patients.'),
    },
    {
      aplica: agente, antes: verVista('tablero'), sel: '.bj-dispo', soloResaltar: true,
      titulo: T('Disponible', 'Available'),
      texto: T('Si sales a comer o terminas tu turno, márcate «No disponible»: el reparto te salta hasta que vuelvas.', 'If you step out or finish your shift, set yourself "Away": new chats skip you until you are back.'),
    },
    {
      titulo: T('¡Listo!', 'All set!'),
      texto: T('Los avisos de mensajes nuevos y de tareas que vencen te llegan a la campana y al celular. Puedes repetir esta visita cuando quieras desde tu foto, arriba a la derecha → Visita guiada.', 'Alerts for new messages and due tasks reach the bell and your phone. Replay this tour anytime from your photo, top right → Guided tour.'),
    },
  ];
  return pasos.filter((x) => x.aplica !== false);
}
export function tourCrmPendiente(me) {
  return !!(me && me.tour_crm_pendiente === true);
}

// Solo cuentas NUEVAS y una sola vez (Israel, 7-oct-2026): lo decide el
// servidor (me.tour_pendiente, migración 041). El localStorage ya no manda:
// Safari lo borra y a clientes de siempre (Regeneris) les volvía a salir.
export function tourPendiente(me) {
  return !!(me && me.tour_pendiente === true);
}

function esperar(cond, ms) {
  return new Promise((res) => {
    const t0 = Date.now();
    const iv = setInterval(() => {
      let ok = false;
      try { ok = !!cond(); } catch { ok = false; }
      if (ok || Date.now() - t0 > ms) { clearInterval(iv); res(ok); }
    }, 100);
  });
}
function visible(node) {
  if (!node) return false;
  const r = node.getBoundingClientRect();
  return r.width > 2 && r.height > 2 && r.bottom > 0 && r.right > 0 && r.top < window.innerHeight;
}
function primerVisible(sel) {
  for (const n of document.querySelectorAll(sel)) if (visible(n)) return n;
  return null;
}
// Existe y tiene tamaño, pero quedó fuera de la pantalla (p.ej. un bloque que
// cargó después lo empujó hacia abajo).
function primerConTamano(sel) {
  for (const n of document.querySelectorAll(sel)) {
    const r = n.getBoundingClientRect();
    if (r.width > 2 && r.height > 2) return n;
  }
  return null;
}
async function esperarEl(sel, ms) {
  const ok = await esperar(() => !!primerVisible(sel), ms);
  return ok ? primerVisible(sel) : null;
}

export async function startTour({ router, store, prefs, closeAll, me, forzar = false, modo = 'general' }) {
  if (activo) return;
  const crm = modo === 'crm';
  if (!forzar && !(crm ? tourCrmPendiente(me) : tourPendiente(me))) return;
  // Se marca vista en el servidor al EMPEZAR: no vuelve a salir aunque recargue
  // o cambie de teléfono. (Desde el menú, forzar, no hace falta marcar nada.)
  if (!forzar) {
    try { await fetch(crm ? '/api/marketing/auth/tour-crm-visto' : '/api/marketing/auth/tour-visto', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: '{}' }); } catch { /* sin red: la próxima vez */ }
    try { store.set({ me: { ...(store.getState().me || {}), ...(crm ? { tour_crm_pendiente: false } : { tour_pendiente: false }) } }); } catch { /* opcional */ }
  }
  const cliente = !!(me && me.role === 'client');
  // El cliente no puede salir de la visita del calendario hasta terminarla; la
  // del CRM (demo) sí se puede saltar.
  const obligatoria = cliente && !crm;
  const pasos = crm ? pasosCRM(store) : (cliente ? pasosCliente(store) : pasosEquipo());
  const st = store.getState();
  const clienteId = st.activeClientId && st.activeClientId !== 'todos' ? st.activeClientId : null;
  const params = clienteId ? { cliente: clienteId } : {};

  // Máscara en 4 rectángulos alrededor del foco: el hueco deja pasar el toque.
  const masks = ['t', 'l', 'r', 'b'].map((k) => el('div', { class: `tour__mask tour__mask--${k}` }));
  const foco = el('div', { class: 'tour__foco', hidden: true });
  const pista = el('div', { class: 'tour__pista', hidden: true });
  const paso = el('div', { class: 'tour__paso' });
  const titulo = el('h3', { class: 'tour__t' });
  const texto = el('p', { class: 'tour__p' });
  const bPrev = el('button', { class: 'btn tour__prev', type: 'button', text: T('Atrás', 'Back') });
  const bNext = el('button', { class: 'btn btn-primary tour__next', type: 'button' });
  const bSkip = el('button', { class: 'tour__skip', type: 'button', text: T('Saltar la visita', 'Skip the tour') });
  const card = el('div', { class: 'tour__card', role: 'document' }, [
    paso, titulo, texto,
    el('div', { class: 'tour__acts' }, [bSkip, el('span', { class: 'tour__sp' }), bPrev, bNext]),
  ]);
  const root = el('div', { class: 'tour', role: 'dialog', 'aria-modal': 'false', 'aria-label': T('Visita guiada', 'Guided tour') }, [...masks, foco, pista, card]);
  document.body.appendChild(root);

  let i = 0; let target = null; let iv = null; let cerrado = false; let p = null; let listo = false; let pasoT0 = 0;
  let libreActual = false; // el paso se muestra libre SOLO si lo que debía abrirse está abierto
  activo = { root };

  function ponerMascara(r) {
    const vw = window.innerWidth, vh = window.innerHeight;
    if (!r) { // sin hueco: una sola capa completa
      Object.assign(masks[0].style, { left: '0px', top: '0px', width: `${vw}px`, height: `${vh}px` });
      for (const m of masks.slice(1)) Object.assign(m.style, { width: '0px', height: '0px' });
      return;
    }
    Object.assign(masks[0].style, { left: '0px', top: '0px', width: `${vw}px`, height: `${Math.max(0, r.top)}px` });
    Object.assign(masks[1].style, { left: '0px', top: `${r.top}px`, width: `${Math.max(0, r.left)}px`, height: `${r.height}px` });
    Object.assign(masks[2].style, { left: `${r.right}px`, top: `${r.top}px`, width: `${Math.max(0, vw - r.right)}px`, height: `${r.height}px` });
    Object.assign(masks[3].style, { left: '0px', top: `${r.bottom}px`, width: `${vw}px`, height: `${Math.max(0, vh - r.bottom)}px` });
  }

  function colocar() {
    if (cerrado || !p) return;
    const vw = window.innerWidth, vh = window.innerHeight;
    root.classList.toggle('tour--libre', libreActual);
    if (libreActual) { // sin máscara: la persona usa lo que abrió; la tarjeta se hace a un lado
      for (const m of masks) m.hidden = true;
      foco.hidden = true; pista.hidden = true;
      card.classList.remove('tour__card--centro'); card.classList.add('tour__card--lado');
      // Móvil: hojas y diálogo suben desde abajo → la tarjeta va arriba, sobre el velo.
      // En el editor (pantalla completa, con su X arriba) va abajo.
      // Con una hoja abierta (vienen de abajo) la tarjeta va arriba aunque sea el editor.
      card.classList.toggle('tour__card--arriba', esMovil() && (hayCapa() || store.getState().view !== 'post'));
      card.style.left = ''; card.style.top = ''; card.style.width = '';
      return;
    }
    for (const m of masks) m.hidden = false;
    card.classList.remove('tour__card--lado', 'tour__card--arriba');
    // Las vistas con datos (Conexiones, Entregables) se vuelven a pintar cuando
    // llegan sus datos y el nodo agarrado queda suelto: se vuelve a buscar.
    if (p.sel && (!target || !target.isConnected || !visible(target))) {
      const t = primerVisible(p.sel);
      if (t) target = t;
      else if (Date.now() - pasoT0 < 6000) {
        // Mientras la vista se acomoda (primeros segundos), volver a traerlo a la vista.
        const t2 = primerConTamano(p.sel);
        if (t2) { try { t2.scrollIntoView({ block: 'center', inline: 'nearest' }); } catch { /* noop */ } target = t2; }
      }
    }
    if (target && visible(target)) {
      const r0 = target.getBoundingClientRect();
      const pad = 6;
      const r = { left: r0.left - pad, top: r0.top - pad, width: r0.width + pad * 2, height: r0.height + pad * 2 };
      r.right = r.left + r.width; r.bottom = r.top + r.height;
      // soloResaltar: se ve el aro pero NO hay hueco (tocar ahí abriría algo
      // DEBAJO de la máscara, p.ej. Aprobar de la lista).
      ponerMascara(p.soloResaltar ? null : r);
      root.dataset.hueco = p.soloResaltar ? '0' : '1';
      foco.hidden = false;
      Object.assign(foco.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
      if (p.accion && p.pista) {
        pista.hidden = false; pista.textContent = p.pista;
        const pw = pista.offsetWidth || 90;
        pista.style.left = `${Math.max(8, Math.min(r.left + r.width / 2 - pw / 2, vw - pw - 8))}px`;
        pista.style.top = `${r.bottom + 8 < vh - 40 ? r.bottom + 8 : r.top - 36}px`;
      } else pista.hidden = true;
      card.classList.remove('tour__card--centro');
      if (esMovil()) {
        card.style.left = ''; card.style.top = ''; card.style.width = '';
        // La tarjeta vive abajo; si lo señalado queda abajo (la caja de escribir,
        // una tarjeta del tablero) y hay lugar arriba, sube para no taparlo.
        const ch = card.offsetHeight || 200;
        const bordeCard = vh - 84 - ch - 12;
        card.classList.toggle('tour__card--arriba', r.bottom > bordeCard && r.top > ch + 24);
        return;
      }
      const cw = Math.min(400, vw - 32), ch = card.offsetHeight || 180;
      const left = Math.max(16, Math.min(r.left, vw - cw - 16));
      let top = r.bottom + (pista.hidden ? 14 : 44);
      if (top + ch > vh - 16) top = Math.max(16, r.top - ch - 14);
      card.style.left = `${left}px`; card.style.top = `${top}px`; card.style.width = `${cw}px`;
    } else {
      ponerMascara(null); root.dataset.hueco = '0';
      foco.hidden = true; pista.hidden = true;
      card.classList.add('tour__card--centro');
      card.style.left = ''; card.style.top = ''; card.style.width = '';
    }
  }

  // Toque sobre el elemento del foco = acción cumplida → siguiente paso.
  function alTocar(e) {
    if (cerrado || !p || !p.accion || !p.sel || !e.target || typeof e.target.closest !== 'function') return;
    const n = i;
    if (e.target.closest(p.sel)) setTimeout(() => { if (!cerrado && i === n) mostrar(n + 1, { porAccion: true }); }, 250);
  }

  // Cada llamada lleva su turno: si llega otra (dos toques seguidos), la vieja
  // se retira sin pintar nada (antes se encimaban los pasos).
  let turno = 0;
  async function mostrar(n, { porAccion = false } = {}) {
    const yo = ++turno;
    const viejo = () => cerrado || yo !== turno;
    listo = false; root.classList.remove('tour--listo');
    const dir = n >= i ? 1 : -1;
    n = Math.max(0, Math.min(pasos.length - 1, n));
    // Pasos que solo tienen sentido en cierto estado (p.ej. dentro de la pieza):
    // si no se cumple, se brincan en la dirección en que se venía.
    // Con `espera`, se da tiempo a que aparezca lo que el paso necesita (p.ej.
    // la oportunidad tarda lo que tarde el servidor en abrirla).
    for (;;) {
      const q = pasos[n];
      if (!q.soloSi) break;
      let ok = false; try { ok = !!q.soloSi(store); } catch { ok = false; }
      // Solo se espera si la persona SÍ tocó (si eligió "Lo hago después", no hay nada que esperar).
      if (!ok && dir > 0 && q.espera && porAccion) ok = await esperar(() => q.soloSi(store), q.espera);
      if (viejo()) return;
      porAccion = false;
      if (ok) break;
      const m = n + dir;
      if (m < 0 || m >= pasos.length) break;
      n = m;
    }
    if (viejo()) return;
    pasoT0 = Date.now();
    i = n; p = pasos[i]; libreActual = false;
    if (obligatoria) prefs.set('tourPaso', i); // si recarga, retoma aquí
    target = null; colocar();
    paso.textContent = `${i + 1} ${T('de', 'of')} ${pasos.length}`;
    titulo.textContent = p.titulo; texto.textContent = p.texto;
    bPrev.hidden = i === 0;
    bNext.textContent = i === pasos.length - 1 ? T('Empezar', 'Start') : (p.siguiente || (p.accion ? T('Lo hago después', 'Later') : T('Siguiente', 'Next')));
    // Obligatoria: en un paso de acción el botón para seguir sin hacerla
    // aparece hasta pasados unos segundos (primero que lo intente).
    bNext.hidden = false;
    if (obligatoria && p.accion) {
      bNext.hidden = true; bNext.textContent = T('Seguir', 'Continue');
      const n0 = i; setTimeout(() => { if (!cerrado && i === n0 && p && p.accion) bNext.hidden = false; }, 7000);
    }
    if (p.view && store.getState().view !== p.view) {
      if (typeof closeAll === 'function') { try { closeAll(); } catch { /* noop */ } }
      router.navigate(p.view, params);
      await esperar(() => store.getState().view === p.view, 3000);
      if (viejo()) return;
      await new Promise((r) => setTimeout(r, 350));
    }
    if (viejo()) return;
    // Preparación del paso (p.ej. cambiar de pestaña dentro de la vista).
    if (typeof p.antes === 'function') {
      try { await p.antes({ router, store, params, closeAll }); } catch { /* la visita sigue */ }
      await new Promise((r) => setTimeout(r, 250));
    }
    if (viejo()) return;
    if (p.sel) {
      target = await esperarEl(p.sel, p.view ? 7000 : 3500);
      if (target) {
        try { target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' }); } catch { /* noop */ }
        await new Promise((r) => setTimeout(r, 380));
      } else if (p.sinElemento) {
        texto.textContent = p.sinElemento;
        bNext.textContent = T('Siguiente', 'Next'); bNext.hidden = false;
      }
    }
    if (viejo()) return;
    // Paso libre: esperar a que lo abierto esté de verdad abierto antes de vigilar su
    // cierre. Si no abrió (eligió seguir sin tocar), el paso se muestra como texto normal.
    if (p.libre) {
      libreActual = typeof p.empiezaCuando === 'function' ? await esperar(() => p.empiezaCuando(store), 3000) : true;
      // Si lo que este paso explica no se abrió (eligió "Lo hago después"), se brinca.
      if (!libreActual && p.saltarSiNoAbre && i < pasos.length - 1) { const n0 = i; p = null; mostrar(n0 + 1); return; }
      if (!libreActual) bNext.textContent = i === pasos.length - 1 ? T('Empezar', 'Start') : T('Siguiente', 'Next');
    }
    if (viejo()) return;
    colocar();
    if (!p.accion && !p.libre) bNext.focus();
    listo = true; root.classList.add('tour--listo');
  }

  function cerrar(terminada) {
    if (cerrado) return;
    cerrado = true; activo = null;
    clearInterval(iv);
    window.removeEventListener('resize', colocar);
    document.removeEventListener('keydown', teclas, true);
    document.removeEventListener('click', alTocar, true);
    root.remove();
    // Obligatoria: solo cuenta como vista cuando se TERMINA.
    if (terminada || !obligatoria) prefs.set('tourDone', TOUR_VERSION);
    if (terminada) prefs.set('tourPaso', undefined);
    if (terminada && !crm && store.getState().view !== 'meses') router.navigate('meses', params);
  }
  function teclas(e) {
    if (e.key !== 'Escape' || obligatoria || libreActual) return;
    e.preventDefault(); cerrar(false);
  }
  bNext.onclick = async () => {
    if (!listo) return; // el paso todavía se está acomodando: un doble toque no brinca otro
    if (p && libreActual && typeof closeAll === 'function') { try { closeAll(); } catch { /* noop */ } }
    if (p && libreActual && p.cierraPieza && store.getState().view === 'post') {
      const n = i; p = null; listo = false;
      const x = document.querySelector('.edhead .edicon[aria-label]');
      if (x) x.click(); else router.navigate('meses', params);
      await esperar(() => store.getState().view !== 'post', 3000);
      await new Promise((r) => setTimeout(r, 450));
      if (cerrado) return;
      i = n;
    }
    i === pasos.length - 1 ? cerrar(true) : mostrar(i + 1);
  };
  bPrev.onclick = () => mostrar(i - 1);
  bSkip.onclick = () => cerrar(false);
  bSkip.hidden = obligatoria;
  document.addEventListener('keydown', teclas, true);
  document.addEventListener('click', alTocar, true);
  window.addEventListener('resize', colocar);
  iv = setInterval(() => {
    colocar();
    // Paso libre: cuando la persona cerró la hoja / la pieza, la visita sigue sola.
    if (listo && p && libreActual && typeof p.sigueCuando === 'function') {
      let ok = false; try { ok = !!p.sigueCuando(store); } catch { ok = false; }
      if (ok) { const n = i; p = null; mostrar(n + 1); }
    }
  }, 300);
  // Obligatoria: si recargó a medio camino, retoma en el paso donde iba.
  const guardado = 0; // ya no se retoma a la mitad: la visita sale una sola vez
  await mostrar(Number.isFinite(guardado) && guardado > 0 && guardado < pasos.length ? guardado : 0);
}

export function tourActiva() { return !!activo; }
