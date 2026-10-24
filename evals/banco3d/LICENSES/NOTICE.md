# Avisos de terceros del banco 3D

Forma del banco adaptada de pzfreo/cadgenbench-build123d (Apache-2.0, db724aa4c98a5d5985a1fc488b0bc67796434606); patrón de pruebas fijas adaptado de BenCaunt/SynthCAD (MIT, Copyright (c) 2026 Ben Caunt).

| Fuente | URL | Commit | Licencia | Copia de la licencia |
|---|---|---|---|---|
| pzfreo/cadgenbench-build123d | https://github.com/pzfreo/cadgenbench-build123d | db724aa4c98a5d5985a1fc488b0bc67796434606 | Apache-2.0 (el repo no trae NOTICE; el LICENSE trae la plantilla sin llenar, así que el autor queda como `pzfreo`) | `LICENSE-cadgenbench-build123d-Apache-2.0.txt` |
| BenCaunt/SynthCAD | https://github.com/BenCaunt/SynthCAD | 5cb119060ec0bee58ea449e72dc17d37f505f308 | MIT, Copyright (c) 2026 Ben Caunt | `LICENSE-SynthCAD-MIT.txt` |

Qué se tomó de cada uno (idea y estructura; el código del banco es propio, no copia archivos de ellos):

- **cadgenbench-build123d:** una carpeta por ejercicio con la pieza escrita como script; un yaml por tarea; los puntajes de cada corrida guardados en un `.json` más una ficha `run_meta.json` (versión del repo, Python, librería, máquina, fecha, duración); varios ejercicios a la vez (4 por defecto, como `run_sweep.sh`), cada uno en su carpeta de trabajo, y un fallo no frena a los demás. Cambio nuestro: el puntaje no es un parecido de forma sino «pasó / no pasó» de cada corrector, y cada ejercicio trae mutantes MAL sacados de fallas reales.
- **SynthCAD:** pruebas fijas y exactas (caja que encierra la pieza, sondas, conteos) con el valor esperado escrito aparte. Cambio nuestro: el esperado sale de lo que pasó con la pieza real (el papel, la foto o la cita de quien la usó), nunca del mismo código que se prueba.

Copias de texto de los dos repos, con el sha de cada archivo: `...\viernes-23-plan-sistema\banco3d-material\fuentes\` (nube de Ingeniería), con su `FUENTES.txt`.

## Examen de muestra CATIA V5 Associate - Part Design (ejercicio 13)

El ejercicio `13_examen_catia_associate` (las cuatro piezas del Tool Block y sus masas esperadas) sale del examen de muestra «CATIA V5 Associate - Part Design (PDG) Sample Exam», V2-2015/03/30, de Dassault Systemes, leído de una copia publicada en SlideShare (https://www.slideshare.net/slideshow/catia-v5-associate_sample-exam-pdg-part-design/269352140, subida el 27/05/2024, 13 láminas, bajada el 23/10/2026 según su `FUENTE.txt`). Se usa para practicar la lectura de planos y para medir el corrector de masa. No se redistribuye: el repo no trae las láminas ni copias de ellas; `tarea.yaml` cita su carpeta en la nube de Ingeniería y el sha256 de cada una. La copia no está cotejada con el original de Dassault. Las piezas son modelos propios en build123d hechos a partir del dibujo.

## Too Tall Toby en la guía de build123d (ejercicios 14, 15 y 16)

Los ejercicios `14_ttt_c_clamp_base`, `15_ttt_paste_sleeve` y `16_ttt_flanged_hub` (planos PPP01-03, PPP01-05 y PPP01-07, con la masa que publica la página) son ejercicios de Too Tall Toby publicados en la guía de build123d (https://build123d.readthedocs.io/en/stable/tttt.html; la práctica del 23/10/2026 la leyó en `/en/latest/`). Según el `RESUMEN.md` de esa práctica (carpeta `viernes-23-plan-sistema/practica/ttt/` de la nube de Ingeniería), el repositorio gumyr/build123d está bajo Apache-2.0 (archivo `LICENSE` de la rama `dev`) y el pie de la página dice «© Copyright 2022, Gumyr». Sobre los planos, el mismo `RESUMEN.md` dice que cada plano trae una nota de Toby: se puede usar, imprimir y distribuir para cualquier fin educativo, y el crédito a @tootalltoby se agradece pero no es obligatorio. Acá no se afirma más que eso. No se redistribuyen: el repo no trae los planos ni copias de ellos; cada `tarea.yaml` cita su carpeta en la nube y el sha256 de cada `plano_*.png`. Los `bien.py` (y su módulo común) son una lectura propia del plano, hecha en esa práctica sin leer la solución de código de la página; no son el código de referencia de la guía.
