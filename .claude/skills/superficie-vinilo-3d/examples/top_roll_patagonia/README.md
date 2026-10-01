# Caso: superficie de vinilo del Top Roll Patagonia (01/10/2026)

**Pedido.** Audio del dueño a Carlos Baptista, reenviado a Fak: *"agarrá el 3D del Top Roll,
¿cuál es la superficie que tiene toda la parte de arriba, donde va el vinilo? En metro cuadrado.
Me decís eso del trasero y del delantero, qué superficie tiene material"*. Dos horas despues
pidio agregar *"el consumo del proceso actual, con una imagen"*.

**Entregado.** `1- GENERAL\2. CONSUMO DE MATERIAL BOM\BOMS\VW\PROYECTO VW\PATAGONIA\TOP ROLL\Superficie de vinilo - Top Roll Patagonia.pptx`
(biblioteca de Ingenieria), 9 hojas, y dos mails a Pedro Ergo, Andres Santoro y Carlos Baptista
(12:04 el primero, 12:31 el reenvio con el consumo). Fak: *"me encanta el power point"*.

## Los numeros

| | Delantero (N 216 / N 256 · 2HC 868 087 / 088) | Trasero (N 285 / N 315 · 2HC 868 605 / 606) |
|---|---|---|
| A la vista | 0,10 m² (960 a 1.010 cm² segun el borde) | 0,10 m² (978 a 1.040 cm²) |
| Borde que se dobla | 0,04 m² | 0,04 m² (incluye ~68 cm² del hueco del parlante) |
| **Pieza de vinilo recortada** | **0,140 m²** (1.401,03 cm² exactos) | **0,138 m²** (1.375,42 cm² exactos) |
| Piel terminada del cliente (borde mas corto) | 1.190,10 cm² | 1.134,41 cm² (la `Surface.24` del 3D oficial VW: 1.133,9) |
| Cara vista del PLASTICO sola | 931,8 cm² (continuidad) · 931,5 (rayos) | no se separa: la continuidad se cuela al dorso |
| Espesor piel–plastico | 2,00 mm | 2,00 mm |
| Patron de corte en plano | 1.401,70 cm² (`Top Roll Front V1.2.dxf`, 26/01/2026) | 1.436,10 cm² (`Top Roll rear V4.1 IZQ.dxf`, 18/05/2026; contorno abierto 14,83 mm, cerrado con un tramo recto) |
| Lista de materiales del cliente (09/2024) | 0,14 m² | 0,13 m² |
| Consumo cargado en el arb | 0,275 m de rollo de 835 mm = 0,23 m² | idem |

Consumo del proceso: lamina de 835 × 1.100 mm, 4 piezas por lamina (molde de 4 cavidades),
0,275 m de rollo por pieza. De los 0,23 m², 0,14 queda en la pieza y 0,09 es recorte.

**Lo que quedo dicho con reserva:** el largo de lamina de 1.100 mm esta fotografiado en la
pantalla con el molde N° 2 (10/09/2026); para el otro molde se apoya en la frase de Fak
*"creo que hoy en día ambos quedaron en 1100mm"* y en una lectura indirecta del 18/09. Y no se
confirmo si el molde de la foto es el delantero o el trasero.

## Las fuentes (rutas)

`LEG = Y:\BARACK\CALIDAD\DOCUMENTACION SGC\PPAP CLIENTES\NOVAX\Tapizadas puerta`

- 3D con la piel: `LEG\6-Planos de la pieza\3D\00- 3D sin Edgefolding\VW Patagonia Front|Rear Door Final Trimmed Skin 3-17-2026.step`.
  Los mando GS Engineering (Lucy Wu) a Carlos el 18/03/2026: mail en
  `LEG\16-...\04 -Tooling\IMG +Edge Folding\GS\5_Validaciones\Maquinas King Power\Re VW Patagonia IMG Trimming Line Review and Approval - Urgent.eml`.
  Exportados de Onshape: `--ejes x,-z,y`. Traen sustrato (+ refuerzo en el delantero) y las dos pieles.
- Patrones: `LEG\13-Especificaciones de Ingenieria F\02 -Computo Tizada de Corte- Consumo de Materiales\TOP ROLL\`.
- Lista del cliente: `LEG\13-...\01- Documentacion Novax\Copia de Attachment1-BOM-PATAGONIA-DP-2024-9-9.xlsx`, renglones 42 y 93.
- BOM del arb en el legajo: `LEG\7-Lista de materiales preliminares\01_BOM MATERIAL\BOM ARB ultimo nivel_Top Roll_20260928.pdf`.
- Ancho de rollo: `Z:\arb\oc\ocauto\BA\OC15873-HAARTZ CORPORATION.PDF` ("ROLL WIDTH IS 835 MM +/- 13 MM").
- Proceso: `...\5- VIDEOS Y FOTOS\1- CLIENTES\NOVAX\TOP ROLL\MAQUINA MOLDEADORA IMG\.claude\fotogramas de cada video\`
  `0631\0631_02.jpg` (el molde desde arriba, 4 cavidades) y `0830\0830_09.jpg` (pantalla, "Largo Lámina +1100,0 mm").
- Material: TPO 0,5 mm + espuma 2 mm (Haartz), codigo arb `427VIN005COR01`. Fak y el dueño le dicen "vinilo".

## Como se verifico

- Medicion de control por un agente independiente con gmsh (otra malla, sin decirle los
  numeros): areas exactas identicas (1401,035 / 1190,102 / 1375,422 / 1134,408 cm²); apoyada
  a menos de 3 mm 1007,0 y 1037,5 (aca 1010,3 y 1040,4); coincidencia de las dos pieles 960,2 y
  975,5 (aca 960,4 y 978,3). Misma lectura de que es cada piel. La primera medicion del dia,
  con la malla sin subdividir, habia dado 970 y 985: 1 % arriba.
- El patron del delantero da lo mismo que la piel recortada del 3D (0,05 %). El del trasero da
  4,4 % mas y es de una fecha posterior al 3D: se mostraron los dos.
- `numeros_referencia.json` es lo que tiene que volver a dar `sv_medir.py` sobre estos archivos.

## Lo que costo tiempo (para no repetirlo)

1. Medir con `analyze_step.py` cinco archivos pesados: 10 minutos tirados.
2. Tres cargas del mismo STEP (inventario, adyacencia, malla) en vez de una.
3. Lanzar la medicion de control al final: tardo una hora (la PC estaba sin memoria por otra
   sesion) y el primer mail salio antes de tenerla.
4. Entregar la primera version sin las capturas de las fuentes: hubo que rehacerla.
5. El primer `sv_medir` subdividia en cuatro: 5,9 GB de memoria.
6. La primera version del medidor daba numeros en los modos de una piel y sin piel sin
   haberlos probado: la auditoria (Opus) encontro seis fallas reales y la prueba a ciegas
   (una sesion nueva siguiendo solo el instructivo) otras dos y seis huecos del instructivo.
   Las dos pruebas se lanzan ANTES de dar por terminada una herramienta, no despues.

En el mazo que se mando el 01/10 la hoja del patron no decia que el contorno del trasero viene
abierto 14,83 mm; el ejemplo de esta carpeta ya lo pone al pie.
