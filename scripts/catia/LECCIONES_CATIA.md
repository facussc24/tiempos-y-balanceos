# Lecciones del banco de CATIA (centralizadas por la PC principal)

Tanda del 24/10/2026: dos sesiones, una por PC (pedido de Fak: *"dejar un opus en cada notobok... cada tanto se curzen
la data y las correcciones no? y centralicen"*). Cada ejercicio de CATA deja su `LECCIONES.md` en su carpeta; la
principal las trae acá cada hora y, si cambian el método, las lleva a la skill `cad-design` (`reference/catia.md`).
Cada lección dice de qué ejercicio y qué PC sale, y cómo se midió. Lo que ya estaba en `catia.md` no se repite.

## Controles: qué mira cada uno y qué NO ve

- **El volumen de CATIA (SPA) no ve un sólido con las caras hacia adentro** (09, principal; NOTAS 19/10 de la práctica:
  la v16 dio el B-Rep bien y el STL 85 849,6 contra 89 278). El control es el **STL que exporta CATIA** (`medir_b123d.py
  stl`, trimesh) y lo juzga `juez_comun.veredicto_stl`: malla cerrada, **orientación de los triángulos consistente** y
  **ningún cuerpo con volumen negativo**. El porcentaje contra el sólido NO separa: la v16 restó −3,84 % y el facetado de
  una pieza chica curva da −1,2 % (13, 24/10 09:31: el 24-gono inscripto, revisor del 13); el 5 % queda solo para errores
  gruesos. Lo encontró el revisor del 09 (ningún control lo veía) y lo corrigió el del 13 (yo había subido el umbral de
  1 % a 5 % con un comentario sin fuente: era aflojar el control). El caso no se reprodujo en CATIA (el 09 sin `Invert`
  dio el mismo STL, 09:48): el detector se prueba con mallas en `tests/test_medir_stl.py`.
- **«El STEP trae 1 sólido» es ciego a las superficies de construcción que quedaron a la vista** (09, revisor): salen
  como cáscaras o caras sueltas y `solids()` sigue dando 1. `medir_b123d.py` ahora informa `cascaras` y `caras_sueltas`;
  el STEP bueno es 1 / 1 / 0.
- **Cuando el lado de una operación de superficie se elige por la medida** (offset, split, thicksurface, empalme), la
  elección sola no prueba nada: se prueban TODOS los lados, cada uno se mide y se borra, y se rehace el que da la
  fórmula; el número del otro lado queda en `salida.json` como gemelo (13: offset hacia adentro 3 204,425, split abajo
  1 256,637, thick hacia adentro 7 162,831; el empalme R5 da error en 3 de sus 4 orientaciones).
- **Un elemento que falla y queda en el árbol rompe cada `Update` siguiente** (13, principal, 09:31): al probar los
  lados, lo creado se borra SIEMPRE, también cuando la medición o el `Update` fallaron. La primera versión lo borraba
  solo si había medido, y las cuatro orientaciones del empalme dieron error (en la práctica del 19/10, una daba bien).
- **Contar grados de libertad no alcanza para saber si un croquis está bien restringido** (11, revisor): sacar una
  restricción y repetir otra da el mismo conteo. Lo que lo prueba es el rango de la jacobiana (40 de 40 en el Tool Block)
  y simular el solver: llevar la q3 a la q4 por Newton con las fórmulas y ver que da la geometría del plano
  (`tests/test_tool_block_parametrico_11.py`). La tangencia se escribe en el vértice común (radio perpendicular a la recta;
  centros alineados con el contacto): «distancia = radio» tiene raíz doble y le quita rango (37 en vez de 40).
- `Status` de una restricción de CATIA = 0 dice «satisfecha», no «iso-restringida»: un croquis con grados libres también
  da todo en 0 (11, revisor; la interfaz `Sketch` no expone el estado del solver por COM).

## Part Design y Knowledgeware

- **Un croquis totalmente restringido con tangencias, puntos sobre rectas, ángulo y fórmulas anda por COM en R21, al
  primer intento** (11, principal, 09:08): dibujar con las coordenadas exactas, crear cada restricción (CATIA le pone el
  valor que mide sobre lo dibujado; se relee contra el plano) y poner fórmula solo en las que dependen de A y B. Cambiar
  `Parameters.Item(k).Value` + `Update` regeneró la q4 a 0,000 mm³ de build123d.
- **Plano paralelo a YZ con `AddNewPlaneOffset(PlaneYZ, x, False)` queda en +x**, y en su croquis H es Y y V es Z, como
  en el YZ de origen (08, CATA; medido con `Measurable.GetPlane`).
- **La posición de un plano se lee antes de dibujar en él**: `GetPlane` devuelve 9 valores (origen y dos direcciones) y
  sale solo por VBScript (`cb.evaluar`), como `GetCOG` (08, CATA). Más directo que deducir el sentido por el volumen de
  una extrusión simétrica, que `juez_comun.extruir` controla solo por volumen.
- **La densidad de un material del catálogo se cambia por programa**: el parámetro
  `<pieza>\<Material>\<Material>.1\Density` (en `part.Parameters`, buscando «densit» y el nombre del material) acepta
  `.Value = 2700` en kg/m³ y `Inertias` lo toma después de `Update` (08, CATA: Aluminium del catálogo 2 710 → 2 700 del
  rótulo; masa / volumen = 2 700,001). La masa sale de CATIA con la densidad del plano, no de una cuenta afuera.
- **El avellanado del ej33 anda igual en la R21 de CATA**: `AddNewHoleFromPoint` sobre la cara elegida por topología,
  `Type 3`, `CounterSunkMode 0`, `HeadDepth`, `HeadAngle 90`, `BottomLimit.LimitMode 2` (08, CATA).
- **Los radios de un perfil como arcos del croquis, no como redondeos por COM**: con el sentido de cada arco elegido por
  su punto medio, la mano del croquis ZX (H→Z, V→X) no importa (08, CATA).

- **El centro de algo chico agregado a algo grande no sale de `catia_base.medir`** (10, CATA): `medir` redondea el cdg a
  0,001 mm y el centro de lo agregado sale de restar dos centros: el error llega a (v0 + v1) × 0,0005 / dv = 0,38 mm con
  588 mm³ sobre 226 000. Para un control de centésimas, el cdg con todos los decimales (`GetCOG` por VBScript).
- **Plano por ecuación** (`AddNewPlaneEquation(a, b, c, d)`): `GetPlane` da el origen en el pie de la perpendicular desde
  el origen y H = dirección 1, V = dirección 2 también en un plano que no es de origen (10, CATA).
- **Un nervio en CUÑA no sale con Stiffener** (espesor parejo: el ej32 dio 373,51 g por eso): prisma (trapecio en un plano
  normal al filo) + pad simétrico + patrón circular (10, CATA). Y **el orden ahorra booleanos**: exterior sin el rebaje,
  nervios, y recién después el Groove del rebaje, que se lleva lo que caía en el hueco.
- **Shaft y Groove con el perfil apoyado en el eje y la CenterLine encima**: CATIA toma la CenterLine como eje aunque se
  pise con un lado del perfil (10, CATA).
- **Un juez de mutantes pide tres cosas** (12, CATA): que CATIA reproduzca el modelo malo (cruce con el `mal_*.py`, los
  TRES: `juez_comun.comparar` mira solo las partes que midió build123d, revisor), que el control dé ROJO contra el papel y
  que la masa sea la del mutante. Solo «rojo» no alcanza: una pieza rota cualquiera también da rojo.
- **Un ejercicio de otro se reusa importándolo** (`importlib`): el 12 importa el 07 entero y decide qué operación saltea;
  el 11 y el 15 hacen lo mismo con el 07 y el 11.
- **El control de Knowledgeware va sobre un parámetro PROPIO que mueve la geometría** (14, CATA): `Radio` → los dos
  redondeos, `Luz` → las cotas del croquis; el cruce de volumen de cada variante prueba que lo mueve. Las expresiones
  aceptan `and` (`Luz >= 0.1mm and Luz <= 0.4mm`) y las constantes llevan unidad.
- **«Sin radio» es APAGAR el redondeo**: el parámetro `...\EdgeFillet.1\Activity` atado por fórmula a un booleano propio
  (`CreateBoolean("Redondeado", True)`), y el control lo nombra (`Radio >= 1.5mm and Redondeado == true`). Con
  `part.Inactivate` a mano, el control que mira solo `Radio` queda verde con la pieza mal (14, CATA, gemelo en la prueba).
- **Una pieza que no es de revolución necesita una tercera restricción para fijar el giro, y su ORIENTACIÓN decide la
  pose** (16, CATA): dos puntos sobre el eje + paralelismo de planos (`AddBiEltCst(8, ...)`) con `.Orientation = 0`; con 1,
  la barra queda hacia −X (gemelo medido en la misma corrida). Las piezas se dibujan en su propio sistema y entran al
  ensamble en el origen: si se dibujan ya en su lugar, el ensamble no prueba nada.
- **`Position.GetComponents`** (por VBScript): los 12 números son X, Y y Z de la pieza en el ensamble y al final su
  origen; un punto p va a `o + p.x X + p.y Y + p.z Z` (16, CATA, medido; el 17 lo usa para mover la palanca en
  OpenCASCADE).

## DMU Kinematics (17, principal)

- **`NbDof` cuenta el grado libre que mueve el comando**: un mecanismo de una revolución y un comando da «1;1;1» y se
  simula (la biela del ej49 dio «1;4;1»). Esperar 0 fue un error mío (primera corrida, 10:15).
- **El signo del comando sale de la regla de la mano derecha, no de un capricho de CATIA** (revisor del 17): el «Eje» de
  las piezas va de y −40 a +40 (hacia +Y) y el banco gira alrededor de −Y, así que el comando que levanta la palanca es
  el negativo. Se mide en la primera pose NO nula y se EXIGE −1 (otro signo con la punta bien sería otro mecanismo); con
  él la punta cayó a 0,000 mm de la trigonometría en 0, 35, 50 y 60°. `NbDof` se anota y no frena (sin doc).
- **Choques y luces de un mecanismo: OpenCASCADE sobre los STEP de CATIA movidos con la `Position` del mecanismo**
  (`medir_choques.py`). Con build123d 0.11 un `Location` no se arma desde una `Matrix`: va por `gp_Trsf.SetValues` +
  `TopLoc_Location`. La luz se mide contra lo mismo que mide el banco: la del 06 no incluye el soporte del eje (a 2 mm
  de la palanca en toda pose); con el soporte adentro, la luz del mal_2 daba 2 en vez de 15.

## Planos (15, principal)

- `DefinePolygonalClippingView(perfil)` y `DefineBreakout(perfil, plano1, plano2)` (ayuda de automatización,
  `DrawingViewGenerativeBehavior`) son las respuestas b y c de las preguntas 1 y 2 del examen. **Que no tiren error no
  prueba que hagan algo** (revisor del 15): el control mide el PDF con pymupdf (`medir_plano.py`: el ancho del recorte, los
  trazos del rayado del arranque, el texto de cada cota).
- `GenerateDimensions` trae las cotas que se apoyan en geometría (radios, largo del pad); las distancias a los ejes del
  croquis NO (medido una vez, 10:05); un ángulo contra el eje del croquis sale con su línea cruzando la hoja y sin texto
  legible: se borra. `GetValue().Value` de un ángulo viene en RADIANES.

## Superficies (GSD)

- **Loft desde Python con `AddSectionToLoft(ref, 1, None)` anda con croquis como secciones** (09: igual que el ej29);
  con círculos de GSD hizo falta la macro VBScript (ej51 y 13). El camino de reserva por macro tiene que borrar antes un
  loft que quedó agregado y roto.
- **Loft vértice a vértice (`SectionCoupling = 4`) entre dos oblongas = el `loft(ruled=True)` de build123d** (09: 0,004 mm³
  sobre 55 617): la sección a cualquier altura es otra oblonga con largo y ancho interpolados, y Simpson da el volumen
  exacto. El área total de la piel coincide a 3e-8.
- **Media esfera y toro por revolución salen exactos** (13, nuevos): un cuarto de circunferencia en el plano ZX girado
  360° alrededor de un eje Z da 2πR² a 5e-8; una circunferencia entera, 4π²Rr a 6e-8.

## Juez y proceso

- `juez_comun.correr_ejercicio(..., con_bien=False)` (13): para un ejercicio cuya respuesta es una fórmula y no tiene
  `bien.py` en el banco 3D; no mide build123d ni compara, y el post-proceso del ejercicio decide. El STEP de CATIA se mide
  igual.
- La captura BMP muestra los planos de origen del documento (08, CATA): el STEP no los lleva, pero si la imagen va a un
  entregable, ocultar también `OriginElements`.
- Dos PC escribiendo el mismo archivo de la nube en el mismo minuto: OneDrive arma una copia con el nombre de la PC
  (`PREGUNTAS_FAK-DESKTOP-14JG95B.md`, 24/10 08:50). Cada PC escribe en su archivo, o agrega con una edición corta.

## Tiempos medidos (24/10/2026)

| Ejercicio | PC | CATIA | Total | Pasos |
|---|---|---|---:|---:|
| 08 C Clamp Base | CATA, R21 | arranque 8,9 s, conectó a 17,9 s | 30,0 s | 9 |
| 09 Paste Sleeve GSD | principal, R21 | build123d 47 s | 164 s | 19 |
| 11 Tool Block paramétrico | principal, R21 | | 72 s | 10 |
| 13 superficies exactas | principal, R21 | | 83 s | 22 |
