---
name: carga-arb
description: Ciclo completo de una modificacion de BOM en el ERP arb — tabla de carga para Fak, validacion contra el export post-carga, PDF de difusion (formato Leo) y cuerpo del mail. Usar cuando haya que cambiar/agregar/quitar un insumo en la BOM de uno o varios productos terminados, o cuando Fak pida "que quito y que agrego", "el extracto", "el PDF de Leo" o difundir un cambio de BOM. Complementa `verificacion-consumos` (que valida los NUMEROS); esta cubre el PROCESO.
---

# Carga en el arb — de la tabla al mail de difusion

Cinco pasos, en este orden. **Fak carga a mano en el arb**: todo lo que le paso tiene que
poder tipearse sin levantar la vista, y todo lo que verifico tiene que salir del export
posterior, nunca de suponer que cargo lo que le pedi.

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

## 2. Fak carga. Yo no cargo.

El arb no abre en esta PC (memoria `arb_erp_btrieve`). Fak carga a mano y **re-exporta**:
el arb escribe `ARTICULO.TXT`, `INSUMOS.TXT` y `RELACIONES.TXT` en `C:\tmp` (latin-1).

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
    --salida "<Escritorio>\Modificaciones BOM ARB_AAAAMMDD.pdf"
```

- **Se hace DESPUES de cargar y DESPUES de re-exportar.** Es un extracto post-carga, no una
  propuesta. Si lo armo antes, estoy difundiendo lo que pedi, no lo que quedo.
- Una pagina por pieza con la BOM **completa**, no solo la linea que cambio.
- El bloque `ACTUALIZACIONES dd/mm/aaaa` y la nota de fiel extracto van **en todas** las
  paginas. Redaccion impersonal, como Leo: "Se crea...", "Se da de baja...", "Se ajusta...".
- El PDF va **suelto en el Escritorio**, no adentro de la carpeta de la tarea: Fak lo adjunta
  desde ahi.
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
