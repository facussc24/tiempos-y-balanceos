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
| Crear acciones de optimizacion | **Prohibido inventar**; placeholder AP=H OK (regla amfe.md §4) |
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
- NO flaggear como problema: AP=H con placeholder sin responsable/fecha.
- Correcciones detectadas: solo codigo obvio = libre; datos = confirmar antes.
- NotebookLM: consultar = libre; subir fuente = confirmar + verificar despues; crear notebook = preguntar; borrar = prohibido.
- `git commit` + `push` al cerrar tareas de codigo: libre (build antes).

## E. Fallar al lado seguro

Operacion no listada: si es reversible (local, sin push, sin Supabase) → hacer; si es irreversible o toca datos/produccion → preguntar; si exige inventar datos tecnicos → TBD y avisar.

Este contrato evoluciona: si una fila genera friccion repetida, actualizarlo y commitearlo.
