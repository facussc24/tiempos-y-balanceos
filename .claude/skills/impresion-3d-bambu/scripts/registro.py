"""Registro compartido de la impresora: que se imprimio, cuanto gasto cada rollo y que mantenimiento toca.

Uso (python del sistema):
  registro.py --resumen                 horas de impresion, gramos por rollo, rollo bajo y mantenimiento que toca
  registro.py --anotar '<json>'         agrega un evento (lo usan bambu_red.py e imprimir_pieza.py)
  registro.py --pesar <lugar|chip> <g> [--tara <g>]   el rollo montado en la balanza (gramos con el carrete)
  registro.py --tara <g>                el carrete VACIO pesado: queda como tara de la casa
  registro.py --placa-libre ["nota"]    quien saco las piezas lo anota: recien ahi --imprimir --apply manda
  registro.py --validar                 rojo/verde por renglon; sale con 1 si hay rojos

DONDE VIVE: en la nube de Ingenieria, para que todas las PC vean lo mismo:
  ...\\INGENIERIA BARACK (NUNCA BORRAR)\\1- GENERAL\\5. 3D\\IMPRESORA BAMBU A2L\\registro\\<NOMBRE-DE-LA-PC>.jsonl
UN ARCHIVO POR PC, y cada PC solo agrega renglones al suyo: dos PC escribiendo el mismo archivo
de OneDrive generan copias en conflicto. El resumen junta los de todas.

Cada rollo se identifica por el numero de su chip (tag_uid), que informa la impresora: los gramos
se le descuentan a ESE rollo aunque lo cambien de lugar. La impresora NO informa cuanto le queda
(13/10/2026: en cada lugar `remain = -1` y `tray_weight = 1000`, el peso nominal; el cargador de 4 de
la A2L no tiene la opcion de estimarlo): por eso se descuenta desde la ultima pesada (`--pesar`) o,
sin pesada, desde 1000 g.

Horas: los renglones nuevos llevan fecha y hora con zona (2026-10-16T13:20:05-03:00); los viejos
(2026-10-16 13:08:40, hora local) se siguen leyendo. Todo se compara con fecha() y nunca como texto.

LIMITE: solo cuenta lo que se manda con esta skill. Lo que alguien imprime directo desde Bambu
Studio o desde la pantalla queda como «visto» cuando una PC habla con la impresora mientras lo imprime.
"""
import json
import os
import re
import socket
import sys
import tempfile
from datetime import datetime
from pathlib import Path

_NUBE_3D = (Path(os.environ["USERPROFILE"]) / "BARACK ARGENTINA SRL" / "Ingeniería y Proyecto - General"
            / "INGENIERIA BARACK (NUNCA BORRAR)" / "1- GENERAL" / "5. 3D" / "IMPRESORA BAMBU A2L")
# Las pruebas (tests/) redirigen las rutas a una carpeta temporal con BAMBU_REGISTRO y BAMBU_DATOS, y con
# BAMBU_PRUEBA=1 este modulo se niega a escribir fuera de esa carpeta: ningun test toca el registro real.
CARPETA = Path(os.environ["BAMBU_REGISTRO"]) if os.environ.get("BAMBU_REGISTRO") else _NUBE_3D / "registro"
# lo ultimo que leyo --estado en esta PC (que rollo hay en cada lugar, con su chip)
ULTIMO_ESTADO = ((Path(os.environ["BAMBU_DATOS"]).parent if os.environ.get("BAMBU_DATOS")
                  else Path(os.environ["USERPROFILE"]) / ".claude") / "bambu-a2l-ultimo-estado.json")

CIERRES = ("terminada", "fallida", "cancelada")
TIPOS = set(CIERRES) | {"enviada", "confirmada", "mantenimiento", "ip", "placa_libre", "rollo terminado",
                        "rollo cargado", "visto", "pesado", "tara", "cambio de rollo"}
CON_TRABAJO = set(CIERRES) | {"enviada", "confirmada", "cambio de rollo"}
ROLLO_NOMINAL = 1000.0
# Tara del carrete reutilizable de Bambu SIN MEDIR: la tienda dice 250 g y en el foro se pesan de 208 a 260 g
# (con o sin el nucleo de carton). El primer carrete vacio que se pese queda como tara de la casa (--tara).
TARA_SIN_MEDIR = 250.0
# Avisos de rollo bajo: PROPUESTA SIN FUENTE (informe H2 §2.5, 16/10/2026). Se ajustan con las primeras pesadas.
ROLLO_PESALO = 100.0          # por debajo: «pesalo»
ROLLO_SOLO_CHICAS = 50.0      # por debajo: «solo piezas chicas de dia o con respaldo»
_ZONA = datetime.now().astimezone().tzinfo
COLORES = {"negro": "#000000", "blanco": "#FFFFFF", "amarillo": "#F4D31F", "verde": "#00AE42",
           "rojo": "#C12E1F", "azul": "#0A2989", "gris": "#8E9089", "naranja": "#FF6A13"}
# mantenimiento que pide Bambu (wiki en/a2l/maintenance/period-maintenance, leida el 13/10/2026)
POR_HORAS = [("Lubricar las guias del eje Y", 200)]
POR_ROLLOS = [("Revisar la cuchilla de corte de filamento", 3), ("Limpiar el engranaje del extrusor", 5),
              ("Revisar los tubos de PTFE", 6)]
POR_DIAS = [("Lubricar la guia del eje X (aceite, nunca grasa)", 30), ("Limpiar los 2 ventiladores del cabezal", 30)]


def ahora():
    return datetime.now().astimezone()


def ahora_iso():
    """Fecha y hora completas con la zona: 2026-10-16T13:20:05-03:00."""
    return ahora().isoformat(timespec="seconds")


def fecha(s):
    """Un `cuando` del registro como fecha con zona. Lee los viejos ('2026-10-16 13:08:40', hora local de la PC)
    y los nuevos ('2026-10-16T13:20:05-03:00'). None si no se entiende."""
    if not s:
        return None
    try:
        d = datetime.fromisoformat(str(s).strip())
    except ValueError:
        return None
    return d if d.tzinfo else d.replace(tzinfo=_ZONA)


_MUY_VIEJO = datetime(2000, 1, 1).astimezone()


def _clave_tiempo(e):
    return fecha(e.get("cuando")) or _MUY_VIEJO


def ruta_de_prueba_ok(ruta):
    """Con BAMBU_PRUEBA=1 (los tests) nada se escribe fuera de la carpeta temporal del sistema."""
    if os.environ.get("BAMBU_PRUEBA") != "1":
        return
    tmp = Path(tempfile.gettempdir()).resolve()
    r = Path(ruta).resolve()
    if tmp != r and tmp not in r.parents:
        raise SystemExit(f"PRUEBA: {ruta} esta fuera de la carpeta temporal; no se escribe")


def anotar(evento):
    ruta_de_prueba_ok(CARPETA)
    CARPETA.mkdir(parents=True, exist_ok=True)
    evento = dict(evento)
    evento.setdefault("cuando", ahora_iso())
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
    # por fecha y no por texto: '2026-10-16 13:29:54' (viejo) y '2026-10-16T10:00:00-03:00' (nuevo) no se ordenan como texto
    return sorted((e for e in ev if isinstance(e, dict)), key=_clave_tiempo)


# ---------------- trabajos: cerrar EL trabajo, no «el ultimo abierto» ----------------
def nombre_en_impresora(archivo):
    """El nombre con que bambu_red.py sube el archivo a la impresora."""
    nombre = Path(str(archivo)).name
    return "virolador_v14.gcode.3mf" if "VIROLADOR v14" in nombre else re.sub(r"[^A-Za-z0-9_.-]", "_", nombre)


def subtask_de(nombre_subido):
    """El `subtask_name` que la impresora informa para ese archivo."""
    return nombre_subido.replace(".3mf", "").replace(".gcode", "")


def subtask(e):
    """El subtask_name de un renglon «enviada»; los viejos (antes del 16/10/2026) no lo guardaban: sale del archivo."""
    return e.get("subtask_name") or subtask_de(nombre_en_impresora(e.get("archivo") or ""))


def cerrados(ev=None):
    """{trabajo_id: renglon de cierre} (el primero de cada trabajo)."""
    ev = leer() if ev is None else ev
    out = {}
    for e in ev:
        if e.get("tipo") in CIERRES and e.get("trabajo_id"):
            out.setdefault(e["trabajo_id"], e)
    return out


def abiertas(pc=None, nombre=None, ev=None):
    """Renglones «enviada» sin cierre, el mas nuevo primero; por PC y por nombre (subtask_name)."""
    ev = leer() if ev is None else ev
    fin = cerrados(ev)
    out = [e for e in ev if e.get("tipo") == "enviada" and e.get("trabajo_id") and e["trabajo_id"] not in fin]
    if pc:
        out = [e for e in out if e.get("pc") == pc]
    if nombre:
        out = [e for e in out if subtask(e) == nombre]
    return out[::-1]


def trabajo_de(subtask_name=None, task_id=None, solo_abiertas=True, ev=None):
    """El renglon «enviada» del trabajo que informa la impresora: primero por task_id, despues por nombre (el mas
    nuevo). None si no esta: un trabajo ajeno NUNCA se cierra por descarte."""
    ev = leer() if ev is None else ev
    cand = (abiertas(ev=ev) if solo_abiertas
            else [e for e in ev if e.get("tipo") == "enviada" and e.get("trabajo_id")][::-1])
    if task_id not in (None, "", "0", 0):
        for e in cand:
            if e.get("task_id") not in (None, "") and str(e.get("task_id")) == str(task_id):
                return e
    if subtask_name:
        for e in cand:
            if subtask(e) == subtask_name:
                return e
    return None


def cerrar(trabajo_id, tipo, **campos):
    """Cierra ESE trabajo. Si alguien (esta PC u otra) ya lo cerro, no escribe nada y devuelve None."""
    if tipo not in CIERRES:
        raise ValueError(f"cierre desconocido: {tipo}")
    if not trabajo_id or trabajo_id in cerrados():
        return None
    return anotar({"tipo": tipo, "trabajo_id": trabajo_id, **campos})


def confirmar(trabajo_id, **campos):
    """La impresora acepto la orden: el «enviada sin confirmar» pasa a confirmado."""
    return anotar({"tipo": "confirmada", "trabajo_id": trabajo_id, **campos})


def visto_ya(subtask_name, task_id=None, ev=None):
    ev = leer() if ev is None else ev
    return any(e.get("tipo") == "visto" and (e.get("subtask_name") == subtask_name
                                              or (task_id not in (None, "", "0") and str(e.get("task_id")) == str(task_id)))
               for e in ev)


# ---------------- la red y la placa ----------------
def anotar_ip(ip, antes=None):
    """La direccion donde se encontro la impresora (comprobada por su numero de serie), para las otras PC."""
    return anotar({"tipo": "ip", "ip": ip, "serie_ok": True, "antes": antes})


def ips_anotadas(ev=None):
    """Las direcciones que anotaron todas las PC, la mas nueva primero, sin repetir."""
    ev = leer() if ev is None else ev
    out = []
    for e in reversed(ev):
        if e.get("tipo") == "ip" and e.get("serie_ok") and e.get("ip") and e["ip"] not in out:
            out.append(e["ip"])
    return out


def placa_libre(ev=None):
    """Cuando se anoto por ultima vez que alguien saco las piezas (fecha con zona) o None."""
    ev = leer() if ev is None else ev
    fs = [_clave_tiempo(e) for e in ev if e.get("tipo") == "placa_libre"]
    return max(fs) if fs else None


def ultimo_fin(ev=None):
    """Cuando termino (o se vio terminado) el ultimo trabajo: desde ahi la placa tiene piezas hasta un placa_libre."""
    ev = leer() if ev is None else ev
    fs = []
    for e in ev:
        if e.get("tipo") in CIERRES or (e.get("tipo") == "visto" and e.get("estado") in ("FINISH", "FAILED")):
            fs.append(fecha(e.get("fin_visto")) or _clave_tiempo(e))
    return max(fs) if fs else None


# ---------------- rollos ----------------
def nombre_color(hexa):
    """'#000000' -> 'negro' (el mas parecido de la lista de la casa)."""
    try:
        c = tuple(int(hexa.strip("#")[i:i + 2], 16) for i in (0, 2, 4))
    except (ValueError, AttributeError):
        return hexa or "?"
    return min(COLORES, key=lambda n: sum((a - b) ** 2 for a, b in zip(
        c, tuple(int(COLORES[n][i:i + 2], 16) for i in (1, 3, 5)))))


def _consumos(ev):
    """[(orden, chip, gramos, trabajo_id, nota)]: lo que cada trabajo le gasto a cada rollo (orden = lugar del renglon
    «enviada» en el registro ordenado por fecha).
    Terminada = todo; cancelada o fallida = su avance; sin cierre = todo, salvo un «enviada sin confirmar» que la
    impresora nunca acepto (la orden pudo no salir): 0. Si a mitad de impresion cambio el rollo (respaldo), los gramos
    se reparten entre los dos chips en proporcion a las capas (marcado «reparto estimado por capas»)."""
    fin = cerrados(ev)
    confirmadas = {e.get("trabajo_id") for e in ev if e.get("tipo") == "confirmada"}
    cambios = {}
    for e in ev:
        if e.get("tipo") == "cambio de rollo" and e.get("trabajo_id"):
            cambios.setdefault(e["trabajo_id"], []).append(e)
    out = []
    for t, e in enumerate(ev):
        if e.get("tipo") != "enviada" or not e.get("trabajo_id"):
            continue
        tid, c = e["trabajo_id"], fin.get(e["trabajo_id"])
        if c is None:
            frac = 0.0 if (e.get("estado") == "sin confirmar" and tid not in confirmadas) else 1.0
        else:
            frac = 1.0 if c["tipo"] == "terminada" else float(c.get("avance_pct") or 0) / 100
        for fil in e.get("filamentos", []):
            g, chip = float(fil.get("gramos") or 0), fil.get("rollo") or "sin chip"
            cam = next((x for x in cambios.get(tid, []) if x.get("de_chip") == chip and x.get("capas")), None)
            if cam:
                antes = g * min(frac, float(cam.get("capa") or 0) / float(cam["capas"]))
                out.append((t, chip, antes, tid, "reparto estimado por capas"))
                out.append((t, cam.get("a_chip") or "sin chip", max(0.0, g * frac - antes), tid, "reparto estimado por capas"))
            else:
                out.append((t, chip, g * frac, tid, ""))
    return out


def tara_de_la_casa(ev=None):
    """(gramos, medida?) la ultima tara anotada con --tara; sin ninguna, la de la tienda sin medir."""
    ev = leer() if ev is None else ev
    taras = [e for e in ev if e.get("tipo") == "tara" and e.get("gramos") is not None]
    return (float(taras[-1]["gramos"]), True) if taras else (TARA_SIN_MEDIR, False)


def rollo(chip, ev=None):
    """Lo que queda de un rollo: desde la ultima pesada (o «rollo terminado») de ESE chip, o desde 1000 g sin pesar."""
    ev = leer() if ev is None else ev
    base, desde, i0 = ROLLO_NOMINAL, "sin pesar: se cuenta desde 1000 g", None
    for i, e in enumerate(ev):
        if e.get("rollo") != chip:
            continue
        cuando = _clave_tiempo(e)
        if e.get("tipo") == "pesado" and e.get("gramos") is not None:
            base, i0 = float(e["gramos"]), i
            desde = (f"pesado el {cuando:%d/%m %H:%M}: {base:.0f} g netos"
                     + ("" if e.get("tara_medida") else f" (tara sin medir, {e.get('tara')} g)"))
        elif e.get("tipo") in ("rollo terminado", "rollo cargado") and (e.get("tipo") == "rollo terminado"
                                                                       or e.get("gramos") is not None):
            base, i0 = (0.0 if e.get("tipo") == "rollo terminado" else float(e["gramos"])), i
            desde = f"{e['tipo']} el {cuando:%d/%m %H:%M}"
    # se descuenta lo que se mando DESPUES de la pesada (por su lugar en el registro, no por el segundo)
    gastado = sum(g for i, c, g, _, _ in _consumos(ev) if c == chip and (i0 is None or i > i0))
    return {"chip": chip, "quedan": base - gastado, "gastado": gastado, "desde": desde, "pesado": i0 is not None}


def gramos_restantes(chip, ev=None):
    """Gramos que quedan en el rollo de ese chip (una CUENTA: lo que se pesa en la balanza le gana)."""
    return rollo(chip, ev)["quedan"]


def chip_del_lugar(lugar):
    """El chip del rollo que el ultimo --estado de esta PC vio en ese lugar (1 a 4), o None."""
    try:
        v = json.loads(ULTIMO_ESTADO.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    for u in (v.get("ams") or {}).get("ams", []):
        for t in u.get("tray", []):
            if str(t.get("id")) == str(int(lugar) - 1) and t.get("tag_uid") and set(t["tag_uid"]) != {"0"}:
                return t["tag_uid"]
    return None


def pesar(quien, bruto, tara=None):
    """Renglon «pesado»: el rollo montado en la balanza. quien = lugar 1-4 (del ultimo --estado) o el chip."""
    chip = chip_del_lugar(quien) if str(quien).isdigit() and len(str(quien)) == 1 else str(quien)
    if not chip:
        raise SystemExit(f"no se que rollo hay en el lugar {quien}: correr antes bambu_red.py --estado, o pasar el chip")
    medida = tara is not None
    if tara is None:
        tara, medida = tara_de_la_casa()
    neto = float(bruto) - float(tara)
    if neto < 0:
        raise SystemExit(f"la balanza dice {bruto} g y la tara es {tara} g: no puede quedar menos de cero")
    return anotar({"tipo": "pesado", "rollo": chip, "bruto": float(bruto), "tara": float(tara),
                   "tara_medida": bool(medida), "gramos": round(neto, 1),
                   "nota": "" if medida else "tara sin medir (tienda: 250 g; foro: 208-260 g)"})


# ---------------- validar ----------------
def validar(ev=None, ahora_=None):
    """[(nivel, renglon, motivo)] con nivel 'ROJO' o 'AMARILLO'. Lo que no aparece esta verde."""
    ev = leer() if ev is None else ev
    ahora_ = ahora_ or ahora()
    out = []
    env = {e["trabajo_id"]: e for e in ev if e.get("tipo") == "enviada" and e.get("trabajo_id")}
    fin = cerrados(ev)
    confirmadas = {e.get("trabajo_id") for e in ev if e.get("tipo") == "confirmada"}
    for e in ev:
        tipo = e.get("tipo")
        if tipo not in TIPOS:
            out.append(("ROJO", e, f"tipo desconocido: {tipo!r}"))
            continue
        if fecha(e.get("cuando")) is None:
            out.append(("ROJO", e, "sin fecha legible en 'cuando'"))
        if tipo in CON_TRABAJO and not e.get("trabajo_id"):
            out.append(("ROJO", e, "le falta el trabajo_id"))
            continue
        if tipo in CIERRES:
            ini = env.get(e["trabajo_id"])
            if ini is None:
                out.append(("ROJO", e, "cierra un trabajo que no tiene renglon «enviada»"))
                continue
            t0, t1 = _clave_tiempo(ini), _clave_tiempo(e)
            if t1 < t0:
                out.append(("ROJO", e, "el cierre es anterior al envio"))
            pasaron = (t1 - t0).total_seconds() / 60
            m = e.get("minutos_reales")
            if m is not None:
                try:
                    m = float(m)
                except (TypeError, ValueError):
                    out.append(("ROJO", e, f"minutos_reales no es un numero: {m!r}"))
                    continue
                if m > pasaron + 5 or m < pasaron - max(15.0, 0.25 * pasaron):
                    out.append(("ROJO", e, f"los minutos no cierran con las horas: dice {m:g} min y entre el envio "
                                           f"({t0:%d/%m %H:%M}) y el cierre ({t1:%d/%m %H:%M}) pasaron {pasaron:.0f} min; "
                                           "si se cerro a mano despues, va minutos_reales null con una nota"))
            if fin.get(e["trabajo_id"]) is not e:
                out.append(("AMARILLO", e, "segundo cierre del mismo trabajo (cuenta el primero)"))
    for tid, e in env.items():
        if tid in fin:
            continue
        horas = (ahora_ - _clave_tiempo(e)).total_seconds() / 3600
        if e.get("estado") == "sin confirmar" and tid not in confirmadas:
            out.append(("ROJO" if horas > 1 else "AMARILLO", e,
                        "la orden se anoto y la impresora nunca la confirmo (no se cuenta en los gramos)"))
        elif horas > 24:
            out.append(("ROJO", e, f"«enviada» sin cierre hace {horas:.0f} h"))
    chips = {fil.get("rollo") for e in env.values() for fil in e.get("filamentos", []) if fil.get("rollo")}
    for chip in sorted(chips):
        r = rollo(chip, ev)
        if r["quedan"] < 0:
            out.append(("ROJO", {"tipo": "rollo", "rollo": chip, "cuando": ""},
                        f"la cuenta da {r['quedan']:.0f} g (negativo): pesalo con --pesar"))
    return out


def _txt_renglon(e):
    return f"{e.get('cuando', '')[:16]} {e.get('pc', '')} {e.get('tipo')} {e.get('trabajo_id') or e.get('rollo') or ''}".strip()


def resumen():
    ev = leer()
    # un renglon incompleto (sin trabajo, o con un numero vacio) no puede tumbar el resumen
    enviadas = {e["trabajo_id"]: e for e in ev if e.get("tipo") == "enviada" and e.get("trabajo_id")}
    finales = cerrados(ev)
    confirmadas = {e.get("trabajo_id") for e in ev if e.get("tipo") == "confirmada"}
    horas, n_ok, n_mal, comparar = 0.0, 0, 0, []
    for tid, e in enviadas.items():
        fin = finales.get(tid)
        if fin is None:
            sin_conf = e.get("estado") == "sin confirmar" and tid not in confirmadas
            fraccion, minutos = (0.0, 0) if sin_conf else (1.0, e.get("minutos_estimados") or 0)
        else:
            estado = fin["tipo"]
            fraccion = 1.0 if estado == "terminada" else float(fin.get("avance_pct") or 0) / 100
            minutos = fin.get("minutos_reales")
            if minutos is None:
                minutos = (e.get("minutos_estimados") or 0) * fraccion
            elif estado == "terminada" and e.get("minutos_estimados"):
                comparar.append((e.get("pieza") or tid, float(e["minutos_estimados"]), float(minutos)))
            n_ok += estado == "terminada"
            n_mal += estado != "terminada"
        horas += float(minutos or 0) / 60
    print(f"IMPRESIONES anotadas: {len(enviadas)}  (terminadas {n_ok}, falladas o canceladas {n_mal})  "
          f"| PC que anotaron: {sorted({e.get('pc', '?') for e in ev})}")
    print(f"HORAS de impresion: {horas:.1f}")
    nombres = {}
    for e in enviadas.values():
        for fil in e.get("filamentos", []):
            nombres.setdefault(fil.get("rollo") or "sin chip", (fil.get("material", ""), fil.get("color", "")))
    print("ROLLOS (por numero de chip; la impresora no informa lo que queda: es una cuenta, la balanza le gana):")
    gastado = 0.0
    for chip, (mat, col) in nombres.items():
        r = rollo(chip, ev)
        gastado += r["gastado"]
        aviso = ""
        if r["quedan"] < ROLLO_SOLO_CHICAS:
            aviso = "  <-- MENOS DE 50 g: solo piezas chicas de dia o con un rollo de respaldo igual; pesalo"
        elif r["quedan"] < ROLLO_PESALO:
            aviso = "  <-- menos de 100 g: pesalo (registro.py --pesar)"
        print(f"  {mat} {nombre_color(col)} {col}  chip {chip[:8]}: quedan ~{max(0, r['quedan']):.0f} g "
              f"({r['desde']}){aviso}")
    try:
        v = json.loads(ULTIMO_ESTADO.read_text(encoding="utf-8"))
        cuando = datetime.fromtimestamp(ULTIMO_ESTADO.stat().st_mtime)
        lug = []
        for u in (v.get("ams") or {}).get("ams", []):
            for t in u.get("tray", []):
                if t.get("tray_type") or t.get("tray_info_idx"):
                    lug.append(f"lugar {int(t.get('id', 0)) + 1}: {t.get('tray_sub_brands') or t.get('tray_type')} "
                               f"{nombre_color('#' + (t.get('tray_color') or '')[:6])} chip {(t.get('tag_uid') or '-')[:8]}")
        print(f"EN EL CARGADOR (ultimo --estado de esta PC, {cuando:%d/%m %H:%M}): " + (" | ".join(lug) or "vacio"))
    except (OSError, ValueError):
        print("EN EL CARGADOR: esta PC no tiene un --estado guardado")
    if comparar:
        print("ESTIMADO CONTRA REAL (terminadas que se vieron terminar):")
        for pieza, est, real in comparar[-10:]:
            print(f"  {pieza}: estimado {est:.0f} min, real {real:.0f} min ({(real - est) / est * 100:+.1f} %)")
    gastado = sum(g for _, _, g, _, _ in _consumos(ev))      # todos los rollos, desde el principio
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
        desde = fecha(ult) or (_clave_tiempo(ev[0]) if ev else None)   # sin anotar: se cuenta desde el primer uso
        pasaron = (ahora() - desde).days if desde else None
        print(f"  {que}: cada {dias} dias -> ultimo anotado: {ult or 'nunca'}"
              + ("  <-- TOCA" if pasaron is None or pasaron >= dias else ""))
    return 0


def _main(argv):
    if len(argv) >= 3 and argv[1] == "--anotar":
        print(anotar(json.loads(argv[2])))
        return 0
    if len(argv) >= 4 and argv[1] == "--pesar":
        tara = float(argv[argv.index("--tara") + 1]) if "--tara" in argv else None
        e = pesar(argv[2], float(argv[3].replace(",", ".")), tara)
        print(f"anotado: rollo {e['rollo'][:8]} con {e['gramos']:.0f} g netos (balanza {e['bruto']:.0f} g - tara "
              f"{e['tara']:.0f} g{'' if e['tara_medida'] else ', sin medir'})")
        return 0
    if len(argv) >= 3 and argv[1] == "--tara":
        e = anotar({"tipo": "tara", "gramos": float(argv[2].replace(",", ".")),
                    "nota": "carrete vacio pesado: tara de la casa"})
        print(f"anotada la tara de la casa: {e['gramos']:.0f} g")
        return 0
    if len(argv) >= 2 and argv[1] == "--placa-libre":
        e = anotar({"tipo": "placa_libre", "nota": " ".join(argv[2:])})
        print("anotado: placa libre", e["cuando"], "(ya se puede mandar la proxima impresion)")
        return 0
    if len(argv) >= 2 and argv[1] == "--validar":
        hall = validar()
        for nivel, e, motivo in hall:
            print(f"{nivel:8} {_txt_renglon(e)}: {motivo}")
        rojos = sum(1 for n, _, _ in hall if n == "ROJO")
        print(f"{len(leer())} renglones: {rojos} en rojo, {len(hall) - rojos} en amarillo, el resto en verde")
        return 1 if rojos else 0
    return resumen()


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(errors="replace")
        sys.stderr.reconfigure(errors="replace")
    except (AttributeError, ValueError):
        pass
    try:
        sys.exit(_main(sys.argv))
    except KeyboardInterrupt:
        print("cortado a mano")
        sys.exit(130)
    except (OSError, ValueError) as e:
        print(f"no se pudo: {type(e).__name__}: {e}")
        sys.exit(1)
