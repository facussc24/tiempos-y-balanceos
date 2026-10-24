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
- **La masa y el volumen no ven DÓNDE está un rasgo que no se cruza con nada; el centro de gravedad sí** (37, principal,
  revisor Sonnet, medido con el gemelo): la ranura del Tool Block corrida de −1 a +12 mm en z da 0,000 mm³ de diferencia,
  y el bolsillo hecho del otro lado también; el centro se mueve 0,028 mm con 0,1 mm de corrimiento (8,24 mm el bolsillo
  espejado). El 37 compara el centro de cada etapa en CATIA y el del STEP contra el gemelo a 0,01 mm. Desde el 24/10
  `juez_comun` guarda en `step_catia_en_build123d` el centro y la topología del STEP que ya medía (antes solo el volumen).
  Mismo hueco en `practica_en_juez.cerrar_con_masa` (25, 27, 29): arreglado el 24/10 (corridas 13:26-13:30) con `gemelo_cdg` (el centro del
  STEP de CATIA contra el del gemelo a 0,01 mm y el STEP 1/1/0). Antes de usarlo se midió que el gemelo y el STEP de CATIA
  están en el mismo marco (coinciden a 1e-4 mm en los tres): un centro en otro marco daría rojo siempre.
  CATA llegó a lo mismo en el 36 (el agujero de 14 corrido 3 mm mueve el centro 0,17 mm; la masa, nada) y avisa que sus
  moldes del 22 y el 24 (26, 28, 30) también juzgan solo masa y volumen.
- **Un control que figura en un comentario y no en el código no existe** (38, CATA): el ej45 de la práctica decía «control
  extra: un perfil inclinado» y no lo corría. Corrido: `AddNewRibFromRef` RESPETA el ángulo del perfil (el inclinado
  4,54987° da área × largo × cos; si lo pusiera normal daría 25 mm³ más). El ángulo exacto (atan del paso), no el
  redondeado.
- **El nombre del número es el del papel** (40, CATA): el 0,099 del bloque en V es el error de DESPLAZAMIENTO del eje
  (ΔY); el de POSICIONAMIENTO de la cota H del mismo ejemplo es 0,189. La fila de la COLA lo llamaba mal (corregida).
- **Un solucionador se juzga por la POSE** (40, CATA): el eje arranca lejos (z 200) para que un solucionador que no lo mueve
  dé rojo; un eje del otro lado del vértice también.
- **Una prueba que reemplaza una función de un módulo compartido la devuelve en un `finally`** (36, CATA): la suite corre
  en un solo proceso y las pruebas siguientes heredarían el reemplazo; igual con `sys.modules["gemelo"]` (los
  `contornos.py` del 25, 27 y 29 importan OTRO `gemelo`).
- **Una ficha que resume un papel no es el papel** (42, CATA): el PDF del MIT imprime A = 0,00023234 m² y «16.2 kN»; el
  «2,32e-4» y el 16,26 de la fila y de la ficha E13 eran resumen y recálculo. Lo mismo en el 46: RapidMade publica 1,73 y
  0,173 (el 1,733 era el recálculo). El juez cita lo IMPRESO, y la causa de una diferencia no se inventa (CATA había escrito
  una para el 16,2 que el papel no dice y la sacó; LECCIONES_APRENDIDAS del 24/10).
- **Una pieza chica no se juzga con la tolerancia de volumen de las grandes** (44, CATA, revisor): con 0,5 mm³ un perno
  diamante de puntas planas (0,481 mm³ menos) pasaba; la tolerancia se elige por lo que tiene que cazar.
- **Un docstring con una ruta de Windows (`\.sgc-cache`) da «invalid escape sequence» en Python 3.12** (CATA): `r"""`.
- **El PDF oficial del CSWA no carga desde solidworks.com** (36): la copia de web.archive.org sí, y en la nube de
  Ingeniería está `4- MANUALES\CATIA V5\EJERCICIOS CERTIFICACION\EDU_CSWA_Sample_Exam_2013_ENG.pdf` (respuestas en la
  pág. 9, impresa 313).
- **Una comparación «malo si |x − y| > tol» deja pasar un NaN** (32, 34, 41, revisores y prueba del 41): `NaN > tol` es
  falso. Se escribe «bien si |x − y| <= tol» y lo demás es rojo; y el `ok` exige además que no haya error del juez (una
  excepción fuera de un paso deja `ok_pasos` en verdadero).

- **La respuesta conocida es el GENERADOR, no la malla del bien.py** (51, CATA): el bien.py del banco copia solo el STL,
  que da 1 611,928 mm³ contra 1 612,483 del sólido exacto (0,555, más que la tolerancia): con `con_bien=True` un CATIA
  perfecto daba rojo. El generador de la nube escribe ese STL byte por byte (sha256 en cada corrida) y el STEP, que va a
  `compara.py`; los `bien.py` / `mal_*.py` quedan como gemelos que separan (bien a menos de 1 mm³, cada mal a más de 5).
- **Una fila de la COLA no es la respuesta: la respuesta es la fórmula o el papel** (54 y 56, CATA): la fila 54 traía
  88 127,7 y 88 569,4, que no salen de su propia fórmula (88 129,125 y 88 570,875), y la 56 pedía comparar contra
  `chamfer()` de build123d, que cierra la esquina distinto. El número de una fila se calcula con el comando al escribirla.
- **Volumen y centro no ven una superficie suelta al lado del sólido** (54, CATA): 54_r1 dio la cuenta exacta con la R600
  suelta en el STEP (1 sólido, 2 cáscaras, 17 aristas y 17 vértices contra 12 y 8). `topologia_step.py` del 54 cuenta
  todo lo suelto. `juez_comun` MIDE sólidos, cáscaras y caras sueltas del STEP pero no los exige: lo exige el cierre de
  cada ejercicio (13 `catia.py` y `practica_en_juez` con gemelo de centro, medido el 24/10); uno nuevo lo tiene que pedir.

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

- **Una pieza paramétrica de la práctica del 19/10 se reusa entera** (18, CATA: `pieza_ej27.py` armada con
  `portar_ej27.py`, cambios mínimos anotados arriba; 19, principal: el ej28 copiado tal cual) y el contrato del banco va en
  un `catia.py` aparte. Los redondeos, chaflanes y sentidos elegidos con la primera etapa sobreviven al cambio de
  parámetros (18: las etapas 2 y 3 cambiando solo A..E; 19: las preguntas 4 y 5).
- **La masa sale de CATIA con la densidad del papel**: un material del catálogo con su `Density` pasada a la del
  examen (18, CATA: Steel a 7 700, densidad implícita 7 700,000 en las tres etapas).

- **El orden de las aristas que devuelve la topología NO es fijo entre corridas** (24, CATA): la «primera» arista que
  cumple una posición fue otra en dos corridas (dos aristas en el mismo lugar: la del sólido y una recta del croquis).
  Se prueba cada candidata y se controla el cambio de volumen contra la cuenta del redondeo ((1 − π/4)·r²·L).
- **Un molde para las piezas de afuera ya resueltas** (24, CATA: `portar_ej.py` + `catia.py` con su CFG; principal:
  `scripts/catia/practica_en_juez.py` con el ej copiado SIN cambios): tres de cuatro salieron al primer intento.
- **El catálogo de la B21 de CATA no trae ABS**: Steel con su `Density` a 1 020 (el material sigue LLAMÁNDOSE Steel en el
  árbol: si la pieza se entrega, renombrarlo o decirlo) (22, CATA).
- **Un gemelo al que le falta un detalle se cruza ANTES de ese detalle** (22, CATA: el gemelo no lleva el R1 del asa;
  se guarda el volumen de CATIA justo antes del R1).
- **Dos módulos con el mismo nombre en carpetas distintas** (`gemelo_b123d.py`, `croquis.py`): en un mismo proceso Python
  reusa el primero que cargó. Las pruebas cargan cada uno por ruta y con nombre propio; cada ejercicio corre en su
  proceso (24, CATA).
- **Pasar por STEP mueve el volumen ~4e-6 en una pieza grande con arcos** (29, principal: el gemelo de build123d da
  228 696,0 en memoria y 228 695,116 al releer su STEP): el cruce de volumen va a 0,5 mm³ o 1e-5 del volumen.

- **Chapa como sólido** (31, CATA): sin la biblioteca de Sheet Metal por COM en la R21, la chapa sale exacta con perfiles
  gruesos (R interior y exterior en el croquis), Fill + ThickSurface para el ensanche y dos simetrías (1 027,70 g contra
  1 028 ± 10).
- **Sin gemelo propio, el cruce va contra un número de referencia con su fuente** (31, CATA): el código de la guía de
  build123d (de terceros) no entra al repo; se corre aparte y su volumen va en la configuración del ejercicio.
- **Un comparador que hace booleanas exactas con tolerancia difusa sobre un STEP de miles de caras puede tardar más de
  15 minutos** (32, principal, 24/10: `compara.py` contra el virolador v16 entregado): se midió antes de cortarlo.
  Corrido solo tardó **16 min 22 s** (11:47:58 a 12:04:20) y dio lo mismo que el 19/10 (sobra 0, falta 0, 0,0016 mm):
  el tope de espera pasó de 900 s a 2 400 s. Es tiempo, no tolerancia: los umbrales no se tocaron.

- **Ocultar (`VisProperties.SetShow`) en un documento que NO es el activo no hace nada** (54, CATA): con dos piezas armadas
  y cerradas después, la de adentro salió con la superficie a la vista y suelta en su STEP. Cada pieza se cierra (ocultar,
  STEP, captura) mientras es el documento activo; 06, 13, 14, 17 y 24 ya lo hacen.
- **El lado de `AddNewThickSurface` no se supone: se prueba y se mira el centro** (54, CATA): sobre el arco R600 (de
  izquierda a derecha por (0, 600), extruido en +Z) (0, 3, 0) dio ADENTRO y (0, 0, 3) AFUERA; en un cilindro de la
  práctica (0, 2, 0) dio afuera. Depende de la normal de la superficie: `elegir_forma` prueba una, mira si el centro cayó
  del lado pedido y si no la borra y prueba la otra.
- **CATIA cierra la esquina de tres chaflanes con los tres planos que se cortan en un punto; `chamfer()` de build123d le
  pone un triángulo** (56, CATA): K³/4 contra K³/6 por esquina, 8 piezas de 10,4167 mm³ (83,333 en la caja). La referencia
  se arma SIN la operación que se prueba (la caja cortada por los 12 planos): otro `chamfer()` compara dos criterios de
  esquina, no la pieza. Donde no se juntan tres (las 4 aristas verticales R15 del 57, principal) el redondeo de CATIA y el
  de OpenCASCADE dan la misma forma: sobra 0, falta 0, exacta 0.
- **`AddNewChamfer` modo 1 es largo + ÁNGULO** (51, CATA): (modo 1, 0,5) hizo un chaflán de 0,5 mm a 0,5° y el paso dio ok.
  Cada chaflán se verifica por lo que saca (0,5 × 0,5: ~0,125 mm³ por mm de arista). Cinco aristas juntas (cuatro rectas y
  un círculo) dieron «Update failed»; en dos grupos, rectas y círculo, anduvo (causa no aislada).
- **El centro de lo que saca un vaciado chico se lee SIN redondear** (51, CATA): `medir()` redondea a 0,001 y el centro de
  lo sacado se despeja de dos centros, con el error por V0 / dV (~270 en la boca de 6 mm³). Un margen para ese ruido fue
  peor (dejó pasar la ranura al revés); anduvo `medir_fino()` y exigir que el vaciado saque más de 1 mm³ con su centro
  del lado de su plano.
- **`topologia()` sobre una operación cuenta las caras de ESA operación, no las del sólido** (56, CATA): dio 12 sobre el
  chaflán y el juez las comparó con las 18 del gemelo. Las del sólido se cuentan en el STEP.
- **Rutas de más de 260 caracteres**: en CATA el STL del bien.py del 51 queda a 308 y Windows dice que no existe; los
  gemelos corren con el prefijo `\\?\` (memoria `reference_max_path_260_ruta_no_abre`).
- **`AddNewShell(cara a sacar, espesor interno, espesor externo)` con (cara de arriba, 3, 0) da la pared hacia adentro a la
  primera** sobre una caja sin redondeos (59, CATA; el ej81 de la práctica falló al sacar una cara rodeada de redondeos
  tangentes, no por la llamada). La cara se elige por posición. **Ni «bajó el volumen» prueba «hacia adentro» ni el
  volumen prueba «por la cara pedida»**: con la pared afuera también baja (94 308) y con la cara de abajo da el mismo
  83 508 con el centro en z 32,12; lo separan el centro, lo sacado con su centro y la forma contra el gemelo.

## Piezas reales del cliente (fase 3: 32 a 35)

- **Una respuesta conocida se mide sobre el archivo que se abre, identificado por su sha256, nunca por el nombre** (33,
  CATA; 34, principal). Los números de la COLA del panel (91 765,561 y 91 791,099) eran de `two_wireless.stp`, no de la
  copia en el marco del virolador (91 767,169). Y en la práctica hay DOS `virolador_v10_two.step`: el de `v16_ref` es el
  v16 (89 278 mm³); el de `v14_choque`, otro dispositivo (116 527 mm³, caja más grande).
- **La pieza del cliente no entra al repo**: el `catia.py` toma la ruta de una variable de entorno o de la nube, verifica
  el sha256 y (33) abre una COPIA en la carpeta de trabajo. La prueba sin CATIA usa un STEP falso con su propio sha256.
- **Antes de decir que CATIA perdió geometría al exportar, medir fino** (33, CATA): sobre el STEP que exporta CATIA de una
  pieza toda NURBS, la integración por defecto de build123d da −0,052 % de volumen y el centro 0,058 mm corrido; con
  `BRepGProp.VolumeProperties_s(forma, props, 1e-6)` el mismo archivo da −0,004 % y 0,0042 mm (`medir_fino.py` del 33).
- **El volumen no caza una cara perdida; la topología sí** (33, CATA, medido): una caja 10 × 20 × 30 exportada sin una
  cara la lee build123d como 0 sólidos y 5 caras sueltas, y `BRepCheck_Analyzer` la da VÁLIDA. El STEP exportado se
  decide por 1 sólido y 0 caras sueltas, además del volumen.
- **Panel del cliente en CATIA** (33): 91 770,060 mm³ y 96 035,359 mm² contra OpenCASCADE fino 91 766,750 / 96 034,395
  (+0,0036 %), centro a 0,0036 mm.
- **El nido que copia el panel (ej24) no es UNA pieza: son 5 sólidos** (35, CATA, medido): el bloque entero (171 384,489
  mm³) y cuatro islas de 18,16 mm³ arriba (z −7,78 a −6) que el panel encierra y que quedan sueltas al restarlo. Las NOTAS
  del 19/10 decían «el panel atraviesa el bloque de lado a lado»: lo medido es otra cosa. Como ejercicio cumple
  (intersección 0, distancia 0); como nido impreso, las islas no quedarían pegadas a nada. El juez informa la cantidad de
  sólidos y no decide por ella.
- **El contacto lo decide la distancia exacta, no el gemelo** (35): el gemelo subido 1 mm solo dice que el control no está
  ciego en ese sentido. **Y el volumen del bloque no dice DÓNDE está** (corrido 10 mm da el mismo y el mismo «toca»): fija
  la posición el volumen del nido contra el de la práctica (171 459,136, el mismo en las dos CATIA hasta el último decimal).
- **El sha256 se calcula sobre la COPIA que abre CATIA**, no sobre el original (35 y 33). **Una ruta a la skill desde un
  ejercicio va por `jc.REPO`**: el paquete del obrero copia `ejercicios/` y no `.claude/skills` (35, revisor Sonnet).
- **Un STEP de OpenCASCADE 7.8 con la cabecera al revés CATIA lo abre VACÍO** (34, principal, corrida de las 12:19): el
  v16 entregado (`v16_ref`) entró con el PartBody sin nada y el cuadro de importación se aceptó igual; `medir()` se negó a
  medir el cuerpo vacío y la sesión siguió sana. Ya estaba en `catia.md` (`catia_medir.py`): el juez abre una COPIA con la
  cabecera en orden (`step_cabecera.arreglar_archivo`) y exige que desde el fin de la cabecera sea idéntica al original.
- **`GetMinimumDistance` tampoco anda entre dos cuerpos de la MISMA pieza** (34: «The method GetMinimumDistance
  failed», en el v16 y en el gemelo; entre piezas de un ensamble ya fallaba, 19/10). La distancia la da OpenCASCADE; el
  «no choca» de CATIA (Intersect con Update fallido) vale porque el gemelo, medido DESPUÉS en la misma corrida, choca con
  el volumen de OpenCASCADE.
- **El gemelo de referencia se mide sobre el archivo que abre CATIA** (34): el 69,573 de `catia.md` era el v16 movido en
  memoria; el archivo `v16_subida_1mm.step` da 69,5649 en OpenCASCADE y 69,561 en CATIA. Y CATIA lee ese STEP con 0,65 mm³
  menos que OpenCASCADE (89 277,636 contra 89 278,287, 7e-6): dentro de la tolerancia de volumen.
- **La referencia de la casa también puede traer el error** (48 de CATA y 49 de la principal, gancho de mochila v2 y
  gancho doble): en `build_gancho.py` y `build_gancho_doble.py` el triángulo de la entrada guiada del lado +Y queda en
  sentido horario y `extrude()` lo lleva a z −28..0, debajo de la pieza: no corta nada. Se reproduce lo ENTREGADO (la
  entrada solo del lado −Y, con la medida en el docstring y una prueba que da rojo si alguien arregla el script); el
  script no se toca y la pregunta va a Fak. El de Leo (50) no tiene ese bucle.
- **Ante un rojo contra la referencia, primero se UBICA la diferencia** (48, 49): booleanas referencia − CATIA y
  CATIA − referencia con volumen, centro y caja de cada pedazo, o el script de build123d repetido con el volumen después
  de cada operación. En el 49 dio un solo pedazo de 56 mm³ en el canto de la boca; en el 48, un paso de 33 mm³.
- **La distancia de malla a malla mezcla el facetado; la que decide es la EXACTA, en los dos sentidos** (49, principal y
  su revisor): OpenCASCADE malla el STEP de CATIA (AP203, sin pcurves) con puntos a 0,029 mm de su PROPIO B-Rep donde un
  cilindro corta una cara inclinada, y `compara.py` daba 0,028 con la geometría exacta (CATIA por dentro = la referencia;
  con malla fina, 0,0001). `compara.py` ahora lleva cada punto de malla a más de 0,005 a su cáscara y lo mide contra la
  CÁSCARA del otro (`dist_max_exacta_*`). Contra el SÓLIDO no: un punto adentro del otro da 0 y un resalto de 0,05 pasaba
  (primer intento, cazado por el revisor con gemelos de resaltos y muescas).
- **«Distancia exacta 0,0» quiere decir «ningún punto de malla pasó 0,005»**, no una medición de cero (revisor del 60):
  `compara.py` recalcula exacto solo los puntos con distancia de malla mayor a 0,005; un desvío real de 0,008 en una
  punta redonda dio 0,0. Lo que está por debajo de 0,005 lo cazan otros controles (en el 60, los ejes del R3).
- **Un rasgo de pocos mm² puede no recibir NINGÚN punto de la malla de `compara.py`, y ahí ningún control lo ve**
  (revisor Fable del cierre, demostrado): un agujero ciego D1 con 2,5 de profundidad en vez de 3 en la placa del 58
  quedó verde (ΔV 0,39 mm³, centro 1e-5, 1/1/0, exacta 0,0). 20 000 puntos por área son ~2,6 mm² por punto en esa
  placa y 3,7 en el 57. Hasta que `compara.py` muestree por cara (T3 de la COLA), un ejercicio con rasgos chicos dice
  cuál es el defecto más chico que caza y lo prueba con su gemelo. `compara.py --caras` (opcional desde el 24/10) ya
  mide una grilla por cara del B-Rep: el mismo par da 0,5 mm, y CATIA contra gemelo bueno (58, 60) da 0,0.
- **Las cotas derivadas se calculan como las calcula el script** (`derivadas()` de cada `build_gancho*.py`) y la prueba
  las compara con las de build123d (48, 50): si el script cambia, CATIA no queda desincronizada en silencio.
- **Cajas a lo largo de un mismo eje son UN perfil extruido** (50, CATA): el gancho de Leo en CATIA es un croquis de 16
  vértices y un pad, en vez de cinco booleanas; la prueba lo compara con el sólido del script sin los redondeos.
- **El obrero corta un ejercicio a los 1 200 s** (`obrero.py --timeout-seg`, por defecto): el tope interno de un post-proceso
  tiene que quedar por debajo (35: 900 s). El 32 no entra: CATIA más la comparación contra el entregado pasan los 20 min;
  corre solo en la PC principal, a mano o con `--timeout-seg 3000`.

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
- **Lo que `juez_comun` deja como TEXTO cuando una medición falla (sin `.venv-cad`, un STEP ilegible) tiene que dar ROJO,
  no una excepción** (CATA, 59, 56, 18; la principal en 55, 57, 58 y 60): `step_catia_en_build123d` puede ser un texto
  entero o un texto DENTRO de la parte (`{"macho": "error…"}`), y un `.get()` sobre eso revienta el cierre. Se normaliza a
  `{}` antes de leer (`sp = sp if isinstance(sp, dict) else {}`) y la prueba tiene los dos rojos.

## Tiempos medidos (24/10/2026)

| Ejercicio | PC | CATIA | Total | Pasos |
|---|---|---|---:|---:|
| 08 C Clamp Base | CATA, R21 | arranque 8,9 s, conectó a 17,9 s | 30,0 s | 9 |
| 09 Paste Sleeve GSD | principal, R21 | build123d 47 s | 164 s | 19 |
| 11 Tool Block paramétrico | principal, R21 | | 72 s | 10 |
| 13 superficies exactas | principal, R21 | | 83 s | 22 |
