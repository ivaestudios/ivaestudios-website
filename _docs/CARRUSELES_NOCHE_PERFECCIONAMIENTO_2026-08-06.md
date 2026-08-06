# La noche de perfeccionamiento del generador de carruseles
**2026-08-06, 02:38–07:00 · 10 ciclos mejorar→jueces→arreglar · todo EN VIVO**

Pedido de Vianey: "usa Fable 5, mejora y retroalimenta, luego vuelve a revisar
y retroalimentar, hasta las 7 de la mañana sin parar, libertad total".

## El hallazgo de la noche (causa raíz histórica)

**La detección de rostros NUNCA funcionó en producción.** El loader de
MediaPipe evalúa un string al inicializar y el CSP de `/marketing/*` solo
tenía `'wasm-unsafe-eval'` — le faltaba `'unsafe-eval'`. `initialize()`
lanzaba, `detectarCaras()` devolvía `[]` en silencio, y todos los "vetos de
rostro" funcionaban de suerte por la heurística de luminancia/piel. Era el
hallazgo #1 de TODAS las rondas de jueces ("el veto no operó").

Doble arreglo:
1. `_headers`: `'unsafe-eval'` añadido al CSP de `/marketing/*`.
2. `caras.js`: la detección ahora corre sobre el **recorte cover-fit
   1080×1350** (lo que de verdad se ve en el slide), no sobre la foto
   completa — en apaisadas de 2000px el downscale a 640 dejaba caras de
   ~30px invisibles. Verificado con probe: 4/5 fotos del lote con rostro
   detectado y coordenadas correctas.

## Los 10 ciclos (todos desplegados y verificados E2E en prod)

| # | Qué | Origen |
|---|---|---|
| 1 | Ningún slide sin texto (parte el cuerpo más largo por oración, mayúscula al abrir, coma como frontera de respaldo); textos sobrantes se anexan CON aviso (antes se perdían en silencio) | Feedback directo de Vianey |
| 2 | `sinFoto` real en Rótulo; recorte con cara en Papel/Ficha (cara al 40% del alto — el crop ciego decapitaba); pisos por plantilla (pano 250/310, cierre 250); el guardarraíl respeta el techo sin-rostro | Tiras de plantillas |
| 3 | Oficio tipográfico: acento serif de la casa (Cormorant cursiva), conectores con espacio duro (ningún renglón termina en "y/de/pero/…"), sin viudas, teléfonos "+52 998 203 9659", sin emojis en el arte, titulares sin punto final, cierre con firma (chevron fuera) | Jueces R1 (P4-P7) |
| 4 | Margen ANATÓMICO del veto (35% abajo/22% arriba/14% lados — MediaPipe corta en la barbilla); ancla alta con aire (top=25%, ≥180px bajo el masthead); velo reforzado en zonas ocupadas (camisa de cuadros); aviso de cara bajo masthead; 3 chequeos de coherencia en la IA (casting/titular↔bajada/gramática) | Jueces R1 (P1/P2/P8/P9/P10) |
| 5 | La sombra respira: manta completa SOLO para texto en medio; en bordes la difuminada llega con fuerza al texto y la otra mitad de la foto vive; tubería de cédula profesional (legal salud MX) en CONFIG_MARCA→firma | Jueces R2 |
| 6 | **CSP + detección sobre recorte** (la causa raíz) | Probe propio |
| 7 | **La ley #1 le gana al balde**: si el balde pedido (IA/botón) tiene todas las alturas vetadas por rostro, el bloque va a la mejor altura sin rostro de cualquier balde | Tira C6 |
| 8 | Marco adaptativo (scrims de masthead/pie con el velo medido POR FRANJA); el teléfono del CTA como dato-rótulo (47px, SMILE 700) | Jueces R3 |
| 9 | **La IA dirige el acento**: campo `acento` (una palabra copiada del titular), validada en sanear, pintada por las 9 plantillas (editorial directo; las demás vía `**`/conCursiva) | Jueces R3 |
| 10 | Piso de contraste del masthead en fotos high-key (refuerzo → velo ≥.4); criterio EMOCIONAL del acento (cómodos/valoración, jamás ortodoncia/implantes) | Jueces R4 |

**Bug extra cazado por lint**: TDZ real (`bandaCubreHdr` leía `topAjustado`
antes de declararse) — el primer slide en modo banda habría tronado el render.

**Bug extra cazado por probe**: en modo dirigir el filtro de reconciliación
mataba el 100% de los avisos del director (toda foto sigue en el orden por
contrato). Ahora los avisos de casting/coherencia SÍ llegan a la dueña —
verificado: "Foto 3: CASTING: niño con sandía para anunciar All-on-4…".

## Trayectoria de jueces (6 agentes × 3 lentes por ronda + síntesis)

| Ronda | ninos (comp/tipo/serie) | serv (comp/tipo/serie) |
|---|---|---|
| R1 | 4 / 7 / 6 | 5 / 6 / 5 |
| R2 | 6 / 7.5 / 6.5 | 4 / 6.5 / 5 |
| R3 | 5.5 / 8.4 / 7 | 6.5 / 7 / 6 |
| R4 | 6 / 8 / 7 | 6.5 / 7 / 7.5 |
| R5 | (ver informe del task wu0niykcd) | |

Dos rondas seguidas subiendo; desde R4 ningún juez volvió a ver "banda
flotante" ni sombra intermedia — la ley de la sombra quedó dominada. Lo que
frena las notas de composición es el CASTING de las fotos stock de prueba
(niños para All-on-4, adulta cerrando serie infantil) — exactamente lo que
los avisos del director ya señalan y que desaparece con fotos reales.

## Pendientes (próxima sesión)

1. **Cédula profesional**: números reales por marca (Vianey) — bloqueo LEGAL
   para publicar salud en MX; la tubería ya existe.
2. **Canvas de meses pasados** de ADAGIO/REGENERIS/MELISA/WASICAFE/
   PRODUCTIONS para sus cerebros de marca (como SMILE).
3. Remontaje fantasma del router que borra `textosPieza` (chip creado).
4. Assert post-layout en el E2E (bbox del bloque real ∩ caras = 0).
5. Tokens con guion (ALL-ON-4) irrompibles + al chequeo de palabrón.
