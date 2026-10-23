"""Corrector 'largo_envolvente': la caja que encierra la pieza (bbox) contra el lugar libre de la maquina, dado como caja.

Uso: python largo_envolvente.py <archivo.stl|.step> --caja X,Y,Z [--minimo X,Y,Z]
  --caja    medidas maximas (mm) del lugar libre, en el mismo orden que los ejes de la pieza. Si alguna medida de la
            pieza la pasa: rojo (choca).
  --minimo  opcional: medidas minimas que tiene que alcanzar (no llega: rojo).
Sin --caja, o con --caja TBD, sale con 2 (error): sin el lugar libre medido no se juzga.
Imprime UNA linea JSON y sale con 0 (verde), 3 (rojo), 2 (error)."""
import argparse, json, sys


def salir(veredicto, detalle, medidas=None):
    print(json.dumps({'corrector': 'largo_envolvente', 'veredicto': veredicto, 'detalle': detalle,
                      'medidas': medidas or {}}, ensure_ascii=True), flush=True)
    sys.exit({'verde': 0, 'rojo': 3}.get(veredicto, 2))


def tres(texto, nombre):
    try:
        v = [float(x) for x in texto.replace(';', ',').split(',')]
        assert len(v) == 3
        return v
    except Exception:
        salir('error', f'{nombre} tiene que ser X,Y,Z en mm (llego {texto!r})')


def medidas_pieza(ruta):
    if ruta.lower().endswith(('.step', '.stp')):
        from build123d import import_step
        bb = import_step(ruta).bounding_box()
        return [bb.size.X, bb.size.Y, bb.size.Z]
    import trimesh
    return [float(x) for x in trimesh.load(ruta, force='mesh').extents]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('archivo')
    ap.add_argument('--caja')
    ap.add_argument('--minimo')
    a = ap.parse_args()
    if not a.caja or a.caja.strip().upper() == 'TBD':
        salir('error', 'falta el lugar libre de la maquina (--caja TBD): no se puede juzgar')
    caja = tres(a.caja, '--caja')
    minimo = tres(a.minimo, '--minimo') if a.minimo else None
    p = medidas_pieza(a.archivo)
    med = {'pieza_mm': [round(x, 3) for x in p], 'caja_mm': caja, 'minimo_mm': minimo}
    malos = [f'{"XYZ"[i]} {p[i]:.2f} > {caja[i]:.2f} (choca)' for i in range(3) if p[i] > caja[i] + 1e-6]
    if minimo:
        malos += [f'{"XYZ"[i]} {p[i]:.2f} < {minimo[i]:.2f} (no llega)' for i in range(3) if p[i] < minimo[i] - 1e-6]
    if malos:
        salir('rojo', '; '.join(malos), med)
    salir('verde', f'entra en {caja}', med)


if __name__ == '__main__':
    main()
