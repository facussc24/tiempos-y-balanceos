# Prompt para la sesión nueva — 10/10/2026, versión 4 (sigue a la v3; escrito a las 00:30 del 10/10 por la sesión de la noche del 09/10)

Pegar tal cual en un chat nuevo abierto en `C:\Dev\BarackMercosul` (**siempre en esta carpeta**). **Modelo: Opus 5.5** (es una sesión
de código común; Fable solo si Fak lo pide: la v3 pedía Fable y la sesión arrancó en Opus, Fak la pasó a Fable a las 23:00).
La **v3** (`docs/drafts/PROMPT_SESION_NUEVA_2026-10-09_v3.md`) y la **v2** siguen siendo la base: sus reglas (v3 §2: las 21 de Fak,
con sus palabras), el programa, cómo se cierra cada tarea, qué agente para qué y cómo se informa **valen enteras y no se repiten
acá**. Lo que cambió esta noche está abajo.

---

Sos mi Claude de Barack Mercosul. Yo soy Fak (Facundo Santoro, Ingeniería de procesos; no soy programador; escribo rápido y con errores
de tipeo, entendé sin corregirme). Esta sesión es **de código y de sistema**: la del AMFE, los mails y el arb es otra. Si en el medio te
pido algo chico de código, lo anotás en `docs/COLA_CAMBIOS_CODIGO.md` y me decís en un renglón que quedó anotado.

## 1. Qué se hizo la noche del 09/10 (todo en `main`, CI verde; cada uno con auditor Opus y commit con rutas)

| Cola | Qué quedó | Commit |
|---|---|---|
| H1 | medido: S1 Opus ~US$6,6 equivalente, Fable revisor ~US$7,4, Fable de F1 ~US$14 (salen del plan, no de los créditos); buscador con `omitClaudeMd`: primer turno de 100 mil a 52 mil tokens (−48 %) | (en la cola) |
| H15 | vigilante de precios, propuestas de skills y prueba de disparo son **pasos semanales de la noche**; la semana la anota la noche en `.claude/state/nocturno-semanal.json` SOLO si el paso salió completo (el auditor encontró que una corrida con todo en error marcaba la semana como hecha: arreglado) | `b12f396d` |
| H16 + H18 | candado 1 por ruta real nativa (nombre corto 8.3) e identidad de disco; una variable de red (`\\localhost\C$`) se ignora; `enParalelo` deja de tomar ítems tras la primera falla; tope por corrida también adentro de la pre-auditoría | `9b796e1a` |
| H2 + H3 | **el latido es `node scripts/_latido.mjs` en segundo plano** (Bash `run_in_background`, descripción que empiece con «LATIDO»): señal por proceso refrescada cada 30 s, espera 9 min; `hora-guard` mira que esa señal esté viva; un CronCreate ya no cuenta. **Lo que la sesión ve del aviso es el exit code: 0 = seguir y relanzar; 4 = ya no hay hora vigente, no se relanza.** Probado: despertó a ESTA sesión quieta (02:14 `dequeue`). La lista de una tanda larga lleva «Trabajo que puedo hacer solo», «Decidí distinto» y «No pude verificar» | `158ac19f` |
| chico | el encargo de una tarea programada (`[SCHEDULED TASK` / `<scheduled-task`) no es un mensaje de Fak (`no_es_de_fak`) | `2440cdbf` |
| H4 | el cierre-guard frena un turno que termina en inglés (chequeo 10, `scripts/_lib/idioma.mjs`; medido sobre 1.568 finales reales: 27 en inglés, 0 falsos en castellano) | `336a1033` |
| H9 + H11 (+H12) | `_sinFirmaIA.py` avisa `logo-no-oficial` (huella, no hash) y `logo-parecido`, y las frases que delatan (`reproceso-delata`, `antes-despues`); se ven como OJO al imprimir y al mandar. **H10 descartado con evidencia** (0 de 1.931 fotos reales conservan datos de cámara). **H12**: `_mailEnviar.py` lista los números con unidad sin papel (`scripts/_lib/numerosMail.py`, con el mail real de Mentvil) | `d8a10643` |
| H8 + H7 | punto 4 de «Como decidir» en `techo-agentes.md` (antes de lanzar: un renglón con cuáles, modelo y por qué; informar, no preguntar) y la medición: desde el 03/10, 143 Sonnet / 156 Opus / 9 Haiku / 6 Fable; 89 Sonnet de solo lectura | `(docs, el commit siguiente)` |

- **La noche de las 06:30 del 10/10 corre con el código nuevo**: los tres semanales no tocan (vigilante corrió el 08, propuestas y
  disparo el 09); se prueba la rama «no toca». Primer semanal real: el vigilante el 15/10, propuestas y disparo el 16/10.
- Gasto de la API esta noche: ~US$1,2 (disparo $0,01, propuestas $1,15 por el camino de la noche). Ciclo: ~$7 de $170.
- **Lo que otras sesiones dejaron sin commitear y NO se toca**: `scripts/_lib/amfeAutoria.mjs` y su test, `scripts/_crearAmfeUpperTrimming.mjs`,
  `docs/auto-mejora/*`, `tools/instalar_mi_pc/LEEME_CARPETA.txt`, `.env.example`; más ~80 sin versionar (limpiezas P45-P48).

## 2. Lo que aprendió esta sesión (además de las 21 reglas de la v3)

1. **Un control que suma trabajo a un chequeo con tope de tiempo se mide en el MODO en que corre ese chequeo.** El logo y las frases
   nuevas llevaron el detector de 55 s a 90 s sobre 89 archivos; el cierre lo corta a los 90 s y lee «vacío» como limpio: el chequeo de
   firma del cierre quedó ciego hasta que el auditor lo midió. Arreglo: lo caro (imágenes, cargar el libro) solo con avisos pedidos o
   un bloqueante; `--sin-avisos` (el cierre) volvió a 57 s con los mismos 49 bloqueantes.
2. **El auditor Opus encontró un error de verdad en 3 de los 4 cambios medianos** (semana marcada con la corrida fallida; recurso de red
   que abría el repo; detector que dejaba ciego el cierre). No se saltea nunca, y sus hallazgos se verifican y se arreglan antes del commit.
3. **La herramienta Bash colapsa las barras invertidas**: cinco scripts de esta noche llegaron rotos por `node -e` / heredoc. Un script con
   `\n`, regex o rutas se escribe con **Write** y se corre por ruta (memoria `bash_tool_colapsa_barras_invertidas`; el guardián lo frena a
   partir de 5 KB, pero los cortos también se rompen).
4. **`[SCHEDULED TASK` es un encargo, no Fak**: `horaGuard` tomaba el encargo de la tarea programada como su último mensaje.
5. **El `regex` de una frase que delata se prueba contra los NOMBRES DE OPERACIÓN reales** («Reproceso: eliminación de hilo sobrante»): la
   primera versión marcaba 11 de 11 falsos. La buena pide el verbo que confiesa pegado a «reproceso».

## 3. El orden de trabajo que sigue (la cola manda: `docs/COLA_CAMBIOS_CODIGO.md`)

9. **H14 + P26** · entregables de `exports/` en el cierre (solo lo escrito en el turno y nombrado como final; 536 archivos hoy) y TBD antes
   de imprimir · 11. **H20 + H21** · novedades siguiendo los links y por ventanas · 12. **H23 + H24** · lo crítico de cuatro skills arriba
   del corte y descriptions con «Usar cuando» · 13. **H25-H27** · condición del 06/10 en consumos y vigilante del arb · 14. **H30 + H31** ·
   `correccion-guard` pide decidir, no copiar · 15. **H5 + H6** · el cierre empieza por lo que necesito de Fak; el aviso del cartel.
   Después, el resto de HACER YA en el orden de la cola (H17, H19, H22, H28…).

## 4. Lo que necesita a Fak (por el chat, en una lista corta)

- **P83 (nueva):** el formulario de hoja de proceso de la casa (HO 21-9463 a 9475, termoformado, las hojas de embalaje de Gamboa) lleva
  el logo de letras finas con raya, el mismo que marcó como no oficial en el PowerPoint de IMDS. ¿El formulario también pasa al oficial?
  Si sí: se prende `--logo-bloquea` en el cierre (una línea) y se corrige el formulario con Calidad.
- **Fuera del diff, lo encontró el auditor:** `exports/HO_CORREGIDAS_20261007` e `IMPRESION_0710_FINAL` tienen **49 bloqueantes reales**
  de firma (`claude` / complemento en los xlsx de HO). Son copias de trabajo; las HO del servidor se barrieron el 08/10. Decir si se
  limpian o se borran esas carpetas.
- Las 82 propuestas ya contestadas el 09/10 16:55 están anotadas fila por fila (buscar «Fak 09/10 16:55»); P5 espera la lectura a
  mano de los 89 Sonnet de solo lectura (H7).

## 5. Cómo arrancar

Mirá en qué modelo corrés y decilo en la primera línea. Leé `docs/COLA_CAMBIOS_CODIGO.md` entera y la v3 §2. `node scripts/_claude.mjs
--check` y `node scripts/_nocturno.mjs --estado` (la noche de las 06:30 ya corrió: mirá si los semanales dicen «no toca»). Después un
solo mensaje con: (a) el estado en tres renglones (sin commitear y de quién, la noche y el CI, el gasto de la API), (b) por cuál paso
arrancás y por qué, (c) qué agentes o pedidos a la API vas a lanzar. Y arrancás sin esperar mi sí: es trabajo tuyo y reversible.
