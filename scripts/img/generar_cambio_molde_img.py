# -*- coding: utf-8 -*-
"""
Hojas de proceso del CAMBIO DE MOLDE de la MOLDEADORA IMG KINGPOWER (Top Roll Patagonia).
Formulario I-IN-002.4-R01, mismo generador de hoja que las hojas 31 a 37 (generar_hojas_img.py):
aca solo vive el CONTENIDO, y los gates de hoja son los mismos.

    py -3 scripts/img/generar_cambio_molde_img.py
    py -3 .claude/skills/hojas-de-proceso/scripts/hoja_proceso_check.py \
          "scripts/img/HOJAS DE PROCESO - CAMBIO DE MOLDE - MAQUINA IMG.pptx" \
          --spec scripts/img/spec_gate_cambio_molde.py

Por que es un deck aparte: el de las hojas 31 a 37 esta mandado a aprobar a Carlos Baptista
desde el 23/09/2026, y el cambio de molde lo hace Produccion con otra frecuencia (Fak, audio
del 04/09/2026: «no lo va a hacer mantenimiento, lo va a hacer produccion, o sea que ingenieria
debe conocer el proceso y por lo tanto debe hacer las hojas de proceso»).

De donde sale el contenido, en este orden de peso:
  1. La pantalla "Cambio Molde" (换模) de la maquina: dos listas de 20 pasos, desmontaje y
     montaje, que son el procedimiento del fabricante. Leidas en CHINO el 24/09/2026 porque en
     castellano el texto sale cortado y tres rotulos estan mal (desmontaje 10, montaje 13 y 19).
     Las dos listas, con su traduccion: biblioteca de la maquina, .claude\\
     "CAMBIO DE MOLDE - las dos listas de la pantalla (04-09-2026).txt".
  2. El cambio del 04/09/2026 filmado entero por Fak (IMG_0662, 0663, 0664, 0666, 0667), con
     la traductora de KingPower explicando paso por paso. Salio con errores de programa que
     los tecnicos iban a corregir (IMG_0663 min 8:13), asi que de ahi se toma lo que la
     persona HACE, no la numeracion.
  3. El caso de la alarma 92 del 18/09/2026 (casos\\CASO ALARMA 92...): los sujetadores del
     molde inferior quedaron sin trabar en el montaje.
Lo que ninguna de las tres fuentes dice NO va en la hoja (ni como TBD: Fak, 24/09/2026, "no puede
haber ni 1 TBD" en la descripcion): va a la lista de falta_filmar.py, bloque 6.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import generar_hojas_img as gh  # noqa: E402
from pptx import Presentation  # noqa: E402
from pptx.util import Cm  # noqa: E402

BASE_DIR = gh.BASE_DIR
A_CM = os.path.join(BASE_DIR, "assets_cm")
SALIDA = "HOJAS DE PROCESO - CAMBIO DE MOLDE - MAQUINA IMG.pptx"
PLANCHA_CM = os.path.join(A_CM, "_plancha_del_deck.jpg")


def _c(n):
    return os.path.join(A_CM, n)


EPP_CAMBIO = [gh.ICO_ROPA, gh.ICO_CALZADO, gh.ICO_GUANTES]   # en los videos todos usan guantes

CAJETIN_CM = dict(gh.CAJETIN_BASE)
CAJETIN_CM.update(fecha="24/09/2026")

PORTADA_CM = dict(
    titulo="CAMBIO DE MOLDE — MÁQUINA MOLDEADORA IMG",
    subtitulo="Desmontaje y montaje del molde con la pantalla Cambio Molde · OP 30 del "
              "FLUJOGRAMA 155 TOP ROLL PATAGONIA",
    ho="HO-TBD",
    form="I-IN-002.4-R01",
    op_flujo="30 — PROCESO DE TERMOFORMADO Y LAMINADO IMG",
    cliente_modelo="VW / PATAGONIA",
    pieza="TOP ROLL PATAGONIA — N 216 / N 256 / N 285 / N 315",
    maquina="Moldeadora In-Mold Graining KINGPOWER (Molde Hembra)",
    firmas="F. Santoro / C. Baptista",
    fecha_rev="24/09/2026",
    foto=_c("cm00_paquete.jpg"),
)

# Plan de reaccion comun a los pasos que se hacen con la pantalla: un paso que no se pone en
# verde no se fuerza (IMG_0662 min 23:48 a 23:56: «si uno de estos sensores no se activa, no
# te habilita»).
DISPARADOR_PASO = "SI UN PASO NO SE PONE EN VERDE, UNA SEÑAL QUEDA EN GRIS O ALGO SE MUEVE DISTINTO"
ACCIONES_PASO = [
    "1. Soltar el botón y no pasar al paso siguiente.",
    "2. Ante cualquier riesgo, presionar el botón de parada de emergencia.",
    "3. Dar aviso al Líder de Producción.",
]

# ── Que entra y que sale del cambio de molde ─────────────────────────────────
# No sale de los videos: sale de las dos listas de la pantalla, que son del fabricante.
MATERIALES_CM = [
    ("el molde que sale", r"desmontaje",
     "pantalla Cambio Molde, lista 手动卸模 (desmontaje manual), paso 20: 人工将模具移至小车"),
    ("el molde que entra", r"montaje manual|molde nuevo",
     "pantalla Cambio Molde, lista 手动装模 (montaje manual), paso 1: 人工将模具和换模小车就位"),
    ("el carro de cambio de molde", r"\bcarro\b",
     "pantalla, desmontaje paso 16: 人工将换模小车就位"),
    ("los pilares del molde auxiliar y de la cuchilla", r"pilares",
     "pantalla, desmontaje pasos 3 y 10: 人工安装辅模四根立柱 / 人工安装切刀四根立柱"),
    ("el vinilo que protege el molde", r"vinilo",
     "IMG_0662 min 5:49: «hay que poner si o si un vinilo, sin sustrato ... para que se apoye»"),
]


def gate_materiales_cm(hojas):
    import re
    texto = []
    for h in hojas:
        texto += [str(h.get("denominacion", "")), str(h.get("nota", ""))]
        texto += [str(x) for x in (h.get("pasos") or []) + (h.get("pies") or [])]
    todo = " ".join(texto).lower()
    faltan = [(q, d) for q, pat, d in MATERIALES_CM if not re.search(pat, todo)]
    if faltan:
        for q, d in faltan:
            print(f"    - {q}: ninguna hoja lo nombra. Existe porque: {d}")
        raise SystemExit("el deck del cambio de molde no nombra todo lo que entra y sale.")


def gate_fotos_miradas_cm(hojas, portada=None):
    """Igual que gh.gate_fotos_miradas, con la plancha de ESTE deck."""
    fotos = [f for h in hojas for f in h.get("imagenes", [])] + ([portada] if portada else [])
    fotos = [f for f in dict.fromkeys(fotos) if os.path.exists(f)]
    repo = os.path.abspath(os.path.join(BASE_DIR, "..", ".."))
    cmd = ("py -3 .claude/skills/hojas-de-proceso/scripts/fotodevideo.py contacto "
           + " ".join(f'"{os.path.relpath(f, repo)}"' for f in fotos)
           + f' --cols 3 --plancha "{os.path.relpath(PLANCHA_CM, repo)}"')
    if not os.path.exists(PLANCHA_CM):
        raise SystemExit("No hay plancha de las fotos de este deck. Generala y MIRALA:\n  " + cmd)
    t = os.path.getmtime(PLANCHA_CM)
    nuevas = [os.path.basename(f) for f in fotos if os.path.getmtime(f) > t]
    if nuevas:
        raise SystemExit("Fotos que cambiaron despues de la ultima plancha:\n  "
                         + "\n  ".join(nuevas) + "\nRegenerala y MIRALA:\n  " + cmd)


# ════════════════════════════════════════════════════════════════════════════
# LAS HOJAS — numeradas despues de la 37 (Fak pidio 31 a 37 para la operacion, 23/09/2026).
#   38     preparar la maquina para el cambio
#   39     como se usa la pantalla Cambio Molde (vale para sacar y para poner)
#   40     DESMONTAJE, 4 hojas: molde auxiliar · cuchilla · molde inferior al carro
#   41     MONTAJE, 2 hojas: el molde nuevo adentro · la lista de la pantalla
# ════════════════════════════════════════════════════════════════════════════
V0662 = "IMG_0662 (04-09-2026)"
HOJAS_CM = [
    dict(
        op="38",
        denominacion="PREPARACION PARA EL CAMBIO DE MOLDE",
        modo="rotulada",
        imagenes=[_c("cm38_inicio.jpg")],
        pasos=[
            "Mantener apretado el botón azul RESET, con el selector todavía en AUTOMÁTICO, "
            "hasta que quede encendido.",
            "Poner el selector en MANUAL, a la derecha.",
            "Elegir Modo de Ajuste en la lista de la pantalla, no Modo de Cambio.",
            "Apretar el ícono Cambio Molde, el de las dos flechas, en la barra de la izquierda.",
        ],
        parametros=[("RESET", "3 s apretado")],
        nota="El cambio se hace entre dos personas. Tener a mano, antes del paso 1: llaves "
             "Allen, grasa de litio y un vinilo solo, sin sustrato.",
        fuentes=[
            f"{V0662} min 0:00 a 0:07, la traductora: «boton reset ... hasta que la reset "
            "queda encendido»; min 1:40 a 1:47: «reset tres segundos. Cuando termina, cuando "
            "queda encendido, cambia a modo de ajuste»",
            f"{V0662} min 3:13 a 3:29, Fak: «de automatico lo pasas a manual, vas a ajuste»; "
            "en s=12 la mano de la traductora esta en el selector 自动/手动",
            f"{V0662} min 0:09 a 0:13: «cambiamos a modo de ajuste»; min 2:38 a 2:42: «ahora "
            "cambio de molde... no, ajuste, ajuste»; Modo de Ajuste y Modo de Cambio en la "
            "lista de la pantalla: IMG_0579 (02-09-2026) s=412, la foto",
            f"{V0662} min 0:13 a 0:15: «vamos a la parte de cambio de moldes»; el icono de las "
            "dos flechas con el rotulo Cambio Molde se ve en la foto y en IMG_0662 s=1301. "
            "Nota: llaves Allen min 6:53 a 6:59 «vamos a necesitar ... las llaves allen para "
            "hacer el cambio de molde»; grasa min 6:07 a 6:13 y el balde en s=375 a 380; "
            "vinilo min 5:49 a 5:58; dos personas empujando el molde: IMG_0664 (04-09-2026) "
            "s=78",
        ],
        epp=EPP_CAMBIO,
        disparador="SI EL RESET NO QUEDA ENCENDIDO O LA PANTALLA MUESTRA UNA ALARMA",
        acciones=["1. No empezar el cambio de molde.",
                  "2. Anotar la alarma que muestra la pantalla.",
                  "3. Dar aviso al Líder de Producción."],
    ),

    dict(
        op="39",
        denominacion="CAMBIO DE MOLDE — MANEJO DE LA PANTALLA",
        modo="rotulada",
        imagenes=[_c("cm39_pantalla.jpg")],
        pasos=[
            "Apretar Desmontaje Manual (el de arriba) para sacar el molde, o Montaje Manual "
            "(el de abajo) para ponerlo.",
            "Completar los pasos en orden: mantener apretado el botón gris de cada paso "
            "mientras la máquina se mueve.",
            "Soltar el botón cuando se prende el verde al costado, y recién ahí pasar al "
            "paso siguiente.",
            "Completar a mano los pasos escritos en rojo, como indican las hojas 40 y 41.",
            "Verificar que los recuadros de señal del paso queden en verde. Si uno queda gris, "
            "no seguir y avisar al Líder de Producción.",
        ],
        nota="Antes de apretar un botón de la pantalla, verificar que nadie tenga las manos "
             "adentro de la máquina.",
        fuentes=[
            f"{V0662} min 3:29 a 3:58, Fak: «vas a cambio de molde ... seleccionas cambio de "
            "desmolde»; IMG_0667 (04-09-2026) min 0:59 a 1:17: «vamos al montaje manual y "
            "seleccionamos el montaje»; arriba 手动卸模 y abajo 手动装模 (IMG_0663 s=465). Nota: "
            "la maquina se mueve mientras se aprieta el boton (min 0:17 a 0:33) y hay gente con "
            "las manos adentro durante el cambio (s=1215 y s=1245); IMG_0664 min 2:40 a 2:50: "
            "«por seguridad no tocamos ... chicos, no muevan»",
            f"{V0662} min 0:17 a 0:33: «presta este boton hasta que la posicion actual llega a "
            "la posicion ajustada»; min 13:13: «mantuvo apretado»",
            f"{V0662} min 10:06 a 10:12: «a medida que vas marcando los pasos se te va poniendo "
            "verde. Al colocarse verde esta ok el proceso»",
            f"{V0662} min 4:21 a 4:31: «lo que te figura rojo es lo que tienen que hacer "
            "manualmente y otros son los que tienen que presionar boton hasta llegar a los "
            "valores ajustados»",
            f"{V0662} min 23:48 a 23:56: «cada uno de estos cositos verdes son sensores. Si "
            "uno de estos sensores no se activa, no te habilita»",
        ],
        epp=EPP_CAMBIO,
        disparador=DISPARADOR_PASO,
        acciones=ACCIONES_PASO,
    ),

    # ── DESMONTAJE ──────────────────────────────────────────────────────────
    dict(
        op="40",
        denominacion="CAMBIO DE MOLDE — DESMONTAJE",
        hoja_de=(1, 4),
        modo="secuencia",
        imagenes=[_c("cm40a_pasos.jpg"), _c("cm40b_vinilo.jpg"),
                  _c("cm40c_grasa.jpg"), _c("cm40d_pilar.jpg")],
        pies=["Pasos 1 y 2 de la pantalla",
              "El vinilo sobre el molde verde",
              "Grasa en la punta del pilar",
              "Pilar trabado en el taco rojo"],
        sin_marcas_ok=True,
        pasos=[
            "Completar los pasos 1 y 2 de la pantalla.",
            "Apoyar un vinilo solo, sin sustrato, sobre el molde verde, donde se va a apoyar "
            "el molde auxiliar.",
            "Pasar grasa de litio en la punta de los pilares: los 4 del molde auxiliar y los "
            "4 de la cuchilla.",
            "Colocar los 4 pilares en los tacos rojos de las esquinas, girarlos hasta que "
            "coincida el agujero y trabarlos con su pasador (paso 3).",
        ],
        parametros=[("Grasa", "de litio semifluida, balde ZHONGLIANZHUOLI")],
        fuentes=[
            "pantalla, desmontaje pasos 1 y 2 (IMG_0663 s=465, en chino): 上框去上料位 / "
            f"上模平移去辅模位 + 下模去预升位; {V0662} min 0:17 a 0:44 los aprieta la traductora",
            f"{V0662} min 5:41: «para que no se lastime el...»; min 5:49 a 5:58: «hay que poner "
            "si o si un vinilo, sin sustrato, sin el plastico, solamente el vinilo para que se "
            "apoye ... cuando apoye el molde»; se ve en s=344",
            f"{V0662} min 6:00 a 6:13: «cuando saquen los pilares, lo tienen que engrasar en "
            "las puntas»; el balde (Semifluid extreme pressure lithium grease) en s=375 a 380 y "
            "el pincel en la punta en s=433",
            "pantalla, desmontaje paso 3: 人工安装辅模四根立柱 (instalar a mano los 4 pilares "
            f"del molde auxiliar); {V0662} min 20:26 a 20:29: «hay que girar hasta que coincida "
            "el agujero, si no no entra»; el pasador se ve en s=529",
        ],
        epp=EPP_CAMBIO,
        disparador=DISPARADOR_PASO,
        acciones=ACCIONES_PASO,
    ),

    dict(
        op="40",
        denominacion="CAMBIO DE MOLDE — DESMONTAJE",
        hoja_de=(2, 4),
        modo="secuencia",
        imagenes=[_c("cm41a_auxiliar.jpg"), _c("cm41b_palanca.jpg"),
                  _c("cm41c_senales.jpg"), _c("cm41d_sube.jpg")],
        pies=["El molde auxiliar",
              "El panel de aire del costado",
              "Pasos 7 a 9 de la pantalla",
              "El molde auxiliar después del paso 9"],
        sin_marcas_ok=True,
        pasos=[
            "Completar los pasos 4, 5 y 6 mirando que el molde auxiliar baje suave hasta "
            "apoyarse.",
            "Desconectar el aire del molde auxiliar con su palanca del panel del costado de "
            "la máquina (paso 7).",
            "Verificar que las 4 señales del paso 7 queden en verde antes de seguir.",
            "Completar los pasos 8 y 9 de a poco, mirando la placa del molde auxiliar: si "
            "empieza a levantarse, soltar el botón.",
        ],
        parametros=[("Contraseña del paso 4", "la da el Líder de Producción")],
        fuentes=[
            "pantalla, desmontaje pasos 4 a 6: 下模翻转插销退 / 下模去换模位 / 辅模降去换模位; "
            f"{V0662} min 9:23 a 9:36 (el paso 4 pide contraseña) y min 10:15 a 10:35: "
            "«tienen que prestar mucha atencion ... que baje suave»",
            "pantalla, desmontaje paso 7: 手动取下辅模水、电、气接头及手动锁; "
            f"{V0662} min 10:55 a 11:14: «desconectar manualmente conectores de aire. En este "
            "caso es interno»; la mano en la palanca del panel en s=684 a 702",
            f"{V0662} min 11:51 a 12:07: «ya te marco los cuatro sensores ... cuatro valores "
            "verdes»",
            "pantalla, desmontaje pasos 8 y 9: 辅模锁模器1/2打开 / 辅模升回原位; "
            f"{V0662} min 12:30 a 12:43: «detecten de que no se levante la placa tambien, "
            "entonces tiene que subir de a poquito»",
        ],
        epp=EPP_CAMBIO,
        disparador=DISPARADOR_PASO,
        acciones=ACCIONES_PASO,
    ),

    dict(
        op="40",
        denominacion="CAMBIO DE MOLDE — DESMONTAJE",
        hoja_de=(3, 4),
        modo="secuencia",
        imagenes=[_c("cm42a_pilares.jpg"), _c("cm42b_cuchilla.jpg"),
                  _c("cm42c_palanca.jpg"), _c("cm42d_sube.jpg")],
        pies=["Un pilar y su agujero en la placa",
              "Paso 12 de la pantalla",
              "El panel de aire del costado",
              "Paso 15 de la pantalla"],
        sin_marcas_ok=True,
        pasos=[
            "Colocar los 4 pilares de la cuchilla, con la punta engrasada, en los agujeros "
            "de la placa (paso 10).",
            "Completar los pasos 11 y 12.",
            "Desconectar el aire de la cuchilla con la otra palanca del panel y verificar "
            "las 4 señales del paso 13 en verde.",
            "Completar los pasos 14 y 15.",
        ],
        nota="En la pantalla, el paso 10 dice «Mover manualmente el molde al carro»: en ese "
             "paso se colocan los pilares de la cuchilla.",
        fuentes=[
            "pantalla, desmontaje paso 10 en chino: 人工安装切刀四根立柱 (instalar a mano los 4 "
            f"pilares de la cuchilla); {V0662} min 15:13 a 15:37, la traductora sobre ese paso: "
            "«es un programa de la colocacion de los ... ahora si hay que ponerlo»; el pilar "
            "en su agujero en s=1190",
            "pantalla, desmontaje pasos 11 y 12: 上模平移去切刀位 + 下模去换模位 / 切刀降去换模位 "
            f"(IMG_0663 s=465); {V0662} min 21:00 a 21:07: «vamos a empezar a bajar la prensa "
            "de arriba ... decimo, decimo primer»",
            "pantalla, desmontaje paso 13: 手动取下切刀水、电、气接头及手动锁; "
            f"{V0662} min 22:34 a 23:07: «ahora movemos esta segunda palanca ... tenes que "
            "fijar que los cuatro botones se puso verde»",
            "pantalla, desmontaje pasos 14 y 15: 切刀锁模器1/2打开 / 切刀升回原位; "
            "IMG_0663 (04-09-2026) min 0:09 a 0:30: «paso 15 ... aca se va liberando la "
            "prensa arriba»",
        ],
        epp=EPP_CAMBIO,
        disparador=DISPARADOR_PASO,
        acciones=ACCIONES_PASO,
    ),

    dict(
        op="40",
        denominacion="CAMBIO DE MOLDE — DESMONTAJE",
        hoja_de=(4, 4),
        modo="secuencia",
        imagenes=[_c("cm43a_conectores.jpg"), _c("cm43c_pasador.jpg"),
                  _c("cm43b_pantalla.jpg"), _c("cm43d_empuje.jpg")],
        pies=["Acoples de agua y ficha eléctrica",
              "El pasador de tope con su cadena",
              "Pasos 16 al final de la lista",
              "El molde empujado al carro"],
        sin_marcas_ok=True,
        pasos=[
            "Acercar el carro contra la máquina y desconectar el agua y la ficha eléctrica "
            "del molde inferior (paso 16).",
            "Sacar los pasadores de tope, los que tienen cadena (paso 16).",
            "Completar los pasos 17, 18 y 19 para bajar el molde inferior al nivel del carro.",
            "Empujar el molde al carro entre dos personas (paso 20) y completar el último "
            "botón de la lista.",
        ],
        nota="Con el molde en el carro, ponerle la traba negra antes de mover el carro.",
        fuentes=[
            "pantalla, desmontaje paso 16: 人工将换模小车就位 取下限位插销和水电气接头 (poner el "
            "carro y sacar el pasador de tope y los conectores de agua, luz y aire); IMG_0663 "
            "(04-09-2026) min 1:09 a 1:27: «desconectamos los conectores de agua y tension ... "
            "solo de abajo»; la mano en el acople en s=142",
            "pantalla, desmontaje paso 16 (限位插销, pasador de tope); IMG_0664 (04-09-2026) "
            "min 0:27: «estan sacando las trabas de lado»; el pasador con su cadena en s=40",
            "pantalla, desmontaje pasos 17 a 19: 换模小车插销进 + 下模气动增压泵泄压 / 下模锁模器打开 / "
            "下模降卸模位; IMG_0663 min 7:44: «si yo aprieto este boton, el molde deberia bajar "
            "y posicionarse a nivel del carro»",
            "pantalla, desmontaje paso 20: 人工将模具移至小车, y el ultimo 换模小车插销退; IMG_0664 "
            "min 0:00 a 0:22: «faltaba apretar ese boton y movemos el molde al carro»; dos "
            "operarios empujando en s=78. Nota: IMG_0664 min 2:13 a 2:50: «ahora hay que "
            "ponerle la traba ... esa cosa negra, para ser mas estable»",
        ],
        epp=EPP_CAMBIO,
        disparador="SI EL MOLDE NO PASA AL CARRO O EL CARRO SE MUEVE",
        acciones=["1. Dejar de empujar y no forzar el molde.",
                  "2. Ante cualquier riesgo, presionar el botón de parada de emergencia.",
                  "3. Dar aviso al Líder de Producción."],
    ),

    # ── MONTAJE ─────────────────────────────────────────────────────────────
    dict(
        op="41",
        denominacion="CAMBIO DE MOLDE — MONTAJE",
        hoja_de=(1, 2),
        modo="secuencia",
        imagenes=[_c("cm44a_carro.jpg"), _c("cm44b_montaje.jpg"),
                  _c("cm44c_empuje.jpg"), _c("cm44d_agua.jpg")],
        pies=["El carro de cambio de molde",
              "Montaje Manual y los pasos 1 a 6",
              "El molde nuevo contra el tope",
              "Acoples de agua y ficha eléctrica"],
        sin_marcas_ok=True,
        pasos=[
            "Acercar el carro con el molde nuevo contra la máquina (paso 1).",
            "Apretar Montaje Manual en la pantalla Cambio Molde y completar el paso 2.",
            "Sacar las trabas del carro y empujar el molde hacia adentro hasta que haga tope; "
            "poner el pasador de posición (paso 3).",
            "Conectar la ficha eléctrica y el agua del molde inferior (paso 3).",
        ],
        fuentes=[
            "pantalla, montaje paso 1 (IMG_0667 s=208, en chino): 人工将模具和换模小车就位; "
            "IMG_0667 (04-09-2026) min 1:36: «el primer paso es montar el molde, que es lo "
            "que hicieron recien»; el carro con el molde en IMG_0666 (04-09-2026) s=45",
            "IMG_0667 min 0:59 a 1:17: «cuando ya colocamos el molde para posicionar en la "
            "prensa, vamos al montaje manual y seleccionamos el montaje»; paso 2: 换模小车插销进",
            "pantalla, montaje paso 3: 人工将模具推入换模台 插入定位插销 (empujar el molde a la mesa "
            "de cambio y poner el pasador de posicion); IMG_0667 min 1:40 a 1:51: «empujar el "
            "molde hacia adentro, sacar los pitutos. Esto hay que empujarlo hasta que haga "
            "tope»; empujando en s=150",
            "pantalla, montaje paso 3: 装好下模航插 (enchufar la ficha del molde inferior); "
            "IMG_0667 min 2:28 a 2:30: «ahi viene agua. Y ahi le ponen agua»; los acoples en "
            "IMG_0663 (04-09-2026) s=120",
        ],
        epp=EPP_CAMBIO,
        disparador="SI EL MOLDE NO ENTRA DERECHO O NO LLEGA AL TOPE",
        acciones=["1. Dejar de empujar y no forzar el molde.",
                  "2. Ante cualquier riesgo, presionar el botón de parada de emergencia.",
                  "3. Dar aviso al Líder de Producción."],
    ),

    dict(
        op="41",
        denominacion="CAMBIO DE MOLDE — MONTAJE",
        hoja_de=(2, 2),
        modo="rotulada",
        imagenes=[_c("cm45_montaje.jpg")],
        pasos=[
            "Completar los pasos 4, 5 y 6, y verificar que las 4 señales del paso 5 queden en "
            "verde.",
            "Completar los pasos 7 y 8 para bajar la cuchilla.",
            "Conectar el aire de la cuchilla con su palanca del panel (paso 9) y completar "
            "los pasos 10 y 12; el 11 está vacío.",
            "Sacar a mano los 4 pilares de la cuchilla (paso 13).",
            "Completar los pasos 14 a 18 del molde auxiliar: en el 16, conectar su aire con "
            "la palanca del panel.",
            "Sacar a mano los 4 pilares del molde auxiliar (paso 19) y completar los dos "
            "últimos botones de la lista.",
        ],
        nota="Si las señales del paso 5 no quedan en verde, la máquina no arranca y marca la "
             "alarma 92. En la pantalla, los pasos 13 y 19 dicen «Posicionar manualmente molde "
             "y carro»: en los dos se sacan los pilares.",
        fuentes=[
            "pantalla, montaje pasos 4 a 6: 换模小车插销退 + 下模去翻转位 / 下模锁模器锁紧 (138.0 "
            "138.2 138.4 138.6) / 下模气动增压泵增压 (136.7). Alarma 92 del 18/09/2026 "
            "(casos\\CASO ALARMA 92), KingPower por WhatsApp: 下模的锁紧气缸没有锁紧, «los "
            "cilindros de bloqueo del molde inferior no estan bloqueados»",
            "pantalla, montaje pasos 7 y 8: 下模升去换模位 + 上模平移去切刀位 / 切刀降去换模位",
            "pantalla, montaje pasos 9, 10 y 12: 手动安装切刀水、电、气接头及手动锁 / 切刀锁模器1/2锁紧 "
            "/ 切刀升回原位; el 11 esta vacio en la pantalla (IMG_0667 s=51). Esos conectores, en "
            f"el desmontaje, son la palanca del panel: {V0662} min 22:34 a 22:42, «ahora movemos "
            "esta segunda palanca. Dice que te conectas manualmente, lo conecto de aire»",
            "pantalla, montaje paso 13 en chino: 人工将切刀四根立柱拿走 (sacar a mano los 4 "
            "pilares de la cuchilla)",
            "pantalla, montaje pasos 14 a 18: 上模平移去辅模位 / 辅模降去换模位 / 手动安装辅模水、电、"
            f"气接头及手动锁 / 辅模锁模器1/2锁紧 / 辅模升回原位; el conector del auxiliar: {V0662} "
            "min 10:55 a 11:14, «desconectar manualmente conectores de aire. En este caso es "
            "interno», con la palanca del panel",
            "pantalla, montaje paso 19 en chino: 人工将辅模四根立柱拿走 (sacar a mano los 4 "
            "pilares del molde auxiliar); despues, la pantalla sigue con «Paso 20» 下模翻转插销进 y "
            "un segundo «Paso 19» 下模降回原位 (IMG_0667 s=208)",
        ],
        epp=EPP_CAMBIO,
        disparador=DISPARADOR_PASO,
        acciones=ACCIONES_PASO,
    ),
]


def compilar():
    gate_materiales_cm(HOJAS_CM)
    gate_fotos_miradas_cm(HOJAS_CM, PORTADA_CM.get("foto"))
    prs = Presentation()
    prs.slide_width = Cm(gh.W)
    prs.slide_height = Cm(gh.H)
    indice, visto = [], set()
    for h in HOJAS_CM:
        if h["op"] not in visto:
            n = sum(1 for x in HOJAS_CM if x["op"] == h["op"])
            indice.append((h["op"], h["denominacion"] + (f"  ({n} hojas)" if n > 1 else "")))
            visto.add(h["op"])
    gh.portada(prs, PORTADA_CM, logo=gh.LOGO_BARACK, foto=PORTADA_CM.get("foto"), indice=indice)
    for h in HOJAS_CM:
        d = dict(CAJETIN_CM)
        d.update(h)
        gh.hoja(prs, d, logo=gh.LOGO_BARACK)
        print(f"  [OK] {h['op']} {gh._denominacion_con_hoja(h)}")
    salida = os.path.join(BASE_DIR, SALIDA)
    prs.save(salida)
    print(f"\n[OK] {salida}")
    try:
        prs.save(os.path.join(gh.DESKTOP_DIR, SALIDA))
        print(f"[OK] copia en {gh.DESKTOP_DIR}")
    except PermissionError:
        print("[AVISO] la copia del Escritorio esta abierta en PowerPoint: no se piso.")


if __name__ == "__main__":
    compilar()
