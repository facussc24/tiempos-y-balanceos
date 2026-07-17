# Changelog Claude Code — features recientes relevantes (fetch directo 2026-07-16)

Fuente: https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md
(el agente del workflow fallo con 500; esto lo fetcheo la sesion principal).

## Memoria/CLAUDE.md/Rules
- 2.1.210: warning de inicio para reglas Write()/NotebookEdit()/Glob() malformadas
- 2.1.207: memory index over-limit warning mide solo contenido cargado
- 2.1.206: /doctor propone recortar CLAUDE.md commiteados (corta lo derivable)

## Skills
- 2.1.212: skills anidadas en subdirectorios .claude/skills cargan al trabajar ahi
- 2.1.181: hot-reload re-anuncia solo skills modificados
- 2.1.169: disableBundledSkills

## Hooks
- 2.1.183: Stop y SubagentStop hooks pueden retornar additionalContext
- 2.1.181: SessionStart/Setup/SubagentStart ya no ocultan stderr con exit 2
- 2.1.207: subagent hooks: permission prompts aparecen en la sesion principal

## Subagents
- 2.1.212: cap por sesion de spawns (default 200, CLAUDE_CODE_MAX_SUBAGENTS_PER_SESSION)
- 2.1.198: subagents corren en background por default
- 2.1.172: subagents anidados (hasta 5 niveles)

## Contexto/MCP/Background
- 2.1.212: MCP calls >2min se auto-backgroundean (CLAUDE_CODE_MCP_AUTO_BACKGROUND_MS)
- 2.1.212: /resume picker de sesiones pasadas; /fork copia conversacion a sesion nueva
- 2.1.186: claude mcp login/logout <name> sin menu interactivo
