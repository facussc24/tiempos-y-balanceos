# -*- coding: utf-8 -*-
"""_registrarAmfe173.py — da de alta el AMFE 173 en el Listado Maestro de AMFEs.

El 173 es el proximo ID libre: el maximo cargado es 172 (INSONOS / DUCTOS, fila 72),
verificado el 21/09/2026 leyendo el listado. El numero se lee del listado, nunca del
nombre de un archivo (memoria `pieza_nueva_no_es_revision`).

Escribe UNA fila nueva copiando el formato de la ultima activa, y aborta si esa ultima
no es el 172. No toca ninguna otra fila. Si el 173 YA esta cargado no inserta nada: pasa
a MODO REPARACION y solo corrige las celdas de esa fila que no coinciden.

Se usa COM (Excel) y no openpyxl a proposito: el libro tiene estilos que openpyxl no sabe
releer y reescribirlo le rompe el formato al listado entero.

DOS COSAS QUE SALIERON MAL EN LA PRIMERA CARGA (21/09/2026), y por eso estan asi:

1. `P` y `Q` son FORMULAS de la tabla (`Proxima revision planificada` = ultima + 365, y
   `Dias a proxima`), y las tienen TODAS las filas, incluso las vacias. La version anterior
   limpiaba de la 2 a la 17 y despues reescribia solo hasta la 15: las dos formulas quedaban
   en blanco. La fila se veia perfecta y el control de vencimientos del listado no veia al
   173 — lo que FALTA no se ve. Ahora se limpia hasta la 15 y las formulas se copian de la
   fila modelo, explicitamente.
2. Las fechas van como SERIAL de Excel, no como `datetime`. Por COM un string "21/09/2026"
   se lee en formato ingles, pero un `datetime` naive tampoco sirve: pywin32 lo convierte de
   local a UTC y la fecha entra a las 03:00. Eso se arrastra a `Dias a proxima`, que en vez
   de 365 muestra 365,125.

Uso:  py -3 scripts/_registrarAmfe173.py           (dry-run)
      py -3 scripts/_registrarAmfe173.py --apply   (escribe)
"""
import datetime
import os
import sys

sys.stdout.reconfigure(encoding="utf-8")

APPLY = "--apply" in sys.argv

LISTADO = (r"Y:\Ingenieria\Documentacion Gestion Ingenieria"
           r"\13. Analisis del modo de falla y sus efectos ( I-AC-005.3)"
           r"\1. LISTADO DE AMFES\Listado_Maestro_AMFE.xlsx")
HOJA = "Listado AMFE"

FILA_MODELO = 72       # 172 — INSONOS / DUCTOS, la ultima activa
FILA_NUEVA = 73
ID_MODELO = "172"
PRIMERA_FILA_DATOS = 7
COL_ULTIMA_VALOR = 15  # O — de aca en adelante (P, Q) son formulas de la tabla, no valores
COLS_FORMULA = (16, 17)


def serial(anio, mes, dia):
    """Fecha como serial de Excel. Evita el corrimiento de 3 h que mete pywin32."""
    return (datetime.date(anio, mes, dia) - datetime.date(1899, 12, 30)).days

UBICACION = (r"Y:\Ingenieria\Documentacion Gestion Ingenieria"
             r"\13. Analisis del modo de falla y sus efectos ( I-AC-005.3)"
             r"\2. AMFES DE PROCESO\SMRC\173 - APB P21 HILO NARANJA COSTURA SIMPLE")

# columna -> valor  (cabecera en la fila 6, verificada el 21/09/2026)
VALORES = {
    2:  173,                                             # ID AMFE
    3:  "Proceso (PFMEA)",                               # Tipo
    4:  "APB P21 HILO NARANJA COSTURA SIMPLE",           # Producto / Componente
    5:  "00257327-01-NHZD / 00257328-01-NHZD",           # Codigo de pieza (PN)
    6:  "SMRC",                                          # Cliente
    7:  "P21 SSRT MY2026",                               # Proyecto
    8:  "PLANTA HURLINGHAM",                             # Planta / Proceso / Linea
    9:  UBICACION,                                       # Ubicacion / Link
    10: "En revisión",                                   # Estado
    11: "C.BAPTISTA",                                    # Propietario / Responsable (la columna usa INICIAL.APELLIDO: 15 de 18)
    13: serial(2026, 9, 21),                             # Fecha de creacion
    14: "A",                                             # Revision actual
    15: serial(2026, 9, 21),                             # Fecha de revision (ultima)
}
COLS_FECHA = (13, 15)

import win32com.client as win32

excel = win32.gencache.EnsureDispatch("Excel.Application")
excel.Visible = False
excel.DisplayAlerts = False
wb = None
try:
    wb = excel.Workbooks.Open(LISTADO)
    ws = wb.Worksheets(HOJA)

    modelo = str(ws.Cells(FILA_MODELO, 2).Value or "").split(".")[0]
    if modelo != ID_MODELO:
        raise RuntimeError(f"la fila {FILA_MODELO} no es el {ID_MODELO}: B{FILA_MODELO}={modelo!r}. No se toca nada.")

    # Si el 173 ya esta, NO se inserta: se repara esa misma fila.
    ya_en = None
    for r in range(PRIMERA_FILA_DATOS, 300):
        v = str(ws.Cells(r, 2).Value or "").split(".")[0]
        if v == "173":
            ya_en = r
            break
    if ya_en is not None and ya_en != FILA_NUEVA:
        raise RuntimeError(f"el 173 esta en la fila {ya_en}, no en la {FILA_NUEVA}. Reviso a mano antes de tocar.")
    REPARA = ya_en is not None

    print(f"Fila modelo {FILA_MODELO} (el {ID_MODELO}): {ws.Cells(FILA_MODELO, 4).Value!r}")
    print(f"MODO: {'REPARACION de la fila ' + str(FILA_NUEVA) + ' (el 173 ya esta cargado)' if REPARA else 'ALTA de una fila nueva'}")

    cab = {c: ws.Cells(6, c).Value for c in list(VALORES) + list(COLS_FORMULA)}
    muestra = lambda c, v: (datetime.date(1899, 12, 30) + datetime.timedelta(days=v)).strftime("%d/%m/%Y") if c in COLS_FECHA else v

    # Que hay hoy contra lo que tiene que quedar — dato crudo, columna por columna.
    distintas = []
    print(f"\n{'columna':<32} {'ahora':<34} {'queda'}")
    for c in sorted(VALORES):
        actual = ws.Cells(FILA_NUEVA, c).Value if REPARA else None
        esperado = muestra(c, VALORES[c])
        if c in COLS_FECHA:
            # Por el SERIAL crudo, no por el dia formateado: un 21/09 a las 03:00 se ve igual
            # que uno a medianoche y le mete el ,125 a "Dias a proxima".
            crudo = ws.Cells(FILA_NUEVA, c).Value2 if REPARA else None
            igual = crudo is not None and float(crudo) == float(VALORES[c])
            act = "" if actual is None else f"{actual:%d/%m/%Y %H:%M}"
        elif isinstance(VALORES[c], (int, float)):
            # Excel guarda todo numero como double: el ID vuelve 173.0 y comparar los textos
            # daria siempre distinto. Un control que avisa siempre no lo mira nadie.
            act = "" if actual is None else str(actual)
            igual = isinstance(actual, (int, float)) and float(actual) == float(VALORES[c])
        else:
            act = "" if actual is None else str(actual)
            igual = act.strip() == str(esperado).strip()
        if not igual:
            distintas.append(c)
        print(f"   {str(cab.get(c) or c)[:30]:<30} {act[:32]:<34} {'(igual)' if igual else esperado}")
    for c in COLS_FORMULA:
        f_actual = ws.Cells(FILA_NUEVA, c).Formula
        f_modelo = ws.Cells(FILA_MODELO, c).Formula
        igual = (f_actual or "").strip() == (f_modelo or "").strip()
        if not igual:
            distintas.append(c)
        print(f"   {str(cab.get(c) or c)[:30]:<30} {(f_actual or '(VACIA)')[:32]:<34} {'(igual)' if igual else 'formula de la fila modelo'}")

    if not os.path.isdir(UBICACION):
        print(f"\nAVISO: la carpeta de destino todavia no existe:\n   {UBICACION}")
        print("       (se registra igual: la crea el export del AMFE oficial)")

    if REPARA and not distintas:
        print("\nNo hay nada que reparar: la fila ya esta completa.")
    elif not APPLY:
        print(f"\nDRY-RUN. {len(distintas)} celda(s) a escribir. Corre con --apply.")
    else:
        # El script que escribe se hace cargo de su backup: el listado es registro compartido.
        respaldo = LISTADO.replace(".xlsx", f"_backup_{datetime.datetime.now():%Y%m%d_%H%M%S}.xlsx")
        wb.SaveCopyAs(respaldo)
        print(f"\nBackup: {os.path.basename(respaldo)}  ({os.path.getsize(respaldo)//1024} KB)")
        if not REPARA:
            ws.Rows(FILA_NUEVA).Insert()
            ws.Rows(FILA_MODELO).Copy()
            ws.Rows(FILA_NUEVA).PasteSpecial(-4122)   # xlPasteFormats
            excel.CutCopyMode = False
            # Hasta la 15: de la 16 en adelante son las formulas de la tabla y no se pisan.
            for c in range(2, COL_ULTIMA_VALOR + 1):
                ws.Cells(FILA_NUEVA, c).Value = None
        for c, v in VALORES.items():
            ws.Cells(FILA_NUEVA, c).Value = v
        for c in COLS_FORMULA:
            ws.Cells(FILA_NUEVA, c).Formula = ws.Cells(FILA_MODELO, c).Formula
            # El formato va DESPUES de la formula: al restar dos fechas Excel autoformatea la
            # celda como fecha, y "Dias a proxima" pasa a mostrar 30/12/1900 en vez de 365.
            ws.Cells(FILA_NUEVA, c).NumberFormat = ws.Cells(FILA_MODELO, c).NumberFormat
        wb.Save()
        print("\nGUARDADO. Relectura de control de la fila", FILA_NUEVA)
        for c in sorted(VALORES):
            print(f"   col {c:<3} = {ws.Cells(FILA_NUEVA, c).Value!r}")
        for c in COLS_FORMULA:
            print(f"   col {c:<3} = {ws.Cells(FILA_NUEVA, c).Value!r}   <- {ws.Cells(FILA_NUEVA, c).Formula}")
        print(f"\n   fila siguiente ({FILA_NUEVA+1}) intacta: B={ws.Cells(FILA_NUEVA+1, 2).Value!r}")
finally:
    if wb is not None:
        wb.Close(SaveChanges=False)
    excel.Quit()
