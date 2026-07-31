---
description: El Escritorio es la cola de tareas — cuándo se cierra una y cómo se archiva
paths:
  - "scripts/_escritorio.mjs"
  - "scripts/_lib/serverPaths.mjs"
  - ".claude/hooks/escritorio-guard.sh"
  - "__tests__/scripts/escritorio*.test.mjs"
---

# Escritorio = cola de tareas — regla corta

Una carpeta por pendiente, con el mail del pedido adentro. **En el Escritorio queda solo lo
abierto.**

## 1. Cuándo se da por cerrada

**La última acción que era de Barack está hecha Y el entregable ya está en su carpeta por
tipo** de la biblioteca de Ingeniería (`FICHAS DE EMBALAJE`, `2. CONSUMO DE MATERIAL BOM`,
`5. 3D`, `ULM GATE 2`, `DESVIOS`…). Si el entregable no llegó a su carpeta, la tarea no está
cerrada, esté como esté el archivo.

- Esperando a un tercero → **abierta** (bloqueada, no cerrada).
- "El archivo está listo pero no lo mandé" → **abierta**.
- Se archiva lo que **Fak** dio por terminado, no lo que yo creo terminado. Ante la duda,
  se lista como candidata y decide él.

## 2. Se archiva el RASTRO, nunca el entregable

Una tarea cerrada tiene dos mitades y van a lugares distintos:

| Mitad | Dónde va |
|---|---|
| El entregable (ficha, BOM, 3D, ULM, PDF) | Su carpeta **por tipo**. Ya tiene casa: no se toca |
| El rastro (el mail que la originó, capturas, borradores) | `1- GENERAL\TAREAS CERRADAS\<año>\` |

**Nunca copiar el entregable al archivo.** Dos copias del mismo documento en dos lugares es
el problema, no la solución — es lo mismo que "un PN, una BOM vigente". El archivo guarda
únicamente lo que hoy no tiene casa en ningún lado.

La carpeta del rastro va con la fecha de cierre adelante y el nombre original atrás:
`2026-07-27 - <nombre original>`. Así ordena cronológicamente y sigue siendo reconocible.

## 3. El listado es el puente

`TAREAS CERRADAS\<año>\LISTADO DE TAREAS CERRADAS <año>.xlsx` — en Excel, como el
`LISTADO MAESTRO DE INGENIERIA` que ya se usa ahí. Una fila por tarea: **cuándo se cerró,
cuál era, quién la pidió, qué se hizo y en qué carpeta quedó el entregable.**

Ese "dónde quedó" es lo que hace encontrable la tarea dos años después. Sin eso, la carpeta
archivada es una caja sin etiqueta.

**Adentro de la carpeta archivada no se agrega nada**: ni README, ni LEEME, ni notas
(incidente 2026-07-24, marcado GRAVE). El porqué va a mi memoria y a la fila del listado.

## 4. Nada se borra, nunca

Sin plazo de retención: el contexto de un reclamo aparece dos años después con un ECN o un
PPAP viejo. Si una tarea archivada se reabre, **vuelve al Escritorio** y su fila queda
marcada `reabierta AAAA-MM-DD` — la fila no se borra.

**Ojo con el destino**: la biblioteca de Ingeniería es del departamento, no espacio personal
(lleva `(NUNCA BORRAR)` en el nombre y está bajo control documental). Lo que se deja ahí lo
ve el equipo. Es deliberado — sirve de trazabilidad si Fak no está.

## 5. Cómo se hace

```bash
node scripts/_escritorio.mjs                   # relevar: qué está abierto y hace cuántos días
node scripts/_escritorio.mjs --check           # invariantes del archivo
node scripts/_escritorio.mjs --archivar "<carpeta>" --cerrada AAAA-MM-DD \
     --quien "<quién lo pidió>" --que "<qué se hizo>" --donde "<dónde quedó el entregable>"
node scripts/_escritorio.mjs --reabrir "<carpeta archivada>"
```

Todos aceptan `--dry-run`. Las rutas viven en `scripts/_lib/serverPaths.mjs`.
**Datos reales de las tareas (clientes, proyectos, números) NO van al repo: es público.**
Viven en el listado Excel, en la biblioteca.

## Enforcement

- **DURO — `scripts/_escritorio.mjs`**: mover y registrar son la misma operación. **No mueve
  nada** si falta `--quien`/`--que`/`--donde`, si son demasiado cortos, si son relleno
  (`TBD`, `listo`, `-`), si tienen saltos de línea, si la fecha no existe o es futura, si la
  tarea ya figura en el listado, o si el origen no es una tarea. Después de mover **verifica
  que no se haya perdido ningún archivo** comparando cantidad y bytes (OneDrive con Files
  On-Demand puede morder); si no cierra, lo canta y no registra.
  **No tiene una sola llamada de borrado.** `--check` sale con código 1 si una carpeta
  archivada no tiene fila, si una fila apunta a una carpeta que no está, si hay duplicadas
  o si un nombre no arranca con la fecha.
- **DURO — hook `escritorio-guard.sh`** (PreToolUse): bloquea borrar cualquier cosa del
  Escritorio o de la biblioteca de Ingeniería, mover a mano hacia/desde el archivo, tocar el
  listado a mano, y escribir un README/LEEME/NOTAS suelto en una carpeta de Fak. Recuerda el
  procedimiento 1×/hora al entrar en ese territorio.
- **Tests**: `__tests__/scripts/escritorio.test.mjs` (26) y `escritorioGuard.test.mjs` (17).
  Dos trampas que costaron un test falso-verde y un commit bloqueado, y que están fijadas
  como vectores: los payloads del hook se arman con `JSON.stringify` (a mano en el shell los
  backslashes de Windows se colapsan y el hook cae en su rama de fallback), y la detección
  exige la **barra de ruta** adelante porque `del` es alias de borrado **y** preposición en
  español — "del Escritorio" en un mensaje de commit se leía como un borrado.
