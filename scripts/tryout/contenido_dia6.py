# -*- coding: utf-8 -*-
"""Contenido del Dia 6 del informe de TryOut IMG — jornada del 08/09/2026.

De donde sale cada cosa (y nada sale de otro lado):
  · Los mensajes de Carlos Laburo Baptista a Fak por WhatsApp, 08/09 14:29 a 16:28.
    Fak no estuvo en planta ese dia: el chat ES la bitacora ("solo para llevar bitacora").
  · Los VALORES de tiempos salen de las PANTALLAS, no de los audios: las dos capturas de
    "Param. Tiempo" de las 16:02 (antes / ahora) y la pantalla china del T13 a las 16:14,
    confirmada en dos fotogramas del video de 1:33.
  · CUAL ES EL ANTES Y CUAL EL AHORA no se decide por la hora de envio de la foto: Carlos
    identifico las dos capturas a las 16:03, y el ANTES es la de 5,3 s aunque se haya
    mandado 7 segundos DESPUES que la de 11,0 s. Lo confirman la pantalla de las 16:12:48
    (下模快抽真空延时 = 11.0) y el audio de las 16:17 ("快抽11秒"). El 10/09 el deck salio
    con el par invertido y lo cazo la auditoria independiente.
  · Los audios de las 16:17 (tecnico de KP, en chino) y 16:18 (Carlos traduciendo) dicen
    "vacio lento 7 s". Ese 7 NO figura en ninguna pantalla: no entra al deck. La divergencia
    va en la nota a Fak, no fusionada con el dato de pantalla.

Lo que el material NO tiene y por eso NO esta aca: la tirada T12 (no aparece en ningun
mensaje) y el resultado del T14 (a las 16:28 quedaron cargados los parametros y se corta).

Vocabulario tomado del propio deck (no se inventa ninguno):
  ES  OK · NOK / ABIERTO · EN OPTIMIZACION · EN PROCESO   (estados de los chips)
  EN  OK · NOK / OPEN · UNDER OPTIMIZATION · IN PROGRESS  (el deck EN escribe en ingles
      norteamericano: mold, optimization, analyze; y la fecha en DD/MM)
"""

# ------------------------------------------------------------------ CASTELLANO
ES = dict(
    src="TryOut_IMG_Dia1a5.pptx",
    out="TryOut_IMG_Dia1a6.pptx",
    solo="TryOut_IMG_Dia6.pptx",
    pie="BARACK MERCOSUL   ·   TryOut IMG — Día 6   ·   08/09/2026",
    dia="Día 6",
    fecha_pie="08/09/2026",

    # --- A. portada
    kicker="INFORME TÉCNICO DE TRYOUT",
    tit_portada="TRYOUT IMG — DÍA 6",
    sub="Molde delantero (Front TopRoll) — temperatura y tiempos de vacío",
    desc=("Serie de tiradas T3 a T14 sobre el molde delantero: retiro del suplemento de la "
          "cavidad 4, barrido de temperatura por zonas contra las marcas de vacío de la "
          "cavidad 3, y ajuste de los tiempos de vacío del molde inferior."),
    fecha="FECHA:  08/09/2026",
    equipos="EQUIPOS:  Barack · GS · KP",

    # --- B. resumen
    tit_resumen="Resumen de actividades — Día 6",
    rotulo="CRONOLOGÍA DE LA JORNADA",
    items=[
        ("Punto de partida — T3",
         "La jornada arranca con problema en las cavidades 3 y 4: hundimiento en la cavidad 4 "
         "y marcas de vacío en la cavidad 3. Las cavidades 1 y 2 salen conformes."),
        ("Retiro del suplemento de la cavidad 4",
         "A la cavidad 4 se le sacó el suplemento: no tuvo más hundimiento, pero apareció una "
         "arruga. En el T6, con el papel colocado de otra forma, la cavidad 4 queda resuelta."),
        ("Barrido de temperatura por zonas — T6 a T11",
         "Se bajó la zona superior en pasos de 5 y 10 grados, después a 400 °C, y por último se "
         "bajó toda la línea zonal. La cavidad 3 repite el defecto en todas las tiradas."),
        ("Cambio de enfoque — tiempos de vacío",
         "KP indica que la etapa inferior del molde tiene dos modos de vacío, uno rápido y otro "
         "lento, y que la sincronización entre ambos no es la correcta."),
        ("Cierre de la jornada — T13 y T14",
         "En el T13 se bajó a 4,0 s el tiempo de vacío lento del molde inferior. A las 16:28 "
         "quedaron cargados los parámetros del T14."),
    ],
    tit_panel_resumen="Estado al cierre del día",
    chips=[("Cavidad 1", "OK"),
           ("Cavidad 2 — marcas leves", "NOK / ABIERTO"),
           ("Cavidad 3 — marcas de vacío", "NOK / ABIERTO"),
           ("Cavidad 4 — hundimiento", "OK"),
           ("Tiempos de vacío del inferior", "EN OPTIMIZACIÓN")],

    # --- C. trials T3 a T7
    tit_trials_a="Secuencia de trials — T3 a T7",
    items_a=[
        ("T3  ·  14:29",
         "Punto de partida de la jornada. Problema en las cavidades 3 y 4: la 4 con hundimiento "
         "y la 3 con marcas de vacío. Las cavidades 1 y 2 salen conformes."),
        ("T4  ·  14:41",
         "Se probó con estiramiento. Repite los mismos defectos en las mismas dos cavidades "
         "que el T3."),
        ("T5  ·  14:58",
         "Sólo se modificaron las zonas 12 y 13. A esa misma hora se informa que a la cavidad 4 "
         "se le sacó el suplemento: no tuvo más hundimiento, pero apareció una arruga."),
        ("T6  ·  14:59 → 15:05",
         "Se colocó el papel de otra forma y se bajaron 5 grados en la zona superior 12, porque "
         "la cavidad 3 seguía con marcas de vacío. Cavidad 4 resuelta; sigue el problema en la 3."),
        ("T7  ·  15:07 → 15:16",
         "Se bajaron 10 grados en la zona superior 13 para ver si mejoraban las marcas, y después "
         "10 grados más en la misma zona. Sigue el problema en la cavidad 3."),
    ],
    tit_panel_a="Qué se movió en cada tirada",
    panel_a=("Cavidad 4",
             "Se le retiró el suplemento. El hundimiento no volvió a aparecer.",
             "Cavidad 3",
             "Marcas de vacío desde el T3. Es el defecto que gobierna toda la jornada.",
             "Zonas de calentamiento",
             "T5: zonas 12 y 13.   ·   T6: zona superior 12, 5 grados menos.   ·   "
             "T7: zona superior 13, 10 grados menos y después 10 grados más.",
             "Criterio de trabajo",
             "Se movió una variable por vez y se fotografió la pantalla de parámetros de cada tirada."),

    # --- D. trials T8 a T14
    tit_trials_b="Secuencia de trials — T8 a T14",
    items_b=[
        ("T8  ·  15:23",
         "Mismo problema. Se baja la zona 13 a 400 °C, es decir 25 grados menos."),
        ("T09  ·  15:31",
         "Repite el problema."),
        ("T10  ·  15:34",
         "Se dejó la temperatura superior como estaba y se bajó la inferior de 435 °C a 410 °C, "
         "como el resto de la línea zonal, que va de la zona 13, 17, 20, 23 y 27."),
        ("T11  ·  15:42",
         "Se bajó toda la línea zonal a 400 °C, y a 385 °C y 395 °C. El problema está en la "
         "cavidad 3 y levemente en la 2, que no se había visto bien pero se repetía."),
        ("T13 y T14  ·  16:14 → 16:28",
         "En el T13 se bajó a 4,0 s el tiempo de vacío lento del molde inferior. A las 16:28 "
         "quedaron cargados los parámetros del T14."),
    ],
    tit_panel_b="Del ajuste térmico al ajuste de tiempos",
    panel_b=("Resultado del barrido térmico",
             "Del T6 al T11 se bajó la temperatura en todas las combinaciones que se probaron y "
             "el defecto de la cavidad 3 se repitió en todas.",
             "Lo que aporta KP",
             "La etapa inferior del molde tiene dos modos de vacío: uno rápido y otro lento.",
             "Diagnóstico",
             "La sincronización entre las bombas rápida y lenta no es la correcta. El tiempo "
             "total permanece inalterado.",
             "Acción",
             "Se pasó de ajustar la temperatura a ajustar los tiempos de vacío del molde inferior."),

    # --- E. defectos al inicio (2 fotos verticales)
    tit_defectos="Estado por cavidad al inicio de la jornada — T3",
    chip_izq_def="DEFECTOS T3",
    chip_der_def="08/09 · 14:30",
    cap_def=("Izquierda: cavidad 4, hundimiento.   ·   Derecha: cavidad 3, marcas de vacío.   "
             "Fotos de planta de la jornada, 08/09/2026 14:30."),
    panel_def=("Cavidad 4", "Hundimiento sobre la pieza.",
               "Cavidad 3", "Marcas de vacío sobre la superficie.",
               "Cavidades 1 y 2",
               "Conformes al inicio de la jornada. En el T11 se detectaron marcas leves también "
               "en la cavidad 2.",
               "Alcance e identificación",
               "Los dos defectos se repitieron en el T4, en las mismas dos cavidades. Las "
               "cavidades se identifican por número, del 1 al 4: la marcación A / B / C / D del "
               "molde delantero sigue abierta en el plan de acción."),

    # --- F. suplemento de la cavidad 4 (2 fotos verticales)
    tit_supl="Cavidad 4 — retiro del suplemento",
    chip_izq_supl="INTERVENCIÓN",
    chip_der_supl="08/09 · 14:58",
    cap_supl=("Izquierda: el suplemento sobre el molde.   ·   Derecha: la arruga que apareció al "
              "retirarlo.   Fotos de planta, 08/09/2026 14:58 y 14:59."),
    panel_supl=("Qué se hizo", "A la cavidad 4 se le retiró el suplemento.",
                "Qué resolvió y qué trajo",
                "El hundimiento no volvió a aparecer, pero apareció una arruga sobre la pieza.",
                "Cómo siguió",
                "En el T6 se colocó el papel de otra forma y la cavidad 4 quedó resuelta. El "
                "problema que siguió abierto es el de la cavidad 3.",
                "Registro", "La posición del suplemento sobre el molde quedó fotografiada a las 15:06."),

    # --- G. tiempos de vacio (2 fotos horizontales)
    tit_tiempos="Tiempos de vacío del molde inferior — antes y después",
    chip_izq_tiempos="REGISTRO",
    chip_der_tiempos="08/09 · 16:02",
    lbl_antes="ANTES  ·  5,3 s",
    lbl_ahora="AHORA  ·  11,0 s",
    cap_tiempos=("Pantalla “Parám. Tiempo” de la máquina, 08/09/2026 16:02. Entre las dos "
                 "capturas cambia una sola fila: Temp. Vacío Rápido Inf."),
    panel_tiempos=("Lo que cambia entre las dos pantallas",
                   "Temp. Vacío Rápido Inf.:  5,3 s  →  11,0 s.   Es la única fila distinta.",
                   "Lo que quedó cargado en el T13 (16:14)",
                   "Temp. Vacío Lento Inf.:  5,2 s  →  4,0 s.   El vacío rápido inferior se "
                   "mantiene en 11,0 s.",
                   "Filas que no cambian entre las dos capturas",
                   "T. Calef. 10,0  ·  Ret. Vac. Lento Aux. 1,2  ·  Ret. Vac. Ráp. sup. 1,3  ·  "
                   "Temp. Vacío Lento Inf. 5,2  ·  Ret. Cierre Abajo Mold. sup 0,8  ·  Demora "
                   "Cierre Molde 0,0  ·  Delay Aper Mol Sup. 7,0  ·  Temp. Espera Apertura "
                   "Molde 12,0  (segundos).",
                   "Por qué se tocan estos tiempos",
                   "La etapa inferior del molde tiene dos modos de vacío, uno rápido y otro "
                   "lento, y la sincronización entre ambos no es la correcta. El tiempo total "
                   "permanece inalterado.",
                   "Registro",
                   "Fotos de la pantalla de la máquina, 08/09/2026 16:02."),

    # --- H. situacion
    tit_situ="Situación y próximos pasos — al cierre del 08/09",
    rotulo_situ="SITUACIÓN Y PLAN INMEDIATO",
    bullets=[
        "La jornada se trabajó sobre el molde delantero, con la serie de tiradas T3 a T14.",
        "Las marcas de vacío de la cavidad 3 son el defecto que gobierna la jornada: se repitieron en todas las tiradas, con todas las combinaciones de temperatura que se probaron.",
        "El barrido térmico llegó hasta bajar toda la línea zonal a 400 °C, y la inferior de 435 °C a 410 °C, sin corregir el defecto.",
        "En el T11 se detectó que la cavidad 2 también tiene marcas, más leves, que no se habían visto bien y se venían repitiendo.",
        "El hundimiento de la cavidad 4 se resolvió retirándole el suplemento; a cambio apareció una arruga, y en el T6, con el papel colocado de otra forma, la cavidad quedó resuelta.",
        "KP indica que la etapa inferior del molde tiene dos modos de vacío, rápido y lento, y que la sincronización entre ambos no es la correcta: en el T13 el vacío lento inferior se bajó a 4,0 s, y a las 16:28 quedaron cargados los parámetros del T14.",
    ],
    rotulo2="A VERIFICAR EN LA PRÓXIMA TIRADA",
    cajas=[["Cavidad 3", "Si el ajuste de tiempos corrige las marcas"],
           ["Cavidad 2", "Alcance real de las marcas leves"],
           ["Cavidad 4", "Que la arruga no vuelva con el papel definitivo"]],
    tit_panel_situ="Qué queda por verificar",
    verif=[
        "Cavidad 3: confirmar si corregir la sincronización entre el vacío rápido y el lento del molde inferior elimina las marcas, ahora que el camino de la temperatura quedó recorrido.",
        "Cavidad 2: determinar el alcance real de las marcas leves detectadas en el T11 y si responden a la misma causa que las de la cavidad 3.",
        "Tiempos de vacío: registrar el resultado del T14 y dejar asentados los valores con los que la pieza sale conforme. Verificar además que la arruga de la cavidad 4 no se presente con la colocación definitiva del papel.",
    ],

    # --- I. plan de accion
    tit_plan="Plan de acción vigente — acciones técnicas al 08/09",
    rotulo_plan="ACCIONES TÉCNICAS ABIERTAS",
    cierre_plan=("PRIORIDAD CRÍTICA  ·  Las marcas de vacío de la cavidad 3 y el pliegue en la "
                 "punta son los defectos que hoy condicionan la validación del Front TopRoll."),
    filas_nuevas=[
        ("Cavidad 3 — marcas de vacío: el ajuste de temperatura por zonas no las corrigió",
         "Barack / GS / KP", "Crítica", "OPEN"),
        ("Cavidad 2 — marcas leves detectadas en el T11: determinar su alcance",
         "Barack / GS / KP", "Alta", "OPEN"),
        ("Tiempos de vacío del molde inferior — sincronizar el vacío rápido con el lento",
         "GS / KP", "Crítica", "IN PROGRESS"),
    ],
)

# ---------------------------------------------------------------------- INGLES
EN = dict(
    src="TryOut_IMG_Day1to5_EN.pptx",
    out="TryOut_IMG_Day1to6_EN.pptx",
    solo="TryOut_IMG_Day6_EN.pptx",
    pie="BARACK MERCOSUL   ·   TryOut IMG — Day 6   ·   08/09/2026",
    dia="Day 6",
    fecha_pie="08/09/2026",

    kicker="TRYOUT TECHNICAL REPORT",
    tit_portada="TRYOUT IMG — DAY 6",
    sub="Front mold (Front TopRoll) — temperature and vacuum times",
    desc=("Trial series T3 to T14 on the front mold: removal of the cavity 4 shim, zone "
          "temperature sweep against the cavity 3 vacuum marks, and adjustment of the lower "
          "mold vacuum times."),
    fecha="DATE:  08/09/2026",
    equipos="TEAMS:  Barack · GS · KP",

    tit_resumen="Activity summary — Day 6",
    rotulo="TIMELINE OF THE DAY",
    items=[
        ("Starting point — T3",
         "The day starts with a problem in cavities 3 and 4: a sink mark in cavity 4 and vacuum "
         "marks in cavity 3. Cavities 1 and 2 come out conforming."),
        ("Removal of the cavity 4 shim",
         "The shim was removed from cavity 4: no more sink mark, but a wrinkle appeared. In T6, "
         "with the paper placed differently, cavity 4 is solved."),
        ("Zone temperature sweep — T6 to T11",
         "The upper zone was lowered in steps of 5 and 10 degrees, then to 400 °C, and finally "
         "the whole zone line was lowered. Cavity 3 repeats the defect in every trial."),
        ("Change of approach — vacuum times",
         "KP states that the lower stage of the mold has two vacuum modes, one fast and one "
         "slow, and that the synchronization between them is not correct."),
        ("Close of the day — T13 and T14",
         "In T13 the lower mold slow vacuum time was lowered to 4.0 s. At 16:28 the T14 "
         "parameters were loaded."),
    ],
    tit_panel_resumen="Status at the close of the day",
    chips=[("Cavity 1", "OK"),
           ("Cavity 2 — light marks", "NOK / OPEN"),
           ("Cavity 3 — vacuum marks", "NOK / OPEN"),
           ("Cavity 4 — sink mark", "OK"),
           ("Lower mold vacuum times", "UNDER OPTIMIZATION")],

    tit_trials_a="Trial sequence — T3 to T7",
    items_a=[
        ("T3  ·  14:29",
         "Starting point of the day. Problem in cavities 3 and 4: cavity 4 with a sink mark and "
         "cavity 3 with vacuum marks. Cavities 1 and 2 come out conforming."),
        ("T4  ·  14:41",
         "Tested with stretching. It repeats the same defects in the same two cavities as T3."),
        ("T5  ·  14:58",
         "Only zones 12 and 13 were modified. At that same time it is reported that the shim was "
         "removed from cavity 4: no more sink mark, but a wrinkle appeared."),
        ("T6  ·  14:59 → 15:05",
         "The paper was placed differently and upper zone 12 was lowered by 5 degrees, because "
         "cavity 3 still had vacuum marks. Cavity 4 solved; the problem continues in cavity 3."),
        ("T7  ·  15:07 → 15:16",
         "Upper zone 13 was lowered by 10 degrees to see whether the marks improved, and then a "
         "further 10 degrees in the same zone. The problem continues in cavity 3."),
    ],
    tit_panel_a="What was changed in each trial",
    panel_a=("Cavity 4",
             "The shim was removed. The sink mark did not appear again.",
             "Cavity 3",
             "Vacuum marks from T3 on. This is the defect that governs the whole day.",
             "Heating zones",
             "T5: zones 12 and 13.   ·   T6: upper zone 12, 5 degrees lower.   ·   "
             "T7: upper zone 13, 10 degrees lower and then a further 10 degrees.",
             "Working criterion",
             "One variable was changed at a time and the parameter screen of each trial was photographed."),

    tit_trials_b="Trial sequence — T8 to T14",
    items_b=[
        ("T8  ·  15:23",
         "Same problem. Zone 13 is lowered to 400 °C, that is 25 degrees less."),
        ("T09  ·  15:31",
         "The problem repeats."),
        ("T10  ·  15:34",
         "The upper temperature was left as it was and the lower one was brought down from "
         "435 °C to 410 °C, like the rest of the zone line, which runs zones 13, 17, 20, 23 and 27."),
        ("T11  ·  15:42",
         "The whole zone line was lowered to 400 °C, and to 385 °C and 395 °C. The problem is in "
         "cavity 3 and slightly in cavity 2, which had not been seen clearly but was repeating."),
        ("T13 and T14  ·  16:14 → 16:28",
         "In T13 the lower mold slow vacuum time was lowered to 4.0 s. At 16:28 the T14 "
         "parameters were loaded."),
    ],
    tit_panel_b="From temperature adjustment to time adjustment",
    panel_b=("Result of the temperature sweep",
             "From T6 to T11 the temperature was lowered in every combination tried and the "
             "cavity 3 defect repeated in all of them.",
             "What KP contributes",
             "The lower stage of the mold has two vacuum modes: one fast and one slow.",
             "Diagnosis",
             "The synchronization between the fast and slow pumps is not correct. The total "
             "time remains unchanged.",
             "Action",
             "Work moved from adjusting the temperature to adjusting the lower mold vacuum times."),

    tit_defectos="Status per cavity at the start of the day — T3",
    chip_izq_def="T3 DEFECTS",
    chip_der_def="08/09 · 14:30",
    cap_def=("Left: cavity 4, sink mark.   ·   Right: cavity 3, vacuum marks.   "
             "Floor photos from the day, 08/09/2026 14:30."),
    panel_def=("Cavity 4", "Sink mark on the part.",
               "Cavity 3", "Vacuum marks on the surface.",
               "Cavities 1 and 2",
               "Conforming at the start of the day. In T11 light marks were also detected in "
               "cavity 2.",
               "Scope and identification",
               "Both defects repeated in T4, in the same two cavities. Cavities are identified "
               "by number, 1 to 4: the A / B / C / D marking of the front mold is still open in "
               "the action plan."),

    tit_supl="Cavity 4 — removal of the shim",
    chip_izq_supl="INTERVENTION",
    chip_der_supl="08/09 · 14:58",
    cap_supl=("Left: the shim on the mold.   ·   Right: the wrinkle that appeared once it was "
              "removed.   Floor photos, 08/09/2026 14:58 and 14:59."),
    panel_supl=("What was done", "The shim was removed from cavity 4.",
                "What it solved and what it brought",
                "The sink mark did not appear again, but a wrinkle appeared on the part.",
                "How it continued",
                "In T6 the paper was placed differently and cavity 4 was solved. The problem "
                "that stayed open is the one in cavity 3.",
                "Record", "The position of the shim on the mold was photographed at 15:06."),

    tit_tiempos="Lower mold vacuum times — before and after",
    chip_izq_tiempos="RECORD",
    chip_der_tiempos="08/09 · 16:02",
    lbl_antes="BEFORE  ·  5.3 s",
    lbl_ahora="AFTER  ·  11.0 s",
    cap_tiempos=("Machine “Parám. Tiempo” screen, 08/09/2026 16:02. Between the two captures a "
                 "single row changes: Temp. Vacío Rápido Inf. (lower fast vacuum)."),
    panel_tiempos=("What changes between the two screens",
                   "Temp. Vacío Rápido Inf. (lower fast vacuum):  5.3 s  →  11.0 s.   It is the "
                   "only row that differs.",
                   "What was loaded in T13 (16:14)",
                   "Temp. Vacío Lento Inf. (lower slow vacuum):  5.2 s  →  4.0 s.   The lower "
                   "fast vacuum stays at 11.0 s.",
                   "Rows unchanged between the two captures",
                   "T. Calef. 10.0  ·  Ret. Vac. Lento Aux. 1.2  ·  Ret. Vac. Ráp. sup. 1.3  ·  "
                   "Temp. Vacío Lento Inf. 5.2  ·  Ret. Cierre Abajo Mold. sup 0.8  ·  Demora "
                   "Cierre Molde 0.0  ·  Delay Aper Mol Sup. 7.0  ·  Temp. Espera Apertura "
                   "Molde 12.0  (seconds).",
                   "Why these times are changed",
                   "The lower stage of the mold has two vacuum modes, one fast and one slow, and "
                   "the synchronization between them is not correct. The total time remains "
                   "unchanged.",
                   "Record",
                   "Photographs of the machine screen, 08/09/2026 16:02."),

    tit_situ="Situation and next steps — at the close of 08/09",
    rotulo_situ="SITUATION AND IMMEDIATE PLAN",
    bullets=[
        "The day was worked on the front mold, with the trial series T3 to T14.",
        "The cavity 3 vacuum marks are the defect that governs the day: they repeated in every trial, with every temperature combination that was tried.",
        "The temperature sweep went as far as lowering the whole zone line to 400 °C, and the lower one from 435 °C to 410 °C, without correcting the defect.",
        "In T11 it was detected that cavity 2 also has marks, lighter ones, which had not been seen clearly and were repeating.",
        "The cavity 4 sink mark was solved by removing its shim; in exchange a wrinkle appeared, and in T6, with the paper placed differently, the cavity was solved.",
        "KP states that the lower stage of the mold has two vacuum modes, fast and slow, and that the synchronization between them is not correct: in T13 the lower slow vacuum was lowered to 4.0 s, and at 16:28 the T14 parameters were loaded.",
    ],
    rotulo2="TO BE VERIFIED IN THE NEXT RUN",
    cajas=[["Cavity 3", "Whether the time adjustment corrects the marks"],
           ["Cavity 2", "Actual scope of the light marks"],
           ["Cavity 4", "That the wrinkle does not return with the final paper"]],
    tit_panel_situ="What remains to be verified",
    verif=[
        "Cavity 3: confirm whether correcting the synchronization between the fast and the slow vacuum of the lower mold removes the marks, now that the temperature route has been covered.",
        "Cavity 2: determine the actual scope of the light marks detected in T11 and whether they come from the same cause as those in cavity 3.",
        "Vacuum times: record the T14 result and set down the values with which the part comes out conforming. Verify as well that the cavity 4 wrinkle does not show up with the final placement of the paper.",
    ],

    tit_plan="Current action plan — technical actions as of 08/09",
    rotulo_plan="OPEN TECHNICAL ACTIONS",
    cierre_plan=("CRITICAL PRIORITY  ·  The cavity 3 vacuum marks and the tip fold are the "
                 "defects that today condition validation of the Front TopRoll."),
    filas_nuevas=[
        ("Cavity 3 — vacuum marks: the zone temperature adjustment did not correct them",
         "Barack / GS / KP", "Critical", "OPEN"),
        ("Cavity 2 — light marks detected in T11: determine their scope",
         "Barack / GS / KP", "High", "OPEN"),
        ("Lower mold vacuum times — synchronize the fast vacuum with the slow one",
         "GS / KP", "Critical", "IN PROGRESS"),
    ],
)
