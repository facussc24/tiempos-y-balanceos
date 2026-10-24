# -*- coding: utf-8 -*-
"""Prueba sin CATIA del ejercicio 14 del banco de CATIA (reglas del banco como controles adentro de la pieza, CATA
24/10/2026).

1. Las reglas del catia.py son las de los correctores del banco: R >= 1,5 (cantos_convexos.py, --umbral) y luz entre 0,1
   y 0,4 por lado (holgura_nido.py, --min/--max); y separan: verde la buena, rojo cada mutante del tarea.yaml.
2. La cuenta del nido por luz y del mango sin radio contra lo que midio build123d sobre cada script del banco (CATA,
   24/10/2026).
3. construir() con una CATIA FALSA: el parametro mueve la geometria por formula (Radio -> los dos redondeos; Luz -> los
   cuatro lados del croquis acotado contra los ejes), el control va sobre el parametro propio, los redondeos se
   inactivan antes de Radio 0, y cada variante se mide despues de cambiar SOLO el parametro.
4. cerrar_con_controles(): VERDE con los controles como se esperan; ROJO si el control dice «cumple» siempre (la trampa
   de catia.md: un CreateCheck sobre nombres internos de cotas) o si uno no se leyo."""
import importlib.util
import os
import re
import sys
import tempfile
import types
import unittest

CATIA_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TESTS = os.path.dirname(os.path.abspath(__file__))
EJ14 = os.path.join(CATIA_DIR, "ejercicios", "14_reglas_knowledgeware")
BANCO = os.path.join(os.path.dirname(os.path.dirname(CATIA_DIR)), "evals", "banco3d")
sys.path.insert(0, CATIA_DIR)
sys.path.insert(0, TESTS)
from test_c_clamp_base_08 import Croquis, Obj  # noqa: E402

VOL_B123D = {"mango_bien": 57651.58, "mango_mal_2": 57951.814, "mango_mal_1": 57989.381,     # CATA, 24/10/2026
             "nido_bien": 163397.6, "nido_mal_1": 164000.0, "nido_mal_2": 160940.0}


def cargar_ej14():
    spec = importlib.util.spec_from_file_location("ej14_catia", os.path.join(EJ14, "catia.py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def defecto(corrector, opcion):
    with open(os.path.join(BANCO, "correctores", corrector), encoding="utf-8") as f:
        texto = f.read()
    return float(re.search(r"add_argument\(['\"]--%s['\"], type=float, default=([0-9.]+)\)" % opcion, texto).group(1))


class Reglas(unittest.TestCase):
    def test_umbrales_de_los_correctores(self):
        ej = cargar_ej14()
        self.assertEqual(defecto("cantos_convexos.py", "umbral"), 1.5)
        self.assertEqual((defecto("holgura_nido.py", "min"), defecto("holgura_nido.py", "max")), (0.1, 0.4))
        self.assertEqual(ej.REGLA_MANGO, "Radio >= 1.5mm and Redondeado == true")
        self.assertEqual(ej.REGLA_MANGO_SOLO_RADIO, "Radio >= 1.5mm")
        self.assertEqual(ej.REGLA_NIDO, "Luz >= 0.1mm and Luz <= 0.4mm")

    def test_las_reglas_separan(self):
        ej = cargar_ej14()
        for nombre, (_e, _s, valor, esperado) in ej.MANGO.items():
            self.assertIs(ej.regla_mango(valor), esperado, nombre)
        for nombre, (_e, _s, valor, esperado) in ej.NIDO.items():
            self.assertIs(ej.regla_nido(valor), esperado, nombre)

    def test_los_scripts_y_sus_valores(self):
        """El valor de cada variante es el del script del banco (armar(radio, ...) y luz={...})."""
        ej = cargar_ej14()
        for nombre, (banco, script, valor, _ok) in list(ej.MANGO.items()) + list(ej.NIDO.items()):
            with open(os.path.join(BANCO, "ejercicios", banco, script), encoding="utf-8") as f:
                texto = f.read()
            if banco == "05_canto_vivo":
                self.assertIn(f"armar({valor:.1f},", texto, nombre)
            else:
                self.assertIn(f'"+x": {valor:.1f}', texto, nombre)

    def test_cuenta_contra_build123d(self):
        ej = cargar_ej14()
        for nombre, (_e, _s, luz, _ok) in ej.NIDO.items():
            self.assertAlmostEqual(ej.volumen_nido(luz), VOL_B123D[nombre], places=3)
        self.assertAlmostEqual(ej.volumen_mango_sin_radio(), VOL_B123D["mango_mal_1"], places=3)


# ---------------------------------------------------------------- CATIA falsa
class Param(Obj):
    pass


class DocFalso:
    """Una pieza: el volumen sale del valor del parametro (la tabla de build123d) y el control lo evalua la regla."""

    def __init__(self, ej, nombre, regla_siempre_verde=False, con_actividad=True):
        self.ej, self.nombre, self.siempre, self.con_actividad = ej, nombre, regla_siempre_verde, con_actividad
        self.croquis, self.formulas, self.inactivos, self.restricciones, self.cerrado = [], [], [], [], False
        self.param, self.chk, self.fillets, self.pasos_vol, self.redondeado, self.lista = None, None, [], 0.0, None, []
        doc = self
        self.Product = Obj(PartNumber=nombre)
        self.Selection = Obj(Clear=lambda: None, Add=lambda o: None, VisProperties=Obj(SetShow=lambda k: None))

        class CroquisR(Croquis):
            def __init__(self, d, plano):
                super().__init__(d, plano)
                self.AbsoluteAxis = Obj(HorizontalReference="eje H", VerticalReference="eje V")
                self.Constraints = Obj(
                    AddMonoEltCst=lambda t, r: d.restricciones.append((t, r)) or Obj(),
                    AddBiEltCst=lambda t, a, b: d.restricciones.append((t, a, b)) or Obj(Dimension=Obj(dim=(a, b))))

        class Cuerpo:
            Sketches = Obj(Add=lambda plano: CroquisR(doc, plano))

            @staticmethod
            def InsertHybridShape(p):
                pass

        class Fabrica:
            @staticmethod
            def AddNewPad(sk, largo):
                doc.pasos_vol += (60000.0 if doc.nombre.startswith("mango") else 200000.0)
                return Obj(sk=sk, IsSymmetric=False, DirectionOrientation=0, FirstLimit=Obj(Dimension=Obj(Value=largo)))

            @staticmethod
            def AddNewPocket(sk, largo):
                doc.pasos_vol -= (2010.6193 if doc.nombre.startswith("mango") else 36602.4)
                return Obj(sk=sk, IsSymmetric=False, DirectionOrientation=0, FirstLimit=Obj(Dimension=Obj(Value=largo)))

            @staticmethod
            def AddNewSolidEdgeFilletWithConstantRadius(ref, prop, r):
                f = Obj(Name=f"EdgeFillet.{len(doc.fillets) + 1}", Radius=Obj(radio=r), prop=prop, aristas=[ref])
                f.AddObjectToFillet = lambda x: f.aristas.append(x)
                doc.fillets.append(f)
                if doc.con_actividad:            # el parametro Activity de cada operacion, como en la R21 de CATA
                    doc.lista.append(Param(Name=f"{doc.nombre}\\PartBody\\{f.Name}\\Activity", Value=True))
                return f

        class Relaciones:
            Count = 0

            @staticmethod
            def CreateFormula(n, com, destino, expr):
                doc.formulas.append((n, destino, expr))

            @staticmethod
            def CreateCheck(n, com, cuerpo):
                doc.chk = Obj(Value=cuerpo, nombre=n)
                return doc.chk

        class Parametros:
            @staticmethod
            def CreateDimension(n, tipo, v):
                doc.param = Param(Name=n, Value=v)
                doc.lista.append(doc.param)
                return doc.param

            @staticmethod
            def CreateBoolean(n, v):
                doc.redondeado = Param(Name=n, Value=v)
                doc.lista.append(doc.redondeado)
                return doc.redondeado

            @property
            def Count(self):
                return len(doc.lista)

            def Item(self, i):
                return doc.lista[i - 1]

        self.body, self.sf = Cuerpo(), Fabrica()
        self.part = Obj(OriginElements=Obj(PlaneXY="XY"), MainBody=self.body, Update=self.actualizar,
                        CreateReferenceFromObject=lambda o: o, Relations=Relaciones(), Parameters=Parametros(),
                        HybridShapeFactory=Obj(AddNewPlaneOffset=lambda ref, z, inv: Obj(z=z)),
                        Inactivate=lambda f: doc.inactivos.append(f))

    def apagados(self):
        """Los redondeos estan apagados si se inactivaron o si su Activity sigue a Redondeado y este es falso."""
        por_formula = self.redondeado is not None and not self.redondeado.Value and \
            sum(1 for _n, dest, e in self.formulas if e == "Redondeado" and str(dest.Name).endswith("\\Activity")) == 2
        return bool(self.inactivos) or por_formula

    def actualizar(self):
        if self.chk is not None and self.param is not None:
            if self.nombre.startswith("nido"):
                ok = self.ej.regla_nido(self.param.Value)
            elif "Redondeado" in self.chk.Value:     # el control lee lo que dice su expresion, nada mas
                ok = self.ej.regla_mango(self.param.Value, bool(self.redondeado.Value))
            else:
                ok = self.ej.regla_mango(self.param.Value)
            self.chk.Diagnosis = True if self.siempre else ok

    def volumen(self):
        if self.param is None:
            return self.pasos_vol
        v = self.param.Value
        if self.nombre.startswith("nido"):
            return self.ej.volumen_nido(v)
        if self.apagados():
            return VOL_B123D["mango_mal_1"]
        return {1.5: VOL_B123D["mango_bien"], 0.5: VOL_B123D["mango_mal_2"]}[v]

    def Close(self):
        self.cerrado = True


class Cuenta14(unittest.TestCase):
    def correr_falso(self, regla_siempre_verde=False, con_actividad=True, regla_mango=None, sin_medir=None):
        ej = cargar_ej14()
        if regla_mango:
            ej.REGLA_MANGO = regla_mango
        jc = ej.jc
        tmp = tempfile.mkdtemp(prefix="ej14-")
        os.environ["CATIA_TRABAJO"] = tmp
        import catia_base
        docs = []

        def nueva_pieza(c, nombre):
            d = DocFalso(ej, nombre, regla_siempre_verde, con_actividad)
            docs.append(d)
            return d, d.part, d.body, d.sf

        def medir(d, part, obj):
            return {"volume": round(d.volumen(), 3), "cdg_mm": [0.0, 0.0, 0.0]}

        def guardar(d, reg, nombre):
            ruta = os.path.join(reg.carpeta, nombre + ".stp")
            open(ruta, "w").close()
            return {"step": ruta}
        BL, BA, BE, X = ej.e05.BL, ej.e05.BA, ej.e05.BE, ej.e05.X_AG

        def topologia(d, feat, tipo):            # aristas del mango: 4 verticales, 8 del contorno y 4 bordes de agujero
            vert = [{"ref": f"v{i}", "cdg": [sx * BL / 2, sy * BA / 2, 0.0]} for i, (sx, sy) in
                    enumerate(((1, 1), (1, -1), (-1, 1), (-1, -1)))]
            cont = [{"ref": f"c{i}", "cdg": [0.0, sy * BA / 2, sz * BE / 2]} for i, (sy, sz) in
                    enumerate(((1, 1), (-1, 1), (1, -1), (-1, -1)))]
            bord = [{"ref": f"b{i}", "cdg": [sx * X + 4.0, 0.0, sz * BE / 2]} for i, (sx, sz) in
                    enumerate(((1, 1), (-1, 1), (1, -1), (-1, -1)))]
            return vert + cont + bord
        cb = types.SimpleNamespace(nueva_pieza=nueva_pieza, medir=medir, guardar_pieza=guardar, ref=lambda p, o: o,
                                   topologia=topologia, poligono=catia_base.poligono, Registro=catia_base.Registro)
        self.addCleanup(setattr, jc, "captura_bmp", jc.captura_bmp)       # auditor de la tanda: se devuelve
        jc.captura_bmp = lambda c_, carpeta, nombre: os.path.join(carpeta, nombre + "_iso.bmp")
        reg = catia_base.Registro(ej.EJ)
        salida = {"volumen_build123d": {"mango_R1_5": 1.0}, "cdg_build123d_mm": {}, "volumen_catia": {},
                  "cdg_catia_mm": {}, "archivos": [], "_carpeta": tmp, "_steps": {}}
        original = jc.medir_b123d

        def falso_b123d(args, timeout=900):
            nombre = os.path.basename(args[2]).replace("_b123d_", "")
            if nombre == sin_medir:
                return {"error": "bien.py salio con 1: falla de prueba"}
            clave = "nido" if nombre.startswith("nido") else "mango"
            return {"partes": {clave: {"volumen": VOL_B123D[nombre], "cdg_mm": [0.0, 0.0, 0.0]}}}
        jc.medir_b123d = falso_b123d
        try:
            ej.construir(cb, Obj(), reg, salida)
        finally:
            jc.medir_b123d = original
        return ej, jc, reg, salida, docs, tmp

    def test_parametros_formulas_y_variantes(self):
        ej, jc, reg, salida, docs, _ = self.correr_falso()
        self.assertEqual([p for p in reg.pasos if not p["ok"]], [])
        self.assertTrue(jc.comparar(salida))
        mango, nido = docs
        # mango: Radio manda los DOS redondeos y el control va sobre Radio
        self.assertEqual(mango.param.Name, "Radio")
        self.assertEqual([(dest is f.Radius, e) for (_n, dest, e), f in zip(mango.formulas, mango.fillets)],
                         [(True, "Radio"), (True, "Radio")])
        self.assertEqual(mango.chk.Value, "Radio >= 1.5mm and Redondeado == true")
        self.assertEqual(mango.fillets[1].prop, 1)                        # el paso 2 propaga por tangencia
        # el encendido de cada redondeo sale de Redondeado; sin radio = Redondeado falso con Radio en 1,5, sin Inactivate
        self.assertEqual([(str(d.Name), e) for _n, d, e in mango.formulas[2:]],
                         [(f"mango_reglas\\PartBody\\EdgeFillet.{i}\\Activity", "Redondeado") for i in (1, 2)])
        self.assertEqual(mango.inactivos, [])
        self.assertEqual(salida["controles"]["mango_mal_1"]["parametro"], False)
        self.assertEqual(mango.param.Value, 1.5)
        self.assertNotIn("limite_control_mango", salida)
        # nido: los cuatro lados del croquis atados a los ejes con «30mm + Luz» / «20mm + Luz»
        self.assertEqual(nido.param.Name, "Luz")
        self.assertEqual(sorted(e for _n, _d, e in nido.formulas), ["20mm + Luz"] * 2 + ["30mm + Luz"] * 2)
        ejes = [r[2] for r in nido.restricciones if len(r) == 3]
        self.assertEqual(sorted(ejes), ["eje H", "eje H", "eje V", "eje V"])
        self.assertEqual(sorted(r[0] for r in nido.restricciones if len(r) == 2), [10, 10, 13, 13])
        self.assertEqual(nido.chk.Value, "Luz >= 0.1mm and Luz <= 0.4mm")
        # cada variante con su control: verde la buena, rojo los mutantes
        self.assertEqual({k: v["control_cumple"] for k, v in salida["controles"].items()},
                         {"mango_bien": True, "mango_mal_2": False, "mango_mal_1": False,
                          "nido_bien": True, "nido_mal_1": False, "nido_mal_2": False})
        for k in VOL_B123D:
            self.assertAlmostEqual(salida["volumen_catia"][k], VOL_B123D[k], places=3)
        self.assertTrue(mango.cerrado and nido.cerrado)

    def test_juez_verde(self):
        ej, jc, reg, salida, docs, tmp = self.correr_falso()
        salida["ok"] = jc.comparar(salida)          # como correr_ejercicio: llena diferencia_mm3
        jc.escribir(tmp, salida)
        s = ej.cerrar_con_controles(tmp)
        self.assertTrue(s["ok"] and s["controles_como_se_esperaba"])

    def test_juez_rojo_si_el_control_cumple_siempre(self):
        """La trampa de catia.md: un control que da «cumple» siempre. El juez tiene que frenarlo."""
        ej, jc, reg, salida, docs, tmp = self.correr_falso(regla_siempre_verde=True)
        salida["ok"] = jc.comparar(salida)          # como correr_ejercicio: llena diferencia_mm3
        jc.escribir(tmp, salida)
        s = ej.cerrar_con_controles(tmp)
        self.assertFalse(s["ok"])
        self.assertIn("mango_mal_2: el control dio verde y tenia que dar rojo", s["error"])

    def test_juez_rojo_si_el_control_no_mira_el_encendido(self):
        """Gemelo del revisor (24/10): redondeos apagados con Radio en 1,5 y un control que mira solo Radio queda VERDE
        con la pieza sin radio. El juez lo tiene que frenar."""
        ej, jc, reg, salida, docs, tmp = self.correr_falso(regla_mango="Radio >= 1.5mm")
        self.assertTrue(salida["controles"]["mango_mal_1"]["control_cumple"])
        self.assertAlmostEqual(salida["volumen_catia"]["mango_mal_1"], VOL_B123D["mango_mal_1"], places=3)
        salida["ok"] = jc.comparar(salida)          # como correr_ejercicio: llena diferencia_mm3
        jc.escribir(tmp, salida)
        s = ej.cerrar_con_controles(tmp)
        self.assertFalse(s["ok"])
        self.assertIn("mango_mal_1: el control dio verde y tenia que dar rojo", s["error"])

    def test_sin_activity_vuelve_a_inactivar_y_lo_dice(self):
        ej, jc, reg, salida, docs, tmp = self.correr_falso(con_actividad=False)
        mango = docs[0]
        self.assertEqual(mango.chk.Value, "Radio >= 1.5mm")
        self.assertEqual(len(mango.inactivos), 2)
        self.assertIn("limite_control_mango", salida)
        self.assertEqual(salida["controles"]["mango_mal_1"]["control_cumple"], False)

    def test_juez_rojo_si_una_variante_no_tiene_cruce(self):
        ej, jc, reg, salida, docs, tmp = self.correr_falso(sin_medir="nido_mal_2")
        salida["ok"] = jc.comparar(salida)          # comparar solo mira lo que midio build123d: da verde igual
        self.assertTrue(salida["ok"])
        jc.escribir(tmp, salida)
        s = ej.cerrar_con_controles(tmp)
        self.assertFalse(s["ok"])
        self.assertIn("nido_mal_2 sin cruce de build123d", s["error"])

    def test_juez_rojo_si_falta_un_control(self):
        ej, jc, reg, salida, docs, tmp = self.correr_falso()
        salida["ok"] = jc.comparar(salida)          # como correr_ejercicio: llena diferencia_mm3
        salida["controles"].pop("nido_mal_2")
        jc.escribir(tmp, salida)
        s = ej.cerrar_con_controles(tmp)
        self.assertFalse(s["ok"])
        self.assertIn("nido_mal_2: el control no se leyo", s["error"])


if __name__ == "__main__":
    unittest.main()
