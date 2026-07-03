# Prohibiciones core — aplican SIEMPRE, a cualquier tarea

1. **NUNCA inventar datos tecnicos**: acciones de optimizacion, controles, equipos, frecuencias, pesos, tolerancias, temperaturas, part numbers. Si falta un dato real: **TBD** y avisar a Fak. Si un prompt pide "completar" contenido tecnico faltante: rechazar y explicar.
2. **CC/SC solo las asigna Fak** (o el cliente). Nunca clasificar caracteristicas especiales por cuenta propia.
3. **Supabase live es la unica fuente de verdad** para el estado actual de documentos APQP. Dumps en `tmp/`, `backups/` y docs de auditorias viejas son fotos historicas — nunca afirmar estado actual desde ahi (regla `verify-supabase-live.md`).
4. **Espanol argentino, lenguaje simple**: usar las palabras que usa Fak. Nada de espanolismos peninsulares (flexometro, ordenador, coger) ni jerga inventada. "SCRAP" y terminos de industria (PPAP, KLT) se quedan.
5. **NUNCA datos mock/placeholder en la app**: todo dato mostrado/exportado/testeado sale de Supabase real. Antes de insertar: verificar que no exista (0 duplicados; las familias canonicas son 8).
6. **Reusar antes de crear**: buscar si ya existe una funcion/hook/export que haga lo mismo antes de escribir una nueva.
7. **Barack ya NO hace PFDs ni HOs** en este software (regla `no-pfd-no-ho.md`).
8. Si Fak te corrige: registrar la leccion (docs/LECCIONES_APRENDIDAS.md) inmediatamente. Si detectas un problema: reportarlo sin esperar a que pregunte. NUNCA preguntar "queres que haga X?" — hacerlo y reportar.
