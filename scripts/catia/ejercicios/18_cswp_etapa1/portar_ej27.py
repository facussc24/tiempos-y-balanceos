# -*- coding: utf-8 -*-
"""Copia ej27_parametrico.py (practica del 19/10) a scripts/catia/ejercicios/18_cswp_etapa1/pieza_ej27.py con los cambios
minimos para usarlo desde el catia.py del banco. Uso: python portar_ej27.py <ej27_parametrico.py> <destino.py>"""
import io
import sys

src, dst = sys.argv[1], sys.argv[2]
s = io.open(src, encoding="utf-8").read()


def rep(viejo, nuevo, veces=1):
    global s
    if s.count(viejo) != veces:
        raise SystemExit(f"esperaba {veces} vez/veces: {viejo[:70]!r} (hay {s.count(viejo)})")
    s = s.replace(viejo, nuevo)


cabecera = ('# -*- coding: utf-8 -*-\n'
            '# Origen: ej27_parametrico.py de la practica del 19/10/2026 (C:\\Dev\\_catia_practica de la PC principal, copiado a\n'
            '# CATA por el PEDIDO PARA CATA 6). Cambios para el ejercicio 18 del banco de CATIA (24/10/2026), nada mas:\n'
            '# 1) importa solo medir, nueva_pieza, ref y topologia de catia_base (el del repo); 2) cuerpo(c, reg) arma la pieza\n'
            '# con la etapa 1 y devuelve ctx (doc, part, body y los planos de construccion para ocultarlos); las etapas, la\n'
            '# masa, la captura y el STEP los hace el catia.py; 3) sin el bloque __main__ (no se corre suelto).\n')
rep('# -*- coding: utf-8 -*-\n', cabecera)
rep('from catia_base import captura, correr, guardar_pieza, medir, nueva_pieza, ref, topologia',
    'from catia_base import medir, nueva_pieza, ref, topologia')
rep('            body.InsertHybridShape(p25)\n', '            body.InsertHybridShape(p25)\n            ctx["p25"] = p25\n')
rep('            body.InsertHybridShape(p35)\n', '            body.InsertHybridShape(p35)\n            ctx["p35"] = p35\n')
ini = s.index('        def etapas():')
fin = s.index('    return cuerpo')
s = s[:ini] + ('        ctx.update(doc=doc, sf=sf, vol=vol)\n'
               '        return ctx\n\n') + s[fin:]
ini = s.index('if __name__ == "__main__":')
s = s[:ini].rstrip() + "\n"
io.open(dst, "w", encoding="utf-8", newline="\n").write(s)
print("ok", dst, len(s.splitlines()), "renglones")
