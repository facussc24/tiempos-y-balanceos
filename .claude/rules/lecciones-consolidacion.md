---
description: Ciclo de vida de docs/LECCIONES_APRENDIDAS.md — como entra una leccion, como se gradua y como se consolida al llegar al aviso
paths:
  - "docs/LECCIONES_APRENDIDAS.md"
  - "docs/_archive/LECCIONES*.md"
  - ".claude/hooks/session-close-guard.sh"
  - ".claude/hooks/session-start-context.sh"
---

# Ciclo de vida de las lecciones aprendidas

`docs/LECCIONES_APRENDIDAS.md` se lee COMPLETO al inicio de cada sesion (lo inyecta
`session-start-context.sh`). Por eso contiene **solo lo accionable que NO esta ya codificado
como regla o gate ejecutable** — lo codificado no se repite ahi.

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

## Los gates de tamaño

**Enforcement (ya existente, no nace con esta regla):** `session-close-guard.sh` mide el
archivo al cerrar la sesion — **aviso a los 26 KB (26624)**, **tope duro 28 KB (28672**, corta
en fin de linea y avisa). Al llegar el aviso, **pasada de CONSOLIDACION**, no de poda:

1. **Fusionar** lecciones del mismo patron en UN principio con ejemplos minimos.
2. **Graduar** las que ya tengan regla, gate, memoria o skill propios — si una linea dice
   "graduado a X", su detalle ya no pertenece al destilado.
3. **Archivar** al snapshot lo que dejo de aplicar.

## 🔴 PROHIBIDO pelear bytes

**No se reduce una leccion a fragmentos cripticos para ganar bytes.** Si no entra legible, se
gradua (regla / memoria / archivo); no se achica hasta el ruido. La pelea por bytes sueltos
fue el modo de falla de agosto 2026: **17 commits de poda en 19 dias** y el archivo volvia a
crecer, porque podar no saca la causa.

Corolario aprendido el 29/08/2026: **terminar la consolidacion a 20-30 bytes del aviso es no
haberla hecho** — el proximo aprendizaje la vuelve a disparar. Si al final del pase el margen
es minimo, falta graduar algo entero, no recortar otra frase.
