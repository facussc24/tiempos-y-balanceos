# Automatizar: "pasame los últimos archivos de X al pendrive"

**Abierta el 14/08/2026.** Disparador: pedido simple (2 archivos del insert al pendrive,
borrar los 2 viejos). Tardó 20 minutos. Debería tardar 1.

## Qué se fue el tiempo

| Minutos | Qué pasó | Por qué |
|---|---|---|
| ~8 | Buscar dónde estaban los 2 mixes | No hay registro de qué se entregó ni dónde quedó. Los encontré leyendo transcripciones de sesiones viejas. |
| ~5 | Buscar en las carpetas equivocadas | El Escritorio y OneDrive no eran; estaban en la biblioteca de SharePoint (`BARACK ARGENTINA SRL\...\TAREAS CERRADAS\2026\`). Nada me decía que una tarea cerrada se mueve ahí. |
| ~4 | Comandos de PowerShell que se rompían | Los mando desde bash y las variables `$_` se corrompen. Hay que escribirlos a un archivo `.ps1` siempre. |
| ~3 | Copiar, respaldar y verificar | Esto sí es trabajo real. |

## Lo que hay que construir

**`scripts/_pendrive.mjs`** — un comando, tres cosas:

```
node scripts/_pendrive.mjs "insert plotter"            # muestra qué encontró, no toca nada
node scripts/_pendrive.mjs "insert plotter" --aplicar  # copia + saca los superados
```

1. **Buscar por palabra clave** en las carpetas de tareas (Escritorio + TAREAS CERRADAS)
   y devolver los archivos entregables más nuevos, con fecha y tamaño. Que el "último
   nivel" salga solo, sin que yo tenga que adivinar en qué carpeta cayó.
2. **Detectar la unidad extraíble** sola (hoy es `D:` — "ING CB", pero cambia).
3. **Copiar con verificación md5** y, antes de sacar lo viejo del pendrive,
   **dejar copia en la carpeta de la tarea**. El pendrive no tiene Papelera: lo que se
   borra ahí no vuelve. Esto ya lo hice a mano hoy y hay que dejarlo cableado.

**Además: un índice de entregas.** Cada vez que se entrega un archivo (DXF, PLT, xlsx, PDF)
anotar en un solo lugar: qué archivo, a qué tarea pertenece, dónde quedó, fecha. Sin eso,
"traeme lo último de X" siempre va a ser una búsqueda a ciegas.

## Lo que ya está resuelto y no hay que rehacer

- `scripts/_escritorio.mjs --archivar` ya mueve una tarea del Escritorio al archivo con
  verificación de bytes. El `_pendrive.mjs` tiene que leer de ahí, no inventar su propio árbol.
- `scripts/_validarDxf.py --entregar` ya es el gate de los DXF.
