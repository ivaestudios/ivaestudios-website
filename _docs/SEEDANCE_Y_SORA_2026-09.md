# Seedance 2.5 y Sora 2: lo que hay, verificado

Investigado el 8 de septiembre de 2026 contra las fuentes de cada proveedor.
Corrige de paso un dato viejo del `INFORME-VIDEO-IA-Y-META.md`.

---

## Los tres, de un vistazo

| | **Veo 3.1** (el que usamos) | **Sora 2** (recién puesto) | **Seedance 2.5** |
|---|---|---|---|
| De un tirón | 4, 6 u **8 s** | 4, 8, 12, 16 o **20 s** | **4 a 30 s** |
| Encadena hasta | ~29 s | **120 s** (6 extensiones de 20) | tiene modo `video-extend` |
| Audio nativo | sí | sí | sí, sincronizado |
| Vertical 9:16 | sí | sí (720x1280) | sí |
| Resolución | 720p / 1080p | 720x1280 / 1024x1792 (Pro) | 480p / 720p / 1080p |
| Precio por segundo | $0.05 Lite · $0.10 Fast · $0.40 | $0.10 · $0.50 el Pro | $0.20 a $0.47 según proveedor |
| **8 s en vertical** | **8 pesos** (Lite) | 16 pesos | ~46 pesos |
| **20 s** | 20 pesos encadenando | **40 pesos de un tirón** | ~118 pesos |
| **30 s** | no llega (tope 29) | 60 pesos encadenando | ~139 pesos de un tirón |
| **120 s** | no llega | **240 pesos** | no llega |

Precios a 20 pesos por dólar.

---

## Seedance 2.5

**Qué es.** El modelo de video de ByteDance, los de TikTok. Es el único que hace
**30 segundos de una sola generación**, con audio sincronizado.

**Ficha técnica** (fuente: EvoLink y CellCog, 22-ago-2026):
- Duración **4 a 30 s**, o "auto". 24 fps.
- Resoluciones nativas **480p y 720p**; el 1080p que anuncian algunos
  proveedores es reescalado suyo, no salida nativa del modelo.
- Proporciones: adaptativa, 16:9, **9:16**, 1:1, 4:3, 3:4 y 21:9.
- Rutas: `text-to-video`, `image-to-video`, `reference-to-video`, `video-edit`
  y `video-extend`. Acepta hasta 30 imágenes de referencia.
- **Audio sincronizado nativo**, sin cargo aparte.

**Precio por segundo en 720p**, verificado el 22-ago-2026:

| Proveedor | $/s |
|---|---|
| WaveSpeed Turbo | 0.20 |
| Replicate | 0.2312 |
| Atlas Cloud | 0.30 |
| fal.ai | 0.473 |

Un clip de 5 s en 720p va de **$1.16** (Replicate) a **$2.37** (fal). Uno de
30 s, de **$6.94** a **$14.19**. El 480p cuesta poco menos de la mitad.

**LA CORRECCIÓN IMPORTANTE.** El informe de agosto decía que Seedance tenía
"rostros reales restringidos en API directa" y hablaba de un contrato de empresa
de ~$14 mil al año. Eso está **mal planteado**: el filtro es para **subir fotos
reales como referencia**, y existe para evitar deepfakes. Generar personas de
cero desde texto, que es exactamente lo que hacemos nosotros, **funciona sin
restricción**. Lo que se bloquea es (a) subir la foto de alguien real y (b)
pedir personajes reconocibles por su nombre.

**El estorbo real es otro:** la ruta oficial de ByteDance (BytePlus ModelArk)
**no se vende en Estados Unidos, Canadá, Reino Unido, Australia ni Nueva
Zelanda**. Habría que entrar por Replicate o WaveSpeed, que sí dan acceso
global, y eso cambia el precio.

---

## Sora 2 (ya implementado)

**Contrato REST**, verificado en la documentación de OpenAI:

```
POST https://api.openai.com/v1/videos      {model, prompt, seconds, size}
GET  https://api.openai.com/v1/videos/:id            -> status
GET  https://api.openai.com/v1/videos/:id/content    -> el MP4 en binario
```

- Modelos: `sora-2` y `sora-2-pro`.
- `seconds` va como **TEXTO**: `"4"`, `"8"`, `"12"`, `"16"` o `"20"`.
  ⚠️ **La página de referencia de la API está VENCIDA**: lista solo 4, 8 y 12.
  La guía dice textual *"Both sora-2 and sora-2-pro support 16- and 20-second
  generations"*. Gana la guía; me comí ese error una vez.
- `size`: `720x1280`, `1280x720`, `1024x1792`, `1792x1024`. Predeterminado
  `720x1280`, que es justo el vertical que queremos.
- Estados: `queued`, `in_progress`, `completed`, `failed`.
- ⚠️ **El enlace de descarga caduca a la hora.** Por eso el Worker copia el MP4
  a R2 en cuanto llega.
- Precio: **$0.10/s** en 720x1280 y **$0.50/s** en 1024x1792.
- **Extensión**: `POST /v1/videos/extensions` con
  `{video:{id}, prompt, seconds}`. Hasta **seis** extensiones de 20 s cada una,
  o sea **120 segundos** de total. Se continúa **por id**, sin reenviar bytes,
  al revés que Veo.

**Falta:** el secreto `OPENAI_API_KEY` en Cloudflare Pages.

---

## Qué conviene

- **Para un anuncio hablado normal**: sigue ganando **Veo Lite a 8 pesos**. Es
  cinco veces más barato que Seedance y la mitad que Sora.
- **Cuando la persona tiene que hablar más de 8 segundos seguidos**: **Sora 2**,
  porque llega a 20 de una pieza y encadena hasta 120. Con Veo, el encadenado
  obliga a que calle después del octavo segundo.
- **Solo si algún día hace falta un plano de 30 segundos de un golpe**:
  Seedance, sabiendo que cuesta unos 139 pesos y que hay que entrar por
  Replicate.

---

## ¿De quién son estos precios? (importa)

| Modelo | Quién cobra | ¿Es tarifa del fabricante? |
|---|---|---|
| **Veo 3.1** | Google, por Vertex AI | **Sí, directo.** Hoy lo paga el crédito de $300 |
| **Sora 2** | OpenAI | **Sí, directo.** Pago por uso, sin membresía |
| **Seedance 2.5** | Replicate, fal.ai, WaveSpeed | **NO.** Son revendedores |

ByteDance directo (BytePlus ModelArk) cobra **$0.09 a $0.21 por segundo**, o sea
casi la mitad que los revendedores que cité. Y **México SÍ aparece** en su lista
de países disponibles, al contrario de lo que dicen varios blogs: la exclusión de
Estados Unidos, Canadá, Reino Unido, Australia y Nueva Zelanda que circula por
ahí aplica a los "Restricted Models", y no está confirmado que Seedance 2.5 sea
uno de ellos para México.

**Qué significa:** los números de Veo y Sora son firmes, se le pagan al que
fabrica el modelo. Los de Seedance traen intermediario y podrían bajar bastante
yendo directo, con el trabajo extra de dar de alta una cuenta de BytePlus.

---

## Seedance: Replicate (intermediario) contra BytePlus (directo)

| | **Replicate** (implementado) | **BytePlus ModelArk** (directo) |
|---|---|---|
| Precio 720p | $0.2312/s | **$0.09 a $0.21/s** |
| 30 s cuestan | ~139 pesos | ~70 a 126 pesos |
| Darse de alta | entrar con GitHub + tarjeta, 5 min | verificación de identidad real |
| Regalo de bienvenida | ninguno | **2 millones de tokens gratis** |
| ¿México? | sí | sí, está en su lista de países |
| Riesgo | ninguno | *"some regions or individual users may not be eligible for self-service verification"* |

**Por qué se implementó Replicate primero:** el objetivo era **probar** Seedance,
no casarse con él. Pagar el doble por dos o tres clips de prueba cuesta unos 100
pesos de más y se resuelve hoy mismo; el trámite de BytePlus es de duración
desconocida y puede atorarse en la verificación.

**Cuándo hacer el cambio:** si Seedance gusta y se vuelve rutina. Añadir BytePlus
como segunda ruta al mismo nivel es un `else if` más en `_video-ia.js`; no hay
que rehacer nada.

---

## CORRECCIÓN: ir directo con BytePlus NO conviene (8-sep-2026)

Yo dije que ByteDance directo costaba "la mitad". **Es falso**, y por poco mando
a Vianey a un trámite inútil. Lo que dice su propia documentación:

**1. Al 720p cuesta lo MISMO que Replicate.** BytePlus publica un ejemplo de
5 segundos en 720p a **$1.156**, que son **$0.2312 por segundo**. Replicate cobra
**$0.2312 por segundo**. Idéntico: Replicate está pasando el precio a costo, sin
margen. La franja "$0.09 a $0.21" que circula es el **480p**, que no sirve para
Instagram.

**2. Pide 30 dólares de entrada.** Textual de la ficha de Seedance 2.5:
> *"Before enabling Dreamina Seedance 2.5, make sure you meet one of the
> following conditions: BytePlus account balance > USD 30 … purchase a dedicated
> AI Savings Plan at the USD 30 tier or above … or a resource pack."*

**3. Los 2 millones de tokens de bienvenida NO aplican** a Seedance 2.5, que está
detrás de ese muro de 30 dólares.

**4. Encima pide verificación de identidad**, y su doc avisa que algunas regiones
y usuarios individuales no pueden verificarse solos.

| | Replicate | BytePlus directo |
|---|---|---|
| 720p por segundo | $0.2312 | $0.2312, **igual** |
| Mínimo para empezar | ninguno | **30 USD** |
| Alta | GitHub + tarjeta, 5 min | verificación de identidad |

**Conclusión: Replicate.** Mismo precio, sin mínimo y sin trámite. Ir directo
solo tendría sentido bajando a 480p, que para redes no da la talla.

**El contrato de BytePlus, por si algún día cambia el panorama:**
```
POST https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks
     {model:"dreamina-seedance-2-5-260628", content:[{type:"text",text:"…"}],
      generate_audio:true, ratio:"adaptive"}
  -> {id:"cgt-…"}
GET  .../tasks/{id}  -> status queued|running|succeeded, content.video_url
```
Cobra por TOKENS, no por segundo: un clip de 5 s en 1080p gastó 246,840 tokens.

---

## LA INVESTIGACIÓN SERIA DE PRECIOS (8-sep-2026, cifras oficiales)

Cambié de opinión dos veces citando blogs. Esto sale de **las páginas de precios
de cada proveedor**, y se comprobó con su propia fórmula.

### La fórmula de BytePlus, textual de su tarifario

```
tokens        = (duración del video de entrada + duración de salida)
                × ancho × alto × cuadros por segundo / 1024
costo         = precio por millón de tokens × tokens
```

Aplicada a 720p vertical (720 × 1280 a 24 fps) da **21,600 tokens por segundo**
de video. Multiplicando por su tarifa de $10.70 por millón, sale
**$0.2311 por segundo**. Comprobé la fórmula contra sus tres cifras publicadas
y coincide en las tres:

| Lo que ellos publican | Lo que da la fórmula |
|---|---|
| 1080p 2.5 con descuento "approximately USD 0.41 per second" | **$0.41** |
| 2.0 fast 720p "approximately USD 0.09 per second" | **$0.091** |
| 2.0 mini 720p "approximately USD 0.03 per second" | **$0.030** |

### El veredicto: para Seedance 2.5, Replicate cuesta EXACTAMENTE lo mismo

| Seedance 2.5, sin video de entrada | BytePlus (fórmula) | Replicate (su tarifario) |
|---|---|---|
| 480p vertical | $0.1028/s | **$0.1028/s** |
| 720p vertical | $0.2311/s | **$0.2312/s** |

Coincide al cuarto decimal. **Replicate no le pone margen a Seedance 2.5.**
Mi frase de que el directo costaba "la mitad" era falsa: esa franja de
$0.09 a $0.21 mezclaba resoluciones distintas y modelos distintos.

Y encima BytePlus pide, textual de la ficha de Seedance 2.5:
> *"make sure you meet one of the following conditions: BytePlus account
> balance > USD 30 …"*

Más verificación de identidad. **Conclusión: Replicate, sin discusión.**

### Donde Replicate SÍ cobra de más (por si algún día importa)

| Modelo, 720p sin video | BytePlus | Replicate |
|---|---|---|
| Seedance 2.0 fast | $0.121 lista / $0.091 con descuento | $0.15 |
| Seedance 2.0 mini | $0.076 lista / $0.030 con descuento | $0.09 |

En la familia 2.0 sí hay margen, de un 24% sobre lista. Pero son modelos de
menor calidad y los descuentos de BytePlus **vencen el 7 de octubre de 2026**.

### La familia barata, por si el presupuesto aprieta

Un clip de **30 segundos en 720p** cuesta, en Replicate:

| Modelo | 30 s | En pesos |
|---|---|---|
| Seedance 2.5 | $6.94 | 139 |
| Seedance 2.0 fast | $4.50 | 90 |
| **Seedance 2.0 mini** | **$2.70** | **54** |

El mini es la mitad de precio que el fast y una quinta parte del 2.5, con la
calidad que corresponde a un modelo "mini".

---

## LOS PAQUETES DE TOKENS: EL HUECO QUE FALTABA (8-sep-2026)

Faltaba revisar los **resource packs** de BytePlus, por si ahí estaba el
descuento del directo. **No lo hay.** Los paquetes están calculados con una
"deduction ratio" que deja el precio final idéntico al de lista.

Ejemplo con Seedance 2.5: el paquete de 5 millones de tokens cuesta $32, o sea
$6.40 por millón. Pero sin video de entrada **se descuentan 1.671875 tokens del
paquete por cada token consumido**. Resultado: $6.40 × 1.671875 = $10.70 por
millón, que es exactamente la tarifa de lista.

Y su propia documentación avisa:
> *"Resource packs are prepaid products and are **not eligible** for the
> pay-as-you-go limited-time discount promotion."*

### Tabla final, 720p vertical, USD por segundo

| Modelo | Paquete | Lista | Con promoción | Replicate |
|---|---|---|---|---|
| **Seedance 2.5** | 0.2311 | 0.2311 | 0.2311 | **0.2312** |
| Seedance 2.0 | 0.1512 | 0.1512 | 0.1512 | no está |
| Seedance 2.0 fast | 0.1210 | 0.1210 | **0.0907** | 0.1500 |
| Seedance 2.0 mini | 0.0756 | 0.0756 | **0.0302** | 0.0900 |

### Conclusión definitiva

- **Para Seedance 2.5, ir directo no ahorra NADA.** Ni por pago por uso, ni por
  paquete. Los tres caminos dan el mismo número.
- El directo **solo** gana en la familia 2.0, y **solo por la promoción
  vigente**, que vence el **7 de octubre de 2026**. Después de esa fecha el
  ahorro contra Replicate baja a un 17%.
- Un clip de 30 s en 720p, en pesos: 2.5 cuesta **139** por cualquier vía;
  2.0 mini cuesta **18 directo con promoción** contra **54 en Replicate**.

**Sigue ganando Replicate**, salvo que se quiera explotar la promoción del mini
antes del 7 de octubre, y para eso hay que pasar por los 30 USD y la
verificación de identidad.
