# Medir el esfuerzo de las auditorías por lote (high contra medium)

Tanda 5 del plan del sistema, pieza 2 (17/10/2026). **Esto gasta créditos de la API: se corre recién con el sí de Fak
para gastar** (el plan lo deja para después de que conteste su lista). Mientras tanto, el defecto no cambia: los jobs
corren con el `effort` que diga su `jobs.json` y, si no dice nada, `high`.

## Por qué

En la ola del 11/10 la salida promedio de un lote de auditoría con Opus fue de **36.700 tokens**, casi todo
pensamiento (informe `afuera_api_y_gemini.md` §B.1 y «No alcancé»). El pensamiento se cobra como salida (US$ 20 por
millón en Opus, la mitad en Batch). Bajar el esfuerzo a `medium` es la palanca de ahorro más grande que nadie midió;
la guía oficial del modelo dice que Opus 5.5 arranca en `medium` y que se mida por tipo de trabajo antes de cambiar un
defecto.

## Qué se corre

Los **mismos dos lotes**, una vez en `high` y otra en `medium`, en Batch (mitad de precio), cada corrida en su carpeta:

```bash
node scripts/_apiLotes.mjs <jobs.json> --lote --solo 2 --effort high --salida-dir .sgc-cache/api/medir-esfuerzo/high
```

```bash
node scripts/_apiLotes.mjs <jobs.json> --lote --solo 2 --effort medium --salida-dir .sgc-cache/api/medir-esfuerzo/medium
```

`<jobs.json>` es el de una auditoría ya hecha (modo `auditoria`, con su `lista` y su `pedido`), así los lotes salen
iguales en las dos corridas. Si un lote no termina en 55 minutos queda en curso y se recoge después con
`--recoger --salida-dir <la misma carpeta>`.

Costo estimado de las dos corridas (Opus en Batch, con los tokens medidos del 11/10: 63.200 de entrada y 36.700 de
salida por lote): ≈ US$ 0,99 en `high`; en `medium` es lo que se quiere medir. Total esperado: menos de US$ 2.

## Cómo se compara

1. **Lo que cuesta**: `node scripts/_claude.mjs --ledger` lista el gasto por tarea; cada pedido del lote queda anotado
   como `sesion:<tarea>@<effort>` (por ejemplo `sesion:auditoria-01@high` y `sesion:auditoria-01@medium`). Se comparan
   los tokens de salida y los dólares de cada par.
2. **Lo que encuentra**: los dos `.md` de cada lote, hallazgo por hallazgo, abiertos contra el archivo que citan. Un
   hallazgo que `medium` no trae y `high` sí, y que es real, pesa más que el ahorro.
3. **El veredicto** va al cierre del día con los dos números al lado. El defecto lo cambia Fak: un número de la regla
   no lo cambio yo (LECCIONES 11/10).
