# Lo que dice Bambu Lab de la A2L (wiki oficial, leída el 13/10/2026)

Cada dato con su página. **Los originales están en la nube de Ingeniería,
`INGENIERIA BARACK (NUNCA BORRAR)\4- MANUALES\IMPRESORA 3D BAMBU LAB A2L\`**: 11 páginas, cada una
como transcripción `.txt` (texto original en inglés, con URL, fecha y cómo se obtuvo) y captura
`.png` de la página completa. Ahí no va nada mío: este resumen vive en la skill
(regla `documentacion-oficial.md`). Copia de trabajo: `exports/impresion_3d/fuentes_bambu/*.txt` (se vuelve a bajar con `scripts/wiki_bambu.py <ruta> <carpeta>
[--captura]`; WebFetch da 402 con esta wiki, pedida como navegador contesta). Índice de la A2L:
`https://wiki.bambulab.com/en/a2l`. Antes de afirmar algo que no esté acá, se baja la página.

## La placa: por qué se despega una pieza y cómo se limpia

Fuentes: `en/filament-acc/acc/pei-plate-clean-guide` · `en/general/textured-PEI-plate-not-working-as-expected`
· `en/a2l/manual/first-print` · `en/a2l/maintenance/period-maintenance`.
Captura para mostrar: `exports/impresion_3d/fuentes_bambu/EVIDENCIA_limpieza_placa_Bambu.png`.

- **No tocar la superficie con los dedos**: la grasa de la piel baja la adherencia y no se ve
  hasta la primera capa.
- **Se lava con agua tibia + detergente de cocina + esponja, y se seca con papel.** El detergente
  no tiene que traer aceites ni humectantes.
- **Alcohol no, en la placa texturada**: *"Alcohol might just spread the oils on the print surface
  instead of removing it"*; el detergente desengrasa y la esponja llega adentro de la textura.
- **Acetona nunca**: *"Do not clean the Textured PEI with Acetone, as it will damage the PEI surface"*.
- **Prueba de que quedó limpia**: el agua forma una película pareja. Si corre en hilos y junta
  gotas, sigue sucia.
- Si después de lavar sigue sin pegar, en este orden: subir un poco la temperatura de la placa
  (en PLA, demasiado alta tapa la boquilla y da «pata de elefante»); agregar borde (*brim*) a las
  piezas chicas y soportes a las altas y finas; revisar la temperatura si el perfil fue tocado;
  primera capa de 0,5 mm de ancho de línea y 0,25 mm de alto; dar vuelta la placa.
- No lleva pegamento para los materiales comunes.
- **Sacar la pieza**: esperar a que placa y pieza lleguen a temperatura ambiente, sacar la chapa
  y flexionarla. La línea de purga se saca con la espátula.
- Una zona gastada del recubrimiento donde la impresora limpia la boquilla es normal; si el
  desgaste está en la zona de impresión, se usa la otra cara o se cambia la placa, y se nivela.
- Antes de poner la chapa: la cama magnética sin restos (se daña al calentar).

## Lo que la impresora detecta sola (y pausa)

Fuentes: `en/a2l/manual/a2l-faq` · `nozzle-clumping-detection` · `air-printing-and-filament-tangle-detection`.

- **No tiene detección de enredos por cámara.** Tiene sensores: fin de filamento, impresión en el
  aire, filamento trabado y pegote en la boquilla. Por eso vale la pena mirar la cámara desde afuera.
- **Pegote en la boquilla** (sensor mecánico en el limpiador de purga; por defecto «Auto»): se
  controla cada vez que el cabezal pasa por la purga (extrusión, cambio de color), **obligatorio
  en las capas 2 y 3**, a intervalos fijos **hasta los 10 mm de altura**, y en PLA cada 6 g
  consumidos, 3 veces. **Después de los 10 mm y de esos 18 g ya no hay control fijo**: ahí la
  vigilancia por cámara es la única que queda. Bambu avisa que no es una detección infalible.
- **Impresión en el aire** (boquilla tapada, filamento gastado) y **filamento trabado** (el
  carrete o el tubo frenan): pausan y avisan. Con el cargador de 4 lugares vienen activadas.
  Con filamento flexible (TPU) no se detecta el trabado.
- Todas se configuran en la pantalla: Ajustes > Opciones de impresión.
- **Cámara: 0,5 cuadros por segundo** (una imagen cada 2 s).

## Materiales, placas y ambiente

Fuente: `en/a2l/manual/a2l-faq`.

- Materiales: PLA, PETG, TPU y soportes para PLA/PETG. Con boquilla de acero endurecido, PLA-CF y
  PETG-CF. (No ABS/ASA: es abierta y de baja temperatura.)
- Placas admitidas: **Textured PEI**, Engineering y Cool Plate SuperTack Pro. La «Cool Plate» común no.
- Ambiente: **15 a 30 °C**, humedad por debajo de 85 %.
- Cambio de color (`purge-mode`): en Bambu Studio hay modo Estándar (purga a la temperatura más
  alta recomendada; calienta en cada cambio) y Rápido (1,2 veces el volumen, a la temperatura de
  impresión: ahorra el calentar y enfriar de cada cambio).

## Mantenimiento que pide Bambu (para avisarle a Fak por horas y por rollos)

Fuente: `en/a2l/maintenance/period-maintenance`. Siempre con la impresora apagada y desenchufada.

| Qué | Cada cuánto |
|---|---|
| Lubricar la guía del eje X (aceite; **grasa prohibida** en esa guía) | 1 vez por mes |
| Lubricar las guías del eje Y | al desembalar y cada **200 horas** de impresión (la impresora avisa) |
| Limpiar los 2 ventiladores del cabezal | 1 vez por mes |
| Limpiar el engranaje del extrusor | cada **5 rollos** de PLA/PETG (2 con fibra de carbono), o si hay sub-extrusión o impresión en el aire |
| Revisar la cuchilla de corte de filamento (multicolor la gasta) | cada **3 rollos** |
| Tubos de PTFE | cada **6 rollos** de PLA (2 con fibra o madera) |
| Limpiador de silicona de la boquilla | cambiar cuando se vea dañado |
| Lavar la placa | seguido; siempre que se haya tocado |
