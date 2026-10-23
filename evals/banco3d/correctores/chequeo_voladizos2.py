"""Control de lo que queda EN EL AIRE, capa por capa (22/10, Fak: «no verificaste antes de mandar que tuvieran los
soportes?»). En cada capa de 0,2: zona nueva = corte de esta capa menos corte de la de abajo. En cada zona se tiran
lineas paralelas (como los hilos de un puente) en 12 direcciones y se elige la mejor:
  - tramo con las DOS puntas apoyadas = puente: OK hasta LUZ_PUENTE de largo;
  - tramo con UNA punta suelta = voladizo: OK hasta VOLADIZO de largo;
  - tramo con las dos puntas sueltas = en el aire: siempre mal.
Asi un techo con un agujero en el medio da voladizo (los hilos terminan en el agujero), que es lo que fallo el 22/10.
Uso: python chequeo_voladizos2.py <stl>[|V] ...   (|V = se imprime dado vuelta)"""
import sys, math, numpy as np, trimesh
from shapely.geometry import Polygon, LineString, Point
from shapely.ops import unary_union

CAPA, LUZ_PUENTE, VOLADIZO = 0.2, 12.0, 2.0
DADA_VUELTA = trimesh.transformations.rotation_matrix(np.pi, (1, 0, 0))


def corte(m, z):
    s = m.section(plane_origin=[0, 0, z], plane_normal=[0, 0, 1])
    if s is None:
        return Polygon()
    pl, _ = s.to_2D(to_2D=np.eye(4))
    try:
        return unary_union(pl.polygons_full).buffer(0)
    except Exception:
        return Polygon()


def peor_en_direccion(r, apoyo, ang):
    """(peor voladizo, peor puente, hay tramo en el aire) con hilos a 'ang' grados."""
    u = np.array([math.cos(ang), math.sin(ang)]); n = np.array([-u[1], u[0]])
    c = np.array(r.centroid.coords[0]); L = 2 * math.hypot(r.bounds[2] - r.bounds[0], r.bounds[3] - r.bounds[1]) + 2
    vol, pue, aire = 0.0, 0.0, False
    for t in np.arange(-L / 2, L / 2, 0.3):
        q0, q1 = c + n * t - u * L / 2, c + n * t + u * L / 2
        inter = r.intersection(LineString([q0, q1]))
        for seg in getattr(inter, 'geoms', [inter]):
            if seg.is_empty or seg.geom_type != 'LineString' or seg.length < 0.4:
                continue
            a, b = Point(seg.coords[0]), Point(seg.coords[-1])
            ap = [apoyo.distance(a) < 0.15, apoyo.distance(b) < 0.15]
            if all(ap):
                pue = max(pue, seg.length)
            elif any(ap):
                vol = max(vol, seg.length)
            else:
                aire = True
    return vol, pue, aire


def revisar(m):
    m = m.copy(); m.apply_translation((0, 0, -m.bounds[0][2]))
    malos, peor_p, peor_v = [], 0.0, 0.0
    abajo = corte(m, CAPA / 2)
    for z in np.arange(1.5 * CAPA, m.bounds[1][2], CAPA):
        ahora = corte(m, z)
        nueva = ahora.difference(abajo.buffer(0.02))
        apoyo = abajo.buffer(0.05).intersection(ahora.buffer(0.05)).boundary.union(abajo.buffer(0.05))
        for r in getattr(nueva, 'geoms', [nueva]):
            if r.is_empty or r.area < 0.5 or r.buffer(-0.22).is_empty:      # menos que un hilo: no cuenta
                continue
            mejor = None
            for k in range(12):
                v, p, aire = peor_en_direccion(r, abajo.buffer(0.05), math.pi * k / 12)
                puntaje = (aire, v > VOLADIZO, p > LUZ_PUENTE, v, p)
                if mejor is None or puntaje < mejor[0]:
                    mejor = (puntaje, v, p, aire, k * 15)
            _, v, p, aire, ang = mejor
            peor_v, peor_p = max(peor_v, v), max(peor_p, p)
            if aire or v > VOLADIZO or p > LUZ_PUENTE:
                malos.append(f"z {z:.1f}: {'hilos en el aire, ' if aire else ''}voladizo {v:.1f} / puente {p:.1f} mm ({r.area:.0f} mm2)")
        abajo = ahora
    return malos, peor_p, peor_v


if __name__ == '__main__':
    for arg in sys.argv[1:]:
        f, vuelta = (arg[:-2], True) if arg.endswith('|V') else (arg, False)
        m = trimesh.load(f)
        if vuelta:
            m.apply_transform(DADA_VUELTA)
        malos, pp, pv = revisar(m)
        print(f"{'OJO' if malos else 'OK '} {f.split(chr(92))[-1].split('/')[-1][:64]:64s} puente mas largo {pp:4.1f} | voladizo mas largo {pv:4.1f}"
              + (f'  -> {malos[:3]}' if malos else ''), flush=True)
