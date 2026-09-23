# PDFs no editables para el mail a Capuana: las dos SLT (hojas SLT + Packaging Form) y el AMFE 173
# (caratula de Fak + hoja AMFE). Excel COM, ExportAsFixedFormat. Todo desde los archivos del SERVIDOR.
import os
import win32com.client as win32

OUT = os.path.abspath(r"tmp\_rev173\pdf_capuana")
os.makedirs(OUT, exist_ok=True)
FE = r"Y:\Ingenieria\Documentacion Gestion Ingenieria\17. Fichas de embalaje\2- CLIENTES\SMRC\P21\HILO NARANJA MY2026"
AMFE = r"Y:\Ingenieria\Documentacion Gestion Ingenieria\13. Analisis del modo de falla y sus efectos ( I-AC-005.3)\2. AMFES DE PROCESO\SMRC\173 - APB P21 HILO NARANJA COSTURA SIMPLE\AMFE 173 - APB P21 HILO NARANJA COSTURA SIMPLE - Rev.A.xlsx"

xl = win32.DispatchEx("Excel.Application")
xl.Visible = False
xl.DisplayAlerts = False
try:
    for n in ("00257327-01-NHZD", "00257328-01-NHZD"):
        wb = xl.Workbooks.Open(os.path.join(FE, f"BARACK_SMRC_SLT_Hilo_Naranja_{n}.xlsx"), 0, True)
        destino = os.path.join(OUT, f"BARACK_SMRC_SLT_Hilo_Naranja_{n}.pdf")
        if os.path.exists(destino):
            os.remove(destino)
        wb.Sheets(["SLT", "Packaging Form"]).Select()
        xl.ActiveSheet.ExportAsFixedFormat(0, destino)
        wb.Close(False)
        print("OK", destino)
    wb = xl.Workbooks.Open(AMFE, 0, True)
    hoja = next(s for s in wb.Sheets if s.Name == "AMFE")
    ps = hoja.PageSetup
    ps.Orientation = 2          # apaisado
    ps.PaperSize = 8            # A3
    ps.Zoom = False
    ps.FitToPagesWide = 1
    ps.FitToPagesTall = False
    ps.PrintTitleRows = "$13:$14"   # los dos renglones de titulos se repiten en cada hoja (auditoria 23/09)
    destino = os.path.join(OUT, "AMFE 173 - APB P21 HILO NARANJA COSTURA SIMPLE - Rev.A.pdf")
    if os.path.exists(destino):
        os.remove(destino)
    wb.ExportAsFixedFormat(0, destino)
    wb.Close(False)
    print("OK", destino)
finally:
    xl.Quit()
