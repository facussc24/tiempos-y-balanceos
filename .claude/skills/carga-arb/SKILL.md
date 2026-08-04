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
un consumo diario o un volumen; si la cuenta da exacta, el alcance esta probado. Ejemplo real
(04/08/2026): "900 bolsas/dia para 350 vehiculos, 200 de ellos L2+L3" = 350x2 delanteros +
200x1 trasero central. Da 900 clavado, y eso descarto de un plumazo las otras 8 referencias
de la familia, que por nombre parecian entrar.

Los codigos y sectores actuales salen del export crudo, **nunca del cache**:

```bash
grep -a "^<PN>" /c/tmp/RELACIONES.TXT     # BOM cruda; ultimas 2 columnas = modulo y proceso
grep -a "<codigo>" /c/tmp/INSUMOS.TXT     # maestro: existe? con que unidad?
```

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
- **Abrirlo y mirarlo antes de pasarlo** (renderizar con `fitz` a PNG y leer la imagen).

## 5. El cuerpo del mail

Estructura de Leo, corta:

```
Estimados,

Difundo actualizacion a ultimo nivel de BOM vigente en ARB para las siguientes piezas:

<PN>  ->  <descripcion del producto>
...

<una o dos lineas de que cambio y por que>

Saludos,
```

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
