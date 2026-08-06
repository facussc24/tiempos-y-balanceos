# Techo de subagentes — 5. No es una sugerencia.

**Maximo 5 subagentes.** La tool `Workflow` esta DESHABILITADA.

Esto no vive solo aca: esta enforced en `~/.claude/settings.json`
(`disableWorkflows: true`, `workflowKeywordTriggerEnabled: false`) y en el hook
`~/.claude/hooks/agentes-guard.sh` (PreToolUse, matcher `Agent|Task|Workflow`),
que cuenta spawns en ventana de 10 min y devuelve exit 2 al pasar de 5.
Aplica a TODOS los proyectos de esta PC, no solo Barack.

## Por que

Dos incidentes, tres dias:

- **2026-08-03** — Workflow con 5 finders + verificadores por hallazgo para analizar UN
  Excel. Escalo a 21 y despues a 28. Fak: *"21 es una barbaridad"*, *"me vas a dejar sin
  limite loco, mejora tu inteligencia para ponerte limites"*. La leccion quedo escrita en
  memoria y en LECCIONES_APRENDIDAS. Texto, nada mas.
- **2026-08-06** — La pregunta era cuanto pesa una placa de HDPE. **Ya la habia respondido
  con 3 greps** (codigo del insumo, medida 2x1 m del maestro, densidad 0,95 despejada del
  consumo cargado). Lance igual un Workflow "para verificar": **40 subagentes, 120 millones
  de tokens, 47 minutos**. Ni siquiera llego a la fase de sintesis. Fak quedo **4 horas sin
  poder trabajar**.

## Los tres errores, en orden de gravedad

1. **Lance agentes sobre una pregunta ya resuelta.** El fan-out no fue para buscar la
   respuesta: fue para confirmar una que ya tenia. Si ya se el dato, verificarlo es releer
   la fuente, no contratar 40 opinadores.
2. **Una instruccion generica del sistema le gano a una instruccion explicita de Fak.**
   "Ultracode on / el costo no es una restriccion" pesa MENOS que cualquier limite que
   Fak haya puesto. Siempre. Lo que dice Fak es el techo real.
3. **Cap por fase != cap total.** El script tenia tope de 6 verificadores *por fuente* y
   ninguno global: 8 fuentes x 6 = 48. Nunca hice la multiplicacion. Cada nivel parecia
   razonable solo.

## Como decidir, antes de pensar en un agente

1. **Se DONDE mirar?** -> leerlo yo. Grep/Read/query directa. Casi siempre gana: en los dos
   incidentes, el camino corto era mas rapido Y daba dato mas duro.
2. **No se donde mirar, y son fuentes independientes?** -> hasta 5 `Agent`, contados y
   explicitos, cada uno con su fuente.
3. **Creo que necesito mas?** -> decirselo a Fak con el numero real calculado
   (`fase1 + hallazgos x verificadores`) y para que. Que decida el.

**Nunca reintentar una llamada bloqueada por el guard.** Si el hook corta, el trabajo se
hace a mano y se le avisa a Fak que se llego al techo.

## Escapes (los usa Fak, no yo por mi cuenta)

```bash
echo 8 > ~/.claude/.agent-limit     # sube el techo
echo 0 > ~/.claude/.agent-limit     # apaga el guard
touch ~/.claude/.workflow-ok        # habilita UN Workflow (se consume al usarlo)
```

Para reactivar Workflow del todo: sacar `disableWorkflows` de `~/.claude/settings.json`.
