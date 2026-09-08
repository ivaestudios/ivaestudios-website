# Videos con tu propio rostro: por qué ningún generador sirve y cuál sí

Investigado el 8 de septiembre de 2026. El objetivo de Vianey no era abaratar
Seedance: era **hacer videos con su propia cara**. Eso cambia la herramienta por
completo.

---

## Los tres generadores BLOQUEAN subir caras reales

Ninguno de los que conectamos o evaluamos sirve para clonarse:

| Modelo | Qué dice |
|---|---|
| **Sora 2** | *"Character uploads that depict human likeness are blocked by default."* Y desde **febrero de 2026** no acepta subir imágenes de rostro como referencia, ni de personas reales ni de humanos digitales. |
| **Seedance 2.5** | Corre visión por computadora sobre cada imagen de referencia y **rechaza fotos con rostros fotorrealistas**. Es una defensa anti deepfake, no de contenido. |
| **Veo 3.1** | Google también restringe el parecido de personas reales. |

La función **Cameo** de Sora sí permite tu cara, pero exige verificación en vivo
(girar la cabeza, parpadear, decir números) y **vive en la app de consumo, no en
la API**. No se puede automatizar desde nuestra app.

**Conclusión: el camino de Seedance directo era irrelevante para este objetivo.**
Aunque México sí aparece en la lista de países de BytePlus, el modelo no habría
hecho lo que ella quiere.

---

## Lo que sí hace esto: un gemelo digital

La categoría correcta se llama **avatar** o **gemelo digital**. Grabas tu cara y
tu voz UNA vez, y después escribes texto y sale un video tuyo diciéndolo.

**HeyGen** es el líder y ya venía elegido en el `INFORME-VIDEO-IA-Y-META.md` de
agosto, solo que con un precio estimado peor del real.

### Cómo se crea el gemelo

- **Mínimo:** un clip de **15 segundos** hablando.
- **Recomendado:** **2 minutos** continuos, sin cortes, en 1080p y con buena luz.
  Con 2 a 5 minutos el sincronizado de labios y los gestos salen mejor.
- Se hace **una sola vez** desde su web, con un plan normal. La creación por API
  está reservada a cuentas enterprise, pero no hace falta: se crea a mano y luego
  se usa por API.

### Lo que cuesta usarlo

| Concepto | Precio |
|---|---|
| Avatar III Gemelo Digital | **$0.0167 por segundo** |
| Un video de 30 segundos | $0.50, unos **10 pesos** |
| Un video de 1 minuto | $1.00, unos **20 pesos** |
| Entrada a la API | prepago desde **$5**, sin mensualidad |
| Plan web para crear el gemelo | desde **$29 al mes** |

**Sale más barato que Veo**, y es su cara y su voz diciendo exactamente el guion
que se escriba.

⚠️ Desde febrero de 2026 HeyGen **ya no regala créditos de API**.

---

## Lo que esto cambia

El gemelo digital no compite con Veo, Sora ni Seedance: **se complementa**.

- **Vianez a cuadro hablando** (consejos, avisos, presentar el mes) → gemelo.
- **Escenas que ella no puede grabar** (un señor de 60 en una cena, una clínica
  en Cancún) → Veo o Sora.

Y encaja con lo que ya estaba anotado como apuesta de negocio en
[[project-sistema-ia-membresia]]: contenido con IA más captura de rostro y voz
como membresía mensual.

## Pendiente de decisión

- [ ] Abrir cuenta de HeyGen y grabar los 2 minutos de referencia.
- [ ] Probar el gemelo antes de ofrecérselo a un cliente.
- [ ] Si convence, agregarlo como quinto proveedor de la sección Video IA.
