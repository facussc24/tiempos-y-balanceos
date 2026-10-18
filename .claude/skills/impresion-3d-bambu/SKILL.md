---
name: impresion-3d-bambu
description: Preparar una pieza para la impresora 3D Bambu Lab A2L de Fak sin pasar por la ventana del laminador — laminar un .3mf por comando con Bambu Studio (perfiles completos de la máquina, el proceso y el filamento), asignar un color a cada parte y dejar el archivo listo para imprimir, con controles que frenan si el código salió mal. Usar cuando Fak pida "generá el código de impresión", "dejámelo listo para imprimir", "laminalo", "en dos colores", "mandalo a la Bambu", o al entregar una pieza 3D que va a esa impresora.
---

# impresion-3d-bambu — dejar una pieza lista para la Bambu Lab A2L

**Versión 2026-10-16** (la misma que `bambu_red.py --version`; `--selftest` las compara).

**Estado (13/10/2026): PROBADA con tres impresiones reales** en la A2L: virolador v14 (negro con
grabado amarillo, 1 h 43 min contra 1 h 41 estimado), tres fichas de tres colores (32,6 min contra
32) y el molde de probeta 50 x 50 (mandado 13:46, terminó 00:18: 632,9 min reales contra 649
estimados). Lo que sigue sin verse: el detector ante una falla real.
**16/10/2026 (tanda 17):** la búsqueda por número de serie, la vigilancia nueva (salidas 12/13/14) y los
frenos de `--imprimir` están probados contra una impresora de juguete (146 tests en
`tests/`, `python -m unittest discover -s .claude/skills/impresion-3d-bambu/tests`); con la impresora
real, ver §7.

**Reglas que valen para toda la skill:**
- `--imprimir --apply` y `--seguir` se lanzan **siempre en segundo plano y nunca dentro de `timeout`**
  (un `timeout 100` cortó la subida de 20 MB el 15/10; la vigilancia tiene que poder despertar a la sesión).
- **Prohibido esperar con un `ping` a una dirección fija** (el 15/10 un bucle preguntó por la .198 tres horas
  mientras la impresora estaba en la .111): se espera con `--seguir <carpeta> --buscar`.
- **El código de acceso se dice que está en la foto o en el archivo; no se transcribe en el chat** (13/10:
  se escribió leído de una foto). Ni en el repo, ni en la skill, ni en la memoria.
- Con Fak, todo en castellano: ningún renglón en inglés en el chat (15/10: «The vigilance will wake me…»).

## 1. Qué hay y qué no

| | Estado |
|---|---|
| Laminar por comando con Bambu Studio (el oficial, "por atrás") | **Probado** (v2.8.2.61, virolador v14) |
| Dos colores, un filamento por parte | **Probado en el código** (amarillo 0,05 g en 3 capas, negro 52,5 g) |
| Que la impresora lo imprima bien | **Probado el 13/10/2026** (virolador v14 y tres fichas: salieron bien) |
| Mandar a imprimir desde acá (sin que Fak toque nada) | **Probado el 13/10/2026 10:04** (virolador v14: arrancó, cargó el negro). Ver §1 bis |

La impresora: Bambu Lab A2L, boquilla 0,4, cama 330 × 320 × 325, cargador de 4 filamentos
(memoria `reference_impresora_3d_fak`). Qué filamento hay en cada lugar **se le pregunta a Fak o se
mira en una foto**: cambia.

## 1 bis. Mandar a imprimir por la red (desde el 13/10/2026: ANDA)

Fak activó «Modo solo LAN» + «Modo desarrollador» en la pantalla de la impresora (decisión suya).
Todo con `scripts/bambu_red.py`, que no usa librerías de terceros (MQTT a mano sobre TLS, FTPS):

```bash
python .claude/skills/impresion-3d-bambu/scripts/bambu_red.py --estado          # solo lee
python .claude/skills/impresion-3d-bambu/scripts/bambu_red.py --imprimir <archivo.gcode.3mf>          # muestra el plan
python .claude/skills/impresion-3d-bambu/scripts/bambu_red.py --imprimir <archivo.gcode.3mf> --apply  # sube y manda
```

- **Sin `--mapa` elige solo el lugar del cargador** para cada filamento del archivo: mismo
  material (el perfil `GFAxx` del archivo contra el que informa la impresora) y el color más
  parecido. **Frena** si el material cargado no es el del laminado (probado con el gemelo: el
  archivo de PLA Basic contra el cargador con PLA Lite no se manda), si el color no se parece o
  si la impresora está ocupada. Tampoco manda un archivo con más de una placa (solo iría la 1).
- `--mapa 0,1` fuerza los lugares a mano (contando desde 0) y **saltea el control de material y color**: solo
  cuando la elección sola no sirve, y diciéndolo. Un lugar vacío frena igual (también con `--sin-margen`). Los demás frenos valen con o sin
  `--mapa`.
- **Si la impresora no manda su estado completo** (en 6 s, al empezar) no se manda nada: sin estado no hay frenos.
  Y si justo antes de la orden no contesta, la orden no sale (el archivo queda subido; se vuelve a probar).
- **Antes de mandar, la PRIMERA CAPA se le muestra a Fak** (15/10/2026: *"guardaste una foto del
  antes de imprimir?... agregarlo a la skill"*). `--imprimir` (con o sin `--apply`) deja
  `<archivo>_PRIMERA_CAPA.png` al lado del archivo (`primera_capa.py`): lo que pega en la cama vista
  de arriba, la pieza en negro y el borde de adherencia en naranja, con los mm² de apoyo. La
  miniatura del laminado NO sirve para esto: mostraba enteros tres pines que apoyaban en dos islitas
  de ~3,6 mm cada uno y se despegaron al 27 %. El dibujo usa Pillow (si falta, avisa y el envío sigue).
  Avisa cuando no hay borde y el apoyo total es chico (menos de 1000 mm²); con una pieza
  angosta, redonda o acostada, se relamina con `--ajuste brim_type=outer_only --ajuste brim_width=6`
  (y, si la forma lo permite, una cara de apoyo más ancha).
- **Vigilar hasta que termine** (solo lee; se lanza en segundo plano y su salida me despierta).
  **Se lanza en el MISMO mensaje en que se manda**: el 15/10/2026 se mandó sin vigilancia y la falla la vio
  Fak (*"el software no te despertó nunca?"*). El comando es UNO solo, el que `--apply` imprime en el renglón
  «AHORA, EN SEGUNDO PLANO» (`--fotos-en 3,10 --despertar 5 --cada 30`, con **una carpeta por envío**,
  `seguimiento_<trabajo>`: una reimpresión en la carpeta vieja heredaba su estado y sus fotos); `imprimir_pieza.py`
  remite a ese mismo. Pasadas las primeras capas se relanza con `--despertar 10` (§1 ter). Si arranca con la
  pantalla todavía en el «finalizada» de la pieza anterior (de la skill, de Bambu Studio o de la pantalla), espera
  hasta 10 min a que empiece la nueva, contando también las relanzadas de `--despertar` (sale 1 si no empieza).
  Espera solo si hay un envío de la skill de los últimos 15 min que todavía no arrancó.
  `--seguir <carpeta> [--fotos-en 41,44]`. Deja `seguimiento.log` (fecha y hora con zona),
  `estado_seguimiento.json` (el reloj de «quieta» y el trabajo, para la próxima relanzada) y fotos de la
  cámara (capa 1, las capas pedidas, una cada 15 min y la final). Una sola conexión que queda abierta.
  **Después de mandar una impresión se lanza siempre**, con las capas donde cambia de color (salen de
  `quien_imprime_que.py`). Qué hacer con cada salida: tabla de §1 ter.
- **Los frenos de `--imprimir`** (16/10/2026; todos se controlan ANTES de subir; sin `--apply` se muestran):
  - **Gramos por rollo**: lo que pide el archivo contra lo que queda según el registro, con margen
    `max(30 g, 15 %)` → «NO SE MANDA: no alcanza el negro (pide 78 g, quedan ~19 g, margen 30 g)». Con menos de
    100 g avisa «pesalo». **De noche** (termina después de las 20:45) con menos de 100 g y sin un rollo de
    respaldo igual cargado: frena. Un rollo igual cargado en otro lugar suma, con el aviso de prender «AMS
    Filament Backup» en la pantalla. Los números son una propuesta sin fuente (H2 §2.5): se ajustan con las
    pesadas. **`--sin-margen` lo saltea SOLO con la frase de Fak en el chat.**
  - **El negro va siempre con respaldo** (Fak, 16/10): si no hay un segundo negro PLA Lite cargado, **solo avisa**,
    de día y de noche (lo que frena de noche es la regla de gramos de arriba). Entre dos rollos iguales elige **el
    más gastado** y lo dice: así el viejo se termina primero.
  - **Placa ocupada**: con la impresora en FINISH o FAILED no manda hasta que alguien anote que sacó las piezas
    (`registro.py --placa-libre`). Con IDLE frena si el registro tiene un trabajo sin cerrar («placa posiblemente
    ocupada»: un corte de luz deja la impresora en el inicio con restos en la placa); sin nada abierto pasa
    (alguien tocó la pantalla).
  - **Pieza de más de 3 h, sin el tiempo en el archivo, o que termina de noche (de 20:45 a 8:15): no sale sin
    `<archivo>.ok`** al lado del `.gcode.3mf`, con la frase textual de Fak y la fecha. Lo escribe la sesión cuando
    Fak dio el sí sabiendo el tiempo y la hora de fin; un `.ok` más viejo que el laminado no sirve (13/10: el
    «esperá a Fak» vivía solo en el chat, se compactó y el molde salió sin que lo viera). El tiempo sale de la
    cabecera del código y, si falta, de la predicción del laminado.
  - Ocupada (RUNNING, PREPARE, PAUSE), varias placas, material o color distintos: como antes.
- **Al mandar**: sube con progreso cada 15 s, **relee el estado justo antes de la orden** (otra PC pudo mandar en
  los ~2 min de subida), anota «enviada» **antes** de la orden («sin confirmar») y la pasa a «confirmada» cuando la
  impresora contesta; vuelve apenas arranca (no espera 150 s fijos) y a los 2 min avisa la trampa de la etapa 77.
  El aviso trae paredes, relleno, capas, borde, soportes, «la primera capa empieza en 6-16 min» y **«termina a las
  HH:MM»** (estimado × 1,02: en 11 impresiones el real quedó entre −10,9 % y +2,3 %, así que la hora sale del lado
  seguro); de noche, «la cámara no ve».
- **La ficha de cada pieza**: `ficha.json` en la carpeta del `.gcode.3mf` (nombre = las palabras de Fak del
  archivo, archivo vigente, ajustes, gramos y minutos estimados, cada envío con su chip). `--seguir` y
  `--cancelar` la completan (resultado, minutos reales, foto final). `--ficha <carpeta>` la muestra. El campo
  «descartado» (y por qué) lo escribe la sesión a mano: así no se vuelve a mandar el pin equivocado (14 y 15/10).
- `--foto <archivo.jpg>`: una foto de la cámara (puerto 6000). `--pausar`, `--reanudar`,
  `--cancelar` (los tres probados el 13/10/2026; `--imprimir` frena si la impresora está ocupada, con rollos elegidos a mano o solos).
  **`--cancelar` cierra en el registro EL trabajo que la impresora informa** (por número y nombre) como
  «cancelada» con su avance y su capa; si no está anotado, queda como «visto»: nunca se cierra uno ajeno.
- **Durante la impresión** (probado el 13/10/2026 sobre una pieza real, Fak lo vio en la pantalla):
  `--velocidad` muestra el modo y `--velocidad 1|2|3|4` lo cambia (1 silencioso, 2 estándar,
  3 deportivo = 124 % en la pantalla, 4 el más rápido); `--luz on|off`. Cada orden se confirma
  releyendo el estado. **La velocidad no se sube mientras se imprime una zona de medida crítica**
  (ese día se volvió a estándar para los anillos). Temperaturas y ventilador no se tocan a mano.
- **Saltear una pieza que salió mal y seguir con las demás:** `--saltear <archivo.gcode.3mf>` lista
  los objetos con su número; `--saltear <archivo> 12 --apply` lo manda. No se deshace. Solo sirve
  si la placa tiene **dos o más objetos**: el laminado ya los deja identificados (`exclude_object`;
  con un solo objeto Bambu Studio no los marca). Frena si el número no existe o si se piden todos
  (eso es cancelar). **La torre de purga no es un objeto: no se puede saltear.** **Probado de punta
  a punta el 13/10/2026** (placa de tres fichas en tres colores: se salteó la blanca en la capa 2,
  la impresora la informó como salteada —`s_obj`— y Fak la vio quedar más baja; las otras dos
  terminaron). Un objeto por color se asigna al laminar con `--parte-filamento "obj:<nombre>=N"`.
- **Pausar y reanudar: probados** en esa misma prueba (PAUSE a los 3 s, RUNNING al reanudar).
- `--avisar-retiro` (en segundo plano): sale cuando la placa baja de 35 °C con la impresión
  terminada; tarda unos 15 min desde 55 °C. Probado dos veces. Si no encuentra la impresora sale con 12 (antes
  daba 45 minutos de «sin respuesta» y salía con 1).
- **Ningún comando termina en un error de Python**: cada falla sale en un renglón en castellano con su salida
  (12 = no la encuentro, 13 = rechazó el código de acceso, 130 = Ctrl+C; en `--seguir`, 16 = error del programa,
  para no confundirlo con el 1 de «falló la impresión»). `--selftest` revisa una PC (Bambu
  Studio y los perfiles, Pillow, `.venv-cad`, el registro escribible, el archivo de datos sin mostrar el código,
  el detector y la versión). `--version`.
- **La prueba general del 13/10** (32 min, 10 g, 12 cambios de color): elección de rollos, envío,
  registro, pausa, salteo y avisos, todo bien; tiempo real 32,6 min contra 32 estimados.
- Etapas que parecen un cuelgue y no lo son (arranque oficial de la A2L, ~10 min antes de la
  primera capa): 8 calibra flujo, 3 mide vibraciones, **58 «preacondicionamiento térmico de la
  primera capa»** (espera a que la placa se estabilice), 1 nivela. Un cuelgue de verdad es
  `mc_print_line_number` clavado en 0.
- Datos de la impresora en `%USERPROFILE%\.claude\bambu-a2l.json` (IP, número de serie, código de
  acceso) y, **para que la PC de un compañero se conecte sola**, una copia en la nube de
  Ingeniería, al lado del registro:
  `INGENIERIA BARACK (NUNCA BORRAR)\1- GENERAL\5. 3D\IMPRESORA BAMBU A2L\bambu-a2l.json` (OK de Fak
  13/10/2026). **La skill se le pasa al equipo por mail, en un zip** (decisión de Fak, mismo día).
  El script busca primero la de la PC y después la de la nube (`cargar_datos()`); probado
  simulando una PC sin archivo propio. Si no encuentra ninguna, dice qué hacer. Requisitos del
  compañero: Bambu Studio instalado, la carpeta de Ingeniería sincronizada y el mismo wifi que la
  impresora. **El código de acceso no va al repo (es público), ni a esta skill, ni a la memoria.**
  Lo escribe Fak: `--pedir-codigo` le abre una ventanita. El número de serie sale del certificado de
  la impresora (`--preparar <ip>`, que **no pisa** un archivo que ya existe y no escribe nada si el certificado no
  trae una serie de Bambu: en esa dirección hay otro equipo). La serie se compara sin mirar mayúsculas ni espacios.
  Si el archivo de esta PC está roto (cortado a la mitad), usa la copia de la nube y lo dice; los archivos de datos
  se escriben enteros o no se escriben.
- **La IP del archivo es una pista, no un dato** (16/10/2026: el 15/10 a las 23:31 la impresora pasó de .198 a
  .111 y el programa no la volvió a ver). Si no contesta, **la busca por su número de serie** (`ubicar()`): la
  dirección del archivo, las que anotaron las otras PC en el registro, el anuncio de la red (puertos 1990/2021),
  la MAC si el archivo la trae y el recorrido de la red en el 8883. Cada candidato se comprueba con el
  certificado (CN = serie) **antes** de mandarle el código. Encontrada: corrige **solo la copia de esta PC**
  (con respaldo `.antes-<fecha>`) o, en una PC que lee los datos de la nube, deja una pista local sin el código;
  **el `bambu-a2l.json` de la nube no se toca desde cada PC** (copias en conflicto de OneDrive). Imprime «la
  impresora cambió a X; archivo corregido» y lo anota en el registro. No la encuentra: salida 12 con qué mirar.
  Una dirección que falla una vez (un corte de 3 s) se vuelve a probar si el anuncio o la MAC la confirman; de las
  anotadas por otras PC prueba las 5 más nuevas. La dirección que alguien lee en la pantalla (Ajustes > WLAN) se
  anota con `registro.py --ip-de-la-pantalla <ip>` y entra en esa lista.
  El certificado se comprueba en cada conexión al 8883 (tope TLS 1.2): en una dirección con otra Bambu no se manda
  nada. La subida (990) y la cámara (6000) van a la dirección que ese mismo proceso ya comprobó.
- **Mandar a imprimir es una acción física: se manda cuando Fak lo pide y está cerca de la
  impresora** (placa vacía y limpia). Cancelar: orden `stop` por MQTT (probada) o el cuadrado
  rojo de la pantalla.

**La trampa de la A2L (costó un trabajo trabado 10 minutos):** su cargador de 4 lugares es la
**unidad física 16**. La orden `project_file` tiene que llevar
`"ams_mapping2": [{"ams_id": 16, "slot_id": N}, ...]` además del `ams_mapping` plano. Sin eso la
impresora contesta «success», pasa a PREPARE y se queda para siempre en la **etapa 77
(«Preparando AMS»)**, sin error y sin arrancar el código (renglón 0); el play de la pantalla no
hace nada. La forma completa de la orden salió del programa abierto Bambuddy
(`maziggy/bambuddy`, `backend/app/services/bambu_mqtt.py`), que ya soporta la A2L. Las etapas
(`stg_cur`) están en `get_stage_string()` del código de Bambu Studio (`DeviceManager.cpp`).

**Cómo se ve que arrancó bien:** `gcode_state` RUNNING, etapas 2 (calienta placa) → 13 (home) →
4 (carga filamento), `mc_print_line_number` > 0 y `ams.tray_now` = el lugar del primer filamento.

## 1 quater. El registro compartido (varias PC, una sola cuenta)

Fak, 13/10/2026: *"normalmente imprimimos desde distintas PCs… ¿usar la nube para sincronizarnos?"*.
`scripts/registro.py` guarda en la nube de Ingeniería,
`1- GENERAL\5. 3D\IMPRESORA BAMBU A2L\registro\<NOMBRE-DE-LA-PC>.jsonl`: **un archivo por PC** (cada
PC solo agrega renglones al suyo, así OneDrive no genera copias en conflicto) y el resumen junta
los de todas.

- `--imprimir … --apply` anota la impresión **antes** de la orden (pieza, minutos estimados, gramos por
  filamento, **el número de chip de cada rollo**, `task_id` y `subtask_name`) y la confirma cuando la impresora
  contesta; `--seguir` y `--cancelar` cierran **ESE** trabajo (terminada, fallida o cancelada, minutos reales,
  avance). Si terminó sin que nadie lo viera: «terminada» con `fin_visto` y los minutos en blanco. Cualquier
  comando que se conecta lo concilia (una sola vez); lo que la impresora informa y no está anotado queda «visto».
- `python .claude/skills/impresion-3d-bambu/scripts/registro.py --resumen`: horas de impresión,
  gramos gastados, lo que queda de cada rollo (con aviso de rollo bajo: menos de 100 g «pesalo», menos de 50 g
  «solo piezas chicas de día o con respaldo»), estimado contra real, qué rollo hay en cada lugar según el último
  `--estado`, y **qué mantenimiento toca** según la wiki de Bambu (eje Y cada 200 h, cuchilla cada 3 rollos,
  extrusor cada 5, tubos cada 6, eje X y ventiladores cada mes).
  Un mantenimiento hecho se anota con `--anotar '{"tipo":"mantenimiento","que":"<el texto del resumen>"}'`.
- **La impresora NO informa cuánto le queda a un rollo**: el 13/10 informó `remain = -1` y `tray_weight =
  1000` (el peso nominal) en los lugares con chip (el 16/10, el lugar 4 sin chip informó 0), y el cargador de 4 de
  la A2L no tiene la opción de estimarlo. Es una cuenta: **la balanza le gana**. `registro.py --pesar <lugar 1-4 o
  chip> <gramos en la balanza>` [`--tara <g>`] anota la pesada y la cuenta sigue desde ahí. Tara sin medir: 250 g
  (tienda de Bambu; en el foro 208-260 g). El primer carrete vacío que se pese queda como tara de la casa:
  `registro.py --tara <g>`. **Por lugar, el rollo sale del último `--estado` de esta PC**: después de cambiar un
  rollo se corre `bambu_red.py --estado` antes de pesarlo; con un estado de más de 10 min el comando no anota nada y
  pide correr `--estado` (o pasar el chip).
- El consumo de una impresión que se canceló o falló se descuenta por su avance o por sus capas impresas, lo que
  diga más (una cancelada en 0 % con 30 capas impresas gastó filamento).
- **Rollo sin chip** (Fak, 16/10: *«si llega a fallar el chip deberíamos usarlo igual»*): un rollo cargado a mano en
  la pantalla no informa chip. Se usa igual: la cuenta va **por el lugar** (`SIN-CHIP-L4`), que anda mientras nadie
  lo cambie de lugar, y cuenta como respaldo de uno igual (mismo perfil y color): si Fak dice que es el mismo
  rollo, es el mismo (16/10: *«ya te confirmé que es el mismo, dejá de dar vueltas»*). **Si es nuevo, no hace falta
  pesarlo** (*«te aclaro que es nuevo y listo»*): cuando Fak dice «el del lugar N es nuevo», la sesión corre
  `bambu_red.py --estado` y `registro.py --rollo-nuevo N "<su frase>"`, que lo anota con 1000 g. Se pesa solo si
  hay duda. Desde ahí lo gastado antes en ese lugar no cuenta y `--imprimir` deja de pedir que se anote.
- `registro.py --placa-libre ["nota"]`: quien sacó las piezas lo anota; recién ahí `--imprimir --apply` manda.
  Vale aunque se anote antes de que alguna PC vea el fin, pero no si se anotó mientras ESE trabajo imprimía:
  si terminó, cuenta desde lo antes que pudo terminar (el envío + el 85 % de su estimado; en 11 impresiones
  ninguna tardó menos). Si falló, se canceló o la impresora quedó en el inicio después de un corte, cuenta desde el
  envío (pudo cortar en cualquier momento).
- Una reimpresión desde la pantalla de un trabajo que ya estaba cerrado queda «visto» si se la ve imprimiendo
  (ocupa la placa al terminar). El «finalizada» del trabajo viejo que sigue en la pantalla no cuenta como otra.
- `registro.py --validar`: rojo o amarillo por renglón (tipo desconocido, falta el trabajo, cierre antes del
  envío, minutos que no cierran con las horas, «enviada» de más de 24 h sin cierre, gramos negativos); sale con 1
  si hay rojos. Hoy marca la «cancelada» de 3 min del 15/10 07:06 para un trabajo mandado el día anterior.
- Los renglones nuevos llevan fecha y hora con zona (`2026-10-16T13:20:05-03:00`); los viejos se siguen leyendo.
- **Límite:** lo impreso directo desde Bambu Studio o desde la pantalla queda «visto» (sin gramos) solo si una
  PC habla con la impresora mientras lo imprime. Eso NO es el camino de Leo de §2 bis: ahí el archivo lo manda el
  asistente y se anota completo.

## 1 quinquies. La temperatura del lugar (idea de Fak, 13/10/2026)

La impresora no está en un lugar climatizado y de noche se apaga todo. Bambu pide **15 a 30 °C y
humedad por debajo de 85 %** (wiki de la A2L). `bambu_red.py --ambiente [minutos de la impresión]`
lo mide con dos fuentes y dice cuál es cada una:

- **La impresora en frío**: si está libre, con la placa apagada y la boquilla y la placa a menos de
  2 °C una de otra, esas lecturas son la temperatura del lugar (13/10 a la mañana: 16,5 y 17 °C).
  Con la impresora caliente no se puede medir y lo dice.
- **El pronóstico de afuera** para las horas que dura la impresión (open-meteo, Hurlingham, sin
  clave). Fak: adentro y afuera varían poco.

`--imprimir` lo muestra solo antes de mandar. **Avisa, no frena**: una pieza larga que queda
imprimiendo de noche con mínima por debajo de 15 °C se le dice a Fak con el número, y decide él.
Probado: una pieza de 30 min a las 12:30 no avisa; una de 10 h avisa (mínima 13,2 °C a las 23).

## 1 ter. Vigilar la impresión mirando la cámara (para que no lo haga una persona)

Fak, 13/10/2026: *"quedarte en modo escucha y revisar cada tanto, determinar si conviene frenarla
y en todo caso vos la frenás… es importante para que un humano no se quede haciendo eso"*.
Autorización suya, durable: **si veo una falla clara, la pauso yo** y le aviso.

**Dos capas, porque cuestan distinto:**

| Capa | Cada cuánto | Qué ve | Costo |
|---|---|---|---|
| El script lee el estado de la impresora | lo que manda la impresora (conexión abierta) | lo que detecta la propia máquina: pausa, error, alarma (`hms`), 15 min sin avanzar con la impresora contestando, sin conexión (1 min sin ningún paquete, o ~6 min sin un informe aunque conteste el aviso de vida). El arranque de la A2L deja prendidas la detección de «impresión en el aire» y la del cargador | nada |
| Yo miro una foto de la cámara | capa 1, capas 2-3, cada cambio de color y **cada 10 min** | pieza despegada, fideos, pegote en la boquilla, pieza corrida | un turno mío cada vez |

**De noche la cámara no ve** (desde ~20:45 se apagan las luces de la planta; con la luz de la impresora
prendida la foto sale casi negra igual, 15/10 22:05): **de noche se vigila solo el estado**. Una foto
negra no es «se ve bien».

**Cómo se corre:** en segundo plano, el comando que imprime `--apply` (`--fotos-en 3,10 --despertar 5`, sumando las
capas del cambio de color) para las primeras capas; pasadas esas, el mismo con `--despertar 10`. Qué hacer con cada salida:

| Salida | Qué pasó | Qué hago |
|---|---|---|
| **10** | pasaron los minutos de `--despertar` | abro la foto `*_REVISION.jpg` con Read, la juzgo y **relanzo el mismo comando**. Si dice «sin foto nueva: la cámara no contestó», no hay nada que juzgar: relanzo |
| 0 | terminó | aviso a Fak con la foto; `--avisar-retiro` en segundo plano |
| 1 | falló, la cancelaron, «el trabajo ya no está», o no arrancó ninguna impresión nueva en 10 min | aviso a Fak con la foto y el texto |
| 2 | pausa o alarma | aviso a Fak con la foto y el texto. Si es **pausa del cargador**, lo que dice la pantalla decide: si se terminó el filamento, «cargá un rollo igual en el lugar N y tocá reanudar»; si es un enredo, primero se destraba. Después relanzo con `--en-pausa` (mira cada 5 min sin volver a avisar la pausa ni la misma alarma; una alarma distinta sí sale) |
| 3 | 15 min sin avanzar **con la impresora contestando** | foto y aviso a Fak |
| 11 | alarma del detector | miro la foto y aplico la regla de abajo |
| **12** | sin conexión: ya la buscó por su serie y no está, o contesta pero no manda informes («muda») | aviso **una vez** («se perdió la conexión a las HH:MM: no sé si sigue imprimiendo; que alguien mire la pantalla: si tiene luz, imprime sola») y relanzo **`--seguir <carpeta> --buscar`**: prueba cada 2 min y solo sale cuando la encuentra (y sigue vigilando con su estado) o a la hora de fin + 1 h. **Nunca un `ping` a una dirección fija** |
| 13 | rechazó el código de acceso dos veces | aviso: «cambió el código o se apagó el modo desarrollador: Ajustes > Solo LAN». El código lo escribe Fak (`--pedir-codigo`) |
| **14** | terminó mientras no la veía | foto, el registro ya quedó cerrado; aviso «terminó; no la vi terminar: revisá que no se haya despegado nada» |
| 15 | ya hay otra vigilancia en esa carpeta | no lanzo otra |
| 16 | error del programa («No se pudo: …»), no de la impresora | aviso a Fak con el renglón; no es una falla de la impresión |

4 y 5 no se usan: son las del latido de la casa. Si la impresora vuelve en **pausa** con el mismo trabajo,
la salida 2 dice «posible corte de luz: mirá la pantalla; si ofrece reanudar, mirá la pieza antes». Reanudar
después de un corte lo decide una persona mirando la pieza, no la sesión. Qué hacer en la planta: la hoja de la
impresora, `reference/runbook-impresora.md` (una carilla para Leo y Paulo). Lo esencial:

- **«La impresora no contesta»**: que alguien mire la pantalla (prendida; imprimiendo, pausa o finalizada). Si
  imprime, se la deja: no depende de la PC. Ajustes > WLAN (wifi `barack_Oficinas_PA`, 2,4 GHz; ahí está su
  dirección) y Ajustes > Solo LAN (Solo LAN y modo desarrollador prendidos).
- **«Volvió la luz»**: si ofrece reanudar, primero se mira la pieza (pegada → reanudar; movida → cancelar). Si
  dice «Impresión finalizada», foto de la pantalla antes de tocar «Ok». Si está en el inicio sin preguntar
  nada, la impresión se perdió: no se manda otra hasta sacar lo que quedó y anotar `--placa-libre` (con un trabajo
  sin cerrar en el registro, `--imprimir` lo frena: «placa posiblemente ocupada»).
- El 15/10 a la noche la impresora pasó de la .198 a la .111 (§1 bis). Una reserva de dirección
  en el router para la MAC `90:E5:B1:D9:6D:F0` la deja siempre en la misma: el pedido es de Fak (Sistemas o el
  proveedor del router).

**De dónde sale el intervalo (buscado el 13/10/2026; no hay un número oficial para una persona):**
- Bambu (wiki «Spaghetti detection», series X1/H2): la impresora toma un cuadro cada T segundos,
  **acumula los últimos 10 cuadros** y recién ahí decide; sensibilidad baja/media/alta. No
  encontré que la A2L traiga esa detección: no se da por hecha.
- Detectores de terceros: Obico mira cada 30-60 s y no cuenta las primeras 30 lecturas;
  OctoEverywhere, ~40 s. Los laboratorios que usan Bambu piden **quedarse la primera capa** (UT
  Dallas: las primeras 3 a 5 capas).
- Mi revisión cuesta un turno, así que no puede ir cada 40 s: va **densa donde las fuentes dicen
  que falla (primeras capas, cambio de filamento) y cada 10 min después**. Diez minutos de una
  pieza de 60 g son ~6 g: lo que se pierde como mucho si no la veo antes.

**Filtro sin tokens (13/10/2026, EN PRUEBA): el modelo de PrintGuard.** `detector_fallas.py`
corre el modelo abierto de PrintGuard (5 MB, solo `onnxruntime`; entorno en
`C:\Dev\_printguard\.venv`, copia para reinstalar en `2- SOFTWARE\DETECTOR DE FALLAS IMPRESION 3D
(PrintGuard)\` de la nube). Da dos distancias por foto: a «sana» y a «fallada».
`--seguir ... --solo-medir` lo registra una vez por minuto sin dar alarma; `--detector` da la
alarma (salida 11) si tres fotos seguidas superan el umbral (0,45, o 1,8 veces la base de esa
impresión). Medido: 5 fotos sanas de la A2L → «sana» con 0,23 a 0,27; 12 fallas reales de Wikimedia
→ 7 detectadas y 5 no (se le escapa una capa corrida); un enredo real pegado sobre la pieza sube
la distancia con su tamaño (0,24 → 0,29 → 0,70 → «fallada»). **No decide: elige cuándo miro yo.**
Hasta tener el registro de varias impresiones enteras (y alguna falla real), mi mirada cada 10 min
sigue; la meta de Fak es pasarla a cada 30 min cuando el filtro esté validado.

**En una PC nueva el detector se instala solo:**
`python .claude/skills/impresion-3d-bambu/scripts/instalar_detector.py --probar` copia el modelo
desde `2- SOFTWARE\DETECTOR DE FALLAS IMPRESION 3D (PrintGuard)\` de la nube de Ingeniería a
`C:\Dev\_printguard\`, arma el entorno (unos 100 MB) y comprueba que contesta. Si ya está, no toca
nada. Correrlo antes del primer `--seguir --detector` en esa PC.

**Lo que dice Bambu de esta impresora está en `reference/bambu-a2l-oficial.md`** (wiki oficial de
la A2L, leída el 13/10/2026, con la página de cada dato): la placa y por qué se despega una pieza,
lo que la impresora detecta sola, materiales y placas admitidas, y el mantenimiento por horas y
por rollos. **Se lee antes de contestar cualquier cosa sobre la impresora.** Lo que más importa:
- **La placa se lava con agua tibia, detergente y esponja; alcohol no (desparrama la grasa en la
  textura), acetona nunca. No se toca con los dedos.** En Barack se venía limpiando con alcohol
  (Fak, 13/10/2026): si una primera capa falla, esto va antes que tocar el modelo o el laminado.
- La pieza se saca con la placa a temperatura ambiente, flexionando la chapa.
- **La wiki de la A2L no documenta una detección de fallas por cámara** (fideos, pieza despegada): eso lo ve mi
  mirada de las fotos. Detecta sola pegote en la boquilla, impresión en el aire y filamento trabado, a cualquier
  altura; por debajo de 10 mm suma un control de pegote cada tantas capas, y arriba de eso los demás siguen
  (`a2l/manual/nozzle-clumping-detection`). **Con el cargador, ante un enredo primero retrae y vuelve a cargar UNA
  vez por filamento y por impresión; la segunda vez de ese filamento da error y pausa**
  (`a2l/manual/air-printing-and-filament-tangle-detection`). La impresión en el aire corta, retrae y pausa.
- **Fin de rollo**: el cargador avisa que se terminó y pausa; con «AMS Filament Backup» prendido (pantalla,
  Ajustes > Opciones AMS) pasa solo a otro lugar con un rollo de **la misma marca, tipo, color y temperatura**
  (wiki `a2l/manual/screen-operation` y `ams-lite/manual/intro-ams-lite`). Si el respaldo está prendido no se
  sabe por la red: se mira en la pantalla. El código exacto de la A2L para fin de rollo **falta saberlo**:
  `--seguir` lo anota tal cual la primera vez que pase (sacar también una foto de la pantalla).

**Regla para frenar (copiada de los detectores: una sola imagen no alcanza):**
1. Si una foto muestra algo raro, **saco otra a los 60-90 s** (`--foto`). Si las dos muestran lo
   mismo y es claro (fideos, pieza despegada o corrida, pegote creciendo), **`--pausar`**. Pausar
   se puede deshacer; cancelar no.
2. Le aviso a Fak con las dos fotos y lo que vi. **Cancelar lo decide él**, salvo que la pieza
   ya esté claramente perdida y siga tirando material.
3. Ante la duda (foto oscura, reflejo, el cabezal tapa la pieza): no se frena, se saca otra.

**Límite que hay que decir:** la cámara de la A2L mira desde el borde de la cama, baja y de lejos.
Se ven las fallas gruesas; **no** se ve una capa floja, una sub-extrusión leve ni el detalle del
grabado. «No vi nada raro» no es «salió bien»: eso lo dice la pieza en la mano.

## 2. El comando

```bash
python .claude/skills/impresion-3d-bambu/scripts/laminar_bambu.py <pieza.3mf> <carpeta NUEVA> \
    --filamento "Bambu PLA Lite" --filamento "Bambu PLA Lite" \
    --color "#F4D31F" --color "#000000" \
    --parte-filamento "1=2" --parte-filamento "2=1"
```

- `--filamento` una vez por filamento, en el orden de los lugares del cargador (1, 2, 3, 4). El
  nombre es el del perfil de Bambu Studio sin la parte `@BBL A2L…`.
- `--parte-filamento "N=F"`: la parte N del objeto va con el filamento F. Bambu Studio **renombra
  las partes** al importar (`<objeto>`, `<objeto>_2`), por eso se asigna por número.
- Deja `<pieza>.gcode.3mf` (lo que se abre o se manda) y `resumen.json`. **No pisa** una carpeta
  con archivos y no manda nada a la impresora.

El `.3mf` de entrada con dos colores es **un objeto con dos partes** en las mismas coordenadas
(lib3mf: un `ComponentsObject` con dos componentes y un solo build item). Dos objetos sueltos
caen cada uno a la cama. Patrón: `C:\Dev\_utrim\build_v14_etiqueta.py`.

**Pieza resistente o ajustes del perfil:** `--ajuste clave=valor`, las veces que haga falta, con
los nombres de Bambu Studio (`wall_loops`, `sparse_infill_density`, `top_shell_layers`,
`bottom_shell_layers`). Frena si la clave no existe en el perfil (salvo `brim_type`, que el perfil no trae: borde de adherencia). El perfil estándar de la A2L
trae 2 paredes, 15 % de relleno, 5 capas arriba y 3 abajo. Para una pieza que recibe golpes o
cortes (molde de probetas, 13/10/2026): 5 paredes, 25 % de relleno, 6 capas arriba y 5 abajo.
**Más paredes y relleno multiplican el tiempo**: ese molde (1040 cm³) dio 10 h 49 min y 599 g.

**Antes de mandar, el tiempo se le dice a Fak si la impresión no termina con gente en la planta.**
Un «dale, mandala» dado sin saber cuánto tarda no cubre una impresión que queda sola de noche:
se lamina, se le muestra tiempo, gramos, hora en que termina y el aviso de ambiente, y decide él.
Su sí, con la frase textual y la fecha, va al `<archivo>.ok`: sin él `--apply` no manda una pieza de más de
3 h o que termina después de las 20:45. (13/10/2026: el molde terminaba pasada la medianoche con mínima de
12,8 °C; la decisión de esperar a Fak quedó solo en el chat, el contexto se compactó y se mandó a las 13:46
sin que lo viera. Terminó bien a las 00:18.)

**Un color solo en las capas de arriba de una zona** (marca, casillero, etiqueta): se parte la
pieza en cuerpo + una tapa fina (0,8 mm = 4 capas) que es parte aparte, y cada una con su
filamento. Solo hay cambios de color en esas 4 capas. Patrón: `_partir.py` del molde, en
`exports/impresion_3d/molde_probeta_50x50_20261013/` (corta sobre el B-Rep con build123d; la malla
del STL no cierra como volumen y las booleanas de malla no la aceptan).

**Un `.3mf` armado para otra impresora más grande** (14/10/2026: el soporte de microscopio de Leo, hecho
para una Elegoo Neptune 4 Max de cama 420): sin más, Bambu Studio frena con «objects are located over the
boundary of the heated bed». `--acomodar` le pide que reacomode las piezas (`--arrange 1`). Si no entran
en una placa las reparte en varias, y **el script frena** (salida 1, `"placas": N` en `resumen.json`)
porque el resumen, los controles y `bambu_red.py --imprimir` miran solo la placa 1; `--imprimir` tampoco
manda un archivo de varias placas. Se parte la entrada en un `.3mf` por placa (sacando del
`3D/3dmodel.model` los `<item>` y de `Metadata/model_settings.config` los `<object>`, `<model_instance>` y
`<assemble_item>` de lo que no va) y se lamina cada uno. Ojo: con soportes en árbol las piezas ocupan más
y salen más placas (Leo: 1 placa sin soportes ni ajustes; 2 con soportes en árbol y 3 paredes).

**La carpeta de salida va con ruta relativa o absoluta**: el script la resuelve (13/10: con una
relativa Bambu Studio escribía en otro lado y el laminado «fallaba» sin mensaje).

## 2 bis. El camino de Leo: la placa armada en Bambu Studio (mail de Leo, 15/10/2026)

Leo pidió tres cosas: un chequeo mínimo antes de mandar, poder armar él la placa en Bambu Studio (soportes,
distribución, orientación por la dirección de la fibra) y seguir desarrollando. **Su camino es válido:**
1. Él arma y lamina la placa en Bambu Studio y exporta el `.gcode.3mf` («Exportar archivo de placa laminada»).
   Material y placa: los de §5 (PLA Lite, Textured PEI).
2. Se lo pasa al asistente (la ruta del archivo). El asistente corre `bambu_red.py --imprimir <archivo>` **sin
   `--apply`**: ese es el chequeo mínimo (material y color contra lo cargado, gramos contra lo que queda,
   placa libre, varias placas, hora de fin, dibujo de la primera capa). Se le muestra y se manda con su sí
   (`--apply`), con la vigilancia en el mismo mensaje. Queda en el registro y en la ficha igual que lo demás.
   - Tiene que ser el `.gcode.3mf` exportado, **una placa por archivo** (con soportes en árbol su proyecto sale
     en 2 placas: se exporta cada una). Un `.gcode` plano no sirve: `--imprimir` lo rechaza.
   - **Una placa de más de 3 h o que termina de noche pide el `.ok` con la frase de Fak**, también en la sesión
     de Leo (la placa A de su soporte de microscopio dura 8 h): Leo se lo pide a Fak y la sesión escribe la frase
     textual y la fecha. Lo mismo `--sin-margen`. Sin eso, no sale.
3. **El criterio de orientación lo escribió la tanda 11** (17/10/2026) en la ficha FDM del skill `cad-design`
   (`cad-design/reference/ficha-fdm.md` §1): la carga principal va **paralela a las capas**, nunca tirando de ellas
   (O1), y el caso de la casa es el tornillo de 7 mm que, impreso parado, se partió bajo la cabeza (O4). Quien arma
   la placa la orienta con ese criterio; hacia dónde va la carga sale del GATE P del diseño (qué fuerzas actúan y en
   qué etapa), no se adivina al laminar.

## 3. Las cinco trampas (todas dieron "Success" con un código que no servía)

1. **La herencia de los perfiles no se resuelve sola.** Pasarle a `bambu-studio.exe` los `.json` del
   sistema tal cual dio boquilla 200 °C, flujo 1, densidad 0 y un solo filamento. El script
   **aplana** cada perfil (padre primero, hijo encima) y le pone su `*_settings_id`.
2. **El arranque propio de la máquina vive en plantillas aparte** (`include` en el perfil de la
   A2L: arranque, cambio de filamento, final). Sin incluirlas, el código sale con el arranque
   genérico: lamina bien y no es para esa impresora.
3. **Cargar perfiles sobre un `.3mf` que ya trae los suyos falla** («printer is not compatible
   with the process preset in the 3mf»). Por eso son **dos pasadas**: la primera lamina con los
   perfiles aplanados y deja un `.3mf` de Bambu con todo adentro; la segunda asigna el filamento
   de cada parte y lamina ese archivo sin cargar perfiles.

4. **El archivo sale sin el identificador del modelo de impresora** (`printer_model_id` vacío: ese
   dato vive en el json del modelo, `model_id`, que para la A2L es `N9`). El script lo completa
   en la copia final; el código no se toca (se comprueba el md5 interno).
5. **La miniatura del archivo miente en dos colores**: por comando sale toda de un color. Lo que
   dice quién imprime qué es el código:
   `python .claude/skills/impresion-3d-bambu/scripts/quien_imprime_que.py <carpeta>/plate_1.gcode`
   (por filamento: capas, mm y el rectángulo que ocupa sobre la pieza; el del grabado tiene que
   medir lo que mide el grabado).

## 4. Los controles (el script sale con 1 si alguno falla)

- La temperatura de boquilla del código es la del perfil del filamento.
- El laminado salió en UNA placa (con `--acomodar` puede repartir en varias: ver §2).
- La densidad no es 0 (el perfil de material se cargó).
- Si se pidieron varios filamentos, el código cambia de filamento.
- El arranque del código es el de la plantilla de esa impresora.

Y uno que hago yo, mirando `resumen.json`: **los gramos por filamento tienen que tener sentido con
el volumen de cada parte.** El 13/10 un reparto 29 g / 24 g con un grabado de 0,04 cm³ fue lo que
destapó la trampa 2.

## 5. Antes de entregar

- **Material: Bambu PLA Lite** (Fak, 13/10/2026: los rollos amarillo, negro y blanco son PLA Lite
  de Bambu) → `--filamento "Bambu PLA Lite"`. Si cambia de rollo, se le pregunta: **el material no
  se asume** (memoria `reference_impresora_3d_fak`, el caso del PETG).
- **Cama: la estándar de la A2L, «Textured PEI Plate»** (55 °C con PLA). El script la toma sola del
  json del modelo (`default_bed_type`) y frena si se pide una que el modelo no admite. Sin eso, por
  comando salía «Cool Plate» a 35 °C, que la A2L no soporta (`not_support_bed_type`): la primera
  versión del archivo del 13/10 salió así y se reemplazó. Otra cama: `--cama "<nombre>"`.
- El archivo va a la carpeta de la pieza en la nube de Ingeniería (`1- GENERAL\5. 3D\...`), con
  el tiempo y los gramos en el mensaje.
- La pieza en sí pasa primero por los gates del skill `cad-design`. **Las reglas de DISEÑO para imprimir no viven
  acá** (esta skill es cómo imprimir): viven en `cad-design/reference/ficha-fdm.md` — orientación contra la carga,
  holguras con su unidad (por lado o al diámetro), paredes, roscas y tuercas (la regla de Leo: la tuerca impresa
  mide al menos el diámetro del tornillo, y `make_screw_nut.py` no la modela más baja sin un motivo escrito) y lo
  que queda «a medir en la A2L». Lo que trae el perfil del laminador: compensación de agujeros **0** (no compensa) y
  pie de elefante 0,15 (ficha FDM, M4).
- Si el utillaje apoya sobre algo blando (tapizado, espuma), además el **GATE A de asiento** (`gate_asiento.py`) y,
  para toda pieza, el **criterio de aceptación escrito antes de imprimir** (qué se mide en la pieza impresa, con qué
  y con qué valor se acepta: `cad-design/reference/ficha-utillajes.md` K1; lo mira `gate_entregable.py`, G-E7).

## 6. Los otros programas de `scripts/`

| Programa | Para qué |
|---|---|
| `imprimir_pieza.py` | De un `.3mf` a la impresora en un solo paso: lamina, muestra el plan y, con `--apply`, manda (no lee STEP: la entrada es un `.3mf`) |
| `vista_previa.py` | La imagen de cómo queda la pieza con sus colores, antes de imprimir (para que Fak la valide) |
| `reporte_laminado.py` | En qué se va el tiempo y el material de un laminado (paredes, relleno, cambios de color) |
| `video_impresion.py` | Un video corto con las fotos de `--seguir` |
| `quien_imprime_que.py` | Qué filamento imprime cada capa: el control de los colores (la miniatura del archivo no sirve) |
| `registro.py` | Horas, gramos por rollo (con pesadas), placa libre, validar y mantenimiento que toca, sumando lo que anotó cada PC |
| `../tests/` | La impresora de juguete y los casos T1-T18 del plan del 16/10 (`docs/PLAN_IMPRESORA_2026-10-16.md`) más los arreglos de la auditoría. Sin la impresora real y sin tocar el registro real: `python -m unittest discover -s .claude/skills/impresion-3d-bambu/tests` (~4 min). Necesita el `openssl` de Git: sin él, los tests con la impresora de juguete se saltean y la corrida dice `skipped` |

## 7. Lo que falta ver con la impresora real

**Visto el 16/10 en la red de la planta, solo leyendo** (todo lo escrito fue a una carpeta temporal): TLS 1.2
anda; con el archivo apuntando a una IP falsa, `--estado` la encontró por la MAC en 25 s; con una serie falsa,
«no la encuentro»; el anuncio de la red (M-SEARCH) no tuvo ninguna respuesta; la A2L informa como `task_id` el
mismo número que se le manda.

- Si la A2L contesta el anuncio por el 2021 sin preguntarle; si escuchar el 2021 hace aparecer el cartel del
  firewall de Windows para Python (no es fatal: la búsqueda sigue con la MAC y el recorrido).
- La subida por FTPS (990) no la simula la impresora de juguete. Su núcleo es el de las impresiones reales del 13 al
  16/10; lo nuevo de esta tanda (comprobar la dirección antes, el progreso, los errores en un renglón) se ve en la
  primera impresión real con esta versión: de día y con una pieza chica.
- Que la A2L conteste el pedido de informe completo también en pausa y en preparación (si no, a los 6 min sin
  informes la vigilancia saldría 12 sin motivo).
- La pausa por fin de rollo: el código de la A2L se anota la primera vez que pase, con una foto de la pantalla.
- El respaldo automático en modo solo LAN y con dos rollos de chip distinto: una prueba corta de día, mirando.
- Si después de un corte de luz la A2L vuelve en pausa (lo dice un programa de la comunidad para otras Bambu).
