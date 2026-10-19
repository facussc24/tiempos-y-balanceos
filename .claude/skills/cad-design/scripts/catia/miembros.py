"""miembros.py <Interfaz>: metodos y propiedades de una interfaz de las bibliotecas de tipos de CATIA (sin arrancar CATIA)."""
import sys

import pythoncom

from enums import typelibs  # noqa: E402  (enums.py corre su barrido al importarse solo si se le pasan textos)

for guid, maj, mi, nombre in typelibs():
    try:
        tl = pythoncom.LoadRegTypeLib(guid, maj, mi, 0)
    except pythoncom.com_error:
        continue
    for i in range(tl.GetTypeInfoCount()):
        if tl.GetDocumentation(i)[0] != sys.argv[1]:
            continue
        ti = tl.GetTypeInfo(i)
        vistos = set()
        for j in range(ti.GetTypeAttr().cFuncs):
            fd = ti.GetFuncDesc(j)
            n = ti.GetNames(fd.memid)[0]
            if n not in vistos:
                vistos.add(n)
                print(n)
