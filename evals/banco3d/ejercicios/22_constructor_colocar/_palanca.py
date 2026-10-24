"""Comun del ejercicio 22: dos piezas ASIMETRICAS de la palanca de MakerWorld del virolador del 20/10 (brazo_A en la BIEN
y el MAL 1, base_A en el MAL 2;
el auditor midio que mango y bielas son simetricas y en ellas el espejo no se ve) colocadas en su pose real del estado
cerrado (poses_20_10.json, sacadas de estados.json).
  colocar_con_biblioteca(pieza, nombre): cadlib.constructores.colocar(malla, M), que se niega ante un espejo.
  colocar_en_espejo(pieza, nombre): el armado del 20/10 antes del arreglo, a mano: el reparto de ejes «u -> -Y, v -> Z,
      ancho -> X» (AUDITORIA_auditor.md hallazgo 1, palanca_pose.py l.108) es zurdo: la fila de X cambia de signo
      (misma franja de X que la buena, la pieza reflejada).
Las STL son de MakerWorld (Alesh) y NO estan en el repo (repo publico): se leen de la carpeta del 20/10 con su sha256
(data/catalogo_casa.json, ficha palanca_traba_makerworld). Otra carpeta: variable BANCO3D_PALANCA. Si no esta o cambio,
la pieza no se arma y sale con 2 (como _comun.copiar).
Escribe <carpeta>/<nombre>.stl (la colocada), <nombre>__ref.stl (la pieza como vino) y <nombre>__pose.json (la pose
que dice el papel), que juzga pose_rigida.py."""
import json
import os
import shutil
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(AQUI))
sys.path.insert(0, os.path.normpath(os.path.join(AQUI, '..', '..', '..', '..', '.claude', 'skills', 'cad-design', 'scripts')))
from _comun import carpeta_salida, salir_error, sha256  # noqa: E402

FUENTE = os.environ.get('BANCO3D_PALANCA', r'C:\Dev\_catia_practica\virolador_auto\palanca_makerworld')
STL = {
    'base_A': ('stl/obj_8_P0064829.STL_A.stl', '8b31936a31bf606d420e529fd32d180601d720b9b11328f74bc000f943375eb1'),
    'brazo_A': ('stl/obj_2_P0064832.STL_A.stl', '0dc67f90ade7fd30dc8380bcdb8d5675cbc1c9e03b529961af7432102dde8d90'),
}


def _malla(pieza):
    import trimesh
    rel, sha = STL[pieza]
    ruta = os.path.join(FUENTE, *rel.split('/'))
    if not os.path.exists(ruta):
        salir_error(f'no esta la fuente {ruta} (palanca de MakerWorld, carpeta del 20/10; BANCO3D_PALANCA para otra)')
    h = sha256(ruta)
    if h != sha:
        salir_error(f'la fuente cambio (sha256 {h}, se esperaba {sha}): {ruta}')
    return ruta, trimesh.load(ruta, force='mesh')


def _pose(pieza):
    with open(os.path.join(AQUI, 'poses_20_10.json'), encoding='utf-8') as f:
        return json.load(f)['matrices'][pieza]


def _escribir(colocada, ruta_ref, nombre, pieza):
    """La colocada, la referencia y la pose que dice el PAPEL (estados.json del 20/10), que juzga pose_rigida.py."""
    out = carpeta_salida()
    colocada.export(os.path.join(out, nombre + '.stl'))
    shutil.copyfile(ruta_ref, os.path.join(out, nombre + '__ref.stl'))
    with open(os.path.join(out, nombre + '__pose.json'), 'w', encoding='utf-8') as f:
        json.dump({'pieza': pieza, 'fuente': 'poses_20_10.json (estados.json del 20/10, estado cerrado)',
                   'M': _pose(pieza)}, f)
    print('ok', round(float(colocada.volume), 3))


def colocar_con_biblioteca(pieza, nombre):
    from cadlib import constructores as k
    ruta, m = _malla(pieza)
    _escribir(k.colocar(m, _pose(pieza)), ruta, nombre, pieza)


def _matriz_espejo(m, pieza):
    import numpy as np
    M = np.array(_pose(pieza), dtype=float)
    z0, z1 = m.bounds[0][2], m.bounds[1][2]
    s = M[0, 2]
    M[0, 2], M[0, 3] = -s, M[0, 3] + s * (z0 + z1)           # X = tx + s*z  ->  X = tx + s*(z0+z1) - s*z
    if np.linalg.det(M[:3, :3]) > 0:
        salir_error('el mutante no quedo en espejo: revisar la pose')
    return M


def colocar_en_espejo(pieza, nombre):
    import numpy as np
    ruta, m = _malla(pieza)
    M = _matriz_espejo(m, pieza)
    out = m.copy()
    out.vertices = (np.c_[m.vertices, np.ones(len(m.vertices))] @ M.T)[:, :3]
    out.invert()                                                # el espejo da vuelta las caras: se acomodan
    _escribir(out, ruta, nombre, pieza)


def colocar_como_lo_exporta_un_step(pieza, nombre):
    """La consecuencia que midio el auditor (hallazgo 1): un STEP no guarda una matriz zurda; guarda X y Z y rehace
    Y = Z x X, asi que la pieza sale como una ROTACION propia (det +1) pero corrida de lugar (en el conjunto del 20/10,
    entre 140 y 370 mm). Se arma igual desde la matriz espejo de colocar_en_espejo()."""
    import numpy as np
    ruta, m = _malla(pieza)
    Mz = _matriz_espejo(m, pieza)
    X, Z = Mz[:3, 0], Mz[:3, 2]
    M = np.eye(4)
    M[:3, 0], M[:3, 1], M[:3, 2], M[:3, 3] = X, np.cross(Z, X), Z, Mz[:3, 3]
    if np.linalg.det(M[:3, :3]) < 0.999:
        salir_error('la matriz rehecha como en un STEP no es una rotacion propia')
    out = m.copy()
    out.apply_transform(M)
    _escribir(out, ruta, nombre, pieza)
