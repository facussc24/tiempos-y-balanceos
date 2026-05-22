# Plan de aplicación — Maestro PU a Supabase

**Pre-requisitos:**
- Draft v2 aprobado por Fak/Leonardo (`MAESTRO_PU_IN_PLACE_DRAFT.md`)
- Todas las columnas 🔴[TBD-Leo] completadas con respuesta de Leonardo
- Severidades validadas por Fak
- Backup reciente de Supabase (`node scripts/_backup.mjs`)

## Pasos del script `.mjs` (cuando se ejecute)

### 1. Verificación previa (read-only)
- Confirmar que `family_id = 17` NO existe en `product_families`
- Confirmar que `AMFE-MAESTRO-PU-001` NO existe en `amfe_documents`
- Si existen → ABORT con mensaje

### 2. Backup obligatorio
```bash
node scripts/_backup.mjs
```
Snapshot de Supabase antes de tocar nada.

### 3. Crear family 17
```sql
INSERT INTO product_families (id, name, description, document_type_default)
VALUES (17, 'Proceso de Inyección PUR in place', 'Maestro AMFE para foam-in-place PU aplicado a apoyacabezas Patagonia', 'process_master');
```

### 4. Crear AMFE-MAESTRO-PU-001
- `id`: UUID nuevo
- `amfe_number`: AMFE-MAESTRO-PU-001
- `family_id`: 17
- `is_master`: true
- `data` (JSONB): objeto completo del maestro v2 con 9 FMs + 8 WEs + cabecera

Patrón JSON sigue `apqp-schema` skill:
```json
{
  "header": { ... },
  "operations": [
    {
      "opNumber": 10,
      "operationNumber": 10,
      "name": "INYECCIÓN PUR IN PLACE",
      "operationName": "INYECCIÓN PUR IN PLACE",
      "focusElementFunction": "Interno: ... / Cliente: ... / Usuario Final: ...",
      "operationFunction": "Espumar el conjunto funda+varilla en molde...",
      "workElements": [ ... 8 WEs ... ]
    }
  ]
}
```

### 5. Validación post-creación
```bash
node scripts/_lib/amfeValidator.mjs --amfe AMFE-MAESTRO-PU-001
node scripts/_auditAll.mjs --filter AMFE-MAESTRO-PU-001
```
Cero criticos esperados (si hay, abortar y revisar).

### 6. Replicar a 3 Headrest (HF-PAT / HRC-PAT / HRO-PAT)

**Decisión clave:** ¿Sync directo o agregar como OP adicional?

**Opción A (recomendada):** Reemplazar la OP de inyección PU actual de cada Headrest por la del maestro:
- HF-PAT: actual OP 63 → reemplazar por la OP del maestro
- HRC-PAT: actual OP 50 → reemplazar
- HRO-PAT: actual OP 50 → reemplazar

Mantener `opNumber` original de cada producto (NO renumerar) — el maestro provee CONTENIDO, no numeración. Esto está alineado con regla `no-ho-barack.md`: el maestro es independiente de la HO de cada producto.

**Opción B:** Crear OP nueva con sufijo `M` (ej. 63M) y dejar la original — para comparar. NO recomendado, ensucia el AMFE.

### 7. Post-aplicación
- Correr `_auditAll.mjs` global → 0 issues nuevos
- `npm run build` pasa
- Diff de scope: solo deben aparecer los 4 docs tocados (1 family + 1 maestro + 3 Headrest)
- `git add` + `git commit` + `git push` (regla `git-deploy.md`)

## Rollback

Si algo sale mal:
```bash
node scripts/_restoreBackup.mjs --timestamp <YYYY-MM-DD-HHMMSS>
```

El backup es la red de seguridad. NUNCA aplicar sin backup previo.

## Skills/reglas Barack que aplican durante la ejecución

- `supabase-safety` — backup + dry-run + runWithValidation
- `apqp-schema` — estructura JSONB
- `product-map` — mapeo familia → productos
- `amfe-cookbook` — recetas para llenar gaps
- `amfe.md` reglas — severidades, CC/SC, 6M, 3 niveles función
- `amfe-no-inventar-controles.md` — TBD si falta
- `amfe-aph-pending.md` — placeholder en AP=H sin acción
- `injection.md` — diferencia PU vs plástica (6M completo solo en plástica)
- `verify-supabase-live.md` — Supabase es la fuente de verdad
- `rule-enforcement-gate` — verificar que toda regla nueva tenga enforcement

## Tiempo estimado de ejecución del script

~3-5 minutos en total:
- Backup: 30-60s
- Crear family + maestro: <5s
- Replicar a 3 Headrest: <5s cada uno
- Validación + auditor: 1-2 min
- Build: 30s
- Push: 10s

## Quién aprieta el botón

Fak da el "OK" final después de revisar el draft v2 + respuestas de Leonardo. El script corre con flag `--apply` (default es `--dry-run`).
