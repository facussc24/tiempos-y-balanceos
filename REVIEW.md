# REVIEW.md — qué es una falla en este repo y cómo se reporta

Lo leen al arrancar el agente `auditor`, el `revisor-pedido` y el workflow de revisión adversarial
(`.claude/workflows/revision-adversarial.js`). Molde: el post de claude.dev del 15/10/2026 «How the Claude Code team
does code review» (un `REVIEW.md` por área escrito por el dueño: qué es falla ahí, tope de nits, rutas a saltear,
evidencia con archivo y línea, resumen que arranca con el conteo). Lo que es falla en cada tipo de entregable de
Barack vive en `docs/review/` (hojas de proceso, AMFE, mails): las quejas de Fak convertidas en qué mirar.

Este repo lo usa una sola persona (Fak), que no programa: el código y los entregables los escribe Claude. Por eso el
revisor mira dos cosas distintas: el **código y los controles** (abajo) y el **entregable contra el pedido**
(`revisor-pedido`, con `docs/review/<tipo>.md`).

## Las etiquetas (una por hallazgo)

| Etiqueta | Qué quiere decir |
|---|---|
| **Importante** | Rompe algo, afloja un control o deja a Fak con un entregable que va a devolver. Va primero. |
| **Nit** | Se nota y no rompe nada. Como mucho **3 por informe**; el resto se cuenta («y 7 nits más»). |
| **Preexistente** | Estaba antes del cambio que se revisa (código viejo, archivo de otro). Se nombra y no se le carga al autor. En el post, el 59 % de lo que se repetía era código viejo. |

Quien recibe el informe anota al lado de cada hallazgo qué hizo: **arreglado / rechazado / a propósito / no importa**.
Eso mide el ruido del revisor (pieza 3 de la tanda 9; lo cuenta `node scripts/_cuatroNumeros.mjs`).

## Qué es falla acá (Importante)

1. **Un control que afloja sin test en las dos direcciones**: un hook, un guardián, un gate o su canon que deja pasar
   algo nuevo sin un caso que debe frenar y uno que no (LECCIONES 22/09-06/10: «lo que afloja un control lo prueba
   OTRO»). Un control que no puede dar rojo está tan roto como el que no puede dar verde.
2. **Un número sin fuente**: un umbral, un tope, un consumo o un peso que ningún papel ni medición respalda. Y un
   número de una regla de Fak no lo cambia Claude: va a su lista con la medición al lado.
3. **«Claude» o una IA nombrada en un documento de Barack** (celda, pestaña oculta, nota, propiedades, nombre de
   archivo): `core-prohibiciones.md` §9, detector `python scripts/_sinFirmaIA.py <archivo>`.
4. **Un dato técnico inventado**: acción de optimización, control, equipo, frecuencia, tolerancia, part number, o la
   causa de un error ajeno contada sin cita (`core-prohibiciones.md` §1). Lo que falta va `TBD`.
5. **Inglés suelto** en algo que ve Fak o que sale de la casa (los términos de industria que ya usa, como SCRAP, PPAP,
   KLT, setup, stock o checklist, se quedan).
6. **Escribir en Supabase sin `runWithValidation()`**, un AP fuera de `calculateAP`, una sigla CC/SC que su S y su O
   no sostienen (`amfe.md` §14, `caracteristicas-especiales.md`).
7. **Un commit sin rutas** (`git add .`, `-a`, un commit pelado): el índice es de todas las sesiones (`git-deploy.md`).
8. **Una credencial en el repo o en un build** (`_gateRepoPublico.mjs`; el repo es público).
9. **Un control que falla abierto en silencio**: un `catch` que devuelve «limpio» cuando no pudo medir. No pudo medir
   es aviso, nunca verde.
10. **Un cambio que llega a las sesiones de Fak sin decirlo**: un hook, una regla o `CLAUDE.md` tocados sin decir si las
   sesiones abiertas lo toman solas (`mejora-implementada.md`).

## Qué NO es falla (no se reporta)

- **Datos de la empresa en el repo**: el repo es público por decisión de Fak (18/08/2026, `git-deploy.md`).
- Un AP=H con la acción vacía, o una CC/SC que falta: asignarlas es de Fak (`amfe.md` §4, `core-prohibiciones.md` §2).
- **Estilo y limpieza** (nombres, orden, formato, comentarios de más): el post lo probó A/B y lo descartó; acá además
  se escribe como el código de al lado.
- Lo que ya frena un hook o un gate ejecutable: se nombra solo si el control no corrió.

## Rutas que no se revisan

`node_modules/`, `dist/`, `backups/`, `tmp/`, `.sgc-cache/`, `docs/_archive/`, `evals/results/`, `exports/` (los
entregables se revisan con `revisor-pedido` contra el pedido, no como código), y los `*.data.json` generados por un
script (`vozFak.data.json` y similares: se revisa el script que los genera).

## Cómo se reporta

- **El resumen arranca con el conteo**: «N Importante, M Nit, P Preexistente».
- **La evidencia es archivo y línea** (`scripts/x.mjs:120`) y el caso medido: el comando, la entrada y la salida. Un
  «parece» o «podría» sin caso no es un hallazgo; se descarta o va como pregunta.
- **El riesgo es del cambio, no del autor**: chico, mediano o grande según `codigo-madre.md`.
- **Como mucho 2 rondas autor ↔ revisor** (en el post, un PR dio 50 vueltas en una noche): después de la segunda se
  revisa solo el diff nuevo, y lo que quede abierto va al cierre para Fak.
- Un hallazgo de otro agente se verifica contra la fuente antes de darlo por bueno (en los audits de la casa la
  mayoría son falsos positivos: 92 de 111 el 02/09).
