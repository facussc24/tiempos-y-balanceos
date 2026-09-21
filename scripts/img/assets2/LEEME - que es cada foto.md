# Las fotos de las hojas de la MOLDEADORA IMG

Cada `.jpg` de esta carpeta lleva **adentro del archivo** de que video y que segundo salio,
con que recorte y con que rotulos. Se lee asi:

```bash
py -3 .claude/skills/hojas-de-proceso/scripts/fotodevideo.py leer scripts/img/assets2/*.jpg
```

Sale con codigo 1 si alguna no lo dice. Una foto sin eso es un huerfano: nadie puede
rehacerla ni verificar de donde salio.

## Las que usa el deck hoy (21)

| archivo | hoja | que es |
|---|---|---|
| `p1_listo.jpg` | portada | la maquina en posicion de arranque |
| `e1_llave.jpg` | 30.1 | la llave general del tablero (Schneider On/Off) |
| `e2_power.jpg` | 30.1 | el boton verde POWER START (电源启动) encendido |
| `n3_servicios.jpg` | 30.1 | la fila de ocho servicios de la pantalla, en verde, rotulada |
| `r_puesto.jpg` | 30.2 | el puesto de mando, rotulado — la marca 3 rodea SOLO el hongo rojo |
| `r2_botonera.jpg` | 30.3 | la botonera con el hongo NEGRO adentro del cuadro, medida y rotulada |
| `v0_montaje.jpg` | 30.4 | el rollo con su eje sobre la cuna de rodillos |
| `v3_punta.jpg` | 30.4 | llevando la punta del vinilo por arriba del rollo |
| `v2_uncoiler.jpg` | 30.4 | los selectores UNCOILER y Leather Conveyor |
| `v4_cinta.jpg` | 30.4 | la lamina sobre la cinta, alisada a mano |
| `r2_automatico.jpg` | 30.5 | la pantalla con Modo Automatico, los servicios y la botonera, rotulada |
| `d1_pieza.jpg` | 30.6 | el operario sacando la pieza del molde (IMG_0844 s=488) |
| `d2_vinilo.jpg` | 30.6 | el operario sacando el RESTO DE VINILO del molde (s=492) |
| `d5_caballete.jpg` | 30.6 | las piezas terminadas en el caballete (s=505) |
| `d3_sustratos.jpg` | 30.6 | los sustratos plasticos en los nidos del molde |
| `n5_mano.jpg` | 30.7 | la mano recorriendo la superficie de la pieza |
| `n8_canto.jpg` | 30.7 | los dedos sobre la punta y el borde |
| `n7_despegue.jpg` | 30.7 | la punta abierta con la piel despegada |

## Las que NO usa el deck, y por que se quedan

**Son el original sin rotular** — hacen falta para volver a marcar sin ir de nuevo al video:
`c_botonera.jpg` · `c_puesto.jpg` (→ r_puesto) · `p1_entra.jpg` · `p2_conformado.jpg` ·
`p3_abre.jpg` · `_matriz_es.jpg` · `_crudo_operacion.jpg` · `n4_botonera.jpg` (→ r2_botonera) ·
`n2_automatico.jpg` (→ r2_automatico).

**Sirven para una hoja que todavia no existe o para contestar una pregunta abierta**:
`e0_stop.jpg` el pulsador rojo POWER STOP, para el apagado · `d6_expulsar.jpg` la pantalla
con `Expulsar Esqueleto` en verde, que es la que hay que mirar cuando el tecnico aclare si
"Esqueleto" es el sustrato o el sobrante · `v5_carga_hmi.jpg` la pantalla Manual-Carga en
castellano · `d4_nidos.jpg` el plano general de dos personas cargando sustratos ·
`d5_molde_limpio.jpg` el molde sin el sobrante.

**Quedaron descartadas, con el motivo**:

- `p4_saca.jpg` y `m4_saca.jpg` — dos operarios de espaldas tapando el 35 % del ancho.
- `m1_entra.jpg`, `m2_conformado.jpg`, `m3_abre.jpg` — eran la hoja del ciclo escrita como
  narracion de la maquina; la reemplazo la 30.6, que muestra lo que hace el operario.
  `m3_abre` ademas estaba mal leida: a los 396 s la maquina no "abre con la pieza", y la
  pieza ya se habia sacado a los 488 s del mismo video.
- `e3_chiller.jpg`, `e4_manometros.jpg` — los manometros salieron por pedido de Fak
  (*"¿para que hace falta eso? al pedo esta"*); el chiller se prende de la pantalla.
- `r_operacion.jpg`, `r_matriz.jpg` — eran hojas de "conocer la pantalla", que no son hojas
  de proceso. La matriz de calor la reemplazo el control de la pieza.
- `n1_tableros.jpg`, `n6_compara.jpg` — no entraron en ninguna hoja.
- `c_carteles.jpg`, `c_tcu.jpg`, `e2_botones.jpg` — recortes fallidos o ya contenidos.

Los `_*.jpg` son cuadros de trabajo y **no van al repo** (`.gitignore`, misma convencion que
`scripts/hotmelt/`).
