# Carruseles de Instagram — informe operativo para IVAE Marketing

Síntesis de 218 hallazgos que ya pasaron por criba adversarial (11 ángulos de investigación + 11 de refutación). Todo está deduplicado y ordenado por **valor real** = cuánto mueve el resultado entre lo que cuesta implementarlo.

**Cómo leer las marcas:**

- `[N ángulos]` — en cuántos ángulos independientes apareció el mismo hallazgo con otro nombre. **5 o más = ley.** 1 = idea suelta, se prueba, no se codifica como bloqueo.
- `⚠ CONTRADICE` — tumba algo que ya creíamos o que dijimos en la ronda anterior.
- `🔧 BUG VIVO` — está roto hoy en producción, con archivo y línea.
- Los números que traen fuente rastreable se conservan. Los que no la traían se quitaron y quedó el principio. Hay una lista de lo tumbado al final.

Lo que ya sabemos y **no** se repite aquí: el feed se ve al 36%, los pisos de tamaño de fuente, la píldora 1/5 arriba a la derecha, los ~160px de interfaz abajo, el recorte 3:4 de la cuadrícula del perfil, el marco editorial, la cursiva como acento y el formato seamless.

---

## 1. LO URGENTE

### Publicidad de salud sin cédula profesional en el lienzo = incumplimiento hoy mismo

Es lo único de este informe con consecuencia legal. **Verificado contra la fuente primaria**, no contra blogs de despachos.

#### Qué exige la ley, con la cita exacta

**Reglamento de la Ley General de Salud en Materia de Publicidad** (Cámara de Diputados, última reforma DOF 08-09-2022) — https://www.diputados.gob.mx/LeyesBiblio/regley/Reg_LGS_MP.pdf

> **ARTÍCULO 19.** Quienes ejerzan las actividades profesionales, técnicas y auxiliares y las especialidades a que se refiere el Capítulo I del Título Cuarto de la Ley, deberán expresar en la publicidad que realicen al respecto, **cualquiera que sea el medio publicitario de que se trate**, la institución educativa que les expidió el título, diploma o certificado correspondiente y, en su caso, el número de cédula profesional.

«Cualquiera que sea el medio publicitario» incluye Instagram. No hay excepción para redes sociales.

Los demás artículos que amarran el caso, del mismo Reglamento:

| Artículo | Qué dice | Consecuencia para nosotros |
|---|---|---|
| **Art. 86 fr. I** | Requiere presentar **aviso** ante la Secretaría la publicidad de «actividades profesionales, técnicas, auxiliares y las especialidades a que se refiere el Capítulo I del Título Cuarto de la Ley» | El dentista/terapeuta necesita aviso de publicidad, y es trámite del cliente, no nuestro |
| **Art. 87, último párrafo** | Ese aviso «deberá presentarse dentro de los **cinco días previos** al inicio de la difusión» | Ojo: es **antes**, no después. Los demás avisos del Reglamento van 5 días *posteriores*; el de actividades profesionales va *previo* |
| **Art. 79 fr. I** | Requiere **permiso** la publicidad relativa a «Prestación de servicios de salud, **salvo cuando se trate de servicios otorgados en forma individual**» | La clínica como establecimiento → permiso. El profesional que atiende en lo individual → basta el aviso |
| **Art. 87 fr. VI** | El aviso se acompaña de «los documentos que den sustento a las **afirmaciones categóricas** hechas en la publicidad» | Todo testimonio con resultado y toda cifra de la clínica necesita respaldo documental archivado **antes** de publicar |
| **Art. 18 fr. II** | No se autoriza la publicidad que ofrezca tratamientos «cuya eficacia no haya sido comprobada científicamente» | Base dura de la lista negra de promesas |
| **Art. 9 fr. I, II y III** | La publicidad no es comprobable cuando «induzca al error», «oculte las contraindicaciones necesarias» o «exagere las características o propiedades» | «Oculte las contraindicaciones» es la base legal del slide *«cuándo NO es esto»* |
| **Art. 10 fr. II inciso b** | Leyendas sanitarias en anuncio impreso: «tamaño no menor de **20 puntos de altura** en proporción a una página de 21.5 cm x 28 cm» | Único anclaje normativo de tamaño que existe. Ver el cálculo abajo |

Y el catálogo de quién queda dentro: **Ley General de Salud, art. 79** (Título Cuarto, Capítulo I) enumera medicina, farmacia, **odontología**, veterinaria, biología, bacteriología, enfermería, partería profesional, **terapia física**, trabajo social, química, **psicología**, optometría, ingeniería sanitaria, nutrición, dietología, patología y sus ramas.

#### A qué marcas aplica

| Marca | ¿Aplica art. 19? | Nota |
|---|---|---|
| **SMILE NOW** | **Sí, directo** | Odontología está nombrada en LGS art. 79 |
| **DENTALNOW** | **Sí, directo** | Igual |
| **REGENERIS THERAPY** | **Sí** | Si quien presta el servicio es médico o terapeuta físico — las dos están en la lista |
| **MELISA** | **Condicional** | Aplica si el tratamiento lo presta un profesional de la salud o si se anuncia como servicio de salud. Si es cosmetología pura sin profesional sanitario, art. 19 no aplica, pero sí el art. 62 (publicidad de tratamiento cosmético) y sí la política de Instagram sobre procedimientos cosméticos |
| ADAGIO RH, WASICAFE, PRODUCTIONS, IVAE STUDIOS | No | Fuera del filtro por completo. No les metas la franja legal ni la lista negra: les quita lienzo y no les compra nada |

Son **3 marcas seguras + 1 condicional**, no 4 parejas.

#### Qué hay que poner exactamente en el lienzo

Texto mínimo (el texto final lo firma el abogado o el responsable sanitario de cada clínica; nosotros solo lo reimprimimos, **nunca lo redactamos**):

```
[NOMBRE COMPLETO DEL RESPONSABLE] · CÉD. PROF. [NÚMERO] · [INSTITUCIÓN QUE EXPIDIÓ EL TÍTULO]
```

Y, cuando exista, en el mismo bloque: `PERMISO DE PUBLICIDAD COFEPRIS [FOLIO]` o `AVISO [FOLIO]`.

La leyenda *«Información con fines educativos. No sustituye una consulta.»* **no la exige el Reglamento** — es defensa de oficio, buena idea, pero no la vendas como obligación legal.

**Especificación de la franja `.legal`:**

- Outfit MAYÚSCULAS **36px** en el lienzo de 1080×1350. Derivación del art. 10 fr. II b: 20 puntos = 7.056 mm sobre una página de 21.5 × 28 cm son 2.52% del alto y 3.28% del ancho → **34.0px por alto y 35.4px por ancho** sobre 1080×1350. 36px cumple los dos y libra el piso de arco. *(Es analogía razonada: el art. 10 habla de leyendas sanitarias, no del dato del art. 19. Pero es el único tamaño con anclaje normativo que existe, y es defendible ante una revisión.)*
- `letter-spacing: .06em`, máximo **2 renglones**.
- **Color sólido, jamás `opacity`.** Contraste ≥6:1 medido sobre el píxel compuesto del canvas, no sobre el color declarado en CSS.
- La caja **cierra antes del píxel 1150 de 1350** (los ~160px de abajo son interfaz de IG) y a ≥96px de los bordes laterales.
- Va en el **último slide siempre**, y **además en cualquier slide marcado como resultado, comparación o testimonio**. Razón de producto, no legal: el slide que la gente captura y manda suelto por WhatsApp es el del resultado, no el último. Si la franja solo vive al final, la imagen que circula va sin respaldo.

**Compuerta en el generador:** campos nuevos de marca `responsable_sanitario`, `cedula_profesional`, `institucion_titulo`, `folio_aviso`, `folio_permiso`. Si `sector = salud` y alguno está vacío, **el export queda deshabilitado**. No es advertencia ámbar: es bloqueo.

#### ⚠ CONTRADICE lo que creíamos: el precio NO lo prohíbe COFEPRIS

La ronda anterior dijo «en México COFEPRIS no permite anunciar precios o tarifas específicas de servicios de salud». **Es falso.** El mismo Reglamento dice lo contrario:

> **ARTÍCULO 5.** No estará sujeta a este Reglamento la publicidad que se realice sobre ofertas o promociones comerciales relacionados exclusivamente con el precio de los productos, servicios y actividades […]

Quien castiga el precio es **Instagram**, no la ley mexicana: el contenido que promueve procedimientos cosméticos con incentivo de compra o que incluye un precio se **restringe por edad** (los menores de 18 no lo ven), y eso recorta alcance en contenido **orgánico**, no solo en pauta.

Consecuencia operativa: **el guardrail de precio se queda**, pero por razón de alcance en Instagram y solo en piezas de estética/cosmético (MELISA y lo cosmético de SMILE NOW/DENTALNOW). No lo justifiques ante el cliente como «lo prohíbe COFEPRIS», porque no es cierto y se cae en la primera revisión. Y en piezas marcadas como *promoción de servicio*, si va precio va completo, con moneda y condiciones.

#### Lo que NO pude verificar y por tanto no se afirma

- Que «los testimonios de paciente caen del lado del permiso, no del aviso». No hay artículo en el Reglamento que lo diga. Lo que sí existe es el art. 87 fr. VI: el respaldo documental de las afirmaciones categóricas. Usa ése.
- Los montos de multa que circulan («70 millones de pesos», «1,100 anuncios retirados en 2025», «multas arriba de dos millones»). Vienen de despachos que venden el trámite. No los cites.
- El trámite exacto y su folio se confirman en DIGIPRiS antes de imprimir cualquier folio en un lienzo.

**Fuentes:**
- [Reglamento de la LGS en Materia de Publicidad (DOF 08-09-2022) — arts. 5, 9, 10, 18, 19, 79, 86, 87](https://www.diputados.gob.mx/LeyesBiblio/regley/Reg_LGS_MP.pdf)
- [Ley General de Salud, art. 79 — profesiones del Título Cuarto, Cap. I](https://mley.mx/LGS/articulo/79/)
- [Instagram: restricción por edad a contenido de procedimientos cosméticos con precio o incentivo de compra](https://www.ksl.com/article/46641280/instagram-will-block-content-promoting-weight-loss-products-cosmetic-procedures-to-minors)
- [Meta Transparency Center — Health and Wellness](https://transparency.meta.com/policies/ad-standards/restricted-goods-services/health-wellness/)

---

## ESTRUCTURA

### La ley que reordena todo: cualquier slide puede ser la portada

Apareció en **9 de los ángulos investigados**, con distintos nombres ("segunda
portada", "reentrada por slide no vista", "toda slide es portada"). Es lo único
de esta sección que es ley y lo único que cambia el diseño de la pieza completa.

El mecanismo tiene dos capas, y conviene separarlas porque una está verificada y
la otra no del todo:

- **Verificado en fuente (Buffer, guía del algoritmo de Instagram, 24-mar-2026,
  re-verificado 2026-08-04):** Instagram trata las slides que una persona no vio
  como *contenido nuevo* y le vuelve a mostrar el mismo carrusel más tarde,
  **empezando por la primera slide a la que no deslizó**. No es un truco de
  engagement: es reparto.
- **Atribuido a Mosseri, citado de segunda mano en casi todos los ángulos:** el
  caso particular de quien no desliza nada, a quien se le re-sirve arrancando en
  el slide 2. La cita textual circula ("we'll often give that carousel a second
  chance and automatically move to that second piece of media"), pero solo un
  ángulo dice haberla abierto en primaria. **La regla no depende de ella**: el
  punto de mayor caída de cualquier carrusel es el paso 1→2, así que el slide 2
  es el que más trabaja aunque el mecanismo no existiera.

Consecuencia dura, y es la que hay que grabarse: **ninguna slide puede depender
de la anterior**. Una slide que solo se entiende habiendo leído la de antes se le
sirve a un desconocido como portada rota. Hoy el 100% de los segundos repartos
aterrizan en un slide autorado como continuación.

**Tres reglas mecánicas, implementables hoy:**

1. Campo `titulo` obligatorio por slide, y que sea **frase completa**. Validador
   que bloquea el export si un titular abre con conector de continuidad:
   `/^\s*(y |pero |además|por eso|entonces|también|así que|sin embargo|de hecho|el segundo|la segunda|otro |otra |esto|eso|lo anterior|como te decía)/i`
2. **Banda ancla en la MISMA coordenada en todas las slides**, no solo en la
   portada: `position:absolute; top:88px; left:96px; max-width:600px; font:500 30px/1 Outfit; letter-spacing:.14em; text-transform:uppercase`.
   Contenido: `MARCA · TEMA DEL CARRUSEL`. Va a la izquierda porque la esquina
   superior derecha está ocupada (reservar ahí una caja muerta de ~240×90px en
   espacio 1080). Contenido, no paginación.
3. **Prohibida la slide de relleno** (logotipo, "gracias por leer", foto
   decorativa sin titular). Con la reentrada, una slide de relleno es una mala
   portada servida a un desconocido. Si hacen falta más slides, salen de
   **partir** las densas, nunca de agregar.

**La corrección de tamaño (3 ángulos la señalan, contra 2 que decían lo
contrario):** el slide 2 **NO hereda el piso de 152px**. Ese piso existe
únicamente porque la portada se ve en la cuadrícula del perfil a ~130pt, y el
slide 2 nunca aparece en la cuadrícula. El slide 2 hereda la **autosuficiencia y
el bloque de marca, no el tamaño**. Su piso es el del feed: Outfit minúsculas
≥40px, MAYÚSCULAS ≥30px, Cormorant ≥64px, y para que aguante como puerta de
entrada, titular ≥96px Outfit / ≥120px Cormorant. Meterle 152px solo lo deja sin
espacio para decir algo.

**Y no puede ser gemelo de la portada.** Otra foto u otra composición: un slide 2
idéntico al 1 se lee como publicación duplicada y se descarta.

---

### Cuántos slides: 3 o 8–10. El rango 4–7 es el peor de todos

Cuatro ángulos, y coinciden en lo importante aunque discrepen en el techo.

- El largo **más común** del carrusel (2–4 slides) es el **más flojo** medido
  (Socialinsider, ~22M publicaciones / ~3M carruseles). El engagement cae después
  del slide 3 y repunta a partir del 8.
- Más slides = más superficie de reentrada = más reparto. Socialinsider reporta
  que los carruseles de más de 10 slides obtienen más alcance.
- **CONTRADICE (interno):** otros dos ángulos ponen el techo abajo — "aviso
  arriba de 10", "el noveno ya casi nadie lo ve". Ninguno de los dos trae dataset;
  vienen de blogs de herramientas (carouselli, trymypost, adpicto) que otro ángulo
  revisó explícitamente y descartó por no citar fuente.

**Resolución:** dos modos, y se bloquea todo lo demás.

| Modo | Slides | Para qué | Marcas |
|---|---|---|---|
| **Nota rápida** | 3 | producto, promoción, una idea | WASICAFE, MELISA, IVAE STUDIOS, PRODUCTIONS |
| **Guía** | 8–10 | educativo, servicio de alta consideración | ADAGIO RH, REGENERIS, SMILE NOW, DENTALNOW |

Regla dura del generador: bloquear el rango **4–7** con un aviso que ofrezca dos
salidas — "recortar a 3" o "completar a 8". Tope duro en 10 aunque Instagram
permita 20: arriba de 10 no hay evidencia pública seria, y el riesgo es simétrico
al beneficio, porque por la reentrada **cada slide de relleno es una portada
potencial mala**.

Las cifras de retención por slide que circulan ("25–40% de completado", "la caída
está en el 2", "swipe sano de 60–75%") **no tienen dataset público detrás**: las
quito y dejo el principio. El único punto de caída medido en un dataset grande es
"después del slide 3", y eso es lo que fija la posición 4.

---

### La escalera: qué va en cada posición

Modo guía, 9 slides (el 8 y el 10 se derivan abajo). Cada renglón es una FUNCIÓN,
no una estética — y esa es la forma correcta de nombrar las plantillas que
falten: portada, problema, dato, lista, testimonio, precio, cierre.

| # | Función | Qué va | Registro visual |
|---|---|---|---|
| **1** | **Portada** | El arquetipo con un ancla concreta (precio, ciudad, plazo, número de pasos). No el eslogan. | Editorial / Revista |
| **2** | **Segunda portada** | **El producto o servicio que se quiere vender**, escrito como si nadie hubiera visto el 1 | otra composición que la 1 |
| **3** | **El costo de no resolverlo** | dato duro o consecuencia, frase autónoma | Nota |
| **4** | **RUPTURA** | cambio de registro obligatorio: foto a sangre, cifra sola o inversión de fondo | Mural / campo / dato gigante |
| **5** | **Pago útil** | la información consultable — la razón por la que se guarda | Ficha |
| **6–7** | **Desarrollo** | pasos, pares mito/realidad, qué incluye y qué NO | Nota / Ficha, alternando |
| **8 (n-1)** | **Tarjeta de rescate** | resumen de 3–5 líneas + @handle. Se entiende sola, se captura sola | ruptura de contraste |
| **9 (n)** | **Cierre** | UN verbo, UN canal, UNA razón | Papel |

Para **8 slides** se elimina una de desarrollo (6–7 → 6). Para **10** se parte la
más densa de desarrollo en dos; nunca se agrega una nueva de relleno.

Para **3 slides** (nota rápida): `1` portada, `2` el producto con el dato duro
adentro, `3` rescate y CTA fusionados. No hay ruptura ni desarrollo.

**Posición 2 — el orden es la jerarquía de venta.** Dos ángulos lo sostienen, y
uno trae eye-tracking: Sybil Yang (*IJHM* 2012, pupila/reflejo corneal sobre
menús impresos) encontró que **no existe el "punto dulce"** ni el triángulo
dorado que asume la industria — la gente lee en orden, secuencialmente y con
fijaciones largas. Traducido: lo que más quieres vender va **temprano**, no al
centro ni al final. Ojo con el alcance de la fuente: es un estudio de menús, no
de carruseles, y **no** autoriza decir que "destacar con recuadro no lo respalda
ningún dato" (la saliencia visual sí atrae fijaciones). Lo que autoriza es poner
el best-seller en el slide 2. El generador debe **preguntarlo explícitamente**:
"¿qué producto o servicio quieres vender?" → va al 2.

**Posición 4 — la ruptura.** Dos ángulos, y encaja con el único dato de caída
que sobrevive. El diagnóstico no es falta de ancla: es **exceso de uniformidad**.
Nueve tarjetas de texto con la misma retícula y el mismo peso se leen como PDF,
no como historia; y el slide 4 es el primero que se ve *igual* que el 3, así que
sin novedad visual no hay razón para seguir deslizando. Catálogo de 3 registros
que comparten la MISMA rejilla: **(A)** foto plena con pie micro, **(B)**
tarjeta/panel de texto, **(C)** dato gigante solo (cifra a 240px+, Outfit 900,
`letter-spacing:-.02em`, y debajo la fuente del dato en Outfit 500 MAYÚSCULAS
32px `letter-spacing:.16em`). Reglas: prohibido que **3 slides consecutivos**
usen el mismo registro; el slide más denso del carrusel debe ir seguido de uno
tipo C o A; y la secuencia de plantillas no puede ser una sola repetida.
Prueba de humo humana: leer el carrusel en voz alta seguido — si suena a lista,
falta ritmo.

**Posición 5 — el pago útil, y es una compuerta, no una sugerencia.** Tres
ángulos. La gente **no guarda por gusto, guarda por logística**: guarda lo que no
puede memorizar y va a necesitar después, en otro momento y en otro lugar. Berger
& Milkman (*Journal of Marketing Research* 2012, ~7,000 artículos más enviados
del NYT) ubican la **utilidad práctica** entre los predictores más fuertes de que
algo se reenvíe.

Compuerta antes de exportar: el autor marca UNA slide con `tipo:"referencia"` y
contesta *"¿alguien tendría que reabrir esto dentro de 3 días para hacer algo?"*.
Si no hay ninguna, **la pieza no es carrusel**. Esa slide lleva datos consultables
—lista, precio con lo que incluye y lo que NO, fechas, plazos, medidas, pasos
numerados— **nunca una afirmación de marca**. El sub-tipo más fuerte es el
anclado a una fecha o a dinero, porque obliga a volver.

Catálogo cerrado por marca, para que deje de ser abstracto:

- **DENTALNOW / SMILE NOW** — qué incluye y qué NO incluye el precio;
  recuperación día por día; qué preguntar antes de unas carillas.
- **ADAGIO RH** — calendario legal mexicano (aguinaldo, PTU, prima vacacional).
  Se guarda porque se consulta en su fecha. **Revisar contra la LFT vigente antes
  de publicar**: es contenido legal de cara al cliente.
- **WASICAFE** — proporción de molienda, método paso a paso, horarios.
- **REGENERIS** — cuidados posteriores y contraindicaciones.
- **MELISA** — cuánto dura cada tratamiento y qué no hacer las primeras 48 h.
- **IVAE STUDIOS / PRODUCTIONS** — timeline de boda hora por hora; lista de
  tomas imprescindibles.

**Posición n-1 — el slide que se captura y se manda.** Cuatro ángulos. El
carrusel es el formato que más se guarda y de los que menos se comparte: ahí está
el multiplicador sin usar. Mosseri ha señalado públicamente los **envíos por DM
sobre alcance** ("sends per reach") entre las señales que mejor acompañan al
alcance a no seguidores. Las cifras exactas que circulan (guardados ×9,
compartidos +13%, "3–5× el peso de un like") vienen de segunda mano y sin acceso
al dataset: **las quito**, el principio no las necesita.

Checklist duro del n-1: (a) contiene un número o una lista concreta; (b) se
entiende **sin** los slides anteriores — mismo regex de anáforas que el slide 2,
y sin nombres propios que solo existan en slides previos; (c) el @handle está
**dentro del lienzo** en Outfit MAYÚSCULAS ≥30px; (d) ruptura de contraste
respecto al resto (si la tira va oscura, este va Papel; si va clara, este va a
sangre oscuro); (e) todo el contenido a ≥96px de los bordes y ≥200px del borde
inferior, porque va a circular como **captura de pantalla con interfaz encima**;
(f) cero flechas, cero "continúa". La prueba del pulgar: si al mandarle a alguien
SOLO esa imagen se entiende, pasa.

Regla de copy: sirve como *"esto es para ti"*, no como *"en conclusión"*. Es el
único slide donde el copy puede ser una afirmación tajante.

**Posición n — el cierre. Seis ángulos y un hueco de producto.** De las 8
plantillas que existen, **ninguna es de cierre**. El último slide es el único que
ve alguien que ya dio 20–40 segundos, es desde donde se pulsa guardar (el
guardado se registra sobre el **post**, no sobre la slide, así que se pulsa donde
la persona esté parada — y quien completó está en la última) y, por la reentrada,
puede ser la primera impresión de otra persona. Gastarlo en logo gigante +
"Síguenos para más" tira el metro cuadrado más caro de la pieza.

Novena plantilla, **"Rescate"**: misma rejilla y mismo ancla que el resto.
Titular de resumen + una sola acción. **No aplica el piso de 152px** — ese piso
viene de la cuadrícula del perfil y la última slide nunca es la miniatura del
perfil; se lee en el feed, así que basta ≥96px Outfit / ≥120px Cormorant, y así
queda aire. El CTA baja al pie en micro-tipografía (Outfit MAYÚSCULAS ≥30px, la
misma coordenada de la banda ancla) y **no ocupa slide propia**.

Fórmula del CTA, un solo campo por carrusel, un solo verbo en imperativo:
**[1 verbo blando] + [1 canal] + [1 razón concreta]**. *"Si quieres el precio
exacto de tu caso, escríbenos por WhatsApp y te lo mandamos hoy."* En México el
canal es WhatsApp, no el link en bio. Todo lo demás (arroba, sitio, teléfono)
baja a la micro-tipografía del marco, nunca a botón.

- **Lista negra del linter de cierre:** `comenta`, `etiqueta a`, `menciona`,
  `comparte con N`, `dale like`, `doble tap`, `vota`, `síguenos para más`,
  cualquier cuota numérica. Meta define engagement bait como pedir explícitamente
  votos, compartidos, comentarios, etiquetas o reacciones, y **degrada la
  distribución** de quien lo hace. Coincide con la regla que ya tienen de no
  pedir comentarios.
- **Permitido:** `guarda`, `escríbenos`, `agenda`, `pide`, `mándanos`. En esa
  enumeración de Meta **"guardar" no aparece**, así que *"guárdalo"* es seguro y
  *"comenta la palabra GUÍA"* no.
- El envío se pide **nombrando al destinatario**, no dando una orden:
  *"mándaselo a quien lleva tres años diciendo que va a ir al dentista"*.
- Si la marca insiste en dos acciones, se reparten: *"guárdalo"* en el n-1,
  *"escríbenos"* en el n.
- Deshabilitar en el generador los tipos de slide **"solo logotipo"** y
  **"gracias por leer"**.

---

### Antes / después: dos slides pareados, nunca partido a la mitad

Dos ángulos, y el argumento decisivo es aritmética del propio lienzo, no una
opinión de diseño. El *split* vertical (antes a la izquierda, después a la
derecha) dentro de un mismo slide es la solución obvia y la peor: en 1080×1350 le
deja a cada foto **540×1350, relación 2:5**. No existe encuadre de rostro que
sobreviva ahí. Y partir el resultado en dos slides convierte la curiosidad en el
swipe, que es lo que el reparto mide.

Plantilla **"Revelación"**, par de slides N / N+1:

- **(a) Encuadres enlazados.** `--crop-scale`, `--crop-x` y `--crop-y` viven en el
  contenedor del **par**, no en cada slide. Ambos `<img>` con `object-fit:cover` y
  el **mismo** `object-position`. Mover el encuadre de uno mueve el otro, y el
  export falla si difieren.
- **(b) Cero grade.** `filter:none !important; mix-blend-mode:normal;` y prohibida
  cualquier capa hermana con blend encima de esa caja. Las guías de publicidad
  comparativa tratan la diferencia de luz, ángulo o edición entre el antes y el
  después como **el defecto que invalida la prueba** — y el grade de marca cuenta
  como edición. El color de la marca vive solo en el marco, la banda y la
  tipografía.
- **(c) Etiquetas.** `ANTES` / `DESPUÉS` en Outfit MAYÚSCULAS 30px sobre **banda
  sólida que no toca la zona comparada**. Nada de velo degradado encima del píxel
  del resultado.
- **(d) Campo por foto `clinica: true|false`.** Con `true`, el generador la
  bloquea en los slides **1 y 2** y de la 3 en adelante solo la permite
  **enmarcada** con el motor de Papel (marco hueso ≥80px por lado), nunca a
  sangre. Razones: las normas de anuncios de salud de Meta restringen primeros
  planos de partes del cuerpo e imágenes de antes/después, y **el rechazo llega
  tarde** (mismo patrón que los reels en HEVC: cuesta el mes). Y la portada se
  queda para siempre en la cuadrícula del perfil: es la cara del negocio.
- **(e) Prohibido en CSS:** partición vertical, corte diagonal y el "slider" con
  manija falsa (se ve arrastrable y no lo es). Si de plano tiene que ir en un solo
  lienzo, **partición horizontal**: dos cajas de 1080×675 apiladas (8:5 por foto,
  que sí es un encuadre usable).

**Franja legal, y no solo en el último slide.** Dos ángulos. La regulación
mexicana de publicidad sanitaria exige que la publicidad de servicios
profesionales de salud exprese la **institución que expidió el título** y el
**número de cédula profesional**. El caption no cuenta como "visible": no viaja
cuando alguien guarda la imagen, la re-comparte o la ve en la cuadrícula. Y hay
una razón de producto además de la legal: **el slide que la gente re-comparte
suelto es el del resultado, no el último** — si la franja solo vive al final, la
pieza que circula por WhatsApp va sin respaldo.

Implementación: campos nuevos por marca `responsable_sanitario`, `cedula`,
`institucion`; si la marca es `sector:salud` y están vacíos, **el generador no
exporta**. La franja se imprime en el ÚLTIMO slide **y** en cualquier slide
marcado como resultado o comparación. Estilo: Outfit MAYÚSCULAS 30px,
`letter-spacing:.12em`, **color sólido con ≥6.0:1 contra el fondo ya compuesto**
— nada de gris al 60% ni `opacity`. Máximo 2 renglones, la caja cierra antes del
píxel 1190 de 1350 y a ≥60px de los bordes laterales. El **texto exacto lo
confirma el abogado de cada clínica**; el generador solo lo reimprime, no lo
redactamos nosotros. (No pude reverificar el artículo del reglamento en esta
pasada; la regla de producto —campo obligatorio + compuerta— vale igual.)

Aplica a: SMILE NOW, DENTALNOW, MELISA, REGENERIS THERAPY.

---

### Mito / realidad: el hecho manda, y el mito nunca va solo

Tres ángulos. Es de las plantillas más usadas en dental y salud, y casi siempre
se arma **al revés**: el mito enorme en la portada y el hecho chiquito abajo.

La forma correcta es **sándwich** — hecho → mito marcado como falso → hecho otra
vez — con el hecho **siempre más grande que el mito en la MISMA pantalla**. Viene
del *Debunking Handbook* y de la literatura del *truth sandwich*. Honestidad
sobre la fuerza del dato: la evidencia para **cambiar creencias** es mixta; lo
consistente es que **el mito no debe ser lo más prominente**.

Jerarquía invertida respecto a lo habitual (variante derivada de Nota o Ficha):

- **HECHO** en Cormorant ≥64px, contraste pleno.
- **MITO** al 60% del tamaño del hecho, Outfit MAYÚSCULAS ≥30px, etiqueta corta
  encima (*"lo que se dice"*) y tachado fino.
- **PROHIBIDO `opacity` para atenuar el mito.** Es una trampa del propio sistema:
  `opacity:.65` multiplica el color contra la foto, así que un texto que medía
  4.5:1 cae a ~2.9:1 y viola el piso de 6.0:1 que ya exigen para texto chico.
  Se atenúa con un token de color fijo (`--mito:#8A8A8A` sobre panel claro) y se
  valida su ratio contra el fondo real.

Tres candados en el generador:

1. No se puede exportar un slide que traiga **mito sin hecho en la misma
   pantalla**. Un mito solo en un slide es una frase que la marca está afirmando
   cuando alguien pasa rápido o la captura.
2. **El mito nunca en la portada.** La portada es lo único que queda visible para
   siempre en la cuadrícula del perfil, y una cuadrícula llena de mitos se lee
   como si la marca los afirmara.
3. **Máximo 3 pares por carrusel.** Y ojo con la razón: **no** es el "efecto de
   sobrecarga" (los 3 argumentos que ganan a 12) — esa idea fue **atenuada en la
   propia edición 2020 del Debunking Handbook**, así que le quito el número. El
   tope es de longitud: 3 pares = 6 slides + portada + cierre = 8, que es
   exactamente el largo operativo. Si el guion trae más, el generador propone
   **partirlo en dos publicaciones**.

Aplica a: SMILE NOW, DENTALNOW, REGENERIS THERAPY, ADAGIO RH.

---

### El folio nombra la sección, jamás la página

Cuatro ángulos, con el mismo referente: **Courier** (@couriermedia) publica casi
solo carruseles y lo único que cambia entre slides es una línea de
micro-tipografía que nombra la **sección**. Es lo que hace que la tira se lea
como documento y no como pila de imágenes, y es el modelo directo para las marcas
sin banco de fotos, donde el diseño tiene que venir de la estructura.

`.folio` en todas las slides menos la portada, abajo-izquierda:
`position:absolute; left:48px; bottom:196px; font:500 30px/1 Outfit; letter-spacing:.22em; text-transform:uppercase; color:#fff`

- Contenido = etiqueta de sección, **≤24 caracteres en MAYÚSCULAS**:
  `EL PROBLEMA`, `QUÉ HACEMOS`, `ROTACIÓN — ADAGIO RH`.
- **Prohibido `03/10`** y cualquier índice de slide: eso ya lo pinta Instagram.
  Sí se vale `PASO 3 DE 7`, porque es estructura del contenido y su cuenta ni
  siquiera coincide con la de Instagram (portada y cierre no son pasos).
- **Nada de `opacity`.** El `opacity:.72` habitual da ~10:1 sobre negro puro pero
  ~2.9:1 sobre una foto media: a 30px reprueba el piso de 6.0:1 **en la mitad de
  las fotos sin que nadie lo note**. Color sólido sobre velo con alfa ≥.64, o
  mejor: en Nota, Ficha, Revista y Papel el folio vive en el margen hueso y no
  toca la foto.
- Es un **slot único**: si algún día quieren meter `DESLIZA →`, reemplaza al
  folio, no conviven.
- En el editor de guion, campo "sección" por slide; si va vacío, hereda el de la
  slide anterior.

---

### CONTRADICE lo que ya hacemos

1. **Panorámica y Mural rompen la ley de reentrada.** Su slide 2 suele ser el
   pedazo más mudo de la tira, y una tira que se sirve por la mitad a un
   desconocido es una portada rota. Fix: la costura seamless **solo puede correr
   de la slide 3 en adelante**, y aunque la imagen cruce, el texto que cae en cada
   slide tiene que ser **frase completa** — el pie que corre por la tira no cuenta
   como frase. El validador de conectores aplica igual.
2. **El slide de gesto sin texto no puede ir en el 2.** Un ángulo lo pedía ahí
   para WASICAFE (el vertido, el vapor, la leche cayendo). Pierde: **el slot "sin
   texto" queda bloqueado en las posiciones 1 y 2** y permitido de la 3 en
   adelante. Es exactamente la posición 4 de ruptura, así que no se pierde nada.
3. **De las 8 plantillas, ninguna es de cierre.** El hueco no es estético, es
   estructural: hoy el generador no puede producir una tarjeta de rescate.
4. **El generador encoge en silencio y encoger rompe la estructura.** Verificado
   en código: `carrusel-gen.js:339` manda el titular a `.sm` con más de 46
   caracteres, y en portada eso lo baja de 152px a 126px
   (`plantillas.js:175-176`), o sea **por debajo del piso que ustedes mismos
   fijaron para la cuadrícula**. Además `carrusel-gen.js:361` puede escalar el
   bloque a 0.80 (`.support` 42→33.6, `.pill` 39→31.2), y el `miniCSS` de la
   línea 374 **rehace el bloque con la geometría de Editorial sea cual sea la
   plantilla activa** — en Panorámica eso pisa los 168px de carril que existen
   para que la costura no parta una palabra. El generador no puede arreglar un
   texto largo: **solo puede avisar para que se corte**. En portada, prohibir
   `.sm`: si el titular pasa de largo, se deja en 152px y el slide se marca en
   ámbar.
5. **El presupuesto real de la portada es de ~30 caracteres, no de 46.** Medido
   sobre los `.woff2` del propio repo: Outfit MAYÚSCULAS avanza 0.655 em/carácter
   → a 152px en el carril de 872–900px caben **8–10 caracteres por renglón**.
   `ORTODONCIA` mide 1018px: **no cabe en una línea en ninguna de sus dos
   fuentes**. Regla de escritura para la posición 1: **3 a 6 palabras, ≤30
   caracteres con espacios**, y ninguna palabra de más de 11–12 caracteres.
   (El detalle por fuente y caja va en la sección de tipografía.)
6. **El caption tiene que repetir los titulares.** Un carrusel es literalmente una
   imagen de texto; WCAG 2.2 §1.4.5 (AA) lo desaconseja y ningún lector de
   pantalla lee lo que está quemado en el JPEG. El único canal accesible es el
   caption y el texto alternativo. Regla de cierre: **el caption debe contener,
   literal, el titular de CADA slide** — el generador ya arma el guion por slides,
   basta concatenarlo. Sumarlo al escáner que ya corre antes de cerrar trabajo de
   marketing, en el mismo lote que hashtags-en-caption y
   guion-en-campo-equivocado.

---

### Ideas sueltas (1 ángulo cada una): útiles, sin peso de ley

- **Pies de foto individuales por slide.** Un ángulo reporta que Meta anunció el
  20-jun-2026 un selector "caption individual / caption única" al publicar un
  carrusel. Cambiaría lo que entrega el generador: imágenes + N textos, y sería la
  vía para bajar el detalle al pie y dejar el titular corto dentro de la imagen.
  **Fuente única y despliegue progresivo por región: hay que confirmarlo en la app
  de Instagram de una marca antes de prometérselo a Vianey.** Si existe, el campo
  "pie" por slide va junto al "alt SEO" que ya hay, con botón de copiar por slide
  — y respetando la regla de la casa de que copiar "nada" vacía el portapapeles.
- **Si le pones música, el recorte cambia a 9:16.** Un carrusel con audio agregado
  **al publicar** queda elegible para la pestaña de Reels, donde la miniatura es
  9:16: recortar 1080×1350 a 9:16 deja **759px de ancho**, o sea se pierden ~160px
  por lado y el titular de portada queda decapitado. Interruptor "va con música"
  en el generador: encendido, la portada sube sus márgenes laterales de 48px a
  170px y el titular baja su ancho máximo a 740px — lo que obliga a un titular más
  corto y más grande, que es justo lo que la cuadrícula ya pedía. El audio se
  agrega **al momento de publicar**; agregado después no cuenta.
- **Sangrado de continuidad** para reducir la caída sin recurrir a fotos
  panorámicas: una regla o un numeral cortado 48px en el borde derecho del slide N
  que reaparece completándose en el borde izquierdo del N+1
  (`overflow:hidden` + elemento en `right:-48px`). Da la señal de "sigue" sin
  pintar puntos propios ni duplicar la píldora de Instagram.
- **Ángulo de foto y aire para el texto** (aplica a WASICAFE, MELISA, IVAE
  STUDIOS, PRODUCTIONS): el 3/4 descendente pone el sujeto en el tercio inferior →
  el texto va **arriba** (`padding-top:~14%`); el cenital centra el sujeto → el
  texto va en banda lateral o inferior, **nunca encima del plato**. Etiquetar cada
  plantilla con el ángulo que espera (Editorial y Ficha = 3/4; Mural y Panorámica
  = cenital) y avisar cuando no coincide.

---

### Nota de alcance

Cinco de las siete marcas (SMILE NOW, DENTALNOW, ADAGIO RH, REGENERIS, WASICAFE)
**no tienen banco de fotos**, y las 8 plantillas actuales se arman todas alrededor
de una imagen. Eso afecta la estructura en dos posiciones concretas: la **ruptura
del 4** y el **slide de gesto** no existen para ellas si dependen de una foto. La
salida estructural es que el registro (C) —dato gigante, cita, captura de
resultado— cubra esas posiciones. El desarrollo del **modo campo / sin foto** va
en la sección de plantillas y sistema, no aquí.

---

## LEYES DE SERIE

Los 5 lotes que revisé (negocio, dental, café, RH, restaurante — 40 plantillas) coinciden en una cosa
antes que en cualquier detalle: **una plantilla buena no diseña un slide, diseña dos capas.** Una capa de
CROMO que no se mueve ni un píxel en los N slides, y una capa de CONTENIDO que está obligada a cambiar.
Todo lo que se ve "hecho a mano" pasa en la segunda; todo lo que hace que 5 imágenes se lean como UNA
pieza pasa en la primera.

Y hay una capa más que nuestras 8 plantillas no tienen: el **rol**. Editorial, Revista, Nota, Ficha,
Suave, Mural, Panorámica y Papel describen cómo se ve *un* slide. Ninguna sabe si ese slide es tapa,
interior o cierre. Las 40 plantillas de Canva sí: sin excepción hay reglas que solo aplican al 1, solo
al último, o solo a los de en medio. Esa es la pieza que falta.

---

### LEY 1 — La ranura no se mueve; el inquilino sí
**Apareció en los 5 rubros** (≈20 plantillas). Es la ley más repetida de todo el corpus y también la más
barata de implementar.

Hay un elemento —píldora de marca, riel de pie, etiqueta de esquina— clavado a una coordenada literal,
idéntica al píxel en todos los slides. Lo medí en `dental--EAG8Mj_z6iM`: la píldora blanca de marca está
en x=109, y=109, 390x69px con radio 34 en **los 5 slides** (verifiqué la imagen: en el cierre sigue ahí,
sin moverse). En `cafe--EAHAV2rNlVw` son cinco elementos congelados a la vez. En `restaurante--EAHOcgjKJJQ`
las dos píldoras del pie tienen margen 110px izq / 113px der en todos.

**Se repite idéntico:** posición, tamaño, radio, peso tipográfico, color.
**Varía:** únicamente la cadena de texto que carga, y solo por rol.

Los tres inquilinos que vi, en orden de utilidad:

| Ranura | Tapa | Interiores | Cierre |
|---|---|---|---|
| Etiqueta derecha | `Swipe ›` | `Swipe ›` | `Dental 2026` / `Guarda 🔖` |
| Ranura de pie | CTA (`READ MORE →`) | folio (`2`, `3`, `4`) | bloque de compartir |
| Ranura izquierda | marca / @handle | tema de la serie | @handle solo |

```css
.riel{position:absolute;left:110px;right:110px;bottom:180px;height:64px;
      display:flex;align-items:center;justify-content:space-between}
.slide:last-child .riel{justify-content:center}
.slide:last-child .riel .swipe{display:none}
```

**Sub-ley: la flecha muere en el último slide.** 5 plantillas del lote negocio traen marca de swipe; en
las 5 (100%) desaparece en el cierre. `.slide:last-child .swipe{display:none}` — nada más. Y si la
plantilla NO define cierre, no pintes flecha en ninguno: la última estaría mintiendo.

**Sub-ley: el ladillo repone el tema.** En 3 rubros (`negocio--EAFo5tgHCpY`, `rrhh--EAGwGpj0xwU`,
`negocio--EAFOurGAAUY`) el titular de la portada reaparece del slide 2 en adelante como cornisa en
versalitas chicas, en la misma coordenada donde la portada ponía la marca. Resuelve el caso real: alguien
entra por el slide 4 desde una recomendación y no sabe de qué va.

```css
.ladillo{position:absolute;top:81px;left:0;right:0;text-align:center;
         font:600 34px/1 Outfit;letter-spacing:.22em;text-transform:uppercase;opacity:.62}
```
El generador lo llena solo: es el h1 de la portada truncado a ~40 caracteres, **nunca texto nuevo**.
34px porque en MAYÚSCULAS no bajamos de 30px.

**CONTRADICE / correcciones obligatorias para IG:**
- Canva pone el riel a ~103px del pie. Eso cae **dentro** de los ~160px de interfaz de Instagram.
  Súbelo a `bottom:180px` (borde inferior en y=1170 sobre 1350).
- La etiqueta arriba-derecha (`Swipe ›` en dental, `Save 🔖` en café) cae **debajo de la píldora 1/5**
  de Instagram. O la bajas al pie, o dejas solo la marca a la izquierda.
- En **Panorámica y Mural** esta ley se invierte: un riel repetido en cada slide tartamudea sobre un
  fondo continuo. Ahí el cromo va SOLO en tapa y cierre.

---

### LEY 2 — Tapa y cierre son gemelos; los interiores son la excepción
**Apareció en los 5 rubros.** Es el patrón que más veces salió con nombres distintos ("bookends",
"gemelos tipográficos", "la misma composición al 66%", "el cierre rompe la geometría"). Todos dicen lo
mismo: **el cierre se parece a la portada, no al interior anterior.**

La serie tiene ritmo **A–B–B–B–A**, no A–B–B–B–C. Ese es el error que se comete solo: diseñar una
"pantalla de cierre" aparte.

Lo que cinco lotes distintos reservan para las tapas, es decir **prohibido en interiores**:

- **Fondo invertido** — `negocio--EAFOurGAAUY`: slides 1 y 5 negros con texto crema; 2, 3 y 4 gris
  #EDEEE9 con texto negro. La inversión pasa exactamente dos veces.
- **Cursiva** — `negocio--EAFo5tgHCpY`: portada en serif cursiva gigante, cierre remata con la URL en
  cursiva, los 5 interiores en romana y nada más.
- **Negrita o versales** — `cafe--EAG9jevXP24`: la última frase del titular en negrita en el 1 y en el 7;
  los slides 2–6 son 100% finos. `cafe--EAHAV2rNlVw` hace lo mismo con la caja: VERSALES en las tapas,
  Capital Inicial en los interiores.
- **El display grande** — `restaurante--EAGc_WzoPRQ`: 01 y 05 son los únicos con serif display (~230px y
  ~197px de cap-height); los interiores 02–04 no tienen **ni un titular**.
- **El logo** — `dental--EAGUgiV_zbg`: el lockup arriba-izquierda y la banda arena al pie solo existen en
  el 1 y el 10. Ningún interior lleva logo.

**Se repite entre tapa y cierre:** retícula, estructura de líneas (mismo número de líneas, mismo ancho de
bloque), el recurso reservado, y por lo menos un elemento que los interiores no tienen.
**Varía:** las palabras, y **una** de estas tres cosas:
1. **Escala** — `dental--EAFu6UXFttM`: el cierre es la portada al ~66% (globo 959x700 → 641x499), y el
   espacio liberado aloja el bloque de contacto.
2. **Una línea menos** — `restaurante--EAHOcgjKJJQ`: el 09 es el 01 con el titular de 2 líneas a 1 y una
   píldora menos. Mismo campo salvia, mismo kicker palabra por palabra, mismo archivo de recorte.
3. **Orden invertido** — `cafe--EAHDReUGHXQ`: la portada va ilustración → título → damero; el cierre va
   título → ilustración → damero → contacto.

```css
.bookend{display:grid;grid-template-rows:auto auto 1fr auto;padding:110px}
.bookend .titular{font-size:var(--t-tapa)}
.s-cierre .swipe,.s-cierre .folio,.s-cierre .ladillo{display:none}
.slide:first-child,.slide:last-child{--bg:#0B0B0B;--fg:#F4F1E8}  /* variante fondo */
```
Si el ornamento es un trazo, defínelo con `currentColor` para que se invierta solo.

**Regla dura:** el cierre lleva **UN** elemento de acción, nunca dos. Fila de iconos de IG (corazón,
comentario, avión — SVG inline de 64px, gap 40px, opacidad .55) **o** píldora CTA
(`border-radius:999px;padding:28px 56px`). Los dos juntos se leen como desesperación.

**Y el CTA de verdad va en la PORTADA.** `dental--EAG8Mj_z6iM` pone la píldora con la URL únicamente en
el slide 1 (x=108, y=1139, 534x70px); los interiores y el cierre no tienen ninguna. Tiene lógica de
plataforma: en la cuadrícula del perfil **solo se ve el slide 1**, es el único con visibilidad garantizada.
Las plantillas de presentación 16:9 hacen lo contrario (guardan todo el contacto para el final) porque su
público ya está cautivo en una sala — no copiar eso a Instagram.

---

### LEY 3 — Dos tamaños de titular y ninguno intermedio
**Apareció en los 5 rubros; en 3 de ellos el agente escribió "9 de 9" o "4 de 4".** Es la constante más
universal del corpus.

No existe una escala tipográfica continua. Existe **el tamaño de tapa** y **el tamaño de interior**, y
nada en medio. Medido: `dental--EAG8Mj_z6iM` da cap-height 165px en portada y cierre, 110px en los tres
interiores, cero valores intermedios. `restaurante--EAGc_WzoPRQ` da ~165px de cap en portada contra 34px
de cuerpo interior. `negocio--EAGwkXuYJpQ`: 135px contra 46px.

**Se repite:** familia, peso, tracking, interlineado. En dental el paso de línea es 0.86 del cuerpo en
**los dos** tamaños (193/165 y 131/110).
**Varía:** solo `font-size`, y solo entre dos valores.

La razón entre ambos cambia con la tipografía, y aquí los lotes se contradicen — con explicación:

- **1.5x** cuando el interior también lleva titular fuerte (sans condensada, 4:5).
- **2.4x** cuando el interior tiene titular + cuerpo.
- **5–7x** cuando el interior **no tiene titular**, solo cuerpo (el display serif de portada contra
  cuerpo de 34px).

```css
:root{--t-tapa:228px;--t-interior:152px}   /* Outfit 800, cap 165 / 110 */
.titular{font-family:Outfit;font-weight:800;text-transform:uppercase;line-height:.86;
         letter-spacing:-.005em;margin:0}
.s-tapa .titular,.s-cierre .titular{font-size:var(--t-tapa)}
.s-interior .titular{font-size:var(--t-interior)}
```
Con Cormorant sube ~18% (cap más baja): 268px / 180px. **Prohibir cualquier otro valor en el generador.**
Si un interior necesita un titular chico, que sea versalitas de 48–56px, nunca 90–120px: ese es el
"tercer tamaño" que rompe la jerarquía y hace que la tira parezca 5 piezas sueltas.

Y el control de mancha, que es más útil que el font-size: **el titular ocupa ≤34% del alto en portada
(≤460px de 1350) y ≤14% en interior (≤190px)**.

---

### LEY 4 — El folio vive solo en los interiores
**Apareció en los 5 rubros.** 6 de 9 plantillas de negocio numeran; 5 de 9 en café; 7 de 9 en RH.

**Se repite:** la ranura (posición, tamaño, color, familia).
**Varía:** el dígito. Y nada más.
**No existe:** en la portada ni en el cierre. `dental--EAFu6UXFttM` empieza a numerar en el slide 2 y
apaga en el 9. `rrhh--EAGh5Vb8kIM` numera 2–7 y desaparece en el 1 y el 8. `cafe--EAG9jevXP24` igual.
Es honesto: la portada no es un capítulo, y quitar el número en el cierre avisa que ese slide ya no es un
ítem de la lista.

Tres volúmenes, y **el volumen decide el tono de la marca** — elige uno por plantilla, no mezcles:

```css
/* FANTASMA — profundidad sin robar lectura (Cormorant 210px detrás del titular) */
.folio--fantasma{position:absolute;top:150px;left:0;right:0;text-align:center;
  font:400 210px Cormorant;color:rgba(0,0,0,.055);z-index:0}
/* PLACA — el número es el ancla visual del slide */
.folio--placa{left:148px;top:175px;width:200px;height:180px;border-radius:24px;
  background:var(--acento);display:grid;place-items:center;font:300 150px Outfit;color:#fff}
/* SUSURRO — manda el nombre, el número acompaña */
.folio--susurro{font:400 50px 'Pinyon Script';color:var(--acento)}
```

**CONTRADICE:** `cafe--EAG9jevXP24` pinta el fantasma a `rgba(255,255,255,.03)` — medido, #232323 sobre
#191919, +6 de luminancia. En pantalla de teléfono con brillo bajo eso **no existe**, igual que el filete
de 1px por debajo de .28. La diferencia es que una masa de 300–600px sí sobrevive a opacidades bajas
donde un trazo de 1px no: el piso útil para masas grandes es **.045–.06**, no .03. Nunca aplicar esa
opacidad a filetes.

**Y el folio NO va arriba a la derecha**: ahí Instagram pinta su propia píldora 1/5. Va abajo-izquierda
(`left:109px;bottom:216px`) o dentro de la ranura de pie de la Ley 1.

---

### LEY 5 — Línea de arranque y línea de flotación: las mismas en todos los slides
**Apareció en 4 rubros.** Es la ley que nadie nota cuando está y todos notan cuando falta.

El texto **se cuelga de arriba, nunca se centra vertical**. En `rrhh--EAGidajzexI` los 5 slides arrancan
su contenido en y=28% clavado — la portada no arranca más arriba por ser portada, solo corre más largo.
En `cafe--EAGtbdPtu8M` el número script está en y≈432 en los tres interiores: cuando el nombre ocupa 3
líneas en vez de 2, la descripción baja de y≈695 a y≈760 y **todo lo de abajo se corre**, pero el ancla no
se movió. En `cafe--EAG_Pp2r1FY` el titular siempre arranca en y≈510 y el párrafo pega a ~8px de la última
línea, sea de 2 o de 4 líneas.

Y abajo pasa lo simétrico: la banda muerta es **la misma en todos**. `cafe--EAG_Pp2r1FY`: el contenido
termina en y≈900 en los 6 slides. `cafe--EAHAV2rNlVw`: 172px de negro entre la tarjeta y el pie, en los 7.
Lo nuevo aquí no es que IG se coma ~160px —eso ya lo sabíamos— sino que **la constancia importa más que
la cantidad**: si un slide llena hasta abajo y el siguiente no, al deslizar el contenido brinca
verticalmente y se lee como error.

**Se repite:** la y de arranque del bloque de texto y la y donde se prohíbe seguir.
**Varía:** cuánto se estira el bloque hacia abajo dentro de ese carril.

```css
.slide{display:grid;grid-template-rows:378px auto 1fr 40px 216px}
/* 378px = 28% de arranque · fila 3 = colchón elástico · fila 4 = ranura del folio
   fila 5 = zona muerta intocable (bajo la interfaz de IG) */
```
**PROHIBIDO** `top:50%;transform:translateY(-50%)` en cualquier bloque con texto variable. La foto sí
puede tener top y height fijos: no crece.
**Validación:** si el contenido de un interior rebasa y=918px (68%), el generador **parte el slide en
dos**, no encoge la tipografía.

---

### LEY 6 — Elige UNA familia de variación: rejilla congelada o rotación por zonas
**Apareció en los 5 rubros.** Y es la única ley con una advertencia explícita: las plantillas buenas usan
una de las dos estrategias, **nunca las dos a medias**.

**Familia A — Rejilla congelada** (5 de 9 en café). Los interiores son clones al píxel y solo cambian
3 cadenas. En `cafe--EAHAV2rNlVw` la placa del número (200x180, radio 24, en 148,175), el titular (x=148,
base y≈530), la flecha punteada (110,700 → 310,915), la tarjeta de cuerpo (455x185, radio 16, en 378,818)
y la barra del pie (790x70, radio 35, en 128,1175) están en la misma coordenada en los cinco. Lo único
que cambia: número, titular, cuerpo.
→ Es la que hace **generable** el sistema: el motor solo inyecta strings. Es la que debemos usar por
default en nuestro generador.

```css
.interior > *{position:absolute}   /* todo con coordenadas literales, cero flex vertical */
```

**Familia B — Rotación por zonas** (negocio, RH, restaurante). El cromo no se mueve, pero la foto y el
texto caminan por posiciones predefinidas. `rrhh--EAGh5Vb8kIM`, 8 slides: foto abajo → columna izquierda
→ abajo → arriba → arriba partida en dos → recuadro derecha → recuadro izquierda. `negocio--EAG--FMuqlo`
gira en sentido horario: abajo, derecha, arriba, izquierda. `restaurante--EAGw3NC0W7A` deja el disco del
número clavado en la esquina superior izquierda y pasea el par título+cuerpo al cuadrante donde la persona
NO está.

```css
.pos-arriba{grid-area:1/1/6/13}   .pos-abajo{grid-area:7/1/12/13}
.pos-izq{grid-area:1/1/13/7}      .pos-der{grid-area:1/7/13/13}
```
**Regla dura de la familia B:** `pos[i] !== pos[i-1]`. Dos slides seguidos jamás con la foto (ni el texto)
en el mismo cuadrante.
**Para qué sirve de verdad:** es la respuesta a "se ve muy plantilla" sin tocar un color ni una
tipografía, y para las marcas con poco banco de fotos **la misma foto rotada de posición parece material
nuevo**.

Variante barata de la B que funciona sola: **el mismo esqueleto permutado**. `dental--EAG8Mj_z6iM` usa
los mismos 3 ingredientes en orden distinto cada slide (titular→tarjeta+foto / foto→titular→cuerpo→foto
cortada / titular→cuerpo→remate / titular→dos fotos→cuerpo) y aun así el titular solo puede empezar en
**3 alturas** (y=281, y=586, y=699). Cambia el orden, no las alturas.

---

### LEY 7 — El texto se alinea contra la foto; la tipografía nunca cambia
**Apareció en 3 rubros.** Dos sub-reglas que van juntas.

**(a) Alineación espejo.** `negocio--EAG--FMuqlo` slide 3: foto a la derecha → titular alineado a la
izquierda. Slide 5: foto a la izquierda → titular alineado a la derecha. El borde limpio pega al margen
del lienzo y el **borde dentado queda enfrentado a la foto**, así el canal de aire entre ambos queda
parejo. Si lo alineas al revés, el dentado choca contra el margen y se ve como error de maquetación.

```css
.pos-der .txt{text-align:left}
.pos-izq .txt{text-align:right}
.pos-arriba .txt,.pos-abajo .txt{text-align:center}
```
No es cuestión de gusto: `text-align` lo decide la posición de la foto.

**(b) El eje del titular puede rotar; la tipografía no.** `dental--EAG8Mj_z6iM` recorre izquierda →
centro → centro estirado casi a sangre → izquierda → derecha en 5 slides, con la **misma familia, mismo
peso, mismo color**. Es variación de composición a costo cero: no agrega colores, ni recursos, ni fuentes,
y hace que la 3ª y la 4ª pieza no se sientan "la misma otra vez" en el feed al 36%.
Para el efecto "a sangre" del centro: ajustar font-size hasta que la línea mida ~875px (81% del lienzo).
Nunca justificar el titular, nunca partir palabras.

---

### LEY 8 — Un solo velo cose un banco de fotos disparejo
**Apareció en 3 rubros**, y es el patrón más rentable para las marcas de IVAE sin fotos propias
(dental, RH, terapia, estética).

`cafe--EAG2ZIT-zkQ` tiene 5 fotos que no tienen nada que ver entre sí: una montaña, unas manos sobre una
mesa blanca, una mujer de espaldas en un balcón, una cortina con una monstera. Los 6 slides se leen como
una sola pieza porque todas llevan **el mismo velo oliva** y todo el texto es el mismo serif amarillo
pálido. El velo mata la diferencia de temperatura de color y de saturación entre fotos tomadas en días,
luces y cámaras distintas; lo que queda es composición, y la composición sí la controlamos.

**Se repite:** el HEX del velo, su opacidad, el filtro de la foto y el color del texto.
**Varía:** la foto (puede ser cualquier cosa) y su encuadre.

```css
.foto img{width:100%;height:100%;object-fit:cover;filter:saturate(.45) contrast(.95)}
.foto::after{content:'';position:absolute;inset:0;background:#6B6A4E;
             mix-blend-mode:multiply;opacity:.55}
.copy{position:absolute;left:150px;right:150px;top:520px;text-align:center;
      font:400 46px Cormorant;color:#F5F0A0;line-height:1.32}
```
**El truco del cierre:** cuando no hay una 6ª foto, el cierre usa el **color plano al que tienden las
fotos veladas** (medido: #75706A) en vez de imagen. Sigue perteneciendo a la serie sin foto.

Dos variantes de la misma idea que salieron en otros lotes:
- **Voltear el degradado entre tapa e interior** (`negocio--EAGwkXuYJpQ`): portada con el velo opaco
  arriba y la foto visible en el 45% inferior; interiores con el velo transparente arriba y la foto
  reducida a una banda superior del 30%. Misma foto, misma técnica, respiración distinta. Y garantiza
  contraste AA para el texto sin depender de la imagen.
- **Fondo alternado** (`dental--EAG8Mj_z6iM`): foto a sangre → fondo gráfico (degradado + formas) → foto
  → gráfico. Solo 2 de 5 slides necesitan una imagen fuerte. Regla del generador: si el slide n es
  `.bg-foto`, el n+1 es obligatoriamente `.bg-grafico`.
- **Sin foto ninguna** (`negocio--EAFo5tgHCpY`): cero imágenes en los 7 slides, fondo #F4F4F4, bloque
  colgado del tercio superior y la mitad inferior deliberadamente vacía. El vacío se lee como lujo, no
  como falta — y cae justo donde IG pone su interfaz y el pulgar.

---

### LEY 9 — Sangrar contra un borde siempre; sangrar entero, una sola vez
**Apareció en 3 rubros; ninguno de los 5 la contradice.**

**(a) La foto se corta contra un borde, no flota con sus 4 lados adentro.** `dental--EAG8Mj_z6iM`: en el
slide 3 la foto de abajo arranca en y=1092 y sale por el borde inferior; en el 5 (lo verifiqué en imagen)
una foto se corta por la izquierda y la otra por la derecha, además escaladas en vertical. El corte
sugiere que la imagen sigue más allá del cuadro: **da profundidad sin necesitar una foto grande ni buena**,
que es exactamente el problema de nuestras marcas. La única foto con los 4 lados adentro va emparejada con
una tarjeta blanca del **mismo alto exacto**.

```css
.foto-sangra-abajo{width:calc(100% - 218px);margin:0 109px -100px;height:351px;
                   object-fit:cover;border-radius:28px 28px 0 0}
.foto-sangra-izq{margin-left:-90px;border-radius:0 28px 28px 0}
```
Radio **solo** en las esquinas visibles.

**(b) El sangrado completo está racionado a UN slide por serie.** `restaurante--EAGc_WzoPRQ`: los slides
01–04 conservan margen hueso alrededor de la foto; el 05 es el único borde a borde.
`restaurante--EAHOcgjKJJQ`: 7 interiores tratan la foto como tarjeta contenida, menos el 06. En ninguna de
las 40 plantillas vi dos slides a sangre completa seguidos. Si todos sangran, el sangrado deja de
significar algo; guardado para uno solo, marca el pico emocional o el cierre — y **el contraste de margen
se lee mejor al 36% que cualquier cambio de tamaño de letra**.

```css
.slide{--inset:110px}          /* default en toda la serie */
.slide--climax{--inset:0}      /* exactamente UNO */
```

**(c) Corolario de composición** (6 de 9 en restaurante): los interiores se arman con **dos rectángulos
desalineados a propósito**, no con un 50/50. Uno sangra por la izquierda, otro por la derecha, con
desfase vertical de 30–60px y z-index distinto. El traslape da profundidad sin sombras; el desfase es lo
que evita que parezca error de alineación.

---

### LEY 10 — Un solo vocabulario de forma, que se muda de sitio y cambia de oficio
**Apareció en 3 rubros.**

Una forma —píldora, asterisco, cinta de damero, calcomanía— que aparece en todos los slides pero nunca en
el mismo sitio ni haciendo lo mismo. `cafe--EAHDReUGHXQ`: la banda de damero (teselas de ~70px, siempre 2
filas = 140px de alto) es filete bajo el título en el 1, pie a sangre en el 2, separador en el 3, media
anchura en el 4, y en el 5 **continúa la línea del titular** hacia la derecha. `dental--EAG8Mj_z6iM`:
un asterisco blanco siempre en el cuadrante inferior derecho (227px en portada, 100–155px en interiores),
más otro suelto cortado por el borde izquierdo.

**Se repite:** la forma, el color y **el tamaño de su unidad** (la tesela, el grosor, el radio). Eso es lo
que la hace reconocible.
**Varía:** su posición, su escala total y su función.

Y la distinción que da jerarquía sin meter otro color (`restaurante--EAHHHRzs8v8`, 4 de 9 plantillas):

```css
.pildora{border-radius:999px;padding:14px 30px;border:1.5px solid currentColor;font-size:34px}
.pildora--solida{background:var(--crema);color:var(--tinta);border-color:transparent}
```
**REGLA: contorno = cromo** (handle, tagline, swipe). **Relleno = contenido** (beneficio, precio,
invitación). Nunca al revés. Un vocabulario de UNA forma se lee como sistema de marca; dos formas
distintas se leen como plantilla armada a la carrera.

Corolario para pares: cuando hay **dos** tarjetas lado a lado (`rrhh--EAG8ML6iXG4`, en 3 slides
distintos), la de la **derecha siempre** es la de acento sólido. Ni una vez al revés. Dos tarjetas
idénticas se leen como tabla y el ojo no sabe dónde empezar. Máximo 2: con 3 el patrón se rompe.

---

### LEY 11 — Presupuesto de palabras fijo por rol
**Apareció en 3 rubros, con conteos independientes que coinciden.**

`dental--EAG8Mj_z6iM`: 20, 25, 27, 25, 24 palabras. Los 5 titulares tienen **exactamente 4 palabras** y 3
de 4 arrancan con verbo en imperativo. Lote negocio: portadas de 3 a 9 palabras, interiores de 2 a 5
palabras de titular y 12 a 26 de cuerpo. Lote restaurante: los 9 slides de EAHOcgjKJJQ están entre 20 y 31.
Ningún cuerpo del corpus pasa de ~60 palabras, y los que mejor se leen al 36% van entre 20 y 27.

**Se repite:** el rango de palabras y la forma gramatical del titular. Titulares con la misma forma
(4 palabras, verbo primero) **leen como lista aunque estén repartidos en 5 imágenes**.
**Varía:** las palabras.

Topes duros para el generador, con aviso en ámbar al editor:

| Rol | Titular | Cuerpo |
|---|---|---|
| Portada | ≤6 palabras (+3 de antetítulo) | — |
| Interior | ≤5 palabras / ≤22 caracteres por línea | 20–27 (máx. 35) |
| Cierre | ≤6 palabras | ≤26 |

**Si el texto se pasa, el generador parte el ítem en dos slides. Jamás reduce el font-size** — eso rompe
los pisos de 30px en versales y 40px en minúsculas, y con ellos la Ley 3.

---

### LA MATRIZ (qué se congela, qué se mueve, qué se apaga)

| Elemento | Tapa | Interiores | Cierre |
|---|---|---|---|
| Riel / marca | idéntico | idéntico | idéntico |
| Etiqueta de la ranura | CTA o `Swipe ›` | `Swipe ›` o folio | **cambia** (firma / `Guarda`) |
| Marca de swipe | sí | sí | **apagada** |
| Folio | **apagado** | 2…n−1, solo cambia el dígito | **apagado** |
| Ladillo del tema | **apagado** (es el h1) | idéntico en todos | apagado |
| Tamaño de titular | `--t-tapa` | `--t-interior` | `--t-tapa` |
| Recurso reservado (cursiva / versales / fondo invertido / logo) | sí | **prohibido** | sí |
| Foto | grande o a sangre | rota de posición, nunca repite en seguidos | grande o cero |
| y de arranque del texto | la misma | la misma | la misma |
| Banda muerta abajo | la misma | la misma | la misma |
| Elemento de acción | CTA | ninguno | uno, y solo uno |

---

### IDEAS SUELTAS (1 rubro cada una, pero portables)

- **La firma vertical cabalga la costura** (`cafe--EAGurKM8gHE`). El @handle va girado 90°, siempre pegado
  al corte entre paneles: donde ves la firma, ahí está la costura. Ocupa el único eje que ninguna plantilla
  usa, así que puedes firmar los 5 slides sin ensuciar ninguno.
  `writing-mode:vertical-rl;transform:rotate(180deg);letter-spacing:.18em`, con `left` = x de la costura − 18px.
- **El pico del siguiente slide como barra de progreso** (`restaurante--EAHAjbngcM8`, `EAGsHHkmUIw` — los
  dos hacen la misma progresión exacta): slide 1 con ~160px de la siguiente tarjeta asomando por la
  derecha, 2 con tarjetas entrando y saliendo, 3 recortado por ambos lados, **4 con una sola tarjeta sin
  pico**. Es el único mecanismo de "progreso" del corpus que no dibuja paginación propia, y su ausencia
  dice "se acabó" sin escribirlo.
- **Rampa tonal** (`rrhh--EAGwGpj0xwU`): los 6 fondos bajan de luminosidad monótonamente —crema, crema,
  crema, foto con velo, negro, negro— y **el esqueleto no cambia en ninguno**, solo se invierten las
  variables `--papel` / `--tinta`. El contenido era "cómo llegar tranquilo a la noche" y la tira
  literalmente anochece. Sirve igual para terapia (tensión→calma) y RH (problema→solución).
- **La micro-cabecera como contenido** (`cafe--EAHDReUGHXQ`): la fila superior es idéntica en geometría en
  los 7 slides, pero el texto forma una frase distinta cada vez, partida por el logo del centro
  (`WHERE EVERY ✦ CUP BEGINS`, `FRESH BEANS ✦ PERFECT COFFEE`…). 7 micro-mensajes gratis y el logo deja de
  ser adorno: es la bisagra gramatical. Máximo 2–3 palabras por lado, a 30px (no 28: piso de versales).
- **El logo se muda al bloque de texto** (`rrhh--EAHBr-ddUso`, 15 slides sin excepción): la firma no está
  anclada a una esquina, está anclada al bloque de lectura — texto a la izquierda, lockup arriba-izquierda;
  texto centrado sobre foto, lockup arriba-centro. Se lee como parte del texto y no como ruido. Evita el
  caso feo de `rrhh--EAGh5Vb8kIM`, cuyo kicker se quedó clavado y cae ilegible sobre la foto en 2 slides.
- **Recorte PNG sobre color plano texturizado** (`restaurante--EAHOcgjKJJQ`): sin banco de fotos, un
  recorte sin fondo y **sin sombra** (la sombra delata el montaje) flotando sobre plano #E4EFD4 con ruido
  de papel al 5% en `mix-blend-mode:multiply`. El mismo archivo se reutiliza en portada y cierre a dos
  escalas. Se ve intencional y caro; una foto de stock genérica se ve prestada.
- **Un solo tamaño de letra en toda la serie** (`cafe--EAGurKM8gHE`, `EAG2ZIT-zkQ`): cuando cada slide es
  una foto fuerte, no hay "titular" y "cuerpo" — solo hay "texto", mismo cuerpo en los 5, y la jerarquía
  la ponen la foto y la posición. Se comporta como pie de foto de revista: se apoya en la imagen en vez de
  encabezarla. Deja al menos un slide con **cero** palabras.

---

### ANTI-LEYES (lo que hay que prohibir en el generador)

1. **Titular idéntico en slides consecutivos.** `dental--EAFeX5gJ-Oc` repite "About Us" en el 5 y el 6, y
   "Dental Services" en el 7, 8 y 9. En una presentación proyectada marca sección; en una tira de
   Instagram se lee como tartamudeo y mata la razón de deslizar. Comparar normalizado (sin acentos ni
   mayúsculas); si el guion lo trae repetido, convertir el segundo en remate más chico.
2. **Justificar columnas angostas.** `restaurante--EAHDplOjeTo` justifica una columna de 398px (37% del
   ancho, ~4.2 palabras por línea) y abre ríos visibles. Al 36% esos ríos se ven como manchas blancas
   verticales y arruinan justo el aire editorial que buscabas. Regla: `text-align:justify` **solo** si la
   medida es ≥600px sobre 1080 **y** caben ≥8 palabras por línea; si no, `left`. Siempre con
   `hyphens:auto` y `text-wrap:pretty`. Nunca justificar el titular.
3. **Mezclar las dos familias de la Ley 6.** Congelar la mitad de los elementos y mover la otra mitad
   produce exactamente la sensación de "plantilla mal hecha". Es una o la otra, declarada en la plantilla.
4. **CONTRADICE — copiar las coordenadas de Canva tal cual.** Canva pone el riel a ~103px del pie y la
   etiqueta arriba a la derecha. Lo primero cae bajo la interfaz de IG; lo segundo, bajo la píldora 1/5.
   Toda coordenada importada se corrige: pie a `bottom:180px`, nada informativo en el rectángulo
   superior derecho.
5. **CONTRADICE — el fantasma a .03 de opacidad.** No existe en teléfono, igual que el filete de 1px bajo
   .28. Masas de 300px o más: .045–.06 mínimo. Trazos finos: nunca por debajo de .28.
6. **Centrar verticalmente cualquier bloque de texto variable** (Ley 5).
7. **Un tercer tamaño de titular** (Ley 3) y **dos elementos de acción en el cierre** (Ley 2).

---

### VALIDADOR (chequeos concretos al exportar)

```
1. cromo_identico(slides)        → mismas coordenadas de riel/marca en los N. Falla = error.
2. swipe_muere()                 → si existe .swipe, no puede estar en el último slide.
3. folio_solo_interiores()       → sin folio en 1 y N; dígitos consecutivos desde 2.
4. dos_tamanos()                 → font-size de titular ∈ {--t-tapa, --t-interior}. Nada más.
5. bookend()                     → el último slide usa la clase de la portada, no la del interior.
6. piso_y_techo()                → contenido de interior: y ≥ 378 y ≤ 918. Fuera de rango → partir slide.
7. banda_muerta()                → ningún elemento de contenido por debajo de y=1010; cromo hasta y=1170.
8. no_repite_zona()              → pos[i] != pos[i-1] (familia B).
9. sangrado_racionado()          → máximo un slide con --inset:0; nunca dos a sangre seguidos.
10. presupuesto()                → palabras por rol dentro de rango; titular ≤5 palabras en interiores.
11. titular_repetido()           → prohibido en slides consecutivos (normalizado).
12. justificado_legal()          → medida ≥600px y ≥8 palabras/línea, o se cae a left.
```

**Lo que esto implica para nuestras 8 plantillas:** no hay que rediseñarlas. Hay que agregarles una capa
de rol —`.s-tapa`, `.s-interior`, `.s-cierre`— que apague y encienda los mismos elementos en las 8, y un
riel compartido con la corrección de coordenadas de IG. Editorial, Revista, Nota, Ficha, Suave y Papel
aceptan las 11 leyes tal cual. Mural y Panorámica son la excepción de la Ley 1: ahí el cromo repetido
pelea con el fondo continuo, así que el riel va solo en tapa y cierre.

---

## Relaciones numéricas y contradicciones

Base de esta sección: 45 plantillas de 5 rubros (spa, fotografía, lujo, inmueble, skincare), 474 slides medidos. "X de 9" = dentro de un rubro. "X de 5 lotes" = el patrón cruzó rubros; ahí ya es ley.

### A. Las razones que se repiten

**A1. El titular interior mide 78% del de portada… o 45%. No hay nada en medio.**
Tres medidas al píxel, y caen en dos grupos, no en una curva:

- Misma fuente y mismo eje en portada e interior → **0.78**. `fotografia--EAF2cdQaw5M`: caja de 117.3px en portada y 91.1px en los tres interiores (escala 1350).
- La portada cambia de **especie** tipográfica (itálica→recta, script→sans) → **0.45–0.50**. `inmueble--EAGdxPpE9s4` (45%), `inmueble--EAFtvraJE50` (~50%).

Lo que esto significa: bajar el tamaño y cambiar la fuente son **sustitutos**, no acumulables. Si te quedas en la misma fuente, bajas 22%. Si cambias de fuente, puedes bajar a la mitad. Hacer las dos cosas degrada el titular interior a pie de foto.
Y el cierre va al revés: cuando cambia de registro, **sube**. `lujo--EAHQ4u8Y7ME` pone el cierre a +12% de la portada (~80px de mayúscula contra ~72px): es el tipo más grande de la tira.
*Frecuencia: 3 de 5 lotes, medido; 0 contraejemplos.*

**A2. Una tira admite DOS tamaños de titular. Tres es el máximo, y el tercero es el cierre.**
A = portada/cierre. B = interiores. **0 de 45 plantillas escalan el titular para que el texto quepa.** Verificado: en `lujo--EAGr2Gwxpx4` la misma caligrafía va al mismo cuerpo exacto en tres slides de 2, 3 y 2 renglones (crece el bloque hacia abajo desde un tope fijo a y≈27%); en `lujo--EAG6qH3iznM` la segunda línea es más ancha que la primera y **no** la achican para cuadrarla.
Dentro de un titular partido en dos piezas, la diferencia de cuerpo es mínima: 128px contra 118px (8%). Lo que cambia entre las dos piezas es la familia o el eje, no el tamaño.
*Frecuencia: ley. 3 de 5 lotes verificable, ninguna plantilla de las 45 hace auto-fit.*

**A3. Presupuesto de palabras por slide.**

| Rol | Palabras (referencia) | Evidencia |
|---|---|---|
| Portada | 6–14, **techo duro 18** | Ninguna de las 45 portadas pasa de 18 |
| Interior | 25–45 (pico medido 54) | 27–54 skincare · 25–45 lujo · 20–33 inmueble |
| Cierre | 6–26 | 5 de 5 lotes |

Reparto del interior: titular ≤6 + entradilla ≤8 + cuerpo ≤35; o titular + lista de 3–4 renglones de ≤5 palabras.
**Corrección obligatoria por nuestro piso tipográfico:** 8 de 9 plantillas de inmueble corren el cuerpo a 26–30px equivalentes. A nuestro piso (Outfit ≥40px en minúsculas, ≥30px en MAYÚSCULAS, Cormorant ≥64px), donde ellos meten 4 líneas nosotros metemos 2–3. **La cifra que va al generador no es 45: son 20–28 palabras por interior.**
Techo de bloques: **máximo 3 bloques de texto por slide**. El contraejemplo (`skincare--EAFlFe_D9UM` slide 2: 12 bloques, ~130 palabras) es el slide más ilegible de los 474.
Piso: 0 palabras es legal en un interior (3 de 45, y son de las mejores tiras) **sólo si la marca tiene banco de fotos**.
*Frecuencia: ley. 5 de 5 lotes respetan el techo de portada.*

**A4. Alturas de bloque: una, o tres. Nunca "las que salgan".**

- Serie de texto sin foto de fondo → **UNA** altura, clavada al decimal: 29.50% en los tres interiores de `fotografia--EAF2cdQaw5M` (no 29.4 ni 29.6, el mismo número tres veces).
- Serie con foto en **todos** los slides → la altura es la **única** variable, entre **17% y 65%** (`spa--EAHBLAv3xZM`), elegida por la banda más oscura y uniforme de esa foto en concreto. Lo único que no se mueve un píxel es el mueble.
- Serie que alterna a propósito → **3** alturas nominales (≈23%, ≈40%, ≈52%) y prohibido repetir la pareja (altura, alineación) en dos slides seguidos.
- Ancla por contenido: si el slide lleva lista o párrafo, el titular se ancla **arriba** (17–29.5%) y todo cuelga hacia abajo; si sólo lleva titular, se **centra vertical** (50%). 3 de 9 en lujo, 0 contraejemplos en los 5 lotes.

**A5. Dos márgenes, en proporción 1:2.**
Mueble/marco a 54px (5%) o 103px (9.5%); contenido a 108px (10%) o 175px (16%). En 2 de las 4 plantillas con marco fijo el margen del mueble es exactamente la mitad del del texto. Un solo margen para todo hace que la pieza se lea como formulario.
*Frecuencia: 4 de 9 en spa, replicado en 3 lotes más.*

**A6. El titular de portada ocupa 25–30% del alto.**
338–405px sobre 1350, interlínea **≤1.0** (las líneas se tocan y el bloque se lee como mancha gráfica, no como texto), margen izquierdo 10–16%. 5 de 5 portadas medidas en skincare caen ahí; la única fuera de rango (14.9%) es, textualmente, la portada más floja del lote.
**Comprobación automática:** si la caja del titular de portada mide menos de 338px de alto, la portada está mal y hay que rehacerla, no ajustarla.

**A7. Constantes de una sola cifra (copiar tal cual).**

- **Banda de foto congelada:** `top:108px; bottom:108px` (8%/8%) idéntica en toda la serie; ningún slide puede redefinirla. Variante papel 10%/10% (135px). Medido en 3 plantillas al píxel, visible en 5 de 9.
- **Caja/marco con inset del 10%** (108px por los cuatro lados) que no cambia nunca en toda la tira: 4 de 9 en lujo.
- **Filete de ancla: 604px = 56% del ancho**, arrancando en el margen de texto. No de borde a borde: el filete largo compite con los bordes del lienzo; el corto se lee como parte del bloque.
- **Ordinal** ("1-", "Tips #3", "01"): renglón de **111px** de altura reservada que colapsa con `display:none` en portada y cierre. Medido: el filete cae en y=1019 en los cinco interiores y en y=908 en el cierre. 111px exactos = el renglón que se borró. Por eso el ordinal va en flujo, nunca en `position:absolute`.
- **Badge numerado:** círculo de 196px con centro a **16.4%** de altura. Es el único punto donde un número propio es legítimo: queda muy por debajo de la píldora de Instagram.
- **Columna de cuerpo: 580px (54% del ancho).** Ojo con el dato heredado: la referencia mete ~45 caracteres por línea ahí porque corre el cuerpo a 26–30px; a nuestros 40px caben ~28. Misma columna, la mitad de texto.
- **Cifra sombra** (numeral gigante que ambienta sin competir): diferencia máxima de **12 unidades de gris** contra el fondo (medido #191919 vs #0F0F0F = contraste 1.13:1). Nunca en portada ni en cierre.
- **Straddle** (texto montado sobre el borde de la foto): sólo **15–25%** del ancho del titular cae sobre la imagen. Más que eso es ilegible al 36%.
- **Densidad de acento:** 1 marca manuscrita por slide, ≤3 tokens de marca, y jamás dos slides seguidos con el mismo acento en el mismo cuadrante.

### B. Lo que CONTRADICE lo que hacemos

**CONTRADICE 1 — Elegimos UNA plantilla por tira; ellos usan DOS especies en la misma tira.**
Hoy: el generador pide plantilla (Editorial, Papel, Ficha…) y los 5 slides salen de esa. La tira es homogénea por construcción.
Las buenas: **5 de 5 lotes** parten la tira en dos especies. Extremos de un material, medio de otro. `spa--EAGo8azJCtM`: slides 1 y 5 son foto a sangre con titular blanco; los slides 2, 3 y 4 son papel gris beige #DEDBDA con tinta café y **cero foto**. Eso es literalmente nuestro "Editorial" y nuestro "Papel" dentro del mismo carrusel. `spa--EAHK9udW-uA` hace lo mismo con textura; `spa--EAGFFNI3sYY` con plano. La versión más aprovechable es el **ciclo de 3 estados** de `skincare--EAGvIAISSmc`: foto a sangre → color plano → papel con panel → color plano → papel → foto a sangre, invirtiendo la tinta con el fondo.
Veredicto: **cambiar, y es el de mayor impacto de toda la lista.** No hay que diseñar plantillas nuevas: hay que permitir combinar dos de las 8 que ya existen con la regla `extremos = A / medio = B`, aplicada por el generador sin preguntar. Beneficio doble: resuelve a SMILE NOW, DENTALNOW y ADAGIO RH, que no tienen banco de fotos, porque 2 de cada 3 slides dejan de necesitar imagen.

**CONTRADICE 2 — El cierre lo tratamos como un slide propio; para ellos es la portada con hijos apagados.**
Hoy: el cierre es su propio diseño, con su propio acomodo y su propia carga (CTA + datos).
Las buenas: **19 de 45** reimprimen la geometría de la portada en el cierre. Medido al píxel en `inmueble--EAFZ4hhlvFs`: el titular arranca en y=151 en la portada y en y=152 en el cierre; la línea serif de abajo ocupa y=1083–1148 en **ambas**; la caja de foto mide x=271–808 en **las dos**. Lo único que cambia: la altura de la foto y que la flecha desaparece. En `lujo--EAE_u6jYK1Y` es la **misma foto** en el primer y el último slide, y sólo cambia el verbo ("How to plan the perfect Photo Walk" → "Enjoy your next Photo Walk").
Veredicto: **cambiar, y es barato.** El cierre deja de ser plantilla y pasa a ser `.portada` + modificador: `.slide--cierre .flecha{display:none}` y `.slide--cierre .contacto{display:block}`. Prohibido redefinir `top/left/width` en el cierre. Regla de rescate para marcas con pocas fotos: repetir la MISMA foto en el slide 1 y en el N — funciona y nadie lo nota.

**CONTRADICE 3 — Apostamos el CTA al slide que menos gente ve.**
Hoy: el CTA vive en el cierre, y sólo ahí.
Las buenas: se parte en dos escuelas, y la que gana no es la nuestra.
- **Fotografía y lujo (el rubro de IVAE Studios):** el CTA comercial está en la **portada** y el cierre se queda con la firma. Lo verifiqué abriendo los slides: `fotografia--EAGts5giMvE` slide 1 lleva "PORTRAIT SESSIONS AVAILABLE" abajo a la izquierda + el @handle a la derecha; el slide 2 ya cambió ese slot al dominio; y el **slide 4 (último) tiene el slot izquierdo VACÍO y sólo el @handle**. Cero CTA en el cierre. `fotografia--EAG_gYs1bP4` y `fotografia--EAG_-dHYaLY` mueven "NOW BOOKING NEW SESSIONS" / "NOW BOOKING ENGAGEMENTS & ELOPEMENTS" a un **interior**. `lujo--EAGtgmsFFUI` lleva el CTA en el script de la portada ("Come stay with us.") y el cierre repite el mismo aparejo con el verbo cambiado.
- **Inmueble (el rubro de tips):** ahí sí, 6 de 9 cierran con un bloque de contacto que no existe en ningún otro slide. Es el lote cuya micro-tipografía muere en el feed.
Veredicto: **cambiar a medias, no invertir.** El argumento duro no es estético: la portada es la única pieza que se ve suelta en la cuadrícula del perfil y la única que aguanta ser el único slide visto; el cierre es el que menos gente alcanza. Poner el CTA sólo al final es apostarlo todo al slide de menor alcance. Implementación concreta: un **slot de pie con dos huecos** a la misma altura (`top:1170px`), el derecho fijo con el @handle y el izquierdo rotando entre tagline / "AGENDANDO SESIONES" / dominio, presente **desde la portada**; el cierre conserva su contacto. No quitamos nada: duplicamos el CTA hacia arriba.

**CONTRADICE 4 — Si el texto no cabe, lo achicamos. Ellos recortan el texto.**
Hoy: el bloque se ajusta al contenido (auto-fit, o cuerpos distintos por slide según cuánto escribió el cliente).
Las buenas: **0 de 45** escalan el titular para cuadrarlo. El cuerpo es constante y lo que crece es el bloque, hacia abajo, desde un tope fijo.
Veredicto: **cambiar, ley dura.** El límite lo pone el conteo de palabras en el modelo de datos (A3), no el CSS. Si no cabe en 3 renglones, se recorta el copy, no el tipo. Y para el texto que sí varía mucho (los clientes nunca escriben lo mismo), la solución medida está en `inmueble--EAFtvraJE50`: la tarjeta crece desde el **centro exacto**, no desde arriba — altura de 759 a 874px según el copy, pero el centro clavado en y=673–675 sobre 1350 (el centro del lienzo es 675). `top:50%; transform:translateY(-50%)`, nunca `top` fijo.

**CONTRADICE 5 — Pedimos titular en cada slide. 3 de 45 tienen interiores con CERO palabras y son de las mejores.**
Hoy: el guion por slides asume titular + texto en todos.
Las buenas: `fotografia--EAHDwEWhvyY` tiene texto **sólo en el slide 1** (título + año); los slides 2, 3 y 4 no llevan ni el handle, y la tira se sostiene con un sistema gráfico (foto montada sobre un rectángulo de color desfasado 20–28px, alternando color y lado). `lujo--EAGo8WrWAJs`: 3 palabras en portada, 0 / 0 / 4 / 0 en los interiores, 6 en el cierre; lo que da avance es el **margen**, que se aprieta a lo largo de la tira (31% → 5% → mixto → 0% → 25%). `fotografia--EAGFFNI3sYY` interiores = rejilla de 6 fotos + tira de 3 muestras de color sacadas de esas fotos, sin una palabra.
Veredicto: **cambiar, pero sólo para las 4 marcas con banco** (IVAE STUDIOS, MELISA, PRODUCTIONS, REGENERIS). Añadir un tipo de slide "sólo imagen" y otro "rejilla + paleta". Para SMILE NOW, DENTALNOW, ADAGIO RH y WASICAFE no aplica: sin fotos, un slide de 0 palabras es un slide vacío.

**CONTRADICE 6 — "Siempre blanco sobre sombra" lo aplicamos también donde no hay foto.**
Hoy: regla de marca dura, texto blanco sobre sombra negra, nada de fondo claro con letra oscura.
Las buenas: **coinciden al 100% cuando hay foto** — no vi un solo caso de texto desnudo sobre imagen; el velo medido va de `rgba(0,0,0,.45)` a `.55`, o velo blanco `.5` cuando la tinta es oscura. Donde difieren es en que **la mitad de sus slides no lleva foto**: papel #DEDBDA con tinta café, crema #F0ECE3, olivo oscuro con tinta crema, terracota #cc552a con tinta blanca. `skincare--EAHFJhkDnuU` voltea la tinta foto por foto (café oscuro / blanca / café / blanca…) y cuando una foto es demasiado ruidosa mete una banda lechosa `rgba(255,255,255,.72)` de ancho completo entre y=19% y y=81% para poder escribir en oscuro.
Veredicto: **la regla no se toca donde nació** (sobre foto sigue siendo blanco sobre sombra, y las medidas de arriba la respaldan). Lo que hay que abrir es el **interior de papel**, que es justo lo que resuelve a las marcas sin banco. Es un cambio de criterio de marca: se consulta con Vianey con los dos mockups enfrente, no se mete por la puerta de atrás.

**CONTRADICE 7 — Copiar las medidas de la referencia nos haría empeorar.**
Hoy: nuestros pisos (Outfit ≥40px minúsculas / ≥30px MAYÚSCULAS, Cormorant ≥64px) están **por encima** de lo que hacen las plantillas que admiramos.
Las buenas: no lo son en esto. 8 de 9 en inmueble corren el cuerpo a 24–30px equivalentes; 6 de 9 en lujo corren la micro-tipografía de esquina a ~17–25px; 5 de 9 en fotografía dejan el pie en 14–17px. **0 de 45 lo hacen bien.** Y encima lo ponen donde no se ve: esos pies caen entre el 90.8% y el 96.4% de la altura, dentro de los ~160px que tapa la interfaz de Instagram.
Veredicto: **no cambiar el piso; cambiar el copy.** Se copia la rejilla y las proporciones (bandas de 62px, filete de 604px, tarjeta de 888px centrada), y se vuelve a tipografiar encima con nuestros tamaños. Consecuencia directa y aceptada: donde la referencia mete 4 líneas de cuerpo, nosotros metemos 2–3. Cuando una plantilla de Canva se vea mejor que la nuestra, la diferencia **nunca** es el tamaño de letra: es la rejilla.
Guarda automática: nada de tinta con `y + alto > 1190px` (88.1%). Renderizar a 390px de ancho y exigir que el texto siga siendo legible.

**CONTRADICE 8 — El final no se escribe: se apaga.**
Hoy: si el generador marca el final, lo marca escribiendo (CTA, "fin", contador).
Las buenas: **4 de 5 lotes** cierran quitando algo. `spa--EAG9jevXP24`: la píldora "Swipe" (135×40px, borde 1px, texto 20px, letter-spacing .18em, en x=175 y=463) está en los slides 1 al 6 y en el 7 **no está**. `spa--EAFon2vW8Pw`: la flecha está en 1–5 y en el 6 sólo queda el aire. `spa--EAHBLAv3xZM`: el filete que sangraba por el borde izquierdo con un punto en la punta derecha se mete hacia adentro y estrena punto en **las dos** puntas — forma abierta = sigue, forma cerrada = terminó. La variante superior es **mutarlo, no borrarlo**: `skincare--EAGcus8sMPM` deja la misma píldora, mismo tamaño y misma posición, y sólo cambia "SWIPE →" por "LICERIA & CO."; `inmueble--EAFtvraJE50` cambia "SWIPE FOR MORE" por "SEND US A MESSAGE" en el slide 10 y **no mueve nada más**: ésa es la única diferencia de su cierre.
Veredicto: **adoptar tal cual, es gratis.** Un solo nodo `.avance` en la misma coordenada en todos los slides, con tres estados por `data-rol`. Ninguna de las 45 pinta "FIN" y ninguna borra el nodo dejando el pie desbalanceado.

**CONTRADICE 9 — Numerar. Cuatro de nueve se pintan su propio contador y chocan con Instagram.**
Hoy: el riesgo está en numerar páginas y en posicionar el número en absoluto.
Las buenas y las malas: `fotografia--EAGsM3CmCEU` pinta 5 puntitos arriba a la derecha, en y≈4–6%, exactamente donde IG dibuja su píldora. `skincare--EAG3Y7wVvYA` imprime "01"…"05" en píldora en x 78–90%, y 8–12%: lo mismo. `skincare--EAHCBE4z-K0` imprime "01/04" **fijo en los cuatro interiores** (nunca se actualiza: eso ya es un bug de plantilla). En cambio `skincare--EAGsw9heXF8` numera **los items, no las páginas**: mete 01 y 02 en el slide 2, 03 y 04 en el slide 3, y el contador nunca se reinicia.
Veredicto: **numerar contenido, jamás páginas.** Prohibir cualquier fila de puntos. Guarda automática en el generador: ningún elemento propio dentro de `x > 760px && y < 190px` sobre 1080×1350. Si se quiere un número, va en badge de 196px con centro a 16.4% de altura, o como cifra sombra (A7). Y el ordinal siempre en flujo con altura reservada de 111px, no absoluto.

**CONTRADICE 10 — La barra de contacto pegada a `bottom:0` se muere debajo de la interfaz de IG.**
Es una contradicción **dentro del propio corpus**, y hay que resolverla antes de copiar: `lujo--EAHDRL71XzM` cierra con una barra de contacto de ~135px pegada al borde inferior (y 90–100%), con dos íconos circulares y el @handle. En el feed eso queda tapado. Lo mismo con la métrica de palabras: en inmueble el cierre resulta ser el slide **más cargado** (hasta 50 palabras, porque le suman los datos), mientras que la curva en V de los otros lotes lo quiere en ≤26.
Veredicto: **adoptar la barra, subirla.** Tope de tinta en y=1190px → la barra de 135px va a `bottom:160px`, no a `bottom:0`. Y separar prosa de datos: cierre = titular ≤6 palabras + una sola línea de contacto (@handle + web). Un párrafo en el cierre no lo lee nadie.

**CONTRADICE 11 — La variedad no se consigue moviendo adornos.**
Hoy: la tentación obvia para que una tira no se vea "de plantilla" es aleatorizar posiciones.
Las buenas: **7 de 9** en inmueble repiten un elemento que **no cambia nada** entre slides y siempre pegado a un borde. Lo comprobaron restando las tiras: la banda superior de `inmueble--EAGb6rBtY2A` da una diferencia media de 2.93/255 entre los 7 slides (ruido de JPEG) y el riel de `inmueble--EAHDREAyZu4` da 0.16–0.27/255. Y las **2 de 9 que no tienen marco fijo y sólo mueven el adorno son, textualmente, las 2 que menos se ven como serie**.
Veredicto: **marco fijo primero, adorno migrante como segunda capa.** Lo que sí debe moverse es el **contenido**: el bloque de texto (4 de 9 en skincare alternan izquierda/derecha y altura), la zona de foto (3 de 9), o el orden de dos bloques con `column` / `column-reverse` según `:nth-child` (3 de 9) — cero CSS nuevo. Variedad en el contenido, constancia en el marco. Nunca al revés.

**CONTRADICE 12 — La negrita como énfasis dentro de la frase.**
Hoy: `<b>` disponible en cualquier slide, para resaltar palabras.
Las buenas: 1 de 45 (`spa--EAG9jevXP24`) usa el peso para marcar **posición en la tira**, no énfasis: la portada cierra con dos palabras en negra ("new **skills**"), el cierre también ("save **this post**"), y los cinco interiores van al 100% en la ligera, sin una sola negrita. Como el cambio de peso sólo ocurre dos veces en toda la serie, cuando aparece significa algo.
Veredicto: **idea suelta (1 de 45), pero de costo cero y coherente.** Probarla en una marca —regla del generador: sólo el primer y el último slide admiten `<b>`; en los interiores se ignora— y ver si Vianey la nota. No convertirla en ley todavía.

### C. Las cinco cifras que deberían entrar al generador esta semana

1. Portada ≤18 palabras (ideal 6–14) e interior **20–28** palabras a nuestro piso tipográfico, no 45.
2. Titular de portada entre 338 y 405px de alto (25–30%) con `line-height ≤1.0`; si no llega, la portada se rehace.
3. Cero auto-fit: dos tamaños de titular por tira (interior = 0.78 del de portada si comparten fuente; 0.45–0.50 si la portada cambia de fuente).
4. Zonas prohibidas: `x>760 && y<190` (píldora de IG) y todo `y+alto > 1190` (interfaz inferior).
5. `extremos = plantilla A / interiores = plantilla B`, aplicado solo, más el cierre como `.portada` + modificador.

---

## DISEÑO

59 ángulos de diseño, fusionados a 31 reglas. Cada una termina en CSS o en una línea
de `plantillas.js` / `carrusel-gen.js`. Convención: **[N ángulos]** = en cuántos ángulos
independientes salió lo mismo. **LEY** = 5 o más. **1 ángulo** = idea suelta, pruébala antes
de casarte.

---

### 0. Los 11 cambios que son de una línea (hazlos hoy)

Todos salieron con archivo y renglón. Ninguno cambia el diseño, todos arreglan algo que
hoy está roto en el teléfono.

| Archivo:línea | Hoy | Debe ser | Por qué |
|---|---|---|---|
| `plantillas.js:120` `.pill` borde | `1.6px` | `3px` | 1.11 px físicos en iPhone SE 3 |
| `plantillas.js:108-109` `.chev` | `2.5px` | `3.5px`, caja `16px`→`20px` | 1.7 px físicos |
| `plantillas.js:182` `revista .li` | `1px` | `3px` | 0.69 px físicos |
| `plantillas.js:239` `nota .papel` | `1px` | `3px` | 0.69 px físicos |
| `plantillas.js:567` `papel .cerco` | `1px` α.32 | `2.5px` α.45, o quitarlo | 0.69 px físicos |
| `plantillas.js:474,490-494` `.flecha` / `.hilo` | `1.6px` / `2px` | `3px` | 1.1–1.4 px físicos |
| `plantillas.js:169,246,297,388,456,579` `.tit` | Cormorant `400` | `600` | trazo hilo al 36% |
| `plantillas.js:106` + `carrusel-gen.js` `.hdr .b` | Pinyon `54px` | fuera de la cabecera | ojo de ~5px en el feed |
| `carrusel-gen.js:436` `baseFrequency` | `0.9` | `0.18`, `numOctaves='3'` | celda de 1.1px = invisible al 36% |
| `carrusel-gen.js:439` filtro de grano | siempre blanco | `grain` / `grainDark` según fondo | Papel no tiene textura de papel |
| `.hdr .h/.d` `28px`, `.pag` `30px` | — | `34px` los tres | bajo el umbral angular |

Y una regla que cierra la categoría entera **[3 ángulos]**: **ningún borde, línea ni asta
por debajo de 3px en coordenadas de 1080.** El enemigo aquí no es el JPEG de Instagram
(trabaja sobre luminancia; un filete blanco sobrevive) sino el reescalado: en el iPhone
más chico que sigue en uso, 1px del arte = 0.69 px físicos, y a esa escala la posición
sub-píxel decide si sale línea o sale gris. Súbele el alfa del blanco de `.82` a `.90-.92`
y el de la tinta de `rgba(24,24,30,.55)` a `.78`.

**CONTRADICE la portada:** en la cuadrícula del perfil hasta un trazo de 3px vale ~1 px
físico. En portada, nada estructural puede depender de un filete — ni el marco, ni la
separación de bloques. Ahí manda la masa (color, foto, tipo).

---

### 1. Color y paleta

**1.1 — Cuatro variables, ni una más. [3 ángulos]**
`--fondo`, `--texto`, `--acento`, `--acento-sutil`, repartidas 60/30/10. Cero íconos
decorativos, cero líneas ornamentales sueltas. En servicios profesionales el ornamento
extra es exactamente lo que hace ver aficionado a un consultorio; la autoridad se firma
repitiendo el contenedor, no adornándolo. (Las cifras de "x2.3 engagement" que circulan
con esto vienen de blogs: las quité, el mecanismo se sostiene solo.)

**1.2 — Preset "Salud": arena y tinta, nunca azul clínico. [1 ángulo, pero medido]**
El azul lee estéril a pantalla completa, y estéril es lo que dispara la ansiedad del
paciente dental; la dirección 2026 en clínicas es spa (beige cálido, arcilla, salvia).
Tokens verificados con la fórmula WCAG:

```css
--lienzo:        #EFE7DC;   /* hueso */
--tinta:         #23201C;   /* 13.2:1 sobre hueso — texto de cualquier tamaño */
--acento-texto:  #4A5A46;   /* salvia oscura, 6.03:1 — el ÚNICO verde que puede llevar texto chico */
--acento-graf:   #6E7F6A;   /* 3.5:1 — solo ≥90px, filetes y fondos de píldora */
--calido:        #9C5B3F;   /* 3.45:1 — mismas restricciones */
```
Ojo con el escalón: salvia #6E7F6A da 3.5:1, o sea **pasa el piso de ≥90px (3.0) y REPRUEBA
el de ≥50px (3.6)**. Bloquéalo en el motor, no lo dejes a criterio. Si la marca exige azul,
entra como `--acento-sutil` en menos del 15% del área, nunca como fondo a sangre.

**1.3 — El token de marca es la RETÍCULA, no el color. [2 ángulos — decisión de arquitectura]**
Anagrama (@anagramastudio, 153K) publica cada proyecto con la paleta de ese proyecto, no
con la suya; su identidad vive en márgenes, escala tipográfica y firma. Traducido: si "tema
de marca" significa colores, tienes 7 generadores. Si significa estructura, tienes uno.
Tokens por marca = `--margen`, `--escala-tipo`, `--peso-micro`, familia del titular,
posición de la micro-marca, y UN acento del cliente (ese sí es suyo).
El resto se deriva: samplear el canvas ya renderizado en la zona del panel, conservar
matiz y croma del promedio, y **empujar la luminancia en pasos de 4% hasta que el par
pase el escalón que le toca al tamaño**. Así la regla de contraste deja de ser un documento
y se vuelve código que no se puede desobedecer.
Alcance: paneles, tarjetas y Papel. **Sobre foto no se deriva nada** — ahí sigue mandando
blanco sobre velo.
**GOTCHA:** `getImageData` truena con el canvas contaminado. Carga la foto con
`crossOrigin="anonymous"` y confirma CORS en el bucket, o el sampleo falla en producción
y no en tu máquina.

**1.4 — OKLCH con L clavada por ROL, H y C por marca. [1 ángulo]**
Si mantienes L, el contraste sobrevive aunque cambies el tono. Los 4 pisos (3.0 / 3.6 /
4.5 / 6.0) pasan a ser propiedad del PAR de tokens, no de cada marca: validas una vez,
sirve para las 7.
```css
:root{ --h:28; --c:.09 }
--tinta:       oklch(.24 var(--c) var(--h));
--tinta-suave: oklch(.42 calc(var(--c)*.7)  var(--h));
--campo:       oklch(.94 calc(var(--c)*.35) var(--h));
--acento:      oklch(.62 calc(var(--c)*1.4) var(--h));
```
Deja hex de respaldo: no des por hecho que `oklch()` sobrevive la serialización al
`foreignObject`. Y no confundas: OKLCH es perceptualmente uniforme, WCAG no — sigue
validando cada par de roles una vez con el escáner.

**1.5 — El color NO va en trazos finos. [2 ángulos]**
Un filete dorado no es "un filete blanco de otro color". Amplitud de luminancia medida en
un filete de 2px sobre foto: blanco **112.9**; dorado #C9A227 **19.5**; rosa #E0517B **20.7**;
cian #3AC8E0 **29.5**. Entre 1/6 y 1/4. Encima, el JPEG guarda croma a mitad de resolución
en los dos ejes (4:2:0) y los bordes saturados sangran — el cian perdió 9% de croma en
la prueba.
Regla: **prohibido el color en cualquier elemento de menos de 4px de grosor o menos de
46px de tipo** — filetes, píldoras, chevrón, kicker, paginación, firma. El color de marca
vive en superficies (bandas, velos, bloques), nunca en trazos. Esto le pone número a la
regla de marca que ya existe (blanco sobre sombra).

**1.6 — Un solo hue por pieza: degradado atmosférico, no arcoíris. [1 ángulo]**
El rosa→morado→azul es papel tapiz de 2020-2024. Lo vivo en 2026 es el degradado tratado
como LUZ: un tono, variando solo luminancia y saturación, foco descentrado.
```css
background: radial-gradient(130% 95% at 28% 8%, hsl(var(--h) 38% 24%), hsl(var(--h) 60% 7%) 70%);
```
Prohibir `linear-gradient` con más de 2 paradas de hue distinto. El titular va en la zona
clara del campo, nunca sobre el borde oscuro. Es la mejor salida de fondo para MELISA,
REGENERIS y WASICAFE cuando no hay foto.

**1.7 — El fondo invertido es la única flecha que nos queda. [1 ángulo, alto valor]**
Modificador reutilizable por CUALQUIER plantilla, no plantilla nueva: en el slide B se
intercambian `--lienzo` y `--tinta`; márgenes, retícula, cuerpos y posición del texto
quedan **exactamente** iguales. Lo único que cambia es el valor de lienzo — y eso sí
sobrevive en la tira del slide siguiente que asoma por el borde, donde una flecha de 40px
no existe.
Etiqueta de cara: Outfit MAYÚSCULAS 30px `letter-spacing:.2em`. Cara A en Cormorant
itálica ≥160px, cara B en Outfit ≥56px.
Pares por marca: MITO / LO QUE PASA (dental, terapia), ANTES / DESPUÉS (estética),
LO QUE CREES / LO QUE PASA (WASICAFE, ADAGIO RH), LA PREGUNTA / LA RESPUESTA.
Restricción: el par nunca cae en el último slide — ese es CTA y franja legal, siempre
sobre el fondo base de la marca.

---

### 2. Tipografía

**2.1 — Los dígitos de Cormorant son de estilo antiguo. Un '3' de portada sale 36% más chico. [1 ángulo, pero verificado con fontTools sobre TUS archivos]**
Esto es un bug, no una preferencia. `cormorant-roman.woff2` **declara la característica
`lnum` en su GSUB**, o sea que su default NO es lining: el cero mide 399 unidades de alto
(prácticamente la altura de x, 386) contra 625 de una mayúscula. Un '3' en un titular de
152px se dibuja de **~61px en vez de ~95px**, y al 36% del feed son 22px contra 34px: el
número se lee como minúscula, y el 3, 4, 5, 7 y 9 bajan de la línea base y chocan con la
línea siguiente. En Outfit no pasa (`outfit-latin-var.woff2` no trae `lnum` porque ya viene
lining; cero = 686 > capHeight 676). Las dos conservan `tnum`.
```css
.portada, .cifra, .num, .ancla-num{
  font-variant-numeric: lining-nums tabular-nums;
  font-feature-settings: 'lnum' 1, 'tnum' 1;   /* respaldo: si re-subsetean el woff2 y se
                                                  cae lnum, el número regresa a estilo
                                                  antiguo sin avisar */
}
```

**2.2 — Cormorant nunca por debajo de peso 500; 600 sobre foto; 600 en las seis reglas `.tit`. [4 ángulos]**
El piso de 64px controla el TAMAÑO de la caja tipográfica; lo que se muere al 36% es el
TRAZO. Cormorant es un garamond de contraste alto: a 64px su trazo fino ronda 1px en el
lienzo de 1080, que en el feed es medio píxel — se rompe **antes** de que la compresión
entre siquiera. Y hay doble pérdida: tu export JPEG 0.92 más la recompresión de Instagram,
y los bordes de letra son justo donde caen los artefactos (peor sobre foto: el compresor
reparte menos bits en zonas de detalle).
Hoy está a 400 en `revista:169`, `nota:246`, `ficha:297`, `mural:388`, `panorama:456`, y a
500 en `papel:579` (más las `.tit i` en `:171, :247, :298, :390, :458, :581`). El woff2 ya
es variable 300-700 — no hay archivo nuevo que cargar. Revisa los cortes de línea después,
porque `text-wrap:balance` rebalancea al engordar.
Validador: `if (font-family==Cormorant && font-weight<500) → bloquear`.
De paso: las "serifas editoriales anti-geométricas" (old-style, cálidas) están del lado
bueno de 2026 y Cormorant aparece nombrada ahí. Lo que murió es la serifa de lujo
hairline peso 300 estilo portada de Vogue que copiaron todas las clínicas entre 2021 y
2024. El problema nunca fue la serifa: fue el peso.

**2.3 — Pinyon Script no tiene piso y está a 54px. [2 ángulos — es el peor trazo del sistema]**
`carrusel-gen.js` `.hdr .b` y `plantillas.js:106` ponen la firma de marca en Pinyon a 54px.
Es copperplate: ojo de ~.28 de em → altura de x de ~15px en el archivo → **~5px en el feed**.
Es un borrón, y es la firma de la marca.
Arreglo (elige uno):
- **Preferido para SMILE NOW, DENTALNOW, ADAGIO RH y WASICAFE** (que además no deberían
  llevar una cursiva de boda): sacarla de la cabecera y ponerla en Outfit 500 MAYÚSCULAS
  34px `letter-spacing:.12em` — que es exactamente el tratamiento del `.marco` de las otras
  7 plantillas.
- **Para IVAE STUDIOS y MELISA**: Pinyon con piso propio de **≥120px**, máximo 3 palabras,
  nunca `text-transform:uppercase` (destruye el copperplate), nunca dos slides seguidos,
  y solo como firma grande del último slide.

**2.4 — Siete voces con tres fuentes: familia × caja × tracking. El PESO no es un eje. [2 ángulos]**
Al 36% las diferencias de peso se borran: un 500 y un 700 se ven igual en el feed. Lo que
sobrevive a esa reducción es la silueta del bloque: la caja (MAYÚSCULAS vs minúsculas
cambia el perfil superior de la palabra) y el tracking (cambia ancho y ritmo). Y agregar
familias tiene costo duro: las fuentes viajan como woff2 en base64 DENTRO de cada SVG
(`carrusel-gen.js:80-83, 126-127`), así que cada familia nueva engorda y ralentiza cada
slide del render.
Tres tokens por marca — `--titular-familia`, `--titular-caja`, `--titular-track`:

| Marca | Familia | Caja | Tracking | Peso |
|---|---|---|---|---|
| SMILE NOW / DENTALNOW / ADAGIO RH | Outfit | uppercase | `.08em` | — |
| REGENERIS THERAPY | Outfit | uppercase | `.06em` | 500 (el acento es la ligereza, no la negrita) |
| WASICAFE | Outfit | minúsculas | `0em` | dato en Cormorant |
| IVAE STUDIOS / MELISA | Cormorant | minúsculas | `-.01em` | 600 |
| PRODUCTIONS | Outfit | uppercase | `.08em` | — |

Los dos dentales comparten fuente a propósito: **se distinguen por la FORMA, no por la
tipografía** (ver 3.6). Y las MAYÚSCULAS piden 5–12% de tracking extra porque las capitales
están dibujadas para vivir dentro de palabras, no en fila.
**Aviso ejecutable:** el tracking come ancho. Después de aplicarlo, revalida que el titular
de portada siga ≥152px y dentro del presupuesto de caracteres, o la portada se parte en 4
líneas. Y bloquea los 3 tokens en el editor de la pieza: lo que rota entre publicaciones es
la plantilla, no los códigos de voz.
(Quité del original las cifras del estudio Monotype 13%/10%/9%: es investigación de
fabricante sobre "percepción" y no sostiene ninguna decisión que no sostenga ya el
argumento del 36%.)

**2.5 — Tracking inverso al tamaño. [1 ángulo]**
Dos clases fijas, y el default neutro de Canva es exactamente el punto muerto entre ambas:
```css
.display{ font:600 var(--tit)/0.92 Cormorant; letter-spacing:-0.015em }
.display--sans{ font:800 var(--tit)/0.88 Outfit; text-transform:uppercase; letter-spacing:-0.02em }
.micro{ font:500 32px/1.6 Outfit; text-transform:uppercase; letter-spacing:0.14em }
```
Prohibir `letter-spacing` positivo arriba de 60px y negativo abajo de 40px.

**2.6 — Números en dígitos, y del 3 al 10. [2 ángulos]**
"3 errores", nunca "tres errores". Dos razones concretas: (a) NNG documentó con eye-tracking
que el numeral tiene silueta distinta y se detecta antes en visión periférica, y a 36% las
letras son textura pero el dígito sobrevive; (b) presupuesto de línea medido en tus propias
fuentes: **"3 errores" mide 614px en Outfit y "tres errores" 791px — la cifra ahorra 23%
del ancho de la portada.**
El generador convierte automáticamente número-en-letra a dígito en el titular. Si el número
abre la portada: `.portada .num{ font-size:1.35em; line-height:0.9 }`. Prohibido arriba de 10
en portada salvo precio, año o cantidad real ("47 reseñas", "$48,000 USD").
**Validación de producto, no de estilo:** si la portada dice 3 y el carrusel trae 4 ítems,
bloquear el export. La promesa incumplida es un bug.

**2.7 — Viudas y huérfanas. [1 ángulo]**
A 152px una palabra sola en la última línea es un hueco de ~180px que desalinea el peso del
slide entero. `text-wrap: balance` en todo h1/h2 y `text-wrap: pretty` en cuerpo (el motor
es headless controlado, es seguro). Validador: partir el titular renderizado en líneas y
rechazar si la última tiene 1 palabra o mide menos del 35% del ancho de la anterior. Escape
determinista: permitir `<br>` manual y `&nbsp;` entre las dos últimas palabras.

**2.8 — Nada de fingir condensada. [1 ángulo]**
Prohibido `transform:scaleX()` por debajo de 0.9: adelgaza las astas por el mismo mecanismo
que mata a Cormorant Light.

---

### 3. Composición

**3.1 — Ancla fija, registro variable. Es la regla madre de la sección. [2 ángulos, rubro "todas"]**
Dos errores opuestos con la misma solución. Uno: el titular cambia de sitio en cada slide y
el ojo tiene que volver a buscar dónde empieza a leer. El otro: los nueve slides tienen
idéntico peso visual y la pieza se lee como PDF paginado. **La POSICIÓN se congela, el
REGISTRO cambia.**
1. Un solo rectángulo de texto por plantilla, definido una vez y heredado por TODOS los
   slides interiores: `--pad-x`, `--texto-top`, `--texto-w`. El bloque de titular usa esas
   coordenadas absolutas y solo cambia el contenido.
2. Prueba automática antes de exportar: medir `getBoundingClientRect().top` del primer
   bloque de texto de cada slide interior; **si la desviación máxima supera 8px (espacio
   1080), abortar nombrando el slide.** Portada y cierre quedan fuera del chequeo.
3. Catálogo de 3 registros sobre la MISMA rejilla: **A** = foto plena con pie micro;
   **B** = panel/tarjeta de texto; **C** = un solo dato enorme (cifra ≥240px).
4. Regla de secuencia: prohibido 3 slides consecutivos del mismo registro, y el slide más
   denso va seguido de uno A o C.

Es el error más barato de arreglar de todo el sistema: son variables compartidas más un
catálogo de tres maquetas.

**3.2 — Tope de densidad medido, no contado: 7 líneas y panel OPACO. [2 ángulos]**
El velo degradado funciona para un titular y no aguanta un bloque de 7 renglones: el primer
renglón cae donde el alfa ya es casi transparente y el contraste queda a merced de la foto.
Un panel plano sí es demostrable: `rgba(22,20,18,.92)` compuesto sobre el peor caso posible
(blanco puro) da ~`rgb(45,44,42)`, y contra texto hueso `#F4EFE8` sale ~12:1 — pasa el 6.0:1
con cualquier foto debajo.
```css
.ref{ position:absolute; left:96px; right:96px; bottom:200px;
      padding:56px 64px; background:rgba(22,20,18,.92); color:#F4EFE8 }
.ref p{ font:400 48px/1.35 Outfit; max-width:840px; text-wrap:pretty }
```
**CORRECCIÓN a la receta que circula:** fijar el ancho en `34ch` **no sirve** — en Outfit 34ch
≈ 980px y tu ancho útil es 888px (1080 − 96×2). El ancho se fija en px y los caracteres se
miden.
Tope: 7 líneas = 7 × 64.8px ≈ 454px, verificado por medición antes de serializar al
`foreignObject`:
```js
if (document.createRange().selectNodeContents(p).getClientRects().length > 7) partirEnDos()
```
Partir suma superficie de reentrada, así que no es castigo. Cursiva Cormorant solo para el
rótulo del panel; los datos siempre en Outfit redonda, nunca negrita.

**3.3 — El encabezado y el pie son la zona más débil del sistema. [1 ángulo, pero toca las 8 plantillas]**
Tu propio comentario en DESIGN_CSS lo dice: el velo cubre solo `.block`. Marca, fecha y
paginación viven FUERA de esa protección y encima son los tamaños más chicos de la pieza:
`.hdr .h/.d` a 28px subtienden 7.3′ y `.pag` a 30px en mayúsculas 11.9′ — los dos bajo el
umbral de 12.4′. Y la sombra por defecto `0 1px 12px rgba(0,0,0,.5)` tiene un desplazamiento
de 1px que en el iPhone SE 3 vale 0.69 px físicos: no aporta nada, el trabajo lo hace el
desenfoque.
```css
/* que .hdr-refuerzo sea el DEFAULT sobre foto, no el plan B */
.hdr, .pag{ text-shadow: 0 0 4px rgba(0,0,0,.9), 0 2px 18px rgba(0,0,0,.7) }
```
Quitar el desplazamiento de 1px de todas las sombras (`0 0` en vez de `0 1px`) y subir
`.hdr .h/.d` y `.pag` a 34px.

**3.4 — Banda de serie fija, idéntica en las 8 plantillas. [2 ángulos]**
El perfil debe leerse como biblioteca, no como galería: el lector aprende a identificar el
contenedor antes de leer el contenido.
```css
.serie-banda{ position:absolute; top:56px; left:80px; height:64px;
              font:500 30px Outfit; text-transform:uppercase; letter-spacing:.16em }
```
Misma posición absoluta en las 8 plantillas. Nombre de serie + índice.

**3.5 — Contador de contenido arriba-IZQUIERDA, y solo cuando hay orden. [2 ángulos]**
```css
.slide .paso{ position:absolute; top:64px; left:96px; font:500 30px Outfit;
              letter-spacing:.2em; text-transform:uppercase; opacity:.72 }
```
Contenido: «3 DE 7» o «PASO 3 DE 7». `left:96px` porque el recorte 3:4 del perfil se come
**33.75px por lado** ((1080 − 1350×0.75) / 2) y cualquier micro-tipografía a menos de eso se
corta; a 96px queda con 62px de holgura.
Dos razones, una prestada y una propia. Prestada: el efecto de gradiente de meta (Kivetz,
Urminsky & Zheng, 2006) muestra que la gente acelera hacia una meta visible — es evidencia
de laboratorio sobre progreso, no sobre carruseles, y así hay que tomarla. Propia y más
fuerte: **si cada slide debe entenderse solo, el contador es lo que le dice a quien entra
por el slide 2 que existe un 1 y un 7, sin gastar titular.**
**Encendido SOLO con orden obligatorio** (ADAGIO RH, REGENERIS, SMILE NOW, DENTALNOW).
Apagado en galería o catálogo sin orden (WASICAFE, MELISA, IVAE STUDIOS, PRODUCTIONS):
numerar ahí promete un método que no existe. En carruseles de 3 slides no numerar.
Siguen prohibidos los puntos propios y las barras de progreso pintadas.

**3.6 — La firma de marca es una FORMA, y necesita gemelo en Path2D. [2 ángulos]**
El color se comparte dentro de la categoría: SMILE NOW y DENTALNOW son dos dentales, y si
solo cambian de tono, en el feed son la misma marca. A 130pt de la cuadrícula del perfil una
diferencia de hue entre dos marcas del mismo rubro no se resuelve; una silueta sí (cápsula
vs esquina cortada se leen).
**OJO, esto no se puede hacer solo en CSS: la foto NO vive en el DOM.** En `carrusel-gen.js`
la imagen se pinta en canvas (`fitCover` ~L620, `pintarMural` ~L510, `pintarPanorama` ~L580)
con `ctx.rect` + `clip`, y la capa HTML/CSS se dibuja encima. Cada forma necesita **dos
implementaciones gemelas**: (1) canvas — sustituir `ctx.rect(...)` por un `Path2D` con
`ctx.roundRect(x,y,w,h,[r])` o los vértices del recorte, **en los 3 lugares**; (2) CSS — el
mismo valor en `border-radius`/`clip-path` de la tarjeta y del filete. Todo en espacio 1080,
no 2160.

| Marca | Silueta |
|---|---|
| SMILE NOW | radio `999` (cápsula) |
| DENTALNOW | esquina **inferior** derecha cortada 96px: `clip-path: polygon(0 0,100% 0,100% calc(100% - 96px),calc(100% - 96px) 100%,0 100%)` |
| IVAE STUDIOS | filete 2px a 48px del borde (`::before` con border, radio 0) |
| WASICAFE | arco superior `border-radius:50% 50% 0 0 / 9% 9% 0 0` |
| ADAGIO RH | barra diagonal de 6px a 22deg |
| MELISA | radio asimétrico `120px 12px 120px 12px` |
| REGENERIS | radio uniforme 32px |
| PRODUCTIONS | radio 0 + filete inferior de 6px |

Reglas duras: los dos dentales nunca comparten silueta; ninguna silueta muerde la esquina
superior derecha (`plantillas.js:77` ya lo documenta) ni los ~160px de abajo.
Y la firma vive siempre en el mismo lugar en TODOS los slides: `--firma-anclaje` con solo
3 valores permitidos (inferior-izquierda, superior-izquierda, banda-inferior-completa),
uno por marca, y no se cambia nunca entre plantillas. Si la firma baila de esquina, cada
slide arranca de cero. Composición fija: forma + logotipo normalizado + una línea de
micro-tipografía (@usuario o ciudad) en Outfit MAYÚSCULAS ≥30px, tracking `.1em`.

**3.7 — Zona muerta: 200×140px arriba a la derecha donde el generador no pinta NADA. [2 ángulos]**
No es una recomendación, es un rectángulo reservado en el layout engine. Si el diseño quiere
el número grande en esquina, que sea la izquierda.

**3.8 — Señal de deslizar: sangrado primero, letrero después, y solo en slides 1 y 2. [3 ángulos, con una contradicción interna resuelta]**
Lo que empuja el swipe es la incompletud visual, no el ícono. Señal principal =
**SANGRADO INTENCIONAL**: un elemento que el borde derecho corta a la mitad — una foto que
se sale con `margin-right:-120px`, una palabra del titular partida, una banda de color que
llega al borde. Contenedor `overflow:hidden` y el hijo desplazado para que quede visiblemente
incompleto.
Señal secundaria, opcional, **solo en slides 1 y 2** (los dos que Instagram puede usar como
entrada):
```css
.portada .desliza, .slide:nth-child(2) .desliza{
  position:absolute; left:96px; bottom:200px;
  font:500 34px Outfit; letter-spacing:.14em; text-transform:uppercase;
  color:#fff; text-shadow:0 2px 18px rgba(0,0,0,.55) }
.desliza::after{ content:' →' }
.slide .desliza{ display:none }   /* y se re-muestra solo en 1 y 2 */
```
Copy MX: «DESLIZA →», «SIGUE →», «VE LOS 7 →». Nunca «swipe», nunca frases largas.
Contraste mínimo 4.5:1 (es texto de 34px): banda o sombra, nunca blanco crudo sobre foto
clara.
**QUITÉ EL NÚMERO:** el «+9.3% de engagement» (1.83% → 2.00%, Socialinsider) es de **julio de
2020**, anterior a Reels, a la cuadrícula 3:4 y al ranking actual. No lo uses como promesa.
Úsalo como lo que es: una señal vieja y débil a favor de un cambio que cuesta cero.

**3.9 — Las portadas se diseñan de tres en tres. [1 ángulo, pero cambia el modo lote]**
Aesop planea el contenido en grupos de tres y trata la silueta de la cuadrícula del perfil
como elemento de diseño. IVAE genera por mes y por marca: **sus portadas SIEMPRE caen en
filas de 3**, y hoy cada una se diseña sola, así que la fila sale accidental. Ese es el único
lugar donde un prospecto ve 3 piezas de IVAE al mismo tiempo.
Modo «Serie de portadas»: al generar 3+ carruseles de la misma marca, las portadas rotan un
arreglo de 3 valores — `--bg` claro / oscuro / foto, o titular arriba / centro / abajo — para
que la fila tenga ritmo y no ruido. Margen lateral seguro en portadas: ≥48px en espacio 1080
(sobre los 33.75px que se come el recorte).

**3.10 — Prohibidas las filas de íconos. El diagrama de 3 nodos explica; el ícono decora. [1 ángulo]**
Los íconos abstractos son semánticamente opacos y fallan justo en lo que hacen RH,
consultoría y terapia: representar acciones y abstracciones. Y a 36%, un ícono de línea fina
desaparece.
```css
.nodo{ border:3px solid var(--texto); border-radius:8px; padding:36px;
       font:500 34px Outfit; text-transform:uppercase }   /* etiqueta de ≤3 palabras */
.nodo + .nodo::before{ content:''; display:block; height:72px; border-left:3px solid var(--texto) }
```
Máximo 3 nodos y 2 conectores por slide. Si el método tiene 5 pasos, **se parte en dos
slides — no se comprime.** Si de plano se usa un glifo: mínimo 3px de trazo y caja de 96px.

**3.11 — CTA a WhatsApp escrito, no botón dibujado. [1 ángulo]**
La píldora verde con el logo es una mentira de interfaz: se ve tocable, no lo es, y encima
cae justo en la banda de interfaz de IG — se pierde la conversión en el remate.
Línea tipográfica, no control: Outfit minúsculas ≥40px, precedida de un filete de 3px, tipo
«Escríbenos por WhatsApp · @ivae.studios». Contenedor con `padding-bottom:200px`; verificar
que la caja del CTA **cierre arriba del píxel 1150 de 1350**. Nada de `border-radius` que
simule botón, nada de logotipo de WhatsApp recortado. Si la marca tiene número, va como
texto, no como chip.

**3.12 — Testimonio: cita tipográfica, jamás dibujar la interfaz de Google. [2 ángulos]**
Dibujar el chrome de Google Reviews en CSS es fabricar un pantallazo falso aunque la reseña
sea real; basta que un paciente lo compare con el perfil verdadero para que la marca quede
peor que si no hubiera publicado. La tarjeta genérica (5 estrellas doradas, avatar redondo,
comillas gigantes) es del mismo tipo: lee como plantilla comprada, no como voz de paciente.
Plantilla «Voz»: cita en Cormorant 90–110px (escalón 3.0:1), columna de 62–68 caracteres,
comillas tipográficas reales `«»` y ninguna comilla decorativa gigante. Atribución en Outfit
MAYÚSCULAS 30px, formato nombre + inicial + tratamiento + mes: `ANGIE G. · ORTODONCIA · MARZO`.
**Prohibido en el CSS de esa plantilla:** glifos de estrella, avatar circular, logotipos de
plataformas y cualquier caja que imite chrome de app (barra superior, punto de menú, botón).
Casilla obligatoria de «consentimiento por escrito registrado» antes de poder exportar el
slide.

**3.13 — La música no cambia el diseño. [1 ángulo — es una aclaración, no una regla]**
Los carruseles con audio pueden aparecer en la pestaña de Reels, pero **NO auto-avanzan**:
el usuario sigue controlando el ritmo. Varios blogs sugieren diseñar «para 2-3 segundos por
slide» como si fuera video; eso llevaría a bajar densidad de texto sin necesidad. No toques
los pisos tipográficos. Solo agrega «poner audio antes de publicar» como paso fijo de la
lista de publicación, y asegura que la portada sobreviva junto a la interfaz de Reels.

---

### 4. Foto (y qué poner cuando no hay)

**4.1 — LEY: la escalera de imagen. Cara real > lugar/artefacto real > tipografía > stock (nunca). [6 ángulos · el hallazgo más repetido de todo el corpus]**
Cinco de las siete marcas no tienen banco de fotos. La salida NO es comprar stock de
«dentista sonriente con tablet»: el stock médico se reconoce al instante y **es peor que no
tener foto**, porque comunica que la clínica no tiene nada real que enseñar. Es un selector
obligado en el generador, en este orden:

**(1) Retrato del profesional** — tomado con teléfono. El único dato duro que resiste aquí:
Bakhshi, Shamma y Gilbert (CHI 2014) midieron 1.1 millones de fotos de Instagram y las que
incluyen un rostro tienen 38% más probabilidad de likes y 32% más de comentarios; el número
de caras, su edad y su género no cambian el efecto.
```css
.persona img{ object-position: 50% 25% }
.persona .scrim{ position:absolute; inset:0;
  background:linear-gradient(to top, rgba(0,0,0,.72) 0%, rgba(0,0,0,0) 46%) }
```
El scrim arranca DEBAJO de los ojos. Titular Cormorant ≥152px en el tercio inferior; nombre
en Outfit MAYÚSCULAS 30px encima del titular. Safe areas: 60px arriba de la coronilla; nada
legible en los 200×140px de la esquina superior derecha; todo lo crítico a ≥60px de los
bordes laterales.

**(2) Lugar, detalle o ARTEFACTO real** — recepción, manos, macro del instrumental limpio,
la puerta con el letrero. Y sobre todo el **entregable**: hoja de rotación impresa, agenda de
sesión, guía de color dental, costal y molino, monitor con la línea de tiempo, checklist
marcado a mano. Es verificable y único; el stock lo puede poner el competidor de enfrente.
Captura: celular, luz de ventana lateral, cenital a 90°, superficie lisa mate, sin flash;
una mano sosteniendo o señalando sube la sensación de real.
```css
.artefacto{ height:62%;                       /* rango 55-70% del alto */
  transform: rotate(-1.2deg);
  box-shadow: 0 24px 60px rgba(0,0,0,.28);
  filter: contrast(1.06) saturate(.92);
  margin: 90px }
.artefacto + .pie{ font:500 32px Outfit; text-transform:uppercase; letter-spacing:.12em }
```
**Anonimizado obligatorio en dental, terapia y RH:** tapar nombres, teléfonos y RFC con un
rectángulo OPACO (`background:#0E0E10`), **nunca con `filter:blur()`** — se ve descuidado y es
parcialmente reversible.

**(3) Tipografía como imagen** — ver 4.2.

**(4) Stock** — chip ámbar y el generador sugiere el escalón 3. Campo `origen_imagen` con
valores `propia | artefacto | cifra`; si el usuario sube algo marcado como stock, bloquear.
(Quité las cifras que circulaban aquí: el «98% de consumidores» es de Getty, proveedor
comercial, y el «88% de pacientes / 35% mejor conversión» no tiene fuente rastreable. El
argumento de oficio se sostiene solo.)

**4.2 — El ancla tipográfica: numeral cuando hay lista, cifra dura cuando no. [4 ángulos]**
Lo que se guarda es información, y la información no necesita fotógrafo. Sobre hueso o
tinta plana el ratio de contraste es fijo y verificable, sin depender de qué zona de la
foto quedó debajo del texto.
```css
.sinfoto{ background:#F2ECE3 }                /* o tinta #161412 */
.ancla-num{ font:600 280px/.82 Cormorant;     /* 600, no 300 — ver 2.2 */
  font-variant-numeric: lining-nums tabular-nums;
  margin-left:-.05em }                        /* compensa el bearing izquierdo de Cormorant
                                                 para que el numeral alinee ópticamente con
                                                 la columna de texto */
```
Verifica el primer render: si el corte del woff2 no trae `lnum`/`tnum` la propiedad no hace
nada y las cifras salen estilo antiguo con descendentes (ver 2.1) — o se asume como rasgo, o
el numeral pasa a Outfit 240px.
Tres reglas: (1) el ancla **nunca** es el único diferenciador del slide, siempre va con su
titular completo — a quien entró por reentrada un «3» solo no le dice nada; (2) si el
contenido no es lista, el ancla es un dato real (1:15, 48 h, 25%, un precio), nunca un
número decorativo; (3) regla de masa: el bloque de tipo debe ocupar **≥55% del alto del
lienzo**, si no a 36% el slide lee como plantilla vacía.

**4.3 — En intangibles, la cifra sola le gana a la gráfica. [2 ángulos]**
El reflejo de RH y consultoría es meter barras. A 390px reales, una gráfica con ejes,
leyenda y grid es ruido.
```css
.cifra .etq{ font:500 32px Outfit; text-transform:uppercase; letter-spacing:.12em }
.cifra .num{ font:600 360px/1 Outfit;         /* rango 300-420px */
  font-variant-numeric: tabular-nums; letter-spacing:-.02em }
.cifra .ctx{ font:400 44px/1.3 Outfit; max-width:840px }   /* ≤14 palabras, UNA línea de contexto */
```
Si de plano hace falta barra: **máximo 4 barras, `border:0`, sin grid, sin leyenda, sin eje
Y**, y el valor impreso DENTRO de la barra.
Regla de escritura que va con esto: **número exacto, nunca redondeado** — «47 reseñas» y no
«+50»; «8 de cada 10 renuncias» y no «la mayoría». Y solo si se puede respaldar.

**4.4 — Plantilla «Serie»: una foto rinde 6-11 slides. Y la receta que circula está MAL. [2 ángulos]**
Gentle Monster (@gentlemonster, 2.4M) publica el mismo objeto en 8-10 encuadres casi
idénticos, sin una palabra sobre la imagen: el movimiento entre slides ES el contenido.
Resuelve el problema más caro de la agencia sin pedirle material al cliente.
**CONTRADICE la receta del hallazgo original** (`object-position: calc(8% + var(--i)*8.6%)`
+ `scale(1.02 + i*0.035)`): con `object-fit:cover`, si la foto ya es 4:5 **no hay
desbordamiento y `object-position` no mueve NADA** — las 10 slides salen idénticas. El
desbordamiento lo regala la diferencia de proporción, no el zoom.
```css
.serie{ position:relative; width:1080px; height:1350px; overflow:hidden }
.serie img{ width:100%; height:100%; object-fit:cover;
  object-position: calc(var(--i) / (var(--n) - 1) * 100%) 50% }   /* foto horizontal */
```
Si la foto es vertical (proporción < 0.8) el desbordamiento es vertical:
`object-position: 50% calc(...)`.
Tres guardas obligatorias en el generador:
- **(a) HOLGURA** — `ventana = 0.8 / proporciónFuente`; `holgura = 1 − ventana`. Si holgura = 0
  (foto 4:5), rechaza y pide foto más ancha.
- **(b) PASO MÍNIMO** — `(holgura/(n−1))/ventana ≥ 0.08`, o sea
  `nMax = 1 + piso((holgura/ventana)/0.08)`. Una 3:2 da hasta **11 slides**; una 4:3, hasta
  **9**. Por debajo del 8% las slides se ven idénticas y parece error, no ritmo.
- **(c) RESOLUCIÓN** — para exportar a 2160×2700: foto horizontal necesita lado corto
  ≥2700px; foto vertical, ancho ≥2160px.

Composición: **la serie TERMINA donde está el sujeto** (la última slide lo centra). Si no,
el paneo no resuelve y se lee como recorte accidental.

**4.5 — Plantilla «Retícula»: la repetición es composición, no relleno. [1 ángulo, con paper detrás]**
En el estudio de 53,894 imágenes, la repetición salió predictor positivo de likes junto con
el color cálido, y sube complejidad de TEXTURA (buena) sin subir complejidad de COMPOSICIÓN
(mala).
```css
.reticula{ display:grid; grid-template-columns:repeat(3,1fr); gap:14px; background:#EFE7DC }
```
La MISMA foto recortada en 3 encuadres, o el mismo producto ×3. **Regla dura: cuando el
cliente sube una sola foto utilizable, la retícula rinde más que ampliarla a sangre.** Y en
el brief de foto: pedir 3 piezas idénticas alineadas, no 1.

**4.6 — La mirada apunta al texto. [1 ángulo, con paper detrás]**
En visionado libre la gente mira los rostros 16.6 veces más que regiones comparables
normalizadas por tamaño y posición (Cerf et al., *Journal of Vision*), y en eye-tracking
publicitario la mirada desviada **hacia el contenido** supera a la mirada directa a cámara
en atención al texto del anuncio.
Persona en el tercio exterior, bloque de texto en los dos tercios opuestos, mirada apuntando
al texto. Si la toma quedó al revés: `transform: scaleX(-1)` en la capa de imagen —
verificando antes que no haya texto legible ni logo en la foto. Ojos en la línea del 38%
superior.
Combinación con las otras reglas: **rostro para la portada, artefacto para los interiores,
y el retrato NUNCA en el slide de testimonio** (ahí manda el dato, 3.12).

**4.7 — El asa y la cuchara van hacia la derecha. [1 ángulo, 1 línea de CSS]**
Elder & Krishna, *Journal of Consumer Research* 38(6), 2012: orientar el producto hacia la
mano dominante (derecha, ~90%) facilita la simulación mental de uso y sube la intención de
compra. Casilla en el editor; si está a la izquierda, `transform: scaleX(-1)` — bloqueado si
la foto trae texto, logo o latte art asimétrico.
**Excepción del propio estudio:** si el producto se percibe como negativo (algo que el
espectador NO quiere consumir), el efecto **se invierte y BAJA** la intención. No lo apliques
a fotos de problema (sarro, caries, café quemado).
En el brief de foto: la taza se sirve con el asa a las 4 en punto, no a las 8.

**4.8 — El pie de foto va DENTRO de la imagen. [2 ángulos]**
Standart (@standartmag, 157K, revista de café premiada, casi todo carruseles) mete la línea
de pie —lugar, origen, crédito— dentro de la diapositiva, como en papel. El lector nunca
sale de la imagen para saber qué está viendo. Y resuelve un problema medible: el caption se
colapsa a ~2 líneas en el feed, así que el origen del grano, el nombre del salón, la ciudad
o el «a los 6 meses» son invisibles salvo que toquen «más».
```css
.cutline{ position:absolute; bottom:196px; left:48px; right:48px; max-width:820px }
.cutline .dato{ font:500 34px Outfit; text-transform:uppercase; letter-spacing:.14em }
.cutline .voz { font:600 64px Cormorant; font-style:italic }
```
Máximo 2 líneas. Velo **local**, no oscurecer la foto entera: div de 620px pegado abajo con
`linear-gradient(to top, rgba(0,0,0,.72) 0%, rgba(0,0,0,.66) 55%, rgba(0,0,0,0) 100%)`, y el
texto SIEMPRE dentro del tramo donde el alfa ya llegó a su piso, nunca en la parte que se
desvanece.

**4.9 — La tabla de alfa que te ahorra medir contraste sobre foto. [1 ángulo, alto valor]**
Si el texto es blanco y supones la foto **más hostil posible** (blanco puro), el alfa mínimo
del velo depende solo del escalón de tamaño:

| Escalón | Alfa mínimo | Hardcodea (redondeado 2 puntos arriba) |
|---|---|---|
| ≥90px → 3.0:1 | .42 | **.44** |
| ≥50px → 3.6:1 | .48 | **.50** |
| ≥34px → 4.5:1 | .54 | **.56** |
| micro → 6.0:1 | .62 | **.64** |

Con esos pisos **ninguna foto puede reprobar** — ni una playa sobreexpuesta ni un fondo
blanco de consultorio. Clava la tabla y **borra el paso de medir contraste sobre foto.**

---

### 5. Tratamiento

**5.1 — El grade es un token de marca, no una decisión por post. [3 ángulos]**
Es el único lever que hace que la MISMA foto se lea como de otra marca, y el que unifica
material de calidad dispar — incluidas las fotos que el cliente manda del celular.
Dos variables por marca, `--foto-filtro` y `--tinte` (color + opacidad de una capa encima con
`mix-blend-mode:soft-light`), más `--grano` (0 a .12):

| Marca | filter | tinte | grano |
|---|---|---|---|
| IVAE STUDIOS | `saturate(.92) contrast(1.04)` | cálido `oklch(.7 .05 60)` 6% | .04 |
| MELISA | `saturate(1.08) brightness(1.03)` | rosa 8% | .04 |
| DENTALNOW | `brightness(1.06) saturate(.85)` | cian 5% (lee clínico) | .03 |
| WASICAFE | `sepia(.18) contrast(1.06)` | cálido 8% | .10 |
| PRODUCTIONS | `contrast(1.12) saturate(.8)` | neutro | .06 |
| REGENERIS | `saturate(.94) contrast(1.03)` | salvia 5% | .05 |

**Aplica el filtro al CONTENEDOR de la imagen, no al `<img>`**, para que el velo del texto no
se filtre también.

**5.2 — CONTRADICE 5.1: paridad fotométrica en fotos de resultado. [1 ángulo, pero es riesgo legal]**
Cualquier tratamiento visual —brillo, saturación, contraste, viñeta, grano, temperatura—
aplicado a una foto de resultado clínico la vuelve publicidad engañosa. Y **tu grade de marca
cuenta como edición.** El detonante #1 de quejas confirmadas en estética es la inconsistencia
de luz y ángulo entre «antes» y «después» (el caso clásico: aro de luz en el después y no en
el antes).
```css
.comparacion img{ filter:none !important; mix-blend-mode:normal !important }
```
Prohibido cualquier overlay con blend sobre esa capa. El color de marca (arena, tinta,
salvia) vive SOLO en el marco, la banda y la tipografía — nunca sobre el píxel clínico. El
velo para el texto va como capa hermana con `pointer-events:none`, confinada al 30% inferior,
fuera de la zona del resultado. Bandera automática: si la pieza está marcada como
blanqueamiento o antes/después, **el grade se desactiva y se fuerza balance neutro**.

**5.3 — En F&B la variable real es cálido-vs-frío, no el brillo. [1 ángulo, con corrección]**
La nota de la Universidad de Georgia sobre Peng et al. (>50,000 imágenes de cuentas de
comida en Instagram) sostiene tres cosas: **colores cálidos en vez de fríos, repetición, y
fondo limpio.** *Corrección al hallazgo original:* esa fuente NO respalda que el brillo, la
«colorfulness» y la complejidad actúen a la inversa — ese era el gancho contraintuitivo y no
se pudo verificar; queda fuera.
La razón técnica propia que sí sostiene el freno a la saturación: al exportar a JPEG 0.92 el
**submuestreo de croma 4:2:0 degrada primero los rojos y naranjas saturados**, así que subir
saturación en comida produce manchones en el archivo final; y `brightness>1` quema los
blancos de espuma, crema y plato, que es donde vive la textura.
```css
.fb img{ filter: saturate(.96) contrast(1.04) }         /* nunca brightness > 1 */
.fb .calido{ position:absolute; inset:0; background:#FF9E4A;
             opacity:.08; mix-blend-mode:soft-light; pointer-events:none }
```
Lista negra para rubro F&B: `hue-rotate` entre 180° y 260°, duotonos azul/verde,
`saturate(>1.1)`, `brightness(>1.05)`.
**GOTCHA de contraste — probablemente lo estás midiendo mal hoy:** el overlay cálido sube la
luminancia del área bajo el texto, así que el chequeo (≥90px 3.0 / ≥50px 3.6 / ≥34px 4.5 /
resto 6.0) **hay que correrlo sobre el píxel COMPUESTO del canvas, no sobre la foto
original.** Si se mide antes del overlay, el resultado no vale.
**Excepción dura:** no apliques el tono cálido cuando el BLANCO es el producto —
blanqueamiento, antes/después de SMILE NOW y DENTALNOW, batas y dientes. El ámbar amarillea
exactamente lo que se vende.

**5.4 — El grano ya existe, pero está calibrado para verse al 100% y es blanco. [1 ángulo, verificado en tu código]**
`carrusel-gen.js:436-439` ya pinta grano `feTurbulence` sobre TODA la pieza, fuera del
`foreignObject`, así que ya cose foto y panel — eso ya está hecho. Lo que está mal son los
parámetros: `baseFrequency='0.9'` y una `feColorMatrix` que fuerza el RGB a **blanco** con
alpha 0.35 a `opacity 0.055`.
`baseFrequency 0.9` se mide en unidades del viewBox (1080×1350): la celda de ruido es de
~1.1px en el archivo final. Al 36% eso son 0.4px, o sea que el ruido se promedia
espacialmente y queda un velo plano de ~3% — **el grano solo aparece cuando alguien abre la
foto a pantalla completa.** Y al ser ruido blanco, sobre el hueso `#F2EEE7` de Papel no hay
contraste y desaparece del todo: **la plantilla que se llama «Papel» es literalmente la
única sin textura de papel.**
```
/* :436 */  baseFrequency='0.18'  numOctaves='3'   /* celdas de ~5.5 / 2.8 / 1.4px: la
                                                      primera sobrevive al 36%, las otras dos
                                                      sostienen el detalle de cerca */
```
No bajes de `0.10` o se lee sucio, no a película. Mantén `opacity` entre .05 y .07 y vuelve a
correr el chequeo de contraste. Y declara **dos** filtros, eligiendo según la superficie:
```html
<filter id='grainDark'>
  <feTurbulence type='fractalNoise' baseFrequency='0.18' numOctaves='3' stitchTiles='stitch'/>
  <feColorMatrix type='matrix' values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  .35 .35 .35 0 0'/>
</filter>
<!-- :439 -->  filter=url(#{P.fondo ? 'grainDark' : 'grain'})
```
Bonus técnico: un degradado grande de un solo tono en 8 bits + JPEG 0.92 hace bandas
visibles, y el grano bien calibrado es el dither que las mata. Hoy no lo hace por ser
demasiado fino.
**Criterio de aceptación:** exporta, mira el PNG a 390px de ancho, y que la textura se note.
Si no se nota, no está haciendo su trabajo.

**5.5 — Mate, nunca brillo. [1 ángulo, con paper detrás]**
*Marketing Letters* 30(2), 2019, «Matte matters»: cuando el empaque mate sube la naturalidad
percibida del alimento, el consumidor espera mejor sabor y compra más (superficie rugosa =
reflexión difusa = lectura de «artesanal»). Piqueras-Fiszman & Spence (2012) mostraron la
transferencia crossmodal de textura háptica a sabor percibido.
Lista negra en el CSS del generador para F&B y para ADAGIO RH (papel = artesanal/humano):
`backdrop-filter:blur` (glassmorphism), `linear-gradient(rgba(255,255,255,…))` sobre la foto,
`box-shadow` con blanco, gradientes espejo. Esto es el fundamento de la plantilla Papel y la
razón para hacerla el default de WASICAFE.

**5.6 — Halación cálida en altas luces: el look de foto 2026. [1 ángulo]**
Lo que se ve nuevo no es el sepia: es grano orgánico + **halación** (resplandor rojizo
alrededor de las luces más brillantes, por el rebote de luz en la base de la película) +
roll-off suave. El delator de un fake malo es el LUT global y pesado —sepia o desaturación
uniforme—, que es el preset de 2018.
```css
.foto img{ filter: contrast(1.05) saturate(1.06) }   /* nada de sepia() */
.foto::after{ content:''; position:absolute; inset:0; mix-blend-mode:screen;
  background: radial-gradient(60% 45% at var(--luzX) var(--luzY),
              rgba(255,138,74,.20), transparent 65%) }
```
`--luzX/--luzY` se posicionan sobre la zona más clara del encuadre. Bonus barato:
`box-shadow` inset cálido de 40px en el borde superior si la luz entra por arriba.
Para IVAE STUDIOS y PRODUCTIONS (foto propia); también salva una foto de banco en MELISA y
WASICAFE.

**5.7 — Y2K y cromado están quemados; el retro que sí funciona es el mal registro de serigrafía. [1 ángulo]**
El paquete Y2K (metálicos, cromo, mariposas, tipo gorda, texturas de baja resolución) pasó
de guiño a muleta: «cuando toda campaña usa el mismo lenguaje Y2K, es estilo uniforme, no
referencia». Lo vivo en 2026 es el retro **de proceso**: serigrafía, sobreimpresión de tintas,
tipo mal registrado — recomponer el proceso, no copiar la estética.
Dos capas del mismo titular:
```css
.registro{ position:relative }
.registro .atras{ position:absolute; inset:0; color:var(--acento);
  transform:translate(3px,-3px); mix-blend-mode:multiply }
```
Nada de degradado metálico, `text-shadow` de cromo ni bevel. **Y no toques la sombra negra
del titular:** la regla de marca (blanco sobre sombra) se mantiene — el mal registro va en
rótulos secundarios, nunca en el hook de portada.

**5.8 — Export: PNG cuando el slide es casi puro texto sobre color plano. [2 ángulos]**
Instagram recomprime de todos modos, pero así hay **una sola generación con pérdida en lugar
de dos**, y los bordes de letra son exactamente donde caen los artefactos. Sube el peso; vale
la pena en Papel, Consultorio, Cifra y cualquier slide sin foto.
Y agrega el **botón «vista feed»** al previsualizador: renderiza el slide a 390px de ancho con
el MISMO pipeline de escalado del export. Es la única prueba honesta del piso de legibilidad
y cuesta una línea. Con él verificas en 30 segundos la regla de 5.9.

**5.9 — La regla de trazo que el fotómetro NO detecta. [3 ángulos]**
El validador de contraste mide COLOR; lo que se muere al 36% es el GROSOR. Un trazo fino de
1.7px en el archivo llega a 0.6px en pantalla, y el antialias de cobertura parcial convierte
un 7:1 calculado en un gris real de la mitad. El color pasa la prueba y la letra igual se ve
lavada.
**Regla nueva del validador: el trazo más fino de cualquier texto debe medir ≥3px en el PNG
de 1080** (≈1.1px al 36%). Verificación manual: exportar, zoom al 800% sobre una «o», contar
píxeles.

---

### 6. Plantillas: 4 nuevas, 1 modificador, 0 rediseños

Todo lo anterior se resuelve con esto sobre las 8 que ya existen:

| Nueva | Qué es | Sale de |
|---|---|---|
| **Serie** | 1 foto → 6-11 slides por paneo `object-position` | 4.4 |
| **Expediente / Cifra** | artefacto rotado ‑1.2° o número héroe 300-420px | 4.1, 4.3 |
| **Retícula** | grid 3×N con la misma foto o el mismo producto | 4.5 |
| **Consultorio** | hermana de Papel **sin** hueco de foto: hueso + Cormorant 180-220px `line-height:.96` + filete 3px + firma Outfit 30px | 4.1(3) |
| **Método** | 3 nodos CSS + 2 conectores, cero íconos | 3.10 |
| **Voz** | testimonio tipográfico, sin estrellas ni avatar | 3.12 |
| *Modificador* **Par invertido** | intercambia `--lienzo`/`--tinta` sin mover nada más; aplica a CUALQUIER plantilla | 1.7 |

Textura barata para los fondos sin foto: `repeating-linear-gradient` de 1px a opacidad .03
+ `radial-gradient` de viñeta suave.

---

### 7. Las 8 contradicciones, juntas

1. **El grade de marca vs. las fotos de resultado.** Tu token de color ES una edición. En
   antes/después va `filter:none !important`. (5.2)
2. **El chequeo de contraste corre sobre la foto original, no sobre el píxel compuesto.** Con
   overlay cálido o velo encima, hoy estás midiendo mal. (5.3)
3. **La plantilla «Papel» no tiene textura de papel**: el grano es blanco y su celda mide
   1.1px. (5.4)
4. **La firma en Pinyon 54px** (`plantillas.js:106`) es el trazo más fino del sistema y es lo
   que identifica a la marca. Es un ~5px de ojo en el feed. (2.3)
5. **La receta de «Serie» que circula no funciona** con fuente 4:5: `object-position` no mueve
   nada sin desbordamiento. (4.4)
6. **`max-width:34ch` no cabe**: 34ch en Outfit ≈ 980px contra 888px útiles. (3.2)
7. **Las formas de marca no se pueden hacer solo en CSS**: la foto se pinta en canvas, cada
   silueta necesita gemelo en `Path2D` en los 3 lugares. (3.6)
8. **El velo solo cubre `.block`**: encabezado y pie —los tamaños más chicos de la pieza—
   están fuera de la protección del fotómetro. (3.3)

**Números que quité por falta de fuente creíble:** el +9.3% de swipe (Socialinsider, julio de
2020, pre-Reels); el 98% de Getty; el 88% de pacientes y el 35% de mejor conversión (blogs
dentales sin fuente rastreable); el 13/10/9% de Monotype (estudio de fabricante); el
x2.3 de engagement por serialización; y las cifras de fama-unicidad de Ehrenberg-Bass
(40%/71%, HHI 0.69/0.31 — DOI no verificable). En los seis casos el principio se sostiene sin
el número.

---

## COPY — cómo se escriben los textos

De 25 hallazgos de copy quedaron 13 después de fusionar duplicados. Seis aparecieron
en 3 ángulos distintos o cubren 5+ marcas: son **ley**, van al validador del generador
como bloqueo o como chip ámbar. El resto son reglas de escritura para Vianey.

| # | Regla | Ángulos | Marcas | Estatus |
|---|---|---|---|---|
| 1 | El titular es la **conclusión**, ≤7 palabras, y la portada no contesta la pregunta | 3 | 5 | LEY |
| 2 | Palabras comunes; la jerga de cada marca tiene sustituto obligatorio | 3 | 8 | LEY |
| 3 | Lista negra de salud (bloqueo de exportación) | 3 | 5 | LEY |
| 4 | Pregunta solo con público frío; con público en decisión, afirmación | 2 | 8 | LEY |
| 5 | El CTA pide **guardar / mandar / escribirme**, nunca comentar | 3 | 8 | LEY |
| 6 | El precio va como numeral pelón — salvo si es promoción de servicio | 2 | 6 | LEY |
| 7 | Superlativo negativo sí, positivo nunca | 1 | 8 | regla |
| 8 | Banco de 6 fórmulas de gancho con ranuras | 1 | 8 | regla |
| 9 | Testimonio con nombre completo + rol + cifra (bloqueado en salud sin folio) | 2 | 5 | regla |
| 10 | El caption no repite ninguna frase dibujada | 1 | 4 | regla |
| 11 | En salud, el slide 2 nombra el miedo, no el tratamiento | 1 | 4 | idea suelta |
| 12 | Micro-etiqueta `DESLIZA →` en slides 1 y 2 | 1 | todas | idea suelta |
| 13 | Slide de identidad: una frase capturable de ≤9 palabras | 1 | 3 | idea suelta |

---

### 1. El titular de portada

**Es la conclusión, no el tema.** «Rotación de personal» es un asunto y no obliga a
nada. «Tu rotación no es de sueldo» es una afirmación y abre un hueco. Modelo editorial
de The Economist, y es la corrección más barata al gancho porque funciona **sin foto**,
que es justo el caso de ADAGIO RH, DENTALNOW y REGENERIS.

Tres validaciones antes de exportar:

1. **Verbo conjugado.** Si el titular es puro sustantivo → ámbar. «Blanqueamiento dental»
   no es titular; «El blanqueamiento no arregla una mancha vieja» sí.
2. **≤7 palabras.** Duro.
3. **Cabe.** No cuentes caracteres a mano: renderiza el bloque en el DOM real con el CSS
   final y cuenta `getClientRects().length`. Exige **≤3 líneas** a `font-size:152px`,
   `line-height:.95`, `width:984px` (1080 − 2×48).

**Presupuesto de caracteres para escribir de memoria** (a 152px sobre 984px útiles):
Cormorant mete ~15 caracteres por línea, Outfit ~12. O sea:

- Titular en Cormorant: **hasta ~45 caracteres**
- Titular en Outfit mayúsculas: **hasta ~36 caracteres**
- Zona cómoda de las dos: **26–38 caracteres**

Estos números son para escribir; la verdad la dice la medición. **GOTCHA del pipeline:**
la medición del DOM solo es cierta si Cormorant/Outfit/Pinyon van embebidas como
`@font-face` woff2 en base64 DENTRO del `<svg>`. Si no, el `foreignObject` sobre canvas
cae a fuente de sistema y el conteo de líneas que mediste miente.

**CONTRADICE lo que hacemos hoy:** cuando el copy no cabe, el diseño se rinde y baja la
tipografía. Debe ser al revés — el piso de 152px es sagrado, el campo se pinta en rojo y
**se recorta el copy**. El auto-fit solo puede *subir* (152 → 220px), nunca bajar.

**La portada no puede contener la respuesta.** Si dice «5 señales de que necesitas
ortodoncia: dolor, apiñamiento, mordida…» ya no hay motivo para deslizar. El error
inverso mata igual: «Hablemos de salud bucal» no promete nada. Lint: si el token que
resuelve la promesa (el precio, el nombre de la técnica, el número) aparece en portada
**y** en un slide interior, marcarlo.

**Corolario de orden:** la idea más valiosa va en los slides 2–3, no en el 9. La mayoría
no llega al final — en el carrusel del home de Notre Dame solo 1% de los visitantes
interactuó y, de ese 1%, 84% se quedó en el primer slide. No guardes lo mejor para el
cierre.

**Acento:** una sola palabra del titular puede ir en Cormorant itálica. Una. Jamás
negrita, jamás dos palabras.

---

### 2. Banco de ganchos: 6 moldes con ranuras

Van como 6 botones en el editor de portada. Al elegir uno, el campo se precarga con las
ranuras y el contador de caracteres arranca en rojo hasta que quepa. Todos los ejemplos
de abajo están medidos: caben en ≤3 líneas y ninguno pasa de 7 palabras.

#### F1 · NEGACIÓN — «No es [X]. Es [Y].»
Sirve cuando el cliente cree que compra una cosa y compra otra. Las palabras negativas
suben el clic (Nature Human Behaviour, 2023).

| Marca | Ejemplo | car / pal |
|---|---|---|
| SMILE NOW | No es estética. Es tu mordida. | 30 / 6 |
| REGENERIS | No es la edad. Es la rodilla. | 29 / 7 |
| ADAGIO RH | No renuncian al puesto. Renuncian al jefe. | 42 / 7 |
| PRODUCTIONS | No es un video. Es tu escaparate. | 33 / 7 |

#### F2 · ERROR CON COSTO — «El error que [verbo] tu [cosa].»
El más versátil de los seis. El costo tiene que ser concreto: dinero, tiempo o una
segunda cita.

| Marca | Ejemplo | car / pal |
|---|---|---|
| DENTALNOW | El error que encarece tu implante | 33 / 6 |
| REGENERIS | El error que alarga tu recuperación | 35 / 6 |
| ADAGIO RH | El error que te cuesta dos contrataciones | 41 / 7 |
| MELISA | El error que apaga tu piel | 26 / 6 |
| IVAE STUDIOS | El error que borra tu atardecer | 31 / 6 |

#### F3 · NÚMERO + MOMENTO — «[3–7] cosas que [verbo] antes de [decisión].»
Los titulares con número encabezan el ranking y 3–10 son los que más rinden (BuzzSumo,
100 millones de titulares). En español el número **se escribe con cifra**, nunca con
letra: ocupa un carácter y ancla la mirada.

| Marca | Ejemplo | car / pal |
|---|---|---|
| ADAGIO RH | 3 cosas que revisar antes de contratar | 38 / 7 |
| WASICAFE | 3 errores que arruinan tu café | 30 / 6 |
| MELISA | 3 cosas antes de tu primer facial | 33 / 7 |
| PRODUCTIONS | 3 cosas que pedir antes de grabar | 33 / 7 |
| SMILE NOW | Qué preguntar antes de unas carillas | 36 / 6 |

#### F4 · CONTRADICCIÓN — «[Creencia], pero [hecho corto].» o «[Hecho]. [Consecuencia].»
El hecho va arriba, no la creencia sola (estructura de *truth sandwich*).

| Marca | Ejemplo | car / pal |
|---|---|---|
| ADAGIO RH | Contratar rápido cuesta el doble | 32 / 5 |
| REGENERIS | Descansas ocho horas y sigues cansado | 37 / 6 |
| DENTALNOW | Un implante bien cuidado dura décadas | 37 / 6 |
| IVAE STUDIOS | Contrataste el salón. Falta la luz. | 35 / 6 |

#### F5 · PREGUNTA CERRADA — «¿[Verbo] [objeto] en Cancún?» · SOLO público frío, ≤5 palabras
Respondible con sí/no, sin subordinadas, una sola línea. Ver regla 4 antes de usarla.

| Marca | Ejemplo | car / pal |
|---|---|---|
| WASICAFE | ¿Café de olla en Cancún? | 24 / 5 |
| WASICAFE | ¿Tu café sabe a quemado? | 24 / 5 |
| MELISA | ¿Tu piel brilla a mediodía? | 27 / 5 |

#### F6 · CATEGORÍA EN 3ª PERSONA — «Lo que [verbo] [grupo] en [lugar].»
Esquiva la caída de 36% que trae el «tú» en titular (Outbrain, 65,000 titulares en
inglés — dirección, no ley) y esquiva la política de atributos personales de Meta, que
castiga insinuar que conoces la condición del lector.

| Marca | Ejemplo | car / pal |
|---|---|---|
| IVAE STUDIOS | Lo que preguntan las novias en Cancún | 37 / 7 |
| PRODUCTIONS | Lo que preguntan los hoteles de Cancún | 38 / 7 |
| SMILE NOW | Lo que nadie revisa antes del blanqueamiento | 44 / 7 |

**Reparto por marca (default del generador):**

- SMILE NOW · DENTALNOW · REGENERIS → **F2 y F4** (decisión de alta implicación)
- ADAGIO RH · PRODUCTIONS → **F1 y F3**
- WASICAFE · MELISA → **F5 y F3** (público frío)
- IVAE STUDIOS → **F6 y F2**

---

### 3. Pregunta o afirmación: se decide antes de escribir

La pregunta retórica en portada no es buena ni mala: depende de la implicación del
lector. Con implicación **baja** (nadie está pensando en el tema) la pregunta obliga a
procesar el mensaje y ayuda. Con implicación **alta** (alguien ya está comparando
implantes, terapias o fotógrafos de boda) la pregunta interrumpe el pensamiento que ya
traía y lo reduce: ahí gana la afirmación con dato. Petty/Cacioppo/Heesacker 1981,
replicado por Swasy & Munch 1985 (JCR). Es teoría de procesamiento replicada, no una
métrica de plataforma: se usa como **regla de ruteo**, no como promesa de porcentaje.
Explica por qué el mismo gancho funciona en WASICAFE y fracasa en DENTALNOW.

**Campo obligatorio al crear el carrusel: `descubrimiento` o `decisión`.**

| | Descubrimiento | Decisión |
|---|---|---|
| Qué es | café, estética ligera, cultura de empresa, detrás de cámaras, portafolio | implante, ortodoncia, terapia regenerativa, cotización de boda, contratación |
| Portada | pregunta CERRADA ≤5 palabras, sí/no, sin subordinadas | afirmación con dato verificable; el generador **bloquea el «¿»** |
| Marcas por default | WASICAFE, MELISA, PRODUCTIONS | SMILE NOW, DENTALNOW, REGENERIS, IVAE STUDIOS, ADAGIO RH |

Prohibido siempre, en los dos carriles: preguntas abiertas en portada, «¿Sabías que…?»
y cualquier pregunta que ocupe más de una línea.

---

### 4. El cuerpo de los slides

**Palabras comunes, palabras cortas, frases cortas.** Markowitz & Shulman (Science
Advances, 2024) sobre 7,371 experimentos del Washington Post y ~22,600 de Upworthy: el
índice de simplicidad predijo mayor CTR; en laboratorio los lectores eligieron el
titular simple 34.8% contra 15.3% y lo recordaron mejor. El dato incómodo para el flujo
de aprobación: **249 periodistas profesionales predijeron al ganador al 50%, o sea al
azar.** Corolario de proceso: cuando el equipo dude entre dos ganchos **no se vota** —
se publican los dos en piezas distintas del mes y se compara en el reporte mensual.

Reglas duras de escritura (obligatorias en salud y RH, recomendadas en todas):

- **≤15 palabras por oración.**
- **≤12 palabras por bloque de línea** en un slide.
- Ningún término clínico sin glosa en línea la primera vez: «bruxismo (apretar los
  dientes)», «periodontitis (encías enfermas)». Diccionario de glosas por marca,
  editable, para no reescribirlo cada mes.
- **Máximo UNA palabra técnica en la portada**, y solo si es lo que se vende (implante,
  ortodoncia). Nunca el proceso.
- **Medir, no adivinar el largo de palabra:** «Rehabilitación» son 14 caracteres; a 152px
  no entra en la línea. Con `ctx.measureText` sobre la palabra más larga de cada bloque,
  al tamaño y la fuente FINALES, contra el ancho útil. Si se pasa → chip ámbar con
  sinónimo sugerido. **`hyphens:none` forzado en titulares Cormorant**: el motor parte
  donde le conviene a él, no donde se lee bien.

**Señales y síntomas se escriben en conducta observable, jamás en etiqueta clínica.**
Cada señal: 2ª persona, presente, ≤12 palabras, verbo de conducta que el lector puede
ver desde afuera. «Aplazaste la junta de desempeño tres veces» sí; «tienes liderazgo
tóxico» no. «Llevas tres semanas durmiendo menos de cinco horas» sí; «tienes ansiedad»
no. Sustantivos clínicos vetados en el cuerpo de las señales: **ansiedad, depresión,
TDAH, trastorno, diagnóstico**. Lo falsable da autoridad; la etiqueta es opinión, y el
formato «11 señales de X» ya está bajo crítica profesional documentada en México y
España por fomentar el autodiagnóstico.

**Slide obligatorio antes del cierre: «cuándo NO es esto».** El contra-ejemplo acota la
afirmación, es el slide que más credibilidad da, casi nadie lo pone y además baja la
exposición legal.

**En salud, el slide 2 nombra el miedo, no el tratamiento.** El bloqueo del paciente
dental no es informativo: 26.8% reporta miedo severo y el disparador principal es la
cirugía oral, 58.7% (JADA 2025). Si el slide 2 abre con «nuestro tratamiento de
implantes utiliza…», ya lo perdiste. Esqueleto de 8 slides para salud: 1) el miedo como
pregunta de ≤7 palabras («¿Va a doler?», «¿Y si me juzgan?») · 2) el miedo dicho
completo y validado, **sin solución todavía** · 3) por qué pasa · 4–6) qué hacemos
distinto · 7) prueba · 8) CTA + banda legal. **Prohibido que el slide 2 traiga el nombre
comercial del tratamiento.**

---

### 5. El CTA — tres piezas distintas, no una

La investigación traía una contradicción directa y hay que resolverla antes de escribir
nada.

> **CONTRADICE.** Las herramientas de automatización comentario→DM recomiendan
> «**comenta** DIAGNÓSTICO» y presumen conversión muy superior al «link en bio» (dato de
> proveedores, sin auditar). Eso choca de frente con dos cosas nuestras: la regla de
> marca de IVAE de **no pedir comentarios**, y la política de *engagement bait* de Meta,
> que detecta y suprime la orden de comentar. **Resolución: se conserva la palabra clave,
> se cambia el verbo.** Nunca «comenta X»; siempre «escríbeme la palabra X» (DM). El
> mecanismo que sirve —calificar al que ya se autodeclaró con ese problema y mantenerlo
> dentro de la app— sobrevive sin el verbo que quema.

**Pieza A — la pregunta (penúltimo slide).** Las publicaciones con pregunta obtienen
36.7% más comentarios (Metricool, 24M publicaciones). El beneficio se captura con una
pregunta abierta compuesta como **pieza tipográfica**, no como imperativo: Cormorant
cursiva 90–120px, mismo margen izquierdo que el resto, **sin signo de exclamación, sin
emoji, sin verbo imperativo**.

```
¿Cuánto llevas posponiendo [la cosa]?      → ¿Cuánto llevas posponiendo esa cita?   36 car
¿Qué te detuvo la última vez?                                                        29 car
¿Cuántas veces la has pospuesto?                                                     32 car
¿Cuál de las [N] te tocó?
```

**Pieza B — el cierre (último slide).** El carrusel es el rey del guardado y el envío;
pedir comentarios no aparece en ninguna señal de ranking declarada, pedir guardar/enviar
sí compra las dos métricas donde el formato ya es fuerte. Instagram, en su explicación
oficial del ranking del Feed, enfatiza cinco predicciones y **compartir está entre
ellas; guardar no** — guardar vive del lado de «tu actividad», o sea alimenta a quién se
lo enseñan después. Son **dos motores separados**:

```
Guardar (utilidad, para uno mismo):   Guárdalo para cuando lo necesites.     33 car
                                      Guárdalo antes de tu cita.
Mandar (identidad, para otra persona): Mándaselo a quien le sirva.           26 car
                                       Mándaselo a quien lleva meses diciéndolo.
```

El cierre **rima con la portada**: misma clase `.portada` con modificador `--cierre`,
misma escala de h1, sin foto, fondo de marca plano, handle grande. Quien llega al final
reconoce que terminó y no se queda esperando otro slide.

**Pieza C — la palabra por DM.** Va después de la pregunta, nunca antes, en el estilo de
la casa:

```
Y si quieres [beneficio], escríbeme la palabra [PALABRA].
→ «Y si quieres el tuyo, escríbeme la palabra ROTACION.»            52 car
```

La palabra se renderiza como píldora: `border-radius:999px; padding:22px 44px;
border:2px solid var(--acento); font:700 40px Outfit; letter-spacing:.14em;
text-transform:uppercase`. Va en el **tercio medio** del lienzo, nunca en los 160px de
abajo. Validación del campo `palabra_clave`: **una sola palabra, SIN acentos, 5–12
caracteres** (para que se escriba bien desde el celular). Defaults:

| Marca | Palabra | Marca | Palabra |
|---|---|---|---|
| SMILE NOW | SONRISA | MELISA | FACIAL |
| DENTALNOW | IMPLANTE | WASICAFE | GRANO |
| ADAGIO RH | ROTACION | PRODUCTIONS | GRABAR |
| REGENERIS | RODILLA | IVAE STUDIOS | FECHAS |

Ojo: ROTACION y no ROTACIÓN. El validador debe rechazar el acento, no corregirlo en
silencio.

**Reglas del CTA que no se negocian:**

- El CTA vive **en el slide**, no solo en el caption.
- **Ningún CTA en los últimos 160px del lienzo** (interfaz de Instagram).
- Prohibido: «comenta», «etiqueta a», «comparte con 3 amigos», «doble tap si», 🔥,
  cuotas numéricas de cualquier tipo, y «link en bio» como CTA único.

**Micro-etiqueta de gesto.** Como ya decidimos no pintar puntos de paginación, hoy nada
le habla al pulgar. Los carruseles con texto que pide deslizar rinden 2.0% de engagement
contra 1.83% de los que no, y solo 5% de los carruseles lo usan (un solo estudio
agregado — tómalo como dirección, no como ley). Contenido `DESLIZA →`, **solo en slides
1 y 2**, abajo-izquierda para no chocar con la píldora «1/10»:
`position:absolute; left:48px; bottom:196px; font:500 30px/1 Outfit;
letter-spacing:.22em; text-transform:uppercase; opacity:.72;
text-shadow:0 1px 12px rgba(0,0,0,.6)`. Contraste ≥6:1 por ser texto chico.

---

### 6. Palabras que queman

Cuatro listas con tres niveles de castigo distintos. Se validan en el mismo paso que el
precio, sobre **título, cuerpo, CTA y caption**.

#### 6.1 Bloqueo de exportación — salud (SMILE NOW, DENTALNOW, REGENERIS, MELISA)

No es advertencia: **no exporta**. En México la publicidad de servicios de salud debe ser
veraz y comprobable, y las promesas de resultado son motivo de rechazo; la política de
Meta prohíbe afirmar que se cura o elimina una enfermedad y el lenguaje sensacionalista
en contexto de salud.

> cura · curación · curar · garantizado · garantía de resultados · 100% · milagro ·
> milagroso · infalible · revolucionario · indoloro · sin dolor · permanente ·
> definitivo · el mejor · el único · resultados asegurados · elimina · erradica · para
> siempre · y cualquier comparación con otro tratamiento o clínica

Cada uno con reemplazo sugerido, que es lo que hace que la regla se use:

| Quema | Se escribe |
|---|---|
| sin dolor / indoloro | con anestesia y a tu ritmo |
| el mejor | con 12 años en Cancún |
| garantizado | con seguimiento incluido |
| permanente / para siempre | dura años con mantenimiento |
| elimina la [X] | reduce la [X] |
| cura | trata |

Adjunto obligatorio: campos de marca `cedula_profesional`, `folio_aviso`,
`folio_permiso`, `responsable_sanitario`, y banda `.legal` en el cierre — Outfit
MAYÚSCULAS 30px, `letter-spacing:.06em`, contraste ≥6:1, **por encima de los 160px de
interfaz**: «Información educativa. No sustituye una consulta.» + cédula + folio (49 car
la primera frase). *Confirmar el trámite exacto en DIGIPRiS antes de imprimir folios: la
única fuente viva de las tres originales es un despacho que vende el trámite, así que va
como dirección, no como ley citada. Quité la cifra de «70 millones en multas» que traía
el hallazgo original: no tiene respaldo verificable.*

#### 6.2 Superlativo positivo — todas las marcas

Outbrain, 65,000 titulares (en inglés, dirección no ley): los de superlativo **negativo**
rindieron 30% mejor y su CTR promedio fue 63% más alto que los de superlativo positivo;
y los titulares **sin superlativo** superaron en 29% a los de superlativo positivo. O
sea: el adjetivo entusiasta es peor que no tener adjetivo. Coincide con el estudio de
negatividad de *Nature Human Behaviour* (2023).

> **Prohibidas en portada:** mejor · increíble · asombroso · espectacular · único ·
> perfecto · mágico · soñado · exclusivo · premium · de lujo · ¡wow!
>
> **Permitidas como acento:** nunca · jamás · nadie · peor · ni un solo · lo último que

IVAE STUDIOS y MELISA son las dos marcas que se van solas al superlativo positivo: ahí
hay que vigilar. Y como las plantillas usan cursiva de acento y no negrita, el
superlativo negativo funciona muy bien puesto en Cormorant cursiva sobre la línea sans —
**una sola palabra, nunca dos**.

#### 6.3 Engagement bait — todas

> comenta · comenta 🔥 · etiqueta a · comparte con [N] · doble tap si · ¿Sabías que…? ·
> ¡Cuéntame en comentarios!

#### 6.4 Jerga por marca — la lista que de verdad se usa mañana

El problema real no es escribir «sencillo» en abstracto: es que cada marca tiene tres o
cuatro palabras técnicas que su dueño ama y su cliente no busca. Chip ámbar + sustitución
sugerida.

| Marca | Quema | Se escribe |
|---|---|---|
| REGENERIS | regeneración celular | tu propia sangre |
| | plasma rico en plaquetas | plasma de tu sangre |
| | coadyuvante | ayuda |
| | bioestimulación | estimular |
| | protocolo | plan |
| ADAGIO RH | onboarding | los primeros días |
| | engagement | que se queden |
| | gestión del talento | contratar y retener |
| | clima laboral | cómo se siente el equipo |
| | KPI | el número |
| SMILE NOW / DENTALNOW | rehabilitación oral | boca completa |
| | prótesis fija | dientes fijos |
| | periodontal | encías |
| | carga inmediata | sales con dientes |
| MELISA | protocolo facial | limpieza |
| | rejuvenecimiento | piel descansada |
| WASICAFE | perfil sensorial / notas de cata | a qué sabe |
| IVAE STUDIOS | sesión editorial | fotos |
| | dirección de arte | cómo se ve |
| | entregable | tus fotos |
| PRODUCTIONS | alcance / KPI | cuánta gente lo vio |

Encima de la tabla, verificador general: si una palabra de la portada no está entre las
~2,000 más frecuentes del español, ámbar.

---

### 7. El copy de la prueba: testimonio y cifra

La cita anónima lee como fabricada y quema autoridad en vez de construirla. Lo que
decide la credibilidad es el **detalle verificable**, no el tamaño del retrato: nombre y
apellido, rol, empresa o ciudad, y una cifra concreta.

```
«[Resultado con número, ≤4 líneas / ~120 caracteres].»
NOMBRE APELLIDO
ROL
EMPRESA O CIUDAD
```

La cita en Cormorant 96–120px; la atribución en Outfit MAYÚSCULAS 32px con
`letter-spacing:.12em` en tres renglones; foto de rostro chica, 140px de diámetro.
**Campo obligatorio «resultado con número»: si está vacío, el testimonio no se exporta.**

> **CONTRADICE lo que pensábamos.** Cuando no se puede nombrar al cliente, la salida
> **no** es «A.M., 34 años» — eso lee peor que no poner nada. Y en salud el problema no
> es solo de confidencialidad: **los testimonios de paciente caen del lado del PERMISO
> ante la autoridad, no del aviso gratuito.** O sea, la plantilla de testimonio es un
> riesgo regulatorio para SMILE NOW, DENTALNOW y REGENERIS, no un tema de estilo. Regla:
> si `folio_permiso` está vacío, el generador **bloquea la plantilla de testimonio** para
> esas marcas y ofrece en su lugar la **cifra de la práctica propia** («1,400 limpiezas
> en 2025», «12 años en Cancún»), que no requiere testimonio. Con folio, el folio se
> imprime en la banda legal.

---

### 8. El copy del dinero

El precio se escribe como **numeral pelón**: `85`, no `$85.00` ni «ochenta y cinco
pesos». Escribir la palabra no ayuda — es igual de malo que el símbolo. Estudio de campo
de Cornell (Yang, Kimes & Sessarego, 2009): ~8% más de gasto al quitar el símbolo, sin
diferencia entre símbolo y palabra escrita. *Caveat honesto: un solo restaurante, menú
impreso, n=201. Es un default barato, no una ley.*

> **Excepción que invierte la regla.** En piezas que anuncian una **promoción de
> servicio** (paquetes dentales, sesiones, consultas), la publicidad mexicana espera
> claridad sobre el monto total a pagar: ahí **sí van moneda y condiciones**. Si la pieza
> está marcada como «promoción de servicio», el validador se invierte y **exige** moneda
> y condiciones.

- **Menú / carta (WASICAFE, MELISA):** numeral pelón. Validador: si el campo trae `$`,
  `MXN`, «pesos» o `.00`, se limpia solo y avisa.
- **Paquete con oferta (SMILE NOW, DENTALNOW, REGENERIS, ADAGIO RH):** precio completo
  con condiciones.

CSS: el precio es su propio span, Outfit 34–40px, `letter-spacing:.04em`, sin puntos guía
(*leaders*), sin decimales. Nombre del producto en Cormorant 64–80px.

> **CONTRADICE el hallazgo original:** decía bajar el precio a 70% de opacidad. **No.** A
> 34–40px el piso de contraste es 4.5:1 y la opacidad lo tumba; el precio se diferencia
> por **tamaño y letter-spacing**, no por transparencia. Y para alinear cifras,
> `font-variant-numeric: tabular-nums` — pero si Outfit no trae la feature `tnum`, alinear
> por columna de grid en vez de confiar en la fuente.

---

### 9. El caption no repite lo que ya está dibujado

Nude Project (@nudeproject, 1.6M) acumula ~25,000 likes por carrusel con captions
mínimos o inexistentes: la imagen carga todo. Las tres marcas que se citan por su
estrategia de carrusel (Nude Project, Jellycat, Gentle Monster) coinciden en algo — **no
usan el carrusel para enseñar, lo usan para revelar**.

- **Regla de caption:** el caption **no puede repetir ninguna frase que ya esté dibujada
  en un slide**. Solo aporta lo que no se puede diseñar: precio, fecha, nombre del lugar,
  link, condiciones. Lint: si una frase del caption coincide ≥80% con un slide, marcarla.
- **Regla de proporción para marcas con foto** (IVAE STUDIOS, PRODUCTIONS, WASICAFE,
  MELISA): máximo **1 bloque de texto cada 3 slides**. En un carrusel de 10 → texto en 1,
  2, 5 y 10; los slides 3, 4, 6, 7, 8 y 9 sin una sola letra salvo la micro-marca.
- **Slide de identidad** (va en el 2 o 3, no al final): **una** frase que alguien podría
  mandarle a una persona concreta, ≤9 palabras, Cormorant 120–160px, centrada, márgenes
  enormes, nada más en el lienzo. Tiene que aguantar que le tomen captura sola. Guardar
  es para uno mismo (utilidad); mandar es para otra persona (identidad) — y la slide
  densa que se guarda es exactamente la que nadie manda.

**Antes de la plantilla, el generador pregunta el motor.** Se reenvía por utilidad
práctica o por asombro (Berger & Milkman, JMR 2012, ~7,000 artículos más enviados del
NYT); mezclarlos produce carruseles tibios. Motor **UTILIDAD** (DENTALNOW, SMILE NOW,
ADAGIO RH, REGENERIS, MELISA): copy de referencia, foto opcional. Motor **ASOMBRO** (IVAE
STUDIOS, PRODUCTIONS, WASICAFE): foto a sangre, texto mínimo — y aun así una slide de
referencia al final para no perder el guardado. Nunca vender una pieza de asombro con
copy de utilidad ni al revés.

**Qué se guarda, por marca** («haz contenido guardable» no es accionable; esto sí — lo
que se guarda es lo que se consulta con fecha, con precio o con un paso a paso):

| Marca | Arquetipo |
|---|---|
| DENTALNOW / SMILE NOW | qué incluye y qué **NO** incluye el precio · recuperación día por día |
| ADAGIO RH | calendario legal mexicano (aguinaldo antes del 20 de diciembre, PTU en mayo, prima vacacional) |
| WASICAFE | proporciones de receta (1:15) · método paso a paso · horarios |
| REGENERIS | cuidados posteriores y contraindicaciones |
| MELISA | cuánto dura cada tratamiento y qué no hacer las primeras 48 h |
| PRODUCTIONS / IVAE STUDIOS | timeline de boda hora por hora · lista de tomas imprescindibles |

---

### 10. Lint de copy antes de exportar (resumen accionable)

| Check | Nivel |
|---|---|
| Titular sin verbo conjugado | ámbar |
| Titular > 7 palabras | rojo |
| Titular > 3 líneas medidas en el DOM con la fuente embebida | rojo, **se recorta el copy, no la fuente** |
| Palabra > ancho útil (`measureText`) | ámbar + sinónimo |
| «¿» en portada de pieza marcada `decisión` | rojo |
| Token de la respuesta en portada y en slide interior | ámbar |
| Palabra de la lista negra de salud (marca de salud) | **rojo, no exporta** |
| Superlativo positivo en portada | ámbar |
| «comenta» / «etiqueta a» / «comparte con N» / emoji imperativo | rojo |
| CTA dentro de los últimos 160px | rojo |
| `palabra_clave` con acento, >12 o <5 caracteres | rojo |
| Testimonio sin cifra, o en marca de salud sin `folio_permiso` | rojo |
| Precio con `$`/`MXN`/`.00` en pieza de menú | auto-limpia + aviso |
| Precio **sin** moneda ni condiciones en pieza `promoción de servicio` | rojo |
| Frase del caption ≥80% igual a un slide | ámbar |
| Marca de salud sin slide «cuándo NO es esto» | ámbar |

---

## NO HACER

Ordenado por daño: primero lo que rompe la pieza sin que nadie se entere, luego lo que cuesta alcance o pauta, al final lo que delata la plantilla. Entre paréntesis, en cuántos ángulos apareció: 5 o más es ley, 1 es idea suelta.

### Nivel 1 — rompen la pieza y no se nota hasta que ya está publicada

**1. Encoger la fuente para que el texto quepa** (6 ángulos — ley)
- Se hace: `clamp()` o shrink-to-fit que baja el titular hasta que entre.
- Duele: es el único camino por el que el generador viola sus propios pisos en silencio, y el que revisa ve el preview, no el PNG.
- En su lugar: `clamp()` baja hasta el piso y ni un píxel más; si al llegar al piso `el.scrollHeight > el.clientHeight`, el generador RECHAZA el texto y pide reescribir o partir en dos slides. Nunca reduce.

**2. Medir el texto en px cuando se escribe en español** (6 — ley)
- Se hace: `max-width` en px, presupuestos contados en palabras, maquetas calibradas con copy en inglés.
- Duele: el español ocupa 20-25% más (hasta ~30% en frases cortas); el titular se va a tres líneas y empuja el cuerpo hacia la franja de interfaz de abajo.
- En su lugar: titular `max-width:16ch`, cuerpo `max-width:34ch`, y presupuesto en CARACTERES calibrado una vez con canvas (`ctx.measureText`; k≈0.42 Cormorant, k≈0.52 Outfit): hook de portada ≤42, titular interior ≤60, cuerpo ≤130.

**3. Serializar el SVG antes de que las fuentes estén cargadas y embebidas** (1, pero es mecánica de plataforma)
- Se hace: `@font-face` con URL remota y a rasterizar.
- Duele: el `Image` que carga el SVG no resuelve recursos externos, así que maqueta con la fuente de reserva; y como `ch` depende de la métrica, el layout exportado no es el que se validó. Es la causa exacta de "en el preview se veía bien y el PNG salió desbordado".
- En su lugar: fuentes en base64 dentro del `<style>` del `foreignObject`, `await document.fonts.load(...)` + `await document.fonts.ready` antes de serializar, y una guarda que mida el ancho de `'0000000000'` contra el valor esperado y aborte el export si no coincide.

**4. Juzgar el contraste por el color declarado en CSS** (4)
- Se hace: la tabla de contraste se calcula sobre los HEX del CSS.
- Duele: miente en todo lo que sea trazo fino — al reducir, la hairline se renderiza con cobertura alfa parcial y el color efectivo se aclara. Hay piso de TAMAÑO de letra pero no de GROSOR de trazo, y el trazo es lo que se rompe.
- En su lugar: medir el píxel entregado — rasterizar el slide, `drawImage(slide,0,0,390,487)`, `getImageData` de la caja de texto y comparar percentil 10 (tinta) contra percentil 90 (fondo); más un piso duro: ninguna línea, borde, conector, subrayado o glifo por debajo de 6px de lienzo (4px absoluto). Eso mata de un golpe las filas de iconos de línea fina y los `border:1px`.

**5. Calibrar el velo con el titular** (1, verificado en el código)
- Se hace: `fotometro.js:364-370` calcula `objetivoPara(pxTitular)` y le pasa ese único objetivo a toda la caja; alimentado con 152/126/104/86px, devuelve 3.0.
- Duele: bajo ese mismo velo se pintan `.support` 42px, `.pill` 39/36px y `.kicker` 36px, cuyo objetivo propio es 4.5. Síntoma reconocible: en foto clara el titular se lee y la línea de abajo se pierde.
- En su lugar: calcular `pxMin` por slide (el tamaño más chico que ESE bloque va a pintar de verdad) y usar `objetivoPara(Math.min(pxTitular, pxMin))`. Si no se quiere oscurecer más la foto, se QUITA la bajada de ese slide; no se deja ilegible.

**6. Pedirle a la tinta oscura el mismo contraste que a la clara** (1)
- Se hace: el fotómetro exige 7:1 a las dos ramas, texto claro y texto oscuro.
- Duele: WCAG sobrestima el contraste del texto oscuro sobre tonos medios. Blanco a 7:1 = Lc 89; `#18181E` a 7:1 = Lc 53, por debajo del mínimo Lc 60 de texto de contenido. Caso extremo: blanco sobre gris 118 da Lc 77 (usable) y negro sobre el MISMO gris da Lc 32.5 (inservible).
- En su lugar: umbral asimétrico en `fotometro.js` — texto claro sigue en 7:1, texto oscuro sube a 11:1 (≈Lc 75, fondo ≥ gris 205); si la foto no llega, no invertir a oscuro: banda sólida `#F7F7F5` (Lc 99.6).

**7. Escribir a ojo el texto sobre fondo plano** (1, medido en producción) — CONTRADICE lo que hoy está publicado
- Se hace: el fotómetro solo se activa cuando hay foto debajo; el pie de Papel quedó en `rgba(23,21,15,.46)` a 26px.
- Duele: sobre hueso `#F2EEE7` eso entrega 2.97:1 cuando la tabla propia pide 6.0:1, y 26px está debajo del piso de 30px. Doble incumplimiento en el elemento que lleva el nombre de la marca. La escala real sobre ese hueso: alpha .58 = 4.27:1 (reprueba), .62 = 4.82:1, .70 = 6.32:1, .78 = 8.30:1.
- En su lugar: `plantillas.js:597` → `font-size:30px; color:rgba(23,21,15,.78)`; regla dura sobre hueso: alpha ≥.62 para ≥34px y ≥.70 para <34px, ningún gris intermedio como color independiente; y extender `fotometro.js` con `(colorTexto, colorFondoPlano, px)` que reviente en consola durante el preview. Nota aparte: Papel choca con la regla de marca "siempre blanco sobre sombra" — o se le da su propia tabla o se retira.

**8. Aplicar el grade fotográfico al pintar** (1) — CONTRADICE la receta CSS que se venía proponiendo
- Se hace: pensar el tratamiento por marca como `filter` + `mix-blend-mode` sobre un `<img>`.
- Duele: la foto nunca entra al DOM (se pinta en canvas y la capa HTML va encima), y peor: el fotómetro mediría píxeles SIN gradear y decidiría el velo sobre una imagen que no existe — `brightness(1.06)` puede cruzar el umbral. Panorámica sí lo vería al re-rasterizar, así que quedarían dos verdades distintas en la misma app.
- En su lugar: gradear al importar — sobre un canvas fuera de pantalla, `ctx.filter` + `fillRect` del tinte con `globalCompositeOperation:'soft-light'` + tile de grano, luego `createImageBitmap` y guardar ESE como `s.bitmap`; guarda `if(!('filter' in ctx)) ctx.filter='none'` para que un motor sin soporte saque la foto sin gradear, nunca un slide roto.

**9. Apretar el interlineado del titular en mayúsculas** (1, medido en el woff2 real)
- Se hace: `.title{text-transform:uppercase; line-height:1.07}`.
- Duele: en inglés sobra, en español no. En Outfit la mayúscula mide 0.686 em pero la Á llega a 0.947 em y la cola de la Q baja a −0.0497 em: una Q encima de una Á deja 0.073 em de aire y se ve como choque. VALORACIÓN, DISEÑO, AÑOS y MÁS son palabras de todos los días.
- En su lugar: `line-height:1.16` en titulares en mayúsculas, o condicional (`1.16` si el texto trae `/[ÁÉÍÓÚÑÜ]/`, `1.07` si no). Aplica igual a `.title.sm` y a los titulares de Panorámica.

**10. Inclinar Outfit** (2, uno verificado de punta a punta) — CONTRADICE cómo se ejecuta hoy la cursiva de marca
- Se hace: `conCursiva()` mete `<i>` en la bajada de Nota (`plantillas.js:264`) y Ficha (`:313`), que son `font-family:Outfit`.
- Duele: Outfit se distribuye sin archivo itálico, así que el navegador sintetiza la cursiva con una cizalla; al rasterizar 2160 y remuestrear a 1080 las curvas quedan sucias y las astas de distinto grosor. Cae justo en la palabra que el redactor eligió para destacar, y nadie lo ve porque en la vista previa chica "se ve inclinado y ya".
- En su lugar: copiar el patrón que Suave ya tiene bien (`plantillas.js:345`) — `.bajada i{font-family:Cormorant,Georgia,serif;font-style:italic;font-weight:600;font-size:1.231em}` — y agregar `font-synthesis:none` al `.slide` de las 8 hojas y al `DESIGN_CSS`: así una familia sin archivo falla visible en QA en vez de colarse degradada al export. Aplica igual a Pinyon, que solo existe en peso 400.

### Nivel 2 — cuestan alcance, pauta o un problema legal

**11. Poner una cifra en el lienzo de una marca de salud** (3)
- Se hace: "$3,500", "desde $999", "MXN" sobre un slide de tratamiento dental o estético.
- Duele: Instagram restringe por edad el contenido que promueve procedimientos cosméticos con precio o incentivo de compra —recorta alcance aunque la pieza no sea anuncio— y la regulación sanitaria mexicana no permite anunciar tarifas de servicios de salud (sí hablar de "promoción" o "descuento" en general). Son dos regímenes distintos empujando en la misma dirección.
- En su lugar: validador con `/(\$\s?\d|(\d[\d,\.]{2,})\s*(mxn|pesos)|desde\s*\$?\s*\d|\bmxn\b)/i` sobre título, cuerpo, CTA y caption cuando la marca sea `sector:salud`, con sustituto editable ("valoración sin costo", "planes a meses", "pregunta por tu plan"). Aplica a SMILE NOW, DENTALNOW, MELISA y REGENERIS; WASICAFE, PRODUCTIONS e IVAE STUDIOS quedan fuera — ahí el precio sí puede ir en el lienzo.

**12. Prometer lo que no se puede comprobar** (3)
- Se hace: "cura", "garantizado", "100%", "sin dolor", "el mejor", "resultados permanentes".
- Duele: en México la publicidad de servicios de salud debe ser veraz y comprobable, y requiere aviso (persona física) o permiso (establecimiento o persona moral); además choca con las normas de salud de Meta. Es la falla más barata de prevenir de todas: es texto, y el texto lo escribimos nosotros. (Los montos de multa que circulan en blogs de agencias no son verificables: el marco legal sí, la cifra no.)
- En su lugar: lista negra que BLOQUEA el export — `/cura|curar|curaci|garantiz|100\s*%|milagro|indoloro|sin dolor|permanente|definitiv|el mejor|la mejor|el único|para siempre/i` — con sustitutos ("sin dolor" → "con anestesia y a tu ritmo"; "el mejor" → "12 años en Cancún"). Y darle la vuelta: campos nuevos por marca `cedula_profesional`, `aviso_o_permiso`, `responsable_sanitario` impresos en el slide de cierre en Outfit MAYÚSCULAS 30px, `letter-spacing:.06em`, contraste ≥6:1, por encima de la franja de interfaz. El requisito que restringe es el que da autoridad, y casi ningún competidor lo pone.

**13. Señalar al lector en la portada de salud** (4) — CONTRADICE el dogma de "háblale de tú"
- Se hace: "¿Te falta un diente?", "¿Sufres ansiedad?", "otras pacientes como tú".
- Duele: las Normas de Publicidad de Meta prohíben afirmar o insinuar que el lector tiene una condición de salud, apariencia, edad o situación financiera. El ejemplo oficial "Are you struggling with diabetes?" no pasa, y "Meet other seniors" tampoco mientras "Meet seniors" sí — el disparador es el "otros". Si la pieza se promociona, aunque sea con el botón "promocionar", es rechazo. (El porcentaje que circulaba sobre el "tú" en titulares se cayó al verificarlo; el principio se sostiene solo con la política, que además tiene consecuencia real.)
- En su lugar: portada en tercera persona o frase nominal, el "tú" a partir del slide 2 y en el cierre; bandera con `/\b(te|t[uú]|tus|sufres|padeces|tienes)\b[^.]{0,25}\b(falta|duele|chueco|manchado|ansiedad|dolor|sobrepeso|arrugas|caries|dientes?)\b/i` y `/\botr[oa]s?\s+(pacientes|mujeres|hombres|personas)\b/i`. "¿Te falta un diente?" → "El hueco cambia la mordida". Si está marcada como pauta, bloquea el export y apaga el layout de antes/después lado a lado.

**14. Alarmar** (1, con fuente que sí aguanta)
- Se hace: "⚠️ Peligro", "antes de que sea tarde", "riesgo grave".
- Duele: en 22,743 experimentos aleatorizados de titulares (Robertson et al., Nature Human Behaviour 2023, ~105,000 variantes) el miedo BAJÓ el clic y la tristeza lo SUBIÓ; la alegría también lo bajó. Honestidad sobre el alcance: son titulares de noticias en inglés y miden clic, no compartidos — por eso la regla operativa son las listas de palabras, no el porcentaje.
- En su lugar: lista roja prohibida en portada (peligro, riesgo, cuidado, alerta, urgente, grave, irreversible, "antes de que sea tarde", ⚠️) y lista verde de pérdida/costo de la que se pide al menos una (tarde, se le fue, terminó pagando, nadie le dijo, quedó, dejó de, salió más caro, esperó). "⚠️ Perder un diente daña tu mandíbula" → "Nadie le dijo que esperar sale más caro".

**15. Abrir con el close-up intraoral** (1, pero pega en 2 marcas)
- Se hace: boca abierta a pantalla completa, separador de labios, instrumental y guante dentro de la boca. Es lo que el dentista cree que es su mejor prueba.
- Duele: es lo que hace scroll —el miedo dental es mayoritario entre adultos y la cirugía oral es su peor disparador— y la política de salud de Meta prohíbe explícitamente el primer plano de una zona corporal específica y los antes/después que impliquen inferioridad de apariencia. Un primer plano de una boca "fea" es exactamente esa figura.
- En su lugar: la boca no pasa del 35% de la altura del slide (≤472px de 1350), encuadre mínimo medio rostro, el "antes" NUNCA más cerrado que el "después", y cualquier foto marcada como intraoral o quirúrgica bloqueada en portada — solo puede vivir de la slide 3 en adelante.

**16. Cerrar con el logo solo** (1) — CONTRADICE el cierre por defecto de la agencia
- Se hace: última slide con el logo centrado sobre fondo de marca.
- Duele: desperdicia la slide donde se decide el guardado, y un logo no se guarda. Peor: Instagram puede reinyectar el carrusel empezando por una slide intermedia, así que una slide de puro logo puede ser el primer y único contacto de alguien con la pieza. Nude Project cierra en su imagen más fuerte, Courier con una línea de siguiente número, Standart con el dato; ninguna con su logo.
- En su lugar: la marca sale de la última slide y se vuelve micro-marca fija en TODAS — `position:absolute;left:48px;top:48px;font:600 30px/1 Outfit;letter-spacing:.18em;text-transform:uppercase;opacity:.85;text-shadow:0 2px 20px rgba(0,0,0,.55)` — y la última queda libre para UNA sola frase de acción en Outfit ≥40px minúsculas. Bloquear la plantilla "cierre = logo" en el generador.

**17. Pedir interacción en el CTA (y ofrecer cuatro salidas)** (2)
- Se hace: "comenta la palabra GUÍA", "etiqueta a una amiga", "comparte si te sirvió"; y el cierre típico: guarda, comparte, síguenos y link en bio, todo junto.
- Duele: Meta define engagement bait como pedir explícitamente comentarios, etiquetas, compartidos, votos o reacciones, y degrada la distribución de quien lo usa. "Guardar" NO está en esa enumeración. Y cada salida extra le roba jerarquía a la que sí importa.
- En su lugar: un solo campo de CTA por carrusel, un solo verbo en imperativo, fórmula [verbo blando] + [canal] + [razón concreta] → "Si quieres el precio exacto de tu caso, escríbenos por WhatsApp y te lo mandamos hoy". Lista negra: comenta, etiqueta, menciona, comparte, dale like, vota, doble tap. Permitidas: guarda, escríbenos, agenda, pide, mándanos. Para ganar envíos por DM sin pedirlos, el penúltimo slide lleva un dato re-consultable (medida, plazo, checklist): eso es lo que la gente reenvía. Si la marca insiste en dos acciones, van en slides distintos.

### Nivel 3 — delatan la plantilla

**18. Stock en crudo** (3)
- Se hace: foto de banco con un texto encima, para las marcas sin banco propio (ADAGIO RH, WASICAFE, MELISA, parte de DENTALNOW).
- Duele: se ve genérico —probablemente idéntico al de la competencia local— y deja el contraste al azar, porque cada foto trae su propio rango de luminancia y los pisos por tamaño dejan de ser cumplibles. (El argumento de "la política de originalidad de Instagram castiga el stock" NO aplica: esa política apunta a repostear contenido ajeno, no a stock licenciado.)
- En su lugar: capa obligatoria de transformación para toda foto sin autoría IVAE — duotono (`grayscale(1) contrast(1.12) brightness(.95)` + color de marca), grano SVG `feTurbulence` como data-URI al 6-10% (nunca `url(#id)` apuntando al defs del SVG padre), `object-position` distinto de `50% 50%` con escala ≥1.15, y tipografía que INVADE al sujeto en vez de flotar en una esquina limpia. Prueba de aceptación humana: quítale el texto al slide; si se reconoce como stock, no está transformada.

**19. Armar el carrusel de menú sin una foto por ítem** (2)
- Se hace: el cliente pide "el menú completo" y se rellena con lo que haya.
- Duele: el tope real no es un número mágico —el experimento de las mermeladas que sostenía el "máximo 6" fue desmentido por su propio meta-análisis— sino cuántas fotos utilizables existen. Sin banco, el trabajo del mes es la SESIÓN, no el diseño.
- En su lugar: compuerta dura `imágenes utilizables < ítems` → la plantilla de menú no se habilita y se propone Retícula (`grid-template-columns:repeat(3,1fr);gap:16px` sobre hueso, celdas `aspect-ratio:1;object-fit:cover`) + Papel + un rostro, con el aviso "esto necesita sesión de foto, no diseño". Tres columnas máximo, dos si el detalle es fino (dental clínico, piel), nunca cuatro. Veinte platillos se parten en carruseles temáticos (fríos / calientes / panadería), no se comprimen.

**20. Panel de vidrio esmerilado** (1)
- Se hace: `backdrop-filter: blur()` + fondo pastel `rgba()` + borde claro de 1px. Es la salida por default de las marcas sin banco de fotos.
- Duele: llegó gratis a Canva y hoy lo usa todo dashboard, todo portafolio y toda plantilla social; es el efecto que más delata "lo hice con plantilla" en un feed mexicano de PyME.
- En su lugar: prohibir `backdrop-filter` y el panel `rgba()` en las 8 plantillas — el panel de texto de Ficha, Nota y Suave va opaco al 100% (hueso `#F1ECE3` o tinta `#14110E`) con grano encima; para separar texto de foto, degradado direccional de un solo tono desde el borde, no un rectángulo flotando.

**21. Usar Outfit como cara de display** (1)
- Se hace: titular en Outfit 500/600, y "condensada" fingida con `transform:scaleX()`.
- Duele: el geométrico limpio en pesos medios está catalogado como agotado ("Poppins fatigue") — un titular así se ve igual que cualquier post de cualquier PyME. Y por debajo de `scaleX(0.9)` las astas verticales adelgazan y se ve roto en el export, justo donde nadie revisa.
- En su lugar: Outfit solo en dos zonas — micro-tipografía 200-500 con tracking abierto, o display brutalista 800/900 con `letter-spacing:-0.02em`. El titular de marca lo carga Cormorant.

**22. Dejar sueltos a Cormorant y a Pinyon** (3)
- Se hace: Cormorant Regular en cifras, listas de señales, pasos numerados y etiquetas; firma en Pinyon a 54px en el `.hdr`.
- Duele: Cormorant es cara de display de contraste extremo y no trae tamaños ópticos, así que su trazo fino pierde contraste real al reducir y el lector percibe "borroso". Pinyon tiene la altura-x más chica de las tres (0.335 em, medida en el woff2), así que a 54px casi toda su tinta es borde difuminado, no trazo: lo que no se lee es la firma con el nombre de la marca. Y las scripts de boda genéricas están explícitamente en las listas de lo que decae en 2026.
- En su lugar: Cormorant peso ≥600 por debajo de 150px, ≥500 sobre foto con sombra de DOS capas (`text-shadow:0 2px 8px rgba(0,0,0,.55), 0 0 40px rgba(0,0,0,.35)` — la sombra apretada de una sola capa protege el trazo grueso y deja desnuda la hairline), prohibido en cifras, pasos, etiquetas y banda legal; nada de `-webkit-text-stroke` ni `paint-order` dentro del `foreignObject`. Pinyon: `.hdr .b` de 54px a 88px mínimo (mejor 100), máximo 3 palabras, nunca `uppercase`, nunca en dos slides seguidos ni en el mismo bloque que el titular — o cambiar la firma a Outfit 500 en versalitas con `letter-spacing:.12em`, que a 34px entrega más del doble de tinta sólida.

**23. Dejar que la firma baile de esquina** (2)
- Se hace: cada plantilla coloca la marca donde le acomoda, y los logotipos se meten al mismo slot a ancho fijo.
- Duele: un activo distintivo solo acumula reconocimiento con repetición idéntica; si la firma se mueve, cada slide arranca de cero. Y siete logos con proporciones y densidades distintas al mismo ancho se ven de tamaños distintos: uno horizontal 8:1 se ve el triple de grande que uno cuadrado. Defecto verificable: 7 de las 8 plantillas mandan el folio a la izquierda con el comentario correcto en `plantillas.js:77`, pero Editorial usa `.hdr{justify-content:space-between}` (`:104`) y empuja `c.fecha` justo a la esquina superior derecha.
- En su lugar: `justify-content:flex-start` con gap en `:104` (o mover `c.fecha` al marco de abajo) y verificar con la vista "Perfil" de 130px que ya existe; token `--firma-anclaje` con tres valores permitidos, uno por marca, inamovible entre plantillas; y cuando entren los logotipos, recortarlos al límite real de tinta —traen aire horneado— y precalcular en JS `ancho = Math.sqrt(logoRatio) * 64 * logoAjuste` en espacio 1080, con `logoAjuste` 0.85-1.15 por densidad. Nada de `pow()` dentro de `calc()`.

**24. Meter párrafos** (1)
- Se hace: slides de 60+ palabras a tamaño mínimo con los márgenes ahogados.
- Duele: el carrusel no es un blog paginado, es una secuencia de golpes; el slide se juzga antes de leerse. (Los segundos de atención que se citaban no tienen fuente que aguante; el principio sí.)
- En su lugar: presupuestos duros por slide — ≤6 palabras por línea, ≤3 líneas de titular, ≤25 palabras totales, área de cajas de contenido / área total ≤0.65, y márgenes idénticos en los cuatro lados nunca menores a 96px a 1080 (192px a 2160). Si no cabe, el generador PARTE en dos slides.

**25. Usar Panorámica para contenido que se consulta suelto** (2)
- Se hace: listas, precios, pasos o fechas repartidos en una tira continua.
- Duele: es el único formato del set cuyo significado vive en el ORDEN, y justo ese orden se rompe por diseño cuando Instagram reinyecta el carrusel empezando por un panel intermedio: se ve un pedazo de foto cortado, medio renglón de texto y ninguna marca.
- En su lugar: Panorámica reservada a reveal visual (IVAE STUDIOS, PRODUCTIONS, WASICAFE), en modo blindado — cada panel repite en la misma coordenada la marca en micro-tipografía y una línea-ancla de ≤6 palabras que se entienda sola; el pie corrido baja a decorativo y ahí no vive ningún dato (precio, fecha, nombre, teléfono); y zona muerta de ±60px a cada lado de cada costura, con aviso si el rostro o el sujeto cae dentro.

**26. Justificar, cortar con guiones y dejar viudas** (3)
- Se hace: `text-align:justify`, `hyphens:auto`, renglones que empiezan con "y" o "a", preguntas que no abren con "¿".
- Duele: en español el justificado abre ríos por palabras largas, y una viuda en un titular grande es un hueco de ~180px de alto. Además `text-wrap:balance` solo aplica hasta 6 líneas en Chromium (10 en Firefox) y pasado ese límite el navegador cae a wrapping normal SIN avisar — así que el copy largo de dental se ve peor que el corto de bodas con exactamente el mismo CSS.
- En su lugar: nunca `justify`; `lang="es"` en la raíz, `hyphens:manual`, `text-wrap:balance` solo en titulares ≤3 líneas y `pretty` en cuerpo; `texto.replace(/(^|\s)([yoaeuáéíóú])\s/gi,'$1$2 ')` para que ninguna línea empiece con una palabra de una letra; lint de apertura (si el bloque termina en ? o !, debe abrir con ¿ o ¡); y validador de rag que rechace si la última línea trae una sola palabra o mide menos del 35% del ancho de la anterior.

### Y esto ya no se cita: se cayó al verificarlo

Va con el motivo de cada uno, para que no vuelva a entrar en la próxima ronda de investigación.

- **"El 'tú' en el titular baja 36% los clics"** y **"el superlativo negativo rinde 30% más"** — los dos salen del mismo post de 2014 sobre titulares de Outbrain, en inglés, en una red de recomendación pagada, citado de tercera mano. El principio sobrevive apoyado en la política de atributos personales de Meta, que sí es verificable y sí tiene consecuencia: rechazo de la pauta.
- **"1.7 segundos de atención en el feed móvil"** — factoide de nota de prensa de 2016.
- **El experimento de las mermeladas (3% contra 30%)** — el meta-análisis de Scheibehenne, Greifeneder & Todd (2010) no encontró efecto medio de sobrecarga de opciones. Con él se cae el "máximo 6 ítems" y se cae como justificación del CTA único, que se sostiene solo por jerarquía visual.
- **"Los hashtags cuestan 31.7% de visualizaciones"** — correlacional, y la prueba A/B de 30 días que proponía no tiene poder estadístico con ~20 piezas al mes.
- **"La curva de longitud es en U: 3 u 8-10 slides, nunca 4-6"** y **"ruptura de plantilla en el slide 4"** — ambos cuelgan del mismo dataset de julio 2020, y la correlación es obvia (quien hace 10 slides invierte más en la pieza). Ninguna regla que BLOQUEE una opción del usuario puede colgar de ahí.
- **"Instagram ya permite pie de foto por slide"** — fuente única que parafrasea el anuncio sin enlace a Meta. No se le promete a nadie hasta verlo en la app de una marca real.
- **"La política de originalidad de Instagram castiga el stock"** — apunta a repostear contenido ajeno, no a stock licenciado.
- **"Nunca mezclar proporciones"** — el generador ya exporta todo a 1080x1350; no es un hallazgo, es el estado actual. Lo que sí hay que sostener es la aserción de export: si un slide difiere un solo píxel de 2160x2700, se aborta nombrando el slide.
- **"La compresión JPEG de Instagram mata los filetes"** — CONTRADICE: medido sobre filetes de 1 a 6px con grano, a q92 4:4:4, q75 4:2:0 y q60 4:2:0, el JPEG conserva 100-101% de la amplitud de luminancia y entrega 6.8-7.0:1 sobre un nominal de 7.0:1. Lo que degrada es el reescalado no entero al ancho físico del teléfono: a 0.694x (iPhone SE 3) Outfit 400 a 40px pasa de 50% a 37% de tinta sólida y Cormorant 400 a 64px de 40% a 30%. Deja de engordar trazos por miedo al JPEG y prueba SIEMPRE bajando el render a 0.694x, no a 1x — el iPhone 13 mini es el único donde el arte es pixel-perfect; el 14/15 estira a 1.083x y el 16 Pro Max a 1.222x.
- **Multas de COFEPRIS por decenas de millones de pesos y cientos de anuncios retirados** — cifras de blogs comerciales. El marco legal es real y citable; el monto no.
- **Los porcentajes de miedo dental** — sin fuente rastreable. El principio (el miedo dental es común entre adultos y la cirugía oral es su peor disparador) se sostiene sin el número, y la regla de encuadre no depende de él.
- **"Música = pestaña de Reels"** — es real, pero su única acción es un recordatorio en la lista de publicación. Ojo con la trampa asociada: el carrusel NO auto-avanza, así que nadie debe bajar la densidad de texto "porque son 2-3 segundos por slide".

**Regla general para la próxima ronda:** ningún número entra al generador como regla dura si (a) viene de un solo estudio de más de 3 años, (b) no tiene dataset público, o (c) obliga a bloquear una opción del usuario. Cada regla escrita en el código lleva comentario con fuente rastreable y fecha; las que no la tengan se marcan como heurística, avisan en ámbar y no bloquean el export. Los datos viejos sirven para elegir entre dos diseños igual de baratos, nunca para prohibir.

---

## 4 plantillas nuevas para el generador

De las 40 anatomías salen tres mecanismos que ninguna de nuestras 8 plantillas usa hoy, y que son los que hacen que una tira ajena se vea "de estudio" con material pobre:

1. **El cromo se congela al píxel y lo único que rota es el hueco de la foto** (18 de 40 carpetas). No es un layout nuevo por slide: es un layout con una variable.
2. **La foto solo existe en portada y cierre; el medio se sostiene con tipografía** (11 de 40). Resuelve literalmente el caso de las marcas de IVAE sin banco.
3. **El cierre es la portada re-titulada, y lo que dice "se acabó" es que se APAGA un elemento** (14 y 13 carpetas respectivamente). Ninguna plantilla nuestra apaga nada al final.

Las cuatro que propongo se reparten las 8 marcas sin solaparse: **Rótulo** (cero fotos), **Ventana** (pocas fotos + mucho texto), **Monotinta** (fotos que no combinan), **Cabalgada** (fotos buenas, texto mínimo).

---

### 1. RÓTULO — cero fotografías

**Para ADAGIO RH** (y sirve igual a REGENERIS THERAPY). Son las dos marcas sin banco propio: hoy dependen de stock que no pega con nada. Rótulo no usa ni una imagen en toda la tira, así que el slide se genera en milisegundos y nunca hay una foto fea que justificar. Once carpetas del corpus resuelven así (`rrhh--EAGzGNaI7Z0`, `negocio--EAFo5tgHCpY`, `rrhh--EAGidajzexI`, `spa--EAG9jevXP24`, `fotografia--EAF2cdQaw5M`, `cafe--EAHAV2rNlVw`) y ninguna se ve pobre.

**Lienzo y constantes (idénticas en los N slides)**

- Fondo `#F1EEE8`. Grano con 3 `radial-gradient(circle at 20% 30%, rgba(0,0,0,.03), transparent 45%)` superpuestos — nada de imagen de textura.
- Margen de contenido clavado en **x = 140px**, medida máxima **800px**. Todo arranca ahí, portada incluida.
- Riel superior, línea base **y = 118**: marca en Outfit 600, 26px, `letter-spacing:.22em`, versalitas, `#1A1714`, a x=140. A la derecha, terminando en x=940, la etiqueta de serie ("GUÍA", "TIPS") mismo cuerpo pero en el acento `#B4471F`.
- Riel inferior, línea base **y = 1188** (por encima de la franja de interfaz). Su contenido es lo que cambia entre los tres estados.
- Acento único `#B4471F`, en dosis mínimas: la cursiva del titular, la viñeta y la píldora. **Nunca hay fondo de color.**
- Tinta de cuerpo `#2C2722` sobre `#F1EEE8` = 12.8:1.

**CONTRADICE** nuestra regla de marca "texto siempre blanco sobre sombra negra, nada de letra negra". La regla nació para texto sobre foto; aquí no hay foto que velar, y el papel da más contraste que cualquier sombra. Propongo acotar la regla a "cuando haya imagen debajo".

**Qué cambia entre portada, interiores y cierre**

| | Portada | Interiores | Cierre |
|---|---|---|---|
| Numeral fantasma | no existe | **aparece** | **se apaga** |
| Voces del titular | dos (cursiva naranja + romana negra) | una (romana negra) | dos, como la portada |
| Cuerpo | no hay | 2–5 renglones | no hay |
| Riel inferior | píldora "DESLIZA →" | contador + filete | avatar + "COMPARTE ESTO" |
| Etiqueta arriba-derecha | fecha/edición | nombre de serie | @handle |

- **Portada.** Titular a dos voces: Cormorant 500 *italic* 112px `#B4471F` para el arranque + Cormorant 600 romana 112px `#1A1714` para el resto, 3 renglones, interlínea 105px, bloque de **y=392 a y=707** (23% del alto). Bajada en Outfit 500, 30px, `letter-spacing:.16em`, versalitas, `#6A625A`, 2 renglones, y=790–866. Después, **300px de vacío a propósito**. Riel inferior: píldora de contorno 2px `#B4471F`, radio 999px, alto 76px, padding 0 36px, texto "DESLIZA →" Outfit 600 28px `#B4471F`, anclada a x=140.
- **Interiores.** Entra el numeral fantasma: Cormorant 600 **420px** en `#E4DFD6` sobre `#F1EEE8` (contraste 1.1:1 — deliberadamente casi invisible, es textura no información), caja alta a y=250, alineado ópticamente a x=132, y el titular lo **pisa** por encima. El titular baja a una sola voz: Cormorant 600 romana 88px (79% del de portada), máximo 2 renglones, y=286–470. Cuerpo Outfit 400 40px / interlínea 57px, medida 760px, desde y=540. Si el copy es lista, no párrafo: se mantiene el margen y entra viñeta de cuadrito 18×18 con contorno 2px `#B4471F`. **Regla dura:** lo que sobra de y=880 hacia abajo se queda vacío; el bloque nunca se estira para llenar. Riel inferior: contador "03 / 07" Outfit 600 28px `#6A625A` a x=140, y filete sólido 2px `#C9C1B6` de x=280 a x=940.
- **Cierre.** Desaparece el numeral (señal #1) y desaparece la píldora (señal #2). Vuelve el titular a dos voces, ahora **96px y centrado** en vez de a bandera izquierda, bloque y=380–620. Riel inferior: avatar circular de 84px a x=140 + "COMPARTE ESTO / CON QUIEN LO NECESITA" en Outfit 600 30px versalitas `#1A1714` a x=248, sin filete ni contador.

**Inspirada en:** `rrhh--EAGzGNaI7Z0` (rejilla de margen único + acento naranja en dosis mínimas + la ranura inferior que cambia de carga), `negocio--EAFUu4HPal4` (numeral fantasma + contador N/N), `negocio--EAFo5tgHCpY` (la cursiva como bookend solo en los extremos y el bloque colgado del tercio superior), `rrhh--EAGidajzexI` (párrafo → centrado / lista → izquierda; el elemento que hace de CTA y de folio), `spa--EAG9jevXP24` (cifra sombra a 1.13:1 y la píldora que se apaga sin sustituto), `fotografia--EAF2cdQaw5M` (rieles que nunca se cortan).

---

### 2. VENTANA — cromo congelado, hueco de foto que rota

**Para DENTALNOW y SMILE NOW.** Son las que publican contenido educativo: 40–55 palabras por slide y 2 o 3 fotos de clínica de calidad desigual. Ventana es el único de los cuatro sistemas que aguanta ese volumen de texto sin verse un muro, porque lo que cambia de slide en slide no es el texto: es dónde está el hueco. Es el mecanismo más repetido del corpus (18 carpetas) y el más barato de programar: **un cromo + seis presets de rectángulo**.

Se distingue de nuestra *Ficha* (foto arriba, panel abajo, siempre igual) en exactamente eso: Ficha es un preset, Ventana son seis que rotan y nunca se repiten dos seguidos.

**Cromo congelado, idéntico al píxel en los N slides**

- Fondo `#FAF7F2`. Marco de contenido de 108px por lado.
- Barra superior a **y=104**: píldora sólida `#0E4F4A`, radio 999px, **384×72px** a x=108, con el nombre de marca en Outfit 600 30px `#FFFFFF`. A la derecha, terminando en x=972, la etiqueta "TIPS 2026" en Outfit 500 28px `letter-spacing:.18em` `#0E4F4A`.
- Pie, línea base **y=1206**: @handle Outfit 500 30px `#6B7A78` a x=108; flecha "→" de 44px `#0E4F4A` terminando en x=972.
- Toda ventana lleva `border-radius:28px` y `box-shadow: inset 0 0 0 2px rgba(14,79,74,.35)`. Nunca sombra difusa: al 36% desaparece y solo ensucia el borde.

**Los seis presets de ventana** (el texto ocupa siempre el complemento exacto)

| | Caja sobre 1080×1350 |
|---|---|
| **A** portada/cierre | a sangre 0,0 → 1080,1350 + velo `linear-gradient(180deg, rgba(6,32,30,.15) 0%, rgba(6,32,30,.72) 62%)` |
| **B** banda alta | x 108→972, y 196→640 |
| **C** columna derecha | x 596→1080 (sangra), y 196→1148 |
| **D** banda baja | x 108→1080 (sangra abajo y derecha), y 832→1350 |
| **E** columna izquierda | x 0→484 (sangra), y 196→1148 |
| **F** par | x 108→528 y x 552→972, ambas y 196→560 |

Ninguna ventana invade y<196, y por eso el cromo superior nunca queda encima de una foto — el error que se ve en `rrhh--EAGh5Vb8kIM`, donde el kicker fijo cae sobre la imagen en dos slides y se pierde.

**Tipografía**

- Titular interior: Outfit 700 76px, interlínea 0.98, máx. 3 renglones, `#10201F`.
- Cuerpo: Outfit 400 38px, interlínea 1.45. Medida **520px** cuando la ventana es lateral (C/E) y **760px** cuando es banda (B/D/F). **A bandera izquierda siempre, nunca justificado:** con 520px y 38px caben ~5.5 palabras por renglón, y a esa medida el justificado abre ríos (medido en `restaurante--EAHDplOjeTo`, 398px y 4.2 palabras por renglón).
- Tope duro de 55 palabras por slide; a la 56 el generador parte el slide en dos.

**Qué cambia entre portada, interiores y cierre**

- **Portada.** Ventana A. La píldora de marca y la etiqueta pasan a `#FFFFFF` sobre la foto (mismo tamaño, mismas coordenadas). Filete sólido **200×5px** `#FFFFFF` a x=118, y=572, como arranque del titular. Titular Outfit 800 **132px**, interlínea 0.86, versalitas, blanco, 2 renglones a bandera izquierda desde x=112, bloque y=602→832. Bajada Outfit 400 40px `rgba(255,255,255,.92)`, 2 renglones, y=900–1000. **Sin insignia numerada y sin cuerpo.**
- **Interiores.** Entran tres cosas y sale una: entra la **insignia numerada** (círculo sólido 112px `#0E4F4A` con "01." en Outfit 600 42px `#FAF7F2`, anclada a y=196 y siempre en la esquina horizontal **opuesta** a la ventana, huyendo de ella), entra el cuerpo, y el titular cae a 76px (58% del de portada). Sale el velo. La ventana rota B → C → D → E → F. El cromo no se mueve ni un píxel: es lo único que dice "misma serie". La insignia a y=196 (14.5% del alto) queda por debajo de la píldora "1/5" de Instagram, así que numeramos sin chocar.
- **Cierre.** Vuelve la ventana A y el titular vuelve a 132px: el cierre es la portada re-titulada. **Se apaga la insignia numerada y se apaga la flecha del pie.** La etiqueta de arriba-derecha cambia de "TIPS 2026" a la llamada ("AGENDA HOY") — único cambio del riel en toda la tira. En el hueco que dejó la flecha entran tres glifos de contorno 2px de Instagram (guardar, enviar, corazón) de 46px, separados 32px, terminando en x=972.

**Inspirada en:** `negocio--EAG--FMuqlo` (la rotación de la foto en sentido horario y la insignia que siempre huye de ella), `dental--EAG8Mj_z6iM` (marco de 109px, riel invariable, dos tamaños de titular, y el cierre que cambia una sola etiqueta), `skincare--EAGcus8sMPM` (la pila de texto que nunca se mueve y solo rota la zona de foto), `rrhh--EAGh5Vb8kIM` (ocho repartos distintos con la misma paleta — y su error del kicker tapado), `negocio--EAGtI4kIcrk` (el texto se acomoda alrededor del hueco que deja la foto), `restaurante--EAHOcgjKJJQ` (el panel que migra y el riel de pie fijo al píxel).

---

### 3. MONOTINTA — cinco fotos que no combinan se leen como una sola serie

**Para WASICAFE y PRODUCTIONS.** Es el problema real que ninguna plantilla nuestra resuelve: el material llega de tres orígenes (stock, celular del cliente, sesión vieja) con temperaturas y saturaciones distintas, y la tira se ve como un collage de tres marcas. Monotinta no le pide calidad a la foto: le pide **forma**. Todo lo demás lo iguala el tratamiento.

**El motor (esto es la plantilla; lo demás es acomodo)**

Toda foto, sin excepción, pasa por la misma pila:

```css
.foto        { filter: grayscale(1) contrast(1.08) brightness(.94); }
.foto::after { background:#6B4A2F; mix-blend-mode:multiply; opacity:.82; }
.foto::before{ background:#F0E3CE; mix-blend-mode:screen;  opacity:.18; }
```

Duotono real de dos extremos: sombras a la tinta de marca, luces al papel. WASICAFE tinta `#6B4A2F` / luz `#F0E3CE`. PRODUCTIONS tinta `#17222B` / luz `#D9E2E6`. **Todo el texto va en un solo color: el papel al 100%.** Ni blanco puro, ni un segundo acento, ni filetes, ni número, ni cabecera.

**CONTRADICE a medias** la regla "blanco sobre sombra negra": aquí el texto es color papel (`#F0E3CE`) y la sombra no es local sino toda la imagen velada al 82%. El contraste papel-sobre-duotono es ≥7:1 en cualquier punto del encuadre, o sea cumple el motivo de la regla mejor que un `text-shadow` — que además al 36% se convierte en una mancha sucia.

**Dos anclas y nada más**

- **La banda de texto: y=520 → y=900.** Todo el texto de todos los slides vive dentro de esa franja de 380px, centrado, medida 820px (x=130→950). Nunca hay texto arriba ni abajo de ahí.
- La flecha "→" en Outfit 400 52px, color papel, con su caja terminando en x=938, y=1216.

Cuerpo en **Cormorant 500, 54px, interlínea 1.32**. Un solo tamaño en toda la tira: la jerarquía no la lleva la letra, la lleva la foto. 20 a 28 palabras por slide.

**Qué cambia entre portada, interiores y cierre**

- **Portada.** Único slide con **dos** estilos tipográficos: antetítulo Cormorant 500 *italic* 46px en y=520 ("Serie: cosecha 2026") y debajo el título en Cormorant 600 romana 78px, 2 renglones, y=596→790. La foto de portada la elige el generador por criterio medible: la de **menor varianza local dentro de la banda 520–900** (o sea, la que tiene cielo, pared o plano vacío justo donde va el texto).
- **Interiores.** Cero antetítulo, cero título, cero cursiva. Solo 3 a 5 renglones de Cormorant 500 54px centrados, **centrados verticalmente dentro de la banda**: con 3 renglones ocupan 520–735, con 5 llegan a 900, nunca se salen. La flecha sigue idéntica. La única variación entre interiores es la foto — y por eso hay que ordenarlas por encuadre (abierto → medio → detalle), no por tema.
- **Cierre.** **Se cae la foto.** Fondo plano del color medio al que tendían todas las fotos veladas: `#6E6A62` para WASICAFE, `#2B3740` para PRODUCTIONS, con el mismo grano de tres `radial-gradient` al 3%. Y se rompe el ancla: el texto abandona la banda única y se parte en **dos bloques con aire entre ellos** — pregunta abierta en Cormorant 500 62px, 3 renglones, y=430→670; hueco de 160px; y "síguenos / @wasicafe" en Cormorant 500 40px, 2 renglones, y=830–925. **Desaparece la flecha.** Ese es todo el aviso de final y basta: el lector siente el cambio de geometría antes de leer.

**Inspirada en:** `cafe--EAG2ZIT-zkQ` (el velo único + un solo serif a un solo tamaño en la misma banda, y el cierre en el color plano al que tendían las fotos), `inmueble--EAGdxPpE9s4` (monotinta: una sola tinta para texto, rayas e iconos, con las fotos desaturadas para que no peleen), `restaurante--EAHHHRzs8v8` (duotono sepia sobre toda foto), `dental--EAG8Mj_z6iM` (el velo en `multiply` sobre la foto a sangre), `fotografia--EAGsM3CmCEU` (blanco y negro sobre carbón como igualador), `lujo--EAGo8WrWAJs` (una sola tinta para absolutamente todo el texto de 6 slides).

---

### 4. CABALGADA — la palabra montada sobre el borde de la foto

**Para IVAE STUDIOS** (y para MELISA cuando hay sesión reciente). Las dos marcas donde la foto es el producto: taparla con un panel es tirar el trabajo. Cabalgada no pone el texto **sobre** la imagen ni **junto** a ella: pone una sola palabra grande **a caballo del borde**, mitad sobre papel y mitad sobre la foto. Es el gesto más caro del corpus y el más barato de escribir en CSS (`position:absolute` + `transform: rotate(-90deg)`).

**Constantes**

- Papel de yeso `#EDE9E2` a sangre + grano.
- Una sola caja de foto por slide, distinta cada vez, con **≥90px de papel visible** por el lado donde monta la palabra.
- **La palabra:** Cormorant 600, versalitas, `letter-spacing:.06em`, altura de mayúscula **118px** (`font-size` ≈168px), `#1E1B18`. Su línea base —o su eje, si va rotada— se clava **exactamente** en el borde de la foto.
- **Prefijo:** Outfit 600 30px, `letter-spacing:.2em`, versalitas, `#6A6259`. **Siempre sobre papel, jamás sobre foto**, pegado a la palabra por su lado exterior con 24px de aire.
- **Script:** Pinyon Script 62px `#1E1B18`, una línea, `rotate(-3deg)`. Solo en portada y cierre.
- **@handle:** Outfit 500 30px `#6A6259`. No tiene casa fija: se muda al margen de papel que quedó más ancho. Nunca dentro de la foto, nunca por debajo de y=1200.

**Guardia de legibilidad (la parte que hay que programar bien).** La palabra solo puede montar un borde cuyo 20% interior de imagen tenga **luminancia media ≥68%** (cielo, vestido, pared, mantel, mantelería). El generador mide ese recorte antes de colocar. Si no pasa: invierte el color de la palabra a `#EDE9E2` y la manda al borde opuesto. Sin esta medición la plantilla falla en una de cada tres fotos.

**Qué cambia entre portada, interiores y cierre — aquí el sistema ES la secuencia de bordes**

- **Portada.** Foto horizontal x=108→972, y=336→986 (80% de ancho, 48% de alto, centrada). **Dos** palabras cabalgando y las dos horizontales: una montada en el borde superior (y=336) y otra en el inferior (y=986). Prefijo a la izquierda de la de arriba, sobre papel. Script abajo-derecha. 10–14 palabras.
- **Interior 1.** La foto crece a vertical x=112→974, y=104→1252: el papel se reduce a un passe-partout de ~100px. **La palabra rota −90° y monta el borde IZQUIERDO** (x=112), leyéndose de abajo hacia arriba. Copy: 3 renglones Cormorant 500 44px versalitas espaciadas, color papel, a bandera derecha, colocados sobre la zona clara arriba-derecha de la foto. El @handle se muda al margen derecho, rotado 90°.
- **Interior 2.** Espejo exacto: la foto baja a la mitad inferior (y=558→1252), el copy sube al papel (4 renglones, tinta oscura, x=130, y=190→430) y **la palabra rota −90° montando el borde DERECHO** (x=974). @handle vuelve arriba-izquierda, horizontal.
- **Interior 3 — el respiro** (opcional, para tiras de 6). Dos fotos verticales apiladas y centradas de 412px de ancho, gap 26px, con 165px de papel a cada lado. **Cero palabra grande, cero copy, solo el @handle.** Cinco carpetas del corpus meten un interior de cero texto y en todas funciona: da aire y hace que la palabra del siguiente slide pegue más fuerte.
- **Cierre.** Reimpresión literal de la portada: misma caja de foto en la misma y, dos palabras montadas arriba y abajo, script abajo-derecha, @handle arriba-izquierda. Solo cambian la foto, el verbo —que pasa a imperativo: "AGENDA / TU FECHA"— y el script ("Nos encantaría contarla"). 6–10 palabras.

En una línea: **portada y cierre = palabra horizontal arriba y abajo; interiores = palabra rotada −90° alternando izquierda y derecha.** La tira gira y vuelve a su sitio. Nadie lo nombra, pero se siente.

**Inspirada en:** `lujo--EAGtgmsFFUI` (la palabra montada, la secuencia de bordes superior→izquierdo→derecho→superior, el @handle sin casa fija y el cierre re-impreso en imperativo), `fotografia--EAGs5xT4zIY` (la palabra rotada −90° a caballo del borde, 28px de letra sobre papel y el resto sobre la imagen), `restaurante--EAGc_WzoPRQ` (el titular que rompe el marco de la foto por los dos lados y pisa el papel), `lujo--EAGo8WrWAJs` (los interiores de cero texto y la secuencia de márgenes 31%→5%→0%→25%), `skincare--EAGcus8sMPM` (el titular que cruza la costura y cuyas últimas letras caen sobre la foto), `spa--EAGo8azJCtM` (foto en los extremos, papel en el medio).

---

### Tres reglas de cierre que valen para las cuatro

Salieron del corpus con demasiada evidencia como para dejarlas a criterio del que arma el slide:

1. **La señal de deslizar se APAGA en el último slide** — 13 carpetas. Puede desaparecer sin sustituto (`spa--EAG9jevXP24`, `negocio--EAFo5tgHCpY`), cambiar de texto en el mismo píxel (`cafe--EAHAV2rNlVw` "Swipe"→"Save", `inmueble--EAFtvraJE50`) o cambiar de función en el mismo rincón (`inmueble--EAGdxPpE9s4` botón→fila de contacto). Lo que no puede es seguir igual.
2. **El cierre repite la composición de la portada** — 14 carpetas. No "parecida": la misma caja, la misma altura, la misma receta tipográfica, con el titular en imperativo. Es gratis de implementar (el mismo componente con otro string) y es lo que hace que la tira se sienta encuadernada.
3. **Si hay numeral, insignia o contador, se apaga en el cierre** — 9 carpetas. Es la señal más barata de todas.

El contraejemplo lo da `spa--EAGuoLz8oPQ`: cuatro slides bien resueltos que no hacen absolutamente nada distinto al final, y la serie no se siente terminada, se siente cortada. Y el antipatrón a no copiar es el de `fotografia--EAGsM3CmCEU` y `skincare--EAG3Y7wVvYA`: ambas pintan su propia paginación arriba a la derecha, justo donde Instagram pone la suya. Nuestra insignia de Ventana va a y=196 (14.5%) precisamente para no chocar.
