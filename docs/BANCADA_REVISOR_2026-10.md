# Bancada para calibrar al revisor de código — protocolo escrito, NO corrida (tanda 9, pieza 6, 17/10/2026)

**Estado: escrita, sin correr.** La bancada entera son 8 diffs × 3 corridas × 2 modelos = 48 agentes, unos 290 puntos
del presupuesto de subagentes (Sonnet pesa 4, Opus 8; 40 puntos cada 10 minutos): más de 7 ventanas. Esa noche no
entraba junto con el resto de la tanda y la prueba de la tanda no la exige. Queda lista para una sesión aparte.

**El resultado no cambia nada solo.** Que la auditoría final la haga Opus es regla de Fak (30/09/2026, `techo-agentes.md`):
aunque Sonnet empate a Opus en la bancada, `auditor.md` y `techo-agentes.md` no se tocan; el número va a la lista de Fak.

## Los 8 diffs

**Con un defecto real** (sembrado al revés de un arreglo que hizo un auditor el 16/10; el defecto es justo lo que el
auditor encontró, así que la respuesta se conoce):

| # | Arreglo del 16/10 | Cómo se arma el diff con el defecto | Lo que el revisor tiene que encontrar |
|---|---|---|---|
| D1 | `f5d7f308` fix(hijaEstado) | `git diff f5d7f308 f5d7f308^` (2 archivos, 15 renglones) | sin `cliSessionId` en el registro de la app, `_hijaEstado.mjs` decía «ARRANCÓ BIEN» |
| D2 | `88fd5664` fix(impresora), re-auditoría del bloque 4 | `git diff 88fd5664 88fd5664^` (4 archivos) | los tres puntos de la re-auditoría |
| D3 | `0e69590f` fix(hojas), auditor Opus de la tanda 1.5 | `git diff 0e69590f 0e69590f^` (3 archivos) | el AMFE que no se frenaba al imprimir; el ciclo por tamaño y no por formato |
| D4 | `a6a60a9d` fix(memoria), auditor Opus de las tandas 1.3 y 1.4 | `git diff a6a60a9d a6a60a9d^` (8 archivos) | lo que marcó ese auditor |

**Limpios** (cambios ya aprobados; un hallazgo Importante acá es un falso positivo): elegir 4 commits del 16/10 que un
auditor aprobó sin cambios, de tamaño parecido a los de arriba. Candidatos a confirmar leyendo su auditoría:
`5b988ae0` (hojas, «volante cromado» a aviso, 4 archivos), `a17b445b` (tanda 1.6, ronda 2), `7e8a2b9b` (solo
documentación: sirve de control de «no inventa en un diff de texto»). **No** el `53c76112` de esta tanda: el auditor del 17/10
le encontró un defecto (un agente caído contaba como «sin hallazgos»), arreglado después; sirve como diff CON defecto.

## Cómo se corre

1. Por cada diff, el mismo pedido: «revisá este cambio con `REVIEW.md`; devolvé los hallazgos con etiqueta y caso»
   (los prompts de lente de `.claude/workflows/revision-adversarial.js` sirven tal cual).
2. 3 corridas por modelo: `investigador` en Sonnet y `investigador` con `model: opus`. Primero en esfuerzo `low`
   (el plan general, tanda 9, apartado «a bis», cita a Boris el 23/09: «`/code-review low` cuesta menos y encuentra más
   bugs»; la fuente original no la verifiqué), y solo si pierde, más alto.
3. Se compara contra `/code-review low` y `medium` sobre los mismos 8 (los lanza la sesión con la skill `code-review`).
4. Se cuenta, por modelo: defectos encontrados de 4 (con la etiqueta bien puesta), falsos Importante en los 4 limpios, y
   cuánto varía entre corridas. Si las 3 corridas de un caso no coinciden, el número es ruido y se dice.

## Qué hace falta

Una sesión de código con el cupo libre (unos 290 puntos repartidos en una hora) y la lista de los 4 limpios confirmada
contra sus auditorías.
