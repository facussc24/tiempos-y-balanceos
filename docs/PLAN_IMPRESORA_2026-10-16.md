# Plan — la impresora Bambu A2L: buscarla por su identidad, vigilancia que distingue «sin conexión» de «quieta», y los frenos que la skill prometía y el código no hacía (tanda 17 del plan del sistema, 16/10/2026)

Lo escribió la sesión Fable 5.1 de la PC principal el 16/10/2026 a las 13:15 a partir de los informes
`H1_impresora_red_y_corte_de_luz.md` y `H2_skill_impresion_3d_a_fondo.md` (equipo H, CATA, 16/10 09:20-10:03) y de
`10-PLAN_SISTEMA_2026-10-16.md`, tanda 17. **El sí de Fak ya está** (16/10 09:40: *«quiero solucionarlo de cualquier forma»*).
Tamaño: **grande** (`codigo-madre.md`: cambia lo que Fak usa todos los días) → plan en `docs/`, hija en worktree, tests,
revisor independiente (auditor Opus) y commit. Lo implementa una sesión hija en Opus 5.5; la revisa la sesión principal.

## 0. Lo que ya está hecho hoy (no se repite)

- La copia local de esta PC (`%USERPROFILE%\.claude\bambu-a2l.json`) y la de la nube dicen `ip 192.168.1.111` y tienen `mac 90:E5:B1:D9:6D:F0` (respaldos `.antes-2026-10-16*` al lado).
- En el registro compartido quedaron cerrados `juegos20` (terminada, 77/77, hora real desconocida), `pines20` (cancelada, capa 8/79) y `pines_v3_prueba` (fallida, 27 %). Con eso el negro pasa de «quedan 19 g» a «~47 g»; sigue siendo una cuenta sin pesar.
- El mail de Leo del 15/10 08:45 está leído: **no trae fotos de fallas** (los 7 adjuntos son las imágenes del mail original de Fak); Leo pide (1) un chequeo mínimo antes de mandar, (2) poder armar la placa en Bambu Studio y mandarle el G-code al asistente (soportes, distribución, orientación por fibra), (3) seguir desarrollando. Eso entra en §4 (SKILL).
- **Hay una impresión en curso desde otra sesión de esta PC** (`placa_v2`, mandada 12:49, vigilancia `--seguir` corriendo con PID 9516 sobre `exports/impresion_3d/seguimiento_placa_v2_20261016`). **Por eso el código se toca en un worktree y NO se le manda nada a la impresora real desde la hija.** Las pruebas van contra una impresora de juguete y lecturas guardadas.

## 1. Los casos de respuesta conocida (escritos ANTES de codear; la tanda no se da por hecha sin ellos)

Todos corren sin la impresora real, con `python -m unittest discover -s .claude/skills/impresion-3d-bambu/tests` (Python 3.13 del sistema, sin librerías de terceros; no hay pytest en esta PC). **Ningún test escribe en el registro real de la nube**: `registro.CARPETA` y `bambu_red.DATOS` / `DATOS_NUBE` se redirigen a una carpeta temporal en cada test.

| # | Caso | Entrada | Lo que tiene que salir |
|---|---|---|---|
| T1 | El log de anoche | las lecturas de `seguimiento.log` del lote de 20 (RUNNING hasta 23:30:54, después `None` cada ~38 s; se reconstruyen de `20-informes\oportunidades\H_insumos\chat_2026-10-15_noche_lote20_sesion729dfcec.md`, que trae el `tail` del log) | `clasificar()` → **salida 12 «sin conexión»**, no 3 «quieta» |
| T2 | Lectura real de una A2L | `MOCK-A2L.json` de `greghesp/ha-bambulab` (MIT; bajarlo con la API de GitHub a `tests/fixtures/`, con su URL y commit en un `FUENTES.txt`) | `clasificar()` → imprime y avanza (sin salida) |
| T3 | Vuelve en FINISH con el mismo trabajo | lecturas: RUNNING `subtask_name=X` → hueco de 20 min sin conexión → FINISH `subtask_name=X` | salida **14**, el registro (temporal) tiene «terminada» para ESE `trabajo_id`, con `fin_visto` y `minutos_reales: null` |
| T4 | Vuelve en PAUSE con el mismo trabajo | igual que T3 con PAUSE | salida 2 con el texto «posible corte de luz: mirá la pantalla» |
| T5 | Vuelve en IDLE o con otro trabajo | igual con IDLE | salida 1 con «el trabajo ya no está» |
| T6 | Código de acceso rechazado | la impresora de juguete contesta CONNACK 5 | salida **13**, texto «cambió el código de acceso o se apagó el modo desarrollador» |
| T7 | Cambió de dirección | archivo de datos (temporal) con `ip` 127.0.0.2 (nadie escucha) y la juguete en 127.0.0.1:8883 con certificado CN = serie | `ubicar()` la encuentra, **corrige solo la copia local (temporal)** con respaldo, anota `{"tipo":"ip"}` en el registro (temporal) e imprime «la impresora cambió a 127.0.0.1; archivo corregido» |
| T7b | Otra impresora en la dirección | juguete con certificado de OTRA serie | no la da por encontrada: «en 127.0.0.1 hay otra impresora (serie …)», sigue buscando, termina «no la encuentro» con salida 12 |
| T8 | No alcanza el rollo | un `.gcode.3mf` de prueba que pide 78 g del negro contra un registro (temporal) donde al negro le quedan 19 g | `--imprimir` (sin `--apply`): «NO SE MANDA: no alcanza el negro (pide 78 g, quedan ~19 g, margen 30 g)», salida 1 |
| T8b | Alcanza justo | mismo archivo, quedan 200 g | pasa el freno de gramos |
| T8c | De noche sin respaldo | archivo de 4 h pedido a las 19:00 (termina 23:00), negro con 80 g y sin segundo negro cargado | frena: «de noche con menos de 100 g y sin rollo de respaldo igual» |
| T9 | Cancelar cierra el registro | `--cancelar` contra la juguete con un trabajo «enviada» abierto con ese `subtask_name` | renglón «cancelada» con el `trabajo_id` correcto (no «el último abierto»: el test deja DOS abiertas de dos PC y se cierra la que tiene ese nombre) |
| T10 | Pieza larga sin el `.ok` | archivo de 4 h, sin `<archivo>.ok` | `--imprimir --apply` frena ANTES de subir: «falta el OK de Fak en <archivo>.ok (pieza de más de 3 h)»; con el `.ok` presente, pasa |
| T11 | Placa con piezas | estado FINISH y ningún «placa_libre» posterior en el registro | `--imprimir --apply` frena «placa ocupada: confirmá que la sacaste con registro.py --placa-libre»; con el renglón posterior, pasa |
| T12 | El reloj de «quieta» sobrevive a las relanzadas | `estado_seguimiento.json` en la carpeta con `ult_avance` de hace 16 min y la misma clave; `--seguir --despertar 1` contra la juguete que informa RUNNING sin cambiar capa | salida **3** en la primera vuelta (hoy no puede saltar nunca con `--despertar` < 15) |
| T13 | Validador del registro | copia del registro real de hoy | `registro.py --validar` marca la «cancelada» de `DESKTOP-90DOEFV` del 15/10 07:06 con 3 min para un trabajo mandado el día anterior, y las filas sin cierre |
| T14 | Nunca un Traceback | cada comando (`--estado`, `--seguir`, `--imprimir`, `--foto`, `--cancelar`, `--velocidad`, `--luz`, `--ambiente`, `--avisar-retiro`) con la juguete apagada | salida distinta de 0, un renglón en castellano con qué pasó y qué mirar, y **ninguna línea `Traceback`** en stderr |
| T15 | Dos vigilancias a la vez | un `--seguir` ya corriendo (candado con PID en la carpeta) y otro sobre la misma carpeta | el segundo sale «ya hay una vigilancia (PID N) sobre esta carpeta» |
| T16 | Horas | un renglón nuevo del log y uno del registro | fecha y hora completas con zona (`2026-10-16T13:20:05-03:00`); el resumen sigue leyendo los renglones viejos (`%Y-%m-%d %H:%M:%S`) |
| T17 | La orden se corta entre mandar y anotar | `--imprimir --apply` contra la juguete que acepta | el renglón «enviada» existe ANTES de la orden (estado `sin confirmar`) y pasa a `confirmada` con `task_id` y `subtask_name` cuando la impresora contesta |
| T18 | Elegir el rollo gastado | dos negros PLA Lite iguales en los lugares 2 y 4, con 47 g y 980 g según el registro | `mapa_automatico` elige el lugar 2 (menos gramos) y lo dice |

Lo que **no** se puede probar sin la impresora (lo hace la sesión principal después del merge, con la impresora libre): IP falsa en el archivo real → `--estado` la encuentra y corrige; serie falsa → «no la encuentro»; la pausa por fin de rollo (se anota la primera vez que pase, con la foto de la pantalla).

## 2. `bambu_red.py` — qué cambia, en este orden (un commit por bloque, con rutas)

### 2.1 Nunca un Traceback (mediano; H1 §3.5)
- Un `main()` envuelve todos los comandos: `TimeoutError`/`OSError` 10060/10065 → «No encuentro la impresora en <ip> (no contesta). La busco en la red…» y llama a `ubicar()`; `ConnectionRefusedError` (10061) → «En esa dirección hay un equipo, pero no es la impresora o tiene apagado el modo desarrollador»; `ssl.SSLError` → «En esa dirección contesta otra cosa: la busco por su número de serie»; rechazo del código (CONNACK 4/5) → el texto de hoy + «mirá Ajustes > Solo LAN en la pantalla». Cada uno con su código de salida (12 sin conexión, 13 acceso rechazado). Un `KeyboardInterrupt` sale limpio.
- `tls()`: tope **TLS 1.2** (`ctx.maximum_version = ssl.TLSVersion.TLSv1_2`, como ha-bambulab); timeout corto configurable.
- **El certificado se comprueba en cada conexión**: el CN del certificado tiene que ser la `serie` del archivo (reusar el parseo de `preparar()`); si no coincide → «en <ip> hay otra impresora (serie …)» y se busca. Nunca se le manda nada a un equipo cuyo certificado no trae la serie.

### 2.2 `ubicar()` (grande; H1 §2.3, prototipo probado `20-informes\oportunidades\H_insumos\buscar_impresora.py`)
Orden, cada candidato verificado por certificado = serie:
1. la última dirección del archivo local, intento de 3 s al 8883;
2. las direcciones que anotaron las otras PC: renglones `{"tipo":"ip","ip":…,"serie_ok":true}` del registro compartido (los más nuevos primero);
3. el anuncio SSDP: escuchar 1990 y 2021 (multicast 239.255.255.250) 15 s y mandar un M-SEARCH desde un puerto cualquiera; si el puerto está ocupado (Bambu Studio abierto) o el firewall no deja, se dice en un renglón y se sigue: **no es fatal**;
4. si el archivo trae `mac`: barrido de ping a la subred (sale de `ipconfig`, no fija) y `arp -a` (el prototipo lo hizo en 1,5 s);
5. recorrido de la subred en el 8883, 0,5 s por equipo, en paralelo.
Encontrada: **corrige solo la copia local** de esta PC (`DATOS`; con respaldo `.antes-<fecha>`), **nunca el `bambu-a2l.json` de la nube** (dos PC escribiendo el mismo archivo de OneDrive = copias en conflicto; `registro.py` encabezado), anota el renglón `ip` en el registro (archivo de esta PC) e imprime «la impresora estaba en .198, ahora .111; archivo corregido». No encontrada: salida 12 con «no encuentro la impresora en la red (probé la dirección del archivo, el anuncio, la MAC y el recorrido): ¿está prendida y en la wifi barack_Oficinas_PA? Mirá en la pantalla Ajustes > WLAN». Si la **propia PC** no llega al router (ping al gateway falla): «la que perdió la red es esta PC, no la impresora».
`cargar_datos()` deja de exigir que la IP sea verdad: es una pista que `ubicar()` verifica.

### 2.3 `--seguir` (mediano; H1 §3)
- **Una conexión que queda abierta**: MQTT con keepalive 60 s, PINGREQ cada 30 s, `pushall` al conectar y después cada 5 min; los informes llegan solos. «Sin conexión» = error de la conexión o 60 s sin ningún mensaje; «quieta» = llegan mensajes y en 15 min no cambian capa, % ni etapa con RUNNING.
- Salidas nuevas: **12** sin conexión (una sola vez; antes de salir intenta `ubicar()`; si la encuentra en otra dirección no sale: corrige, anota y sigue), **13** acceso rechazado (no al primer rechazo: ha-bambulab lo vio también con la impresora apagada; dos seguidos), **14** terminó mientras no la veía. **4 y 5 no se usan** (son del latido de la casa). 0/1/2/3/10/11 como hoy.
- `--seguir <carpeta> --buscar`: modo búsqueda después de un 12: prueba `ubicar()` cada 2 min y solo sale cuando la encuentra (sigue vigilando con su estado) o a la hora estimada de fin + 1 h. Prohibido el `ping` a una dirección fija como forma de esperar (va al SKILL).
- **Conciliar al reconectar** (y en cada conexión de cualquier comando, idea de bambuddy): FINISH con el mismo trabajo (`subtask_name` o `task_id` del renglón «enviada») → cierra el registro por ESE `trabajo_id` con `fin_visto` y `minutos_reales: null`, saca foto, salida 14 «terminó; no la vi terminar: revisá que no se haya despegado nada»; PAUSE con el mismo trabajo → salida 2 «posible corte de luz: mirá la pantalla; si ofrece reanudar, mirá la pieza antes»; IDLE u otro trabajo → salida 1 «el trabajo ya no está: probable corte sin reanudar, o alguien lo canceló». Un trabajo que la impresora informa y no está en el registro se anota como «visto» (lo imprimieron desde Bambu Studio o la pantalla).
- **El reloj de «quieta» sobrevive a las relanzadas**: `estado_seguimiento.json` en la carpeta con `ult_avance` y `ult_clave`; se lee al arrancar. Una salida 10 sin foto nueva no se presenta como revisión (dice «sin foto nueva: la cámara no contestó»).
- **Pausa por fin de rollo**: PAUSE con `hms`/`print_error` del cargador → foto, renglón «rollo terminado» en el registro (chip, lugar, hora) y el mensaje «cargá un rollo igual en el lugar N y tocá reanudar». El código exacto de la A2L **falta saber**: se reconoce PAUSE + un `hms` cuyo código empiece por `0700` (cargador) o `1200` y se anota el código tal cual la primera vez. `--seguir --en-pausa` sigue vigilando con intervalo largo (5 min) hasta RUNNING/FINISH/IDLE, avisando una sola vez.
- **Reparto de gramos**: si `ams.tray_now` cambia a mitad de la impresión, se anota el cambio con la capa; al cerrar, los gramos se reparten entre los dos chips en proporción a las capas (marcado «reparto estimado por capas»).
- Candado: `<carpeta>/vigilancia.pid`; si hay otra viva, el segundo sale «ya hay una vigilancia (PID N)». La cámara que no contesta se anota una vez («sin cámara desde HH:MM»), no en cada vuelta.
- Fecha y hora completas con zona en cada renglón del log (`seguimiento.log`) y del registro.

### 2.4 `--imprimir` (chicos y medianos; H1 punto 9, H2 §1)
- **Freno de gramos** por lugar del cargador: gramos del archivo contra lo que queda según `registro.gramos_restantes(chip)` con margen `max(30 g, 15 %)`; con menos de **100 g** avisa «pesalo» en cada envío; con menos de **50 g** y una pieza que termina después de las **20:45** sin un rollo de respaldo igual cargado (mismo `tray_info_idx` y color) → frena. `--sin-margen` lo saltea (solo con la frase de Fak en el chat, lo dice el SKILL). Estos números son propuesta sin fuente (H2 §2.5): se escriben como constantes con ese comentario y se ajustan con las pesadas.
- **Negro = siempre con respaldo** (regla de Fak 16/10 10:20): antes de mandar algo en negro se mira que haya un segundo negro PLA Lite cargado; si no, **avisa** (no frena de día). `mapa_automatico` elige entre dos rollos iguales **el que tiene menos gramos** según el registro.
- **FINISH o FAILED = placa ocupada**: `--apply` frena hasta que exista en el registro un renglón `placa_libre` posterior al fin de ese trabajo (`registro.py --placa-libre` lo escribe quien sacó las piezas); con IDLE pasa (alguien tocó la pantalla; se dice). RUNNING/PREPARE/PAUSE como hoy.
- **El `.ok` de Fak**: una pieza de más de **3 h** o que termine después de las **20:45** no se manda sin `<archivo>.ok` al lado del `.gcode.3mf` (lo escribe la sesión con la frase textual de Fak y la fecha; es el `.imprimir-ok` del papel). Se controla ANTES de subir.
- **Releer el estado justo antes de dar la orden** (otra PC pudo mandar durante los ~2 min de subida).
- **Anotar «enviada» antes de la orden** (estado `sin confirmar`, con `task_id` y `subtask_name`) y pasarla a `confirmada` cuando la impresora contesta.
- El aviso de envío trae **paredes, relleno, borde, soportes y orientación** (del `plate_1.gcode`/`slice_info.config`), «primera capa en 6-16 min» y **«termina a las HH:MM»** (estimado × 1,02; en 9 impresiones el real quedó entre −7 % y +2,3 %); de noche agrega «después de las 20:45 la cámara no ve».
- Subida con progreso («subidos 12 de 20 MB»); a los 2 min, si la impresora sigue en PREPARE + etapa 77 + renglón 0, lo dice (la trampa de la unidad 16) y sale con 1. `--apply` vuelve apenas pasa a RUNNING (no espera 150 s fijos). Nunca se corre dentro de `timeout` (SKILL).
- **La ficha por pieza**: `ficha.json` en la carpeta del `.gcode.3mf` (nombre con las palabras de Fak = el `stem`, archivo vigente, ajustes, gramos y minutos estimados, fecha de envío, chip usado); `--seguir` la completa al cerrar (minutos reales, resultado: terminada / fallida / cancelada, foto final). `--ficha <carpeta>` la imprime. «Descartado y por qué» es un campo que la sesión escribe a mano.
- `--cancelar` cierra en el registro el trabajo que la impresora informa (por `subtask_name`) como «cancelada» con `avance_pct` y capa; una falla (FAILED) lo cierra como «fallida». `cerrar_en_registro()` deja de existir como «el último abierto».
- `--selftest`: Python, Bambu Studio y los perfiles de la A2L, Pillow, `.venv-cad` (para `vista_previa.py`), carpeta de la nube sincronizada y registro escribible, archivo de datos presente (sin mostrar el código), detector instalado, versión de la skill contra la copia de la nube. Sale 0/1 con un renglón por chequeo.
- `--version` imprime la versión de la skill (`VERSION = "2026-10-16"` en `bambu_red.py` y en el encabezado de `SKILL.md`).

## 3. `registro.py` (chicos; H2 §2.6)
- `cerrar(trabajo_id, tipo, **campos)`, `abiertas()` (por PC y por nombre), `gramos_restantes(chip)`, `anotar_ip(ip)`, `ips_anotadas()`, `placa_libre()`, `ultimo_fin()`: las funciones que usa `bambu_red.py`.
- `--pesar <lugar|chip> <gramos>` [`--tara <g>`]: renglón «pesado»; el resumen descuenta desde la última pesada de ese chip, no desde 1000. Tara por defecto 250 g marcada «sin medir (tienda: 250; foro: 208-260)»; el primer carrete vacío que se pese queda como tara de la casa (`--tara`).
- Eventos nuevos: `ip`, `placa_libre`, `rollo terminado`, `rollo cargado`, `visto`, `pesado`, `cambio de rollo`.
- `--validar`: cada renglón con su tipo conocido, `trabajo_id` presente, cierre con `cuando` posterior a la «enviada», minutos coherentes con las horas (una «cancelada» con 3 min para un trabajo de ayer da rojo), «enviada» sin cierre de más de 24 h, chips con gramos negativos. Rojo/verde por renglón y salida 1 si hay rojos.
- `--resumen`: aviso de rollo bajo (< 100 g «pesalo»; < 50 g «solo piezas chicas de día o con respaldo»), estimado contra real por trabajo, y qué rollo está en qué lugar según el último `--estado`.
- Lee los renglones viejos (`%Y-%m-%d %H:%M:%S`) y los nuevos (ISO con zona).

## 4. `SKILL.md` y `reference/bambu-a2l-oficial.md` (chicos; H2 §1.4 y §6)
1. Las seis correcciones: el molde se mandó y terminó (00:18, 632,9 min reales) — sacar la contradicción de las líneas 10 y 248; el ejemplo de §2 con `"Bambu PLA Lite"`, no Basic; el enredo con el cargador **reintenta una vez** antes de pausar (wiki `air-printing-and-filament-tangle-detection`); «la impresora no informa cuánto le queda» con el dato (`remain = -1`, `tray_weight = 1000`; el cargador de 4 no tiene la opción); de noche la cámara no ve (después de las ~20:45, solo se vigila el estado); el número de versión.
2. Las salidas nuevas de `--seguir` (12/13/14, `--buscar`, `--en-pausa`), el `.ok`, la placa libre, el freno de gramos y `--sin-margen`, el respaldo del negro, `--pesar`, `--validar`, `--selftest`, la ficha por pieza, «el envío y la vigilancia siempre en segundo plano y nunca dentro de `timeout`», «prohibido esperar con un `ping` a una dirección fija», «el código de acceso se dice que está en la foto, no se transcribe en el chat», nada en inglés en el chat.
3. **Lo de Leo**: un chequeo mínimo antes de mandar es lo que ya hace el plan sin `--apply` (se le muestra y se manda con su sí); **el camino de Leo es válido y se documenta**: armar la placa en Bambu Studio (soportes, distribución, orientación por fibra) y mandarle el `.gcode.3mf` exportado al asistente, que lo manda, vigila y registra igual. El criterio de orientación por fibra queda anotado como pendiente para la tanda 11 (ficha de ingeniería de producto), no se inventa.
4. El runbook de H1 §5 («la impresora no contesta» / «volvió la luz») pegado en el SKILL, y una hoja de una carilla `reference/runbook-impresora.md` para Leo y Paulo (con «cómo cambiar un rollo»: **verificar en la wiki** cómo va la recarga en el carrete reutilizable —si el chip viaja en el cartón de la recarga y el carrete se abre en dos— y escribirlo con su página; si la wiki no lo dice, queda «a confirmar»).
5. `reference/bambu-a2l-oficial.md`: corregir el enredo, releer las 11 páginas contra los `.txt` de `4- MANUALES\IMPRESORA 3D BAMBU LAB A2L\` (listar en el commit qué cambió), y sumar lo de las páginas nuevas (respaldo, fin de filamento, hub trabado, tarjeta MicroSD, recuperación ante cortes: general de Bambu, la A2L no lo documenta).
6. Partir el SKILL si pasa de 500 renglones: gates y comandos en `SKILL.md`, el detalle a `reference/`.

## 5. Las páginas nuevas de la wiki a `4- MANUALES\IMPRESORA 3D BAMBU LAB A2L\` (chico; regla `documentacion-oficial.md`)
Con `scripts/wiki_bambu.py <ruta> "<carpeta>" --captura` (deja `.html` crudo, `.txt` con FUENTE/BAJADA en la cabecera y `.png`): `en/a2l/manual/screen-operation`, `en/ams-lite/manual/intro-ams-lite`, `en/ams/manual/ams-function-introduction`, `en/a2l/troubleshooting/filament-hub-clear`, `en/knowledge-sharing/power-loss-recovery`, `en/general/printer-network-ports`, `en/knowledge-sharing/enable-lan-mode`, la del carrete reutilizable y la de la recarga (buscar la ruta en el índice de la wiki). Si el guardián `documentacion-oficial-guard` frena el comando, bajarlas a `exports/impresion_3d/fuentes_bambu/nuevas_2026-10-16/` y decirlo en el cierre: las mueve la sesión principal.

## 6. Tests, simulador y fixtures
- `.claude/skills/impresion-3d-bambu/tests/impresora_juguete.py`: servidor TLS en 127.0.0.1:8883 con certificado hecho una vez con el `openssl` de Git (`C:\Program Files\Git\usr\bin\openssl.exe`, `-subj "/CN=<serie de prueba>"`; el `.pem` de prueba va al repo, es de juguete), MQTT mínimo (CONNECT/CONNACK con código configurable, SUBSCRIBE, PUBLISH, PINGREQ/PINGRESP), guion de lecturas por escenario (RUNNING que avanza, RUNNING quieta, FINISH, PAUSE, IDLE, muda, desaparece y vuelve en otra dirección: 127.0.0.1 → 127.0.0.2 si Windows lo permite, si no otro puerto), anuncio SSDP opcional en 2021.
- `tests/fixtures/`: `MOCK-A2L.json` (MIT, con `FUENTES.txt`), `seguimiento_2026-10-15_noche.log`, un `.gcode.3mf` mínimo de prueba (zip con `Metadata/slice_info.config`, `Metadata/plate_1.gcode` con la cabecera de tiempo y filamento), un registro de prueba.
- `tests/test_bambu_red.py` y `tests/test_registro.py`: T1 a T18. Los tests se corren en las dos direcciones (lo que debe frenar frena; lo que debe pasar pasa).

## 7. Qué puede romper, y cómo se sabe
- La vigilancia de `placa_v2` que corre ahora usa el código viejo: no se toca `main` hasta que termine (la sesión principal funde la rama después).
- Un `ubicar()` que recorre la subred lo puede ver Sistemas: va en el pedido de la reserva de dirección (lista de Fak).
- Escuchar el 2021 puede mostrar el cartel del firewall de Windows a Python: por eso no es fatal y de noche la vigilancia no depende de él.
- La conexión abierta: la A2L aguantó anoche ~700 conexiones nuevas en 7,5 h; una sola con keepalive es menos carga, no más.
- `cerrar_en_registro()` por nombre: si el nombre informado por la impresora no coincide con el `subtask_name` anotado (otra PC, otra skill), no se cierra nada y se anota «visto»: nunca se cierra un trabajo ajeno.
- Partir el SKILL puede dejar afuera lo que la sesión necesita: `node scripts/_pruebaDisparoSkills.mjs` antes y después.

## 8. Cómo se entrega
- Un worktree, un commit por bloque (§2.1, §2.2, §2.3, §2.4, §3, §4, §5, §6) con `git commit -m "…" -- rutas`; **sin push**. El último turno de la hija dice la rama, los commits (`git log --oneline`), el resultado de `python -m unittest discover …`, qué quedó sin hacer y por qué, y qué pide la prueba con la impresora real.
- El zip nuevo de la skill (`exports/impresion_3d/skill_impresion-3d-bambu_2026-10-16.zip`, sin el archivo de datos ni el código de acceso) y un borrador `exports/impresion_3d/mail/borrador_skill_v2026-10-16_a_leo_y_paulo.md` con la voz de Fak: **no se manda ningún mail** (prohibido en esta tanda; lo manda Fak o una sesión de Barack con su OK).
- Después, en la sesión principal: revisión del diff, auditor Opus (revisor independiente), suite completa (`npm test`, porque agrega archivos), merge `--no-ff` a `main` con la impresión terminada, push, CI por la API de GitHub, prueba con la impresora real (IP falsa → la encuentra; serie falsa → no la encuentra), lección a `LECCIONES_APRENDIDAS.md` y memoria.

## 9. Necesita de Fak (no frena nada; va en su lista)
1. La reserva de dirección en el router para la MAC `90:E5:B1:D9:6D:F0` (quien tenga la clave: Sistemas o el proveedor), que esa wifi siga en 2,4 GHz y que sepan que el programa recorre la red cuando no la encuentra.
2. Anoche: ¿se cortó la luz de toda la planta? ¿la impresora estaba prendida con «finalizada» cuando llegó? ¿alguien tocó la pantalla? ¿las otras veces la ventana «finalizada» mostraba horas y gramos o «-h / -g»?
3. Opcional: pesar el negro y el amarillo montados (balanza de cocina) → `registro.py --pesar`.
4. A dónde va el aviso de «terminó» sin sesión (propuesto: archivo de estado en la nube + programita de la tanda 6; mail interno; o nada). Celular no.
5. Opcional: copiar `Logger` y `Recorder` de la tarjeta a la nube; una UPS chica para el router.
