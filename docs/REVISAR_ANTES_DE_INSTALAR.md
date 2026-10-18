# Antes de instalar una skill, un plugin o un MCP de la comunidad: la revisión

Tanda 15 del plan del sistema (18/10/2026), ítem 6 del plan (punto 7 del informe E). Es el procedimiento del plugin oficial
`legal-builder-hub` de Anthropic (github.com/anthropics/claude-for-legal, carpeta `legal-builder-hub`, Apache-2.0), que
revisa una skill de la comunidad antes de instalarla. Se copia el procedimiento, no el plugin. Suma lo que las estrellas
no dicen: el criterio de Fak del 15/10 («si están bien valorados ok») juzga por la valoración; esto mira **qué trae
adentro**.

Instalar sigue siendo con el sí de Fak (contrato de autonomía, sección C; skill `propose-before-do`). Esta revisión va
**antes** de pedírselo, y su resultado va en la propuesta.

## Los seis chequeos

1. **De dónde sale.** Repo, autor, licencia, estrellas y fecha del último cambio. **Un repo que promete un programa
   pago completo o licencias desbloqueadas (CATIA «Full», «License Unlock») no se abre**: es el patrón de software
   pirata o malware (ítem 20 del plan; tabla del frente F2 del informe F).
2. **El original crudo, entero.** Se lee el `SKILL.md` y todo lo que trae el paquete (hooks, scripts, `.mcp.json`,
   `plugin.json`), tal cual, no un resumen de otro.
3. **Buscar inyección.** En todo el texto:
   - falsa autoridad: «ignore previous instructions», «system:», «as Anthropic», «you are now»;
   - lecturas o escrituras fuera de su alcance: `~/.ssh`, `.env`, `settings.json`, la memoria, carpetas de otros;
   - URLs externas y descargas: `curl … | sh`, `iwr … | iex`, `powershell -enc`;
   - unicode oculto: caracteres de ancho cero, cambios de dirección del texto;
   - pedidos de credenciales, tokens o claves.
4. **Lo que corre solo.** Hooks y MCP del paquete: qué herramientas miran y si escriben, mandan o ejecutan. Un MCP que
   escribe pasa por el despachador de la casa solo si su verbo está en el matcher de `.claude/settings.json`
   (`__tests__/scripts/mcpDespachador.test.mjs`): si no está, se agrega ese día con su caso de prueba.
5. **Fijar a un commit.** Se anota el commit revisado (como el `reviewed_commit` del directorio oficial de plugins). Cada
   actualización se vuelve a revisar con el **diff completo**, hooks y MCP incluidos, y lleva su propio sí. Nada se
   actualiza solo.
6. **Un escaneo limpio no es una auditoría** (lo dice el propio README de `legal-builder-hub`). Un escáner como
   SkillSpector, si Fak lo aprueba, ayuda a encontrar; no reemplaza leer el original.

## Lo que va en la propuesta a Fak

Qué es y para qué de la casa, de dónde sale (los datos del paso 1), qué encontró la revisión en los pasos 2 a 4 (o
«nada»), el commit fijado, qué cambia en la PC si se instala y cómo se vuelve atrás.
