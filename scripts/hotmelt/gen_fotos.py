# Genera todas las fotos de las hojas. (video, segundo, nombre)
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from foto import preparar

LISTA = [
    # 20.1 reconocimiento
    ("0347",   0, "h01_a_desbobinador"),
    ("0347",  32, "h01_b_rodillos_reja"),
    ("0347",  46, "h01_c_rodillos_salida"),
    ("9415",   0, "h01_d_vista_general"),
    # 20.2 fusor PUR (panel GLSC)
    ("0349",  56, "h02_a_panel_glsc"),
    ("0349",  64, "h02_b_panel_glsc2"),
    ("0348",  12, "h02_c_unidad_fusor"),
    ("0348",  30, "h02_d_conector"),
    # 20.3 encendido y HMI
    ("0352",   0, "h03_a_login_hmi"),
    ("0380",   0, "h03_b_panel"),
    ("0380",   4, "h03_c_operario_panel"),
    # 20.4 parametros
    ("0383",   0, "h04_a_pantalla_operacion"),
    ("0383",  76, "h04_b_parametros_temp"),
    ("0383", 156, "h04_c_teclado_130"),
    ("0351",  32, "h04_d_seleccion_producto"),
    # 20.5 calentamiento
    ("0382",   0, "h05_a_calentando"),
    ("0391",  82, "h05_b_calentamiento_ok"),
    ("0391",  56, "h05_c_rodillo_pegamento"),
    # 20.6 montaje del rollo
    ("0358",   6, "h06_a_cinta_azul"),
    ("0358",  30, "h06_b_montaje_eje"),
    ("0358",  42, "h06_c_perilla_onoff"),
    ("0355", 172, "h06_d_mandril_aire"),
    # 20.7 enhebrado
    ("9415",   4, "h07_a_rollo"),
    ("9415",  20, "h07_b_primer_rodillo"),
    ("9415",  44, "h07_c_barra_guia"),
    ("9415",  56, "h07_d_sensor_negro"),
    ("9415",  66, "h07_e_entrada_rodillo"),
    # 20.8 centrado y tension
    ("0359",   4, "h08_a_centrado"),
    ("0361",  52, "h08_b_sensor_borde"),
    ("0367", 348, "h08_c_tablero_tension"),
    # 20.9 arranque
    ("0394",   0, "h09_a_hmi_arranque"),
    ("0394",  14, "h09_b_rodillo_gira"),
    ("0394",  26, "h09_c_marca_cinta"),
    # 20.10 laminado en marcha
    ("0392",   6, "h10_a_hmi_automatico"),
    ("0392",  18, "h10_b_material_saliendo"),
    ("0392",  40, "h10_c_enfriamiento"),
    # 20.11 empalme
    ("0367",  50, "h11_a_corte_diagonal"),
    ("0379",  90, "h11_b_cinta_blanca"),
    ("0379", 180, "h11_c_marca_referencia"),
    # 20.12 cambio de rollo por alarma
    ("0364",   2, "h12_a_alarma"),
    ("0364",  14, "h12_b_panel"),
    ("0366",   4, "h12_c_volante_mandril"),
    ("0366",  20, "h12_d_nucleo_vacio"),
    # 20.13 destrabe / fallas
    ("0360",   8, "h13_a_vinilo_mal_pasado"),
    ("0362",  10, "h13_b_material_trabado"),
    # 20.14 corte de la plancha
    ("0353",   0, "h14_a_corte_cuchillo"),
    ("0353",   4, "h14_b_guia_corte"),
    # 20.15 parada y prueba de stop
    ("0392",  54, "h15_a_stop"),
    ("0387", 208, "h15_b_io_seguridad"),
    ("0390",  50, "h15_c_alarmas"),
    # 20.16 apertura de rodillos y plato
    ("0390",  98, "h16_a_ejes_rotacion"),
    ("0387",  78, "h16_b_plato_pegamento"),
    ("0387",  84, "h16_c_plato_manchas"),
    # 20.17 limpieza por pasos
    ("0389",   0, "h17_a_pantalla_limpieza"),
    ("0388",  86, "h17_b_traductor_paso2"),
    ("0388", 234, "h17_c_rodillos_pegamento"),
    ("0390",  10, "h17_d_trapo"),
    # portada
    ("0392",  40, "portada_maquina"),
]

for vid, seg, nom in LISTA:
    try:
        p, size = preparar(vid, seg, nom)
        print(f"{nom:28} {vid} {seg:>4}s  {size}")
    except SystemExit as e:
        print(f"!! {nom}: {e}")
    except Exception as e:
        print(f"!! {nom}: {type(e).__name__} {e}")
print("LISTO")
