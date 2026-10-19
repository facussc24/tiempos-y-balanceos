# -*- coding: utf-8 -*-
"""acomodar_cotas.py — ordena las cotas que GenerateDimensions deja amontonadas en un plano de CATIA (ej44).
1. Solo con sacar_repetidas=True: una cota de OTRA vista con el mismo valor (a 0,01) y el mismo DimType que una ya vista
   se saca. Con solo el valor no se sabe si es la MISMA cota (un ancho 40 en la planta y una profundidad 40 en el frente
   son dos: auditor 19/10), asi que por defecto no se saca nada, dentro de una misma vista nunca, y lo sacado vuelve en
   la lista para mirarlo en el PDF.
2. Separa las que se pisan: con la caja de cada cota (GetBoundaryBox, por VBScript porque es lista de salida), mueve el
   valor de la que se pisa (MoveValue) alejandola del centro de la otra, de a 4 mm, hasta 12 intentos.
Devuelve cuantas saco, cuantas movio y cuantas siguen pisadas (el control)."""

MACRO_CAJA = """Function CATMain(d)
    Dim b(7)
    d.GetBoundaryBox b
    CATMain = b(0) & ";" & b(1) & ";" & b(2) & ";" & b(3) & ";" & b(4) & ";" & b(5) & ";" & b(6) & ";" & b(7)
End Function"""


def caja(c, dim):
    v = [float(x.replace(",", ".")) for x in c.SystemService.Evaluate(MACRO_CAJA, 0, "CATMain", [dim]).split(";")]
    xs, ys = v[0::2], v[1::2]
    return [min(xs), min(ys), max(xs), max(ys)]


def se_pisan(a, b, margen=1.0):
    return not (a[2] + margen < b[0] or b[2] + margen < a[0] or a[3] + margen < b[1] or b[3] + margen < a[1])


def acomodar(c, hoja, orden=None, sacar_repetidas=False):
    """orden: nombres de vista a recorrer (None = todas). Devuelve lo sacado (vista, valor, tipo), cuantos movimientos,
    cuantas siguen pisadas y las vistas pedidas que no estan (un nombre que no existe no puede pasar por "nada pisado")."""
    vs = hoja.Views
    por_nombre = {vs.Item(i).Name: vs.Item(i) for i in range(1, vs.Count + 1)}
    nombres = list(por_nombre) if orden is None else list(orden)
    faltan = [n for n in nombres if n not in por_nombre]
    vistos, sacadas = {}, []
    for nombre in nombres:
        v = por_nombre.get(nombre)
        if v is None or not sacar_repetidas:
            continue
        ds = v.Dimensions
        propias = set()
        for i in range(ds.Count, 0, -1):
            try:
                d = ds.Item(i)
                clave = (round(d.GetValue().Value, 2), d.DimType)
            except Exception:  # noqa: BLE001
                continue
            if clave in vistos and vistos[clave] != nombre:
                ds.Remove(i)
                sacadas.append({"vista": nombre, "valor": clave[0], "tipo": clave[1], "queda_en": vistos[clave]})
            else:
                propias.add(clave)
        for clave in propias:
            vistos.setdefault(clave, nombre)
    movidas, pisadas = 0, 0
    for nombre in nombres:
        v = por_nombre.get(nombre)
        if v is None:
            continue
        ds = v.Dimensions
        dims = [ds.Item(i) for i in range(1, ds.Count + 1)]
        for k, d in enumerate(dims):
            for _ in range(12):
                cd = caja(c, d)
                otra = next((caja(c, o) for o in dims[:k] if se_pisan(cd, caja(c, o))), None)
                if otra is None:
                    break
                cx, cy = (cd[0] + cd[2]) / 2, (cd[1] + cd[3]) / 2
                ox, oy = (otra[0] + otra[2]) / 2, (otra[1] + otra[3]) / 2
                dx, dy = cx - ox, cy - oy
                n = (dx * dx + dy * dy) ** 0.5
                if n < 1e-9:                     # misma caja: sin direccion para alejarse; se sube
                    dx, dy, n = 0.0, 1.0, 1.0
                d.MoveValue(cx + 4 * dx / n, cy + 4 * dy / n, 0, 0)
                movidas += 1
            else:
                pisadas += 1
    return {"sacadas": sacadas, "repetidas_sacadas": len(sacadas), "movimientos": movidas, "siguen_pisadas": pisadas,
            "vistas_que_no_estan": faltan}
