"""Pruebas sin CATIA, en las dos direcciones, de los dos arreglos del auditor del 19/10:
1. es_mia: misma CATIA (pid + hora) -> si; pid reciclado (otra hora), json sin hora, dos CATIA o tasklist fallido -> no.
   cnext_abiertos con tasklist que falla -> None (no [] = «no hay ninguna»).
2. veredicto del choque en CATIA: con el gemelo chocando, la pieza vacia es «no choca»; con el gemelo vacio, «sin medir»."""
import os
import sys
import types

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import catia_base as cb  # noqa: E402
try:                                              # en el repo se llama choque_exacto_en_catia.py
    from choque_exacto_en_catia import veredicto  # noqa: E402
except ImportError:
    from ej16_choque_catia_real import veredicto  # noqa: E402

fallas = []


def chequear(cond, msg):
    print(("   ok    " if cond else "   FALLA ") + msg)
    if not cond:
        fallas.append(msg)


hora = lambda pid: {100: 111, 200: 222}.get(pid)
g = {"pid": 100, "hora": 111}
chequear(cb.es_mia([100], g, hora), "misma CATIA (pid y hora) -> es mia")
chequear(not cb.es_mia([100], {"pid": 100, "hora": 999}, hora), "pid reciclado con otra hora -> NO es mia")
chequear(not cb.es_mia([100], {"pid": 100}, hora), "json viejo sin hora -> NO es mia")
chequear(not cb.es_mia([100, 200], g, hora), "dos CATIA abiertas -> NO")
chequear(not cb.es_mia(None, g, hora), "tasklist fallido (None) -> NO")
chequear(not cb.es_mia([200], g, hora), "otro pid -> NO")
falla = lambda *a, **k: types.SimpleNamespace(returncode=1, stdout="")
chequear(cb.cnext_abiertos(falla) is None, "tasklist con error -> None, no lista vacia")
bien = lambda *a, **k: types.SimpleNamespace(returncode=0, stdout='"CNEXT.exe","4321","Console","1","100 KB"\n')
chequear(cb.cnext_abiertos(bien) == [4321], "tasklist bien -> lista de pids")

v = veredicto({"v16": {"interseccion": 0.0}, "gemelo_1mm": {"interseccion": 69.5}})
chequear(v["v16"] == "no choca" and v["gemelo_1mm"].startswith("choca"), "gemelo choca -> la pieza vacia es «no choca»")
v = veredicto({"v16": {"interseccion": 0.0}, "gemelo_1mm": {"interseccion": 0.0}})
chequear(v["v16"].startswith("SIN MEDIR"), "gemelo vacio (CATIA danada) -> «sin medir», no «no choca»")
v = veredicto({"v16": {"interseccion": 0.0}})
chequear(v["v16"].startswith("SIN MEDIR"), "sin gemelo -> «sin medir»")
print("RESULTADO:", "OK" if not fallas else f"{len(fallas)} FALLAS")
sys.exit(1 if fallas else 0)
