---
name: arb-operar
description: Operar el ERP arb (ARB Sistemas "Producción") por teclado desde Claude — navegación, pantallas, y carga/modificación de consumos en Relaciones de Consumo. Usar cuando haya que cargar o corregir consumos en el arb, verificar una carga, o automatizar cualquier tarea repetitiva dentro del ERP. Complementa `carga-arb` (que arma QUÉ cargar) y `verificacion-consumos` (que valida los números); esta cubre CÓMO se opera el programa.
---

# Operar el arb desde Claude

> **EN CONSTRUCCIÓN** (arrancada 2026-08-04). Lo que está marcado `CONFIRMADO` se probó;
> lo marcado `POR CONFIRMAR` es hipótesis y **no se ejecuta sin verificar antes**.

## Qué es

`Z:\arb\prod\produc.exe` — **"Producción y Almacenes", ARB Sistemas**, versión 14.05.26.
App Borland C++ de ~2000, sin soporte (el programador original falleció). Multiempresa:
la empresa activa se ve abajo a la derecha (`Empresa : BA` = Barack Argentina SRL).

Módulos hermanos, mismo estilo: `Z:\arb\compras\compras.exe` · `Z:\arb\oc\moc.exe` ·
`Z:\arb\ventas\ventas.exe`.

**Los datos NO son alcanzables por red.** No hay `.DBF` ni `.DDF` accesibles desde `Z:`; el
driver *Pervasive ODBC Interface* está instalado en la notebook pero sin diccionario ni DSN.
El `.exe` tampoco tiene importación masiva de BOMs (su "Importa Novedades de Central" es
sincronización entre empresas, otra cosa). **Por eso la única vía de automatización es la
interfaz.** Ver la sección de seguridad abajo antes de escribir nada.

## Regla de oro

**El robot hace exactamente lo que haría Fak, tecla por tecla.** Así el arb aplica sus
validaciones igual — no se entera de que no es una persona. Nunca escribir en los archivos
de datos por fuera del programa: el daño no se ve el día que pasa, se ve semanas después en
el stock.

## Pantalla principal `CONFIRMADO`

Ribbon estilo Office con estas solapas:

`Archivo` · `Movimientos de Insumos` · `Producción` · `Listados de Stock PT` ·
`Consulta de Producción Por Sector` · `Productos Terminados` · `Menú de Insumos` ·
`Maestros` · `Utilitarios`

Barra de estado (abajo): nombre de la pantalla · fecha · `Usuario : FACUNDO` · `Empresa : BA`.

### Cómo llegar a los consumos

`Menú de Insumos` → botón **`Relación de Consumo de Prod. Terminados`**
Abre la ventana modal **`Maestro de Relaciones - BA`**.

## Ventana `Maestro de Relaciones - BA` `CONFIRMADO`

Tres solapas: **`Altas de Insumos de Un Producto`** · `Listado de Insumos de Un Producto` ·
`Escape`.

### Solapa `Altas de Insumos de Un Producto` — acá se carga y se corrige

| campo | coords (pantalla 3840x1080, arb en el monitor izquierdo) |
|---|---|
| `Parte Superior` (el producto terminado) | (559, 368) |
| grilla `Detalle de Insumos`, 6 filas visibles | filas Y = 461, 485, 508, 532, 556, 580 |
| `F1 Consulta de Partes` | abajo a la izquierda |
| `ACEPTA` / `CANCELA` | (442, 798) y al lado |
| `ESC Finaliza` | pie de la ventana |

Columnas de la grilla y su X:

| # | columna | X | qué es |
|---|---|---|---|
| 1 | `Rubro` | 390 | |
| 2 | `Medida` | 493 | **es el código del insumo** (ojo con el nombre) |
| 3 | `Descripción` | 716 | |
| 4 | `U.M.` | 886 | unidad — sale del maestro, no se elige |
| 5 | **`Cantidad`** | **949** | **EL CONSUMO. Es la columna que se corrige.** |
| 6 | `Módulo` | 1041 | |
| 7 | `Proceso` | 1166 | |

> El export `RELACIONES.TXT` llama `Medida` a la columna del código y `Consumo` a `Cantidad`.
> Es el mismo dato con otro rótulo — no confundirse al cruzar.

### Solapa `Listado de Insumos de Un Producto` `CONFIRMADO`

Campos `Desde Artículo` · `Hasta Artículo` · combo `Salida`. Es el generador del reporte;
de acá salen los `.TXT` que después se leen. **Sirve para verificar, no para cargar.**

## Traer la BOM de un producto `CONFIRMADO 2026-08-04`

```
1. Menú de Insumos  →  Relación de Consumo de Prod. Terminados
2. Escribir el código en `Parte Superior`   (ej: 21-7339)
3. >>> TAB <<<   ← ESTA es la tecla que trae los insumos a la grilla
```

Al tabular aparecen la **descripción del producto** al lado del código y **todas las filas de
la BOM**. Verificado en vivo con `21-7339` (TELA TNT 60G/M² RESPALDO TRASERO 100%):
`APLIX-A999R8395` 0,0000246 · `BA 60 90` 0,01 · `ET-SATO-100X60` 0,0000125 ·
`TPP60B-1.5` 0,5608 — calcó el export `RELACIONES.TXT`.

**No es `Shift`+`↑`** (probado dos veces, no hace nada) ni `Alt` (el ribbon no tiene KeyTips)
ni las flechas para cambiar de solapa. La navegación del ribbon es con mouse; **adentro de la
ventana, el teclado sí manda**.

## Mapa de teclas del programa `CONFIRMADO` (extraído del binario)

El autor del arb lo manejaba todo por teclado y **dejó la ayuda escrita adentro del `.exe`**.
Textos literales encontrados:

| tecla | qué hace (texto del programa) |
|---|---|
| `Alt`+`A` | **`Próximo Campo`** |
| `Alt`+`R` | **`Campo Anterior`** |
| `ESC` | **`Avanza a Próximo Campo`** … y también `ESC Finaliza` según el contexto |
| `F1` | `Seleccione Insumo Utilizando F1` — consulta (Partes / Rubros / Medidas) |
| `F3` | `Consulta de Stock Disponible` · `F3 Muestra Stock` |
| `Enter` | `Presione Enter` (confirmar) |

> ⚠️ **`ESC` no cancela: avanza de campo.** En cualquier otro programa ESC es "salir sin
> guardar". Acá no. Un robot que asuma lo de siempre hace cualquier cosa.

`TAB` también funciona (es el estándar de Windows) y es lo que se usa para traer la BOM.

### Dónde está parado el cursor: mirar el botón F1

El botón de abajo a la izquierda **cambia de nombre según la columna** donde está el foco.
Es el indicador más confiable — evita adivinar:

| el botón dice | el foco está en |
|---|---|
| `F1 Consulta de Partes` | campo `Parte Superior` |
| `F1 Consulta de Rubros` | columna `Rubro` |
| `F1 Consulta de Medidas` | columna `Medida` (el código del insumo) |

`TAB` avanza de celda: `Parte Superior` → `Rubro` fila 1 → `Medida` fila 1 → … `ESC` finaliza.

**POR CONFIRMAR:** cuántos TAB hasta `Cantidad`, cómo bajar de fila, y cómo se graba
(¿`ACEPTA`, F-key?). No se prueba dentro de una fila con datos reales sin OK de Fak — un
tabulador de más y se pisa un renglón.

## Seguridad — antes de que el robot escriba

1. **Backup del arb primero.** Existe `Z:\arb\prod\BAK`; confirmar que esté fresco y quién
   lo hace. Sin backup verificado, no se escribe.
2. **Probar con UNA sola fila**, la de menor impacto, y **verificar contra el export**
   (`RELACIONES.TXT`, celda por celda, tolerancia 0,1%) antes de seguir con el resto.
3. **Nunca tantear teclas en la solapa de Altas.** Una tecla de más da de alta un insumo o
   pisa un renglón, y eso aparece semanas después en el stock. Si no se sabe qué hace una
   tecla, se pregunta — no se prueba.
4. Al terminar un lote: exportar `RELACIONES` de nuevo y control completo contra la tabla.

## Exports que genera el programa

A `C:\tmp\` (default del arb, latin-1): `ARTICULO.TXT` · `INSUMOS.TXT` · `RELACIONES.TXT` ·
`CONSUMOS.TXT` · `STOCK.TXT` · `KARDEX.TXT` · `PENDIENTES.TXT` · `COSTOS.TXT` y varios más.
Cómo parsearlos sin perder datos: memoria `reference_arb_export_estructura` y
`.arb-cache/README.md` (el árbol corre +7 columnas por nivel; hay filas partidas).

## Relacionado

`carga-arb` (el ciclo del cambio de BOM) · `verificacion-consumos` (validar los números) ·
memorias `reference_arb_erp_btrieve`, `reference_arb_insumos_maestro`,
`reference_arb_local_cache`, `reference_arb_export_estructura`.
