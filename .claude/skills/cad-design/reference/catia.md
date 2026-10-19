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
   cuadros, registro por paso (con `fresca=True` se NIEGA a reiniciar si en la CATIA propia hay un documento que no es
   del ejercicio). Cada paso mide lo que hizo (`medir`) contra su cuenta; el sentido de una extrusión o un corte se
   decide por el centro de gravedad de LO AGREGADO contra el plano (`croquis.centro_agregado`), no por el del cuerpo
   entero; «suma más» (`elegir_sentido`) solo cuando el lado malo se mete en material (ver la sección del 19/10 de día).
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
   con `PropagationType = 1`; luz mínima medida 0,492, mediana 0,5 y hasta 0,86 en aristas vivas), pero le quedan
   agujeros: no cierra, y el nido que corta con ella toca el panel (distancia 0, `choque_exacto.py` → «toca»). **Sin verificar: no usarlo para un entregable todavía.**
7. **Verificar con otro motor antes de mostrar**: `compara.py` contra la referencia (sobra / falta / distancia, no ciego) o
   `choque_exacto.py`; STEP con 1 sólido y 1 cáscara; STL cerrado con el volumen del B-Rep.
8. **Plano**: `plano_de_step.py` para el general; cortes y cotas desde el croquis (`DefineSectionView`, `GenerateDimensions`).
9. **Al terminar**: cerrar la CATIA propia (`apagar`) para que no le quede abierta a Fak.

## 19/10/2026 (de día) — ejercicios REALES con respuesta publicada, pieza paramétrica y Fak mirando

Pedido de Fak: *"que practique con ejercicios reales de catia... que vayas avanzando de nivel"*. Cada pieza se hizo en
CATIA y se comparó contra la respuesta PUBLICADA y contra un gemelo en build123d (volumen siempre; forma con `compara.py`
en ej26 —sobra 0, falta 0, 0,005 mm— y ej29 —0,021 mm—; el gemelo de ej30 no tiene el R1 y el de ej31 no ubica las
puntas, así que ahí solo volumen).

| Ejercicio | Qué practica | CATIA contra la respuesta |
|---|---|---|
| CSWP Sample Exam 2 de SolidWorks (U. de Alberta), etapa 1, 3 juegos de parámetros | Part Design con croquis acotado contra ejes y fórmulas (A..E, X = A/3, Y = B/3 + 10) | 14 207,34 / 16 490,47 / 15 100,46 g contra ,34 / ,45 / ,47 |
| Mismo examen, etapa 2 (preguntas 4 y 5) | Modificar: sacar un bloque, bolsillo nuevo, garganta en un cilindro | 13 206,39 / 14 208,00 contra ,40 / ,00 |
| Too Tall Toby 01-05 Paste Sleeve | Superficies: loft de dos ranuras, tapas, Join, CloseSurface; hueco como 2.º cuerpo + Remove | 56,73 g contra 57,08 ± 1 |
| Too Tall Toby 01-02 Post Cap | Revolución con cuarto de elipse, asa con Rib, Groove con desmolde 4°, R1 de encuentro | 43,09 = 43,09 |
| Too Tall Toby 01-10 Light Cap | Sección de pared extruida simétrica + revoluciones de 180° | 211,30 = 211,30 |

Fuentes de ejercicios con respuesta: el PDF del CSWP (Univ. de Alberta) y los 13 planos de Too Tall Toby de la guía de
build123d (https://build123d.readthedocs.io/en/stable/tttt.html, libres para uso educativo; se miran en el navegador).

**Pieza paramétrica (`scripts/catia/croquis.py`):** `Croquis(part, body, plano, nombre).perfil(pts, arcos)`, `.hv()`,
`.a_eje_V(obj, "B - C + 7.5mm")`, `.a_eje_H(...)`, `.radio(arco, "C - 80mm")`, `.cerrar()`; parámetros con
`part.Parameters.CreateDimension("A", "LENGTH", 213)` y fórmulas con `part.Relations.CreateFormula`; los largos de pad
y pocket (`FirstLimit.Dimension`) y los offsets de plano (`plane.Offset`) también llevan fórmula. Cambiando SOLO los
parámetros los dos modelos dieron las 5 respuestas del examen (ej27 las 3 de la etapa 1, ej28 las 2 de la etapa 2). Las constantes de una fórmula llevan unidad («69mm»). Los
redondeos y chaflanes elegidos por posición sobreviven al cambio de parámetros.

**Lo que costó un intento (y su control):**
- **Un pad o una revolución puede crecer para el lado equivocado SIN error** (los dos cilindros del CSWP salieron para
  afuera). `centro_agregado(m0, m1)` dice hacia dónde creció y es el control GENERAL (el lado del plano del croquis).
  `elegir_sentido(...)` prueba las DOS orientaciones y deja la que suma más, y SOLO sirve cuando el lado malo se mete en
  material (la revolución de 180° hacia adentro del Light Cap: 18 998 contra 41 620; un umbral fijo no la separaba).
  **Cuando el lado malo da al aire suma MÁS** (los cilindros del CSWP: 514 695 al aire contra 460 829 hacia el muro): ahí
  `elegir_sentido` elige mal; se usa `centro_agregado` (auditor Opus, 19/10).
- **Shell que no abre una base partida en varias caras** (pad + 2 revoluciones = 3 caras abajo): con una anda, con las
  tres falla en cualquier orden. Se rodea dibujando la SECCIÓN DE PARED y extruyéndola / revolucionándola.
- **Garganta en un cilindro apoyado en un muro: Shaft del perfil escalonado**, no Pad + Groove (el Groove corta el muro).
- Arcos de 180° justos: ángulos explícitos (`ranura()`); `angulos_arco` rechaza el caso ambiguo.
- Elipse en un croquis: `CreateEllipse(cH, cV, ejeMayorH, ejeMayorV, Rmayor, Rmenor, t0, t1)`; t se mide desde el eje
  mayor y el menor está a +90°. Chaflán: `AddNewChamfer(ref, 0, modo, 0, L1, L2oAngulo)`, modo 0 = dos largos,
  1 = largo + ángulo. Agujero con caja que tiene que seguir a un parámetro: dos vaciados acotados (el Hole queda clavado
  en la coordenada).
- **Leer el plano es el cuello de botella, no CATIA.** Cuatro malas lecturas en cinco ejercicios, cazadas comparando
  contra la respuesta: un radio que dependía de un parámetro y lo tomé fijo; un R15 que era de otra esquina; un fondo
  RECTO que leí como arco; una RANURA que leí como elipse. Con varios juegos de parámetros, la forma de la diferencia
  señala la causa: cambia de signo → una medida que depende de un parámetro; constante → un detalle fijo; proporcional
  entre dos casos → una sola causa que crece con ese parámetro.
- **Ningún número de enumeración de memoria**: `ActiveWindow.Layout = 0` deja SOLO el árbol (Fak vio la pantalla en
  blanco); 2 = árbol + pieza, 1 = solo la pieza. `enums.py <nombre>` lo lee en un segundo.

**Para que Fak mire:** `CATIA_MIRAR=1` arranca la CATIA propia visible y deja la última pieza abierta;
`CATIA_MIRAR=lento` (+ `CATIA_PAUSA=3`) encuadra y espera después de cada paso para que se vea crecer la pieza. La
ventana queda DETRÁS de lo que Fak tenga adelante (Windows no deja pasar al frente solo): se le dice que toque «CATIA V5»
en la barra de tareas. Con su propia CATIA abierta, la base no se engancha (no es «la mía»). **Qué se cierra**: solo
lo del ejercicio (nunca guardado, o guardado en la carpeta de trabajo); un documento que Fak abra desde otro lado en la
CATIA propia queda abierto y sale un AVISO (`cerrar_del_ejercicio`, probado en `test_correr_mirar.py`). Límite: un
archivo DE la carpeta de trabajo que Fak abra ahí se toma como del ejercicio.
- **`body.HybridShapes` también lista operaciones** (EdgeFillet, CircPattern) además de puntos y líneas: ocultar «todos»
  ocultó la pieza (captura vacía y la ventana de Fak en blanco, ej32). Se oculta SOLO el objeto que el programa creó.

## 19/10/2026 (tarde) — los 10 de Too Tall Toby, ensambles, plano, mecanismo y reparar superficies

| Ejercicio | Qué practica | CATIA contra la respuesta |
|---|---|---|
| TTT 01-07 Flanged Hub | Shaft escalonado, Stiffener + CircPattern ×3, agujero con caja ×6 | 373,51 g contra 372,99 ± 1 (nervio de 20° leído parejo: dicho como lectura dudosa) |
| TTT 01-03 C Clamp Base | `croquis.dibujar` + avellanado (`Type 3`, `HeadAngle 90`) | 96,13 = 96,13 |
| TTT 01-04 Angle Bracket | R4 corrido entero con el brazo ancho y recortado después | 310,00 = 310,00 |
| TTT 01-08 Tie Plate | Oreja + `AddNewMirror` ANTES de la placa (los recortes no le comen la placa) | 3 387,06 = 3 387,06 |
| TTT 01-06 Bearing Jig | Perfil con tangencias desde build123d (`de_build123d.py`) + Intersect | 328,02 = 328,02 |
| TTT 01-01 Bearing Bracket | Punta en dos arcos de 90, cola de milano | 797,15 = 797,15 |
| TTT 23-T-24 Curved Support | Tangencias encadenadas resueltas en Python | 1 295,68 contra 1 294 ± 3 |
| TTT 24-SPO-06 Buffer Stand | En PULGADAS (×25,4 en cada número) | 3,9327 lb contra 3,923 ± 0,02 |
| TTT 01-09 Corner Tie | Pestaña inclinada armada plana + `AddNewRotate2` + Split | 307,23 = 307,23 |
| Ensamble bracket + eje | Dos coincidencias PUNTO-PUNTO (una de rectas puede salir invertida); cdg con `Analyze.GetGravityCenter` por VBScript | cdg = gemelo al milésimo |
| Ensamble con luz 0,1 | El choque de CATIA dice «contacto 0,0» con 0,1 de luz | luz 0,1000 medida afuera (abajo) |
| Resorte | `AddNewHelix` + `AddNewPlaneNormal` + `AddNewRibFromRef` (sin croquis) | a 0,0003 % de π·r²·largo |
| Tabla de diseño del CSWP | `CreateDesignTable` + `AddAssociation`, tabla en METROS | las 3 respuestas oficiales |
| Biela-manivela (DMU Kinematics) | 3 revoluciones + 1 prismática + comando de ángulo, todo en UNA macro VBScript | x de la corredera con diferencia 0,0000 en 6 ángulos |

**Herramientas nuevas (`scripts/catia/`, prueba sin CATIA `test_herramientas_tarde.py`, cada caso visto en rojo):**
- `de_build123d.py <modulo> <funcion> <carpeta>` / `tramos(cara)`: el contorno de una cara de build123d a tramos de
  `croquis.dibujar`. Arcos de más de 170° se parten en dos (el de 180 es ambiguo) y las puntas se redondean a 6
  decimales (ruido de 1e-7 deja el perfil ABIERTO en CATIA). Para perfiles que salen de una cuenta (tangencias).
- `pantalla.py`: `mover(pid)` lleva la ventana de ESA CATIA a la pantalla que no es la principal y la maximiza; con una
  sola pantalla no hace nada. Lo llama `correr` en modo mirar.
- `acomodar_cotas.py`: `acomodar(c, hoja)` saca las cotas repetidas entre vistas (`Dimensions.Remove`) y separa las que
  se pisan (`GetBoundaryBox` por VBScript, `MoveValue(x, y, 0, 0)`). Las cotas de `GenerateDimensions` son las del
  croquis, no las que pide un taller: esas se acotan a mano (`Dimensions.Add`, pendiente).
- `catia_base.medir()` **se niega con un cuerpo VACÍO** (`ValueError`): medirlo rompía la sesión entera (KeyError en todas
  las mediciones siguientes; pasó dos veces).

**Plano de taller (Drafting):** `DefineFrontView(1,0,0, 0,1,0)`, `DefineProjectionView(gs, n)` (CatProjViewType: derecha 0,
izquierda 1, arriba 2, abajo 3), `DefineSectionView([x1,y1,x2,y2], "SectionView", "Offset", 1, gs)`,
`DefineIsometricView(...)`, `GenerateDimensions()`, `ExportData(ruta, "pdf")`. Tolerancias:
`SetTolerances(1, "TOL_NUM2", "", "", 0.1, -0.1, 0)` sale «213 ±0,1»; un H7 va sobre un DIÁMETRO y `DimType` es de solo
lectura (un R no se pasa a Ø por programa).

**Reparar superficies (lo que va a pedir Paulo):**
- Cara perdida: `AddNewBoundaryOfSurface` → `AddNewNear(borde, punto)` para separar los lazos → Fill SOLO del contorno de
  afuera → `AddNewHybridSplit(tapa, boca, lado)` → Join con `SetDeviation(0.01)` → `CloseSurface`.
  **Un Fill con los dos lazos TAPA el agujero y el volumen no lo ve** (membrana de espesor cero): el control de una
  reparación es VOLUMEN Y ÁREA.
- Rendijas entre caras: el Join de fábrica falla; con `SetDeviation` apenas mayor que la rendija medida (no 0,1 a ciegas:
  pega caras que no van juntas) cierra. Healing también: `AddNewHealing(join)` + `SetMergingDistance(0.1)` (la propiedad
  `MergingDistance` es de solo lectura).

**Trampas nuevas:**
- **`GetMinimumDistance` entre piezas de un ensamble falla por programa** con cualquier referencia. Lo que anda: exportar
  el producto a STEP y medir con OpenCASCADE `BRepExtrema_DistShapeShape` (0,1000 exacto).
- Las listas de referencias (juntas de un mecanismo, `GetGravityCenter`, `Position.Get/SetComponents`) no pasan desde
  Python: van por `SystemService.Evaluate` con una macro VBScript.
- La guía resumida de build123d trajo un dato mal en 4 ejercicios (clip, ranura, punto de tangencia, planta):
  **el plano manda, la guía solo desempata**, y una tangencia se verifica con la geometría.
- En el gemelo: `scale()` de build123d no escala el corrimiento de un `Pos` aplicado a un croquis (el hueco quedó a 4 mm
  en vez de 4 in); `EllipticalCenterArc` con `end_angle` falla sin `angular_direction`. Medir cada parte (volumen + caja)
  ubica el error en un paso.
- Pendiente: la chapa (SM Hanger) no se maneja por COM en R21; se hace como sólido.
