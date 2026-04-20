---
name: pfd-generator
description: Generar flujograma PFD desde AMFE. Usar cuando falten PFDs en Supabase o despues de modificar AMFEs. Trigger: "generar flujograma", "hacer PFD", "flujograma desde AMFE", "regenerar PFD".
auto_load_globs:
  - modules/pfd/**
  - scripts/generatePfdForAllFamilies.ts
---

# PFD Generator — Skill

Generar flujogramas de proceso (PFD / Process Flow Diagram) a partir de AMFEs existentes en Supabase.

## Cuando usar

- Falta PFD para algun producto (nuevo o borrado)
- Se modifico el AMFE y se quiere regenerar PFD con nuevos contenidos
- Bulk regeneration de todos los PFDs de la planta

## Script principal

`scripts/generatePfdForAllFamilies.ts` — usa el generador existente `modules/pfd/pfdGenerator.ts` (TypeScript, corrido via tsx).

## Uso

### 1. Listar estado actual de PFDs
```bash
node scripts/_inspectPfdState.mjs
```

Muestra: ID, PartName, PN, Cliente, LinkedAmfe, Steps de cada PFD existente + AMFEs disponibles.

### 2. Generar PFD para 1 AMFE
```bash
node_modules/.bin/tsx scripts/generatePfdForAllFamilies.ts --only AMFE-TR-PAT
```

Opciones:
- `--only <amfe_number>` — generar solo para ese AMFE
- `--dry` — solo mostrar que se generaria, no escribir

### 3. Generar para todos los AMFEs sin PFD
```bash
node_modules/.bin/tsx scripts/generatePfdForAllFamilies.ts
```
Skip automatico: maestros (LOG-REC, INY) y AMFEs que ya tienen PFD linkeado.

### 4. Verificar contenido del PFD generado
```bash
node scripts/_inspectGeneratedPfd.mjs <pfd-id>
```

### 5. Borrar PFD (si quedo mal)
```bash
node scripts/_deletePfd.mjs <pfd-id>
```

## Que genera el pfdGenerator

Para cada AMFE con N operaciones:
- **Bookend REC** (Recepcion de materia prima) — storage
- **N steps operacion** con tipo inferido (operation/inspection/storage/delay/decision/transport/combined)
- **Transportes cross-sector** — insertados automaticamente cuando cambia el departamento entre operaciones consecutivas
- **Bookend ENV** (Almacenamiento y envio al cliente) — storage

Tipo de step inferido por regex en espanol:
- `inspeccion|verific|control|medicion|ensayo|prueba|galga|mylar|calibre|torquimetro|muestreo` -> inspection
- `transport|traslad|mover|despacho` -> transport
- `almacen|stock|deposito|recep|acopio` -> storage
- `espera|demora|enfri|secado|curado|reposo` -> delay
- `decision|seleccion|clasific|segreg` -> decision
- `inspeccion + sold/mecaniz/ensambl/estampa/inyeccion/prens` -> combined
- Default -> operation

CC/SC inferido:
- Severity >= 9 en alguna falla -> productSpecialChar = CC
- Severity >= 5 con ocurrencia >= 4 -> productSpecialChar = SC
- cause.specialChar explicito (CC/SC) -> processSpecialChar

Department inferido (de utils/processCategory.ts).

## Verificacion post-generacion

Recomendado verificar visualmente el PFD en la app:
1. `npm run dev` -> localhost:3000
2. Navegar a modulo PFD
3. Abrir el documento recien generado
4. Comprobar:
   - Nombres de operaciones coinciden con AMFE
   - Transportes aparecen en cambios de sector
   - CC/SC bien asignados
   - Departamentos correctos

Si algo esta mal, corregir el AMFE fuente y regenerar.

## Limitaciones conocidas

1. **REC bookend duplicado con OP 5 storage**: si el AMFE tiene una OP 5 de Recepcion, queda duplicada con el bookend REC. Borrar manualmente el duplicado o saltar la OP de recepcion al generar.
2. **Transportes cross-sector**: si el AMFE no tiene departamentos claros, no se insertan transportes. Usar `--transportMode all` (via script modificado) o agregar manualmente.
3. **CC/SC inferido**: el generador calcula CC/SC desde severidad. Si el equipo APQP definio valores distintos manualmente, regenerar los sobrescribe.

## Patron de uso

```
Fak pide: "generar flujograma para Insert"
-> 1. Listar PFDs existentes: node scripts/_inspectPfdState.mjs
-> 2. Confirmar que no hay PFD de Insert con linkedAmfeId=AMFE-INS-PAT
-> 3. Generar: node_modules/.bin/tsx scripts/generatePfdForAllFamilies.ts --only AMFE-INS-PAT
-> 4. Verificar: node scripts/_inspectGeneratedPfd.mjs <nuevo-id>
-> 5. Reportar resultado
```

## Regla cuando el AMFE tiene errores

Si el AMFE tiene errores graves (S/O/D parciales, 3 funciones vacias, WE incompletos), el PFD generado hereda esos problemas:
- CC/SC puede salir incorrecto si severidades no estan calibradas
- Nombres de operaciones mal rotulados quedan igual en el PFD
- Transportes cross-sector pueden no aparecer si departamentos vacios

**Primero corregir el AMFE, despues regenerar el PFD.** El PFD es un reflejo del AMFE, no una fuente independiente.

## Incidente de referencia

2026-04-20: Fak pidio regenerar PFDs de todos los productos. Resultado:
- 7 PFDs legacy ya existian (Telas Planas, Telas Termoformadas, IP PAD, Top Roll, 3 Headrest)
- 2 PFDs faltantes (Insert, Armrest) -> generados con este skill
- Se creo este skill para facilitar regeneracion futura sin re-aprender

## Referencias

- `modules/pfd/pfdGenerator.ts` — generador principal
- `modules/pfd/pfdTypes.ts` — estructura de datos PfdDocument/PfdStep
- `.claude/rules/pfd.md` — reglas de formato y convenciones
- `public/ref-flujograma.pdf` — referencia visual oficial
