# -*- coding: utf-8 -*-
"""sv_modelo.py — abre UN STEP una sola vez y deja en cache todo lo que hace falta para medir.

Por que existe (01/10/2026, superficie de vinilo del Top Roll Patagonia): cargar un STEP de
45-66 MB tarda 1 a 2,5 minutos, y la primera vuelta lo cargo tres veces (inventario, malla,
adyacencia). `analyze_step.py --solids-only` sobre cinco archivos no termino en 10 minutos.
Este script carga una vez y guarda:

  - por CARA: area EXACTA (BRepGProp, no malla), tipo, a que solido pertenece (0 = suelta)
    y a que shell;
  - por SOLIDO: volumen y caja medida sobre la geometria recortada;
  - adyacencia cara-cara con el ANGULO entre normales sobre la arista compartida
    (0 = tangentes, 90 = canto vivo): sirve para separar la cara vista del sustrato;
  - malla por cara (triangulos con el indice de su cara), ya en los ejes pedidos.

Uso (con el Python de CAD):
  .venv-cad\\Scripts\\python.exe sv_modelo.py <pieza.step> <modelo.npz> [--ejes x,-z,y] [--defl 0.15] [--forzar]

--ejes: los STEP exportados de Onshape vienen con Y hacia arriba. "x,-z,y" los vuelve a ejes
de carroceria (X largo, Y hacia la cabina, Z arriba). Sin --ejes no se toca nada. Como saber si
hace falta: en el resumen, la caja del sustrato tiene que salir con el largo en X y el alto en Z.
Si el primer eje lleva signo menos se escribe con igual: --ejes=-x,z,y.

El cache lleva la FIRMA del archivo (tamaño + fecha + deflexion + ejes): si el STEP cambia,
se recalcula solo. Un cache sin firma miente (cad-3d.md, GATE 3).
"""
import argparse
import json
import os
import sys
import time

import numpy as np


def parse_ejes(txt):
    """'x,-z,y' -> matriz 3x3 M con  p_nuevo = M @ p_archivo."""
    if not txt:
        return np.eye(3)
    idx = {'x': 0, 'y': 1, 'z': 2}
    M = np.zeros((3, 3))
    partes = [t.strip().lower() for t in txt.split(',')]
    if len(partes) != 3:
        raise SystemExit('--ejes lleva tres ejes, por ejemplo x,-z,y')
    for i, t in enumerate(partes):
        s = -1.0 if t.startswith('-') else 1.0
        t = t.lstrip('+-')
        if t not in idx:
            raise SystemExit('eje desconocido en --ejes: %r' % t)
        M[i, idx[t]] = s
    if abs(abs(np.linalg.det(M)) - 1.0) > 1e-9:
        raise SystemExit('--ejes repite un eje: %r' % txt)
    return M


VERSION = 2      # subir cuando cambia lo que este script calcula: un cache hecho con el codigo viejo no se da por vigente


def firma_de(path, defl, ejes):
    st = os.stat(path)
    return 'v%d:%d:%d:%s:%s' % (VERSION, st.st_size, int(st.st_mtime), defl, ejes or '')


def memoria_libre_gb():
    """GB de memoria fisica libre (Windows). None si no se puede leer."""
    try:
        import ctypes

        class M(ctypes.Structure):
            _fields_ = [('largo', ctypes.c_ulong), ('carga', ctypes.c_ulong)] + [
                (n, ctypes.c_ulonglong) for n in ('total', 'libre', 'tp', 'lp', 'tv', 'lv', 'ext')]
        m = M(); m.largo = ctypes.sizeof(M)
        ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(m))
        return m.libre / 2.0 ** 30
    except Exception:
        return None


def main():
    ap = argparse.ArgumentParser(description='STEP -> cache de medicion (areas exactas, adyacencia, malla)')
    ap.add_argument('step'); ap.add_argument('out')
    ap.add_argument('--ejes', default='')
    ap.add_argument('--defl', type=float, default=0.15, help='flecha de la malla en mm')
    ap.add_argument('--forzar', action='store_true')
    a = ap.parse_args()

    firma = firma_de(a.step, a.defl, a.ejes)
    if os.path.exists(a.out) and not a.forzar:
        try:
            if str(np.load(a.out, allow_pickle=False)['firma']) == firma:
                print('cache vigente (misma firma): %s' % a.out)
                return 0
        except Exception:
            pass
    M = parse_ejes(a.ejes)
    libre = memoria_libre_gb(); peso = os.path.getsize(a.step) / 2.0 ** 20
    if libre is not None:
        print('memoria libre: %.1f GB (archivo de %.0f MB)' % (libre, peso), flush=True)
        if peso > 20 and libre < 2.0 and not a.forzar:
            raise SystemExit('hay %.1f GB libres y un STEP de este tamaño pide 2 a 3 GB: esperar a que termine lo que este '
                             'corriendo (o --forzar a sabiendas).' % libre)

    from OCP.STEPControl import STEPControl_Reader
    from OCP.IFSelect import IFSelect_RetDone
    from OCP.TopExp import TopExp_Explorer, TopExp
    from OCP.TopAbs import TopAbs_SOLID, TopAbs_SHELL, TopAbs_FACE, TopAbs_EDGE, TopAbs_REVERSED
    from OCP.TopoDS import TopoDS
    from OCP.TopTools import TopTools_IndexedMapOfShape, TopTools_IndexedDataMapOfShapeListOfShape
    from OCP.GProp import GProp_GProps
    from OCP.BRepGProp import BRepGProp
    from OCP.BRep import BRep_Tool
    from OCP.BRepAdaptor import BRepAdaptor_Surface
    from OCP.BRepLProp import BRepLProp_SLProps
    from OCP.BRepMesh import BRepMesh_IncrementalMesh
    from OCP.TopLoc import TopLoc_Location
    from OCP.Bnd import Bnd_Box
    from OCP.BRepBndLib import BRepBndLib
    from OCP.GeomAbs import (GeomAbs_Plane, GeomAbs_Cylinder, GeomAbs_Cone, GeomAbs_Sphere,
                             GeomAbs_Torus, GeomAbs_BSplineSurface)
    TIPOS = {GeomAbs_Plane: 'Plano', GeomAbs_Cylinder: 'Cilindro', GeomAbs_Cone: 'Cono',
             GeomAbs_Sphere: 'Esfera', GeomAbs_Torus: 'Toro', GeomAbs_BSplineSurface: 'BSpline'}

    t0 = time.time()

    def paso(txt):
        print('[%5.0f s] %s' % (time.time() - t0, txt), flush=True)

    r = STEPControl_Reader()
    if r.ReadFile(a.step) != IFSelect_RetDone:
        raise SystemExit('no se pudo leer ' + a.step)
    r.TransferRoots()
    shape = r.OneShape()
    paso('STEP leido')

    fmap = TopTools_IndexedMapOfShape()
    TopExp.MapShapes_s(shape, TopAbs_FACE, fmap)
    nF = fmap.Extent()
    caras = [None] + [TopoDS.Face_s(fmap.FindKey(i)) for i in range(1, nF + 1)]
    adapt = [None] + [BRepAdaptor_Surface(caras[i], True) for i in range(1, nF + 1)]

    solid_of = np.zeros(nF + 1, dtype=np.int32)
    shell_of = np.zeros(nF + 1, dtype=np.int32)
    sol_vol = []; sol_bbox = []
    ex = TopExp_Explorer(shape, TopAbs_SOLID); si = 0
    while ex.More():
        si += 1
        s = ex.Current()
        g = GProp_GProps(); BRepGProp.VolumeProperties_s(s, g)
        b = Bnd_Box(); BRepBndLib.AddOptimal_s(s, b, False, False)   # caja de la geometria RECORTADA
        x0, y0, z0, x1, y1, z1 = b.Get()
        esquinas = np.array([[x, y, z] for x in (x0, x1) for y in (y0, y1) for z in (z0, z1)]) @ M.T
        sol_vol.append(g.Mass() / 1000.0)
        sol_bbox.append(np.concatenate([esquinas.min(0), esquinas.max(0)]))
        fe = TopExp_Explorer(s, TopAbs_FACE)
        while fe.More():
            solid_of[fmap.FindIndex(fe.Current())] = si
            fe.Next()
        ex.Next()
    ex = TopExp_Explorer(shape, TopAbs_SHELL); shi = 0
    while ex.More():
        shi += 1
        fe = TopExp_Explorer(ex.Current(), TopAbs_FACE)
        while fe.More():
            shell_of[fmap.FindIndex(fe.Current())] = shi
            fe.Next()
        ex.Next()
    paso('%d caras, %d solidos, %d shells' % (nF, si, shi))

    area = np.zeros(nF + 1); tipo = [''] * (nF + 1)
    for i in range(1, nF + 1):
        g = GProp_GProps(); BRepGProp.SurfaceProperties_s(caras[i], g)
        area[i] = g.Mass()
        tipo[i] = TIPOS.get(adapt[i].GetType(), 'Otro')
    paso('areas exactas por cara')

    def normal_en(i, u, v):
        pr = BRepLProp_SLProps(adapt[i], u, v, 1, 1e-6)
        if not pr.IsNormalDefined():
            return None
        n = pr.Normal()
        w = np.array((n.X(), n.Y(), n.Z()))
        return -w if caras[i].Orientation() == TopAbs_REVERSED else w

    emap = TopTools_IndexedDataMapOfShapeListOfShape()
    TopExp.MapShapesAndAncestors_s(shape, TopAbs_EDGE, TopAbs_FACE, emap)
    pares = []; sin_angulo = 0
    for k in range(1, emap.Extent() + 1):
        e = TopoDS.Edge_s(emap.FindKey(k))
        fs = []
        for sh in emap.FindFromIndex(k):
            idx = fmap.FindIndex(sh)
            if idx not in fs:
                fs.append(idx)
        if len(fs) != 2:
            continue
        f1, f2 = fs
        angs = []
        try:
            pc1 = BRep_Tool.CurveOnSurface_s(e, caras[f1], 0.0, 0.0)
            pc2 = BRep_Tool.CurveOnSurface_s(e, caras[f2], 0.0, 0.0)
            a1, b1 = BRep_Tool.Range_s(e, caras[f1])
            a2, b2 = BRep_Tool.Range_s(e, caras[f2])
            if pc1 is not None and pc2 is not None:
                for s in (0.1, 0.3, 0.5, 0.7, 0.9):
                    p1 = pc1.Value(a1 + s * (b1 - a1)); p2 = pc2.Value(a2 + s * (b2 - a2))
                    n1 = normal_en(f1, p1.X(), p1.Y()); n2 = normal_en(f2, p2.X(), p2.Y())
                    if n1 is not None and n2 is not None:
                        angs.append(np.degrees(np.arccos(np.clip(n1 @ n2, -1, 1))))
        except Exception:
            pass
        if not angs:
            sin_angulo += 1
        pares.append((f1, f2, max(angs) if angs else -1.0))
    pares = np.array(pares, float) if pares else np.zeros((0, 3))
    paso('%d aristas compartidas (%d sin angulo)' % (len(pares), sin_angulo))

    BRepMesh_IncrementalMesh(shape, a.defl, False, 0.35, True)
    V = []; T = []; FID = []; off = 0; sin_malla = 0
    for i in range(1, nF + 1):
        loc = TopLoc_Location()
        tri = BRep_Tool.Triangulation_s(caras[i], loc)
        if tri is None:
            sin_malla += 1
            continue
        tr = loc.Transformation()
        nn = tri.NbNodes()
        pts = np.empty((nn, 3))
        for j in range(1, nn + 1):
            p = tri.Node(j).Transformed(tr)
            pts[j - 1] = (p.X(), p.Y(), p.Z())
        nt = tri.NbTriangles()
        tt = np.empty((nt, 3), np.int64)
        for j in range(1, nt + 1):
            x, y, z = tri.Triangle(j).Get()
            tt[j - 1] = (x - 1, y - 1, z - 1)
        if caras[i].Orientation() == TopAbs_REVERSED:
            tt = tt[:, ::-1]
        V.append(pts); T.append(tt + off); FID.append(np.full(nt, i, np.int32)); off += nn
    V = np.concatenate(V) @ M.T
    T = np.concatenate(T); FID = np.concatenate(FID)
    if np.linalg.det(M) < 0:        # un espejo invierte el sentido de los triangulos
        T = T[:, ::-1].copy()
    tri = V[T]
    at = 0.5 * np.linalg.norm(np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0]), axis=1)
    area_malla_por_cara = np.bincount(FID, weights=at, minlength=nF + 1)
    paso('malla: %d triangulos (%d caras sin malla)' % (len(T), sin_malla))

    # control: la malla tiene que dar casi lo mismo que el area exacta; si no, la malla esta rota
    dif = 100.0 * (at.sum() - area[1:].sum()) / max(area[1:].sum(), 1e-9)
    if abs(dif) > 1.0:
        print('ATENCION: la malla difiere %.2f %% del area exacta. Bajar --defl o revisar el STEP.' % dif)

    np.savez(a.out, firma=np.array(firma), ejes=np.array(a.ejes), area=area, tipo=np.array(tipo),
             solid_of=solid_of, shell_of=shell_of, sol_vol=np.array(sol_vol), sol_bbox=np.array(sol_bbox).reshape(-1, 6),
             pares=pares, V=V, T=T, FID=FID, area_malla_por_cara=area_malla_por_cara)

    resumen = dict(archivo=os.path.abspath(a.step), firma=firma, caras=nF, solidos=[], pieles_sueltas=[],
                   malla_vs_exacta_pct=round(dif, 3), segundos=round(time.time() - t0, 1))
    print('\nARCHIVO %s' % a.step)
    for k in range(si):
        m = solid_of == k + 1
        bb = sol_bbox[k]; d = bb[3:] - bb[:3]
        resumen['solidos'].append(dict(n=k + 1, vol_cm3=round(sol_vol[k], 2), caja_mm=[round(float(x), 1) for x in d],
                                       caras=int(m.sum()), area_cm2=round(float(area[m].sum()) / 100, 1)))
        print('  SOLIDO %d: %.1f cm3 | caja %.1f x %.1f x %.1f mm | %d caras | %.1f cm2'
              % (k + 1, sol_vol[k], d[0], d[1], d[2], int(m.sum()), area[m].sum() / 100))
    libres = (solid_of == 0); libres[0] = False
    for sh in sorted(set(shell_of[libres].tolist())):
        m = libres & (shell_of == sh)
        pts = V[T[np.isin(FID, np.where(m)[0])]].reshape(-1, 3)
        d = pts.max(0) - pts.min(0) if len(pts) else np.zeros(3)
        resumen['pieles_sueltas'].append(dict(shell=int(sh), caras=int(m.sum()), area_cm2=round(float(area[m].sum()) / 100, 2),
                                              caja_mm=[round(float(x), 1) for x in d]))
        print('  PIEL SUELTA (shell %d): %d caras | AREA EXACTA %.2f cm2 | caja %.1f x %.1f x %.1f mm'
              % (sh, int(m.sum()), area[m].sum() / 100, d[0], d[1], d[2]))
    if not resumen['pieles_sueltas']:
        print('  (sin superficies sueltas: este STEP trae solo solidos)')
    with open(os.path.splitext(a.out)[0] + '.json', 'w', encoding='utf-8') as fh:
        json.dump(resumen, fh, indent=1, ensure_ascii=False)
    paso('listo -> %s' % a.out)
    return 0


if __name__ == '__main__':
    sys.exit(main())
