# Auditoria de las tandas 1.3 y 1.4 del plan del sistema (16/10/2026)

Auditor Opus, subagente de la sesion `b4cbe5c6`, en el worktree `memoria-maquinas-1016` (rama
`claude/memoria-maquinas-1016`). Lo pedido: `docs/PLAN_MEMORIA_Y_MAQUINAS_2026-10-16.md`. Lo hecho: los commits
`d11dd83c..e11d9cf9` (6) y, fuera del repo, la memoria de `~/.claude/projects/C--Dev-BarackMercosul/memory/`.
Cada hallazgo dice como se comprobo. Clases: **ERROR REAL** (no cumple lo pedido, comprobado),
**ROBUSTEZ** (anda hoy, pero puede fallar o confundir), **FALSO POSITIVO** (parecia un error y no lo es).

## Veredicto: APROBADO CON CONDICIONES

Las condiciones son tres:
1. Arreglar ER-1 (el mod toma como de Fak los encargos de otras sesiones) y volver a instalar el mod.
2. Arreglar ER-2 (la pagina de temas dice «hecho» de temas con pendientes y lista como pendiente lo que no falta).
3. Mergear el canon a `main` y mirar el registro del mod. Hasta hoy el mod no aviso nunca por el camino real (R-1).

## Lo que se corrio

| Chequeo | Resultado |
|---|---|
| `npx vitest run --pool=threads __tests__/mods/recordatorio-temas.test.mjs` | 31 de 31 en verde |
| `claude plugin test mods/recordatorio-temas` (claude 2.1.301) | 5 de 5 en verde |
| Suite del paso 7 (`__tests__/mods`, modsInstalar, compactacionRegistro, temasAbiertos, hooksTienenTest, hooksVarios, cerebroLint, probarMejora) | **11 archivos, 281 tests, todos en verde** (66 s) |
| `npx tsc --noEmit` | 0 errores |
| `npm run build` | OK (1 min 36 s) |
| `node scripts/_modsInstalar.mjs --estado` | los 3 mods instalados y activos, copia del marketplace y cache iguales a la rama |
| `node scripts/_cerebroLint.mjs` | 469 memorias; MEMORY.md 23,0 KB / 102 renglones; 4 rotos, todos previos a la tanda (FP-6). Al volver a correrlo despues de las correcciones dio 5: el quinto es `reference_canal_entre_pcs_pedidos_facundo.md` → `scripts/_lib/pedidosPendientes.mjs`. Ese archivo lo edito otra sesion a las 20:37, y el script existe en el checkout principal sin commitear: no es de esta tanda ni de esta auditoria |
| `.claude/settings.json` | JSON valido; existen todos los `.sh` que cablea; `PostCompact` existe en 2.1.301 (lista de eventos del binario) |
| git | arbol limpio; 6 commits sobre `origin/main`, sin push a proposito |
| CI | ultimo run: `main` 0e420aea `completed success`; la rama no se pusheo, asi que su CI no corrio |
| `npm ls --depth=0` | 94 «UNMET»: el worktree resuelve los paquetes de `C:\Dev\BarackMercosul\node_modules`. No es de la tanda: no toca `package.json` (FP-10) |

---

## 1. Mod `recordatorio-temas`

### ER-1 — ERROR REAL: el origen `sdk` pasa como si fuera Fak, y por ahi entran los encargos de otras sesiones
- **Donde:**
  - `mods/recordatorio-temas/hooks/temas.mjs:4-11` (la lista deja pasar `composer`, `bridge`, `sdk`, `unclassified`).
  - `mods/recordatorio-temas/README.md:10` (promete: «El encargo de una sesion madre ... no es una pregunta de Fak»).
- **Como se comprobo.** Se cruzaron el registro real del mod (`~/.claude/mods-log/recordatorio-temas.log`, 42 renglones del 16/10) y los transcripts, por la hora al milisegundo.
  - Los 7 `origen=composer` que se cruzaron son mensajes de Fak con `origin.kind: human`: 19:17:28, 19:29:26, 19:29:50, 19:43:35, 19:48:04, 19:49:42 y 19:50:49Z.
  - Los 5 `origen=sdk` NO son de Fak:
    - 19:15:17 y 19:49:12, transcript `ce4a3186`: «The session "triangulito-v3" you started ... finished a turn. It reported ...», el informe de una hija.
    - 19:27:33 y 23:12:23, worktree `impresora-tanda17`: `<cross-session-message from="local_85a1888f..." name="Plan sistema implementación 2026">[ENCARGO E261016-33f0] PARA: Impresora A2L ...`, el encargo de la madre.
    - 23:07:40, transcript `34df5f0e`: «The context window filled up ... Please continue from where you left off.», el aviso de continuacion despues de compactar.
- **Que pasa.** Con esos textos y `origin: {kind:'sdk'}`, `decidir()` devuelve `deFak: true` y saca renglones:
  - el encargo trae `impresora` e `impresora-3d`;
  - el informe de la hija trae `hot-press` (por la palabra «triangulito»).

  Hoy no se vio porque esas sesiones no tenian el canon («sin canon»). Con el canon en `main`, pasa.
- **Por que agregar `sdk` no pierde mensajes de Fak.** En el binario 2.1.301, la funcion que traduce el origen para los mods hace esto:
  - `human` pasa a `composer` (o a `bridge`);
  - un mensaje sin origen pasa a `sdk` solo si `promptSource === 'sdk'`;
  - lo tipeado o encolado sin origen pasa a `unclassified`.

  Lo que Fak escribe nunca sale como `sdk`.
- **Arreglo propuesto (lo aplica quien lanzo la auditoria):**
  - Agregar `'sdk'` a `ORIGENES_QUE_NO_SON_FAK`. `unclassified` tiene que seguir pasando.
  - Corregir el comentario de `temas.mjs:4-7` y el README:10: medido el 16/10, Fak = `composer`, y `sdk` = encargos, informes de hijas y la continuacion despues de compactar.
  - Test en las dos direcciones, con los dos textos reales de arriba:
    - en vitest, `kind:'sdk'` → nada;
    - en vitest, `composer` y `unclassified` con el mismo texto → renglon;
    - en `tests/recordatorio-temas.test.ts`, sumar `'sdk'` al bucle de `task-notification`/`peer`.
  - Despues, `node scripts/_modsInstalar.mjs --aplicar`. Si no, la copia instalada sigue con el error.

### Prueba con mensajes reales de Fak (pedido del punto 1)
- **Muestra.** `temasDelTexto()` se corrio sobre **264 mensajes `origin.kind: human`** de 30 transcripts del 13 al 16/10. Los transcripts se eligieron con `grep -l`; los recorrio un script del scratchpad.
- **Resultado:** 26 mensajes con tema, y en los **26 el destino es correcto**. No hubo ningun falso positivo de destino.
- **Detalle de los 26:**
  - plotter: 6 (4 generico, 2 «plotter de corte»);
  - tornillo/tuerca: 6;
  - costura CNC: 5;
  - impresora 3D o generica: 10 (la de Fak del 13/10 en adelante);
  - hot press: 1;
  - hotmelt: 1;
  - plan del sistema: 2 («plan del sistema», «carpeta viernes 17»).

  Algunos mensajes traen mas de un tema. Se revisaron uno por uno los 3 dudosos (9fd75017 14:23 y 17:06, 34df5f0e 16:00): la palabra que disparo esta en el texto y es del tema.
- **Las frases cortas del canon** («aol», «pla», «8d», «tornillo», «sika», «impresora») no dieron ningun falso positivo en la muestra. Con frases armadas se ven tres riesgos de destino (R-3).
- **Lo que sobra:** en 7 de los 26 sale tambien el tema generico («impresora» o «plotter») junto al especifico (R-2).
- **Lo que falta:** los tipeos reales no se reconocen (R-5).

### ROBUSTEZ del mod
- **R-1. El mod nunca aviso por el camino real.**
  - El registro tiene 0 renglones `AVISO`: los 15 mensajes de Fak del 16/10 dieron «sin canon en C:/Dev/BarackMercosul/scripts/_lib/temasCanon.data.json». El canon existe solo en esta rama (`git show main:scripts/_lib/temasCanon.data.json` → no existe).
  - El mod esta instalado para todas las sesiones desde la rama.
  - `_probarMejora.mjs` corre los hooks de `settings.json`, no los mods (`grep -n mod scripts/_lib/probarMejora.mjs` no encuentra nada de mods). La prueba `--espera` del plan no puede validar este mod: quedo cubierta con vitest y `claude plugin test`.
  - Condicion: despues del merge, mirar que el registro tenga `AVISO`. Si la rama se descarta: `claude plugin disable recordatorio-temas@mods-casa`.
- **R-2. El tema generico sale junto al especifico.**
  - Que pasa (`temas.mjs:46-55`):
    - «mandalo a la impresora 3d» saca `impresora-3d` e `impresora`;
    - «la impresora de arriba» saca `impresoras-ricoh` e `impresora`.
  - El renglon generico dice «hay dos clases ... confirmar cual» cuando Fak ya dijo cual. Gasta uno de los 3 lugares por mensaje.
  - Arreglo: no sacar el generico cuando todas sus frases encontradas estan adentro de una frase encontrada de otro tema. Test: «mandalo a la impresora 3d» trae solo `impresora-3d`.
- **R-3. Frases que llevan a otra memoria (`scripts/_lib/temasCanon.data.json`).**
  - `"8d"` (renglon 97) lleva siempre al 8D de la tapa Amarok. En la memoria hay otros 8D (agujas de fieltro PWA en `project_reclamo_agujas_fieltro_pwa`, exceso de primer en `project_ppap_p21_hilo_naranja_my2026`, cortes fuera de especificacion en `project_estudio_agujero_insert_patagonia`). Ejemplo: «el 8D de las agujas del fieltro de PWA» lleva a la tapa Amarok. Cambiarlo por «8d de la tapa», «8d tapa» y «8d amarok»; el test DIEZ sigue en verde.
  - `"plan de reaccion"` (renglon 127) lleva a las hojas de proceso, y en un Plan de Control es otra cosa. Ejemplo: «revisa el plan de reaccion del plan de control» lleva a HO.
  - `"tornillo"` suelto: «ponele un tornillo M6 al soporte» lleva al tornillo de la costura CNC. En la muestra, los 6 casos de tornillo eran el de la costura: se puede dejar.
- **R-4. «triangulito» apunta mal.** Lleva solo a la ficha de la hot press (canon, renglon 61). La memoria viva del triangulito es `project_triangulito_hot_press_insert.md`, y `MEMORY.md` nombra las dos. Sumarla a `archivos`.
- **R-5. Tipeos reales sin cubrir:**
  - «tpornillo» (16/10 19:29:50) y «tiornillo» (16/10 14:13);
  - «tonriullos» y «tonriloos» (14/10 11:51);
  - «impresiona» (16/10 16:02);
  - «hotpreess» (15/10 13:47);
  - «mauqina cnc» (15/10 18:10).

  Por palabra entera no se pueden agarrar todos. Se pueden sumar los que se repiten, o aceptar distancia 1 en palabras de 6 letras o mas, con un test que confirme que «plan» y «plano» no son «pla».
- **R-6. Faltan datos en el registro.** Los renglones «no es de Fak» y «sin canon» no llevan `sesion=` (`register.js:48` y `:55`). Para esta auditoria hubo que cruzar por la hora.
- **R-7. `--estado` no muestra el registro de este mod.** Solo muestra los del presupuesto y el tablero (`scripts/_modsInstalar.mjs:170-189`), y el «sin canon» de R-1 no se ve en ningun lado. Sumar un renglon con cuantos `AVISO`, `ningun tema`, `no es de Fak` y `sin canon`.
- **R-8. Sin test de falla.** No hay test de la cascara para «si `$.store` o `$.fs` fallan, el mensaje pasa». El `.catch(... next(e))` de `register.js:78` esta, con el mismo patron que `recordatorio-ccsc`. Sugerido: un test con `store.get` que tira error.

## 2. `scripts/_modsInstalar.mjs`
- Agrega `recordatorio-temas` a `MODS` (renglon 29), y el test `modsInstalar.test.mjs` lo exige.
- `--estado`: los 3 mods instalados y activos, al dia con la rama.
- Sin errores. Solo R-7.

## 3. Hook de compactacion
- **Que se miro:**
  - `.claude/hooks/compactacion-registro.sh` sale con `exit 0` siempre y manda el stderr a /dev/null.
  - `scripts/_lib/compactacionRegistro.mjs`: `correr()` devuelve 0 aun con JSON roto y anota el error en `compactaciones.errores.log`.
  - Lee solo los ultimos 512 KB del transcript.
  - No imprime nada por stdout, asi que no mete texto en la compactacion.
  - `settings.json`: `PreCompact` y `PostCompact` con `matcher: ""`. Los demas eventos quedan igual: el diff es de 25 renglones y solo agrega.
  - El test arma el payload con `JSON.stringify` y prueba el camino real `bash → node`, con payload bueno y con basura.
  - `hooksTienenTest` tiene su fila (`tipo: 'observa'`).
- **R-9. ROBUSTEZ: en un worktree, el registro queda en el worktree.**
  - El hook escribe en `$CLAUDE_PROJECT_DIR/.claude/state/`. En una sesion hija en un worktree, `CLAUDE_PROJECT_DIR` es el worktree: los transcripts de esas sesiones viven en otra carpeta de proyecto, por ejemplo `C--Dev-BarackMercosul--claude-worktrees-impresora-tanda17-496e43`.
  - Las compactaciones de las hijas se pierden cuando se borra el worktree.
  - Arreglo, si se quiere contarlas: escribir en la `.claude/state` del repo principal (`git rev-parse --git-common-dir`) o en `~/.claude/state`.

## 4. `scripts/_temasAbiertos.mjs`

### ER-2 — ERROR REAL: la pagina afirma estados y pendientes que la memoria no dice
- **Donde:** `scripts/_temasAbiertos.mjs:65` (`/🟢|HECHO|ENTREGAD/i`, con la bandera `i`), `:39` y `:42-54` (`pendientesDe`).
- **Como se comprobo.** Se corrio `temasDeMemoria()` sobre la memoria real: 121 temas.
  - De los 18 que la pagina marca «hecho», 15 muestran pendientes en la columna «Lo que falta». Pasa porque «hecho» o «entregadas» en cualquier parte de la descripcion alcanza. Ejemplos:
    - `project_amfe_lifecycle_system` («6 fases entregadas»): el cuerpo dice «PENDIENTE — SWAP (bloqueado por permiso...)»;
    - `project_insert_hojas_plotter` («entregadas 2026-08-10»): el cuerpo dice «Pendiente de la prueba de Fak»;
    - `project_upper_trimming_flujograma_amfe`: el cuerpo dice «🟡 09/10/2026 — PENDIENTE ANOTADO».
  - Bajo «Lo que falta» aparecen renglones que dicen que NO falta:
    - `project_mails_del_equipo_a_la_nube`: «No hace falta avisarles a los compañeros: ya esta acordado.»;
    - `project_desvios_bom_arb_door_panel`: «No falta cargarlo: ...»;
    - `project_ppap_novax_tapizadas_puerta`: «Lay out de planta: no es pendiente de Fak.»;
    - `project_videos_maquinas_hotmelt_moldeadora`: «No hace falta volver a mirarlos»;
    - `project_ductos_corte_en_china`: «No hace falta volver a discutirlo»;
    - `project_p21_tiempos_balanceos`: «(no hace falta re-buscar)»;
    - `project_imds_barack`: «no se le lista como pendiente».
- El test (`__tests__/scripts/temasAbiertos.test.mjs`) no cubre ninguno de los dos casos.
- **Arreglo propuesto:**
  - En `estadoDeMemoria`: «HECHO» y «ENTREGAD» sin la `i` (en mayusculas son marca de estado).
  - Con pendientes, nunca «hecho» (que diga «abierto» o «hecho, con pendientes»).
  - En `pendientesDe`: saltear los renglones con `no (hace )?falta`, `no hacian falta`, `no es pendiente` y `no se le lista como pendiente`.
  - Tests rojo y verde con estos renglones reales.
- La prueba del plan («tornillo CNC» con su ultima fecha y sus pendientes) se cumple: sale con 2026-10-16, «urgente» y sus pendientes.

## 5. `CLAUDE.md`, `mail-envio.md` y `documentacion-oficial.md` (regla 7)
- **CLAUDE.md**, los dos renglones al final de «Como interactuar con Fak»:
  - no contradicen otra regla;
  - `scripts/_mails.py --buscar` existe (renglon 1535);
  - «causa auto | manual | idle»: ver FP-2.
- **`mail-envio.md`:** el renglon nuevo va antes del borrador y del OK. No choca con «el OK va DESPUES del borrador».
- **`documentacion-oficial.md`, regla 7:**
  - No contradice la regla 2 (en `4- MANUALES` va solo el original) ni `video-maquina.md`.
  - La lista de las 5 maquinas sin manual se comprobo con el listado de primer nivel de `4- MANUALES` y es correcta: IMG, HTV2A, Ricoh, hot press y embossing.
  - El recordatorio del guardian no la nombra a proposito (FP-7).
  - La rama no escribio nada en `4- MANUALES`: las fechas de las carpetas de maquinas son anteriores a la tanda.
  - Es **mas estricta que el plan**: agrega «bajarlo de internet va con el OK de Fak para ese archivo», y el plan decia «se baja ahi». No es un error, pero la madre tiene que confirmar que se quiere asi (R-10).

## 6. Memoria

### Indice
- `MEMORY.md` pesa 23.600 bytes y tiene 102 renglones: queda **por debajo de 25.000**.
- Las **469 memorias estan nombradas exactamente una vez**; las 468 del respaldo `MEMORY.md.antes-20261016` siguen todas; no se perdio ningun puntero. Se conto con un script que busca cada nombre de archivo como palabra entera.
- La seccion «Maquinas de Ingenieria» tiene los alias de Fak.
- Ya no dice «es de CUCHILLA» del HTV2A (el respaldo lo decia en el renglon 70).
- **R-11. ROBUSTEZ: el indice crecio.** Paso de 22.832 a 23.600 bytes. El objetivo del plan (menos de 15 KB) no se cumplio, y el lint avisa «cerca del tope»: los proximos punteros lo pasan.

### Fichas: 24 comprobaciones contra la fuente (varias traen mas de un dato)
| Ficha | Dato | Fuente abierta | Resultado |
|---|---|---|---|
| YIN | manual de 138 pags., en ingles, «Cutter User Manual Ver.2010N0705», HY-H | PDF p. 1 (PyMuPDF) | OK |
| YIN | codigo de modelo: 20 = ancho 2000 mm, 07 = 7 cm, L = largo (2 o 3,3 m), J, M, T | PDF p. 12 | OK |
| YIN | CutterControl y MarkEdit, Windows XP | PDF p. 22 y 42 | OK |
| YIN | aguja φ2,0 en el texto de la p. 96 | PDF p. 96 | OK |
| YIN | φ2,5 «para la J» en la imagen, que la ficha atribuye al investigador | p. 96 renderizada: renglon 31 «ﾆｰﾄﾞﾙ(φ2.5 用)», parte CH08-03-07H3 en la columna 7cm(J) | OK (ahora comprobado) |
| YIN | el punzon marca el origen de cada seccion | PDF p. 44 y 46 | OK |
| YIN | repuestos HY-H2007M y HY-H2007LJT3; `Erros maquina corte.docx`, `LIST OF ERROR.pdf` | listado de `2- SOFTWARE\MAQUINA DE CORTE YIN\` | OK |
| HTV2A | `CustomString` = 欢迎使用HTV2A喷墨绘图仪 (GBK) | `HTV2A.ini` | OK |
| HTV2A | `PrtFileExtension=*.plt;*.hpg;`, `PaperLenMm=1100`, `SpAutoClean=1`, `IBCleanThickness=3`, `ConnectViaEth=0` | `HTV2A.ini` | OK |
| HTV2A | «Ink box 1#/2#», «Inkbox Clean Thickness(1~5)», «Nozzleplate LR pix(20~40)», «Auto clean before print», «Paper width(Split width)(mm)», «Cut Paper» | `Dll_EN.dll` (UTF-16); «knife», «blade» y «cutter»: 0 | OK |
| HTV2A | `INKJetPlotter.inf`, `para\出厂1350.vsp` y `出厂1800.vsp`, `TestPlt\` de 0,5 a 2,05 m, `libusb0.dll` | listado de la carpeta | OK |
| HTV2A | README con CorelDraw e Inkscape | `INKJET PLOTTER\README.txt`, que esta en la carpeta de arriba de `Plotter INKJET` | OK |
| AOL | 48 pags., JINAN AOL CNC EQUIPMENT CO., LTD | M p. 1 | OK |
| AOL | IP 192.168.0.252 | M p. 13 | OK |
| AOL | X 2500 / Y 1330 en la captura de `config → machine` | M p. 14 renderizada | OK |
| AOL | 220 V, 2500 W sin fresa; «at least 14KW», 8 mm²; 63 A | M p. 3, 4 y 6 | OK |
| AOL | Xiao, 30 pags.; «Y1600, X2500» como ejemplo; `.pce`; plt/dxf | X p. 29, 8 y 6 | OK |
| Costura CNC | manual de 9 pags.; Getonagain; modelo `GOA-IS,HM-R-1-1300×1000-...` | PDF p. 1 y 2 | OK |
| Costura CNC | «controlador Richpeace Model III», citado como «manual p. 1-2» | «Richpeace» y «Model III»: 0 paginas en todo el manual | **MAL CITADO, corregido** (ER-3a) |
| Hot melt | manual de 47 pags.; aire 0,4 a 0,7 MPa; sin ancho ni modelo | PDF p. 6 y 8; «width» da 0 | OK |
| Impresora 3D | cama 330 x 320 x 325, Textured PEI 55 °C, Bambu Studio 2.8.2.61 | el cuerpo de la misma memoria | OK |
| Impresora 3D | «en la red, 192.168.1.198» | la seccion del 16/10 del mismo archivo dice .111 desde el 16/10 09:00 | **DESACTUALIZADO, corregido** (ER-3b) |
| YIN | «Como la llama Fak: «la mesa de corte no esta haciendo...» 14/10» | transcript `b3209884` 17:34:36Z: va adentro de `<pasted_content>` («TAREA: ...»); el informe B.1 lo marca como «texto de tarea que pego Fak» | **MAL CITADO, corregido** (ER-3c) |
| Regla 7 | 5 maquinas sin manual en `4- MANUALES` | listado de primer nivel | OK |

### Que la ficha del HTV2A no «decida» y que la de la YIN separe lo verificado
- **HTV2A: no decide.** Dice «TINTA o CUCHILLA: A CONFIRMAR en planta». Pone la evidencia de cada lado y aclara que sin manual no hay pagina que lo zanje. La description tambien lo dice.
- **YIN: separa bien.** Marca como «Pista sin verificar» el mail de 1,80 m y la nota de 2100 x 1800. La φ2,5 queda como «segun el investigador» (ahora comprobada, ver la tabla). El area util queda «a medir».
- **R-12. ROBUSTEZ: quedan dos lugares que siguen diciendo cuchilla.**
  - En la misma memoria del HTV2A, el cuerpo sigue en negrita: «"El plotter" en Barack NO es un inkjet ... con CUCHILLA». Solo el titulo dice «(a confirmar)».
  - `project_insert_hojas_plotter.md:31` sigue afirmando «[[reference_plotter_inkjet_software_htv2a]]: el plotter es una maquina de corte con cuchilla». Esa memoria no esta en la lista que esta auditoria podia tocar: no se edito.
  - Sugerido: en las dos, «(a confirmar en planta: ver la ficha del HTV2A)».

### ER-3 — ERRORES REALES en las fichas, corregidos en esta auditoria (edicion puntual)
- **a) `reference_maquina_costura_cnc.md`, renglon «Nombre oficial».**
  - Antes: `| Nombre oficial | Máquina de costura CNC Getonagain (controlador Richpeace Model III) | manual del fabricante p. 1-2 |`
  - Despues: `| Nombre oficial | Máquina de costura CNC Getonagain («Fully Automatic Template Sewing Machine»); controlador Richpeace Model III según la sección «Modelo» de abajo: el texto del manual no nombra el controlador (buscados «Richpeace» y «Model III»: 0 páginas, auditor 16/10) | manual del fabricante p. 1 (Getonagain); el controlador, sección «Modelo» |`
- **b) `reference_impresora_3d_fak.md`, renglon «Donde esta».** La seccion del 16/10 ya estaba en el archivo cuando se escribio la ficha: el mtime del archivo coincide con el `modified` de la ficha.
  - Antes: `| Donde esta | a confirmar; en la red, 192.168.1.198 (la IP la da el router y puede cambiar) | abajo |`
  - Despues: `| Donde esta | a confirmar; en la red, 192.168.1.111 medida el 16/10 09:00 (antes .198: la IP la da el router y cambio con el corte de luz del 15/10) | abajo, seccion del 16/10 |`
- **c) `reference_maquina_mesa_corte_yin.md`, renglon «Como la llama Fak».**
  - Antes: `| Como la llama Fak | «la mesa de corte» («la mesa de corte no esta haciendo los agujeros donde deberia», 14/10) | informe ... B.1 |`
  - Despues: `| Como la llama Fak | «la mesa de corte»; la frase del 14/10 («la mesa de corte no esta haciendo los agujeros donde deberia») es del texto de una tarea que pego Fak, no un mensaje suyo | informe ... B.1 |`

## 7. Suite
```
 Test Files  11 passed (11)
      Tests  281 passed (281)
   Duration  66.46s
```

---

## FALSOS POSITIVOS (revisados y descartados)
- **FP-1.** `mods/recordatorio-temas/tests/recordatorio-temas.test.ts` importa `claude-code/testing`, que no esta en el repo. No rompe el CI: lo excluyen `vitest.config.ts:14` y `tsconfig.json:46` (`mods/**/*.test.ts`), igual que los de `tablero` y `presupuesto-agentes`. `tsc` da 0 errores.
- **FP-2.** «idle» como causa de la compactacion. El schema publicado del hook dice `trigger: ["manual","auto"]`, pero el binario arma el payload con `trigger: n.trigger`, y la compactacion por inactividad lo llama con `trigger:"idle"`. Es plausible, y el codigo acepta cualquier texto. Se confirma con la primera compactacion por inactividad.
- **FP-3.** `PostCompact` existe en 2.1.301, en la lista de eventos de hooks del binario: no invalida el `settings.json`.
- **FP-4.** En la lista de origenes del mod estan `scheduled-trigger`, `peer-send-message` y `projects-relay`, que en el transcript son subtipos. La API de mods los sube a `kind` (`GIe(r) ? {kind:r}`). Estan bien.
- **FP-5.** El test dice «07/08 12:51» y el plan «07/09 12:51». El informe B.1 dice 07/08 12:51 (`ea3acb16`): el error de tipeo es del plan.
- **FP-6.** Los 4 rotos de `_cerebroLint` son previos a la tanda: un wikilink y 3 rutas. `scripts/hotmelt/datos_privados.py` no se versiona a proposito, y esa ruta esta en el cuerpo viejo de la memoria del hotmelt, no en la ficha.
- **FP-7.** Que el recordatorio del guardian no nombre la regla 7 esta dicho a proposito en `documentacion-oficial.md:96`.
- **FP-8.** Los commits sin push son por diseño del encargo: no es CRITICO.
- **FP-9.** `IMPRESORA 3D BAMBU LAB A2L\` en `4- MANUALES` tiene archivos del 16/10 14:48-14:51. Son de antes de esta tanda (los commits son de 16:08 a 16:47) y no los escribio esta rama.
- **FP-10.** Las 94 «UNMET DEPENDENCY» de `npm ls` son del entorno: en el worktree la carpeta `node_modules` esta vacia y Node usa la del repo principal. El build y los tests corren.

## ERRORES REALES y arreglo propuesto (no se tocaron en el codigo)
| # | Que | Arreglo |
|---|---|---|
| ER-1 | `sdk` pasa como Fak: los encargos de otras sesiones, los informes de las hijas y la continuacion despues de compactar dispararian temas (`temas.mjs:8-11`, README:10) | Agregar `'sdk'` a `ORIGENES_QUE_NO_SON_FAK` (dejar `unclassified`). Tests rojo y verde con los 2 textos reales, en vitest y en `plugin test`. Corregir el comentario y el README. Despues, `node scripts/_modsInstalar.mjs --aplicar` |
| ER-2 | `_temasAbiertos`: «hecho» por cualquier «hecho»/«entregad» (15 de 18 con pendientes), y renglones «no hace falta» listados como pendientes (`_temasAbiertos.mjs:65`, `:42-54`) | Sin la bandera `i`. Con pendientes, nunca «hecho». Filtrar las negaciones. Tests rojo y verde con los renglones reales citados |
| ER-3 | Tres datos de fichas mal citados o desactualizados | **Ya corregidos** en la memoria (antes y despues arriba) |

Ademas (ROBUSTEZ, por orden de valor):
- R-2: el generico junto al especifico.
- R-3: «8d» y «plan de reaccion».
- R-4: el triangulito.
- R-12: las dos menciones de cuchilla.
- R-7: el registro del mod en `--estado`.
- R-6: `sesion=` en el registro.
- R-9: el registro de compactaciones de los worktrees.
- R-11: el peso del indice.
- R-5: los tipeos.
- R-8: test de falla de `$.store`.
- R-10: confirmar el «OK de Fak» de la regla 7.

## Lo que no se pudo verificar
- **Que el mod avise en una sesion real.** El canon no esta en `main` y el registro solo dice «sin canon». Se ve despues del merge.
- **El primer renglon real de `compactaciones.jsonl`.** No hubo una compactacion con el hook cableado, y en `main` todavia no esta cableado. Tampoco si la compactacion por inactividad le pasa `idle` al hook.
- **Tinta o cuchilla del HTV2A.** No hay manual del fabricante; queda «a confirmar en planta».
- **Lo que las fichas sacan de mails o de Mantenimiento:**
  - `.NC` y «INSERT MIX PAT ESP.NC» (15/09/2025);
  - Elizabeth como lider;
  - BMA089/BMA090;
  - las planillas de la hot press;
  - el mail de Pablo Gamboa de 1,80 m, que la ficha ya marca «sin verificar».

  No se abrio el buzon.
- **Lo que las fichas citan del informe `casa_hojas_y_maquinas.md` B.1** («como la llama Fak» de cada maquina). Solo se comprobo el caso de la YIN contra el transcript.
- **La pieza 1.3.6 (`claude-mem`)** no esta en estos commits: el plan la deja como «la proxima ficha» si no se llegaba.
