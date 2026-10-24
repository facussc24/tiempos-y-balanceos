# -*- coding: utf-8 -*-
"""Ejercicio 39 del banco de CATIA (fase 2, segunda tanda, 24/10/2026): biela-manivela con DMU Kinematics. Manivela
r = 30 que gira en el origen sobre Z, biela l = 80, corredera que desliza sobre X; tres articulaciones de revolucion y una
prismatica, comando de angulo en la primera (macro VBScript: las listas de referencias no pasan desde Python).

Geometria y mecanismo: ej49_biela.py de la practica del 19/10 copiado SIN cambios (sha256 29a51e3efcb376f2...). Este
catia.py lo corre dentro del juez y despues, sobre el MISMO mecanismo, lee la posicion completa de la biela y de la
corredera en cada angulo (un control que el ej49 no tenia).

Respuesta conocida (cinematica de la biela-manivela, geometria del triangulo manivela-biela-guia):
- corredera en x = r cos t + raiz(l^2 - r^2 sen^2 t) para t = 0, 30, 60, 90, 120 y 180 (110; 104,5619; 90,6637;
  74,1620; 60,6637; 50);
- el origen de la biela (su eje P) en el boton de la manivela: (r cos t, +-r sen t), a r = 30 del origen; la corredera
  sobre la guia (y = 0, z = 0);
- el mecanismo con 1 grado de libertad comandado, 4 articulaciones y 1 comando («1;4;1»: NbDof cuenta el grado que mueve
  el comando, ejercicio 17).
La cuenta de la corredera es par en t (sen^2): no ve el sentido del giro ni un brazo de la manivela mal puesto que deje
el boton en otro lado con el mismo x; por eso el boton de la manivela se mide aparte (el sentido del giro se acepta en
los dos: se exige el mismo en todos los angulos y el boton a r del origen en el angulo pedido).

ok = los pasos sin falla Y «1;4;1» Y en los seis angulos: corredera a 0,001 mm de la cuenta, en y = 0 y z = 0 a 0,001, y el
origen de la biela a 0,001 mm de (r cos t, r sen t) o de (r cos t, -r sen t), el mismo signo en todos los angulos.
Uso: python catia.py <carpeta de trabajo>  ->  salida.json, las cuatro CATPart y el registro.
"""
import json
import math
import os
import sys
import traceback

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(os.path.dirname(AQUI)))      # juez_comun
import juez_comun as jc  # noqa: E402

EJ = "39_biela_manivela_dmu"
R, L = 30.0, 80.0
ANGULOS = (0, 30, 60, 90, 120, 180)
TOL_MM = 0.001
GDL_ESPERADO = "1;4;1"
MACRO_POS12 = """Function CATMain(p)
    Dim a(11)
    p.Position.GetComponents a
    s = a(0)
    For i = 1 To 11
        s = s & ";" & a(i)
    Next
    CATMain = s
End Function"""


def x_cuenta(t):
    t = math.radians(t)
    return R * math.cos(t) + math.sqrt(L ** 2 - (R * math.sin(t)) ** 2)


def construir(cb, c, reg, salida):
    if AQUI not in sys.path:
        sys.path.insert(0, AQUI)
    import ej49_biela as ej                 # recien aca: catia_base ya tomo la carpeta de trabajo del juez
    if (ej.R, ej.L) != (R, L):
        raise RuntimeError(f"el ej49 copiado no trae r y l del ejercicio: {ej.R} {ej.L}")
    ej.cuerpo(c, reg)
    salida["ej49"] = reg.datos.get("resultado")

    def posiciones():
        prod = c.ActiveDocument.Product
        mec = prod.GetTechnologicalObject("Mechanisms").Item(1)
        bie, cor = prod.Products.Item(3), prod.Products.Item(4)
        ev = c.SystemService.Evaluate
        out = {}
        for t in ANGULOS:
            ev(ej.MACRO_ANG, 0, "CATMain", [mec, float(t)])
            prod.Update()
            out[t] = {"biela": ej.num(ev(MACRO_POS12, 0, "CATMain", [bie]))[9:12],
                      "corredera": ej.num(ev(MACRO_POS12, 0, "CATMain", [cor]))[9:12]}
        return out
    salida["posiciones"] = reg.paso("posicion de la biela y de la corredera en cada angulo (mismo mecanismo)", posiciones)


def comparar(s):
    """Lo que no cierra contra la cinematica. Lista vacia = bien."""
    malos = []
    e = s.get("ej49") or {}
    if e.get("dof_articulaciones_comandos") != GDL_ESPERADO:
        malos.append(f"mecanismo {e.get('dof_articulaciones_comandos')} y no {GDL_ESPERADO}")
    pos = s.get("posiciones") or {}
    signos = set()
    for t in ANGULOS:
        p = pos.get(str(t)) or pos.get(t)
        if not p:
            malos.append(f"{t} grados: sin posiciones")
            continue
        xc, yc, zc = p["corredera"]
        if not (abs(xc - x_cuenta(t)) <= TOL_MM and abs(yc) <= TOL_MM and abs(zc) <= TOL_MM):   # NaN = rojo
            malos.append(f"{t} grados: corredera en ({xc}, {yc}, {zc}) y la cuenta da ({x_cuenta(t):.4f}, 0, 0)")
        xb, yb, zb = p["biela"]
        bx, by = R * math.cos(math.radians(t)), R * math.sin(math.radians(t))
        cerca = [sg for sg in (1, -1) if abs(xb - bx) <= TOL_MM and abs(yb - sg * by) <= TOL_MM and abs(zb) <= TOL_MM]
        if not cerca:
            malos.append(f"{t} grados: el eje P de la biela en ({xb}, {yb}, {zb}) y el boton de la manivela en "
                         f"({bx:.4f}, +-{by:.4f}, 0)")
        elif abs(by) > TOL_MM:
            signos.add(cerca[0])
    if len(signos) > 1:
        malos.append("la manivela cambia de sentido entre angulos")
    return malos


def cerrar_con_cinematica(carpeta):
    """Idempotente: el error del juez queda aparte (error_juez) y el de este cierre se rearma cada vez."""
    ruta = os.path.join(carpeta, "salida.json")
    with open(ruta, encoding="utf-8") as f:
        s = json.load(f)
    s["ok_pasos"] = bool(s.get("ok_pasos", s.get("ok")))
    s.pop("pendiente", None)
    if "error_juez" not in s:
        s["error_juez"] = s.get("error")
    s.pop("error", None)
    malos = comparar(s)
    s["ok_cinematica"] = not malos
    s["ok"] = s["ok_pasos"] and not malos and not s["error_juez"]      # un error del juez nunca queda con verde
    texto = "; ".join(([s["error_juez"]] if s["error_juez"] else []) + malos)
    if texto:
        s["error"] = texto
    with open(ruta, "w", encoding="utf-8") as f:
        json.dump(s, f, ensure_ascii=False, indent=1, default=str)
    print("FIN_BIELA", json.dumps({"ok": s["ok"], "malos": malos}))
    return s


if __name__ == "__main__":
    codigo = jc.correr_ejercicio(EJ, construir, con_bien=False)
    if codigo == 0 and len(sys.argv) >= 2:
        try:
            cerrar_con_cinematica(os.path.abspath(sys.argv[1]))
        except Exception:  # noqa: BLE001
            print("no se pudo comparar con la cinematica:", traceback.format_exc()[-400:], file=sys.stderr)
            codigo = 1
    sys.exit(codigo)
