"""26 numeros de la pagina - BIEN: una pagina chica generada LEYENDO el JSON de medidas que salio del build (distancias
medidas con OpenCASCADE). El mismo dato aparece dos veces con distinta precision (0,58 y 0,5755) y la pagina trae una
fecha, una hora, una version, una norma y una rosca: nada de eso es un numero tipeado."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _pagina as p  # noqa: E402

compuesto, medidas = p.construir(p.luces())
p.escribir('pagina_leida_del_json', compuesto, medidas, p.pasos_leidos(medidas))
