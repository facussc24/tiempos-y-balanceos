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

## WORKFLOW OBLIGATORIO al tocar PFD (Fak 2026-04-23)

1. **Antes de tocar nada**: abrir `/?module=pfdDebug&id=<docId>` en navegador real (production o local)
2. **Hacer el cambio** en el código (mapper, renderer, flowStyles)
3. **Verificar LOCALMENTE**: preview_screenshot o Windows-MCP Screenshot del navegador
4. **Si algo colisiona/corta**: iterar hasta que el screenshot coincida con el target visual
5. **npm run build** pasa (npx tsc --noEmit NO alcanza — debe ser `npm run build`)
6. **git commit + push** (esto dispara deploy GitHub Pages automatico)
7. **Actualizar esta skill** con lo aprendido

## RENDERER NO es Tailwind JIT

`flowStyles.ts` tiene CSS **pre-compilado hardcoded**. Si agregas una clase Tailwind arbitrary (`w-[640px]`, `border-l-[2px]`, etc.) al JSX:
- Dev preview funciona (Tailwind JIT compila al vuelo)
- Export PDF y HTML standalone **NO funciona** (CSS pre-compilado no tiene la clase)

**Protocolo**: cada clase Tailwind nueva DEBE declararse en `modules/pfd/flowStyles.ts` ANTES del commit.

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

## Claves visuales del patron (actualizado 2026-04-23 v2)

- `branch.sequence` con >1 items: renderer usa `<FlowSequence>` recursivo anidado en un `w-[640px]` con `-mt-5` y **`items-start`** (NO `items-center -translate-x-1/2` — ese centrado OCULTA el SCRAP terminal lateral del sub-rombo).
- Brazo horizontal de `200px` cuando hasSequence (brazo corto + sub-flow alineado left permite que el SCRAP quepa dentro de los 640px sin ser cortado).
- `marginLeftClass`: `ml-20` (no ml-28) — brazo sale mas pegado al main flow ahora que el sub-flow se alinea left.
- `armWidth=200` para ambos casos (simple y sequence) — redundante pero claro.
- Flechita triangular solo en caso simple (no en sequence).
- Lineas: `h-[2px]` NO `h-[1.5px]` (html2canvas scale 3 pierde pixels subpixel).
- `labelDown "SI"` en la spine con `bg-white px-1` para no superponer la linea.
- Arco rework: **CSS puro sin SVG** — `border-l-[2px] border-b-[2px] rounded-bl-xl` + pequeno triangulo. `w-[70px] h-[140px] -mt-[70px] mr-8`.

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
- Incidentes: Fak gasto ~6 rondas de iteracion en 2026-04-23 por no usar este patron, no verificar visualmente en browser real, y no declarar clases Tailwind arbitrary en flowStyles.ts. NO REPETIR.

## Ruta debug obligatoria para validacion visual

`/?module=pfdDebug&id=<docId>` carga el PFD con el MISMO renderer del export PDF sin UI de chrome. Fak la usa para que Claude y Fak vean lo mismo durante iteraciones.

URL produccion: `https://facussc24.github.io/tiempos-y-balanceos/?module=pfdDebug&id=pfd-ippads-trim-asm-upr-wrapping`

## Fixes historicos conocidos (NO REPETIR)

| Fecha | Bug visual | Causa root | Fix aplicado |
|---|---|---|---|
| 2026-04-23 v1 | SCRAP terminal invisible en rework_or_scrap | Sub-flow `w-[420px]` + `items-center -translate-x-1/2` cortaba el SCRAP que sale lateral del sub-rombo | w-[640px] + items-start + armWidth reducido a 200px |
| 2026-04-23 v1 | "RETRABAJO DE PRODUCTO CONFORME" en op-ins | Descripcion del retrabajo usaba labelCondition del rombo decision | Ahora usa description de la OP destino (reworkReturnStep → allSteps.find) |
| 2026-04-23 v1 | OP 70 ADHESIVADO tenia label "RETRABAJO (A OP 70)" arriba | OP 70 tenia `rejectDisposition: rework` + `reworkReturnStep: OP 70` (rework a si misma) | Script `fixIpPadPfdOp70Rework.mjs` — cleared a rejectDisposition='none' |
| 2026-04-23 v1 | Lineas horizontales branch split/merge cortadas (3 ramas) | 2N trozos absolute por cada columna .flex-1 con left-1/2 right-0 tenian gaps | 1 solo elemento absolute a nivel padre con `left: 50/N%, right: 50/N%` |
| 2026-04-23 v1 | Lineas desaparecen en PDF | `h-[1.5px]` subpixel rounding a scale:3 en html2canvas | Todas las lineas → `h-[2px]` o `w-[2px]` |
| 2026-04-23 v1 | RECLAMO PROVEEDOR colisionaba FlowReferenceBox | main flow sin padding right reservado para el panel absolute top-right | `style={{ paddingRight: '320px' }}` en FlowSequence container |
| 2026-04-23 v0 | Rombo anidado colapsado con textos superpuestos | `branchSide: { type: 'condition', ... }` plano sin envoltura sequence[] | Patron rework_or_scrap con sequence[] de 3 items |
