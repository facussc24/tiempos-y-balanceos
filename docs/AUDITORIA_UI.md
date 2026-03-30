# Auditoria UI - Pulido Visual y Consistencia

**Fecha:** 2026-03-29
**Referencia visual:** AMFE VDA (modulo mas pulido)

## Resumen

Recorrido completo de todos los modulos de la app buscando inconsistencias visuales.
AMFE se uso como referencia del design system. No se toco logica de negocio.

## Cambios realizados

### 1. Admin Panel: tema oscuro → tema claro (IMPACTO ALTO)

**Problema:** El Admin Panel era el unico modulo con tema oscuro (bg-slate-900, text-white, bordes con opacity). Completamente fuera del design system del resto de la app.

**Solucion:**
- Fondo: `bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900` → `bg-slate-50`
- Textos: `text-white` / `text-slate-400` → `text-slate-800` / `text-slate-500`
- Botones: `bg-violet-600` → `bg-blue-600` (design system)
- Tabla: overlays transparentes → `bg-white shadow-sm border border-slate-200/60`
- Badges: dark-mode opacity → light-mode con borders (emerald, blue, slate)
- Inputs: `bg-white/5` oscuro → `bg-gray-50 border border-gray-300`
- Banners error/success: overlays oscuros → `bg-red-50`/`bg-emerald-50`

**Archivo:** `modules/admin/AdminPanel.tsx`

### 2. Tiempos y Balanceos: purpura → azul (IMPACTO ALTO)

**Problema:** El modulo de Tiempos usaba purpura/violet como color primario en vez de azul, creando una desconexion visual con el resto de la app.

**Solucion en CSS (index.css):**
- `.gradient-text`: blue→purple→pink → `blue→cyan`
- `.hero-cta`: blue→purple → `blue→blue`
- `.shadow-glow`: blue/purple glow → blue/cyan glow
- `.welcome-gradient`: blue/purple/pink → blue/cyan/sky

**Solucion en componentes:**
- `HeroSection.tsx`: icono gradient purple→pink → `blue→sky`, dot purple → sky
- `Dashboard.tsx`: floating bar purple→indigo → blue, checkboxes purple → blue
- `PanelControl.tsx`: toggle OEE purple → blue

### 3. Purple/violet → blue en 11+ archivos (IMPACTO MEDIO)

**Problema:** Multiples archivos usaban purple-600/violet-600 para botones de accion primaria y headers de modales.

**Archivos corregidos:**
- `FamilyManager.tsx` — botones purple → blue
- `AmfeLibraryPanel.tsx` — tabs activos y boton guardar purple → blue
- `CreateVariantModal.tsx` — header gradient y submit button → blue solido
- `HeijunkaBox.tsx` — header gradient purple → blue solido
- `BalancingMetrics.tsx` — progress bar y boton optimize → blue
- `TaskTable.tsx` — toggle inyeccion purple → blue
- `MixCascadeKPIs.tsx` — boton Heijunka purple → blue
- `DataManager.tsx` — boton export violet → blue
- `TaskMaterialsModal.tsx` — header gradient → blue solido
- `SectorManagementModal.tsx` — header gradient → blue solido
- `HeijunkaTaskList.tsx` — header indigo→purple → blue solido
- `MixModeView.tsx` — header y boton calcular gradients → blue solido
- `EmptyState.tsx` — boton primario gradient → blue solido

### 4. Plan de Control: borde Aprobaciones (IMPACTO BAJO)

**Problema:** La seccion "Aprobaciones" tenia un borde izquierdo teal (`border-teal-300`) que se destacaba del estilo neutral del resto del formulario.

**Solucion:** `border-teal-300` → `border-slate-300`

**Archivo:** `modules/controlPlan/CpToolbar.tsx`

### 5. CP Template Modal: header purpura (IMPACTO BAJO)

**Problema:** El modal de templates del CP usaba un gradiente purple→violet en su header.

**Solucion:** `bg-gradient-to-r from-purple-50 to-violet-50` → `bg-slate-50`, icono purple → blue

**Archivo:** `modules/controlPlan/CpTemplateModal.tsx`

## Modulos auditados sin cambios necesarios

| Modulo | Estado | Notas |
|--------|--------|-------|
| Landing Page | OK | Layout limpio, cards bien color-coded, tabla consistente |
| AMFE VDA | OK (referencia) | Estandar visual de la app |
| Plan de Control | Corregido | Solo borde Aprobaciones y template modal |
| Hojas de Operaciones | OK | Navy theme intencional, formulario corporativo correcto |
| PFD | OK | Cyan theme intencional, layout consistente |

## Violet/purple intencional (NO cambiar)

- Landing page: cada card de Herramientas tiene un color unico (violet para Admin, rose para Datos, etc.) — esto es color-coding intencional
- AMFE: badges de familia usan indigo — identidad visual de familias
- Solicitud: badges de template usan violet — diferenciacion de tipos
- Mizusumashi: violet para configuracion de rutas — identidad de modulo secundario

## Design system final

| Elemento | Color |
|----------|-------|
| Botones primarios | `bg-blue-600 hover:bg-blue-700` |
| Botones secundarios | `bg-slate-100 text-slate-700 hover:bg-slate-200` |
| Headers de modal | `bg-blue-600 text-white` o `bg-slate-50` |
| Badges status | emerald (success), amber (warning), red (error), blue (info) |
| Fondo de pagina | `bg-slate-50` |
| Tablas | `bg-white shadow-sm border border-slate-200/60 rounded-xl` |
| Inputs | `border border-gray-300 bg-gray-50 focus:ring-blue-100 focus:border-blue-400` |
| Texto primario | `text-slate-800` |
| Texto secundario | `text-slate-500` |
| Labels | `text-xs font-bold text-slate-500` (o `text-gray-500`) |
