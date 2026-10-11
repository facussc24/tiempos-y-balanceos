# HOY-19 · Funciones nuevas para las skills: qué falta, con su evidencia (10/10/2026)

Pedido de Fak, 10/10/2026 18:59, dictado: *"ponete también a mejorar nuestras skills podes incorporar nuevas funciones
te doy un ejemplo testea en outlock digamos hacer más cosas en general en las skills"*. Encargo E261010-dd4e (fila HOY-19 de
`docs/COLA_CAMBIOS_CODIGO.md`). Este documento es el plan: **no implementa ninguna función**. Cada función lleva su
evidencia (un mensaje de Fak con fecha, o una capacidad de la herramienta medida en seco), su tamaño según
`codigo-madre.md` y su fila nueva en la cola.

## 1. En una pantalla

- **Lo que más pide Fak y no tiene skill es el mail**: 75 de los 254 pedidos de trabajo de Barack de 30 días (30 %).
  Hoy lo resuelven una regla y cinco programas; la skill ya está propuesta (P61). Acá van las **funciones** que les
  faltan a esos programas.
- **Outlook por programa da más de lo que usamos, y se midió sin escribir nada**: 37 lecturas, 37 bien, ningún
  cartel. Hoy `_mails.py --sync` recorre el buzón item por item (35 s de reloj para revisar 3.249 items y traer 0
  nuevos, corrida del 10/10); el filtro del propio Outlook cuenta los mails de la última semana en 0,01 s (falta medir
  cuánto tarda en traerlos). Las tareas, el calendario y los borradores viejos se pueden leer y hoy no los mira nadie.
- **Salen 14 filas nuevas**: 9 en HACER YA (lectura, texto de skill o el lector de mensajes, reversible) y 5 en
  PROPONER A FAK (programar un envío, convocar una reunión, limpiar borradores y dos skills nuevas).
- **Límite que encontró el auditor**: los 1.004 mensajes medidos son los que abren un turno. Lo que Fak escribe
  mientras la sesión trabaja (unos 704 mensajes más en la misma ventana) no entró: el lector que ya existía no los
  lee. El orden de las funciones se sostiene; los conteos son un piso. Arreglar el lector es la fila HOY-19n.
- **Lo que no se propone**, porque Fak no lo usa ni lo pidió. Medido: 0 reglas de Outlook, 6 categorías definidas y 0
  mails categorizados, 0 contactos, 0 subcarpetas en la Bandeja de entrada.

## 2. Cómo se midió

### 2.1 Los mensajes de Fak

| Qué | Dato |
|---|---|
| Fuente | registros de conversaciones de `~/.claude/projects/C--Dev-BarackMercosul*` (la carpeta del repo y sus worktrees) |
| Lector | `scripts/_lib/transcriptsFak.mjs` (`leerTranscripts`), el mismo de la prueba de disparo y de las propuestas de la noche: decide «esto es de Fak» por `origin.kind` y por la lista única `no_es_de_fak`; saca avisos de la app, encargos de otra sesión, subagentes y resúmenes de compactado |
| Ventana | del 10/09/2026 al 10/10/2026 |
| Mensajes | **1.004** reales (1.011 leídos, 7 repetidos sacados) en 154 sesiones; mediana 106 caracteres. **Son los que abren un turno**: el lector solo mira las líneas de usuario (`transcriptsFak.mjs`, `mensajeDeFak`) y deja afuera lo que Fak escribe a mitad de un turno, que queda como adjunto en cola. El auditor contó 708 de esos en la ventana, 704 sin medir: lo medido es el 59 % de lo que Fak escribió |
| Clasificación | por la API, Sonnet 5.5 `low`, 12 lotes de 84, con el catálogo de las 30 skills del repo y sus descripciones. Costo real: **US$ 0,51**. Los conteos los suma el programa, no el modelo |
| Salida por mensaje | tipo (pedido · seguimiento · otro), tema (lista cerrada de 21), skill que lo atiende, cobertura (cubre · a medias · no cubre) y la función que falta |

Resultado: 398 pedidos nuevos, 500 seguimientos o correcciones, 106 otros. De los 398 pedidos, 144 son del sistema
Claude, de «explicame» o sueltos; quedan **254 pedidos de trabajo de Barack**: 149 cubiertos, 30 a medias, 73 sin
skill y 2 sin clasificar, uno de AMFE y uno de BOM (59 %, 12 % y 29 %). **En mail, «cubre» quiere decir que lo
resuelven los programas que ya hay**: skill no tiene.

**Verificación a mano**: muestra fija de 40 mensajes con cobertura asignada (semilla 20261010). 34 coinciden sin
reparos, 4 son discutibles (un pedido que mezcla dos temas) y 2 están mal (el tema). Acuerdo: 85 % estricto, 95 % si
los discutibles valen. **El auditor sacó otra muestra de 30 (semilla 4242) y le dio menos: 63 % estricto y 80 % con
los discutibles**; las dos juntas, 53 de 70 (76 %). El error que se repite es de tema: al menos 19 de los «254
pedidos de trabajo de Barack» no son de Barack. Las cifras por tema valen como orden de magnitud, no al mensaje. **Límite que importa**: el clasificador solo ve la descripción de cada skill, no su cuerpo ni
los programas. Por eso «a medias» y «no cubre» son candidatos: cada función de la tabla de abajo se cotejó además
contra el texto de la skill y contra `scripts/`. Varias cayeron ahí (sección 5).

### 2.2 Pedidos por tema (solo pedidos nuevos, 30 días)

| Tema | Pedidos | Cubre | A medias | No cubre | Qué hay hoy |
|---|---|---|---|---|---|
| mail | 75 | 68 | 0 | 7 | regla `mail-envio.md` y 5 programas; sin skill (P61) |
| archivos (abrir, buscar, nube) | 45 | 1 | 0 | 44 | `_abrir.mjs`, `_nube.mjs`, reglas; sin skill. 16 de los 44 son «abrímelo» y 2 «pasame la ruta» |
| hoja de proceso | 25 | 18 | 7 | 0 | skill `hojas-de-proceso` |
| BOM y consumos | 22 | 17 | 4 | 0 | `carga-arb`, `verificacion-consumos` |
| AMFE | 15 | 5 | 7 | 2 | `amfe-domain`, `pieza-nueva-flujograma-amfe`, comandos de auditoría |
| PowerPoint, Excel, PDF | 14 | 1 | 3 | 10 | skills genéricas de Office; ninguna de la casa |
| PPAP y legajo | 11 | 8 | 3 | 0 | `apqp-legajo`, `ppap-motherson` |
| flujograma | 9 | 8 | 1 | 0 | `flujogramas` |
| arb | 9 | 9 | 0 | 0 | `arb-operar` |
| 3D | 7 | 4 | 1 | 2 | `cad-design` |
| IMDS | 6 | 4 | 2 | 0 | `imds` |
| videos y fotos | 5 | 2 | 0 | 3 | `editar-video`, regla `video-maquina.md` |
| planos · patrones · imprimir · tiempos · plan de control | 11 | 4 | 2 | 5 | `leer-planos`, `patrones-corte-plotter`, `imprimir`; tiempos y plan de control sin skill (P6) |

Skills **sin pedido en la muestra** (no se descartan): `render-a-foto-real`, `product-map`, `supabase-safety`,
`rule-enforcement-gate`, `lanzar-sesion-hija`; y con un solo mensaje: `informe-tryout`, `injection-process`,
`apqp-schema`, `autocad-verificar`, `patrones-corte-plotter`, `superficie-vinilo-3d`, `lamina-de-proceso`.

Conteos por palabra sobre los 1.004 (sirven de piso, no de clasificación): «abrí / abrime / abrilo / abrir» en 53
mensajes; «PowerPoint / presentación» en 38; «ruta / dónde está» en 30; «imprimí / impresora» en 9. Con los mensajes
de mitad de turno que contó el auditor, «abrí» sube a 80 y PowerPoint a 58.

### 2.3 Outlook por programa: prueba en seco, solo lectura

Cuatro programas de prueba en la carpeta temporal de la sesión, corridos con Outlook ya abierto por Fak (versión
16.0). Solo contaron y midieron tiempos. No crearon, movieron, borraron, guardaron ni transmitieron nada; no leyeron
cuerpos, destinatarios ni organizadores, y ningún asunto se imprimió. Cada programa miraba cada 2 s si Outlook sacaba
un cartel y, si salía, cortaba y lo decía: los cuatro terminaron enteros.

| Qué ofrece Outlook | Medido | Lo usamos hoy |
|---|---|---|
| Buzones del perfil | 1 cuenta, 1 buzón (`f.santoro@`), 39 carpetas | sí (`--sync`) |
| Filtro del lado de Outlook (`Restrict`, tabla) | por fecha, por asunto, con adjuntos, sin leer (610), importancia alta (57), convocatorias (41): cada uno **cuenta** en 0,01 a 0,07 s. Traer los mails que encuentra no se midió | **en `_mails.py`, no**: `--sync` recorre item por item; corrida entera del 10/10: **35 s** para 3.249 items y 0 nuevos (recorrer 400 de la Bandeja: 2,27 s). El programa que sube los mails del equipo (`tools/claude-area/mails_outlook.ps1`) ya trae lo recibido desde una fecha sin recorrer todo: ordena por fecha y corta, y no depende del formato regional |
| Hilo de un mail (`GetConversation`) | anda: sobre los 60 mails más nuevos, el hilo más largo dio 4 mensajes; 1,5 s los 60 | no (el hilo se arma por asunto) |
| Calendario | 134 citas cargadas, 114 sueltas y 20 que se repiten; la última suelta empieza el 26/08. **En los próximos 14 días hay 24 y en los últimos 30, 51: todas son repeticiones de 4 series** (4 asuntos distintos), marcadas como reunión por una propiedad de la cita, sin leer invitados; 0,2 s. Las reuniones de este mes que Fak nombró en el chat no están cargadas | **no** |
| Tareas de Outlook | 8, 7 sin completar, ninguna con fecha vencida | no |
| Borradores | **40**: 30 tienen más de 90 días (el más viejo, 862), 24 llevan adjuntos, solo 2 están en el registro de los programas que arman borradores | a medias (`_prepararMail.py` reemplaza el propio; nadie lista el resto) |
| Reglas del buzón | 0 | no hace falta |
| Categorías | 6 definidas, 0 mails categorizados | no hace falta |
| Contactos · notas | 0 · 3 | no hace falta |
| Carpetas de búsqueda | 15 (las que trae Outlook) | no |
| Respuesta automática | se lee (apagada) | no |

**Trampa encontrada, con su número**: el filtro por fecha depende del formato regional de la PC. Con la fecha escrita
mes/día/año, «recibidos en 7 días» dio **1.364** (1.357 en la primera pasada, minutos antes); contando a mano y con día/mes/año o con el filtro DASL (fecha
año-mes-día) dio **60**. En el calendario lo mismo: «últimos 30 días» dio 0 con un formato y 51 con el otro. Toda
función que filtre por fecha nace con su caso de control contra la cuenta a mano.

**No medido**: nada que escriba (crear una cita, programar un envío, mover un borrador); cuánto tarda el filtro en
traer los mails y no solo en contarlos; `AdvancedSearch`; el calendario de otra persona; el filtro con Outlook sin
conexión; si las carpetas `Archivo` y `Files` del buzón tienen algo de Fak (se contaron, no se abrieron).

**Dato para la fila H56 de la cola**: este Outlook tiene un solo buzón. `ingenieria@barackmercosul.com` no es una
casilla del perfil, por eso no aparece en `--buzones`. Si es un alias de `f.santoro@` o una cuenta sin buzón lo sabe
Fak.

## 3. Las funciones que faltan

Orden: primero lo que Fak pide más seguido y es solo lectura. Tamaño según `codigo-madre.md`. «HY» = HACER YA,
«PF» = PROPONER A FAK.

| Fila | Skill o programa | Función que falta | Evidencia | Tamaño | Va en |
|---|---|---|---|---|---|
| HOY-19a | mail (`_mails.py`) | **`--nuevos`**: traer lo que llegó desde la última lectura sin recorrer el buzón, con el método que ya usa `tools/claude-area/mails_outlook.ps1` (ordenar por fecha y cortar) o con el filtro de Outlook | Medido: `--sync` tarda 35 s para 0 nuevos; el filtro cuenta los de la semana en 0,01 s (traerlos no se midió). Fak: 28/09 11:18 *"Luciano me acaba de enviar un mail podes verficailro"*; 25/09 08:04 *"gonzalo cal me acaba de preguntar algo por mail"*; 09/10 09:43 *"fijat eque carjao me paso pablo gamboa... dice que me envio cosas"*; 22/09 14:28 | mediano | HY |
| HOY-19b | mail (`_mails.py`) | **`--abrir <id>`**: mostrar en Outlook el mail original, y abrir un adjunto en pantalla en un paso (`--adjuntos`, que lo baja a `.mail-cache/adjuntos` como hoy, + `_abrir.mjs`). Abrir un mail en su ventana puede dejarlo marcado como leído: se mide con un mail propio y, si pasa, se vuelve a dejar sin leer | Fak: 23/09 12:22 *"abrime el mail original de hilo anrnaja asi abroi la carpeta desde ahi"*; 06/10 14:11 *"abrime el mial ese que dice que es de 1,45"*; 09/10 12:51 *"los ultimso mails abrime el pdf quiero velro"*; 08/10 16:57 *"apsame la foto de ese mail"*. Hoy `--ver` imprime texto y `--adjuntos` extrae sin abrir | mediano | HY |
| HOY-19c | mail (`_mails.py`) y prioridades de la noche | **`--agenda`**: leer las reuniones de los próximos días y las tareas de Outlook, y sumarlas a «qué tengo pendiente» | Medido: 4 series de reuniones que se repiten (24 citas en 14 días) y 7 tareas sin completar que hoy nadie mira; ninguna reunión suelta cargada desde agosto, así que rinde de verdad si se aprueba HOY-19j. **La evidencia es la capacidad medida: ningún mensaje de Fak nombra el calendario**; los que siguen piden ordenar pendientes, que hoy atienden `--sin-respuesta`, `_seguimientos.mjs` y las prioridades de la noche. Fak: 08/10 08:24 *"revisa mis mails mist ares pedneintes decime prioridda numero 1"*; 09/10 14:21 *"Que tarea podemos ahcer pensando en nivel de urgenica"*; 21/09 07:42 *"rol orgniazador de teareas ayudame"* | mediano | HY |
| HOY-19d | mail (`_mails.py`) | **`--borradores`**: listar los borradores con su edad, si llevan adjuntos y si los armó un programa (solo lectura) | Medido: 40 borradores, 30 de más de 90 días, 24 con adjuntos. `mail-envio.md`: un borrador viejo del mismo asunto es «una bomba con el asunto correcto». Fak 21/09 14:46 *"borra vos los dos borradores duplicados y todos los que esten viejos tamiben"* | chico | HY |
| HOY-19e | `hojas-de-proceso` | **Inventario**: qué hojas hay de una pieza o proyecto, cuál es la última versión y cuáles están completas | Fak: 05/10 12:22 *"de patagonia que hojas de preoceos de costura tenemos lsisatas"* y 12:30 *"revisa que esten compeltas las incompeltas no me srienv"*; 07/10 08:50 *"deberian estar todas... la ultima veriso"*. La skill tiene `_hoNumeros.py` (números) y el gate de una hoja; no tiene el listado por proyecto | mediano | HY |
| HOY-19f | `arb-operar` | **Historia de una línea**: cuándo cambió un código, una unidad o un consumo, leyendo los exports fechados que ya se guardan | Fak: 21/09 08:51 *"Como que cambia el codigo del upper trimming? en que omoento cambio?"*; 22/09 09:29 *"porque esta en kg en arb? osea cual es elorigen de ese cambio... revisa mails viejos boms viejas"*. Hay 42 exports `RELACIONES_<fecha>` en `.arb-cache/` (25/08 al 08/10) y 32 fotos más en `.arb-cache/pre-cambio/` (desde el 07/08): 74. `candidatos_relaciones` de `scripts/_lib/arbRelaciones.py` ya lista las dos carpetas; ningún programa las compara. Es lectura de archivos: no toca el arb | mediano | HY |
| HOY-19g | `docs-empresa` (descripción) y `video-maquina.md` | **Buscar fotos y videos de una máquina o pieza** en la biblioteca: que la skill que rutea diga dónde y con qué (`_videoBiblioteca.mjs --indice`, `_materialAfuera.mjs`) | Fak: 02/10 09:38 *"busca le vide de cmaibo de molde en la amquina d eip core"*; 01/10 08:59 *"la foto de la pieza entnera ? no esta en ningun lado del server?"*; 07/10 14:15 *"lso videos origngiales videos sin editar"*; y la tanda de las prensas del 01/10 (LECCIONES: «"no hay" se dice después de listar sin filtro de palabras»). La regla carga solo al tocar un `.MOV` o el programa: en una búsqueda no entra | mediano (cambia cuándo se dispara una skill, como H24) | HY |
| HOY-19h | `cad-design` (**no se tocó**: el 10/10 la tenía la hija de CATIA) | (1) **Foto de un 3D recibido en un paso**: la descripción no nombra «mostrame / foto de un 3D que llegó»; `render_step.py` existe para STEP; para un CATPart hace falta CATIA por programa (HOY-20, probado el 10/10, espera una confirmación de Fak). (2) **Buscar un 3D por nombre o por quién lo hizo** fuera de los dispositivos | Para (2): Fak 08/10 09:33 *"refuerzos 3d de pwa... que siempre imprimre paulo... fiajte si los ecnontras"* y 10:11. `indice_dispositivos.py --buscar` cubre solo dispositivos. Para (1) no hay pedido que lo sostenga: el 09/10 12:57 Fak pidió *"una foto del 3d"*, recibió recortes del plano 2D y corrigió eso; ese día no había archivo 3D (lo leyó el auditor en el registro de la sesión). Queda como mejora de descripción, sin apuro | mediano | HY, después de que Fak conteste HOY-20 |
| HOY-19i | mail (`_prepararMail.py` + `_mailEnviar.py`) | **Programar el envío** de un mail ya aprobado para una hora (entrega diferida de Outlook) | Fak 01/10 23:13 *"progrma ale mail con el ultimo pwoer point par aenviarse mañana 8am podes hacerlo correomcent o es muy difciicl eso nunca lo habimaos hecho"*. Outlook lo trae; **no se probó porque es escribir**. Choca con tres controles de `mail-envio.md` (abajo) | grande (nunca se hizo y toca el control de envío) | PF · tu sí |
| HOY-19j | mail (programa nuevo) | **Convocar una reunión** por Outlook: armarla y dejarla abierta en pantalla, como un borrador; y el recordatorio | Fak 02/10 11:49 *"organicemos una reunion de amfe... pone encopai ca rlos poen a ciclelia como dirigido a ella la reuneiuon manuel en copia"*; 09/10 08:54 *"mandale sotro mail recordandoles que tenemos la reunion en 1 hora"*. Hoy la reunión se avisa por mail suelto y no queda en el calendario (medido: ninguna cita suelta desde el 26/08). Solo cuando Fak la pide para esa reunión; ningún recordatorio sale solo (el seguimiento de la reunión de AMFE ya lo lleva `scripts/_seguimientos.mjs`, que nació de ese mismo mensaje). Se leyó un solo calendario, el de Fak | grande (programa nuevo que termina en un envío) | PF · tu sí |
| HOY-19k | mail | **Limpiar borradores viejos**: mover a Eliminados los que nadie tocó en N días, con la lista de HOY-19d a la vista | Mismo dato de HOY-19d. Mover es escribir en Outlook | chico | PF · tu sí |
| HOY-19l | skill nueva `presentacion-evidencia` | **PowerPoint simple de evidencia** para un gerente: blanco, fotos y capturas reales, logo oficial, tabla, una idea por hoja | 38 mensajes nombran PowerPoint o presentación en 30 días. De los 6 pedidos de PowerPoint sin skill, el auditor dejó 2 que son de esto (02/10 y 05/10) más 2 correcciones (09/10); los otros eran una presentación personal, un «abrilo» y el del 01/10, que ese mismo día pasó a ser la skill `superficie-vinilo-3d`. Fak: 02/10 11:36 *"nenceisot ver la evidenica en un pwoer point con fotos asi ajdunto eso en el mail"*; 09/10 11:20 *"parec ehecho con ia... el wpoer point me da una fea snesasion"*; 09/10 14:20 *"un pwoer point simple"*. Evidencia floja: decidir con Fak si alcanza. Toca **X43** de la cola (descartada porque no se había medido el trabajo de Office por programa, que esta medición tampoco contesta) | mediano | PF · aviso |
| HOY-19m | skill nueva `tiempos-por-video` | **Toma de tiempos desde un video**: tiempos por ciclo, qué tramo no cuenta, video recortado adentro del PowerPoint | Fak: 07/10 15:53 *"necniestoamso lso tiempso... hay que recortar algunas partes"*; 08/10 08:47 *"ese timepoque etarda en acomodaorloa l rpicncipio no pdmeos consideararlo"*; 08/10 08:33 *"lso videos recordtados... dentor del wpoer point"*. Los tres mensajes son de una sola sesión y un solo trabajo (R5 ya había contado uno el 08/10); además hay una lección del 07-08/10. El método vive en una memoria de referencia que solo entra si el índice la trae | mediano | PF · aviso |
| HOY-19n | lector de mensajes (`transcriptsFak.mjs`) | **Leer también lo que Fak escribe a mitad de un turno** (adjuntos en cola de origen humano), como ya hacen `horaGuard.mjs`, `cierreGuard.mjs` y `mailOkFak.mjs` | Auditor 10/10: 708 mensajes así en 30 días, 704 fuera de esta medición. El mismo lector alimenta la prueba de disparo y las propuestas de skills de la noche | mediano | HY |

### Por qué cada una va donde va

- **HACER YA** las que leen (Outlook, archivos del arb, la biblioteca) o cambian el texto de una skill: reversibles y
  adentro del repo. `--abrir` muestra una ventana en la pantalla de Fak, que es lo que pide; en Outlook no guarda ni
  manda nada (el adjunto se baja a la carpeta de siempre, ignorada por git). Cambiar la descripción de una skill ya
  se hizo así en H24, midiendo el disparo antes y después. **HOY-19h y HOY-19e están en HACER YA pero frenadas**: la
  primera espera la respuesta de Fak sobre CATIA (HOY-20) y la segunda no se puede probar hasta ver el servidor.
- **PROPONER** las que escriben en Outlook o hacen que salga algo: `autonomy-contract.md` §E (irreversible o hacia
  afuera) y §F (primera vez). En HOY-19i el sí de Fak va **después** de ver el borrador (`mail-envio.md`), igual que
  hoy; lo que cambia es que el mail sale solo a la hora. Lo que hay que resolver antes de hacerla, porque un mail
  programado espera en la Bandeja de salida: (1) el control «nada de ese asunto en la Bandeja de salida» frenaría
  otro mail del mismo hilo; (2) la verificación de después («cola vacía y mail en Enviados») no puede correr en el
  momento; (3) si un dato cambia antes de la hora hay que poder cancelarlo, y hoy no hay un camino escrito para eso.
  **Sin verificar**: si Outlook tiene que estar abierto a esa hora o lo entrega el servidor.
- **Las dos skills nuevas van como aviso**: Fak ya dijo que se incorporen funciones; una skill nueva suma texto al
  listado que entra en cada sesión, por eso se le avisa antes de crearla.

## 4. Qué pide cada función al hacerla

| Fila | Archivos | Pruebas | Riesgo |
|---|---|---|---|
| HOY-19a | `scripts/_mails.py` (función nueva al lado de `sync`), su selftest | caso de control del formato de fecha (la cuenta a mano de 2.3) y uno de hora (Outlook devuelve hora local; `mail-envio.md` ya anota un corrimiento de 3 h); el mismo conjunto de ids que `--sync` sobre una ventana de 7 días; medir cuánto tarda en traer, no solo en contar | un filtro mal escrito trae de menos sin avisar: por eso se compara contra `--sync` antes de reemplazar nada. `--sync` queda |
| HOY-19b | `scripts/_mails.py`, `scripts/_abrir.mjs` (se reusa) | con un Outlook falso: que solo llame a mostrar, nunca a guardar ni a transmitir; el `mail-guard` ya deja pasar mostrar | un mail de la nube del equipo no está en el Outlook de Fak: se dice, como hoy en `--adjuntos` |
| HOY-19c | `scripts/_mails.py`; `scripts/_lib/nocturno.mjs` solo para leer del cache | formato de fecha; citas que se repiten; que no lea organizador ni invitados (puede sacar el cartel) | los asuntos de las reuniones van a `.mail-cache/` (ignorado por git, verificado), nunca a un archivo versionado. Si entran al paso de prioridades de la noche, el asunto y la hora salen hacia la API, igual que hoy los asuntos de los mails: se decide al hacerla, y la primera versión puede quedarse en mostrar la agenda en la sesión. Una reunión no es una tarea de Fak: se muestra como agenda del día, no como pendiente |
| HOY-19d | `scripts/_mails.py` o `_prepararMail.py` | edades con fecha fija; los 2 del registro marcados como «de un programa» | ninguno: lista |
| HOY-19e | skill `hojas-de-proceso` (sección corta arriba del corte) y un programa de listado | contra la carpeta real del servidor cuando la PC esté en Barack; hoy el servidor no se ve desde esta red | el listado maestro es registro compartido: se lee, no se escribe |
| HOY-19f | `scripts/_arbHistoria.py` nuevo, skill `arb-operar` (una fila en la tabla de arriba) | con dos exports reales: una línea que cambió, una que no, una dada de baja | el repo es público: el programa imprime, no guarda consumos en archivos versionados |
| HOY-19g | `.claude/skills/docs-empresa/SKILL.md` (descripción y una fila del mapa) | `node scripts/_probarMejora.mjs` con el mensaje real del 01/10; prueba de disparo | cambia cuándo se dispara una skill: medir antes y después |
| HOY-19h | `.claude/skills/cad-design/` | prueba de disparo con los dos mensajes del 09/10 | choca con el cambio de CATIA (HOY-20) si se hace antes |
| HOY-19i | `_prepararMail.py`, `_mailEnviar.py`, `mail-envio.md`, `mailOkFak.mjs`, tests | primero a la casilla de Fak, con él mirando | un mail programado con un dato que cambió sale igual: el control de «revalidar justo antes» deja de correr |
| HOY-19j | programa nuevo, `mail-envio.md`, `mail-guard` | con un Outlook falso; después una reunión de prueba consigo mismo | una convocatoria es un envío: tiene que pasar por los mismos controles (gerente en copia, nadie de afuera) |

Las medianas van por el camino mediano de `codigo-madre.md` (plan corto, leer entero lo que se toca, tests, auditor
Opus); HOY-19d y HOY-19k son chicas; HOY-19i y HOY-19j, grandes (plan propio y el sí de Fak). Una sesión por función, salvo HOY-19a a HOY-19d, que tocan el mismo
archivo: van en una sola sesión, de a una, o se pisan. En las cuatro, las pruebas contra Outlook corren con el vigía
del cartel y sin leer destinatarios ni casillas que no hagan falta (`--sync` ya lee remitente y destinatarios todos
los días sin cartel; lo nuevo se mide antes de darlo por bueno).

## 5. Lo que el clasificador marcó y no es una función nueva

| Lo marcado | Por qué no nace fila |
|---|---|
| «Abrir un archivo en pantalla» (16 pedidos nuevos) y «pasame la ruta» (2) | ya existe `_abrir.mjs` y el cierre exige la ruta. Es conducta: fila **H46**, que con 53 mensajes con «abrí» en 30 días (pedidos y correcciones) merece subir en el orden |
| Skill de mail | ya es **P61** (con el sí de Fak del 09/10). Las filas a, b, c y d le dan funciones |
| Planes de control (2 pedidos y 3 seguimientos) | **P6**, con plan escrito |
| Revisar y corregir un AMFE que ya existe (7 «a medias») | lo hacen los comandos de auditoría y `amfe-domain`; el clasificador mandó 3 de los 7 a `pieza-nueva-flujograma-amfe`, que es para armar de cero |
| «Hicimos que deje de enviarnos sus mails… quiero seguir recibiendo» (07/10) | no es una regla de Outlook: es el programa que sube los mails del equipo |
| Subir los mails a la nube solos (08/10) | existe (`--buzones` dice la última subida de cada buzón) |
| Peso de una pieza en un IMDS viejo · transcribir un audio de WhatsApp · plano de un remache | un mensaje cada uno en 30 días; las dos primeras tienen memoria de referencia |
| Compartir por link de OneDrive | resuelto el 08/10 (`mail-envio.md`) |
| Reglas, categorías, contactos y carpetas de Outlook | medido en 2.3: Fak no las usa y no las pidió |

`arb-operar` contra los pedidos: los 9 pedidos de arb de la muestra están cubiertos por la tabla de operaciones de la
skill. Lo único que falta según los pedidos es HOY-19f. La contradicción entre la cabecera y la sección «Seguridad» ya
es P64.

`cad-design` contra los pedidos: 4 de 7 cubiertos. Falta la búsqueda de un 3D fuera de los dispositivos (HOY-19h).
Nada de esto se probó en CATIA.

## 6. Lo que quedó sin medir

- **Los mensajes de mitad de turno**: unos 704 en la ventana (41 % de lo que Fak escribió). No se clasificaron. La
  fila HOY-19n arregla el lector; después conviene repetir esta medición, que cuesta menos de un dólar.
- **La salida de la corrida de `--sync`** (35 s, 3.249 items) no quedó guardada en un archivo: está en el registro de
  la sesión y en `.mail-cache/sync.log`.
- **El cuerpo de cada skill contra cada pedido**: se cotejó solo para las filas de la tabla 3, no para los 149
  «cubre». Un «cubre» puede esconder una función que la skill nombra y no resuelve bien.
- **Si los 7 repetidos que se sacaron eran repetidos de verdad** (mismo texto y mismo minuto): no se miraron uno por uno.
- **Los seguimientos** (500 mensajes): la tabla 2.2 cuenta solo pedidos nuevos. Una función que Fak pide siempre como
  corrección («no, abrímelo») queda subcontada; por eso se sumó el conteo por palabra.
- **Nada que escriba en Outlook**, ni el arb, ni CATIA, ni el servidor (no se ve desde esta red).
- **Más de 30 días**: los registros anteriores al 10/09 ya no están en la PC.
- **La clasificación con otro modelo**: una sola pasada con Sonnet; no se midió cuánto cambia con Haiku o con Opus.

## 7. Dónde quedó cada cosa

- Programas de medición, mensajes extraídos y salidas crudas (los conteos, las cuatro pasadas de Outlook, la muestra
  de 40): carpeta temporal de la sesión `cebd5916`, subcarpeta `hoy19`. No va al repo: tiene los mensajes de Fak
  enteros. Las cifras de este plan salen de esas salidas.
- Revisión independiente del plan por la API (Opus): `.sgc-cache/sesion-2026-10-10/HOY19_revision_opus.md` (25
  puntos; se aplicaron los que la evidencia sostenía, entre ellos que las 24 citas eran 4 series).
- Filas nuevas: `docs/COLA_CAMBIOS_CODIGO.md`, HOY-19a a HOY-19h y HOY-19n en HACER YA, y HOY-19i a HOY-19m en
  PROPONER A FAK.
- Auditor Opus: `.sgc-cache/sesion-2026-10-10/auditor_HOY19.md` (6 errores reales, 11 de robustez, 6 falsos
  positivos). Aplicados los 6 y los de robustez que cambian una fila; no se aplicó repetir la medición con los
  mensajes de mitad de turno.
