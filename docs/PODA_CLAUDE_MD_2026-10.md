# Poda de CLAUDE.md y de las reglas que cargan siempre — PROPUESTA, sin aplicar (tanda 9, pieza 5, 17/10/2026)

**Estado: propuesta. No se aplica sin el A/B de 10 tareas reales** (plan de la tanda, `docs/PLAN_METODO_2026-10-16.md`)
**y sin que Fak vea la lista de lo que se saca.** Lo que él pidió explícitamente que cargue siempre está marcado y no se
toca sin su sí.

## Lo medido (17/10/2026, rama de la tanda 9)

Cargan en cada sesión, antes del primer mensaje: **1.142 renglones, 107 KB** (el 16/10 eran 1.092 y 101,6 KB: en un día
crecieron 50 renglones).

| Archivo | Renglones | KB | Hook o gate que ya lo enseña cuando hace falta |
|---|---|---|---|
| `docs/LECCIONES_APRENDIDAS.md` (por `@import`) | 158 | 27,4 | gate por bullet; cada «graduado a X» ya vive en X |
| `CLAUDE.md` | 218 | 17,7 | varios (carpeta-guard, pedidos-pendientes, cierre-guard, pregunta-guard, viernes) |
| `techo-agentes.md` | 136 | 13,9 | `agentes-guard.sh` y el mod `presupuesto-agentes` |
| `trabajar-hasta-la-hora.md` | 111 | 10,5 | `hora-prompt.sh` (inyecta los 4 pasos al poner la hora) y `hora-guard.sh` |
| `autonomy-contract.md` | 108 | 7,9 | parcial (`apqp-cliente-guard`, `mail-guard`) |
| `core-prohibiciones.md` | 39 | 5,8 | parcial (`_sinFirmaIA.py`, `causas-ajenas-guard`) |
| `caracteristicas-especiales.md` | 77 | 5,6 | `amfeValidator` + dos hooks |
| `git-deploy.md` | 74 | 4,9 | `commit-rutas-guard`, `_gateRepoPublico.mjs` |
| `no-pfd-no-ho.md` | 75 | 4,9 | `ho-numeracion-guard.sh` |
| `codigo-madre.md` | 44 | 4,0 | — |
| `nube-ingenieria.md` | 56 | 3,8 | `nube-personal-guard` |
| `consumos-entregables.md` | 46 | 3,5 | `respaldoCarga.py` + `consumos-entregable-guard` |

Las fuentes que mandan: la doc oficial pide menos de 200 renglones por archivo y manda lo específico a reglas con `paths:`;
«Bloated CLAUDE.md files cause Claude to ignore your actual instructions» (best practices); Anthropic sacó más del 80 %
de su system prompt sin perder en sus evaluaciones (claude.dev, 24/07); ICLR 2026 (arXiv 2602.11988): los archivos de
contexto no mejoran el éxito en general y suben el costo más de 20 %, **pero sirven para prácticas no estándar**.

## El criterio

1. **Se saca** lo que un modelo actual hace solo (lo estándar), lo duplicado entre dos archivos, la historia de cada
   incidente (va a la memoria o al snapshot) y lo que un hook ya le dice a la sesión justo cuando hace falta.
2. **Pasa a una regla con `paths:`** (carga al tocar esos archivos) lo que es de un dominio.
3. **Queda** lo no estándar de Barack: sin firma de IA en ningún documento, CC/SC solo de Fak, no inventar datos técnicos,
   Supabase live como única fuente, castellano argentino con las palabras de Fak, la nube de Ingeniería, el commit con
   rutas, el repo público decidido, la primera vez se pregunta, el código sagrado.

## La propuesta, archivo por archivo (estimación; el número real sale al escribir la versión podada)

| Archivo | Se saca | Pasa a `paths:` o a memoria | Queda | De → a (renglones) |
|---|---|---|---|---|
| `CLAUDE.md` | la tabla de reglas con `paths:` (Claude Code las carga solo); los puntos del arranque que ya dice un hook (carpeta, pedidos, viernes, noche); la historia de cada regla de trato | el detalle de «Propongo», la compactación y el buzón a la memoria de cierre | quién es Fak y cómo se le habla, el protocolo de cierre, comandos, estructura | 218 → ~110 |
| `docs/LECCIONES_APRENDIDAS.md` | los bullets que dicen «graduado a X» enteros (la lección vive en X) | — | las lecciones sin regla ni gate propio | 158 → ~70 |
| `techo-agentes.md` | historia, escapes, detalle del mod | `paths:` sobre `agentes-guard.sh`, `mods/presupuesto-agentes/**` | la tabla de modelo por trabajo, el presupuesto de 40, «un renglón antes de lanzar», «nunca reintentar» | 136 → ~30 |
| `trabajar-hasta-la-hora.md` | lo medido del 09/10, el enforcement detallado | `paths:` sobre los hooks de la hora | **Fak la dejó siempre cargada a propósito (03/10)**: se le pregunta | 111 → ~25 (si Fak dice sí) |
| `autonomy-contract.md` | la historia de §F | la tabla APQP de §F a la skill `apqp-legajo` | las tablas A-E y «la primera vez se pregunta» | 108 → ~60 |
| `no-pfd-no-ho.md` | lo que repite la skill `hojas-de-proceso` | lo de HO a la skill | flujogramas por script, HO solo a pedido, numeración por el flujograma | 75 → ~25 |
| `git-deploy.md` | la historia del repo público | — | build, commit con rutas, push, CI | 74 → ~35 |
| `nube-ingenieria.md` | la tabla de mudanzas pendientes | a la memoria `reference_onedrive_dos_carpetas_barack` | **regla dura de Fak (01/10)**: la regla y la tabla de cuál es cuál | 56 → ~30 |
| `consumos-entregables.md` | — | `paths:` sobre `scripts/_arb*`, `_validarConsumos`, tizadas | — | 46 → 0 siempre (carga al tocar consumos) |
| `core-prohibiciones.md` | la historia de §8 y §9 | — | las 9 prohibiciones | 39 → ~30 |
| `caracteristicas-especiales.md` | — | — | **Fak pidió que cargue siempre (11/09)**: no se toca | 77 → 77 |
| `codigo-madre.md` | — | — | **decisión de Fak (09/10)**: no se toca | 44 → 44 |

**Total estimado: de 1.142 a unos 540 renglones (−53 %)**, y a unos 650 si Fak deja `trabajar-hasta-la-hora` como está.

## La prueba antes de aplicar (A/B, todavía NO corrida)

1. **10 tareas reales**: mensajes de Fak de la semana del 10 al 16/10, textuales, elegidos para cubrir lo que debe frenar
   (firma de IA en un documento, una sigla CC/SC, un dato inventado, un mail que contesta por otra área, un commit sin
   rutas, guardar en la nube personal) y lo que no debe frenar (un pedido común).
2. **Dos brazos** con el mismo método que el banco de casos (`scripts/_evalBanco.mjs`, pieza 4): el contexto actual y el
   podado, cada uno empaquetado como la skill de reglas del brazo; 3 corridas por brazo; juez distinto del medido.
3. **Se aplica solo si lo que debe frenar sigue frenando en las 10** y el resto no empeora; en un commit aparte; y Fak ve
   antes la lista de lo que se saca.

El primer dato ya está: en el banco de la pieza 4, el caso de detección por muestreo dio 100 % con las reglas de AMFE y
0 % sin ellas (una corrida por brazo, 17/10). Esas reglas no se podan: son las no estándar.

## Qué falta y de quién

- **Fak**: tipear `/doctor prompt-audit` en una sesión suya y pegar lo que devuelve (la sesión no puede correrlo); decir
  si `trabajar-hasta-la-hora.md` y `nube-ingenieria.md` pueden pasar a cargar por `paths:`.
- **Una sesión de código**: elegir las 10 tareas, escribir la versión podada en una rama, correr el A/B y traer los
  números. Recién ahí se aplica.
