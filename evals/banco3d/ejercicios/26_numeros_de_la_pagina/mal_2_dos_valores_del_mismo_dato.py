"""26 numeros de la pagina - MAL 2: el mismo dato con dos valores en la pagina (la «firma barata» de la leccion 39). El
tope de borde 2 aparece a 0,58 mm (version nueva del modelo) y a 0,8 mm (version vieja, cuyo JSON se quedo en la
carpeta). Cada numero SALE de un JSON: ninguno esta tipeado; solo lo caza la regla del dato con dos valores."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _pagina as p  # noqa: E402

compuesto, medidas = p.construir(p.luces())
_, viejas = p.construir(p.luces(tope_borde_2_luz_mm=0.8))
p.escribir('pagina_dos_valores', compuesto, medidas, p.pasos_leidos(medidas, viejas), viejas)
