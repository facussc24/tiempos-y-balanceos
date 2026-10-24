"""Corrector 'chaflan_cama' (propuesta 2 del 23/10; regla ficha-fdm.md G6: «Cara de abajo (la que toca la cama):
chaflan, no filete», 45 grados, Prusa KB y Hubs, ABIERTA). Juzga la cara de CAMA de un STEP: la cara plana mas baja con
la normal hacia -Z (o la que se pase con --cama-z). Cada arista del contorno de esa cara se mira por la OTRA cara que
toca:
  - plano a 45 grados de la cama, o cono de semiangulo 45 grados (el chaflan alrededor de una esquina redondeada), con
    la normal de afuera hacia ABAJO -> ok; con la normal hacia arriba es un «faldon» (filo agudo contra la cama) -> no;
  - cilindro, toro o esfera tangente a la cama -> «filete» (lo que G6 prohibe);
  - plano vertical (90 grados) -> «vivo»; cualquier otro angulo -> «otro angulo».
Verde si TODO el contorno de la cama es chaflan a 45 grados (+- --tol-grados). El TAMANO del chaflan no se juzga (esta A
DECIDIR en lenguaje_diseno.json): se informa la altura medida.
La tolerancia de 2 grados no tiene fuente de Barack (de banco); el gemelo medido: 45 grados verde, 30 grados rojo.
Uso: python chaflan_cama.py <archivo.step> [--tol-grados 2] [--cama-z <z>]
Imprime UNA linea JSON y sale con 0 (verde), 3 (rojo), 2 (error)."""
import argparse
import json
import math
import sys


def salir(veredicto, detalle, medidas=None):
    print(json.dumps({'corrector': 'chaflan_cama', 'veredicto': veredicto, 'detalle': detalle,
                      'medidas': medidas or {}}, ensure_ascii=True), flush=True)
    sys.exit({'verde': 0, 'rojo': 3}.get(veredicto, 2))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('archivo')
    ap.add_argument('--tol-grados', type=float, default=2.0)
    ap.add_argument('--cama-z', type=float)
    a = ap.parse_args()
    if not a.archivo.lower().endswith(('.step', '.stp')):
        salir('error', 'este corrector trabaja sobre STEP (caras y aristas exactas)')
    from build123d import GeomType, import_step
    from OCP.BRepAdaptor import BRepAdaptor_Surface
    pieza = import_step(a.archivo)
    if not pieza.solids():
        salir('error', 'el STEP no trae solidos')
    zmin = pieza.bounding_box().min.Z if a.cama_z is None else a.cama_z
    camas = []
    for f in pieza.faces():
        if f.geom_type != GeomType.PLANE:
            continue
        c = f.center()
        n = f.normal_at(c)
        if n.Z < -0.999 and abs(c.Z - zmin) < 1e-3:
            camas.append(f)
    if not camas:
        salir('error', f'no hay cara plana con la normal hacia -Z en z {zmin:.3f}: ¿la pieza esta apoyada en la cama?')
    vecinas = {}
    for f in pieza.faces():
        for e in f.edges():
            vecinas.setdefault(e, []).append(f)
    clases = {'chaflan_45': 0, 'filete': 0, 'vivo': 0, 'faldon': 0, 'otro_angulo': 0}
    alturas, ejemplos = [], []
    for cama in camas:
        for e in cama.edges():
            otras = [f for f in vecinas.get(e, []) if not f.is_same(cama)]
            if not otras:
                continue
            g = otras[0]
            p = e.position_at(0.5)
            t = g.geom_type
            # la normal de afuera de un chaflan de cama mira hacia ABAJO (nz -0,707); un «faldon» (la seccion crece hacia
            # la cama, filo agudo de 45 grados) mira hacia arriba (+0,707): revisor Fable 24/10, se colaba con abs(nz)
            if t == GeomType.PLANE:
                nz = g.normal_at(p).Z
                ang = math.degrees(math.acos(max(-1.0, min(1.0, abs(nz)))))      # 0 = horizontal, 90 = vertical
                if abs(ang - 45.0) <= a.tol_grados:
                    clase = 'chaflan_45' if nz < 0 else 'faldon'
                elif ang > 90.0 - a.tol_grados:
                    clase = 'vivo'
                else:
                    clase = 'otro_angulo'
            elif t == GeomType.CONE:
                cono = BRepAdaptor_Surface(g.wrapped).Cone()
                semi = math.degrees(abs(cono.SemiAngle()))
                if abs(cono.Axis().Direction().Z()) < 0.999:        # revisor 24/10: un cono de eje horizontal no es
                    clase = 'otro_angulo'                           # el chaflan de una esquina de la cama
                elif abs(semi - 45.0) > a.tol_grados:
                    clase = 'otro_angulo'
                else:
                    clase = 'chaflan_45' if g.normal_at(p).Z < 0 else 'faldon'
            elif t in (GeomType.CYLINDER, GeomType.TORUS, GeomType.SPHERE):
                eje_vertical = t == GeomType.CYLINDER and abs(BRepAdaptor_Surface(g.wrapped).Cylinder().Axis()
                                                              .Direction().Z()) > 0.999
                clase = 'vivo' if eje_vertical else 'filete'       # cilindro vertical = pared de un agujero o esquina
            else:
                clase = 'otro_angulo'
            clases[clase] += 1
            if clase == 'chaflan_45':
                alturas.append(g.bounding_box().max.Z - zmin)
            elif len(ejemplos) < 6:
                ejemplos.append({'clase': clase, 'punto': [round(p.X, 2), round(p.Y, 2), round(p.Z, 2)],
                                 'cara': str(t).split('.')[-1]})
    total = sum(clases.values())
    med = {'aristas_contorno_cama': total, **clases, 'cama_z': round(zmin, 4), 'tol_grados': a.tol_grados,
           'altura_chaflan_mm': [round(min(alturas), 3), round(max(alturas), 3)] if alturas else None,
           'ejemplos': ejemplos, 'regla': 'ficha-fdm.md G6: chaflan a 45 grados, no filete (Prusa KB y Hubs, ABIERTA)'}
    if total == 0:
        salir('error', 'la cara de cama no tiene aristas que juzgar', med)
    if clases['chaflan_45'] == total:
        salir('verde', f'las {total} aristas del contorno de la cama tienen chaflan a 45 grados '
              f'(altura {med["altura_chaflan_mm"]} mm; el tamano esta A DECIDIR y no se juzga)', med)
    malos = {k: v for k, v in clases.items() if k != 'chaflan_45' and v}
    salir('rojo', f'contorno de la cama: {clases["chaflan_45"]} de {total} con chaflan a 45 grados; el resto '
          + ', '.join(f'{v} {k}' for k, v in malos.items()) + ' (G6: chaflan, no filete ni canto vivo)', med)


if __name__ == '__main__':
    main()
