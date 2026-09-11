# Modos de falla del arb, modales y export

Lo que el programa hace mal o distinto de lo esperado, con su medicion al lado. Se lee cuando una
tanda fallo o cuando aparece un cartel que no reconozco. El flujo normal esta en `../SKILL.md`.

> Dos secciones se corrigen entre si a proposito: el modal y la ventana se daban por imposibles de
> manejar el 07/08 y el 20/08 se probo que no. La version vigente es siempre la de fecha mayor.

### El arb puede tirar `HEAP CORRUPTION DETECTED` `visto 2026-08-06`

Cartel `Microsoft Visual C++ Runtime Library` → *"Debug Error! … HEAP CORRUPTION DETECTED …
CRT detected that the application wrote to memory after end of heap buffer"*, con botones
**Anular / Reintentar / Omitir**.

Es un bug del propio arb: se pisó su memoria. Apareció después de ir y venir varias veces
entre solapas y exportar. **Mientras el cartel está, la ventana no responde a nada** — los
clicks en las solapas no hacen efecto y parece colgada. Ese es el síntoma que hay que
reconocer.

- **Anular** y reabrir el programa. Es lo correcto.
- **Omitir** deja al programa siguiendo con la memoria ya corrupta. Con consumos de
  producción de por medio, no.
- Después de reabrir: **re-exportar y diffear contra el respaldo previo**, para confirmar que
  no quedó nada raro. En este caso no quedó.

Detectarlo es una línea: enumerar las ventanas del proceso del arb y buscar clase `#32770`
con título `Microsoft Visual C++ Runtime Library`. Conviene chequearlo antes de decidir que
"la ventana está trabada".

### Reintentar es seguro, y hace falta `2026-08-06`

La tanda no sale de una: el TAB se pierde de vez en cuando y el recorrido se desfasa. Real:
8/15 → 3/7 → 3/4 → 1/1. Cuando falla, **falla sin escribir** (el gate compara el contenido de
cada celda y aborta antes del ENTER), así que no deja nada a medias.

**Reintentar no puede pisar dos veces**: el gate de `valor_esperado` compara contra lo que hay
antes de escribir, así que una pieza ya cargada se rechaza sola con *"tiene X y esperaba Y —
no lo piso"*. Eso es un éxito del reintento, no un error.

Cuando una pieza falla, la siguiente suele fallar con "la ventana no está activa" — efecto
dominó del estado que quedó. No significa nada: se reintenta y entra.

### El tope del arb es 99,999999 y su cartel delata la coma perdida `CONFIRMADO`

Al escribir un consumo **se perdió la coma**: `0,29867000` entró como `029867000`. El arb lo
leyó como veintinueve millones y abrió un modal propio:

```
clase #32770 · título "Error" · [Static] "Valor Fuera de Rango (99.999999)" · [Button] Aceptar
```

Dos cosas que valen para siempre:

- **El campo `Cantidad` topea en 99,999999.** Cualquier valor ≥ 100 lo rechaza el programa. Eso
  convierte la coma perdida en una falla **ruidosa**, no silenciosa — es la tercera red, después
  del gate de foco y del gate de contenido, y es la única que no depende de mi código.
- **Detectarlo es una línea**, igual que el `HEAP CORRUPTION`: enumerar las ventanas visibles del
  proceso `produc.exe`, buscar clase `#32770`, y leer el `Static` de adentro. Leer no roba el
  foco, así que se puede diagnosticar sin tocar la sesión de Fak. Vale la pena chequearlo
  **antes** de concluir "la ventana no responde": puede haber un modal esperando `Aceptar`.

Secuencia para salir: **`Aceptar` en el modal → `CANCELA` en la solapa de Altas → recién ahí
exportar.** Nunca `ACEPTA` ni `ESC` con una celda escrita a medias.

### 🔴🔴 EL EXPORT DEJA EL ARCHIVO TOMADO POR EXCEL `CONFIRMADO 2026-08-07`

**La salida `Tabla EXcel` abre `C:\tmp\RELACIONES.TXT` en Excel, y Excel se queda con el
archivo.** El export siguiente **falla en silencio**: el arb no avisa nada, el `mtime` no
cambia, y uno se queda mirando el botón `ACEPTA` creyendo que está roto. Perdí media hora acá.
Lo cazó Fak: *"es como que sale un error de que tenés otro Excel abierto con el mismo nombre"*.

Peor: Excel abre además un cartel **"De forma predeterminada, Excel realizará las siguientes
conversiones de datos: • Quitar ceros iniciales"** con botones `Convertir` / `No convertir`.
⚠ **Nunca `Convertir`**: sobre un consumo que arranca con ceros, sacarle los ceros iniciales destruye
el dato. Se contesta **`No convertir`** y se cierra Excel.

**Gate antes de exportar:** que no haya proceso `EXCEL.EXE` con `RELACIONES.TXT`, y que el
archivo se pueda abrir en modo append. Si no:

```python
open(r'C:\tmp\RELACIONES.TXT', 'a').close()   # PermissionError = alguien lo tiene tomado
```

**Después de cada export, cerrar Excel.** Si no, el próximo export no sale.

### 🔴 EXPORTAR: el combo se RESETEA al cambiar de solapa `CONFIRMADO 2026-08-07`

El `Salida` vuelve a **vacío** cada vez que se entra a la solapa `Listado`. Con el combo vacío,
`ACEPTA` no hace nada — y ahí se pierden diez minutos creyendo que el botón está roto.

Y el click sobre el combo **no le da el foco** (ya estaba anotado): el arb se lo queda en
`Desde Artículo`. La receta que funciona, entera:

```
click en la solapa `Listado de Insumos de Un Producto`
click en el campo `Desde Artículo`      <- foco real
TAB TAB                                  <- ahora sí, foco en el combo Salida
↑ x8                                     <- pisar en la opcion 0, venga de donde venga
↓ x3                                     <- 3 = Tabla EXcel
>>> FOTO Y MIRARLA <<<                   <- GATE, ver abajo
ENTER ENTER ENTER                        <- 1 dispara ACEPTA, los otros cierran el ARB Editor
```

⚠️ **El GATE de la foto no es opcional.** Desde el combo vacío, `↓↓↓` cae en **`Impresora`**, no
en `Tabla EXcel`. Aceptar ahí manda **todo** el listado de relaciones a la impresora de la
oficina. Se verifica con la captura que dice `Tabla EXcel` **antes** de apretar ENTER.

El export abre una ventana `ARB Editor - Listado de Relaciones` y **tarda ~60 s en terminar de
escribir** `C:\tmp\RELACIONES.TXT`. Leer el archivo antes da un tabulado **cortado a la mitad**
que parsea sin error. **Esperar a que el tamaño se estabilice** (y que pasen unos segundos desde
el último cambio de mtime) antes de verificar.

### 🔴🔴 UNA CELDA SUCIA ENVENENA TODAS LAS CORRIDAS SIGUIENTES `CONFIRMADO 2026-08-07`

**Es el hallazgo más caro del día.** Una escritura fallida deja el valor podrido en la celda, y
ese valor **sobrevive a volver a entrar el producto**: el arb mantiene el buffer de edición del
registro abierto. `chequear_pantalla` no lo caza porque **compara códigos, no valores**.

Consecuencia: la primera falla real fue una coma en la tabla; las tres corridas siguientes
fallaron **por la basura que dejó la primera**, con mensajes que apuntaban a otro lado
("la ventana perdió el frente"). Se persiguió el síntoma durante una hora.

**Gate: después de CUALQUIER corrida fallida, resetear la ventana antes de reintentar.**
`&Cancela` suele estar deshabilitado; lo que sí funciona es **`WM_CLOSE` a la ventana
`Maestro de Relaciones`**: descarta la edición, no pide confirmación y no graba (probado). Después
hay que reabrirla — y eso lo tiene que hacer una persona (ver abajo).

**Y verificar los valores, no sólo los códigos**, antes de escribir: leer las celdas de
`Cantidad` y compararlas contra la BOM del export. Si alguna no coincide, la ventana está sucia.

### 🔴 EL SEPARADOR DECIMAL: la regla completa `CONFIRMADO 2026-08-07`

| qué se manda | resultado |
|---|---|
| coma, con o sin foco | **se strippea siempre** — `0,123` queda `0123` |
| punto, sin foco | **se strippea** — `0.0005070` quedó `00005070` |
| punto, con foco | entra bien |

O sea: **la tabla va en punto Y la celda tiene que tener el foco.** Cualquiera de las dos que
falte produce un número multiplicado por 10^n → `Valor Fuera de Rango` → modal → todo lo demás.

Ojo: escribir por mensaje **no es determinístico**. En la misma sesión, la misma secuencia
`EM_SETSEL` + `WM_CHAR` una vez reemplazó el valor y otra vez no hizo nada. **No improvisar
escrituras sueltas sobre la ventana viva**: se usa el cargador, que verifica cada celda.

### 🔴 LA CAUSA RAÍZ DE LA COMA: la grilla usa PUNTO, el export usa COMA `CONFIRMADO 2026-08-07`

```
grilla en pantalla   0.0005070     ← PUNTO, 7 decimales
export RELACIONES    0,00050700    ← COMA,  8 decimales
```

**La tabla del cargador se arma con el valor en formato GRILLA (punto).** Si se genera desde el
export y se deja la coma, el arb se la come y el número entra multiplicado por 10^n → `Valor
Fuera de Rango`. Las tandas de 14/14 y 16/16 andaban porque sus CSV tenían punto; la del 07/08
falló porque generé el CSV desde el export. `valor_esperado` puede quedar con coma: se compara
con `num()`, que normaliza. **El que importa es `valor_nuevo`.**

Verificarlo cuesta un comando y no roba el foco: `python scripts/_arbUI.py --leer`.

### 🔴 LA GRILLA NO ARRANCA SIEMPRE EN LA FILA 1 DE LA BOM `CONFIRMADO 2026-08-07`

**La posición del scroll es un estado que cambia solo, y el cargador no la mira.** Medido dos
veces sobre la misma pieza, con minutos de diferencia: una vez las celdas visibles eran los
renglones 3-6 de la BOM, otra vez los renglones 2-6. La cuenta `3 + 5*i` da por sentado que
**fila visible 0 == renglón 0 de la BOM**, y cuando la grilla está corrida escribe en el renglón
equivocado. Ahí el arb rechaza el valor y abre el modal — que es el `Valor Fuera de Rango` que
apareció en las tres tandas del 07/08 y que se veía como "la ventana perdió el frente".

**Cómo detectarlo sin escribir nada:** enumerar los hijos de la ventana, quedarse con los
`RichEdit20A` cuyo texto matchea `\d+\.\d{7}` (ésas son las celdas de `Cantidad`) y comparar esa
secuencia contra la BOM del export. **Si la primera no es el renglón 0, la grilla está corrida.**

```python
celdas = [t for h, c, t in ctrls if re.fullmatch(r'\d+\.\d{7}', (t or '').strip())]
# comparar `celdas` contra [f[5] for f in bom] para sacar el offset real
```

Mientras el cargador no mida ese offset y lo sume al recorrido, **una tanda sólo es confiable si
se verifica que la grilla arranca en el renglón 0** — y si no, se re-entra la pieza hasta que
así sea. Este es el arreglo pendiente número uno del robot.

### 🔴 EL MODAL BLOQUEA TODO Y NO SE CIERRA POR MENSAJE `CONFIRMADO 2026-08-07`

Mientras el `#32770` está abierto, `Maestro de Relaciones` y `Producción` quedan
**`IsWindowEnabled == False`**. Todo intento de escribir falla con *"no pude poner el foco en el
control antes de escribir"* — **en las 12 piezas, sin excepción**. Ese error en masa no es un
problema de foreground: **es el síntoma de un modal olvidado**.

Y **`BM_CLICK` sobre su botón `Aceptar` NO lo cierra**, igual que no graba el `&Acepta` de la
grilla. ~~El modal lo tiene que cerrar una persona con un click real.~~ **CORREGIDO 20/08: el
click real lo puedo dar yo** — `python scripts/_arbVer.py modal`. Ver la tanda del 20/08.

**Gate obligatorio al arrancar CUALQUIER tanda** (y antes de cada reintento): enumerar las
ventanas visibles de `produc.exe`; si hay un `#32770`, **abortar de entrada** pidiendo el click,
en vez de gastar 12 productos descubriéndolo. El 07/08 corrí dos tandas contra un modal abierto
desde la primera.

### 🔴 LA GRILLA GUARDA 7 DECIMALES, NO 8 `medido 2026-08-20`

Se cargó `0.00123077` y quedó **`0,0012307`**: el arb **trunca**, no redondea. El export lo
devuelve como `0,00123070` (8 posiciones, la última siempre 0).

**Las tablas se generan con 7 decimales REDONDEADOS** (`ROUND_HALF_UP`), no con 8 truncados:
truncar sesga todo el lote para abajo. El error queda en ~0,005%, muy adentro del 0,1%, pero
es gratis no tenerlo.

### 🟢🟢 EL MODAL LO PUEDO CERRAR YO `CONFIRMADO 2026-08-20` — corrige lo que dice arriba

La sección del 07/08 dice *"el modal lo tiene que cerrar una persona con un click real"*. La
primera mitad es falsa. `BM_CLICK` no lo cierra —igual que no graba el `&Acepta`, mismo patrón
de todo lo sintético en este `.exe`—, pero **un click real del mouse sobre su botón `Aceptar`
sí lo cierra**. Medido: 1 modal → 0.

```bash
python scripts/_arbVer.py modal      # cierra los #32770 con click real
```

### 🟢🟢 LA VENTANA LA PUEDO REABRIR YO `CONFIRMADO 2026-08-20` — corrige lo de arriba

La otra mitad que era falsa: *"reabrir la ventana después de cerrarla requiere una persona"*.
Cierto que `Y3` no abre nada -el KeyTip es `Y03`, corregido el 25/08-, y **el boton tambien se abre con un click
real** en (298, 95) de la ventana `Producción`, con la solapa `Menú de Insumos` ya activa.

Eso completa el ciclo de recuperación **sin intervención**, que es lo que hacía que una celda
sucia terminara la tanda:

```bash
python scripts/_arbVer.py reset      # cierra modales + WM_CLOSE + reabre + solapa Altas
```

**`CANCELA` no limpia la celda sucia** cuando el rechazo vino de una validación del arb: se
cliqueó dos veces y la ventana siguió clavada en la misma pieza con el valor escrito. Lo único
que la saca es `WM_CLOSE`.

### 🔴 MODAL NUEVO: `No Ingreso Procesos` — sin Módulo/Proceso el arb NO GRABA

Tres líneas del lote (`APLIX 20 X 20`, `APLIX-TROQ`, `P280828`) tienen **Módulo y Proceso
vacíos** en el export. Al llegar a `&Acepta` el arb abre `Error / No Ingreso Procesos` y no
graba. La pantalla queda con el valor escrito y el foco en la celda `Módulo` en amarillo.

Peor: **el modal quedó abierto y se llevó puestas las 2 líneas siguientes** del lote con
"no pude poner el foco" — el síntoma en masa que ya estaba documentado.

**Gate antes de armar el lote**: descartar las líneas cuyo Módulo o Proceso vengan vacíos del
export. No se completan por cuenta propia: el sector donde se consume un material es dato
técnico (regla `core-prohibiciones` §1), va **TBD** y se reporta.

```python
mod, proc = g(r, 6), g(r, 7)
if not mod or not proc:      # el arb va a rechazar el renglon entero
    fuera_del_lote.append(pn)
```

### Después de exportar, la ventana queda en la solapa `Listado`

Ya estaba anotado que el foco queda ahí, pero no que **el cargador aborta por eso**:
*"no veo la grilla de insumos: la ventana está en otra solapa"*. Entre el export y el
`--apply` va siempre un `click 118 68` (solapa `Altas`). El comando `reset` ya lo hace.
