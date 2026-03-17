# Barack Mercosul — Design System

> Referencia visual para mantener consistencia en toda la aplicacion.
> Ultima actualizacion: 2026-03-17

---

## Paleta de Colores

### Variables CSS Custom (`index.css :root`)

```css
/* Primary - Azul Corporativo */
--primary-50:  #EFF6FF   --primary-500: #3B82F6
--primary-100: #DBEAFE   --primary-600: #2563EB
--primary-200: #BFDBFE   --primary-700: #1D4ED8
                         --primary-800: #1E40AF

/* Neutral - Grises (Slate) */
--gray-50:  #F8FAFC   --gray-500: #64748B
--gray-100: #F1F5F9   --gray-600: #475569
--gray-200: #E2E8F0   --gray-700: #334155
--gray-300: #CBD5E1   --gray-800: #1E293B
--gray-400: #94A3B8   --gray-900: #0F172A

/* Estados */
--success: #10B981  (emerald-500)
--warning: #F59E0B  (amber-500)
--error:   #EF4444  (red-500)
--info:    #3B82F6  (blue-500)

/* Sidebar */
--sidebar-bg:     #0F172A  (slate-900)
--sidebar-hover:  #1E293B  (slate-800)
--sidebar-active: #3B82F6  (blue-500)
```

### Colores por Modulo (Theme Colors)

| Modulo             | Color Primario | Tailwind Classes Representativas                |
|--------------------|----------------|--------------------------------------------------|
| **AMFE VDA**       | Azul           | `bg-blue-600`, `text-blue-700`, `border-blue-600` |
| **PFD**            | Cyan / Teal    | `bg-cyan-600`, `text-cyan-700`, `hover:bg-cyan-50` |
| **Control Plan**   | Teal / Green   | `bg-teal-200`, `bg-cyan-100`, `bg-sky-100`        |
| **Hoja Operaciones** | Navy (custom)| `#1e3a5f` (constante `NAVY` en HoSheetEditor)     |

### Colores Semanticos de Estado

| Estado   | Background        | Texto            | Borde              | Icono             |
|----------|-------------------|------------------|--------------------|--------------------|
| Success  | `bg-emerald-50/100` | `text-emerald-700` | `border-emerald-200` | `text-emerald-500` |
| Error    | `bg-red-50/100`     | `text-red-700`     | `border-red-200`     | `text-red-500`     |
| Warning  | `bg-amber-50/100`   | `text-amber-700`   | `border-amber-200`   | `text-amber-500`   |
| Info     | `bg-blue-50/100`    | `text-blue-700`    | `border-blue-200`    | `text-blue-500`    |
| Pending  | `bg-slate-100`      | `text-slate-600`   | `border-slate-200`   | `text-slate-400`   |
| Neutral  | `bg-slate-50`       | `text-slate-500`   | `border-slate-100`   | `text-slate-300`   |

### Action Priority (AP) Badges

| AP    | Classes                                         |
|-------|-------------------------------------------------|
| Alto (H) | `bg-red-100 text-red-700 border-red-200`     |
| Medio (M)| `bg-amber-100 text-amber-700 border-amber-200`|
| Bajo (L) | `bg-green-100 text-green-700 border-green-200`|
| Sin AP   | `bg-gray-100 text-gray-400 border-gray-200`  |

### Special Characteristics Badges (CP)

| Tipo | Classes                                     |
|------|---------------------------------------------|
| CC   | `bg-red-100 text-red-700 font-bold`         |
| SC   | `bg-orange-100 text-orange-700 font-bold`   |
| PTC  | `bg-blue-100 text-blue-700 font-bold`       |

---

## Componentes UI Reutilizables

### Botones (`components/ui/Button.tsx`)

Componente estandarizado con variantes, tamanos y estados.

**Variantes** (`ButtonVariant`):

| Variante   | Classes Base                                                |
|------------|--------------------------------------------------------------|
| `primary`  | `bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800` |
| `secondary`| `bg-slate-100 text-slate-700 hover:bg-slate-200`             |
| `danger`   | `bg-red-600 text-white hover:bg-red-700`                     |
| `ghost`    | `bg-transparent text-slate-600 hover:bg-slate-100`           |
| `outline`  | `bg-transparent text-blue-600 border-2 border-blue-600`      |

**Tamanos** (`ButtonSize`):

| Tamano | Padding       | Texto     | Icono | Gap     |
|--------|---------------|-----------|-------|---------|
| `xs`   | `px-2 py-1`   | `text-xs` | 12px  | `gap-1` |
| `sm`   | `px-3 py-1.5` | `text-sm` | 14px  | `gap-1.5`|
| `md`   | `px-4 py-2`   | `text-sm` | 16px  | `gap-2` |
| `lg`   | `px-5 py-2.5` | `text-base`| 18px | `gap-2` |

**Propiedades clave**:
- `loading`: muestra spinner `Loader2` con `animate-spin`
- `icon` + `iconPosition`: icono a izquierda o derecha
- `fullWidth`: `w-full`
- Todos: `rounded-lg`, `transition-all duration-150`, `focus:ring-2 focus:ring-offset-1`

**IconButton** (`components/ui/Button.tsx`):
- Variante por defecto: `ghost`
- Tamanos cuadrados: `xs=w-6 h-6`, `sm=w-8 h-8`, `md=w-9 h-9`, `lg=w-10 h-10`
- Requiere `aria-label` obligatorio

**Patron inline (toolbars)**: Muchos modulos usan botones inline con la clase compartida:
```
"flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
```

### Cards (`components/ui/Card.tsx`)

```
Contenedor:  bg-white rounded-xl shadow-sm border border-slate-200/60
             hover:shadow-md transition-all duration-200
Header:      px-6 py-5 border-b border-slate-100 bg-white/50 backdrop-blur-sm
Titulo:      text-base font-bold text-slate-800 tracking-tight
Body:        p-6
```

### Badges (`components/ui/Card.tsx` — `Badge`)

Colores disponibles: `green`, `red`, `yellow`, `blue`, `purple`, `slate`.

```
Estructura: inline-flex items-center px-2.5 py-0.5 rounded-md
            text-[10px] font-bold uppercase tracking-wide
            border border-{color}-200

green:  bg-emerald-50  text-emerald-700
red:    bg-red-50      text-red-700
yellow: bg-amber-50    text-amber-700
blue:   bg-blue-50     text-blue-700
purple: bg-purple-50   text-purple-700
slate:  bg-slate-100   text-slate-600
```

### StatusBadge (`components/ui/StatusBadge.tsx`)

Componente unificado para indicadores de estado. Ver tabla de colores semanticos arriba.

**Tamanos**:
| Tamano | Padding         | Texto        |
|--------|-----------------|--------------|
| `xs`   | `px-1.5 py-0.5` | `text-[10px]`|
| `sm`   | `px-2 py-0.5`   | `text-xs`    |
| `md`   | `px-2.5 py-1`   | `text-sm`    |

Forma: `rounded-full`, con borde e icono opcional.

**StatusDot**: Indicador circular minimo (punto). Tamanos: `sm=w-2 h-2`, `md=w-2.5 h-2.5`, `lg=w-3 h-3`.

### Modales

**Patron de modal estandar** (usado en `ConfirmModal`, `PromptModal`):

```
Backdrop:    fixed inset-0 z-50, bg-black/50 backdrop-blur-sm
             Animacion: animate-in fade-in duration-200
Contenedor:  bg-white rounded-xl shadow-xl w-full max-w-md mx-4
             Animacion: animate-scale-in (scaleIn 0.2s ease-out)
Icono:       w-14 h-14 bg-{color}-100 rounded-full, centrado con mx-auto mb-4
Titulo:      text-xl font-bold text-slate-800 text-center mb-2
Mensaje:     text-slate-600 text-center mb-6
Botones:     flex gap-3, cada uno flex-1 px-4 py-2.5 font-medium rounded-lg
             Cancel: bg-slate-100 text-slate-700 hover:bg-slate-200
             Confirm: bg-{variant}-600 text-white hover:{variant}-700
Close btn:   absolute top-4 right-4, text-slate-400 hover:text-slate-600
```

**ConfirmModal** (`components/modals/ConfirmModal.tsx`):
- Variantes: `danger` (Trash2/red), `warning` (AlertTriangle/amber), `info` (Info/blue)
- A11y: focus trap, auto-focus cancel, Escape para cerrar, `role="dialog"`, `aria-modal="true"`

**PromptModal** (`components/modals/PromptModal.tsx`):
- Input: `px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500`
- Icono: MessageSquare en fondo `bg-blue-100`

**Side Drawers** (paneles laterales, ej. `AmfeSideDrawer`):
```
Contenedor: fixed inset-0 z-50 flex justify-end
Backdrop:   absolute inset-0 bg-black/20 animate-in fade-in duration-150
Panel:      relative z-10 w-[420px] bg-white border-l border-gray-200 shadow-xl
            animate-in slide-in-from-right-10 duration-200
```

### Toast Notifications (`components/ui/Toast.tsx`)

**Posicion**: `fixed bottom-4 right-4 z-50`, stack vertical con `gap-2`.

**Colores por tipo**:

| Tipo    | Background                    | Icono             | Texto           |
|---------|-------------------------------|-------------------|-----------------|
| success | `bg-emerald-50 border-emerald-200` | `text-emerald-500` (CheckCircle) | `text-emerald-800` |
| error   | `bg-red-50 border-red-200`    | `text-red-500` (XCircle) | `text-red-800`  |
| warning | `bg-amber-50 border-amber-200`| `text-amber-500` (AlertTriangle) | `text-amber-800` |
| info    | `bg-blue-50 border-blue-200`  | `text-blue-500` (Info) | `text-blue-800` |

- Max 5 toasts visibles (eviction FIFO)
- Auto-dismiss: 5s por defecto, errores requieren dismiss manual

### Tooltips

**Tooltip basico** (`components/ui/Tooltip.tsx`):
```
Portal a document.body, fixed z-[9999]
bg-slate-900 text-white text-xs rounded-lg shadow-2xl
border border-slate-700 border-l-2 border-l-blue-500
animate-in fade-in zoom-in-95 duration-150
```
Soporte para shortcut keyboard: `bg-slate-800 border border-slate-600 rounded px-1.5 py-0.5 text-[10px] font-mono text-slate-300`.

**InfoTooltip** (`components/ui/InfoTooltip.tsx`):
- `bg-slate-800 text-white text-xs rounded-lg` con flecha triangular
- Seccion formula expandible

**EducationalTooltip** (`components/ui/EducationalTooltip.tsx`):
- `bg-slate-900 text-white rounded-xl shadow-2xl border border-slate-700`
- Header: `bg-slate-800` con termino en `text-blue-400 uppercase`
- Formula: `text-emerald-300 font-mono` sobre `bg-slate-800/50`
- Ejemplo: `text-amber-400` label sobre `bg-slate-800/50`

### EmptyState (`components/ui/EmptyState.tsx`)

```
Icono: w-20 h-20 (default) / w-14 h-14 (compact)
       rounded-2xl bg-gradient-to-br from-blue-100 via-slate-100 to-purple-100
       shadow-inner, icono text-blue-500/70

Titulo: text-xl font-bold text-slate-700
Descripcion: text-base text-slate-500 max-w-md

Boton primario: bg-gradient-to-r from-blue-600 to-indigo-600 text-white
                rounded-xl shadow-md hover:shadow-lg hover:-translate-y-0.5

Tip: bg-amber-50 border border-amber-200 rounded-xl
     icono Lightbulb text-amber-500, texto text-amber-700
```

### FloatingActionButton (`components/ui/FloatingActionButton.tsx`)

```
Posicion: fixed bottom-6 right-6 z-50
Primario: px-5 py-4 rounded-full shadow-xl hover:shadow-2xl
          ring-4 ring-{color}-200 ring-opacity-30
          hover:scale-105 active:scale-95
Secundarios: px-4 py-2.5 rounded-full shadow-lg
             animate-in slide-in-from-bottom-2 fade-in (stagger 50ms)

Colores: blue, emerald, purple, amber, rose
```

### Banners de Alerta

**CrossDocAlertBanner** (`components/ui/CrossDocAlertBanner.tsx`):
```
bg-amber-50 border-b border-amber-200 px-4 py-2.5
Icono: AlertTriangle text-amber-500
Texto: text-xs text-amber-800
```

**DocumentLockBanner** (`components/ui/DocumentLockBanner.tsx`):
```
bg-amber-50 border-b border-amber-200 px-4 py-1.5
Icono: AlertTriangle text-amber-500, texto text-xs text-amber-700
```

### Loading (`components/ui/LoadingOverlay.tsx`)

```
Spinner: Loader2 animate-spin text-blue-500 (configurable accentColor)
Skeleton table: bg-white rounded-lg border border-gray-200
  Header: bg-slate-50, barras bg-slate-200 animate-pulse
  Rows: barras bg-slate-200 animate-pulse, opacidad decreciente
```

Clase custom: `.animate-shimmer` para skeleton shimmer effect (gradiente `#f1f5f9 → #e2e8f0 → #f1f5f9`).

---

## Patrones de Layout

### Estructura General de Modulos APQP

Cada modulo sigue esta estructura vertical:

```
[Toolbar]              — bg-white border-b border-gray-200, botones + acciones
[Banner Alertas]       — Opcional: CrossDocAlertBanner, DocumentLockBanner
[Header Colapsable]    — Metadata del documento (fieldsets con grid)
[Progress / Filters]   — Barra de filtros o progreso (AMFE tiene ambas)
[Tabla Principal]      — Tabla editable inline con sticky header
[Side Drawer]          — Panel lateral deslizante (proyectos, resumen, biblioteca)
```

### Toolbar de Modulo

Patron comun en los 4 modulos:
```
Contenedor: bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-2 flex-wrap no-print
Separador:  <div className="w-px h-6 bg-gray-200" />
Spacer:     <div className="flex-1" />

Boton toolbar: "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                transition hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"

Colores de boton segun modulo:
  AMFE: text-blue-700  hover:bg-blue-50
  PFD:  text-cyan-700  hover:bg-cyan-50
  CP:   text-teal-700  hover:bg-teal-50  (o text-green-700)
  HO:   text-navy (custom)

Undo/Redo: flex border border-gray-300 rounded-lg overflow-hidden
           Cada boton: bg-gray-50 hover:bg-gray-100 px-2.5 py-1.5 text-gray-600
           Separados por border-r border-gray-300

Save con cambios pendientes:
  Sin cambios:  text-{module}-700 hover:bg-{module}-50
  Con cambios:  bg-{module}-600 text-white hover:bg-{module}-700
  Con error:    bg-red-600 text-white hover:bg-red-700
  Indicador:    dot animado con animate-ping
```

### Dropdowns (Menus desplegables)

```
Contenedor: absolute top-full left-0 mt-1
            bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[220px] py-1
Item:       w-full text-left px-3 py-2 text-xs text-gray-700
            hover:bg-{module}-50 hover:text-{module}-700 transition
Separador:  border-t border-gray-100 my-1
```

### Tabs (AmfeTabBar)

```
Contenedor: bg-white border-b border-gray-300 sticky top-0 z-50
            px-4 flex items-center gap-0

Tab activa (por modulo):
  PFD:   text-cyan-700  border-b-2 border-cyan-600  bg-cyan-50/50
  AMFE:  text-blue-700  border-b-2 border-blue-600  bg-blue-50/50
  CP:    text-green-700 border-b-2 border-green-600 bg-green-50/50
  HO:    text-amber-700 border-b-2 border-amber-600 bg-amber-50/50

Tab inactiva:
  text-gray-500 hover:text-gray-700 hover:bg-gray-50
  border-b-2 border-transparent hover:border-gray-300

Tab item: px-4 py-2.5 text-xs font-medium transition-colors duration-150
          flex items-center gap-1.5
Icono tab: size={13}
```

### Navegacion Principal (AppHeader)

```
Nav item activo:   border-blue-600 text-blue-600 bg-blue-50/50, border-b-2
Nav item inactivo: border-transparent text-slate-500 hover:text-slate-800
                   hover:bg-slate-50 hover:border-slate-200
Texto: text-sm font-medium, active:scale-95
```

### Breadcrumb (`components/navigation/Breadcrumb.tsx`)

```
nav flex items-center gap-1 text-sm
Separator: ChevronRight size={14} text-slate-300
Item clickable: px-2 py-1 text-slate-500 hover:text-blue-600
                hover:bg-blue-50 hover:shadow-sm hover:-translate-y-px rounded
Item activo: text-slate-800 font-medium
Truncate: max-w-[150px]
```

### Header de Documento (Colapsable)

Patron compartido por PFD y CP:
```
Contenedor: bg-white border-b border-gray-200
Toggle:     w-full flex items-center gap-2 px-4 py-2 hover:bg-{module}-50/50
            ChevronDown/ChevronRight text-{module}-600
Label:      text-xs font-semibold text-{module}-700 uppercase tracking-wider
Collapsed:  Muestra resumen inline en text-xs text-gray-500

Fieldset:   border border-gray-200 rounded-lg p-2.5
Legend:     text-[11px] font-semibold text-{module}-700 px-1.5
Grid:       grid grid-cols-2 gap-3 (sections), grid-cols-2/3/4 gap-2 (campos)

Input:      w-full border border-gray-300 bg-gray-50 p-1.5 rounded text-sm
            focus:ring-2 focus:ring-{module}-100 focus:border-{module}-400 outline-none
Label:      block text-[11px] font-medium text-gray-600 mb-0.5
```

### Sidebar (HO Sheet Navigator)

```
Contenedor: flex flex-col h-full bg-white border-r border-gray-200
Search:     pl-6 pr-2 py-1.5 text-xs border border-gray-200 rounded
            focus:border-blue-500 focus:ring-1 focus:ring-blue-500
Items:      Scroll vertical, hover:bg-blue-50
Active:     bg-blue-50 border-l-2 border-blue-500
```

### Filter Bar (AMFE Filters)

```
Contenedor: bg-gray-50 border-b border-gray-200 px-4 py-1.5
Layout:     max-w-[1800px] mx-auto flex items-center gap-3 flex-wrap

Select:     border border-gray-300 rounded px-2 py-1 text-xs bg-white
            focus:ring-1 focus:ring-blue-200 focus:border-blue-400

Search input: misma clase + pl-6 w-40 (con icono Search absolute)

Clear:      text-xs text-red-600 hover:text-red-800 px-2 py-1 rounded hover:bg-red-50

Column toggles (pills):
  Activa:   text-[10px] px-2 py-0.5 rounded-full border font-medium
            {COLUMN_GROUP_COLORS[group]} border-current
  Inactiva: bg-gray-50 text-gray-300 border-gray-200 line-through
```

### Tablas (Sticky Headers)

**AMFE Table Header**:
```
thead sticky top-0 z-10 shadow-md text-xs font-semibold text-slate-700
Row 1 (Step groups):
  Paso 2: bg-slate-200
  Paso 3: bg-slate-200/70
  Paso 4: bg-orange-100 border-orange-200
  Paso 5: bg-yellow-100 border-yellow-200
  Paso 6: bg-blue-100 border-blue-200
  OBS:    bg-gray-200

Row 2 (Column headers):
  bg-slate-100 p-2, text-[11px] leading-4 text-center text-slate-600
Frozen columns: sticky left-0 z-20 (Op# y Item/Paso)
```

**Control Plan Table Header**:
```
thead sticky top-0 z-10 shadow-md text-xs font-semibold text-slate-700
Row 1 (Groups):
  Proceso:         bg-teal-200 text-teal-900 border-teal-300
  Caracteristicas: bg-cyan-100 text-cyan-900 border-cyan-200
  Metodos:         bg-sky-100  text-sky-900  border-sky-200
  Acciones:        bg-gray-200 text-gray-600

Row 2: text-[11px] leading-4 text-center
```

**HO Table**: Usa `border-collapse` con bordes `border-gray-300` y headers navy (`#1e3a5f` con text-white).

### Progress Bar (AMFE Step Progress)

```
Barra compacta:
  Track: h-1.5 bg-slate-100 rounded-full
  Fill:  bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full
         transition-all duration-500 ease-out

Step icons (expanded):
  Completed:   w-6 h-6 rounded-full bg-emerald-500 text-white
  In Progress: w-6 h-6 rounded-full bg-blue-500 text-white animate-pulse
  Pending:     w-6 h-6 rounded-full bg-slate-200 text-slate-500

Connector: h-0.5 bg-slate-200, fill bg-emerald-500 transition
```

---

## Iconografia

### Libreria: Lucide React

Toda la app usa **`lucide-react`** (fork moderno de Feather Icons).

Import: `import { IconName } from 'lucide-react'`

### Tamanos Estandar

| Contexto              | Size  | Ejemplo                              |
|-----------------------|-------|--------------------------------------|
| Tab (AmfeTabBar)      | 13px  | `<GitBranch size={13} />`            |
| Toolbar boton         | 16px  | `<Save size={16} />`                 |
| Boton sm              | 14px  | `<Undo2 size={15} />`               |
| FAB primario          | 22px  | `<Plus size={22} />`                 |
| FAB secundario        | 18px  | `<Zap size={18} />`                  |
| Badge / inline        | 10-12px | `<Check size={9} />`               |
| Modal icono grande    | 28px  | `<Trash2 size={28} />`              |
| EmptyState grande     | 40px  | `<Icon size={40} />`                |
| Tooltip / filter      | 12-14px | `<Search size={12} />`             |
| Close button          | 20px  | `<X size={20} />`                    |
| Loading spinner       | 36px  | `<Loader2 size={36} />`             |

### Iconos Mas Usados por Contexto

**Navegacion y acciones generales**:
- `Home` — volver al inicio
- `ArrowLeft` — volver atras
- `Save` — guardar
- `FolderOpen` — abrir/cargar proyecto
- `FilePlus` — nuevo documento
- `Undo2`, `Redo2` — deshacer/rehacer
- `Eye`, `Edit3`, `Pencil` — vista/edicion
- `Download`, `Upload` — importar/exportar
- `FileSpreadsheet` — exportar Excel
- `GitBranch` — nueva revision
- `Trash2` — eliminar
- `Copy` — duplicar / guardar como
- `ChevronDown`, `ChevronUp`, `ChevronRight` — colapsar/expandir
- `MoreHorizontal` — menu overflow

**Estado y validacion**:
- `AlertTriangle` — advertencia / validacion con errores
- `CheckCircle` / `Check` — exito / completado
- `XCircle` / `X` — error / cerrar
- `Info` — informacion
- `Loader2` — cargando (con `animate-spin`)
- `Clock` — pendiente / timestamp
- `ShieldCheck` — verificacion

**Modulos especificos**:
- `FileJson` — AMFE (documento VDA)
- `ClipboardCheck` — Control Plan
- `FileText` — Hojas de Operaciones
- `GitBranch` — PFD (Diagrama de Flujo)
- `Filter` — filtros
- `Search` — busqueda
- `HelpCircle` — ayuda / tooltip educativo
- `Layers` — templates
- `Library` / `BookOpen` — biblioteca
- `Sparkles` — auto-generado / IA (purple tint en CP)
- `Link2` — vinculacion entre documentos

---

## Tipografia y Espaciado

### Font Family

```css
font-family: 'Inter', sans-serif;
```
Importado via Google Fonts (`wght@300;400;500;600;700`).
Anti-aliasing: `-webkit-font-smoothing: antialiased`.

### Body

```css
body: bg-slate-50 text-slate-900
```

### Tamanos de Texto Usados

| Clase Tailwind | Donde se Usa                                           |
|----------------|--------------------------------------------------------|
| `text-[8px]`   | Porcentajes minimos en progress steps                  |
| `text-[9px]`   | Badges tab salvado, hints muy pequenos                 |
| `text-[10px]`  | Column toggle pills, badges xs, form hints, legend terms |
| `text-[11px]`  | Sub-headers de tabla, labels de formulario, context info |
| `text-xs`      | Toolbar botones, filtros, table body, toasts, badges   |
| `text-sm`      | Inputs, body de modal, descripcion card, nav items     |
| `text-base`    | Titulo de card, boton lg, hero subtitle                |
| `text-lg`      | Empty state compact title                              |
| `text-xl`      | Titulo de modal, empty state default title             |

### Font Weights

| Weight         | Uso Principal                                       |
|----------------|-----------------------------------------------------|
| `font-medium`  | Toolbar botones, labels, breadcrumb activo, body text |
| `font-semibold`| Tab labels, section headers, form legends            |
| `font-bold`    | Titulos de modal, card headers, badges, step headers  |

### Espaciado Estandar

**Padding general**:
- Toolbar: `px-4 py-2`
- Modal body: `p-6`
- Card body: `p-6`
- Card header: `px-6 py-5`
- Table cell: `p-2`
- Filter bar: `px-4 py-1.5`
- Fieldset: `p-2.5`
- Input: `p-1.5` (forms) o `px-4 py-3` (modal inputs)

**Gap (flex/grid)**:
- Toolbar botones: `gap-2`
- Filter items: `gap-3`
- Grid formularios: `gap-2` (campos), `gap-3` (sections)
- Modal botones: `gap-3`
- Tab items: `gap-0` (adyacentes) o `gap-1.5` (icono+texto)
- Toast stack: `gap-2`
- Badge contenido: `gap-1` o `gap-1.5`

**Margenes comunes**:
- Entre secciones: `mb-4` a `mb-6`
- Icono a texto: `gap-1.5` o `gap-2`
- Separador visual: `w-px h-6 bg-gray-200`

### Border Radius

| Contexto       | Clase             |
|----------------|-------------------|
| Botones        | `rounded-lg`      |
| Cards          | `rounded-xl`      |
| Modales        | `rounded-xl`      |
| Badges         | `rounded-full` o `rounded-md` |
| Inputs         | `rounded` o `rounded-xl` (modal) |
| FAB            | `rounded-full`    |
| Dropdowns      | `rounded-lg`      |
| Tooltips       | `rounded-lg` o `rounded-xl` |
| Progress bar   | `rounded-full`    |

---

## Motion Tokens

### Variables CSS (`index.css :root`)

```css
--duration-instant: 100ms;
--duration-fast:    150ms;
--duration-normal:  250ms;
--duration-slow:    400ms;

--ease-out:    cubic-bezier(0.2, 0.8, 0.2, 1);
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
```

### Animaciones Custom (Clases CSS)

| Clase                  | Uso                              | Duracion |
|------------------------|----------------------------------|----------|
| `animate-fade-in-up`  | Entrada de modales y paneles     | 250ms    |
| `animate-fade-in`     | Dropdowns                        | 150ms    |
| `animate-scale-in`    | Modales (escala 0.95 a 1)        | 200ms    |
| `animate-slide-in-left`| Paneles laterales               | 300ms    |
| `animate-pulse-soft`  | Loading states                   | 2s loop  |
| `animate-shimmer`     | Skeleton loading                 | 1.2s loop|
| `animate-fade-out-up` | Cierre de modales                | 150ms    |

### Tailwind Transitions

- Botones: `transition-all duration-150`
- Cards: `transition-all duration-200`
- Hover lift: `transition: box-shadow 0.2s ease`
- Tab changes: `transition-colors duration-150`
- Active scale: `active:scale-[0.98]` (botones), `active:scale-95` (FAB, icon buttons)

### Reduccion de Movimiento

```css
@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
```

---

## Accesibilidad (A11y)

### Focus Visible

```css
input:focus-visible, select:focus-visible, button:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.35);
}
```

Botones custom: `focus:ring-2 focus:ring-offset-1 focus:ring-{color}-500/30`

### Patrones ARIA

- Modales: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, `aria-describedby`
- Dropdowns: `aria-haspopup="menu"`, `aria-expanded`
- Tooltips: `role="button"`, `aria-label="Informacion sobre X"`, `aria-expanded`
- Loading: `role="status"`, `aria-live="polite"`
- Status dots: `role="status"`, `aria-label` con texto del estado
- Filtros: `aria-label` en cada select/input
- Todos los `IconButton` requieren `aria-label` obligatorio

### Focus Trap

Hook `useFocusTrap` aplicado en modales para mantener navegacion Tab dentro del dialogo.

---

## Patrones de Impresion

```css
@media print {
  .no-print { display: none; }
  -webkit-print-color-adjust: exact;
}
```

Todos los toolbars tienen clase `no-print`.

---

## Resumen Rapido: Clases Mas Reutilizadas

```
/* Fondo de app */        bg-slate-50
/* Fondo de panel */      bg-white
/* Borde sutil */         border border-gray-200 o border-slate-200/60
/* Texto principal */     text-slate-800 o text-slate-900
/* Texto secundario */    text-gray-500 o text-slate-500
/* Texto minimo */        text-gray-400 o text-slate-400
/* Primary action */      bg-blue-600 text-white hover:bg-blue-700
/* Secondary action */    bg-slate-100 text-slate-700 hover:bg-slate-200
/* Danger action */       bg-red-600 text-white hover:bg-red-700
/* Success feedback */    bg-emerald-50 text-emerald-700
/* Warning feedback */    bg-amber-50 text-amber-700
/* Error state input */   border-red-500 bg-red-50
/* Disabled */            opacity-50 cursor-not-allowed o disabled:opacity-70
/* Rounded default */     rounded-lg
/* Shadow sutil */        shadow-sm
/* Shadow interaccion */  shadow-md, shadow-xl (modales)
```
