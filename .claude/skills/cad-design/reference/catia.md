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

## Si el script frena y deja SU CATIA abierta

Cuando un chequeo corta a mitad de camino (el documento activo no es la copia que abrió, o la CATIA que contestó ya
tenía documentos), el script **no cierra nada a propósito** y la siguiente corrida se niega. Para cerrar la que dejó
(solo si es la suya: un único documento con el nombre de la copia, `<nombre>_cabecera.CATPart`):

```
C:\Dev\_catia_env\Scripts\python.exe -c "import win32com.client as w; c=w.GetActiveObject('CATIA.Application'); print([c.Documents.Item(i+1).Name for i in range(c.Documents.Count)])"
```

Si la lista es solo esa copia: `c.Documents.Item(1).Close(); c.Quit()`. Si hay cualquier otro documento, es la CATIA de
Fak: no se toca (pasó el 17/10 a las 09:11 y se cerró así).

## Trampas (además de las de la memoria)

- El objeto que devuelve `Documents.Open` no expone `Part` ni `Product` a pywin32: se toma `catia.ActiveDocument`.
- Un STEP de cliente entra como pieza con un cuerpo y un conjunto de superficies (el tapizado); uno de OpenCASCADE, como
  pieza con un `MANIFOLD_SOLID_BREP`.
- El informe de importación de cada STEP queda en `%LOCALAPPDATA%\DassaultSystemes\CATReport\<nombre>.err`.

## 19/10/2026 — una noche de práctica: diseñar EN CATIA desde cero (base en `scripts/catia/`)

Pedido de Fak (19/10, 01:00): *"practicando con catia... la idea es que puedas diseñar todo con catia desde 0"*. Se
hicieron 22 ejercicios de lo básico a una pieza real, cada uno medido contra su cuenta (y contra build123d donde había
STEP); la evidencia (scripts, CATPart, STEP, PDF, capturas y `NOTAS.md` con el detalle) queda en `C:\Dev\_catia_practica\`
(fuera del repo). Ojo: `registro.json` de cada ejercicio guarda solo la ÚLTIMA corrida; los números de corridas
anteriores que se citan (968 caras de más, STL de 85 849,6, 18 minutos) están en `NOTAS.md`, no en un registro.

**Qué hay en `scripts/catia/`** (corre con `C:\Dev\_catia_env`; la carpeta de trabajo es `CATIA_TRABAJO`, por defecto
`C:\Dev\_catia_practica`): `catia_base.py` (CATIA propia por pid, vigía de cuadros, `topologia`/`aristas_con_extremos`
para elegir caras y aristas por POSICIÓN, `medir` con centro de gravedad, capturas a PNG, `correr(..., fresca=True)`),
`enums.py` (valores de cualquier enumeración de CATIA leídos de las typelibs, sin arrancarla), `compara.py` (lo que sobra,
lo que falta y la distancia entre dos STEP, NO ciego: probado con el gemelo corrido 0,1 mm), `choque_exacto.py`
(intersección B-Rep y luz mínima), y como ejemplo completo `v16_poligonos.py` + `ej13_v16.py` (el virolador v16 rehecho).

**Qué es confiable y qué no (medido):**

| Tema | Resultado | Cómo se usa |
|---|---|---|
| Part Design (croquis acotado, pad, pocket, 4 tipos de agujero, revolución, nervio, redondeo, chaflán, cáscara, desmoldeo, patrones, espejo, parámetros y fórmulas, material y masa) | Exacto contra la cuenta (y contra build123d donde se exportó); el patrón RECTANGULAR solo después de elegir el sentido de cada dirección midiendo (1 de 4 combinaciones da los 9 agujeros; `dbg_rect.py`) | Ver `NOTAS.md`: grados de libertad del croquis, ejes de cada plano (ZX: H→Z, V→X), sentidos medidos |
| Superficies (extruir, revolución, transición, relleno, unir, cerrar, espesor, cortar, spline) | Exacto | Los sentidos se miden (desplazamiento y corte); una superficie de corte tiene que pasarse del borde |
| Multi-sección SÓLIDA de Part Design | **Falló siempre** (hasta con dos hexágonos) | Por superficie: transición vértice a vértice + rellenos + unir con `SetDeviation(0.01)` + **`Invert = True`** + cerrar |
| Ensamble con restricciones | Exacto (perno en 15; 30; 10) | Ejes y puntos con nombre propio y `CreateReferenceFromName(raiz/instancia/!Nombre)` |
| Choque de CATIA (`Clashes`) | **No distingue choques de hasta 0,3 mm de un contacto**: 0,2 y 0,3 de choque = «contacto 0,0»; y una luz real de 0,107 (v14 vs panel) también dio «contacto 0,0» (del lado de la luz solo se midió ese caso) | No decide holguras de décimas. Exacto: segundo cuerpo + `AddNewIntersect`, o `choque_exacto.py` |
| Cálculo estático GPS | Flecha 0,7977 contra 0,8 de la cuenta (0,3 %) | Se compara la flecha; la tensión en un empotramiento tiene pico de esquina |
| Plano (Drafting) a PDF | Anda: vistas, cotas desde el croquis, marco y cajetín | Sin croquis acotado no hay cotas automáticas |
| Exportar STEP/STL | **CATIA exporta lo VISIBLE**: con las superficies de construcción a la vista salieron 8 cáscaras y 968 caras de más | Ocultar los sets de superficies antes de exportar; controlar 1 sólido / 1 cáscara y el volumen del STL |
| La v16 rehecha en CATIA desde sus datos | sobra 0, falta 0, distancia máxima 0,0016 mm contra la v16 real | `ej13_v16.py`; 14 pasos en ~1,5 min |

**Trampas que dejan la sesión rota** (después hasta un pad falla): medir un cuerpo vacío; sumar un cuerpo de muchas
caras con `AddNewAdd` («el servidor lanzó una excepción»); engancharse a una CATIA que se está cerrando. Para lo largo,
CATIA recién abierta. Un script cortado puede hacer que COM arranque otra CATIA sola (padre `svchost`): se identifica por
hora y padre antes de tocarla. Unidades de `Measurable`: `Length` en mm, `Area` en m², `Volume` en m³; `Analyze.Volume`
en mm³; lo que vuelve de VBScript trae coma decimal.

**Agregado a las 03:50 del 19/10:**
- **Choque exacto adentro de CATIA con piezas reales** (`scripts/catia/choque_exacto_en_catia.py`): el utillaje pegado como
  cuerpo en la pieza del panel (`Selection.Copy` + `PasteSpecial("CATPrtResultWithOutLink")`) y `AddNewIntersect`: la v16
  contra el panel del cliente da sin choque (OpenCASCADE: luz 0,0455) y el gemelo subido 1 mm 69,561 mm³ contra 69,573
  de OpenCASCADE. Un STEP de build123d entra a CATIA como ensamble y su cuerpo no se puede copiar: para CATIA se escribe
  con `STEPControl_Writer`.
- **Reglas de la casa adentro de la pieza** (Knowledge): `Relations.CreateCheck(nombre, "", "Pared >= 2mm")` y se lee
  `Diagnosis` (True/False); probado en las dos direcciones.
- **Plano para el taller con cotas reales: se acota el CROQUIS** y `hoja.GenerateDimensions()` las pasa al plano (placa con
  dos agujeros: 8 cotas en la vista de arriba y el espesor en el corte). `CreateClosedCircle` no trae punto centro: se crea
  `CreatePoint` y `circulo.CenterPoint = punto`. Corte: `DefineSectionView([x1, y1, x2, y2], "SectionView" | "SectionCut",
  "Offset", 1, gb_padre)` con el perfil en coordenadas de la PIEZA (con otras no da error: corta por otro lado).
- **Plano automático de cualquier STEP** (`scripts/catia/plano_de_step.py <step> <salida.pdf> [--titulo]`): A3 con vistas
  superior, frente, lateral e isométrica, escala normalizada elegida para que entre (v16 1:1, panel del cliente 1:2), marco
  y cajetín con la caja MEDIDA con build123d (no pone cotas que no salen de un croquis). ~30 s con la CATIA abierta.
- **Familia de piezas por tabla de diseño**: `Relations.CreateDesignTable(nombre, "", False, ruta.txt)` (tabulado) +
  `AddAssociation(part.Parameters.Item("Largo"), "Largo")` + `Configuration = n`: tres tamaños exactos. Encabezado SIN
  unidad = valores en METROS (con «(mm)» la asociación falla): 100 mm se escribe 0,1.

## Receta: cómo encarar un dispositivo EN CATIA con `scripts/catia/` (19/10)

1. **Datos primero, fuera del repo**: copiar a la carpeta de trabajo (`CATIA_TRABAJO`) los STEP y JSON que hacen falta; de
   la carpeta de Fak o de `_utrim` solo se lee. Nada se inventa: cada cota sale de un archivo medido o de Fak.
2. **Un script por pieza con `catia_base.correr(nombre, cuerpo, fresca=True)`**: CATIA propia recién abierta, vigía de
   cuadros, registro por paso. Cada paso mide lo que hizo (`medir`) contra su cuenta; un sentido (extrusión, corte,
   desplazamiento) se decide por lo que SUMA o SACA, no por el centro de gravedad de un cuerpo que ya tiene otra cosa.
3. **Croquis acotados** (contar grados de libertad), con los ejes del plano medidos (XY: H→X; YZ: H→Y; ZX: H→Z, V→X):
   así el plano sale con cotas solo.
4. **Caras y aristas por posición** (`topologia`, `aristas_con_extremos`), nunca por nombre interno; buscar en la
   operación que las creó, no en el cuerpo entero (con piezas de cientos de lados tarda minutos).
5. **Todo en el cuerpo principal**: sumar un cuerpo grande con `AddNewAdd` puede dejar la sesión rota. Superficies de
   construcción en un set aparte, OCULTAS antes de exportar.
6. **Contra la pieza del cliente**: pegarla como cuerpo (`Copy` + `PasteSpecial("CATPrtResultWithOutLink")`) y usar
   `AddNewRemove` (huella) o `AddNewIntersect` (choque exacto, con su gemelo corrido como control). El choque de CATIA
   (`Clashes`) NO decide décimas. **Una luz contra la pieza del cliente** (19/10, ej25): ni OpenCASCADE ni el Offset
   pelado de CATIA desplazan un panel de 1 309 caras; con `HybridShapeOffset.SuppressMode = 2` sí (piel por `Extract`
   con `PropagationType = 1`, luz medida 0,492 a 0,5 en las caras), pero le quedan agujeros: no cierra, y el nido que
   corta con ella dio distancia 0 y gemelo sin choque. **Sin verificar: no usarlo para un entregable todavía.**
7. **Verificar con otro motor antes de mostrar**: `compara.py` contra la referencia (sobra / falta / distancia, no ciego) o
   `choque_exacto.py`; STEP con 1 sólido y 1 cáscara; STL cerrado con el volumen del B-Rep.
8. **Plano**: `plano_de_step.py` para el general; cortes y cotas desde el croquis (`DefineSectionView`, `GenerateDimensions`).
9. **Al terminar**: cerrar la CATIA propia (`apagar`) para que no le quede abierta a Fak.
