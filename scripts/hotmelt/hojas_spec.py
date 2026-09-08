# -*- coding: utf-8 -*-
"""Contenido de las hojas de proceso de la maquina HOTMELT.

Reglas que se respetan aca:
  · Frases cortas: las columnas son angostas y el texto largo se corta.
  · Es para el operario: nada de "borrador", "pendiente" ni analisis.
  · Sin dato -> TBD, y nada mas.
  · Los numeros salen de la PANTALLA (HMI o fusor), no del audio.
  · Registro: solo "Set up"; si no hay, "-".
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from datos_comunes import (FOTOS, EPP_BASE, TBD, ACCIONES_MAQUINA,
                           CIC_SUPERFICIE, CIC_EMPASTADA, CIC_PESO_ADH, CIC_EPP,
                           CIC_ADHESIVO, CIC_PESO_VIN, CIC_QUEMADURA, CIC_ADHESION,
                           CIC_SETUP_FUSOR, CIC_RECETA, CIC_PARAM_TEMP, CIC_TEMP_OK,
                           CIC_TENSION, CIC_ALINEACION, CIC_ESTOP, CIC_PARADA,
                           CIC_HERRAMIENTA, CIC_BORDE, CIC_MATERIAL_ID,
                           CIC_EMPALME, CIC_PASADO)

try:
    from datos_privados import CLAVE_HMI
except ImportError:            # el repo es publico: sin este archivo va TBD
    CLAVE_HMI = "TBD"

def F(*nombres):
    return [os.path.join(FOTOS, n + ".jpg") for n in nombres]

PORTADA = dict(
    titulo="HOJAS DE PROCESO — MÁQUINA HOTMELT",
    subtitulo="Laminadora de vinilo con adhesivo hot melt  ·  OP 20 del FLUJOGRAMA 122 TOP ROLL PATAGONIA",
    ho="HO-TBD",
    form="I-IN-002.4-R01",
    op_flujo="20 — ADHESIVADO HOT MELT",
    cliente_modelo="VW / PATAGONIA",
    pieza="TOP ROLL — N 216 / N 256 / N 285 / N 315",
    maquina="Laminadora hot melt KINGPOWER + fusor de adhesivo",
    firmas="F. Santoro / C. Baptista",
    fecha_rev="02/09/2026  ·  Rev. A",
    foto=os.path.join(FOTOS, "cand_30.jpg"),   # vista de la maquina con el material saliendo
)

# La JERARQUIA de imagenes de cada hoja (agregada el 03/09/2026):
#   principal = la imagen que el paso manda mirar o leer. Va grande; el resto la acompaña.
#               Sin esta clave el reparto vuelve a ser por geometria, que fue lo que puso
#               una mano con un celular mas grande que la tabla de parametros del fusor.
#   leer      = indices de imagenes con numeros o rotulos que el operario TIENE que leer.
#               Las pantallas redibujadas ademas llevan su metrica adentro del PNG.
# El indice es la posicion en el bloque, de arriba-izquierda a abajo-derecha.
# Umbrales y chequeo: _hojaProcesoCheck.py.

HOJAS = [
 dict(op="20.1", etapa="PREPARAR Y ARRANCAR", principal=0, leer=[], denominacion="RECONOCIMIENTO DE LA MÁQUINA Y RIESGOS",
   imagenes=F("h01_d_vista_general","h01_a_desbobinador","h01_b_rodillos_reja"),
   pasos=["Identificar las tres zonas: desbobinador, rodillos de aplicación y salida del material.",
          "Ubicar las paradas de emergencia antes de operar.",
          "Respetar los carteles de la máquina: atrapamiento de manos entre rodillos y riesgo eléctrico.",
          "Los rodillos trabajan entre 150 y 185 °C. No tocarlos sin protección.",
          "El desbobinador trabaja con aire comprimido: cuidado al despresurizar.",
          "Sin ropa suelta, capucha ni cordones colgando cerca de los rodillos.",
          "Nunca dejar una pieza metálica entre los rodillos: se rompen al instante."],
   nota="La instalación tiene dos pantallas: el HMI de la laminadora y la del fusor de "
        "adhesivo. Los dos rodillos calientes son el de encolado y el dosificador.",
   ciclo=[]),

 # El adhesivo lo aplica LA MAQUINA SOLA, por 2 canos (Fak, 02/09/2026). Las tomas
 # donde se ve pegamento puesto A MANO sobre el rodillo eran de PRUEBA y no van.
 dict(op="20.2", etapa="PREPARAR Y ARRANCAR", principal=0, leer=[0], denominacion="PUESTA EN MARCHA DEL FUSOR DE ADHESIVO",
   imagenes=F("h02_c_unidad_fusor","h02_e_tanque_adhesivo","h02_b_panel_glsc2"),
   pasos=["Encender el fusor de adhesivo ANTES que la laminadora, con el interruptor rojo.",
          "Verificar que el tanque tenga adhesivo cargado.",
          "Activar el calentamiento: el general y los de las dos mangueras y las dos pistolas.",
          "Verificar la consigna del adhesivo en la pantalla del fusor: 160 °C.",
          "Esperar a que el adhesivo se derrita por completo.",
          "Verificar que las dos pistolas de aplicación estén libres y sin obstrucción.",
          "Si una pistola queda obstruida, no destaparla en caliente: dar aviso al líder."],
   nota="El fusor manda el adhesivo por dos mangueras calientes a dos pistolas montadas "
        "sobre el rodillo. Los cinco circuitos van a 160 °C y ese valor NO se toca en el día "
        "a día. Desde frío, las pistolas llegan cerca de la consigna en unos 8 minutos; el "
        "tanque tarda más. El adhesivo fundido quema y se pega a la piel: no tocar mangueras "
        "ni pistolas, y trabajar con barbijo por los vapores.",
   ciclo=[],
   acciones=ACCIONES_MAQUINA),

 dict(op="20.3", etapa="PREPARAR Y ARRANCAR", principal=0, leer=[], denominacion="ENCENDIDO Y ACCESO AL HMI",
   imagenes=F("h03_b_panel","h03_a_login_hmi","h03_c_operario_panel"),
   pasos=["Encender la máquina desde el tablero principal.",
          "En el HMI, ingresar la contraseña %s." % CLAVE_HMI,
          "Si la máquina quedó con un error, presionar Reset (pulsador amarillo).",
          "Verificar en pantalla que no queden alarmas activas."],
   nota="Las alarmas del HMI son puerta de seguridad sin cerrar, paro de emergencia y "
        "fallas de accionador de eje (entrada de material, encolado, dosificador, "
        "elevación, apoyo y luz). Sin resolverlas la máquina no arranca. El HMI está en "
        "chino y tiene un botón English en el menú.",
   ciclo=[],
   acciones=ACCIONES_MAQUINA),

 # Los valores salen de la pantalla de ajuste de parametros de temperatura del
 # SIMATIC HMI, filmada en el video 0383. Los dos rodillos llevan los mismos valores.
 dict(op="20.4", etapa="PREPARAR Y ARRANCAR", principal=0, leer=[0], denominacion="CARGA DE PARÁMETROS DE PRODUCTO Y TEMPERATURA",
   imagenes=F("h04_a_pantalla_operacion","h04_b_parametros_temp"),  # dos pantallas grandes:
   # con tres, el rotulo de las flechas queda chico para leerlo en la hoja impresa
   pasos=["Entrar a Selección de producto y elegir la receta del material a procesar.",
          "Verificar que el espesor de producto sea el de la receta cargada.",
          "Verificar que la luz entre rodillos sea la de la receta cargada.",
          "Verificar la velocidad de línea: 3 m/min.",
          "Verificar la velocidad del rodillo dosificador: 0,040 m/min.",
          "Verificar la temperatura de consigna de los dos rodillos: 185 °C.",
          "Verificar la temperatura de protección: 150 °C. Por debajo, los rodillos no giran.",
          "Verificar las desviaciones de alarma: 10 °C por encima y 10 °C por debajo.",
          "Verificar la alarma por sobretemperatura: 220 °C.",
          "Verificar la temperatura de espera: 150 °C, y la de enfriamiento: 100 °C."],
   nota="Receta 料号1, producto tpo: espesor 2,300 mm, espesor de prensado 0,000 mm y luz "
        "entre rodillos 0,250 mm. Las recetas de las otras piezas: TBD. La luz entre "
        "rodillos es la que fija el espesor de adhesivo. La velocidad se cambia en un solo "
        "valor: el resto se acomoda solo y el enrollador va al doble.",
   ciclo=[]),

 dict(op="20.5", etapa="PREPARAR Y ARRANCAR", principal=0, leer=[0], denominacion="CALENTAMIENTO Y ESPERA",
   imagenes=F("h05_a_calentando","h05_b_calentamiento_ok","h05_c_rodillo_pegamento"),
   pasos=["Con el calentamiento activo, esperar a que los rodillos lleguen a temperatura.",
          "Con la máquina fría, el calentamiento puede tardar alrededor de 1 hora.",
          "Los rodillos recién se habilitan a girar por encima de 150 °C.",
          "Esperar a que la pantalla indique calentamiento completado.",
          "No forzar el giro de los rodillos con el pegamento frío: se pega y se rompe.",
          "La producción arranca con los rodillos a 185 °C y sin alarmas."],
   ciclo=[],
   acciones=ACCIONES_MAQUINA),

 dict(op="20.6", etapa="PREPARAR Y ARRANCAR", principal=0, leer=[], denominacion="MONTAJE DEL ROLLO EN EL DESBOBINADOR",
   imagenes=F("h06_d_mandril_aire","h06_b_montaje_eje","h06_c_perilla_onoff"),
   pasos=["Verificar que el código y el lote del rollo coincidan con los de la orden.",
          "Cerrar la punta suelta del rollo con cinta antes de moverlo.",
          "Colocar el mandril neumático dentro del tubo de cartón del rollo.",
          "Centrar el rollo sobre el mandril con la escala del eje (valor de centrado: TBD).",
          "Inflar el mandril para que agarre el tubo.",
          "Levantar el rollo entre dos personas y calzarlo en el desbobinador.",
          "Llevar la perilla del desbobinador a ON."],
   ciclo=[]),

 dict(op="20.7", etapa="PREPARAR Y ARRANCAR", principal=0, leer=[], denominacion="ENHEBRADO DEL MATERIAL",
   imagenes=F("h07_b_primer_rodillo","h07_f_serpentina","h07_d_sensor_negro"),
   pasos=["Colocar el rollo mirando hacia adelante.",
          "Pasar el control de tensión a manual para poder tirar del material.",
          "Pasar el material por el primer rodillo, del lado del frente.",
          "Seguir la serpentina: sube, baja, vuelve a subir y vuelve a bajar.",
          "Pasar el material por el dispositivo de guía de borde que está abajo.",
          "Pasar por debajo del rodillo y subir.",
          "Meter el material dentro del rodillo de hot melt."],
   nota="Si el vinilo queda por fuera del rodillo plateado, está mal pasado. Se enhebra "
        "con la máquina detenida y los rodillos ya calientes: guantes puestos y sin "
        "apoyar las manos sobre los rodillos.",
   ciclo=[]),

 dict(op="20.8", etapa="PREPARAR Y ARRANCAR", principal=0, leer=[], denominacion="CENTRADO Y TENSIÓN DE LA BANDA",
   imagenes=F("h08_a_centrado","h08_b_sensor_borde","h08_c_tablero_tension"),
   pasos=["Centrar el material contra la barra guía usando la regla.",
          "Verificar que el sensor de borde tome el borde del material.",
          "Verificar la tensión en el controlador: consigna 20 kg. Si no da, ajustar antes de arrancar.",
          "Verificar que el control de guía esté en automático.",
          "Volver a poner el control de tensión en automático antes de producir.",
          "Verificar que el material corra sin arrugas."],
   ciclo=[]),

 dict(op="20.9", etapa="PREPARAR Y ARRANCAR", principal=0, leer=[0], denominacion="ARRANQUE Y ALINEACIÓN",
   imagenes=F("h09_a_hmi_arranque","h09_b_reset","h09_c_marca_cinta"),
   pasos=["Verificar que los resguardos estén cerrados y que no haya nadie en la zona de rodillos.",
          "Presionar el pulsador verde de arranque.",
          "Probar el paro de emergencia con la máquina en vacío: se tiene que detener.",
          "Rearmar el paro de emergencia, presionar Reset y volver a arrancar.",
          "Verificar en pantalla que el estado pase a automático.",
          "Controlar la alineación del material contra la marca del borde.",
          "Corregir la alineación antes de dejar correr la máquina."],
   nota="La prueba del paro de emergencia se hace acá, antes de producir, y no al final "
        "del turno: es lo que habilita a trabajar el resto de la jornada.",
   ciclo=[]),

 dict(op="20.10", etapa="PRODUCIR", principal=0, leer=[], denominacion="LAMINADO — CONTROL DURANTE LA MARCHA",
   imagenes=F("h10_a_hmi_automatico","h10_b_material_saliendo","h10_c_enfriamiento"),
   pasos=["Controlar que el material salga sin arrugas ni marcas.",
          "Controlar que el adhesivo quede parejo, sin faltantes ni excesos.",
          "Controlar que no haya quemaduras en el vinilo.",
          "Controlar el peso del vinilo adhesivado con la balanza.",
          "Verificar que las temperaturas de los rodillos se mantengan en consigna.",
          "Verificar que el enfriamiento a la salida esté funcionando.",
          "No meter la mano entre los rodillos con la máquina en marcha."],
   nota="Si el adhesivo sale en hilos o tiritas, la temperatura está baja o la velocidad "
        "alta. Si el vinilo sale quemado, la temperatura está alta.",
   ciclo=[]),

 dict(op="20.11", etapa="SI PASA ALGO", principal=0, leer=[], denominacion="EMPALME DEL MATERIAL",
   imagenes=F("h11_a_corte_diagonal","h11_b_cinta_blanca","h11_c_marca_referencia"),
   pasos=["Detener la máquina según la hoja 20.15 para hacer el empalme.",
          "Cortar la punta del material RECTA, apoyada contra la barra amarilla de "
          "referencia. Reglas de corte: hoja 20.14.",
          "Marcar el punto de referencia sobre la barra con cinta.",
          "Enfrentar las dos puntas a tope contra la barra amarilla.",
          "Unir el empalme con cinta a lo largo de todo el ancho.",
          "Verificar que el empalme quede recto antes de arrancar.",
          "Marcar el tramo del empalme: la cinta pasa al producto.",
          "Manos lejos del rodillo. Antes de rearrancar, verificar que no haya nadie "
          "en la zona de rodillos."],
   nota="El empalme NUNCA va cruzado ni en diagonal: al estirarse se rompe por el medio.",
   ciclo=[]),

 dict(op="20.12", etapa="SI PASA ALGO", principal=0, leer=[], denominacion="CAMBIO DE ROLLO POR ALARMA DE FIN DE MATERIAL",
   imagenes=F("h12_a_pulsador_rojo","h12_c_volante_mandril","h12_e_rollo_nuevo"),
   pasos=["Al sonar la alarma de fin de material, la máquina se detiene.",
          "Presionar el pulsador rojo del desbobinador.",
          "Sacarle la presión de aire al mandril con el volante del eje.",
          "Verificar que quede despresurizado antes de desconectar la manguera.",
          "Retirar el tubo de cartón vacío.",
          "Montar el rollo nuevo según la hoja 20.6.",
          "Empalmar el material según la hoja 20.11.",
          "Antes de rearrancar, verificar que no haya nadie en la zona de rodillos."],
   ciclo=[]),

 dict(op="20.13", etapa="SI PASA ALGO", principal=0, leer=[], denominacion="DESTRABE DEL MATERIAL TRABADO",
   imagenes=F("h13_c_maquina_detenida","h13_b_material_trabado","h13_a_vinilo_mal_pasado"),
   pasos=["Si el material se frunce o se traba, detener la máquina según la hoja 20.15.",
          "Esperar el paro total de los rodillos antes de tocar el material.",
          "Revisar el punto donde la mesa pasa al rodillo.",
          "Liberar el material sin tironear.",
          "Verificar que el material esté pasado por dentro del rodillo, no por fuera.",
          "Antes de rearrancar, verificar que no haya nadie en la zona de rodillos.",
          "Reanudar sólo con el material bien pasado y sin arrugas."],
   nota="Los rodillos quedan calientes aunque la máquina esté detenida: entrar con "
        "guantes y no apoyar las manos.",
   ciclo=[]),

 dict(op="20.14", etapa="TERMINAR", principal=0, leer=[], denominacion="CORTE DE LA PLANCHA",
   imagenes=F("h14_a_corte_cuchillo","h14_b_guia_corte"),
   pasos=["Apoyar la plancha sobre una superficie plana y limpia.",
          "No cortar cuadrados: dan problemas en esta máquina.",
          "Cortar con forma redondeada, siguiendo la guía.",
          "Empezar el corte por el costado, nunca por el centro.",
          "Cortar siempre en dirección contraria al cuerpo.",
          "La mano libre va detrás del filo, nunca sobre la línea de corte.",
          "Verificar que el borde quede limpio, sin hilachas."],
   ciclo=[]),

 dict(op="20.15", etapa="TERMINAR", principal=0, leer=[0], denominacion="PARADA DE LA MÁQUINA",
   imagenes=F("h15_a_stop","h15_c_alarmas","h15_b_io_seguridad"),
   pasos=["Presionar el pulsador rojo de parada.",
          "Verificar que los rodillos frenen por completo.",
          "Verificar en pantalla que el estado pase a detenido.",
          "Verificar en la pantalla de señales de seguridad que el paro de emergencia y "
          "la puerta figuren en estado correcto.",
          "Dejar la máquina sin material trabado y la zona de rodillos despejada."],
   nota="La prueba funcional del paro de emergencia va antes de producir (hoja 20.9), "
        "con la máquina en marcha. Acá sólo se verifica el estado de las señales.",
   ciclo=[],
   acciones=ACCIONES_MAQUINA),

 dict(op="20.16", etapa="TERMINAR", principal=0, leer=[], denominacion="APERTURA DE RODILLOS Y COLOCACIÓN DE LA BANDEJA",
   imagenes=F("h16_a_ejes_rotacion","h16_b_plato_pegamento","h16_c_plato_manchas"),
   pasos=["Con la máquina detenida, entrar en el HMI a la pantalla de limpieza y llevar "
          "el eje de elevación a la posición de limpieza.",
          "Abrir la puerta de seguridad recién cuando el HMI indique que quedó liberada.",
          "Colocar la bandeja de recolección de pegamento debajo de los rodillos.",
          "Cubrir la bandeja con papel descartable.",
          "Verificar que no quede ninguna herramienta metálica entre los rodillos."],
   nota="Con la puerta abierta los rodillos siguen a temperatura de trabajo: entrar con "
        "guantes, sin apoyar los antebrazos y sin meter las manos entre los rodillos.",
   ciclo=[],
   acciones=ACCIONES_MAQUINA),

 dict(op="20.17", etapa="TERMINAR", principal=0, leer=[0], denominacion="LIMPIEZA DE RODILLOS POR PASOS",
   imagenes=F("h17_a_pantalla_limpieza","h17_c_rodillos_pegamento"),  # la pantalla con
   # las flechas necesita tamano: con tres fotos el rotulo no se lee impreso
   pasos=["En el HMI, entrar a la pantalla de limpieza de pegamento.",
          "Paso 1 de la máquina: arrancar la limpieza. La puerta de seguridad queda liberada.",
          "Paso 2 de la máquina: agregar el líquido de limpieza. La luz entre rodillos se "
          "cierra y el rodillo gira continuo.",
          "Paso 3 de la máquina: el rodillo deja de girar.",
          "Limpiar con trapo y rasqueta de plástico. Nada de metal contra los rodillos.",
          "Verificar que los rodillos queden limpios. Si queda pegamento, repetir el Paso 2.",
          "Retirar la bandeja y el papel, y dar por terminada la limpieza.",
          "Antes de volver a producir, verificar que la luz entre rodillos vuelva al valor "
          "de la receta (hoja 20.4).",
          "Antes de rearrancar, verificar que no haya nadie en la zona de rodillos."],
   nota="El adhesivo forma una película sobre el rodillo y esa película cambia el espesor "
        "que se aplica: por eso se limpia. DURANTE LA LIMPIEZA LA PUERTA DE SEGURIDAD "
        "QUEDA ANULADA y el rodillo gira "
        "caliente: el líquido se aplica desde afuera del paso de rodillos, nunca con la "
        "mano entre ellos. Mientras dure la limpieza (4 a 5 minutos) no la opera nadie "
        "más. Elemento con el que se aplica el líquido: TBD.",
   ciclo=[],
   acciones=ACCIONES_MAQUINA),
]
