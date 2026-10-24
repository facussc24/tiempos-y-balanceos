# -*- coding: utf-8 -*-
# Origen: ej74_bloque_en_v.py de la practica del 19/10/2026 (C:\Dev\_catia_practica de la PC principal, copiado a CATA por
# el PEDIDO 27 a «para CATA - practica 19-10»; sha256 0c1a992f...4a66). Cambios para el ejercicio 40 del banco de CATIA
# (24/10/2026), nada mas: 1) no importa correr; 2) cuerpo(c, reg) devuelve res (lo que dio el solucionador para cada D) en
# vez de solo imprimirlo: el juez lo compara en el catia.py; 3) sin el bloque __main__.
"""ej74 — BLOQUE EN V de 90 grados (banco E3, Atlantis Press ejemplo 1): el error de posicionamiento de un eje que asienta
en el V es tolerancia / (2 sen 45) = 0,707 x 0,14 = 0,099 mm (D = 160, -0,14 / 0).
Lo RESUELVE el ensamble de CATIA, no una cuenta mia: el V son dos planos (y - z = 0 y -y - z = 0, el vertice en el eje X);
el eje del cilindro queda a distancia R de cada plano por dos restricciones de distancia; se lee la altura del eje para
D 160 y D 159,86. Esperado: z = R raiz(2) -> 113,137 y 113,038; diferencia 0,0990."""
import math
import os

from catia_base import nueva_pieza, ref

FIX, DIST = 0, 1
POS = """Function CATMain(p)
    Dim a(11)
    p.Position.GetComponents a
    CATMain = a(9) & ";" & a(10) & ";" & a(11)
End Function"""
SUBIR = """Function CATMain(p, dz)
    Dim t(11)
    For i = 0 To 11: t(i) = CDbl(0): Next
    t(0) = CDbl(1): t(4) = CDbl(1): t(8) = CDbl(1): t(11) = CDbl(dz)
    p.Move.Apply t
    CATMain = 1
End Function"""


def cuerpo(c, reg):
    carpeta = reg.carpeta
    c.DisplayFileAlerts = False

    def guardar(doc, nombre):
        ruta = os.path.join(carpeta, nombre + ".CATPart")
        if os.path.exists(ruta):
            os.remove(ruta)
        doc.SaveAs(ruta)
        doc.Close()
        return ruta

    def bloque():
        doc, part, body, sf = nueva_pieza(c, "bloque_v")
        hsf = part.HybridShapeFactory
        gs = part.HybridBodies.Add()
        for nombre, (a, b, cc) in (("V1", (0.0, -1.0, 1.0)), ("V2", (0.0, 1.0, 1.0))):
            p = hsf.AddNewPlaneEquation(a, b, cc, 0.0)
            gs.AppendHybridShape(p)
            p.Name = nombre
        part.Update()
        return guardar(doc, "bloque_v")
    rv = reg.paso("bloque en V: planos y - z = 0 y -y - z = 0", bloque)

    def cilindro(d):
        doc, part, body, sf = nueva_pieza(c, f"eje_{d}")
        hsf = part.HybridShapeFactory
        sk = body.Sketches.Add(ref(part, part.OriginElements.PlaneYZ))
        f = sk.OpenEdition()
        f.CreateClosedCircle(0.0, 0.0, d / 2)
        sk.CloseEdition()
        part.Update()
        sf.AddNewPad(sk, 50.0)
        gs = part.HybridBodies.Add()
        a, b = hsf.AddNewPointCoord(0.0, 0.0, 0.0), hsf.AddNewPointCoord(50.0, 0.0, 0.0)
        for q in (a, b):
            gs.AppendHybridShape(q)
        ln = hsf.AddNewLinePtPt(ref(part, a), ref(part, b))
        gs.AppendHybridShape(ln)
        ln.Name = "Eje"
        part.Update()
        return guardar(doc, f"eje_{str(d).replace('.', '_')}")

    def asentar(d):
        ruta = cilindro(d)
        doc = c.Documents.Add("Product")
        prod = doc.Product
        prod.PartNumber = f"V_{str(d).replace('.', '_')}"
        prod.Products.AddComponentsFromFiles([rv, ruta], "All")
        blk, cil = prod.Products.Item(1), prod.Products.Item(2)
        c.SystemService.Evaluate(SUBIR, 0, "CATMain", [cil, 200.0])   # arranca arriba del V: la solucion de afuera
        z0 = c.SystemService.Evaluate(POS, 0, "CATMain", [cil])
        raiz = prod.PartNumber
        cons = prod.Connections("CATIAConstraints")
        cons.AddMonoEltCst(FIX, prod.CreateReferenceFromName(f"{raiz}/{blk.Name}/!{raiz}/{blk.Name}/"))
        r_eje = prod.CreateReferenceFromName(f"{raiz}/{cil.Name}/!Eje")
        ks = []
        for v in ("V1", "V2"):
            k = cons.AddBiEltCst(DIST, r_eje, prod.CreateReferenceFromName(f"{raiz}/{blk.Name}/!{v}"))
            k.Dimension.Value = d / 2
            ks.append(k)
        prod.Update()
        x, y, z = (float(t.replace(",", ".")) for t in c.SystemService.Evaluate(POS, 0, "CATMain", [cil]).split(";"))
        diag = {"pos_tras_subir": z0, "estados": [k.Status for k in ks], "valores": [k.Dimension.Value for k in ks]}
        doc.Close()
        return {"y": round(y, 4), "z": round(z, 4), "cuenta_z": round(d / 2 * math.sqrt(2), 4), "diag": diag}

    res = {d: reg.paso(f"eje D {d} asentado por el solucionador", lambda d=d: asentar(d)) for d in (160.0, 159.86)}
    if all(isinstance(v, dict) for v in res.values()):
        dz = res[160.0]["z"] - res[159.86]["z"]
        reg.datos["resultado"] = {"z_160": res[160.0], "z_159_86": res[159.86], "error_de_posicion_mm": round(dz, 4),
                                  "publicado": 0.099, "cuenta": round(0.14 / (2 * math.sin(math.radians(45))), 4)}
        print("RESULTADO", reg.datos["resultado"])
    return res
