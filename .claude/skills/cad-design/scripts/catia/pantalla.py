"""pantalla.py: lleva la ventana de MI CATIA (el pid de mi_catia.json) a la segunda pantalla y la maximiza.
Fak (19/10): «mantener en la segunda pantalla siempre catia abierto asi voy viendo los cambios». Solo mueve la ventana
(no teclea ni hace clic). Uso: python pantalla.py [pid]."""
import json
import os
import sys

import win32api
import win32con
import win32gui
import win32process


def monitores():
    return [win32api.GetMonitorInfo(h[0]) for h in win32api.EnumDisplayMonitors()]


def ventana_principal(pid):
    hs = []

    def cb(h, _):
        if (win32process.GetWindowThreadProcessId(h)[1] == pid and win32gui.GetParent(h) == 0
                and win32gui.GetWindowText(h).startswith("CATIA V5")):
            hs.append(h)
    win32gui.EnumWindows(cb, None)
    return hs[0] if hs else None


def elegir_monitor(mons, cual=2, primaria=1):
    """De la lista de monitores (GetMonitorInfo), la segunda pantalla = la que NO es la principal. Con una sola, None."""
    if len(mons) < 2:
        return None
    sec = [m for m in mons if not (m["Flags"] & primaria)]
    return sec[0] if cual == 2 and sec else mons[0]


def mover(pid, cual=2):
    mons = monitores()
    m = elegir_monitor(mons, cual, win32con.MONITORINFOF_PRIMARY)
    if m is None:
        return f"hay {len(mons)} pantalla: no muevo nada"
    h = ventana_principal(pid)
    if not h:
        return "no encontre la ventana de CATIA"
    x0, y0, x1, y1 = m["Work"]
    win32gui.ShowWindow(h, win32con.SW_RESTORE)
    win32gui.MoveWindow(h, x0, y0, x1 - x0, y1 - y0, True)
    win32gui.ShowWindow(h, win32con.SW_MAXIMIZE)
    return f"CATIA en la pantalla {m['Device']} {m['Work']}"


if __name__ == "__main__":
    from catia_base import ESTADO
    pid = int(sys.argv[1]) if len(sys.argv) > 1 else json.load(open(ESTADO))["pid"]
    print(mover(pid))
