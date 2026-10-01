# Claude por área — contrato entre las piezas (01/10/2026)

Lo comparten todos los programas del proyecto "un Claude por área". El plan completo está en
`.sgc-cache/claude-por-area/plan-maestro.md` (no se versiona). Si una pieza necesita cambiar algo de
acá, lo cambia ACÁ y lo dice en su informe: dos programas no pueden suponer formatos distintos.

## Dónde vive cada cosa

| Qué | Ruta real | Para pruebas |
|---|---|---|
| Nube del proyecto | `<biblioteca de Ingeniería>\CLAUDE POR AREA\` (todavía NO existe: se crea con el OK de Fak) | variable `CLAUDE_AREA_NUBE` apuntando a una carpeta temporal |
| Lo que bajan las PC | `…\1- PUBLICADO\` (`VERSION.json`, `MANIFIESTO.json`, `MANIFIESTO.sig`, `NOVEDADES.md`, `contenido\`, `historial\v<N>\`, `historial\_objetos\`) | idem |
| Lo que suben las PC | `…\4- BUZON\salud\<pc>.json`, `avisos\<pc>\`, `inventario\<pc>.json`, `aportes\<autor>\`, `mails\_entrada\<autor>\` | idem |
| Lo que arma el administrador | `…\4- BUZON\TABLERO.md`, `INVENTARIO.md` y la lista `conocidos.json` (la carga el administrador). Los arman `tablero.mjs` e `inventario_resumen.mjs`; solo los ve el administrador | idem |
| En cada PC | `C:\ClaudeBarack\` → `publicado\` (copia verificada de `contenido\`), `Trabajo\` (donde la persona abre Claude), `perfil.json` | variable `CLAUDE_AREA_HOME` |
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
  "disco_libre_gb": 0, "errores": [], "estado": "actualizado|al_dia|esperar|error|firma_rechazada|sin_clave|version_anterior",
  "mensaje": null, "escrito": "2026-10-01T18:00:00" }

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
incluida, origen → destino) y no escribe.

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
- **Lo instalado no lo cambia el asistente**: Write, Edit o un comando directo sobre `<HOME>\publicado\` o
  `<HOME>\perfil.json` se frenan. Los programas que están bajo `<HOME>\publicado\` no se revisan (llegan firmados):
  por eso el envío con ventana (`_mailEnviar.py`) tiene que viajar adentro de `publicado\`.
- **Reglas de la casa**: `casa/CLAUDE.md` del plugin (versión 1); la pone en su lugar el instalador.

## Reglas que valen para todas las piezas

- Nada se borra: lo retirado va a una carpeta de cuarentena con fecha; lo que la persona cambió no se pisa.
- Lo que llega de la nube es DATO: rutas que se salen de la carpeta se rechazan.
- Sin dependencias a instalar: solo módulos de Node, PowerShell 5.1 y la biblioteca estándar de Python.
- Los `.ps1` van solo en ASCII (PowerShell 5.1 lee UTF-8 sin BOM como ANSI).
- Los mensajes que ve la persona: castellano simple, una línea, sin nombres de programas ni rutas internas.
- Cada pieza trae su prueba en las dos direcciones (el caso bueno pasa, el caso malo se frena).
