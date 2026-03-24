# Auditoria Completa de Hojas de Operaciones

> **Fecha**: 2026-03-23
> **Alcance**: 17 documentos HO, 171 hojas, 1,091 pasos TWI
> **Metodo**: Analisis cruzado Supabase + archivos originales PDF + verificacion visual del export PDF

---

## 1. Estado Actual de las HOs

### Resumen General

| Metrica | Valor |
|---|---|
| Documentos HO | 17 |
| Hojas totales | 171 |
| Pasos TWI totales | 1,091 |
| Pasos con descripcion propia (no stub) | **1,091 (100%)** |
| Pasos que son stubs "Realizar X" | **0 (0%)** |
| Ayudas visuales cargadas | **0 (0%)** |
| Hojas con quality checks | 131 de 171 |
| Quality checks totales | ~700 |

### Estado por Producto

| Producto | Hojas | Pasos | QCs | Visual Aids | Estado |
|---|---|---|---|---|---|
| Insert Patagonia | 22 | 97 | 160 | 0 | Completo (pasos + QCs) |
| Armrest Door Panel | 22 | 99 | 174 | 0 | Completo (pasos + QCs) |
| Top Roll | 11 | 43 | 0 | 0 | Pasos OK, falta CP vinculado |
| Headrest Front (master) | 8 | 65 | 59 | 0 | Completo (pasos + QCs) |
| Headrest Front [L1] | 8 | 60 | 21 | 0 | Variante heredada |
| Headrest Front [L2] | 8 | 60 | 21 | 0 | Variante heredada |
| Headrest Front [L3] | 8 | 60 | 21 | 0 | Variante heredada |
| Headrest Rear Center (master) | 8 | 64 | 57 | 0 | Completo (pasos + QCs) |
| Headrest Rear Center [L1-L3] | 24 | 180 | 63 | 0 | Variantes heredadas |
| Headrest Rear Outer (master) | 8 | 64 | 59 | 0 | Completo (pasos + QCs) |
| Headrest Rear Outer [L1-L3] | 24 | 180 | 63 | 0 | Variantes heredadas |
| Telas Planas PWA | 12 | 47 | 0 | 0 | Pasos OK, falta CP vinculado |
| Telas Termoformadas PWA | 8 | 32 | 0 | 0 | Pasos OK, falta CP vinculado |

---

## 2. Descripciones: Propias vs Copiadas del AMFE

### Hallazgo Principal

**Las descripciones de pasos NO estan copiadas del AMFE.**

Las HOs tienen instrucciones propias redactadas como instruccion al operador. Los datos del AMFE son categorias 4M (Maquina, Mano de Obra, Metodo, Medio Ambiente), mientras que los pasos de la HO son acciones fisicas del operador.

**Comparacion directa (Insert Op 10 - Recepcion):**

| AMFE (work elements) | HO (steps) |
|---|---|
| "Autoelevador" | "Verificar la documentacion del proveedor: remito, certificado de calidad" |
| "Operador de produccion / Operador de calidad" | "Inspeccionar visualmente el estado del embalaje" |
| "Calibres de diferentes tamanos / Micrometro" | "Controlar la identificacion de cada material recibido" |
| "Hoja de operaciones / Ayudas Visuales" | "Almacenar los materiales aprobados en el sector designado" |

**Conclusion: Los pasos de la HO son correctos y propios.**

### Niveles de detalle por producto

| Tier | Productos | Descripcion |
|---|---|---|
| **Tier 1** | Insert Patagonia | 5 hojas del PDF real + 17 enriquecidas via script. 116 pasos, 50 QCs. El mas completo. |
| **Tier 2** | Armrest, Top Roll, Telas Planas, Telas Termoformadas | 3-5 pasos por hoja (seed scripts). Moderadamente detallado. |
| **Tier 3** | 12 Headrest variantes | 2 hojas MUY detalladas (Op 20: 14 pasos SET UP, Op 30: 21 pasos SET UP), 6 hojas con 3-5 pasos generados. |

---

## 3. Discrepancias HO vs CP

### Discrepancia critica: HO QCs vs CP items (Insert Patagonia)

Los quality checks del Insert fueron escritos **independientemente** del CP, no via el generador `cpItemToQualityCheck()`. Son mas especificos que los CP items:

| Campo | CP (generico) | HO (especifico) |
|---|---|---|
| characteristic | "Color del vinilo" | "Identificacion de Hilo Needle thread (Linanhyl) - Verificar color segun variante" |
| specification | "Conforme a muestra" | Referencia a set-up y parametros especificos |
| frequency | "Cada lote" | "Inicio de turno", "Cada 2 horas" |
| cpItemId | N/A | **Vacio en la mayoria** — sin link de trazabilidad |

**Accion requerida sesion 2**: Alinear los QCs de la HO con los items del CP, o actualizar el CP para que sea igual de especifico.

### Productos SIN quality checks

| Producto | QCs | Causa |
|---|---|---|
| Top Roll | 0 | No tiene CP vinculado |
| Telas Planas PWA | 0 | No tiene CP vinculado |
| Telas Termoformadas PWA | 0 | No tiene CP vinculado |
| Armrest Door Panel | 174 (OK) | CP vinculado |

**Accion requerida**: Vincular los CPs existentes a Top Roll y ambas Telas.

---

## 4. Imagenes / Ayudas Visuales

### Estado actual: 0 imagenes cargadas

Ninguno de los 17 documentos HO tiene ayudas visuales cargadas en la app.

### Imagenes disponibles en archivos originales

Solo **6 imagenes** existen en total, todas del Insert Patagonia (~2.6 MB):

| Subcarpeta | Operacion | Archivo | Contenido |
|---|---|---|---|
| OP30 | Inyeccion | Imagen1.png (571 KB) | Foto de maquina inyectora (prensa) |
| OP30 | Inyeccion | Imagen2.png (716 KB) | Foto de insertos terminados colgados en rack |
| 40 | Inspeccion | Imagen3.png (1.15 MB) | Foto tecnica de pieza con lineas dimensionales |
| 50 | (vacio) | — | Subcarpeta existe pero esta vacia |
| 60 | Embalaje | 1.png (41 KB) | Diagrama de caja: 496x634x170mm, 8 piezas/caja |
| 60 | Embalaje | 2.png (25 KB) | Layout de pallet: 3 cajas/nivel = 24 piezas, hasta 72/pallet |
| 60 | Embalaje | 3.png (92 KB) | Dibujo tecnico: vista superior de pieza en caja |

Ningun otro producto tiene imagenes disponibles (Armrest, Top Roll, Headrests, Telas — sin carpeta de imagenes).

### Almacenamiento de imagenes

- Las imagenes se guardan como **base64 en el JSON** del documento (campo `visualAids`)
- La app comprime automaticamente: max 1024px, JPEG quality 0.7, limite 2 MB por imagen
- **Supabase Storage NO esta configurado** — todo es inline base64
- Para cargar: usar el boton "Agregar imagen" en cada hoja de la app

**Pendiente para sesion 2**: Cargar las 6 imagenes del Insert en las hojas correspondientes (OP30→Inyeccion, 40→Inspeccion, 60→Embalaje).

---

## 5. Problemas del PDF Corregidos

### Bugs encontrados y corregidos en esta sesion

| Seccion | Problema | Fix aplicado |
|---|---|---|
| PIEZAS APLICABLES | 16 part numbers en vertical (`<br/>` separators) | Flex-wrap horizontal con separadores " · " |
| AYUDAS VISUALES titulo | Descentrado (left-aligned en columna 40%) | `text-align:center` via parametro `center` |
| ELEMENTOS DE SEGURIDAD | PPE icons en vertical (img sin flex container) | `display:flex; flex-wrap:wrap` en contenedor |
| CICLO DE CONTROL | Tabla horizontal OK | No requirio cambio |

**Archivo modificado**: `modules/hojaOperaciones/hojaOperacionesPdfExport.ts`
**Cambios**: Solo CSS/layout, sin logica modificada.

---

## 6. Navegacion PFD → HO

### Estado actual

No existe navegacion directa desde el PFD (Diagrama de Flujo) hasta la HO.

El flujo actual es:
1. Usuario entra al proyecto desde la landing page
2. Se abre el AMFE con tabs: Diagrama de Flujo | AMFE VDA | Plan de Control | **Hojas de Operaciones**
3. El usuario debe hacer click en el tab "Hojas de Operaciones" manualmente

### Consistencia de datos

- El PFD y la HO comparten `operationNumber` del AMFE
- La vinculacion es indirecta: PFD → AMFE → CP → HO
- Al hacer click en el tab "Hojas de Operaciones", se carga el documento completo con todas las hojas

### Recomendacion

Actualmente funciona como tabs dentro del proyecto AMFE. No se requiere implementar navegacion directa PFD→HO ya que los tabs proveen acceso rapido.

---

## 7. Hojas de Mesa de Corte Agrupables

### Operaciones de corte en el Insert

El Insert tiene 4 operaciones de corte separadas:
- Op 15: Preparacion de corte
- Op 20: Cortar componentes
- Op 25: Control con mylar
- Op 30: Almacenamiento WIP

Estas 4 operaciones se hacen en la misma mesa/area y por el mismo operador. **Se podrian agrupar en 2 hojas** (Corte + Control) en vez de 4.

### Recomendacion

No agrupar en la app (las operaciones vienen del AMFE y deben mantenerse 1:1). La agrupacion se puede hacer en la documentacion impresa si el supervisor lo prefiere.

---

## 8. Info de HO Originales util para otros documentos

### SET UP Documents (20 archivos)

Los archivos originales incluyen 20 documentos de SET UP (puesta a punto) organizados por proceso:
- Inyeccion, Adhesivado, Costura, Tapizado, Mesa de corte, Termoconformado, Armado, Troquelado

Estos contienen parametros de maquina que podrian ser utiles para:
- **AMFE**: Work elements de tipo "Maquina" (parametros de set-up como control de prevencion)
- **CP**: Especificaciones de proceso (temperaturas, presiones, tiempos)

### Planes de Control originales (12 archivos PDF)

Los PCs originales en papel pueden servir para verificar que los CPs en Supabase tienen los mismos controles.

---

## 9. Hallazgos de los PDFs Originales

### 4 PDFs analizados

| PDF | Paginas | Operaciones | Imagenes | Estado |
|---|---|---|---|---|
| HO - INSERT PATAGONIA.pdf | 13 | 13 ops (10, 20-27, 30, 40, 50, 60) | ~95 fotos | Completo (Rev.1) |
| APB PATAGONIA.pdf | 14 | 14 ops (10, 20-27, 30-32, 40, 50) | ~120 fotos | Completo (Rev.1) |
| TOP ROLL.pdf | 13 | 13 ops (10, 20-27, 30, 40, 50, 60) | ~95 fotos | Completo (Rev.1) |
| COSTURA APC DELANTERO.pdf | 4 | 4 ops (10-40, solo costura) | ~25 diagramas | Borrador (sin rev/fecha/firma) |

### Mesa de corte compartida (Ops 20-27)

Las operaciones 20-27 (mesa de corte) son **texto identico** en Insert, APB y Top Roll. Solo cambia el nombre del sector. Esto confirma que la mesa de corte es proceso compartido y podria tratarse como bloque comun.

### Inconsistencia verbal en originales

Los PDFs mezclan infinitivo formal ("Verificar", "Controlar") con voseo rioplatense ("Presiona", "Dirigite", "Move"). Para la app se estandarizo en infinitivo instruccional.

### Info exclusiva de los PDFs (no esta en AMFE ni CP)

- Fotos referenciadas y numeradas en el texto ("ver imagen N5")
- Especificaciones de embalaje (dimensiones de caja, piezas por caja, pisos por pallet)
- Parametros de maquina (velocidad, tension, tiempos de ciclo)
- Secuencia de componentes de costura (piezas 101-106)

---

## 10. Plan de Correccion Priorizado (Sesion 2)

### Prioridad Alta

1. **Vincular CPs faltantes**: Top Roll, Telas Planas, Telas Termoformadas — tienen HOs sin quality checks porque el CP no esta vinculado
2. **Cargar imagenes del Insert**: Las fotos de las subcarpetas OP30/40/50/60 deben cargarse en las hojas correspondientes

### Prioridad Media

3. **Revisar pasos de los headrests variantes**: Los [L1/L2/L3] heredan los mismos pasos que el master — verificar si alguna variante tiene pasos que deberian ser diferentes
4. **Verificar consistencia de EPP**: Operaciones de inyeccion deben tener todos los EPP (incluyendo respirador y delantal)
5. **Revisar operaciones de corte duplicadas**: Op 15 y Op 20 del Insert tienen pasos casi identicos — considerar diferenciar

### Prioridad Baja

6. **Agregar imagenes a otros productos**: Armrest, Top Roll, Headrests (si hay fotos disponibles)
7. **Completar campos vacios**: Algunos campos de metadata estan vacios (Sector, N Puesto)
8. **Agregar campo "Registro"** en quality checks: La columna existe pero esta vacia en la mayoria

---

## Resumen Ejecutivo

| Area | Estado | Nota |
|---|---|---|
| Pasos de operador | OK | 1,091 pasos con descripcion propia |
| Coincidencia HO-CP | Parcial | 3 productos sin CP vinculado |
| Ayudas visuales | Pendiente | 0 imagenes cargadas, fotos disponibles |
| PDF export | Corregido | 3 bugs de layout fijados |
| Navegacion PFD→HO | Funcional | Via tabs en el proyecto AMFE |
| EPP | Revisar | Posibles EPP faltantes en inyeccion |
