"""Registro compartido de la impresora: que se imprimio, cuanto gasto cada rollo y que mantenimiento toca.

Uso (python del sistema):
  registro.py --resumen                 horas de impresion, gramos por rollo y mantenimiento que toca
  registro.py --anotar '<json>'         agrega un evento (lo usan bambu_red.py e imprimir_pieza.py)

DONDE VIVE: en la nube de Ingenieria, para que todas las PC vean lo mismo:
  ...\\INGENIERIA BARACK (NUNCA BORRAR)\\1- GENERAL\\5. 3D\\IMPRESORA BAMBU A2L\\registro\\<NOMBRE-DE-LA-PC>.jsonl
UN ARCHIVO POR PC, y cada PC solo agrega renglones al suyo: dos PC escribiendo el mismo archivo
de OneDrive generan copias en conflicto. El resumen junta los de todas.

Cada rollo se identifica por el numero de su chip (tag_uid), que informa la impresora: los gramos
se le descuentan a ESE rollo aunque lo cambien de lugar. La impresora no informa cuanto le queda.

LIMITE: solo cuenta lo que se manda con esta skill. Lo que alguien imprime directo desde Bambu
Studio o desde la pantalla no queda anotado (salvo que se cargue a mano con --anotar).
"""
import json
import os
import socket
import sys
import time
from datetime import datetime
from pathlib import Path

CARPETA = (Path(os.environ["USERPROFILE"]) / "BARACK ARGENTINA SRL" / "Ingeniería y Proyecto - General"
           / "INGENIERIA BARACK (NUNCA BORRAR)" / "1- GENERAL" / "5. 3D" / "IMPRESORA BAMBU A2L" / "registro")
# mantenimiento que pide Bambu (wiki en/a2l/maintenance/period-maintenance, leida el 13/10/2026)
POR_HORAS = [("Lubricar las guias del eje Y", 200)]
POR_ROLLOS = [("Revisar la cuchilla de corte de filamento", 3), ("Limpiar el engranaje del extrusor", 5),
              ("Revisar los tubos de PTFE", 6)]
POR_DIAS = [("Lubricar la guia del eje X (aceite, nunca grasa)", 30), ("Limpiar los 2 ventiladores del cabezal", 30)]


def anotar(evento):
    CARPETA.mkdir(parents=True, exist_ok=True)
    evento = dict(evento)
    evento.setdefault("cuando", time.strftime("%Y-%m-%d %H:%M:%S"))
    evento.setdefault("pc", socket.gethostname())
    with open(CARPETA / f"{socket.gethostname()}.jsonl", "a", encoding="utf-8") as f:
        f.write(json.dumps(evento, ensure_ascii=False) + "\n")
    return evento


def leer():
    ev = []
    if CARPETA.exists():
        for f in sorted(CARPETA.glob("*.jsonl")):
            for ren in f.read_text(encoding="utf-8").splitlines():
                if ren.strip():
                    try:
                        ev.append(json.loads(ren))
                    except ValueError:
                        pass
    return sorted(ev, key=lambda e: e.get("cuando", ""))


def resumen():
    ev = leer()
    # un renglon incompleto (sin trabajo, o con un numero vacio) no puede tumbar el resumen
    enviadas = {e["trabajo_id"]: e for e in ev if e.get("tipo") == "enviada" and e.get("trabajo_id")}
    finales = {e["trabajo_id"]: e for e in ev
               if e.get("tipo") in ("terminada", "fallida", "cancelada") and e.get("trabajo_id")}
    horas, rollos, n_ok, n_mal = 0.0, {}, 0, 0
    for tid, e in enviadas.items():
        fin = finales.get(tid)
        if fin is None:
            estado, fraccion, minutos = "sin cierre anotado", 1.0, e.get("minutos_estimados") or 0
        else:
            estado = fin["tipo"]
            fraccion = 1.0 if estado == "terminada" else float(fin.get("avance_pct") or 0) / 100
            minutos = fin.get("minutos_reales")
            if minutos is None:
                minutos = (e.get("minutos_estimados") or 0) * fraccion
            n_ok += estado == "terminada"
            n_mal += estado != "terminada"
        horas += minutos / 60
        for fil in e.get("filamentos", []):
            r = rollos.setdefault(fil.get("rollo") or "sin chip", {"nombre": fil.get("material", ""),
                                                                  "color": fil.get("color", ""), "gramos": 0.0})
            r["gramos"] += float(fil.get("gramos") or 0) * fraccion
    print(f"IMPRESIONES anotadas: {len(enviadas)}  (terminadas {n_ok}, falladas o canceladas {n_mal})  "
          f"| PC que anotaron: {sorted({e.get('pc', '?') for e in ev})}")
    print(f"HORAS de impresion: {horas:.1f}")
    print("ROLLOS (por numero de chip):")
    for chip, r in rollos.items():
        print(f"  {r['nombre']} {r['color']}  chip {chip[:8]}: gastados {r['gramos']:.0f} g de 1000 "
              f"-> quedan ~{max(0, 1000 - r['gramos']):.0f} g")
    gastado = sum(r["gramos"] for r in rollos.values())
    mant = [e for e in ev if e.get("tipo") == "mantenimiento" and e.get("que")]
    hechos = {e["que"]: e.get("cuando", "") for e in mant}
    veces = {q: sum(1 for e in mant if e["que"] == q) for q in hechos}   # toca de nuevo en cada multiplo
    print("MANTENIMIENTO (segun la wiki de Bambu):")
    for que, h in POR_HORAS:
        print(f"  {que}: cada {h} h -> llevamos {horas:.1f} h" + ("  <-- TOCA" if horas >= h * (veces.get(que, 0) + 1) else ""))
    for que, n in POR_ROLLOS:
        print(f"  {que}: cada {n} rollos -> llevamos {gastado/1000:.2f} rollos"
              + ("  <-- TOCA" if gastado / 1000 >= n * (veces.get(que, 0) + 1) else ""))
    for que, dias in POR_DIAS:
        ult = hechos.get(que, '')
        desde = ult or (ev[0].get('cuando', '') if ev else '')   # sin anotar: se cuenta desde el primer uso
        try:
            pasaron = (datetime.now() - datetime.fromisoformat(desde[:19])).days
        except ValueError:
            pasaron = None
        print(f"  {que}: cada {dias} dias -> ultimo anotado: {ult or 'nunca'}"
              + ("  <-- TOCA" if pasaron is None or pasaron >= dias else ""))
    return 0


if __name__ == "__main__":
    if len(sys.argv) >= 3 and sys.argv[1] == "--anotar":
        print(anotar(json.loads(sys.argv[2])))
    else:
        sys.exit(resumen())
