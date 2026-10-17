# Auditoría de la tanda 6, ronda 2 (la última) — 17/10/2026

Rama `claude/vista-tanda6-1017`, worktree `.claude/worktrees/vista-tanda6-1017`. **Lo auditado es ef41a9c5** (el arreglo
de lo que marcó la ronda 1, `TANDA6_VISTA_auditor_2026-10-17.md`). Por ser la ronda 2 se miró solo ese diff; lo que
queda abierto va al cierre para Fak. No apliqué nada.

## Resultado: FALLO · 2 Importante, 3 Nit, 0 Preexistente

| Check | Estado | Detalle |
|---|---|---|
| TypeScript | OK | `tsc --noEmit`: 0 errores |
| Build | OK | `npm run build`: `built in 44.49s` (la rama no toca la app) |
| Tests | OK | `programita.test.mjs` 18/18, 63,6 s |
| Git local | OK | árbol limpio en ef41a9c5 (este informe queda sin commitear, como se pidió) |
| GitHub sync | aviso | 4 commits de la rama no están en GitHub: lo esperado para una rama de hija |
| CI | OK en main | `candado.yml` completed success 4322d932 · `deploy.yml` completed success 411f200f |
| Firma | OK | `py -3 scripts/_sinFirmaIA.py` sobre la página real de hoy y sobre una armada con rutas que traían «Claude» (ya cambiadas por `esc()` antes de pasar el detector): 0 bloqueantes, 0 avisos |

Las pruebas están en el scratchpad de la sesión madre (`node <archivo>`): `r2_impresora.mjs`, `r2_resultado.mjs`,
`r2_arb.mjs`, `r2_arb_caida.mjs`, `r2_atraso.mjs`, `r2_esc.mjs`, y las de la ronda 1 (`seg_real.mjs`,
`replay_resultado.mjs`) corridas de nuevo contra ef41a9c5. La página real se generó con
`node scripts/_programita.mjs --una-vez --sin-abrir --sin-medir --salida <scratchpad>\pag_r2` a las 11:50.

### Cómo quedaron los 5 Importantes de la ronda 1

| Ronda 1 | Ahora | Con qué se midió |
|---|---|---|
| 1. Impresora: formato con fecha y zona | **cerrado el formato; la alarma, a medias** (Importante 2 de abajo) | las 595 lecturas de los 4 `seguimiento.log` reales pasadas al formato de hoy: 591 verde «imprimiendo» y 4 gris «no imprime» (los 4 FINISH), igual que en el formato viejo. PAUSE a los 6 min: «en pausa». `SIN CONEXION` + `SALIDA 12`: ámbar «sin conexión» hasta 12 h. Vuelve la conexión: verde |
| 2. Arb verde con el servidor caído | **a medias** (Importante 1 de abajo) | desde el 16/10 20:02 el servidor no contesta: la página da rojo la mayor parte del tiempo, pero ámbar cuando Fak usa la PC (es lo que dice ahora) y verde con el login trabado |
| 3. Corrida muerta tapada por la anterior | **cerrado** | repetido minuto a minuto: los 5 tramos de `sync-diario.log` (05/08, 15/09 16:31, 22/09, 25/09, 30/09) y el de `nube-sync.log` (12/10 17:39) salen rojo «empezó … y no anotó ningún resultado». El backup, con «ocupa N MB» y «AVISO» después del resultado: 30.417 min verde, ningún rojo |
| 4. Atraso sin fuente | **cerrado** | los rojos falsos nocturnos de la copia de mails ya no están: 0 minutos «atrasada» sin una corrida de las 08:30/12:30/16:30 perdida. Backup: el intervalo más largo real (21/09 08:49 → 28/09 08:45, 6 d 23 h 56 min) queda debajo de 7 d + 2 h. Los disparadores del canon coinciden con `Get-ScheduledTask` (solo lectura) |
| 5. «Claude» en la página | **cerrado** | la página de hoy: 0 «claude»; `_sinFirmaIA.py`: 0/0. El reemplazo tiene un costo en rutas (Nit 1) |

---

## Hallazgos Importantes

### 1. [Importante · TRUE BUG] El arb sale verde con el login trabado y ámbar con el servidor caído: `leerArb` decide con el ÚLTIMO renglón del log

`scripts/_lib/programita.mjs:122-125`. El rojo sale solo si el último renglón de `lanzador.log` dice «sin red» o «no
responde»; cualquier otro paso que no sea «arb abierto» o «pausado» cae en ámbar «esperando» o en el verde «corriendo»
del final. Pero `_arbLanzar.py` no deja el motivo en el último renglón: `log_sin_repetir()` (`:150`) escribe «arb cerrado
pero Fak esta usando la PC» ARRIBA del «sin red», y un login que no se pudo escribir deja `aviso (silencioso): …` con el
latido en «abriendo el arb» (`:687`, y `aviso()` de `:65` en modo vigilante).

**Caso 1, ahora mismo:** el servidor no contesta desde el 16/10 20:02 (desde ahí, hasta las 11:53 de hoy: 307 renglones
«sin red al servidor», 4 «usando la PC» entre medio y ningún «login OK»).
La página de las 11:50 dice **«El arb queda abierto · esperando · Fak usando la PC»** (ámbar). Llamada directa con el latido
y el último renglón reales: `17/10 11:53:21 pid 19240 Fak usando la PC` + `11:50:21 vigilante: arb cerrado pero Fak esta
usando la PC; espero` → `{"color":"ambar","palabra":"esperando"}`. Es el síntoma del hallazgo 2 de la ronda 1 justo cuando
Fak mira la página: no dice que el arb está cerrado ni que el servidor no contesta. Durante la caída, de noche sale rojo;
de 9 a 12, con Fak en la PC, salta entre rojo y ámbar (`r2_arb_caida.mjs`).

**Caso 2, 08/10:** cada 3 min «el arb esta en el login; lo abro» + «login: no pude traerla al frente» + `aviso
(silencioso): No pude escribir en "Inicio de Sesion"…`, de **13:05 a 13:31 y de 17:23 a 18:40** (37 avisos así en el
log). Llamada directa con esos renglones a las 17:50 → `{"color":"verde","palabra":"corriendo","detalle":"abriendo el arb"}`:
verde con el arb parado en el login durante 78 min. Es un control que falla abierto (REVIEW.md, punto 9).

El test nuevo (`__tests__/scripts/programita.test.mjs:67`) pone «sin red» como último renglón: no puede ver ninguno de los
dos casos. (Descartados de la reconstrucción por artefacto: 13/10 08:26-19:04, donde el log calla porque el arb
seguramente quedó abierto a mano, y 30/09 15:11, renglones de corridas a mano sin «lo abro»).

Patrón sugerido: verde solo con «arb abierto»; con cualquier otro paso, buscar en la cola del log el último «sin red / no
responde» desde el último «login OK» (si lo hay, rojo «el servidor no contesta desde HH:MM», aunque arriba diga «usando la
PC») y el último `aviso (silencioso)` (rojo con su texto); «abriendo el arb» nunca verde. Ojo con el tope de lo que se
lee: la cola es `colaDe(…, 4096)` (`scripts/_programita.mjs:81`), unos 40 renglones o 13 vueltas. Tests con los dos casos
de arriba.
· respuesta: ____

### 2. [Importante · TRUE BUG] La alarma del detector se ve 7 minutos y después la página dice «no imprime»

`scripts/_lib/programita.mjs:200` trata `SALIDA 11` como «el detector avisó», pero `bambu_red.py` nunca escribe ese
renglón: con la alarma hace `anotar_log(linea + " | ALARMA DEL DETECTOR")`, saca la foto y sale con **`return 11`**
(`bambu_red.py:2358-2362`), sin pasar por `terminar()`, que es la única que escribe `SALIDA n`. Lo mismo la 16 (error del
programa): sale por `main()` (`:2572`) con el log ya cerrado (`:2397`). La rama del 11 no se cumple nunca; queda la de
`:207`, que pide `reciente` (7 min).

**Caso medido** (`r2_impresora.mjs`, la secuencia exacta del escritor, formato de hoy): renglón de capa con `| ALARMA DEL
DETECTOR` y nada más → a +1 y +6 min rojo «imprimiendo: el detector avisa»; **a +8 y +30 min gris «no imprime»**, con la
impresora en RUNNING. La skill dice que con la 11 la sesión mira la foto y decide (`SKILL.md:284`): si no la relanza en 7
min, la alarma desaparece de la página. El test nuevo mira la alarma solo a los 30 s (`programita.test.mjs:115`).

Es el hallazgo 1 de la ronda 1 cerrado a medias: el formato quedó bien, la alarma no. Qué es de este diff y qué no: que
la alarma valga solo mientras el registro es reciente ya estaba en c9982d46 (con 5 min) y la ronda 1 no midió esa ventana;
lo que trae ef41a9c5 es la rama de `:200` para el 11, que nunca se cumple, y el paso de 5 a 7 min. Por eso va Importante y
no Preexistente: el arreglo dice cubrir «las salidas de la vigilancia» y la que importa no llega. Patrón sugerido: que un último
renglón de capa con `ALARMA DEL DETECTOR` mande hasta 12 h como las salidas (rojo «el detector avisó»), o que
`bambu_red.py` anote `SALIDA 11:` antes del `return 11` (toca la skill: lo decide la sesión madre); test a los 8 min.
· respuesta: ____

---

## Nits (ROBUSTNESS)

- **[Nit] `scripts/_lib/programita.mjs:245` (`esc`)** — el logo y la foto no se rompen (`logo.png`, `impresora.jpg`), y
  la carpeta de la impresora tampoco (sale del repo principal). Pero el reemplazo cambia rutas que existen: en la nube de
  Ingeniería hay `Claude Fak\claude-memoria`, `Base Claude Ingenieria` y `0- INSTALAR CLAUDE`. Armado con `r2_esc.mjs`: un
  pendiente de subir sale como `\asistente Fak\asistente-memoria\MEMORY.md`, y un selftest roto como
  `C:\Dev\BarackMercosul\.asistente\skills\…`: rutas que no existen, justo cuando algo falló. Hoy, 0 de los 46 pendientes.
  · respuesta: ____
- **[Nit] `scripts/_lib/programita.mjs:121`** — «pausado» siempre dice «el vigilante está pausado a mano». `pausar_vigilante()`
  (`_arbLanzar.py:162`) también pausa por «login fallido» y por «no hay clave guardada», y ese motivo está en
  `vigilante_estado.txt`, que no se lee. Con un login fallido la regla `arb-no-cerrar.md` dice no reactivar y avisar a Fak;
  la página le diría «a mano». 0 casos en la historia del log. · respuesta: ____
- **[Nit] `scripts/_lib/programita.mjs:64-66`** — con varias corridas muertas seguidas, el rojo dice la hora de la MÁS
  VIEJA: el 30/09 a las 16:30 dice «empezó mié 30/09 14:54 y no anotó» cuando la de las 15:48 y la de las 16:05 también se
  murieron. El color está bien. · respuesta: ____

---

## Lo que se miró y está bien (FALSE POSITIVE descartados)

- **El «backups/ ocupa N MB» del backup cruzando los 2 min**: medido hoy, recorrer `backups/` (1.732 archivos, 1.227 MB)
  tarda **0,6 s**; las 4 corridas reales escribieron resultado y «ocupa» en el mismo minuto. Si alguna vez cruzara, el
  efecto ya no serían 20 min de verde: sería rojo «no anotó ningún resultado» hasta el lunes siguiente. Hoy no hay margen
  en riesgo.
- **Rojos falsos de una corrida viva y lenta**: uno solo en la historia, 15/09 12:51-13:01 (11 min), una corrida de 31 min
  de antes del tope de 15 min que tiene `_syncMailsDiario.ps1` desde el 30/09. El tramo sin renglones más largo medido en
  una corrida viva es «lo abro → arranco el sync» = 17 min (30/09 15:48 → 16:05), debajo de los 20.
- **El atraso de las dos tareas «cada 2 h»** (mails a la nube y memoria), desde el disparador de hoy (08/10), cruzado con
  los arranques y apagados de la PC (registro System de Windows, eventos 6005/6006): 0 minutos «atrasada» con la PC
  prendida que no se expliquen. Lo único: de 4 a 9 min de rojo al prender la PC, hasta que termina la corrida de inicio de
  sesión (09/10 22:06, 13/10 08:26, 15/10 08:25, 16/10 20:02). Es el dato viejo de verdad; no es hallazgo.
- **La noche**: el tope de 25 h alcanza; las noches reales tardan ~3 min (`nocturno.log`: 10/10 06:30 → 06:33) y
  `cuandoMs` es su inicio.
- **`SALIDA 2`, `SALIDA 3`, `SALIDA 12`, `SIN CONEXION`** salen por `terminar()` o `anotar_log()` (`bambu_red.py:2243`,
  `:2336`) y la página los lee como dice la tabla de la skill. La 15 (ya vigilada) no escribe nada en el log porque el
  candado frena antes de abrirlo: no importa.
- **Documentos y maquetas**: `MOD_AGENTES_PENDIENTE` y `TANDA6_MODS_VALIDATE_TEST` ya dicen que la app corre el motor
  2.1.299 sin `$.ui.view`; las fuentes de color de las maquetas nombran qué es del informe y qué de la maqueta, y el ámbar
  está en la tabla de contraste (`exports/` se revisa contra el pedido, no como código).

## Cierre para Fak (lo que queda abierto después de la ronda 2)

1. Importante 1: el arb puede salir ámbar con el servidor caído y verde con el login trabado.
2. Importante 2: la alarma del detector se ve 7 minutos y después la página dice «no imprime».
3. Los 3 Nits, si se quieren tomar.
