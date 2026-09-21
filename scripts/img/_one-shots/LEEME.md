# One-shots ya consumidos

Estos cuatro **no se corren mas**. Se guardan porque cuentan como llego el generador a ser
lo que es, no porque sirvan (misma idea que `scripts/archive/`).

| archivo | que era |
|---|---|
| `actualizar_deck.py` | un generador entero anterior, de "Portada + 11 operaciones (30.1 a 30.11)". Lo reemplazo `generar_hojas_img.py`, que hoy arma portada + 6 hojas con sus gates. |
| `actualizar_hojas_multifoto.py` | parche de una sola vez sobre `generar_hojas_img.py`: saco la hoja de calidad (*"no soy calidad, que la haga calidad"*) y metio las grillas multi-foto. Ya aplicado. |
| `actualizar_vocabulario.py` | otro parche de una sola vez, de vocabulario. Ya aplicado. |
| `test_write.py` | tres lineas de prueba de que se podia escribir un .py. |

**El generador vivo es `scripts/img/generar_hojas_img.py`.** Se corre solo:

```bash
py -3 scripts/img/generar_hojas_img.py
py -3 .claude/skills/hojas-de-proceso/scripts/hoja_proceso_check.py "scripts/img/HOJAS DE PROCESO - MAQUINA IMG.pptx" --spec scripts/img/spec_gate_img.py
```
