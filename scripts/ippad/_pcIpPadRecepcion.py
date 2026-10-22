"""
_pcIpPadRecepcion.py — filas de recepcion (operacion 10) del plan de control de costura y tapizado del IP PAD Patagonia
(2HC.858.417.B FAM L1 / 2HC.858.417.C GKK L2 / 2HC.858.417.C GKN L3).

Un material por cada linea comprada de la BOM ultimo nivel del arb (`BOM ARB ultimo nivel_IP Pad_20261006.pdf`, legajo 7-),
MENOS la resina PC+ABS Cycoloy C1200HF (22022222), que ya la controla el plan de Calidad `PC INYECCION PLASTICA IP PAD`
(Rev A, 14/06/2026). Los semielaborados propios (INY-IPP0001-V1, INY-IPP0002-V1) no se reciben.

De donde sale cada fila (relevado el 22/10/2026):
  - planes de recepcion de Calidad (`Y:\\BARACK\\CALIDAD\\DOCUMENTACION SGC\\Recepcion De Materiales\\1 - Planes de control\\`):
    1048 Rev A (Tesa 52110), 729 Rev E (adhesivo FA), 730 Rev C (reticulante GV), 1043 Rev B / 1063 Rev A / 1064 Rev A
    (hilos Linhanyl; 1063 y 1064 repiten numero con dos estructuras de apoyacabezas: por eso va el codigo del hilo al lado)
  - sin plan de recepcion (vinilos Sanleather IV, Sanflex G KL, cordon de piping, espuma PU, grampa 84/06, espuma de
    polietileno, etiquetas): el control de deteccion del AMFE 149 op 10 y la ficha o certificado del proveedor; lo que no
    tiene papel va TBD y a la lista de pendientes
  - consignados de VW (logo airbag, clip, tornillo, carcasa de difusor): AMFE 149 op 10, "Inspección visual 100% en recepcion"
  - siglas: se COPIAN del AMFE 149 op 10 (Supabase, updated_at 15/10/2026): D/TLD en flamabilidad del vinilo (S10 O2) y de
    la espuma (S10 O2), y en el logo airbag (S9 O2). En el plan de control se escribe D sola (skill planes-de-control §5.5).
  - responsable, muestra y frecuencia: como el plan de inyeccion de Calidad de esta pieza (1 muestra, por lote de entrega,
    P-10/I. / ARB, Auditor de recepcion, P-14.)
Instrumentos contra el cronograma de calibracion 2026 Rev.7: cinta de recepcion MC403; camara de flamabilidad MC184.

Cada fila de `filas`: (caracteristica, sigla, especificacion, instrumento, cambios a la muestra/frecuencia/registro o None).
"""
from _pcIpPadValores import VINILO, SANFLEX, ESPUMA, FLAMABILIDAD

TODAS = dict(tam='100%')
ANUAL = dict(tam='---', frec='Anual')
ENSAYO = dict(reg='I-AC-027.I / P-10/I. / ARB')
LOTE = ('Lote / trazabilidad', '', 'Lote en el certificado y en la etiqueta, registrado en ARB', 'Visual / certificado del proveedor', None)
LIMPIO = ('Aspecto / limpieza', '', 'Sin suciedad, manchas ni contaminación; embalaje sin daños', 'Visual', None)
FLAMA = ('Flamabilidad', 'D', FLAMABILIDAD, 'Cámara de flamabilidad MC184', ENSAYO)


def _hilo(codigo, plan, titulo, color):
    """Plan de recepcion de los hilos Linhanyl (1043 / 1063 / 1064): mismas caracteristicas, cambia titulo y color."""
    return [
        ('Número métrico', '', titulo, 'Etiqueta del producto', None),
        ('Material', '', '100 % poliéster', 'Certificado del proveedor', None),
        ('Cantidad de cabos', '', '3', 'Visual', None),
        ('Color', '', f'{color}, igual al patrón', 'Visual contra patrón', None),
        ('Solidez a la luz', '', '≥ 4', 'Certificado del proveedor', ANUAL),
        ('Flamabilidad', '', '< 100 mm/min', 'Certificado del proveedor', ANUAL),
    ]


RECEPCION = [
    dict(prod='Vinilo Sansuy Sanleather IV — CL74 S704 (1246030227) / CL74 S782 (1246030229) / ML14 S769 (1246030230)',
         fuente='BOM arb 06/10/2026 + AMFE 149 op 10 (vinilo: espesor, color, flamabilidad D/TLD S10 O2) + ' + VINILO['fuente'],
         filas=[
             LIMPIO,
             ('Color y grabado', '', 'Según patrón de cada color', 'Visual contra patrón', None),
             ('Espesor', '', VINILO['espesor'], VINILO['inst_espesor'], None),
             ('Peso', '', VINILO['peso'], VINILO['inst_peso'], None),
             ('Ancho del rollo', '', VINILO['ancho'], 'Cinta métrica MC403', None),
             FLAMA,
             LOTE,
         ]),
    dict(prod='Vinilo de piping Sansuy Sanflex G KL naranja S202 — 124.505.0372-7 (solo L2 / L3)',
         fuente='BOM arb 06/10/2026 + BOM Barack V3 (25 mm de ancho) + AMFE 149 op 10 (piping: inspección visual y dimensional) + ' + SANFLEX['fuente'],
         filas=[
             ('Color', '', 'Naranja S202 (certificado: Laranja S-202), igual al patrón', 'Visual contra patrón', None),
             ('Espesor', '', SANFLEX['espesor'], SANFLEX['inst_espesor'], None),
             ('Ancho del rollo', '', SANFLEX['ancho'], 'Cinta métrica MC403', None),
             ('Flamabilidad', '', 'Autoextinguible, máximo 100 mm/min', 'Certificado del proveedor', None),
             LOTE,
         ]),
    dict(prod='Cordón de piping PVC 1,3 mm negro — 427VAR002COS01 (solo L2 / L3)',
         fuente='BOM arb 06/10/2026 + AMFE 149 op 10 (piping tubing: aspecto contra patrón por entrega; dimensional por informe del proveedor por lote; cantidad contra remito; lote en ARB)',
         filas=[
             ('Aspecto', '', 'Sin rebaba, marcas ni deformación', 'Visual contra patrón de aspecto', None),
             ('Diámetro', '', '1,3 mm (tolerancia TBD)', 'Informe de control dimensional del proveedor', dict(frec='Por lote.')),
             ('Color', '', 'Negro', 'Visual', None),
             ('Cantidad', '', 'Igual al remito', 'Conteo contra remito', None),
             LOTE,
         ]),
    dict(prod='Espuma PU — ' + ESPUMA['codigo'],
         fuente='BOM arb 06/10/2026 + AMFE 149 op 10 (espuma: densidad, espesor, flamabilidad D/TLD S10 O2) + ' + ESPUMA['fuente'],
         filas=[
             ('Densidad', '', ESPUMA['densidad'], ESPUMA['inst_densidad'], None),
             ('Espesor', '', ESPUMA['espesor'], ESPUMA['inst_espesor'], None),
             FLAMA,
             LOTE,
         ]),
    dict(prod='Cinta adhesiva transfer Tesa 52110 (1500 mm x 200 m) — plan de recepción N° 1048',
         fuente='plan de recepcion 1048 Rev A (Tesa 52110 Transfer Glassine, 27/08/2025)',
         filas=[
             ('Color', '', 'Transparente', 'Visual', None),
             ('Espesor', '', '100 µm', 'Certificado del proveedor', None),
             ('Liner', '', 'Glassine (papel cristal), color amarillo', 'Visual', None),
             ('Peso de la cinta sin liner', '', '100 ± 10 g/m²', 'Certificado del proveedor', None),
             ('Adhesión y fuerza de despegue', '', 'Según plan de control de recepción N° 1048', 'Certificado del proveedor', None),
             ('Vencimiento', '', 'Mínimo 12 meses', 'Etiqueta del producto', None),
         ]),
    dict(prod='Adhesivo Fenoclor FA (AD - ADFA15) — plan de recepción N° 729',
         fuente='plan de recepcion 729 Rev E (25/09/2025)',
         filas=[
             ('Certificado de calidad', '', 'Con número de partida', 'Certificado del proveedor', None),
             ('Color', '', 'Incoloro a ámbar claro', 'Visual', None),
             ('Viscosidad', '', '2400 cP ± 15 %', 'Certificado del proveedor', None),
             ('Vencimiento', '', 'Menos de 179 días, según certificado y ficha técnica', 'Certificado del proveedor', None),
         ]),
    dict(prod='Reticulante Fenoclor GV (AD - REGV0.6) — plan de recepción N° 730',
         fuente='plan de recepcion 730 Rev C (25/09/2025)',
         filas=[
             ('Certificado de calidad', '', 'Con número de partida', 'Certificado del proveedor', None),
             ('Color', '', 'Verde', 'Visual', None),
             ('Viscosidad', '', '50 cP ± 25 %', 'Certificado del proveedor', None),
             ('Vencimiento', '', 'Menos de 179 días, según certificado', 'Certificado del proveedor', None),
         ]),
    dict(prod='Hilo de unión Linhanyl Nm 30/3 negro — FX284-E0PTO, plan de recepción N° 1043',
         fuente='plan de recepcion 1043 Rev B (03/09/2025; la flamabilidad va con el "<" de la TL 1010, el plan escribe "100 mm/min")',
         filas=_hilo('FX284-E0PTO', '1043', 'Nm 30/3', 'E0PTO negro')),
    dict(prod='Hilo de costura vista Linhanyl Nm 20/3 Alpe Gray — FX483TK-11930E, plan de recepción N° 1063 (solo L1)',
         fuente='plan de recepcion 1063 Rev A (hilo FX483TK-11930E)',
         filas=_hilo('FX483TK-11930E', '1063', 'Nm 20/3', '11930E Alpe Gray')),
    dict(prod='Hilo de costura vista Linhanyl Nm 20/3 Gray Violet — FX483TK-11703E, plan de recepción N° 1064 (solo L2 / L3)',
         fuente='plan de recepcion 1064 Rev A (12/05/2026, hilo FX483TK-11703E)',
         filas=_hilo('FX483TK-11703E', '1064', 'Nm 20/3', '11703E Gray Violet')),
    dict(prod='Grampa Dorking 84/06 (6 mm) — DK/1840600',
         fuente='BOM arb 06/10/2026 (L1 12 / L2-L3 11). Sin plan de recepcion vigente de este codigo (solo el obsoleto)',
         filas=[
             ('Tipo de grampa', '', 'Dorking 84/06, 6 mm', 'Etiqueta del producto', None),
             ('Dimensional', '', 'TBD', 'TBD', None),
             LOTE,
         ]),
    dict(prod='Espuma de polietileno expandido 2 mm (rollo 1 x 20 m) — EMBEPE2X1X20 (embalaje)',
         fuente='BOM arb 06/10/2026 + BOM Barack V3 (espesor 2 mm). Sin plan de recepcion',
         filas=[
             ('Espesor', '', '2 mm (tolerancia TBD)', 'TBD', None),
             ('Ancho del rollo', '', '1 m (tolerancia TBD)', 'Cinta métrica MC403', None),
             LIMPIO,
         ]),
    dict(prod='Etiquetas ET-SATO-100X60 (térmica) y ET-SATO-50X20 (autoadhesiva)',
         fuente='BOM arb 06/10/2026. Sin plan de recepcion',
         filas=[
             ('Tipo y medida', '', '100 x 60 mm térmica / 50 x 20 mm autoadhesiva', 'Visual / etiqueta del producto', None),
         ]),
    # consignados de VW: AMFE 149 op 10, deteccion "Inspección visual 100% en recepcion"
    dict(prod='Logo airbag pasajero — 2HC.853.438 (consignado VW)',
         fuente='AMFE 149 op 10 (logo faltante o mal posicionado, D/TLD S9 O2; deteccion: inspeccion visual 100 % en recepcion) + BOM arb',
         filas=[
             ('Código del logo', '', '2HC.853.438', 'Visual contra remito', TODAS),
             ('Presencia del logo en el envío', 'D', 'Cantidad igual al remito', 'Conteo contra remito', TODAS),
             ('Aspecto', '', 'Sin rebaba, marcas, deformación ni bordes filosos', 'Visual contra patrón', TODAS),
         ]),
    dict(prod='Clip de retención — 2HC.867.190.A (consignado VW)',
         fuente='AMFE 149 op 10 (clips faltantes o incorrectos; deteccion: inspeccion visual 100 % en recepcion) + BOM Barack V3 (L1 12 / L2-L3 10)',
         filas=[('Código y cantidad', '', '2HC.867.190.A, igual al remito', 'Visual / conteo contra remito', TODAS)]),
    dict(prod='Tornillo — 2HC.075.701.HE (consignado VW)',
         fuente='AMFE 149 op 10 (tornillos incorrectos o faltantes; deteccion: inspeccion visual 100 % en recepcion) + BOM Barack V3 (5 por pieza)',
         filas=[('Código y cantidad', '', '2HC.075.701.HE, igual al remito', 'Visual / conteo contra remito', TODAS)]),
    dict(prod='Carcasa de difusor de aire (plate) — 2HC.819.728 (consignado VW)',
         fuente='AMFE 149 op 10 (plate dañado o incorrecto; deteccion: inspeccion visual 100 % en recepcion) + BOM Barack V3',
         filas=[('Código y estado', '', '2HC.819.728, sin golpes ni roturas', 'Visual', TODAS)]),
]
