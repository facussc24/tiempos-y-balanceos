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

Sale del Escritorio **hacia** la biblioteca: pasa (la ruta destino contiene `5- VIDEOS Y FOTOS`).
Leer, listar o `ffprobe` un video: pasa. Tests en las dos direcciones:
`__tests__/scripts/videoMaquinaGuard.test.mjs`.

## De donde sale el candado (07/09/2026)

Se bajaron 39 videos del iPhone a carpetas del Escritorio; **13 ya estaban archivados en la
biblioteca**, con nombre descriptivo: la respuesta estaba escrita en los nombres de archivo.
Fak: *"ah nunca entendiste que tenias que cargarlos ahi? ... es gravisimo lo que paso"*,
*"no se pone algo que te obligue a recordar? un seguro"*. El cruce que este candado obliga a hacer
encontro, sobre el carrete completo, **50 de 153 videos ya archivados**.
Caso completo: memoria `videos_y_fotos_de_maquina_donde_van`.

