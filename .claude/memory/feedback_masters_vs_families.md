---
name: Maestros son procesos, no productos
description: El panel Maestros debe distinguir Foundation FMEA (procesos base) de Family FMEA (productos). No mostrar familias de producto como si fueran maestros de proceso.
type: feedback
---

El panel "Maestros" debe tener 2 secciones claramente separadas per AIAG-VDA 2019:

1. **AMFEs de Fundacion (Procesos Base):** Procesos genéricos NO vinculados a un producto específico (Inyección Plástica, Costura, Tapizado, Ultrasonido). Son familias SIN productos vinculados (memberCount=0).

2. **AMFEs de Familia (Productos):** Familias de producto que comparten proceso (Insert, Armrest, Top Roll, etc.). Son familias CON productos vinculados (memberCount>0).

**Why:** Fak corrigió que mostrar familias de producto como "maestros de proceso" es incorrecto. Los maestros de proceso son Foundation FMEAs que capturan el conocimiento base de la organización sobre una tecnología (inyección, costura, etc.). Las familias de producto son Family FMEAs especializados.

**How to apply:**
- Nunca mezclar los 2 conceptos en la UI
- La distinción en la DB es simple: families con memberCount=0 son Foundation, con memberCount>0 son Family
- El título del panel es "Libreria de AMFEs Maestros" (no "Procesos Maestros")
