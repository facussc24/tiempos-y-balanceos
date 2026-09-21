# -*- coding: utf-8 -*-
"""El gate de redaccion, probado en ROJO y en VERDE.

Un gate que no puede dar rojo esta tan roto como el que no puede dar verde. Cada caso de
ROJO de aca es una frase que de verdad entregue o que el canon cita como error real; cada
VERDE es una frase que TIENE que poder imprimirse, para que el gate no me obligue a escribir
raro (el 12/09 un gate de estilo salio invertido y marcaba en rojo los mails de Fak).
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from redaccion import (revisar_vocabulario, revisar_voz, revisar_idioma,  # noqa: E402
                       gate_redaccion)

for _f in (sys.stdout, sys.stderr):
    try:
        _f.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# ── IDIOMA: el ideograma va en la FOTO, no en el texto que se imprime ─────────
IDIOMA = [
    ("Selector AUTOMATICO (自动) / MANUAL (手动).", True,
     "el paso que entregue: el operario no lee eso"),
    ("Azul: RESET (复位).", True, "idem, en otra hoja"),
    ("Poner el selector de modo en AUTOMATICO.", False,
     "el mismo comando, con el ideograma rotulado sobre la foto"),
    ("Apretar el pulsador verde de arranque de ciclo.", False, "castellano puro"),
]

# ── VOCABULARIO ───────────────────────────────────────────────────────────────
VOCAB = [
    ("Seta de emergencia: corta todo en el acto.", True, "la palabra que encontro Fak"),
    ("la seta del lateral", True, "la misma, en una fuente"),
    ("Apretar el boton de parada de emergencia.", False, "como se dice aca"),
    ("Seguir estrictas normas de seguridad de izaje.", True, "izaje, el caso del 08/09"),
    ("Mover el molde con el puente grua.", False, "el reemplazo del canon"),
    ("Aflojar las chumaceras del rollo.", True, "\"que carajo es eso\""),
    ("Apoyar el rollo sobre los soportes del desbobinador.", False, "el reemplazo"),
    ("Tirar la pieza al contenedor de rechazo.", True, "no es como se llama"),
    ("Segregar la pieza al cajon de scrap.", False, "el nombre real"),
    ("Aplicar un par de apriete de 470 Nm.", True, "aca se dice torque"),
    ("Torquear a 470 Nm con torquimetro.", False, "el reemplazo"),
    ("Nunca dejar una pieza metalica entre los rodillos: se rompen al instante.",
     True, "dramatizacion, el ejemplo del canon 4.4"),
    ("Verificar que no haya piezas metalicas sobre la lamina antes del ciclo.",
     False, "la forma correcta, del mismo canon"),
    ("HOJA EN BORRADOR - SUJETO A REVISION", True, "4.4 lo prohibe imprimir"),
    ("Temperatura de molde: TBD", False, "TBD si va"),
    # que NO se le escape el rojo por contexto, y que no de rojo de mas:
    ("Cerrar los clamps neumaticos sobre la lamina del molde.", False, "el termino correcto"),
    ("Abrir las mordazas del marco tensor antes de cargar la lamina.",
     True, "en termoformado son clamps"),
    ("Ajustar las mordazas de la morsa del banco.", False,
     "una morsa de banco no es el marco tensor: sin contexto no hay rojo"),
]

# ── VOZ DEL PASO ──────────────────────────────────────────────────────────────
VOZ = [
    ("La mesa entra con el molde y el portico queda arriba.", "narrativo", "lo que entregue"),
    ("El plato de calefactores baja sobre el molde.", "narrativo", "idem"),
    ("Selector AUTOMATICO / MANUAL.", "narrativo", "un rotulo no es un paso"),
    ("Arriba se elige que mitad se mira.", "narrativo", "arranca con adverbio"),
    ("Cada casillero con numero es una resistencia.", "narrativo", "describe la pantalla"),
    ("Esperar afuera del cerco hasta que la maquina abra sola.", "ok", "manda al operario"),
    ("Poner la llave general en I.", "ok", "el encendido, bien escrito"),
    ("Apretar el pulsador verde POWER START.", "ok", "idem"),
    ("1. Segregar la pieza al cajon de scrap.", "ok", "numerada, igual pasa"),
    ("▲ CRITICO VW: Verificar la orientacion de la pieza.", "ok", "con la marca adelante"),
    ("Retirar la pieza entre dos.", "ok", "verbo de la lista"),
    ("", "narrativo", "un paso vacio no es un paso"),
]

# ── LA HOJA ENTERA ────────────────────────────────────────────────────────────
HOJA_MALA = dict(op="30.3", denominacion="LOS COMANDOS DEL PUESTO",
                 pasos=["Selector AUTOMATICO (自动) / MANUAL (手动).",
                        "Seta de emergencia: corta todo en el acto."])
HOJA_BUENA = dict(op="30.1", denominacion="ENCENDIDO DE LA MAQUINA",
                  pasos=["Poner la llave general del tablero en I.",
                         "Apretar el pulsador verde POWER START y esperar que quede iluminado."])

malos = 0

print("IDIOMA — IATF 8.5.1.2 c): el texto del puesto va en el idioma del que ejecuta\n")
for txt, espera_rojo, por_que in IDIOMA:
    rojo = bool(revisar_idioma(txt))
    ok = rojo == espera_rojo
    malos += not ok
    print(f"  {'ok  ' if ok else 'FALLA'}  {'ROJO ' if rojo else 'verde'}  {por_que}")

print("\nVOCABULARIO — cada termino prohibido, y su reemplazo que TIENE que pasar\n")
for txt, espera_rojo, por_que in VOCAB:
    rojo = bool(revisar_vocabulario(txt))
    ok = rojo == espera_rojo
    malos += not ok
    print(f"  {'ok  ' if ok else 'FALLA'}  {'ROJO ' if rojo else 'verde'}  {por_que}")

print("\nVOZ DEL PASO — describir la maquina da rojo; mandarle algo al operario, verde\n")
for txt, espera, por_que in VOZ:
    estado, _ = revisar_voz(txt)
    real = "narrativo" if estado == "narrativo" else "ok"
    ok = real == espera
    malos += not ok
    print(f"  {'ok  ' if ok else 'FALLA'}  {real:9s}  {por_que}")

print("\nLA HOJA ENTERA\n")
for hoja, espera_rojo, por_que in ((HOJA_MALA, True, "la 30.3 como la entregue"),
                                   (HOJA_BUENA, False, "la misma, reescrita")):
    try:
        gate_redaccion(hoja)
        rojo = False
    except SystemExit:
        rojo = True
    ok = rojo == espera_rojo
    malos += not ok
    print(f"  {'ok  ' if ok else 'FALLA'}  {'ROJO ' if rojo else 'verde'}  {por_que}")

total = len(IDIOMA) + len(VOCAB) + len(VOZ) + 2
print(f"\n{total} casos, {malos} fallan.")
sys.exit(1 if malos else 0)
