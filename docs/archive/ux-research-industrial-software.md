# Investigacion UX para Software Industrial de Calidad (QMS/ERP/MES)

> Fecha: 2026-03-21
> Proposito: Recomendaciones basadas en investigacion para mejorar la UX de Barack Mercosul
> Uso: Este reporte sera consumido por otro agente para proponer mejoras especificas

---

## 1. UX para Software Industrial (ERP/MES/QMS)

### Que hace diferente al software industrial del consumer

El software industrial se usa en contextos radicalmente distintos al software consumer:

- **Entorno fisico hostil**: Se usa en pisos de planta con kioscos, tablets con fundas protectoras, PCs industriales montados en maquinaria. No es un escritorio limpio con mouse y teclado.
- **Usuarios con guantes**: Los touch targets deben ser mucho mas grandes (minimo 44x44px, idealmente 48x48dp).
- **Interrupciones constantes**: Los operadores son interrumpidos frecuentemente. El software debe auto-guardar todo y facilitar retomar donde se dejo.
- **Conectividad variable**: Zonas de planta con mala senal WiFi. Capacidad offline es deseable.
- **Usuarios no-tecnicos**: Industria 4.0 requiere que maquinas complejas sean operadas por perfiles no especialistas debido a escasez de mano de obra calificada.
- **Cumplimiento normativo**: El software debe facilitar compliance (ISO, IATF, etc.), no complicarlo.
- **Datos criticos**: Errores de entrada de datos pueden tener consecuencias en calidad del producto.

### Patrones UX que funcionan en manufactura/calidad

1. **Minimizar entrada de texto**: Usar scanners, dropdowns, seleccion en vez de escritura libre.
2. **Operaciones en lote (batch)**: Permitir editar multiples registros simultaneamente.
3. **Shortcuts de teclado**: Para usuarios de oficina que trabajan con datos intensivos (ingenieros de calidad).
4. **Recordar preferencias**: Filtros, vistas, columnas visibles deben persistir entre sesiones.
5. **Onboarding contextual (Just-in-Time)**: Tooltips y walkthroughs que aparecen cuando el usuario intenta hacer una tarea especifica, no tutoriales genericos al inicio.
6. **Taxonomia consistente**: Crear un glosario estricto de terminos al inicio del proyecto. En APQP/FMEA esto es critico: "modo de falla", "causa", "efecto", "severidad", "ocurrencia", "deteccion" deben usarse consistentemente.
7. **Progressive disclosure**: Revelar complejidad gradualmente. Mostrar lo basico primero, permitir acceder a detalles avanzados bajo demanda. Esto reduce la curva de aprendizaje sin limitar a usuarios expertos.

### Errores comunes

- Aplicar patrones de apps consumer (animaciones excesivas, gamification) a contextos industriales.
- No considerar el entorno fisico (luz, guantes, pantallas sucias).
- Formularios demasiado largos sin division en pasos.
- No auto-guardar (perder datos por timeout o cierre accidental).
- Terminologia inconsistente entre pantallas.
- Navegacion profunda que requiere muchos clicks para tareas frecuentes.

### Fuentes
- [UX in Manufacturing: Designing Software That Works on the Factory Floor (Medium, 2026)](https://medium.com/@sihambouguern/ux-in-manufacturing-designing-software-that-works-on-the-factory-floor-86ba9f1e0afc)
- [Enterprise UX Design Guide 2026 (Fuselab Creative)](https://fuselabcreative.com/enterprise-ux-design-guide-2026-best-practices/)
- [UX in Manufacturing: Design for people, not just for machines (Emixa)](https://www.emixa.com/blog/ux-in-manufacturing-design-for-people-not-just-for-machines)
- [Enterprise UX Design in 2026: Challenges and Best Practices (Tenet)](https://www.wearetenet.com/blog/enterprise-ux-design)
- [Advancing UX Practices in Industrial Machine Design (MDPI)](https://www.mdpi.com/2071-1050/17/11/4771)
- [Progressive Disclosure (Nielsen Norman Group)](https://www.nngroup.com/articles/progressive-disclosure/)
- [What is Progressive Disclosure? (IxDF)](https://ixdf.org/literature/topics/progressive-disclosure)

---

## 2. Dashboards para Ingenieros de Planta

### Metricas clave para un dashboard APQP/FMEA

**Metricas de riesgo (FMEA):**
- **RPN (Risk Priority Number)**: S x O x D. Visualizar distribucion y top failure modes por RPN.
- **Cantidad de failure modes por nivel de riesgo**: Alto/Medio/Bajo con color coding (rojo/amarillo/verde).
- **Action items pendientes**: Total, por responsable, por fecha de vencimiento.
- **Action items vencidas**: Destacadas en rojo, con dias de atraso.
- **Tendencia de RPN**: Como evolucionan los RPNs despues de acciones correctivas.

**Metricas de progreso (APQP):**
- **Estado de documentos APQP**: Porcentaje completado por fase (Plan/Design/Process/Validation/Launch).
- **RAG status por documento**: Rojo/Ambar/Verde para cada documento del proyecto.
- **Dias restantes para target dates**: Con highlighting cuando estan cerca o vencidas.
- **Completitud de documentos vinculados**: Ej: "AMFE tiene 15 failure modes, CP cubre 12 de 15".

**Metricas de calidad:**
- **Validaciones cruzadas**: Estado de consistencia PFD-AMFE, AMFE-CP, HO-CP.
- **Coverage gaps**: Que procesos del PFD no estan cubiertos en AMFE o CP.

### Como organizar la informacion para que sea accionable

1. **Principio: Informacion > Datos**: No mostrar numeros sueltos. Mostrar numeros con contexto y accion sugerida.
2. **Top-down**: Dashboard general del proyecto arriba, drill-down a documentos especificos abajo.
3. **Highlight excepciones**: Lo que esta bien no necesita atencion. Resaltar lo que esta mal o en riesgo.
4. **Agrupar por urgencia**: "Requiere accion inmediata" vs "En seguimiento" vs "Completado".
5. **Links directos a accion**: Desde cada metrica, poder navegar al registro especifico que necesita atencion.

### Visualizaciones que funcionan mejor

| Tipo de dato | Visualizacion recomendada |
|---|---|
| RPN distribution | Bar chart horizontal (failure modes ordenados por RPN) |
| Risk levels | Donut/pie chart o badges con contadores |
| Progreso APQP | Progress bars por fase + porcentaje |
| Estado de documentos | Tabla con RAG status (circulos de color) |
| Action items | Lista con filtro por estado, responsable, fecha |
| Tendencia temporal | Line chart simple |
| Matriz de riesgo | Heatmap Severidad x Ocurrencia |
| Coverage | Diagrama de barras apiladas (cubierto vs no cubierto) |

### Software que lo hace bien
- **Relyence FMEA**: Dashboard con overdue actions, team members con items pendientes, metricas RPN, matrices de riesgo.
- **QA Assistant**: Dashboard reporting para FMEA y APQP con extraccion de datos de documentos y target completion dates.
- **Omnex FMEA**: Business intelligence dashboards con colaboracion en tiempo real.
- **Smart FMEA**: Vista de prioridad de tareas y estado de acciones.
- **TLM Software**: Dashboard que guia al usuario a donde necesita trabajar.

### Fuentes
- [Dashboard Reporting For FMEA & APQP (QA Assistant)](https://www.qaassistant.com/articles/APQP-FMEA-dashboard)
- [Relyence FMEA Software](https://relyence.com/products/fmea/)
- [FMEA Control Plan Software (TLM)](https://tlm-software.com/fmea-control-plan-software/)
- [Risk Priority Number in Six Sigma (6sigma.us)](https://www.6sigma.us/six-sigma-articles/risk-priority-number-rpn/)
- [Dashboard Design UX Patterns Best Practices (Pencil & Paper)](https://www.pencilandpaper.io/articles/ux-pattern-analysis-data-dashboards)
- [Smart FMEA Software](https://www.smart-quality-solution.com/smart-fmea-software/smart-fmea-software-en/)

---

## 3. Tablas Complejas con Muchas Columnas (FMEA 20+ columnas)

### Como hacer tablas enormes usables

El FMEA estandar AIAG-VDA tiene 20+ columnas. Este es uno de los mayores desafios UX del proyecto. Las mejores practicas son:

#### 3.1 Sticky Headers y Columnas Fijas

- **Header fijo siempre**: El header debe permanecer visible durante scroll vertical. Es absolutamente critico.
- **Primera columna fija**: En scroll horizontal, la columna izquierda (ej: "Proceso" o "Failure Mode") debe quedar anclada. Da contexto a todo lo demas.
- **Ultima columna fija (opcional)**: Si tiene totales o RPN, fijarla a la derecha.
- **Indicador de scroll**: Un gradiente sutil o flecha en el borde derecho de la tabla para indicar que hay mas contenido fuera de pantalla. Sin esto, los usuarios pueden no darse cuenta que la tabla se desplaza.

#### 3.2 Column Hiding (Ocultar Columnas)

- **Boton "Columnas"** encima de la tabla que abre un dropdown/panel con checkboxes para mostrar/ocultar columnas.
- **Persistir preferencias**: Las columnas visibles deben guardarse por usuario y recordarse entre sesiones.
- **Presets de columnas**: Ofrecer vistas predefinidas como "Vista rapida" (solo campos clave), "Vista completa" (todo), "Vista de riesgo" (S, O, D, RPN).
- **Drag-and-drop para reordenar**: Permitir que el usuario reorganice las columnas segun su preferencia.

#### 3.3 Agrupacion de Columnas

Para FMEA, las columnas naturalmente se agrupan:
- **Analisis de Proceso**: Step, Function, Requirements
- **Analisis de Falla**: Failure Mode, Effect, Severity
- **Analisis de Causa**: Cause, Occurrence, Current Controls
- **Deteccion**: Detection Method, Detection Rating
- **Evaluacion de Riesgo**: RPN/AP, Priority
- **Acciones**: Recommended Action, Responsible, Target Date, Status

Estas agrupaciones deben ser visualmente claras con:
- Headers de grupo (spanning headers) con color de fondo diferenciado.
- Posibilidad de colapsar/expandir grupos enteros de columnas.

#### 3.4 Inline Editing vs Modal Editing

**Usar inline editing cuando:**
- Se editan 1-2 campos simples (texto, numero, dropdown).
- El usuario necesita ver el contexto de filas vecinas.
- Es una edicion rapida y frecuente.
- Hay pocas columnas editables visibles.

**Usar modal/panel lateral cuando:**
- Se editan muchos campos de un registro (como un failure mode completo con 15+ campos).
- Los campos tienen validaciones complejas o dependencias entre si.
- Se necesita mas espacio para textareas largos o selectores complejos.
- El registro tiene relaciones con otros (ej: links a Control Plan).

**Recomendacion para FMEA de Barack Mercosul:**
- **Hibrido**: Inline editing para campos simples (severity, occurrence, detection, status) + panel lateral o modal para edicion completa del failure mode.
- **Click en fila** abre panel de detalle lateral (no modal que bloquea).
- **Double-click en celda** activa inline edit de ese campo especifico.

#### 3.5 Filtrado y Busqueda

- **Barra de busqueda global**: Busca en todos los campos de texto de la tabla.
- **Filtros por columna**: Dropdown en cada header de columna con opciones de filtro.
- **Filtros rapidos predefinidos**: "RPN > 100", "Actions vencidas", "Sin control de deteccion".
- **Indicador visual de filtros activos**: Badge o chip que muestre cuantos filtros estan aplicados.
- **Limpiar todos los filtros**: Un click para resetear.

#### 3.6 Como lo resuelven Airtable, Notion, Monday

| Feature | Airtable | Notion | Monday |
|---|---|---|---|
| Inline editing | Si, click en celda | Si, click en celda | Si, click en celda |
| Column hiding | Dropdown con checkboxes | Menu de columna | Configuracion de columnas |
| Column reordering | Drag & drop | Drag & drop | Drag & drop |
| Grouping | Hasta 3 niveles | Por propiedad | Por columna |
| Filtros | Potentes, multi-condicion | Filtros + sorts | Filtros visuales |
| Vistas guardadas | Si, multiples | Si, como "Views" | Si, como vistas |
| Row expansion | Panel lateral | Pagina completa | Panel lateral |
| Formulas/Calculos | Si, tipo spreadsheet | Basico | Formulas de columna |

**Patron comun**: Todas usan la combinacion de inline editing rapido + expansion de fila para detalle completo. La fila expandida muestra TODOS los campos en un layout de formulario limpio, mientras la tabla solo muestra las columnas seleccionadas.

### Fuentes
- [Data Table Design UX Patterns & Best Practices (Pencil & Paper)](https://www.pencilandpaper.io/articles/ux-pattern-analysis-enterprise-data-tables)
- [Enterprise UX: Essential Resources for Complex Data Tables (Stephanie Walter)](https://stephaniewalter.design/blog/essential-resources-design-complex-data-tables/)
- [How To Design Complex Data Tables (Smart Interface Design Patterns)](https://smart-interface-design-patterns.com/articles/complex-tables/)
- [Best Practices for Inline Editing in Table Design (UX Design World)](https://uxdworld.com/inline-editing-in-tables-design/)
- [6 Best Practices for Enterprise Table UX Design (Denovers)](https://www.denovers.com/blog/enterprise-table-ux-design)
- [Table Design UX Guide (Eleken)](https://www.eleken.co/blog-posts/table-design-ux)
- [Data Table Design Best Practices (LogRocket)](https://blog.logrocket.com/ux-design/data-table-design-best-practices/)
- [Sticky Table Headers + Columns (Flux UI)](https://fluxui.dev/blog/2025-10-08-sticky-tables)
- [Airtable Grid View Documentation](https://support.airtable.com/docs/airtable-grid-view)
- [Column Visibility Guide (MUI X Data Grid)](https://mui.com/x/react-data-grid/column-visibility/)
- [PatternFly Inline Edit Design Guidelines](https://www.patternfly.org/components/inline-edit/design-guidelines/)

---

## 4. Patrones de Navegacion para Apps con Datos Complejos

### Sidebar vs Top Nav vs Breadcrumbs

**No es una eleccion exclusiva. La mejor practica es combinarlos:**

| Componente | Funcion | Cuando usar |
|---|---|---|
| **Sidebar** | Navegacion primaria entre modulos | Siempre visible. Muestra los modulos principales (APQP, AMFE, CP, PFD, HO, Dashboard). |
| **Top bar** | Contexto + acciones globales | Mostrar familia/producto activo, usuario, notificaciones. |
| **Breadcrumbs** | Orientacion jerarquica | Mostrar la ruta: Proyecto > Familia > Documento > Seccion. |
| **Tabs** | Navegacion secundaria dentro de un modulo | Dentro de AMFE: "Worksheet" / "Summary" / "Actions". |

### Como indicar ubicacion y contexto

1. **Breadcrumbs jerarquicos**: `Proyecto X > Familia Headrest > AMFE Proceso > Step 20 - Soldadura`
2. **Sidebar con item activo resaltado**: Fondo diferente o borde lateral en el item seleccionado.
3. **Page title descriptivo**: No solo "AMFE" sino "AMFE - Headrest BARACK HMR (Maestro)".
4. **Badge de estado**: En el breadcrumb o title, mostrar si el documento esta "Draft", "In Review", "Approved".

### Como manejar relaciones entre entidades (AMFE - CP - PFD)

Este es un problema clave de Barack Mercosul. Las entidades estan interrelacionadas:
- PFD define procesos
- AMFE analiza fallas de esos procesos
- CP define controles para esos procesos/fallas
- HO detalla instrucciones de cada paso

**Patrones recomendados:**

1. **Links cruzados en contexto**: Dentro de un registro de AMFE, mostrar links clickeables a los controles CP relacionados y al paso de PFD correspondiente.
2. **Panel de relaciones**: Un panel lateral que muestre "Documentos relacionados" cuando se selecciona un registro.
3. **Validacion cruzada visual**: Badges o iconos que muestren el estado de consistencia (check verde = alineado, warning amarillo = desincronizado).
4. **Vista de trazabilidad**: Una vista tipo matriz que muestre como fluyen los datos entre PFD -> AMFE -> CP para verificar cobertura completa.
5. **Navegacion "ver en..."**: Boton/link "Ver en Control Plan" desde un failure mode del AMFE que lleve directamente al registro correspondiente en CP.

### Drill-down patterns

1. **Master-detail**: Lista de items a la izquierda, detalle a la derecha (o abajo en mobile).
2. **Click-to-expand rows**: Filas de tabla que se expanden para mostrar sub-datos inline.
3. **Panel lateral (flyout)**: Click en una fila abre un panel desde la derecha con detalle completo sin perder contexto de la tabla.
4. **Pagina de detalle**: Para edicion completa de un registro complejo (con boton "Back" claro).
5. **Zoom semantico**: Dashboard muestra KPIs -> click en KPI muestra lista de items -> click en item muestra detalle.

### Fuentes
- [Navigation UX Best Practices For SaaS Products (Pencil & Paper)](https://www.pencilandpaper.io/articles/ux-pattern-analysis-navigation)
- [Breadcrumbs UX Navigation - The Ultimate Design Guide (Pencil & Paper)](https://www.pencilandpaper.io/articles/breadcrumbs-ux)
- [UX Breadcrumbs in 2026 (Eleken)](https://www.eleken.co/blog-posts/breadcrumbs-ux)
- [Designing Effective Breadcrumbs Navigation (Smashing Magazine)](https://www.smashingmagazine.com/2022/04/breadcrumbs-ux-design/)
- [PatternFly Navigation Design Guidelines](https://www.patternfly.org/components/navigation/design-guidelines/)
- [All-time Visible Navigation (Medium - Enterprise UX)](https://medium.com/enterprise-ux/all-time-visible-navigation-f346d9320d52)
- [5 Enterprise UX Examples That Increase Flexibility (Pencil & Paper)](https://www.pencilandpaper.io/articles/enterprise-ux-patterns)
- [Top 7 Enterprise UX Design Patterns (Onething)](https://www.onething.design/post/top-7-enterprise-ux-design-patterns)

---

## 5. Dark Mode vs Light Mode en Contexto Industrial

### Que dicen los estudios

**Light mode es generalmente mejor para:**
- Lectura prolongada de datos y texto (mejor comprension lectora).
- Ambientes con buena iluminacion (oficinas, areas de planta bien iluminadas).
- Usuarios con astigmatismo (texto oscuro sobre fondo claro es mas legible).
- Usuarios con dislexia o glaucoma (texto blanco sobre fondo oscuro les cuesta mas).
- Tareas de entrada de datos intensiva.
- Escaneo rapido de tablas con muchas columnas.

**Dark mode es mejor para:**
- Ambientes con poca luz (salas de control, turnos nocturnos).
- Reducir fatiga ocular en uso prolongado con poca luz ambiente.
- Ahorro de bateria en pantallas OLED (relevante para tablets).

### Recomendacion para Barack Mercosul

**Prioridad: Light mode como default. Dark mode como "nice to have" futuro.**

Razones:
1. Los ingenieros de calidad trabajan principalmente en oficina con buena iluminacion.
2. FMEA y CP son tablas densas con mucho texto - light mode es mas legible.
3. La investigacion muestra que light mode tiene mejor comprension lectora.
4. Implementar dark mode bien (no solo invertir colores) requiere esfuerzo significativo: cada color, sombra, borde, icono debe ser revisado.
5. El ROI de dark mode es bajo comparado con otras mejoras UX mas impactantes.

**Si se implementa dark mode en el futuro:**
- Ofrecer toggle manual (no automatico por hora del dia).
- Asegurarse que los colores de RAG status (rojo/amarillo/verde) sean igualmente distinguibles en ambos modos.
- Mantener contraste minimo de 4.5:1 para texto normal en dark mode (es mas dificil de lograr que en light mode).
- Testear con usuarios reales en ambos modos.

### Fuentes
- [Impact of Dark and Light GUI Modes on User Experience (CEUR-WS)](https://ceur-ws.org/Vol-3575/Paper15.pdf)
- [Dark Mode vs Light Mode: The Complete UX Guide (Medium)](https://altersquare.medium.com/dark-mode-vs-light-mode-the-complete-ux-guide-for-2025-5cbdaf4e5366)
- [Dark Mode vs Light Mode & The User Experience (Creode)](https://creode.co.uk/journal/dark-mode-vs-light-mode-the-user-experience/)
- [Impact of Dark Mode on Productivity-Oriented Applications (ResearchGate)](https://www.researchgate.net/publication/379881489_Impact_of_Dark_Mode_on_the_User_Experience_of_Productivity-Oriented_Applications)
- [Light vs Dark Mode: Which Enhances User Experience? (DEV Community)](https://dev.to/encodedots/light-vs-dark-mode-which-one-truly-enhances-user-experience-269a)

---

## 6. Accesibilidad y Legibilidad en Entorno Industrial

### Font Sizes Minimos Recomendados

| Contexto | Tamano minimo | Recomendado |
|---|---|---|
| Texto body en desktop | 14px | 16px (1rem) |
| Texto body en tablet | 16px | 18px |
| Labels de formulario | 14px | 16px |
| Texto en celdas de tabla | 13px | 14-15px |
| Headers de columna | 13px | 14px bold |
| Texto en botones | 14px | 16px |
| Texto secundario/ayuda | 12px | 13px |
| Para sistemas cerrados industriales (WCAG) | 4.8mm (aprox 18px) | 5.5mm+ |

**Nota critica**: WCAG no define un tamano minimo absoluto, pero para sistemas cerrados (kioscos industriales) se requiere minimo 4.8mm de alto basado en la letra "I" mayuscula. Para una app web usada en tablets en planta, 16px es el minimo seguro.

### Contraste en Ambientes con Mucha Luz

- **Minimo WCAG AA**: Ratio 4.5:1 para texto normal, 3:1 para texto grande (24px+ o 18.5px+ bold).
- **Recomendado para planta**: Ratio 7:1 (WCAG AAA) para texto critico como valores de severidad, estados de riesgo.
- **Evitar grises claros**: Texto gris claro sobre blanco (#999 sobre #fff = ratio 2.85:1) es ilegible bajo luz intensa. Minimo usar #595959 sobre #fff (ratio 7:1).
- **No depender solo de color**: Para indicar riesgo (rojo/amarillo/verde), agregar siempre un indicador adicional (icono, texto, patron) para usuarios con daltonismo.
- **Testear con luz**: Usar herramientas que simulen glare en pantalla.

### Touch Targets para Tablets en Planta

| Estandar | Tamano minimo | Uso |
|---|---|---|
| WCAG 2.5.5 (Enhanced) | 44x44 CSS px | Minimo para accesibilidad |
| Material Design | 48x48 dp (~9mm fisico) | Recomendado para mobile/tablet |
| Para uso con guantes | 56x56 px o mas | Necesario en piso de planta |

**Recomendaciones concretas:**
- **Botones**: Minimo 44px de alto, idealmente 48px. Para uso en planta, 56px.
- **Filas de tabla clickeables**: Minimo 44px de alto por fila.
- **Checkboxes y radio buttons**: Area clickeable de al menos 44x44px (el visual puede ser mas chico, pero el area de tap debe ser grande).
- **Spacing entre targets**: Minimo 8px de separacion entre elementos clickeables para evitar taps accidentales.
- **Links en texto**: Si hay links dentro de texto, asegurar suficiente padding vertical.

### Recomendaciones adicionales para entorno industrial

1. **Tipografia sans-serif obligatoria**: WCAG requiere al menos un modo con fuente sans-serif. Para software industrial, usar siempre sans-serif (Inter, Roboto, system-ui).
2. **No usar solo color para comunicar informacion**: Daltonismo afecta al 8% de hombres. Siempre acompanar color con icono o texto.
3. **Zoom y escalado**: La UI debe funcionar bien con zoom del navegador hasta 200%.
4. **Responsive para tablet**: Layout que funcione en 1024px de ancho (tablet landscape).

### Fuentes
- [Understanding Success Criterion 2.5.5: Target Size (W3C)](https://www.w3.org/WAI/WCAG21/Understanding/target-size.html)
- [Target Size Enhanced - WCAG 2.2 (W3C)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html)
- [Accessible Touch Target Sizes (LogRocket)](https://blog.logrocket.com/ux-design/all-accessible-touch-target-sizes/)
- [Material Design Accessibility - Usability](https://m1.material.io/usability/accessibility.html)
- [WCAG Minimum Font Size (A11Y Collective)](https://www.a11y-collective.com/blog/wcag-minimum-font-size/)
- [Accessible Fonts and Typography for Section 508 (Section508.gov)](https://www.section508.gov/develop/fonts-typography/)
- [WCAG Contrast Minimum 1.4.3 (Silktide)](https://silktide.com/accessibility-guide/the-wcag-standard/1-4/distinguishable/1-4-3-contrast-minimum/)
- [Color Contrast Accessibility WCAG 2025 Guide (AllAccessible)](https://www.allaccessible.org/blog/color-contrast-accessibility-wcag-guide-2025)
- [Mobile Typography Accessibility - Font Sizes and Touch Targets](https://fontfyi.com/blog/mobile-typography-accessibility/)

---

## 7. Resumen Ejecutivo: Top 10 Recomendaciones para Barack Mercosul

Basado en toda la investigacion, estas son las 10 mejoras UX con mayor impacto potencial:

### Prioridad Alta (impacto grande, alineado con problemas conocidos)

1. **Sticky headers + primera columna fija en tablas FMEA/CP**: La mejora mas critica. FMEA tiene 20+ columnas; sin esto, los usuarios pierden contexto al hacer scroll.

2. **Column hiding con presets**: Permitir ocultar columnas y ofrecer vistas predefinidas ("Vista rapida", "Vista riesgo", "Vista completa"). Persistir preferencias por usuario.

3. **Panel lateral para detalle de registro**: En vez de modal o pagina nueva, abrir un panel desde la derecha al clickear una fila. Mantiene el contexto de la tabla visible.

4. **Links cruzados entre entidades**: Desde un failure mode en AMFE, poder saltar directamente al control correspondiente en CP y al paso en PFD. Actualmente las validaciones cruzadas existen pero la navegacion entre ellas podria ser mas fluida.

5. **Dashboard con metricas accionables**: No solo numeros, sino indicadores con color coding que lleven directamente al item que necesita atencion.

### Prioridad Media (mejora significativa de experiencia)

6. **Agrupacion visual de columnas en FMEA**: Headers de grupo (Analisis de Proceso, Analisis de Falla, etc.) con colores diferenciados para facilitar la orientacion en la tabla.

7. **Filtros rapidos predefinidos**: "RPN > 100", "Actions vencidas", "Sin deteccion". Un click para filtrar lo mas importante.

8. **Breadcrumbs contextuales**: Mostrar la ruta completa: Familia > Documento > Seccion para que el usuario siempre sepa donde esta.

### Prioridad Baja (nice-to-have)

9. **Inline editing para campos simples**: Poder editar severidad, ocurrencia, deteccion directamente en la tabla con un click, sin abrir formulario.

10. **Dark mode**: Solo si hay demanda de usuarios. Light mode es la prioridad para datos densos.

---

*Documento generado el 2026-03-21 basado en investigacion web de multiples fuentes de UX, accesibilidad y software industrial.*
