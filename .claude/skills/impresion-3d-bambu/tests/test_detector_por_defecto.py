"""Gate 3b (23/10/2026): --imprimir lanza la vigilancia con --detector por defecto. Casos B1 a B9 de
casos_gates_3a_3b.md (escritos antes del gate). TODO EN SECO: la impresora de juguete (tests/impresora_juguete.py), la
subida reemplazada como en _ImprimirBase, y el lanzador de la vigilancia reemplazado por uno que anota (o por procesos
falsos `python -c`, que se matan al terminar). Ninguno habla con la impresora real ni lanza una vigilancia de verdad.

Falla real (Fak, 20/10/2026 18:36: «olvido tuyo? imperdonable... evitar que suceda en el futuro»): la vigilancia se
lanzo sin --detector; --imprimir solo imprimia el comando y --seguir lo dejaba apagado por defecto."""
import hashlib
import inspect
import json
import os
import shlex
import socket
import subprocess
import sys
import threading
import time
import unittest
from datetime import datetime
from pathlib import Path

import _base
from _base import registro
import bambu_red as br
import test_bambu_red as tbr

FRASE = "Fak 23/10: prueba de 10 min, miro yo"
LANZO = "LANZO LA VIGILANCIA APARTE:"
LANZARIA = "LANZARÍA LA VIGILANCIA APARTE:"


def argv_de(out, prefijo=LANZO):
    """El comando que la salida dice que lanza, leido con shlex (como lo leeria una consola bash)."""
    lineas = [x for x in out.splitlines() if prefijo in x]
    if not lineas:
        raise AssertionError(f"no hay un renglon «{prefijo}» en:\n{out}")
    return shlex.split(lineas[-1].split(prefijo, 1)[1])


class _Falso:
    """Un «proceso» que no existe: para mirar el argv sin lanzar nada."""
    pid = 0

    def poll(self):
        return None


def foto_que_anda(salida, d=None):
    Path(salida).write_bytes(b"\xff\xd8 juguete \xff\xd9")
    return 0


def foto_que_no_anda(salida, d=None):
    raise br.SinConexion("La camara de la impresora no contesto (juguete).")


def huellas(carpeta):
    return {p.name: hashlib.md5(p.read_bytes()).hexdigest() for p in Path(carpeta).glob("*.jsonl")}


class _Gate3b(tbr._ImprimirBase):
    """--imprimir contra la impresora de juguete, con la camara y el lanzador reemplazados."""

    def setUp(self):
        super().setUp()
        self._guardado = (br.LANZADOR, br.foto, br.VIGILANCIA_ESPERA_S, br.PY_DETECTOR)
        self.lanzados, self.procesos = [], []
        br.LANZADOR = self.lanzador_que_anota()
        br.foto = foto_que_anda
        br.VIGILANCIA_ESPERA_S = 0.3
        self.quedan(tbr.NEGRO, 500)

    def tearDown(self):
        br.LANZADOR, br.foto, br.VIGILANCIA_ESPERA_S, br.PY_DETECTOR = self._guardado
        for p in self.procesos:
            if p.poll() is None:
                p.kill()
            p.wait(10)
        super().tearDown()

    def lanzador_que_anota(self, codigo=None):
        """Anota el argv; con `codigo`, lanza `python -c codigo <carpeta>` de verdad (un proceso falso)."""
        def lanzar(argv, consola):
            self.lanzados.append(list(argv))
            if codigo is None:
                return _Falso()
            p = subprocess.Popen([sys.executable, "-c", codigo, str(Path(consola).parent)])
            self.procesos.append(p)
            return p
        return lanzar

    def mandar(self, *extra, archivo=None):
        archivo = archivo or self.archivo(gramos=(5.0,))
        return (archivo, *self.correr("--imprimir", str(archivo), *extra))

    def enviada(self):
        return [e for e in registro.leer() if e["tipo"] == "enviada"][-1]

    def vigilancias(self):
        return [e for e in registro.leer() if e["tipo"] == "vigilancia"]

    def mando_la_orden(self):
        return any((o.get("print") or {}).get("command") == "project_file" for o in self.jug.recibidos)


class B1EnSeco(_Gate3b):
    def _en_seco(self, *extra):
        archivo = self.archivo(gramos=(5.0,))
        antes = huellas(self.reg)
        conectar, crear = socket.socket.connect, socket.create_connection

        def prohibido(*a, **k):
            raise AssertionError("--en-seco abrio una conexion")
        socket.socket.connect, socket.create_connection = prohibido, prohibido
        try:
            r, out, err = self.correr("--imprimir", str(archivo), "--en-seco", *extra)
        finally:
            socket.socket.connect, socket.create_connection = conectar, crear
        self.assertEqual(r, 0, out)
        self.assertNotIn("Traceback", out + err)
        self.assertIn("no se consultó la impresora", out)
        self.assertIn("frenos SIN EVALUAR", out)
        argv = argv_de(out, LANZARIA)
        self.assertEqual(argv[2], "--seguir")
        self.assertTrue(Path(argv[3]).name.startswith("seguimiento_"), argv)
        self.assertIn("--detector", argv)
        self.assertNotIn("--despertar", argv)
        self.assertEqual(self.subidas, [])
        self.assertEqual(self.jug.conexiones, 0)
        self.assertFalse(self.mando_la_orden())
        self.assertEqual(list(self.pieza.glob("seguimiento_*")), [])
        self.assertFalse((self.pieza / "ficha.json").exists())
        self.assertEqual(huellas(self.reg), antes)
        self.assertEqual(self.lanzados, [])
        return out

    def test_B1_en_seco_no_manda_nada_y_dice_el_comando_con_detector(self):
        self._en_seco()

    def test_B1_en_seco_manda_sobre_apply(self):
        out = self._en_seco("--apply")
        self.assertIn("--en-seco manda sobre --apply", out)


class B2LoImpresoEsLoLanzado(_Gate3b):
    def test_B2_el_renglon_es_el_argv_del_proceso(self):
        archivo, r, out, _ = self.mandar("--apply")
        self.assertEqual(r, 0, out)
        self.assertTrue(self.mando_la_orden())
        self.assertEqual(len(self.lanzados), 1, out)
        self.assertEqual(argv_de(out), self.lanzados[0])
        argv = self.lanzados[0]
        tid = self.enviada()["trabajo_id"]
        self.assertEqual(argv[:4], [sys.executable, str(Path(br.__file__).resolve()), "--seguir",
                                    str(archivo.parent / ("seguimiento_" + tid))])
        self.assertIn("--detector", argv)
        self.assertNotIn("--despertar", argv)
        self.assertNotIn("AHORA, EN SEGUNDO PLANO", out)
        v = self.vigilancias()
        self.assertEqual((len(v), v[0]["modo"], v[0]["trabajo_id"]), (1, "detector", tid))
        self.assertEqual(self.enviada()["vigilancia_pedida"], "detector")
        ficha = json.loads((self.pieza / "ficha.json").read_text(encoding="utf-8"))
        self.assertEqual(ficha["envios"][-1]["vigilancia"]["modo"], "detector")
        rojos = [m for n, _, m in registro.validar() if "tipo desconocido" in m]
        self.assertEqual(rojos, [])

    def test_B2_sin_apply_no_lanza(self):
        _, r, out, _ = self.mandar()
        self.assertEqual(r, 0, out)
        self.assertEqual(self.lanzados, [])
        self.assertFalse(self.mando_la_orden())

    def test_B2_rechazada_no_lanza(self):
        def rechaza(orden):
            if (orden.get("print") or {}).get("command") == "project_file":
                self.jug.al_imprimir = ()
                self.jug.mudo = False
        self.jug.al_recibir = rechaza
        original = self.jug._publicar

        def publicar(c, obj):
            p = obj.get("print") or {}
            if p.get("command") == "project_file" and p.get("result") == "success":
                obj = {"print": dict(p, result="fail", reason="juguete")}
            original(c, obj)
        self.jug._publicar = publicar
        _, r, out, _ = self.mandar("--apply")
        self.assertEqual(r, 1, out)
        self.assertIn("LA IMPRESORA RECHAZO LA ORDEN", out)
        self.assertEqual(self.lanzados, [])

    def test_B2_el_lanzador_de_verdad_deja_un_proceso_aparte(self):
        # el Popen con DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP de esta PC, con un proceso que no es la vigilancia
        consola = self.tmp / "consola.log"
        p = br._popen_aparte([sys.executable, "-c", "print('hola desde el proceso aparte')"], consola)
        self.procesos.append(p)
        self.assertEqual(p.wait(30), 0)
        self.assertIn("hola desde el proceso aparte", consola.read_text(encoding="utf-8", errors="replace"))


class B3SinFrase(_Gate3b):
    def _frena_antes_de_todo(self, *extra):
        _, r, out, _ = self.mandar(*extra)
        self.assertEqual(r, 1, out)
        self.assertEqual(self.subidas, [])
        self.assertFalse(self.mando_la_orden())
        self.assertEqual(self.jug.conexiones, 0, "leyo la impresora antes de controlar la frase")
        self.assertEqual(self.lanzados, [])
        return out

    def test_B3_sin_detector_sin_frase_frena_con_y_sin_apply(self):
        for extra in (("--apply", "--sin-detector"), ("--sin-detector",), ("--en-seco", "--sin-detector")):
            with self.subTest(extra=extra):
                out = self._frena_antes_de_todo(*extra)
                self.assertIn("NO SE MANDA: --sin-detector necesita la frase de Fak", out)

    def test_B3_frases_que_no_sirven(self):
        for frase in ("", "ok", "   dale    "):
            with self.subTest(frase=frase):
                out = self._frena_antes_de_todo("--apply", "--sin-detector", "--acepto", frase)
                self.assertIn("necesita la frase de Fak", out)

    def test_B3_acepto_sin_sin_detector(self):
        out = self._frena_antes_de_todo("--apply", "--acepto", FRASE)
        self.assertIn("--acepto va solo con --sin-detector", out)


class B4ConFrase(_Gate3b):
    def test_B4_pasa_registra_y_no_apaga_la_vigilancia(self):
        llamadas = []
        br.foto = lambda salida, d=None: llamadas.append(salida) or 0
        _, r, out, _ = self.mandar("--apply", "--sin-detector", "--acepto", FRASE)
        self.assertEqual(r, 0, out)
        self.assertTrue(self.mando_la_orden())
        argv = self.lanzados[0]
        self.assertEqual(argv_de(out), argv)
        self.assertIn("--seguir", argv)
        self.assertNotIn("--detector", argv)
        self.assertEqual(argv[argv.index("--sin-detector"):], ["--sin-detector", "--acepto", FRASE])
        self.assertEqual(llamadas, [], "sin detector no hace falta probar la camara")
        e = self.enviada()
        self.assertEqual((e["vigilancia_pedida"], e["sin_detector"]["frase"]), ("sin detector", FRASE))
        self.assertIsNotNone(registro.fecha(e["sin_detector"]["fecha"]))
        v = self.vigilancias()[-1]
        self.assertEqual((v["modo"], v["frase"], v["trabajo_id"]), ("sin detector", FRASE, e["trabajo_id"]))
        ficha = json.loads((self.pieza / "ficha.json").read_text(encoding="utf-8"))
        self.assertEqual(ficha["envios"][-1]["sin_detector"]["frase"], FRASE)
        self.assertEqual(ficha["envios"][-1]["vigilancia"]["frase"], FRASE)


class B5SinCamara(_Gate3b):
    def _sin_camara(self):
        t0 = time.time()
        _, r, out, _ = self.mandar("--apply")
        self.assertEqual(r, 0, out)
        self.assertTrue(self.mando_la_orden())
        self.assertLess(time.time() - t0, 60)
        self.assertIn("AVISO: sin cámara accesible: la vigilancia va con --solo-medir (solo estado)", out)
        argv = self.lanzados[0]
        self.assertEqual(argv_de(out), argv)
        self.assertIn("--solo-medir", argv)
        self.assertNotIn("--detector", argv)
        v = self.vigilancias()[-1]
        self.assertEqual(v["modo"], "solo-medir")
        self.assertIn("sin cámara accesible", v["motivo"])

    def test_B5_camara_que_falla(self):
        br.foto = foto_que_no_anda
        self._sin_camara()

    def test_B5_la_juguete_no_tiene_camara(self):
        # la foto() de verdad contra la impresora de juguete, que no simula el puerto 6000
        br.foto = self._guardado[1]
        self._sin_camara()


class B7HijoQueNoArranca(_Gate3b):
    def setUp(self):
        super().setUp()
        br.VIGILANCIA_ESPERA_S = 5.0

    def test_B7_sale_con_16_a_los_3_s(self):
        br.LANZADOR = self.lanzador_que_anota("import sys, time; time.sleep(3); sys.exit(16)")
        _, r, out, _ = self.mandar("--apply")
        self.assertEqual(r, 0, out)
        self.assertTrue(self.mando_la_orden())
        self.assertIn("LA VIGILANCIA NO ARRANCÓ: el proceso aparte salió con 16", out)
        self.assertIn("lanzala a mano, en segundo plano: " + br.texto_de_comando(self.lanzados[0]), out)
        self.assertNotIn("VIGILANDO", out)
        self.assertEqual(self.vigilancias()[-1]["resultado"], "no arranco")

    def test_B7_vivo_y_con_su_vigilancia_pid(self):
        br.LANZADOR = self.lanzador_que_anota(
            "import json, os, sys, time, pathlib; "
            "pathlib.Path(sys.argv[1], 'vigilancia.pid').write_text(json.dumps({'pid': os.getpid()})); time.sleep(30)")
        _, r, out, _ = self.mandar("--apply")
        self.assertEqual(r, 0, out)
        self.assertIn(f"VIGILANDO: proceso aparte PID {self.procesos[0].pid}", out)
        self.assertEqual((self.vigilancias()[-1]["resultado"], self.vigilancias()[-1]["pid"]),
                         ("vigilando", self.procesos[0].pid))

    def test_B7_vivo_sin_vigilancia_pid_no_es_vigilando(self):
        br.LANZADOR = self.lanzador_que_anota("import time; time.sleep(30)")
        _, r, out, _ = self.mandar("--apply")
        self.assertEqual(r, 0, out)
        self.assertNotIn("VIGILANDO", out)
        self.assertIn("no lo doy por vigilando", out)

    def test_B7_un_15_cuenta_como_vigilada(self):
        br.LANZADOR = self.lanzador_que_anota("import sys; sys.exit(15)")
        _, r, out, _ = self.mandar("--apply")
        self.assertEqual(r, 0, out)
        self.assertIn("ya había otra vigilancia", out)
        self.assertNotIn("NO ARRANCÓ", out)
        self.assertEqual(self.vigilancias()[-1]["resultado"], "ya vigilada")

    def test_B7_lanzador_que_revienta(self):
        def revienta(argv, consola):
            raise OSError("no se pudo crear el proceso (juguete)")
        br.LANZADOR = revienta
        _, r, out, _ = self.mandar("--apply")
        self.assertEqual(r, 0, out)
        self.assertIn("LA VIGILANCIA NO ARRANCÓ (OSError", out)


class B9DeNocheAlMandar(_Gate3b):
    def test_B9_a_las_21_con_ok_va_con_detector_y_lo_dice(self):
        self.a_las(21, 0)
        archivo = self.archivo(gramos=(5.0,))
        archivo.with_name(archivo.name + ".ok").write_text('23/10/2026 20:50 Fak: "dale, mandala de noche"',
                                                          encoding="utf-8")
        _, r, out, _ = self.mandar("--apply", archivo=archivo)
        self.assertEqual(r, 0, out)
        self.assertIn("DE NOCHE", out)
        self.assertIn("no da alarma de 20:45 a 08:15", out)
        self.assertIn("--detector", self.lanzados[0])

    def test_B9_la_decision_esta_escrita_en_el_canon(self):
        c = br.canon_detector()
        self.assertEqual((c["de_noche"], c["por_defecto"], c["sin_camara"], c["frase_minima"], c["modo"]),
                         ("solo-medir", "detector", "solo-medir", 10, "aviso"))
        self.assertIn("Una foto negra no es «se ve bien»", c["_de_noche"])
        self.assertIn("fotos negras SINTÉTICAS", c["_de_noche"])      # lo medido se dice como medido
        self.assertIn("con una foto real de noche, sin medir", c["_de_noche"])
        self.assertEqual(c["revisar"], "2026-10-30")


class _Gate3bSeguir(tbr._SeguirBase):
    """--seguir de verdad contra la impresora de juguete, con la medicion del detector reemplazada."""

    def setUp(self):
        super().setUp()
        self._guardado = (br.medir_foto, br.PY_DETECTOR, br._ahora, br.foto)
        br.foto = foto_que_anda
        self.medidas = []

    def tearDown(self):
        br.medir_foto, br.PY_DETECTOR, br._ahora, br.foto = self._guardado
        super().tearDown()

    def a_las(self, h, m):
        br._ahora = lambda: datetime(2026, 10, 23, h, m).astimezone()

    def medir(self, exito):
        def medir_foto(ruta, d=None):
            self.medidas.append(ruta)
            return {"success": exito, "failure": 0.7}
        br.medir_foto = medir_foto

    def latir(self, segundos, final="FINISH"):
        """La impresora imprime (una capa nueva cada 0,5 s) durante `segundos` y despues pasa a `final`."""
        self.jug.estado.update(gcode_state="RUNNING", stg_cur=0, subtask_name="pieza_prueba", task_id="555")

        def andar():
            fin, capa = time.time() + segundos, 10
            while time.time() < fin:
                capa += 1
                self.jug.poner(layer_num=capa, mc_percent=min(99, capa))
                time.sleep(0.5)
            self.jug.poner(gcode_state=final)
        threading.Thread(target=andar, daemon=True).start()

    def log(self):
        return (self.carpeta / "seguimiento.log").read_text(encoding="utf-8")

    def sembrar_base(self, n=8, exito=0.25):
        """Lecturas sanas de una corrida anterior en el log: --seguir las relee (l. «historial»)."""
        with open(self.carpeta / "seguimiento.log", "w", encoding="utf-8") as f:
            for i in range(n):
                f.write(f"2026-10-23T10:{i:02d}:00-03:00 RUNNING etapa 0 capa {i} | detector exito {exito:.3f} "
                        "falla 0.700\n")


class B6DetectorQueNoMide(_Gate3bSeguir):
    def test_B6_sin_el_python_del_detector_el_log_lo_dice(self):
        br.PY_DETECTOR = self.tmp / "no_esta" / "python.exe"
        self.latir(9)
        r, out, _ = self.seguir()
        self.assertEqual(r, 0, out)
        self.assertIn("DETECTOR SIN MEDIR hace 3 vueltas: no está el Python del detector", self.log())
        self.assertEqual(self.log().count("DETECTOR SIN MEDIR"), 1)

    def test_B6_la_camara_no_contesta_tambien_lo_dice(self):
        br.PY_DETECTOR = Path(sys.executable)          # un Python que existe: la que falla es la foto
        br.foto = foto_que_no_anda
        self.latir(9)
        r, out, _ = self.seguir()
        self.assertEqual(r, 0, out)
        self.assertIn("DETECTOR SIN MEDIR hace 3 vueltas: la cámara o el detector no devolvieron una lectura", self.log())


class B8SeguirAMano(_Gate3bSeguir):
    def test_B8_sin_flags_el_detector_va_prendido(self):
        self.a_las(10, 0)
        self.medir(0.25)
        self.latir(6)
        r, out, _ = self.seguir()
        self.assertEqual(r, 0, out)
        self.assertGreater(len(self.medidas), 0, out)
        self.assertIn("detector exito 0.250", self.log())
        self.assertNotIn("VIGILANCIA SIN DETECTOR", self.log())

    def test_B8_sin_detector_con_frase_lo_escribe_primero(self):
        self.medir(0.25)
        self.latir(3)
        r, out, _ = self.seguir("--sin-detector", "--acepto", FRASE)
        self.assertEqual(r, 0, out)
        primera = self.log().splitlines()[0]
        self.assertIn("VIGILANCIA SIN DETECTOR", primera)
        self.assertIn(FRASE, primera)
        self.assertEqual(self.medidas, [])
        v = [e for e in registro.leer() if e["tipo"] == "vigilancia"]
        self.assertEqual((v[-1]["modo"], v[-1]["frase"], v[-1]["lanzada_por"]), ("sin detector", FRASE, "--seguir"))

    def test_B8_sin_detector_sin_frase_no_se_lanza(self):
        for extra in (("--sin-detector",), ("--sin-detector", "--acepto", "ok"), ("--acepto", FRASE),
                      ("--sin-detector", "--acepto", FRASE, "--detector")):
            with self.subTest(extra=extra):
                r, out, _ = self.seguir(*extra)
                self.assertEqual(r, br.SALIDA_ERROR_PROGRAMA, out)
                self.assertIn("NO SE LANZA LA VIGILANCIA", out)
                self.assertFalse((self.carpeta / "seguimiento.log").exists())

    def test_B8_solo_medir_sigue_y_lo_dice(self):
        self.a_las(10, 0)
        self.sembrar_base()
        self.medir(0.9)
        self.latir(14)
        r, out, _ = self.seguir("--solo-medir")
        self.assertEqual(r, 0, out)
        self.assertIn("VIGILANCIA SOLO MIDE", self.log())
        self.assertNotIn("ALARMA DEL DETECTOR", self.log())

    def test_B8_compatibilidad_de_imprimir(self):
        params = list(inspect.signature(br.imprimir).parameters.values())
        self.assertEqual([p.name for p in params[:3]], ["archivo", "mapa", "aplicar"])
        self.assertTrue(all(p.default is not inspect.Parameter.empty for p in params[3:]))
        texto = (_base.SCRIPTS / "imprimir_pieza.py").read_text(encoding="utf-8")
        self.assertIn("br.imprimir(str(salida), None, a.apply)", texto)
        self.assertTrue(inspect.signature(br.seguir).parameters["detector"].default)


class B9DeNocheSeguir(_Gate3bSeguir):
    def test_B9_de_dia_tres_lecturas_altas_dan_alarma(self):
        self.a_las(10, 0)
        self.sembrar_base()
        self.medir(0.9)
        self.latir(30)
        r, out, _ = self.seguir()
        self.assertEqual(r, 11, out)
        self.assertIn("ALARMA DEL DETECTOR", self.log())

    def test_B9_de_noche_las_mismas_lecturas_no_dan_alarma(self):
        self.a_las(21, 0)
        self.sembrar_base()
        self.medir(0.9)
        self.latir(14)
        r, out, _ = self.seguir()
        self.assertEqual(r, 0, out)
        self.assertNotIn("ALARMA DEL DETECTOR", self.log())
        self.assertIn("(DE NOCHE: anota, no cuenta)", self.log())
        self.assertGreaterEqual(len(self.medidas), 3, out)


class T14bComandosNuevos(unittest.TestCase):
    """T14 con los flags nuevos (--en-seco, --sin-detector, --acepto): con la impresora apagada, ningun Traceback y el
    ultimo renglon en castellano. --en-seco no habla con la impresora: sale con 0."""

    def setUp(self):
        self.tmp = _base.carpeta_nueva("t14b")
        self.reg = _base.apuntar(self.tmp)
        self._puerto, self._sin = br.PUERTO_MQTT, br.SIN_MENSAJES_S
        br.PUERTO_MQTT, br.SIN_MENSAJES_S = tbr.puerto_libre(), 3
        _base.escribir_datos(self.tmp, "127.0.0.1")
        self.gcode = _base.gcode_3mf(self.tmp / "pieza.gcode.3mf")

    def tearDown(self):
        br.PUERTO_MQTT, br.SIN_MENSAJES_S = self._puerto, self._sin

    COMANDOS = ((["--imprimir", "{gcode}", "--en-seco"], 0),
                (["--imprimir", "{gcode}", "--apply", "--en-seco"], 0),
                (["--imprimir", "{gcode}", "--apply", "--sin-detector"], 1),
                (["--imprimir", "{gcode}", "--sin-detector", "--acepto", "ok"], 1),
                (["--imprimir", "{gcode}", "--acepto", FRASE], 1),
                (["--imprimir", "{gcode}", "--acepto"], 1),
                (["--imprimir", "{gcode}", "--apply", "--sin-detector", "--acepto", FRASE], None),
                (["--seguir", "{tmp}/seg3", "--cada", "1", "--sin-detector"], br.SALIDA_ERROR_PROGRAMA),
                (["--seguir", "{tmp}/seg4", "--cada", "1", "--sin-detector", "--acepto", FRASE], None),
                (["--seguir", "{tmp}/seg5", "--cada", "1", "--solo-medir"], None),
                (["--seguir", "{tmp}/seg6", "--cada", "1", "--detector"], None))

    def test_cada_comando_nuevo(self):
        for cmd, esperado in self.COMANDOS:
            args = [x.format(gcode=self.gcode, tmp=self.tmp) for x in cmd]
            with self.subTest(cmd=" ".join(cmd)):
                r, out, err = _base.correr(br.main, ["bambu_red.py", *args])
                if esperado is None:
                    self.assertNotEqual(r, 0, out)
                else:
                    self.assertEqual(r, esperado, out)
                self.assertNotIn("Traceback", out + err)
                ultima = [x for x in out.splitlines() if x.strip()][-1]
                self.assertRegex(ultima, r"[a-záéíóúñ]{3,} ", out)


if __name__ == "__main__":
    unittest.main()
