---
description: Ciclo de vida de docs/LECCIONES_APRENDIDAS.md — como entra una leccion, como se gradua y el gate por bullet que evita pelear bytes
paths:
  - "docs/LECCIONES_APRENDIDAS.md"
  - "docs/_archive/LECCIONES*.md"
  - ".claude/hooks/session-start-context.sh"
  - ".claude/hooks/cierre-guard.sh"
  - "scripts/_lib/cierreGuard.mjs"
  - "scripts/_lib/cierreCanon.data.json"
---

# Ciclo de vida de las lecciones aprendidas

`docs/LECCIONES_APRENDIDAS.md` entra COMPLETO al system prompt por `@docs/LECCIONES_APRENDIDAS.md`
desde CLAUDE.md (desde el 04/09/2026). Por eso contiene **solo lo accionable que NO esta ya
codificado como regla o gate ejecutable** — lo codificado no se repite ahi.

Por que @import y no el hook: entre el 03/08 y el 04/09 lo inyectaba `session-start-context.sh`,
y Claude Code guarda toda salida de hook mayor a ~10 KB en un archivo dejandole al modelo un
preview de 2 KB. **144 sesiones arrancaron sin leerlo** mientras se hacian 31 consolidaciones
para mantenerlo. El @import no tiene ese tope y sobrevive la compactacion.

## Como entra una leccion nueva

En su seccion TEMATICA, formato `- **DD/MM**:` + 1-4 lineas **legibles**: la regla de
conducta con el minimo de historia que la hace entendible. El detalle largo va a una memoria
(con gancho en el indice) o al proximo snapshot.

## Como se gradua

| Si la leccion es… | Va a… | Y en LECCIONES queda… |
|---|---|---|
| Regla durable | `.claude/rules/` **con enforcement** (skill `rule-enforcement-gate`) | 1 linea de referencia, o nada |
| Conocimiento situacional | memoria auto (`~/.claude/projects/.../memory/`) + linea en `MEMORY.md` | el principio + el nombre de la memoria |
| Procedimiento / meta-proceso | una regla con `paths:` (no siempre-cargada) | el puntero |
| Ya no aplica | snapshot en `docs/_archive/` | nada |

## El gate es POR BULLET, no por bytes

**Enforcement:** `evaluarBullets()` en `scripts/_lib/cierreGuard.mjs`, con los limites en
`scripts/_lib/cierreCanon.data.json` (`lecciones`). Lo corren `node scripts/_cierreSesion.mjs`
(paso "gate por bullet") y el hook Stop `cierre-guard.sh` cuando un mensaje declara cierre.
Tests en las dos direcciones: `__tests__/scripts/cierreGuard.test.mjs`.

| Regla | Limite | Que hacer si no pasa |
|---|---|---|
| Un bullet = una leccion legible | **600 caracteres** | graduar el detalle (memoria / regla / snapshot); NO recortar frases |
| Un bullet que dice "graduado a X" | **2 lineas** | borrar la narrativa: lo graduado ya vive en X |
| Techo del archivo (red, no gobierna) | aviso 26 KB · tope 28 KB | si se llega, es porque hay bullets que no pasaron el gate de arriba |

La causa del ciclo de agosto (17 commits de poda en 19 dias, el archivo oscilando entre 24 y
29 KB, 2,2 consolidaciones por dia) era exactamente esa: los bullets "graduados a X"
conservaban su historia completa. Con el gate por bullet el techo de bytes no se toca.

## Pasada de consolidacion (cuando el gate marca bullets)

1. **Fusionar** lecciones del mismo patron en UN principio con ejemplos minimos.
2. **Graduar** las que ya tengan regla, gate, memoria o skill propios — verificando ANTES que
   el destino contenga el detalle que se va a sacar de aca.
3. **Archivar** al snapshot lo que dejo de aplicar.

## 🔴 PROHIBIDO pelear bytes

**No se reduce una leccion a fragmentos cripticos para ganar bytes.** Si no entra legible, se
gradua; no se achica hasta el ruido. Corolario del 29/08/2026: terminar una consolidacion a
20-30 bytes del aviso es no haberla hecho — si al final el margen es minimo, falta graduar
algo entero, no recortar otra frase.
