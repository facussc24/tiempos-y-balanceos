# Techo de subagentes: 5

**Maximo 5 subagentes.** La tool `Workflow` esta DESHABILITADA.

Esto no vive solo aca: esta enforced en `~/.claude/settings.json`
(`disableWorkflows: true`, `workflowKeywordTriggerEnabled: false`) y en el hook
`~/.claude/hooks/agentes-guard.sh` (PreToolUse, matcher `Agent|Task|Workflow`),
que cuenta spawns en ventana de 10 min y devuelve exit 2 al pasar de 5.
Aplica a todos los proyectos de esta PC, no solo Barack.

**Por que 5:** dos incidentes en agosto de 2026, con tres dias de diferencia (21 y despues 40
subagentes sobre preguntas que ya estaban respondidas; el segundo dejo a Fak 4 horas sin poder
trabajar). La historia, las citas de Fak y los tres errores que los explican: memoria
`techo_agentes_los_dos_incidentes_2026-08`.

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
echo 8 > ~/.claude/.agent-limit     # sube el techo (vale 12 h, despues vuelve a 5 solo)
echo 0 > ~/.claude/.agent-limit     # apaga el guard (idem, 12 h)
touch ~/.claude/.workflow-ok        # habilita UN Workflow (se consume al usarlo)
```

Si Fak lo pide **textual en el chat** ("usá agentes en paralelo", "no me importa gastar tokens"),
lo escribo yo con `echo 8 > ~/.claude/.agent-limit` y lo digo: Fak no corre comandos. Sin esa
frase suya, no se toca (10/09/2026).

Para reactivar Workflow del todo: sacar `disableWorkflows` de `~/.claude/settings.json`.
