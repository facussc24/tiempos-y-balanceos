---
description: PROHIBIDO inventar controles tecnicos, equipos, frecuencias o usar espanolismos peninsulares
globs:
  - "modules/amfe/**"
  - "modules/controlPlan/**"
  - "modules/hojaOperaciones/**"
  - "scripts/**.mjs"
---

# Regla: NUNCA inventar controles, equipos, frecuencias ni usar espanolismos

## Contexto del incidente (2026-04-27)

Fak detecto en Top Roll AMFE/CP/HO controles inventados que generaron 22 ocurrencias en 6 documentos (3 productos):
- "Limpieza de molde programada cada 4 hs con hielo seco" — Barack NO usa hielo seco
- "Medicion por Ultrasonido cada 2 horas" — frecuencia sin respaldo
- "Medicion de ancho con flexometro al inicio de cada bobina" — espanolismo (flexometro=cinta metrica en AR)
- "Rotacion de inspectores cada 2 horas" — control conductual con frecuencia inventada

Esta regla extiende `.claude/rules/amfe-actions.md` (que cubria solo acciones) a TODOS los controles.

## Regla absoluta

NUNCA inventar para llenar campos de control en AMFE/CP/HO:
- `preventionControl` (AMFE)
- `detectionControl` (AMFE)
- `controlMethod` (CP/HO)
- `evaluationTechnique` (CP/HO)
- `sampleFrequency` / `frequency` (CP/HO)
- `machineDeviceTool` (CP)
- `reactionPlan` / `reactionAction` (CP/HO)

### Que cuenta como "inventar"

1. **Equipos que Barack no tiene/usa**: hielo seco, nitrogeno liquido, microscopio electronico, cromatografo, espectrometro, laser de medicion 3D, etc. Si no esta en una hoja de operacion oficial o no lo menciono Fak/equipo APQP, **NO existe**.

2. **Frecuencias arbitrarias**: "cada 2 horas", "cada 4 hs", "cada N piezas", "rotacion cada X". Si no esta definido por el equipo APQP o un PPAP oficial, **NO inventar numero**.

3. **Tecnicas sin respaldo**: "Medicion por ultrasonido para detectar X" cuando el ultrasonido se usa para SOLDAR (no medir) en Barack. Verificar que la tecnica corresponde al proceso real.

4. **Espanolismos peninsulares**: flexometro, ordenador, movil, fichero, raton, grifo, coger, vosotros. Argentina usa otros terminos.

## Que SI hacer cuando falta un control

| Situacion | Accion correcta |
|-----------|-----------------|
| Falta dato y AP=H | Placeholder `"Pendiente definicion equipo APQP"` |
| Falta dato y AP=M/L | Dejar **vacio** (`""`) — el equipo lo completa |
| Sabes el equipo pero no la frecuencia | Equipo + `"frecuencia TBD"` |
| Sabes solo que es visual | `"Inspeccion visual 100%"` (nivel basico, no inventar instrumento) |
| Es recepcion de MP | `"Verificacion segun P-14"` |
| Es proceso productivo | `"Autocontrol segun P-09/I"` |

## Diccionario espanol Argentina (criterio Barack)

| NUNCA usar (peninsular) | USAR (Argentina) |
|-------------------------|------------------|
| flexometro | cinta metrica |
| ordenador | computadora / PC |
| movil (telefono) | celular |
| fichero | archivo |
| raton (PC) | mouse |
| grifo | canilla |
| coger | agarrar / tomar |
| ducha | ducha (igual) |
| zumo | jugo |
| patata | papa |
| coche | auto / vehiculo |
| aparcamiento | estacionamiento |
| tarea (school) | tarea (igual, OK) |
| vosotros / vuestro | ustedes / suyo |

**Excepciones**: terminos tecnicos universales en espanol que NO son peninsulares (calibre, micrometro, comparador, vernier) son OK.

**Regla meta**: Si dudas, usar la palabra que Fak uso. Si Fak no la dijo, preguntar antes de elegir.

## Auditor

Script read-only `scripts/_auditInventos.mjs` detecta patrones sospechosos en snapshots locales. Correr antes de cada entrega y al detectar cualquier dato dudoso. Cubre:
- Inventos confirmados (hielo seco, pistola de ultrasonido, etc.)
- Espanolismos del diccionario
- Frecuencias del tipo "cada N horas/min" (flag para revisar)
- Quimicos/equipos exoticos

Version live: `scripts/_auditInventosLive.mjs` corre contra Supabase y reporta IDs afectados.

## Enforcement (gate pre-commit ejecutable — agregado 2026-06-26)

Esta regla dejo de depender solo de disciplina manual. Ahora hay un **candado
ejecutable** enganchado al gate `runWithValidation()` (dryRunGuard.mjs) por el que
pasa TODO script `.mjs` que escribe AMFEs:

- **Fuente unica de listas:** `core/amfe/forbiddenContent.data.json` (inventos
  confirmados + diccionario peninsular + frases-Claude + frecuencias arbitrarias).
  Derivada VERBATIM de esta regla y de `amfe.md`. NO duplicar: agregar terminos aca.
- **Detector:** `scripts/_lib/forbiddenContent.mjs` -> `scanForbidden(text)`.
- **Checks en `scripts/_lib/amfeValidator.mjs`:**
  - `FORBIDDEN_VOCABULARY` (**CRITICAL**, en `CRITICAL_TYPES`): equipo inexistente
    en Barack (hielo seco, ultrasonido para medir, etc.) + espanolismo peninsular
    (flexometro, ordenador, etc.). **Bloquea el `--apply`** de cualquier script que
    introduzca un invento NUEVO. known-bad, ~0 falsos positivos.
  - `CLAUDE_PHRASE` (**WARNING**): frase-Claude ("Inspeccion Humana", "asegurar que",
    galga, husillo, etc.) + frecuencia inventada ("cada N horas/piezas"). Flag para
    revision, NO bloquea (a veces legitimo).
- **Campos escaneados:** `preventionControl`, `detectionControl`, `controlMethod`,
  `optimizationAction`, `preventionAction`, `detectionAction`, `function.description`,
  `WE.name`, `operationFunction`, `focusElementFunction`.
- **Reporte de stock legacy:** `scripts/_auditAll.mjs` desglosa "CANDADO ANTI-INVENTO"
  con conteo por AMFE (requiere `.env.local`; alternativa: scan SQL via MCP).
- **Tests:** `__tests__/scripts/forbiddenContent.test.mjs` (12 vectores).
- **Como ampliar las listas:** editar SOLO `core/amfe/forbiddenContent.data.json`.
  El gate y el reporte lo toman automaticamente. Equipo/peninsular -> CRITICAL;
  frase-Claude/frecuencia -> WARNING.

**Linea base 2026-06-26 (17 AMFEs, scan field-targeted):** FORBIDDEN_VOCABULARY=0
(dataset limpio de inventos bloqueantes), CLAUDE_PHRASE=16 warnings legacy
(AMFE 150 tiene 8x "Inspeccion Humana"; AMFE-2 "cada 50 piezas"; INS-PAT/maestros
"asegurar que"). Pendiente de limpieza con OK de Fak (son WARNING, no bloquean).

**Deferido a proposito:** un check `CONTROL_NOT_AUTHORIZED` con whitelist de strings
exactos de control se evaluo y se descarto por ahora — generaria ruido en cada
control nuevo legitimo (texto libre). Si se hace, debe ser una lista CURADA de
equipos/instrumentos reales (con input de Fak), no strings exactos.

## Como aplicar correcciones cuando se detecta un invento

1. **NO corregir solo** — confirmar con Fak primero (regla `autonomy-contract.md` seccion B: contenido tecnico requiere autorizacion).
2. **Opciones para Fak**:
   - A) Reemplazar por placeholder "Pendiente definicion equipo APQP"
   - B) Vaciar y dejar TBD
   - C) Fak dicta el control real y Claude copia textualmente
3. **Sincronizar 3 documentos** (AMFE -> CP -> HO) — si una causa AMFE tiene control inventado, el CP y la HO derivados tambien lo tienen.
4. **Backup obligatorio** antes de cualquier correccion (`scripts/_backup.mjs`).
5. **Correr validator** `runWithValidation()` con dry-run primero (regla `database.md`).

## Por que es grave

- Auditor IATF 16949 lee la columna "Metodo de Control" del CP. Si dice "hielo seco" y la planta no tiene, **no conformidad mayor**.
- Cliente (VW/PWA/etc.) puede pedir evidencia del control declarado. Si no existe el equipo, **falla de PPAP**.
- Genera desconfianza de Fak en TODO el dataset — habria que re-auditar manualmente cada control.

## Incidente de referencia
- 2026-03-30: 408 acciones de optimizacion inventadas — eliminadas. Regla `amfe-actions.md` creada.
- 2026-04-27: 22 controles inventados detectados (este incidente). Regla `amfe-no-inventar-controles.md` creada.
