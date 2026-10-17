# Cuántos cierres frenan los hooks Stop — medido antes de tocar un hook (tanda 9, pieza 11, 17/10/2026)

Pedido del plan (`docs/PLAN_METODO_2026-10-16.md`, pieza 11; `anthropic_a_fondo` b): contar en los registros cuántos
cierres evitó cada hook desde el 01/10 antes de decidir nada sobre `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP`. **Ese número no
se cambia acá: es de Fak** (LECCIONES 11/10, «un número de la regla no lo cambio yo»).

## Cómo se midió

`node scripts/_stopHooksMedir.mjs --desde 2026-10-01`. Los hooks Stop no dejan registro propio; lo que queda es el
mensaje «Stop hook feedback: [bash …/<hook>.sh]: …» que Claude Code le devuelve a la sesión. Por cada uno se mira el turno
siguiente del asistente: si usó una herramienta, el freno hizo trabajar (**cierre evitado**); si volvió a escribir sin
herramienta, o llegó otro freno o un mensaje de Fak antes, **volvió a cerrar**. La racha es la cantidad de frenos
seguidos sin un mensaje de Fak en el medio (Claude Code corta a los 8).

## Lo medido (01/10 al 17/10/2026, 368 sesiones, 89 con algún freno)

| Hook Stop | Frenos | Después trabajó (cierre evitado) | Volvió a cerrar |
|---|---|---|---|
| `cierre-guard` | 366 | 244 (67 %) | 122 |
| `hora-guard` | 13 | 10 | 3 |
| `dev-server-guard` | 12 | 7 | 5 |

- **Racha más larga: 8 frenos seguidos. Se llegó al tope de 8 dos veces** en 17 días.
- `pregunta-guard` no es un hook de cierre: corre antes de una pregunta (`AskUserQuestion`) y en 30 días firmó 308 veces
  (conteo de la pieza 7, `node scripts/_retirosVencidos.mjs --disparos`).

## Lo que esto dice (y lo que no)

- `cierre-guard` hace trabajar a la sesión en dos de cada tres frenos: no es ruido. El tercio que «vuelve a cerrar» incluye
  los casos en que la sesión contesta con un renglón de salida honesta («No aplica …»), que es lo que el hook pide; el
  script no los distingue de un cierre repetido.
- Con dos topes en 17 días, **no hay evidencia para subir `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP`**: subirlo alargaría justo
  esas dos rachas. Si Fak quiere verlo, los dos casos se ubican con el mismo script (sesiones con racha 8).
- Límite: «usó una herramienta» no prueba que haya hecho lo que el freno pedía; es la señal más barata que queda en el
  registro.
