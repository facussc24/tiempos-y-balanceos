# -*- coding: utf-8 -*-
"""
Hojas de proceso de la PRENSA DE EMBOSSING Jfortune — Upper Trim Panel Patagonia (Cozzuol).
Formulario SGC I-IN-002.4-R01, el mismo formato que la HOTMELT y la MOLDEADORA IMG.

Pedido de Carlos Baptista, 24/09/2026 (mail "instructivos maquinas de Embossing"): pasar a
formato Barack el instructivo que el armo del video y el manual del proveedor.

El formato, los bloques y los gates son los de `scripts/img/generar_hojas_img.py`: se
IMPORTAN, no se copian. Aca vive solo lo que es de esta maquina: las hojas y sus fuentes.

Fuentes (todo lo que dice una hoja sale de aca, con su pagina o su segundo):
  - manual del proveedor `Suzhou Jfortune machine manual.pdf` (en ingles; la traduccion
    `Manual_Maquina_Suzhou_Jfortune_ES.pdf` de Carlos coincide paso por paso)
  - video del proveedor `preview.mp4`, 125 s, subtitulado en ingles (la transcripcion son los
    subtitulos: `scripts/embossing/transcripcion_preview.txt`)
  Los dos en `...\\Upper Trimming\\_BACKUP_UpperTrim_2026-07-01\\APQP\\28- Corrida de Produccion
  \\01- Try Out Embossing Machine JFortune`.

N° de operacion: TBD. El Upper Trim no tiene flujograma en el Listado Maestro (llega hasta el
159) y la numeracion la manda el flujograma (no-pfd-no-ho.md). Las hojas van TBD.1 a TBD.6.

Lo que ninguna fuente dice NO se escribe (core-prohibiciones §1): va a `falta.txt`.

    py -3 scripts/embossing/preparar_fotos.py          # las fotos, con su procedencia
    py -3 scripts/embossing/generar_hojas_embossing.py # el deck
    py -3 .claude/skills/hojas-de-proceso/scripts/hoja_proceso_check.py \\
          "scripts/embossing/HOJAS DE PROCESO - PRENSA EMBOSSING.pptx" \\
          --spec scripts/embossing/spec_gate_embossing.py
"""
import importlib.util
import os
import re
import sys

from pptx import Presentation
from pptx.util import Cm

AQUI = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(AQUI, "..", ".."))

# el generador de la IMG es la libreria: formato, bloques y gates
_spec = importlib.util.spec_from_file_location(
    "generar_hojas_img", os.path.join(REPO, "scripts", "img", "generar_hojas_img.py"))
G = importlib.util.module_from_spec(_spec)
sys.modules["generar_hojas_img"] = G
_spec.loader.exec_module(G)

A = os.path.join(AQUI, "assets")
SALIDA = os.path.join(AQUI, "HOJAS DE PROCESO - PRENSA EMBOSSING.pptx")
PLANCHA = os.path.join(A, "_plancha_del_deck.jpg")


def _f(n):
    return os.path.join(A, n)


EPP_OPERACION = [G.ICO_ROPA, G.ICO_CALZADO]
# el molde se calienta (controlador de temperatura, manual pag. 5; resistencias, pag. 3):
# se agarra con guantes. Deducido del riesgo del puesto, no de un set generico.
EPP_MOLDE = [G.ICO_ROPA, G.ICO_CALZADO, G.ICO_GUANTES]

CAJETIN = dict(
    titulo_hoja="HOJA DE OPERACIONES",
    ho="HO-TBD",
    form="I-IN-002.4-R01",
    modelo="PATAGONIA",
    cliente="COZZUOL",
    sector="TBD",
    pieza="UPPER TRIM PANEL — 2HC.864.263.C (ONE) / 2HC.864.263.B (TWO WIRELESS)",
    puesto="-",
    realizo="F. Santoro",
    aprobo="",          # sin firmar: lo aprueba C. Baptista cuando lo vea
    fecha="24/09/2026",
    rev="-",
)

PORTADA = dict(
    titulo="HOJAS DE PROCESO — PRENSA DE EMBOSSING",
    subtitulo="Marcado del logo de carga inalámbrica sobre la tela · UPPER TRIM PANEL PATAGONIA",
    ho="HO-TBD",
    form="I-IN-002.4-R01",
    op_flujo="TBD",
    cliente_modelo="COZZUOL / VW PATAGONIA",
    pieza="UPPER TRIM PANEL — 2HC.864.263.C / 2HC.864.263.B",
    maquina="Prensa servo con molde calefaccionado — Suzhou Jfortune",
    firmas="F. Santoro / C. Baptista",
    fecha_rev="24/09/2026",
    foto=_f("m_portada.jpg"),
)

# Que entra y que sale de la operacion. Sin flujograma ni AMFE del Upper Trim, sale de la
# cotizacion del proveedor y del manual.
MATERIALES = [
    ("la pieza que se marca", r"\bpieza\b",
     "cotizacion JF202606012: UPPER TRIM PANEL_EMBOSSING; manual pag. 6: «place a product»"),
    ("el molde (uno por variante: one y two wireless)", r"\bmolde\b",
     "cotizacion JF202606012: «Tooling for one logo» / «Tooling for two logos»"),
]

HOJAS = [
    # ── PRENDER ──────────────────────────────────────────────────────────────
    dict(
        op="TBD.1",
        denominacion="ENCENDIDO DE LA PRENSA",
        modo="rotulada",
        imagenes=[_f("r1_tablero.jpg")],
        pasos=[
            "Girar la llave general a encendido y verificar que se prenda la luz amarilla.",
            "Apretar el botón verde de arranque.",
            "Presionar la pantalla para entrar a la pantalla de operación.",
            "Apretar el botón rojo cuando haya que parar la prensa.",
            "Verificar que el botón de parada de emergencia esté destrabado, y presionarlo "
            "ante cualquier riesgo.",
        ],
        fuentes=[
            "manual pag. 4 Fig. 1 ①: «Turn on the power switch» (chapa 电源开关); preview.mp4 "
            "s=0 a 1,75: la luz amarilla se prende antes de tocar los botones",
            "preview.mp4 s=2 a 4,5: «First press this servo motor button», la mano en el verde; "
            "s=7,75 a 9: «ok, start button»; manual pag. 4 Fig. 1 ②: «press Start» (chapa 启动)",
            "preview.mp4 s=9,5 a 11: «enter into running screen»; manual pag. 4: «tap the screen "
            "to enter the run interface»",
            "preview.mp4 s=5 a 6,75: «This is stop button», la mano en el rojo (chapa 停止)",
            "manual pag. 4 Fig. 1: el hongo rojo arriba de la pantalla; manual pag. 5: la chapa "
            "急停 (parada de emergencia) debajo del controlador, arriba del hongo; instructivo "
            "de Carlos pag. 2: «Verificar que el hongo rojo este liberado y accesible»",
        ],
        epp=EPP_OPERACION,
        disparador="SI LA PRENSA NO ENCIENDE O LA PANTALLA NO RESPONDE",
        acciones=[
            "1. No insistir con la llave ni con los botones.",
            "2. Dar aviso al Líder de Producción y a Mantenimiento.",
            "3. Esperar la intervención del personal autorizado.",
        ],
    ),

    dict(
        op="TBD.2",
        denominacion="AJUSTE Y CONTROL DE TEMPERATURA DEL MOLDE",
        modo="rotulada",
        imagenes=[_f("r2_temperatura.jpg")],
        pasos=[
            "Esperar a que el número rojo (temperatura real) llegue al número verde "
            "(temperatura seteada) y quede ahí antes de producir.",
            "Apretar SET para cambiar la temperatura y esperar a que el número verde titile.",
            "Pasar de un dígito al otro con este botón.",
            "Bajar el valor con este botón.",
            "Subir el valor con este botón y apretar SET otra vez para confirmar: el número "
            "verde deja de titilar.",
        ],
        fuentes=[
            "manual pag. 5, traduccion de Carlos: «el valor rojo superior corresponde a la "
            "temperatura real (PV) y el valor verde inferior a la temperatura seteada (SV)»; en "
            "la foto se leen las siglas PV y SV al lado de cada numero",
            "manual pag. 5 paso 1: «Press button ①. When the green text flashes...»",
            "manual pag. 5 paso 1: «② to switch the digit position»",
            "manual pag. 5 paso 1: «③ to decrease the temperature»",
            "manual pag. 5 paso 1: «④ to increase it»; paso 2: «Press button ① again to "
            "confirm. The green text stays on, meaning the setting is complete»",
        ],
        # auditoria independiente 24/09 (B1, B2): la foto marca 174 con 125 seteado y nada
        # decia que son numeros de ejemplo; y los pasos 2 a 5 no decian quien cambia la
        # temperatura ni con que valor. Generico, sin inventar el valor (Fak: ni un TBD).
        nota="Los números de la foto son del proveedor. La temperatura la cambia el personal "
             "autorizado por el Líder, con el valor validado para la pieza y el molde.",
        epp=EPP_OPERACION,
        disparador="SI LA TEMPERATURA REAL NO LLEGA A LA SETEADA O SE PASA",
        acciones=[
            "1. No producir.",
            "2. Dar aviso al Líder de Producción.",
            "3. Esperar la definición del Líder.",
        ],
    ),

    dict(
        op="TBD.3",
        denominacion="ARRANQUE EN AUTOMATICO Y RETORNO A ORIGEN",
        modo="rotulada",
        imagenes=[_f("r3_pantalla.jpg")],
        pasos=[
            "Presionar el selector MANUAL / AUTOMÁTICO de la pantalla para pasar a automático.",
            "Presionar VOLVER A ORIGEN y esperar a que el plato llegue a su posición de origen.",
            "Presionar PONER A CERO cuando el Líder indique llevar a cero el contador de "
            "piezas.",
        ],
        nota="Al prender, la prensa está en manual. Volver a origen cada vez que se pasa a "
             "automático: sin eso la prensa no hace el ciclo.",
        fuentes=[
            "preview.mp4 s=12 a 13: «The default mode is manual mode»; s=23 a 24: «And then "
            "change into auto mode»; manual pag. 4 Fig. 2 ③: «Tap the Manual/Auto switch at the "
            "top center to enter Auto mode»",
            "preview.mp4 s=26 a 39: «Each time need to return home position» / «Only return to "
            "home position and then this machine can run» / «ok, return to home position»; "
            "manual pag. 4 Fig. 2 ④: «tap Home to return the machine to origin» (boton 回原点)",
            "preview.mp4 s=108 a 111: «Click here to reset production to zero» (boton 产量清零)",
        ],
        epp=EPP_OPERACION,
        disparador="SI LA PRENSA NO VUELVE A ORIGEN O LA PANTALLA MUESTRA UNA ALARMA",
        acciones=[
            "1. No repetir el arranque.",
            "2. Anotar lo que muestra la pantalla.",
            "3. Dar aviso al Líder de Producción.",
        ],
    ),

    # ── PRODUCIR ─────────────────────────────────────────────────────────────
    dict(
        op="TBD.4",
        denominacion="EMBOSSING DEL LOGO CON MANDO BIMANUAL",
        modo="secuencia",
        columnas=True,            # fotos verticales: tres columnas, no 2 arriba y 1 abajo
        # El orden es el del CICLO: poner, apretar, sacar. La revision ciega del 24/09 lo
        # marco: con "apretar" primero, el primer ciclo se hace sin pieza. En el video la
        # pieza se saca (s=60) antes de poner la siguiente (s=69): son dos momentos de la
        # demostracion, no el orden de un ciclo.
        ciclos_distintos=True,
        imagenes=[_f("v_colocar.jpg"), _f("m_bimanual.jpg"), _f("v_retirar.jpg")],
        pies=["La pieza nueva, debajo del molde",
              "Una mano en cada caja naranja",
              "La mano en la pieza marcada"],
        sin_marcas_ok=True,
        pasos=[
            "Colocar la pieza sobre la base, bien apoyada, con la zona del logo debajo del "
            "molde.",
            "Apretar a la vez los botones de las dos cajas naranjas, uno con cada mano, y "
            "mantenerlos apretados hasta que el plato empiece a subir.",
            "Retirar la pieza marcada con el plato arriba.",
        ],
        # auditoria independiente 24/09 (B3): la seguridad del bimanual estaba en el
        # instructivo de Carlos (pags. 2 y 8) y se habia perdido
        nota="Hacer el ciclo solo con la prensa en automático y en origen (hoja de arranque). "
             "No trabar ni puentear ningún botón. El molde está caliente: trabajar con guantes.",
        fuentes=[
            "preview.mp4 s=67,5 a 70,5: las manos llevan la pieza debajo del molde; manual "
            "pag. 6 Fig. 3: la pieza apoyada sobre la base; instructivo de Carlos pag. 9: "
            "«bien asentada y centrada»; el molde marca el logo del cargador (cotizacion "
            "JF202606012, un molde de un logo y uno de dos)",
            "manual pag. 4 Fig. 3: «Press both Start buttons with both hands to run»; "
            "preview.mp4 s=44 a 57: las dos manos en las cajas naranjas; manual pag. 2: cada "
            "caja naranja lleva un boton verde arriba; instructivo de Carlos pag. 8: «Mantener "
            "ambas manos en los pulsadores hasta que el plato comience a subir» y pag. 2: «No "
            "puentear ni bloquear un pulsador»",
            "preview.mp4 s=59,5 a 62,5: la mano toma la pieza de abajo del molde, con el plato "
            "arriba",
        ],
        # guantes: las manos van debajo del molde calefaccionado en cada ciclo (lo marco la
        # revision ciega; antes estaban solo en el cambio de molde)
        epp=EPP_MOLDE,
        acciones=[
            "1. Apartar la pieza e identificarla.",
            "2. Dar aviso al Líder de Producción.",
            "3. No tocar parámetros por cuenta propia.",
        ],
    ),

    # ── SET UP ───────────────────────────────────────────────────────────────
    dict(
        op="TBD.5",
        denominacion="AJUSTE DE PARAMETROS DE CARRERA",
        modo="rotulada",
        imagenes=[_f("r5_parametros.jpg")],
        pasos=[
            "Cargar la posición rápida: hasta dónde baja el plato a velocidad rápida.",
            "Cargar la velocidad rápida.",
            "Cargar la posición lenta: es la carrera total del plato.",
            "Cargar la velocidad lenta, la del último tramo.",
            "Cargar el tiempo de presión: lo que el plato se queda abajo.",
        ],
        # sin valores: Fak, 24/09/2026, "no puede haber ni 1 TBD" en la descripcion. Lo que no
        # se sabe se escribe generico con lo que hay (la frase de la nota es de Carlos, pag. 10
        # de su instructivo: "valores de referencia del proveedor: validarlos para cada pieza")
        # auditoria independiente 24/09 (B2, S4): quien los carga y la regla de Carlos pag. 10
        nota="Los carga el personal autorizado por el Líder, con los valores validados para "
             "la pieza y el molde: los de la foto son del proveedor. La posición lenta tiene "
             "que ser mayor que la rápida. Se entra por la segunda solapa de abajo de la "
             "pantalla de operación; para cambiar un valor, presionarlo y cargar el nuevo.",
        fuentes=[
            "preview.mp4 s=74 a 75: «here is the machine parameter»; s=81 a 82: «this is "
            "Fast-forward distance» (快速位置)",
            "preview.mp4 s=83 a 84: «Fast-forward speed» (快速速度)",
            "preview.mp4 s=85 a 91: «The slow-in position corresponds to the slow-in speed» / "
            "«The slow-in position is the entire length, the whole stroke» (慢速位置)",
            "preview.mp4 s=93: «Slow-in speed» (慢速速度)",
            "preview.mp4 s=94: «Pressure-holding Time» (保压时间)",
        ],
        epp=EPP_OPERACION,
        disparador="SI UN VALOR NO SE PUEDE CARGAR O LA PRENSA NO RESPETA LA CARRERA",
        acciones=[
            "1. No producir.",
            "2. Dar aviso al Líder de Producción.",
            "3. Esperar la definición del Líder.",
        ],
    ),

    dict(
        op="TBD.6",
        denominacion="CAMBIO DE MOLDE",
        hoja_de=(1, 2),
        modo="secuencia",
        # sin la Fig. 2 de la pag. 6: no correspondia a ningun paso y mostraba un dedo en el
        # punto de aplastamiento, debajo del plato (revision ciega, 24/09/2026)
        imagenes=[_f("s1_selector_manual.jpg"), _f("s2_bajar.jpg"),
                  _f("m_molde_tornillos.jpg")],
        pies=["El selector MANUAL / AUTOMÁTICO",
              "El botón BAJAR",
              "El molde apoyado sobre la pieza"],
        sin_marcas_ok=True,
        pasos=[
            "Presionar el selector MANUAL / AUTOMÁTICO de la pantalla para pasar a manual.",
            "Colocar una pieza sobre la base y mantener apretado BAJAR.",
            "Soltar BAJAR apenas el molde apoye sobre la pieza, sin aplastarla, y sacar los "
            "cuatro tornillos del molde con la llave Allen.",
        ],
        nota="Hay un molde para cada pieza: el de un logo (one wireless) y el de dos logos "
             "(two wireless). No poner las manos debajo del plato mientras se aprieta BAJAR o "
             "SUBIR. El molde se calienta: manipularlo con guantes.",
        fuentes=[
            "manual pag. 6 paso 1: «tap the Manual/Auto switch at the top center to enter "
            "Manual mode»; preview.mp4 s=15 a 16: «if want to change mold»",
            "manual pag. 6 paso 1: «Press and hold Down at the lower right to close the mold» y "
            "nota: «Place a product first to protect the mold»",
            "manual pag. 6 paso 1: «stop at the position in Fig. 2»; paso 2: «Remove the four "
            "screws in Fig. 3»; preview.mp4 s=18 a 19: «move down, please pay attention: Be "
            "careful not to crush it»; la llave: manual pag. 3, foto del juego de llaves Allen "
            "de los accesorios. Nota: cotizacion JF202606012 «Tooling for one logo» / «Tooling "
            "for two logos»; las manos: el plato en manual baja con un boton de una sola mano",
        ],
        epp=EPP_MOLDE,
        disparador="SI EL MOLDE NO APOYA PAREJO O UN TORNILLO NO SALE",
        acciones=[
            "1. No forzar el molde ni los tornillos.",
            "2. Dar aviso al Líder de Producción y a Mantenimiento.",
            "3. Esperar la intervención del personal autorizado.",
        ],
    ),

    dict(
        op="TBD.6",
        denominacion="CAMBIO DE MOLDE",
        hoja_de=(2, 2),
        modo="secuencia",
        columnas=True,            # tres fotos casi cuadradas: en columnas no quedan chicas
        imagenes=[_f("m_molde_conector.jpg"), _f("s6_subir.jpg"), _f("m_molde.jpg")],
        pies=["El conector redondo de atrás",
              "El botón SUBIR",
              "El molde, con su cable"],
        sin_marcas_ok=True,
        pasos=[
            "Desconectar el conector redondo de atrás de la prensa.",
            "Mantener apretado SUBIR para levantar un poco el plato y retirar el molde.",
            "Colocar el molde nuevo, bajar el plato con BAJAR hasta que apoye, ajustar sus "
            "cuatro tornillos y enchufar el conector alineado con su pin guía.",
        ],
        # el cambio terminaba con la prensa sin molde (revision ciega, 24/09/2026): el paso 3
        # es el desarme del manual al reves, y el pin guia es la nota del manual. Auditoria
        # independiente 24/09: B4 (los parametros se validan por molde) y S3 (el cableado de la
        # pag. 7 es de Mantenimiento; bajar el plato para ajustar)
        nota="El conector entra en una sola posición. El cableado del molde (calefactor y "
             "termocupla) lo conecta Mantenimiento. Antes de producir, repetir las hojas de "
             "temperatura, de parámetros de carrera y de arranque.",
        fuentes=[
            "manual pag. 6 paso 2: «unplug the rear aviation connector in Fig. 4»",
            "manual pag. 6 paso 2: «press and hold Up to raise the platen slightly, then take "
            "out the mold»",
            "manual pag. 6, los pasos 1 y 2 al reves (tornillos de la Fig. 3 y conector de la "
            "Fig. 4) y su nota: «The aviation connector is directional; align it with the "
            "locating pin before insertion»; la foto es la Fig. 1 de la pag. 7 (el molde con su "
            "cable). Nota: manual pag. 7: «For wiring, connect by color: the heater cartridge "
            "wires are red and blue; the thermocouple wires are white and orange»; temperatura, "
            "parametros y origen, hojas TBD.2, TBD.5 y TBD.3",
        ],
        epp=EPP_MOLDE,
        disparador="SI EL CONECTOR NO SALE O NO ENTRA SIN FORZARLO",
        acciones=[
            "1. No forzar el conector.",
            "2. Dar aviso al Líder de Producción y a Mantenimiento.",
            "3. Esperar la intervención del personal autorizado.",
        ],
    ),
]


def gate_materiales(hojas):
    texto = []
    for h in hojas:
        texto.append(str(h.get("denominacion", "")))
        texto.append(str(h.get("nota", "")))
        texto += [str(x) for x in (h.get("pasos") or [])]
        texto += [str(x) for x in (h.get("pies") or [])]
    todo = " ".join(texto).lower()
    faltan = [(q, d) for q, pat, d in MATERIALES if not re.search(pat, todo)]
    if faltan:
        for q, d in faltan:
            print(f"    - {q}: ninguna hoja lo nombra (existe porque: {d})")
        raise SystemExit("el deck no cubre todo lo que entra y sale de la operacion")


def gate_fuentes_sin_otra_maquina(hojas):
    """Las fuentes de estas hojas son el manual y el video del proveedor. Un IMG_xxxx es un
    video de la MOLDEADORA: si aparece aca, se copio una hoja de la otra maquina."""
    for h in hojas:
        for f in h.get("fuentes", []):
            if re.search(r"IMG_\d{3,4}", f):
                raise SystemExit(f"hoja {h['op']}: cita {f[:40]}, que es de otra maquina")


def compilar():
    gate_materiales(HOJAS)
    gate_fuentes_sin_otra_maquina(HOJAS)
    G.PLANCHA_DECK = PLANCHA
    G.gate_fotos_miradas(HOJAS, PORTADA.get("foto"))

    prs = Presentation()
    prs.slide_width = Cm(G.W)
    prs.slide_height = Cm(G.H)
    indice = [(h["op"], G._denominacion_con_hoja(h)) for h in HOJAS]
    G.portada(prs, PORTADA, logo=G.LOGO_BARACK, foto=PORTADA["foto"], indice=indice)

    reparto_3 = G._REPARTO[3]
    for h in HOJAS:
        d = dict(CAJETIN)
        d.update(h)
        if h.get("columnas"):
            G._REPARTO[3] = [(0.0, 0.0, 1 / 3, 1.0), (1 / 3, 0.0, 1 / 3, 1.0),
                             (2 / 3, 0.0, 1 / 3, 1.0)]
        try:
            G.hoja(prs, d, logo=G.LOGO_BARACK)
        finally:
            G._REPARTO[3] = reparto_3
        print(f"  [OK] {h['op']}  {G._denominacion_con_hoja(h)}")

    prs.save(SALIDA)
    print(f"\n{len(HOJAS) + 1} laminas -> {SALIDA}")


if __name__ == "__main__":
    for _s in (sys.stdout, sys.stderr):
        try:
            _s.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass
    compilar()
