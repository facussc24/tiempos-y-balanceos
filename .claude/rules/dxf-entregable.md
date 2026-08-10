---
description: Un DXF no esta entregado hasta que AutoCAD lo abre — validador, y el limite de 260 caracteres de la ruta
paths:
  - "**/*.dxf"
  - "**/*.plt"
  - "scripts/_validarDxf*.py"
  - ".claude/skills/autocad-verificar/**"
  - ".claude/skills/patrones-corte-plotter/**"
---

# Un DXF no esta entregado hasta que AutoCAD lo abre

**El que dice si un DXF sirve es AutoCAD, no la libreria que lo genero.** Releer con
`ezdxf` un archivo que escribio `ezdxf` no verifica nada: valida contra sus propias
suposiciones, no contra el programa que lo va a abrir. AutoCAD 2026 esta instalado en la
notebook y tiene motor headless — no hay excusa para no consultarlo.

```bash
.venv-cad/Scripts/python.exe scripts/_validarDxf.py <archivo.dxf>              # exit 0 = apto
.venv-cad/Scripts/python.exe scripts/_validarDxf.py <in.dxf> --normalizar <out.dxf>
.venv-cad/Scripts/python.exe scripts/_validarDxf.py <in.dxf> --entregar <destino>
```

## Los dos motivos por los que un DXF "no abre" — son independientes y se tapan entre si

### 1. Contenido: `ByBlock` / `ByLayer` en la tabla LTYPE. **La regla es ASIMETRICA.**

| Version | `ByBlock`/`ByLayer` en LTYPE | Si esta mal, AutoCAD dice |
|---|---|---|
| **R12 (AC1009)** | **PROHIBIDAS** (nombres reservados) | `Duplicate name "BYBLOCK" in Linetype symbol table` |
| **R13+ (AC1012…AC1027)** | **OBLIGATORIAS** | `Missing Default entry ByLayer in SymbolTable:LTYPE` + descarta el dibujo |

`ezdxf` las escribe SIEMPRE, tambien en R12 → todo R12 que pase por ezdxf sale roto.
Cai en los dos lados el mismo dia: primero entregue R12 con ellas, despues las saque de un
R2013 "para arreglarlo" y AutoCAD rechazo el archivo entero.

Otros chequeos del validador: extents calculados (ezdxf deja `1e+20 / -1e+20`, y el que
importa dimensiona la hoja con eso), nombres con caracteres ilegales, capas/linetypes
referenciados sin tabla, EOF presente.

### 2. La ruta: **mas de 259 caracteres y el doble click no funciona**

Explorer lo MUESTRA bien, pero `ShellExecute` (doble click) **trunca la ruta en 259**: el
nombre se corta, se pierde el `.dxf`, y sale *"Seleccione una aplicacion para abrir
&lt;nombre cortado&gt;"*. AutoCAD, si le llega eso, contesta **"invalid name"**.

Le pasa a **cualquier** archivo de la carpeta — no tiene nada que ver con el contenido.
Antes de culpar al archivo: **medir el largo de la ruta**. Y no alcanza con que el archivo
este bien: si la ruta pasa 259, hay que darle una ruta corta (unidad mapeada a una carpeta
mas abajo del arbol) y decirselo a Fak. `entregar_dxf()` lo avisa solo.

## Enforcement

- **DURO** — `entregar_dxf()` en `scripts/_validarDxf.py` no copia el archivo al destino si
  AutoCAD no lo abrio limpio (`EntregaRechazada`), y avisa si la ruta pasa MAX_PATH.
  Mismo patron que `patronlib.entregar()` con los PLT: el gate vive en el unico camino que
  produce el entregable, no en la buena voluntad.
- **Verificable** — `.venv-cad/Scripts/python.exe scripts/_validarDxfSelftest.py [--con-autocad]`:
  6 casos malos que tienen que ser rechazados (los dos lados del bug asimetrico incluidos) +
  2 normalizados que tienen que pasar + la capa real de AutoCAD.
- **Como se corre AutoCAD headless** → skill `autocad-verificar`.
- Al normalizar, la geometria **no se toca**: `normalizar()` compara las secciones
  `ENTITIES` y `BLOCKS` byte por byte contra el original y aborta si cambiaron.
