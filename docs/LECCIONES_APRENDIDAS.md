# Lecciones Aprendidas — Barack Mercosul APQP (destilado vivo)

Archivo mantenido por Claude Code. Entra completo al system prompt (`@import` desde CLAUDE.md),
por eso contiene solo lo accionable que no esta ya codificado como regla o gate ejecutable. Cada
leccion es un bullet legible de hasta 600 caracteres; el detalle vive en la memoria o el snapshot
que cita (gate por bullet: regla `lecciones-consolidacion.md`). La historia completa de cada
incidente vive en los snapshots.

- **Snapshots** (la version larga de cada consolidacion): los tres ultimos son [2026-10-06](docs/_archive/LECCIONES_snapshot_2026-10-06.md) · [2026-10-07](docs/_archive/LECCIONES_snapshot_2026-10-07.md) · [2026-10-08](docs/_archive/LECCIONES_snapshot_2026-10-08.md) y el historico 2026-03-30 a 07-02, [2026H1](docs/_archive/LECCIONES_APRENDIDAS_2026H1_completo.md); los demas estan en `docs/_archive/`.
- **Tabla incidente → regla**: `docs/_archive/INCIDENTES_REGLAS_AMFE.md`
- Lo ya codificado no se repite aca: reglas de `.claude/rules/` y sus gates ejecutables
  (amfe.md + amfeValidator, database.md, verify-supabase-live.md, no-pfd-no-ho.md, techo-agentes.md, cad-3d.md).

## Verificacion y evidencia

- **09/10 — Un despertador que nunca se vio llegar no existe: se cuenta en el registro ANTES de confiarle una noche** (CronCreate: 0 mensajes en 16 sesiones; el 03/10 y el 08/10 la sesión se quedó quieta horas mientras el control decía «latido vivo»). Graduado a la cola (`COLA_CAMBIOS_CODIGO.md`: tarea programada de la app en vez de CronCreate) y a `trabajar-hasta-la-hora.md`.

- **09/10 — En una noche solo, el cupo de 5 h se mira CADA HORA y cerca del fin del contexto o del cupo no se lanzan agentes** (a las 23:40 iba 93 % con el control mirando cada 2 h; se cortó a las 23:55 con 2 h de pedido por delante; Fak: *"se cortan y consumimos tokens al pedo"*). Graduado a `trabajar-hasta-la-hora.md` punto 5 y al latido.

- **08/10 — Lo que cambia otro modelo (Gemini) en un documento se audita como contenido, no como ortografía**: al limpiar palabras renombró operaciones que tienen que coincidir con el AMFE (EDGE FOLDING → PLEGADO DE BORDES), dio vuelta un historial ("se eliminan rombos de scrap" pasó a "control de scrap") y armó el A3 desde lo commiteado, con el 160 viejo y la frase del IQC. Se compara cada texto contra la versión anterior y el AMFE antes de imprimir.

- **08/10 — Ningún documento dice que lo hizo Claude o una IA, y al tocar un documento ajeno se revisa ENTERO, no solo mis celdas** (el listado de HO decía "Claude" en CREADO POR desde junio y tenía una pestaña oculta «para el próximo Claude»; Fak: *"es un error gravísimo"*). Graduado a `core-prohibiciones.md` §9, `_sinFirmaIA.py`, `firma-ia-guard` y chequeo 9 del cierre-guard.

- **08/10 — Los créditos de API del plan Max NO cubren Claude Code: el modelo que se elija ahí no los gasta ni los ahorra; solo los gasta código que llama a la API con la clave de la organización vinculada** (un informe proponía «Opus por defecto para aprovechar los créditos»; la documentación oficial dice lo contrario). Los precios se leen de la tabla oficial, no de un informe: tenía mal Sonnet y las lecturas de caché. Regla `api-claude.md`.

- **07/10 — Antes de decir «no puedo leer el correo de X», se busca en la nube del equipo; no se afirma de memoria** (los mails de Carlos ya suben a la nube; Fak: *"si lo podés leer, está en la nube... ¿desde cuándo no recordás eso?"*). Graduado a `_mails.py --buscar` / `--buzones`, al chequeo 8 del cierre-guard y a la memoria `reference_acceso_mails_outlook`.

- **07/10 — «El estándar» se COMPARA contra una hoja real de la casa (la HO de Excel), no contra lo que dejó la sesión anterior**: con el plan de reacción deshice lo que hizo Gemini, lo volví a poner como él y seguía mal (blanco a la derecha, letra chica, otro texto). Fak: *"te lo dije 300 veces, no es el estándar que decidimos"*. Era el ARMADO: plan debajo de las fotos, ciclo de control al lado. Graduado al canon 4.5 y a `bloque_plan()`.

- **22/09-06/10 — Lo que construyo para otros, o lo que AFLOJA un control, lo prueba OTRO**: contra el viejo, a ciegas, con el corte escrito antes de medir y nunca contra la carpeta de verdad; y si Fak ya aceptó el riesgo, mi freno no le gana a su pedido (*"lo único que tenías que hacer era eso"*). Graduado a `un_control_se_audita_en_las_dos_direcciones` y `project_claudes_por_area`.
- **02/10 — De un flujograma o de un AMFE puede salir la PALABRA "reproceso", nunca su analisis (IATF 8.7.1.4; fue una no conformidad en 2019), y un AMFE escrito de cero se delata por el largo de sus frases** (12 palabras por causa contra 4 a 7; Calidad: "hecho con IA"). Graduado a la memoria `reference_iatf_retrabajo_8714_y_antecedentes_barack` y a `TOPE_PALABRAS` de `scripts/_lib/amfeAutoria.mjs`.
- **22/09 — Un cambio de criterio (o un número) se barre por su FRASE en todo el repo, y un guardián que falla sin bloquear está apagado.** Graduado al test 5c de `hooksTienenTest` (`${CLAUDE_PROJECT_DIR}`) y a `puerta.py` (puerta D).
- **22/09 — La VARA también se audita, y lo primero que se le mira es la FECHA**: la tabla AP y las escalas O/D salían de un borrador de 2017 del AIAG-VDA. La tabla AP ya es la oficial (23/09); las escalas, pendientes. Memoria `project_tabla_ap_de_la_casa_es_el_borrador_2017`.
- **22/09 — Un gate contesta lo que le preguntan: los obstáculos se listan del CONJUNTO, no del subconjunto, centrado y simetría también se miden, y un control que frena dice CUÁL renglón lo frena.** Graduado a `chequeo_centrado.py` y a la memoria `dispositivo_adhesivado_insert`.
- **21/09 — Antes de ejecutar un pedido que toca a un cliente, se abre el sistema del CLIENTE: ahi esta si el trabajo ya se hizo y por que esta trabado** (un 8D cerrado hacia semanas en KPM; un "agregale la norma" que era un PPAP rechazado en IMDS). Memorias `8d_11010843_tapa_amarok`, `project_imds_barack`.
- **10-13/09 — Una contradicción adentro del entregable es un ROJO, no una nota al pie; la frase que resume números la arma el CÓDIGO.** Graduado a la memoria `contradiccion_en_el_entregable_es_rojo`.
- **11/09 — El system prompt es la foto del arranque: antes de concluir que algo quedó sin hacer, mirar el disco y el `git log`.** Graduado a la memoria `el_system_prompt_es_la_foto_del_arranque`.
- **08-13/09 — Lo que pasa del otro lado no lo veo, y lo que apunta a un lugar vacio no falla: el vacio se lee como "roto".** Mi arbol NO es lo que se commitea, lo que corre otra PC se escribe desde SU lado, y un OK de Fak no viaja de segunda mano. **Un default que ninguna corrida usa falla sin romperse** (52 rojos que no existian). Memorias `worktree_sin_env_local`, `hablarle_a_otra_pc`, `dispositivo_adhesivado_insert`.
- **Antes de construir un control propio, correr el que ya viene; en una interfaz ajena el límite y la causa casi siempre están de mi lado; y con un camino cerrado se busca la herramienta de la propia app antes de frenar** (01/10: *"buscale la solución a las cosas, no pares"*). Graduado a `claude_plugin_cli`, `crlf_en_claude_md_reglas_y_memory`, `reference_capturar_la_app_claude_sin_clics` y al skill `arb-operar`.
- **11/09 — Un dry-run verde no prueba el `--apply`, y lo que escribe frena ante un argumento que no conoce.** Graduado a la memoria `no_entregable_ejecutable_sin_verificar` y a `_paquete.mjs`.
- **07/09 — Un cero puede ser del sistema y no del hecho, y la columna la nombra el que manda el dato.** Antes de concluir desde un campo, mirar si la poblacion de ese campo lo llena. Memoria `datos_produccion_pcp_federico`.
- **07/09 — Un sistema se diseña para el que lo va a usar, y su estado se declara cuando es verdad.** Antes de poner un control, escribir que ve el que no lo pidio; el marcador de "instalado" va en el ultimo paso. Memoria `project_claude_barack_fase0`.
- **Lo que yo construyo lo prueba algo que no sea yo, y un control solo ve lo que DECLARA.** Un gate que no puede dar verde está tan roto como el que no puede dar rojo, y **lo que FALTA no se ve** (un gate verde mientras dos hojas mandaban imprimir 9 piezas que ninguna lista nombraba; 01/10, flujograma 160: skill `flujogramas` §0 bis). Memorias `un_control_se_audita_en_las_dos_direcciones`, `sims_carros_metodos`.
- **El entregable se revalida contra la fuente justo antes de mandarlo, y un mail se verifica por DESTINATARIOS.** Graduado a `mail-envio.md` + `_mailEnviar.py` y a las memorias `mail_ya_enviado`, `dejar_el_mail_listo_para_enviar`, `no_pisar_archivo_que_toco_fak`, `mails_de_barack_se_comparten`.
- **04/09 — El denominador de un "cuanto falta" se mide antes de decirlo, y un "reanudar" que salta por nombre pelado descarta en silencio.** La ocurrencia se cuenta en el recorrido, no se deduce del disco; el cotejo final va contra la fuente, base por base. Memoria `leer_buzones_ost_pst`.
- **24/08 — Un hueco interno detectado no se escribe como causa: se resuelve, o se pregunta, y si sigue abierto va en el mail.** El test, para todo tipo de documento: ¿esta frase deja mal a Barack, a un compañero o a un proveedor? Graduado a la memoria `documento_no_confiesa_como_se_hizo`.
- **Una cosa no se identifica por su etiqueta: se abre (23/09: una característica del cliente va donde la GENERA su dibujo, no su nombre); y antes de declarar un error, preguntar si es convencion de la casa.** Graduado entero a `el_nombre_no_es_el_contenido`, `el_nombre_de_la_pieza_no_identifica_el_proyecto`, `sgc_propio_ingenieria`, `ho_generales_compartidas`, `aplix_medida_16x16_dominante` y `unidad_oc_es_etiqueta_del_maestro`.
- **Una muestra no es un patron, ni una sola ni varias, y lo verificado se reporta con su alcance real: partes verificadas distinto no se suman.** Graduado a la memoria `feedback_una_muestra_no_es_un_patron`.
- **03-08/09 — Verificar el script no es verificar el entregable, y lo ya entregado no queda entregado.** PowerPoint retenia el pptx y di por aplicadas 12 correcciones que no estaban: **se abre el archivo que quedo en la carpeta**, y al cerrar lo entregado se cruza de nuevo contra su fuente. Graduado al skill `cad-design` (leccion 39) y a `git-deploy.md`.
- **Un defecto que aparece donde no toque es del mecanismo, no mio: un contador derivado que ningun camino de escritura mantiene miente en silencio.** Antes de dar por arreglado lo que rompi, contar en cuantos lugares mas esta. Graduado a `saveAmfe()` (`scripts/_lib/amfeIo.mjs`) y a su test `saveAmfeConteos.test.mjs`.
- **10-11/09 — Si algo mio vuelve por cuarta vez, el numero objetivo lo elegi yo: se MIDE una referencia real. Si vuelve una quinta, la equivocada es la FUENTE, no el numero.** A la quinta Fak mando el MP3 (*"usa esa cancion, las tuyas son malisimas"*): la medicion estaba bien y servia a la pieza equivocada. Graduado al skill `editar-video` §3, §4.1 y §6.2 + `scripts/_video.py`.
- **El chequeo frena, no decide; y la objecion de Fak es un dato, no una opinion a refutar: ante un "no anda", preguntar como falla.** Graduado a la memoria `feedback_el_chequeo_frena_no_decide` (y `cad-3d.md` GATE 0).
- **Un plan de accion heredado se arrastra fila por fila: fusionar dos filas pierde alcance, media fila que se cae no la ve nadie, y un issue no se cierra con evidencia de una parte del alcance.** Graduado a la memoria `plan_heredado_se_arrastra_fila_por_fila`.

- **07/10 — Un mail que Fak pide «con lo que encuentres» lleva UNA pregunta y lo mínimo para entenderla, no el informe del agente pegado** (al de Pablo sobre 9465/9466 le metí arb, hilo, tela y las hojas cortadas: 611 caracteres, dos temas; Fak: *"es una remada, ni se entiende... olvidate"*). Lo junta el agente; el mail lo recorta uno antes de abrirlo.

- **02 y 05/10 — Para un código el arb es la fuente (lo que otra área usa y no está en el arb ni en un papel, lo tiene mal), pero antes de decir «el arb tiene mal X» se confirma que la BOM leída es la de ESE código: hay 10 productos cargados dos veces con otra grafía.** Graduado a `feedback_arb_es_la_fuente_de_un_codigo`, `reference_arb_export_estructura` §4 y `scripts/hilos/cruce_programa_arb.py`.

- **05/10 — Un largo que sale de un plano se calcula SUMANDO sus cotas, no midiendo el dibujo a escala** (cinta del apoyabrazos trasero: medí píxeles y dije «aproximado» con 69,54 + 13,96 + 13,6 escritas en la captura; Fak: *"eso tenés que usar"*).

## Identidad de un dato

- **Una fuente que sale de mi lado del mostrador no es una segunda fuente** (regla mía, test, memoria, export, cita de un subagente, el número que yo propuse, el proceso de la pieza vecina): si un documento puede zanjarlo, se abre antes de actuar. Graduado a `amfe.md` §12 y a las memorias `verificar_contra_la_fuente_no_el_codigo`, `un_agente_no_es_independiente`, `al_documento_entra_lo_que_dice_un_papel_de_esa_pieza`.
- **En la BOM va el codigo del proveedor; el interno es el parche hasta que el proveedor da el suyo.** Que un codigo interno aparezca en OC significa que ese material todavia no tiene codigo de proveedor, no que sea la regla. Graduado a la memoria `codigo_de_proveedor_le_gana_al_interno`.

## Consumos de material

- **Un numero que no cuadra casi nunca es un error: es la misma cosa en otra magnitud, o el mismo numero con la merma adentro**, y se normaliza a la unidad que gobierna antes de reportar un desvio. Graduado a `consumos-entregables.md` + `_validarConsumos.mjs` + skill `verificacion-consumos`.
- **22/09 y 06/10 — El consumo de vinilo o tela sale de la planilla oficial o del mail de Pablo Gamboa; una tizada (.MRK) sola puede ser una prueba y ante la duda se le pregunta a él** (06/10: el Upper Trim lo cargué con una cuenta mía; Fak: *"¿desde cuándo vos proponés?"*). Se dice «patrón», no «molde». Graduado a `consumos-entregables.md` §6 (freno 4 de `respaldoCarga.py`) y a la memoria `consumo_se_verifica_en_el_marker_no_en_la_planilla`.
- **08/10 — Un consumo del arb se rastrea en los mails con su RESPUESTA (el 0,08 del Sika era un mail que Carlos anuló) y una cuenta mía no se dice como dato.** Memoria `project_sika_toproll_codigo_y_consumo`.
- **25/09 — Una difusion que corrige un error PROPIO dice solo el valor que queda, en el mail y en el PDF** (Fak: *"si ponemos el antes y el despues me escrachas"*). Graduado a la memoria `documento_no_confiesa_como_se_hizo`.

## Entregables y comunicacion con Fak

- **09/10 — El alcance de un reclamo lo marca DÓNDE va el material del reclamo, no la frase amplia del pedido** («todas las telas de PWA»): le metí las telas de serie, que no llevan el fieltro de 1000 g/m², antes de mirar en qué piezas entra. Fak: *"¿lo que pidió no es solo de proyecto?"*. Primero se ubica el material en las BOM/AMFE, después se arma la lista de documentos.

- **09/10 — Una hoja de preguntas para una reunión se arma DESPUÉS de buscar en el servidor qué ya contesta un papel, y se escribe para mostrarse a los otros** (la primera traía «¿cuánto dura la mezcla?» con la ficha del GV diciendo 4 a 8 h; Fak: *"preguntaste muchas cosas que ya sabemos... que no parezca IA, la muestro en la reunión"*): fondo blanco, palabras que entienda alguien recién salido del secundario, la captura del papel al lado de cada dato, y el dato del agente se mira en el recorte (el «pegamento acrílico» era de otra pieza del plano). Buscar va en Haiku.

- **09/10 — Fak SUGIERE y yo decido con evidencia; no le devuelvo su lista textual** («lo que me pediste y dónde quedó cada cosa» le molestó: *"deja de tomar literal todo lo que pido... no quiero parches, quiero decisiones en base a investigaciones"*), **y el código es sagrado: el tamaño del cambio decide el camino**. Graduado a `codigo-madre.md` y a `docs/COLA_CAMBIOS_CODIGO.md`.

- **08/10 — Cuando Fak delega «decidí todo vos», sus números y reglas anteriores son DATOS a revisar, no límites** (mantuve su techo de 10 agentes «solo Sonnet»; Fak: *"la caja soy yo... eficiencia es trabajar de la mejor forma, no ahorrar tokens"*). Graduado a `techo-agentes.md` (presupuesto por costo) y a la memoria `feedback_la_caja_soy_yo_pensar_fuera_de_lo_que_dijo_fak`.

- **08/10 — Mi Claude para OTRA persona va filtrado y con SU identidad** (a Carlos la memoria cruda le dejó "el usuario es Facundo"); y una pregunta de Fak no es una orden de diseño. Graduado a `validarTexto()` de `tools/claude-area/persona/armar.mjs` y a `project_claude_para_pedro`.

- **08/10 — «Un instalador idéntico al de Carlos pero para mí» era SU asistente entero, no el de mails: ante un pedido con dos lecturas se arma lo principal y lo accesorio («de paso, los mails») va después** (Fak: *"le pedí que me pase mi Claude entero... hiciste cagada"*). Lo que Fak va a usar se deja en UNA carpeta con doble clic numerados. Memoria `project_instalar_mi_asistente_pc_nueva`.

- **08/10 — Lo que escribo en un entregable lo tiene que poder defender Fak: si un operario o un gerente no lo entiende, no va** (en la revisión del flujograma 153 escribí «RESTITUCION DE CONTROL DE MATERIA PRIMA (IQC) CON CUARENTENA»; Fak: *"no se entiende un carajo... jamás podés poner algo que yo no pueda defender"*). Y un flujograma para imprimir se juzga por si se entiende el FLUJO, no solo por la letra: el A3 de una hoja llegó a 8 pt con todo pegado (*"demasiado junto"*).

- **07-08/10 — Toma de tiempos por video = TIEMPOS + VIDEO RECORTADO adentro del PowerPoint, sin planilla** (*"no me pidieron planilla"*); del celular, solo lo que Fak nombra. El rato en que el operario prueba cómo poner una pieza nueva no es proceso (*"desde que realmente se pone a laburar"*). Un link a la nube se le pide a OneDrive, no se arma: el mío no abría. Memorias `project_tiempos_forrado_ductos_patagonia`, `reference_link_nube_se_pide_a_onedrive`.

- **07/10 — Con Fak se habla en castellano también en los avisos cortos mientras trabajo** (una tanda entera de avisos y el cierre me salieron en inglés: *"dejá de hablar en inglés"*). Y un pedido de videos para alguien que tiene editor es de ORIGINALES completos: preguntar o deducir el uso antes de editar (*"él quería videos completos... tiene una editorial de videos"*).

- **06/10 — Un archivo que Fak nombra y no aparece con ese nombre no se cambia por el parecido sin mostrárselo («tomé este, de esta ruta, ¿es?» va ANTES de trabajar encima), y lo que se entrega tiene el tamaño del pedido** (pidió los tiempos de costura de hoy: cargué un libro de 12 hojas, le sumé una hoja con formato mío y recién al tercer reclamo quedó en dos hojas con cuatro filas: *"solo estos tiempos tienen que estar en el excel"*).

- **06/10 — Una pregunta directa de Fak que llega mientras trabajo se contesta en el mensaje siguiente, antes de seguir** («¿puedo desconectar el celular ya?» esperó varias tandas mías con los videos ya copiados y verificados). Graduado a la memoria `reference_capacidades_de_proceso_y_toma_de_tiempos_por_video` (paso 1).

- **06/10 — Lo que corrijo en el archivo de OTRO se le muestra a Fak recién auditado, cada celda con su ANTES, y volver atrás un cambio no puede dejar un dato que se sabe falso** (el plan de control de Nico: *"no me lo abras, auditalo... poneme el antes"*; el hilo que *"no existe más... es grave"*). Graduado a la memoria `feedback_entregables_para_fak`.

- **06/10 — En el entregable va lo que contesta la pregunta; lo que no pude hacer se dice, no se reemplaza por algo parecido con el título de lo pedido** (apoyacabezas delantero: a «¿cosen las piezas del plano?» le sumé el 3D pintado como «cómo quedaría armada» y una hoja de fuentes; Fak: *"al pedo hiciste eso, no muestres info de más"*, sacó las dos). Graduado a la memoria `feedback_responder_el_scope_exacto`.

- **06/10 — Si Fak marca UN defecto de un documento se corrige eso con el criterio escrito y se le muestra, sin menú de qué más tocar; y el freno que armé para eso PAUSA la pregunta, no ordena hacer** (*"no deberías hacerme tantas preguntas, deberías saber qué hacer"*). Graduado al skill `flujogramas` §1.5, a `preguntaGuard.mjs` y a `feedback_con_recomendacion_no_se_pregunta`.

- **06/10 — Antes de acortar un documento ya emitido se busca POR QUÉ era largo: el flujograma del IP Pad tenía un nodo por pestaña porque en julio la carga en BeOn se frenó por la numeración contra la HO-985, y lo emití corto sin decírselo a Fak** (lo cazó el auditor). Graduado al skill `flujogramas` §1.5.

- **04-06/10 — El asistente de área se diseña para RESOLVER: un freno que contesta «no puedo» o «hacelo vos» es error mío** (*"se nos fue de la mano"*); lo que deciden ellos no vuelve como «decisión tuya», y a Fak un papel se le muestra, no se le nombra por mi número. Graduado a `project_claudes_por_area` y `tools/claude-area/vigia.mjs`.

- **03/10 — Teclas simuladas y fotos de pantalla no se usan sin saber que Fak no está en la PC: las teclas van a la ventana que tenga el foco**. Graduado a la memoria `feedback_no_teclear_ni_fotografiar_la_pantalla_de_fak`.

- **03/10 — Cuando Fak cuenta lo que estuvo haciendo («hice mejoras en…»), es un pedido de revisarlo y traer lo que sirva, no contexto** (*"para algo que te había dicho"*). Graduado a la memoria `feedback_el_pedido_flojo_se_completa_con_el_objetivo`.

- **02/10 — Antes de tocar un patrón por lo que muestra un video, se le devuelve a Fak el dibujo con "llevo ESTO a ESTO" (emparejé la herradura al ancho de las patas y era al del arco); y un piquete es marca de COSTURA: se reubica por largo de costura, no en línea recta.** Graduado a las memorias `feedback_confirmar_la_zona_antes_de_modelar` y `project_apc_delantero_tela_tiras_ancho_parejo`.

- **02/10 — Lo que hay que volver a pedir va a un seguimiento con fecha, y lo que va a quien busca el error sale corto y sin nada que suene a generado.** Graduado a `scripts/_seguimientos.mjs` y a las memorias `project_seguimientos_con_fecha` y `feedback_mails_a_calidad_cecilia_sin_flancos`.

- **01/10 — Cuando un entregable vuelve se relee el PRIMER pedido entero; lo que no aparece no se rellena con algo parecido, y "no hay" se dice después de listar sin filtro de palabras**. Graduado al hook `correccion-guard` y a `scripts/_materialAfuera.mjs` (`video-maquina.md`).

- **01 y 06/10 — Si Fak pregunta "qué es esto / por qué", se le explica y se para (*"yo tomo las decisiones acá"*); pero si la pregunta ya trae el criterio («¿no debería ser esa la filosofía?»), ya decidió: se hace, sin pedirle un «sí»** (*"¿esperás mi sí para hacer las cosas bien?"*). Graduado a la memoria `feedback_si_pide_que_le_explique_se_explica_y_se_para`.
- **30/09-02/10 — El techo de 10 agentes no es la capacidad de la PC** (4-5 con navegador, ninguno nuevo con menos de 3 GB libres, y en el encargo nada de más de 20 MB: cinco de solo lectura dejaron C: en 21 MB), y un trabajo de toda la noche no se sostiene con avisos de la sesión. Graduado a `reference_notebook_capacidad_agentes_con_navegador`.
- **30/09 y 05/10 — Lo que Fak ejecuta con doble click se prueba por SU camino, con lo que ESA PC ve, y lo que pasa la primera vez se dice ANTES** (*"me pide contraseña, te dije que sea automático"*; el `Instalar` de prueba instaló la versión publicada en la PC de su gerente). Graduado a `lo_que_fak_ejecuta_se_prueba_por_su_camino` y `project_claudes_por_area`.
- **23/09 — Lo que dice la norma publicada no se presenta como decisión pendiente, y una pregunta a Fak se escribe como la lista que él lee.** Graduado a la memoria `feedback_pregunta_a_fak_como_listita`.
- **31/08 — El pedido se ejecuta como viene: ni fabricar una decisión que Fak no tiene que tomar (tampoco de diseño), ni convertir un comentario en trabajo; el dato que pasa escrito no se discute, revisar un texto SUYO es corregir la forma, y si el cierre-guard frena un «si querés te armo X» se arma lo que PIDIÓ.** Graduado a la memoria `feedback_el_pedido_se_ejecuta_como_viene`.
- **26/09 — Un audit que pide Fak incluye aplicar lo que encuentra: el informe solo no es el entregable.** Graduado a la memoria `feedback_audit_incluye_aplicar`.
- **Un entregable tecnicamente correcto falla igual si el que lo mira no entiende lo que esta viendo; lo que explica va en un PDF visual, no en un .txt; si nombra una fuente, lleva su captura, y lo nuevo no sale sin un caso de respuesta conocida (01/10).** Graduado al skill `editar-video` §5, a `cad-3d.md` GATE E + `gate_entregable.py` y a la memoria `entregables_para_fak`.
- **Lo que sale de aca lo define el destinatario: que entra, la voz, el largo y el idioma.** El test de que entra: **¿el que lee tiene que hacer algo con esto hoy?** El resto graduado a `mail-envio.md` (voz medida + su gate) y a las memorias `mail_corto_como_los_de_fak`, `sin_ingles_random`, `traduccion_va_completa_en_idioma_destino`.
- **El cierre de una tarea dice que recomiendo, el comando y lo que le cambia una decision, con las palabras de Fak y para leerse una vez; el chat pasa el mismo test que un mail, y un «pasar mail» del Asaichi no es la orden de armarlo hoy (01/10).** Graduado a `no_hacer_informes`, `feedback_mail_de_una_tarea_va_con_la_info_procesada` y al hook Stop `cierre-guard.sh` (chequeo 5).
- **Antes de pedir o de traer de afuera, mirar lo que ya hay adentro (01/10: la ficha tecnica; 05/10: SUS mails enviados de la semana, *"ya deberías saber la respuesta"*); con la fuente a medias se define el proximo paso, no el plan entero; y un chequeo negativo cierra ese camino, no prueba que el dato no exista.** Graduado entero a las memorias `la_info_ya_la_tengo_no_preguntar`, `ordenes_compra_disco_z` y `no_concluir_con_la_fuente_incompleta`.
- **Material de Fak no se borra para hacer lugar: va a la nube, y el disco se libera deshidratando.** Graduado entero a la memoria `material_de_fak_no_se_borra_va_a_la_nube` (*"nunca di esa orden"*, *"nunca los borres"*).
- **01 y 12/09 — Despues de la segunda correccion seguida se deja de parchear y se barre la tabla ENTERA; barrer una COLUMNA no es barrer la tabla.** Graduado a la memoria `feedback_despues_de_la_segunda_correccion_se_barre_la_tabla`.
- **Lo que se entrega se juzga en su forma final —impreso, rasterizado, en el zoom en que se va a usar— y el control que lo juzga mide lo que el LECTOR ve, no lo que el codigo cree.** Graduado a `hojas-proceso.md` §5 + skill `hojas-de-proceso`, `_xlsxAPdf.py`, los dos controles de hoja de `cajetin.py`, y las memorias `ppap_novax_tapizadas_puerta` y `columnas_de_un_entregable` (ahi viven las cuatro reglas de columna).
- **25/09 — Una hoja que manda seguir los pasos de una pantalla nombra primero las PIEZAS que se mueven** (*"era extremadamente dificil de comprender"*): hoja-mapa, una hoja por pieza, QUE se mueve antes que CON QUE boton. Memoria `project_hojas_proceso_img`.
- **15/09 — Mirar un render NO es medirlo: lo que decide *pegado o no* es una DISTANCIA, y se mide.** Graduado a la memoria `reference_medir_una_hoja_de_matplotlib` (`medir.py` y su gemelo).

## Como agregar lecciones nuevas (ciclo de vida)

Graduado a la regla **`.claude/rules/lecciones-consolidacion.md`** (carga sola al tocar este
archivo): como entra una leccion, la tabla de graduacion y el **gate por bullet** (600 caracteres
por leccion; una "graduada a X", 2 lineas). El techo de 26/28 KB queda como red. Enforcement:
`scripts/_lib/cierreGuard.mjs`, corrido por `node scripts/_cierreSesion.mjs` y por el hook Stop
`cierre-guard.sh`.
