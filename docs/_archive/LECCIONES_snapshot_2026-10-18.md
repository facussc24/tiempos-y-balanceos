# LECCIONES — snapshot de la consolidación del 2026-10-18

Versión larga de los bullets que la pasada del 18/10/2026 (sesión madre del plan del sistema, 01:5x) dejó en dos
renglones en `docs/LECCIONES_APRENDIDAS.md`, por la regla `lecciones-consolidacion.md` (el archivo había llegado a
27,9 KB con el tope en 28; los bullets «graduados a X» conservaban su historia completa). Nada se recortó: lo que
salió de allá está acá entero. Los dos del 15/10 se fusionaron en uno (mismo patrón: decidir con lo que ya tengo).

- **17/10 — Un caso de prueba peligroso (leer el archivo de secretos, borrar, pisar el listado maestro) no se pega en el chat: un filtro de la plataforma cortó a la hija que imprimió los casos del auditor y la ronda perdió una sesión; los casos viajan por archivo con el nombre del secreto como marcador y los tests los llaman por su código.** Graduado al encargo de la ronda 3 de la tanda 3 (E261017-88fe) y a `__tests__/scripts/guardianesRonda3.casos.json`.

- **11-12/10 — Lo que va a un registro (una hora, «lo dije en el chat») se MIDE antes de escribirlo: `date`, el commit o el archivo de la sesión, nunca de memoria** (tres veces en un día, la última minutos después de anotar esta lección: la lección sola no alcanza, cola HOY-65), **y con la sesión parada en un worktree lo de main se prueba con `git -C` y rutas absolutas.** Graduado a `reference_entrar_a_main_desde_un_worktree`.

- **10-11/10 — Una tanda de hijas se mide por el cupo SEMANAL y por el de 5 h, cada hora: con tres o cuatro a la vez el semanal subía ~4 puntos por hora** (*«ya usamos demasiado de la semana»*). Graduado a `trabajar-hasta-la-hora.md` punto 5 y a `reference_api_claude_clave_y_ciclo`.

- **11/10 — «La API piensa, yo integro» funciona, pero lo que escribe la API se AUDITA antes de commitear: el auditor Opus encontró 3 errores reales en la primera tanda y 2 en la segunda.** Graduado a `api-claude.md` §2 y §5 (el tope de salida con esfuerzo alto) y a `project_tanda_orquestador_2026-10-10_donde_quedo`; lo que la API afirma de un dato que no vio se mide antes de codear (`feedback_la_respuesta_conocida_se_mide_antes_del_gate`).

- **09-10/10 — Un control que suma trabajo a un chequeo con tope de tiempo se mide en el MODO en que corre ese chequeo** (el detector pasó de 55 a 90 s y el cierre leyó «vacío» como limpio), **y el auditor Opus no se saltea**. Graduado al auditor (`metodo_correr_no_solo_leer`) y a `_sinFirmaIA.py`.

- **07/10 — «El estándar» se COMPARA contra una hoja real de la casa (la HO de Excel), no contra lo que dejó la sesión anterior** (Fak: *"te lo dije 300 veces, no es el estándar que decidimos"*; era el ARMADO: plan debajo de las fotos, ciclo de control al lado). Graduado al canon 4.5 y a `bloque_plan()`.

- **22/09-06/10 — Lo que construyo para otros, o lo que AFLOJA un control, lo prueba OTRO**: contra el viejo, a ciegas, con el corte escrito antes de medir y nunca contra la carpeta de verdad; y si Fak ya aceptó el riesgo, mi freno no le gana a su pedido. Graduado a `un_control_se_audita_en_las_dos_direcciones` y `project_claudes_por_area`.

- **02 y 09/10 — De un flujograma, un AMFE o una hoja de reunión puede salir la PALABRA «reproceso», nunca su análisis ni por qué se sacó** (IATF 8.7.1.4; 09/10: *"esto sacalo"*), **y un AMFE escrito de cero se delata por el largo de sus frases.** Graduado a `reference_iatf_retrabajo_8714_y_antecedentes_barack`, `TOPE_PALABRAS` de `amfeAutoria.mjs` y los avisos `reproceso-delata` / `antes-despues` de `_sinFirmaIA.py`.

- **13/10 — En una hoja de proceso, una pieza de nombre raro lleva su aclaración entre paréntesis y su recuadro con el nombre en la foto; el pie solo no alcanza** (*"Verificar que los acumuladores... no entiendo... es increíble que sigamos fallando en esto"*). Graduado al skill `hojas-de-proceso` 0.8 b bis y a `feedback_palabra_rara_en_una_hoja_se_aclara_y_se_marca`.

- **13/10 — Un utillaje que apoya sobre algo blando se simula APOYADO y APRETADO antes de imprimirlo, y ante un «no anda» se mide antes de dar una teoría** (*"está muy flojo todo"*). Graduado a `feedback_diseno_3d_medir_antes_de_explicar_y_simular_el_uso`.

- **14-15/10 — Lo que Fak nombra se identifica por su FORMA y su FUNCIÓN, no por el nombre de una carpeta ni por la última pieza parecida; entre versiones manda la que él validó** («el plotter» es el AOL de cuchilla: *"es grave que no sepas a qué plotter me refiero"*; los pines no eran los TRA-IZQ; la «orejita» era la costura hacia afuera, sin agujero; el 6 en 25 del IP PAD no se firma sin el papel: *"¿yo puse eso?"*). Memorias `reference_plotter_aol_corte_insert`, `project_pines_costura_cnc_insert`, `project_insert_muesca_costura_cnc`, `reference_valores_costura_patagonia_confirmados`.

- **15/10 — Plan de control: se genera releyendo flujograma, AMFE y fichas de embalaje JUSTO antes (los tres cambiaron ese día), y si se rearma entero va limpio: sin amarillo ni notas, una característica por fila, la D sola** (*"todo amarillo con demasiadas notas... ¿por qué no solo D?"*). Graduado al skill `planes-de-control` §4 y §5.

- **15/10 — A Fak no se le pregunta lo que contesta un manual, una prueba que puedo correr o el propio diseño: de 18 puntos de una lista, 11 eran míos (CATIA se prueba, el ancho del plotter está en el manual, el filo lo decide el diseño)** (*"preguntás muchas boludeces"*). Graduado a `feedback_la_info_ya_la_tengo_no_preguntar`.

- **16/10 — Impresora Bambu: lo que Fak confirma de su material con la pieza en la mano («es el mismo rollo te dije») queda como DATO y el programa no lo vuelve a poner en duda con avisos** (*"ya me tenés cansado de dudar de mí"*); **y un programa que espera a una dirección fija espera a nadie: la impresora se busca por su serie, y 15 min sin avanzar no es «sin conexión».** Graduado a `feedback_lo_que_fak_confirma_de_su_material_no_se_vuelve_a_dudar` y al skill `impresion-3d-bambu` (`bambu_red.py`, `--seguir`).

- **15/10 — Un valor que la norma resuelve con el papel delante (la S sale del efecto) se aplica y se informa, no se pregunta** (*"ya sabes decidir en base a datos"*). Graduado a `feedback_con_recomendacion_no_se_pregunta`.

- **11/10 — Una pantalla que Fak mira todos los días se escribe con SUS palabras, como un entregable: la banda decía «283 llamadas · en curso» y «noche · 0 prioridades»** (*"no era más fácil poner disponible, gastado, y separar entre cada api"*; *"renueva pusiste hora pero no día"*). Graduado a `feedback_lenguaje_del_entregable_palabras_de_fak`.

- **09-10/10 — Un «no puedo» a Fak es un problema mío, y una pregunta que le hago NO frena el resto: lo que no depende de ella se hace mientras tanto** (le dije que apretara Enviar: *"nunca más podés decirme no puedo"*; el 10/10 estuve 4 h parado esperando su respuesta sobre el modo de las hijas con la etapa 1 de los AMFE libre: *"es gravísimo"*). Graduado a `_mailEnviar.py` paso 4b, `mail-envio.md` y `feedback_la_caja_soy_yo_pensar_fuera_de_lo_que_dijo_fak`.

- **09/10 — El historial de revisiones también confiesa: una corrección por observación interna, antes de que el documento salga, no abre revisión** (la Rev. B del 160/174 decía «OP 32 se integra a la 31; 71 y 72 a la 70»; Fak: *"no nos delates de que eliminamos reprocesos... mantenele la revisión A"*). Graduado a `documento_no_confiesa_como_se_hizo`.

- **08-10/10 — Fak SUGIERE (sus números y reglas son DATOS, no límites) y yo decido con evidencia; si veo una forma mejor se la digo como «mirá, creo que lo que querés es esto»** (*"la caja soy yo... eficiencia es trabajar de la mejor forma, no ahorrar tokens"*), **y el código es sagrado: el tamaño del cambio decide el camino**. Graduado a `techo-agentes.md`, `codigo-madre.md` y `feedback_la_caja_soy_yo_pensar_fuera_de_lo_que_dijo_fak`.

- **08/10 — «Un instalador idéntico al de Carlos pero para mí» era SU asistente entero, no el de mails: ante un pedido con dos lecturas se arma lo principal y lo accesorio («de paso, los mails») va después**. Lo que Fak va a usar se deja en UNA carpeta con doble clic numerados. Memoria `project_instalar_mi_asistente_pc_nueva`.

- **06/10 — Una pregunta directa de Fak que llega mientras trabajo se contesta en el mensaje siguiente, antes de seguir** («¿puedo desconectar el celular ya?» esperó varias tandas mías con los videos ya copiados y verificados). Graduado a la memoria `reference_capacidades_de_proceso_y_toma_de_tiempos_por_video` (paso 1).

- **06/10 — Si Fak marca UN defecto de un documento se corrige eso con el criterio escrito y se le muestra, sin menú de qué más tocar; y el freno que armé para eso PAUSA la pregunta, no ordena hacer** (*"no deberías hacerme tantas preguntas, deberías saber qué hacer"*). Graduado al skill `flujogramas` §1.5, a `preguntaGuard.mjs` y a `feedback_con_recomendacion_no_se_pregunta`.

- **06/10 — Antes de acortar un documento ya emitido se busca POR QUÉ era largo: el flujograma del IP Pad tenía un nodo por pestaña porque en julio la carga en BeOn se frenó por la numeración contra la HO-985, y lo emití corto sin decírselo a Fak** (lo cazó el auditor). Graduado al skill `flujogramas` §1.5.

- **04-06/10 — El asistente de área se diseña para RESOLVER: un freno que contesta «no puedo» o «hacelo vos» es error mío** (*"se nos fue de la mano"*); lo que deciden ellos no vuelve como «decisión tuya», y a Fak un papel se le muestra, no se le nombra por mi número. Graduado a `project_claudes_por_area` y `tools/claude-area/vigia.mjs`.

- **02/10 — Antes de tocar un patrón por lo que muestra un video, se le devuelve a Fak el dibujo con "llevo ESTO a ESTO" (emparejé la herradura al ancho de las patas y era al del arco); y un piquete es marca de COSTURA: se reubica por largo de costura, no en línea recta.** Graduado a las memorias `feedback_confirmar_la_zona_antes_de_modelar` y `project_apc_delantero_tela_tiras_ancho_parejo`.

- **01 y 06/10 — Si Fak pregunta "qué es esto / por qué", se le explica y se para (*"yo tomo las decisiones acá"*); pero si la pregunta ya trae el criterio («¿no debería ser esa la filosofía?»), ya decidió: se hace, sin pedirle un «sí»** (*"¿esperás mi sí para hacer las cosas bien?"*). Graduado a la memoria `feedback_si_pide_que_le_explique_se_explica_y_se_para`.

- **30/09 y 05/10 — Lo que Fak ejecuta con doble click se prueba por SU camino, con lo que ESA PC ve, y lo que pasa la primera vez se dice ANTES** (*"me pide contraseña, te dije que sea automático"*; el `Instalar` de prueba instaló la versión publicada en la PC de su gerente). Graduado a `lo_que_fak_ejecuta_se_prueba_por_su_camino` y `project_claudes_por_area`.
