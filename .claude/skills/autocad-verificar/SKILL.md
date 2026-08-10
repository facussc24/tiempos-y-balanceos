---
name: autocad-verificar
description: Correr AutoCAD 2026 sin interfaz para verificar, auditar o normalizar un DXF/DWG antes de entregarlo. Usar cuando se genere, modifique o entregue un DXF (moldes, tizadas, patrones de corte), cuando Fak diga que un archivo "no abre" o "invalid name", o cuando haya que saber si AutoCAD acepta algo. El juez de un DXF es AutoCAD, no ezdxf.
---

# Verificar un DXF con AutoCAD de verdad (sin abrir la ventana)

Regla de una linea: **el que dice si un DXF sirve es AutoCAD, no la libreria que lo genero.**
Verificar con `ezdxf` un archivo escrito por `ezdxf` es validar contra las propias
suposiciones. El 2026-08-06 entregue 3 DXF asi y Fak los descubrio rotos en produccion.

## Camino normal — el validador ya hace todo

```bash
.venv-cad/Scripts/python.exe scripts/_validarDxf.py <archivo.dxf>            # exit 0 = apto
.venv-cad/Scripts/python.exe scripts/_validarDxf.py <in.dxf> --normalizar <out.dxf>
.venv-cad/Scripts/python.exe scripts/_validarDxf.py <in.dxf> --entregar <destino>   # gate duro
.venv-cad/Scripts/python.exe scripts/_validarDxfSelftest.py --con-autocad          # verificarlo
```

Detalle de que chequea y por que: regla `.claude/rules/dxf-entregable.md`.

## Cuando hay que ir a mano: accoreconsole

```
C:\Program Files\Autodesk\AutoCAD 2026\accoreconsole.exe
```

```bash
printf '_AUDIT\r\nY\r\n_QUIT\r\nY\r\n' > audit.scr        # el .scr DEBE ir con CRLF
accoreconsole.exe /i "<ruta absoluta.dxf>" /s "<ruta absoluta audit.scr>"
```

Lo que hay que saber para que funcione (cada uno me costo un intento):

1. **`/s <script>` es obligatorio.** Sin el imprime el "Usage:" y abre un dibujo nuevo del
   template — parece que anduvo y no abrio nada.
2. **Desde Git Bash hay que apagar la conversion de rutas de MSYS**, o `/i` y `/s` se
   convierten en rutas y accoreconsole ignora los argumentos (imprime "Usage:"):
   `export MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL='*'`. Ojo que con eso `/c/...` deja de
   traducirse: pasar rutas Windows, o UNC con **barras normales** (`//SERVER/...`).
   En Python usar `subprocess` directo y no pelearse con el shell.
3. **`_QUIT` pregunta dos veces.** Con `AUDIT Y` el dibujo queda marcado como modificado, y
   *"Really want to discard all changes?"* hay que contestarlo **`Y`**. Si se contesta `N`
   el proceso **se cuelga** hasta el timeout.
4. **La salida es UTF-16LE**: `iconv -f UTF-16LE` o `.decode('utf-16-le')`. Leida como
   bytes se ve con un espacio entre cada letra.
5. Lo que importa de la salida: `Total errors found N fixed M`. Si esa linea **no aparece**,
   AutoCAD no llego a auditar → no abrio el archivo, y arriba esta el motivo
   (`Invalid or incomplete DXF input -- drawing discarded`, `ErrorStatus=53`).
6. Cada corrida tarda **30-45 s**. Para varios archivos, background y un solo reporte.

Round-trip para normalizar con el writer de AutoCAD (cuando hay que reescribirlo todo):
`_AUDIT Y` + `_SAVEAS` a DXF. Ojo que reescribe todas las tablas y puede cambiar el tipo de
entidad (R12 no tiene LWPOLYLINE) — si solo hay que sacar un par de etiquetas, es mas seguro
`--normalizar`, que toca 6 lineas y deja la geometria byte por byte.

## Interfaz grafica (solo si el headless no alcanza)

`Start-Process 'C:\Program Files\Autodesk\AutoCAD 2026\acad.exe' -ArgumentList "`"$f`""`.
Y para reproducir **exactamente el doble click** de Fak (que es otro camino, el del shell):
`Start-Process -FilePath $f`.

Trampas de la GUI, todas vividas:
- Si AutoCAD queda esperando en un prompt (`Enter name of drawing to open <...>:`),
  **no abre nada mas** de lo que le manden. Se ve vacio y parece que el archivo falla.
  Cerrar el proceso y arrancar limpio antes de concluir cualquier cosa.
- Mandar teclas con `SendKeys` marca el dibujo como modificado y al cerrar aparece
  *"Save changes to ...?"*. **Contestar No**, o se sobreescribe el archivo del server.
  Despues verificar el hash y el mtime del original para probar que no se toco.
- Antes de manejar la pantalla, mirar si Fak esta usando la PC.

## Antes de culpar al archivo: medir la ruta

Si Fak dice "no abre" o "invalid name", **medir el largo de la ruta completa**. Arriba de
**259** caracteres el doble click de Windows trunca el nombre, pierde el `.dxf` y sale
*"Seleccione una aplicacion para abrir …"*. Prueba de 30 segundos que lo separa del
contenido: copiar el mismo archivo a `C:\tmp\` y hacerle doble click. Si desde ahi abre,
el archivo esta bien y el problema es la carpeta.
