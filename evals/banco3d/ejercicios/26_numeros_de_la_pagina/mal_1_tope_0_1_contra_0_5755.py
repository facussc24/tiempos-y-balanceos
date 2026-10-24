"""26 numeros de la pagina - MAL 1: la falla real del 20/10/2026. La pagina dice «El tope de borde 2 queda a 0,1 mm del
plastico del borde» y «la barra queda 47 mm arriba del panel», escritos a mano en pasos.json; el JSON de medidas dice
0,5755 y 69,6. Los dos numeros tipeados calzan por redondeo con OTRA cosa del mismo JSON (0,1394 y 0,1404 de los machos;
47,208 del brazo B): el control que busca solo por valor los deja pasar (AUDITORIA_auditor.md hallazgos 3 y 8)."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _pagina as p  # noqa: E402

compuesto, medidas = p.construir(p.luces())
p.escribir('pagina_con_0_1_tipeado', compuesto, medidas, p.pasos_tipeados())
