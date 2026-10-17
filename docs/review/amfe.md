# REVIEW · AMFE de proceso (AIAG-VDA)

Lo que Fak devolvió de un AMFE, convertido en qué mirar. La regla completa es `.claude/rules/amfe.md` y el validador
`scripts/_lib/amfeValidator.mjs` frena lo ejecutable; esto es la lista corta para el revisor. Etiquetas y formato:
`REVIEW.md`.

| Qué mirar (Importante) | Por qué (la queja de Fak) | Dónde vive el criterio |
|---|---|---|
| La S sale del EFECTO por la Tabla P1, nunca de la sigla (no se infla para sostener una CC) | 21/09: costura con dos líneas quedaba más grave que un paro de línea | `caracteristicas-especiales.md` §2bis (sin check automático: lo mira el revisor) |
| Una sigla se justifica con la S y la O de ESA causa, nunca porque otro documento la tenía | 11/09: «estás tirando como al azar... un error gravísimo» | `caracteristicas-especiales.md` §1 |
| El control de detección dice CON QUÉ (instrumento + frecuencia), sin valor y sin cita entre paréntesis | 10/10: «controles medio inventados o genéricos» · 23/09: «hay demasiadas aclaraciones» | `amfe.md` §6 y §11 |
| Primero la cobertura: un muestreo es D=9 aunque tenga instrumento; inspección humana al 100 % es 8 | | `amfe.md` §13 |
| Ninguna acción de optimización inventada; un AP=H sin acción va con la celda VACÍA (el placeholder está prohibido) | 21/09: «sacá eso, no lo quiero ni ver en el AMFE» | `amfe.md` §4 y §5 |
| El log de revisiones dice qué cambió del PROCESO y en qué operación, nunca cómo se redactó | 21/09: «revisión general no puede ser una revisión» | `amfe.md` §4bis y §17.1 |
| La palabra «reproceso» puede estar; su análisis o por qué se sacó, no | 09/10: «esto sacalo» | IATF 8.7.1.4, `_sinFirmaIA.py` |
| Vocabulario de los mails de Barack: ni inglés suelto ni castellano de diccionario | 23/08 | `ENGLISH_RANDOM_TERMS`, `amfe.md` §17.2 |
| Un AMFE escrito de cero no se delata por el largo de sus frases (8 a 10 palabras por campo) | 09/10 | `TOPE_PALABRAS` de `amfeAutoria.mjs` |
| Al documento entra lo que dice un papel de ESA pieza; de la vecina, el lugar, nunca el método | 02/10 | `amfe.md` §17 |

**No se reporta**: un AP=H con la acción vacía, una CC/SC que falta (las asigna Fak), los datos de la empresa.
**Nit**: una función que repite palabras de la de al lado sin cambiar el sentido, un nombre de operación con tilde.
