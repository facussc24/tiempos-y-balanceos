"""Corrector 'cantos_convexos' (propuesta P6 del 23/10): lista las aristas CONVEXAS (las que sobresalen, donde marca la
pieza o la mano) con radio menor que el umbral. Por defecto el umbral es R1,5, el redondeo de la casa (ficha-utillajes.md
E5, citado en docs/PROPUESTAS_SKILL_3D_2026-10-23.md P6).

Sobre STEP, con build123d:
  - arista entre dos caras que no son tangentes: se prueba con dos puntos a los costados de la arista (medio +- e(n2-n1));
    si los dos quedan afuera del solido, la arista es convexa y su radio es 0 (canto vivo);
  - cara cilindrica, esferica o torica: si su centro de curvatura queda adentro del material es un redondeo convexo, y
    su radio (el chico en el toro) se compara con el umbral.
Uso: python cantos_convexos.py <archivo.step> [--umbral 1.5] [--zona xmin,ymin,zmin,xmax,ymax,zmax]
  --zona: solo cuenta lo que cae dentro de esa caja (la zona de la mano). Sin --zona, toda la pieza.
Imprime UNA linea JSON y sale con 0 (verde), 3 (rojo), 2 (error)."""
import argparse, json, math, sys


def salir(veredicto, detalle, medidas=None):
    print(json.dumps({'corrector': 'cantos_convexos', 'veredicto': veredicto, 'detalle': detalle,
                      'medidas': medidas or {}}, ensure_ascii=True), flush=True)
    sys.exit({'verde': 0, 'rojo': 3}.get(veredicto, 2))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('archivo')
    ap.add_argument('--umbral', type=float, default=1.5)
    ap.add_argument('--zona')
    a = ap.parse_args()
    if not a.archivo.lower().endswith(('.step', '.stp')):
        salir('error', 'este corrector trabaja sobre STEP (necesita las caras y aristas exactas)')
    from build123d import import_step, GeomType, Vector
    from OCP.BRepAdaptor import BRepAdaptor_Surface
    pieza = import_step(a.archivo)
    solidos = pieza.solids()
    if not solidos:
        salir('error', 'el STEP no trae solidos')
    zona = [float(x) for x in a.zona.split(',')] if a.zona else None

    def en_zona(p):
        return zona is None or all(zona[i] - 1e-6 <= p[i] <= zona[i + 3] + 1e-6 for i in range(3))

    def adentro(p):
        return any(s.is_inside(p) for s in solidos)

    caras_de = {}
    for f in pieza.faces():
        for e in f.edges():
            caras_de.setdefault(e, []).append(f)
    vivos, chicos, convexas = [], [], 0
    for e, fs in caras_de.items():
        if len(fs) != 2 or e.length < 1e-3:
            continue
        p = e.position_at(0.5)
        if not en_zona((p.X, p.Y, p.Z)):
            continue
        try:
            n1, n2 = fs[0].normal_at(p), fs[1].normal_at(p)
        except Exception:
            continue
        if n1.dot(n2) > math.cos(math.radians(10)):       # caras tangentes: borde de un redondeo, no es canto
            continue
        d = (n2 - n1)
        if d.length < 1e-9:
            continue
        d = d.normalized() * 0.05
        if not adentro(p + d) and not adentro(p - d):
            convexas += 1
            vivos.append({'punto': [round(p.X, 2), round(p.Y, 2), round(p.Z, 2)], 'largo': round(e.length, 2),
                          'radio': 0.0})
    for f in pieza.faces():
        t = f.geom_type
        if t not in (GeomType.CYLINDER, GeomType.SPHERE, GeomType.TORUS):
            continue
        s = BRepAdaptor_Surface(f.wrapped)
        if t == GeomType.CYLINDER:
            r = s.Cylinder().Radius()
        elif t == GeomType.SPHERE:
            r = s.Sphere().Radius()
        else:
            r = s.Torus().MinorRadius()
        p = f.position_at(0.5, 0.5)
        if not en_zona((p.X, p.Y, p.Z)):
            continue
        n = f.normal_at(p)
        if adentro(p - n * r * 0.99):                    # centro de curvatura en el material: redondeo convexo
            convexas += 1
            if r < a.umbral - 1e-3:
                chicos.append({'punto': [round(p.X, 2), round(p.Y, 2), round(p.Z, 2)], 'radio': round(r, 3),
                               'tipo': t.name.lower()})
    medidas = {'umbral_mm': a.umbral, 'zona': zona, 'convexas_revisadas': convexas, 'cantos_vivos': len(vivos),
               'radios_chicos': len(chicos), 'ejemplos': (vivos + chicos)[:6]}
    if vivos or chicos:
        rmin = min([0.0] * bool(vivos) + [c['radio'] for c in chicos])
        salir('rojo', f'{len(vivos)} cantos vivos (R0) y {len(chicos)} redondeos menores que R{a.umbral}; '
              f'el mas chico R{rmin}', medidas)
    salir('verde', f'{convexas} aristas o redondeos convexos, todos con R >= {a.umbral}', medidas)


if __name__ == '__main__':
    main()
