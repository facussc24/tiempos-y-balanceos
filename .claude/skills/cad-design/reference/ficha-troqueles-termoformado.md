# Troqueles de fleje y moldes de termoformado de prototipo: reglas de fabricantes (SIN AUDITAR)

> Informe de un investigador (19/10/2026, frente 5 del criterio de diseñador). **Ninguna regla es norma**: todas son de
> fabricantes o proveedores, y casi nada habla de vinilo con espuma. Cada fila dice su fuente y si se leyó (ABIERTA) o
> solo el resumen del buscador (SECUNDARIA). **Antes de usar un número en un diseño de la casa, abrir su fuente**; los
> «SIN FUENTE» no se usan. Lo que diga la casa (Pablo Gamboa, mesa de corte, troqueles que andan) manda sobre esto.

## Como leer este archivo

- **ABIERTA** = la pagina se trajo con la herramienta de lectura web (WebFetch) y la leyo un modelo chico que devolvio un resumen con citas; no es lectura humana de la pagina completa.
- **SECUNDARIA** = el dato sale solo del resumen del buscador (o de una pagina que no se pudo abrir). No usar para decidir sin abrir la fuente.
- **SIN FUENTE** = no se encontro dato publico abierto. No se completa de memoria. Hay que medirlo (prueba) o preguntarle al proveedor.
- **Norma**: NO se encontro ninguna norma ISO/DIN/ASTM que fije estos valores. Todo lo de abajo es regla de fabricante, proveedor, blog, foro, paper o patente. La unica asociacion sectorial que aparece es la tolerancia de la European Diecutting Association (ESU) citada por voestalpine (solo tolerancias de fleje). El paper de Boca y Sover es revisado por pares, pero no es norma.
- **Contexto**: casi todas las fuentes hablan de carton, film, cuero, PP/PETG/ABS/HIPS/PS de 0,5-3 mm. **Casi ninguna habla de vinilo PVC laminado con espuma.** Cada fila lleva el contexto de donde sale el numero. Una pulgada = 25,4 mm; las conversiones son mias.
- Cuando dos fuentes se contradicen se muestran las dos (seccion C), sin elegir.

---

## A) Troqueles de fleje (steel rule dies)

### A1. El fleje (rule): espesor, altura, bisel, dureza

| Regla | Numero | Fuente (URL y que dice) | Estado | Contexto / aviso |
|---|---|---|---|---|
| Espesor 2 pt y 3 pt | 2 pt = 0,71 mm; 3 pt = 1,05 mm (tambien 4 pt = 1,42; 1,3 pt = 0,45; 1,5 pt = 0,53). Tolerancia de espesor ±0,015 mm (2 pt) y ±0,020 mm (3 pt) | https://www.voestalpine.com/precision-strip/products-brands/scandie/product-information — tabla espesor mm / pt / tolerancia | ABIERTA | Fabricante de fleje (Scandie). Otro listado da 3 pt = 1,07 mm (ver A2); aca figura 1,05 mm | **VERIFICADA 20/10 en voestalpine (0,71 ±0,015 = 2 pt; 1,05 ±0,020 = 3 pt, textual).**
| Espesores en pulgada | 2 pt = 0,028" (0,71 mm); hasta 8 pt = 0,112" (2,84 mm) | https://fremontcuttingdies.com/steel-rule-dies/ — "2pt (0.028″, 0.71mm) to 8pt (0.112″, 2.84mm)" | ABIERTA | Troquelador de EEUU |
| Alturas disponibles | 22-50 mm en los grados 350 HF, 400 HF y 700 HFD; 22-100 mm en los grados 400, 450, 450 HF y 500 HF; 2 pt y 3 pt disponibles en todos (4 pt en todos menos el 700 HFD) | https://www.voestalpine.com/precision-strip/products-brands/scandie/about-the-brand/cutting-rules — tabla por grado | ABIERTA | Fabricante de fleje |
| Altura "estandar" 23,8 mm (0,937") | 23,8 mm = 0,937" (conversion mia). Aparece como altura de arranque en una dobladora rotativa (23,8-26,9 mm) | https://www.ytdiemaker.com/automatic-bending-machine/rotary-rule-bending-machine.html — "Bending blade height 23.8–26.9 mm" | ABIERTA | Solo muestra que 23,8 es altura comun de maquina; NO dice "estandar". Los listados "2pt/3pt 0.937" (ebay) y "0.71*23.80" (globalsources) solo salieron del buscador: SECUNDARIA |
| Altura del fleje, rango general | 19 mm (0,75") a 76,2 mm (3,00") | https://fremontcuttingdies.com/steel-rule-dies/ | ABIERTA | Troquelador de EEUU |
| Tolerancia de altura | ±0,020 mm (altura < 35 mm); ±0,030 mm (≥ 35 mm); rectitud max 0,5 mm por metro | https://www.voestalpine.com/precision-strip/products-brands/scandie/product-information — "tolerances ... European Diecutting Association (ESU)" | ABIERTA | Es la unica referencia a una asociacion del sector (ESU), via fabricante |
| Tipos de bisel | CB (center bevel), SB (side bevel), LCB (long center bevel), LSB (long side bevel) | https://www.voestalpine.com/precision-strip/products-brands/scandie/cutting-rules — pagina "Bevel Execution": define CB, SB, LCB y LSB (el resumen de la lectura los trajo como Center / Side / Long Center / Long Side Bevel) | ABIERTA | La tabla de grados de la otra pagina de voestalpine (about-the-brand/cutting-rules) solo lista los codigos sin definirlos |
| Angulo del filo | 42° y 52° (estandar); "robust edge" 75° de punta | https://www.voestalpine.com/precision-strip/products-brands/scandie/cutting-rules — "Edge angle 42°, 52°"; "Robust edge tip angle 75°" | ABIERTA | Fabricante de fleje; no dice cual angulo va con que material |
| Dureza | Cuerpo 340-500 HV; filo templado 650 HV (700 HV en HFD) | https://www.voestalpine.com/precision-strip/products-brands/scandie/about-the-brand/cutting-rules — tabla por grado | ABIERTA | Fabricante de fleje |
| Acabado del filo | "Shaved edge" es el estandar; afilado fino, brillante y robust solo en grados de filo templado; recubrimientos GLIDE (carton) y DIAMOND (tiradas largas) | https://www.voestalpine.com/precision-strip/products-brands/scandie/cutting-rules | ABIERTA | Los recubrimientos estan pensados para carton, no para vinilo/espuma |
| Que bisel conviene para vinilo/espuma blando | — | No se encontro | SIN FUENTE | Un resumen decia que el bisel "descentrado" (side bevel) da buen corte y duracion, pero salio de un articulo no identificado: no se usa |
| Dato util sobre blandos | El efecto "reloj de arena" (bordes concavos o convexos) crece cuanto mas blando y grueso es el elastomero / espuma de celda cerrada | https://bgpeck.com/die-cutting/ — "increases with the softness and thickness of elastomeric materials" | ABIERTA | Fabricante de piezas troqueladas. Es la advertencia mas cercana a espuma de 2-5 mm |
| Espuma: el corte es por compresion | Los blandos no se fracturan: el corte ocurre cuando la carga de compresion vence el material | https://tombrowninc.com/blog/basics-steel-rule-die-cutting/ — "Soft materials like foams don’t fracture" | ABIERTA | Sin numeros |

### A2. Radio minimo de doblado del fleje

| Regla | Numero | Fuente | Estado | Contexto / aviso |
|---|---|---|---|---|
| Radio minimo a 90° que puede hacer una dobladora automatica | 0,71 mm (2 pt) -> 0,5 mm; 1,07 mm (3 pt) -> 0,5 mm; 0,45 y 0,53 mm -> 0,4 mm; angulo maximo 100 | https://worthytall.en.made-in-china.com/product/jNsndCeJwkcl/China-Tsukatani-Steel-Rule-Auto-Bending-Machine-for-Die-Cutting.html — tabla "Min. bending radius at 90°" | ABIERTA | Es capacidad de una MAQUINA (listado de vendedor), no un radio de diseño. No dice si el radio es de la cara interior |
| Mismo listado: dato de "industria" | "superior al estandar de la industria de 1,0 mm" (FAQ del vendedor) | misma pagina | ABIERTA | Afirmacion comercial del vendedor |
| Otra dobladora automatica | Radio minimo 0,5 mm; espesores 0,71 / 1,07 mm; alturas 7-32 mm; muesca (nick) 0,18-1 mm de profundidad | https://yitaipackage.en.made-in-china.com/product/NvkEYFbDEzpe/China-Automatic-Steel-Rule-Bender-Bending-Machine-for-Die-Cutting.html | ABIERTA | Listado de vendedor |
| Dobladora rotativa | 180° radio minimo R5 mm; largo minimo de tramo a 90°: 5 mm; espesores 0,71/1,05/1,07/1,42 mm | https://www.ytdiemaker.com/automatic-bending-machine/rotary-rule-bending-machine.html | ABIERTA · VERIFICADA 20/10 (textual) | Listado de vendedor |
| Radio minimo "doblable" segun troquelador | 1/32" (≈ 0,8 mm) | https://bgpeck.com/die-cutting/ — "The minimum bendable radius is 1/32″" | ABIERTA | Troquelador de EEUU, sin decir el espesor de fleje |
| Radio minimo de fleje en funcion del espesor (k × espesor) | — | Todo lo que salio fue de chapa en plegadora (1 × espesor, etc.), que no aplica al fleje | SIN FUENTE | No usar las tablas de plegado de chapa |
| Radio minimo practico en la ranura del tablero (corte laser) | — | No se encontro | SIN FUENTE | Hay que preguntarle al que corta el tablero |

### A3. Gomas expulsoras (ejection rubber)

| Regla | Numero | Fuente | Estado | Contexto / aviso |
|---|---|---|---|---|
| Dureza segun espesor del material cortado | ≤ 0,2 mm films: 80-90 Shore A; 0,2-0,6: 75-85; 0,6-1,5: 70-80; **1,5-3,0 mm (cartones, textiles): 60-75; > 3,0 mm (espuma, sustratos densos): 50-70** | https://www.ytdiemaker.com/others-supplier/die-cutting-rubber.html — tabla "Material Thickness / Shore A Range / Rubber Height" | ABIERTA · VERIFICADA 20/10 (textual) | Proveedor chino de materiales de troquelado. La columna "Rubber Height" (2-3 mm hasta 8 mm+) no aclara si es lo que sobresale o la altura total: no usarla como "sobresale" |
| Dureza por aplicacion | Films PET/PVC: 75-85; espuma o goma en lamina: 50-70; textiles/cuero: 60-75 (Shore A) | misma pagina, tabla "Application" | ABIERTA · VERIFICADA 20/10 (textual) | "PVC" ahi es film fino, no vinilo de 1 mm con espuma |
| Dureza por tipo de goma | Esponja de celda abierta 20-30 Shore A (35-45 Shore 00); microcelular PU 35-45 A; celda cerrada 50-60 A; vulcanizada solida 65-75 A; tira de doble dureza: 25 A en la superficie sobre base de 60 A | https://www.lionpaper-istyle.com/post/die-ejection-rubber-guide — tabla resumen | ABIERTA · VERIFICADA 20/10 (20-30 A celda abierta; separacion 0,5-1,0 y sobresale 1,0-1,8, textual) | Proveedor / guia comercial, pensada para carton y papel |
| Cuanto sobresale la goma sobre el filo | **1,0-1,8 mm** sobre la punta del fleje (carton plano 200-500 g/m²); hasta 2,5-3,5 mm en corrugado grueso | https://www.lionpaper-istyle.com/post/die-ejection-rubber-guide | ABIERTA | **Es para carton.** Formula de la pagina: altura de goma = altura de fleje + sobresale |
| Cuanto sobresale la goma, para vinilo + espuma 2-5 mm | — | No se encontro | SIN FUENTE | Los 1,0-1,8 mm no se pueden trasladar a espuma gruesa sin prueba |
| Separacion goma-filo (setback) | Corte pasante: 0,5-1,0 mm del fleje; corte "a beso" (kiss-cut): 1-2 mm; fleje de hendido (creasing): 1,5-2,5 mm | https://www.ytdiemaker.com/others-supplier/die-cutting-rubber.html y https://www.lionpaper-istyle.com/post/die-ejection-rubber-guide (el de hendido) | ABIERTA | Mismas dos fuentes comerciales; contexto carton/film |
| Compresion de la goma | Mantener 35-55 % del espesor original (microcelular); arriba de 60 % se colapsa la celda | https://www.lionpaper-istyle.com/post/die-ejection-rubber-guide | ABIERTA | Guia comercial |
| Cuando cambiar la goma | Cuando lo que sobresale baja 0,5 mm o mas respecto de la especificacion; revisar entre 100.000 y 250.000 golpes | misma pagina | ABIERTA | Guia comercial, pensada para carton |
| Tolerancia de altura de la goma | ±0,1-0,2 mm | https://www.ytdiemaker.com/others-supplier/die-cutting-rubber.html | ABIERTA | Proveedor |
| Principio general | La goma se pega al tablero y sobresale por encima del filo para protegerlo y expulsar | https://patents.justia.com/patent/20050050936 | SECUNDARIA | Patente; solo resumen del buscador |
| Codigo de colores por dureza | Existe "goma con color por dureza" como opcion personalizada; no hay tabla estandar color-dureza | https://yitaipacking.com/products/die-making-ejection-rubber/ | ABIERTA | No se encontro una tabla de colores |

### A4. Base del troquel (tablero multilaminado)

| Regla | Numero | Fuente | Estado | Contexto / aviso |
|---|---|---|---|---|
| Material del tablero | Contrachapado multilaminado de abedul o arce, fibras cruzadas | https://www.optica.org/about/newsroom/corporate_member_news/2024/die_board_cutting_with_co2_lasers — "typically birch or maple" | ABIERTA | Nota de un fabricante de laser (Luxinar) |
| Espesor del tablero cortado con laser | 12-18 mm (ensayos con laser CO2 de 100-1000 W) | misma pagina | ABIERTA | Fabricante de laser |
| Espesor tipico de tablero | 5/8" a 3/4" (≈ 16-19 mm); el laser corta "limpio" hasta ~3/8" (≈ 9,5 mm) segun la patente (antigua) | https://patents.google.com/patent/US5566594 | ABIERTA | Patente de tablero apilado; el limite de 3/8" es lo que dice la patente, y la fila anterior da 12-18 mm cortados con laser |
| Ancho de la ranura laser | Ranura ≈ ancho del fleje, un poco menor para que quede a presion; ejemplo 0,028" (0,71 mm) para fleje 2 pt | https://sawmillcreek.org/goto/post?id=1446855 (foro: dice 0,028" de ancho) y https://tombrowninc.com/blog/basics-steel-rule-die-cutting/ ("slightly less than the width of the cutting blade") | ABIERTA | Foro de carpinteria + troquelador. Un valor de 0,026-0,027" para encaje a presion salio de un resumen del buscador de una patente: SECUNDARIA |
| Forma de la ranura | Mejor con forma de "reloj de arena invertido": solo las laminas de arriba y de abajo aprietan el fleje | https://sawmillcreek.org/goto/post?id=1446855 | ABIERTA | Opinion de un troquelador en un foro |
| Vida del troquel | 10.000-100.000 golpes (Fremont); ~10.000 con material abrasivo y hasta 300.000 con blandos en buenas condiciones (Millennium) | https://fremontcuttingdies.com/steel-rule-dies/ y https://millenniumdie.com/steel-rule-die-basics/ | ABIERTA | Troqueladores comerciales |
| Fleje con poca superficie sobre madera blanda | Puede "hundirse" en la madera con la carga | https://patents.google.com/patent/US7121182 (via buscador) | SECUNDARIA | Patente, resumen del buscador |

### A5. Tabla de corte (cutting plate / pad)

| Regla | Numero | Fuente | Estado | Contexto / aviso |
|---|---|---|---|---|
| Material y dureza de las tablas de troquelado | Polipropileno extruido: **Shore D 70**; nylon colado: Shore D 85; espesores 3, 6, 12 y 25 mm | https://www.starpackagingsupplies.com/C/838/DieCuttingBoards — "Extruded Poly White (Shore D 70)" | ABIERTA | Proveedor de EEUU. **Es PP, no PE/HDPE.** |
| Rotar y dar vuelta | "Rotate & Flip the Pad for Even Wear"; no concentrar cortes en una zona; guardar en horizontal | misma pagina | ABIERTA | Proveedor; sin frecuencia |
| Profundidad maxima de corte en la tabla | 0,01" (0,3 mm) | misma pagina — "A maximum cutting depth of 0.01" (0.3 mm) is recommended" | ABIERTA | Proveedor; la frase es ambigua (profundidad de huella en la tabla) |
| Colada vs extruida | La colada tiene paralelismo ±0,008" (±0,2 mm), no se arquea y se puede rectificar; la extruida es "descartable" y se arquea | misma pagina | ABIERTA | Proveedor |
| Tabla de maquina clicker | PP, Shore D 74-78, espesor 25 y 50 mm, tolerancia ±0,8 mm | https://www.shoesmachines.com/plastic-cutting-board.html | ABIERTA | Fabricante de prensas hidraulicas de corte (cuero, goma, tela). El listado dice "PP" |
| Dureza de la tabla respecto de la goma | La tabla ("anvil") debe ser mas dura que la goma expulsora; para corte pasante se nombran UHMW-PE, nylon, poliuretano | https://www.ytdiemaker.com/others-supplier/die-cutting-rubber.html | ABIERTA | Sin valor Shore D |
| Equilibrio blandura / duracion | Shore D 70 como compromiso: blanda para cuidar el filo, resistente para durar | https://www.hammerheadindustrial.com/products/1-polypropylene-cutting-boards | ABIERTA | Proveedor | **20/10: verificado en hammerhead solo «PP, Shore D 70»; rotar/dar vuelta y la huella maxima NO estan en esa pagina.**
| Camas de HDPE de 1/2" y 1" en prensas clicker | 12,7 y 25,4 mm | https://www.crossco.com/products/tft/fabric-garment-testing/clicker-presses-hydraulic-pneumatic-fabric/ | SECUNDARIA | La pagina abierta no mostro el material ni el espesor; el dato salio del buscador |
| Dureza y espesor de tabla de HDPE; frecuencia de rotacion de HDPE | — | No se encontro nada de HDPE abierto (todo lo abierto es PP o nylon) | SIN FUENTE | No asumir que la regla del PP vale igual para HDPE |
| Cuanto se puede rectificar una tabla antes de cambiarla | — | No se encontro | SIN FUENTE | |

### A6. Penetracion (ajuste de la prensa)

| Regla | Numero | Fuente | Estado | Contexto / aviso |
|---|---|---|---|---|
| Penetracion del fleje en la tabla | Maximo 0,3 mm (0,01") | https://www.starpackagingsupplies.com/C/838/DieCuttingBoards | ABIERTA | Proveedor de tablas de PP |
| Largo del fleje pasado el espesor del material | "0,5-1,5 mm mas alla del espesor del material" | https://www.ytdiemaker.com/others-supplier/die-cutting-rubber.html | ABIERTA | Proveedor chino; se refiere a cuanto debe pasar el filo, no a como se regula la prensa. Ver conflicto en C |
| Tolerancia dimensional del corte con fleje | ±0,010-0,015" (±0,25-0,38 mm); la flexion del fleje limita a ±0,010" | https://colvin-friedman.com/die-cutting-tolerances/ | ABIERTA | Troquelador. Por material: PVC flexible > 0,020": ±0,015-0,025"; espuma PU baja densidad hasta 0,5": ±0,030-0,050"; espuma de celda cerrada densa: ±0,010-0,025"; radios chicos (0,062-0,50"): ±0,010-0,030" |
| Una matriz sin filo necesita mas fuerza y compresion | Cualitativo | https://www.jbc-tech.com/blog/posts/steel-rule-die-cutting-101/ — "A dull die will require more force and compression" | ABIERTA | Sin numeros |
| Procedimiento de ajuste para vinilo + espuma | — | No se encontro | SIN FUENTE | Hay que probar |

### A7. Fuerza de corte

| Regla | Numero | Fuente | Estado | Contexto / aviso |
|---|---|---|---|---|
| Fuerza por longitud de fleje, **carton** | 220 lb por pulgada lineal de fleje de corte (≈ 38,5 N/mm, conversion mia); 137,5 lb/pulg (≈ 24,1 N/mm) para fleje de hendido; supone fleje nuevo | https://briarpress.org/33276 — cita un folleto de Heidelberg ("Hints for the Pressman") para carton de 0,012-0,016" | ABIERTA | **Sirve solo de orden de magnitud para carton fino. No aplica a vinilo ni a espuma.** Es una cita de segunda mano en un foro |
| Prensas clicker, cuero | Sin formula en la pagina; ejemplos de uso: dados de 25-30 pulg lineales con 24 tubos en prensa de 10 t con cuero ≤ 12 oz | https://leatherworker.net/forum/topic/75016-how-to-determine-what-ton-clicker-needed | ABIERTA | Foro. Los 300 y 500 lb/pulg que menciono el buscador NO estan en la pagina abierta: SECUNDARIA |
| Formula de punzonado de chapa (largo × espesor × resistencia al corte) | — | Aparece en Wikipedia / foros, pero es para chapa | SECUNDARIA | No aplica a corte por compresion de blandos |
| Fuerza de corte por mm de perimetro para vinilo / espuma de 2-5 mm | — | No se encontro dato publico | SIN FUENTE | Medir con celda de carga en un troquel de prueba, o pedir datos al fabricante de la prensa |
| Espuma gruesa apilada | Una patente apila hasta 9" de espuma y la comprime a ~1" antes de cortar, con espuma de celda abierta de 130-150 lb de IFD | https://patents.google.com/patent/CA2108448C/en | ABIERTA | Patente para pilas de espuma; no es el caso de una capa suelta |

### A8. Sacabocados (punzones para ojales dentro del troquel)

| Regla | Numero | Fuente | Estado | Contexto / aviso |
|---|---|---|---|---|
| Idoneidad del fleje para agujeros chicos | "No es bueno para troqueles de diametro chico o formas complejas si uno no sabe lo que hace" | https://www.mmdigest.com/archives/Digests/200905/2009.05.12.05.html (Spencer Chase) | ABIERTA | Opinion en un foro de modelismo; los punzones tubulares se compran en pasos de 1/64" (chicos) y 1/16" (grandes) |
| Separacion entre bordes de agujeros | "0,125" (≈ 3,2 mm) entre bordes", mayor segun el diametro del punzon y el espesor | https://bgpeck.com/die-cutting/ | ABIERTA | Troquelador; vale para agujeros troquelados, no queda claro si es dentro de un troquel de fleje |
| Tamaños de agujero estandar | Pasos de 1/64" | https://bgpeck.com/die-cutting/ | ABIERTA | |
| Como se fijan los punzones | A presion en ranuras de la madera; se aflojan con el desgaste | https://patents.justia.com/patent/20150190942 (via buscador) | SECUNDARIA | Patente |
| Diametro minimo / construccion del sacabocados para un ojal de X mm dentro del troquel | — | No se encontro | SIN FUENTE | Preguntar al troquelador / a la casa que vende punzones |

### A9. Distancia entre flejes, puentes y muescas (nicks)

| Regla | Numero | Fuente | Estado | Contexto / aviso |
|---|---|---|---|---|
| Distancia minima entre flejes | — | No se encontro | SIN FUENTE | |
| Puentes (tramos sin cortar del tablero) | Separados ~1/4" (≈ 6 mm); largo de la muesca del puente ~1/4" | https://patents.google.com/patent/US5566594 | ABIERTA | Descripcion historica de tableros de madera para carton |
| Ancho de herramientas de muesca en el fleje | 0,3 a 2,0 mm (0,3-1,0 de a 0,1 mm; luego 1,2, 1,5 y 2,0) | https://cito.de/en/MV/boxline/diecutting/manual_nick_grinder/manual-nick-tools | ABIERTA | Fabricante de herramientas; mundo del carton |
| Muescas: profundidad | No mas profunda que el espesor del material; angosta; desfasadas entre si | https://briarpress.org/38004 | ABIERTA | Foro, sin anchos numericos |
| Ancho de muesca 0,012-0,020" | — | https://briarpress.org/42136 (resumen del buscador, no se abrio) | SECUNDARIA | Foro |
| Muescas / puentes para vinilo y espuma | — | No se encontro | SIN FUENTE | |
| Muesca de profundidad en dobladora automatica | 0,18-1 mm | https://yitaipackage.en.made-in-china.com/product/NvkEYFbDEzpe/China-Automatic-Steel-Rule-Bender-Bending-Machine-for-Die-Cutting.html | ABIERTA | Capacidad de maquina |

---

## B) Termoformado al vacio con molde de prototipo (impreso en 3D o MDF)

**Aviso de alcance:** todo lo siguiente sale de laminas rigidas o semirrigidas (PS, HIPS, ABS, PETG, PC, PP, PE de 0,5-3 mm). No se encontro ninguna fuente abierta sobre formar una piel de vinilo de 1 mm laminada con espuma de 2-5 mm. Las reglas de desmoldeo, webbing y estirado de abajo son punto de partida, no garantia.

### B1. Desmoldeo (draft)

| Regla | Numero | Fuente | Estado | Contexto / aviso |
|---|---|---|---|---|
| Macho / hembra (Formlabs, blog de prototipado) | Macho 4-5°; hembra 1,5-3° | https://formlabs.com/blog/prototyping-vacuum-forming/ — "For male molds, 4-5 degrees of draft is recommended" | ABIERTA · VERIFICADA 20/10 (macho 4-5°, hembra 1,5-3°, textual) | Fabricante de impresoras 3D (resina) |
| Texturas | Una superficie texturada aumenta el desmoldeo necesario | misma pagina | ABIERTA | Sin numero |
| Macho / hembra (Stratasys, guia FDM) | Macho 3-4°; hembra 2-3° | https://www.stratasys.com/en/resources/resource-guides/fdm-thermoforming/ — Tabla 1 | ABIERTA | Fabricante de impresoras FDM. Valores de referencia |
| Minimo con moldes impresos en resina (Formlabs, guia de termoformado) | 2-3° minimo; casos reales: 3° general (IPC), ≥ 2° (Glassboard), 3° (Formech) | https://formlabs.com/eu/blog/thermoforming-with-3d-printed-molds-formech | ABIERTA · VERIFICADA 20/10 (textual) | Casos reales de laminas de 1,5-3 mm |
| Rango general de moldes de envases | 1°-5°; embuticion profunda, texturas o material de mucha contraccion: 3°-5°; PET reciclado: minimo 2° | https://gabler-thermoform.com/what-draft-angles-radii-and-wall-ratios-does-thermoforming-require/ | ABIERTA | Fabricante de maquinas |
| Minimo general | 1°-3°; "5° o mas ayuda mucho al desmoldeo" | https://www.digitalengineering247.com/download/3d-printed-vacuum-form-molds | ABIERTA | Nota tecnica de un proveedor de impresion 3D |
| Desmoldeo 5-7° en moldes conicos | 5-7° | Folleto de Eastman (PDF no leido en el navegador) | SECUNDARIA | Fabricante de lamina de copoliester |
| Desmoldeo para piel de vinilo con espuma | — | No se encontro | SIN FUENTE | |

### B2. Agujeros de vacio

| Regla | Numero | Fuente | Estado | Contexto / aviso |
|---|---|---|---|---|
| Diametro maximo respecto de la lamina | El diametro "no debe superar el espesor de la lamina que lo cubre"; si no, la lamina se mete en el agujero y deja marca o se rompe | https://atna-mam.utcluj.ro/index.php/Acta/article/view/2028 (Boca y Sover, Acta Technica Napocensis) | ABIERTA | Paper revisado, sobre moldes de fabricacion aditiva. Lograron agujeros de 0,35 mm cambiando inclinacion y parametros de impresion |
| Diametros usados en casos reales | 0,5 mm minimo imprimible en Grey Resin; IPC 1 mm (1,2 mm en la V2, especificacion 0,8-1,2 mm); Glassboard 1,5 mm; Formech 1 mm. Con Rigid 10K / Fast Model hay que perforar los menores de 1 mm | https://formlabs.com/eu/blog/thermoforming-with-3d-printed-molds-formech | ABIERTA · VERIFICADA 20/10 (textual) | Laminas de 1,5-3 mm |
| Pared minima del molde impreso | 1-2 mm | misma pagina | ABIERTA | |
| Un caso con PETG | Agujeros de 1 mm donde queda aire atrapado | https://fabacademy.org/2025/labs/leon/students/david-fernandez/assignments/week17.html | ABIERTA | Trabajo de un estudiante (Fab Academy), Mayku FormBox | **VERIFICADA 20/10 (textual).**
| Moldes FDM con relleno ralo | La porosidad del relleno evita los canales; brecha de trama maxima 0,003" (0,076 mm) | https://www.stratasys.com/en/resources/resource-guides/fdm-thermoforming/ | ABIERTA | Fabricante FDM; con PC / ULTEM 9085 |
| Donde ponerlos | En bolsillos internos y rincones donde se atrapa aire; "agujeros para ayudar al vacio a tirar la lamina alrededor de detalles" | https://formlabs.com/blog/prototyping-vacuum-forming/ y https://www.bu.edu/epic/equipment/thermoforming | VERIFICADA 20/10 en Formlabs («vent holes» en bolsillos internos) · ABIERTA | Sin separacion numerica |
| Separacion entre agujeros | — | No se encontro | SIN FUENTE | |
| Agujero de vacio y marca en el lado vista del vinilo | — | No se encontro | SIN FUENTE | |

### B3. Webbing (pliegues) y como evitarlo

| Regla | Numero | Fuente | Estado | Contexto / aviso |
|---|---|---|---|---|
| Causa | Varios machos cercanos entre si; el webbing aparece cuando no se controla el flujo de la lamina caliente | https://soa.syr.edu/resources/technology/digital-fabrication/vacuum-forming.php y https://es.formech.com/blog/formech-technical-newsletter-webbing | ABIERTA | Universidad / Formech. La pagina de Formech tiene las soluciones como imagen: no se pudieron leer |
| Remedio basico | Separar los machos, o usar hembras (negativos): reduce o elimina el webbing | https://soa.syr.edu/resources/technology/digital-fabrication/vacuum-forming.php | ABIERTA | Sin distancia |
| Distancia al borde de la abertura | 0,3-1,0 × la altura del molde (ej.: molde de 50 mm -> 25 mm con 0,5 ×) | https://es.formech.com/blog/formech-technical-newsletter-tooling-materials-8 | ABIERTA | Fabricante de maquinas; para un solo bloque de altura uniforme. **No es separacion entre machos** | **20/10: NO verificable en la página web (las medidas están en una imagen y en el PDF del boletín); el PDF no se abre de noche.**
| Lamina demasiado grande | Genera webbing y dificulta el desmoldeo | misma pagina | ABIERTA | |
| Separacion entre machos | 1 pulgada de separacion por cada pulgada de profundidad de cavidad (1:1) | Folleto de Eastman (PDF no leido) | SECUNDARIA | Fabricante de copoliester, para bandejas. Es la unica regla numerica de separacion entre machos que salio |
| Remedios de Formech (boletin 2) | Molde demasiado alto respecto de su base: agregar un faldon a 45°; bloques en angulo en las esquinas; alambres u hojas de acero en el marco de sujecion; marco en el tapon de ayuda; aplicar el vacio gradual; hembra en lugar de macho | https://digilab.uma.es/pdf/formech_PDF/Technical-Newsletter-2-Webbings.pdf | SECUNDARIA | Resumen del buscador; el PDF no se abrio (ver seccion E) |
| Tapon de ayuda | ~80 % del tamaño de la cavidad; desciende 70-75 % de la profundidad | Boletin de Formech sobre tapon de ayuda (resumen del buscador) | SECUNDARIA | |
| Aristas vivas del molde | Romper con chaflanes o radios para reducir el rasgado y el webbing | https://formlabs.com/blog/prototyping-vacuum-forming/ | ABIERTA | Sin dimension |
| Mas desmoldeo ayuda | En embuticiones profundas con paredes verticales | https://www.digitalengineering247.com/download/3d-printed-vacuum-form-molds | ABIERTA | |
| Exceso de calor y tiempo | Un caso con PETG tuvo webbing en la base en los 2 primeros ciclos; se corrigio calentando solo hasta que la lamina "empezo a combarse" | https://fabacademy.org/2025/labs/leon/students/david-fernandez/assignments/week17.html | ABIERTA | Estudiante, una sola prueba | **VERIFICADA 20/10 (textual).**
| Hembra: profundidad del agujero | Menor al 75 % del ancho | https://soa.syr.edu/resources/technology/digital-fabrication/vacuum-forming.php | ABIERTA | Regla de taller de universidad |

### B4. Radios minimos

| Regla | Numero | Fuente | Estado | Contexto / aviso |
|---|---|---|---|---|
| Radio minimo de herramienta (Stratasys) | 0,050" (1,27 mm) o el espesor de la lamina | https://www.stratasys.com/en/resources/resource-guides/fdm-thermoforming/ — Tabla 1 | ABIERTA | |
| Radio interior (Gabler) | Minimo 0,5 mm en lamina fina; mejor 1-3 mm; radios exteriores ≥ el espesor de la lamina; borde de brida redondeado al menos el espesor | https://gabler-thermoform.com/what-draft-angles-radii-and-wall-ratios-does-thermoforming-require/ | ABIERTA | Fabricante de maquinas |
| Radio minimo (Digital Engineering) | "Mayor que el espesor del material" | https://www.digitalengineering247.com/download/3d-printed-vacuum-form-molds | ABIERTA | Sin valor |
| Radio minimo de contorno | 5/64" (1,98 mm) | Folleto de Eastman | SECUNDARIA | |

### B5. Relacion de estirado y adelgazamiento

| Regla | Numero | Fuente | Estado | Contexto / aviso |
|---|---|---|---|---|
| Relacion maxima de embuticion | 3:1 como maximo en la mayoria de las operaciones al vacio | https://formlabs.com/blog/prototyping-vacuum-forming/ — "A 3:1 draw ratio is generally considered to be the maximum" | ABIERTA | |
| Espesor de lamina de partida | Relacion de embuticion × espesor deseado de la pieza = espesor minimo de lamina | misma pagina | ABIERTA | |
| Relacion de embuticion areal (Stratasys) | 3:1 como maximo | https://www.stratasys.com/en/resources/resource-guides/fdm-thermoforming/ | ABIERTA | |
| Relacion de espesor de pared | Objetivo 3:1 a 4:1 (la pared mas fina es un tercio de la lamina); revisar si se acerca o pasa 4:1 | https://gabler-thermoform.com/what-draft-angles-radii-and-wall-ratios-does-thermoforming-require/ | ABIERTA | |
| Adelgazamiento en las paredes casi verticales de un bloque | Alrededor del 50 % | https://es.formech.com/blog/formech-technical-newsletter-tooling-materials-8 | ABIERTA | Con una cuadricula impresa de 10 mm en la lamina se ve donde estira mas |
| Contraccion de la pieza | 0,4 %-0,8 % segun plastico y espesor | https://www.digitalengineering247.com/download/3d-printed-vacuum-form-molds | ABIERTA | |
| Estirado maximo / relacion para vinilo + espuma | — | No se encontro | SIN FUENTE | |
| Temperatura de piel PVC | 180-225 °C (patente de piel de panel); 160 °C o mas para copiar textura de molde (patente japonesa; la espuma de PP puede romperse arriba de eso) | Patentes (resumen del buscador) | SECUNDARIA | No son reglas de proceso: son ejemplos de patentes |

### B6. Material del molde y temperatura

| Regla | Numero | Fuente | Estado | Contexto / aviso |
|---|---|---|---|---|
| PLA vs PETG | PETG recomendado como material del patron impreso; "PLA se ablanda y se deforma con el uso" | https://www.bu.edu/epic/equipment/thermoforming | ABIERTA · VERIFICADA 20/10 (textual) | Universidad (laboratorio) |
| Temperatura de la lamina en ese laboratorio | ABS 260-280 °F (≈ 127-138 °C); PETG y HIPS 260-270 °F (≈ 127-132 °C) | misma pagina | ABIERTA | Conversion mia |
| HDT del PLA Basic de Bambu | 57 °C a 0,45 MPa; 54 °C a 1,8 MPa | https://wiki.bambulab.com/filament-acc/abs-asa-pc/bambu_pla_basic_technical_data_sheet.pdf | SECUNDARIA | Ficha tecnica en PDF, solo el resumen del buscador |
| HDT del PETG (impresion 3D) | — | No se pudo abrir ninguna ficha | SIN FUENTE | Las paginas de Bambu devolvieron error 402/403 |
| Temperatura del molde en casos reales | ~60 °C despues de 5 y de 10 piezas, igual para las tres laminas del ensayo de Formlabs (PETG 0,5 mm a 110 °C, PP 1,0 mm a 130 °C, PE 2,0 mm a 110 °C), con moldes de resina; molde de IPC estable a 75 °C con canales de enfriamiento con agua a 20 °C | https://formlabs.com/global/blog/thermoforming-with-3d-printed-molds-ipc-technical-study/ | ABIERTA | Moldes de resina, no de FDM |
| Resinas de alta temperatura | Rigid 10K: HDT 218 °C; High Temp Resin: HDT 238 °C (a 0,45 MPa) | misma pagina y https://formlabs.com/blog/prototyping-vacuum-forming/ | ABIERTA | Fabricante |
| Enfriamiento entre piezas | 8-10 min para moldes en Grey/Fast Model; 2-3 min en Rigid 10K | https://formlabs.com/global/blog/thermoforming-with-3d-printed-molds-ipc-technical-study/ | ABIERTA | |
| Moldes FDM de PC / ULTEM 9085 | PC: lamina de ABS a 182 °C, el molde se mantiene bajo 104 °C; no recomendado arriba de 182 °C. ASA: no recomendado. ULTEM 9085 con Kydex a 204 °C, molde a 127 °C | https://www.stratasys.com/en/resources/resource-guides/fdm-thermoforming/ | ABIERTA | No son PLA ni PETG |
| Perimetros / relleno del molde de PETG | 3 perimetros para rigidez (un caso); relleno ≥ 30 % | https://fabacademy.org/2025/labs/leon/students/david-fernandez/assignments/week17.html (perimetros); relleno ≥ 30 %: guia de Mayku | ABIERTA (perimetros) / SECUNDARIA (relleno) | La pagina de Mayku dio 404 |
| Molde de MDF | Nada especifico encontrado. Madera en general: "cientos a miles de ciclos"; no usar carton ni espuma azul o rosa (el vacio los deforma) | https://formlabs.com/blog/introduction-to-vacuum-forming/ y https://soa.syr.edu/resources/technology/digital-fabrication/vacuum-forming.php | ABIERTA | Datos genericos de madera, no MDF |
| MDF: piezas y temperatura maximas | — | No se encontro | SIN FUENTE | |

### B7. Cuantas piezas aguanta

| Regla | Numero | Fuente | Estado | Contexto / aviso |
|---|---|---|---|---|
| Moldes impresos en general | "Docenas y docenas" de piezas con buen cuidado | https://formlabs.com/blog/prototyping-vacuum-forming/ | ABIERTA | Fabricante |
| Resina Rigid 10K | IPC: 20 piezas sin degradacion, esperaban unas 50; Formech: 50 piezas por herramienta | https://formlabs.com/global/blog/thermoforming-with-3d-printed-molds-ipc-technical-study/ | ABIERTA | Laminas de 1,5-3 mm de PS / ABS / HIPS |
| Moldes en resina, otros | PETG de 0,5 mm: la calidad bajo despues de ~10 ciclos; PP y PE de 15-20+ ciclos sin llegar a falla | misma pagina | ABIERTA | |
| Molde sin enfriamiento | El primer molde de IPC se rompio y quedo pegado a la pieza despues de 2 ciclos | misma pagina | ABIERTA | |
| Molde FDM de PC | 223 piezas de ABS de 3 mm hasta que la deriva pasa 0,254 mm; reemplazar a las ~285 | https://www.stratasys.com/en/resources/resource-guides/fdm-thermoforming/ | ABIERTA | Ciclo de 2 min 30 s |
| Molde FDM de ULTEM 9085 | 23 piezas de Kydex de 4,78 mm, deriva de ±0,0254 mm tras el primer corrimiento | misma pagina | ABIERTA | |
| Molde FDM de PLA o PETG impreso en una impresora de escritorio | — | No se encontro | SIN FUENTE | Hay que ensayarlo |
| Molde de MDF | — | No se encontro | SIN FUENTE | |

### B8. Acabado superficial que se copia

| Regla | Numero | Fuente | Estado | Contexto / aviso |
|---|---|---|---|---|
| Moldes de resina | "Muy buena rugosidad"; la PS formada salio lisa sin marcas; ~20 minutos de lijado para terminar el molde en Fast Model Resin | https://formlabs.com/global/blog/thermoforming-with-3d-printed-molds-ipc-technical-study/ | ABIERTA | Fabricante. Laminas rigidas de 1,5-3 mm |
| Molde FDM de PETG lijado | "Tuve que lijar la superficie del molde impreso" | https://fabacademy.org/2025/labs/leon/students/david-fernandez/assignments/week17.html | ABIERTA | Estudiante |
| PolyJet | Superficies muy lisas con poco o nada de posproceso | https://www.digitalengineering247.com/download/3d-printed-vacuum-form-molds | ABIERTA | No dice si el acabado se copia a la pieza |
| Textura | Aumenta el desmoldeo necesario | https://formlabs.com/blog/prototyping-vacuum-forming/ | ABIERTA | |
| Las lineas de capa del FDM se copian a la lamina; tapar con relleno o imprimacion | Cualitativo | Resumen del buscador (foros y un articulo de moldes de silicona) | SECUNDARIA | No se probo en moldes de vacio |
| Cuanto se copia la rugosidad del molde en el lado vista del vinilo o en el grano | — | No se encontro | SIN FUENTE | |

---

## C) Conflictos entre fuentes (lado a lado, sin elegir)

| Tema | Fuente 1 | Fuente 2 | Fuente 3 / otra |
|---|---|---|---|
| Radio minimo de doblado del fleje | 0,5 mm a 90° para 0,71 y 1,07 mm (capacidad de maquina, worthytall) | ≈ 0,8 mm (1/32", bgpeck) | "estandar de la industria 1,0 mm" (FAQ del mismo vendedor); R5 mm a 180° (dobladora rotativa, ytdiemaker). Ninguno es norma ni dice a que cara |
| Penetracion | Maximo 0,3 mm dentro de la tabla (Star Packaging) | 0,5-1,5 mm "mas alla del espesor del material" (ytdiemaker) | Son magnitudes distintas (huella en la tabla vs. pasada del filo); no se pueden sumar sin probar |
| Altura de la goma | "8 mm o mas" para espuma (ytdiemaker) | Sobresale 1,0-1,8 mm sobre el filo, para carton (lionpaper) | La primera columna no aclara si es total o lo que sobresale |
| Dureza de la goma para espuma | 50-70 Shore A (ytdiemaker, para cortar espuma) | Esponja blanda 20-30 Shore A / 35-45 Shore 00 (lionpaper, tipos de goma) | Una habla del material cortado, la otra del material de la goma |
| Desmoldeo del macho | 4-5° (Formlabs, prototipado) | 3-4° (Stratasys, FDM) | 1°-5° en envases (Gabler); minimo 2-3° (guia de termoformado de Formlabs) |
| Radio minimo de herramienta de termoformado | 1,27 mm o el espesor de lamina (Stratasys) | 0,5 mm interior en lamina fina (Gabler) | Mayor que el espesor (Digital Engineering) |
| Diametro del agujero de vacio | ≤ espesor de la lamina (Boca y Sover) | 0,5-1,5 mm en los casos de Formlabs (laminas de 1,5-3 mm) | Compatibles en esos casos; para laminas de ~1 mm el limite del paper (≈ 1 mm) queda mas bajo que los 1,5 mm de Glassboard |

---

## D) Lo que quedo SIN FUENTE (no se inventa)

Estos puntos se pidieron y no se encontro dato publico abierto. Hay que medir o preguntar al proveedor. **Son 18 puntos y 20 filas marcadas SIN FUENTE en las tablas** (el punto 6, tabla de HDPE, y el 16, molde de MDF, ocupan dos filas cada uno):

1. Radio minimo del fleje 2 pt / 3 pt como funcion del espesor (solo hay capacidades de maquina).
2. Radio minimo practico en la ranura del tablero cortado con laser.
3. Bisel mas conveniente para vinilo / espuma de 2-5 mm.
4. Cuanto sobresale la goma expulsora para vinilo + espuma de 2-5 mm.
5. Fuerza de corte por mm de perimetro para vinilo / espuma.
6. Dureza y espesor de tabla de corte de HDPE; rotacion de HDPE; cuanto rectificar antes de cambiar.
7. Procedimiento de ajuste de penetracion para vinilo + espuma.
8. Distancia minima entre flejes.
9. Diametro minimo y construccion del sacabocados para ojales dentro del troquel.
10. Muescas y puentes para vinilo y espuma.
11. Desmoldeo para piel de vinilo con espuma.
12. Separacion entre agujeros de vacio.
13. Agujero de vacio y marca en el lado vista del vinilo.
14. Estirado maximo / relacion de embuticion para vinilo + espuma.
15. HDT del PETG de impresion 3D.
16. Temperatura maxima y piezas para un molde de MDF.
17. Piezas que aguanta un molde FDM de PLA / PETG de impresora de escritorio.
18. Cuanto se copia la rugosidad del molde en el grano del vinilo.

(Ademas, quedan como SECUNDARIA y por abrir: separacion 1:1 entre machos de Eastman, remedios del boletin 2 de Formech, plug assist 80 % / 70-75 %, HDT del PLA de Bambu, relleno ≥ 30 % de Mayku, camas de HDPE de Crossco.)

---
