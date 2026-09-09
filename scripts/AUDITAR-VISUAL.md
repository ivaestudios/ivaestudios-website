# Auditoría visual en WebKit

`scripts/auditar-visual-webkit.js` recorre páginas en **WebKit** (el motor de
Safari) a 402x874 y reporta lo que no se ve leyendo el CSS:

- contenido que **nunca** llega a ser visible (mide el PICO de opacidad durante
  todo el recorrido, no al final: las revelaciones se apagan al salir de pantalla);
- texto realmente **recortado** por un contenedor de alto fijo;
- **áreas tocables** por debajo de 40px que no van dentro de una frase;
- **imágenes rotas**, recursos 4xx y errores de JavaScript;
- **desbordes horizontales** y encimamientos entre hermanos.

## Cómo se corre

```bash
npm i playwright-core@1.49        # en una carpeta de trabajo, no en el repo
node scripts/auditar-visual-webkit.js https://ivaestudios.com/es/ https://ivaestudios.com/es/blog
```

WebKit vive en `~/Library/Caches/ms-playwright/webkit-2336/pw_run.sh` y hay que
pasarlo como `executablePath`, o `webkit.launch()` busca una versión que no está.

## Por qué WebKit y no Chrome

Chrome pintaba correctamente cuatro cifras del estudio que en Safari eran
**invisibles** (celdas en `rotateX(-90deg)` que su IntersectionObserver nunca
podía revelar). Lo que ve el cliente es Safari: 99% del tráfico es teléfono.

## Falsos positivos ya descartados

- Un contenedor con `overflow:hidden` y un hijo **absoluto** más alto (foto de
  fondo escalada, velo) NO recorta texto. El detector exige texto fuera de la caja.
- Una caja de tamaño **cero** significa `display:none` en algún ancestro, no
  contenido cortado.
- Enlaces **dentro de una frase** (firma, respuestas del FAQ, párrafos) están
  exentos del mínimo de 44px por WCAG 2.5.8, y agrandarlos rompe el renglón.
- Un desborde horizontal que solo aparece **durante** el recorrido viene de una
  animación; el sitio lleva `overflow-x: clip` y el visitante no puede desplazarse.
