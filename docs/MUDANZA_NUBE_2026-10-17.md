# Mudanza de la nube a una sola carpeta: «ASISTENTE INGENIERIA» (17/10/2026)

**Dónde quedó:** `BARACK ARGENTINA SRL\Ingeniería y Proyecto - General\ASISTENTE INGENIERIA\`.
**Cuándo:** 17/10/2026, de 22:50 a 22:51, con `node scripts/_nubeMudar.mjs --aplicar` (encargo E261017-012b). Fak lo
decidió el 17/10 a las 19:50: *«si hace falta mover cosas movelas... prefiero organizar todo bien de una vez»*.
**Rama:** `claude/mudanza-nube-1017`, sin push. Lo medido, carpeta por carpeta, quedó en
`exports/explicaciones/nube_mudanza_2026-10-17.json`.

## Cómo quedó

```
Ingeniería y Proyecto - General\
  ASISTENTE INGENIERIA\                         LEEME.txt (nuevo)
    1- INSTALAR (doble clic)\                   ← INSTALAR EN UNA PC NUEVA      (su LEEME: 5 renglones nuevos arriba)
    2- EQUIPO (publicado)\                      ← MEJORAS CLAUDE                (LEEME nuevo)
    3- BUZON (lo que mandan las PC)\4- BUZON\   ← _CUARENTENA_CLAUDE POR AREA\4- BUZON
    4- MAILS DEL EQUIPO\mails\                  ← _CUARENTENA_Claude Barack\mails
    5- FACUNDO (memoria y configuracion)\       ← Claude Fak                    (su LEEME: 5 renglones nuevos arriba)
    6- PEDIDOS ENTRE PC (FACUNDO)\              ← FACUNDO (entera; ningún PEDIDO cambió de nombre)
    9- VIEJO (no usar)\                         ← _CUARENTENA_CLAUDE POR AREA, _CUARENTENA_Claude Barack,
                                                   Base Claude Ingenieria, 0- INSTALAR CLAUDE (entrar aca)
```

En la raíz de la biblioteca ya no queda ninguna carpeta vieja nuestra (`node scripts/_nubeSimular.mjs`, regenerado a
las 22:53: «no queda nada por mover»). Las carpetas que van a `9- VIEJO` conservan su nombre de antes: no son nombres
nuevos, y los programas viejos que todavía corren en alguna PC las buscan así.

## Antes y después, carpeta por carpeta

Medido con `contar()` de `_nubeMudar.mjs` justo antes y justo después de cada movida: archivo por archivo (ruta y
tamaño), sin abrir ninguno. Los archivos de sistema de OneDrive (`desktop.ini`, `Thumbs.db`, `~$…`) no cuentan, igual
que en el simulado. Ninguna carpeta tenía archivos sin subir antes de moverla.

| Carpeta | De | A | Archivos antes / después | Carpetas antes / después | Bytes antes / después |
|---|---|---|---:|---:|---:|
| buzón | `_CUARENTENA_CLAUDE POR AREA\4- BUZON` | `ASISTENTE INGENIERIA\3- BUZON (lo que mandan las PC)\4- BUZON` | 121 / 121 | 13 / 13 | 152.558 / 152.558 |
| mails | `_CUARENTENA_Claude Barack\mails` | `ASISTENTE INGENIERIA\4- MAILS DEL EQUIPO\mails` | 122 / 122 | 8 / 8 | 45.979.552 / 45.979.552 |
| instaladores | `INSTALAR EN UNA PC NUEVA` | `ASISTENTE INGENIERIA\1- INSTALAR (doble clic)` | 618 / 618 | 93 / 93 | 930.864.759 / 930.864.759 |
| lo publicado | `MEJORAS CLAUDE` | `ASISTENTE INGENIERIA\2- EQUIPO (publicado)` | 294 / 294 | 48 / 48 | 2.933.923 / 2.933.923 |
| mi memoria | `Claude Fak` | `ASISTENTE INGENIERIA\5- FACUNDO (memoria y configuracion)` | 9.912 / 9.912 | 1.509 / 1.509 | 7.885.570.508 / 7.885.570.508 |
| pedidos | `FACUNDO` | `ASISTENTE INGENIERIA\6- PEDIDOS ENTRE PC (FACUNDO)` | 111 / 111 | 24 / 24 | 44.947.367 / 44.947.367 |
| área vieja | `_CUARENTENA_CLAUDE POR AREA` (sin el buzón) | `ASISTENTE INGENIERIA\9- VIEJO (no usar)\_CUARENTENA_CLAUDE POR AREA` | 1.331 / 1.331 | 517 / 517 | 366.449.203 / 366.449.203 |
| base vieja | `_CUARENTENA_Claude Barack` (sin los mails) | `ASISTENTE INGENIERIA\9- VIEJO (no usar)\_CUARENTENA_Claude Barack` | 68 / 68 | 53 / 53 | 378.850 / 378.850 |
| paquete viejo | `Base Claude Ingenieria` | `ASISTENTE INGENIERIA\9- VIEJO (no usar)\Base Claude Ingenieria` | 49 / 49 | 18 / 18 | 629.651 / 629.651 |
| instalador viejo | `0- INSTALAR CLAUDE (entrar aca)` | `ASISTENTE INGENIERIA\9- VIEJO (no usar)\0- INSTALAR CLAUDE (entrar aca)` | 2 / 2 | 0 / 0 | 761 / 761 |
| **Total** | | | **12.628 / 12.628** | **2.283 / 2.283** | **9.277.907.132 / 9.277.907.132** |

Los números coinciden con el simulado de la tanda 7 (mismas carpetas; la memoria tenía 9.905 a las 12:14 y 9.912 a
las 22:50, porque siguió subiendo). Después de mover se escribieron los LEEME: 6 nuevos y 2 que ya existían y recibieron
sus cinco renglones arriba, sin perder nada (`1- INSTALAR` y `5- FACUNDO`). No entran en la tabla.

**Subida:** `powershell -File scripts/_nubeSubio.ps1 -Carpeta "ASISTENTE INGENIERIA"` a las 22:53 → *SUBIO TODO: no
queda nada pendiente* (sale con 0).

**Sincronización contra el lugar nuevo:** `_nube.mjs --sincronizar --aplicar` a las 22:52 → *Sincronizado: 9 archivos
movidos*, sin errores (1 memoria y 8 registros de charlas a `5- FACUNDO`). Se corrió con el `_nube.mjs` de main y la
variable `BARACK_NUBE_CEREBRO` apuntando a la carpeta nueva. El de la rama no se corrió con `--aplicar` desde el
worktree porque usa como «repo» la carpeta del worktree y habría subido o bajado `.env.example` y las claves contra esa
carpeta. En seco, el de la rama apunta solo a la carpeta nueva.

**Rutas largas:** unas 6.500 rutas pasan de 260 caracteres en esta PC (6.513 antes de mover, 6.458 medidas después por
el auditor) (ya había 928 antes y OneDrive las sincronizaba;
`LongPathsEnabled = 1`). El tope que manda es el de SharePoint, 400: la más larga quedó en 361. `_nubeMudar.mjs`
frena si alguna pasa de 400.

## Lo que cambió en el código (rama `claude/mudanza-nube-1017`)

**Una sola fuente:** `scripts/_lib/nubeCarpetas.data.json`. Cada carpeta tiene su ruta nueva y sus rutas viejas, y una
sola regla: la nueva si existe; si no, la primera vieja que exista; si no hay ninguna, la nueva (lo que crea, crea en el
lugar nuevo). La aplican `resolverCarpeta()` / `carpetaNube()` en `scripts/_lib/nubeRutas.mjs` (Node) y
`scripts/_lib/nube_carpetas.py` (Python). Los programas que se instalan en otra PC sin el repo llevan los mismos
nombres adentro, y un test verifica que coincidan con el canon.

| Programa | Qué busca | Cómo quedó |
|---|---|---|
| `scripts/_lib/nubeRutas.mjs` (`buscarNube`) | la memoria | por el canon; lo usan `_nube.mjs` y `_frenosMedir.mjs` |
| `scripts/_nube.mjs` | la memoria | por `buscarNube`; su LEEME arranca con los cinco renglones nuevos (no pisa el de la mudanza) |
| `.claude/hooks/cerebro-guard.sh` (+ su test) | la memoria | nombre nuevo primero y después el viejo |
| `scripts/_lib/pedidosPendientes.mjs` + `pedidosCanon.data.json` (hook global `pedidos-pendientes`) | los PEDIDO | clave `pedidos` del canon |
| `scripts/_mails.py` | los mails del equipo | clave `mails`; la búsqueda vieja queda de respaldo |
| `tools/claude-area/puerta.py` | el respaldo del repo en la memoria | clave `facundo` |
| `scripts/_lib/guardianes.mjs` (`FIRMA_EXENTOS_RE`) + `firmaIA.data.json` | la excepción del guardián de firma | también exime `ASISTENTE INGENIERIA\5- FACUNDO (memoria y configuracion)`, colgada de la biblioteca (con su gemelo rojo) |
| `scripts/_lib/viernesPlanificacion.mjs`, `_frenosMedir.mjs`, skill `novedades-claude` | texto con la ruta | la nueva |
| `scripts/_programita.mjs` | el estado de las PC (`_ESTADO.json` de la memoria) | por `buscarNube` (lo marcó el revisor: armaba la ruta vieja a mano y el panel quedaba vacío) |
| `tools/instalar_mi_pc/publicar.mjs`, `tools/claude-area/mails_pc/publicar.mjs`, `tools/claude-area/mejoras/publicar.mjs` | dónde publicar | por el canon (`instalar`, `equipo`) |
| `tools/instalar_mi_pc/instalar_mi_pc.ps1` | la memoria y el Node del paquete viejo | primero el lugar nuevo, después la raíz |
| `tools/claude-area/mails_pc/instalar.ps1`, `subir.ps1` | los mails y la lista de lo privado | primero el lugar nuevo, después la búsqueda de siempre |
| `tools/claude-area/mails_solo/instalar_mails_solo.ps1`, `subir_mails.ps1` | los mails | nuevo, `_CUARENTENA_Claude Barack`, `Claude Barack` |
| `tools/claude-area/mails_area.mjs` | los mails desde el área | por el canon (tramos adentro) |
| `tools/claude-area/vigia.mjs` | el buzón (solo lo lee) | clave `buzon`: `3- BUZON`, y si no el lugar viejo |
| `tools/claude-area/antes_de_la_reunion.py` | el estado del asistente por área (solo lo lee e informa) | clave `area_vieja` |
| `tools/claude-area/ensayo_pc_nueva.sh` | una nube de mentira | el nombre en una variable |
| `scripts/_paquete.mjs`, `tools/claude-area/sync_area.ps1`, `hola/Instalar Claude (doble clic).cmd` | el asistente por área y el paquete «Base Claude», para USARLOS (publicar, instalar, sincronizar) | **sin cambios, a propósito**: el 06/10 el asistente por área se puso en cuarentena cambiándole el nombre para que estos programas no lo encuentren, y la mudanza no lo revive (lo marcó el auditor: la primera versión de la rama los hacía encontrar `9- VIEJO` y publicar ahí). Siguen buscando solo «CLAUDE POR AREA» y «Base Claude Ingenieria» en la raíz, que ya no existen: no encuentran nada y no publican nada. Los nombres en cuarentena y `9- VIEJO` están solo en el canon de la mudanza |
| `tools/paquete-equipo/mails_equipo.py`, `sync_equipo.ps1` | — | no buscan ninguna carpeta (reciben la base ya resuelta): solo cambió el texto de ayuda |
| `scripts/_nubeSimular.mjs` + `nubeOrden.data.json` | el simulado | dice «no queda nada por mover»; FACUNDO con destino `6-` y su LEEME |
| `scripts/_nubeMudar.mjs` (nuevo) | la mudanza | `--simular` (por defecto) y `--aplicar` |
| `CLAUDE.md`, `.claude/rules/{nube-ingenieria,api-claude,video-maquina}.md`, `.claude/pcs/CATA.md` | texto | la ruta nueva de los pedidos y de la memoria |

Tests: `__tests__/scripts/nubeCarpetas.test.mjs` (nuevo: las dos resoluciones por clave en Node y en Python, cada
programa en los dos lugares, la mudanza en verde y en rojo y los LEEME), `mailsSoloNube.test.mjs` (nuevo) y casos
nuevos en `nubeOrden`, `firmaIAGuard`, `instalarMiPc`, `mailsPcCalidad`, `claudeAreaMails` y `cerebro-guard.test.sh`.

## Lo que deja de andar y cómo se vuelve a poner bien

### 1. Hasta que la rama se funda en main (lo hace la sesión que lanzó esta mudanza)

Lo que corre desde `C:\Dev\BarackMercosul` (main) sigue buscando los nombres viejos. Nada de eso pierde datos ni vuelve
a crear una carpeta vieja: lo revisé en el código (cuando no encuentra la carpeta, sale sin escribir).

| Qué | Qué pasa mientras tanto |
|---|---|
| Tarea «Barack - mi asistente al dia» (esta PC, cada 2 h; la próxima a las 23:38) | `_nube.mjs --sincronizar` sale con «NO EXISTE la carpeta» y no sincroniza la memoria ni los registros. Lo que no subió, sube en la primera corrida después de fundir |
| Aviso de pedidos al arrancar una sesión (hook global) | no muestra nada |
| `python scripts/_mails.py --buscar` | ve solo el buzón de Fak, no los mails del equipo |
| `cerebro-guard` | no ve la nube (solo importa en una PC nueva o si otra PC subió después) |
| Guardián de firma | frena un comando que escriba a mano en `5- FACUNDO…\claude-…` (`_nube.mjs` escribe por dentro y no lo frena) |

**Las sesiones abiertas:** el hook `cerebro-guard`, el aviso de pedidos y el guardián de firma los toman solas en cuanto
la rama está en main. `CLAUDE.md` y las reglas (`nube-ingenieria`, `api-claude`, `video-maquina`) entran al arrancar:
una sesión que ya estaba abierta sigue leyendo que los pedidos están en `FACUNDO\` hasta que se la reabre.

**Cómo se pone bien:** fundir la rama en main. Para lo de esta tabla alcanza con eso, porque los hooks y la tarea
corren desde main. La subida de los mails de esta PC es otra cosa: es un programa instalado aparte (tabla de abajo).

### 2. En cada PC (hay que volver a correr el instalador o traer el repo)

| PC | Qué deja de andar | Cómo se vuelve a poner bien |
|---|---|---|
| **Esta PC** | La tarea «Barack - mis mails a la nube» (`%LOCALAPPDATA%\BarackMailsFak\subir.ps1`, instalada el 08/10) no encuentra la carpeta de mails y no sube nada; anota «sin nube» y reintenta. Desde las 12:37 de hoy ya fallaba por otra causa: «Outlook está abierto pero no responde» (a las 10:37, «Outlook cerrado»). | Volver a correr el instalador de mails con los mismos parámetros del 08/10 (`instalar.ps1` de `ASISTENTE INGENIERIA\1- INSTALAR (doble clic)\2- Mails de Calidad`, ya publicado con la versión nueva). Lo hace Claude en una sesión con Fak: registra una tarea de Windows. |
| **CATA** (notebook de Calidad) | (a) Su copia del repo: `_nube.mjs --sincronizar` sale con «NO EXISTE» **antes** de traer el repo de GitHub, así que la versión nueva **no le llega sola**. (b) La subida de los mails de Calidad (tarea «Barack - mails de Calidad»). | (a) Después del push de main: abrir una sesión en `C:\Dev\BarackMercosul` de CATA y correr `git pull` (o dejarle un PEDIDO). (b) Doble clic en `ASISTENTE INGENIERIA\1- INSTALAR (doble clic)\2- Mails de Calidad\Mails-PC-Calidad.cmd` (ya publicado con la versión nueva). |
| **PC de Carlos** | (a) La subida de sus mails (tarea «Barack - mails de Carlos», programa `mails_solo`): no encuentra la carpeta de mails. Subió bien hasta el 16/10 a las 14:02 (`4- MAILS DEL EQUIPO\mails\_salud\CARLOS.json`). (b) Su asistente sabe que las mejoras están en «MEJORAS CLAUDE». | (a) Su instalador (`Mails-Carlos.cmd` + `mails-carlos\`) estaba en `ACTUALIZACION_CLAUDE_LIMPIO`, que fue a la Papelera el 12/10: hay que armarle uno nuevo. Son los dos `.ps1` de `tools/claude-area/mails_solo/` (versión de la rama) en una carpeta de la nube que Carlos vea, más un `Mails-Carlos.cmd` que corra `powershell -NoProfile -ExecutionPolicy Bypass -File instalar_mails_solo.ps1 -Pc CARLOS -Nombre Carlos` (así lo documenta el `.ps1`, renglones 6-7). Lo arma Claude cuando Fak lo diga; Carlos le hace doble clic. Hasta entonces sus mails nuevos no suben y nada se pierde (quedan en su Outlook). (b) Se corrige solo en la próxima publicación de mejoras (`tools/claude-area/mejoras/publicar.mjs` ya escribe la carpeta nueva). |
| PC de Pedro, PC de Federico | nada (el simulado lo midió: sus programas no buscan estas carpetas) | — |
| PC con el asistente por área viejo o el paquete «Base Claude» (en cuarentena) | el área ya no la encontraban desde la cuarentena del 06/10; el paquete «Base Claude» deja de encontrarse ahora (pasó a `9- VIEJO`) | no se reinstalan: están en cuarentena. Ni el código de main ni el de la rama los hacen encontrar `9- VIEJO` |

## Lo que encontré y no es de esta mudanza

- **`AUTOMATIZACION BARACK`** (en la raíz, creada hoy a las 13:22 por la tanda 8) es la otra carpeta del asistente que
  quedó afuera: la cola de automatización de Pedro. No estaba en la lista del encargo y la leen
  `scripts/_automatizacionCandidatos.mjs` (renglón 298) y la tarea de los viernes
  (`docs/AUTOMATIZACION_PEDRO_TAREA_VIERNES.md`), que la buscan en la raíz. Moverla rompe las dos hasta cambiarlas: lo
  decide Fak (sería `ASISTENTE INGENIERIA\7- AUTOMATIZACION` y una entrada más en el canon).
- `ACTUALIZACION_CLAUDE_LIMPIO`, la octava carpeta de la lista del plan del 08/10, ya no estaba: fue a la Papelera el
  12/10 (lo dice `nubeOrden.data.json`). Por eso se movieron 7 carpetas de la raíz más FACUNDO, y 2 partes de adentro
  (el buzón y los mails): 10 movidas en total.
- Los LEEME de `1- INSTALAR` y `5- FACUNDO` tienen sus cinco renglones arriba y, debajo, el texto que ya traían (las
  instrucciones de cada instalador y la guía para dejar otra PC andando): no se recortó para no perderlo.
- El LEEME de `9- VIEJO` dice que ningún programa depende de esa carpeta, y es así: los que publican o instalan no la
  buscan. Solo la miran, sin escribir, `antes_de_la_reunion.py` (informa la versión del área) y los instaladores de
  mails, que leen de ahí la lista de lo privado publicada si existe, como antes la leían de la cuarentena en la raíz.

- `_sinFirmaIA.py` (el de la rama) sobre la carpeta única da **10 bloqueantes, todos por CONTENIDO de archivos que ya
  estaban**: 8 PEDIDO que dicen «PARA TU CLAUDE», un archivo de las mejoras de Carlos cuya carpeta se llama
  `01-tu-claude-sabe-que-sos-vos` y la ruta `C:\ClaudeBarack` del LEEME de los instaladores. La mudanza no creó ningún
  nombre con la palabra Claude: los 9 nombres nuevos (la carpeta única, sus 7 subcarpetas y los LEEME) pasan limpios.
  No aflojé el control para esos 10. Con el detector de main la misma carpeta da 649, porque main todavía no exime
  `5- FACUNDO` (la memoria, como eximía `Claude Fak`): eso se arregla al fundir la rama.
- En la raíz apareció hoy `AUTOMATIZACION BARACK` (la cola de automatización de la tanda 8, que usa
  `scripts/_automatizacionCandidatos.mjs`). No estaba en la lista de la mudanza y quedó donde está.
- El plugin del asistente por área viejo (`comun.mjs`, `carpetaBuzon`, en el repo `barack-claude`) sigue colgando el buzón
  del área. Está en cuarentena y no es de este repo.
- El LEEME de los instaladores no nombra la subcarpeta `5- Mails para el asistente de Leo Lattanzi`, que sí existe.

## Cómo se repite o se vuelve atrás

- `node scripts/_nubeMudar.mjs` (en seco) dice qué falta mover. Si una PC vieja vuelve a crear una carpeta en la raíz,
  aparece como «las dos» y la mudanza no la mezcla sola.
- Volver atrás es renombrar cada carpeta de la tabla a su lugar de antes: también es un cambio de lugar para OneDrive,
  y el código de la rama encuentra las dos.
