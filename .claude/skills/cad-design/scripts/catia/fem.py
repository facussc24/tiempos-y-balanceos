# -*- coding: utf-8 -*-
"""fem.py — simulacion estatica por elementos finitos en CATIA V5 R21 (Generative Structural Analysis) por programa.
Lo que anda, sacado de los ejemplos OFICIALES de la ayuda instalada (V5Automation.chm: CAAAniUserMaterial.CATScript,
CAAAniPreproOnProduct.catvbs, CAAAniMeshOctTetra.catvbs) y probado contra una respuesta exacta en el ej57 (viga en
voladizo: 0,797 mm contra 0,8015 de la cuenta, malla parabolica de 2,5 mm).
  poner_acero(c, doc)                      material del catalogo con part.GetItem("CATMatManagerVBExt") (NO "VBA")
  importar(c, ruta_catpart) -> Estudio     Documents.Add("Analysis") + StartWorkbench("GPSCfg") + ImportDefineFile
  est.empotrar(nombres_de_caras)           SAMClamp
  est.fuerza(nombres_de_caras, (fx,fy,fz)) SAMDistributedForce: el TOTAL en N repartido entre esas caras (medido,
                                           ej59: 100 N sobre las 2 mitades de la punta = 0,797 mm, igual que en 1 cara;
                                           si sumara por cara daria 1,594)
  est.malla(orden="Parabolic", tam="2mm")  OJO: la malla por defecto es LINEAL y en flexion da -66 % sin avisar
  est.calcular() ; est.exportar(imagen) -> [(x, y, z, valores...)]
Los nombres de cara salen de catia_base.topologia(doc, cuerpo, "Face") (d["nombre"]), con la pieza abierta antes."""
import os

from material_catia import CATALOGO, material_por_indice

MACRO_IMPORT = """Function CATMain(c, ruta)
    Set ad = c.Documents.Add("Analysis")
    If c.GetWorkbenchId <> "GPSCfg" Then
        c.StartWorkbench("GPSCfg")
    End If
    Dim a(0)
    ad.Analysis.ImportDefineFile ruta, "CATAnalysisImport", a
    CATMain = ad.Name
End Function"""

IMG_DESPLAZAMIENTO = "Disp_Symbol"            # C1 C2 C3 por nodo (mm)
IMG_VON_MISES = "StressVonMises_Iso_Smooth"   # nombre de los ejemplos oficiales


def poner_acero(c, doc, familia="Metal", nombre="Steel"):
    """Aplica el material y devuelve la densidad que mide el SPA (el control: 1000 = no quedo). Despues se guarda con
    doc.SaveAs(<archivo NUEVO>): «Guardar» sobre una copia abierta no conservo el material (reabierta: 1000, ej58) y sin
    material ImportDefineFile falla («Material is not properly defined»). Se controla reabriendo."""
    mm = doc.Part.GetItem("CATMatManagerVBExt")
    mdoc = c.Documents.Read(CATALOGO)
    mm.ApplyMaterialOnPart(doc.Part, material_por_indice(mdoc, familia, nombre), 0)
    doc.Part.Update()
    dens = doc.GetWorkbench("SPAWorkbench").Inertias.Add(doc.Product).Density
    if abs(dens - 1000.0) < 1e-6:
        raise RuntimeError("el material no quedo: la densidad sigue en 1000 (la de una pieza sin material)")
    return dens


def propiedades(part):
    ps = part.Parameters
    return {ps.Item(i).Name.split("\\")[-1]: ps.Item(i).ValueAsString() for i in range(1, ps.Count + 1)
            if any(k in ps.Item(i).Name for k in ("Young", "Poisson", "Density", "Yield", "Tensile"))}


class Estudio:
    def __init__(self, c, nombre_doc):
        self.c = c
        self.ad = c.Documents.Item(nombre_doc)
        am = self.ad.Analysis
        self.mo = am.AnalysisModels.Item(1)
        ld = am.LinkedDocuments.Item(1)
        self.prod, self.part = ld.Product, ld.Part
        self.caso = self.mo.AnalysisCases.Add()
        sets = self.caso.AnalysisSets
        self.rs = sets.Add("RestraintSet", 0)
        self.ls = sets.Add("LoadSet", 0)
        self.sol = self.caso.AddSolution("StaticSet")

    def _soportes(self, ent, nombres):
        for n in nombres:
            ent.AddSupportFromProduct(self.prod, self.part.CreateReferenceFromName(n))

    def empotrar(self, nombres):
        self._soportes(self.rs.AnalysisEntities.Add("SAMClamp"), nombres)

    def fuerza(self, nombres, vector):
        f = self.ls.AnalysisEntities.Add("SAMDistributedForce")
        self._soportes(f, nombres)
        v = f.BasicComponents.GetItem("SAMForceVector.1")
        v.SetDimensions(3, 1, 1)
        for k, val in enumerate(vector, start=1):
            v.SetValue("", k, 1, 1, float(val))
        return [v.GetValue("", k, 1, 1) for k in (1, 2, 3)]

    def malla(self, orden="Parabolic", tam="2mm"):
        partes = self.mo.MeshManager.AnalysisMeshParts
        if partes.Count != 1:                      # las demas quedarian con la malla LINEAL por defecto, sin aviso
            raise RuntimeError(f"hay {partes.Count} mallas: malla() sabe ajustar una sola")
        mp = partes.Item(1)
        mp.SetGlobalSpecification("ElementOrder", orden)
        mp.SetGlobalSpecification("SizeValue", tam)

    def calcular(self):
        self.caso.Compute()

    def exportar(self, imagen, carpeta, nombre):
        os.makedirs(carpeta, exist_ok=True)
        ruta = os.path.join(carpeta, nombre + ".txt")
        if os.path.exists(ruta):
            os.remove(ruta)
        im = self.sol.AnalysisImages.Add(imagen, False, False, True)
        im.ExportData(self.c.FileSystem.GetFolder(carpeta), nombre, "txt")
        if not os.path.exists(ruta):
            raise RuntimeError(f"ExportData no dejo {ruta}")
        filas = leer_export(open(ruta, encoding="latin-1").read())
        if not filas:                              # un txt solo con encabezados no es «sin desplazamiento»: no se midio
            raise RuntimeError(f"{ruta} no trae ningun nodo")
        return filas


def leer_export(texto):
    """Filas numericas del txt de ExportData: x y z (mm) y los valores; coma decimal; los renglones de encabezado
    («Locations Axis», «x(mm) ...») se saltean. Solo filas con 4 numeros o mas."""
    filas = []
    for linea in texto.splitlines():
        p = [x for x in linea.replace(",", ".").split("\t") if x.strip() != ""]
        try:
            f = tuple(float(x) for x in p)
        except ValueError:
            continue
        if len(f) >= 4:
            filas.append(f)
    return filas


def importar(c, ruta_catpart):
    c.DisplayFileAlerts = False
    return Estudio(c, c.SystemService.Evaluate(MACRO_IMPORT, 0, "CATMain", [c, ruta_catpart]))
