# Wikidata: borrador del ítem de IVAE Estudios

**Para:** Israel y Vianey
**Estado:** BORRADOR. No publicar todavía. Falta conseguir 1-2 referencias externas (ver sección 4).
**Fecha:** 2026-08-07

---

## 1. Por qué importa Wikidata

La investigación GEO 2026 concluyó que las menciones de terceros son el factor número 1 para que las IAs (ChatGPT, Perplexity, Claude, Gemini) recomienden un negocio: correlación 0.664 en el estudio de Ahrefs sobre 75,000 marcas. Wikidata es la base de datos abierta que alimenta el Knowledge Graph de Google y que las IAs usan como fuente de hechos "duros" sobre entidades: quién fundó qué, dónde está, desde cuándo existe. Un ítem de Wikidata bien referenciado le da a las máquinas un registro limpio y verificable de que IVAE Estudios existe como entidad real.

IVAE ya tiene un ID en el Knowledge Graph de Google (`/g/11wwttqfb6`). El ítem de Wikidata cierra el círculo: conecta ese ID con el sitio, el Instagram y las referencias externas.

---

## 2. AVISO IMPORTANTE: el QID falso Q139689577

Una sesión anterior puso el QID `Q139689577` en el schema JSON-LD del sitio como si el ítem de Wikidata ya existiera. **Ese ítem NO existe** (da 404 en wikidata.org, verificado desde 2026-07-01). Hoy 2026-08-07 ya fue retirado del código: el arreglo `sameAs` del nodo `#organization` en `index.html` solo contiene Instagram y Google Maps, que es lo correcto.

Puntos que no se pueden olvidar:

- **No reutilizar jamás** `Q139689577` ni `Q139689736` (el supuesto ítem de Vianey Díaz). Ambos aparecen todavía en `seo/AGENTS.md` como si fueran reales. No confiar en ese archivo para nada de Wikidata.
- Cuando el ítem real se cree, Wikidata asignará un QID **nuevo y distinto**. Ese QID nuevo es el que hay que añadir al `sameAs` del JSON-LD (ver sección 6).
- Antes de escribir cualquier QID en código, abrirlo en el navegador (`https://www.wikidata.org/wiki/QXXXX`) y confirmar que carga y que describe a IVAE.

---

## 3. Notabilidad: por qué publicarlo HOY sería candidato a borrado

Wikidata acepta un ítem si cumple al menos uno de sus tres criterios de notabilidad:

1. **Tiene enlace a un proyecto Wikimedia** (un artículo de Wikipedia, Wikivoyage, etc.). IVAE no lo tiene.
2. **Se refiere a una entidad claramente identificable que puede describirse con referencias serias y públicamente disponibles, independientes del propio sujeto.** Este es el camino realista para un negocio pequeño.
3. **Cumple una necesidad estructural** (otro ítem lo necesita para tener sentido). No aplica.

Hoy, la única fuente disponible es el propio sitio ivaestudios.com y el propio Instagram. Eso **no cuenta** como referencia independiente. Los ítems de negocios cuya única fuente es su propio sitio se marcan de forma rutinaria para borrado (y los patrulleros de Wikidata revisan con lupa los ítems nuevos de empresas, porque abundan los de autopromoción). Publicar hoy quemaría el intento: un ítem borrado deja historial y el segundo intento se mira con más desconfianza.

**Regla práctica:** crear el ítem solo cuando existan al menos 1-2 referencias externas serias, y citarlas dentro del ítem desde el primer día. Descripciones siempre neutras, jamás promocionales: nada de "luxury", "best", "top" ni eslóganes.

---

## 4. Referencias que conseguir primero (en este orden)

### 4.1 Alta en el DENUE del INEGI (la referencia más fuerte)

El DENUE (Directorio Estadístico Nacional de Unidades Económicas) es el registro público de negocios del INEGI. Es una fuente gubernamental, seria y verificable: exactamente lo que Wikidata quiere ver. Paso a paso:

1. Abrir `https://www.inegi.org.mx/app/mapa/denue/`.
2. Buscar "IVAE" y también "fotografía" filtrando por Cancún, Quintana Roo, para confirmar que el estudio no aparece ya registrado.
3. Localizar la opción para registrar o actualizar una unidad económica (el nombre exacto del enlace cambia entre versiones del sitio; buscar algo como "registra tu negocio", "alta" o "actualiza los datos de tu unidad económica"). Si no aparece la opción en el mapa, usar la sección de Contacto de inegi.org.mx y solicitar el alta.
4. Tener listos estos datos antes de llenar el formulario:
   - Nombre comercial: IVAE Estudios
   - Actividad: servicios de fotografía y videograbación (verificar el nombre exacto en el buscador de actividades del propio formulario)
   - Domicilio del estudio en Cancún, Quintana Roo
   - Teléfono: +52 228 857 0584 (el número de llamadas y listados; NO usar el de WhatsApp)
   - Correo: info@ivaestudios.com
   - Sitio web: https://ivaestudios.com
   - Inicio de operaciones: 2023
5. El INEGI valida y publica en actualizaciones periódicas del directorio; puede tardar semanas o meses. Revisar una vez al mes.
6. Cuando la ficha aparezca, copiar la URL exacta de la ficha DENUE y guardarla. Esa URL es la referencia principal para Wikidata.

### 4.2 Un directorio o mención editorial (la segunda referencia)

De más fuerte a más débil:

1. **Mención editorial escrita por un tercero**: aparecer en un listicle como los de shanphotography.com o thepartystudioandco.com (los pitches ya están redactados en `seo/geo/PITCHES_OUTREACH.md`). Es la referencia ideal porque IVAE no controla el texto.
2. **Perfil en directorio con revisión editorial**: Zankyou México o Wezoree. Cuenta, aunque pesa menos que una mención editorial.
3. Un perfil creado por el propio negocio sin revisión editorial es la opción más débil; usarla solo como complemento, nunca como única segunda fuente.

Con la ficha DENUE + una de estas, el ítem ya tiene sustento razonable.

---

## 5. El borrador del ítem, listo para copiar y pegar

Crear el ítem desde una cuenta registrada de Wikidata (que la cree Israel o Vianey con su propio usuario; las ediciones anónimas sobre negocios se borran más rápido). En wikidata.org: menú lateral, "Create a new Item".

### 5.1 Etiquetas, descripciones y alias

| Campo | Inglés (en) | Español (es) |
|---|---|---|
| Label | IVAE Estudios | IVAE Estudios |
| Description | photography studio in Cancún, Mexico | estudio de fotografía en Cancún, México |
| Also known as (alias) | IVAE Studios | IVAE Studios |

Notas:
- Las descripciones son deliberadamente neutras. No cambiar a nada promocional.
- Si Wikidata avisa de un conflicto de etiqueta+descripción con otro ítem, ajustar la descripción a "wedding and portrait photography studio in Cancún, Mexico" / "estudio de fotografía de bodas y retrato en Cancún, México". Sigue siendo descriptivo, no promocional.

### 5.2 Declaraciones (statements)

| Propiedad | Valor | Nota |
|---|---|---|
| P31 (instancia de) | Q672070 (estudio fotográfico) | Verificar al capturar que Q672070 corresponde a "photographic studio"; si el autocompletado sugiere algo más exacto, usar ese. Se puede añadir además Q4830453 (empresa) como segunda declaración P31. |
| P17 (país) | Q96 (México) | |
| P159 (sede) | Cancún | Escribir "Cancún" en el buscador del campo y elegir la ciudad de Quintana Roo, México (verificar en la vista previa que sea la correcta). |
| P571 (fecha de fundación) | 2023 | Precisión: año. |
| P112 (fundado por) | Vianey Díaz | Ver nota abajo: requiere que exista un ítem para ella. |
| P856 (sitio web oficial) | https://ivaestudios.com | |
| P2003 (usuario de Instagram) | ivaestudios.cancun | Sin arroba, solo el usuario. |
| P2671 (ID de Google Knowledge Graph) | /g/11wwttqfb6 | Este ID YA existe y es verificable en Google. |

Opcionales (añadir si el formulario lo permite sin fricción):

| Propiedad | Valor |
|---|---|
| P1329 (teléfono) | +52 228 857 0584 |
| P968 (correo electrónico) | mailto:info@ivaestudios.com |

**Nota sobre P112 (fundado por):** el valor de P112 debe ser otro ítem de Wikidata, y Vianey Díaz no tiene ítem propio (el Q139689736 que circulaba era falso). Opciones: (a) dejar P112 pendiente y añadirlo después, que es lo recomendado, o (b) crear también un ítem para Vianey, pero un ítem de persona necesita sus propias referencias independientes y hoy no las hay. No forzarlo el día 1.

### 5.3 Referencias dentro del ítem (obligatorias)

Cada declaración importante debe llevar referencia. En cada declaración: "add reference" y capturar:

- **P854 (URL de la referencia):** la URL de la ficha DENUE (para P571, P159, P31, P1329) o la URL del directorio o mención editorial (para el resto).
- **P813 (fecha de consulta):** la fecha en que se consultó.

Mínimo indispensable: P571 y P159 referenciadas con la ficha DENUE. Un ítem de negocio sin una sola referencia externa es el candidato a borrado clásico.

---

## 6. Después de crear el ítem: checklist

1. Copiar el QID nuevo que asigne Wikidata (formato Q + números) y verificar que `https://www.wikidata.org/wiki/QNUEVO` carga.
2. Añadir `https://www.wikidata.org/wiki/QNUEVO` al arreglo `sameAs` del nodo `#organization` en el JSON-LD de `index.html` (hoy ese arreglo tiene el Instagram y el enlace de Google Maps). Revisar también las demás páginas del sitio que repiten el schema Organization.
3. Hacer bump del `?v=` en el deploy, como en todo cambio del sitio.
4. Anotar el QID real en este archivo y corregir `seo/AGENTS.md`, que sigue listando los QIDs falsos.
5. A los 7-14 días, revisar que el ítem no tenga plantilla de borrado. Si alguien lo cuestiona, responder con calma señalando las referencias (DENUE + directorio). No borrar los avisos de otros editores.
6. Con el tiempo, añadir al ítem cada mención editorial nueva que se consiga con los pitches de `seo/geo/PITCHES_OUTREACH.md`. Cada referencia adicional blinda más el ítem.

---

## 7. Resumen en una línea

Primero DENUE + un directorio, luego el ítem con esas referencias citadas, luego el QID nuevo al `sameAs` del sitio. En ese orden y sin prisa.
