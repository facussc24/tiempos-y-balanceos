# Reglas PFD (Flujograma de Proceso)

## Formato de nombres (referencia: Flujograma Armrest Patagonia oficial)
- Recepcion: "RECEPCION DE MATERIA PRIMA" (tipo=storage)
- Transportes: "TRASLADO: [que] A SECTOR DE [destino]"
- Almacenamiento WIP: "ALMACENAMIENTO EN MEDIOS WIP" (tipo=storage)
- Decisiones: "PRODUCTO CONFORME?" o "MATERIAL CONFORME?" (nunca "ESTA OK LA PIEZA?")
- Segregacion: "CLASIFICACION Y SEGREGACION DE PRODUCTO NO CONFORME"
- Inspeccion final: "CONTROL FINAL DE CALIDAD"
- Embalaje: "EMBALAJE Y ETIQUETADO DE PRODUCTO TERMINADO"

## Reglas de coherencia
- Los nombres y numeros de operacion DEBEN ser IDENTICOS entre PFD, AMFE, CP y HO
- companyName = "BARACK MERCOSUL" (mayusculas)
- customerName = "VWA" o "PWA" (sin variantes)
- Idioma: siempre espanol. No usar ingles (EDGE FOLDING, TRIMMING, etc.)
- El export NO debe decir "Software" en ningun lugar
- El campo Equipo NO se trunca — mostrar completo

## Lo que NUNCA hacer
- Copiar PFD de un producto a otro sin adaptarlo
- Poner numeros sueltos o "$1" en textos
- Inventar operaciones que no existen en el AMFE
