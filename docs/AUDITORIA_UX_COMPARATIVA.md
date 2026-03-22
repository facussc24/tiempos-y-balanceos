# Auditoría UX Comparativa: Barack Mercosul vs AIAG CTS y Competidores

**Fecha**: 2026-03-21
**Metodología**: 7 agentes en 3 capas (investigación → análisis cruzado → consolidación)
**Alcance**: Benchmark visual y funcional contra AIAG CTS, Relyence FMEA, APIS IQ-FMEA, Omnex AQuA Pro, DataLyzer, XFMEA, ETQ Reliance, Plex QMS

---

## 1. RESUMEN EJECUTIVO

**La app tiene funcionalidad de nivel profesional pero presentación de prototipo.** Las 6 ventajas competitivas (familias maestro→variante, validación cascade APQP, vinculación viva PFD↔AMFE↔CP↔HO, templates, control de versiones visual, draft recovery) igualan o superan a competidores establecidos del mercado. Los 8 gaps críticos son todos de experiencia de usuario y presentación visual, no de funcionalidad core. Cerrar los quick wins (4-6 semanas) transformaría la percepción de "herramienta interna funcional" a "producto profesional competitivo".

---

## 2. BENCHMARK VISUAL — AIAG CTS Y COMPETIDORES

### 2.1 AIAG CTS (Core Tools Support)

- **Navegación**: Jerarquía Part → Project → CTS View. Pestañas separadas: Operations, Process Characteristics, Product Characteristics. Templates por dropdown. "My To Do List" integrado.
- **Problemas reconocidos** (Elsmar Forum): "No es intuitivo en absoluto", columnas CP no coinciden con manual APQP, datos no fluyen auto de PARTS a PROJECTS, documentación inexistente al lanzamiento.
- **Enterprise CORE (reemplazo mid-2026)**: Program Tree interactivo, breadcrumb navigation, paneles colapsables/reordenables, multi-edit mode con row-level locks, mejor gestión de columnas (pin, hide, filter).
- Fuente: https://elsmar.com/elsmarqualityforum/threads/i-have-just-purchased-the-all-new-core-tools-software-cts-from-aiag.75683/

### 2.2 Relyence FMEA — Mejor documentada visualmente

- **Layout 3 secciones**: Analysis Tree (izquierda) + Pestañas (centro) + Toolbar superior.
- **Color coding distintivo**: Verde=Functions, Azul=Failure Modes, Amarillo=Effects, Rojo=Causes, Púrpura=Actions.
- **Dashboard drag & drop**: Criticality Matrix, RPN Breakdown (pie), Risk Matrix 2D/3D, Top 10 RPN, Gauges de completamiento.
- **Columnas customizables**: Seleccionar, reordenar, renombrar, rotar headers 90°.
- Fuentes: https://relyence.com/help/user-guide/getting-started-fmea.html | https://relyence.com/products/fmea/dashboard/

### 2.3 APIS IQ-FMEA — Más potente y complejo

- Estándar en industria automotriz alemana. Software de escritorio orientado a objetos.
- **25+ editores**: Structure Tree, Function Nets, Failure Nets, FMEA Form Sheet (multi-layout AIAG/VDA/MIL), Statistics, Action Tracking, Ishikawa.
- **Structure Editor**: Árbol plegable con "Make focus" (Ctrl+K).
- Ahora parte de PeakAvenue junto con PLATO e1ns.
- Fuente: https://www.apis.de/en/software/products/function-overview

### 2.4 Omnex AQuA Pro — Más completa en APQP

- **Doble modo**: Interfaces tabulares Y gráficas para FMEA.
- **Herramientas de diagramas**: Block/Boundary Diagram, P-Diagram, Interface Matrix, Correlation Matrix, Function Net, Failure Net.
- **Dashboard BI real-time**: Heat maps, KPIs, trend analysis.
- **Links dinámicos**: FMEA ↔ Process Flow ↔ Control Plan ↔ Check Sheets ↔ Work Instructions.
- **AI FMEA Bot integrado**.
- Fuente: https://www.omnexsystems.com/aiag-vda-fmea-software

### 2.5 Otros competidores

| Software | Fortaleza principal | Fuente |
|----------|-------------------|--------|
| **DataLyzer** | WYSIWYG, columnas personalizables, linkage auto PF↔FMEA↔CP | https://datalyzer.com/fmeavideo/ |
| **ReliaSoft XFMEA** | Layout 2 paneles, worksheet tipo spreadsheet, tabulación como Excel | https://help.reliasoft.com/xfmea_rcm21/content/fmea_worksheet_view.htm |
| **ETQ Reliance** | Web-based Angular, responsive, FMEA+CP alineados con BOM | https://www.etq.com/ |
| **Plex QMS** | Cloud-native (Rockwell), flujo auto FMEA→CP, checksheets digitales | https://plex.rockwellautomation.com/ |
| **FMEA Studio** | Interfaz limpia para PyMEs | https://www.iqasystem.com/support/fmea-studio/ |

### 2.6 Patrones de diseño universales (todos los competidores los usan)

| Patrón | Descripción | Quién lo hace mejor |
|--------|-------------|-------------------|
| Layout 2-3 paneles | Árbol izquierda + workspace derecha | Relyence, XFMEA, APIS |
| Color coding por tipo | Funciones/Fallas/Efectos/Causas en colores distintos | Relyence |
| Doble vista tabla/formulario | Alternar entre spreadsheet y registro individual | Relyence, XFMEA, APIS |
| Dashboard drag & drop | Widgets: pie charts RPN, Risk Matrix, gauges | Relyence, Omnex |
| Linkage PFD↔FMEA↔CP | Vinculación relacional entre los 3 documentos | DataLyzer, Omnex |
| Breadcrumb navigation | Ruta visible: Program > Part > Document | Enterprise CORE |
| Column pin/hide/filter | Manejo de tablas anchas (20+ columnas) | Relyence, Enterprise CORE |
| Headers rotados 90° | Condensar ancho de columnas numéricas | Relyence |

---

## 3. GAP ANALYSIS — TABLA COMPARATIVA COMPLETA

### 3.1 Navegación y Layout

| Feature | AIAG CTS / Competidores | Nuestra App | Gap | Clasificación | Esfuerzo |
|---------|-------------------------|-------------|-----|---------------|----------|
| Breadcrumb navigation | Todos lo tienen. Enterprise CORE lo confirma como prioridad. | No hay breadcrumbs. Se pierde contexto. | GRANDE | **CRÍTICO** | BAJO (2-3 días) |
| Sidebar / menú global | Relyence: Analysis Tree. APIS: Structure Editor. Omnex: nav lateral. | No existe. Hay que volver al landing para cambiar módulo. | GRANDE | **CRÍTICO** | MEDIO (5-7 días) |
| Layout multi-panel | Patrón universal: árbol izq + contenido centro + propiedades der. | Single-panel. PFD desperdicia 70% del ancho. | MEDIO | IMPORTANTE | ALTO (2-3 semanas) |
| Árbol de proyecto interactivo | Enterprise CORE, Relyence, APIS: todos tienen. | No existe. Docs se acceden desde tabla plana. | MEDIO | IMPORTANTE | MEDIO (5-7 días) |
| Paneles colapsables/reordenables | Enterprise CORE confirmado. Relyence dashboard drag-and-drop. | Layout fijo en todas las vistas. | BAJO | NICE-TO-HAVE | ALTO (2+ semanas) |

### 3.2 Tablas y Datos

| Feature | AIAG CTS / Competidores | Nuestra App | Gap | Clasificación | Esfuerzo |
|---------|-------------------------|-------------|-----|---------------|----------|
| Sticky headers horizontal | Expectativa básica universal. | Headers no sticky en scroll horizontal AMFE. | GRANDE | **CRÍTICO** | BAJO (1-2 días) |
| Color coding por tipo de dato | Relyence: verde/azul/amarillo/rojo/púrpura por tipo. | Sin color coding por tipo. Todo el mismo color. | GRANDE | **CRÍTICO** | BAJO (2-3 días) |
| Column pin/hide/reorder | Relyence, DataLyzer, Enterprise CORE: estándar. | No existe. Columnas fijas. Hook `useAmfeColumnVisibility` existe pero sin UI. | MEDIO | IMPORTANTE | MEDIO (5-7 días) |
| Doble vista tabla + formulario | Omnex, APIS, DataLyzer lo ofrecen. | Solo vista tabla. | MEDIO | IMPORTANTE | MEDIO (5-7 días) |
| Texto truncado con expansión | Competidores: tooltips, celdas expandibles, paneles detalle. | Texto truncado en AMFE y PFD sin forma fácil de ver completo. | MEDIO | IMPORTANTE | BAJO (2-3 días) |
| Headers rotados 90° | Relyence lo soporta. | No hay. Columnas numéricas con headers truncados. | BAJO | NICE-TO-HAVE | BAJO (1 día) |
| Filtro avanzado y búsqueda global | Relyence, DataLyzer: filtros por columna, búsqueda global. | Filtros básicos en AMFE. Sin búsqueda global dentro de doc. | BAJO | NICE-TO-HAVE | MEDIO (3-5 días) |
| Botón agregar que no tape contenido | Competidores: toolbars fijos separados. | Botón agregar AMFE tapa últimas filas. | MEDIO | IMPORTANTE | BAJO (1-2 días) |

### 3.3 Dashboard y Métricas

| Feature | AIAG CTS / Competidores | Nuestra App | Gap | Clasificación | Esfuerzo |
|---------|-------------------------|-------------|-----|---------------|----------|
| Dashboard con widgets/métricas | Relyence: drag-and-drop. Omnex: BI real-time. | No existe dashboard de métricas. Landing = tabla + docs recientes. | GRANDE | **CRÍTICO** | ALTO (2-3 semanas) |
| Criticality Matrix / Heat Map | Relyence: matriz S×O con color. LA visualización signature de FMEA. | No existe. Valores de riesgo solo en tabla. | GRANDE | **CRÍTICO** | MEDIO (5-7 días) |
| Progreso APQP consolidado | Tracking de completitud por fase. | Existe en CP individual. Sin vista consolidada por proyecto. | MEDIO | IMPORTANTE | MEDIO (3-5 días) |
| Top RPN / Top riesgos | Relyence: Top 10 RPN widget. Omnex: alertas riesgos críticos. | No existe vista consolidada de riesgos altos. | MEDIO | IMPORTANTE | BAJO (2-3 días) |
| Gauges / indicadores visuales | Relyence: zonas roja/amarilla/verde. | No existen. Estado solo numérico en tablas. | BAJO | NICE-TO-HAVE | MEDIO (3-5 días) |

### 3.4 Documentos APQP

| Feature | AIAG CTS / Competidores | Nuestra App | Gap | Clasificación | Esfuerzo |
|---------|-------------------------|-------------|-----|---------------|----------|
| Vinculación viva PFD↔AMFE↔CP↔HO | Omnex, DataLyzer: linkage. AIAG CTS: problemas reconocidos. | ✅ Bidireccional + validaciones cruzadas + alertas cascade. | SIN GAP | **VENTAJA NUESTRA** | — |
| Templates precargados | Todos ofrecen templates. | ✅ 30+ templates AMFE/CP/HO precargados con 6M. | SIN GAP | **VENTAJA NUESTRA** | — |
| PFD layout optimizado | Layouts horizontales o mixtos que aprovechan ancho. | Vertical estricto. 70% ancho desperdiciado. Nombres truncados. | GRANDE | **CRÍTICO** | MEDIO (5-7 días) |
| Block/Boundary Diagram | Omnex, APIS: integrados. | No existe. | MEDIO | NICE-TO-HAVE | ALTO (3+ semanas) |
| P-Diagram | Omnex: integrado. | No existe. | BAJO | NICE-TO-HAVE | ALTO (2+ semanas) |

### 3.5 Colaboración y Workflow

| Feature | AIAG CTS / Competidores | Nuestra App | Gap | Clasificación | Esfuerzo |
|---------|-------------------------|-------------|-----|---------------|----------|
| My To Do List | AIAG CTS: integrado. Competidores: asignación por usuario. | ❌ No existe. | MEDIO | IMPORTANTE | MEDIO (5-7 días) |
| Multi-edit con row-level locks | Enterprise CORE: confirmado. | Session lock a nivel documento completo. | MEDIO | IMPORTANTE | ALTO (2-3 semanas) |
| Historial granular por campo | Competidores: qué campo cambió, valor anterior/nuevo, quién, cuándo. | ⚠️ Snapshots + timeline + diff + restore. Sin granularidad por campo. | MEDIO | IMPORTANTE | MEDIO (5-7 días) |
| Notificaciones de cambios | Alertas in-app o email cuando doc modificado por otro. | No existe. | MEDIO | IMPORTANTE | MEDIO (5-7 días) |
| Acciones correctivas con seguimiento | Omnex, Relyence: asignables con fecha, estado, tracking. | Acciones en tabla AMFE sin workflow de cierre. | MEDIO | IMPORTANTE | MEDIO (5-7 días) |

### 3.6 Visual y Branding

| Feature | AIAG CTS / Competidores | Nuestra App | Gap | Clasificación | Esfuerzo |
|---------|-------------------------|-------------|-----|---------------|----------|
| Consistencia visual / design system | Todos tienen tema único y consistente. | 3-4 temas coexisten (oscuro, claro verde, claro azul, claro teal). | GRANDE | **CRÍTICO** | MEDIO (5-7 días) |
| Deep linking / URL routing | Competidores: URL cambia al navegar, se puede compartir link a documento específico. | URL queda en `#menu` siempre. No hay deep linking. No se puede compartir ni bookmarkear un doc. | GRANDE | **CRÍTICO** | MEDIO (5-7 días) |
| Tooltips informativos | Competidores explican cada indicador con tooltips. | "AP=H" sin tooltip. Botones sin label. | MEDIO | IMPORTANTE | BAJO (1-2 días) |
| Botones de acción adecuados | Botones prominentes con iconos + texto. | Botones export pequeños. Toolbar Solicitudes con 14+ botones. | MEDIO | IMPORTANTE | BAJO (2-3 días) |

### 3.7 Resumen cuantitativo

| Clasificación | Cantidad | Detalle |
|---------------|----------|---------|
| **CRÍTICO** | 9 | Breadcrumbs, sidebar, sticky headers, color coding, dashboard, criticality matrix, PFD layout, consistencia visual, deep linking/URL routing |
| **IMPORTANTE** | 15 | Layout multi-panel, árbol proyecto, column pin/hide, doble vista, texto truncado, botón agregar, progreso APQP, top RPN, to-do list, historial granular, notificaciones, acciones correctivas, tooltips, botones acción, iconografía |
| **NICE-TO-HAVE** | 8 | Paneles reordenables, headers rotados, filtro avanzado, gauges, block diagram, P-diagram, correlation matrix, multi-layout FMEA |
| **VENTAJA NUESTRA** | 6 | Familias maestro→variante, validación cascade, vinculación viva, draft recovery, control versiones visual, templates |

---

## 4. TOP 10 MEJORAS UX — Priorizadas por impacto × facilidad

### #1. Header AMFE/CP colapsado por defecto
- **Problema**: Header ocupa ~40% de pantalla expandido
- **Cambio**: El mecanismo de collapse ya existe (`headerCollapsed` + `onToggleCollapsed`). Cambiar estado inicial a `true`
- **Archivo**: `src/modules/amfe/AmfeApp.tsx` — cambiar `headerCollapsed` de `false` a `true`
- **Esfuerzo**: 0.5 horas | **Impacto**: Alto

### #2. Toolbar Solicitudes: agrupar en menú overflow
- **Problema**: 14+ botones en una fila horizontal abruman
- **Cambio**: Mantener 4-5 acciones primarias visibles (Inicio, Nueva, Guardar, PDF, Excel). Mover resto a menú "Más opciones" — patrón idéntico al que ya usa `AmfeToolbar`
- **Archivo**: `src/modules/solicitud/SolicitudToolbar.tsx`
- **Esfuerzo**: 2 horas | **Impacto**: Alto

### #3. Sidebar global colapsable
- **Problema**: No hay menú global. Para cambiar módulo hay que volver al landing
- **Cambio**: Sidebar izquierdo colapsable (48px colapsado con iconos, 240px expandido con iconos + labels). Lista todos los módulos con click directo
- **Archivos**: Crear `src/components/layout/AppSidebar.tsx` + integrar en `AppRouter.tsx`
- **Esfuerzo**: 6 horas | **Impacto**: Alto

```
COLAPSADO (48px):              EXPANDIDO (240px):
+----+                         +-----------------------------+
| [] | <- PFD                  | [] Diagrama de Flujo        |
| [] | <- AMFE                 | [] AMFE VDA                 |
| [] | <- CP                   | [] Plan de Control          |
| [] | <- HO                   | [] Hojas de Operaciones     |
|----|                         |-----------------------------|
| [] | <- T&B                  | [] Tiempos y Balanceos      |
| [] | <- Solicitudes          | [] Solicitudes              |
|----|                         |-----------------------------|
| [] | <- Admin                | [] Administración           |
| [] | <- Home                 | [] Inicio                   |
+----+                         +-----------------------------+
```

### #4. Breadcrumbs activos
- **Problema**: Componente `Breadcrumb.tsx` ya existe en `components/navigation/` pero no se usa
- **Cambio**: Integrar debajo de AmfeTabBar y cada toolbar. Mostrar: `Inicio > [Cliente] > [Familia] > [Módulo]`
- **Archivos**: `src/modules/amfe/AmfeApp.tsx`, `src/modules/solicitud/SolicitudApp.tsx`
- **Esfuerzo**: 2 horas | **Impacto**: Medio

### #5. Tooltips en todos los iconos sin label
- **Problema**: Botones de export, undo/redo, copy usan solo iconos sin texto
- **Cambio**: Agregar atributo `title` a todos los botones icon-only
- **Archivos**: `SolicitudToolbar.tsx`, `ProjectTable.tsx`, `AdminPanel.tsx`
- **Esfuerzo**: 1 hora | **Impacto**: Medio

### #6. Toggle de columnas AMFE visible
- **Problema**: Hook `useAmfeColumnVisibility` ya existe con 6 grupos, labels, colores y tooltips. Pero la UI no es accesible
- **Cambio**: Barra de chips toggleables encima de tabla: `[P2:Estructura ✓] [P3:Funciones ✓] [P4:Fallas ✓] [P5:Riesgo ✓] [P6:Optim. ✗] [Obs ✗]`
- **Archivo**: `src/modules/amfe/AmfeApp.tsx` o `AmfeFilters.tsx`
- **Esfuerzo**: 3 horas | **Impacto**: Alto

### #7. Landing tema claro unificado
- **Problema**: Landing usa tema oscuro (`from-slate-900`) mientras módulos usan fondo claro. Parece apps separadas
- **Cambio**: Migrar Landing a `bg-slate-50`. Mantener acentos azul. Textos de blanco a slate-800
- **Archivos**: `LandingPage.tsx`, `ProjectTable.tsx`, `HeroSection.tsx`
- **Esfuerzo**: 4 horas | **Impacto**: Medio

### #8. PFD cards más anchas y sin truncamiento
- **Problema**: Layout vertical desperdicia 70% ancho. Nombres de pasos truncados
- **Cambio**: Ensanchar cards a `max-w-lg`, usar `whitespace-normal` en vez de `truncate`
- **Archivos**: `src/modules/pfd/PfdFlowEditor.tsx`, `PfdFlowMap.tsx`
- **Esfuerzo**: 2 horas | **Impacto**: Medio

### #9. Paginación Hub de Documentos
- **Problema**: 62 docs ok, pero sin paginación escala mal
- **Cambio**: Paginación simple 25 docs/página con controles prev/next
- **Archivo**: `src/modules/registry/DocumentHub.tsx`
- **Esfuerzo**: 3 horas | **Impacto**: Medio

### #10. Sticky headers horizontal AMFE
- **Problema**: Al scrollear horizontalmente se pierde referencia de columnas
- **Cambio**: Mejorar contraste visual de headers de grupo y asegurar sticky-left en columnas clave
- **Archivos**: `src/modules/amfe/StickyColumnHeader.tsx`, `index.css`
- **Esfuerzo**: 2 horas | **Impacto**: Medio

### Resumen de esfuerzos

| # | Mejora | Impacto | Esfuerzo | Ratio |
|---|--------|---------|----------|-------|
| 1 | Header colapsado por defecto | Alto | 0.5h | ★★★★★ |
| 2 | Solicitudes toolbar overflow | Alto | 2h | ★★★★★ |
| 5 | Tooltips en iconos | Medio | 1h | ★★★★★ |
| 3 | Sidebar global colapsable | Alto | 6h | ★★★☆☆ |
| 6 | Toggle columnas AMFE | Alto | 3h | ★★★☆☆ |
| 4 | Breadcrumbs activos | Medio | 2h | ★★★☆☆ |
| 8 | PFD cards más anchas | Medio | 2h | ★★★☆☆ |
| 10 | Sticky headers horizontal | Medio | 2h | ★★★☆☆ |
| 7 | Landing tema claro | Medio | 4h | ★★☆☆☆ |
| 9 | Paginación Hub | Medio | 3h | ★★☆☆☆ |

**Total**: ~25.5 horas

---

## 5. FEATURES FALTANTES — Evaluación detallada

### 5.1 My To Do List (panel de tareas pendientes por usuario)

- **Estado**: ❌ No implementado
- **Qué existe**: `Dashboard.tsx` (buscador de proyectos), `TaskManager.tsx` (tareas de balanceo de línea — otro contexto)
- **Qué falta**: Widget "Mis Tareas Pendientes" en landing, notificaciones de tareas vencidas, asignación por usuario
- **Valor**: Alto — los ingenieros necesitan saber "¿qué me falta hacer?" al abrir la app
- **Esfuerzo**: Medio (5-7 días)
- **Implementación sugerida**: Panel en landing con items como "AMFE Headrest Front: faltan 3 acciones correctivas por cerrar", "CP Armrest: completitud 85% — revisar items sin plan de reacción"

### 5.2 Historial visual de cambios (granular por campo)

- **Estado**: ⚠️ Parcialmente implementado
- **Qué existe**: `RevisionHistory.tsx` (snapshots completos), `RevisionHistoryPanel.tsx` (timeline con badges Rev.A/B/C, diff entre versiones, restore), `revisionRepository.ts` (snapshots con checksum)
- **Qué falta**: Trazabilidad a nivel campo individual (qué campo cambió, valor anterior → nuevo, quién, cuándo). El diff actual compara JSONs completos pero no muestra granularidad
- **Valor**: Medio-Alto — requerido para auditorías IATF 16949
- **Esfuerzo**: Medio (5-7 días)

### 5.3 Plantillas precargadas

- **Estado**: ✅ Completamente implementado
- **Qué existe**: `AmfeTemplatesModal.tsx` (4 categorías: fabrication, assembly, finishing, inspection), `amfeTemplates.ts` (30+ templates tipados), `CpTemplateModal.tsx`, `controlPlanTemplates.ts`, `hojaOperacionesPatagoniaTemplate.ts`, `pfdTemplates.ts`
- **Flujo**: Modal → seleccionar template → se aplica con datos pre-armados → usuario edita S/O/D
- **Ventaja vs competidores**: Nuestros templates incluyen datos reales de producción VWA/PWA

### 5.4 Control de versiones visual

- **Estado**: ✅ Completamente implementado
- **Qué existe**: Snapshots JSON por revisión, timeline visual collapsible (badges Rev.A/B/C con colores), botón "Ver" (preview snapshot), botón "Comparar" (diff entre versiones), capacidad de restore completo
- **Archivos**: `RevisionHistoryPanel.tsx`, `RevisionHistory.tsx`, `revisionRepository.ts`, `revisionUtils.ts`
- **Ventaja**: Pocos competidores tienen interfaz de timeline tan visual con diff + restore integrado

### 5.5 Vinculación viva entre documentos

- **Estado**: ✅ Completamente implementado
- **Qué existe**:
  - PFD ↔ AMFE: `pfdAmfeLinkValidation.ts` + `LinkValidationPanel.tsx` (validación bidireccional, re-link candidates)
  - HO ↔ CP: `hoCpLinkValidation.ts` + `HoCpLinkValidationPanel.tsx`
  - Panel LinkedDocuments: `LinkedDocumentsPanel.tsx` (muestra docs vinculados con conteo y links directos)
  - Cascade alerts: `crossDocumentAlerts.ts` + `CrossDocAlertBanner.tsx` (alerta cuando cambios en un doc afectan otros)
  - Importación: `amfePfdImport.ts` (PFD → AMFE), `pfdGenerationWizard.ts` (AMFE → PFD)
- **Ventaja competitiva clara**: AIAG CTS tiene problemas reconocidos con flujo de datos. Nuestra implementación es superior

---

## 6. QUICK WINS — Mejoras en menos de 1 hora cada una

| # | Mejora | Archivo | Tiempo | Impacto |
|---|--------|---------|--------|---------|
| 1 | **Header AMFE colapsado por defecto** — cambiar `headerCollapsed` initial state a `true` | `AmfeApp.tsx` | 15 min | La tabla gana ~35% de espacio vertical |
| 2 | **Tooltips en botones icon-only** — agregar `title` attribute a todos los botones sin label | `SolicitudToolbar.tsx`, `ProjectTable.tsx` | 30 min | Usuarios nuevos entienden qué hace cada botón |
| 3 | **Tooltip en "AP=H"** — agregar tooltip "Action Priority = High" en columna de tabla de proyectos | `ProjectTable.tsx` | 10 min | Elimina confusión para usuarios nuevos |
| 4 | **PFD nombres sin truncar** — cambiar `truncate` a `whitespace-normal` en cards de paso | `PfdFlowEditor.tsx` | 15 min | Nombres de pasos completamente legibles |
| 5 | **Sección Ayudas Visuales colapsada cuando vacía** — condicional en HO | `HojaOperacionSheet.tsx` | 20 min | No desperdiciar espacio cuando no hay imágenes |
| 6 | **Labels en iconos de seguridad PPE** — agregar texto debajo de iconos | `HojaOperacionSheet.tsx` | 20 min | Operarios nuevos identifican PPE requerido |

**Total quick wins**: ~2 horas para 6 mejoras inmediatas

---

## 7. RECOMENDACIÓN GENERAL — Por dónde empezar

### Fase 1: Quick Wins Críticos (Día 1-2, ~6h)
Implementar mejoras 1, 2, 5 del Top 10 + los 6 quick wins. Resultado: la app se siente más pulida sin cambios estructurales.

### Fase 2: Navegación Profesional (Día 3-5, ~10h)
Implementar mejoras 3 (sidebar), 4 (breadcrumbs), 6 (toggle columnas AMFE). Resultado: navegación comparable a competidores.

### Fase 3: Identidad Visual (Día 6-8, ~8h)
Implementar mejoras 7 (landing tema claro), 8 (PFD cards anchas), 10 (sticky headers). Resultado: consistencia visual, se siente como UN producto.

### Fase 4: Dashboard y Métricas (Semana 3-4, ~2-3 semanas)
Dashboard con Criticality Matrix, Top RPN, progreso APQP consolidado. Resultado: la app deja de ser solo un editor de documentos y se convierte en una herramienta de análisis de riesgo.

### Fase 5: Colaboración (Semana 5+)
My To Do List, historial granular por campo, notificaciones. Resultado: la app soporta equipos de trabajo reales.

### Conclusión

**No necesitamos rediseñar la app.** La funcionalidad core es sólida y en varios aspectos superior a competidores establecidos. Lo que necesitamos es:
1. **Unificar la presentación** (3-4 temas → 1 design system)
2. **Mejorar la navegación** (breadcrumbs + sidebar)
3. **Hacer las tablas más manejables** (toggle columnas + sticky headers + color coding)
4. **Agregar visualizaciones de riesgo** (criticality matrix, top RPN)

Estas 4 líneas de trabajo, ejecutadas en orden, transforman la percepción de la app de "herramienta interna funcional" a "producto profesional que compite con AIAG CTS y Relyence".

---

*Auditoría generada el 2026-03-21 con 7 agentes en 3 capas de análisis.*
*Fuentes: AIAG CTS (Elsmar Forum), Relyence, APIS IQ-FMEA, Omnex AQuA Pro, DataLyzer, XFMEA, ETQ, Plex QMS.*
