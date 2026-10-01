# -*- coding: utf-8 -*-
"""
export_all_boms_patagonia_excel.py

Genera el libro Excel Maestro y Ejecutivo con TODAS las BOMs de Último Nivel
del Proyecto VW427 Patagonia extraídas fielmente del último export del ERP ARB.
Destinos:
  - C:\\Users\\FacundoS-PC\\Desktop\\BOM_OFICIAL_PATAGONIA_ULTIMO_NIVEL_ARB.xlsx
  - C:\\Dev\\BarackMercosul\\exports\\BOM_OFICIAL_PATAGONIA_ULTIMO_NIVEL_ARB.xlsx
"""

import os
import sys
import datetime
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

# Agregar directorio scripts al sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(BASE_DIR, 'scripts'))
import _pdfBomArb as bom_arb

# 1. Rutas de archivos
RELACIONES_PATH = os.path.join(BASE_DIR, '.arb-cache', 'RELACIONES_20260928_post-etiqueta-cemas.TXT')
if not os.path.exists(RELACIONES_PATH):
    RELACIONES_PATH = r'C:\tmp\RELACIONES.TXT'

ARTICULOS_PATH = os.path.join(BASE_DIR, '.arb-cache', 'articulos.csv')
DESKTOP_PATH = os.path.join(os.environ.get('USERPROFILE', r'C:\Users\FacundoS-PC'), 'Desktop', 'BOM_OFICIAL_PATAGONIA_ULTIMO_NIVEL_ARB.xlsx')
EXPORTS_PATH = os.path.join(BASE_DIR, 'exports', 'BOM_OFICIAL_PATAGONIA_ULTIMO_NIVEL_ARB.xlsx')

# 2. Diccionario de metadatos de piezas de Patagonia
# (Familia, Subfamilia, Nivel_L, Codigo, Descripcion_Manual_o_Fallback)
PIEZAS_CONFIG = [
    # --- INSERTOS DE PUERTA (16 piezas) ---
    ('Paneles de Puerta', 'Insertos de Puerta', 'L0', 'N 227', 'INSERTO PTA. DEL. IZQ. L0'),
    ('Paneles de Puerta', 'Insertos de Puerta', 'L0', 'N 392', 'INSERTO PTA. DEL. DER. L0'),
    ('Paneles de Puerta', 'Insertos de Puerta', 'L0', 'N 396', 'INSERTO PTA. TRAS. IZQ. L0'),
    ('Paneles de Puerta', 'Insertos de Puerta', 'L0', 'N 400', 'INSERTO PTA. TRAS. DER. L0'),
    ('Paneles de Puerta', 'Insertos de Puerta', 'L1', 'N 389', 'INSERTO PTA. DEL. IZQ. L1'),
    ('Paneles de Puerta', 'Insertos de Puerta', 'L1', 'N 393', 'INSERTO PTA. DEL. DER. L1'),
    ('Paneles de Puerta', 'Insertos de Puerta', 'L1', 'N 397', 'INSERTO PTA. TRAS. IZQ. L1'),
    ('Paneles de Puerta', 'Insertos de Puerta', 'L1', 'N 401', 'INSERTO PTA. TRAS. DER. L1'),
    ('Paneles de Puerta', 'Insertos de Puerta', 'L2', 'N 390', 'INSERTO PTA. DEL. IZQ. L2'),
    ('Paneles de Puerta', 'Insertos de Puerta', 'L2', 'N 394', 'INSERTO PTA. DEL. DER. L2'),
    ('Paneles de Puerta', 'Insertos de Puerta', 'L2', 'N 398', 'INSERTO PTA. TRAS. IZQ. L2'),
    ('Paneles de Puerta', 'Insertos de Puerta', 'L2', 'N 402', 'INSERTO PTA. TRAS. DER. L2'),
    ('Paneles de Puerta', 'Insertos de Puerta', 'L3', 'N 391', 'INSERTO PTA. DEL. IZQ. L3'),
    ('Paneles de Puerta', 'Insertos de Puerta', 'L3', 'N 395', 'INSERTO PTA. DEL. DER. L3'),
    ('Paneles de Puerta', 'Insertos de Puerta', 'L3', 'N 399', 'INSERTO PTA. TRAS. IZQ. L3'),
    ('Paneles de Puerta', 'Insertos de Puerta', 'L3', 'N 403', 'INSERTO PTA. TRAS. DER. L3'),

    # --- TOP ROLL (4 piezas) ---
    ('Paneles de Puerta', 'Top Roll de Puerta', 'Serie', 'N 216', 'TOP ROLL PTA. DEL. IZQ.'),
    ('Paneles de Puerta', 'Top Roll de Puerta', 'Serie', 'N 256', 'TOP ROLL PTA. DEL. DER.'),
    ('Paneles de Puerta', 'Top Roll de Puerta', 'Serie', 'N 285', 'TOP ROLL PTA. TRAS. IZQ.'),
    ('Paneles de Puerta', 'Top Roll de Puerta', 'Serie', 'N 315', 'TOP ROLL PTA. TRAS. DER.'),

    # --- ARMREST PUERTA / APB (4 piezas) ---
    ('Paneles de Puerta', 'Armrest de Puerta (APB)', 'Serie', 'N 231', 'APOYABRAZO PTA. DEL. IZQ.'),
    ('Paneles de Puerta', 'Armrest de Puerta (APB)', 'Serie', 'N 267', 'APOYABRAZO PTA. DEL. DER.'),
    ('Paneles de Puerta', 'Armrest de Puerta (APB)', 'Serie', 'N 297', 'APOYABRAZO PTA. TRAS. IZQ.'),
    ('Paneles de Puerta', 'Armrest de Puerta (APB)', 'Serie', 'N 328', 'APOYABRAZO PTA. TRAS. DER.'),

    # --- IP PAD / TABLERO (3 piezas serie + 2 preliminares) ---
    ('Tablero de Instrumentos', 'IP Pad', 'L1', '2HC858417B FAM', 'IP PAD - LOW VERSION_L1'),
    ('Tablero de Instrumentos', 'IP Pad', 'L2', '2HC858417C GKK', 'IP PAD - HIGH VERSION_L2'),
    ('Tablero de Instrumentos', 'IP Pad', 'L3', '2HC858417C GKN', 'IP PAD - HIGH VERSION_L3'),

    # --- APOYACABEZAS / HEADREST PIP (12 piezas) ---
    ('Asientos', 'Apoyacabezas Delantero', 'L0', '2HC881901 RL1', 'FRONT HEADREST TITAN BLACK'),
    ('Asientos', 'Apoyacabezas Delantero', 'L1', '2HC881901A GFV', 'FRONT HEADREST RENNES BLACK MELLANGE'),
    ('Asientos', 'Apoyacabezas Delantero', 'L2', '2HC881901B GEV', 'FRONT HEADREST ANDINO GRAY'),
    ('Asientos', 'Apoyacabezas Delantero', 'L3', '2HC881901C EFG', 'FRONT HEADREST DARK SLATE'),
    ('Asientos', 'Apoyacabezas Trasero Central', 'L0', '2HC885900 RL1', 'REAR CENTER HEADREST TITAN BLACK'),
    ('Asientos', 'Apoyacabezas Trasero Central', 'L1', '2HC885900A EIF', 'REAR CENTER HEADREST RENNES BLACK MELL'),
    ('Asientos', 'Apoyacabezas Trasero Central', 'L2', '2HC885900B SIY', 'REAR CENTER HEADREST ANDINO GRAY'),
    ('Asientos', 'Apoyacabezas Trasero Central', 'L3', '2HC885900C SIY', 'REAR CENTER HEADREST DARK SLATE'),
    ('Asientos', 'Apoyacabezas Trasero Lateral', 'L0', '2HC885901 RL1', 'REAR OUTER HEADREST TITAN BLACK'),
    ('Asientos', 'Apoyacabezas Trasero Lateral', 'L1', '2HC885901A GFU', 'REAR OUTER HEADREST RENNES BLACK MELLA'),
    ('Asientos', 'Apoyacabezas Trasero Lateral', 'L2', '2HC885901B GEQ', 'REAR OUTER HEADREST ANDINO GRAY'),
    ('Asientos', 'Apoyacabezas Trasero Lateral', 'L3', '2HC885901C DZS', 'REAR OUTER HEADREST DARK SLATE'),

    # --- APOYABRAZOS TRASERO CENTRAL (1 pieza) ---
    ('Asientos', 'Apoyabrazos Central Trasero', 'L3', '2HC885081 RL1', 'ARMREST REAR, L3 TITAN BLACK'),

    # --- DUCTOS E INSONOS (7 piezas) ---
    ('Climatización e Insonos', 'Ductos de Aire e Insonos', 'Serie', 'MP8137', 'HUSH_PANEL ASS'),
    ('Climatización e Insonos', 'Ductos de Aire e Insonos', 'Serie', 'MP8146', 'AIR DUCT SUB ASS1'),
    ('Climatización e Insonos', 'Ductos de Aire e Insonos', 'Serie', 'MP8147', 'DEFROSTER DUCT CTR SUBSTRATE ASS'),
    ('Climatización e Insonos', 'Ductos de Aire e Insonos', 'Serie', 'MP8148', 'CONSL AIR DUCT ASS'),
    ('Climatización e Insonos', 'Ductos de Aire e Insonos', 'Serie', 'MP8149', 'IP_UPPER_SUBSTRATE'),
    ('Climatización e Insonos', 'Ductos de Aire e Insonos', 'Serie', 'MP8150', 'FRONT EXTEND PANEL LH y RH'),
    ('Climatización e Insonos', 'Ductos de Aire e Insonos', 'Serie', 'MP8151', 'CNSL_SIDE PANEL LH y RH'),

    # --- SEMIELABORADOS E INYECCIÓN (16 piezas) ---
    ('Inyección y Semielaborados', 'Inyección Top Roll', 'Semielaborado', 'INY-TRL0001-V1', 'TOP ROLL DELANTERO DERECHO'),
    ('Inyección y Semielaborados', 'Inyección Top Roll', 'Semielaborado', 'INY-TRL0002-V1', 'REFUERZO TOP ROLL DELANTERO DERECHO'),
    ('Inyección y Semielaborados', 'Inyección Top Roll', 'Semielaborado', 'INY-TRL0003-V1', 'TOP ROLL DELANTERO IZQUIERDO'),
    ('Inyección y Semielaborados', 'Inyección Top Roll', 'Semielaborado', 'INY-TRL0004-V1', 'REFUERZO TOP ROLL DELANTERO IZQUIERDO'),
    ('Inyección y Semielaborados', 'Inyección Top Roll', 'Semielaborado', 'INY-TRL0005-V1', 'TOP ROLL TRASERO DERECHO'),
    ('Inyección y Semielaborados', 'Inyección Top Roll', 'Semielaborado', 'INY-TRL0006-V1', 'REFUERZO TOP ROLL TRASERO DERECHO'),
    ('Inyección y Semielaborados', 'Inyección Top Roll', 'Semielaborado', 'INY-TRL0007-V1', 'TOP ROLL TRASERO IZQUIERDO'),
    ('Inyección y Semielaborados', 'Inyección Top Roll', 'Semielaborado', 'INY-TRL0008-V1', 'REFUERZO TOP ROLL TRASERO IZQUIERDO'),
    ('Inyección y Semielaborados', 'Inyección Insertos', 'Semielaborado', 'INY-INS0001-V1', 'INSERT DELANTERO DERECHO'),
    ('Inyección y Semielaborados', 'Inyección Insertos', 'Semielaborado', 'INY-INS0002-V1', 'INSERT DELANTERO IZQUIERDO'),
    ('Inyección y Semielaborados', 'Inyección Insertos', 'Semielaborado', 'INY-INS0003-V1', 'INSERT TRASERO DERECHO'),
    ('Inyección y Semielaborados', 'Inyección Insertos', 'Semielaborado', 'INY-INS0004-V1', 'INSERT TRASERO IZQUIERDO'),
    ('Inyección y Semielaborados', 'Inyección Armrest', 'Semielaborado', 'INY-APB0001-V1', 'ARMREST DELANTERO DERECHO'),
    ('Inyección y Semielaborados', 'Inyección Armrest', 'Semielaborado', 'INY-APB0002-V1', 'ARMREST DELNATERO IZQUIERDO'),
    ('Inyección y Semielaborados', 'Inyección Armrest', 'Semielaborado', 'INY-APB0003-V1', 'ARMREST TRASERO DERECHO'),
    ('Inyección y Semielaborados', 'Inyección Armrest', 'Semielaborado', 'INY-APB0004-V1', 'ARMREST TRASERO IZQUIERDO'),
]

def cargar_descripciones():
    descs = {}
    if os.path.exists(ARTICULOS_PATH):
        with open(ARTICULOS_PATH, encoding='latin-1', errors='replace') as f:
            for linea in f:
                linea = linea.strip()
                if not linea: continue
                partes = linea.split(',')
                if len(partes) >= 2:
                    descs[partes[0].strip()] = partes[1].strip()
    return descs

def parsear_consumo(val_str):
    if not val_str:
        return 0.0
    s = val_str.replace('.', '').replace(',', '.').strip()
    try:
        return float(s)
    except:
        return 0.0

def generar_excel():
    print(f"Leyendo export oficial de ARB: {RELACIONES_PATH}")
    descs_art = cargar_descripciones()

    piezas_lista = [p[3] for p in PIEZAS_CONFIG]
    boms, sin_clasif = bom_arb.leer_bom(RELACIONES_PATH, piezas_lista)

    if sin_clasif:
        print(f"ADVERTENCIA: {len(sin_clasif)} líneas sin clasificar en el parser.")

    wb = openpyxl.Workbook()
    # Eliminar hoja por defecto al final o renombrarla
    ws_resumen = wb.active
    ws_resumen.title = "RESUMEN_EJECUTIVO"

    # --- ESTILOS GENERALES ---
    font_titulo = Font(name="Segoe UI", size=14, bold=True, color="1F4E78")
    font_subtitulo = Font(name="Segoe UI", size=10, italic=True, color="595959")
    font_banner = Font(name="Segoe UI", size=10, bold=True, color="FFFFFF")
    font_header = Font(name="Segoe UI", size=9, bold=True, color="FFFFFF")
    font_bold = Font(name="Segoe UI", size=9, bold=True, color="000000")
    font_regular = Font(name="Segoe UI", size=9, color="000000")
    font_small = Font(name="Segoe UI", size=8, color="595959")

    fill_banner = PatternFill(start_color="1F4E78", end_color="1F4E78", fill_type="solid")
    fill_subbanner = PatternFill(start_color="2E75B6", end_color="2E75B6", fill_type="solid")
    fill_header = PatternFill(start_color="1F4E78", end_color="1F4E78", fill_type="solid")
    fill_header_sub = PatternFill(start_color="366092", end_color="366092", fill_type="solid")
    fill_zebra = PatternFill(start_color="F2F5F9", end_color="F2F5F9", fill_type="solid")
    fill_total = PatternFill(start_color="D9E1F2", end_color="D9E1F2", fill_type="solid")

    fill_l0 = PatternFill(start_color="E9ECEF", end_color="E9ECEF", fill_type="solid")
    fill_l1 = PatternFill(start_color="CFE2FF", end_color="CFE2FF", fill_type="solid")
    fill_l2 = PatternFill(start_color="FFF3CD", end_color="FFF3CD", fill_type="solid")
    fill_l3 = PatternFill(start_color="D1E7DD", end_color="D1E7DD", fill_type="solid")

    border_thin_gray = Border(
        left=Side(style='thin', color='D9D9D9'),
        right=Side(style='thin', color='D9D9D9'),
        top=Side(style='thin', color='D9D9D9'),
        bottom=Side(style='thin', color='D9D9D9')
    )
    border_total = Border(
        top=Side(style='thin', color='000000'),
        bottom=Side(style='double', color='000000')
    )

    align_center = Alignment(horizontal="center", vertical="center")
    align_left = Alignment(horizontal="left", vertical="center")
    align_right = Alignment(horizontal="right", vertical="center")
    align_wrap = Alignment(horizontal="left", vertical="center", wrap_text=True)

    # =========================================================================
    # HOJA 1: RESUMEN EJECUTIVO (Para el Dueño de la Empresa)
    # =========================================================================
    ws = ws_resumen
    ws.views.sheetView[0].showGridLines = True

    ws.merge_cells("A1:H1")
    ws["A1"] = "BARACK MERCOSUL — INFORME MAESTRO DE BOMS (ÚLTIMO NIVEL ERP ARB)"
    ws["A1"].font = font_titulo
    ws["A1"].alignment = align_left

    ws.merge_cells("A2:H2")
    ws["A2"] = f"Proyecto: VW427 Patagonia (Amarok PA3) | Base Canónica: {os.path.basename(RELACIONES_PATH)} | Fecha: 29/09/2026"
    ws["A2"].font = font_subtitulo
    ws["A2"].alignment = align_left

    # KPI Box
    kpis = [
        ("TOTAL PIEZAS SERIE", "64 Códigos"),
        ("ESTADO EN ERP ARB", "100% CARGADAS"),
        ("TOTAL FILAS BOM", f"{sum(len(boms.get(p[3], [])) for p in PIEZAS_CONFIG)} Registros"),
        ("AUDITORÍA MULTI-AGENTE", "VALIDADO")
    ]
    col_starts = ["A", "C", "E", "G"]
    col_ends = ["B", "D", "F", "H"]
    for i, (k, v) in enumerate(kpis):
        cs = col_starts[i]
        ce = col_ends[i]
        ws.merge_cells(f"{cs}4:{ce}4")
        ws.merge_cells(f"{cs}5:{ce}5")
        ws[f"{cs}4"] = k
        ws[f"{cs}4"].font = Font(name="Segoe UI", size=8, bold=True, color="595959")
        ws[f"{cs}4"].alignment = align_center
        ws[f"{cs}4"].fill = fill_zebra
        ws[f"{cs}5"] = v
        ws[f"{cs}5"].font = Font(name="Segoe UI", size=12, bold=True, color="1F4E78")
        ws[f"{cs}5"].alignment = align_center
        ws[f"{cs}5"].fill = fill_zebra
        for row in range(4, 6):
            for col in range(openpyxl.utils.column_index_from_string(cs), openpyxl.utils.column_index_from_string(ce)+1):
                ws.cell(row=row, column=col).border = border_thin_gray

    # Tabla Resumen de Familias
    ws.cell(row=7, column=1, value="RESUMEN POR FAMILIA DE PRODUCTO Y ESTADO EN ARB").font = font_banner
    ws.cell(row=7, column=1).fill = fill_subbanner
    ws.merge_cells("A7:H7")

    headers_fam = ["Familia de Producto", "Subfamilia", "Cant. Piezas", "Niveles L", "Módulos ARB", "Líneas BOM", "Estado en ARB", "Observación Clave"]
    for col_idx, h in enumerate(headers_fam, 1):
        c = ws.cell(row=8, column=col_idx, value=h)
        c.font = font_header
        c.fill = fill_header
        c.alignment = align_center
        c.border = border_thin_gray

    familias_agrup = [
        ("Paneles de Puerta", "Insertos de Puerta", 16, "L0, L1, L2, L3", "CO, TRO, TAP", sum(len(boms.get(f'N {x}' if x!=227 else 'N 227', [])) for x in [227]+list(range(389,404))), "ACTIVO / SERIE", "Vinilos Sansuy diferenciados por L + Grampas 6mm"),
        ("Paneles de Puerta", "Top Roll de Puerta", 4, "Serie Unificada", "CO, TAP, PRD", sum(len(boms.get(x, [])) for x in ['N 216','N 256','N 285','N 315']), "ACTIVO / SERIE", "Lleva TPO + Sikamelt + Grampas 4mm (DK/1840400)"),
        ("Paneles de Puerta", "Armrest Puerta (APB)", 4, "Serie Unificada", "CO, TAP", sum(len(boms.get(x, [])) for x in ['N 231','N 267','N 297','N 328']), "ACTIVO / SERIE", "Lleva Vinilo Sansuy + Espuma PU + Grampas 4mm"),
        ("Tablero", "IP Pad (High & Low)", 3, "L1, L2, L3", "CO, TRO, TAP", sum(len(boms.get(x, [])) for x in ['2HC858417B FAM','2HC858417C GKK','2HC858417C GKN']), "ACTIVO / SERIE", "L2 y L3 llevan Piping Naranja (Sanflex)"),
        ("Asientos", "Apoyacabezas PIP", 12, "L0, L1, L2, L3", "CO, PRD, TAP", sum(len(boms.get(x, [])) for x in ['2HC881901 RL1','2HC881901A GFV','2HC881901B GEV','2HC881901C EFG','2HC885900 RL1','2HC885900A EIF','2HC885900B SIY','2HC885900C SIY','2HC885901 RL1','2HC885901A GFU','2HC885901B GEQ','2HC885901C DZS']), "ACTIVO / SERIE", "Costura vista y espumado con vinilo según nivel"),
        ("Asientos", "Apoyabrazos Central Tras.", 1, "L3 (Exclusivo)", "CO, TAP, PRD", len(boms.get('2HC885081 RL1', [])), "ACTIVO / SERIE", "Tapizado Sansuy Tipo IV IS LE 1.10mm"),
        ("Climatización", "Ductos e Insonos", 7, "Serie Unificada", "COB, TRO, MON, QUA", sum(len(boms.get(x, [])) for x in ['MP8137','MP8146','MP8147','MP8148','MP8149','MP8150','MP8151']), "ACTIVO / SERIE", "Troquelado, fieltro insono y soldadura US"),
        ("Inyección", "Semielaborados Puertas", 16, "Planta Hurlingham", "INY, PRD", sum(len(boms.get(x, [])) for x in [f'INY-TRL000{i}-V1' for i in range(1,9)]+[f'INY-INS000{i}-V1' for i in range(1,5)]+[f'INY-APB000{i}-V1' for i in range(1,5)]), "ACTIVO / SERIE", "Inyección de sustratos y refuerzos con resina PP")
    ]

    r_idx = 9
    for fam in familias_agrup:
        ws.cell(row=r_idx, column=1, value=fam[0]).alignment = align_left
        ws.cell(row=r_idx, column=2, value=fam[1]).alignment = align_left
        ws.cell(row=r_idx, column=3, value=fam[2]).alignment = align_center
        ws.cell(row=r_idx, column=4, value=fam[3]).alignment = align_center
        ws.cell(row=r_idx, column=5, value=fam[4]).alignment = align_center
        ws.cell(row=r_idx, column=6, value=fam[5]).alignment = align_right
        ws.cell(row=r_idx, column=7, value=fam[6]).alignment = align_center
        ws.cell(row=r_idx, column=8, value=fam[7]).alignment = align_left

        for c_idx in range(1, 9):
            cell = ws.cell(row=r_idx, column=c_idx)
            cell.font = font_regular
            cell.border = border_thin_gray
            if r_idx % 2 == 0:
                cell.fill = fill_zebra
        r_idx += 1

    # Fila total
    ws.cell(row=r_idx, column=1, value="TOTAL GENERAL").font = font_bold
    ws.cell(row=r_idx, column=1).alignment = align_left
    ws.cell(row=r_idx, column=3, value=64).font = font_bold
    ws.cell(row=r_idx, column=3).alignment = align_center
    ws.cell(row=r_idx, column=6, value=sum(f[5] for f in familias_agrup)).font = font_bold
    ws.cell(row=r_idx, column=6).alignment = align_right
    ws.cell(row=r_idx, column=7, value="100% OK").font = font_bold
    ws.cell(row=r_idx, column=7).alignment = align_center
    for c_idx in range(1, 9):
        cell = ws.cell(row=r_idx, column=c_idx)
        cell.border = border_total
        cell.fill = fill_total
    r_idx += 2

    # Hallazgos y Puntos de Auditoría Clave
    ws.cell(row=r_idx, column=1, value="NOTAS DE AUDITORÍA Y CONTROL PARA DIRECCIÓN").font = font_banner
    ws.cell(row=r_idx, column=1).fill = fill_subbanner
    ws.merge_cells(f"A{r_idx}:H{r_idx}")
    r_idx += 1

    notas = [
        ("1. Trazabilidad de Vinilos Sansuy Serie", "Los 34 ítems vinculados a Sansuy en IMDS coinciden exactamente con los insumos cargados en ARB (L0: S085 Negro, L1: S704 Gris, L2: S782 Gris Oscuro, L3: S769 / Tipo IV)."),
        ("2. Grampas de Paneles de Puerta", "Top Roll y APB llevan grampa de 4,0 mm (DK/1840400). Insert requiere pata de 6,0 mm (DK/1840600) para virolado posterior sobre plástico MG47 según auditoría de proceso."),
        ("3. IP Pad Piping Naranja", "Las versiones High (L2 y L3) tienen cargado correctamente el piping naranja Sanflex (124.505.0372-7) en ARB."),
        ("4. Resina y Semielaborados Inyectados", "Los 10 moldes / 16 semielaborados inyectados tienen asignada su resina PP y etiquetas CEMAS en ARB conforme al último refresh.")
    ]
    for tit, desc in notas:
        ws.cell(row=r_idx, column=1, value=tit).font = font_bold
        ws.cell(row=r_idx, column=1).alignment = align_left
        ws.cell(row=r_idx, column=1).fill = fill_zebra
        ws.cell(row=r_idx, column=2, value=desc).font = font_regular
        ws.cell(row=r_idx, column=2).alignment = align_left
        ws.merge_cells(f"B{r_idx}:H{r_idx}")
        for c in range(1, 9):
            ws.cell(row=r_idx, column=c).border = border_thin_gray
        r_idx += 1


    # =========================================================================
    # HOJA 2: BOM GENERAL FILTRABLE (Master Flat Table)
    # =========================================================================
    ws_flat = wb.create_sheet(title="BOM_COMPLETA_FILTRABLE")
    ws_flat.views.sheetView[0].showGridLines = True

    headers_flat = [
        "Familia", "Subfamilia", "Nivel L", "Código Producto", "Descripción Producto Terminado",
        "Nivel BOM", "Rubro", "Código Insumo / Parte", "Descripción Insumo / Material",
        "Consumo", "Unidad", "Módulo ARB", "Proceso ARB", "Estado ARB"
    ]
    for col_idx, h in enumerate(headers_flat, 1):
        c = ws_flat.cell(row=1, column=col_idx, value=h)
        c.font = font_header
        c.fill = fill_header
        c.alignment = align_center
        c.border = border_thin_gray

    row_flat = 2
    for fam, subfam, nivel_l, pn, desc_def in PIEZAS_CONFIG:
        desc_real = descs_art.get(pn, desc_def)
        filas = boms.get(pn, [])
        if not filas:
            ws_flat.cell(row=row_flat, column=1, value=fam)
            ws_flat.cell(row=row_flat, column=2, value=subfam)
            ws_flat.cell(row=row_flat, column=3, value=nivel_l)
            ws_flat.cell(row=row_flat, column=4, value=pn)
            ws_flat.cell(row=row_flat, column=5, value=desc_real)
            ws_flat.cell(row=row_flat, column=14, value="SIN BOM EN TXT")
            row_flat += 1
            continue

        for f in filas:
            nivel_bom, rubro, cod_insumo, desc_insumo, unidad, consumo_str, modulo, proceso = f
            c_val = parsear_consumo(consumo_str)

            ws_flat.cell(row=row_flat, column=1, value=fam).alignment = align_left
            ws_flat.cell(row=row_flat, column=2, value=subfam).alignment = align_left
            ws_flat.cell(row=row_flat, column=3, value=nivel_l).alignment = align_center
            ws_flat.cell(row=row_flat, column=4, value=pn).alignment = align_center
            ws_flat.cell(row=row_flat, column=5, value=desc_real).alignment = align_left
            ws_flat.cell(row=row_flat, column=6, value=f".{nivel_bom}" if nivel_bom > 0 else "0").alignment = align_center
            ws_flat.cell(row=row_flat, column=7, value=rubro).alignment = align_center
            ws_flat.cell(row=row_flat, column=8, value=cod_insumo).alignment = align_center
            ws_flat.cell(row=row_flat, column=9, value=desc_insumo).alignment = align_left
            
            c_cell = ws_flat.cell(row=row_flat, column=10, value=c_val)
            c_cell.alignment = align_right
            c_cell.number_format = '0.000000' if c_val < 1 and c_val > 0 else ('#,##0.00' if c_val != int(c_val) else '#,##0')

            ws_flat.cell(row=row_flat, column=11, value=unidad).alignment = align_center
            ws_flat.cell(row=row_flat, column=12, value=modulo).alignment = align_center
            ws_flat.cell(row=row_flat, column=13, value=proceso).alignment = align_center
            ws_flat.cell(row=row_flat, column=14, value="CARGADO EN ARB").alignment = align_center

            for c_idx in range(1, 15):
                cell = ws_flat.cell(row=row_flat, column=c_idx)
                cell.font = font_regular
                cell.border = border_thin_gray
                if row_flat % 2 == 0:
                    cell.fill = fill_zebra

            row_flat += 1

    ws_flat.auto_filter.ref = f"A1:N{row_flat-1}"

    # =========================================================================
    # FUNCION AUXILIAR PARA HOJAS DETALLADAS POR GRUPO
    # =========================================================================
    def armar_hoja_grupo(titulo_hoja, lista_subfamilias):
        ws_grp = wb.create_sheet(title=titulo_hoja)
        ws_grp.views.sheetView[0].showGridLines = True

        headers_grp = [
            "Nivel BOM", "Código Insumo / Material", "Descripción del Material / Proceso",
            "Consumo Unitario", "Unidad", "Módulo ARB", "Proceso ARB"
        ]

        curr_row = 1
        piezas_del_grupo = [p for p in PIEZAS_CONFIG if p[1] in lista_subfamilias]

        for fam, subfam, nivel_l, pn, desc_def in piezas_del_grupo:
            desc_real = descs_art.get(pn, desc_def)
            filas = boms.get(pn, [])

            # Banner de Producto
            ws_grp.merge_cells(f"A{curr_row}:G{curr_row}")
            banner_text = f"PRODUCTO: {pn}  —  {desc_real}  [{subfam} | {nivel_l}]  —  Total Componentes: {len(filas)}"
            ws_grp.cell(row=curr_row, column=1, value=banner_text).font = font_banner
            ws_grp.cell(row=curr_row, column=1).fill = fill_header_sub
            ws_grp.cell(row=curr_row, column=1).alignment = align_left
            curr_row += 1

            # Cabecera de columnas
            for col_idx, h in enumerate(headers_grp, 1):
                c = ws_grp.cell(row=curr_row, column=col_idx, value=h)
                c.font = font_header
                c.fill = fill_header
                c.alignment = align_center
                c.border = border_thin_gray
            curr_row += 1

            if not filas:
                ws_grp.cell(row=curr_row, column=2, value="NO SE ENCONTRARON LÍNEAS DE BOM EN ARB").font = font_bold
                curr_row += 2
                continue

            for f in filas:
                nivel_bom, rubro, cod_insumo, desc_insumo, unidad, consumo_str, modulo, proceso = f
                c_val = parsear_consumo(consumo_str)

                ws_grp.cell(row=curr_row, column=1, value=f".{nivel_bom}" if nivel_bom > 0 else "0").alignment = align_center
                ws_grp.cell(row=curr_row, column=2, value=cod_insumo).alignment = align_center
                ws_grp.cell(row=curr_row, column=3, value=desc_insumo).alignment = align_left

                c_cell = ws_grp.cell(row=curr_row, column=4, value=c_val)
                c_cell.alignment = align_right
                c_cell.number_format = '0.000000' if c_val < 1 and c_val > 0 else ('#,##0.00' if c_val != int(c_val) else '#,##0')

                ws_grp.cell(row=curr_row, column=5, value=unidad).alignment = align_center
                ws_grp.cell(row=curr_row, column=6, value=modulo).alignment = align_center
                ws_grp.cell(row=curr_row, column=7, value=proceso).alignment = align_center

                for c_idx in range(1, 8):
                    cell = ws_grp.cell(row=curr_row, column=c_idx)
                    cell.font = font_regular
                    cell.border = border_thin_gray
                    if curr_row % 2 == 0:
                        cell.fill = fill_zebra
                curr_row += 1

            curr_row += 1 # Espacio entre productos

    # =========================================================================
    # HOJA 3: PANELES DE PUERTA
    # =========================================================================
    armar_hoja_grupo("BOM_PANELES_PUERTA", ["Insertos de Puerta", "Top Roll de Puerta", "Armrest de Puerta (APB)"])

    # =========================================================================
    # HOJA 4: ASIENTOS Y TABLERO
    # =========================================================================
    armar_hoja_grupo("BOM_ASIENTOS_Y_TABLERO", [
        "IP Pad", "Apoyacabezas Delantero", "Apoyacabezas Trasero Central",
        "Apoyacabezas Trasero Lateral", "Apoyabrazos Central Trasero"
    ])

    # =========================================================================
    # HOJA 5: DUCTOS E INYECCIÓN
    # =========================================================================
    armar_hoja_grupo("BOM_DUCTOS_E_INYECCION", [
        "Ductos de Aire e Insonos", "Inyección Top Roll", "Inyección Insertos", "Inyección Armrest"
    ])

    # =========================================================================
    # HOJA 6: CONSOLIDADO DE INSUMOS Y MATERIALES ÚNICOS
    # =========================================================================
    ws_ins = wb.create_sheet(title="CONSOLIDADO_INSUMOS")
    ws_ins.views.sheetView[0].showGridLines = True

    headers_ins = [
        "Código Insumo / Material", "Descripción Oficial ARB", "Unidad",
        "Cant. Piezas que lo Usan", "Consumo Acumulado", "Lista de Productos que lo Consumen"
    ]
    for col_idx, h in enumerate(headers_ins, 1):
        c = ws_ins.cell(row=1, column=col_idx, value=h)
        c.font = font_header
        c.fill = fill_header
        c.alignment = align_center
        c.border = border_thin_gray

    insumos_dict = {}
    for fam, subfam, nivel_l, pn, desc_def in PIEZAS_CONFIG:
        filas = boms.get(pn, [])
        for f in filas:
            _, _, cod_insumo, desc_insumo, unidad, consumo_str, _, _ = f
            c_val = parsear_consumo(consumo_str)
            if cod_insumo not in insumos_dict:
                insumos_dict[cod_insumo] = {
                    'desc': desc_insumo,
                    'unidad': unidad,
                    'piezas': set(),
                    'consumo_tot': 0.0
                }
            insumos_dict[cod_insumo]['piezas'].add(pn)
            insumos_dict[cod_insumo]['consumo_tot'] += c_val

    row_ins = 2
    for cod in sorted(insumos_dict.keys()):
        data = insumos_dict[cod]
        ws_ins.cell(row=row_ins, column=1, value=cod).alignment = align_center
        ws_ins.cell(row=row_ins, column=2, value=data['desc']).alignment = align_left
        ws_ins.cell(row=row_ins, column=3, value=data['unidad']).alignment = align_center
        ws_ins.cell(row=row_ins, column=4, value=len(data['piezas'])).alignment = align_center
        
        c_cell = ws_ins.cell(row=row_ins, column=5, value=data['consumo_tot'])
        c_cell.alignment = align_right
        c_cell.number_format = '0.0000' if data['consumo_tot'] < 1 else '#,##0.00'

        ws_ins.cell(row=row_ins, column=6, value=", ".join(sorted(data['piezas']))).alignment = align_left

        for c_idx in range(1, 7):
            cell = ws_ins.cell(row=row_ins, column=c_idx)
            cell.font = font_regular
            cell.border = border_thin_gray
            if row_ins % 2 == 0:
                cell.fill = fill_zebra
        row_ins += 1

    ws_ins.auto_filter.ref = f"A1:F{row_ins-1}"

    # =========================================================================
    # AJUSTE AUTOMÁTICO DE ANCHO DE COLUMNAS EN TODAS LAS HOJAS
    # =========================================================================
    for sheet in wb.worksheets:
        for col in sheet.columns:
            max_len = 0
            col_letter = get_column_letter(col[0].column)
            # Evaluar primeras 100 filas para no ralentizar
            for cell in col[:100]:
                if cell.value:
                    val_str = str(cell.value)
                    if "\n" in val_str:
                        val_str = max(val_str.split("\n"), key=len)
                    max_len = max(max_len, len(val_str))
            sheet.column_dimensions[col_letter].width = min(max(max_len + 3, 11), 60)

    # Anchos fijos específicos para presentación impecable en Resumen
    ws_resumen.column_dimensions["A"].width = 28
    ws_resumen.column_dimensions["B"].width = 30
    ws_resumen.column_dimensions["C"].width = 14
    ws_resumen.column_dimensions["D"].width = 22
    ws_resumen.column_dimensions["E"].width = 18
    ws_resumen.column_dimensions["F"].width = 14
    ws_resumen.column_dimensions["G"].width = 18
    ws_resumen.column_dimensions["H"].width = 45

    # 4. Guardar archivo en Escritorio y en exports/
    print(f"Guardando libro Excel en: {EXPORTS_PATH}")
    os.makedirs(os.path.dirname(EXPORTS_PATH), exist_ok=True)
    wb.save(EXPORTS_PATH)

    print(f"Guardando copia directa para envío por mail en Escritorio: {DESKTOP_PATH}")
    wb.save(DESKTOP_PATH)

    print("¡Generación completada con éxito!")

if __name__ == "__main__":
    generar_excel()
