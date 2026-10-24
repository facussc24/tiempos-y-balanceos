# -*- coding: utf-8 -*-
"""Prueba EN SECO del obrero de CATIA (sin abrir CATIA, sin pywin32).

Corre con: C:/Dev/BarackMercosul/.venv-cad/Scripts/python.exe -I -m unittest discover -s scripts/catia/tests -t scripts/catia
Arma una COLA 3D en una carpeta temporal, deja asignados (bueno, de otra PC, roto, ejercicio que no existe, uno ya hecho)
y corre el obrero de verdad como subproceso con --una-vuelta. Los ejercicios que «no arrancan CATIA» y «se pasan del
tiempo» son scripts de verdad escritos en la carpeta temporal (declarados sin CATIA: en esta PC hay una CATIA abierta
que no es del obrero y el obrero, con razon, no correria nada que la use).
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
import unittest

AQUI = os.path.dirname(os.path.abspath(__file__))
CATIA_DIR = os.path.dirname(AQUI)
OBRERO = os.path.join(CATIA_DIR, "obrero.py")
EJERCICIOS = os.path.join(CATIA_DIR, "ejercicios")
if CATIA_DIR not in sys.path:
    sys.path.insert(0, CATIA_DIR)

import obrero  # noqa: E402


def foto(carpeta):
    """Nombre, tamano, fecha y contenido de cada archivo: para probar que asignados\\ queda igual."""
    out = {}
    for n in sorted(os.listdir(carpeta)):
        r = os.path.join(carpeta, n)
        with open(r, "rb") as f:
            out[n] = (os.path.getsize(r), os.path.getmtime(r), f.read())
    return out


def leer(ruta):
    with open(ruta, encoding="utf-8") as f:
        return json.load(f)


class Base(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix="obrero-prueba-")
        self.cola = os.path.join(self.tmp, "COLA 3D")
        self.asig = os.path.join(self.cola, "asignados")
        self.local = os.path.join(self.tmp, "local")
        os.makedirs(self.asig)

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def asignar(self, nombre, dato):
        with open(os.path.join(self.asig, nombre), "w", encoding="utf-8") as f:
            f.write(dato if isinstance(dato, str) else json.dumps(dato))

    def correr(self, *extra, ejercicios=EJERCICIOS, host="PRUEBA"):
        cmd = [sys.executable, "-I", OBRERO, "--cola", self.cola, "--hostname", host, "--una-vuelta", "--ram-min-gb", "0", "--local",
               self.local, "--ejercicios", ejercicios, "--edad-min-seg", "0", "--reintentos-lectura", "2",
               "--espera-lectura", "0", "--espera-reintento-catia", "0", *extra]
        r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=180)
        return r

    def mia(self, *p):
        return os.path.join(self.cola, "PRUEBA", *p)


class CicloEnSeco(Base):
    def test_ciclo_entero(self):
        self.asignar("t001-PRUEBA.txt", {"item": "t001", "ejercicio": "00_prueba_sin_catia",
                                         "instrucciones": "prueba en seco", "asignado": "2026-10-23 15:00"})
        self.asignar("t002-OTRAPC.txt", {"item": "t002", "ejercicio": "00_prueba_sin_catia", "instrucciones": "",
                                         "asignado": "2026-10-23 15:00"})
        self.asignar("t003-PRUEBA.txt", '{"item": "t003", "ejercicio": ')          # JSON roto
        self.asignar("t004-PRUEBA.txt", {"item": "t004", "ejercicio": "99_no_existe"})
        self.asignar("t005-prueba.txt", {"item": "t005", "ejercicio": "00_prueba_sin_catia"})   # host en minusculas
        self.asignar("t000-PRUEBA.txt", {"item": "t000", "ejercicio": "00_prueba_sin_catia"})
        self.asignar("t0005-PRUEBA.txt", {"item": "t0005", "ejercicio": "00_prueba_sin_catia", "hostname": "OTRAPC"})
        os.makedirs(self.mia())
        with open(self.mia("resultado-t000.txt"), "w", encoding="utf-8") as f:
            f.write('{"estado": "ok", "de": "antes"}')
        antes = foto(self.asig)

        r = self.correr()
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)

        res = leer(self.mia("resultado-t001.txt"))
        self.assertTrue(res["ok"], res)
        self.assertEqual(res["estado"], "ok")
        self.assertEqual(res["hostname"], "PRUEBA")
        self.assertEqual(res["version_obrero"], obrero.VERSION)
        for k in ("inicio", "fin", "segundos"):
            self.assertIn(k, res)
        self.assertEqual(res["salida"]["medidas"]["volumen_caja_mm3"], 48000.0)
        self.assertNotIn("stderr_ultimas_40", res)
        copiados = {c["archivo"] for c in res["archivos_copiados"]}
        self.assertEqual(copiados, {"prueba_100x100.png", "salida.json"})
        with open(self.mia("t001", "prueba_100x100.png"), "rb") as f:
            self.assertEqual(f.read(8), b"\x89PNG\r\n\x1a\n")

        self.assertFalse(os.path.exists(self.mia("resultado-t002.txt")), "tomo un asignado de otra PC")
        self.assertFalse(os.path.exists(os.path.join(self.cola, "OTRAPC")))
        self.assertFalse(os.path.exists(self.mia("resultado-t0005.txt")), "tomo uno que dice hostname de otra PC")

        roto = leer(self.mia("resultado-t003.txt"))
        self.assertFalse(roto["ok"])
        self.assertIn("JSON invalido", roto["error"])

        noexiste = leer(self.mia("resultado-t004.txt"))
        self.assertFalse(noexiste["ok"])
        self.assertIn("99_no_existe", noexiste["error"])

        self.assertTrue(leer(self.mia("resultado-t005.txt"))["ok"])
        self.assertEqual(leer(self.mia("resultado-t000.txt")), {"estado": "ok", "de": "antes"}, "volvio a correr uno hecho")

        lat = leer(self.mia("latido.json"))
        for k in ("hora", "item_en_curso", "ram_libre_gb", "catia_abierta", "version_obrero", "hostname"):
            self.assertIn(k, lat)
        self.assertEqual(lat["hostname"], "PRUEBA")
        self.assertIsNone(lat["item_en_curso"])
        with open(self.mia("obrero.log"), encoding="utf-8") as f:
            log = f.read()
        self.assertIn("t001: OK", log)
        self.assertIn("t003: ERROR", log)
        self.assertEqual(foto(self.asig), antes, "asignados\\ cambio: el obrero no puede renombrar ni borrar nada ahi")
        self.assertTrue({"latido.json", "obrero.log", "resultado-t001.txt", "t001"} <= set(os.listdir(self.mia())))
        self.assertFalse([n for n in os.listdir(self.mia()) if n.endswith(".escribiendo")])

        r2 = self.correr()                         # segunda vuelta: nada nuevo, no se repite nada
        self.assertEqual(r2.returncode, 0, r2.stdout + r2.stderr)
        self.assertEqual(leer(self.mia("resultado-t001.txt"))["inicio"], res["inicio"])

    def test_modo_continuo_procesa_y_sigue_mirando(self):
        """Como corre en la notebook (sin --una-vuelta): uno que no se toma no tapa la cola y el obrero queda vivo."""
        self.asignar("a001-PRUEBA.txt", {"item": "a001", "ejercicio": "00_prueba_sin_catia", "hostname": "OTRAPC"})
        self.asignar("a002-PRUEBA.txt", {"item": "a002", "ejercicio": "00_prueba_sin_catia"})
        cmd = [sys.executable, "-I", OBRERO, "--cola", self.cola, "--hostname", "PRUEBA", "--ram-min-gb", "0", "--local", self.local,
               "--edad-min-seg", "0", "--espera-seg", "1", "--espera-lectura", "0"]
        p = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        try:
            t0 = time.time()
            while time.time() - t0 < 60 and not os.path.exists(self.mia("resultado-a002.txt")):
                time.sleep(0.5)
            self.assertTrue(os.path.exists(self.mia("resultado-a002.txt")), "el modo continuo no proceso el pendiente")
            self.asignar("a003-PRUEBA.txt", {"item": "a003", "ejercicio": "00_prueba_sin_catia"})
            while time.time() - t0 < 90 and not os.path.exists(self.mia("resultado-a003.txt")):
                time.sleep(0.5)
            self.assertTrue(os.path.exists(self.mia("resultado-a003.txt")), "no tomo el que llego despues")
            self.assertIsNone(p.poll(), "el obrero se cerro solo")
            self.assertFalse(os.path.exists(self.mia("resultado-a001.txt")))
        finally:
            p.kill()
            p.wait()

    def test_poca_ram_espera_y_no_corre(self):
        self.asignar("r001-PRUEBA.txt", {"item": "r001", "ejercicio": "00_prueba_sin_catia"})
        r = self.correr("--ram-min-gb", "100000")
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertFalse(os.path.exists(self.mia("resultado-r001.txt")))
        lat = leer(self.mia("latido.json"))
        self.assertIn("RAM", r.stdout)
        self.assertIsNotNone(lat["ram_libre_gb"])

    def test_recien_llegado_se_deja_para_despues(self):
        self.asignar("n001-PRUEBA.txt", {"item": "n001", "ejercicio": "00_prueba_sin_catia"})
        cmd_extra = ("--edad-min-seg", "3600")
        r = subprocess.run([sys.executable, "-I", OBRERO, "--cola", self.cola, "--hostname", "PRUEBA", "--una-vuelta", "--ram-min-gb", "0",
                            "--local", self.local, *cmd_extra], capture_output=True, text=True, timeout=120)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertFalse(os.path.exists(self.mia("resultado-n001.txt")))


class EjerciciosQueFallan(Base):
    def ejercicio(self, nombre, cuerpo):
        d = os.path.join(self.tmp, "ejercicios", nombre)
        os.makedirs(d)
        with open(os.path.join(d, "catia.py"), "w", encoding="utf-8") as f:
            f.write(cuerpo)
        with open(os.path.join(d, "ejercicio.json"), "w", encoding="utf-8") as f:
            json.dump({"usa_catia": False}, f)
        return os.path.join(self.tmp, "ejercicios")

    def test_catia_no_arranca_tres_veces(self):
        ej = self.ejercicio("sin_catia", "import sys\nprint('CATIA no arranco (prueba)', file=sys.stderr)\nsys.exit(3)\n")
        self.asignar("c001-PRUEBA.txt", {"item": "c001", "ejercicio": "sin_catia"})
        self.asignar("c002-PRUEBA.txt", {"item": "c002", "ejercicio": "00_prueba_sin_catia"})
        shutil.copytree(os.path.join(EJERCICIOS, "00_prueba_sin_catia"), os.path.join(ej, "00_prueba_sin_catia"))
        r = self.correr("--intentos-catia", "3", ejercicios=ej)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        res = leer(self.mia("resultado-c001.txt"))
        self.assertFalse(res["ok"])
        self.assertEqual(res["codigo_salida"], 3)
        self.assertEqual(res["intentos"], 3)
        self.assertIn("CATIA no arranco en 3 intentos seguidos", res["error"])
        self.assertTrue(any("CATIA no arranco (prueba)" in x for x in res["stderr_ultimas_40"]))
        self.assertTrue(leer(self.mia("resultado-c002.txt"))["ok"], "despues de un error tiene que seguir con el proximo")

    def test_se_pasa_del_tiempo(self):
        ej = self.ejercicio("lento", "import time\ntime.sleep(60)\n")
        self.asignar("l001-PRUEBA.txt", {"item": "l001", "ejercicio": "lento"})
        t0 = time.time()
        r = self.correr("--timeout-seg", "3", ejercicios=ej)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertLess(time.time() - t0, 50)
        res = leer(self.mia("resultado-l001.txt"))
        self.assertFalse(res["ok"])
        self.assertIn("se paso del tiempo", res["error"])


class ReintentosCatia(Base):
    """Los 3 intentos con CATIA: el obrero real, con un ejercicio que declara usar CATIA y sale con 3. Solo se puede
    correr donde NO hay ninguna CATIA abierta (si hay una ajena, el obrero no corre nada y deja el item pendiente)."""

    def test_tres_intentos_y_sigue(self):
        import catia_base
        pids = catia_base.cnext_abiertos()
        d = os.path.join(self.tmp, "ejercicios", "sin_catia")
        os.makedirs(d)
        with open(os.path.join(d, "catia.py"), "w", encoding="utf-8") as f:
            f.write("import sys\nsys.exit(3)\n")
        with open(os.path.join(d, "ejercicio.json"), "w", encoding="utf-8") as f:
            json.dump({"usa_catia": True}, f)
        self.asignar("k001-PRUEBA.txt", {"item": "k001", "ejercicio": "sin_catia"})
        r = self.correr("--intentos-catia", "3", ejercicios=os.path.join(self.tmp, "ejercicios"))
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        if pids:                                   # hay una CATIA que no es del obrero: no corre y no la toca
            self.assertFalse(os.path.exists(self.mia("resultado-k001.txt")))
            self.assertIn("no la toco", r.stdout)
            return
        res = leer(self.mia("resultado-k001.txt"))
        self.assertEqual(res["intentos"], 3)
        self.assertIn("CATIA no arranco en 3 intentos", res["error"])


    def test_guarda_la_catia_de_la_corrida_aunque_borren_el_archivo(self):
        """apagar() borra mi_catia.json aunque CATIA no se haya ido: el obrero se queda con la copia que vio."""
        import catia_base
        pids = catia_base.cnext_abiertos()
        d = os.path.join(self.tmp, "ejercicios", "borra_estado")
        os.makedirs(d)
        with open(os.path.join(d, "catia.py"), "w", encoding="utf-8") as f:
            f.write("import json, os, sys, time\n"
                    "t = sys.argv[1]\n"
                    "json.dump({'pid': 999999, 'hora': 1, 'arranco': 'prueba'}, open(os.path.join(t, 'mi_catia.json'), 'w'))\n"
                    "time.sleep(5)\n"
                    "os.remove(os.path.join(t, 'mi_catia.json'))\n"
                    "json.dump({'ok': True, 'archivos': []}, open(os.path.join(t, 'salida.json'), 'w'))\n")
        with open(os.path.join(d, "ejercicio.json"), "w", encoding="utf-8") as f:
            json.dump({"usa_catia": True}, f)
        self.asignar("m001-PRUEBA.txt", {"item": "m001", "ejercicio": "borra_estado"})
        r = self.correr(ejercicios=os.path.join(self.tmp, "ejercicios"))
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        if pids:
            self.assertFalse(os.path.exists(self.mia("resultado-m001.txt")))
            return
        res = leer(self.mia("resultado-m001.txt"))
        self.assertTrue(res["ok"], res)
        self.assertEqual(res["catia_de_la_corrida"]["pid"], 999999)
        self.assertEqual(res["catia_al_terminar"], "sin CATIA abierta")


class Piezas(unittest.TestCase):
    def test_item_de_archivo(self):
        f = obrero.item_de_archivo
        self.assertEqual(f("001_prueba-DESKTOP-AB12.txt", "DESKTOP-AB12"), "001_prueba")
        self.assertEqual(f("001_prueba-desktop-ab12.TXT", "DESKTOP-AB12"), "001_prueba")
        self.assertIsNone(f("001-OTRA.txt", "DESKTOP-AB12"))
        self.assertIsNone(f("PENDIENTE_LEEME.txt", "DESKTOP-AB12"))
        self.assertEqual(f("..-DESKTOP-AB12.txt", "DESKTOP-AB12"), "")
        self.assertEqual(f("-DESKTOP-AB12.txt", "DESKTOP-AB12"), "")
        self.assertEqual(f("a b-DESKTOP-AB12.txt", "DESKTOP-AB12"), "")

    def test_ram_se_mide(self):
        ram = obrero.ram_libre_gb()
        self.assertIsNotNone(ram)
        self.assertGreater(ram, 0)

    def test_sin_pywin32_al_importar(self):
        import catia_base  # noqa: F401
        self.assertNotIn("win32com", sys.modules)
        self.assertNotIn("pythoncom", sys.modules)

    def test_es_mia_no_toma_una_catia_ajena(self):
        import catia_base
        self.assertFalse(catia_base.es_mia([1234], {}))
        self.assertFalse(catia_base.es_mia([1234], {"pid": 1234, "hora": None}))
        self.assertFalse(catia_base.es_mia([1234, 5678], {"pid": 1234, "hora": 1}, hora=lambda p: 1))
        self.assertTrue(catia_base.es_mia([1234], {"pid": 1234, "hora": 7}, hora=lambda p: 7))
        self.assertFalse(catia_base.es_mia([1234], {"pid": 1234, "hora": 7}, hora=lambda p: 8))

    def test_piso_de_ram_por_defecto_es_0_8(self):
        """PEDIDO 18 de CATA (Fak, 23/10/2026 19:50: «si hay 1 gb libre se hace con eso... luego ajustamos para que no sea tan
        exigente»). CATA midio 0,9 a 2,0 GB libres con la app abierta y con 1 justo se frenaba: 0,8. Con 3 el doble clic de
        Fak en Arrancar-obrero.cmd se quedaba en «espero RAM» para siempre."""
        self.assertEqual(obrero.argumentos([]).ram_min_gb, 0.8)
        self.assertEqual(obrero.argumentos(["--ram-min-gb", "3"]).ram_min_gb, 3.0)

    def test_cnext_abiertos_con_salida_que_no_es_utf8(self):
        """CATA 23/10 (002 y 003): tasklist escribe en la pagina de codigos OEM (0xa0 = a con acento en cp850) y el ejercicio
        corre con PYTHONUTF8=1: text=True sin errors= rompia el hilo lector (UnicodeDecodeError) y se perdia la salida.
        VERDE: con -X utf8 la lista de pids sale igual. ROJO: un tasklist que falla sigue dando None (no pude mirar)."""
        import catia_base  # noqa: F401
        with tempfile.TemporaryDirectory(prefix="cnext-utf8-") as tmp:
            guion = os.path.join(tmp, "guion.py")
            with open(guion, "w", encoding="utf-8") as f:
                f.write("import subprocess, sys\n")
                f.write("sys.path.insert(0, %r)\n" % CATIA_DIR)
                f.write("import catia_base\n")
                f.write("SALIDA = b'INFORMACI\\xa0N: hay tareas\\r\\n\"CNEXT.exe\",\"4321\",\"Console\"\\r\\n'\n")
                f.write("def falso(cmd, **kw):\n")
                f.write("    return subprocess.run([sys.executable, '-I', '-c', 'import sys; sys.stdout.buffer.write(%r)' % SALIDA], **kw)\n")
                f.write("def roto(cmd, **kw):\n")
                f.write("    return subprocess.run([sys.executable, '-I', '-c', 'import sys; sys.exit(1)'], **kw)\n")
                f.write("print(catia_base.cnext_abiertos(correr=falso))\n")
                f.write("print(catia_base.cnext_abiertos(correr=roto))\n")
            r = subprocess.run([sys.executable, "-X", "utf8", "-I", guion], capture_output=True, text=True, timeout=120)
            self.assertEqual(r.returncode, 0, r.stderr[-800:])
            self.assertEqual(r.stdout.split(), ["[4321]", "None"], r.stdout)


if __name__ == "__main__":
    unittest.main()
