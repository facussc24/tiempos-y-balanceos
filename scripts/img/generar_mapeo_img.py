# -*- coding: utf-8 -*-
"""
Script maestro para generar MAPEO_OPERACIONES_IMG.md
Genera un informe exhaustivo con enlaces relativos, tablas comparativas y análisis riguroso.
"""
import os
import sys
import re

# Directorios
repo_dir = r"c:\Dev\BarackMercosul"
video_dir = r"C:\Users\FacundoS-PC\BARACK ARGENTINA SRL\Ingeniería y Proyecto - General\INGENIERIA BARACK (NUNCA BORRAR)\5- VIDEOS Y FOTOS\1- CLIENTES\NOVAX\TOP ROLL\MAQUINA MOLDEADORA IMG"
claude_dir = os.path.join(video_dir, ".claude")
trans_dir = os.path.join(claude_dir, "transcripciones")
frames_dir = os.path.join(claude_dir, "fotogramas de cada video")
casos_dir = os.path.join(claude_dir, "casos")
target_file = os.path.join(claude_dir, "MAPEO_OPERACIONES_IMG.md")

os.makedirs(claude_dir, exist_ok=True)

# 1. Obtener lista de videos y fotos
vids = sorted(f for f in os.listdir(video_dir) if f.lower().endswith(('.mov', '.mp4')))
photos = sorted(f for f in os.listdir(video_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png', '.heic')))
trans_files = set(os.listdir(trans_dir)) if os.path.exists(trans_dir) else set()
frame_folders = set(os.listdir(frames_dir)) if os.path.exists(frames_dir) else set()

print(f"Videos: {len(vids)}, Fotos: {len(photos)}")

# Escribir el informe estructurado
with open(target_file, "w", encoding="utf-8") as f:
    # Encabezado
    f.write("# MAPEO INTEGRAL DE OPERACIONES Y BIBLIOTECA AUDIOVISUAL — MÁQUINA MOLDEADORA IMG KINGPOWER\n\n")
    f.write("> **Documento Técnico de Ingeniería de Manufactura y Auditoría de Procesos**  \n")
    f.write("> **Proyecto**: Top Roll VW Patagonia (Piezas N 216 / N 256 / N 285 / N 315)  \n")
    f.write("> **Operación Flujograma**: OP 30 — Proceso de Termoformado y Laminado In-Mold Graining (IMG)  \n")
    f.write("> **Formulario SGC Oficial**: I-IN-002.4-R01 (Hoja de Operaciones SGC)  \n")
    f.write("> **Fecha de Emisión**: 22 de Septiembre de 2026  \n")
    f.write("> **Elaboró**: Ingeniería de Procesos BARACK (F. Santoro / C. Baptista)  \n")
    f.write("> **Ubicación del Archivo**: `.claude/MAPEO_OPERACIONES_IMG.md`  \n\n")
    f.write("---\n\n")

    # Resumen Ejecutivo
    f.write("## RESUMEN EJECUTIVO Y ESTADO DE LA BIBLIOTECA AUDIOVISUAL\n\n")
    f.write("El presente informe establece la correspondencia técnica unívoca entre el acervo audiovisual de **91 videos** y **31 fotografías de planta** de la **Máquina Moldeadora IMG KINGPOWER (Molde Hembra)**, contra:\n\n")
    f.write("1. **Las 10 Hojas de Proceso Oficiales (OP 30.1 a OP 30.10)** definidas en el generador maestro [`generar_hojas_img.py`](file:///c:/Dev/BarackMercosul/scripts/img/generar_hojas_img.py) y en el estándar multi-foto SGC.\n")
    f.write("2. **Las 24 dudas operativas y de filmación** documentadas en [`falta_filmar.py`](file:///c:/Dev/BarackMercosul/scripts/img/falta_filmar.py) (21 interrogantes sustantivos de proceso distribuidos en 3 bloques más 3 requerimientos de mejora fotográfica).\n")
    f.write("3. **La memoria técnica de fotogramas y rotulación** contenida en [`LEEME - que es cada foto.md`](file:///c:/Dev/BarackMercosul/scripts/img/assets2/LEEME%20-%20que%20es%20cada%20foto.md) (`scripts/img/assets2/`), garantizando que cada fotografía de instrucción conserve trazabilidad matemática a su segundo y video de origen.\n\n")

    f.write("### Métricas del Repositorio Audiovisual (Corte al 22/09/2026)\n\n")
    f.write(f"- **Total de Videos en Raíz**: **{len(vids)} archivos** (90 contenedores QuickTime `.MOV` y 1 video MPEG-4 `.mp4` vía WhatsApp).\n")
    f.write(f"- **Total de Fotos en Raíz**: **{len(photos)} archivos** (16 `.HEIC` de alta definición, 13 `.JPG`, 1 `.PNG` y 1 `.jpeg`).\n")
    f.write(f"- **Transcripciones Whisper Procesadas**: **{len(trans_files)} archivos** en [`transcripciones/`](transcripciones/) generados con modelo `faster-whisper large-v3-turbo`.\n")
    f.write(f"- **Subdirectorios de Fotogramas Clave**: **{len(frame_folders)} carpetas** en [`fotogramas de cada video/`](<fotogramas de cada video/>) extraídos mediante filtrado de nitidez y similitud.\n")
    f.write("- **Casos de Ingeniería Investigados**: 2 investigaciones formales en [`casos/`](casos/):\n")
    f.write("  - [`CASO - burbuja en la punta del Top Roll (10-09-2026).pdf`](<casos/CASO - burbuja en la punta del Top Roll (10-09-2026).pdf>): Corrección de parámetros de vacío y temperatura inferior.\n")
    f.write("  - [`CASO ALARMA 92 - estacion de conformado fuera de origen (18-09-2026)/`](<casos/CASO ALARMA 92 - estacion de conformado fuera de origen (18-09-2026)/>): Diagnóstico de enclavamiento de cilindros de bloqueo del molde inferior y análisis de pantalla HMI de cambio de molde.\n\n")

    f.write("> [!IMPORTANT]\n")
    f.write("> **Regla de Oro de Planta**: En esta celda no se escribe nada por analogía ni suposición (anti-alucinación estricto). Si una acción no está respaldada por audio del técnico o registro visual nítido del operario, se clasifica como *Brecha de Filmación* y se programa para toma en planta.\n\n")
    f.write("---\n\n")

    # SECCIÓN 1: TABLA COMPLETA DE COBERTURA (OP 30.1 A OP 30.10)
    f.write("## 1. TABLA COMPLETA DE COBERTURA OPERATIVA (OP 30.1 A OP 30.10)\n\n")
    f.write("A continuación se presenta la matriz de cobertura para las 10 operaciones de manufactura aprobadas en la arquitectura oficial SGC (11 láminas: Portada + 10 Operaciones), contrastando la versión activa en `HOJAS_IMG` con las evidencias audiovisuales disponibles.\n\n")

    f.write("| OP SGC | Denominación Oficial | Hoja Activa en `HOJAS_IMG` | Videos que la Sustentan | Minutos / Segundos Clave | Fotos Utilizadas (`assets2/` / `assets/`) | Estado de Cobertura |\n")
    f.write("|:---:|:---|:---|:---|:---|:---|:---:|\n")
    f.write("| **30.1** | Puesta en marcha general y suministros | `30.1`: Encendido general y servicios | [IMG_0596](<../2026-09-02 - MOLDEADORA - tablero electrico abierto (IMG_0596).MOV>), [IMG_0597](<../2026-09-02 - MOLDEADORA - pulsador POWER START y llave general (IMG_0597).MOV>), [IMG_0579](<../2026-09-02 - MOLDEADORA - pantalla de parametros y botonera (IMG_0579).MOV>), [IMG_0869](<../2026-09-11 - TRYOUT - analisis de tirada vespertina y parametros finales (IMG_0869).MOV>) | `0596`: 0:01 (llave ON), 0:06 (corrientes); `0597`: s=2.8-3.0 (POWER START encendido); `0579`: 6:22-6:41 (8 servicios) | `e1_llave.jpg`, `e2_power.jpg`, `n3_servicios.jpg` (`30.1_a_gabinete_suministros.jpg`) | **100% CUBIERTA** |\n")
    f.write("| **30.2** | Acceso al sistema HMI y carga de receta | `30.2`: Reconocimiento puesto de mando | [IMG_0801](<../2026-09-09 - MOLDEADORA - frente de la maquina y pantalla (IMG_0801).MOV>), [IMG_0596](<../2026-09-02 - MOLDEADORA - tablero electrico abierto (IMG_0596).MOV>), [IMG_0830](<../2026-09-10 - MOLDEADORA - HMI - paneo completo de recetas y traduccion (IMG_0830).MOV>), [IMG_0586](<../2026-09-02 - MOLDEADORA - recetas y tabla de moldes en el HMI (IMG_0586).MOV>), [IMG_0645](<../2026-09-04 - MOLDEADORA - HMI - layout 3D y grilla de la mesa de moldes (IMG_0645).MOV>) | `0801`: s=1.1 (puesto completo); `0596`: 0:30-0:34 (control desde HMI); `0830`: s=0-45 (recetas en español); `0645`: s=31 (layout 3D) | `r_puesto.jpg` (rotulada 5 marcas) (`30.2_a_hmi_calentamiento_14-09.jpg`) | **100% CUBIERTA** |\n")
    f.write("| **30.3** | Montaje del rollo de TPO en desbobinador | `30.3`: Reconocimiento botonera de ciclo | [IMG_0393](<../2026-08-26 - MOLDEADORA - pasada del material por la mesa (IMG_0393).MOV>), [IMG_0579](<../2026-09-02 - MOLDEADORA - pantalla de parametros y botonera (IMG_0579).MOV>), [IMG_0842](<../2026-09-10 - TRYOUT - revision de piezas en mesa y control de burbuja (IMG_0842).MOV>), [IMG_0840](<../2026-09-10 - MOLDEADORA - ciclo de conformado y vacio en automatico (IMG_0840).MOV>) | `0393`: s=0-18 (rollo en cuna); `0579`: 6:41 (automático), 7:09-7:40 (RESET 3s); `0842`: 0:00 (botón verde + negro); `0840`: s=4 (botonera) | `r2_botonera.jpg` (rotulada 6 marcas) (`30.3_a_introducir_eje.jpg` a `30.3_d`) | **CUBIERTA (Botonera) / PARCIAL (Carga física rollo)** |\n")
    f.write("| **30.4** | Enhebrado y pasada de lámina a la mesa | `30.4`: Enhebrado vinilo en desenrollador | [IMG_0393](<../2026-08-26 - MOLDEADORA - pasada del material por la mesa (IMG_0393).MOV>) | `0393`: s=48-50 (dos operarios enhebran barras y rodillo verde); s=107-114 (apoyo y alisado en mesa); s=134-135 (material alineado y derecho) | `x2_enhebrar.jpg`, `x3_mesa.jpg`, `x1_desenrollador.jpg` (`30.4_a` a `30.4_d`) | **100% CUBIERTA** |\n")
    f.write("| **30.5** | Cambio de rollo por fin de material | `30.5`: Avance de vinilo con selectores | [IMG_0661](<../2026-09-04 - MOLDEADORA - HMI, pizarra T11 T12 y detalle del molde verde (IMG_0661).MOV>), [IMG_0393](<../2026-08-26 - MOLDEADORA - pasada del material por la mesa (IMG_0393).MOV>), [IMG_0830](<../2026-09-10 - MOLDEADORA - HMI - paneo completo de recetas y traduccion (IMG_0830).MOV>) | `0661`: s=30 (HMI Cuero en rollo); `0393`: s=158 (selectores UNCOILER y Leather Convey en FWD); `0830`: s=41 (pantalla Manual-Carga castellano) | `x6_alimentacion.jpg`, `x4_selectores.jpg`, `x7_carga_hmi.jpg` (`30.5_a` a `30.5_d`) | **100% CUBIERTA (Avance) / DUDAS (Fin rollo)** |\n")
    f.write("| **30.6** | Inspección y limpieza de cavidad molde | `30.6`: Cierre y corte de 1ª lámina | [IMG_0393](<../2026-08-26 - MOLDEADORA - pasada del material por la mesa (IMG_0393).MOV>), [IMG_0579](<../2026-09-02 - MOLDEADORA - pantalla de parametros y botonera (IMG_0579).MOV>), [IMG_0585](<../2026-09-02 - MOLDEADORA - botonera de selectores del tablero (IMG_0585).MOV>), [IMG_0631](<../2026-09-03 - MOLDEADORA - el molde verde sobre la mesa - recorrida y detalle (IMG_0631).MOV>), [IMG_0806](<../2026-09-09 - MOLDE - cavidad del molde verde y orificios de vacio (IMG_0806).MOV>) | `0393`: s=173.3 (botonera de corte); `0579`: 2:10 (CUT PRESS DOWN antes de cortar); `0631`: s=5-15 (cavidad molde verde); `0806`: s=0-30 (orificios vacío) | `x5r_botonera.jpg` (rotulada 4 marcas) (`30.6_a_cavidad_molde_verde.jpg`, `30.6_b`) | **100% CUBIERTA (Corte y Cavidad)** |\n")
    f.write("| **30.7** | Ciclo automático de calentamiento y vaciado | `30.7`: Arranque en Modo Automático | [IMG_0579](<../2026-09-02 - MOLDEADORA - pantalla de parametros y botonera (IMG_0579).MOV>), [IMG_0842](<../2026-09-10 - TRYOUT - revision de piezas en mesa y control de burbuja (IMG_0842).MOV>), [IMG_0840](<../2026-09-10 - MOLDEADORA - ciclo de conformado y vacio en automatico (IMG_0840).MOV>), [IMG_0844](<../2026-09-10 - MOLDEADORA - ciclo completo conformado y desmolde de pieza (IMG_0844).MOV>), [IMG_0863](<../2026-09-11 - MOLDEADORA - ciclo de calentamiento y prensado (IMG_0863).MOV>) | `0579`: 6:22-7:40 (servicios y RESET); `0842`: 0:00 y 1:05-1:11 (arranque ciclo y movimiento carro); `0840`: s=0-25 (ciclo completo); `0844`: s=119-200 (conformado) | `r2_automatico.jpg` (rotulada) (`30.7_a_bimanual.jpg` a `30.7_d_vacio_conformado.jpg`) | **100% CUBIERTA** |\n")
    f.write("| **30.8** | Enfriamiento, corte de vacío y desmolde | `30.8`: Descarga de piezas y carga sustratos | [IMG_0844](<../2026-09-10 - MOLDEADORA - ciclo completo conformado y desmolde de pieza (IMG_0844).MOV>), [IMG_0579](<../2026-09-02 - MOLDEADORA - pantalla de parametros y botonera (IMG_0579).MOV>) | `0844`: s=488 (extracción piezas expulsadas), s=492 (retiro scrap vinilo), s=505 (caballete), 0:55 (2 operarios); `0579`: 7:42-8:09 (carga sustratos en nidos y luces) | `d1_pieza.jpg`, `d2_vinilo.jpg`, `d5_caballete.jpg`, `d3_sustratos.jpg` (`30.8_a` a `30.8_d`) | **100% CUBIERTA** |\n")
    f.write("| **30.9** | Set-up: Desconexión y amarre con puente grúa | `30.9`: Control de pieza termoformada | [IMG_0859](<../2026-09-11 - MOLDEADORA - HMI - tabla de tiempos de ciclo (IMG_0859).MOV>), [IMG_0820](<../2026-09-09 - TRYOUT - resumen tirada T18, piezas en mesa y parametros (IMG_0820).MOV>), [IMG_0660](<../2026-09-04 - TRYOUT - pieza negra larga en la mano - canto envuelto (IMG_0660).MOV>), [IMG_0813](<../2026-09-09 - DEFECTO - pieza T17 en la mano - despegue en la punta (IMG_0813).MOV>), [IMG_0663](<../2026-09-04 - MOLDEADORA - trabajo dentro de la maquina - cableado y mangueras (IMG_0663).MOV>), [IMG_0664](<../2026-09-04 - CAMBIO DE MOLDE - amarre con cadenas y grua sobre la mesa (IMG_0664).MOV>), [IMG_0470](<../2026-08-29 - cambio de molde con alarma de sensor (IMG_0470).MOV>) | `0859`: 0:08 (globito); `0820`: 0:39 (3 puntitos punta); `0660`: s=6 (canto); `0813`: s=0-4 (despegue T17); `0663`: s=10 (desconexión mangueras); `0664`: s=71 (amarre 4 cadenas grúa) | `n5_mano.jpg`, `n8_canto.jpg`, `n7_despegue.jpg` (`30.9_a_hmi_desconexion.jpg`, `30.9_b_cadenas_grua.jpg`) | **100% CUBIERTA (Control Pieza y Set-up Grúa)** |\n")
    f.write("| **30.10** | Set-up: Extracción sobre carro rodante | *(Proyectada: Apagado fin de jornada)* | [IMG_0666](<../2026-09-04 - CAMBIO DE MOLDE - el molde en el carro saliendo de la maquina (IMG_0666).MOV>), [IMG_0668](<../2026-09-04 - CAMBIO DE MOLDE - montaje de los topes rojos sobre el molde en el carro (IMG_0668).MOV>), [IMG_0363](<../2026-08-25 - ingreso del molde con el carro (IMG_0363).MOV>), [IMG_0867](<../2026-09-11 - MOLDEADORA - movimiento de carro portamolde (IMG_0867).MOV>), [IMG_0597](<../2026-09-02 - MOLDEADORA - pulsador POWER START y llave general (IMG_0597).MOV>) | `0666`: s=15 y 45 (molde saliendo sobre rodillos del carro); `0668`: s=0-15 (montaje topes rojos); `0363`: s=0-30 (ingreso en rieles); `0597`: s=1.77 (pulsador POWER STOP) | `30.10_a_alineacion_carro.jpg`, `30.10_b_bloqueo_cama.jpg`, `e0_stop.jpg` | **100% CUBIERTA (Carro) / PENDIENTE (Apagado)** |\n\n")

    f.write("---\n\n")

    # DETALLE OPERACIÓN POR OPERACIÓN
    f.write("### Detalle Pormenorizado de Sustento Audiovisual por Operación\n\n")

    f.write("#### OP 30.1 — Puesta en Marcha General, Suministros y Encendido de Servicios\n")
    f.write("- **Descripción del Proceso**: Energización general de potencia, presurización neumática de red (0.60 MPa), recirculación de agua helada del chiller, encendido de servomotores y activación de la fila de 8 servicios desde la pantalla táctil HMI.\n")
    f.write("- **Evidencia en Video**:\n")
    f.write("  - [IMG_0596](<../2026-09-02 - MOLDEADORA - tablero electrico abierto (IMG_0596).MOV>) (0:01 y 0:06): El operario y técnico frente al seccionador rotativo Schneider: *«¿Puedo cambiar a ON? ¿Así?»* y *«¿Puedes prender los corrientes?»*.\n")
    f.write("  - [IMG_0597](<../2026-09-02 - MOLDEADORA - pulsador POWER START y llave general (IMG_0597).MOV>) (s=2.8 a 3.0): Botón verde `POWER START` (电源启动) encendido, con su cartel reglamentario.\n")
    f.write("  - [IMG_0579](<../2026-09-02 - MOLDEADORA - pantalla de parametros y botonera (IMG_0579).MOV>) (min 6:22 a 6:41): El técnico explica: *«Primer paso es prender todos los servicios, los motores de vacío, la temperatura del horno, iluminación, refrigeración, que es chiller y atemperador»*.\n")
    f.write("  - [IMG_0869](<../2026-09-11 - TRYOUT - analisis de tirada vespertina y parametros finales (IMG_0869).MOV>) (s=33.0 y 44.1): Tomas estables de la llave general (`e1_llave.jpg`), manómetros de red (`e4_manometros.jpg`) y chiller/atemperador (`e3_chiller.jpg`).\n")
    f.write("- **Fotografías Embebidas**: `e1_llave.jpg` (tablero), `e2_power.jpg` (pulsador verde encendido), `n3_servicios.jpg` (fila de 8 servicios en verde).\n\n")

    f.write("#### OP 30.2 — Acceso al Sistema HMI, Puesto de Mando y Carga de Recetas\n")
    f.write("- **Descripción del Proceso**: Reconocimiento de los elementos del puesto de mando (pantalla táctil, selectores, seta de parada de emergencia perimetral, display del atemperador de agua y carteles de seguridad) e ingreso al menú de recetas de producción Top Roll Patagonia.\n")
    f.write("- **Evidencia en Video**:\n")
    f.write("  - [IMG_0801](<../2026-09-09 - MOLDEADORA - frente de la maquina y pantalla (IMG_0801).MOV>) (s=1.13): Puesto de mando frontal en plano general nítido: pantalla HMI, botonera, botón de parada de emergencia, termorregulador de agua de molde y carteles reglamentarios.\n")
    f.write("  - [IMG_0596](<../2026-09-02 - MOLDEADORA - tablero electrico abierto (IMG_0596).MOV>) (min 0:30 a 0:34): Aclaración clave frente al termorregulador: *«todo eso se maneja de allá, de la pantalla»*.\n")
    f.write("  - [IMG_0830](<../2026-09-10 - MOLDEADORA - HMI - paneo completo de recetas y traduccion (IMG_0830).MOV>): Paneo completo del HMI ya traducido al español, mostrando recetas Top Roll Delantera y Trasera.\n")
    f.write("  - [IMG_0586](<../2026-09-02 - MOLDEADORA - recetas y tabla de moldes en el HMI (IMG_0586).MOV>) y [IMG_0645](<../2026-09-04 - MOLDEADORA - HMI - layout 3D y grilla de la mesa de moldes (IMG_0645).MOV>): Visualización de tabla de recetas y vista cinemática 3D de la celda.\n")
    f.write("- **Fotografías Embebidas**: `r_puesto.jpg` (rotulada con 5 cajas: pantalla, botonera, seta, atemperador, carteles) y `30.2_a_hmi_calentamiento_14-09.jpg`.\n\n")

    f.write("#### OP 30.3 — Montaje del Rollo de TPO / Reconocimiento de Botonera de Ciclo\n")
    f.write("- **Descripción del Proceso**: En el estándar SGC: colocación de eje expansible en buje de cartón, centrado, inflado y montaje en cuna. En la versión activa `HOJAS_IMG`: reconocimiento de la botonera colgante (selector de modo automático/manual, botón azul RESET con retardo de 3 s, pulsador verde de marcha, pulsador negro colgante, pulsador rojo de paro y seta de emergencia).\n")
    f.write("- **Evidencia en Video**:\n")
    f.write("  - [IMG_0579](<../2026-09-02 - MOLDEADORA - pantalla de parametros y botonera (IMG_0579).MOV>) (min 6:41 a 7:40): El técnico demuestra el pase a automático y la temporización obligatoria del RESET: *«3 segundos... 3 segundos hasta que se enciende... cuando este luce azul está encendido»*.\n")
    f.write("  - [IMG_0842](<../2026-09-10 - TRYOUT - revision de piezas en mesa y control de burbuja (IMG_0842).MOV>) (min 0:00 y 0:06): Secuencia de arranque: *«botón verde y después botón negro... arrancá si querés de ahí»*.\n")
    f.write("  - [IMG_0840](<../2026-09-10 - MOLDEADORA - ciclo de conformado y vacio en automatico (IMG_0840).MOV>) (s=4.0): Primer plano de la botonera con los pulsadores iluminados.\n")
    f.write("  - [IMG_0393](<../2026-08-26 - MOLDEADORA - pasada del material por la mesa (IMG_0393).MOV>) (s=0 a 18): Rollo con eje pasante apoyado en la cuna de rodillos del desenrollador.\n")
    f.write("- **Fotografías Embebidas**: `r2_botonera.jpg` (rotulada 6 comandos) y grilla multi-foto `30.3_a` a `30.3_d`.\n\n")

    f.write("#### OP 30.4 — Enhebrado y Pasada de Lámina hacia la Mesa de Carga\n")
    f.write("- **Descripción del Proceso**: Tracción manual del extremo libre de la bobina de TPO, guiado a través de rodillos tensores compensadores y barras naranjas, extensión sobre mesa de carga con la cara texturada hacia arriba y alineación contra escuadras.\n")
    f.write("- **Evidencia en Video**:\n")
    f.write("  - [IMG_0393](<../2026-08-26 - MOLDEADORA - pasada del material por la mesa (IMG_0393).MOV>):\n")
    f.write("    - s=48.5: Dos operarios toman la punta del material y la guían cuidadosamente entre las barras naranjas y el rodillo verde.\n")
    f.write("    - s=114.0: El operario apoya la lámina sobre la mesa de carga y la alisa manualmente para eliminar ondulaciones.\n")
    f.write("    - s=134.0: Vista longitudinal comprobando que el material corre perfectamente centrado y derecho desde el rollo a la mesa.\n")
    f.write("- **Fotografías Embebidas**: `x2_enhebrar.jpg`, `x3_mesa.jpg`, `x1_desenrollador.jpg` (reemplazaron al set preliminar `w1`-`w5` por problemas de rotación y desenfoque).\n\n")

    f.write("#### OP 30.5 — Avance del Vinilo con Selectores / Cambio de Rollo\n")
    f.write("- **Descripción del Proceso**: Configuración en HMI de alimentación en *«Cuero en rollo»*, accionamiento bimanual de selectores `UNCOILER` y `Leather Convey` en posición `FWD` (avance motorizado), y ajuste fino desde la pantalla Manual - Carga.\n")
    f.write("- **Evidencia en Video**:\n")
    f.write("  - [IMG_0661](<../2026-09-04 - MOLDEADORA - HMI, pizarra T11 T12 y detalle del molde verde (IMG_0661).MOV>) (s=30.0): Pantalla *«Operación del Equipo»* con la opción *«Selección Lámina Alimentación: Cuero en rollo»* habilitada en verde.\n")
    f.write("  - [IMG_0393](<../2026-08-26 - MOLDEADORA - pasada del material por la mesa (IMG_0393).MOV>) (s=158.3): Caja de comando del desenrollador con las leyendas bilingües `UNCOILER` (开卷机) y `Leather Convey` (皮料输送), ambas con selectores rotativos `FWD/REV`.\n")
    f.write("  - [IMG_0830](<../2026-09-10 - MOLDEADORA - HMI - paneo completo de recetas y traduccion (IMG_0830).MOV>) (s=41.0): Menú *«Manual - Carga»* traducido, mostrando controles de *«Desenrollador: Atrás/Adelante»* y *«Rodillo de prensado»*.\n")
    f.write("- **Fotografías Embebidas**: `x6_alimentacion.jpg`, `x4_selectores.jpg`, `x7_carga_hmi.jpg`.\n\n")

    f.write("#### OP 30.6 — Cierre y Corte de la Primera Lámina / Inspección de Cavidad\n")
    f.write("- **Descripción del Proceso**: Secuencia de corte de lámina a 1100 mm mediante accionamiento ordenado de la botonera: 1) Mordaza de tiro (`PULL CLAMP`); 2) Placa prensadora (`CUT PRESS DOWN`); 3) Placa soporte (`CUT SUPPORT DOWN`); 4) Cuchilla de corte (`CUTTING BLADE ADV`). Paralelamente, inspección visual de la cavidad microporosa niquelada del molde verde y soplado con aire seco.\n")
    f.write("- **Evidencia en Video**:\n")
    f.write("  - [IMG_0393](<../2026-08-26 - MOLDEADORA - pasada del material por la mesa (IMG_0393).MOV>) (s=173.3): Plano en ángulo cenital de la botonera de carga con los 4 mandos rotulados.\n")
    f.write("  - [IMG_0579](<../2026-09-02 - MOLDEADORA - pantalla de parametros y botonera (IMG_0579).MOV>) (min 2:10): Indicación del técnico sobre precedencia de carrera: *«tenés que poner el DOWN de bajar para que ese cuchillo baje»*.\n")
    f.write("  - [IMG_0585](<../2026-09-02 - MOLDEADORA - botonera de selectores del tablero (IMG_0585).MOV>) (s=96.0): Detalle de selectores de corte y seta de emergencia anexa.\n")
    f.write("  - [IMG_0631](<../2026-09-03 - MOLDEADORA - el molde verde sobre la mesa - recorrida y detalle (IMG_0631).MOV>) y [IMG_0806](<../2026-09-09 - MOLDE - cavidad del molde verde y orificios de vacio (IMG_0806).MOV>): Inspección de la cavidad verde, tubos de calentamiento y orificios de vacío.\n")
    f.write("- **Fotografías Embebidas**: `x5r_botonera.jpg` (rotulada 4 pasos) y `30.6_a_cavidad_molde_verde.jpg`.\n\n")

    f.write("#### OP 30.7 — Arranque en Modo Automático y Ciclo de Conformado al Vacío IMG\n")
    f.write("- **Descripción del Proceso**: Habilitación de Modo Automático, verificación de servicios, desbloqueo con RESET (3 s), pulsador verde + negro. Avance de carro superior, descenso de marco tensor, sellado perimetral con clamps, calentamiento zonal continuo de lámina TPO y aplicación de vacío (-0.50 MPa) con soporte neumático (+0.59 MPa).\n")
    f.write("- **Evidencia en Video**:\n")
    f.write("  - [IMG_0579](<../2026-09-02 - MOLDEADORA - pantalla de parametros y botonera (IMG_0579).MOV>) (min 6:22 a 7:40): Puesta en automático y habilitación de seguridades.\n")
    f.write("  - [IMG_0842](<../2026-09-10 - TRYOUT - revision de piezas en mesa y control de burbuja (IMG_0842).MOV>) (min 1:05 a 1:11): Inicio cinemático del ciclo: *«cuando se empieza a mover el carro de arriba, recién ahí arranca, porque ahí va a buscar la placa»*.\n")
    f.write("  - [IMG_0840](<../2026-09-10 - MOLDEADORA - ciclo de conformado y vacio en automatico (IMG_0840).MOV>) (s=0 a 25): Ciclo continuo automático capturado desde el frente del puesto.\n")
    f.write("  - [IMG_0844](<../2026-09-10 - MOLDEADORA - ciclo completo conformado y desmolde de pieza (IMG_0844).MOV>) (s=119 a 200): Registro continuo de la carrera del plato calefactor y sellado sobre el molde.\n")
    f.write("- **Fotografías Embebidas**: `r2_automatico.jpg` (rotulada con modo, servicios y botonera) y set multi-foto `30.7_a_bimanual.jpg` a `30.7_d_vacio_conformado.jpg`.\n\n")

    f.write("#### OP 30.8 — Descarga de Piezas, Retiro de Resto de Vinilo y Carga de Sustratos\n")
    f.write("- **Descripción del Proceso**: Fin de conformado, corte de vacío y contra-soplado de aire inferior para despegue. Ascenso de carro superior. Expulsores neumáticos levantan la pieza. Dos operarios retiran simultáneamente las piezas terminadas, arrancan el scrap perimetral de vinilo del molde, colocan las piezas en caballete y cargan los nuevos sustratos plásticos en los nidos verificando que se enciendan las luces de presencia.\n")
    f.write("- **Evidencia en Video**:\n")
    f.write("  - [IMG_0844](<../2026-09-10 - MOLDEADORA - ciclo completo conformado y desmolde de pieza (IMG_0844).MOV>):\n")
    f.write("    - min 0:55: Reparto coordinado de piezas entre los 2 operarios: *«yo la de abajo, yo la de arriba»*.\n")
    f.write("    - s=488.0: Extracción manual de las piezas apoyadas sobre los expulsores mecánicos.\n")
    f.write("    - s=492.0: Operario retirando a mano el excedente de vinilo que quedó adherido al perímetro del molde verde.\n")
    f.write("    - s=505.0: Disposición de las piezas conformadas en el caballete de producción.\n")
    f.write("  - [IMG_0579](<../2026-09-02 - MOLDEADORA - pantalla de parametros y botonera (IMG_0579).MOV>) (min 7:42 a 8:09): El técnico instruye sobre los sustratos: *«ahora tiene que poner los sustratos... para ver que todo el luce esté encendido... si le falta, le falta luz»*.\n")
    f.write("- **Fotografías Embebidas**: `d1_pieza.jpg`, `d2_vinilo.jpg`, `d5_caballete.jpg`, `d3_sustratos.jpg`.\n\n")

    f.write("#### OP 30.9 — Control de Calidad de Pieza / Set-up Desconexión y Puente Grúa\n")
    f.write("- **Descripción del Proceso**:\n")
    f.write("  - *En control de pieza*: Inspección sensitiva manual en toda la superficie verificando ausencia de burbujas/globitos, control visual de punta descartando marcas de los 3 orificios de vacío, y prueba táctil de despegue en bordes.\n")
    f.write("  - *En cambio de molde*: Bloqueo LOTO, desconexión de mangueras de agua del chiller (purgado) y vacío, desconexión de fichas de termocuplas y amarre del molde verde (1650 kg) con 4 cadenas y cáncamos giratorios al puente grúa.\n")
    f.write("- **Evidencia en Video**:\n")
    f.write("  - [IMG_0859](<../2026-09-11 - MOLDEADORA - HMI - tabla de tiempos de ciclo (IMG_0859).MOV>) (min 0:08 a 0:21): Explicación de Facundo: *«es la que tenía el globito... con eso logramos eliminar el globito»*.\n")
    f.write("  - [IMG_0820](<../2026-09-09 - TRYOUT - resumen tirada T18, piezas en mesa y parametros (IMG_0820).MOV>) (min 0:39): *«el defecto ese que sigue marcando los 3 puntitos ahí en la punta de la pieza»*.\n")
    f.write("  - [IMG_0660](<../2026-09-04 - TRYOUT - pieza negra larga en la mano - canto envuelto (IMG_0660).MOV>) (s=6.0): Inspección táctil y visual del canto envuelto.\n")
    f.write("  - [IMG_0813](<../2026-09-09 - DEFECTO - pieza T17 en la mano - despegue en la punta (IMG_0813).MOV>) (s=0 a 4): *«el T17 generó este defecto que no terminó de pegar bien en la punta»*.\n")
    f.write("  - [IMG_0663](<../2026-09-04 - MOLDEADORA - trabajo dentro de la maquina - cableado y mangueras (IMG_0663).MOV>) (s=10.0): Desconexión de cableados y líneas de fluido.\n")
    f.write("  - [IMG_0664](<../2026-09-04 - CAMBIO DE MOLDE - amarre con cadenas y grua sobre la mesa (IMG_0664).MOV>) (s=71.0): Amarre con 4 ramales de cadena y grilletes de seguridad.\n")
    f.write("- **Fotografías Embebidas**: `n5_mano.jpg`, `n8_canto.jpg`, `n7_despegue.jpg` y set `30.9_a`, `30.9_b`.\n\n")

    f.write("#### OP 30.10 — Extracción sobre Carro Rodante / Secuencia de Apagado de Máquina\n")
    f.write("- **Descripción del Proceso**:\n")
    f.write("  - *En cambio de molde*: Desanclaje de bancada, aproximación y alineación del carro móvil con los rieles de la máquina, frenado de ruedas, deslizamiento del molde verde asistido por puente grúa sobre la cama de rodillos y montaje de topes mecánicos rojos de transporte.\n")
    f.write("  - *En apagado de máquina*: Paro de ciclo con botón rojo, apagado secuencial de servicios en HMI, pulsación de `POWER STOP` (电源停止) y giro de seccionador general a posición 0 (OFF).\n")
    f.write("- **Evidencia en Video**:\n")
    f.write("  - [IMG_0666](<../2026-09-04 - CAMBIO DE MOLDE - el molde en el carro saliendo de la maquina (IMG_0666).MOV>) (s=15 y 45): El molde verde de 1650 kg rodando sobre la cama de rodillos del carro móvil saliendo de la estructura.\n")
    f.write("  - [IMG_0668](<../2026-09-04 - CAMBIO DE MOLDE - montaje de los topes rojos sobre el molde en el carro (IMG_0668).MOV>) (s=0 a 15): Montaje manual de las trabas y topes mecánicos de seguridad rojos para impedir desplazamientos en traslado.\n")
    f.write("  - [IMG_0363](<../2026-08-25 - ingreso del molde con el carro (IMG_0363).MOV>): Ingreso y transferencia del molde mediante rieles de piso.\n")
    f.write("  - [IMG_0597](<../2026-09-02 - MOLDEADORA - pulsador POWER START y llave general (IMG_0597).MOV>) (s=1.77): Registro del pulsador `POWER STOP` (电源停止) en el tablero de comando.\n")
    f.write("- **Fotografías Embebidas**: `30.10_a_alineacion_carro.jpg`, `30.10_b_bloqueo_cama.jpg` y `e0_stop.jpg`.\n\n")

    f.write("---\n\n")

    # SECCIÓN 2: CRUCE CON 'QUÉ FALTA FILMAR'
    f.write("## 2. CRUCE EXHAUSTIVO CON 'QUÉ FALTA FILMAR' (`falta_filmar.py`)\n\n")
    f.write("En esta sección se cotejan sistemáticamente los **24 ítems** documentados en [`falta_filmar.py`](file:///c:/Dev/BarackMercosul/scripts/img/falta_filmar.py) (21 dudas de proceso distribuidas en 3 bloques más 3 mejoras fotográficas) contra la biblioteca audiovisual existente, identificando qué aspectos ya están cubiertos y cuáles exigen tomas complementarias en planta.\n\n")

    # BLOQUE 1: APAGADO
    f.write("### Bloque 1 · Apagado de Máquina (5 Dudas Abiertas)\n\n")
    f.write("> *Contexto*: Es la única fase operativa de rutina que no fue filmada en su totalidad durante las puestas a punto de agosto y septiembre de 2026.\n\n")

    b1_items = [
        ("1. Secuencia completa de fin de jornada, de principio a fin",
         "¿Qué se para primero, qué se apaga después y en qué orden exacto?",
         "Parcialmente Deducible",
         "[IMG_0579](<../2026-09-02 - MOLDEADORA - pantalla de parametros y botonera (IMG_0579).MOV>) (describe encendido de servicios), [IMG_0596](<../2026-09-02 - MOLDEADORA - tablero electrico abierto (IMG_0596).MOV>), [IMG_0904](<../2026-09-12 - TRYOUT - revision final de cierre de jornada (IMG_0904).MOV>).",
         "Filmar la secuencia continua real de fin de turno: 1) Paro de ciclo con botón rojo; 2) Apagado de los 8 servicios en HMI; 3) Pulsado de POWER STOP; 4) Corte de seccionador general."),
        ("2. El pulsador rojo POWER STOP (电源停止) siendo apretado",
         "El pulsador está filmado y rotulado pero nadie lo aprieta nunca en los videos.",
         "Elemento Identificado / Acción Faltante",
         "[IMG_0597](<../2026-09-02 - MOLDEADORA - pulsador POWER START y llave general (IMG_0597).MOV>) (s=1.77 muestra el pulsador rojo claramente rotulado; se extrajo la foto `e0_stop.jpg`).",
         "Toma fija de 3 a 5 s enfocando de cerca la mano del operario presionando físicamente el pulsador rojo POWER STOP y verificando el apagado de la luz testigo verde."),
        ("3. La llave general de la puerta del tablero pasando a OFF (0)",
         "La llave está filmada pasando a ON; falta el gesto de pasarla a OFF.",
         "Filmado solo en ON",
         "[IMG_0596](<../2026-09-02 - MOLDEADORA - tablero electrico abierto (IMG_0596).MOV>) (s=1-2 muestra la mano girando a ON: «¿Puedo cambiar a ON?»), [IMG_0869](<../2026-09-11 - TRYOUT - analisis de tirada vespertina y parametros finales (IMG_0869).MOV>) (s=33 muestra la maneta Schneider).",
         "Toma fija de 3 a 5 s con encuadre medio de la mano girando el seccionador rotativo general desde posición I (ON) a posición 0 (OFF)."),
        ("4. Qué queda encendido después de apagar y qué no",
         "El cartel dice TURN OFF MACHINE WHEN NOT IN USE, pero no aclara si chiller y atemperador quedan en marcha.",
         "Resuelto por Audio / Falta Video",
         "[IMG_0596](<../2026-09-02 - MOLDEADORA - tablero electrico abierto (IMG_0596).MOV>) (min 0:30-0:34 confirma que se manejan desde la pantalla de la máquina), [IMG_0869](<../2026-09-11 - TRYOUT - analisis de tirada vespertina y parametros finales (IMG_0869).MOV>) (s=44).",
         "Filmar si tras bajar la llave general los displays del chiller y atemperador se apagan por completo o si poseen alimentación auxiliar permanente."),
        ("5. La pantalla del HMI en parada o fin de jornada",
         "Se requiere para cerrar la hoja de proceso con lo que ve el operario al retirarse.",
         "Pendiente de Filmación",
         "[IMG_0830](<../2026-09-10 - MOLDEADORA - HMI - paneo completo de recetas y traduccion (IMG_0830).MOV>) (pantalla operativa maquina sana), [IMG_0616](<../2026-09-03 - MOLDEADORA - HMI - registros de produccion y pantallas de carga y descarga (IMG_0616).MOV>).",
         "Toma de 5 s de la pantalla táctil en reposo con los 8 indicadores de servicios en gris/apagado y sin alarmas activas.")
    ]

    for titulo, porque, estado, videos_rel, faltante in b1_items:
        f.write(f"##### {titulo}\n")
        f.write(f"- **Planteo en `falta_filmar.py`**: {porque}\n")
        f.write(f"- **Estado**: **{estado}**\n")
        f.write(f"- **Evidencia Existente**: {videos_rel}\n")
        f.write(f"- **Detalle Específico Faltante**: {faltante}\n\n")

    # BLOQUE 2: EL ROLLO DE VINILO
    f.write("### Bloque 2 · El Rollo de Vinilo y Alimentación (9 Dudas Abiertas)\n\n")

    b2_items = [
        ("6. Cómo sube el rollo a la cuna (mano, autoelevador o carro)",
         "El video IMG_0393 comienza con el rollo ya montado en la cuna; subirlo no está filmado.",
         "Sin Filmación",
         "[IMG_0393](<../2026-08-26 - MOLDEADORA - pasada del material por la mesa (IMG_0393).MOV>) (s=0 ya arranca en la cuna).",
         "Filmar la maniobra de carga del rollo desde el suelo o carro porta-bobina hasta calzar en los soportes de la cuna."),
        ("7. Cómo se fija el eje al rollo y cómo se traba en la cuna",
         "Se observa un collar contra la cara del rollo; no se muestra cómo se asegura mecánicamente.",
         "Elementos Visibles / Fijación sin Filmar",
         "[IMG_0393](<../2026-08-26 - MOLDEADORA - pasada del material por la mesa (IMG_0393).MOV>) (s=132 muestra el eje pasante con collarín metálico).",
         "Filmar si el eje es neumático (acople de pistola y presurización) o mecánico (prisioneros con llave allen / bridas autocentrantes)."),
        ("8. Cómo se centra el rollo a lo ancho y contra qué referencia",
         "Ninguna toma lo muestra ni nadie lo explica en las grabaciones.",
         "Sin Registro",
         "[IMG_0393](<../2026-08-26 - MOLDEADORA - pasada del material por la mesa (IMG_0393).MOV>) (s=134 rollo centrado en cuna).",
         "Toma de detalle mostrando si el eje tiene marcas milimetradas, ranuras fijas o topes regulables para alinear el material con el eje de la mesa."),
        ("9. Para qué lado va la cara buena y si la punta sale por arriba o por abajo",
         "En IMG_0393 sale por arriba, pero falta confirmar si es mandatario.",
         "Registrado en Video / Falta Formalización",
         "[IMG_0393](<../2026-08-26 - MOLDEADORA - pasada del material por la mesa (IMG_0393).MOV>) (s=18 muestra claramente que el material desenrolla saliendo por ARRIBA, con la cara texturada hacia arriba).",
         "Confirmación escrita del Líder de Producción de que el desenrollado superior es la regla de proceso para que el grano copie contra el molde hembra."),
        ("10. Control de lote, FIFO o identificación del rollo",
         "Cero menciones en las transcripciones analizadas.",
         "Sin Registro en Videos",
         "Ningún video aborda el escaneo o verificación de remito.",
         "Filmar si el operario escanea el código de barras del rollo de TPO o registra el número de bobina en la hoja de ruta."),
        ("11. Qué se hace con la punta vieja al terminar un rollo",
         "No está filmado si se realiza empalme con cinta o descarte completo del remanente.",
         "Sin Filmación",
         "Ningún video registra el agotamiento total de un rollo.",
         "Grabar el procedimiento ante fin de bobina: retiro del buje de cartón, descarte del tramo final y re-enhebrado de la bobina entrante."),
        ("12. Desbobinado en serie: ¿manual o automático?",
         "Ambas entradas existen en la lista de E/S y en la pantalla táctil de la máquina.",
         "Resuelto Técnicamente",
         "[IMG_0393](<../2026-08-26 - MOLDEADORA - pasada del material por la mesa (IMG_0393).MOV>) (s=158 selectores en FWD manual), [IMG_0661](<../2026-09-04 - MOLDEADORA - HMI, pizarra T11 T12 y detalle del molde verde (IMG_0661).MOV>) (s=30 HMI en «Cuero en rollo»).",
         "Confirmar en producción continua si la máquina avanza el rollo de manera 100% sincronizada por receta o si requiere habilitación del operario."),
        ("13. El corte filmado de cerca: mordaza cerrando y cuchilla entrando",
         "De los 91 videos, ninguno muestra los actuadores mecánicos en acción; solo se leen los mandos en la botonera.",
         "Mandos Filmados / Mecanismo Faltante",
         "[IMG_0393](<../2026-08-26 - MOLDEADORA - pasada del material por la mesa (IMG_0393).MOV>) (s=173 botonera de carga), [IMG_0585](<../2026-09-02 - MOLDEADORA - botonera de selectores del tablero (IMG_0585).MOV>) (s=96).",
         "Toma de cerca (macro) de 5 s enfocando el área de corte: descenso de mordaza de tiro, bajada de prensador y pasada de la cuchilla seccionando el TPO."),
        ("14. Orden de accionamiento de los 4 comandos de corte",
         "La hoja propone mordaza, prensadora, soporte y cuchilla; falta confirmación.",
         "Criterio Validado / Acción Continua Faltante",
         "[IMG_0393](<../2026-08-26 - MOLDEADORA - pasada del material por la mesa (IMG_0393).MOV>) (s=173), [IMG_0579](<../2026-09-02 - MOLDEADORA - pantalla de parametros y botonera (IMG_0579).MOV>) (min 2:10 el técnico valida: CUT PRESS DOWN antes de cortar), [IMG_0830](<../2026-09-10 - MOLDEADORA - HMI - paneo completo de recetas y traduccion (IMG_0830).MOV>) (s=41).",
         "Grabar a un operario ejecutando fluidamente la secuencia de los 4 selectores y verificando la obtención de la lámina de 1100 mm.")
    ]

    for titulo, porque, estado, videos_rel, faltante in b2_items:
        f.write(f"##### {titulo}\n")
        f.write(f"- **Planteo en `falta_filmar.py`**: {porque}\n")
        f.write(f"- **Estado**: **{estado}**\n")
        f.write(f"- **Evidencia Existente**: {videos_rel}\n")
        f.write(f"- **Detalle Específico Faltante**: {faltante}\n\n")

    # BLOQUE 3: LOS SUSTRATOS Y EL FIN DE CICLO
    f.write("### Bloque 3 · Sustratos y Cierre de Ciclo (7 Dudas Abiertas)\n\n")

    b3_items = [
        ("15. Cuántos sustratos van por ciclo en Top Roll y en qué nidos",
         "El HMI habilita hasta 4 posiciones; el 03/09 solo la posición 1 estaba en verde.",
         "Resuelto en Video (2 sustratos)",
         "[IMG_0844](<../2026-09-10 - MOLDEADORA - ciclo completo conformado y desmolde de pieza (IMG_0844).MOV>) (min 0:00 y 0:55 «yo cargo las dos... yo la de abajo, yo la de arriba» -> son 2 sustratos por ciclo), [IMG_0579](<../2026-09-02 - MOLDEADORA - pantalla de parametros y botonera (IMG_0579).MOV>) (min 7:42).",
         "Toma estática cenital mostrando el molde verde cargado con los 2 sustratos plásticos en sus correspondientes nidos."),
        ("16. Tiempo de retardo en poner sustratos (50 s vs 0 s)",
         "En puesta a punto estaba en 50 s; el técnico indicó que en serie se programa en 0 s.",
         "Registrado en HMI",
         "[IMG_0584](<../2026-09-02 - MOLDEADORA - tabla de parametros en el HMI (IMG_0584).MOV>) y [IMG_0814](<../2026-09-09 - MOLDEADORA - HMI - tabla de tiempos (IMG_0814).MOV>) (pantalla de tiempos: «Ret. en poner Matr.»).",
         "Confirmar en pantalla de producción de serie que el parámetro figure en 0 s y cronometrar los segundos netos que dispone el operario."),
        ("17. Enclavamiento por falta de sustrato (¿frena o solo apaga luz?)",
         "Del audio solo se desprende que la luz se apaga si falta la pieza.",
         "Luz Confirmada / Enclavamiento Pendiente",
         "[IMG_0579](<../2026-09-02 - MOLDEADORA - pantalla de parametros y botonera (IMG_0579).MOV>) (min 7:42 a 8:09 técnico: «para ver que todo el luce esté encendido... si le falta, le falta luz»).",
         "Prueba filmada retirando intencionalmente un sustrato para constatar si la máquina bloquea el inicio de ciclo o emite alarma acústica/visual."),
        ("18. Orientación del sustrato y mecanismo Poka-Yoke",
         "No hay grabaciones sobre dispositivos a prueba de error para evitar carga invertida.",
         "Posición Visible / Poka-Yoke sin Detalle",
         "[IMG_0579](<../2026-09-02 - MOLDEADORA - pantalla de parametros y botonera (IMG_0579).MOV>) (s=472 en `d4_nidos.jpg` y s=480 en `d3_sustratos.jpg`).",
         "Primer plano de los nidos de molde evidenciando pines guía, resaltes o topes mecánicos que impidan el calce incorrecto del sustrato."),
        ("19. Significado del término 'Esqueleto' en HMI (¿sustrato o scrap?)",
         "El HMI traduce 骨架 como Esqueleto; si se confunde con el sustrato la instrucción dice lo opuesto.",
         "Completamente Aclarado por Fak",
         "[IMG_0844](<../2026-09-10 - MOLDEADORA - ciclo completo conformado y desmolde de pieza (IMG_0844).MOV>) (s=488 pieza plástica expulsada / s=492 retiro de scrap de vinilo perimetral), [IMG_0661](<../2026-09-04 - MOLDEADORA - HMI, pizarra T11 T12 y detalle del molde verde (IMG_0661).MOV>) (s=30 `d6_expulsar.jpg`).",
         "En matricería china 骨架 alude a la estructura rígida (sustrato). El generador ya refleja la secuencia real: se retiran primero las piezas y luego el resto de vinilo."),
        ("20. Destino del sobrante de vinilo y control de scrap",
         "Nadie aclara en qué contenedor se deposita ni si se cuantifica.",
         "Acción Filmada / Destino sin Detalle",
         "[IMG_0844](<../2026-09-10 - MOLDEADORA - ciclo completo conformado y desmolde de pieza (IMG_0844).MOV>) (s=492 operario retirando el recorte perimetral de vinilo).",
         "Filmar al operario arrojando el marco de vinilo sobrante en el contenedor rojo de scrap identificado de la celda."),
        ("21. Dotación de mano de obra: ¿uno o dos operarios?",
         "Lo único grabado en simulaciones previas era la mención «dos mínimos».",
         "Totalmente Confirmado (2 Operarios)",
         "[IMG_0844](<../2026-09-10 - MOLDEADORA - ciclo completo conformado y desmolde de pieza (IMG_0844).MOV>) (min 0:55 «yo la de abajo, yo la de arriba» trabajando simultáneamente), [IMG_0393](<../2026-08-26 - MOLDEADORA - pasada del material por la mesa (IMG_0393).MOV>) (s=48 dos operarios enhebrando), [IMG_0579](<../2026-09-02 - MOLDEADORA - pantalla de parametros y botonera (IMG_0579).MOV>) (s=472 dos operarios cargando).",
         "Ningún detalle faltante. La dotación oficial aprobada es de **dos operarios como mínimo**, declarada formalmente en `generar_hojas_img.py`.")
    ]

    for titulo, porque, estado, videos_rel, faltante in b3_items:
        f.write(f"##### {titulo}\n")
        f.write(f"- **Planteo en `falta_filmar.py`**: {porque}\n")
        f.write(f"- **Estado**: **{estado}**\n")
        f.write(f"- **Evidencia Existente**: {videos_rel}\n")
        f.write(f"- **Detalle Específico Faltante**: {faltante}\n\n")

    # BLOQUE 4: MEJORAS FOTOGRÁFICAS
    f.write("### Bloque 4 · Tomas que Mejorarían la Instrucción Visual (3 Mejoras)\n\n")

    b4_items = [
        ("22. Manos accionando pulsadores de frente y quietas (RESET, marcha, paro)",
         "Actualmente están filmadas de perfil o con paneo en movimiento.",
         "[IMG_0579](<../2026-09-02 - MOLDEADORA - pantalla de parametros y botonera (IMG_0579).MOV>), [IMG_0840](<../2026-09-10 - MOLDEADORA - ciclo de conformado y vacio en automatico (IMG_0840).MOV>).",
         "Capturar tomas frontales estáticas de 3 s con teléfono apoyado de la mano presionando cada botón (azul RESET, verde START, negro aux, rojo STOP)."),
        ("23. Pieza terminada entera y sola sobre mesa limpia",
         "Hoy siempre se visualiza sostenida en las manos de los técnicos o de fondo en el taller.",
         "[IMG_0617](<../2026-09-03 - TRYOUT - piezas Top Roll con el canto envuelto sobre la mesa (IMG_0617).HEIC>), [IMG_0623](<../2026-09-03 - TRYOUT - pieza larga en la mano frente a la maquina (IMG_0623).HEIC>), [IMG_0820](<../2026-09-09 - TRYOUT - resumen tirada T18, piezas en mesa y parametros (IMG_0820).MOV>), [IMG_0829](<../2026-09-10 - TRYOUT - pieza Top Roll terminada en la mano, en planta (IMG_0829).HEIC>).",
         "Fotografía en plano cenital de una pieza Top Roll acabada, sobre fondo neutro, exhibiendo el grano, los bordes envueltos y los clips."),
        ("24. Muestra patrón comparativa: pieza buena al lado de pieza con defecto típico",
         "Esencial para el Plan de Reacción visual del operario.",
         "[IMG_0813](<../2026-09-09 - DEFECTO - pieza T17 en la mano - despegue en la punta (IMG_0813).MOV>), [IMG_0859](<../2026-09-11 - MOLDEADORA - HMI - tabla de tiempos de ciclo (IMG_0859).MOV>) (s=5.4 `n6_compara.jpg`), fotos de defecto de Fak 10-09.",
         "Foto comparativa lado a lado de una pieza conforme vs una pieza con defecto (burbuja / despegue / 3 puntos), con marcación clara.")
    ]

    for titulo, porque, evidencia, faltante in b4_items:
        f.write(f"##### {titulo}\n")
        f.write(f"- **Justificación**: {porque}\n")
        f.write(f"- **Evidencia Existente**: {evidencia}\n")
        f.write(f"- **Mejora Solicitada**: {faltante}\n\n")

    f.write("---\n\n")

    # SECCIÓN 3: CATÁLOGO DE VIDEOS RESTANTES
    f.write("## 3. CATÁLOGO DE VIDEOS RESTANTES (BIBLIOTECA COMPLEMENTARIA)\n\n")
    f.write("Los videos que no integran el flujo directo de las 10 hojas de operación constituyen un acervo de ingeniería fundamental para validación de calidad, análisis de tryouts, diagnóstico de averías y calibración térmica.\n\n")

    f.write("### 3.1. Pruebas Operativas de Piezas y Tryouts de Planta (11 Videos)\n\n")
    f.write("Registros de validación de piezas, comportamiento del recubrimiento TPO y ajustes de proceso en planta:\n\n")
    f.write("- [IMG_0477](<../2026-08-29 - parametros cargados - inicio pruebas molde delantero (IMG_0477).MOV>) (29/08/2026, 101.0 MB): Inicio formal de pruebas con el molde delantero y verificación de parámetros iniciales de carga.\n")
    f.write("- [IMG_0478](<../2026-08-29 - clip corto en pruebas (IMG_0478).MOV>) (29/08/2026, 24.1 MB): Secuencia rápida de presurización durante ensayos de moldeo.\n")
    f.write("- [IMG_0657](<../2026-04-09 - TRYOUT - piezas negras terminadas - canto envuelto y clips (IMG_0657).MOV>) (04/09/2026, 96.7 MB): Piezas negras terminadas; inspección minuciosa del doblado del canto envuelto y fijación de clips plásticos.\n")
    f.write("- [IMG_0659](<../2026-09-04 - TRYOUT - piezas negras - tiras largas con canto envuelto (IMG_0659).MOV>) (04/09/2026, 87.1 MB): Examen de tiras largas sobre mesa de trabajo verificando uniformidad del laminado.\n")
    f.write("- [IMG_0660](<../2026-09-04 - TRYOUT - pieza negra larga en la mano - canto envuelto (IMG_0660).MOV>) (04/09/2026, 20.8 MB): Pieza sostenida por el técnico recorriendo el borde con el pulgar (origen de `n8_canto.jpg`).\n")
    f.write("- [IMG_0791](<../2026-09-09 - TRYOUT - prueba inicial con plasticos y explicacion (IMG_0791).MOV>) (09/09/2026, 54.2 MB): Diálogo técnico sobre comportamiento de los plásticos ante el ciclo térmico.\n")
    f.write("- [IMG_0796](<../2026-09-09 - TRYOUT - pizarra y taller (IMG_0796).MOV>) (09/09/2026, 14.7 MB): Vista contextual del área de prueba y registro de datos en pizarra.\n")
    f.write("- [IMG_0820](<../2026-09-09 - TRYOUT - resumen tirada T18, piezas en mesa y parametros (IMG_0820).MOV>) (09/09/2026, 90.5 MB): Resumen de la tirada T18 analizando el marcado de los 3 puntos de vacío en la punta de la pieza.\n")
    f.write("- [IMG_0842](<../2026-09-10 - TRYOUT - revision de piezas en mesa y control de burbuja (IMG_0842).MOV>) (10/09/2026, 126.9 MB): Evaluación crítica de burbujas en mesa y discusión operativa de cadencia de serie.\n")
    f.write("- [IMG_0860](<../2026-09-11 - TRYOUT - control de acabado y textura en piezas (IMG_0860).MOV>) (11/09/2026, 25.3 MB): Cotejo táctil de textura del grano VW en la piel conformada.\n")
    f.write("- [IMG_0865](<../2026-09-11 - TRYOUT - evaluacion de pieza conformada en mesa (IMG_0865).MOV>) (11/09/2026, 27.3 MB): Control de estabilidad dimensional sobre banco intermedio.\n")
    f.write("- [IMG_0869](<../2026-09-11 - TRYOUT - analisis de tirada vespertina y parametros finales (IMG_0869).MOV>) (11/09/2026, 67.3 MB): Registro de cierre vespertino, tablero de potencia y servicios auxiliares.\n")
    f.write("- [IMG_0904](<../2026-09-12 - TRYOUT - revision final de cierre de jornada (IMG_0904).MOV>) (12/09/2026, 21.3 MB): Cierre de jornada operativa y balance de piezas conformadas.\n\n")

    f.write("### 3.2. Defectos Críticos de Calidad y Casos de Estudio\n\n")
    f.write("- **Defecto de Despegue en Punta (Tirada T17)**:  \n")
    f.write("  - [IMG_0813](<../2026-09-09 - DEFECTO - pieza T17 en la mano - despegue en la punta (IMG_0813).MOV>) (09/09/2026, 9.2 MB): Facundo exhibe la pieza T17 con desadherencia de piel en el extremo: *«el T17 generó este defecto que no terminó de pegar bien en la punta, así que para considerarlo»*.  \n")
    f.write("  - **Trazabilidad Fotogramétrica**: La carpeta [`.claude/fotogramas de cada video/0813/`](<fotogramas de cada video/0813>) conserva los **144 fotogramas individuales**, permitiendo inspeccionar el ángulo y gradiente de despegue cuadro por cuadro.\n")
    f.write("- **Defecto de Burbuja y Grano Planchado**:  \n")
    f.write("  - Documentado en fotografías de alta resolución `foto de Fak 10-09 (vistas 1 y 2).jpg` y analizado en [IMG_0859](<../2026-09-11 - MOLDEADORA - HMI - tabla de tiempos de ciclo (IMG_0859).MOV>) (*«con eso logramos eliminar el globito»*).\n")
    f.write("- **Resolución Técnica Formal**:  \n")
    f.write("  - [`casos/CASO - burbuja en la punta del Top Roll (10-09-2026).pdf`](<casos/CASO - burbuja en la punta del Top Roll (10-09-2026).pdf>): Informe de 3 páginas con la causa-raíz y las dos correcciones aprobadas:  \n")
    f.write("    1. Aumento del tiempo de vacío inferior de **8 s a 19 s** en cavidades 2 y 3.  \n")
    f.write("    2. Elevación de temperatura inferior a **440 °C** en cavidad 1.\n\n")

    f.write("### 3.3. Alarmas de Celda, Herramental y Diagnóstico de Alarma 92\n\n")
    f.write("- **Cambio de Molde con Alarma de Sensor**:  \n")
    f.write("  - [IMG_0470](<../2026-08-29 - cambio de molde con alarma de sensor (IMG_0470).MOV>) (29/08/2026, 100.5 MB): Interrupción del set-up por falta de señal de final de carrera.\n")
    f.write("- **Monitoreo de Presiones y Alarmas**:  \n")
    f.write("  - [IMG_0866](<../2026-09-11 - MOLDEADORA - HMI - chequeo de alarmas y presiones (IMG_0866).MOV>) (11/09/2026, 44.1 MB): Verificación de presiones de circuito en HMI y buffer de alarmas activas.\n")
    f.write("- **Investigación Especial: Alarma 92 (Estación de Conformado Fuera de Origen)**:  \n")
    f.write("  - Ocurrencia: 18/09/2026. Código en chino: `成型工位不在原位`.\n")
    f.write("  - Carpeta del Caso: [`casos/CASO ALARMA 92 - estacion de conformado fuera de origen (18-09-2026)/`](<casos/CASO ALARMA 92 - estacion de conformado fuera de origen (18-09-2026)/>).\n")
    f.write("  - **Causa Raíz Diagnosticada**: Falta de confirmación en cilindros de bloqueo del molde inferior (señales 138.0, 138.2, 138.4, 138.6 y presurización 136.7) tras el cambio de molde. Sin estas señales el PLC KingPower inhibe el ciclo.\n")
    f.write("  - **Herramientas Generadas**: Presentación de diagnóstico (11 láminas) e instructivo de cambio de molde (13 láminas) con los 20 pasos de montaje/desmontaje.\n")
    f.write("- **Herramental y Manipulación de Molde Verde**:  \n")
    f.write("  - [IMG_0363](<../2026-08-25 - ingreso del molde con el carro (IMG_0363).MOV>), [IMG_0664](<../2026-09-04 - CAMBIO DE MOLDE - amarre con cadenas y grua sobre la mesa (IMG_0664).MOV>), [IMG_0666](<../2026-09-04 - CAMBIO DE MOLDE - el molde en el carro saliendo de la maquina (IMG_0666).MOV>), [IMG_0668](<../2026-09-04 - CAMBIO DE MOLDE - montaje de los topes rojos sobre el molde en el carro (IMG_0668).MOV>), [IMG_0867](<../2026-09-11 - MOLDEADORA - movimiento de carro portamolde (IMG_0867).MOV>), [IMG_0861](<../2026-09-11 - MOLDEADORA - detalle de tope mecanico (IMG_0861).MOV>).\n\n")

    f.write("### 3.4. Pizarras de Parámetros de Planta y Registro de Tiradas\n\n")
    f.write("Historial visual de los ajustes térmicos y dimensionales acordados en planta:\n\n")
    f.write("- [IMG_0665](<../2026-09-04 - PARAMETROS - pizarra T11 y T12 - MORE HEAT N2 y N3, 0,5 RAISE ON MOLD (IMG_0665).MOV>) (04/09/2026, 48.6 MB): Registro manuscrito de incrementos térmicos (*«MORE HEAT N2 y N3, 0,5 RAISE ON MOLD»*).\n")
    f.write("- [IMG_0790](<../2026-09-09 - PARAMETROS - pizarra T11 y T12 antes de borrar (IMG_0790).MOV>) (09/09/2026, 20.4 MB): Registro previo a la actualización de parámetros vespertinos.\n")
    f.write("- [IMG_0810](<../2026-09-09 - PARAMETROS - pizarra T12 a T14 (IMG_0810).MOV>) (09/09/2026, 23.3 MB): Evolución de tiempos de calentamiento para tiradas T12 a T14.\n")
    f.write("- **Fotografías de Pizarra en Alta Resolución**:  \n")
    f.write("  - `IMG_0654.HEIC` (tiradas T01 a T09, 04/09).\n")
    f.write("  - `IMG_0802.HEIC` (tiradas T1 a T10 de la mañana, 09/09).\n")
    f.write("  - `IMG_0815.JPG` a `IMG_0819.JPG` y versiones enderezadas digitalmente `IMG_E0815.JPG` a `IMG_E0819.JPG` (tiradas T11 a T18 de la tarde, 09/09).\n\n")

    f.write("### 3.5. Pantallas HMI, Zonas Térmicas, Resistencias y Recetas (39 Videos)\n\n")
    f.write("Biblioteca exhaustiva de pantallas para extracción de valores numéricos de proceso (los parámetros se leen de pantalla, nunca del audio):\n\n")
    f.write("- **Matrices de Calentamiento y Resistencias**: [IMG_0786](<../2026-09-09 - MOLDEADORA - HMI - matriz de zonas de calor (IMG_0786).MOV>), [IMG_0789](<../2026-09-09 - MOLDEADORA - HMI - ajuste mas 10 por ciento de calor (IMG_0789).MOV>), [IMG_0793](<../2026-09-09 - MOLDEADORA - HMI - ajuste matriz calefactores (IMG_0793).MOV>), [IMG_0797](<../2026-09-09 - MOLDEADORA - HMI - ajuste calefactores y robot (IMG_0797).MOV>), [IMG_0799](<../2026-09-09 - MOLDEADORA - HMI - cuadricula de resistencias (IMG_0799).MOV>), [IMG_0803](<../2026-09-09 - MOLDEADORA - HMI - incremento mas 15 por ciento (IMG_0803).MOV>), [IMG_0809](<../2026-09-09 - MOLDEADORA - HMI - ajuste por zonas de calor (IMG_0809).MOV>), [IMG_0811](<../2026-09-09 - MOLDEADORA - HMI - matriz de resistencias (IMG_0811).MOV>), [IMG_0839](<../2026-09-10 - MOLDEADORA - HMI - ajuste de matriz termica superior (IMG_0839).MOV>), [IMG_0862](<../2026-09-11 - MOLDEADORA - HMI - verificacion de temperaturas zonales (IMG_0862).MOV>), [WhatsApp 11-09 9.11.mp4](<../2026-09-11 - MOLDEADORA - HMI - matriz de calentamiento y pantalla de servo carga con cotas (WhatsApp 11-09 9.11).mp4>).\n")
    f.write("- **Tablas de Tiempos y Ciclo**: [IMG_0800](<../2026-09-09 - MOLDEADORA - HMI y explicacion tiempo de permanencia en horno (IMG_0800).MOV>), [IMG_0804](<../2026-09-09 - MOLDEADORA - HMI - parametros de proceso y ciclo (IMG_0804).MOV>), [IMG_0805](<../2026-09-09 - MOLDEADORA - HMI - tabla de tiempos de apertura (IMG_0805).MOV>), [IMG_0812](<../2026-09-09 - MOLDEADORA - HMI - parametros de operacion (IMG_0812).MOV>), [IMG_0814](<../2026-09-09 - MOLDEADORA - HMI - tabla de tiempos (IMG_0814).MOV>), [IMG_0828](<../2026-09-10 - MOLDEADORA - HMI - parametros vigentes tirada T1 (IMG_0828).MOV>), [IMG_0841](<../2026-09-10 - MOLDEADORA - HMI - tiempos de vacio y enfriamiento (IMG_0841).MOV>), [IMG_0859](<../2026-09-11 - MOLDEADORA - HMI - tabla de tiempos de ciclo (IMG_0859).MOV>), [IMG_0899](<../2026-09-12 - MOLDEADORA - HMI - parametros de operacion (IMG_0899).MOV>), [IMG_0922](<../2026-09-14 - MOLDEADORA - registro nocturno de tirada y parametros (IMG_0922).MOV>).\n")
    f.write("- **Menús de Recetas y Configuración**: [IMG_0479](<../2026-08-29 - pantalla HMI durante pruebas (IMG_0479).MOV>), [IMG_0580](<../2026-09-02 - MOLDEADORA - HMI y portico - explicacion (IMG_0580).MOV>), [IMG_0582](<../2026-09-02 - MOLDEADORA - pantalla de parametros con el tecnico (IMG_0582).MOV>), [IMG_0584](<../2026-09-02 - MOLDEADORA - tabla de parametros en el HMI (IMG_0584).MOV>), [IMG_0586](<../2026-09-02 - MOLDEADORA - recetas y tabla de moldes en el HMI (IMG_0586).MOV>), [IMG_0587](<../2026-09-02 - MOLDEADORA - pantalla de recetas (IMG_0587).MOV>), [IMG_0589](<../2026-09-02 - MOLDEADORA - tabla de parametros (IMG_0589).MOV>), [IMG_0616](<../2026-09-03 - MOLDEADORA - HMI - registros de produccion y pantallas de carga y descarga (IMG_0616).MOV>), [IMG_0628](<../2026-09-03 - MOLDEADORA - HMI - transporte del marco superior y grilla de moldes (IMG_0628).MOV>), [IMG_0629](<../2026-09-03 - MOLDEADORA - HMI - pantalla de ajuste (IMG_0629).MOV>), [IMG_0630](<../2026-09-03 - MOLDEADORA - HMI - recorrida completa de menus (IMG_0630).MOV>), [IMG_0645](<../2026-09-04 - MOLDEADORA - HMI - layout 3D y grilla de la mesa de moldes (IMG_0645).MOV>), [IMG_0646](<../2026-09-04 - MOLDEADORA - HMI y portico con los tecnicos - diagramas de ciclo (IMG_0646).MOV>), [IMG_0649](<../2026-09-04 - MOLDEADORA - HMI - parametros de tiempo y recetas mas monitor de la refiladora (IMG_0649).MOV>), [IMG_0656](<../2026-09-04 - MOLDEADORA - HMI - grilla de la mesa de moldes (IMG_0656).MOV>), [IMG_0792](<../2026-09-09 - MOLDEADORA - HMI - recorrido de tablas de recetas (IMG_0792).MOV>), [IMG_0798](<../2026-09-09 - MOLDEADORA - HMI - lista de recetas en chino e ingles (IMG_0798).MOV>), [IMG_0830](<../2026-09-10 - MOLDEADORA - HMI - paneo completo de recetas y traduccion (IMG_0830).MOV>), [IMG_0856](<../2026-09-11 - MOLDEADORA - HMI - control de parametros y recetas (IMG_0856).MOV>), [IMG_0858](<../2026-09-11 - MOLDEADORA - HMI y tablero - operacion con el tecnico (IMG_0858).MOV>).\n\n")

    f.write("### 3.6. Videos de Descarte / Fuera de Celda (2 Videos)\n\n")
    f.write("- [IMG_0838](<../2026-09-10 - OFICINA - escritorio con monitor e impresora 3D - no es de la maquina (IMG_0838).MOV>) (10/09/2026, 12.2 MB): Filmación de un escritorio administrativo con impresora 3D en funcionamiento. Descartado para las hojas de proceso de la moldeadora.\n")
    f.write("- [IMG_0896](<../2026-09-12 - SALON - sillas y piso, sin maquina a la vista (IMG_0896).MOV>) (12/09/2026, 8.8 MB): Toma de un salón con sillas y suelo sin maquinaria a la vista. Descartado formalmente.\n\n")

    f.write("---\n\n")

    # TABLA MAESTRA DE LOS 91 VIDEOS
    f.write("### 3.7. Censo y Tabla Maestra de los 91 Videos de la Biblioteca IMG\n\n")
    f.write("| N° | Archivo de Video | Tag | Fecha | Tamaño | Transcripción Whisper | Carpeta Fotogramas | Categoría Funcional | Rol en el Proyecto |\n")
    f.write("|:---:|:---|:---:|:---:|:---:|:---:|:---:|:---|:---|\n")

    for i, v in enumerate(vids, 1):
        m = re.search(r'IMG_([A-Z0-9]+)', v)
        tag = m.group(1) if m else "WhatsApp"
        date_m = re.search(r'(\d{4}-\d{2}-\d{2})', v)
        fecha = date_m.group(1) if date_m else "2026-09-11"
        sz = os.path.getsize(os.path.join(video_dir, v)) / (1024 * 1024)
        has_t = any(tag in tf for tf in trans_files)
        has_f = any(tag in ff for ff in frame_folders)

        # Categorización
        cat = "HMI y Parámetros"
        rol = "Referencia HMI / Recetas"
        if "CAMBIO DE MOLDE" in v or "ingreso del molde" in v or tag in ["0363", "0470", "0664", "0666", "0668"]:
            cat = "Cambio de Molde / Set-up"
            rol = "Sustento OP 30.9 / 30.10"
        elif "DEFECTO" in v or tag == "0813":
            cat = "Defectos de Calidad"
            rol = "Sustento Caso Burbuja / T17"
        elif "TRYOUT" in v or tag in ["0657", "0659", "0660", "0791", "0796", "0820", "0842", "0860", "0865", "0869", "0904"]:
            cat = "Tryout / Pruebas"
            rol = "Validación Piezas y Ciclo"
        elif "PARAMETROS" in v or "PIZARRA" in v or tag in ["0665", "0790", "0810"]:
            cat = "Pizarras de Ajuste"
            rol = "Historial Parámetros Planta"
        elif "pasada del material" in v or tag == "0393":
            cat = "Alimentación de Vinilo"
            rol = "Sustento Central OP 30.4 / 30.5 / 30.6"
        elif tag in ["0596", "0597"]:
            cat = "Tablero y Potencia"
            rol = "Sustento Central OP 30.1 / Apagado"
        elif tag == "0579":
            cat = "Comandos y Servicios"
            rol = "Sustento Central OP 30.1 / 30.3 / 30.7 / 30.8"
        elif tag in ["0840", "0844", "0863", "0396"]:
            cat = "Ciclo Automático"
            rol = "Sustento Central OP 30.7 / 30.8"
        elif tag in ["0631", "0632", "0806", "0857"]:
            cat = "Molde Verde"
            rol = "Sustento OP 30.6 (Cavidad)"
        elif tag in ["0838", "0896"]:
            cat = "Descarte / Externo"
            rol = "No aplicable a la celda"

        rel_trans = os.path.relpath(os.path.join(trans_dir, 'IMG_' + tag + '.txt'), claude_dir).replace('\\', '/')
        t_icon = f"[Sí]({rel_trans})" if has_t else "No"
        f_icon = f"[Sí](<fotogramas de cada video/{tag}/>)" if has_f else "No"

        f.write(f"| {i:02d} | [{v}](<../{v}>) | `{tag}` | {fecha} | {sz:.1f} MB | {t_icon} | {f_icon} | {cat} | {rol} |\n")

    f.write("\n---\n\n")

    # SECCIÓN 4: CONCLUSIONES Y PLAN DE ACCIÓN PARA PLANTA
    f.write("## 4. CONCLUSIONES, SÍNTESIS DE BRECHAS Y PLAN DE ACCIÓN\n\n")
    f.write("### Síntesis de Cobertura de las Hojas de Proceso\n\n")
    f.write("1. **Cobertura Global**: Las 10 operaciones oficiales de manufactura cuentan con sustento fotográfico y de video en **9 de las 10 operaciones de ciclo** (OP 30.1 a 30.9 completas y con validación matemática de fotograma).\n")
    f.write("2. **La Brecha Principal es el APAGADO**: Tal como alertó `falta_filmar.py`, el fin de jornada no fue registrado de forma continua. La máquina cuenta con fotos del pulsador `POWER STOP` (`e0_stop.jpg`) y de la llave general (`e1_llave.jpg`), pero falta el video fluido del operario apagando el equipo.\n")
    f.write("3. **El Bloque de Cambio de Molde está Cubierto**: Los videos `IMG_0663`, `IMG_0664`, `IMG_0666` y `IMG_0668` cubren exhaustivamente la desconexión, el amarre al puente grúa, el desplazamiento sobre rodillos y la fijación de topes rojos.\n")
    f.write("4. **La Dotación es de 2 Operarios**: Queda zanjada cualquier duda sobre balance de línea; los videos `IMG_0844` y `IMG_0393` demuestran que la carga de sustratos, la descarga de piezas y el enhebrado de rollo exigen **dos personas**.\n\n")

    f.write("### Top 5 Tomas Prioritarias a Realizar en Planta (Plan de Filmación Celular)\n\n")
    f.write("Siguiendo el estándar de filmación (3 a 5 segundos de video fijo con teléfono horizontal, apoyado o con codos firmes, sin gente de fondo):\n\n")
    f.write("1. **Secuencia de Apagado de Fin de Turno**:\n")
    f.write("   - Toma 1: Dedo presionando el pulsador rojo `POWER STOP` hasta cortar potencia.\n")
    f.write("   - Toma 2: Mano pasando la llave rotativa Schneider de I a 0 (OFF).\n")
    f.write("   - Toma 3: Pantalla táctil apagándose o en reposo con servicios en gris.\n")
    f.write("2. **Carga Inicial del Rollo de TPO**:\n")
    f.write("   - Toma de 5 s mostrando cómo dos operarios elevan la bobina y la encajan en los soportes de la cuna del desenrollador.\n")
    f.write("3. **Mecanismo Físico de Corte de Lámina (Macro)**:\n")
    f.write("   - Plano cerrado de la mordaza prensando el vinilo y la cuchilla efectuando la pasada de corte a 1100 mm.\n")
    f.write("4. **Poka-Yoke de Sustratos en el Molde**:\n")
    f.write("   - Primer plano cenital mostrando el calce asimétrico del plástico en los nidos del molde verde.\n")
    f.write("5. **Muestra Patrón Buena vs Defectuosa**:\n")
    f.write("   - Fotografía estática de una pieza perfecta junto a la pieza defectuosa T17 con despegue en punta sobre mesa blanca.\n\n")
    f.write("---\n")
    f.write("*Fin del informe. Generado automáticamente por herramientas de ingeniería BARACK.*  \n")

print(f"[OK] Generado exitosamente en: {target_file}")
