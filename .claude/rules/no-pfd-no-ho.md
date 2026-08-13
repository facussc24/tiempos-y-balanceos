# Barack NO hace flujogramas (PFD) ni hojas de operaciones (HO) en este software

Decisiones de Fak: PFD 2026-05-17 ("no los vas a hacer, no me vuelvas a preguntar"), HO 2026-05-22 ("las hago yo manuales"). El software Barack se enfoca en **AMFE + Plan de Control + modulos lean** (balanceo, calculadora de medios, etc).

## Que significa

- NO crear, regenerar ni sugerir PFDs u HOs **dentro de la app**. NO preguntar a Fak por ellos.
- **Aclarado 2026-08-13 (HO-986 APB Trasero Central):** cuando Fak lo pide explicitamente, las **HO
  si se arman aca** — en Excel, sobre el formulario oficial del SGC `I-IN-002.4-R01`, una pestaña por
  operacion. Ya paso con la HO 118 (05/06) y la HO-985 IP PAD (02/07). Lo prohibido sigue siendo
  ofrecerlas por cuenta propia y hacerlas en el software. Enforcement: hook `ho-numeracion-guard.sh`.
- **La numeracion de las operaciones la manda el FLUJOGRAMA.** Orden APQP: flujograma → AMFE → Plan
  de Control. Antes de armar una HO, cotejar las tres fuentes operacion por operacion; si no cierran,
  reportar la tabla de divergencias y numerar contra el flujograma. Mirar las COLISIONES (mismo
  numero, distinta operacion): en el APB Trasero Central el 80 era "reproceso" en el flujograma y
  "test de lay out" en el Plan de Control, y los dos documentos iban al BeOn.
- Los pasos de una HO son instruccion de planta: sin documento fuente van **TBD**. No se redactan por
  analogia con otra pieza "parecida" (`core-prohibiciones` §1). El listado maestro
  (`3- LISTADO\Listado hojas de proceso.xlsx` + hoja oculta `_CONTEXTO_CLAUDE`) manda la numeracion
  de HO y se actualiza en la misma tanda.
- Los documentos existentes en Supabase (`pfd_documents`, `ho_documents`) quedan como **referencia historica**: no tocar, no eliminar. Los repositorios (`pfdRepository`, `hoRepository`) son capa de lectura.
- Validaciones cruzadas PFD↔AMFE y HO↔CP: no ejecutar proactivamente.
- El codigo de los modulos fue podado del repo (2026-07); los tipos (`pfdTypes.ts`, `hojaOperacionesTypes.ts`) quedan para leer historicos.

## Relacion AMFE ↔ HO (para entender, no para actuar)

El AMFE de PRODUCTO se alinea con la HO oficial externa de Fak (numeracion real). El AMFE MAESTRO no se alinea con HOs (aplica a muchas). Casos legitimos de tocar codigo HO/PFD restante: bug fix reportado por Fak, o LEER un doc historico para extraer datos al AMFE.

## Anti-patrones

❌ "¿Actualizo tambien el PFD/la HO?" ❌ Incluir PFD/HO en "paquete APQP completo desde la app" (el export historico del paquete si puede incluir la hoja Flujograma guardada). ❌ Pedir datos para llenar campos de HO.
