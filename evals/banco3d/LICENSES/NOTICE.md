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
