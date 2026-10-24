# -*- coding: utf-8 -*-
"""Prueba sin CATIA del ejercicio 39 del banco de CATIA (biela-manivela con DMU Kinematics, 24/10/2026).
cerrar_con_cinematica(): VERDE con lo que midio CATIA el 24/10 12:41; ROJO si la corredera se aparta de la cuenta o de la
guia, si el boton de la manivela (origen de la biela) no esta a r del origen en el angulo pedido (una biela de 81 o una
manivela de 31: el gemelo), si cambia de sentido entre angulos, si falta un angulo o el mecanismo no es «1;4;1», y con un
paso fallido; el cierre es idempotente."""
import copy
import importlib.util
import json
import math
import os
import sys
import tempfile
import unittest

CATIA_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EJ39 = os.path.join(CATIA_DIR, "ejercicios", "39_biela_manivela_dmu")
sys.path.insert(0, CATIA_DIR)


def cargar():
    spec = importlib.util.spec_from_file_location("ej39_catia", os.path.join(EJ39, "catia.py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def x_slider(t, r=30.0, l=80.0):
    t = math.radians(t)
    return r * math.cos(t) + math.sqrt(l ** 2 - (r * math.sin(t)) ** 2)


def medido(r=30.0, l=80.0, signo=1):
    """Lo que daria CATIA con una manivela r y una biela l (12:41: r 30, l 80, giro positivo)."""
    pos = {}
    for t in (0, 30, 60, 90, 120, 180):
        a = math.radians(t)
        pos[str(t)] = {"biela": [round(r * math.cos(a), 4), round(signo * r * math.sin(a), 4), 0.0],
                       "corredera": [round(x_slider(t, r, l), 4), 0.0, 0.0]}
    return pos


class Cierre(unittest.TestCase):
    def cerrar(self, pos=None, gdl="1;4;1", ok=True):
        ej = cargar()
        tmp = tempfile.mkdtemp(prefix="ej39-")
        s = {"ok": False, "ok_pasos": ok, "pendiente": "x", "ej49": {"dof_articulaciones_comandos": gdl},
             "posiciones": medido() if pos is None else pos}
        with open(os.path.join(tmp, "salida.json"), "w", encoding="utf-8") as f:
            json.dump(s, f)
        return ej.cerrar_con_cinematica(tmp), tmp, ej

    def test_verde_en_los_dos_sentidos(self):
        for sg in (1, -1):
            s, *_ = self.cerrar(medido(signo=sg))
            self.assertTrue(s["ok"], s.get("error"))
            self.assertNotIn("error", s)

    def test_rojos(self):
        corrida = medido()
        corrida["90"]["corredera"][1] = 0.01                  # fuera de la guia
        mezcla = medido()
        mezcla["60"]["biela"][1] *= -1                         # cambia de sentido en un angulo
        sin_angulo = medido()
        del sin_angulo["120"]
        con_nan = medido()
        con_nan["60"]["corredera"][0] = float("nan")
        quieta = {t: copy.deepcopy(medido()["0"]) for t in medido()}            # el comando no se aplica: todo en 0
        cruzadas = {t: {"biela": p["corredera"], "corredera": p["biela"]} for t, p in medido().items()}
        rojos = {"biela de 81": dict(pos=medido(l=81.0)), "manivela de 31": dict(pos=medido(r=31.0)),
                 "corredera fuera de la guia": dict(pos=corrida), "cambia de sentido": dict(pos=mezcla),
                 "sin un angulo": dict(pos=sin_angulo), "mecanismo 0;4;1": dict(gdl="0;4;1"), "paso fallido": dict(ok=False),
                 "NaN en la corredera": dict(pos=con_nan), "quieta en 0 grados": dict(pos=quieta),
                 "biela y corredera cruzadas (Item 3 y 4)": dict(pos=cruzadas)}
        for que, k in rojos.items():
            with self.subTest(que):
                self.assertFalse(self.cerrar(**k)[0]["ok"])

    def test_idempotente(self):
        s, tmp, ej = self.cerrar(medido(l=81.0))
        self.assertFalse(s["ok"])
        with open(os.path.join(tmp, "salida.json"), encoding="utf-8") as f:
            d = json.load(f)
        d["posiciones"] = medido()
        with open(os.path.join(tmp, "salida.json"), "w", encoding="utf-8") as f:
            json.dump(d, f)
        s2 = ej.cerrar_con_cinematica(tmp)
        self.assertTrue(s2["ok"], s2.get("error"))
        self.assertNotIn("error", s2)

    def test_la_cuenta_del_papel(self):
        ej = cargar()
        for t, x in ((0, 110.0), (30, 104.5619), (60, 90.6637), (90, 74.1620), (120, 60.6637), (180, 50.0)):
            self.assertAlmostEqual(ej.x_cuenta(t), x, places=4)


if __name__ == "__main__":
    unittest.main()
