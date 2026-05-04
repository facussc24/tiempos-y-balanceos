# Regla: Supabase live es la unica fuente de verdad para AMFE/CP/HO/PFD

## Iron Law

Antes de afirmar el estado actual de cualquier documento APQP (AMFE, CP, HO, PFD, family, product),
**query Supabase live**. Los archivos en `tmp/`, `backups/`, dumps `_all_amfes_dump.json` y
similares son **fotografias historicas** — pueden estar pre-correcciones aplicadas.

## Por que existe esta regla

**Incidente 2026-05-04 (PFD Armrest Door Panel)**: Fak pidio auditar un PFD recien hecho. Lei
`tmp/amfe_audit/AMFE-ARM-PAT.json` y reporte que el PFD le faltaba "OP 72 ENSAMBLE CON SUSTRATO"
porque el dump la tenia. **Era falso positivo.** La OP 72 fue eliminada el 2026-05-04 por
`scripts/_applyAudit2026May04.mjs` PATCH 1 (motivo: "copy-paste roto: nombre vs contenido"). El
AMFE en Supabase ya no la tenia. El dump era pre-patch.

Sin verificar Supabase live, le iba a hacer perder tiempo a Fak corrigiendo un PFD que estaba bien.

## Donde NO confiar (todos historicos por defecto)

| Path | Que es | Frescura |
|---|---|---|
| `tmp/` | Working dir de scripts, dumps de inspeccion | Stale por default |
| `tmp/amfe_audit/*.json` | Snapshots de AMFEs para auditoria | Stale (hechos en una sesion puntual) |
| `tmp/_all_amfes_dump.json` | Dump masivo | Stale |
| `backups/` | Backups de `_backup.mjs` | Stale (hecho en fecha del nombre) |
| `tmp/audit_integral.json` / `.csv` | Output de auditor | Stale |
| `docs/AUDITORIA_*.md` | Reportes de auditorias pasadas | Stale (refleja momento del reporte) |
| `docs/PROPUESTA_*.md` | Propuestas pasadas | Stale, pueden no haberse aplicado |
| `scripts/*.mjs` que tengan datos hardcoded | Datos viejos | Stale por def. |

## Donde SI confiar (orden de preferencia)

1. **Supabase live** — query directo via client. Fuente de verdad absoluta.
2. **AMFE/CP/HO/PFD generados desde la app en este turno** — UI lee de Supabase, asi que es live.
3. **`docs/LECCIONES_APRENDIDAS.md`** — si esta actualizado por el ultimo Claude. **OJO**: si la
   ultima sesion no lo actualizo, esta stale (caso del incidente — el patch 2026-05-04 NO se habia
   documentado ahi, por eso no me protegio).

## Protocolo obligatorio antes de afirmar estado

### Caso 1: Pregunta sobre estado actual ("¿que ops tiene el AMFE Armrest?", "¿esta el PFD del Insert?")

**Query Supabase ANTES de responder.** Snippet inline:

```javascript
// scripts/_tmp_query_<doc>.mjs (descartar despues, NO commitear)
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const envText = readFileSync('.env.local', 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l=>l.includes('=')&&!l.startsWith('#'))
  .map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim()];}));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({email:env.VITE_AUTO_LOGIN_EMAIL,password:env.VITE_AUTO_LOGIN_PASSWORD});

// Tablas y columnas confirmadas (verificadas 2026-05-04):
// amfe_documents:  id, amfe_number, data, updated_at  (data = JSONB, .operations[])
// cp_documents:    id, cp_number, data                (data.items[])
// ho_documents:    id, ho_number, data                (data.sheets[])
// pfd_documents:   id, part_number, part_name, document_number, revision_level, data, step_count
//                  (data.steps[])  — NO tiene project_name, NO tiene pfd_number

const { data } = await sb.from('amfe_documents')
  .select('id,amfe_number,data,updated_at')
  .ilike('amfe_number', '%ARM%').limit(1).single();
const d = typeof data.data === 'string' ? JSON.parse(data.data) : data.data;
console.log('updated:', data.updated_at);
for (const op of d.operations || []) {
  console.log('  OP', op.opNumber || op.operationNumber, '-', op.name || op.operationName);
}
```

Crear el script en `scripts/`, correr, **borrar** despues (no commitear scripts `_tmp_*`).

### Caso 2: Comparar dos versiones (PFD vs AMFE, AMFE vs CP, etc)

Query **AMBAS** desde Supabase live. NO comparar Supabase vs dump tmp.

### Caso 3: Verificar que un patch/script se aplico

1. Leer el script (que cambio)
2. Query Supabase live (estado actual)
3. Confirmar que estado matchea el output esperado del patch

NO confiar en log files de la corrida del script — pueden ser de un --dry-run.

## Cuando SI esta OK leer dumps tmp/

- Para ver **estructura** del JSON (que campos tiene un AMFE, como esta anidado)
- Para entender **historia** (que tenia antes de un cambio)
- Para inspirarse en queries SQL viejas

**Pero NO** para afirmar estado actual ni reportar errores a Fak.

## Senal de alerta: cuando lea un dump, decirme

Si me encuentro citando `tmp/amfe_audit/X.json` o `_all_amfes_dump.json` o `backups/Y/` para
afirmar el estado de un documento APQP, **PARAR** y querar Supabase live antes de seguir.

## Excepciones (raras)

- Si Supabase esta caido temporalmente y Fak necesita una respuesta ya: usar el dump mas reciente
  + decir explicitamente "**Sin verificar contra Supabase live (caido)**: el dump de FECHA dice X.
  Esto puede estar pre-patches recientes."
- Si la pregunta es explicitamente historica ("que tenia el AMFE antes de la auditoria del 04/05?"):
  el dump ES la fuente correcta. Citar fecha.

## Como cita correctamente

| Si la fuente es | Cita asi |
|---|---|
| Supabase live | `[Supabase: amfe_documents.id=XXX | updated_at=YYYY-MM-DD]` |
| Dump tmp/ con verificacion live | `[Supabase live + dump tmp/X.json: matchean]` |
| Dump tmp/ historico explicito | `[Historico: tmp/X.json (puede estar stale, no verificado contra live)]` |

## Vinculo con otras reglas

- Complementa `~/.claude/skills/verify-before-claim/SKILL.md` (agrega fila especifica para Supabase Barack).
- Refuerza `database.md` (verificacion JSONB post-script).
- Conecta con `two-pc-sync.md` (otro tipo de stale: 2 PCs desincronizadas).
