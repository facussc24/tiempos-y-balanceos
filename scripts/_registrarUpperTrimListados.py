# -*- coding: utf-8 -*-
"""_registrarUpperTrimListados.py — da de alta el flujograma 160 y el AMFE 174 (Upper Trim
Panel, Cozzuol / VW427) en sus Listados Maestros.

Los dos numeros son el proximo libre de cada listado, leidos el 01/10/2026 (ultimo flujograma
159, ultimo AMFE 173), y se cargan con el OK de Fak de ese dia: los listados son registro
compartido (autonomy-contract §F).

Mismo criterio que `_registrarAmfe173.py`, que ya se uso de verdad:
  - Excel por COM y no openpyxl (el libro tiene tablas y estilos que openpyxl rompe).
  - Las columnas de "Proxima revision" y "Dias a proxima" son FORMULAS de la tabla: no se
    pisan; si la fila nueva no las tiene, se copian de la fila modelo.
  - Las fechas van como SERIAL de Excel (un datetime por COM entra corrido 3 horas).
  - Si el numero ya esta cargado no inserta nada: repara esa fila.
Y dos cosas mas:
  - Excel se abre en una instancia PROPIA (DispatchEx): no se toca ni se cierra el de nadie.
  - El respaldo previo queda en `.sgc-cache/listados-respaldo/` (local), no suelto en el servidor.

Uso:  py -3 scripts/_registrarUpperTrimListados.py flujograma            (muestra que haria)
      py -3 scripts/_registrarUpperTrimListados.py flujograma --apply
      py -3 scripts/_registrarUpperTrimListados.py amfe [--apply]
"""
import datetime
import os
import sys

sys.stdout.reconfigure(encoding="utf-8")

args = [a for a in sys.argv[1:] if not a.startswith("--")]
APPLY = "--apply" in sys.argv
if len(args) != 1 or args[0] not in ("flujograma", "amfe"):
    sys.exit("Uso: py -3 scripts/_registrarUpperTrimListados.py <flujograma|amfe> [--apply]")
QUE = args[0]

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GI = r"Y:\Ingenieria\Documentacion Gestion Ingenieria"


def serial(anio, mes, dia):
    """Fecha como serial de Excel. Evita el corrimiento de 3 h que mete pywin32."""
    return (datetime.date(anio, mes, dia) - datetime.date(1899, 12, 30)).days


HOY = serial(2026, 10, 1)

if QUE == "flujograma":
    LISTADO = os.path.join(GI, "8. Flujograma Sinóptico (I-IN-002III)", "1. LISTADO DE FLUJOGRAMAS",
                           "Listado_Maestro_FLUJOGRMAS.xlsx")
    HOJA = "Listado FLUJOGRAMAS"
    ID_NUEVO, ID_MODELO = "160", "159"
    UBICACION = os.path.join(GI, "8. Flujograma Sinóptico (I-IN-002III)", "CLIENTES", "COZZUOL",
                             "160 - UPPER TRIM PANEL")
    ARCHIVOS = ["FLUJOGRAMA 160 - UPPER TRIM PANEL - Rev.A.pdf", "FLUJOGRAMA 160 - UPPER TRIM PANEL - Rev.A.png"]
    # cabecera en la fila 6: B ID · C producto · D PN · E cliente · F proyecto · H ubicacion ·
    # I estado · J responsable · L creacion · M revision · N fecha de revision · O, P formulas
    VALORES = {
        2: 160, 3: "UPPER TRIM PANEL", 4: "MP8404 / MP8405", 5: "COZZUOL", 6: "PATAGONIA",
        8: UBICACION, 9: "En revisión", 10: "F. SANTORO", 12: HOY, 13: "A", 14: HOY,
    }
    COLS_FECHA = (12, 14)
    COL_ULTIMA_VALOR, COLS_FORMULA = 14, (15, 16)
else:
    LISTADO = os.path.join(GI, "13. Analisis del modo de falla y sus efectos ( I-AC-005.3)",
                           "1. LISTADO DE AMFES", "Listado_Maestro_AMFE.xlsx")
    HOJA = "Listado AMFE"
    ID_NUEVO, ID_MODELO = "174", "173"
    UBICACION = os.path.join(GI, "13. Analisis del modo de falla y sus efectos ( I-AC-005.3)",
                             "2. AMFES DE PROCESO", "COZZUOL", "174 - UPPER TRIM PANEL")
    ARCHIVOS = ["AMFE 174 - UPPER TRIM PANEL - Rev.A.xlsx", "AMFE 174 - UPPER TRIM PANEL - Rev.A.pdf"]
    # cabecera en la fila 6: B ID · C tipo · D producto · E PN · F cliente · G proyecto ·
    # H planta · I ubicacion · J estado · K responsable · M creacion · N revision · O fecha · P, Q formulas
    VALORES = {
        2: 174, 3: "Proceso (PFMEA)", 4: "UPPER TRIM PANEL", 5: "MP8404 / MP8405", 6: "COZZUOL",
        7: "PATAGONIA", 8: "PLANTA HURLINGHAM", 9: UBICACION, 10: "En revisión", 11: "C.BAPTISTA",
        13: HOY, 14: "A", 15: HOY,
    }
    COLS_FECHA = (13, 15)
    COL_ULTIMA_VALOR, COLS_FORMULA = 15, (16, 17)

if not os.path.isfile(LISTADO):
    sys.exit(f"ERROR: no existe el listado {LISTADO}")
for a in ARCHIVOS:
    if not os.path.isfile(os.path.join(UBICACION, a)):
        sys.exit(f"ERROR: la ubicacion que voy a registrar no tiene el archivo:\n  {os.path.join(UBICACION, a)}")
print(f"Los {len(ARCHIVOS)} archivos existen en la ubicacion que se va a registrar.")

import win32com.client as win32

excel = win32.DispatchEx("Excel.Application")
excel.Visible = False
excel.DisplayAlerts = False
wb = None
try:
    wb = excel.Workbooks.Open(LISTADO, ReadOnly=not APPLY)
    if APPLY and wb.ReadOnly:
        raise RuntimeError("el listado se abrio en solo lectura (lo tiene abierto otra persona). No se escribe.")
    ws = wb.Worksheets(HOJA)

    def ident(fila):
        return str(ws.Cells(fila, 2).Value or "").split(".")[0].strip()

    ultima = ws.Cells(ws.Rows.Count, 2).End(-4162).Row            # xlUp
    donde = {i: [f for f in range(7, ultima + 1) if ident(f) == i] for i in (ID_NUEVO, ID_MODELO)}
    if len(donde[ID_MODELO]) != 1:
        raise RuntimeError(f"el {ID_MODELO} aparece {len(donde[ID_MODELO])} veces en la columna B. No se toca nada.")
    if len(donde[ID_NUEVO]) > 1:
        raise RuntimeError(f"el {ID_NUEVO} aparece {len(donde[ID_NUEVO])} veces. Reviso a mano antes de tocar.")
    fila_modelo = donde[ID_MODELO][0]
    fila_nueva = fila_modelo + 1
    REPARA = bool(donde[ID_NUEVO])
    if REPARA and donde[ID_NUEVO][0] != fila_nueva:
        raise RuntimeError(f"el {ID_NUEVO} esta en la fila {donde[ID_NUEVO][0]}, no en la {fila_nueva}. Reviso a mano.")
    # La fila siguiente al modelo: si esta vacia se usa; si tiene otro documento se inserta una.
    siguiente_ocupada = (not REPARA) and ident(fila_nueva) != ""
    modo = "REPARACION" if REPARA else ("ALTA insertando una fila" if siguiente_ocupada else "ALTA en la fila vacia que sigue")

    print(f"Fila modelo {fila_modelo} (el {ID_MODELO}): {ws.Cells(fila_modelo, 3).Value!r} / {ws.Cells(fila_modelo, 4).Value!r}")
    print(f"MODO: {modo} -> fila {fila_nueva}")
    if siguiente_ocupada:
        print(f"   (la fila {fila_nueva} hoy tiene: {ident(fila_nueva)!r}; baja una)")

    cab = {c: ws.Cells(6, c).Value for c in list(VALORES) + list(COLS_FORMULA)}

    def muestra(c, v):
        if c in COLS_FECHA:
            return (datetime.date(1899, 12, 30) + datetime.timedelta(days=v)).strftime("%d/%m/%Y")
        return v

    print(f"\n   {'columna':<30} {'modelo (' + ID_MODELO + ')':<40} queda")
    for c in sorted(VALORES):
        mod = ws.Cells(fila_modelo, c).Value
        mod = "" if mod is None else str(mod)
        print(f"   {str(cab.get(c) or c)[:28]:<30} {mod[:38]:<40} {str(muestra(c, VALORES[c]))[:90]}")
    for c in COLS_FORMULA:
        print(f"   {str(cab.get(c) or c)[:28]:<30} {'(formula)':<40} formula de la tabla")

    if not APPLY:
        print("\nDRY-RUN. Corre con --apply para escribir.")
    else:
        respaldo_dir = os.path.join(REPO, ".sgc-cache", "listados-respaldo")
        os.makedirs(respaldo_dir, exist_ok=True)
        respaldo = os.path.join(respaldo_dir, os.path.basename(LISTADO).replace(
            ".xlsx", f"_antes_del_{ID_NUEVO}_{datetime.datetime.now():%Y%m%d_%H%M%S}.xlsx"))
        wb.SaveCopyAs(respaldo)
        print(f"\nRespaldo local: {respaldo}  ({os.path.getsize(respaldo) // 1024} KB)")
        if siguiente_ocupada:
            ws.Rows(fila_nueva).Insert()
        if not REPARA:
            # El formato se copia solo sobre las columnas de la tabla (B hasta la ultima formula):
            # copiar la fila ENTERA falla en el listado de flujogramas, que tiene celdas
            # combinadas fuera de la tabla ("no se puede realizar en una celda combinada").
            ultima_col = max(COLS_FORMULA)
            ws.Range(ws.Cells(fila_modelo, 2), ws.Cells(fila_modelo, ultima_col)).Copy()
            ws.Range(ws.Cells(fila_nueva, 2), ws.Cells(fila_nueva, ultima_col)).PasteSpecial(-4122)   # xlPasteFormats
            excel.CutCopyMode = False
            for c in range(2, COL_ULTIMA_VALOR + 1):
                ws.Cells(fila_nueva, c).Value = None
        for c, v in VALORES.items():
            ws.Cells(fila_nueva, c).Value = v
        for c in COLS_FORMULA:
            ws.Cells(fila_nueva, c).Formula = ws.Cells(fila_modelo, c).Formula
            # El formato va DESPUES de la formula: al restar dos fechas Excel autoformatea como fecha.
            ws.Cells(fila_nueva, c).NumberFormat = ws.Cells(fila_modelo, c).NumberFormat
        wb.Save()
        print(f"\nGUARDADO. Relectura de control de la fila {fila_nueva}:")
        for c in sorted(VALORES):
            print(f"   col {c:<3} = {ws.Cells(fila_nueva, c).Value!r}")
        for c in COLS_FORMULA:
            print(f"   col {c:<3} = {ws.Cells(fila_nueva, c).Value!r}   <- {ws.Cells(fila_nueva, c).Formula}")
        print(f"\n   fila anterior ({fila_modelo}): B={ws.Cells(fila_modelo, 2).Value!r}   "
              f"fila siguiente ({fila_nueva + 1}): B={ws.Cells(fila_nueva + 1, 2).Value!r}")
finally:
    if wb is not None:
        wb.Close(SaveChanges=False)
    excel.Quit()
