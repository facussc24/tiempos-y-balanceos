---
name: amfe_documents.data y cp_documents.data son TEXT, no JSONB
description: Contradice la regla antigua database.md. Los scripts deben usar JSON.parse/JSON.stringify explicitos
type: feedback
---

# La columna `data` de amfe_documents y cp_documents es TEXT

**Why:** Durante la sesion del 2026-04-10 reconstruyendo el maestro de inyeccion, el agente asumio JSONB (siguiendo `.claude/rules/database.md`) y paso un objeto directo a `.update({ data: obj })`. El resultado fue corrupcion: Supabase guardo la representacion char-indexed del string (`{0:'{',1:'"',...}`) porque spreading un string produce un objeto con keys numericas.

Al verificar los documentos existentes (IP PAD, maestro, otros), TODOS se leen como `typeof row.data === 'string'` y requieren `JSON.parse(row.data)` para usar `operations`/`items`. El repositorio TypeScript `utils/repositories/amfeRepository.ts:197` hace `JSON.parse(r.data)` y en save hace `JSON.stringify(doc)`. Misma cosa en cpRepository.

**How to apply:** En scripts .mjs que modifican `amfe_documents.data` o `cp_documents.data`:

```javascript
// LEER
const { data: row } = await sb.from('amfe_documents').select('data').eq('id', docId).single();
const doc = JSON.parse(row.data);  // row.data es string

// MODIFICAR
doc.operations[0].operationName = 'NUEVA';

// GUARDAR
await sb.from('amfe_documents').update({ data: JSON.stringify(doc) }).eq('id', docId);

// VERIFICAR POST-UPDATE
const { data: v } = await sb.from('amfe_documents').select('data').eq('id', docId).single();
if (typeof v.data !== 'string') throw new Error('esperaba string');
const parsed = JSON.parse(v.data);
if (!Array.isArray(parsed.operations)) throw new Error('operations roto');
```

La regla antigua `.claude/rules/database.md` decia "NUNCA `JSON.stringify` en `.update({data})`" asumiendo JSONB. Esa regla sigue siendo correcta para columnas JSONB reales (ho_documents, pfd_documents — verificar caso por caso), pero NO aplica a `amfe_documents` ni `cp_documents`.

**Pendiente**: actualizar `.claude/rules/database.md` con la aclaracion tabla por tabla. Hasta que se haga, este memory es la fuente de verdad.
