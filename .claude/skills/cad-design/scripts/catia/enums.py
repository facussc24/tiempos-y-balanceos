"""enums.py <texto> [...]: valores de las enumeraciones de las bibliotecas de tipos de CATIA cuyo nombre contiene el texto.
Lee las typelibs registradas de Dassault (HKCR\\TypeLib) sin arrancar CATIA."""
import sys
import winreg

import pythoncom

buscados = [t.lower() for t in sys.argv[1:]]


def typelibs():
    with winreg.OpenKey(winreg.HKEY_CLASSES_ROOT, "TypeLib") as k:
        i = 0
        while True:
            try:
                guid = winreg.EnumKey(k, i)
            except OSError:
                return
            i += 1
            try:
                with winreg.OpenKey(k, guid) as kg:
                    ver = winreg.EnumKey(kg, 0)
                    nombre = winreg.QueryValue(kg, ver)
                    if "CATIA" in (nombre or ""):
                        maj, _, mi = ver.partition(".")
                        yield guid, int(maj, 16), int(mi or "0", 16), nombre
            except OSError:
                continue


vistos = set()
for guid, maj, mi, nombre in typelibs():
    try:
        tl = pythoncom.LoadRegTypeLib(guid, maj, mi, 0)
    except pythoncom.com_error:
        continue
    for i in range(tl.GetTypeInfoCount()):
        if tl.GetTypeInfoType(i) != pythoncom.TKIND_ENUM:
            continue
        ti = tl.GetTypeInfo(i)
        n = tl.GetDocumentation(i)[0]
        if not any(b in n.lower() for b in buscados) or n in vistos:
            continue
        vistos.add(n)
        ta = ti.GetTypeAttr()
        valores = []
        for j in range(ta.cVars):
            vd = ti.GetVarDesc(j)
            valores.append(f"{ti.GetNames(vd.memid)[0]}={vd.value}")
        print(f"[{nombre}] {n}: " + ", ".join(valores))
