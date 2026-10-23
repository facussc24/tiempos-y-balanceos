"""Tests del control de voladizos ANTES de laminar (gate 3a del 23/10/2026; casos A0 a A12 de casos_gates_3a_3b.md).

Corren con el Python del sistema, como los demas de la carpeta: python -m unittest discover -s .claude/skills/impresion-3d-bambu/tests
- La medicion corre en el Python del 3D (.venv-cad) por subproceso; sin el, los casos que miden se saltean y lo dicen.
- laminar_bambu.py corre con BAMBU_STUDIO_EXE = tests/laminador_juguete.py: NUNCA se abre Bambu Studio de verdad ni
  se manda nada a la impresora. Los perfiles de Bambu Studio de esta PC se LEEN (sin ellos, esos casos se saltean).
- Las piezas sinteticas son 3MF chicos armados a mano (zipfile + XML): una caja, un puente de 8 mm, una T.
- La placa v4 real del 22/10 se usa si esta en la nube; si no, esos casos se saltean con aviso.
- Lo que escribe (carpetas, registro) va a la carpeta temporal de _base (BAMBU_PRUEBA=1).
"""
import json
import os
import subprocess
import sys
import unittest
import zipfile
from datetime import date
from pathlib import Path

import _base
from _base import registro
import voladizos_3mf as vz

LAMINAR = _base.SCRIPTS / "laminar_bambu.py"
JUGUETE = _base.AQUI / "laminador_juguete.py"
IMPRIMIR_PIEZA = _base.SCRIPTS / "imprimir_pieza.py"
PROBETA = (Path(os.environ["USERPROFILE"]) / "BARACK ARGENTINA SRL" / "Ingeniería y Proyecto - General"
           / "INGENIERIA BARACK (NUNCA BORRAR)" / "1- GENERAL" / "5. 3D" / "VWA" / "PATAGONIA - PLANTILLA PERFORADO INSERT"
           / "v3 - 2026-10-21 - alineada a la costura (concepto)" / "Probeta plaquitas intercambiables (22-10)")
V4 = PROBETA / "_VIEJO - no usar" / "PLACA PROBETA v4 - plaquitas en el punto nuevo + 6 bujes + 3 porta-bulones.3mf"
V5 = PROBETA / "PLACA v5 - 3 plaquitas (agujero 7,1, cubo alto, hilera de adentro) + 3 porta-bulones (1h38 51g).gcode.3mf"
FRASE = "Fak 23/10: placa de prueba sin soportes, la asumo"
PY3D, _SIN_PY3D = vz.python_del_3d()
PERFILES = Path(os.environ["APPDATA"]) / "BambuStudio" / "system" / "BBL" / "machine" / "Bambu Lab A2L 0.4 nozzle.json"


# ---------------- piezas sinteticas: prismas armados a mano ----------------
def _triangular(pol):
    """Orejas (ear clipping) de un poligono simple, en sentido antihorario."""
    n = len(pol)
    idx = list(range(n))
    if sum(pol[i][0] * pol[(i + 1) % n][1] - pol[(i + 1) % n][0] * pol[i][1] for i in range(n)) < 0:
        idx.reverse()

    def a2(a, b, c):
        return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])

    tris = []
    while len(idx) > 3:
        for k in range(len(idx)):
            i0, i1, i2 = idx[k - 1], idx[k], idx[(k + 1) % len(idx)]
            a, b, c = pol[i0], pol[i1], pol[i2]
            if a2(a, b, c) <= 1e-9:
                continue
            if any(a2(a, b, pol[j]) >= 0 and a2(b, c, pol[j]) >= 0 and a2(c, a, pol[j]) >= 0
                   for j in idx if j not in (i0, i1, i2)):
                continue
            tris.append((i0, i1, i2))
            idx.pop(k)
            break
        else:
            raise ValueError("no se pudo triangular")
    tris.append(tuple(idx))
    return tris


def prisma_xz(pol, y0, y1):
    """Poligono en el plano XZ (x, z) estirado en Y de y0 a y1 -> (vertices, caras) con normales hacia afuera."""
    n = len(pol)
    V = [(x, y0, z) for x, z in pol] + [(x, y1, z) for x, z in pol]
    F = []
    for a, b, c in _triangular(pol):
        F.append((a, b, c))
        F.append((a + n, c + n, b + n))
    for i in range(n):
        j = (i + 1) % n
        F.append((j, i, i + n))
        F.append((j, i + n, j + n))
    vol = sum(V[a][0] * (V[b][1] * V[c][2] - V[b][2] * V[c][1]) - V[a][1] * (V[b][0] * V[c][2] - V[b][2] * V[c][0])
              + V[a][2] * (V[b][0] * V[c][1] - V[b][1] * V[c][0]) for a, b, c in F) / 6
    if vol < 0:
        F = [(a, c, b) for a, b, c in F]
    return V, F


CAJA = prisma_xz([(-10, 0), (10, 0), (10, 10), (-10, 10)], -10, 10)                      # 20 x 20 x 10
PUENTE_8 = prisma_xz([(-15, 0), (-4, 0), (-4, 10), (4, 10), (4, 0), (15, 0), (15, 12), (-15, 12)], -5, 5)
T_ARRIBA = prisma_xz([(-3, 0), (3, 0), (3, 10), (10, 10), (10, 13), (-10, 13), (-10, 10), (-3, 10)], -3, 3)
DADA_VUELTA_X = "1 0 0 0 -1 0 0 0 -1 0 0 13"        # 180 grados en X (vector fila) y subida de 13 mm


def tmf(ruta, objetos):
    """3MF chico a mano: objetos = [(nombre, (V, F), transform o None)]; un item del build por objeto."""
    res, build = [], []
    for i, (nombre, (V, F), tr) in enumerate(objetos, start=1):
        vs = "".join(f'<vertex x="{x}" y="{y}" z="{z}"/>' for x, y, z in V)
        ts = "".join(f'<triangle v1="{a}" v2="{b}" v3="{c}"/>' for a, b, c in F)
        res.append(f'<object id="{i}" name="{nombre}" type="model"><mesh><vertices>{vs}</vertices>'
                   f'<triangles>{ts}</triangles></mesh></object>')
        build.append(f'<item objectid="{i}"' + (f' transform="{tr}"' if tr else "") + "/>")
    modelo = ('<?xml version="1.0" encoding="UTF-8"?><model unit="millimeter" '
              'xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"><resources>' + "".join(res)
              + "</resources><build>" + "".join(build) + "</build></model>")
    with zipfile.ZipFile(ruta, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.'
                   'openxmlformats.org/package/2006/content-types"><Default Extension="model" ContentType="application/'
                   'vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>')
        z.writestr("_rels/.rels", '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.'
                   'openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" '
                   'Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>')
        z.writestr("3D/3dmodel.model", modelo)
    return Path(ruta)


def correr(args, **env):
    """laminar_bambu.py con el laminador de juguete; -> (codigo, salida)."""
    e = {**os.environ, "BAMBU_STUDIO_EXE": str(JUGUETE), "PYTHONIOENCODING": "utf-8", **env}
    r = subprocess.run([sys.executable, str(LAMINAR)] + [str(x) for x in args], capture_output=True, text=True,
                       encoding="utf-8", errors="replace", env=e, timeout=600)
    return r.returncode, r.stdout + r.stderr


def solo(pieza, **env):
    """--solo-voladizos: (codigo, medida JSON, texto)."""
    rc, out = correr(["--solo-voladizos", pieza], **env)
    lineas = [x for x in out.splitlines() if x.startswith("{")]
    return rc, (json.loads(lineas[-1]) if lineas else {}), out


def parte(med, nombre):
    return next(p for p in med["partes"] if p["parte"] == nombre)


ROJA = {"veredicto": "freno", "medidas": 1, "de": 1, "segundos": 2.0, "faltan": [], "partes": [
    {"parte": "geometry_9", "objeto": "10", "veredicto": "freno", "dfam_mm2": 74.44,
     "voladizos2": {"voto": "OJO", "voladizo_mm": 3.7, "puente_mm": 8.1, "z_mm": 4.5},
     "dfam": {"voto": "ROJO", "umbral_mm2": 40.0}}]}


class A0Puro(unittest.TestCase):
    """Sin medir nada: la matriz del 3MF, la fecha de corte y la regla de votos (A3, A4, A6, A8, A11 en puro)."""

    def test_matriz_del_3mf_no_queda_traspuesta(self):
        m = vz.matriz("0 1 0 -1 0 0 0 0 1 10 20 30")
        self.assertEqual(vz.aplicar(m, (1, 0, 0)), (10, 21, 30))
        self.assertEqual(vz.aplicar(vz.matriz(""), (1, 2, 3)), (1, 2, 3))

    def test_fechas_aviso_hasta_el_30_inclusive_y_freno_desde_el_31(self):
        for dia, estado, sigue in ((date(2026, 10, 23), "aviso", True), (date(2026, 10, 30), "aviso", True),
                                   (date(2026, 10, 31), "FRENO", False), (date(2026, 11, 15), "FRENO", False)):
            d = vz.decidir(ROJA, dia)
            self.assertEqual((d["estado"], d["sigue"]), (estado, sigue), dia)
        d = vz.decidir(ROJA, date(2026, 10, 31))
        t = "\n".join(d["texto"])
        for x in ("FRENO", "geometry_9", "3,7", "z 4,5", "74,4", "enable_support=1", "--acepto-voladizos", "rotar"):
            self.assertIn(x, t)

    def test_canon_y_fecha_de_hoy(self):
        c = vz.canon()
        self.assertEqual(c["aviso_hasta"], "2026-10-30")
        self.assertEqual(c["dfam"]["umbral_mm2"], 40)
        self.assertFalse(c["dfam"]["puede_frenar"])
        viejo = os.environ.get("BAMBU_HOY")
        try:
            os.environ["BAMBU_HOY"] = "2026-10-31"
            self.assertEqual(vz.hoy(), date(2026, 10, 31))
        finally:
            os.environ.pop("BAMBU_HOY") if viejo is None else os.environ.__setitem__("BAMBU_HOY", viejo)

    def test_dfam_solo_nunca_frena(self):
        med = {"veredicto": "aviso", "partes": [{"parte": "puente", "veredicto": "aviso", "dfam_mm2": 80.0,
                                                 "voladizos2": {"voto": "OK"}, "dfam": {"voto": "ROJO"}}]}
        d = vz.decidir(med, date(2026, 11, 15))
        self.assertEqual((d["estado"], d["sigue"]), ("aviso informativo", True))

    def test_no_medido_nunca_es_verde(self):
        med = vz.no_medido("x.3mf", "falta trimesh")
        self.assertEqual(vz.codigo(med), 2)
        self.assertEqual(vz.decidir(med, date(2026, 10, 30))["estado"], "aviso")
        self.assertEqual(vz.decidir(med, date(2026, 10, 31))["estado"], "FRENO")
        self.assertIn("NO MEDIDO: falta trimesh", "\n".join(vz.decidir(med, date(2026, 10, 31))["texto"]))

    def test_acepto_con_frase_y_se_niega_sin_frase(self):
        d = vz.decidir(ROJA, date(2026, 10, 31), acepto=FRASE)
        self.assertEqual((d["estado"], d["sigue"], d["frase"]), ("aceptado", True, FRASE))
        for mala in (None, "", "si", "ok dale", "         x"):
            self.assertFalse(vz.frase_valida(mala), mala)
            self.assertEqual(vz.decidir(ROJA, date(2026, 10, 31), acepto=mala)["estado"], "FRENO", mala)

    def test_soportes_pedidos_da_verde_con_nota(self):
        d = vz.decidir(ROJA, date(2026, 10, 31), ajustes=["wall_loops=3", "enable_support=1"])
        self.assertEqual((d["estado"], d["sigue"]), ("OK con soportes", True))
        self.assertIn("soportes activados", d["texto"][0])
        self.assertEqual(vz.decidir(ROJA, date(2026, 10, 31), ajustes=["enable_support=0"])["estado"], "FRENO")


@unittest.skipIf(PY3D is None, f"sin el Python del 3D: {_SIN_PY3D}")
class A1aA9Sinteticas(unittest.TestCase):
    """--solo-voladizos sobre 3MF chicos: caja, puente de 8 mm, T derecha y dada vuelta, varias partes, tiempo, entorno."""

    @classmethod
    def setUpClass(cls):
        cls.tmp = _base.carpeta_nueva("voladizos_sint")
        cls.caja = tmf(cls.tmp / "caja.3mf", [("caja", CAJA, None)])
        cls.puente = tmf(cls.tmp / "puente_8.3mf", [("puente_8", PUENTE_8, None)])
        cls.t = tmf(cls.tmp / "t.3mf", [("t_derecha", T_ARRIBA, None)])
        cls.t_vuelta = tmf(cls.tmp / "t_vuelta.3mf", [("t_dada_vuelta", T_ARRIBA, DADA_VUELTA_X)])
        cls.varias = tmf(cls.tmp / "varias.3mf", [("caja_1", CAJA, "1 0 0 0 1 0 0 0 1 -40 0 0"),
                                                  ("t_derecha", T_ARRIBA, None),
                                                  ("caja_2", CAJA, "1 0 0 0 1 0 0 0 1 40 0 0")])

    def test_a1_caja_sana_verde_con_los_dos_votos(self):
        rc, med, out = solo(self.caja)
        self.assertEqual(rc, 0, out)
        p = parte(med, "caja")
        self.assertEqual(p["veredicto"], "verde")
        self.assertEqual(p["voladizos2"]["voto"], "OK")
        self.assertEqual(p["dfam"]["voto"], "OK")
        self.assertIsNotNone(p["voladizos2"]["puente_mm"])
        self.assertLess(p["dfam_mm2"], 1.0)
        self.assertIn("VOLADIZOS: OK", out)

    def test_a4_puente_de_8_mm_dfam_rojo_y_voladizos2_ok_es_aviso(self):
        rc, med, out = solo(self.puente)
        self.assertEqual(rc, 0, out)
        p = parte(med, "puente_8")
        self.assertEqual(p["voladizos2"]["voto"], "OK", out)
        self.assertAlmostEqual(p["voladizos2"]["puente_mm"], 8.0, delta=0.6)
        self.assertEqual(p["dfam"]["voto"], "ROJO")
        self.assertAlmostEqual(p["dfam_mm2"], 80.0, delta=1.0)
        self.assertEqual(p["veredicto"], "aviso")
        d = vz.decidir(med, date(2026, 10, 31))
        self.assertEqual((d["estado"], d["sigue"]), ("aviso informativo", True))

    def test_a5_la_orientacion_del_3mf_se_aplica_antes_de_medir(self):
        rc, med, out = solo(self.t)
        self.assertEqual(rc, 1, out)
        p = parte(med, "t_derecha")
        self.assertEqual(p["voladizos2"]["voto"], "OJO")
        self.assertAlmostEqual(p["voladizos2"]["voladizo_mm"], 7.0, delta=0.6)
        rc, med, out = solo(self.t_vuelta)
        self.assertEqual(rc, 0, out)
        self.assertEqual(parte(med, "t_dada_vuelta")["voladizos2"]["voto"], "OK", out)

    def test_a7_cada_parte_con_su_voto_y_un_rojo_entre_verdes_dispara(self):
        rc, med, out = solo(self.varias)
        self.assertEqual(rc, 1, out)
        self.assertEqual(med["de"], 3)
        self.assertEqual({p["parte"]: p["veredicto"] for p in med["partes"]},
                         {"caja_1": "verde", "t_derecha": "freno", "caja_2": "verde"})
        self.assertEqual(parte(med, "caja_2").get("igual_a"), "caja_1")     # misma malla: se mide una vez

    def test_a8_tiempo_agotado_queda_no_medido_nunca_verde(self):
        rc, med, out = solo(self.t, BAMBU_VOLADIZOS_TOPE="0.5")
        self.assertEqual(rc, 2, out)
        self.assertEqual(med["veredicto"], "no_medido")
        self.assertIn("TIEMPO AGOTADO", out)
        self.assertEqual(med["faltan"], ["t_derecha"])
        self.assertEqual(vz.decidir(med, date(2026, 10, 30))["estado"], "aviso")
        self.assertEqual(vz.decidir(med, date(2026, 10, 31))["estado"], "FRENO")

    @unittest.skipIf(__import__("importlib").util.find_spec("trimesh") is not None,
                     "este Python tiene trimesh: no sirve para probar el entorno sin trimesh")
    def test_a9_python_sin_trimesh_dice_que_falta(self):
        rc, med, out = solo(self.caja, BAMBU_PY_CAD=sys.executable)
        self.assertEqual(rc, 2, out)
        self.assertEqual(med["veredicto"], "no_medido")
        self.assertRegex(med["motivo"], r"falta (numpy|trimesh|shapely)")

    def test_a9_sin_python_del_3d_sin_script_o_sin_dfam(self):
        rc, med, out = solo(self.caja, BAMBU_PY_CAD=str(self.tmp / "no_existe" / "python.exe"))
        self.assertEqual((rc, med["veredicto"]), (2, "no_medido"), out)
        self.assertIn("falta el Python del 3D", med["motivo"])
        rc, med, out = solo(self.caja, BAMBU_VOLADIZOS2=str(self.tmp / "no_existe.py"))
        self.assertEqual((rc, med["veredicto"]), (2, "no_medido"), out)
        self.assertIn("falta chequeo_voladizos2.py", parte(med, "caja")["voladizos2"]["motivo"])
        rc, med, out = solo(self.caja, BAMBU_DFAM=str(self.tmp / "no_existe_dfam.py"))
        self.assertEqual(rc, 0, out)
        p = parte(med, "caja")
        self.assertEqual((p["veredicto"], p["dfam"]["voto"]), ("aviso", "NO MEDIDO"))
        self.assertIn("dfam NO MEDIDO", out)


@unittest.skipIf(PY3D is None, f"sin el Python del 3D: {_SIN_PY3D}")
@unittest.skipIf(not PERFILES.exists(), f"sin los perfiles de Bambu Studio de esta PC ({PERFILES})")
class A0A6A10A11Laminar(unittest.TestCase):
    """laminar_bambu.py entero con el laminador de juguete: el control corre antes de la carpeta y del laminador."""

    @classmethod
    def setUpClass(cls):
        cls.tmp = _base.carpeta_nueva("voladizos_laminar")
        cls.reg = _base.apuntar(cls.tmp)
        cls.caja = tmf(cls.tmp / "caja.3mf", [("caja", CAJA, None)])
        cls.t = tmf(cls.tmp / "t.3mf", [("t_derecha", T_ARRIBA, None)])
        cls.puente = tmf(cls.tmp / "puente_8.3mf", [("puente_8", PUENTE_8, None)])

    def lam(self, pieza, carpeta, *extra, hoy="2026-10-31"):
        return correr([pieza, carpeta, "--filamento", "Bambu PLA Lite", *extra], BAMBU_HOY=hoy,
                      BAMBU_REGISTRO=str(self.reg))

    def test_a0_a10_freno_antes_de_todo_y_reintento_con_frase_en_la_misma_carpeta(self):
        out_dir = self.tmp / "a0_t"
        rc, out = self.lam(self.t, out_dir)
        self.assertEqual(rc, 1, out)
        self.assertIn("FRENO", out)
        for x in ("enable_support=1", "--acepto-voladizos", "rotar", "t_derecha"):
            self.assertIn(x, out)
        self.assertFalse(out_dir.exists(), "el freno tiene que correr antes de crear la carpeta")
        # A10 + A6: el mismo comando con la frase de Fak, en la misma carpeta
        rc, out = self.lam(self.t, out_dir, "--acepto-voladizos", FRASE)
        self.assertEqual(rc, 0, out)
        self.assertTrue((out_dir / "llamado.txt").exists(), "tenia que llegar al laminador")
        res = json.loads((out_dir / "resumen.json").read_text(encoding="utf-8"))
        v = res["voladizos"]
        self.assertEqual((v["estado"], v["frase"], v["hoy"]), ("aceptado", FRASE, "2026-10-31"))
        self.assertEqual(v["partes"][0]["parte"], "t_derecha")
        self.assertAlmostEqual(v["partes"][0]["voladizos2"]["voladizo_mm"], 7.0, delta=0.6)
        ev = [e for e in registro.leer() if e.get("tipo") == "voladizos aceptados"]
        self.assertTrue(any(e["frase"] == FRASE and e["partes"][0]["parte"] == "t_derecha" for e in ev), ev)
        self.assertFalse([m for n, e, m in registro.validar() if n == "ROJO" and e.get("tipo") == "voladizos aceptados"])

    def test_a6_se_niega_sin_frase_o_con_frase_corta(self):
        for mala in ("", "si", "ok dale"):
            out_dir = self.tmp / f"a6_{len(mala)}"
            rc, out = self.lam(self.t, out_dir, "--acepto-voladizos", mala)
            self.assertEqual(rc, 1, out)
            self.assertIn("NO SE LAMINA", out)
            self.assertFalse(out_dir.exists())
        rc, out = self.lam(self.t, self.tmp / "a6_sin_valor", "--acepto-voladizos")
        self.assertEqual(rc, 2, out)             # argparse: la bandera sin valor no pasa
        self.assertFalse((self.tmp / "a6_sin_valor").exists())

    def test_a1_caja_sana_lamina_y_queda_ok_en_resumen(self):
        out_dir = self.tmp / "a1_caja"
        rc, out = self.lam(self.caja, out_dir)
        self.assertEqual(rc, 0, out)
        self.assertIn("VOLADIZOS: OK", out)
        res = json.loads((out_dir / "resumen.json").read_text(encoding="utf-8"))
        self.assertEqual(res["voladizos"]["estado"], "OK")
        self.assertEqual(res["voladizos"]["partes"][0]["voladizos2"]["voto"], "OK")

    def test_a2_a12_aviso_hoy_lamina_y_el_aviso_queda_al_final_y_en_el_archivo(self):
        out_dir = self.tmp / "a2_t_hoy"
        rc, out = self.lam(self.t, out_dir, hoy="2026-10-23")
        self.assertEqual(rc, 0, out)
        self.assertTrue((out_dir / "llamado.txt").exists())
        self.assertIn("AVISO", out[-1800:])          # imprimir_pieza.py muestra solo los ultimos 1800 caracteres
        self.assertIn("t_derecha", out[-1800:])
        res = json.loads((out_dir / "resumen.json").read_text(encoding="utf-8"))
        self.assertEqual(res["voladizos"]["estado"], "aviso")
        aviso = vz.aviso_de_carpeta(out_dir)
        self.assertIn("AVISO", aviso)
        self.assertIn("voladizo 7,0", aviso)

    def test_a4_puente_de_8_mm_lamina_tambien_el_31(self):
        out_dir = self.tmp / "a4_puente"
        rc, out = self.lam(self.puente, out_dir)
        self.assertEqual(rc, 0, out)
        res = json.loads((out_dir / "resumen.json").read_text(encoding="utf-8"))
        self.assertEqual(res["voladizos"]["estado"], "aviso informativo")

    def test_a11_soportes_pedidos_lamina_con_nota(self):
        out_dir = self.tmp / "a11_t_soportes"
        rc, out = self.lam(self.t, out_dir, "--ajuste", "enable_support=1")
        self.assertEqual(rc, 0, out)
        self.assertIn("soportes activados", out)
        self.assertEqual(json.loads((out_dir / "_perfiles" / "proceso.json").read_text(encoding="utf-8"))
                         ["enable_support"], "1")
        res = json.loads((out_dir / "resumen.json").read_text(encoding="utf-8"))
        self.assertEqual(res["voladizos"]["estado"], "OK con soportes")


class A12ImprimirPieza(unittest.TestCase):
    """imprimir_pieza.py muestra el aviso leyendo el archivo, no la cola de la salida."""

    def test_lee_el_aviso_del_archivo(self):
        c = _base.carpeta_nueva("a12")
        (c / "voladizos.json").write_text(json.dumps(vz.decidir(ROJA, date(2026, 10, 23))), encoding="utf-8")
        self.assertIn("AVISO", vz.aviso_de_carpeta(c))
        (c / "voladizos.json").write_text(json.dumps({"estado": "OK", "texto": ["VOLADIZOS: OK"]}), encoding="utf-8")
        self.assertIsNone(vz.aviso_de_carpeta(c))
        self.assertIsNone(vz.aviso_de_carpeta(_base.carpeta_nueva("a12_vacia")))

    def test_imprimir_pieza_lo_llama_despues_de_la_cola_y_antes_de_cortar(self):
        s = IMPRIMIR_PIEZA.read_text(encoding="utf-8")
        i_cola, i_aviso, i_corte = s.index("r.stdout[-1800:]"), s.index("vz.aviso_de_carpeta"), s.index("if r.returncode != 0")
        self.assertLess(i_cola, i_aviso)
        self.assertLess(i_aviso, i_corte)


@unittest.skipIf(PY3D is None, f"sin el Python del 3D: {_SIN_PY3D}")
@unittest.skipIf(not V4.exists(), f"AVISO: no esta la placa v4 real en la nube ({V4}); se saltean A2, A3 y A7 reales")
class A2A3A7PlacaReal(unittest.TestCase):
    """La placa v4 del 22/10 (12 objetos) y la v5 .gcode.3mf (6 partes con componentes y transform), medidas una vez."""

    @classmethod
    def setUpClass(cls):
        cls.rc4, cls.v4, cls.out4 = solo(V4)
        cls.rc5, cls.v5, cls.out5 = solo(V5) if V5.exists() else (None, None, "")

    def test_a2_porta_bulones_rojos_con_partes_y_numeros(self):
        self.assertEqual(self.rc4, 1, self.out4[-2000:])
        self.assertEqual(self.v4["de"], 12)
        self.assertEqual(self.v4["medidas"], 12, self.v4.get("faltan"))
        for n in ("geometry_9", "geometry_10", "geometry_11"):
            p = parte(self.v4, n)
            self.assertEqual(p["veredicto"], "freno")
            self.assertAlmostEqual(p["voladizos2"]["voladizo_mm"], 3.7, delta=0.05)
            self.assertAlmostEqual(p["voladizos2"]["puente_mm"], 8.1, delta=0.05)
            self.assertAlmostEqual(p["dfam_mm2"], 74.44, delta=0.5)
        d = vz.decidir(self.v4, date(2026, 10, 23))
        self.assertEqual((d["estado"], d["sigue"]), ("aviso", True))
        t = "\n".join(d["texto"])
        for x in ("geometry_9", "geometry_10", "geometry_11", "voladizo 3,7", "puente 8,1", "z 4,5", "74,4"):
            self.assertIn(x, t)

    def test_a3_misma_placa_con_fechas_simuladas(self):
        self.assertEqual(vz.decidir(self.v4, date(2026, 10, 30))["estado"], "aviso")
        for dia in (date(2026, 10, 31), date(2026, 11, 15)):
            d = vz.decidir(self.v4, dia)
            self.assertEqual((d["estado"], d["sigue"]), ("FRENO", False), dia)
            self.assertIn("--acepto-voladizos", "\n".join(d["texto"]))

    def test_a7_v4_bujes_verdes_plaquitas_y_porta_bulones_rojos(self):
        ver = {p["parte"]: p["veredicto"] for p in self.v4["partes"]}
        for n in ("geometry_3", "geometry_4", "geometry_5", "geometry_6", "geometry_7", "geometry_8"):
            self.assertEqual(ver[n], "verde", n)
        self.assertEqual(sum(1 for n, v in ver.items() if n.startswith("PLAQUITA") and v == "freno"), 3)

    @unittest.skipIf(not V5.exists(), "AVISO: no esta el .gcode.3mf de la placa v5")
    def test_a7_v5_gcode_3mf_con_componentes_y_transform(self):
        self.assertEqual(self.v5["de"], 6, self.out5[-2000:])
        self.assertEqual(self.v5["medidas"], 6, self.v5.get("faltan"))
        nombres = {p["parte"] for p in self.v5["partes"]}
        self.assertIn("PLAQUITA PRUEBA 2 - pines 12,4 y 10,4 (2 muescas).stl", nombres)    # de model_settings.config
        for p in self.v5["partes"]:
            if p["parte"].startswith("PLAQUITA"):
                self.assertEqual(p["veredicto"], "freno", p["parte"])
            else:                   # porta-bulon con tapita (v5): voladizos2 OK, dfam ~108 -> solo aviso
                self.assertEqual(p["voladizos2"]["voto"], "OK", p["parte"])
                self.assertEqual(p["veredicto"], "aviso", p["parte"])
                self.assertAlmostEqual(p["dfam_mm2"], 108.6, delta=1.5)


if __name__ == "__main__":
    unittest.main()
