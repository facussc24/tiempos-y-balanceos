# -*- coding: utf-8 -*-
"""Contenido del Dia 5, ES y EN. Revision 2 (03/09), despues de la auditoria.

Cambios contra la revision 1, cada uno con su motivo:
  · La portada NO lleva foto: la unica del dia es la del agujero y va en su lamina.
    La rev.1 heredaba la foto del molde delantero de los Dias 3 y 4 — misma imagen
    tres veces, y encima el molde que no era.
  · Se dice QUE MOLDE: el 02/09 se trabajo el trasero y despues el delantero, con un
    solo cambio de molde en la jornada (dato de Fak, 03/09). La rev.1 no lo decia.
  · La lamina del agujero declara su relacion con el defecto ABIERTO "marcas de los
    agujeros de vacio" (pag. 36 y 40 del propio deck, prioridad critica). Callarlo
    hacia que la modificacion pareciera agravar un defecto abierto.
  · KP, no "KIP" (el deck entero dice KP), y el credito va en las TRES cosas que hizo,
    no solo en la que lleva la advertencia de consecuencia irreversible.
  · La traba del medio pasa de OK a EN PROCESO: el cuaderno dice "esta revisando el
    sensor" y Fak dicto "de cierta forma lo corregimos".
  · Se saca "con la posicion anterior": no esta en las notas, es inferencia mia sobre
    el trabajo de un tercero.
  · El Registro no afirma una fecha que no puedo probar (las fotos no tienen EXIF).
  · Se recupera "y baja mas rapido que antes" (ganancia de ciclo que la rev.1 perdio).
  · Paridad ES/EN: direccion del movimiento, "limar MAS el molde", singular/plural.
"""

ES = dict(
    src="TryOut_IMG_Dia1a4.pptx", out="TryOut_IMG_Dia1a5.pptx",
    pie="BARACK MERCOSUL   ·   TryOut IMG — Día 5   ·   02/09/2026",
    tit_portada="TRYOUT IMG — DÍA 5",
    sub="Molde delantero (Front TopRoll) — ajustes de herramental y de proceso",
    desc=("Ajuste del trimming tool, agujeros de vacío en el extremo del molde y "
          "corrección de los tiempos de la secuencia de tapizado, sobre el molde "
          "delantero (Front TopRoll)."),
    fecha="FECHA:  02/09/2026",
    tit_resumen="Resumen de actividades — Día 5",
    items=[
        ("Ajuste del trimming tool",
         "KP bajó el trimming tool 1 mm, porque no se puede tapizar correctamente."),
        ("Sensor con falla — causa identificada",
         "Falló uno de los sensores. Al revisarlo se detectó que la traba del medio no "
         "estaba cerrando bien. Se intervino durante la jornada y sigue en revisión."),
        ("Agujeros de vacío en el extremo",
         "KP agregó agujeros en uno de los extremos del molde, en la zona donde estaba "
         "faltando vinilo, para que el vacío succione el borde de la pieza."),
        ("Tiempo de contacto vinilo–plástico",
         "Se probó sumar 5 segundos al tiempo de contacto entre el vinilo y el plástico."),
        ("Secuencia de bajada del vinilo",
         "KP notó que el vinilo se quedaba unos 5 segundos detenido en caliente antes de "
         "bajar. Se corrigió: ahora baja directamente, más rápido que antes, y el "
         "material no se enfría."),
    ],
    chips=[("Trimming tool — 1 mm", "EN OPTIMIZACIÓN"),
           ("Traba del medio · sensor", "EN PROCESO"),
           ("Agujeros de vacío en el borde", "EN OPTIMIZACIÓN"),
           ("Tiempo de contacto +5 s", "EN OPTIMIZACIÓN"),
           ("Secuencia de bajada del vinilo", "EN OPTIMIZACIÓN")],
    tit_inter="Modificación del molde — agujeros de vacío en el extremo",
    kicker="INTERVENCIÓN", fecha_inter="02/09/2026",
    caption="Uno de los agujeros de vacío agregados en el extremo del molde, en la zona donde faltaba vinilo.",
    panel=("Qué se hizo",
           "Se agregaron agujeros en uno de los extremos del molde, en la zona donde estaba faltando vinilo.",
           "Para qué",
           "Por esos agujeros el vacío succiona el borde de la pieza, que es la zona "
           "crítica que venía saliendo mal. Se busca mayor succión en esa zona.",
           "Relación con el defecto de marcas de vacío",
           "Hasta ahora no se observa que estos agujeros incidan sobre el defecto de marcas "
           "de los agujeros de vacío, abierto desde el 31/08. Se verifica en la próxima tirada.",
           "Estado",
           "La modificación se mantiene, y es reversible: los agujeros se pueden tapar.",
           "Registro", "Foto de planta de la jornada."),
    tit_situ="Situación y próximos pasos — al cierre del 02/09",
    bullets=[
        "Se bajó el trimming tool 1 mm, porque no se puede tapizar correctamente. Si ese ajuste no alcanza, la alternativa es limar más el molde, y esa intervención no tiene vuelta atrás.",
        "Se identificó la causa de la falla del sensor: la traba del medio no estaba cerrando bien. Se intervino y queda en revisión.",
        "Se agregaron agujeros de vacío en uno de los extremos del molde, para succionar el borde de la pieza. Hasta ahora no se observa incidencia sobre el defecto de marcas de vacío abierto desde el 31/08.",
        "Se corrigió la secuencia del vinilo: ya no se detiene antes de bajar, baja más rápido y el material no se enfría. Además se probó sumar 5 segundos al contacto vinilo–plástico.",
        "No se puede abrir la puerta trasera de la máquina, la que da al exterior, porque entra viento y la máquina no calienta.",
    ],
    rotulo2="A VERIFICAR EN LA PRÓXIMA TIRADA",
    cajas=[["Trimming tool", "Tapizado con la nueva posición"],
           ["Agujeros de vacío", "Succión en el borde y marcas sobre la pieza"],
           ["Tiempos del vinilo", "Efecto sobre la adhesión y el ciclo"]],
    panel_tit="Qué queda por verificar",
    verif=[
        "Trimming tool: confirmar que con la nueva posición se puede tapizar correctamente. Si no alcanza, la alternativa es limar el molde, y eso no tiene vuelta atrás.",
        "Agujeros de vacío: verificar la succión en el borde y, sobre la pieza, si aparecen marcas en esa zona.",
        "Tiempos del vinilo: confirmar el efecto de los 5 segundos de más en el contacto y de la bajada sin pausa, y que la traba del medio no vuelva a hacer fallar el sensor.",
    ],
)

EN = dict(
    src="TryOut_IMG_Day1to4_EN.pptx", out="TryOut_IMG_Day1to5_EN.pptx",
    pie="BARACK MERCOSUL   ·   TryOut IMG — Day 5   ·   02/09/2026",
    tit_portada="TRYOUT IMG — DAY 5",
    sub="Front mold (Front TopRoll) — tooling and process adjustments",
    desc=("Trimming tool adjustment, vacuum holes at one end of the mold and correction "
          "of the wrapping sequence times, on the front mold (Front TopRoll)."),
    fecha="DATE:  02/09/2026",
    tit_resumen="Activity summary — Day 5",
    items=[
        ("Trimming tool adjustment",
         "KP lowered the trimming tool by 1 mm, because the part cannot be wrapped correctly."),
        ("Sensor failure — cause identified",
         "One of the sensors failed. On inspection it was found that the middle clamp was "
         "not closing properly. It was worked on during the day and remains under review."),
        ("Vacuum holes at the end",
         "KP added holes at one end of the mold, in the area where vinyl was missing, so "
         "that the vacuum draws on the edge of the part."),
        ("Vinyl-to-plastic contact time",
         "An increase of 5 seconds in the contact time between the vinyl and the plastic was tried."),
        ("Vinyl lowering sequence",
         "KP noticed that the vinyl stayed still for about 5 seconds in the hot state before "
         "lowering. It was corrected: it now lowers directly, faster than before, and the "
         "material does not cool."),
    ],
    chips=[("Trimming tool — 1 mm", "UNDER OPTIMIZATION"),
           ("Middle clamp · sensor", "IN PROGRESS"),
           ("Vacuum holes at the edge", "UNDER OPTIMIZATION"),
           ("Contact time +5 s", "UNDER OPTIMIZATION"),
           ("Vinyl lowering sequence", "UNDER OPTIMIZATION")],
    tit_inter="Mold modification — vacuum holes at the end",
    kicker="INTERVENTION", fecha_inter="02/09/2026",
    caption="One of the vacuum holes added at the end of the mold, in the area where vinyl was missing.",
    panel=("What was done",
           "Holes were added at one end of the mold, in the area where vinyl was missing.",
           "Purpose",
           "Through those holes the vacuum draws on the edge of the part, which is the "
           "critical area that had been coming out badly. The aim is greater suction there.",
           "Relation to the vacuum-hole marks defect",
           "So far these holes are not seen to affect the vacuum-hole marks defect, open "
           "since 31/08. This will be verified in the next run.",
           "Status",
           "The modification stands, and it is reversible: the holes can be plugged.",
           "Record", "Floor photo from the day."),
    tit_situ="Situation and next steps — at the close of 02/09",
    bullets=[
        "The trimming tool was lowered by 1 mm, because the part cannot be wrapped correctly. If that adjustment is not enough, the alternative is to file the mold further, and that intervention cannot be undone.",
        "The cause of the sensor failure was identified: the middle clamp was not closing properly. It was worked on and remains under review.",
        "Vacuum holes were added at one end of the mold, to draw on the edge of the part. So far no incidence is seen on the vacuum-hole marks defect open since 31/08.",
        "The vinyl sequence was corrected: it no longer stops before lowering, it lowers faster and the material does not cool. An extra 5 seconds on the vinyl-to-plastic contact were also tried.",
        "The rear door of the machine, the one facing outdoors, cannot be opened because wind comes in and the machine does not heat.",
    ],
    rotulo2="TO BE VERIFIED IN THE NEXT RUN",
    cajas=[["Trimming tool", "Wrapping with the new position"],
           ["Vacuum holes", "Suction at the edge and marks on the part"],
           ["Vinyl times", "Effect on adhesion and cycle"]],
    panel_tit="What remains to be verified",
    verif=[
        "Trimming tool: confirm that with the new position the part can be wrapped correctly. If it is not enough, the alternative is to file the mold, and that cannot be undone.",
        "Vacuum holes: verify the suction at the edge and, on the part, whether marks appear in that area.",
        "Vinyl times: confirm the effect of the extra 5 seconds of contact and of the lowering without pause, and that the middle clamp does not make the sensor fail again.",
    ],
)
