# Prompt: Implementación del Módulo PFD (Diagrama de Flujo del Proceso)

## Contexto General

Estás trabajando en **Barack Mercosul**, una aplicación de escritorio para gestión de calidad automotriz enfocada en herramientas APQP/Core Tools. La empresa Barack Mercosul (Barack Argentina S.R.L.) está ubicada en Los Árboles 842, Hurlingham, Buenos Aires, Argentina. Es un proveedor automotriz (Tier 1/2) que fabrica autopartes: piezas troqueladas, adhesivos, tejidos/cueros, ensambles de apoyacabezas, consolas y apoyabrazos. Opera en los sectores automotriz, consumo y oil & gas. Tiene operaciones en Argentina e Indaiatuba (Brasil). Está certificada bajo IATF 16949:2016, ISO 9001:2015 e ISO 14001:2015.

La app ya tiene 3 módulos funcionando:
1. **Tiempos y Balanceos** — Cronometraje industrial y balanceo de líneas
2. **AMFE VDA** — Análisis de Modo de Falla y Efectos según AIAG-VDA 1ª Edición (2019)
3. **Plan de Control** — Plan de Control AIAG (APQP) con validación cruzada contra AMFE

Falta el módulo más importante del "Hilo Digital" (Golden Thread) APQP: el **Diagrama de Flujo del Proceso (PFD)**. Según NotebookLM con 137 fuentes AIAG-VDA, el PFD es "la columna vertebral que alimenta automáticamente a los demás módulos. Dicta el número de operación y el nombre de la estación. Esta misma estructura es el Paso 2: Análisis de Estructura del AMFE AIAG-VDA y establece el orden lógico en el Plan de Control."

**Cascada APQP obligatoria:** PFD → AMFE → Plan de Control → HO → Tiempos

---

## Stack Tecnológico

| Tecnología | Versión | Uso |
|---|---|---|
| **Tauri** | v2 | Shell de escritorio (Rust backend) |
| **React** | 19 | UI framework |
| **TypeScript** | strict | Tipado |
| **TailwindCSS** | 3.x | Estilos utilitarios |
| **Vite** | 6.x | Bundler + HMR |
| **SQLite** | via tauri-plugin-sql v2 | Persistencia |
| **Vitest** | 4.x | Testing (jsdom, @testing-library/react) |
| **Lucide React** | latest | Íconos |

**Directorio raíz:** `C:\Users\FacundoS-PC\Documents\Software Barack Mercosul\Tiempos y Balanceos\`

---

## Decisión de Diseño: Formato TABULAR (no canvas visual)

**CRÍTICO:** NotebookLM con 137 fuentes AIAG confirmó lo siguiente:

> "No existe una plantilla estándar obligatoria ni un formato rígido para el PFD. Es un formato de diseño libre, siempre y cuando cumpla con el objetivo fundamental: representar esquemáticamente el flujo para analizar las fuentes de variación."

> "El formato tabular (horizontal) es el estándar de facto. Permite listar el proceso secuencialmente hacia abajo (filas) y usar las columnas horizontales para detallar la descripción, los símbolos, las 4M y las características de control."

> "Alcanza perfectamente con un formato de lista/tabla estructurada donde cada fila es una operación y el símbolo gráfico aparece en una columna al costado. Los manuales de las Core Tools de la AIAG no exigen que el PFD sea un dibujo de red complejo."

> "Para el desarrollo de software automotriz y el uso diario de los ingenieros, el enfoque tabular (lista de operaciones) es infinitamente más práctico, seguro y eficiente que un lienzo de dibujo libre."

> "En las plantas de Argentina, es común tener un layout gráfico en la pared para producción, pero el PFD oficial que firma el cliente y aprueba Calidad es la tabla matricial de Excel o del software."

**Decisión:** El módulo PFD será una **tabla interactiva** (como AMFE y Plan de Control), NO un canvas con drag & drop. Cada fila = una operación/paso del proceso. Los símbolos se muestran como íconos en una columna.

---

## Símbolos Estándar AIAG/ASME para el PFD

Según NotebookLM (fuentes AIAG + ASME + APQP):

| Símbolo | Nombre | Forma Gráfica | Significado |
|---|---|---|---|
| **Operación** | Operation | Círculo (○) o Rectángulo | Paso de fabricación que agrega valor. Cambia características físicas o químicas del material. |
| **Transporte** | Transport | Flecha (→) | Movimiento físico del producto o componentes de una estación a otra. |
| **Inspección** | Inspection / Test | Cuadrado (□) | Paso exclusivo de revisión, control o evaluación de calidad. Verificar que cumple especificaciones. |
| **Almacenamiento** | Storage | Triángulo invertido (▽) | Material guardado en ubicación segura, esperando ser utilizado o enviado. |
| **Demora / Espera** | Delay / Wait | Letra "D" mayúscula | Espera diseñada o retraso temporal donde el material no puede avanzar. |
| **Decisión** | Decision Gate | Rombo (◇) | Punto de decisión (ej. "¿Pieza conforme? Sí/No"). Salen múltiples rutas. |
| **Combinado** | Inspection + Operation | Cuadrado con Círculo interior (□○) | Fabricación que agrega valor CON inspección simultánea (ej. ensamble + medición de torque). |

### Implementación Visual de Símbolos

Cada símbolo debe ser un **componente SVG React** reutilizable con:
- Tamaño estándar: 24x24px (en tabla), 32x32px (en PDF)
- Colores:
  - Operación: `fill-blue-500` (azul corporativo Barack)
  - Transporte: `fill-slate-400` (gris)
  - Inspección: `fill-emerald-500` (verde)
  - Almacenamiento: `fill-amber-500` (amarillo)
  - Demora: `fill-red-400` (rojo suave)
  - Decisión: `fill-purple-500` (púrpura)
  - Combinado: `fill-blue-500` con borde `stroke-emerald-500`
- Tooltip con nombre del tipo de paso

**Archivo sugerido:** `modules/pfd/PfdSymbols.tsx`

---

## Columnas / Datos del PFD

Según NotebookLM, cada fila del PFD debe contener:

### Columnas Obligatorias

| # | Campo | Descripción | Ancho sugerido |
|---|---|---|---|
| 1 | **Nº Operación** | Identificador secuencial alfanumérico (ej. OP 10, OP 20, OP 30). DEBE coincidir exactamente en AMFE y Plan de Control. | 80px |
| 2 | **Símbolo** | Ícono gráfico ASME/AIAG del tipo de paso (ver tabla de símbolos). | 50px |
| 3 | **Descripción de la Operación** | Resumen descriptivo de la etapa (ej. "Inyección de cubierta", "Inspección visual de ensamble", "Transporte a almacén"). | 250px |
| 4 | **Máquina / Dispositivo / Herramienta** | Recursos físicos involucrados (máquinas, herramientas, fixtures). Alimenta el Paso 2 del AMFE AIAG-VDA (Elementos de Trabajo 4M). | 200px |

### Columnas Recomendadas (mejores prácticas)

| # | Campo | Descripción | Ancho sugerido |
|---|---|---|---|
| 5 | **Características del Producto** | Resultado deseado del paso: dimensiones, tolerancias, resistencia. Del plano de ingeniería. | 200px |
| 6 | **Clasificación CC/SC** | Característica Crítica (CC) o Significativa (SC) del producto en este paso. Marcador visual. | 70px |
| 7 | **Características del Proceso** | Variables de entrada: temperatura, presión, tiempo, velocidad. Relación causa-efecto con las del producto. | 200px |
| 8 | **Clasificación CC/SC Proceso** | CC/SC del parámetro de proceso. | 70px |
| 9 | **Referencia** | Números de planos, esquemas u otros documentos técnicos aplicables. | 120px |

### Columnas Opcionales (valor agregado para el software)

| # | Campo | Descripción |
|---|---|---|
| 10 | **Departamento / Área** | Área responsable (Producción, Calidad, Logística) |
| 11 | **Notas / Observaciones** | Texto libre para aclaraciones |
| 12 | **Retrabajo** | Booleano: ¿Esta operación es un bucle de retrabajo? |
| 13 | **Proceso Externo** | Booleano: ¿Se realiza fuera de planta? (ej. galvanizado, pintura tercerizada) |

---

## Metadata / Header del PFD

Según NotebookLM, el PFD comparte obligatoriamente el mismo encabezado que el AMFE y el Plan de Control. Campos requeridos:

### 1. Identificación del Producto
- **Número de Pieza** (Part Number)
- **Nivel de Cambio de Ingeniería / Revisión** (nivel más reciente del plano)
- **Nombre / Descripción de la Pieza**
- **Año del Modelo / Plataforma** (aplicación del cliente, familia del vehículo)

### 2. Control del Documento
- **Número de Documento** (código interno del PFD, ej. "PFD-001")
- **Nivel de Revisión del PFD** (ej. Rev. A, Rev. B)
- **Fecha de Revisión**

### 3. Organización y Responsabilidades
- **Compañía y Planta** (Barack Mercosul, Hurlingham)
- **Código de Proveedor** (DUNS, código IATF del cliente)
- **Nombre del Cliente**
- **Equipo Multifuncional** (Ingeniería, Calidad, Producción)
- **Contacto Clave / Responsable del Proceso**

### 4. Aprobaciones
- **Elaboró** (nombre + fecha)
- **Aprobó** (nombre + fecha)

**REGLA DE NEGOCIO:** Estos campos deben actuar como variables "padre". Si un cambio de ingeniería altera el nivel de revisión, el software debería poder actualizar esta metadata simultáneamente en PFD, AMFE y Plan de Control para evitar discrepancias documentales.

---

## Vinculación con AMFE y Plan de Control

### La Cascada del Hilo Digital

```
PFD (define pasos y orden)
  ↓ Nº Operación + Descripción + 4M
AMFE (analiza qué puede fallar)
  ↓ Causas + Controles Preventivos/Detección
Plan de Control (define qué inspeccionar)
  ↓ Métodos + Frecuencia + Reacción
HO (instrucciones al operario)
```

### Datos que se transfieren PFD → AMFE

| Campo PFD | → Campo AMFE | Nota |
|---|---|---|
| Nº Operación (ej. OP 30) | Paso 2: Análisis de Estructura → Operation | Copia exacta 1:1 |
| Descripción de la Operación | Nombre del proceso | Copia exacta |
| Máquina/Dispositivo/Herramienta | Elementos de Trabajo (4M) | Puede expandirse en AMFE |
| Características del Producto | Paso 3: Function → Requirements | Alimenta funciones |
| CC/SC del Producto | Severity en AMFE (CC → S≥9, SC → S≥7) | Derivación automática |

### Datos que se transfieren PFD → Plan de Control

| Campo PFD | → Campo CP | Nota |
|---|---|---|
| Nº Operación | Process Step Number | Copia exacta 1:1 |
| Descripción de la Operación | Process Description | Copia exacta |
| Máquina/Dispositivo/Herramienta | Machine, Device, Tool | Copia directa |
| Características del Producto + CC/SC | Product Characteristics + Special Char | Copia + clasificación |
| Características del Proceso + CC/SC | Process Characteristics + Special Char | Copia + clasificación |

### Implementación de la Vinculación

La vinculación se implementa mediante **IDs compartidos**:
- Cada paso del PFD tiene un `id: string` (UUID)
- Cuando se genera un AMFE desde el PFD, cada operación del PFD crea una Operation en el AMFE con `pfdStepId: string` como referencia
- Cuando se genera un Plan de Control desde el PFD (o desde el AMFE), cada ítem del CP tiene `pfdStepId: string`
- Si el usuario cambia el nombre o número de operación en el PFD, se puede propagar a los documentos vinculados

---

## Estructura de Archivos a Crear

```
modules/pfd/
  ├── pfdTypes.ts              # Interfaces: PfdHeader, PfdStep, PfdDocument, PfdStepType, PfdColumnDef
  ├── PfdApp.tsx               # Componente raíz del módulo (lazy-loaded)
  ├── PfdToolbar.tsx           # Barra de herramientas (nuevo, abrir, guardar, exportar, etc.)
  ├── PfdHeader.tsx            # Editor de metadata/header del documento
  ├── PfdTable.tsx             # Tabla principal interactiva (filas = pasos)
  ├── PfdTableRow.tsx          # Fila individual editable
  ├── PfdSymbols.tsx           # Componentes SVG de los 7 símbolos ASME
  ├── PfdSymbolPicker.tsx      # Selector/dropdown de símbolo para una fila
  ├── pfdPdfExport.ts          # Exportación a PDF (html → print)
  ├── pfdExcelExport.ts        # Exportación a Excel (xlsx-js-style)
  ├── pfdValidation.ts         # Validaciones (nº duplicados, campos vacíos, CC/SC sin especificar)
  ├── usePfdPersistence.ts     # Hook de persistencia (load, save, draft, autosave)
  └── usePfdDocument.ts        # Hook principal de estado del documento (reducer o useState)

utils/repositories/
  └── pfdRepository.ts         # CRUD SQLite para documentos PFD

__tests__/
  └── modules/pfd/
      ├── pfdTypes.test.ts
      ├── PfdApp.test.tsx
      ├── PfdTable.test.tsx
      ├── PfdSymbols.test.tsx
      ├── pfdPdfExport.test.ts
      ├── pfdExcelExport.test.ts
      ├── pfdValidation.test.ts
      └── pfdRepository.test.ts
```

---

## Tipos TypeScript

```typescript
// modules/pfd/pfdTypes.ts

/** Tipos de paso del proceso según simbología ASME/AIAG */
export type PfdStepType =
  | 'operation'    // Círculo — agrega valor
  | 'transport'    // Flecha — movimiento
  | 'inspection'   // Cuadrado — verificación
  | 'storage'      // Triángulo — almacenamiento
  | 'delay'        // D — espera/demora
  | 'decision'     // Rombo — punto de decisión
  | 'combined';    // Cuadrado+Círculo — operación con inspección simultánea

/** Clasificación de característica especial */
export type SpecialCharClass = 'CC' | 'SC' | 'none';

/** Encabezado / Metadata del documento PFD */
export interface PfdHeader {
  // Identificación del Producto
  partNumber: string;
  partName: string;
  engineeringChangeLevel: string;
  modelYear: string;

  // Control del Documento
  documentNumber: string;
  revisionLevel: string;
  revisionDate: string;

  // Organización
  companyName: string;       // default: "Barack Mercosul"
  plantLocation: string;     // default: "Hurlingham, Buenos Aires"
  supplierCode: string;
  customerName: string;
  coreTeam: string;
  keyContact: string;

  // Aprobaciones
  preparedBy: string;
  preparedDate: string;
  approvedBy: string;
  approvedDate: string;

  // Vinculación
  linkedProjectId?: string;
  linkedAmfeId?: string;
  linkedCpId?: string;
}

/** Un paso/operación en el diagrama de flujo */
export interface PfdStep {
  id: string; // UUID

  // Datos obligatorios
  stepNumber: string;        // "OP 10", "OP 20", "OP 30"
  stepType: PfdStepType;     // Símbolo ASME
  description: string;       // "Inyección de cubierta"
  machineDeviceTool: string; // "Prensa hidráulica 200T"

  // Características del producto
  productCharacteristic: string;       // "Espesor 2.5mm ± 0.1"
  productSpecialChar: SpecialCharClass; // CC, SC, o none

  // Características del proceso
  processCharacteristic: string;       // "Presión de cierre: 180 bar"
  processSpecialChar: SpecialCharClass;

  // Referencia
  reference: string;  // "Plano A-1234 Rev. C"

  // Opcionales
  department: string;
  notes: string;
  isRework: boolean;         // Bucle de retrabajo
  isExternalProcess: boolean; // Proceso tercerizado

  // Metadata de vinculación (se llena al generar AMFE/CP)
  linkedAmfeOperationId?: string;
  linkedCpItemIds?: string[];
}

/** Documento PFD completo */
export interface PfdDocument {
  id: string;
  header: PfdHeader;
  steps: PfdStep[];
  createdAt: string;
  updatedAt: string;
}

/** Metadatos para la lista de documentos (SELECT ligero) */
export interface PfdDocumentListItem {
  id: string;
  partNumber: string;
  partName: string;
  documentNumber: string;
  revisionLevel: string;
  revisionDate: string;
  customerName: string;
  stepCount: number;
  updatedAt: string;
}

/** Definición de columna para la tabla */
export interface PfdColumnDef {
  key: keyof PfdStep;
  label: string;
  width: string;
  required?: boolean;
  type?: 'text' | 'select' | 'symbol' | 'specialChar' | 'boolean';
}

/** Constantes */
export const PFD_STEP_TYPES: { value: PfdStepType; label: string; color: string }[] = [
  { value: 'operation',  label: 'Operación',       color: 'blue' },
  { value: 'transport',  label: 'Transporte',      color: 'slate' },
  { value: 'inspection', label: 'Inspección',      color: 'emerald' },
  { value: 'storage',    label: 'Almacenamiento',  color: 'amber' },
  { value: 'delay',      label: 'Demora / Espera', color: 'red' },
  { value: 'decision',   label: 'Decisión',        color: 'purple' },
  { value: 'combined',   label: 'Op. + Inspección', color: 'blue' },
];

export const PFD_COLUMNS: PfdColumnDef[] = [
  { key: 'stepNumber',            label: 'Nº Op.',           width: '80px',  required: true, type: 'text' },
  { key: 'stepType',              label: 'Símbolo',          width: '60px',  required: true, type: 'symbol' },
  { key: 'description',           label: 'Descripción',      width: '250px', required: true, type: 'text' },
  { key: 'machineDeviceTool',     label: 'Máquina/Dispositivo', width: '200px', type: 'text' },
  { key: 'productCharacteristic', label: 'Caract. Producto', width: '200px', type: 'text' },
  { key: 'productSpecialChar',    label: 'CC/SC Prod.',      width: '70px',  type: 'specialChar' },
  { key: 'processCharacteristic', label: 'Caract. Proceso',  width: '200px', type: 'text' },
  { key: 'processSpecialChar',    label: 'CC/SC Proc.',      width: '70px',  type: 'specialChar' },
  { key: 'reference',             label: 'Referencia',       width: '120px', type: 'text' },
  { key: 'department',            label: 'Área',             width: '100px', type: 'text' },
  { key: 'notes',                 label: 'Notas',            width: '150px', type: 'text' },
  { key: 'isRework',              label: 'Retrabajo',        width: '60px',  type: 'boolean' },
  { key: 'isExternalProcess',     label: 'Externo',          width: '60px',  type: 'boolean' },
];

export const EMPTY_PFD_HEADER: PfdHeader = {
  partNumber: '',
  partName: '',
  engineeringChangeLevel: '',
  modelYear: '',
  documentNumber: '',
  revisionLevel: 'A',
  revisionDate: new Date().toISOString().split('T')[0],
  companyName: 'Barack Mercosul',
  plantLocation: 'Hurlingham, Buenos Aires',
  supplierCode: '',
  customerName: '',
  coreTeam: '',
  keyContact: '',
  preparedBy: '',
  preparedDate: '',
  approvedBy: '',
  approvedDate: '',
};

export function createEmptyStep(): PfdStep {
  return {
    id: crypto.randomUUID(),
    stepNumber: '',
    stepType: 'operation',
    description: '',
    machineDeviceTool: '',
    productCharacteristic: '',
    productSpecialChar: 'none',
    processCharacteristic: '',
    processSpecialChar: 'none',
    reference: '',
    department: '',
    notes: '',
    isRework: false,
    isExternalProcess: false,
  };
}

export function createEmptyPfdDocument(): PfdDocument {
  return {
    id: crypto.randomUUID(),
    header: { ...EMPTY_PFD_HEADER },
    steps: [createEmptyStep()],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
```

---

## Persistencia (SQLite)

### Tabla a agregar

```sql
CREATE TABLE IF NOT EXISTS pfd_documents (
  id TEXT PRIMARY KEY,
  part_number TEXT NOT NULL DEFAULT '',
  part_name TEXT NOT NULL DEFAULT '',
  document_number TEXT NOT NULL DEFAULT '',
  revision_level TEXT NOT NULL DEFAULT 'A',
  revision_date TEXT NOT NULL DEFAULT '',
  customer_name TEXT NOT NULL DEFAULT '',
  step_count INTEGER NOT NULL DEFAULT 0,
  data TEXT NOT NULL,  -- JSON completo del PfdDocument
  checksum TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### Repository Pattern

Seguir exactamente el patrón de `cpRepository.ts`:
- Funciones puras (no clases): `listPfdDocuments()`, `loadPfdDocument(id)`, `savePfdDocument(id, doc)`, `deletePfdDocument(id)`
- `getDatabase()` para obtener la conexión
- `JSON.stringify(doc)` para almacenar, `JSON.parse(rows[0].data)` para leer
- `generateChecksum()` para integridad
- `logger.error('PfdRepository', ...)` para errores

---

## UI / Design System

### Tema de Color: Cyan/Teal (para diferenciar de los otros módulos)

| Módulo | Color Primario |
|---|---|
| Tiempos y Balanceos | Azul (`blue-500`) |
| AMFE VDA | Naranja/Amber (`orange-500`) |
| Plan de Control | Verde (`emerald-500`) |
| **PFD (nuevo)** | **Cyan/Teal (`cyan-500` / `teal-500`)** |

### Componentes UI Requeridos

1. **PfdApp.tsx** — Shell del módulo
   - Recibe `onBackToLanding: () => void`
   - Toolbar superior (acciones: nuevo, abrir, guardar, exportar PDF, exportar Excel)
   - Header del documento (colapsable)
   - Tabla principal
   - Botón flotante para agregar paso
   - Atajos de teclado: Ctrl+S (guardar), Ctrl+N (nuevo paso), Ctrl+E (exportar)

2. **PfdTable.tsx** — Tabla interactiva
   - Header sticky con nombres de columna
   - Filas editables inline (click para editar, Tab para navegar)
   - Columna de símbolo con dropdown visual (PfdSymbolPicker)
   - Columna CC/SC con badge coloreado (rojo=CC, amarillo=SC)
   - Drag & drop para reordenar filas (react-dnd o HTML5 drag)
   - Botón de eliminar fila (con confirmación)
   - Indicador visual de retrabajo (fondo rosa suave) y proceso externo (fondo azul claro)
   - Row numbering automático si stepNumber está vacío

3. **PfdSymbolPicker.tsx** — Selector de símbolo
   - Dropdown con los 7 símbolos
   - Cada opción muestra SVG + nombre
   - Selección por click

4. **PfdHeader.tsx** — Editor de metadata
   - Formulario con los campos del header
   - Organizado en secciones colapsables (Producto, Documento, Organización, Aprobaciones)
   - Valores default para empresa y planta

### Convenciones Visuales

- Fondo de filas de retrabajo: `bg-red-50`
- Fondo de filas de proceso externo: `bg-blue-50`
- Badge CC: `bg-red-100 text-red-700 border border-red-300`
- Badge SC: `bg-amber-100 text-amber-700 border border-amber-300`
- Símbolo en la columna: SVG 20x20 centrado con tooltip
- Hover en fila: `bg-cyan-50/50`
- Fila seleccionada: `ring-2 ring-cyan-400`

---

## Exportación PDF

Seguir el patrón de `amfePdfExport.ts` y `hojaOperacionesPdfExport.ts`:

### Layout del PDF

1. **Header** (3 filas como HO):
   - Fila 1: Logo Barack (izquierda) | "DIAGRAMA DE FLUJO DEL PROCESO" (centro) | Número de documento (derecha)
   - Fila 2: Nº Pieza | Nombre Pieza | Cliente | Planta
   - Fila 3: Elaboró | Aprobó | Fecha | Revisión

2. **Tabla**: Todas las columnas con los pasos, símbolos como imágenes SVG inline

3. **Footer**: Número de página, fecha de impresión

### Notas técnicas
- Usar `window.print()` con CSS `@media print` (como los otros módulos)
- Símbolos SVG se renderizan como `<img>` con data URI en el HTML de impresión
- Filas de retrabajo con fondo rosa, externas con fondo azul claro
- CC/SC con badges coloreados

---

## Exportación Excel

Seguir el patrón de `amfeExcelExport.ts`:
- Usar `xlsx-js-style` para formato con colores
- Header en las primeras filas con metadata
- Tabla de pasos con todas las columnas
- Símbolos como texto (nombre del tipo: "Operación", "Transporte", etc.)
- CC/SC con color de fondo en celda
- `sanitizeCellValue()` para prevenir inyección de fórmulas

---

## Validaciones

### Archivo: `pfdValidation.ts`

| Regla | Severidad | Descripción |
|---|---|---|
| V1 | Error | Nº de operación duplicado en el mismo documento |
| V2 | Error | Paso sin descripción |
| V3 | Warning | Paso con CC/SC pero sin característica especificada |
| V4 | Warning | Documento sin header completo (pieza, cliente) |
| V5 | Info | Paso de tipo "decisión" sin nota explicativa |
| V6 | Warning | Más de 50 pasos en un mismo documento (soft limit) |
| V7 | Error | Campo de texto excede 10,000 caracteres |

---

## Integración con Landing Page

### Modificar `modules/LandingPage.tsx`

Agregar una 4ª card para el PFD:
- **Posición:** Primera card (según Golden Thread: PFD → AMFE → CP → Tiempos)
- **Ícono:** `GitBranch` o `Workflow` de lucide-react
- **Título:** "Diagrama de Flujo"
- **Descripción:** "Diagrama de Flujo del Proceso según AIAG (APQP) con simbología ASME estándar"
- **Tags:** `["PFD", "APQP", "ASME"]`
- **Color tema:** Cyan/Teal (`cyan-500`)
- **Keyboard shortcut:** Tecla "1" (reordenar todos: 1=PFD, 2=AMFE, 3=CP, 4=Tiempos)
- **`aria-label`:** `"Abrir módulo Diagrama de Flujo del Proceso"`

### Modificar `AppRouter.tsx`

```typescript
type AppMode = 'landing' | 'pfd' | 'amfe' | 'controlPlan' | 'tiempos';

const PfdApp = lazy(() => import('./modules/pfd/PfdApp'));

// En el switch/render:
case 'pfd':
  return (
    <Suspense fallback={<LoadingFallback />}>
      <PfdApp onBackToLanding={() => setMode('landing')} />
    </Suspense>
  );
```

---

## Tests Requeridos

Patrón: `describe > it > expect` con vitest globals (no importar describe/it/expect).

### Tests mínimos por archivo

| Archivo test | Tests sugeridos |
|---|---|
| `pfdTypes.test.ts` | createEmptyStep, createEmptyPfdDocument, PFD_COLUMNS completeness, EMPTY_PFD_HEADER defaults |
| `PfdApp.test.tsx` | Render, toolbar buttons, keyboard shortcuts |
| `PfdTable.test.tsx` | Render rows, add/remove step, edit inline, reorder, CC/SC badges |
| `PfdSymbols.test.tsx` | 7 SVG symbols render, correct colors, aria-labels |
| `pfdPdfExport.test.ts` | HTML generation, header fields, step rows, symbol images |
| `pfdExcelExport.test.ts` | Workbook generation, headers, data rows, CC/SC formatting |
| `pfdValidation.test.ts` | All 7 validation rules (positive + negative cases) |
| `pfdRepository.test.ts` | Mock SQLite: list, load, save, delete, checksum |

**Mocks necesarios:**
- `vi.mock('@tauri-apps/plugin-sql')` para repository tests
- `vi.mock('../../utils/logger')` para silenciar logs
- `vi.mock('../../utils/repositories/pfdRepository')` para component tests

---

## Referencia: Plantilla SGC de la Empresa

La empresa Barack Mercosul ya tiene una plantilla oficial en su SGC:
- **Archivo:** `I-AC-005.1 Diagrama de flujo del proceso C.xlsx` (83 KB)
- **Ubicación:** `Y:\BARACK\CALIDAD\DOCUMENTACION SGC\SISTEMA\SISTEMA SGC\Instructivos\CALIDAD\`
- **Código de formulario:** I-AC-005.1
- **Estado:** Revisión C (vigente desde 2021-11-30)

El módulo de software debe poder generar documentos que cumplan con este formato cuando se exporten a Excel.

---

## NO hacer (restricciones explícitas)

1. **NO** implementar un canvas visual con drag & drop de nodos. Es una tabla.
2. **NO** usar `as any` ni `@ts-ignore`. Tipar todo correctamente.
3. **NO** usar `console.log/warn/error`. Usar `logger.ts`.
4. **NO** acceder a SQLite directamente. Usar el repository.
5. **NO** hardcodear API keys ni rutas de archivos.
6. **NO** crear archivos de documentación innecesarios (README, etc.).
7. **NO** modificar módulos existentes (AMFE, CP, HO) excepto para agregar el botón en la Landing Page y la ruta en AppRouter.
8. **NO** agregar dependencias npm nuevas sin justificación. Los SVGs son inline, no necesitan librería.

---

## Resumen Ejecutivo

Implementar un módulo PFD como **tabla interactiva** con:
- 7 símbolos ASME como SVG inline
- 13 columnas de datos por paso
- Header con metadata APQP completa
- Persistencia SQLite via repository
- Exportación PDF y Excel
- Validaciones de integridad
- Vinculación por IDs con AMFE y Plan de Control
- Tema cyan/teal en el design system
- Tests exhaustivos con Vitest

El PFD es la primera pieza del "Hilo Digital" APQP y debe alimentar directamente al AMFE (Nº Operación → Paso 2: Análisis de Estructura) y al Plan de Control (Nº Operación → Process Step).
