# CATIA V5 R21 por programa — qué anda en esta PC, cómo se corre y dónde se equivoca

Medido el 17/10/2026 (tanda 11) sobre lo probado el 10/10 y el 13/10 (memoria `reference_catia_por_com`; evidencia en
`.sgc-cache/investigacion-2026-10-11/catia/`, `.sgc-cache/catia-2026-10-13/` y `.sgc-cache/catia-2026-10-17/`).
Licencia: la confirmó Fak el 13/10 (*«la licencia es oficial»*); no se vuelve a preguntar.

**Antes de investigar algo de CATIA afuera (foros, agentes, la ayuda), se busca ADENTRO**: `grep -ri "<tema>"` en esta
página, en `C:\Dev\_catia_practica\NOTAS.md` y en los `ej*.py` de la práctica. El 19/10 de tarde se lanzó un equipo de
4 agentes para «poner material por COM» y la respuesta (`CATMatManagerVBExt`, simulación a 0,7977) estaba desde esa
madrugada en el ej12 y en la tabla de abajo.

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
  `croquis.dibujar`. Cada punta sale del VÉRTICE compartido del contorno y después se redondea a 6 decimales (redondear
  `position_at` solo dejaba 14 de 300 perfiles girados ABIERTOS: auditor 19/10); un arco se parte en ceil(ángulo/170)
  tramos (el de 180 es ambiguo; la circunferencia entera va en 3); una cara con agujeros se NIEGA (los agujeros van
  aparte) y la línea de comandos exige UNA cara. Elipses y splines: error «sin traducir». Para perfiles de una cuenta.
- `pantalla.py`: `mover(pid)` lleva la ventana de ESA CATIA a la pantalla que no es la principal y la maximiza; con una
  sola pantalla no hace nada. Lo llama `correr` en modo mirar; corrido a mano sin pid solo mueve la CATIA que es mía
  (`es_mia`: pid + hora de arranque).
- `acomodar_cotas.py`: `acomodar(c, hoja)` separa las cotas que se pisan (`GetBoundaryBox` por VBScript,
  `MoveValue(x, y, 0, 0)`) en todas las vistas y avisa las vistas pedidas que no existen. Sacar repetidas es OPCIONAL
  (`sacar_repetidas=True`): con solo el valor no se sabe si es la misma cota (un ancho 40 en la planta y una profundidad
  40 en el frente son dos), así que saca solo entre vistas DISTINTAS, con el mismo valor y DimType, y devuelve la lista
  de lo sacado para mirarla en el PDF. Las cotas de `GenerateDimensions` son las del croquis, no las que pide un taller.
- `catia_base.medir()` **se niega con un cuerpo VACÍO** (`ValueError`): medirlo rompía la sesión entera (KeyError en todas
  las mediciones siguientes; pasó dos veces).

**Plano de taller (Drafting):** `DefineFrontView(1,0,0, 0,1,0)`, `DefineProjectionView(gs, n)` (CatProjViewType: derecha 0,
izquierda 1, arriba 2, abajo 3), `DefineSectionView([x1,y1,x2,y2], "SectionView", "Offset", 1, gs)`,
`DefineIsometricView(...)`, `GenerateDimensions()`, `ExportData(ruta, "pdf")`. Tolerancias:
`SetTolerances(1, "TOL_NUM2", "", "", 0.1, -0.1, 0)` sale «213 ±0,1»; `DimType` es de solo lectura (un R no se pasa a Ø).
**Cota de diámetro a mano con H7 (ej50, «Ø15H7» en el PDF):** la geometría GENERADA de una vista no se alcanza
(`GeometricElements` trae 1 elemento, `Selection.Search` no encuentra círculos); `DrawingView.Isolate()` la pasa a 2D
propia (41 elementos, círculos con `.Radius`) y `Dimensions.Add(9, [círculo], [0, 0], 0)` por VBScript da el Ø 15,000.
Costo: **la vista aislada ya no sigue a la pieza**. La tolerancia ALFANUMÉRICA no se guarda por programa
(`SetTolerances(2, "TOL_ALPHA1", "H7", ...)` sin error y `GetTolerances` devuelve tipo 0; `TOL_NUM3` tampoco): el H7 va
como texto con `d.GetValue().SetBaultText(1, "", "H7", "", "")`. **Un Set sin error no prueba nada: se relee con el Get.**
Y `ExportData(ruta, "pdf")` con la hoja sin definir (`PaperSize`, `Orientation`) no da error ni crea el archivo.

**Reparar superficies (lo que va a pedir Paulo):**
- Cara perdida: `AddNewBoundaryOfSurface` → `AddNewNear(borde, punto)` para separar los lazos → Fill SOLO del contorno de
  afuera → `AddNewHybridSplit(tapa, boca, lado)` → Join con `SetDeviation(0.01)` → `CloseSurface`.
  **Un Fill con los dos lazos TAPA el agujero y el volumen no lo ve** (membrana de espesor cero): el control de una
  reparación es VOLUMEN Y ÁREA.
- Rendijas de 0,05 entre caras: el Join de fábrica falla; con `SetDeviation(0.1)` cierra (30 075 = respeta la cara
  corrida). Criterio, sin medir: la desviación apenas mayor que la rendija medida, porque una grande puede pegar caras que
  no van juntas. Healing también: `AddNewHealing(join)` + `SetMergingDistance(0.1)` (`MergingDistance` es de solo lectura).
- Cara con la normal dada vuelta: el Join la orienta solo. Cara REPETIDA: el Join falla, y **un Join roto que queda en el
  árbol hace fallar todo `Update` siguiente** (se borra apenas falla); se sacan las repetidas por área + centro (ej53).
- **CloseSurface TAPA SOLA cualquier abertura plana, sin error** (ej53): un agujero de 2 × 2 (Join 6 196) sale 6 200, la
  caja SIN la cara de arriba sale cerrada (30 000) y la placa con un agujero pasante al que le falta la PARED sale MACIZA
  (7 500 en vez de 7 107,301): el agujero desaparece. Antes de cerrar un STEP de cliente se mide su borde libre
  (`AddNewBoundaryOfSurface` + largo) y el volumen se compara contra lo esperado.

**Superficies con respuesta exacta (ej51, ej52; todas a menos de 0,0001 %):** `AddNewRevol(recta, 360, 0, eje)` y
multi-section (`AddNewLoft` + `AddSectionToLoft s, 1, Nothing` en una macro VBScript, que devuelve `lf.Name`) dan el mismo
tronco de cono = π(r1+r2)s; `AddNewFill` + `AddBound` = πr²; Join + `CloseSurface` = πh(r1²+r1r2+r2²)/3; barrido
(`AddNewPlaneNormal(guía, punto)` + círculo + `AddNewSweepExplicit`) = Pappus. Un círculo de GSD va con `SetLimitation(1)`.
`AddNewOffset(sup, 3, orient, 0.01)`, `AddNewThickSurface(sup, lado, 2, 0)`, `AddNewHybridSplit(sup, plano, lado)` y
`AddNewFilletBiTangent(s1, s2, R, o1, o2, 1, 0)`: **el lado no se adivina, se prueba y se elige por la medida** (área,
volumen o cdg contra la cuenta); en el empalme, de las 3 orientaciones probadas, 2 dan error y (−1, 1) da la cuenta (la cuarta no se probó).

**CSWA «Tool Block» etapas 3 y 4 (ej41b): 628,18 y 432,58 g = respuestas, al primer intento** (forma = gemelo, 0,002 mm).
La masa de la etapa 3 NO veía que en el gemelo la ranura estaba a otra altura (`Cylinder(..., align=None)` de build123d
arranca en z 0): una ranura que no se cruza con nada saca lo mismo a cualquier altura. Lo destapó la etapa 4; por eso
además `compara.py`.

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
- Pendiente, sin probar: chapa (Sheet Metal) por COM en R21 (el SM Hanger de Too Tall Toby).

## 19/10/2026 — SIMULACIÓN por elementos finitos (Generative Structural Analysis) por programa: `scripts/catia/fem.py`

**La fuente que lo destrabó: la ayuda OFICIAL instalada**, `B21\intel_a\code\bin\V5Automation.chm` (se descomprime
con `hh.exe -decompile <carpeta corta sin espacios> <copia.chm>`; con una ruta larga no extrae nada y no avisa). Trae
los ejemplos de Dassault en `online\CAAScdAniUseCases\macros\`: CAAAniUserMaterial.CATScript (material),
CAAAniPreproOnProduct.catvbs (análisis desde la pieza, empotramiento, fuerza), CAAAniMeshOctTetra.catvbs (malla).
Antes de buscar en foros, se busca ahí.

- **Material** (`fem.poner_acero`): `part.GetItem("CATMatManagerVBExt")` + `ApplyMaterialOnPart(part, material, 0)`, el
  material del catálogo por índice (`material_catia.material_por_indice`). «CATMatManagerVBA» da «GetItem failed» en
  VBScript, VBA y CATScript, y `PasteSpecial "CATMatLink"` no da error y no aplica nada. El control es la DENSIDAD
  (acero del catálogo 7 860; sin material 1 000). **«Guardar» sobre una copia abierta NO conservó el material**
  (reabierta: 1 000); «Guardar como» a un archivo nuevo, sí. Sin material, la importación falla con el aviso «Material is
  not properly defined».
- **Análisis** (`fem.importar`): `Documents.Add("Analysis")` + `StartWorkbench("GPSCfg")` ANTES de
  `ImportDefineFile(ruta, "CATAnalysisImport", Dim a(0))`; `LinkedDocuments.Item(1)` da la pieza; caso
  (`AnalysisCases.Add`), `RestraintSet` y `LoadSet` (`AnalysisSets.Add(tipo, 0)`), `AddSolution("StaticSet")`; caras por
  topología → `part.CreateReferenceFromName`; `SAMClamp` y `SAMDistributedForce` con `AddSupportFromProduct`; el vector
  por `BasicComponents.GetItem("SAMForceVector.1")`; `Compute`; `AnalysisImages.Add("Disp_Symbol" |
  "StressVonMises_Iso_Smooth", False, False, True).ExportData(carpeta, nombre, "txt")` → `fem.leer_export` (coma decimal,
  exponente «e-005»; desplazamiento en mm, Von Mises en N/m²).
- **Caso de respuesta conocida (ej57)**: viga de acero 200 × 20 × 10 en voladizo con 100 N en la punta: la cuenta
  (Euler-Bernoulli + corte) da 0,8015 mm. **La malla POR DEFECTO es LINEAL y da 0,273 mm: −66 %, sin ningún aviso.**
  Con `SetGlobalSpecification("ElementOrder", "Parabolic")` y `("SizeValue", tam)`: 10 mm −0,90 %, 5 mm −0,64 %, 2,5 mm
  −0,55 % (converge; el resto es el empotramiento de la cara entera). **Una simulación sin malla parabólica y sin estudio
  de convergencia no se cree.** En una chapa de 4: elementos de 2 mm o menos (dos o más en el espesor).
- **La fuerza distribuida sobre VARIAS caras es el TOTAL repartido** (ej59, medido): 100 N sobre las dos mitades de la
  punta (una ranura de 0,2 × 1 mm la parte) = 0,79707 mm, igual que en una sola cara; sumando por cara sería 1,594.
  Ojo al armar esa prueba: dos pads pegados FUNDEN su cara de punta en una sola; se cuenta cuántas caras hay y su área.
- **Pieza de verdad (ej58)**: el soporte de chapa del ej54, fijo en los pies y con 500 N en los dos Ø10 de las orejas:
  flecha máxima 0,126 / 0,1306 / 0,1315 mm y Von Mises máximo 139,8 / 132,7 / 132,6 MPa con malla parabólica de 4 / 2 /
  1,5 mm (converge; el máximo está en la unión de la oreja con la placa, sobre el doblez con radio), contra 250 MPa de
  fluencia del acero del catálogo: margen 1,9. Tardó ~35 min las tres mallas: la convergencia se corre sin mostrar y la
  FOTO con la malla gruesa (con 150 000 nodos CATIA dibujó triángulos sueltos y la pantalla quedó gris un rato largo).
- **Regla práctica (no medida acá): el máximo de tensión puede estar en un canto vivo** (borde del empotramiento, de un agujero): ahí sube al achicar la
  malla y no es real. Antes de compararlo con la fluencia se mira DÓNDE está y si converge.
- **Frecuencias naturales (ej60)**: `fem.importar(c, ruta, "FrequencySet")` (sin cargas: `fuerza` se niega), empotrar,
  malla parabólica y `est.frecuencias(carpeta)` → [(modo, Hz)]. Lo probado sin encontrar el valor: el txt exportado de
  cada modo (los 3 distintos, ninguno con «Hz»), `Parameters.SubList(solución)` (0 ítems; sin control positivo) y las
  «salidas» de la solución (vacías: no se creó ningún sensor). Sale del INFORME oficial (`PostManager
  .AddExistingCaseForReport` + `BuildReport`, ejemplo CAAAniPostProBasicReport), tabla «Mode number / Frequency Hz».
  Viga del ej57 empotrada, malla de 5 mm: 204,19 / 405,47 / 1 265,3 Hz contra la cuenta de voladizo 203,71 / 407,43 /
  1 276,7 (+0,24 / −0,48 / −0,9 %); el informe trae también la masa (0,3144 kg). Un sensor `SAMGlobalSensor` existe
  pero la ayuda no da el texto de `SetIdentifier`: no se adivinó.
- **Material propio (PLA, ej61-62)**: el catálogo no trae PLA. `fem.poner_acero` y después `fem.material_propio(part, E,
  densidad, poisson=None)` cambia los parámetros del material aplicado (buscados por palabra en el nombre completo
  «…\Steel.1\Young Modulus»). Medido: E a la mitad → flecha doble exacta (1,59414 contra 0,79707); viga en PLA Basic
  (TDS Bambu V3.0 en `4- MANUALES\IMPRESORA 3D BAMBU LAB A2L\`: E X-Y 2 580 MPa, Z 2 060, densidad 1,24 g/cm³) con 1 N:
  0,61788 mm contra 0,6213 de la cuenta con corte (−0,56 %, igual que el acero con la misma malla: es el mismo resultado
  escalado por E, no una validación aparte). La TDS no trae Poisson: 0,266 → 0,36 mueve la flecha 0,47 %. El material
  sigue LLAMÁNDOSE «Steel» en el árbol: antes de entregar una pieza, renombrarlo o decirlo. **Y la FLUENCIA queda la del
  acero (250 MPa)**: no entra en el cálculo, pero un margen contra ella sería falso (30 MPa en PLA: 8,3 contra 250, 1,2
  contra 35). Para el PLA se compara contra la tracción de la TDS (35 X-Y / 31 Z MPa); la TDS no da fluencia.

## 19/10/2026 (noche) — plano de despiece para el herrero (ej66, carro de tubo del ej65)

- **La lista de cortes sale del MODELO, no se tipea**: un cuerpo por barra, largo = volumen / sección (224 mm² del tubo
  30 × 30 × 2), contado con `Counter`. En el plano va como texto del cajetín y se controla **leyendo el PDF de vuelta**
  (`pymupdf`, renglones «4 x 1000 mm»).
- **Que una vista no pise el cajetín se mide**: `DrawingView.Size b` llena (xmin, xmax, ymin, ymax) en mm de hoja, pero
  el arreglo por referencia no vuelve desde Python (TypeError de SAFEARRAY): va en una macro VBScript que devuelve texto
  (`evaluar`). El primer plano tenía la isométrica encima de la lista y el texto pasado del margen; con la caja de cada
  vista contra el cajetín el programa frena en vez de entregarlo.
- **Cotas generales a mano en una vista**: `v.Activate` ANTES de `v.Factory2D.CreatePoint` (sin activar: «The method
  CreatePoint failed»), puntos en coordenadas de la vista (= mm del modelo), `v.Dimensions.Add2(0, Array(p1,p2),
  Array(x1,y1,x2,y2), Nothing, angulo)` (0 horizontal, 90 vertical), `d.MoveValue dx, dy, 0, 0` para correr el texto y
  `d.GetValue.Value` para leer lo que midió CATIA. **Límite**: la cota va entre puntos que puse yo, no sigue al 3D si el
  carro cambia (la geometría generada no se alcanza por COM, ver «Cota de diámetro a mano»). Para una cota que siga a la
  pieza: **`DrawingSheet.GenerateDimensions()`** (probado en ej70: bloque con pad 50 → cota 50; pad a 65 → la cota
  GENERADA pasa a 65 y la de a mano sigue en 50). Saca solo lo que la pieza tiene como parámetro o restricción (el
  largo del pad; las líneas sueltas del croquis no). **Y no sigue con `Sheet.Update()` solo**: hace falta
  `GenerativeBehavior.Update()` de CADA vista (sin eso quedó en 50). Para el carro: las medidas generales tienen que
  existir como parámetros/restricciones en el modelo para que el plano las genere. `Add2` de distancia entre dos
  puntos en vertical va con ángulo 90: con 0 mide la distancia horizontal (0) y falla «The method Add2 failed».
- Script de práctica: `C:\Dev\_catia_practica\ej66_plano_despiece.py` (fuera del repo).
- **Cotas generadas encima de la geometría → `acomodar_cotas.sacar_afuera(c, vista, contorno)`** (ej66c, 19/10): las
  cajas de las cotas (`GetBoundaryBox`) vienen en coordenadas de la VISTA, o sea mm del modelo en los ejes H/V de la
  vista (el 1000 del carro: y 12-35 sobre la barra 0-30), mientras `Size` da mm de HOJA y su centro es `v.X, v.Y`. Por
  eso el contorno lo pasa el que llama (la caja del modelo proyectada en H/V). Horizontal → arriba/abajo según la mitad,
  vertical → izquierda/derecha, escalonadas de a 8 mm de hoja. En el frente del carro: 4 movidas con las patas viejas y 3 con las corregidas (log ej66c de las 17:13), 0 adentro. Límite:
  si el VALOR ya cae apenas afuera, la línea de cota sigue pegada al borde (el 540 de la planta). Test con las cajas
  reales y mutante que da rojo (`test_herramientas_tarde.py` 3 ter).
- **Uniones de una estructura → `scripts/uniones.py <conjunto.step>`** (19/10): «0 de solape» no dice «unido». Las patas
  del carro de práctica tocaban el marco por una ARISTA y lo vio Fak. Mide el área de contacto de cada par (corre una
  pieza 0,01 mm en ±X/±Y/±Z) y da ROJO si una pieza no apoya, si hay solape o si el conjunto queda en dos grupos. Carro
  corregido: 12 sólidos, patas 224 mm² arriba y abajo, VERDE. Test con el error real en rojo: `test_uniones.py`.
  **Se corre en toda estructura antes del plano.**
- **¿La pieza sale del molde? → `scripts/contrasalidas.py pieza.step --dir 0,0,1 --particion 0`** (19/10): área que
  TRABA y área de pared sin desmoldeo, por triángulo con la normal hacia afuera; `--corredizo 1,0,0 --zona ...` juzga una
  caja contra un corredizo. Probado: caja recta 1200 mm² sin desmoldeo; con 4° a cada lado, 0; hisopo con mango hueco
  O1 × 10 traba 31,4 mm² (π·d·L) en la punta, y con corredizo en +X sale. Límite: prueba local por normal, no ve sombras.

## 19/10/2026 — REVISAR un STEP de cliente antes de trabajarlo: `scripts/catia/revisar_step.py` (corre en .venv-cad)

`revisar_step.py <archivo.step>` → JSON (código 2 si el archivo no trae ninguna cara: basura NO es «sano»). Cómo se lee:
- **`solido_roto_probable`** (sólidos DECLARADOS en el texto del archivo contra sólidos LEÍDOS) es el aviso que importa
  de un sólido: **el lector convierte un sólido roto en superficies sueltas sin avisar** (auditor 19/10: caja declarada
  sólido con una cara de menos → 0 sólidos y 5 caras sueltas). Por eso «0 bordes abiertos» en un sólido leído no alcanza.
  Las aristas de largo ~0 (polos, costuras colapsadas) son «degeneradas», no agujeros (two_wireless: 44 de 0,0 mm).
- **Superficies sueltas**: se cosen (sin forzar una sola piel) y salen por PEDAZO con sus lazos; además `caras_repetidas`
  y `rendijas_bordes_que_cierran_al_recoser` (recosidas a 0,1 mm, la desviación del Join que cerró las rendijas en ej48).
  **En una piel ABIERTA de un solo pedazo** (un tapizado) un lazo es el contorno y cada lazo de más un hueco, de diseño o
  falla. **En algo que debería ser CERRADO, cualquier lazo es una abertura** (una caja sin tapa da 1 lazo de 160: con la
  regla de la piel se leería «sana»). Una cara dada vuelta NO se detecta: el cosido la endereza.
- Caso real two_wireless.stp (Patagonia, Upper Trim, «DUAL 50W»): sólido declarado 1 = leído 1, 91 765,561 mm³ (CATIA
  91 791,099), 0 abiertos; piel 189 caras, 50 305 mm², 1 pedazo, 3 lazos: 777,8 (contorno) + 116,3 + 116,3 = los dos huecos
  de los cargadores (one_wireless da 777,8 + 116,3: uno solo). 17 s.
- Casos de respuesta conocida (`test_revisar_step.py`, 12): agujero de 2 × 2 → 1 lazo de 8 mm y 0 rendijas; caja con cara
  dada vuelta → 0; rendija de 0,05 (ej48) → 8 bordes que cierran al recoser y la de 0,2 no; cara repetida → 1 repetida,
  2 pedazos; sólido con una cara de menos → `solido_roto_probable`; basura y archivo inexistente → código 2; esfera →
  polos degenerados no cuentan. Ronda 2 del auditor: **una pieza usada dos veces en un ensamble se declara UNA vez y se
  lee dos**, y tapaba a un sólido roto: por eso se comparan los declarados contra las **formas distintas**
  (`formas_distintas`, por `IsPartner`), no contra los leídos (n13). Un hueco (BREP_WITH_VOIDS) con las dos pieles
  abiertas también avisa. Límite conocido: un hueco con solo la piel de AFUERA abierta se lee como sólido válido sin aviso.
- Antes de reparar en CATIA (Join con desviación, Healing, Fill: ver «Reparar superficies») se revisa con esto, y
  después de reparar se vuelve a revisar: CloseSurface tapa sola cualquier abertura plana y no avisa.

## 19/10/2026 (noche) — ensamble que RESUELVE la geometría: bloque en V (ej74, banco E3)

El eje de un cilindro atado por dos restricciones de distancia (= R) a los dos planos del V; la altura la calcula el
solucionador: Ø160 → 113,1371, Ø159,86 → 113,0381, error de posición **0,0990 = publicado** (0,707 × 0,14). Dos trampas:
- **La distancia a un PLANO sigue la NORMAL del plano, no la posición de arranque**: con normales hacia abajo el eje cayó
  a −113 (adentro del bloque) aunque arrancaba en z = 200. Se definen los planos con la normal del lado donde tiene que
  quedar la pieza, y se controla el signo de la posición resuelta.
- **`Move.Apply` con una matriz de VBScript: cargar los 12 valores con `CDbl`** (`For i = 0 To 11: t(i) = CDbl(0)`): con los
  lugares sin cargar (Empty) no mueve y la posición sale con basura de 1e-313. En una corrida además quedó sin resolver.

## 19/10/2026 (noche) — presión y simetría en la simulación (ej75, ajuste por contracción, banco E17)

`Estudio.presion(caras, pa)` (SAMPressure; el valor se busca por el prefijo `SAMPressureMag`: `GetItem("SAMPressureMag.1")`
FALLA aunque la ayuda lo liste así) y `Estudio.deslizar(caras)` (SAMSurfaceSlider = condición de simetría para un cuarto
de pieza). Probado: dos cuartos de anillo de aluminio (40-45 y 45-100, 15 de profundidad), la presión publicada
2,79e7 Pa en el contacto: el de adentro se cierra 0,14704 mm, el de afuera se abre 0,03296, **suma 0,18000 = interferencia**
(α·R·ΔT), igual en toda la profundidad. El anillo fino absorbe el 82 %. Ojo: la fórmula supone el MISMO material en los
dos: un buje de acero en un cuerpo impreso no se calcula con esto (y el plástico fluye con el tiempo).

## 19/10/2026 (noche) — familia de piezas con TABLA DE DISEÑO (ej76)

`part.Relations.CreateDesignTable(nombre, comentario, False, ruta_txt)` con un .txt separado por tabulaciones (encabezado
«Alto (mm)\tProf (mm)», una fila por variante) + `dt.AddAssociation(parametro, "Alto")` + `dt.Configuration = k`. Probado:
4 variantes de un tope, volumen = 40·20·alto − π·25·prof en las cuatro. **Una fila mal cargada (agujero más hondo que el
bloque) arma igual, sin aviso**: la familia lleva un chequeo. **TRAMPA: un `CreateCheck` escrito sobre los nombres
internos de las cotas (`` `PartBody\Pocket.1\...` < `...` ``) dio «cumple» SIEMPRE, también en la fila mala (falla en
silencio)**. Con parámetros PROPIOS (`Parameters.CreateDimension("Alto","LENGTH",v)` + `CreateFormula` hacia la cota +
la tabla asociada al parámetro propio) el chequeo «Prof < Alto» da False justo en la fila mala. Todo chequeo se prueba
con su caso malo antes de creerle.
- **Correcciones del auditor Opus (19/10 noche) a `uniones.py` y `contrasalidas.py`:** (1) un tubo REDONDO acostado sobre
  una placa daba VERDE con 73 mm² (contacto en línea): ahora se hunde la pieza 0,01 y 0,0025 — un contacto de CARA da la
  misma área, uno en LÍNEA la mitad — y la línea va a `solo_linea_o_punto`, sin unión; (2) `contrasalidas` decidía el lado
  de cada triángulo por su centro (prisma de 4° con la partición en z 2: SALE con 239 mm² que traban): ahora PARTE la pieza
  por el plano y juzga cada mitad, sin contar la cara de partición; (3) la normal sale de la superficie real
  (`normal_at`), no del triángulo (una caja con R2 daba TRABA de puro teselado). Tests con los casos del auditor y los
  mutantes que vivían (dos grupos, corredizo al revés, sacar_afuera y deslizar con objetos falsos).
- **Un plano para el herrero pide la POSICIÓN de cada barra que no va en una esquina** (ej79, carro de troqueles, 19/10):
  `GenerateDimensions` da el LARGO de cada barra, no dónde va. El travesaño del medio no tenía ninguna cota que lo ubicara;
  se agregó a mano desde el borde a su cara (L/2 − T/2 = 680). Antes de cerrar un plano: ¿cada pieza tiene largo Y lugar?
- **Redondear TODAS las aristas de una caja de una vez deja esquinas SIN esfera** (ej80, molde de PU, 19/10):
  `AddNewSolidEdgeFilletWithConstantRadius` con las 12 aristas → STEP de 18 caras (6 planos + 12 cilindros), cada esquina
  es la intersección de 3 cilindros: **+0,15 % de volumen y un filo en la esquina** que un molde copia en la pieza.
  En DOS pasos (las 4 verticales; después una horizontal con propagación por tangencia, `1`) da 8 esferas (26 caras) y
  el volumen EXACTO de Steiner (1 129 194,67 = build123d = cuenta). En un molde o una pieza blanda: dos pasos, y se
  controla contando las caras esféricas del STEP.
- **La cáscara (`AddNewShell`) falla si la cara que se saca está rodeada de REDONDEOS tangentes** (ej81, 19/10): con las
  12 aristas redondeadas (en uno o dos pasos), «The method Update failed» con cualquier espesor (2, 1, 0,5), tomando la
  cara del cuerpo o de la extrusión y con cualquier objeto de trabajo. Con solo las 4 verticales redondeadas (los bordes
  de la cara de arriba vivos) anda y da EXACTO: 112 457,6 mm³ = 250×80 con R15 menos 246×76 con R13, por 60 y 58. Orden:
  primero la cáscara, después redondear los bordes de la boca.
- **Molde: DESMOLDEO primero, RADIOS después** (ej82, 19/10). Desmoldeo 4° en los costados y después las verticales R15:
  1 106 821,5 mm³, igual que build123d. Al revés (radios y después desmoldeo de las 8 caras laterales) da +0,26 %: no es un
  error, el redondeo se inclina con el desmoldeo y su radio deja de ser 15 a lo largo del alto. El orden cambia la forma.
- **Espesor sobre una superficie CURVA** (ej83, 19/10): arco por 3 puntos (`AddNewCircle3Points`) R600 × 310, extruido 95,
  `AddNewThickSurface(sup, 0, 3, 0)` → 88 129,12 mm³ = cuenta exacta (R 597 a 600): **el espesor «interno» crece hacia el
  CENTRO de la curva**. Trampa: `SetLimitation(1)` deja el CÍRCULO ENTERO (3 769,9 mm de largo, anillo completo); con 0 o 2
  queda el arco de 310. Se mide el largo de la curva antes de usarla.
