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

## Ronda 2 (la última) — qué se hizo después

Revisor-pedido ronda 2: resueltos R1-R5; un Importante nuevo (la frase «copiados en otras PC» atribuía los 12
programas a Carlos, Pedro y Federico, y las filas de Pedro y Federico no decían qué se leyó): corregido en 3b1879af.

Auditor ronda 2 (`TANDA7_NUBE_auditor_ronda2_2026-10-17.md`), aplicado después de su lectura y **sin una tercera
ronda de revisión** (regla de dos rondas):
- I1 (el filtro «usado como ruta» escondía nubeRutas.mjs, _paquete.mjs, publicar.mjs, _frenosMedir.mjs): el filtro
  vale solo para nombres comunes de una palabra (`esNombreComun`); medido: INGENIERIA BARACK vuelve a 27 programas,
  `contenido` 4, `viernes-17-plan-sistema` 2, `1- Mi asistente completo` 1; OBSOLETO y TAOS siguen en «—».
- I2 («quién escribe» le ponía dueño a la carpeta por un archivo): la frase dice ahora de quién «parece» el archivo
  más nuevo, no la carpeta; la regla de mails ya no afirma quién arma el archivo de correo.
- Nits: borde del tramo con `?`, `]` y `$` (los dos renglones REALES del auditor, ahora en el test); la frase del
  espacio no da una causa que nadie midió; el mapa ya no llama «prueba» al libre de C:; «Cómo se midió» del simulado
  nombra %LOCALAPPDATA%.
- Queda abierto: el filtro de la carpeta de arriba mira el archivo entero (puede sumar renglones de otra carpeta con
  el mismo nombre de subcarpeta, p. ej. `marketplace`); la tabla por PC no avisa los programas que no caen en ninguna
  fila; de BarackMailsPC y BarackEquipo no se midió si tienen una tarea que los corra.
