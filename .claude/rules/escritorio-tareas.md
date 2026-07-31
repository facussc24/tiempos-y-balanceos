---
description: El Escritorio es la cola de tareas — cuándo se cierra una y cómo se archiva
paths:
  - "scripts/_escritorio.mjs"
  - ".claude/hooks/escritorio-guard.sh"
  - "__tests__/scripts/escritorio*.test.mjs"
---

# Escritorio = cola de tareas — regla corta

Una carpeta por pendiente, con el mail del pedido adentro. **En el Escritorio queda solo lo
abierto.** Lo cerrado se archiva; nunca se borra.

## 1. Cuándo se da por cerrada

**La última acción que era de Barack está hecha Y dejó rastro fuera del Escritorio**: mail
enviado, archivo en el legajo/servidor, carga hecha en el ERP, commit pusheado.

- Esperando a un tercero → **abierta** (bloqueada, no cerrada).
- "El archivo está listo pero no lo mandé" → **abierta**.
- Se archiva lo que **Fak** dio por terminado, no lo que yo creo terminado. Ante la duda,
  se lista como candidata y decide él.

## 2. Qué se guarda y dónde

La carpeta **entera**, tal cual, a `_TERMINADAS <año>\` con la fecha de cierre adelante:

```
_TERMINADAS 2026\2026-07-27 - <nombre original de la carpeta>
```

La fecha adelante ordena el archivo cronológicamente y el nombre original lo mantiene
reconocible. Un archivo suelto viaja adentro de su propia carpeta fechada.

**El registro va en UN solo `INDICE.md`** en la raíz de `_TERMINADAS <año>`, con cuatro
datos por tarea: cuándo se cerró, cuál es, **qué quedó hecho** y **dónde quedó el
entregable**. Ese índice es el mecanismo de búsqueda: sin el "dónde quedó", la carpeta
archivada es una caja sin etiqueta.

**Adentro de la carpeta archivada no se agrega nada.** Nada de README, LEEME, notas ni
"por qué está acá" — es el incidente 2026-07-24, marcado GRAVE. El porqué va a mi memoria
y a la fila del índice. Si el trabajo ya produjo su propio registro técnico, ese se queda:
es parte del entregable, no una nota mía.

## 3. Nada se borra, nunca

El Escritorio ya vive en OneDrive: mover no libera ni ocupa espacio, es puro orden visual.
Y el contexto de un reclamo aparece dos años después con un ECN o un PPAP viejo. Guardar
sale gratis. Sin plazo de retención.

Si una tarea archivada se reabre, **vuelve al Escritorio** y su fila queda marcada
`reabierta AAAA-MM-DD` — no se borra la fila.

## 4. Cómo se hace

```bash
node scripts/_escritorio.mjs                   # relevar: qué está abierto y hace cuántos días
node scripts/_escritorio.mjs --check           # invariantes del archivo
node scripts/_escritorio.mjs --archivar "<carpeta>" --cerrada AAAA-MM-DD \
     --que "<qué quedó hecho>" --donde "<dónde quedó el entregable>"
node scripts/_escritorio.mjs --registrar "<carpeta ya archivada>" ...   # legado sin fila
node scripts/_escritorio.mjs --reabrir "<carpeta archivada>"
```

Todos aceptan `--dry-run`. **Datos reales de las tareas (nombres de cliente, proyectos,
rutas del servidor) NO van al repo: es público.** Viven en el `INDICE.md` del Escritorio.

## Enforcement

- **DURO — `scripts/_escritorio.mjs`**: mover y registrar son la misma operación. El script
  **no mueve nada** si falta `--que`/`--donde`, si son más cortos que 10 caracteres o si son
  relleno (`TBD`, `listo`, `-`), si la fecha no existe o es futura, si el destino ya existe,
  o si el origen no es una tarea. **No tiene una sola llamada de borrado.**
  `--check` sale con código 1 si una carpeta archivada no tiene fila, si una fila apunta a
  una carpeta que no está, si hay filas duplicadas o si un nombre no arranca con la fecha.
- **DURO — hook `escritorio-guard.sh`** (PreToolUse): bloquea borrar cualquier cosa del
  Escritorio o de `_TERMINADAS`, mover a mano hacia/desde el archivo, editar el `INDICE.md`
  a mano, y escribir un README/LEEME/NOTAS suelto en una carpeta de Fak. Recuerda el
  procedimiento 1×/hora cuando una orden simplemente toca el Escritorio.
- **Tests**: `__tests__/scripts/escritorio.test.mjs` (26) y `escritorioGuard.test.mjs` (15).
  Los del hook arman el payload con `JSON.stringify` a propósito: escrito a mano en el shell,
  los backslashes de Windows se colapsan y el test pasa por el motivo equivocado.
