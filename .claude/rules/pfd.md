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

### Regla maestra (criterio Fak — confirmado 2026-05-08)

El AMFE/PFD se numera LINEALMENTE de 10 en 10, **sin saltos**, en este orden funcional:

```
10 ... 60 (operaciones productivas)
70 (INSPECCION FINAL — anterior a reprocesos)
80 (REPROCESOS — anterior a embalaje)
90 (EMBALAJE — SIEMPRE la ULTIMA, numero mas alto)
```

**EMBALAJE Y ETIQUETADO DE PRODUCTO TERMINADO es siempre la ULTIMA OP** (mayor numero del AMFE). Reprocesos vienen JUSTO ANTES. Inspeccion final viene ANTES de los reprocesos.

NO hay reprocesos despues del embalaje. NO hay saltos del estilo `70 -> 90` cuando OP 80 esta libre.

### Operaciones principales
- Las OP principales van de 10 en 10 sin saltos: 10, 20, 30, 40, 50, 60, 70, 80, 90.
- Si el producto requiere mas etapas productivas, se extiende: 10..100 (con embalaje en 100), 10..110 (con embalaje en 110), etc.
- Cada AMFE puede empezar con OP distinta segun su proceso (uno arranca en costura OP 20, otro en inyeccion OP 10).
- Los transportes, almacenamientos e inspecciones intermedias NO llevan numero de OP (son conectores en el PFD).

### Sub-operaciones del mismo sector
Cuando dos operaciones pertenecen al MISMO SECTOR de planta y se quiere desglosar como pasos secuenciales del mismo equipo/area, se usa la **misma decena con digito de unidad** (no consume "espacio" de la numeracion principal):

- OP 10 "RECEPCION DE MATERIA PRIMA" + OP 11 "CONTROL DE MATERIA PRIMA" (sub-op del sector recepcion)
- OP 80 "REPROCESO: CORRECCION DE DEFECTOS" + OP 82 "REPROCESO: RE-TAPIZADO" (sub-op del sector reprocesos, distinto tipo)
- OP 50 "INYECCION PU" + OP 51 "ENSAMBLE POST-INYECCION" (mismo sector ensamble)

Las sub-ops 11/12, 81/82, 91/92, etc. NO rompen la regla "lineal de 10 en 10" — son pasos del mismo bloque.

### Reprocesos
- Numerados en la decena ANTERIOR a embalaje (tipicamente 80 si embalaje es 90, 90 si embalaje es 100).
- Multiples reprocesos se diferencian con sub-ops: 80, 82, 84, etc.
- NUNCA van despues del embalaje.

### Preparaciones de arranque
Setups del sector se pueden numerar 15, 25, 35 (decena anterior + 5):
- OP 15 "PREPARACION DE CORTE" (setup de OP 20 CORTE)
- OP 35 "COSTURA VISTA" (sub-op de OP 30 COSTURA UNION)

### Resumen para auditores automaticos
Antes de flaggear una numeracion como "invalida", verificar:
1. La ULTIMA OP es el EMBALAJE? -> debe serlo.
2. Antes del embalaje hay REPROCESOS (sub-ops 80/82/84 si embalaje=90)? -> OK.
3. Antes de los reprocesos hay INSPECCION FINAL (OP 70 si reprocesos=80)? -> OK.
4. Hay saltos en la numeracion principal (ej: 70 -> 90 sin que exista 80)? -> ERROR. Renumerar.
5. Hay sub-ops 11, 35, 51, 82 etc.? -> OK si son del mismo sector que su decena.

### Ejemplo canonico (APB Trasero Central / AMFE 150)
```
10 RECEPCION DE MATERIA PRIMA
11 CONTROL DE MATERIA PRIMA
20 CORTE DE COMPONENTES
30 PREPARACION DE KITS
40 COSTURA UNION
50 INYECCION DE PUR IN SITU
60 TAPIZADO
70 CONTROL FINAL DE CALIDAD Y PRUEBAS FUNCIONALES
80 REPROCESO: CORRECCION DE DEFECTOS GENERALES
82 REPROCESO: RE-TAPIZADO DE FUNDA
90 EMBALAJE Y ETIQUETADO DE PRODUCTO TERMINADO
```

### Patrones legacy a corregir
Los AMFEs Headrest (HF/HRC/HRO) hoy tienen reprocesos en 90/92 y embalaje en 100. Eso es legacy del esquema anterior. Cuando se revisen, renumerar a 80/82 reprocesos + 90 embalaje para alinear con esta regla.

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

## Estructura AMFE/PFD — Clasif/Segreg y Clips (confirmadas 2026-04-21)

1. **"CLASIFICACION Y SEGREGACION DE PRODUCTO NO CONFORME" NO va como operacion separada** ni en AMFE ni en PFD. Si existe "CONTROL FINAL DE CALIDAD" / "INSPECCION FINAL", la segregacion de NC esta implicita. Estructura valida: `RECEPCION -> procesos productivos -> CONTROL FINAL (incluye segregacion implicita) -> EMBALAJE`.
   - Eliminadas de: AMFE-1 (Telas Planas OP 90), AMFE-2 (Termoformadas OP 105), AMFE-INS-PAT (Insert OP 111), AMFE-ARM-PAT (Armrest OP 101), y sus 7 PFDs correspondientes.

2. **"COLOCADO DE CLIPS" NO va en TELAS_PLANAS.** El producto "Telas Planas" NO lleva clips — se refuerza con APLIX y ganchos. La OP 45 "Colocado de Clips" fue importada por error y eliminada 2026-04-21.

**Auditoria:** Al importar PPAP o crear AMFE nuevo, verificar:
- No incluir "Clasificacion y Segregacion" como op separada.
- En Telas Planas, alertar si aparece "Clip" en cualquier workElement, failure mode, o characteristic.

**Referencia:** `scripts/_structuralFixes.mjs` aplica este patron. `scripts/_auditIntegral.mjs` detecta reincidencias en tipos `SUSPICIOUS_OP` y `INVALID_OP_CLIPS`.
