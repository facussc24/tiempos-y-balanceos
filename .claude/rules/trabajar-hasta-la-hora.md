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
   las reglas de esa tanda (lo que no se puede hacer sin él) y un lugar donde se anota lo hecho.
   **Cuando la lista se acaba, se le agrega; no se cierra.**
2. **La hora fijada**: `node scripts/_lib/horaGuard.mjs --fijar "AAAA-MM-DD HH:MM" --lista <archivo> --pedido "<sus palabras>"`.
   Si es ambigua («hasta 8»), la próxima que tenga sentido con lo que dijo. Sin hora («toda la noche»), la mejor
   estimación; si no hay pista, 4 horas y se renueva.
3. **El latido**: `CronCreate` recurrente cada 10 minutos (en minutos que no sean :00 ni :30) con un prompt que
   empiece con `LATIDO`, mande a mirar la hora, **correr `node scripts/_colgados.mjs`**, leer la lista y seguir; y
   `--latido <id>`. El latido dispara solo con la sesión inactiva y muere si la app se cierra: al arrancar o compactar,
   `CronList` y rearmarlo si falta.
   **Lo que lanzo y lleva 10 minutos quieto se MIRA, no se espera** (04/10/2026: cuatro conversaciones del examen
   estuvieron 55 minutos esperando un cartel de permiso y yo esperaba «que terminen»; Fak: *"que no vuelva a pasar eso de
   perder 55 minutos"*). `_colgados.mjs` lee los registros de las conversaciones y de los agentes y dice cuál está quieta
   a mitad de un turno y qué espera (una herramienta sin resultado es casi siempre un cartel). Si espera un cartel y Fak
   no está: `stop_session` y un mensaje para que siga por otro camino.
4. **El resumen para Fak va cuando llega la hora**, no antes. Ahí: `--terminar`, `CronDelete` y el resumen.
5. **Nada que le muestre un cartel de aprobación** mientras no está (me quedaría colgado), y los topes siguen
   valiendo: el techo de agentes, el cupo (mirarlo cada dos horas) y lo que el contrato de autonomía marca «preguntar».
   Lo que necesita a Fak se anota en la lista para cuando vuelva; no frena el resto.
6. Si Fak dice que pare: `--terminar --porque "<sus palabras>"`.
7. Si con una hora vigente Fak da más tiempo («te doy 1 hora más», 04/10/2026 a las 18:48 con el corte en 19:10), las
   horas se suman a la hora que ya había (20:10), no al momento del mensaje: se vuelve a fijar con `--fijar`, con la
   misma lista y el mismo latido, y a la lista se le agrega trabajo. El aviso ya dice la hora nueva.

Fak también puede usar `/goal` (propio de Claude Code): sigue turno tras turno hasta que se cumple una condición.
El que juzga no tiene reloj, así que la condición tiene que pedir que se muestre la hora en cada turno. Este
mecanismo no depende de eso.

## Enforcement

- **Hook `hora-prompt.sh`** (UserPromptSubmit; lógica en `scripts/_lib/horaGuard.mjs`, palabras en
  `horaCanon.data.json`): con el mensaje de Fak que pone la hora, avisa los cuatro pasos. Medido sobre 1.712
  mensajes suyos: salta en 7 y los 7 son pedidos de trabajar por tiempo; un reclamo en pasado («no te quedaste
  hasta las 8») o «me lo enviaron a las 21hs» no disparan. Desde el 04/10/2026 también reconoce el pedido por
  DURACIÓN («metele 2 horas seguidas más», «tenés 12 horas seguidas, laburá tranquilo»): ese día no avisó y la hora la
  fijé por mi lectura; la hora de corte se calcula con `date`.
- **Hook `hora-guard.sh`** (Stop): con una hora vigente frena el cierre del turno si no hay ningún aviso programado
  vivo (lo dice `session_crons`; se frena también en el segundo intento) o si el mensaje se despide como si hubiera
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
