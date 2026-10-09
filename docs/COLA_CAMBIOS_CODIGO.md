# Cola de cambios al código (pedidos de Fak y hallazgos míos)

Regla `.claude/rules/codigo-madre.md`: un pedido chico que llega mientras Fak labura en otra cosa se
anota acá con sus palabras y se hace en una sesión de código, de a uno, por el camino de su tamaño
(chico · mediano · grande). Al abrir una sesión de código se lee esta cola primero. Lo hecho se tacha
con la fecha y el commit; cada tanto se archiva lo tachado al final.

Formato de una fila: `- [ ] AAAA-MM-DD · tamaño · quién · qué (sus palabras) · dónde (archivo o área)`

## Pendientes

- [ ] 2026-10-08 · mediano · Fak · "los links que pasa Claude Devs donde explica a fondo las cosas": que `_novedadesClaude.mjs` siga los links de los posteos (claude.com/blog, platform.claude.com, code.claude.com, releases de GitHub), guarde el artículo en `.sgc-cache/x-seguimiento/articulos/` y la noche lo resuma · `scripts/_novedadesClaude.mjs`
- [ ] 2026-10-08 · chico · Fak · "a las 12 ya salió la noticia; el twit lo vi hoy": las novedades del día deberían entrar el mismo día (hoy la lectura es diaria a las 06:30; el posteo de Managed Agents del 08/10 22:00 no estaba en el caché a las 00:30) · `scripts/_novedadesClaude.mjs`, `_nocturno.mjs`
- [ ] 2026-10-08 · mediano · Fak · "mods para que mi Claude Code se vea lindo... dejalo para una fase final, no es urgente": buscar en GitHub los mejores (barra de estado, colores, paneles) y proponerle 3 con captura, probados en Windows · `~/.claude/settings.json`, statusline
- [ ] 2026-10-08 · chico · Fak · "el videíto" (Claude Motion): cuando llegue a Max, usarlo para las explicaciones; mirar en las novedades semanales · skill `explicar-mejor` escalón 4
- [ ] 2026-10-09 · chico · yo · el aviso del `correccion-guard` pide «lista de lo que pide con sus palabras»; a Fak le suena a tomarlo literal (*"deja de tomar literal todo lo que pido"*). Reescribir el aviso para que pida DECIDIR con evidencia y nombrar qué se cubrió, no transcribirlo. Es un hook: probar con un mensaje real (`_probarMejora.mjs`) · `scripts/_lib/correccionGuard.mjs`
- [ ] 2026-10-09 · mediano · yo · `_cierreSesion.mjs` lee el último run del CI y dice «no pude leer» si la API no contesta, en vez de dar verde (R7: CI rojo 17 corridas sin que nadie avise) · `scripts/_cierreSesion.mjs`
- [ ] 2026-10-09 · mediano · yo · el cierre-guard frena un turno que termina en inglés (R4: 65 turnos en inglés desde el 01/09; Fak 07/10 *"dejá de hablar en inglés"*) · `scripts/_lib/cierreGuard.mjs` + prueba con mensaje real
- [ ] 2026-10-09 · mediano · yo · el chequeo «entregable sin abrir» del cierre-guard ignora `exports/` (R4: 112 archivos pptx/xlsx/pdf desde el 01/09 sin pasar por el control) · `scripts/_lib/cierreGuard.mjs`
- [ ] 2026-10-09 · mediano · yo · lo crítico de las skills `hojas-de-proceso`, `arb-operar`, `flujogramas` y `cad-design` dentro de los primeros ~19.000 caracteres (R5: tras compactar, Claude Code reinyecta cada skill cortada a 20.000; hojas-de-proceso pierde el 64 %) · `.claude/skills/*/SKILL.md`
- [ ] 2026-10-09 · grande · yo · **podar lo que entra fijo en cada sesión**: hoy son ~36.000 tokens de CLAUDE.md + LECCIONES + 8 reglas always-on (medido con `get_usage`: «Memory files 35.772 tokens»). La doc oficial: *«si Claude sigue haciendo algo que no querés aunque haya una regla en contra, el archivo probablemente es demasiado largo y la regla se pierde»*. Mover el detalle a skills y memorias (cargan a pedido) y dejar fijo solo lo que evita errores. Necesita el sí de Fak y una medición antes/después · `CLAUDE.md`, `docs/LECCIONES_APRENDIDAS.md`, `.claude/rules/`
- [ ] 2026-10-09 · mediano · yo · hooks: `instrucciones-log` en bash puro (2,8 s → 0,26 s por comando), `dev-server-guard` reordenado, `pregunta-guard` más rápido (R6: ~0,8 s de hooks por cada Bash en reposo) · `.claude/hooks/`
- [ ] 2026-10-09 · chico · yo · `firma-ia-guard` bloquea `add('…claude…')` sin distinguir mayúsculas (falso positivo, R7) · `scripts/_lib/guardianes.mjs`
- [ ] 2026-10-09 · chico · yo · `scripts/hotmelt/_test_com.py` con `Quit()` pelado rompe `powerpointQuit.test` (R7): proponerle a Fak borrarlo · `scripts/hotmelt/`

## Hechos

(nada todavía)
