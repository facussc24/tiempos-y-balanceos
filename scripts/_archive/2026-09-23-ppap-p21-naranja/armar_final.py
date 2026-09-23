# Arma el Excel final del AMFE 173: la CARATULA de Fak (la acomodo para imprimir el 23/09, margen
# y area de impresion B2:M29) + la hoja AMFE nueva exportada de Supabase. No toca el archivo de
# Fak: trabaja sobre una copia en tmp y guarda el resultado en tmp.
import os, shutil, sys
import win32com.client as win32
import pythoncom

FAK = r"Y:\Ingenieria\Documentacion Gestion Ingenieria\13. Analisis del modo de falla y sus efectos ( I-AC-005.3)\2. AMFES DE PROCESO\SMRC\173 - APB P21 HILO NARANJA COSTURA SIMPLE\AMFE 173 - APB P21 HILO NARANJA COSTURA SIMPLE - Rev.A.xlsx"
NUEVO = os.path.abspath(r"tmp\_rev173\export\AMFE DE PROCESO N 173 - REV A.xlsx")
BASE = os.path.abspath(r"tmp\_rev173\final\base_fak.xlsx")
SALIDA = os.path.abspath(r"tmp\_rev173\final\AMFE 173 - APB P21 HILO NARANJA COSTURA SIMPLE - Rev.A.xlsx")

os.makedirs(os.path.dirname(SALIDA), exist_ok=True)
shutil.copy2(FAK, BASE)
if os.path.exists(SALIDA):
    os.remove(SALIDA)

xl = win32.DispatchEx("Excel.Application")
xl.Visible = False
xl.DisplayAlerts = False
try:
    dst = xl.Workbooks.Open(BASE)
    src = xl.Workbooks.Open(NUEVO, 0, True)
    hoja = lambda wb, n: next(s for s in wb.Sheets if s.Name == n)
    car = hoja(dst, "Caratula")
    viejo = hoja(dst, "AMFE")
    viejo.Name = "AMFE_viejo"
    hoja(src, "AMFE").Copy(None, car)          # posicional: queda adentro de dst, despues de la caratula
    nueva = xl.ActiveSheet
    if nueva.Parent.FullName != dst.FullName:
        sys.exit("ERROR: la hoja se copio a otro libro")
    nueva.Name = "AMFE"
    viejo.Delete()
    src.Close(False)
    dst.SaveAs(SALIDA, 51)                      # 51 = xlsx
    print("hojas:", [s.Name for s in dst.Sheets])
    print("area de impresion caratula:", hoja(dst, "Caratula").PageSetup.PrintArea)
    dst.Close(False)
finally:
    xl.Quit()
print("OK ->", SALIDA)
