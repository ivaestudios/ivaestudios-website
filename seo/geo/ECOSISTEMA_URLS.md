# Ecosistema de URLs de ivaestudios.com

**Para quien lee esto:** Israel (dueño) y cualquier sesion futura de Claude que vaya a publicar, mover, fusionar o borrar una pagina de este sitio.
**Ultima verificacion de las cifras:** 2026-08-07.
**Alcance:** ivaestudios.com (paginas raiz, `/es/`, `blog/`, `es/blog/`). No aplica a `marketing/` ni a `gallery/`, que son otros productos y no se tocan desde aqui.

---

## 1. La pregunta del dueño, respondida

> "Si lanzamos un nuevo post no deberiamos quitarle el url a otro post antiguo que hable de algo parecido."

**Correcto: no se le quita la URL.** Un post viejo que habla de algo parecido se queda con su URL. Publicar uno nuevo no es motivo para apagar uno viejo, y "se parecen" nunca es razon suficiente para redirigir.

La razon no es una opinion, son los numeros del propio sitio medidos hoy:

| Dato verificado hoy | Resultado | Que significa |
|---|---|---|
| Posts publicados el 2026-08-07 | 100 | Ninguno piso una URL previa (comparado contra el arbol de git anterior) |
| URLs del sitemap | 533 | Las 533 responden 200 en produccion |
| Posts totales (`blog/` + `es/blog/`) | 380 (289 EN + 91 ES) | 380 canonicas unicas, cero duplicadas |
| Pares de posts EN con misma intencion de busqueda real | 1 de 289 | El ecosistema aguanta el volumen sin canibalizarse |
| Reglas en `_redirects` | 176 | De ellas, 103 (59%) son alias de palabra clave hacia paginas que **nunca fueron posts** |

Dicho en corto: el sitio no tiene un problema de "demasiados posts". Tiene un problema de **reglas de redireccion inventadas** que se acumularon durante meses y que terminaron tirando 31 URLs reales a 404 (ver `INCIDENTE_REDIRECTS_2026-08-07.md`). El 59% de los redirects no protege a ningun post: son atajos de palabra clave que alguien escribio por si acaso.

**La regla de oro:** una URL apagada no se recupera. El post viejo que hoy recibe 5 visitas al mes las seguira recibiendo si lo dejas vivo, y las pierde para siempre si lo redirigies. Borrar no traslada trafico, lo apaga.

---

## 2. Cuando un post nuevo merece URL propia y cuando es una ampliacion

Antes de escribir una sola linea, tres preguntas en este orden.

**Pregunta 1: ¿Que escribiria el cliente en Google?**
Escribe la frase exacta. Si esa frase ya es el H1 de un post existente, **no se crea URL nueva**. Se amplia el post viejo con una seccion nueva y se actualiza su `dateModified`.

**Pregunta 2: ¿Cambia el lugar, la audiencia o el momento?**
Si cambia cualquiera de los tres, **si merece URL propia**. Ejemplos reales del sitio que estan bien:

| Post A | Post B | Por que conviven |
|---|---|---|
| `isla-mujeres-couples-photo-session-guide` | `isla-mujeres-family-photo-session-guide` | Misma isla, audiencia distinta |
| `minimoon-riviera-maya-photo-itinerary` | `riviera-maya-honeymoon-itinerary-photo-stops` | 4 dias contra 7 dias, momento distinto |
| Guias por locacion (Holbox, Bacalar, Cozumel, Valladolid…) | entre si | Mismo formato, lugar distinto, consulta distinta |

**Pregunta 3: ¿Aporta al menos una seccion entera que el viejo no tiene?**
Si no la aporta, es una ampliacion disfrazada de post nuevo. Va dentro del viejo.

**Excepcion que si obliga a actuar:** dos posts cuyo **H1 responde literalmente la misma pregunta**. Hoy hay exactamente uno en todo el sitio en ingles:

- `blog/travel-insurance-destination-wedding-mexico.html`
- `blog/destination-wedding-travel-insurance-deposits.html`

Los dos responden "seguro de viaje para una boda destino en Mexico". Ese si se fusiona (ver seccion 6).

---

## 3. Cuando SI se redirige y cuando NO

### Los tres unicos motivos validos para un 301

1. **Fusion real.** El contenido se movio de verdad al otro post **y el archivo se borro del repo en el mismo commit**.
2. **Renombre de slug.** El slug estaba mal escrito o cambio de nombre, **y la URL vieja ya vivio en produccion**.
3. **Misma consulta literal.** Dos archivos responden exactamente la misma pregunta (el caso del seguro de viaje).

### Motivos que NO justifican un 301

| Excusa | Por que no |
|---|---|
| "El tema se parece" | Dos posts de tema parecido con consultas distintas son dos puertas de entrada, no un problema |
| "Sospecho canibalizacion" | Se arregla retitulando, no borrando. La pagina de dinero se queda con el termino comercial y el post con la pregunta informativa |
| "Tiene pocas visitas" | Redirigir no traslada esas visitas al nuevo, las apaga |
| "Quiero concentrar autoridad" | La autoridad se concentra con enlaces internos, no con 301 |
| "Por si alguien escribe esta variante" | Eso es un alias inventado, ver seccion 5 |

**Regla dura verificable:** si el archivo sigue existiendo en disco, su URL publica **no puede** aparecer como origen de una regla en `_redirects`. Un post vivo nunca se redirige. Ademas, Cloudflare Pages sirve el archivo y **jamas** llega a mirar la regla, asi que esa regla es basura que gasta presupuesto.

---

## 4. Como se nombra un slug (se decide antes de escribir y no se cambia nunca)

| Requisito | Detalle |
|---|---|
| Caracteres | Solo `a-z`, `0-9` y guion. Sin acentos, sin mayusculas, sin guion bajo |
| Largo | 3 a 6 palabras |
| Estructura | tema + lugar, por ejemplo `family-photo-session-isla-mujeres` |
| Marca | Nunca va la marca en el slug |
| Año | Nunca, salvo que el año **sea** la consulta (hoy solo 3 posts lo llevan, los 3 justificados) |
| Idioma | El slug ES se escribe en español real, nunca traduciendo palabra por palabra el ingles |
| Ubicacion | EN en `blog/<slug>.html`, ES en `es/blog/<slug>.html` |
| Canonical | Exactamente `https://ivaestudios.com/blog/<slug>` (sin `.html`). Ese par archivo/canonical no se toca jamas |

**Por que importa tanto:** 37 de las 176 reglas actuales existen unicamente porque alguien renombro un slug despues de publicar. Cada renombre cuesta una regla del presupuesto de ~100, de por vida. El presupuesto es el recurso mas escaso del sitio.

---

## 5. Por que los alias de palabra clave inventados son deuda pura

Un "alias" es una regla como `/photographer-cancun -> /cancun-photographer`: una URL que **nunca existio**, escrita por si alguien la teclea.

Los numeros de hoy:

| Reparto de las 176 reglas | Cantidad |
|---|---|
| Alias de palabra clave hacia paginas pilar que nunca fueron posts | 103 |
| Renombres de slug post a post | 37 |
| Nombres de archivo viejos `/post-X` a `/blog/X` | 17 |
| Rutas inventadas que Google reporto como 404 (`/services/*`, `/portfolio/*`) | 15 |
| Posts absorbidos por pagina pilar | 3 |
| Alias suelto | 1 |

De esos 103 alias, una auditoria cruzo cada ruta contra 759 archivos del repo, contra 1276 commits de historial y contra produccion en vivo. Resultado:

- **17 tienen evidencia dura** y merecen vivir (aparecen en informes de Search Console con impresiones, o tienen enlaces internos, o existieron como archivo real en git).
- **23 son dudosos**, decision de riesgo y no de evidencia.
- **63 no tienen ninguna evidencia en ningun lado.** Solo existen dentro del propio `_redirects`. Los patrones delatan al generador automatico: orden de palabras invertido (`/photographer-cancun` cuando la real es `/cancun-photographer`), truncamientos del slug real (`/social-media-spa` por `/social-media-spa-wellness-mexico`, 12 casos identicos entre EN y ES), y slugs ingleses inventados bajo `/es/blog/` que nunca existieron.

**Por que un alias inventado no aporta nada:** Google indexa el **destino** del 301, nunca el alias. Si nadie escribe esa URL, la regla no hace absolutamente nada. Pero si ocupa un renglon, y ese renglon empuja fuera del presupuesto a una regla que si tiene trafico. Es exactamente lo que le paso a `/destination-wedding-cancun`, que tiene 23 impresiones al mes en Search Console y hoy da 404 porque quedo en el puesto 108.

**Regla de admision:** una regla solo se crea con evidencia de que alguien pidio esa URL. Evidencia valida es una de estas tres:

1. Aparece en el informe de 404 de Search Console.
2. Existe un enlace (interno o externo) apuntandole.
3. Existio como archivo real en el historial de git.

Sin una de las tres, no entra. Y si el objetivo es posicionar una palabra clave, se hace una **pagina** con esa palabra, no un alias.

---

## 6. El presupuesto de ~100 reglas de Cloudflare Pages

Este es el hecho tecnico mas importante del sitio y el que casi nadie conoce.

> **Cloudflare Pages solo honra las primeras ~100 reglas de `_redirects`. El resto no existe.**

Medido en produccion el 2026-08-07 con `curl` contra el apex:

| Posicion | Regla | Respuesta real |
|---|---|---|
| #107 | `/manejo-de-redes-sociales-cancun` | 301 (viva) |
| #108 | `/destination-wedding-cancun` | 404 (muerta) |

Con 176 reglas en el archivo, eso significa que **69 reglas escritas hoy no existen en produccion**. Se sienten hechas, se leen en el archivo, y no hacen nada.

### Las tres consecuencias practicas

1. **El orden es la funcionalidad.** Una regla en la posicion 150 es texto muerto. Primero va lo que tiene evidencia, y punto.
2. **El archivo miente, produccion no.** Nunca des por buena una regla porque la leiste en el archivo. Se verifica con `curl` contra el sitio en vivo.
3. **Un post nuevo cuesta CERO reglas.** Un archivo `blog/<slug>.html` se sirve solo en `/blog/<slug>`, sin ninguna regla. Verificado en los 289 EN y los 91 ES.

### Tope operativo

**Maximo 90 reglas, con 10 de reserva.** Antes de agregar una, se borra una.

### Orden obligatorio del archivo

| Tier | Que va | Como se ordena |
|---|---|---|
| A | 404 reportados por Google Search Console | Por impresiones, de mayor a menor |
| B | URLs que existieron de verdad en produccion (posts renombrados, archivos viejos) y origenes enlazados desde el propio sitio | Por cantidad de enlaces internos entrantes |
| C | Comodines | Siempre preferir un comodin sobre N reglas individuales. Hoy la linea `/post-* /blog/:splat 301` cubre, ella sola, todos los `/post-*` cuyo slug no cambio (los 16 que si cambiaron llevan regla propia) |

No hay Tier D. Los alias sin evidencia no entran al archivo.

---

## 7. Como se retira contenido (secuencia obligatoria)

Retirar un post es borrar el archivo. Dejarlo huerfano es peor que no hacer nada, porque el sitio sigue fabricando enlaces internos hacia un redirect y le dice a Google dos cosas distintas sobre cual es la URL buena.

1. **Borrar el archivo del repo.** No dejarlo "por si acaso".
2. **Una sola regla 301** hacia el destino mas cercano, colocada en el Tier B.
3. **Regenerar los indices:**
   ```bash
   python3 scripts/generate_blog_grid.py
   python3 scripts/update_sitemap.py
   ```
4. **Borrar los enlaces internos** que apuntaban ahi. Ningun enlace del sitio debe apuntar a un origen listado en `_redirects`.
5. **Verificar en vivo** que el origen da 301 y el destino da 200.

Los pasos 1 a 5 van en **el mismo commit**. Un archivo borrado hoy y su regla mañana deja un hueco de 404.

**Caso vivo mal hecho que sirve de ejemplo:** `post-luxury-photographer-style-editorial-vs-documentary.html` sigue en la raiz del repo aunque el post fue absorbido por `/luxury-editorial`. Consecuencias: `blog.html` lo sigue enlazando (290 enlaces en el archivo para 289 posts reales), su canonical apunta a una URL que redirige, y la regla que deberia mandarlo a `/luxury-editorial` nunca se aplica porque Pages sirve el archivo primero. Borrarlo arregla las tres cosas de golpe.

---

## 8. Como publicar un post nuevo, paso a paso

Asi funciona **este** repo de verdad. No hay CMS, no hay build de plantillas: el archivo HTML es la pagina.

### Paso 1: Decidir si merece URL propia
Aplicar las tres preguntas de la seccion 2. Si es ampliacion, se edita el post viejo y se termina aqui.

### Paso 2: Elegir el slug
Formato de la seccion 4. Verificar que no choque con nada:

```bash
cd "/Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted"
ls blog/ es/blog/ | grep -i "<palabra-clave>"
grep -rn "<slug-propuesto>" _redirects sitemap.xml
```

### Paso 3: Crear el archivo
- EN: `blog/<slug>.html` con `<html lang="en">`
- ES: `es/blog/<slug>.html` con `<html lang="es">`

Lo mas facil es copiar un post reciente del mismo idioma y reemplazar el contenido, para heredar la estructura de JSON-LD, el bloque "En corto" y las clases de CSS.

Obligatorio en el `<head>`:

| Etiqueta | Valor |
|---|---|
| `<link rel="canonical">` | `https://ivaestudios.com/blog/<slug>` (sin `.html`) |
| `<link rel="alternate" hreflang="…">` | Solo si existe el gemelo en el otro idioma, y el gemelo debe apuntar de vuelta. El destino de un hreflang **nunca** puede ser una URL que redirige |
| JSON-LD `Article` | Con `datePublished`, `description`, `image` y categoria. `generate_blog_grid.py` lee de ahi, si falta el JSON-LD el post no aparece en el indice |

**No se toca `_redirects`.** Un post nuevo no necesita ninguna regla.

### Paso 4: Enlazarlo de verdad
Este es el paso que mas se salta y el que mas duele. Hoy 161 posts tienen **un unico** enlace entrante, y ese enlace es el indice del blog. Un post que solo cuelga del indice es un post que Google casi no visita.

- Minimo **3 enlaces entrantes** desde posts hermanos del mismo tema o desde la pagina pilar de su categoria.
- Minimo **2 enlaces salientes** hacia otros posts, ademas de la pagina pilar.
- El primer enlace del cuerpo va hacia su pagina de dinero, con el termino comercial como texto del enlace.

### Paso 5: Regenerar indice y sitemap

```bash
python3 scripts/generate_blog_grid.py     # blog.html y es/blog.html
python3 scripts/update_sitemap.py         # sitemap.xml
```

`generate_blog_grid.py` escribe tres bloques en cada indice: `AUTOGEN-FEATURED` (el post mas reciente), `AUTOGEN-CARDS` (las 10 tarjetas siguientes) y `AUTOGEN-ARCHIVE` (el listado completo). Si el script imprime `AUTOGEN-ARCHIVE markers missing`, alguien borro los comentarios marcadores del indice y hay que reponerlos.

### Paso 6: Auditar antes de subir

```bash
python3 scripts/audit_links.py --fail-on-broken   # ningun enlace interno roto
python3 scripts/audit_seo.py --fail-on-error      # titulos, canonical, H1, schema
python3 scripts/validate_hreflang.py              # pares EN/ES reciprocos
python3 scripts/update_sitemap.py --check         # el sitemap quedo al dia
```

### Paso 7: Desplegar
Commit y push a `main`. Cloudflare Pages publica en aproximadamente 1 minuto. El workflow `SEO - Index URLs` se dispara con el mismo push y pide a Google que recorra las paginas cambiadas; `SEO - IndexNow` avisa a Bing.

### Paso 8: Verificar en vivo, no en el archivo

```bash
curl -o /dev/null -s -w "%{http_code}\n" https://ivaestudios.com/blog/<slug>
```

Debe devolver 200. Y si en este trabajo se toco `_redirects`, verificar tambien el origen de la **ultima** regla del archivo: si devuelve 404, el archivo se paso del presupuesto.

---

## 9. Señales de que el ecosistema se esta degradando

Sintomas concretos, con la prueba que los detecta.

| Señal | Como se ve | Como se comprueba |
|---|---|---|
| **`_redirects` pasa de 90 reglas** | La ultima regla del archivo devuelve 404 en vivo | `awk '!/^[[:space:]]*(#\|$)/{n++} END{print n}' _redirects` |
| **Aparecen alias sin evidencia** | Reglas cuyo origen no sale en Search Console, ni tiene enlaces, ni existio en git | Grep del origen sobre todo el repo: si solo aparece en `_redirects`, sobra |
| **Una URL del sitemap da 404** | Fue lo que paso el 2026-08-07 con 31 URLs | `curl` a cada `<loc>` del sitemap, o el informe de cobertura de Search Console |
| **Un enlace interno apunta a un origen de `_redirects`** | El usuario paga un salto extra y el enlace depende de una regla fragil | `audit_links.py`, cruzando hrefs contra los origenes del archivo |
| **Un post vivo aparece como origen de un 301** | La regla es inerte: Pages sirve el archivo y nunca la aplica | Cruzar origenes de `_redirects` contra los archivos en disco |
| **Un archivo se sirve en dos URLs a la vez** | Los enlaces internos se parten. Hoy pasa con 6 paginas de dinero: 261 paginas enlazan `/luxury-weddings` y solo 157 enlazan la canonica `/destination-wedding-photographer-mexico` | Comparar el `<link rel=canonical>` de cada archivo contra las reglas 200 del `_redirects` |
| **Dos URLs con el mismo `<title>`** | Google elige una y descarta la otra. Hoy hay un caso exacto: `/es/fotografo-bodas-cancun` y `/es/blog/fotografo-boda-cancun` | `audit_seo.py`, o agrupar titulos por idioma |
| **Un post nuevo con mas del 60% de palabras del slug repetidas** | Duplicado de intencion naciendo | Comparacion Jaccard de slugs del mismo idioma antes de publicar |
| **Posts que no reciben enlaces salvo del indice** | 161 posts estan asi hoy. Sin enlaces contextuales el post no compite | Grafo de enlaces internos: contar entrantes excluyendo `blog.html` y `es/blog.html` |
| **Un `hreflang` apunta a una URL que redirige** | Google descarta el par. Hoy hay un caso: `es/blog/estilo-fotografo-lujo-editorial-vs-documental.html` | `validate_hreflang.py` mas verificacion de que el destino da 200 sin saltos |
| **El sitemap y el indice del blog se desincronizan** | Un post publicado que Google nunca encuentra | `update_sitemap.py --check` mas `generate_blog_grid.py` seguido de `git diff --exit-code` |

**Umbral de control de contenido:** ningun par de posts del mismo idioma debe superar el 20% de 7-gramas compartidos en el cuerpo. Medido hoy sobre 45,711 pares: solo uno lo supera (los dos posts de marketing de bodas, al 27%). El cuerpo del blog esta sano.

---

## 10. Los invariantes, en una tabla

Estos son los que una prueba automatica puede verificar. Si alguno se rompe, el build deberia fallar.

| # | Invariante |
|---|---|
| 1 | `_redirects` nunca supera **90 reglas** no comentadas |
| 2 | El origen de la **ultima** regla del archivo debe responder 301 o 200 en vivo, nunca 404 |
| 3 | Ninguna URL del `sitemap.xml` puede depender de una regla de `_redirects`: toda URL del sitemap resuelve a un archivo del repo |
| 4 | Ninguna regla puede tener como origen una ruta que exista como archivo en el repo |
| 5 | Ningun post vivo (archivo presente en disco) aparece como origen de una regla |
| 6 | Todo href interno resuelve 200 usando **unicamente las primeras 100 reglas** de `_redirects` |
| 7 | Ningun href interno apunta a un origen listado en `_redirects` (cero saltos 3xx internos) |
| 8 | Todo archivo `blog/<slug>.html` tiene canonical exactamente `https://ivaestudios.com/blog/<slug>` |
| 9 | Toda URL del `sitemap.xml` tiene al menos 1 enlace interno entrante |
| 10 | Todo post tiene al menos 2 enlaces entrantes que no sean `blog.html` ni `es/blog.html` |
| 11 | Todo `hreflang` apunta a una URL que devuelve 200 sin saltos, y el destino declara el hreflang inverso |
| 12 | Todo archivo bajo `blog/` declara `lang="en"`; todo archivo bajo `es/blog/` declara `lang="es"` |
| 13 | Ningun par de URLs indexables del mismo idioma comparte el `<title>` exacto |
| 14 | Cantidad de archivos `blog/*.html` + `es/blog/*.html` = URLs `/blog/` y `/es/blog/` en el sitemap = enlaces en el bloque `AUTOGEN-ARCHIVE` |
| 15 | Toda regla nueva lleva un comentario con su origen de evidencia (GSC, enlace, o historial de git) |

---

## 11. Pendientes conocidos al 2026-08-07

Verificados en vivo hoy, todavia sin arreglar. Van aqui para que la proxima sesion no los redescubra desde cero.

| Pendiente | Detalle |
|---|---|
| `/es/gestion-redes-sociales` da 404 con 7 paginas enlazandolo | Su regla es la #154, muy pasada del corte. Lo enlazan `es/comparativa/fotografos-lujo-cancun.html` y las 6 paginas de `es/locaciones/`. El arreglo barato es cambiar los 7 href a `/es/manejo-redes-sociales`, que si existe como archivo y cuesta 0 reglas |
| 19 URLs de post reales estan en 404 por quedar fuera del corte | Entre ellas `/blog/honeymoon-photographer-cancun` y `/blog/outfit-guide`. Se rescatan borrando alias sin evidencia y subiendolas |
| `scripts/audit_links.py` no conoce el corte de 100 | `load_redirect_sources()` acepta como valida cualquier regla del archivo sin importar su posicion, asi que hoy el auditor de CI es incapaz de detectar el problema que causo el incidente |
| CI no valida sitemap ni indice del blog | `link-audit.yml` solo corre `audit_links.py` y `audit_seo.py`. Faltan `update_sitemap.py --check` y `generate_blog_grid.py` con `git diff --exit-code` |
| 6 paginas de dinero se sirven en dos URLs cada una | Unos 833 enlaces internos aterrizan en la variante no canonica. El arreglo limpio es renombrar los archivos al nombre canonico y borrar las 6 reglas 200 |
| `post-luxury-photographer-style-editorial-vs-documentary.html` sigue en la raiz | Ver seccion 7 |
| 2 migas de pan rotas | `/comparison` y `/es/comparativa` dan 404 desde `comparison/luxury-photographers-cancun.html` linea 148 y `es/comparativa/fotografos-lujo-cancun.html` linea 147 |
| `seo/playbooks/marketing-intake-setup.md` linea 12 afirma alias vivos que dan 404 | `/intake`, `/ivae-marketing/intake` y `/strategy-brief` estan bajo el corte. O se suben o se corrige la documentacion |

---

## 12. Documentos relacionados

| Archivo | Que contiene |
|---|---|
| `seo/geo/INCIDENTE_REDIRECTS_2026-08-07.md` | El incidente de las 31 URLs en 404: sintoma, causa raiz, arreglo y prevencion |
| `_redirects` (cabecera) | El aviso del limite de ~100 reglas y el orden por tiers, dentro del propio archivo |
| `seo/AGENTS.md` | Notas historicas de SEO. Ojo: contiene afirmaciones desactualizadas sobre alias que hoy dan 404 |
