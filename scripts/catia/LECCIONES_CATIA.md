# Lecciones del banco de CATIA (centralizadas por la PC principal)

Tanda del 24/10/2026: dos sesiones, una por PC (pedido de Fak: *"dejar un opus en cada notobok... cada tanto se curzen
la data y las correcciones no? y centralicen"*). Cada ejercicio de CATA deja su `LECCIONES.md` en su carpeta; la
principal las trae acá cada hora y, si cambian el método, las lleva a la skill `cad-design` (`reference/catia.md`).
Cada lección dice de qué ejercicio y qué PC sale, y cómo se midió. Lo que ya estaba en `catia.md` no se repite.

## Controles: qué mira cada uno y qué NO ve

- **El volumen de CATIA (SPA) no ve un sólido con las caras hacia adentro** (09, principal; NOTAS 19/10 de la práctica:
  la v16 dio el B-Rep bien y el STL 85 849,6 contra 89 278). El control es el **STL que exporta CATIA**, medido con signo
  (`medir_b123d.py stl`, trimesh): cerrado y con el volumen del sólido. Tolerancia 5 %: el facetado de CATIA dio −0,24 %
  en el Paste Sleeve y −1,2 % en el tronco de cono y el tubo de pared 2 (13, 24/10 09:31); las caras hacia adentro dan
  negativo o cientos de %. Lo encontró el revisor del 09: ningún control lo veía.
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
