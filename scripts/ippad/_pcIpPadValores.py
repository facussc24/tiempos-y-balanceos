"""
_pcIpPadValores.py — los valores del plan de control del IP PAD que dependen de un papel puntual, juntos para poder
corregirlos en un solo lugar. Cada uno lleva su fuente; lo que no tiene papel va TBD y a la lista de pendientes.
"""

# flamabilidad de los materiales en recepcion: criterio de los planes de recepcion de Calidad y de los certificados de Sansuy
# (TL 1010 / metodo VW, maximo 100 mm/min)
FLAMABILIDAD = '< 100 mm/min'
# flamabilidad de la pieza (lay out): plano del cliente C00751801 y hoja ADV PKK1 "Wrapping trim assembly" (CVTC 52034)
FLAMA_PIEZA = '≤ 70 mm/min (CVTC 52034)'

# vinilos Sanleather IV: certificados de analisis de Sansuy (CA-363026 26/03/2026, CA-389326 y CA-388926 31/03/2026, especificacion
# EPS-2206 Rev. 2), en Recepcion De Materiales - Fichas Tecnicas de Proveedores- Sansuy. No hay plan de recepcion de este vinilo.
VINILO = dict(
    fuente='certificados de Sansuy CA-363026 / CA-389326 / CA-388926 (especificación EPS-2206 Rev. 2)',
    espesor='2,95 a 3,70 mm (espesor total)',
    inst_espesor='Micrómetro MC405',
    peso='918 a 1122 g/m² (gramaje total)',
    inst_peso='Troquel de gramaje MC418 y balanza MC160',
    ancho='Mínimo 1400 mm',
)

# Sanflex G KL S202: certificado CA-1568326 de Sansuy (15/10/2026, especificacion EPS-1890 Rev. 8)
SANFLEX = dict(
    fuente='certificado de Sansuy CA-1568326 (especificación EPS-1890 Rev. 8)',
    espesor='0,5 a 0,7 mm',
    inst_espesor='Micrómetro MC405',
    ancho='Mínimo 1400 mm',
)

# espuma de soporte: el IP PAD lleva la espuma del Insert desde el 05/10/2026 (mail de C. Baptista "RE: Espuma IP Pad e
# Insert - Patagonia", 05/10/2026 14:30: "punto cerrado, queda con espuma de inserto las dos piezas unificadas"; cargado en
# las tres BOM del arb el 06/10). Valores de la ficha tecnica FT141 (C. Baptista, 13/11/2025): 35 ± 5 kg/m3, 3 mm, 1400 mm.
# La FT149 del IP PAD (45 kg/m3), la BOM006 y la BOM V3 (427ESP002TRO01, 3,15 mm) son anteriores a esa decision.
# Un papel viejo contra uno nuevo no se escribe como CONFLICTO en el plan: se busca la decision (skill planes-de-control §5 punto 8 ter).
ESPUMA = dict(
    codigo='427ESP001TRO01',
    fuente='ficha técnica Barack FT141 (13/11/2025) + mail de C. Baptista del 05/10/2026 (espuma unificada con el Insert) + BOM arb 06/10/2026',
    densidad='35 ± 5 kg/m³',
    inst_densidad='Troquel de gramaje MC418 y balanza MC160',
    espesor='3 mm (tolerancia TBD)',
    inst_espesor='Micrómetro MC405',
)

# adhesivado (op 70)
ADHESIVO = dict(
    fuente='AMFE 149 op 70',
    mezcla='TBD',
    agitacion='TBD',
    # ficha tecnica vigente del reticulante GV (Fenoclor HT.REGV Rev. 4, julio 2024): uso de la mezcla en 4 a 8 h
    vida_mezcla='4 a 8 h (ficha técnica Fenoclor HT.REGV Rev. 4)',
)

# tapizado, virolado y ultrasonido: la hoja de operaciones no da valores
CALOR_90 = 'TBD'
CALOR_91 = 'TBD'
VIROLADO = 'TBD'
ULTRASONIDO = 'TBD'
