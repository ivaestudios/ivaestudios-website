# Reenvío de la app a Meta, septiembre 2026

App **IVAE Marketing**, id `2823115284726253`, negocio "Vianey Dm"
(`business_id=793596070839499`). Estado: **Sin publicar**.

---

## 1. Dónde estamos (leído en el panel el 9-sep-2026)

| Permiso | Estado hoy | Llamadas | Para qué lo usamos |
|---|---|---|---|
| `instagram_business_basic` | **Aprobado y vivo** | 40,900 | Sostiene el reporte de Instagram en producción |
| `instagram_business_manage_insights` | Rechazado (10 ago) | 424 | Alcance, impresiones y seguidores del reporte mensual |
| `instagram_business_content_publish` | Rechazado (7 sep) | 336 | Publicar el post aprobado, a la hora programada |
| `pages_read_engagement` | Rechazado (7 sep) | 75 | Leer la página de Facebook del cliente |
| `pages_show_list` | Rechazado (7 sep) | 75 | Que la clienta elija cuál de sus páginas conectar |
| `pages_manage_posts` | Rechazado (7 sep) | sin datos | Publicar en la página de Facebook |
| `instagram_business_manage_comments` | **Nunca se ha pedido** | sin datos | La bandeja de comentarios (hoy atorada) |

**Cinco envíos desde julio y solo pasó uno.** El motivo es el MISMO en los
cuatro rechazos del 7 de septiembre, y hay que leerlo con cuidado porque
cambia todo:

> *"Determinamos que el caso de uso de tu app **está permitido**. Sin embargo,
> la captura de video que enviaste no muestra la experiencia completa del caso
> de uso."*, Política para desarrolladores 1.6

O sea: **el producto no es el problema. El video sí.** Cinco veces.

---

## 2. Lo que Meta exige del video, palabra por palabra

1. **El flujo de inicio de sesión de Meta completo.** Del botón hasta el
   regreso a la app. No basta con enseñar la cuenta ya conectada.
2. **Un usuario con acceso a la app** para ese permiso.
3. **La experiencia completa del caso de uso**, de punta a punta. Nada de
   fragmentos.
4. **La interfaz en INGLÉS**, con subtítulos que expliquen qué hace cada
   botón.

Y una salida que conviene conocer: si la app fuera de servidor a servidor, se
declara y no hace falta enseñar el login. **No es nuestro caso**: nuestra app
sí tiene el botón "Connect" y ese flujo hay que grabarlo.

---

## 3. Lo que ya quedó resuelto (9-sep-2026)

- **La pantalla de acceso estaba en español a fuego.** Toda la app cambiaba a
  inglés con el interruptor menos esa, que es justo donde empieza el video.
  Arreglado: `marketing/js/login-en.js`, mismo interruptor `?lang=en`.
  Verificado en vivo: título, subtítulo, campos, botones y enlaces en inglés,
  y el español intacto.
- **La dirección para grabar es `https://ivaestudios.com/marketing/?lang=en`**.
  Entrando por ahí, la app entera sigue en inglés después del login, porque
  deja el idioma guardado.

---

## 4. El guion de grabación

**Una sola toma continua, sin cortes.** Meta rechaza los fragmentos. Calcula
4 minutos. Grábalo en la computadora (la pantalla se lee mejor que el
teléfono) con QuickTime: Archivo → Nueva grabación de pantalla.

Antes de empezar: cierra sesión en la app y ten a la mano la contraseña.

| # | Qué haces | Cuánto |
|---|---|---|
| 1 | Abre `https://ivaestudios.com/marketing/?lang=en`. Deja ver la pantalla de acceso 3 segundos SIN tocar nada. | 0:00 |
| 2 | Escribe usuario y contraseña, entra. | 0:05 |
| 3 | Ya dentro, ve a **Results → Connections**. | 0:20 |
| 4 | Pica **Connect** en Instagram. **Aquí empieza lo importante.** | 0:30 |
| 5 | Deja correr el flujo de Meta COMPLETO: la pantalla de Facebook, elegir la cuenta, la lista de permisos, "Continue". No adelantes ni cortes. | 0:35 |
| 6 | Espera a que te regrese sola a la app y se vea la cuenta conectada. | 1:10 |
| 7 | Ve a **Results → Metrics**. Enseña reach, impressions y followers. Desplázate despacio. | 1:25 |
| 8 | Ve a **Content → Calendar**, abre una pieza aprobada y enseña el botón de publicar y la hora programada. | 2:00 |
| 9 | Enseña la bandeja de comentarios y una respuesta. | 2:40 |
| 10 | Regresa a Connections y enseña la cuenta conectada. Cierra. | 3:20 |

**Lo que más se rechaza y hay que cuidar:** el paso 5. Si el video empieza con
la cuenta YA conectada, lo rechazan otra vez. Ese tramo es el que faltaba.

### Los subtítulos, en inglés

Yo los quemo en el video con ffmpeg cuando me pases la grabación. Este es el
texto, sincronizado con los pasos de arriba:

```
0:00  IVAE Marketing: a content calendar for social media agencies.
0:05  A team member signs in with their IVAE Marketing account.
0:20  "Connections" lists each client brand and its social accounts.
0:30  Tapping "Connect" starts the Meta login flow.
0:35  The user signs in with Facebook and picks the business account.
0:50  Meta shows exactly which permissions the app is asking for.
1:10  Back in the app: the Instagram account is now linked to this brand.
1:25  "Metrics" reads reach, impressions and followers with
      instagram_business_manage_insights, to build the monthly report.
2:00  The calendar publishes an approved post at its scheduled time with
      instagram_business_content_publish.
2:40  The comment inbox reads and answers public comments with
      instagram_business_manage_comments.
3:20  The connected account, ready for the next month.
```

---

## 5. Los textos del formulario, listos para pegar

Meta pide, por cada permiso, para qué lo usas. Van en inglés.

**instagram_business_manage_insights**
```
IVAE Marketing is a content calendar used by our social media agency to manage
our clients' Instagram business accounts. Each client connects their own
Instagram business account through Meta login, as shown in the screencast.
We use instagram_business_manage_insights to read reach, impressions, profile
views and follower counts for that account, and to build the monthly
performance report the client sees inside the app. We never read data from
accounts that have not connected through the Meta login flow.
```

**instagram_business_content_publish**
```
Our clients approve each post inside IVAE Marketing before it goes live. Once
a post is approved, the app publishes it to the client's own Instagram
business account at the scheduled time, using
instagram_business_content_publish. The account is always one the user
connected through the Meta login flow shown in the screencast. We do not
publish to accounts the user does not administer.
```

**instagram_business_manage_comments**
```
Our clients ask us to answer the public comments their posts receive. IVAE
Marketing shows those comments in one inbox and lets the agency reply from the
client's own Instagram business account, using
instagram_business_manage_comments. Only accounts connected through the Meta
login flow are shown.
```

**pages_show_list**
```
A client may administer more than one Facebook Page. After the Meta login
flow, the app uses pages_show_list so the user can pick which of their own
Pages belongs to the brand they are setting up in IVAE Marketing.
```

**pages_read_engagement**
```
Once a Page is linked, IVAE Marketing uses pages_read_engagement to read that
Page's posts and engagement metrics, so the monthly report covers Facebook and
not only Instagram.
```

**pages_manage_posts**
```
IVAE Marketing publishes the approved content to the client's own Facebook
Page at the scheduled time, using pages_manage_posts. The Page is always one
the user selected after the Meta login flow shown in the screencast.
```

---

## 6. Cómo se manda

1. Casos de uso → "Administrar mensajes y contenido en Instagram" →
   **Personalizar** → **Permisos y funciones**.
2. En cada permiso rechazado: **Acciones → Volver a solicitar**. No se empieza
   de cero.
3. En `instagram_business_manage_comments`, que nunca se ha pedido:
   **Agregar a revisión de la app**.
4. Pega el texto en inglés que corresponda y sube el MISMO video en todos.
5. Revisar → **Revisión de la app** → enviar.

**Reglas de la casa:** las respuestas tardan alrededor de una semana y llegan
por correo, no por el panel (igual que pasó con Google Play). Y `[skip ci]` no
tiene nada que ver aquí, pero sí: no toques el permiso aprobado
`instagram_business_basic`, que es el que sostiene el reporte en producción.
