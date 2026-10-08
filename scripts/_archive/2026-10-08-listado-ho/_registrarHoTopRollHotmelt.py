# -*- coding: utf-8 -*-
"""
ARCHIVADO 08/10/2026 — NO USAR COMO MODELO: escribia en una pestaña oculta del listado que nombraba
a Claude (_CONTEXTO_CLAUDE). Fak mando borrarla: mi contexto va a la memoria, nunca adentro de un
documento de la empresa (scripts/_sinFirmaIA.py lo frena).

_registrarHoTopRollHotmelt.py — registra en el Listado Maestro de Hojas de Proceso la HO 992
(TOP ROLL PATAGONIA) y la HO 993 (LAMINADORA HOT MELT, hoja de maquina).

Ruta: Y:\\BARACK\\CALIDAD\\DOCUMENTACION SGC\\HOJAS DE OPERACIONES\\3- LISTADO\\Listado hojas de proceso.xlsx

Mismo procedimiento que `_registrarHoInsert.py` (lo pide la hoja oculta del archivo): las filas
entran al final del bloque GENERAL, con el formato de una fila activa; la columna # es un
correlativo estatico y se re-secuencia; y la hoja oculta _CONTEXTO_CLAUDE queda con el proximo
numero libre. A diferencia de aquel, la fila donde termina el bloque se BUSCA (la ultima GENERAL
con numero), no va escrita a mano, y la fecha se escribe como dia entero.

OK de Fak: 01/10/2026 ("si a las 3, dale").

    py -3 scripts/novax/_registrarHoTopRollHotmelt.py            # prueba en seco
    py -3 scripts/novax/_registrarHoTopRollHotmelt.py --apply    # escribe y relee del archivo
"""
import datetime
import os
import re
import sys

sys.stdout.reconfigure(encoding="utf-8")

try:
    import win32com.client as win32
except ImportError:
    sys.exit("ERROR: falta pywin32 (win32com).")

APLICAR = "--apply" in sys.argv

LISTADO = (r"Y:\BARACK\CALIDAD\DOCUMENTACION SGC\HOJAS DE OPERACIONES"
           r"\3- LISTADO\Listado hojas de proceso.xlsx")
HOJA = "INDICE HOJAS DE PROCESO"
CONTEXTO = "_CONTEXTO_CLAUDE"
FILA_ENCABEZADO, PRIMERA_FILA_DATOS = 6, 7
BASE = r"\\SERVER\compartido\BARACK\CALIDAD\DOCUMENTACION SGC\HOJAS DE OPERACIONES"
BASE_Y = r"Y:\BARACK\CALIDAD\DOCUMENTACION SGC\HOJAS DE OPERACIONES"

FECHA = datetime.datetime(2026, 10, 1)
SERIE = (FECHA - datetime.datetime(1899, 12, 30)).days

# (HO, codigo, cliente, descripcion, tipo, carpeta relativa a HOJAS DE OPERACIONES)
NUEVAS = [
    (992, "N 216 / N 256 / N 285 / N 315", "NOVAX", "[GENERAL] TOP ROLL PATAGONIA", "PROYECTO PATAGONIA",
     r"\1- CLIENTES\NOVAX\Tapizadas puerta\HO 992 - TOP ROLL"),
    (993, None, "NOVAX", "[GENERAL] LAMINADORA HOT MELT - HOJA DE MAQUINA", "PROYECTO PATAGONIA",
     r"\2- SECTORES\LAMINADO"),
]
PROXIMO_LIBRE = 994

LINEA_CONTEXTO = (
    "01/10/2026: se registraron HO 992 (TOP ROLL PATAGONIA, N 216 / N 256 / N 285 / N 315, cliente "
    "NOVAX) y HO 993 (LAMINADORA HOT MELT, hoja de la maquina, en 2- SECTORES\\LAMINADO). Decision de "
    "Fak del 01/10/2026: la 992 junta TODAS las operaciones del Top Roll (como 971 = APB de puerta y "
    "990 = Insert), cada hoja con su N de operacion del flujograma 155; lo que se hace para producir "
    "con la laminadora va en la 992 como operacion 20, y encendido, fusor, calentamiento, limpieza y "
    "alarmas van en la 993, que numera sus operaciones 10 a 50 como la HO 118 de la costura CNC. "
    "Formato A3 de una foto por paso (P. Gamboa). La 992 trae ademas las hojas de engrampado y de "
    "soldadura del Top Roll que hizo P. Gamboa (01/10/2026). Rev A, form I-IN-002.4-R01."
)

ENCABEZADOS = {2: "#", 3: "SECTOR", 4: "HO N", 5: "CÓDIGO", 6: "CLIENTE", 7: "DESCRIPCIÓN", 8: "TIPO",
               9: "FECHA CREACIÓN", 10: "CREADO POR", 11: "ÚLT. REV.", 12: "FECHA ÚLT. REV.", 14: "UBICACIÓN"}


def hoja(wb, nombre):
    for s in wb.Sheets:
        if s.Name == nombre:
            return s
    raise RuntimeError(f"no encontre la hoja {nombre}")


def numero(v):
    return str(v if v is not None else "").split(".")[0].strip()


def main():
    m = datetime.datetime.fromtimestamp(os.path.getmtime(LISTADO))
    print(f'{"APLICANDO" if APLICAR else "PRUEBA EN SECO"}  ·  {LISTADO}')
    print(f"ultima modificacion del listado: {m:%d/%m/%Y %H:%M}")
    lock = os.path.join(os.path.dirname(LISTADO), "~$Listado hojas de proceso.xlsx")
    if os.path.exists(lock):
        sys.exit(f"FRENADO: alguien tiene abierto el listado ({lock}).")
    if APLICAR:
        for ho, *_resto, carpeta in NUEVAS:
            if not os.path.isdir(BASE_Y + carpeta):
                sys.exit(f"FRENADO: la HO {ho} apunta a una carpeta que todavia no existe: {BASE_Y + carpeta}")

    xl = win32.DispatchEx("Excel.Application")
    xl.Visible = False
    xl.DisplayAlerts = False
    wb = None
    try:
        wb = xl.Workbooks.Open(os.path.abspath(LISTADO), False, not APLICAR)   # posicionales
        if APLICAR and wb.ReadOnly:
            raise RuntimeError("el listado se abrio en solo lectura: no se escribe.")
        ws = hoja(wb, HOJA)
        for col, esperado in ENCABEZADOS.items():
            real = str(ws.Cells(FILA_ENCABEZADO, col).Value or "").strip()
            if not real.upper().startswith(esperado):
                raise RuntimeError(f"encabezado de la columna {col}: dice {real!r}, esperaba {esperado!r}. No se toca.")

        ultima = ws.Cells(ws.Rows.Count, 3).End(-4162).Row          # xlUp sobre SECTOR
        usados, fin_general = {}, None
        for r in range(PRIMERA_FILA_DATOS, ultima + 1):
            n = numero(ws.Cells(r, 4).Value)
            if n:
                usados.setdefault(n, []).append(r)
            if str(ws.Cells(r, 3).Value or "").strip() == "GENERAL" and n:
                fin_general = r
        if fin_general is None:
            raise RuntimeError("no encontre el bloque GENERAL")
        for ho, *_ in NUEVAS:
            if str(ho) in usados:
                raise RuntimeError(f"la HO {ho} ya esta en el listado (fila {usados[str(ho)]}). No se toca.")
        if "OBSOLETO" in str(ws.Cells(fin_general, 8).Value or "").upper():
            raise RuntimeError(f"la fila {fin_general} es OBSOLETO: no sirve de modelo de formato")
        insercion = fin_general + 1
        print(f"el bloque GENERAL termina en la fila {fin_general} (HO {numero(ws.Cells(fin_general, 4).Value)}); "
              f"las filas nuevas entran en {insercion} y {insercion + len(NUEVAS) - 1}:")
        for ho, cod, cli, desc, tipo, carpeta in NUEVAS:
            print(f"  GENERAL | {ho} | {cod or ''} | {cli} | {desc} | {tipo} | {FECHA:%d/%m/%Y} | F.Santoro | A | "
                  f"{FECHA:%d/%m/%Y} | {BASE + carpeta}")
        ctx = hoja(wb, CONTEXTO)
        a15 = str(ctx.Range("A15").Value or "")
        if not re.search(r"Próximo libre: \d+", a15):
            raise RuntimeError("la celda A15 de la hoja de contexto no dice 'Próximo libre: N'")
        print(f'{CONTEXTO}!A15: "{re.search("Próximo libre: [0-9]+", a15).group(0)}" -> "Próximo libre: {PROXIMO_LIBRE}"')

        if not APLICAR:
            print("\n(prueba en seco: no se escribio nada)")
            return

        n = len(NUEVAS)
        ws.Rows(f"{insercion}:{insercion + n - 1}").Insert()
        ws.Rows(fin_general).Copy()
        ws.Rows(f"{insercion}:{insercion + n - 1}").PasteSpecial(-4122)      # xlPasteFormats
        xl.CutCopyMode = False
        for i, (ho, cod, cli, desc, tipo, carpeta) in enumerate(NUEVAS):
            r = insercion + i
            ws.Cells(r, 3).Value = "GENERAL"
            ws.Cells(r, 4).Value = ho
            if cod:
                ws.Cells(r, 5).Value = cod
            ws.Cells(r, 6).Value = cli
            ws.Cells(r, 7).Value = desc
            ws.Cells(r, 8).Value = tipo
            ws.Cells(r, 9).Value2 = SERIE
            ws.Cells(r, 10).Value = "F.Santoro"
            ws.Cells(r, 11).Value = "A"
            ws.Cells(r, 12).Value2 = SERIE
            ws.Cells(r, 14).Value = BASE + carpeta
        ultima = ws.Cells(ws.Rows.Count, 3).End(-4162).Row
        for r in range(PRIMERA_FILA_DATOS, ultima + 1):
            ws.Cells(r, 2).Value = r - 6
        ctx.Range("A15").Value = re.sub(r"Próximo libre: \d+", f"Próximo libre: {PROXIMO_LIBRE}", a15, count=1)
        libre = ctx.Cells(ctx.Rows.Count, 1).End(-4162).Row + 1
        ctx.Cells(libre, 1).Value = LINEA_CONTEXTO
        wb.Save()
        wb.Close(False)
        wb = None

        wb = xl.Workbooks.Open(os.path.abspath(LISTADO), False, True)        # relectura DEL ARCHIVO
        ws = hoja(wb, HOJA)
        print("\nGUARDADO. Relectura del archivo:")
        for r in range(fin_general, insercion + n + 1):
            print("  fila", r, "|", " | ".join(ws.Cells(r, c).Text for c in (2, 3, 4, 5, 6, 7, 9, 11, 12)))
        print(f"  # re-secuenciada hasta la fila {ultima}; contexto: linea nueva en A{libre}")
    finally:
        try:
            if wb is not None:
                wb.Close(False)
        finally:
            xl.Quit()


if __name__ == "__main__":
    main()
