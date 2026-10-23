"""Comun del ejercicio 07: copia el tornillo de 30 VIGENTE (STL y STEP reales) y arma los mutantes a partir de su STEP.
Medidas del tornillo que se usan para armar los mutantes, todas de un papel:
  - eje a lo largo de X; cabeza de x 0 a 4,0 (head_th 4.0) con rebaje de 7,6 x 1,2 (head_relief 7.6, depth 1.2): el
    piso del rebaje queda en x 2,8 (medido en el STL: la cabeza termina en 2,80);
  - vastago liso 5,45 (shank_dia 5.45) y radio 0,9 bajo la cabeza (fillet 0.9);
  fuente: 5. 3D/Tornillo 7mm impreso - costura CNC insert (prueba 14-10)/FUENTE (STEP para modificar)/medidas holgura 0,50.json"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from _comun import copiar, carpeta_salida, salir_error  # noqa: E402

T7 = 'Tornillo 7mm impreso - costura CNC insert (prueba 14-10)'
VIGENTE_STL = (f'{T7}/TORNILLO LARGO 30 - VIGENTE (20-10)/TORNILLO 7mm acostado holgura 0,50 - largo 30.stl',
               'cff65d45d0d9390f5f23a2f118cc73e430d679377b53c4b9acf811465fa1e9cf')
VIGENTE_STEP = (f'{T7}/TORNILLO LARGO 30 - VIGENTE (20-10)/TORNILLO 7mm acostado holgura 0,50 - largo 30.step',
                'e91ee7997ca80c0af75f3e0190c6b9580f7311da2bc2faec28c4abbaa44e54f6')
PISO_REBAJE_X, R_REBAJE, R_VASTAGO, R_ACUERDO = 2.8, 7.6 / 2, 5.45 / 2, 0.9


def tornillo_vigente(carpeta_tmp):
    """Importa el STEP vigente (verificado por sha256) y devuelve (pieza, centro_y, centro_z del eje)."""
    from build123d import import_step, Box, Location
    ruta = copiar(*VIGENTE_STEP, carpeta_tmp, 'fuente__vigente.step')
    pieza = import_step(ruta)

    corte = pieza & Box(0.2, 40, 40).moved(Location((5.0, 0, 0)))      # un corte del vastago liso
    bb = corte.bounding_box()
    return pieza, (bb.min.Y + bb.max.Y) / 2, (bb.min.Z + bb.max.Z) / 2


def exportar(pieza, carpeta, nombre):
    from build123d import export_stl, export_step
    if not pieza.is_valid:
        salir_error('la pieza armada no es valida')
    export_stl(pieza, os.path.join(carpeta, nombre + '.stl'))
    export_step(pieza, os.path.join(carpeta, nombre + '.step'))
    print('ok', round(pieza.volume, 1))
