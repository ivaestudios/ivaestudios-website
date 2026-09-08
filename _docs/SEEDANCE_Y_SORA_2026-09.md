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
