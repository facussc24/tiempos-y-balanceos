# Objetivos y Arquitectura de los Modulos APQP

> Documento de referencia para desarrollo futuro.
> Ultima actualizacion: 2026-03-11

---

## 1. Vision General

Barack Mercosul automatiza la cadena documental APQP (Advanced Product Quality Planning)
de la industria automotriz. Los 4 modulos estan **interconectados en cascada**:

```
PFD (Diagrama de Flujo)       --> Define operaciones del proceso
    |
    v
AMFE VDA (Analisis de Fallas) --> Analiza riesgos por operacion
    |
    v
Plan de Control                --> Define controles de calidad
    |
    v
Hojas de Operaciones           --> Instrucciones para el operador
```

**Principio clave**: El AMFE es la fuente de verdad. Los demas documentos se generan
a partir de el, pero TODOS pueden editarse manualmente despues de generados.

---

## 2. Objetivo de Cada Modulo

### 2.1 PFD (Diagrama de Flujo del Proceso)
- **Goal**: Representar visualmente cada paso del proceso productivo con simbologia ASME/AIAG
- **Input**: Operaciones del AMFE (o creacion manual)
- **Output**: Diagrama tabular + visual con operaciones, transportes, inspecciones, CC/SC
- **Norma**: AIAG APQP 3ra Ed, ASME Y15.3
- **Exporta**: PDF, Excel, SVG (editable en Visio)

### 2.2 AMFE VDA (Analisis Modal de Fallas y Efectos)
- **Goal**: Identificar fallas potenciales, evaluar riesgo (S/O/D), y definir acciones preventivas
- **Input**: Operaciones del proceso (manual o desde PFD)
- **Output**: Tabla jerarquica de 5 niveles: Operacion > Elemento 6M > Funcion > Falla > Causa
- **Norma**: AIAG-VDA FMEA 1st Ed (2019), AP automatico (H/M/L)
- **Exporta**: Excel (3 modos: completo, resumen AP, plan de acciones), PDF, JSON

### 2.3 Plan de Control (CP)
- **Goal**: Definir que controlar, como medirlo, cada cuanto, y que hacer si falla
- **Input**: Causas y fallas del AMFE (AP >= M)
- **Output**: Tabla AIAG de 13 columnas con controles preventivos y de deteccion
- **Norma**: AIAG Control Plan 1st Ed (2024)
- **Exporta**: PDF, Excel
- **Regla CP 2024**: NO mezclar caracteristicas de producto y proceso en la misma fila

### 2.4 Hojas de Operaciones (HO)
- **Goal**: Dar al operador instrucciones claras: pasos, EPP, controles CC/SC, plan de reaccion
- **Input**: Operaciones del AMFE + controles del Plan de Control
- **Output**: Una hoja por operacion con formato IATF 16949 cl.8.5.1.2
- **Norma**: IATF 16949:2016, metodologia TWI (Training Within Industry)
- **Exporta**: PDF (tema navy), Excel

---

## 3. Flujo de Generacion (Automatizacion)

### 3.1 Cascada automatica
```
Usuario crea AMFE con operaciones y causas
    |
    +--> Click "Generar PFD" --> Wizard interactivo --> PFD generado
    |
    +--> Click "Generar CP"  --> Automatico desde AMFE --> CP generado
    |
    +--> Click "Generar HO"  --> Desde AMFE + CP --> HO generado
```

### 3.2 Reglas de generacion
- **PFD**: Cada operacion AMFE = 1 paso PFD. Infiere simbolo por nombre (regex en espaniol)
- **CP**: Cada causa AP>=M = 1 fila proceso (prevencion). Cada falla = 1 fila producto (deteccion). Deduplicacion automatica
- **HO**: Cada operacion AMFE = 1 hoja. Controles de calidad importados del CP

### 3.3 Edicion manual post-generacion
**CRITICO**: Despues de generar, el usuario puede editar libremente cualquier campo.
Si regenera, se le advierte que perdera los cambios manuales.

---

## 4. Sincronizacion Excel <-> Software

### 4.1 Filosofia de diseno

**Modelo hibrido**: El software acelera el trabajo y automatiza la cadena APQP,
pero los entregables son Excel/PDF estandar que cualquiera puede abrir y editar.
Esto permite que terceros (clientes, auditores) trabajen con los archivos sin
necesitar el software. Es un modelo transitorio hasta que el software este 100% maduro.

En la practica, el software y los Excel coexisten:
- El software genera Excel/PDF como entregables
- Terceros pueden editar esos Excel libremente
- El usuario debe poder re-alinear el software con los cambios externos

### 4.2 Escenario: Alguien edita el Excel externamente

**Pregunta clave**: Que pasa si alguien actualiza el AMFE en Excel (ej: cambia rev A a B)?

**Respuesta tecnica**:
- El software **NO puede leer automaticamente un Excel modificado externamente** y sincronizarse.
  Esto seria extremadamente complejo (parsing de formato libre, deteccion de cambios cell por cell,
  manejo de formulas, merges, estilos, etc.)
- Lo que SI se puede implementar es un **sistema de alerta de revision**:

### 4.3 Solucion propuesta: Alerta de revision externa

```
FLUJO PROPUESTO:
1. El software exporta AMFE con revision "A" y guarda internamente:
   - fecha de exportacion
   - hash del contenido exportado
   - nivel de revision al momento de exportar

2. Cuando el usuario abre el proyecto en el software:
   --> Banner: "Ultima exportacion: Rev A (15-mar-2026)"
   --> Si el usuario sabe que alguien edito el Excel externamente:
       Click "Marcar revision externa"
       --> Modal: "Ingrese nueva revision (B), autor, descripcion del cambio"
       --> El software registra la revision pero advierte:
           "ATENCION: Los cambios del Excel externo NO se reflejan automaticamente.
            Por favor actualice manualmente los campos modificados en el software
            para mantener la consistencia."

3. Validacion cruzada opcional:
   - El usuario puede re-importar el Excel (si implementamos import Excel)
   - O actualizar campos manualmente y guardar nueva revision
```

### 4.4 Lo que NO es viable (y por que)
| Idea | Por que no es viable |
|------|---------------------|
| Leer Excel y auto-actualizar | Formato libre, celdas mergeadas, formulas, estilos = parsing imposible confiable |
| Monitorear archivo Excel en disco | Requiere file watcher + parsing = fragil y lento |
| Bidireccional Excel <-> SQLite | Conflictos de merge, perdida de datos, complejidad extrema |

### 4.5 Lo que SI es viable (y recomendado)
| Feature | Complejidad | Valor |
|---------|------------|-------|
| Banner de ultima exportacion con revision | Baja | Alto |
| Boton "Marcar revision externa" | Baja | Alto |
| Historial de revisiones con origen (software vs externo) | Media | Alto |
| Importar Excel como nuevo documento (no merge) | Alta | Medio |
| Comparar Excel importado vs actual (diff visual) | Muy alta | Medio |

---

## 5. Interconexion entre Modulos

### 5.1 Trazabilidad
```
AMFE Causa --> amfeCauseIds[] en CP Item
AMFE Falla --> amfeFailureId en CP Item
CP Item    --> cpItemId en HO QualityCheck
AMFE Op    --> stepNumber en PFD Step
```

### 5.2 Validacion cruzada en tiempo real
- **CP vs AMFE**: 5 reglas (CC/SC consistencia, fallas huerfanas, alineacion 4M,
  responsables de reaccion, frecuencia poka-yoke)
- **Cross-doc alerts**: Banner cuando se detecta que un documento vinculado fue actualizado
- **Compliance check**: Barra de progreso 0/7 pasos en AMFE

### 5.3 Navegacion
- Todos los modulos se acceden como **pestanias dentro del AMFE**
- Tab bar: Diagrama de Flujo | AMFE VDA | Plan de Control | Hojas de Operaciones | Inicio
- Cada modulo se monta una vez y se oculta/muestra (preserva estado)
- Boton "Inicio" vuelve al landing page

---

## 6. Persistencia y Almacenamiento

### 6.1 SQLite (via Tauri)
| Tabla | Modulo |
|-------|--------|
| amfe_documents | AMFE |
| pfd_documents | PFD |
| cp_documents | Plan de Control |
| ho_documents | Hojas de Operaciones |
| drafts | Auto-guardado de todos |
| document_revisions | Historial de revisiones |

### 6.2 Auto-guardado
- Drafts cada 2 segundos de inactividad (debounce)
- Recuperacion de borradores al re-abrir

### 6.3 Revisiones
- Cada revision guarda snapshot completo del documento
- Nivel auto-incrementa: A -> B -> C -> ...
- Se puede revertir a cualquier revision anterior

---

## 7. IA Integrada (Copiloto)

### 7.1 AMFE
- Sugerencias de fallas, causas, controles (7 campos elegibles)
- Chat multi-turno con acciones (agregar/editar/eliminar)
- Modelo: Gemini 2.5 Flash

### 7.2 Plan de Control
- 5 campos con sugerencias IA (controlMethod, evaluationTechnique, sampleSize, sampleFrequency, reactionPlan)
- Chat copiloto con 6 acciones bulk
- Cross-validation asistida

### 7.3 Campos que NUNCA se auto-llenan
- `specification` (viene del diseno/ingenieria, no de IA)
- `reactionPlanOwner` (debe ser una persona real del piso, norma CP 2024)

---

## 8. Exportaciones

| Modulo | Excel | PDF | SVG | JSON |
|--------|-------|-----|-----|------|
| PFD | Si | Si | Si (Visio) | No |
| AMFE | Si (3 modos) | Si | No | Si |
| CP | Si | Si | No | No |
| HO | Si | Si (navy) | No | No |

**Seguridad en Excel**: Todas las exportaciones usan `sanitizeCellValue()` para
prevenir inyeccion de formulas (=, +, -, @, \t, \r al inicio de celdas).

---

## 9. Decisiones de Diseno Importantes

1. **Tabular, no canvas**: El PFD usa formato tabular (no dibujo libre) para consistencia con AIAG
2. **Generacion unidireccional**: AMFE -> PFD/CP/HO, nunca al reves
3. **Documentos independientes post-generacion**: Una vez generado, cada doc vive independiente
4. **Excel como entregable, no como fuente**: El software exporta Excel, no lo consume como input principal
5. **Modo edicion vs vista**: Toggle para proteger contra ediciones accidentales
6. **AP automatico**: El software calcula Action Priority automaticamente segun tabla AIAG-VDA (no manual)

---

## 10. Roadmap de Mejoras Pendientes

### Alta prioridad
- [ ] Banner de "ultima exportacion" con revision
- [ ] Boton "Marcar revision externa" para alinear con Excel editado por terceros
- [ ] Mejoras UX en navegacion (ver APQP_UX_ANALYSIS.md)

### Media prioridad
- [ ] Import Excel como documento nuevo (sin merge)
- [ ] Diff visual entre revision actual y anterior
- [ ] Compresion de snapshots de revision (reducir tamano SQLite)

### Baja prioridad
- [ ] Monitoreo de archivo Excel en disco (file watcher)
- [ ] Exportar a Google Sheets / OneDrive
