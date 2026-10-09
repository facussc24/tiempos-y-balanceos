# Prompt para la sesión nueva (09/10/2026, tarde) — pegar tal cual en un chat nuevo en `C:\Dev\BarackMercosul`

Sos mi Claude de Barack. Arrancás después de una noche y una mañana de trabajo sobre el sistema (plan, reglas,
noche de Claude, cola de cambios). Antes de hacer nada, leé en este orden:

1. `docs/COLA_CAMBIOS_CODIGO.md` — arriba está el **orden sugerido para hoy** y después la cola con cada cambio,
   su tamaño (chico / mediano / grande) y su evidencia.
2. `.sgc-cache/investigacion-2026-10-09/D1_chats_de_hoy.md` — los 15 errores de los chats de hoy a la mañana, con
   hora, qué pasó y cómo se arregla cada uno. Fak: *"cada pequeño error, no solo los más graves, deben ser corregidos"*.
3. `.claude/rules/codigo-madre.md` — el código es sagrado: cada cambio va por el camino de su tamaño (chico directo con
   test; mediano con plan corto escrito antes + tests + auditor Opus; grande con investigación + mi sí + revisor).
4. `docs/PLAN_CLAUDE_BARACK_SISTEMA_2026-10-08.md` §1.8 a §1.10 y `.claude/state/lista-noche-2026-10-08.md` (el
   registro de todo lo hecho y decidido, con horas).

Reglas de esta sesión:
- Decidís vos con evidencia; yo sugiero. No me devuelvas mi lista textual: hacé y contame qué decidiste y por qué.
- Un control que contesta «no puedo» o «hacelo vos» es un error tuyo: se arregla el programa.
- Mirá el contexto de la sesión (`get_usage` → `context.percentUsed`) cada tanto y cerrá prolijo antes del 95 %:
  commit con rutas, lista al día, y el prompt para la sesión siguiente en `docs/drafts/`.
- Modelo: vos en Opus; ayudantes según `techo-agentes.md` (Haiku busca, Sonnet escribe, Opus decide, Fable revisa).
- Nada en Supabase, arb, Outlook (salvo lo que yo apruebe), servidor ni nube compartida sin mi sí.

Qué hacer, en este orden (uno por vez, cerrado y commiteado antes del siguiente):

1. **El mail que «no salió»** (cola, D1 #1): reproducir con un borrador de prueba abierto, sin enviar; arreglar
   `_mailEnviar.py` para que cierre la ventana solo y reintente. Mediano.
2. **El gate de documentos** (D1 #2-#4): en `_sinFirmaIA.py`, logo no oficial (bloqueante), imagen sin metadatos de
   cámara (aviso), frases que escrachan (aviso), con gemelos rojos. Mediano.
3. **Skill `planes-de-control`** (D1 #11): buscar en el servidor los últimos planes de control de Cecilia con sus
   revisiones y armar la skill con el formato real. Grande: plan corto y mi sí antes de escribirla.
4. **Cierre en inglés** en el cierre-guard (cola), probado con un turno real conmigo presente. Mediano.
5. Los chicos de skills y reglas (D1 #6, #7, #10, #14).
6. Después: enganchar los tres programas nuevos como pasos de la noche, novedades siguiendo links, y el resto de la
   cola en su orden.

Al terminar cada punto: tests del módulo, `npm run build` si toca la app, commit con rutas, push, y una línea mía
de qué cambió y si las sesiones abiertas lo toman solas.
