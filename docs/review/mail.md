# REVIEW · mails

Lo que Fak devolvió de un mail, convertido en qué mirar. La regla es `.claude/rules/mail-envio.md` (el OK va después
del borrador, quién va en copia, cómo se arma en Outlook) y el gate de voz `scripts/_lib/vozGate.mjs`; esto es la lista
corta para el revisor. Etiquetas y formato: `REVIEW.md`.

| Qué mirar (Importante) | Por qué (la queja de Fak) | Dónde vive el criterio |
|---|---|---|
| Contesta UNA cosa: lo que el que lee tiene que hacer hoy, y lo mínimo para entenderla | 07/10: un mail «con lo que encuentres» lleva UNA pregunta, no el informe del agente | memoria `feedback_mail_corto_como_los_de_fak` |
| Corto como los de Fak: saludo, qué adjunta, 2 o 3 alertas, listo; sin secciones numeradas | 20/08: «le mandaste un testamento» | misma memoria |
| No explica el adjunto ni cómo se llegó al dato | 01/09: «te envío el listado de códigos e imágenes de Patagonia, algo así nomás» | `mail-envio.md` «Qué va y qué no va» |
| No contesta por otra área ni copia datos de otros (cuánto comprar, la demanda de Logística) | 03/09: «ni es mi trabajo decir cuántos rollos faltan... excediste nuestro rol» | memoria `feedback_responder_el_scope_exacto` §3 |
| Lo lateral (otros códigos con problemas viejos) no entra: se anota aparte | «los agregaste y aclaraste de más, es un error conocido tuyo» | `evals/mail-alcance` |
| Una corrección de un error propio dice solo el valor que queda, sin «antes y después» | 25/09: «si ponemos el antes y el después me escrachás» | memoria `documento_no_confiesa_como_se_hizo` |
| Carlos Baptista va en copia | regla dura de Fak | memoria `feedback_carlos_baptista_siempre_en_copia` |
| Antes de pedirle algo a Calidad u otra área, se miró el buzón (`python scripts/_mails.py --buscar`) | 13/10, caso Nicolás | `mail-envio.md` |
| Castellano, sin signos de apertura (¿ ¡) como escribe Fak, y sin inglés suelto | | memoria `feedback_mails_sin_signo_de_apertura` |

**Nit**: un saludo distinto del que usa Fak con esa persona, una despedida de más.
