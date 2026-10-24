"""Corrector 'pose_rigida' (propuesta 2 del 23/10, protocolo de integracion de una pieza de afuera): juzga el ARCHIVO
exportado de una pieza ya colocada, no la matriz que se declaro (lo que el auditor del 20/10 encontro: la matriz era un
espejo, det -1, en las 7 piezas de la palanca; AUDITORIA_auditor.md hallazgo 1).

Toma <pieza.stl> (la colocada) y <pieza>__ref.stl (la misma pieza como vino, en su marco) de la misma carpeta y busca la
transformacion rigida que lleva una a la otra SIN correspondencias: arranca de los 8 juegos de signos de los ejes
principales de inercia y refina cada uno con Kabsch + vecino mas cercano (ICP), cuatro forzados a rotacion propia
(det +1) y cuatro a espejo (det -1). Se queda con el de menor residuo.
  - el mejor es un espejo y la rotacion propia deja un residuo grande  -> rojo (la pieza quedo reflejada);
  - el mejor es una rotacion propia con residuo <= --tol                -> verde;
  - nada calza (residuo > --tol en todos)                               -> rojo (no es la misma pieza o esta deformada);
  - propia y espejo calzan igual (pieza simetrica)                      -> verde con aviso: en esa pieza el espejo NO SE
    VE (el auditor midio que el mango y las bielas son simetricos); el control no la puede juzgar y lo dice.
Valor gemelo: las medidas traen el residuo de la mejor propia y el de la mejor espejo, siempre los dos.
Revisor Fable 24/10 (el primer corte solo juzgaba la quiralidad): (a) el residuo se mide en los DOS sentidos (de la
referencia a la colocada y de la colocada a la referencia: una pieza con un taco pegado ya no calza) y una diferencia de
volumen de mas de --tol-volumen (1 %) es otra pieza; (b) si al lado esta <pieza>__pose.json ({"M": 4x4}, la pose que
dice el papel), la transformacion encontrada tiene que llevar la pieza ADONDE dice el papel: el desvio maximo sobre los
puntos de la pieza no puede pasar de --tol-pose. Sin ese archivo la pose no se juzga y el detalle lo dice.

Tolerancias sin fuente de Barack (de banco, como TOL_VOL del juez): 0,05 mm de residuo, 0,05 mm de pose y 1 % de
volumen; lo que las sostiene es el valor gemelo medido en el tarea.yaml del ejercicio 22 (0,000 contra 0,88 a 383 mm).
Uso: python pose_rigida.py <pieza.stl> [--tol 0.05] [--tol-pose 0.05] [--tol-volumen 0.01] [--max-puntos 4000]
Imprime UNA linea JSON {"corrector", "veredicto", "detalle", "medidas"} y sale con 0 (verde), 3 (rojo), 2 (error)."""
import argparse
import json
import os
import sys


def salir(veredicto, detalle, medidas=None):
    print(json.dumps({'corrector': 'pose_rigida', 'veredicto': veredicto, 'detalle': detalle,
                      'medidas': medidas or {}}, ensure_ascii=True), flush=True)
    sys.exit({'verde': 0, 'rojo': 3}.get(veredicto, 2))


def kabsch(A, B, espejo):
    """R, t que minimizan |R a + t - b| con det(R) = -1 si espejo, +1 si no."""
    import numpy as np
    ca, cb = A.mean(0), B.mean(0)
    H = (A - ca).T @ (B - cb)
    U, _, Vt = np.linalg.svd(H)
    d = np.sign(np.linalg.det(Vt.T @ U.T)) or 1.0
    D = np.diag([1.0, 1.0, -d if espejo else d])
    R = Vt.T @ D @ U.T
    return R, cb - R @ ca


def ajustar(ref, col, arbol, R0, t0, espejo, iters=30):
    import numpy as np
    R, t = R0, t0
    res = None
    for _ in range(iters):
        X = ref @ R.T + t
        dist, idx = arbol.query(X)
        nuevo = float(np.sqrt(np.mean(dist ** 2)))
        R, t = kabsch(ref, col[idx], espejo)
        if res is not None and abs(res - nuevo) < 1e-9:
            res = nuevo
            break
        res = nuevo
    X = ref @ R.T + t
    dist, _ = arbol.query(X)
    return R, t, float(np.sqrt(np.mean(dist ** 2))), float(dist.max())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('archivo')
    ap.add_argument('--tol', type=float, default=0.05, help='residuo maximo (mm, raiz del cuadrado medio) para «calza»')
    ap.add_argument('--tol-pose', type=float, default=0.05, help='desvio maximo (mm) contra la pose del papel')
    ap.add_argument('--tol-volumen', type=float, default=0.01, help='diferencia relativa de volumen maxima')
    ap.add_argument('--max-puntos', type=int, default=4000)
    a = ap.parse_args()
    if not a.archivo.lower().endswith('.stl'):
        salir('error', 'este corrector trabaja sobre STL (la pieza colocada) y su <pieza>__ref.stl')
    ref_ruta = a.archivo[:-4] + '__ref.stl'
    if not os.path.exists(ref_ruta):
        salir('error', f'falta la pieza de referencia {os.path.basename(ref_ruta)} al lado de la colocada')
    import numpy as np
    import trimesh
    from scipy.spatial import cKDTree
    col_m, ref_m = trimesh.load(a.archivo, force='mesh'), trimesh.load(ref_ruta, force='mesh')
    if not (col_m.is_watertight and ref_m.is_watertight):
        salir('error', 'alguna de las dos mallas no cierra: sin volumen no hay ejes de inercia confiables')
    dv = abs(abs(col_m.volume) - abs(ref_m.volume)) / abs(ref_m.volume)
    rng = np.random.default_rng(7)
    ref = ref_m.vertices
    if len(ref) > a.max_puntos:
        ref = ref[rng.choice(len(ref), a.max_puntos, replace=False)]
    col = col_m.vertices
    arbol = cKDTree(col)
    Vr, Vc = ref_m.principal_inertia_vectors, col_m.principal_inertia_vectors   # filas = ejes
    cr, cc = ref_m.center_mass, col_m.center_mass
    mejores = {False: None, True: None}
    for sx in (1, -1):
        for sy in (1, -1):
            for sz in (1, -1):
                R0 = Vc.T @ np.diag([sx, sy, sz]) @ Vr
                espejo = np.linalg.det(R0) < 0
                R, t, rms, dmax = ajustar(ref, col, arbol, R0, cc - R0 @ cr, espejo)
                if mejores[espejo] is None or rms < mejores[espejo][2]:
                    mejores[espejo] = (R, t, rms, dmax)
    colv = col_m.vertices
    if len(colv) > a.max_puntos:
        colv = colv[rng.choice(len(colv), a.max_puntos, replace=False)]

    def vuelta(espejo):
        """residuo de la colocada contra la referencia ya transformada (el otro sentido)"""
        R, t = mejores[espejo][0], mejores[espejo][1]
        d, _ = cKDTree(ref_m.vertices @ R.T + t).query(colv)
        return float(np.sqrt(np.mean(d ** 2)))
    rp = max(mejores[False][2], vuelta(False))
    re_ = max(mejores[True][2], vuelta(True))
    med = {'residuo_rotacion_propia_mm': round(rp, 5), 'residuo_espejo_mm': round(re_, 5),
           'dist_max_propia_mm': round(mejores[False][3], 4), 'dif_volumen_rel': round(dv, 6), 'tol_mm': a.tol,
           'puntos': int(len(ref)), 'det_mejor': -1 if re_ < rp else 1}
    if dv > a.tol_volumen:
        salir('rojo', f'el volumen difiere {dv:.1%} de la pieza de referencia (> {a.tol_volumen:.0%}): no es la misma '
              'pieza', med)
    if re_ < rp and re_ <= a.tol and rp > a.tol:            # primero el diagnostico mas preciso: el espejo
        salir('rojo', f'la pieza quedo en ESPEJO (det -1): calza reflejada con {re_:.4f} mm y la mejor rotacion propia '
              f'deja {rp:.3f} mm', med)
    # la pose del papel se juzga para toda pieza, tambien la simetrica (auditor 24/10: el mango simetrico corrido 100 mm daba
    # verde porque la rama «simetrica» salia sin mirar la pose). Se compara la pieza puesta donde dice el papel contra
    # la colocada, punto contra punto: no depende de cual de las rotaciones de una pieza simetrica eligio el ajuste.
    pose_ruta = a.archivo[:-4] + '__pose.json'
    if os.path.exists(pose_ruta):
        try:
            with open(pose_ruta, encoding='utf-8') as f:
                Me = np.array(json.load(f)['M'], dtype=float)
            if Me.shape not in ((4, 4), (3, 4)):
                raise ValueError(f'forma {Me.shape}')
        except (ValueError, KeyError, TypeError, IndexError) as e:
            salir('error', f'{os.path.basename(pose_ruta)} mal armado ({e!r}); se espera {{"M": matriz 4x4}}', med)
        esperada = ref_m.vertices @ Me[:3, :3].T + Me[:3, 3]
        d1, _ = cKDTree(col_m.vertices).query(esperada)
        d2, _ = cKDTree(esperada).query(col_m.vertices)
        desvio = float(max(d1.max(), d2.max()))
        med['desvio_pose_mm'] = round(desvio, 4)
        med['tol_pose_mm'] = a.tol_pose
        if desvio > a.tol_pose:
            salir('rojo', f'la pieza NO quedo donde dice el papel: se corre hasta {desvio:.2f} mm (> {a.tol_pose} mm)',
                  med)
    if rp <= a.tol and re_ <= a.tol:
        salir('verde', f'la pieza es simetrica: rotacion propia y espejo calzan igual ({rp:.4f} / {re_:.4f} mm); '
              'en esta pieza el espejo NO SE VE y el control no lo puede juzgar'
              + ('; esta donde dice el papel' if 'desvio_pose_mm' in med else '; la POSE no se juzgo'), med)
    if rp > a.tol:
        salir('rojo', f'ninguna transformacion rigida calza (propia {rp:.3f} mm, espejo {re_:.3f} mm > {a.tol} mm): no '
              'es la misma pieza o quedo deformada', med)
    if 'desvio_pose_mm' not in med:
        salir('verde', f'rotacion propia (det +1), residuo {rp:.4f} mm (espejo: {re_:.3f} mm); la POSE no se juzgo '
              f'(no hay {os.path.basename(pose_ruta)})', med)
    salir('verde', f'rotacion propia (det +1) y en la pose del papel (desvio {med["desvio_pose_mm"]:.4f} mm); residuo '
          f'{rp:.4f} mm (espejo: {re_:.3f} mm)', med)


if __name__ == '__main__':
    main()
