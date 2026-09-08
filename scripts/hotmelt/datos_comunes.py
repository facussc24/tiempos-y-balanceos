# -*- coding: utf-8 -*-
"""Datos que comparten todas las hojas de la maquina HOTMELT, y las filas de
CICLO DE CONTROL. Las que vienen del Plan de Control CP-TOPROLL-001 (Rev.0,
25/02/2025) estan marcadas [CP]; las demas salen de un parametro que se LEE en
la pantalla del HMI y esta escrito en el cuerpo de la hoja. Nada esta inventado."""
import os

# los iconos viven al lado de este archivo (carpeta `epp\`); si no estan, se busca
# en el scratchpad de la sesion que los extrajo del xlsx oficial.
_AQUI = os.path.dirname(os.path.abspath(__file__))
EPP_DIR = os.path.join(_AQUI, "epp")
if not os.path.isdir(EPP_DIR):
    EPP_DIR = (r"C:\Users\FACUND~1\AppData\Local\Temp\claude\C--Dev-BarackMercosul"
               r"\c66b0fd1-ca90-4cc1-86f1-5c8410cdd456\scratchpad\epp")
LOGO = (r"C:\Users\FacundoS-PC\BARACK ARGENTINA SRL\Ingeniería y Proyecto - General"
        r"\INGENIERIA BARACK (NUNCA BORRAR)\barack_logo.png")
FOTOS = (r"C:\Users\FacundoS-PC\OneDrive - BARACK ARGENTINA SRL\Desktop"
         r"\Hojas de proceso maquina HOTMELT - desde los videos\_trabajo\fotos_hoja")

# iconos EPP extraidos de las HO reales de Barack (HO-968 / HO-985)
ROPA    = os.path.join(EPP_DIR, "ico_13756.png")   # ropa de trabajo
GUANTES = os.path.join(EPP_DIR, "ico_11789.png")   # guantes
AUDITIVA= os.path.join(EPP_DIR, "ico_12924.png")   # proteccion auditiva
CALZADO = os.path.join(EPP_DIR, "ico_4449.png")    # calzado de seguridad
ANTEOJOS= os.path.join(EPP_DIR, "ico_16034.png")   # anteojos de seguridad
# El BARBIJO no existe en ningun documento de Barack (revise 12 instructivos: solo
# hay ropa, calzado, guantes, anteojos y auditiva). Se dibujo el pictograma normalizado
# ISO 7010 M016 con el azul exacto de los otros iconos -> `_mk_barbijo.py`.
BARBIJO = os.path.join(EPP_DIR, "ico_barbijo.png")

# EPP de toda la operacion. Fak, 02/09/2026: "mas que nada mascara o sea BARBIJO
# PARA LOS GASES y GUANTES PARA LAS QUEMADURAS". Los anteojos ya venian del set de
# la casa y aplican (adhesivo caliente proyectado), asi que quedan.
EPP_BASE = [ROPA, ANTEOJOS, BARBIJO, GUANTES, CALZADO]

CAJETIN = dict(
    # Mientras no tenga N° de HO del listado maestro ni este aprobada, el titulo
    # va "- PRELIMINAR", igual que la HO-968 y la HO-986 reales.
    titulo_hoja="HOJA DE OPERACIONES - PRELIMINAR",
    ho="HO-TBD",
    form="I-IN-002.4-R01",
    modelo="PATAGONIA",
    cliente="VW",      # la HO oficial escribe VW (K8 en las 122 hojas de referencia)
    sector="ADHESIVADO HOT MELT",
    pieza="TOP ROLL PATAGONIA — N 216 / N 256 / N 285 / N 315",
    puesto="-",
    realizo="F. Santoro",
    aprobo="C. Baptista",
    fecha="02/09/2026",
    rev="A",
)

# ── Plan de reaccion ─────────────────────────────────────────────────────────
# Las 3 lineas fijas (detenga / notifique / espere) son del formulario.
# Las acciones de la derecha salen del Plan de Control (P-09/I) para lo que afecta
# al PRODUCTO. Donde el evento es de MAQUINA y todavia no hay material afectado,
# "segregar el material" no aplica: la maquina sale de servicio.
DISPARADOR = 'SI DETECTA "PRODUCTO" O "PROCESO" NO CONFORME'
ACCIONES = ["Segregar e identificar el material afectado.",
            "Dar aviso según P-09/I."]
ACCIONES_MAQUINA = ["Sacar la máquina de servicio e identificarla.",
                    "Dar aviso al líder y a Mantenimiento."]

# ── Ciclo de control ─────────────────────────────────────────────────────────
# (caracteristica, metodo, resp., frecuencia, registro)
# "Registro": el unico valido en esta casa es un "Set up"; si no hay, va "-".
CIC_SUPERFICIE = ("Superficie sin polvo, grasa ni oleosidad",            # [CP]
                  "Verificación operativa", "OP", "Inicio y fin de turno", "-")
CIC_EMPASTADA = ("Rodillo limpio, máquina sin empastar",                 # [CP]
                 "Verificación operativa", "OP", "Inicio y fin de turno", "-")
CIC_PESO_ADH = ("Control de peso de adhesivo",                           # [CP]
                "Verificación operativa", "OP", "Inicio y fin de turno", "-")
CIC_EPP = ("EPP y herramientas (pinzas para tomar el vinilo)",           # [CP]
           "Verificación operativa", "OP", "100%", "-")
CIC_PESO_VIN = ("Peso del vinilo adhesivado",                            # [CP]
                "Pesaje por muestreo con balanza calibrada", "OP",
                "Inicio y fin de turno", "-")
CIC_QUEMADURA = ("Riesgo de quemadura del operario",                     # [CP]
                 "Visual + dispositivo poka-yoke de seguridad", "OP", "100%", "-")
CIC_ADHESION = ("Adhesión del vinilo, sin quemaduras en el vinilo",      # [CP]
                "Inspección visual", "OP", "Inicio y fin de turno", "-")
# El CP dice "Adhesivo en buen estado (>6 meses posteriores a fecha de recepcion)".
# Como esta escrito, un adhesivo VIEJO seria el correcto. No se copia un criterio
# invertido a una hoja de planta: se controla contra la vida util de la ficha.
CIC_ADHESIVO = ("Adhesivo en buen estado (vida útil: TBD)",
                "Visual / Certificado", "OP", "Cada lote", "-")

# Filas que salen de un parametro leido en el HMI y escrito en la propia hoja.
CIC_SETUP_FUSOR = ("Temperatura del adhesivo en el fusor",
                   "Verificación en pantalla del fusor", "OP",
                   "Cada lote / cambio de set up", "Set up")
CIC_RECETA = ("Receta cargada: espesor y luz entre rodillos",
              "Verificación en HMI", "OP", "Cada lote / cambio de set up", "Set up")
CIC_PARAM_TEMP = ("Consigna y protección de los dos rodillos (185 / 150 °C)",
                  "Verificación en HMI", "OP", "Cada lote / cambio de set up", "Set up")
CIC_TEMP_OK = ("Rodillos en temperatura de producción, sin alarmas",
               "Verificación en HMI", "OP", "Cada lote / cambio de set up", "-")
CIC_TENSION = ("Tensión de la banda: consigna 20 kg",
               "Verificación en el controlador", "OP",
               "Cada lote / cambio de set up", "Set up")
CIC_ALINEACION = ("Alineación del material contra la marca del borde",
                  "Inspección visual", "OP", "Inicio y fin de turno", "-")
CIC_ESTOP = ("Paro de emergencia y puerta de seguridad operativos",
             "Prueba funcional", "OP", "Inicio de turno", "Set up")
CIC_PARADA = ("Máquina detenida y señales de seguridad en estado correcto",
              "Verificación en HMI", "OP", "Fin de turno", "-")
CIC_HERRAMIENTA = ("Ausencia de herramienta metálica entre los rodillos",
                   "Verificación operativa", "OP", "100%", "-")
CIC_BORDE = ("Borde de corte limpio, sin hilachas",
             "Inspección visual", "OP", "100%", "-")
CIC_MATERIAL_ID = ("Código y lote del rollo contra la orden",
                   "Verificación documental", "OP", "Cada rollo", "-")
CIC_EMPALME = ("Empalme recto y tomado en todo el ancho",
               "Inspección visual", "OP", "100%", "-")
CIC_PASADO = ("Material pasado por dentro del rodillo, sin arrugas",
              "Inspección visual", "OP", "100%", "-")

TBD = ("TBD", "-", "-", "-", "-")


# ─── Etapas del indice de la portada ─────────────────────────────────────────
# Agrupan las hojas por MOMENTO del turno. El que llega nuevo tiene que distinguir de un
# vistazo lo que hace siempre de lo que hace solo si algo se interrumpe.
ETAPAS = [
    ("PREPARAR Y ARRANCAR", "en este orden, una vez por turno"),
    ("PRODUCIR",            "acá pasa el turno"),
    ("SI PASA ALGO",        "sólo cuando ocurre"),
    ("TERMINAR",            "al cerrar el turno"),
]

# Siglas que NO se pasan a minuscula al armar el titulo del indice.
SIGLAS = ("HMI", "EPP", "VW", "TBD", "HO", "PU", "TPO", "OP")
