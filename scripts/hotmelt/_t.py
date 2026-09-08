# -*- coding: utf-8 -*-
import hoja_pptx as HP
t = "Visual + dispositivo poka-yoke de seguridad"
print("ancho 8.5pt:", round(HP._ancho_cm(t, 8.5, "Calibri", False), 2), "cm   (util 5.14)")
print("fuente:", HP._fuente("Calibri", False, 11))
print("achicar ->", HP._achicar(t, 5.36, 0.52, 8.5))
print("ancho 'Pesaje por muestreo con balanza calibrada':",
      round(HP._ancho_cm("Pesaje por muestreo con balanza calibrada", 8.5, "Calibri", False), 2))
