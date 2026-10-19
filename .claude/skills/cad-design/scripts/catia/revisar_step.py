"""revisar_step.py <archivo.step>: revisar un STEP de cliente ANTES de trabajarlo, con OpenCASCADE (build123d). Corre en
.venv-cad e imprime un JSON. Sale con codigo 2 si el archivo no trae ninguna cara (basura, vacio o no se pudo leer: eso
NO es «sano»).
  - solidos_declarados (los MANIFOLD_SOLID_BREP / BREP_WITH_VOIDS del texto del archivo) contra solidos_leidos: el lector
    convierte un solido ROTO en superficies sueltas sin avisar (auditor 19/10: caja con una cara de menos declarada como
    solido -> 0 solidos y 5 caras sueltas). Si no coinciden, «solido_roto_probable»: el aviso que importa.
  - cada solido leido: volumen, area, caras, valido, bordes abiertos (descontando aristas DEGENERADAS de largo ~0).
  - superficies sueltas: se COSEN con BRepBuilderAPI_Sewing (sin forzar una sola piel: Shell() revienta con rendijas,
    caras repetidas o varias pieles) y se informa cada PEDAZO con sus lazos de borde libre. Despues se recosen con 0,1 mm
    (la desviacion del Join que cerro rendijas de 0,05 en CATIA, ej48): los bordes que desaparecen son RENDIJAS.
Como se lee: en una piel abierta de un solo pedazo (un tapizado) un lazo es el contorno y cada lazo de mas un hueco (de
diseno o falla: se mira); en algo que deberia ser CERRADO cualquier lazo es una abertura. Una cara dada vuelta NO se
detecta (el cosido la endereza)."""
import json
import re
import sys

from build123d import Edge, Wire, import_step
from OCP.BRepBuilderAPI import BRepBuilderAPI_Sewing
from OCP.BRepGProp import BRepGProp
from OCP.GProp import GProp_GProps
from OCP.TopAbs import TopAbs_EDGE, TopAbs_FACE, TopAbs_SHELL
from OCP.TopExp import TopExp, TopExp_Explorer
from OCP.TopTools import TopTools_IndexedDataMapOfShapeListOfShape

MINIMO = 1e-6          # largo debajo del cual una arista es degenerada (polo, costura colapsada)
COSIDO_RENDIJAS = 0.1  # mm


def largo(arista):
    g = GProp_GProps()
    BRepGProp.LinearProperties_s(arista, g)
    return g.Mass()


def bordes_libres(forma_ocp):
    """(aristas libres no degeneradas como Edge, largo total, cantidad de degeneradas)."""
    mapa = TopTools_IndexedDataMapOfShapeListOfShape()
    TopExp.MapShapesAndAncestors_s(forma_ocp, TopAbs_EDGE, TopAbs_FACE, mapa)
    abiertas, total, degeneradas = [], 0.0, 0
    for i in range(1, mapa.Extent() + 1):
        if mapa.FindFromIndex(i).Extent() == 1:
            lg = largo(mapa.FindKey(i))
            if lg < MINIMO:
                degeneradas += 1
                continue
            abiertas.append(Edge(mapa.FindKey(i)))
            total += lg
    return abiertas, total, degeneradas


def lazos(aristas):
    if not aristas:
        return []
    ws = Wire.combine(aristas, tol=1e-3)
    return [{"largo_mm": round(w.length, 2), "cerrado": w.is_closed} for w in sorted(ws, key=lambda w: -w.length)]


def coser(caras, tol):
    s = BRepBuilderAPI_Sewing(tol)
    for f in caras:
        s.Add(f.wrapped)
    s.Perform()
    return s.SewedShape()


def pedazos(forma_ocp):
    """Las pieles (shells) del resultado del cosido y, aparte, cada cara que no quedo en ninguna piel (una cara REPETIDA
    queda sola: el auditor la perdia con solo las pieles)."""
    out, en_pieles, e = [], set(), TopExp_Explorer(forma_ocp, TopAbs_SHELL)
    while e.More():
        out.append(e.Current())
        f = TopExp_Explorer(e.Current(), TopAbs_FACE)
        while f.More():
            en_pieles.add(f.Current().HashCode(2 ** 31 - 1) if hasattr(f.Current(), "HashCode") else hash(f.Current()))
            f.Next()
        e.Next()
    f = TopExp_Explorer(forma_ocp, TopAbs_FACE)
    while f.More():
        k = f.Current().HashCode(2 ** 31 - 1) if hasattr(f.Current(), "HashCode") else hash(f.Current())
        if k not in en_pieles:
            out.append(f.Current())
            en_pieles.add(k)
        f.Next()
    return out


def repetidas(caras):
    """Caras con la misma area y el mismo centro (a 0,001): la misma cara dos veces."""
    vistas, n = set(), 0
    for f in caras:
        c = f.center()
        k = (round(f.area, 3), round(c.X, 3), round(c.Y, 3), round(c.Z, 3))
        if k in vistas:
            n += 1
        vistas.add(k)
    return n


def main(ruta):
    texto = open(ruta, encoding="latin-1", errors="ignore").read()
    declarados = len(re.findall(r"\b(MANIFOLD_SOLID_BREP|BREP_WITH_VOIDS)\s*\(", texto))
    s = import_step(ruta)
    caras = s.faces()
    if not caras:
        print(json.dumps({"error": "el archivo no trae ninguna cara (basura, vacio o no se pudo leer)",
                          "solidos_declarados": declarados}))
        return 2
    solidos = s.solids()
    filas = []
    for k, so in enumerate(solidos):
        ab, lg, deg = bordes_libres(so.wrapped)
        filas.append({"solido": k + 1, "vol": round(so.volume, 3), "area": round(so.area, 3), "caras": len(so.faces()),
                      "valido": so.is_valid, "bordes_abiertos": len(ab), "largo_bordes_abiertos_mm": round(lg, 3),
                      "aristas_degeneradas": deg})
    ids = {hash(g) for so in solidos for g in so.faces()}
    sueltas = [f for f in caras if hash(f) not in ids]
    piel = {}
    if sueltas:
        cosida = coser(sueltas, 1e-6)
        trozos = []
        for p in pedazos(cosida):
            ab, lg, deg = bordes_libres(p)
            n_caras, e = 0, TopExp_Explorer(p, TopAbs_FACE)
            while e.More():
                n_caras += 1
                e.Next()
            trozos.append({"caras": n_caras, "bordes_libres": len(ab), "largo_bordes_libres_mm": round(lg, 2),
                           "degeneradas": deg, "lazos": lazos(ab)})
        ab0, _, _ = bordes_libres(cosida)
        ab1, _, _ = bordes_libres(coser(sueltas, COSIDO_RENDIJAS))
        piel = {"caras": len(sueltas), "area": round(sum(f.area for f in sueltas), 3), "caras_repetidas": repetidas(sueltas),
                "pedazos": len(trozos),
                "por_pedazo": trozos, "bordes_libres": len(ab0),
                "rendijas_bordes_que_cierran_al_recoser": len(ab0) - len(ab1), "recoser_mm": COSIDO_RENDIJAS}
    print(json.dumps({"solidos_declarados": declarados, "solidos_leidos": len(filas),
                      "solido_roto_probable": declarados > len(filas), "solidos": filas, "caras_total": len(caras),
                      "superficies_sueltas": piel}))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1]))
