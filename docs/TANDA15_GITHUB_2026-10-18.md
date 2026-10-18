# Tanda 15 — GitHub oficial de Anthropic y la comunidad: qué se hizo y qué espera el sí de Fak

18/10/2026. Sale de los informes del tercer equipo (15/10): `E_github_anthropic.md` (lo oficial) y `F_github_comunidad.md`
(la comunidad), en `ASISTENTE INGENIERIA\5- FACUNDO (memoria y configuracion)\viernes-17-plan-sistema\20-informes\oportunidades\`.
Estrellas, licencias y fechas se toman de esos informes (API de GitHub del 15/10); no se volvieron a medir. **Nada se
instaló**: `claude plugin list` dio lo mismo antes y después (32 renglones; los mismos 4 plugins).

## Lo que necesita a Fak (lo demás está decidido o hecho)

1. **Smart App Control de Windows**, solo si quiere probar text-to-cad: su README pide apagarlo y apagarlo no tiene vuelta
   atrás sin reinstalar Windows. Recomendación: no apagarlo; si se prueba, en una PC donde no importe.
2. **Qué plugins instalar** de la lista de abajo. Recomendación, por lo que cambia contra lo que cuesta: `session-report`
   (oficial, solo lee) y CodeBurn sin `--apply` (solo lee) primero; SkillSpector para revisar lo que venga después.
   Cada uno pasa antes por `docs/REVISAR_ANTES_DE_INSTALAR.md`.
3. **El sí para probar el latido por mod** (ítem 4): es un cambio mediano que toca `hora-guard`; se prueba en una tarde
   con Fak cerca, no en una noche sola.
4. **Destacar la carpeta** `C:\Dev\BarackMercosul` en el selector de la app, una vez en cada PC (ítem 1; 2 minutos, lo
   hace él).
5. Opcional: **si quiere que el borrador de los viernes para Pedro use el formato 3P explícito** (ítem 7); hoy la tarea
   ya pide casi lo mismo y no se tocó.

## Los 20 ítems del plan, con su estado

| # | Ítem | Estado |
|---|---|---|
| 1 | Carpetas destacadas en el selector de la app (Alt+1) | **Hecho antes** (tanda 1.7): CLAUDE.md 0 bis y el hook `carpeta-guard` ya lo dicen. Falta que Fak destaque `C:\Dev\BarackMercosul` en cada PC (2 minutos) |
| 2 | `session-report` y `explain-usage` | **Ficha para el sí** (abajo) |
| 3 | `receipts` | **Ficha para el sí** |
| 4 | El latido oficial por mod | **Ficha para el sí** |
| 5 | `deep-research` | **Ficha** (se copia el método, no se instala: ya viene con la app) |
| 6 | El procedimiento de `legal-builder-hub` | **Hecho**: `docs/REVISAR_ANTES_DE_INSTALAR.md` + renglón en el contrato de autonomía |
| 7 | `internal-comms`, formato 3P | **Hecho** (documentado): opción en `docs/AUTOMATIZACION_PEDRO_TAREA_VIERNES.md`; la tarea de los viernes no se tocó |
| 8 | «Reader Testing» de `doc-coauthoring` | **No es de esta tanda**: el plan lo manda a las tandas 9 y 1.5; la 9 ya armó el `revisor-pedido` (compara contra el pedido), pero el lector sin contexto que solo recibe el documento sigue sin hacerse. Licencia sin confirmar: se copiaría la idea |
| 9 | `regulatory-legal` como molde | **Ficha** |
| 10 | Plugins de la comunidad del directorio oficial (3D CAD Converter, SpeakCAD Slicer, Adds Up, readoc, markitdown) | **No es de esta tanda**: el plan los manda a las tandas 11 y 12 «a mirar»; no se abrieron |
| 11 | text-to-cad | **Ficha para el sí de Fak** (Smart App Control) |
| 12 | automotive-skills-suite | **Ficha** (vara de comparación, nunca fuente) |
| 13 | CodeBurn | **Ficha para el sí** |
| 14 | SkillSpector | **Ficha para el sí** |
| 15 | book-to-skill | **Ficha** |
| 16 | El método de open-steps | **Hecho**: molde `node scripts/_pruebaDisparoSkills.mjs --open-steps <skill>` (25 frases reales + 3 ajenas, 252 llamadas contadas y NO hechas; el encargo dice 225 = 25 × 3 × 3, y el informe F suma las «3 frases ajenas para la dirección contraria»: (25 + 3) × 3 × 3 = 252) |
| 17 | Las señales de humanizer | **Hecho**: 9 avisos nuevos en el canon de `_sinFirmaIA.py`. Ruido medido: 0 avisos en 135 archivos de 20 carpetas de entregables de `exports/` (planes de control, hojas, reclamos, BeOn, borradores de mail; medición propia del 18/10); el auditor midió 789 documentos de `exports/` con 1 aviso (un texto en inglés de Bambu) y encontró frases de los mails de Fak y del manual de AMFE de la casa, que se sacaron de la lista |
| 18 | CAD-Agent-Hub (MCP de CATIA con análisis) | **Ficha** (no sirve hoy: pide R28 y la casa tiene R21) |
| 19 | context-mode | **Ficha** |
| 20 | Aviso: repos que prometen CATIA completa o licencias | **Hecho**: chequeo 1 de `docs/REVISAR_ANTES_DE_INSTALAR.md` |

**La condición previa de los MCP (antes de la lista) ya estaba hecha.** El encargo pedía extender el despachador de
guardianes a las llamadas `mcp__`. Eso lo hizo la tanda 3 (pieza 10), fundida el 17/10, después de los informes del
15/10: matcher por verbo en `.claude/settings.json` y `__tests__/scripts/mcpDespachador.test.mjs`. Lo que sumó esta
tanda:
- los nombres reales de los MCP de los informes, en las dos direcciones: `catia_create_analysis_document`, `ctx_execute`
  de Context Mode y `send_email` de Outlook Classic;
- un arreglo. El código de consola que corre un MCP (`ctx_execute` con `language: shell`) se veía envuelto como Python y
  un `git commit` sin rutas pasaba sin verlo; ahora se mira como el comando que es.

Los seis pedidos conocidos de Bash siguen dando 2 2 2 2 0 0.

**El destrabe oficial de un guardián roto** quedó escrito para Fak en `docs/DESTRABE_GUARDIAN_ROTO.md` y en
`codigo-madre.md`. Se verificó en el ejecutable 2.1.302: «hooks are turned off in your settings (disableAllHooks)» y
«the session runs in safe mode».

## Correcciones medidas (ítem 5 del encargo)

- **hookify no anda en esta casa.** En CATA, `python3` es el atajo de la Tienda (informe E). En la PC principal
  `python3` directamente no existe en la consola (`which python3`: nada, medido el 18/10). Sus 4 hooks fallarían en cada
  herramienta en las dos PC.
- **El escape de etiquetas de la 2.1.292 no afecta a la casa.** Ningún hook escribe `<system-reminder>`; solo lo leen
  del mensaje (informe E, medido el 15/10).
- **Las reglas con `paths:` y la 2.1.293.**
  - Desde la 2.1.288 cargan cuando el archivo se toca con Write o Edit; desde la 2.1.293, también cuando se lee por
    Bash (`cat`, `head`, `sed -n`, `grep`) un solo archivo.
  - Medido el 18/10 en la PC principal: el CLI es **2.1.302** (`claude --version`, `C:\Users\FacundoS-PC\.local\bin\claude.exe`,
    el que corre esta sesión según `CLAUDE_CODE_EXECPATH`). La app de escritorio es **2.42304.0** (la misma de CATA el
    15/10).
  - Por eso el arreglo ya rige acá. Un `cat a b` o un `grep -r` de varios archivos podría seguir sin cargarlas: se
    infiere del texto del cambio, no se probó.
- **Decidí distinto del encargo:** el dato no va en «la ficha de la PC». La PC principal no tiene ficha a propósito
  (`session-start-context.sh:29-30`: «la casa está escrita para ella»). Crearla sumaría su texto a cada sesión de esta
  PC; queda en este documento.

---

## Las fichas

Cada ficha dice: qué le resuelve a la casa · licencia, estrellas y último cambio (del informe) · qué cambia en la PC si
se instala · recomendación con su fuente.

### 2. `session-report` (plugin oficial) y `explain-usage` (viene con la app)
- **Resuelve:** «¿cuánto se fue en cada cosa? explicámelo fácil», por skill y por subagente, cosa que `_tokens.mjs` no
  hace (cuenta turnos por modelo).
- **Datos:** `session-report` en `anthropics/claude-plugins-official` (repo de 39.038★), Apache-2.0, revisado por
  Anthropic en el directorio oficial, último cambio de la carpeta 10/04/2026. `explain-usage` ya está en la app.
- **Si se instala:** un plugin más en `~/.claude/plugins`. Usa `node`, `cp` y `$(date)`, que acá corren por Git Bash; en
  Windows no lo dice y no se probó. `explain-usage` busca los registros en la ruta de Cowork (`$HOME/mnt/.claude/projects`),
  no en la de Claude Code: hay que indicársela.
- **Recomendación:** sí a `session-report`, con la revisión de `REVISAR_ANTES_DE_INSTALAR.md`. Primera prueba: comparar
  su reparto por subagente contra `_tokens.mjs` de la misma semana. Fuente: informe E, ítem 3.

### 3. `receipts` (plugin oficial)
- **Resuelve:** un «recibo» de 7 a 90 días para mostrarle a Pedro qué se hizo con el plan (archivos, commits, por
  proyecto). A propósito, sin dólares ni «horas ahorradas».
- **Datos:** `claude-plugins-official`, Apache-2.0, último cambio 08/10/2026, `reviewed_commit` propio en el directorio.
- **Si se instala:** un plugin. Deja un markdown y un HTML locales; no publica nada.
- **Recomendación:** esperar. Casi todo el trabajo de Fak está fuera de git (Y:, la nube), así que el recibo saldría
  corto; además lleva «Claude Code» en el título (si sale de Ingeniería, `_sinFirmaIA.py` antes). Se prueba después de
  `session-report`. Fuente: informe E, ítem 4.

### 4. El latido oficial por mod (`$.clock.every` + `$.prompt.submit`)
- **Resuelve:** que una sesión con una hora fijada por Fak se despierte sola sin el proceso de Bash en segundo plano
  (`scripts/_latido.mjs`). La noche entera con el latido actual figura como «no pude verificar» en
  `trabajar-hasta-la-hora.md`.
- **Datos:** documentación oficial de los mods (code.claude.com/docs/en/plugins/mods/api.md). Sin licencia que mirar: es
  la API. El mod `tablero` de la casa ya usa `$.clock.every` (`mods/tablero/hooks/register.mjs:96`).
- **Qué habría que probar:**
  1. que `$.prompt.submit` arranque de verdad un turno en la APP de escritorio con la sesión quieta. La doc lo dice; no
     se probó;
  2. con `claude plugin test` y el reloj simulado (`mock.clock`), que con una hora vigente mande el pedido y sin hora no;
  3. una tarde real con la sesión quieta.
- **Qué podría romper:**
  - **`permiso-guard`** toma «una señal de Fak en los últimos 3 minutos» como permiso para mostrarle un cartel. Un turno
    arrancado con `asUser: true` parecería de Fak y abriría carteles con él ausente: **nunca `asUser`**.
  - **`correccion-guard`** y el `cierre-guard` leen los mensajes de Fak. La lista «no es de Fak»
    (`correccionCanon.data.json`, `no_es_de_fak`) hoy no tiene ningún prefijo para un turno arrancado por un mod; habría
    que agregarle el renglón con que el mod firma su pedido, con su test.
  - **`hora-guard`** da el latido por vivo solo si está vivo el proceso de `_latido.mjs` (`latidoVivo`,
    `scripts/_lib/horaGuard.mjs:233`). Con el mod, frenaría el cierre aunque el mod esté latiendo, salvo que aprenda a
    leer la señal del mod.
  - Los temporizadores mueren si el mod se recarga. Mientras convivan, el latido viejo sigue.
- **Recomendación:** sí, como cambio mediano por el camino de `codigo-madre.md`, probado una tarde con Fak cerca. Fuente:
  informe E, ítem 5.

### 5. `deep-research` (viene con la app)
- **Resuelve:** es el «equipo de investigación» publicado: un coordinador que parte la pregunta, investigadores en
  paralelo que dejan notas y un redactor. Trae una tabla de cuántos lanzar (1 puntual, 3 por defecto, 4 a 6 o más según
  el caso). Es lo que la casa arma a mano cada viernes.
- **Datos:** viene con la app (licencia de la app).
- **Si se instala:** nada, ya está. **Tal cual no sirve:** lanza `general-purpose`, que el `agentes-guard` de la casa
  rechaza (`techo-agentes.md`).
- **Recomendación:** copiar el método (la tabla de cuántos y el formato de las notas) a la plantilla del viernes, con
  `investigador` y `buscador` en vez de `general-purpose`. Va con el ritual del viernes, no en esta tanda. Fuente:
  informe E, ítem 6.

### 9. `regulatory-legal` como molde para «salió una norma de VW»
- **Resuelve:** que un cambio de una norma VW o de un requisito del cliente se cruce contra los AMFE, los planes de
  control y las hojas de la casa (hoy nadie lo hace).
- **Datos:** `anthropics/claude-for-legal` (9.692★), Apache-2.0, último cambio 23/07/2026, sin scripts.
- **Si se instala:** **no sirve tal cual**: está atado a las fuentes de normas de EE. UU.
- **Recomendación:** copiar la estructura (`policy-diff` de una norma contra la biblioteca propia + registro de huecos)
  como una tarea nueva, con la primera prueba a mano: una norma VW de la carpeta contra un AMFE de Patagonia, y lo que
  salga es un borrador para Fak. Fuente: informe E, ítem 10.

### 11. text-to-cad
- **Resuelve:** plano acotado en PDF proyectado del 3D, chequeo de imprimibilidad (paredes, voladizos) y revisión DFM de
  inyección, con la regla citada. No resuelve lo del virolador (eso fue el apoyo; lo cubre el gate de asiento de la
  tanda 2).
- **Datos:** `earthtojake/text-to-cad`, 20.697★, MIT, último cambio 15/10/2026.
- **Si se instala:** un plugin y un servidor MCP que escribe archivos. Sus llamadas pasan por los guardianes solo si el
  nombre de cada herramienta lleva un verbo del matcher de la tanda 3 (crear, guardar, exportar, generar…); los nombres
  reales no se conocen todavía: se verifican el día que se instale (chequeo 4 de `REVISAR_ANTES_DE_INSTALAR.md`). Corre en su propio Python con `uv`, no debería pisar `.venv-cad` (sin verificar).
  Manda estadísticas de uso por defecto (`uvx cadgen telemetry off`). **Su README pide apagar Smart App Control de
  Windows 11 si está prendido, y eso no tiene vuelta atrás sin reinstalar Windows**: lo decide Fak.
- **Recomendación:** no apagar Smart App Control por esto. Si Fak quiere probarlo, en una sesión aparte y primero
  midiendo si en la PC principal hace falta (`.venv-cad` ya importa build123d, que usa el mismo módulo: deducción, no
  medido). Fuente: informe F, ítem 1.

### 12. automotive-skills-suite
- **Resuelve:** skills en pares (una arma, otra revisa) de PFMEA, plan de control, PPAP, 8D, MSA y SPC con Cpk. Sirve
  como **vara de comparación** para el estudio de aptitud de máquina (tanda 13) y para un AMFE antes de Calidad.
- **Datos:** `jherrodthomas/automotive-skills-suite`, 3.216★, MIT, último cambio 13/10/2026. Contenido sin leer: vienen
  como paquetes `.skill` y bajarlos ya es instalar.
- **Si se instala:** skills nuevas en la lista de descriptions, que ya pasa el tope de unos 8.000 caracteres (lo midió la
  hija de la tanda 12 el 17/10: en esta PC, `beon` y `planes-de-control` salen solo con el nombre).
- **Recomendación:** **nunca como fuente.** Otra skill de calidad de la comunidad (`Quality-Engineering-Skills`) pide
  acción o justificación para todo AP alto y S 9-10 para las características especiales, y las dos cosas chocan con la casa (`amfe.md` §4,
  `caracteristicas-especiales.md`). Si se prueba, correrla sobre un AMFE ya auditado y separar lo que coincide, lo que
  choca y lo nuevo. Fuente: informe F, ítems 2 y 8.

### 13. CodeBurn
- **Resuelve:** gasto por proyecto, modelo y tarea, y el cupo de 5 h y semanal en vivo; una segunda medición
  independiente de `_tokens.mjs`. Junta las dos PC por la red local.
- **Datos:** `getagentseal/codeburn`, 11.463★, MIT, último cambio 15/10/2026, app para Windows (Store y `.exe`).
- **Si se instala:** una app de escritorio con telemetría (se apaga en la app); baja precios de LiteLLM una vez por día.
  `optimize --apply` **escribe la configuración**: no usarlo.
- **Qué costaría:** el código es MIT, sin pago por usarlo; lee los registros que ya están en el disco y **no llama a
  ninguna API paga** (los precios los baja de una lista pública). Si la app de la Tienda cobra, el informe no lo dice:
  no se verificó. El costo real es el tiempo de mirarla y el riesgo de `--apply`.
- **Recomendación:** sí, solo lectura, con la revisión de `REVISAR_ANTES_DE_INSTALAR.md`; primera prueba: un día ya
  medido con `_tokens.mjs`, comparando totales por modelo. No se sabe si lee las sesiones de la app ni cómo separa las dos
  cuentas de Fak. Fuente: informe F, ítem 3.

### 14. SkillSpector (NVIDIA)
- **Resuelve:** escanea una skill de la comunidad antes de instalarla (patrones maliciosos, inyección, dependencias
  vulnerables contra OSV.dev).
- **Datos:** `NVIDIA/SkillSpector`, 20.298★, Apache-2.0, último cambio 15/10/2026. Se instala con `uv tool install`.
- **Si se instala:** una herramienta de consola. La pasada «con modelo» manda el texto de la skill a un modelo (se puede
  no usar).
- **Qué costaría:** el código es Apache-2.0, sin pago. La pasada estática (la que se usaría) corre en la PC y no gasta
  nada; la consulta de vulnerabilidades va a OSV.dev, que es gratis, y tiene modo sin conexión. **La pasada «con modelo»
  gasta la API del modelo que se le configure**: no se usa (esta casa no hace llamadas pagas sin el sí de Fak,
  `api-claude.md`).
- **Recomendación:** sí, como ayuda del chequeo 3 de `REVISAR_ANTES_DE_INSTALAR.md`, nunca como juez («un escaneo limpio
  no es una auditoría»). Va a dar falsos positivos en skills que corren scripts, que son casi todas las de la casa.
  Fuente: informe F, ítem 6.

### 15. book-to-skill
- **Resuelve:** que el manual de una máquina (Bambu A2L, plotter, CATIA) pase a una skill por capítulos, en vez de
  rasterizar páginas cada vez.
- **Datos:** `virgiliojr94/book-to-skill`, 34.983★, MIT, último cambio 12/10/2026.
- **Si se instala:** un extractor en Python.
- **Recomendación:** probar con el manual de la A2L (corto y con texto) y 5 preguntas de respuesta conocida. **Una skill
  hecha de un manual con derechos (AIAG-VDA, normas VW) no va al repo público**: va a `.sgc-cache/` o a la carpeta de
  skills del usuario. Y el original manda (`documentacion-oficial.md`). Fuente: informe F, ítem 5.

### 18. CAD-Agent-Hub (MCP de CATIA con análisis por elementos finitos)
- **Resuelve:** manejar CATIA por COM con su módulo de análisis (malla, apoyos, cálculo) en vez de armar todo con
  scikit-fem.
- **Datos:** `Cai-aa/CAD-Agent-Hub`, carpeta `MCP/CATIA`, 97★, MIT, último cambio 07/09/2026, solo Windows.
- **Si se instala:** un servidor MCP que corre CATIA. Sus llamadas que crean o guardan pasan por los guardianes (caso de
  prueba de esta tanda).
- **Recomendación:** **no sirve hoy**: lo probaron en V5-6R2023 y dicen soportar desde R28; la casa tiene R21. Queda
  anotado por si CATIA se actualiza. Tampoco se sabe si la licencia de Fak incluye el módulo de análisis. Fuente:
  informe F, ítem 9.

### 19. context-mode
- **Resuelve:** que la salida pesada de las herramientas (páginas de BeOn, lecturas grandes) no llene la charla, y
  recuperar lo hecho después de compactar.
- **Datos:** `mksglu/context-mode`, 29.779★, **Elastic License 2.0** (uso interno sí; no para ofrecerlo como servicio),
  último cambio 15/10/2026, instrucciones para PowerShell.
- **Si se instala:** un servidor MCP que **ejecuta código** (`ctx_execute`). Desde la tanda 3 esas llamadas pasan por los
  guardianes, y desde esta tanda el código de consola se mira como comando (antes un `git commit` sin rutas pasaba).
- **Recomendación:** solo para LEER páginas, nunca para ejecutar; primera prueba: repetir una lectura de BeOn ya hecha,
  con y sin él, y medir el contexto. Con la revisión de `REVISAR_ANTES_DE_INSTALAR.md` antes. Fuente: informe F, ítem 10.

## Lo que no se pudo verificar

- Que `disableAllHooks` destrabe una sesión ya abierta sin reabrirla, y la prueba de punta a punta con un guardián roto
  (la consola de esta PC no tiene la sesión iniciada para lanzar una de prueba).
- Que `$.prompt.submit` arranque un turno en la app de escritorio.
- El contenido de las skills de automotive-skills-suite (paquetes `.skill`).
- Si CodeBurn ve las sesiones de la app y separa las dos cuentas.
- **Encontrado de paso:** `node scripts/_pruebaDisparoSkills.mjs --simular` corrido desde un worktree lee 0 registros,
  porque busca la carpeta de registros por la ruta del worktree. La bandera nueva `--open-steps` ya usa la del checkout
  principal; la prueba de siempre no se tocó (está fuera del pedido).
