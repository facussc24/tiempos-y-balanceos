# -*- coding: utf-8 -*-
"""_registrarFlujograma159.py — completa la fila del flujograma 159 en el Listado Maestro.

La fila 64 ya existe desde el 11/09/2026 (la cargue al armar el borrador) pero quedo sin la
UBICACION del archivo y sin la fecha de revision, porque el documento todavia no se habia
emitido. Hoy 21/09/2026 se emitio la Rev. A, asi que se completan esas dos celdas.

No inserta filas ni toca ninguna otra: solo escribe H64 (ubicacion) y N64 (fecha de revision),
y unicamente si la fila 64 es de verdad el 159. Si no lo es, aborta.

Se usa COM (Excel) y no openpyxl a proposito: el libro tiene estilos que openpyxl no sabe
releer, y reescribirlo con openpyxl le rompe el formato al listado entero.
La fecha va como datetime, NUNCA como texto: por COM, "21/09/2026" se interpreta como
21 de septiembre solo si es un objeto fecha; como string lo toma en formato ingles.

Uso:  py -3 scripts/_registrarFlujograma159.py           (dry-run: muestra que haria)
      py -3 scripts/_registrarFlujograma159.py --apply   (escribe)
"""
import datetime
import os
import sys

sys.stdout.reconfigure(encoding="utf-8")

APPLY = "--apply" in sys.argv

LISTADO = (r"Y:\Ingenieria\Documentacion Gestion Ingenieria"
           "\\8. Flujograma Sinóptico (I-IN-002III)"
           r"\1. LISTADO DE FLUJOGRAMAS\Listado_Maestro_FLUJOGRMAS.xlsx")
HOJA = "Listado FLUJOGRAMAS"
FILA = 64
ID_ESPERADO = "159"

COL_ID = 2          # B
COL_UBICACION = 8   # H
COL_ESTADO = 9      # I
COL_REV = 13        # M
COL_FECHA_REV = 14  # N

UBICACION = (r"Y:\Ingenieria\Documentacion Gestion Ingenieria"
             "\\8. Flujograma Sinóptico (I-IN-002III)"
             r"\CLIENTES\SMRC\159 - APB P21 HILO NARANJA COSTURA SIMPLE")
FECHA_REV = datetime.datetime(2026, 9, 21)

ARCHIVOS = [
    UBICACION + r"\FLUJOGRAMA 159 - APB P21 HILO NARANJA COSTURA SIMPLE - Rev.A.pdf",
    UBICACION + r"\FLUJOGRAMA 159 - APB P21 HILO NARANJA COSTURA SIMPLE - Rev.A.png",
]

if not os.path.isfile(LISTADO):
    sys.exit(f"ERROR: no existe el listado {LISTADO}")
for f in ARCHIVOS:
    if not os.path.isfile(f):
        sys.exit(f"ERROR: la ubicacion que voy a registrar no tiene el archivo:\n  {f}")
print(f"Los {len(ARCHIVOS)} archivos existen en la ubicacion que se va a registrar.")

import win32com.client as win32

excel = win32.gencache.EnsureDispatch("Excel.Application")
excel.Visible = False
excel.DisplayAlerts = False
wb = None
try:
    wb = excel.Workbooks.Open(LISTADO)
    ws = wb.Worksheets(HOJA)

    actual_id = str(ws.Cells(FILA, COL_ID).Value or "").split(".")[0]
    if actual_id != ID_ESPERADO:
        raise RuntimeError(f"la fila {FILA} no es el {ID_ESPERADO}: B{FILA}={actual_id!r}. No se toca nada.")

    print(f"\nFila {FILA} — estado actual:")
    for col, et in ((COL_ID, "B ID"), (3, "C producto"), (COL_UBICACION, "H ubicacion"),
                    (COL_ESTADO, "I estado"), (COL_REV, "M revision"), (COL_FECHA_REV, "N fecha rev")):
        print(f"   {et:<14} = {ws.Cells(FILA, col).Value!r}")

    print("\nLo que se va a escribir:")
    print(f"   H{FILA} ubicacion  = {UBICACION}")
    print(f"   N{FILA} fecha rev  = {FECHA_REV:%d/%m/%Y}")
    print("   (no se toca ninguna otra celda ni ninguna otra fila)")

    if not APPLY:
        print("\nDRY-RUN. Corre con --apply para escribir.")
    else:
        ws.Cells(FILA, COL_UBICACION).Value = UBICACION
        ws.Cells(FILA, COL_FECHA_REV).Value = FECHA_REV
        wb.Save()
        print("\nGUARDADO. Relectura de control:")
        for col, et in ((COL_UBICACION, "H ubicacion"), (COL_FECHA_REV, "N fecha rev")):
            print(f"   {et:<14} = {ws.Cells(FILA, col).Value!r}")
finally:
    if wb is not None:
        wb.Close(SaveChanges=False)
    excel.Quit()
