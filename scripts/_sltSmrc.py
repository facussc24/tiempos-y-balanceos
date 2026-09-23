# -*- coding: utf-8 -*-
"""_sltSmrc.py — arma la SLT (Supplier Logistics Template & Packaging Form) de SMRC / Motherson
para un part number NUEVO, copiando la de una variante anterior que tiene el mismo embalaje, y la
pasa a PDF (hojas SLT + Packaging Form, lo que se le manda al cliente).

Por que existe (APB P21 hilo naranja, 23/09/2026): la SLT se hacia a mano copiando la del hilo
verde, y la copia ARRASTRO todo lo que era de la otra pieza: la aprobacion de SMRC (Packaging Form
M79 = "J", "Validated") con las firmas de 2024, el contacto de logistica que ya no estaba en
Barack, el peso (0,100 kg contra 0,265 medidos), la vida del programa (7 años contra 1) y el
volumen (27.600 autos/año contra 4.000). Lo cazo una auditoria independiente antes de mandarla.
Este script obliga a pasar cada dato que cambia de pieza a pieza; lo que no se pasa, NO se copia
de la base sin avisar.

Uso (todo en una linea; los datos salen de la carta de nominacion y de la balanza):
  python scripts/_sltSmrc.py --base "<SLT de la variante anterior>.xlsx" --dest "<carpeta>"
      --codigo 00257327-01-NHZD --nombre "ACCOUDOIR P21-AV.D-TEP V252 HZD / FIL ORANGE – ASSY"
      --proyecto "P21 HILO NARANJA" --volumen-anual 4000 --capacidad-semanal 270
      --vida 1 --peso-kg 0.265
      --contacto "Luciano Lo Castro" --telefono 1154123104 --mail llocastro@barackmercosul.com
      [--dias-anio 235] [--firma-proveedor "Luciano Lo Castro"]
      [--firmas-smrc "Alejandro Urbano;Marcos Gramajo;Fernando Carizza"] [--estado J|K|L]
      [--pdf-dir "<carpeta de los PDF>"]

Sin --firmas-smrc / --estado, el bloque de validacion queda como la plantilla EN BLANCO de SMRC
(firmas "click here to sign", estado "L"): la aprobacion la da el ingeniero de embalaje de SMRC.
Fak, el 23/09/2026, completo las firmas y puso la carita verde ("J") antes de mandarla: si se
repite, se pasan con los parametros, a conciencia.

Celdas (hoja Inputs, plantilla SMRC ver 2.0): F5 proyecto · E15 nombre · G15 codigo · L15 peso
por pieza · E19 volumen anual (F.P.V.) · G19 vida del programa · H19 dias por año · E22 capacidad
anual (C.P.V. = capacidad semanal / 5 dias * dias por año) · H26/J26/K26 contacto.
Packaging Form: D78 proveedor · D82/D84/D86 SMRC · M79 estado (J Validated / K On going / L Not
validated, dice el comentario de la celda). La hoja esta PROTEGIDA: solo se escriben valores; el
telefono va con apostrofo para que no salga como 5,49E+12.
"""
import argparse, os, shutil, sys

p = argparse.ArgumentParser(description=__doc__.split('\n')[0])
p.add_argument('--base', required=True)
p.add_argument('--dest', required=True)
p.add_argument('--codigo', required=True)
p.add_argument('--nombre', required=True)
p.add_argument('--proyecto', required=True)
p.add_argument('--volumen-anual', type=float, required=True)
p.add_argument('--capacidad-semanal', type=float, required=True)
p.add_argument('--vida', type=float, required=True)
p.add_argument('--peso-kg', type=float, required=True)
p.add_argument('--contacto', required=True)
p.add_argument('--telefono', required=True)
p.add_argument('--mail', required=True)
p.add_argument('--dias-anio', type=float, default=235)
p.add_argument('--firma-proveedor', default='click here to sign')
p.add_argument('--firmas-smrc', default='click here to sign;click here to sign;click here to sign')
p.add_argument('--estado', choices=['J', 'K', 'L'], default='L')
p.add_argument('--pdf-dir', default=None)
a = p.parse_args()

firmas = [f.strip() for f in a.firmas_smrc.split(';')]
if len(firmas) != 3:
    sys.exit('--firmas-smrc lleva TRES nombres separados por ";" (Manufacturing/Packaging; Logistics manager; Project Packaging)')
if not os.path.isfile(a.base):
    sys.exit(f'no existe la base: {a.base}')
os.makedirs(a.dest, exist_ok=True)
proy_archivo = a.proyecto.replace('P21 ', '').title().replace(' ', '_')
destino = os.path.join(a.dest, f'BARACK_SMRC_SLT_{proy_archivo}_{a.codigo}.xlsx')
if os.path.exists(destino):
    sys.exit(f'ya existe, no se pisa: {destino}')
shutil.copy2(a.base, destino)

import win32com.client as win32
xl = win32.DispatchEx('Excel.Application')
xl.Visible = False
xl.DisplayAlerts = False
try:
    wb = xl.Workbooks.Open(os.path.abspath(destino))
    hoja = lambda n: next(s for s in wb.Sheets if s.Name == n)
    inp, slt, pf = hoja('Inputs'), hoja('SLT'), hoja('Packaging Form')
    inp.Range('F5').Value = ' ' + a.proyecto
    inp.Range('E15').Value = a.nombre
    inp.Range('G15').Value = a.codigo
    inp.Range('L15').Value = a.peso_kg
    inp.Range('E19').Formula = f'={a.volumen_anual:g}'
    inp.Range('G19').Value = a.vida
    inp.Range('H19').Value = a.dias_anio
    inp.Range('E22').Formula = f'={a.capacidad_semanal:g}/5*{a.dias_anio:g}'
    inp.Range('H26').Value = a.contacto
    inp.Range('J26').Value = "'" + a.telefono
    inp.Range('K26').Value = a.mail
    pf.Range('D78').Value = a.firma_proveedor
    for celda, nombre in zip(('D82', 'D84', 'D86'), firmas):
        pf.Range(celda).Value = nombre
    pf.Range('M79').Value = a.estado
    xl.CalculateFull()
    print(f'{a.codigo} | {slt.Range("E12").Value} | {inp.Range("E15").Value}')
    print(f'   F.P.V. {inp.Range("E19").Value:g}/año = {slt.Range("J12").Value:g} autos/dia · '
          f'C.P.V. {inp.Range("E22").Value:g}/año = {slt.Range("J13").Value:g} autos/dia · vida {inp.Range("G19").Value:g}')
    print(f'   peso {slt.Range("G12").Value} kg · bruto por caja {slt.Range("I35").Text} · '
          f'{slt.Range("B26").Value:g} piezas por caja, {slt.Range("H26").Value:g} caja(s) por unidad de carga')
    print(f'   contacto {slt.Range("B16").Value} · {slt.Range("F16").Text} · {slt.Range("D16").Value}')
    print(f'   validacion: estado {a.estado} · proveedor {a.firma_proveedor} · SMRC {"; ".join(firmas)}')
    wb.Save()
    pdf_dir = a.pdf_dir or a.dest
    os.makedirs(pdf_dir, exist_ok=True)
    pdf = os.path.join(os.path.abspath(pdf_dir), os.path.basename(destino)[:-5] + '.pdf')
    if os.path.exists(pdf):
        sys.exit(f'ya existe el PDF, no se pisa: {pdf}')
    wb.Sheets(['SLT', 'Packaging Form']).Select()
    xl.ActiveSheet.ExportAsFixedFormat(0, pdf)
    wb.Close(False)
    print(f'OK\n   {destino}\n   {pdf}')
finally:
    xl.Quit()
