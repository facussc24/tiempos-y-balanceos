# Claude por área — contrato entre las piezas (01/10/2026)

Lo comparten todos los programas del proyecto "un Claude por área". El plan completo está en
`.sgc-cache/claude-por-area/plan-maestro.md` (no se versiona). Si una pieza necesita cambiar algo de
acá, lo cambia ACÁ y lo dice en su informe: dos programas no pueden suponer formatos distintos.

## Dónde vive cada cosa

| Qué | Ruta real | Para pruebas |
|---|---|---|
| Nube del proyecto | `<biblioteca de Ingeniería>\CLAUDE POR AREA\` (todavía NO existe: se crea con el OK de Fak) | variable `CLAUDE_AREA_NUBE` apuntando a una carpeta temporal |
| Lo que bajan las PC | `…\1- PUBLICADO\` (`VERSION.json`, `MANIFIESTO.json`, `MANIFIESTO.sig`, `NOVEDADES.md`, `contenido\`, `historial\v<N>\`, `historial\_objetos\`, `publicador.pub` (la clave pública, para la primera instalación), `CLAUDE.md` (el "instalá"; fuera de lo firmado)) | idem |
| Adentro de `contenido\` (firmado) | `marketplace\` (el plugin `barack-area`; único lugar donde viajan hooks), `casa\` (`CLAUDE.md` de la casa, `donde-vive.md`), `conocimiento\comun\` y `conocimiento\<area>\` (una PC recibe lo común más lo de su área), `programas\` (`_paquete.mjs`, `sync_area.ps1`, `inventario.ps1`). Lo arma `tools/claude-area/armar_publicable.mjs` con la lista `tools/claude-area/publicar.data.json` | idem |
| Lo que suben las PC | `…\4- BUZON\salud\<pc>.json`, `avisos\<pc>\`, `inventario\<pc>.json`, `aportes\<autor>\`, `mails\_entrada\<autor>\` | idem |
| Lo que arma el administrador | `…\4- BUZON\TABLERO.md`, `INVENTARIO.md` y la lista `conocidos.json` (la carga el administrador). Los arman `tablero.mjs` e `inventario_resumen.mjs`; solo los ve el administrador | idem |
| En cada PC | `C:\ClaudeBarack\` es la carpeta que la persona ABRE en Claude (la raíz: así `publicado\conocimiento\...` queda adentro y se lee sin pedir permiso). Adentro: `publicado\` (copia verificada de `contenido\`; se repone sola), `.claude\rules\casa.md` (las reglas de la casa, regeneradas en cada actualización), `CLAUDE.md` (de la persona, se crea una vez), `Trabajo\` (SUS archivos; con un `LEEME.txt` si está vacía), `perfil.json`, `instalado.json` (el marcador, se escribe al final) | variable `CLAUDE_AREA_HOME` |
| Configuración de Claude del usuario | `%USERPROFILE%\.claude\settings.json`: el instalador agrega SOLO `extraKnownMarketplaces.barack` (directory → `<HOME>\publicado\marketplace`) y `enabledPlugins["barack-area@barack"]`, con respaldo `settings.json.respaldo-<fecha>` | variable `CLAUDE_CONFIG_DIR` (la misma que lee Claude) |
| Estado de la PC | `%LOCALAPPDATA%\BarackEquipo\` (log, estado, clave pública en modo sin administrador) | variable `CLAUDE_AREA_ESTADO` |
| Clave privada de firma | `%USERPROFILE%\.claude-area\publicador.key` (solo la PC del administrador; nunca al repo ni a la nube) | variable `CLAUDE_AREA_CLAVE` |
| Clave pública | `publicador.pub` (PEM): `C:\Program Files\Claude Barack\` con administrador, o `%LOCALAPPDATA%\BarackEquipo\` sin él | — |

**Ninguna prueba escribe en la nube real ni en `C:\ClaudeBarack`:** todo corre contra carpetas temporales.

## Áreas (identificadores)

`comun` · `calidad` · `ingenieria` · `logistica` · `compras` · `produccion` · `mantenimiento` · `rrhh` · `direccion`.
Una PC instala lo `comun` más lo de su área.

## Formatos compartidos (JSON, UTF-8 sin BOM)

```jsonc
// perfil.json (lo escribe el instalador desde personas.json; lo lee el hook de arranque)
{ "nombre": "", "mail": "", "area": "compras", "puesto": "", "rol": "usuario", "pc": "", "usuario_windows": "" }

// personas.json (viaja firmado dentro de contenido\conocimiento\)
{ "personas": [ { "nombre": "", "mail": "", "usuario_windows": "", "pc": "", "area": "", "puesto": "",
                  "rol": "usuario|responsable_area|admin|suplente", "mails": "sube|no_sube|habilitado", "baja": null } ] }

// salud.json (una por PC, se pisa en cada corrida de la tarea). La escribe `_paquete.mjs --actualizar` al
// terminar (salga bien o mal) con lo que sabe; politica/outlook/python/discos quedan en null hasta que la
// tarea los complete. `estado` y `mensaje` los agrega _paquete.mjs: la espera por OneDrive va en `mensaje`
// y NO en `errores` (que es lo que el tablero pinta de rojo).
{ "pc": "", "usuario_windows": "", "area": "", "version_instalada": 0, "version_publicada_vista": 0,
  "ultima_sync_ok": "2026-10-01T18:00:00", "firma_ok": true, "politica": "si|no",
  "outlook": "clasico|nuevo|cerrado|no", "python": true, "ve_Y": true, "ve_Z": true,
  "disco_libre_gb": 0, "errores": [], "estado": "instalado|actualizado|al_dia|esperar|error|firma_rechazada|sin_clave|version_anterior",
  "mensaje": null, "repuestos": [], "extranos": [], "escrito": "2026-10-01T18:00:00" }
//   politica, python, ve_Y, ve_Z y disco_libre_gb los completa la tarea `sync_area.ps1` después de cada --actualizar.

// inventario\<pc>.json
{ "pc": "", "usuario_windows": "", "relevado": "2026-10-01T18:00:00",
  "programas": [ { "nombre": "", "version": "", "editor": "", "instalado": "2026-01-31", "alcance": "maquina|usuario" } ] }
  // "instalado" va vacio ("") cuando Windows no trae una fecha valida: no se inventa.

// avisos\<pc>\<archivo>  (uno por aviso; los escriben la tarea de sync y los hooks; los lee tablero.mjs)
//   Un .json asi (nivel: urgente|hoy|semanal; "cuando" opcional, si falta vale la fecha del archivo):
{ "nivel": "hoy", "tipo": "disco_lleno", "mensaje": "queda poco lugar en el disco", "cuando": "2026-10-01T18:00:00" }
//   o un texto suelto (.txt/.md): la primera linea es el mensaje y el tipo sale del nombre del archivo
//   ("20261001-081500-sin_politica.txt" -> tipo "sin_politica"). Maximo 64 KB por aviso.

// conocidos.json  (en 4- BUZON; lo mantiene el administrador; lo lee inventario_resumen.mjs)
{ "conocidos": [ { "nombre": "TeamViewer*", "para_que": "Soporte remoto de IT" },
                 { "patron": "^Microsoft Visual C\\+\\+ .* Redistributable", "para_que": "Librerias de otros programas" } ] }
//   "nombre": igual al del programa sin distinguir mayusculas; un * vale por cualquier texto. "patron": expresion regular.
```

Fechas sin zona horaria (`2026-10-01T18:00:00`) valen como hora local de la PC que las escribió; el tablero
también acepta ISO con `Z`.

## Lo que el administrador ve (tablero e inventario)

- **`salud.json` → semáforo** (`tools/claude-area/tablero.mjs`): VERDE = `version_instalada` al día con la mayor
  `version_publicada_vista` de todas las PC + `firma_ok: true` + `ultima_sync_ok` de hace **menos de 2 días**;
  AMARILLO = atrasada, `politica` distinta de `si`, `firma_ok` ausente, o 2 a 7 días sin sincronizar;
  ROJO = **más de 7 días**, `firma_ok: false`, `ultima_sync_ok` vacía o ilegible, `errores` **no vacío**, o el
  archivo de salud roto / ausente (una PC con `avisos\` y sin `salud\`). Gana el peor color.
  Por eso quien escribe `salud.json` pone en `errores` solo lo que sigue mal **en esa corrida** y lo deja `[]` cuando
  se arregló: un error viejo que nadie borra deja la PC en rojo para siempre.
- `node tools/claude-area/tablero.mjs` arma `TABLERO.md`; con `--linea` imprime solo la línea resumen
  (`12 PC: 10 verdes, 1 amarilla, 1 roja: compras-02 sin sincronizar desde el 24/09`) y no escribe nada: es lo que
  llama el hook de arranque de la sesión del administrador. Sale con 1 y avisa por `stderr` si no encuentra la carpeta.
- `node tools/claude-area/inventario_resumen.mjs` arma `INVENTARIO.md` (solo describe; no recomienda sacar nada).
- Ambos reciben `--buzon <carpeta 4- BUZON>` (o usan `CLAUDE_AREA_NUBE`), `--salida`, `--stdout` y `--ahora` (para pruebas).
- `inventario.ps1 -Salida <archivo o carpeta> [-Mostrar]` escribe `inventario\<pc>.json`; solo lee el registro
  (`Uninstall` de HKLM, WOW6432Node y HKCU), deja afuera componentes del sistema y actualizaciones, y con `-Mostrar`
  enseña en pantalla qué juntó. `-Claves` existe solo para las pruebas.

## Lo que define `scripts/_paquete.mjs` (publicar, actualizar, chequear) — 01/10/2026

`VERSION.json`, `MANIFIESTO.json` y la firma los define `scripts/_paquete.mjs` (dueño de ese formato): quien los
lea usa las funciones que ese archivo exporta (`leerPublicacion`, `verificarFirma`, `chequear`, `leerInstalado`),
no los interpreta por su cuenta. Lo que sigue es para saber qué esperar, no para reimplementarlo.

**Cómo elige la nube, el destino y las claves** (lo explícito le gana a la variable):

| Qué | Variable del contrato | Opción | Sin nada |
|---|---|---|---|
| Nube publicada | `CLAUDE_AREA_NUBE` → `<ella>\1- PUBLICADO` (implica `--proyecto area`) | `--nube <carpeta>` | `--proyecto area` la busca por patrón en la biblioteca; por defecto sigue siendo `Base Claude Ingenieria` |
| Destino en la PC | `CLAUDE_AREA_HOME` → `<ella>\publicado` | `--destino <carpeta>` | la carpeta de arriba de la carpeta del script |
| Clave privada (solo quien publica) | `CLAUDE_AREA_CLAVE` | `--clave <archivo>` | `%USERPROFILE%\.claude-area\publicador.key` |
| Clave pública (la PC que actualiza) | `CLAUDE_AREA_ESTADO` → `<ella>\publicador.pub` (y SOLO ahí) | `--clave-publica <archivo>` | `%ProgramFiles%\Claude Barack\` y después `%LOCALAPPDATA%\BarackEquipo\`; si no hay, la PC no exige firma y lo dice |
| Área de la PC | `CLAUDE_AREA_HOME\perfil.json` → `area` | `--area <id>` (o `todas`) | `<destino>\perfil.json`, después `<destino>\.claude\perfil-equipo.json`; sin área = solo lo `comun` |

**Formatos en la nube publicada** (todo JSON canónico, claves ordenadas):

```jsonc
// MANIFIESTO.json — sin `areas` en un archivo = ["comun"]; `lapidas` = lo retirado y desde cuándo
{ "formato": 1, "version": 3, "generado": "2026-10-01T18:00:00",
  "archivos": { ".claude/skills/x/SKILL.md": { "sha256": "<64 hex>", "bytes": 1234, "areas": ["calidad", "comun"] } },
  "lapidas": [ { "ruta": "scripts/viejo.py", "desde_version": 3, "motivo": "salió de la lista de publicación", "sha256": "<hash que tenía publicado, o null>" } ] }

// MANIFIESTO.sig — firma Ed25519 de los BYTES exactos de MANIFIESTO.json; `clave` es la huella (16 hex) de la pública
{ "formato": 1, "algoritmo": "ed25519", "firma": "<base64>", "manifest_sha256": "<64 hex>", "clave": "<16 hex>" }

// VERSION.json — se escribe AL FINAL; `firma` es null si la publicación no está firmada
{ "formato": 1, "version": 3, "fecha": "2026-10-01T18:00:00", "archivos": 45, "bytes": 512000,
  "manifest_sha256": "<64 hex>", "firma": { "algoritmo": "ed25519", "sha256": "<sha256 de MANIFIESTO.sig>", "clave": "<16 hex>" }, "lapidas": 1 }
```

- `historial\v<N>\MANIFIESTO.json` (+ `MANIFIESTO.sig`) por cada versión publicada; el contenido vive en
  `historial\_objetos\<2 hex>\<sha256>`, un archivo por hash (lo que no cambió entre versiones no se repite).
  `--publicar --rollback <N>` vuelve a publicar la versión N como versión nueva, firmada; lo que no estaba en N
  queda como lápida.
- **Firma:** una PC con `publicador.pub` instalada exige firma válida. Sin firma, firma de otra clave, firma
  dañada o manifiesto tocado → no toca nada, código de salida **4**, y `salud.json` queda con
  `firma_ok: false`, `estado: "firma_rechazada"`. Si `VERSION.json` declara firma y `MANIFIESTO.sig` todavía no
  bajó → código 3 (esperar). **En el proyecto `area`** (por `--proyecto area`/`CLAUDE_AREA_NUBE`, o porque la
  nube ES `1- PUBLICADO`) una PC **sin** `publicador.pub` no instala nada: código **4**, `estado: "sin_clave"`,
  mensaje "a esta PC le falta la clave para comprobar que la actualización es de Barack: avisale al administrador";
  y `--publicar` ahí sin clave privada se niega (salvo `--sin-firma`). Solo en el proyecto `ingenieria` una PC sin
  clave pública sigue instalando como antes y lo dice (compatibilidad con lo ya instalado).
- **La versión nunca retrocede:** `MANIFIESTO.json` lleva `version` adentro (firmada) y tiene que coincidir con
  `VERSION.json`, si no la publicación es inválida. Un rollback legítimo sale como versión N+k, así que una nube
  con versión MENOR que la instalada (un manifiesto viejo vuelto a poner con su firma legítima) → código **4**,
  `estado: "version_anterior"`, error en la salud, nada se toca. Una PC sin nada instalado no compara.
- **Lápidas en la PC:** si el archivo local es idéntico a lo publicado se MUEVE a
  `<destino>\.claude\_cuarentena-paquete\<fecha>\<ruta>` (un rename; nunca se borra); si la persona lo había
  cambiado se queda y se anota en `<destino>\.claude\paquete-pendientes.md`.
- **Pendrive:** `--pendrive` deja `publicador.pub` en la raíz del pendrive, al lado de `Instalar.*` (la privada nunca).

**En la PC** — `<destino>\.claude\.paquete-instalado.json`: `version` (entero), `manifest_sha256`, `area`, `firma`
(`valida` | `no_verificada`), `actualizado`, `archivos` (ruta → sha256 instalado), `pendientes`. Es lo que compara
`--chequear`.

**`--chequear`** (lo llama el aviso al abrir Claude; lee dos archivos chicos, no verifica hashes ni copia):
imprime UNA línea JSON `{ "estado", "publicada", "instalada", "fecha_publicada", "firmada", "ms" }` y sale con
**0** `al_dia` · **2** `hay_novedades` · **3** `sin_nube` o `nube_incompleta` · **5** `sin_instalar`. Medido: 2 ms
adentro; con el arranque de Node, lo que tarde Node en esa PC.

**`--actualizar`** sale con 0 bien · 1 error · 3 nube incompleta u otra sincronización corriendo · **4 la PC no
acepta lo publicado** (firma inválida o ausente, le falta la clave pública en el proyecto `area`, o la versión
retrocede; cuál fue lo dice `estado` en la salud). `--simular` es su dry-run: imprime el plan (cuarentena
incluida, origen → destino) y no escribe. En el proyecto `area`, con `--home` (o `CLAUDE_AREA_HOME`), además
regenera `<HOME>\.claude\rules\casa.md` desde `publicado\casa\CLAUDE.md`.

**`publicado\` se repone solo (proyecto `area`).** Como queda adentro de la carpeta que abre el asistente, un archivo
de ahí puede cambiarse o borrarse por error. En `--actualizar --proyecto area` (y en la tarea): todo archivo del
manifiesto firmado que en la PC falte o tenga otro hash se repone desde la nube verificada, aunque la versión no haya
cambiado; el archivo cambiado va antes a `publicado\.claude\_cuarentena-paquete\<fecha>\<ruta>` (nada se pierde) y la
salud lleva `repuestos: [rutas]` y `mensaje: "N archivo(s) repuesto(s)..."`. Lo que aparezca adentro de `publicado\` y
no esté en el manifiesto no se borra: va a `extranos: [rutas]` de la salud. El registro `.paquete-instalado.json` guarda
`proyecto` y `huellas` (tamaño + fecha de cada archivo instalado): `--chequear` las compara sin hashear (2-5 ms) y, si
algo falta o cambió, sale con el código 2 de "hay novedades" y `motivo: "instalacion_tocada"` (+ `cambiados`); con una
versión nueva, `motivo: "version_nueva"`. La reposición la hace solo `--actualizar`.

**Raíces por proyecto.** En `ingenieria` lo publicado cae en `.claude/skills`, `.claude/rules`, `.claude/commands`,
`.claude/agents`, `scripts`, `docs`, `tools` y `CLAUDE.equipo.md`. En `area` cae SOLO en `marketplace/`, `casa/`,
`conocimiento/`, `programas/`; un `.md` con `hooks:` en el encabezado se acepta únicamente adentro de `marketplace/`.
El manifiesto declara `"proyecto": "area"` (firmado): una PC valida las rutas con las raíces de ese proyecto. La lista
del proyecto puede declarar `sin_filtro_identidad` (hoy la lista de personas): esos archivos pasan el filtro de claves
y rutas pero no el del nombre de usuario de quien publica, porque nombran a todos.

**El Node del plugin (03/10/2026).** `marketplace/plugins/barack-area/bin/node.exe` viaja firmado como cualquier otro
archivo: lo copia `armar_publicable.mjs` al armar (el mismo `node.exe` que lo corre, u otro con `--node`) y la lista lo
declara en `ejecutables` por su ruta exacta. Un archivo de `ejecutables` no pasa el filtro de texto ni el tope de 15 MB
(tope propio: 120 MB) y no cuenta en el tope total; a cambio tiene que estar y empezar como un programa de Windows
("MZ"), y cualquier otro `.exe`, `.dll`, `.com`, `.scr` o `.msi` que no esté declarado frena la publicación. Lo usan:
los controles del plugin (`hooks/hooks.json` lo llama por `${CLAUDE_PLUGIN_ROOT}/bin/node.exe`, sin consola), la
primera instalación (`1- PUBLICADO\CLAUDE.md` corre el instalador con el de `contenido\`) y la tarea de la PC
(`sync_area.ps1`, con una copia en el estado de la PC). Motivo: un control que no puede arrancar no frena nada, y las
PC de planta no tienen Node.

## Instalar una PC nueva (`--instalar`, proyecto `area`) — 01/10/2026

`node <1- PUBLICADO>\contenido\programas\_paquete.mjs --instalar --proyecto area --nube <1- PUBLICADO>` (es lo que
hace Claude cuando alguien abre esa carpeta y escribe "instalá": `1- PUBLICADO\CLAUDE.md`, fuente
`tools/claude-area/hola/CLAUDE.md`). Opciones: `--home` (o `CLAUDE_AREA_HOME`), `--claude-dir` (o `CLAUDE_CONFIG_DIR`),
`--clave-publica`, `CLAUDE_AREA_ESTADO`. Pasos, en este orden; cada uno repetible:

1. **La clave pública**: la indicada, si no la ya fijada en `<ESTADO>\publicador.pub`, si no (por única vez) la que
   viaja en `1- PUBLICADO\publicador.pub`, que queda fijada. **Riesgo (confianza en el primer uso):** quien pueda escribir
   en la biblioteca en el momento de ESA primera instalación puede plantar su clave y su publicación; desde la segunda vez
   un cambio de clave se rechaza. La forma segura es que la primera clave llegue por el pendrive o la ponga el
   administrador con `--clave-publica`. Sin clave → código 4, `sin_clave`, nada escrito.
2. **La publicación**: completa y firmada con esa clave (si no → 3 esperar, o 4 y nada escrito).
3. **Quién es**: `conocimiento\comun\personas.json` (o `conocimiento\personas.json`), verificado por hash contra el
   manifiesto firmado ANTES de leerlo; se busca por `usuario_windows` (sin mayúsculas ni tildes) y después por `pc`; las
   bajas no cuentan. Si no figura: `perfil.json` con `area: "comun"` y `nombre: ""` (el aviso de arranque pregunta una
   vez), y un aviso `sin-persona` en `4- BUZON\avisos\<pc>\` (una sola vez por perfil escrito). `perfil.json` se
   escribe acá; si cambia, el anterior queda como `perfil.json.anterior-<fecha>`.
4. **La copia**: `--actualizar` con el área del perfil hacia `<HOME>\publicado\` (nunca pisa, nunca borra).
5. **La casa**: `<HOME>\.claude\rules\casa.md` (copia de `publicado\casa\CLAUDE.md` con un encabezado; se regenera en
   cada actualización), `<HOME>\CLAUDE.md` corto solo si no existe (es de la persona) y `Trabajo\` con un `LEEME.txt`
   si está vacía. Migración: un `Trabajo\.claude\rules\casa.md` de la versión anterior pasa a la cuarentena de lo
   publicado (no se borra); el `Trabajo\CLAUDE.md` de la persona no se toca.
6. **El plugin**: `settings.json` del usuario con solo las dos claves de arriba, respaldo antes; un `settings.json` que no
   se entiende no se toca y la instalación queda sin marcador.
7. **El marcador `instalado.json`**, al final, y `salud.json` con `estado: "instalado"`. Correrlo de nuevo con todo igual
   da `ya_instalado` y no escribe nada.

Códigos de `--instalar`: 0 instalado o ya instalado · 1 error · 3 esperar · 4 sin clave, firma rechazada o versión que
retrocede. El marcador se mira junto con `publicado\marketplace\.claude-plugin\marketplace.json`: los dos, o se repite.

### Una PC que no ve la nube y una persona que no está en la lista (03/10/2026)

Motivo: la biblioteca de Ingeniería la ven Ingeniería y Calidad, y la lista de personas real todavía no tiene a nadie.
Una PC de planta no podía instalar, y si instalaba quedaba sin área.

- **Desde un pendrive o una carpeta copiada.** Si `--instalar` no recibe nube (ni `--nube` ni `CLAUDE_AREA_NUBE`) y la
  biblioteca no está a la vista (o su `1- PUBLICADO` todavía no trae `VERSION.json`), el programa instala desde la
  carpeta publicada **en la que él mismo vive** (`<carpeta>\contenido\programas\_paquete.mjs` con `VERSION.json` y
  `MANIFIESTO.json` arriba de `contenido\`: `publicadoDeEstePrograma`). Si la nube está a la vista, manda la nube. Lo
  demás no cambia: clave fijada en el primer uso, manifiesto firmado, hash de cada archivo. Vale solo para
  `--instalar`; `--actualizar` y `--chequear` siguen mirando la nube (una PC instalada así da `sin_nube`, con su
  `instalada`, y no se actualiza sola: se instala de nuevo desde una carpeta más nueva). El marcador lleva
  `"origen": "carpeta"`. El buzón se usa solo si la carpeta trae la forma de la nube (`1- PUBLICADO` con `4- BUZON` al
  lado); en una copia con otro nombre no se escribe nada adentro. Para la regla "todo o nada", la carpeta del programa
  no cuenta ni como de prueba ni como real.
- **`Instalar.cmd`** (fuente `tools/claude-area/hola/Instalar.cmd`; `armar_publicable.mjs` lo deja en la raíz de lo
  publicado, al lado del `CLAUDE.md` del "instalá", fuera de lo firmado, siempre con fines de línea de Windows): doble
  clic, sin abrir Claude. Corre `--instalar --proyecto area --preguntar` con el Node del plugin y devuelve su código
  (3 si a la carpeta le faltan archivos). Como no recibe opciones, para probarlo con carpetas de prueba la
  configuración de Claude va por la variable `CLAUDE_AREA_USUARIO_HOME` (vale lo mismo que `--usuario-home`), junto con
  `CLAUDE_AREA_HOME` y `CLAUDE_AREA_ESTADO`: las tres, o se niega.
- **Quien no figura dice su área.** `--area "<área>" --nombre "<nombre>" --puesto "<puesto>"` (es lo que pasa Claude
  después de preguntarle, Paso 2 bis del "instalá"), o `--preguntar` (el `.cmd`: mira primero, sin escribir, si la
  persona figura; si no, pregunta en la consola; sin consola a la vista no pregunta). El área se acepta con el nombre de
  todos los días, el identificador o el número del menú (`areaDeclarada`); `comun` no se declara. El `perfil.json`
  lleva `"declarado": true` y `rol: "usuario"`; sin nombre queda el usuario de Windows. **La lista manda:** si la
  persona figura, lo declarado se ignora (y lo dice); si figura dada de baja, no puede declararse; cuando entra a la
  lista, el perfil pasa a ser el de la lista. Repetir sin decir nada conserva lo declarado por ese mismo usuario en esa
  PC. Un área que no existe no instala nada (código 1). El aviso `sin-persona` dice qué declaró.
- **Si Windows no deja escribir** (permiso, disco lleno, archivo en uso): una línea que se entiende y código 1, sin la
  traza del programa (`mensajeDeError`).
- **Ensayo sin tocar nada real:** `bash tools/claude-area/ensayo_pc_nueva.sh [área]` publica con una clave temporal,
  copia a un "pendrive", instala con el Node del pendrive sin Node ni Git en el PATH y sin nube, y arranca la primera
  conversación con el programa de la app y una configuración de Claude recién creada: el plugin se carga solo en esa
  primera conversación y el aviso de arranque sabe quién es (medido el 03/10/2026 con el programa 2.1.286: 6 de 6,
  instalación en 5 segundos). Lo que el ensayo no ve: instalar el programa Claude e iniciar sesión, los carteles de la
  app, y lo que una PC de la empresa prohíba (crear `C:\ClaudeBarack`, correr un programa desde un pendrive).

**Lo que no puede pasar (incidente del 01/10: un `--help` ignorado instaló de verdad y tocó el `settings.json` real):**
- `--help` / `-h` muestran el uso y salen con 0 sin tocar nada. Una opción que el programa no conoce, o un argumento
  suelto, es un error de una línea que lo nombra, código 1, y NO se ejecuta nada (vale para todos los comandos de
  `_paquete.mjs` y de `armar_publicable.mjs`).
- **Todo o nada.** `--instalar`: si CUALQUIERA de `CLAUDE_AREA_HOME`/`--home`, `CLAUDE_AREA_NUBE`/`--nube`,
  `CLAUDE_AREA_ESTADO` o `--usuario-home` (la carpeta `.claude` del usuario, donde está su `settings.json`) está
  indicada y alguna otra no, se niega con código 1 ("estás mezclando carpetas de prueba y reales…"). Para probar van las
  cuatro; para instalar de verdad, ninguna. `--actualizar` en `area`: lo mismo con PC (`--home`/`--destino`), nube y
  estado; y las reglas de la casa se regeneran solo con una carpeta de PC indicada, nunca con la real por defecto. `sync_area.ps1`:
  `-HomeDir`/`-Nube`/`-EstadoDir` (o sus variables) las tres o ninguna, si no sale con 2 antes de escribir nada; la
  tarea registrada no pasa ninguna.
- **La PC del administrador no se instala sola.** Una instalación de verdad (sin rutas de prueba) se niega si en la PC
  está la clave privada de firma en su lugar real, si la carpeta de la PC está adentro de un repo git, o si el programa
  corre desde el repo de origen (el que tiene la lista de publicación): código 1 con el motivo, salvo `--forzar`.
- `--instalar --simular` lista cada ruta que escribiría (clave fijada, perfil, cada archivo publicado, las reglas de la casa, el
  `settings.json` del usuario con las dos claves y su respaldo, el aviso, el marcador, la salud) y no escribe ninguna.
- Publicar en `area` sin `--nube` ni `CLAUDE_AREA_NUBE` (la nube se buscaría por nombre: la REAL) exige `--nube-real`,
  tanto en `_paquete.mjs --publicar --proyecto area` como en `armar_publicable.mjs --publicar`.

**La tarea de la PC** es `programas\sync_area.ps1` (viaja en lo publicado; solo ASCII): 1) `--actualizar --proyecto area`
(códigos 0/3/4), 2) mueve la cola local `<ESTADO>\avisos-pendientes\<pc>\*.json` a `4- BUZON\avisos\<pc>\` (uno por uno,
sin pisar: si el nombre existe agrega `-2`; `-Simular` solo lo lista), 3) `inventario.ps1` una vez por semana
(marca `<ESTADO>\inventario-ultimo.txt`), 4) completa en la salud `politica`, `python`, `ve_Y`, `ve_Z`,
`disco_libre_gb`, 5) mails: gancho sin uso. Deja `<ESTADO>\estado.json` y `sync.log`; sale siempre con 0. La tarea de
Windows ("Barack - Claude por area": al iniciar sesión y cada 4 h, sin ventana) se registra SOLO con `-RegistrarTarea`;
`-VerTarea` la muestra sin registrar.

## Lo que usa el plugin `barack-area` (aviso de arranque y controles) — 01/10/2026

Vive en `C:\Dev\barack-claude\plugins\barack-area\` (hooks en Node, sin dependencias). Qué frena y qué no
frena cada control: `NOTAS.md` del plugin.

- **Aviso de arranque** (`hooks/arranque.mjs`, SessionStart): lee `<HOME>\perfil.json` (sin perfil, o con un `area`
  que no está en la lista, le dice al asistente que pregunte una sola vez nombre, área y puesto y deja un aviso
  `sin-perfil` / `perfil-roto`, una vez por día). La versión la pide con
  `node <HOME>\publicado\{programas|scripts|.}\_paquete.mjs --chequear --proyecto area --destino <HOME>\publicado`
  (espera 0,9 s como mucho y usa la línea JSON, salga con el código que salga). Si ese programa no está, compara
  `manifest_sha256` (o `version`) de `<HOME>\publicado\.claude\.paquete-instalado.json` contra
  `<NUBE>\1- PUBLICADO\VERSION.json`. No actualiza ni lanza la tarea: solo mira y avisa.
- **Tabla "dónde vive cada dato"** que imprime el aviso: `<HOME>\publicado\conocimiento\donde-vive.md` si existe
  (los renglones que empiezan con `- `, hasta 12); si no, la que trae el plugin en `casa/donde-vive.md`.
- **La nube, vista desde un hook**: `CLAUDE_AREA_NUBE`; sin la variable se busca POR NOMBRE la carpeta
  `CLAUDE POR AREA` en `<perfil de Windows>\<...BARACK...>\` (a verificar en una PC que no sea la del administrador;
  si la política de la PC define `CLAUDE_AREA_NUBE` en su bloque `env`, no hace falta buscar).
- **Avisos de los controles**: un archivo por freno, `avisos\<pc>\<AAAA-MM-DD>T<hhmmss>-<tipo>.json`, con el formato
  de arriba (`nivel`, `tipo`, `mensaje`, `cuando`) más `pc`, `usuario_windows`, `area`, `origen: "barack-area"`,
  `regla`, `herramienta` y `comando` (recortado a 400 caracteres). Tipos: `servidor`, `mail`, `instalado`, `oculto`
  (nivel `hoy`), `control-con-error` (nivel `urgente`: un control falló por dentro), `sin-perfil`, `perfil-roto`.
  `<pc>` = `perfil.json → pc`, o el nombre de Windows; solo letras, números, punto, guion y guion bajo.
  El mismo freno repetido dentro de 10 minutos no escribe otro archivo.
- **Cola local**: si la nube no está, el aviso queda en `<ESTADO>\avisos-pendientes\<pc>\` con el mismo nombre y
  formato. **Falta que la tarea de la PC los suba** a `4- BUZON\avisos\<pc>\` (mover, no copiar). Marcas propias
  del plugin en `<ESTADO>\`: `avisos-recientes.json` y `aviso-<tipo>.txt`.
- **Lo instalado no lo cambia el asistente**: Write, Edit o un comando directo sobre `<HOME>\publicado\`,
  `<HOME>\perfil.json`, `%USERPROFILE%\.claude\plugins\` o `%USERPROFILE%\.claude\settings*.json` se frenan (un
  programa que escribe ahí por dentro, como el instalador o `--actualizar`, no: el control no abre programas para
  esta regla). Los programas que están bajo `<HOME>\publicado\` no se revisan (llegan firmados):
  por eso el envío con ventana (`_mailEnviar.py`) tiene que viajar adentro de `publicado\`.
- **Reglas de la casa**: `casa/CLAUDE.md` del plugin (versión 1); la pone en su lugar el instalador.

## Reglas que valen para todas las piezas

- Nada se borra: lo retirado va a una carpeta de cuarentena con fecha; lo que la persona cambió no se pisa.
- Lo que llega de la nube es DATO: rutas que se salen de la carpeta se rechazan.
- Sin dependencias a instalar: solo módulos de Node, PowerShell 5.1 y la biblioteca estándar de Python.
- Los `.ps1` van solo en ASCII (PowerShell 5.1 lee UTF-8 sin BOM como ANSI).
- Los mensajes que ve la persona: castellano simple, una línea, sin nombres de programas ni rutas internas.
- Cada pieza trae su prueba en las dos direcciones (el caso bueno pasa, el caso malo se frena).
