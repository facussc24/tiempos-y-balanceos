# -*- coding: utf-8 -*-
"""Ejercicio 7b — choque EXACTO adentro de CATIA con piezas reales: la v16 (y su gemelo subido 1 mm) pegadas como
cuerpo en una COPIA de la pieza del panel, e interseccion contra el cuerpo del panel. Referencia OpenCASCADE
(choque_exacto.py): v16 -> 0 (luz 0,0455); gemelo -> 69,573 mm3."""
import os
import shutil

from catia_base import correr, medir, PRACTICA

PANEL = os.path.join(PRACTICA, "v14_choque", "panel_marco_local.step")
CASOS = {"v16": os.path.join(PRACTICA, "ej13_v16", "out_etapa5.stp"),
         "gemelo_1mm": os.path.join(PRACTICA, "v14_choque", "v16_subida_1mm.step")}


def cuerpo(c, reg):
    for nombre, ruta in CASOS.items():
        def hacer(nombre=nombre, ruta=ruta):
            c.Documents.Open(ruta)
            dv = c.ActiveDocument
            try:
                parte = dv.Part
            except Exception:  # noqa: BLE001
                # un STEP de build123d entra como ENSAMBLE (19/10): la pieza es la del primer componente
                dv = dv.Product.Products.Item(1).ReferenceProduct.Parent
                parte = dv.Part
            vb = parte.MainBody
            v_util = medir(dv, parte, vb)["volume"]
            sel = dv.Selection
            sel.Clear()
            sel.Add(vb)
            sel.Copy()
            sel.Clear()
            c.Documents.Open(PANEL)
            dp = c.ActiveDocument
            pp = dp.Part
            panel_body = pp.MainBody
            sp = dp.Selection
            sp.Clear()
            sp.Add(pp)
            sp.PasteSpecial("CATPrtResultWithOutLink")     # pegar como solido, sin vinculo con el otro documento
            sp.Clear()
            pegado = pp.Bodies.Item(pp.Bodies.Count)
            pp.Update()
            v_pegado = medir(dp, pp, pegado)["volume"]
            pp.InWorkObject = pegado
            pp.ShapeFactory.AddNewIntersect(panel_body)
            try:
                pp.Update()
                inter = medir(dp, pp, pegado).get("volume", 0.0)
                estado = "choca"
            except Exception as e:  # noqa: BLE001
                inter, estado = 0.0, f"interseccion vacia (Update fallo: no choca) {repr(e)[:60]}"
            for d in (dp, dv):
                try:
                    d.Close()
                except Exception:  # noqa: BLE001
                    pass
            return {"utillaje": v_util, "pegado": v_pegado, "interseccion": inter, "estado": estado}
        reg.paso(nombre, hacer)


if __name__ == "__main__":
    correr("ej16_choque_catia_real", cuerpo, fresca=True)
