---
name: mejorar
description: El molde para cuando Fak dice «quiero mejorar X» (3D, arb, AMFE, patrones, hojas, mails, lo que sea) o «esto me falló otra vez», «hacé que no vuelva a pasar», «entrenate en X», «automejorate». Siete pasos en orden fijo: qué falló (sus mensajes y LECCIONES), qué no sé, qué ya existe hecho y probado (oficial > plugin oficial > repo con miles de estrellas y tests), banco con pieza bien y pieza mal, cambio chico como freno que corre solo (nunca regla de texto), medir de nuevo y sacarlo si no sube, preguntar solo lo de la lista «solo Fak». Primer caso: el 3D del viernes 23/10/2026. No es para un pedido puntual de trabajo (una pieza, un AMFE): eso va con su skill; esto es para mejorar CÓMO se hace.
---

# /mejorar — el molde para «quiero mejorar X»

Fak, 21/10/2026: *«si no logra el objetivo te automejorás: lanzás un equipo de investigadores, corregís algún error hasta
que te salga bien... esto que estamos haciendo para el 3D aplica a todo lo demás también»*. Y 23/10: *«no soy tu laboratorio
de pruebas... busca cosas ya hechas y probadas»*; *«un sistema que aprenda y mejore solo, que me guíe él a mí, en base a
datos y evidencia»*.

Lo que la investigación del 23/10 (`INVESTIGACION_SISTEMA_QUE_APRENDE_23-10.md`, en la nube, `viernes-23-plan-sistema\`)
dejó como único hallazgo firme: **lo que funciona es un corrector que es un PROGRAMA, no otro modelo ni más texto.** En
Barack, donde hubo un freno que se ejecuta la queja bajó; donde hubo solo texto se repitió (de 100 lecciones, 50 quedaron
en texto y unas 8 volvieron con otra fecha). Nadie demostró con medición independiente que «aprender solo» mejore nada:
por eso cada paso de este molde termina en un número.

## Los 7 pasos, en este orden y sin saltear ninguno

| # | Paso | Qué produce | Dónde queda |
|---|---|---|---|
| 1 | **Qué me falló.** Sus mensajes textuales (transcripts `~/.claude/projects/C--Dev-BarackMercosul*/*.jsonl`, `node scripts/_cuatroNumeros.mjs` renglón 3) y LECCIONES. Contar cuántas veces y en cuántas sesiones. Una corrección repetida 3 o más veces en 2 o más sesiones es «lo próximo que conviene mejorar» | lista de fallas con cita, fecha y conteo | `docs/mejoras/<AAAA-MM-DD>-<x>/01_fallas.md` |
| 2 | **Qué no sé.** Escribirlo antes de buscar: qué dato, qué oficio, qué herramienta me falta. Lo que no puedo nombrar como caso anterior es primera vez (`autonomy-contract.md` §F) | lista de huecos | `02_huecos.md` |
| 3 | **Qué ya existe hecho y probado.** Orden fijo: oficial de Claude Code (`/doctor`, `/usage`, `/skill-doctor`, `claude plugin eval`, `/goal`) > plugin oficial (`anthropics/claude-plugins-official`) > repo con miles de estrellas y tests > construir. Se usa antes de construir; lo que se copia viaja con su LICENSE y atribución. Un `buscador` (Haiku) ubica; un `investigador` (Sonnet) compara con lo nuestro sección por sección | cuadro: pieza · lo mejor ya hecho · veredicto (usar / completar / no) | `03_ya_hecho.md` |
| 4 | **Banco con pieza BIEN y pieza MAL.** Por cada falla del paso 1: un caso sano y 2-3 mutantes con la falla real (el mutante real le gana al inventado). El corrector es un script de geometría, texto o datos, nunca otro modelo. Se corre entero, se guarda el puntaje y **se congela** antes de tocar nada: «hoy el sistema caza X de N» | `evals/<banco>/` con tareas, correctores, `scores/congelado.json` | repo |
| 5 | **Cambio chico como freno que corre solo.** Nunca una regla de texto. Un gate con test en las dos direcciones (un caso que da rojo y uno que da verde), modo AVISO 7 días con fecha escrita en su canon y renglón en `scripts/_lib/retiros.data.json`, después freno **con salida para Fak** (su frase lo deja pasar y queda registrado). Tamaño por `codigo-madre.md`; constructor y revisor de modelos distintos | gate + test + caso nuevo en el banco (el caso lo escribe un explorador ANTES del gate y no cuenta para aceptarlo) | repo |
| 6 | **Medir de nuevo y sacarlo si no sube.** `correr.py --congelado scores/congelado.json`: entra solo si el banco congelado sube y nada que pasaba deja de pasar. Si no sube, el cambio se saca (no se «ajusta» el banco). A la semana, la vara externa (`_cuatroNumeros`: avisos de corrección sobre mensajes de Fak; mejoró = 6 % o menos dos semanas seguidas; menos de 3,5 puntos entre semanas es azar) | dos números antes/después | `06_medicion.md` + AVANCE |
| 7 | **Preguntar solo lo de la lista «solo Fak».** Todo lo demás se decide con datos y se informa. Lo que necesita su sí va a un `PREGUNTAS_FAK.md` y el resto sigue | preguntas con la ruta concreta («esto va acá, ¿está bien?») | `PREGUNTAS_FAK.md` |

## La lista «solo Fak» (lo único que se le pregunta; Fak, prompt del 23/10/2026)

Mandar algo a la Bambu o a una impresora de papel · asignar CC/SC · ECR/ECO · mails (ni enviar ni borradores) · escribir en
Supabase (ningún `.mjs` con `--apply`) · abrir u operar el arb · borrar, bajar o instalar algo · gastar plata · la nube
personal (`OneDrive - BARACK ARGENTINA SRL`) · leer o imprimir `.env*` o claves · subir el tope de gasto de la API · tocar
una regla que él pidió que cargue siempre (`caracteristicas-especiales.md`). Lo que un manual, una prueba que puedo correr
o el propio diseño contesta, no se le pregunta (`feedback_la_info_ya_la_tengo_no_preguntar`).

## Lo que NO se hace (aunque haya créditos)

- Lazos que reescriben reglas solos de noche (GEPA, autoresearch, claude-reflect volcando a CLAUDE.md) antes de tener 20
  o más casos ocultos congelados.
- Medir con Opus juzgando a Opus; muchos agentes «para demostrar los créditos» sin una segunda medición.
- Memoria que se escribe sola en MEMORY.md, CLAUDE.md o LECCIONES: están en el límite (25 KB / 28 KB).
- Un control que no puede dar rojo (se prueba con su contraejemplo el mismo día) o que nadie corre (un flag que hay que
  acordarse es un control apagado: el `--detector` del 20/10).

## Cómo arranca

`node scripts/_mejorar.mjs --nuevo "<X, con las palabras de Fak>"` crea `docs/mejoras/<fecha>-<x>/` con el estado de los 7
pasos (`estado.json`, passes:false) y no deja marcar el paso 5 sin el 3 y el 4 escritos, ni cerrar sin la medición del 6.
Sin Fak en la ventana, el trabajo se lista en un archivo, se fija la hora (`trabajar-hasta-la-hora.md`) y se lanza el
latido; los avisos van al AVANCE, no al cierre del turno.

## Primer caso: el 3D (viernes 23/10/2026)

- Pasos 1-3: `viernes-23-plan-sistema\FALLAS_3D_REALES_23-10.md` (7 fallas repetidas: voladizos, tornillo de 7 mm 4 veces,
  choques 4 casos, virolador que se hamaca 3 veces…), `REPOS_CLAUDE_3D_YA_HECHOS_23-10.md` e `informes/03_skill_compare_y_dfam.md`
  (cad-design ya cubría mejor la verificación y el ensamble; se trajeron 6 cosas chicas de agentic-3d-modeling con licencia MIT;
  dfam_tool de text-to-cad para voladizos por área, que se complementa con chequeo_voladizos2 por largo de hilo).
- Paso 4: `evals/banco3d/` (forma de pzfreo/cadgenbench-build123d, Apache-2.0: carpeta por ejercicio, tarea en yaml, puntajes
  guardados, 4 a la vez; invariantes fijas de BenCaunt/SynthCAD, MIT). Siete ejercicios con pieza BIEN y mutantes MAL salidos
  de las fallas reales; `scores/congelado.json` con el «hoy caza X de N».
- Pasos 5-6: los gates del bloque 3 (voladizos antes de laminar con dos votos, `--detector` por defecto, cantos convexos,
  barrido con guardas y luces, tornillos, fases con freno), cada uno aceptado solo si el banco congelado sube.
- Paso 7: `PREGUNTAS_FAK.md` de esa carpeta. El resultado medido del día está en su `AVANCE.md` (cierre de las 20:30).
