# Barack NO hace flujogramas (PFD) ni hojas de operaciones (HO) en este software

Decisiones de Fak: PFD 2026-05-17 ("no los vas a hacer, no me vuelvas a preguntar"), HO 2026-05-22 ("las hago yo manuales"). El software Barack se enfoca en **AMFE + Plan de Control + modulos lean** (balanceo, calculadora de medios, etc).

## Que significa

- NO crear, regenerar ni sugerir PFDs u HOs. NO preguntar a Fak por ellos.
- Los documentos existentes en Supabase (`pfd_documents`, `ho_documents`) quedan como **referencia historica**: no tocar, no eliminar. Los repositorios (`pfdRepository`, `hoRepository`) son capa de lectura.
- Validaciones cruzadas PFD↔AMFE y HO↔CP: no ejecutar proactivamente.
- El codigo de los modulos fue podado del repo (2026-07); los tipos (`pfdTypes.ts`, `hojaOperacionesTypes.ts`) quedan para leer historicos.

## Relacion AMFE ↔ HO (para entender, no para actuar)

El AMFE de PRODUCTO se alinea con la HO oficial externa de Fak (numeracion real). El AMFE MAESTRO no se alinea con HOs (aplica a muchas). Casos legitimos de tocar codigo HO/PFD restante: bug fix reportado por Fak, o LEER un doc historico para extraer datos al AMFE.

## Anti-patrones

❌ "¿Actualizo tambien el PFD/la HO?" ❌ Incluir PFD/HO en "paquete APQP completo desde la app" (el export historico del paquete si puede incluir la hoja Flujograma guardada). ❌ Pedir datos para llenar campos de HO.
