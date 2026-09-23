# Contrato de Autonomia — que hago solo vs que requiere OK de Fak

Si dudo entre dos filas, aplico la mas restrictiva. Principios: hacer sin preguntar si el camino es claro; preguntar solo cuando falta info de dominio real que no obtengo con tools; ante 2-3 caminos validos, AskUserQuestion; ante datos ambiguos, leer contenido real antes de actuar.

## A. Datos en Supabase

| Operacion | Autonomia |
|---|---|
| Leer (query) | Libre |
| Escribir 1 documento | Confirmar antes — mostrar diff |
| Batch .mjs que toca `data` de amfe_documents | **`runWithValidation()` obligatorio** + confirmar + dry-run (skill `supabase-safety`) |
| Batch .mjs solo metadata | Confirmar + dry-run |
| Borrar documento / crear familia / migracion de schema | Siempre preguntar |
| Backup (`_backup.mjs`) | Libre (obligatorio al fin de sesion) |

## B. Documentos APQP (contenido tecnico)

| Accion | Autonomia |
|---|---|
| Asignar/cambiar CC o SC | **Prohibido** sin autorizacion explicita |
| Crear acciones de optimizacion | **Prohibido inventar**; un AP=H sin accion va con la celda VACIA (el placeholder quedo prohibido el 21/09/2026, amfe.md §4) |
| Asignar S/O/D en causas nuevas | Libre con guia amfe.md; marcar `_autoFilled` |
| Regenerar CP desde AMFE | Confirmar antes |
| Crear AMFE desde cero | Siempre preguntar (necesito PPAP/referencia) |
| Propagar maestro → variantes | Confirmar + leer contenido real de origen y destino |
| Clasificar proceso por nombre de OP | **Prohibido** sin leer contenido (amfe.md §10) |

## C. Codigo de la app

| Accion | Autonomia |
|---|---|
| Fix de typo/bug obvio + test + push | Libre (regla git-deploy) |
| Feature no trivial / refactor | Plan primero, Fak aprueba |
| Remover feature / borrar archivos | Siempre preguntar |
| Cambiar dependencias | Confirmar antes |
| Tocar boton dev-login | **Prohibido** (regla dev-login) |

## D. Auditoria e integraciones

- Scripts read-only de auditoria: libre. Agente `auditor` al cerrar tareas: obligatorio.
- NO flaggear como problema: AP=H con la accion vacia (estado valido, amfe.md §4).
- Correcciones detectadas: solo codigo obvio = libre; datos = confirmar antes.
- Docs de empresa (servidor Y:/OneDrive): leer = libre; extraer al cache `.sgc-cache/` = libre (gitignoreado); escribir/mover en Y:\ = confirmar antes.
- `git commit` + `push` al cerrar tareas de codigo: libre (build antes).

## E. Fallar al lado seguro

Operacion no listada: si es reversible (local, sin push, sin Supabase) → hacer; si es irreversible o toca datos/produccion → preguntar; si exige inventar datos tecnicos → TBD y avisar.

## F. La PRIMERA VEZ se pregunta — regla de Fak, 21/09/2026

**Si es la primera vez que hago un tipo de trabajo, pregunto ANTES de tocar nada de la empresa.**
No importa que el camino parezca claro: lo que no se es que NO SE.

Fak, 21/09/2026, despues de que emitiera un flujograma Rev.A en tres carpetas del servidor
—una de ellas el paquete que va al cliente— sin que el lo viera: *"si nunca lo hiciste, si es
tu primera vez haciendo algo, preguntame antes... esta era tu primera vez laburando en un APQP.
Ahora sabes que el plano lo podes cargar, pero todo lo demas no sabes que poner en input"*.

Que cuenta como "primera vez": un tipo de documento, un tipo de carpeta o un circuito que no
hice antes en este proyecto. La prueba es simple — **si no puedo nombrar el caso anterior, es
la primera vez.**

Y la pregunta no es "¿puedo?": es **"esto va aca, ¿esta bien?"**, con la ruta y el archivo
concretos. Fak ajusta el criterio y eso queda escrito para que no se vuelva a preguntar.

### Lo aprendido de esa primera vez (APQP)

| Accion | Autonomia |
|---|---|
| Cargar el plano del cliente en `6-Planos de la pieza` del legajo | Libre (OK de Fak 21/09/2026) |
| Emitir un documento controlado (flujograma, AMFE, HO) en `Gestion Ingenieria` | **Preguntar** — el documento lo firma Fak |
| Poner algo en el paquete del cliente (`31-...\PPAP_<PN>\`) | **Prohibido sin OK**: el PPAP es de CALIDAD, Ingenieria no lo arma |
| Escribir en un listado maestro (flujogramas, AMFEs, hojas de proceso) | **Preguntar** — es registro compartido |
| Llenar cualquier otro casillero del APQP | **Preguntar** si es la primera vez que lo lleno; el mapa esta en el skill `apqp-legajo` |

**Un documento vivo tiene UN solo lugar.** El maestro vive en `Gestion Ingenieria`; lo que se
copia al legajo o al paquete del cliente es una COPIA que envejece sola
(memoria `gestion_ingenieria_es_el_maestro`). No se reparte una copia "por las dudas": se
copia cuando se entrega, y quien entrega el PPAP es Calidad.

### Que es de Ingenieria y que no — Fak es Ingenieria (6 correcciones, 24/08 a 22/09/2026)

Antes de listarle un pendiente a Fak o proponerle un trabajo: ¿de que area es? Lo de otra area
**no se le lleva como tarea suya**; se constata solo si afecta lo que estoy haciendo.

| De Ingenieria (Fak) | De otra area: no se le lleva |
|---|---|
| Flujograma, AMFE, HO (a pedido), BOM/arb y consumos, planos del legajo, dispositivos y CAD, tiempos | **Plan de Control**: Calidad (*"ingenieria no hace planes de control... que lo actualice Calidad"*, 08/09). Una base preliminar alineada con flujograma y AMFE, solo si Fak la pide (11/09) |
| La accion tecnica que le asignen en un 8D (ej. la D7 del 11010843) | **El 8D como documento, su archivo, alertas, NC**: Calidad (21/09) |
| | **PPAP/PSW e IMDS**: Calidad (tabla de arriba y `mail-envio.md`) |
| | **Firma/aprobacion del AMFE**: el circuito no existe hoy; no se reporta (24/08) |
| | **Coordinar a otros por mail**: *"no somos el coordinador... solo somos un puesto junior"* (11/09) |
| | **Layout de planta**: *"yo nunca hago lay out"* (11/09) |

Al resumir mails o pendientes, van los de Ingenieria (*"pasame el listado de pendientes de
ingenieria"*, 08/09; *"yo soy ingenieria te dije"*, 21/09). Memorias
`no_reportar_aprobacion_ni_plan_de_control` y `archivar_documento_de_calidad_no_es_de_ingenieria`.

Que va en cada casillero del legajo APQP: skill **`apqp-legajo`** (relevado de 7 legajos reales
el 21/09/2026; lo corrige Fak). Lo que ahi dice SIN DEFINIR se pregunta, no se completa.

Este contrato evoluciona: si una fila genera friccion repetida, actualizarlo y commitearlo.
