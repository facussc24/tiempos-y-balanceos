# Cola de cambios al código (pedidos de Fak y hallazgos míos)

Regla `.claude/rules/codigo-madre.md`: un pedido chico que llega mientras Fak labura en otra cosa se
anota acá con sus palabras y se hace en una sesión de código, de a uno, por el camino de su tamaño
(chico · mediano · grande). Al abrir una sesión de código se lee esta cola primero. Lo hecho se tacha
con la fecha y el commit; cada tanto se archiva lo tachado al final.

Formato de una fila: `- [ ] AAAA-MM-DD · tamaño · quién · qué (sus palabras) · dónde (archivo o área)`

## Cómo se lee

- HACER YA es trabajo del repo, reversible: se hace sin preguntar, de a uno, en el orden de abajo. PROPONER necesita que Fak conteste sí o no por renglón. DESCARTADO no se hace y dice por qué. Hechos es lo terminado.
- El tamaño sigue `codigo-madre.md`. **Chico:** un archivo, el cambio se describe en una oración y no cambia lo que ve Fak. **Mediano:** varios archivos, cambia un comportamiento o toca un hook, un guardián, una regla o un settings (plan corto y auditor Opus). **Grande:** una función nueva, un refactor o algo sin caso anterior (plan en `docs/` y su sí).
- Cada fila lleva su origen: A-nn (F1), R-n §x (informes del 08/10), D1 #n (chats del 09/10), o Fak con la fecha y sus palabras. H, P y X son los números de S1; S2-n son filas que agregó la revisión Fable; HOY-n son filas de la tarde del 09/10.
- Lo tachado ([x]) lleva la fecha y el commit. Lo hecho fuera de git dice cómo se verificó.
- Cada propuesta lleva una etiqueta: **solo vos** (es su dato o su decisión), **tu sí** (una regla escrita pide su sí) o **aviso** (se hace salvo que diga que no).
- «(duda: S2 dice X)» marca una diferencia sin evidencia entre S1 y S2. Lo que falta probar va como nota corta al final de la fila.

## Orden de trabajo

1. H1 · chico · medir lo que gastaron S1 y el Fable, y el buscador con omitClaudeMd · lo pidió hoy a las 12:13 y es un comando
2. H15 · mediano · sumar como pasos de la noche las propuestas de skills, la prueba de disparo y el vigilante de precios · la noche corre sola el 10/10 a las 06:30 sin esos pasos
3. H16 + H18 · mediano · candado 1 con la ruta real y tope adentro de la pre-auditoría · la noche ya gasta plata de verdad
4. H2 + H3 · mediano · despertador con la tarea programada y lista de la tanda larga · dos noches perdidas, la falla que más horas costó
5. H9 + H10 + H11 · mediano · logo, fotos sin datos de cámara y frases que escrachan · lo deja mal con terceros (*"gravísimo"*, dos veces)
6. H12 · mediano · aviso por cada número sin fuente antes de mandar un mail · un número sin papel ya le llegó a Carlos
7. H4 · mediano · el cierre rehace un turno que terminó en inglés · pasó tres veces, con enojo escrito
8. H8 + H7 · mediano y chico · decir qué agentes se lanzan antes de lanzarlos y medir cuántos Sonnet eran búsquedas · lo pidió dos veces el mismo día
9. H14 + P26 · mediano · entregables de exports/ en el cierre y TBD antes de imprimir · son los controles que faltan donde salen las cosas
11. H20 + H21 · mediano · novedades siguiendo los links y lectura por ventanas · pedido del 08/10, dos veces
12. H23 + H24 · mediano · lo crítico de cuatro skills arriba del corte y descripciones con «Usar cuando» · ahí se corta «un número por pieza»
13. H25 + H26 + H27 · chico y mediano · condición del 06/10 en consumos y vigilante del arb · tres textos que contradicen reglas de Fak
14. H30 + H31 · mediano y chico · el correccion-guard pide decidir, no copiar la lista literal · Fak: *"deja de tomar literal"*
15. H5 + H6 · mediano · el cierre empieza por lo que necesito de Fak, y el aviso del cartel de permisos · son líneas, van después de lo que duele

## HACER YA (trabajo reversible del repo; no necesita su sí)

- [ ] HOY-6 · 2026-10-09 · mediano · Fak 16:55 (*"subilas a la nube... ¿se borran las viejas?"*) · los registros de conversaciones de Claude Code (`~/.claude/projects/C--Dev-BarackMercosul*/*.jsonl`) viajan a la nube de Ingeniería como pieza de `_nube.mjs --sincronizar` (solo subir, nunca borrar; son la fuente de los informes de errores) y `cleanupPeriodDays` pasa a 90 (P42) · `scripts/_nube.mjs`, `~/.claude/settings.json`, test · evidencia: la doc borra transcripts a los 30 días; R4 leyó desde el 01/09

- [ ] H1 · 2026-10-09 · chico · A51 · F1 Q12 · medir con _tokens.mjs --desde 2026-10-09 lo que gastaron S1 y el Fable, y los tokens del buscador antes y después de omitClaudeMd; decírselo en un renglón · solo lectura · Fak 12:13 *"quiero ver cuántos nos consume ese agente independiente"*; R2:40
- [ ] H15 · 2026-10-09 · mediano · cola (orden 2) · sumar a PASOS de la noche las propuestas de skills, la prueba de disparo y el vigilante de precios (semanal), con test y una corrida --simular el mismo día · nocturno.mjs, _nocturno.mjs, api-claude.md, nocturno.test, candadosNocturno.test · api-claude.md:92; nocturno.mjs:22 (4 pasos); la noche corre el 10/10 06:30 (S2)
- [ ] H16 · 2026-10-09 · mediano · A21b · auditor 09/10 · escrituraSegura.mjs compara el repo y la base con fs.realpathSync.native (nombre corto 8.3, junctions), con test BARACK~1 · _lib/escrituraSegura.mjs, test · cola: con C:\Dev\BARACK~1 una variable daría ok; la noche ya corrió a las 14:54 (S2)
- [ ] H18 · 2026-10-09 · mediano · A21d · auditor 09/10 · el tope por corrida se mira también adentro de la pre-auditoría, y un guardar() que falla dentro de enParalelo corta a los otros workers · _lib/nocturno.mjs:70, _preauditarAmfe.mjs:214, tests · cola: ~$1,27 por 6 AMFE sin tope adentro
- [ ] H2 · 2026-10-09 · mediano · A1a · F1 S17-S18 · horaGuard.mjs --latido y hora-guard.sh aceptan como latido el id de la tarea programada de la app, en vez de session_crons; prueba con un mensaje real · horaGuard.mjs, hora-guard.sh, trabajar-hasta-la-hora.md, test · 0 LATIDO en 16 sesiones; horaGuard.mjs:417-419; noches del 03/10 y 08/10
- [ ] H3 · 2026-10-09 · mediano · A1b + A26 · R2 #21 · la lista de una tanda larga suma «trabajo que puedo hacer solo», «decidí distinto de lo pedido» y «no pude verificar» · _lib/horaGuard.mjs, test · 08/10 01:45 «no tocar más código sin vos» con 6 h por delante (F1 S17); grep: 0
- [ ] H9 · 2026-10-09 · mediano · A7a · D1 #2 · _sinFirmaIA.py frena solo con el hash de logos NO oficiales conocidos (el LOGO BARACK.png de la raíz, el violeta del 07/10) y avisa por imagen chica distinta del oficial, con la ruta del oficial; gemelo rojo · _sinFirmaIA.py, firmaIA.data.json, test · 11:31 *"gravísimo"*; grep «logo»: 0; diseño de S2 §1
- [ ] H10 · 2026-10-09 · mediano · A8 · D1 #3 · el mismo detector avisa, sin frenar, si una imagen no trae datos de cámara ni de captura; commit aparte de H9 · los archivos de H9 · 09/10 11:20 *"parecen hechas con IA"*; regla en f969043f
- [ ] H11 · 2026-10-09 · mediano · A9 · D1 #4 · aviso de frases que escrachan en documentos y mails: «reproceso» junto a cliente/acta/pidió/no poner, y el antes y después de una corrección propia · _sinFirmaIA.py, firmaIA.data.json, test · 09/10 09:00 *"esto sacalo"*; LECCIONES 09/10 «gate pendiente»
- [ ] H12 · 2026-10-09 · mediano · A10 · D1 #9 · _mailEnviar.py avisa antes de --enviar por cada número con unidad que no esté en un adjunto ni cite su fuente; tests con un Outlook falso · _mailEnviar.py, test · 09/10 11:29 *"¿de dónde sacaste eso?"*, con el mail ya enviado; grep: 0
- [ ] H4 · 2026-10-09 · mediano · A4 · D1 #8, R4 #4 · el cierre-guard rehace en castellano un turno que termina en inglés (reusa esIngles de _tokens.mjs:52), con un gemelo verde · _lib/cierreGuard.mjs, _tokens.mjs, test · 65 turnos en inglés desde el 01/09 (R4); 09/10 08:56; Fak 07/10 *"dejá de hablar en inglés"*
- [ ] H8 · 2026-10-09 · mediano · A2c · F1 Q7 · línea en techo-agentes.md: antes de lanzar agentes, decir en un renglón cuáles, con qué modelo y por qué (es informar, no preguntar) · .claude/rules/techo-agentes.md · Fak 09/10 08:06 *"¿podés decirme antes de hacerlo?"* y 08:23
- [ ] H7 · 2026-10-09 · chico · A2a · D1 #12 · contar en los transcripts de la semana cuántos lanzamientos Sonnet eran búsquedas, con el método de _tokens.mjs y R4 (o sumar --lanzamientos a _agentes.mjs) · solo lectura · 08/10: 13 Sonnet y 1 Haiku (F1 2.2); --historial muestra las subas del límite, no los lanzamientos (_agentes.mjs:13, S2)
- [ ] H14 · 2026-10-09 · mediano · A28 · R4 #1 · esEntregableFuera cuenta exports/** (menos .build) como entregable, pero solo lo escrito en el turno y nombrado como final; test con un intermedio que no frena · _lib/cierreGuard.mjs:663-668, test · 112 entregables desde el 01/09 (R4); 536 archivos hoy (S2); :666 da falso
- [ ] P26 · 2026-10-09 · mediano · A38 · R4 #7 · _imprimir.py revisa el PDF antes de mandarlo y lista los TBD como aviso, sin preguntar y respetando el TBD del cajetín · _imprimir.py, test · 07/10 10:39 *"dice todo TBD"*; la firma ya se revisa en :80-81 (fda8f920); aprieta el control, no lo afloja (S2)

- [ ] H20 · 2026-10-08 · mediano · A6a · Fak 08/10 20:43 *"los links que pasa Claude Devs"* · _novedadesClaude.mjs sigue los links de cada posteo, guarda el artículo en .sgc-cache/x-seguimiento/articulos/ y la noche lo resume · _novedadesClaude.mjs, _lib/novedadesClaude.mjs, test · grep: el código no sigue links
- [ ] H21 · 2026-10-09 · mediano · A6b · R2 #25 · guardar lo leído aunque falle una página, leer por ventanas until: y sumar la cuenta alexalbert__ · los archivos de H20 y novedadesClaude.data.json · R2 #25: 404 en la consulta profunda, 4 de 4 por ventanas
- [ ] H23 · 2026-10-09 · mediano · A16a · R5 §1.1, §3.1 · subir a los primeros ~19.000 caracteres lo que se pierde al compactar: la caja de hojas-de-proceso (con «un número por PIEZA», hoy en :552), Seguridad de arb-operar, los anti-patrones y «número en el NOMBRE DEL ARCHIVO» de flujogramas, el §4 de cad-design · 4 SKILL.md · R5; :552 está a 36.915 bytes (S2)
- [ ] H24 · 2026-10-09 · mediano · A16b · R5 §1.5, §3.6 · descripciones: «Usar cuando…» en hojas-de-proceso, flujogramas, patrones-corte-plotter y editar-video; «dispositivo» en cad-design; sin la fecha en product-map; superficie-vinilo-3d a ~480; cada una probada con _probarMejora.mjs · 7 SKILL.md · 4 de 29 sin «cuándo» (grep); R5
- [ ] H25 · 2026-10-09 · chico · A16c · R5 §3.4 · verificacion-consumos (líneas 32-34) suma la condición del 06/10 (planilla del servidor o mail de Pablo Gamboa; una tizada sola no alcanza) y cita consumos-entregables.md §6 · skill verificacion-consumos · hoy dice «le gana al arb y a BOMs» sin condición
- [ ] H26 · 2026-10-09 · mediano · R5 §3.4 · la misma condición en _manuales de consumosCanon.data.json y en el texto 3 del hook consumos-entregable-guard · _lib/consumosCanon.data.json, _lib/guardianes.mjs · S2 lo vio saltar en vivo sin la condición
- [ ] H27 · 2026-10-09 · mediano · A16d · R5 §3.4 · arb-no-cerrar.md:43: el vigilante lo activa Claude con _arbVigilante.ps1 -Activar -SinMensaje (Fak también puede); el cambio se le muestra en el cierre · .claude/rules/arb-no-cerrar.md · Fak 30/09 *"activa el vigilante, eso lo podes hacer vos"*; arb-operar:102-106
- [ ] H30 · 2026-10-09 · mediano · A14a · F1 Q3 · el aviso del correccion-guard pide DECIDIR con evidencia y nombrar qué cubre el entregable, no «la lista con sus palabras»; prueba con un mensaje real · _lib/correccionGuard.mjs:220, test · Fak 08/10 21:44 *"deja de tomar literal todo lo que pido"*
- [ ] H31 · 2026-10-09 · chico · A14b · F1 2.2 · sacar «en sus palabras» del encabezado del plan, §0 · docs/PLAN_CLAUDE_BARACK_SISTEMA_2026-10-08.md:11 · (sin evidencia propia: lo afirma F1 2.2)
- [ ] H5 · 2026-10-09 · mediano · A13 · F1 O6 · línea en CLAUDE.md: el cierre empieza por lo que necesito de Fak, después qué cambió, después qué encontré; se mide como aviso dentro del chequeo 5 del cierre-guard, sin freno nuevo · CLAUDE.md, cierreGuard.mjs, cierreCanon.data.json, test · grep: 0; Fak 12:45 *"me preocupa que tenga muchos bloqueantes"*
- [ ] H6 · 2026-10-09 · mediano · A37a · R4 #6 · línea en CLAUDE.md: si la app muestra un cartel por algo que Fak ya autorizó, decirle «hay un cartel en tu pantalla, tocá Permitir» y no volver a pedirle el sí · CLAUDE.md · 07/10 10:19 *"¿no alcanza con que yo te diga sí?"*; R4 C05
- [ ] H17 · 2026-10-09 · chico · A21c · auditor 09/10 · candadosNocturno.test suma writeSync/openSync, alias de import, fs['writeFileSync'] y un spawnSync nuevo, con gemelos rojos · __tests__/scripts/candadosNocturno.test.mjs · cola; quedaron pendientes en a2e7b18d
- [ ] H19 · 2026-10-09 · chico · A21e · auditor 09/10 · vigilarPrecios.mjs:454 acepta el apóstrofo tipográfico · _lib/vigilarPrecios.mjs, test · cola: hoy falla con ruido (código 3)
- [ ] H22 · 2026-10-08 · mediano · A6c · Fak 08/10 *"a las 12 ya salió la noticia"* · una segunda lectura de novedades en el día, para que lo publicado a la tarde entre ese mismo día · _nocturno.mjs o la tarea que la dispara · el posteo de las 22:00 no estaba a las 00:30; la noche ya corre (S2)
- [ ] H28 · 2026-10-09 · chico · A15 · F1 2.3 · explicar-mejor, escalón 4: ante una forma de entrega nueva («videíto», «animación»), decir primero con qué herramienta y cuánto tarda; si no la tenemos, decirlo en el momento · skill explicar-mejor · 08/10 20:07-20:50: una hora de voz para un video que no quería
- [ ] H29 · 2026-10-09 · chico · R5 §3.1 · pasar «Cómo se dispara solo» y «Fuentes» de explicar-mejor a reference/mantenimiento.md · skill explicar-mejor · 1,6 KB en la skill más cargada (R5); probarMejora.test:121-124 nombra solo la ruta: no se rompe nada (S2)
- [ ] H32 · 2026-10-09 · mediano · A27 · R4 #9 · sumar «sintetiezaloco», «isntenizame», «sintenitis» y «simpflcia» al canon de explicarGuard; prueba con los 4 mensajes reales · _lib/explicarCanon.data.json, test · detecta 62 de 70 (R4); grep de los 4: 0
- [ ] H33 · 2026-10-09 · mediano · A17a · R6 §4 · instrucciones-log.sh en bash puro, sin sed/tr/head; partir de instr_rapido.sh del scratchpad r6 y copiarlo al repo antes de que se limpie · .claude/hooks/instrucciones-log.sh, hooksVarios.test · 2.846 → 256 ms (R6); prototipo listado por S2
- [ ] H34 · 2026-10-09 · mediano · A17b · R6 §4 · dev-server-guard.sh reordenado (git diff antes que netstat), desde devserver_reordenado.sh de r6; esperar P11: si Fak lo saca, la fila se tacha · .claude/hooks/dev-server-guard.sh, test · 1.542 → 654 ms (R6)
- [ ] H35 · 2026-10-09 · mediano · A17c · R6 §4 · pregunta-guard.sh sin $(cat) ni tubería · .claude/hooks/pregunta-guard.sh, test · 876 → 265 ms (R6)
- [ ] H36 · 2026-10-09 · mediano · A17d · R6 §5 · textos con camino en escritorio, secretos, firma-ia, coordinador y «guardián caído», sin cambiar la lógica; secretos-guard no recomienda ls -la con head mientras P12 siga abierta · guardianes.mjs, coordinadorGuard.mjs, _dispatcher.sh · guardianes.mjs:267-268; R6 §3: 6 de 6
- [ ] H37 · 2026-10-09 · chico · A31a · R6 §0.6 · investigar los 194 casos en que el despachador no corrió (código 127) y la llamada pasó igual · solo lectura · R6: sesión 7bfdafdb del 08/10 12:32-12:39, todas en 127; de esto dependen P30, P31 y X27
- [ ] H38 · 2026-10-09 · mediano · A31b · R6 B10 · el cierre avisa «N llamadas pasaron sin guardianes» · _lib/cierreGuard.mjs, test · (sin evidencia propia: lo afirma R6)
- [ ] H39 · 2026-10-09 · mediano · A22a · R1 · hooks StopFailure y SessionEnd que anotan en .claude/state por qué murió un turno (anotan, no frenan) · .claude/settings.json del repo (versionado, S2), hook nuevo, hooksTienenTest · usamos 7 de 33 eventos (R1)
- [ ] H40 · 2026-10-09 · mediano · A22b · R2 #4 · aviso de versión mínima 2.1.293 en _nube.mjs --sincronizar para las PC de Fak; el de las PC por área va en S2-8 · _nube.mjs, test · R2 #4; en _nube.mjs no hay chequeo de versión (grep, S2)
- [ ] H42 · 2026-10-09 · mediano · A19b · R7 §4 · buscar chequeo_centrado.py, cajetin.py y medir.py, también por nombre en la biblioteca de Ingeniería (listar no hidrata); si no aparecen, corregir los tres «graduado a X» de LECCIONES · docs/LECCIONES_APRENDIDAS.md · ninguno está en el repo (find 09/10); mediano por S2
- [ ] H43 · 2026-10-09 · chico · A20 · R7 §3 · test de paridad de nivelPorCriterio y esSinMarca entre amfeValidator.mjs y specialChars.ts en la grilla S 1-10 × O 1-10 · __tests__/scripts/ (archivo nuevo) · hoy cada test prueba solo su propia copia (leído)
- [ ] H44 · 2026-10-09 · chico · A23 · R1, R7 §4 · acortar los ganchos de MEMORY.md sin borrar punteros (_cerebroLint.mjs); sin apuro · memory/MEMORY.md del proyecto · 21.056 de 25.000 caracteres y 109 de 200 líneas (armar.mjs:133-134, S2)
- [ ] H45 · 2026-10-09 · chico · A24a · R1 · correr claude plugin validate . (gratis, solo lectura) · — · (sin evidencia propia: lo afirma R1); el subcomando existe (--help, S2)
- [ ] H46 · 2026-10-09 · mediano · A29 · R4 #5, F1 S9 · una línea dentro de las primeras 200 de CLAUDE.md: abrir con _abrir.mjs, no decir «abierto» si sale NO SE VE ABIERTO, borrador visible con _prepararMail.py · CLAUDE.md · 15 quejas en Antigravity (R4); Antigravity lee las líneas 1-200 de CLAUDE.md (S2)
- [ ] H47 · 2026-10-09 · mediano · A30 · R8 §4 · copiar a nuestros tests los casos de bypass de los tests de cc-safety-net, sin instalarlo; lo que pase de largo queda como caso pendiente y su arreglo es una fila nueva · tests *Guard* · git-deploy.md; 8 bypasses del arb-cerrar
- [ ] H48 · 2026-10-09 · mediano · A44a · F1 S4 · --simular de la carpeta única CLAUDE BARACK\: lista qué movería y qué programas buscan por nombre, sin mover nada; listar solo metadatos (find -printf), nunca du ni grep -r · _nube.mjs o un script nuevo, test · F1 S4; feedback_no_scan_onedrive:38
- [ ] H49 · 2026-10-09 · mediano · A52a · F1 A52 · cerrar los huecos del detector de firma: C2PA, PptxGenJS y zips; firmaIASelftest en cada cambio · _sinFirmaIA.py, firmaIA.data.json, tests · memoria project_firma_ia_pendientes
- [ ] H50 · 2026-10-09 · chico · A52b · F1 A52 · pasar el detector, solo leyendo, por exports/ y el repo; lo que aparezca se le muestra a Fak y no se corrige solo · — · project_firma_ia_pendientes; chico por S2
- [ ] H51 · 2026-10-09 · mediano · R4 #10 · video-maquina-guard avisa, sin frenar, si el espacio libre no alcanza para la copia más 5 GB; medir antes cuánto suma por cada Bash · _lib/guardianes.mjs, test · R4 C14; C: quedó en 21 MB (LECCIONES 30/09); ~700 ms por hook (reference_hooks_costo)
- [ ] H52 · 2026-10-09 · mediano · F1 O9 · aviso, sin freno, en el control de voz de _mailEnviar.py por el «¿» de apertura en mails y documentos en la voz de Fak; explicar-mejor no se toca · _mailEnviar.py, test · Fak 05/10 11:57 *"en las preguntas no pongas 2 ?, solo al final"*; alcance resuelto por S2
- [ ] H53 · 2026-10-09 · mediano · cola · el export Excel del Plan de Control saca «OP » antes del parseInt, con test de «OP 10» y npm run build · modules/controlPlan/controlPlanExcelExport.ts:369-371, su test · parseInt('OP 10') da NaN; mediano y sin apuro (S2: los PC salen por otro camino, f4f1ffe7)

- [ ] H55 · 2026-10-09 · chico · R7 §3 · documentar _xlsxCorregirTexto.py y _xlsxRenombrarHojas.py en una memoria de referencia · memoria · git grep: 0 referencias (R7)
- [ ] H56 · 2026-10-09 · chico · F1 O15 · averiguar por qué ingenieria@barackmercosul.com no aparece en _mails.py --buzones (mirar en Outlook si es casilla de Fak) y, si lo es, hacer que suba · _mails.py · Fak 08/10 14:23; S2: f.santoro@ y calidad@ suben, ingenieria@ no
- [ ] H58 · 2026-10-09 · chico · D1 #5 · revisar en su listado que el AMFE del 174 diga Rev. A (el 160 ya figura en Rev. A, S2) · solo lectura · 58f2fa33, 37f9d0ec
- [ ] H59 · 2026-10-09 · chico · R8 §2 · instalar.ps1 y desinstalar.ps1 sacan la carpeta de la memoria de -CarpetaBarack, en vez de dejarla fija en C--ClaudeBarack; va antes de P58 · tools/claude-area/persona/instalar.ps1:21,68, desinstalar.ps1:63 · S2: con otra carpeta, la memoria queda huérfana
- [ ] H60 · 2026-10-09 · mediano · R3 §1(3) · limpieza mensual de contexto: las propuestas de skills miran qué se repite en CLAUDE.md, LECCIONES y las reglas fijas; va después de H15 · _lib/propuestasSkills.mjs o un paso nuevo · grep «higiene»: 0; R3: ~$1 por mes
- [ ] H61 · 2026-10-08 · chico · A50 · F1 S11 · la lectura de novedades avisa cuando Claude Motion llegue a Max · _lib/novedadesClaude.data.json · Fak 08/10 20:51 *"si Motion está disponible de ahora en más a veces lo vamos a usar"*
- [ ] H62 · 2026-10-09 · chico · A53 · F1 O10 · memoria de referencia con los errores de la app y la CLI (login, «no me deja escribir», «No se pudo iniciar la tarea sugerida» ×6) y cómo se salió de cada uno · memoria nueva · 01/10 16:31; 05/10 10:46 y 13:35
- [ ] P43 · 2026-10-09 · chico · R1, F1 O7 · correr claude agents una vez, contar qué muestra y ver si --json le sirve a _colgados.mjs · solo lectura · Fak 05/10 11:03 *"¿cómo veo qué están haciendo los subagentes?"*; existe en 2.1.293 (S2)
- [ ] P45 · 2026-10-09 · chico · A42a · R7 · mover scripts/hotmelt/_test_com.py (Quit() pelado a PowerPoint) a scripts/_archive/, sin borrarlo · scripts/hotmelt/ · rompe powerpointQuit.test (R7); no está versionado y quedó de una sesión del 29/09 (S2)
- [ ] S2-1 · 2026-10-09 · chico · R3 §4 + 62f0ae43 · _claude.mjs --check avisa si BARACK_API_CICLO_DIA de usuario difiere de la del proceso · _claude.mjs, test · --check 15:22: usuario 30, la sesión la ve vacía y dice «día 1» (S2); con HOY-2 la fila se achica
- [ ] S2-2 · 2026-10-09 · chico · F1 O4, O5 · leer qué se contestó en 523e8e4a (01/10 *"investigá con un Fable qué pudo haber fallado"*) y en c66e2969 (04/10: 4,7 GB temporales, Word y Excel sin Python); después cerrar o abrir fila · solo lectura · S1 E19
- [ ] S2-3 · 2026-10-09 · chico · D1 #1 · test en seco, con un Inspector falso, del cierre de la ventana del borrador; la prueba real con Fak queda en P81 · tests de _mailEnviar · _mailEnviar.py:326-336: el cierre solo corre adentro de if a.enviar
- [ ] S2-4 · 2026-10-09 · chico · R1, R2 #9 (parte de P8) · leer skillUsage de ~/.claude.json, correr claude doctor y medir con get_usage si el asesor Opus vale lo que cuesta · solo lectura · skillUsage tiene 55 claves y claude doctor existe (S2); no se sabe si se ven los tokens del asesor (E21)
- [ ] HOY-1 · 2026-10-09 · mediano · yo, tarde · --pegar-clave detecta que corre adentro de la app (por la variable de Claude Code o porque no hay escritorio interactivo) y pide la clave por la terminal con asteriscos (Read-Host -AsSecureString); test de la escritura con clavePrueba · _claude.mjs, __tests__, reference_api_claude_clave_y_ciclo · cuadro invisible 14:40-14:50
- [ ] HOY-2 · 2026-10-09 · chico · yo, tarde · cicloDia(), el presupuesto y el tope por corrida leen también .env.local con leerEnv() (el entorno gana), con test · _lib/claudeApi.mjs, test · las BARACK_API_* solo se leen de process.env: el día 30 quedó con setx y no viaja con el archivo

## PROPONER A FAK (una lista para contestar sí o no por renglón)

### Solo vos

- [ ] P4 · sin código · F1 §6 #8 · techo de cupo semanal para las noches solas y techo del ciclo de la API (hoy $170 de 200, lo puso una sesión) · — · Fak 04/10 *"podés llegar hasta el 70 %"*; api-claude.md:71 (S2) · **Que diga los dos números; hasta medir una semana uso su 70 %.** (HOY-5: sigue abierta) · **Fak 09/10 16:25: «no pongas techo de gasto a la API en esta sesión»** (la API sin techo; el del cupo semanal del plan sigue sin número) · **Fak 09/10 16:55**: *"sin techo por ahora"* (ni semanal para las noches solas ni para la API en esta tanda)
- [ ] P8 · sin código · A24b · R1, R2 #9 · tipear una vez /skill-doctor y /doctor prompt-audit: la sesión no puede hacerlo, el resto de P8 va en S2-4 · — · nunca se tipearon en 20 transcripts (S2) · **Sí: son dos renglones y me dicen qué skills sobran.** · **Fak 09/10 16:55**: SÍ, *"decime cuándo querés que lo ejecute y lo hago"*
- [ ] P40 · chico · A43f · R1, R8 · autoMode.environment en la CATA y en la PC de Pedro (/auto-mode-setup) · ~/.claude/settings.json de cada PC · freno del IMDS en la CATA (plan §1.6) · **Sí, en cada PC con Fak al lado.** · **Fak 09/10 16:55**: SÍ, *"no es prioritario, la PC de Pedro la verdad... pero sí dale"*

- [ ] P47 · chico · A42c · R7 §3 · mover a scripts/_archive/ los 11 scripts de una sola vez sin referencia, extract_amfe.py y HANDOFF_PWA_2026-06-24.md · scripts/ · git grep: 0 (R7) · **Sí: nadie los usa y se pueden traer de vuelta.** · **Fak 09/10 16:55**: SÍ

- [ ] P50 · sin código · R7 §3 · pantallas sin terminar («Implement via backend») de Solicitud, Manuales y Formatos · modules/solicitud, modules/engineering · 27 marcadores; la app las carga (R7) · **Que diga si esos módulos siguen vivos: sacar una función se pregunta.** · **Fak 09/10 16:55**: *"no sé, decidilo vos"* → lo decido con evidencia (uso real y datos de esos módulos); si no tienen ni datos ni uso, se sacan
- [ ] P53 · mediano (la regla, después) · A33 · F1 O14 · cuándo sube la letra de un documento APQP · — · 09/10 09:25 *"no nos delates... mantené la revisión A"* · **Que le escriba a la sesión que espera; la regla dura sale de su respuesta.** · **Fak 09/10 16:55**: idem P66, espera
- [ ] P54 · sin código · A34 · F1 O1 · manual de AMFE con fotos: cuándo va SC y cuándo CC · biblioteca de Ingeniería · pedido del 01/10 12:58 · **Después de P6; que diga cuándo.** · **Fak 09/10 16:55**: idem P66, espera (tareas de Barack después del código)
- [ ] P55 · grande · A35 · F1 O2 · que los AMFE no dependan de Supabase · — · Fak 01/10 08:56 · **Primero investigar qué problema resuelve (project_datos_amfe_en_la_nube), sin tocar nada.** · **Fak 09/10 16:55**: *"apruebo totalmente, es algo grave, quiero que estén en otro lugar, en la nube, así todos pueden hacer los AMFE"* → SÍ, PRIORIDAD ALTA entre las grandes: investigación + plan
- [ ] P58 · mediano · A46 · F1 S6 · Pedro: correr el instalador y revisar qué le quedó · tools/claude-area/persona/ · (sin evidencia propia: lo afirma F1 S6) · **Que Fak lo corra después de H59.** · **Fak 09/10 16:55**: *"no lo sé, depende de él, le dejé un pendrive"* → espera a Pedro
- [ ] P60 · sin código · A52c · F1 A52 · imágenes con credencial de IA en documentos ya hechos · — · project_firma_ia_pendientes · **Las decide Fak una por una.** · **Fak 09/10 16:55**: idem P66, espera
- [ ] P64 · sin código · R5 §3.1 · arb-operar: la sección «Seguridad» de agosto contradice la cabecera · skill arb-operar · líneas 605-606 contra 19 y 26-27 (R5) · **Que diga cuál vale; propongo la cabecera, que es la del 05/10.** · **Fak 09/10 16:55**: *"ni puta idea, pensalo vos"* → decido: vale la cabecera del 05/10; se borra la sección de agosto y se prueba con una fila
- [ ] P66 · sin código · R5 §3.4 · imprimir:50, flujograma A3: propuesta B o D · skill imprimir · sin elegir (R5) · **Que elija Fak.** · **Fak 09/10 16:55**: *"todo lo que es tareas lo vemos después; primero hacer que las tareas se hagan bien... primero quiero hacer lo del código"* → espera
- [ ] P69 · mediano · R3 G · clasificar el historial de mails con Haiku · — · 5.941 mails; manda cuerpos de terceros a la API (R3) · **Que decida Fak: son datos de terceros.** · **Fak 09/10 16:55**: *"si creés que es lo mejor, hacelo"* → SÍ, baja prioridad y solo etiquetas (los cuerpos de terceros van a la API: decidido por él)
- [ ] P81 · chico · A12 · D1 #1 · probar el cierre de la ventana del borrador con un borrador de prueba abierto y Fak al lado · — · solo cierra con --enviar: la prueba puede terminar en un mail enviado (_mailEnviar.py:326) · **Primero S2-3; después, un borrador a su propia casilla con --sin-gerente autorizado por él, y que lo mire antes.**
- [ ] S2-5 · sin código · F1 §6 #5, S6 · CATA: doble clic en Instalar-Mi-PC.cmd (y ahí la regla autoMode.allow) · — · F1 S6: «falta que Fak lo corra en CATA» · **Sí, la próxima vez que esté en la CATA, junto con P40.** · **Fak 09/10 16:55**: *"cuando vos me digas, el martes"* (14/10; el lunes 13 es feriado)
- [ ] S2-6 · sin código · F1 O12 · Fak 06/10 16:23 *"cargar en la nube información encriptada que puedan utilizar"* · — · sin fila en S1, solo en E19 · **Que diga qué quiso pedir; si otra sesión ya lo contestó, se descarta.**
- [ ] S2-7 · sin código · R3 §1(5) (parte de P3) · cada mes, comparar el registro local de gasto de la API con la Consola · — · P3 pasó a Hechos y queda esto (S2) · **Sí, un vistazo por mes: es la única forma de saber que el registro no se desvía.**

### Tu sí

- [ ] P5 · mediano · A2b · F1 A2 · agentes-guard.sh pregunta «¿esto es buscar o decidir?» cuando un Sonnet lleva un pedido de búsqueda · ~/.claude/hooks/agentes-guard.sh y su copia en el repo · D1 #12; el número sale de H7 · **Sí, como aviso, si H7 muestra que muchas eran búsquedas.**
- [ ] P6 · grande · A11 · D1 #11 · skill planes-de-control con el formato actual de Calidad · .claude/skills/planes-de-control/ · Fak 09/10 *"no somos muy buenos haciéndolos"* · **Sí, la primera de las grandes: busco ya los planes de Cecilia en el servidor; el sí es al plan.** · **Fak 09/10 16:55**: SÍ, empezar la investigación en el servidor
- [ ] P9 · grande · A17e · R6 B2 · cierre-guard incremental: guarda por sesión hasta dónde leyó el transcript · _lib/cierreGuard.mjs · p90 de 18 s, máximo de 234 s, 3,9 h por mes (R6) · **Sí, con revisor: es lo que más se espera en cada turno.** · **Fak 09/10 16:55**: SÍ
- [ ] P10 · grande · R6 B3 · juntar los 4 hooks de UserPromptSubmit en un solo node, y el de cierre con el de hora · .claude/settings.json, hooks · 8 procesos por mensaje; 62 cancelados (R6) · **Sí, junto con P9: es el mismo trabajo y los mismos tests.** · **Fak 09/10 16:55**: SÍ
- [ ] P11 · mediano · R6 B4 · sacar dev-server-guard · .claude/settings.json, hook · 4 de 4 falsos en septiembre; p90 de 10,9 s (R6) · **Sí; contestala antes de H34, así no se gasta en reordenarlo.** · **Fak 09/10 16:55**: SÍ
- [ ] P14 · mediano · A41c · R6 §4A · arb-cerrar: no frenar tests ni documentación que nombran taskkill; un taskkill real al arb sigue frenando · guardianes.mjs, test · 9 de 10 falsos (R6) · **Sí; es regla dura de Fak: la prueba la hace otro.** · **Fak 09/10 16:55**: SÍ (tanda P12-P22)
- [ ] P15 · mediano · A41d · R6 §4A · mail-guard: lo mismo con tests y documentación que nombran .Send() · guardianes.mjs, test · 10 de 10 eran tests, demos o el propio guardián (R6) · **Sí, probado por otro.** · **Fak 09/10 16:55**: SÍ (tanda P12-P22)
- [ ] P16 · mediano · A41e + A21a · R7 §6, R6 · firma-ia: Add( sin distinguir mayúsculas, el nombre CLAUDE.md y la carpeta «Claude Fak» no cuentan como firma · guardianes.mjs:355, test · FIRMA_PREFIJO_RE con bandera i; R6: 3 de 6 falsos · **Sí, probado por otro; el gemelo rojo sigue frenando una celda que diga «Claude».** · **Fak 09/10 16:55**: SÍ (tanda P12-P22)
- [ ] P18 · mediano · A41g · R6 §4A · borrado-masivo: mirar a qué apunta el borrado, no dónde vive el script · guardianes.mjs, test · 82 de 118 frenos eran un Write (R6) · **Sí, con la versión segura de R6: nada de exentar por carpeta, que es lo que protege los 942 archivos.** · **Fak 09/10 16:55**: SÍ (tanda P12-P22)
- [ ] P25 · mediano · A37b · R4 #6 · reglas allow para los permisos que se piden siempre (skill fewer-permission-prompts) · .claude/settings.json · 07/10 *"¿no alcanza con que yo te diga sí?"* · **Sí, con la lista revisada por otro porque afloja; la conducta va en H6.** · **Fak 09/10 16:55**: SÍ (*"apruebo"*)
- [ ] P28 · grande · A40 · R4 #2 · auditoría ciega con Opus antes de mostrar un xlsx, pptx, pdf o mail de Barack · — · 98 pedidos de «auditá con agentes» (R4) · **Sí, solo para lo que sale a un tercero: gasta cupo de Opus.** · **Fak 09/10 16:55**: SÍ
- [ ] P30 · grande · A31c · R6 B9 · guardianes que no se rompen mientras otra sesión los edita · _dispatcher.sh, guardianes.mjs · 14 bloqueos en el mes (R6) · **Sí, después de H37.** · **Fak 09/10 16:55**: SÍ (grandes, con revisor)
- [ ] P31 · grande · R6 B5 · despachador con node directo, sin bash · .claude/settings.json, _dispatcher.sh · de 1,2 a 12 h por mes, rango medido con la PC al 100 % (R6) · **Después de H37: se pierde el «si node murió, freno».** · **Fak 09/10 16:55**: SÍ (grandes, con revisor)
- [ ] P32 · grande · R1, R8 · guardianes que corrigen en vez de frenar (updatedInput, PermissionDenied con reintento) · guardianes · F1 Q6 *"no quiero bloqueantes, quiero soluciones"* · **Sí, como diseño de la auditoría de guardianes, empezando por el que más frena.** · **Fak 09/10 16:55**: SÍ (grandes, con revisor)
- [ ] P33 · grande · A2d · R8 · mod con agent.spawn y session.measure: pesar por precio y frenar por el cupo real, no por la ventana de 10 min · mod nuevo, ~/.claude · la ventana y el 40 no tienen fuente (techo-agentes.md) · **Sí, en la fase 4, con .catch para que un mod que falla se saltee.** · **Fak 09/10 16:55**: SÍ
- [ ] P34 · grande · R2 #6 · prueba de mods con un recordatorio que no frena (CC/SC, una vez por hora) · mod · 25,8 mil llamadas al despachador por mes (R2) · **Sí, antes de P33, para aprender el mecanismo con algo que no frena.** · **Fak 09/10 16:55**: SÍ
- [ ] P35 · grande · A25b · R1 · vigía con Monitor sobre _hilosAbiertos.mjs mientras dura la sesión · script + regla · F1 S7; Monitor no tiene caso anterior · **Sí, después de H2-H3.** · **Fak 09/10 16:55**: SÍ

- [ ] P38 · chico · A43d · R1 · askUserQuestionTimeout y autoContinueAtUsageLimit · ~/.claude/settings.json · 04/10: 55 minutos colgados esperando un cartel · **Sí al segundo; el primero nunca, por lo que el contrato marca «preguntar siempre».** · **Fak 09/10 16:55**: SÍ
- [ ] P39 · chico · A43e · R1 · Remote Control y aviso al teléfono cuando falta su respuesta · ~/.claude/settings.json · agentPushNotifEnabled ya está prendido (R1) · **Sí, probarlo una tarde.** · **Fak 09/10 16:55**: SÍ a Remote Control; *"lo del teléfono imposible, no tengo la cuenta en el teléfono ni planeo tenerla"* → sin aviso al teléfono
- [ ] P41 · mediano · A43j · R8 · hook PermissionRequest que, con una hora fijada, contesta «no hay nadie: anotalo en la lista» · hook · 04/10: 55 minutos (R8) · **Sí.** · **Fak 09/10 16:55**: SÍ (*"obvio que lo apruebo"*; preguntó qué carteles: los de permiso de la app cuando no está)

- [ ] P52 · mediano · A32 · F1 O11 · reporte automático hacia Fak de lo «grave» del asistente por área · tools/claude-area/vigia.mjs · Fak 06/10 *"debería enviarte un reporte"* · **Primero me fijo si ya existe; si no existe, sí.**
- [ ] P56 · grande · A44b · F1 S4 · mover lo de Claude a la carpeta única CLAUDE BARACK\ de la nube · _nube.mjs y los programas que buscan por nombre · ver H48 · **Sí, después de ver el --simular de H48.** · **Fak 09/10 16:55**: *"solucionalo vos, solo eso"* → SÍ al simulado y a mover (con el simulado mostrado antes)

- [ ] P59 · grande · A47 · plan §1.10 · podar lo que entra fijo en cada sesión (~36.000 tokens), midiendo antes y después; primeros cortes de R7 §4 (~11 KB) y las líneas que suman H5, H6, H8 y H46 · CLAUDE.md, LECCIONES, reglas · R7:174-176 · **Sí, con la medición a la vista y vuelta atrás por git.**
- [ ] P61 · grande · R5 §3.5 · skill mail, a partir de la del plugin por área y de mail-envio.md · .claude/skills/mail/ · 190 mensajes de Fak: el tema más frecuente (R5) · **Sí: de las nuevas, es la que más le cambia el día.** · **Fak 09/10 16:55**: SÍ (preguntó si ya existía una skill de mails: no, hay una regla y scripts)
- [ ] P67 · mediano · R5 §3.3 · fusionar injection-process y amfe-cookbook (con audit-amfe, fix-amfe-gaps y amfe-healer) en amfe-domain, y autocad-verificar en patrones-corte-plotter · skills · 0 cargas en 30 días (R5) · **Sí; los comandos quedan apagados si Fak no los escribe.**
- [ ] P70 · mediano · R3 H · revisión del cambio del día con refutador · — · $9 por mes (R3) · **Sí, cuando la noche ande una semana.** · **Fak 09/10 16:55**: *"gastos en API: si creés que es lo mejor, hacelo"* → SÍ
- [ ] P71 · mediano · R3 J · barrido profundo mensual con lo que sobra del ciclo (Opus, por lote) · — · $4-8 por mes (R3) · **Sí con Opus; Fable solo si él lo pide.** · **Fak 09/10 16:55**: SÍ (idem P70)
- [ ] P72 · grande · R2 #10, #11, R1, R8 · evals: casos con respuesta conocida para el refutador, claude plugin eval y skill-creator midiendo el disparo real · — · 40-50 % de falsos positivos (R2 #10) · **Sí, en la fase 3.** · **Fak 09/10 16:55**: SÍ (idem P70)
- [ ] P73 · sin código · R2 #18 · /code-review low antes del auditor · — · Boris 11/08 (R2) · **Probarlo en 3 tareas y medir si encuentra algo distinto.**
- [ ] P74 · grande · plan §1.5, R3 K · Managed Agents para la pre-auditoría · — · el plan los deja para la fase 3; R3 los descarta porque no ven Supabase · **Dejarlo para la fase 3, con una semana de costos de la noche.** · **Fak 09/10 16:55**: SÍ en fase 3 (idem P70)
- [ ] P75 · mediano · R8 §3 · método «ratchet» para las propuestas de la noche (dos jueces nuevos y vuelta atrás) · — · darwin-skill y autoresearch (R8) · **Sí, en la fase 3, sin instalar nada.**
- [ ] P76 · sin código · R8 §1 · una corrida de ccusage para validar _tokens.mjs · — · _tokens.mjs contaba 2,15 veces cada turno (R1) · **Sí, una vez (baja un paquete de terceros con npx).**
- [ ] P78 · sin código · R8 §4 · una pasada del revisor agnix sobre .claude/ y las skills · — · (sin evidencia propia: lo afirma R8) · **Sí, una vez y solo lectura.**
- [ ] P79 · mediano · A49 · F1 S12 · mods estéticos (barra de estado, colores): 3 buscados en GitHub, probados en Windows, con captura · ~/.claude/settings.json · Fak 08/10 *"dejalo anotado para alguna fase más final"* · **En la fase final.**
- [ ] P82 · mediano · A52b · F1 A52 · pasar el detector de firma por la nube de Ingeniería y el PPAP del servidor · — · abrir los archivos los hidrata; feedback_no_scan_onedrive pide confirmación · **Sí, de a una carpeta y mirando el disco.**

### Aviso

- [ ] P1 · mediano · A5 · F1 S3, S20 · --sincronizar sube el settings de la PC donde cambió y, al bajar, lo pasa por ajustar_settings.mjs, con test en las dos direcciones · _nube.mjs, ajustar_settings.mjs · 08/10 la CATA quedó sin asesor ni Opus · **Sí: ya lo pidió (*"yo me olvido"*); pregunto solo porque escribe el settings de la CATA.**
- [ ] P7 · chico · A7b · D1 #2 · copiar el logo oficial al paquete de Pedro (y al de la CATA si hace falta) · paquete por área · D1 #2 · **Sí para Pedro, con P58; la CATA probablemente ya lo tiene por OneDrive (sin verificar, E12).**
- [ ] P12 · mediano · A41a · R6 §3 · secretos-guard: ls, stat y test con head no cuentan como lectura del archivo; sigue frenando ls .env.local; cat .env.local · guardianes.mjs, test · 6 de 6 falsos; :267-268 · **Sí, probado por otro a ciegas en las dos direcciones; test -f sigue sin probar (E14).** · **Fak 09/10 16:55**: SÍ a toda la tanda P12-P22 (*"apruebo"*), probada por otro a ciegas
- [ ] P13 · mediano · A41b · R6 §3 · apqp-cliente: no frenar lecturas con openpyxl, copias al scratchpad ni un --apply que aparece dentro de un texto · guardianes.mjs, test · 5 de 5 falsos (es una muestra, no una tasa) · **Sí, juntando más casos antes.** · **Fak 09/10 16:55**: SÍ (tanda P12-P22)
- [ ] P17 · mediano · A41f · R6 §3 · documentacion-oficial: no frenar find, ls ni pdftotext sobre 4- MANUALES · guardianes.mjs, test · 6 de 6, probables falsos (R6) · **Sí.** · **Fak 09/10 16:55**: SÍ (tanda P12-P22)
- [ ] P19 · mediano · A41h · R6 B6 · script-inline: frenar solo arriba de 6.000 caracteres y avisar entre 3.000 y 6.000 · guardianes.mjs, test · 326 frenos, 254 por debajo de 6.000 (R6) · **Sí, pero con barras invertidas sigue frenando: el 85 % las lleva.** · **Fak 09/10 16:55**: SÍ (tanda P12-P22)
- [ ] P20 · mediano · A41i · R6 B1 · sacar timeout-guard de PostToolUse (o pasarlo al Stop) · .claude/settings.json · 51.800 corridas, 6 avisos (R6) · **Sí: un node menos en cada Bash.** · **Fak 09/10 16:55**: SÍ (tanda P12-P22)
- [ ] P21 · mediano · A17f · R6 §4A · file-guard: texto con camino, dejar pasar .env.example y un escape nuevo .archivo-protegido-ok · guardianes.mjs:217 · hoy dice solo «es archivo protegido» · **Sí al texto y a .env.example; no al escape: no hay caso que lo pida.** · **Fak 09/10 16:55**: SÍ (tanda P12-P22)
- [ ] P22 · mediano · A36 · R4, R6 B7 · coordinador-guard: aviso, sin freno, para los mensajes a main, a un subagente propio o las respuestas · _lib/coordinadorGuard.mjs · 05/10 frenó a 4 compañeros (F1 O8) · **Sí, probado por otro.** · **Fak 09/10 16:55**: SÍ (tanda P12-P22)
- [ ] P23 · mediano · R6 B7 · «archivos sin commitear» del cierre pasa a ser un aviso en el próximo mensaje · cierreGuard.mjs · 90 frenos; de 7 mirados, 4 eran de otra sesión (R6) · **Sí.**
- [ ] P24 · mediano · R6 B8 · _encargo.mjs ignora --apply o «push a main» cuando aparecen dentro de una prohibición («no uses…») · _encargo.mjs · 2 de 7 frenos muestreados (R6) · **Sí.**
- [ ] P27 · mediano · A39 · R4 C10 · álbumes que no son HO: no repetir fotos (hash perceptual) y verificar el rótulo de la pieza · — · 01/10 19:17-21:01 (F1) · **Sí, como aviso.**
- [ ] P29 · mediano · R4 #8 · vocabulario de planta también en mails, Excel y PowerPoint, como aviso · — · C09 y C12 (R4) · **Sí como aviso, calibrado antes contra los 935 mails de Fak.**
- [ ] P49 · chico · R7 §2 · testTimeout de 60_000 en los tests que fallan por carga en esta PC · escritorio, tizadaVsArbSelftest, mailsEquipo, cierreGuard* · en el CI pasan (R7) · **Sí: solo se afloja la tolerancia de tiempo.**
- [ ] P62 · mediano · R5 §3.1 · hojas-de-proceso: los GATES y el §7 quedan en el SKILL.md; §1-§6 y §7 bis pasan a reference/ · skill · 54,4 KB; se corta el 64 % (R5) · **Sí, después de H23.**
- [ ] P63 · mediano · R5 §3.1 · arb-operar: «Mapa de teclas» y «RECETA» (20 KB) pasan a reference/ · skill · los scripts ya hacen el tecleo (R5) · **Sí.**
- [ ] P65 · mediano · R5 §3.2 · cad-design y cad-3d.md: los gates en un solo lugar · skill + regla · hay dos numeraciones (R5) · **Sí.**
- [ ] P68 · mediano · R5 §3.3 · rule-enforcement-gate pasa a ser una regla con paths: .claude/rules/** · — · 2 cargas, la última el 31/08 (R5) · **Sí.**
- [ ] P80 · sin código · R1, R2 #14 · contarle, sin pedirle nada: /btw, Ctrl+X Ctrl+K y el cierre ordenado al llegar al límite de 5 h · — · (sin evidencia propia: lo afirman R1 y R2) · **Solo contarlo en la página.**

## DESCARTADO CON MOTIVO

- X59 · (era S2-8) A22b · R2 #4 (parte de H40) · **Fak 09/10 19:40**: *"descartamos actualizaciones automáticas con todos, ya fue, no lo dejes anotado"* (Pedro y Carlos siguen por pendrive)
- X58 · (era P57) A45 · F1 S3, S15 · **Fak 09/10 19:40**: *"descartamos actualizaciones automáticas con todos, ya fue, no lo dejes anotado"* (Pedro y Carlos siguen por pendrive)
- X57 · (era P77) Cowork para Carlos, Federico y Pedro · **Fak 09/10 16:55**: *"¿por qué haría eso?"*
- X56 · (era P2) usar el reinicio de límite semanal · Fak 09/10 16:3x: *"no lo tenemos, ya verifiqué en Uso"*
- X1 · síntesis Opus más revisor Fable (A3) · cumplida con S1 y S2; se cierra con esta cola
- X2 · requirements-ci.txt (A18) · las versiones ya están fijas en deploy.yml:78 desde 544508d2
- X3 · línea de /goal en la regla (A25a) · trabajar-hasta-la-hora.md ya nombra /goal; el otro uso lo tendría que tipear Fak
- X4 · estilo de salida «Proactive» (A43g) · CLAUDE.md y pregunta-guard ya cubren el «no preguntar»; cambia la voz sin evidencia de que mejore
- X5 · dictado /voice (A43h) · es para la terminal y VS Code, no para la app (R1); si llega a la app, entra por las novedades
- X6 · claude setup-token (A43i) · gasta el cupo del plan y rompe el candado 3 de la noche (fork bomb)
- X13 · «no entiendo por qué hablás de plan de control» (D1 #13) · no tiene arreglo propio: es evidencia para P59
- X14 · «¿son los últimos y únicos 2?» (D1 #15) · ya está en LECCIONES y en la memoria no_concluir_con_la_fuente_incompleta
- X15 · chequeo de firma antes de imprimir · ya hecho: fda8f920; el TBD va en P26
- X16 · pip del CI, .worktreeinclude, estado por AMFE, ciclo, candado 1, tope de $8, regla del asesor · ya hecho: 544508d2 (sumar esos programas a la noche es H15)
- X17 · firma-ia-guard, _tokens.mjs sin doble conteo, buscador con Haiku, --sincronizar · ya hecho: 5cb5a3bc
- X18 · omitClaudeMd en el buscador · hecho fuera de git: buscador.md lo tiene (S1 y S2 lo leyeron)
- X19 · asesor Opus y Opus por defecto · hecho fuera de git: settings.json:37 y :73
- X20 · maxTurns e isolation: worktree en los agentes · no hay un caso medido de un agente que diera vueltas
- X21 · disable-model-invocation en carga-arb, imprimir y ppap-motherson · Fak no escribe comandos (carga-arb se cargó sola 8 veces, R5); choca con «no preguntar, se hace»
- X22 · context: fork en docs-empresa y leer-planos · una carga cada una en 30 días; el guardián de agentes rechaza fork
- X23 · bloques !cmd en skills · _hilosAbiertos.mjs ya corre al arrancar; no hay skill donde sume
- X24 · deep links claude-cli:// · abren la terminal, no la app (R1)
- X25 · statusLine · la doc no confirma que la app la muestre (R1); lo estético va en P79
- X26 · fallbackModel, opusplan, fast mode, OpenTelemetry, routines, hooks http, claude -p, MCP propio, sandbox y otros de R1 · bajan de modelo sin avisar, rompen el caché, cuestan plata, no ven Y: o no existen en Windows (R1)
- X27 · onFailure: "block" · la opción llega en 2.1.295 y esta PC tiene 2.1.293 (S2); se reabre con H37
- X28 · next-steps y html-plan · choca con no llevar menús; explicar-mejor ya arma las páginas
- X29 · cierre ordenado al llegar al límite de 5 h · es automático; se le cuenta en P80
- X30 · request_keep_awake al fijar la hora · la notebook ya no se suspende (powercfg) y la herramienta suelta la PC a los ~5 min (R2)
- X31 · R2 #16, #19, #20, #22, #23, #24, #26 · ya lo arregló el arnés, se saltea los guardianes o no ve Y:, el arb ni Outlook (R2)
- X32 · bajar el piso de esfuerzo de explorador e investigador · regla de Fak del 30/09; no hay medición de que high rinda igual
- X33 · asesor en el refutador · más caro ($0,23 contra $0,18 por AMFE) y el registro no cuenta sus tokens (R3)
- X34 · lotes en la noche normal · dos esperas no entran en la hora; ahorra $6 por mes (R3); el lote va en P71
- X35 · pre-auditoría con la norma en contexto · copyright del manual SETEC y la regla «ninguna máquina propone S/O/D» (R3)
- X36 · Agent SDK, Dreams, búsqueda web, Files API, citations · lanza claude (fork bomb), es vista previa, cuesta $10 cada 1.000 o no tiene ZDR (R3)
- X37 · Playground · es informativo y nadie lo pidió
- X38 · detectores nuevos para R4 C02, C06, C07, C08, C17, C18 · los controles ya funcionan o es del plan; C06 se vuelve a medir
- X39 · hook en SendUserFile que reinyecta el pedido · su gemelo correccion-guard casi no movió C04; primero H30 y volver a medir
- X40 · carga-arb sin cambios; no retirar lamina-de-proceso, apqp-schema, informe-tryout, render-a-foto-real ni product-map · motivos de R5
- X41 · el chequeo 7 acepta una carga de explicar-mejor desde el último compactado · afloja el freno nacido del reclamo del 02/10; el ahorro es chico (R5)
- X42 · hook que registra cada carga de skill · repite lo que ya guarda skillUsage en ~/.claude.json
- X43 · skill de Office de la casa · R5 no midió cuánto se trabajó por COM
- X44 · SubagentStop que exige una cita ruta:línea · frenaría al subagente al devolver (*"no quiero bloqueantes"*)
- X45 · tiempo máximo de 10 s en UserPromptSubmit · se perdería el aviso de explicar-mejor; el campo no está verificado en 2.1.293
- X46 · updatedInput en commit-rutas · 7 frenos en 30 días; poco retorno (R6)
- X47 · servicio permanente; aflojar mails, arb, Supabase, nube, servidor y borrados · si se cae, se apagan los guardianes; es lo que Fak quiere frenado (R6)
- X48 · reintento automático de deploy-pages · 1 falla en 40 corridas; un reintento a ciegas tapa algo real (R7)
- X49 · juntar renglones de LECCIONES · ya hecho por f969043f; hoy 26.512 bytes, debajo del aviso
- X50 · sacar los prefijos de MEMORY.md; características especiales con paths: · rompe _cerebroLint; Fak la pidió «siempre» (11/09)
- X51 · claude-code-router, AgentGuard, claude-brain, marketplace, GitHub Actions y otros de R8 · intermediario, no mide tokens, reescribe la memoria o llega a todos sin prueba (R8)
- X52 · comparar el sync con la comunidad · lo hizo R8: coincide con PIEZAS de _nube.mjs
- X53 · sumar scheduled-tasks al sync · varias son personales: correrían en la CATA
- X54 · Plannotator · sin verificar en Windows; las páginas HTML ya cumplen (F1 Q8)
- X55 · lista de la tanda en JSON con campo «pasa» · los cortes fueron del despertador (H2); se revisa después de H2-H3
- H57 · verificar «un número por pieza» en hojas-de-proceso · ya está escrito (SKILL.md:552, S2); se pierde al compactar y eso lo arregla H23

## Hechos

- [x] P51 · chico · R7 §3 · pasar @anthropic-ai/sdk a devDependencies · package.json · lo usan dos scripts y no entra al bundle (R7) · **Sí: cambiar dependencias se confirma (contrato C).** · **Fak 09/10 16:55**: SÍ · **HECHO 09/10 16:55** · 59233299 (build verde)
- [x] P44 · chico · R6 §6 · limpiar .claude/settings.local.json (rutas de OneDrive y comandos viejos) · .claude/settings.local.json · (sin evidencia propia: lo afirma R6) · **Sí, con la lista a la vista.** · **Fak 09/10 16:55**: SÍ · **HECHO 09/10 16:53** · `.claude/settings.local.json` (ignorado por git): quedaron solo los 6 permisos de la extensión de Chrome y `skillOverrides`; los 13 comandos pegados se sacaron
- [x] P36 · chico · A43a · R1 · apagar CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS · ~/.claude/settings.json · prendido sin uso; un subagente con nombre arranca como compañero de equipo y gasta más (R1) · **Sí, apagarlo.** · **Fak 09/10 16:55**: *"si llegaste a la conclusión de que no los necesitamos, apagalo nomás"* → SÍ · **HECHO 09/10 16:50** en `~/.claude/settings.json` (fuera de git; respaldo `settings.json.antes-limpieza-20261009-1950`; verificado releyendo el archivo). Las sesiones nuevas lo toman; las abiertas no
- [x] P37 · chico · A43b · R2 #7 · plugin «You should know» · ~/.claude/settings.json · prendido (leído); lanza un agente lateral · **Apagarlo hasta medirlo con S2-4.** · **Fak 09/10 16:55**: SÍ (idem P36) · **HECHO 09/10 16:50** en `~/.claude/settings.json` (fuera de git; respaldo `settings.json.antes-limpieza-20261009-1950`; verificado releyendo el archivo). Las sesiones nuevas lo toman; las abiertas no
- [x] P42 · chico · R1 · fijar cleanupPeriodDays · ~/.claude/settings.json · los transcripts se borran a los 30 días y los informes leen desde el 01/09 (R1, R4) · **Sí; el número, según el disco.** · **Fak 09/10 16:55**: SÍ a los 90 días, y además *"subilas a la nube"*: los registros de conversaciones viajan a la nube de Ingeniería (fila HOY-6) · **HECHO 09/10 16:50** en `~/.claude/settings.json` (fuera de git; respaldo `settings.json.antes-limpieza-20261009-1950`; verificado releyendo el archivo). Las sesiones nuevas lo toman; las abiertas no. La subida de las conversaciones a la nube sigue en HOY-6
- [x] H41 · 2026-10-09 · mediano · A19a · R7 §3 · CLAUDE.md:140 pasa a apuntar a scripts/_archive/, y _cpTelasHiluxCorrecciones.mjs se muda de scripts/archive/ ahí · CLAUDE.md, scripts/archive/ · ed619533 (11:53) creó scripts/archive/; _archive/ tiene 307 archivos (S2) · **HECHO 09/10 16:36** · 173f051d (las sesiones abiertas siguen con el CLAUDE.md viejo: se reabren)
- [x] H54 · 2026-10-09 · chico · R7 §3 · sumar Microsoft/ (caché de PowerShell en la raíz) a .gitignore y averiguar qué test la crea · .gitignore · git status: ModuleAnalysisCache sin commitear · **HECHO 09/10 16:36** · 173f051d
- [x] P48 · chico · A42d · R2 #17, R7 · git worktree prune y borrar 11 worktrees viejos (898 MB) · .claude/worktrees/ · C: con 7,5 GB libres · **Sí, después de mirar get_storage_usage.** · **HECHO 09/10 16:35** (Fak: *"si no sirven para nada borralos"*): 11 worktrees borrados con git worktree remove; lo no guardado de dos (arbArticulos.py + test + patch; una página) rescatado a la nube, carpeta mía repo-privado/worktrees-rescate-2026-10-09
- [x] P46 · chico · A42b · R7 §3 · ordenar los sueltos de la raíz: STEP, PDF y PNG del carro y del dispositivo a su carpeta; amfe_head.txt se borra; generar_cuadro_hotpress.py va a scripts/hotmelt/ · raíz del repo · STEP de 14,8 MB suelto en un repo público (R7) · **Sí: su material se mueve, no se borra.** · **HECHO 09/10 16:35** (Fak: *"todas las mierdas no aprobadas subilas a la nube"*): los 9 sueltos de la raíz en la nube de Ingeniería, carpeta mía no-aprobado-2026-10-09; generar_cuadro_hotpress.py a scripts/hotmelt/ (sin versionar)
- [x] X7 · 2026-10-09 · mediano · yo · ~~_cierreSesion.mjs lee el último run del CI y dice «no pude leer» si no contesta~~ · 0243035c
- [x] X8 · 2026-10-09 · mediano · Fak (09:29) · ~~_mailEnviar.py cierra la ventana del borrador antes de los controles, y solo la de ese borrador~~ · 2c2374dd, 58309048 (la prueba queda en S2-3 y P81)
- [x] X9 · 2026-10-09 · chico · yo · ~~skills: explicar-mejor, escalón 3 (ruta y captura; lo de otra área va como pregunta), y ficha de proveedor por material (D1 #6, #7, #14)~~ · 8e523620
- [x] X10 · 2026-10-09 · chico · yo · ~~ejemplo en mail-envio.md de qué pregunta va en un mail a Calidad y cuál no (D1 #10)~~ · 8e523620
- [x] X11 · 2026-10-09 · mediano · Fak · ~~regla del logo único y de imágenes no generadas (core-prohibiciones §9, D1 #2-#3); el control va en H9-H10~~ · f969043f
- [x] X12 · 2026-10-09 · chico · Fak · ~~160 y 174 en Rev. A (D1 #5); el listado del 174 va en H58~~ · 58f2fa33, 37f9d0ec
- [x] HOY-3 · 2026-10-09 · chico · Fak · ~~"en todas las tareas que puedas usá la API": scripts/_apiTarea.mjs, el puente pedido + adjuntos -> API -> archivo, con candados (ni secretos ni más de 2 MB) y 8 tests~~ · e79715c4 + 82939e7a (timeout) + 8a3638b1 (streaming) + 2fd31a24 (sin fallback)
- [x] HOY-4 · 2026-10-09 · Fak · ~~(era P3) la clave de la API pegada (por la terminal), --check y --probar verdes, primera noche real de día ($0,98: 6 AMFE, 12 mails, prioridades, novedades) y la tarea "Barack - Noche de Claude (API)" agendada a las 06:30; el ciclo renueva el 30 (BARACK_API_CICLO_DIA=30 como variable de usuario)~~ · commit 62f0ae43 (regla api-claude.md)

<!-- control: HACER YA 68 · PROPONER 71 · DESCARTADO 54 · HECHOS 17 · origen S1 09/10 + S2 09/10 -->
