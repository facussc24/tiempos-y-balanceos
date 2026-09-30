# Techo de subagentes: 10 en Sonnet 5.5 xhigh; la auditoria final en Opus

**Maximo 10 subagentes en 10 minutos, en Sonnet 5.5 con esfuerzo `xhigh`** (el
anteultimo; el maximo es `max`). La tool `Workflow` esta DESHABILITADA.
Decision de Fak, 30/09/2026: *"cambia la regla de agentes maximo en paralelo, aumentala a 10...
pero solo usando siempre sonnet 5.5 y no en el maximo esfuerzo, en el anteultimo"*. Hasta ese
dia el techo era 5 (desde el 06/08).

Esto no vive solo aca: esta enforced en `~/.claude/settings.json`
(`disableWorkflows: true`, `workflowKeywordTriggerEnabled: false`,
`CLAUDE_CODE_SUBAGENT_MODEL=claude-sonnet-5-5`, sin `_FORCE`) y en el hook
`~/.claude/hooks/agentes-guard.sh` (PreToolUse, matcher `Agent|Task|Workflow`; copia identica en
`.claude/hooks/`), que cuenta spawns en ventana de 10 min, devuelve exit 2 al pasar de 10 y
rechaza todo agente cuya definicion no diga `model: sonnet` (o `opus` si es auditor) y `effort: xhigh`.
Aplica a todos los proyectos de esta PC, no solo Barack.

## Que agente se lanza

| subagent_type | Para que | Donde vive |
|---|---|---|
| `investigador` | trabajo general con todas las herramientas (reemplaza a general-purpose) | `~/.claude/agents/` |
| `explorador` | barrido de solo lectura (reemplaza a Explore) | `~/.claude/agents/` |
| `amfe-healer` | del proyecto, en Sonnet | `.claude/agents/` |
| `auditor`, `auditor-cliente` | **la auditoria final: en OPUS** con effort xhigh | `.claude/agents/` |

**La auditoria final la hace Opus, no Sonnet** (Fak, 30/09/2026: *"la auditoria la deberia hacer
un Opus... es la auditoria final, Sonnet no se si puede hacerla"*). El hook exige `model: opus` en
`auditor` y `auditor-cliente` (lista `AUDITORES`) y rechaza pasarles otro modelo. Por eso en
`settings.json` queda `CLAUDE_CODE_SUBAGENT_MODEL=claude-sonnet-5-5` como default pero SIN
`CLAUDE_CODE_SUBAGENT_MODEL_FORCE` (que ignoraria el `model: opus` de los auditores).

Los built-in (`general-purpose`, `Explore`, `Plan`, `claude`...) no dejan fijar el esfuerzo y
`fork` corre en el modelo de la sesion: el hook los rechaza. Un agente nuevo pasa si su
definicion dice `model: sonnet` y `effort: xhigh`.
Un agente recien creado en `~/.claude/agents` puede tardar en aparecer en la sesion donde se crea
(el 30/09 aparecio a los ~40 min); mientras tanto existe el pase `~/.claude/.agent-builtin-ok`
(el session_id adentro: solo esa sesion, solo si corre en xhigh, y con `model: "sonnet"` explicito
en la llamada). Lo escribo yo, lo digo, y lo retiro al cerrar la sesion.

**Por que existe el techo:** dos incidentes en agosto de 2026, con tres dias de diferencia (21 y
despues 40 subagentes sobre preguntas que ya estaban respondidas; el segundo dejo a Fak 4 horas
sin poder trabajar). La historia, las citas de Fak y los tres errores que los explican: memoria
`techo_agentes_los_dos_incidentes_2026-08`.

## Como decidir, antes de pensar en un agente

1. **Se DONDE mirar?** -> leerlo yo. Grep/Read/query directa. Casi siempre gana: en los dos
   incidentes, el camino corto era mas rapido Y daba dato mas duro.
2. **No se donde mirar, y son fuentes independientes?** -> hasta 10 `Agent`, contados y
   explicitos, cada uno con su fuente.
3. **Creo que necesito mas?** -> decirselo a Fak con el numero real calculado
   (`fase1 + hallazgos x verificadores`) y para que. Que decida el.

**Nunca reintentar una llamada bloqueada por el guard.** Si el hook corta, el trabajo se
hace a mano y se le avisa a Fak que se llego al techo.

## Escapes (los usa Fak, no yo por mi cuenta)

```bash
echo 15 > ~/.claude/.agent-limit    # sube el techo (vale 12 h, despues vuelve a 10 solo)
echo 0 > ~/.claude/.agent-limit     # apaga el CONTEO (idem, 12 h); la regla Sonnet/xhigh sigue
touch ~/.claude/.workflow-ok        # habilita UN Workflow (se consume al usarlo)
```

Si Fak lo pide **textual en el chat** ("usá mas agentes", "no me importa gastar tokens"),
lo escribo yo con `echo 15 > ~/.claude/.agent-limit` y lo digo: Fak no corre comandos. Sin esa
frase suya, no se toca (10/09/2026).

Para reactivar Workflow del todo: sacar `disableWorkflows` de `~/.claude/settings.json`.
