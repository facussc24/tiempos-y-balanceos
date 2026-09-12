# Evals — medir si las skills de Barack sirven de algo

Casos de prueba para `claude plugin eval`. La gracia del comando: corre cada caso **con** la
skill y despues **sin** ella (`--ablation with-without`), y reporta la diferencia. Es la unica
forma de contestar "¿las 19 skills cambian algo, o son 5,8 KB de contexto por turno?".

## Estado: escritos, NO ejecutados todavia (11/09/2026)

`claude plugin eval` esta en **early access y no habilitado en esta cuenta**. Tanto `eval` como
`eval init` contestan:

```
`plugin eval` is currently in early access
```

O sea que estos archivos **no se pudieron correr ni validar**. El dia que se habilite, lo primero
es `claude plugin eval init --bare prueba` para sacar la plantilla canonica del binario y cotejar
los campos de abajo contra ella.

### Que esta confirmado y que no

Confirmado, sale del `--help` del binario (v2.1.267):

- La carpeta es `evals/` (o la que diga `experimental.evals` del manifiesto, o `--eval-dir`).
- Un caso es `<caso>/case.yaml`, **o** `<caso>/prompt.md` + `<caso>/graders/*.md`.
- `runs` por caso (default 3), `max_turns` y `timeout_seconds` acotan cada corrida.
- Existe el grader `tool_used`, y `tool_used: Skill` sirve como **indicador de que la skill se
  disparo** — bajo `--ablation with-without` los graders marcados `with-only` se reportan aparte
  del puntaje, no lo contaminan.
- `mocks/` guarda los stand-ins de servidores MCP.
- `--threshold <0..1>` hace que el comando salga con 1 si algun caso queda abajo (sirve de gate).

**Sin confirmar** (escrito de la mejor referencia disponible, a cotejar contra `eval init`):
los nombres exactos de los campos dentro de cada grader (`type`, `criteria`, `focus`, `pattern`,
`match`, `target`). Si el dia de mañana no coinciden, se ajustan: el contenido de los casos —que
es lo que cuesta— no cambia.

## Como se corre (cuando se habilite)

```bash
claude plugin eval . --ablation with-without --no-publish --max-cost-usd 5
```

**`--no-publish` no es opcional.** Por defecto el reporte HTML se publica a claude.ai, y estos
casos llevan causas de AMFE, siglas de caracteristicas especiales y nombres de gente de Barack.
`--max-cost-usd` es el techo, porque cada caso corre 3 veces por brazo y hay dos brazos.

## Los casos

Los cuatro salen de **incidentes reales ya documentados en LECCIONES_APRENDIDAS**. Es el mejor
banco de pruebas que hay: cada uno tiene una respuesta correcta conocida y, sobre todo, una forma
conocida de fallar — la que efectivamente falle.

| Caso | Incidente | Que mide | Modo |
|---|---|---|---|
| `export-amfe-dispara` | — | Si la skill **se activa sola**, sin que yo la nombre | ablacion |
| `consumo-unidad-que-gobierna` | 20/08/2026 — Aplix en dos unidades | Si normalizo a la unidad que gobierna antes de reportar un desvio | ablacion |
| `siglas-s7-o3` | 11/09/2026 — *"es un error gravisimo que debemos corregir para siempre"* | Si justifico la sigla con la S y la O de ESA causa, o la copio de otro documento | regresion |
| `mail-alcance` | *"los agregaste y aclaraste de mas, es un error conocido tuyo"* | Si el mail entra corto o le sumo lo que nadie va a tocar hoy | regresion |

### Por que dos modos, y por que importa

Lo levanto el auditor del 11/09/2026 y es un defecto de diseño que habria quemado presupuesto
sin medir nada: **el manifiesto empaqueta las SKILLS, no las reglas de `.claude/rules/`.**

- Los casos **ablacion** apoyan en una skill que el plugin si empaqueta (`amfe-export-oficial`,
  `verificacion-consumos`). Ahi el brazo "sin plugin" de verdad pierde algo, y el delta
  significa lo que parece que significa.
- Los casos **regresion** apoyan en reglas que cargan por `CLAUDE.md` — always-on
  (`caracteristicas-especiales.md`) o con `paths:` (`mail-envio.md`). Esas reglas entran
  **igual en los dos brazos**, asi que el delta con/sin plugin va a dar ≈ 0 y no prueba nada.
  No son inutiles: miden el puntaje ABSOLUTO, o sea si la conducta se cae con el tiempo. Se
  corren con `--ablation none` y se leen contra el umbral, no contra el delta.

**Un caso cuyos dos brazos cargan lo mismo no puede dar rojo por la razon que dice medir.**
Mezclarlos en una sola corrida seria exactamente el gate que da verde por el motivo equivocado.

```bash
# los que miden aporte del plugin
claude plugin eval . --ablation with-without --no-publish --max-cost-usd 5 --tag ablacion
# los que miden que la conducta no se cayo
claude plugin eval . --ablation none --no-publish --max-cost-usd 3 --tag regresion
```

Los tres primeros de la tabla miden el CRITERIO (¿contesto bien?); `export-amfe-dispara` mide el
DISPARO (¿la skill llega a cargarse?). Se rompen distinto: una skill puede tener el contenido
perfecto y no dispararse nunca — que es exactamente lo que pasaba con `amfe-export-oficial` y
`rule-enforcement-gate` hasta el 11/09/2026.
