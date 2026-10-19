# -*- coding: utf-8 -*-
"""material_catia.py — el catalogo de materiales de la instalacion y la busqueda de un material por nombre.
El material se APLICA con fem.poner_acero (part.GetItem("CATMatManagerVBExt") + ApplyMaterialOnPart): es el nombre de
los ejemplos oficiales de Dassault (CAAAniUserMaterial.CATScript, ayuda instalada V5Automation.chm). Medido el 19/10 en
esta R21: "CATMatManagerVBA" da «GetItem failed» en VBScript, VBA y CATScript, y copiar el material del catalogo con
PasteSpecial "CATMatLink" no da error pero NO lo aplica (la densidad sigue en 1000). El control es SIEMPRE la densidad."""

CATALOGO = r"C:\Program Files (x86)\Dassault Systemes\B21\intel_a\startup\materials\Catalog.CATMaterial"


def material_por_indice(mdoc, familia, nombre):
    """El material por nombre recorriendo por indice (en VBScript, Materials.Item("Steel") volvia vacio sin error)."""
    fs = mdoc.Families
    for i in range(1, fs.Count + 1):
        f = fs.Item(i)
        if f.Name == familia:
            ms = f.Materials
            for j in range(1, ms.Count + 1):
                if ms.Item(j).Name == nombre:
                    return ms.Item(j)
    raise KeyError(f"{familia}/{nombre} no esta en el catalogo")
