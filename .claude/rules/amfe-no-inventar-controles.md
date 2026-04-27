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
