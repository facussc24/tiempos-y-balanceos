# hojas-de-proceso / reference — §1, §1 bis y §1 ter — criterios de imagen, que hace que una foto explique un paso, y la hoja A3 de una foto por paso

Parte del skill `hojas-de-proceso` (se partio el 16/10/2026, tanda 1.5 del plan del sistema, porque el
SKILL.md tenia 779 renglones). Los gates, la lista de §7 y los errores de §7 bis siguen en `SKILL.md`:
esto se lee cuando el trabajo llega a esta parte, no en vez de aquellos.

---

## 1. Los criterios, con su numero

| # | Criterio | Umbral | Por que ese numero |
|---|---|---|---|
| 1 | Una imagen **principal** por hoja | >= **45 %** de la superficie de foto de la hoja **y** >= **1,6x** la segunda | sobre la TINTA, no sobre el bloque: una foto vertical 9:16 a la altura completa ocupa 32 % y **no puede ocupar mas** |
| 2 | **Lo que hay que leer, se lee** | cuerpo impreso >= **7 pt** | es lo mas chico que Barack imprime en estas hojas (las referencias de EPP) |
| 3 | La principal no es una estampilla | >= **25 %** del bloque | piso absoluto, para que el criterio 1 no se cumpla achicando a las otras |
| 4 | **Lo ajeno no entra** | se recorta o se descarta | celulares de traductor, caras, gente de espaldas, piso vacio, cajas del fondo |
| 5 | **Cantidad** | **2 o 3** en jerarquia · **hasta 4** en secuencia, y con mas la hoja se PARTE | en A4, con 4 fotos de tamaños distintos no se ve ninguna; en secuencia van las 4 iguales en grilla 2x2, 34 cm² cada una |
| 6 | Las pantallas son la **foto real enderezada**, con el rotulo encima | — | ver §3 |

**Un umbral se prueba contra la poblacion entera antes de declararlo** (el primer 45 %
reprobaba 13 de 17 hojas sanas).

---

## 1 bis. Que hace que una foto EXPLIQUE un paso (criterios 7 a 13)

El test: **sin leer nada, ¿se contesta QUE OBJETO y QUE LE ESTA PASANDO?** Si no, la foto
decora. Medido sobre las laminas del 21/09/2026.

| # | Criterio | Como se ve que esta mal |
|---|---|---|
| 7 | **El sujeto del paso llena el cuadro** | En `r_botonera` los cinco comandos que la hoja señala vivian en **2,7 cm de alto** impresos (25 % del area). Recortada a la banda, los mismos botones pasan a 9,3 cm: **3,4x** |
| 8 | **Lo ajeno no es solo gente: es todo lo que ningun renglon nombra** | el cartel del proveedor ocupaba el **36 % del alto** de una foto del ciclo; pared y techo, entre 36 y 41 % |
| 9 | **Una persona entra si sus MANOS son el paso. Si entra su espalda, tapa el paso** | dos operarios de espaldas tapaban el **35 % del ancho** y el molde quedaba en **2,5 cm²**: no se distingue si sacan la pieza o un marco |
| 10 | **En una secuencia, la foto n+1 dice QUE CAMBIO — y va en el orden del reloj** | cuatro fotos del mismo video en los segundos 198 · 153 · 110 · 327: los pasos 1→2→3 iban **para atras**. Y dos con el mismo recorte y el mismo punto de vista no muestran ningun cambio |
| 11 | **El pie describe el instante que la foto MUESTRA**, no el que el paso quiere | el pie decia *"la pieza queda en la cavidad"* y la foto mostraba una mano ya sacandola |
| 12 | **El punto de vista es el del operario parado en el puesto** | una toma centrada de frente al molde es el punto de vista del que filmo, no el del que opera |
| 13 | **Si la accion pasa ADENTRO, la foto del paso es la PANTALLA** | una maquina cerrada es la misma foto para cualquier paso del ciclo |
| 15 | **Lo que la foto del paso MUESTRA y ningun renglon nombra se pregunta: ¿que hace el operario con esto?** | el sensor de la mesa de carga (soporte con cable negro) estaba en la foto del paso 3 de la 30.3 desde el 22/09 y nadie lo nombraba; el material colgando entre el desenrollador y la mesa estaba filmado en dos videos. Fak, 23/09: *"no hablaste del sensor... siempre dejamos el rollo colgando"*. Los pasos salieron de lo que NARRA el audio; lo que MUESTRA la imagen no se miro |

Del 7 y del 14 (*dos chapas no se pisan*) falta el numero: **el umbral se corre antes contra
las 17 hojas de la HOTMELT**, que es la poblacion que hay (§1).

Lo que **si** esta en codigo hoy: el orden del reloj (`_gate_secuencia_en_orden`), que cada
foto de secuencia lleve al menos una marca (aviso: poner la marca obliga a BUSCAR el objeto
en el cuadro, y ahi se ve solo que no esta), y que la foto llene su celda.

Lo que **no ve ningun script** y hay que mirar: si lo que esta en el cuadro es el objeto que
el paso nombra, si el pie describe el instante que se ve, si la persona agarra o tapa, y el
punto de vista.

## 1 ter. La hoja A3 de una foto por paso (formato de Pablo Gamboa)

Fak, 28/09/2026: *"el formato ahora es el que hizo Pablo Gamboa, el A3"* y *"con las FOTOS se
tiene que entender exactamente lo que hay que hacer... menos texto, mas visual"*. Es otra hoja,
no la A4 agrandada:

- **Una foto por paso, en una grilla de baldosas iguales**, cada una con su cartel `REF. n` y
  su pie; el paso termina en *"– Ver REF. n"*. Un paso que no se puede fotografiar va sin REF.
- La advertencia va en el **cuadro amarillo**, al lado de los elementos de seguridad. El ciclo
  de control queda con las filas vacias (canon 1.1 y 1.2).
- **Hasta 15 fotos por hoja** (la HO-992 TAPIZADO Y ENGRAMPADO DE PANEL de Gamboa lleva 15 y la
  HO-971 ENGRAMPADO, 12); el piso sigue siendo **25 cm² y 3,5 cm de lado** por foto. Con mas, la
  hoja se parte. Cada foto lleva su cartel `REF. n` en su propia baldosa: el control los cuenta
  y rechaza dos encimados.
- La grilla se elige por la FORMA de las fotos: el bloque es casi cuadrado, y seis pantallas
  apaisadas en 3 x 2 quedan en baldosas verticales que les cortan la mitad. Si llenar la
  baldosa recortaria mas del 15 %, la foto entra **entera** (queda mas chica, pero no se corta
  el boton marcado ni una columna de la tabla: paso con la consigna del fusor).
- **Pantalla en ingles** (cuando la maquina no tiene castellano): la foto real con el recuadro
  rojo, y el paso dice que es el boton en castellano y cita el rotulo entre comillas:
  *"Presionar el boton 1, inicio de limpieza («Glue removal starts»)"*.

Motor: `scripts/hotmelt/hoja_a3_fotos.py` (`hoja(prs, d)`); ejemplo completo con sus gates,
`scripts/hotmelt/generar_hojas_v3.py`. El control duro la juzga con
`hoja_proceso_check.py "<deck>" --secuencia` (detecta el A3 por el tamano de la lamina).
