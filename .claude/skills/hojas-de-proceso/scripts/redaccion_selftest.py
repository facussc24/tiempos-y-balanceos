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
                       revisar_pie, revisar_cocina, revisar_denominacion,
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

# ── EL PIE DE FOTO: nombra lo que se ve, no narra ────────────────────────────
# Calibrado contra el corpus: Barack rotula "REF. 1 - PIEZA APROBADA", un sustantivo. Si el
# gate marcara el articulo, daria rojo sobre las hojas reales de la casa.
PIES = [
    ("La mesa entra con el molde", True, "el pie que quedo impreso"),
    ("El plato baja y la maquina cierra", True, "idem, y ademas un fotograma es un instante"),
    ("La maquina abre con la pieza", True, "ademas es falso: expulsa, no abre"),
    ("La llave general del tablero", False, "un sustantivo: asi va"),
    ("REF. 1 - PIEZA APROBADA", False, "como rotula Barack de verdad"),
    ("El boton verde POWER START", False, "nombra lo que se ve"),
    ("Pasar la mano por la superficie", False, "el gesto del operario, no la maquina"),
]

# ── LA COCINA: lo mio no va impreso adelante del operario ────────────────────
COCINA_CASOS = [
    ("Las cuatro fotos son del IMG_0844.", True, "el numero de video"),
    ("Que hace el boton negro no esta documentado. Preguntar antes de usarlo.", True,
     "la nota que Fak mando borrar"),
    ("Pendiente de confirmar con KINGPOWER.", True, "un pendiente con el proveedor"),
    ("Temperatura de molde: TBD", False, "TBD pelado, que si va"),
    ("Nadie mete la mano hasta que la maquina abrio.", False, "una nota operativa"),
]


# ── LA DENOMINACION: como se llama una operacion en Barack ───────────────────
# Calibrado contra el corpus: 113 denominaciones reales. Si el gate marcara en rojo
# "CONTROL DE PIEZA INYECTADA" o "ARRANQUE Y ALINEACION", que son de Barack, estaria roto.
DENOM = [
    ("EL CICLO: QUE HACE EL OPERARIO", True, "el que Fak rechazo: articulo y dos puntos"),
    ("LOS COMANDOS DEL PUESTO", True, "arranca con articulo"),
    ("LA PANTALLA DE OPERACION", True, "idem"),
    ("CONTROL DE PIEZA INYECTADA", False, "de Barack, flujogramas 153 y 154"),
    ("ARRANQUE Y ALINEACION", False, "de Barack, HOTMELT 20.9"),
    ("MONTAJE DEL ROLLO EN EL DESBOBINADOR", False, "de Barack, HOTMELT 20.6"),
    ("ENCENDIDO GENERAL Y PUESTA EN MARCHA DE SERVICIOS", False, "el nuevo de la 30.1"),
    ("EMBALAJE", False, "una sola palabra, como la escribe HO-71"),
    ("LAMINADO - CONTROL DURANTE LA MARCHA", False, "parte 2 con guion, HOTMELT 20.10"),
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
    # una pieza que en esta maquina no existe. No es vocabulario: es inventar un fierro.
    ("Apoyar la lamina sobre la cinta y alisarla con la mano.", True,
     "la cinta que no existe (Fak: \"ni siquiera tenemos cinta\")"),
    ("Leather Conveyor para la cinta.", True, "la misma, al final de la frase"),
    ("Apoyar la lamina sobre la mesa de carga y alisarla.", False, "la pieza que si existe"),
    ("Cerrar la mordaza de tiro sobre la punta del vinilo.", False, "nombre del HMI"),
    ("Pegar cinta de enmascarar sobre el molde.", False, "esa cinta si existe"),
    ("Medir con cinta metrica.", False, "idem"),
    # que NO se le escape el rojo por contexto, y que no de rojo de mas:
    ("Cerrar los clamps neumaticos sobre la lamina del molde.", False, "el termino correcto"),
    ("Abrir las mordazas del marco tensor antes de cargar la lamina.",
     True, "en termoformado son clamps"),
    ("Cerrar la mordaza de tiro sobre la punta de la lamina del molde.", False,
     "la mordaza de tiro la nombra asi la pantalla de la maquina"),
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
corridos = 0


def correr(titulo, casos, fn):
    """Corre un bloque y CUENTA lo que corrio. El total no se escribe a mano."""
    global malos, corridos
    print("\n" + titulo + "\n")
    for txt, espera_rojo, por_que in casos:
        rojo = bool(fn(txt))
        ok = rojo == espera_rojo
        malos += not ok
        corridos += 1
        print(f"  {'ok  ' if ok else 'FALLA'}  {'ROJO ' if rojo else 'verde'}  {por_que}")


correr("IDIOMA \u2014 IATF 8.5.1.2 c): el texto va en el idioma del que ejecuta",
       IDIOMA, revisar_idioma)
correr("EL PIE DE FOTO \u2014 narrar un movimiento da rojo; nombrar lo que se ve, verde",
       PIES, revisar_pie)
correr("LA COCINA \u2014 lo que es mio y no del operario", COCINA_CASOS, revisar_cocina)
correr("LA DENOMINACION \u2014 como se llama una operacion en Barack",
       DENOM, lambda x: (lambda m: m and not m.startswith("AVISO"))
       (revisar_denominacion(x)))
correr("VOCABULARIO \u2014 cada termino prohibido, y su reemplazo que TIENE que pasar",
       VOCAB, revisar_vocabulario)

print("\nVOZ DEL PASO \u2014 describir la maquina da rojo; mandarle algo al operario, verde\n")
for txt, espera, por_que in VOZ:
    estado, _ = revisar_voz(txt)
    real = "narrativo" if estado == "narrativo" else "ok"
    ok = real == espera
    malos += not ok
    corridos += 1
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
    corridos += 1
    print(f"  {'ok  ' if ok else 'FALLA'}  {'ROJO ' if rojo else 'verde'}  {por_que}")

print(f"\n{corridos} casos CORRIDOS, {malos} fallan.")
sys.exit(1 if malos else 0)
