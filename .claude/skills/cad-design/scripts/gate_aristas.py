#!/usr/bin/env python
"""GATE de ARISTAS VIVAS — busca los concentradores de tension en una pieza impresa.

POR QUE EXISTE (fallo real, 2026-08-07). Se entrego un utillaje con laminas elasticas cuya
raiz estaba a 90 grados vivo. Fak lo vio en el render: *"los cuadraditos se ven fragiles,
justamente los que tienen que hacer presion... dejaste muchos angulos de 90 grados, eso
significa mas riesgo de que se partan"*. El calculo le dio la razon:

    tension nominal en la raiz .............  15,0 MPa
    con arista viva, Kt = 2,2 ..............  33,0 MPa
    resistencia del PLA impreso en Z .......  25-35 MPa   -> SF estatico 0,76-1,06
    limite de fatiga (~1e5 ciclos) .........  10-16 MPa   -> SF fatiga  0,30-0,48
                                                             SE PARTIA

Los siete controles de encastre daban VERDE: ninguno miraba la resistencia. Un CAD puede
estar perfectamente posicionado y ser una pieza que se rompe a la semana.

QUE HACE. Recorre las aristas del solido y marca las CONCAVAS (las que concentran) que no
tienen radio. Ordena por gravedad: una arista viva en una pared delgada que flexiona es
critica; la misma arista en un bloque macizo es cosmetica. Para eso usa el espesor de
material que hay a cada lado: es la pared fina la que decide.

    R >= 0,5 . t  ->  Kt ~ 1,2      (lo que hay que poner)
    R  = 0,25. t  ->  Kt ~ 1,55
    arista viva   ->  Kt ~ 2,2      (y la boquilla FDM deja ~0,2 mm que NO alcanza
                                     y ademas no es repetible)

COMO MIDE LA CONCAVIDAD (y por que asi). Dos versiones anteriores dieron FALSO VERDE
(ver la nota historica al final de este docstring). Las dos preguntaban a una MALLA. La
concavidad no es una pregunta de malla: es topologia, y el kernel OCC la contesta exacta.

    n_i  = normal de la cara, INVERTIDA si f.Orientation() == TopAbs_REVERSED
           (asi queda la normal EXTERIOR real; es dato topologico, no geometrico)
    d    = tangente de la arista en su punto medio, con el signo que la arista tiene
           DENTRO DEL WIRE de la cara 1 (TopExp_Explorer sobre la cara ya compone la
           orientacion de la cara: NO hay que volver a invertirla)
    concava  <=>  dot(cross(n1, n2), d) < 0

El signo de `d` es lo que rompio el primer intento con este mismo metodo: tomada del
BRepAdaptor_Curve pelado, la tangente tiene signo arbitrario y clasificaba 13 de 24
aristas de un bloque como concavas. Con la orientacion dentro de la cara: 2 de 24, y son
exactamente las dos del fondo de la ranura.

AUTOTEST — corre en CADA invocacion, no se puede saltear. El script construye su propio
par BIEN/MAL (un bloque con una ranura de fondo a 90 vivo, y la misma ranura con el fondo
redondeado R = ancho/2) y verifica las DOS direcciones del error:

    MAL   tiene que dar 2 concavas vivas, y en el fondo de la ranura (no en otro lado)
    BIEN  tiene que dar 0 concavas vivas y 1 fillet concavo de R = ancho/2

Si el par no separa, el script sale con codigo 3 y NO juzga la pieza. Un gate sin par
BIEN/MAL tiene tasa de deteccion declarada CERO — que es exactamente como este gate llego
a dar verde dos veces sobre piezas que se partian.

USO
    gate_aristas.py --step pieza.step --t-fino 1.4
    gate_aristas.py --step pieza.step --t-fino 1.4 --tension-nominal 8.9 --json out.json
    gate_aristas.py --step pieza.step --t-fino 1.4 --verificar-material
    gate_aristas.py --solo-autotest        # probar el detector sin juzgar ninguna pieza

    --t-fino          espesor de la pared delgada que flexiona [mm]. Es la cota que define
                      el radio exigido (0,5.t) y la que separa lo critico de lo cosmetico.
    --tension-nominal si se pasa, calcula el factor de seguridad estatico y a fatiga.
    --largo-min       ignora aristas mas cortas que esto [mm] (default 1,0).
    --verificar-material  segunda opinion con un metodo que no comparte una linea de
                      codigo con el primero: mide que fraccion del contorno alrededor de
                      la arista es material (BRepClass3d_SolidClassifier). Descuenta las
                      uniones A RAS (180 grados de material), que no concentran nada y que
                      aparecen cuando el STEP tiene dos aristas sobre la misma linea.
                      Sobre virolador_v9: 245 concavas -> 241 confirmadas, 4 a ras, 0
                      discrepancias. Cuesta ~0,05 s por arista concava.

CODIGOS DE SALIDA
    0  no quedan aristas concavas vivas
    1  quedan aristas concavas vivas (o fillets concavos con radio insuficiente)
    3  el AUTOTEST fallo: el detector no probo distinguir, no se juzga nada

NOTA HISTORICA — los dos falsos verdes (2026-08-08). v1 marcaba toda arista plano-plano:
exit 1 sobre cualquier pieza, o sea ruido, y el ruido se apaga. v2 sondeaba un punto sobre
la bisectriz de las normales a 0,15 mm de la arista: exit 0 sobre cualquier pieza. El
metodo de v2 no podia funcionar ni con el signo bien puesto — sobre una esquina, tanto la
concava como la convexa dejan el punto de +bisectriz AFUERA y el de -bisectriz ADENTRO: la
sonda no distingue nada. Las dos veces se "valido" corriendo el gate sobre una pieza BUENA
y viendo que daba OK: se comprobo la direccion del falso positivo y NUNCA la del falso
negativo. De ahi la regla del par BIEN/MAL obligatorio.
"""
import argparse
import json
import math
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from OCP.BRep import BRep_Tool  # noqa: E402
from OCP.BRepAdaptor import BRepAdaptor_Curve, BRepAdaptor_Surface  # noqa: E402
from OCP.GCPnts import GCPnts_AbscissaPoint  # noqa: E402
from OCP.GeomAbs import (GeomAbs_Cylinder, GeomAbs_Plane,  # noqa: E402
                         GeomAbs_Torus)
from OCP.GeomLProp import GeomLProp_SLProps  # noqa: E402
from OCP.ShapeAnalysis import ShapeAnalysis_Surface  # noqa: E402
from OCP.TopAbs import (TopAbs_EDGE, TopAbs_FACE,  # noqa: E402
                        TopAbs_REVERSED)
from OCP.TopExp import TopExp, TopExp_Explorer  # noqa: E402
from OCP.TopoDS import TopoDS  # noqa: E402
from OCP.TopTools import (TopTools_IndexedDataMapOfShapeListOfShape,  # noqa: E402
                          TopTools_IndexedMapOfShape)
from OCP.gp import gp_Pnt, gp_Vec  # noqa: E402

# PLA impreso, capas perpendiculares a la traccion (el peor caso y el mas comun)
PLA_Z_ESTATICO = (25.0, 35.0)
PLA_Z_FATIGA = (10.0, 16.0)

ANG_TANGENTE = 5.0   # por debajo de esto las dos caras empalman suave: no hay arista


def kt(radio, t):
    """Factor de concentracion en una esquina interna en flexion, segun R/t."""
    if t <= 0:
        return 1.0
    r = radio / t
    for lim, k in ((0.0, 2.2), (0.12, 1.83), (0.25, 1.55), (0.50, 1.20), (0.75, 1.10)):
        if r <= lim:
            return k
    return 1.05


# =========================================================================================
# DETECTOR
# =========================================================================================
def _v(p):
    return np.array([p.X(), p.Y(), p.Z()], float)


def _normal_exterior(face, pnt):
    """Normal EXTERIOR de la cara en el punto. El signo sale de la TOPOLOGIA."""
    surf = BRep_Tool.Surface_s(face)
    uv = ShapeAnalysis_Surface(surf).ValueOfUV(pnt, 1e-6)
    pr = GeomLProp_SLProps(surf, uv.X(), uv.Y(), 1, 1e-7)
    if not pr.IsNormalDefined():
        return None
    n = _v(pr.Normal())
    if face.Orientation() == TopAbs_REVERSED:
        n = -n
    k = np.linalg.norm(n)
    return n / k if k > 1e-12 else None


def _mapa_orientaciones(shape, emap, fmap):
    """(indice de arista, indice de cara) -> +1/-1 segun como aparece en el wire.

    TopExp_Explorer sobre una cara ya devuelve la arista con la orientacion COMPUESTA
    (la de la arista en el wire, compuesta con la de la cara). Por eso no hay que
    aplicarle despues el signo de la cara: se probo, y empeora (13 falsas de 24).
    """
    orient = {}
    for fi in range(1, fmap.Extent() + 1):
        face = TopoDS.Face_s(fmap.FindKey(fi))
        ex = TopExp_Explorer(face, TopAbs_EDGE)
        while ex.More():
            e = TopoDS.Edge_s(ex.Current())
            ei = emap.FindIndex(e)
            if ei:
                orient[(ei, fi)] = -1 if e.Orientation() == TopAbs_REVERSED else +1
            ex.Next()
    return orient


def clasificar_aristas(shape, largo_min=1.0):
    """Lista de dicts por arista: largo, angulo diedro, estado, punto, tipos de cara."""
    emap = TopTools_IndexedMapOfShape()
    TopExp.MapShapes_s(shape, TopAbs_EDGE, emap)
    fmap = TopTools_IndexedMapOfShape()
    TopExp.MapShapes_s(shape, TopAbs_FACE, fmap)
    orient = _mapa_orientaciones(shape, emap, fmap)

    anc = TopTools_IndexedDataMapOfShapeListOfShape()
    TopExp.MapShapesAndAncestors_s(shape, TopAbs_EDGE, TopAbs_FACE, anc)

    out = []
    for i in range(1, anc.Extent() + 1):
        edge = TopoDS.Edge_s(anc.FindKey(i))
        caras = [TopoDS.Face_s(f) for f in anc.FindFromIndex(i)]
        if len(caras) != 2:
            continue
        if caras[0].IsSame(caras[1]):
            continue                      # costura de un cilindro: no es una arista real
        cur = BRepAdaptor_Curve(edge)
        try:
            largo = GCPnts_AbscissaPoint.Length_s(cur)
        except Exception:
            continue
        if largo < largo_min:
            continue
        um = 0.5 * (cur.FirstParameter() + cur.LastParameter())
        p, dv = gp_Pnt(), gp_Vec()
        cur.D1(um, p, dv)
        d = _v(dv)
        nd = np.linalg.norm(d)
        if nd < 1e-12:
            continue
        d /= nd

        F1, F2 = caras
        n1, n2 = _normal_exterior(F1, p), _normal_exterior(F2, p)
        if n1 is None or n2 is None:
            continue
        ei = emap.FindIndex(edge)
        fi = fmap.FindIndex(F1)
        s = orient.get((ei, fi))
        if s is None:
            continue
        d = d * s

        cr = np.cross(n1, n2)
        seno = float(min(np.linalg.norm(cr), 1.0))
        ang = math.degrees(math.asin(seno))
        if float(np.dot(n1, n2)) < 0:
            ang = 180.0 - ang
        if ang < ANG_TANGENTE:
            estado = "tangente"
        else:
            estado = "concava" if float(np.dot(cr, d)) < 0 else "convexa"
        t1 = BRepAdaptor_Surface(F1).GetType()
        t2 = BRepAdaptor_Surface(F2).GetType()
        out.append(dict(largo=float(largo), ang=float(ang), estado=estado,
                        pt=_v(p), d=d, tipos=(int(t1), int(t2))))
    return out


def fillets_concavos(shape):
    """Radios de los redondeos CONCAVOS (los que efectivamente alivian una esquina).

    Un cilindro es fillet concavo cuando su normal EXTERIOR apunta HACIA el eje: el
    material rodea al cilindro. Si apunta hacia afuera es un canto redondeado (convexo),
    que no alivia ninguna concentracion porque no habia ninguna.
    """
    fmap = TopTools_IndexedMapOfShape()
    TopExp.MapShapes_s(shape, TopAbs_FACE, fmap)
    radios = []
    for fi in range(1, fmap.Extent() + 1):
        face = TopoDS.Face_s(fmap.FindKey(fi))
        ad = BRepAdaptor_Surface(face)
        if ad.GetType() != GeomAbs_Cylinder:
            continue
        cyl = ad.Cylinder()
        R = float(cyl.Radius())
        u = 0.5 * (ad.FirstUParameter() + ad.LastUParameter())
        v = 0.5 * (ad.FirstVParameter() + ad.LastVParameter())
        p = ad.Value(u, v)
        n = _normal_exterior(face, p)
        if n is None:
            continue
        ax = cyl.Axis()
        o, dirn = _v(ax.Location()), _v(ax.Direction())
        w = _v(p) - o
        radial = w - np.dot(w, dirn) * dirn
        k = np.linalg.norm(radial)
        if k < 1e-9:
            continue
        radial /= k
        if float(np.dot(n, radial)) < 0:          # normal hacia el eje -> concavo
            radios.append(R)
    return radios


def concavas_vivas(shape, largo_min=1.0):
    return [a for a in clasificar_aristas(shape, largo_min) if a["estado"] == "concava"]


def fraccion_material(shape, P, d, eps=0.02, n=24, _cache={}):
    """Que fraccion del contorno alrededor de la arista es MATERIAL. Metodo independiente.

    No usa normales ni orientacion: barre un circulo de radio eps en el plano
    perpendicular a la arista y clasifica cada punto con BRepClass3d_SolidClassifier
    (clasificador exacto sobre el BRep, no sobre una malla).

        ~0,25 -> el material abarca ~90 grados   -> convexa
        ~0,75 -> ~270 grados                     -> concava
        ~0,50 -> 180 grados: union A RAS, no concentra nada

    El caso 0,50 es real y aparece en piezas de verdad: cuando el STEP tiene DOS aristas
    sobre la misma linea (una plano-plano y una plano-cilindro tangente, con las mismas
    normales), cada una es media union. Ninguna de las dos concentra tension.
    """
    from OCP.BRepClass3d import BRepClass3d_SolidClassifier
    from OCP.TopAbs import TopAbs_IN
    key = id(shape)
    cls = _cache.get(key)
    if cls is None:
        cls = _cache[key] = BRepClass3d_SolidClassifier(shape)
    a = np.array([1.0, 0.0, 0.0])
    if abs(float(np.dot(a, d))) > 0.9:
        a = np.array([0.0, 1.0, 0.0])
    u = np.cross(d, a)
    u /= np.linalg.norm(u)
    v = np.cross(d, u)
    dentro = 0
    for k in range(n):
        th = 2.0 * math.pi * (k + 0.137) / n      # offset que no aliasea con las caras
        q = P + eps * (math.cos(th) * u + math.sin(th) * v)
        cls.Perform(gp_Pnt(float(q[0]), float(q[1]), float(q[2])), 1e-7)
        if cls.State() == TopAbs_IN:
            dentro += 1
    return dentro / float(n)


# =========================================================================================
# AUTOTEST — par sintetico BIEN/MAL, obligatorio en cada corrida
# =========================================================================================
W_, L_, H_, ANCHO_, PROF_ = 40.0, 60.0, 20.0, 4.0, 6.0
Z_FONDO_ = H_ / 2 - PROF_          # -> +4,0 mm


def _par_sintetico():
    """(MAL, BIEN). MAL = ranura pasante de fondo a 90 vivo. BIEN = fondo R = ancho/2.

    Las dos piezas salen de un booleano, asi que traen caras REVERSED (4 y 5 de 10):
    el autotest ejercita de verdad la rama de orientacion invertida, que es donde se
    equivocaron las versiones anteriores.
    """
    from build123d import Box, Cylinder, Pos, Rot
    mal = Box(W_, L_, H_) - Pos(0, 0, H_ / 2 - PROF_ / 2) * Box(ANCHO_, L_ + 10, PROF_)
    r = ANCHO_ / 2
    bien = (Box(W_, L_, H_)
            - Pos(0, 0, Z_FONDO_ + r + (PROF_ - r) / 2) * Box(ANCHO_, L_ + 10, PROF_ - r)
            - Pos(0, 0, Z_FONDO_ + r) * Rot(90, 0, 0) * Cylinder(r, L_ + 10))
    return mal.wrapped, bien.wrapped


def _es_fondo_de_ranura(pt):
    return abs(abs(pt[0]) - ANCHO_ / 2) < 1e-4 and abs(pt[2] - Z_FONDO_) < 1e-4


def autotest():
    """Devuelve la lista de problemas. Vacia = el detector separa el par."""
    prob = []
    try:
        mal, bien = _par_sintetico()
    except Exception as e:                                    # pragma: no cover
        return ["no se pudo construir el par sintetico: %s: %s" % (type(e).__name__, e)]

    cm = concavas_vivas(mal)
    fm = fillets_concavos(mal)
    en_fondo = [a for a in cm if _es_fondo_de_ranura(a["pt"])]
    print("    MAL  (ranura de fondo 90 vivo)   concavas vivas=%d  (en el fondo: %d)  "
          "fillets concavos=%d" % (len(cm), len(en_fondo), len(fm)))
    if len(cm) < 2:
        prob.append("MAL da %d concavas vivas: no ve el fondo a 90 grados vivo -> "
                    "FALSO NEGATIVO, es la ceguera exacta de los dos falsos verdes"
                    % len(cm))
    if len(en_fondo) != 2:
        prob.append("MAL marca %d aristas EN EL FONDO de la ranura, tendria que marcar 2: "
                    "el detector acierta el conteo pero no el lugar" % len(en_fondo))
    if len(cm) > 2:
        prob.append("MAL da %d concavas vivas y solo 2 son reales: %d FALSOS POSITIVOS "
                    "sobre un bloque prismatico -> el gate seria ruido y se apagaria"
                    % (len(cm), len(cm) - 2))

    cb = concavas_vivas(bien)
    fb = fillets_concavos(bien)
    print("    BIEN (mismo fondo con R=%.2f)     concavas vivas=%d                    "
          "fillets concavos=%d%s"
          % (ANCHO_ / 2, len(cb), len(fb),
             ("  R=%s" % [round(x, 2) for x in fb]) if fb else ""))
    if cb:
        prob.append("BIEN da %d concavas vivas sobre un fondo redondeado: FALSO POSITIVO"
                    % len(cb))
    if len(fb) != 1 or abs(fb[0] - ANCHO_ / 2) > 1e-3:
        prob.append("BIEN tendria que tener 1 fillet concavo de R=%.2f y da %s: el "
                    "detector de radios no mide el redondeo que SI esta"
                    % (ANCHO_ / 2, [round(x, 2) for x in fb]))
    if fm:
        prob.append("MAL no tiene ningun redondeo y el detector le encuentra %d: "
                    "FALSO POSITIVO en los radios" % len(fm))

    # --- el SEGUNDO metodo tambien tiene que separar el par -----------------------------
    # fraccion_material no comparte una sola linea de codigo con el metodo de normales:
    # si los dos coinciden sobre el par, el acuerdo sobre una pieza real significa algo.
    todas_mal = clasificar_aristas(mal)
    f_conc = [fraccion_material(mal, a["pt"], a["d"]) for a in todas_mal
              if a["estado"] == "concava"]
    f_conv = [fraccion_material(mal, a["pt"], a["d"]) for a in todas_mal
              if a["estado"] == "convexa"]
    if f_conc and f_conv:
        print("    2do metodo (fraccion de material): concavas ~ %.2f   convexas ~ %.2f"
              % (float(np.median(f_conc)), float(np.median(f_conv))))
        if min(f_conc) <= 0.55:
            prob.append("2do metodo: una concava de MAL da fraccion %.2f (tendria que ser "
                        "~0,75): los dos metodos no coinciden ni sobre el par sintetico"
                        % min(f_conc))
        if max(f_conv) >= 0.45:
            prob.append("2do metodo: una convexa de MAL da fraccion %.2f (tendria que ser "
                        "~0,25)" % max(f_conv))
    else:
        prob.append("2do metodo: no se pudo evaluar (faltan concavas o convexas en MAL)")
    return prob


# =========================================================================================
def main():
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--step")
    p.add_argument("--t-fino", type=float,
                   help="espesor de la pared que flexiona [mm]")
    p.add_argument("--tension-nominal", type=float,
                   help="sigma nominal en la raiz [MPa], para el factor de seguridad")
    p.add_argument("--largo-min", type=float, default=1.0,
                   help="ignorar aristas mas cortas que esto [mm]")
    p.add_argument("--solo-autotest", action="store_true",
                   help="probar el detector y salir, sin juzgar ninguna pieza")
    p.add_argument("--verificar-material", action="store_true",
                   help="segunda opinion sobre cada concava encontrada, con un metodo "
                        "independiente (fraccion de material alrededor de la arista). "
                        "Descuenta las uniones A RAS (180 grados), que no concentran. "
                        "Cuesta ~0,1 s por arista concava.")
    p.add_argument("--json", help="volcar el resultado")
    a = p.parse_args()

    # --- el detector se prueba SIEMPRE, antes de mirar la pieza --------------------------
    print("AUTOTEST del detector (par sintetico BIEN/MAL)")
    prob = autotest()
    if prob:
        print("  [AUTOTEST FALLA]")
        for x in prob:
            print("    - " + x)
        print("  No se juzga ninguna pieza con un detector que no probo distinguir.")
        return 3
    print("  [AUTOTEST OK] el detector separa el par BIEN/MAL.\n")
    if a.solo_autotest:
        return 0
    if not a.step or a.t_fino is None:
        p.error("hacen falta --step y --t-fino (o usar --solo-autotest)")

    from OCP.IFSelect import IFSelect_RetDone
    from OCP.STEPControl import STEPControl_Reader
    if not os.path.isfile(a.step):
        print("no existe el archivo: %s" % a.step)
        return 2
    rd = STEPControl_Reader()
    if rd.ReadFile(a.step) != IFSelect_RetDone:
        print("STEP ilegible: %s" % a.step)
        return 2
    rd.TransferRoots()
    shape = rd.OneShape()

    r_exigido = 0.5 * a.t_fino
    print("pieza: %s" % os.path.basename(a.step))
    print("pared fina declarada: %s mm  ->  radio exigido en las concavas: %.2f mm "
          "(0,5.t, da Kt ~ 1,2)\n" % (a.t_fino, r_exigido))

    todas = clasificar_aristas(shape, a.largo_min)
    vivas = [x for x in todas if x["estado"] == "concava"]
    convexas = sum(1 for x in todas if x["estado"] == "convexa")
    tangentes = sum(1 for x in todas if x["estado"] == "tangente")
    radios = fillets_concavos(shape)
    chicos = sorted(r for r in radios if r < r_exigido - 1e-6)

    a_ras = []
    if a.verificar_material and vivas:
        print("segunda opinion sobre las %d concavas (metodo independiente)..." % len(vivas))
        quedan, discrepan = [], 0
        for x in vivas:
            f = fraccion_material(shape, x["pt"], x["d"])
            x["frac"] = f
            if 0.45 <= f <= 0.55:
                a_ras.append(x)              # union a ras: no concentra
            elif f < 0.45:
                discrepan += 1               # el 2do metodo la ve CONVEXA
            else:
                quedan.append(x)
        print("  confirmadas concavas: %d   uniones a ras (descontadas): %d   "
              "el 2do metodo las ve convexas: %d" % (len(quedan), len(a_ras), discrepan))
        if discrepan:
            print("  [OJO] %d aristas donde los dos metodos NO coinciden. Mirarlas a mano."
                  % discrepan)
        vivas = quedan

    vivas.sort(key=lambda x: -x["largo"])
    print("aristas de mas de %.1f mm con 2 caras: %d" % (a.largo_min, len(todas)))
    print("  convexas    : %d   (cantos: se astillan, NO concentran tension)" % convexas)
    print("  tangentes   : %d   (empalme suave: no hay esquina)" % tangentes)
    print("  CONCAVAS SIN RADIO: %d   <- las unicas que concentran" % len(vivas))
    print("  fillets concavos: %d%s" % (len(radios),
          ("   radios ~ %s" % sorted({round(x, 2) for x in radios})[:8]) if radios else ""))
    if chicos:
        print("  [AVISO] %d fillets concavos con R < %.2f exigido: %s"
              % (len(chicos), r_exigido, [round(x, 2) for x in chicos[:8]]))

    if a.tension_nominal:
        print("\nCON LA TENSION NOMINAL DECLARADA (%s MPa):" % a.tension_nominal)
        print("%-34s %5s %8s %14s %14s" % ("situacion", "Kt", "sigma",
                                           "SF estatico", "SF fatiga"))
        for R, nom in ((0.0, "arista viva (Kt de esquina)"),
                       (0.25 * a.t_fino, "R = 0,25.t = %.2f" % (0.25 * a.t_fino)),
                       (r_exigido, "R = 0,50.t = %.2f  <- exigido" % r_exigido)):
            K = kt(R, a.t_fino)
            s = a.tension_nominal * K
            print("%-34s %5.2f %7.1f MPa %14s %14s"
                  % (nom, K, s,
                     "%.2f-%.2f" % (PLA_Z_ESTATICO[0] / s, PLA_Z_ESTATICO[1] / s),
                     "%.2f-%.2f" % (PLA_Z_FATIGA[0] / s, PLA_Z_FATIGA[1] / s)))
        s_ok = a.tension_nominal * kt(r_exigido, a.t_fino)
        if PLA_Z_FATIGA[0] / s_ok < 1.0:
            print("\n  [AVISO] aun con el radio exigido el SF a fatiga arranca en %.2f. "
                  "Bajar la tension nominal (menos precarga, brazo mas largo) o imprimir "
                  "la pieza con las capas A LO LARGO de la viga." % (PLA_Z_FATIGA[0] / s_ok))

    print()
    if vivas:
        print("las 8 aristas CONCAVAS sin radio mas largas (revisar si flexionan ahi):")
        for x in vivas[:8]:
            c = x["pt"]
            print("   L=%6.1f mm  diedro %5.1f deg  en (%8.1f,%8.1f,%8.1f)"
                  % (x["largo"], x["ang"], c[0], c[1], c[2]))
        print("\n[FALLA] quedan %d aristas concavas vivas. Las que esten donde hay flexion"
              % len(vivas))
        print("        hay que redondearlas: construir la ranura con el fondo redondeado")
        print("        (caja + cilindro) en vez de addBox sola, o fillet en lote.")
    elif chicos:
        print("[FALLA] no quedan aristas vivas, pero %d fillets concavos tienen menos "
              "radio que el exigido." % len(chicos))
    else:
        print("[OK] no quedan aristas concavas sin radio.")

    if a.json:
        with open(a.json, "w", encoding="utf-8") as f:
            json.dump({"autotest": "OK",
                       "vivas": len(vivas), "convexas": convexas, "tangentes": tangentes,
                       "fillets_concavos": sorted(round(x, 3) for x in radios),
                       "fillets_chicos": [round(x, 3) for x in chicos],
                       "radio_exigido": r_exigido, "t_fino": a.t_fino,
                       "peores": [{"largo": round(x["largo"], 2),
                                   "ang": round(x["ang"], 1),
                                   "pt": [round(float(c), 3) for c in x["pt"]]}
                                  for x in vivas[:20]]}, f, indent=1)
    return 1 if (vivas or chicos) else 0


if __name__ == "__main__":
    sys.exit(main())
