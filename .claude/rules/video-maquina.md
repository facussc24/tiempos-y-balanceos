---
paths:
  - "**/_videoBiblioteca.mjs"
  - "**/*telefono*"
  - "**/*.MOV"
  - "**/*.MP4"
---

# Videos y fotos de maquina: donde viven y como se traen del celular

## La ruta (existe, esta poblada, no se inventa una nueva)

```
~\BARACK ARGENTINA SRL\Ingeniería y Proyecto - General\
  INGENIERIA BARACK (NUNCA BORRAR)\5- VIDEOS Y FOTOS\
      1- CLIENTES\<CLIENTE>\<PROYECTO>\<PIEZA o MAQUINA>\
      2- SECTORES\<SECTOR>\
      2. FOTOS DE PIEZAS FONDO BLANCO\<CLIENTE>\<PIEZA>\
      3- INSTITUCIONAL\<AAAA-MM-DD - tema>\
```

## Adentro de una carpeta de MAQUINA: originales arriba, lo mio en `.claude`

Pedido de Fak el 21/09/2026: *"la idea es que esten los archivos originales videos o fotos
originales y todo lo demas dentro de una carpeta que diga .claude algo asi para que no
estorbe tus transcripciones y cosas que hagas"*.

```
MAQUINA <X>\
    AAAA-MM-DD - lo que se ve (IMG_xxxx).MOV|.HEIC|.JPG   <- SOLO originales, planos
    .claude\
        LEEME - que hay aca.txt
        transcripciones\IMG_xxxx.txt        fotogramas de cada video\<xxxx>\
        casos\   material de las hojas\     _duplicados\  (nada se borra: va aca)
```
La raiz **ordena sola por fecha** porque el nombre empieza con la fecha: no se hacen
subcarpetas por dia (ademas los scripts leen la carpeta plana). Lo que genero yo va a
`.claude`; un entregable para una persona va a su carpeta por tipo, no aca.

**Las tres maquinas de la linea Top Roll son tres, y dos se parecen** (21/09/2026):
`MAQUINA MOLDEADORA IMG` es la del HMI ancho *"Moldeadora Hembra"* / 阿根廷阴模成型机 con las
tres banderas; `MAQUINA PRENSA KINGPOWER 1004` es la del panel MCGS chico cuyas pantallas
dicen 压机 (prensa) y llevan el modelo `KINGPOWER -1004` en la cabecera. Un video se
clasifica **mirando el panel**, no por la fecha ni por el lote en que vino.
Es la biblioteca **compartida de SharePoint**, no el OneDrive personal: lo que entra ahi lo ve
el equipo. Ejemplos reales: `1- CLIENTES\NOVAX\TOP ROLL\MAQUINA HOTMELT`, `1- CLIENTES\NOVAX\
TOP ROLL\MAQUINA MOLDEADORA IMG`, `1- CLIENTES\VWA\TAOS\APC TAOS\APC DELANTERO\VIDEOS`,
`2- SECTORES\INYECCIÓN PU`.

## El nombre

```
AAAA-MM-DD - lo que se ve (IMG_xxxx).MOV
```
Reales: `2026-08-26 - PARAMETROS - rodillos 130 grados produccion 195 (IMG_0383).MOV` ·
`2026-08-25 - DEFECTO - el material se traba (IMG_0362).MOV` · `2026-09-02 - MOLDEADORA -
capacitacion en el HMI - recorrida de pantallas (IMG_0578).MOV`.

**El `(IMG_xxxx)` del final no es decorativo: es la clave que permite cruzar contra el indice
del celular.** Sin el, el mismo video se vuelve a bajar cada vez. Prefijos en mayuscula para lo
que hay que encontrar rapido: `DEFECTO -`, `MODO DE FALLA -`, `PARAMETROS -`, `ALARMA`, o el
nombre de la maquina.

## El procedimiento, en orden

1. **Indexar el telefono** (barato, no copia nada): `tel_indice.ps1` → `INDICE_TELEFONO.tsv`.
   La carpeta `_b` del iPhone duplica la `_a`: se descarta.
2. **CRUZAR contra la biblioteca ANTES de bajar un byte**:
   `node scripts/_videoBiblioteca.mjs --cruzar <indice.tsv>`.
3. Bajar **solo lo que falta**, a transito **fuera de OneDrive** (`C:\Dev\_telefono`), con
   verificacion de bytes.
4. **`ffprobe`**: el tamaño no prueba nada — Explorer PREASIGNA el archivo entero, asi que un
   truncado pesa lo mismo que uno completo.
5. **Renombrar con el formato de arriba** y mover a la carpeta de su cliente/maquina.
6. Subir y **deshidratar** (`attrib +U -P`) recien cuando el archivo tiene `ReparsePoint`.
7. La carpeta de la tarea en el Escritorio es para **trabajar**; el video no vive ahi.

**Nada de esto se borra** para hacer lugar (memoria `material_de_fak_no_se_borra_va_a_la_nube`).

## Enforcement

Hook `video-maquina-guard.sh` (PreToolUse, logica en `scripts/_lib/guardianes.mjs`), que
**bloquea** — no avisa:

| Bloquea | Motivo |
|---|---|
| dejar un `.MOV/.MP4/.M4V` en una carpeta del Escritorio | su lugar es la biblioteca; ahi se pierde y se vuelve a bajar |
| copiar del telefono por MTP sin cruce fresco (< 12 h) | es lo que hizo rebajar 13 videos que ya estaban |
| dejar en la **raiz de una carpeta de maquina** algo que no sea un original con el nombre de la casa | lo que no es original va a `.claude`; asi la carpeta ordena por fecha y se lee de un vistazo |

**Limite conocido del hook**: mira la LINEA DE COMANDO, asi que un script que lee su lista de
movimientos de un archivo (como el `mover.ps1` que se uso el 21/09) le pasa por al lado. El que
cierra esa puerta es el chequeo de abajo, que mira el RESULTADO — por eso se corre despues de
mover, no en vez de.

Y el estado de las carpetas se **mide**: `node scripts/_videoBiblioteca.mjs --auditar` recorre las
tres maquinas y da rojo por archivo — raiz con algo que no es original, nombre fuera de formato,
fecha que no existe, clave repetida, **dos archivos del mismo tamano en dos maquinas distintas**,
fotogramas o transcripciones de un video que no esta en esa carpeta, video sin cuadros y carpeta
sin LEEME. Test en las dos direcciones: `__tests__/scripts/videoBibliotecaAuditar.test.mjs`.

Sale del Escritorio **hacia** la biblioteca: pasa (la ruta destino contiene `5- VIDEOS Y FOTOS`).
Leer, listar o `ffprobe` un video: pasa. Tests en las dos direcciones:
`__tests__/scripts/videoMaquinaGuard.test.mjs`.

## Lo que quedo abierto (21/09/2026)

- **IMG_9527 no esta archivado**: el video de 1 h 30 narrado en español — la unica fuente buena
  del audio de la hotmelt — sigue solo en el celular de Fak. Quedaron su transcripcion y sus
  fotogramas. Son unos 37 GB y el disco no da: hay que bajarlo directo a la biblioteca.
- **24 videos de la moldeadora y 2 de la prensa no tienen fotogramas**, y 51 no tienen audio
  sacado. Se hace con `python scripts/video/_infoDeVideos.py todo "<carpeta>"`, de a uno,
  hidratando y volviendo a deshidratar (`attrib +U -P`).

## De donde sale el candado (07/09/2026)

Se bajaron 39 videos del iPhone a carpetas del Escritorio; **13 ya estaban archivados en la
biblioteca**, con nombre descriptivo: la respuesta estaba escrita en los nombres de archivo.
Fak: *"ah nunca entendiste que tenias que cargarlos ahi? ... es gravisimo lo que paso"*,
*"no se pone algo que te obligue a recordar? un seguro"*. El cruce que este candado obliga a hacer
encontro, sobre el carrete completo, **50 de 153 videos ya archivados**.
Caso completo: memoria `videos_y_fotos_de_maquina_donde_van`.

