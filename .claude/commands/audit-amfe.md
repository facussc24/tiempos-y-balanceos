# Auditar AMFE en Supabase

Ejecuta una auditoria completa de un producto AMFE en Supabase. Si no se especifica producto, auditar TODOS.

## Pasos

1. Conectar a Supabase (patron .env.local)
2. Leer el/los AMFEs especificados
3. Para CADA AMFE, verificar:

### Integridad de datos
- `typeof data === 'object'` (NO string — ver regla anti-double-serialization en database.md)
- `data.operations` es un array
- Contar operaciones, work elements, failures, causes

### Reglas AMFE (de .claude/rules/amfe.md)
- Operaciones en MAYUSCULAS
- Todo texto en espanol (sin parentesis en ingles)
- Efectos VDA 3 niveles completos (effectLocal, effectNextLevel, effectEndUser)
- S/O/D en rango 1-10 para todas las causas
- AP calculado con tabla AIAG-VDA oficial (NO formula S*O*D)
- CC solo para S>=9 o flamabilidad/seguridad/legal
- Flamabilidad presente como CC en productos de cabina interior
- Norma correcta por cliente (TL 1010 solo VW, NO en PWA)

### Regla 1M por linea
- Cada Work Element es UN solo item (no agrupaciones con "/")
- Materiales directos en ops de proceso solo si hay riesgo de interaccion

### Acciones (CRITICO)
- Campos de optimizacion VACIOS: preventionAction, detectionAction, responsible, targetDate, status
- Si alguno tiene contenido, reportar como CRITICO

### Cross-document
- Comparar nombres de operaciones AMFE vs CP del mismo producto
- Comparar nombres de operaciones AMFE vs PFD del mismo producto
- Reportar mismatches

4. Generar reporte PASS/FAIL con detalle por seccion
5. Si hay FAIL, listar acciones correctivas recomendadas

## Formato de uso
```
/audit-amfe              # Audita los 8 AMFEs
/audit-amfe ARMREST      # Audita solo Armrest
/audit-amfe PWA          # Audita los 2 PWA
```
