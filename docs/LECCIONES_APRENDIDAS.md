# Lecciones Aprendidas — Barack Mercosul APQP (destilado vivo)

Archivo mantenido por Claude Code. Entra completo al system prompt (`@import` desde CLAUDE.md),
por eso contiene solo lo accionable que no esta ya codificado como regla o gate ejecutable. Cada
leccion es un bullet legible de hasta 600 caracteres; el detalle vive en la memoria o el snapshot
que cita (gate por bullet: regla `lecciones-consolidacion.md`). La historia completa de cada
incidente vive en los snapshots.

- **Snapshots** (la version larga de cada consolidacion): los tres ultimos son [2026-10-02](docs/_archive/LECCIONES_snapshot_2026-10-02.md) · [2026-10-03](docs/_archive/LECCIONES_snapshot_2026-10-03.md) · [2026-10-04](docs/_archive/LECCIONES_snapshot_2026-10-04.md) · [2026-10-05](docs/_archive/LECCIONES_snapshot_2026-10-05.md) y el historico 2026-03-30 a 07-02, [2026H1](docs/_archive/LECCIONES_APRENDIDAS_2026H1_completo.md); los demas estan en `docs/_archive/`.
- **Tabla incidente → regla**: `docs/_archive/INCIDENTES_REGLAS_AMFE.md`
- Lo ya codificado no se repite aca: reglas de `.claude/rules/` y sus gates ejecutables
  (amfe.md + amfeValidator, database.md, verify-supabase-live.md, no-pfd-no-ho.md, techo-agentes.md, cad-3d.md).

## Verificacion y evidencia

- **05-06/10 — Un filtro que busca por palabras no se promete como garantía; y si Fak ya pidió algo y aceptó el riesgo, mi regla de freno no le gana a su pedido: se hace y el riesgo va en un renglón** (dejé apagados los mails de Carlos por tres auditorías con fallas; Fak: *"lo único que tenías que hacer era eso"*). Graduado a las memorias `project_mails_del_equipo_a_la_nube` y `project_claudes_por_area`.
- **04/10 — Una prueba de «esto se niega» se arma con el de mentira PUESTO y comprobado antes de la primera corrida.** Graduado a la barrera de `tools/claude-area/sync_area.ps1` (solo registra desde la copia instalada) y a la memoria `project_claudes_por_area`.
- **04/10 — Una hoja de alto fijo recorta lo que no entra sin avisar: después de tocar un papel se MIRA la imagen del PDF, no la cantidad de páginas.** Graduado a la memoria `project_claudes_por_area`.
- **04/10 — A un agente que abre Word o Excel se le pone tope de tiempo por corrida, y un agente o una conversación que no escribe hace 10 minutos se mira: no se espera.** Graduado a la memoria `project_claudes_por_area` y a `scripts/_colgados.mjs`.
- **04/10 — Dos tandas de jueces distintos no se comparan por su total: un examen nuevo se mide contra el anterior con los MISMOS jueces y a ciegas, y la regla de «se publica o no» se escribe antes de mirar.** Graduado a `pareado_v7.py` (carpeta de examen) y a la memoria `project_claudes_por_area`.
- **03/10 — Una prueba contra la carpeta de VERDAD deja su huella, y en la biblioteca de Ingeniería nada se borra: va con `--simular` o contra una copia**. Graduado a la memoria `project_claudes_por_area`.
- **03/10 — «Borrá lo temporal al terminar» sin decir CUÁL termina en un borrado por comodín: un agente se llevó 38 borradores ajenos de la carpeta que comparten todos.** Graduado a la memoria `reference_notebook_capacidad_agentes_con_navegador` (carpeta propia con su nombre; se borra esa y nada más).
- **03/10 — Un freno que depende de un programa de la PC se prueba SIN ese programa: un control que no puede arrancar no frena nada**. Graduado a `hooks.json` del plugin (Node propio, por su ruta), a `ejecutables` de `_paquete.mjs` y a la memoria `project_claudes_por_area`.
- **02/10 — Un examen se toma como lo va a usar la gente (nivel, material de su área, PC instalada por el instalador), y el aviso de un documento va donde se LEE ese documento**. Graduado a la memoria `project_claudes_por_area`.
- **02/10 — De un flujograma o de un AMFE puede salir la PALABRA "reproceso", nunca su analisis (IATF 8.7.1.4; fue una no conformidad en 2019), y un AMFE escrito de cero se delata por el largo de sus frases** (12 palabras por causa contra 4 a 7; Calidad: "hecho con IA"). Graduado a la memoria `reference_iatf_retrabajo_8714_y_antecedentes_barack` y a `TOPE_PALABRAS` de `scripts/_lib/amfeAutoria.mjs`.
- **15-28/09 — Un cartel del arb se LEE antes de contestarlo: es lo primero que se mira cuando no deja seguir (no mi teoría), lo que actúa a ciegas aprieta lo que esté abajo, el botón es `Omitir` y no `Anular`, y se cierra solo lo propio.** Graduado al skill `arb-operar`, a `_arbDescripcion.por_que_no_avanza()`, `_arbCargar.abrir()`, `_arbVer.cerrar_excel()`, `fallas-modales-y-export.md` y la memoria `feedback_bom_en_unidades_no_en_envase`.
- **25/09 — Un estado que alguien escribió en un mail vale con su FECHA: va con quién lo dijo y cuándo (y el mail adjunto), o no va.** Graduado a la memoria `la_fecha_del_archivo_no_es_la_fecha_del_documento`.
- **22/09 y 05/10 — Lo que AFLOJA un control se prueba contra el VIEJO con los mismos intentos, lo ataca OTRO, y el «a la tercera, afuera» se escribe antes de medir** (05/10: tres versiones de un freno aflojado pasaron mis pruebas y 1.662 mensajes reales; tres auditorías les encontraron un hueco; se sacó). Graduado a `un_control_se_audita_en_las_dos_direcciones` y a `project_claudes_por_area`.
- **22/09 — Un cambio de criterio (o un número) se barre por su FRASE en todo el repo, y un guardián que falla sin bloquear está apagado.** Graduado al test 5c de `hooksTienenTest` (`${CLAUDE_PROJECT_DIR}`) y a `puerta.py` (puerta D).
- **22/09 — La VARA también se audita, y lo primero que se le mira es la FECHA**: la tabla AP y las escalas O/D salían de un borrador de 2017 del AIAG-VDA. La tabla AP ya es la oficial (23/09); las escalas, pendientes. Memoria `project_tabla_ap_de_la_casa_es_el_borrador_2017`.
- **22/09 y 02/10 — Una foto sacada de un video no se juzga por una medida: se MIRA y se abre su FUENTE.** Graduado a `fotodevideo.py contacto` + `gate_fotos_miradas` y a `gate_foto_no_es_de_falla()` (`hojas-proceso.md`, Enforcement).
- **22/09 — Whisper no se calla cuando no entiende: INVENTA, y una transcripción alucinada pasa el gate igual que una buena.** Graduado a la memoria `extraer_video_audio_local` (una pasada por idioma, fusión por `avg_logprob`, repeticiones marcadas `(ALUCINA)`).
- **22/09 — Un gate contesta lo que le preguntan: los obstáculos se listan del CONJUNTO, no del subconjunto, centrado y simetría también se miden, y un control que frena dice CUÁL renglón lo frena.** Graduado a `chequeo_centrado.py` y a la memoria `dispositivo_adhesivado_insert`.
- **21/09 — Cortar un listado para leerlo es una decisión sobre los DATOS, y un control que queda rojo por trabajo pendiente se termina ignorando.** Graduado a `video-maquina.md` y a la memoria `videos_y_fotos_de_maquina_donde_van`.
- **21/09 — Antes de ejecutar un pedido que toca a un cliente, se abre el sistema del CLIENTE: ahi esta si el trabajo ya se hizo y por que esta trabado** (un 8D cerrado hacia semanas en KPM; un "agregale la norma" que era un PPAP rechazado en IMDS). Memorias `8d_11010843_tapa_amarok`, `project_imds_barack`.
- **10-13/09 — Una contradicción adentro del entregable es un ROJO, no una nota al pie; la frase que resume números la arma el CÓDIGO.** Graduado a la memoria `contradiccion_en_el_entregable_es_rojo`.
- **11/09 — El system prompt es la foto del arranque: antes de concluir que algo quedó sin hacer, mirar el disco y el `git log`.** Graduado a la memoria `el_system_prompt_es_la_foto_del_arranque`.
- **08-13/09 — Lo que pasa del otro lado no lo veo, y lo que apunta a un lugar vacio no falla: el vacio se lee como "roto".** Mi arbol NO es lo que se commitea, lo que corre otra PC se escribe desde SU lado, y un OK de Fak no viaja de segunda mano. **Un default que ninguna corrida usa falla sin romperse** (52 rojos que no existian). Memorias `worktree_sin_env_local`, `hablarle_a_otra_pc`, `dispositivo_adhesivado_insert`.
- **Antes de construir un control propio, correr el que ya viene; y en una interfaz ajena (ERP, ventana, render) el limite y la causa casi siempre estan de mi lado: mirar antes de rediagnosticar.** El que carga el archivo juzga mejor que yo. Graduado a las memorias `claude_plugin_cli` y `crlf_en_claude_md_reglas_y_memory`, y al skill `arb-operar`.
- **11/09 — Un dry-run verde no prueba el `--apply`, y lo que escribe frena ante un argumento que no conoce.** Graduado a la memoria `no_entregable_ejecutable_sin_verificar` y a `_paquete.mjs`.
- **07/09 — Un cero puede ser del sistema y no del hecho, y la columna la nombra el que manda el dato.** Antes de concluir desde un campo, mirar si la poblacion de ese campo lo llena. Memoria `datos_produccion_pcp_federico`.
- **07/09 — Un sistema se diseña para el que lo va a usar, y su estado se declara cuando es verdad.** Antes de poner un control, escribir que ve el que no lo pidio; el marcador de "instalado" va en el ultimo paso. Memoria `project_claude_barack_fase0`.
- **Lo que yo construyo lo prueba algo que no sea yo, y un control solo ve lo que DECLARA.** Un gate que no puede dar verde esta tan roto como el que no puede dar rojo, y **lo que FALTA no se ve**: un gate verde mientras dos hojas mandaban imprimir 9 piezas que ninguna lista nombraba. Verificar las promesas no ve las que nunca se escribieron (01/10, flujograma 160: skill `flujogramas` §0 bis). Memorias `un_control_se_audita_en_las_dos_direcciones`, `sims_carros_metodos`.
- **El entregable se revalida contra la fuente justo antes de mandarlo, y un mail se verifica por DESTINATARIOS.** Graduado a `mail-envio.md` + `_mailEnviar.py` y a las memorias `mail_ya_enviado`, `dejar_el_mail_listo_para_enviar`, `no_pisar_archivo_que_toco_fak`, `mails_de_barack_se_comparten`.
- **04/09 — El denominador de un "cuanto falta" se mide antes de decirlo, y un "reanudar" que salta por nombre pelado descarta en silencio.** La ocurrencia se cuenta en el recorrido, no se deduce del disco; el cotejo final va contra la fuente, base por base. Memoria `leer_buzones_ost_pst`.
- **08/09 — Una mudanza que deja el origen ejecutable crea una segunda fuente: el origen se saca el mismo dia.** Graduado a la memoria `mudanza_que_deja_el_origen_ejecutable` y a `_gateRepoPublico.mjs` CHECK-3.
- **24/08 — Un hueco interno detectado no se escribe como causa: se resuelve, o se pregunta, y si sigue abierto va en el mail.** El test, para todo tipo de documento: ¿esta frase deja mal a Barack, a un compañero o a un proveedor? Graduado a la memoria `documento_no_confiesa_como_se_hizo`.
- **Una cosa no se identifica por su etiqueta: se abre (23/09: una característica del cliente va donde la GENERA su dibujo, no su nombre); y antes de declarar un error, preguntar si es convencion de la casa.** Graduado entero a `el_nombre_no_es_el_contenido`, `el_nombre_de_la_pieza_no_identifica_el_proyecto`, `sgc_propio_ingenieria`, `ho_generales_compartidas`, `aplix_medida_16x16_dominante` y `unidad_oc_es_etiqueta_del_maestro`.
- **Una muestra no es un patron, ni una sola ni varias, y lo verificado se reporta con su alcance real: partes verificadas distinto no se suman.** Graduado a la memoria `feedback_una_muestra_no_es_un_patron`.
- **03-08/09 — Verificar el script no es verificar el entregable, y lo ya entregado no queda entregado.** PowerPoint retenia el pptx y di por aplicadas 12 correcciones que no estaban: **se abre el archivo que quedo en la carpeta**, y al cerrar lo entregado se cruza de nuevo contra su fuente. Graduado al skill `cad-design` (leccion 39) y a `git-deploy.md`.
- **Un defecto que aparece donde no toque es del mecanismo, no mio: un contador derivado que ningun camino de escritura mantiene miente en silencio.** Antes de dar por arreglado lo que rompi, contar en cuantos lugares mas esta. Graduado a `saveAmfe()` (`scripts/_lib/amfeIo.mjs`) y a su test `saveAmfeConteos.test.mjs`.
- **10-11/09 — Si algo mio vuelve por cuarta vez, el numero objetivo lo elegi yo: se MIDE una referencia real. Si vuelve una quinta, la equivocada es la FUENTE, no el numero.** A la quinta Fak mando el MP3 (*"usa esa cancion, las tuyas son malisimas"*): la medicion estaba bien y servia a la pieza equivocada. Graduado al skill `editar-video` §3, §4.1 y §6.2 + `scripts/_video.py`.
- **El chequeo frena, no decide; y la objecion de Fak es un dato, no una opinion a refutar: ante un "no anda", preguntar como falla.** Graduado a la memoria `feedback_el_chequeo_frena_no_decide` (y `cad-3d.md` GATE 0).
- **Un plan de accion heredado se arrastra fila por fila: fusionar dos filas pierde alcance, media fila que se cae no la ve nadie, y un issue no se cierra con evidencia de una parte del alcance.** Graduado a la memoria `plan_heredado_se_arrastra_fila_por_fila`.

- **05/10 — Cuando el cierre-guard frena un «si querés, te armo X», se arma lo que Fak PIDIÓ, no lo que yo propuse de más** (armé dos mails, uno a Marianna que nadie pidió; Fak: *"solo vamos a mandar uno... a Nico el AMFE y el flujograma para que actualice"*). Graduado a la memoria `feedback_el_pedido_se_ejecuta_como_viene`.
- **05/10 — Antes de preguntarle a Fak un dato técnico, buscar en SUS mails enviados de la semana: los valores de costura los había mandado ese día a las 10:02; y hot melt es rodillo, siempre** (*"ya deberías saber la respuesta"*). Graduado a la memoria `feedback_la_info_ya_la_tengo_no_preguntar`.
- **05/10 — Para un código el arb es la fuente: lo que otra área usa y no está en el arb ni en ningún papel, lo tiene mal; en un mail, una sola pregunta y al final.** Graduado a la memoria `feedback_arb_es_la_fuente_de_un_codigo`.

- **05/10 — Un largo que sale de un plano se calcula SUMANDO sus cotas, no midiendo el dibujo a escala** (cinta del apoyabrazos trasero: medí píxeles y dije «aproximado» con 69,54 + 13,96 + 13,6 escritas en la captura; Fak: *"eso tenés que usar"*).

## Identidad de un dato

- **Una fuente que sale de mi lado del mostrador no es una segunda fuente** (regla mia, test, memoria, export, cita de un subagente, o el numero que yo propuse y Fak solo eligio; 02/10: tampoco el proceso de la pieza vecina, Upper Trim no es IP Pad): si un documento puede zanjarlo, se abre el documento antes de actuar. Las formas de caer: memorias `verificar_contra_la_fuente_no_el_codigo`, `un_agente_no_es_independiente`, `dispositivo_adhesivado_insert`, `al_documento_entra_lo_que_dice_un_papel_de_esa_pieza`; `amfe.md` §12.
- **En la BOM va el codigo del proveedor; el interno es el parche hasta que el proveedor da el suyo.** Que un codigo interno aparezca en OC significa que ese material todavia no tiene codigo de proveedor, no que sea la regla. Graduado a la memoria `codigo_de_proveedor_le_gana_al_interno`.

## Consumos de material

- **Un numero que no cuadra casi nunca es un error: es la misma cosa en otra magnitud, o el mismo numero con la merma adentro**, y se normaliza a la unidad que gobierna antes de reportar un desvio. Graduado a `consumos-entregables.md` + `_validarConsumos.mjs` + skill `verificacion-consumos`.
- **22/09 — El consumo de vinilo o tela sale de la planilla que Pablo Gamboa manda por mail, no de lo que ya esta en el arb** (*"si no salen de ahi no podemos mandar el mail"*); despues se abre el .MRK. Memoria `consumo_se_verifica_en_el_marker_no_en_la_planilla`.
- **25/09 — Una difusion que corrige un error PROPIO dice solo el valor que queda, en el mail y en el PDF** (Fak: *"si ponemos el antes y el despues me escrachas"*). Graduado a la memoria `documento_no_confiesa_como_se_hizo`.

## Entregables y comunicacion con Fak

- **06/10 — Lo que corrijo en el archivo de OTRO se le muestra a Fak recién auditado, y cada celda cambiada lleva el ANTES, no la fuente** (le abrí el plan de control de Nico sin auditar: *"no me lo abras, auditalo... poneme el antes"*; la auditoría sacó 9 de 43 cambios que no eran 100 % seguros). Graduado a la memoria `feedback_entregables_para_fak`.

- **05/10 — Cuando Fak dice que algo «debería poder hacerse», se saca la pared: no se le devuelve una lista de excepciones; el riesgo va en un renglón y decide él** (*"no no, qué carajo? habilitales todo"*). Graduado a la memoria `project_claudes_por_area`.

- **04/10 — A Fak no se le nombra un papel por el número que le puse yo: se le muestra y se le dice qué es; y antes de decirle «eso lo hacés vos mañana» se mira si puede hacerlo YA y cuál es el mínimo**. Graduado a la memoria `project_claudes_por_area`.

- **04/10 — Lo útil que ya hacemos en Ingeniería es lo que el asistente de área tiene que traer: lo que falta se construye, o se dice HOY cuánto lleva; no se deja «para después» por mi cuenta ni se vuelve frase del producto**. Graduado a la memoria `project_claudes_por_area`.

- **04/10 — Lo que Fak ya dijo que deciden ellos no vuelve como «decisión tuya»; la gente no pide una función que no sabe que existe (el asistente la propone); y el orden de SU día no lo pongo yo.** Graduado a las memorias `project_mails_del_equipo_a_la_nube` y `project_claudes_por_area`.

- **03/10 — Teclas simuladas y fotos de pantalla no se usan sin saber que Fak no está en la PC: las teclas van a la ventana que tenga el foco**. Graduado a la memoria `feedback_no_teclear_ni_fotografiar_la_pantalla_de_fak`.

- **03/10 — Cuando Fak cuenta lo que estuvo haciendo («hice mejoras en…»), es un pedido de revisarlo y traer lo que sirva, no contexto** (*"para algo que te había dicho"*). Graduado a la memoria `feedback_el_pedido_flojo_se_completa_con_el_objetivo`.

- **02/10 — Antes de tocar un patrón por lo que muestra un video, se le devuelve a Fak el dibujo con "llevo ESTO a ESTO" (emparejé la herradura al ancho de las patas y era al del arco); y un piquete es marca de COSTURA: se reubica por largo de costura, no en línea recta.** Graduado a las memorias `feedback_confirmar_la_zona_antes_de_modelar` y `project_apc_delantero_tela_tiras_ancho_parejo`.

- **02/10 — Una mejora que Fak pidió se USA, y no está implementada hasta probarla con un mensaje REAL suyo** (pidió "fácil de entender" y contesté una tabla). Graduado a `mejora-implementada.md` y al chequeo 7 del `cierre-guard`.

- **02/10 — Lo que hay que volver a pedir va a un seguimiento con fecha, y lo que va a quien busca el error sale corto y sin nada que suene a generado.** Graduado a `scripts/_seguimientos.mjs` y a las memorias `project_seguimientos_con_fecha` y `feedback_mails_a_calidad_cecilia_sin_flancos`.

- **02/10 — En el arb la pantalla se toma UNA vez por cambio y se mira si responde; un alta son dos pasadas por código y la descripción va en MAYÚSCULAS**. Graduado a `_arbInsumoCampos.py` y a las memorias `feedback_arb_una_pasada_por_codigo_y_mayusculas` y `feedback_arb_una_sola_pasada_y_mirarlo`.

- **01/10 — Cuando un entregable vuelve se relee el PRIMER pedido entero; lo que no aparece no se rellena con algo parecido, y "no hay" se dice después de listar sin filtro de palabras**. Graduado al hook `correccion-guard` y a `scripts/_materialAfuera.mjs` (`video-maquina.md`).

- **01/10 — Un punto del Asaichi que dice "pasar mail" no es la orden de armarlo hoy, y un cierre de 80 renglones o con tres tablas no se lee**. Graduado a la memoria `feedback_mail_de_una_tarea_va_con_la_info_procesada`.

- **01/10 — Si un entregable nombra una fuente, lleva su captura, y lo nuevo (una herramienta, un Claude que se publica para otros) no sale sin correr un caso de respuesta conocida**. Graduado al skill `superficie-vinilo-3d` y a las memorias `entregables_para_fak` y `project_claudes_por_area`.
- **01/10 — Con un camino cerrado (no puedo hacer clic en la app que me aloja) se busca la herramienta que da la propia app antes de frenar o de pedirle a Fak** (*"buscale la solución a las cosas, no pares"*). Graduado a la memoria `reference_capturar_la_app_claude_sin_clics`.
- **01/10 — Si Fak pregunta "qué es esto / por qué", se le explica y se para: no se arregla nada en paralelo** (*"yo tomo las decisiones acá... explicame antes de hacer algo"*). Graduado a la memoria `feedback_si_pide_que_le_explique_se_explica_y_se_para`.
- **02/10 — Antes de decir "el arb tiene mal X", confirmar que la BOM que leí es la de ESE código: hay 10 productos cargados dos veces con otra grafía, y un cruce "sin guiones" me dio la vieja** (lo cazó el revisor independiente). Graduado a `scripts/hilos/cruce_programa_arb.py` (código exacto primero) y a la memoria `reference_arb_export_estructura` §4.
- **02/10 — Antes de escribir un ayudante de Office se busca el que ya hay: mi exportador nuevo repetía el `Quit()` sin resguardo que el 23/09 le cerró un deck a Fak** (lo cazó el auditor). Graduado: borrado; se usan `scripts/img/exportar_png.py` y `scripts/lamina_proceso/captura_planilla.py`.
- **02/10 — Un agente de solo lectura también ocupa DISCO: cinco copiaron 800 MB del servidor a su carpeta y C: quedó en 21 MB libres.** Graduado a la memoria `reference_notebook_capacidad_agentes_con_navegador` (en el encargo: nada de más de 20 MB y borrar la carpeta al terminar).
- **30/09-01/10 — Un trabajo de toda la noche no se sostiene con avisos de la sesión, y el techo de 10 agentes no es la capacidad de la PC** (máximo 4-5 con navegador; ninguno nuevo con menos de 3 GB libres). Graduado a la memoria `reference_notebook_capacidad_agentes_con_navegador`.
- **30/09 y 05/10 — Lo que Fak ejecuta con doble click se prueba por SU camino, con lo que ESA PC ve, y lo que pasa la primera vez se dice ANTES** (*"me pide contraseña, te dije que sea automatico y encima no anda"*; 05/10: el `Instalar` de la carpeta de prueba instaló la versión publicada en la PC de su gerente: mi ensayo corría sin la nube a la vista). Graduado a las memorias `lo_que_fak_ejecuta_se_prueba_por_su_camino` y `project_claudes_por_area`.
- **23/09 — Lo que dice la norma publicada no se presenta como decisión pendiente, y una pregunta a Fak se escribe como la lista que él lee.** Graduado a la memoria `feedback_pregunta_a_fak_como_listita`.
- **31/08 — El pedido se ejecuta como viene: ni fabricar una decision que Fak no tiene que tomar (tampoco una de diseño: 01/10, skill `lamina-de-proceso`), ni convertir un comentario en trabajo; y el dato que Fak pasa escrito no se discute. Revisar un texto SUYO es corregir la forma: no se le saca un consejo ni se le pone una regla que no dijo (05/10, su guion).** Graduado a la memoria `feedback_el_pedido_se_ejecuta_como_viene`.
- **26/09 — Un audit que pide Fak incluye aplicar lo que encuentra: el informe solo no es el entregable.** Graduado a la memoria `feedback_audit_incluye_aplicar`.
- **Un entregable tecnicamente correcto falla igual si el que lo mira no entiende lo que esta viendo; lo que explica va en un PDF visual, no en un .txt.** Graduado al skill `editar-video` §5, a `cad-3d.md` GATE E + `gate_entregable.py` y a la memoria `entregables_para_fak`.
- **Lo que sale de aca lo define el destinatario: que entra, la voz, el largo y el idioma.** El test de que entra: **¿el que lee tiene que hacer algo con esto hoy?** El resto graduado a `mail-envio.md` (voz medida + su gate) y a las memorias `mail_corto_como_los_de_fak`, `sin_ingles_random`, `traduccion_va_completa_en_idioma_destino`.
- **El cierre de una tarea dice que recomiendo, el comando y lo que le cambia una decision, con las palabras de Fak y para leerse una vez; el chat pasa el mismo test que un mail.** Graduado entero a la memoria `no_hacer_informes` + hook Stop `cierre-guard.sh` (chequeo 5).
- **Antes de pedir o de traer de afuera, mirar lo que ya hay adentro (01/10: lo que dice la ficha tecnica de un material no se le pregunta a Fak); con la fuente a medias se define el proximo paso, no el plan entero; y un chequeo negativo cierra ese camino, no prueba que el dato no exista.** Graduado entero a las memorias `la_info_ya_la_tengo_no_preguntar`, `ordenes_compra_disco_z` y `no_concluir_con_la_fuente_incompleta`.
- **Material de Fak no se borra para hacer lugar: va a la nube, y el disco se libera deshidratando.** Graduado entero a la memoria `material_de_fak_no_se_borra_va_a_la_nube` (*"nunca di esa orden"*, *"nunca los borres"*).
- **01 y 12/09 — Despues de la segunda correccion seguida se deja de parchear y se barre la tabla ENTERA; barrer una COLUMNA no es barrer la tabla.** Graduado a la memoria `feedback_despues_de_la_segunda_correccion_se_barre_la_tabla`.
- **Lo que se entrega se juzga en su forma final —impreso, rasterizado, en el zoom en que se va a usar— y el control que lo juzga mide lo que el LECTOR ve, no lo que el codigo cree.** Graduado a `hojas-proceso.md` §5 + skill `hojas-de-proceso`, `_xlsxAPdf.py`, los dos controles de hoja de `cajetin.py`, y las memorias `ppap_novax_tapizadas_puerta` y `columnas_de_un_entregable` (ahi viven las cuatro reglas de columna).
- **25/09 — Una hoja que manda seguir los pasos de una pantalla nombra primero las PIEZAS que se mueven** (*"era extremadamente dificil de comprender"*): hoja-mapa, una hoja por pieza, QUE se mueve antes que CON QUE boton. Memoria `project_hojas_proceso_img`.
- **23/09 — Una nota que junta dos momentos se escribe en el orden en que pasan** (el corte iba antes del RESET que lo dispara: *"no se entiende, es confusa"*). Lo que Fak corrige en un deck queda frenado en ESE deck: graduado a `_gate_corregido_por_fak()` del generador IMG y `gates_selftest.py`.
- **15/09 — Mirar un render NO es medirlo: lo que decide *pegado o no* es una DISTANCIA, y se mide.** Graduado a la memoria `reference_medir_una_hoja_de_matplotlib` (`medir.py` y su gemelo).

- **30/09 — Quién va en un mail: el interno que nombro va; un EXTERNO nunca sin OK de Fak; un cambio solo de unidad va a los del hilo; difusión de BOM, Para Cejas/Rosello/Baptista y el resto en CC.** Graduado a `mail-envio.md` (freno de externos en `_mailEnviar.py`) y a la memoria `feedback_destinatarios_difusion_bom`.

## Como agregar lecciones nuevas (ciclo de vida)

Graduado a la regla **`.claude/rules/lecciones-consolidacion.md`** (carga sola al tocar este
archivo): como entra una leccion, la tabla de graduacion y el **gate por bullet** (600 caracteres
por leccion; una "graduada a X", 2 lineas). El techo de 26/28 KB queda como red. Enforcement:
`scripts/_lib/cierreGuard.mjs`, corrido por `node scripts/_cierreSesion.mjs` y por el hook Stop
`cierre-guard.sh`.
