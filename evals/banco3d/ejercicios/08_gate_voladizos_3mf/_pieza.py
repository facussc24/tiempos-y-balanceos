"""Comun del ejercicio 08: exporta un solido de build123d como .stl, .step y .3mf (el 3MF armado a mano con zipfile +
XML desde el STL, como lo lee el gate: sin lxml). El .3mf es la entrada del corrector gate_voladizos (laminar_bambu.py
--solo-voladizos), el .stl la del corrector voladizos."""
import os, sys, zipfile
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from _comun import carpeta_salida, salir_error  # noqa: E402


def exportar(solido, nombre):
    from build123d import export_step, export_stl
    import trimesh
    out = carpeta_salida()
    if not solido.is_valid:
        salir_error(f'{nombre}: el solido no es valido')
    stl = os.path.join(out, nombre + '.stl')
    export_stl(solido, stl)
    export_step(solido, os.path.join(out, nombre + '.step'))
    m = trimesh.load(stl, force='mesh')
    vs = ''.join(f'<vertex x="{x:.4f}" y="{y:.4f}" z="{z:.4f}"/>' for x, y, z in m.vertices)
    ts = ''.join(f'<triangle v1="{a}" v2="{b}" v3="{c}"/>' for a, b, c in m.faces)
    modelo = ('<?xml version="1.0" encoding="UTF-8"?><model unit="millimeter" '
              'xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"><resources>'
              f'<object id="1" name="{nombre}" type="model"><mesh><vertices>{vs}</vertices><triangles>{ts}</triangles>'
              '</mesh></object></resources><build><item objectid="1"/></build></model>')
    with zipfile.ZipFile(os.path.join(out, nombre + '.3mf'), 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.'
                   'openxmlformats.org/package/2006/content-types"><Default Extension="model" ContentType="application/'
                   'vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>')
        z.writestr('_rels/.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.'
                   'openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" '
                   'Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>')
        z.writestr('3D/3dmodel.model', modelo)
    print('ok', round(solido.volume, 1))
