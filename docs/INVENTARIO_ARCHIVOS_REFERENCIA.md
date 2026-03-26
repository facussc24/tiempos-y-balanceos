# Inventario de Archivos de Referencia

Carpeta fuente: `C:\Users\FacundoS-PC\Documents\26.3.26\NUEVA RONDA DE MEJORAS SOFTWARE\`
Fecha de relevamiento: 2026-03-26
Total de archivos: 35 (28 PDFs, 5 PNGs, 1 PDF duplicado mal ubicado, 1 informe PWA)

---

## Resumen ejecutivo

Se encontraron 4 BOMs de producto, 22 normas VW, 5 capturas de planos de ingenieria, 1 informe de TryOut PWA, 1 AEKO/FAKOM de IP PAD, y 1 archivo duplicado (BOM Armrest Rear copiado en carpeta IP PAD).

Los archivos mas valiosos para completar TBDs en los documentos APQP actuales son:
- **BOMs** (4): definen materias primas, proveedores y cantidades por pieza
- **Imagenes de planos** (5): contienen tolerancias, normas aplicables y valores de control
- **FAKOM IP PAD** (1): define materiales finales para las 4 versiones del IP PAD
- **Normas VW** (22): parametros de ensayo y criterios de aceptacion para CPs

---

## 1. BOMs (Bill of Materials)

### 1.1 PATAGONIA_ARMREST REAR_BOM Barack_V3_20260311.pdf
| Campo | Valor |
|-------|-------|
| Ubicacion | VWA/MATERIALES/ARMREST REAR/ |
| Tipo | BOM |
| Tamano | 1.8 MB |
| Producto | Armrest Rear L3 - 2HC.885.081 RL1 (Titan Black) |
| Proyecto | VW427/1LA-K_PATAGONIA |

**Materiales clave extraidos:**

| Componente | Material | Especificacion | Proveedor |
|------------|----------|----------------|-----------|
| Cover PVC | PVC BM Expanded | 1.10 +/- 0.10 mm sobre PET Circular Knitted 100g/m2 + Ether-PUR 1.0+0.5 + Base 55g/m2 +/-10% | SANSUY BR |
| Nonwoven | Flat Needle Nonwoven | 70% PES + 30% PES-BICO, 6.7 dtex, 300 g/m2 | TBD |
| Hilo costura | Polyester 30/3 | Jet Black Pantone 19-0303 TPG | LINHANYL |
| Perfiles costura | PP | 2 perfiles | INPLACA |
| Espuma PU | POLYOL + ISOCYANATE | 0.424 kg/pieza | MAS-TIN |
| Hard Felt | PP Fiber | Espesor 2.5 mm | VALERIO |
| Felt (Hook tapes) | PP+PET | 2 unidades | APLIX |
| Carrier Assy | Steel (consignado VW) | 2HC.885.925 | VW |
| Cupholder | ABS (consignado VW) | 2HC.885.119 | VW |
| Frame Cupholder | ABS (consignado VW) | 2HC.885.725 | VW |
| Tornillo | Steel (consignado VW) | 2HC.075.701.GS | VW |

**Para que sirve:** Completar especificaciones de materia prima en CPs de Armrest Rear (recepcion de PVC, espuma, nonwoven). Definir pesos/cantidades para controles de proceso.

---

### 1.2 PATAGONIA_HEADREST SET_BOM Barack_V3_20260311.pdf
| Campo | Valor |
|-------|-------|
| Ubicacion | VWA/MATERIALES/HEADREST/ |
| Tipo | BOM |
| Tamano | 2.9 MB |
| Producto | Headrest Set completo: Front + Rear Center + Rear Outer, 4 niveles de color (12 variantes) |
| Proyecto | VW427/1LA-K_PATAGONIA |

**Part numbers cubiertos (12 variantes):**

| Tipo | RL1 (Titan Black) | GFV/EIF/GFU (Bicolor) | GEV/SIY/GEQ (Andino Gray) | EFG/SIY/DZS (Dark Slate) |
|------|-------------------|----------------------|---------------------------|--------------------------|
| Front | 2HC.881.901 RL1 | 2HC.881.901.A GFV | 2HC.881.901.B GEV | 2HC.881.901.C EFG |
| Rear Center | 2HC.885.900 RL1 | 2HC.885.900.A EIF | 2HC.885.900.B SIY | 2HC.885.900.C SIY |
| Rear Outer | 2HC.885.901 RL1 | 2HC.885.901.A GFU | 2HC.885.901.B GEQ | 2HC.885.901.C DZS |

**Materiales clave:**

| Componente | Material | Especificacion | Proveedor |
|------------|----------|----------------|-----------|
| PVC Titan Black | PVC Expanded "H" narbe BAH RL1 | 1.1 +/-10% sobre PET 100g/m2 + Ether-PUR 1.0+0.5 + Base 55g/m2 +/-10% | SANSUY BR |
| PVC Andino Gray | PVC ST Haptik "H" narbe | Misma estructura | SANSUY BR |
| PVC Dark Slate | PVC York code ML14 | Misma estructura | SANSUY BR |
| Fabric Rennes | Jacquard Woven, Aunde Code TPB-8VA | Fabric + Ether-PUR 1.5+0.5 + Base 50g/m2 +/-10% | AUNDE |
| Hilo costura 30/3 | Polyester | Jet Black Pantone 19-0303 TPG | LINHANYL |
| Hilo decorativo 20/3 | Polyester | Alpe Gray TGA IP3 o Gray Violet Pantone 14-4103 TPG | LINHANYL |
| TPU barrier tape | TPU (termoplastico) | TBD proveedor | TBD |
| Espuma PU | POLYOL + ISOCYANATE | Front 0.350 kg, Rear Center 0.102 kg, Rear Outer 0.146 kg | MAS-TIN |
| EPP Cores | Consignado VW | 2HC.881.915 | VW |
| Frames | Consignado VW | 2HC.881.937, 2HC.885.942, 2HC.885.941 | VW |

**Para que sirve:** Completar BOMs en CPs de Headrest (Front, Rear Center, Rear Outer). Definir consumos de PVC, espuma, hilo por variante. Confirmar proveedores.

---

### 1.3 PATAGONIA_ARMREST REAR_BOM (en carpeta IP PAD) -- DUPLICADO
| Campo | Valor |
|-------|-------|
| Ubicacion | VWA/MATERIALES/IP PAD/ |
| Tipo | BOM (DUPLICADO) |
| Tamano | 1.8 MB |
| Producto | Armrest Rear (NO es IP PAD) |

**ATENCION: Este archivo es una copia exacta del BOM de Armrest Rear (#1.1). Fue colocado por error en la carpeta IP PAD. No existe BOM de IP PAD en esta entrega.**

---

### 1.4 BOM DOOR PANEL - ONLY MATERIAL. Rev.09.pdf
| Campo | Valor |
|-------|-------|
| Ubicacion | VWA/MATERIALES/TAPIZADAS DE PUERTA VARIAS JUNTAS/ |
| Tipo | BOM (solo materiales) |
| Tamano | 380 KB |
| Producto | Door Panels completos: Top Rolls + Inserts + Armrests, 4 puertas x 4 niveles color |
| Proyecto | VW427/1LA-K_PATAGONIA |

**Sub-ensambles cubiertos:**

**A) Top Rolls (4 puertas):**

| Componente | Material | Especificacion | Proveedor |
|------------|----------|----------------|-----------|
| Sustrato inyectado | PC/ABS | CYCOLOY RESIN LG9000 low gloss, 0.267-0.268 kg | SABIC |
| TPO Bilaminate IMG-L | TPO 0.5mm + Foam 2mm | Densidad 66 kg/m3, 0.2526 m2 | HAARTZ |
| Adhesivo | SikaMelt-171 | IMG adhesive, 0.08 kg | SIKA |

**B) Inserts (Front + Rear, 4 colores):**

| Componente | Material | Especificacion | Proveedor |
|------------|----------|----------------|-----------|
| Sustrato inyectado | PC/ABS CYCOLOY LG9000 | 0.265 kg | SABIC |
| Esponja PU | PU Foam | 35 kg/m3 + 3mm | - |
| Cinta Tesa | Tesa 52110 | Transparente, 0.101 m2 | TESA |
| Adhesivo | SikaMelt-171 | 0.05 kg | SIKA |
| PVC L0 Titan Black | PVC 1mm+3mm PU "H" narbe | 0.179 m2 | SANSUY |
| PVC L1 Platinium Gray | PVC 1mm+3mm PU "H" narbe | 0.179 m2 | SANSUY |
| PVC L2 Andino Gray | PVC 1mm+3mm PU Haptik "H" narbe | 0.179 m2 | SANSUY |
| PVC L3 Dark Slate | PVC 1mm+3mm PU Haptik ML14 | 0.179 m2 | SANSUY |
| Hilo decorativo | Polyester 20/3 Nm | 0.000351 kg | LINHANYL |

**C) Armrests Door Panel (4 puertas):**

| Componente | Material | Especificacion | Proveedor |
|------------|----------|----------------|-----------|
| Sustrato inyectado | PC/ABS CYCOLOY LG9000 | 0.14 kg | SABIC |
| Espuma PU | PU 50 kg/m3 Iny. S-519 | 0.03 kg | MASTIN |
| PVC Texture PR022 | PVC 1mm + 3mm Foam 27 kg/m3 | 0.091 m2 | TBD |
| Adhesivo | SikaMelt-171 | 0.048 kg | SIKA |

**Para que sirve:** Completar CPs de Door Panels con materias primas, espesores de PVC, densidades de espuma, consumos de adhesivo. Importante: Door Panel Armrest usa PVC textura PR022 diferente al Insert.

---

## 2. Informe TryOut

### 2.1 Informe TryOut Ing. Telas 58D PWA.pdf
| Campo | Valor |
|-------|-------|
| Ubicacion | PWA/TRY OUT/ |
| Tipo | Informe de TryOut |
| Tamano | 296 KB |
| Producto | Telas 581D para PWA |
| Fecha | 25/03/2026 |
| Etapa | Prototipo |

**Resultado:** MEJORAR (NOT OK)
- Problema: lado liso vs. felpudo de la tela invertido en costura
- Accion correctiva: definir lado correcto segun plano/patron, actualizar tizadas, HOs y ayudas visuales

**Para que sirve:** Evidencia de falla de proceso en costura PWA. Debe reflejarse en AMFE de costura PWA (modo de falla: orientacion incorrecta de tela). Accion correctiva implica actualizar HOs y ayudas visuales.

---

## 3. AEKO/FAKOM

### 3.1 RZ00349 IP PAD FAKOM.pdf
| Campo | Valor |
|-------|-------|
| Ubicacion | VWA/REQUISITOS PLANO/IP PAD INFO GENERAL/ |
| Tipo | AEKO/FAKOM (orden de cambio de ingenieria VW) |
| Tamano | 726 KB |
| Producto | IP PAD - 4 versiones |
| Fecha | 25/11/2025 |

**Definicion de materiales FINAL por version:**

| Version | Part Number VW | Material DESPUES del cambio | Grano | Color | Costura |
|---------|---------------|---------------------------|-------|-------|---------|
| PL0 Workhorse | 2HC.858.417.D | **PP+EPDM-T20** (inyectado, NO PVC) | Xuarto Laser K4X | Carbon Black KU-C18 | - |
| PL1 Dual Screen | 2HC.858.417.B FAM | PVC 1.1mm + PU Foam 2mm | H Narbe | Platinum Gray BAH 55K (Sansuy) | Line 20/3 Nm Alpe Gray TGA IP3 |
| PL2 Triple Screen | 2HC.858.417.C GKK | PVC 1.1mm + PU Foam 2mm | H Narbe Haptik | Andino Grey BAH H55 (Sansuy) | Line 20/3 Nm Gray Violet TGA AT2 + Piping PVC 0.6mm |
| PL3 Triple Screen | 2HC.858.417.C GKN | PVC 1.1mm + PU Foam 2mm | ML14 Haptik | Dark Slate BJM 9L1 (Sansuy) | Line 20/3 Nm Gray Violet TGA AT2 + Piping PVC 0.6mm |

**Milestones:** PVS 25/26, 0S 37/26, VFF 14/26, SOP 49/26
**Planta:** 59 - Pacheco (VW Argentina)

**Para que sirve:** CRITICO para IP PAD. PL0 cambia completamente de PVC a PP+EPDM inyectado (proceso diferente). PL1/PL2/PL3 quedan con PVC pero con granos y colores definidos. Actualizar CPs y AMFEs de IP PAD con estos materiales finales.

---

## 4. Imagenes de planos (capturas)

### 4.1 DETALLES PLANO GENERALES.png (Armrest Rear)
| Campo | Valor |
|-------|-------|
| Ubicacion | VWA/REQUISITOS PLANO/ARMREST REAR/ |
| Tipo | Captura de plano |
| Tamano | 290 KB |
| Producto | Armrest Rear |

**Requisitos extraidos del plano:**

| Caracteristica | Valor/Norma |
|---------------|-------------|
| Resistencia a intemperie | VW 50185 |
| Consistencia de color | VW 50190 |
| Rebarba visible max | 0.1 mm |
| Flamabilidad | TL 1010 |
| Emisiones | VW 50180 |
| Solidez a la luz | PV 1303, 5 periodos, escala gris >= 4 (DIN EN 20105-A02) |
| Rango temperatura | -30 a +90 grados C |

**Para que sirve:** Completar columnas de "Especificacion" y "Metodo de evaluacion" en CPs de Armrest Rear. Valores concretos: rebarba max 0.1mm, gris >= 4 post 5 periodos UV.

---

### 4.2 Detalles zona espuma.png (Armrest Rear)
| Campo | Valor |
|-------|-------|
| Ubicacion | VWA/REQUISITOS PLANO/ARMREST REAR/ |
| Tipo | Captura de plano (zona espuma) |
| Tamano | 191 KB |
| Producto | Armrest Rear - zona de espuma PUR |

**Especificaciones de espuma extraidas:**

| Caracteristica | Valor | Norma |
|---------------|-------|-------|
| Material | PUR Weichschaumstoff | TL 52653-C |
| Dureza compresion | 7 +/- 1.0 kPa | DIN EN ISO 3386 |
| Densidad bruta | 60 +/- 10 kg/m3 | DIN EN ISO 845 |
| Deformacion remanente | 14% (estado recibido) | ISO 1856 |
| Ensayo de espuma | PV 3410 (edicion 2013) | VW PV 3410 |
| Sello inspector | X1 a EK 50N, EW 17.3 mm | Pkt. 4.3 |

**Para que sirve:** CRITICO. Estos son los valores exactos para controles de espuma en CP Armrest Rear: dureza 7+/-1 kPa, densidad 60+/-10 kg/m3, compression set 14%. Reemplazan TBDs en operaciones de espumado.

---

### 4.3 MATERIALES PLANO.png (Armrest Rear)
| Campo | Valor |
|-------|-------|
| Ubicacion | VWA/REQUISITOS PLANO/ARMREST REAR/ |
| Tipo | Captura de plano (tabla materiales) |
| Tamano | 145 KB |
| Producto | Armrest Rear |

**Materiales del plano (11 posiciones):**

| Pos | Componente | Material | Norma | Peso |
|-----|------------|----------|-------|------|
| 1 | Espuma (Schaum) | PUR-Weichschaumstoff | TL 52653-C | 405 g |
| 2 | ZSB Carrier | Steel | - | - |
| 3 | Frame cupholder | ABS | TL 527 Ausf. B | - |
| 4 | Cupholder | ABS | TL 527 Ausf. B | - |
| 5 | Hard Felt | PP Fiber | - | - |
| 6 | Felt (hooks) | PP+PET | - | - |
| 7 | Perfil costura 1 | PP | VW 44045-PP1 | 19.1 g |
| 8 | Perfil costura 2 | PP | VW 44045-PP1 | 6.1 g |
| 9 | Cover (Bezug) | PVC BW Expanded 1.10 +/- 0.10 mm | - | 264 g |
| 10 | Pull Loop (cinta) | Gewebeband | - | - |
| 11 | Tornillo | Steel | 2HC.075.701.68 | - |

**Brillo:** GE = 4.0 +/- 0.5, GU = 4.0 +/- 0.5 (desviando de VW 50190)

**Para que sirve:** Pesos oficiales del plano (espuma 405g, cover 264g) para controles de peso en CPs. Valores de brillo GE/GU para control de aspecto. Normas de material por componente.

---

### 4.4 Otros requisitos plano.png (Headrest)
| Campo | Valor |
|-------|-------|
| Ubicacion | VWA/REQUISITOS PLANO/HEADREST/ |
| Tipo | Captura de plano |
| Tamano | 221 KB |
| Producto | Headrest |

**Requisitos extraidos del plano:**

| Caracteristica | Valor/Norma |
|---------------|-------------|
| Rango temperatura | -30 a +90 grados C |
| Ciclo climatico | PV 2005, 50 ciclos, sin cambios en forma/color/optica/haptica |
| Resistencia intemperie | VW 50185 |
| Hilo costura | VW 50106 tipo M,D,L,Q |
| Emisiones | VW 50180 |
| Flamabilidad | TL 1010 |
| Consistencia color | VW 50190 |
| Solidez a la luz | PV 1303, 5 periodos, escala gris >= 4 |
| Tolerancia contorno exterior | +/- 1 mm |
| Inspeccion material | VW 50200, Seccion A |
| Directiva ELV | 2000/53/EG, articulo 4 |

**Para que sirve:** Completar CPs de Headrest con tolerancia de contorno (+/-1mm), requisito de ciclo climatico (50 ciclos PV 2005), tipo de hilo (VW 50106 M,D,L,Q), y normas de ensayo.

---

### 4.5 Vinilos.png (Headrest)
| Campo | Valor |
|-------|-------|
| Ubicacion | VWA/REQUISITOS PLANO/HEADREST/ |
| Tipo | Captura de plano (tabla covers/vinilos) |
| Tamano | 341 KB |
| Producto | Headrest (todas las variantes de cover) |

**Datos extraidos:**
- Mapa completo de part numbers 2HC.881.9XX con peso por variante (151-198 g)
- Colores Pantone: Jet Black 19-0303 TP, Storm Gray 14-4002 TP, Gray Violet 14-4102 TP
- PVC: 1.10 +/- 0.10 mm expandido sobre PET Circular Knitted 100 g/m2
- Backing: Ether-PUR 1.0+0.5 mm + Base circular knitted 55 g/m2 +/-10%
- Hilo: Polyester 315 dtex, Polyester costura 215 dtex

**Para que sirve:** Confirmar pesos por variante de cover para control de peso en CPs. Codigos Pantone exactos para control de color.

---

## 5. Normas VW (22 archivos)

### Normas de ensayo de materiales

| # | Archivo | Tamano | Norma | Tema | Productos que aplica | Datos clave para CPs |
|---|---------|--------|-------|------|---------------------|---------------------|
| 1 | PV_1303_ES.pdf | 324K | PV 1303 | Exposicion a luz (UV) | Todos los interiores | Temp. patron negro 100+/-3C, 60 W/m2, periodo = 14 MJ/m2 (~64h), evaluacion escala gris DIN EN 20105-A02 |
| 2 | PV_2005_ES.pdf | 298K | PV 2005 | Ciclo climatico | Piezas compuestas (headrest, armrest, door panel) | Ciclo 12h: -35C a +80C, con humedad. Evalua grietas, deformacion, delaminacion |
| 3 | PV_3410_EN.pdf | 891K | PV 3410 | Ensayo espuma PUR flexible | Espuma de asientos/headrest/armrest | Acondicionamiento 7 dias post-produccion. Ensayos: dureza, histéresis, compression set. Envejecimiento 200h a 90C/100% HR |

### Normas de requisitos de materiales

| # | Archivo | Tamano | Norma | Tema | Productos que aplica | Datos clave para CPs |
|---|---------|--------|-------|------|---------------------|---------------------|
| 4 | TL_52094_ES.pdf | 246K | TL 52094 | Revestimientos area de carga | Trunk mats, cubrerruedas (NO asientos) | Masa 850+/-50 g/m2, traccion 500N, abrasion PV 3908, flamabilidad TL 1010, emisiones VW 50180 |
| 5 | TL_52310_EN.pdf | 193K | TL 52310 | Microfibra para asientos | Headrest (Tipo C), armrest (Tipo C), asientos (Tipo B), door panels (Tipo D) | Abrasion Martindale: 25000-50000 ciclos segun tipo. Solidez luz: gris 3-4 post 3 periodos. Costura: 250-400 N/5cm |
| 6 | TL_52521_ES.pdf | 159K | TL 52521 | Aceite lubricante PFPE | Mecanismos plasticos (guias headrest, bisagras armrest) | 6 versiones A-F, viscosidades 28-400 mm2/s, rango -40 a +200C. Para reducir ruidos en contactos plastico/acero |
| 7 | VW_44045_ES.pdf | 117K | VW 44045 | Polipropileno PP piezas terminadas | Perfiles costura, sustratos, trim | Grados PP1-PP7+ con resistencias especificas. Incluye ensayos traccion, flexion, temp. deformacion, rayado |
| 8 | VW_50105_EN.pdf | 215K | VW 50105 | Materiales textiles para tapizados | Headrest, armrest, asientos, door panels | Tipo A (estandar) y B (reforzado). Abrasion, pilling, solidez luz/frotamiento/transpiracion, costura |
| 9 | VW_50106_ES.pdf | 180K | VW 50106 | Hilo de costura y bordado | Todos los productos cosidos | Grados B-Y. Grado D: PET Nm 20/3, fuerza >= 7700 cN. Grado E: hilo airbag PET Nm 80/3, 1800-2550 cN |
| 10 | VW_50132_ES.pdf | 182K | VW 50132 | Cuero sintetico espumado | Headrest, armrest, door panel, IP pad, asientos | Grados A-L con aplicaciones especificas. Ensayos: traccion, flexion, friccion, hidrolisis, suciedad, adherencia |
| 11 | VW_50180_ES.pdf | 240K | VW 50180 | Emisiones de piezas interiores | TODOS los interiores | VOC: <= 50 ug C/g (general), <= 20 (tela), <= 30 (cuero artificial). Fogging <= 2 mg. Olor <= 3.0-3.5. Formaldehido <= 3-5 mg/kg |
| 12 | VW_50190_ES.pdf | 800K | VW 50190 | Color y brillo | TODOS los interiores visibles | Medicion Delta-E CIELab con tolerancias por tipo de material. Metodo de evaluacion de brillo |

### Normas de documentacion/calidad

| # | Archivo | Tamano | Norma | Tema | Para que sirve |
|---|---------|--------|-------|------|---------------|
| 13 | TLD_812_046_V1_241129.pdf | 1.8M | TLD 812 046 | Caracteristicas D de asiento trasero | Define caracteristicas criticas de seguridad del asiento trasero. Ref: FMVSS 201/202a/207/208/214, ECE-R17/25/94/95 |
| 14 | VW_01054_ES.pdf | 4.0M | VW 01054 | Acotacion y tolerancias en planos | Estandar de dibujo: como leer tolerancias en planos VW |
| 15 | VW_01058_ES.pdf | 5.1M | VW 01058 | Cajetines de planos | Estandar de dibujo: formato de cajetines VW |
| 16 | VW_01155_ES.pdf | 168K | VW 01155 | Aprobacion primera entrega y modificaciones | Procedimiento PPF/PPAP. Requiere IMDS, hojas de seguridad, concepto reciclaje |
| 17 | VW_52000_EN.pdf | 1.4M | VW 52000 | Verificacion calidad de materiales | Marco para verificacion de materiales: muestreo, reportes estandar, documentacion |

### Normas de marcado e identificacion

| # | Archivo | Tamano | Norma | Tema | Para que sirve |
|---|---------|--------|-------|------|---------------|
| 18 | VW_10500_EN.pdf | 848K | VW 10500 | Designacion y marcado de piezas | Reglas de marcado: logos, pais origen, codigo fabricante, nro pieza, fecha, material VDA 260 |
| 19 | VW_10514_EN.pdf | 763K | VW 10514 | Logos en piezas | Aplicacion de logos VW Group en piezas |
| 20 | VW_10540_1_ES.pdf | 250K | VW 10540-1 | Codigo de fabricante | Codigo alfanumerico 3 caracteres, min 2mm, trazabilidad |
| 21 | VW_10550_ES.pdf | 204K | VW 10550 | Pais de manufactura | "Made in [pais]" en ingles, segun ISO 3166-1, grabado preferible en molde |
| 22 | VW_10560_ES.pdf | 442K | VW 10560 | Fecha de manufactura | Metodos: reloj calendario, grilla, semana/ano, codificado |

### Normas ambientales

| # | Archivo | Tamano | Norma | Tema | Para que sirve |
|---|---------|--------|-------|------|---------------|
| 23 | VW_91101_EN.pdf | 155K | VW 91101 | Conformidad material/quimica | Sustancias prohibidas, REACH/SVHC, datos IMDS/CDX/MISS |
| 24 | VW_91102_EN.pdf | 116K | VW 91102 | Reciclabilidad | Directiva ELV 2000/53/EC, tasas reciclaje, marcado materiales, diseño para desarme |

---

## 6. Tabla resumen de utilidad APQP

### Que datos concretos pueden completar TBDs en CPs actuales

| Dato extraido | Fuente | Producto afectado | Uso en CP |
|--------------|--------|-------------------|-----------|
| PVC espesor 1.10 +/- 0.10 mm | BOMs + Planos | Headrest, Armrest Rear, Door Panel Insert | Recepcion materia prima: control de espesor |
| Ether-PUR backing 1.0 +0.5 mm | BOMs + Planos | Headrest, Armrest Rear | Recepcion materia prima: espesor backing |
| Base circular knitted 55 g/m2 +/-10% | BOMs + Planos | Headrest, Armrest Rear | Recepcion materia prima: gramaje base |
| PET circular knitted 100 g/m2 | BOMs + Planos | Headrest, Armrest Rear | Recepcion materia prima: gramaje soporte |
| Dureza espuma 7 +/- 1.0 kPa | Plano Armrest Rear espuma | Armrest Rear | Control espumado: dureza compresion |
| Densidad espuma 60 +/- 10 kg/m3 | Plano Armrest Rear espuma | Armrest Rear | Control espumado: densidad |
| Compression set espuma 14% | Plano Armrest Rear espuma | Armrest Rear | Control espumado: deformacion remanente |
| Peso espuma 405 g | Plano Armrest Rear materiales | Armrest Rear | Control espumado: peso pieza |
| Peso cover 264 g | Plano Armrest Rear materiales | Armrest Rear | Control costura: peso cover terminado |
| Consumo PU Foam Front HR 0.350 kg | BOM Headrest | Headrest Front | Control espumado: peso/consumo |
| Consumo PU Foam Rear Center 0.102 kg | BOM Headrest | Headrest Rear Center | Control espumado: peso/consumo |
| Consumo PU Foam Rear Outer 0.146 kg | BOM Headrest | Headrest Rear Outer | Control espumado: peso/consumo |
| Consumo PU Foam Armrest 0.424 kg | BOM Armrest | Armrest Rear | Control espumado: peso/consumo |
| Rebarba max 0.1 mm | Plano Armrest Rear | Armrest Rear | Control visual/dimensional |
| Contorno exterior +/- 1 mm | Plano Headrest | Headrest | Control dimensional |
| Brillo GE = GU = 4.0 +/- 0.5 | Plano Armrest Rear | Armrest Rear | Control aspecto: brillometro |
| Solidez luz gris >= 4 post 5 periodos | Planos ambos | Headrest, Armrest Rear | Validacion material: ensayo PV 1303 |
| Ciclo climatico 50 ciclos PV 2005 | Plano Headrest | Headrest | Validacion producto: ciclo termico |
| Hilo VW 50106 tipo M,D,L,Q | Plano Headrest | Headrest | Recepcion hilo: tipo y norma |
| Temperatura operacion -30 a +90 C | Planos ambos | Headrest, Armrest Rear | Validacion producto: rango operativo |
| VOC <= 30 ug C/g (cuero artificial) | VW 50180 | Headrest, Armrest, Door Panel, IP PAD | Validacion material: emisiones |
| Fogging <= 2 mg | VW 50180 | Todos los interiores | Validacion material: fogging |
| Formaldehido <= 3 mg/kg (cuero art.) | VW 50180 | Headrest, Armrest, Door Panel, IP PAD | Validacion material: formaldehido |
| Olor <= 3.5 | VW 50180 | Todos los interiores | Validacion material: olor |
| IP PAD PL0 = PP+EPDM-T20 (NO PVC) | FAKOM IP PAD | IP PAD Workhorse | CRITICO: cambio de proceso, no es PVC |
| IP PAD PL1 = PVC H Narbe Platinum Gray | FAKOM IP PAD | IP PAD Dual Screen | Material/color definitivo |
| IP PAD PL2 = PVC Haptik Andino Grey + Piping | FAKOM IP PAD | IP PAD Triple Screen GKK | Material/color + piping definitivo |
| IP PAD PL3 = PVC Haptik Dark Slate + Piping | FAKOM IP PAD | IP PAD Triple Screen GKN | Material/color + piping definitivo |
| Door Panel sustrato PC/ABS CYCOLOY LG9000 | BOM Door Panel | Door Panel (Top Roll, Insert, Armrest) | Recepcion materia prima: tipo plastico |
| Door Panel adhesivo SikaMelt-171 | BOM Door Panel | Door Panel | Control IMG: adhesivo |
| Top Roll TPO 0.5mm + Foam 2mm, 66 kg/m3 | BOM Door Panel | Door Panel Top Roll | Recepcion materia prima: TPO bilaminate |
| Nonwoven 300 g/m2, 6.7 dtex | BOM Armrest Rear | Armrest Rear | Recepcion materia prima: gramaje nonwoven |
| Fabric Rennes Jacquard Woven TPB-8VA | BOM Headrest | Headrest bicolor | Recepcion materia prima: tela decorativa |
| Tela 581D orientacion invertida | TryOut PWA | PWA Telas | AMFE costura: modo de falla orientacion tela |

---

## 7. Matriz norma VW vs producto

| Norma | Headrest | Armrest Rear | Door Panel | IP PAD | Espuma | Tela/PVC | Marcado |
|-------|----------|-------------|------------|--------|--------|----------|---------|
| PV 1303 (luz UV) | Si | Si | Si | Si | - | Si | - |
| PV 2005 (ciclo climatico) | Si | Si | Si | Si | - | - | - |
| PV 3410 (espuma PUR) | Si | Si | - | - | Si | - | - |
| TL 52310 (microfibra) | Si (C) | Si (C) | Si (D) | Si (F) | - | Si | - |
| TL 52521 (lubricante PFPE) | Si (guias) | Si (bisagra) | - | - | - | - | - |
| VW 44045 (PP) | - | Si (perfiles) | - | Si (PL0) | - | - | - |
| VW 50105 (textiles) | Si | Si | Si | - | - | Si | - |
| VW 50106 (hilo costura) | Si | Si | Si | Si | - | - | - |
| VW 50132 (cuero sintetico) | Si | Si | Si | Si | - | Si | - |
| VW 50180 (emisiones) | Si | Si | Si | Si | Si | Si | - |
| VW 50190 (color/brillo) | Si | Si | Si | Si | - | Si | - |
| VW 10500 (marcado general) | Si | Si | Si | Si | - | - | Si |
| VW 10540-1 (cod fabricante) | Si | Si | Si | Si | - | - | Si |
| VW 10550 (pais origen) | Si | Si | Si | Si | - | - | Si |
| VW 10560 (fecha) | Si | Si | Si | Si | - | - | Si |
| VW 91101 (ambiental quimico) | Si | Si | Si | Si | Si | Si | - |
| VW 91102 (reciclaje) | Si | Si | Si | Si | Si | Si | - |
| VW 01155 (aprobacion PPF) | Si | Si | Si | Si | - | - | - |
| VW 52000 (verif. materiales) | Si | Si | Si | Si | Si | Si | - |
| TLD 812 046 (caract. D) | - | - | - | - | - | - | Asiento trasero |
| TL 52094 (cargo area) | - | - | - | - | - | - | Solo trunk |
| VW 01054 (acotacion) | Referencia planos | | | | | | |
| VW 01058 (cajetines) | Referencia planos | | | | | | |
| VW 10514 (logos) | Todas las piezas | | | | | | |
