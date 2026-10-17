---
type: tool_used
tool: Skill
input_match: "amfe-export-oficial"
min: 1
---

**Este grader mide el DISPARO, no la respuesta.** No lleva ninguna clave `with-only`: el eval (2.1.301, leido en
el binario el 17/10/2026) marca solo un `tool_used` sobre `Skill` como indicador, y con la clave el caso no carga. Bajo
`--ablation with-without` se reporta como indicador de que la skill se cargo, y no contamina el puntaje del brazo sin
plugin (donde por definicion no puede dispararse).

Es la pregunta que el 11/09/2026 no sabiamos contestar: `amfe-export-oficial` cargaba con la
description descartada por un frontmatter que no parseaba, asi que **no se disparaba sola** —
solo si la nombraba a mano. El prompt de este caso no la nombra ni dice "skill": pide el
resultado, como lo pediria Fak.
