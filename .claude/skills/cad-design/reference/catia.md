# CATIA V5 R21 por programa — qué anda en esta PC, cómo se corre y dónde se equivoca

Medido el 17/10/2026 (tanda 11) sobre lo probado el 10/10 y el 13/10 (memoria `reference_catia_por_com`; evidencia en
`.sgc-cache/investigacion-2026-10-11/catia/`, `.sgc-cache/catia-2026-10-13/` y `.sgc-cache/catia-2026-10-17/`).
Licencia: la confirmó Fak el 13/10 (*«la licencia es oficial»*); no se vuelve a preguntar.

**Decisión: no hay skill `catia` aparte.** CATIA es una herramienta más de `cad-design` (medir, chocar, abrir lo del
cliente) y una skill nueva tendría que probar que se dispara con un mensaje real de Fak (`mejora-implementada.md`) sin
agregar nada que esta página no diga. Se revisa si algún día se diseña EN CATIA por programa.

## Cómo se corre

```
C:\Dev\_catia_env\Scripts\python.exe .claude\skills\cad-design\scripts\catia_medir.py estado
C:\Dev\_catia_env\Scripts\python.exe .claude\skills\cad-design\scripts\catia_medir.py medir ^
    --step pieza.step [--step otra.stp] [--choque panel.step pieza.step] [--holgura 0.3] ^
    [--modulos] [--cadlib] --salida informe.json
```

- Corre con `C:\Dev\_catia_env` (Python 3.12 + pywin32); el `.venv-cad` no tiene pywin32. `--cadlib` mide lo mismo con
  build123d en el `.venv-cad` para comparar.
- **Se niega si hay una CATIA abierta** (la de Fak): abre la suya, cierra solo lo que abrió y la apaga.
- Arregla la cabecera del STEP en una **copia** (ISO 10303-21: `FILE_DESCRIPTION`, `FILE_NAME`, `FILE_SCHEMA`; los de
  OpenCASCADE vienen al revés y CATIA R21 los lee vacíos). El original no se toca.
- Un hilo acepta los cuadros de aviso de SU proceso que tengan un solo botón OK, con un mensaje al cuadro (nunca teclas);
  cada cuadro queda anotado en el informe. El de «Converting Data…» (un solo botón *Cancel*) no se toca.
- **El choque se calcula con las dos piezas ya en el MISMO marco**: el panel se lleva al marco del utillaje con
  OpenCASCADE antes (`gp_Trsf` con `frame.json`) y se exporta. Mover el panel adentro de CATIA (`Move.Apply`, la opción
  `--frame`) dio el 13/10 y el 17/10 un choque de −3,354 mm **en un lugar donde ninguna de las dos piezas tiene material**
  (comprobado con trimesh: 0 de 15 puntos adentro de cada una). No usar `--frame` para decidir.

## Qué dio (caso de respuesta conocida: virolador v14 contra el panel `two_wireless.stp`)

| Medición | CATIA | build123d (`--cadlib`) | Diferencia |
|---|---|---|---|
| v16 entregada (placa 168): volumen y choque | 89.278,482 mm³ = 89.278,483; sin choque, 1 contacto (0,0) | | 54 s sin el arranque |
| Volumen de la v14 | 116.526,908 mm³ | 116.526,907 mm³ | 0,000 001 % |
| Área de la v14 | 33.819,859 mm² | 33.819,859 mm² | 0 |
| Volumen del panel (sólido, sin el tapizado) | 91.791,099 mm³ | 91.765,561 mm³ | 0,03 % |
| Choque v14 contra panel, mismo marco, holgura 0,3 | **sin choque; 1 contacto (0,0 mm)** | `check_collision`: 0 puntos adentro, contacto 0,06-0,08 | coinciden |
| Gemelo: la v14 metida 1 mm en el panel | **choque −0,14 mm** | — | el control no es ciego |
| Tiempos | arranque 20 s (63,7 s la primera corrida del día; ese informe lo pisó la segunda); medición 44 s sin el arranque | | < 1 min con la PC libre. Con cuatro simulaciones corriendo a la vez (v16, 17/10): arranque 78 s y medición 101 s |

`GetCOG` no devuelve la misma unidad para todos los STEP (en la v14 coincide con build123d en mm; en el panel salió
×1000): el informe lo guarda como `centro_crudo` y **no se compara**.

## Módulos (probados creando un elemento de cada uno, con control negativo)

| Módulo | Prueba | Resultado |
|---|---|---|
| Part Design | sketch con círculo r 10 + pad 5 mm, medir volumen | 1.570,796 mm³ = π·100·5 ✔ |
| Superficies (GSM / Generative Shape Design) | línea 10 mm extruida 5 mm + offset 1 mm, medir áreas | 50,000 y 50,000 mm² ✔ (las fábricas piden **referencias**: `part.CreateReferenceFromObject`) |
| Control negativo | una orden que no existe | falla, como debe ✔ |
| DSE (escaneo, nubes de puntos) | — | **instalado** (`CATCld*.dll` en `B21\intel_a\code\bin`) pero **sin biblioteca de automatización** entre las 86 registradas: se usa desde la ventana de CATIA, no por programa |
| Análisis estático, choque, ensambles, STEP/IGES/STL | 10 y 13/10 | anda (memoria `reference_catia_por_com`) |

`IsProductAuthorized` y `StartWorkbench` contestan que sí también a un nombre inventado: no prueban nada. La sesión lista
208 productos (DSE, QSR, GSD, KIN, SPA, GPS, MD2, HD2, entre otros), sin distinguir lo autorizado.

## Para qué conviene CATIA y para qué no

- **Sí:** controlar lo que se va a entregar (volumen, choque contra el panel del cliente, en segundos), abrir lo que
  manda el cliente en su formato nativo, un estático lineal simple, superficies.
- **No:** diseñar con IA (CATIA V5 no tiene; Dassault lo anuncia solo para 3DEXPERIENCE 2026x), juzgar el asiento sobre
  blando (no lo modela), escanear por programa (DSE no tiene automatización).
- Documentación oficial: `V5Automation.chm` (la ayuda de automatización de la propia instalación,
  `C:\Program Files (x86)\Dassault Systemes\B21\intel_a\code\bin\`), copiada tal cual a `4- MANUALES\CATIA V5\`.
- Para conocer los nombres exactos de cada orden: `.sgc-cache/investigacion-2026-10-11/catia/codigo/tipos.py`
  (`lista`, `buscar`, `interfaz`, `firma`) sobre las bibliotecas de tipos registradas.

## Trampas (además de las de la memoria)

- El objeto que devuelve `Documents.Open` no expone `Part` ni `Product` a pywin32: se toma `catia.ActiveDocument`.
- Un STEP de cliente entra como pieza con un cuerpo y un conjunto de superficies (el tapizado); uno de OpenCASCADE, como
  pieza con un `MANIFOLD_SOLID_BREP`.
- El informe de importación de cada STEP queda en `%LOCALAPPDATA%\DassaultSystemes\CATReport\<nombre>.err`.
