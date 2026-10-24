# Lecciones Aprendidas — Barack Mercosul APQP (destilado vivo)

Archivo mantenido por Claude Code. Entra completo al system prompt (`@import` desde CLAUDE.md),
por eso contiene solo lo accionable que no esta ya codificado como regla o gate ejecutable. Cada
leccion es un bullet legible de hasta 600 caracteres; el detalle vive en la memoria o el snapshot
que cita (gate por bullet: regla `lecciones-consolidacion.md`). La historia completa de cada
incidente vive en los snapshots.

- **Snapshots** (la version larga de cada consolidacion): los tres ultimos son [2026-10-11](docs/_archive/LECCIONES_snapshot_2026-10-11.md) · [2026-10-18](docs/_archive/LECCIONES_snapshot_2026-10-18.md) · [2026-10-23](docs/_archive/LECCIONES_snapshot_2026-10-23.md) y el historico 2026-03-30 a 07-02, [2026H1](docs/_archive/LECCIONES_APRENDIDAS_2026H1_completo.md); los demas estan en `docs/_archive/`.
- **Tabla incidente → regla**: `docs/_archive/INCIDENTES_REGLAS_AMFE.md`
- Lo ya codificado no se repite aca: reglas de `.claude/rules/` y sus gates ejecutables
  (amfe.md + amfeValidator, database.md, verify-supabase-live.md, no-pfd-no-ho.md, techo-agentes.md, cad-3d.md).

## Verificacion y evidencia

- **23/10 — Si Fak dice que se va y «frená todo», no se lanza nada más en ese turno y se cierra lo abierto (commit, push, hora terminada): su frase de ese momento le gana a la tanda de 36 h** (*"en 7 minutos me voy y estás lanzando agentes?"*).

- **23/10 — «La parte de abajo» de algo que Fak tiene puesto es la de abajo como se usa, no la del dibujo de cotas: la foto marcada lo cazó antes de cortar.** Memoria `project_dedal_pablo_ferula_v2`.

- **20/10 — Una mejora implementada que depende de que me acuerde de un flag está apagada: lancé la vigilancia de la Bambu sin `--detector` y lo vio Fak** (*"imperdonable... es bastante grave"*). Viernes 23/10: `detector-impresion-olvidado-viernes`.

- **20/10 — Pasar a un patrón las marcas de una foto es SUPERPONER y CALCAR, zona por zona, y mostrar cada marca con el corte encima; no forzar las medidas de Fak ni detectar manchas por programa** (*"¿por qué lo complejizaste tanto?... olvidate de mis medidas, que se parezca a la foto"*). Siete versiones por eso.

- **19/10 — En una estructura cada unión se MIDE (área de contacto donde va la soldadura), no alcanza «0 solape»: las patas del carro de práctica tocaban el marco por una arista y lo vio Fak en el plano** (*"¿por qué te lo tuve que decir?"*). Es la regla del caballete (`cad-3d.md` GATE 3: toda interfaz que carga peso lleva su control) y no la apliqué.

- **19/10 — Lo que una herramienta llama «contacto» o «sin choque» se mide con un método exacto antes de decidir con eso: el choque de CATIA dijo «contacto 0,0» con 0,3 mm de choque y con 0,1 mm de luz.** Graduado a `cad-design/reference/catia.md` y `reference_catia_por_com`.

- **18/10 — Una prueba que corre los guardianes de verdad (el despachador con pedidos peligrosos) va con un HOME aparte: con el real gasta el permiso de un solo uso que Fak dejó.** Graduado a `codigo-madre.md` y `scripts/_despachadorPayloads.mjs`.

- **17/10 — Una simulación que reproduce lo publicado puede estar ciega a una parte de la pieza.** Graduado a `reference_gate_asiento_simulacion_ciega`.

- **17/10 — Un caso de prueba peligroso (leer secretos, borrar, pisar un listado) no se pega en el chat: viaja por archivo y los tests lo llaman por su código.** Graduado a `__tests__/scripts/guardianesRonda3.casos.json`; el caso entero, en el snapshot 2026-10-18.

- **11/10 — Antes de un push que agrega archivos o toca `settings.json` va la suite COMPLETA, y un umbral de una regla no lo aflojo yo: va como propuesta.** Graduado a `feedback_suite_completa_antes_del_push` y `feedback_un_numero_de_la_regla_no_lo_cambio_yo`.

- **11-12/10 — Lo que va a un registro (una hora, «lo dije en el chat») se MIDE antes de escribirlo (`date`, el commit, el archivo), nunca de memoria; desde un worktree, lo de main se prueba con `git -C` y rutas absolutas.** Graduado a `reference_entrar_a_main_desde_un_worktree`.

- **11/10 — Un subagente al que se le pide ubicar dónde está una clave la imprime en su salida: el encargo dice con qué buscar (`grep -l`, `-c`), no «no la repitas».**

- **10-11/10 — Una tanda de hijas se mide por el cupo SEMANAL y por el de 5 h, cada hora: tres o cuatro a la vez suben el semanal ~4 puntos por hora.** Graduado a `trabajar-hasta-la-hora.md` punto 5 y a `reference_api_claude_clave_y_ciclo`.

- **11/10 — Lo que escribe la API se AUDITA antes de commitear (3 y 2 errores reales en dos tandas), y lo que afirma de un dato que no vio se mide antes de codear.** Graduado a `api-claude.md` §2 y §5 y a `feedback_la_respuesta_conocida_se_mide_antes_del_gate`.

- **09-10/10 — Un control que suma trabajo a un chequeo con tope de tiempo se mide en el MODO en que corre ese chequeo, y el auditor Opus no se saltea.** Graduado al auditor (`metodo_correr_no_solo_leer`) y a `_sinFirmaIA.py`; el caso, en el snapshot 2026-10-18.

- **07/10 — «El estándar» se COMPARA contra una hoja real de la casa (la HO de Excel), no contra lo que dejó la sesión anterior.** Graduado al canon 4.5 y a `bloque_plan()`; la cita y el caso, en el snapshot 2026-10-18.

- **22/09-06/10 — Lo que construyo para otros, o lo que AFLOJA un control, lo prueba OTRO: contra el viejo, a ciegas, con el corte escrito antes; y si Fak ya aceptó el riesgo, mi freno no le gana a su pedido.** Graduado a `un_control_se_audita_en_las_dos_direcciones` y `project_claudes_por_area`.
- **02 y 09/10 — De un flujograma, un AMFE o una hoja de reunión sale la PALABRA «reproceso», nunca su análisis; un AMFE escrito de cero se delata por el largo de sus frases.** Graduado a `reference_iatf_retrabajo_8714_y_antecedentes_barack`, `amfeAutoria.mjs` y `_sinFirmaIA.py`.
- **22/09 — Un cambio de criterio (o un número) se barre por su FRASE en todo el repo, y un guardián que falla sin bloquear está apagado.** Graduado al test 5c de `hooksTienenTest` (`${CLAUDE_PROJECT_DIR}`) y a `puerta.py` (puerta D).
- **22/09 — La VARA también se audita, y lo primero que se le mira es la FECHA**: la tabla AP y las escalas O/D salían de un borrador de 2017 del AIAG-VDA. La tabla AP ya es la oficial (23/09); las escalas, pendientes. Memoria `project_tabla_ap_de_la_casa_es_el_borrador_2017`.
- **22/09 — Un gate contesta lo que le preguntan: los obstáculos se listan del CONJUNTO, no del subconjunto, centrado y simetría también se miden, y un control que frena dice CUÁL renglón lo frena.** Graduado a `chequeo_centrado.py` y a la memoria `dispositivo_adhesivado_insert`.
- **21/09 — Antes de ejecutar un pedido que toca a un cliente, se abre el sistema del CLIENTE: ahi esta si el trabajo ya se hizo y por que esta trabado** (un 8D cerrado hacia semanas en KPM; un "agregale la norma" que era un PPAP rechazado en IMDS). Memorias `8d_11010843_tapa_amarok`, `project_imds_barack`.
- **10-13/09 — Una contradicción adentro del entregable es un ROJO, no una nota al pie; la frase que resume números la arma el CÓDIGO.** Graduado a la memoria `contradiccion_en_el_entregable_es_rojo`.
- **Lo que no veo no prueba nada: el system prompt es la foto del arranque (antes de decir «quedó sin hacer», el disco y el `git log`), lo de otra PC no lo veo, lo que apunta a un vacío se lee como «roto» y un cero puede ser del sistema y no del hecho (mirar si la población de ese campo lo llena).** Memorias `el_system_prompt_es_la_foto_del_arranque`, `worktree_sin_env_local`, `hablarle_a_otra_pc`, `dispositivo_adhesivado_insert`, `datos_produccion_pcp_federico`.
- **Antes de construir, pedir o traer de afuera, mirar lo que ya hay (*"ya deberías saber la respuesta"*): correr el control que ya viene; en una interfaz ajena el límite casi siempre está de mi lado y un camino cerrado se rodea (*"buscale la solución, no pares"*); un chequeo negativo cierra ese camino, no prueba que el dato no exista.** Graduado a `claude_plugin_cli`, `crlf_en_claude_md_reglas_y_memory`, `reference_capturar_la_app_claude_sin_clics`, `arb-operar`, `la_info_ya_la_tengo_no_preguntar`, `ordenes_compra_disco_z`, `no_concluir_con_la_fuente_incompleta`.
- **Un sistema se diseña para el que lo va a usar y lo prueba algo que no sea yo: un control solo ve lo que DECLARA, uno que no puede dar verde está tan roto como el que no puede dar rojo, lo que FALTA no se ve, y el «instalado» se marca en el último paso.** Memorias `project_claude_barack_fase0`, `un_control_se_audita_en_las_dos_direcciones` (skill `flujogramas` §0 bis).
- **El entregable se revalida contra la fuente justo antes de mandarlo, y un mail se verifica por DESTINATARIOS.** Graduado a `mail-envio.md` + `_mailEnviar.py` y a las memorias `mail_ya_enviado`, `dejar_el_mail_listo_para_enviar`, `no_pisar_archivo_que_toco_fak`, `mails_de_barack_se_comparten`.
- **04/09 — El denominador de un "cuanto falta" se mide antes de decirlo, y un "reanudar" que salta por nombre pelado descarta en silencio.** La ocurrencia se cuenta en el recorrido, no se deduce del disco; el cotejo final va contra la fuente, base por base. Memoria `leer_buzones_ost_pst`.
- **Un documento no confiesa cómo se hizo: un hueco interno se resuelve o se pregunta (no se escribe como causa) y una difusión que corrige un error propio dice solo el valor que queda** (*"si ponemos el antes y el despues me escrachas"*). Test: ¿esta frase deja mal a Barack, a un compañero o a un proveedor? Graduado a `documento_no_confiesa_como_se_hizo`.
- **Una cosa no se identifica por su etiqueta sino por su FORMA y su FUNCIÓN: se abre; antes de declarar un error, se pregunta si es convención de la casa; entre versiones manda la que Fak validó.** Graduado a `el_nombre_no_es_el_contenido`, `el_nombre_de_la_pieza_no_identifica_el_proyecto`, `sgc_propio_ingenieria`, `ho_generales_compartidas`, `aplix_medida_16x16_dominante`, `unidad_oc_es_etiqueta_del_maestro`, `reference_plotter_aol_corte_insert`, `project_pines_costura_cnc_insert`, `reference_valores_costura_patagonia_confirmados`.
- **Una muestra no es un patron, ni una sola ni varias, y lo verificado se reporta con su alcance real: partes verificadas distinto no se suman.** Graduado a la memoria `feedback_una_muestra_no_es_un_patron`.
- **Verificar el script no es verificar el entregable: un dry-run verde no prueba el `--apply`, se abre el archivo que quedó en la carpeta, se juzga en su forma final (impreso, en el zoom en que se usa, lo que ve el LECTOR) y un render no se mira: se mide.** Graduado a `no_entregable_ejecutable_sin_verificar`, `_paquete.mjs`, `cad-design` (39), `git-deploy.md`, `hojas-proceso.md` §5, `_xlsxAPdf.py`, `cajetin.py`, `ppap_novax_tapizadas_puerta`, `columnas_de_un_entregable`, `reference_medir_una_hoja_de_matplotlib`.
- **Un defecto que aparece donde no toque es del mecanismo, no mio: un contador derivado que ningun camino de escritura mantiene miente en silencio.** Antes de dar por arreglado lo que rompi, contar en cuantos lugares mas esta. Graduado a `saveAmfe()` (`scripts/_lib/amfeIo.mjs`) y a su test `saveAmfeConteos.test.mjs`.
- **10-11/09 — Si algo mío vuelve por cuarta vez, el número objetivo lo elegí yo: se MIDE una referencia real; si vuelve una quinta, la equivocada es la FUENTE** (*"usá esa canción, las tuyas son malísimas"*). Graduado al skill `editar-video` §3, §4.1, §6.2 y `scripts/_video.py`.
- **El chequeo frena, no decide; y la objecion de Fak es un dato, no una opinion a refutar: ante un "no anda", preguntar como falla.** Graduado a la memoria `feedback_el_chequeo_frena_no_decide` (y `cad-3d.md` GATE 0).
- **Un plan de accion heredado se arrastra fila por fila: fusionar dos filas pierde alcance, media fila que se cae no la ve nadie, y un issue no se cierra con evidencia de una parte del alcance.** Graduado a la memoria `plan_heredado_se_arrastra_fila_por_fila`.

- **07/10 — Un mail que Fak pide «con lo que encuentres» lleva UNA pregunta y lo mínimo para entenderla, no el informe del agente pegado.** Graduado a `feedback_mail_corto_como_los_de_fak`.

- **02 y 05/10 — Para un código el arb es la fuente, pero antes de decir «el arb tiene mal X» se confirma que la BOM leída es la de ESE código (10 productos cargados dos veces con otra grafía).** Graduado a `feedback_arb_es_la_fuente_de_un_codigo` y `scripts/hilos/cruce_programa_arb.py`.

- **05/10 — Un largo que sale de un plano se calcula SUMANDO sus cotas, no midiendo el dibujo.** Graduado a `feedback_largo_de_un_plano_se_suma_de_las_cotas`.

- **Una hoja de proceso nombra primero las PIEZAS que se mueven (hoja-mapa, una por pieza; qué se mueve antes que con qué botón), y una pieza de nombre raro lleva su aclaración entre paréntesis y su recuadro en la foto.** Graduado al skill `hojas-de-proceso` 0.8 b bis y a `project_hojas_proceso_img`, `feedback_palabra_rara_en_una_hoja_se_aclara_y_se_marca`.

- **13/10 — Un utillaje que apoya sobre algo blando se simula APOYADO y APRETADO antes de imprimirlo, y ante un «no anda» se mide antes de dar una teoría.** Graduado a `feedback_diseno_3d_medir_antes_de_explicar_y_simular_el_uso` y al gate de asiento de la tanda 2.


- **15/10 — Plan de control: se genera releyendo flujograma, AMFE y fichas de embalaje JUSTO antes, y si se rearma entero va limpio: sin amarillo ni notas, una característica por fila, la D sola.** Graduado al skill `planes-de-control` §4 y §5.

## Identidad de un dato

- **Una fuente que sale de mi lado del mostrador (una regla mía, un test, un agente, el número que yo propuse) no es una segunda fuente: si un documento puede zanjarlo, se abre antes de actuar.** Graduado a `amfe.md` §12 y a `verificar_contra_la_fuente_no_el_codigo`, `un_agente_no_es_independiente`, `al_documento_entra_lo_que_dice_un_papel_de_esa_pieza`.
- **En la BOM va el codigo del proveedor; el interno es el parche hasta que el proveedor da el suyo.** Que un codigo interno aparezca en OC significa que ese material todavia no tiene codigo de proveedor, no que sea la regla. Graduado a la memoria `codigo_de_proveedor_le_gana_al_interno`.

## Consumos de material

- **Un numero que no cuadra casi nunca es un error: es la misma cosa en otra magnitud, o el mismo numero con la merma adentro**, y se normaliza a la unidad que gobierna antes de reportar un desvio. Graduado a `consumos-entregables.md` + `_validarConsumos.mjs` + skill `verificacion-consumos`.
- **22/09 y 06/10 — El consumo de vinilo o tela sale de la planilla oficial o del mail de Pablo Gamboa; una tizada sola puede ser una prueba** (Fak: *"¿desde cuándo vos proponés?"*). Se dice «patrón», no «molde». Graduado a `consumos-entregables.md` §6 y a `consumo_se_verifica_en_el_marker_no_en_la_planilla`.
- **08/10 — Un consumo del arb se rastrea en los mails con su RESPUESTA (el 0,08 del Sika era un mail que Carlos anuló) y una cuenta mía no se dice como dato.** Memoria `project_sika_toproll_codigo_y_consumo`.

## Entregables y comunicacion con Fak

- **23/10 — Los pedidos de la otra PC se miran en CADA despertar del latido, no solo al arrancar la sesión: CATA dejó dos a las 22:05 y 22:22 y los vi a las 22:45, cuando Fak preguntó** (*"la notebook de Calidad te mandó mensajes pero hace rato no le respondés, ¿no deberías chequear cada tanto?"*; a CATA: *"quedate escuchando o comunicándote de forma autónoma con la PC principal y resuelvan lo que tengan que resolver"*). Lo que se resuelve entre las dos PC no se le pide a él.

- **20/10 — Que Calidad aprobó algo no va en el mail de difusión salvo que Fak lo pida** (*"no pongas que está aprobado por Calidad"*): se dice qué es y cómo se usa. Caso: calibre L de la costura del Insert, memoria `project_calibre_l_costura_insert`.

- **19/10 — «Está bien» de un plan de control se dice después de compararlo contra un plan de Calidad y mirar logo y nombres** (*"errores boludos"*). Graduado al skill `planes-de-control`; viernes 23/10 (`pc-errores-boludos-viernes`).

- **19/10 — En CATA, los mails de Fak se leen en la nube y se mandan por PEDIDO a la principal; un plan de control no remite a la HO.** Graduado a `feedback_mails_de_fak_se_buscan_en_la_nube_tambien_en_cata` y `feedback_plan_de_control_sin_referencias_a_la_ho`.

- **19/10 — A quién se le pide un dato se decide por quién lo TIENE, no por el nombre del sector: turnos y lugar en la línea de un capacitario los define Ingeniería; el OEE real, Producción** (*"en qué te basás para pedirle eso a Federico"*). Memoria `project_ppap_p21_hilo_naranja_my2026`.

- **18/10 — Al Fak estudiante no se le da una nota: el "7" de Matemática terminó en 2 y el 18/10 repetí "ya sacás 5 de 10"** (*"no hagas falsas promesas"*). Solo techo, dicho como techo, o un rango salido de simulacros reales. Graduado al `CLAUDE.md` de `Estudio-UNLaM` («Cómo se habla de la nota») y a `feedback_estudio_unlam_nota_no_se_promete`.

- **15/10 — A Fak no se le pregunta lo que contesta un manual, una prueba que puedo correr, el propio diseño o la norma con el papel delante: se aplica y se informa** (*"ya sabés decidir en base a datos"*). Graduado a `feedback_la_info_ya_la_tengo_no_preguntar` y `feedback_con_recomendacion_no_se_pregunta`.

- **16/10 — Lo que Fak confirma de su material con la pieza en la mano queda como DATO y el programa no lo vuelve a dudar; la impresora se busca por su serie, no por una dirección fija.** Graduado a `feedback_lo_que_fak_confirma_de_su_material_no_se_vuelve_a_dudar` y al skill `impresion-3d-bambu`.

- **13/10 — Si Fak pide que algo quede automático, no se le deja una lista de pasos ni un archivo para editar** (*"hacé eso vos... ni pienso leer eso"*), **y un «no aprietes nada» se dice después de medir que avanza.** Graduado al skill `impresion-3d-bambu` §1 bis.

- **11/10 — Una pantalla que Fak mira todos los días se escribe con SUS palabras, como un entregable («disponible», «gastado», con día y hora).** Graduado a `feedback_lenguaje_del_entregable_palabras_de_fak`; las citas, en el snapshot 2026-10-18.

- **09-10/10 — Un «no puedo» a Fak es un problema mío, y una pregunta que le hago NO frena el resto: lo que no depende de ella se hace mientras tanto.** Graduado a `_mailEnviar.py` paso 4b, `mail-envio.md` y `feedback_la_caja_soy_yo_pensar_fuera_de_lo_que_dijo_fak`; los dos casos, en el snapshot 2026-10-18.
- **09/10 — El historial de revisiones también confiesa: una corrección por observación interna, antes de que el documento salga, no abre revisión.** Graduado a `documento_no_confiesa_como_se_hizo`; el caso del 160/174, en el snapshot 2026-10-18.

- **09/10 — El alcance de un reclamo lo marca DÓNDE va el material, no la frase amplia del pedido.** Graduado a `project_reclamo_agujas_fieltro_pwa`.

- **09/10 — Un PowerPoint para un gerente se arma como lo haría un ingeniero de la casa (blanco, tablas y capturas reales; *"parece hecho con IA"*) y el logo es SOLO el oficial.** Graduado a `feedback_powerpoint_para_un_gerente_como_ingeniero_de_la_casa` y `feedback_logo_oficial_barack_en_todo_documento`.

- **09/10 — Una hoja para una reunión se arma DESPUÉS de buscar qué contesta un papel, en la voz de Fak y para mostrarse** (*"preguntaste cosas que ya sabemos... que no parezca IA"*). Graduado a la memoria `feedback_hoja_de_reunion_para_mostrar`.

- **08-10/10 — Fak SUGIERE (sus números y reglas son DATOS, no límites) y yo decido con evidencia, diciéndole «mirá, creo que lo que querés es esto»; el código es sagrado y el tamaño del cambio decide el camino.** Graduado a `techo-agentes.md`, `codigo-madre.md` y `feedback_la_caja_soy_yo_pensar_fuera_de_lo_que_dijo_fak`.

- **08/10 — Mi Claude para OTRA persona va filtrado y con SU identidad** (a Carlos la memoria cruda le dejó "el usuario es Facundo"); y una pregunta de Fak no es una orden de diseño. Graduado a `validarTexto()` de `tools/claude-area/persona/armar.mjs` y a `project_claude_para_pedro`.

- **08/10 — Ante un pedido con dos lecturas se arma lo principal y lo accesorio va después; lo que Fak va a usar se deja en UNA carpeta con doble clic numerados.** Memoria `project_instalar_mi_asistente_pc_nueva`; el caso del instalador, en el snapshot 2026-10-18.

- **08/10 — Lo que escribo en un entregable lo tiene que poder defender Fak.** Graduado a `feedback_entregables_para_fak`.

- **07-08/10 — Toma de tiempos por video = TIEMPOS + VIDEO RECORTADO adentro del PowerPoint, sin planilla; el rato en que el operario prueba no es proceso; un link a la nube se le pide a OneDrive.** Memorias `project_tiempos_forrado_ductos_patagonia`, `reference_link_nube_se_pide_a_onedrive`.

- **07/10 — Con Fak se habla en castellano también en los avisos cortos** (*"dejá de hablar en inglés"*; graduado al chequeo 10 del cierre-guard, `idioma.mjs`). **Y un pedido de videos para alguien que tiene editor es de ORIGINALES completos**: preguntar o deducir el uso antes de editar.

- **06/10 y 14/10 — El archivo sobre el que se trabaja se confirma antes: el parecido se muestra, y entre versiones manda la vigente.** Graduado a `feedback_archivo_que_se_toma_se_muestra_antes`.

- **06/10 — Una pregunta directa de Fak que llega mientras trabajo se contesta en el mensaje siguiente, antes de seguir.** Graduado a `reference_capacidades_de_proceso_y_toma_de_tiempos_por_video` (paso 1); el caso, en el snapshot 2026-10-18.

- **06/10 — Lo que corrijo en el archivo de OTRO se le muestra a Fak recién auditado, cada celda con su ANTES, y volver atrás un cambio no puede dejar un dato que se sabe falso**. Graduado a la memoria `feedback_entregables_para_fak`.

- **06 y 14/10 — En el entregable va lo que contesta la pregunta, sin recomendaciones que nadie pidió; lo que no pude hacer se dice, no se reemplaza por algo parecido con el título de lo pedido** (Fak: *"al pedo hiciste eso, no muestres info de más"*). Graduado a la memoria `feedback_responder_el_scope_exacto`.

- **06/10 — Si Fak marca UN defecto de un documento se corrige eso con el criterio escrito y se le muestra, sin menú de qué más tocar; el freno que armé para eso PAUSA la pregunta, no ordena hacer.** Graduado al skill `flujogramas` §1.5, a `preguntaGuard.mjs` y a `feedback_con_recomendacion_no_se_pregunta`.

- **06/10 — Antes de acortar un documento ya emitido se busca POR QUÉ era largo (el flujograma del IP Pad tenía un nodo por pestaña por la carga en BeOn), y el cambio se le dice a Fak.** Graduado al skill `flujogramas` §1.5.

- **04-06/10 — El asistente de área se diseña para RESOLVER: un freno que contesta «no puedo» o «hacelo vos» es error mío; lo que deciden ellos no vuelve como «decisión tuya», y a Fak un papel se le muestra, no se le nombra por mi número.** Graduado a `project_claudes_por_area` y `tools/claude-area/vigia.mjs`.

- **03/10 — Teclas simuladas y fotos de pantalla no se usan sin saber que Fak no está en la PC: las teclas van a la ventana que tenga el foco**. Graduado a la memoria `feedback_no_teclear_ni_fotografiar_la_pantalla_de_fak`.

- **03/10 — Cuando Fak cuenta lo que estuvo haciendo («hice mejoras en…»), es un pedido de revisarlo y traer lo que sirva, no contexto** (*"para algo que te había dicho"*). Graduado a la memoria `feedback_el_pedido_flojo_se_completa_con_el_objetivo`.

- **02/10 — Antes de tocar un patrón por lo que muestra un video, se le devuelve a Fak el dibujo con «llevo ESTO a ESTO»; y un piquete es marca de COSTURA: se reubica por largo de costura, no en línea recta.** Graduado a `feedback_confirmar_la_zona_antes_de_modelar` y `project_apc_delantero_tela_tiras_ancho_parejo`.

- **02/10 — Lo que hay que volver a pedir va a un seguimiento con fecha, y lo que va a quien busca el error sale corto y sin nada que suene a generado.** Graduado a `scripts/_seguimientos.mjs` y a las memorias `project_seguimientos_con_fecha` y `feedback_mails_a_calidad_cecilia_sin_flancos`.

- **01/10 — Cuando un entregable vuelve se relee el PRIMER pedido entero; lo que no aparece no se rellena con algo parecido, y "no hay" se dice después de listar sin filtro de palabras**. Graduado al hook `correccion-guard` y a `scripts/_materialAfuera.mjs` (`video-maquina.md`).

- **01 y 06/10 — Si Fak pregunta «qué es esto / por qué», se le explica y se para; pero si la pregunta ya trae el criterio, ya decidió: se hace, sin pedirle un «sí».** Graduado a `feedback_si_pide_que_le_explique_se_explica_y_se_para`; las citas, en el snapshot 2026-10-18.
- **30/09-02/10 — El techo de 10 agentes no es la capacidad de la PC** (4-5 con navegador, ninguno nuevo con menos de 3 GB libres), y un trabajo de toda la noche no se sostiene con avisos de la sesión. Graduado a `reference_notebook_capacidad_agentes_con_navegador`.
- **30/09 y 05/10 — Lo que Fak ejecuta con doble click se prueba por SU camino, con lo que ESA PC ve, y lo que pasa la primera vez se dice ANTES.** Graduado a `lo_que_fak_ejecuta_se_prueba_por_su_camino` y `project_claudes_por_area`; los dos casos, en el snapshot 2026-10-18.
- **23/09 — Lo que dice la norma publicada no se presenta como decisión pendiente, y una pregunta a Fak se escribe como la lista que él lee.** Graduado a la memoria `feedback_pregunta_a_fak_como_listita`.
- **El pedido se ejecuta como viene y entero: ni fabricar una decisión que Fak no tiene que tomar ni convertir un comentario en trabajo; el dato que pasa escrito no se discute, y un audit incluye aplicar lo que encuentra.** Graduado a `feedback_el_pedido_se_ejecuta_como_viene` y `feedback_audit_incluye_aplicar`.
- **Lo que sale de acá lo define el destinatario y se entiende en una lectura (¿el que lee tiene que hacer algo con esto hoy?): lo que explica va en un PDF visual con la captura de su fuente, y el cierre dice qué recomiendo y el comando, con las palabras de Fak.** Graduado a `mail-envio.md`, `editar-video` §5, `cad-3d.md` GATE E, `entregables_para_fak`, `mail_corto_como_los_de_fak`, `sin_ingles_random`, `traduccion_va_completa_en_idioma_destino`, `no_hacer_informes`, `feedback_mail_de_una_tarea_va_con_la_info_procesada`, `cierre-guard.sh` (5).
- **Material de Fak no se borra para hacer lugar: va a la nube, y el disco se libera deshidratando.** Graduado entero a la memoria `material_de_fak_no_se_borra_va_a_la_nube` (*"nunca di esa orden"*, *"nunca los borres"*).
- **01 y 12/09 — Despues de la segunda correccion seguida se deja de parchear y se barre la tabla ENTERA; barrer una COLUMNA no es barrer la tabla.** Graduado a la memoria `feedback_despues_de_la_segunda_correccion_se_barre_la_tabla`.

## Como agregar lecciones nuevas (ciclo de vida)

Graduado a la regla **`.claude/rules/lecciones-consolidacion.md`** (carga sola al tocar este
archivo): como entra una leccion, la tabla de graduacion y el **gate por bullet** (600 caracteres
por leccion; una "graduada a X", 2 lineas). El techo de 26/28 KB queda como red. Enforcement:
`scripts/_lib/cierreGuard.mjs`, corrido por `node scripts/_cierreSesion.mjs` y por el hook Stop
`cierre-guard.sh`.
