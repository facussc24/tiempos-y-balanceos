---
name: notebooklm-manager
description: Gestionar notebooks en NotebookLM — crear, eliminar, subir fuentes, registrar en MCP. Usar cuando Fak pida crear/eliminar/reorganizar notebooks, subir documentos, o resetear NotebookLM. NO usar para consultas (para eso usar el skill "notebooklm").
user-invocable: true
---

# NotebookLM Manager

Skill para gestionar notebooks de Google NotebookLM desde la terminal. Crear, eliminar y organizar notebooks con browser automation headless (Patchright).

## Cuando usar esta skill

- "Creame un notebook en NotebookLM"
- "Subí estos archivos a NotebookLM"
- "Eliminá los notebooks viejos"
- "Reseteá NotebookLM"
- "Reorganizá los notebooks"
- Cualquier operacion CRUD sobre notebooks (no consultas)

## Pre-requisitos

- MCP `notebooklm` instalado (`npx notebooklm-mcp@latest`)
- Auth completada (`mcp__notebooklm__setup_auth` o skill notebooklm auth)
- Cookies en: `~/AppData/Local/notebooklm-mcp/Data/browser_state/state.json`
- Scripts en: `~/.claude/skills/notebooklm/scripts/`

## Comandos disponibles

### 1. Crear notebook + subir fuentes

```bash
cd ~/.claude/skills/notebooklm
PYTHONIOENCODING=utf-8 python scripts/run.py create_notebook.py \
  --name "Nombre del Notebook" \
  --files "/ruta/archivo1.md" "/ruta/archivo2.md" ...
```

**Opciones:**
- `--name` (requerido): Nombre para el notebook
- `--files` (requerido): Lista de archivos a subir como fuentes
- `--visible`: Mostrar browser (default: headless)

**Comportamiento:**
- Intenta persistent context primero, cae a non-persistent si Chrome esta abierto
- Navega a notebooklm.google.com, click "Nuevo", sube archivos, renombra
- Retorna la URL del notebook creado

**Despues de crear, SIEMPRE registrar en MCP:**
```
mcp__notebooklm__add_notebook con url, name, description, topics, use_cases
```

### 2. Eliminar notebooks

```bash
cd ~/.claude/skills/notebooklm
PYTHONIOENCODING=utf-8 python scripts/run.py delete_notebooks.py
```

**IMPORTANTE — Limitaciones conocidas:**
- El script de eliminacion es FRAGIL con el DOM de Angular Material de Google
- Funciona mejor con pocos notebooks (1-4 en pantalla)
- Puede clickear menus equivocados si hay muchos notebooks
- Siempre re-verifica el resultado con screenshot despues

**Alternativa mas segura para eliminar:**
1. Pedir al usuario que elimine manualmente desde notebooklm.google.com
2. Solo usar el script para eliminar 1-2 notebooks especificos

**Despues de eliminar, SIEMPRE limpiar MCP:**
```
mcp__notebooklm__remove_notebook con id del notebook
```

### 3. Listar notebooks en MCP

```
mcp__notebooklm__list_notebooks
```

### 4. Activar notebook para consultas

```
mcp__notebooklm__select_notebook con id
```

### 5. Re-autenticar

```
mcp__notebooklm__setup_auth con show_browser=true
```

O via skill:
```bash
cd ~/.claude/skills/notebooklm
PYTHONIOENCODING=utf-8 python scripts/run.py auth_manager.py setup
```

## Flujo completo: Reset + Reorganizar

1. Eliminar notebooks del MCP: `mcp__notebooklm__remove_notebook` por cada uno
2. Eliminar notebooks de NotebookLM: manualmente o con delete_notebooks.py
3. Crear nuevos notebooks: `create_notebook.py --name X --files ...`
4. Registrar en MCP: `mcp__notebooklm__add_notebook`
5. Activar default: `mcp__notebooklm__select_notebook`
6. Verificar: `mcp__notebooklm__ask_question` con pregunta de prueba
7. Actualizar memoria: `reference_notebooklm_setup.md` con nuevas URLs

## Notebooks actuales (2026-04-16)

| ID | Nombre | Fuentes | URL |
|---|---|---|---|
| apqp-guias-y-conocimiento | APQP Guias y Conocimiento | 13 | fd0098cb-5e9a-4568-a164-a8e41baddfd1 |
| auditorias-e-historial | Auditorias e Historial | 14 | 7ec68301-e964-4c7e-841e-4a939fb050ed |

## Notas tecnicas

- **Profile lock**: Cuando Chrome del usuario esta abierto, el persistent context falla (exitCode=21). El script tiene fallback automatico a non-persistent con storage_state.
- **Cookies**: Se inyectan desde `~/AppData/Local/notebooklm-mcp/Data/browser_state/state.json` (49 cookies aprox)
- **Patchright**: Fork de Playwright con anti-deteccion. Usa `channel="chrome"` (Chrome real del sistema).
- **Headless default**: Los scripts corren headless por defecto. Usar `--visible` solo para debug.
- **Limites free tier**: 50 fuentes/notebook, 50 queries/dia, 500K palabras/fuente, 100 notebooks max.
