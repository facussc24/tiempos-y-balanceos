# -*- coding: utf-8 -*-
"""cadlib — nucleo compartido del skill cad-design (gmsh OCC + trimesh + matplotlib).

Modulos: geom (medir/mallar/colision/ICP), topo (inspeccion topologica SIN mallar:
encontrar y medir grabados/features finos), render (vistas + secciones),
workdir (manifest.json por pieza), envcheck (interprete correcto),
pipeline (cadenas de scripts que no pueden fallar en silencio: una salida de una
corrida abortada no se puede volver a usar, y un rechazo tiene que nombrar su filtro).

Antes de mallar para BUSCAR algo, probar `topo`: mallar una pieza de cliente cuesta
minutos, leer su topologia cuesta segundos.
Interprete canonico: C:\\Dev\\BarackMercosul\\.venv-cad\\Scripts\\python.exe
"""
