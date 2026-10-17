# Tanda 7 (la nube) — qué se hizo con cada hallazgo de la ronda 1

Informes: `TANDA7_NUBE_auditor_2026-10-17.md` (auditor Opus, FALLO: 3 importantes) y el veredicto del revisor-pedido
(NO CUMPLE: 5 importantes; quedó en el chat de la sesión). Todo se corrigió en el código y en el canon, con test, y los
dos informes se regeneraron (`node scripts/_nubeSimular.mjs`, `node scripts/_nubeMapa.mjs`).

## Auditor

| # | Hallazgo | Qué se hizo |
|---|---|---|
| A1 | Faltaba la tarea `\Barack - mis mails a la nube` (corre desde `%LOCALAPPDATA%\BarackMailsFak`) | La búsqueda suma `alcance_busqueda.programas_de_esta_pc` (BarackMailsFak, BarackMailsPC, BarackEquipo). El LEEME 4 y el paso 4 ya no dicen «Carlos y Calidad»: el paso 4 lista las carpetas de `_entrada` medidas (hoy 4) |
| A2 | La búsqueda distinguía mayúsculas: no veía `mails_area.mjs` (`'claude barack'`) | Cada carpeta lleva sus `alias` (el nombre de antes de la cuarentena, en las grafías que usa el código) y se busca con `buscarConAlias`. Test con el renglón real |
| A3 | «Nada se bajó» se afirmaba siempre | `fraseEspacio()`: con una baja de más de 200 MB dice cuánto bajó y que la prueba es la columna «En esta PC», no el libre. Los CLI dicen «ningún archivo se abrió», no «nada se bajó». Test con 5,8 → 4,7 GB |
| N1 | `guardianes.mjs:535` no figuraba (el nombre va entre `\|`) | `reTramo` acepta `\|`, `[` y `]` como borde; además el modo multilínea (`m`): un nombre al final de un renglón no contaba en un archivo de varios renglones |
| N2 | Campos `_fuente` contados como código | `esComentario`: en un `.json`, un campo que empieza con `_` es una nota |
| N3 | LEEME 1: «un solo archivo para doble clic» | Ahora: «Cada subcarpeta tiene su instalador; su propio LEEME dice qué archivo se abre» |

## Revisor-pedido

| # | Hallazgo | Qué se hizo |
|---|---|---|
| R1 | El motivo del descarte de «CLAUDE BARACK» lo desmentía el propio simulado | El motivo es ahora el verdadero: nombra a Claude (regla de Fak del 08/10); el guardián no lo frena por casualidad |
| R2 | El tipo salía del nombre y contradecía los números (`6- ARCHIVO DE CORREO` «viejo»; hijas de `FACUNDO` «nuestro») | Tipo nuevo «copia de mails»; `FACUNDO` es «de una persona» y sus hijas también (salvo `PLANOS VW…`, «del cliente»). Columna «Por qué ese tipo» en cada fila de los dos niveles |
| R3 | «Quién escribe» nunca decía quién | `quienPorNombre()` con reglas del canon sobre el nombre y la CARPETA del archivo más nuevo (`nubeMedir.ps1` ahora la mide): programa por PC, copia de mails, canal de pedidos, buzón del equipo, fotos; si no alcanza, lo dice |
| R4 | Falsos positivos en «Programas» (`OBSOLETO` del servidor, `TAOS`/`MIRGOR` lista de clientes) y un falso negativo (`4- BUZON`) | En el mapa, un nombre común cuenta solo si el renglón lo usa como ruta (pegado a una barra o junto a su carpeta de arriba) y no si es del árbol del servidor (`Y:\`, `"HO:`, `"SGC:`); las subcarpetas aceptan el nombre viejo de su carpeta (`CLAUDE POR AREA`). Test con los cuatro casos |
| R5 | El LEEME de `9- VIEJO` afirmaba algo que el simulado desmentía | El LEEME dice el procedimiento («antes de traer algo acá se cambian los programas que lo buscaban»). `_CUARENTENA_CLAUDE POR AREA\4- BUZON` va a `3- BUZON` (siguió recibiendo hasta el 13/10), marcado como decisión mía distinta del árbol |
| Q2 | Qué se rompe en cada PC | Sección nueva «Qué deja de andar en cada PC», con la fuente de cada asignación (`canon.pcs`). De Pedro y Federico solo se ve el instalador `.cmd`: se dice |
| Nits | Fila de la cuarentena con los mails adentro; opciones b y c sin destino; jerga y tildes | La fila muestra lo que queda sin las partes; b y c dicen adónde; se sacaron «P56», «regla 3», «tareas hija-*», «skills»; tildes en canon y LEEME |

## Lo que queda abierto (para el cierre)

- Lo instalado DENTRO de las PC de los compañeros no se ve desde acá (su copia puede ser otra versión).
- `_mails.py` y otros mensajes que solo NOMBRAN una ruta en un texto para el usuario siguen contados como código: se prefirió de más a de menos.
