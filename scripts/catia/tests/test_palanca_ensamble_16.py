# -*- coding: utf-8 -*-
"""Prueba sin CATIA del ejercicio 16 del banco de CATIA (el 06 como ensamble con restricciones, CATA 24/10/2026).

1. Las coincidencias de puntos cierran con las poses esperadas (si no, el ensamble pedido es imposible) y cada pose es
   una rotacion propia (X x Y = Z); la punta de la barra queda en (150, 0, 80) y el eje en (0, +-10, 80), como el banco.
2. Los volumenes de las piezas son los del 06 del juez y el conjunto da lo que midio build123d sobre el bien.py del 06
   (478 517,325 mm3, README_obrero.md).
3. construir() con una CATIA FALSA: cada pieza lleva sus puntos y planos con nombre en un set oculto antes de guardar,
   y el producto lleva las 7 restricciones (base fija, 2 coincidencias + 1 paralelo para el soporte y para la palanca,
   con la orientacion «misma»), entre las referencias correctas.
4. cerrar_con_posiciones(): VERDE con las poses esperadas; ROJO con la palanca dada vuelta (la barra hacia -X), con el
   soporte corrido 0,01 mm o sin una posicion leida."""
import importlib.util
import math
import os
import sys
import tempfile
import types
import unittest

CATIA_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TESTS = os.path.dirname(os.path.abspath(__file__))
EJ16 = os.path.join(CATIA_DIR, "ejercicios", "16_palanca_ensamble")
sys.path.insert(0, CATIA_DIR)
sys.path.insert(0, TESTS)
from test_c_clamp_base_08 import Croquis, Obj  # noqa: E402

VOL_CONJUNTO = 478517.325           # build123d sobre el bien.py del 06 (README_obrero.md, corrida del juez del 23/10)


def cargar_ej16():
    spec = importlib.util.spec_from_file_location("ej16_catia", os.path.join(EJ16, "catia.py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def cruz(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


class Cuenta(unittest.TestCase):
    def test_coincidencias_y_poses(self):
        ej = cargar_ej16()
        self.assertEqual(ej.coherencia(), 0.0)
        for cual, (ex, ey, ez, _o) in ej.POSE.items():
            self.assertEqual(cruz(ex, ey), ez, cual)                       # rotacion propia, no un espejo
        self.assertEqual(ej.transformar(ej.POSE["palanca"], (ej.e06.LARGO, 0.0, 0.0)), (150.0, 0.0, 80.0))
        self.assertEqual(ej.transformar(ej.POSE["palanca"], ej.PUNTOS_PAL["PA"]), (0.0, 10.0, 80.0))
        self.assertEqual(ej.SOP_CENTRO, (0.0, -21.0, 10.0))

    def test_volumenes(self):
        ej = cargar_ej16()
        v = ej.volumenes()
        self.assertEqual((v["base"], v["soporte"]), (364000.0, 45900.0))
        self.assertAlmostEqual(sum(v.values()), VOL_CONJUNTO, places=3)

    def test_la_palanca_no_toca_el_soporte(self):
        """Por eso no hay restriccion de contacto: en el banco quedan 2 mm de luz en Y."""
        ej = cargar_ej16()
        self.assertAlmostEqual(-ej.e06.MEDIO - (ej.e06.SY0 + ej.e06.SA), 2.0, places=9)


# ---------------------------------------------------------------- CATIA falsa
class Pieza:
    def __init__(self, nombre):
        self.nombre, self.croquis, self.sets, self.ocultos, self.guardado, self.cerrado = nombre, [], [], [], None, False
        doc = self
        self.Product = Obj(PartNumber=nombre)
        self.Selection = Obj(Clear=lambda: None, Add=lambda o: doc.ocultos.append(o),
                             VisProperties=Obj(SetShow=lambda k: None))

        class Cuerpo:
            Sketches = Obj(Add=lambda plano: Croquis(doc, plano))

        def pad(sk, largo):
            return Obj(sk=sk, IsSymmetric=False, DirectionOrientation=0, FirstLimit=Obj(Dimension=Obj(Value=largo)))

        def nuevo_set():
            gs = Obj(Name="", formas=[])
            gs.AppendHybridShape = lambda f: gs.formas.append(f)
            doc.sets.append(gs)
            return gs
        self.body, self.sf = Cuerpo(), Obj(AddNewPad=pad)
        self.part = Obj(OriginElements=Obj(PlaneXY="XY", PlaneYZ="YZ", PlaneZX="ZX"), MainBody=self.body,
                        Update=lambda: None, CreateReferenceFromObject=lambda o: o,
                        HybridBodies=Obj(Add=nuevo_set),
                        HybridShapeFactory=Obj(AddNewPointCoord=lambda x, y, z: Obj(punto=(x, y, z), Name=""),
                                               AddNewPlaneOffset=lambda ref, d, inv: Obj(base=ref, Name="")))

    def SaveAs(self, ruta):
        self.guardado = ruta
        self.oculto_al_guardar = bool(self.sets) and self.sets[0] in self.ocultos
        with open(ruta, "w") as f:
            f.write("falso")

    def Close(self):
        self.cerrado = True


IDENTIDAD = ((1.0, 0.0, 0.0), (0.0, 1.0, 0.0), (0.0, 0.0, 1.0), (0.0, 0.0, 0.0))
PALANCA_OPUESTA = ((-1.0, 0.0, 0.0), (0.0, 0.0, 1.0), (0.0, 1.0, 0.0), (0.0, 0.0, 80.0))     # barra hacia -X


class Producto:
    """Antes de Update todo esta en el origen; despues, en las poses dadas. Si el paralelo de la palanca esta en
    orientacion opuesta (y la falsa no la ignora), la palanca queda con la barra hacia -X."""

    def __init__(self, ej, poses, ignora_orientacion=False):
        self.ej, self.poses, self.cons, self.comp, self.actualizado = ej, poses, [], [], False
        self.ignora = ignora_orientacion
        doc = self

        class Conexiones:
            @staticmethod
            def AddMonoEltCst(t, r):
                c = Obj(tipo=t, refs=(r,), Status=0)
                doc.cons.append(c)
                return c

            @staticmethod
            def AddBiEltCst(t, a, b):
                c = Obj(tipo=t, refs=(a, b), Status=0, Orientation=None)
                doc.cons.append(c)
                return c

            @property
            def Count(self):
                return len(doc.cons)

            def Item(self, i):
                return doc.cons[i - 1]

        def agregar(rutas, modo):                 # cada componente se llama como SU archivo (el orden importa)
            for r in rutas:
                nombre = os.path.splitext(os.path.basename(r))[0].replace("ensamble_", "")
                doc.comp.append(Obj(Name=f"ensamble_{nombre}.1", cual=nombre, ruta=r))

        def actualizar():
            doc.actualizado = True
        self.Product = Obj(PartNumber="", Products=Obj(AddComponentsFromFiles=agregar, Item=lambda i: doc.comp[i - 1]),
                           Connections=lambda n: Conexiones(), CreateReferenceFromName=lambda s: s,
                           Update=actualizar, Analyze=Obj(Volume=VOL_CONJUNTO))
        self.guardado, self.exportado, self.cerrado = None, None, False

    def pose(self, cual):
        if not self.actualizado:
            return IDENTIDAD if cual != "base" else self.poses["base"]
        p2 = [c for c in self.cons if c.tipo == 8 and c.refs[0].endswith("!Pal_ZX")]
        if cual == "palanca" and p2 and p2[0].Orientation == 1 and not self.ignora:
            return PALANCA_OPUESTA
        return self.poses[cual]

    def SaveAs(self, ruta):
        self.guardado = ruta
        with open(ruta, "w") as f:
            f.write("falso")

    def ExportData(self, ruta, tipo):
        self.exportado = ruta
        with open(ruta, "w") as f:
            f.write("falso")

    def Close(self):
        self.cerrado = True


class Cuenta16(unittest.TestCase):
    POSES_BIEN = None

    def correr_falso(self, poses=None, ignora_orientacion=False):
        ej = cargar_ej16()
        jc = ej.jc
        tmp = tempfile.mkdtemp(prefix="ej16-")
        os.environ["CATIA_TRABAJO"] = tmp
        import catia_base
        poses = poses or {"base": IDENTIDAD, **ej.POSE}
        piezas, prod = [], Producto(ej, poses, ignora_orientacion)

        def nueva_pieza(c, nombre):
            d = Pieza(nombre)
            piezas.append(d)
            return d, d.part, d.body, d.sf

        def medir(d, part, obj):
            v = ej.volumenes()[d.nombre.replace("ensamble_", "")] if isinstance(d, Pieza) else 0.0
            return {"volume": round(v, 3), "cdg_mm": [0.0, 0.0, 0.0]}

        def evaluar(c, macro, obj):
            if macro == ej.MACRO_CDG:
                if obj is not prod.Product:
                    raise AssertionError("el centro de gravedad se pide sobre el PRODUCTO")
                return "62,5718;-2,0143;20,3109"
            ex, ey, ez, o = prod.pose(obj.cual)
            return ";".join(str(x) for x in ex + ey + ez + o).replace(".", ",")
        orig_extruir = jc.extruir
        jc.extruir = lambda cb_, doc, part, body, sf, sk, largo, dv, centro=None, antes=None, vaciado=False, \
            simetrico=False: (sf.AddNewPad(sk, largo), {"volume": dv, "cdg_mm": [0, 0, 0]}, {"dv": dv})
        self.addCleanup(setattr, jc, "captura_bmp", jc.captura_bmp)       # auditor de la tanda: se devuelve
        jc.captura_bmp = lambda c_, carpeta, nombre: os.path.join(carpeta, nombre + "_iso.bmp")
        c = Obj(Documents=Obj(Add=lambda tipo: prod))
        cb = types.SimpleNamespace(nueva_pieza=nueva_pieza, medir=medir, evaluar=evaluar, ref=lambda p, o: o,
                                   poligono=catia_base.poligono, exigir_archivo=catia_base.exigir_archivo,
                                   Registro=catia_base.Registro)
        reg = catia_base.Registro(ej.EJ)
        salida = {"volumen_build123d": {"base": 364000.0, "soporte": 45900.0, "palanca": 68617.325},
                  "cdg_build123d_mm": {"base": [70.0, 0.0, 5.0], "soporte": [0.0, -21.0, 52.5],
                                       "palanca": [65.0225, 0.0, 80.0]},              # build123d, corrida 16_r1
                  "volumen_catia": {}, "cdg_catia_mm": {}, "archivos": [], "_carpeta": tmp, "_steps": {}}
        try:
            ej.construir(cb, c, reg, salida)
        finally:
            jc.extruir = orig_extruir
        return ej, jc, reg, salida, piezas, prod, tmp

    def test_piezas_referencias_y_restricciones(self):
        ej, jc, reg, salida, piezas, prod, _ = self.correr_falso()
        self.assertEqual([p for p in reg.pasos if not p["ok"]], [])
        self.assertEqual([p.nombre for p in piezas], ["ensamble_base", "ensamble_soporte", "ensamble_palanca"])
        nombres = [{f.Name for gs in p.sets for f in gs.formas} for p in piezas]
        self.assertEqual(nombres, [{"B_abajo", "B_arriba", "Base_XY", "Base_ZX"},
                                   {"S_abajo", "S_arriba", "E_mas", "E_menos", "Sop_ZX"}, {"PA", "PB", "Pal_ZX"}])
        for p in piezas:
            self.assertTrue(p.oculto_al_guardar and p.guardado and p.cerrado)      # el set oculto ANTES de guardar
        # cada plano con nombre sale del plano de origen que dice PLANOS (el paralelo decide la pose)
        bases = [{f.Name: f.base for gs in p.sets for f in gs.formas if hasattr(f, "base")} for p in piezas]
        self.assertEqual(bases, [{"Base_XY": "XY", "Base_ZX": "ZX"}, {"Sop_ZX": "ZX"}, {"Pal_ZX": "ZX"}])
        # antes de resolver, soporte y palanca en el origen; despues, movidos por las restricciones
        self.assertEqual({k: v["origen"] for k, v in salida["posiciones_antes"].items()},
                         {"soporte": [0.0, 0.0, 0.0], "palanca": [0.0, 0.0, 0.0]})
        self.assertEqual(salida["posiciones"]["palanca"]["origen"], [0.0, 0.0, 80.0])
        # el gemelo de la orientacion y la vuelta
        self.assertEqual(salida["gemelo_orientacion_opuesta"]["ejes"][0], [-1.0, 0.0, 0.0])
        self.assertEqual(salida["posicion_restaurada"]["ejes"][0], [1.0, 0.0, 0.0])
        self.assertEqual(prod.cons[-1].Orientation, 0)
        # el conjunto de build123d: suma de volumenes, cdg PESADO por volumen (no el promedio)
        self.assertEqual(salida["cdg_build123d_mm"], {"conjunto": [62.5718, -2.0143, 20.3109]})
        self.assertTrue(jc.comparar(salida))
        for n in ("Ensamble_palanca_0_60.CATProduct", "ensamble_palanca.CATPart"):     # el obrero copia lo declarado
            self.assertTrue(any(a.endswith(n) for a in salida["archivos"]), n)
        # el soporte en su origen: el eje del banco (0, +-10, 80) pasado a su sistema
        e = {f.Name: f.punto for f in piezas[1].sets[0].formas if hasattr(f, "punto")}
        self.assertEqual((e["E_mas"], e["E_menos"]), ((0.0, 31.0, 70.0), (0.0, 11.0, 70.0)))
        # las 7 restricciones, entre las referencias correctas
        r = [(c.tipo, tuple(x.rsplit("!", 1)[-1] for x in c.refs), getattr(c, "Orientation", None)) for c in prod.cons]
        raiz = "Ensamble_palanca_0_60"
        self.assertEqual(r[0][0], 0)
        self.assertEqual(prod.cons[0].refs[0], f"{raiz}/ensamble_base.1/!{raiz}/ensamble_base.1/")
        self.assertEqual(r[1:], [(2, ("S_abajo", "B_abajo"), None), (2, ("S_arriba", "B_arriba"), None),
                                 (8, ("Sop_ZX", "Base_ZX"), 0), (2, ("PA", "E_mas"), None),
                                 (2, ("PB", "E_menos"), None), (8, ("Pal_ZX", "Base_XY"), 0)])
        self.assertTrue(prod.cons[4].refs[1].startswith(f"{raiz}/ensamble_soporte.1/"))   # coaxial con el SOPORTE
        self.assertEqual(salida["volumen_build123d"], {"conjunto": VOL_CONJUNTO})
        self.assertTrue(prod.guardado and prod.exportado and prod.cerrado)
        self.assertEqual(salida["_steps"]["conjunto"], prod.exportado)

    def juez(self, poses=None, sacar=None, cruce=True, ignora_orientacion=False):
        ej, jc, reg, salida, piezas, prod, tmp = self.correr_falso(poses, ignora_orientacion)
        if sacar:
            salida["posiciones"].pop(sacar)
        salida["ok"] = jc.comparar(salida) and cruce
        jc.escribir(tmp, salida)
        return ej.cerrar_con_posiciones(tmp)

    def test_juez_rojo_si_el_cruce_da_rojo(self):
        s = self.juez(cruce=False)
        self.assertTrue(s["ok_posiciones"])
        self.assertFalse(s["ok"])

    def test_juez_rojo_si_la_orientacion_no_decide(self):
        """Si CATIA ignorara la orientacion del paralelo, el gemelo no movería la barra: el juez lo frena."""
        s = self.juez(ignora_orientacion=True)
        self.assertFalse(s["ok"])
        self.assertIn("con la orientacion opuesta la barra no fue a -X", s["error"])

    def test_juez_verde(self):
        s = self.juez()
        self.assertTrue(s["ok"] and s["ok_posiciones"])

    def test_juez_rojo_palanca_dada_vuelta_o_soporte_corrido(self):
        ej = cargar_ej16()
        base = ((1.0, 0.0, 0.0), (0.0, 1.0, 0.0), (0.0, 0.0, 1.0), (0.0, 0.0, 0.0))
        vuelta = {"base": base, **ej.POSE,
                  "palanca": ((-1.0, 0.0, 0.0), (0.0, 0.0, 1.0), (0.0, 1.0, 0.0), (0.0, 0.0, 80.0))}   # barra a -X
        s = self.juez(vuelta)
        self.assertFalse(s["ok"])
        self.assertIn("palanca fuera de lugar", s["error"])
        sx, sy, sz, so = ej.POSE["soporte"]
        corrido = {"base": base, **ej.POSE, "soporte": (sx, sy, sz, (0.0, -21.01, 10.0))}
        s = self.juez(corrido)
        self.assertFalse(s["ok"])
        self.assertIn("soporte fuera de lugar", s["error"])

    def test_juez_rojo_sin_una_posicion(self):
        s = self.juez(sacar="palanca")
        self.assertFalse(s["ok"])
        self.assertIn("palanca: sin posicion leida", s["error"])

    def test_juez_rojo_con_nan_y_con_excepcion_e_idempotente(self):
        """Pedido 10 de la principal: un NaN en la pose y una excepcion fuera de un paso nunca dan verde, y cerrar dos
        veces da lo mismo (antes el segundo cierre tomaba su propio ok como el del cruce con build123d)."""
        ej = cargar_ej16()
        base = ((1.0, 0.0, 0.0), (0.0, 1.0, 0.0), (0.0, 0.0, 1.0), (0.0, 0.0, 0.0))
        px, py, pz, po = ej.POSE["palanca"]
        nan = {"base": base, **ej.POSE, "palanca": (px, py, (pz[0], pz[1], float("nan")), po)}     # NaN al final
        self.assertFalse(self.juez(nan)["ok"])
        ej, jc, reg, salida, piezas, prod, tmp = self.correr_falso(None, False)
        salida["ok"] = jc.comparar(salida)
        salida["error"] = "excepcion fuera de un paso: Traceback ..."
        jc.escribir(tmp, salida)
        s = ej.cerrar_con_posiciones(tmp)
        self.assertFalse(s["ok"])
        self.assertIn("excepcion fuera de un paso", s["error"])
        ej, jc, reg, salida, piezas, prod, tmp = self.correr_falso(None, False)
        salida["ok"] = jc.comparar(salida)
        jc.escribir(tmp, salida)
        uno = ej.cerrar_con_posiciones(tmp)
        dos = ej.cerrar_con_posiciones(tmp)
        self.assertEqual((uno["ok"], uno.get("error")), (dos["ok"], dos.get("error")))
        self.assertTrue(dos["ok"], dos.get("error"))


if __name__ == "__main__":
    unittest.main()
