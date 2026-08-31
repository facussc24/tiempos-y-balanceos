---
name: carga-arb
description: Ciclo completo de una modificacion de BOM en el ERP arb — tabla de carga para Fak, validacion contra el export post-carga, PDF de difusion (formato Leo) y cuerpo del mail. Usar cuando haya que cambiar/agregar/quitar un insumo en la BOM de uno o varios productos terminados, o cuando Fak pida "que quito y que agrego", "el extracto", "el PDF de Leo" o difundir un cambio de BOM. Complementa `verificacion-consumos` (que valida los NUMEROS); esta cubre el PROCESO.
---

# Carga en el arb — de la tabla al mail de difusion

Cinco pasos, en este orden. **La carga en el arb la hace la sesion** (ver §2); la tabla se
arma igual, porque es lo que Fak revisa antes y lo que queda como rastro de la tarea. Todo
lo que se verifica tiene que salir del **export posterior**, nunca de suponer que quedo
cargado lo que se pidio.

## 1. Armar la tabla de carga

Una sola tabla plana, **una fila por producto terminado** aunque el cambio se repita igual:

| Producto terminado | Quitar | Agregar | Sector | Unid | Consumo |
|---|---|---|---|---|---|
| `<cod. producto>` | `<cod. que sale>` | `<cod. que entra>` | `<MODULO / PROCESO del que ENTRA>` | `<unidad>` | `<consumo>` |

- **El Sector es el del insumo que se AGREGA**, nunca el del que se quita. El que sale se
  borra y listo: su modulo no le sirve para nada, y mostrarlo lo hace pensar que tiene que
  mover algo de lugar.
- **Sector y unidad van SI o SI adentro de la tabla.** Sin ellos tiene que ir a buscarlos al
  arb, que es justo lo que la tabla viene a evitar.
- **NO va:** descripcion del insumo, secciones por producto, ni mi razonamiento.
- Lo que frena la carga (un dato que no cierra, una medida a confirmar) va **abajo de la
  tabla, en dos lineas**. Nunca arriba ni intercalado.
- Si el codigo que sale y el que entra tienen **unidades distintas** en el maestro (`UN` vs
  `UNID`), decirlo: el arb no deja pisar la linea, hay que borrar y crear.

Detalle y el porque: memoria `feedback_formato_carga_arb`.

### Fijar el alcance con una cuenta, no con el nombre del producto

Antes de listar las piezas, **buscar el numero que las cierra**. El pedido casi siempre trae
un consumo diario o un volumen; si la cuenta da exacta, el alcance esta probado. Caso real del
04/08/2026: el volumen diario de bolsas del pedido daba clavado con (vehiculos x 2 delanteros)
+ (vehiculos de cierta version x 1 trasero), y eso descarto de un plumazo otras 8 referencias
de la familia que por nombre parecian entrar.

⚠ Ese numero **se queda en el analisis**: no sube al mail de difusion (ver §5) ni se escribe
en este archivo — el repo es publico y los volumenes de produccion son datos de la empresa.

### El ALCANCE lo fija el pedido, no lo que uno encuentra barriendo

Leer el mail que origino la tarea y quedarse **dentro de su alcance**. El 04/08/2026 se armo
una tabla de carga cruzando el arb entero y quedaron adentro piezas de otro proyecto, que el
pedido nunca menciono. Si aparece un desvio real fuera de alcance, se reporta aparte — no se
mete en la carga, porque Fak la ejecuta creyendo que es lo que le pidieron.

Los codigos y sectores actuales salen del export crudo, **nunca del cache**:

```bash
grep -a "^<PN>" /c/tmp/RELACIONES.TXT     # BOM cruda; ultimas 2 columnas = modulo y proceso
grep -a "<codigo>" /c/tmp/INSUMOS.TXT     # maestro: existe? con que unidad?
```

⚠ `grep` NO interpreta `\t` como tabulador (en BRE es la letra `t` literal). Un patron como
`"^<PN> *\t"` da **cero coincidencias siempre**, y eso se lee como "no existe". Para matchear
por columna, parsear con Python/node y comparar `campos[0].strip()`, no con grep.

### Gate: descartar los productos ANULADOS antes de armar la tabla

**Un producto puede seguir teniendo lineas en `RELACIONES.TXT` despues de dado de baja: la BOM
queda huerfana.** Si entra en la tabla, Fak carga algo que no existe.

Se detecta cruzando contra el maestro: **si el codigo NO esta en `ARTICULO.TXT`, esta anulado.**

```bash
python scripts/_pdfBomArb.py --verificar-vigencia "<PN1>,<PN2>,..."
```

Incidente 04/08/2026: le pase 6 productos para cambiar un isocianato discontinuado y uno
estaba anulado. Me lo marco el: "ojo con pasarme cosas muy viejas". El maestro tenia 2290
articulos y el unico ausente era exactamente ese — el cruce lo hubiera cazado solo.

Ojo con la frescura: el arb exporta los tres archivos por separado y Fak puede re-exportar
solo `RELACIONES`. Si `ARTICULO.TXT` quedo viejo, un alta reciente da falso "anulado" —
mirar las fechas de los tres antes de creerle al cruce.

### Alta de un codigo nuevo — validar el DV ANTES, siempre

Si el pedido es **dar de alta** un codigo de proveedor con formato `NNN.NNN.NNNN-N`
(Sansuy y cia.), correr esto antes de armar nada:

```bash
python scripts/_dvArb.py 123.456.7890-0        # uno o varios codigos
```

Llevan **digito verificador modulo 11**, como el CUIT: si el numero viene con digitos
cambiados de lugar, no cierra. Un codigo real del proveedor siempre cierra — asi que
"no cierra" es prueba de que esta mal tipeado, no una sospecha.

Si no cierra: **no darlo de alta**. Buscar en el maestro las permutaciones de esos
digitos que si darian ese DV; la que ya existe cargada es el codigo real. Caso que lo
estreno (05/08): el codigo pedido no cerraba, y el verificador que traia era el de otro
codigo con dos digitos cambiados de lugar que ya estaba cargado con el mismo material.
Crearlo hubiera dejado dos codigos para lo mismo en deposito. Numeros del caso en la
memoria `project_alta_codigos_sansuy_427` (fuera del repo — este es publico).

Y antes de escribir la descripcion, mirar como esta escrita la familia en el maestro:
el campo **corta en 60 caracteres** y a veces corta justo antes de lo que diferencia dos
variantes (ahi nacen los 74 pares de descripciones identicas que reporta el refresh).
Detalle: memoria `reference_arb_digito_verificador`.

### El arb NO dice a que pieza VA a ir un material

El arb responde **que se consume hoy**. No responde **que se va a consumir**. Deducir el
destino de un material nuevo cruzando colores, familias o piezas parecidas del arb es
inventar con pasos intermedios: los productos del arb no estan todos cargados, y una
pieza puede existir en varios colores y llevar el material en uno solo.

Si preguntan a que pieza va un material que todavia no tiene consumo: contestar el dato
duro (**"hoy no se consume en ninguna"**, que es una respuesta, no un "no se") y mandar
la pregunta del destino a Ingenieria. Para afirmarlo hace falta el **plano y el PPAP**,
no el ERP. Detalle: memoria `feedback_destino_material_se_verifica_en_planos`.

## 2. La carga la hago YO. Lo unico de Fak es loguearse.

⚠ Esta seccion decia **"Fak carga. Yo no cargo"** y estaba DESACTUALIZADA — corregido el
31/08/2026. Las cargas las hace la sesion desde el 05/08 (skill `arb-operar`, memoria
`feedback_arb_lo_opero_yo_y_lo_mejoro`): consumos con `_arbCargar.py`, altas con
`_arbAlta.py` / `_arbAltaLote.py`, y **cambiar el CODIGO de una linea que ya existe con
`_arbSustituir.py`** (estrenado el 31/08 con el remache de ductos: 1/1, diff del archivo
entero 1 alta / 1 baja / 0 cambios de mas). Fak, 31/08: *"incluso ahora las altas y bajas
las hacen las sesiones, no yo"*. Lo unico sin probar sigue siendo **borrar** una linea.

Lo que SI necesita a Fak: la pantalla `Inicio de Sesion` del arb, que pide usuario y
contraseña. La sesion no tipea contraseñas. Por eso **el arb no se cierra sin consultarle**
— regla `arb-no-cerrar.md`, hook `arb-cerrar-guard.sh`.

Despues de cargar hay que **re-exportar**: el arb escribe `ARTICULO.TXT`, `INSUMOS.TXT` y
`RELACIONES.TXT` en `C:\tmp` (latin-1). Con `python scripts/_arbVer.py export`.

## 3. Validar contra el export nuevo — antes de creerle a nadie, ni a mi

```bash
ls -l --time-style=+"%Y-%m-%d %H:%M" /c/tmp/*.TXT   # los tres, de la misma tanda?
```

**Chequeo que no puede faltar: que el export no venga truncado.** El arb a veces lo corta y
no avisa. El 04/08/2026 salio de 242 KB contra 819 KB del dia anterior, terminado a mitad de
linea. Un extracto armado sobre eso dice "esta pieza no tiene tal insumo" cuando lo que falta
es el archivo. `_pdfBomArb.py` lo chequea solo (ultima linea cortada + conteo de lineas), pero
mirarlo igual: **que un archivo sea de hoy no quiere decir que este entero.**

Cuatro verificaciones, todas contra el export nuevo:

1. Cada producto tiene el codigo nuevo, con la unidad, el consumo y el sector pedidos.
2. **Las lineas viejas desaparecieron** — que no quedaron las dos conviviendo.
3. Los productos que NO entraban en el alcance siguen como estaban.
4. El bloque de la familia esta completo (si faltan piezas que antes estaban, volver arriba:
   el export esta cortado, no es que las borro).

## 4. El PDF de difusion — formato Leo

```bash
python scripts/_pdfBomArb.py --piezas "<PN1>,<PN2>" --fecha dd/mm/aaaa \
    --act "Se crea part number ... " --act "Se da de baja ... " \
    --salida "<biblioteca>\1- GENERAL\2. CONSUMO DE MATERIAL BOM\BOMS\...\Modificaciones BOM ARB_AAAAMMDD.pdf"
```

- **Se hace DESPUES de cargar y DESPUES de re-exportar.** Es un extracto post-carga, no una
  propuesta. Si lo armo antes, estoy difundiendo lo que pedi, no lo que quedo.
- Una pagina por pieza con la BOM **completa**, no solo la linea que cambio.
- El bloque `ACTUALIZACIONES dd/mm/aaaa` y la nota de fiel extracto van **en todas** las
  paginas. Redaccion impersonal, como Leo: "Se crea...", "Se da de baja...", "Se ajusta...".
- El PDF va a su **carpeta POR TIPO de la biblioteca de Ingenieria**:
  `1- GENERAL\2. CONSUMO DE MATERIAL BOM\BOMS\<cliente>\...\<pieza>\`. Desde ahi se adjunta
  al mail. Si la subcarpeta de la pieza no existe, se crea mirando como estan las hermanas
  (APC, IP, TOP ROLL...).
  ⚠ Esta linea decia **"va suelto en el Escritorio"** y estaba DESACTUALIZADA: desde el
  incidente del 28/08 (*"no me dejes cosas en el escritorio"*) el `escritorio-guard.sh`
  **bloquea** generar un entregable ahi. Lo descubri el 31/08 comiendome el bloqueo.
- **Mirar el PDF NO es verificarlo.** El 04/08/2026 se difundio uno con tres filas sin unidad
  ni consumo: se habian abierto 2 de las 5 paginas y las 2 estaban bien. El script hoy corre
  cinco gates y aborta sin dejar archivo; si sale un PDF con el nombre final, es porque paso
  todos. Mirarlo sigue siendo buena idea, pero como segunda lectura, nunca como la prueba.
- **Si se toca `_pdfBomArb.py`**, correr las dos cosas:
  ```bash
  npx vitest run --pool=threads __tests__/scripts/pdfBomArb.test.mjs   # 17 casos
  node scripts/_mutarPdfBom.mjs      # rompe cada defensa y exige que la suite se ponga roja
  ```
  Lo segundo no es opcional: la primera version de esa suite tenia 13 casos en verde y **5 de
  7 defensas sin proteger**. Un test que sigue verde con el bug puesto es un verde vacio.

## 5. El cuerpo del mail

Estructura de Leo, corta:

```
Estimados,

Difundo actualizacion a ultimo nivel de BOM vigente en ARB para las siguientes piezas:

<PN>  ->  <descripcion del producto>
...

<una o dos lineas de QUE cambio>

Saludos,
```

**El mail difunde EL CAMBIO. Nada mas.** No van volumenes, consumos diarios, cantidades de
vehiculos, urgencias, plazos ni el motivo del pedido — aunque esten en el mail que lo origino
y aunque parezcan utiles para Logistica. Dos razones, y la segunda es la grave:

- Los que reciben la difusion ya tienen ese contexto de quien lo pidio. Repetirlo es ruido.
- **Un dato de otro, metido en un mail que firma Fak, deja de ser una estimacion ajena y pasa
  a ser un compromiso de Ingenieria.** Si el volumen cambia, el que queda mal es el.

Incidente 04/08/2026: le puse "Consumo estimado: 900 bolsas/dia para 350 vehiculos" —
proyeccion que habia dado el gerente de Calidad en su pedido. Fak: "esta parte esta de mas,
no la vuelvas a incorporar nunca mas".

**Ojo con los destinatarios:** responder "a todos" al mail que origino el pedido suele dejar
afuera a Logistica, Abastecimiento, Recepcion y Compras — que son justo los que tienen que
enterarse de un cambio de BOM. La lista buena es la del ultimo mail de difusion formato Leo
(esta en la carpeta `Modificacion arb por Leo` del Escritorio, junto con el PDF modelo).
Comparar las dos listas y decirle a Fak a quien le falta agregar.

## Cierre

El cambio de BOM casi nunca viene solo: revisar si tambien hay que tocar **ficha de embalaje**
(`1- GENERAL\FICHAS DE EMBALAJE\<cliente>\<proyecto>\`) y si aplica subir revision.

La tarea del Escritorio **no se archiva hasta que el mail salio** — regla `escritorio-tareas.md`:
trabajo hecho sin avisarle al que lo pidio es tarea abierta.
