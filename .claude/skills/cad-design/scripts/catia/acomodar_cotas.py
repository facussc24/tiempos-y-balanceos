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


def destino_afuera(cd, contorno, paso, usados):
    """Adonde va el VALOR de una cota que cae adentro del contorno de la vista. Cajas en coordenadas de la VISTA (mm del
    modelo: medido en ej66c, el 1000 de abajo del carro venia en y 12-35, encima de la barra de 0-30). Horizontal (mas
    ancha que alta): arriba o abajo del contorno segun la mitad en que estaba; vertical: izquierda o derecha. `usados`
    cuenta cuantas van de cada lado para escalonarlas de a `paso`. Devuelve (x, y, lado), o None si ya esta afuera."""
    x0, y0, x1, y1 = contorno
    # 19/10: probe correr tambien las que quedan afuera pero pegadas (margen de medio paso) y EMPEORO el plano del ej79:
    # chocaron con las cotas a mano y el frente quedo con 2 adentro. Se dejo como estaba; el arreglo es ordenar contra el
    # dibujo y entre cotas en la MISMA pasada.
    if cd[2] <= x0 or cd[0] >= x1 or cd[3] <= y0 or cd[1] >= y1:
        return None
    cx, cy = (cd[0] + cd[2]) / 2, (cd[1] + cd[3]) / 2
    if cd[2] - cd[0] >= cd[3] - cd[1]:
        lado = "arriba" if cy >= (y0 + y1) / 2 else "abajo"
    else:
        lado = "derecha" if cx >= (x0 + x1) / 2 else "izquierda"
    k = usados.get(lado, 0) + 1
    usados[lado] = k
    return {"arriba": (cx, y1 + k * paso), "abajo": (cx, y0 - k * paso),
            "derecha": (x1 + k * paso, cy), "izquierda": (x0 - k * paso, cy)}[lado] + (lado,)


def sacar_afuera(c, vista, contorno, paso_hoja=8.0):
    """Lleva afuera del contorno de la geometria cada cota cuyo valor cae encima de ella. `contorno` = (x0, y0, x1, y1)
    en coordenadas de la vista (la proyeccion de la caja del modelo en los ejes de la vista: CATIA no lo da en esas
    coordenadas; `Size` devuelve mm de hoja). El paso entre cotas del mismo lado es `paso_hoja` mm de HOJA (dividido por
    la escala). Devuelve cuantas movio y cuantas siguen adentro (el control: 0)."""
    paso = paso_hoja / vista.Scale
    usados, movidas = {}, 0
    ds = vista.Dimensions
    dims = [ds.Item(i) for i in range(1, ds.Count + 1)]
    for d in dims:
        dest = destino_afuera(caja(c, d), contorno, paso, usados)
        if dest is not None:
            d.MoveValue(dest[0], dest[1], 0, 0)
            movidas += 1
    adentro = sum(1 for d in dims if destino_afuera(caja(c, d), contorno, paso, {}) is not None)
    return {"movidas": movidas, "siguen_adentro": adentro, "lados": usados}
