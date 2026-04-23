---
name: Patron canonico PFD - rework_or_scrap (decisiones anidadas con sequence)
description: Patron OBLIGATORIO cuando una pieza es rechazada en control y puede ir a retrabajo O scrap. Usa branchSide.sequence con 3 items. Portado del generator de Google 2026-04-23.
triggers:
  - Generar PFD con retrabajo condicional
  - Operacion de inspeccion que puede terminar en SCRAP o retrabajo
  - Modelar "¿PRODUCTO OK?" + "¿SE PUEDE RETRABAJAR?" en el flujograma
globs:
  - "modules/pfd/**"
  - "scripts/**pfd**"
  - "scripts/**Pfd**"
---

# PFD rework_or_scrap Pattern — Skill Barack

## 🚨 ERROR FATAL COMUN (Doble Rombo Colapsado) 🚨

**NUNCA** declares un nodo `type: "condition"` plano adentro de `branchSide`:

❌ ROTO:
```ts
branchSide: { type: "condition", labelCondition: "¿SE PUEDE RETRABAJAR?" }
```

El motor NO lo soporta sin envoltura — superpondra textos y no dibujara el rombo.

## ✅ PATRON CORRECTO (sequence[] obligatorio)

Para patrones "¿PRODUCTO OK?" -> NO -> "¿SE PUEDE RETRABAJAR?" -> [SCRAP|RETRABAJO] -> TRASLADO, envolver el sub-flujo en `branchSide.sequence` como ARRAY DE 3 ITEMS:

```ts
{
  // Primer rombo
  type: "condition",
  labelCondition: "¿PRODUCTO OK?",   // pregunta principal
  labelDown: "SI",                   // flujo principal continua por abajo
  branchSide: {
    labelNode: "NO",                 // label sobre el brazo horizontal
    sequence: [                      // <-- OBLIGATORIO: array recursivo
      {
        // Item 1: sub-rombo "¿SE PUEDE RETRABAJAR?"
        type: "condition",
        labelCondition: "¿SE PUEDE RETRABAJAR?",  // NO "description"!!
        labelDown: "SI",
        branchSide: {
          type: "terminal",
          text: "SCRAP",
          labelNode: "NO"
        }
      },
      {
        // Item 2: operacion de retrabajo (op-ins con stepId = nextOp + 1)
        stepId: "81",                               // ej OP 80 -> retrabajo 81
        type: "op-ins",
        description: "RETRABAJO DE ADHESIVADO"
      },
      {
        // Item 3: transfer con rework que dibuja el arco curvo de retorno
        type: "transfer",
        description: "TRASLADO A OP 80",
        rework: { targetId: "80" }                  // vuelve a la inspeccion
      }
    ]
  }
}
```

## Claves visuales del patron

- `branch.sequence` con >1 items: renderer usa `<FlowSequence>` recursivo anidado en un `w-[600px]` con `-mt-5` y `top-0 -translate-x-1/2` (no top-1/2).
- Brazo horizontal de `500px` (vs 320px para terminal simple).
- Flechita triangular solo en caso simple (no en sequence).
- `labelDown "SI"` en la spine con `bg-white px-1` para no superponer la linea.
- Arco rework: **CSS puro sin SVG** — `border-l-[1.5px] border-b-[1.5px] rounded-bl-xl` + pequeno triangulo.

## Reglas AIAG VDA 2019 / Google flowchart-generator

| Caso | rejectDisposition | sequence |
|---|---|---|
| Solo scrap (material NOK -> proveedor) | `scrap` | - |
| Solo retrabajo (ajuste simple) | `rework` + `reworkReturnStep` | - |
| Retrabajo O scrap (decision condicional tras QC) | `rework_or_scrap` + `reworkReturnStep` | 3 items auto |
| Seleccion (sort) | `sort` | - |

## stepId del retrabajo

**Patron Google**: si la inspection es OP 80, el retrabajo es OP 81. Si es OP 130, retrabajo es OP 131. Formula: `parseInt(returnId) + 1`.

## Archivos implicados en el codebase

- `modules/pfd/pfdTypes.ts` — `RejectDisposition = ... | 'rework_or_scrap'`
- `modules/pfd/pfdToFlowData.ts` — caso `step.rejectDisposition === 'rework_or_scrap'` construye branchSide.sequence con 3 items automaticamente.
- `modules/pfd/flow/FlowNode.tsx` — `renderBranchSide` (sequence recursivo) + `renderReworkArc` (arco CSS).
- `modules/pfd/flow/FlowSequence.tsx` — renderer vertical principal, se invoca recursivo desde branchSide.

## Como cargar el PFD en scripts

No cargar la sequence en los `pfd_documents.data.steps` manualmente (no es el modelo del PFD Barack). En su lugar:

1. El step decision `PRODUCTO CONFORME?` debe tener:
   - `stepType: 'decision'`
   - `rejectDisposition: 'rework_or_scrap'`
   - `reworkReturnStep: 'OP 70'` (o el que corresponda)
   - `scrapDescription: '...'` (opcional)
2. El mapper `pfdToFlowData.ts` construye automaticamente el `branchSide.sequence` en tiempo de render.

**NO agregar** al JSON los steps standalone "RETRABAJO DE ADHESIVADO" ni "SCRAP DE PRODUCTO NO CONFORME" — los genera el renderer.

## Referencias

- Fuente canonica: `~/Downloads/flowchart_extract/src/App.tsx` (Google generator, 2026-04-23)
- Memoria global: `~/.claude/projects/C--Users-FacundoS-PC-dev/memory/project_pfd_rework_pattern.md`
- Incidentes: Fak gasto ~3 rondas de iteracion en 2026-04-23 por no usar este patron. NO REPETIR.
