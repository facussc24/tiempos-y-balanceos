# Segunda opinion independiente — `build123d-mcp`

Instalado el 29/08/2026 y **apagado por defecto desde el 05/09/2026**: se levanta a demanda. Sirve
para contrastar un solido con un motor que no es el mio. El flujo normal no lo usa; esta aca para
cuando haga falta una segunda opinion, con como se enciende y que se puede esperar de el.

## 1bis. Segunda opinión independiente — `build123d-mcp` (instalado 2026-08-29, **apagado por defecto desde 05/09/2026**)

**Se levanta a demanda, no arranca con la sesión.** La auditoría del 04/09/2026 midió **0 llamadas
a `mcp__build123d__*` en toda la historia** y 30 s de timeout de conexión en CADA arranque de
sesión (`uvx` no llega a responder en esta notebook), así que se sacó de `.mcp.json` y de
`enabledMcpjsonServers`. El skill trabaja igual: build123d corre in-process desde `.venv-cad`.
Para usarlo como segunda opinión en una sesión, recrear `.mcp.json` en la raíz del repo con
exactamente esto (versión **pineada 0.3.83**, `BUILD123D_IN_PROCESS=1` **obligatorio en esta
notebook**: el worker subprocess del server se cuelga en Windows — medido: `import_cad_file` no
responde ni con 300 s de budget; in-process responde en 8 s), agregar
`"enabledMcpjsonServers": ["build123d"]` a `.claude/settings.json`, y abrir una sesión nueva: sus
tools aparecen como `mcp__build123d__*`. Al terminar, volver a sacarlo (no commitear el `.mcp.json`).

```json
{ "mcpServers": { "build123d": { "command": "uvx", "args": ["--python", "3.12", "build123d-mcp==0.3.83"],
                                 "env": { "BUILD123D_IN_PROCESS": "1" } } } }
```

**Rol: segunda opinión AL LADO de los gates, nunca reemplazo.** Mide con OCCT pero con una
implementación que no comparte una línea de código con `cadlib`. ICP (`register_icp.py`) y
colisión contra sustrato (`check_collision.py`) siguen siendo nuestros — el MCP no los hace.
Cuándo llamarlo: contra-verificar un volumen/bbox/solape que decide algo; `validate` antes de
entregar (watertight/manifold con diagnóstico: "4 open edges"); `compare kind='shape'` cuando
el cliente manda una revisión nueva de un STEP; `locate_gate_defects` cuando un export falla.

Tools reales de 0.3.83 (los nombres de la doc del branch main NO coinciden):
`import_cad_file(path, name)` · `measure(object_name)` · `validate(object_name)` ·
`compare(a, b, kind='shape'|'fit'|'align')` (fit = interferencia/clearance) ·
`cross_sections` · `locate_gate_defects` · `inspect_part` · `render_view` · `design_audit` ·
`execute` (código build123d con `show()`). El payload JSON viene anidado en
`structuredContent.result` como STRING.

**Evidencia de adopción** (test del propio criterio del ROADMAP, 2026-08-29):
`test_build123d_mcp.py` — volumen analítico 22.429,2037 mm³ exacto (desv 0,0000%), bbox exacto,
solape por construcción 4.500,0 mm³ exacto + status `interpenetrating`, par separado `apart` con
luz 10,0, `validate` ROJO sobre shell abierto y VERDE sobre sólido sano (los dos colores), y
agreement 0,000000% contra gmsh/OCC en un STEP real de 28 sólidos (34.186.208,822 mm³).
**Upgrade de versión = cambiar el pin y re-correr `test_build123d_mcp.py` (exit 0 = adoptar);
nunca subir el pin sin el test.**
