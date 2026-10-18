---
name: novedades-claude
description: "Traer las novedades de Claude, Claude Code y Anthropic y llevarle a Fak la lista corta de lo que nos sirve o nos puede romper — primero las páginas oficiales (registro de cambios de Claude Code, notas de la plataforma, blog, la app de escritorio, GitHub de Anthropic), después X con la sesión de Fak en el navegador de la app (@ClaudeDevs, Lydia Hallie, Boris, Thariq, Alex Albert). Usar cuando Fak pregunte qué hay de nuevo, qué publicaron, las novedades de Claude o de Claude Code, el changelog, qué dijo Lydia o Claude Devs en X o Twitter, o cuando el arranque avise [NOVEDADES DE CLAUDE]. No es para dudas sobre algo de Claude que ya usamos (tareas, contexto, sesiones, cómo funciona una herramienta). Lo que recomiendan no se aplica solo: decide Fak."
---

# Novedades de Claude — páginas oficiales primero, X segundo, y la lista corta para Fak

Fak, audio del 15/10/2026: *«¿no podés acceder directamente a todo lo que publican entrando a ese link, para que no
tengas que sí o sí entrar a X, que vi que te cuesta bastante?»*. Y antes, el mismo día: *«lo de X es muy importante…
esa info vale oro»*. Por eso el orden: **las páginas oficiales primero; X como complemento** (de las 60 páginas que
citaron en X el 15/10, todas eran de los sitios de la lista de abajo; X agrega los hilos de @ClaudeDevs del día del
anuncio y las respuestas de Lydia, que las páginas tardan días en reflejar).

**La regla de Fak, antes que todo: lo que recomiendan no se aplica solo.** Se cruza con lo que ya tenemos y se le
lleva una lista corta (qué nos sirve, qué nos puede romper, qué no nos toca); él decide qué se implementa. Lo que
pide su sí (plata, una regla suya, instalar algo) se le dice con el precio o el cambio exacto al lado.

**Cuándo:** cuando Fak lo pide, cuando el arranque de sesión avisa `[NOVEDADES DE CLAUDE]` (pasó una semana sin
leer) y cada lunes como paso de la tanda 0 del plan del sistema. Una lectura = un archivo
`C:\Dev\BarackMercosul\exports\explicaciones\novedades_<AAAA-MM-DD>.md`: ese archivo es lo que calla el aviso del
arranque. Va en el checkout principal **aunque la sesión trabaje en un worktree**: el aviso corre desde ahí, y lo que
quede en un worktree no lo ve nadie y se pierde al borrarlo.

El lector viejo (`node scripts/_novedadesClaude.mjs`, búsqueda pública de X por FxTwitter) **no lee X desde el
04/10/2026** (la búsqueda contesta 404 en 4 de 5 cuentas). No se borra: su parte del registro de cambios oficial la
sigue usando la noche, que corre sin la app y no puede abrir el navegador. Esta skill lo reemplaza para X.

## 1. Las páginas oficiales (lista fija; se leen enteras)

| Página | Qué trae |
|---|---|
| `https://code.claude.com/docs/en/changelog` | versión por versión de Claude Code (la fuente que manda para «salió en la 2.1.x») |
| `https://code.claude.com/docs/en/whats-new` | el resumen semanal |
| `https://code.claude.com/docs/en/desktop` y `…/desktop-changelog` | la app de escritorio (no tiene entradas fechadas: comparar contra la lectura anterior) |
| `https://claude.dev/blog` | notas largas del equipo de Claude Code |
| `https://www.anthropic.com/engineering` y `https://www.anthropic.com/news` | ingeniería y anuncios |
| `https://platform.claude.com/docs/en/release-notes` | la plataforma y la API (lo que cobra créditos), y las páginas de modelos (`models/overview`, `fable-5-1`, `opus-5-5`) |
| `https://support.claude.com` (planes, uso y créditos) | qué entra en el plan Max y qué cobra aparte |
| `https://github.com/anthropics/claude-code/releases`, `…/skills`, `…/claude-plugins-community` | versiones, skills y plugins oficiales |

Cómo se lee: `WebFetch`, o el navegador de la app con `get_page_text` y `max_chars: 60000` (por defecto corta a ~5.000
y se pierde la mitad de la página). Anotar la **fecha de cada entrada** y la **versión**: de una página sin fechas se
anota «sin fecha» y se compara con lo que decía la lectura anterior. Las versiones instaladas en esta PC pueden ser dos y
se anotan las dos: la de la consola (`claude --version`) y la que corre la app de escritorio, que está en la ruta de
`CLAUDE_CODE_EXECPATH` (`…\claude-code\<versión>\<id>\claude.exe`: la carpeta de arriba de la del ejecutable). El
16/10 daban 2.1.301 y 2.1.299.

## 2. X, con la sesión de Fak (segundo, y con cuidado)

Las cinco cuentas: **@ClaudeDevs** (anuncios y links oficiales: la que más vale), **@lydiahallie** (tips de
configuración, muchos en «Replies»), **@bcherny** (consejos de uso, casi todo respuestas), **@trq212** (método,
esfuerzo, mods), **@alexalbert__** (modelos; pocos posts).

1. **Fak inicia sesión en X en el navegador integrado de la app** (es su sesión, queda guardada). Yo nunca escribo
   usuario ni contraseña. Sin sesión se ven solo los últimos 5 posts de cada cuenta: alcanza para un vistazo de una
   semana; si hace falta más, se le pide en un renglón que inicie sesión.
2. Búsqueda cronológica por cuenta y fechas, **en ventanas de 2 a 3 días por consulta**:
   `https://x.com/search?q=from%3A<cuenta>%20since%3AAAAA-MM-DD%20until%3AAAAA-MM-DD&f=live`
   (la línea de tiempo del perfil saltea posts).
3. **Una sola consulta a X a la vez, con pausa entre consultas** (medido el 15/10: después de 12 a 17 posts por
   consulta X deja de cargar y muestra «Something went wrong» 15 a 25 minutos; con 4 ayudantes a la vez se rompió).
   Si se usa un ayudante, uno solo, con una pestaña que creo yo (`tabs_create`) y le paso en el encargo («usá solo
   `tabId: tab-N`»): dos ayudantes en la misma pestaña pierden lo acumulado. Antes, cerrar pestañas que sobren (el
   panel aguanta ≈ 9).
4. La fecha real sale del atributo `datetime` de cada post (`javascript_tool`:
   `document.querySelectorAll('article time')`); la pantalla dice «22h». X saca del DOM lo que queda arriba: leer,
   bajar (`window.scrollBy(0, 2500)`), esperar 2 s, volver a leer y acumular.
5. Cada link a `anthropic.com`, `claude.com`, `claude.dev` o `code.claude.com` se sigue y la página se lee entera
   (paso 1). Los `t.co` se resuelven navegando. Si la pestaña está oculta y no carga, traerla al frente (`tabs_select`).

Detalle y límites medidos: memoria `reference_leer_x_con_el_navegador_de_la_app`.

## 3. Cruzar con lo que ya vimos y con lo que ya tenemos

Antes de poner algo en la lista, que sea NUEVO y que no esté ya decidido:
- Lo ya leído: `C:\Dev\BarackMercosul\exports\explicaciones\novedades_*.md` (las lecturas anteriores), `.sgc-cache/x-seguimiento/`
  (crudos, artículos y listados del lector viejo hasta el 04/10) y, en la nube de Ingeniería,
  `ASISTENTE INGENIERIA\5- FACUNDO (memoria y configuracion)\viernes-17-plan-sistema\20-informes\novedades_x_2026-10-15.md` (55 puntos del 18/05 al 15/10).
- Lo ya decidido: el plan del sistema vigente (`ASISTENTE INGENIERIA\5- FACUNDO (memoria y configuracion)\viernes-…\10-PLAN_SISTEMA_*.md`: el §4 «Descartado con
  motivo» y lo que cada tanda descartó en su propio texto; buscar el nombre en el archivo entero) y la cola
  `docs/COLA_CAMBIOS_CODIGO.md` (`git grep` del nombre de la función). Lo descartado no se vuelve a proponer salvo
  que la novedad cambie el motivo. Ejemplos del plan del 16/10: fast mode y `/fast` (cobran aparte; §0.5), Managed
  Agents (créditos; tanda 10, P74), `twscrape` y la API paga de X (contra lo que pidió Fak, «de una manera no paga»;
  tanda 10 y punto 0.5).
- Lo que ya tenemos: buscar en el repo (`git grep`), en `~/.claude/settings.json` y en las memorias si la función ya
  está puesta o probada.
- **Una novedad se afirma con su fuente oficial**: un post que dice «salió X» se coteja con el registro de cambios o la
  página (los resúmenes mezclan fechas, versiones y autores).

Lo que se vigila aunque no haya pedido nuevo: **Claude Motion en el plan Max** (Fak, 08/10: *«si Motion está
disponible de ahora en más a veces lo vamos a usar»*; cola H61, fundida en HOY-14).

## 4. La salida: `C:\Dev\BarackMercosul\exports\explicaciones\novedades_<AAAA-MM-DD>.md`

Modelo: `C:\Dev\BarackMercosul\exports\explicaciones\novedades_x_2026-10-16.md` (la primera lectura con este método). Lleva, en este orden:
1. Título con el rango («desde el DD/MM») y la hora de la lectura.
2. **Tabla de páginas oficiales**: Página · Leída (fecha y hora) · Lo nuevo desde la lectura anterior · ¿Cambia algo?
   Una fila por página de la lista fija, también las que no trajeron nada («Nada nuevo»).
3. **X**: un renglón por post que importa, con cuenta, fecha y hora, la URL del post y lo que dice en una frase; y qué
   faltó leer (cuentas sin sesión, ventanas que X cortó).
4. **Qué cambia** para nosotros, en pocos renglones.
5. **La lista corta para Fak**, con sus palabras y una línea por punto: *qué nos sirve* · *qué nos puede romper* ·
   *qué no nos toca*; cada punto con su URL, su fecha y mi recomendación. Lo que pide su sí dice qué sí y cuánto cuesta.

Los crudos de X (lo leído post por post) van a `.sgc-cache/x-seguimiento/` con la fecha en el nombre, para no volver
a leerlos. En el chat, a Fak se le pasa la lista corta y la ruta del archivo; nada se instala ni se cambia en este paso.

## 5. Lo que no hace esta skill

- No aplica nada: ni settings, ni plugins, ni mods, ni versiones. Eso va por el camino de su tamaño
  (`codigo-madre.md`) cuando Fak lo elige.
- No paga nada ni instala nada para leer X.
- No toca las credenciales de Fak en X.
- No reemplaza a la noche: cuando corre, la noche sigue leyendo el registro de cambios oficial con el lector viejo.
