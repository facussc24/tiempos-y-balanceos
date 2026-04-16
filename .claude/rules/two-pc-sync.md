# Regla: Sincronizacion 2 PCs — Protocolo Durable

Fak trabaja desde 2 PCs simultaneamente. La desincronizacion rompe todo.

## Protocolo de inicio de sesion (OBLIGATORIO)

En CADA PC, CADA sesion:
1. `cd C:/Users/FacundoS-PC/dev/BarackMercosul`
2. `git fetch origin && git status`
3. Si hay cambios remotos: `git pull origin main` ANTES de tocar cualquier archivo
4. Si hay cambios locales sin commit: `git stash` -> pull -> `git stash pop`
5. Si hay conflictos: REPORTAR a Fak, NO resolver solo
6. **NUNCA empezar a trabajar sin verificar que el repo local esta actualizado**

## Protocolo de fin de sesion (OBLIGATORIO)

1. `npm run build` — verificar que pasa
2. `git add` todos los archivos modificados (incluyendo .claude/memory/, .claude/rules/)
3. `git commit` con mensaje descriptivo
4. `git push origin main`
5. Backup Supabase: `node scripts/_backup.mjs`

## Lo que se sincroniza via git (automatico al hacer pull/push)

| Directorio | Contenido |
|------------|-----------|
| `.claude/rules/` | Reglas de comportamiento (13+ archivos) |
| `.claude/commands/` | Comandos custom |
| `.claude/skills/` | Skills del repo (apqp-schema, product-map, notebooklm-manager, notebooklm-scripts) |
| `.claude/memory/` | Memoria del proyecto (MEMORY.md + 20 archivos) |
| `.claude/agents/` | Agentes (auditor.md) |
| `CLAUDE.md` | Config principal del proyecto |
| `docs/` | Guias, auditorias, lecciones aprendidas |

## Lo que NO se sincroniza (setup manual en PC nueva)

### 1. NotebookLM MCP Server
```bash
claude mcp add notebooklm -- npx notebooklm-mcp@1.2.1
```

### 2. NotebookLM Skill completo (en HOME)
La skill vive en `~/.claude/skills/notebooklm/` con venv y Patchright.
Setup:
```bash
# El primer run.py crea el venv automaticamente
cd ~/.claude/skills/notebooklm
python scripts/run.py auth_manager.py status
```

### 3. Autenticacion Google
Cookies no se comparten entre PCs. En la PC nueva:
```bash
python scripts/run.py auth_manager.py setup
```
O via MCP: usar tool `mcp__notebooklm__setup_auth`

### 4. Auto-memory de Claude Code
`~/.claude/projects/` es path-dependent y NO se comparte entre PCs.
La memoria del proyecto en `.claude/memory/` (git) es la fuente de verdad.
En una PC nueva, Claude Code cargara la memoria del repo automaticamente.

## Checklist post-clone en PC nueva

- [ ] `git clone https://github.com/facussc24/tiempos-y-balanceos.git`
- [ ] `cd BarackMercosul && npm install`
- [ ] `npm run build` pasa
- [ ] `claude mcp add notebooklm -- npx notebooklm-mcp@1.2.1`
- [ ] Auth NotebookLM completada (`setup_auth`)
- [ ] Test: `mcp__notebooklm__ask_question` funciona
