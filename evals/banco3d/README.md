# Banco 3D

Banco de pruebas para los **controles** de las piezas 3D (el script que corrige), no para un modelo. Cada ejercicio
sale de una falla real que marcó Fak: trae la pieza **BIEN** y 2 o 3 piezas **MAL** (mutantes). Un control sirve si
deja pasar la BIEN y frena las MAL.

## Cómo se corre

Con el Python del entorno CAD (Python 3.12, build123d 0.11.1, trimesh, shapely):

```
C:/Dev/BarackMercosul/.venv-cad/Scripts/python.exe -I evals/banco3d/correr.py -j 4
C:/Dev/BarackMercosul/.venv-cad/Scripts/python.exe -I evals/banco3d/correr.py --solo 01_porta_bulon
C:/Dev/BarackMercosul/.venv-cad/Scripts/python.exe -I evals/banco3d/correr.py --congelado scores/congelado.json
C:/Dev/BarackMercosul/.venv-cad/Scripts/python.exe -I evals/banco3d/correr.py --congelar
```

- `-j 4`: cuántos ejercicios a la vez (por defecto 4). `--solo <id>`: uno solo.
- Cada pieza se arma en `.build/<id>/<pieza>/` (no se versiona). Ahí no se borra nada: de cada pieza se usan solo los
  archivos que escribió en esta corrida.
- Cada corrida deja `scores/<AAAA-MM-DD_HHMM>.json` (por ejercicio, pieza y corrector: esperado, obtenido, detalle,
  medidas, segundos) y `scores/run_meta.json` (versión del repo, Python, build123d, máquina, fecha, duración).
- `--congelado`: compara contra una corrida guardada y lista «BIEN que antes daba verde y ahora rojo» (se rompió algo)
  y «mutantes nuevos cazados». `--congelar` copia el último scores a `scores/congelado.json`.
- Prueba del contrato (Node): `npx vitest run __tests__/evals/banco3d.test.mjs`; la corrida real del ejercicio 01
  tarda unos 3 minutos y corre solo con `BANCO3D_LENTO=1`.

## Qué significa «caza X de N»

`BANCO 3D: caza X de N mutantes · BIEN en verde Y de M · correctores que faltan: Z`

- **N** = todas las piezas MAL de todos los ejercicios. Un mutante cuenta **cazado** si al menos uno de los
  correctores listados en su `tarea.yaml` da rojo.
- Un corrector que todavía no existe (`existe: false`), que no está en `correctores/`, o que sale con error, **no**
  cuenta como rojo: el mutante queda sin cazar y el corrector suma en «correctores que faltan».
- **BIEN en verde Y de M**: la BIEN cuenta si al menos un corrector la juzgó y ninguno dio rojo ni error.
- **Sin respuesta** (`esperado: sin_respuesta`): pieza sin resultado real que diga si está bien o mal (por ejemplo,
  la tapita del 01, que nunca imprimió el techo). Se corre y se informa, pero no entra ni en N ni en M.
- Con `--congelado` avisa: BIEN que antes daban verde y ahora no, mutantes que antes se cazaban y ahora no, mutantes
  nuevos cazados, piezas que faltan o cambiaron de esperado, y controles con opciones o umbrales cambiados.
- El esperado de cada pieza sale de lo que pasó con la pieza real (cita de Fak, foto, papel), **no** de lo que dice
  el corrector. Por eso un corrector puede dejar pasar un mutante: eso es lo que el banco tiene que mostrar.

## Cómo está armado

```
evals/banco3d/
  correr.py                     corre todo y guarda los puntajes
  ejercicios/<nn>_<id>/
    tarea.yaml                  id, nombre, falla_real, pedido, piezas, controles, formatos, notas
    bien.py                     python bien.py <carpeta>  ->  <carpeta>/<nombre>.stl y .step
    mal_<n>_<que>.py            igual, con la falla
  correctores/<nombre>.py       python <nombre>.py <archivo.stl|.step> [--opcion ...]
  scores/                       un .json por corrida + run_meta.json
  LICENSES/                     licencias de las fuentes + NOTICE.md
```

- Si la pieza BIEN o MAL existe como STL/STEP real en la nube, el `.py` la **copia** (ruta y sha256 en `tarea.yaml`;
  si el sha256 cambió, la pieza no se arma y sale con 2). Si no existe, se arma con build123d y la `tarea.yaml` lo dice.
- Un corrector imprime una línea JSON `{"corrector", "veredicto": "verde|rojo", "detalle", "medidas"}` y sale con
  0 (verde), 3 (rojo) o 2 (error).
- En `controles` cada item es un nombre o `{nombre, existe, formato: stl|step, opciones: [...], piezas: [...]}`;
  `correr.py` le pasa al corrector el `.stl` o `.step` de la pieza (el que no tiene `__` en el nombre) y las opciones.
- `correctores/chequeo_voladizos2.py` es la copia byte a byte del control del 22/10 (sha256 en el test); no se edita.
  `voladizos.py` lo llama y traduce su `OJO`/`OK`.
- Regla: el banco, los correctores y los tests que ya están no se editan ni se borran; se agregan casos.

## De dónde sale la forma

- **pzfreo/cadgenbench-build123d** (Apache-2.0, commit `db724aa4c98a5d5985a1fc488b0bc67796434606`): carpeta por
  ejercicio con la pieza como script, yaml de tarea, puntajes guardados en json + `run_meta.json`, 4 ejercicios a la vez.
- **BenCaunt/SynthCAD** (MIT, Copyright (c) 2026 Ben Caunt, commit `5cb119060ec0bee58ea449e72dc17d37f505f308`):
  pruebas fijas y exactas con el valor esperado escrito aparte.
- Detalle y licencias en `LICENSES/NOTICE.md`. Análisis de las dos fuentes: informe `02_forma_del_banco.md` de la
  carpeta `viernes-23-plan-sistema` (nube de Ingeniería).
