# El súper prompt de Video IA

Todo lo que aprendimos la noche del 7 al 8 de septiembre de 2026 haciendo dos
anuncios completos con Veo 3.1. Cada regla de aquí abajo nació de un defecto real
que salió en pantalla, no de teoría.

---

## Las seis piezas, siempre en este orden

Un prompt que funciona tiene seis bloques. Si falta uno, el defecto aparece.

```
[1 PERSONA]  [2 ESCENA]  [3 CÁMARA Y ACCIÓN]  [4 LA FRASE]  [5 REGLAS]  [6 ACABADO]
```

---

### 1 · La persona (lo que hace que sea LA MISMA en todas las tomas)

Este bloque se copia **palabra por palabra e idéntico** en cada clip del anuncio.
Es lo único que logra que se vea el mismo ser humano en cuatro tomas distintas.
Si lo cambias aunque sea un poco, cambia la cara.

Necesita seis cosas: edad, complexión, pelo, vello facial, piel y mirada.

> The exact same woman in every shot: a warm, elegant Latina woman in her
> mid-fifties, shoulder-length dark brown hair with soft grey at the temples worn
> loose, small gold hoop earrings, light natural makeup, kind brown eyes, gentle
> smile lines, olive skin.

### 2 · La escena (una por locación, también idéntica)

Si el anuncio pasa en dos lugares, escribes dos bloques de escena y reutilizas
cada uno tal cual. Necesita: lugar, hora del día, luz, dos o tres objetos
concretos y la ropa.

> A warm family dinner at home in the evening. Long wooden table, roast dish and
> glasses of wine, two adult relatives softly out of focus beside her, amber
> lamplight and candles. She wears a deep burgundy blouse.

### 3 · Cámara y acción

Tamaño de plano, movimiento, y **qué hace con el cuerpo** antes de hablar. Ese
gesto es lo que separa un video de una foto que se mueve.

> Medium shot across the table. She shifts uncomfortably, presses a hand to her
> knee under the table, then looks to camera and speaks with tired honesty in
> American-accented English:

### 4 · La frase, entre comillas y MEDIDA

**Una sola frase.** Y del largo correcto, que es la regla que más cuesta:

| Clip | Palabras habladas |
|---|---|
| 4 segundos | 8 a 10 |
| 6 segundos | 12 a 15 |
| 8 segundos | 16 a 20 |

Corta para el clip → Veo estira y **repite palabras**
(nos salió *"our physicians in Cancun, in Cancun, review your case"*).
Larga → **corta a media palabra**.

La app ya calcula sola los segundos a partir de la frase. Si escribes a mano,
usa la tabla.

### 5 · Las reglas (esto va SIEMPRE, es el candado)

Estas tres frases matan los tres defectos que ya nos salieron:

> She says that line ONCE, at a natural conversational pace, without repeating
> any word. After the line she stops talking completely and holds the expression
> until the shot ends; she says nothing else. She starts speaking within the
> first half second and the line runs almost to the end of the shot.

Sin la segunda, Veo agrega parloteo de relleno (nos metió un *"That's"* suelto).
Sin la tercera, deja segundos muertos.

### 6 · El acabado

> Photorealistic, cinematic, shallow depth of field, natural skin texture.
> The image fills the entire vertical 9:16 frame edge to edge, with no
> subtitles, no caption bar, no lower third and no black bars anywhere.

La última parte no es capricho: una toma nos salió con **una barra negra abajo y
un subtítulo inventado** que decía "Exnephow, Mutaress.".

---

## Reglas de la casa

- **En inglés.** Veo entiende mejor el inglés y la dicción sale limpia. El
  español lo entiende, pero tropieza más.
- **Cero silencios.** Aunque el prompt esté perfecto, Veo deja aire. Se quita
  con `python3 scripts/pegar-clips.py salida.mp4 toma1.mp4 toma2.mp4 ...`.
  En el anuncio de la mujer quitó 9.71 s de 28.
- **Escuchar antes de entregar.** No basta con ver que hay audio: hay que
  transcribirlo. Dos de ocho tomas traían defectos que solo se oyen.
- **Un plano continuo largo** se hace con el botón "Alargar 7 s", no pegando
  clips. Llega hasta 29 segundos sin corte.

## El molde completo, para copiar y rellenar

```
[PERSONA idéntica en todas las tomas]
[ESCENA de esta locación]
[Tamaño de plano]. [Movimiento de cámara]. [Gesto del cuerpo], then looks to
camera and speaks in American-accented English: "[LA FRASE, medida]"
She says that line ONCE, at a natural conversational pace, without repeating any
word. After the line she stops talking completely and holds the expression until
the shot ends; she says nothing else. She starts speaking within the first half
second and the line runs almost to the end of the shot.
Photorealistic, cinematic, shallow depth of field, natural skin texture. The
image fills the entire vertical 9:16 frame edge to edge, with no subtitles, no
caption bar, no lower third and no black bars anywhere.
```

## Estructura de anuncio que ya funcionó

Cuatro tomas, alternando dos locaciones. Es la del anuncio que trajo Vianey y la
que copiamos:

1. **Problema**, en la vida cotidiana. Ocho segundos.
2. **El giro**, misma locación. Seis segundos.
3. **La razón**, ya en la clínica. Ocho segundos.
4. **El cierre**, con la pregunta al que mira. Seis segundos.
