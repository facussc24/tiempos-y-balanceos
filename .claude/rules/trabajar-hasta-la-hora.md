# Si Fak pone una hora, no se cierra antes (always-on)

Fak, 03/10/2026. A las 13:50: *"quedate laburando como mínimo hasta esa hora"* (las 20). A las 23:03:
*"hace 6 horas me dice que terminaste y son las 11, no te quedaste hasta las 8… decime por qué, defendete"*.
Y después: *"investigá qué falló y qué podemos hacer para que no vuelva a suceder"*.
Esta regla no lleva `paths:` a propósito: entra en todas las sesiones.

## Qué falló (medido)

Mi último commit fue a las 17:03 y mi último mensaje a las 17:10. Dos causas, las dos mías:

1. **Una sesión no sigue sola.** Cuando termino de contestar quedo parado hasta que llega un mensaje de Fak, el
   aviso de algo que dejé corriendo (un agente, un programa en segundo plano) o un aviso programado. A las 17:10 no
   había nada corriendo: nadie me despertó.
2. **Traté un pedido por TIEMPO como una lista.** Cuando se me acabó la lista que tenía en la cabeza, cerré con un
   resumen. Y trabajo había (lo que la auditoría dejó sin arreglar, más pruebas).

## La regla

Cuando Fak deja a Claude trabajando solo hasta una hora («laburá hasta las 8», «hasta mañana a las 10», «toda la
noche», «hasta que vuelva», «ponete un cronómetro»), ANTES de seguir con lo que pidió:

1. **La lista en un archivo**: lo que pidió primero y después qué auditar, probar o mejorar por cuenta propia. Lleva
   las reglas de esa tanda (lo que no se puede hacer sin él), un lugar donde se anota lo hecho y tres secciones (cola H3,
   09/10/2026): «Trabajo que puedo hacer solo» (lo de la cola que no necesita su sí, para cuando se acabe lo pedido),
   «Decidí distinto de lo pedido» (qué y por qué, con la fuente) y «No pude verificar».
   **Cuando la lista se acaba, se le agrega; no se cierra.**
2. **La hora fijada**: `node scripts/_lib/horaGuard.mjs --fijar "AAAA-MM-DD HH:MM" --lista <archivo> --pedido "<sus palabras>"`.
   Si es ambigua («hasta 8»), la próxima que tenga sentido con lo que dijo. Sin hora («toda la noche»), la mejor
   estimación; si no hay pista, 4 horas y se renueva.
3. **El latido** (09/10/2026, cola H2): `node scripts/_latido.mjs` lanzado con la herramienta Bash **en segundo plano**
   (`run_in_background: true`) y una descripción que empiece con `LATIDO`. Deja una señal con su número de proceso
   (`~/.claude/.latido/<sesión>.<proceso>.json`, refrescada cada 30 s), espera 9 minutos y termina: **su aviso de
   «terminó» despierta a la sesión**. Lo que la sesión ve en el aviso es el **código de salida**, no lo impreso: con
   `exit code 0`, mirar la hora, **correr `node scripts/_colgados.mjs`**, leer la lista, seguir y **relanzarlo**; con
   `exit code 4` ya no hay hora vigente y **no se relanza** (sin hora vigente tampoco arranca); con **`exit code 5`**
   (desde el 10/10/2026, cola HOY-17) también se sigue y se relanza, y además se corre `node scripts/_orquestador.mjs --hora`:
   hay un aviso de las reglas de la tanda (varios despertares seguidos sin avanzar con una pregunta abierta a Fak, o 2 horas
   de trabajo sin un pedido a la API). El control de cierre mira que ESE proceso esté vivo. Por qué así y no `CronCreate` ni una tarea
   programada: lo medido, en la sección de abajo.
   **Lo que lanzo y lleva 10 minutos quieto se MIRA, no se espera** (04/10/2026: cuatro conversaciones del examen
   estuvieron 55 minutos esperando un cartel de permiso y yo esperaba «que terminen»; Fak: *"que no vuelva a pasar eso de
   perder 55 minutos"*). `_colgados.mjs` lee los registros de las conversaciones y de los agentes y dice cuál está quieta
   a mitad de un turno y qué espera (una herramienta sin resultado es casi siempre un cartel). Si espera un cartel y Fak
   no está: `stop_session` y un mensaje para que siga por otro camino.
4. **El resumen para Fak va cuando llega la hora**, no antes. Ahí: `--terminar` (el latido que esté corriendo termina solo; no se relanza) y el resumen.
5. **Nada que le muestre un cartel de aprobación** mientras no está (me quedaría colgado), y los topes siguen
   valiendo: el techo de agentes, el cupo (mirarlo **cada hora** con `get_usage`, no cada dos: el 08/10 a las 23:40 la ventana de 5 h estaba al 93 % con el corte a las 02:00 y el reinicio a las 03:20; pasado el **85 %** de esa ventana no se lanzan subagentes, se termina a mano lo abierto, y con menos del 10 % de contexto libre tampoco: un agente que vuelve despues de compactar se pierde, Fak 08/10) y lo que el contrato de autonomía marca «preguntar».
   Lo que necesita a Fak se anota en la lista para cuando vuelva; no frena el resto.
6. Si Fak dice que pare: `--terminar --porque "<sus palabras>"`.
7. Si con una hora vigente Fak da más tiempo («te doy 1 hora más», 04/10/2026 a las 18:48 con el corte en 19:10), las
   horas se suman a la hora que ya había (20:10), no al momento del mensaje: se vuelve a fijar con `--fijar`, con la
   misma lista, el latido sigue, y a la lista se le agrega trabajo. El aviso ya dice la hora nueva.

Fak también puede usar `/goal` (propio de Claude Code): sigue turno tras turno hasta que se cumple una condición.
El que juzga no tiene reloj, así que la condición tiene que pedir que se muestre la hora en cada turno. Este
mecanismo no depende de eso.

## 09/10/2026: el latido por CronCreate nunca disparó; el que despierta es un programa en segundo plano (medido)

En los transcripts de esta carpeta: **0 mensajes LATIDO en 16 sesiones** (las 15 del 08/10 y la de la noche, con
35 menciones de CronCreate); un one-shot `* * * * *` seguía sin disparar 8 minutos después con la sesión quieta.
Por eso el 03/10 y el 08/10 la sesión se quedó quieta horas mientras el hook `hora-guard` daba el latido por vivo:
**miraba que el cron existiera (`session_crons`), no que latiera**.

La tarea programada de la app (`mcp__scheduled-tasks__create_scheduled_task`, con aviso al terminar) arrancó sola el
09/10 a las 06:39, pero **su aviso de «terminó» a la sesión que la creó no aparece en ningún registro**: la corrida se
trabó en modo plan y la tarea ya no existe. Escrito como «ese aviso es el latido», nunca se vio funcionar.

Lo que sí se vio (medido el 09/10 a la noche sobre los registros desde el 03/10): el aviso de «terminó» de un **programa
en segundo plano**. De 163 que llegaron con la sesión recién callada, 88 la despertaron y el resto entró al turno que
seguía abierto (`absorbed_mid_turn`): ninguno se perdió. El de un subagente: 97 de 102. Por eso el latido es
`scripts/_latido.mjs` en segundo plano, y el control mira que su proceso esté vivo (`latidoVivo` en `horaGuard.mjs`),
no que exista un aviso. Espera 9 minutos y no 10: el tope de un comando de Bash es 10. La sesión sale de
`CLAUDE_CODE_SESSION_ID`, que Claude Code le da a cada comando (antes se adivinaba por el registro más nuevo y, con dos
sesiones abiertas, podía ser la de otra).

⚠ **No pude verificar** una noche entera con este latido: la prueba de punta a punta es la primera noche que Fak deje
una hora. Lo que sí está probado: el script, la señal, el control en las dos direcciones y que su aviso despierta.
## Enforcement

- **Hook `hora-prompt.sh`** (UserPromptSubmit; lógica en `scripts/_lib/horaGuard.mjs`, palabras en
  `horaCanon.data.json`): con el mensaje de Fak que pone la hora, avisa los cuatro pasos. Medido sobre 1.712
  mensajes suyos: salta en 7 y los 7 son pedidos de trabajar por tiempo; un reclamo en pasado («no te quedaste
  hasta las 8») o «me lo enviaron a las 21hs» no disparan. Desde el 04/10/2026 también reconoce el pedido por
  DURACIÓN («metele 2 horas seguidas más», «tenés 12 horas seguidas, laburá tranquilo»): ese día no avisó y la hora la
  fijé por mi lectura; la hora de corte se calcula con `date`.
- **Hook `hora-guard.sh`** (Stop): con una hora vigente frena el cierre del turno si no hay ningún latido vivo
  (el proceso de `_latido.mjs`; un `CronCreate` ya no cuenta; se frena también en el segundo intento) o si el mensaje se despide como si hubiera
  terminado; y frena una vez si el último mensaje de Fak ponía una hora y no se fijó. Salida honesta: un renglón
  `No aplica trabajar-hasta: <motivo>`. Un pedido cumplido y cerrado con `--terminar` deja su marca en el estado: por
  ese mismo mensaje no se vuelve a frenar; por uno nuevo de Fak, posterior a la última vez que se fijó, sí
  (04/10/2026: a las 10:00 cerré el pedido de la noche y el control volvió a pedirme que fijara esa misma hora).
- **`session-start-context.sh`**: al arrancar, reanudar y compactar reimprime el pedido vigente de ESA sesión.
- Estado: `~/.claude/.trabajar-hasta.json`, por sesión. Tests en las dos direcciones, con sus mensajes textuales:
  `__tests__/scripts/horaGuard.test.mjs`.
- Límites conocidos: el hook Stop no corre si Fak interrumpe ni ante un error de la API; con la PC dormida o la app
  cerrada no corre nada (la notebook enchufada no se duerme: `powercfg`, suspensión en «nunca»); Claude Code corta
  a los 8 bloqueos seguidos de un Stop. Y ningún control decide QUÉ trabajo hacer: eso es la lista.
- Memoria: `feedback_trabajar_hasta_la_hora_que_dijo_fak`. Informes de cómo lo resuelven otros:
  `.sgc-cache/claude-por-area/examen/investigacion_trabajar_hasta_la_hora_{docs,comunidad}.md`.
