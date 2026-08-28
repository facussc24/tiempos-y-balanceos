# Prohibiciones core — aplican SIEMPRE, a cualquier tarea

1. **NUNCA inventar datos tecnicos**: acciones de optimizacion, controles, equipos, frecuencias, pesos, tolerancias, temperaturas, part numbers. Si falta un dato real: **TBD** y avisar a Fak. Si un prompt pide "completar" contenido tecnico faltante: rechazar y explicar.
   **Inventar incluye las EXPLICACIONES CAUSALES de errores ajenos** (*confundieron X con Y · lo leyeron mal · se comio la coma · copiaron de · nadie recalculo · nunca aviso · invita a leerlo mal*): el origen de un dato ajeno **se cita o no se escribe**, una inferencia va marcada como inferencia, y una coincidencia numerica NO es una fuente. Describir el ESTADO ("el documento dice A, el envase dice B") es correcto; narrar COMO se llego, no — ademas acusa por implicacion a una persona real de Barack. Gate: `causas-ajenas-guard.sh` sobre memorias, reglas y LECCIONES. Incidente 21/08/2026: memoria `no_inventar_causas_ajenas`.
2. **CC/SC solo las asigna Fak** (o el cliente). Nunca clasificar caracteristicas especiales por cuenta propia.
3. **Supabase live es la unica fuente de verdad** para el estado actual de documentos APQP. Dumps en `tmp/`, `backups/` y docs de auditorias viejas son fotos historicas — nunca afirmar estado actual desde ahi (regla `verify-supabase-live.md`).
4. **Espanol argentino, lenguaje simple**: usar las palabras que usa Fak. Nada de espanolismos peninsulares (flexometro, ordenador, coger) ni jerga inventada. "SCRAP" y terminos de industria (PPAP, KLT) se quedan.
5. **NUNCA datos mock/placeholder en la app**: todo dato mostrado/exportado/testeado sale de Supabase real. Antes de insertar: verificar que no exista (0 duplicados; las familias canonicas son 8).
6. **Reusar antes de crear**: buscar si ya existe una funcion/hook/export que haga lo mismo antes de escribir una nueva.
7. **Barack ya NO hace PFDs ni HOs** en este software (regla `no-pfd-no-ho.md`).
8. Si Fak te corrige: registrar la leccion (docs/LECCIONES_APRENDIDAS.md) inmediatamente. Si detectas un problema: reportarlo sin esperar a que pregunte. NUNCA preguntar "queres que haga X?" — hacerlo y reportar.
9. **Un papel que emitio OTRO no se edita ni se le toca la verificacion** (QR/hash/firma): se pide la reemision al emisor. Leerlo, extraerlo, traducirlo aparte y citarlo desde un documento propio: libre, y no amerita mencionar esto.
