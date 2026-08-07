# Incidente 2026-08-07: 31 URLs del sitemap devolvian 404 en produccion

**Fecha del incidente:** 2026-08-07
**Gravedad:** critica. Paginas reales del sitio, listadas en el sitemap y enlazadas desde la home, invisibles para usuarios y para Google.
**Estado:** arreglado y desplegado. Commit `66887234` ("fix(critico): 31 URLs del sitemap daban 404 en produccion").
**Duracion estimada del daño:** semanas o meses. No hubo alerta que lo delatara.

Este documento existe para que nadie lo repita. Si vas a tocar `_redirects`, leelo entero antes.

---

## 1. Resumen en cuatro lineas

1. Cloudflare Pages solo aplica **las primeras ~100 reglas** de `_redirects`. El resto del archivo no existe para el servidor.
2. `_redirects` habia crecido hasta **312 reglas**.
3. Las reglas que servian 57 posts antiguos quedaron **debajo del corte** y esos posts empezaron a dar 404.
4. Nada en el repo ni en CI era capaz de detectarlo, porque todas las herramientas leen el **archivo**, y el archivo se veia perfecto.

---

## 2. Sintoma

31 URLs presentes en `sitemap.xml` devolvian **404** al pedirlas en produccion.

No eran paginas olvidadas. Entre ellas estaba el caso de estudio de Mayakoba, **enlazado desde la home**. Un visitante que hiciera clic ahi aterrizaba en la pagina de error.

Lo que hacia el problema invisible:

| Donde se miraba | Que se veia |
|---|---|
| El repo | Todos los archivos presentes |
| `sitemap.xml` | Las 533 URLs listadas, sin duplicadas |
| `_redirects` | Todas las reglas escritas y bien formadas |
| `scripts/audit_links.py` en CI | Verde: ningun enlace roto |
| El sitio en vivo | 31 paginas en 404 |

El unico lugar donde el problema era visible era produccion, y nadie estaba mirando produccion.

---

## 3. Como se detecto

Con una verificacion directa, no con una herramienta del repo: se pidio con `curl` cada una de las 533 URLs del sitemap contra `https://ivaestudios.com` y se conto el codigo de respuesta. Salieron 31 con 404.

Al mirar el patron, las 31 tenian algo en comun: todas se servian mediante una regla de reescritura del tipo

```
/blog/<slug>   /post-<slug>   200
```

es decir, dependian de una regla de `_redirects` para existir. Ninguna de las 31 era un archivo que se sirviera solo.

Ese detalle apunto directo a `_redirects`, no al contenido.

---

## 4. Causa raiz

### El limite que nadie tenia documentado

**Cloudflare Pages honra unicamente las primeras ~100 reglas de `_redirects`. Las siguientes se ignoran en silencio.** No hay error de build, no hay aviso en el panel, no hay log. Simplemente no se aplican.

El archivo tenia **312 reglas**. O sea que aproximadamente **212 reglas escritas no existian** en produccion.

### La medicion exacta del corte

Se localizo el corte pidiendo en vivo, una por una, las reglas alrededor de la posicion 100 en el archivo ya reducido a 176 reglas:

| Posicion de la regla | Origen | Respuesta en produccion |
|---|---|---|
| #107 | `/manejo-de-redes-sociales-cancun` | **301** (viva) |
| #108 | `/destination-wedding-cancun` | **404** (muerta) |

Todas las reglas probadas por debajo de #108 tambien dieron 404: `/cancun-family-photographer`, `/photographer-cancun`, `/es/gestion-redes-sociales`, `/social-media-hotels`, `/blog/outfit-guide`, `/portfolio`, `/mayakoba`, `/intake`, `/strategy-brief`, entre otras.

El corte real esta entre 107 y 108, de ahi la formula practica: **planificar como si el limite fuera 100 y dejar holgura**.

### La segunda regla del motor, tambien no documentada

**Si el origen de una regla existe como archivo, Pages sirve el archivo y nunca aplica la regla.** Habia decenas de reglas asi en el archivo: reglas inertes que no hacian nada pero que **si ocupaban un lugar del presupuesto**, empujando hacia abajo a reglas que si importaban.

---

## 5. Por que nadie lo noto antes

Este es el punto que hay que entender para no repetirlo. No fue un cambio malo, fue una acumulacion.

| Factor | Explicacion |
|---|---|
| **Acumulacion lenta** | Las reglas se fueron sumando de a pocas durante meses: un alias por aqui, un renombre por alla. Cada adicion individual era razonable. Nadie sumo el total |
| **El corte se movio** | Mientras el archivo tenia menos de 100 reglas todo funcionaba. El dia que se añadieron **15 reglas al principio** del archivo, todo lo que estaba entre las posiciones ~85 y ~100 se salio de la ventana viva. No cambio nada en esas reglas: cambio lo que tenian encima |
| **El daño es a distancia** | Quien añadio las 15 reglas nuevas rompio paginas que ni siquiera aparecian en su cambio. El diff se veia inofensivo |
| **Fallo silencioso** | Cloudflare no avisa. No hay error de build ni entrada en logs. Una regla ignorada se ve exactamente igual que una regla aplicada |
| **El auditor de CI da falso verde** | `scripts/audit_links.py` tiene una funcion `load_redirect_sources()` que mete **todo** origen de `_redirects` en el conjunto de rutas validas, sin importar la posicion. Para el auditor, la regla #250 vale igual que la #3. Era estructuralmente incapaz de ver el acantilado |
| **Nadie miraba produccion** | Todas las verificaciones eran contra el repo. El repo estaba impecable |

**La leccion en una frase:** el archivo miente, produccion no. Una regla existe cuando `curl` lo confirma, no cuando la lees en el archivo.

---

## 6. El arreglo aplicado

Commit `66887234`. Tres movimientos, en este orden.

### 6.1. Sacar 57 posts del presupuesto moviendolos a archivos reales

Los 57 posts legacy vivian como `post-<nombre>.html` en la raiz y se servian en `/blog/<slug>` mediante una regla de reescritura 200. Cada uno gastaba una regla.

Se movieron a `blog/<slug>.html`. Ahora **se sirven solos**, porque Cloudflare Pages sirve `blog/<slug>.html` en la URL limpia `/blog/<slug>` sin necesidad de ninguna regla.

| Antes | Despues |
|---|---|
| `post-<nombre>.html` + 1 regla 200 por post | `blog/<slug>.html`, cero reglas |
| 57 reglas gastadas | 0 reglas gastadas |

Las URLs publicas `/blog/<slug>` **no cambiaron**, asi que canonicals, sitemap, `llms.txt` y enlaces internos siguieron validos sin tocar nada. Las URLs viejas `/post-*` se cubrieron con 16 reglas (los slugs que si habian cambiado) mas 1 comodin `/post-* /blog/:splat 301` para el resto.

### 6.2. Reconstruir `_redirects` ordenado por evidencia

De **312 a 176 reglas**, y por primera vez con un orden que significa algo:

| Tier | Contenido | Criterio |
|---|---|---|
| A | 404 reales reportados por Google Search Console | Evidencia de trafico |
| B | Origenes enlazados desde el propio sitio | Romperlos rompe la navegacion |
| C | URLs viejas `/post-*`, 16 reglas mas 1 comodin | Historial real |
| D | Alias historicos | Sin evidencia. Los que caen despues del corte quedan inactivos, y se asume |

Las 79 reglas con evidencia entran holgadas dentro del presupuesto. Ademas se eliminaron las reglas inertes (aquellas cuyo origen existia como archivo y por tanto nunca se aplicaban).

Se añadio al principio del propio `_redirects` un bloque de comentarios que explica el limite, la medicion #107 viva / #108 muerta, y la regla de que un archivo le gana siempre a una regla. Quien abra el archivo se entera antes de escribir.

### 6.3. Corregir 36 enlaces internos

36 enlaces internos apuntaban a `/post-*`, es decir a un origen de redireccion. Se reescribieron a su URL canonica `/blog/<slug>`. `audit_links.py` paso de 18 enlaces rotos a 2, y los 2 restantes son preexistentes y de otra causa (las migas de pan `/comparison` y `/es/comparativa`, que siguen pendientes).

### 6.4. Verificacion

- Las 533 URLs del sitemap resuelven a un archivo.
- Las 31 URLs que daban 404 en vivo quedaron arregladas.
- Los 57 posts movidos conservan su bloque "En corto".

---

## 7. Lo que quedo pendiente

El arreglo detuvo la hemorragia pero no dejo el archivo dentro del presupuesto: **176 reglas siguen siendo mas de 100**, asi que hoy **69 reglas del archivo no existen** en produccion.

De esas 69, tres duelen y siguen rotas al momento de escribir esto:

| URL muerta | Evidencia de que importa |
|---|---|
| `/destination-wedding-cancun` (regla #108) | 22 a 23 impresiones al mes en Search Console (`seo/reports/404-analysis-2026-W19.md` y `W20.md`) |
| `/es/gestion-redes-sociales` (regla #154) | 7 paginas vivas del sitemap la enlazan con `<a href>`: `es/comparativa/fotografos-lujo-cancun.html` y las 6 de `es/locaciones/`. Su destino `/es/manejo-redes-sociales` responde 200 |
| `/portfolio` (regla #131) | Existio como archivo real `portfolio.html` en el historial de git |

Y 19 URLs de post reales tambien quedaron debajo del corte (`/blog/honeymoon-photographer-cancun`, `/blog/outfit-guide`, `/blog/destination-wedding`, entre otras), mientras **30 alias inventados que nadie enlaza ocupan lugar por encima de ellas**.

**El recorte que falta:** una auditoria cruzo los 103 alias de palabra clave contra 759 archivos del repo, 1276 commits de historial y produccion en vivo. Resultado: 17 con evidencia dura, 23 dudosos y **63 sin ninguna evidencia en ningun lado** (solo existen dentro del propio `_redirects`). Borrando los 63 el archivo baja a 113 reglas; borrando tambien los 23 dudosos queda en **90 reglas, y por primera vez ninguna regla del archivo estaria muerta**.

---

## 8. Como se previene ahora

### 8.1. El guardian: `scripts/audit_ecosystem.py`

**Estado al 2026-08-07: el archivo todavia no existe en `scripts/`.** Esta seccion define lo que tiene que hacer. Quien lo cree, que implemente estas comprobaciones exactamente, y que lo añada a `.github/workflows/link-audit.yml` para que corra en cada PR que toque HTML o `_redirects`.

Los invariantes que debe verificar, ordenados por el daño que evitan:

| # | Invariante | Por que |
|---|---|---|
| 1 | `_redirects` no supera **90 reglas** no comentadas | 10 de holgura antes del corte real. Falla el build en vez de dejar que Cloudflare decida en silencio |
| 2 | El origen de la **ultima** regla del archivo responde 301 o 200 en vivo, nunca 404 | Prueba empirica del corte. Si falla, el archivo se paso |
| 3 | Ninguna URL del `sitemap.xml` depende de una regla de `_redirects`: toda URL del sitemap resuelve a un archivo del repo | Es exactamente lo que fallo el 2026-08-07 |
| 4 | Ninguna regla tiene como origen una ruta que exista como archivo | Detecta las reglas inertes que gastan presupuesto sin hacer nada |
| 5 | Todo href interno resuelve 200 usando **solo las primeras 100 reglas** de `_redirects` | Cierra el agujero de `load_redirect_sources()` |
| 6 | Ningun href interno apunta a un origen listado en `_redirects` | Cero saltos internos innecesarios |
| 7 | Toda URL del sitemap tiene al menos 1 enlace interno entrante | Detecta huerfanos como `/es/fotos-embarazo-cancun` |
| 8 | Numero de `blog/*.html` + `es/blog/*.html` = URLs `/blog/` y `/es/blog/` del sitemap = enlaces del bloque `AUTOGEN-ARCHIVE` | Detecta desincronizacion entre contenido, sitemap e indice |
| 9 | Todo `hreflang` apunta a una URL que devuelve 200 sin saltos, y el destino declara el hreflang inverso | Detecta el caso de `es/blog/estilo-fotografo-lujo-editorial-vs-documental.html` |
| 10 | Toda regla lleva un comentario con su origen de evidencia (GSC, enlace, o historial de git) | Regla de admision: sin evidencia, no entra |

### 8.2. El parche urgente a `audit_links.py`

`load_redirect_sources()` debe aceptar como validas **solo las primeras 100 reglas** de `_redirects` y tratar el resto como inexistente. Sin ese cambio, el auditor de CI seguira dando verde sobre paginas rotas. Es un cambio de pocas lineas y es lo primero que hay que hacer.

### 8.3. Los pasos que faltan en CI

Añadir a `.github/workflows/link-audit.yml`:

```yaml
- name: Sitemap al dia
  run: python3 scripts/update_sitemap.py --check

- name: Indice del blog al dia
  run: |
    python3 scripts/generate_blog_grid.py
    git diff --exit-code
```

Asi un post nuevo no puede entrar sin aparecer en el sitemap ni en el archivo del blog.

### 8.4. Habitos de trabajo

| Habito | Detalle |
|---|---|
| **Antes de agregar una regla, borrar una** | El presupuesto es fijo. Si el archivo esta lleno, algo tiene que salir |
| **Un post nuevo cuesta cero reglas** | `blog/<slug>.html` se sirve solo en `/blog/<slug>`. Si alguien va a añadir una regla por un post nuevo, esta haciendo algo mal |
| **Preferir renombrar el archivo antes que añadir una regla** | Mover `post-X.html` a `blog/<slug>.html` saco 57 reglas del presupuesto de golpe. El mismo truco aplica a las 6 paginas de dinero que hoy se sirven por reglas 200 |
| **Verificar en produccion, no en el archivo** | `curl` a la ultima regla del archivo despues de cada deploy que toque `_redirects` |
| **Nunca escribir un alias "por si acaso"** | Google indexa el destino del 301, nunca el alias. Un alias que nadie escribe no aporta nada y si desplaza a una regla que si importa |

---

## 9. Comprobacion rapida despues de cualquier deploy que toque `_redirects`

```bash
cd "/Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted"

# 1. Contar reglas no comentadas. Debe dar 90 o menos.
awk '!/^[[:space:]]*(#|$)/{n++} END{print "reglas:", n}' _redirects

# 2. Probar en vivo el origen de la ULTIMA regla del archivo.
#    Si devuelve 404, el archivo se paso del presupuesto.
ULTIMA=$(awk '!/^[[:space:]]*(#|$)/{last=$1} END{print last}' _redirects)
curl -o /dev/null -s -w "$ULTIMA -> %{http_code}\n" "https://ivaestudios.com$ULTIMA"

# 3. Probar que ninguna URL del sitemap da 404.
grep -o '<loc>[^<]*</loc>' sitemap.xml | sed 's/<[^>]*>//g' | \
  while read u; do
    c=$(curl -o /dev/null -s -w "%{http_code}" "$u")
    [ "$c" = "200" ] || echo "ROTA $c $u"
  done
```

Si el paso 3 imprime aunque sea una linea, el incidente se esta repitiendo.

---

## 10. Documentos relacionados

| Archivo | Que contiene |
|---|---|
| `seo/geo/ECOSISTEMA_URLS.md` | La politica de URLs completa: cuando URL propia, cuando redirigir, nombrado de slugs, presupuesto de reglas, como publicar un post paso a paso |
| `_redirects` (cabecera) | El aviso del limite dentro del propio archivo, para quien lo abra sin haber leido esto |
| Commit `66887234` | El arreglo, con su mensaje detallado |
