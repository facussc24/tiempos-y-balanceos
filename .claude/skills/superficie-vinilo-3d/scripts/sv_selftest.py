# -*- coding: utf-8 -*-
"""sv_selftest.py — el medidor contra piezas INVENTADAS cuya respuesta se sabe de antemano.

Un control que nunca vi dar rojo no se si protege (cad-3d.md). La pieza base es una placa de
200x100x3 mm con la piel a 2 mm: la terminada es la tapa (200 cm2) mas dos tiras de doblez
(220 cm2 en total) y la recortada es un plano de 240x140 (336 cm2, solapas de 20 mm).

Tiene que DAR el numero:
  BIEN          total 336,0 · a la vista 200 · doblez 136 · espesor 2,00
  DOS-SOLIDOS   lo mismo con un bloque mas voluminoso debajo: tiene que tomar la placa, no el bloque
Tiene que dar el TOTAL y callar el resto:
  UNA-PIEL      solo la terminada: total 220,0 y "a la vista" sin informar, con sus avisos
  SIN-PIEL      solo el plastico: ningun numero, dos caras candidatas
Tiene que NEGARSE (NoSePuede), sin numero y sin quedarse sin memoria:
  CORRIDA       la recortada 0,6 mm mas arriba: las pieles no coinciden
  IGUALES       las dos pieles son la misma tapa: no hay recortada
  ANGOSTA       la recortada no cubre la cara (400x60)
  LEJOS         la segunda "piel" es un plano a 500 mm (antes: MemoryError de 2 GB)
  A-10-MM       una piel sola a 10 mm del plastico: eso no es un espesor de material
  HUECO-MAL     --hueco con la caja invertida

Los casos salen de la auditoria del 01/10/2026, que encontro numeros falsos en los modos de una
piel y sin piel. Uso:  .venv-cad\\Scripts\\python.exe sv_selftest.py [carpeta_de_trabajo]
Sale con 0 si todos dan lo esperado; con 1 si alguno no.
"""
import os
import subprocess
import sys
import tempfile

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)


def cara_rect(p0, p1, p2, p3):
    from OCP.gp import gp_Pnt
    from OCP.BRepBuilderAPI import BRepBuilderAPI_MakePolygon, BRepBuilderAPI_MakeFace
    w = BRepBuilderAPI_MakePolygon()
    for p in (p0, p1, p2, p3):
        w.Add(gp_Pnt(*p))
    w.Close()
    return BRepBuilderAPI_MakeFace(w.Wire()).Face()


def coser(caras):
    from OCP.BRepBuilderAPI import BRepBuilderAPI_Sewing
    s = BRepBuilderAPI_Sewing(1e-4)
    for c in caras:
        s.Add(c)
    s.Perform()
    return s.SewedShape()


def escribir(path, formas):
    from OCP.TopoDS import TopoDS_Compound
    from OCP.BRep import BRep_Builder
    from OCP.STEPControl import STEPControl_Writer, STEPControl_AsIs
    comp = TopoDS_Compound(); b = BRep_Builder(); b.MakeCompound(comp)
    for f in formas:
        b.Add(comp, f)
    w = STEPControl_Writer()
    w.Transfer(comp, STEPControl_AsIs)
    if w.Write(path) != 1:
        raise SystemExit('no se pudo escribir ' + path)


def plano(x0, y0, x1, y1, z):
    return coser([cara_rect((x0, y0, z), (x1, y0, z), (x1, y1, z), (x0, y1, z))])


def piezas(terminada=True, recortada='normal', z_piel=5.0, bloque=False):
    from OCP.BRepPrimAPI import BRepPrimAPI_MakeBox
    from OCP.gp import gp_Pnt
    formas = [BRepPrimAPI_MakeBox(gp_Pnt(0, 0, 0), 200.0, 100.0, 3.0).Solid()]             # la placa: 60 cm3
    if bloque:
        formas.append(BRepPrimAPI_MakeBox(gp_Pnt(0, 0, -12), 200.0, 100.0, 10.0).Solid())  # 200 cm3, debajo
    z = z_piel
    if terminada:
        tapa = cara_rect((0, 0, z), (200, 0, z), (200, 100, z), (0, 100, z))
        t1 = cara_rect((0, 0, z), (200, 0, z), (200, 0, z - 5), (0, 0, z - 5))              # doblez: baja 5 mm por el canto
        t2 = cara_rect((0, 100, z), (200, 100, z), (200, 100, z - 5), (0, 100, z - 5))
        formas.append(coser([tapa, t1, t2]))                                                 # 200 + 10 + 10 = 220 cm2
    if recortada == 'normal':
        formas.append(plano(-20, -20, 220, 120, z))                                          # 336 cm2
    elif recortada == 'corrida':
        formas.append(plano(-20, -20, 220, 120, z + 0.6))
    elif recortada == 'igual':
        formas.append(plano(0, 0, 200, 100, z))
    elif recortada == 'angosta':
        formas.append(plano(-100, 20, 300, 80, z))                                           # 400 x 60: no cubre la cara
    elif recortada == 'lejos':
        formas.append(plano(0, 0, 300, 300, 500.0))                                          # 900 cm2 a medio metro
    return formas


def main():
    import sv_medir
    wd = sys.argv[1] if len(sys.argv) > 1 else tempfile.mkdtemp(prefix='sv_selftest_')
    os.makedirs(wd, exist_ok=True)
    fallas = []

    def modelo(nombre, **kw):
        step = os.path.join(wd, nombre + '.step'); npz = os.path.join(wd, nombre + '.npz')
        escribir(step, piezas(**kw))
        r = subprocess.run([sys.executable, os.path.join(AQUI, 'sv_modelo.py'), step, npz, '--forzar'], capture_output=True, text=True)
        if r.returncode != 0:
            raise SystemExit('sv_modelo fallo en %s:\n%s\n%s' % (nombre, r.stdout[-800:], r.stderr[-800:]))
        return npz

    def cerca(x, y, tol):
        return x is not None and abs(x - y) <= tol

    def anotar(ok, nombre, txt):
        print('%s %-12s %s' % ('OK ' if ok else 'MAL', nombre, txt), flush=True)
        if not ok:
            fallas.append(nombre)

    # --- tiene que dar el numero
    R, _ = sv_medir.medir(modelo('bien'), verbose=False)
    anotar(R['n_pieles'] == 2 and cerca(R['total_cm2'], 336.0, 0.05) and cerca(R['vista_cm2'], 200.0, 4.0)
           and cerca(R['doblez_cm2'], 136.0, 4.0) and cerca(R['terminada']['exacta_cm2'], 220.0, 0.05)
           and cerca(R['recortada']['espesor_mm'], 2.0, 0.05) and cerca(R['cara_vista_sustrato']['area_cm2'], 200.0, 0.05)
           and not R['cara_vista_sustrato']['se_cuela_al_dorso'],
           'BIEN', 'total %.1f (336,0) · vista %.1f (200) · doblez %.1f (136) · terminada %.1f (220,0) · espesor %.2f (2,00)'
           % (R['total_cm2'], R['vista_cm2'], R['doblez_cm2'], R['terminada']['exacta_cm2'], R['recortada']['espesor_mm']))

    R, _ = sv_medir.medir(modelo('dos_solidos', bloque=True), verbose=False)
    anotar(cerca(R['sustrato']['vol_cm3'], 60.0, 0.5) and cerca(R['vista_cm2'], 200.0, 4.0) and cerca(R['recortada']['espesor_mm'], 2.0, 0.05),
           'DOS-SOLIDOS', 'sustrato de %.0f cm3 (60, no el bloque de 200) · vista %.1f (200) · espesor %.2f (2,00)'
           % (R['sustrato']['vol_cm3'], R['vista_cm2'], R['recortada']['espesor_mm']))

    # --- tiene que dar el total y callar el resto
    R, _ = sv_medir.medir(modelo('una_piel', recortada=None), verbose=False)
    anotar(R['n_pieles'] == 1 and cerca(R['total_cm2'], 220.0, 0.05) and R['vista_cm2'] is None and 'vista_rango_cm2' not in R
           and any('solo el TOTAL' in x for x in R['avisos']) and any('YA DOBLADA' in x for x in R['avisos']),
           'UNA-PIEL', 'total %.1f (220,0) · a la vista: %s (no se informa)' % (R['total_cm2'], R['vista_cm2']))

    R, capas = sv_medir.medir(modelo('sin_piel', terminada=False, recortada=None), verbose=False)
    anotar(R['n_pieles'] == 0 and R['total_cm2'] is None and R['vista_cm2'] is None and len(R['candidatas_cara_vista']) == 2
           and capas['cara_a'].any() and capas['cara_b'].any(),
           'SIN-PIEL', 'sin numero · %d candidatas (%s cm2)' % (len(R['candidatas_cara_vista']),
                                                              ' y '.join('%.0f' % c['area_cm2'] for c in R['candidatas_cara_vista'])))

    # --- tiene que negarse
    for nombre, kw, extra in (('CORRIDA', dict(recortada='corrida'), {}), ('IGUALES', dict(recortada='igual'), {}),
                              ('ANGOSTA', dict(recortada='angosta'), {}), ('LEJOS', dict(recortada='lejos'), {}),
                              ('A-10-MM', dict(recortada=None, z_piel=13.0), {}),
                              ('HUECO-MAL', dict(), dict(huecos=['parlante:300,100,0,10']))):
        try:
            R, _ = sv_medir.medir(modelo(nombre.lower().replace('-', '_'), **kw), verbose=False, **extra)
            anotar(False, nombre, 'tenia que NEGARSE y dio total %s / vista %s' % (R.get('total_cm2'), R.get('vista_cm2')))
        except sv_medir.NoSePuede as e:
            anotar(True, nombre, 'se nego: %s' % str(e)[:88])
        except MemoryError:
            anotar(False, nombre, 'se quedo sin memoria en vez de negarse')

    print('\nselftest superficie-vinilo-3d: %s' % ('TODO OK (10 casos)' if not fallas else 'FALLARON ' + ', '.join(fallas)))
    return 1 if fallas else 0


if __name__ == '__main__':
    sys.exit(main())
