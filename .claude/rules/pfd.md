# Reglas PFD (Flujograma de Proceso)

## Formato de nombres (referencia: Flujograma Armrest Patagonia oficial)
- Recepcion: "RECEPCION DE MATERIA PRIMA" (tipo=storage)
- Transportes: "TRASLADO: [que] A SECTOR DE [destino]"
- Almacenamiento WIP: "ALMACENAMIENTO EN MEDIOS WIP" (tipo=storage)
- Decisiones: "PRODUCTO CONFORME?" o "MATERIAL CONFORME?" (nunca "ESTA OK LA PIEZA?")
- Segregacion: "CLASIFICACION Y SEGREGACION DE PRODUCTO NO CONFORME"
- Inspeccion final: "CONTROL FINAL DE CALIDAD"
- Embalaje: "EMBALAJE Y ETIQUETADO DE PRODUCTO TERMINADO"

## Numeracion de operaciones
- Las OP van de 10 en 10: 10, 20, 30, 40...
- Cada AMFE puede tener su propia secuencia (en uno costura puede ser OP 20, en otro OP 30)
- Sub-operaciones (21, 31, etc.) son para pasos relacionados al proceso padre o cuando el proceso tiene varios pasos
- Los transportes, almacenamientos e inspecciones intermedias NO llevan numero de OP (son conectores)

## Niveles de detalle del flujograma
### PRELIMINAR
- Solo items de proceso de alto nivel: Inyeccion, Costura, Troquelado, Tapizado, etc.
- SIN detalle de sub-pasos (no setup maquina, no tapizado semiautomatico, etc.)
- CON inspecciones, scrap, almacenados, traslados
- CON piezas KD directo a puesto de ensamble
- CON almacenes intermedios / buffers

### PRELANZAMIENTO / PRODUCCION
- Nivel detallado: setup maquina, tapizado semiautomatico, refilado, etc.
- Ejemplo: en tapizado OP 30, el preliminar dice "TAPIZADO", el de produccion desglosa: setup maquina, tapizado semiautomatico, refilado
- CON traslados entre sectores
- CON piezas KD directo a puesto de ensamble
- CON almacenes intermedios / buffers declarados

### Elementos comunes (van en AMBOS niveles)
- Traslados entre sectores
- Almacenes intermedios / buffers
- Piezas KD directo a puesto de ensamble
- Inspecciones y controles de calidad
- Scrap y segregacion de producto no conforme

## Terminologia correcta de equipos/dispositivos
- Ultrasonido: "Dispositivo de ultrasonido" (es una prensa de ultrasonido). NUNCA "pistola de ultrasonido"
- Troquelado: "Troqueladora". NUNCA "mesa de corte" para espumas (las espumas se troquelan, no se cortan en mesa)
  - NOTA: esto aplica al IP PAD. Otros productos Patagonia pueden usar mesa de corte para otros materiales (vinilos/telas)

## Proceso IP PAD — correcciones especificas
- El IP PAD NO lleva PRIMER en su proceso productivo
- Las espumas del IP PAD se troquelan (Troqueladora), NO se cortan en mesa de corte
- El nombre correcto del producto es "IP PAD" (no "IPO PAD")
- Part numbers IP PAD (listado de piezas nominales + FAKOM RZ00349):
  - PL0 Workhorse: 2HC.858.417.D (PP+EPDM inyectado, SIN tapizado — proceso distinto)
  - L1 (PL1): 2HC.858.417.B FAM — PLATE ASM-I/P CTR OTLT AIR [IP PAD - LOW VERSION] (PVC tapizado)
  - L2 (PL2): 2HC.858.417.C GKK — PLATE ASM-I/P CTR OTLT AIR [IP PAD - HIGH VERSION] (PVC tapizado)
  - L3 (PL3): 2HC.858.417.C GKN — PLATE ASM-I/P CTR OTLT AIR [IP PAD - HIGH VERSION] (PVC tapizado)

## Formato visual del export SVG/PDF
- Colores: AZUL CELESTE para bordes y simbolos, texto negro
- Header: Logo Barack | Titulo central | Datos documento a la derecha (codigo, fecha, revision, elaborado/revisado/aprobado, organizacion, responsable area, proyecto, cliente)
- Numeros de OP van DENTRO del simbolo (circulo)
- Columna izquierda: marcas CC/SC segun clasificacion del step
- Caja "LISTADO DE REFERENCIAS A PIEZAS / PRODUCTOS" con part numbers
- Nota obligatoria: "Para todas las operaciones marcadas con CC o SC, es obligatorio consultar el Plan de Control y el PFMEA asociado"
- Leyenda en esquina inferior derecha: OPERACION, TRASLADO, ALMACENADO, INSPECCION, CONDICION

## Reglas de coherencia
- Los nombres y numeros de operacion DEBEN ser IDENTICOS entre PFD, AMFE, CP y HO
- companyName = "BARACK MERCOSUL" (mayusculas)
- customerName = "VWA" o "PWA" (sin variantes)
- Idioma: siempre espanol. No usar ingles (EDGE FOLDING, TRIMMING, etc.)
- El export NO debe decir "Software" en ningun lugar
- El campo Equipo NO se trunca — mostrar completo
- Revisado por y Aprobado por NUNCA pueden ser la misma persona. Son roles distintos en el proceso APQP.

## Lo que NUNCA hacer
- Copiar PFD de un producto a otro sin adaptarlo
- Poner numeros sueltos o "$1" en textos
- Inventar operaciones que no existen en el AMFE
- Usar "pistola de ultrasonido" (es "dispositivo de ultrasonido")
- Poner PRIMER en el proceso del IP PAD
- Cortar espumas en "mesa de corte" para IP PAD (se troquelan)
