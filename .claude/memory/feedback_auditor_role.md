---
name: Rol de Auditor AMFE/CP/HO/PFD
description: Protocolo de auditoría post-carga de documentos APQP — qué verificar, en qué orden, y criterios de aceptación
type: feedback
---

Cuando Fak pida "auditoría" o "auditar" un AMFE/CP/HO/PFD, ejecutar este protocolo completo.

**Why:** Fak no verifica manualmente. El auditor es el último eslabón antes de producción. Si algo pasa mal acá, llega al cliente.

**How to apply:** Lanzar múltiples agentes en paralelo cubriendo estos checkpoints.

### REGLA CRÍTICA para prompts de agentes auditores (2026-04-09)
**INCIDENTE**: Agentes auditores no detectaron `operationFunction` vacío en 17 OPs (3 AMFEs). El protocolo tenía el check 2a pero los agentes NO lo implementaron porque el prompt no les decía explícitamente qué verificar.
**CAUSA RAÍZ**: Claude asumió que los agentes "sabían" el protocolo. No lo sabían — cada agente empieza de cero.
**REGLA**: Al lanzar agentes auditores, el prompt DEBE listar TODOS los checks explícitamente, incluyendo:
- C-FEF: `focusElementFunction` no vacío en toda OP
- C-OPFUNC: `operationFunction` no vacío en toda OP (¡ESTE SE OLVIDÓ!)
- C-SOD: S/O/D completos en toda causa
- C-EFFECTS: 3 niveles VDA en todo FM
- C-1M: 1 elemento por WE (sin "/")
- C-NAMING: UPPERCASE, español
- C-AP: AP calculado con tabla oficial
- C-CAPACITACION: Nunca como causa
- C-META: operation_count y cause_count sincronizados
**NUNCA** asumir que el agente "ya sabe". Listar cada check con el campo exacto a verificar.

### REGLA CRÍTICA: Autenticación y nombres de campo (2026-04-12)
**INCIDENTE**: Tres agentes auditores contaron 0 causas en el maestro de inyección (real: 65). Uno reportó "tablas vacías".
**CAUSAS RAÍZ**:
1. **Campo equivocado**: Los failure modes están en `fn.failures`, NO en `fn.failureModes`. Scripts y agentes que usen `fn.failureModes` obtienen `undefined` y cuentan 0.
2. **Sin autenticación**: Supabase con RLS devuelve 0 filas si no se llama `sb.auth.signInWithPassword()`. Un agente consultó con anon key y reportó datos vacíos.
**REGLAS**:
- C-AUTH: Todo agente/script DEBE autenticarse con `signInWithPassword()` antes de cualquier query a Supabase
- C-FIELD: Al contar failure modes o causas, el path correcto es `op.workElements[].functions[].failures[].causes[]` — NUNCA `failureModes`
- Incluir ambas reglas explícitamente en el prompt de cada agente auditor

## Principios del Auditor

### Auto-mejora continua
- Al final de cada auditoría, evaluar si su propio rol necesita ajustes
- Si detecta un check que falta, agregarlo a este archivo
- Si un check genera falsos positivos recurrentes, refinarlo o eliminarlo
- Puede mejorar docs/LECCIONES_APRENDIDAS.md y otros .md si lo considera necesario y seguro

### Propagación de correcciones
- Si un error detectado en 1 documento puede afectar a OTROS documentos del mismo tipo → verificar TODOS
- Ejemplo: si el naming está mal en IP_PADS, verificar si los otros 8 AMFEs tienen el mismo problema
- Si la corrección es segura (misma lógica, sin riesgo de datos): desplegar agentes para corregir todos
- Si la corrección es ambigua: reportar los afectados sin corregir, para que Fak decida

### Verificación post-sesión
- Verificar que TODOS los cambios de la sesión actual se guardaron correctamente
- Verificar que los scripts creados funcionan (ejecutar uno de prueba)
- Verificar que el backup es reciente (< 5 min)
- Verificar que lecciones aprendidas se actualizaron si hubo errores

### Despliegue de co-auditores
- Si la auditoría detecta problemas en múltiples áreas independientes: desplegar agentes especializados en paralelo
- Cada agente corrige su área y reporta al auditor principal
- El auditor consolida resultados y genera reporte final

## Checklist de Auditoría AMFE

### 1. Integridad de datos en Supabase
- Verificar que `typeof data` sea string parseable (TEXT) o object (JSONB)
- Verificar `JSON.parse(data).operations.length` coincida con `operation_count`
- Verificar que NO haya double-serialization (parse una vez debe dar object, no string)
- Contar causas totales y comparar con `cause_count`

### 2. Estructura VDA (AIAG-VDA 2019)
- Toda operación tiene al menos 2-3 work elements (6M: Machine, Man, Material, Method, Measurement, Environment)
- Si una operación tiene solo 1 WE → WARNING: probablemente faltan elementos 6M
- Todo work element tiene al menos 1 función
- Toda función tiene al menos 1 modo de falla
- Todo modo de falla tiene los 3 efectos (effectLocal, effectNextLevel, effectEndUser) NO vacíos
- Todo modo de falla tiene al menos 1 causa
- Toda causa con S/O/D completos tiene AP calculado
- AP calculado con tabla oficial (no S*O*D)

### 2a. Completitud de campos de operación — BLOQUEANTE
- **focusElementFunction**: TODA operación con work elements DEBE tener este campo completo. Si está vacío → BLOCKER
- **operationFunction**: TODA operación con work elements DEBE tener descripción de lo que se hace en el paso. Si está vacío → BLOCKER
- Verificar que focusElementFunction tiene las 3 perspectivas separadas: "Interno: ... / Cliente: ... / Usuario final: ..."

### 2b. Completitud S/O/D — BLOQUEANTE
- TODA causa con texto (campo cause) DEBE tener los 3 valores: S, O y D (1-10)
- Si falta CUALQUIERA de los 3 → BLOCKER (no solo pares asimétricos)
- Verificar especialmente causas en operaciones nuevas/recién creadas
- Un O=0 o D=0 es tan grave como un campo vacío → BLOCKER

### 3. Calibración de severidades
- S=9-10 SOLO para: flamabilidad, VOC, airbag, bordes filosos, seguridad usuario
- S=9-10 para seguridad del operador NO debe tener CC (se gestiona con EPP)
- S=7-8 para fallas de encastre, desprendimiento
- S=5-6 para arrugas, delaminación, costura torcida
- S=3-4 para cosmético menor

### 4. CC/SC — NO auditar (Fak decide personalmente)
- NO reportar CC% ni SC% como problema
- NO sugerir qué items deberían tener CC o SC
- Solo Fak asigna características especiales

### 5. Acciones de optimización — NO auditar
- NO reportar AP=H sin acciones como problema
- Usar "Pendiente definición equipo APQP" en observations y seguir
- 0 acciones inventadas por Claude Code

### 6. Coherencia de nombres
- Nombres de operación en UPPERCASE
- Sin acentos en nombres de operación (opcional, verificar consistencia)
- Nombres estándar: RECEPCION DE MATERIA PRIMA, CONTROL FINAL DE CALIDAD, EMBALAJE

### 7. Reglas de negocio
- 1 material por WE (no agrupados)
- Operaciones con opNumber como STRING
- Header completo (organización, cliente, equipo, fechas)

### 8. Backup y documentación
- Backup ejecutado (`node scripts/_backup.mjs`)
- Lecciones aprendidas actualizadas si hubo errores
- Memoria del proyecto actualizada si se descubrió algo nuevo

### 9. Coherencia PFD ↔ AMFE (si aplica)
- Toda operación del AMFE tiene step correspondiente en PFD
- Nombres de operación coinciden exactamente
- PFD tiene decision steps después de inspecciones
- PFD tiene transport steps entre sectores

### 10. Usabilidad y accesibilidad de documentos (UX)
- Todo documento es VISIBLE y ACCESIBLE desde la UI sin trucos ni filtros especiales
- Documentos sin familia asignada: ¿quedan ocultos por filtros? Si sí → reportar como blocker
- Documentos en "Sin clasificar": reclasificar al proyecto correcto (no dejar huérfanos)
- Filtros por defecto no deben ocultar documentos existentes
- Metadata desincronizada (operation_count, cause_count) → re-sincronizar (causa conteos incorrectos en listados)
- Nombres de proyecto legibles en el panel de navegación (no paths crípticos)
- Documentos recién cargados deben ser encontrables buscando por nombre parcial

### 11. Campos de naming inconsistentes entre documentos
- Verificar que todos los docs usen los mismos field names (opNumber vs operationNumber, ap vs actionPriority, fail.severity vs cause.severity)
- Si hay inconsistencias: CORREGIR agregando aliases (ej: op.opNumber = op.operationNumber) para que ambas convenciones funcionen
- Usar el script `scripts/fixIpPadNormalize.mjs` como referencia de cómo normalizar
- Después de normalizar: re-sync metadata para que los conteos reflejen los datos reales

### 12. Componentes UI huérfanos (C-ORPHAN)
- Verificar que TODO componente React (.tsx) con `export default` sea importado y renderizado desde algún punto de navegación
- Si existe un componente completo que NO se importa en ningún archivo → BLOCKER
- Buscar con: `grep -rn "import.*ComponentName" modules/` — si 0 resultados, está huérfano
- Esto previene que se creen panels/features completas que nunca se conectan a la UI (incidente: AmfeMasterLibraryPanel estuvo huérfano desde su creación)
- **Why:** Un componente huérfano es funcionalidad invisible para el usuario. Equivale a no haberlo implementado.
- **How to apply:** Al final de cada auditoría, verificar los archivos creados/modificados en la sesión. Si alguno es un componente nuevo, confirmar que tiene al menos 1 import activo.

### 13. Commit + Push + Backup (OBLIGATORIO — SIEMPRE EJECUTAR, NO OPCIONAL)
- Ejecutar `node scripts/_backup.mjs` para snapshot de Supabase
- Hacer `git add` de TODOS los archivos modificados/nuevos de la sesión (NO agregar backups/ ni .env*)
- Hacer commit con mensaje descriptivo
- Hacer `git push` al remoto
- Verificar que el push fue exitoso
- Reportar URL del repo o estado del push
- **NUNCA terminar la auditoría sin hacer push.** Este paso NO es opcional ni delegable.

**Why:** Fak asume que si la auditoría pasó, todo está en GitHub. Si no se pushea, el código se pierde. En sesiones anteriores el auditor olvidó este paso — NO debe repetirse.

## Criterios de aceptación
- 0 errores bloqueantes (efectos vacíos, double-serialization, docs ocultos por filtros, metadata desincronizada)
- NO reportar como problema: AP=H sin acciones, CC/SC faltantes (Fak los gestiona)
- Warnings documentados para revisión del equipo APQP
- Backup exitoso
- Commit + push exitoso a GitHub
