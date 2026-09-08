# Veo 3.1 desde IVAE Marketing: contrato real, precios y la trampa del crédito

Investigado y verificado el 7 de septiembre de 2026 contra la documentación oficial
de Google. Este documento es la fuente de verdad para
`functions/api/marketing/_video-ia.js`. Si algo aquí choca con lo que recuerdes,
gana este documento.

---

## 1. La trampa que decide todo

Hay DOS puertas al mismo modelo Veo 3.1, con el MISMO precio, pero **no las paga
el mismo bolsillo**:

| Puerta | Host | Autenticación | ¿Lo paga el crédito de 300 USD? |
|---|---|---|---|
| **Vertex AI** | `us-central1-aiplatform.googleapis.com` | OAuth (token Bearer) | **SÍ** |
| **API de Gemini** | `generativelanguage.googleapis.com` | `x-goog-api-key` | **NO** |

Google lo dice textual en la página del nivel gratuito:

> "The $300 credit can't pay for Gemini API in AI Studio costs."

Fuente: <https://docs.cloud.google.com/free/docs/free-cloud-features>

O sea: la puerta fácil (API key en un encabezado) le cobra a la tarjeta. La puerta
que gasta los 300 dólares exige OAuth, y OAuth exige una cuenta de servicio.

**Consecuencia práctica:** el código soporta las dos y prefiere Vertex cuando
existe. La variable de entorno manda:

- `GOOGLE_SA_JSON` presente y bien formado → Vertex → paga el crédito.
- Si no, `GEMINI_API_KEY` → API de Gemini → paga la tarjeta.
- La pantalla se lo dice a la dueña con todas sus letras (aviso verde o ámbar).

---

## 2. El bloqueo de la llave JSON (y cómo se quita)

La cuenta de Google Cloud de IVAE se dio de alta el 7 de septiembre de 2026. Google
crea hoy una **organización propia** para cada cliente nuevo de prueba, y toda
organización nueva nace con la línea base de seguridad, que incluye la restricción
`iam.disableServiceAccountKeyCreation` (más su gemela administrada
`iam.managed.disableServiceAccountKeyCreation`).

Verificado en vivo: al pedir la llave JSON, la consola contesta

> "La creación de claves de la cuenta de servicio está inhabilitada."

Para levantarlo (lo tiene que hacer la dueña de la organización, no el asistente,
porque es una configuración de seguridad):

1. IAM y administración → **Políticas de la organización**.
2. En el selector de proyecto, elegir **la organización** (no el proyecto) y darse
   a sí misma el rol **Administrador de políticas de la organización**
   (`roles/orgpolicy.policyAdmin`). El dueño de una organización nueva trae
   Organization Administrator, que solo LEE políticas, así que este paso es
   obligatorio.
3. Filtrar por `disableServiceAccountKeyCreation`. **Aparecen dos entradas** (la
   antigua y la administrada) y hay que apagar **las dos**.
4. En cada una: **Administrar política** → **Anular la política del elemento
   superior** → Aplicación: **desactivada** → **Establecer política**.
   Conviene hacerlo a nivel de PROYECTO, no de organización, para que el permiso
   quede acotado a `project-079a5d99-32ca-410d-964`.
5. Tarda hasta 15 minutos en propagarse.

Después: cuenta de servicio → pestaña **Claves** → Agregar clave → Crear clave
nueva → JSON. Ese archivo se pega íntegro como secreto `GOOGLE_SA_JSON` en
Cloudflare Pages (proyecto `ivaestudios-website`, entorno Production).

**Alternativa sin tocar la seguridad:** montar una función de Cloud Run en el mismo
proyecto de Google, que corre con credenciales nativas (sin llaves), y que el
Worker de Cloudflare la llame con un secreto compartido. Es más limpio pero es
infraestructura extra que caduca junto con la prueba (7 de diciembre de 2026).

---

## 3. Estado actual de la cuenta de Google (7-sep-2026)

- Proyecto: `project-079a5d99-32ca-410d-964` ("My First Project").
- Crédito: 5,089.20 MXN, vence el 7 de diciembre de 2026.
- API `aiplatform.googleapis.com` (Agent Platform / Vertex AI): **habilitada**.
- API `generativelanguage.googleapis.com` (Gemini API): **habilitada**.
- Cuenta de servicio: `ivae-video-ia@project-079a5d99-32ca-410d-964.iam.gserviceaccount.com`
  con el rol **Usuario de Agent Platform** (`roles/aiplatform.user`, antes
  "Vertex AI User").
- Llave de API **"IVAE Video IA (Veo)"** creada y vinculada a esa cuenta de
  servicio, restringida a la Gemini API. Su valor se ve en
  APIs y servicios → Credenciales → la llave → Mostrar clave.
- Llave JSON de la cuenta de servicio: **bloqueada** (ver punto 2).

Ojo con el nombre: Google renombró Vertex AI a **Agent Platform** en la consola.
Es el mismo producto y el mismo `roles/aiplatform.user`.

---

## 4. Contrato REST

### 4.1 Vertex AI

Arranque:

```
POST https://us-central1-aiplatform.googleapis.com/v1/projects/PROJECT_ID/locations/us-central1/publishers/google/models/MODEL_ID:predictLongRunning
Authorization: Bearer <access token>
Content-Type: application/json
```

Sondeo:

```
POST https://us-central1-aiplatform.googleapis.com/v1/projects/PROJECT_ID/locations/us-central1/publishers/google/models/MODEL_ID:fetchPredictOperation
{"operationName": "projects/.../operations/OPERATION_ID"}
```

Respuesta cuando termina:

```json
{ "name": "...", "done": true,
  "response": { "raiMediaFilteredCount": 0,
    "@type": "type.googleapis.com/cloud.ai.large_models.vision.GenerateVideoResponse",
    "videos": [ { "gcsUri": "gs://...", "mimeType": "video/mp4" } ] } }
```

Si NO se manda `storageUri`, el video vuelve en línea en base64. El código no pide
bucket, así que espera base64 y lo copia a R2.

### 4.2 API de Gemini

```
POST https://generativelanguage.googleapis.com/v1beta/models/MODEL_ID:predictLongRunning
x-goog-api-key: <clave>
```

Sondeo: `GET https://generativelanguage.googleapis.com/v1beta/{operation_name}` con
el mismo encabezado. El video llega como una URI que solo abre con esa llave.

### 4.3 Cuerpo (igual en las dos, salvo lo anotado)

```json
{ "instances": [ { "prompt": "TEXTO EN INGLÉS" } ],
  "parameters": { "aspectRatio": "9:16", "resolution": "720p",
                  "durationSeconds": 8, "sampleCount": 1,
                  "generateAudio": true, "personGeneration": "allow_adult" } }
```

- `aspectRatio`: `16:9` (predeterminado) o `9:16`. No hay 1:1.
- `durationSeconds`: 4, 6 u 8 en Veo 3. Predeterminado 8.
- `resolution`: `720p`, `1080p`, `4k` (4k solo en los modelos Preview de Veo 3.1).
- `sampleCount`: 1 a 4.
- `personGeneration`: la página del esquema dice `dont_allow` / `allow_adult` /
  `allowAll`; las guías dicen `allow_adult` / `disallow`. Se usa `allow_adult`.
- `sampleCount` y `personGeneration` **no** se mandan por la puerta de Gemini
  (no están documentados ahí y arriesgan un 400).

### 4.4 Identificadores de modelo

| Nivel en la app | Vertex | API de Gemini |
|---|---|---|
| Económico | `veo-3.1-lite-generate-001` | `veo-3.1-lite-generate-preview` |
| Bueno | `veo-3.1-fast-generate-001` | `veo-3.1-fast-generate-preview` |
| El mejor | `veo-3.1-generate-001` | `veo-3.1-generate-preview` |

Región: los tres modelos existen **solo en `us-central1`**. No hay endpoint global
ni multirregión, aunque algunos ejemplos del SDK digan `global`.

---

## 5. Precios (verificados en las dos páginas, 7-sep-2026)

Cobro **por segundo de video generado**, audio incluido. Vertex y Gemini cobran lo
mismo.

| Modelo | 720p | 1080p | 4k |
|---|---|---|---|
| Veo 3.1 | $0.40 | $0.40 | $0.60 |
| Veo 3.1 Fast | $0.10 | $0.12 | $0.30 |
| Veo 3.1 Lite | $0.05 | $0.08 | no hay |

Traducido a clips de 8 segundos (a 20 pesos por dólar):

| Nivel | Costo | En pesos | Clips con los 300 USD |
|---|---|---|---|
| Económico (Lite 720p) | $0.40 | ~8 | ~750 |
| Bueno (Fast 720p) | $0.80 | ~16 | ~375 |
| El mejor (Veo 3.1 1080p) | $3.20 | ~64 | ~93 |

No hay nivel gratuito para Veo en ninguna de las dos puertas. Google solo cobra si
el video se generó: *"You will only be charged if your video is successfully
generated."*

Cuota publicada por modelo: 50 peticiones por minuto por región. Irrelevante para
el uso de IVAE.

---

## 6. Autenticación OAuth desde un Worker (sin librerías)

Implementado en `tokenGoogle()` dentro de `_video-ia.js`:

1. JWT con encabezado `{"alg":"RS256","typ":"JWT"}`.
2. Reclamaciones: `iss` (correo de la cuenta de servicio), `scope`
   `https://www.googleapis.com/auth/cloud-platform`, `aud`
   `https://oauth2.googleapis.com/token`, `iat`, `exp` (máximo una hora).
3. Firma `RSASSA-PKCS1-v1_5` con SHA-256. La `private_key` del JSON es un PEM
   `PRIVATE KEY`; se importa con `importKey("pkcs8", ...)` sobre los bytes DER.
   Cloudflare Workers trae WebCrypto completo, así que no hace falta Node.
4. Canje: `POST https://oauth2.googleapis.com/token`,
   `application/x-www-form-urlencoded`, con
   `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer` y `assertion=<jwt>`.
5. El token dura 3600 s y se guarda en memoria del isolate.

---

## 7. Trampas documentadas que ya nos costaron tiempo

- Las URLs `cloud.google.com/vertex-ai/generative-ai/docs/...` redirigen a
  `docs.cloud.google.com` y la referencia vieja de Veo hoy muestra una página
  genérica sin campos. El contrato real vive repartido entre las guías.
- La página de esquema `VideoGenerationModelResult` documenta solo
  `{"gcsUris": [...]}`, que **no coincide** con lo que devuelven las guías
  (`response.videos[].gcsUri`). Por eso el código busca el video recorriendo el
  árbol en vez de confiar en una ruta fija.
- El identificador Lite aparece como `-preview` en una nota de versión y como
  `-001` en la página del modelo. En Vertex manda `-001`; en la API de Gemini,
  `-preview`.
- La lista de restricciones de API al crear una llave vinculada a cuenta de
  servicio **solo ofrece la Gemini API**. Vertex no acepta llaves de API: es la
  prueba dura de que el crédito de 300 USD exige OAuth.

---

## 8. Pendientes

- [ ] Decidir Vertex (quitar el candado de llaves) o quedarse en Gemini (tarjeta).
- [ ] Guardar el secreto en Cloudflare Pages y generar el primer clip de prueba.
- [ ] Comparar ese clip contra el anuncio de Regeneris que trajo la dueña.
- [ ] Anotar en la memoria el resultado real de costo por reel completo.
