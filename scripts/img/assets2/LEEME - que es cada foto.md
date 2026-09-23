# Las fotos de las hojas de la MOLDEADORA IMG

Cada `.jpg` de esta carpeta lleva **adentro del archivo** de que video y que segundo salio,
con que recorte y con que rotulos. Se lee asi:

```bash
py -3 .claude/skills/hojas-de-proceso/scripts/fotodevideo.py leer scripts/img/assets2/*.jpg
```

Sale con codigo 1 si alguna no lo dice. Una foto sin eso es un huerfano: nadie puede
rehacerla ni verificar de donde salio.

## Las que usa el deck hoy (20)

| archivo | hoja | que es |
|---|---|---|
| `p1_listo.jpg` | portada | la maquina en posicion de arranque |
| `e1_llave.jpg` | 30.1 | la llave general del tablero (Schneider On/Off) |
| `e2_power.jpg` | 30.1 | el boton verde POWER START (电源启动) encendido |
| `n3_servicios.jpg` | 30.1 | la fila de ocho servicios de la pantalla; el recuadro se corrigio el 22/09 (cortaba los iconos) |
| `r_puesto.jpg` | 30.2 | el puesto de mando rotulado; la marca 4 se bajo el 22/09 (tapaba el boton verde) |
| `y0_rollo_cuna.jpg` | 30.3 | el rollo con su eje sobre el soporte y la perilla del tope (IMG_0393 s=34,6) |
| `x2_enhebrar.jpg` | 30.3 | las manos llevan la punta entre las barras y el rodillo (s=48,5), sin caras |
| `x3r_mesa_sensor.jpg` | 30.3 | `x3_mesa` (s=114) con UN recuadro sobre el sensor de la mesa: el soporte con el cable negro. Con una sola marca `rotular.py` no dibuja numero, asi que no choca con el del paso (23/09) |
| `x1_desenrollador.jpg` | 30.3 | el rollo en la cuna, con su eje y el material derecho (s=134) |
| `x6b_alimentacion.jpg` | 30.4 | la pantalla con `Seleccion Lamina Alimentacion: Cuero en rollo`, recortada a 2:1 (IMG_0661 s=30) |
| `x4b_selectores.jpg` | 30.4 | la cajita de la mesa: UNCOILER y Leather Convey con FWD y REV, a 2:1 (IMG_0579 s=96,5) |
| `x8_lazo.jpg` | 30.4 | el material colgando entre el desenrollador y la mesa (IMG_0579 s=103); arriba a la izquierda, el sensor (23/09) |
| `r2_botonera.jpg` | 30.5 | la botonera con el hongo NEGRO de la caja colgante; la marca 1 se bajo el 22/09 (tapaba 自动) |
| `d1_pieza.jpg` | 30.6 | el operario sacando la pieza del molde (IMG_0844 s=488) |
| `d2_vinilo.jpg` | 30.6 | el operario sacando el RESTO DE VINILO del molde (s=492) |
| `d5_caballete.jpg` | 30.6 | las piezas terminadas en el caballete (s=505) |
| `d3_sustratos.jpg` | 30.6 | los sustratos en los nidos del molde (IMG_0579 s=480), sin las cabezas |
| `z1_globito.jpg` | 30.7 | globito y grano planchado en la punta (foto de Fak, 10/09) |
| `z2_puntitos.jpg` | 30.7 | los tres puntitos de los agujeros de vacio (IMG_0622, 03/09) |
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

- `x5r_botonera.jpg` / `x5_botonera.jpg` (la botonera de CARGA rotulada) y `x7_carga_hmi.jpg` — eran de la hoja del corte manual, que salio de la jornada el 22/09: el primer corte lo hace la maquina sola (IMG_0579 min 2:46). Se quedan para cuando el tecnico diga cuando se usa el corte a mano.
- `r2_automatico.jpg` — la 30.7 vieja: no mostraba el boton negro. La reemplaza `r2_botonera.jpg` en la hoja de arranque.
- `n5_mano.jpg`, `n8_canto.jpg` — la hoja de control no mostraba ningun defecto. Las reemplazan `z1_globito.jpg` y `z2_puntitos.jpg`.

- `w1_rollo.jpg`, `w3_mesa.jpg`, `w5_selectores.jpg`, `w4_derecho.jpg`, `w7_alimentacion.jpg`
  y `w2_punta.jpg` — el primer set del vinilo (21/09). `w1_rollo` salio **rotada 90°**,
  con el operario acostado: el IMG_0393 declara `rotation=-90` pero el que filma giro el
  telefono a mitad del video, asi que la rotacion correcta cambia SEGUN EL SEGUNDO. Del
  mismo video, con los mismos parametros, `w4_derecho` (s=135) salio derecha. `w3_mesa`
  (foco 14) y `w5_selectores` (foco 37) salieron movidas, y en la segunda no se leian las
  chapas que la hoja nombraba. Los reemplaza el set `x*`, elegido barriendo el video
  entero y mirando la plancha de contacto.
- `v0_montaje.jpg`, `v1_rollo.jpg`, `v2_uncoiler.jpg`, `v3_punta.jpg`, `v4_cinta.jpg`
  — el set anterior a ese. `v4_cinta` ademas nombraba una **cinta que esta maquina no
  tiene**.

- `x6_alimentacion.jpg`, `x4_selectores.jpg`, `x3_mesa.jpg` — reemplazadas el 23/09 por
  `x6b`, `x4b` y `x3r`. Con tres fotos en la 30.4 la celda es 2:1 y las dos primeras eran
  casi cuadradas: quedaban a la mitad de su celda. `x3_mesa` es el original sin marcar de
  `x3r_mesa_sensor`.
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

`_plancha_del_deck.jpg` es la plancha de contacto con TODAS las fotos que usa el deck,
juntas y a tamano util. El generador la exige mas nueva que la ultima foto que se toco:
para pasar ese gate hay que regenerarla, y para regenerarla se abre. Existe porque la
rotacion y el encuadre no los caza ningun numero — probe el foco contra las 55 fotos de
esta carpeta y la llave general (34) y el caballete (109) estan perfectas mientras que
`w5_selectores` (37) es ilegible. Se mira, no se mide.

Los `_*.jpg` son cuadros de trabajo y **no van al repo** (`.gitignore`, misma convencion que
`scripts/hotmelt/`).
