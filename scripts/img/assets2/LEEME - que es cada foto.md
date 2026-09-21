# Las fotos de las hojas de la MOLDEADORA IMG

Cada `.jpg` de esta carpeta lleva **adentro del archivo** de que video y que segundo salio,
con que recorte y con que rotulos. Se lee asi:

```bash
py -3 .claude/skills/hojas-de-proceso/scripts/fotodevideo.py leer scripts/img/assets2/*.jpg
```

Sale con codigo 1 si alguna no lo dice. Una foto sin eso es un huerfano: nadie puede
rehacerla ni verificar de donde salio.

## Las que usa el deck hoy (12)

| archivo | hoja | que es |
|---|---|---|
| `p1_listo.jpg` | portada | la maquina en posicion de arranque |
| `e1_llave.jpg` | 30.1 | la llave general del tablero (Schneider On/Off) |
| `e2_power.jpg` | 30.1 | el pulsador verde POWER START (电源启动) encendido |
| `e3_chiller.jpg` | 30.1 | el chiller y el atemperador del agua del molde |
| `e4_manometros.jpg` | 30.1 | el panel de cinco manometros |
| `r_puesto.jpg` | 30.2 | el puesto de mando, rotulado |
| `r_botonera.jpg` | 30.3 | la botonera, rotulada (cajas MEDIDAS con `medir_marca.py`) |
| `m1_entra.jpg` | 30.4 | la mesa entra con el molde |
| `m2_conformado.jpg` | 30.4 | el plato baja sobre el molde |
| `m3_abre.jpg` | 30.4 | la maquina abre con la pieza |
| `r_operacion.jpg` | 30.5 | la pantalla Operacion del Equipo, rotulada |
| `r_matriz.jpg` | 30.6 | la matriz de zonas de calor **en castellano**, rotulada |

## Las que NO usa el deck, y por que se quedan

**Son el original sin rotular** — hacen falta para volver a marcar sin ir de nuevo al video:
`c_botonera.jpg` (→ r_botonera) · `c_puesto.jpg` (→ r_puesto) · `p1_entra.jpg` (→ m1_entra) ·
`p2_conformado.jpg` (→ m2_conformado) · `p3_abre.jpg` (→ m3_abre) · `_matriz_es.jpg` (→ r_matriz) ·
`_crudo_operacion.jpg` (→ r_operacion).

**Es para la hoja de apagado, que todavia no existe**: `e0_stop.jpg`, el pulsador rojo
POWER STOP (电源停止). El pulsador esta filmado y rotulado; lo que falta es la secuencia.

**Quedaron descartadas, con el motivo**:

- `p4_saca.jpg` y `m4_saca.jpg` — dos operarios de espaldas tapando el 35 % del ancho, con el
  molde en 2,5 cm² de papel: no se distingue que estan sacando (criterio 9 del skill).
- `p3_desmolde.jpg` — buena foto, pero es del ciclo ANTERIOR (s=110 contra s=119 del paso 1):
  en una secuencia rompe el orden del reloj (criterio 10).
- `c_carteles.jpg`, `c_tcu.jpg` — recortes del puesto que quedaron dentro de `r_puesto.jpg`.
- `e2_botones.jpg` — extraccion fallida: la ventana de foco cayo en el mismo cuadro que
  `e1_llave` y salio la rejilla de ventilacion del tablero, no los pulsadores.

Los `_*.jpg` son cuadros de trabajo y **no van al repo** (`.gitignore`, misma convencion que
`scripts/hotmelt/`).
