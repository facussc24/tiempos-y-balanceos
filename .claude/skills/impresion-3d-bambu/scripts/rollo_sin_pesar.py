"""Gate 3h (viernes 23/10/2026): un rollo que nunca se peso ni se anoto como nuevo NO vale 1000 g: vale «no se».

Falla real, 22/10/2026: a las 14:41 se mando la PLACA v5 pidiendo 51 g del negro del lugar 4 (chip ECE217DC00000100). El
registro no tenia ninguna pesada de ese rollo y la cuenta arrancaba de los 1000 g nominales («quedan ~683 g»); el rollo se
termino a las 15:32 (pausa del cargador) y Fak puso uno nuevo a las 16:28. Fak, 19:23 (textual, con sus typos): «nucna
deberia haberme uqedado sin filamento en teoria vos calcualbas cuanto habia un clarao ejemeplo de que te ocnfuist eo no
se... dejalo antoado apra el vinres asi averiguamos el orgien de esta falla»; 19:29: «si le tuve que poner un rorllo
blanco nuevo y lo otmo igual». La impresora tampoco lo sabe: `remain = -1` en cada lugar (registro.py, 13/10/2026).

Que hace: por cada lugar del cargador que el trabajo usa, si registro.rollo(chip)["pesado"] es False (ni pesada, ni «rollo
cargado» con gramos, ni «rollo terminado» confirmado), hasta rolloCanon.aviso_hasta AVISA y se manda igual; desde
freno_desde NO SE MANDA. Salida: --sin-pesar --acepto "<frase textual de Fak>". Un rollo pesado alguna vez pasa: la cuenta
descuenta lo mandado desde esa pesada, y eso si es un dato. BAMBU_HOY=AAAA-MM-DD cambia «hoy» (los tests).
"""
import json
import os
from datetime import date
from pathlib import Path

CANON = Path(__file__).with_name("rolloCanon.data.json")


def canon():
    return json.loads(CANON.read_text(encoding="utf-8"))


def hoy():
    h = os.environ.get("BAMBU_HOY", "").strip()
    return date.fromisoformat(h) if h else date.today()


def modo(can=None, dia=None):
    """'aviso' hasta aviso_hasta inclusive, 'freno' desde el dia siguiente."""
    can = can or canon()
    dia = dia or hoy()
    return "aviso" if dia <= date.fromisoformat(can["aviso_hasta"]) else "freno"


def frase_valida(frase, can=None):
    can = can or canon()
    return frase is not None and len(frase.strip()) >= int(can.get("frase_minima", 10))


def gate(rollos, dia=None, aplicar=False, sin_pesar=False, acepto=None, rollo=None, can=None):
    """`rollos`: [(lugar 1-4, chip, nombre del color)] que el trabajo usa; `rollo(chip)` -> el dict de registro.rollo().
    Devuelve {'lineas': [...], 'fallas': [...], 'frena': bool, 'sin_pesar': [chips], 'frase': str | None}."""
    can = can or canon()
    dia = dia or hoy()
    if rollo is None:
        import registro
        rollo = registro.rollo
    salida = f'--sin-pesar --acepto "<frase textual de Fak, {can.get("frase_minima", 10)} caracteres o mas>"'
    if sin_pesar and not frase_valida(acepto, can):
        return {"lineas": [f"NO SE MANDA: --sin-pesar necesita la frase de Fak ({salida})"],
                "fallas": ["--sin-pesar sin la frase de Fak"], "frena": True, "sin_pesar": [], "frase": None}
    lineas, fallas, sin = [], [], []
    for lugar, chip, nombre in rollos:
        if not chip:
            continue
        info = rollo(chip) or {}
        if info.get("pesado"):
            continue
        sin.append(chip)
        cuenta = float(info.get("quedan") or 0)
        que = (f"el {nombre or 'rollo'} del lugar {lugar} ({chip}) nunca se peso ni se anoto como nuevo: «quedan ~{cuenta:.0f} g» "
               f"es una cuenta desde {can.get('nominal_g', 1000)} g, no un dato (22/10: el negro se termino asi). Pesalo: "
               f"registro.py --pesar {lugar} <gramos de la balanza>; si es nuevo: registro.py --rollo-nuevo {lugar}")
        if sin_pesar:
            lineas.append(f"ROLLO SIN PESAR por pedido de Fak «{acepto.strip()}»: {que}")
        elif modo(can, dia) == "aviso":
            lineas.append(f"AVISO [GATE rollo sin pesar]: {que}. Hasta el {can['aviso_hasta']} se manda igual; desde el "
                          f"{can['freno_desde']} NO SE MANDA (salida: {salida})")
        else:
            fallas.append(f"[GATE rollo sin pesar] {que}. Salida: {salida}")
    return {"lineas": lineas, "fallas": fallas, "frena": bool(fallas), "sin_pesar": sin,
            "frase": acepto.strip() if (sin_pesar and sin) else None}
