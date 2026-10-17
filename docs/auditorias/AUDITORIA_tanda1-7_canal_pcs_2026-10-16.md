# Auditoría final (Opus) — tanda 1.7 del plan del sistema: «el canal entre las PC y la carpeta correcta» (16/10/2026)

**Veredicto: APROBADO CON CAMBIOS.** No rompe nada de lo que ya andaba: tests 156/156, settings global sin otro cambio, `--bajar` en ensayo limpio. Pero hay 1 TRUE_BUG y 7 Importantes (H2 a H8) que dejan sin cumplir dos promesas de la tanda. La primera: el renglón de pedidos viejos promete algo imposible. La segunda: en CATA el aviso de carpeta no se cablea solo, y donde se cablea le pide a Fak cerrar sesiones que abrió a propósito en otra carpeta.

Alcance: `scripts/_lib/pedidosPendientes.mjs`, `scripts/_lib/pedidosCanon.data.json`, `.claude/hooks/pedidos-pendientes.sh`, `.claude/hooks/carpeta-guard.sh`, los dos tests nuevos, `tools/instalar_mi_pc/ajustar_settings.mjs`, `scripts/_nube.mjs`, `__tests__/scripts/instalarMiPc.test.mjs`, `__tests__/scripts/hooksTienenTest.test.mjs`, `CLAUDE.md` (punto 0 bis) y `C:\Users\FacundoS-PC\.claude\settings.json`. No se auditó lo de la otra sesión (`.env.example`, `docs/LECCIONES_APRENDIDAS.md`, `docs/auto-mejora/*`, `scripts/_crearAmfeUpperTrimming.mjs`).

**No arreglé nada.** El rol del auditor es solo detectar (decisión de Fak del 14/07/2026), así que cada arreglo queda propuesto y lo decide la sesión principal. Todo lo de abajo se corrió con HOME, BARACK_REPO y BARACK_FACUNDO apuntando al scratchpad, o sobre copias. No se escribió en la nube, en el settings global, en Supabase, en arb, en Y: ni en Outlook.

Nota: `pedidosCanon.data.json` cambió a mitad de la auditoría, porque se agregó `_notebooks_conocidas: ["CATA"]`. Lo tomé como estado vigente. Es solo informativo: `quienSoy()` no lo lee (ver H6).

---

## Hallazgos

Orden: primero los Importantes y después los Nits; dentro de cada grupo, TRUE_BUG > ROBUSTNESS > DOC. H18 es lo Preexistente.

### H1 — TRUE_BUG · Importante — Un pedido SIN número no se puede cerrar nunca, y el renglón promete que sí
`scripts/_lib/pedidosPendientes.mjs:36` (`RE_LISTO` exige número) y `:112-113` (el texto del renglón).

El renglón de «viejos» le dice a Fak: *«Si ya se hicieron, dejarles su «listo» una vez y esto deja de salir»*. Para los pedidos sin número eso no tiene forma de cumplirse:

- **Principal:** de los 8 pedidos que nombra el único renglón de hoy, 4 no tienen número: «PEDIDO IMDS - seguir envio a VW», «PEDIDO mail a Calidad - IMDS aprobados», «PEDIDO mail a Calidad - IMDS IP PAD en BeOn» y «PEDIDO mail a Manuel - IMDS».
- **Notebook:** los 2 renglones viejos no tienen número.

Probado con «PEDIDO mail a Manuel - IMDS 09-10-2026.txt» y cuatro formas de «listo»:

| «listo» que se deja | Resultado |
|---|---|
| `PEDIDO mail a Manuel - IMDS - listo.txt` (primer renglón «... hecho en la PC principal») | **empeora**: el «listo» pasa a ser otro pedido pendiente y el renglón dice «2 pedido(s)» |
| `PEDIDO mail a Manuel - listo.txt` | sigue saliendo (1) |
| `PEDIDO - listo mail a Manuel - IMDS 09-10-2026.txt` | sigue saliendo (1) |
| `PEDIDO listo mail a Manuel - IMDS 09-10-2026.txt` | sigue saliendo (1) |

Resultado: ese renglón sale en cada arranque, reanudación y compactado de toda sesión de las dos PC, para siempre. Hay tres arreglos posibles; el primero es el más simple:

- un «listo» sin número cierra al pedido de igual «que» (`queDe`);
- una lista de nombres cerrados en el canon;
- no nombrar más los viejos sin número una vez que Fak los dio por hechos.

### H2 — ROBUSTNESS · Importante — Se cablea un hook global sin mirar si su `.sh` está en la PC: `bash` sale con 127 en cada mensaje
`tools/instalar_mi_pc/ajustar_settings.mjs:46-58` (`asegurarHooksGlobales`) y la llamada en `scripts/_nube.mjs:448`.

- **Estado de hoy:** en la nube, `Claude Fak\claude-config\hooks\` tiene `agentes-guard.sh` pero **no** `carpeta-guard.sh` ni `pedidos-pendientes.sh` (listado). Van a subir con la próxima `--sincronizar` de esta PC; la tarea «Barack - mi asistente al dia» está programada para las 21:38.
- **El caso que falla:** CATA ya tiene el código nuevo y corre `node scripts/_nube.mjs --bajar --aplicar` antes de que esos `.sh` lleguen a la nube. Para que pase hoy tienen que darse tres cosas antes de que la tarea de las 21:38 suba los `.sh` y OneDrive los baje en CATA:
  - que se haga el commit y el push;
  - que CATA haga el pull;
  - que alguien corra `--bajar --aplicar` a mano en CATA, porque solo no corre (H7). Entonces `ajustarSettingsLocal` le cablea `bash "C:/Users/catav/.claude/hooks/carpeta-guard.sh" prompt` y los otros dos. Esos archivos no existen.
- **Qué pasa entonces:** en cada mensaje y en cada arranque, `bash: C:/Users/.../carpeta-guard.sh: No such file or directory` y `exit=127` (probado con una ruta inexistente).
- **Hay precedente en la casa:** los registros de esta PC tienen 16 `hook_non_blocking_error` de UserPromptSubmit y 250 de PreToolUse con «Failed with non-blocking status code: bash: .claude/hooks/_dispatcher.sh: No such file or directory».
- **Riesgo permanente:** el código deja esta carrera para siempre. Vuelve a pasar cada vez que se agregue un hook a `HOOKS_GLOBALES`, o cuando OneDrive se atrase.

Arreglo propuesto: `asegurarHooksGlobales(settings, home)` cablea solo los hooks cuyo `${home}/.claude/hooks/<archivo>` existe, y nombra en `cambios` los que saltea.

### H3 — ROBUSTNESS · Importante (hoy no se dispara) — «¿Este settings es de otra PC?» se decide sobre el texto JSON crudo
`tools/instalar_mi_pc/ajustar_settings.mjs:110-111` (`deOtro` con `RE_USUARIO` sobre `texto`, `:22`), y lo que hace la rama `ajustarSettings` en `:75-87`.

Falla en las dos direcciones (probado sobre copias en el scratchpad):

- **No ve las barras invertidas.**
  - En el texto, `C:\Users\catav` aparece como `C:\\Users\\catav`, y `([\\/])Users\2` no coincide.
  - Caso: un settings de catav con rutas solo en `\`, sin hooks (`env.PATH: "C:\\Users\\catav\\AppData\\Roaming\\npm;..."`). En la principal se toma como propio y **conserva el PATH y las carpetas de catav**.
  - El settings real de la nube hoy se detecta bien solo por su único renglón con barras normales, el de agentes-guard (1 ruta con `/` contra 10 con `\\`).
- **Toma a la PC de origen por otra.**
  - Pasa con cualquier ruta con barras normales a `C:/Users/Public`, `C:/Users/Default` o a la forma corta `C:/Users/FACUND~1`. Esa forma corta es la que trae el TEMP de esta PC.
  - Con `additionalDirectories: ["C:/Users/Public/Documents"]` agregado al settings real, el ensayo da: `["1 ruta(s) de la otra PC pasadas a C:\Users\FacundoS-PC", "env.PATH de la otra PC sacado"]`.
  - Con un `statusLine` en `C:/Users/FACUND~1/...` da lo mismo.
  - Consecuencia: en la PC principal **se borra `env.PATH`** y se reescribe la ruta. Esto corre en cada `--bajar --aplicar`, que el paso 0 de CLAUDE.md manda correr sin preguntar. `ajustarSettingsLocal` no deja respaldo.
- **Hoy no pasa:** la copia del settings real da `[]` en ensayo y de verdad, y queda idéntica.
- **Qué es nuevo y qué no:** lo nuevo es que ahora corre en la PC de origen en cada bajada. Lo que ya pasaba antes con el instalador está en H18.

Arreglos propuestos:

- decidir sobre los strings del JSON parseado y solo con las rutas `.../.claude/...` de los hooks;
- excluir `Public`, `Default` y los nombres con `~`;
- guardar `settings.json.antes-de-bajar` antes de escribir.

### H4 — ROBUSTNESS · Importante — carpeta-guard le pide a Fak cerrar sesiones que abrió a propósito en otra carpeta
`.claude/hooks/carpeta-guard.sh:62-65`.

El hook avisa en **toda** carpeta que no sea el repo, y el texto le ordena a Claude: *«Deciselo a Fak en un renglon: cerrar esta sesion y abrirla en esa carpeta»*. Las carpetas de sesiones de esta PC muestran que Fak trabaja en otras carpetas a propósito:

| Carpeta de la sesión | Último uso | Qué es |
|---|---|---|
| `D:\KIT-ESTUDIO-CLAUDE` | 13/10 | estudio; Fak pidió trabajar solo con esa carpeta, sin salir de ella |
| `C:\Users\FacundoS-PC\Documents\estudio` | 15/10 (10 sesiones) | estudio, otro tema |
| `C:\Dev\ClaudeAreaPrueba\.claude\worktrees\...` | 13/10 | prueba del asistente por área |
| `C:\Users\FacundoS-PC\AppData\Roaming\Claude\scratch-workspaces\...` | 08/10 | espacios de la app |

**Acierto real** (el caso que motivó la tanda): `C:\Dev`. Hay 4 sesiones en esta PC (12/10, trabajo de Barack) y 15 registros con cwd `C:\Dev` en `claude-registros` de la nube. En esas mismas carpetas, `pedidos-pendientes` también mete los pedidos de Barack.

Arreglo propuesto: avisar solo si el cwd es un ANCESTRO del repo (`C:\`, `C:\Dev`) o la carpeta de usuario, que son las elecciones equivocadas medidas. Otra opción es una lista de carpetas propias en un canon.

### H5 — ROBUSTNESS · Importante — Un pedido cuyo destino no se entiende no lo ve ninguna PC, sin aviso
`scripts/_lib/pedidosPendientes.mjs:50-56` (`destinoDe`), `:100` (filtro `p.destino === pc`) y `:118-123` (lectura en UTF-8).

Es la misma clase de falla que originó la tanda: una PC que no encuentra su pedido. Lo probado en una carpeta FACUNDO de mentira:

- **Dan `null` y el pedido desaparece de las dos PC:**
  - «PEDIDO 9 PARA LA PC DE INGENIERIA»
  - «PARA TU PC»
  - «PARA LA PC DE ESCRITORIO»
  - «PARA CLAUDE EN LA OTRA PC»
  - «PARA LA PC DE CATA»

  El archivo `PEDIDO 18 - para la PC de ingenieria 17-10-2026.txt` no salió ni como principal ni como notebook.
- **Un archivo en UTF-16** (lo que escribe `Out-File` de Windows PowerShell 5.1) da cabecera ilegible, `null` y lo mismo: desaparece.
- **Se prueba primero la expresión de la principal**, así que «PEDIDO 9 PARA LA NOTEBOOK - escrito desde la PC principal» va a la **principal**.

Los 17 archivos reales de hoy se leen bien (tabla al final): esto no le pasa a ninguno de los que ya existen.

Arreglos propuestos:

- un destino que no se entiende sale en las dos PC, con «no se entiende a quién va»;
- decidir por la parte «PARA ...» del renglón;
- decodificar UTF-16 cuando el archivo empieza con `FF FE`.

### H6 — ROBUSTNESS · Importante (lo dice el plan como no verificado) — La segunda notebook de Fak queda en el mismo balde «notebook»
`scripts/_lib/pedidosPendientes.mjs:44-47`.

`quienSoy()` trata como «notebook» a toda PC que no sea `DESKTOP-14JG95B`. Fak tiene 2 notebooks («mis 2 notebooks»). En su notebook personal, el PEDIDO 7b («PARA LA SESION DE LA NOTEBOOK DE CALIDAD (CATA)») saldría como *«Hay un pedido para esta PC sin hacer»*. El 7b es un pedido que escribe en BeOn y que dice «SOLO CON FAK MIRANDO».

El canon ya tiene `_notebooks_conocidas: ["CATA"]` pero el código no lo usa. Falta el nombre de máquina de la otra notebook: no verificado, no se puede ver desde esta PC.

### H7 — ROBUSTNESS · Importante — En CATA el cableado no llega solo
`scripts/_nube.mjs:329` (la `--sincronizar` se saltea `settings.json`) y `scripts/_nubeSync.ps1:44` (la tarea de cada 2 h corre solo `--sincronizar --aplicar`).

Hay tres caminos que cablean los hooks globales en una notebook, y ninguno corre solo en CATA:

- `_nube.mjs --bajar` lo cablea, pero la tarea programada no lo corre;
- el paso 0 de CLAUDE.md lo corre, pero CLAUDE.md solo carga en sesiones abiertas en `C:\Dev\BarackMercosul`, que es justo lo que CATA no hace;
- el instalador lo cablea, pero hay que volver a correrlo a mano.

Por eso el aviso de carpeta equivocada no llega a CATA hasta que Fak:

- abra ahí una sesión en la carpeta correcta, o
- corra `node scripts/_nube.mjs --bajar --aplicar` a mano, o
- vuelva a correr el instalador.

El comentario «tools/instalar_mi_pc/ajustar_settings.mjs lo cablea en las notebooks» (en los dos `.sh` y en CLAUDE.md 0 bis) es cierto solo por esos caminos manuales.

Arreglo propuesto: en `--sincronizar`, llamar a `ajustarSettingsLocal` sobre el settings LOCAL, solo para cablear hooks del mismo usuario. Va con los arreglos de H2 (que el `.sh` exista) y H3 (que no toque el PATH).

### H8 — DOC · Importante — La regla «mejora implementada» no alcanza a esta pieza, y el renglón con texto no se vio llegar en vivo
`scripts/_lib/cierreCanon.data.json` (`mejora.mensajes_re`) y `scripts/_lib/mejorasEnPrueba.data.json`.

- `carpeta-guard.sh prompt` lee los mensajes de Fak. Aun así:
  - no está en `mensajes_re`: probado, da `false`, así que el chequeo 3 del cierre no exige la prueba con `_probarMejora`;
  - no está anotado en `mejorasEnPrueba.data.json`, así que `--llego` no lo mide.
- `_probarMejora.mjs` corre solo los hooks de `.claude/settings.json` del repo (`:10`, `:70`). No puede probar un hook global.
- **Visto en vivo: solo en parte.**
  - `carpeta-guard prompt` YA corre en vivo: en el HOME real, `C:\Users\FacundoS-PC\.claude\.carpeta-guard\` tiene marcas de 3 sesiones reales que ya estaban abiertas: `34df5f0e` a las 20:41:49, `8978b0d5` (worktree de la impresora) a las 20:44:40 y `b4cbe5c6` (tarea programada) a las 20:50:58. Mis pruebas usaron siempre un HOME del scratchpad.
  - Las 3 estaban en el repo o en un worktree y callaron, como corresponde: no hay ningún `hook_non_blocking_error` que nombre a los hooks nuevos. Un hook que no imprime no deja adjunto en el registro.
  - El renglón con texto (`[CARPETA]` o `[PEDIDOS]`) todavía no salió: no hubo ningún SessionStart (arranque, reanudación ni compactado) en los registros desde las 20:33, y ninguna sesión fuera del repo. Por la regla, falta verlo llegar.
- **El test sí usa el mensaje real de Fak** (`carpetaGuard.test.mjs:31`).

### H9 — ROBUSTNESS · Nit — El detector de «pregunta por la carpeta» casi solo da falsos positivos
`.claude/hooks/carpeta-guard.sh:45-49`.

Medido con el hook real sobre los 60 mensajes únicos que dicen «carpeta» en todos los registros de esta PC (marca de sesión ya puesta, cwd = repo):

- **Disparan 10.** Es igual con `LANG` vacío y con `C.UTF-8`, porque en ese grupo no había ningún «cuál» con tilde.
- **Acierto: 1.** El #29: *«normalente siempre elijo esta carpeta asiq ueno pasa nada»*.
- **Falsos positivos: 9.**
  - 5 son de Fak:
    - #8 «la carpeta del sgc hojas d eproceos sabes **cual** es no?»
    - #10 «no la vuelva a **abrir**»
    - #21 «asi **abro**i la carpeta desde ahi»
    - #37 «los pequeños prompts que le **tengo que** mandar»
    - #59, en la sesión de estudio de `D:\KIT-ESTUDIO-CLAUDE` («**tengo que**» + «esta carpeta»): ahí la respuesta «siempre C:\Dev\BarackMercosul» está mal.
  - 4 son texto de otra sesión o pegado: #4, #6, #31, y #54, que dispara por «**curl**» (lo agarra `cu.l`).
- **Cinco mensajes reales de Fak que nombran una carpeta sin preguntar por ella y callan bien:**
  - «Guardame en mi carpeta de trabajo una nota...»
  - «en la carpeta esa de ipomrimr que esta en mie scritorio»
  - «dale sacá la carpeta del carro y el respaldo»
  - «madnalo a alguna carpeta que diga obsoleto»
  - «Que carpeta puso esa regla»
- **Falsos negativos:**
  - #14 *«Demuéstrame que estás en la carpeta correcta»*;
  - «¿cuál es la carpeta?», «¿Cuál carpeta uso?» y «CUÁL CARPETA» callan con `LANG` vacío, que es como corren los hooks (sin locale, el `.` toma un solo byte y la «á» ocupa dos). Con `C.UTF-8` avisan;
  - «que carpeta uso para claude?» calla siempre.

El costo es bajo porque el renglón es condicional («Si Fak pregunta...»), por eso es Nit.

### H10 — ROBUSTNESS · Nit — La marca «listo» se confunde con el texto del pedido
`scripts/_lib/pedidosPendientes.mjs:36`.

- `PEDIDO 17 - listo de materiales para Manuel 17-10-2026.txt` se toma como el «listo» del 17 y **se cierra solo**. Lo mismo le pasaría a un «PEDIDO 9 - listo para mandar a VW - ...».
- `PEDIDO 16 listo sin guion.txt` (sin «-») pasa a ser un **pedido pendiente** «PEDIDO 16 - listo sin guion» en la principal, porque su primer renglón nombra la PC principal. El 16 real de la notebook queda abierto.

### H11 — ROBUSTNESS · Nit — La hora se ordena como texto
`scripts/_lib/pedidosPendientes.mjs:103`.

Con «17/10/2026 9:30» y «17/10/2026 15:00», el PEDIDO 14 (9:30) sale **después** del 19 (15:00). Los encabezados reales usan dos dígitos (09:45), por eso hoy no se nota. Arreglo propuesto: rellenar la hora a 2 dígitos al leerla.

### H12 — ROBUSTNESS · Nit — `asegurarHooksGlobales` duplica si el cableado existente tiene otra forma
`tools/instalar_mi_pc/ajustar_settings.mjs:52`.

La expresión exige `.../archivo.sh"` al final. Sí respeta las barras invertidas, otro usuario y `~` entre comillas: no duplica. Pero **duplica** con:

- `bash C:/Users/.../agentes-guard.sh` (sin comillas)
- `bash $HOME/...` (sin comillas)
- comillas simples
- `... " 2>/dev/null` al final
- `carpeta-guard.sh` sin `inicio`, que es su valor por defecto

Duplicar agentes-guard hace que se corra dos veces en cada Agent. La forma real de hoy es la estándar: la segunda pasada da 0.

### H13 — ROBUSTNESS · Nit — Con un `session_id` de más de 255 caracteres el hook escribe a stderr
`.claude/hooks/carpeta-guard.sh:56`.

`: > "$dir/$sid" 2>/dev/null` aplica las redirecciones en orden: la que falla («File name too long») sale antes del `2>/dev/null`. Igual sale con 0. Los `session_id` reales son UUID de 36 caracteres, así que no pasa. Arreglo propuesto: `{ : > "$dir/$sid"; } 2>/dev/null`.

### H14 — ROBUSTNESS · Nit — Las marcas de `~/.claude/.carpeta-guard/` no se limpian nunca
`.claude/hooks/carpeta-guard.sh:53-57`. Queda un archivo vacío por sesión, para siempre.

### H15 — ROBUSTNESS · Nit — `pedidos-pendientes.sh` prueba la carpeta de la sesión antes que la ruta fija
`.claude/hooks/pedidos-pendientes.sh:21`.

Si la sesión está en un clon viejo o un worktree con `scripts/_lib/pedidosPendientes.mjs`, corre ese código y no el del checkout principal. Las formas de ruta (mayúsculas, `\`, `/c/`) andan todas: probado, sale 1 renglón en las 5 formas.

### H16 — ROBUSTNESS · Nit — Dependencias nuevas de `_nube.mjs`
- `scripts/_nube.mjs:74`: el `import` de `ajustar_settings.mjs` es estático. Si ese módulo no carga, no arranca nada de `_nube.mjs`, tampoco la `--sincronizar` de cada 2 h.
- `tools/instalar_mi_pc/ajustar_settings.mjs:123-126`: si `renameSync` falla, queda el `settings.json.<pid>.nuevo` tirado.
- `_nube.mjs:448`: el ensayo de `--bajar` juzga el settings LOCAL, no el que bajaría. Está dicho en el comentario.

### H17 — DOC · Nit — «sin hacer» dice más de lo que el hook sabe
`scripts/_lib/pedidosPendientes.mjs:108`.

El hook solo sabe que no hay marca «listo». El 7b dice que se hace «SOLO CON FAK MIRANDO» y escribe en BeOn. Sale en cada arranque, incluidas las sesiones de tareas programadas: `b4cbe5c6`, «hija-memoria-maquinas», también recibe los SessionStart globales. Texto propuesto: «sin su marca «listo» (no se hace sin que Fak lo pida)».

### H18 — ROBUSTNESS · Preexistente — El instalador reescribe cualquier carpeta de usuario ajena, y una subida desde la notebook pisa el settings de la principal
- `tools/instalar_mi_pc/ajustar_settings.mjs:75-78` ya estaba antes de esta tanda. Pasa a esta PC toda ruta `C:\Users\<otro>`, también `Public` y `Default`. Lo nuevo de la tanda (que ahora corre en la PC de origen) está en H3.
- `_nube.mjs --subir --aplicar` desde una notebook sube su settings a la nube. Después, un `--bajar --aplicar` en la principal lo copia, porque `/XO` deja pasar el más nuevo, y se pierde lo propio de la principal, como su `env.PATH`. Antes de la tanda se copiaba tal cual; ahora al menos se ajustan las rutas y los hooks. No es de esta tanda: queda anotado.

---

## FALSE_POSITIVE — lo que se probó y está bien

- **Tests:** `npx vitest run` de los 5 archivos pedidos: **156/156** en verde. `node --check` OK en los 7 `.mjs`, `bash -n` OK en los 2 `.sh`, el canon es JSON válido. `npx tsc --noEmit`: 0 errores. `npm run build`: pasa (55 s).
- **Settings global** (`C:\Users\FacundoS-PC\.claude\settings.json`):
  - JSON válido;
  - contra `settings.json.antes-tanda17-2026-10-16`, la ÚNICA diferencia es el bloque nuevo (`SessionStart` con 2 entradas, `UserPromptSubmit` con 1), tanto en texto como en JSON normalizado;
  - rutas absolutas con barras normales, igual que agentes-guard (`bash "C:/Users/FacundoS-PC/.claude/hooks/..."`);
  - las 3 copias de `~/.claude/hooks/` son idénticas a las del repo (`cmp`).
- **`ajustarSettingsLocal` con el settings real de esta PC** (sobre una copia): `[]` en ensayo y `[]` de verdad, el archivo queda idéntico y **no se borra env.PATH**. Con `dryRun` no escribe. Sin `dryRun` no deja archivos aparte. Lee bien un settings con BOM. La segunda pasada da 0.
- **`node scripts/_nube.mjs --bajar`** (ensayo): `exit=0`, sin el renglón de ajuste (no hay nada que ajustar), el md5 del settings global no cambió y no quedaron `.nuevo`.
- **`carpeta-guard.sh`, robustez del JSON:** todas estas formas salen con 0 y sin stderr, y avisan o callan como corresponde:
  - comillas escapadas;
  - un `"cwd":"C:\\Dev"` adentro del prompt, antes o después de la clave real (el escape lo protege);
  - `\n`, tabulador, tilde, emoji y «»;
  - cwd con espacios y tildes;
  - el repo en MAYÚSCULAS, con barra final, y un worktree adentro (calla);
  - `session_id` con `../` (se limpia a `x`);
  - sin `session_id` (solo responde a la pregunta);
  - JSON vacío y JSON roto.

  Solo dan falso aviso un cwd en forma corta 8.3 y uno en forma `/c/`, que son teóricos.
- **Velocidad:** 0,4 s por mensaje común con la PC cargada; un prompt de 400.000 caracteres tarda 2,6 s (3,7 s si `prompt` viene antes que `cwd`). Muy lejos del tope de 30 s.
- **`pedidosPendientes.mjs`:** no se cae con una carpeta llamada `PEDIDO 10 - ....txt`, con bytes inválidos ni con un archivo de 30 MB: sale con 0, sin stderr, en 0,4 s. Si falta la carpeta o la nube, da `[]`. Permisos denegados no se probó (no apliqué ACL); por el código, `readdirSync` y `readFileSync` están en `try`. Los 17 PEDIDO de esta PC están en disco (`Archive, ReparsePoint`, ninguno solo en la nube).
- **Codificación:** sale en UTF-8 (« = `C2 AB`). Por precedente llega bien: los «» de otros hooks llegan decodificados en los adjuntos `hook_additional_context` de las sesiones recientes, sin ningún `Â«`.
- **`hooksTienenTest`:** la excepción nueva del test 5 va por nombre (solo esos 2 archivos). El test 1 sigue exigiendo fila en COBERTURA a todo `.sh` del disco y el 2 exige que su test exista y lo nombre, así que un huérfano cualquiera no pasa. Lo que falta, que no es un error: nada verifica que los hooks globales estén **cableados** en `~/.claude/settings.json`. El 5e solo compara archivos y se saltea si no existen.
- **CI:** el último run es `completed success` en `0e420aea` (HEAD) y no hay commits sin pushear. Los cambios de la tanda están sin commitear, como se pidió.

### Contra la carpeta real (solo lectura) — ¿cada renglón es verdad?

Los 17 archivos `PEDIDO*` de `FACUNDO\` se leen bien: número, destino, origen, fecha y hora salen como dice cada encabezado (`leerPedido` con los 2 primeros renglones reales):

| Número | «listo» de | Destino | Origen | Fecha | Hora | Archivo |
|---|---|---|---|---|---|---|
| 1 de 2 | - | principal | CATA | 14/10 | 14:12 | PEDIDO 1 de 2 - mail a Calidad - todos los IMDS aprobados |
| 2 de 2 | - | principal | CATA | 14/10 | 14:25 | PEDIDO 2 de 2 - mail a Luca - PDF IMDS apoyacabezas |
| 3 | - | principal | CATA | 14/10 | 15:00 | PEDIDO 3 - mail a Manuel - BeOn skill lista + evidencia |
| 4 | - | principal | CATA | 14/10 | 15:20 | PEDIDO 4 - ACTUALIZACION del pedido 3 |
| 5 | - | notebook | la PC principal | 15/10 | 09:45 | PEDIDO 5 - BeOn que revision vio VW de cada documento |
| 5 | 5 | (listo) | - | 15/10 | 10:15 | PEDIDO 5 - listo revisiones BeOn (el aviso quedo como PEDIDO 6) |
| 6 | 6 | (listo) | CATA | 15/10 | 10:15 | PEDIDO 6 - listo revisiones BeOn |
| 7 | - | reemplazado | - | 15/10 | 16:00 | PEDIDO 7 - BeOn apoyacabezas flujograma Rev A y hojas de proceso |
| 7b | - | notebook | la PC principal | 15/10 | 16:00 | PEDIDO 7b - BeOn apoyacabezas flujograma, hojas de proceso y fichas de embalaje |
| 8 | 8 | (listo) | la PC principal | 16/10 | - | PEDIDO 8 - listo mail a Luca IMDS Upper Trim |
| 8 | - | principal | CATA | 16/10 | - | PEDIDO 8 - mail a Luca - IMDS Upper Trim |
| - | - | notebook | la PC principal | 13/10 | 17:00 | PEDIDO BeOn - aprender a usarlo y armar la skill |
| - | - | notebook | la PC principal | 09/10 | - | PEDIDO IMDS - para seguir en la notebook de Calidad |
| - | - | principal | CATA | 09/10 | - | PEDIDO IMDS - seguir envio a VW |
| - | - | principal | CATA | 13/10 | 16:45 | PEDIDO mail a Calidad - IMDS aprobados |
| - | - | principal | CATA | 14/10 | - | PEDIDO mail a Calidad - IMDS IP PAD en BeOn |
| - | - | principal | - | 09/10 | - | PEDIDO mail a Manuel - IMDS | El 7 sale REEMPLAZADO y no se nombra. El «PEDIDO 5 - listo ... (el aviso quedo como PEDIDO 6).txt» (creado a las 20:32) cierra al 5 y el «PEDIDO 8 - listo» cierra al 8.

- **Principal** (`DESKTOP-14JG95B`): un renglón con 8 viejos (1 de 2, 2 de 2, 3, 4 y los 4 sin número). Es verdad que ninguno tiene «listo». Si se hicieron, no se puede saber desde los archivos. Y los 4 sin número no se pueden cerrar (H1).
- **Notebook** (`BARACK_PC=notebook`): «PEDIDO 7b ... (de la PC principal, 15/10 16:00)» más 2 viejos sin número. Lo de «sin marca» es verdad. Si el 7b se hizo **no se puede verificar desde acá**: su carpeta `Apoyacabezas para BeOn 15-10-2026 (7b)` solo tiene los 7 PDF de insumo, y el trabajo es en BeOn desde la notebook.

---

## Lo que el cambio no cubre (no verificado)

1. **El nombre de máquina de la otra notebook** no se conoce (H6). El de CATA figura en el canon como dato, sin uso.
2. **Los hooks globales corren en TODA sesión de la PC:** estudio, el asistente por área, los espacios de la app, las tareas programadas. `agentes-guard` ya lo hacía, pero bloquea solo en Agent. Estos dos agregan texto en cada arranque y en el primer mensaje (H4, H17).
3. **CATA no recibe el cableado sola** (H7), y cuando lo reciba los `.sh` tienen que estar antes (H2).
4. **OneDrive con archivos solo en la nube** (en la notebook): leer cada PEDIDO los descargaría en cada arranque. Los hooks no tienen `timeout` propio en el settings y quedan con el tope por defecto de Claude Code.
5. **El renglón con texto no se vio llegar en vivo** (H8). El hook de mensajes ya corre callado en 3 sesiones reales. El de arranque y el aviso fuera del repo se van a ver en la primera sesión nueva, la primera reanudación o el primer compactado.

## Propuesta de orden para la sesión principal

H1 y H2 primero: son chicos y se prueban con los tests que ya existen. Después H5 y H3, en `.mjs` y con sus casos de este informe. H4 y H7 son de diseño y conviene que los decida Fak: ¿avisar en cualquier carpeta o solo en `C:\`, `C:\Dev` y la carpeta de usuario? ¿Cablear desde la tarea de cada 2 h? Si se toca un `.sh`, hay que copiarlo también a `~/.claude/hooks/`; si no, el test 5e se pone rojo.
