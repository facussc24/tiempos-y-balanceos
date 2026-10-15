# Encargo para la sesión de la notebook de Calidad (CATA): investigar a fondo y armar el plan del sistema

Lo escribió la sesión Fable 5.1 de la PC principal (DESKTOP-14JG95B) el 15/10/2026 a las 11:30, a pedido de Fak.
La idea de Fak: **la notebook investiga y piensa; la PC principal implementa después** (viernes 17/10 o cuando él diga).
Todo lo que esta sesión necesita está en esta carpeta de la nube, en el repo y en la memoria. **Nada se implementa acá.**

---

## 0. Qué es esta tarea y qué NO es

- **Es**: leer todo lo que Fak dejó, leer lo que se hizo la semana pasada, investigar afuera (doc oficial de Claude Code,
  lo que publica Anthropic, la comunidad, la industria), **decidir** y dejar escrito (1) el plan y (2) el prompt con el que
  la PC principal lo implementa. Fak: *"lo dejo todo en tus manos, vos debés tomar decisiones"*.
- **No es**: implementar. No se toca código del repo, ni hooks, ni `settings.json`, ni skills, ni reglas (el código se
  toca en la PC principal, regla `codigo-madre.md`). No se commitea ni se pushea desde CATA. No se toca Supabase, el arb,
  el servidor Y:, ni Outlook (no se manda ni se programa ningún mail). No se instala nada en CATA.
- **Dónde se abre**: con la carpeta `C:\Dev\BarackMercosul` como proyecto, no «sin carpeta». Sin la carpeta no entran la
  memoria (vive en `~/.claude/projects/C--Dev-BarackMercosul/memory`), las reglas, las skills ni los controles, y esta
  tarea es justamente sobre eso. Lo que esos archivos ocupan es chico: 41.675 tokens de 1.000.000 (medido el 15/10).
  Lo pesado (341 charlas, 13 capturas) lo leen los subagentes, cada uno con su contexto propio: no entra al principal.
- **Dónde se escribe**: solo en esta carpeta (`…\Claude Fak\viernes-17-plan-sistema\`, resuelta con `buscarNube()` de
  `scripts/_lib/nubeRutas.mjs`; nunca en la nube personal de Fak, regla `nube-ingenieria.md`) y en `.sgc-cache/` local.
  Si aprendés algo de Fak que vale para siempre, va a la memoria como siempre.
- **Firma**: ningún archivo que dejes lleva "Claude" en el nombre (regla `core-prohibiciones.md` §9; el guardián frena).

## 1. Antes de empezar (ponerse al día; 5 minutos)

```bash
git -C C:\Dev\BarackMercosul pull                    # si falla: git fetch y leer con git show origin/main:<ruta>
node scripts/_nube.mjs --bajar --aplicar            # memoria, reglas, skills y .sgc-cache nuevos; nunca borra en local
node scripts/_nube.mjs                              # estado: qué subió cada PC (por_pc en _ESTADO.json)
```

Leer en este orden, antes de abrir cualquier otra cosa:

1. Memoria `project_tanda_orquestador_2026-10-10_donde_quedo` (dónde quedó la semana pasada y el orden para retomar).
2. `docs/PLAN_CLAUDE_BARACK_SISTEMA_2026-10-08.md` (el plan grande de la semana pasada: decisiones, fases, bordes).
3. `docs/drafts/LISTA_ORQUESTADOR_2026-10-10.md` y `docs/drafts/PROMPT_ORQUESTADOR_2026-10-10_v7.md` (cómo se trabajó
   con un orquestador y ocho hijas, las 22 reglas de esa tanda, qué salió bien y qué no).
4. `docs/COLA_CAMBIOS_CODIGO.md` (108 menciones de filas HOY-*; lo abierto está en orden; lo tachado lleva su commit).
5. `Claude Fak\investigacion-2026-10-11\SISTEMA_revision_profunda_fable.md` (la API en Fable: dónde se va el esfuerzo,
   los 5 cambios de mayor retorno, 12 preguntas, 3 ideas nuevas). **Todo lo de esa carpeta está sin verificar**: se lee
   como hipótesis, no como dato.
6. `docs/LECCIONES_APRENDIDAS.md` ya entra solo al contexto; las reglas always-on también.

Medir el cupo antes de arrancar y cada hora (`get_usage` o la banda del tablero). **El 15/10 a las 11:00 la semana estaba
al 89 % y renueva el jueves 16/10 a las 13:00** (hora de Argentina). El mod `presupuesto-agentes` no deja salir subagentes
con la semana arriba del 60 % o la ventana de 5 h arriba del 85 %: si arrancás antes del jueves 13:00, leé y pensá sin
agentes hasta que renueve; **no escribas `.agent-cupo-ok`** (Fak autorizó agentes, no gastar la semana que necesita la
implementación). La API con créditos NO está disponible: el ciclo está en rojo (US$ 263 gastados de un tope propio de
US$ 170; `node scripts/_nocturno.mjs --estado`).

## 2. Lo que pidió Fak (sus palabras, con el tipeo corregido; 15/10/2026)

> "La semana pasada hicimos bastantes avances con respecto a mejorar la inteligencia en general, la toma de decisiones,
> que nuestro Claude sea menos propenso a errores y que entienda e implemente una mejor forma de trabajar, con las
> mejores prácticas de la industria. La idea sería que revises esas conversaciones y la carpeta que tengo en el
> escritorio, «viernes 17», así podemos continuar avanzando en implementar un sistema mucho más eficiente, más
> inteligente, con mejores tomas de decisiones… Son muchos datos para analizar, realmente es una tarea muy compleja.
> Me gustaría que en esta etapa únicamente investigues y pienses un plan para implementarlo mañana. Yo solo sé esto:
> que quiero implementar todas esas mejoras, y más mejoras que ni se me ocurren ahora. Lo dejo todo en tus manos: vos
> debés tomar decisiones, pensar un plan, un prompt para que mañana Claude pueda implementarlo. Tenés todos los permisos
> necesarios, podés desplegar la cantidad de agentes que consideres necesaria. Necesito que realmente investigues a
> fondo… y decidas."

Lo que eso significa en la práctica: **la especificación son sus palabras**, las de la carpeta y las de las charlas de la
semana. El plan no se arma desde lo que a mí me parece: cada punto nace de algo que él dijo o de algo medido, y después
se completa con lo que la industria hace mejor («mejoras que ni se me ocurren»).

## 3. Las fuentes, en orden, y dónde están en CATA

**a) La carpeta de Fak** (`01-carpeta-viernes-17-de-fak\`, 27 archivos, copiada tal cual el 15/10 11:20). Se lee TODA,
imágenes incluidas (las capturas se abren con `Read`; son reclamos concretos con la pantalla a la vista):

| Archivo | Qué es |
|---|---|
| `Viernes 17.txt` | La nota madre (13/10): Claude propone poco, «todo se me tiene que ocurrir a mí»; la foto de Pablo Gamboa de cómo ve a sus agentes; errores en hojas de proceso; videos y disco; que el Claude de CATA sea «el mío», actualizado solo |
| `Mejorar la forma de disenar en 3D - Fak 13-10.md` | El pedido de fondo del 3D («convertirte en un verdadero diseñador 3D») con el caso del virolador v14/v15 y los 7 puntos a revisar |
| `audio mio y analisis gemini 4\arquitectura_claude_code_apqp.md` | Lo que Gemini armó a partir del audio de Fak (13/10 20:33): diagnóstico de 4 cuellos de botella y 5 ideas (triage S/M/L, «GitHub primero», fases tipo APQP, ritual de calibración de skills, cirugía de CLAUDE.md). El `.ogg` es el audio original: si CATA no tiene con qué transcribirlo, el `.md` lo cubre |
| `automatizacion barack.txt` | Pedro Ergo le paga aparte por automatizar Barack: cada 1 o 2 semanas una propuesta/implementación nueva (software de GitHub, arb, ECR/ECO, monitoreo con una notebook fija), y un mail de avance a Pedro cada 2 semanas |
| `la forma que tenemos actualmente de abrir nuevas sesiones me molesta.txt` | Que Claude abra sesiones solo, sin el circuito complejo de hoy; mods de la comunidad en GitHub; la vista del chat (colores, letra, fondo): «pásame una foto de cómo se vería y elijo» |
| `otor ejemplo.txt` | Un lugar en la nube con el seguimiento de cada TEMA (el caso: el tornillo de la máquina CNC), para no volver a explicar todo de cero |
| `tuerca y tonrillo.txt` | Observación de Leo (verbal): altura de tuerca y adherencia de rosca; «todo eso debería ser obvio para la skill de diseño 3D» |
| `impresora 3d mejoras.txt` | Revisar el feedback de Leo sobre la skill de impresión 3D y auditarla más a fondo. **Al 15/10 10:25 no hay ningún mail de Leo sobre eso** en el buzón (lo que hay es el mail de Fak del 13/10 12:57 «Impresora 3D Bambu: mandar a imprimir desde Claude» a Carlos, Leo, Paulo y Pablo, y la respuesta de Carlos con un rey de ajedrez para imprimir). Si llega, `python scripts/_mails.py --buscar Bambu --desde 2026-10-13` lo ve: el buzón de Fak también está en la nube |
| `investgiar con gemini 4.txt` | Usar también Gemini para investigaciones profundas, cruzar opiniones «siempre que se base en datos»; ir guardando prompts para Gemini |
| `Segurmaente ya lo sepas.txt` | «La API la estamos desaprovechando, un desperdicio de dólares». Contrastar con el hecho de arriba (ciclo en rojo) y con la memoria `reference_api_claude_clave_y_ciclo`: decidir con números |
| `duda.txt` | «¿Mis chats se guardan automáticamente en la nube?» Ya sí: desde el 09/10 suben a `Claude Fak\claude-registros\` con `_nube.mjs --sincronizar` (desde el 15/10, de todas las carpetas). Decirlo en el resumen |
| `La organizacion de la nube aun tiene mucho potencial….txt` | Archivo vacío: el título es la nota. La nube «desorganizada y sin un plan integral para automatizarlo todo» |
| Las 13 capturas `.png` / `.jpeg` | Cada una es un error o una idea: hojas de proceso que repiten errores, «no conoce las máquinas que posee Ingeniería», «no sabe las medidas de nuestros plotters», «se olvida de lo que ya hablamos», «subagentes: a veces lanzar ahorra», «Nicolás de Calidad me hizo pasar vergüenza», «¿es la mejor forma de laburar con mi notebook secundaria?», la foto de Pablo (WhatsApp 13/10 11:23), y tres capturas del 13/10 sin título |

**b) Las charlas de la semana** (`Claude Fak\claude-registros\<carpeta>\<id>.jsonl`). El índice
`02-indice-charlas-semana.md` tiene las 341 charlas de la PC principal desde el 06/10 con fecha, tamaño, título de la
app y primer pedido de Fak; 93 marcadas con ★ hablan del sistema. Cómo leerlas sin ahogarse:

- Primero **los mensajes de Fak**, no los míos: sus palabras son la especificación. El lector es
  `scripts/_lib/transcriptsFak.mjs` (`listarJsonl`, `quitarAvisos`); `node scripts/_resumenSesion.mjs --archivo <ruta>
  --html` arma una página por sesión con lo que pidió y lo que se guardó.
- Las que más pesan para esta tarea, por título: «Revisión de sesiones anteriores» (06/10, d48b7d91), «Sistema de
  Claudes por área» (06/10), «Sistema Claude · fase 2» (09/10 noche, Fable) y «Sesión nueva: sistema Claude fase 2»
  (10/10), el orquestador y sus 8 hijas (10-11/10), «Prueba de los mods instalados» (11/10), «Claude compartido y
  personal» (13/10, 69e26720), «Mejora del diseño 3D upper trimming» y «Tornillos y tuercas» (14/10), «Actualización
  automática notebook» (14/10, c8974667), «Sincronización de notebook y historial de chats» (15/10, df9d19b8),
  «Identificar tareas pendientes» (14/10) y «Tareas abiertas por prioridad» (15/10).
- Repartir la lectura entre `buscador` (Haiku): cada uno lee N charlas y devuelve, por charla, qué pidió Fak, qué lo
  enojó (sus palabras textuales), qué quedó decidido y qué quedó abierto. Después uno de criterio (Opus) cruza.

**c) El repo** (ya está en CATA): además de lo del punto 1, `docs/PLAN_HOY18_GITHUB_SEGUNDA_PASADA_2026-10-10.md`,
`docs/PLAN_HOY19_SKILLS_FUNCIONES_NUEVAS_2026-10-10.md`, `docs/PLAN_P6_PLANES_DE_CONTROL_2026-10-10.md`,
`docs/PLAN_P9_P10_HOOKS_INCREMENTAL_2026-10-10.md`, `docs/PLAN_P55_AMFE_EN_LA_NUBE_2026-10-10.md`,
`docs/drafts/PROMPT_SESION_NUEVA_2026-10-09_v3.md`, `docs/drafts/PROMPT_SESION_OPUS_2026-10-11_mods.md`,
`docs/drafts/LISTA_SESION_OPUS_2026-10-11_mods.md`, `docs/drafts/LISTA_NOCHE_2026-10-11_controles.md`,
`mods/*/README.md`, y las reglas y skills que cada tema toque (`.claude/rules/`, `.claude/skills/*/SKILL.md`).

**d) El estado medido de la casa** (números, no impresiones): `node scripts/_tokens.mjs` (turnos por modelo),
`node scripts/_hooksTiempos.mjs` (cuánto tarda cada fase del cierre), `~/.claude/mods-log/presupuesto-agentes.log`
(cada decisión del cupo), `~/.claude/.agent-busquedas.log`, `node scripts/_cierreSesion.mjs --sin-build`,
`node scripts/_escritorio.mjs`, `node scripts/_seguimientos.mjs`, el tamaño del contexto fijo (el 15/10: CLAUDE.md +
LECCIONES + reglas always-on = 102 KB, unos 41.000 tokens de «Memory files» en cada sesión; 48 hooks, 30 reglas, 34
skills, 195 scripts en `scripts/`), y el estado de CATA misma (`_ESTADO.json`: qué sube, qué no; qué le falta a CATA
respecto de la PC principal: entornos de Python, `.venv-cad`, mods instalados, tareas programadas).

**e) Lo de afuera** (con link y fecha en cada cita):
- `node scripts/_novedadesClaude.mjs --dias 30`: el registro de cambios de Claude Code y lo que publican Lydia Hallie,
  Thariq y Claude Devs (hace 10 días que no se lee; está pendiente de llevarle a Fak la lista corta).
- La doc oficial de Claude Code (best practices, memory, hooks, subagents, skills, plugins y mods, advisor, routines,
  `/goal`, checkpoints, OpenTelemetry) y los posts de ingeniería de Anthropic (harness design, context engineering,
  long-running agents, evals de skills). Buscar qué hay NUEVO que esta casa no usa.
- La comunidad: mods y plugins de Claude Code en GitHub con estrellas y mantenimiento (Fak pidió «los mejores hechos
  por la comunidad y yo decido»), herramientas de memoria y de seguimiento por tema, y cómo otros resuelven «el agente
  propone solo» y «no repetir errores».
- La industria de Fak: APQP por fases, factibilidad, PPAP, calibración, auditoría en dos direcciones: Gemini propone
  llevarlas al desarrollo de software; evaluar si suma sobre lo que ya hay.
- Gemini: no lo uses desde acá (no hay cuenta configurada en CATA); sí evaluá su documento como una fuente más y
  proponé, si corresponde, cómo y para qué se usaría (memoria `feedback_lo_que_cambia_otro_modelo_se_audita_como_contenido`).

## 4. Los temas que ya están sobre la mesa (que no falte ninguno; agregá los que encuentres)

1. **Claude propone poco; «todo se me tiene que ocurrir a mí»** (`Viernes 17.txt`; Gemini lo llama «sumisión»). Casos: no
   propuso buscar el manual de la impresora 3D ni software de GitHub. Lo que ya hay: la regla de reusar antes de crear,
   HOY-18 (dos pasadas por GitHub), `feedback_la_caja_soy_yo_pensar_fuera_de_lo_que_dijo_fak`. ¿Por qué no alcanza?
2. **Memoria que «se olvida»** (captura «De este tema hablamos en varias ocasiones…»; `otor ejemplo.txt`). Medir con casos
   reales de las charlas (el tornillo CNC, las costuras): ¿la memoria no existía, existía y no se leyó, o el índice no la
   nombraba? De ahí sale si la respuesta es «seguimiento por tema en la nube» (idea de Fak), otra forma de recuperar, o
   las dos. 41.000 tokens fijos de memoria por sesión y aun así se repite: eso es un dato.
3. **Diseño 3D profesional** (`Mejorar la forma de disenar en 3D`, `tuerca y tonrillo`, CATIA, build123d-mcp, simular el
   asiento antes de imprimir; memoria `feedback_diseno_3d_medir_antes_de_explicar_y_simular_el_uso`, skill `cad-design`).
4. **Hojas de proceso que repiten errores** (capturas «error repetitivo en ho», «más problemas en las hojas de proceso»;
   LECCIONES 13/10 *«es increíble que sigamos fallando en esto»*). La skill y el gate existen: ¿qué no ven?
5. **Claude no conoce las máquinas de Ingeniería** (plotter AOL, medidas, impresora 3D, cortadora): capturas del 14/10;
   memoria `reference_plotter_aol_corte_insert` (*«es grave que no sepas a qué plotter me refiero»*). Una ficha por
   máquina que entre sola cuando se la nombra, o lo que resulte mejor.
6. **La nube desorganizada y sin plan integral**; chats automáticos a la nube (ya resuelto el 15/10: decirlo).
7. **La notebook de Calidad**: que sea «mi Claude» igual, que se actualice sola, que sepa que está en CATA; que los videos
   y descargas pesadas se hagan allá (captura «¿es la mejor forma de laburar con mi notebook secundaria?»; memorias
   `project_instalar_mi_asistente_pc_nueva`, `reference_cerebro_en_la_nube_onedrive`; sesiones del 14 y 15/10).
8. **Abrir sesiones nuevas desde Claude**: hoy es `_encargo.mjs` + tarea programada (skill `lanzar-sesion-hija`). La app
   ya tiene `start_session` nativo en la PC principal (15/10): ver si está en CATA y si reemplaza el circuito.
9. **La vista del chat y los mods**: colores, letra, fondo; «pásame una foto y elijo» → la implementación lleva mockups.
   Lo que hay: `tablero-casa` y `presupuesto-agentes` (instalados el 11/10), `recordatorio-ccsc` (no instalado).
10. **La API**: Fak cree que se desaprovecha; el ciclo está en rojo. El agente por API (HOY-24) quedó en `--seco`.
    Decidir con números qué va a créditos, qué al cupo, y qué le conviene a Fak comprar o no (eso es suyo: listita).
11. **Gemini para cruzar investigaciones** y guardar prompts.
12. **Cómo ver a los agentes** (foto de Pablo Gamboa): ¿qué muestra, qué de eso le serviría a Fak, cabe en el tablero?
13. **Automatización de Barack para Pedro**: una cadencia (cada 1-2 semanas una propuesta con evidencia), un criterio de
    qué primero (lo más fácil, arb, ECR/ECO, monitoreo con notebook fija), y el mail de avance cada 2 semanas.
14. **Subagentes y costo** (captura «a veces lanzar subagentes ahorra»): medir con `_tokens.mjs` y el log del mod.
15. **Las 5 ideas de Gemini**: triage S/M/L (existe: `codigo-madre.md`), «GitHub primero» (existe en parte), fases tipo
    APQP con evaluador aparte (existe en parte: auditor Opus, casos de respuesta conocida), calibración de skills
    (existe en parte: `skill-creator` con evals, `_probarMejora.mjs`), cirugía de CLAUDE.md (existe la graduación de
    LECCIONES con tope). **Para cada una: qué hay, qué falta, y evidencia de que lo que hay no alcanza.** No duplicar.
16. **Lo que quedó de la semana pasada** (memoria `project_tanda_orquestador…`, «El orden para retomar»): el agente por
    API, HOY-26/27 (hallazgos de la API a verificar), P6 etapa 3, P9 C1-C3, P14-P18, los mods, C1/H6. Decidir qué de eso
    entra en este plan y qué no, y por qué.

## 5. Cómo investigar (método)

- **Inventario antes de proponer**: para cada tema, qué regla, hook, skill, mod o script YA lo cubre (grep en
  `.claude/`, `scripts/`, `mods/`, la memoria). Lo que existe y falla se demuestra con un caso medido (una charla, un
  archivo, una fecha), no con «me parece». Lo que no existe se propone con una fuente externa que lo respalde.
- **Cada propuesta lleva**: el problema con la cita de Fak y su fecha · la evidencia medida en esta casa · qué dice la
  fuente externa (link + fecha) · las opciones · la decisión recomendada y por qué · el tamaño por `codigo-madre.md`
  (chico / mediano / grande) · qué puede romper · cómo se prueba (un caso de respuesta conocida, antes de darla por
  hecha; `mejora-implementada.md`) · qué necesita de Fak, o «nada».
- **Cruzar fuentes** (skill `cross-check`): ninguna recomendación con una sola fuente; un informe de agente no es una
  segunda fuente (`un_agente_no_es_independiente`).
- **Agentes** (regla `techo-agentes.md`): decir en el chat cuáles, con qué modelo y por qué, antes de lanzarlos.
  `buscador` (Haiku) para leer charlas y capturas en paralelo; `investigador` (Sonnet) por frente de investigación;
  `investigador` con `model: opus` para cruzar y decidir; `auditor` (Opus) al final sobre el plan y el prompt, leídos en
  frío como los leería la PC principal. Fak autorizó la cantidad que haga falta: por su pedido textual (sección 2) se
  escribe `echo 20 > ~/.claude/.agent-limit` (80 puntos cada 10 minutos, 12 h) y se dice. El cupo real manda igual
  (punto 1): con la semana arriba del 60 % o la ventana de 5 h arriba del 85 % no sale ningún agente.
- **Pensar más allá de la lista** («mejoras que ni se me ocurren»): qué hacen los equipos que mejor usan Claude Code y
  esta casa no (medición de costo y tiempo por tarea, evals de skills con casos reales, revisión semanal con números,
  dossiers por tema, observabilidad), y qué de la industria automotriz de Fak aplica al propio sistema. Cada idea nueva
  con su fuente y su caso de uso acá, o no entra.
- **Lo que necesita a Fak no frena nada**: se anota en su listita y se sigue (`feedback_la_caja_soy_yo…`, 09-10/10).
  Fak no quiere preguntas (11/10: *«si vos le das bien los prompts no debería hacer falta»*): lo que es decisión
  técnica se decide con evidencia; lo que es suyo por regla de la casa (plata, cuentas, compras, qué quiere ver en
  pantalla, CC/SC) va a la lista en sus palabras, como sí/no.
- Si Fak pone una hora, rige `trabajar-hasta-la-hora.md` (lista, hora fijada, latido). Si no la pone, se trabaja hasta
  que el plan esté auditado; si el cupo se acaba antes, se guarda el avance en la carpeta y se dice hasta dónde se llegó.

## 6. Entregables (todos en esta carpeta; nada afuera)

1. **`10-PLAN_SISTEMA_2026-10-16.md`** — el plan. Ordenado por lo que más le cambia la semana a Fak contra lo que cuesta,
   agrupado en tandas (qué va primero y por qué). Cada punto con los campos de la sección 5. Más cuatro secciones fijas:
   «Decidí yo» (cada decisión con su evidencia), «Necesita a Fak» (listita de sí/no, en sus palabras),
   «Descartado con motivo», «No pude verificar».
2. **`11-PROMPT_IMPLEMENTACION_2026-10-16.md`** — el prompt con el que la PC principal lo implementa: autocontenido,
   para pegar tal cual. Dice con qué modelo y modo se abre (regla `codigo-madre.md`: Opus 5.5 salvo arquitectura),
   el orden de trabajo, el camino de cada cambio por tamaño, los gates que no se saltean (leer entero antes de editar,
   tests del módulo, `npm run build`, suite completa antes de un push que agrega archivos, auditor Opus, probar la
   mejora con un mensaje real de Fak con `node scripts/_probarMejora.mjs`, decir si las sesiones abiertas la toman
   solas, commit con rutas), cómo se mide que cada mejora funcionó (su caso de respuesta conocida), qué ya está decidido
   y qué espera a Fak sin frenar lo demás. Si conviene una tanda con hijas, el prompt dice cómo (dos activas como
   máximo; el cupo semanal se mira cada hora).
3. **`12-RESUMEN_PARA_FAK.md`** — una página en sus palabras (skill `explicar-mejor`): qué encontré, qué propongo y en
   qué orden, qué decidí solo, qué necesito de él (la listita), y qué de lo que anotó ya estaba resuelto. Sin jerga,
   para leerse una vez. Si una página web lo explica mejor (como `exports/explicaciones/novedades_2026-10-10.html`),
   también, pero el `.md` va igual.
4. **`13-FUENTES.md`** — cada fuente usada: ruta o link, fecha, y para qué punto del plan sirvió.
5. Al terminar: `node scripts/_nube.mjs --sincronizar --aplicar` (sube las memorias nuevas de CATA y sus charlas;
   **nunca `--subir` desde CATA**: es espejo y pisaría lo de la PC principal).

## 7. El cierre (el mensaje final a Fak, en la notebook)

Primero la ruta de los entregables y lo que necesita de él (la listita, o «de vos no necesito nada»); después qué
cambió respecto de lo que él anotó (qué ya estaba, qué se descartó y por qué); después qué encontré. Corto, en
castellano, con sus palabras. El detalle vive en los archivos.

---

## Anexo: lo medido en la PC principal el 15/10/2026 a las 11:00-11:30 (para no volver a medirlo)

- Cupo del plan Max: ventana de 5 h al 11 %; **semana (todos los modelos) al 89 %, Fable al 77 %; renueva el jueves
  16/10 a las 13:00** (hora de Argentina). Uso extra: apagado.
- API con créditos: ciclo 30/09 → 29/10 en rojo (US$ 263,55 gastados de un tope propio de US$ 170); la noche del 15/10
  no arrancó por eso.
- Nube: CATA sincronizó `Claude Fak` el 15/10 a las 10:26 en el commit `1e1d7ee7` (el mismo que la PC principal);
  `claude-registros` tiene 3,2 GB; de las 341 charlas del índice, 335 ya estaban subidas (las 6 que faltan son las
  abiertas esa mañana).
- Repo: HEAD `89fa6b4a` (skill `plotter-aol`), con cambios locales sin commitear en la PC principal (LECCIONES,
  `amfeAutoria`, el flujograma 157 y la cola de `exports/`).
- Contexto fijo por sesión: 102 KB entre CLAUDE.md, LECCIONES y las 10 reglas always-on; `get_usage` lo mide como
  41.675 tokens de «Memory files» sobre 1.000.000.
- Inventario: 48 hooks, 30 reglas, 34 skills del proyecto, 195 scripts en `scripts/`, 3 mods en `mods/` (2 instalados).
- Mails: el buzón de Fak está en la nube hasta el 15/10 10:25 (`_mails.py --buscar` lo lee desde CATA). No hay mail
  de Leo sobre la skill de impresión 3D a esa hora.
- Lo pendiente del arranque de sesión de la PC principal que también le toca a esta tarea: hace 10 días que no se
  lee `node scripts/_novedadesClaude.mjs` (el hook lo pide; Fak decide qué se implementa, nada se aplica solo).
